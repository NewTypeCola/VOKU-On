import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadCache } from '../src/readCache.ts';
import { createArchiveResource } from '../src/archiveCatalog.ts';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('simultaneous identical reads share a request and become fresh again after expiry', async () => {
  let time = 0, calls = 0;
  const cache = createReadCache(50, 20, () => time), pending = deferred();
  const load = () => { calls++; return pending.promise; };
  const a = cache.read('feed', load), b = cache.read('feed', load);
  assert.equal(a, b);
  pending.resolve('first');
  assert.equal(await a, 'first');
  assert.equal(await cache.read('feed', load), 'first');
  assert.equal(calls, 1);
  time = 51;
  assert.equal(await cache.read('feed', async () => { calls++; return 'fresh'; }), 'fresh');
  assert.equal(calls, 2);
});

test('identity changes or writes prevent an old in-flight read from replacing new data', async () => {
  const cache = createReadCache(5000), old = deferred();
  const previous = cache.read('feed', () => old.promise);
  cache.clear();
  assert.equal(await cache.read('feed', async () => 'new account'), 'new account');
  old.resolve('old account');
  await previous;
  assert.equal(await cache.read('feed', async () => 'should not run'), 'new account');
});

test('failed reads can be retried and account reads do not retain settled data', async () => {
  const cache = createReadCache(5000);
  await assert.rejects(cache.read('feed', async () => { throw Error('offline'); }), /offline/);
  assert.equal(await cache.read('feed', async () => 'recovered'), 'recovered');
  const account = createReadCache();
  await account.read('member', async () => 'before');
  assert.equal(await account.read('member', async () => 'after'), 'after');
});

test('different searches stay isolated and the cache stays bounded', async () => {
  const cache = createReadCache(5000, 2);
  await cache.read('first', async () => 1);
  await cache.read('second', async () => 2);
  await cache.read('third', async () => 3);
  assert.equal(await cache.read('first', async () => 4), 4);
  assert.equal(await cache.read('third', async () => 9), 3);
});

test('independent screens do not start archive downloads and route remounts reuse one request', async () => {
  const pending = deferred(), urls = [];
  const archive = createArchiveResource(async url => { urls.push(url); await pending.promise; return Response.json(url.includes('catalog') ? [{ id: 'record' }] : { revision: 'v1' }); });
  let updates = 0;
  const unsubscribe = archive.subscribe(() => updates++);
  assert.equal(archive.getSnapshot().manifest, null);
  assert.deepEqual(urls, []);
  const a = archive.load(), b = archive.load();
  assert.equal(a, b);
  assert.equal(urls.length, 2);
  pending.resolve(); await a;
  assert.equal(archive.getSnapshot().catalog[0].id, 'record');
  assert.equal(archive.getSnapshot().manifest.revision, 'v1');
  assert.equal(updates, 1);
  await archive.load();
  assert.equal(urls.length, 2);
  unsubscribe();
});

test('a failed archive request does not poison retry or publish half of the catalog', async () => {
  let offline = true;
  const archive = createArchiveResource(async url => offline && url.includes('manifest') ? new Response('', {status: 503}) : Response.json(url.includes('catalog') ? [{id:'record'}] : {revision:'v1'}));
  await archive.load();
  assert.equal(archive.getSnapshot().manifest, null);
  assert.deepEqual(archive.getSnapshot().catalog, []);
  assert.ok(archive.getSnapshot().error);
  offline = false;
  await archive.load();
  assert.equal(archive.getSnapshot().error, '');
  assert.equal(archive.getSnapshot().catalog.length, 1);
});
