import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { chromium } from "playwright";
import { SearchHit } from "./types";

type GoogleSearchOptions = {
  count: number;
  timeoutMs?: number;
  userAgent?: string;
  usePlaywrightFallback?: boolean;
  playwrightWsEndpoint?: string;
};

const DEFAULT_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export async function googleSearch(
  query: string,
  options: GoogleSearchOptions
): Promise<SearchHit[]> {
  const count = Math.min(Math.max(options.count, 1), 100);
  const debug =
    process.env.DEBUG_JOBS === "1" || process.env.NODE_ENV !== "production";
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(count));
  url.searchParams.set("hl", "en");

  let html = "";
  let parsed: SearchHit[] = [];

  try {
    html = await fetchHtml(url.toString(), options.timeoutMs, options.userAgent);
    parsed = parseGoogleHtml(html);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (debug) {
      console.warn("[jobs:google] html failed", message);
    }
    if (!shouldFallback(message)) return [];
  }

  if (parsed.length > 0) return parsed.slice(0, count);

  if (!options.usePlaywrightFallback) {
    return [];
  }

  if (!options.playwrightWsEndpoint) {
    throw new Error("Missing PLAYWRIGHT_WS_ENDPOINT for Google fallback");
  }

  try {
    const playwrightHtml = await withTimeout(
      fetchWithPlaywright(url.toString(), options.playwrightWsEndpoint),
      12000
    );
    if (debug) {
      console.info("[jobs:google] playwright fallback used");
    }
    return parseGoogleHtml(playwrightHtml).slice(0, count);
  } catch (err) {
    if (debug) {
      console.warn(
        "[jobs:google] playwright fallback failed",
        err instanceof Error ? err.message : err
      );
    }
    throw new Error(
      err instanceof Error
        ? `Playwright fallback failed: ${err.message}`
        : "Playwright fallback failed"
    );
  }
}

function shouldFallback(input: string) {
  const lowered = input.toLowerCase();
  return (
    lowered.includes("429") ||
    lowered.includes("too many requests") ||
    lowered.includes("unusual traffic") ||
    lowered.includes("detected unusual") ||
    lowered.includes("recaptcha") ||
    lowered.includes("systems have detected") ||
    lowered.includes("consent.google.com") ||
    lowered.includes("before you continue")
  );
}

async function fetchHtml(url: string, timeoutMs = 12000, userAgent = DEFAULT_UA) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "User-Agent": userAgent,
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`Google HTML error: ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function fetchWithPlaywright(url: string, wsEndpoint: string) {
  const browser = await chromium.connect(wsEndpoint);
  try {
    const page = await browser.newPage({ userAgent: DEFAULT_UA });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    const html = await page.content();
    await page.close();
    return html;
  } finally {
    await browser.close();
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(t));
  });
}

function parseGoogleHtml(html: string): SearchHit[] {
  const $ = cheerio.load(html);
  const results: SearchHit[] = [];

  // Primary: classic result blocks
  $("#search .tF2Cxc, #search .g").each((_: number, el: AnyNode) => {
    const anchor = $(el).find("a").first();
    const h3 = $(el).find("h3").first();
    const href = anchor.attr("href") || "";
    const url = normalizeGoogleUrl(href);
    const title = h3.text().trim();
    if (!url || !title) return;
    const snippet = extractSnippet($(el));
    results.push({ title, url, snippet });
  });

  // Fallback: any anchor with h3 in search results
  if (results.length === 0) {
    $("#search a, #rso a").each((_: number, el: AnyNode) => {
      const h3 = $(el).find("h3");
      if (!h3.length) return;

      const href = $(el).attr("href") || "";
      const url = normalizeGoogleUrl(href);
      if (!url) return;

      const title = h3.text().trim();
      if (!title) return;

      const container = $(el).closest("div.MjjYud, div.g, div.tF2Cxc");
      const snippet = extractSnippet(container);

      results.push({ title, url, snippet });
    });
  }

  return dedupeHits(results);
}

function normalizeGoogleUrl(href: string) {
  if (!href) return "";
  if (href.startsWith("/url?")) {
    const u = new URL(`https://www.google.com${href}`);
    const q = u.searchParams.get("q");
    return q ? decodeURIComponent(q) : "";
  }
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  return "";
}

function extractSnippet(container: cheerio.Cheerio<AnyNode>) {
  if (!container || container.length === 0) return undefined;
  const snippet =
    container.find("div.VwiC3b").first().text().trim() ||
    container.find("div.IsZvec").first().text().trim() ||
    container.find("span.aCOpRe").first().text().trim();
  return snippet || undefined;
}

function dedupeHits(hits: SearchHit[]) {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    out.push(hit);
  }
  return out;
}
