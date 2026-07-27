"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const TEMPLATES_DIR = path.join(ROOT, "templates");
const FILES_DIR = path.join(ROOT, "assets", "files");

const SECTIONS = [
  { key: "education", label: "Education", order: "manual-then-year" },
  { key: "appointments", label: "Academic Appointments", order: "manual-then-year" },
  { key: "books", label: "Books", order: "manual-then-year" },
  { key: "chapters", label: "Book Chapters", order: "manual-then-year" },
  { key: "publications", label: "Journal Articles", order: "manual-then-year" },
  { key: "presentations", label: "Presentations", order: "manual-then-year" },
  { key: "grants", label: "Grants", order: "manual-then-year" },
  { key: "awards", label: "Awards", order: "manual-then-year" },
  { key: "teaching", label: "Teaching", order: "manual" },
  { key: "service", label: "Professional Service", order: "manual" },
  { key: "media", label: "Media", order: "manual-then-year" },
  { key: "other", label: "Additional Information", order: "manual" },
];

const KNOWN_SECTION_KEYS = new Set(["profile", ...SECTIONS.map((s) => s.key)]);

const PUBLICATION_SECTION_KEYS = ["publications", "books", "chapters"];
const MAX_FEATURED_PUBLICATIONS = 5;

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function loadCv() {
  return loadJson(path.join(CONTENT_DIR, "cv.json"));
}

function loadSite() {
  return loadJson(path.join(CONTENT_DIR, "site.json"));
}

function loadResources() {
  return loadJson(path.join(CONTENT_DIR, "resources.json"));
}

/** Publications are entered as one plain-text box instead of separate form
 * fields: line 1 is the year, line 2 the title, line 3 the authors, line 4
 * the journal, and any remaining lines are additional notes. Blank lines are
 * ignored so pasted or loosely-formatted text still parses. */
function parsePublicationText(rawText) {
  const lines = String(rawText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const [year = "", title = "", authors = "", journal = "", ...rest] = lines;
  return { year, title, authors, journal, notes: rest.join(" ") };
}

function entryYear(entry) {
  if (entry.text) {
    const parsed = parsePublicationText(entry.text);
    const match = parsed.year.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : 0;
  }
  const candidate = entry.year || entry.endYear || entry.startYear || entry.years || "";
  const match = String(candidate).match(/\d{4}/g);
  if (!match) return 0;
  return parseInt(match[match.length - 1], 10);
}

/** Publications, books, and chapters all feed the single "Selected
 * Publications" list on the homepage, so callers that need "all
 * publication-like entries" pull from all three sections at once. */
function getPublicationEntries(cv) {
  const combined = [];
  for (const sectionKey of PUBLICATION_SECTION_KEYS) {
    for (const entry of cv[sectionKey] || []) {
      if (entry.hidden) continue;
      combined.push({ ...entry, __sectionKey: sectionKey });
    }
  }
  return combined;
}

function getVisibleSorted(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => !entry.hidden)
    .slice()
    .sort((a, b) => {
      const sortA = a.sortOrder ?? 1000;
      const sortB = b.sortOrder ?? 1000;
      if (sortA !== sortB) return sortA - sortB;
      return entryYear(b) - entryYear(a);
    });
}

/** Normalizes any section entry into a common shape so HTML and DOCX
 * generators render identical content without duplicating field logic. */
