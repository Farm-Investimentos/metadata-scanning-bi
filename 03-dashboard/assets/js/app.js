/* =========================================================================
   Catálogo de BIs · Farm Analytics
   Dados: data/catalogo_data.js (gerado por 02-processamento/gerar_catalogo.py)
   ========================================================================= */
(() => {
  "use strict";
  const D = window.CATALOGO;
  if (!D) {
    document.body.innerHTML = "<p style='padding:40px;font-family:sans-serif'>Arquivo <b>data/catalogo_data.js</b> não encontrado. Rode <code>02-processamento/gerar_catalogo.py</code>.</p>";
    return;
  }

  // ------------------------------------------------------------------ base
  const REP = new Map(D.relatorios.map(r => [r.id, r]));
  const ATIVOS = D.relatorios.filter(r => !r.historico && !r.sistema);
  const TAB = new Map(D.tabelas.map(t => [t.k, t]));
  const TEMAS = D.temas_ordem;
  const RECS = ["Manter", "Consolidar", "Revisar", "Arquivar"];
  const TEMA_VAR = {
    "Solicitações": "--t-solicitacoes", "Portfólio": "--t-portfolio", "Risco": "--t-risco", "Cotas": "--t-cotas",
    "Limites": "--t-limites", "PDD": "--t-pdd", "Compliance": "--t-compliance", "Cliente": "--t-cliente", "Outros": "--t-outros",
  };
  const REC_VAR = { Manter: "--r-manter", Consolidar: "--r-consolidar", Revisar: "--r-revisar", Arquivar: "--r-arquivar" };
  const TIPO_LABEL = {
    mesmo_modelo: "Mesmo modelo", duplicado: "Duplicado", nome_igual: "Mesmo nome", alta_sobreposicao: "Alta sobreposição",
    sobreposicao: "Sobreposição", relacionado: "Relacionado",
  };
  const EDGES_BY = new Map();
  D.arestas.forEach(e => {
    [e.a, e.b].forEach(id => { if (!EDGES_BY.has(id)) EDGES_BY.set(id, []); EDGES_BY.get(id).push(e); });
  });
  const degree = id => (EDGES_BY.get(id) || []).length;

  const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const temaColor = t => cssv(TEMA_VAR[t] || "--t-outros");
  const recColor = r => cssv(REC_VAR[r] || "--ink-3");
  const PAL = () => TEMAS.slice(0, 8).map(temaColor);  // ordem categórica fixa
  const nf = new Intl.NumberFormat("pt-BR");
  const fmt = v => (v === null || v === undefined || Number.isNaN(v)) ? "・" : nf.format(Math.round(v));
  const pct = v => `${Math.round(v * 100)}%`;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const normTxt = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const normKey = s => normTxt(s).replace(/[^\x00-\x7f]/g, "").replace(/[_\-\.\[\]\(\)/]+/g, " ").trim();

  // ------------------------------------------------------------------ ícones
  const ICO = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    graph: '<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7 7l3.5 9M17 7l-3.5 9M7.5 6h9"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
    overlap: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
    pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  };
  const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICO[n] || ""}</svg>`;
  const paintIcons = (root = document) => root.querySelectorAll("i[data-ico]").forEach(i => { if (!i.innerHTML) i.innerHTML = ico(i.dataset.ico); });

  // ------------------------------------------------------------------ tooltip
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
  const repTip = r => `<div class="tt-t">${esc(r.nome)}</div>` + ttRow("Workspace", esc(r.ws)) + ttRow("Tema", esc(r.tema)) +
    ttRow("Views", r.views === null ? "sem telemetria" : fmt(r.views)) + ttRow("Tabelas", fmt(r.n_tabelas)) +
    ttRow("Conexões", degree(r.id)) + (r.rec ? ttRow("Recomendação", esc(r.rec)) : "");

  const temaDesc = t => window.FTShell.temaDesc(t);
  const temaBadge = t => `<span class="tb" title="${esc(temaDesc(t))}"><span class="sw" style="background:${temaColor(t)}"></span>${esc(t)}</span>`;
  const recBadge = r => r ? `<span class="rb ${esc(r)}">${esc(r)}</span>` : "";
  const BR = s => window.FTShell.br(s);
  // aviso quando o modelo Usage Metrics do workspace parou de atualizar
  const usoAlerta = r => r.tel_congelada ? `<div class="tel-alerta"><b>Telemetria congelada desde ${BR(r.uso_ate)}.</b> O Power BI desativou o refresh do modelo
    <i>Usage Metrics Report</i> deste workspace: visualizações depois dessa data não foram capturadas, então a última visualização real pode ser mais recente.
    Para trazer o uso até hoje, rode a extração com <code>--atualizar-uso</code> (ou abra o relatório de uso do workspace no Power BI).</div>` : "";
  const mbar = (v, max, color, label) => `<div class="mbar"><div class="track"><div class="fill" style="width:${Math.max(2, (v || 0) / (max || 1) * 100)}%;background:${color}"></div></div><small>${label ?? fmt(v)}</small></div>`;

  // ------------------------------------------------------------------ navegação
  const VIEWS = {
    overview: ["VISÃO CONSOLIDADA", "Catálogo de relatórios Power BI"],
    graph: ["RELAÇÕES", "Grafo de relatórios"],
    themes: ["ARQUITETURA-ALVO", "Temas & clusters"],
    tables: ["MODELO DE DADOS", "Tabelas & colunas"],
    overlap: ["DUPLICIDADE", "Sobreposições entre relatórios"],
    health: ["CICLO DE VIDA", "Racionalização: manter, consolidar ou arquivar"],
    catalog: ["INVENTÁRIO", "Catálogo completo"],
  };
  const rendered = {};
  let current = "overview";
  function go(view, after) {
    current = view;
    $$("#nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
    if ($("#viewKicker")) $("#viewKicker").textContent = VIEWS[view][0];
    if ($("#viewTitle")) $("#viewTitle").textContent = VIEWS[view][1];  // título é opcional no HTML
    $(".sidebar").classList.remove("open");
    try { history.replaceState(null, "", "#" + view); } catch (e) { /* file:// restrito */ }
    if (!rendered[view]) { RENDER[view](); rendered[view] = true; }
    if (after) after();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("#nav").addEventListener("click", e => { const b = e.target.closest("button"); if (b) go(b.dataset.view); });
  // menu mobile e recolher/expandir: assets/js/shell.js

  // tema claro/escuro
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("catbi-theme", t); } catch (e) { /* sem storage */ }
  }
  try { setTheme(localStorage.getItem("catbi-theme") || "dark"); } catch (e) { setTheme("dark"); }
  $("#themeToggle").addEventListener("click", () => {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
    Object.keys(rendered).forEach(k => delete rendered[k]);
    RENDER[current](); rendered[current] = true;
  });

  // ------------------------------------------------------------------ tabela genérica ordenável
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
        `<tbody>${sorted.slice(0, limit).map((r, i) => `<tr data-i="${rows.indexOf(r)}">${cols.map(c => `<td class="${c.num ? "num" : ""}">${c.render ? c.render(r) : esc(r[c.k])}</td>`).join("")}</tr>`).join("")}</tbody>`;
      if (!sorted.length) el.innerHTML += `<tbody><tr><td colspan="${cols.length}" class="empty">Nada encontrado com esses filtros.</td></tr></tbody>`;
    };
    el.onclick = e => {
      const th = e.target.closest("th");
      if (th) {
        if (state.key === th.dataset.k) state.asc = !state.asc; else { state.key = th.dataset.k; state.asc = false; }
        return draw();
      }
      if (e.target.closest("a,.tag.click")) return;
      const tr = e.target.closest("tbody tr[data-i]");
      if (tr && onClick) onClick(rows[+tr.dataset.i]);
    };
    draw();
  }

  function downloadCSV(name, header, rows) {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const txt = "﻿" + [header.map(q).join(";"), ...rows.map(r => r.map(q).join(";"))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  // ------------------------------------------------------------------ count-up
  function countUp(el, to, dur = 1100) {
    let t0 = null;
    const step = t => {
      if (t0 === null) t0 = t;
      const p = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(p >= 1 ? to : to * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ==================================================================
  // VISÃO GERAL
  // ==================================================================
  function renderOverview() {
    const R = D.resumo;
    $("#foot-extracao").textContent = R.extracao_em;
    const arq = R.recs.Arquivar || 0, cons = R.recs.Consolidar || 0;
    const kpis = [
      { l: "Relatórios analisados", v: R.n_ativos, s: `de ${R.n_relatorios} · ${R.n_historico} no BI Histórico`, c: "--lime", go: "catalog" },
      { l: "Workspaces", v: R.n_workspaces, s: `${Object.keys(R.por_ws).length} com relatórios ativos`, c: "--mint" },
      { l: "Tabelas únicas", v: R.n_tabelas, s: "excluindo calendário/medidas genéricas", c: "--t-portfolio", go: "tables" },
      { l: "Medidas DAX", v: R.n_medidas, s: `${pct(R.n_medidas_sem_desc / Math.max(1, R.n_medidas))} sem descrição`, c: "--t-cotas" },
      { l: "Consolidar", v: cons, s: `${R.n_arestas} conexões entre relatórios`, c: "--r-consolidar", go: "overlap" },
      { l: "Arquivar", v: arq, s: `${pct(arq / R.n_ativos)} do parque ativo`, c: "--r-arquivar", go: "health" },
    ];
    const K = $("#kpis");
    K.innerHTML = kpis.map((k, i) => `<div class="kpi glass ${k.go ? "clickable" : ""}" data-go="${k.go || ""}" style="--kc:var(${k.c});animation:viewIn .5s ${i * 60}ms both">
      <div class="k-label">${k.l}</div><div class="k-val" data-v="${k.v}">0</div><div class="k-sub">${k.s}</div></div>`).join("");
    K.querySelectorAll(".k-val").forEach(el => countUp(el, +el.dataset.v));
    K.onclick = e => { const k = e.target.closest(".kpi"); if (k && k.dataset.go) go(k.dataset.go); };

    const des = ATIVOS.map(r => r.tel_desde).filter(Boolean).sort(), ate = ATIVOS.map(r => r.uso_ate).filter(Boolean).sort();
    $("#periodoUso").textContent = des.length ? `views registradas pelo Usage Metrics de ${BR(des[0])} a ${BR(ate[ate.length - 1])}` +
      (R.telemetria_congelada ? ` · ${R.telemetria_congelada} relatórios com telemetria congelada` : "") : "";

    drawDonut(); drawWsBars(); drawTop(); drawInsights(); heroAnim();
  }

  function drawDonut() {
    const el = $("#donutTemas"); el.innerHTML = "";
    const data = TEMAS.map(t => ({ t, n: D.resumo.temas[t] || 0 })).filter(d => d.n > 0);
    const total = d3.sum(data, d => d.n);
    const W = el.clientWidth, size = Math.min(220, W * 0.55), R = size / 2;
    const wrap = d3.select(el).append("div").style("display", "flex").style("gap", "14px").style("align-items", "center").style("flex-wrap", "wrap");
    const svg = wrap.append("svg").attr("width", size).attr("height", size).append("g").attr("transform", `translate(${R},${R})`);
    const arc = d3.arc().innerRadius(R * 0.64).outerRadius(R - 4).cornerRadius(4).padAngle(0.02);
    const arcH = d3.arc().innerRadius(R * 0.64).outerRadius(R).cornerRadius(4).padAngle(0.02);
    const pie = d3.pie().value(d => d.n).sort(null);
    svg.selectAll("path").data(pie(data)).join("path")
      .attr("fill", d => temaColor(d.data.t)).attr("stroke", cssv("--surface-solid")).attr("stroke-width", 2).style("cursor", "pointer")
      .on("mousemove", (ev, d) => tip(ev, `<div class="tt-t">${esc(d.data.t)}</div><div class="muted small" style="margin-bottom:6px">${esc(temaDesc(d.data.t))}</div>${ttRow("Relatórios", d.data.n)}${ttRow("Participação", pct(d.data.n / total))}`))
      .on("mouseenter", function () { d3.select(this).transition().duration(200).attr("d", arcH); })
      .on("mouseleave", function () { untip(); d3.select(this).transition().duration(200).attr("d", arc); })
      .on("click", (ev, d) => openTema(d.data.t))
      .transition().duration(900).ease(d3.easeCubicOut)
      .attrTween("d", d => { const i = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d); return t => arc(i(t)); });
    svg.append("text").attr("text-anchor", "middle").attr("dy", "-0.1em").attr("fill", cssv("--ink")).style("font", `600 30px ${cssv("--font-h")}`).text(total);
    svg.append("text").attr("text-anchor", "middle").attr("dy", "1.5em").attr("fill", cssv("--ink-3")).style("font-size", "11px").text("relatórios ativos");
    const leg = wrap.append("div").style("display", "flex").style("flex-direction", "column").style("gap", "5px").style("flex", "1").style("min-width", "140px");
    data.forEach(d => leg.append("div").attr("class", "legend").attr("title", temaDesc(d.t)).style("cursor", "pointer").style("justify-content", "space-between")
      .html(`<span><span class="sw round" style="background:${temaColor(d.t)}"></span>${esc(d.t)}</span><b style="color:var(--ink)">${d.n}</b>`)
      .on("click", () => openTema(d.t)));
    // legenda "o que é cada tema"
    const L = $("#temaLegOv");
    if (L) {
      L.innerHTML = window.FTShell.temaLegenda(TEMAS, temaColor, t => `${D.resumo.temas[t] || 0} relatórios`);
      L.onclick = e => { const b = e.target.closest("[data-tema]"); if (b) openTema(b.dataset.tema); };
    }
  }

  function drawWsBars() {
    const el = $("#barWs"); el.innerHTML = "";
    $("#legRecWs").innerHTML = RECS.map(r => `<span><span class="sw" style="background:${recColor(r)}"></span>${r}</span>`).join("");
    const byWs = d3.rollups(ATIVOS, v => Object.fromEntries(RECS.map(r => [r, v.filter(x => x.rec === r).length])), d => d.ws)
      .map(([ws, c]) => ({ ws, ...c, total: d3.sum(RECS, r => c[r]) })).sort((a, b) => b.total - a.total);
    const W = el.clientWidth, rowH = 24, m = { l: 180, r: 36, t: 4, b: 20 }, H = byWs.length * rowH + m.t + m.b;
    const x = d3.scaleLinear().domain([0, d3.max(byWs, d => d.total)]).range([m.l, W - m.r]);
    const y = d3.scaleBand().domain(byWs.map(d => d.ws)).range([m.t, H - m.b]).padding(0.28);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
    svg.append("g").selectAll("line").data(x.ticks(6)).join("line").attr("x1", d => x(d)).attr("x2", d => x(d)).attr("y1", m.t).attr("y2", H - m.b)
      .attr("stroke", cssv("--grid"));
    svg.append("g").selectAll("text").data(x.ticks(6)).join("text").attr("x", d => x(d)).attr("y", H - 4).attr("text-anchor", "middle")
      .attr("fill", cssv("--ink-3")).style("font-size", "10px").text(d => d);
    const row = svg.append("g").selectAll("g").data(byWs).join("g").style("cursor", "pointer")
      .on("click", (ev, d) => go("catalog", () => { $("#catWs").value = d.ws; renderCatalogTable(); }));
    row.append("text").attr("x", m.l - 10).attr("y", d => y(d.ws) + y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end")
      .attr("fill", cssv("--ink-2")).style("font-size", "12px").text(d => d.ws.length > 26 ? d.ws.slice(0, 25) + "…" : d.ws);
    row.each(function (d) {
      let acc = 0;
      const g = d3.select(this);
      RECS.forEach((r, i) => {
        const n = d[r]; if (!n) return;
        const x0 = x(acc) + (acc ? 1 : 0), x1 = x(acc + n) - 1; acc += n;
        g.append("rect").attr("x", x0).attr("y", y(d.ws)).attr("height", y.bandwidth()).attr("rx", 3).attr("fill", recColor(r)).attr("width", 0)
          .on("mousemove", ev => tip(ev, `<div class="tt-t">${esc(d.ws)}</div>${RECS.map(k => ttRow(k, d[k])).join("")}${ttRow("Total", d.total)}`))
          .on("mouseleave", untip)
          .transition().delay(i * 120).duration(700).attr("width", Math.max(1, x1 - x0));
      });
      g.append("text").attr("x", x(d.total) + 6).attr("y", y(d.ws) + y.bandwidth() / 2).attr("dy", "0.35em").attr("fill", cssv("--ink")).style("font-size", "11.5px").style("font-weight", 600).text(d.total);
    });
  }

  function drawTop() {
    const el = $("#barTop"); el.innerHTML = "";
    const data = ATIVOS.filter(r => r.views > 0).sort((a, b) => b.views - a.views).slice(0, 12);
    const W = el.clientWidth, rowH = 26, m = { l: 230, r: 50, t: 4, b: 4 }, H = data.length * rowH + m.t + m.b;
    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.views)]).range([m.l, W - m.r]);
    const y = d3.scaleBand().domain(data.map(d => d.id)).range([m.t, H - m.b]).padding(0.3);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
    const g = svg.selectAll("g").data(data).join("g").style("cursor", "pointer").on("click", (ev, d) => openReport(d.id))
      .on("mousemove", (ev, d) => tip(ev, repTip(d) + ttRow("Usuários", fmt(d.viewers)))).on("mouseleave", untip);
    g.append("circle").attr("cx", 8).attr("cy", d => y(d.id) + y.bandwidth() / 2).attr("r", 4).attr("fill", d => temaColor(d.tema));
    g.append("text").attr("x", 18).attr("y", d => y(d.id) + y.bandwidth() / 2).attr("dy", "0.35em").attr("fill", cssv("--ink")).style("font-size", "12px")
      .text(d => (d.nome.length > 24 ? d.nome.slice(0, 23) + "…" : d.nome));
    g.append("text").attr("x", m.l - 8).attr("y", d => y(d.id) + y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", cssv("--ink-3")).style("font-size", "10.5px")
      .text(d => d.ws.replace(/^BI /, ""));
    g.append("rect").attr("x", m.l).attr("y", d => y(d.id)).attr("height", y.bandwidth()).attr("rx", 4).attr("fill", cssv("--mint")).attr("opacity", .85).attr("width", 0)
      .transition().delay((d, i) => i * 50).duration(700).attr("width", d => x(d.views) - m.l);
    g.append("text").attr("x", d => x(d.views) + 6).attr("y", d => y(d.id) + y.bandwidth() / 2).attr("dy", "0.35em").attr("fill", cssv("--ink-2")).style("font-size", "11.5px").text(d => fmt(d.views));
  }

  function drawInsights() {
    const R = D.resumo, out = [];
    const byName = d3.groups(ATIVOS, r => normTxt(r.nome).replace(/^homologacao - /, "")).filter(([, v]) => new Set(v.map(x => x.ws)).size > 1)
      .sort((a, b) => b[1].length - a[1].length);
    if (byName.length) out.push({ c: "--r-arquivar", i: "×" + byName.length, t: `<b>${byName.length} relatórios</b> existem com o mesmo nome em mais de um workspace ・ ex.: <b>${esc(byName[0][1][0].nome)}</b> em ${new Set(byName[0][1].map(x => x.ws)).size} workspaces.`, go: () => go("overlap") });
    const parados = ATIVOS.filter(r => r.dias_refresh > 180).length;
    const nunca = ATIVOS.filter(r => r.dias_refresh === null).length;
    out.push({ c: "--r-revisar", i: "⟳", t: `<b>${parados}</b> relatórios com dados parados há mais de 180 dias e <b>${nunca}</b> sem nenhum refresh bem-sucedido registrado.`, go: () => go("health") });
    const big = D.clusters[0];
    if (big) out.push({ c: "--r-consolidar", i: "◎", t: `O maior cluster junta <b>${big.n} relatórios</b> de ${big.workspaces.length} workspaces, com tema dominante <b>${esc(big.tema_dominante)}</b> ・ candidato a um único modelo.`, go: () => go("themes") });
    out.push({ c: "--t-cotas", i: "?", t: `<b>${R.sem_telemetria}</b> relatórios ativos não têm telemetria de uso (workspace sem Usage Metrics). Habilitar antes de arquivar.`, go: () => go("health", () => setRecFilter("")) });
    const fracos = D.temas.filter(t => TEMAS.indexOf(t.tema) < 8 && (t.n <= 2 || !t.fatos.length));
    fracos.forEach(t => out.push({ c: TEMA_VAR[t.tema], i: "!", t: `Tema <b>${esc(t.tema)}</b> tem só ${t.n} relatório(s)${t.fatos.length ? "" : " e nenhuma tabela-fato própria"} ・ lacuna para a nova arquitetura.`, go: () => openTema(t.tema) }));
    out.push({ c: "--t-portfolio", i: "Σ", t: `<b>${pct(R.n_medidas_sem_desc / Math.max(1, R.n_medidas))}</b> das ${fmt(R.n_medidas)} medidas não têm descrição ・ documentar ao consolidar.`, go: () => go("catalog") });
    const ul = $("#insights");
    ul.innerHTML = out.slice(0, 6).map((o, i) => `<li data-i="${i}" style="animation:viewIn .5s ${i * 80}ms both"><span class="ii" style="background:color-mix(in srgb, var(${o.c}) 20%, transparent);color:var(${o.c})">${o.i}</span><span class="it">${o.t}</span></li>`).join("");
    ul.onclick = e => { const li = e.target.closest("li"); if (li) out[+li.dataset.i].go(); };
  }

  let heroRAF = null;
  function heroAnim() {
    const cv = $("#heroCanvas"); if (!cv) return;
    cancelAnimationFrame(heroRAF);
    const ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
    const resize = () => { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; };
    resize();
    const cols = TEMAS.slice(0, 8).map(temaColor), lime = cssv("--lime");
    const P = d3.range(46).map(i => ({
      x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .0012, vy: (Math.random() - .5) * .0012,
      r: 1.5 + Math.random() * 3.5, c: i % 3 === 0 ? cols[i % 8] : lime,
    }));
    const frame = () => {
      if (current !== "overview") { heroRAF = requestAnimationFrame(frame); return; }
      if (cv.width !== cv.clientWidth * dpr) resize();
      const w = cv.width, h = cv.height;
      ctx.clearRect(0, 0, w, h);
      P.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > 1) p.vx *= -1; if (p.y < 0 || p.y > 1) p.vy *= -1; });
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const a = P[i], b = P[j], dx = (a.x - b.x) * w, dy = (a.y - b.y) * h, d = Math.hypot(dx, dy), lim = 110 * dpr;
        if (d < lim) { ctx.strokeStyle = lime; ctx.globalAlpha = (1 - d / lim) * .35; ctx.lineWidth = dpr; ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke(); }
      }
      P.forEach(p => { ctx.globalAlpha = .9; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, p.r * dpr, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
      heroRAF = requestAnimationFrame(frame);
    };
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) frame();
  }

  // ==================================================================
  // GRAFO DE RELATÓRIOS
  // ==================================================================
  const G = { colorBy: "tema", layout: "tema", sim: 0.25, ws: "", hideNP: false, hideIso: false, hidden: new Set(), pos: new Map(), focus: null };
  const clusterRank = new Map(D.clusters.filter(c => c.n > 1).map((c, i) => [c.id, i]));
  const wsRank = new Map(Object.entries(D.resumo.por_ws).sort((a, b) => b[1] - a[1]).map(([w], i) => [w, i]));

  function catOf(r) {
    switch (G.colorBy) {
      case "tema": return r.tema;
      case "rec": return r.rec;
      case "cluster": { const k = clusterRank.get(r.cluster); return k === undefined ? "Isolado" : k < 8 ? `Cluster ${r.cluster}` : "Outros clusters"; }
      case "ws": { const k = wsRank.get(r.ws); return k < 8 ? r.ws : "Outros workspaces"; }
    }
  }
  function catColor(cat) {
    const pal = PAL();
    switch (G.colorBy) {
      case "tema": return temaColor(cat);
      case "rec": return recColor(cat);
      case "cluster": { const m = /^Cluster (\d+)$/.exec(cat); return m ? pal[clusterRank.get(+m[1])] : cat === "Isolado" ? cssv("--ink-3") : cssv("--t-outros"); }
      case "ws": { const k = wsRank.get(cat); return k !== undefined && k < 8 ? pal[k] : cssv("--t-outros"); }
    }
  }
  function catOrder() {
    switch (G.colorBy) {
      case "tema": return TEMAS;
      case "rec": return RECS;
      case "cluster": return [...[...clusterRank.keys()].slice(0, 8).map(c => `Cluster ${c}`), "Outros clusters", "Isolado"];
      case "ws": return [...[...wsRank.keys()].slice(0, 8), "Outros workspaces"];
    }
  }

  function setupGraphControls() {
    const seg = (sel, key, cb) => $(sel).addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      $$(sel + " button").forEach(x => x.classList.toggle("on", x === b));
      G[key] = b.dataset.v; if (key === "colorBy") G.hidden.clear(); cb && cb(); renderGraph();
    });
    seg("#colorBy", "colorBy"); seg("#layoutBy", "layout");
    $("#simMin").addEventListener("input", e => { G.sim = +e.target.value; $("#simVal").textContent = G.sim.toFixed(2); renderGraph(); });
    const sel = $("#wsFilter");
    Object.keys(D.resumo.por_ws).sort().forEach(w => sel.insertAdjacentHTML("beforeend", `<option>${esc(w)}</option>`));
    sel.addEventListener("change", e => { G.ws = e.target.value; renderGraph(); });
    $("#hideNP").addEventListener("change", e => { G.hideNP = e.target.checked; renderGraph(); });
    $("#hideIso").addEventListener("change", e => { G.hideIso = e.target.checked; renderGraph(); });
  }

  let graphSim = null;
  function renderGraph() {
    const svgEl = $("#graphSvg");
    const box = svgEl.parentNode.getBoundingClientRect(), W = box.width || 900, H = box.height || 600;
    if (graphSim) graphSim.stop();
    const svg = d3.select(svgEl); svg.selectAll("*").remove();

    let nodes = ATIVOS.filter(r => (!G.ws || r.ws === G.ws) && (!G.hideNP || !r.nao_produtivo) && !G.hidden.has(catOf(r)))
      .map(r => {
        const p = G.pos.get(r.id) || {};
        return { id: r.id, r: 5 + Math.min(17, Math.sqrt(r.views || 0) * 1.25), rep: r, x: p.x, y: p.y };
      });
    const ids = new Set(nodes.map(n => n.id));
    const links = D.arestas.filter(e => e.s >= G.sim && ids.has(e.a) && ids.has(e.b)).map(e => ({ source: e.a, target: e.b, e, s: e.s }));
    const deg = new Map(); links.forEach(l => { deg.set(l.source, (deg.get(l.source) || 0) + 1); deg.set(l.target, (deg.get(l.target) || 0) + 1); });
    if (G.hideIso) nodes = nodes.filter(n => deg.get(n.id));

    // centros por tema
    const temasPres = TEMAS.filter(t => nodes.some(n => n.rep.tema === t));
    const centers = new Map(temasPres.map((t, i) => {
      const a = (i / temasPres.length) * Math.PI * 2 - Math.PI / 2;
      const cx = W / 2 + 90, rx = (W - 260) * 0.38, ry = H * 0.33;
      return [t, { x: cx + Math.cos(a) * rx, y: H / 2 + 10 + Math.sin(a) * ry }];
    }));
    const byTema = G.layout === "tema";
    nodes.forEach((n, i) => {
      if (n.x !== undefined && n.x > 0 && n.x < W) return;
      const c = byTema ? centers.get(n.rep.tema) : { x: W / 2, y: H / 2 };
      const a = i * 2.39996, d = 8 + Math.sqrt(i) * (byTema ? 6 : 14);
      n.x = c.x + Math.cos(a) * d; n.y = c.y + Math.sin(a) * d;
    });

    const root = svg.append("g");
    const zoom = d3.zoom().scaleExtent([0.3, 5]).on("zoom", ev => {
      root.attr("transform", ev.transform);
      root.classed("zoomed", ev.transform.k > 1.4);
      labels.style("opacity", d => (ev.transform.k > 1.4 || d.important) ? 1 : 0);
    });
    svg.call(zoom).on("dblclick.zoom", null);

    const hullG = root.append("g");
    const linkG = root.append("g");
    const nodeG = root.append("g");

    const lk = linkG.selectAll("line").data(links).join("line").attr("class", "link")
      .attr("stroke", d => d.e.tipo === "mesmo_modelo" ? cssv("--lime") : d.e.tipo === "duplicado" ? cssv("--r-arquivar") : d.s >= 0.5 ? cssv("--ink-2") : cssv("--ink-3"))
      .attr("stroke-width", d => d.e.tipo === "mesmo_modelo" || d.e.tipo === "duplicado" ? 2.4 : 0.6 + d.s * 2.4)
      .attr("stroke-dasharray", d => d.e.tipo === "duplicado" ? "5 4" : null)
      .attr("opacity", d => 0.25 + d.s * 0.6);

    nodes.forEach(n => { n.important = (n.rep.views || 0) >= 30 || (deg.get(n.id) || 0) >= 6; });
    const nd = nodeG.selectAll("g").data(nodes, d => d.id).join("g").attr("class", d => "node" + (d.rep.nao_produtivo ? " np" : ""))
      .style("cursor", "pointer");
    nd.append("circle").attr("class", "halo").attr("r", d => d.r + 5).attr("stroke", d => catColor(catOf(d.rep)));
    nd.append("circle").attr("class", "pop").attr("r", d => d.r).attr("fill", d => catColor(catOf(d.rep)))
      .style("animation-delay", (d, i) => `${i * 6}ms`);
    const labels = nd.append("text").attr("dy", d => d.r + 12).attr("text-anchor", "middle").text(d => d.rep.nome.length > 28 ? d.rep.nome.slice(0, 27) + "…" : d.rep.nome)
      .style("opacity", d => d.important ? 1 : 0);

    const nb = new Map(nodes.map(n => [n.id, new Set([n.id])]));
    links.forEach(l => { const a = l.source.id || l.source, b = l.target.id || l.target; nb.get(a)?.add(b); nb.get(b)?.add(a); });
    const highlight = id => {
      const s = nb.get(id);
      nd.classed("dim", d => id && !s.has(d.id)).classed("focus", d => d.id === id);
      nd.select("text").style("opacity", d => (id && s.has(d.id)) || d.important ? 1 : 0);
      lk.classed("dim", d => id && d.source.id !== id && d.target.id !== id);
    };
    nd.on("mouseenter", (ev, d) => highlight(d.id))
      .on("mousemove", (ev, d) => tip(ev, repTip(d.rep)))
      .on("mouseleave", () => { untip(); highlight(G.focus); })
      .on("click", (ev, d) => { untip(); openReport(d.id); });
    lk.on("mousemove", (ev, d) => tip(ev, `<div class="tt-t">${esc(REP.get(d.e.a).nome)} ↔ ${esc(REP.get(d.e.b).nome)}</div>${ttRow("Tipo", TIPO_LABEL[d.e.tipo])}${ttRow("Similaridade", d.s.toFixed(2))}${ttRow("Tabelas em comum", d.e.n_tab_comuns)}`))
      .on("mouseleave", untip).on("click", (ev, d) => openPair(d.e)).style("cursor", "pointer");

    nd.call(d3.drag()
      .on("start", (ev, d) => { if (!ev.active) graphSim.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
      .on("end", (ev, d) => { if (!ev.active) graphSim.alphaTarget(0); d.fx = null; d.fy = null; }));

    graphSim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(l => 30 + (1 - l.s) * 90).strength(l => byTema ? (l.source.rep.tema === l.target.rep.tema ? l.s * 0.3 : 0.004) : l.s * 0.8))
      .force("charge", d3.forceManyBody().strength(byTema ? -45 : -70))
      .force("collide", d3.forceCollide(d => d.r + 3))
      .force("x", d3.forceX(d => byTema ? centers.get(d.rep.tema).x : W / 2).strength(byTema ? 0.22 : 0.05))
      .force("y", d3.forceY(d => byTema ? centers.get(d.rep.tema).y : H / 2).strength(byTema ? 0.22 : 0.05))
      .stop();
    for (let i = 0; i < 160; i++) graphSim.tick();
    graphSim.on("tick", tick).alpha(0.15).restart();

    const line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.7));
    function tick() {
      lk.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      nd.attr("transform", d => `translate(${d.x},${d.y})`);
      if (byTema) {
        const groups = d3.groups(nodes, d => d.rep.tema).map(([t, ns]) => {
          const pts = []; ns.forEach(n => { const p = n.r + 16; pts.push([n.x - p, n.y], [n.x + p, n.y], [n.x, n.y - p], [n.x, n.y + p]); });
          return { t, hull: d3.polygonHull(pts) };
        });
        hullG.selectAll("path").data(groups, d => d.t).join("path").attr("class", "hull")
          .attr("d", d => line(d.hull)).attr("fill", d => temaColor(d.t)).attr("stroke", d => temaColor(d.t));
        hullG.selectAll("text").data(groups, d => d.t).join("text").attr("class", "hull-label")
          .attr("x", d => d3.mean(d.hull, p => p[0])).attr("y", d => d3.min(d.hull, p => p[1]) - 8)
          .attr("fill", d => temaColor(d.t)).text(d => d.t);
      }
      nodes.forEach(n => G.pos.set(n.id, { x: n.x, y: n.y }));
    }

    // legenda
    const order = catOrder();
    const present = new Set(ATIVOS.map(catOf));
    const counts = d3.rollup(nodes, v => v.length, d => catOf(d.rep));
    $("#graphLegend").innerHTML = `<div class="kicker" style="margin-bottom:4px">${{ tema: "Tema", rec: "Recomendação", cluster: "Cluster", ws: "Workspace" }[G.colorBy]}</div>` +
      order.filter(c => present.has(c)).map(c => `<div class="lg ${G.hidden.has(c) ? "off" : ""}" data-c="${esc(c)}"${G.colorBy === "tema" ? ` title="${esc(temaDesc(c))}"` : ""}><span class="sw round" style="background:${catColor(c)}"></span>${esc(c)} <span class="muted">${counts.get(c) || 0}</span></div>`).join("") +
      `<div class="muted small" style="margin-top:6px">clique para ocultar/mostrar<br>tracejado = teste/homolog.</div>`;
    $("#graphLegend").onclick = e => { const l = e.target.closest(".lg"); if (!l) return; const c = l.dataset.c; G.hidden.has(c) ? G.hidden.delete(c) : G.hidden.add(c); renderGraph(); };
    $("#graphStats").innerHTML = `<b>${nodes.length}</b> relatórios · <b>${links.length}</b> conexões`;

    G.zoomTo = id => {
      const n = nodes.find(x => x.id === id); if (!n) return;
      G.focus = id;
      setTimeout(() => {
        svg.transition().duration(900).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(1.8).translate(-n.x, -n.y));
        highlight(id);
        const ring = root.append("circle").attr("cx", n.x).attr("cy", n.y).attr("r", 6).attr("fill", "none").attr("stroke", cssv("--lime")).attr("stroke-width", 2);
        let k = 0; const pulse = () => { if (k++ > 3) return ring.remove(); ring.attr("r", n.r).attr("opacity", 1).transition().duration(900).attr("r", n.r + 30).attr("opacity", 0).on("end", pulse); }; pulse();
      }, 900);
    };
    svg.on("click", ev => { if (ev.target === svgEl) { G.focus = null; highlight(null); } });
  }
  function focusInGraph(id) {
    const r = REP.get(id);
    G.ws = ""; $("#wsFilter").value = ""; G.hidden.clear();
    if (r.nao_produtivo) { G.hideNP = false; $("#hideNP").checked = false; }
    if (!D.arestas.some(e => (e.a === id || e.b === id) && e.s >= G.sim)) { G.hideIso = false; $("#hideIso").checked = false; }
    closeModal();
    go("graph", () => { renderGraph(); G.zoomTo(id); });
  }

  // ==================================================================
  // TEMAS & CLUSTERS
  // ==================================================================
  function renderThemes() {
    $("#themeCards").innerHTML = D.temas.map((t, i) => {
      const recs = RECS.map(r => [r, t.recs[r] || 0]).filter(x => x[1]);
      const tot = d3.sum(recs, x => x[1]) || 1;
      const fatos = t.fatos.slice(0, 4).map(f => `<span class="tag fato" title="${esc(f.nome)} · ${f.n_reps} relatórios">${esc(f.nome)}</span>`).join("");
      const dims = t.dims.slice(0, 3).map(f => `<span class="tag" title="${esc(f.nome)}">${esc(f.nome)}</span>`).join("");
      const gap = t.tema !== "Outros" && (!t.fatos.length || t.n <= 2) ? `<div class="t-gap">⚠ ${!t.fatos.length ? "Sem tabela-fato própria" : "Pouca cobertura"} ・ lacuna para o modelo-alvo</div>` : "";
      return `<div class="tcard glass" data-t="${esc(t.tema)}" style="--tc:${temaColor(t.tema)};animation:viewIn .5s ${i * 50}ms both">
        <div class="t-top"><span class="t-dot"></span><h4>${esc(t.tema)}</h4><span class="t-n">${t.n}</span></div>
        <div class="t-sub">${Object.keys(t.ws).length} workspaces · ${fmt(t.views)} views</div>
        <div class="t-desc">${esc(temaDesc(t.tema))}</div>
        <div class="stackbar" title="${recs.map(([r, n]) => `${r}: ${n}`).join(" · ")}">${recs.map(([r, n]) => `<span style="width:${n / tot * 100}%;background:${recColor(r)}"></span>`).join("")}</div>
        <div class="kicker" style="margin-bottom:6px">Tabelas-chave candidatas</div>
        <div class="t-tabs">${fatos || '<span class="empty">nenhuma tabela-fato</span>'}${dims}</div>${gap}</div>`;
    }).join("");
    $("#themeCards").onclick = e => { const c = e.target.closest(".tcard"); if (c) openTema(c.dataset.t); };

    const cl = D.clusters.filter(c => c.n > 1);
    $("#clusterList").innerHTML = cl.map(c => `<div class="cl" style="--tc:${temaColor(c.tema_dominante)}">
      <div class="cl-h"><b>Cluster ${c.id}</b>${temaBadge(c.tema_dominante)}<span class="muted small" style="margin-left:auto">${c.n} relatórios · ${fmt(c.views)} views</span></div>
      <div class="muted small">${c.workspaces.map(esc).join(" · ")}</div>
      <div class="cl-members">${c.membros.map(id => { const r = REP.get(id); return `<span class="tag click" data-id="${id}" title="${esc(r.ws)} · ${esc(r.rec)}" style="border-left:3px solid ${recColor(r.rec)}">${esc(r.nome)}</span>`; }).join("")}</div>
      ${c.tabelas_top.length ? `<div class="kicker" style="margin:6px 0 4px">Tabelas em comum</div><div class="t-tabs">${c.tabelas_top.slice(0, 6).map(([t, n]) => `<span class="tag click" data-tab="${esc(t)}">${esc(TAB.get(t)?.nome || t)} · ${n}</span>`).join("")}</div>` : ""}
      <div style="margin-top:10px"><button class="btn" data-cl="${c.id}">Ver no grafo</button></div></div>`).join("");
    $("#clusterList").onclick = e => {
      const t = e.target.closest("[data-id]"); if (t) return openReport(t.dataset.id);
      const tb = e.target.closest("[data-tab]"); if (tb) return openTable(tb.dataset.tab);
      const b = e.target.closest("[data-cl]");
      if (b) {
        const id = +b.dataset.cl;
        G.colorBy = "cluster"; G.layout = "livre"; G.hidden.clear(); G.ws = "";
        $$("#colorBy button").forEach(x => x.classList.toggle("on", x.dataset.v === "cluster"));
        $$("#layoutBy button").forEach(x => x.classList.toggle("on", x.dataset.v === "livre"));
        const keep = clusterRank.get(id) < 8 ? `Cluster ${id}` : "Outros clusters";
        catOrder().forEach(c => { if (c !== keep) G.hidden.add(c); });
        go("graph", () => renderGraph());
      }
    };
  }

  // ==================================================================
  // TABELAS
  // ==================================================================
  const TB = { edge: "co_uso", min: 2, tema: "" };
  function setupTableControls() {
    $("#tabEdge").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      $$("#tabEdge button").forEach(x => x.classList.toggle("on", x === b)); TB.edge = b.dataset.v; renderTabGraph();
    });
    $("#tabMin").addEventListener("input", e => { TB.min = +e.target.value; $("#tabMinVal").textContent = TB.min; renderTabGraph(); renderTabList(); });
    TEMAS.forEach(t => $("#tabTema").insertAdjacentHTML("beforeend", `<option>${esc(t)}</option>`));
    $("#tabTema").addEventListener("change", e => { TB.tema = e.target.value; renderTabGraph(); renderTabList(); });
    $("#tabSearch").addEventListener("input", renderTabList);
  }
  function renderTables() { renderTabGraph(); renderTabList(); renderColTop(); }

  let tabSim = null;
  function renderTabGraph() {
    const svgEl = $("#tabSvg"), box = svgEl.parentNode.getBoundingClientRect(), W = box.width || 800, H = box.height || 600;
    if (tabSim) tabSim.stop();
    const svg = d3.select(svgEl); svg.selectAll("*").remove();
    const nodes = D.tabelas.filter(t => t.n_reps >= TB.min && (!TB.tema || t.tema === TB.tema)).map(t => ({ id: t.k, t, r: 4 + Math.sqrt(t.n_reps) * 3.2 }));
    const ids = new Set(nodes.map(n => n.id));
    const links = D.tab_arestas.filter(e => e.tipo === TB.edge && ids.has(e.a) && ids.has(e.b)).map(e => ({ source: e.a, target: e.b, e }));
    const maxS = d3.max(links, l => l.e.s) || 1;
    const root = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.3, 5]).on("zoom", ev => { root.attr("transform", ev.transform); txt.style("opacity", d => ev.transform.k > 1.5 || d.t.n_reps >= 5 ? 1 : 0); }));
    const lk = root.append("g").selectAll("line").data(links).join("line").attr("class", "link")
      .attr("stroke", TB.edge === "colunas" ? cssv("--r-revisar") : cssv("--ink-3"))
      .attr("stroke-width", d => TB.edge === "colunas" ? 1 + d.e.s * 3 : 0.5 + d.e.s / maxS * 3).attr("opacity", .5);
    const nd = root.append("g").selectAll("g").data(nodes).join("g").attr("class", "node").style("cursor", "pointer");
    nd.append("circle").attr("r", d => d.r).attr("fill", d => d.t.papel === "dimensão" ? cssv("--surface-solid") : temaColor(d.t.tema))
      .attr("stroke", d => temaColor(d.t.tema)).attr("stroke-width", d => d.t.papel === "dimensão" ? 2.5 : 2);
    const txt = nd.append("text").attr("dy", d => d.r + 11).attr("text-anchor", "middle").text(d => d.t.nome.length > 26 ? d.t.nome.slice(0, 25) + "…" : d.t.nome)
      .style("opacity", d => d.t.n_reps >= 5 ? 1 : 0);
    const nb = new Map(nodes.map(n => [n.id, new Set([n.id])]));
    links.forEach(l => { nb.get(l.source)?.add(l.target); nb.get(l.target)?.add(l.source); });
    nd.on("mouseenter", (ev, d) => { const s = nb.get(d.id); nd.classed("dim", x => !s.has(x.id)); txt.style("opacity", x => s.has(x.id) ? 1 : 0); lk.classed("dim", l => l.source.id !== d.id && l.target.id !== d.id); })
      .on("mousemove", (ev, d) => tip(ev, `<div class="tt-t">${esc(d.t.nome)}</div>${ttRow("Papel", d.t.papel)}${ttRow("Tema", d.t.tema)}${ttRow("Relatórios", d.t.n_reps)}${ttRow("Workspaces", d.t.ws.length)}${ttRow("Colunas", d.t.n_cols)}`))
      .on("mouseleave", () => { untip(); nd.classed("dim", false); lk.classed("dim", false); txt.style("opacity", d => d.t.n_reps >= 5 ? 1 : 0); })
      .on("click", (ev, d) => { untip(); openTable(d.id); });
    lk.on("mousemove", (ev, d) => tip(ev, `<div class="tt-t">${esc(TAB.get(d.e.a).nome)} ↔ ${esc(TAB.get(d.e.b).nome)}</div>${TB.edge === "colunas" ? ttRow("Colunas em comum", d.e.n) + ttRow("Jaccard", d.e.s.toFixed(2)) : ttRow("Usadas juntas em", d.e.n + " relatórios")}`)).on("mouseleave", untip);
    nd.call(d3.drag().on("start", (ev, d) => { if (!ev.active) tabSim.alphaTarget(.25).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; }).on("end", (ev, d) => { if (!ev.active) tabSim.alphaTarget(0); d.fx = d.fy = null; }));
    tabSim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(50).strength(.25))
      .force("charge", d3.forceManyBody().strength(-55))
      .force("collide", d3.forceCollide(d => d.r + 4))
      .force("x", d3.forceX(W / 2 + 90).strength(.07)).force("y", d3.forceY(H / 2).strength(.11))
      .stop();
    nodes.forEach((n, i) => { const a = i * 2.39996, d = 10 + Math.sqrt(i) * 16; n.x = W / 2 + 90 + Math.cos(a) * d; n.y = H / 2 + Math.sin(a) * d; });
    for (let i = 0; i < 200; i++) tabSim.tick();
    tabSim.alpha(0.1).restart()
      .on("tick", () => {
        lk.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        nd.attr("transform", d => `translate(${d.x},${d.y})`);
      });
    const pres = TEMAS.filter(t => nodes.some(n => n.t.tema === t));
    $("#tabLegend").innerHTML = `<div class="kicker" style="margin-bottom:4px">Tema da tabela</div>` + pres.map(t => `<div class="lg"><span class="sw round" style="background:${temaColor(t)}"></span>${esc(t)}</div>`).join("") +
      `<div class="lg"><span class="sw round" style="border:2px solid var(--ink-2)"></span>dimensão (vazado)</div><div class="muted small" style="margin-top:4px">${nodes.length} tabelas · ${links.length} conexões</div>`;
  }

  function renderTabList() {
    const q = normTxt($("#tabSearch").value);
    const rows = D.tabelas.filter(t => (!TB.tema || t.tema === TB.tema) && (!q || normTxt(t.nome).includes(q) || t.cols.some(c => c.includes(q))));
    const max = d3.max(D.tabelas, t => t.n_reps);
    dataTable($("#tabTable"), [
      { k: "nome", label: "Tabela", render: t => `<div class="nm">${esc(t.nome)}</div>` },
      { k: "papel", label: "Papel" },
      { k: "tema", label: "Tema", render: t => temaBadge(t.tema) },
      { k: "n_reps", label: "Relatórios", num: true, render: t => mbar(t.n_reps, max, cssv("--mint")) },
      { k: "nws", label: "Workspaces", num: true, sort: t => t.ws.length, render: t => t.ws.length },
      { k: "n_cols", label: "Colunas", num: true },
    ], rows, { sortKey: "n_reps", onClick: t => openTable(t.k) });
  }

  function renderColTop() {
    const max = d3.max(D.colunas_top, c => c.n_ws) || 1;
    $("#colTop").innerHTML = `<div class="col-row" style="cursor:default;color:var(--ink-3);font-size:11px"><span>coluna</span><span>workspaces · temas · tabelas</span></div>` +
      D.colunas_top.slice(0, 40).map((c, i) => `<div class="col-row" data-i="${i}"><span>${esc(c.c)}</span><b>${c.n_ws} · ${c.n_temas} · ${c.n}</b><div class="bar" style="width:${c.n_ws / max * 100}%"></div></div>`).join("");
    $("#colTop").onclick = e => { const r = e.target.closest(".col-row"); if (r) openColumn(D.colunas_top[+r.dataset.i]); };
  }

  // ==================================================================
  // SOBREPOSIÇÕES
  // ==================================================================
  let ovType = "";
  function renderOverlap() {
    const c = d3.rollup(D.arestas, v => v.length, d => d.tipo);
    const grupos = D.clusters.filter(x => x.n > 1).length;
    const ks = [
      { l: "Mesmo modelo", v: c.get("mesmo_modelo") || 0, s: "pares que usam o mesmo dataset", c: "--lime" },
      { l: "Duplicados", v: (c.get("duplicado") || 0) + (c.get("nome_igual") || 0), s: "mesmo nome-base em workspaces diferentes", c: "--r-arquivar" },
      { l: "Alta sobreposição", v: c.get("alta_sobreposicao") || 0, s: "similaridade ≥ 0,5", c: "--r-consolidar" },
      { l: "Clusters", v: grupos, s: "grupos com 2+ relatórios", c: "--t-cotas" },
    ];
    $("#ovKpis").innerHTML = ks.map(k => `<div class="kpi glass" style="--kc:var(${k.c})"><div class="k-label">${k.l}</div><div class="k-val" data-v="${k.v}">0</div><div class="k-sub">${k.s}</div></div>`).join("");
    $$("#ovKpis .k-val").forEach(el => countUp(el, +el.dataset.v));
    drawMatrix(); renderOvTable();
    $("#ovType").onclick = e => { const b = e.target.closest("button"); if (!b) return; $$("#ovType button").forEach(x => x.classList.toggle("on", x === b)); ovType = b.dataset.v; renderOvTable(); };
  }

  function drawMatrix() {
    const el = $("#matrix"); el.innerHTML = "";
    const ids = new Set(); D.arestas.forEach(e => { ids.add(e.a); ids.add(e.b); });
    const order = ATIVOS.filter(r => ids.has(r.id)).sort((a, b) => (a.cluster - b.cluster) || TEMAS.indexOf(a.tema) - TEMAS.indexOf(b.tema) || a.nome.localeCompare(b.nome));
    const idx = new Map(order.map((r, i) => [r.id, i]));
    const S = el.clientWidth, n = order.length, pad = 6, cs = (S - pad * 2) / n;
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${S} ${S}`);
    const g = svg.append("g").attr("transform", `translate(${pad},${pad})`);
    g.append("rect").attr("width", n * cs).attr("height", n * cs).attr("fill", cssv("--surface")).attr("rx", 6);
    // limites de cluster
    let start = 0;
    order.forEach((r, i) => {
      if (i === n - 1 || order[i + 1].cluster !== r.cluster) {
        const len = i - start + 1;
        if (len > 1) g.append("rect").attr("x", start * cs).attr("y", start * cs).attr("width", len * cs).attr("height", len * cs)
          .attr("fill", "none").attr("stroke", cssv("--border-strong")).attr("rx", 3);
        start = i + 1;
      }
    });
    g.selectAll(".diag").data(order).join("rect").attr("x", (d, i) => i * cs).attr("y", (d, i) => i * cs).attr("width", cs).attr("height", cs).attr("fill", d => temaColor(d.tema)).attr("opacity", .9);
    const cells = [];
    D.arestas.forEach(e => { const i = idx.get(e.a), j = idx.get(e.b); if (i === undefined || j === undefined) return; cells.push({ i, j, e }, { i: j, j: i, e }); });
    const col = d3.scaleSequential(d3.interpolateRgb(cssv("--forest") || "#0F4A31", cssv("--lime"))).domain([0.15, 1]);
    g.selectAll(".c").data(cells).join("rect").attr("x", d => d.j * cs).attr("y", d => d.i * cs).attr("width", Math.max(1, cs - .3)).attr("height", Math.max(1, cs - .3))
      .attr("fill", d => d.e.tipo === "duplicado" ? cssv("--r-arquivar") : col(d.e.s)).style("cursor", "pointer")
      .on("mousemove", (ev, d) => tip(ev, `<div class="tt-t">${esc(REP.get(d.e.a).nome)} ↔ ${esc(REP.get(d.e.b).nome)}</div>${ttRow("Tipo", TIPO_LABEL[d.e.tipo])}${ttRow("Similaridade", d.e.s.toFixed(2))}${ttRow("Tabelas em comum", d.e.n_tab_comuns)}`))
      .on("mouseleave", untip).on("click", (ev, d) => openPair(d.e));
    el.insertAdjacentHTML("beforeend", `<div class="legend" style="margin-top:8px"><span><span class="sw" style="background:${col(.2)}"></span>baixa</span><span><span class="sw" style="background:${col(.6)}"></span>média</span><span><span class="sw" style="background:${col(1)}"></span>alta</span><span><span class="sw" style="background:${cssv("--r-arquivar")}"></span>duplicado</span><span>diagonal = tema</span></div>`);
  }

  function renderOvTable() {
    const rows = D.arestas.filter(e => e.tipo !== "relacionado" && (!ovType || e.tipo === ovType || (ovType === "duplicado" && e.tipo === "nome_igual")));
    dataTable($("#ovTable"), [
      { k: "a", label: "Relatório A", sort: e => REP.get(e.a).nome, render: e => { const r = REP.get(e.a); return `<div class="nm">${esc(r.nome)}</div><div class="sub">${esc(r.ws)}</div>`; } },
      { k: "b", label: "Relatório B", sort: e => REP.get(e.b).nome, render: e => { const r = REP.get(e.b); return `<div class="nm">${esc(r.nome)}</div><div class="sub">${esc(r.ws)}</div>`; } },
      { k: "tipo", label: "Tipo", render: e => `<span class="typ ${e.tipo}">${TIPO_LABEL[e.tipo]}</span>` },
      { k: "s", label: "Similaridade", num: true, render: e => mbar(e.s, 1, cssv("--lime"), e.s.toFixed(2)) },
      { k: "jt", label: "Tabelas", num: true, render: e => mbar(e.jt, 1, cssv("--mint"), e.jt.toFixed(2)) },
      { k: "jm", label: "Medidas", num: true, render: e => mbar(e.jm, 1, cssv("--t-portfolio"), e.jm.toFixed(2)) },
      { k: "n_tab_comuns", label: "Em comum", num: true, render: e => `${e.n_tab_comuns} tab · ${e.n_med_comuns} med` },
    ], rows, { sortKey: "s", onClick: openPair });
  }

  // ==================================================================
  // RACIONALIZAÇÃO
  // ==================================================================
  let recF = "";
  const setRecFilter = v => { recF = v; $$("#recFilter button").forEach(x => x.classList.toggle("on", x.dataset.v === v)); renderHealthTable(); };
  // cartão "como a nota é calculada": grupos de penalidade em linguagem simples (mesmas regras de gerar_catalogo.py)
  function renderScoreGroups() {
    const G = [
      ["search", "Alguém usa?", "uso", [["Ninguém abriu", 40], ["Menos de 5 aberturas", 25], ["Menos de 20 aberturas", 10], ["Só 1 pessoa usa", 8], ["Uso não é medido", 10]]],
      ["pulse", "Os dados estão em dia?", "atualização", [["Parados há mais de 180 dias", 30], ["Parados há mais de 60 dias", 18], ["Parados há mais de 14 dias", 8], ["Última atualização falhou", 10], ["Atualização automática desligada", 8]]],
      ["layers", "É teste ou antigo?", "ambiente", [["Teste, homologação, old ou UAT", 15], ["Criado há mais de 2 anos", 5]]],
      ["overlap", "Tem outro igual?", "sobreposição", [["Cada relatório muito parecido (até −15)", 5]]],
    ];
    $("#sxGroups").innerHTML = G.map(([ic, t, k, ps]) => `<div class="sx-g"><div class="sx-gh"><i data-ico="${ic}"></i><b>${t}</b><small>${k}</small></div>
      ${ps.map(([l, v]) => `<div class="sx-p"><span>${l}</span><span class="bar"><span style="width:${v / 40 * 100}%"></span></span><b>−${v}</b></div>`).join("")}</div>`).join("");
    paintIcons($("#sxGroups"));
  }

  function renderHealth() {
    renderScoreGroups();
    const desc = { Manter: "uso e refresh saudáveis", Consolidar: "absorver no modelo do tema", Revisar: "validar com o owner", Arquivar: "mover para BI Histórico" };
    $("#recCards").innerHTML = RECS.map((r, i) => `<div class="rc glass" data-r="${r}" style="--rcc:${recColor(r)};animation:viewIn .5s ${i * 70}ms both">
      <div class="rc-l">${recBadge(r)}</div><div class="rc-n" data-v="${D.resumo.recs[r] || 0}">0</div><div class="rc-d">${desc[r]}</div></div>`).join("");
    $$("#recCards .rc-n").forEach(el => countUp(el, +el.dataset.v));
    $("#recCards").onclick = e => { const c = e.target.closest(".rc"); if (c) setRecFilter(c.dataset.r); };
    $("#recFilter").onclick = e => { const b = e.target.closest("button"); if (b) setRecFilter(b.dataset.v); };
    $("#exportHealth").onclick = () => {
      const rows = ATIVOS.filter(r => !recF || r.rec === recF).sort((a, b) => a.score - b.score);
      downloadCSV(`racionalizacao_bis${recF ? "_" + recF.toLowerCase() : ""}.csv`,
        ["Relatório", "Workspace", "Tema", "Cluster", "Score", "Recomendação", "Motivos", "Views", "Usuários", "Dias desde refresh", "Status refresh", "Owner", "URL"],
        rows.map(r => [r.nome, r.ws, r.tema, r.cluster, r.score, r.rec, r.motivos.join(" | "), r.views ?? "", r.viewers ?? "", r.dias_refresh ?? "", r.status_refresh ?? "", r.owner ?? "", r.url]));
    };
    drawScatter(); renderHealthTable();
  }

  function drawScatter() {
    const el = $("#scatter"); el.innerHTML = "";
    $("#legScatter").innerHTML = RECS.map(r => `<span><span class="sw round" style="background:${recColor(r)}"></span>${r}</span>`).join("");
    const W = el.clientWidth, H = 470, m = { l: 92, r: 96, t: 22, b: 96 };
    const maxD = d3.max(ATIVOS, r => r.dias_refresh) || 1, maxV = d3.max(ATIVOS, r => r.views) || 1;
    const x = d3.scaleSymlog().constant(5).domain([0, maxD]).range([m.l, W - m.r]).nice();
    const y = d3.scaleSymlog().constant(3).domain([0, maxV]).range([H - m.b, m.t]).nice();
    const xNA = W - m.r + 46, yNA = H - m.b + 62;
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
    const xt = [0, 7, 30, 90, 180, 365, 1000].filter(v => v <= x.domain()[1]);
    const yt = [0, 5, 20, 50, 100, 200].filter(v => v <= y.domain()[1]);
    svg.append("g").selectAll("line").data(yt).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", d => y(d)).attr("y2", d => y(d)).attr("stroke", cssv("--grid"));
    svg.append("g").selectAll("line").data(xt).join("line").attr("y1", m.t).attr("y2", H - m.b).attr("x1", d => x(d)).attr("x2", d => x(d)).attr("stroke", cssv("--grid"));
    svg.append("g").selectAll("text").data(xt).join("text").attr("x", d => x(d)).attr("y", H - m.b + 16).attr("text-anchor", "middle").attr("fill", cssv("--ink-3")).style("font-size", "10.5px").text(d => d + "d");
    svg.append("g").selectAll("text").data(yt).join("text").attr("x", m.l - 8).attr("y", d => y(d)).attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", cssv("--ink-3")).style("font-size", "10.5px").text(d => d);
    svg.append("text").attr("x", m.l).attr("y", H - m.b + 34).attr("fill", cssv("--ink-2")).style("font-size", "11.5px").text("dias desde o último refresh com sucesso →");
    svg.append("text").attr("transform", `translate(30,${(m.t + H - m.b) / 2}) rotate(-90)`).attr("text-anchor", "middle").attr("fill", cssv("--ink-2")).style("font-size", "11.5px").text("views no período →");
    // faixas "sem dado"
    svg.append("rect").attr("x", W - m.r + 26).attr("y", m.t).attr("width", 40).attr("height", H - m.b - m.t + 66).attr("rx", 10).attr("fill", cssv("--surface"));
    svg.append("rect").attr("x", m.l).attr("y", H - m.b + 46).attr("width", W - m.r - m.l + 66).attr("height", 34).attr("rx", 10).attr("fill", cssv("--surface")).attr("opacity", .9);
    svg.append("text").attr("x", xNA).attr("y", m.t + 12).attr("text-anchor", "middle").attr("fill", cssv("--ink-3")).style("font-size", "9.5px").text("sem refresh");
    svg.append("text").attr("x", m.l - 8).attr("y", yNA).attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", cssv("--ink-3")).style("font-size", "9.5px").text("sem telemetria");
    svg.append("text").attr("x", m.l + 10).attr("y", m.t + 14).attr("fill", cssv("--r-manter")).style("font-size", "11px").style("font-weight", 600).text("↖ usado e atualizado");
    svg.append("text").attr("x", W - m.r - 10).attr("y", H - m.b - 10).attr("text-anchor", "end").attr("fill", cssv("--r-arquivar")).style("font-size", "11px").style("font-weight", 600).text("sem uso e desatualizado ↘");
    const rnd = s => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return ((h >>> 0) % 1000) / 1000 - .5; };
    const pts = ATIVOS.map(r => ({
      r, cx: (r.dias_refresh === null ? xNA : x(r.dias_refresh)) + rnd(r.id) * 16,
      cy: (r.views === null ? yNA : y(r.views)) + rnd(r.id + "y") * (r.views === null ? 10 : 12),
      rad: 4 + Math.sqrt(r.n_paginas || 1) * 1.6,
    }));
    svg.append("g").selectAll("circle").data(pts).join("circle").attr("class", "pop").style("animation-delay", (d, i) => `${i * 8}ms`)
      .attr("cx", d => d.cx).attr("cy", d => d.cy).attr("r", d => d.rad)
      .attr("fill", d => recColor(d.r.rec)).attr("fill-opacity", .85).attr("stroke", cssv("--surface-solid")).attr("stroke-width", 2).style("cursor", "pointer")
      .on("mousemove", (ev, d) => tip(ev, repTip(d.r) + ttRow("Dias s/ refresh", d.r.dias_refresh ?? "・") + ttRow("Score", d.r.score)))
      .on("mouseleave", untip).on("click", (ev, d) => openReport(d.r.id));
  }

  function renderHealthTable() {
    const rows = ATIVOS.filter(r => !recF || r.rec === recF);
    dataTable($("#healthTable"), [
      { k: "nome", label: "Relatório", render: r => `<div class="nm">${esc(r.nome)}</div><div class="sub">${esc(r.ws)}</div>` },
      { k: "tema", label: "Tema", render: r => temaBadge(r.tema) },
      { k: "score", label: "Score", num: true, render: r => mbar(r.score, 100, recColor(r.rec), r.score) },
      { k: "rec", label: "Recomendação", render: r => recBadge(r.rec) },
      { k: "views", label: "Views", num: true, render: r => r.views === null ? '<span class="muted">・</span>' : fmt(r.views) },
      { k: "dias_refresh", label: "Dias s/ refresh", num: true, render: r => r.dias_refresh === null ? '<span class="muted">・</span>' : fmt(r.dias_refresh) },
      { k: "motivos", label: "Motivos", sort: r => r.motivos.length, render: r => `<div class="reasons">${r.motivos.map(m => `<span>${esc(m)}</span>`).join("")}</div>` },
    ], rows, { sortKey: "score", asc: true, onClick: r => openReport(r.id) });
  }

  // ==================================================================
  // CATÁLOGO
  // ==================================================================
  // situação no inventário (mesma classificação do painel de inventário)
  const SITS = ["Produtivo", "Não produtivo", "Histórico", "Sistema"];
  const sitOf = r => r.sistema ? "Sistema" : r.historico ? "Histórico" : r.nao_produtivo ? "Não produtivo" : "Produtivo";
  const anoOf = r => r.criado ? r.criado.slice(0, 4) : "Sem data";
  const ownerOf = r => r.owner ? r.owner.split("@")[0] : "Sem owner";
  function renderCatalog() {
    const opt = (sel, vals) => vals.forEach(v => $(sel).insertAdjacentHTML("beforeend", `<option>${esc(v)}</option>`));
    opt("#catTema", TEMAS);
    opt("#catWs", D.workspaces.slice().sort());
    opt("#catSit", SITS);
    opt("#catAno", [...new Set(D.relatorios.map(anoOf))].sort().reverse());
    opt("#catOwner", [...new Set(D.relatorios.map(ownerOf))].sort((a, b) => a.localeCompare(b, "pt-BR")));
    ["#catSearch", "#catTema", "#catWs", "#catSit", "#catAno", "#catOwner", "#catHist", "#catSys"]
      .forEach(s => $(s).addEventListener(s === "#catSearch" ? "input" : "change", renderCatalogTable));
    $("#exportCat").onclick = () => {
      const rows = catalogRows();
      downloadCSV("catalogo_bis.csv", ["Relatório", "Workspace", "Tema", "Recomendação", "Score", "Páginas", "Tabelas", "Medidas", "Views", "Usuários", "Último refresh", "Status", "Owner", "Criado em", "Tabelas-fato", "URL"],
        rows.map(r => [r.nome, r.ws, r.tema, r.rec, r.score ?? "", r.n_paginas, r.n_tabelas, r.n_medidas, r.views ?? "", r.viewers ?? "", r.ult_refresh ?? "", r.status_refresh ?? "", r.owner ?? "", r.criado ?? "", r.tabelas.filter(t => t.p === "fato").map(t => t.t).join(", "), r.url]));
    };
    renderCatalogTable();
  }
  function catalogRows() {
    const q = normTxt($("#catSearch").value), t = $("#catTema").value, w = $("#catWs").value, h = $("#catHist").checked, s = $("#catSys").checked;
    const sit = $("#catSit").value, ano = $("#catAno").value, own = $("#catOwner").value;
    if (w === "BI Histórico" && !h) $("#catHist").checked = true;
    // escolher uma situação explícita (Histórico, Sistema…) vale mais que as caixas "Incluir"
    return D.relatorios.filter(r => (sit ? sitOf(r) === sit : (h || !r.historico || w === "BI Histórico") && (s || !r.sistema)) &&
      (!t || r.tema === t) && (!w || r.ws === w) && (!ano || anoOf(r) === ano) && (!own || ownerOf(r) === own) &&
      (!q || normTxt([r.nome, r.ws, r.owner, r.dataset, r.tabelas.map(x => x.t).join(" ")].join(" ")).includes(q)));
  }
  function renderCatalogTable() {
    if (!rendered.catalog && current !== "catalog") return;
    const rows = catalogRows();
    dataTable($("#catTable"), [
      { k: "nome", label: "Relatório", render: r => `<div class="nm">${esc(r.nome)}</div><div class="sub">${esc(r.ws)}</div>` },
      { k: "tema", label: "Tema", render: r => temaBadge(r.tema) },
      { k: "rec", label: "Status", render: r => recBadge(r.rec) },
      { k: "_sit", label: "Situação", sort: sitOf, render: r => `<span class="sub" style="color:var(--ink-2)">${esc(sitOf(r))}</span>` },
      { k: "n_paginas", label: "Pág.", num: true },
      { k: "n_tabelas", label: "Tab.", num: true },
      { k: "n_medidas", label: "Medidas", num: true },
      { k: "views", label: "Views", num: true, render: r => r.views === null ? '<span class="muted">・</span>' : fmt(r.views) },
      { k: "ult_refresh", label: "Último refresh", render: r => r.ult_refresh ? `${r.ult_refresh}<div class="sub">${esc(r.status_refresh || "")}</div>` : `<span class="muted">${esc(r.status_refresh || "・")}</span>` },
      { k: "owner", label: "Owner técnico", render: r => `<span class="sub">${esc((r.owner || "・").split("@")[0])}</span>` },
      { k: "criado", label: "Criado", render: r => esc(r.criado || "・") },
    ], rows, { sortKey: "views", onClick: r => openReport(r.id) });
  }

  // ==================================================================
  // MODAIS
  // ==================================================================
  const MB = $("#modalBody");
  let modalSim = null;
  function openModal(html, after) {
    if (modalSim) { modalSim.stop(); modalSim = null; }
    MB.innerHTML = html; paintIcons(MB);
    $("#modal").classList.remove("closing");
    $("#modal").classList.add("open"); $("#modal").setAttribute("aria-hidden", "false");
    $("#modal").scrollTop = 0;
    const tabs = MB.querySelector(".m-tabs");
    if (tabs) tabs.onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      tabs.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
      MB.querySelectorAll(".m-pane").forEach(p => p.classList.toggle("on", p.dataset.p === b.dataset.p));
      if (b.dataset.p && MB._onTab) MB._onTab(b.dataset.p);
    };
    MB.onclick = e => {
      const r = e.target.closest("[data-rep]"); if (r) return openReport(r.dataset.rep);
      const t = e.target.closest("[data-tab]"); if (t) return openTable(t.dataset.tab);
      const p = e.target.closest("[data-pair]"); if (p) return openPair(D.arestas[+p.dataset.pair]);
      const g = e.target.closest("[data-graph]"); if (g) return focusInGraph(g.dataset.graph);
      const tm = e.target.closest("[data-tema]"); if (tm) return openTema(tm.dataset.tema);
    };
    MB._onTab = null;
    if (after) after();
  }
  function closeModal() { untip(); window.FTShell.closeModal(() => { if (modalSim) modalSim.stop(); }); }
  $("#modalClose").onclick = closeModal;
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); $("#searchResults").classList.remove("open"); } });

  const stat = (v, l) => `<div class="m-stat"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  function scoreRing(score, color) {
    if (score === null || score === undefined) return "";
    const C = 2 * Math.PI * 26, off = C * (1 - score / 100);
    return `<svg class="score-ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--surface-2)" stroke-width="6"/>
      <circle cx="32" cy="32" r="26" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 32 32)">
      <animate attributeName="stroke-dashoffset" from="${C}" to="${off}" dur="0.9s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1"/></circle>
      <text x="32" y="37" text-anchor="middle" fill="var(--ink)" style="font:600 16px var(--font-h)">${score}</text></svg>`;
  }

  function openReport(id) {
    const r = REP.get(id); if (!r) return;
    const edges = (EDGES_BY.get(id) || []).slice().sort((a, b) => b.s - a.s);
    const tc = temaColor(r.tema);
    const fatos = r.tabelas.filter(t => t.p === "fato"), dims = r.tabelas.filter(t => t.p === "dimensão"), outras = r.tabelas.filter(t => t.p !== "fato" && t.p !== "dimensão");
    const tblBlock = t => `<details class="tbl-block"><summary><span class="tag ${t.p === "fato" ? "fato" : ""}">${esc(t.p)}</span><b>${esc(t.t)}</b><span class="muted small">${t.c.length} colunas</span>
      ${TAB.has(normKey(t.t)) ? `<span class="tag click" data-tab="${esc(normKey(t.t))}" style="margin-left:auto">ver tabela ↗</span>` : ""}</summary>
      <div class="cols">${t.c.map(c => `<span class="tag">${esc(c)}</span>`).join("") || '<span class="empty">sem colunas</span>'}</div></details>`;
    const maxU = d3.max(r.uso_usuarios, u => u.v) || 1;
    const scores = Object.entries(r.tema_scores || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const idxE = e => D.arestas.indexOf(e);

    openModal(`
      <div class="m-head">
        <div class="m-icon" style="background:${tc};box-shadow:0 0 30px ${tc}">${esc(r.nome.replace(/[^A-Za-zÀ-ú0-9]/g, "").slice(0, 2).toUpperCase())}</div>
        <div style="flex:1;min-width:240px">
          <div class="kicker">${esc(r.ws)}${r.historico ? " · HISTÓRICO" : ""}${r.nao_produtivo ? " · TESTE/HOMOLOG." : ""}</div>
          <h2>${esc(r.nome)}</h2>
          <div class="m-meta"><span data-tema="${esc(r.tema)}" style="cursor:pointer">${temaBadge(r.tema)}</span>${r.cluster && clusterRank.has(r.cluster) ? `<span class="chip">Cluster ${r.cluster}</span>` : ""}${recBadge(r.rec)}
            ${!r.historico && !r.sistema ? `<button class="btn" data-graph="${r.id}">Ver no grafo</button>` : ""}
            <a class="btn pbi-link" href="${esc(r.url)}" target="_blank" rel="noopener"><i data-ico="ext"></i> Abrir no Power BI</a></div>
        </div>
        ${scoreRing(r.score, recColor(r.rec))}
      </div>
      <div class="m-tabs">
        <button class="on" data-p="res">Resumo</button><button data-p="tab">Tabelas & colunas (${r.tabelas.length})</button>
        <button data-p="med">Medidas (${r.n_medidas})</button><button data-p="uso">Uso & refresh</button><button data-p="rel">Relacionados (${edges.length})</button>
      </div>
      <div class="m-pane on" data-p="res">
        <div class="m-grid">${stat(r.n_paginas, "páginas")}${stat(r.n_tabelas, "tabelas")}${stat(fmt(r.n_medidas), `medidas · ${r.medidas_sem_desc} sem descrição`)}${stat(r.views === null ? "・" : fmt(r.views), r.views === null ? "sem telemetria" : `views · ${fmt(r.viewers)} usuários`)}</div>
        ${r.motivos ? `<div class="m-sec"><h4>Diagnóstico</h4><div class="reasons">${r.motivos.map(m => `<span>${esc(m)}</span>`).join("")}</div></div>` : ""}
        <div class="m-sec"><h4>Finalidade (gerada a partir do modelo)</h4><p class="muted" style="margin:0">${esc(r.finalidade || "・")}</p></div>
        <div class="m-sec"><h4>Ficha</h4><div class="kv">
          <div>Workspace</div><div>${esc(r.ws)}</div><div>Dataset</div><div>${esc(r.dataset || "・")} ${r.modo ? `<span class="muted small">(${esc(r.modo)})</span>` : ""}</div>
          <div>Owner técnico</div><div>${esc(r.owner || "・")}</div><div>Admins do workspace</div><div>${esc(r.admins || "・")}</div>
          <div>Criado em</div><div>${esc(r.criado || "・")}</div><div>Fontes</div><div>${r.fontes.map(esc).join("<br>") || "・"}</div>
        </div></div>
        <div class="m-sec"><h4>Páginas</h4><div class="t-tabs">${r.paginas.map(p => `<span class="tag">${esc(p)}</span>`).join("") || '<span class="empty">・</span>'}</div></div>
        ${scores.length ? `<div class="m-sec"><h4>Aderência aos temas</h4>${scores.map(([t, v]) => `<div style="display:grid;grid-template-columns:110px 1fr;gap:10px;align-items:center;margin-bottom:4px;font-size:12.5px"><span>${esc(t)}</span>${mbar(v, 1, temaColor(t), pct(v))}</div>`).join("")}</div>` : ""}
      </div>
      <div class="m-pane" data-p="tab">
        ${fatos.length ? `<div class="m-sec"><h4>Fatos (${fatos.length})</h4>${fatos.map(tblBlock).join("")}</div>` : ""}
        ${dims.length ? `<div class="m-sec"><h4>Dimensões (${dims.length})</h4>${dims.map(tblBlock).join("")}</div>` : ""}
        ${outras.length ? `<div class="m-sec"><h4>Outras (${outras.length})</h4>${outras.map(tblBlock).join("")}</div>` : ""}
        ${!r.tabelas.length ? '<p class="empty">Modelo sem tabelas acessíveis (permissão Build ausente ou relatório de sistema).</p>' : ""}
        ${r.relacoes_modelo.length ? `<div class="m-sec"><h4>Relacionamentos do modelo</h4><div class="table-wrap" style="max-height:260px"><table class="dt"><thead><tr><th>De</th><th>Para</th></tr></thead><tbody>${r.relacoes_modelo.map(x => `<tr><td>${esc(x[0])}<span class="sub">[${esc(x[1])}]</span></td><td>${esc(x[2])}<span class="sub">[${esc(x[3])}]</span></td></tr>`).join("")}</tbody></table></div></div>` : ""}
      </div>
      <div class="m-pane" data-p="med">
        <input class="mini-search" id="medSearch" placeholder="Filtrar medidas…" style="width:100%;margin-bottom:10px">
        <div class="table-wrap" style="max-height:440px"><table class="dt" id="medTable"></table></div>
      </div>
      <div class="m-pane" data-p="uso">
        <div class="m-sec"><h4>Uso · Usage Metrics</h4>
          <div class="m-grid">${stat(r.views === null ? "・" : fmt(r.views), "aberturas do relatório")}${stat(r.page_views === null || r.page_views === undefined ? "・" : fmt(r.page_views), "visualizações de página")}${stat(r.viewers === null ? "・" : fmt(r.viewers), "usuários")}${stat(BR(r.ult_vis), "última visualização")}${stat(BR(r.uso_ate), "telemetria disponível até")}</div>
          ${usoAlerta(r)}
          ${window.FTShell.usoFaixa(r, D.resumo.extracao_em)}
          <div class="kv" style="margin-bottom:6px"><div>Período de uso coberto</div><div>${r.periodo_uso ? esc(r.periodo_uso.replace(/(\d{4})-(\d{2})-(\d{2})/g, "$3/$2/$1")) : "sem telemetria"} <span class="muted small">(criação do relatório → última visualização)</span></div>
            <div>Telemetria disponível</div><div>${r.tel_desde || r.uso_ate ? `${BR(r.tel_desde)} a ${BR(r.uso_ate)}` : "・"} <span class="muted small">(janela que o Usage Metrics do workspace cobre)</span></div></div>
        </div>
        <div class="m-sec"><h4>Quem usa · views de ${BR(r.tel_desde)} a ${BR(r.uso_ate)}</h4>${r.uso_usuarios.length ? r.uso_usuarios.map(u => `<div class="urow2"><span title="${esc(u.u)}">${esc(u.u)}</span>${mbar(u.v, maxU, cssv("--mint"))}<small>última ${BR(u.d)}</small></div>`).join("") : '<p class="empty">Sem dados de uso por usuário.</p>'}</div>
        <div class="m-sec"><h4>Atualização do modelo</h4>
          <div class="m-grid">${stat(r.ult_refresh || "・", "último refresh com sucesso")}${stat(r.dias_refresh === null ? "・" : fmt(r.dias_refresh), "dias desde o refresh")}${stat(esc(r.status_refresh || "・"), "status do último refresh")}${stat(r.agenda_ativa === null ? "・" : r.agenda_ativa ? "Ativa" : "Desativada", "agenda de refresh")}</div>
          <div class="kv" style="margin-bottom:16px"><div>Dias agendados</div><div>${esc(Array.isArray(r.refresh_dias) ? r.refresh_dias.join(", ") : r.refresh_dias || "・")}</div>
            <div>Horários</div><div>${esc(Array.isArray(r.refresh_hor) ? r.refresh_hor.join(", ") : r.refresh_hor || "・")}</div>
            <div>Falhas (últimos 10)</div><div>${r.falhas10}</div></div>
          ${r.hist_refresh.length ? `<div class="t-tabs">${r.hist_refresh.map(h => `<span class="tag" style="border-color:${h.s === "Completed" ? recColor("Manter") : h.s === "Failed" ? recColor("Arquivar") : "var(--border)"}">${esc(h.i || "?")} · ${esc(h.s)}</span>`).join("")}</div>` : ""}
        </div>
      </div>
      <div class="m-pane" data-p="rel">
        ${edges.length ? `<table class="dt"><thead><tr><th>Relatório</th><th>Tipo</th><th>Similaridade</th><th>Tabelas em comum</th></tr></thead><tbody>
          ${edges.map(e => { const o = REP.get(e.a === id ? e.b : e.a); return `<tr data-pair="${idxE(e)}"><td><div class="nm">${esc(o.nome)}</div><div class="sub">${esc(o.ws)}</div></td><td><span class="typ ${e.tipo}">${TIPO_LABEL[e.tipo]}</span></td><td>${mbar(e.s, 1, cssv("--lime"), e.s.toFixed(2))}</td><td><div class="reasons">${e.tab_comuns.slice(0, 6).map(t => `<span>${esc(TAB.get(t)?.nome || t)}</span>`).join("")}</div></td></tr>`; }).join("")}
        </tbody></table>` : `<p class="empty">${r.historico ? "Relatórios do BI Histórico não entram na análise de relações." : "Nenhum relatório com similaridade relevante."}</p>`}
      </div>`, () => {
      const drawMed = () => {
        const q = normTxt($("#medSearch").value);
        const rows = r.medidas.filter(m => !q || normTxt(m.m + " " + m.t + " " + (m.d || "")).includes(q));
        dataTable($("#medTable"), [
          { k: "m", label: "Medida", render: m => `<b>${esc(m.m)}</b>` }, { k: "t", label: "Tabela" },
          { k: "d", label: "Descrição", render: m => m.d ? esc(m.d) : '<span class="muted">・</span>' },
        ], rows, { sortKey: "m", asc: true, limit: 800 });
      };
      $("#medSearch").addEventListener("input", drawMed); drawMed();
    });
  }

  function openTema(tema) {
    const t = D.temas.find(x => x.tema === tema); if (!t) return;
    const tc = temaColor(tema);
    const reps = t.reps.map(id => REP.get(id)).sort((a, b) => (b.views || 0) - (a.views || 0));
    const keyTabs = [...t.fatos.slice(0, 7), ...t.dims.slice(0, 5)];
    const tabRow = f => `<tr data-tab="${esc(f.k)}"><td><b>${esc(f.nome)}</b></td><td>${esc(f.papel)}</td><td class="num">${f.hits}</td><td class="num">${f.n_reps}</td><td class="num">${f.n_cols}</td></tr>`;
    openModal(`
      <div class="m-head">
        <div class="m-icon" style="background:${tc};box-shadow:0 0 30px ${tc}">${esc(tema.slice(0, 2).toUpperCase())}</div>
        <div style="flex:1"><div class="kicker">TEMA-ALVO</div><h2>${esc(tema)}</h2>
          <p class="muted" style="margin:4px 0 0;max-width:720px">${esc(temaDesc(tema))}</p>
          <div class="m-meta">${RECS.filter(r => t.recs[r]).map(r => `${recBadge(r)} <b>${t.recs[r]}</b>`).join(" ")}</div></div>
      </div>
      <div class="m-grid">${stat(t.n, "relatórios")}${stat(fmt(t.views), "views no período")}${stat(Object.keys(t.ws).length, "workspaces")}${stat(t.fatos.length, "fatos candidatos")}</div>
      <div class="m-tabs"><button class="on" data-p="map">Mapa do tema</button><button data-p="mod">Modelo-alvo proposto</button><button data-p="reps">Relatórios (${reps.length})</button></div>
      <div class="m-pane on" data-p="map">
        <p class="muted small">Relatórios do tema (círculos, cor = recomendação) ligados às tabelas-chave que usam (quadrados). Relatórios que compartilham as mesmas tabelas são os primeiros candidatos a virar páginas de um único BI.</p>
        <div class="m-graph" id="temaGraph"></div>
        <div class="legend" style="margin-top:8px">${RECS.map(r => `<span><span class="sw round" style="background:${recColor(r)}"></span>${r}</span>`).join("")}<span><span class="sw" style="background:${tc}"></span>tabela-fato</span><span><span class="sw" style="border:2px solid ${tc}"></span>dimensão</span></div>
      </div>
      <div class="m-pane" data-p="mod">
        ${t.fatos.length ? "" : `<p class="t-gap">⚠ Nenhuma tabela-fato específica de ${esc(tema)} foi encontrada nos modelos atuais ・ será preciso construir/expor a tabela-chave na camada de dados.</p>`}
        <div class="m-sec"><h4>Tabelas-fato candidatas</h4><table class="dt"><thead><tr><th>Tabela</th><th>Papel</th><th>Rel. do tema</th><th>Rel. total</th><th>Colunas</th></tr></thead><tbody>${t.fatos.map(tabRow).join("") || '<tr><td colspan="5" class="empty">・</td></tr>'}</tbody></table></div>
        <div class="m-sec"><h4>Dimensões candidatas</h4><table class="dt"><thead><tr><th>Tabela</th><th>Papel</th><th>Rel. do tema</th><th>Rel. total</th><th>Colunas</th></tr></thead><tbody>${t.dims.map(tabRow).join("") || '<tr><td colspan="5" class="empty">・</td></tr>'}</tbody></table></div>
        <div class="m-sec"><h4>Indicadores mais recorrentes</h4><div class="t-tabs">${t.medidas_top.map(([m, n]) => `<span class="tag">${esc(m)} · ${n}</span>`).join("") || '<span class="empty">・</span>'}</div></div>
        <div class="m-sec"><h4>Workspaces envolvidos</h4><div class="t-tabs">${Object.entries(t.ws).sort((a, b) => b[1] - a[1]).map(([w, n]) => `<span class="tag">${esc(w)} · ${n}</span>`).join("")}</div></div>
      </div>
      <div class="m-pane" data-p="reps">
        <table class="dt"><thead><tr><th>Relatório</th><th>Recomendação</th><th>Score</th><th>Views</th><th>Cluster</th></tr></thead><tbody>
        ${reps.map(r => `<tr data-rep="${r.id}"><td><div class="nm">${esc(r.nome)}</div><div class="sub">${esc(r.ws)}</div></td><td>${recBadge(r.rec)}</td><td>${mbar(r.score, 100, recColor(r.rec), r.score)}</td><td class="num">${r.views === null ? "・" : fmt(r.views)}</td><td>${clusterRank.has(r.cluster) ? "C" + r.cluster : "・"}</td></tr>`).join("")}
        </tbody></table>
      </div>`, () => drawTemaGraph(reps, keyTabs, tc));
  }

  function drawTemaGraph(reps, keyTabs, tc) {
    const el = $("#temaGraph"); if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const keys = new Map(keyTabs.map(k => [k.k, k]));
    const nodes = [...reps.map(r => ({ id: r.id, kind: "r", r })), ...keyTabs.map(k => ({ id: "t:" + k.k, kind: "t", k }))];
    const links = [];
    const normT = normKey;
    reps.forEach(r => r.tabelas.forEach(t => { const k = normT(t.t); if (keys.has(k)) links.push({ source: r.id, target: "t:" + k }); }));
    const svg = d3.select(el).append("svg");
    const root = svg.append("g");
    svg.call(d3.zoom().scaleExtent([.4, 4]).on("zoom", ev => root.attr("transform", ev.transform)));
    const lk = root.append("g").selectAll("line").data(links).join("line").attr("class", "link").attr("stroke", tc).attr("opacity", .35);
    const nd = root.append("g").selectAll("g").data(nodes).join("g").attr("class", "node").style("cursor", "pointer");
    nd.filter(d => d.kind === "r").append("circle").attr("r", d => 5 + Math.min(12, Math.sqrt(d.r.views || 0))).attr("fill", d => recColor(d.r.rec));
    nd.filter(d => d.kind === "t").append("rect").attr("x", -8).attr("y", -8).attr("width", 16).attr("height", 16).attr("rx", 4)
      .attr("fill", d => d.k.papel === "fato" ? tc : cssv("--surface-solid")).attr("stroke", tc).attr("stroke-width", 2);
    nd.append("text").attr("dy", d => d.kind === "t" ? 22 : 18).attr("text-anchor", "middle")
      .text(d => { const s = d.kind === "t" ? d.k.nome : d.r.nome; return s.length > 24 ? s.slice(0, 23) + "…" : s; })
      .style("font-weight", d => d.kind === "t" ? 600 : 400);
    nd.on("mousemove", (ev, d) => tip(ev, d.kind === "r" ? repTip(d.r) : `<div class="tt-t">${esc(d.k.nome)}</div>${ttRow("Papel", d.k.papel)}${ttRow("Relatórios do tema", d.k.hits)}${ttRow("Relatórios no total", d.k.n_reps)}`))
      .on("mouseleave", untip).on("click", (ev, d) => { untip(); d.kind === "r" ? openReport(d.r.id) : openTable(d.k.k); });
    modalSim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(70).strength(.4))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("collide", d3.forceCollide(24))
      .force("x", d3.forceX(d => d.kind === "t" ? W * .62 : W * .38).strength(.07))
      .force("y", d3.forceY(H / 2).strength(.08))
      .stop();
    nodes.forEach((n, i) => { n.x = (n.kind === "t" ? W * .62 : W * .38) + Math.cos(i * 2.4) * 40; n.y = H / 2 + Math.sin(i * 2.4) * 60; });
    for (let i = 0; i < 200; i++) modalSim.tick();
    modalSim.alpha(0.1).restart()
      .on("tick", () => {
        nodes.forEach(n => { n.x = Math.max(20, Math.min(W - 20, n.x)); n.y = Math.max(20, Math.min(H - 26, n.y)); });
        lk.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        nd.attr("transform", d => `translate(${d.x},${d.y})`);
      });
    nd.call(d3.drag().on("start", (ev, d) => { if (!ev.active) modalSim.alphaTarget(.25).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; }).on("end", (ev, d) => { if (!ev.active) modalSim.alphaTarget(0); d.fx = d.fy = null; }));
  }

  function openTable(k) {
    const t = TAB.get(k); if (!t) return;
    const sim = D.tab_arestas.filter(e => e.tipo === "colunas" && (e.a === k || e.b === k)).sort((a, b) => b.s - a.s);
    const co = D.tab_arestas.filter(e => e.tipo === "co_uso" && (e.a === k || e.b === k)).sort((a, b) => b.n - a.n).slice(0, 20);
    const reps = t.reps.map(id => REP.get(id));
    const tc = temaColor(t.tema);
    openModal(`
      <div class="m-head"><div class="m-icon" style="background:${tc}">${t.papel === "fato" ? "F" : t.papel === "dimensão" ? "D" : "T"}</div>
        <div style="flex:1"><div class="kicker">TABELA · ${esc(t.papel)}</div><h2>${esc(t.nome)}</h2><div class="m-meta">${temaBadge(t.tema)}</div></div></div>
      <div class="m-grid">${stat(t.n_reps, "relatórios usam")}${stat(t.ws.length, "workspaces")}${stat(t.n_cols, "colunas")}${stat(sim.length, "tabelas c/ colunas parecidas")}</div>
      <div class="m-sec"><h4>Relatórios que usam</h4><table class="dt"><tbody>${reps.map(r => `<tr data-rep="${r.id}"><td><div class="nm">${esc(r.nome)}</div><div class="sub">${esc(r.ws)}</div></td><td>${temaBadge(r.tema)}</td><td>${recBadge(r.rec)}</td></tr>`).join("")}</tbody></table></div>
      ${sim.length ? `<div class="m-sec"><h4>Possíveis duplicatas (colunas parecidas)</h4><table class="dt"><tbody>${sim.map(e => { const o = TAB.get(e.a === k ? e.b : e.a); return `<tr data-tab="${esc(o.k)}"><td><b>${esc(o.nome)}</b></td><td>${mbar(e.s, 1, cssv("--r-revisar"), e.s.toFixed(2))}</td><td class="num">${e.n} colunas em comum</td></tr>`; }).join("")}</tbody></table></div>` : ""}
      ${co.length ? `<div class="m-sec"><h4>Usada junto com</h4><div class="t-tabs">${co.map(e => { const o = TAB.get(e.a === k ? e.b : e.a); return `<span class="tag click" data-tab="${esc(o.k)}">${esc(o.nome)} · ${e.n}</span>`; }).join("")}</div></div>` : ""}
      <div class="m-sec"><h4>Colunas</h4><div class="t-tabs">${t.cols.map(c => `<span class="tag">${esc(c)}</span>`).join("")}</div></div>`);
  }

  function openColumn(c) {
    openModal(`<div class="m-head"><div class="m-icon" style="background:var(--mint)">C</div><div><div class="kicker">COLUNA COMPARTILHADA</div><h2>${esc(c.c)}</h2>
      <div class="m-meta"><span class="chip">${c.n} tabelas</span><span class="chip">${c.n_ws} workspaces</span><span class="chip">${c.n_temas} temas</span></div></div></div>
      <p class="muted">Colunas presentes em muitas tabelas são candidatas a <b>chave de dimensão conformada</b> ・ padronizar nome, tipo e origem ao montar os modelos por tema.</p>
      <table class="dt"><thead><tr><th>Tabela</th><th>Tema</th><th>Papel</th><th>Relatórios</th></tr></thead><tbody>
      ${c.tabs.map(k => TAB.get(k)).filter(Boolean).sort((a, b) => b.n_reps - a.n_reps).map(t => `<tr data-tab="${esc(t.k)}"><td><b>${esc(t.nome)}</b></td><td>${temaBadge(t.tema)}</td><td>${esc(t.papel)}</td><td class="num">${t.n_reps}</td></tr>`).join("")}
      </tbody></table>`);
  }

  function openPair(e) {
    const A = REP.get(e.a), B = REP.get(e.b);
    const nT = r => new Set(r.tabelas.map(t => normKey(t.t)));
    const ta = nT(A), tb = nT(B);
    const only = (x, y) => [...x].filter(k => !y.has(k));
    const comm = [...ta].filter(k => tb.has(k));
    const tag = k => `<span class="tag ${TAB.has(k) ? "click" : ""}" ${TAB.has(k) ? `data-tab="${esc(k)}"` : ""}>${esc(TAB.get(k)?.nome || k)}</span>`;
    const sug = {
      mesmo_modelo: "Os dois apontam para o mesmo dataset: transformar em páginas de um único relatório.",
      duplicado: "Cópias do mesmo relatório em lugares diferentes: manter a versão oficial (mais usada / produção) e arquivar as demais.",
      nome_igual: "Mesmo nome-base: verificar se são versões do mesmo relatório.",
      alta_sobreposicao: "Modelos muito parecidos: consolidar em um modelo semântico do tema e reaproveitar as medidas.",
      sobreposicao: "Compartilham parte da base: avaliar modelo compartilhado (tabelas-chave do tema).",
      relacionado: "Relação fraca: mesma família de dados.",
    }[e.tipo];
    const card = r => `<div class="m-stat" data-rep="${r.id}" style="cursor:pointer"><div class="kicker">${esc(r.ws)}</div><div class="v" style="font-size:18px">${esc(r.nome)}</div>
      <div class="m-meta" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${temaBadge(r.tema)}${recBadge(r.rec)}</div>
      <div class="l" style="margin-top:6px">${r.views === null ? "sem telemetria" : fmt(r.views) + " views"} · ${r.n_tabelas} tabelas · ${r.n_medidas} medidas · refresh ${r.dias_refresh === null ? "・" : r.dias_refresh + "d"}</div></div>`;
    openModal(`
      <div class="m-head"><div style="flex:1"><div class="kicker">COMPARAÇÃO · ${esc(TIPO_LABEL[e.tipo]).toUpperCase()}</div><h2>${esc(A.nome)} ↔ ${esc(B.nome)}</h2></div></div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">${card(A)}${card(B)}</div>
      <div class="m-sec"><h4>Similaridade</h4>
        ${[["Geral", e.s, "--lime"], ["Tabelas", e.jt, "--mint"], ["Medidas", e.jm, "--t-portfolio"], ["Colunas", e.jc, "--t-cotas"], ["Nome", e.sn, "--ink-3"]].map(([l, v, c]) => `<div style="display:grid;grid-template-columns:90px 1fr;gap:10px;align-items:center;margin-bottom:4px;font-size:12.5px"><span>${l}</span>${mbar(v, 1, cssv(c), v.toFixed(2))}</div>`).join("")}
      </div>
      <p class="muted"><b>Sugestão:</b> ${esc(sug || "")}</p>
      <div class="cmp"><div><h5>Só em ${esc(A.nome)} (${only(ta, tb).length})</h5><div class="t-tabs">${only(ta, tb).map(tag).join("") || '<span class="empty">・</span>'}</div></div>
        <div style="border-color:var(--lime)"><h5>Em comum (${comm.length})</h5><div class="t-tabs">${comm.map(tag).join("") || '<span class="empty">・</span>'}</div></div>
        <div><h5>Só em ${esc(B.nome)} (${only(tb, ta).length})</h5><div class="t-tabs">${only(tb, ta).map(tag).join("") || '<span class="empty">・</span>'}</div></div></div>
      ${e.med_comuns.length ? `<div class="m-sec" style="margin-top:16px"><h4>Medidas em comum (${e.n_med_comuns})</h4><div class="t-tabs">${e.med_comuns.map(m => `<span class="tag">${esc(m)}</span>`).join("")}${e.n_med_comuns > e.med_comuns.length ? `<span class="tag">+${e.n_med_comuns - e.med_comuns.length}</span>` : ""}</div></div>` : ""}`);
  }

  // ==================================================================
  // BUSCA GLOBAL
  // ==================================================================
  const IDX = [];
  D.relatorios.forEach(r => IDX.push({ type: "relatório", label: r.nome, sub: r.ws + (r.historico ? " · histórico" : ""), q: normTxt(r.nome + " " + r.ws), act: () => openReport(r.id) }));
  D.tabelas.forEach(t => IDX.push({ type: "tabela", label: t.nome, sub: `${t.n_reps} relatórios`, q: normTxt(t.nome), act: () => openTable(t.k) }));
  const medMap = new Map();
  ATIVOS.forEach(r => r.medidas.forEach(m => { const k = normTxt(m.m); if (!medMap.has(k)) medMap.set(k, { m: m.m, reps: new Set() }); medMap.get(k).reps.add(r.id); }));
  medMap.forEach((v, k) => IDX.push({ type: "medida", label: v.m, sub: `${v.reps.size} relatório(s)`, q: k, act: () => openReport([...v.reps][0]) }));
  TEMAS.forEach(t => IDX.push({ type: "tema", label: t, sub: "tema-alvo", q: normTxt(t), act: () => openTema(t) }));
  let srSel = 0, srItems = [];
  const SR = $("#searchResults");
  $("#globalSearch").addEventListener("input", e => {
    const q = normTxt(e.target.value.trim());
    if (q.length < 2) { SR.classList.remove("open"); return; }
    const order = { tema: 0, "relatório": 1, tabela: 2, medida: 3 };
    srItems = IDX.filter(x => x.q.includes(q)).sort((a, b) => (order[a.type] - order[b.type]) || (a.q.startsWith(q) ? -1 : 1)).slice(0, 24);
    srSel = 0;
    SR.innerHTML = srItems.length ? srItems.map((x, i) => `<div class="sr ${i === 0 ? "sel" : ""}" data-i="${i}"><span class="sr-type">${x.type}</span><span>${esc(x.label)}</span><small>${esc(x.sub)}</small></div>`).join("") : '<div class="sr"><span class="muted">Nada encontrado</span></div>';
    SR.classList.add("open");
  });
  $("#globalSearch").addEventListener("keydown", e => {
    if (!SR.classList.contains("open") || !srItems.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); srSel = (srSel + (e.key === "ArrowDown" ? 1 : -1) + srItems.length) % srItems.length;
      SR.querySelectorAll(".sr").forEach((el, i) => el.classList.toggle("sel", i === srSel));
    } else if (e.key === "Enter") { srItems[srSel].act(); SR.classList.remove("open"); }
  });
  SR.addEventListener("click", e => { const it = e.target.closest(".sr[data-i]"); if (it) { srItems[+it.dataset.i].act(); SR.classList.remove("open"); } });
  document.addEventListener("click", e => { if (!e.target.closest(".search")) SR.classList.remove("open"); });

  // ==================================================================
  // INIT
  // ==================================================================
  const RENDER = {
    overview: renderOverview,
    graph: renderGraph,
    themes: renderThemes,
    tables: renderTables,
    overlap: renderOverlap,
    health: renderHealth,
    catalog: () => { if (!$("#catTema").options.length || $("#catTema").options.length === 1) renderCatalog(); else renderCatalogTable(); },
  };
  paintIcons();
  $("#topStatus").textContent = `extração ${D.resumo.extracao_em} · ${D.resumo.n_relatorios} relatórios`;
  setupGraphControls();
  setupTableControls();
  RENDER.overview(); rendered.overview = true;
  const h0 = location.hash.replace("#", "");
  if (VIEWS[h0] && h0 !== "overview") go(h0);
  let rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => { Object.keys(rendered).forEach(k => delete rendered[k]); RENDER[current](); rendered[current] = true; }, 250);
  });
})();
