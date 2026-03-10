"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadCsv, getCsvFilename } from "@/lib/csvExport";
import type { CompanyDirectorRow } from "@/types";

export interface ExportButtonProps {
  rows: CompanyDirectorRow[];
  selectedIndices: Set<number>;
  variant: "selected" | "all";
  disabled?: boolean;
}

export function ExportButton({
  rows,
  selectedIndices,
  variant,
  disabled,
}: ExportButtonProps) {
  const toExport =
    variant === "selected"
      ? rows.filter((_, i) => selectedIndices.has(i))
      : rows;

  const handleExport = () => {
    if (toExport.length === 0) return;
    downloadCsv(toExport, getCsvFilename());
  };

  const label =
    variant === "selected"
      ? `Export Selected to CSV${selectedIndices.size ? ` (${selectedIndices.size})` : ""}`
      : "Export All to CSV";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={disabled || toExport.length === 0}
    >
      <Download className="size-4 mr-2" />
      {label}
    </Button>
  );
}
