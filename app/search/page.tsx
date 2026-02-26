"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

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

export default function SearchPage() {
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const prefillApplied = useRef(false);
  const toBool = (value: boolean | "indeterminate") => value === true;
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

  useEffect(() => {
    if (prefillApplied.current) return;
    const prefill = searchParams.get("prefill");
    if (prefill === "frontend") {
      setRoleKeywords("frontend engineer, frontend, react");
      setLocation("");
      setRemote(true);
      setSeniority([]);
      setEmployment([]);
      setUseDateFilter(false);
      setPostedWithin(30);
      setSelectedDomains(["boards.greenhouse.io", "ashbyhq.com"]);
      setMaxPerDomain(10);
    }
    prefillApplied.current = true;
  }, [searchParams]);

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

  const container = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduceMotion
        ? { duration: 0 }
        : { staggerChildren: 0.08, ease: "easeOut" },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduceMotion
        ? { duration: 0 }
        : { duration: 0.4, ease: "easeOut" },
    },
  };

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
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <motion.section
          variants={container}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Job search</h1>
            <p className="text-sm text-slate-600">
              Filters on the left, results in a sortable table.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={runSearch} disabled={loading} className="w-full sm:w-auto">
              {loading ? "Searching..." : "Run search"}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setAdvancedOpen((prev) => !prev)}
              className="w-full sm:w-auto"
            >
              {advancedOpen ? "Hide summary" : "Show summary"}
            </Button>
          </div>
        </motion.section>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <motion.section
          variants={container}
          initial="hidden"
          animate="visible"
          className="grid gap-6 lg:grid-cols-[320px_1fr]"
        >
          <motion.aside
            variants={item}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={remote}
                  onCheckedChange={(value: boolean | "indeterminate") =>
                    setRemote(toBool(value))
                  }
                  id="remote"
                />
                <Label htmlFor="remote">Remote</Label>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Role keywords</Label>
                <Input
                  value={roleKeywords}
                  onChange={(e) => setRoleKeywords(e.target.value)}
                  placeholder="frontend, react, UI"
                />
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="EMEA, Europe"
                />
              </div>

              <div className="space-y-2">
                <Label>Exclude terms</Label>
                <Input
                  value={exclusions}
                  onChange={(e) => setExclusions(e.target.value)}
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <Label>Seniority</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SENIORITY_LABELS).map(([value, label]) => (
                  <Button
                    key={value}
                    variant={seniority.includes(value) ? "default" : "outline"}
                    size="sm"
                    type="button"
                    onClick={() => toggleSeniority(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <Label>Employment</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
                  <Button
                    key={value}
                    variant={employment.includes(value) ? "default" : "outline"}
                    size="sm"
                    type="button"
                    onClick={() => toggleEmployment(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <Label>Posted within</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={useDateFilter}
                  onCheckedChange={(value: boolean | "indeterminate") =>
                    setUseDateFilter(toBool(value))
                  }
                  id="posted"
                />
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={postedWithin}
                  onChange={(e) => setPostedWithin(Number(e.target.value))}
                  disabled={!useDateFilter}
                />
              </div>
            </div>

            <Separator className="my-4" />

            {advancedOpen ? (
              <div className="space-y-3">
                <Label>Advanced summary</Label>
                <Textarea
                  value={advancedQuery}
                  onChange={(e) => {
                    setAdvancedQuery(e.target.value);
                    setAdvancedTouched(true);
                  }}
                  rows={4}
                />
                <div className="text-xs text-slate-500">
                  {afterDate ? `Auto after:${afterDate}` : "No after filter"}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setAdvancedTouched(false);
                    setAdvancedQuery(derivedQuery);
                  }}
                >
                  Reset to filters
                </Button>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Summary hidden. Use “Show summary” to view/edit the query.
              </div>
            )}
          </motion.aside>

          <motion.section
            variants={item}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900">Results</h2>
                <p className="text-xs text-slate-500">
                  {filteredResults.length} roles • {combinedDomains.length} domains
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  size="sm"
                  variant={enrichDetails ? "outline" : "default"}
                  type="button"
                  onClick={() => setEnrichDetails(false)}
                  className="w-full sm:w-auto"
                >
                  Basic
                </Button>
                <Button
                  size="sm"
                  variant={enrichDetails ? "default" : "outline"}
                  type="button"
                  onClick={() => setEnrichDetails(true)}
                  className="w-full sm:w-auto"
                >
                  Enriched
                </Button>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-wrap gap-2">
              {combinedDomains.map((domain) => (
                <Badge key={domain} variant="outline">
                  {domain}
                </Badge>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label>Domains</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DEFAULT_DOMAINS.map((domain) => (
                    <label
                      key={domain}
                      className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    >
                      <Checkbox
                        checked={selectedDomains.includes(domain)}
                        onCheckedChange={() => toggleDomain(domain)}
                      />
                      {domain}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Custom domains</Label>
                <Input
                  value={customDomains}
                  onChange={(e) => setCustomDomains(e.target.value)}
                  placeholder="jobs.example.com, careers.example.io"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max per domain</Label>
                  <Input
                    type="number"
                    min={5}
                    max={50}
                    value={maxPerDomain}
                    onChange={(e) => setMaxPerDomain(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <div>
                    <Label>Enrich details</Label>
                    <p className="text-xs text-slate-500">
                      Adds date/company/location
                    </p>
                  </div>
                  <Checkbox
                    checked={enrichDetails}
                    onCheckedChange={(value: boolean | "indeterminate") =>
                      setEnrichDetails(toBool(value))
                    }
                  />
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="grid gap-3 md:hidden">
              {loading ? (
                <div className="rounded-md border border-slate-200 p-4 text-sm text-slate-500">
                  Searching... this can take a few seconds.
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="rounded-md border border-slate-200 p-4 text-sm text-slate-500">
                  No results yet. Broaden keywords or try fewer exclusions.
                </div>
              ) : (
                filteredResults.map((job) => (
                  <motion.div
                    key={job.id}
                    variants={item}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {job.title}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <Badge variant="secondary">{job.domain}</Badge>
                        {job.company ? (
                          <Badge variant="outline">{job.company}</Badge>
                        ) : null}
                        {job.location ? (
                          <Badge variant="outline">{job.location}</Badge>
                        ) : null}
                        {job.datePosted ? (
                          <Badge variant="outline">
                            {formatDate(job.datePosted)}
                          </Badge>
                        ) : null}
                      </div>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-xs font-semibold text-slate-900 underline underline-offset-4"
                      >
                        Open role
                      </a>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-slate-500">
                        Searching... this can take a few seconds.
                      </TableCell>
                    </TableRow>
                  ) : filteredResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-slate-500">
                        No results yet. Broaden keywords or try fewer exclusions.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResults.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium text-slate-900">
                          {job.title}
                        </TableCell>
                        <TableCell>{job.company || "—"}</TableCell>
                        <TableCell>{job.location || "—"}</TableCell>
                        <TableCell>{formatDate(job.datePosted) || "—"}</TableCell>
                        <TableCell>{job.domain}</TableCell>
                        <TableCell>
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-900 underline underline-offset-4"
                          >
                            Open
                          </a>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.section>
        </motion.section>
      </main>
    </div>
  );
}
