"use client";

import { useState, useCallback, useRef } from "react";
import { SearchFilters } from "@/components/SearchFilters";
import { ResultsTable } from "@/components/ResultsTable";
import { ProgressBar } from "@/components/ProgressBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { searchCompaniesWithDirectors, getSearchProgress } from "./actions";
import type { SearchFilters as SearchFiltersType, CompanyDirectorRow } from "@/types";

const DEFAULT_FILTERS: SearchFiltersType = {
  incorporatedDays: 14,
  sicCodes: [],
  companyType: "",
  addressKeyword: "",
};

const POLL_INTERVAL_MS = 400;

export default function Home() {
  const [filters, setFilters] = useState<SearchFiltersType>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<CompanyDirectorRow[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{
    phase: "companies" | "directors";
    current: number;
    total: number;
  } | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const sessionIdRef = useRef<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { theme, setTheme } = useTheme();

  const runSearch = useCallback(async () => {
    const sessionId = `search-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionIdRef.current = sessionId;
    setLoading(true);
    setProgress({ phase: "companies", current: 0, total: 1 });
    setRows([]);
    setSelectedIndices(new Set());

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setProgress(null);
    };

    pollRef.current = setInterval(async () => {
      const p = await getSearchProgress(sessionId);
      if (p) {
        setProgress({
          phase: p.phase as "companies" | "directors",
          current: p.current,
          total: p.total,
        });
      }
    }, POLL_INTERVAL_MS);

    const result = await searchCompaniesWithDirectors(filters, sessionId);
    stopPolling();
    setLoading(false);

    if (result.success) {
      setRows(result.rows);
      setTotalResults(result.totalResults);
      toast.success(`Found ${result.rows.length} company-director row(s) from ${result.totalResults} companies.`);
    } else {
      toast.error(result.error);
    }
  }, [filters]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-semibold">Company Scout</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </header>

      <main className="container px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="lg:sticky lg:top-14 lg:self-start">
            <SearchFilters
              filters={filters}
              onFiltersChange={setFilters}
              onSearch={runSearch}
              isSearching={loading}
            />
          </aside>

          <div className="min-w-0 space-y-4">
            {progress && (
              <Card>
                <CardContent className="pt-6">
                  <ProgressBar
                    phase={progress.phase}
                    current={progress.current}
                    total={progress.total}
                  />
                </CardContent>
              </Card>
            )}

            {!loading && rows.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Total: {rows.length} row(s) from {totalResults} companies
              </p>
            )}

            <ResultsTable
              rows={rows}
              selectedIndices={selectedIndices}
              onSelectionChange={setSelectedIndices}
              loading={loading}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
