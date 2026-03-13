/**
 * Send one test email via Resend (no CSV fetch).
 * Run: npm run test-email
 */
import { config } from "dotenv";
import { resolve } from "path";
import axios from "axios";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = process.env.DAILY_FETCH_EMAIL_TO?.trim();
  // Resend accepts: "Display Name" <email@domain.com>
  const from =
    process.env.RESEND_FROM?.trim() ||
    process.env.DAILY_FETCH_EMAIL_FROM?.trim() ||
    'Company Scout <onboarding@resend.dev>';

  if (!key) throw new Error("RESEND_API_KEY missing in .env.local");
  if (!to) throw new Error("DAILY_FETCH_EMAIL_TO missing in .env.local");

  const { data } = await axios.post(
    "https://api.resend.com/emails",
    {
      from,
      to: to.split(",").map((e) => e.trim()).filter(Boolean),
      subject: "Company Scout — Resend test",
      text: "If you see this, Resend + .env.local are working.\n\nDaily CSV uses the same settings.",
    },
    {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    }
  );
  console.log("Sent. Resend response:", JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e?.response?.data ?? e?.message ?? e);
  process.exit(1);
});
