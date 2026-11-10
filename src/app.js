const API = "https://content.guardianapis.com";
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
let settings = store.get("gn-settings", { key: "", edition: "international", size: "m" });
const SIZES = { s: "1.0rem", m: "1.125rem", l: "1.25rem" };
const app = document.getElementById("app");
const articleCache = new Map();

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const plain = html => { const d = document.createElement("div"); d.innerHTML = html || ""; return d.textContent.trim(); };
const sharper = url => url ? url.replace(/\/500\.jpg$/, "/1000.jpg") : "";
const imgTag = (src, alt = "", big = false) => src
  ? `<img src="${esc(big ? sharper(src) : src)}" alt="${esc(alt)}" loading="lazy" ${big ? `onerror="this.onerror=null;this.src='${esc(src)}'"` : ""}>` : "";
const fmtDate = d => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

function applySize() { document.documentElement.style.setProperty("--body-size", SIZES[settings.size] || SIZES.m); }
applySize();

async function api(path, params = {}) {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries({ ...params, "api-key": settings.key })) u.searchParams.set(k, v);
  let r;
  try { r = await fetch(u); } catch { throw new Error("network"); }
  if (r.status === 401 || r.status === 403) throw new Error("auth");
  if (r.status === 429) throw new Error("limit");
  if (!r.ok) throw new Error("http");
  return (await r.json()).response;
}

function errorView(e, retry) {
  const msg = {
    auth: "The API key was not accepted. Check it in Settings.",
    limit: "The daily or per-minute request limit was reached. Try again later.",
    network: "Could not reach the Guardian API. Check your connection."
  }[e.message] || "Something went wrong loading this page.";
  app.innerHTML = `<div class="wrap state"><p>${msg}</p><button class="primary" id="retry">Try again</button></div>`;
  document.getElementById("retry").onclick = retry;
}

