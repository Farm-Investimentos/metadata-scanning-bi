/* =========================================================================
   Shell compartilhado (Catálogo analítico + Inventário)
   Sidebar recolhível com entalhe, menu mobile, spotlight dos cards,
   topbar com vidro ao rolar e abertura/fechamento animado dos modais.
   Carregar ANTES do script da página (app.js / inventario.js).
   ========================================================================= */
(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem storage */ } },
  };

  const ICO = {
    chev: '<path d="M15 6l-6 6 6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    tree: '<rect x="3" y="3" width="6" height="5" rx="1.2"/><rect x="15" y="9.5" width="6" height="5" rx="1.2"/><rect x="15" y="16" width="6" height="5" rx="1.2"/><path d="M6 8v10.5h9M6 12h9"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/><rect x="2.5" y="2.5" width="19" height="19" rx="4" opacity=".45"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/><path d="M8 7h8M8 10.5h5"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    filter: '<path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
  };
  const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICO[n] || ""}</svg>`;
  const paint = (root = document) => root.querySelectorAll("i[data-ico]").forEach(i => { if (!i.innerHTML && ICO[i.dataset.ico]) i.innerHTML = ico(i.dataset.ico); });

  const app = $(".app"), sidebar = $(".sidebar");
  const desktop = () => matchMedia("(min-width: 1081px)").matches;

  // ------------------------------------------------------------- recolher / expandir
  if (store.get("ft-sb") === "1") {
    app.style.transition = "none"; app.classList.add("collapsed");
    requestAnimationFrame(() => requestAnimationFrame(() => { app.style.transition = ""; }));
  }
  const toggle = $("#sbToggle");
  function syncToggle() {
    const c = app.classList.contains("collapsed");
    if (toggle) { toggle.setAttribute("aria-expanded", String(!c)); toggle.setAttribute("aria-label", c ? "Expandir menu" : "Recolher menu"); toggle.title = c ? "Expandir menu" : "Recolher menu"; }
  }
  syncToggle();
  let relayout;
  toggle && toggle.addEventListener("click", () => {
    app.classList.toggle("collapsed");
    store.set("ft-sb", app.classList.contains("collapsed") ? "1" : "0");
    syncToggle(); hideTip();
    // os gráficos se redesenham quando a coluna termina de animar
    clearTimeout(relayout);
    relayout = setTimeout(() => dispatchEvent(new Event("resize")), 580);
  });

  // ------------------------------------------------------------- menu mobile
  // dentro do .app, para ficar abaixo da sidebar no mesmo contexto de empilhamento
  const scrim = document.createElement("div"); scrim.className = "scrim"; app.insertBefore(scrim, sidebar);
  const syncScrim = () => scrim.classList.toggle("on", sidebar.classList.contains("open") && !desktop());
  new MutationObserver(syncScrim).observe(sidebar, { attributes: true, attributeFilter: ["class"] });
  const menuBtn = $("#menuBtn");
  menuBtn && menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
  scrim.addEventListener("click", () => sidebar.classList.remove("open"));
  sidebar.addEventListener("click", e => { if (!desktop() && e.target.closest(".nav button, .nav a")) sidebar.classList.remove("open"); });

  // ------------------------------------------------------------- dica da sidebar recolhida
  const tipEl = document.createElement("div"); tipEl.className = "sb-tip"; document.body.appendChild(tipEl);
  function hideTip() { tipEl.classList.remove("on"); }
  sidebar.addEventListener("pointerover", e => {
    const el = e.target.closest("[data-label]");
    if (!el || !app.classList.contains("collapsed") || !desktop()) return hideTip();
    const r = el.getBoundingClientRect();
    tipEl.textContent = el.dataset.label;
    tipEl.style.left = (sidebar.getBoundingClientRect().right + 14) + "px";
    tipEl.style.top = (r.top + r.height / 2) + "px";
    tipEl.classList.add("on");
  });
  sidebar.addEventListener("pointerleave", hideTip);

  // ------------------------------------------------------------- spotlight nos cards de vidro
  let spotRaf = 0, lastEv = null;
  document.addEventListener("pointermove", e => {
    lastEv = e;
    if (spotRaf) return;
    spotRaf = requestAnimationFrame(() => {
      spotRaf = 0;
      const g = lastEv.target.closest && lastEv.target.closest(".glass");
      if (!g) return;
      const r = g.getBoundingClientRect();
      g.style.setProperty("--mx", (lastEv.clientX - r.left) + "px");
      g.style.setProperty("--my", (lastEv.clientY - r.top) + "px");
    });
  }, { passive: true });

  // ------------------------------------------------------------- topbar com vidro ao rolar
  const top = $(".topbar");
  const onScroll = () => top && top.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // ------------------------------------------------------------- atalho de busca
  addEventListener("keydown", e => {
    const s = $("#globalSearch");
    if (!s) return;
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName))) {
      e.preventDefault(); s.focus(); s.select();
    }
  });

  // ------------------------------------------------------------- modal: nasce do ponto clicado
  let px = innerWidth / 2, py = innerHeight * .3;
  addEventListener("pointerdown", e => { px = e.clientX; py = e.clientY; }, true);
  const modalBk = $("#modal");
  if (modalBk) {
    new MutationObserver(() => {
      if (!modalBk.classList.contains("open") || modalBk._wasOpen) { modalBk._wasOpen = modalBk.classList.contains("open"); return; }
      modalBk._wasOpen = true;
      modalBk.style.setProperty("--ox", (px / innerWidth * 100) + "%");
      modalBk.style.setProperty("--oy", (py / innerHeight * 100) + "%");
      const m = modalBk.querySelector(".modal"), r = m.getBoundingClientRect();
      m.style.setProperty("--to-x", Math.max(0, Math.min(r.width, px - r.left)) + "px");
      m.style.setProperty("--to-y", Math.max(0, Math.min(r.height, py - r.top)) + "px");
      // reinicia a animação mesmo se o modal for reaberto em seguida
      m.style.animation = "none"; void m.offsetWidth; m.style.animation = "";
    }).observe(modalBk, { attributes: true, attributeFilter: ["class"] });
  }
  function closeModal(done) {
    if (!modalBk || !modalBk.classList.contains("open") || modalBk.classList.contains("closing")) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    modalBk.classList.add("closing");
    setTimeout(() => {
      if (!modalBk.classList.contains("closing")) return;  // reaberto durante a saída
      modalBk.classList.remove("open", "closing"); modalBk.setAttribute("aria-hidden", "true");
      modalBk._wasOpen = false;
      if (done) done();
    }, reduce ? 0 : 250);
  }

  // ------------------------------------------------------------- faixa de uso (aba "Uso" dos modais)
  // criação ── antes da telemetria ──[ janela do Usage Metrics: 1ª view · última view ]── sem dados ── extração
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dia = s => s ? Date.parse(s.slice(0, 10) + "T00:00:00Z") / 864e5 : null;
  const br = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—";
  const isoBR = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
  const nDias = n => `${Math.round(n)} dia${Math.round(n) === 1 ? "" : "s"}`;
  function usoFaixa(r, extracaoBR) {
    const ext = isoBR(extracaoBR);
    if (!r.tel_desde && !r.uso_ate) return `<p class="empty">Sem telemetria: o workspace não tem modelo <i>Usage Metrics</i> acessível.</p>`;
    const ini = r.criado && dia(r.criado) < dia(r.tel_desde || r.uso_ate) ? r.criado : (r.tel_desde || r.uso_ate);
    const a = dia(ini), b = dia(r.tel_desde || r.uso_ate), c = dia(r.uso_ate || r.tel_desde), e = Math.max(dia(ext) || c, c);
    const seg = [
      { k: "pre", d: b - a, t: "antes da telemetria", ini, fim: r.tel_desde },
      { k: "win", d: Math.max(1, c - b), t: "coberto pelo Usage Metrics", ini: r.tel_desde, fim: r.uso_ate },
      { k: r.tel_congelada ? "gap" : "ok", d: e - c, t: r.tel_congelada ? "sem dados (modelo de uso parado)" : "até a extração", ini: r.uso_ate, fim: ext },
    ].filter(s => s.d > 0 || s.k === "win");
    // largura mínima por trecho, para a janela de ~30 dias não sumir ao lado de anos
    const tot = seg.reduce((s, x) => s + x.d, 0) || 1;
    seg.forEach(s => s.w = Math.max(s.k === "win" ? 34 : 14, s.d / tot * 100));
    const sw = seg.reduce((s, x) => s + x.w, 0);
    seg.forEach(s => s.w = s.w / sw * 100);
    const win = seg.find(s => s.k === "win"), off = seg.slice(0, seg.indexOf(win)).reduce((s, x) => s + x.w, 0);
    const pos = d => off + Math.min(1, Math.max(0, (dia(d) - b) / Math.max(1, c - b))) * win.w;
    const mk = (d, cls, rot) => d ? `<span class="uf-mk ${cls}" style="left:${pos(d)}%" title="${esc(rot)}: ${br(d)}"><b>${esc(rot)}</b><small>${br(d)}</small></span>` : "";
    return `<div class="uso-faixa">
      <div class="uf-bar">${seg.map(s => `<span class="uf-seg ${s.k}" style="width:${s.w}%" title="${esc(s.t)}: ${br(s.ini)} a ${br(s.fim)} (${nDias(s.d)})"></span>`).join("")}
        ${mk(r.ult_vis, "last", "última view")}</div>
      <div class="uf-legs">${seg.map(s => `<span class="uf-leg ${s.k}" style="width:${s.w}%"><i></i><b>${esc(s.t)}</b><small>${br(s.ini)} → ${br(s.fim)} · ${nDias(s.d)}</small></span>`).join("")}</div>
      <div class="uf-ends"><span>${r.criado && ini === r.criado ? "criação do relatório" : "início da telemetria"}</span><span>extração</span></div>
    </div>`;
  }

  // ------------------------------------------------------------- o que é cada tema (legenda compartilhada)
  // Texto simples, derivado do dicionário PALAVRAS de 02-processamento/gerar_catalogo.py
  const TEMA_DESC = {
    "Solicitações": "Pedidos de crédito e o caminho até a decisão: motor, análise, aprovação, recusa, onboarding e formalização.",
    "Portfólio": "Carteira já concedida: estoque, desembolsos, vencimentos, inadimplência, safra, cessão e TIR.",
    "Risco": "Acompanhamento do risco: rating, concentração, exposição, garantias, enquadramento e diligências.",
    "Cotas": "Fundos e cotas: patrimônio (PL), subordinação, FIDC, rentabilidade e CDI.",
    "Limites": "Limites de crédito: limite operacional, DPP, crédito disponível e exposição total.",
    "PDD": "Provisão para perdas: PDD, perda esperada, excesso de spread e write-off.",
    "Compliance": "Pareceres e checagens: KYC/PLD, bureaus, processos, PEP, listas restritivas e antecipados.",
    "Cliente": "Quem é o cliente: cadastro, cedente, devedor, produtor, revendas, grupos econômicos e contato.",
    "Outros": "Não se encaixou em nenhum tema pelas palavras-chave: precisa de classificação manual.",
  };
  const temaDesc = t => TEMA_DESC[t] || "";
  // grade "o que é cada tema"; cor(t) devolve a cor do tema, n(t) a contagem (opcional), attr = atributo de clique
  const temaLegenda = (temas, cor, n, attr = "data-tema") => `<div class="tema-leg">${temas.map(t => `
    <button class="tl" ${attr}="${esc(t)}" style="--tc:${cor(t)}"><span class="tl-dot"></span>
      <span class="tl-t"><b>${esc(t)}${n ? ` <small>${n(t)}</small>` : ""}</b><span>${esc(temaDesc(t))}</span></span></button>`).join("")}</div>`;

  paint();
  window.FTShell = { ico, paint, closeModal, store, usoFaixa, br, temaDesc, temaLegenda };
})();
