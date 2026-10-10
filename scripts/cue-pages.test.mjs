import test from 'node:test';
import assert from 'node:assert/strict';
import { getPages } from '../src/cuePages.ts';

const manifest = { dataset: 'public/archive', revision: 'a', featured: [] };
const record = (name, pages = 4) => ({ id: `voku_${name}`, pages, start: 120 });
const row = (r, page) => ({ row: {
  document_id: r.id, page_id: `${r.id}_page${page}`, page,
  image: { src: `https://images.example/${r.id}/${page}.jpg` },
  width: 1200, height: 1800, ocr_text: 'must never be retained',
} });
const response = (rows) => new Response(JSON.stringify({ rows }));
const controller = () => new AbortController();
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
function mockViewer(t, r, customize) {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const params = new URL(url).searchParams;
    const start = Number(params.get('offset')) - r.start + 1;
    const length = Number(params.get('length'));
    requests.push({ start, length });
    if (customize) {
      const result = await customize(start, length, options);
      if (result) return result;
    }
    return response(Array.from({ length }, (_, i) => row(r, start + i)));
  });
  return requests;
}

test('the verified first page is usable while later metadata is still pending', async (t) => {
  const r = record('progressive');
  const first = deferred(), rest = deferred();
  const snapshots = [];
  mockViewer(t, r, async (start) => { if (start > 1) await rest.promise; });
  const pending = getPages(r, manifest, controller().signal, false, pages => {
    snapshots.push(pages);
    if (pages.length === 1) first.resolve();
  });
  await first.promise;
  assert.deepEqual(snapshots.map(p => p.length), [1]);
  assert.equal(snapshots[0][0].page, 1);
  assert.equal('ocr_text' in snapshots[0][0], false);
  rest.resolve();
  const pages = await pending;
  assert.deepEqual(pages.map(p => p.page), [1, 2, 3, 4]);
  assert.equal(snapshots[0].length, 1, 'later batches cannot mutate an earlier published snapshot');
});

test('a later failure leaves the published first page usable and does not cache a partial document', async (t) => {
  const r = record('partial_failure');
  let fail = true;
  const snapshots = [];
  const requests = mockViewer(t, r, start => start > 1 && fail ? new Response('', { status: 503 }) : undefined);
  await assert.rejects(getPages(r, manifest, controller().signal, false, p => snapshots.push(p)), /지연/);
  assert.deepEqual(snapshots.map(p => p.length), [1]);
  fail = false;
  assert.equal((await getPages(r, manifest, controller().signal)).length, 4);
  assert.equal(requests.filter(r => r.start === 1).length, 2);
});

test('another document or a missing page cannot enter the reader', async (t) => {
  const r = record('mismatch');
  const published = [];
  mockViewer(t, r, start => start > 1 ? response([row(record('other'), 2), row(r, 3), row(r, 4)]) : undefined);
  await assert.rejects(getPages(r, manifest, controller().signal, false, p => published.push(p)), /목록이 변경/);
  assert.equal(published.length, 1);
  t.mock.restoreAll();
  mockViewer(t, r, start => start > 1 ? response([row(r, 2), row(r, 4), row(r, 5)]) : undefined);
  await assert.rejects(getPages(r, manifest, controller().signal), /페이지 순서/);
});

test('large documents publish all pages exactly once in source order', async (t) => {
  const r = record('long', 130);
  const lengths = [];
  const requests = mockViewer(t, r);
  const pages = await getPages(r, manifest, controller().signal, false, p => lengths.push(p.length));
  assert.equal(lengths[0], 1);
  assert.equal(lengths.at(-1), 130);
  assert.deepEqual(pages.map(p => p.page), Array.from({ length: 130 }, (_, i) => i + 1));
  assert.ok(requests.every(r => r.length <= 100), 'respect the Viewer API limit');
});

test('leaving a reader prevents an in-flight batch from publishing or being cached', async (t) => {
  const r = record('cancelled');
  const abort = controller(), first = deferred(), rest = deferred();
  const published = [];
  let block = true;
  const requests = mockViewer(t, r, async start => { if (start > 1 && block) await rest.promise; });
  const pending = getPages(r, manifest, abort.signal, false, p => { published.push(p); first.resolve(); });
  await first.promise;
  abort.abort();
  rest.resolve();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(published.length, 1);
  block = false;
  await getPages(r, manifest, controller().signal);
  assert.equal(requests.filter(r => r.start === 1).length, 2);
});

test('cached signed links are reused briefly, but refreshed after expiry or revision changes', async (t) => {
  const r = record('expiry', 1);
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const requests = mockViewer(t, r);
  await getPages(r, manifest, controller().signal);
  const snapshots = [];
  await getPages(r, manifest, controller().signal, false, p => snapshots.push(p));
  assert.equal(requests.length, 1);
  assert.equal(snapshots.length, 1);
  now += 6 * 60 * 1000;
  await getPages(r, manifest, controller().signal);
  await getPages(r, { ...manifest, revision: 'b' }, controller().signal);
  assert.equal(requests.length, 3);
});

test('preloaded documents remain local and are validated before being shown', async (t) => {
  const r = record('local', 2);
  const local = { ...manifest, featured: [r.id] };
  let reversed = false;
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, `/data/${r.id}.json`);
    const pages = [1, 2].map(n => ({ id: `${r.id}_page${n}`, page: n, image: `/data/images/${n}.jpg`, width: 100, height: 150 }));
    return new Response(JSON.stringify({ id: r.id, pages: reversed ? pages.reverse() : pages }));
  });
  assert.equal((await getPages(r, local, controller().signal)).length, 2);
  reversed = true;
  let published = false;
  await assert.rejects(getPages(r, local, controller().signal, true, () => { published = true; }), /페이지 순서/);
  assert.equal(published, false);
});