/* ---------- Cover ---------- */
const BLOCKS = [
  { title: "Headlines", path: () => "/" + settings.edition, n: 9, kicker: true },
  { title: "Opinion", path: () => "/commentisfree", n: 6, opinion: true },
  { title: "Sport", path: () => "/sport", n: 6 },
  { title: "Culture", path: () => "/culture", n: 6 },
  { title: "Lifestyle", path: () => "/lifeandstyle", n: 6 },
  { title: "Environment", path: () => "/environment", n: 6 },
  { title: "Business", path: () => "/business", n: 6 },
  { title: "Technology", path: () => "/technology", n: 6 }
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const editionName = e => ({ europe: "Europe", uk: "UK", us: "US", au: "Australia", international: "International" }[e] || e);

async function loadBlock(b, force) {
  const ck = "gn-block-" + b.path();
  const cached = store.get(ck, null);
  if (cached && !force && Date.now() - cached.t < 10 * 60 * 1000) return cached.d;
  const params = { "show-editors-picks": "true", "show-fields": "trailText,thumbnail,byline", "page-size": "12" };
  let r;
  try { r = await api(b.path(), params); }
  catch (e) { if (e.message !== "limit") throw e; await sleep(1100); r = await api(b.path(), params); }
  const picks = r.editorsPicks || [];
  const items = (picks.length >= 4 ? picks : [...picks, ...(r.results || []).filter(x => !picks.some(p => p.id === x.id))]).slice(0, b.n);
  store.set(ck, { t: Date.now(), d: items });
  return items;
}

function card(s, i, b) {
  const size = i === 0 ? "big" : i <= 4 ? "mid" : "small";
  const f = s.fields || {};
  const top = b.opinion && f.byline ? `<div class="by">${esc(f.byline)}</div>`
            : b.kicker ? `<span class="label">${esc(s.sectionName)}</span>` : "";
  const img = size !== "small" && f.thumbnail ? `<div class="img">${imgTag(f.thumbnail, "", size === "big")}</div>` : "";
  const text = `<div>${top}<h3>${esc(s.webTitle)}</h3>${size !== "small" ? `<p>${esc(plain(f.trailText))}</p>` : ""}</div>`;
  return `<a class="card ${size}" href="#/a/${encodeURI(s.id)}">${size === "big" ? img + text : text + img}</a>`;
}

async function cover(force = false) {
  setBar("cover");
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  app.innerHTML = `<div class="wrap">
    <header class="masthead"><span class="label">${esc(today)}</span><h1>Night edition</h1>
      <p class="muted">Stories from The Guardian, ${esc(editionName(settings.edition))} edition</p></header>
    ${BLOCKS.map((b, i) => `<section class="block" id="block-${i}"><h2 class="block-title">${b.title}</h2><div class="skeleton"></div></section>`).join("")}
    <footer class="foot">Content from the <a href="https://open-platform.theguardian.com/" target="_blank" rel="noopener">Guardian Open Platform</a>. Other sections open on <a href="https://www.theguardian.com/" target="_blank" rel="noopener">theguardian.com</a>.</footer>
  </div>`;
  const token = (cover.token = (cover.token || 0) + 1);
  for (let i = 0; i < BLOCKS.length; i++) {
    const b = BLOCKS[i];
    let items;
    try { items = await loadBlock(b, force); }
    catch (e) {
      if (i === 0) return errorView(e, () => cover(true));
      items = [];
    }
    if (token !== cover.token) return; // user navigated away or refreshed
    const el = document.getElementById("block-" + i);
    if (!el) return;
    if (!items.length) { el.remove(); continue; }
    el.innerHTML = `<h2 class="block-title">${b.title}</h2><div class="cards">${items.map((s, j) => card(s, j, b)).join("")}</div>`;
  }
}

/* ---------- Article ---------- */
function clean(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,form,link,meta,aside.element-rich-link,.element-rich-link").forEach(n => n.remove());
  doc.querySelectorAll("*").forEach(el => {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name) || a.name === "style") el.removeAttribute(a.name);
      if ((a.name === "href" || a.name === "src") && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    }
  });
  doc.querySelectorAll("a[href]").forEach(a => {
    const m = a.getAttribute("href").match(/^https?:\/\/(?:www\.)?theguardian\.com\/([^?#]+\/\d{4}\/[a-z]{3}\/\d{2}\/[^?#]+)/);
    if (m) a.setAttribute("href", "#/a/" + m[1]);
    else { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
  });
  doc.querySelectorAll("img").forEach(i => i.setAttribute("loading", "lazy"));
  return doc.body.innerHTML;
}

async function article(id) {
  setBar("article");
  let c = articleCache.get(id);
  if (!c) {
    app.innerHTML = `<div class="wrap state">Loading the article…</div>`;
    try {
      const r = await api("/" + id, { "show-fields": "headline,standfirst,byline,body,thumbnail,wordcount,firstPublicationDate", "show-tags": "contributor" });
      c = r.content; articleCache.set(id, c);
    } catch (e) { return errorView(e, () => article(id)); }
  }
  const f = c.fields || {};
  const mins = Math.max(1, Math.round((+f.wordcount || 0) / 230));
  document.title = c.webTitle + " · Night edition";
  app.innerHTML = `<article class="article">
    <span class="label">${esc(c.sectionName)}</span>
    <h1>${esc(f.headline || c.webTitle)}</h1>
    ${f.standfirst ? `<div class="standfirst">${clean(f.standfirst)}</div>` : ""}
    <div class="meta">${f.byline ? `<strong>${esc(f.byline)}</strong><br>` : ""}${fmtDate(f.firstPublicationDate || c.webPublicationDate)}${f.wordcount ? `, ${mins} min read` : ""}</div>
    ${f.thumbnail && !/<figure/i.test((f.body || "").slice(0, 400)) ? `<div class="hero">${imgTag(f.thumbnail, "", true)}</div>` : ""}
    <div class="body">${clean(f.body) || `<p class="muted">The full text is not available through the API.</p>`}</div>
    <div class="end"><a href="#/">Back to cover</a><a href="${esc(c.webUrl)}" target="_blank" rel="noopener">Open on theguardian.com</a></div>
  </article>`;
  window.scrollTo(0, 0);
}

/* ---------- Settings ---------- */
function settingsView(first = false) {
  setBar("settings");
  app.innerHTML = `<div class="panel">
    <span class="label">${first ? "Setup" : "Settings"}</span>
    <h1>${first ? "Add your API key" : "Settings"}</h1>
    ${first ? `<p>Get a free developer key at <a href="https://open-platform.theguardian.com/access/" target="_blank" rel="noopener">open-platform.theguardian.com/access</a>. It is stored only in this browser.</p>` : ""}
    <label class="field"><span class="label">API key</span>
      <input id="key" value="${esc(settings.key)}" autocomplete="off" spellcheck="false" placeholder="Paste key"></label>
    <label class="field"><span class="label">Edition</span>
      <select id="edition">${["europe","international","uk","us","au"].map(e => `<option value="${e}" ${e === settings.edition ? "selected" : ""}>${editionName(e)}</option>`).join("")}</select></label>
    <div class="field"><span class="label">Article text size</span>
      <div class="seg" id="size">${["s","m","l"].map(s => `<button type="button" data-s="${s}" aria-pressed="${s === settings.size}">${{s:"Small",m:"Medium",l:"Large"}[s]}</button>`).join("")}</div></div>
    <button class="primary" id="save" type="button">Save</button>
  </div>`;
  let size = settings.size;
  document.querySelectorAll("#size button").forEach(b => b.onclick = () => {
    size = b.dataset.s;
    document.querySelectorAll("#size button").forEach(x => x.setAttribute("aria-pressed", x === b));
  });
  document.getElementById("save").onclick = () => {
    const key = document.getElementById("key").value.trim();
    if (!key) { document.getElementById("key").focus(); return; }
    const editionChanged = document.getElementById("edition").value !== settings.edition;
    settings = { key, edition: document.getElementById("edition").value, size };
    store.set("gn-settings", settings); applySize();
    if (editionChanged) localStorage.removeItem("gn-block-/" + settings.edition);
    location.hash = "#/";
  };
}

/* ---------- Routing and bar ---------- */
const left = document.getElementById("nav-left"), right = document.getElementById("nav-right");
function setBar(view) {
  left.textContent = view === "cover" ? "Refresh" : "Cover";
  left.onclick = view === "cover" ? () => cover(true) : () => { location.hash = "#/"; };
  right.style.visibility = view === "settings" ? "hidden" : "visible";
  right.onclick = () => { location.hash = "#/settings"; };
  document.getElementById("progress").style.width = "0";
  if (view !== "article") document.title = "Night edition";
}
function route() {
  const h = decodeURI(location.hash.slice(1));
  if (!settings.key) return settingsView(true);
  if (h.startsWith("/a/")) return article(h.slice(3));
  if (h === "/settings") return settingsView();
  cover();
}
window.addEventListener("hashchange", route);
window.addEventListener("scroll", () => {
  if (!location.hash.startsWith("#/a/")) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  document.getElementById("progress").style.width = (max > 0 ? Math.min(100, scrollY / max * 100) : 0) + "%";
}, { passive: true });
route();
