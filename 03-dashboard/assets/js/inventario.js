/* =========================================================================
   Inventário de BIs · Farm Analytics
   Entregável: inventário e catalogação estruturada dos dashboards.
   Dados: data/catalogo_data.js (gerado por 02-processamento/gerar_catalogo.py)
   ========================================================================= */
(() => {
  "use strict";
  const D = window.CATALOGO;
  if (!D) {
    document.body.innerHTML = "<p style='padding:40px;font-family:sans-serif'>Arquivo <b>data/catalogo_data.js</b> não encontrado. Rode <code>02-processamento/gerar_catalogo.py</code>.</p>";
    return;
  }
  const SH = window.FTShell;

  // ------------------------------------------------------------------ utilitários
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const nf = new Intl.NumberFormat("pt-BR");
  const fmt = v => (v === null || v === undefined || Number.isNaN(v)) ? "—" : nf.format(Math.round(v));
  const pct = v => (v === null || v === undefined) ? "—" : `${Math.round(v * 100)}%`;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const normTxt = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const trunc = (s, n) => (s = String(s ?? "")).length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s;

  // ------------------------------------------------------------------ classificações
  const SIT = [
    { k: "Produtivo", v: "--s-produtivo", d: "Workspace produtivo, disponível para o negócio" },
    { k: "Não produtivo", v: "--s-naoprod", d: "Teste, homologação, UAT ou versão antiga" },
    { k: "Histórico", v: "--s-historico", d: "Já movido para o workspace BI Histórico" },
    { k: "Sistema", v: "--s-sistema", d: "Usage Metrics gerado pelo próprio Power BI" },
  ];
  const sitOf = r => r.sistema ? "Sistema" : r.historico ? "Histórico" : r.nao_produtivo ? "Não produtivo" : "Produtivo";
  const sitColor = s => cssv((SIT.find(x => x.k === s) || SIT[3]).v);
  const TEMA_VAR = {
    "Solicitações": "--t-solicitacoes", "Portfólio": "--t-portfolio", "Risco": "--t-risco", "Cotas": "--t-cotas",
    "Limites": "--t-limites", "PDD": "--t-pdd", "Compliance": "--t-compliance", "Cliente": "--t-cliente", "Outros": "--t-outros",
  };
  const temaColor = t => cssv(TEMA_VAR[t] || "--t-outros");
  const MODO = m => ({ Abf: "Import", PremiumFiles: "Import · formato grande", DirectQuery: "DirectQuery", Push: "Push", Streaming: "Streaming" }[m] || m || "Não informado");
  const STATUS = s => ({ Completed: "Sucesso", Failed: "Falhou", Disabled: "Desativado", Unknown: "Em andamento" }[s] || "Sem histórico");
  const PAG_GENERICA = /^(page|p[aá]gina)\s*\d+$/i;

  // ------------------------------------------------------------------ ID de catálogo (sigla do workspace + sequência)
  const STOP = new Set(["bi", "de", "do", "da", "dos", "das", "e"]);
  const WS_CODE = new Map(), usados = new Set();
  D.workspaces.forEach(ws => {
    const w = normTxt(ws).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(x => x && !STOP.has(x));
    const cands = !w.length ? ["GER"] : w.length === 1 ? [w[0].slice(0, 3), w[0].slice(0, 4)]
      : [w[0].slice(0, 2) + w.slice(1).map(x => x[0]).join("").slice(0, 1), w[0].slice(0, 3) + w[1][0], w.map(x => x[0]).join("")];
    let c = cands.map(x => x.toUpperCase()).find(x => !usados.has(x));
    for (let i = 2; !c; i++) if (!usados.has(cands[0].toUpperCase() + i)) c = cands[0].toUpperCase() + i;
    usados.add(c); WS_CODE.set(ws, c);
  });

  // ------------------------------------------------------------------ registros
  const R = D.relatorios.map(r => ({ ...r, _sit: sitOf(r), _modo: MODO(r.modo), _status: STATUS(r.status_refresh) }));
  d3.groups(R, r => r.ws).forEach(([ws, reps]) => {
    reps.sort((a, b) => (a.criado || "9999").localeCompare(b.criado || "9999") || a.nome.localeCompare(b.nome, "pt-BR"))
      .forEach((r, i) => { r._cid = `${WS_CODE.get(ws) || "GER"}-${String(i + 1).padStart(2, "0")}`; });
  });
  const BY_ID = new Map(R.map(r => [r.id, r]));

  // ------------------------------------------------------------------ campos da ficha (dicionário + completude)
  // fill(r): true = preenchido · false = lacuna · null = não se aplica. score: entra na completude.
  const API = "API REST Power BI", DAX = "DAX INFO.VIEW (executeQueries)", USO = "Usage Metrics do workspace", DER = "Derivado (gerar_catalogo.py)";
  const FIELDS = [
    { k: "id_catalogo", g: "Identificação", l: "ID de catálogo", d: "Código estável: sigla do workspace + sequência por data de criação.", o: DER, t: "texto", v: r => r._cid },
    { k: "relatorio_id", g: "Identificação", l: "ID do relatório", d: "GUID do relatório no Power BI.", o: API, t: "GUID", v: r => r.id },
    { k: "nome", g: "Identificação", l: "Nome", d: "Nome do relatório publicado.", o: API, t: "texto", v: r => r.nome },
    { k: "workspace", g: "Identificação", l: "Workspace", d: "Workspace onde o relatório está publicado.", o: API, t: "texto", v: r => r.ws },
    { k: "url", g: "Identificação", l: "Link", d: "URL para abrir o relatório no Power BI.", o: API, t: "URL", v: r => r.url },
    { k: "situacao", g: "Classificação", l: "Situação", d: "Produtivo, Não produtivo (teste/homolog./UAT/old), Histórico ou Sistema.", o: DER, t: "categoria", v: r => r._sit },
    { k: "tema", g: "Classificação", l: "Tema de negócio", d: "Tema inferido por palavras-chave no nome, workspace, páginas, tabelas e medidas.", o: DER, t: "categoria", v: r => r.tema },
    { k: "owner", g: "Propriedade", l: "Owner técnico", d: "Quem configurou o modelo semântico (configuredBy).", o: API, t: "e-mail", v: r => r.owner, fill: r => !!r.owner, score: true },
    { k: "admins", g: "Propriedade", l: "Admins do workspace", d: "Usuários e grupos com papel de administrador no workspace.", o: API, t: "lista", v: r => r.admins, fill: r => !!r.admins, score: true },
    { k: "finalidade", g: "Conteúdo", l: "Finalidade", d: "Descrição gerada a partir das páginas, indicadores e base de dados.", o: DER, t: "texto", v: r => r.finalidade },
    { k: "paginas", g: "Conteúdo", l: "Páginas", d: "Lista de páginas do relatório.", o: API, t: "lista", v: r => r.paginas.join(" | "), fill: r => r.paginas.length > 0, score: true },
    { k: "paginas_nomeadas", g: "Conteúdo", l: "Páginas nomeadas", d: "Todas as páginas têm nome de negócio (não “Page 1”).", o: DER, t: "sim/não", v: r => r.paginas.length ? (r.paginas.every(p => !PAG_GENERICA.test(p)) ? "sim" : "não") : null, fill: r => r.paginas.length ? r.paginas.every(p => !PAG_GENERICA.test(p)) : null, score: true },
    { k: "dataset", g: "Modelo semântico", l: "Modelo semântico", d: "Dataset que alimenta o relatório.", o: API, t: "texto", v: r => r.dataset, fill: r => !!r.dataset, score: true },
    { k: "modo", g: "Modelo semântico", l: "Modo de armazenamento", d: "Import, Import em formato grande, DirectQuery…", o: API, t: "categoria", v: r => r.modo ? r._modo : null, fill: r => !!r.modo, score: true },
    { k: "tabelas", g: "Modelo semântico", l: "Tabelas e colunas", d: "Tabelas usadas (fato/dimensão) e suas colunas.", o: DAX, t: "lista", v: r => r.n_tabelas, fill: r => r.n_tabelas > 0, score: true },
    { k: "medidas_doc", g: "Modelo semântico", l: "Medidas documentadas", d: "Todas as medidas DAX têm descrição preenchida.", o: DAX, t: "sim/não", v: r => r.n_medidas ? `${r.n_medidas - r.medidas_sem_desc}/${r.n_medidas}` : null, fill: r => r.n_medidas ? r.medidas_sem_desc === 0 : null, score: true },
    { k: "relacionamentos", g: "Modelo semântico", l: "Relacionamentos", d: "Relações entre tabelas do modelo (exceto calendário/genéricas).", o: DAX, t: "lista", v: r => r.relacoes_modelo.length, fill: r => r.n_tabelas > 1 ? r.relacoes_modelo.length > 0 : null, score: true },
    { k: "fontes", g: "Linhagem", l: "Fontes de dados", d: "Servidores, bancos, arquivos e APIs de origem.", o: API, t: "lista", v: r => r.fontes.join(" | "), fill: r => r.fontes.length > 0, score: true },
    { k: "ultimo_refresh", g: "Atualização", l: "Último refresh com sucesso", d: "Data da última atualização bem-sucedida do modelo.", o: API, t: "data", v: r => r.ult_refresh, fill: r => !!r.ult_refresh, score: true },
    { k: "status_refresh", g: "Atualização", l: "Status do último refresh", d: "Sucesso, Falhou, Desativado ou Sem histórico.", o: API, t: "categoria", v: r => r._status },
    { k: "agenda", g: "Atualização", l: "Agenda de refresh", d: "Agenda configurada (ativa ou não), com dias e horários.", o: API, t: "sim/não", v: r => r.agenda_ativa === null ? null : (r.agenda_ativa ? "ativa" : "desativada"), fill: r => r.agenda_ativa !== null, score: true },
    { k: "views", g: "Uso", l: "Visualizações registradas", d: "Views somadas em todo o histórico de uso acumulado (saida/historico_uso.csv).", o: USO, t: "número", v: r => r.views, fill: r => r.views !== null, score: true },
    { k: "usuarios", g: "Uso", l: "Usuários", d: "Usuários distintos que abriram o relatório no histórico acumulado.", o: USO, t: "número", v: r => r.viewers },
    { k: "ultima_visualizacao", g: "Uso", l: "Última visualização", d: "Data mais recente em que alguém abriu o relatório (máximo entre todos os usuários).", o: USO, t: "data", v: r => r.ult_vis },
    { k: "periodo_uso", g: "Uso", l: "Período de uso coberto", d: "Da criação do relatório até a última visualização.", o: DER, t: "texto", v: r => r.periodo_uso },
    { k: "telemetria_ate", g: "Uso", l: "Telemetria disponível até", d: "Último dia com dados no Usage Metrics do workspace. Se ficou para trás, o modelo de uso está com refresh parado.", o: USO, t: "data", v: r => r.uso_ate },
    { k: "criado", g: "Ciclo de vida", l: "Criado em", d: "Data de criação do modelo semântico.", o: API, t: "data", v: r => r.criado, fill: r => !!r.criado, score: true },
  ];
  const SCORED = FIELDS.filter(f => f.score);
  const SHORT = { owner: "Owner", admins: "Admins", paginas: "Págs", paginas_nomeadas: "Pág. nom.", dataset: "Modelo", modo: "Modo", tabelas: "Tabelas",
    medidas_doc: "Med. doc.", relacionamentos: "Relações", fontes: "Fontes", ultimo_refresh: "Refresh", agenda: "Agenda", views: "Uso", criado: "Criação" };
  R.forEach(r => {
    const ap = SCORED.map(f => [f, f.fill(r)]).filter(([, v]) => v !== null);
    r._comp = ap.length ? ap.filter(([, v]) => v).length / ap.length : 0;
    r._gaps = ap.filter(([, v]) => !v).map(([f]) => f);
  });
  const fieldRate = (f, rows = R) => { const ap = rows.map(f.fill).filter(v => v !== null); return ap.length ? ap.filter(Boolean).length / ap.length : null; };

  // ficha estruturada (JSON exportável)
  function estruturar(r) {
    return {
      id_catalogo: r._cid,
      identificacao: { relatorio_id: r.id, nome: r.nome, workspace: r.ws, url: r.url, situacao: r._sit, tema: r.tema },
      propriedade: { owner_tecnico: r.owner, admins_workspace: r.admins },
      conteudo: { finalidade: r.finalidade, n_paginas: r.n_paginas, paginas: r.paginas },
      modelo_semantico: {
        dataset: r.dataset, dataset_id: r.dataset_id, modo_armazenamento: r.modo ? r._modo : null,
        n_tabelas: r.n_tabelas, tabelas: r.tabelas.map(t => ({ nome: t.t, papel: t.p, n_colunas: t.c.length })),
        n_medidas: r.n_medidas, medidas_sem_descricao: r.medidas_sem_desc, n_relacionamentos: r.relacoes_modelo.length,
      },
      linhagem: { fontes: r.fontes },
      atualizacao: { ultimo_refresh_sucesso: r.ult_refresh, status_ultimo_refresh: r._status, dias_desde_refresh: r.dias_refresh,
        agenda_ativa: r.agenda_ativa, dias: r.refresh_dias, horarios: r.refresh_hor, falhas_ultimos_10: r.falhas10 },
      uso: { views: r.views, page_views: r.page_views, usuarios: r.viewers, ultima_visualizacao: r.ult_vis, periodo_uso_coberto: r.periodo_uso, telemetria_desde: r.tel_desde, telemetria_ate: r.uso_ate,
        situacao_telemetria: r.tel_situacao },
      ciclo_de_vida: { criado_em: r.criado, idade_dias: r.idade_dias },
      qualidade: { completude: Math.round(r._comp * 100) / 100, campos_faltantes: r._gaps.map(f => f.k) },
    };
  }

  // ------------------------------------------------------------------ ícones e tooltip
  const paintIcons = root => SH.paint(root);
  const TT = $("#tooltip");
  function tip(ev, html) {
    TT.innerHTML = html; TT.classList.add("on");
    const pad = 14, w = TT.offsetWidth, h = TT.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > innerHeight - 8) y = ev.clientY - h - pad;
    TT.style.left = x + "px"; TT.style.top = y + "px";
  }
  const untip = () => TT.classList.remove("on");
  const ttRow = (k, v) => `<div class="tt-r"><span>${esc(k)}</span><b>${v}</b></div>`;

  const sitBadge = s => `<span class="tb"><span class="sw" style="background:${sitColor(s)}"></span>${esc(s)}</span>`;
  const temaBadge = t => `<span class="tb" title="${esc(SH.temaDesc(t))}"><span class="sw" style="background:${temaColor(t)}"></span>${esc(t)}</span>`;
  const cidTag = r => `<span class="cid">${esc(r._cid)}</span>`;
  const compBar = v => `<div class="mbar"><div class="track"><div class="fill" style="width:${Math.max(2, v * 100)}%;background:${compColor(v)}"></div></div><small>${pct(v)}</small></div>`;
  const compColor = v => `color-mix(in srgb, ${cssv("--lime")} ${Math.round(35 + v * 65)}%, ${cssv("--ink-3")})`;

  // ------------------------------------------------------------------ navegação
  const VIEWS = {
    resumo: ["resumo", "Inventário dos dashboards Power BI"],
    catalogo: ["catálogo estruturado", "Catálogo estruturado"],
    hierarquia: ["hierarquia", "Workspace › relatório › página"],
    completude: ["completude", "Completude dos metadados"],
    dicionario: ["dicionário", "Dicionário de campos da ficha"],
  };
  const rendered = {};
  let current = "resumo";
  function go(view, after) {
    if (!VIEWS[view]) return;
    current = view;
    $$("#nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
    $("#viewKicker").textContent = VIEWS[view][0];
    $("#viewTitle").textContent = VIEWS[view][1];
    $(".sidebar").classList.remove("open");
    try { history.replaceState(null, "", "#" + view); } catch (e) { /* file:// restrito */ }
    if (!rendered[view]) { RENDER[view](); rendered[view] = true; }
    if (after) after();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("#nav").addEventListener("click", e => { const b = e.target.closest("button"); if (b) go(b.dataset.view); });
  document.addEventListener("click", e => { const g = e.target.closest("[data-goto]"); if (g) go(g.dataset.goto); });

  function setTheme(t) { document.documentElement.setAttribute("data-theme", t); SH.store.set("catbi-theme", t); }
  setTheme(SH.store.get("catbi-theme") || "dark");
  $("#themeToggle").addEventListener("click", () => {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
    Object.keys(rendered).forEach(k => delete rendered[k]);
    RENDER[current](); rendered[current] = true;
  });

  // ------------------------------------------------------------------ tabela ordenável
  function dataTable(el, cols, rows, { onClick, sortKey, asc = false, limit = 2000 } = {}) {
    const state = el._state || (el._state = { key: sortKey, asc });
    const draw = () => {
      const col = cols.find(c => c.k === state.key);
      const sorted = col ? [...rows].sort((a, b) => {
        const va = col.sort ? col.sort(a) : a[col.k], vb = col.sort ? col.sort(b) : b[col.k];
        const na = va === null || va === undefined, nb = vb === null || vb === undefined;
        if (na && nb) return 0; if (na) return 1; if (nb) return -1;
        const r = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
        return state.asc ? r : -r;
      }) : rows;
      el.innerHTML = `<thead><tr>${cols.map(c => `<th data-k="${c.k}" class="${c.k === state.key ? "sorted" + (state.asc ? " asc" : "") : ""}">${c.label}</th>`).join("")}</tr></thead>` +
        `<tbody>${sorted.slice(0, limit).map(r => `<tr data-i="${rows.indexOf(r)}">${cols.map(c => `<td class="${c.num ? "num" : ""}">${c.render ? c.render(r) : esc(r[c.k])}</td>`).join("")}</tr>`).join("")}</tbody>`;
      if (!sorted.length) el.innerHTML += `<tbody><tr><td colspan="${cols.length}" class="empty">Nada encontrado com esses filtros.</td></tr></tbody>`;
    };
    el.onclick = e => {
      const th = e.target.closest("th");
      if (th) { if (state.key === th.dataset.k) state.asc = !state.asc; else { state.key = th.dataset.k; state.asc = false; } return draw(); }
      if (e.target.closest("a")) return;
      const tr = e.target.closest("tbody tr[data-i]");
      if (tr && onClick) onClick(rows[+tr.dataset.i]);
    };
    draw();
  }

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  function countUp(el, to, dur = 1100, suffix = "") {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = fmt(to) + suffix; return; }
    let t0 = null;
    const step = t => {
      if (t0 === null) t0 = t;
      const p = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(p >= 1 ? to : to * e) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ------------------------------------------------------------------ gráficos (barras finas, ponta arredondada de 4px, vão de 2px)
  const roundRight = (x, y, w, h, r) => {
    r = Math.min(r, w, h / 2);
    return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`;
  };
  const roundTop = (x, y, w, h, r) => {
    r = Math.min(r, h, w / 2);
    return `M${x},${y + h}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`;
  };

  // barras horizontais empilhadas: rows [{label, segs:[{k, v, color}], onClick}]
  function hbars(el, rows, { labelW = 170, rowH = 24, barH = 12, tipFn } = {}) {
    el.innerHTML = "";
    const W = el.clientWidth || 600, H = rows.length * rowH + 8;
    const max = d3.max(rows, r => d3.sum(r.segs, s => s.v)) || 1;
    const x = d3.scaleLinear().domain([0, max]).range([0, W - labelW - 44]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", H).attr("role", "img");
    const g = svg.selectAll("g.row").data(rows).join("g").attr("class", "row").attr("transform", (d, i) => `translate(0,${i * rowH + 4})`)
      .style("cursor", d => d.onClick ? "pointer" : null).on("click", (ev, d) => d.onClick && d.onClick());
    g.append("rect").attr("x", 0).attr("y", 0).attr("width", W).attr("height", rowH).attr("fill", "transparent");
    g.append("text").attr("x", labelW - 10).attr("y", rowH / 2).attr("dy", ".35em").attr("text-anchor", "end")
      .attr("fill", cssv("--ink-2")).style("font-size", "12px").text(d => trunc(d.label, Math.floor(labelW / 6.6))).append("title").text(d => d.label);
    g.each(function (d) {
      let acc = 0;
      const segs = d.segs.filter(s => s.v > 0), gg = d3.select(this);
      segs.forEach((s, i) => {
        const x0 = labelW + x(acc) + (i ? 1 : 0), w = Math.max(1, x(s.v) - (i ? 2 : 0) - (i < segs.length - 1 ? 1 : 0));
        acc += s.v;
        const p = i === segs.length - 1 ? roundRight(x0, (rowH - barH) / 2, w, barH, 4) : `M${x0},${(rowH - barH) / 2}h${w}v${barH}h${-w}z`;
        gg.append("path").attr("d", p).attr("fill", s.color).attr("class", "seg")
          .on("mousemove", ev => tip(ev, tipFn ? tipFn(d, s) : `<div class="tt-t">${esc(d.label)}</div>${ttRow(s.k, fmt(s.v))}`)).on("mouseleave", untip);
      });
      gg.append("text").attr("x", labelW + x(acc) + 8).attr("y", rowH / 2).attr("dy", ".35em").attr("fill", cssv("--ink"))
        .style("font", "600 12px var(--font-b)").style("font-variant-numeric", "tabular-nums").text(fmt(acc));
    });
    g.on("mouseenter", function () { d3.select(this).selectAll(".seg").attr("opacity", .82); })
      .on("mouseleave", function () { d3.select(this).selectAll(".seg").attr("opacity", 1); });
    // entrada animada
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      svg.selectAll(".seg").attr("transform", `translate(${labelW},0) scale(0,1) translate(${-labelW},0)`)
        .transition().duration(900).delay((d, i) => i * 14).ease(d3.easeCubicOut).attr("transform", "translate(0,0) scale(1,1)");
  }

  // colunas verticais de uma série
  function vcols(el, rows, color, { H = 220 } = {}) {
    el.innerHTML = "";
    const W = el.clientWidth || 360, m = { t: 22, b: 26, l: 8, r: 8 };
    const x = d3.scaleBand().domain(rows.map(r => r.label)).range([m.l, W - m.r]).padding(.38);
    const y = d3.scaleLinear().domain([0, d3.max(rows, r => r.value) || 1]).range([H - m.b, m.t]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
    svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", H - m.b + .5).attr("y2", H - m.b + .5).attr("stroke", cssv("--border-strong"));
    const g = svg.selectAll("g.c").data(rows).join("g").attr("class", "c")
      .style("cursor", d => d.onClick ? "pointer" : null).on("click", (ev, d) => d.onClick && d.onClick());
    g.append("path").attr("fill", color).attr("d", d => roundTop(x(d.label), y(d.value), x.bandwidth(), H - m.b - y(d.value), 4))
      .on("mousemove", (ev, d) => tip(ev, `<div class="tt-t">${esc(d.label)}</div>${ttRow("Dashboards", fmt(d.value))}`)).on("mouseleave", untip);
    g.append("text").attr("x", d => x(d.label) + x.bandwidth() / 2).attr("y", d => y(d.value) - 6).attr("text-anchor", "middle")
      .attr("fill", cssv("--ink")).style("font", "600 12px var(--font-b)").text(d => fmt(d.value));
    g.append("text").attr("x", d => x(d.label) + x.bandwidth() / 2).attr("y", H - 8).attr("text-anchor", "middle")
      .attr("fill", cssv("--ink-3")).style("font", "11px var(--font-m)").text(d => d.label);
  }

  // ==================================================================
  // RESUMO
  // ==================================================================
  function renderResumo() {
    const nWsRel = new Set(R.map(r => r.ws)).size;
    const nPag = d3.sum(R, r => r.n_paginas), nMed = d3.sum(R, r => r.n_medidas), nMedSem = d3.sum(R, r => r.medidas_sem_desc);
    const fontes = new Set(R.flatMap(r => r.fontes.map(f => normTxt(f))));
    const cnt = k => R.filter(r => r._sit === k).length;
    const kpis = [
      { l: "Dashboards catalogados", v: R.length, s: `${cnt("Produtivo")} produtivos · ${cnt("Histórico")} histórico · ${cnt("Sistema")} sistema`, c: "--lime", go: "catalogo" },
      { l: "Workspaces", v: D.workspaces.length, s: `${nWsRel} com relatórios publicados`, c: "--mint", go: "hierarquia" },
      { l: "Páginas", v: nPag, s: `média de ${(nPag / R.length).toFixed(1).replace(".", ",")} por dashboard`, c: "--t-portfolio", go: "hierarquia" },
      { l: "Medidas DAX", v: nMed, s: `${pct(nMedSem / Math.max(1, nMed))} sem descrição`, c: "--t-cotas", go: "completude" },
      { l: "Fontes de dados", v: fontes.size, s: "servidores, bancos e arquivos distintos", c: "--t-cliente", go: "dicionario" },
      { l: "Completude", v: Math.round(d3.mean(R, r => r._comp) * 100), suf: "%", s: `${SCORED.length} campos avaliados por dashboard`, c: "--s-naoprod", go: "completude" },
    ];
    const K = $("#invKpis");
    K.innerHTML = kpis.map((k, i) => `<div class="kpi glass clickable" data-goto="${k.go}" style="--kc:var(${k.c});animation:rise .7s var(--ease) ${i * 60}ms both">
      <div class="k-label">${k.l}</div><div class="k-val" data-v="${k.v}" data-suf="${k.suf || ""}">0</div><div class="k-sub">${k.s}</div></div>`).join("");
    K.querySelectorAll(".k-val").forEach(el => countUp(el, +el.dataset.v, 1100, el.dataset.suf));

    // legenda situação
    $("#legSit").innerHTML = SIT.map(s => `<span><span class="sw" style="background:${sitColor(s.k)}"></span>${s.k}</span>`).join("");

    // por workspace (empilhado por situação)
    const wsRows = d3.groups(R, r => r.ws).map(([ws, reps]) => ({
      label: ws, segs: SIT.map(s => ({ k: s.k, v: reps.filter(r => r._sit === s.k).length, color: sitColor(s.k) })),
      onClick: () => filtrarCatalogo({ ws }), n: reps.length,
    })).sort((a, b) => b.n - a.n);
    hbars($("#barWsInv"), wsRows, { labelW: 200, tipFn: (d, s) => `<div class="tt-t">${esc(d.label)}</div>${ttRow(s.k, fmt(s.v))}${ttRow("Total no workspace", fmt(d.n))}<div class="tt-r"><span>clique para abrir no catálogo</span></div>` });

    // situação
    $("#sitList").innerHTML = SIT.map(s => {
      const n = cnt(s.k);
      return `<button class="sit" data-sit="${esc(s.k)}" style="--sc:${sitColor(s.k)}">
        <span class="sit-dot"></span><span class="sit-t"><b>${s.k}</b><small>${s.d}</small></span><span class="sit-n">${fmt(n)}<small>${pct(n / R.length)}</small></span>
        <span class="sit-bar"><span style="width:${n / R.length * 100}%"></span></span></button>`;
    }).join("");
    $("#sitList").onclick = e => { const b = e.target.closest("[data-sit]"); if (b) filtrarCatalogo({ sit: b.dataset.sit }); };

    // tema
    const temas = D.temas_ordem.map(t => ({ label: t, segs: [{ k: t, v: R.filter(r => r.tema === t).length, color: temaColor(t) }], onClick: () => filtrarCatalogo({ tema: t }) }))
      .filter(r => r.segs[0].v).sort((a, b) => b.segs[0].v - a.segs[0].v);
    hbars($("#barTema"), temas, { labelW: 104, rowH: 22, barH: 10,
      tipFn: (d, s) => `<div class="tt-t">${esc(d.label)}</div><div class="muted small" style="margin-bottom:6px;max-width:260px">${esc(SH.temaDesc(d.label))}</div>${ttRow("Dashboards", fmt(s.v))}<div class="tt-r"><span>clique para abrir no catálogo</span></div>` });
    $("#temaLegInv").innerHTML = SH.temaLegenda(D.temas_ordem, temaColor, t => `${R.filter(r => r.tema === t).length} dashboards`);
    $("#temaLegInv").onclick = e => { const b = e.target.closest("[data-tema]"); if (b) filtrarCatalogo({ tema: b.dataset.tema }); };

    // ano de criação: clicar numa coluna filtra o catálogo por aquele ano

    // ano de criação
    const anos = d3.rollups(R.filter(r => r.criado), v => v.length, r => r.criado.slice(0, 4)).sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value, onClick: () => filtrarCatalogo({ ano: label }) }));
    const semData = R.filter(r => !r.criado).length;
    vcols($("#colAno"), anos, cssv("--lime"));
    if (semData) $("#colAno").insertAdjacentHTML("beforeend", `<p class="muted small" style="margin:6px 0 0">+ ${semData} sem data de criação (modelos sem acesso de leitura)</p>`);

    // modo
    const modos = d3.rollups(R, v => v.length, r => r._modo).sort((a, b) => b[1] - a[1])
      .map(([m, v]) => ({ label: m, segs: [{ k: m, v, color: cssv("--mint") }] }));
    hbars($("#barModo"), modos, { labelW: 150, rowH: 26, barH: 12 });

    heroStack();
  }

  // pilha de fichas no hero (dados reais)
  function heroStack() {
    const top = R.filter(r => r._sit === "Produtivo").sort((a, b) => (b.views || 0) - (a.views || 0) || b._comp - a._comp).slice(0, 3);
    $("#invStack").innerHTML = top.map((r, i) => `<div class="mini-ficha glass" style="--i:${i}">
        <div class="mf-h"><span class="cid">${esc(r._cid)}</span>${sitBadge(r._sit)}</div>
        <div class="mf-n">${esc(trunc(r.nome, 34))}</div>
        <div class="mf-kv"><span>workspace</span><b>${esc(trunc(r.ws, 22))}</b></div>
        <div class="mf-kv"><span>páginas · tabelas</span><b>${r.n_paginas} · ${r.n_tabelas}</b></div>
        <div class="mf-kv"><span>refresh</span><b>${esc(r.ult_refresh || "—")}</b></div>
        <div class="mf-kv"><span>última view</span><b>${SH.br(r.ult_vis)}</b></div>
        ${compBar(r._comp)}
      </div>`).join("");
    $("#invStack").onclick = e => { const f = e.target.closest(".mini-ficha"); if (f) openFicha(top[+f.style.getPropertyValue("--i")].id); };
  }

  // ==================================================================
  // CATÁLOGO ESTRUTURADO
  // ==================================================================
  const anoOf = r => r.criado ? r.criado.slice(0, 4) : "Sem data";
  const ownerOf = r => r.owner ? r.owner.split("@")[0] : "Sem owner";
  const F = { q: "", ws: "", tema: "", ano: "", owner: "", sit: new Set() };
  function filtrarCatalogo({ ws = "", tema = "", ano = "", owner = "", sit = "" } = {}) {
    F.q = ""; F.ws = ws; F.tema = tema; F.ano = ano; F.owner = owner; F.sit = new Set(sit ? [sit] : []);
    go("catalogo", () => syncFiltros());
  }
  // a lista "Situação" mostra a situação escolhida quando há só uma; as pílulas abaixo permitem combinar várias
  const syncSitSelect = () => { $("#fSit").value = F.sit.size === 1 ? [...F.sit][0] : ""; };
  function syncFiltros() {
    $("#invSearch").value = F.q; $("#fWs").value = F.ws; $("#fTema").value = F.tema; $("#fAno").value = F.ano; $("#fOwner").value = F.owner;
    syncSitSelect(); drawFacets(); drawCatalogo();
  }
  function setupCatalogo() {
    const opt = arr => arr.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    $("#fWs").innerHTML = `<option value="">Todos</option>` + opt([...new Set(R.map(r => r.ws))].sort((a, b) => a.localeCompare(b, "pt-BR")));
    $("#fTema").innerHTML = `<option value="">Todos</option>` + opt(D.temas_ordem);
    $("#fSit").innerHTML = `<option value="">Todas</option>` + opt(SIT.map(s => s.k));
    $("#fAno").innerHTML = `<option value="">Todos</option>` + opt([...new Set(R.map(anoOf))].sort().reverse());
    $("#fOwner").innerHTML = `<option value="">Todos</option>` + opt([...new Set(R.map(ownerOf))].sort((a, b) => a.localeCompare(b, "pt-BR")));
    $("#invSearch").addEventListener("input", e => { F.q = e.target.value; drawCatalogo(); });
    const redesenha = () => { drawFacets(); drawCatalogo(); };
    $("#fWs").onchange = e => { F.ws = e.target.value; redesenha(); };
    $("#fTema").onchange = e => { F.tema = e.target.value; redesenha(); };
    $("#fAno").onchange = e => { F.ano = e.target.value; redesenha(); };
    $("#fOwner").onchange = e => { F.owner = e.target.value; redesenha(); };
    $("#fSit").onchange = e => { F.sit = new Set(e.target.value ? [e.target.value] : []); redesenha(); };
    $("#facetSit").onclick = e => {
      const b = e.target.closest("[data-sit]"); if (!b) return;
      const k = b.dataset.sit;
      if (k === "*") F.sit.clear(); else F.sit.has(k) ? F.sit.delete(k) : F.sit.add(k);
      syncSitSelect(); redesenha();
    };
    $("#expCsv").onclick = () => {
      const rows = filtrados();
      const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const head = FIELDS.map(f => f.k).concat(["completude", "campos_faltantes"]);
      const body = rows.map(r => FIELDS.map(f => f.v(r)).concat([Math.round(r._comp * 100) + "%", r._gaps.map(f => f.k).join(", ")]).map(q).join(";"));
      download("inventario_dashboards.csv", "﻿" + [head.map(q).join(";"), ...body].join("\r\n"), "text/csv;charset=utf-8");
    };
    $("#expJson").onclick = () => {
      const rows = filtrados();
      const doc = { gerado_em: D.resumo.gerado_em, extracao_em: D.resumo.extracao_em, total: rows.length,
        dicionario: FIELDS.map(f => ({ campo: f.k, grupo: f.g, nome: f.l, descricao: f.d, origem: f.o, tipo: f.t })), dashboards: rows.map(estruturar) };
      download("inventario_dashboards.json", JSON.stringify(doc, null, 2), "application/json");
    };
  }
  const baseFiltro = r => (!F.ws || r.ws === F.ws) && (!F.tema || r.tema === F.tema) && (!F.ano || anoOf(r) === F.ano) && (!F.owner || ownerOf(r) === F.owner) &&
    (!F.q || normTxt([r._cid, r.nome, r.ws, r.owner, r.dataset, r.tema, r._sit, ...r.tabelas.map(t => t.t)].join(" ")).includes(normTxt(F.q)));
  const filtrados = () => R.filter(r => baseFiltro(r) && (!F.sit.size || F.sit.has(r._sit)));
  function drawFacets() {
    const base = R.filter(baseFiltro);
    $("#facetSit").innerHTML = `<button class="facet ${F.sit.size ? "" : "on"}" data-sit="*">Todas <b>${base.length}</b></button>` +
      SIT.map(s => `<button class="facet ${F.sit.has(s.k) ? "on" : ""}" data-sit="${esc(s.k)}" style="--sc:${sitColor(s.k)}"><span class="sw round" style="background:${sitColor(s.k)}"></span>${s.k} <b>${base.filter(r => r._sit === s.k).length}</b></button>`).join("");
  }
  function drawCatalogo() {
    const rows = filtrados();
    $("#catCount").innerHTML = `${fmt(rows.length)} <span class="muted" style="font-weight:400">de ${fmt(R.length)} dashboards</span>`;
    dataTable($("#invTable"), [
      { k: "_cid", label: "ID", render: r => cidTag(r) },
      { k: "nome", label: "Dashboard", render: r => `<div class="nm">${esc(r.nome)}</div><div class="sub">${esc(r.ws)}</div>` },
      { k: "_sit", label: "Situação", render: r => sitBadge(r._sit) },
      { k: "tema", label: "Tema", render: r => temaBadge(r.tema) },
      { k: "n_paginas", label: "Págs", num: true, render: r => fmt(r.n_paginas) },
      { k: "n_tabelas", label: "Tabelas", num: true, render: r => fmt(r.n_tabelas) },
      { k: "n_medidas", label: "Medidas", num: true, render: r => fmt(r.n_medidas) },
      { k: "owner", label: "Owner", render: r => `<span class="sub">${esc((r.owner || "—").split("@")[0])}</span>` },
      { k: "ult_refresh", label: "Últ. refresh", render: r => r.ult_refresh ? `${esc(r.ult_refresh)}<div class="sub">${esc(r._status)}</div>` : `<span class="sub">${esc(r._status)}</span>` },
      { k: "views", label: "Views", num: true, render: r => r.views === null ? `<span class="sub">—</span>` : fmt(r.views) },
      { k: "_comp", label: "Ficha", render: r => compBar(r._comp) },
    ], rows, { sortKey: "_cid", asc: true, onClick: r => openFicha(r.id) });
  }

  // ==================================================================
  // HIERARQUIA (icicle com zoom: workspace › relatório › página)
  // ==================================================================
  let zoomTo = null;
  function renderHierarquia() {
    const el = $("#icicle"); el.innerHTML = "";
    const W = el.clientWidth || 900, H = Math.max(520, Math.min(720, innerHeight - 280));
    const data = {
      name: "Inventário", children: d3.groups(R, r => r.ws).map(([ws, reps]) => ({
        name: ws, ws, children: reps.map(r => ({ name: r.nome, rep: r, children: (r.paginas.length ? r.paginas : ["(sem páginas)"]).map(p => ({ name: p, page: true, rep: r })) })),
      })),
    };
    // cada dashboard vale 1 (dividido entre suas páginas): o tamanho do bloco = nº de dashboards
    const root = d3.hierarchy(data).sum(d => d.children ? 0 : 1 / Math.max(1, d.rep.paginas.length)).sort((a, b) => b.value - a.value);
    const pags = d => d3.sum(d.leaves(), l => l.data.name === "(sem páginas)" ? 0 : 1);
    const colW = W / 3;  // 3 níveis visíveis por vez
    d3.partition().size([H, (root.height + 1) * colW])(root);
    let focus = root;

    const svg = d3.select(el).append("svg").attr("width", W).attr("height", H).style("font", "12px var(--font-b)");
    const cell = svg.selectAll("g").data(root.descendants()).join("g").attr("transform", d => `translate(${d.y0},${d.x0})`).style("cursor", "pointer");
    const fillOf = d => {
      if (d.depth === 0) return cssv("--ink-3");
      if (d.depth === 1) { const top = d3.greatest(d3.rollups(d.data.children, v => v.length, c => c.rep._sit), x => x[1]); return sitColor(top[0]); }
      return sitColor(d.data.rep._sit);
    };
    const opOf = d => [.14, .2, .62, .32][d.depth];
    const rectH = d => Math.max(0, d.x1 - d.x0 - Math.min(2, (d.x1 - d.x0) / 2));
    const rect = cell.append("rect").attr("width", d => d.y1 - d.y0 - 3).attr("height", rectH).attr("rx", 6)
      .attr("fill", fillOf).attr("fill-opacity", opOf).attr("stroke", fillOf).attr("stroke-opacity", d => d.depth === 1 ? .45 : 0);
    const visivel = d => d.y1 <= W + 1 && d.y0 >= -1 && d.x1 - d.x0 > 15;
    const label = d => {
      const w = d.y1 - d.y0 - 24, n = Math.floor(w / 6.6);
      const base = d.depth === 1 ? `${WS_CODE.get(d.data.ws) || ""} · ${d.data.name}` : d.depth === 2 ? `${d.data.rep._cid} · ${d.data.name}` : d.data.name;
      return trunc(base, n);
    };
    const text = cell.append("text").attr("x", 10).attr("y", 15).attr("fill", cssv("--ink")).attr("fill-opacity", d => +visivel(d)).style("pointer-events", "none");
    text.append("tspan").style("font-weight", d => d.depth < 3 ? 600 : 400).text(label);
    const sub = cell.append("text").attr("x", 10).attr("y", 30).attr("fill", cssv("--ink-2")).style("font", "10.5px var(--font-m)").style("pointer-events", "none")
      .attr("fill-opacity", d => +(visivel(d) && d.x1 - d.x0 > 34 && d.depth < 3))
      .text(d => d.depth === 0 ? `${R.length} dashboards · ${pags(d)} páginas` : d.depth === 1 ? `${d.children.length} dashboards · ${pags(d)} págs` : d.depth === 2 ? `${d.data.rep.n_paginas} págs · ${d.data.rep._sit}` : "");

    cell.on("mousemove", (ev, d) => {
      const h = d.depth === 0 ? `<div class="tt-t">Inventário completo</div>${ttRow("Dashboards", R.length)}${ttRow("Páginas", pags(d))}`
        : d.depth === 1 ? `<div class="tt-t">${esc(d.data.name)}</div>${ttRow("Sigla", WS_CODE.get(d.data.ws))}${ttRow("Dashboards", d.children.length)}${ttRow("Páginas", pags(d))}`
        : d.depth === 2 ? `<div class="tt-t">${esc(d.data.name)}</div>${ttRow("ID", d.data.rep._cid)}${ttRow("Situação", d.data.rep._sit)}${ttRow("Páginas", d.data.rep.n_paginas)}<div class="tt-r"><span>${focus === d ? "clique para abrir a ficha" : "clique para ver as páginas"}</span></div>`
        : `<div class="tt-t">${esc(d.data.name)}</div>${ttRow("Dashboard", esc(d.data.rep.nome))}<div class="tt-r"><span>clique para abrir a ficha</span></div>`;
      tip(ev, h);
    }).on("mouseleave", untip).on("click", (ev, d) => {
      untip();
      if (d.depth === 3 || (d.depth === 2 && focus === d)) return openFicha(d.data.rep.id, d.depth === 3 ? "conteudo" : null);
      zoom(focus === d ? (d.parent || d) : d);
    });

    function zoom(p) {
      focus = p;
      $("#icicleTitle").innerHTML = p.ancestors().reverse().map((a, i, arr) => i < arr.length - 1
        ? `<button class="crumb-btn" data-depth="${a.depth}">${esc(a.depth === 0 ? "Inventário" : a.data.name)}</button><span class="muted"> / </span>`
        : `<span>${esc(a.depth === 0 ? "Inventário" : a.data.name)}</span>`).join("");
      root.each(d => d.target = {
        x0: (d.x0 - p.x0) / (p.x1 - p.x0) * H, x1: (d.x1 - p.x0) / (p.x1 - p.x0) * H,
        y0: d.y0 - p.y0, y1: d.y1 - p.y0,
      });
      const t = svg.transition().duration(matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 750).ease(d3.easeCubicInOut);
      cell.transition(t).attr("transform", d => `translate(${d.target.y0},${d.target.x0})`);
      rect.transition(t).attr("height", d => rectH(d.target));
      text.transition(t).attr("fill-opacity", d => +visivel(d.target));
      sub.transition(t).attr("fill-opacity", d => +(visivel(d.target) && d.target.x1 - d.target.x0 > 34 && d.depth < 3));
    }
    $("#icicleTitle").onclick = e => {
      const b = e.target.closest("[data-depth]"); if (!b) return;
      let a = focus; while (a.depth > +b.dataset.depth) a = a.parent; zoom(a);
    };
    zoom(root);
    zoomTo = ws => { const n = root.children.find(c => c.data.ws === ws); if (n) { zoom(n); el.scrollIntoView({ behavior: "smooth", block: "center" }); } };

    $("#legIcicle").innerHTML = SIT.map(s => `<span><span class="sw" style="background:${sitColor(s.k)}"></span>${s.k}</span>`).join("");

    // cartões de workspace
    $("#wsCards").innerHTML = d3.groups(R, r => r.ws).sort((a, b) => b[1].length - a[1].length).map(([ws, reps]) => {
      const n = reps.length, owners = new Set(reps.map(r => r.owner).filter(Boolean)).size;
      return `<button class="ws-card glass" data-ws="${esc(ws)}">
        <div class="ws-h"><span class="cid">${esc(WS_CODE.get(ws))}</span><span class="ws-n">${n}</span></div>
        <div class="ws-name">${esc(ws)}</div>
        <div class="stackbar">${SIT.map(s => { const k = reps.filter(r => r._sit === s.k).length; return k ? `<span style="flex:${k};background:${sitColor(s.k)}" title="${s.k}: ${k}"></span>` : ""; }).join("")}</div>
        <div class="ws-meta"><span>${fmt(d3.sum(reps, r => r.n_paginas))} págs</span><span>${owners} owner(s)</span><span>ficha ${pct(d3.mean(reps, r => r._comp))}</span></div>
      </button>`;
    }).join("");
    $("#wsCards").onclick = e => { const c = e.target.closest("[data-ws]"); if (c && zoomTo) zoomTo(c.dataset.ws); };
  }

  // ==================================================================
  // COMPLETUDE
  // ==================================================================
  function renderCompletude() {
    const rates = SCORED.map(f => ({ f, v: fieldRate(f) })).sort((a, b) => b.v - a.v);
    const pior = rates[rates.length - 1];
    const full = R.filter(r => r._comp >= 0.9).length;
    const nMed = d3.sum(R, r => r.n_medidas), nMedSem = d3.sum(R, r => r.medidas_sem_desc);
    const kp = [
      { l: "Completude média", v: Math.round(d3.mean(R, r => r._comp) * 100), suf: "%", s: "média dos dashboards em que o campo veio preenchido", c: "--lime" },
      { l: "Relatórios ≥ 90% completas", v: full, s: `de ${R.length} dashboards · ${R.filter(r => r._comp >= 0.999).length} com 100%`, c: "--mint" },
      { l: "Campo com mais lacunas", txt: pior.f.l, s: `preenchido em ${pct(pior.v)} dos casos`, c: "--r-revisar" },
      { l: "Medidas sem descrição", v: Math.round(nMedSem / Math.max(1, nMed) * 100), suf: "%", s: `${fmt(nMedSem)} de ${fmt(nMed)} medidas`, c: "--t-cotas" },
    ];
    $("#qKpis").innerHTML = kp.map((k, i) => `<div class="kpi glass" style="--kc:var(${k.c});animation:rise .7s var(--ease) ${i * 60}ms both"><div class="k-label">${k.l}</div>
      <div class="k-val ${k.txt ? "k-txt" : ""}" data-v="${k.v ?? ""}" data-suf="${k.suf || ""}">${k.txt ? esc(k.txt) : "0"}</div><div class="k-sub">${k.s}</div></div>`).join("");
    $("#qKpis").querySelectorAll(".k-val:not(.k-txt)").forEach(el => countUp(el, +el.dataset.v, 1000, el.dataset.suf));

    $("#fieldBars").innerHTML = rates.map(({ f, v }) => `<div class="fb" title="${esc(f.d)}"><span class="fb-l">${esc(f.l)}<small>${esc(f.g)}</small></span>
      <span class="fb-t"><span style="width:${(v || 0) * 100}%;background:${compColor(v || 0)}"></span></span><b>${pct(v)}</b></div>`).join("");

    // heatmap como tabela (também serve de visão tabular)
    const wsList = d3.groups(R, r => r.ws).sort((a, b) => b[1].length - a[1].length);
    const lime = cssv("--lime");
    $("#heat").innerHTML = `<div class="table-wrap"><table class="heat-t"><thead><tr><th>Workspace</th>${SCORED.map(f => `<th title="${esc(f.l)}">${esc(SHORT[f.k] || f.l)}</th>`).join("")}<th>Média</th></tr></thead><tbody>` +
      wsList.map(([ws, reps]) => `<tr><td class="hw"><span class="cid">${esc(WS_CODE.get(ws))}</span> ${esc(trunc(ws.replace(/^BI\s*-?\s*/, ""), 20))}<small>${reps.length}</small></td>` + SCORED.map(f => {
        const v = fieldRate(f, reps);
        return v === null ? `<td class="na" title="${esc(ws)} · ${esc(f.l)}: não se aplica">·</td>`
          : `<td style="background:color-mix(in srgb, ${lime} ${Math.round(6 + v * 70)}%, transparent)" title="${esc(ws)} · ${esc(f.l)}: ${pct(v)}">${Math.round(v * 100)}</td>`;
      }).join("") + `<td class="hm">${pct(d3.mean(reps, r => r._comp))}</td></tr>`).join("") + `</tbody></table></div>`;
    $("#legHeat").innerHTML = `<span>0%</span><span class="heat-scale"></span><span>100%</span><span class="muted">· = não se aplica</span>`;

    dataTable($("#gapTable"), [
      { k: "_cid", label: "ID", render: r => cidTag(r) },
      { k: "nome", label: "Dashboard", render: r => `<div class="nm">${esc(r.nome)}</div><div class="sub">${esc(r.ws)}</div>` },
      { k: "_sit", label: "Situação", render: r => sitBadge(r._sit) },
      { k: "_comp", label: "Completude", render: r => compBar(r._comp) },
      { k: "_ng", label: "Lacunas", sort: r => r._gaps.length, render: r => `<div class="reasons">${r._gaps.map(f => `<span>${esc(f.l)}</span>`).join("") || '<span>nenhuma</span>'}</div>` },
    ], R, { sortKey: "_comp", asc: true, onClick: r => openFicha(r.id) });
  }

  // ==================================================================
  // DICIONÁRIO
  // ==================================================================
  function renderDicionario() {
    const ex = f => { const r = R.find(x => { const v = f.v(x); return v !== null && v !== undefined && v !== "" && x._sit === "Produtivo"; }); return r ? f.v(r) : null; };
    const origemCls = o => o === DER ? "der" : o === USO ? "uso" : o === DAX ? "dax" : "api";
    $("#dictGroups").innerHTML = d3.groups(FIELDS, f => f.g).map(([g, fs], gi) => `<div class="card glass dict" style="animation:rise .7s var(--ease) ${gi * 50}ms both">
      <div class="card-h"><h3>${esc(g)}</h3><span class="chip">${fs.length} campo(s)</span></div>
      <div class="table-wrap"><table class="dt dict-t"><thead><tr><th>Campo</th><th>Descrição</th><th>Origem</th><th>Tipo</th><th>Preench.</th><th>Exemplo</th></tr></thead><tbody>
      ${fs.map(f => { const v = f.fill ? fieldRate(f) : R.filter(x => { const y = f.v(x); return y !== null && y !== undefined && y !== ""; }).length / R.length, e = ex(f); return `<tr>
        <td><code class="fk">${esc(f.k)}</code><div class="nm" style="margin-top:4px">${esc(f.l)}</div></td>
        <td class="muted">${esc(f.d)}</td>
        <td><span class="orig ${origemCls(f.o)}">${esc(f.o)}</span></td>
        <td><span class="typ">${esc(f.t)}</span></td>
        <td>${compBar(v ?? 0)}</td>
        <td class="ex">${e === null ? '<span class="empty">—</span>' : esc(trunc(f.k === "owner" ? String(e).split("@")[0] + "@…" : e, 46))}</td></tr>`; }).join("")}
      </tbody></table></div></div>`).join("");
  }

  // ==================================================================
  // FICHA (modal)
  // ==================================================================
  const MB = $("#modalBody");
  function openModal(html, after) {
    MB.innerHTML = html; paintIcons(MB);
    $("#modal").classList.remove("closing");
    $("#modal").classList.add("open"); $("#modal").setAttribute("aria-hidden", "false");
    $("#modal").scrollTop = 0;
    const tabs = MB.querySelector(".m-tabs");
    if (tabs) tabs.onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      tabs.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
      MB.querySelectorAll(".m-pane").forEach(p => p.classList.toggle("on", p.dataset.p === b.dataset.p));
    };
    if (after) after();
  }
  function closeModal() { untip(); SH.closeModal(); }
  $("#modalClose").onclick = closeModal;
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); $("#searchResults").classList.remove("open"); } });

  function compRing(v) {
    const C = 2 * Math.PI * 26, off = C * (1 - v);
    return `<svg class="score-ring" viewBox="0 0 64 64" aria-label="Completude ${pct(v)}"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--surface-2)" stroke-width="6"/>
      <circle class="ring-arc" cx="32" cy="32" r="26" fill="none" stroke="${cssv("--lime")}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" style="--c:${C}" transform="rotate(-90 32 32)"/>
      <text x="32" y="37" text-anchor="middle" fill="var(--ink)" style="font:600 15px var(--font-h)">${Math.round(v * 100)}</text></svg>`;
  }

  function openFicha(id, tab) {
    const r = BY_ID.get(id); if (!r) return;
    const val = (v, f) => (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length))
      ? `<span class="miss">não informado</span>` : (f ? f(v) : esc(v));
    const kv = rows => `<div class="kv">${rows.map(([k, v]) => `<div>${esc(k)}</div><div>${v}</div>`).join("")}</div>`;
    const grp = (t, ico, body) => `<div class="fc"><div class="fc-h"><i data-ico="${ico}"></i>${esc(t)}</div>${body}</div>`;
    const fatos = r.tabelas.filter(t => t.p === "fato"), dims = r.tabelas.filter(t => t.p === "dimensão"), outras = r.tabelas.filter(t => t.p !== "fato" && t.p !== "dimensão");
    const tblBlock = t => `<details class="tbl-block"><summary><span class="tag ${t.p === "fato" ? "fato" : ""}">${esc(t.p)}</span><b>${esc(t.t)}</b><span class="muted small">${t.c.length} colunas</span></summary>
      <div class="cols">${t.c.map(c => `<span class="tag">${esc(c)}</span>`).join("") || '<span class="empty">sem colunas</span>'}</div></details>`;
    const maxU = d3.max(r.uso_usuarios, u => u.v) || 1;
    const json = JSON.stringify(estruturar(r), null, 2);

    openModal(`
      <div class="m-head">
        <div class="m-icon cid-icon" style="background:${sitColor(r._sit)}">${esc(r._cid.split("-")[0])}</div>
        <div style="flex:1;min-width:240px">
          <div class="crumb">ficha catalográfica / ${esc(r.ws)}</div>
          <h2>${esc(r.nome)}</h2>
          <div class="m-meta">${cidTag(r)} ${sitBadge(r._sit)} ${temaBadge(r.tema)} <span class="chip">${esc(r._modo)}</span>
            <a class="btn pbi-link" href="${esc(r.url)}" target="_blank" rel="noopener"><i data-ico="ext"></i> Abrir no Power BI</a></div>
        </div>
        ${compRing(r._comp)}
      </div>
      <div class="m-tabs">
        <button data-p="ficha" class="${tab ? "" : "on"}">Ficha</button>
        <button data-p="conteudo" class="${tab === "conteudo" ? "on" : ""}">Conteúdo (${r.n_paginas})</button>
        <button data-p="modelo">Modelo (${r.n_tabelas} tab · ${r.n_medidas} med)</button>
        <button data-p="atualizacao">Linhagem &amp; refresh</button>
        <button data-p="uso">Uso</button>
        <button data-p="json">Registro JSON</button>
      </div>
      <div class="m-pane ${tab ? "" : "on"}" data-p="ficha">
        ${r._gaps.length ? `<div class="gap-note"><b>${r._gaps.length} lacuna(s):</b> ${r._gaps.map(f => esc(f.l)).join(" · ")}</div>` : `<div class="gap-note ok">Ficha completa: todos os campos avaliados estão preenchidos.</div>`}
        <div class="fc-grid">
          ${grp("Identificação", "list", kv([["ID de catálogo", cidTag(r)], ["ID do relatório", `<code class="fk">${esc(r.id)}</code>`], ["Workspace", esc(r.ws)], ["Situação", sitBadge(r._sit)], ["Tema", temaBadge(r.tema)]]))}
          ${grp("Propriedade", "compass", kv([["Owner técnico", val(r.owner)], ["Admins do workspace", val(r.admins)]]))}
          ${grp("Conteúdo", "book", kv([["Páginas", fmt(r.n_paginas)], ["Finalidade", val(r.finalidade)]]))}
          ${grp("Modelo semântico", "tree", kv([["Modelo", val(r.dataset)], ["Modo", r.modo ? esc(r._modo) : val(null)], ["Tabelas", `${fmt(r.n_tabelas)} <span class="muted small">(${fatos.length} fato · ${dims.length} dim)</span>`],
            ["Medidas", r.n_medidas ? `${fmt(r.n_medidas)} <span class="muted small">· ${fmt(r.medidas_sem_desc)} sem descrição</span>` : "0"], ["Relacionamentos", fmt(r.relacoes_modelo.length)]]))}
          ${grp("Linhagem & atualização", "download", kv([["Fontes", val(r.fontes, v => v.map(esc).join("<br>"))], ["Último refresh", val(r.ult_refresh)], ["Status", esc(r._status)],
            ["Agenda", r.agenda_ativa === null ? val(null) : r.agenda_ativa ? "ativa" : "desativada"]]))}
          ${grp("Uso & ciclo de vida", "check", kv([["Views registradas", r.views === null ? `<span class="miss">sem telemetria</span>` : fmt(r.views)], ["Usuários", r.viewers === null ? "—" : fmt(r.viewers)],
            ["Última visualização", val(r.ult_vis, SH.br)], ["Período de uso", val(r.periodo_uso, v => esc(v.replace(/(\d{4})-(\d{2})-(\d{2})/g, "$3/$2/$1")))],
            ["Telemetria até", r.uso_ate ? `${SH.br(r.uso_ate)}${r.tel_congelada ? ' <span class="miss">congelada</span>' : ""}` : "—"],
            ["Criado em", val(r.criado, SH.br)], ["Idade", r.idade_dias === null ? "—" : `${fmt(r.idade_dias)} dias`]]))}
        </div>
      </div>
      <div class="m-pane ${tab === "conteudo" ? "on" : ""}" data-p="conteudo">
        <div class="m-sec"><h4>Finalidade</h4><p style="margin:0">${val(r.finalidade)}</p></div>
        <div class="m-sec"><h4>Páginas (${r.paginas.length})</h4>
          <ol class="pages">${r.paginas.map(p => `<li class="${PAG_GENERICA.test(p) ? "generic" : ""}"><span>${esc(p)}</span></li>`).join("") || '<span class="empty">sem páginas</span>'}</ol></div>
      </div>
      <div class="m-pane" data-p="modelo">
        <div class="m-grid">
          <div class="m-stat"><div class="v">${fmt(fatos.length)}</div><div class="l">tabelas fato</div></div>
          <div class="m-stat"><div class="v">${fmt(dims.length)}</div><div class="l">dimensões</div></div>
          <div class="m-stat"><div class="v">${fmt(r.n_medidas)}</div><div class="l">medidas</div></div>
          <div class="m-stat"><div class="v">${fmt(r.relacoes_modelo.length)}</div><div class="l">relacionamentos</div></div>
        </div>
        <div class="m-sec"><h4>Tabelas e colunas</h4>${[...fatos, ...dims, ...outras].map(tblBlock).join("") || '<span class="empty">Sem tabelas catalogadas.</span>'}</div>
        <div class="m-sec"><h4>Medidas (${r.medidas.length})</h4><div class="t-tabs">${r.medidas.slice(0, 160).map(m => `<span class="tag" title="${esc(m.t)}${m.d ? " — " + esc(m.d) : " — sem descrição"}" style="${m.d ? "border-color:var(--border-strong);color:var(--ink)" : ""}">${esc(m.m)}</span>`).join("") || '<span class="empty">Sem medidas.</span>'}
          ${r.medidas.length > 160 ? `<span class="tag">+${r.medidas.length - 160}</span>` : ""}</div><p class="muted small">Medidas com borda destacada têm descrição.</p></div>
        ${r.relacoes_modelo.length ? `<div class="m-sec"><h4>Relacionamentos</h4><div class="rels">${r.relacoes_modelo.slice(0, 40).map(x => `<div><code class="fk">${esc(x[0])}[${esc(x[1])}]</code><span class="muted">→</span><code class="fk">${esc(x[2])}[${esc(x[3])}]</code></div>`).join("")}</div></div>` : ""}
      </div>
      <div class="m-pane" data-p="atualizacao">
        <div class="m-sec"><h4>Fontes de dados (${r.fontes.length})</h4>${r.fontes.length ? `<ul class="src">${r.fontes.map(f => `<li><code class="fk">${esc(f)}</code></li>`).join("")}</ul>` : '<span class="empty">Nenhuma fonte retornada pela API.</span>'}</div>
        <div class="m-sec"><h4>Agenda</h4>${kv([["Situação", r.agenda_ativa === null ? val(null) : r.agenda_ativa ? "ativa" : "desativada"],
          ["Dias", Array.isArray(r.refresh_dias) ? r.refresh_dias.map(d => ({ Sunday: "dom", Monday: "seg", Tuesday: "ter", Wednesday: "qua", Thursday: "qui", Friday: "sex", Saturday: "sáb" }[d] || d)).join(", ") : val(r.refresh_dias)],
          ["Horários", Array.isArray(r.refresh_hor) ? r.refresh_hor.join(", ") : val(r.refresh_hor)], ["Último sucesso", val(r.ult_refresh)], ["Dias desde o refresh", r.dias_refresh === null ? "—" : fmt(r.dias_refresh)], ["Falhas (últimos 10)", fmt(r.falhas10)]])}</div>
        <div class="m-sec"><h4>Histórico recente</h4>${r.hist_refresh.length ? `<div class="hist">${r.hist_refresh.map(h => `<span class="hs ${h.s === "Completed" ? "ok" : h.s === "Failed" ? "fail" : ""}" title="${esc(h.i || "")} · ${esc(STATUS(h.s))}">${h.s === "Completed" ? "✓" : h.s === "Failed" ? "✕" : "•"}</span>`).join("")}</div>` : '<span class="empty">Sem histórico de refresh.</span>'}</div>
      </div>
      <div class="m-pane" data-p="uso">
        <div class="m-grid">
          <div class="m-stat"><div class="v">${r.views === null ? "—" : fmt(r.views)}</div><div class="l">aberturas do relatório</div></div>
          <div class="m-stat"><div class="v">${r.page_views == null ? "—" : fmt(r.page_views)}</div><div class="l">visualizações de página</div></div>
          <div class="m-stat"><div class="v">${r.viewers === null ? "—" : fmt(r.viewers)}</div><div class="l">usuários</div></div>
          <div class="m-stat"><div class="v">${SH.br(r.ult_vis)}</div><div class="l">última visualização</div></div>
          <div class="m-stat"><div class="v">${SH.br(r.uso_ate)}</div><div class="l">telemetria disponível até</div></div>
        </div>
        ${r.tel_congelada ? `<div class="tel-alerta"><b>Telemetria congelada desde ${SH.br(r.uso_ate)}.</b> O refresh do modelo <i>Usage Metrics Report</i> deste workspace foi desativado pelo Power BI:
          views depois dessa data não foram capturadas. Rode a extração com <code>--atualizar-uso</code> para trazer o uso até hoje.</div>` : ""}
        ${SH.usoFaixa(r, D.resumo.extracao_em)}
        ${r.views === null ? "" :
          `<div class="m-sec"><h4>Quem usa · views de ${SH.br(r.tel_desde)} a ${SH.br(r.uso_ate)}</h4>${r.uso_usuarios.map(u => `<div class="urow"><span title="${esc(u.u)}">${esc(u.u.split("@")[0])}<small class="muted mono" style="display:block;font-size:10px">última ${SH.br(u.d)}</small></span><span class="fb-t"><span style="width:${u.v / maxU * 100}%;background:${cssv("--lime")}"></span></span><b>${fmt(u.v)}</b></div>`).join("") || '<span class="empty">Nenhuma visualização registrada.</span>'}</div>`}
      </div>
      <div class="m-pane" data-p="json">
        <div class="row gap" style="margin-bottom:10px"><span class="muted small">Registro da ficha no formato exportado (mesmo esquema do Dicionário de campos).</span>
          <button class="btn" id="copyJson" style="margin-left:auto">Copiar</button></div>
        <pre class="json">${esc(json)}</pre>
      </div>`, () => {
      const c = $("#copyJson");
      if (c) c.onclick = () => { try { navigator.clipboard.writeText(json).then(() => { c.textContent = "Copiado ✓"; }); } catch (e) { c.textContent = "Copie manualmente"; } };
    });
  }

  // ==================================================================
  // BUSCA
  // ==================================================================
  let srSel = 0, srItems = [];
  const SR = $("#searchResults");
  $("#globalSearch").addEventListener("input", e => {
    const q = normTxt(e.target.value.trim());
    if (q.length < 2) { SR.classList.remove("open"); return; }
    srItems = R.filter(r => normTxt([r._cid, r.nome, r.ws, r.owner, r.dataset].join(" ")).includes(q))
      .sort((a, b) => (normTxt(a.nome).startsWith(q) ? -1 : 0) - (normTxt(b.nome).startsWith(q) ? -1 : 0)).slice(0, 24);
    srSel = 0;
    SR.innerHTML = srItems.length ? srItems.map((r, i) => `<div class="sr ${i === 0 ? "sel" : ""}" data-i="${i}"><span class="sr-type">${esc(r._cid)}</span><span>${esc(r.nome)}</span><small>${esc(r.ws)}</small></div>`).join("")
      : '<div class="sr"><span class="muted">Nada encontrado</span></div>';
    SR.classList.add("open");
  });
  $("#globalSearch").addEventListener("keydown", e => {
    if (!SR.classList.contains("open") || !srItems.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); srSel = (srSel + (e.key === "ArrowDown" ? 1 : -1) + srItems.length) % srItems.length;
      SR.querySelectorAll(".sr").forEach((el, i) => el.classList.toggle("sel", i === srSel));
    } else if (e.key === "Enter") { openFicha(srItems[srSel].id); SR.classList.remove("open"); }
  });
  SR.addEventListener("click", e => { const it = e.target.closest(".sr[data-i]"); if (it) { openFicha(srItems[+it.dataset.i].id); SR.classList.remove("open"); } });
  document.addEventListener("click", e => { if (!e.target.closest(".search")) SR.classList.remove("open"); });

  // ==================================================================
  // INIT
  // ==================================================================
  const RENDER = {
    resumo: renderResumo,
    catalogo: () => { drawFacets(); drawCatalogo(); },
    hierarquia: renderHierarquia,
    completude: renderCompletude,
    dicionario: renderDicionario,
  };
  paintIcons();
  $("#topStatus").textContent = `extração ${D.resumo.extracao_em} · ${R.length} dashboards`;
  setupCatalogo();
  RENDER.resumo(); rendered.resumo = true;
  const h0 = location.hash.replace("#", "");
  if (VIEWS[h0] && h0 !== "resumo") go(h0);
  let rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => { Object.keys(rendered).forEach(k => delete rendered[k]); RENDER[current](); rendered[current] = true; }, 250);
  });
})();
