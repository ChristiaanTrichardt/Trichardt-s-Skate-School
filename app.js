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
  students: [], enrol: [], me: null, log: [], attempts: [], crew: {}, notes: [], todos: [], weekMin: 0, progress: {}, achievements: [], boards: {}, wb: { color: '#121212', size: 7, eraser: false }, wbStroke: null,
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
function weekStart() { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
const fmtH = m => { const h = (m || 0) / 60; return (h >= 10 ? Math.round(h) : Math.round(h * 10) / 10) + ' h'; };
const studyMin = c => site().bowl_period === 'all' ? (c.focus_min || 0) : (c.week_min ?? 0);
const periodWord = () => site().bowl_period === 'all' ? 'in total' : 'this week';
const site = () => ({ heading_font: 'Rubik Dirt', site_name: 'Skate Skool', teacher_name: '', home_theme: 'griptape', focus_rate: 1, focus_cap: 100, quiz_cap: 150, welcome: 20, bowl_hours: 1, bowl_period: 'week', ...S.settings });

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
  bad_minutes: 'Pick between 1 and 180 minutes.',
};
function msg(e) {
  const m = String(e?.message || e || '');
  for (const k in ERR) if (m.includes(k)) return ERR[k];
  if (/anonymous sign-ins are disabled/i.test(m)) return 'Student logins are switched off. Your teacher needs to turn on "Anonymous sign-ins" in Supabase (see README).';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Couldn't reach the server. Check your internet and try again.";
  if (/Invalid login credentials/i.test(m)) return 'Wrong email or password.';
  if (/Email not confirmed/i.test(m)) return 'Confirm your email first (check your inbox), then sign in.';
  if (/does not exist|Could not find the (table|function)|schema cache/i.test(m)) return 'The database needs updating. Run update-2.sql in Supabase → SQL Editor.';
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
const allThemes = (w = WORLD) => [...THEMES.filter(t => t.world === w), ...S.themes.slice().sort(byOrder)];
function themeById(id, w = WORLD) { return THEMES.find(t => t.id === id) || S.themes.find(t => t.id === id) || THEMES.find(t => t.world === w) || THEMES[0]; }
function themeVars(t) { return `--accent:${t.accent};--accent-ink:${inkFor(t.accent)};--b1:${t.b1};--b2:${t.b2};--banner-ink:${inkFor(mixHex(t.b1, t.b2))};--pattern:${PATTERNS[t.pattern] || 'none'}`; }
const classTheme = c => themeById(c?.theme_id);
function unitTheme(u) { return u?.theme_id ? themeById(u.theme_id) : classTheme(S.classes.find(c => c.id === u?.class_id)); }

/* data shortcuts */
const item = (slot, id) => S.shop.find(i => i.slot === slot && i.id === id);
const shopSlot = (slot, all = false) => S.shop.filter(i => i.slot === slot && (all || !i.world || i.world === 'both' || i.world === WORLD)).sort(byOrder);
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
  const opt = p => p.then(r => r, () => []); // newer tables: don't break the site if an update hasn't been run yet
  S.achievements = await opt(q(sb.from('achievements').select('*').order('sort')));
  if (S.role === 'teacher') {
    const [students, enrol, notes, todos] = await Promise.all([
      sel('students', STUDENT_COLS + ',real_name,tricks').catch(() => sel('students', STUDENT_COLS)), sel('enrolments'),
      opt(q(sb.from('student_log').select('*').order('logged_on', { ascending: false }).order('created_at', { ascending: false }).limit(3000))),
      opt(q(sb.from('todos').select('*').order('created_at')))]);
    S.students = students; S.enrol = enrol; S.notes = notes; S.todos = todos;
    S.attempts = await q(sb.from('quiz_attempts').select('*').order('created_at').limit(10000)).catch(() => []);
  } else {
    const [me, enrol, log, attempts] = await Promise.all([
      q(sb.from('students').select(STUDENT_COLS + ',tricks').maybeSingle()).catch(() => q(sb.from('students').select(STUDENT_COLS).maybeSingle())), sel('enrolments'),
      q(sb.from('coin_log').select('amount,reason,created_at').order('created_at', { ascending: false }).limit(10)),
      q(sb.from('quiz_attempts').select('quiz_id,score,total,coins,created_at').order('created_at', { ascending: false }).limit(1000))]);
    S.me = me; S.enrol = enrol; S.log = log; S.attempts = attempts;
    const [todos, week] = await Promise.all([opt(q(sb.from('todos').select('*').order('created_at'))),
      opt(q(sb.from('focus_sessions').select('minutes,completed_at').not('completed_at', 'is', null).gte('completed_at', weekStart().toISOString())))]);
    S.todos = todos; S.weekMin = week.reduce((a, f) => a + f.minutes, 0);
  }
}
async function refresh() { try { await loadAll(); } catch (e) { toast(msg(e)); } render(); }

