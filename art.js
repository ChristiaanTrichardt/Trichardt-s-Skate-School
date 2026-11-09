// Skate Skool — themes and character art.
// Add a built-in theme by copying one line in THEMES. Teachers can also make themes in the site.

window.THEMES = [
  { id: 'griptape',  name: 'Grip Tape',     accent: '#FFE14D', b1: '#121212', b2: '#2B2B2B', decor: ['🛹', '⚡', '🤘'], pattern: 'grip' },
  { id: 'bubblegum', name: 'Bubblegum',     accent: '#FF2E88', b1: '#E0136F', b2: '#FF7FBF', decor: ['💗', '🛼', '⭐'], pattern: 'halftone' },
  { id: 'checker',   name: 'Checkerboard',  accent: '#E0262C', b1: '#121212', b2: '#121212', decor: ['🏁', '🛹', '💀'], pattern: 'checker' },
  { id: 'flames',    name: 'Hot Flames',    accent: '#FF8A00', b1: '#3A0A00', b2: '#D9222A', decor: ['🔥', '🎸', '🔥'], pattern: 'stripes' },
  { id: 'skatepark', name: 'Skate Park',    accent: '#FF7A1A', b1: '#4E5258', b2: '#8A9099', decor: ['🛹', '🧱', '🚧'], pattern: 'grid' },
  { id: 'neon',      name: 'Neon Night',    accent: '#39FF88', b1: '#1A0B3D', b2: '#6A1BB0', decor: ['👾', '⚡', '🎧'], pattern: 'halftone' },
  { id: 'surf',      name: 'Surf Shred',    accent: '#1EC8FF', b1: '#003A70', b2: '#0089C7', decor: ['🌊', '🏄', '🦈'], pattern: 'waves' },
  { id: 'tartan',    name: 'Tartan Punk',   accent: '#E0262C', b1: '#5E0A10', b2: '#1C1C1C', decor: ['🧷', '🎸', '💀'], pattern: 'plaid' },
  { id: 'graffiti',  name: 'Graffiti Wall', accent: '#FFE14D', b1: '#2B59FF', b2: '#FF2E88', decor: ['🎨', '💥', '✌️'], pattern: 'halftone' },
];

window.PATTERNS = {
  none: 'none',
  grip: 'radial-gradient(rgba(255,255,255,.2) .9px,transparent 1.2px) 0 0/5px 5px,radial-gradient(rgba(255,255,255,.12) .9px,transparent 1.2px) 2px 3px/7px 7px',
  halftone: 'radial-gradient(rgba(255,255,255,.24) 2.2px,transparent 2.6px) 0 0/12px 12px',
  checker: 'conic-gradient(rgba(255,255,255,.16) 25%,transparent 0 50%,rgba(255,255,255,.16) 0 75%,transparent 0) 0 0/32px 32px',
  stripes: 'repeating-linear-gradient(45deg,rgba(255,255,255,.1) 0 12px,transparent 12px 26px)',
  plaid: 'repeating-linear-gradient(0deg,rgba(255,255,255,.1) 0 6px,transparent 6px 30px),repeating-linear-gradient(90deg,rgba(255,255,255,.1) 0 6px,transparent 6px 30px),repeating-linear-gradient(0deg,transparent 0 14px,rgba(255,225,77,.18) 14px 16px,transparent 16px 30px),repeating-linear-gradient(90deg,transparent 0 14px,rgba(255,225,77,.18) 14px 16px,transparent 16px 30px)',
  waves: 'radial-gradient(circle at 50% 120%,transparent 13px,rgba(255,255,255,.16) 14px,rgba(255,255,255,.16) 16px,transparent 17px) 0 0/34px 17px',
  grid: 'linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px) 0 0/24px 24px,linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px) 0 0/24px 24px',
};

window.COLORS = ['#FF2E88', '#FFE14D', '#39FF88', '#2B59FF', '#FF8A00', '#A66CFF', '#1EC8FF', '#E8E8E0'];
window.SLOT_LABELS = { character: 'Characters', hat: 'Headgear', eyes: 'Eyewear', neck: 'Neckwear', pet: 'Pets', plant: 'Plants', gear: 'Gear' };

