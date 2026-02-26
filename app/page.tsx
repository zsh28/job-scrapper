"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    title: "Natural filters",
    description: "Write in human terms and we build the Google query for you.",
  },
  {
    title: "ATS coverage",
    description: "Search Ashby, Greenhouse, Lever, Workable, and more.",
  },
  {
    title: "Date-aware",
    description: "Extract JSON-LD dates to sort by freshness.",
  },
];

const container = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.08, ease: "easeOut" },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { ease: "easeOut", duration: 0.5 } },
};

const typingPhrases = [
  "frontend roles",
  "backend roles",
  "AI roles",
  "remote roles",
  "design roles",
  "product roles",
  "data roles",
  "security roles",
  "go-to-market roles",
  "sales roles",
  "marketing roles",
  "operations roles",
  "finance roles",
  "legal roles",
  "people roles",
  "customer success roles",
];

export default function Home() {
  const reduceMotion = useReducedMotion();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const currentPhrase = useMemo(
    () => typingPhrases[phraseIndex % typingPhrases.length],
    [phraseIndex]
  );

  useEffect(() => {
    if (reduceMotion) return;
    let frame: NodeJS.Timeout;
    let cursor = 0;
    let deleting = false;

    const tick = () => {
      if (!deleting) {
        cursor += 1;
        setTyped(currentPhrase.slice(0, cursor));
        if (cursor === currentPhrase.length) {
          deleting = true;
          frame = setTimeout(tick, 1200);
          return;
        }
      } else {
        cursor -= 1;
        setTyped(currentPhrase.slice(0, Math.max(cursor, 0)));
        if (cursor <= 0) {
          deleting = false;
          setPhraseIndex((prev) => prev + 1);
          frame = setTimeout(tick, 300);
          return;
        }
      }
      frame = setTimeout(tick, deleting ? 40 : 70);
    };

    frame = setTimeout(tick, 400);
    return () => clearTimeout(frame);
  }, [currentPhrase, reduceMotion]);

  const displayText = reduceMotion ? currentPhrase : typed;

  return (
    <div className="bg-transparent">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-14 sm:px-6">
        <motion.section
          variants={container}
          initial="hidden"
          animate="visible"
          className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="space-y-6">
            <motion.div
              variants={item}
              className="flex flex-wrap items-center gap-2"
            >
              <Badge variant="secondary">Google SERP + ATS</Badge>
              <Badge variant="secondary">Browserless fallback</Badge>
              <Badge variant="secondary">JSON-LD dates</Badge>
            </motion.div>
            <motion.h1
              variants={item}
              className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-100"
            >
              Find real job posts fast. Filter in plain English.
            </motion.h1>
            <motion.div
              variants={item}
              className="text-lg font-medium text-slate-700 dark:text-slate-300"
            >
              Search for <span className="text-slate-900 dark:text-slate-100">{displayText}</span>
              {null}
            </motion.div>
            <motion.p variants={item} className="text-lg text-slate-600 dark:text-slate-400">
              Job Board aggregates ATS listings using Google-style queries, then
              enriches results with structured data so you can sort by freshness
              and focus on real openings.
            </motion.p>
            <motion.div
              variants={item}
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/search">Open search</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
              >
                <Link href="/search?prefill=frontend">Try frontend preset</Link>
              </Button>
            </motion.div>
          </div>

          <motion.div
            variants={item}
            className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              What it does
            </div>
            <div className="grid gap-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {feature.title}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {feature.description}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          variants={container}
          initial="hidden"
          animate="visible"
          className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr]"
        >
          {["Query builder", "Result table", "Quality signals"].map((label) => (
            <motion.div
              key={label}
              variants={item}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="text-sm font-semibold text-slate-900">{label}</div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Built to keep searches readable, reduce noise, and surface roles
                with reliable metadata.
              </div>
            </motion.div>
          ))}
        </motion.section>
      </main>
    </div>
  );
}
