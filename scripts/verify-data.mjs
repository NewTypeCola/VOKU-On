import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const root = new URL("../public/data/", import.meta.url);
const read = (name) => fs.readFile(new URL(name, root));
const hash = (b) => createHash("sha256").update(b).digest("hex");
const raw = await read("catalog.json");
const catalog = JSON.parse(raw);
const manifest = JSON.parse(await read("manifest.json"));
assert.equal(hash(raw), manifest.catalogFileHash);
assert.equal(catalog.length, manifest.documents);
assert.equal(new Set(catalog.map((r) => r.id)).size, catalog.length);
assert.equal(
  catalog.reduce((n, r) => n + r.pages, 0),
  manifest.pages,
);
let offset = 0,
  images = 0;
for (const record of catalog) {
  assert.equal(record.start, offset, `${record.id}: incorrect offset`);
  assert(
    record.pages > 0 &&
      record.title &&
      record.year >= 1988 &&
      record.year <= 2019,
  );
  offset += record.pages;
}
for (const id of manifest.featured) {
  const record = catalog.find((r) => r.id === id);
  assert(record);
  const doc = JSON.parse(await read(id + ".json"));
  assert.equal(doc.id, id);
  assert.equal(doc.pages.length, record.pages);
  for (const [index, page] of doc.pages.entries()) {
    assert.equal(page.page, index + 1);
    assert(page.id.startsWith(id + "_"));
    assert(page.width > 0 && page.height > 0);
    assert(
      !("text" in page) && !("ocr_text" in page) && !("ocr_lines" in page),
    );
    const image = await read(page.image.replace("/data/", ""));
    assert.equal(hash(image), page.previewHash, page.id);
    images++;
  }
}
assert.equal(images, manifest.cachedPages);
assert.equal(manifest.ocrIncluded, false);
const yearPreviews = JSON.parse(await fs.readFile(new URL("../src/yearPreviews.json", import.meta.url)));
assert.deepEqual(yearPreviews.previews.map((preview) => preview.year), manifest.years);
for (const preview of yearPreviews.previews) {
  const record = catalog.find((item) => item.id === preview.recordId);
  assert(record && record.year === preview.year, `Wrong preview year: ${preview.year}`);
  assert.equal(preview.pageId, record.id + "_page01");
  assert(preview.width > 0 && preview.height > 0);
  assert.deepEqual(Object.keys(preview).sort(), ["year", "recordId", "pageId", "image", "width", "height", "sourceHash", "previewHash"].sort());
  const bytes = await read(preview.image.replace("/data/", ""));
  assert.equal(hash(bytes), preview.previewHash, preview.pageId);
}
console.log(
  JSON.stringify(
    {
      status: "pass",
      documents: catalog.length,
      pages: offset,
      cachedDocuments: manifest.featured.length,
      verifiedImageHashes: images,
      publicOcrFields: 0,
      verifiedYearPreviews: yearPreviews.previews.length,
    },
    null,
    2,
  ),
);
