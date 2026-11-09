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
  // surf world themes
  { id: 'reef',       world: 'surf', name: 'Reef',          accent: '#FF7A59', b1: '#0E7490', b2: '#22D3EE', decor: ['🌊', '🐠', '🐚'], pattern: 'swell' },
  { id: 'sunrise',    world: 'surf', name: 'Dawn Patrol',   accent: '#FFD166', b1: '#F97362', b2: '#FDBA74', decor: ['🌅', '🏄', '☕'], pattern: 'rays' },
  { id: 'tropic',     world: 'surf', name: 'Tropical',      accent: '#FDE047', b1: '#059669', b2: '#2DD4BF', decor: ['🌴', '🍍', '🦜'], pattern: 'swell' },
  { id: 'glassy',     world: 'surf', name: 'Glassy Sunset', accent: '#FFE8A3', b1: '#7C3AED', b2: '#F472B6', decor: ['🌇', '🌊', '✨'], pattern: 'rays' },
  { id: 'deepblue',   world: 'surf', name: 'Deep Blue',     accent: '#5EEAD4', b1: '#0B2447', b2: '#19376D', decor: ['🐋', '🌊', '🐬'], pattern: 'bubbles' },
  { id: 'coral',      world: 'surf', name: 'Coral Bay',     accent: '#0EA5E9', b1: '#FB7185', b2: '#FDA4AF', decor: ['🪸', '🐢', '🌺'], pattern: 'bubbles' },
  { id: 'sandy',      world: 'surf', name: 'Sandy Shores',  accent: '#0891B2', b1: '#D6A75C', b2: '#F5D9A8', decor: ['🏖️', '🐚', '🦀'], pattern: 'sand' },
  { id: 'lagoon',     world: 'surf', name: 'Lagoon',        accent: '#F59E0B', b1: '#0284C7', b2: '#67E8F9', decor: ['🏝️', '🐬', '☀️'], pattern: 'swell' },
  // golf world themes
  { id: 'fairway',    world: 'golf', name: 'Fairway',       accent: '#C9A227', b1: '#0F3D2E', b2: '#1F6B45', decor: ['⛳', '🏌️', '🏆'], pattern: 'mow' },
  { id: 'azalea',     world: 'golf', name: 'Azalea',        accent: '#FFE08A', b1: '#1F6B45', b2: '#D9467A', decor: ['🌸', '⛳', '🌷'], pattern: 'mow' },
  { id: 'links',      world: 'golf', name: 'Seaside Links', accent: '#E8C46A', b1: '#3D4F48', b2: '#7C8F84', decor: ['🌬️', '⛳', '🐑'], pattern: 'argyle' },
  { id: 'clubhouse',  world: 'golf', name: 'Clubhouse',     accent: '#C9A227', b1: '#13233F', b2: '#2D4470', decor: ['🏆', '☕', '⛳'], pattern: 'argyle' },
  { id: 'sundayred',  world: 'golf', name: 'Sunday Red',    accent: '#FFFFFF', b1: '#8E1B1B', b2: '#C62828', decor: ['🔴', '⛳', '🐅'], pattern: 'dimples' },
  { id: 'dunes',      world: 'golf', name: 'Desert Dunes',  accent: '#2E7D4F', b1: '#C1693C', b2: '#E6A15C', decor: ['🌵', '⛳', '☀️'], pattern: 'dimples' },
  // cycling world themes
  { id: 'yellowjersey', world: 'cycle', name: 'Yellow Jersey', accent: '#111111', b1: '#FFC800', b2: '#FFE14D', decor: ['🚴', '🏆', '🇫🇷'], pattern: 'speed' },
  { id: 'polka',        world: 'cycle', name: 'King of the Mountains', accent: '#E0262C', b1: '#FFFFFF', b2: '#F3F3F3', decor: ['⛰️', '🚴', '🔴'], pattern: 'polka' },
  { id: 'pinkrace',     world: 'cycle', name: 'Pink Race',     accent: '#111111', b1: '#F35B9B', b2: '#FF9CC4', decor: ['🇮🇹', '🚴', '🍝'], pattern: 'speed' },
  { id: 'greenpoints',  world: 'cycle', name: 'Sprinter Green', accent: '#FFE14D', b1: '#0A7B3E', b2: '#22B35E', decor: ['💨', '🚴', '🟢'], pattern: 'speed' },
  { id: 'tricolore',    world: 'cycle', name: 'Tricolore',     accent: '#E0262C', b1: '#1F3D99', b2: '#2F5BD3', decor: ['🥖', '🚴', '🗼'], pattern: 'chevron' },
  { id: 'alpine',       world: 'cycle', name: 'Alpine Pass',   accent: '#FFC800', b1: '#2F4858', b2: '#5B8DA6', decor: ['🏔️', '🚴', '🐄'], pattern: 'chevron' },
];
THEMES.forEach(t => { t.world = t.world || 'skate'; });

