import { Suspense } from "react";
import SearchPageClient from "./SearchPageClient";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl px-4 py-8 text-sm text-slate-500">
          Loading search...
        </div>
      }
    >
      <SearchPageClient />
    </Suspense>
  );
}
