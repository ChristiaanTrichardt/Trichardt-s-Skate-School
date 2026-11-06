// Skate Skool — app logic. Talks to Supabase; all coin rules run on the server (see supabase/setup.sql).
(function () {
'use strict';
const CFG = window.SKATE_CONFIG || {};
const CONFIGURED = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !/YOUR-/.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY));
const STUDENT_COLS = 'id,nickname,color,earned,spent,equipped,owned,focus_min,focus_sessions,quizzes_done,created_at';
const BUCKET = 'resources';
let sb = null;

const S = {
  role: null, uid: null, email: null, isAnon: false, loading: true, err: null,
  settings: {}, themes: [], classes: [], units: [], resources: [], quizzes: [], shop: [],
  students: [], enrol: [], me: null, log: [], attempts: [], board: {},
  view: { name: 'home' },
  ui: { tab: 'units', shopTab: 'character', resKind: 'file', armed: null, busy: false, joinMode: 'new', color: null, focusMin: 25, focusLabel: '', focusClass: '', loginErr: '' },
  focus: null, quizRun: null, quizDraft: null, customDraft: null, celebrate: null,
};

/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byOrder = (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.created_at).localeCompare(String(b.created_at));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};
function code6() { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
function uniqueCode() { let c; do c = code6(); while (S.classes.some(x => x.code === c)); return c; }
function fmtT(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function fmtSize(b) { return !b ? '' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB'; }
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3800); }
function midnight() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
const site = () => ({ site_name: 'Skate Skool', teacher_name: '', home_theme: 'griptape', focus_rate: 1, focus_cap: 100, quiz_cap: 150, welcome: 20, ...S.settings });

const ERR = {
  bad_code: "That code doesn't match a class. Check it with your teacher.",
  name_taken: 'Someone in that class already has that name. Pick another one.',
  bad_pin: 'Your PIN needs to be exactly 4 numbers.',
  bad_name: 'Names need between 1 and 20 characters.',
  no_match: "Couldn't find you. Check the class code, your name and your PIN.",
  locked: 'Too many wrong PINs. Ask your teacher to reset your PIN.',
  not_enough: "You don't have enough coins for that yet.",
  owned: 'You already own that.',
  not_owned: "You don't own that yet.",
  too_early: "The timer hasn't finished yet.",
  not_teacher: 'Only the teacher can do that.',
  already_student: 'This device is already logged in as a student.',
  not_student: 'Join a class first.',
  bad_minutes: 'Pick one of the session lengths.',
};
function msg(e) {
  const m = String(e?.message || e || '');
  for (const k in ERR) if (m.includes(k)) return ERR[k];
  if (/anonymous sign-ins are disabled/i.test(m)) return 'Student logins are switched off. Your teacher needs to turn on "Anonymous sign-ins" in Supabase (see README).';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Couldn't reach the server. Check your internet and try again.";
  if (/Invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/Email not confirmed/i.test(m)) return 'Confirm your email first (check your inbox), then sign in.';
  if (/row-level security|permission denied/i.test(m)) return "You don't have permission to do that.";
  return m || 'Something went wrong. Try again.';
}
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
async function rpc(fn, args) { return q(sb.rpc(fn, args)); }
async function act(fn, ok) { try { const r = await fn(); if (ok) toast(ok); return r; } catch (e) { toast(msg(e)); throw e; } }

/* colour */
const { hexRgb, shade } = window.ART;
function lum(h) { const [r, g, b] = hexRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; }
const inkFor = h => lum(h) > .4 ? '#121212' : '#FFFFFF';
function mixHex(a, b) { const x = hexRgb(a), y = hexRgb(b); return '#' + x.map((v, i) => Math.round((v + y[i]) / 2).toString(16).padStart(2, '0')).join(''); }
const allThemes = () => [...THEMES, ...S.themes.slice().sort(byOrder)];
function themeById(id) { return THEMES.find(t => t.id === id) || S.themes.find(t => t.id === id) || THEMES[0]; }
function themeVars(t) { return `--accent:${t.accent};--accent-ink:${inkFor(t.accent)};--b1:${t.b1};--b2:${t.b2};--banner-ink:${inkFor(mixHex(t.b1, t.b2))};--pattern:${PATTERNS[t.pattern] || 'none'}`; }
const classTheme = c => themeById(c?.theme_id);
function unitTheme(u) { return u?.theme_id ? themeById(u.theme_id) : classTheme(S.classes.find(c => c.id === u?.class_id)); }

/* data shortcuts */
const item = (slot, id) => S.shop.find(i => i.slot === slot && i.id === id);
const shopSlot = slot => S.shop.filter(i => i.slot === slot).sort(byOrder);
const unitsOf = cid => S.units.filter(u => u.class_id === cid).sort(byOrder);
const resOf = uid => S.resources.filter(r => r.unit_id === uid).sort(byOrder);
const studentsIn = cid => { const ids = new Set(S.enrol.filter(e => e.class_id === cid).map(e => e.student_id)); return S.students.filter(s => ids.has(s.id)); };
const balance = s => (s?.earned || 0) - (s?.spent || 0);
const owns = (s, slot, id) => (item(slot, id)?.price === 0) || (s?.owned || []).includes(slot + ':' + id);
const eqOf = s => s?.equipped || { character: 'blob' };

/* ---------------- boot & data ---------------- */
async function boot() {
  if (!CONFIGURED || !window.supabase) { S.loading = false; S.role = 'setup'; render(); return; }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  window.addEventListener('hashchange', () => { if (location.hash === '#teacher' && S.role !== 'teacher') go({ name: 'teacherlogin' }); });
  setInterval(tick, 1000);
  await resolveSession();
}
async function resolveSession() {
  S.loading = true; S.err = null; render();
  try {
    const { data: { session } } = await sb.auth.getSession();
    const u = session?.user;
    S.uid = u?.id || null; S.email = u?.email || null; S.isAnon = !!u?.is_anonymous;
    S.role = 'guest';
    if (S.uid && !S.isAnon) {
      const t = await q(sb.from('teachers').select('user_id').eq('user_id', S.uid).maybeSingle());
      S.role = t ? 'teacher' : 'pending';
    } else if (S.uid) {
      const me = await q(sb.from('students').select('id').maybeSingle());
      if (me) S.role = 'student';
    }
    if (S.role === 'teacher' || S.role === 'student') await loadAll();
    else await loadPublic();
    const f = store.get('skate-focus'); S.focus = (S.role === 'student' && f && f.uid === S.uid) ? f : null;
  } catch (e) { S.err = msg(e); }
  if (location.hash === '#teacher' && S.role !== 'teacher') S.view = { name: 'teacherlogin' };
  else if (S.view.name === 'teacherlogin' && S.role === 'teacher') S.view = { name: 'home' };
  S.loading = false; render();
}
async function loadPublic() {
  const [settings, themes] = await Promise.all([q(sb.from('settings').select('*').eq('id', 1).maybeSingle()), q(sb.from('themes').select('*'))]);
  S.settings = settings || {}; S.themes = themes || [];
}
async function loadAll() {
  const sel = (t, cols = '*') => q(sb.from(t).select(cols));
  const [settings, themes, classes, units, resources, quizzes, shop] = await Promise.all([
    q(sb.from('settings').select('*').eq('id', 1).maybeSingle()), sel('themes'), sel('classes'), sel('units'), sel('resources'), sel('quizzes'), sel('shop_items')]);
  Object.assign(S, { settings: settings || {}, themes, classes, units, resources, quizzes, shop });
  if (S.role === 'teacher') {
    const [students, enrol] = await Promise.all([sel('students', STUDENT_COLS), sel('enrolments')]);
    S.students = students; S.enrol = enrol;
  } else {
    const [me, enrol, log, attempts] = await Promise.all([
      q(sb.from('students').select(STUDENT_COLS).maybeSingle()), sel('enrolments'),
      q(sb.from('coin_log').select('amount,reason,created_at').order('created_at', { ascending: false }).limit(10)),
      q(sb.from('quiz_attempts').select('quiz_id,score,total,coins,created_at').order('created_at', { ascending: false }).limit(1000))]);
    S.me = me; S.enrol = enrol; S.log = log; S.attempts = attempts;
  }
}
async function refresh() { try { await loadAll(); } catch (e) { toast(msg(e)); } render(); }
async function loadBoard(cid) { try { S.board[cid] = await rpc('class_leaderboard', { p_class: cid }); render(); } catch { } }

/* ---------------- render core ---------------- */
let rq = 0;
function schedule() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; render(); }); }
function render() {
  const app = $('#app');
  const vals = {}; app.querySelectorAll('input[id],textarea[id],select[id]').forEach(el => { if (el.type === 'file') return; vals[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? { c: el.checked } : { v: el.value }; });
  const opens = {}; app.querySelectorAll('details[id]').forEach(d => opens[d.id] = d.open);
  const ae = document.activeElement, fid = ae && ae.id; let sel = null; try { sel = [ae.selectionStart, ae.selectionEnd]; } catch { }
  const sy = window.scrollY;
  const { html, theme } = view();
  app.setAttribute('style', themeVars(theme));
  app.innerHTML = html;
  for (const [id, s] of Object.entries(vals)) { const el = document.getElementById(id); if (!el) continue; if ('c' in s) el.checked = s.c; else el.value = s.v; }
  for (const [id, o] of Object.entries(opens)) { const d = document.getElementById(id); if (d) d.open = o; }
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); try { if (sel && sel[0] != null) el.setSelectionRange(sel[0], sel[1]); } catch { } } }
  if (Math.abs(window.scrollY - sy) > 2) window.scrollTo(0, sy);
  document.title = site().site_name;
}
function clear(...ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
function go(v) { S.view = v; S.ui.armed = null; S.celebrate = null; render(); window.scrollTo(0, 0); }

function view() {
  const home = themeById(site().home_theme);
  if (S.loading) return { theme: home, html: `<div class="loading"><h2 class="scrawl">Dropping in…</h2></div>` };
  if (S.role === 'setup') return setupView();
  let out;
  if (S.view.name === 'teacherlogin' && S.role !== 'teacher') out = teacherLogin();
  else if (S.role === 'teacher') {
    const v = S.view.name;
    out = v === 'class' ? tClass() : v === 'unit' ? tUnit() : v === 'themes' ? tThemes() : v === 'settings' ? tSettings() : v === 'quizedit' ? tQuizEdit() : tHome();
  } else if (S.role === 'pending') out = pendingView();
  else if (S.role === 'student' && S.me) {
    const v = S.view.name;
    out = v === 'class' ? sClass() : v === 'unit' ? sUnit() : v === 'focus' ? sFocus() : v === 'shop' ? sShop() : v === 'den' ? sDen() : v === 'quiz' ? sQuiz() : sHome();
  } else out = joinView();
  const err = S.err ? `<div class="wrap" style="padding-top:16px"><div class="alert">${esc(S.err)} <button class="btn sm" data-act="retry">Try again</button></div></div>` : '';
  return { theme: out.theme || home, html: topbar() + err + out.html };
}

const BOARD_SVG = `<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="3" y="8" width="58" height="14" rx="7" fill="#FF2E88" stroke="#F6F6F1" stroke-width="3"/><circle cx="16" cy="30" r="6" fill="#FFE14D" stroke="#F6F6F1" stroke-width="3"/><circle cx="48" cy="30" r="6" fill="#FFE14D" stroke="#F6F6F1" stroke-width="3"/></svg>`;
function topbar() {
  const st = site(), v = S.view.name;
  let navs = [];
  if (S.role === 'teacher') navs = [['home', 'Classes'], ['themes', 'Themes'], ['settings', 'Settings']];
  else if (S.role === 'student' && S.me) navs = [['home', 'Home'], ['focus', 'Focus'], ['shop', 'Shop'], ['den', 'Hangout']];
  const cur = n => (v === n || (n === 'home' && ['class', 'unit', 'quizedit', 'quiz'].includes(v))) ? 'aria-current="page"' : '';
  let right = '';
  if (S.focus && S.role === 'student') { const rem = remaining(); right += `<button class="minitimer" data-act="nav" data-to="focus" id="minitimer" aria-label="Focus session running">⏱ ${fmtT(rem)}</button>`; }
  if (S.role === 'student' && S.me) right += `<span class="coins" title="Your coins"><span class="coin"></span>${balance(S.me)}</span>`;
  if (S.role === 'teacher' || S.role === 'pending') right += `<button class="topbtn" data-act="signout">Sign out</button>`;
  return `<header class="top"><div class="wrap"><button class="brand" data-act="nav" data-to="home">${BOARD_SVG}<span>${esc(st.site_name)}</span></button>
  ${navs.length ? `<nav class="nav" aria-label="Main">${navs.map(([k, l]) => `<button data-act="nav" data-to="${k}" ${cur(k)}>${l}</button>`).join('')}</nav>` : ''}${right}</div></header>`;
}
function banner(t, { eyebrow = '', title = '', sub = '', back = null, code = null } = {}) {
  return `<section class="banner"><div class="decor" aria-hidden="true">${(t.decor || []).slice(0, 4).map(e => `<span>${esc(e)}</span>`).join('')}</div><div class="wrap">
  ${back ? `<button class="backlink" data-act="${back.act}" ${back.attrs || ''}>← ${esc(back.label)}</button>` : ''}
  ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}<h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}
  ${code ? `<span class="codechip"><small>Join code</small>${esc(code)}</span>` : ''}</div></section>`;
}
function sticker(t, title, emoji, body, attrs) {
  return `<button class="ccard" ${attrs}><div class="cb" style="background:linear-gradient(120deg,${t.b1},${t.b2});--pat:${PATTERNS[t.pattern] || 'none'};--ink2:${inkFor(mixHex(t.b1, t.b2))}"><strong>${esc(title)}</strong><span class="em" aria-hidden="true">${esc(emoji || '')}</span></div><div class="cbody">${body}</div></button>`;
}
function themeOptions(sel, inherit) { return (inherit ? `<option value="" ${!sel ? 'selected' : ''}>Same as class</option>` : '') + allThemes().map(t => `<option value="${esc(t.id)}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join(''); }
function themeTile(th, on, attrs) { return `<button class="tp" aria-pressed="${on}" ${attrs}><div class="tb" style="background:linear-gradient(120deg,${th.b1},${th.b2});--pat:${PATTERNS[th.pattern] || 'none'}"><span>${esc((th.decor || []).slice(0, 2).join(' '))}</span></div><div class="tn"><span>${esc(th.name)}</span><span class="dot" style="background:${th.accent}"></span></div></button>`; }
function armBtn(key, label, confirmLabel) { const a = S.ui.armed === key; return `<button class="btn sm danger ${a ? 'armed' : ''}" data-act="arm" data-key="${esc(key)}">${a ? confirmLabel : label}</button>`; }

/* ---------------- setup / login / join ---------------- */
function setupView() {
  const t = THEMES[0];
  return { theme: t, html: banner(t, { eyebrow: 'Almost there', title: 'Hook up the database', sub: 'This site needs a free Supabase project to store classes, coins and files.' }) + `
  <main class="wrap"><div class="panel taped stack"><h2>Setup checklist</h2><ol class="steps">
   <li>Create a free project at <b>supabase.com</b>.</li>
   <li>In Supabase, open <b>SQL Editor</b>, paste everything from <code>supabase/setup.sql</code> and press <b>Run</b>.</li>
   <li>In <b>Authentication → Sign In / Providers</b>, turn on <b>Allow anonymous sign-ins</b>.</li>
   <li>Copy your <b>Project URL</b> and <b>publishable (anon) key</b> into <code>js/config.js</code> and commit it to GitHub.</li>
   <li>Reload this page, then go to <code>#teacher</code> to create your teacher login.</li></ol>
   <p class="muted small">The full guide with screenshots-worth of detail is in README.md.</p></div></main>` };
}
function teacherLogin() {
  const t = themeById(site().home_theme);
  return { theme: t, html: banner(t, { eyebrow: 'Staff only', title: 'Teacher sign in', back: { act: 'nav', attrs: 'data-to="home"', label: 'Student page' } }) + `
  <main class="wrap"><form class="panel taped stack" data-form="tlogin" style="max-width:520px">
   <label class="f">Email<input type="email" id="tl-email" autocomplete="username" required></label>
   <label class="f">Password<input type="password" id="tl-pass" autocomplete="current-password" minlength="8" required></label>
   ${S.ui.loginErr ? `<div class="alert small">${esc(S.ui.loginErr)}</div>` : ''}
   <div class="row"><button class="btn primary" ${S.ui.busy ? 'disabled' : ''}>Sign in</button><button type="button" class="btn" data-act="tsignup" ${S.ui.busy ? 'disabled' : ''}>Create teacher account</button></div>
   <p class="small muted">First time? Create your account, then follow the last step in README.md to mark it as the teacher. Passwords need at least 8 characters.</p>
  </form></main>` };
}
function pendingView() {
  const t = themeById(site().home_theme);
  return { theme: t, html: banner(t, { eyebrow: 'One more step', title: 'Activate your teacher account' }) + `
  <main class="wrap"><div class="panel taped stack"><p>You're signed in as <b>${esc(S.email)}</b>, but this account isn't marked as the teacher yet.</p>
  <p>In Supabase, open <b>SQL Editor</b>, run this one line, then press the button below:</p>
  <pre style="overflow-x:auto;margin:0"><code>insert into public.teachers (user_id) select id from auth.users where email = '${esc(S.email)}';</code></pre>
  <div class="row"><button class="btn primary" data-act="retry">I've done it, check again</button></div></div></main>` };
}
function den(eq, color, nickname) {
  const pet = item('pet', eq.pet), plant = item('plant', eq.plant), gear = item('gear', eq.gear);
  return `<div class="den" role="img" aria-label="Your character's hangout"><span class="tag" aria-hidden="true">${esc(nickname || 'skate skool')}</span><div class="poster" aria-hidden="true">⚡</div><div class="ramp"></div><div class="floor"></div><div class="crate"></div>
  ${plant ? `<span class="plant">${plant.emoji}</span>` : ''}${charSVG(eq, color, 'bob', 'Your character')}${gear ? `<span class="gear">${gear.emoji}</span>` : ''}${pet ? `<span class="pet bob">${pet.emoji}</span>` : ''}</div>`;
}
function joinView() {
  const st = site(), t = themeById(st.home_theme), mode = S.ui.joinMode, color = S.ui.color || COLORS[0];
  const fields = mode === 'new'
    ? `<label class="f">Class join code<input type="text" class="codeinput" id="jv-code" maxlength="6" autocomplete="off" required placeholder="ABC123"></label>
       <label class="f">Your skater name<input type="text" id="jv-nick" maxlength="20" required placeholder="e.g. Kickflip Kai"></label>
       <label class="f">Make a 4-number PIN (you'll need it on other devices)<input type="text" class="pininput" id="jv-pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required placeholder="••••"></label>
       <div class="stack" style="gap:6px"><span class="label">Pick your colour</span><div class="swatches">${COLORS.map(c => `<button type="button" class="swatch" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${c === color}" data-act="pickcolor" data-c="${c}"></button>`).join('')}</div></div>`
    : `<label class="f">Class join code<input type="text" class="codeinput" id="jv-code" maxlength="6" autocomplete="off" required placeholder="ABC123"></label>
       <label class="f">Your skater name<input type="text" id="jv-nick" maxlength="20" required></label>
       <label class="f">Your PIN<input type="text" class="pininput" id="jv-pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required></label>`;
  return { theme: t, html: banner(t, { eyebrow: st.teacher_name ? `${st.teacher_name}'s classroom` : 'Welcome, skater', title: st.site_name, sub: 'Grab the join code from your teacher, make your character, and start stacking coins.' }) + `
  <main class="wrap"><div class="hero"><form class="panel taped stack" data-form="join">
   <div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="${mode === 'new'}" data-act="joinmode" data-m="new">I'm new</button><button type="button" role="tab" aria-selected="${mode === 'back'}" data-act="joinmode" data-m="back">I've been here before</button></div>
   ${fields}
   ${S.ui.loginErr ? `<div class="alert small">${esc(S.ui.loginErr)}</div>` : ''}
   <div><button class="btn primary big" ${S.ui.busy ? 'disabled' : ''}>${S.ui.busy ? 'Hang on…' : mode === 'new' ? 'Drop in' : 'Log back in'}</button></div>
  </form>${den({ character: 'blob' }, color, 'new skater')}</div>
  <div class="footer"><button data-act="nav" data-to="teacherlogin">Teacher? Sign in here</button></div></main>` };
}

/* ---------------- resources ---------------- */
function ytId(u) { const m = String(u || '').match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/|live\/)([\w-]{11})/); return m ? m[1] : null; }
const OFFICE = /\.(docx?|pptx?|xlsx?)$/i;
function kindLabel(r) {
  if (r.kind === 'youtube') return 'VIDEO'; if (r.kind === 'link') return 'LINK'; if (r.kind === 'note') return 'NOTE';
  const t = r.content_type || '', p = r.storage_path || '';
  if (t.includes('pdf')) return 'PDF'; if (t.startsWith('image')) return 'IMAGE'; if (t.startsWith('video')) return 'VIDEO';
  if (/\.docx?$/i.test(p)) return 'WORD'; if (/\.pptx?$/i.test(p)) return 'SLIDES'; if (/\.xlsx?$/i.test(p)) return 'EXCEL'; return 'FILE';
}
function resCard(r, teacher) {
  let inner = ''; const t = r.content_type || '';
  if (r.kind === 'youtube') { const id = ytId(r.url); inner = `<div class="ytframe"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="${esc(r.title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div><a class="small" href="${esc(r.url)}" target="_blank" rel="noopener">Open on YouTube ↗</a>`; }
  else if (r.kind === 'link') inner = `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="btn sm" style="align-self:flex-start;max-width:100%;overflow:hidden;text-overflow:ellipsis">Open link ↗</a><span class="small muted" style="overflow-wrap:anywhere">${esc(r.url)}</span>`;
  else if (r.kind === 'note') inner = `<p class="note">${esc(r.note)}</p>`;
  else {
    const office = OFFICE.test(r.storage_path || '');
    if (t.startsWith('image')) inner = `<img class="prev" src="${esc(r.url)}" alt="${esc(r.title)}" loading="lazy">`;
    else if (t.startsWith('video')) inner = `<video controls preload="metadata" src="${esc(r.url)}"></video>`;
    const viewUrl = office ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(r.url)}` : r.url;
    inner += `<div class="row"><a class="btn sm" href="${esc(viewUrl)}" target="_blank" rel="noopener">Open ↗</a>${office ? `<a class="btn sm" href="${esc(r.url)}" target="_blank" rel="noopener" download>Download</a>` : ''}<span class="small muted">${fmtSize(r.size_bytes)}</span></div>`;
    if (t.includes('pdf')) inner += `<details id="pv-${r.id}"><summary>Preview here</summary><iframe class="doc" src="${esc(r.url)}" title="${esc(r.title)}" loading="lazy"></iframe></details>`;
    if (office) inner += `<details id="pv-${r.id}"><summary>Preview here</summary><iframe class="doc" src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(r.url)}" title="${esc(r.title)}" loading="lazy"></iframe></details>`;
  }
  const tools = teacher ? `<div class="row" style="gap:6px;flex:none"><button class="iconbtn" data-act="resmove" data-id="${r.id}" data-dir="-1" aria-label="Move up">↑</button><button class="iconbtn" data-act="resmove" data-id="${r.id}" data-dir="1" aria-label="Move down">↓</button>${armBtn('res|' + r.id, 'Remove', 'Confirm')}</div>` : '';
  return `<article class="res"><span class="chip kind">${kindLabel(r)}</span><div class="body"><strong>${esc(r.title)}</strong>${r.description ? `<p class="small muted">${esc(r.description)}</p>` : ''}${inner}</div>${tools}</article>`;
}

