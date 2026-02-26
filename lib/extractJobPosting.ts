import * as cheerio from "cheerio";

export function extractJobPosting(html: string): {
  datePosted?: string;
  validThrough?: string;
  company?: string;
  location?: string;
} {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]').toArray();

  for (const s of scripts) {
    const raw = $(s).text()?.trim();
    if (!raw) continue;

    const candidates: any[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) candidates.push(...parsed);
      else candidates.push(parsed);

      const expanded: any[] = [];
      for (const c of candidates) {
        if (c && typeof c === "object" && Array.isArray(c["@graph"])) {
          expanded.push(...c["@graph"]);
        } else {
          expanded.push(c);
        }
      }

      for (const obj of expanded) {
        const t = obj?.["@type"];
        const isJobPosting =
          t === "JobPosting" ||
          (Array.isArray(t) && t.includes("JobPosting")) ||
          (typeof t === "string" && t.toLowerCase().includes("jobposting"));

        if (!isJobPosting) continue;

        return {
          datePosted: normalizeDate(obj.datePosted),
          validThrough: normalizeDate(obj.validThrough),
          company:
            typeof obj.hiringOrganization?.name === "string"
              ? obj.hiringOrganization.name
              : undefined,
          location: extractLocation(obj.jobLocation),
        };
      }
    } catch {
      continue;
    }
  }

  const metaDate =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $('meta[name="publish_date"]').attr("content") ||
    $('meta[itemprop="datePosted"]').attr("content");

  return {
    datePosted: normalizeDate(metaDate),
  };
}

function normalizeDate(v: any): string | undefined {
  if (!v || typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function extractLocation(jobLocation: any): string | undefined {
  const first = Array.isArray(jobLocation) ? jobLocation[0] : jobLocation;
  const addr = first?.address;
  if (!addr) return undefined;

  const parts = [
    addr.addressLocality,
    addr.addressRegion,
    addr.addressCountry,
  ].filter((x: any) => typeof x === "string" && x.trim().length);

  return parts.length ? parts.join(", ") : undefined;
}