(function () {
  function hexRgb(h) { let c = String(h || '#888').replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const n = parseInt(c, 16) || 0; return [n >> 16, (n >> 8) & 255, n & 255]; }
  function shade(h, a) { const f = v => Math.max(0, Math.min(255, Math.round(a < 0 ? v * (1 + a) : v + (255 - v) * a))); return '#' + hexRgb(h).map(f).map(v => v.toString(16).padStart(2, '0')).join(''); }
  function star(cx, cy, r, fill, extra = '') { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; p.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1)); } return `<polygon points="${p.join(' ')}" fill="${fill}" ${extra}/>`; }
  const INK = '#121212';
  const HATS = {
    backcap: `<path d="M32 36Q32 8 60 8Q88 8 88 36Z" fill="${INK}"/><path d="M34 30H6Q3 39 14 39H36Z" fill="${INK}"/><rect x="30" y="31" width="60" height="6" rx="3" fill="#FFE14D"/><circle cx="60" cy="9" r="3" fill="#FF2E88"/>`,
    beanie: `<path d="M30 38Q30 4 60 4Q90 4 90 38Z" fill="#E0262C"/><path d="M40 12V36M50 7V36M60 5V36M70 7V36M80 12V36" stroke="#9E1015" stroke-width="2"/><rect x="27" y="32" width="66" height="11" fill="${INK}"/><circle cx="60" cy="2" r="7" fill="#F6F6F1" stroke="${INK}" stroke-width="2"/>`,
    bandana: `<path d="M24 48Q60 20 96 48L96 36Q60 8 24 36Z" fill="#D9222A"/><path d="M95 40L114 32L109 50Z" fill="#D9222A"/><path d="M95 44L110 58L99 60Z" fill="#9E1015"/>` + [[38, 32], [52, 26], [66, 25], [80, 30], [46, 38], [74, 37]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="#fff"/>`).join(''),
    mohawk: `<path d="M42 32L44 -4L52 20L56 -18L62 18L68 -14L72 20L78 -2L78 32Z" fill="#FF2E88" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
    helmet: `<path d="M23 52Q23 2 60 2Q97 2 97 52Z" fill="#2B59FF" stroke="${INK}" stroke-width="3"/><path d="M34 22Q60 10 86 22" stroke="#FFE14D" stroke-width="5" fill="none"/><path d="M27 50L36 88M93 50L84 88" stroke="${INK}" stroke-width="2.5"/>${star(60, 36, 6, '#FFE14D')}`,
    headphones: `<path d="M22 72Q22 16 60 16Q98 16 98 72" stroke="${INK}" stroke-width="7" fill="none"/><rect x="9" y="57" width="17" height="31" fill="#FF2E88" stroke="${INK}" stroke-width="3"/><rect x="94" y="57" width="17" height="31" fill="#FF2E88" stroke="${INK}" stroke-width="3"/>`,
    grad: `<path d="M38 24V38Q60 46 82 38V24Z" fill="${INK}"/><path d="M60 2L104 18L60 34L16 18Z" fill="#2A2A2A" stroke="${INK}" stroke-width="2"/><path d="M60 18L94 24V44" stroke="#FFE14D" stroke-width="2.5" fill="none"/><circle cx="94" cy="46" r="4" fill="#FFE14D"/>`,
    spikes: `<g fill="#39FF88" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"><path d="M28 44L8 8L44 30Z"/><path d="M40 30L30 -18L54 24Z"/><path d="M53 24L60 -28L67 24Z"/><path d="M66 24L90 -18L80 30Z"/><path d="M76 30L112 8L92 44Z"/></g>`,
    crown: `<path d="M32 34L30 4L44 20L52 -4L60 16L68 -4L76 20L90 4L88 34Z" fill="#FFE14D" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="26" r="4" fill="#FF2E88"/><circle cx="44" cy="28" r="3" fill="#2B59FF"/><circle cx="76" cy="28" r="3" fill="#2B59FF"/>`,
  };
  const EYES = {
    shades: `<path d="M30 58H90V64Q90 74 78 74H70Q62 74 61 64H59Q58 74 50 74H42Q30 74 30 64Z" fill="${INK}"/><path d="M36 61H46M66 61H76" stroke="#fff" stroke-opacity=".5" stroke-width="2.5" stroke-linecap="round"/>`,
    round: `<g fill="none" stroke="${INK}" stroke-width="3.5"><circle cx="46" cy="64" r="11"/><circle cx="74" cy="64" r="11"/><path d="M57 63Q60 59 63 63"/><path d="M35 61L20 57M85 61L100 57"/></g>`,
    eyepatch: `<path d="M20 48L100 76" stroke="${INK}" stroke-width="3"/><ellipse cx="46" cy="64" rx="12" ry="10" fill="${INK}"/>${star(46, 64, 4, '#FF2E88')}`,
    star: `${star(46, 64, 14, '#FF2E88', `stroke="${INK}" stroke-width="2"`)}${star(74, 64, 14, '#FF2E88', `stroke="${INK}" stroke-width="2"`)}<path d="M58 62H62" stroke="${INK}" stroke-width="3"/>`,
  };
  const NECK = {
    bowtie: `<path d="M60 100L42 90V110Z" fill="#FF2E88" stroke="${INK}" stroke-width="2"/><path d="M60 100L78 90V110Z" fill="#FF2E88" stroke="${INK}" stroke-width="2"/><circle cx="60" cy="100" r="5" fill="${INK}"/>`,
    chain: Array.from({ length: 9 }, (_, i) => { const t = i / 8, x = (1 - t) ** 2 * 32 + 2 * (1 - t) * t * 60 + t * t * 88, y = (1 - t) ** 2 * 92 + 2 * (1 - t) * t * 116 + t * t * 92; return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.5" ry="3.2" fill="none" stroke="#C9CCD1" stroke-width="2.4" transform="rotate(${(i - 4) * 9} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join(''),
    spiked: `<path d="M26 92Q60 108 94 92L94 102Q60 118 26 102Z" fill="${INK}"/>` + [32, 44, 56, 64, 76, 88].map((x, i) => { const y = 98 + (i === 2 || i === 3 ? 7 : i === 1 || i === 4 ? 5 : 2); return `<path d="M${x - 3} ${y}L${x} ${y + 9}L${x + 3} ${y}Z" fill="#E8E8E0"/>`; }).join(''),
    medal: `<path d="M48 88L58 106M72 88L62 106" stroke="#2B59FF" stroke-width="5"/><circle cx="60" cy="113" r="9" fill="#FFE14D" stroke="${INK}" stroke-width="2"/>${star(60, 113, 4.5, INK)}`,
  };

  window.charSVG = function (eq = {}, color = '#FF2E88', cls = '', label = 'Character') {
    const c = color || '#FF2E88', d = shade(c, -.3), l = shade(c, .5), ch = eq.character || 'blob', pink = '#FF8FB8';
    const O = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"`;
    let back = '', body = '', feet = `<ellipse cx="44" cy="125" rx="12" ry="7" fill="${d}" ${O}/><ellipse cx="76" cy="125" rx="12" ry="7" fill="${d}" ${O}/>`;
    const blob = 'M60 22C92 22 102 50 102 82C102 112 86 126 60 126C34 126 18 112 18 82C18 50 28 22 60 22Z';
    if (ch === 'cat') back = `<path d="M24 50L28 6L56 26Z" fill="${d}" ${O}/><path d="M96 50L92 6L64 26Z" fill="${d}" ${O}/><path d="M32 38L33 19L45 28Z" fill="${pink}"/><path d="M88 38L87 19L75 28Z" fill="${pink}"/>`;
    if (ch === 'bunny') back = `<ellipse cx="44" cy="6" rx="10" ry="28" fill="${d}" transform="rotate(-12 44 6)" ${O}/><ellipse cx="76" cy="6" rx="10" ry="28" fill="${d}" transform="rotate(12 76 6)" ${O}/><ellipse cx="44" cy="8" rx="4.5" ry="18" fill="${pink}" transform="rotate(-12 44 8)"/><ellipse cx="76" cy="8" rx="4.5" ry="18" fill="${pink}" transform="rotate(12 76 8)"/>`;
    if (ch === 'bear') back = `<circle cx="29" cy="34" r="14" fill="${d}" ${O}/><circle cx="91" cy="34" r="14" fill="${d}" ${O}/><circle cx="29" cy="34" r="6.5" fill="${l}"/><circle cx="91" cy="34" r="6.5" fill="${l}"/>`;
    if (ch === 'dino') back = `<path d="M36 30L42 8L52 24Z" fill="${d}" ${O}/><path d="M52 24L60 2L68 24Z" fill="${d}" ${O}/><path d="M68 24L78 8L84 30Z" fill="${d}" ${O}/><path d="M98 96Q122 104 116 124Q106 112 94 116Z" fill="${d}" ${O}/>`;
    if (ch === 'owl') back = `<path d="M22 44L26 12L46 28Z" fill="${d}" ${O}/><path d="M98 44L94 12L74 28Z" fill="${d}" ${O}/>`;
    if (ch === 'robot') {
      feet = `<rect x="32" y="118" width="22" height="12" fill="${d}" ${O}/><rect x="66" y="118" width="22" height="12" fill="${d}" ${O}/>`;
      body = `<line x1="60" y1="28" x2="60" y2="10" stroke="${INK}" stroke-width="4"/><circle cx="60" cy="9" r="6" fill="#FFE14D" ${O}/><rect x="12" y="58" width="8" height="22" fill="${d}" ${O}/><rect x="100" y="58" width="8" height="22" fill="${d}" ${O}/><rect x="18" y="26" width="84" height="96" rx="16" fill="${c}" ${O}/><rect x="36" y="94" width="48" height="18" fill="${d}" ${O}/><circle cx="46" cy="103" r="3" fill="#39FF88"/><circle cx="60" cy="103" r="3" fill="#FFE14D"/><circle cx="74" cy="103" r="3" fill="#FF2E88"/>`;
    } else if (ch === 'ghost') {
      feet = '';
      body = `<path d="M18 82C18 46 34 22 60 22C86 22 102 46 102 82L102 126Q94 116 86 126Q78 134 70 126Q62 116 54 126Q46 134 38 126Q30 116 18 126Z" fill="${c}" ${O}/>`;
    } else body = `<path d="${blob}" fill="${c}" ${O}/><ellipse cx="60" cy="102" rx="25" ry="16" fill="${l}" opacity=".6"/>`;
    let face = '';
    if (ch === 'owl') face += `<circle cx="45" cy="63" r="13" fill="${l}" stroke="${INK}" stroke-width="2.5"/><circle cx="75" cy="63" r="13" fill="${l}" stroke="${INK}" stroke-width="2.5"/>`;
    face += `<circle cx="46" cy="64" r="6.5" fill="${INK}"/><circle cx="74" cy="64" r="6.5" fill="${INK}"/><circle cx="48.3" cy="61.7" r="2.2" fill="#fff"/><circle cx="76.3" cy="61.7" r="2.2" fill="#fff"/>`;
    if (ch !== 'robot') face += `<ellipse cx="33" cy="80" rx="7" ry="4.5" fill="${pink}" opacity=".8"/><ellipse cx="87" cy="80" rx="7" ry="4.5" fill="${pink}" opacity=".8"/>`;
    face += ch === 'owl' ? `<path d="M54 76H66L60 86Z" fill="#FFE14D" stroke="${INK}" stroke-width="2"/>`
      : ch === 'robot' ? `<rect x="49" y="78" width="22" height="7" fill="${INK}"/><path d="M53 78V85M57 78V85M61 78V85M65 78V85" stroke="#E8E8E0" stroke-width="1.5"/>`
      : `<path d="M51 79Q60 89 69 79" stroke="${INK}" stroke-width="3.5" fill="#fff" stroke-linecap="round"/><path d="M57 81V86" stroke="${INK}" stroke-width="1.5"/>`;
    return `<svg viewBox="-10 -32 140 168" class="char ${cls}" role="img" aria-label="${String(label).replace(/"/g, '&quot;')}">${back}${feet}${body}${face}${NECK[eq.neck] || ''}${EYES[eq.eyes] || ''}${HATS[eq.hat] || ''}</svg>`;
  };
  window.ART = { hexRgb, shade };
})();

// ---------------------------------------------------------------------
//  Heading fonts the teacher can pick (all loaded from Google Fonts in index.html)
// ---------------------------------------------------------------------
window.FONTS = [
  { id: 'Rubik Dirt', name: 'Grunge' },
  { id: 'Knewave', name: 'Skate brush' },
  { id: 'Bangers', name: 'Comic' },
  { id: 'Bebas Neue', name: 'Poster' },
  { id: 'Permanent Marker', name: 'Marker' },
  { id: 'Sedgwick Ave Display', name: 'Graffiti' },
  { id: 'Black Ops One', name: 'Stencil' },
  { id: 'Rubik Mono One', name: 'Chunky' },
  { id: 'Archivo Black', name: 'Bold block' },
  { id: 'Special Elite', name: 'Typewriter' },
];
window.fontCss = id => `"${(FONTS.find(f => f.id === id) || FONTS[0]).id}","Impact","Arial Black",sans-serif`;

// ---------------------------------------------------------------------
//  Tricks the teacher can unlock for each skater
// ---------------------------------------------------------------------
window.TRICKS = [
  { id: 'ollie',     name: 'Ollie',      emoji: '⬆️' },
  { id: 'kickflip',  name: 'Kickflip',   emoji: '🔄' },
  { id: 'shuvit',    name: 'Pop Shuv-it',emoji: '↔️' },
  { id: 'treflip',   name: '360 Flip',   emoji: '🌀' },
  { id: 'indy',      name: 'Indy Grab',  emoji: '🤙' },
  { id: 'handplant', name: 'Handplant',  emoji: '🤸' },
  { id: 'spin540',   name: '540 Spin',   emoji: '🌪️' },
  { id: 'backflip',  name: 'Backflip',   emoji: '🔥' },
];

// ---------------------------------------------------------------------
//  Skateparks a class can unlock (key = reward_id in the achievements table)
// ---------------------------------------------------------------------
window.PARKS = [
  { id: 'brickyard', name: 'The Brick Yard',   where: 'Outdoor', blurb: 'Where every crew starts. Brick wall, chain fence, your class colours.' },
  { id: 'warehouse', name: 'The Warehouse',    where: 'Indoor',  blurb: 'Rain-proof shredding under skylights and hanging lamps.' },
  { id: 'backyard',  name: 'Backyard Pool',    where: 'Outdoor', blurb: 'An empty backyard pool with blue tiles and a palm tree.' },
  { id: 'beach',     name: 'Beach Bowl',       where: 'Outdoor', blurb: 'Concrete bowl on the coast with the ocean behind it.' },
  { id: 'rooftop',   name: 'Rooftop City',     where: 'Outdoor', blurb: 'A bowl on top of a skyscraper at sunset.' },
  { id: 'outback',   name: 'Outback Ditch',    where: 'Outdoor', blurb: 'Red dirt, gum trees and a big rock on the horizon.' },
  { id: 'forest',    name: 'Forest Snake Run', where: 'Outdoor', blurb: 'Mossy concrete in the mountains among the pines.' },
  { id: 'neon',      name: 'Neon Night Park',  where: 'Outdoor', blurb: 'Glow-in-the-dark coping and neon signs.' },
  { id: 'moon',      name: 'Moon Bowl',        where: 'Space',   blurb: 'Low gravity means way bigger air. Earth in the sky.' },
];

// ---------------------------------------------------------------------
//  Graffiti and stickers a class can unlock (key = reward_id)
// ---------------------------------------------------------------------
window.DECOR = [
  { id: 'bolt',       name: 'Lightning sticker',   kind: 'Sticker' },
  { id: 'tag_crew',   name: '"CREW" tag',          kind: 'Graffiti' },
  { id: 'aplus',      name: 'A+ sticker',          kind: 'Sticker' },
  { id: 'hundred',    name: '💯 sticker',          kind: 'Sticker' },
  { id: 'crown',      name: 'Crown sticker',       kind: 'Sticker' },
  { id: 'shred',      name: '"SHRED" piece',       kind: 'Graffiti' },
  { id: 'classpiece', name: 'Class name piece',    kind: 'Graffiti' },
  { id: 'flames',     name: 'Flame job',           kind: 'Graffiti' },
  { id: 'brain',      name: 'Big brain sticker',   kind: 'Sticker' },
  { id: 'checker',    name: 'Checkerboard coping', kind: 'Bowl upgrade' },
  { id: 'fire',       name: 'Fire sticker',        kind: 'Sticker' },
  { id: 'horns',      name: 'Rock on sticker',     kind: 'Sticker' },
  { id: 'legends',    name: '"LEGENDS" chrome piece', kind: 'Graffiti' },
  { id: 'board',      name: 'Skateboard sticker',  kind: 'Sticker' },
  { id: 'gold',       name: 'Golden coping',       kind: 'Bowl upgrade' },
];
