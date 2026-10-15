"""
Gera os dados do Catálogo de BIs (03-dashboard/data/catalogo_data.js) a partir de
saida/catalogo_metadados.xlsx.

O que faz:
  1. Lê as abas do Excel extraído pelo notebook (01-extracao).
  2. Separa o workspace 'BI Histórico' (fica só no catálogo, fora de relações/clusters).
  3. Classifica cada relatório em um dos temas-alvo (Solicitações, Portfólio, Risco,
     Cotas, Limites, PDD, Compliance, Cliente ou Outros) por palavras-chave.
  4. Calcula similaridade entre relatórios (tabelas, medidas e colunas com peso IDF)
     e agrupa em clusters (Louvain).
  5. Calcula um score de saúde (uso, refresh, ambiente, duplicidade) e uma recomendação:
     Manter / Consolidar / Revisar / Arquivar.
  6. Monta o grafo de tabelas e as tabelas-chave candidatas por tema.

Uso (a partir da raiz do projeto):
    .venv\\Scripts\\python.exe 02-processamento\\gerar_catalogo.py
"""
import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
ENTRADA = RAIZ / "saida" / "catalogo_metadados.xlsx"
SAIDA = RAIZ / "03-dashboard" / "data" / "catalogo_data.js"

WS_HISTORICO = "BI Histórico"
RELATORIOS_SISTEMA = {"usage metrics report", "report usage metrics report"}

# --------------------------------------------------------------------------- temas
TEMAS = ["Solicitações", "Portfólio", "Risco", "Cotas", "Limites", "PDD", "Compliance", "Cliente"]
OUTROS = "Outros"

PALAVRAS = {
    "Solicitações": ["solicitac", "solicitacao", "solicitacoes", "funil", "motor", "decisao", "decision",
                     "analise credito", "recusa", "aprovac", "reprovac", "proposta", "onboarding",
                     "convite", "formalizac", "pedido", "dinamica", "orquestrador", "esteira"],
    "Portfólio": ["portfolio", "carteira", "estoque", "desembolso", "vencimento", "vencido", "inadimpl",
                  "safra", "emissao", "cessao", "supercessao", "titulo", "pagamento", "liquidez",
                  "tir", "datatape", "vintage", "over", "ever", "baixa", "amortizac", "duplicata"],
    "Risco": ["risk", "risco", "rating", "concentra", "enquadramento", "cvm", "hedge", "monitoramento",
              "exposicao", "top devedor", "garantia", "stress", "var ", "score", "mob", "diligencia"],
    "Cotas": ["cota", "pl ", "patrimonio", "subordina", "fundo", "fidc", "classe", "pnl", "veiculo",
              "cdi", "rentabilidade"],
    "Limites": ["limite", "limtes", "dpp", "franquia", "credito disponivel", "exposicao total"],
    "PDD": ["pdd", "provis", "excesso spread", "perda esperada", "perda", "write off", "writeoff"],
    "Compliance": ["compliance", "parecer", "neoway", "icij", "ibama", "icmbio", "contrabando",
                   "receita federal", "judicial", "proc jud", "pep", "doac polit", "bureau", "serasa",
                   "kyc", "pld", "sancao", "trabalho escravo", "antecipad"],
    "Cliente": ["cliente", "cedente", "devedor", "produtor", "cadastro", "revenda", "grupo economico",
                "grupos economicos", "contato", "cpf", "cnpj", "imoveis rurais", "imovel", "retail",
                "varejo", "fornecedor", "sacado"],
}

# tabelas genéricas que não devem gerar "relação" entre relatórios
GENERICA = re.compile(
    r"^(_+)?medidas?\d*$|^_medida|calend|^d?datas?$|^cores$|^filtros|^tabela( \(\d+\))?$|localdate|"
    r"datetabletemplate|^parametro|^medida|^sumarizacao$|^principal$|^dtemissao_geral$|^dtvencimento_geral$",
    re.I)


def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[_\-\.\[\]\(\)/]+", " ", s).strip()


