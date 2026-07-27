"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { FILES_DIR, loadCv, validateCv } = require("./lib");
const { renderCvHtml } = require("./generate-html");
const { generatePages } = require("./generate-pages");
const { generatePdf } = require("./generate-pdf");

async function run() {
  const cv = loadCv();

  const { errors } = validateCv(cv);
  assert.deepStrictEqual(errors, [], `Sample CV data should be valid, but found: ${errors.join("; ")}`);
  console.log("PASS  validate: sample CV data is valid");

  const html = renderCvHtml();
  assert.ok(html.includes("Example Article Title"), "Rendered CV HTML (used for the PDF) should include a sample publication");
  console.log("PASS  renderCvHtml: CV HTML for PDF rendering includes expected content");

  const { indexPath, resourcesPath } = generatePages();
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const publicationsSection = indexHtml.match(/id="publications"[\s\S]*?<\/section>/)?.[0] || "";
  assert.ok(publicationsSection.includes("Example Article Title"), "Selected Publications should include the featured sample publication");
  assert.ok(
    !publicationsSection.includes("Example Forthcoming Article Title"),
    "Selected Publications should not include a non-featured publication (research accordions may still reference it by id)"
  );
  assert.ok(indexHtml.includes('id="research"'), "Generated index.html should include the Research section");
  assert.ok(indexHtml.includes('id="contact"'), "Generated index.html should include the Contact section");
  console.log("PASS  build:pages: index.html generated with expected content");

  const resourcesHtml = fs.readFileSync(resourcesPath, "utf8");
  assert.ok(resourcesHtml.includes("Sample Syllabus"), "Generated resources.html should include a sample resource");
  console.log("PASS  build:pages: resources.html generated with expected content");

  await generatePdf();
  const pdfPath = path.join(FILES_DIR, "professor-cv.pdf");
  assert.ok(fs.existsSync(pdfPath), "professor-cv.pdf should exist");
  assert.ok(fs.statSync(pdfPath).size > 0, "professor-cv.pdf should not be empty");
  console.log("PASS  build:pdf: professor-cv.pdf generated");

  console.log("\nAll checks passed.");
}

run().catch((err) => {
  console.error("FAIL", err.message);
  process.exitCode = 1;
});
