/**
 * Daily job: fetch ~2k companies incorporated the previous day, build CSV,
 * save to exports/, optionally upload to Google Drive, optionally email CSV.
 *
 * Run: npm run daily-fetch
 * Cron (1am daily): 0 1 * * * cd /path/to/CompanyScout && npm run daily-fetch >> logs/daily-fetch.log 2>&1
 *
 * Requires: .env.local with COMPANIES_HOUSE_API_KEY
 * Optional: Google Drive + SMTP (see README)
 */

import { config } from "dotenv";
import { resolve } from "path";
import { mkdir, writeFile } from "fs/promises";
import axios from "axios";
import { createCompaniesHouseClient } from "../lib/companiesHouse";
import { buildCsvContent } from "../lib/csvExport";
import type { CompanyDirectorRow } from "../types";

// Load .env.local from project root
config({ path: resolve(process.cwd(), ".env.local") });

const MAX_COMPANIES = Number(process.env.MAX_COMPANIES_PER_SEARCH) || 2000;
const OFFICER_DELAY_MS = Number(process.env.OFFICER_FETCH_DELAY_MS) || 700;

function getYesterdayDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 1);
  to.setDate(to.getDate() - 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

async function fetchPreviousDayRows(): Promise<CompanyDirectorRow[]> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    throw new Error("COMPANIES_HOUSE_API_KEY is not set in .env.local");
  }

  const { from, to } = getYesterdayDateRange();
  const ch = createCompaniesHouseClient(apiKey, OFFICER_DELAY_MS);
  const allRows: CompanyDirectorRow[] = [];
  let startIndex = 0;
  let totalResults = 0;
  let companiesProcessed = 0;
  let firstCompanyNumberOfPrevPage: string | null = null;

  console.log(`[daily-fetch] Fetching companies incorporated between ${from} and ${to} (max ${MAX_COMPANIES} companies)...`);

  while (true) {
    if (companiesProcessed >= MAX_COMPANIES) break;

    const res = await ch.advancedSearch({
      incorporated_from: from,
      incorporated_to: to,
      start_index: startIndex,
      items_per_page: ch.ITEMS_PER_PAGE,
    });
    const items = res.items ?? [];
    totalResults = res.total_results ?? 0;

    if (items.length === 0) break;

    const firstId = items[0]?.company_number ?? "";
    if (firstCompanyNumberOfPrevPage !== null && firstId === firstCompanyNumberOfPrevPage) break;
    firstCompanyNumberOfPrevPage = firstId;

    for (let i = 0; i < items.length; i++) {
      if (companiesProcessed >= MAX_COMPANIES) break;
      const company = items[i];
      const officersRes = await ch.getOfficers(company.company_number);
      await ch.sleep(OFFICER_DELAY_MS);

      const directors = (officersRes?.items ?? []).filter(
        (o) => o.officer_role?.toLowerCase() === "director"
      );
      const regAddress = ch.formatAddress(company.registered_office_address);
      const sicStr = (company.sic_codes ?? []).join("; ");
      const incorporationDate = company.date_of_creation ?? "";
      const companyHouseUrl = `https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`;

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
          company_house_url: companyHouseUrl,
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
            company_house_url: companyHouseUrl,
          });
        }
      }
      companiesProcessed++;
      if (companiesProcessed % 100 === 0) {
        console.log(`[daily-fetch] Processed ${companiesProcessed} companies, ${allRows.length} rows...`);
      }
    }

    startIndex += items.length;
    const hasMoreByTotal = totalResults > 0 && startIndex >= totalResults;
    if (hasMoreByTotal) break;
  }

  allRows.sort((a, b) => (b.incorporation_date || "").localeCompare(a.incorporation_date || ""));
  return allRows;
}

async function uploadToGoogleDrive(csvContent: string, filename: string): Promise<void> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!folderId || !keyPath) {
    console.log("[daily-fetch] Skipping Google Drive upload (set GOOGLE_DRIVE_FOLDER_ID and GOOGLE_APPLICATION_CREDENTIALS to enable).");
    return;
  }

  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({ keyFile: resolve(process.cwd(), keyPath), scopes: ["https://www.googleapis.com/auth/drive.file"] });
  const drive = google.drive({ version: "v3", auth });

  await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: "text/csv",
      body: csvContent,
    },
  });
  console.log(`[daily-fetch] Uploaded to Google Drive: ${filename}`);
}

async function emailCsv(csvContent: string, filename: string, rowCount: number): Promise<void> {
  const to = process.env.DAILY_FETCH_EMAIL_TO?.trim();
  const { from: day } = getYesterdayDateRange();
  const subject = `Companies House export — ${day} (${rowCount} rows)`;
  const textBody = `Attached: UK companies incorporated on ${day} (director rows).\nFile: ${filename}`;
  const toList = to?.split(",").map((e) => e.trim()).filter(Boolean) ?? [];

  // --- Resend (easiest: API key only) ---
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom =
    process.env.RESEND_FROM?.trim() ||
    process.env.DAILY_FETCH_EMAIL_FROM?.trim() ||
    'Company Scout <onboarding@resend.dev>';

  if (resendKey && to && toList.length > 0) {
    const base64 = Buffer.from(csvContent, "utf-8").toString("base64");
    await axios.post(
      "https://api.resend.com/emails",
      {
        from: resendFrom,
        to: toList,
        subject,
        text: textBody,
        attachments: [
          {
            filename,
            content: base64,
            content_type: "text/csv",
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`[daily-fetch] Emailed CSV via Resend to ${to}`);
    return;
  }

  // --- SMTP fallback ---
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const smtpFrom = process.env.DAILY_FETCH_EMAIL_FROM?.trim() || user;

  if (!to || !host || !user || !pass) {
    console.log(
      "[daily-fetch] Skipping email. Set RESEND_API_KEY + DAILY_FETCH_EMAIL_TO (+ optional RESEND_FROM), or SMTP_* vars."
    );
    return;
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: toList,
    subject,
    text: textBody,
    attachments: [{ filename, content: csvContent, contentType: "text/csv" }],
  });
  console.log(`[daily-fetch] Emailed CSV (SMTP) to ${to}`);
}

async function main() {
  const rows = await fetchPreviousDayRows();
  const { from } = getYesterdayDateRange();
  const filename = `companies_house_${from}.csv`;
  const csvContent = buildCsvContent(rows);

  await mkdir(resolve(process.cwd(), "exports"), { recursive: true });
  const localPath = resolve(process.cwd(), "exports", filename);
  await writeFile(localPath, csvContent, "utf-8");
  console.log(`[daily-fetch] Saved ${rows.length} rows to ${localPath}`);

  await uploadToGoogleDrive(csvContent, filename);
  await emailCsv(csvContent, filename, rows.length);
  console.log("[daily-fetch] Done.");
}

main().catch((err) => {
  console.error("[daily-fetch] Error:", err);
  process.exit(1);
});
