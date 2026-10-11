import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
assert.equal(manifest['src/home/Home.tsx']?.isDynamicEntry, true, 'Home must load as a separate screen');
const scripts = Object.values(manifest).map(entry => entry.file).filter(file => file.endsWith('.js'));
const compiled = (await Promise.all(scripts.map(file => readFile('dist/' + file, 'utf8')))).join('\n');
for (const fixture of ['local-home-tapes', 'local-home-microphone', 'local-home-campus']) {
  assert.ok(!compiled.includes(fixture), `Local photo fixture leaked into the production code: ${fixture}`);
}
console.log(JSON.stringify({ status: 'pass', deferredHome: true, localPhotoFixturesInProduction: 0 }));
