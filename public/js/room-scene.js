// The living room — a hand-drawn SVG scene. Every object is clickable and meaningful.
import { avatarSvg } from './ui.js';

export const SPOTS = {
  sofaL: { x: 706, y: 458, label: 'the sofa', hint: [706, 452] },
  sofaR: { x: 846, y: 458, label: 'the sofa', hint: [846, 452] },
  window: { x: 248, y: 430, label: 'the window seat', hint: [248, 424] },
  floor: { x: 540, y: 576, label: 'the floor cushion', hint: [540, 570] },
  bench: { x: 372, y: 462, label: 'the bench by the record player', hint: [372, 456] },
};

const BOOK_COLORS = ['#9C6459', '#B98A44', '#7D8471', '#5D5347', '#B4766B', '#8A6844', '#6E7686'];
function books(x, y, n, seed = 1) {
  let out = '', cx = x;
  for (let i = 0; i < n; i++) {
    const w = 11 + ((i * seed * 7) % 8), hgt = 38 + ((i * seed * 13) % 12);
    const c = BOOK_COLORS[(i * seed + 3) % BOOK_COLORS.length];
    const lean = (i === n - 1 && n > 3) ? ` transform="rotate(8 ${cx + w / 2} ${y})"` : '';
    out += `<rect x="${cx}" y="${y - hgt}" width="${w}" height="${hgt}" rx="2" fill="${c}"${lean}/>`;
    cx += w + 3;
  }
  return out;
}

function steam(x, y) {
  return `<g class="rm-steam" transform="translate(${x},${y})" aria-hidden="true">
    <path d="M0,0 q4,-7 0,-13 q-4,-6 0,-12" fill="none" stroke="#F6F0E4" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>
    <path d="M10,2 q4,-7 0,-13 q-4,-6 0,-12" fill="none" stroke="#F6F0E4" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>
    <path d="M-9,3 q4,-7 0,-13 q-4,-6 0,-12" fill="none" stroke="#F6F0E4" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>
  </g>`;
}

