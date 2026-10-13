import { access, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
assert.equal(manifest['src/home/Home.tsx']?.isDynamicEntry, true, 'Home must load as a separate screen');
const scripts = Object.values(manifest).map(entry => entry.file).filter(file => file.endsWith('.js'));
const compiled = (await Promise.all(scripts.map(file => readFile('dist/' + file, 'utf8')))).join('\n');
for (const fixture of ['local-home-tapes', 'local-home-microphone', 'local-home-campus']) {
  assert.ok(!compiled.includes(fixture), `Local photo fixture leaked into the production code: ${fixture}`);
}
for (const asset of ['broadcast-stories-banner.png', 'broadcast-stories-banner.jpg', 'archive-banner.jpg', 'memories-banner.jpg', 'alumni-banner.jpg', 'examples/tapes.jpg', 'examples/microphone.jpg', 'examples/campus.jpg']) {
  for (const directory of ['dist/home', 'dist/assets/home']) {
    await assert.rejects(access(`${directory}/${asset}`), { code: 'ENOENT' }, `Example image copied into production: ${asset}`);
  }
}
console.log(JSON.stringify({ status: 'pass', deferredHome: true, localPhotoFixturesInProduction: 0, exampleImagesInProduction: 0 }));