/* ---------------- TEACHER ---------------- */
function tHome() {
  const st = site(), t = themeById(st.home_theme), cls = S.classes.slice().sort(byOrder);
  const cards = cls.map(c => { const ct = classTheme(c); return sticker(ct, c.name, (ct.decor || [])[0], `<span class="small muted">${esc(c.subtitle || '')}</span><div class="row" style="gap:6px"><span class="chip">Code ${esc(c.code)}</span><span class="chip">${studentsIn(c.id).length} skaters</span><span class="chip">${unitsOf(c.id).length} units</span></div>`, `data-act="openclass" data-id="${c.id}"`); }).join('');
  return { theme: t, html: banner(t, { eyebrow: st.teacher_name ? `${st.teacher_name}'s HQ` : 'Teacher HQ', title: 'Your classes', sub: 'Make a class, hand out its join code, then load each unit with notes, files, videos and revision quizzes.' }) + `
  <main class="wrap">
   ${cls.length ? `<div class="grid">${cards}</div>` : `<div class="empty"><strong>No classes yet</strong><span>Make your first one below. Each class gets its own join code.</span></div>`}
   <form class="panel taped stack" data-form="newclass"><h2>New class</h2>
    <div class="formrow"><label class="f">Class name<input type="text" id="nc-name" required placeholder="e.g. Year 9 Science"></label>
    <label class="f">Short description<input type="text" id="nc-sub" placeholder="e.g. Period 3 · Room S4"></label>
    <label class="f">Theme<select id="nc-theme">${themeOptions('griptape')}</select></label>
    <button class="btn primary">Create class</button></div></form>
  </main>` };
}
function tClass() {
  const c = S.classes.find(x => x.id === S.view.classId); if (!c) return tHome();
  const t = classTheme(c), tab = S.ui.tab;
  const tabs = [['units', 'Units'], ['revision', 'Revision quizzes'], ['students', 'Skaters'], ['settings', 'Class settings']];
  let body = '';
  if (tab === 'units') {
    const us = unitsOf(c.id);
    body = `${us.length ? `<div class="stack">${us.map(u => { const ut = unitTheme(u); return `<div class="row" style="flex-wrap:nowrap;gap:8px"><button class="unitcard" data-act="openunit" data-id="${u.id}"><span class="sw" style="background:linear-gradient(120deg,${ut.b1},${ut.b2})" aria-hidden="true">${esc((ut.decor || [])[0] || '')}</span><span class="txt"><strong>${esc(u.title)}</strong><span class="small muted">${resOf(u.id).length} resources · ${S.quizzes.filter(x => x.unit_id === u.id).length} quizzes · ${esc(ut.name)}</span></span>${u.hidden ? '<span class="chip warn">Hidden</span>' : ''}</button><div class="stack" style="gap:4px"><button class="iconbtn" data-act="unitmove" data-id="${u.id}" data-dir="-1" aria-label="Move up">↑</button><button class="iconbtn" data-act="unitmove" data-id="${u.id}" data-dir="1" aria-label="Move down">↓</button></div></div>`; }).join('')}</div>` : `<div class="empty"><strong>No units yet</strong><span>Add your first unit of work. Each unit can rock its own theme.</span></div>`}
    <form class="panel stack" data-form="newunit"><h3>Add a unit</h3><div class="formrow"><label class="f">Unit title<input type="text" id="nu-title-${c.id}" required placeholder="e.g. Unit 2: Chemical reactions"></label><label class="f">Theme<select id="nu-theme-${c.id}">${themeOptions('', true)}</select></label><button class="btn primary">Add unit</button></div></form>`;
  } else if (tab === 'revision') {
    const qs = S.quizzes.filter(x => x.class_id === c.id).sort(byOrder);
    body = `<div class="section-h"><p class="muted">Skaters earn coins for each correct answer, once per quiz per day.</p><button class="btn primary" data-act="newquiz" data-class="${c.id}">New quiz</button></div>
    ${qs.length ? `<div class="stack">${qs.map(x => { const u = S.units.find(y => y.id === x.unit_id); return `<div class="res"><span class="chip kind">QUIZ</span><div class="body"><strong>${esc(x.title)}</strong><span class="small muted">${(x.questions || []).length} questions · ${x.per} coins per correct answer${u ? ' · ' + esc(u.title) : ''}</span></div><div class="row" style="gap:6px"><button class="btn sm" data-act="editquiz" data-id="${x.id}">Edit</button>${armBtn('quiz|' + x.id, 'Delete', 'Confirm')}</div></div>`; }).join('')}</div>` : `<div class="empty"><strong>No quizzes yet</strong><span>Quizzes are how skaters earn coins from revision.</span></div>`}`;
  } else if (tab === 'students') {
    const st = studentsIn(c.id).sort((a, b) => b.earned - a.earned);
    body = st.length ? `<div class="panel"><div class="tablewrap"><table><thead><tr><th>Skater</th><th></th><th>Coins</th><th>Earned</th><th>Focus</th><th>Quizzes</th><th>Give coins</th><th>Reset PIN</th><th></th></tr></thead><tbody>${st.map(s => `<tr>
     <td><b>${esc(s.nickname)}</b></td><td>${charSVG(eqOf(s), s.color)}</td><td class="num">${balance(s)}</td><td class="num">${s.earned}</td><td class="num">${s.focus_min} min</td><td class="num">${s.quizzes_done}</td>
     <td><div class="row" style="gap:4px;flex-wrap:nowrap"><input type="number" id="aw-${s.id}" value="10" style="width:80px" aria-label="Coins to give ${esc(s.nickname)}"><button class="btn sm coinbtn" data-act="award" data-id="${s.id}">Give</button></div></td>
     <td><div class="row" style="gap:4px;flex-wrap:nowrap"><input type="text" id="rp-${s.id}" maxlength="4" inputmode="numeric" placeholder="0000" style="width:80px" aria-label="New PIN for ${esc(s.nickname)}"><button class="btn sm" data-act="resetpin" data-id="${s.id}">Set</button></div></td>
     <td><div class="row" style="gap:4px;flex-wrap:nowrap">${armBtn('kick|' + s.id + '|' + c.id, 'Remove', 'Confirm')}</div></td></tr>`).join('')}</tbody></table></div></div>
     <p class="small muted">Type a negative number to take coins back. "Remove" takes the skater out of this class only; they keep their coins and gear. A skater who forgets their PIN can be given a new one here.</p>`
      : `<div class="empty"><strong>No skaters yet</strong><span>Give your class the website link and the join code <b>${esc(c.code)}</b>.</span></div>`;
  } else {
    body = `<form class="panel stack" data-form="classset" data-id="${c.id}"><h3>Class details</h3>
    <div class="formrow"><label class="f">Class name<input type="text" id="cs-name-${c.id}" value="${esc(c.name)}" required></label><label class="f">Short description<input type="text" id="cs-sub-${c.id}" value="${esc(c.subtitle || '')}"></label></div>
    <label class="f">Announcement (shown at the top of the class page)<textarea id="cs-ann-${c.id}" placeholder="e.g. Test on Friday! Revise unit 2.">${esc(c.announcement || '')}</textarea></label>
    <div><button class="btn primary">Save changes</button></div></form>
    <div class="panel stack"><h3>Class theme</h3><div class="themepick">${allThemes().map(th => themeTile(th, (c.theme_id || 'griptape') === th.id, `data-act="setclasstheme" data-id="${c.id}" data-theme="${esc(th.id)}"`)).join('')}</div></div>
    <div class="panel stack"><h3>Join code</h3><div class="row"><span style="font-family:var(--f-display);font-size:36px;letter-spacing:.15em">${esc(c.code)}</span><button class="btn" data-act="copy" data-text="${esc(c.code)}">Copy</button><button class="btn" data-act="newcode" data-id="${c.id}">Make a new code</button></div><p class="small muted">A new code stops the old one working. Skaters already in the class stay in it.</p></div>
    <div class="panel stack"><h3>Delete class</h3><p class="small muted">Deletes the class with all its units, resources, uploaded files and quizzes. Skaters keep their coins and gear.</p><div>${armBtn('class|' + c.id, 'Delete this class', 'Yes, delete everything')}</div></div>`;
  }
  return { theme: t, html: banner(t, { eyebrow: c.subtitle || 'Class', title: c.name, back: { act: 'nav', attrs: 'data-to="home"', label: 'All classes' }, code: c.code }) + `<main class="wrap"><div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</div>${c.announcement && tab === 'units' ? `<div class="notice"><b>Announcement:</b> ${esc(c.announcement)}</div>` : ''}${body}</main>` };
}
function tUnit() {
  const u = S.units.find(x => x.id === S.view.unitId); if (!u) return tHome();
  const c = S.classes.find(x => x.id === u.class_id), t = unitTheme(u), rs = resOf(u.id), k = S.ui.resKind, qs = S.quizzes.filter(x => x.unit_id === u.id);
  const fields = k === 'file' ? `<label class="f">File<input type="file" id="nr-file"></label>`
    : k === 'note' ? `<label class="f" style="flex-basis:100%">Note<textarea id="nr-note-${u.id}" placeholder="Key ideas, instructions, homework…"></textarea></label>`
    : `<label class="f">${k === 'youtube' ? 'YouTube link' : 'Web address'}<input type="url" id="nr-url-${u.id}" placeholder="${k === 'youtube' ? 'https://www.youtube.com/watch?v=…' : 'https://…'}"></label>`;
  return { theme: t, html: banner(t, { eyebrow: c ? c.name : 'Unit', title: u.title, sub: u.description || '', back: { act: 'openclass', attrs: `data-id="${u.class_id}"`, label: 'Back to class' } }) + `
  <main class="wrap"><div class="split"><div class="stack">
   <div class="section-h"><h2>Resources</h2>${u.hidden ? '<span class="chip warn">Hidden from skaters</span>' : '<span class="chip ok">Visible to skaters</span>'}</div>
   ${rs.length ? rs.map(r => resCard(r, true)).join('') : `<div class="empty"><strong>Nothing here yet</strong><span>Upload a file, add a YouTube video or a link, or write a note.</span></div>`}
   <form class="panel taped stack" data-form="newres" data-id="${u.id}"><h3>Add a resource</h3>
    <div class="row">${[['file', 'Upload file'], ['youtube', 'YouTube video'], ['link', 'Link'], ['note', 'Note']].map(([v, l]) => `<button type="button" class="btn sm ${k === v ? 'primary' : ''}" data-act="reskind" data-kind="${v}" aria-pressed="${k === v}">${l}</button>`).join('')}</div>
    <div class="formrow"><label class="f">Title<input type="text" id="nr-title-${u.id}" placeholder="${k === 'file' ? 'Uses the file name if left blank' : 'e.g. Revision video: balancing equations'}"></label>${fields}</div>
    <label class="f">Short description (optional)<input type="text" id="nr-desc-${u.id}"></label>
    ${k === 'file' ? `<p class="small muted">PDF, Word, PowerPoint, Excel, images and videos up to 50 MB.</p>` : ''}
    <div><button class="btn primary" ${S.ui.busy ? 'disabled' : ''}>${S.ui.busy ? 'Uploading…' : 'Add resource'}</button></div></form>
  </div><div class="stack">
   <div class="panel stack"><h3>Revision quizzes</h3>${qs.length ? qs.map(x => `<div class="row between"><span>${esc(x.title)}<br><span class="small muted">${(x.questions || []).length} questions</span></span><button class="btn sm" data-act="editquiz" data-id="${x.id}">Edit</button></div>`).join('') : '<p class="small muted">No quizzes for this unit yet.</p>'}<div><button class="btn primary sm" data-act="newquiz" data-class="${u.class_id}" data-unit="${u.id}">New quiz for this unit</button></div></div>
   <form class="panel stack" data-form="unitset" data-id="${u.id}"><h3>Unit settings</h3>
    <label class="f">Title<input type="text" id="us-title-${u.id}" value="${esc(u.title)}" required></label>
    <label class="f">Description<textarea id="us-desc-${u.id}">${esc(u.description || '')}</textarea></label>
    <label class="f">Theme<select id="us-theme-${u.id}">${themeOptions(u.theme_id || '', true)}</select></label>
    <label class="row small" style="gap:8px;font-weight:700"><input type="checkbox" id="us-hidden-${u.id}" ${u.hidden ? 'checked' : ''}> Hide from skaters</label>
    <div class="row"><button class="btn primary">Save unit</button>${armBtn('unit|' + u.id, 'Delete unit', 'Confirm delete')}</div></form>
  </div></div></main>` };
}
const blankQ = () => ({ q: '', options: ['', '', '', ''], answer: 0 });
function tQuizEdit() {
  const d = S.quizDraft; if (!d) return tHome();
  const c = S.classes.find(x => x.id === d.class_id), t = classTheme(c), us = unitsOf(d.class_id);
  return { theme: t, html: banner(t, { eyebrow: c?.name || '', title: d.id ? 'Edit quiz' : 'New quiz', back: { act: 'openclass', attrs: `data-id="${d.class_id}" data-tab="revision"`, label: 'Back to class' } }) + `
  <main class="wrap qeditor"><div class="panel stack"><div class="formrow">
   <label class="f">Quiz title<input type="text" id="qz-title" data-bind="title" value="${esc(d.title)}" placeholder="e.g. Atoms quick check"></label>
   <label class="f">Unit<select id="qz-unit" data-bind="unit_id"><option value="">Whole class</option>${us.map(u => `<option value="${u.id}" ${d.unit_id === u.id ? 'selected' : ''}>${esc(u.title)}</option>`).join('')}</select></label>
   <label class="f" style="flex:0 1 170px">Coins per correct answer<input type="number" min="0" max="50" id="qz-per" data-bind="per" value="${d.per}"></label></div></div>
   ${d.questions.map((qq, i) => `<div class="q"><div class="row between"><h3>Question ${i + 1}</h3><button class="btn sm danger" data-act="qdel" data-i="${i}" ${d.questions.length < 2 ? 'disabled' : ''}>Remove</button></div>
    <input type="text" id="qz-q-${i}" data-qi="${i}" value="${esc(qq.q)}" placeholder="Type the question">
    ${qq.options.map((o, j) => `<div class="o"><input type="radio" name="ans-${i}" id="qz-a-${i}-${j}" data-ai="${i}" data-aj="${j}" ${qq.answer === j ? 'checked' : ''} aria-label="Option ${j + 1} is correct"><input type="text" id="qz-o-${i}-${j}" data-oi="${i}" data-oj="${j}" value="${esc(o)}" placeholder="Option ${j + 1}${j < 2 ? '' : ' (optional)'}"></div>`).join('')}
    <span class="small muted">Tick the circle beside the correct answer.</span></div>`).join('')}
   <div class="row"><button class="btn" data-act="qadd">Add question</button></div>
   <details class="panel" id="bulk"><summary>Paste lots of questions at once</summary><div class="stack" style="margin-top:12px"><p class="small muted">One question per block. Start the question with <b>Q:</b>, put <b>*</b> before the correct answer and <b>-</b> before wrong answers.</p>
    <textarea id="qz-bulk" style="min-height:160px;font-family:ui-monospace,monospace" placeholder="Q: What is the chemical symbol for sodium?&#10;* Na&#10;- So&#10;- S&#10;- Sd"></textarea><div><button class="btn" data-act="qbulk">Add these questions</button></div></div></details>
   <div class="row"><button class="btn primary big" data-act="qsave" ${S.ui.busy ? 'disabled' : ''}>Save quiz</button><button class="btn" data-act="openclass" data-id="${d.class_id}" data-tab="revision">Cancel</button></div>
  </main>` };
}
function tThemes() {
  const d = S.customDraft || (S.customDraft = { name: '', accent: '#FFE14D', b1: '#2B59FF', b2: '#FF2E88', pattern: 'halftone', decor: '🛹 ⚡ 🎸' });
  const prev = { ...d, decor: d.decor.split(/\s+/).filter(Boolean) }, t = themeById(site().home_theme);
  return { theme: t, html: banner(t, { eyebrow: 'Look & feel', title: 'Themes', sub: 'Choose a theme for each class or unit from its settings. Make your own here.' }) + `
  <main class="wrap">
   <div class="stack"><h2>Built-in themes</h2><div class="themepick">${THEMES.map(th => themeTile(th, false, 'tabindex="-1" style="cursor:default"')).join('')}</div></div>
   <div class="stack"><h2>Your themes</h2>${S.themes.length ? `<div class="themepick">${S.themes.map(th => `<div class="stack" style="gap:8px">${themeTile(th, S.customDraft?.id === th.id, `data-act="edittheme" data-id="${th.id}"`)}<div>${armBtn('theme|' + th.id, 'Delete', 'Confirm')}</div></div>`).join('')}</div>` : '<p class="muted">No custom themes yet. Tap one to edit it once you have some.</p>'}</div>
   <form class="panel taped stack" data-form="savetheme"><h2>${d.id ? 'Edit theme' : 'Make a theme'}</h2>
    <section class="banner" style="${themeVars(prev)}"><div class="decor" aria-hidden="true">${prev.decor.slice(0, 4).map(e => `<span>${esc(e)}</span>`).join('')}</div><div class="wrap" style="padding-block:22px"><span class="eyebrow">Preview</span><h2 style="font-size:32px">${esc(d.name || 'My theme')}</h2><span><span class="btn sm primary" style="pointer-events:none">Button colour</span></span></div></section>
    <div class="formrow"><label class="f">Theme name<input type="text" id="th-name" data-tb="name" value="${esc(d.name)}" required placeholder="e.g. Bowl Session"></label>
    <label class="f">Decorations (emoji with spaces between)<input type="text" id="th-decor" data-tb="decor" value="${esc(d.decor)}"></label>
    <label class="f" style="flex:0 1 160px">Pattern<select id="th-pattern" data-tb="pattern">${Object.keys(PATTERNS).map(p => `<option ${d.pattern === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>
    <div class="row"><label class="row small" style="gap:6px;font-weight:700"><input type="color" id="th-b1" data-tb="b1" value="${d.b1}"> Banner colour 1</label><label class="row small" style="gap:6px;font-weight:700"><input type="color" id="th-b2" data-tb="b2" value="${d.b2}"> Banner colour 2</label><label class="row small" style="gap:6px;font-weight:700"><input type="color" id="th-accent" data-tb="accent" value="${d.accent}"> Button colour</label></div>
    <div class="row"><button class="btn primary">${d.id ? 'Save changes' : 'Save theme'}</button>${d.id ? '<button type="button" class="btn" data-act="newthemedraft">Start a new theme</button>' : ''}</div></form>
  </main>` };
}
function tSettings() {
  const st = site(), t = themeById(st.home_theme);
  return { theme: t, html: banner(t, { eyebrow: 'Settings', title: 'Classroom settings' }) + `
  <main class="wrap"><form class="panel taped stack" data-form="site"><h2>Your site</h2>
   <div class="formrow"><label class="f">Website name<input type="text" id="st-name" value="${esc(st.site_name)}"></label><label class="f">Your name as skaters see it<input type="text" id="st-teacher" value="${esc(st.teacher_name)}" placeholder="e.g. Mr T"></label><label class="f">Home page theme<select id="st-theme">${themeOptions(st.home_theme)}</select></label></div>
   <h3>Coin rules</h3>
   <div class="formrow"><label class="f">Coins per focus minute<input type="number" min="0" max="10" id="st-rate" value="${st.focus_rate}"></label><label class="f">Daily focus coin limit<input type="number" min="0" id="st-fcap" value="${st.focus_cap}"></label><label class="f">Daily quiz coin limit<input type="number" min="0" id="st-qcap" value="${st.quiz_cap}"></label><label class="f">Welcome bonus<input type="number" min="0" id="st-welcome" value="${st.welcome}"></label></div>
   <div><button class="btn primary">Save settings</button></div></form>
   <div class="panel stack"><h2>Shop prices</h2><p>Change any price or name in Supabase under <b>Table Editor → shop_items</b>. Changes show up next time the page loads.</p></div>
  </main>` };
}

/* ---------------- STUDENT ---------------- */
const myClasses = () => S.classes.slice().sort(byOrder);
const homeTheme = () => { const mc = myClasses(); return mc.length ? classTheme(mc[0]) : themeById(site().home_theme); };
function attemptsFor(qid) { return S.attempts.filter(a => a.quiz_id === qid); }
function collectedToday(qid) { const m = midnight(); return attemptsFor(qid).some(a => a.coins > 0 && new Date(a.created_at).getTime() >= m); }
function sHome() {
  const s = S.me, t = homeTheme(), mc = myClasses();
  return { theme: t, html: banner(t, { eyebrow: site().site_name, title: `Yo, ${s.nickname}!`, sub: 'Earn coins with focus sessions and revision quizzes, then spend them in the shop.' }) + `
  <main class="wrap"><div class="hero">${den(eqOf(s), s.color, s.nickname)}
   <div class="stack"><div class="row"><div class="stat"><b><span class="coin"></span>${balance(s)}</b><span>Coins to spend</span></div><div class="stat"><b>${s.focus_min}</b><span>Focus minutes</span></div><div class="stat"><b>${s.quizzes_done}</b><span>Quizzes done</span></div></div>
   <div class="row"><button class="btn primary" data-act="nav" data-to="focus">Start a focus session</button><button class="btn coinbtn" data-act="nav" data-to="shop">Hit the shop</button><button class="btn" data-act="nav" data-to="den">Customise</button></div></div></div>
   <h2>My classes</h2>
   ${mc.length ? `<div class="grid">${mc.map(c => { const ct = classTheme(c); return sticker(ct, c.name, (ct.decor || [])[0], `<span class="small muted">${esc(c.subtitle || '')}</span>${c.announcement ? `<span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📣 ${esc(c.announcement)}</span>` : ''}`, `data-act="openclass" data-id="${c.id}"`); }).join('')}</div>` : `<div class="empty">You're not in any classes right now. Add one with a join code below.</div>`}
   <div class="split"><form class="panel stack" data-form="joinmore"><h3>Join another class</h3><div class="formrow"><label class="f">Join code<input type="text" id="jm-code" maxlength="6" autocomplete="off" style="text-transform:uppercase;letter-spacing:.2em" placeholder="ABC123" required></label><button class="btn primary">Join</button></div></form>
   <div class="panel stack"><h3>Recent coins</h3>${S.log.length ? S.log.slice(0, 8).map(l => `<div class="row between small"><span>${esc(l.reason)}</span><b style="color:${l.amount < 0 ? 'var(--bad)' : 'var(--good)'}">${l.amount > 0 ? '+' : ''}${l.amount}</b></div>`).join('') : '<p class="small muted">Nothing yet.</p>'}</div></div>
  </main>` };
}
function quizList(qs) {
  return qs.length ? `<div class="stack">${qs.map(x => { const at = attemptsFor(x.id), best = at.length ? Math.max(...at.map(a => a.score)) : null, n = (x.questions || []).length, done = collectedToday(x.id);
    return `<div class="res"><span class="chip kind">QUIZ</span><div class="body"><strong>${esc(x.title)}</strong><span class="small muted">${n} questions · ${done ? 'Coins collected today. Come back tomorrow for more.' : `up to ${n * x.per + (n >= 3 ? 5 : 0)} coins`}${best != null ? ` · best ${best}/${n}` : ''}</span></div><div class="row" style="gap:6px"><button class="btn sm" data-act="startquiz" data-id="${x.id}" data-mode="cards">Flashcards</button><button class="btn sm primary" data-act="startquiz" data-id="${x.id}" data-mode="quiz">Start</button></div></div>`; }).join('')}</div>` : '<p class="muted">No quizzes yet.</p>';
}
function sClass() {
  const c = S.classes.find(x => x.id === S.view.classId); if (!c) return sHome();
  const t = classTheme(c), us = unitsOf(c.id), qs = S.quizzes.filter(x => x.class_id === c.id).sort(byOrder), board = S.board[c.id];
  return { theme: t, html: banner(t, { eyebrow: c.subtitle || 'Class', title: c.name, back: { act: 'nav', attrs: 'data-to="home"', label: 'Home' } }) + `
  <main class="wrap">${c.announcement ? `<div class="notice"><b>Announcement:</b> ${esc(c.announcement)}</div>` : ''}
  <div class="split"><div class="stack"><h2>Units</h2>${us.length ? us.map(u => { const ut = unitTheme(u); return `<button class="unitcard" data-act="openunit" data-id="${u.id}"><span class="sw" style="background:linear-gradient(120deg,${ut.b1},${ut.b2})" aria-hidden="true">${esc((ut.decor || [])[0] || '')}</span><span class="txt"><strong>${esc(u.title)}</strong><span class="small muted">${resOf(u.id).length} resources${S.quizzes.some(x => x.unit_id === u.id) ? ' · revision quiz' : ''}</span></span><span aria-hidden="true" style="font-size:22px">→</span></button>`; }).join('') : "<div class=\"empty\">Your teacher hasn't added any units yet.</div>"}
   <h2 style="margin-top:10px">Revision quizzes</h2>${quizList(qs)}</div>
   <div class="panel taped stack"><h3>Class leaderboard</h3><p class="small muted">Ranked by total coins earned.</p><div class="lb">${board ? (board.map((b, i) => `<div class="r ${b.is_me ? 'me' : ''}"><span class="rank">${i + 1}</span>${charSVG(b.equipped || {}, b.color)}<span class="n">${esc(b.nickname)}</span><span class="price"><span class="coin"></span>${b.lifetime}</span></div>`).join('') || '<p class="small muted">No one yet.</p>') : '<p class="small muted">Loading…</p>'}</div></div></div></main>` };
}
function sUnit() {
  const u = S.units.find(x => x.id === S.view.unitId); if (!u) return sHome();
  const c = S.classes.find(x => x.id === u.class_id), t = unitTheme(u), rs = resOf(u.id), qs = S.quizzes.filter(x => x.unit_id === u.id);
  return { theme: t, html: banner(t, { eyebrow: c?.name || '', title: u.title, sub: u.description || '', back: { act: 'openclass', attrs: `data-id="${u.class_id}"`, label: c?.name || 'Back' } }) + `
  <main class="wrap"><div class="split"><div class="stack"><h2>Resources</h2>${rs.length ? rs.map(r => resCard(r, false)).join('') : '<div class="empty">No resources in this unit yet.</div>'}</div>
  <div class="stack"><div class="panel taped stack"><h3>Revise this unit</h3>${quizList(qs)}<button class="btn" data-act="focusfor" data-class="${u.class_id}" data-label="${esc(u.title)}">Start a focus session</button></div></div></div></main>` };
}
function remaining() { const f = S.focus; return f ? Math.max(0, f.minutes * 60 - Math.floor((Date.now() - f.startedAt) / 1000)) : 0; }
function sFocus() {
  const s = S.me, st = site(), t = homeTheme(), f = S.focus;
  if (S.celebrate) return { theme: t, html: `<main class="wrap"><div class="panel taped celebrate"><span class="stamp">${esc(S.celebrate.title)}</span><div class="big"><span class="coin"></span>+${S.celebrate.coins}</div><p class="muted">${esc(S.celebrate.msg)}</p>${charSVG(eqOf(s), s.color, 'bob')}<div class="row" style="justify-content:center"><button class="btn primary" data-act="closecele">Done</button><button class="btn coinbtn" data-act="nav" data-to="shop">Hit the shop</button></div></div></main>` };
  let body;
  if (f) {
    const total = f.minutes * 60, rem = remaining(), C = 2 * Math.PI * 88;
    body = `<div class="timerwrap"><p class="label">${esc(f.label || 'Focus session')}</p><div class="ring"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="88" fill="none" stroke="var(--card-2)" stroke-width="16"/><circle id="ringarc" cx="100" cy="100" r="88" fill="none" stroke="var(--accent)" stroke-width="16" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - rem / total)).toFixed(1)}"/><circle cx="100" cy="100" r="96" fill="none" stroke="var(--edge)" stroke-width="3"/><circle cx="100" cy="100" r="80" fill="none" stroke="var(--edge)" stroke-width="3"/></svg><div class="t" id="bigtimer">${f.finishing ? '…' : fmtT(rem)}</div></div>
    <p class="small muted" style="max-width:44ch;text-align:center">Keep this page open until the timer ends. Phones away, one task, full send.</p>${armBtn('giveup', 'Bail early (no coins)', 'Yes, stop the session')}</div>`;
  } else {
    const sel = S.ui.focusMin, mc = myClasses();
    body = `<div class="timerwrap"><h2>How long are you riding?</h2><div class="durations">${[10, 15, 25, 40].map(m => `<button data-act="fmin" data-m="${m}" aria-pressed="${m === sel}"><b>${m}</b><span class="small">min · ${m * st.focus_rate} coins</span></button>`).join('')}</div>
    <div class="formrow" style="max-width:580px;width:100%"><label class="f">What are you working on?<input type="text" id="fx-label" maxlength="120" placeholder="e.g. Unit 2 summary notes" value="${esc(S.ui.focusLabel)}"></label><label class="f">Class<select id="fx-class"><option value="">—</option>${mc.map(c => `<option value="${c.id}" ${S.ui.focusClass === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label></div>
    <button class="btn primary big" data-act="fstart" ${S.ui.busy ? 'disabled' : ''}>Start focusing</button>
    <p class="small muted">Up to ${st.focus_cap} focus coins a day.</p></div>`;
  }
  return { theme: t, html: banner(t, { eyebrow: 'Study', title: 'Focus session', sub: 'Pick one task and grind until the timer runs out.' }) + `<main class="wrap"><div class="panel">${body}</div></main>` };
}
function sShop() {
  const s = S.me, t = homeTheme(), tab = S.ui.shopTab, eq = eqOf(s), bal = balance(s);
  const SHOP_TABS = [['character', 'Characters'], ['acc', 'Accessories'], ['pet', 'Pets'], ['plant', 'Plants'], ['gear', 'Gear']];
  const slots = tab === 'acc' ? ['hat', 'eyes', 'neck'] : [tab];
  const tile = it => {
    const slot = it.slot, own = owns(s, slot, it.id), on = eq[slot] === it.id;
    const art = it.emoji ? it.emoji : charSVG(slot === 'character' ? { character: it.id } : { character: eq.character, [slot]: it.id }, s.color);
    const btn = own ? (on ? (slot === 'character' ? `<button class="btn sm" disabled>Wearing</button>` : `<button class="btn sm" data-act="equip" data-slot="${slot}" data-id="">Take off</button>`) : `<button class="btn sm primary" data-act="equip" data-slot="${slot}" data-id="${esc(it.id)}">Use</button>`)
      : `<button class="btn sm coinbtn" data-act="buy" data-slot="${slot}" data-id="${esc(it.id)}" ${bal < it.price || S.ui.busy ? 'disabled' : ''}><span class="coin"></span>${it.price}</button>`;
    return `<div class="item ${on ? 'on' : ''}"><div class="art">${art}</div><strong>${esc(it.name)}</strong><span class="small muted">${own ? 'Owned' : bal < it.price ? `Need ${it.price - bal} more` : 'Ready to buy'}</span>${btn}</div>`;
  };
  return { theme: t, html: banner(t, { eyebrow: 'Spend your coins', title: 'The shop', sub: 'Characters, headgear, pets, plants and gear for your hangout.' }) + `
  <main class="wrap"><div class="row between"><div class="tabs" role="tablist">${SHOP_TABS.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-act="shoptab" data-tab="${k}">${l}</button>`).join('')}</div><span class="coins"><span class="coin"></span>${bal}</span></div>
  ${slots.map(sl => `${slots.length > 1 ? `<h3>${SLOT_LABELS[sl]}</h3>` : ''}<div class="shopgrid">${shopSlot(sl).map(tile).join('') || '<p class="muted">Nothing in stock.</p>'}</div>`).join('')}</main>` };
}
function sDen() {
  const s = S.me, t = homeTheme(), eq = eqOf(s);
  const pick = (slot, label) => { const list = shopSlot(slot).filter(it => owns(s, slot, it.id));
    return `<div class="stack" style="gap:6px"><span class="label">${label}</span><div class="row" style="gap:6px">${slot !== 'character' ? `<button class="btn sm ${!eq[slot] ? 'primary' : ''}" data-act="equip" data-slot="${slot}" data-id="">None</button>` : ''}${list.map(it => `<button class="btn sm ${eq[slot] === it.id ? 'primary' : ''}" data-act="equip" data-slot="${slot}" data-id="${esc(it.id)}">${it.emoji ? it.emoji + ' ' : ''}${esc(it.name)}</button>`).join('')}${!list.length ? '<span class="small muted">None yet. Grab some in the shop.</span>' : ''}</div></div>`; };
  return { theme: t, html: banner(t, { eyebrow: 'Your hangout', title: s.nickname, sub: 'Change your colour and pick what to rock. Everything you own lives here.' }) + `
  <main class="wrap"><div class="hero">${den(eq, s.color, s.nickname)}<div class="panel stack">
   <form class="formrow" data-form="nick"><label class="f">Skater name<input type="text" id="dn-nick" maxlength="20" value="${esc(s.nickname)}"></label><button class="btn">Rename</button></form>
   <div class="stack" style="gap:6px"><span class="label">Colour</span><div class="swatches">${COLORS.map(c => `<button class="swatch" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${s.color === c}" data-act="equip" data-slot="color" data-id="${c}"></button>`).join('')}</div></div>
   ${pick('character', 'Character')}${pick('hat', 'Headgear')}${pick('eyes', 'Eyewear')}${pick('neck', 'Neckwear')}${pick('pet', 'Pet')}${pick('plant', 'Plant')}${pick('gear', 'Gear')}
  </div></div>
  <div class="panel stack"><h3>Log out</h3><p class="small muted">To get back in, you'll need your class code, your skater name <b>${esc(s.nickname)}</b> and your PIN. If you forget your PIN, your teacher can reset it.</p><div>${armBtn('logout', 'Log out on this device', 'Yes, log me out')}</div></div></main>` };
}
function sQuiz() {
  const r = S.quizRun, qz = S.quizzes.find(x => x.id === r?.qid); if (!qz) return sHome();
  const u = S.units.find(x => x.id === qz.unit_id), c = S.classes.find(x => x.id === qz.class_id), t = u ? unitTheme(u) : classTheme(c), qs = qz.questions || [];
  const back = { act: u ? 'openunit' : 'openclass', attrs: `data-id="${u ? u.id : qz.class_id}"`, label: 'Leave quiz' };
  let body;
  if (r.mode === 'cards') {
    const cur = qs[r.i];
    body = `<div class="qcard stack"><div class="row between label"><span>Card ${r.i + 1} of ${qs.length}</span><span>Tap to flip</span></div>
    <button class="flash ${r.flipped ? 'back' : ''}" data-act="flip"><span>${r.flipped ? `<span class="label">Answer</span><br>${esc(cur.options[cur.answer])}` : esc(cur.q)}</span></button>
    <div class="row between"><button class="btn" data-act="card" data-d="-1" ${r.i === 0 ? 'disabled' : ''}>← Back</button><button class="btn primary" data-act="startquiz" data-id="${qz.id}" data-mode="quiz">Take the quiz</button><button class="btn" data-act="card" data-d="1" ${r.i >= qs.length - 1 ? 'disabled' : ''}>Next →</button></div></div>`;
  } else if (r.done) {
    const res = r.result;
    const note = !res ? 'Counting your coins…' : res.note === 'already' ? 'You already collected coins for this quiz today. Practice still counts!' : res.note === 'cap' ? "You've hit today's quiz coin limit." : (!res.coins ? 'No coins this time. Have another go!' : '');
    body = `<div class="qcard panel taped celebrate"><span class="stamp">${r.correct === qs.length ? 'Perfect!' : 'Done!'}</span><p style="font-size:22px">You got <b>${r.correct}</b> out of <b>${qs.length}</b></p>${res && res.coins ? `<div class="big"><span class="coin"></span>+${res.coins}</div>` : ''}${note ? `<p class="muted">${esc(note)}</p>` : ''}<div class="row" style="justify-content:center"><button class="btn" data-act="startquiz" data-id="${qz.id}" data-mode="quiz">Try again</button><button class="btn primary" data-act="${back.act}" ${back.attrs}>Back to ${u ? 'unit' : 'class'}</button></div></div>`;
  } else {
    const cur = qs[r.i], picked = r.picked;
    body = `<div class="qcard stack"><div class="row between label"><span>Question ${r.i + 1} of ${qs.length}</span><span>${r.correct} correct</span></div><div class="progress"><i style="width:${(r.i / qs.length * 100).toFixed(0)}%"></i></div>
    <h2 style="font-family:var(--f-body);font-weight:800;text-transform:none;font-size:23px">${esc(cur.q)}</h2>
    <div class="opts">${cur.options.map((o, j) => { if (!o) return ''; let cl = ''; if (picked != null) { if (j === cur.answer) cl = 'right'; else if (j === picked) cl = 'wrong'; } return `<button class="opt ${cl}" data-act="pick" data-j="${j}" ${picked != null ? 'disabled' : ''}><span class="k">${'ABCDEF'[j]}</span>${esc(o)}</button>`; }).join('')}</div>
    ${picked != null ? `<div class="row between"><b class="scrawl" style="font-size:22px;color:${picked === cur.answer ? 'var(--good)' : 'var(--bad)'}">${picked === cur.answer ? 'Nailed it!' : 'Bailed. The right answer is in green.'}</b><button class="btn primary" data-act="qnext">${r.i < qs.length - 1 ? 'Next question' : 'See results'}</button></div>` : ''}</div>`;
  }
  return { theme: t, html: banner(t, { eyebrow: r.mode === 'cards' ? 'Flashcards' : 'Revision quiz', title: qz.title, back }) + `<main class="wrap">${body}</main>` };
}

