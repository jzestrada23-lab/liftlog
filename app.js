(function () {
  'use strict';
  var E = Engine, D = Data;
  var KEY = 'liftlog.v1';
  var TYPES = ['Push', 'Pull', 'Legs', 'Upper', 'Lower'];
  var FED = { fasted: 'Fasted', light: 'Light meal', fed: 'Fed' };
  var AGAIN = { yes: 'Yes', unsure: 'Not sure', no: 'No' };
  var BUCKET = { early: 'Early morning', midday: 'Midday', afternoon: 'Afternoon', night: 'Night' };

  var S = load();
  var ui = { openEx: null, chartEx: null, start: null };
  var $app = document.getElementById('app');
  var $sheet = document.getElementById('sheet');
  var $toast = document.getElementById('toast');

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function newState() {
    var sessions = D.seedSessions();
    var learned = E.seedLearn(sessions, { k: {}, ctx: {}, d2: {}, unavail: {} });
    return {
      v: 1,
      settings: { g: 0.005, timeCap: 60, garageBench: true, muscleCfg: clone(D.MUSCLE_CFG) },
      sessions: sessions, custom: [], learned: learned, current: null
    };
  }
  function fix(s) {
    var d = newState();
    s.settings = Object.assign({}, d.settings, s.settings || {});
    s.settings.muscleCfg = Object.assign({}, d.settings.muscleCfg, s.settings.muscleCfg || {});
    s.sessions = s.sessions || d.sessions;
    s.custom = s.custom || [];
    s.learned = Object.assign({ k: {}, ctx: {}, d2: {}, unavail: {} }, s.learned || {});
    if (s.current === undefined) s.current = null;
    return s;
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return fix(JSON.parse(raw));
    } catch (e) { }
    return newState();
  }
  var saveTimer = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('Could not save. Export your data in Settings.'); }
  }
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300); }

  function esc(x) {
    return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) {
    n = Number(n);
    if (!isFinite(n)) return '';
    return n % 1 ? n.toFixed(1).replace(/\.0$/, '') : String(n);
  }
  function fmtDate(iso) {
    if (!iso) return 'date unknown';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { $toast.classList.remove('show'); }, 2200);
  }
  function ts(d) { return d ? new Date(d).getTime() : 0; }

  function lib() { return D.LIB.concat(S.custom); }
  function libById() { var m = {}; lib().forEach(function (e) { m[e.id] = e; }); return m; }
  function flat(s) {
    if (s.exercises) return s.exercises;
    var out = [];
    (s.blocks || []).forEach(function (b) { b.exercises.forEach(function (e) { out.push(e); }); });
    return out;
  }

  function histOf(id, excludeId) {
    var out = [];
    S.sessions.forEach(function (s) {
      if (s.id === excludeId) return;
      (s.exercises || []).forEach(function (e) {
        if (e.exId !== id || e.skipped) return;
        var sets = e.sets.filter(function (x) { return x.done; });
        if (sets.length) out.push({ date: s.date, sets: sets });
      });
    });
    out.sort(function (a, b) { return ts(a.date) - ts(b.date); });
    return out;
  }

  function weekDoneNow(includeCurrent) {
    var list = S.sessions.slice();
    if (includeCurrent && S.current) list.push({ date: S.current.date, exercises: flat(S.current) });
    return E.weekDone(list, new Date());
  }

  function exDone(ex) {
    return ex.skipped || (ex.sets.length > 0 && ex.sets.every(function (s) { return s.done; }));
  }
  function blockDone(b) {
    return b.exercises.length > 0 && b.exercises.every(exDone);
  }
  function setCounts(b) {
    var n = 0, d = 0;
    b.exercises.forEach(function (e) {
      if (e.skipped) return;
      n += e.sets.length;
      d += e.sets.filter(function (s) { return s.done; }).length;
    });
    return { n: n, d: d };
  }

  function makeEx(ex, n, ctxKey, loc, now) {
    var plan = E.planExercise({
      ex: ex, lib: lib(), histOf: function (id) { return histOf(id); }, now: now,
      learned: S.learned, g: S.settings.g, location: loc, ctxKey: ctxKey
    });
    var sets = [];
    for (var i = 0; i < n; i++) sets.push({ w: '', r: '', rpe: null, flag: false, done: false });
    var t = E.setTarget(plan, sets, 0);
    if (plan.mode === 'bw') sets[0].w = plan.w;
    else if (t && t.w != null) sets[0].w = t.w;
    return { exId: ex.id, name: ex.name, muscle: ex.muscle, plan: plan, sets: sets, note: '', swappedFrom: null, skipped: false };
  }

  function defaultLoc() { var d = new Date().getDay(); return d === 0 || d === 6 ? 'garage' : 'gym'; }
  function defaultFed() { return new Date().getHours() < 8 ? 'fasted' : 'fed'; }
  function suggestType() {
    var d = new Date().getDay();
    var cands = d === 0 || d === 6 ? ['Upper', 'Lower'] : ['Push', 'Pull', 'Legs'];
    var now = Date.now(), best = cands[0], bestDays = -1;
    cands.forEach(function (t) {
      var last = 0;
      S.sessions.forEach(function (s) { if (s.type === t && s.date && ts(s.date) > last) last = ts(s.date); });
      var days = last ? (now - last) / E.DAY : 999;
      if (days > bestDays) { bestDays = days; best = t; }
    });
    return best;
  }

  function planFor(st) {
    return E.planSession({
      template: D.SESSIONS[st.type], lib: lib(), location: st.loc, settings: S.settings,
      muscleCfg: S.settings.muscleCfg, weekDone: weekDoneNow(false), again: st.again,
      learned: S.learned, now: new Date(), timeCap: S.settings.timeCap
    });
  }

  function createSession(st) {
    var now = new Date();
    var bucket = E.timeBucket(now);
    var ckey = E.ctxKey(bucket, st.fed);
    var plan = planFor(st);
    S.current = {
      id: 's' + now.getTime(), type: st.type, loc: st.loc, fed: st.fed, again: st.again,
      bucket: bucket, ctxKey: ckey, date: now.toISOString(), blockOrder: [], notes: '',
      blocks: plan.blocks.map(function (b) {
        return {
          id: b.id, name: b.name, startedAt: null,
          exercises: b.items.map(function (it) { return makeEx(it.ex, it.sets, ckey, st.loc, now); })
        };
      })
    };
    ui.openEx = null;
    save();
  }

  function finishSession() {
    var s = S.current;
    s.finishedAt = new Date().toISOString();
    s.finished = true;
    var order = {};
    s.blockOrder.forEach(function (id, i) { order[id] = i + 1; });
    var exs = [];
    s.blocks.forEach(function (b) {
      b.exercises.forEach(function (e) { e.blockId = b.id; e.blockName = b.name; e.blockPos = order[b.id] || null; exs.push(e); });
    });
    s.exercises = exs;
    delete s.blocks;
    E.updateLearning(S.learned, s, { libById: libById(), histOf: function (id) { return histOf(id); } });
    S.sessions.push(s);
    S.current = null;
    save();
    return s.id;
  }

  function targetText(ex, k) {
    var t = E.setTarget(ex.plan, ex.sets, k);
    if (!t) return null;
    if (t.wLo != null) {
      var r = t.rLo === t.rHi ? t.rLo : t.rLo + '–' + t.rHi;
      return fmt(t.wLo) + '–' + fmt(t.wHi) + ' × ' + r;
    }
    if (ex.plan.mode === 'bw' && !t.w) return 'Bodyweight × ' + t.r;
    if (ex.plan.mode === 'bw') return '+' + fmt(t.w) + ' × ' + t.r;
    return fmt(t.w) + ' × ' + t.r;
  }
  function valText(ex, s) {
    if (ex.plan.mode === 'bw' && !Number(s.w)) return 'Bodyweight × ' + s.r;
    if (ex.plan.mode === 'bw') return '+' + fmt(s.w) + ' × ' + s.r;
    return fmt(s.w) + ' × ' + s.r;
  }
  function exSummary(ex) {
    if (ex.skipped) return 'Skipped';
    var t = targetText(ex, 0);
    if (!t) return ex.sets.length + ' sets · calibrate set 1';
    return ex.sets.length + ' sets · set 1: ' + t;
  }

  function route() {
    var h = location.hash || '';
    if (!h) return S.current ? '#/session' : '#/home';
    return h;
  }

  var lastRoute = null;
  function render() {
    var h = route();
    var keep = h === lastRoute ? window.scrollY : 0;
    lastRoute = h;
    var parts = h.replace('#/', '').split('/');
    var html;
    switch (parts[0]) {
      case 'start': html = vStart(); break;
      case 'session': html = vSession(); break;
      case 'block': html = vBlock(Number(parts[1])); break;
      case 'summary': html = vSummary(parts[1]); break;
      case 'settings': html = vSettings(); break;
      default: html = vHome();
    }
    $app.innerHTML = html;
    window.scrollTo(0, keep);
  }
  function scrollToOpen() {
    var node = $app.querySelector('.ex.open');
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'start' });
  }
  function go(h) {
    if (location.hash === h) render();
    else location.hash = h;
  }

  function topBar(title, back, backLabel, right) {
    return '<div class="top">' +
      (back ? '<button class="back" data-go="' + back + '">‹ ' + esc(backLabel || 'Back') + '</button>' : '<h1>' + esc(title) + '</h1>') +
      (right || '') + '</div>' + (back ? '<h1>' + esc(title) + '</h1>' : '');
  }

  function weekBars(done) {
    var out = '<div class="bars">';
    Object.keys(D.MUSCLE_CFG).forEach(function (m) {
      var cfg = S.settings.muscleCfg[m];
      var d = done[m] || 0;
      var pct = Math.min(100, Math.round(d / cfg.target * 100));
      out += '<div class="bar' + (d >= cfg.target ? ' full' : '') + '"><span>' + esc(D.MUSCLE_LABEL[m]) + '</span>' +
        '<span class="track"><span class="fill" style="display:block;width:' + pct + '%"></span></span>' +
        '<span class="n">' + d + '/' + cfg.target + '</span></div>';
    });
    return out + '</div>';
  }

  function exSeries(id) {
    return histOf(id).filter(function (h) { return h.date; }).map(function (h) { return { date: h.date, E: E.bestE(h.sets) }; })
      .filter(function (p) { return p.E; });
  }

  function chartSvg(series) {
    if (series.length < 2) return '<p class="mute small">Needs two dated sessions for this exercise.</p>';
    var W = 320, H = 150, L = 36, R = 10, T = 12, B = 22;
    var vals = series.map(function (p) { return p.E; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max - min < 1) { max += 1; min -= 1; }
    var pad = (max - min) * 0.15; min -= pad; max += pad;
    var t0 = ts(series[0].date), t1 = ts(series[series.length - 1].date);
    var X = function (d) { return L + (t1 === t0 ? 0 : (ts(d) - t0) / (t1 - t0)) * (W - L - R); };
    var Y = function (v) { return T + (1 - (v - min) / (max - min)) * (H - T - B); };
    var pts = series.map(function (p) { return X(p.date).toFixed(1) + ',' + Y(p.E).toFixed(1); }).join(' ');
    var dots = series.map(function (p) { return '<circle class="dot" r="3.5" cx="' + X(p.date).toFixed(1) + '" cy="' + Y(p.E).toFixed(1) + '"></circle>'; }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Estimated one-rep max over time">' +
      '<line class="axis" x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '"></line>' +
      '<text x="' + (L - 6) + '" y="' + (Y(max - pad) + 4) + '" text-anchor="end">' + Math.round(max - pad) + '</text>' +
      '<text x="' + (L - 6) + '" y="' + (Y(min + pad) + 4) + '" text-anchor="end">' + Math.round(min + pad) + '</text>' +
      '<text x="' + L + '" y="' + (H - 6) + '">' + esc(fmtDate(series[0].date)) + '</text>' +
      '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(fmtDate(series[series.length - 1].date)) + '</text>' +
      '<polyline class="ln" points="' + pts + '"></polyline>' + dots + '</svg>';
  }

  function coachFacts() {
    var facts = [];
    var now = Date.now();
    var parts = [];
    TYPES.forEach(function (t) {
      var last = 0, any = false;
      S.sessions.forEach(function (s) { if (s.type === t) { any = true; if (s.date && ts(s.date) > last) last = ts(s.date); } });
      if (!any) return;
      parts.push(t + ' ' + (last ? Math.floor((now - last) / E.DAY) + 'd' : 'date unknown'));
    });
    if (parts.length) facts.push('Days since last session: <b>' + esc(parts.join(', ')) + '</b>.');

    var done = weekDoneNow(true);
    var short = [];
    Object.keys(D.MUSCLE_CFG).forEach(function (m) {
      var t = S.settings.muscleCfg[m].target, d = done[m] || 0;
      if (d < t) short.push({ m: m, gap: t - d, d: d, t: t });
    });
    short.sort(function (a, b) { return b.gap - a.gap; });
    if (short.length) {
      facts.push('Sets left this week: ' + short.slice(0, 4).map(function (x) { return '<b>' + esc(D.MUSCLE_LABEL[x.m].toLowerCase()) + '</b> ' + x.d + ' of ' + x.t; }).join(', ') + '.');
    } else {
      facts.push('Every muscle has reached its weekly set target.');
    }

    var byId = libById(), moves = [];
    Object.keys(byId).forEach(function (id) {
      var ser = exSeries(id).filter(function (p) { return now - ts(p.date) < 90 * E.DAY; });
      if (ser.length < 2) return;
      if (ts(ser[ser.length - 1].date) - ts(ser[0].date) < 14 * E.DAY) return;
      var pct = (ser[ser.length - 1].E / ser[0].E - 1) * 100;
      moves.push({ name: byId[id].name, pct: pct });
    });
    moves.sort(function (a, b) { return Math.abs(b.pct) - Math.abs(a.pct); });
    moves.slice(0, 2).forEach(function (m) {
      facts.push('<b>' + esc(m.name) + '</b> estimated max ' + (m.pct >= 0 ? 'up ' : 'down ') + Math.abs(m.pct).toFixed(1) + '% since ' + 'your first logged session.');
    });

    Object.keys(S.learned.ctx || {}).forEach(function (k) {
      var c = S.learned.ctx[k];
      if (c.n < 4) return;
      var p = k.split('|');
      var pct = (c.mean - 1) * 100;
      facts.push('<b>' + esc(BUCKET[p[0]] || p[0]) + ', ' + esc((FED[p[1]] || p[1]).toLowerCase()) + '</b>: performance runs ' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '% against projection (' + c.n + ' sessions).');
    });
    return facts;
  }

  function vHome() {
    var done = weekDoneNow(true);
    var byId = libById();
    var ids = Object.keys(byId).filter(function (id) { return exSeries(id).length >= 2; });
    if (!ui.chartEx || ids.indexOf(ui.chartEx) < 0) {
      ids.sort(function (a, b) { return exSeries(b).length - exSeries(a).length; });
      ui.chartEx = ids[0] || null;
    }
    var recent = S.sessions.filter(function (s) { return !s.seed; }).sort(function (a, b) { return ts(b.date) - ts(a.date); }).slice(0, 8);

    var h = '<div class="top"><h1>LiftLog</h1><button class="back" data-go="#/settings" aria-label="Settings">Settings</button></div>';
    if (S.current) {
      h += '<button class="btn" data-go="#/session">Resume ' + esc(S.current.type) + ' session</button>';
    } else {
      h += '<button class="btn" data-go="#/start">Start session</button>';
    }
    var standalone = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (!standalone && /iPhone|iPad/.test(navigator.userAgent) && !localStorage.getItem('liftlog.tip')) {
      h += '<div class="notice section"><span>Install: tap Share, then Add to Home Screen.</span><button class="ghost" data-act="hide-tip">Hide</button></div>';
    }
    h += '<div class="section"><h2>Notes from your data</h2><ul class="facts">' + coachFacts().map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="section"><h2>Sets this week</h2>' + weekBars(done) + '</div>';
    h += '<div class="section"><h2>Estimated max</h2><div class="chart">';
    if (ui.chartEx) {
      h += '<select data-act="chart-ex" aria-label="Exercise">' + ids.map(function (id) { return '<option value="' + id + '"' + (id === ui.chartEx ? ' selected' : '') + '>' + esc(byId[id].name) + '</option>'; }).join('') + '</select>' + chartSvg(exSeries(ui.chartEx));
    } else {
      h += '<p class="mute small">Charts appear after two dated sessions of the same exercise.</p>';
    }
    h += '</div></div>';
    h += '<div class="section"><h2>Logged sessions</h2>';
    if (!recent.length) h += '<p class="mute">None yet. Your first session shows up here.</p>';
    else {
      h += '<div class="hist">' + recent.map(function (s) {
        var sets = flat(s).reduce(function (a, e) { return a + e.sets.filter(function (x) { return x.done; }).length; }, 0);
        return '<button data-go="#/summary/' + s.id + '"><span><span class="t">' + esc(s.type) + '</span> <span class="mute small">' + esc(s.loc === 'garage' ? 'Garage' : 'Gym') + '</span></span><span class="mute num">' + esc(fmtDate(s.date)) + ' · ' + sets + ' sets</span></button>';
      }).join('') + '</div>';
    }
    return h + '</div>';
  }

  function vStart() {
    if (!ui.start) ui.start = { type: suggestType(), loc: defaultLoc(), fed: defaultFed(), again: 'unsure' };
    var st = ui.start;
    var now = new Date();
    var plan = planFor(st);
    var h = topBar('New session', '#/home', 'Home');
    h += '<p class="mute">' + esc(now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })) + ', ' + esc(fmtTime(now.toISOString())) + ' · ' + esc(BUCKET[E.timeBucket(now)]) + '</p>';
    h += '<div class="field-label">Session</div><div class="seg">' + TYPES.map(function (t) { return '<button class="' + (st.type === t ? 'on' : '') + '" data-act="st-type" data-v="' + t + '">' + t + '</button>'; }).join('') + '</div>';
    h += '<div class="field-label">Location</div><div class="seg"><button class="' + (st.loc === 'gym' ? 'on' : '') + '" data-act="st-loc" data-v="gym">Gym</button><button class="' + (st.loc === 'garage' ? 'on' : '') + '" data-act="st-loc" data-v="garage">Garage</button></div>';
    h += '<div class="field-label">Food</div><div class="seg">' + Object.keys(FED).map(function (k) { return '<button class="' + (st.fed === k ? 'on' : '') + '" data-act="st-fed" data-v="' + k + '">' + FED[k] + '</button>'; }).join('') + '</div>';
    h += '<div class="field-label">Training this again this week?</div><div class="seg">' + Object.keys(AGAIN).map(function (k) { return '<button class="' + (st.again === k ? 'on' : '') + '" data-act="st-again" data-v="' + k + '">' + AGAIN[k] + '</button>'; }).join('') + '</div>';
    h += '<div class="section"><h2>Plan</h2><p class="mute small" style="margin-bottom:10px">' + plan.totalSets + ' sets, about ' + plan.minutes + ' min. Targets adjust after your first set.</p><div class="list">';
    plan.blocks.forEach(function (b) {
      h += '<div class="card" style="padding:12px 14px"><h3>' + esc(b.name) + '</h3>';
      if (!b.items.length) h += '<p class="mute small">Nothing available at this location.</p>';
      b.items.forEach(function (it) { h += '<p class="mute small">' + esc(it.ex.name) + ' · ' + it.sets + ' sets</p>'; });
      h += '</div>';
    });
    h += '</div></div><div class="row-btns"><button class="btn" data-act="gen">Generate workout</button></div>';
    return h;
  }

  function vSession() {
    var s = S.current;
    if (!s) return topBar('No active session', '#/home', 'Home') + '<p class="mute">Start a session from the home page.</p>';
    var allDone = s.blocks.every(function (b) { return !b.exercises.length || blockDone(b); });
    var h = topBar(s.type + ' · ' + (s.loc === 'garage' ? 'Garage' : 'Gym'), '#/home', 'Home');
    h += '<p class="mute">' + esc(fmtDate(s.date)) + ', ' + esc(fmtTime(s.date)) + ' · ' + esc(BUCKET[s.bucket]) + ' · ' + esc(FED[s.fed]) + '</p>';
    h += '<div class="section list">';
    s.blocks.forEach(function (b, i) {
      var c = setCounts(b);
      var empty = !b.exercises.length;
      var cls = empty ? 'empty' : blockDone(b) ? 'done' : (b.startedAt ? 'active' : '');
      h += '<button class="block ' + cls + '" data-act="open-block" data-b="' + i + '"' + (empty ? ' disabled' : '') + '>' +
        '<span class="stripe"></span><span><span class="name">' + esc(b.name) + '</span>' +
        '<span class="meta" style="display:block">' + (empty ? 'Nothing available here' : esc(b.exercises.map(function (e) { return e.name.replace(/\s*\(.*\)/, ''); }).join(', '))) + '</span></span>' +
        '<span class="count">' + (empty ? '' : c.d + '/' + c.n) + '</span></button>';
    });
    h += '</div><div class="row-btns">';
    h += '<button class="btn' + (allDone ? '' : ' secondary') + '" data-act="finish">' + (allDone ? 'Finish session' : 'Finish early') + '</button>';
    h += '<button class="btn danger slim" data-act="discard">Discard session</button></div>';
    return h;
  }

  function setRow(bi, ei, k) {
    var ex = S.current.blocks[bi].exercises[ei], s = ex.sets[k];
    var key = 'data-b="' + bi + '" data-e="' + ei + '" data-s="' + k + '"';
    if (s.done) {
      return '<div class="set is-done"><span class="sno">' + (k + 1) + '</span><span class="val">' + esc(valText(ex, s)) + '</span><span class="sub">' + (s.rpe ? 'RPE ' + fmt(s.rpe) : '') + (s.flag ? (s.rpe ? ' · ' : '') + 'momentum' : '') + '</span><button class="ghost" data-act="undo" ' + key + '>Edit</button></div>';
    }
    var t = E.setTarget(ex.plan, ex.sets, k);
    var tt = targetText(ex, k);
    var ph = t ? (t.r != null ? t.r : t.rHi) : '';
    var h = '<div class="set"><div class="set-top"><span class="sno">' + (k + 1) + '</span>' +
      (tt ? '<span class="tgt">' + esc(tt) + '</span>' : '<span class="tgt none">' + (k === 0 ? 'Pick a weight, then log the set' : 'Targets appear after set 1') + '</span>') + '</div>';
    h += '<div class="set-in"><label><input data-f="w" ' + key + ' inputmode="decimal" value="' + esc(s.w) + '" aria-label="Weight in pounds"><span class="u">lb</span></label>' +
      '<label><input data-f="r" ' + key + ' inputmode="numeric" value="' + esc(s.r) + '" placeholder="' + esc(ph) + '" aria-label="Reps"><span class="u">reps</span></label>' +
      '<button class="ok" data-act="done" ' + key + ' aria-label="Log set">✓</button></div>';
    h += '<div class="chips"><span class="lbl">RPE</span>' + [7, 8, 9, 10].map(function (v) { return '<button class="chip' + (s.rpe === v ? ' on' : '') + '" data-act="rpe" data-v="' + v + '" ' + key + '>' + v + '</button>'; }).join('') +
      '<button class="chip warn' + (s.flag ? ' on' : '') + '" data-act="mom" ' + key + '>Momentum</button></div>';
    if (t && t.alt) h += '<button class="alt" data-act="alt" data-w="' + t.alt.w + '" ' + key + '>Or <b>' + fmt(t.alt.w) + ' × ' + t.alt.r + '</b> for more reps. Tap to use ' + fmt(t.alt.w) + '.</button>';
    return h + '</div>';
  }

  function exCard(bi, ei) {
    var ex = S.current.blocks[bi].exercises[ei];
    var id = bi + '-' + ei;
    var open = ui.openEx === id, done = exDone(ex);
    var nd = ex.sets.filter(function (s) { return s.done; }).length;
    var h = '<div class="ex' + (done ? ' done' : '') + (open ? ' open' : '') + '" data-ex="' + id + '">';
    h += '<button class="ex-head" data-act="toggle-ex" data-b="' + bi + '" data-e="' + ei + '" aria-expanded="' + open + '">' +
      '<span class="ex-line"><span class="ex-name">' + esc(ex.name) + '</span><span class="ex-meta">' + (ex.skipped ? 'Skipped' : nd + '/' + ex.sets.length) + '</span></span>' +
      (open ? '' : '<span class="ex-sum">' + esc(exSummary(ex)) + '</span>') + '</button>';
    if (open) {
      h += '<div class="ex-body">';
      if (ex.plan.note) h += '<p class="ex-note">' + esc(ex.plan.note) + (ex.plan.capped ? ' Dumbbells top out at 80 lb here.' : '') + '</p>';
      if (ex.swappedFrom) h += '<p class="sub">Swapped from ' + esc(ex.swappedFrom) + '.</p>';
      ex.sets.forEach(function (s, k) { h += setRow(bi, ei, k); });
      h += '<div class="tools"><button class="tool' + (ex.note ? ' has' : '') + '" data-act="note" data-b="' + bi + '" data-e="' + ei + '">' + (ex.note ? 'Note saved' : 'Note') + '</button>' +
        '<button class="tool" data-act="exmenu" data-b="' + bi + '" data-e="' + ei + '">More</button></div></div>';
    }
    return h + '</div>';
  }

  function vBlock(bi) {
    var s = S.current;
    if (!s || !s.blocks[bi]) return topBar('Block not found', '#/session', 'Session');
    var b = s.blocks[bi];
    if (!b.startedAt) {
      b.startedAt = new Date().toISOString();
      s.blockOrder.push(b.id);
      save();
    }
    if (ui.openEx == null || ui.openEx.split('-')[0] !== String(bi)) {
      var first = b.exercises.findIndex(function (e) { return !exDone(e); });
      ui.openEx = bi + '-' + (first < 0 ? 0 : first);
    }
    var c = setCounts(b);
    var h = topBar(b.name, '#/session', 'Session', '<span class="sub num">' + c.d + ' of ' + c.n + ' sets</span>');
    h += '<div class="section list">';
    b.exercises.forEach(function (e, ei) { h += exCard(bi, ei); });
    h += '</div>';
    if (blockDone(b)) h += '<div class="row-btns"><button class="btn" data-go="#/session">Block complete. Back to session</button></div>';
    return h;
  }

  function rerenderEx(bi, ei) {
    var node = $app.querySelector('[data-ex="' + bi + '-' + ei + '"]');
    if (!node) return render();
    var tmp = document.createElement('div');
    tmp.innerHTML = exCard(bi, ei);
    node.replaceWith(tmp.firstChild);
    var b = S.current.blocks[bi], c = setCounts(b);
    var sub = $app.querySelector('.top .sub');
    if (sub) sub.textContent = c.d + ' of ' + c.n + ' sets';
  }

  function openSheet(html) {
    $sheet.innerHTML = '<div class="pane">' + html + '</div>';
    $sheet.hidden = false;
  }
  function closeSheet() { $sheet.hidden = true; $sheet.innerHTML = ''; }

  function logDone(bi, ei, k) {
    var ex = S.current.blocks[bi].exercises[ei], s = ex.sets[k];
    var r = Number(String(s.r).replace(',', '.'));
    var wRaw = String(s.w).replace(',', '.');
    var w = wRaw === '' && ex.plan.mode === 'bw' ? 0 : Number(wRaw);
    if (!(r > 0)) return toast('Enter reps first.');
    if (!isFinite(w) || (wRaw === '' && ex.plan.mode !== 'bw')) return toast('Enter weight first.');
    var t = E.setTarget(ex.plan, ex.sets, k);
    s.tr = t ? (t.r != null ? t.r : t.rHi) : null;
    s.tw = t && t.w != null ? t.w : null;
    s.w = w; s.r = r; s.done = true; s.at = new Date().toISOString();
    var next = ex.sets[k + 1];
    if (next && !next.done && (next.w === '' || next.w == null)) next.w = w;
    save();
    if (exDone(ex)) {
      var b = S.current.blocks[bi];
      var nx = b.exercises.findIndex(function (e) { return !exDone(e); });
      ui.openEx = nx < 0 ? null : bi + '-' + nx;
      render();
      scrollToOpen();
    } else rerenderEx(bi, ei);
  }

  function swapSheet(bi, ei) {
    var b = S.current.blocks[bi], ex = b.exercises[ei];
    var used = {};
    S.current.blocks.forEach(function (bb) { bb.exercises.forEach(function (e) { used[e.exId] = true; }); });
    var cands = E.availableList(lib(), ex.muscle, S.current.loc, S.settings, S.learned.unavail, new Date()).filter(function (c) { return !used[c.id]; });
    var h = '<h3>Swap ' + esc(ex.name) + '</h3>';
    cands.forEach(function (c) {
      var p = E.planExercise({ ex: c, lib: lib(), histOf: function (id) { return histOf(id); }, now: new Date(), learned: S.learned, g: S.settings.g, location: S.current.loc, ctxKey: S.current.ctxKey });
      var sm = p.mode === 'known' ? 'Has recent history' : p.mode === 'range' ? 'Has history, range for set 1' : p.mode === 'swap' ? 'Estimated from ' + p.from : 'No history';
      h += '<button class="opt" data-act="swap-pick" data-b="' + bi + '" data-e="' + ei + '" data-id="' + esc(c.id) + '"><span>' + esc(c.name) + '</span><span class="sm">' + esc(sm) + '</span></button>';
    });
    h += '<button class="opt" data-act="custom-ex" data-b="' + bi + '" data-e="' + ei + '"><span>Add your own exercise</span></button>';
    h += '<div class="row-btns"><button class="btn secondary slim" data-act="close-sheet">Cancel</button></div>';
    openSheet(h);
  }

  function doSwap(bi, ei, newEx) {
    var b = S.current.blocks[bi], old = b.exercises[ei];
    if (!old.sets.some(function (s) { return s.done; })) {
      var u = S.learned.unavail[old.exId] || { count: 0, last: null };
      u.count += 1; u.last = new Date().toISOString();
      S.learned.unavail[old.exId] = u;
    }
    var ne = makeEx(newEx, old.sets.length, S.current.ctxKey, S.current.loc, new Date());
    ne.note = old.note; ne.swappedFrom = old.name;
    b.exercises[ei] = ne;
    ui.openEx = bi + '-' + ei;
    save(); closeSheet(); render();
  }

  function vSummary(id) {
    var s = S.sessions.filter(function (x) { return x.id === id; })[0];
    if (!s) return topBar('Session not found', '#/home', 'Home');
    var byId = libById();
    var exs = flat(s);
    var totalSets = 0, vol = 0;
    exs.forEach(function (e) { e.sets.forEach(function (x) { if (x.done) { totalSets++; vol += (Number(x.w) || 0) * (Number(x.r) || 0); } }); });
    var mins = s.finishedAt ? Math.round((ts(s.finishedAt) - ts(s.date)) / 60000) : null;

    var records = [], improve = [];
    exs.forEach(function (e) {
      if (e.skipped) return;
      var ex = byId[e.exId];
      var prior = histOf(e.exId, s.id).filter(function (h) { return ts(h.date) < ts(s.date) || !h.date; });
      var Enow = E.bestE(e.sets);
      var Eprev = 0;
      prior.forEach(function (h) { var v = E.bestE(h.sets); if (v && v > Eprev) Eprev = v; });
      if (Enow && Eprev && Enow > Eprev * 1.005) {
        records.push(esc(e.name) + ': estimated max <b>' + Math.round(Eprev) + ' to ' + Math.round(Enow) + ' lb</b> (+' + ((Enow / Eprev - 1) * 100).toFixed(1) + '%).');
      }
      if (ex && ex.kind !== 'bw') {
        var maxW = 0;
        prior.forEach(function (h) { h.sets.forEach(function (x) { if (Number(x.r) >= ex.reps[0] && Number(x.w) > maxW) maxW = Number(x.w); }); });
        e.sets.forEach(function (x) {
          if (x.done && !x.flag && maxW && Number(x.r) >= ex.reps[0] && Number(x.w) > maxW) {
            records.push(esc(e.name) + ': heaviest weight at ' + ex.reps[0] + '+ reps, <b>' + fmt(x.w) + ' lb</b> (was ' + fmt(maxW) + ').');
            maxW = Number(x.w);
          }
        });
      }
      e.sets.forEach(function (x, k) {
        if (x.done && x.tr && Number(x.r) <= x.tr - 2) improve.push(esc(e.name) + ' set ' + (k + 1) + ': <b>' + x.r + '</b> reps against a target of ' + x.tr + '.');
      });
      var rated = e.sets.filter(function (x) { return x.done && x.rpe && Number(x.w) > 0; });
      if (e.plan && e.plan.Eraw && rated.length >= 2) {
        var d = rated.reduce(function (a, x) { return a + (x.rpe - E.expectedRpe(e.plan.Eraw, Number(x.w), Number(x.r))); }, 0) / rated.length;
        if (d >= 1.5) improve.push(esc(e.name) + ': sets felt about ' + d.toFixed(1) + ' RPE harder than the numbers predict.');
      }
      if (e.swappedFrom) improve.push(esc(e.swappedFrom) + ' was unavailable. Swapped to ' + esc(e.name) + '.');
    });
    var done = weekDoneNow(false);
    var left = Object.keys(D.MUSCLE_CFG).filter(function (m) { return (done[m] || 0) < S.settings.muscleCfg[m].target && s.exercises.some(function (e) { return e.muscle === m; }); });
    left.forEach(function (m) { improve.push(esc(D.MUSCLE_LABEL[m]) + ': ' + (done[m] || 0) + ' of ' + S.settings.muscleCfg[m].target + ' weekly sets so far.'); });

    var h = topBar(s.type + ' summary', '#/home', 'Home');
    h += '<p class="mute">' + esc(fmtDate(s.date)) + ', ' + esc(fmtTime(s.date)) + ' · ' + esc(s.loc === 'garage' ? 'Garage' : 'Gym') + ' · ' + esc(BUCKET[s.bucket] || '') + ', ' + esc((FED[s.fed] || '').toLowerCase()) + '</p>';
    h += '<div class="section stat-row"><div class="stat"><div class="v">' + totalSets + '</div><div class="k">sets</div></div><div class="stat"><div class="v">' + Math.round(vol).toLocaleString('en-US') + '</div><div class="k">lb moved</div></div><div class="stat"><div class="v">' + (mins != null ? mins : '–') + '</div><div class="k">min</div></div></div>';
    if (s.blockOrder && s.blockOrder.length) {
      var names = {};
      exs.forEach(function (e) { names[e.blockId] = e.blockName; });
      h += '<p class="mute small" style="margin-top:12px">Block order: ' + esc(s.blockOrder.map(function (b) { return names[b] || b; }).join(', then ')) + '.</p>';
    }
    h += '<div class="section"><h2>Records</h2>' + (records.length ? '<ul class="facts">' + records.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul>' : '<p class="mute">No new records this session.</p>') + '</div>';
    h += '<div class="section"><h2>To improve</h2>' + (improve.length ? '<ul class="facts">' + improve.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul>' : '<p class="mute">Nothing flagged.</p>') + '</div>';
    h += '<div class="section"><h2>Sets this week</h2>' + weekBars(done) + '</div>';
    var noted = exs.filter(function (e) { return e.note; });
    if (noted.length) h += '<div class="section"><h2>Exercise notes</h2><ul class="facts">' + noted.map(function (e) { return '<li><b>' + esc(e.name) + '</b><br>' + esc(e.note) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="section"><h2>Notes and questions</h2><textarea id="perf-note" data-sid="' + esc(s.id) + '" placeholder="Write anything about this session.">' + esc(s.perfNote || '') + '</textarea>' +
      '<p class="mute small" style="margin-top:6px">Saved with this session. Answers to questions come from Claude in this chat.</p></div>';
    return h;
  }

  function vSettings() {
    var h = topBar('Settings', '#/home', 'Home');
    h += '<div class="section"><h2>Weekly sets per muscle</h2><p class="mute small" style="margin-bottom:10px">Target is hard sets per week. Max is the most in one session. Min is the fewest.</p><div class="list">';
    h += '<div class="cfg"><span></span><span class="h">Target</span><span class="h">Max</span><span class="h">Min</span></div>';
    Object.keys(D.MUSCLE_CFG).forEach(function (m) {
      var c = S.settings.muscleCfg[m];
      h += '<div class="cfg"><span>' + esc(D.MUSCLE_LABEL[m]) + '</span>' +
        ['target', 'cap', 'min'].map(function (f) { return '<input inputmode="numeric" data-cfg="' + m + '.' + f + '" value="' + c[f] + '" aria-label="' + esc(D.MUSCLE_LABEL[m]) + ' ' + f + '">'; }).join('') + '</div>';
    });
    h += '</div></div>';
    h += '<div class="section"><h2>Session</h2><div class="list">' +
      '<div class="cfg" style="grid-template-columns:1fr 80px"><span>Time cap (min)</span><input inputmode="numeric" data-cfg="timeCap" value="' + S.settings.timeCap + '" aria-label="Time cap in minutes"></div>' +
      '<div class="toggle-row"><span>Garage has a bench</span><button class="chip' + (S.settings.garageBench ? ' on' : '') + '" data-act="bench">' + (S.settings.garageBench ? 'Yes' : 'No') + '</button></div></div></div>';
    h += '<div class="section"><h2>Backup</h2><p class="mute small" style="margin-bottom:10px">Export after each week. Your data lives on this phone only.</p><div class="row-btns">' +
      '<button class="btn secondary" data-act="export">Export data</button><button class="btn secondary" data-act="import">Import data</button>' +
      '<button class="btn danger slim" data-act="reset">Reset all data</button></div></div>';
    return h;
  }

  function exportSheet() {
    var json = JSON.stringify(S);
    openSheet('<h3>Export</h3><textarea id="exp" readonly>' + esc(json) + '</textarea><div class="row-btns">' +
      '<button class="btn" data-act="copy-export">Copy to clipboard</button>' +
      '<button class="btn secondary" data-act="download-export">Download file</button>' +
      '<button class="btn secondary slim" data-act="close-sheet">Close</button></div>');
  }
  function importSheet() {
    openSheet('<h3>Import</h3><p class="mute small" style="margin-bottom:8px">Paste exported data. This replaces everything on this phone.</p><textarea id="imp" placeholder="Paste JSON here"></textarea><div class="row-btns">' +
      '<button class="btn" data-act="do-import">Import</button><button class="btn secondary slim" data-act="close-sheet">Cancel</button></div>');
  }

  function onClick(ev) {
    var nav = ev.target.closest('[data-go]');
    if (nav) { closeSheet(); return location.hash === nav.dataset.go ? render() : (location.hash = nav.dataset.go); }
    var el = ev.target.closest('[data-act]');
    if (!el) { if (ev.target === $sheet) closeSheet(); return; }
    var a = el.dataset.act, bi = Number(el.dataset.b), ei = Number(el.dataset.e), k = Number(el.dataset.s);
    var ex = S.current && !isNaN(bi) && S.current.blocks[bi] ? S.current.blocks[bi].exercises[ei] : null;
    switch (a) {
      case 'hide-tip': localStorage.setItem('liftlog.tip', '1'); render(); break;
      case 'st-type': ui.start.type = el.dataset.v; render(); break;
      case 'st-loc': ui.start.loc = el.dataset.v; render(); break;
      case 'st-fed': ui.start.fed = el.dataset.v; render(); break;
      case 'st-again': ui.start.again = el.dataset.v; render(); break;
      case 'gen': createSession(ui.start); ui.start = null; go('#/session'); break;
      case 'open-block': ui.openEx = null; location.hash = '#/block/' + bi; break;
      case 'toggle-ex': ui.openEx = ui.openEx === bi + '-' + ei ? null : bi + '-' + ei; render(); scrollToOpen(); break;
      case 'done': logDone(bi, ei, k); break;
      case 'undo': ex.sets[k].done = false; ui.openEx = bi + '-' + ei; save(); render(); break;
      case 'rpe': ex.sets[k].rpe = ex.sets[k].rpe === Number(el.dataset.v) ? null : Number(el.dataset.v); save(); rerenderEx(bi, ei); break;
      case 'mom': ex.sets[k].flag = !ex.sets[k].flag; save(); rerenderEx(bi, ei); break;
      case 'alt': ex.sets[k].w = Number(el.dataset.w); save(); rerenderEx(bi, ei); break;
      case 'note':
        openSheet('<h3>' + esc(ex.name) + '</h3><textarea id="exnote" placeholder="How did it feel? Form, pain, equipment, anything.">' + esc(ex.note) + '</textarea><div class="row-btns"><button class="btn" data-act="save-note" data-b="' + bi + '" data-e="' + ei + '">Save note</button><button class="btn secondary slim" data-act="close-sheet">Cancel</button></div>');
        break;
      case 'save-note': ex.note = document.getElementById('exnote').value.trim(); save(); closeSheet(); rerenderEx(bi, ei); break;
      case 'exmenu':
        openSheet('<h3>' + esc(ex.name) + '</h3>' +
          '<button class="opt" data-act="swap" data-b="' + bi + '" data-e="' + ei + '"><span>Swap exercise</span><span class="sm">Unavailable or not working</span></button>' +
          '<button class="opt" data-act="add-set" data-b="' + bi + '" data-e="' + ei + '"><span>Add a set</span></button>' +
          '<button class="opt" data-act="rm-set" data-b="' + bi + '" data-e="' + ei + '"><span>Remove last set</span></button>' +
          '<button class="opt" data-act="skip" data-b="' + bi + '" data-e="' + ei + '"><span>' + (ex.skipped ? 'Restore exercise' : 'Skip exercise') + '</span></button>' +
          '<div class="row-btns"><button class="btn secondary slim" data-act="close-sheet">Close</button></div>');
        break;
      case 'swap': swapSheet(bi, ei); break;
      case 'swap-pick': doSwap(bi, ei, libById()[el.dataset.id]); break;
      case 'custom-ex': {
        var name = window.prompt('Exercise name');
        if (!name || !name.trim()) break;
        var c = { id: 'custom-' + Date.now(), name: name.trim(), muscle: ex.muscle, equip: ['any'], kind: 'iso', pattern: null, rel: 1, reps: [8, 12], inc: 5, v: 'custom-' + Date.now() };
        S.custom.push(c);
        doSwap(bi, ei, c);
        break;
      }
      case 'add-set': ex.sets.push({ w: ex.sets.length ? ex.sets[ex.sets.length - 1].w : '', r: '', rpe: null, flag: false, done: false }); save(); closeSheet(); ui.openEx = bi + '-' + ei; render(); break;
      case 'rm-set':
        if (ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].done) { ex.sets.pop(); save(); }
        else toast('The last set is logged or the only set.');
        closeSheet(); render(); break;
      case 'skip': ex.skipped = !ex.skipped; save(); closeSheet(); render(); break;
      case 'close-sheet': closeSheet(); break;
      case 'finish': {
        var undone = S.current.blocks.some(function (b) { return b.exercises.length && !blockDone(b); });
        if (undone && !window.confirm('Some sets are not logged. Finish anyway?')) break;
        var sid = finishSession();
        go('#/summary/' + sid);
        break;
      }
      case 'discard':
        if (window.confirm('Discard this session? Logged sets will be lost.')) { S.current = null; save(); go('#/home'); }
        break;
      case 'bench': S.settings.garageBench = !S.settings.garageBench; save(); render(); break;
      case 'export': exportSheet(); break;
      case 'copy-export': {
        var txt = document.getElementById('exp');
        txt.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { }
        if (navigator.clipboard) navigator.clipboard.writeText(txt.value).then(function () { toast('Copied.'); }, function () { toast(ok ? 'Copied.' : 'Select the text and copy it.'); });
        else toast(ok ? 'Copied.' : 'Select the text and copy it.');
        break;
      }
      case 'download-export': {
        var blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'liftlog-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(link); link.click(); link.remove();
        break;
      }
      case 'import': importSheet(); break;
      case 'do-import': {
        try {
          var parsed = JSON.parse(document.getElementById('imp').value);
          if (!parsed || !Array.isArray(parsed.sessions)) throw new Error('bad');
          S = fix(parsed); save(); closeSheet(); toast('Imported.'); go('#/home');
        } catch (e) { toast('That is not valid LiftLog data.'); }
        break;
      }
      case 'reset':
        if (window.confirm('Delete all logged data on this phone?')) { S = newState(); save(); ui = { openEx: null, chartEx: null, start: null }; go('#/home'); }
        break;
    }
  }

  function onInput(ev) {
    var t = ev.target;
    if (t.dataset.f && S.current) {
      var ex = S.current.blocks[Number(t.dataset.b)].exercises[Number(t.dataset.e)];
      ex.sets[Number(t.dataset.s)][t.dataset.f] = t.value;
      saveSoon();
    } else if (t.id === 'perf-note') {
      var s = S.sessions.filter(function (x) { return x.id === t.dataset.sid; })[0];
      if (s) { s.perfNote = t.value; saveSoon(); }
    } else if (t.dataset.cfg) {
      var n = Number(t.value);
      if (!(n >= 0)) return;
      var p = t.dataset.cfg.split('.');
      if (p.length === 1) S.settings[p[0]] = n;
      else S.settings.muscleCfg[p[0]][p[1]] = n;
      saveSoon();
    }
  }

  function onChange(ev) {
    if (ev.target.dataset.act === 'chart-ex') { ui.chartEx = ev.target.value; render(); }
  }

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  window.addEventListener('hashchange', render);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }

  save();
  render();
  window.__liftlog = { get state() { return S; }, render: render };
})();