window.PATTERNS = {
  none: 'none',
  grip: 'radial-gradient(rgba(255,255,255,.2) .9px,transparent 1.2px) 0 0/5px 5px,radial-gradient(rgba(255,255,255,.12) .9px,transparent 1.2px) 2px 3px/7px 7px',
  halftone: 'radial-gradient(rgba(255,255,255,.24) 2.2px,transparent 2.6px) 0 0/12px 12px',
  checker: 'conic-gradient(rgba(255,255,255,.16) 25%,transparent 0 50%,rgba(255,255,255,.16) 0 75%,transparent 0) 0 0/32px 32px',
  stripes: 'repeating-linear-gradient(45deg,rgba(255,255,255,.1) 0 12px,transparent 12px 26px)',
  plaid: 'repeating-linear-gradient(0deg,rgba(255,255,255,.1) 0 6px,transparent 6px 30px),repeating-linear-gradient(90deg,rgba(255,255,255,.1) 0 6px,transparent 6px 30px),repeating-linear-gradient(0deg,transparent 0 14px,rgba(255,225,77,.18) 14px 16px,transparent 16px 30px),repeating-linear-gradient(90deg,transparent 0 14px,rgba(255,225,77,.18) 14px 16px,transparent 16px 30px)',
  mow: 'repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 40px,transparent 40px 80px)',
  argyle: 'linear-gradient(45deg,rgba(255,255,255,.08) 25%,transparent 25% 75%,rgba(255,255,255,.08) 75%) 0 0/40px 40px,linear-gradient(-45deg,rgba(255,255,255,.08) 25%,transparent 25% 75%,rgba(255,255,255,.08) 75%) 0 0/40px 40px',
  dimples: 'radial-gradient(circle,rgba(255,255,255,.18) 3px,transparent 3.5px) 0 0/16px 16px,radial-gradient(circle,rgba(255,255,255,.12) 3px,transparent 3.5px) 8px 8px/16px 16px',
  speed: 'repeating-linear-gradient(-20deg,rgba(0,0,0,.08) 0 6px,transparent 6px 26px)',
  polka: 'radial-gradient(circle,#E0262C 7px,transparent 7.5px) 0 0/36px 36px,radial-gradient(circle,#E0262C 7px,transparent 7.5px) 18px 18px/36px 36px',
  chevron: 'linear-gradient(135deg,rgba(255,255,255,.12) 25%,transparent 25%) -20px 0/40px 40px,linear-gradient(225deg,rgba(255,255,255,.12) 25%,transparent 25%) -20px 0/40px 40px',
  swell: 'radial-gradient(ellipse 30px 10px at 50% 100%,transparent 70%,rgba(255,255,255,.22) 72%,rgba(255,255,255,.22) 88%,transparent 90%) 0 0/60px 22px',
  rays: 'repeating-conic-gradient(from 0deg at 85% 110%,rgba(255,255,255,.14) 0 6deg,transparent 6deg 14deg)',
  bubbles: 'radial-gradient(circle,transparent 4px,rgba(255,255,255,.22) 4.5px,rgba(255,255,255,.22) 6px,transparent 6.5px) 0 0/38px 38px,radial-gradient(circle,rgba(255,255,255,.18) 2px,transparent 2.5px) 19px 19px/38px 38px',
  sand: 'radial-gradient(rgba(120,72,20,.18) 1px,transparent 1.4px) 0 0/6px 6px,radial-gradient(rgba(255,255,255,.25) 1px,transparent 1.4px) 3px 2px/9px 9px',
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
    bucket: `<path d="M34 34L40 8Q60 2 80 8L86 34Z" fill="#F4E3B5" stroke="${INK}" stroke-width="3"/><path d="M22 36Q60 26 98 36L94 44Q60 36 26 44Z" fill="#E9CF8C" stroke="${INK}" stroke-width="3"/><path d="M38 28H82" stroke="#0EA5E9" stroke-width="5"/>`,
    visor: `<path d="M30 40Q60 22 90 40L90 34Q60 16 30 34Z" fill="#14B8A6" stroke="${INK}" stroke-width="3"/><path d="M48 34Q72 34 108 46Q90 50 60 42Z" fill="#0F766E" stroke="${INK}" stroke-width="3"/>`,
    straw: `<ellipse cx="60" cy="36" rx="50" ry="10" fill="#E8C872" stroke="${INK}" stroke-width="3"/><path d="M36 34Q38 6 60 6Q82 6 84 34Z" fill="#F2D88A" stroke="${INK}" stroke-width="3"/><path d="M37 28Q60 34 83 28" stroke="#E0262C" stroke-width="5" fill="none"/><path d="M44 16H76M42 22H78" stroke="#C9A24B" stroke-width="1.5"/>`,
    flowercrown: [[30, 34, '#FF8FB1'], [38, 26, '#FFD23F'], [48, 21, '#FF7A59'], [60, 19, '#B28DFF'], [72, 21, '#FF7A59'], [82, 26, '#FFD23F'], [90, 34, '#FF8FB1']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="6.5" fill="${c}" stroke="${INK}" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="2.4" fill="#F28C28"/>`).join(''),
    golfcap: `<path d="M32 36Q32 8 60 8Q88 8 88 36Z" fill="#FDFDFB" stroke="${INK}" stroke-width="3"/><path d="M60 34H108Q106 42 96 42H60Z" fill="#1F6B45" stroke="${INK}" stroke-width="3"/><circle cx="60" cy="22" r="6" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="58" cy="20" r="1" fill="${INK}"/><circle cx="62" cy="23" r="1" fill="${INK}"/>`,
    flatcap: `<path d="M28 38Q30 10 62 10Q94 12 94 32L104 40Q70 46 28 38Z" fill="#8B6B4A" stroke="${INK}" stroke-width="3"/><path d="M36 24H88M34 31H92" stroke="#6E5236" stroke-width="2"/><path d="M50 12V36M70 11V38" stroke="#A7896A" stroke-width="1.5"/>`,
    tam: `<ellipse cx="60" cy="24" rx="40" ry="14" fill="#1F4E8C" stroke="${INK}" stroke-width="3"/><path d="M24 22H96M28 30H92M44 12V36M60 10V38M76 12V36" stroke="#C62828" stroke-width="2" opacity=".8"/><rect x="28" y="32" width="64" height="8" rx="4" fill="#13233F" stroke="${INK}" stroke-width="2"/><circle cx="60" cy="8" r="8" fill="#C62828" stroke="${INK}" stroke-width="2"/>`,
    golfvisor: `<path d="M30 40Q60 24 90 40L90 34Q60 18 30 34Z" fill="#FDFDFB" stroke="${INK}" stroke-width="3"/><path d="M46 36Q72 34 108 46Q90 50 60 44Z" fill="#C9A227" stroke="${INK}" stroke-width="3"/>`,
    roadhelmet: `<path d="M24 46Q22 6 62 6Q98 8 98 42Z" fill="#FFC800" stroke="${INK}" stroke-width="3"/><path d="M40 14L48 40M58 10L62 40M76 12L74 40M90 22L84 40" stroke="${INK}" stroke-width="3"/><path d="M26 44L34 86M96 42L88 86" stroke="${INK}" stroke-width="2.5"/>`,
    cyclingcap: `<path d="M32 38Q32 10 60 10Q88 10 88 38Z" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/><path d="M34 26H86M33 32H87" stroke="#E0262C" stroke-width="3"/><path d="M40 34Q60 16 80 30L84 24Q60 6 36 30Z" fill="#1F3D99" stroke="${INK}" stroke-width="2.5"/>`,
    aerohelmet: `<path d="M20 50Q20 8 64 8Q100 10 118 44Q90 40 60 44Z" fill="#E0262C" stroke="${INK}" stroke-width="3"/><path d="M28 30Q60 16 96 26" stroke="#fff" stroke-width="4" fill="none"/><path d="M28 44Q60 40 88 46L88 58Q60 54 28 58Z" fill="#111" opacity=".85"/>`,
    laurel: [[-1, 0], [1, 0]].map(([d]) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI * (0.95 - i * 0.13), x = 60 + d * Math.cos(a) * 34, y = 34 - Math.sin(a) * 22; return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="8" ry="4" fill="#5E8C31" stroke="${INK}" stroke-width="1.5" transform="rotate(${(d * (40 - i * 18)).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join('')).join(''),
    surfhelmet: `<path d="M24 50Q24 4 60 4Q96 4 96 50Z" fill="#F97316" stroke="${INK}" stroke-width="3"/><path d="M30 30H90" stroke="#fff" stroke-width="5"/><path d="M27 50L34 86M93 50L86 86" stroke="${INK}" stroke-width="2.5"/><rect x="52" y="10" width="16" height="10" rx="3" fill="#121212"/>`,
    crown: `<path d="M32 34L30 4L44 20L52 -4L60 16L68 -4L76 20L90 4L88 34Z" fill="#FFE14D" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="26" r="4" fill="#FF2E88"/><circle cx="44" cy="28" r="3" fill="#2B59FF"/><circle cx="76" cy="28" r="3" fill="#2B59FF"/>`,
  };
  const EYES = {
    aviator: `<path d="M32 58Q32 76 46 76Q56 76 57 62Q57 56 46 56Z" fill="#3A3A3A" stroke="#C9A227" stroke-width="2.5"/><path d="M88 58Q88 76 74 76Q64 76 63 62Q63 56 74 56Z" fill="#3A3A3A" stroke="#C9A227" stroke-width="2.5"/><path d="M57 59Q60 56 63 59M32 58L20 56M88 58L100 56" stroke="#C9A227" stroke-width="2.5" fill="none"/>`,
    wrap: `<path d="M26 60Q60 50 94 60L92 70Q76 76 62 70Q60 68 58 70Q44 76 28 70Z" fill="#FF3E8A" stroke="${INK}" stroke-width="3"/><path d="M34 62Q48 58 56 62" stroke="#fff" stroke-width="2" opacity=".7"/>`,
    mask: `<rect x="30" y="52" width="60" height="26" rx="12" fill="#7DD3FC" fill-opacity=".55" stroke="${INK}" stroke-width="3.5"/><path d="M60 54V76" stroke="${INK}" stroke-width="2"/><path d="M90 62Q102 60 100 40V20" stroke="#F97316" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M20 62H30M90 62H100" stroke="${INK}" stroke-width="3"/>`,
    heart: `<path d="M46 76L33 63Q28 56 34 51Q41 47 46 54Q51 47 58 51Q64 56 59 63Z" fill="#FF2E88" stroke="${INK}" stroke-width="2.5"/><path d="M74 76L61 63Q56 56 62 51Q69 47 74 54Q79 47 86 51Q92 56 87 63Z" fill="#FF2E88" stroke="${INK}" stroke-width="2.5"/>`,
    shades: `<path d="M30 58H90V64Q90 74 78 74H70Q62 74 61 64H59Q58 74 50 74H42Q30 74 30 64Z" fill="${INK}"/><path d="M36 61H46M66 61H76" stroke="#fff" stroke-opacity=".5" stroke-width="2.5" stroke-linecap="round"/>`,
    round: `<g fill="none" stroke="${INK}" stroke-width="3.5"><circle cx="46" cy="64" r="11"/><circle cx="74" cy="64" r="11"/><path d="M57 63Q60 59 63 63"/><path d="M35 61L20 57M85 61L100 57"/></g>`,
    eyepatch: `<path d="M20 48L100 76" stroke="${INK}" stroke-width="3"/><ellipse cx="46" cy="64" rx="12" ry="10" fill="${INK}"/>${star(46, 64, 4, '#FF2E88')}`,
    star: `${star(46, 64, 14, '#FF2E88', `stroke="${INK}" stroke-width="2"`)}${star(74, 64, 14, '#FF2E88', `stroke="${INK}" stroke-width="2"`)}<path d="M58 62H62" stroke="${INK}" stroke-width="3"/>`,
  };
  const NECK = {
    polo: `<path d="M36 90L58 98L50 112ZM84 90L62 98L70 112Z" fill="#FDFDFB" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="60" cy="104" r="2.5" fill="${INK}"/>`,
    golftowel: `<path d="M78 86Q96 90 98 120L86 124Q84 100 72 94Z" fill="#FDFDFB" stroke="${INK}" stroke-width="2.5"/><path d="M80 98L94 104M82 106L96 112" stroke="#1F6B45" stroke-width="2.5"/>`,
    bidon: `<path d="M44 90L60 108L76 90" stroke="#111" stroke-width="3" fill="none"/><rect x="53" y="104" width="14" height="22" rx="4" fill="#FFC800" stroke="${INK}" stroke-width="2.5"/><rect x="56" y="100" width="8" height="6" rx="2" fill="#111"/>`,
    lei: Array.from({ length: 11 }, (_, i) => { const t = i / 10, x = (1 - t) ** 2 * 30 + 2 * (1 - t) * t * 60 + t * t * 90, y = (1 - t) ** 2 * 90 + 2 * (1 - t) * t * 120 + t * t * 90; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${['#FF7A59', '#FFD23F', '#FF8FB1', '#B28DFF'][i % 4]}" stroke="${INK}" stroke-width="1.2"/>`; }).join(''),
    sharktooth: `<path d="M34 90Q60 106 86 90" stroke="#8B5A2B" stroke-width="3" fill="none"/><path d="M54 99L60 118L66 99Z" fill="#F6F2E6" stroke="${INK}" stroke-width="2"/>`,
    whistle: `<path d="M44 88L58 108M76 88L62 108" stroke="#E0262C" stroke-width="4"/><rect x="52" y="106" width="20" height="10" rx="5" fill="#FFD23F" stroke="${INK}" stroke-width="2"/><circle cx="56" cy="111" r="2" fill="${INK}"/>`,
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

// ---------------------------------------------------------------------
//  Surf world: extra fonts, surf names for breaks, decorations, tricks and achievements
// ---------------------------------------------------------------------
FONTS.push({ id: 'Shrikhand', name: 'Retro surf' }, { id: 'Lilita One', name: 'Beach bold' }, { id: 'Pacifico', name: 'Surf script' }, { id: 'Righteous', name: 'Seventies' });
window.SURF_BREAKS = {
  brickyard: { name: 'Local Beach',     where: 'Beach',  blurb: 'Golden sand, lifeguard flags and a friendly little wave.' },
  warehouse: { name: 'Pier Break',      where: 'Pier',   blurb: 'Waves peeling along an old wooden pier.' },
  backyard:  { name: 'Reef Pass',       where: 'Tropics',blurb: 'Crystal-clear turquoise water over the reef.' },
  beach:     { name: 'Point Break',     where: 'Cliffs', blurb: 'Rocky headland with a lighthouse and long lines of swell.' },
  rooftop:   { name: 'Sunset Glass',    where: 'Beach',  blurb: 'Glassy golden waves as the sun goes down.' },
  outback:   { name: 'Island Huts',     where: 'Island', blurb: 'Huts on stilts, a volcano and warm water.' },
  forest:    { name: 'Arctic Swell',    where: 'Ice',    blurb: 'Icebergs and cold, perfect peaks. Wetsuits on!' },
  neon:      { name: 'Glow Tide',       where: 'Night',  blurb: 'Night surfing on glowing blue bioluminescent waves.' },
  moon:      { name: 'Big Wave Jaws',   where: 'Giant',  blurb: 'Monster waves under stormy skies. Huge airs.' },
};
window.SURF_DECOR = {
  bolt: 'Beach umbrella', tag_crew: 'Bunting flags', aplus: 'A+ surfboard', hundred: 'Lifeguard tower', crown: 'Jumping dolphins',
  shred: '"SURF\'S UP" in the sand', classpiece: 'Plane towing your class banner', flames: 'Tiki torches', brain: 'Sandcastle',
  checker: 'Striped beach towels', fire: 'Beach bonfire', horns: 'Palm tree hammock', legends: 'Golden trophy', board: 'Surfboard rack', gold: 'Golden sunset',
};
window.SURF_TRICKS = { ollie: 'Snap', kickflip: 'Cutback', shuvit: 'Floater', treflip: 'Aerial 360', indy: 'Grab Air', handplant: 'Hang Ten', spin540: 'Alley-oop', backflip: 'Rodeo Flip' };
window.SURF_ACH = {
  first_drop: 'First Wave', crew_up: 'Surf Crew', quiz_kids: 'Quiz Grommets', warehouse_key: 'Pier Pass', flawless: 'Clean Sets x3',
  backyard_bash: 'Reef Ready', double_trouble: 'Party Wave', quiz_shred: 'Quiz Shredders', beach_day: 'Point Taken', full_crew: 'Full Lineup',
  on_fire: 'Tiki Time', rooftop: 'Golden Hour', big_brains: 'Big Brains', packed_bowl: 'Packed Lineup', outback: 'Island Hopper',
  quiz_machine: 'Quiz Machine', into_woods: 'Ice Breaker', squad_goals: 'Squad Goals', neon_nights: 'Glow Up', legends: 'Legends Only',
  quiz_legends: 'Quiz Legends', moon: 'Charging Jaws', golden_era: 'Golden Era',
};
window.WORDS = {
  skate: { rider: 'skater', riders: 'skaters', Riders: 'Skaters', scene: 'bowl', Scene: 'Bowl', ride: 'ride the bowl', pass: 'Bowl pass', park: 'skatepark', Parks: 'Skateparks', hangout: 'Hangout', shop: 'Hit the shop', shopTitle: 'The shop', greet: 'Yo', join: 'Drop in', name: 'skater name', namePh: 'e.g. Kickflip Kai', deco: 'Graffiti & stickers', riding: "You're riding the bowl! 🛹", newbie: 'new skater', world: 'Skatepark' },
  surf: { rider: 'surfer', riders: 'surfers', Riders: 'Surfers', scene: 'wave', Scene: 'Wave', ride: 'ride the wave', pass: 'Wave pass', park: 'surf break', Parks: 'Surf breaks', hangout: 'Beach hut', shop: 'Surf shop', shopTitle: 'The surf shop', greet: 'Howzit', join: 'Paddle out', name: 'surfer name', namePh: 'e.g. Barrel Bella', deco: 'Beach upgrades', riding: "You're riding the wave! 🏄", newbie: 'new surfer', world: 'Surf beach' },
};

// ---------------------------------------------------------------------
//  Golf and road cycling worlds
// ---------------------------------------------------------------------
FONTS.push({ id: 'Playfair Display', name: 'Country club' }, { id: 'Saira Condensed', name: 'Race poster' });
window.WORLD_LIST = [
  { id: 'skate', emoji: '🛹', name: 'Skatepark', blurb: 'Punk zine look, skate bowl, graffiti and stickers.' },
  { id: 'surf',  emoji: '🏄', name: 'Surf beach', blurb: 'Sunny retro surf look, a rolling wave, beach upgrades.' },
  { id: 'golf',  emoji: '⛳', name: 'Golf course', blurb: 'Classic country-club look, buggies on the fairway, courses worldwide.' },
  { id: 'cycle', emoji: '🚴', name: 'Road cycling', blurb: 'Race-poster look, a peloton racing stages around the world.' },
];
window.WORLD_DEFAULT_THEME = { skate: 'griptape', surf: 'reef', golf: 'fairway', cycle: 'yellowjersey' };
window.WORLD_FONT = { surf: 'Shrikhand', golf: 'Playfair Display', cycle: 'Saira Condensed' };
window.GOLF_COURSES = {
  brickyard: { name: 'Local Links',        where: 'Parkland', blurb: 'Leafy trees, a white clubhouse and a friendly par 4.' },
  warehouse: { name: 'The Dome Range',     where: 'Indoor',   blurb: 'An indoor driving range under a giant dome.' },
  backyard:  { name: 'Seaside Links',      where: 'Coast',    blurb: 'Windy dunes and pot bunkers by a grey northern sea.' },
  beach:     { name: 'Desert Oasis',       where: 'Desert',   blurb: 'A green ribbon through red rocks and cactus.' },
  rooftop:   { name: 'Skyline Rooftop',    where: 'City',     blurb: 'Night golf on top of a skyscraper.' },
  outback:   { name: 'Outback Fairways',   where: 'Outback',  blurb: 'Red dirt, gum trees and kangaroos on the fairway.' },
  forest:    { name: 'Pine Lake',          where: 'Mountains',blurb: 'Tall pines, snowy peaks and a sneaky water hazard.' },
  neon:      { name: 'Glow Golf',          where: 'Night',    blurb: 'Glow-in-the-dark fairways and neon flags.' },
  moon:      { name: 'Moon Golf',          where: 'Space',    blurb: 'Low gravity means the longest drives ever hit.' },
};
window.CYCLE_STAGES = {
  brickyard: { name: 'Paris Finish',       where: 'France',   blurb: 'Cobbles, flags and the iron tower on the final stage.' },
  warehouse: { name: 'The Velodrome',      where: 'Indoor',   blurb: 'Steep wooden banking and track sprints.' },
  backyard:  { name: 'Tuscan Gravel',      where: 'Italy',    blurb: 'White gravel roads through cypress-lined hills.' },
  beach:     { name: 'Riviera Coast',      where: 'Monaco',   blurb: 'Seaside cliffs, yachts and palm trees.' },
  rooftop:   { name: 'Alpine Climb',       where: 'Alps',     blurb: 'Hairpin bends below snowy peaks. Cows cheer you on.' },
  outback:   { name: 'Outback Highway',    where: 'Australia',blurb: 'A long red road under a huge sky.' },
  forest:    { name: 'Pyrenees Forest',    where: 'Spain',    blurb: 'Misty forest climbs on the border mountains.' },
  neon:      { name: 'Tokyo Night Crit',   where: 'Japan',    blurb: 'A twisting night race through neon streets.' },
  moon:      { name: 'Summit Finish',      where: 'Peak',     blurb: 'The hardest climb of the tour, above the clouds.' },
};
window.GOLF_DECOR = { bolt: 'Golf umbrella', tag_crew: 'Club bunting', aplus: 'A+ scorecard', hundred: 'Leaderboard', crown: 'Ducks on the pond', shred: '"FORE!" sign', classpiece: 'Plane towing your class banner', flames: 'Flower beds', brain: 'Clubhouse', checker: 'Striped mowing', fire: 'Fireworks', horns: 'Gallery stand', legends: 'Golden trophy', board: 'Golf bag rack', gold: 'Golden sunset' };
window.CYCLE_DECOR = { bolt: 'Feed-zone umbrella', tag_crew: 'Stage bunting', aplus: 'A+ roadside sign', hundred: '"100 km to go" banner', crown: 'Polka-dot flags', shred: '"ALLEZ!" painted on the road', classpiece: 'Plane towing your class banner', flames: 'Sunflower field', brain: 'Camper vans', checker: 'Chequered finish line', fire: 'Fans with flags', horns: 'Costumed super-fan', legends: 'Golden trophy', board: 'Bike rack', gold: 'Golden sunset' };
window.GOLF_TRICKS = { ollie: 'Tee Shot', kickflip: 'Chip Shot', shuvit: 'Flop Shot', treflip: 'Trick Shot', indy: 'Fist Pump', handplant: 'Hole in One', spin540: 'Victory Spin', backflip: 'Celebration Flip' };
window.CYCLE_TRICKS = { ollie: 'Bunny Hop', kickflip: 'Bar Spin', shuvit: 'Track Stand', treflip: 'Tailwhip', indy: 'Victory Salute', handplant: 'Endo', spin540: '360 Spin', backflip: 'Backflip' };
window.GOLF_ACH = { first_drop: 'First Tee', crew_up: 'Fourball', quiz_kids: 'Quiz Caddies', warehouse_key: 'Range Pass', flawless: 'Birdie x3', backyard_bash: 'Links Ready', double_trouble: 'Playing Partners', quiz_shred: 'Quiz Pros', beach_day: 'Desert Drive', full_crew: 'Full Field', on_fire: 'In Bloom', rooftop: 'Night Round', big_brains: 'Eagle Eyes', packed_bowl: 'Packed Fairway', outback: 'Outback Open', quiz_machine: 'Quiz Machine', into_woods: 'Lake Carry', squad_goals: 'Squad Goals', neon_nights: 'Glow Up', legends: 'Legends Only', quiz_legends: 'Quiz Legends', moon: 'Lunar Drive', golden_era: 'Golden Era' };
window.CYCLE_ACH = { first_drop: 'First Pedal', crew_up: 'Breakaway', quiz_kids: 'Quiz Domestiques', warehouse_key: 'Track Pass', flawless: 'Stage Wins x3', backyard_bash: 'Strade Bianche', double_trouble: 'Lead-out Duo', quiz_shred: 'Quiz Sprinters', beach_day: 'Riviera Run', full_crew: 'Full Team', on_fire: 'Sunflower Stage', rooftop: 'Hors Catégorie', big_brains: 'Big Brains', packed_bowl: 'The Peloton', outback: 'Outback Express', quiz_machine: 'Quiz Machine', into_woods: 'Into the Mist', squad_goals: 'Squad Goals', neon_nights: 'Night Crit', legends: 'Legends Only', quiz_legends: 'Quiz Legends', moon: 'Summit Glory', golden_era: 'Golden Era' };
Object.assign(WORDS, {
  golf: { rider: 'golfer', riders: 'golfers', Riders: 'Golfers', scene: 'course', Scene: 'Course', ride: 'play the course', pass: 'Course pass', park: 'golf course', Parks: 'Golf courses', hangout: 'Clubhouse', shop: 'Pro shop', shopTitle: 'The pro shop', greet: "G'day", join: 'Tee off', name: 'golfer name', namePh: 'e.g. Birdie Bella', deco: 'Course upgrades', riding: "You're on the course! ⛳", newbie: 'new golfer', world: 'Golf course', loading: 'Walking to the first tee…' },
  cycle: { rider: 'rider', riders: 'riders', Riders: 'Riders', scene: 'stage', Scene: 'Stage', ride: 'ride the stage', pass: 'Race pass', park: 'race stage', Parks: 'Race stages', hangout: 'Team bus', shop: 'Bike shop', shopTitle: 'The bike shop', greet: 'Allez', join: 'Clip in', name: 'rider name', namePh: 'e.g. Sprinter Sam', deco: 'Roadside upgrades', riding: "You're in the race! 🚴", newbie: 'new rider', world: 'Road cycling', loading: 'Rolling to the start line…' },
});
WORDS.skate.loading = 'Rolling up to the bowl…'; WORDS.surf.loading = 'Paddling out…';
window.SAFARI = [
  { id: 'zebra', e: '🦓', name: 'Zebra' }, { id: 'giraffe', e: '🦒', name: 'Giraffe' }, { id: 'elephant', e: '🐘', name: 'Elephant' },
  { id: 'hippo', e: '🦛', name: 'Hippo' }, { id: 'lion', e: '🦁', name: 'Lion' }, { id: 'buffalo', e: '🐃', name: 'Buffalo' },
  { id: 'rhino', e: '🦏', name: 'Rhino', rare: true }, { id: 'leopard', e: '🐆', name: 'Leopard', rare: true },
  { id: 'gorilla', e: '🦍', name: 'Gorilla', rare: true }, { id: 'flamingo', e: '🦩', name: 'Flamingo', rare: true },
];