/* ---------------- render core ---------------- */
let rq = 0;
function schedule() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; render(); }); }
function render() {
  const app = $('#app');
  const vals = {}; app.querySelectorAll('input[id],textarea[id],select[id]').forEach(el => { if (el.type === 'file') return; vals[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? { c: el.checked } : { v: el.value }; });
  const opens = {}; app.querySelectorAll('details[id]').forEach(d => opens[d.id] = d.open);
  const ae = document.activeElement, fid = ae && ae.id; let sel = null; try { sel = [ae.selectionStart, ae.selectionEnd]; } catch { }
  const sy = window.scrollY;
  try { WORLD = S.loading || S.role === 'setup' ? 'skate' : currentWorld(); } catch { WORLD = 'skate'; }
  const { html, theme, font } = view();
  document.body.className = 'world-' + WORLD;
  app.setAttribute('style', themeVars(theme) + `;--f-display:${fontCss(font || (WORLD === 'surf' ? 'Shrikhand' : site().heading_font))}`);
  app.innerHTML = html;
  for (const [id, s] of Object.entries(vals)) { const el = document.getElementById(id); if (!el) continue; if ('c' in s) el.checked = s.c; else el.value = s.v; }
  for (const [id, o] of Object.entries(opens)) { const d = document.getElementById(id); if (d) d.open = o; }
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); try { if (sel && sel[0] != null) el.setSelectionRange(sel[0], sel[1]); } catch { } } }
  if (Math.abs(window.scrollY - sy) > 2) window.scrollTo(0, sy);
  document.title = site().site_name;
  paintBoards();
}
function clear(...ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
function go(v) { S.view = v; S.ui.armed = null; S.celebrate = null; render(); window.scrollTo(0, 0); }

function view() {
  const home = siteTheme();
  if (S.loading) return { theme: home, html: `<div class="loading"><h2 class="scrawl">Dropping in…</h2></div>` };
  if (S.role === 'setup') return setupView();
  let out;
  if (S.view.name === 'teacherlogin' && S.role !== 'teacher') out = teacherLogin();
  else if (S.role === 'teacher') {
    const v = S.view.name;
    out = v === 'class' ? tClass() : v === 'board' ? tBoard() : v === 'unit' ? tUnit() : v === 'todo' ? todoPage() : v === 'themes' ? tThemes() : v === 'settings' ? tSettings() : v === 'quizedit' ? tQuizEdit() : tHome();
  } else if (S.role === 'pending') out = pendingView();
  else if (S.role === 'student' && S.me) {
    const v = S.view.name;
    out = v === 'class' ? sClass() : v === 'unit' ? sUnit() : v === 'todo' ? todoPage() : v === 'focus' ? sFocus() : v === 'shop' ? sShop() : v === 'den' ? sDen() : v === 'quiz' ? sQuiz() : sHome();
  } else out = joinView();
  const err = S.err ? `<div class="wrap" style="padding-top:16px"><div class="alert">${esc(S.err)} <button class="btn sm" data-act="retry">Try again</button></div></div>` : '';
  return { theme: out.theme || home, font: out.font, html: topbar() + err + out.html };
}

const BOARD_SVG = `<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="3" y="8" width="58" height="14" rx="7" fill="#FF2E88" stroke="#F6F6F1" stroke-width="3"/><circle cx="16" cy="30" r="6" fill="#FFE14D" stroke="#F6F6F1" stroke-width="3"/><circle cx="48" cy="30" r="6" fill="#FFE14D" stroke="#F6F6F1" stroke-width="3"/></svg>`;
const SURF_SVG = `<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M4 20Q20 6 58 16Q62 20 58 24Q20 34 4 20Z" fill="#FFD166" stroke="#fff" stroke-width="3"/><path d="M10 20H54" stroke="#FF7A59" stroke-width="4"/></svg>`;
function topbar() {
  const st = site(), v = S.view.name;
  let navs = [];
  if (S.role === 'teacher') navs = [['home', 'Classes'], ['todo', 'To-do'], ['themes', 'Themes'], ['settings', 'Settings']];
  else if (S.role === 'student' && S.me) navs = [['home', 'Home'], ['focus', 'Focus'], ['todo', 'To-do'], ['shop', 'Shop'], ['den', W().hangout]];
  const cur = n => (v === n || (n === 'home' && ['class', 'unit', 'quizedit', 'quiz'].includes(v))) ? 'aria-current="page"' : '';
  let right = '';
  if (S.focus && S.role === 'student') { const rem = remaining(); right += `<button class="minitimer" data-act="nav" data-to="focus" id="minitimer" aria-label="Focus session running">⏱ ${fmtT(rem)}</button>`; }
  if (S.role === 'student' && S.me) right += `<span class="coins" title="Your coins"><span class="coin"></span>${balance(S.me)}</span>`;
  if (S.role === 'teacher' || S.role === 'pending') right += `<button class="topbtn" data-act="signout">Sign out</button>`;
  return `<header class="top"><div class="wrap"><button class="brand" data-act="nav" data-to="home">${WORLD === 'surf' ? SURF_SVG : BOARD_SVG}<span>${esc(st.site_name)}</span></button>
  ${navs.length ? `<nav class="nav" aria-label="Main">${navs.map(([k, l]) => `<button data-act="nav" data-to="${k}" ${cur(k)}>${l}</button>`).join('')}</nav>` : ''}${right}</div></header>`;
}
function banner(t, { eyebrow = '', title = '', sub = '', back = null, code = null } = {}) {
  return `<section class="banner"><div class="decor" aria-hidden="true">${(t.decor || []).slice(0, 4).map(e => `<span>${esc(e)}</span>`).join('')}</div><div class="wrap">
  ${back ? `<button class="backlink" data-act="${back.act}" ${back.attrs || ''}>← ${esc(back.label)}</button>` : ''}
  ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}<h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}
  ${code ? `<span class="codechip"><small>Join code</small>${esc(code)}</span>` : ''}</div></section>`;
}
let WORLD = 'skate';
function siteTheme() { const t = THEMES.find(x => x.id === site().home_theme) || S.themes.find(x => x.id === site().home_theme); return t && (t.world === WORLD || !THEMES.includes(t)) ? t : themeById(WORLD === 'surf' ? 'reef' : 'griptape'); }
const W = () => WORDS[WORLD];
function currentWorld() {
  const v = S.view; let c = null;
  if (v.name === 'class' || v.name === 'board') c = S.classes.find(x => x.id === v.classId);
  else if (v.name === 'unit') { const u = S.units.find(x => x.id === v.unitId); c = u && S.classes.find(x => x.id === u.class_id); }
  else if (v.name === 'quiz' && S.quizRun) { const q = S.quizzes.find(x => x.id === S.quizRun.qid); c = q && S.classes.find(x => x.id === q.class_id); }
  else if (v.name === 'quizedit' && S.quizDraft) c = S.classes.find(x => x.id === S.quizDraft.class_id);
  if (c) return worldOf(c);
  if (S.role === 'student' && S.me) { const mc = myClasses(); if (mc.length) return worldOf(mc[0]); }
  return site().home_world === 'surf' ? 'surf' : 'skate';
}
const classFont = c => (c && c.heading_font) || (worldOf(c) === 'surf' ? 'Shrikhand' : site().heading_font);
function fontPicker(sel, act, extra = '', inherit = false) {
  return `<div class="fontpick">${inherit ? `<button class="fp" aria-pressed="${!sel}" data-act="${act}" data-font="" ${extra}><span class="fp-s" style="font-family:${fontCss(site().heading_font)}">Aa</span><span class="small">Same as site</span></button>` : ''}${FONTS.map(f => `<button class="fp" aria-pressed="${sel === f.id}" data-act="${act}" data-font="${esc(f.id)}" ${extra}><span class="fp-s" style="font-family:${fontCss(f.id)}">Skate Skool</span><span class="small">${esc(f.name)}</span></button>`).join('')}</div>`;
}
function sticker(t, title, emoji, body, attrs, font) {
  return `<button class="ccard" ${attrs}><div class="cb" style="background:linear-gradient(120deg,${t.b1},${t.b2});--pat:${PATTERNS[t.pattern] || 'none'};--ink2:${inkFor(mixHex(t.b1, t.b2))}"><strong${font ? ` style="font-family:${fontCss(font)}"` : ''}>${esc(title)}</strong><span class="em" aria-hidden="true">${esc(emoji || '')}</span></div><div class="cbody">${body}</div></button>`;
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
  const t = siteTheme();
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
  const t = siteTheme();
  return { theme: t, html: banner(t, { eyebrow: 'One more step', title: 'Activate your teacher account' }) + `
  <main class="wrap"><div class="panel taped stack"><p>You're signed in as <b>${esc(S.email)}</b>, but this account isn't marked as the teacher yet.</p>
  <p>In Supabase, open <b>SQL Editor</b>, run this one line, then press the button below:</p>
  <pre style="overflow-x:auto;margin:0"><code>insert into public.teachers (user_id) select id from auth.users where email = '${esc(S.email)}';</code></pre>
  <div class="row"><button class="btn primary" data-act="retry">I've done it, check again</button></div></div></main>` };
}
function den(eq, color, nickname) {
  const pet = item('pet', eq.pet), plant = item('plant', eq.plant), gear = item('gear', eq.gear);
  if (WORLD === 'surf') return `<div class="den hut" role="img" aria-label="Your character's beach hut"><span class="tag" aria-hidden="true">${esc(nickname || 'surf skool')}</span><div class="window" aria-hidden="true"></div><div class="board1"></div><div class="board2"></div><div class="floor"></div><div class="mat"></div>
  ${plant ? `<span class="plant">${plant.emoji}</span>` : ''}${charSVG(eq, color, 'bob', 'Your character')}${gear ? `<span class="gear">${gear.emoji}</span>` : ''}${pet ? `<span class="pet bob">${pet.emoji}</span>` : ''}</div>`;
  return `<div class="den" role="img" aria-label="Your character's hangout"><span class="tag" aria-hidden="true">${esc(nickname || 'skate skool')}</span><div class="poster" aria-hidden="true">⚡</div><div class="ramp"></div><div class="floor"></div><div class="crate"></div>
  ${plant ? `<span class="plant">${plant.emoji}</span>` : ''}${charSVG(eq, color, 'bob', 'Your character')}${gear ? `<span class="gear">${gear.emoji}</span>` : ''}${pet ? `<span class="pet bob">${pet.emoji}</span>` : ''}</div>`;
}
function joinView() {
  const st = site(), t = siteTheme(), mode = S.ui.joinMode, color = S.ui.color || COLORS[0];
  const fields = mode === 'new'
    ? `<label class="f">Class join code<input type="text" class="codeinput" id="jv-code" maxlength="6" autocomplete="off" required placeholder="ABC123"></label>
       <label class="f">Your ${W().name}<input type="text" id="jv-nick" maxlength="20" required placeholder="${W().namePh}"></label>
       <label class="f">Make a 4-number PIN (you'll need it on other devices)<input type="text" class="pininput" id="jv-pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required placeholder="••••"></label>
       <div class="stack" style="gap:6px"><span class="label">Pick your colour</span><div class="swatches">${COLORS.map(c => `<button type="button" class="swatch" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${c === color}" data-act="pickcolor" data-c="${c}"></button>`).join('')}</div></div>`
    : `<label class="f">Class join code<input type="text" class="codeinput" id="jv-code" maxlength="6" autocomplete="off" required placeholder="ABC123"></label>
       <label class="f">Your ${W().name}<input type="text" id="jv-nick" maxlength="20" required></label>
       <label class="f">Your PIN<input type="text" class="pininput" id="jv-pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required></label>`;
  return { theme: t, html: banner(t, { eyebrow: st.teacher_name ? `${st.teacher_name}'s classroom` : `Welcome, ${W().rider}`, title: st.site_name, sub: 'Grab the join code from your teacher, make your character, and start stacking coins.' }) + `
  <main class="wrap"><div class="hero"><form class="panel taped stack" data-form="join">
   <div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="${mode === 'new'}" data-act="joinmode" data-m="new">I'm new</button><button type="button" role="tab" aria-selected="${mode === 'back'}" data-act="joinmode" data-m="back">I've been here before</button></div>
   ${fields}
   ${S.ui.loginErr ? `<div class="alert small">${esc(S.ui.loginErr)}</div>` : ''}
   <div><button class="btn primary big" ${S.ui.busy ? 'disabled' : ''}>${S.ui.busy ? 'Hang on…' : mode === 'new' ? W().join : 'Log back in'}</button></div>
  </form>${den({ character: 'blob' }, color, W().newbie)}</div>
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


/* ---------------- the skate bowl ---------------- */
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
let BOWL_SEQ = 0;
function placeChar(svg, x, y, w, h) { return svg.replace('<svg ', `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" `); }
const BW = 1000, BH = 470, DECK = 205, LIP = DECK + 4;
const EDGE = `M108 ${LIP}C108 400 190 442 330 442L670 442C810 442 892 400 892 ${LIP}`;
const RIDE_PATH = 'M124 236C128 392 202 427 330 427L670 427C798 427 872 392 876 236';
const GRAF = `font-family="'Sedgwick Ave Display','Permanent Marker',cursive"`;
function seeded(n) { let x = n; return () => (x = (x * 9301 + 49297) % 233280) / 233280; }
const pine = (x, y, s, c) => `<g fill="${c}"><rect x="${x - 3 * s}" y="${y - 10 * s}" width="${6 * s}" height="${10 * s}" fill="#5B3A1E"/><path d="M${x} ${y - 70 * s}L${x - 22 * s} ${y - 30 * s}H${x + 22 * s}ZM${x} ${y - 52 * s}L${x - 28 * s} ${y - 8 * s}H${x + 28 * s}Z"/></g>`;
const cloud = (x, y, s) => `<g fill="#fff" opacity=".92"><ellipse cx="${x}" cy="${y}" rx="${34 * s}" ry="${14 * s}"/><ellipse cx="${x - 18 * s}" cy="${y - 8 * s}" rx="${18 * s}" ry="${13 * s}"/><ellipse cx="${x + 12 * s}" cy="${y - 12 * s}" rx="${20 * s}" ry="${16 * s}"/></g>`;
const stars = (n, seed, maxY, op = .8) => { const r = seeded(seed); let o = ''; for (let i = 0; i < n; i++) o += `<circle cx="${(r() * BW).toFixed(0)}" cy="${(r() * maxY).toFixed(0)}" r="${(r() * 1.4 + .4).toFixed(1)}" fill="#fff" opacity="${(op * (.4 + r() * .6)).toFixed(2)}"/>`; return o; };

// Each park draws its own backdrop and colours; the bowl shape stays the same so riders work everywhere.
function parkArt(id, t, u, title) {
  const sky = (a, b) => `<linearGradient id="${u}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const P = { deck: '#B9B9B4', ground: '#8F8F8A', pool: ['#C9C9C3', '#A6A6A0'], edge: '#121212', coping: '#D5D8DC', defs: '', back: '', inPool: '', front: '', gravity: 1 };
  if (id === 'warehouse') {
    P.defs = sky('#3A3A41', '#1E1E22') + `<radialGradient id="${u}lamp"><stop offset="0" stop-color="#FFE9A8" stop-opacity=".55"/><stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/></radialGradient><pattern id="${u}tin" width="16" height="10" patternUnits="userSpaceOnUse"><rect width="8" height="10" fill="#000" opacity=".18"/></pattern>`;
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/>
     ${[120, 420, 720].map(x => `<path d="M${x} 6H${x + 160}L${x + 140} 30H${x + 20}Z" fill="#BFE6FF" opacity=".75"/>`).join('')}
     <path d="M0 70${Array.from({ length: 21 }, (_, i) => `L${i * 50} ${i % 2 ? 40 : 70}`).join('')}" fill="none" stroke="#141416" stroke-width="5"/><rect y="68" width="${BW}" height="6" fill="#141416"/>
     <rect y="96" width="${BW}" height="${LIP - 96}" fill="#5C6067"/><rect y="96" width="${BW}" height="${LIP - 96}" fill="url(#${u}tin)"/>
     ${[200, 500, 800].map(x => `<line x1="${x}" y1="74" x2="${x}" y2="104" stroke="#111" stroke-width="2"/><path d="M${x - 16} 118L${x - 6} 104H${x + 6}L${x + 16} 118Z" fill="#2B2B2B"/><circle cx="${x}" cy="140" r="70" fill="url(#${u}lamp)"/>`).join('')}
     <rect x="330" y="122" width="340" height="52" fill="${t.accent}" stroke="#121212" stroke-width="4" transform="rotate(-2 500 148)"/><text x="500" y="160" text-anchor="middle" ${GRAF} font-size="34" fill="#121212" transform="rotate(-2 500 148)">${esc(title)}</text>`;
    Object.assign(P, { deck: '#85858C', ground: '#606067', pool: ['#B4B4B0', '#8E8E8A'] });
  } else if (id === 'backyard') {
    P.defs = sky('#7FCBFF', '#DDF3FF') + `<clipPath id="${u}clip"><path d="${EDGE}Z"/></clipPath>`;
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/><circle cx="905" cy="48" r="30" fill="#FFE14D"/>${cloud(380, 50, 1)}${cloud(640, 34, .8)}
     <rect x="0" y="78" width="230" height="${LIP - 78}" fill="#F2D7B6" stroke="#121212" stroke-width="3"/><path d="M-10 82L115 16L245 82Z" fill="#C0563A" stroke="#121212" stroke-width="3"/>
     <rect x="70" y="112" width="70" height="52" fill="#9FD8F4" stroke="#121212" stroke-width="3"/><path d="M105 112V164M70 138H140" stroke="#121212" stroke-width="3"/>
     ${Array.from({ length: 30 }, (_, i) => `<rect x="${230 + i * 26}" y="${116 + (i % 3) * 2}" width="26" height="${LIP - 116}" fill="#C38D5B" stroke="#6B4423" stroke-width="2"/>`).join('')}
     <path d="M860 ${LIP}Q850 120 880 58" stroke="#8B5A2B" stroke-width="14" fill="none" stroke-linecap="round"/>
     ${[[-70, 20], [-30, 34], [10, 30], [50, 18], [80, 40]].map(([dx, dy]) => `<path d="M880 58Q${880 + dx / 2} ${40 - dy / 3} ${880 + dx} ${58 + dy}" stroke="#2E8B3E" stroke-width="10" fill="none" stroke-linecap="round"/>`).join('')}<circle cx="874" cy="66" r="6" fill="#6B4423"/><circle cx="886" cy="68" r="6" fill="#6B4423"/>`;
    P.inPool = `<g clip-path="url(#${u}clip)"><path d="${EDGE}" fill="none" stroke="#2B7FD6" stroke-width="34" stroke-dasharray="14 3"/><ellipse cx="500" cy="440" rx="120" ry="7" fill="#7CCBEF" opacity=".7"/></g>`;
    Object.assign(P, { deck: '#E9DFCB', ground: '#D8CDB6', pool: ['#D7F2FF', '#8ED3F2'] });
  } else if (id === 'beach') {
    P.defs = sky('#7CCBFF', '#FFE7B8');
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/><circle cx="760" cy="122" r="46" fill="#FFD166"/>${cloud(250, 46, .9)}
     <path d="M190 124Q250 92 320 124Z" fill="#2E6F6A"/><rect y="122" width="${BW}" height="${LIP - 122}" fill="#1E88C9"/>
     ${[138, 160, 182].map((y, i) => `<path d="M0 ${y}${Array.from({ length: 26 }, (_, k) => `q20 ${i % 2 ? 6 : -6} 40 0`).join('')}" fill="none" stroke="#8FD3FF" stroke-width="3" opacity=".8"/>`).join('')}
     <path d="M600 118L600 96L618 118Z" fill="#fff" stroke="#121212" stroke-width="2"/><path d="M590 118H624L618 124H596Z" fill="#E0262C"/>
     <path d="M420 52l8 6 8-6M452 66l7 5 7-5" stroke="#121212" stroke-width="2.5" fill="none"/>
     ${pine(60, LIP, 1.6, '#2F5D3A')}${pine(950, LIP, 1.4, '#2F5D3A')}`;
    Object.assign(P, { deck: '#E6D3A3', ground: '#EBD39B', pool: ['#DCD7CB', '#BAB4A6'] });
  } else if (id === 'rooftop') {
    const r = seeded(7); let city = '', x = 0;
    while (x < BW) { const w = 50 + r() * 60, h = 60 + r() * 115, top = 178 - h; city += `<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 40).toFixed(0)}" fill="#1C1633"/>`; for (let wy = top + 10; wy < 168; wy += 16) for (let wx = x + 8; wx < x + w - 10; wx += 14) if (r() > .45) city += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="6" height="8" fill="#FFE07A" opacity=".85"/>`; x += w + 6; }
    P.defs = sky('#2A1B5C', '#FF8A5B');
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/><circle cx="520" cy="182" r="62" fill="#FFD166" opacity=".95"/>${stars(30, 3, 70, .7)}${city}
     <g stroke="#3A3A44" stroke-width="4"><line x1="140" y1="100" x2="132" y2="160"/><line x1="190" y1="100" x2="198" y2="160"/></g><rect x="128" y="62" width="76" height="44" rx="6" fill="#6B4E3D" stroke="#121212" stroke-width="3"/><path d="M124 64L166 40L208 64Z" fill="#4A372B" stroke="#121212" stroke-width="3"/>
     <rect y="162" width="${BW}" height="5" fill="#9AA0A6"/><rect y="182" width="${BW}" height="4" fill="#9AA0A6"/>${Array.from({ length: 26 }, (_, i) => `<rect x="${i * 40}" y="162" width="5" height="${LIP - 162}" fill="#9AA0A6"/>`).join('')}`;
    Object.assign(P, { deck: '#6B6B78', ground: '#55555F', pool: ['#9393A0', '#71717E'] });
  } else if (id === 'outback') {
    P.defs = sky('#FF9F43', '#FFE2A6');
    const gum = (x, s) => `<path d="M${x} ${LIP}C${x - 4} ${LIP - 50 * s} ${x + 6} ${LIP - 80 * s} ${x - 10} ${LIP - 120 * s}M${x} ${LIP - 70 * s}C${x + 20 * s} ${LIP - 90 * s} ${x + 30 * s} ${LIP - 100 * s} ${x + 34 * s} ${LIP - 118 * s}" stroke="#EFE8DC" stroke-width="${9 * s}" fill="none" stroke-linecap="round"/><g fill="#7E8F4F">${[[-18, -130], [6, -138], [30, -126], [-34, -118], [42, -110]].map(([dx, dy]) => `<ellipse cx="${x + dx * s}" cy="${LIP + dy * s}" rx="${24 * s}" ry="${14 * s}"/>`).join('')}</g>`;
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/><circle cx="850" cy="64" r="38" fill="#FFF1C1"/>
     <path d="M0 175Q250 150 500 172T1000 160V${LIP}H0Z" fill="#D46A3A"/><path d="M360 182C372 126 410 114 560 112C700 112 740 128 752 182Z" fill="#B5452B" stroke="#7A2A18" stroke-width="3"/>
     <path d="M420 150q30-8 60 0M600 140q40-6 80 2" stroke="#7A2A18" stroke-width="3" fill="none" opacity=".6"/>
     ${gum(130, 1.1)}${gum(905, .95)}<text x="650" y="${LIP - 4}" font-size="34" class="bw-emo">🦘</text>`;
    Object.assign(P, { deck: '#C98468', ground: '#B5532F', pool: ['#DDBCA6', '#C09A81'] });
  } else if (id === 'forest') {
    P.defs = sky('#9ED8FF', '#E8F7FF') + `<clipPath id="${u}clip"><path d="${EDGE}Z"/></clipPath>`;
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/><circle cx="120" cy="54" r="28" fill="#FFE14D"/>
     <path d="M80 170L260 40L430 170ZM360 170L560 20L760 170ZM680 170L860 60L1040 170Z" fill="#7488AE"/><path d="M228 63L260 40L292 63L276 72L260 64L244 72ZM520 49L560 20L600 49L582 60L560 50L538 60ZM826 84L860 60L894 84L878 92L860 84L842 92Z" fill="#fff"/>
     ${Array.from({ length: 22 }, (_, i) => pine(i * 48 + (i % 2) * 16, LIP - 4 + (i % 3) * 4, .95 + (i % 3) * .2, i % 2 ? '#1F5E3A' : '#2D7A4A')).join('')}`;
    P.inPool = `<g clip-path="url(#${u}clip)" fill="#6F9A4A" opacity=".45"><ellipse cx="170" cy="330" rx="26" ry="10"/><ellipse cx="860" cy="300" rx="20" ry="8"/><ellipse cx="560" cy="436" rx="40" ry="6"/></g>`;
    Object.assign(P, { deck: '#A9B39C', ground: '#5E9A3E', pool: ['#C6CCB9', '#A3AA95'] });
  } else if (id === 'neon') {
    P.defs = sky('#0B0620', '#24104C') + `<filter id="${u}glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/>${stars(70, 11, 120)}<path d="M0 ${LIP}V150H80V120H130V160H220V100H300V150H380V130H460V${LIP}ZM560 ${LIP}V120H640V90H720V150H800V110H880V140H1000V${LIP}Z" fill="#140B2E"/>
     <g filter="url(#${u}glow)"><rect x="50" y="40" width="380" height="70" rx="14" fill="none" stroke="#FF2E88" stroke-width="5"/><text x="240" y="90" text-anchor="middle" ${GRAF} font-size="36" fill="#FF2E88" textLength="${Math.min(340, String(title).length * 20)}" lengthAdjust="spacingAndGlyphs">${esc(String(title).slice(0, 22))}</text>
     <rect x="640" y="30" width="230" height="64" rx="32" fill="none" stroke="#1EC8FF" stroke-width="5"/><text x="755" y="74" text-anchor="middle" font-family="'Bebas Neue',Impact,sans-serif" font-size="40" fill="#1EC8FF" letter-spacing="4">SHRED 24/7</text>
     <path d="M0 140${Array.from({ length: 20 }, (_, i) => `Q${i * 50 + 25} 156 ${i * 50 + 50} 140`).join('')}" stroke="#FFE14D" stroke-width="2" fill="none"/>${Array.from({ length: 20 }, (_, i) => `<circle cx="${i * 50 + 25}" cy="150" r="4" fill="${['#FF2E88', '#39FF88', '#1EC8FF', '#FFE14D'][i % 4]}"/>`).join('')}</g>`;
    Object.assign(P, { deck: '#2A2A33', ground: '#17171E', pool: ['#34344B', '#202030'], edge: '#39FF88', coping: '#FF2E88', glow: true });
  } else if (id === 'moon') {
    P.defs = sky('#03030A', '#14142A');
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/>${stars(120, 5, 180, 1)}
     <circle cx="840" cy="70" r="38" fill="#2B6FD6"/><path d="M816 52q14-10 24 2t20 4M812 80q18 4 22 16M852 92q10-6 18-2" stroke="#3FA34D" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="840" cy="70" r="38" fill="none" stroke="#9FD3FF" stroke-width="3" opacity=".7"/>
     <path d="M0 175Q120 150 240 168T520 160T780 170T1000 158V${LIP}H0Z" fill="#7A7A84"/><ellipse cx="300" cy="186" rx="40" ry="8" fill="#66666F"/><ellipse cx="760" cy="190" rx="54" ry="9" fill="#66666F"/>
     <line x1="560" y1="${LIP - 2}" x2="560" y2="128" stroke="#D5D8DC" stroke-width="4"/><rect x="562" y="128" width="62" height="40" fill="${t.accent}" stroke="#121212" stroke-width="3"/><text x="593" y="158" text-anchor="middle" font-size="24" class="bw-emo">🛹</text>
     <text x="80" y="150" font-size="44" class="bw-emo" transform="rotate(-30 100 140)">🚀</text>`;
    P.front = `<g fill="#76767F"><ellipse cx="40" cy="300" rx="24" ry="6"/><ellipse cx="960" cy="360" rx="30" ry="7"/><ellipse cx="60" cy="440" rx="20" ry="5"/></g>`;
    Object.assign(P, { deck: '#A0A0A8', ground: '#8A8A93', pool: ['#A6A6AE', '#82828B'], gravity: 1.8 });
  } else { // brickyard (starting park)
    P.defs = sky(t.b1, t.b2) + `<pattern id="${u}brick" width="48" height="24" patternUnits="userSpaceOnUse"><path d="M0 .75H48M0 12.75H48M24 0V12M0 12V24M48 12V24" stroke="#000" stroke-opacity=".3" stroke-width="1.5" fill="none"/></pattern><pattern id="${u}fence" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 0L18 18M18 0L0 18" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/></pattern>`;
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/><circle cx="860" cy="58" r="34" fill="${t.accent}" opacity=".9"/>
     <rect y="40" width="${BW}" height="62" fill="url(#${u}fence)"/><rect y="38" width="${BW}" height="4" fill="#9AA0A6"/>
     <rect y="100" width="${BW}" height="${DECK - 100}" fill="#8E3F2E"/><rect y="100" width="${BW}" height="${DECK - 100}" fill="url(#${u}brick)"/>
     <text x="70" y="160" ${GRAF} font-size="46" fill="${t.accent}" stroke="#121212" stroke-width="2.5" paint-order="stroke" transform="rotate(-4 70 160)">${esc(title || 'Skate Skool')}</text>`;
  }
  return P;
}

// Graffiti and stickers painted into the bowl once the class unlocks them
function decorArt(on, t, title, u) {
  const sticker = (x, y, r, inner, bg = '#fff') => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-25" y="-25" width="50" height="50" rx="11" fill="${bg}" stroke="#121212" stroke-width="3"/>${inner}</g>`;
  const emo = e => `<text y="11" text-anchor="middle" font-size="30" class="bw-emo">${e}</text>`;
  const piece = (x, y, r, txt, size, fill, sw = 3) => `<text x="${x}" y="${y}" text-anchor="middle" ${GRAF} font-size="${size}" fill="#121212" opacity=".35" transform="rotate(${r} ${x} ${y}) translate(4 4)">${esc(txt)}</text><text x="${x}" y="${y}" text-anchor="middle" ${GRAF} font-size="${size}" fill="${fill}" stroke="#121212" stroke-width="${sw}" paint-order="stroke" transform="rotate(${r} ${x} ${y})">${esc(txt)}</text>`;
  let defs = '', under = '', over = '', rim = '';
  if (on.has('flames')) { let f = ''; for (let x = 336; x < 664; x += 34) f += `<path d="M${x} 442Q${x + 4} 418 ${x + 8} 400Q${x + 18} 420 ${x + 20} 408Q${x + 30} 426 ${x + 34} 442Z" fill="#FF8A00" stroke="#D9222A" stroke-width="2.5"/><path d="M${x + 9} 442Q${x + 12} 428 ${x + 14} 420Q${x + 20} 432 ${x + 25} 442Z" fill="#FFE14D"/>`; under += `<g clip-path="url(#${u}pclip)">${f}</g>`; }
  if (on.has('classpiece')) { defs += `<linearGradient id="${u}cp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="#FF2E88"/></linearGradient>`; under += piece(500, 336, -3, String(title).slice(0, 18), 54, `url(#${u}cp)`, 4); }
  if (on.has('legends')) { defs += `<linearGradient id="${u}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF7C2"/><stop offset=".5" stop-color="#D4A017"/><stop offset="1" stop-color="#FFF1A0"/></linearGradient>`; under += piece(500, 270, 2, 'LEGENDS', 36, `url(#${u}gold)`); }
  if (on.has('tag_crew')) under += `<text x="228" y="350" ${GRAF} font-size="32" fill="none" stroke="${t.accent}" stroke-width="2.5" transform="rotate(-14 228 350)">CREW</text>`;
  if (on.has('shred')) under += piece(772, 352, 8, 'SHRED', 44, '#39FF88');
  if (on.has('bolt')) over += sticker(176, 282, -12, `<path d="M4 -19L-11 3H0L-5 20L12 -4H1Z" fill="#FFE14D" stroke="#121212" stroke-width="2.5" stroke-linejoin="round"/>`);
  if (on.has('aplus')) over += sticker(828, 286, 10, `<text y="10" text-anchor="middle" font-family="'Archivo Black',Impact,sans-serif" font-size="26" fill="#E0262C">A+</text>`, '#FFE14D');
  if (on.has('crown')) over += sticker(330, 282, 8, emo('👑'));
  if (on.has('hundred')) over += sticker(672, 282, -6, emo('💯'));
  if (on.has('brain')) over += sticker(392, 398, -10, emo('🧠'));
  if (on.has('fire')) over += sticker(608, 398, 12, emo('🔥'));
  if (on.has('horns')) over += sticker(856, 244, -8, emo('🤘'));
  if (on.has('board')) over += sticker(146, 246, 14, emo('🛹'));
  if (on.has('gold')) { defs += `<linearGradient id="${u}cg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFE38A"/><stop offset=".5" stop-color="#C9930E"/><stop offset="1" stop-color="#FFE38A"/></linearGradient>`; rim = `<path d="${EDGE}" fill="none" stroke="url(#${u}cg)" stroke-width="9"/>`; }
  else if (on.has('checker')) rim = `<path d="${EDGE}" fill="none" stroke="#F6F6F1" stroke-width="9"/><path d="${EDGE}" fill="none" stroke="#121212" stroke-width="9" stroke-dasharray="9 9"/>`;
  return { defs, under, over, rim };
}

// Tricks: each lip hit plays the next unlocked trick
const TRICK_FX = {
  ollie: { jump: [[0, 0], [.45, -32], [1, 0]] },
  kickflip: { jump: [[0, 0], [.45, -30], [1, 0]], board: [[0, '1 1'], [.2, '1 1'], [.45, '1 -1'], [.7, '1 1'], [1, '1 1']] },
  shuvit: { jump: [[0, 0], [.45, -24], [1, 0]], board: [[0, '1 1'], [.2, '1 1'], [.45, '-1 1'], [.7, '1 1'], [1, '1 1']] },
  treflip: { jump: [[0, 0], [.45, -36], [1, 0]], board: [[0, '1 1'], [.2, '1 1'], [.35, '-1 -1'], [.5, '1 1'], [.65, '-1 -1'], [.8, '1 1'], [1, '1 1']] },
  indy: { jump: [[0, 0], [.5, -46], [1, 0]], rot: [[0, 0], [.3, -28], [.65, -28], [.9, 0], [1, 0]] },
  handplant: { jump: [[0, 0], [.3, -12], [.7, -12], [1, 0]], rot: [[0, 0], [.28, 180], [.72, 180], [1, 0]] },
  spin540: { jump: [[0, 0], [.5, -44], [1, 0]], spin: [[0, '1 1'], [.15, '-1 1'], [.3, '1 1'], [.45, '-1 1'], [.6, '1 1'], [.75, '-1 1'], [.9, '1 1'], [1, '1 1']] },
  backflip: { jump: [[0, 0], [.5, -56], [1, 0]], rot: [[0, 0], [.12, 0], [.88, -360], [1, -360]] },
};
function trickAnims(tricks, D, begin, cy, gravity, world = 'skate') {
  const list = (tricks || []).filter(k => TRICK_FX[k]); if (!list.length || REDUCED) return null;
  const n = list.length, L = .22 * D, P = n * D / 2, b = (begin - L / 2).toFixed(2);
  const hits = list.map((k, j) => ({ k, s: j * D / 2, e: j * D / 2 + L }));
  const neutral = { jump: 0, rot: 0, spin: '1 1', board: '1 1' };
  const fmt = { jump: v => `0 ${(v * gravity).toFixed(1)}`, rot: v => `${v} 0 ${cy}`, spin: v => v, board: v => v };
  const type = { jump: 'translate', rot: 'rotate', spin: 'scale', board: 'scale' };
  const out = {};
  for (const ch of ['jump', 'rot', 'spin', 'board']) {
    if (!hits.some(h => TRICK_FX[h.k][ch])) { out[ch] = ''; continue; }
    const kf = [[0, neutral[ch]]];
    for (const h of hits) {
      const fr = TRICK_FX[h.k][ch]; if (!fr) continue;
      kf.push([h.s, neutral[ch]]); fr.forEach(([q, v]) => kf.push([h.s + q * L, v]));
      const last = fr[fr.length - 1][1]; if (last !== neutral[ch]) kf.push([h.e + .01, neutral[ch]]);
    }
    kf.push([P, neutral[ch]]);
    let prev = -1; const ks = [], vs = [];
    for (const [tm, v] of kf) { let x = Math.min(P, Math.max(tm, prev + .0001)); ks.push((x / P).toFixed(4)); vs.push(fmt[ch](v)); prev = x; }
    ks[ks.length - 1] = '1';
    out[ch] = `<animateTransform attributeName="transform" type="${type[ch]}" dur="${P.toFixed(2)}s" begin="${b}s" repeatCount="indefinite" values="${vs.join(';')}" keyTimes="${ks.join(';')}"/>`;
  }
  out.labels = [...new Set(list)].map(k => {
    const mine = hits.filter(h => h.k === k), ks = ['0'], vs = ['0'];
    for (const h of mine) { ks.push((h.s / P).toFixed(4), ((h.s + .08 * L) / P).toFixed(4), (h.e / P).toFixed(4), (Math.min(P, h.e + .01) / P).toFixed(4)); vs.push('0', '1', '1', '0'); }
    ks.push('1'); vs.push('0');
    const name = trickName(k, world);
    return `<text class="bw-trick" x="0" y="${cy * 2 - 54}" text-anchor="middle" opacity="0">${esc(name)}!<animate attributeName="opacity" dur="${P.toFixed(2)}s" begin="${b}s" repeatCount="indefinite" values="${vs.join(';')}" keyTimes="${ks.join(';')}" calcMode="discrete"/></text>`;
  }).join('');
  return out;
}

function bowlScene(crew, t, title, opts = {}) {
  const u = 'bw' + (++BOWL_SEQ) + '-', park = PARKS.find(p => p.id === opts.park) ? opts.park : 'brickyard', surf = (opts.world || 'skate') === 'surf';
  const A = surf ? surfArt(SURF_ID[park], t, u, title || 'Skate Skool') : parkArt(park, t, u, title || 'Skate Skool');
  const D8 = surf ? surfDecor(opts.decor || new Set(), t, title || 'Skate Skool', u) : decorArt(opts.decor || new Set(), t, title || 'Skate Skool', u);
  const need = Math.max(0, Number(site().bowl_hours) || 0) * 60;
  crew = (crew || []).slice().sort((a, b) => studyMin(b) - studyMin(a));
  const n = crew.length, qualified = crew.filter(c => studyMin(c) >= need && (need > 0 || studyMin(c) > 0));
  const riders = opts.thumb ? [] : qualified.slice(0, 8), riderSet = new Set(riders), rest = opts.thumb ? [] : crew.filter(c => !riderSet.has(c));
  const nRide = riders.length, deck = rest.slice(0, 32), extra = Math.max(0, rest.length - 32);
  const label = (x, y, txt, me, w = 92) => `<g class="bw-tag${me ? ' me' : ''}"><rect x="${(x - w / 2).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="17" rx="2"/><text x="${x.toFixed(1)}" y="${y + 12.5}" text-anchor="middle">${esc(String(txt).slice(0, Math.max(4, Math.floor(w / 7.5))))}</text></g>`;
  const tags = [];
  const youMark = (x, y) => `<g class="bw-you"><text x="${x.toFixed(1)}" y="${y}" text-anchor="middle">YOU</text><path d="M${(x - 6).toFixed(1)} ${y + 4}L${x.toFixed(1)} ${y + 12}L${(x + 6).toFixed(1)} ${y + 4}Z"/></g>`;
  const rowA = deck.length > 14 ? deck.filter((_, i) => i % 2 === 0) : deck, rowB = deck.length > 14 ? deck.filter((_, i) => i % 2 === 1) : [];
  const standRow = (list, feetY, h, nameDy) => {
    const w = h * 140 / 168, gap = (BW - 80) / Math.max(list.length, 1);
    return list.map((c, i) => {
      const cx = 40 + gap * (i + .5); if (nameDy) tags.push(label(cx, feetY + nameDy, c.nickname, c.is_me, Math.min(92, gap - 4)));
      const x = cx - w / 2, y = feetY - h, eq = c.equipped || {}, pet = item('pet', eq.pet), gear = item('gear', eq.gear);
      return `<g class="bw-kid"><title>${esc(c.nickname)}</title>${placeChar(charSVG(eq, c.color, '', c.nickname), x, y, w.toFixed(1), h)}
       ${gear ? `<text class="bw-emo" x="${(x - 2).toFixed(1)}" y="${feetY - 2}" font-size="${h * .26}">${gear.emoji}</text>` : ''}
       ${pet ? `<text class="bw-emo" x="${(x + w * .78).toFixed(1)}" y="${feetY + 2}" font-size="${h * .36}">${pet.emoji}</text>` : ''}
       ${c.is_me ? youMark(cx, y - 4) : ''}</g>`;
    }).join('');
  };
  const riderSVG = riders.map((c, i) => {
    const eq = c.equipped || {}, h = 74, w = h * 140 / 168, D = 5.4 + (i % 4) * .9 + Math.floor(i / 4) * .45, pet = item('pet', eq.pet);
    const begin = -i * 1.37, cy = -(h / 2) - 9, tr = trickAnims(c.tricks, D, begin, cy, A.gravity, surf ? 'surf' : 'skate') || {};
    const board = `<g transform="translate(0 -7)"><g>${tr.board || ''}${surf ? surfboardSVG(['#22D3EE', '#FF7A59', '#FFE14D', '#34D399', '#FF8FB1'][i % 5]) : '<rect x="-34" y="-4" width="68" height="8" rx="4" class="bw-deck"/><circle cx="-20" cy="7" r="4.5" class="bw-wheel"/><circle cx="20" cy="7" r="4.5" class="bw-wheel"/>'}</g></g>`;
    const body = `${placeChar(charSVG(eq, c.color, '', c.nickname), -w / 2, -h - 9, w.toFixed(1), h)}${pet ? `<text class="bw-emo" x="${(w / 2 - 6).toFixed(1)}" y="-40" font-size="24">${pet.emoji}</text>` : ''}`;
    const inner = `<g>${tr.jump || ''}<g>${tr.rot || ''}<g transform="translate(0 ${cy})"><g>${tr.spin || ''}<g transform="translate(0 ${-cy})">${body}${board}</g></g></g></g>
      ${label(0, -h - 31, c.nickname, c.is_me)}${c.is_me ? youMark(0, -h - 43) : ''}${tr.labels || ''}</g>`;
    if (REDUCED) { const xs = 300 + (i % 4) * 130 + Math.floor(i / 4) * 60; return `<g transform="translate(${xs},427)"><title>${esc(c.nickname)}</title>${inner}</g>`; }
    return `<g><title>${esc(c.nickname)}${(c.tricks || []).length ? ' · tricks: ' + esc(c.tricks.map(k => trickName(k, surf ? 'surf' : 'skate')).join(', ')) : ''}</title>${inner}<animateMotion dur="${D}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite" path="${RIDE_PATH}" keyPoints="0.03;0.97;0.03" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"/></g>`;
  }).join('');
  const glow = A.glow ? `filter="url(#${u}glow)"` : '';
  const svg = `<svg viewBox="0 0 ${BW} ${BH}" role="img" aria-label="${esc(parkName(park, surf ? 'surf' : 'skate'))}${opts.thumb ? '' : `: ${n} skater${n === 1 ? '' : 's'}`}">
   <defs><linearGradient id="${u}pool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${A.pool[0]}"/><stop offset="1" stop-color="${A.pool[1]}"/></linearGradient><clipPath id="${u}pclip"><path d="${EDGE}Z"/></clipPath>${A.defs}${D8.defs}</defs>
   ${A.back}${surf ? D8.sky + D8.back : ''}
   ${surf ? `<rect y="${DECK - 12}" width="${BW}" height="16" fill="${A.sand}"/>` : `<rect y="${DECK - 12}" width="${BW}" height="16" fill="${A.deck}" stroke="#121212" stroke-width="3"/>`}
   ${standRow(rowB, DECK - 8, 54, 0)}${standRow(rowA, DECK, 66, 8)}
   ${surf ? waveLayers(A, u) + D8.wave : `<path d="M0 ${LIP}H${BW}V${BH}H0Z" fill="${A.ground}"/>${A.front}
   <path d="${EDGE}Z" fill="url(#${u}pool)"/>${A.inPool}${D8.under}
   <path d="${EDGE}" fill="none" stroke="${A.edge}" stroke-width="4" ${glow}/>${D8.rim}
   <path d="M0 ${LIP}H108M892 ${LIP}H${BW}" stroke="${A.coping}" stroke-width="10" stroke-linecap="round" ${glow}/><circle cx="108" cy="${LIP}" r="6" fill="${A.coping}" stroke="#121212" stroke-width="3"/><circle cx="892" cy="${LIP}" r="6" fill="${A.coping}" stroke="#121212" stroke-width="3"/>
   ${D8.over}`}${tags.join('')}
   ${n || opts.thumb ? '' : `<text x="500" y="340" text-anchor="middle" class="bw-empty">No ${surf ? 'surfers' : 'skaters'} yet. Share the join code!</text>`}
   ${riderSVG}
   ${extra ? `<text x="${BW - 16}" y="${DECK + 30}" text-anchor="end" class="bw-more">+${extra} more</text>` : ''}
  </svg>`;
  if (opts.thumb) return svg;
  const wd = WORDS[surf ? 'surf' : 'skate'];
  return `<figure class="bowl"><div class="bowl-scroll">${svg}</div><figcaption class="small muted"><b>${esc(parkName(park, surf ? 'surf' : 'skate'))}.</b> Study ${esc(String(site().bowl_hours))} ${Number(site().bowl_hours) === 1 ? 'hour' : 'hours'} ${periodWord()} in focus sessions to ${wd.ride}. ${nRide ? `${nRide} ${nRide === 1 ? wd.rider + ' is' : wd.riders + ' are'} riding${qualified.length > nRide ? ` (${qualified.length} unlocked)` : ''}.` : 'Nobody has unlocked it yet.'} Riders pull the tricks your teacher has unlocked for them.</figcaption></figure>`;
}

/* ---------------- the surf wave (surf world) ---------------- */
const SURF_ID = { brickyard: 'beachbreak', warehouse: 'pier', backyard: 'reef', beach: 'point', rooftop: 'sunset', outback: 'tropical', forest: 'cold', neon: 'glow', moon: 'giant' };
const palm = (x, y, s, trunk = '#8B5A2B', leaf = '#2E8B3E') => `<path d="M${x} ${y}Q${x - 6 * s} ${y - 60 * s} ${x + 14 * s} ${y - 110 * s}" stroke="${trunk}" stroke-width="${10 * s}" fill="none" stroke-linecap="round"/>${[[-60, 20], [-30, 34], [10, 30], [46, 16], [70, 36]].map(([dx, dy]) => `<path d="M${x + 14 * s} ${y - 110 * s}Q${x + 14 * s + dx * s / 2} ${y - 128 * s - dy * s / 4} ${x + 14 * s + dx * s} ${y - 110 * s + dy * s * .6}" stroke="${leaf}" stroke-width="${8 * s}" fill="none" stroke-linecap="round"/>`).join('')}`;
function surfArt(id, t, u, title) {
  const sky = (...c) => `<linearGradient id="${u}sky" x1="0" y1="0" x2="0" y2="1">${c.map((x, i) => `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${x}"/>`).join('')}</linearGradient>`;
  const P = { sand: '#F2D49B', water: ['#7FE3F0', '#14A3C7', '#0B5E8A'], foam: '#FFFFFF', defs: '', back: '', gravity: 1, glow: false, pool: ['#fff', '#fff'] };
  const sandBack = c => `<path d="M0 168Q250 150 500 162T1000 156V${LIP}H0Z" fill="${c}"/>`;
  const sea = (c, y = 128) => `<rect y="${y}" width="${BW}" height="${170 - y}" fill="${c}"/>`;
  if (id === 'pier') {
    P.defs = sky('#86D3FF', '#E3F6FF');
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/>${cloud(240, 44, 1)}${cloud(720, 30, .8)}${sea('#2A9BC9')}
     <rect x="380" y="110" width="620" height="9" fill="#8B5E3C" stroke="#4A2F1B" stroke-width="2"/>${Array.from({ length: 16 }, (_, i) => `<rect x="${392 + i * 40}" y="118" width="6" height="${52 - (i % 2) * 6}" fill="#6B4423"/>`).join('')}
     <path d="M380 100H1000" stroke="#4A2F1B" stroke-width="3"/>${Array.from({ length: 16 }, (_, i) => `<line x1="${392 + i * 40}" y1="100" x2="${392 + i * 40}" y2="110" stroke="#4A2F1B" stroke-width="3"/>`).join('')}
     <rect x="900" y="74" width="60" height="28" fill="#F6E6C8" stroke="#4A2F1B" stroke-width="3"/><path d="M894 76L930 58L966 76Z" fill="#E0262C" stroke="#4A2F1B" stroke-width="3"/>
     <path d="M200 60l8 6 8-6M232 72l7 5 7-5" stroke="#121212" stroke-width="2.5" fill="none"/>${sandBack('#EED19A')}`;
    Object.assign(P, { sand: '#EED19A', water: ['#8BE0E8', '#2196C8', '#0E4F7A'] });
  } else if (id === 'reef') {
    P.defs = sky('#5FD0FF', '#E0FBFF');
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/><circle cx="880" cy="50" r="30" fill="#FFE14D"/>${cloud(420, 40, .9)}${sea('#2DD4BF')}<path d="M0 150H1000" stroke="#A7F3E9" stroke-width="4" opacity=".7"/>
     ${sandBack('#FFF4D6')}${palm(60, LIP - 4, 1.2)}${palm(150, LIP, .9)}${palm(930, LIP - 2, 1.1)}`;
    Object.assign(P, { sand: '#FFF4D6', water: ['#A7F3E9', '#2DD4BF', '#0E7490'] });
  } else if (id === 'point') {
    P.defs = sky('#9CCBF0', '#EAF4FF');
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/>${cloud(500, 40, 1)}${sea('#1767A8', 120)}
     <path d="M0 ${LIP}V90L60 70L130 96L190 82L260 130L300 ${LIP}Z" fill="#4B5D52" stroke="#2D3A33" stroke-width="3"/><path d="M1000 ${LIP}V70L940 60L880 92L820 120L770 ${LIP}Z" fill="#55685C" stroke="#2D3A33" stroke-width="3"/>
     <rect x="920" y="18" width="22" height="48" fill="#fff" stroke="#121212" stroke-width="3"/><rect x="920" y="32" width="22" height="8" fill="#E0262C"/><rect x="920" y="50" width="22" height="8" fill="#E0262C"/><path d="M916 18H946L931 6Z" fill="#E0262C" stroke="#121212" stroke-width="2"/><path d="M942 12L1000 0V24Z" fill="#FFE9A8" opacity=".6"/>
     ${sandBack('#D9C49A')}`;
    Object.assign(P, { sand: '#D9C49A', water: ['#7CC8E8', '#1767A8', '#0B2F5E'] });
  } else if (id === 'sunset') {
    P.defs = sky('#6D28D9', '#FB923C', '#FDE68A');
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/><circle cx="500" cy="136" r="70" fill="#FFD166"/>${sea('#C2410C', 132)}<path d="M380 146H620M420 158H580" stroke="#FFD166" stroke-width="4" opacity=".7"/>
     ${sandBack('#E8B77A')}${palm(80, LIP, 1.25, '#2B1A3A', '#2B1A3A')}${palm(900, LIP, 1.1, '#2B1A3A', '#2B1A3A')}`;
    Object.assign(P, { sand: '#E8B77A', water: ['#FDBA74', '#C2410C', '#4C1D95'] });
  } else if (id === 'tropical') {
    P.defs = sky('#7DD3FC', '#F0FDFF');
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/>${sea('#14B8A6', 120)}
     <path d="M560 122L650 30L680 30L780 122Z" fill="#6B5B4E" stroke="#3B2F27" stroke-width="3"/><path d="M650 30Q665 20 680 30L672 44Q665 38 658 44Z" fill="#E0262C"/><g fill="#CBD5E1" opacity=".85"><circle cx="668" cy="18" r="10"/><circle cx="680" cy="6" r="13"/><circle cx="700" cy="-4" r="15"/></g>
     ${[120, 230, 340].map(x => `<line x1="${x}" y1="120" x2="${x}" y2="150" stroke="#6B4423" stroke-width="4"/><line x1="${x + 40}" y1="120" x2="${x + 40}" y2="150" stroke="#6B4423" stroke-width="4"/><rect x="${x - 4}" y="98" width="52" height="24" fill="#D4A373" stroke="#6B4423" stroke-width="2.5"/><path d="M${x - 14} 100L${x + 20} 74L${x + 58} 100Z" fill="#C8A15A" stroke="#6B4423" stroke-width="2.5"/>`).join('')}
     ${sandBack('#F7E7C1')}${palm(950, LIP, 1)}`;
    Object.assign(P, { sand: '#F7E7C1', water: ['#99F6E4', '#14B8A6', '#115E59'] });
  } else if (id === 'cold') {
    P.defs = sky('#CBE7F7', '#F4FBFF');
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/>${sea('#0EA5E9', 120)}
     <path d="M90 140L140 60L200 90L250 140Z" fill="#fff" stroke="#7DD3FC" stroke-width="3"/><path d="M140 60L170 140" stroke="#BAE6FD" stroke-width="3"/><path d="M640 140L700 40L760 70L830 140Z" fill="#fff" stroke="#7DD3FC" stroke-width="3"/><path d="M700 40L720 140" stroke="#BAE6FD" stroke-width="3"/>
     ${sandBack('#F1F5F9')}<text x="880" y="${LIP - 6}" font-size="30" class="bw-emo">🐧</text><text x="912" y="${LIP - 2}" font-size="24" class="bw-emo">🐧</text>`;
    Object.assign(P, { sand: '#F1F5F9', water: ['#BAE6FD', '#0EA5E9', '#0C4A6E'] });
  } else if (id === 'glow') {
    P.defs = sky('#020617', '#0F172A') + `<filter id="${u}glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/>${stars(90, 13, 130)}<circle cx="820" cy="54" r="26" fill="#F8FAFC"/><circle cx="832" cy="48" r="24" fill="#020617"/>${sea('#082F49', 124)}<path d="M0 140H1000" stroke="#22D3EE" stroke-width="2" opacity=".5"/>${sandBack('#3B3B4F')}`;
    Object.assign(P, { sand: '#3B3B4F', water: ['#22D3EE', '#0E7490', '#020617'], foam: '#A5F3FC', glow: true });
  } else if (id === 'giant') {
    P.defs = sky('#334155', '#94A3B8');
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/><g fill="#475569" opacity=".9">${cloud(200, 40, 1.6).replace('fill="#fff"', '')}${cloud(620, 30, 1.8).replace('fill="#fff"', '')}</g>
     ${sea('#155E75', 110)}<path d="M0 ${LIP}V80L80 60L160 100L220 ${LIP}Z" fill="#334155" stroke="#1E293B" stroke-width="3"/><path d="M1000 ${LIP}V90L920 70L860 110L800 ${LIP}Z" fill="#3F4C5F" stroke="#1E293B" stroke-width="3"/>${sandBack('#A8A29E')}`;
    Object.assign(P, { sand: '#A8A29E', water: ['#5EA3B8', '#155E75', '#0B2530'], gravity: 1.6 });
  } else { // beachbreak (start)
    P.defs = sky('#8ED8FF', '#E6F7FF');
    P.back = `<rect width="${BW}" height="${LIP}" fill="url(#${u}sky)"/><circle cx="870" cy="52" r="32" fill="#FFE14D"/>${cloud(300, 46, 1)}${cloud(600, 30, .7)}${sea('#1E9BC9')}<path d="M0 130Q60 110 140 128Z" fill="#3F8F5A"/>
     ${sandBack('#F2D49B')}<g><line x1="40" y1="${LIP}" x2="40" y2="130" stroke="#6B4423" stroke-width="4"/><path d="M42 130H74V148H42Z" fill="#E0262C"/><path d="M42 139H74V148H42Z" fill="#FFD23F"/><line x1="960" y1="${LIP}" x2="960" y2="130" stroke="#6B4423" stroke-width="4"/><path d="M958 130H926V148H958Z" fill="#E0262C"/><path d="M958 139H926V148H958Z" fill="#FFD23F"/></g>`;
  }
  return P;
}
function surfDecor(on, t, title, u) {
  let back = '', sky = '', wave = '', defs = '';
  const emo = (x, y, e, s = 34) => `<text x="${x}" y="${y}" font-size="${s}" text-anchor="middle" class="bw-emo">${e}</text>`;
  if (on.has('gold')) { defs += `<linearGradient id="${u}gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDBA74" stop-opacity=".1"/><stop offset="1" stop-color="#FDE68A" stop-opacity=".75"/></linearGradient>`; sky += `<rect width="${BW}" height="${LIP}" fill="url(#${u}gs)"/><g stroke="#FDE68A" stroke-width="6" opacity=".5">${[-60, -30, 0, 30, 60].map(a => `<line x1="500" y1="170" x2="${500 + Math.sin(a * Math.PI / 180) * 520}" y2="${170 - Math.cos(a * Math.PI / 180) * 300}"/>`).join('')}</g>`; }
  if (on.has('tag_crew')) sky += `<path d="M0 22Q250 60 500 26T1000 26" stroke="#121212" stroke-width="2" fill="none"/>${Array.from({ length: 20 }, (_, i) => { const x = 20 + i * 50, y = 30 + Math.sin(i / 3) * 10; return `<path d="M${x - 12} ${y}H${x + 12}L${x} ${y + 20}Z" fill="${['#FF7A59', '#FFD23F', '#22D3EE', '#FF8FB1', '#34D399'][i % 5]}" stroke="#121212" stroke-width="1.5"/>`; }).join('')}`;
  if (on.has('classpiece')) sky += `<g transform="translate(70 64)"><path d="M0 0L40 -6L52 0L40 6Z" fill="#E5E7EB" stroke="#121212" stroke-width="2"/><path d="M18 -2L28 -18L34 -2ZM18 2L28 16L34 2Z" fill="#E0262C" stroke="#121212" stroke-width="2"/><line x1="0" y1="0" x2="-30" y2="4" stroke="#121212" stroke-width="1.5"/><rect x="-${30 + String(title).length * 13 + 20}" y="-10" width="${String(title).length * 13 + 20}" height="26" fill="#fff" stroke="#121212" stroke-width="2"/><text x="-${30 + (String(title).length * 13 + 20) / 2}" y="9" text-anchor="middle" font-family="'Shrikhand',cursive" font-size="17" fill="#E0262C">${esc(String(title).slice(0, 24))}</text></g>`.replace('translate(70 64)', `translate(${120 + String(title).length * 13} 64)`);
  if (on.has('legends')) sky += `${emo(860, 120, '🏆', 44)}<g fill="#FDE68A">${[[830, 90], [895, 88], [845, 130], [890, 128]].map(([x, y]) => `<path d="M${x} ${y - 7}L${x + 2} ${y - 2}L${x + 7} ${y}L${x + 2} ${y + 2}L${x} ${y + 7}L${x - 2} ${y + 2}L${x - 7} ${y}L${x - 2} ${y - 2}Z"/>`).join('')}</g>`;
  if (on.has('bolt')) back += `<g><line x1="96" y1="${LIP}" x2="96" y2="150" stroke="#6B4423" stroke-width="4"/><path d="M56 154Q96 120 136 154Z" fill="#FF7A59" stroke="#121212" stroke-width="2.5"/><path d="M76 154Q96 124 96 124Q96 124 116 154" fill="#FFD23F"/></g>`;
  if (on.has('hundred')) back += `<g stroke="#121212" stroke-width="3"><line x1="182" y1="${LIP}" x2="190" y2="150" /><line x1="226" y1="${LIP}" x2="218" y2="150"/><rect x="180" y="124" width="48" height="28" fill="#E0262C"/><path d="M174 126L204 108L234 126Z" fill="#fff"/></g><line x1="232" y1="124" x2="232" y2="92" stroke="#121212" stroke-width="3"/><rect x="232" y="92" width="34" height="22" fill="#fff" stroke="#121212" stroke-width="2"/><text x="249" y="109" text-anchor="middle" font-size="14" class="bw-emo">💯</text>`;
  if (on.has('aplus')) back += `<g transform="rotate(8 930 170)"><path d="M930 ${LIP + 4}Q914 170 922 120Q930 100 938 120Q946 170 930 ${LIP + 4}Z" fill="#FFE14D" stroke="#121212" stroke-width="3"/><text x="930" y="166" text-anchor="middle" font-family="'Archivo Black',sans-serif" font-size="15" fill="#E0262C">A+</text></g>`;
  if (on.has('shred')) back += `<g><line x1="820" y1="${LIP}" x2="820" y2="160" stroke="#6B4423" stroke-width="4"/><rect x="772" y="138" width="98" height="26" rx="4" fill="#D4A373" stroke="#6B4423" stroke-width="3"/><text x="821" y="157" text-anchor="middle" font-family="'Shrikhand',cursive" font-size="15" fill="#fff">SURF'S UP</text></g>`;
  if (on.has('flames')) back += [270, 420, 580, 730].map(x => `<line x1="${x}" y1="${LIP}" x2="${x}" y2="160" stroke="#6B4423" stroke-width="5"/><path d="M${x} 140Q${x - 9} 152 ${x} 162Q${x + 9} 152 ${x} 140Z" fill="#FF8A00"/><path d="M${x} 148Q${x - 4} 155 ${x} 161Q${x + 4} 155 ${x} 148Z" fill="#FFE14D"/>`).join('');
  if (on.has('brain')) back += emo(640, LIP - 2, '🏰', 30);
  if (on.has('fire')) back += emo(500, LIP - 2, '🔥', 28);
  if (on.has('board')) back += `<g>${['#22D3EE', '#FF7A59', '#FFE14D'].map((c, i) => `<path d="M${330 + i * 16} ${LIP}Q${322 + i * 16} 160 ${330 + i * 16} 128Q${338 + i * 16} 160 ${330 + i * 16} ${LIP}Z" fill="${c}" stroke="#121212" stroke-width="2"/>`).join('')}<rect x="318" y="182" width="52" height="5" fill="#6B4423"/></g>`;
  if (on.has('horns')) back += `${palm(990, LIP, .9)}<path d="M890 150Q940 176 990 136" stroke="#E0A458" stroke-width="5" fill="none"/>`;
  if (on.has('checker')) back += [[430, '#FF7A59'], [540, '#22D3EE']].map(([x, c]) => `<g transform="skewX(-20)"><rect x="${x + 70}" y="${LIP - 12}" width="46" height="12" fill="#fff" stroke="#121212" stroke-width="2"/><rect x="${x + 70}" y="${LIP - 12}" width="46" height="4" fill="${c}"/><rect x="${x + 70}" y="${LIP - 4}" width="46" height="4" fill="${c}"/></g>`).join('');
  if (on.has('crown')) wave += `${emo(420, 330, '🐬', 46)}${emo(600, 300, '🐬', 40)}`;
  return { back, sky, wave, defs };
}
function waveLayers(A, u) {
  const w = A.water, glow = A.glow ? `filter="url(#${u}glow)"` : '';
  let foam = 'M0 216'; for (let x = 0; x < BW; x += 40) foam += `Q${x + 20} ${x % 80 ? 206 : 224} ${x + 40} 216`;
  let spray = ''; const r = seeded(21); for (let i = 0; i < 40; i++) spray += `<circle cx="${(r() * BW).toFixed(0)}" cy="${(208 + r() * 10).toFixed(0)}" r="${(1 + r() * 2.4).toFixed(1)}" fill="${A.foam}" opacity=".9"/>`;
  let white = ''; for (let x = -10; x < 360; x += 26) white += `<circle cx="${x}" cy="${462 - (x % 3) * 3}" r="${16 + (x % 4) * 3}" fill="${A.foam}"/>`;
  return `<defs><linearGradient id="${u}wv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${w[0]}"/><stop offset=".45" stop-color="${w[1]}"/><stop offset="1" stop-color="${w[2]}"/></linearGradient></defs>
   <rect y="${LIP}" width="${BW}" height="${BH - LIP}" fill="url(#${u}wv)"/>
   <path d="${EDGE}Z" fill="#fff" opacity=".08"/>
   ${[0, 1, 2].map(i => `<path d="${EDGE}" transform="translate(${500 - 500 * (.92 - i * .1)} ${10 + i * 14}) scale(${(.92 - i * .1).toFixed(2)} 1)" fill="none" stroke="#fff" stroke-width="3" opacity="${(.22 - i * .05).toFixed(2)}"/>`).join('')}
   <ellipse cx="972" cy="320" rx="62" ry="104" fill="${w[2]}" opacity=".85"/><path d="M1000 214C930 214 900 260 906 320C912 380 960 410 1000 420" fill="none" stroke="${A.foam}" stroke-width="10" ${glow}/>
   <path d="${foam}" fill="none" stroke="${A.foam}" stroke-width="9" stroke-linecap="round" ${glow}/>${spray}
   <g opacity=".95" ${glow}>${white}</g>`;
}
function surfboardSVG(c) { return `<path d="M-44 0Q-12 -9 40 -3Q48 0 40 3Q-12 9 -44 0Z" fill="${c}" stroke="#121212" stroke-width="2.5"/><path d="M-30 0H30" stroke="#fff" stroke-width="2.5" opacity=".8"/>`; }

/* class achievements, parks and decorations */
const parkName = (id, w) => w === 'surf' ? (SURF_BREAKS[id] || {}).name || id : (PARKS.find(p => p.id === id) || {}).name || id;
const decorName = (id, w) => w === 'surf' ? SURF_DECOR[id] || id : (DECOR.find(d => d.id === id) || {}).name || id;
const trickName = (id, w) => w === 'surf' ? SURF_TRICKS[id] || id : (TRICKS.find(x => x.id === id) || {}).name || id;
const achName = (a, w) => w === 'surf' ? SURF_ACH[a.key] || a.name : a.name;
const worldOf = c => (c && c.world) === 'surf' ? 'surf' : 'skate';
function classUnlocks(cid) { return new Set(((S.progress[cid] || {}).unlocks || []).map(x => x.key)); }
function unlockedRewards(cid) {
  const keys = classUnlocks(cid), parks = new Set(['brickyard']), decor = new Set();
  for (const a of S.achievements) if (keys.has(a.key)) (a.reward_type === 'park' ? parks : decor).add(a.reward_id);
  return { parks, decor };
}
function classBowl(c) {
  const { parks, decor } = unlockedRewards(c.id), off = new Set(c.decor_off || []);
  return bowlScene(crewFor(c.id), classTheme(c), c.name, { world: worldOf(c), park: parks.has(c.park) ? c.park : 'brickyard', decor: new Set([...decor].filter(d => !off.has(d))) });
}
const METRIC = { focus_hours: ['h studied', v => Math.round(v * 10) / 10], quizzes: ['quizzes done', v => v], perfect: ['perfect scores', v => v], members: ['in the crew', v => v], riders: ['riding at once', v => v] };
function rewardName(a, w = 'skate') { return a.reward_type === 'park' ? parkName(a.reward_id, w) + (w === 'surf' ? ' (surf break)' : ' (park)') : decorName(a.reward_id, w); }
function achievementsPanel(c, teacher) {
  const w = worldOf(c), pr = S.progress[c.id]; if (!pr) return `<p class="muted">Loading achievements…</p>`;
  if (!S.achievements.length) return `<p class="muted">Achievements aren't set up yet.</p>`;
  const got = Object.fromEntries((pr.unlocks || []).map(x => [x.key, x])), st = pr.stats || {};
  const list = S.achievements.slice().sort((a, b) => a.sort - b.sort), nGot = list.filter(a => got[a.key]).length;
  const recent = Date.now() - 3 * 864e5;
  return `<div class="stack"><div class="row" style="gap:8px">${Object.entries(METRIC).map(([k, [lbl, f]]) => `<span class="chip">${f(st[k] || 0)} ${lbl}</span>`).join('')}<span class="chip ok">${nGot}/${list.length} unlocked</span></div>
   <div class="achgrid">${list.map(a => { const g = got[a.key], v = Number(st[a.metric] || 0), pct = Math.min(100, v / Number(a.threshold) * 100), isNew = g && new Date(g.at).getTime() > recent;
    return `<div class="ach ${g ? 'got' : ''}"><div class="row between" style="gap:6px"><b>${esc(achName(a, w))}</b>${g ? `<span class="chip ${isNew ? 'today' : 'ok'}">${isNew ? 'NEW!' : 'Unlocked'}</span>` : '<span class="chip">🔒</span>'}</div>
     <span class="small">${esc(w === 'surf' ? a.description.replace(/skaters/g, 'surfers').replace(/bowl/g, 'wave') : a.description)}</span><span class="small"><b>Reward:</b> ${esc(rewardName(a, w))}</span>
     ${g ? `<span class="small muted">${g.by_teacher ? 'Unlocked by teacher' : 'Unlocked'} ${esc(new Date(g.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }))}</span>` : `<div class="progress"><i style="width:${pct.toFixed(0)}%"></i></div><span class="small muted">${METRIC[a.metric][1](v)} / ${Number(a.threshold)} ${METRIC[a.metric][0]}</span>`}
     ${teacher ? (g ? (g.by_teacher ? `<div>${armBtn('relock|' + c.id + '|' + a.key, 'Lock again', 'Confirm')}</div>` : '') : `<div><button class="btn sm" data-act="unlockach" data-class="${c.id}" data-key="${esc(a.key)}">Unlock now</button></div>`) : ''}</div>`; }).join('')}</div></div>`;
}
async function loadProgress(cid) { try { S.progress[cid] = await rpc('class_progress', { p_class: cid }); } catch { S.progress[cid] = { stats: {}, unlocks: [] }; } render(); }

function crewFor(cid) {
  if (S.crew[cid] && S.crew[cid].length && 'week_min' in S.crew[cid][0]) return S.crew[cid];
  if (S.role === 'teacher') return studentsIn(cid).map(s => ({ nickname: s.nickname, color: s.color, equipped: s.equipped, lifetime: s.earned, focus_min: s.focus_min, week_min: S.crew[cid] ? 0 : undefined, tricks: s.tricks || [], is_me: false }));
  return S.crew[cid];
}
function bowlPass() {
  const need = Math.max(0, Number(site().bowl_hours) || 0) * 60, have = site().bowl_period === 'all' ? (S.me?.focus_min || 0) : S.weekMin, pct = need ? Math.min(100, have / need * 100) : 100;
  const done = have >= need && have > 0;
  return `<div class="pass ${done ? 'on' : ''}"><div class="row between"><span class="label">${W().pass}</span><b>${fmtH(have)} / ${fmtH(need)} ${periodWord()}</b></div><div class="progress"><i style="width:${pct.toFixed(0)}%"></i></div><span class="small">${done ? W().riding : `Study ${fmtH(need - have)} more in focus sessions to ${W().ride}.`}</span></div>`;
}
async function loadCrew(cid) {
  loadProgress(cid);
  try { S.crew[cid] = await rpc('class_crew', { p_class: cid }); }
  catch { try { S.crew[cid] = await rpc('class_leaderboard', { p_class: cid }); } catch { S.crew[cid] = []; } }
  render();
}

/* ---------------- TEACHER ---------------- */
function tHome() {
  const st = site(), t = siteTheme(), cls = S.classes.slice().sort(byOrder);
  const cards = cls.map(c => { const ct = classTheme(c); return sticker(ct, c.name, (ct.decor || [])[0], `<span class="small muted">${esc(c.subtitle || '')}</span><div class="row" style="gap:6px"><span class="chip">Code ${esc(c.code)}</span><span class="chip">${studentsIn(c.id).length} ${WORDS[worldOf(c)].riders}</span><span class="chip">${unitsOf(c.id).length} units</span></div>`, `data-act="openclass" data-id="${c.id}"`, classFont(c)); }).join('');
  return { theme: t, html: banner(t, { eyebrow: st.teacher_name ? `${st.teacher_name}'s HQ` : 'Teacher HQ', title: 'Your classes', sub: 'Make a class, hand out its join code, then load each unit with notes, files, videos and revision quizzes.' }) + `
  <main class="wrap">
   ${cls.length ? `<div class="grid">${cards}</div>` : `<div class="empty"><strong>No classes yet</strong><span>Make your first one below. Each class gets its own join code.</span></div>`}
   <form class="panel taped stack" data-form="newclass"><h2>New class</h2>
    <div class="formrow"><label class="f">Class name<input type="text" id="nc-name" required placeholder="e.g. Year 9 Science"></label>
    <label class="f">Short description<input type="text" id="nc-sub" placeholder="e.g. Period 3 · Room S4"></label>
    <label class="f">World<select id="nc-world"><option value="skate">🛹 Skatepark</option><option value="surf" ${WORLD === 'surf' ? 'selected' : ''}>🏄 Surf beach</option></select></label>
    <label class="f">Theme<select id="nc-theme"><optgroup label="Skatepark themes">${THEMES.filter(t => t.world === 'skate').map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</optgroup><optgroup label="Surf themes">${THEMES.filter(t => t.world === 'surf').map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</optgroup>${S.themes.length ? `<optgroup label="Your themes">${S.themes.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</optgroup>` : ''}</select></label>
    <button class="btn primary">Create class</button></div></form>
  </main>` };
}
function tClass() {
  const c = S.classes.find(x => x.id === S.view.classId); if (!c) return tHome();
  const t = classTheme(c), tab = S.ui.tab;
  const tabs = [['board', 'Whiteboard'], ['units', 'Units'], ['revision', 'Revision quizzes'], ['markbook', 'Markbook'], ['students', W().Riders], ['tricks', 'Tricks'], ['bowl', `${W().Scene} & achievements`], ['log', 'Log'], ['settings', 'Class settings']];
  let body = '';
  if (tab === 'units') {
    const us = unitsOf(c.id);
    body = `${us.length ? `<div class="stack">${us.map(u => { const ut = unitTheme(u); return `<div class="row" style="flex-wrap:nowrap;gap:8px"><button class="unitcard" data-act="openunit" data-id="${u.id}"><span class="sw" style="background:linear-gradient(120deg,${ut.b1},${ut.b2})" aria-hidden="true">${esc((ut.decor || [])[0] || '')}</span><span class="txt"><strong>${esc(u.title)}</strong><span class="small muted">${resOf(u.id).length} resources · ${S.quizzes.filter(x => x.unit_id === u.id).length} quizzes · ${esc(ut.name)}</span></span>${u.hidden ? '<span class="chip warn">Hidden</span>' : ''}</button><div class="stack" style="gap:4px"><button class="iconbtn" data-act="unitmove" data-id="${u.id}" data-dir="-1" aria-label="Move up">↑</button><button class="iconbtn" data-act="unitmove" data-id="${u.id}" data-dir="1" aria-label="Move down">↓</button></div></div>`; }).join('')}</div>` : `<div class="empty"><strong>No units yet</strong><span>Add your first unit of work. Each unit can rock its own theme.</span></div>`}
    <form class="panel stack" data-form="newunit"><h3>Add a unit</h3><div class="formrow"><label class="f">Unit title<input type="text" id="nu-title-${c.id}" required placeholder="e.g. Unit 2: Chemical reactions"></label><label class="f">Theme<select id="nu-theme-${c.id}">${themeOptions('', true)}</select></label><button class="btn primary">Add unit</button></div></form>`;
  } else if (tab === 'revision') {
    const qs = S.quizzes.filter(x => x.class_id === c.id).sort(byOrder);
    body = `<div class="section-h"><p class="muted">${W().Riders} earn coins for each correct answer, once per quiz per day.</p><button class="btn primary" data-act="newquiz" data-class="${c.id}">New quiz</button></div>
    ${qs.length ? `<div class="stack">${qs.map(x => { const u = S.units.find(y => y.id === x.unit_id); return `<div class="res"><span class="chip kind">QUIZ</span><div class="body"><strong>${esc(x.title)}</strong><span class="small muted">${(x.questions || []).length} questions · ${x.per} coins per correct answer${u ? ' · ' + esc(u.title) : ''}</span></div><div class="row" style="gap:6px"><button class="btn sm" data-act="editquiz" data-id="${x.id}">Edit</button>${armBtn('quiz|' + x.id, 'Delete', 'Confirm')}</div></div>`; }).join('')}</div>` : `<div class="empty"><strong>No quizzes yet</strong><span>Quizzes are how ${W().riders} earn coins from revision.</span></div>`}`;
  } else if (tab === 'students') {
    const st = studentsIn(c.id).sort((a, b) => b.earned - a.earned);
    body = st.length ? `<div class="panel"><div class="tablewrap"><table><thead><tr><th>${W().rider[0].toUpperCase() + W().rider.slice(1)}</th><th>Real name</th><th></th><th>Coins</th><th>Focus (all time)</th><th>Quizzes</th><th>Give coins</th><th>Reset PIN</th><th></th></tr></thead><tbody>${st.map(s => `<tr>
     <td><b>${esc(s.nickname)}</b></td><td><div class="row" style="gap:4px;flex-wrap:nowrap"><input type="text" id="rn-${s.id}" value="${esc(s.real_name || '')}" placeholder="Add name" style="width:140px" aria-label="Real name for ${esc(s.nickname)}"><button class="btn sm" data-act="realname" data-id="${s.id}">Save</button></div></td><td>${charSVG(eqOf(s), s.color)}</td><td class="num">${balance(s)}</td><td class="num">${fmtH(s.focus_min)}</td><td class="num">${s.quizzes_done}</td>
     <td><div class="row" style="gap:4px;flex-wrap:nowrap"><input type="number" id="aw-${s.id}" value="10" style="width:80px" aria-label="Coins to give ${esc(s.nickname)}"><button class="btn sm coinbtn" data-act="award" data-id="${s.id}">Give</button></div></td>
     <td><div class="row" style="gap:4px;flex-wrap:nowrap"><input type="text" id="rp-${s.id}" maxlength="4" inputmode="numeric" placeholder="0000" style="width:80px" aria-label="New PIN for ${esc(s.nickname)}"><button class="btn sm" data-act="resetpin" data-id="${s.id}">Set</button></div></td>
     <td><div class="row" style="gap:4px;flex-wrap:nowrap">${armBtn('kick|' + s.id + '|' + c.id, 'Remove', 'Confirm')}</div></td></tr>`).join('')}</tbody></table></div></div>
     <p class="small muted">Type a negative number to take coins back. "Remove" takes the ${W().rider} out of this class only; they keep their coins and gear. A ${W().rider} who forgets their PIN can be given a new one here.</p>`
      : `<div class="empty"><strong>No ${W().riders} yet</strong><span>Give your class the website link and the join code <b>${esc(c.code)}</b>.</span></div>`;
  } else if (tab === 'board') {
    body = `<div class="panel stack"><p>Type instructions, draw and run a timer. Put it up full screen on your projector. Students see it live at the top of their class page.</p><div><button class="btn primary big" data-act="openboard" data-id="${c.id}">Open whiteboard</button></div></div><h3>What students see</h3>${boardPanel(c, true)}`;
  } else if (tab === 'markbook') {
    body = markbookTab(c);
  } else if (tab === 'tricks') {
    body = tricksTab(c);
  } else if (tab === 'bowl') {
    body = bowlTab(c);
  } else if (tab === 'log') {
    body = logTab(c);
  } else {
    body = `<form class="panel stack" data-form="classset" data-id="${c.id}"><h3>Class details</h3>
    <div class="formrow"><label class="f">Class name<input type="text" id="cs-name-${c.id}" value="${esc(c.name)}" required></label><label class="f">Short description<input type="text" id="cs-sub-${c.id}" value="${esc(c.subtitle || '')}"></label></div>
    <label class="f">Announcement (shown at the top of the class page)<textarea id="cs-ann-${c.id}" placeholder="e.g. Test on Friday! Revise unit 2.">${esc(c.announcement || '')}</textarea></label>
    <div><button class="btn primary">Save changes</button></div></form>
    <div class="panel stack"><h3>Class world</h3><p class="small muted">Each class lives in its own world. Switching changes the look, fonts, scene, shop, tricks and wording for this class. Unlocks, coins and gear carry over.</p>
     <div class="worldpick">${[['skate', '🛹', 'Skatepark', 'Punk zine look, skate bowl, graffiti and stickers.'], ['surf', '🏄', 'Surf beach', 'Sunny retro surf look, a rolling wave, beach upgrades.']].map(([k, e, n, d]) => `<button class="wp wp-${k}" aria-pressed="${worldOf(c) === k}" data-act="setworld" data-id="${c.id}" data-world="${k}"><span class="wp-e">${e}</span><b>${n}</b><span class="small">${d}</span></button>`).join('')}</div></div>
    <div class="panel stack"><h3>Class name font</h3><p class="small muted">Used for this class's title and headings.</p>${fontPicker(c.heading_font || '', 'setclassfont', `data-id="${c.id}"`, true)}</div>
    <div class="panel stack"><h3>Class theme</h3><div class="themepick">${allThemes().map(th => themeTile(th, (c.theme_id || 'griptape') === th.id, `data-act="setclasstheme" data-id="${c.id}" data-theme="${esc(th.id)}"`)).join('')}</div></div>
    <div class="panel stack"><h3>Join code</h3><div class="row"><span style="font-family:var(--f-display);font-size:36px;letter-spacing:.15em">${esc(c.code)}</span><button class="btn" data-act="copy" data-text="${esc(c.code)}">Copy</button><button class="btn" data-act="newcode" data-id="${c.id}">Make a new code</button></div><p class="small muted">A new code stops the old one working. ${W().Riders} already in the class stay in it.</p></div>
    <div class="panel stack"><h3>Delete class</h3><p class="small muted">Deletes the class with all its units, resources, uploaded files and quizzes. ${W().Riders} keep their coins and gear.</p><div>${armBtn('class|' + c.id, 'Delete this class', 'Yes, delete everything')}</div></div>`;
  }
  return { theme: t, font: classFont(c), html: banner(t, { eyebrow: c.subtitle || 'Class', title: c.name, back: { act: 'nav', attrs: 'data-to="home"', label: 'All classes' }, code: c.code }) + `<main class="wrap">${classBowl(c)}<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</div>${c.announcement && tab === 'units' ? `<div class="notice"><b>Announcement:</b> ${esc(c.announcement)}</div>` : ''}${body}</main>` };
}
function tUnit() {
  const u = S.units.find(x => x.id === S.view.unitId); if (!u) return tHome();
  const c = S.classes.find(x => x.id === u.class_id), t = unitTheme(u), rs = resOf(u.id), k = S.ui.resKind, qs = S.quizzes.filter(x => x.unit_id === u.id);
  const fields = k === 'file' ? `<label class="f">File<input type="file" id="nr-file"></label>`
    : k === 'note' ? `<label class="f" style="flex-basis:100%">Note<textarea id="nr-note-${u.id}" placeholder="Key ideas, instructions, homework…"></textarea></label>`
    : `<label class="f">${k === 'youtube' ? 'YouTube link' : 'Web address'}<input type="url" id="nr-url-${u.id}" placeholder="${k === 'youtube' ? 'https://www.youtube.com/watch?v=…' : 'https://…'}"></label>`;
  return { theme: t, font: classFont(c), html: banner(t, { eyebrow: c ? c.name : 'Unit', title: u.title, sub: u.description || '', back: { act: 'openclass', attrs: `data-id="${u.class_id}"`, label: 'Back to class' } }) + `
  <main class="wrap"><div class="split"><div class="stack">
   <div class="section-h"><h2>Resources</h2>${u.hidden ? `<span class="chip warn">Hidden from ${W().riders}</span>` : `<span class="chip ok">Visible to ${W().riders}</span>`}</div>
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
    <label class="row small" style="gap:8px;font-weight:700"><input type="checkbox" id="us-hidden-${u.id}" ${u.hidden ? 'checked' : ''}> Hide from ${W().riders}</label>
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
  const prev = { ...d, decor: d.decor.split(/\s+/).filter(Boolean) }, t = siteTheme();
  return { theme: t, html: banner(t, { eyebrow: 'Look & feel', title: 'Themes', sub: 'Choose a theme for each class or unit from its settings. Make your own here.' }) + `
  <main class="wrap">
   <div class="stack"><h2>Built-in themes</h2><div class="themepick">${THEMES.map(th => themeTile(th, false, 'tabindex="-1" style="cursor:default"')).join('')}</div></div>
   <div class="stack"><h2>Your themes</h2>${S.themes.length ? `<div class="themepick">${S.themes.map(th => `<div class="stack" style="gap:8px">${themeTile(th, S.customDraft?.id === th.id, `data-act="edittheme" data-id="${th.id}"`)}<div>${armBtn('theme|' + th.id, 'Delete', 'Confirm')}</div></div>`).join('')}</div>` : '<p class="muted">No custom themes yet. Tap one to edit it once you have some.</p>'}</div>
   <form class="panel taped stack" data-form="savetheme"><h2>${d.id ? 'Edit theme' : 'Make a theme'}</h2>
    <section class="banner" id="th-preview" style="${themeVars(prev)}"><div class="decor" aria-hidden="true">${prev.decor.slice(0, 4).map(e => `<span>${esc(e)}</span>`).join('')}</div><div class="wrap" style="padding-block:22px"><span class="eyebrow">Preview</span><h2 style="font-size:32px">${esc(d.name || 'My theme')}</h2><span><span class="btn sm primary" style="pointer-events:none">Button colour</span></span></div></section>
    <div class="formrow"><label class="f">Theme name<input type="text" id="th-name" data-tb="name" value="${esc(d.name)}" required placeholder="e.g. Bowl Session"></label>
    <label class="f">Decorations (emoji with spaces between)<input type="text" id="th-decor" data-tb="decor" value="${esc(d.decor)}"></label>
    <label class="f" style="flex:0 1 160px">Pattern<select id="th-pattern" data-tb="pattern">${Object.keys(PATTERNS).map(p => `<option ${d.pattern === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>
    <div class="row"><label class="row small" style="gap:6px;font-weight:700"><input type="color" id="th-b1" data-tb="b1" value="${d.b1}"> Banner colour 1</label><label class="row small" style="gap:6px;font-weight:700"><input type="color" id="th-b2" data-tb="b2" value="${d.b2}"> Banner colour 2</label><label class="row small" style="gap:6px;font-weight:700"><input type="color" id="th-accent" data-tb="accent" value="${d.accent}"> Button colour</label></div>
    <div class="row"><button class="btn primary">${d.id ? 'Save changes' : 'Save theme'}</button>${d.id ? '<button type="button" class="btn" data-act="newthemedraft">Start a new theme</button>' : ''}</div></form>
  </main>` };
}
function tSettings() {
  const st = site(), t = siteTheme();
  return { theme: t, html: banner(t, { eyebrow: 'Settings', title: 'Classroom settings' }) + `
  <main class="wrap"><form class="panel taped stack" data-form="site"><h2>Your site</h2>
   <div class="formrow"><label class="f">Website name<input type="text" id="st-name" value="${esc(st.site_name)}"></label><label class="f">Your name as students see it<input type="text" id="st-teacher" value="${esc(st.teacher_name)}" placeholder="e.g. Mr T"></label><label class="f">Home page theme<select id="st-theme">${themeOptions(st.home_theme)}</select></label></div>
   <h3>Coin rules</h3>
   <div class="formrow"><label class="f">Coins per focus minute<input type="number" min="0" max="10" id="st-rate" value="${st.focus_rate}"></label><label class="f">Daily focus coin limit<input type="number" min="0" id="st-fcap" value="${st.focus_cap}"></label><label class="f">Daily quiz coin limit<input type="number" min="0" id="st-qcap" value="${st.quiz_cap}"></label><label class="f">Welcome bonus<input type="number" min="0" id="st-welcome" value="${st.welcome}"></label></div>
   <h3>World for home pages</h3><p class="small muted">Used for the sign-in page, your class list and settings. Each class picks its own world in Class settings.</p>
   <div class="worldpick">${[['skate', '🛹', 'Skatepark'], ['surf', '🏄', 'Surf beach']].map(([k, e, n]) => `<button type="button" class="wp wp-${k}" aria-pressed="${(st.home_world || 'skate') === k}" data-act="sethomeworld" data-world="${k}"><span class="wp-e">${e}</span><b>${n}</b></button>`).join('')}</div>
   <h3>Heading font</h3><p class="small muted">Used for class names and big headings everywhere. Each class can override this in its Class settings. Click to switch.</p>${fontPicker(st.heading_font, 'setsitefont')}
   <h3>The bowl / wave</h3>
   <div class="formrow"><label class="f">Hours of focus to ride the bowl or wave<input type="number" min="0" max="100" step="0.5" id="st-bowlh" value="${st.bowl_hours}"></label><label class="f">Count hours<select id="st-bowlp"><option value="week" ${st.bowl_period !== 'all' ? 'selected' : ''}>This week (resets every Monday)</option><option value="all" ${st.bowl_period === 'all' ? 'selected' : ''}>All time</option></select></label></div>
   <div><button class="btn primary">Save settings</button></div></form>
   <div class="panel stack"><h2>Shop prices</h2><p>Change any price or name in Supabase under <b>Table Editor → shop_items</b>. Changes show up next time the page loads.</p></div>
  </main>` };
}


/* ---------------- teacher log ---------------- */
const LOG_CATS = [['positive', '⭐', 'Positive behaviour'], ['concern', '⚠️', 'Behaviour concern'], ['hw_done', '✅', 'Homework done'], ['hw_missing', '❌', 'Homework missing'], ['note', '📝', 'Note']];
const catOf = k => LOG_CATS.find(x => x[0] === k) || LOG_CATS[4];
const tname = s => s ? (s.real_name ? `${s.real_name} (${s.nickname})` : s.nickname) : 'Removed student';
const todayStr = () => new Date().toLocaleDateString('en-CA');
function fmtDate(d) { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return x.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }); }
function logTab(c) {
  const st = studentsIn(c.id).sort((a, b) => tname(a).localeCompare(tname(b)));
  if (!st.length) return `<div class="empty"><strong>No ${W().riders} yet</strong><span>Once students join with code <b>${esc(c.code)}</b> you can log behaviour and homework here.</span></div>`;
  const cat = S.ui.logCat || 'positive', fs = S.ui.logStudent || '', fc = S.ui.logFilterCat || '';
  const notes = S.notes.filter(n => n.class_id === c.id), byId = Object.fromEntries(S.students.map(x => [x.id, x]));
  const shown = notes.filter(n => (!fs || n.student_id === fs) && (!fc || n.category === fc));
  const counts = {}; for (const n of notes) { const k = counts[n.student_id] || (counts[n.student_id] = {}); k[n.category] = (k[n.category] || 0) + 1; }
  return `<form class="panel taped stack" data-form="logadd" data-id="${c.id}"><h3>Quick log</h3>
   <div class="row" role="radiogroup" aria-label="Type of entry">${LOG_CATS.map(([k, e, l]) => `<button type="button" class="btn sm ${cat === k ? 'primary' : ''}" aria-pressed="${cat === k}" data-act="logcat" data-cat="${k}">${e} ${l}</button>`).join('')}</div>
   <div class="formrow"><label class="f">${cat.startsWith('hw') ? 'Homework task' : 'What happened?'}<input type="text" id="lg-note-${c.id}" maxlength="300" placeholder="${cat.startsWith('hw') ? 'e.g. Chapter 3 worksheet' : 'e.g. Helped a classmate with the prac'}"></label>
   <label class="f" style="flex:0 1 180px">Date<input type="date" id="lg-date-${c.id}" value="${todayStr()}"></label>
   <label class="f" style="flex:0 1 150px">Also give coins<input type="number" id="lg-coins-${c.id}" value="0"></label></div>
   <div class="row between"><span class="label">Students</span><span class="row" style="gap:6px"><button type="button" class="btn sm" data-act="logall" data-on="1">Select all</button><button type="button" class="btn sm" data-act="logall" data-on="0">Clear</button></span></div>
   <div class="checkgrid">${st.map(x => `<label class="ck"><input type="checkbox" id="lg-s-${x.id}" data-logstu="${x.id}">${charSVG(eqOf(x), x.color)}<span>${esc(tname(x))}</span></label>`).join('')}</div>
   <div><button class="btn primary" ${S.ui.busy ? 'disabled' : ''}>Save to log</button></div>
   <p class="small muted">Tick everyone it applies to and save once. For a homework check, pick "Homework done", type the task, and tick the students who handed it in. Students never see this log.</p></form>
  <div class="panel stack"><h3>Summary</h3><div class="tablewrap"><table><thead><tr><th>Student</th>${LOG_CATS.map(([k, e, l]) => `<th title="${l}">${e}</th>`).join('')}<th>Latest</th></tr></thead><tbody>
   ${st.map(x => { const k = counts[x.id] || {}, last = notes.find(n => n.student_id === x.id); return `<tr><td><button class="linkbtn" data-act="logfilter" data-stu="${x.id}">${esc(tname(x))}</button></td>${LOG_CATS.map(([cc]) => `<td class="num">${k[cc] || ''}</td>`).join('')}<td class="small muted">${last ? `${catOf(last.category)[1]} ${esc(fmtDate(last.logged_on))}` : '—'}</td></tr>`; }).join('')}</tbody></table></div></div>
  <div class="panel stack"><div class="section-h"><h3>Entries</h3><button class="btn sm" data-act="logcsv" data-id="${c.id}">Download CSV</button></div>
   <div class="formrow"><label class="f">Student<select id="lgf-stu" data-logf="stu"><option value="">Everyone</option>${st.map(x => `<option value="${x.id}" ${fs === x.id ? 'selected' : ''}>${esc(tname(x))}</option>`).join('')}</select></label>
   <label class="f">Type<select id="lgf-cat" data-logf="cat"><option value="">All types</option>${LOG_CATS.map(([k, e, l]) => `<option value="${k}" ${fc === k ? 'selected' : ''}>${e} ${l}</option>`).join('')}</select></label></div>
   ${shown.length ? `<div class="loglist">${shown.slice(0, 200).map(n => { const [, e, l] = catOf(n.category); return `<div class="logrow cat-${n.category}"><span class="logdate">${esc(fmtDate(n.logged_on))}</span><span class="chip" title="${l}">${e} ${l}</span><b>${esc(tname(byId[n.student_id]))}</b><span class="lognote">${esc(n.note)}${n.coins ? ` <span class="price">(${n.coins > 0 ? '+' : ''}${n.coins} <span class="coin"></span>)</span>` : ''}</span>${armBtn('log|' + n.id, '×', 'Delete')}</div>`; }).join('')}</div>${shown.length > 200 ? `<p class="small muted">Showing the latest 200. Download the CSV for everything.</p>` : ''}` : '<p class="muted">No entries yet.</p>'}</div>`;
}

/* ---------------- to-do lists ---------------- */
function sortedTodos() { return S.todos.slice().sort((a, b) => (a.done - b.done) || String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(a.created_at).localeCompare(String(b.created_at))); }
function dueChip(d, done) {
  if (!d) return ''; const t = todayStr(), tm = new Date(); tm.setDate(tm.getDate() + 1); const tom = tm.toLocaleDateString('en-CA');
  const cls = done ? '' : d < t ? 'warn' : d === t ? 'today' : '';
  return `<span class="chip ${cls}">${d < t && !done ? 'Overdue · ' : ''}${d === t ? 'Today' : d === tom ? 'Tomorrow' : esc(fmtDate(d))}</span>`;
}
function todoRow(x) {
  return `<li class="todo ${x.done ? 'done' : ''}"><button class="tick" data-act="todotoggle" data-id="${x.id}" aria-pressed="${x.done}" aria-label="${x.done ? 'Mark not done' : 'Mark done'}: ${esc(x.text)}">${x.done ? '✓' : ''}</button><span class="ttext">${esc(x.text)}</span>${dueChip(x.due, x.done)}<button class="iconbtn" data-act="tododel" data-id="${x.id}" aria-label="Delete ${esc(x.text)}">×</button></li>`;
}
function todoPage() {
  const t = S.role === 'teacher' ? siteTheme() : homeTheme(), list = sortedTodos(), open = list.filter(x => !x.done), done = list.filter(x => x.done);
  return { theme: t, html: banner(t, { eyebrow: S.role === 'teacher' ? 'Teacher HQ' : 'Stay on top of it', title: 'To-do list', sub: S.role === 'teacher' ? 'Your own list. Students never see it.' : 'Only you can see this list. Tick things off as you smash them.' }) + `
  <main class="wrap"><div class="split"><div class="stack">
   <form class="panel taped stack" data-form="todoadd"><h3>Add a task</h3><div class="formrow"><label class="f">Task<input type="text" id="td-text" maxlength="200" required placeholder="${S.role === 'teacher' ? 'e.g. Mark Year 9 tests' : 'e.g. Finish science worksheet'}"></label><label class="f" style="flex:0 1 180px">Due (optional)<input type="date" id="td-due"></label><button class="btn primary">Add</button></div></form>
   <div class="panel stack"><h3>To do (${open.length})</h3>${open.length ? `<ul class="todos">${open.map(todoRow).join('')}</ul>` : '<p class="muted">All clear. Nice.</p>'}</div>
   ${done.length ? `<div class="panel stack"><div class="section-h"><h3>Done (${done.length})</h3><button class="btn sm" data-act="todoclear">Clear done</button></div><ul class="todos">${done.map(todoRow).join('')}</ul></div>` : ''}
  </div><div class="stack">${S.role === 'student' ? bowlPass() : ''}</div></div></main>` };
}
function todoPeek() {
  const open = sortedTodos().filter(x => !x.done);
  return `<div class="panel stack"><div class="section-h"><h3>Up next</h3><button class="btn sm" data-act="nav" data-to="todo">Open to-do list</button></div>${open.length ? `<ul class="todos">${open.slice(0, 3).map(todoRow).join('')}</ul>${open.length > 3 ? `<p class="small muted">+${open.length - 3} more</p>` : ''}` : '<p class="small muted">Nothing on your list. Add homework and study tasks so you don\'t forget them.</p>'}</div>`;
}

/* ---------------- markbook ---------------- */
function mbPick(list, mode) {
  if (!list.length) return null;
  if (mode === 'first') return list[0];
  if (mode === 'latest') return list[list.length - 1];
  return list.reduce((b, a) => (a.total ? a.score / a.total : 0) > (b.total ? b.score / b.total : 0) ? a : b, list[0]);
}
const pctCls = p => p >= .8 ? 'hi' : p >= .5 ? 'mid' : 'lo';
function markbookTab(c) {
  const qs = S.quizzes.filter(x => x.class_id === c.id).sort(byOrder), st = studentsIn(c.id).sort((a, b) => tname(a).localeCompare(tname(b)));
  if (!qs.length) return `<div class="empty"><strong>No quizzes yet</strong><span>Make a quiz in Revision quizzes and results will appear here.</span></div>`;
  if (!st.length) return `<div class="empty"><strong>No ${W().riders} yet</strong><span>Results appear once students join and take quizzes.</span></div>`;
  const mode = S.ui.mbMode || 'best', ids = new Set(qs.map(x => x.id)), att = S.attempts.filter(a => ids.has(a.quiz_id));
  const by = {}; for (const a of att) (by[a.student_id + '|' + a.quiz_id] ||= []).push(a);
  const cell = (sid, qid) => mbPick(by[sid + '|' + qid] || [], mode);
  const colAvg = qs.map(x => { const v = st.map(s => cell(s.id, x.id)).filter(Boolean).map(a => a.total ? a.score / a.total : 0); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; });
  const head = qs.map((x, i) => `<th class="mbq"><button class="linkbtn ${S.ui.mbQuiz === x.id ? 'sel' : ''}" data-act="mbquiz" data-id="${x.id}" title="Show question breakdown">${esc(x.title)}</button><span class="small muted">${colAvg[i] == null ? '—' : Math.round(colAvg[i] * 100) + '% avg'}</span></th>`).join('');
  const rows = st.map(s => {
    const vals = []; const tds = qs.map(x => { const a = cell(s.id, x.id), n = (by[s.id + '|' + x.id] || []).length; if (!a) return `<td class="mbc none">—</td>`; const p = a.total ? a.score / a.total : 0; vals.push(p);
      return `<td class="mbc ${pctCls(p)}"><button data-act="mbcell" data-s="${s.id}" data-q="${x.id}" title="See all attempts">${a.score}/${a.total}${n > 1 ? `<sup>×${n}</sup>` : ''}</button></td>`; }).join('');
    const avg = vals.length ? vals.reduce((p, q) => p + q, 0) / vals.length : null;
    return `<tr><th scope="row">${esc(tname(s))}</th>${tds}<td class="num mbavg ${avg == null ? '' : pctCls(avg)}">${avg == null ? '—' : Math.round(avg * 100) + '%'}</td></tr>`;
  }).join('');
  let detail = '';
  if (S.ui.mbCell) {
    const [sid, qid] = S.ui.mbCell.split('|'), s = S.students.find(x => x.id === sid), qz = S.quizzes.find(x => x.id === qid), list = by[S.ui.mbCell] || [];
    if (s && qz) detail = `<div class="panel stack"><div class="section-h"><h3>${esc(tname(s))} · ${esc(qz.title)}</h3><button class="btn sm" data-act="mbcell" data-s="" data-q="">Close</button></div>
      <div class="tablewrap"><table><thead><tr><th>Attempt</th><th>Date</th><th>Score</th><th>Coins</th>${(qz.questions || []).map((_, i) => `<th>Q${i + 1}</th>`).join('')}</tr></thead><tbody>
      ${list.map((a, i) => `<tr><td class="num">${i + 1}</td><td>${esc(new Date(a.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</td><td class="num mbc ${pctCls(a.total ? a.score / a.total : 0)}">${a.score}/${a.total}</td><td class="num">${a.coins}</td>${(qz.questions || []).map((qq, k) => { const ans = a.answers ? a.answers[k] : undefined; return ans === undefined || ans === null ? `<td class="muted">${a.answers ? '–' : '?'}</td>` : `<td title="${esc(qq.options[ans] || '')}">${ans === qq.answer ? '✅' : '❌'}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>${list.some(a => !a.answers) ? '<p class="small muted">? = taken before answers were recorded.</p>' : ''}</div>`;
  }
  if (S.ui.mbQuiz && qs.some(x => x.id === S.ui.mbQuiz)) {
    const qz = qs.find(x => x.id === S.ui.mbQuiz), picks = st.map(s => cell(s.id, qz.id)).filter(a => a && a.answers), missing = st.filter(s => !cell(s.id, qz.id));
    detail += `<div class="panel stack"><div class="section-h"><h3>Question breakdown · ${esc(qz.title)}</h3><button class="btn sm" data-act="mbquiz" data-id="">Close</button></div>
     <p class="small muted">Based on each student's ${mode === 'best' ? 'best' : mode === 'latest' ? 'latest' : 'first'} attempt (${picks.length} with answers recorded).</p>
     ${picks.length ? `<div class="stack">${(qz.questions || []).map((qq, k) => { const got = picks.filter(a => a.answers[k] === qq.answer).length, p = got / picks.length, wrong = {}; picks.forEach(a => { const v = a.answers[k]; if (v != null && v !== qq.answer) wrong[v] = (wrong[v] || 0) + 1; }); const top = Object.entries(wrong).sort((x, y) => y[1] - x[1])[0];
       return `<div class="qrow"><div class="row between" style="gap:8px"><b>Q${k + 1}. ${esc(qq.q)}</b><span class="chip mbc ${pctCls(p)}">${Math.round(p * 100)}% correct</span></div><div class="progress"><i style="width:${Math.round(p * 100)}%"></i></div><span class="small muted">Answer: ${esc(qq.options[qq.answer])}${top ? ` · Most common wrong answer: <b>${esc(qq.options[top[0]] || '?')}</b> (${top[1]})` : ''}</span></div>`; }).join('')}</div>` : '<p class="muted">No attempts with recorded answers yet.</p>'}
     ${missing.length ? `<p class="small"><b>Not attempted yet:</b> ${missing.map(s => esc(tname(s))).join(', ')}</p>` : ''}</div>`;
  }
  return `<div class="row between"><div class="tabs" role="tablist" aria-label="Which attempt">${[['best', 'Best attempt'], ['latest', 'Latest attempt'], ['first', 'First attempt']].map(([k, l]) => `<button role="tab" aria-selected="${mode === k}" data-act="mbmode" data-m="${k}">${l}</button>`).join('')}</div><button class="btn sm" data-act="mbcsv" data-id="${c.id}">Download CSV</button></div>
   <div class="panel"><div class="tablewrap"><table class="mb"><thead><tr><th>Student</th>${head}<th>Average</th></tr></thead><tbody>${rows}</tbody></table></div>
   <p class="small muted" style="margin-top:8px">Green 80%+, yellow 50–79%, red under 50%. ×2 means two attempts. Click a quiz name for a question-by-question breakdown, or a score to see every attempt.</p></div>${detail}`;
}

/* ---------------- tricks ---------------- */
function tricksTab(c) {
  const st = studentsIn(c.id).sort((a, b) => tname(a).localeCompare(tname(b)));
  if (!st.length) return `<div class="empty"><strong>No ${W().riders} yet</strong><span>Unlock tricks once students join.</span></div>`;
  const has = (s, k) => (s.tricks || []).includes(k);
  return `<div class="panel stack"><p>Unlock tricks as rewards. ${W().Riders} pull their tricks in the ${W().scene} whenever they're riding (they need their ${W().pass.toLowerCase()}). Each lip hit plays the next trick they've unlocked.</p>
   <div class="tablewrap"><table class="tt"><thead><tr><th>${W().rider[0].toUpperCase() + W().rider.slice(1)}</th>${TRICKS.map(k => `<th><span class="tth">${k.emoji}<br>${esc(trickName(k.id, WORLD))}</span></th>`).join('')}<th></th></tr>
   <tr><th class="small muted">Whole class</th>${TRICKS.map(k => { const all = st.every(s => has(s, k.id)); return `<th><button class="btn sm" data-act="trickall" data-class="${c.id}" data-trick="${k.id}">${all ? 'None' : 'All'}</button></th>`; }).join('')}<th></th></tr></thead>
   <tbody>${st.map(s => { const n = (s.tricks || []).length; return `<tr><th scope="row"><span class="row" style="gap:6px;flex-wrap:nowrap">${charSVG(eqOf(s), s.color)}${esc(tname(s))}</span></th>${TRICKS.map(k => `<td><button class="tg" aria-pressed="${has(s, k.id)}" aria-label="${esc(trickName(k.id, WORLD))} for ${esc(s.nickname)}" data-act="settrick" data-id="${s.id}" data-class="${c.id}" data-trick="${k.id}">${has(s, k.id) ? '✓' : ''}</button></td>`).join('')}<td><button class="btn sm" data-act="trickrow" data-id="${s.id}" data-class="${c.id}">${n === TRICKS.length ? 'Clear' : 'All'}</button></td></tr>`; }).join('')}</tbody></table></div></div>`;
}

/* ---------------- bowl & achievements ---------------- */
function bowlTab(c) {
  const { parks, decor } = unlockedRewards(c.id), off = new Set(c.decor_off || []), t = classTheme(c), cur = parks.has(c.park) ? c.park : 'brickyard';
  const parkAch = id => S.achievements.find(a => a.reward_type === 'park' && a.reward_id === id);
  const shown = new Set([...decor].filter(d => !off.has(d))), w = worldOf(c), meta = id => w === 'surf' ? SURF_BREAKS[id] : PARKS.find(p => p.id === id);
  return `<div class="panel stack"><h3>${W().Parks}</h3><p class="small muted">Your class unlocks new ${w === 'surf' ? 'surf breaks' : 'parks'} by studying together. Pick which one the ${W().scene} uses.</p>
   <div class="parkgrid">${PARKS.map(p => { const open = parks.has(p.id), a = parkAch(p.id); return `<div class="park ${open ? '' : 'locked'} ${cur === p.id ? 'on' : ''}"><div class="pthumb">${bowlScene([], t, c.name, { world: w, park: p.id, thumb: true, decor: shown })}${open ? '' : '<span class="plock">🔒</span>'}</div>
     <div class="stack" style="gap:4px;padding:10px"><div class="row between" style="gap:6px"><b>${esc(meta(p.id).name)}</b><span class="chip">${esc(meta(p.id).where)}</span></div><span class="small muted">${esc(meta(p.id).blurb)}</span>
     ${open ? (cur === p.id ? '<span class="chip ok" style="align-self:flex-start">In use</span>' : `<button class="btn sm primary" style="align-self:flex-start" data-act="setpark" data-id="${c.id}" data-park="${p.id}">Use this ${w === 'surf' ? 'break' : 'park'}</button>`) : `<span class="small"><b>Unlock:</b> ${a ? esc(a.description.replace(/skaters/g, WORDS[w].riders)) : 'Unavailable'}</span>${a ? `<button class="btn sm" style="align-self:flex-start" data-act="unlockach" data-class="${c.id}" data-key="${esc(a.key)}">Unlock now</button>` : ''}`}</div></div>`; }).join('')}</div></div>
   <div class="panel stack"><h3>${W().deco}</h3><p class="small muted">Unlocked decorations appear in the ${W().scene} automatically. Hide any you don't want.</p>
   ${decor.size ? `<div class="row" style="gap:8px">${DECOR.filter(d => decor.has(d.id)).map(d => `<button class="btn sm ${off.has(d.id) ? '' : 'primary'}" aria-pressed="${!off.has(d.id)}" data-act="toggledecor" data-id="${c.id}" data-decor="${d.id}">${off.has(d.id) ? 'Hidden' : 'Showing'}: ${esc(decorName(d.id, w))}</button>`).join('')}</div>` : '<p class="muted">None unlocked yet. Keep studying!</p>'}</div>
   <div class="panel stack"><h3>Class achievements</h3><p class="small muted">These unlock automatically as the class hits totals. Use "Unlock now" to give one early, for example as a class reward.</p>${achievementsPanel(c, true)}</div>`;
}

/* ---------------- whiteboard ---------------- */
let TICKS = 0;
async function loadBoardQuiet(cid) { try { const b = await q(sb.from('boards').select('*').eq('class_id', cid).maybeSingle()); const old = JSON.stringify(S.boards[cid] || null); if (b) S.boards[cid] = b; else delete S.boards[cid]; if (JSON.stringify(S.boards[cid] || null) !== old) render(); } catch { } }
const WB_COLORS = ['#121212', '#E0262C', '#2B59FF', '#0B8F4F', '#FF8A00', '#FF2E88'];
const WB_SIZES = [['S', 3], ['M', 7], ['L', 14]];
function boardOf(cid) { return S.boards[cid] || { class_id: cid, text: '', strokes: [], timer_end: null, timer_total: 0, timer_left: null, visible: true }; }
function timerState(b) {
  if (b.timer_end) { const ms = new Date(b.timer_end).getTime() - Date.now(); if (ms > 0) return { mode: 'run', left: Math.ceil(ms / 1000) }; if (ms > -600000) return { mode: 'done', left: 0 }; return { mode: 'idle', left: 0 }; }
  if (b.timer_left != null) return { mode: 'pause', left: b.timer_left };
  return { mode: 'idle', left: 0 };
}
const fmtClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function timerLabel(b) { const t = timerState(b); return t.mode === 'done' ? "Time's up!" : t.mode === 'idle' ? '0:00' : fmtClock(t.left); }
function boardHasContent(b) { const t = timerState(b); return !!(b.text.trim() || (b.strokes || []).length || t.mode !== 'idle'); }
function boardPanel(c, preview = false) {
  const b = boardOf(c.id); if (!preview && (!b.visible || !boardHasContent(b))) return '';
  const t = timerState(b);
  return `<section class="panel wbs ${t.mode === 'done' ? 'wb-done' : ''}" data-wbbox="${c.id}"><div class="row between"><h3>📋 Whiteboard</h3>${t.mode !== 'idle' ? `<span class="wbchip ${t.mode}" data-wbt="${c.id}">${timerLabel(b)}</span>` : ''}</div>
   ${t.mode !== 'idle' && b.timer_total ? `<div class="progress wbprog"><i data-wbp="${c.id}" style="width:${t.mode === 'done' ? 0 : Math.round(t.left / b.timer_total * 100)}%"></i></div>` : ''}
   ${b.text.trim() ? `<div class="wbro">${esc(b.text)}</div>` : ''}
   ${(b.strokes || []).length ? `<div class="wbsurface ro"><canvas data-board="${c.id}"></canvas></div>` : ''}
   ${preview && !boardHasContent(b) ? '<p class="muted">The board is empty. Open it to add instructions, drawings or a timer.</p>' : ''}
   ${preview && !b.visible ? '<p class="small"><b>Hidden from students.</b></p>' : ''}</section>`;
}
function tBoard() {
  const c = S.classes.find(x => x.id === S.view.classId); if (!c) return tHome();
  const b = boardOf(c.id), t = timerState(b), wb = S.wb;
  return { theme: classTheme(c), font: classFont(c), html: `<main class="wrap wbpage"><div id="wb-root" class="wbroot ${t.mode === 'done' ? 'wb-done' : ''}" data-wbbox="${c.id}">
   <div class="wbbar"><button class="btn sm" data-act="openclass" data-id="${c.id}" data-tab="board">← ${esc(c.name)}</button><h2 class="wbtitle">${esc(c.name)}</h2>
    <span class="row" style="gap:8px"><button class="btn sm ${b.visible ? 'primary' : ''}" aria-pressed="${b.visible}" data-act="wbvisible" data-id="${c.id}">${b.visible ? 'Students can see it' : 'Hidden from students'}</button><button class="btn sm" data-act="wbfull">Full screen</button>${armBtn('wbclear|' + c.id, 'Clear everything', 'Yes, clear the board')}</span></div>
   <div class="wbgrid"><div class="wbmain">
    <textarea id="wb-text" class="wbtext" rows="${Math.max(3, b.text.split('\n').length + 1)}" data-wbtext="${c.id}" placeholder="Type what you want the class to do…">${esc(b.text)}</textarea>
    <div class="wbsurface"><canvas id="wb-canvas" data-board="${c.id}" data-edit="1" aria-label="Drawing area"></canvas></div>
    <div class="wbtools" role="toolbar" aria-label="Drawing tools">${WB_COLORS.map(col => `<button class="wbsw" style="background:${col}" aria-label="Pen colour" aria-pressed="${!wb.eraser && wb.color === col}" data-act="wbcolor" data-c="${col}"></button>`).join('')}
     <span class="wbsep"></span>${WB_SIZES.map(([l, w]) => `<button class="btn sm ${wb.size === w ? 'primary' : ''}" data-act="wbsize" data-w="${w}">${l}</button>`).join('')}
     <span class="wbsep"></span><button class="btn sm ${wb.eraser ? 'primary' : ''}" data-act="wberaser">Eraser</button><button class="btn sm" data-act="wbundo" data-id="${c.id}" ${(b.strokes || []).length ? '' : 'disabled'}>Undo</button><button class="btn sm" data-act="wbcleardraw" data-id="${c.id}" ${(b.strokes || []).length ? '' : 'disabled'}>Clear drawing</button></div>
   </div>
   <aside class="wbtimer"><span class="label">Timer</span><div class="wbclock ${t.mode}" data-wbt="${c.id}">${timerLabel(b)}</div>
    <div class="progress wbprog"><i data-wbp="${c.id}" style="width:${t.mode === 'run' || t.mode === 'pause' ? Math.round(t.left / (b.timer_total || 1) * 100) : 0}%"></i></div>
    <div class="wbpresets">${[1, 2, 3, 5, 10, 15].map(m => `<button class="btn sm" data-act="wbstart" data-id="${c.id}" data-s="${m * 60}">${m} min</button>`).join('')}</div>
    <div class="row" style="gap:6px;flex-wrap:nowrap;align-items:flex-end"><label class="f">Min<input type="number" id="wb-min" min="0" max="180" value="${S.ui.wbMin ?? 5}"></label><label class="f">Sec<input type="number" id="wb-sec" min="0" max="59" value="${S.ui.wbSec ?? 0}"></label><button class="btn primary" data-act="wbstartcustom" data-id="${c.id}">Start</button></div>
    <div class="row" style="gap:6px">${t.mode === 'run' ? `<button class="btn" data-act="wbpause" data-id="${c.id}">Pause</button>` : t.mode === 'pause' ? `<button class="btn primary" data-act="wbresume" data-id="${c.id}">Resume</button>` : ''}${t.mode === 'run' || t.mode === 'pause' ? `<button class="btn" data-act="wbadd" data-id="${c.id}">+1 min</button>` : ''}${t.mode !== 'idle' ? `<button class="btn" data-act="wbreset" data-id="${c.id}">Reset</button>` : ''}</div>
    <p class="small muted">Students see the timer on their class page. When it ends, a sound plays and the screen flashes.</p>
   </aside></div>
   <div class="wbflash" aria-live="assertive">TIME'S UP!</div></div></main>` };
}
// drawing
function drawStrokes(cv, strokes, extra) {
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  const dpr = window.devicePixelRatio || 1, W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'); g.clearRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of [...(strokes || []), ...(extra ? [extra] : [])]) {
    const p = s.p || []; if (!p.length) continue;
    g.globalCompositeOperation = s.e ? 'destination-out' : 'source-over'; g.strokeStyle = s.c || '#121212'; g.fillStyle = s.c || '#121212';
    g.lineWidth = Math.max(1, (s.w || 4) / 1000 * W * (s.e ? 3 : 1));
    if (p.length === 1) { g.beginPath(); g.arc(p[0][0] * W, p[0][1] * H, g.lineWidth / 2, 0, 7); g.fill(); continue; }
    g.beginPath(); g.moveTo(p[0][0] * W, p[0][1] * H); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0] * W, p[i][1] * H); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
}
function paintBoards() {
  document.querySelectorAll('canvas[data-board]').forEach(cv => drawStrokes(cv, boardOf(cv.dataset.board).strokes, cv.dataset.edit && S.wbStroke));
  const ta = document.getElementById('wb-text');
  if (ta && document.activeElement !== ta) { const b = boardOf(ta.dataset.wbtext); if (ta.value !== b.text) ta.value = b.text; }
}
window.addEventListener('resize', () => paintBoards());
document.addEventListener('pointerdown', e => {
  const cv = e.target.closest && e.target.closest('canvas[data-edit]'); if (!cv) return;
  e.preventDefault(); cv.setPointerCapture(e.pointerId);
  const r = cv.getBoundingClientRect(), pt = [+((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.height).toFixed(4)];
  S.wbStroke = { c: S.wb.color, w: S.wb.size, e: S.wb.eraser ? 1 : 0, p: [pt] }; S.wbCanvas = cv;
  drawStrokes(cv, boardOf(cv.dataset.board).strokes, S.wbStroke);
});
document.addEventListener('pointermove', e => {
  if (!S.wbStroke || !S.wbCanvas) return;
  const cv = S.wbCanvas, r = cv.getBoundingClientRect(), pt = [+((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.height).toFixed(4)], p = S.wbStroke.p, last = p[p.length - 1];
  if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < .003) return;
  p.push(pt); drawStrokes(cv, boardOf(cv.dataset.board).strokes, S.wbStroke);
});
function endStroke() {
  if (!S.wbStroke || !S.wbCanvas) return;
  const cid = S.wbCanvas.dataset.board, b = boardOf(cid), st = S.wbStroke; S.wbStroke = null; S.wbCanvas = null;
  const strokes = [...(b.strokes || []), st].slice(-500); saveBoard(cid, { strokes }, true);
}
document.addEventListener('pointerup', endStroke); document.addEventListener('pointercancel', endStroke);
// saving and live updates
let wbSaveT = null;
function saveBoard(cid, patch, soon) {
  S.boards[cid] = { ...boardOf(cid), ...patch };
  const send = () => q(sb.from('boards').upsert({ ...boardOf(cid), class_id: cid, updated_at: new Date().toISOString() })).catch(e => toast(msg(e)));
  clearTimeout(wbSaveT);
  if (soon) wbSaveT = setTimeout(send, 250); else send();
  if (!patch.text || patch.strokes || patch.timer_end !== undefined) { if (!S.wbStroke) { render(); } }
}
async function loadBoard(cid) {
  try { const b = await q(sb.from('boards').select('*').eq('class_id', cid).maybeSingle()); if (b) S.boards[cid] = b; else delete S.boards[cid]; } catch { }
  watchBoard(cid); render();
}
function watchBoard(cid) {
  if (!sb || !sb.channel || S.boardSubCid === cid) return;
  try { if (S.boardSub) sb.removeChannel(S.boardSub); } catch { }
  S.boardSubCid = cid;
  try {
    S.boardSub = sb.channel('board-' + cid).on('postgres_changes', { event: '*', schema: 'public', table: 'boards', filter: `class_id=eq.${cid}` }, pl => {
      if (pl.new && pl.new.class_id) S.boards[cid] = pl.new; else if (pl.eventType === 'DELETE') delete S.boards[cid];
      const ta = document.getElementById('wb-text');
      if (S.wbStroke || (ta && document.activeElement === ta)) { paintBoards(); return; }
      render();
    }).subscribe();
  } catch { }
}
// timer end: sound + flash
let AUDIO = null;
document.addEventListener('pointerdown', () => { if (!AUDIO) { try { AUDIO = new (window.AudioContext || window.webkitAudioContext)(); } catch { } } else if (AUDIO.state === 'suspended') AUDIO.resume(); }, { capture: true });
function alarm() {
  try {
    if (!AUDIO) AUDIO = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = AUDIO.currentTime;
    [0, .35, .7, 1.4, 1.75, 2.1].forEach((d, i) => { const o = AUDIO.createOscillator(), g = AUDIO.createGain(); o.type = 'square'; o.frequency.value = i % 3 === 2 ? 1175 : 880; g.gain.setValueAtTime(.0001, t0 + d); g.gain.exponentialRampToValueAtTime(.25, t0 + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + d + .28); o.connect(g); g.connect(AUDIO.destination); o.start(t0 + d); o.stop(t0 + d + .3); });
  } catch { }
}
const WB_LAST = {};
function tickBoards() {
  for (const cid in S.boards) {
    const b = S.boards[cid], t = timerState(b), prev = WB_LAST[cid];
    document.querySelectorAll(`[data-wbt="${cid}"]`).forEach(el => { el.textContent = timerLabel(b); el.classList.toggle('done', t.mode === 'done'); });
    document.querySelectorAll(`[data-wbp="${cid}"]`).forEach(el => { el.style.width = (t.mode === 'run' || t.mode === 'pause' ? Math.round(t.left / (b.timer_total || 1) * 100) : 0) + '%'; });
    if (prev && prev.mode === 'run' && t.mode === 'done' && (S.role === 'teacher' || b.visible)) {
      alarm(); document.querySelectorAll(`[data-wbbox="${cid}"]`).forEach(el => el.classList.add('wb-done'));
      if (S.role === 'student') toast("⏰ Time's up!");
      render();
    }
    WB_LAST[cid] = t;
  }
}

/* ---------------- STUDENT ---------------- */
const myClasses = () => S.classes.slice().sort(byOrder);
const homeTheme = () => { const mc = myClasses(); return mc.length ? classTheme(mc[0]) : siteTheme(); };
function attemptsFor(qid) { return S.attempts.filter(a => a.quiz_id === qid); }
function collectedToday(qid) { const m = midnight(); return attemptsFor(qid).some(a => a.coins > 0 && new Date(a.created_at).getTime() >= m); }
function sHome() {
  const s = S.me, t = homeTheme(), mc = myClasses();
  return { theme: t, html: banner(t, { eyebrow: site().site_name, title: `${W().greet}, ${s.nickname}!`, sub: 'Earn coins with focus sessions and revision quizzes, then spend them in the shop.' }) + `
  <main class="wrap"><div class="hero">${den(eqOf(s), s.color, s.nickname)}
   <div class="stack"><div class="row"><div class="stat"><b><span class="coin"></span>${balance(s)}</b><span>Coins to spend</span></div><div class="stat"><b>${s.focus_min}</b><span>Focus minutes</span></div><div class="stat"><b>${s.quizzes_done}</b><span>Quizzes done</span></div></div>
   ${bowlPass()}
   <div class="row"><button class="btn primary" data-act="nav" data-to="focus">Start a focus session</button><button class="btn coinbtn" data-act="nav" data-to="shop">${W().shop}</button><button class="btn" data-act="nav" data-to="todo">To-do list</button></div></div></div>
   ${todoPeek()}
   <h2>My classes</h2>
   ${mc.length ? `<div class="grid">${mc.map(c => { const ct = classTheme(c); return sticker(ct, c.name, (ct.decor || [])[0], `<span class="small muted">${esc(c.subtitle || '')}</span>${c.announcement ? `<span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📣 ${esc(c.announcement)}</span>` : ''}`, `data-act="openclass" data-id="${c.id}"`, classFont(c)); }).join('')}</div>` : `<div class="empty">You're not in any classes right now. Add one with a join code below.</div>`}
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
  const t = classTheme(c), us = unitsOf(c.id), qs = S.quizzes.filter(x => x.class_id === c.id).sort(byOrder), crew = S.crew[c.id], board = crew && crew.slice().sort((a, b) => studyMin(b) - studyMin(a)).slice(0, 10);
  return { theme: t, font: classFont(c), html: banner(t, { eyebrow: c.subtitle || 'Class', title: c.name, back: { act: 'nav', attrs: 'data-to="home"', label: 'Home' } }) + `
  <main class="wrap">${boardPanel(c)}${c.announcement ? `<div class="notice"><b>Announcement:</b> ${esc(c.announcement)}</div>` : ''}
  ${crew ? classBowl(c) : `<div class="bowl bowl-loading"><p class="scrawl">${WORLD === 'surf' ? 'Paddling out…' : 'Rolling up to the bowl…'}</p></div>`}
  <details class="panel" id="ach-${c.id}"><summary>Class achievements · unlock new ${WORLD === 'surf' ? 'surf breaks and beach upgrades' : 'skateparks, graffiti and stickers'} together</summary><div style="margin-top:14px">${achievementsPanel(c, false)}</div></details>
  <div class="split"><div class="stack"><h2>Units</h2>${us.length ? us.map(u => { const ut = unitTheme(u); return `<button class="unitcard" data-act="openunit" data-id="${u.id}"><span class="sw" style="background:linear-gradient(120deg,${ut.b1},${ut.b2})" aria-hidden="true">${esc((ut.decor || [])[0] || '')}</span><span class="txt"><strong>${esc(u.title)}</strong><span class="small muted">${resOf(u.id).length} resources${S.quizzes.some(x => x.unit_id === u.id) ? ' · revision quiz' : ''}</span></span><span aria-hidden="true" style="font-size:22px">→</span></button>`; }).join('') : "<div class=\"empty\">Your teacher hasn't added any units yet.</div>"}
   <h2 style="margin-top:10px">Revision quizzes</h2>${quizList(qs)}</div>
   <div class="panel taped stack"><h3>Study leaderboard</h3><p class="small muted">Ranked by hours studied ${periodWord()}.</p><div class="lb">${board ? (board.map((b, i) => `<div class="r ${b.is_me ? 'me' : ''}"><span class="rank">${i + 1}</span>${charSVG(b.equipped || {}, b.color)}<span class="n">${esc(b.nickname)}</span><span class="price">${fmtH(studyMin(b))}</span></div>`).join('') || '<p class="small muted">No one yet.</p>') : '<p class="small muted">Loading…</p>'}</div></div></div></main>` };
}
function sUnit() {
  const u = S.units.find(x => x.id === S.view.unitId); if (!u) return sHome();
  const c = S.classes.find(x => x.id === u.class_id), t = unitTheme(u), rs = resOf(u.id), qs = S.quizzes.filter(x => x.unit_id === u.id);
  return { theme: t, font: classFont(c), html: banner(t, { eyebrow: c?.name || '', title: u.title, sub: u.description || '', back: { act: 'openclass', attrs: `data-id="${u.class_id}"`, label: c?.name || 'Back' } }) + `
  <main class="wrap"><div class="split"><div class="stack"><h2>Resources</h2>${rs.length ? rs.map(r => resCard(r, false)).join('') : '<div class="empty">No resources in this unit yet.</div>'}</div>
  <div class="stack"><div class="panel taped stack"><h3>Revise this unit</h3>${quizList(qs)}<button class="btn" data-act="focusfor" data-class="${u.class_id}" data-label="${esc(u.title)}">Start a focus session</button></div></div></div></main>` };
}
function remaining() { const f = S.focus; return f ? Math.max(0, f.minutes * 60 - Math.floor((Date.now() - f.startedAt) / 1000)) : 0; }
function sFocus() {
  const s = S.me, st = site(), t = homeTheme(), f = S.focus;
  if (S.celebrate) return { theme: t, html: `<main class="wrap"><div class="panel taped celebrate"><span class="stamp">${esc(S.celebrate.title)}</span><div class="big"><span class="coin"></span>+${S.celebrate.coins}</div><p class="muted">${esc(S.celebrate.msg)}</p>${charSVG(eqOf(s), s.color, 'bob')}<div class="row" style="justify-content:center"><button class="btn primary" data-act="closecele">Done</button><button class="btn coinbtn" data-act="nav" data-to="shop">${W().shop}</button></div></div></main>` };
  let body;
  if (f) {
    const total = f.minutes * 60, rem = remaining(), C = 2 * Math.PI * 88;
    body = `<div class="timerwrap"><p class="label">${esc(f.label || 'Focus session')}</p><div class="ring"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="88" fill="none" stroke="var(--card-2)" stroke-width="16"/><circle id="ringarc" cx="100" cy="100" r="88" fill="none" stroke="var(--accent)" stroke-width="16" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - rem / total)).toFixed(1)}"/><circle cx="100" cy="100" r="96" fill="none" stroke="var(--edge)" stroke-width="3"/><circle cx="100" cy="100" r="80" fill="none" stroke="var(--edge)" stroke-width="3"/></svg><div class="t" id="bigtimer">${f.finishing ? '…' : fmtT(rem)}</div></div>
    <p class="small muted" style="max-width:44ch;text-align:center">Keep this page open until the timer ends. Phones away, one task, full send.</p>${armBtn('giveup', 'Bail early (no coins)', 'Yes, stop the session')}</div>`;
  } else {
    const sel = S.ui.focusMin, mc = myClasses();
    body = `<div class="timerwrap"><h2>How long are you riding?</h2><div class="durations">${[10, 15, 25, 40].map(m => `<button data-act="fmin" data-m="${m}" aria-pressed="${m === sel}"><b>${m}</b><span class="small">min · ${m * st.focus_rate} coins</span></button>`).join('')}</div>
    <label class="f mininput">Or type any number of minutes (1–180)<span class="row" style="gap:8px;flex-wrap:nowrap"><input type="number" id="fx-min" min="1" max="180" step="1" inputmode="numeric" value="${sel}"><span class="small" id="fx-coins" style="white-space:nowrap">= ${sel * st.focus_rate} coins</span></span></label>
    <div class="formrow" style="max-width:580px;width:100%"><label class="f">What are you working on?<input type="text" id="fx-label" maxlength="120" placeholder="e.g. Unit 2 summary notes" value="${esc(S.ui.focusLabel)}"></label><label class="f">Class<select id="fx-class"><option value="">—</option>${mc.map(c => `<option value="${c.id}" ${S.ui.focusClass === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label></div>
    <button class="btn primary big" data-act="fstart" ${S.ui.busy ? 'disabled' : ''}>Start focusing</button>
    <p class="small muted">Up to ${st.focus_cap} focus coins a day. Focus time also counts towards your ${W().pass.toLowerCase()}.</p><div style="width:100%;max-width:580px">${bowlPass()}</div></div>`;
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
  return { theme: t, html: banner(t, { eyebrow: 'Spend your coins', title: W().shopTitle, sub: `Characters, headgear, pets, plants and gear for your ${W().hangout.toLowerCase()}.` }) + `
  <main class="wrap"><div class="row between"><div class="tabs" role="tablist">${SHOP_TABS.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-act="shoptab" data-tab="${k}">${l}</button>`).join('')}</div><span class="coins"><span class="coin"></span>${bal}</span></div>
  ${slots.map(sl => `${slots.length > 1 ? `<h3>${SLOT_LABELS[sl]}</h3>` : ''}<div class="shopgrid">${shopSlot(sl).map(tile).join('') || '<p class="muted">Nothing in stock.</p>'}</div>`).join('')}</main>` };
}
function sDen() {
  const s = S.me, t = homeTheme(), eq = eqOf(s);
  const pick = (slot, label) => { const list = shopSlot(slot, true).filter(it => owns(s, slot, it.id));
    return `<div class="stack" style="gap:6px"><span class="label">${label}</span><div class="row" style="gap:6px">${slot !== 'character' ? `<button class="btn sm ${!eq[slot] ? 'primary' : ''}" data-act="equip" data-slot="${slot}" data-id="">None</button>` : ''}${list.map(it => `<button class="btn sm ${eq[slot] === it.id ? 'primary' : ''}" data-act="equip" data-slot="${slot}" data-id="${esc(it.id)}">${it.emoji ? it.emoji + ' ' : ''}${esc(it.name)}</button>`).join('')}${!list.length ? '<span class="small muted">None yet. Grab some in the shop.</span>' : ''}</div></div>`; };
  return { theme: t, html: banner(t, { eyebrow: `Your ${W().hangout.toLowerCase()}`, title: s.nickname, sub: 'Change your colour and pick what to rock. Everything you own lives here.' }) + `
  <main class="wrap"><div class="hero">${den(eq, s.color, s.nickname)}<div class="panel stack">
   <form class="formrow" data-form="nick"><label class="f">${W().rider[0].toUpperCase() + W().rider.slice(1)} name<input type="text" id="dn-nick" maxlength="20" value="${esc(s.nickname)}"></label><button class="btn">Rename</button></form>
   <div class="stack" style="gap:6px"><span class="label">Colour</span><div class="swatches">${COLORS.map(c => `<button class="swatch" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${s.color === c}" data-act="equip" data-slot="color" data-id="${c}"></button>`).join('')}</div></div>
   ${pick('character', 'Character')}${pick('hat', 'Headgear')}${pick('eyes', 'Eyewear')}${pick('neck', 'Neckwear')}${pick('pet', 'Pet')}${pick('plant', 'Plant')}${pick('gear', 'Gear')}
  </div></div>
  <div class="panel stack"><h3>My tricks</h3><p class="small muted">Your teacher unlocks tricks. You pull them in the class ${W().scene} whenever you've earned your ${W().pass.toLowerCase()}.</p><div class="row" style="gap:8px">${TRICKS.map(k => { const on = (s.tricks || []).includes(k.id); return `<span class="chip ${on ? 'ok' : ''}" style="font-size:13px">${on ? k.emoji : '🔒'} ${esc(trickName(k.id, WORLD))}</span>`; }).join('')}</div></div>
  <div class="panel stack"><h3>Log out</h3><p class="small muted">To get back in, you'll need your class code, your ${W().name} <b>${esc(s.nickname)}</b> and your PIN. If you forget your PIN, your teacher can reset it.</p><div>${armBtn('logout', 'Log out on this device', 'Yes, log me out')}</div></div></main>` };
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
  tickBoards();
  if (S.role === 'student' && S.view.name === 'class' && (++TICKS % 20 === 0)) loadBoardQuiet(S.view.classId);
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
  if (el.dataset.tb && S.customDraft) { S.customDraft[el.dataset.tb] = el.value; paintThemePreview(); }
  if (el.id === 'fx-label') S.ui.focusLabel = el.value;
  if (el.dataset.wbtext) { el.rows = Math.max(3, el.value.split('\n').length + 1); const cid = el.dataset.wbtext; S.boards[cid] = { ...boardOf(cid), text: el.value }; clearTimeout(A._wbt); A._wbt = setTimeout(() => q(sb.from('boards').upsert({ ...boardOf(cid), class_id: cid, updated_at: new Date().toISOString() })).catch(e => toast(msg(e))), 600); }
  if (el.id === 'fx-min') { const m = parseInt(el.value, 10); if (m >= 1 && m <= 180) { S.ui.focusMin = m; document.querySelectorAll('[data-act=fmin]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.m === m))); const fc = $('#fx-coins'); if (fc) fc.textContent = `= ${m * site().focus_rate} coins`; } }
});
document.addEventListener('change', e => {
  const el = e.target, d = S.quizDraft;
  if (d && el.dataset.ai) d.questions[+el.dataset.ai].answer = +el.dataset.aj;
  if (d && el.dataset.bind === 'unit_id') d.unit_id = el.value;
  if (el.id === 'fx-class') S.ui.focusClass = el.value;
  if (el.dataset.logf) { if (el.dataset.logf === 'stu') S.ui.logStudent = el.value; else S.ui.logFilterCat = el.value; render(); }
  if (el.dataset.tb && S.customDraft) { S.customDraft[el.dataset.tb] = el.value; paintThemePreview(); }
});
function paintThemePreview() {
  const d = S.customDraft, sec = document.getElementById('th-preview'); if (!d || !sec) return;
  const decor = d.decor.split(/\s+/).filter(Boolean);
  sec.setAttribute('style', themeVars({ ...d, decor }));
  const h = sec.querySelector('h2'); if (h) h.textContent = d.name || 'My theme';
  const dc = sec.querySelector('.decor'); if (dc) dc.innerHTML = decor.slice(0, 4).map(e => `<span>${esc(e)}</span>`).join('');
}

A.retry = () => resolveSession();
A.nav = el => { S.ui.loginErr = ''; if (el.dataset.to === 'teacherlogin') { go({ name: 'teacherlogin' }); return; } if (location.hash) history.replaceState(null, '', location.pathname + location.search); go({ name: el.dataset.to }); };
A.tab = el => { S.ui.tab = el.dataset.tab; S.ui.armed = null; render(); };
A.openclass = el => { loadBoard(el.dataset.id); S.ui.tab = el.dataset.tab || (S.role === 'teacher' ? 'units' : 'units'); S.quizRun = null; go({ name: 'class', classId: el.dataset.id }); loadCrew(el.dataset.id); };
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
    S.ui.busy = false; S.view = { name: 'home' }; await resolveSession(); toast(S.ui.joinMode === 'new' ? WORLD === 'surf' ? 'You paddled out! Welcome.' : 'You dropped in! Welcome.' : 'Welcome back!');
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
  const world = $('#nc-world').value === 'surf' ? 'surf' : 'skate', th = THEMES.find(t => t.id === $('#nc-theme').value), theme_id = th && th.world !== world ? (world === 'surf' ? 'reef' : 'griptape') : $('#nc-theme').value;
  await q(sb.from('classes').insert({ name, subtitle: $('#nc-sub').value.trim(), world, theme_id, code: uniqueCode(), sort: S.classes.length }));
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
  await q(sb.from('settings').update({ site_name: $('#st-name').value.trim() || 'Skate Skool', teacher_name: $('#st-teacher').value.trim(), home_theme: $('#st-theme').value, focus_rate: n('#st-rate'), focus_cap: n('#st-fcap'), quiz_cap: n('#st-qcap'), welcome: n('#st-welcome'), bowl_hours: Math.max(0, Math.round((Number($('#st-bowlh').value) || 0) * 2) / 2), bowl_period: $('#st-bowlp').value }).eq('id', 1));
  await refresh();
}, 'Settings saved').catch(() => { });
A.award = el => act(async () => { const n = parseInt($('#aw-' + el.dataset.id).value, 10); if (!n) throw new Error('Enter a number of coins.'); await rpc('award_coins', { p_student: el.dataset.id, p_amount: n, p_reason: 'From your teacher' }); await refresh(); }, 'Coins sent').catch(() => { });
A.realname = el => act(async () => { await rpc('set_real_name', { p_student: el.dataset.id, p_name: $('#rn-' + el.dataset.id).value }); await refresh(); }, 'Name saved').catch(() => { });
A.resetpin = el => act(async () => { const p = $('#rp-' + el.dataset.id).value.trim(); if (!/^[0-9]{4}$/.test(p)) throw new Error('bad_pin'); await rpc('reset_pin', { p_student: el.dataset.id, p_pin: p }); clear('rp-' + el.dataset.id); }, 'PIN updated').catch(() => { });

async function removeFiles(paths) { const p = paths.filter(Boolean); if (p.length) await sb.storage.from(BUCKET).remove(p).catch(() => { }); }
async function doDelete(k) {
  const [type, id, extra] = k.split('|');
  try {
    if (type === 'giveup') { const f = S.focus; S.focus = null; store.set('skate-focus', null); render(); if (f) rpc('cancel_focus', { p_id: f.id }).catch(() => { }); toast('Session stopped'); return; }
    if (type === 'logout') { await sb.auth.signOut(); S.me = null; S.view = { name: 'home' }; await resolveSession(); return; }
    if (type === 'res') { const r = S.resources.find(x => x.id === id); await q(sb.from('resources').delete().eq('id', id)); await removeFiles([r?.storage_path]); toast('Resource removed'); }
    if (type === 'log') { await q(sb.from('student_log').delete().eq('id', id)); toast('Entry deleted'); }
    if (type === 'wbclear') { saveBoard(id, { text: '', strokes: [], timer_end: null, timer_left: null, timer_total: 0 }); toast('Board cleared'); return; }
    if (type === 'relock') { await q(sb.from('class_unlocks').delete().eq('class_id', id).eq('key', extra)); toast('Locked again'); loadProgress(id); }
    if (type === 'quiz') { await q(sb.from('quizzes').delete().eq('id', id)); toast('Quiz deleted'); }
    if (type === 'theme') { if (S.customDraft?.id === id) S.customDraft = null; await q(sb.from('themes').delete().eq('id', id)); toast('Theme deleted'); }
    if (type === 'kick') { await q(sb.from('enrolments').delete().eq('student_id', id).eq('class_id', extra)); toast('Student removed from class'); }
    if (type === 'unit') { const u = S.units.find(x => x.id === id); const files = S.resources.filter(r => r.unit_id === id).map(r => r.storage_path); await q(sb.from('units').delete().eq('id', id)); await removeFiles(files); toast('Unit deleted'); S.view = { name: 'class', classId: u?.class_id }; }
    if (type === 'class') { const files = S.resources.filter(r => r.class_id === id).map(r => r.storage_path); await q(sb.from('classes').delete().eq('id', id)); await removeFiles(files); toast('Class deleted'); S.view = { name: 'home' }; }
  } catch (e) { toast(msg(e)); }
  refresh();
}


/* log actions */
A.logcat = el => { S.ui.logCat = el.dataset.cat; render(); };
A.logall = el => { document.querySelectorAll('[data-logstu]').forEach(cb => cb.checked = el.dataset.on === '1'); };
A.logfilter = el => { S.ui.logStudent = el.dataset.stu; S.ui.logFilterCat = ''; dropIds('lgf-'); render(); };
F.logadd = async f => {
  const cid = f.dataset.id, ids = [...document.querySelectorAll('[data-logstu]:checked')].map(cb => cb.dataset.logstu);
  if (!ids.length) { toast('Tick at least one student.'); return; }
  const cat = S.ui.logCat || 'positive', note = $('#lg-note-' + cid).value.trim(), date = $('#lg-date-' + cid).value || todayStr(), coins = parseInt($('#lg-coins-' + cid).value, 10) || 0;
  S.ui.busy = true; render();
  try {
    await q(sb.from('student_log').insert(ids.map(id => ({ class_id: cid, student_id: id, category: cat, note, logged_on: date, coins }))));
    if (coins) for (const id of ids) await rpc('award_coins', { p_student: id, p_amount: coins, p_reason: `${catOf(cat)[2]}${note ? ': ' + note : ''}` });
    document.querySelectorAll('[data-logstu]').forEach(cb => cb.checked = false); clear('lg-note-' + cid); const ci = $('#lg-coins-' + cid); if (ci) ci.value = '0';
    toast(`Logged for ${ids.length} student${ids.length > 1 ? 's' : ''}`);
  } catch (e) { toast(msg(e)); }
  S.ui.busy = false; refresh();
};
A.logcsv = el => {
  const cid = el.dataset.id, c = S.classes.find(x => x.id === cid), byId = Object.fromEntries(S.students.map(x => [x.id, x]));
  const rows = [['Date', 'Student', 'Real name', 'Skater name', 'Type', 'Note', 'Coins']].concat(S.notes.filter(n => n.class_id === cid).map(n => { const s = byId[n.student_id]; return [n.logged_on, tname(s), s?.real_name || '', s?.nickname || '', catOf(n.category)[2], n.note, n.coins]; }));
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = `${(c?.name || 'class').replace(/[^\w-]+/g, '_')}-log-${todayStr()}.csv`; document.body.appendChild(a); a.click(); a.remove();
};

/* to-do actions */
F.todoadd = async () => {
  const text = $('#td-text').value.trim(), due = $('#td-due').value || null; if (!text) return;
  const row = S.role === 'teacher' ? { teacher_user: S.uid, text, due } : { student_id: S.me.id, text, due };
  try { await q(sb.from('todos').insert(row)); clear('td-text', 'td-due'); } catch (e) { toast(msg(e)); }
  refresh();
};
A.todotoggle = async el => {
  const x = S.todos.find(y => y.id === el.dataset.id); if (!x) return;
  x.done = !x.done; render();
  try { await q(sb.from('todos').update({ done: x.done }).eq('id', x.id)); } catch (e) { toast(msg(e)); refresh(); }
};
A.tododel = async el => { S.todos = S.todos.filter(y => y.id !== el.dataset.id); render(); try { await q(sb.from('todos').delete().eq('id', el.dataset.id)); } catch (e) { toast(msg(e)); refresh(); } };
A.todoclear = async () => { const ids = S.todos.filter(y => y.done).map(y => y.id); S.todos = S.todos.filter(y => !y.done); render(); try { if (ids.length) await q(sb.from('todos').delete().in('id', ids)); } catch (e) { toast(msg(e)); refresh(); } };


/* markbook, tricks, bowl, font actions */
A.mbmode = el => { S.ui.mbMode = el.dataset.m; render(); };
A.mbquiz = el => { S.ui.mbQuiz = el.dataset.id || null; render(); };
A.mbcell = el => { S.ui.mbCell = el.dataset.s ? el.dataset.s + '|' + el.dataset.q : null; render(); };
A.mbcsv = el => {
  const cid = el.dataset.id, c = S.classes.find(x => x.id === cid), qs = S.quizzes.filter(x => x.class_id === cid).sort(byOrder), mode = S.ui.mbMode || 'best';
  const st = studentsIn(cid).sort((a, b) => tname(a).localeCompare(tname(b)));
  const rows = [['Student', 'Real name', 'Skater name', ...qs.flatMap(x => [x.title + ' score', x.title + ' %', x.title + ' attempts'])]];
  for (const s of st) { const r = [tname(s), s.real_name || '', s.nickname]; for (const x of qs) { const l = S.attempts.filter(a => a.student_id === s.id && a.quiz_id === x.id), a = mbPick(l, mode); r.push(a ? `${a.score}/${a.total}` : '', a && a.total ? Math.round(a.score / a.total * 100) : '', l.length); } rows.push(r); }
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = `${(c?.name || 'class').replace(/[^\w-]+/g, '_')}-markbook-${todayStr()}.csv`; document.body.appendChild(a); a.click(); a.remove();
};
async function saveTricks(sid, cid, list) {
  const s = S.students.find(x => x.id === sid); if (s) s.tricks = list;
  const cr = S.crew[cid]; if (cr) { /* refresh after save */ }
  await rpc('set_tricks', { p_student: sid, p_tricks: list });
}
A.settrick = async el => {
  const s = S.students.find(x => x.id === el.dataset.id), k = el.dataset.trick; if (!s) return;
  const list = (s.tricks || []).includes(k) ? s.tricks.filter(x => x !== k) : [...(s.tricks || []), k];
  s.tricks = list; render();
  try { await saveTricks(s.id, el.dataset.class, list); loadCrew(el.dataset.class); } catch (e) { toast(msg(e)); refresh(); }
};
A.trickrow = async el => {
  const s = S.students.find(x => x.id === el.dataset.id); if (!s) return;
  const list = (s.tricks || []).length === TRICKS.length ? [] : TRICKS.map(k => k.id); s.tricks = list; render();
  try { await saveTricks(s.id, el.dataset.class, list); loadCrew(el.dataset.class); toast(list.length ? `All tricks unlocked for ${s.nickname}` : `Tricks cleared for ${s.nickname}`); } catch (e) { toast(msg(e)); refresh(); }
};
A.trickall = async el => {
  const cid = el.dataset.class, k = el.dataset.trick, st = studentsIn(cid), all = st.every(s => (s.tricks || []).includes(k));
  for (const s of st) s.tricks = all ? (s.tricks || []).filter(x => x !== k) : [...new Set([...(s.tricks || []), k])];
  render();
  try { for (const s of st) await rpc('set_tricks', { p_student: s.id, p_tricks: s.tricks }); loadCrew(cid); toast(`${trickName(k, WORLD)} ${all ? 'locked' : 'unlocked'} for the whole class`); } catch (e) { toast(msg(e)); refresh(); }
};
A.setpark = el => act(async () => { await q(sb.from('classes').update({ park: el.dataset.park }).eq('id', el.dataset.id)); await refresh(); }, WORLD === 'surf' ? 'Surf break changed' : 'Skatepark changed').catch(() => { });
A.toggledecor = el => act(async () => {
  const c = S.classes.find(x => x.id === el.dataset.id), d = el.dataset.decor, off = new Set(c.decor_off || []);
  off.has(d) ? off.delete(d) : off.add(d);
  await q(sb.from('classes').update({ decor_off: [...off] }).eq('id', c.id)); await refresh();
}).catch(() => { });
A.unlockach = el => act(async () => { await q(sb.from('class_unlocks').insert({ class_id: el.dataset.class, key: el.dataset.key, by_teacher: true })); await loadProgress(el.dataset.class); }, 'Unlocked for the class!').catch(() => { });
A.setworld = el => act(async () => {
  const c = S.classes.find(x => x.id === el.dataset.id), w = el.dataset.world, th = THEMES.find(t => t.id === c.theme_id);
  const patch = { world: w }; if (!th || th.world !== w) patch.theme_id = w === 'surf' ? 'reef' : 'griptape';
  await q(sb.from('classes').update(patch).eq('id', c.id)); await refresh();
}, 'Class world changed').catch(() => { });
A.sethomeworld = el => act(async () => { const w = el.dataset.world, th = THEMES.find(t => t.id === site().home_theme); const patch = { home_world: w }; if (!th || th.world !== w) patch.home_theme = w === 'surf' ? 'reef' : 'griptape'; await q(sb.from('settings').update(patch).eq('id', 1)); await refresh(); }, 'Home world changed').catch(() => { });
A.setsitefont = el => act(async () => { await q(sb.from('settings').update({ heading_font: el.dataset.font }).eq('id', 1)); await refresh(); }, 'Font changed').catch(() => { });
A.setclassfont = el => act(async () => { await q(sb.from('classes').update({ heading_font: el.dataset.font }).eq('id', el.dataset.id)); await refresh(); }, 'Font changed').catch(() => { });


/* whiteboard actions */
A.openboard = el => { loadBoard(el.dataset.id); go({ name: 'board', classId: el.dataset.id }); };
A.wbcolor = el => { S.wb.color = el.dataset.c; S.wb.eraser = false; render(); };
A.wbsize = el => { S.wb.size = +el.dataset.w; render(); };
A.wberaser = () => { S.wb.eraser = !S.wb.eraser; render(); };
A.wbundo = el => { const b = boardOf(el.dataset.id); saveBoard(el.dataset.id, { strokes: (b.strokes || []).slice(0, -1) }); };
A.wbcleardraw = el => saveBoard(el.dataset.id, { strokes: [] });
A.wbvisible = el => saveBoard(el.dataset.id, { visible: !boardOf(el.dataset.id).visible });
A.wbfull = () => { const r = document.getElementById('wb-root'); try { if (document.fullscreenElement) document.exitFullscreen(); else r.requestFullscreen().catch(() => toast('Full screen is blocked here. Press F11 instead.')); } catch { toast('Press F11 for full screen.'); } };
const wbStartSecs = (cid, secs) => { if (!(secs > 0)) { toast('Set a time first.'); return; } saveBoard(cid, { timer_end: new Date(Date.now() + secs * 1000).toISOString(), timer_total: secs, timer_left: null }); };
A.wbstart = el => wbStartSecs(el.dataset.id, +el.dataset.s);
A.wbstartcustom = el => { const m = Math.max(0, parseInt($('#wb-min').value, 10) || 0), sc = Math.max(0, Math.min(59, parseInt($('#wb-sec').value, 10) || 0)); S.ui.wbMin = m; S.ui.wbSec = sc; wbStartSecs(el.dataset.id, Math.min(180 * 60, m * 60 + sc)); };
A.wbpause = el => { const t = timerState(boardOf(el.dataset.id)); saveBoard(el.dataset.id, { timer_end: null, timer_left: t.left }); };
A.wbresume = el => { const b = boardOf(el.dataset.id); saveBoard(el.dataset.id, { timer_end: new Date(Date.now() + (b.timer_left || 0) * 1000).toISOString(), timer_left: null }); };
A.wbadd = el => { const b = boardOf(el.dataset.id), t = timerState(b); if (t.mode === 'run') saveBoard(el.dataset.id, { timer_end: new Date(new Date(b.timer_end).getTime() + 60000).toISOString(), timer_total: (b.timer_total || 0) + 60 }); else if (t.mode === 'pause') saveBoard(el.dataset.id, { timer_left: (b.timer_left || 0) + 60, timer_total: (b.timer_total || 0) + 60 }); };
A.wbreset = el => saveBoard(el.dataset.id, { timer_end: null, timer_left: null, timer_total: 0 });

/* student actions */
F.joinmore = () => act(async () => { await rpc('join_class', { p_code: $('#jm-code').value.trim().toUpperCase() }); clear('jm-code'); await refresh(); }, 'Joined!').catch(() => { });
F.nick = () => act(async () => { const n = $('#dn-nick').value.trim(); await rpc('set_nickname', { p_nick: n }); await refresh(); }, 'Name saved').catch(() => { });
A.fmin = el => { S.ui.focusMin = +el.dataset.m; const i = $('#fx-min'); if (i) i.value = S.ui.focusMin; render(); };
A.focusfor = el => { S.ui.focusClass = el.dataset.class; S.ui.focusLabel = el.dataset.label; go({ name: 'focus' }); };
A.fstart = async () => {
  const typed = parseInt($('#fx-min')?.value, 10), minutes = Number.isFinite(typed) ? typed : S.ui.focusMin, label = ($('#fx-label')?.value || '').trim(), cid = $('#fx-class')?.value || null;
  if (!(minutes >= 1 && minutes <= 180)) { toast('Pick between 1 and 180 minutes.'); return; }
  S.ui.focusMin = minutes;
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
