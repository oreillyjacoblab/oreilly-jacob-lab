"use strict";

const fs = require("fs");
const path = require("path");
const { ROOT, TEMPLATES_DIR, loadCv, SECTIONS, getVisibleSorted, formatEntry, escapeHtml } = require("./lib");

function renderEntry(sectionKey, entry) {
  const formatted = formatEntry(sectionKey, entry);
  const statusHtml = formatted.status ? ` <span class="cv-status">(${escapeHtml(formatted.status)})</span>` : "";
  const linksHtml = formatted.links
    .map((link) => `<a class="cv-entry-link" href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a>`)
    .join(" ");

  return `
      <li class="cv-entry${formatted.featured ? " cv-entry-featured" : ""}">
        <span class="cv-entry-year">${escapeHtml(formatted.year)}</span>
        <div>
          <p class="cv-entry-title">${escapeHtml(formatted.title)}${statusHtml}</p>
          ${formatted.subtitle ? `<p class="cv-entry-subtitle">${escapeHtml(formatted.subtitle)}</p>` : ""}
          ${linksHtml ? `<p class="cv-entry-links">${linksHtml}</p>` : ""}
        </div>
      </li>`;
}

function renderSection(section, entries) {
  const visible = getVisibleSorted(entries);
  if (visible.length === 0) return "";

  return `
    <section class="cv-section" id="${section.key}">
      <h2>${escapeHtml(section.label)}</h2>
      <ul class="cv-entry-list">${visible.map((entry) => renderEntry(section.key, entry)).join("")}
      </ul>
    </section>`;
}

/** Renders the full CV as a self-contained HTML string (CSS inlined, no nav/
 * footer) used only as the source Puppeteer prints to PDF. This is never
 * written to a public path — the website itself only links to the PDF and
 * Word downloads from the About page. */
function renderCvHtml() {
  const cv = loadCv();
  const template = fs.readFileSync(path.join(TEMPLATES_DIR, "cv-print-template.html"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "assets", "css", "styles.css"), "utf8");

  const sectionsHtml = SECTIONS.map((section) => renderSection(section, cv[section.key])).filter(Boolean).join("\n");

  const generatedDate = new Date().toISOString().slice(0, 10);
  const profile = cv.profile || {};

  return template
    .replaceAll("{{PROFILE_NAME}}", escapeHtml(profile.name || ""))
    .replaceAll("{{PROFILE_TITLE}}", escapeHtml(profile.title || ""))
    .replaceAll("{{PROFILE_INSTITUTION}}", escapeHtml(profile.institution || ""))
    .replaceAll("{{PROFILE_EMAIL}}", escapeHtml(profile.email || ""))
    .replaceAll("{{GENERATED_DATE}}", generatedDate)
    .replace("{{INLINE_CSS}}", css)
    .replace("<!--CV_SECTIONS-->", sectionsHtml);
}

module.exports = { renderCvHtml };
