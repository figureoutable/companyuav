import axios, { AxiosInstance, AxiosError } from "axios";
import type { CHAdvancedSearchResponse, CHOfficersResponse } from "@/types";

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
      client.get<CHAdvancedSearchResponse>("/advanced-search/companies", { params })
    );
    return data;
  }

  async function getOfficers(companyNumber: string): Promise<CHOfficersResponse | null> {
    try {
      const { data } = await requestWithBackoff(() =>
        client.get<CHOfficersResponse>(`/company/${encodeURIComponent(companyNumber)}/officers`, {
          params: { items_per_page: 100 },
        })
      );
      return data;
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
