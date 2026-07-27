"use strict";

/** Lightweight local check of .pages.yml against the real Pages CMS schema
 * rules (github.com/pages-cms/pages-cms: types/field.ts, lib/config-schema.ts).
 * Not a full reimplementation of their Zod schema - just the specific
 * mistakes that are easy to make and hard to notice without a live CMS to
 * click through: wrong "options" shape, unknown field keys, malformed
 * media config. Run with: node scripts/audit-pages-yml.js */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ALLOWED_FIELD_KEYS = new Set([
  "name", "label", "description", "component", "default", "fields",
  "type", "list", "hidden", "readonly", "required", "pattern", "options",
  "blocks", "blockKey",
]);

const KNOWN_TYPES = new Set([
  "string", "text", "number", "boolean", "select", "date", "code", "file",
  "image", "reference", "rich-text", "uuid", "object", "block",
]);

let errors = 0;

function fail(message) {
  console.error(`FAIL  ${message}`);
  errors++;
}

function checkField(field, path) {
  for (const key of Object.keys(field)) {
    if (!ALLOWED_FIELD_KEYS.has(key)) {
      fail(`${path}: unknown field key "${key}" (Pages CMS field schemas are strict - unrecognized keys can break config parsing)`);
    }
  }

  if (field.type && !KNOWN_TYPES.has(field.type)) {
    fail(`${path}: unknown type "${field.type}"`);
  }

  if (field.type === "select") {
    if (!field.options || Array.isArray(field.options) || !Array.isArray(field.options.values)) {
      fail(`${path}: select fields need options: { values: [...] }, not a bare array under options`);
    }
  }

  if (field.type === "object" && !field.fields) {
    fail(`${path}: type object requires a "fields" list`);
  }

  if (field.fields) {
    for (const sub of field.fields) checkField(sub, `${path}.${sub.name}`);
  }
}

function main() {
  const configPath = path.join(__dirname, "..", ".pages.yml");
  const doc = yaml.load(fs.readFileSync(configPath, "utf8"));

  if (doc.media !== undefined) {
    if (Array.isArray(doc.media)) {
      doc.media.forEach((entry, i) => {
        if (!entry.name) fail(`media[${i}]: named media array entries require "name"`);
      });
    } else if (typeof doc.media !== "object" && typeof doc.media !== "string") {
      fail(`root media: must be a string, an object, or an array of named configs`);
    }
  }

  for (const content of doc.content || []) {
    if (!["collection", "file"].includes(content.type)) {
      fail(`${content.name}: type must be "collection" or "file", got "${content.type}"`);
    }
    for (const field of content.fields || []) {
      checkField(field, `${content.name}.${field.name}`);
    }
  }

  if (errors === 0) {
    console.log("PASS  .pages.yml looks structurally correct.");
  } else {
    console.error(`\n${errors} issue(s) found.`);
    process.exitCode = 1;
  }
}

main();
