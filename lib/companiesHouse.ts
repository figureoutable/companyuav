import axios, { AxiosInstance, AxiosError } from "axios";
import type {
  CHAddress,
  CHAdvancedSearchResponse,
  CHCompanySearchItem,
  CHOfficerItem,
  CHOfficersResponse,
} from "@/types";

const BASE_URL = "https://api.company-information.service.gov.uk";
// API often returns ~25 per page regardless; we paginate until we have total_results
const ITEMS_PER_PAGE = 100;
const DEFAULT_OFFICER_DELAY_MS = 200;
const MAX_429_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

function formatAddress(addr: { address_line_1?: string; address_line_2?: string; locality?: string; region?: string; postal_code?: string; country?: string } | undefined): string {
  if (!addr) return "";
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    addr.locality,
    addr.region,
    addr.postal_code,
    addr.country,
  ].filter(Boolean);
  return parts.join(", ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createCompaniesHouseClient(apiKey: string, officerDelayMs: number = DEFAULT_OFFICER_DELAY_MS) {
  const client: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    auth: {
      username: apiKey,
      password: "",
    },
    headers: {
      Accept: "application/json",
    },
  });

  async function requestWithBackoff<T>(fn: () => Promise<T>, retries = MAX_429_RETRIES): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      if (status === 429 && retries > 0) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, MAX_429_RETRIES - retries);
        await sleep(backoff);
        return requestWithBackoff(fn, retries - 1);
      }
      throw err;
    }
  }

  async function advancedSearch(params: {
    incorporated_from: string;
    incorporated_to: string;
    sic_codes?: string;
    company_type?: string;
    location?: string;
    start_index?: number;
    items_per_page?: number;
  }): Promise<CHAdvancedSearchResponse> {
    const { data } = await requestWithBackoff(() =>
      client.get<Record<string, unknown>>("/advanced-search/companies", { params })
    );
    // API may return snake_case or camelCase; normalize to our expected shape
    const rawItems = (data.items ?? data.Items ?? []) as Record<string, unknown>[];
    const items: CHCompanySearchItem[] = rawItems.map((c) => ({
      company_number: (c.company_number ?? c.companyNumber) as string,
      company_name: (c.company_name ?? c.companyName) as string,
      company_status: (c.company_status ?? c.companyStatus) as string,
      company_type: (c.company_type ?? c.companyType) as string,
      date_of_creation: (c.date_of_creation ?? c.dateOfCreation) as string | undefined,
      sic_codes: (c.sic_codes ?? c.sicCodes) as string[] | undefined,
      registered_office_address: (c.registered_office_address ?? c.registeredOfficeAddress) as CHAddress | undefined,
    }));
    const totalResults = Number(data.total_results ?? data.totalResults ?? 0);
    const pageNumber = Number(data.page_number ?? data.pageNumber ?? 0);
    const itemsPerPage = Number(data.items_per_page ?? data.itemsPerPage ?? 0);
    return {
      items,
      total_results: totalResults,
      page_number: pageNumber,
      items_per_page: itemsPerPage,
    };
  }

  async function getOfficers(companyNumber: string): Promise<CHOfficersResponse | null> {
    try {
      // One main attempt; if we get a 429, wait briefly and retry once.
      const fetchOnce = async () => {
        return client.get<Record<string, unknown>>(
          `/company/${encodeURIComponent(companyNumber)}/officers`,
          {
            params: { items_per_page: 100 },
          }
        );
      };

      let resp;
      try {
        resp = await fetchOnce();
      } catch (err) {
        const status = (err as AxiosError)?.response?.status;
        if (status === 429) {
          // Back off a bit, then try once more.
          await sleep(2000);
          resp = await fetchOnce();
        } else {
          throw err;
        }
      }

      const data = resp!.data as Record<string, unknown>;
      const rawItems = (data.items ?? data.Items ?? []) as Record<string, unknown>[];
      const items: CHOfficerItem[] = rawItems.map((o) => {
        const dob = (o.date_of_birth ?? o.dateOfBirth) as { month?: number; year?: number } | undefined;
        return {
          name: (o.name ?? "") as string,
          officer_role: (o.officer_role ?? o.officerRole ?? "") as string,
          appointed_on: (o.appointed_on ?? o.appointedOn) as string | undefined,
          resigned_on: (o.resigned_on ?? o.resignedOn) as string | undefined,
          date_of_birth: dob,
          nationality: (o.nationality ?? "") as string | undefined,
          occupation: (o.occupation ?? "") as string | undefined,
          address: (o.address ?? o.registered_address ?? o.registeredAddress) as CHAddress | undefined,
        };
      });
      const totalResults = Number(
        (data as { total_results?: number; totalResults?: number }).total_results ??
          (data as { total_results?: number; totalResults?: number }).totalResults ??
          0
      );
      return { items, total_results: totalResults };
    } catch (err) {
      console.error(`Officer fetch failed for company ${companyNumber}:`, (err as Error).message);
      return null;
    }
  }

  return {
    client,
    advancedSearch,
    getOfficers,
    formatAddress,
    ITEMS_PER_PAGE,
    officerDelayMs,
    sleep,
  };
}

export type CompaniesHouseClient = ReturnType<typeof createCompaniesHouseClient>;
