"use server";

import { createCompaniesHouseClient } from "@/lib/companiesHouse";
import type { CompanyDirectorRow, SearchFilters } from "@/types";

const progressStore = new Map<
  string,
  { current: number; total: number; phase: "companies" | "directors" }
>();

function updateProgress(
  sessionId: string,
  phase: "companies" | "directors",
  current: number,
  total: number
) {
  progressStore.set(sessionId, { phase, current, total });
}

function getIncorporatedDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export async function getSearchProgress(sessionId: string): Promise<{
  current: number;
  total: number;
  phase: string;
} | null> {
  const p = progressStore.get(sessionId);
  if (!p) return null;
  return { current: p.current, total: p.total, phase: p.phase };
}

export async function searchCompaniesWithDirectors(
  filters: SearchFilters,
  sessionId: string
): Promise<{ success: true; rows: CompanyDirectorRow[]; totalResults: number } | { success: false; error: string }> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return { success: false, error: "COMPANIES_HOUSE_API_KEY is not set." };
  }

  const delayMs = Number(process.env.OFFICER_FETCH_DELAY_MS) || 200;
  const ch = createCompaniesHouseClient(apiKey, delayMs);
  const { from, to } = getIncorporatedDateRange(filters.incorporatedDays);

  try {
    const allRows: CompanyDirectorRow[] = [];
    let totalResults = 0;
    let startIndex = 0;
    const itemsPerPage = ch.ITEMS_PER_PAGE;

    updateProgress(sessionId, "companies", 0, 1);

    // Paginate through all companies
    let companiesProcessed = 0;
    while (true) {
      const params: Record<string, string | number> = {
        incorporated_from: from,
        incorporated_to: to,
        start_index: startIndex,
        items_per_page: itemsPerPage,
      };
      if (filters.sicCodes.length) params.sic_codes = filters.sicCodes.join(",");
      if (filters.companyType) params.company_type = filters.companyType;
      if (filters.addressKeyword.trim()) params.location = filters.addressKeyword.trim();

      const res = await ch.advancedSearch(params as Parameters<typeof ch.advancedSearch>[0]);
      const items = res.items ?? [];
      totalResults = res.total_results ?? 0;

      if (items.length === 0) break;

      const companyNumbers = items.map((c) => c.company_number);
      const batchTotal = companiesProcessed + companyNumbers.length;
      updateProgress(sessionId, "directors", companiesProcessed, Math.max(totalResults, batchTotal));

      for (let i = 0; i < companyNumbers.length; i++) {
        updateProgress(sessionId, "directors", companiesProcessed + i + 1, Math.max(totalResults, batchTotal));
        const company = items[i];
        const officersRes = await ch.getOfficers(companyNumbers[i]);
        await ch.sleep(delayMs);

        const directors = (officersRes?.items ?? []).filter(
          (o) => o.officer_role?.toLowerCase() === "director"
        );

        const regAddress = ch.formatAddress(company.registered_office_address);
        const sicStr = (company.sic_codes ?? []).join("; ");
        const incorporationDate = company.date_of_creation ?? "";

        if (directors.length === 0) {
          allRows.push({
            company_number: company.company_number,
            company_name: company.company_name ?? "",
            incorporation_date: incorporationDate,
            sic_codes: sicStr,
            registered_address: regAddress,
            director_name: "",
            director_dob_month_year: "",
            director_nationality: "",
            director_occupation: "",
            director_address: "",
            company_house_url: `https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`,
          });
        } else {
          for (const d of directors) {
            const dob =
              d.date_of_birth?.month && d.date_of_birth?.year
                ? `${d.date_of_birth.month}/${d.date_of_birth.year}`
                : "";
            allRows.push({
              company_number: company.company_number,
              company_name: company.company_name ?? "",
              incorporation_date: incorporationDate,
              sic_codes: sicStr,
              registered_address: regAddress,
              director_name: d.name ?? "",
              director_dob_month_year: dob,
              director_nationality: d.nationality ?? "",
              director_occupation: d.occupation ?? "",
              director_address: ch.formatAddress(d.address),
              company_house_url: `https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`,
            });
          }
        }
      }

      companiesProcessed += companyNumbers.length;
      startIndex += items.length;
      // Keep paginating until we have all companies (don’t stop just because this page had fewer than itemsPerPage)
      if (items.length === 0 || startIndex >= totalResults) break;
    }

    progressStore.delete(sessionId);
    return { success: true, rows: allRows, totalResults };
  } catch (err: unknown) {
    progressStore.delete(sessionId);
    const message = err instanceof Error ? err.message : "Companies House API request failed.";
    return { success: false, error: message };
  }
}
