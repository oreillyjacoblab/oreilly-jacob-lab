"use strict";

const { loadCv, validateCv } = require("./lib");
const { generatePages } = require("./generate-pages");
const { generatePdf } = require("./generate-pdf");

async function run() {
  console.log("Validating CV data...");
  const cv = loadCv();
  const { errors } = validateCv(cv);
  if (errors.length > 0) {
    console.error("\nThere was a problem publishing your CV.\n");
    console.error("Please fix the following before publishing:\n");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("CV data is valid.\n");

  console.log("Generating website...");
  generatePages();
  console.log("Website generated.\n");

  try {
    console.log("Generating PDF CV...");
    await generatePdf();
    console.log("PDF CV generated.\n");
  } catch (err) {
    console.error("Your changes were saved, but the new PDF could not be created.");
    console.error("Please contact the website administrator.");
    console.error(`\nDetails for the administrator: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log("Your website and PDF CV have been updated.");
}

if (require.main === module) {
  run();
}

module.exports = { run };
