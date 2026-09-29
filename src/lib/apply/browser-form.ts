import { extractionFromHtml } from "./form-extract";
import type { FormExtraction } from "./types";

/**
 * Reads the fields of a rendered application form (Ashby and company sites) with
 * Playwright, headless. Read-only: it opens the page, waits for it to settle and
 * takes its HTML. It clicks nothing, types nothing and never submits. A login
 * wall or a CAPTCHA is reported as `blocked` (nothing is read; fill it by hand).
 */
export async function extractFormWithBrowser(url: string): Promise<FormExtraction> {
  const playwright = await import("playwright");
  let browser;

  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch {
    browser = await playwright.chromium.launch({ channel: "chrome", headless: true });
  }

  try {
    const context = await browser.newContext({
      locale: "en-US",
      userAgent: "Mozilla/5.0 (compatible; JobTrackerRadar/1.0; +https://local.job-tracker)",
    });
    const page = await context.newPage();

    await page.goto(url, { timeout: 45_000, waitUntil: "domcontentloaded" });

    try {
      await page.waitForLoadState("networkidle", { timeout: 8_000 });
    } catch {
      // Single-page apps that never go idle: the DOM is what we have.
      await page.waitForTimeout(2_000);
    }

    // Ashby lists the job first; the form is a separate tab that renders on the application URL.
    return extractionFromHtml(await page.content(), "browser");
  } finally {
    await browser.close();
  }
}
