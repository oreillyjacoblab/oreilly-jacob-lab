"use strict";

const fs = require("fs");
const path = require("path");
const {
  ROOT,
  TEMPLATES_DIR,
  loadCv,
  loadSite,
  loadResources,
  getPublicationEntries,
  getVisibleSorted,
  formatEntry,
  escapeHtml,
  MAX_FEATURED_PUBLICATIONS,
} = require("./lib");
const { generateThumbnails } = require("./generate-thumbnails");

const TOPIC_ICONS = {
  circle: `<circle cx="50" cy="50" r="34" stroke="#2f6a5e" stroke-width="2" /><path d="M50 20 A30 30 0 0 1 78 60" stroke="#b8863b" stroke-width="3" fill="none" /><circle cx="78" cy="60" r="3" fill="#c1554a" />`,
  trend: `<path d="M15 70 L35 45 L55 55 L85 20" stroke="#2f6a5e" stroke-width="3" fill="none" /><circle cx="85" cy="20" r="4" fill="#c1554a" />`,
  cluster: `<circle cx="35" cy="35" r="14" stroke="#2f6a5e" stroke-width="2" /><circle cx="68" cy="35" r="14" stroke="#b8863b" stroke-width="2" /><circle cx="51" cy="65" r="14" stroke="#c1554a" stroke-width="2" />`,
};

function renderPublicationRow(sectionKey, entry, { compact } = {}) {
  const formatted = formatEntry(sectionKey, entry);
  const statusHtml = formatted.status ? ` <span class="cv-status">(${escapeHtml(formatted.status)})</span>` : "";
  const linksHtml = formatted.links
    .map((link) => `<a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a>`)
    .join("");

  return `
      <div class="pub-row${compact ? " pub-row-compact" : ""}">
        <span class="pub-year">${escapeHtml(formatted.year)}</span>
        <div>
          <p class="pub-title">${escapeHtml(formatted.title)}${statusHtml}</p>
          <p class="pub-venue">${escapeHtml(formatted.subtitle)}</p>
          ${linksHtml ? `<p class="pub-links">${linksHtml}</p>` : ""}
        </div>
      </div>`;
}

function renderPublicationsList(cv) {
  const featured = getVisibleSorted(getPublicationEntries(cv).filter((entry) => entry.featured)).slice(
    0,
    MAX_FEATURED_PUBLICATIONS
  );
  return featured.length
    ? featured.map((entry) => renderPublicationRow(entry.__sectionKey, entry)).join("\n")
    : '\n      <p class="empty-note">No publications featured yet. Mark up to five as "Featured" through the website editor to show them here.</p>';
}

function renderResearchTopics(site, cv) {
  const topics = site.researchTopics || [];
  if (topics.length === 0) return "";

  const entriesById = new Map(getPublicationEntries(cv).map((entry) => [entry.id, entry]));

  return topics
    .map((topic) => {
      const icon = TOPIC_ICONS[topic.icon] || TOPIC_ICONS.circle;
      const relatedEntries = (topic.publicationIds || [])
        .map((id) => entriesById.get(id))
        .filter(Boolean);

      const pubsHtml = relatedEntries.length
        ? relatedEntries.map((entry) => renderPublicationRow(entry.__sectionKey, entry, { compact: true })).join("\n")
        : '\n        <p class="empty-note">No publications linked to this research area yet.</p>';

      return `
      <details class="topic-card">
        <summary class="topic-summary">
          <div class="topic-thumb">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">${icon}</svg>
          </div>
          <span class="topic-label">${escapeHtml(topic.label)}</span>
          <h3>${escapeHtml(topic.question)}</h3>
        </summary>
        <div class="topic-panel">
          <p class="topic-blurb">${escapeHtml(topic.blurb)}</p>
          <div class="pub-list pub-list-compact">${pubsHtml}
          </div>
        </div>
      </details>`;
    })
    .join("\n");
}

function renderProfilePhoto(profile) {
  if (!profile.photo) return "";
  return `<img class="profile-photo" src="${escapeHtml(profile.photo)}" alt="${escapeHtml(profile.name)}" />`;
}

