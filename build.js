/* AgriKalkunahon build.
   Inlines engine/core.js and src/app.js into src/index.template.html and writes
   index.html (the served app) and AgriKalkunahon.html (the download copy) in this folder.
   Also rewrites the VERSION line in sw.js from a hash of the sources. manifest.webmanifest and the icons are not touched.
   Usage: node build.js */
const fs = require('fs'), path = require('path');
const here = __dirname, read = p => fs.readFileSync(path.join(here, p), 'utf8');
const tpl = read('src/index.template.html'), engine = read('engine/core.js'), app = read('src/app.js');
for (const mark of ['/*__ENGINE__*/', '/*__APP__*/'])
  if (!tpl.includes(mark)) { console.error('src/index.template.html is missing ' + mark); process.exit(1); }
// Build stamp: first 8 hex digits of a SHA-1 over the sources (sw.js without its VERSION line).
// It changes whenever any source changes, and nothing else.
const swPath = path.join(here, 'sw.js'), sw = fs.readFileSync(swPath, 'utf8'), versionLine = /const VERSION = '[^']*';/;
if (!versionLine.test(sw)) { console.error('sw.js: VERSION line not found'); process.exit(1); }
const stamp = require('crypto').createHash('sha1').update(tpl + engine + app + sw.replace(versionLine, '')).digest('hex').slice(0, 8);
const html = tpl.replace('/*__ENGINE__*/', () => engine).replace('/*__APP__*/', () => app.split('__BUILD__').join(stamp));
for (const out of ['index.html', 'AgriKalkunahon.html']) fs.writeFileSync(path.join(here, out), html);
// Give the service worker a new cache name for this build, so installed copies discard the old one.
fs.writeFileSync(swPath, sw.replace(versionLine, "const VERSION = 'agrikalkunahon-" + stamp + "';"));
console.log('built index.html and AgriKalkunahon.html, ' + html.length + ' bytes, build ' + stamp + '; sw.js VERSION set to agrikalkunahon-' + stamp);
