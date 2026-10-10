import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const dataset = "NewTypeCola/VOKU-Archive";
const source = "https://huggingface.co/datasets/" + dataset;
const api = "https://datasets-server.huggingface.co";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const get = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw Error(`${r.status}: ${url}`);
  return r;
};
const write = (path, value) =>
  fs.writeFile(
    new URL(path, root),
    typeof value === "string" || Buffer.isBuffer(value)
      ? value
      : JSON.stringify(value, null, 2),
  );
await fs.mkdir(new URL("research/", root), { recursive: true });
await fs.mkdir(new URL("public/data/images/", root), { recursive: true });
await fs.mkdir(new URL("public/licenses/", root), { recursive: true });
const info = await (
  await get("https://huggingface.co/api/datasets/" + dataset)
).json();
const size = await (
  await get(api + "/size?" + new URLSearchParams({ dataset }))
).json();
const splits = await (
  await get(api + "/splits?" + new URLSearchParams({ dataset }))
).json();
if (!splits.splits.some((s) => s.config === "pages" && s.split === "corpus"))
  throw Error("Expected pages/corpus split is unavailable.");
const raw = await (
  await get(`${source}/resolve/${info.sha}/metadata/episodes.jsonl`)
).text();
let offset = 0;
const catalog = raw
  .trim()
  .split("\n")
  .map((line) => {
    const e = JSON.parse(line);
    const record = {
      id: e.document_id,
      year: e.year,
      term: e.semester,
      title: e.program_title_ko,
      en: e.program_title_en,
      slug: e.program_slug,
      issue: e.episode_label_ko,
      pages: e.page_count,
      start: offset,
    };
    offset += e.page_count;
    return record;
  });
if (offset !== size.size.dataset.num_rows)
  throw Error("Catalog and Viewer row totals differ.");
const choices = [
  [1988, "VOKU 기자석"],
  [1994, "광교음악산책"],
  [1998, "시가 있는 오후"],
  [2004, "음악으로 여는 아침"],
  [2011, "모닝커피"],
  [2017, "여행에 미치다"],
  [2019, "아침식당"],
];
const featured = choices.map(([year, title]) =>
  catalog.find((r) => r.year === year && r.title === title && r.pages > 2),
);
if (featured.some((r) => !r))
  throw Error("Expected featured documents unavailable.");
let cachedPages = 0;
for (const record of featured) {
  const pages = [];
  for (let i = 0; i < record.pages; i += 100) {
    const params = new URLSearchParams({
      dataset,
      config: "pages",
      split: "corpus",
      offset: String(record.start + i),
      length: String(Math.min(100, record.pages - i)),
    });
    const payload = await (await get(api + "/rows?" + params)).json();
    for (const { row } of payload.rows || []) {
      if (row.document_id !== record.id)
        throw Error(`Viewer order mismatch: ${record.id}`);
      const bytes = Buffer.from(await (await get(row.image.src)).arrayBuffer());
      const image = `/data/images/${row.page_id}.jpg`;
      await write("public" + image, bytes);
      pages.push({
        id: row.page_id,
        page: row.page,
        image,
        width: row.width,
        height: row.height,
        sourceHash: row.image_sha256,
        previewHash: hash(bytes),
      });
    }
  }
  pages.sort((a, b) => a.page - b.page);
  if (pages.length !== record.pages || pages.some((p, i) => p.page !== i + 1))
    throw Error(`Incomplete document: ${record.id}`);
  await write(`public/data/${record.id}.json`, { id: record.id, pages });
  cachedPages += pages.length;
  console.log(`${record.year} ${record.title}: ${pages.length} pages`);
}
const catalogRaw = JSON.stringify(catalog);
await write("public/data/catalog.json", catalogRaw);
await write("public/data/manifest.json", {
  dataset,
  source,
  revision: info.sha,
  verifiedAt: new Date().toISOString(),
  catalogHash: hash(raw),
  catalogFileHash: hash(catalogRaw),
  documents: catalog.length,
  pages: offset,
  years: [...new Set(catalog.map((r) => r.year))],
  featured: featured.map((r) => r.id),
  cachedPages,
  completePreloadedDocuments: featured.length,
  license: "CC BY 4.0 (scope: RIGHTS_AND_CREDITS.md)",
  imageNote: "Unmodified Hugging Face Dataset Viewer JPEG previews.",
  ocrIncluded: false,
});
await write(
  "public/licenses/VOKU-Archive-rights.md",
  await (
    await get(`${source}/resolve/${info.sha}/RIGHTS_AND_CREDITS.md`)
  ).text(),
);
await write("research/hf-info.json", info);
await write("research/splits.json", splits);
await write("research/size.json", size);
console.log(
  `Synced ${catalog.length} documents / ${offset} pages. No OCR fields retained.`,
);
