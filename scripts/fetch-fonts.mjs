// One-time dev script: self-host Google Fonts so the app has zero external dependencies.
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const cssUrl = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Instrument+Sans:wght@400;500;600&display=swap';
const css = await (await fetch(cssUrl, { headers: { 'User-Agent': UA } })).text();
const dir = '/home/user/together-apart/public/fonts';
let out = '';
let i = 0;
for (const block of css.split('@font-face').slice(1)) {
  const fam = /font-family: '([^']+)'/.exec(block)[1].replace(/\s+/g, '');
  const style = /font-style: (\w+)/.exec(block)[1];
  const weight = /font-weight: (\d+)/.exec(block)[1];
  const url = /url\((https:[^)]+\.woff2)\)/.exec(block)[1];
  const range = /unicode-range: ([^;]+);/.exec(block)[1];
  const fname = `${fam}-${style}-${weight}-${i++}.woff2`;
  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  fs.writeFileSync(`${dir}/${fname}`, buf);
  out += `@font-face{font-family:'${fam.split('-')[0] === 'Instrument' ? 'Instrument Sans' : fam}';font-style:${style};font-weight:${weight};font-display:swap;src:url('/fonts/${fname}') format('woff2');unicode-range:${range};}\n`;
  console.log(fname, (buf.length/1024).toFixed(0)+'KB');
}
fs.writeFileSync('/home/user/together-apart/public/css/fonts.css', out);
console.log('fonts.css written,', i, 'faces');
