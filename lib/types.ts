export type SearchHit = {
  title: string;
  url: string;
  snippet?: string;
};

export type JobResult = {
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
