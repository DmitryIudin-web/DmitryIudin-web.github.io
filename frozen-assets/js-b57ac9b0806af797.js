const scriptEl = document.currentScript;
const apiBase = normalizeApiBase(window.AST_NEWS_API_BASE || scriptEl?.dataset.apiBase || "");
const assetBase = normalizeApiBase(apiBase || scriptOrigin(scriptEl?.src));
const newsPageUrl = normalizeUrl(window.AST_NEWS_PAGE_URL || "https://avtonds.ru/news");
const modelPageUrlsEnabled = window.AST_NEWS_MODEL_PAGE_URLS_ENABLED === true;
const modelClusters = [
  { brand: "Mercedes", model: "GLE", slug: "gle" },
  { brand: "Mercedes", model: "S-Class", slug: "s-class" },
  { brand: "Mercedes", model: "G-Class", slug: "g-class" },
  { brand: "BMW", model: "X5", slug: "x5" },
  { brand: "BMW", model: "X7", slug: "x7" },
  { brand: "Porsche", model: "Cayenne", slug: "cayenne" },
  { brand: "Porsche", model: "911", slug: "911" },
  { brand: "Range Rover", model: "Sport", slug: "sport" },
  { brand: "Lamborghini", model: "Urus", slug: "urus" },
  { brand: "Lexus", model: "LX", slug: "lx" },
  { brand: "Lexus", model: "RX", slug: "rx" },
  { brand: "Toyota", model: "Land Cruiser 300", slug: "land-cruiser-300" },
  { brand: "Toyota", model: "Alphard", slug: "alphard" }
];

injectNewsStyles();

const el = {
  total: document.querySelector("#newsTotal"),
  brandGrid: document.querySelector("#brandNewsGrid"),
  newsGrid: document.querySelector("#newsSeoList"),
  newsEmpty: document.querySelector("#newsEmpty"),
  filterWrap: document.querySelector("#newsBrandFilters")
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

async function init() {
  try {
    const { news } = await api("/api/site-news");
    renderNewsPage(news || []);
  } catch (error) {
    if (el.newsEmpty) {
      el.newsEmpty.hidden = false;
      el.newsEmpty.textContent = error.message || "Новости временно недоступны.";
    }
  }
}

function renderNewsPage(news) {
  const brands = brandGroups(news);
  if (el.total) {
    el.total.textContent = String(news.length);
  }
  renderBrandCards(brands);
  renderFilters(brands, news);
  renderNews(news);
}

function renderBrandCards(groups) {
  if (!el.brandGrid) return;
  el.brandGrid.innerHTML = "";
  for (const group of groups) {
    const brandUrl = `${newsPageUrl}/${group.slug}`;
    const modelLinks = modelLinksForBrand(group.brand);
    const card = document.createElement("article");
    card.className = "news-brand-card";
    card.innerHTML = `
      <div>
        <span>${escapeHtml(group.brand)}</span>
        <h3><a href="${escapeAttr(brandUrl)}">Новости ${escapeHtml(group.brand)}</a></h3>
        <p>${escapeHtml(group.latest?.title || "Новости обновляются ежедневно")}</p>
      </div>
      <div class="news-brand-card__meta">
        <a href="${escapeAttr(brandUrl)}">${escapeHtml(pluralNews(group.items.length))}</a>
        <a href="${escapeAttr(brandUrl)}">${escapeHtml(formatDate(group.latest?.publishedAt))}</a>
        ${modelLinks.map((model) => `<a href="${escapeAttr(modelLinkUrl(brandUrl, model))}">${escapeHtml(model.model)}</a>`).join("")}
      </div>
    `;
    el.brandGrid.append(card);
  }
}

function renderFilters(groups, allNews) {
  if (!el.filterWrap) return;
  el.filterWrap.innerHTML = "";
  const filters = [{ brand: "Все", slug: "all", items: allNews }, ...groups];
  for (const filter of filters) {
    const link = document.createElement("a");
    link.href = filter.slug === "all" ? newsPageUrl : `${newsPageUrl}/${filter.slug}`;
    link.textContent = filter.brand;
    link.className = filter.slug === "all" ? "active" : "";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      el.filterWrap.querySelectorAll("a").forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
      renderNews(filter.items);
      history.replaceState(null, "", filter.slug === "all" ? new URL(newsPageUrl).pathname : `#${filter.slug}`);
    });
    el.filterWrap.append(link);
  }

  const activeSlug = location.hash.replace(/^#/, "");
  const active = filters.find((item) => item.slug === activeSlug);
  if (active && active.slug !== "all") {
    el.filterWrap.querySelectorAll("a").forEach((item) => item.classList.remove("active"));
    const link = [...el.filterWrap.querySelectorAll("a")].find((item) => item.textContent === active.brand);
    if (link) link.classList.add("active");
    renderNews(active.items);
  }
}