export function sceneTemplate() {
  return `
<svg class="room-svg" viewBox="0 0 1200 675" role="img" aria-label="Your shared living room" id="room-svg" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="winclip"><rect x="12" y="12" width="286" height="248" rx="4"/></clipPath>
    <radialGradient id="lampgrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F2D9A0" stop-opacity="0.5"/><stop offset="100%" stop-color="#F2D9A0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="candlegrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#E8B06A" stop-opacity="0.55"/><stop offset="100%" stop-color="#E8B06A" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- walls & floor -->
  <rect x="0" y="0" width="1200" height="470" fill="var(--rm-wall)"/>
  <rect x="0" y="0" width="1200" height="60" fill="var(--rm-wall-lo)" opacity="0.35"/>
  <rect x="0" y="458" width="1200" height="14" fill="var(--rm-wall-lo)"/>
  <rect x="0" y="470" width="1200" height="205" fill="var(--rm-floor)"/>
  <g stroke="var(--rm-floor-lo)" stroke-width="2" opacity="0.5">
    <line x1="0" y1="520" x2="1200" y2="520"/><line x1="0" y1="575" x2="1200" y2="575"/><line x1="0" y1="632" x2="1200" y2="632"/>
    <line x1="180" y1="470" x2="140" y2="675"/><line x1="420" y1="470" x2="410" y2="675"/><line x1="700" y1="470" x2="710" y2="675"/><line x1="980" y1="470" x2="1020" y2="675"/>
  </g>

  <!-- window -->
  <g class="rm-hit" id="hit-window" tabindex="0" role="button" aria-label="Window — change the weather outside">
    <g transform="translate(88,78)">
      <rect x="-10" y="-10" width="330" height="292" rx="10" fill="var(--rm-wood-d)"/>
      <rect x="12" y="12" width="286" height="248" rx="4" class="win-sky" fill="#BCD3E8"/>
      <g clip-path="url(#winclip)">
        <path class="win-scene-el el-hills" d="M-10,240 Q60,190 140,225 T310,215 L310,270 L-10,270 Z" fill="#5C6A4C" opacity="0.55"/>
        <path class="win-scene-el el-hills" d="M-10,255 Q100,225 200,248 T310,240 L310,270 L-10,270 Z" fill="#4E5B41" opacity="0.5"/>
        <circle class="win-scene-el el-sun" cx="92" cy="212" r="26" fill="#F2D9A0"/>
        <circle class="win-scene-el el-sun" cx="92" cy="212" r="34" fill="#F2D9A0" opacity="0.3"/>
        <g class="win-scene-el el-stars">
          <circle class="rm-star" cx="50" cy="50" r="2.2" fill="#EFE6D6"/><circle class="rm-star" cx="120" cy="36" r="1.6" fill="#EFE6D6"/>
          <circle class="rm-star" cx="180" cy="70" r="2" fill="#EFE6D6"/><circle class="rm-star" cx="240" cy="40" r="1.7" fill="#EFE6D6"/>
          <circle class="rm-star" cx="265" cy="110" r="2.2" fill="#EFE6D6"/><circle class="rm-star" cx="90" cy="110" r="1.5" fill="#EFE6D6"/>
          <circle class="rm-star" cx="150" cy="120" r="1.8" fill="#EFE6D6"/><circle class="rm-star" cx="210" cy="150" r="1.6" fill="#EFE6D6"/>
          <circle class="rm-star" cx="60" cy="160" r="1.9" fill="#EFE6D6"/><circle class="rm-star" cx="255" cy="175" r="1.6" fill="#EFE6D6"/>
          <circle class="win-scene-el el-moon" cx="232" cy="72" r="19" fill="#EFE6D6"/>
          <circle class="win-scene-el el-moon" cx="226" cy="66" r="4" fill="#D9CCB2"/><circle class="win-scene-el el-moon" cx="238" cy="78" r="2.6" fill="#D9CCB2"/>
        </g>
        <g class="win-scene-el el-rain" stroke="#AEBBCB" stroke-width="2" stroke-linecap="round" opacity="0.8">
          ${Array.from({ length: 16 }, (_, i) => `<line x1="${18 + i * 18}" y1="0" x2="${10 + i * 18}" y2="34" style="animation-delay:${-(i * 0.13).toFixed(2)}s"/>`).join('')}
        </g>
      </g>
      <rect x="150" y="12" width="10" height="248" fill="var(--rm-wood)"/>
      <rect x="12" y="130" width="286" height="10" fill="var(--rm-wood)"/>
      <rect x="0" y="260" width="310" height="14" rx="4" fill="var(--rm-wood)"/>
      <!-- curtains -->
      <path d="M-6,-6 q-20,90 8,150 q18,40 -2,90 l-30,0 l0,-240 z" fill="var(--rm-fabric)" opacity="0.95"/>
      <path d="M316,-6 q20,90 -8,150 q-18,40 2,90 l30,0 l0,-240 z" fill="var(--rm-fabric)" opacity="0.95"/>
    </g>
    <g class="rm-string" transform="translate(0,0)" aria-hidden="true">
      <path d="M70,64 Q300,120 600,74 Q900,128 1130,66" fill="none" stroke="#6E5033" stroke-width="2.4"/>
      ${Array.from({ length: 11 }, (_, i) => {
        const t = (i + 0.5) / 11;
        const x = 70 + 1060 * t;
        const y = 64 + 42 * Math.sin(Math.PI * t) + (t > 0.45 && t < 0.56 ? 8 : 0);
        return `<g><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 10}" stroke="#6E5033" stroke-width="2"/><circle class="bulb" cx="${x}" cy="${y + 15}" r="5" fill="${i % 2 ? '#E8B06A' : '#D9A95C'}"/><circle class="bulb" cx="${x}" cy="${y + 15}" r="9" fill="${i % 2 ? '#E8B06A' : '#D9A95C'}" opacity="0.25"/></g>`;
      }).join('')}
    </g>
  </g>

  <!-- bookshelf -->
  <g class="rm-hit" id="hit-shelf" tabindex="0" role="button" aria-label="Bookshelf — your memories and story" transform="translate(56,128)">
    <g class="rm-shape">
      <rect x="0" y="0" width="204" height="316" rx="8" fill="var(--rm-wood)"/>
      <rect x="10" y="10" width="184" height="296" rx="4" fill="var(--rm-wood-d)" opacity="0.4"/>
      <rect x="10" y="80" width="184" height="10" fill="var(--rm-wood)"/>
      <rect x="10" y="164" width="184" height="10" fill="var(--rm-wood)"/>
      <rect x="10" y="248" width="184" height="10" fill="var(--rm-wood)"/>
      ${books(18, 80, 6, 2)}${books(110, 80, 5, 3)}
      <g transform="translate(24,150)"><rect x="0" y="-26" width="34" height="26" rx="3" fill="none" stroke="#B98A44" stroke-width="3"/><path d="M8,-18 q8,-8 17,0" fill="none" stroke="#B4766B" stroke-width="2.4"/></g>
      ${books(78, 164, 7, 5)}${books(18, 248, 4, 7)}
      <g transform="translate(150,248)"><path d="M-2,0 l0,-16 M-2,-10 q-12,-4 -14,-16 q12,0 14,10 M-2,-12 q12,-6 13,-18 q-11,1 -13,12z" stroke="var(--rm-leaf)" stroke-width="4" fill="var(--rm-leaf)" stroke-linecap="round"/><rect x="-14" y="0" width="26" height="16" rx="4" fill="#B98A44"/></g>
      <g transform="translate(150,150)"><ellipse cx="0" cy="-12" rx="14" ry="9" fill="var(--rm-leaf)"/><path d="M0,-4 l0,10" stroke="var(--rm-leaf-d)" stroke-width="3"/></g>
    </g>
  </g>

  <!-- photo frames -->
  <g id="frames" transform="translate(620,120)">
    <g class="rm-hit" id="hit-frame1" tabindex="0" role="button" aria-label="Photo frame — your memories">
      <g class="rm-shape">
        <rect x="0" y="0" width="96" height="76" rx="3" fill="var(--rm-wood-d)"/>
        <rect x="7" y="7" width="82" height="62" fill="var(--rm-paper)"/>
        <image id="frame-img-1" x="9" y="9" width="78" height="58" preserveAspectRatio="xMidYMid slice" style="display:none"/>
        <g id="frame-art-1"><circle cx="34" cy="30" r="10" fill="none" stroke="#B4766B" stroke-width="2.4"/><path d="M22,52 q22,-16 44,0" fill="none" stroke="#7D8471" stroke-width="2.4"/></g>
      </g>
    </g>
    <g class="rm-hit" id="hit-frame2" tabindex="0" role="button" aria-label="Photo frame — your memories" transform="translate(120,-16)">
      <g class="rm-shape">
        <rect x="0" y="0" width="76" height="96" rx="3" fill="var(--rm-wood-d)"/>
        <rect x="7" y="7" width="62" height="82" fill="var(--rm-paper)"/>
        <image id="frame-img-2" x="9" y="9" width="58" height="78" preserveAspectRatio="xMidYMid slice" style="display:none"/>
        <g id="frame-art-2"><path d="M14,64 q10,-26 22,-34 q12,8 22,34" fill="none" stroke="#B98A44" stroke-width="2.4"/><circle cx="36" cy="24" r="6" fill="#B4766B" opacity="0.7"/></g>
      </g>
    </g>
    <g class="rm-hit" id="hit-frame3" tabindex="0" role="button" aria-label="Photo frame — your memories" transform="translate(220,8)">
      <g class="rm-shape">
        <rect x="0" y="0" width="88" height="68" rx="3" fill="var(--rm-wood-d)"/>
        <rect x="7" y="7" width="74" height="54" fill="var(--rm-paper)"/>
        <image id="frame-img-3" x="9" y="9" width="70" height="50" preserveAspectRatio="xMidYMid slice" style="display:none"/>
        <g id="frame-art-3"><path d="M20,44 C28,26 48,26 56,44" fill="none" stroke="#96525B" stroke-width="2.6"/><path d="M38,30 l0,14 M32,38 l12,0" stroke="#B98A44" stroke-width="2"/></g>
      </g>
    </g>
  </g>

  <!-- rug -->
  <ellipse cx="640" cy="568" rx="352" ry="62" fill="var(--rm-rug)"/>
  <ellipse cx="640" cy="568" rx="322" ry="52" fill="none" stroke="var(--rm-rug-d)" stroke-width="3" stroke-dasharray="1 10" stroke-linecap="round"/>

  <!-- sideboard + record player -->
  <g class="rm-hit" id="hit-player" tabindex="0" role="button" aria-label="Record player — put on some music" transform="translate(258,404)">
    <g class="rm-shape">
      <rect x="24" y="36" width="136" height="32" rx="5" fill="var(--rm-paper)"/>
      <g class="rm-vinyl-wrap"><circle class="rm-vinyl" cx="92" cy="52" r="22" fill="#2A241C"/>
      <circle cx="92" cy="52" r="22" fill="none" stroke="#4A4036" stroke-width="1"/>
      <circle cx="92" cy="52" r="15" fill="none" stroke="#4A4036" stroke-width="1"/>
      <circle cx="92" cy="52" r="7" fill="#B4766B"/>
      <line x1="120" y1="34" x2="130" y2="46" stroke="var(--rm-metal)" stroke-width="3" stroke-linecap="round"/></g>
      <rect x="0" y="66" width="194" height="72" rx="6" fill="var(--rm-wood)"/>
      <line x1="64" y1="72" x2="64" y2="132" stroke="var(--rm-wood-d)" stroke-width="3"/>
      <circle cx="32" cy="102" r="4" fill="var(--rm-wood-d)"/><circle cx="162" cy="102" r="4" fill="var(--rm-wood-d)"/>
      <rect x="18" y="138" width="158" height="12" rx="6" fill="var(--rm-fabric-d)"/>
      <rect x="28" y="150" width="8" height="14" fill="var(--rm-wood-d)"/><rect x="158" y="150" width="8" height="14" fill="var(--rm-wood-d)"/>
    </g>
  </g>

  <!-- sofa -->
  <g id="sofa" transform="translate(600,296)">
    <rect x="0" y="0" width="340" height="132" rx="22" fill="var(--rm-fabric)"/>
    <rect x="16" y="14" width="146" height="88" rx="18" fill="var(--rm-fabric-d)" opacity="0.55"/>
    <rect x="178" y="14" width="146" height="88" rx="18" fill="var(--rm-fabric-d)" opacity="0.55"/>
    <rect x="-24" y="58" width="46" height="134" rx="21" fill="var(--rm-fabric-d)"/>
    <rect x="318" y="58" width="46" height="134" rx="21" fill="var(--rm-fabric-d)"/>
    <rect x="6" y="150" width="328" height="36" rx="13" fill="var(--rm-fabric-d)"/>
    <rect x="10" y="184" width="10" height="16" rx="3" fill="var(--rm-wood-d)"/>
    <rect x="320" y="184" width="10" height="16" rx="3" fill="var(--rm-wood-d)"/>
    <rect x="26" y="34" width="64" height="56" rx="14" fill="var(--rm-rug)" transform="rotate(-8 58 62)"/>
    <rect x="252" y="38" width="60" height="52" rx="24" fill="#D9A95C"/>
    <path d="M330,66 q34,4 30,44 q-2,26 -26,34 l-8,-8 q20,-10 20,-30 q0,-26 -24,-32 z" fill="#B4766B"/>
  </g>

  <!-- coffee table with tea, book, candle -->
  <g transform="translate(500,492)">
    <rect x="0" y="0" width="284" height="16" rx="8" fill="var(--rm-wood)"/>
    <rect x="16" y="16" width="10" height="34" fill="var(--rm-wood-d)"/>
    <rect x="258" y="16" width="10" height="34" fill="var(--rm-wood-d)"/>
    <rect x="20" y="-9" width="66" height="10" rx="2" fill="#8A6844"/>
    <line x1="24" y1="-4" x2="82" y2="-4" stroke="#E4D6B8" stroke-width="3"/>
    <g class="rm-hit" id="hit-tea" tabindex="0" role="button" aria-label="Make tea together">
      <g class="rm-shape">
        <rect x="140" y="-24" width="27" height="24" rx="5" fill="#B4766B"/>
        <path d="M167,-18 q10,3 0,10" fill="none" stroke="#B4766B" stroke-width="4"/>
        <rect x="182" y="-24" width="27" height="24" rx="5" fill="#B98A44"/>
        <path d="M209,-18 q10,3 0,10" fill="none" stroke="#B98A44" stroke-width="4"/>
      </g>
    </g>
    ${steam(152, -28)}${steam(194, -28)}
    <g class="rm-hit" id="hit-candle" tabindex="0" role="button" aria-label="Light the candle">
      <g class="rm-shape">
        <rect x="240" y="-18" width="20" height="18" rx="3" fill="#E4D6B8"/>
        <line x1="250" y1="-18" x2="250" y2="-22" stroke="#8E8172" stroke-width="2"/>
        <g class="rm-flame-wrap">
          <circle cx="250" cy="-30" r="18" fill="url(#candlegrad)"/>
          <path class="rm-flame" d="M250,-36 q7,8 0,14 q-7,-6 0,-14" fill="#E8B06A"/>
          <path class="rm-flame" d="M250,-33 q4,5 0,9 q-4,-4 0,-9" fill="#F2D9A0"/>
        </g>
      </g>
    </g>
  </g>

  <!-- floor lamp -->
  <g class="rm-hit" id="hit-lamp" tabindex="0" role="button" aria-label="Lamp — adjust the light" transform="translate(1044,238)">
    <g class="rm-shape">
      <ellipse class="lamp-glow" cx="16" cy="86" rx="110" ry="80" fill="url(#lampgrad)"/>
      <path d="M-20,72 L52,72 L38,0 L-6,0 Z" fill="#D9A95C"/>
      <path d="M-20,72 L52,72 L50,66 L-18,66 Z" fill="#C08F4A"/>
      <rect x="12" y="72" width="8" height="150" fill="var(--rm-metal)"/>
      <ellipse cx="16" cy="224" rx="38" ry="9" fill="var(--rm-metal)"/>
    </g>
  </g>

  <!-- monstera -->
  <g class="rm-hit" id="hit-plant" tabindex="0" role="button" aria-label="Plant — give it some water" transform="translate(1090,396)">
    <g class="rm-shape">
      <path d="M-6,0 l0,-22 M0,-14 q-16,-6 -20,-24 M0,-16 q16,-8 18,-26 M-3,-24 q-10,-14 -6,-32 M2,-26 q12,-14 8,-30" stroke="var(--rm-leaf-d)" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="-20" cy="-40" rx="17" ry="11" fill="var(--rm-leaf)" transform="rotate(-24 -20 -40)"/>
      <ellipse cx="19" cy="-44" rx="17" ry="11" fill="var(--rm-leaf)" transform="rotate(22 19 -44)"/>
      <ellipse cx="-8" cy="-60" rx="15" ry="10" fill="var(--rm-leaf)" transform="rotate(-10 -8 -60)"/>
      <ellipse cx="10" cy="-62" rx="14" ry="10" fill="var(--rm-leaf)" transform="rotate(14 10 -62)"/>
      <path d="M-24,2 L24,2 L18,44 L-18,44 Z" fill="#B98A44"/>
      <rect x="-27" y="-2" width="54" height="9" rx="4" fill="#C9A36A"/>
    </g>
  </g>

  <!-- hanging plant -->
  <g transform="translate(940,10)">
    <line x1="-20" y1="0" x2="-6" y2="42" stroke="#8E8172" stroke-width="2"/>
    <line x1="20" y1="0" x2="6" y2="42" stroke="#8E8172" stroke-width="2"/>
    <path d="M-20,42 q20,10 40,0 l-4,26 q-16,8 -32,0 z" fill="#B4766B"/>
    <path d="M-8,68 q-6,26 -2,44" stroke="var(--rm-leaf)" stroke-width="3" fill="none"/>
    <path d="M10,68 q8,24 4,48" stroke="var(--rm-leaf)" stroke-width="3" fill="none"/>
    <ellipse cx="-11" cy="88" rx="7" ry="4" fill="var(--rm-leaf)"/>
    <ellipse cx="14" cy="96" rx="7" ry="4" fill="var(--rm-leaf)"/>
    <ellipse cx="0" cy="108" rx="6" ry="4" fill="var(--rm-leaf)"/>
  </g>

  <!-- cat -->
  <g class="rm-hit" id="hit-cat" tabindex="0" role="button" aria-label="The cat — say hello" transform="translate(958,552)">
    <g class="rm-shape">
      <g class="rm-cat-body">
        <ellipse cx="0" cy="0" rx="37" ry="19" fill="#8E8172"/>
        <path d="M-8,-17 q3,-6 8,-6 M4,-18 q3,-5 8,-5" stroke="#6E6152" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="-28" cy="-9" r="13" fill="#8E8172"/>
        <path d="M-38,-18 l-3,-10 l9,5 z" fill="#8E8172"/>
        <path d="M-20,-19 l3,-10 l-8,6 z" fill="#8E8172"/>
        <path d="M-33,-9 q2,2 5,0 M-24,-9 q2,2 5,0" stroke="#F4EEE2" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      </g>
      <path class="rm-cat-tail" d="M30,2 q28,4 34,-20" stroke="#8E8172" stroke-width="8" fill="none" stroke-linecap="round"/>
    </g>
  </g>

  <!-- seat spots -->
  <g id="spots" class="rm-spots">
    ${Object.entries(SPOTS).map(([id, s]) => `
      <g class="rm-hit rm-spot-hit" data-spot="${id}" tabindex="0" role="button" aria-label="Move to ${s.label}">
        <circle class="rm-spot-hint" cx="${s.hint[0]}" cy="${s.hint[1]}" r="26" fill="none" stroke="var(--ink-3)" stroke-width="2" stroke-dasharray="4 8" stroke-linecap="round"/>
      </g>`).join('')}
  </g>

  <!-- avatars -->
  <g id="avatars"></g>
