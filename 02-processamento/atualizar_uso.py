"""
Recalcula as colunas de USO do catálogo (saida/catalogo_metadados.xlsx) e mantém um
histórico acumulado de visualizações (saida/historico_uso.csv).

Por que existe:
  O uso vem do modelo 'Usage Metrics Report' de cada workspace (tabela 'Report views').
  Esse modelo guarda só ~30 dias e, quando o relatório de uso fica meses sem ser aberto,
  o Power BI DESATIVA o refresh dele. A extração passa a ler uma janela congelada
  (ex.: 08/03 a 02/04) e quem usou depois disso não aparece.

O que faz:
  1. Junta o uso lido nesta extração (saida/metadados.json) ao histórico acumulado.
     Extrações novas trazem uso por DIA (uso_views_dia); extrações antigas só têm o total
     da janela (uso_views + uso_periodo) e entram como um bloco.
  2. Por relatório recalcula, sobre o histórico inteiro:
       views_total, viewers_total, views_por_usuario,
       ultima_visualizacao (data mais recente entre todos os usuários),
       periodo_uso_coberto = data de criação do relatório até a última visualização,
       telemetria_desde / uso_dados_ate (janela que o Usage Metrics realmente cobre),
       situacao_telemetria (atual / congelada desde AAAA-MM-DD / sem telemetria).
  3. Regrava as abas catalogo_paineis, uso_por_usuario e uso_telemetria_workspace
     (as demais abas ficam intactas) e preserva a data do arquivo, que o
     gerar_catalogo.py usa como data da extração.

Uso (a partir da raiz do projeto):
    .venv\\Scripts\\python.exe 02-processamento\\atualizar_uso.py
O notebook de extração chama aplicar() automaticamente ao final.
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
SAIDA = RAIZ / "saida"
MODELO_USO = "Usage Metrics Report"
TOLERANCIA_DIAS = 3  # uso_dados_ate até 3 dias antes da extração = telemetria "atual"
CHAVE = ["workspace_id", "relatorio_id", "usuario"]


def _d(v):
    t = pd.to_datetime(v, errors="coerce", utc=True)
    return None if pd.isna(t) else t.strftime("%Y-%m-%d")


def _status_modelos(T):
    """Por workspace: até quando o modelo de uso tem dados e se o refresh dele está parado."""
    ws_nome = {w["workspace_id"]: w["workspace"] for w in T.get("workspaces", [])}
    stats = {s["workspace_id"]: s for s in T.get("uso_modelo", [])}  # extrações novas: 'Refresh Stats'
    out = {}
    for d in T.get("datasets", []):
        if d.get("dataset") != MODELO_USO:
            continue
        wid = d["dataset_workspace_id"]
        h = sorted((x for x in T.get("historico_refresh", []) if x.get("dataset_id") == d["dataset_id"]),
                   key=lambda x: str(x.get("inicio")), reverse=True)
        ok = [x for x in h if x.get("status") == "Completed"]
        ag = [a for a in T.get("agenda_refresh", []) if a.get("dataset_id") == d["dataset_id"]]
        ate = _d((stats.get(wid) or {}).get("ultimo_refresh")) or _d(ok[0].get("fim") if ok else None)
        st = stats.get(wid) or {}
        out[wid] = {"workspace_id": wid, "workspace": ws_nome.get(wid, d.get("workspace")),
                    "uso_dados_ate": ate, "ultimo_status_refresh": h[0].get("status") if h else None,
                    "agenda_ativa": ag[0].get("ativo") if ag else None,
                    "dono_modelo_uso": d.get("configurado_por"),
                    "refresh_disparado": st.get("refresh_disparado"),
                    "erro_refresh": st.get("erro_refresh") or next((x.get("erro") for x in h if x.get("erro")), None)}
    return out


def _acao(m, situacao):
    """O que fazer para o workspace voltar a ter uso até hoje (uma vez por workspace, não por relatório)."""
    if m is None:
        return ("Criar o modelo: em qualquer relatório do workspace, '...' > 'Ver relatório de métricas de uso' "
                "(precisa ser Admin/Membro/Colaborador). Um clique por workspace cobre todos os relatórios dele.")
    if situacao == "atual":
        return "Nada a fazer: o modelo de uso está atualizando."
    if m.get("refresh_disparado") in ("Failed", "recusado") or m.get("ultimo_status_refresh") == "Failed":
        return (f"Refresh falha com a credencial do dono ({m.get('dono_modelo_uso') or '?'}). Configurações do workspace > "
                "Modelos semânticos > Usage Metrics Report > 'Assumir' (Take over) > 'Editar credenciais' > Entrar. "
                "Se continuar falhando: excluir o modelo e abrir 'Ver relatório de métricas de uso' de novo.")
    return "Refresh desativado por inatividade: rodar a extração com --atualizar-uso ou abrir o relatório de uso no Power BI."


def _uso_desta_extracao(T):
    """Linhas de uso no formato do histórico (dia a dia quando houver; senão, bloco da janela)."""
    ws_nome = {w["workspace_id"]: w["workspace"] for w in T.get("workspaces", [])}
    linhas = []
    dia = T.get("uso_views_dia") or []
    ws_com_dia = {r["workspace_id"] for r in dia}
    for r in dia:
        dt = _d(r.get("data"))
        linhas.append({"workspace_id": r["workspace_id"], "workspace": ws_nome.get(r["workspace_id"], r.get("workspace")),
                       "relatorio_id": str(r["relatorio_id"]).lower(), "usuario": r.get("usuario"),
                       "data_ini": dt, "data_fim": dt, "views": int(r.get("views") or 0), "granularidade": "dia"})
    per = {p["workspace_id"]: p for p in T.get("uso_periodo", [])}
    for r in T.get("uso_views") or []:
        if r["workspace_id"] in ws_com_dia:
            continue
        p = per.get(r["workspace_id"], {})
        linhas.append({"workspace_id": r["workspace_id"], "workspace": r.get("workspace"),
                       "relatorio_id": str(r["relatorio_id"]).lower(), "usuario": r.get("usuario"),
                       "data_ini": _d(p.get("ini")), "data_fim": _d(r.get("ultima_view")),
                       "janela_fim": _d(p.get("fim")), "views": int(r.get("views") or 0), "granularidade": "janela"})
    return pd.DataFrame(linhas)


def _mesclar(hist, novo):
    """Une histórico + extração atual sem contar o mesmo dia duas vezes.
    - linhas por dia: a mais recente vale (chave + data);
    - blocos de janela: a mesma janela não se repete; dias já cobertos por um bloco são ignorados."""
    df = pd.concat([hist, novo], ignore_index=True) if len(hist) else novo.copy()
    if df.empty:
        return df
    for c in ("janela_fim",):
        if c not in df:
            df[c] = None
    jan = df[df.granularidade == "janela"].drop_duplicates(CHAVE + ["data_ini", "janela_fim"], keep="last")
    dia = df[df.granularidade == "dia"].drop_duplicates(CHAVE + ["data_ini"], keep="last")
    if len(jan) and len(dia):
        blocos = jan.drop_duplicates(["workspace_id", "data_ini", "janela_fim"])[["workspace_id", "data_ini", "janela_fim"]]
        coberto = pd.Series(False, index=dia.index)
        for b in blocos.itertuples():
            coberto |= (dia.workspace_id == b.workspace_id) & (dia.data_ini >= b.data_ini) & (dia.data_ini <= b.janela_fim)
        dia = dia[~coberto]
    return pd.concat([jan, dia], ignore_index=True).sort_values(["workspace", "relatorio_id", "usuario", "data_ini"])


def aplicar(saida=SAIDA, verbose=True):
    saida = Path(saida)
    xlsx, js, hcsv = saida / "catalogo_metadados.xlsx", saida / "metadados.json", saida / "historico_uso.csv"
    T = json.loads(js.read_text(encoding="utf-8"))
    ref = datetime.fromtimestamp(js.stat().st_mtime).date()  # data da extração
    mtime = xlsx.stat().st_mtime

    # 1. histórico acumulado
    hist = pd.read_csv(hcsv, dtype=str) if hcsv.exists() else pd.DataFrame()
    if len(hist):
        hist["views"] = hist["views"].astype(int)
    H = _mesclar(hist, _uso_desta_extracao(T))
    H.to_csv(hcsv, index=False, encoding="utf-8-sig")

    # visualizações de PÁGINA ('Report page views'): cada troca de página conta. É o número grande
    # que o relatório de métricas de uso mostra; as views acima são ABERTURAS do relatório.
    pcsv = saida / "historico_page_views.csv"
    pv = pd.DataFrame([{"workspace_id": r["workspace_id"], "relatorio_id": str(r["relatorio_id"]).lower(),
                        "usuario": r.get("usuario"), "data": _d(r.get("data")), "page_views": int(r.get("page_views") or 0)}
                       for r in T.get("uso_page_views_dia") or []])
    if pcsv.exists():
        old = pd.read_csv(pcsv, dtype=str); old["page_views"] = old.page_views.astype(int)
        pv = pd.concat([old, pv], ignore_index=True) if len(pv) else old
    if len(pv):
        pv = pv.drop_duplicates(["workspace_id", "relatorio_id", "usuario", "data"], keep="last")
        pv.to_csv(pcsv, index=False, encoding="utf-8-sig")
    pv_rel = pv.groupby("relatorio_id").page_views.sum().to_dict() if len(pv) else {}
    pv_usr = pv.groupby(["relatorio_id", "usuario"]).page_views.sum().to_dict() if len(pv) else {}

    # 2. cobertura por workspace
    modelos = _status_modelos(T)
    cob = {}
    for wid, g in H.groupby("workspace_id"):
        fim = pd.concat([g.data_fim, g.get("janela_fim", pd.Series(dtype=str))]).dropna().max()
        cob[wid] = {"desde": g.data_ini.dropna().min() if g.data_ini.notna().any() else None, "ate_views": fim if pd.notna(fim) else None}
    for wid, m in modelos.items():
        c = cob.setdefault(wid, {"desde": None, "ate_views": None})
        c["ate"] = m["uso_dados_ate"] or c.get("ate_views")
        c["status"] = m
    for wid, c in cob.items():
        c.setdefault("ate", c.get("ate_views"))

    def situacao(wid):
        c = cob.get(wid)
        if not c or not c.get("ate"):
            return "sem telemetria"
        atraso = (ref - datetime.strptime(c["ate"], "%Y-%m-%d").date()).days
        return "atual" if atraso <= TOLERANCIA_DIAS else f"congelada desde {c['ate']} ({atraso} dias sem dados)"

    # 3. catálogo
    cp = pd.read_excel(xlsx, sheet_name="catalogo_paineis")
    uso_rows = []
    cp = cp.drop(columns=["primeira_visualizacao", "primeira_visualizacao_exata"], errors="ignore")
    novas = {k: [] for k in ("views_total", "page_views_total", "viewers_total", "views_por_usuario", "ultima_visualizacao",
                             "periodo_uso_coberto", "telemetria_desde", "uso_dados_ate", "situacao_telemetria")}
    por_rel = {k: g for k, g in H.groupby("relatorio_id")} if len(H) else {}
    for r in cp.itertuples():
        wid, rid = r.workspace_id, str(r.relatorio_id).lower()
        tem = wid in cob
        g = por_rel.get(rid)
        criado = _d(r.criado_em)
        if g is not None and len(g):
            pu = g.groupby("usuario").agg(views=("views", "sum"), primeira=("data_ini", "min"), ultima=("data_fim", "max"),
                                          exata=("granularidade", lambda s: (s == "dia").all())).sort_values("views", ascending=False)
            ult, prim = g.data_fim.max(), g.data_ini.min()
            exata = bool((g.granularidade == "dia").all())
            novas["views_total"].append(int(pu.views.sum()))
            novas["page_views_total"].append(int(pv_rel.get(rid, 0)))
            novas["viewers_total"].append(int(len(pu)))
            vu = [f"{u};{int(x.views)} views" for u, x in pu.iterrows()]
            novas["views_por_usuario"].append("[" + "; ".join(vu[:40]) + (" ..." if len(vu) > 40 else "") + "]")
            for u, x in pu.iterrows():
                uso_rows.append({"workspace": r.workspace, "relatorio": r.relatorio, "relatorio_id": rid, "usuario": u,
                                 "views": int(x.views), "page_views": int(pv_usr.get((rid, u), 0)), "ultima_view": x.ultima})
        else:
            ult = prim = None
            exata = None
            novas["views_total"].append(0 if tem else "")
            novas["page_views_total"].append(int(pv_rel.get(rid, 0)) if tem else "")
            novas["viewers_total"].append(0 if tem else "")
            novas["views_por_usuario"].append("[]" if tem else "")
        novas["ultima_visualizacao"].append(ult or "")
        novas["periodo_uso_coberto"].append(f"{criado or '?'} a {ult}" if ult else ("" if not tem else f"{criado or '?'} a (sem views registradas)"))
        novas["telemetria_desde"].append((cob.get(wid) or {}).get("desde") or "")
        novas["uso_dados_ate"].append((cob.get(wid) or {}).get("ate") or "")
        novas["situacao_telemetria"].append(situacao(wid))
    for k, v in novas.items():
        cp[k] = v

    uso_df = pd.DataFrame(uso_rows) if uso_rows else pd.DataFrame({"info": ["sem dados"]})
    # uma linha por workspace com relatórios: os que têm modelo de uso e os que ainda não têm
    ws_nome = {w["workspace_id"]: w["workspace"] for w in T.get("workspaces", [])}
    n_rel = pd.Series([r["workspace_id"] for r in T.get("relatorios", [])]).value_counts().to_dict()
    tel_rows = []
    for wid in sorted(set(cob) | set(n_rel), key=lambda w: ws_nome.get(w, w)):
        c, m = cob.get(wid, {}), modelos.get(wid)
        sit = situacao(wid) if m or c else "sem modelo de uso"
        tel_rows.append({"workspace": ws_nome.get(wid, wid), "workspace_id": wid, "n_relatorios": n_rel.get(wid, 0),
                         "telemetria_desde": c.get("desde"), "ultima_view_registrada": c.get("ate_views"),
                         "uso_dados_ate": c.get("ate"), "situacao_telemetria": sit,
                         "dono_modelo_uso": (m or {}).get("dono_modelo_uso"),
                         "ultimo_status_refresh_modelo_uso": (m or {}).get("ultimo_status_refresh"),
                         "agenda_modelo_uso_ativa": (m or {}).get("agenda_ativa"),
                         "refresh_disparado_na_extracao": (m or {}).get("refresh_disparado"),
                         "erro_refresh_modelo_uso": str((m or {}).get("erro_refresh") or "")[:500] or None,
                         "acao_recomendada": _acao(m, sit)})
    tel = pd.DataFrame(tel_rows)

    with pd.ExcelWriter(xlsx, engine="openpyxl", mode="a", if_sheet_exists="replace") as xw:
        cp.to_excel(xw, sheet_name="catalogo_paineis", index=False)
        uso_df.to_excel(xw, sheet_name="uso_por_usuario", index=False)
        tel.to_excel(xw, sheet_name="uso_telemetria_workspace", index=False)
    os.utime(xlsx, (mtime, mtime))  # mantém a data da extração

    if verbose:
        sem_match = set(H.relatorio_id) - set(cp.relatorio_id.astype(str).str.lower()) if len(H) else set()
        print(f"Histórico de uso: {len(H)} linhas em {hcsv.name} "
              f"({(H.granularidade == 'dia').sum() if len(H) else 0} por dia, {(H.granularidade == 'janela').sum() if len(H) else 0} em blocos de janela)")
        print(f"Relatórios com views: {sum(1 for v in novas['ultima_visualizacao'] if v)} de {len(cp)}")
        if sem_match:
            print(f"Aviso: {len(sem_match)} ReportId(s) do Usage Metrics sem relatório correspondente (excluídos ou cópias de app).")
        print("\nTelemetria por workspace (extração de " + ref.strftime("%Y-%m-%d") + "):")
        for t in tel.itertuples():
            fmt = lambda v: "—" if pd.isna(v) or not v else v
            print(f"  {str(t.workspace)[:30]:30} {fmt(t.telemetria_desde)} a {fmt(t.uso_dados_ate)}  ·  {t.situacao_telemetria}")
    return tel


if __name__ == "__main__":
    aplicar()
