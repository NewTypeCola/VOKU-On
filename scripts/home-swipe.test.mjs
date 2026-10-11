import test from 'node:test';
import assert from 'node:assert/strict';
import { createHomeTabSwipe } from '../src/home/tabSwipe.ts';

const p = (x, y, time = 0) => ({ x, y, time });

test('home swipe follows the visible tab order and fires once per gesture', () => {
  const swipe = createHomeTabSwipe();
  swipe.begin(p(190, 500), 390);
  assert.equal(swipe.move(p(225, 503, 100)), true);
  assert.equal(swipe.end(p(300, 509, 300)), '/archive');
  assert.equal(swipe.end(p(305, 509, 320)), null);
  swipe.begin(p(240, 500), 390);
  assert.equal(swipe.end(p(90, 490, 300)), '/board');
});

test('taps, short drags and long presses never switch tabs', () => {
  const swipe = createHomeTabSwipe();
  for (const end of [p(198, 501, 100), p(245, 503, 400), p(300, 500, 1300)]) {
    swipe.begin(p(190, 500), 390);
    assert.equal(swipe.end(end), null);
  }
});

test('vertical or diagonal scrolling stays cancelled even if the finger later moves sideways', () => {
  const swipe = createHomeTabSwipe();
  for (const firstMove of [p(195, 530, 50), p(210, 520, 50)]) {
    swipe.begin(p(190, 500), 390);
    assert.equal(swipe.move(firstMove), false);
    assert.equal(swipe.end(p(320, 525, 300)), null);
  }
  swipe.begin(p(190, 500), 390);
  assert.equal(swipe.move(p(215, 502, 50)), true);
  assert.equal(swipe.end(p(290, 600, 400)), null);
});

test('browser edge gestures are ignored at narrow and wide mobile widths', () => {
  const swipe = createHomeTabSwipe();
  for (const width of [320, 390, 430]) {
    for (const x of [0, 24, width - 24, width]) {
      swipe.begin(p(x, 500), width);
      assert.equal(swipe.end(p(width / 2, 500, 300)), null);
    }
  }
});

test('interruption cancels navigation and the next gesture starts cleanly', () => {
  const swipe = createHomeTabSwipe();
  swipe.begin(p(190, 500), 390);
  swipe.move(p(270, 500, 100));
  swipe.cancel();
  assert.equal(swipe.end(p(320, 500, 300)), null);
  swipe.begin(p(240, 500, 1000), 390);
  assert.equal(swipe.end(p(100, 500, 1300)), '/board');
});

test('dragging back to the starting point does not commit a previously crossed threshold', () => {
  const swipe = createHomeTabSwipe();
  swipe.begin(p(190, 500), 390);
  swipe.move(p(300, 503, 100));
  assert.equal(swipe.end(p(205, 505, 300)), null);
});
