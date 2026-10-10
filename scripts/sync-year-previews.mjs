import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(await fs.readFile(new URL("public/data/catalog.json", root)));
const manifest = JSON.parse(await fs.readFile(new URL("public/data/manifest.json", root)));
const api = "https://datasets-server.huggingface.co";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Preview request failed (${response.status})`);
  return response;
}
const splits = await (await get(`${api}/splits?${new URLSearchParams({ dataset: manifest.dataset })}`)).json();
assert(splits.splits.some((split) => split.config === "pages" && split.split === "corpus"));
await fs.mkdir(new URL("public/data/year-previews/", root), { recursive: true });
const previews = [];
const selected = manifest.years.map((year) => {
  // Reuse the curated examples already in this app; otherwise the first multi-page record.
  const records = catalog.filter((record) => record.year === year);
  return records.find((record) => manifest.featured.includes(record.id)) ||
    records.find((record) => record.pages >= 3) || records[0];
});
async function collect(record) {
  let page;
  if (manifest.featured.includes(record.id)) {
    const cached = JSON.parse(await fs.readFile(new URL(`public/data/${record.id}.json`, root)));
    page = cached.pages.find((item) => item.page === 1);
  } else {
    const params = new URLSearchParams({ dataset: manifest.dataset, config: "pages", split: "corpus", offset: String(record.start), length: "1" });
    const payload = await (await get(`${api}/rows?${params}`)).json();
    const row = payload.rows?.[0]?.row;
    assert.equal(row?.document_id, record.id, `Document mismatch: ${record.year}`);
    assert.equal(row.page, 1);
    assert(row.page_id.startsWith(record.id + "_"));
    const bytes = Buffer.from(await (await get(row.image.src)).arrayBuffer());
    assert(bytes.length > 1000 && bytes[0] === 0xff && bytes[1] === 0xd8, `Invalid JPEG: ${record.year}`);
    const image = `/data/year-previews/${record.year}.jpg`;
    await fs.writeFile(new URL("public" + image, root), bytes);
    // Explicit allowlist: no OCR text or token fields are retained.
    page = { id: row.page_id, image, width: row.width, height: row.height, sourceHash: row.image_sha256, previewHash: hash(bytes) };
  }
  const bytes = await fs.readFile(new URL("public" + page.image, root));
  assert.equal(hash(bytes), page.previewHash);
  previews.push({ year: record.year, recordId: record.id, pageId: page.id, image: page.image, width: page.width, height: page.height, sourceHash: page.sourceHash, previewHash: page.previewHash });
  console.log(`${record.year}: ${record.title} ${record.issue}회 · 첫 장 확인`);
}
for (let i = 0; i < selected.length; i += 3) await Promise.all(selected.slice(i, i + 3).map(collect));
previews.sort((a, b) => a.year - b.year);
assert.equal(previews.length, manifest.years.length);
await fs.writeFile(new URL("src/yearPreviews.json", root), JSON.stringify({
  source: manifest.source,
  generatedAt: new Date().toISOString(),
  selection: "Existing featured record, otherwise the first record with at least three pages; always page 1.",
  imageNote: "Unmodified Dataset Viewer JPEG previews. OCR fields excluded.",
  previews,
}, null, 2) + "\n");
console.log(`Verified ${previews.length} year previews.`);
