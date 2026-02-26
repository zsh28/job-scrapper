"use client";

import { useEffect, useMemo, useState } from "react";

type JobResult = {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  domain: string;
  sourceQuery: string;
  datePosted?: string;
  validThrough?: string;
  company?: string;
  location?: string;
};

const DEFAULT_DOMAINS = [
  "ashbyhq.com",
  "greenhouse.io",
  "boards.greenhouse.io",
  "jobs.lever.co",
  "apply.workable.com",
  "jobs.smartrecruiters.com",
  "teamtailor.com",
  "recruitee.com",
  "jobs.personio.com",
];

const SENIORITY_LABELS: Record<string, string> = {
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
  staff: "Staff+",
};

const SENIORITY_TERMS: Record<string, string[]> = {
  junior: ["junior", "entry level", "entry-level", "associate"],
  mid: ["mid level", "mid-level", "intermediate"],
  senior: ["senior", "lead", "sr"],
  staff: ["staff", "principal", "architect"],
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  fulltime: "Full-time",
  contract: "Contract",
};

const EMPLOYMENT_TERMS: Record<string, string[]> = {
  fulltime: ["full-time", "full time", "permanent"],
  contract: ["contract", "contractor", "freelance"],
};

const DEFAULT_EXCLUSIONS = "closed, archive, rejected, intern, internship";

