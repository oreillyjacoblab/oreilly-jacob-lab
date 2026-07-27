"use strict";

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { FILES_DIR } = require("./lib");
const { renderCvHtml } = require("./generate-html");

async function generatePdf() {
  const html = renderCvHtml();
  const outputPath = path.join(FILES_DIR, "professor-cv.pdf");
  fs.mkdirSync(FILES_DIR, { recursive: true });

  // --no-sandbox is required in CI containers (GitHub Actions, Vercel) where
  // Chromium can't get a sandboxing namespace; the HTML we render is always
  // our own generated content, never third-party input, so this is safe here.
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
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
