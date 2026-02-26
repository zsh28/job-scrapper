import crypto from "node:crypto";
import { DEFAULT_DOMAINS, DEFAULT_QUERY_SETS, withAfterDate } from "./config";
import { extractJobPosting } from "./extractJobPosting";
import { googleSearch } from "./googleSearch";
import { JobResult, SearchHit } from "./types";
import type { QuerySet } from "./config";

export type SearchOptions = {
  domains?: string[];
  querySets?: QuerySet[];
  maxPerDomainQuery?: number;
  afterDate?: string;
  fetchDetails?: boolean;
  fetchConcurrency?: number;
  searchConcurrency?: number;
  searchTimeoutMs?: number;
  maxDurationMs?: number;
  timeoutMs?: number;
  usePlaywrightFallback?: boolean;
  playwrightWsEndpoint?: string;
  onQuery?: (info: {
    domain: string;
    query: string;
    count: number;
    status: "ok" | "timeout" | "error";
    error?: string;
  }) => void;
};

export async function searchJobs(opts: SearchOptions = {}): Promise<JobResult[]> {
  const domains = opts.domains?.length ? opts.domains : DEFAULT_DOMAINS;
  const querySets = opts.querySets?.length ? opts.querySets : DEFAULT_QUERY_SETS;
  const max = opts.maxPerDomainQuery ?? 20;
  const debug =
    process.env.DEBUG_JOBS === "1" || process.env.NODE_ENV !== "production";

  const hits: { domain: string; sourceQuery: string; hit: SearchHit }[] = [];

  const searchLimiter = createLimiter(opts.searchConcurrency ?? 3);
  const searchTimeoutMs = opts.searchTimeoutMs ?? 15000;

  const searchTasks: Array<Promise<void>> = [];
  for (const qs of querySets) {
    for (const domain of domains) {
      const base = withAfterDate(qs.query, opts.afterDate);
      const sourceQuery = `site:${domain} (${base})`;

      searchTasks.push(
        searchLimiter(async () => {
          try {
            const results = await runQueryWithRetry(sourceQuery, {
              count: max,
              timeoutMs: opts.timeoutMs ?? 12000,
              usePlaywrightFallback: opts.usePlaywrightFallback !== false,
              playwrightWsEndpoint: opts.playwrightWsEndpoint,
            }, searchTimeoutMs);
            if (debug) {
              console.info("[jobs:query]", {
                domain,
                count: results.length,
                query: sourceQuery,
              });
            }
            opts.onQuery?.({
              domain,
              query: sourceQuery,
              count: results.length,
              status: "ok",
            });
            for (const hit of results) hits.push({ domain, sourceQuery, hit });
          } catch (err) {
            if (debug) {
              console.warn("[jobs:query] failed", {
                domain,
                query: sourceQuery,
                error: err instanceof Error ? err.message : err,
              });
            }
            opts.onQuery?.({
              domain,
              query: sourceQuery,
              count: 0,
              status: err instanceof Error && err.message !== "Timeout" ? "error" : "timeout",
              error: err instanceof Error ? err.message : undefined,
            });
            return;
          }
        })
      );
    }
  }

  const settled = Promise.allSettled(searchTasks);
  if (opts.maxDurationMs) {
    await Promise.race([settled, delay(opts.maxDurationMs)]);
  } else {
    await settled;
  }

  const byId = new Map<string, JobResult>();
  for (const h of hits) {
    const url = normalizeUrl(h.hit.url);
    if (!url) continue;
    const id = crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);

    if (!byId.has(id)) {
      byId.set(id, {
        id,
        title: h.hit.title,
        url,
        snippet: h.hit.snippet,
        domain: h.domain,
        sourceQuery: h.sourceQuery,
      });
    }
  }

  const out = [...byId.values()];

  if (opts.fetchDetails !== false) {
    const limit = createLimiter(opts.fetchConcurrency ?? 6);
    const timeoutMs = opts.timeoutMs ?? 12000;

    await Promise.all(
      out.map((job) =>
        limit(async () => {
          try {
            const html = await fetchHtml(job.url, timeoutMs);
            const meta = extractJobPosting(html);
            job.datePosted = meta.datePosted;
            job.validThrough = meta.validThrough;
            job.company = meta.company;
            job.location = meta.location;
          } catch {
            return;
          }
        })
      )
    );
  }

  out.sort((a, b) => {
    const da = a.datePosted ? Date.parse(a.datePosted) : 0;
    const db = b.datePosted ? Date.parse(b.datePosted) : 0;
    return db - da;
  });

  return out;
}

function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= concurrency) return;
    const task = queue.shift();
    if (!task) return;
    active += 1;
    task();
  };

  return async <T>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            active -= 1;
            next();
          });
      };

      queue.push(run);
      next();
    });
}

function normalizeUrl(u: string) {
  return u.split("#")[0].replace(/\/+$/, "");
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (JobSearchBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function runQueryWithRetry(
  query: string,
  options: {
    count: number;
    timeoutMs: number;
    usePlaywrightFallback: boolean;
    playwrightWsEndpoint?: string;
  },
  searchTimeoutMs: number
) {
  try {
    return await withTimeout(googleSearch(query, options), searchTimeoutMs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message !== "Timeout") throw err;
    await delay(1200);
    return await withTimeout(googleSearch(query, options), searchTimeoutMs);
  }
}