function splitTerms(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toQueryTerms(terms: string[]) {
  return terms.map((term) => (term.includes(" ") ? `"${term}"` : term));
}

function orGroup(terms: string[]) {
  if (!terms.length) return "";
  return `(${toQueryTerms(terms).join(" OR ")})`;
}

function buildExclusions(value: string) {
  const terms = splitTerms(value);
  if (!terms.length) return "";
  return terms
    .map((term) => {
      if (["closed", "archive", "rejected"].includes(term.toLowerCase())) {
        return `-intitle:${term}`;
      }
      return term.includes(" ") ? `-"${term}"` : `-${term}`;
    })
    .join(" ");
}

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildQuery({
  roleKeywords,
  location,
  remote,
  seniority,
  employment,
  exclusions,
}: {
  roleKeywords: string;
  location: string;
  remote: boolean;
  seniority: string[];
  employment: string[];
  exclusions: string;
}) {
  const parts: string[] = [];

  const roleGroup = orGroup(splitTerms(roleKeywords));
  if (roleGroup) parts.push(roleGroup);

  const locationGroup = orGroup(splitTerms(location));
  if (locationGroup) parts.push(locationGroup);

  if (remote) {
    parts.push(orGroup(["remote", "work from home", "distributed"]));
  }

  if (seniority.length) {
    const terms = seniority.flatMap((level) => SENIORITY_TERMS[level] || []);
    parts.push(orGroup(terms));
  }

  if (employment.length) {
    const terms = employment.flatMap((kind) => EMPLOYMENT_TERMS[kind] || []);
    parts.push(orGroup(terms));
  }

  const base = parts.filter(Boolean).join(" AND ");
  const exclusionGroup = buildExclusions(exclusions);

  return [base, exclusionGroup].filter(Boolean).join(" ").trim();
}

export default function Home() {
  const [roleKeywords, setRoleKeywords] = useState(
    "frontend engineer, frontend, react"
  );
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(true);
  const [seniority, setSeniority] = useState<string[]>([]);
  const [employment, setEmployment] = useState<string[]>([]);
  const [useDateFilter, setUseDateFilter] = useState(false);
  const [postedWithin, setPostedWithin] = useState(30);
  const [enrichDetails, setEnrichDetails] = useState(false);
  const [exclusions, setExclusions] = useState(DEFAULT_EXCLUSIONS);
  const [selectedDomains, setSelectedDomains] = useState<string[]>(
    DEFAULT_DOMAINS.slice(0, 3)
  );
  const [customDomains, setCustomDomains] = useState("");
  const [maxPerDomain, setMaxPerDomain] = useState(10);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedQuery, setAdvancedQuery] = useState("");
  const [advancedTouched, setAdvancedTouched] = useState(false);
  const [results, setResults] = useState<JobResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedQuery = useMemo(
    () =>
      buildQuery({
        roleKeywords,
        location,
        remote,
        seniority,
        employment,
        exclusions,
      }),
    [roleKeywords, location, remote, seniority, employment, exclusions]
  );

  const afterDate = useMemo(() => {
    if (!useDateFilter || !postedWithin || postedWithin <= 0) return "";
    const d = new Date();
    d.setDate(d.getDate() - postedWithin);
    return d.toISOString().slice(0, 10);
  }, [postedWithin, useDateFilter]);

  useEffect(() => {
    if (advancedTouched) return;
    setAdvancedQuery(derivedQuery);
  }, [derivedQuery, advancedTouched]);

  const combinedDomains = useMemo(() => {
    const custom = splitTerms(customDomains);
    return [...new Set([...selectedDomains, ...custom])];
  }, [customDomains, selectedDomains]);

  const filteredResults = useMemo(() => {
    if (!useDateFilter || !postedWithin || postedWithin <= 0) return results;
    const cutoff = Date.now() - postedWithin * 24 * 60 * 60 * 1000;
    return results.filter((job) => {
      if (!job.datePosted) return true;
      return Date.parse(job.datePosted) >= cutoff;
    });
  }, [results, postedWithin, useDateFilter]);

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (combinedDomains.length) {
        params.set("domains", combinedDomains.join(","));
      }
      const queryToUse = advancedOpen ? advancedQuery : derivedQuery;
      if (queryToUse) params.set("q", queryToUse);
      if (afterDate) params.set("after", afterDate);
      params.set("max", String(maxPerDomain));
      params.set("fetchDetails", enrichDetails ? "true" : "false");
      params.set("concurrency", enrichDetails ? "4" : "6");

      const res = await fetch(`/api/jobs?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `Search error ${res.status}`);
      }
      setResults(Array.isArray(json.results) ? json.results : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleSeniority(value: string) {
    setSeniority((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function toggleEmployment(value: string) {
    setEmployment((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function toggleDomain(domain: string) {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 lg:px-10">
        <header className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1">
                Job Aggregator
              </span>
              <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1">
                Google SERP + ATS
              </span>
              <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1">
                JSON-LD Dates
              </span>
            </div>
            <div className="space-y-3">
              <h1 className="font-[var(--font-display)] text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Find fresh roles across every ATS you care about.
              </h1>
              <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
                Build human-friendly filters, then we craft the Google query under
                the hood. Results are deduped, enriched with JSON-LD metadata, and
                sorted by posting date when available.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={runSearch}
                className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Searching..." : "Run search"}
              </button>
              <button
                type="button"
                onClick={() => setAdvancedOpen((prev) => !prev)}
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                {advancedOpen ? "Hide summary" : "Show summary"}
              </button>
              {error ? (
                <span className="text-sm font-semibold text-rose-600">
                  {error}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Search snapshot
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Domains selected</span>
                <span className="font-semibold text-slate-900">
                  {combinedDomains.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Results found</span>
                <span className="font-semibold text-slate-900">
                  {filteredResults.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Posted within</span>
                <span className="font-semibold text-slate-900">
                  {useDateFilter ? `${postedWithin} days` : "Anytime"}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {advancedOpen ? advancedQuery : derivedQuery}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{enrichDetails ? "Enriching details" : "Fast mode"}</span>
                <span>{enrichDetails ? "Slower" : "Faster"}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={remote}
                  onChange={(e) => setRemote(e.target.checked)}
                />
                Remote-friendly
              </label>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-600">
                <span>Role keywords</span>
                <input
                  value={roleKeywords}
                  onChange={(e) => setRoleKeywords(e.target.value)}
                  placeholder="backend, platform, AI"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-600">
                <span>Location or region</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="EMEA, Europe, CET"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-600">
                <span>Posted within (days)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={postedWithin}
                    onChange={(e) => setPostedWithin(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                    disabled={!useDateFilter}
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={useDateFilter}
                      onChange={(e) => setUseDateFilter(e.target.checked)}
                    />
                    Use
                  </label>
                </div>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-600">
                <span>Max results per domain</span>
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={maxPerDomain}
                  onChange={(e) => setMaxPerDomain(Number(e.target.value))}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
                />
              </label>
            </div>

            <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              <span>Enrich results (dates, company, location)</span>
              <input
                type="checkbox"
                checked={enrichDetails}
                onChange={(e) => setEnrichDetails(e.target.checked)}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-600">
              <span>Exclude keywords</span>
              <input
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                placeholder="closed, archive, rejected"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
              />
            </label>

            <div className="grid gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Seniority
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SENIORITY_LABELS).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => toggleSeniority(value)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      seniority.includes(value)
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Employment type
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => toggleEmployment(value)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      employment.includes(value)
                        ? "border-emerald-900 bg-emerald-900 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {advancedOpen ? (
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Filter summary
                  </h3>
                  <button
                    type="button"
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
                    onClick={() => {
                      setAdvancedTouched(false);
                      setAdvancedQuery(derivedQuery);
                    }}
                  >
                    Reset
                  </button>
                </div>
                <textarea
                  value={advancedQuery}
                  onChange={(e) => {
                    setAdvancedQuery(e.target.value);
                    setAdvancedTouched(true);
                  }}
                  rows={4}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800"
                />
                <div className="text-xs text-slate-500">
                  {afterDate ? `Auto after:${afterDate}` : "No after filter"}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Domains
              </h3>
              <span className="text-xs text-slate-500">
                {combinedDomains.length} selected
              </span>
            </div>
            <div className="grid gap-3">
              {DEFAULT_DOMAINS.map((domain) => (
                <label key={domain} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedDomains.includes(domain)}
                    onChange={() => toggleDomain(domain)}
                  />
                  <span>{domain}</span>
                </label>
              ))}
            </div>
            <label className="grid gap-2 text-sm font-semibold text-slate-600">
              <span>Custom domains</span>
              <input
                value={customDomains}
                onChange={(e) => setCustomDomains(e.target.value)}
                placeholder="jobs.example.com, careers.example.io"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
              />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold text-slate-900">
                Results
              </h2>
              <p className="text-sm text-slate-500">
                {filteredResults.length} roles found • showing newest first
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {useDateFilter
                ? `Posted within ${postedWithin} days`
                : "No date filter"}
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                Searching across selected domains. This can take up to 45 seconds
                when enrichment is on.
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                No results yet. Try broadening keywords, reducing exclusions, or
                turning off enrichment for faster discovery.
              </div>
            ) : (
              filteredResults.map((job) => (
                <article
                  key={job.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {job.title}
                        </a>
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                          {job.domain}
                        </span>
                        {job.company ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                            {job.company}
                          </span>
                        ) : null}
                        {job.location ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                            {job.location}
                          </span>
                        ) : null}
                        {job.datePosted ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                            Posted {formatDate(job.datePosted)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      {job.validThrough
                        ? `Valid thru ${formatDate(job.validThrough)}`
                        : ""}
                    </div>
                  </div>
                  {job.snippet ? (
                    <p className="mt-4 text-sm text-slate-600">{job.snippet}</p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
