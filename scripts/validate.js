"use strict";

const { loadCv, validateCv } = require("./lib");

function run() {
  const cv = loadCv();
  const { errors } = validateCv(cv);

  if (errors.length > 0) {
    console.error("Your CV data has some issues that need to be fixed before publishing:\n");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.error("");
    process.exitCode = 1;
    return;
  }

  console.log("CV data is valid.");
}

if (require.main === module) {
  run();
}

module.exports = { run };
