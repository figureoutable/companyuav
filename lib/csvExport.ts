import type { CompanyDirectorRow } from "@/types";

const CSV_HEADERS = [
  "company_number",
  "company_name",
  "incorporation_date",
  "sic_codes",
  "registered_address",
  "director_name",
  "director_dob_month_year",
  "director_nationality",
  "director_occupation",
  "director_address",
] as const;

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsvContent(rows: CompanyDirectorRow[]): string {
  const headerLine = CSV_HEADERS.join(",");
  const dataLines = rows.map((row) =>
    CSV_HEADERS.map((h) => escapeCsvField(String(row[h] ?? ""))).join(",")
  );
  return [headerLine, ...dataLines].join("\n");
}

export function getCsvFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `companies_house_${today}.csv`;
}

export function downloadCsv(rows: CompanyDirectorRow[], filename?: string): void {
  const content = buildCsvContent(rows);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename ?? getCsvFilename();
  link.click();
  URL.revokeObjectURL(url);
}
