export type QuerySet = { name: string; query: string };

export const DEFAULT_DOMAINS = [
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

export const DEFAULT_QUERY_SETS: QuerySet[] = [
  {
    name: "eng_remote_emea",
    query:
      '(("software engineer" OR backend OR fullstack OR "AI") AND (remote OR "work from home") AND (EMEA OR Europe OR UTC OR CET OR WAT)) -intitle:archive -intitle:closed -intitle:rejected -intern -internship',
  },
];

export function withAfterDate(base: string, after?: string) {
  if (!after) return base;
  if (/\bafter:\d{4}-\d{2}-\d{2}\b/.test(base)) return base;
  return `${base} after:${after}`;
}
