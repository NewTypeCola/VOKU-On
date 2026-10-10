import test from 'node:test';
import assert from 'node:assert/strict';
import { clampView, fittedView, pinchView, panView, pageLayout, episodeLink } from '../src/readerGeometry.ts';

const bounds = { width: 360, height: 540 };
test('pinch stays centered on the touched document point', () => {
  const point = { x: 180, y: 240 };
  const view = pinchView(fittedView(), point, point, 2, bounds);
  assert.deepEqual(view, { scale: 2, x: -180, y: -240 });
  assert.equal((point.x - view.x) / view.scale, 180);
  assert.equal((point.y - view.y) / view.scale, 240);
});
test('a moving midpoint pans while zooming', () => {
  assert.deepEqual(pinchView(fittedView(), { x: 180, y: 200 }, { x: 200, y: 240 }, 2, bounds), { scale: 2, x: -160, y: -160 });
});
test('pinch limit preserves anchor and shrinking restores fit', () => {
  const start = { scale: 2, x: -180, y: -270 };
  assert.deepEqual(pinchView(start, { x: 180, y: 270 }, { x: 180, y: 270 }, 100, bounds), { scale: 4, x: -540, y: -810 });
  assert.deepEqual(pinchView(start, { x: 180, y: 270 }, { x: 180, y: 270 }, .5, bounds), fittedView());
});
test('zoom never exposes empty space beyond image edges', () => {
  assert.deepEqual(clampView({ scale: 3, x: -9999, y: 9999 }, bounds), { scale: 3, x: -720, y: 0 });
});
test('panning scrolls the document only after reaching a sheet edge', () => {
  assert.deepEqual(panView({ scale: 2, x: -100, y: -200 }, { x: 0, y: -40 }, bounds), { view: { scale: 2, x: -100, y: -240 }, overflowY: 0 });
  assert.equal(panView({ scale: 2, x: 0, y: -540 }, { x: 0, y: -40 }, bounds).overflowY, -40);
  assert.equal(panView({ scale: 2, x: 0, y: 0 }, { x: 0, y: 40 }, bounds).overflowY, 40);
});
test('rotation exchanges dimensions and four turns restore the original fit', () => {
  assert.deepEqual(pageLayout(1200, 1800, 0), { aspectRatio: 2/3, imageWidthPercent: 100 });
  assert.deepEqual(pageLayout(1200, 1800, 90), { aspectRatio: 1.5, imageWidthPercent: 2/3*100 });
  assert.deepEqual(pageLayout(1200, 1800, 90), pageLayout(1200, 1800, 270));
  assert.deepEqual(pageLayout(1200, 1800, 360), pageLayout(1200, 1800, 0));
});
test('transforms do not mutate another page or the initial state', () => {
  const first = Object.freeze(fittedView());
  const second = fittedView();
  pinchView(first, { x: 50, y: 60 }, { x: 50, y: 60 }, 3, bounds);
  assert.deepEqual(first, fittedView());
  assert.deepEqual(second, fittedView());
  assert.notEqual(first, second);
});
test('shared episode link preserves the accessible host and drops post context', () => {
  assert.equal(episodeLink('http://192.168.50.42:5214/?debug=1#/read/old?from=post123', 'voku_2017_1_news_01'), 'http://192.168.50.42:5214/#/read/voku_2017_1_news_01');
  assert.equal(episodeLink('https://example.com/voku/#/home', 'episode'), 'https://example.com/voku/#/read/episode');
});
