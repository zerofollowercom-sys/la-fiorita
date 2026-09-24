// Genera dist/index.html (pagina completa, CSS/JS/icona inline) e dist/artifact.html
// (stesso contenuto senza doctype/html/head/body: claude.ai aggiunge lo scheletro da sé)
const fs = require('fs'), path = require('path');
const root = __dirname;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let html = read('index.html');
const svg = 'data:image/svg+xml;utf8,' + encodeURIComponent(read('icon.svg'));
html = html.replace(/href="icon\.svg"/g, `href="${svg}"`);
html = html.replace('<link rel="stylesheet" href="style.css">', `<style>\n${read('style.css')}\n</style>`);
html = html.replace(/<script src="([^"]+\.js)"><\/script>/g, (_, f) => `<script>\n${read(f)}\n</script>`);
if (fs.existsSync(path.join(root, 'logo.png'))) { // logo inline (data URI): DOPO gli script, perché il tag <img> sta dentro app.js
  html = html.replace(/src="logo\.png"/g, `src="data:image/png;base64,${fs.readFileSync(path.join(root, 'logo.png')).toString('base64')}"`);
}
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
fs.copyFileSync(path.join(root, 'icon.png'), path.join(root, 'dist/icon.png')); // iOS non accetta SVG né data: URI per l'icona Home
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');

const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'))
  .replace(/<meta charset="utf-8">\n/, '').replace(/<meta name="viewport"[^>]*>\n/, '');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const artifact = head + '<style>#app{padding-top:12px}</style>\n' + body; // lo scheletro di claude.ai gestisce già la safe area in alto
fs.writeFileSync(path.join(root, 'dist/artifact.html'), artifact);
console.log('dist/artifact.html', (artifact.length / 1024).toFixed(0) + ' KB');
