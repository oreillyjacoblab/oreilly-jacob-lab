"use strict";

const fs = require("fs");
const path = require("path");
const { FILES_DIR } = require("./lib");
const { renderCvHtml } = require("./generate-html");

/** Vercel's build containers are missing shared libraries (libnss3, etc.)
 * that full Puppeteer's bundled Chromium needs, even with --no-sandbox.
 * @sparticuz/chromium is a statically-linked build made for exactly this
 * (Lambda/Vercel) environment. Everywhere else — local dev, GitHub Actions —
 * regular Puppeteer's own bundled Chromium works fine. */
async function launchBrowser() {
  if (process.env.VERCEL) {
    const chromium = require("@sparticuz/chromium").default;
    const puppeteerCore = require("puppeteer-core");
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const puppeteer = require("puppeteer");
  // --no-sandbox is required in CI containers (e.g. GitHub Actions) where
  // Chromium can't get a sandboxing namespace; the HTML we render is always
  // our own generated content, never third-party input, so this is safe here.
  return puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
}

async function generatePdf() {
  const html = renderCvHtml();
  const outputPath = path.join(FILES_DIR, "professor-cv.pdf");
  fs.mkdirSync(FILES_DIR, { recursive: true });

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outputPath,
      format: "Letter",
      printBackground: true,
      margin: { top: "0.75in", bottom: "0.75in", left: "0.75in", right: "0.75in" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:9px; width:100%; text-align:center; color:#666;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
  } finally {
    await browser.close();
  }

  return outputPath;
}

if (require.main === module) {
  generatePdf()
    .then(() => console.log("PDF CV generated."))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}

module.exports = { generatePdf };