/* ---------------- focus timer ---------------- */
function tick() {
  const f = S.focus; if (!f) return;
  const rem = remaining(), a = $('#bigtimer'), m = $('#minitimer'), arc = $('#ringarc');
  if (a && !f.finishing) a.textContent = fmtT(rem); if (m) m.textContent = '⏱ ' + fmtT(rem);
  if (arc) { const C = 2 * Math.PI * 88; arc.setAttribute('stroke-dashoffset', (C * (1 - rem / (f.minutes * 60))).toFixed(1)); }
  if (rem <= 0 && !f.finishing && Date.now() >= (f.retryAt || 0)) finishFocus();
}
async function finishFocus() {
  const f = S.focus; f.finishing = true;
  try {
    const coins = await rpc('complete_focus', { p_id: f.id });
    S.focus = null; store.set('skate-focus', null);
    S.celebrate = { title: 'Session done!', coins, msg: coins ? `${f.minutes} minutes of focus${f.label ? ' on ' + f.label : ''}. Sick work.` : `${f.minutes} minutes of focus. You've hit today's coin limit, but the study still counts.` };
    S.view = { name: 'focus' }; await refresh();
  } catch (e) {
    const m = String(e?.message || '');
    if (m.includes('too_early')) { f.finishing = false; f.retryAt = Date.now() + 5000; }
    else if (m.includes('no_session')) { S.focus = null; store.set('skate-focus', null); toast('That session had already ended.'); render(); }
    else { f.finishing = false; f.retryAt = Date.now() + 10000; toast(msg(e)); }
  }
}

