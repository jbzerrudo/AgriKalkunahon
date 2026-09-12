/* AgriKalkunahon build.
   Inlines engine/core.js and src/app.js into src/index.template.html and writes
   index.html (the served app) and AgriKalkunahon.html (the download copy) in this folder.
   manifest.webmanifest, sw.js and the icons are served as they are and are not touched.
   Usage: node build.js */
const fs = require('fs'), path = require('path');
const here = __dirname, read = p => fs.readFileSync(path.join(here, p), 'utf8');
const tpl = read('src/index.template.html'), engine = read('engine/core.js'), app = read('src/app.js');
for (const mark of ['/*__ENGINE__*/', '/*__APP__*/'])
  if (!tpl.includes(mark)) { console.error('src/index.template.html is missing ' + mark); process.exit(1); }
const html = tpl.replace('/*__ENGINE__*/', () => engine).replace('/*__APP__*/', () => app);
for (const out of ['index.html', 'AgriKalkunahon.html']) fs.writeFileSync(path.join(here, out), html);
console.log('built index.html and AgriKalkunahon.html, ' + html.length + ' bytes, from engine/core.js + src/app.js');