def nome_base(s):
    """Nome sem prefixos de ambiente/versão (para achar duplicatas)."""
    s = norm(s)
    s = re.sub(r"\b(homologacao|homolog|teste|test|old|antigo|novo|staging|stanging|v\d+|\d{6,8}|"
               r"prod|producao|auditoria|liverpool)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def lista(v, sep=";"):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return []
    return [x.strip() for x in str(v).split(sep) if x.strip()]


def num(v):
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except (TypeError, ValueError):
        return None


def data(v):
    t = pd.to_datetime(v, errors="coerce", utc=True)
    return None if pd.isna(t) else t.strftime("%Y-%m-%d")


# --------------------------------------------------------------------------- leitura
def ler():
    xl = pd.ExcelFile(ENTRADA)
    abas = {}
    for aba in ["catalogo_paineis", "relatorios", "tabelas_campos", "indicadores_por_painel",
                "agenda_refresh", "uso_por_usuario", "datasets", "workspaces", "paginas",
                "relacionamentos", "historico_refresh", "fontes"]:
        abas[aba] = xl.parse(aba)
    # gerada por atualizar_uso.py (até quando cada workspace tem dados de uso)
    abas["uso_telemetria_workspace"] = xl.parse("uso_telemetria_workspace") if "uso_telemetria_workspace" in xl.sheet_names else pd.DataFrame()
    return abas


def texto(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) or str(v).strip() in ("", "nan") else str(v).strip()


# --------------------------------------------------------------------------- temas
def pontuar_temas(texto_pesos):
    """texto_pesos: lista de (texto normalizado, peso). Devolve dict tema->score."""
    sc = defaultdict(float)
    for texto, peso in texto_pesos:
        t = f" {texto} "
        for tema, kws in PALAVRAS.items():
            hits = sum(1 for k in kws if k in t)
            if hits:
                sc[tema] += peso * min(hits, 2)
    return sc


def tema_da_tabela(nome):
    sc = pontuar_temas([(norm(nome), 1)])
    if not sc:
        return OUTROS
    return max(sc.items(), key=lambda x: x[1])[0]


# --------------------------------------------------------------------------- Louvain
def louvain(nos, arestas, seed_order=None):
    """Louvain simples (pesos não dirigidos). Retorna dict no->comunidade (int)."""
    adj = defaultdict(lambda: defaultdict(float))
    for a, b, w in arestas:
        if a == b:
            continue
        adj[a][b] += w
        adj[b][a] += w
    comunidade_final = {n: n for n in nos}
    nivel_nos = list(nos)
    nivel_adj = adj
    while True:
        m2 = sum(sum(v.values()) for v in nivel_adj.values())
        if m2 == 0:
            break
        k = {n: sum(nivel_adj[n].values()) for n in nivel_nos}
        com = {n: n for n in nivel_nos}
        tot = defaultdict(float)
        for n in nivel_nos:
            tot[n] += k[n]
        mudou_algo = False
        for _ in range(20):
            mudou = False
            for n in nivel_nos:
                c_atual = com[n]
                pesos = defaultdict(float)
                for viz, w in nivel_adj[n].items():
                    pesos[com[viz]] += w
                tot[c_atual] -= k[n]
                melhor, ganho_melhor = c_atual, pesos.get(c_atual, 0) - tot[c_atual] * k[n] / m2
                for c, w in pesos.items():
                    g = w - tot[c] * k[n] / m2
                    if g > ganho_melhor + 1e-12:
                        melhor, ganho_melhor = c, g
                com[n] = melhor
                tot[melhor] += k[n]
                if melhor != c_atual:
                    mudou = mudou_algo = True
            if not mudou:
                break
        if not mudou_algo:
            break
        # agrega
        for orig, c in comunidade_final.items():
            comunidade_final[orig] = com[c]
        novo_adj = defaultdict(lambda: defaultdict(float))
        for a, viz in nivel_adj.items():
            for b, w in viz.items():
                if com[a] != com[b]:
                    novo_adj[com[a]][com[b]] += w
        nivel_nos = sorted(set(com.values()), key=str)
        nivel_adj = novo_adj
    ids = {}
    return {n: ids.setdefault(c, len(ids)) for n, c in comunidade_final.items()}


# --------------------------------------------------------------------------- principal
def main():
    ab = ler()
    cp = ab["catalogo_paineis"]
    rel = ab["relatorios"][["relatorio_id", "dataset_id"]]
    cp = cp.merge(rel, on="relatorio_id", how="left")

    ag = ab["agenda_refresh"].drop_duplicates("dataset_id").set_index("dataset_id")["ativo"].to_dict()
    ds_nome = ab["datasets"].drop_duplicates("dataset_id").set_index("dataset_id")["dataset"].to_dict()
    ds_modo = ab["datasets"].drop_duplicates("dataset_id").set_index("dataset_id")["modo_armazenamento"].to_dict()

    # colunas por (workspace, relatorio)
    tc = ab["tabelas_campos"]
    campos = defaultdict(list)
    for r in tc.itertuples():
        campos[(r.workspace, r.relatorio)].append(
            {"t": str(r.tabela), "p": str(r.papel), "c": lista(r.campos, ",")})

    # medidas por (workspace, relatorio)
    ind = ab["indicadores_por_painel"]
    medidas = defaultdict(list)
    for r in ind.itertuples():
        medidas[(r.workspace, r.relatorio)].append(
            {"m": str(r.medida), "t": str(r.tabela), "d": None if pd.isna(r.descricao) else str(r.descricao)})

    # uso por usuário
    uso = defaultdict(list)
    if "usuario" in ab["uso_por_usuario"]:
        for r in ab["uso_por_usuario"].itertuples():
            uso[(r.workspace, r.relatorio)].append({"u": str(r.usuario), "v": int(r.views), "d": texto(r.ultima_view)})

    # relacionamentos por dataset (para o mini-diagrama do modelo)
    rels_ds = defaultdict(list)
    for r in ab["relacionamentos"].itertuples():
        if GENERICA.search(str(r.ToTable)) or GENERICA.search(str(r.FromTable)):
            continue
        rels_ds[r.dataset_id].append([str(r.FromTable), str(r.FromColumn), str(r.ToTable), str(r.ToColumn)])

    # histórico de refresh por dataset
    hist = defaultdict(list)
    for r in ab["historico_refresh"].itertuples():
        hist[r.dataset_id].append({"s": str(r.status), "i": data(r.inicio)})

    ws_df = ab["workspaces"]
    workspaces = ws_df["workspace"].tolist()

    # data de referência = data da extração (último refresh/uso observado)
    ref_extracao = pd.Timestamp(datetime.fromtimestamp(ENTRADA.stat().st_mtime)).normalize()

    # ------------------------------------------------------------- relatórios
    reps = []
    for i, r in enumerate(cp.itertuples()):
        chave = (r.workspace, r.relatorio)
        tabs = campos.get(chave, [])
        meds = medidas.get(chave, [])
        pags = lista(r.paginas)
        hist_ = (r.workspace == WS_HISTORICO)
        sistema = norm(r.relatorio) in RELATORIOS_SISTEMA
        nb = norm(r.relatorio)
        ambiente_np = bool(re.search(r"homolog|uat", norm(r.workspace))) or bool(
            re.search(r"\b(teste|test|old|antigo|staging|stanging|homolog|homologacao|auditoria)\b", nb))
        views = num(r.views_total)
        viewers = num(r.viewers_total)
        dias_ref = num(r.dias_desde_refresh_sucesso)
        criado = data(r.criado_em)
        idade = (ref_extracao.tz_localize(None) - pd.Timestamp(criado)).days if criado else None
        ult_vis = None if pd.isna(r.ultima_visualizacao) else str(r.ultima_visualizacao)[:10]
        per = None if pd.isna(r.periodo_uso_coberto) or str(r.periodo_uso_coberto).strip() == "a" else str(r.periodo_uso_coberto)
        tel_desde, uso_ate = texto(getattr(r, "telemetria_desde", None)), texto(getattr(r, "uso_dados_ate", None))
        tel_sit = texto(getattr(r, "situacao_telemetria", None))

        # temas
        tp = [(nb, 12), (norm(r.workspace), 4)] + [(norm(p), 2) for p in pags if not re.fullmatch(r"(page|pagina)\s*\d+", norm(p))]
        for t in tabs:
            if GENERICA.search(t["t"]):
                continue
            tp.append((norm(t["t"]), 3 if t["p"] == "fato" else 1.5))
        for m in meds[:300]:
            tp.append((norm(m["m"]), 0.25))
        sc = pontuar_temas(tp)
        total = sum(sc.values())
        if total >= 3:
            tema = max(sc.items(), key=lambda x: x[1])[0]
        else:
            tema = OUTROS
        tema_scores = {t: round(sc.get(t, 0) / total, 3) if total else 0 for t in TEMAS}

        reps.append({
            "id": r.relatorio_id, "nome": r.relatorio, "ws": r.workspace, "url": r.url,
            "dataset_id": None if pd.isna(r.dataset_id) else r.dataset_id,
            "dataset": ds_nome.get(r.dataset_id), "modo": None if pd.isna(ds_modo.get(r.dataset_id, None)) else ds_modo.get(r.dataset_id),
            "historico": hist_, "sistema": sistema, "nao_produtivo": ambiente_np,
            "criado": criado, "idade_dias": idade,
            "owner": None if pd.isna(r.owner_tecnico_dataset) else r.owner_tecnico_dataset,
            "admins": None if pd.isna(r.admins_workspace) else r.admins_workspace,
            "finalidade": None if pd.isna(r.finalidade_sugerida) else r.finalidade_sugerida,
            "n_paginas": int(r.n_paginas), "paginas": pags,
            "n_medidas": int(r.n_medidas), "medidas_sem_desc": int(r.medidas_sem_descricao),
            "n_tabelas": int(r.n_tabelas),
            "fontes": lista(r.fontes, "|"),
            "views": views, "viewers": viewers, "ult_vis": ult_vis, "periodo_uso": per,
            "page_views": num(getattr(r, "page_views_total", None)),
            "tel_desde": tel_desde, "uso_ate": uso_ate,
            "tel_congelada": bool(tel_sit and tel_sit.startswith("congelada")), "tel_situacao": tel_sit,
            "uso_usuarios": uso.get(chave, [])[:30],
            "ult_refresh": data(r.ultimo_refresh_sucesso), "dias_refresh": dias_ref,
            "status_refresh": None if pd.isna(r.ultimo_refresh_status) else r.ultimo_refresh_status,
            "falhas10": int(r.refresh_falhas_ultimos_10),
            "agenda_ativa": None if r.dataset_id not in ag else bool(ag[r.dataset_id]),
            "refresh_dias": None if pd.isna(r.refresh_dias) else json.loads(r.refresh_dias) if str(r.refresh_dias).startswith("[") else r.refresh_dias,
            "refresh_hor": None if pd.isna(r.refresh_horarios) else json.loads(r.refresh_horarios) if str(r.refresh_horarios).startswith("[") else r.refresh_horarios,
            "hist_refresh": hist.get(r.dataset_id, [])[:10],
            "tabelas": tabs, "medidas": meds,
            "relacoes_modelo": rels_ds.get(r.dataset_id, [])[:80],
            "tema": tema, "tema_scores": tema_scores,
        })

    # ------------------------------------------------------------- similaridade (só ativos)
    ativos = [x for x in reps if not x["historico"] and not x["sistema"]]
    N = len(ativos)

    def conj_tab(x):
        return {norm(t["t"]) for t in x["tabelas"] if not GENERICA.search(t["t"])}

    def conj_med(x):
        return {norm(m["m"]) for m in x["medidas"]}

    def conj_col(x):
        s = set()
        for t in x["tabelas"]:
            if GENERICA.search(t["t"]):
                continue
            for c in t["c"]:
                s.add(norm(c))
        return s

    S_tab = {x["id"]: conj_tab(x) for x in ativos}
    S_med = {x["id"]: conj_med(x) for x in ativos}
    S_col = {x["id"]: conj_col(x) for x in ativos}

    def idf(conjuntos):
        df = Counter()
        for s in conjuntos.values():
            df.update(s)
        return {k: math.log((N + 1) / (v + 0.5)) for k, v in df.items()}

    I_tab, I_med, I_col = idf(S_tab), idf(S_med), idf(S_col)

    def wj(a, b, w):
        if not a or not b:
            return 0.0, []
        inter = a & b
        uni = a | b
        num_ = sum(w.get(k, 0) for k in inter)
        den = sum(w.get(k, 0) for k in uni)
        return (num_ / den if den else 0.0), sorted(inter, key=lambda k: -w.get(k, 0))

    arestas = []
    for i in range(N):
        A = ativos[i]
        for j in range(i + 1, N):
            B = ativos[j]
            jt, ct = wj(S_tab[A["id"]], S_tab[B["id"]], I_tab)
            jm, cm = wj(S_med[A["id"]], S_med[B["id"]], I_med)
            jc, cc = wj(S_col[A["id"]], S_col[B["id"]], I_col)
            mesmo_ds = bool(A["dataset_id"]) and A["dataset_id"] == B["dataset_id"]
            nb_a, nb_b = nome_base(A["nome"]), nome_base(B["nome"])
            sn = SequenceMatcher(None, nb_a, nb_b).ratio() if nb_a and nb_b else 0
            nome_dup = nb_a == nb_b and nb_a != ""
            s = 0.5 * jt + 0.25 * jm + 0.25 * jc
            if mesmo_ds:
                s = max(s, 0.95)
            if nome_dup and (jt > 0.3 or not S_tab[A["id"]] or not S_tab[B["id"]]):
                s = max(s, 0.85)
            if s < 0.15 and not nome_dup:
                continue
            if mesmo_ds:
                tipo = "mesmo_modelo"
            elif nome_dup and s >= 0.6:
                tipo = "duplicado"
            elif nome_dup:
                tipo = "nome_igual"
            elif s >= 0.5:
                tipo = "alta_sobreposicao"
            elif s >= 0.3:
                tipo = "sobreposicao"
            else:
                tipo = "relacionado"
            arestas.append({
                "a": A["id"], "b": B["id"], "s": round(s, 3), "jt": round(jt, 3), "jm": round(jm, 3),
                "jc": round(jc, 3), "sn": round(sn, 2), "tipo": tipo,
                "tab_comuns": ct[:15], "n_tab_comuns": len(ct), "n_med_comuns": len(cm), "n_col_comuns": len(cc),
                "med_comuns": cm[:12],
            })

    # clusters Louvain
    comm = louvain([x["id"] for x in ativos], [(e["a"], e["b"], e["s"]) for e in arestas if e["s"] >= 0.2])
    por_cluster = defaultdict(list)
    for x in ativos:
        x["cluster"] = comm.get(x["id"])
        por_cluster[x["cluster"]].append(x)
    # renumera por tamanho
    ordem = sorted(por_cluster, key=lambda c: -len(por_cluster[c]))
    ren = {c: i + 1 for i, c in enumerate(ordem)}
    clusters = []
    for c in ordem:
        membros = por_cluster[c]
        for x in membros:
            x["cluster"] = ren[c]
        tcont = Counter()
        for x in membros:
            tcont.update(S_tab[x["id"]])
        temas_c = Counter(x["tema"] for x in membros)
        clusters.append({
            "id": ren[c], "n": len(membros), "membros": [x["id"] for x in membros],
            "tema_dominante": temas_c.most_common(1)[0][0],
            "temas": dict(temas_c),
            "workspaces": sorted({x["ws"] for x in membros}),
            "tabelas_top": [[t, n] for t, n in tcont.most_common(12) if n >= 2] if len(membros) > 1 else [[t, n] for t, n in tcont.most_common(6)],
            "views": sum(x["views"] or 0 for x in membros),
        })

    # ------------------------------------------------------------- saúde / recomendação
    viz_forte = defaultdict(list)
    for e in arestas:
        if e["tipo"] in ("mesmo_modelo", "duplicado", "alta_sobreposicao", "nome_igual"):
            viz_forte[e["a"]].append(e)
            viz_forte[e["b"]].append(e)
    por_id = {x["id"]: x for x in reps}

    for x in reps:
        motivos, score = [], 100
        if x["sistema"]:
            x.update(score=None, rec="Sistema", motivos=["Relatório automático de métricas de uso do Power BI"])
            continue
        if x["historico"]:
            x.update(score=None, rec="Histórico", motivos=["Já está no workspace BI Histórico"])
            continue
        v, dr = x["views"], x["dias_refresh"]
        # uso
        if v is None:
            motivos.append("Sem telemetria de uso (workspace sem Usage Metrics acessível)")
            score -= 10
        elif v == 0:
            motivos.append("Zero visualizações no período coberto")
            score -= 40
        elif v < 5:
            motivos.append(f"Uso muito baixo ({int(v)} views)")
            score -= 25
        elif v < 20:
            motivos.append(f"Uso baixo ({int(v)} views)")
            score -= 10
        if x["viewers"] is not None and x["viewers"] == 1 and (v or 0) > 0:
            motivos.append("Apenas 1 usuário acessa")
            score -= 8
        if x["tel_congelada"]:  # informativo: o uso pode estar subestimado
            motivos.append(f"Uso medido só até {x['uso_ate']} (Usage Metrics sem refresh)")
        # refresh
        if dr is None:
            if x["status_refresh"] in (None, "Unknown"):
                motivos.append("Sem histórico de atualização")
                score -= 15
            else:
                motivos.append(f"Nunca teve refresh com sucesso registrado ({x['status_refresh']})")
                score -= 20
        elif dr > 180:
            motivos.append(f"Dados parados há {int(dr)} dias")
            score -= 30
        elif dr > 60:
            motivos.append(f"Último refresh com sucesso há {int(dr)} dias")
            score -= 18
        elif dr > 14:
            motivos.append(f"Refresh atrasado ({int(dr)} dias)")
            score -= 8
        if x["status_refresh"] == "Failed":
            motivos.append("Último refresh falhou")
            score -= 10
        if x["falhas10"] >= 5:
            motivos.append(f"{x['falhas10']} falhas nos últimos 10 refreshes")
            score -= 8
        if x["agenda_ativa"] is False:
            motivos.append("Agenda de refresh desativada")
            score -= 8
        # ambiente
        if x["nao_produtivo"]:
            motivos.append("Versão de teste / homologação / antiga")
            score -= 15
        if x["idade_dias"] and x["idade_dias"] > 730:
            motivos.append(f"Criado há {x['idade_dias'] // 365} anos")
            score -= 5
        if x["n_tabelas"] == 0:
            motivos.append("Modelo sem tabelas acessíveis")
            score -= 5
        # sobreposição
        fortes = viz_forte.get(x["id"], [])
        dup_mais_usado = []
        for e in fortes:
            outro = por_id[e["b"] if e["a"] == x["id"] else e["a"]]
            dup_mais_usado.append(outro)
        if fortes:
            motivos.append(f"Sobreposição forte com {len(fortes)} relatório(s)")
            score -= min(15, 5 * len(fortes))
        score = max(0, min(100, score))
        if score < 40 or (x["nao_produtivo"] and (v or 0) < 5):
            rec = "Arquivar"
        elif fortes and score < 85:
            rec = "Consolidar"
        elif score < 65:
            rec = "Revisar"
        elif fortes:
            rec = "Consolidar"
        else:
            rec = "Manter"
        x.update(score=score, rec=rec, motivos=motivos or ["Uso e atualização saudáveis"])

    # ------------------------------------------------------------- tabelas
    tab_info = {}
    for x in ativos:
        for t in x["tabelas"]:
            if GENERICA.search(t["t"]):
                continue
            k = norm(t["t"])
            ti = tab_info.setdefault(k, {"nome": t["t"], "papeis": Counter(), "reps": set(), "ws": set(),
                                         "cols": set(), "temas_rep": Counter()})
            ti["papeis"][t["p"]] += 1
            ti["reps"].add(x["id"])
            ti["ws"].add(x["ws"])
            ti["cols"].update(norm(c) for c in t["c"])
            ti["temas_rep"][x["tema"]] += 1
    tabelas = []
    for k, ti in tab_info.items():
        tema_nome = tema_da_tabela(ti["nome"])
        tema_uso = ti["temas_rep"].most_common(1)[0][0]
        tabelas.append({
            "k": k, "nome": ti["nome"], "papel": ti["papeis"].most_common(1)[0][0],
            "n_reps": len(ti["reps"]), "reps": sorted(ti["reps"]), "ws": sorted(ti["ws"]),
            "n_cols": len(ti["cols"]), "cols": sorted(ti["cols"])[:200],
            "tema": tema_nome if tema_nome != OUTROS else tema_uso, "temas_rep": dict(ti["temas_rep"]),
        })
    tabelas.sort(key=lambda t: (-t["n_reps"], t["nome"]))

    # arestas tabela-tabela: colunas parecidas (possível tabela duplicada/derivada)
    tab_ar = []
    tl = [t for t in tabelas if t["n_cols"] >= 4]
    cols_sets = {t["k"]: set(tab_info[t["k"]]["cols"]) for t in tl}
    for i in range(len(tl)):
        a = tl[i]
        for j in range(i + 1, len(tl)):
            b = tl[j]
            A, B = cols_sets[a["k"]], cols_sets[b["k"]]
            inter = len(A & B)
            if inter < 4:
                continue
            jac = inter / len(A | B)
            if jac >= 0.5:
                tab_ar.append({"a": a["k"], "b": b["k"], "s": round(jac, 3), "n": inter, "tipo": "colunas"})
    # co-uso (mesmo relatório)
    co = Counter()
    for x in ativos:
        ks = sorted({norm(t["t"]) for t in x["tabelas"] if not GENERICA.search(t["t"])})
        for i in range(len(ks)):
            for j in range(i + 1, len(ks)):
                co[(ks[i], ks[j])] += 1
    for (a, b), n in co.items():
        if n >= 2:
            tab_ar.append({"a": a, "b": b, "s": n, "n": n, "tipo": "co_uso"})

    # colunas compartilhadas (dimensões conformadas candidatas)
    col_tab = defaultdict(set)
    for t in tabelas:
        for c in t["cols"]:
            col_tab[c].add(t["k"])
    ignora_col = re.compile(r"^(id|index|indice|data|date|valor|nome|ano|mes|dia|count|total|created at|updated at|dt created at|dt updated at|data proc de|hash de|hash|data atualizacao|data processamento|dt proc|sigla|status)$")
    # ordena por quantos workspaces/temas a coluna atravessa (chave de junção real), depois por nº de tabelas
    ws_tab = {t["k"]: set(t["ws"]) for t in tabelas}
    tema_tab = {t["k"]: t["tema"] for t in tabelas}
    colunas_top = []
    for c, ts in col_tab.items():
        if len(ts) < 3 or ignora_col.match(c):
            continue
        n_ws = len(set().union(*(ws_tab[k] for k in ts)))
        n_temas = len({tema_tab[k] for k in ts})
        colunas_top.append({"c": c, "n": len(ts), "n_ws": n_ws, "n_temas": n_temas, "tabs": sorted(ts)[:40]})
    colunas_top.sort(key=lambda x: (-x["n_ws"], -x["n_temas"], -x["n"]))
    colunas_top = colunas_top[:80]

    # ------------------------------------------------------------- tabelas-chave por tema
    temas_out = []
    for tema in TEMAS + [OUTROS]:
        reps_t = [x for x in ativos if x["tema"] == tema]
        cand = []
        for t in tabelas:
            hits = t["temas_rep"].get(tema, 0)
            nome_tema = tema_da_tabela(t["nome"]) == tema
            if hits == 0 and not nome_tema:
                continue
            peso = hits * (1.5 if t["papel"] == "fato" else 1) + (5 if nome_tema else 0) + 0.3 * t["n_reps"]
            cand.append({"k": t["k"], "nome": t["nome"], "papel": t["papel"], "n_reps": t["n_reps"],
                         "hits": hits, "peso": round(peso, 2), "n_cols": t["n_cols"]})
        cand.sort(key=lambda c: -c["peso"])
        fatos = [c for c in cand if c["papel"] == "fato"][:8]
        dims = [c for c in cand if c["papel"] == "dimensão"][:8]
        medc = Counter()
        for x in reps_t:
            medc.update({norm(m["m"]) for m in x["medidas"]})
        temas_out.append({
            "tema": tema, "n": len(reps_t), "reps": [x["id"] for x in reps_t],
            "views": sum(x["views"] or 0 for x in reps_t),
            "recs": dict(Counter(x["rec"] for x in reps_t)),
            "ws": dict(Counter(x["ws"] for x in reps_t)),
            "fatos": fatos, "dims": dims,
            "medidas_top": [[m, n] for m, n in medc.most_common(15)],
        })

    # ------------------------------------------------------------- resumo
    def contagem(lst, key):
        return dict(Counter(key(x) for x in lst))

    resumo = {
        "gerado_em": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "extracao_em": ref_extracao.strftime("%d/%m/%Y"),
        "n_relatorios": len(reps), "n_ativos": len(ativos),
        "n_historico": sum(1 for x in reps if x["historico"]),
        "n_sistema": sum(1 for x in reps if x["sistema"]),
        "n_workspaces": len(workspaces),
        "n_tabelas": len(tabelas), "n_medidas": sum(x["n_medidas"] for x in ativos),
        "n_medidas_sem_desc": sum(x["medidas_sem_desc"] for x in ativos),
        "n_arestas": len(arestas), "n_clusters": len([c for c in clusters if c["n"] > 1]),
        "recs": contagem(ativos, lambda x: x["rec"]),
        "temas": contagem(ativos, lambda x: x["tema"]),
        "status_refresh": contagem(ativos, lambda x: x["status_refresh"] or "Sem dados"),
        "por_ws": contagem(ativos, lambda x: x["ws"]),
        "views_total": sum(x["views"] or 0 for x in ativos),
        "sem_telemetria": sum(1 for x in ativos if x["views"] is None),
        "telemetria_congelada": sum(1 for x in ativos if x["tel_congelada"]),
        "telemetria": [{k: texto(v) for k, v in t.items()} for t in ab["uso_telemetria_workspace"].to_dict("records")],
        "criados_por_ano": contagem([x for x in ativos if x["criado"]], lambda x: x["criado"][:4]),
    }

    saida = {
        "resumo": resumo, "temas_ordem": TEMAS + [OUTROS], "workspaces": workspaces,
        "relatorios": reps, "arestas": arestas, "clusters": clusters,
        "tabelas": tabelas, "tab_arestas": tab_ar, "colunas_top": colunas_top, "temas": temas_out,
    }
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    txt = json.dumps(saida, ensure_ascii=False, default=str, separators=(",", ":"))
    SAIDA.write_text("window.CATALOGO = " + txt + ";\n", encoding="utf-8")
    print(f"OK -> {SAIDA}  ({len(txt) / 1e6:.1f} MB)")
    print(f"Relatórios: {len(reps)} | ativos analisados: {len(ativos)} | arestas: {len(arestas)} | clusters: {resumo['n_clusters']}")
    print("Temas:", resumo["temas"])
    print("Recomendações:", resumo["recs"])


if __name__ == "__main__":
    main()