/* ---------------- events ---------------- */
const A = {}, F = {};
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el || el.disabled) return; const fn = A[el.dataset.act]; if (fn) { e.preventDefault(); fn(el, e); } });
document.addEventListener('submit', e => { const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault(); const fn = F[f.dataset.form]; if (fn) fn(f); });
document.addEventListener('input', e => {
  const el = e.target, d = S.quizDraft;
  if (d) { if (el.dataset.bind) d[el.dataset.bind] = el.dataset.bind === 'per' ? Number(el.value) || 0 : el.value; if (el.dataset.qi) d.questions[+el.dataset.qi].q = el.value; if (el.dataset.oi) d.questions[+el.dataset.oi].options[+el.dataset.oj] = el.value; }
  if (el.dataset.tb && S.customDraft) { S.customDraft[el.dataset.tb] = el.value; schedule(); }
  if (el.id === 'fx-label') S.ui.focusLabel = el.value;
});
document.addEventListener('change', e => {
  const el = e.target, d = S.quizDraft;
  if (d && el.dataset.ai) d.questions[+el.dataset.ai].answer = +el.dataset.aj;
  if (d && el.dataset.bind === 'unit_id') d.unit_id = el.value;
  if (el.id === 'fx-class') S.ui.focusClass = el.value;
  if (el.dataset.tb && S.customDraft) { S.customDraft[el.dataset.tb] = el.value; schedule(); }
});