function renderNews(news) {
  if (!el.newsGrid || !el.newsEmpty) return;
  el.newsGrid.innerHTML = "";
  el.newsEmpty.hidden = news.length > 0;
  for (const item of news) {
    const card = document.createElement("article");
    card.className = "news-seo-item";
    card.innerHTML = `
      <div class="news-card__top">
        <span>${escapeHtml(item.brand)}</span>
        <time datetime="${escapeAttr(item.publishedAt)}">${escapeHtml(formatDate(item.publishedAt))}</time>
      </div>
      <h3><a href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(item.title)}</a></h3>
      <p>${escapeHtml(item.summary || "")}</p>
      <div class="news-card__source">
        <span>${escapeHtml(item.sourceName || "Источник")}</span>
        <a href="${escapeAttr(item.sourceUrl || item.url)}" target="_blank" rel="noopener noreferrer nofollow">Открыть источник</a>
      </div>
    `;
    el.newsGrid.append(card);
  }
}

async function api(path) {
  const response = await fetch(`${apiBase}${path}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.error || `HTTP ${response.status}`);
  }
  return body;
}

function brandGroups(news) {
  const groups = new Map();
  for (const item of news) {
    if (!groups.has(item.brand)) {
      groups.set(item.brand, []);
    }
    groups.get(item.brand).push(item);
  }
  return [...groups.entries()]
    .map(([brand, items]) => ({
      brand,
      slug: slugify(brand),
      items,
      latest: items[0] || null
    }))
    .sort((left, right) => left.brand.localeCompare(right.brand, "ru"));
}

function modelLinksForBrand(brand) {
  return modelClusters.filter((item) => item.brand === brand);
}

function modelLinkUrl(brandUrl, model) {
  return modelPageUrlsEnabled ? `${brandUrl}/${model.slug}` : `${brandUrl}#${model.slug}`;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9а-яё]+/giu, "-")
    .replace(/^-+|-+$/g, "");
}

function pluralNews(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} новость`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} новости`;
  return `${count} новостей`;
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value)) : "";
}

