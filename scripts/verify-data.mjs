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
console.log(
  JSON.stringify(
    {
      status: "pass",
      documents: catalog.length,
      pages: offset,
      cachedDocuments: manifest.featured.length,
      verifiedImageHashes: images,
      publicOcrFields: 0,
    },
    null,
    2,
  ),
);
