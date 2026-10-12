import test from 'node:test';
import assert from 'node:assert/strict';
import { pageNumber, readingPosition, readReadingPosition, saveReadingPosition } from '../src/readerPosition.ts';
const position = {page: 6, offset: .27, angle: 90, view: {scale: 2, x: -.4, y: -.8}};
test('page entry accepts whole pages only, including first and last', () => {
  assert.equal(pageNumber('1', 15), 1);
  assert.equal(pageNumber('15', 15), 15);
  for (const value of ['', ' ', null, undefined, true, {}, 0, -2, '1.5', 'NaN', Infinity, '16']) assert.equal(pageNumber(value, 15), null);
});
test('reading position retains relative offset, rotation, and zoom', () => {
  assert.deepEqual(readingPosition(position, 10), position);
  assert.deepEqual(readingPosition({...position, offset: 9, view: {scale: 9, x: -99, y: 1}}, 10), {...position, offset: 1, view: {scale: 4, x: -3, y: 0}});
});
test('obsolete or corrupt reading positions are ignored', () => {
  for (const value of [null, 3, {}, {...position, page: 11}, {...position, angle: 45}, {...position, offset: NaN}, {...position, view: {scale: Infinity, x: 0, y: 0}}]) assert.equal(readingPosition(value, 10), null);
});
test('reading position storage is bounded, updated in recency order, and fail-safe', () => {
  const data = new Map();
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  try {
    for (let i = 0; i < 101; i++) saveReadingPosition(`voku_${i}`, position);
    assert.equal(readReadingPosition('voku_0', 10), null);
    assert.deepEqual(readReadingPosition('voku_100', 10), position);
    saveReadingPosition('voku_1', {...position, page: 2});
    saveReadingPosition('voku_101', position);
    assert.equal(readReadingPosition('voku_2', 10), null);
    assert.equal(readReadingPosition('voku_1', 10).page, 2);
    assert.equal(Object.keys(JSON.parse([...data.values()][0])).length, 100);
    localStorage.getItem = () => '{broken';
    assert.equal(readReadingPosition('voku_1', 10), null);
    assert.doesNotThrow(() => saveReadingPosition('voku_1', position));
    localStorage.getItem = () => '{}';
    localStorage.setItem = () => { throw Error('Storage blocked'); };
    assert.doesNotThrow(() => saveReadingPosition('voku_1', position));
  } finally { delete globalThis.localStorage; }
});
