export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/95 py-8 dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 text-sm text-slate-600 sm:px-6 dark:text-slate-400">
        <div className="font-semibold text-slate-900 dark:text-slate-100">
          Job Board Aggregator
        </div>
        <div>Search ATS job boards with Google-style queries.</div>
      </div>
    </footer>
  );
}
