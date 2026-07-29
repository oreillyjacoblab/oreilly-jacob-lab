"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  FILES_DIR,
  loadCv,
  loadResources,
  validateCv,
  escapeHtml,
  getPublicationEntries,
  getVisibleSorted,
  formatEntry,
  parsePublicationText,
  MAX_FEATURED_PUBLICATIONS,
} = require("./lib");
const { renderCvHtml } = require("./generate-html");
const { generatePages } = require("./generate-pages");
const { generatePdf } = require("./generate-pdf");

/** These checks read whatever is actually in content/*.json rather than
 * hardcoded sample text, so they stay valid as real content replaces the
 * placeholders instead of breaking the moment someone edits the CV. */
async function run() {
  const cv = loadCv();

  const { errors } = validateCv(cv);
  assert.deepStrictEqual(errors, [], `CV data should be valid, but found: ${errors.join("; ")}`);
  console.log("PASS  validate: CV data is valid");

  const html = renderCvHtml();
  assert.ok(html.includes(escapeHtml(cv.profile.name)), "Rendered CV HTML (used for the PDF) should include the profile name");
  console.log("PASS  renderCvHtml: CV HTML for PDF rendering includes expected content");

  const { indexPath, resourcesPath } = generatePages();
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const publicationsSection = indexHtml.match(/id="publications"[\s\S]*?<\/section>/)?.[0] || "";

  const allPubs = getPublicationEntries(cv);
  const featured = getVisibleSorted(allPubs.filter((entry) => entry.featured)).slice(0, MAX_FEATURED_PUBLICATIONS);
  const nonFeatured = allPubs.find((entry) => !entry.featured && !entry.hidden);

  if (featured.length) {
    const expectedTitle = formatEntry(featured[0].__sectionKey, featured[0]).title;
    assert.ok(
      publicationsSection.includes(escapeHtml(expectedTitle)),
      "Selected Publications should include a featured publication's title"
    );
  }
  if (nonFeatured) {
    const nonFeaturedTitle = formatEntry(nonFeatured.__sectionKey, nonFeatured).title;
    assert.ok(
      !publicationsSection.includes(escapeHtml(nonFeaturedTitle)),
      "Selected Publications should not include a non-featured publication (research accordions may still reference it by id)"
    );
  }
  assert.ok(indexHtml.includes('id="research"'), "Generated index.html should include the Research section");
  assert.ok(indexHtml.includes('id="contact"'), "Generated index.html should include the Contact section");
  console.log("PASS  build:pages: index.html generated with expected content");

  const { resources } = loadResources();
  const resourcesHtml = fs.readFileSync(resourcesPath, "utf8");
  const visibleResources = getVisibleSorted(resources);
  if (visibleResources.length) {
    assert.ok(
      resourcesHtml.includes(escapeHtml(visibleResources[0].title)),
      "Generated resources.html should include the first resource's title"
    );
  }
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
