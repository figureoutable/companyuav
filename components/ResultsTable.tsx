"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ExportButton";
import type { CompanyDirectorRow } from "@/types";
import { ExternalLink } from "lucide-react";

export interface ResultsTableProps {
  rows: CompanyDirectorRow[];
  selectedIndices: Set<number>;
  onSelectionChange: (indices: Set<number>) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export function ResultsTable({
  rows,
  selectedIndices,
  onSelectionChange,
  loading,
  emptyMessage = "No results. Try adjusting your filters.",
}: ResultsTableProps) {
  const toggleOne = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (selectedIndices.size === rows.length) onSelectionChange(new Set());
    else onSelectionChange(new Set(rows.map((_, i) => i)));
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="space-y-3">
          <div className="h-8 bg-muted animate-pulse rounded" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted/60 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ExportButton
          rows={rows}
          selectedIndices={selectedIndices}
          variant="selected"
          disabled={selectedIndices.size === 0}
        />
        <ExportButton rows={rows} selectedIndices={selectedIndices} variant="all" />
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={rows.length > 0 && selectedIndices.size === rows.length}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Company name</TableHead>
              <TableHead>Company number</TableHead>
              <TableHead>Incorporation date</TableHead>
              <TableHead>SIC codes</TableHead>
              <TableHead>Registered address</TableHead>
              <TableHead>Director name(s)</TableHead>
              <TableHead>Director occupation</TableHead>
              <TableHead>Director nationality</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row.company_number}-${row.director_name}-${index}`}>
                <TableCell>
                  <Checkbox
                    checked={selectedIndices.has(index)}
                    onCheckedChange={() => toggleOne(index)}
                    aria-label={`Select row ${index + 1}`}
                  />
                </TableCell>
                <TableCell>
                  <a
                    href={row.company_house_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {row.company_name}
                    <ExternalLink className="size-3" />
                  </a>
                </TableCell>
                <TableCell className="font-mono text-xs">{row.company_number}</TableCell>
                <TableCell>{row.incorporation_date}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[140px]">
                    {row.sic_codes
                      ? row.sic_codes.split(";").map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">
                            {s.trim()}
                          </Badge>
                        ))
                      : "—"}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={row.registered_address}>
                  {row.registered_address || "—"}
                </TableCell>
                <TableCell>{row.director_name || "—"}</TableCell>
                <TableCell>{row.director_occupation || "—"}</TableCell>
                <TableCell>{row.director_nationality || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
