/**
 * PDF rendering: on Vercel use @sparticuz/chromium + puppeteer-core (small Lambda-compatible binary).
 * Locally, prefer full puppeteer (devDependency) when installed; otherwise fall back to sparticuz on Linux CI.
 */
async function launchBrowser() {
  const extraArgs =
    process.env.PUPPETEER_NO_SANDBOX === "true"
      ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
      : [];

  const useServerlessChromium =
    process.env.VERCEL === "1" || process.env.USE_SERVERLESS_CHROMIUM === "true";

  if (useServerlessChromium) {
    const chromium = require("@sparticuz/chromium");
    const puppeteer = require("puppeteer-core");
    const executablePath = await chromium.executablePath();
    return puppeteer.launch({
      args: [...chromium.args, ...extraArgs],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless !== false,
    });
  }

  try {
    const puppeteer = require("puppeteer");
    return puppeteer.launch({
      headless: true,
      args: extraArgs,
    });
  } catch (_e) {
    const chromium = require("@sparticuz/chromium");
    const puppeteer = require("puppeteer-core");
    const executablePath = await chromium.executablePath();
    return puppeteer.launch({
      args: [...chromium.args, ...extraArgs],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
    });
  }
}

async function generatePdfBuffer(html) {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: process.env.VERCEL ? "load" : "networkidle0",
      timeout: process.env.VERCEL ? 45000 : 120000,
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

module.exports = { generatePdfBuffer };