A.retry = () => resolveSession();
A.nav = el => { S.ui.loginErr = ''; if (el.dataset.to === 'teacherlogin') { go({ name: 'teacherlogin' }); return; } if (location.hash) history.replaceState(null, '', location.pathname + location.search); go({ name: el.dataset.to }); };
A.tab = el => { S.ui.tab = el.dataset.tab; S.ui.armed = null; render(); };
A.openclass = el => { S.ui.tab = el.dataset.tab || 'units'; S.quizRun = null; go({ name: 'class', classId: el.dataset.id }); if (S.role === 'student') loadBoard(el.dataset.id); };
A.openunit = el => { S.quizRun = null; go({ name: 'unit', unitId: el.dataset.id }); };
A.arm = el => {
  const k = el.dataset.key;
  if (S.ui.armed !== k) { S.ui.armed = k; render(); clearTimeout(A._t); A._t = setTimeout(() => { if (S.ui.armed === k) { S.ui.armed = null; render(); } }, 5000); return; }
  S.ui.armed = null; doDelete(k);
};
A.copy = el => { const v = el.dataset.text; try { navigator.clipboard.writeText(v).then(() => toast('Copied'), () => toast(v)); } catch { toast(v); } };
A.signout = async () => { await sb.auth.signOut(); S.view = { name: 'home' }; history.replaceState(null, '', location.pathname); resolveSession(); };