function renderResourceCard(resource, thumbnailPath) {
  const ext = path.extname(resource.file || "").replace(".", "").toUpperCase() || "FILE";
  const thumbHtml = thumbnailPath
    ? `<img src="${escapeHtml(thumbnailPath)}" alt="" loading="lazy" />`
    : `<span class="resource-thumb-fallback">${escapeHtml(ext)}</span>`;

  return `
      <div class="resource-card">
        <div class="resource-thumb">
          ${thumbHtml}
          <span class="resource-badge">${escapeHtml(ext)}</span>
        </div>
        <h3>${escapeHtml(resource.title)}</h3>
        <p>${escapeHtml(resource.description)}</p>
        <a class="btn btn-secondary" href="${escapeHtml(resource.file)}" download>Download</a>
      </div>`;
}

function renderResourcesList(resources, thumbnails) {
  const visible = getVisibleSorted(resources);
  return visible.length
    ? visible.map((resource) => renderResourceCard(resource, thumbnails[resource.id])).join("\n")
    : '\n      <p class="empty-note">No resources yet. Add one through the website editor.</p>';
}

function generateResourcesPage() {
  const { resources } = loadResources();
  const site = loadSite();
  const thumbnails = generateThumbnails();
  const template = fs.readFileSync(path.join(TEMPLATES_DIR, "resources-template.html"), "utf8");

  const html = template
    .replaceAll("{{SITE_NAME}}", escapeHtml(site.site.name))
    .replaceAll("{{FOOTER_NOTE}}", escapeHtml(site.site.footerNote))
    .replace("<!--RESOURCES_LIST-->", renderResourcesList(resources, thumbnails));
  const outputPath = path.join(ROOT, "resources.html");
  fs.writeFileSync(outputPath, html, "utf8");
  return outputPath;
}

function generateIndexPage() {
  const cv = loadCv();
  const site = loadSite();
  const profile = cv.profile;
  const template = fs.readFileSync(path.join(TEMPLATES_DIR, "index-template.html"), "utf8");

  const html = template
    .replaceAll("{{SITE_NAME}}", escapeHtml(site.site.name))
    .replaceAll("{{FOOTER_NOTE}}", escapeHtml(site.site.footerNote))
    .replaceAll("{{HERO_EYEBROW}}", escapeHtml(site.hero.eyebrow))
    .replaceAll("{{HERO_TITLE}}", escapeHtml(site.hero.title))
    .replaceAll("{{HERO_MISSION}}", escapeHtml(site.hero.mission))
    .replaceAll("{{PROFILE_NAME}}", escapeHtml(profile.name))
    .replaceAll("{{PROFILE_TITLE}}", escapeHtml(profile.title))
    .replaceAll("{{PROFILE_INSTITUTION}}", escapeHtml(profile.institution))
    .replaceAll("{{PROFILE_OFFICE}}", escapeHtml(profile.office))
    .replaceAll("{{PROFILE_PHONE}}", escapeHtml(profile.phone || ""))
    .replaceAll("{{PROFILE_EMAIL}}", escapeHtml(profile.email))
    .replaceAll("{{PROFILE_BIO}}", escapeHtml(profile.bio || ""))
    .replace("<!--PROFILE_PHOTO-->", renderProfilePhoto(profile))
    .replace("<!--RESEARCH_TOPICS-->", renderResearchTopics(site, cv))
    .replace("<!--PUBLICATIONS_LIST-->", renderPublicationsList(cv));
  const outputPath = path.join(ROOT, "index.html");
  fs.writeFileSync(outputPath, html, "utf8");
  return outputPath;
}

function generatePages() {
  const indexPath = generateIndexPage();
  const resourcesPath = generateResourcesPage();
  return { indexPath, resourcesPath };
}

if (require.main === module) {
  generatePages();
  console.log("index.html and resources.html generated.");
}

module.exports = { generatePages, generateIndexPage, generateResourcesPage };
