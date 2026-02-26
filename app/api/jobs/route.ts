import { NextResponse } from "next/server";
import { searchJobs } from "@/lib/searchJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 2 * 60 * 1000;
const DEBUG =
  process.env.DEBUG_JOBS === "1" || process.env.NODE_ENV !== "production";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const debugParam =
    searchParams.get("debug") === "1" ||
    process.env.NODE_ENV !== "production";

  const domains = searchParams
    .get("domains")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const q = searchParams.get("q")?.trim();
  const after = searchParams.get("after") || undefined;
  const max = Number(searchParams.get("max") || 20);
  const fetchDetails = searchParams.get("fetchDetails") === "true";
  const concurrency = Number(searchParams.get("concurrency") || 6);

  const cacheKey = searchParams.toString();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    if (DEBUG) {
      console.info(`[jobs:${requestId}] cache hit`, cacheKey);
    }
    return NextResponse.json({ results: cached.data }, { status: 200 });
  }

  if (DEBUG) {
    console.info(`[jobs:${requestId}] start`, {
      domains: domains?.length ?? 0,
      max,
      after,
      fetchDetails,
      concurrency,
    });
  }

  const queryStats: Array<{
    domain: string;
    query: string;
    count: number;
    status: "ok" | "timeout" | "error";
    error?: string;
  }> = [];

  try {
    const startedAt = Date.now();
    const searchPromise = searchJobs({
      domains,
      querySets: q ? [{ name: "custom", query: q }] : undefined,
      afterDate: after,
      maxPerDomainQuery: max,
      fetchDetails,
      fetchConcurrency: concurrency,
      searchConcurrency: 2,
      searchTimeoutMs: 20000,
      maxDurationMs: 40000,
      timeoutMs: 12000,
      usePlaywrightFallback: true,
      playwrightWsEndpoint: process.env.PLAYWRIGHT_WS_ENDPOINT,
      onQuery: (info) => {
        if (debugParam) queryStats.push(info);
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Search timed out")), 45000);
    });

    const results = await Promise.race([searchPromise, timeoutPromise]);

    cache.set(cacheKey, { ts: Date.now(), data: results });
    if (DEBUG) {
      console.info(`[jobs:${requestId}] done`, {
        results: Array.isArray(results) ? results.length : 0,
        ms: Date.now() - startedAt,
      });
    }

    if (debugParam) {
      return NextResponse.json(
        {
          results,
          meta: {
            requestId,
            queryCount: queryStats.length,
            queries: queryStats,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    if (DEBUG) {
      console.error(`[jobs:${requestId}] error`, message);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
