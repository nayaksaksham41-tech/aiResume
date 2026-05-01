const puppeteer = require("puppeteer");

const launchArgs =
  process.env.PUPPETEER_NO_SANDBOX === "true" ? ["--no-sandbox", "--disable-setuid-sandbox"] : [];

async function generatePdfBuffer(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: launchArgs,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

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