function normalizeApiBase(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeUrl(value) {
  return String(value || "").replace(/\/+$/, "") || "https://avtonds.ru/news";
}

function scriptOrigin(value) {
  try {
    return value ? new URL(value).origin : "";
  } catch {
    return "";
  }
}

function assetUrl(path) {
  const normalizedPath = `/${String(path || "").replace(/^\/+/, "")}`;
  return assetBase ? `${assetBase}${normalizedPath}` : normalizedPath;
}

function injectNewsStyles() {
  if (!document.querySelector('link[data-ast-news-css="1"]')) {
    const link = document.createElement("link");
    link.dataset.astNewsCss = "1";
    link.rel = "stylesheet";
    link.href = `${assetUrl("styles.css")}?v=20260511-news-models`;
    document.head.append(link);
  }

  if (document.querySelector("style[data-ast-news-critical]")) {
    return;
  }

  const style = document.createElement("style");
  style.dataset.astNewsCritical = "1";
  style.textContent = `
    .ast-site-root{color:#111;background:#f5f6f8;font-family:TildaSans,Inter,Arial,sans-serif;line-height:1.45;min-height:100vh}
    .ast-site-root *,.ast-site-root *::before,.ast-site-root *::after{box-sizing:border-box;letter-spacing:0}
    .ast-site-root a{color:inherit}
    .ast-inner{width:min(1200px,calc(100% - 48px));margin:0 auto}
    .ast-nav{position:sticky;top:0;z-index:40;background:rgba(248,249,250,.96);color:#111;border-bottom:1px solid rgba(17,17,17,.08);backdrop-filter:blur(14px)}
    .ast-nav__inner{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:18px;min-width:0}
    .ast-logo{display:inline-flex;align-items:center;flex-shrink:0;text-decoration:none}
    .ast-logo img{width:54px!important;height:54px!important;display:block;object-fit:contain;border-radius:6px;background:#000;box-shadow:0 10px 28px rgba(0,0,0,.14)}
    .ast-logo--footer img{width:44px!important;height:44px!important;box-shadow:none}
    .ast-menu{display:flex;align-items:center;justify-content:flex-start;flex-wrap:nowrap;gap:8px;margin-left:auto;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
    .ast-menu::-webkit-scrollbar{display:none}
    .ast-menu__link{min-height:40px;display:inline-flex;align-items:center;justify-content:center;padding:9px 14px;border-radius:8px;border:1px solid rgba(17,17,17,.10);background:rgba(255,255,255,.86);color:#202429!important;text-decoration:none;font-size:14px;font-weight:650;white-space:nowrap;box-shadow:0 8px 20px rgba(15,17,20,.04)}
    .ast-menu__link:hover,.ast-menu__link:focus-visible{border-color:rgba(215,25,32,.42);background:#fff;color:#111!important}
    .ast-menu__link.is-current{border-color:#d71920;background:#d71920;color:#fff!important}
    .news-hero{color:#fff;background:linear-gradient(96deg,rgba(6,6,7,.94),rgba(6,6,7,.76)),#101214}
    .news-hero__grid{min-height:460px;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:34px;align-items:center;padding:72px 0}
    .ast-breadcrumbs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;font-size:13px;color:rgba(255,255,255,.78)}
    .ast-breadcrumbs a{color:rgba(255,255,255,.86);text-decoration:none}
    .ast-kicker,.ast-path__eyebrow{display:inline-flex;align-items:center;min-height:32px;padding:5px 10px;border-radius:8px;font-size:13px;font-weight:700}
    .ast-kicker{margin-bottom:18px;border:1px solid rgba(255,255,255,.24);color:rgba(255,255,255,.92);background:rgba(255,255,255,.08)}
    .ast-path__eyebrow{margin-bottom:14px;background:rgba(215,25,32,.08);color:#d71920}
    .news-hero h1{max-width:850px;margin:0;color:#fff;font-size:64px;line-height:1.02}
    .ast-hero__lead{margin:22px 0 0;max-width:760px;font-size:22px;color:rgba(255,255,255,.92)}
    .news-hero__actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
    .ast-btn{min-height:50px;display:inline-flex;align-items:center;justify-content:center;padding:13px 20px;border-radius:8px;border:1px solid #b3151b;background:#b3151b;color:#fff!important;font-weight:750;text-decoration:none;cursor:pointer;box-shadow:0 16px 34px rgba(179,21,27,.18)}
    .ast-btn--ghost{background:transparent;border-color:rgba(255,255,255,.58);color:#fff!important;box-shadow:none}
    .news-hero__panel{min-height:260px;display:flex;flex-direction:column;justify-content:flex-end;gap:12px;padding:28px;border-radius:8px;background:#d71920;color:#fff}
    .news-hero__panel span,.news-hero__panel p{margin:0;color:rgba(255,255,255,.78)}
    .news-hero__panel strong{color:#fff;font-size:64px;line-height:.9}
    .ast-section{padding:86px 0}
    .ast-section--muted{background:#eef2f5}
    .ast-section-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:28px}
    .ast-section h2{margin:0;color:#111;font-size:44px;line-height:1.16}
    .ast-subtitle{margin:0;max-width:620px;color:#5b626b;font-size:18px;line-height:1.58}
    .brand-news-grid,.news-seo-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
    .news-brand-card,.news-seo-item{display:flex;flex-direction:column;min-height:245px;gap:16px;padding:22px;border:1px solid #dadde2;border-radius:8px;background:#fff;box-shadow:0 18px 40px rgba(15,17,20,.04)}
    .news-brand-card span,.news-card__top span{color:#d71920;font-size:13px;font-weight:750;text-transform:uppercase}
    .news-brand-card h3,.news-seo-item h3{margin:6px 0 0;color:#111;font-size:24px;line-height:1.18}
    .news-brand-card h3 a,.news-seo-item h3 a,.news-brand-card__meta a{color:inherit;text-decoration:none}
    .news-brand-card p,.news-seo-item p,.news-cta-band p{margin:0;color:#5b626b;line-height:1.55}
    .news-brand-card__meta,.news-date-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto}
    .news-brand-card__meta a,.news-date-tabs a{min-height:38px;display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:8px;background:#eef2f5;color:#111!important;text-decoration:none;font-weight:700}
    .news-date-tabs{margin:0 0 18px}
    .news-date-tabs a.active,.news-date-tabs a.is-active{background:#111;color:#fff!important}
    .news-card__top,.news-card__source{display:flex;align-items:center;justify-content:space-between;gap:14px}
    .news-card__top time,.news-card__source span{color:#5b626b}
    .news-card__source{margin-top:auto;padding-top:14px;border-top:1px solid #e1e4e8}
    .news-card__source a{color:#b3151b!important;font-weight:750;text-decoration:none}
    .public-empty{padding:22px;border:1px solid #dadde2;border-radius:8px;background:#fff;color:#5b626b}
    .news-cta-band{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:30px;border-radius:8px;background:#fff;border:1px solid #dadde2}
    .ast-footer{background:#101214;color:#fff;padding:28px 0}
    .ast-footer__inner,.ast-footer__brand{display:flex;align-items:center;justify-content:space-between;gap:16px}
    .ast-footer__brand{justify-content:flex-start}
    .ast-footer span,.ast-footer a{color:rgba(255,255,255,.78);text-decoration:none}
    @media (max-width:980px){.news-hero__grid{grid-template-columns:1fr;min-height:0}.brand-news-grid,.news-seo-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media (max-width:680px){.ast-inner{width:min(100% - 28px,1200px)}.ast-nav__inner,.ast-section-head,.news-cta-band,.ast-footer__inner{align-items:flex-start;flex-direction:column}.ast-nav__inner{min-height:0;padding:12px 0}.news-hero__grid{padding:54px 0 42px}.news-hero h1{font-size:42px}.ast-hero__lead{font-size:18px}.ast-section{padding:54px 0}.ast-section h2{font-size:34px}.brand-news-grid,.news-seo-list{grid-template-columns:1fr}}
  `;
  document.head.append(style);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
