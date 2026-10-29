"""Catálogo de metadados do Power BI: versão script de bi-catalog-v2.ipynb, para rodar agendado (CI/CD).

Login: com AZURE_TENANT_ID, AZURE_CLIENT_ID e AZURE_CLIENT_SECRET definidos usa a entidade de serviço;
sem eles, usa `az login` ou o navegador, igual ao notebook.

Uso:
  python 01-extracao/bi_catalog.py --all --atualizar-uso
  python 01-extracao/bi_catalog.py --workspace "BI Credito"
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
from collections import defaultdict
from pathlib import Path
import pandas as pd
import requests
from azure.identity import AzureCliCredential, EnvironmentCredential, InteractiveBrowserCredential

RAIZ = Path(__file__).resolve().parents[1]


BASE = "https://api.powerbi.com/v1.0/myorg"

SCOPE = "https://analysis.windows.net/powerbi/api/.default"

GUID = re.compile(r"[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}")

IGNORAR_MODELOS = ("Report Usage Metrics Model", "Dashboard Usage Metrics Model")

# relatórios de sistema gerados pelo Power BI sobre os modelos acima (ficam fora do catalogo_paineis)
IGNORAR_RELATORIOS = ("Report Usage Metrics Report", "Dashboard Usage Metrics Report")

# Cada consulta tem uma versão amigável (INFO.VIEW) e uma alternativa (INFO.*)
CONSULTAS_MODELO = {
    "tabelas": ["INFO.VIEW.TABLES()", "INFO.TABLES()"],
    "colunas": ["INFO.VIEW.COLUMNS()", "INFO.COLUMNS()"],
    "medidas": ["INFO.VIEW.MEASURES()", "INFO.MEASURES()"],
    "relacionamentos": ["INFO.VIEW.RELATIONSHIPS()", "INFO.RELATIONSHIPS()"],
}

T = defaultdict(list)  # tabelas planas do catálogo

ERROS = []             # chamadas que falharam (mostram onde falta permissão)

VISTOS = set()         # modelos já extraídos (evita repetir modelos compartilhados)

_tok = {"value": None, "exp": 0}

MASCARAR = False  # use --mask para trocar servidor/banco/caminho por hash

ATUALIZAR_USO = False  # use --atualizar-uso para disparar o refresh dos modelos 'Usage Metrics Report' antes de ler


def token():
    if _tok["value"] and time.time() < _tok["exp"] - 300:
        return _tok["value"]
    if os.environ.get("AZURE_CLIENT_SECRET"):
        # execução agendada (CI): entidade de serviço via AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET
        t = EnvironmentCredential().get_token(SCOPE)
    else:
        try:
            t = AzureCliCredential().get_token(SCOPE)
        except Exception:
            t = InteractiveBrowserCredential().get_token(SCOPE)
    _tok.update(value=t.token, exp=t.expires_on)
    return t.token


def api(method, path, ctx="", quiet=False, **kw):
    url = path if path.startswith("http") else BASE + path
    r, falha = None, None
    for tentativa in range(5):
        try:
            r = requests.request(method, url, headers={"Authorization": f"Bearer {token()}"},
                                 timeout=120, **kw)
        except requests.exceptions.RequestException as e:
            # queda de rede/DNS/timeout: espera e tenta de novo, em vez de abortar o workspace inteiro
            falha, r = e, None
            time.sleep(10 * (tentativa + 1))
            continue
        if r.status_code == 429:
            time.sleep(int(r.headers.get("Retry-After", 30)))
            continue
        if r.status_code >= 500 and tentativa < 4:
            time.sleep(5 * (tentativa + 1))
            continue
        break
    if r is None:
        ERROS.append({"contexto": ctx, "metodo": method, "endpoint": path,
                      "status": "rede", "detalhe": str(falha)[:300]})
        return None
    if r.status_code >= 400:
        if not quiet:
            ERROS.append({"contexto": ctx, "metodo": method, "endpoint": path,
                          "status": r.status_code, "detalhe": r.text[:300]})
        return None
    return r.json() if r.content else {}


def dax(ws, ds, consulta, ctx, quiet=False):
    body = {"queries": [{"query": f"EVALUATE {consulta}"}],
            "serializerSettings": {"includeNulls": True}}
    res = api("POST", f"/groups/{ws}/datasets/{ds}/executeQueries", ctx, quiet=quiet, json=body)
    if res is None:
        return None
    rows = res["results"][0]["tables"][0].get("rows", [])
    return [{k.split("[")[-1].rstrip("]"): v for k, v in row.items()} for row in rows]


def mascarar(v):
    if not MASCARAR or not isinstance(v, str) or not v:
        return v
    return "h_" + hashlib.sha1(v.encode()).hexdigest()[:8]


def atualizar_modelo_uso(dws, did, ctx, espera=600):
    """Dispara o refresh do modelo 'Usage Metrics Report' e espera terminar (só com --atualizar-uso).

    O refresh roda com a credencial do DONO do modelo (quem abriu o relatório de uso pela primeira vez),
    não com a sua. Se o dono saiu do workspace/empresa ou a credencial expirou, o refresh falha
    e só volta depois de um 'Take over' + 'Editar credenciais' nas configurações do modelo.
    É a ÚNICA ação de escrita do script, por isso é opcional. Devolve (status, mensagem de erro)."""
    url = f"/groups/{dws}/datasets/{did}/refreshes"
    antes = (api("GET", url, ctx, quiet=True, params={"$top": 1}) or {}).get("value", [])
    if api("POST", url, ctx, json={"notifyOption": "NoNotification"}) is None:
        print("      refresh do modelo de uso recusado (veja a aba 'erros')")
        return "recusado", (ERROS[-1]["detalhe"] if ERROS else None)
    print("      refresh do modelo de uso disparado, aguardando…")
    t0 = time.time()
    while time.time() - t0 < espera:
        time.sleep(15)
        h = (api("GET", url, ctx, quiet=True, params={"$top": 1}) or {}).get("value", [])
        novo = h and (not antes or h[0].get("requestId") != antes[0].get("requestId"))
        if novo and h[0].get("status") in ("Completed", "Failed", "Disabled", "Cancelled"):
            erro = h[0].get("serviceExceptionJson")
            print(f"      refresh do modelo de uso: {h[0]['status']}" + (f"  ->  {str(erro)[:160]}" if erro else ""))
            return h[0]["status"], erro
    print("      refresh do modelo de uso ainda em andamento; lendo os dados disponíveis")
    return "em andamento", None


def coletar_uso(ws_nome, dws, did, ctx):
    """Lê o modelo 'Usage Metrics Report' do workspace (um modelo por workspace, filtrado por ReportId).

    - uso_views_dia:      ABERTURAS do relatório por usuário e dia ('Report views': 1 por abertura)
    - uso_page_views_dia: visualizações de PÁGINA por usuário e dia ('Report page views': cada troca de página conta;
                          é o número grande que aparece no relatório de métricas de uso)
    - uso_views:          total por relatório e usuário na janela (mantido por compatibilidade)
    - uso_periodo:        primeira e última data com views na janela do modelo
    - uso_modelo:         até quando o modelo tem dados ('Refresh Stats'[Last Refresh]) e o resultado do refresh disparado"""
    disparado, erro = atualizar_modelo_uso(dws, did, ctx) if ATUALIZAR_USO else (None, None)
    dia = dax(dws, did, "SUMMARIZECOLUMNS('Report views'[ReportId], 'Report views'[ReportName], 'Report views'[UserId], "
                        "'Report views'[Date], \"views\", COUNTROWS('Report views'))", ctx)
    for r in dia or []:
        T["uso_views_dia"].append({"workspace": ws_nome, "workspace_id": dws, "relatorio_id": str(r.get("ReportId")).lower(),
                                   "relatorio_nome": r.get("ReportName"), "usuario": r.get("UserId"),
                                   "data": r.get("Date"), "views": r.get("views")})
    pg = dax(dws, did, "SUMMARIZECOLUMNS('Report page views'[ReportId], 'Report page views'[UserId], "
                       "'Report page views'[Date], \"page_views\", COUNTROWS('Report page views'))", ctx, quiet=True)
    for r in pg or []:
        T["uso_page_views_dia"].append({"workspace": ws_nome, "workspace_id": dws, "relatorio_id": str(r.get("ReportId")).lower(),
                                        "usuario": r.get("UserId"), "data": r.get("Date"), "page_views": r.get("page_views")})
    linhas = dax(dws, did, "SUMMARIZECOLUMNS('Report views'[ReportId], 'Report views'[UserId], "
                           "\"views\", COUNTROWS('Report views'), \"ultima_view\", MAX('Report views'[Date]))", ctx)
    for r in linhas or []:
        T["uso_views"].append({"workspace": ws_nome, "workspace_id": dws, "relatorio_id": str(r.get("ReportId")).lower(),
                               "usuario": r.get("UserId"), "views": r.get("views"), "ultima_view": r.get("ultima_view")})
    per = dax(dws, did, "ROW(\"ini\", MIN('Report views'[Date]), \"fim\", MAX('Report views'[Date]))", ctx, quiet=True)
    if linhas is not None:
        T["uso_periodo"].append({"workspace_id": dws, "ini": (per or [{}])[0].get("ini"), "fim": (per or [{}])[0].get("fim")})
    rs = dax(dws, did, "'Refresh Stats'", ctx, quiet=True)
    T["uso_modelo"].append({"workspace": ws_nome, "workspace_id": dws, "dataset_id": did,
                            "ultimo_refresh": (rs or [{}])[0].get("Last Refresh"), "refresh_disparado": disparado,
                            "erro_refresh": erro})


def coletar_modelo(ws_nome, dws, d):
    did = d["id"]
    nome = d.get("name", "")
    if nome in IGNORAR_MODELOS or (dws, did) in VISTOS:
        return
    VISTOS.add((dws, did))
    ctx = f"{ws_nome}/{nome}"
    base = {"workspace": ws_nome, "dataset_workspace_id": dws, "dataset_id": did, "dataset": nome}
    print(f"   modelo: {nome}")

    T["datasets"].append({**base, "configurado_por": d.get("configuredBy"),
                          "atualizavel": d.get("isRefreshable"), "criado_em": d.get("createdDate"),
                          "modo_armazenamento": d.get("targetStorageMode"),
                          "externo_ao_workspace": d.get("externo", False), "url": d.get("webUrl")})

    fontes = (api("GET", f"/groups/{dws}/datasets/{did}/datasources", ctx) or {}).get("value", [])
    for f in fontes:
        cd = f.get("connectionDetails") or {}
        T["fontes"].append({**base, "tipo_fonte": f.get("datasourceType"),
                            "servidor": mascarar(cd.get("server")), "banco": mascarar(cd.get("database")),
                            "url": mascarar(cd.get("url")), "caminho": mascarar(cd.get("path")),
                            "tipo_detalhado": cd.get("kind") or f.get("name"),
                            "detalhes_conexao": mascarar(json.dumps(cd, ensure_ascii=False)),
                            "gateway_id": f.get("gatewayId")})

    ag = api("GET", f"/groups/{dws}/datasets/{did}/refreshSchedule", ctx)
    if ag:
        T["agenda_refresh"].append({**base, "ativo": ag.get("enabled"), "dias": ag.get("days"),
                                    "horarios": ag.get("times"), "fuso": ag.get("localTimeZoneId")})

    hist = (api("GET", f"/groups/{dws}/datasets/{did}/refreshes", ctx, params={"$top": 10}) or {}).get("value", [])
    for h in hist:
        T["historico_refresh"].append({**base, "status": h.get("status"), "tipo": h.get("refreshType"),
                                       "inicio": h.get("startTime"), "fim": h.get("endTime"),
                                       "erro": h.get("serviceExceptionJson")})

    for u in (api("GET", f"/groups/{dws}/datasets/{did}/users", ctx) or {}).get("value", []):
        T["usuarios_dataset"].append({**base, "usuario": u.get("emailAddress") or u.get("displayName") or u.get("identifier"),
                                      "tipo": u.get("principalType"), "permissao": u.get("datasetUserAccessRight")})

    for chave, opcoes in CONSULTAS_MODELO.items():
        linhas = dax(dws, did, opcoes[0], ctx, quiet=True)
        if linhas is None:
            linhas = dax(dws, did, opcoes[1], ctx)
        if linhas is None:
            if chave == "tabelas":
                print("      sem acesso ao modelo (provável falta de permissão Build)")
                break
            continue
        T[chave].extend({**base, **linha} for linha in linhas)
    if any(t.get("Name") == "Report views" for t in T["tabelas"] if t["dataset_id"] == did):
        coletar_uso(ws_nome, dws, did, ctx)


def coletar_workspace(ws_id):
    r = api("GET", "/groups", ctx=ws_id, params={"$filter": f"id eq '{ws_id}'"})
    info = (r or {}).get("value", [])
    nome = info[0]["name"] if info else "(não encontrado ou sem acesso)"
    print(f"\n== {nome} ({ws_id})")
    T["workspaces"].append({"workspace_id": ws_id, "workspace": nome,
                            "tipo": info[0].get("type") if info else None,
                            "capacidade_dedicada": info[0].get("isOnDedicatedCapacity") if info else None})
    if not info:
        return

    for u in (api("GET", f"/groups/{ws_id}/users", nome) or {}).get("value", []):
        T["usuarios_workspace"].append({"workspace": nome, "workspace_id": ws_id,
                                        "usuario": u.get("emailAddress") or u.get("displayName") or u.get("identifier"),
                                        "tipo": u.get("principalType"), "papel": u.get("groupUserAccessRight")})

    rels = (api("GET", f"/groups/{ws_id}/reports", nome) or {}).get("value", [])
    for x in rels:
        T["relatorios"].append({"workspace": nome, "workspace_id": ws_id, "relatorio_id": x["id"],
                                "relatorio": x["name"], "tipo": x.get("reportType"),
                                "dataset_id": x.get("datasetId"),
                                "dataset_workspace_id": x.get("datasetWorkspaceId") or ws_id,
                                "criado_por": x.get("createdBy"), "modificado_por": x.get("modifiedBy"),
                                "criado_em": x.get("createdDateTime"), "modificado_em": x.get("modifiedDateTime"),
                                "url": x.get("webUrl")})
        # usuários com acesso ao relatório: só funciona com perfil de administrador (falha em silêncio)
        for u in (api("GET", f"/admin/reports/{x['id']}/users", quiet=True) or {}).get("value", []):
            T["usuarios_relatorio"].append({"workspace": nome, "relatorio": x["name"], "relatorio_id": x["id"],
                                            "usuario": u.get("emailAddress") or u.get("displayName") or u.get("identifier"),
                                            "tipo": u.get("principalType"), "permissao": u.get("reportUserAccessRight")})
        if x.get("reportType") == "PowerBIReport":
            pags = (api("GET", f"/groups/{ws_id}/reports/{x['id']}/pages", f"{nome}/{x['name']}") or {}).get("value", [])
            for p in pags:
                T["paginas"].append({"workspace": nome, "relatorio": x["name"],
                                     "pagina": p.get("displayName"), "ordem": p.get("order")})

    dashs = (api("GET", f"/groups/{ws_id}/dashboards", nome) or {}).get("value", [])
    for x in dashs:
        T["dashboards"].append({"workspace": nome, "workspace_id": ws_id, "dashboard_id": x["id"],
                                "dashboard": x.get("displayName"), "url": x.get("webUrl")})
        tiles = (api("GET", f"/groups/{ws_id}/dashboards/{x['id']}/tiles", f"{nome}/{x.get('displayName')}") or {}).get("value", [])
        for t in tiles:
            T["tiles"].append({"workspace": nome, "dashboard": x.get("displayName"), "tile": t.get("title"),
                               "relatorio_id": t.get("reportId"), "dataset_id": t.get("datasetId")})

    dss = (api("GET", f"/groups/{ws_id}/datasets", nome) or {}).get("value", [])
    alvo = {(ws_id, d["id"]): d for d in dss}
    for x in rels:  # modelos usados pelos relatórios mas hospedados em outro workspace
        dws, did = x.get("datasetWorkspaceId") or ws_id, x.get("datasetId")
        if did and (dws, did) not in alvo:
            d = api("GET", f"/groups/{dws}/datasets/{did}", f"{nome}/{x['name']}") or {"id": did, "name": "(modelo externo)"}
            d["externo"] = True
            alvo[(dws, did)] = d
    for (dws, _), d in alvo.items():
        try:  # um modelo com problema não pode interromper a coleta dos outros modelos do workspace
            coletar_modelo(nome, dws, d)
        except Exception as e:
            print(f"      ERRO ao coletar o modelo: {str(e)[:160]}")
            ERROS.append({"contexto": f"{nome}/{d.get('name')}", "metodo": "-", "endpoint": "coletar_modelo",
                          "status": "exceção", "detalhe": str(e)[:300]})


import difflib


def _auto(nome):
    n = str(nome)
    return n.startswith("LocalDateTable") or n.startswith("DateTableTemplate")


def _norm_dax(e):
    return re.sub(r"\s+", "", str(e or "")).lower()


def _card(v):
    s = str(v).strip().lower()
    return "many" if s in ("many", "2", "*") else "one" if s in ("one", "1") else None


def _dias(ts):
    t = pd.to_datetime(ts, errors="coerce", utc=True)
    return "" if pd.isna(t) else (pd.Timestamp.now(tz="UTC") - t).days


def _data(ts):
    t = pd.to_datetime(ts, errors="coerce")
    return "" if pd.isna(t) else t.strftime("%Y-%m-%d")


def _jac(a, b):
    return len(a & b) / len(a | b) if (a | b) else 0.0


def _limpo(nome):
    return re.sub(r"^((bi|tb|vw|dim|fato|fact)_)+", "", str(nome), flags=re.I).replace("_", " ")


def _fonte_txt(f):
    rotulo = f.get("tipo_detalhado") or f.get("tipo_fonte")
    caminho = f.get("caminho") or " / ".join(str(x) for x in (f.get("servidor"), f.get("banco"), f.get("url")) if x)
    return f"{rotulo}: {caminho}" if caminho else str(rotulo)


def classificar(did, tab, rel, med):
    """Separa as tabelas do modelo em fato / dimensão / outras, pelos relacionamentos (lado 'muitos' = fato)."""
    ids = {str(t.get("ID")): str(t.get("Name")) for t in tab.get(did, []) if t.get("ID") is not None}
    nm = lambda v: ids.get(str(v), str(v))
    muitos, um = defaultdict(int), defaultdict(int)
    for r in rel.get(did, []):
        for lado in ("From", "To"):
            t = r.get(f"{lado}Table", r.get(f"{lado}TableID"))
            c = _card(r.get(f"{lado}Cardinality"))
            if t is None:
                continue
            if c == "many":
                muitos[nm(t)] += 1
            elif c == "one":
                um[nm(t)] += 1
    nomes = sorted(str(t.get("Name")) for t in tab.get(did, []) if not _auto(t.get("Name")))
    hosp = {str(m.get("Table") or nm(m.get("TableID"))) for m in med.get(did, [])}
    fatos, dims, outras = [], [], []
    for n in nomes:
        if muitos[n] or um[n]:
            (fatos if muitos[n] and not um[n] else dims).append(n)
        elif n in hosp:
            outras.append(n)  # tabela que só guarda medidas
        elif re.search(r"^(f|fato|fact)[_ ]|fato|fact", n, re.I):
            fatos.append(n)
        elif re.search(r"^(d|dim)[_ ]|dim", n, re.I):
            dims.append(n)
        else:
            outras.append(n)
    return fatos, dims, outras, nm


def descrever(r, pags, fatos, medidas, tab_desc, tipos):
    """Descrição do painel montada com o que está escrito no próprio BI (páginas, indicadores, tabelas, descrições)."""
    uteis = [str(p) for p in pags if not re.fullmatch(r"(page|p[áa]gina)\s*\d+", str(p).strip(), re.I)]
    partes = [f"Painel '{r['relatorio']}' ({r['workspace']}) com {len(pags)} página(s)"
              + (f": {', '.join(uteis[:6])}" if uteis else "")]
    descr = [tab_desc[f] for f in fatos if tab_desc.get(f)]
    if descr:
        partes.append(str(descr[0]).strip().rstrip("."))
    vis = [m for m in medidas if not m.get("IsHidden")]
    sel = ([m for m in vis if m.get("Description")] + [m for m in vis if not m.get("Description")])[:5]
    if sel:
        partes.append("Principais indicadores: " + ", ".join(str(m.get("Name")) for m in sel))
    if fatos:
        partes.append("Base de dados: " + ", ".join(_limpo(f) for f in fatos[:4]))
    if tipos:
        partes.append("Origem: " + ", ".join(tipos))
    return ". ".join(partes) + "."


def consolidar():
    """Uma linha por relatório + abas derivadas (indicadores, campos, público, uso, sobreposição, grupos)."""
    for k in ("indicadores_por_painel", "tabelas_campos", "usuarios_painel", "uso_por_usuario",
              "sobreposicao_paineis", "grupos_unificacao"):
        T[k] = []
    if not T["relatorios"]:
        return pd.DataFrame()

    def por(chave, campo="dataset_id"):
        g = defaultdict(list)
        for r in T[chave]:
            g[r.get(campo)].append(r)
        return g

    tab, col, med = por("tabelas"), por("colunas"), por("medidas")
    rel, fon = por("relacionamentos"), por("fontes")
    hist = por("historico_refresh")
    ag = por("agenda_refresh")
    udat, uws, urel = por("usuarios_dataset"), por("usuarios_workspace", "workspace_id"), por("usuarios_relatorio", "relatorio_id")
    uso, periodo = por("uso_views", "relatorio_id"), {p["workspace_id"]: p for p in T["uso_periodo"]}
    ds = {d["dataset_id"]: d for d in T["datasets"]}
    paginas = defaultdict(list)
    for p in T["paginas"]:
        paginas[(p["workspace"], p["relatorio"])].append(p["pagina"])
    campos_cache = {}

    def campos(did, fatos, dims, outras, nm):
        """tabela -> lista de colunas (sem a coluna interna RowNumber)."""
        if did in campos_cache:
            return campos_cache[did]
        porT = defaultdict(list)
        for c in col.get(did, []):
            n = str(c.get("Name"))
            if n.startswith("RowNumber"):
                continue
            porT[str(c.get("Table") or nm(c.get("TableID")))].append(n)
        papel = {**{t: "fato" for t in fatos}, **{t: "dimensão" for t in dims}, **{t: "outra" for t in outras}}
        campos_cache[did] = [(t, papel[t], porT[t]) for t in sorted(papel) if porT.get(t)]
        return campos_cache[did]

    info = {}  # características de cada relatório, usadas na sobreposição
    linhas = []
    for r in T["relatorios"]:
        if r["relatorio"] in IGNORAR_RELATORIOS:
            continue
        did, wid, rid = r["dataset_id"], r["workspace_id"], r["relatorio_id"]
        d = ds.get(did, {})
        fatos, dims, outras, nm = classificar(did, tab, rel, med)
        tabelas = sorted(fatos + dims + outras)
        medidas = med.get(did, [])
        h = sorted(hist.get(did, []), key=lambda x: str(x.get("inicio")), reverse=True)
        ok = [x for x in h if x.get("status") == "Completed"]
        a = (ag.get(did) or [{}])[0]
        pags = paginas.get((r["workspace"], r["relatorio"]), [])
        tab_desc = {str(t.get("Name")): t.get("Description") for t in tab.get(did, [])}
        fontes = fon.get(did, [])
        tipos = sorted({str(f.get("tipo_detalhado") or f.get("tipo_fonte")) for f in fontes})

        # público: quem enxerga o painel (membros do workspace + permissões no modelo + permissões no relatório)
        pub = {}
        for origem, lista, campo in (("workspace", uws.get(wid, []), "papel"), ("modelo", udat.get(did, []), "permissao"),
                                     ("relatorio", urel.get(rid, []), "permissao")):
            for u in lista:
                pub.setdefault(str(u["usuario"]), []).append(f"{origem}:{u.get(campo)}")
        for u, orig in pub.items():
            T["usuarios_painel"].append({"workspace": r["workspace"], "relatorio": r["relatorio"],
                                         "usuario": u, "acessos": "; ".join(orig)})

        # uso (modelo 'Usage Metrics Report' do workspace): views totais, viewers e views por usuário
        u_rows = sorted(uso.get(str(rid).lower(), []), key=lambda x: -int(x.get("views") or 0))
        tem_uso = wid in periodo
        for u in u_rows:
            T["uso_por_usuario"].append({"workspace": r["workspace"], "relatorio": r["relatorio"], "usuario": u["usuario"],
                                         "views": u["views"], "ultima_view": _data(u["ultima_view"])})
        views_user = [f"{u['usuario']};{u['views']} views" for u in u_rows]
        per = periodo.get(wid, {})

        for m in medidas:
            T["indicadores_por_painel"].append({
                "workspace": r["workspace"], "relatorio": r["relatorio"], "dataset": d.get("dataset"),
                "medida": m.get("Name"), "tabela": m.get("Table") or m.get("TableID"),
                "expressao_dax": m.get("Expression"), "descricao": m.get("Description")})
        for t, papel, cs in campos(did, fatos, dims, outras, nm):
            T["tabelas_campos"].append({"workspace": r["workspace"], "relatorio": r["relatorio"], "tabela": t,
                                        "papel": papel, "n_campos": len(cs), "campos": ", ".join(cs)})

        info[rid] = {"did": did, "ws": wid, "nome": r["relatorio"], "tab": {t.lower() for t in tabelas},
                     "med": {str(m.get("Name")).lower() for m in medidas},
                     "dax": {_norm_dax(m.get("Expression")) for m in medidas if m.get("Expression")},
                     "pags": len(pags)}
        linhas.append({
            "workspace": r["workspace"], "relatorio": r["relatorio"], "relatorio_id": rid, "workspace_id": wid,
            "criado_em": r.get("criado_em") or d.get("criado_em"), "url": r["url"],
            "finalidade_sugerida": descrever(r, pags, fatos, medidas, tab_desc, tipos),
            "owner_tecnico_dataset": d.get("configurado_por"),
            "admins_workspace": "; ".join(str(u["usuario"]) for u in uws.get(wid, []) if u.get("papel") == "Admin"),
            "n_paginas": len(pags), "paginas": "; ".join(map(str, pags)),
            "n_medidas": len(medidas), "medidas": "; ".join(str(m.get("Name")) for m in medidas),
            "fontes": " | ".join(sorted({_fonte_txt(f) for f in fontes})),
            "n_tabelas": len(tabelas), "tabelas_fato": "; ".join(fatos), "tabelas_dimensao": "; ".join(dims),
            "tabelas_outras": "; ".join(outras),
            "campos_por_tabela": " | ".join(f"{t} ({p}): {', '.join(cs)}" for t, p, cs in campos(did, fatos, dims, outras, nm)),
            "publico": "; ".join(list(pub)[:15]) + (" ..." if len(pub) > 15 else ""),
            "views_total": sum(int(u.get("views") or 0) for u in u_rows) if tem_uso else "",
            "viewers_total": len({u["usuario"] for u in u_rows if u.get("usuario")}) if tem_uso else "",
            "views_por_usuario": ("[" + "; ".join(views_user[:40]) + (" ..." if len(views_user) > 40 else "") + "]") if tem_uso else "",
            "ultima_visualizacao": max((_data(u["ultima_view"]) for u in u_rows), default="") if tem_uso else "",
            "periodo_uso_coberto": f"{_data(per.get('ini'))} a {_data(per.get('fim'))}" if tem_uso else "",
            "ultimo_refresh_sucesso": ok[0].get("fim") if ok else None,
            "dias_desde_refresh_sucesso": _dias(ok[0].get("fim")) if ok else "",
            "ultimo_refresh_status": h[0].get("status") if h else None,
            "refresh_dias": a.get("dias"), "refresh_horarios": a.get("horarios"),
            "medidas_sem_descricao": sum(1 for m in medidas if not m.get("Description")),
            "refresh_falhas_ultimos_10": sum(1 for x in h if x.get("status") == "Failed"),
        })

    # --- sobreposição entre relatórios (candidatos a unificar)
    nome_ws = {w["workspace_id"]: w["workspace"] for w in T["workspaces"]}
    pai = {k: k for k in info}

    def raiz(x):
        while pai[x] != x:
            pai[x] = pai[pai[x]]
            x = pai[x]
        return x

    ids = list(info)
    for i, x in enumerate(ids):
        for y in ids[i + 1:]:
            A, B = info[x], info[y]
            mesmo = bool(A["did"]) and A["did"] == B["did"]
            jt, jm, jd = _jac(A["tab"], B["tab"]), _jac(A["med"], B["med"]), _jac(A["dax"], B["dax"])
            sn = difflib.SequenceMatcher(None, A["nome"].lower(), B["nome"].lower()).ratio()
            if mesmo:
                cat, sug = "mesmo_modelo", "Mesmo modelo: candidatos a virar páginas de um único relatório"
            elif jt >= 0.5 and jm >= 0.5:
                cat, sug = "modelos_similares", "Modelos com tabelas e medidas parecidas: avaliar unificar modelo e relatório"
            elif jt >= 0.5 and len(A["tab"] & B["tab"]) >= 2:
                cat, sug = "tabelas_em_comum", "Mesmas tabelas: avaliar modelo compartilhado"
            elif sn >= 0.75:
                cat, sug = "nome_parecido", "Nomes parecidos: verificar se têm a mesma finalidade"
            else:
                continue
            if cat in ("mesmo_modelo", "modelos_similares"):
                pai[raiz(x)] = raiz(y)
            T["sobreposicao_paineis"].append({
                "relatorio_a": A["nome"], "workspace_a": nome_ws.get(A["ws"], A["ws"]),
                "relatorio_b": B["nome"], "workspace_b": nome_ws.get(B["ws"], B["ws"]),
                "categoria": cat, "similaridade_tabelas": round(jt, 2), "similaridade_medidas": round(jm, 2),
                "medidas_dax_identicas": round(jd, 2), "similaridade_nome": round(sn, 2), "sugestao": sug})

    membros = defaultdict(list)
    for x in ids:
        membros[raiz(x)].append(x)
    n = 0
    for lista in membros.values():
        if len(lista) < 2:
            continue
        n += 1
        mesmo = len({info[x]["did"] for x in lista}) == 1
        T["grupos_unificacao"].append({
            "grupo": f"G{n:02d}", "n_relatorios": len(lista), "relatorios": "; ".join(info[x]["nome"] for x in lista),
            "workspaces": "; ".join(sorted({nome_ws.get(info[x]["ws"], info[x]["ws"]) for x in lista})),
            "n_paginas_total": sum(info[x]["pags"] for x in lista),
            "sugestao": ("Mesmo modelo usado por vários relatórios: unificar como páginas de um único relatório"
                         if mesmo else "Modelos parecidos: consolidar modelo e relatórios")})
    return pd.DataFrame(linhas).fillna("")


def limpar(df):
    def f(v):
        if isinstance(v, (list, dict)):
            v = json.dumps(v, ensure_ascii=False, default=str)
        if isinstance(v, str):
            v = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", v)[:32000]
        return v
    return df.map(f) if hasattr(df, "map") else df.applymap(f)


def exportar(out):
    ordem = ["catalogo_paineis", "grupos_unificacao", "sobreposicao_paineis", "indicadores_por_painel",
             "tabelas_campos", "uso_por_usuario", "usuarios_painel", "workspaces", "usuarios_workspace", "usuarios_dataset", "usuarios_relatorio", "relatorios", "paginas", "dashboards", "tiles", "datasets", "fontes",
             "agenda_refresh", "historico_refresh", "tabelas", "colunas", "medidas",
             "relacionamentos"]
    T["erros"] = ERROS
    T["catalogo_paineis"] = consolidar().to_dict("records")
    with pd.ExcelWriter(out / "catalogo_metadados.xlsx", engine="openpyxl") as xw:
        for k in ordem + ["erros"]:
            df = pd.DataFrame(T[k]) if T[k] else pd.DataFrame({"info": ["sem dados"]})
            limpar(df).to_excel(xw, sheet_name=k[:31], index=False)
    with open(out / "metadados.json", "w", encoding="utf-8") as fh:
        json.dump(T, fh, ensure_ascii=False, indent=1, default=str)
    print(f"\nPronto: {out/'catalogo_metadados.xlsx'}  |  chamadas com erro: {len(ERROS)} (veja a aba 'erros')")

    # uso: junta esta extração ao histórico acumulado (saida/historico_uso.csv) e recalcula
    # views, última visualização e período de uso sobre o histórico inteiro
    proc = RAIZ / "02-processamento"
    if (proc / "atualizar_uso.py").exists():
        sys.path.insert(0, str(proc))
        import importlib
        import atualizar_uso
        importlib.reload(atualizar_uso)
        print()
        atualizar_uso.aplicar(out)
    else:
        print("Aviso: 02-processamento/atualizar_uso.py não encontrado; colunas de uso ficam só com a janela desta extração.")


def main(argv=None):
    global MASCARAR, ATUALIZAR_USO
    ap = argparse.ArgumentParser(description="Catálogo de metadados do Power BI (plano C)")
    ap.add_argument("--list", action="store_true", help="lista os workspaces que você enxerga")
    ap.add_argument("--input", default="workspaces.txt", help="arquivo com URLs ou IDs de workspaces")
    ap.add_argument("--workspace", help="extrai só UM workspace (nome ou ID); bom para testar")
    ap.add_argument("--all", action="store_true", help="extrai TODOS os workspaces que você enxerga")
    ap.add_argument("--out", default=str(RAIZ / "saida"))
    ap.add_argument("--mask", action="store_true", help="mascarar servidor/banco/caminho das fontes com hash")
    ap.add_argument("--atualizar-uso", action="store_true",
                    help="dispara o refresh dos modelos 'Usage Metrics Report' antes de ler o uso (traz as views até hoje)")
    a = ap.parse_args(argv)
    MASCARAR = a.mask
    ATUALIZAR_USO = a.atualizar_uso
    T.clear(); ERROS.clear(); VISTOS.clear()  # permite rodar de novo no mesmo kernel
    out = Path(a.out)
    out.mkdir(exist_ok=True)

    try:
        token()
    except Exception as e:
        sys.exit(f"Falha no login: {e}\nTente `az login` ou verifique se a política de acesso "
                 "condicional da empresa permite este tipo de login.")

    if a.list:
        v = (api("GET", "/groups", ctx="listar") or {}).get("value", [])
        df = pd.DataFrame([{"workspace_id": g["id"], "nome": g.get("name"), "tipo": g.get("type"),
                            "capacidade_dedicada": g.get("isOnDedicatedCapacity")} for g in v])
        df.to_csv(out / "workspaces_acessiveis.csv", index=False, encoding="utf-8-sig")
        print(df.to_string(index=False))
        print(f"\n{len(df)} workspaces. Lista salva em {out/'workspaces_acessiveis.csv'}")
        return

    if a.workspace:
        v = (api("GET", "/groups", ctx="listar") or {}).get("value", [])
        q = a.workspace.strip().lower()
        exato = [g for g in v if q in (g["id"].lower(), (g.get("name") or "").lower())]
        achou = exato or [g for g in v if q in (g.get("name") or "").lower()]
        if len(achou) != 1:
            sys.exit(f"'{a.workspace}' encontrou {len(achou)} workspaces; seja mais específico. "
                     f"Encontrados: {[g.get('name') for g in achou]}")
        ids = [achou[0]["id"].lower()]
        print(f"Workspace escolhido: {achou[0].get('name')}")
    elif a.all:
        v = (api("GET", "/groups", ctx="listar") or {}).get("value", [])
        ids = [g["id"].lower() for g in v]
    else:
        p = Path(a.input)
        if not p.exists():
            sys.exit(f"Arquivo {p} não encontrado. Crie com um workspace por linha (URL ou ID), "
                     "ou rode com --list / --all.")
        ids = list(dict.fromkeys(g.lower() for g in GUID.findall(p.read_text(encoding="utf-8"))))
    print(f"{len(ids)} workspaces para extrair")
    for ws in ids:
        try:
            coletar_workspace(ws)
        except Exception as e:
            ERROS.append({"contexto": ws, "metodo": "-", "endpoint": "coletar_workspace",
                          "status": "exceção", "detalhe": str(e)[:300]})
    exportar(out)


if __name__ == "__main__":
    main()
