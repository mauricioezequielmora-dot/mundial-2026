(() => {
  "use strict";

  const CACHE_KEY = "central-mundialista-noticias-v1";
  const REFRESH_MS = 15 * 60 * 1000;
  const TIMEOUT_MS = 12000;
  const MAX_ITEMS = 6;
  const TRUSTED_DOMAINS = [
    "fifa.com",
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "espn.com",
    "theguardian.com",
    "cnn.com",
    "clarin.com",
    "lanacion.com.ar",
    "infobae.com",
    "ole.com.ar",
    "tycsports.com",
    "elpais.com",
    "as.com",
    "marca.com"
  ];

  let items = readCache();
  let timer = null;
  let loading = false;

  function normalizeDomain(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
  }

  function isTrusted(domain) {
    const normalized = normalizeDomain(domain);
    return TRUSTED_DOMAINS.some(allowed => normalized === allowed || normalized.endsWith(`.${allowed}`));
  }

  function parseSeenDate(value) {
    const raw = String(value || "");
    const match = raw.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})/);
    if (!match) return null;
    const [, year, month, day, hour, minute, second] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function normalizeArticle(article) {
    const title = String(article?.title || "").replace(/\s+/g, " ").trim();
    const domain = normalizeDomain(article?.domain || "");
    const url = String(article?.url || "").trim();
    const seenDate = parseSeenDate(article?.seendate);
    if (!title || !domain || !url || !isTrusted(domain)) return null;
    return {
      title: title.slice(0, 180),
      domain,
      url,
      seenAt: seenDate ? seenDate.toISOString() : ""
    };
  }

  function uniqueArticles(list) {
    const seen = new Set();
    const normalized = [];
    for (const article of list) {
      const item = normalizeArticle(article);
      if (!item) continue;
      const key = `${item.domain}|${item.title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(item);
      if (normalized.length >= MAX_ITEMS) break;
    }
    return normalized;
  }

  function readCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!parsed || !Array.isArray(parsed.items)) return [];
      return parsed.items.filter(item => item && item.title && item.domain).slice(0, MAX_ITEMS);
    } catch {
      return [];
    }
  }

  function writeCache(nextItems) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ items: nextItems, savedAt: Date.now() }));
    } catch (error) {
      console.warn("No se pudieron guardar las noticias automáticas:", error);
    }
  }

  function buildEndpoint() {
    const query = '("FIFA World Cup 2026" OR "Copa Mundial 2026")';
    const params = new URLSearchParams({
      query,
      mode: "artlist",
      maxrecords: "40",
      format: "json",
      sort: "datedesc",
      timespan: "48h"
    });
    return `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
  }

  async function refresh() {
    if (loading) return items;
    loading = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(buildEndpoint(), {
        cache: "no-store",
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const nextItems = uniqueArticles(Array.isArray(payload?.articles) ? payload.articles : []);
      if (nextItems.length) {
        items = nextItems;
        writeCache(items);
        window.dispatchEvent(new CustomEvent("central-news-updated", { detail: { count: items.length } }));
      }
    } catch (error) {
      console.warn("No se pudieron actualizar las noticias automáticas; se conserva la última copia:", error);
    } finally {
      clearTimeout(timeout);
      loading = false;
    }
    return items;
  }

  function start() {
    refresh();
    clearInterval(timer);
    timer = setInterval(refresh, REFRESH_MS);
  }

  window.CentralNews = {
    getItems: () => items.map(item => ({ ...item })),
    refresh
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