function formatEntry(sectionKey, entry) {
  const links = [];
  if (entry.doi) links.push({ label: "DOI", url: entry.doi.startsWith("http") ? entry.doi : `https://doi.org/${entry.doi}` });
  if (entry.url) links.push({ label: "Link", url: entry.url });

  let title = entry.title || entry.degree || entry.course || entry.name || "Untitled entry";
  let subtitle = "";
  let status = entry.status && entry.status !== "Published" ? entry.status : null;

  switch (sectionKey) {
    case "education":
      title = entry.degree;
      subtitle = [entry.institution, entry.year].filter(Boolean).join(", ");
      break;
    case "appointments":
      title = entry.title;
      subtitle = [entry.institution, `${entry.startYear || ""}–${entry.endYear || ""}`].filter(Boolean).join(", ");
      break;
    case "publications": {
      const parsed = parsePublicationText(entry.text);
      title = parsed.title || "Untitled publication";
      const parts = [parsed.authors, parsed.journal, parsed.notes, parsed.year];
      subtitle = parts.filter(Boolean).join(". ");
      break;
    }
    case "presentations":
      title = entry.title;
      subtitle = [entry.event, entry.location, entry.year].filter(Boolean).join(", ");
      break;
    case "teaching":
      title = entry.course;
      subtitle = [entry.institution, entry.years].filter(Boolean).join(", ");
      break;
    default:
      subtitle = [entry.institution || entry.publisher || entry.organization, entry.year].filter(Boolean).join(", ");
      break;
  }

  if (entry.details) {
    subtitle = subtitle ? `${subtitle}. ${entry.details}` : entry.details;
  }

  let year = "—";
  if (entry.text) {
    year = parsePublicationText(entry.text).year || "—";
  } else if (entry.year) {
    year = entry.year;
  } else if (entry.startYear) {
    year = `${entry.startYear}–${entry.endYear || "Present"}`;
  } else if (entry.years) {
    year = entry.years;
  }

  return {
    id: entry.id,
    title,
    subtitle,
    status,
    links,
    year,
    featured: !!entry.featured,
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Returns { errors: string[] } with plain-language messages. An empty
 * errors array means the CV data is safe to publish. */
function validateCv(cv) {
  const errors = [];
  const seenIds = new Set();

  for (const key of Object.keys(cv)) {
    if (!KNOWN_SECTION_KEYS.has(key)) {
      errors.push(`"${key}" is not a recognized CV section. Please check the section name.`);
    }
  }

  const profile = cv.profile || {};
  if (!profile.name) errors.push("The profile is missing a name.");
  if (!profile.email) {
    errors.push("The profile is missing an email address.");
  } else if (!isValidEmail(profile.email)) {
    errors.push(`The profile email "${profile.email}" does not look like a valid email address.`);
  }

  for (const section of SECTIONS) {
    const entries = cv[section.key];
    if (entries === undefined) continue;
    if (!Array.isArray(entries)) {
      errors.push(`The "${section.label}" section should be a list of entries, but it isn't. Please contact the website administrator.`);
      continue;
    }

    for (const entry of entries) {
      const parsedText = section.key === "publications" ? parsePublicationText(entry.text) : null;
      const label = entry.title || entry.degree || entry.course || entry.name || parsedText?.title || "(untitled entry)";

      if (!entry.id) {
        errors.push(`An entry in "${section.label}" (${label}) is missing an id.`);
      } else if (seenIds.has(entry.id)) {
        errors.push(`The id "${entry.id}" is used more than once. Each entry needs a unique id.`);
      } else {
        seenIds.add(entry.id);
      }

      if (section.key === "publications") {
        if (!parsedText.title) {
          errors.push(`A publication is missing a title. In the text box, line 2 should be the title.`);
        }
        if (!parsedText.year && !entry.status) {
          errors.push(`The publication "${label}" is missing a year. Add a year as the first line of the text box, or mark it as forthcoming.`);
        }
      }

      if (entry.url && !isValidUrl(entry.url)) {
        errors.push(`The entry "${label}" has an invalid web link: "${entry.url}".`);
      }

      for (const yearField of ["year", "startYear", "endYear"]) {
        const value = entry[yearField];
        if (value && value !== "Present" && !/^\d{4}$/.test(String(value))) {
          errors.push(`The entry "${label}" has an unusual ${yearField} value: "${value}". Use a four-digit year or "Present".`);
        }
      }
    }
  }

  const featuredCount = getPublicationEntries(cv).filter((entry) => entry.featured).length;
  if (featuredCount > MAX_FEATURED_PUBLICATIONS) {
    errors.push(
      `You've marked ${featuredCount} publications as featured, but only ${MAX_FEATURED_PUBLICATIONS} can be shown under "Selected Publications" on the homepage. Please unfeature ${featuredCount - MAX_FEATURED_PUBLICATIONS} of them.`
    );
  }

  return { errors };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

module.exports = {
  ROOT,
  CONTENT_DIR,
  TEMPLATES_DIR,
  FILES_DIR,
  SECTIONS,
  loadJson,
  loadCv,
  loadSite,
  loadResources,
  getPublicationEntries,
  getVisibleSorted,
  formatEntry,
  validateCv,
  escapeHtml,
  parsePublicationText,
  MAX_FEATURED_PUBLICATIONS,
};
