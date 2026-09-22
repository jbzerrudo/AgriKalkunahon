/* AgriKalkunahon build.
   Inlines engine/climatetype.js, engine/core.js and src/app.js into src/index.template.html and writes
   index.html (the served app) and AgriKalkunahon.html (the download copy) in this folder.
   Also rewrites the VERSION line in sw.js from a hash of the sources. manifest.webmanifest and the icons are not touched.
   Usage: node build.js */
const fs = require('fs'), path = require('path');
const here = __dirname, read = p => fs.readFileSync(path.join(here, p), 'utf8');
/* The climate type grid is data, kept in its own file so the engine stays readable; it goes in ahead of
   the engine, which picks it up from AGRI_CTYPE. */
const tpl = read('src/index.template.html'), engine = read('engine/climatetype.js') + '\n' + read('engine/core.js'), app = read('src/app.js');
/* The release version comes from CITATION.cff, so bumping a release cannot leave the About card behind.
   Two releases shipped with a stale version line before this was automated. */
const cff = read('CITATION.cff'), vm = cff.match(/^version:\s*(.+)$/m);
if (!vm) { console.error('CITATION.cff: version line not found'); process.exit(1); }
const version = vm[1].trim();
/* The assertion count comes from actually running the suite, so the About card cannot claim a number
   the engine no longer meets. It also means a build cannot be produced while a test is failing. */
const testOut = require('child_process').execFileSync(process.execPath, [path.join(here, 'engine', 'test.js')], { encoding: 'utf8' });
const tm = testOut.match(/(\d+) passed, (\d+) failed/);
if (!tm) { console.error('build: could not read the assertion count from engine/test.js'); process.exit(1); }
if (tm[2] !== '0') { console.error('build: ' + tm[2] + ' assertion(s) failing; not building'); process.exit(1); }
const assertions = tm[1];

for (const mark of ['/*__ENGINE__*/', '/*__APP__*/'])
  if (!tpl.includes(mark)) { console.error('src/index.template.html is missing ' + mark); process.exit(1); }
// Build stamp: first 8 hex digits of a SHA-1 over the release version and the sources (sw.js without
// its VERSION line). It changes whenever any of those change, and nothing else.
const swPath = path.join(here, 'sw.js'), sw = fs.readFileSync(swPath, 'utf8'), versionLine = /const VERSION = '[^']*';/;
if (!versionLine.test(sw)) { console.error('sw.js: VERSION line not found'); process.exit(1); }
/* The release version is part of the stamp, so two releases can never share a build string even when
   no source file changed between them. */
const stamp = require('crypto').createHash('sha1').update(version + '\n' + tpl + engine + app + sw.replace(versionLine, '')).digest('hex').slice(0, 8);
const html = tpl.replace('/*__ENGINE__*/', () => engine).replace('/*__APP__*/', () => app.split('__BUILD__').join(stamp).split('__VERSION__').join(version).split('__ASSERTIONS__').join(assertions));
for (const out of ['index.html', 'AgriKalkunahon.html']) fs.writeFileSync(path.join(here, out), html);
// Give the service worker a new cache name for this build, so installed copies discard the old one.
fs.writeFileSync(swPath, sw.replace(versionLine, "const VERSION = 'agrikalkunahon-" + stamp + "';"));
if (html.includes('__VERSION__')) { console.error('build: __VERSION__ was not substituted'); process.exit(1); }
if (html.includes('__ASSERTIONS__')) { console.error('build: __ASSERTIONS__ was not substituted'); process.exit(1); }
console.log('built index.html and AgriKalkunahon.html, v' + version + ', ' + html.length + ' bytes, build ' + stamp + ', ' + assertions + ' assertions; sw.js VERSION set to agrikalkunahon-' + stamp);