/* auth */
A.joinmode = el => { S.ui.joinMode = el.dataset.m; S.ui.loginErr = ''; render(); };
A.pickcolor = el => { S.ui.color = el.dataset.c; render(); };
F.join = async () => {
  const code = $('#jv-code').value.trim().toUpperCase(), nick = $('#jv-nick').value.trim(), pin = $('#jv-pin').value.trim();
  if (!/^[0-9]{4}$/.test(pin)) { S.ui.loginErr = ERR.bad_pin; render(); return; }
  S.ui.busy = true; S.ui.loginErr = ''; render();
  try {
    if (!S.uid || !S.isAnon) { const { error } = await sb.auth.signInAnonymously(); if (error) throw error; }
    if (S.ui.joinMode === 'new') await rpc('join_new', { p_code: code, p_nickname: nick, p_pin: pin, p_color: S.ui.color || COLORS[0] });
    else { const id = await rpc('recover_student', { p_code: code, p_nickname: nick, p_pin: pin }); if (!id) throw new Error('no_match'); }
    S.ui.busy = false; S.view = { name: 'home' }; await resolveSession(); toast(S.ui.joinMode === 'new' ? 'You dropped in! Welcome.' : 'Welcome back!');
  } catch (e) { S.ui.busy = false; S.ui.loginErr = msg(e); render(); }
};
F.tlogin = async () => {
  S.ui.busy = true; S.ui.loginErr = ''; render();
  const { error } = await sb.auth.signInWithPassword({ email: $('#tl-email').value.trim(), password: $('#tl-pass').value });
  S.ui.busy = false;
  if (error) { S.ui.loginErr = msg(error); render(); return; }
  history.replaceState(null, '', location.pathname); S.view = { name: 'home' }; resolveSession();
};
A.tsignup = async () => {
  const email = $('#tl-email').value.trim(), password = $('#tl-pass').value;
  if (!email || password.length < 8) { S.ui.loginErr = 'Enter your email and a password of at least 8 characters.'; render(); return; }
  S.ui.busy = true; render();
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname + '#teacher' } });
  S.ui.busy = false;
  if (error) { S.ui.loginErr = msg(error); render(); return; }
  if (!data.session) { S.ui.loginErr = 'Account created. Check your email and click the confirmation link, then sign in here.'; render(); return; }
  history.replaceState(null, '', location.pathname); S.view = { name: 'home' }; resolveSession();
};

