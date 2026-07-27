"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { ROOT, loadResources } = require("./lib");

const THUMB_DIR = path.join(ROOT, "assets", "files", "resources", "thumbnails");
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const OFFICE_EXTS = new Set([".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"]);

/** Finds an existing thumbnail for this resource (any extension) so we don't
 * re-render on every build. Returns null if none exists or the source file
 * has changed since it was generated. */
function findFreshThumbnail(resource, sourceMtimeMs) {
  if (!fs.existsSync(THUMB_DIR)) return null;
  const match = fs.readdirSync(THUMB_DIR).find((name) => name.startsWith(`${resource.id}.`));
  if (!match) return null;
  const thumbPath = path.join(THUMB_DIR, match);
  if (fs.statSync(thumbPath).mtimeMs < sourceMtimeMs) return null;
  return thumbPath;
}

function rasterizeFirstPage(pdfPath, resource) {
  const outPrefix = path.join(THUMB_DIR, resource.id);
  try {
    execFileSync("pdftoppm", ["-png", "-f", "1", "-l", "1", "-scale-to", "500", pdfPath, outPrefix], { stdio: "ignore" });
  } catch {
    return null;
  }
  // pdftoppm zero-pads the page number based on the document's total page
  // count (e.g. "-1" for a short doc, "-01" for a doc with 10+ pages), so
  // find whatever it actually produced rather than assuming one suffix.
  const prefixName = path.basename(outPrefix);
  const rendered = fs
    .readdirSync(THUMB_DIR)
    .find((name) => name.startsWith(`${prefixName}-`) && name.endsWith(".png"));
  if (!rendered) return null;
  const finalPath = `${outPrefix}.png`;
  fs.renameSync(path.join(THUMB_DIR, rendered), finalPath);
  return finalPath;
}

/** Cover-page style preview: PDFs are rasterized to an image of page one,
 * office documents (docx/pptx/etc.) are first converted to PDF via
 * LibreOffice, and image files are used as-is. Unsupported types (or
 * missing conversion tools) simply have no preview. */
function generateThumbnail(resource) {
  const sourcePath = path.join(ROOT, resource.file || "");
  if (!fs.existsSync(sourcePath)) return null;

  const sourceMtimeMs = fs.statSync(sourcePath).mtimeMs;
  const cached = findFreshThumbnail(resource, sourceMtimeMs);
  if (cached) return path.relative(ROOT, cached);

  fs.mkdirSync(THUMB_DIR, { recursive: true });
  const ext = path.extname(sourcePath).toLowerCase();

  if (IMAGE_EXTS.has(ext)) {
    const thumbPath = path.join(THUMB_DIR, `${resource.id}${ext}`);
    fs.copyFileSync(sourcePath, thumbPath);
    return path.relative(ROOT, thumbPath);
  }

  if (ext === ".pdf") {
    const thumbPath = rasterizeFirstPage(sourcePath, resource);
    return thumbPath ? path.relative(ROOT, thumbPath) : null;
  }

  if (OFFICE_EXTS.has(ext)) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resource-thumb-"));
    try {
      execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", tmpDir, sourcePath], { stdio: "ignore" });
      const converted = path.join(tmpDir, `${path.basename(sourcePath, ext)}.pdf`);
      if (!fs.existsSync(converted)) return null;
      const thumbPath = rasterizeFirstPage(converted, resource);
      return thumbPath ? path.relative(ROOT, thumbPath) : null;
    } catch {
      return null;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  return null;
}

function generateThumbnails() {
  const { resources } = loadResources();
  const thumbnails = {};
  for (const resource of resources) {
    const thumb = generateThumbnail(resource);
    if (thumb) thumbnails[resource.id] = thumb;
  }
  return thumbnails;
}

if (require.main === module) {
  const thumbnails = generateThumbnails();
  console.log(`Generated ${Object.keys(thumbnails).length} resource thumbnail(s).`);
}

module.exports = { generateThumbnails };
