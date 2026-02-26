"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const transitionRef = React.useRef<number | null>(null);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" aria-label="Toggle theme" />
    );
  }

  const isDark = theme === "dark";

  const triggerTransition = () => {
    const root = document.body;
    root.classList.add("theme-transition");
    if (transitionRef.current) {
      window.clearTimeout(transitionRef.current);
    }
    transitionRef.current = window.setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 500);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => {
        triggerTransition();
        requestAnimationFrame(() => {
          setTheme(isDark ? "light" : "dark");
        });
      }}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
