import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const entries = new Set(), css = new Set();
function include(key) {
  if (entries.has(key)) return;
  const chunk = manifest[key];
  assert.ok(chunk, `Missing build entry ${key}`);
  entries.add(key);
  for (const file of chunk.css || []) css.add(file);
  for (const child of chunk.imports || []) include(child);
}
include('index.html');
const measure = async files => {
  const blobs = await Promise.all(files.map(f => readFile('dist/' + f)));
  return { bytes: blobs.reduce((n,b) => n+b.length,0), gzipBytes: blobs.reduce((n,b) => n+gzipSync(b).length,0) };
};
const js = await measure([...entries].map(key => manifest[key].file));
const styles = await measure([...css]);
const fonts = JSON.parse(await readFile('public/fonts/subsets/manifest.json', 'utf8'));
const core = fonts.subsets.find(font => font.file.startsWith('voku-sans-core.'));
const fontBytes = (await stat('dist/fonts/subsets/' + core.file)).size;
assert.ok(js.bytes < 825_000, 'Initial JavaScript budget exceeded');
assert.ok(styles.bytes < 250_000 && styles.gzipBytes < 40_000, 'Stylesheet budget exceeded');
assert.ok(fontBytes < 130_000, 'Core font budget exceeded');
for (const route of ['Auth', 'Composer', 'Account', 'Admin']) {
  const key = `src/community/${route}.tsx`;
  assert.ok(manifest[key]?.isDynamicEntry && !entries.has(key), `${route} must stay outside the initial bundle`);
}
assert.ok(!entries.has('src/ringScene.ts'), '3D must remain optional');
// Home should not pull the community form controls and whole board stylesheet.
include('src/home/Home.tsx');
const homeJavaScript = await measure([...entries].map(key => manifest[key].file));
const homeStyles = await measure([...css]);
// Remote banners add a small public reader; upload/editor code stays in Admin.
assert.ok(homeJavaScript.bytes < 855_000, 'Home JavaScript budget exceeded');
assert.ok(homeStyles.bytes < 256_000, 'Home stylesheet budget exceeded');
console.log(JSON.stringify({status:'pass', initialJavaScript:js, styles, homeJavaScript, homeStyles, coreFontBytes:fontBytes, preservedFontCharacters:fonts.sourceCharacters, deferredScreens:6}, null, 2));