/* teacher actions */
F.newclass = () => act(async () => {
  const name = $('#nc-name').value.trim(); if (!name) return;
  await q(sb.from('classes').insert({ name, subtitle: $('#nc-sub').value.trim(), theme_id: $('#nc-theme').value, code: uniqueCode(), sort: S.classes.length }));
  clear('nc-name', 'nc-sub'); await refresh();
}, 'Class created').catch(() => { });
F.newunit = () => act(async () => {
  const cid = S.view.classId, title = $('#nu-title-' + cid).value.trim(); if (!title) return;
  await q(sb.from('units').insert({ class_id: cid, title, theme_id: $('#nu-theme-' + cid).value, sort: unitsOf(cid).length }));
  clear('nu-title-' + cid); await refresh();
}, 'Unit added').catch(() => { });
F.classset = f => act(async () => { const id = f.dataset.id; await q(sb.from('classes').update({ name: $('#cs-name-' + id).value.trim() || 'Class', subtitle: $('#cs-sub-' + id).value.trim(), announcement: $('#cs-ann-' + id).value.trim() }).eq('id', id)); await refresh(); }, 'Class saved').catch(() => { });
A.setclasstheme = el => act(async () => { await q(sb.from('classes').update({ theme_id: el.dataset.theme }).eq('id', el.dataset.id)); await refresh(); }, 'Theme updated').catch(() => { });
A.newcode = el => act(async () => { await q(sb.from('classes').update({ code: uniqueCode() }).eq('id', el.dataset.id)); await refresh(); }, 'New join code made').catch(() => { });
F.unitset = f => act(async () => { const id = f.dataset.id; await q(sb.from('units').update({ title: $('#us-title-' + id).value.trim() || 'Unit', description: $('#us-desc-' + id).value.trim(), theme_id: $('#us-theme-' + id).value, hidden: $('#us-hidden-' + id).checked }).eq('id', id)); await refresh(); }, 'Unit saved').catch(() => { });
A.reskind = el => { S.ui.resKind = el.dataset.kind; render(); };
A.unitmove = el => move(unitsOf(S.view.classId), el.dataset.id, +el.dataset.dir, 'units');
A.resmove = el => { const r = S.resources.find(x => x.id === el.dataset.id); move(resOf(r.unit_id), el.dataset.id, +el.dataset.dir, 'resources'); };
async function move(list, id, dir, table) {
  const i = list.findIndex(x => x.id === id), j = i + dir; if (j < 0 || j >= list.length) return;
  const arr = list.slice(); [arr[i], arr[j]] = [arr[j], arr[i]];
  try { for (let k = 0; k < arr.length; k++) if (arr[k].sort !== k) await q(sb.from(table).update({ sort: k }).eq('id', arr[k].id)); } catch (e) { toast(msg(e)); }
  refresh();
}
F.newres = async f => {
  const uid = f.dataset.id, u = S.units.find(x => x.id === uid), k = S.ui.resKind;
  const title = $('#nr-title-' + uid).value.trim(), description = $('#nr-desc-' + uid).value.trim();
  const base = { class_id: u.class_id, unit_id: uid, description, sort: resOf(uid).length };
  let row;
  if (k === 'file') {
    const file = $('#nr-file')?.files?.[0]; if (!file) { toast('Choose a file to upload.'); return; }
    if (file.size > 50 * 1024 * 1024) { toast('That file is over 50 MB. Try a smaller one, or upload it to OneDrive/Google Drive and add a link.'); return; }
    S.ui.busy = true; render();
    const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80), path = `${u.class_id}/${uid}/${Date.now()}-${safeName}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) { S.ui.busy = false; render(); toast(/exceeded|too large/i.test(error.message) ? 'That file is too big.' : msg(error)); return; }
    const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    row = { ...base, kind: 'file', title: title || file.name.replace(/\.[^.]+$/, ''), url, storage_path: path, content_type: file.type, size_bytes: file.size };
  } else if (k === 'note') {
    const note = $('#nr-note-' + uid).value.trim(); if (!note) { toast('Write the note first.'); return; }
    row = { ...base, kind: 'note', title: title || 'Note', note };
  } else {
    const url = $('#nr-url-' + uid).value.trim();
    if (!/^https?:\/\//i.test(url)) { toast('Enter a full web address starting with https://'); return; }
    const yt = ytId(url); if (k === 'youtube' && !yt) { toast("That doesn't look like a YouTube link."); return; }
    row = { ...base, kind: yt ? 'youtube' : 'link', title: title || (yt ? 'YouTube video' : url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]), url };
  }
  try { await q(sb.from('resources').insert(row)); toast('Resource added'); clear('nr-title-' + uid, 'nr-desc-' + uid, 'nr-url-' + uid, 'nr-note-' + uid); const fi = $('#nr-file'); if (fi) fi.value = ''; }
  catch (e) { toast(msg(e)); if (row.storage_path) sb.storage.from(BUCKET).remove([row.storage_path]); }
  S.ui.busy = false; refresh();
};
A.newquiz = el => { S.quizDraft = { class_id: el.dataset.class, unit_id: el.dataset.unit || '', title: '', per: 5, questions: [blankQ()] }; go({ name: 'quizedit' }); };
A.editquiz = el => {
  const x = S.quizzes.find(y => y.id === el.dataset.id);
  S.quizDraft = { id: x.id, class_id: x.class_id, unit_id: x.unit_id || '', title: x.title, per: x.per, questions: (x.questions || []).map(y => ({ q: y.q, options: [...y.options, '', '', '', ''].slice(0, Math.max(4, y.options.length)), answer: y.answer })) };
  if (!S.quizDraft.questions.length) S.quizDraft.questions = [blankQ()];
  dropIds('qz-'); go({ name: 'quizedit' });
};
function dropIds(prefix) { document.querySelectorAll(`[id^="${prefix}"]`).forEach(el => el.removeAttribute('id')); }
A.qadd = () => { S.quizDraft.questions.push(blankQ()); render(); };
A.qdel = el => { S.quizDraft.questions.splice(+el.dataset.i, 1); dropIds('qz-'); render(); };
A.qbulk = () => {
  const txt = $('#qz-bulk').value; let n = 0;
  for (const b of txt.split(/\n\s*(?=Q:)/i)) {
    const lines = b.split('\n').map(l => l.trim()).filter(Boolean), ql = lines.find(l => /^Q:/i.test(l)); if (!ql) continue;
    const opts = []; let ans = 0;
    for (const l of lines) { if (/^\*/.test(l)) { ans = opts.length; opts.push(l.slice(1).trim()); } else if (/^-/.test(l)) opts.push(l.slice(1).trim()); }
    if (opts.length < 2) continue;
    const d = S.quizDraft; if (d.questions.length === 1 && !d.questions[0].q) d.questions = [];
    d.questions.push({ q: ql.replace(/^Q:\s*/i, ''), options: opts.slice(0, 6), answer: ans }); n++;
  }
  if (n) { dropIds('qz-'); toast(`Added ${n} question${n > 1 ? 's' : ''}`); render(); }
  else toast('No questions found. Each needs to start with Q: and have answers marked * and -.');
};
A.qsave = async () => {
  const d = S.quizDraft;
  const qs = d.questions.map(x => ({ q: x.q.trim(), options: x.options.map(o => o.trim()), answer: x.answer })).filter(x => x.q);
  for (const x of qs) {
    const keep = x.options.map((o, j) => ({ o, j })).filter(y => y.o);
    if (keep.length < 2) { toast('Each question needs at least two answers.'); return; }
    if (!x.options[x.answer]) { toast(`"${x.q.slice(0, 40)}" has no correct answer ticked.`); return; }
    x.answer = keep.findIndex(y => y.j === x.answer); x.options = keep.map(y => y.o);
  }
  if (!d.title.trim()) { toast('Give the quiz a title.'); return; }
  if (!qs.length) { toast('Add at least one question.'); return; }
  const body = { class_id: d.class_id, unit_id: d.unit_id || null, title: d.title.trim(), per: Math.max(0, Math.min(50, Number(d.per) || 0)), questions: qs };
  S.ui.busy = true; render();
  try { await q(d.id ? sb.from('quizzes').update(body).eq('id', d.id) : sb.from('quizzes').insert(body)); toast('Quiz saved'); S.quizDraft = null; dropIds('qz-'); S.ui.tab = 'revision'; S.view = { name: 'class', classId: d.class_id }; }
  catch (e) { toast(msg(e)); }
  S.ui.busy = false; refresh();
};
A.edittheme = el => { const t = S.themes.find(x => x.id === el.dataset.id); S.customDraft = { id: t.id, name: t.name, accent: t.accent, b1: t.b1, b2: t.b2, pattern: t.pattern, decor: (t.decor || []).join(' ') }; dropIds('th-'); render(); };
A.newthemedraft = () => { S.customDraft = null; dropIds('th-'); render(); };
F.savetheme = () => act(async () => {
  const d = S.customDraft; if (!d.name.trim()) throw new Error('Give the theme a name.');
  const body = { name: d.name.trim(), accent: d.accent, b1: d.b1, b2: d.b2, pattern: d.pattern, decor: d.decor.split(/\s+/).filter(Boolean).slice(0, 6) };
  await q(d.id ? sb.from('themes').update(body).eq('id', d.id) : sb.from('themes').insert(body));
  S.customDraft = null; dropIds('th-'); await refresh();
}, 'Theme saved').catch(() => { });
F.site = () => act(async () => {
  const n = id => Math.max(0, Math.round(Number($(id).value) || 0));
  await q(sb.from('settings').update({ site_name: $('#st-name').value.trim() || 'Skate Skool', teacher_name: $('#st-teacher').value.trim(), home_theme: $('#st-theme').value, focus_rate: n('#st-rate'), focus_cap: n('#st-fcap'), quiz_cap: n('#st-qcap'), welcome: n('#st-welcome') }).eq('id', 1));
  await refresh();
}, 'Settings saved').catch(() => { });
A.award = el => act(async () => { const n = parseInt($('#aw-' + el.dataset.id).value, 10); if (!n) throw new Error('Enter a number of coins.'); await rpc('award_coins', { p_student: el.dataset.id, p_amount: n, p_reason: 'From your teacher' }); await refresh(); }, 'Coins sent').catch(() => { });
A.resetpin = el => act(async () => { const p = $('#rp-' + el.dataset.id).value.trim(); if (!/^[0-9]{4}$/.test(p)) throw new Error('bad_pin'); await rpc('reset_pin', { p_student: el.dataset.id, p_pin: p }); clear('rp-' + el.dataset.id); }, 'PIN updated').catch(() => { });

async function removeFiles(paths) { const p = paths.filter(Boolean); if (p.length) await sb.storage.from(BUCKET).remove(p).catch(() => { }); }
async function doDelete(k) {
  const [type, id, extra] = k.split('|');
  try {
    if (type === 'giveup') { const f = S.focus; S.focus = null; store.set('skate-focus', null); render(); if (f) rpc('cancel_focus', { p_id: f.id }).catch(() => { }); toast('Session stopped'); return; }
    if (type === 'logout') { await sb.auth.signOut(); S.me = null; S.view = { name: 'home' }; await resolveSession(); return; }
    if (type === 'res') { const r = S.resources.find(x => x.id === id); await q(sb.from('resources').delete().eq('id', id)); await removeFiles([r?.storage_path]); toast('Resource removed'); }
    if (type === 'quiz') { await q(sb.from('quizzes').delete().eq('id', id)); toast('Quiz deleted'); }
    if (type === 'theme') { if (S.customDraft?.id === id) S.customDraft = null; await q(sb.from('themes').delete().eq('id', id)); toast('Theme deleted'); }
    if (type === 'kick') { await q(sb.from('enrolments').delete().eq('student_id', id).eq('class_id', extra)); toast('Skater removed from class'); }
    if (type === 'unit') { const u = S.units.find(x => x.id === id); const files = S.resources.filter(r => r.unit_id === id).map(r => r.storage_path); await q(sb.from('units').delete().eq('id', id)); await removeFiles(files); toast('Unit deleted'); S.view = { name: 'class', classId: u?.class_id }; }
    if (type === 'class') { const files = S.resources.filter(r => r.class_id === id).map(r => r.storage_path); await q(sb.from('classes').delete().eq('id', id)); await removeFiles(files); toast('Class deleted'); S.view = { name: 'home' }; }
  } catch (e) { toast(msg(e)); }
  refresh();
}

/* student actions */
F.joinmore = () => act(async () => { await rpc('join_class', { p_code: $('#jm-code').value.trim().toUpperCase() }); clear('jm-code'); await refresh(); }, 'Joined!').catch(() => { });
F.nick = () => act(async () => { const n = $('#dn-nick').value.trim(); await rpc('set_nickname', { p_nick: n }); await refresh(); }, 'Name saved').catch(() => { });
A.fmin = el => { S.ui.focusMin = +el.dataset.m; render(); };
A.focusfor = el => { S.ui.focusClass = el.dataset.class; S.ui.focusLabel = el.dataset.label; go({ name: 'focus' }); };
A.fstart = async () => {
  const minutes = S.ui.focusMin, label = ($('#fx-label')?.value || '').trim(), cid = $('#fx-class')?.value || null;
  S.ui.busy = true; render();
  try {
    const id = await rpc('start_focus', { p_minutes: minutes, p_label: label, p_class: cid || null });
    S.focus = { id, uid: S.uid, startedAt: Date.now(), minutes, label }; store.set('skate-focus', S.focus);
    try { navigator.wakeLock?.request('screen').catch(() => { }); } catch { }
  } catch (e) { toast(msg(e)); }
  S.ui.busy = false; render();
};
A.closecele = () => { S.celebrate = null; render(); };
A.shoptab = el => { S.ui.shopTab = el.dataset.tab; render(); };
A.buy = async el => {
  const it = item(el.dataset.slot, el.dataset.id); if (!it) return;
  S.ui.busy = true; render();
  try { await rpc('buy_item', { p_slot: it.slot, p_id: it.id }); toast(`You got the ${it.name}!`); } catch (e) { toast(msg(e)); }
  S.ui.busy = false; refresh();
};
A.equip = async el => {
  const slot = el.dataset.slot, id = el.dataset.id || null;
  if (slot === 'color') S.me = { ...S.me, color: id };
  else { const eq = { ...eqOf(S.me) }; if (id) eq[slot] = id; else delete eq[slot]; S.me = { ...S.me, equipped: eq }; }
  render();
  try { await rpc('equip', { p_slot: slot, p_id: id }); } catch (e) { toast(msg(e)); refresh(); }
};
A.startquiz = el => {
  const x = S.quizzes.find(y => y.id === el.dataset.id);
  if (!x || !(x.questions || []).length) { toast('This quiz has no questions yet.'); return; }
  S.quizRun = { qid: x.id, mode: el.dataset.mode, i: 0, correct: 0, picked: null, answers: [], done: false, flipped: false, result: null };
  go({ name: 'quiz' });
};
A.flip = () => { S.quizRun.flipped = !S.quizRun.flipped; render(); };
A.card = el => { const r = S.quizRun; r.i += +el.dataset.d; r.flipped = false; render(); };
A.pick = el => {
  const r = S.quizRun, x = S.quizzes.find(y => y.id === r.qid); if (r.picked != null) return;
  r.picked = +el.dataset.j; r.answers[r.i] = r.picked; if (r.picked === x.questions[r.i].answer) r.correct++; render();
};
A.qnext = async () => {
  const r = S.quizRun, x = S.quizzes.find(y => y.id === r.qid);
  if (r.i < x.questions.length - 1) { r.i++; r.picked = null; render(); return; }
  r.done = true; render();
  try { r.result = await rpc('submit_quiz', { p_quiz: x.id, p_answers: r.answers }); } catch (e) { r.result = { coins: 0, note: '' }; toast(msg(e)); }
  await refresh();
};

boot();
})();