</svg>`;
}

export function avatarFigure({ name, accent = 'rose', hair = 'short', skinIdx } = {}, me) {
  skinIdx = skinIdx || 0;
  const colors = { rose: '#B4766B', amber: '#B98A44', sage: '#7D8471', slate: '#6E7686', burgundy: '#7A4049' };
  const skins = ['#E8C9A8', '#D8B48C', '#B98A68', '#8C6248', '#F0D9BE'];
  const hairColors = ['#3A2E22', '#231A12', '#5A4632', '#8A6448', '#C9B79A', '#4A4A52'];
  const c = colors[accent] || colors.rose;
  const skin = skins[skinIdx % 5];
  const hc = hairColors[skinIdx % 6];
  const hairTop = { short: `<path d="M-15,-70 q2,-13 15,-13 q13,0 15,13 q-8,-6 -15,-6 q-7,0 -15,6z" fill="${hc}"/>`,
    medium: `<path d="M-16,-69 q1,-14 16,-14 q15,0 16,14 q-7,-6 -16,-6 q-9,0 -16,6z" fill="${hc}"/><path d="M-16,-69 q-3,10 -1,16 M16,-69 q3,10 1,16" stroke="${hc}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
    long: `<path d="M-16,-69 q1,-14 16,-14 q15,0 16,14 q-7,-6 -16,-6 q-9,0 -16,6z" fill="${hc}"/><path d="M-16,-68 q-6,16 -2,30 M16,-68 q6,16 2,30" stroke="${hc}" stroke-width="7" stroke-linecap="round" fill="none"/>`,
    curl: `<g fill="${hc}"><circle cx="-9" cy="-72" r="6"/><circle cx="0" cy="-77" r="6.5"/><circle cx="9" cy="-72" r="6"/><circle cx="-14" cy="-66" r="5"/><circle cx="14" cy="-66" r="5"/></g>`,
    bun: `<path d="M-14,-70 q1,-12 14,-12 q13,0 14,12 q-7,-5 -14,-5 q-7,0 -14,5z" fill="${hc}"/><circle cx="0" cy="-84" r="6.5" fill="${hc}"/>` }[hair] || '';
  return `
  <ellipse cx="0" cy="6" rx="36" ry="9" fill="rgba(30,22,14,0.16)"/>
  <g class="av-lean">
    <g class="av-body">
      <path d="M-30,0 C-30,-40 -17,-55 0,-55 C17,-55 30,-40 30,0 Z" fill="${c}"/>
      <path d="M-30,-6 C-30,-2 30,-2 30,-6 L30,0 L-30,0 Z" fill="rgba(0,0,0,0.08)"/>
      <path class="av-arm" d="M-22,-22 q22,14 44,0" stroke="${c}" stroke-width="11" stroke-linecap="round" fill="none"/>
      <circle cx="0" cy="-67" r="16.5" fill="${skin}"/>
      ${hairTop}
      <path d="M-8,-67 q3,3.5 6,0 M2,-67 q3,3.5 6,0" stroke="#3A2E22" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M-3,-60 q3,2.4 6,0" stroke="#3A2E22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <circle class="av-ring" cx="24" cy="-86" r="5.5" fill="var(--gold)"/>
      <text x="24" y="-95" text-anchor="middle" font-size="9" fill="var(--ink-3)" font-family="var(--font-sans)">z</text>
    </g>
  </g>
  <text class="av-label" y="26" text-anchor="middle" font-size="15" font-weight="600" fill="var(--ink)" font-family="var(--font-sans)">${escapeXml(name)}${me ? '' : ''}</text>
  <g class="av-pres"><circle class="av-dot" cx="${String(name).length * 4 + 2}" cy="21" r="4"/></g>`;
}
function escapeXml(s) { return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])); }
