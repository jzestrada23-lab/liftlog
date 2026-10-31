(function () {
  'use strict';
  var E = Engine, D = Data;
  var APP_VERSION = '2.5';
  var APP_BUILD = '2026-10-31';
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
      v: 2,
      settings: { g: 0.005, timeCap: 60, garageBench: true, restTimer: true, restSound: true, name: 'Jesse', muscleCfg: clone(D.MUSCLE_CFG) },
      sessions: sessions, custom: [], learned: learned, current: null,
      templates: {}, goals: { week: '', list: [], dismissed: [] }, greet: { key: '', id: null, head: '', line: '', seen: [] }
    };
  }
  function migrate(s) {
    if (s.v >= 2) return s;
    var d = newState();
    s.settings = s.settings || {};
    s.settings.muscleCfg = clone(d.settings.muscleCfg);
    (s.custom || []).forEach(function (c) { if (D.OLD_MUSCLE[c.muscle]) c.muscle = D.subFor(c.muscle, c.name); });
    var byId = {};
    D.LIB.concat(s.custom || []).forEach(function (e) { byId[e.id] = e; });
    var remap = function (e) {
      if (byId[e.exId]) e.muscle = byId[e.exId].muscle;
      else if (D.OLD_MUSCLE[e.muscle]) e.muscle = D.subFor(e.muscle, e.name);
    };
    (s.sessions || []).forEach(function (x) { (x.exercises || []).forEach(remap); });
    if (s.current && s.current.blocks) s.current.blocks.forEach(function (b) { b.exercises.forEach(remap); });
    s.sessions = s.sessions || [];
    if (!s.sessions.some(function (x) { return x.id === 'backfill-straight-arm'; })) {
      s.sessions.push({
        id: 'backfill-straight-arm', seed: true, type: 'Extra', date: '2026-10-29T10:55:00', finished: true, loc: 'gym', fed: 'fed', bucket: 'midday',
        exercises: [{ exId: 'straight_arm', muscle: 'lats', note: '', sets: [
          { w: 72.5, r: 8, rpe: null, flag: false, done: true },
          { w: 72.5, r: 4, rpe: null, flag: false, done: true },
          { w: 65, r: 3, rpe: null, flag: false, done: true }] }]
      });
    }
    s.v = 2;
    return s;
  }
  function fix(s) {
    s = migrate(s);
    var d = newState();
    s.settings = Object.assign({}, d.settings, s.settings || {});
    s.settings.muscleCfg = Object.assign({}, d.settings.muscleCfg, s.settings.muscleCfg || {});
    Object.keys(s.settings.muscleCfg).forEach(function (k) { if (!d.settings.muscleCfg[k]) delete s.settings.muscleCfg[k]; });
    s.sessions = s.sessions || d.sessions;
    s.custom = s.custom || [];
    s.learned = Object.assign({ k: {}, ctx: {}, d2: {}, unavail: {} }, s.learned || {});
    if (s.current === undefined) s.current = null;
    s.templates = s.templates || {};
    s.goals = s.goals || d.goals;
    s.greet = s.greet || d.greet;
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

  function showSplash() {
    var el = document.createElement('div');
    el.className = 'splash';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:100;background:#0d0f12;color:#e8eaee;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font:500 16px Manrope,-apple-system,system-ui,sans-serif;text-align:center;padding:24px';
    el.innerHTML = '<div style="font-size:34px;font-weight:700;letter-spacing:-0.03em">LiftLog</div>' +
      '<div style="font-size:18px;font-variant-numeric:tabular-nums">Version ' + APP_VERSION + '</div>' +
      '<div style="font-size:13px;color:#6b7280">Build ' + APP_BUILD + '</div>' +
      '<div class="splash-status" style="font-size:14px;color:#9aa1ac;margin-top:18px;min-height:20px">Checking for updates…</div>' +
      '<button class="splash-go" style="display:none;margin-top:8px;min-height:48px;padding:0 24px;border-radius:12px;background:#7cc4d6;color:#0b1d22;font:700 16px Manrope,-apple-system,system-ui,sans-serif;border:0">Continue</button>';
    document.body.appendChild(el);
    var status = el.querySelector('.splash-status'), go = el.querySelector('.splash-go');
    var closed = false, hold = false, minDone = false, checked = false;
    function close() { if (closed) return; closed = true; el.remove(); }
    function tryClose() { if (minDone && checked && !hold) close(); }
    go.addEventListener('click', close);
    el.addEventListener('click', function () { if (!hold) close(); });
    setTimeout(function () { minDone = true; tryClose(); }, 1200);
    setTimeout(function () { if (!checked) { checked = true; status.textContent = 'Offline. Using the saved version.'; tryClose(); } }, 3500);
    if (typeof fetch !== 'function' || location.protocol === 'file:') {
      checked = true; status.textContent = 'Up to date'; return;
    }
    fetch('app.js', { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var m = /APP_VERSION = '([^']+)'/.exec(t || '');
      checked = true;
      if (m && m[1] !== APP_VERSION) {
        hold = true;
        status.textContent = 'Update ready: version ' + m[1] + '. Close LiftLog completely and open it again.';
        go.style.display = 'block';
        try { if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update(); }); } catch (e) { }
      } else {
        status.textContent = m ? 'Up to date' : 'Could not check for updates.';
        tryClose();
      }
    }).catch(function () {
      checked = true; status.textContent = 'Offline. Using the saved version.'; tryClose();
    });
  }

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

  function histOf(id, excludeId, raw) {
    var out = [];
    S.sessions.forEach(function (s) {
      if (s.id === excludeId) return;
      (s.exercises || []).forEach(function (e) {
        if (e.exId !== id || e.skipped) return;
        var sets = e.sets.filter(function (x) { return x.done; });
        if (!raw && e.fatMult && e.fatMult < 1) sets = sets.map(function (x) { var y = Object.assign({}, x); if (Number(y.w) > 0) y.w = Number(y.w) / e.fatMult; return y; });
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
    return { exId: ex.id, name: ex.name, muscle: ex.muscle, plan: plan, planBase: clone(plan), prefW: sets[0].w, sets: sets, note: '', swappedFrom: null, skipped: false };
  }

  function refreshFatigue() {
    var cur = S.current;
    if (!cur || !cur.blocks) return;
    var byId = libById(), all = flat(cur);
    all.forEach(function (ex) {
      if (ex.skipped || ex.sets.some(function (q) { return q.done; })) return;
      if (!ex.planBase) ex.planBase = clone(ex.plan);
      var prior = all.filter(function (o) { return o !== ex; }).map(function (o) { return { exId: o.exId, muscle: o.muscle, n: o.sets.filter(function (q) { return q.done; }).length }; });
      var n = E.fatigueLoad(ex, prior, byId);
      var fk = S.learned.fatK && S.learned.fatK[ex.muscle];
      var mult = E.fatMult(n, fk ? fk.k : null);
      ex.fatN = n; ex.fatMult = mult;
      ex.plan = E.fatPlan(ex.planBase, mult);
      var t = E.setTarget(ex.plan, ex.sets, 0);
      var nw = ex.plan.mode === 'bw' ? ex.plan.w : (t && t.w != null ? t.w : '');
      if (String(ex.sets[0].w) === String(ex.prefW)) { ex.sets[0].w = nw; ex.prefW = nw; }
    });
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
    var tpl = S.templates && S.templates[st.type];
    if (tpl && tpl.blocks && tpl.blocks.length) return planFromTemplate(st, tpl);
    return E.planSession({
      template: D.SESSIONS[st.type], lib: lib(), location: st.loc, settings: S.settings,
      muscleCfg: S.settings.muscleCfg, weekDone: weekDoneNow(false), again: st.again,
      learned: S.learned, now: new Date(), timeCap: S.settings.timeCap,
      hasHist: function (id) { return histOf(id).length > 0; }
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
          exercises: b.items.map(function (it) {
            var e = makeEx(it.ex, it.sets, ckey, st.loc, now);
            if (it.slotId) e.slotId = it.slotId;
            if (it.subFrom) e.swappedFrom = it.subFrom;
            return e;
          })
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
    stopRest();
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

  var rest = null, restTick = null, audio = null, wake = null, $rest = null;

  function unlockAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audio) audio = new AC();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { }
  }
  function beep() {
    try {
      if (!audio) return;
      var t0 = audio.currentTime + 0.02;
      [0, 0.28, 0.56].forEach(function (off, i) {
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine';
        o.frequency.value = i === 2 ? 1175 : 880;
        g.gain.setValueAtTime(0.0001, t0 + off);
        g.gain.exponentialRampToValueAtTime(0.5, t0 + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.2);
        o.connect(g); g.connect(audio.destination);
        o.start(t0 + off); o.stop(t0 + off + 0.22);
      });
    } catch (e) { }
  }
  function keepAwake(on) {
    try {
      if (!navigator.wakeLock) return;
      if (on && !wake) {
        navigator.wakeLock.request('screen').then(function (l) {
          wake = l;
          l.addEventListener('release', function () { wake = null; });
        }, function () { });
      } else if (!on && wake) { wake.release(); wake = null; }
    } catch (e) { }
  }
  function restEl() {
    if (!$rest) {
      $rest = document.createElement('div');
      $rest.className = 'rest';
      $rest.hidden = true;
      $rest.innerHTML = '<div class="rest-fill"></div><div class="rest-row"><div><div class="rest-name"></div><div class="rest-time num"></div></div>' +
        '<div class="rest-btns"><button data-act="rest-sub" aria-label="15 seconds less">−15</button><button data-act="rest-add" aria-label="15 seconds more">+15</button><button class="go" data-act="rest-start">Start set</button></div></div>';
      document.body.appendChild($rest);
    }
    return $rest;
  }
  function startRest(ex, setRef) {
    if (!S.settings.restTimer || !S.current) return;
    unlockAudio();
    keepAwake(true);
    var sec = E.restSeconds(ex.exId, ex.plan && ex.plan.kind, S.sessions);
    rest = { end: Date.now() + sec * 1000, total: sec, name: ex.name, fired: false, fired2: false, setRef: setRef || null, started: Date.now() };
    if (setRef) setRef.rp = sec;
    document.body.classList.add('has-rest');
    var el = restEl();
    el.hidden = false;
    el.classList.remove('done');
    el.querySelector('.rest-name').textContent = 'Rest · ' + ex.name.replace(/\s*\(.*\)/, '');
    clearInterval(restTick);
    restTick = setInterval(tickRest, 250);
    tickRest();
  }
  function tickRest() {
    if (!rest) return;
    var el = restEl();
    var left = Math.ceil((rest.end - Date.now()) / 1000);
    var time = el.querySelector('.rest-time');
    if (left > 0) {
      time.textContent = Math.floor(left / 60) + ':' + (left % 60 < 10 ? '0' : '') + (left % 60);
      el.classList.remove('done', 'over');
      el.querySelector('.rest-fill').style.width = Math.max(0, Math.min(100, 100 * (1 - left / rest.total))) + '%';
    } else {
      var over = -left;
      time.textContent = '+' + Math.floor(over / 60) + ':' + (over % 60 < 10 ? '0' : '') + (over % 60);
      el.classList.add('done');
      el.classList.toggle('over', over >= 30);
      el.querySelector('.rest-fill').style.width = '100%';
      if (!rest.fired) {
        rest.fired = true;
        if (S.settings.restSound) beep();
        try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { }
      }
      if (over >= 60 && !rest.fired2) {
        rest.fired2 = true;
        if (S.settings.restSound) beep();
      }
      if (over > 1800) stopRest();
    }
  }
  function stopRest() {
    rest = null;
    clearInterval(restTick);
    restTick = null;
    if ($rest) $rest.hidden = true;
    document.body.classList.remove('has-rest');
    keepAwake(false);
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
    refreshFatigue();
    var h = route();
    var keep = h === lastRoute ? window.scrollY : 0;
    lastRoute = h;
    var parts = h.replace('#/', '').split('/');
    var html;
    var tab = null;
    switch (parts[0]) {
      case 'start': html = vStart(); tab = 'start'; break;
      case 'builder': html = vBuilder(parts[1] ? decodeURIComponent(parts[1]) : null); tab = 'builder'; break;
      case 'progress': html = vProgress(); tab = 'progress'; break;
      case 'session': html = vSession(); break;
      case 'block': html = vBlock(Number(parts[1])); break;
      case 'summary': html = vSummary(parts[1]); tab = 'progress'; break;
      case 'settings': html = vSettings(); tab = 'settings'; break;
      default: html = vHome(); tab = 'home';
    }
    document.body.classList.toggle('has-tabs', !!tab);
    $app.innerHTML = html + (tab ? tabBar(tab) : '');
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
    var ind = E.weekIndirect(S.sessions.concat(S.current ? [{ date: S.current.date, exercises: flat(S.current) }] : []), new Date(), libById());
    var out = '<div class="bars">';
    Object.keys(D.MUSCLE_CFG).forEach(function (m) {
      var cfg = S.settings.muscleCfg[m];
      var d = done[m] || 0;
      var pct = Math.min(100, Math.round(d / cfg.target * 100));
      out += '<div class="bar' + (d >= cfg.target ? ' full' : '') + '"><span>' + esc(D.MUSCLE_LABEL[m]) + '</span>' +
        '<span class="track"><span class="fill" style="display:block;width:' + pct + '%"></span></span>' +
        '<span class="n">' + d + '/' + cfg.target + (ind[m] ? '<span class="ind"> +' + fmt(ind[m]) + '</span>' : '') + '</span></div>';
    });
    return out + '</div>' + '<p class="mute small" style="margin-top:8px">The small plus number is indirect work from other exercises. It does not count toward the target.</p>';
  }

  function exSeries(id) {
    return histOf(id, null, true).filter(function (h) { return h.date; }).map(function (h) { return { date: h.date, E: E.bestE(h.sets) }; })
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

  function transitionLine() {
    var g = [];
    S.sessions.forEach(function (s) { flat(s).forEach(function (e) { e.sets.forEach(function (q) { if (q.gapPrev > 0 && q.gapPrev < 1200) g.push(q.gapPrev); }); }); });
    if (g.length < 3) return '';
    g.sort(function (x, y) { return x - y; });
    var m = Math.round(g[Math.floor(g.length / 2)] / 15) * 15;
    return '<p class="mute small" style="margin-top:10px">Between exercises: <b class="num">' + Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60) + '</b> median, ' + g.length + ' switches. Includes the first set of the next exercise.</p>';
  }
  function restCard() {
    var st = E.restStats(S.sessions);
    var h = '<div class="section"><h2>Rest and output</h2>';
    if (st.pairs < 6) return h + '<p class="mute small">Appears after about 6 timed rests. Log sets right after you finish them.</p>' + transitionLine() + '</div>';
    h += '<p class="mute small" style="margin-bottom:8px">How much strength you kept on the next set, by rest length. Higher is better. Based on ' + st.pairs + ' rests.</p><div class="facts">';
    st.buckets.forEach(function (b) {
      h += '<li><span>' + esc(b.label) + '</span> <b style="float:right">' + (b.n >= 4 ? Math.round(b.ret * 100) + '% · ' + b.n + ' sets' : b.n + ' sets, need 4') + '</b></li>';
    });
    h += '</div>';
    var ad = st.adherence;
    if (ad.n >= 6) {
      h += '<p class="mute small" style="margin:14px 0 8px">Against your timer: ' + ad.overN + ' of ' + ad.n + ' rests ran 30 seconds or more over' + (ad.overN ? ' (about ' + Math.round(ad.avgOver) + ' seconds)' : '') + '.</p>';
      if (ad.overN >= 4 && ad.onN >= 4) h += '<div class="facts"><li><span>On time</span> <b style="float:right">' + Math.round(ad.onRet * 100) + '% kept</b></li><li><span>Over</span> <b style="float:right">' + Math.round(ad.overRet * 100) + '% kept</b></li></div>';
    }
    if (st.sessions.length) {
      h += '<p class="mute small" style="margin:14px 0 8px">Per session: average rest and load moved per minute.</p><div class="facts">';
      st.sessions.slice(-6).forEach(function (x) {
        var m = Math.round(x.avgRest / 15) * 15;
        h += '<li><span>' + esc(x.type) + ' · ' + esc(fmtDate(x.date)) + '</span> <b style="float:right">' + Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60) + ' rest · ' + Math.round(x.perMin) + ' lb/min</b></li>';
      });
      h += '</div>';
    }
    return h + transitionLine() + '</div>';
  }

  /* ---------- Home: greeting, goals, body map ---------- */
  function coachSessions() {
    return S.sessions.concat(S.current ? [{ date: S.current.date, type: S.current.type, exercises: flat(S.current) }] : []);
  }
  function coachOpts() {
    return {
      sessions: coachSessions(), cfg: S.settings.muscleCfg, labels: D.MUSCLE_LABEL, now: new Date(),
      name: S.settings.name || 'Jesse', nextType: suggestType(), libById: libById(),
      exName: function (id) { var x = libById()[id]; return x && x.name; }
    };
  }
  function goalsState() {
    var wk = E.weekStart(new Date()).toISOString().slice(0, 10);
    if (!S.goals || S.goals.week !== wk) { S.goals = { week: wk, list: [], dismissed: [] }; save(); }
    return S.goals;
  }
  /* ---------- Shared UI pieces ---------- */
  var TAB_IC = {
    home: '<path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/>',
    start: '<circle cx="12" cy="12" r="8.5"/><path d="M10 8.6v6.8l5.4-3.4z" fill="currentColor" stroke="none"/>',
    builder: '<rect x="4" y="4.5" width="16" height="4" rx="1.4"/><rect x="4" y="10" width="16" height="4" rx="1.4"/><rect x="4" y="15.5" width="10" height="4" rx="1.4"/>',
    progress: '<path d="M4 19h16M7 16v-5M12 16V6M17 16v-8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>'
  };
  var TABS = [['home', 'Home'], ['start', 'Start'], ['builder', 'Builder'], ['progress', 'Progress'], ['settings', 'Settings']];
  function tabBar(cur) {
    return '<nav class="tabbar" aria-label="Main">' + TABS.map(function (t) {
      return '<button class="tab' + (t[0] === cur ? ' on' : '') + '" data-go="#/' + t[0] + '"' + (t[0] === cur ? ' aria-current="page"' : '') + '>' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TAB_IC[t[0]] + '</svg><span>' + t[1] + '</span></button>';
    }).join('') + '</nav>';
  }
  function pageHead(title, sub) {
    return '<header class="phead"><h1>' + esc(title) + '</h1>' + (sub ? '<p class="psub">' + sub + '</p>' : '') + '</header>';
  }
  function ring(p) {
    var v = Math.max(2, Math.min(100, p || 0));
    return '<svg class="ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" class="ring-bg"/><circle cx="20" cy="20" r="16" class="ring-fg" stroke-dasharray="' + (v / 100 * 100.5).toFixed(1) + ' 200" transform="rotate(-90 20 20)"/></svg>';
  }
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }
  function newId() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ---------- Home ---------- */
  var BODY_SLIDES = ['Upper', 'Legs'];
  var ANAT_PAL = { base: '#8a6a66', passive: '#5c4b4a', tendon: '#d8cfbf', deep: '#2a2526' };
  var ARM_CHIPS = [['bi_long', 'Bi long'], ['bi_short', 'Bi short'], ['tri_long', 'Tri long'], ['tri_lat', 'Tri lat'], ['forearms', 'Forearm']];
  function bodySlide() { return (((ui.bodySlide || 0) % 2) + 2) % 2; }
  function regionStates(o) { return Coach.regionState(o.sessions, o.cfg, D.MUSCLE_LABEL, o.now, D.GLUTE); }
  function bodyCard(o) {
    var rs = regionStates(o), st = {};
    Object.keys(rs).forEach(function (k) {
      var hh = Body.heat(rs[k].days);
      st[k] = { pct: rs[k].pct, fill: hh.on ? hh.fill : null };
    });
    var i = bodySlide();
    var figs = i === 0 ? [Anatomy.UPPER_FRONT, Anatomy.UPPER_BACK] : [Anatomy.LEG_FRONT, Anatomy.LEG_BACK];
    var names = i === 0 ? ['Upper body, front', 'Upper body, back'] : ['Legs, front', 'Legs, back'];
    var h = '<section class="card map"><div class="body-wrap anat-slide">' + figs.map(function (f, k) { return Anatomy.figure(f, st, ANAT_PAL, { label: names[k] }); }).join('') + '</div>';
    if (i === 0) {
      h += '<div class="armchips">' + ARM_CHIPS.map(function (c) {
        var x = rs[c[0]] || {}, hh = Body.heat(x.days);
        return '<button class="achip" data-region="' + c[0] + '"><i style="background:' + (hh.on ? hh.fill : 'var(--line)') + '"></i>' + c[1] + ' <b>' + Math.round(x.pct || 0) + '%</b></button>';
      }).join('') + '</div>';
    }
    h += '<div class="mapnav"><div class="seg2" role="tablist">' + BODY_SLIDES.map(function (n, k) {
      return '<button role="tab" aria-selected="' + (k === i) + '" class="' + (k === i ? 'on' : '') + '" data-act="body-go" data-v="' + k + '">' + n + '</button>';
    }).join('') + '</div>' + legendMini() + '</div></section>';
    return h;
  }
  function legendMini() {
    var stops = [0, 1, 2, 3, 4, 5, 6, 7].map(function (d) { return Body.heat(d).fill; });
    return '<div class="legend"><span>0d</span><i style="background:linear-gradient(90deg,' + stops.join(',') + ')"></i><span>7d+</span></div>';
  }
  function statsRow(o) {
    var c = Coach.buildCtx(o);
    return '<section class="stats"><div><div class="k">Week</div><div class="n">' + c.weekPct + '%</div></div><div><div class="k">Sessions</div><div class="n">' + c.sessionsWeek + '</div></div><div><div class="k">Sets left</div><div class="n">' + c.setsLeft + '</div></div></section>';
  }
  function greetBlock(o) {
    var c = Coach.buildCtx(o);
    var key = new Date().toDateString() + '|' + c.period + '|' + S.sessions.length + '|' + (S.current ? 1 : 0) + '|' + (S.settings.name || '');
    var g = S.greet;
    if (g.key !== key) {
      var pick = Coach.greeting(c, g.seen || [], Math.random);
      var seen = (g.seen || []).concat(pick.id ? [pick.id] : []).slice(-10);
      S.greet = g = { key: key, id: pick.id, head: pick.head, line: pick.line, seen: seen };
      save();
    }
    var now = new Date();
    return '<header class="hello"><div class="dateline"><span>' + esc(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })) + '</span><span>Week ' + isoWeek(now) + '</span></div>' +
      '<h1>' + esc(g.head) + '</h1><p class="psub">' + esc(g.line) + '</p></header>';
  }
  function goalsBlock(o) {
    var gs = goalsState();
    var sug = Coach.suggestGoals(o);
    var accepted = {};
    gs.list.forEach(function (g) { accepted[g.id] = true; });
    var offers = sug.goals.filter(function (g) { return !accepted[g.id] && gs.dismissed.indexOf(g.id) < 0; }).slice(0, 3);
    var h = '<section class="sec"><h2>Goals</h2>';
    if (!gs.list.length && !offers.length) h += '<p class="mute small">No goal needed. Nothing in your data calls for one.</p>';
    gs.list.forEach(function (g) {
      var pr = Coach.goalProgress(g, o);
      h += '<div class="goal' + (pr.done ? ' met' : '') + '">' + ring(pr.pct) + '<div class="gtxt"><div class="gt">' + esc(g.title) + '</div><div class="gs">' + esc(pr.done ? 'Done' : g.evidence) + '</div></div>' +
        '<div class="gv num">' + esc(pr.text) + '</div><button class="gx" data-act="goal-del" data-id="' + esc(g.id) + '" aria-label="Remove goal">×</button></div>';
    });
    offers.forEach(function (g) {
      h += '<div class="goal offer"><div class="gtxt"><div class="gt">' + esc(g.title) + '</div><div class="gs">' + esc(g.evidence) + '</div>' +
        '<div class="offer-btns"><button class="pill on" data-act="goal-add" data-id="' + esc(g.id) + '">Accept</button><button class="pill" data-act="goal-skip" data-id="' + esc(g.id) + '">Skip</button></div></div></div>';
    });
    sug.notes.forEach(function (n) { h += '<p class="mute small note-line">' + esc(n) + '</p>'; });
    return h + '</section>';
  }
  function vHome() {
    var o = coachOpts();
    var h = greetBlock(o);
    if (S.current) {
      var c = flat(S.current).reduce(function (a, e) { a.n += e.skipped ? 0 : e.sets.length; a.d += e.sets.filter(function (q) { return q.done; }).length; return a; }, { n: 0, d: 0 });
      h += '<button class="resume" data-go="#/session"><span><b>' + esc(S.current.type) + '</b> in progress</span><span class="num">' + c.d + ' / ' + c.n + ' sets ›</span></button>';
    }
    h += bodyCard(o);
    h += statsRow(o);
    h += goalsBlock(o);
    var standalone = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (!standalone && /iPhone|iPad/.test(navigator.userAgent) && !localStorage.getItem('liftlog.tip')) {
      h += '<div class="notice sec"><span>Install: Share, then Add to Home Screen.</span><button class="ghost" data-act="hide-tip">Hide</button></div>';
    }
    return h;
  }
  function regionSheet(id) {
    var o = coachOpts();
    var st = regionStates(o);
    var subs = st[id] && st[id].group ? st[id].group : [id];
    var title = st[id] ? st[id].label : id;
    var ws = E.weekStart(o.now).getTime();
    var h = '<h3>' + esc(title) + '</h3>';
    subs.forEach(function (m) {
      var x = st[m]; if (!x) return;
      var list;
      if (m === 'glutes') {
        list = Object.keys(x.credit || {}).map(function (k) { return esc(k) + ' (' + fmt(Math.round(x.credit[k] * 10) / 10) + ')'; }).join(', ');
      } else {
        var names = {};
        o.sessions.forEach(function (s) {
          if (!s.date || ts(s.date) < ws) return;
          (s.exercises || []).forEach(function (e) {
            if (e.muscle !== m) return;
            var n = e.sets.filter(function (q) { return q.done; }).length;
            if (n) names[e.name] = (names[e.name] || 0) + n;
          });
        });
        list = Object.keys(names).map(function (k) { return esc(k) + ' (' + names[k] + ')'; }).join(', ');
      }
      var last = x.lastDate ? esc(fmtDate(new Date(x.lastDate).toISOString())) + ', ' + esc(Coach.agoText(o.now.getTime() - x.lastDate)) : 'Not logged yet';
      h += '<div class="kv"><span>This week</span><b class="num">' + fmt(x.done) + ' / ' + x.target + ' sets' + (m === 'glutes' ? ' (rides with quads)' : '') + '</b></div>' +
        '<div class="kv"><span>Last trained</span><b>' + last + '</b></div>' +
        '<div class="kv"><span>Counted</span><b>' + (list || 'None yet') + '</b></div>';
      if (m === 'glutes') h += '<p class="mute small" style="margin-top:8px">Hinges and split squats count 1 set. Squats, hack squats, and leg press count half.</p>';
    });
    h += '<div class="row-btns"><button class="btn secondary slim" data-act="close-sheet">Close</button></div>';
    openSheet(h);
  }

  /* ---------- Progress ---------- */
  function vProgress() {
    var done = weekDoneNow(true);
    var byId = libById();
    var ids = Object.keys(byId).filter(function (id) { return exSeries(id).length >= 2; });
    if (!ui.chartEx || ids.indexOf(ui.chartEx) < 0) {
      ids.sort(function (a, b) { return exSeries(b).length - exSeries(a).length; });
      ui.chartEx = ids[0] || null;
    }
    var recent = S.sessions.filter(function (s) { return !s.seed; }).sort(function (a, b) { return ts(b.date) - ts(a.date); }).slice(0, 12);
    var h = pageHead('Progress');
    h += '<section class="sec"><h2>Estimated max</h2><div class="card chart">';
    if (ui.chartEx) {
      h += '<select data-act="chart-ex" aria-label="Exercise">' + ids.map(function (id) { return '<option value="' + id + '"' + (id === ui.chartEx ? ' selected' : '') + '>' + esc(byId[id].name) + '</option>'; }).join('') + '</select>' + chartSvg(exSeries(ui.chartEx));
    } else h += '<p class="mute small">Appears after two dated sessions of one exercise.</p>';
    h += '</div></section>';
    h += '<section class="sec"><h2>Sets this week</h2><div class="card pad">' + weekBars(done) + '</div></section>';
    h += restCard();
    h += '<section class="sec"><h2>Notes from your data</h2><ul class="facts">' + coachFacts().map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul></section>';
    h += '<section class="sec"><h2>Log</h2>';
    if (!recent.length) h += '<p class="mute">Your first session shows up here.</p>';
    else h += '<div class="hist">' + recent.map(function (s) {
      var sets = flat(s).reduce(function (a, e) { return a + e.sets.filter(function (x) { return x.done; }).length; }, 0);
      return '<button data-go="#/summary/' + s.id + '"><span><span class="t">' + esc(s.type) + '</span> <span class="mute small">' + esc(s.loc === 'garage' ? 'Garage' : 'Gym') + '</span></span><span class="mute num">' + esc(fmtDate(s.date)) + ' · ' + sets + ' sets</span></button>';
    }).join('') + '</div>';
    return h + '</section>';
  }

  /* ---------- Templates ---------- */
  function tplFromPlan(plan) {
    return {
      blocks: plan.blocks.map(function (b) {
        return { id: b.id, name: b.name, slots: b.items.map(function (it) { return { id: newId(), exId: it.ex.id, sets: it.sets, alts: [] }; }) };
      })
    };
  }
  function autoPlan(type, loc) {
    return E.planSession({
      template: D.SESSIONS[type], lib: lib(), location: loc || 'gym', settings: S.settings,
      muscleCfg: S.settings.muscleCfg, weekDone: {}, again: 'unsure',
      learned: S.learned, now: new Date(), timeCap: S.settings.timeCap,
      hasHist: function (id) { return histOf(id).length > 0; }
    });
  }
  function planFromTemplate(st, tpl) {
    var byId = libById(), total = 0;
    var hasHist = function (id) { return histOf(id).length > 0; };
    var blocks = tpl.blocks.map(function (b) {
      var items = b.slots.map(function (sl) {
        var ex = byId[sl.exId], subFrom = null;
        if (!ex || !E.isAvailable(ex, st.loc, S.settings)) {
          var alt = (sl.alts || []).map(function (id) { return byId[id]; }).filter(function (x) { return x && E.isAvailable(x, st.loc, S.settings); })[0];
          if (!alt && ex) alt = E.rankCands(E.availableList(lib(), ex.muscle, st.loc, S.settings, S.learned.unavail, new Date()), hasHist)[0];
          if (!alt) return null;
          subFrom = ex ? ex.name : null;
          ex = alt;
        }
        var n = sl.sets + ((st.adds || {})[sl.id] || 0);
        total += n;
        return { ex: ex, sets: n, slotId: sl.id, subFrom: subFrom };
      }).filter(Boolean);
      return { id: b.id, name: b.name, items: items };
    });
    return { blocks: blocks, totalSets: total, minutes: Math.round(total * 3.2), fromTemplate: true };
  }
  function shortfalls(st, plan) {
    var done = weekDoneNow(false), planned = {}, slot = {};
    plan.blocks.forEach(function (b) {
      b.items.forEach(function (it) {
        var m = it.ex.muscle;
        planned[m] = (planned[m] || 0) + it.sets - ((st.adds || {})[it.slotId] || 0);
        if (!slot[m]) slot[m] = it;
      });
    });
    var factor = st.again === 'yes' ? 2 : st.again === 'no' ? 1 : 1.5;
    var out = [];
    Object.keys(planned).forEach(function (m) {
      var cfg = S.settings.muscleCfg[m];
      if (!cfg) return;
      var need = Math.ceil(Math.max(0, cfg.target - (done[m] || 0)) / factor);
      var add = Math.min(3, need - planned[m]);
      if (add >= 1) out.push({ m: m, slotId: slot[m].slotId, name: slot[m].ex.name, add: add, have: (done[m] || 0) + planned[m], target: cfg.target });
    });
    out.sort(function (x, y) { return (x.have / x.target) - (y.have / y.target); });
    return out.slice(0, 3);
  }
  function vBuilder(type) {
    if (type) return vTemplate(type);
    var h = pageHead('Builder', 'Your structure. LiftLog fills in weights and reps.');
    h += '<div class="list">';
    TYPES.forEach(function (t) {
      var tpl = S.templates[t];
      var n = tpl ? tpl.blocks.reduce(function (a, b) { return a + b.slots.reduce(function (x, s) { return x + s.sets; }, 0); }, 0) : 0;
      var ex = tpl ? tpl.blocks.reduce(function (a, b) { return a + b.slots.length; }, 0) : 0;
      h += '<button class="row" data-go="#/builder/' + t + '"><span><b>' + t + '</b><span class="rs">' + (tpl ? ex + ' exercises · ' + n + ' sets' : 'Auto') + '</span></span><span class="tag' + (tpl ? ' own' : '') + '">' + (tpl ? 'Yours' : 'Auto') + '</span></button>';
    });
    return h + '</div>';
  }
  function slotLast(exId) {
    var hh = histOf(exId, null, true);
    if (!hh.length) return 'New';
    var s1 = hh[hh.length - 1].sets[0];
    return s1 ? fmt(s1.w) + ' × ' + s1.r : '';
  }
  function vTemplate(type) {
    if (TYPES.indexOf(type) < 0) return pageHead('Not found');
    var tpl = S.templates[type];
    var h = '<div class="top"><button class="back" data-go="#/builder">‹ Builder</button></div>' + pageHead(type);
    if (!tpl) {
      var plan = autoPlan(type, 'gym');
      h += '<p class="psub" style="margin-bottom:14px">LiftLog builds this from your weekly gaps. Make it yours to set the exercises, order, and sets.</p><div class="list">';
      plan.blocks.forEach(function (b) {
        h += '<div class="card pad"><h3>' + esc(b.name) + '</h3>' + b.items.map(function (it) { return '<div class="sl-ro"><span>' + esc(it.ex.name) + '</span><span class="num mute">' + it.sets + '</span></div>'; }).join('') + '</div>';
      });
      return h + '</div><div class="row-btns"><button class="btn" data-act="tpl-make" data-t="' + type + '">Make it mine</button></div>';
    }
    var byId = libById();
    h += '<div class="list">';
    tpl.blocks.forEach(function (b, bk) {
      h += '<div class="card tblk"><div class="tb-head"><button class="tb-name" data-act="blk-ren" data-t="' + type + '" data-bk="' + bk + '">' + esc(b.name) + '</button><span class="tb-tools">' +
        (bk > 0 ? '<button class="ib" data-act="blk-up" data-t="' + type + '" data-bk="' + bk + '" aria-label="Move block up">↑</button>' : '') +
        '<button class="ib" data-act="blk-del" data-t="' + type + '" data-bk="' + bk + '" aria-label="Delete block">×</button></span></div>';
      b.slots.forEach(function (sl, si) {
        var ex = byId[sl.exId];
        var key = 'data-t="' + type + '" data-bk="' + bk + '" data-sl="' + si + '"';
        h += '<div class="slot"><button class="sl-name" data-act="sl-swap" ' + key + '><span>' + esc(ex ? ex.name : sl.exId) + '</span><span class="sl-sub">' + esc(slotLast(sl.exId)) + (sl.alts && sl.alts.length ? ' · ' + sl.alts.length + ' saved' : '') + '</span></button>' +
          '<div class="step"><button class="ib" data-act="sl-dec" ' + key + ' aria-label="Fewer sets">−</button><span class="num">' + sl.sets + '</span><button class="ib" data-act="sl-inc" ' + key + ' aria-label="More sets">+</button></div>' +
          '<div class="sl-tools">' + (si > 0 ? '<button class="ib" data-act="sl-up" ' + key + ' aria-label="Move up">↑</button>' : '<span class="ib off"></span>') +
          '<button class="ib" data-act="sl-del" ' + key + ' aria-label="Remove">×</button></div></div>';
      });
      h += '<button class="addrow" data-act="sl-add" data-t="' + type + '" data-bk="' + bk + '">+ Exercise</button></div>';
    });
    h += '</div><div class="row-btns"><button class="btn secondary slim" data-act="blk-add" data-t="' + type + '">+ Block</button>' +
      '<button class="btn danger slim" data-act="tpl-reset" data-t="' + type + '">Back to auto</button></div>';
    return h;
  }
  function tplPicker(type, bk, si) {
    var tpl = S.templates[type], b = tpl.blocks[bk], sl = si >= 0 ? b.slots[si] : null;
    var byId = libById();
    var cur = sl ? byId[sl.exId] : null;
    var muscle = cur ? cur.muscle : (b.slots[0] && byId[b.slots[0].exId] ? byId[b.slots[0].exId].muscle : null);
    var used = {};
    b.slots.forEach(function (x) { used[x.exId] = true; });
    var hasHist = function (id) { return histOf(id).length > 0; };
    var key = 'data-t="' + type + '" data-bk="' + bk + '" data-sl="' + si + '"';
    var h = '<h3>' + (sl ? 'Swap ' + esc(cur ? cur.name : '') : 'Add exercise') + '</h3>';
    var alts = sl ? (sl.alts || []).filter(function (id) { return byId[id] && id !== sl.exId; }) : [];
    if (alts.length) {
      h += '<p class="opt-h">Used in this slot</p>' + alts.map(function (id) { return '<button class="opt" data-act="tpl-pick" data-id="' + esc(id) + '" ' + key + '><span>' + esc(byId[id].name) + '</span><span class="sm">' + esc(slotLast(id)) + '</span></button>'; }).join('');
    }
    var pool = ui.pickAll || !muscle ? lib() : lib().filter(function (e) { return e.muscle === muscle; });
    pool = E.rankCands(pool.filter(function (e) { return !used[e.id] && alts.indexOf(e.id) < 0; }), hasHist);
    if (ui.pickAll) pool.sort(function (a, b2) { return (D.MUSCLE_LABEL[a.muscle] || '').localeCompare(D.MUSCLE_LABEL[b2.muscle] || ''); });
    h += '<p class="opt-h">' + (ui.pickAll || !muscle ? 'All exercises' : esc(D.MUSCLE_LABEL[muscle])) + '</p>';
    h += pool.map(function (e) { return '<button class="opt" data-act="tpl-pick" data-id="' + esc(e.id) + '" ' + key + '><span>' + esc(e.name) + '</span><span class="sm">' + (ui.pickAll ? esc(D.MUSCLE_LABEL[e.muscle] || '') + ' · ' : '') + esc(slotLast(e.id)) + '</span></button>'; }).join('');
    if (muscle) h += '<button class="opt" data-act="tpl-all" ' + key + '><span>' + (ui.pickAll ? 'Only ' + esc(D.MUSCLE_LABEL[muscle].toLowerCase()) : 'Show all muscles') + '</span></button>';
    h += '<div class="row-btns"><button class="btn secondary slim" data-act="close-sheet">Cancel</button></div>';
    openSheet(h);
  }
  function saveSessionToTemplate() {
    var cur = S.current, old = S.templates[cur.type], oldSlots = {};
    if (old) old.blocks.forEach(function (b) { b.slots.forEach(function (sl) { oldSlots[sl.id] = sl; }); });
    S.templates[cur.type] = {
      blocks: cur.blocks.map(function (b) {
        return {
          id: b.id, name: b.name, slots: b.exercises.filter(function (e) { return !e.skipped; }).map(function (e) {
            var sl = e.slotId && oldSlots[e.slotId];
            var alts = sl && sl.alts ? sl.alts.slice() : [];
            [sl && sl.exId, e.origExId].forEach(function (id) { if (id && id !== e.exId && alts.indexOf(id) < 0) alts.unshift(id); });
            alts = alts.filter(function (id) { return id !== e.exId; }).slice(0, 5);
            return { id: e.slotId || newId(), exId: e.exId, sets: Math.max(1, e.sets.filter(function (q) { return !q.extra; }).length), alts: alts };
          })
        };
      }).filter(function (b) { return b.slots.length; })
    };
    save();
    toast('Saved to ' + cur.type + ' template.');
  }
  function tplAction(a, el) {
    var type = el.dataset.t, bk = Number(el.dataset.bk), si = Number(el.dataset.sl);
    var tpl = S.templates[type];
    var b = tpl && tpl.blocks[bk], sl = b && b.slots[si];
    switch (a) {
      case 'tpl-make': S.templates[type] = tplFromPlan(autoPlan(type, 'gym')); break;
      case 'tpl-reset':
        if (!window.confirm('Go back to auto for ' + type + '? Your exercise history stays.')) return;
        delete S.templates[type]; break;
      case 'sl-inc': sl.sets = Math.min(8, sl.sets + 1); break;
      case 'sl-dec': sl.sets = Math.max(1, sl.sets - 1); break;
      case 'sl-up': if (si > 0) { b.slots.splice(si - 1, 0, b.slots.splice(si, 1)[0]); } break;
      case 'sl-del': b.slots.splice(si, 1); break;
      case 'blk-up': if (bk > 0) tpl.blocks.splice(bk - 1, 0, tpl.blocks.splice(bk, 1)[0]); break;
      case 'blk-del':
        if (b.slots.length && !window.confirm('Delete ' + b.name + ' and its exercises?')) return;
        tpl.blocks.splice(bk, 1); break;
      case 'blk-add': tpl.blocks.push({ id: newId(), name: 'New block', slots: [] }); break;
      case 'blk-ren': {
        var nm = window.prompt('Block name', b.name);
        if (nm && nm.trim()) b.name = nm.trim().slice(0, 30);
        break;
      }
      case 'sl-swap': ui.pickAll = false; return tplPicker(type, bk, si);
      case 'sl-add': ui.pickAll = false; return tplPicker(type, bk, -1);
      case 'tpl-all': ui.pickAll = !ui.pickAll; return tplPicker(type, bk, si);
      case 'tpl-pick': {
        var id = el.dataset.id;
        if (si >= 0 && sl) {
          var alts = (sl.alts || []).filter(function (x) { return x !== id; });
          if (alts.indexOf(sl.exId) < 0) alts.unshift(sl.exId);
          sl.alts = alts.slice(0, 5);
          sl.exId = id;
        } else b.slots.push({ id: newId(), exId: id, sets: 3, alts: [] });
        closeSheet();
        break;
      }
    }
    save(); render();
  }

  function vStart() {
    if (S.current) {
      var c = flat(S.current).reduce(function (a, e) { a.n += e.skipped ? 0 : e.sets.length; a.d += e.sets.filter(function (q) { return q.done; }).length; return a; }, { n: 0, d: 0 });
      return pageHead('Start') + '<div class="card pad"><h3>' + esc(S.current.type) + ' in progress</h3><p class="mute small num" style="margin-top:4px">' + c.d + ' of ' + c.n + ' sets · started ' + esc(fmtTime(S.current.date)) + '</p></div>' +
        '<div class="row-btns"><button class="btn" data-go="#/session">Resume</button></div>';
    }
    if (!ui.start) ui.start = { type: suggestType(), loc: defaultLoc(), fed: defaultFed(), again: 'unsure', adds: {} };
    var st = ui.start;
    st.adds = st.adds || {};
    var now = new Date();
    var plan = planFor(st);
    var h = pageHead('Start', esc(now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })) + ' · ' + esc(BUCKET[E.timeBucket(now)]));
    h += '<div class="seg types" role="radiogroup" aria-label="Session">' + TYPES.map(function (t) { return '<button class="' + (st.type === t ? 'on' : '') + '" data-act="st-type" data-v="' + t + '">' + t + '</button>'; }).join('') + '</div>';
    h += '<div class="fields">';
    h += '<div class="field"><span>Where</span><div class="seg sm"><button class="' + (st.loc === 'gym' ? 'on' : '') + '" data-act="st-loc" data-v="gym">Gym</button><button class="' + (st.loc === 'garage' ? 'on' : '') + '" data-act="st-loc" data-v="garage">Garage</button></div></div>';
    h += '<div class="field"><span>Food</span><div class="seg sm">' + Object.keys(FED).map(function (k) { return '<button class="' + (st.fed === k ? 'on' : '') + '" data-act="st-fed" data-v="' + k + '">' + FED[k] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="field"><span>Again this week?</span><div class="seg sm">' + Object.keys(AGAIN).map(function (k) { return '<button class="' + (st.again === k ? 'on' : '') + '" data-act="st-again" data-v="' + k + '">' + AGAIN[k] + '</button>'; }).join('') + '</div></div>';
    h += '</div>';
    h += '<section class="sec"><div class="sec-h"><h2>Plan</h2><span class="mute small num">' + plan.totalSets + ' sets · ~' + plan.minutes + ' min</span></div>';
    h += '<p class="mute small" style="margin-bottom:10px">' + (plan.fromTemplate ? 'Your ' + esc(st.type) + ' template. ' : 'Auto plan. ') + '<button class="link" data-go="#/builder/' + st.type + '">Edit in Builder</button></p><div class="list">';
    plan.blocks.forEach(function (b) {
      h += '<div class="card pad"><h3>' + esc(b.name) + '</h3>';
      if (!b.items.length) h += '<p class="mute small">Nothing available here.</p>';
      b.items.forEach(function (it) {
        h += '<div class="sl-ro"><span>' + esc(it.ex.name) + (it.subFrom ? '<span class="mute small"> · for ' + esc(it.subFrom) + '</span>' : '') + '</span><span class="num mute">' + it.sets + '</span></div>';
      });
      h += '</div>';
    });
    h += '</div></section>';
    if (plan.fromTemplate) {
      var sf = shortfalls(st, plan);
      if (sf.length) {
        h += '<section class="sec"><h2>Short this week</h2><div class="list">';
        sf.forEach(function (x) {
          var on = !!st.adds[x.slotId];
          h += '<div class="card sugg"><div><b>' + esc(D.MUSCLE_LABEL[x.m]) + '</b><div class="mute small num">' + x.have + ' of ' + x.target + ' after today</div></div>' +
            '<button class="pill' + (on ? ' on' : '') + '" data-act="st-add" data-id="' + esc(x.slotId) + '" data-v="' + x.add + '">' + (on ? 'Added' : '+' + x.add + ' · ' + esc(x.name.replace(/\s*\(.*\)/, ''))) + '</button></div>';
        });
        h += '</div></section>';
      }
    }
    h += '<div class="row-btns"><button class="btn" data-act="gen">Start workout</button></div>';
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
    h += '<button class="btn secondary slim" data-act="save-tpl">Save structure to ' + esc(s.type) + ' template</button>';
    h += '<button class="btn danger slim" data-act="discard">Discard session</button></div>';
    return h;
  }

  function setRow(bi, ei, k) {
    var ex = S.current.blocks[bi].exercises[ei], s = ex.sets[k];
    var key = 'data-b="' + bi + '" data-e="' + ei + '" data-s="' + k + '"';
    if (s.done) {
      return '<div class="set is-done"><span class="sno">' + (k + 1) + '</span><span class="val">' + esc(valText(ex, s)) + '</span><span class="sub">' + (s.extra ? 'extra' + (s.rpe ? ' · ' : '') : '') + (s.rpe ? 'RPE ' + fmt(s.rpe) : '') + (s.flag ? (s.rpe ? ' · ' : '') + 'momentum' : '') + '</span><button class="ghost" data-act="undo" ' + key + '>Edit</button></div>';
    }
    var t = E.setTarget(ex.plan, ex.sets, k);
    var tt = targetText(ex, k);
    var ph = t ? (t.r != null ? t.r : t.rHi) : '';
    var h = '<div class="set"><div class="set-top"><span class="sno">' + (k + 1) + '</span>' + (s.extra ? '<span class="xtag">extra</span>' : '') +
      (tt ? '<span class="tgt">' + esc(tt) + '</span>' : '<span class="tgt none">' + (k === 0 ? 'Pick a weight, then log the set' : 'Targets appear after set 1') + '</span>') + '</div>';
    h += '<div class="set-in"><label><input data-f="w" ' + key + ' inputmode="decimal" value="' + esc(s.w) + '" aria-label="Weight in pounds"><span class="u">lb</span></label>' +
      '<label><input data-f="r" ' + key + ' inputmode="numeric" value="' + esc(s.r) + '" placeholder="' + esc(ph) + '" aria-label="Reps"><span class="u">reps</span></label>' +
      '<button class="ok" data-act="done" ' + key + ' aria-label="Log set">✓</button></div>';
    h += '<div class="chips"><span class="lbl">RPE</span>' + [5, 6, 7, 8, 9, 10].map(function (v) { return '<button class="chip' + (s.rpe === v ? ' on' : '') + '" data-act="rpe" data-v="' + v + '" ' + key + '>' + v + '</button>'; }).join('') +
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
      if (ex.fatN > 0 && ex.fatMult < 1 && !ex.sets.some(function (q) { return q.done; })) h += '<p class="ex-fat">−' + Math.round((1 - ex.fatMult) * 100) + '% · ' + fmt(ex.fatN) + ' earlier ' + esc((D.MUSCLE_LABEL[ex.muscle] || ex.muscle).toLowerCase()) + ' sets</p>';
      if (ex.plan.note) h += '<p class="ex-note">' + esc(ex.plan.note) + (ex.plan.capped ? ' Dumbbells top out at 80 lb here.' : '') + '</p>';
      if (ex.swappedFrom) h += '<p class="sub">Swapped from ' + esc(ex.swappedFrom) + '.</p>';
      ex.sets.forEach(function (s, k) { h += setRow(bi, ei, k); });
      h += '<div class="tools"><button class="tool" data-act="add-set" data-b="' + bi + '" data-e="' + ei + '">Add set</button><button class="tool' + (ex.note ? ' has' : '') + '" data-act="note" data-b="' + bi + '" data-e="' + ei + '">' + (ex.note ? 'Note saved' : 'Note') + '</button>' +
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
    h += blockCoverage(b);
    h += '<div class="row-btns"><button class="btn secondary slim" data-act="add-ex" data-b="' + bi + '">Add exercise</button></div>';
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
    var cur = S.current;
    if (k === 0 || !ex.sets.some(function (q, j) { return j !== k && q.done; })) {
      if (cur.lastExEnd) { s.gapPrev = Math.round((ts(s.at) - ts(cur.lastExEnd)) / 1000); cur.lastExEnd = null; }
    }
    if (exDone(ex)) { stopRest(); cur.lastExEnd = s.at; }
    save();
    if (!exDone(ex)) startRest(ex, s);
    if (exDone(ex)) {
      var b = S.current.blocks[bi];
      var nx = b.exercises.findIndex(function (e) { return !exDone(e); });
      ui.openEx = nx < 0 ? null : bi + '-' + nx;
      render();
      scrollToOpen();
    } else rerenderEx(bi, ei);
  }

  function blockSubs(b) {
    var tpl = D.SESSIONS[S.current.type];
    var blk = tpl && tpl.blocks.filter(function (x) { return x.id === b.id; })[0];
    var subs = blk ? blk.muscles.slice() : [];
    b.exercises.forEach(function (e) { if (subs.indexOf(e.muscle) < 0) subs.push(e.muscle); });
    return subs;
  }
  function blockCoverage(b) {
    var done = weekDoneNow(true);
    var line = blockSubs(b).map(function (m) {
      var cfg = S.settings.muscleCfg[m];
      return esc(D.MUSCLE_LABEL[m] || m) + ' ' + (done[m] || 0) + (cfg ? ' of ' + cfg.target : '');
    }).join(' · ');
    return '<p class="mute small" style="margin-top:12px">Sets this week: ' + line + '.</p>';
  }
  var FILTERS = { all: 'All', free: 'Free weights', cable: 'Cable', machine: 'Machine' };
  function passFilter(e, f) {
    var t = e.equip || [];
    if (f === 'free') return t.indexOf('barbell') >= 0 || t.indexOf('dumbbell') >= 0 || t.indexOf('any') >= 0 || t.indexOf('rack') >= 0;
    if (f === 'cable') return t.indexOf('cable') >= 0;
    if (f === 'machine') return t.indexOf('machine') >= 0 || t.indexOf('smith') >= 0;
    return true;
  }
  function addSheet(bi) {
    var b = S.current.blocks[bi];
    var used = {};
    S.current.blocks.forEach(function (bb) { bb.exercises.forEach(function (e) { used[e.exId] = true; }); });
    var f = ui.moreFilter || 'all';
    var done = weekDoneNow(true);
    var h = '<h3>Add exercise</h3><div class="chips" style="margin-bottom:10px">' + Object.keys(FILTERS).map(function (k) {
      return '<button class="chip' + (f === k ? ' on' : '') + '" data-act="more-filter" data-b="' + bi + '" data-v="' + k + '">' + FILTERS[k] + '</button>';
    }).join('') + '</div>';
    blockSubs(b).forEach(function (m) {
      var cfg = S.settings.muscleCfg[m];
      var cands = E.rankCands(E.availableList(lib(), m, S.current.loc, S.settings, S.learned.unavail, new Date()).filter(function (c) { return !used[c.id] && passFilter(c, f); }), function (id) { return histOf(id).length > 0; });
      h += '<p class="mute small" style="margin:12px 0 4px"><b>' + esc(D.MUSCLE_LABEL[m] || m) + '</b>' + (cfg ? ' · ' + (done[m] || 0) + ' of ' + cfg.target + ' sets this week' : '') + '</p>';
      if (!cands.length) h += '<p class="mute small">No options with this filter at this location.</p>';
      cands.forEach(function (c) {
        var hist = histOf(c.id), last = hist.length ? hist[hist.length - 1].sets : null;
        var top = last && last[0] ? fmt(last[0].w) + ' × ' + last[0].r : null;
        h += '<button class="opt" data-act="add-pick" data-b="' + bi + '" data-id="' + esc(c.id) + '"><span>' + esc(c.name) + '</span><span class="sm">' + (top ? 'Last set 1: ' + esc(top) : 'New') + '</span></button>';
      });
    });
    h += '<div class="row-btns"><button class="btn secondary slim" data-act="close-sheet">Cancel</button></div>';
    openSheet(h);
  }

  function swapSheet(bi, ei) {
    var b = S.current.blocks[bi], ex = b.exercises[ei];
    var used = {};
    S.current.blocks.forEach(function (bb) { bb.exercises.forEach(function (e) { used[e.exId] = true; }); });
    var cands = E.rankCands(E.availableList(lib(), ex.muscle, S.current.loc, S.settings, S.learned.unavail, new Date()).filter(function (c) { return !used[c.id]; }), function (id) { return histOf(id).length > 0; });
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
    ne.slotId = old.slotId; ne.origExId = old.origExId || old.exId;
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

    var h = topBar(s.type + ' summary', '#/progress', 'Progress');
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
    var h = pageHead('Settings');
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
      '<div class="cfg" style="grid-template-columns:1fr 140px"><span>Your name</span><input type="text" data-name="1" value="' + esc(S.settings.name || '') + '" aria-label="Your name" maxlength="20"></div>' +
      '<div class="toggle-row"><span>Rest timer</span><button class="chip' + (S.settings.restTimer ? ' on' : '') + '" data-act="rest-on">' + (S.settings.restTimer ? 'On' : 'Off') + '</button></div>' +
      '<div class="toggle-row"><span>Timer sound</span><button class="chip' + (S.settings.restSound ? ' on' : '') + '" data-act="rest-snd">' + (S.settings.restSound ? 'On' : 'Off') + '</button></div>' +
      '<div class="toggle-row"><span>Garage has a bench</span><button class="chip' + (S.settings.garageBench ? ' on' : '') + '" data-act="bench">' + (S.settings.garageBench ? 'Yes' : 'No') + '</button></div></div></div>';
    h += '<div class="section"><h2>Backup</h2><p class="mute small" style="margin-bottom:10px">Export after each week. Your data lives on this phone only.</p><div class="row-btns">' +
      '<button class="btn secondary" data-act="export">Export data</button><button class="btn secondary" data-act="import">Import data</button>' +
      '<button class="btn danger slim" data-act="reset">Reset all data</button></div></div>';
    h += '<p class="mute small" style="margin-top:24px">LiftLog version ' + APP_VERSION + ', build ' + APP_BUILD + '.</p>';
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
    var rg = ev.target.closest('[data-region]');
    if (rg && !ev.target.closest('[data-act]')) return regionSheet(rg.dataset.region);
    var el = ev.target.closest('[data-act]');
    if (!el) { if (ev.target === $sheet) closeSheet(); return; }
    var a = el.dataset.act, bi = Number(el.dataset.b), ei = Number(el.dataset.e), k = Number(el.dataset.s);
    var ex = S.current && !isNaN(bi) && S.current.blocks[bi] ? S.current.blocks[bi].exercises[ei] : null;
    switch (a) {
      case 'body-side': ui.bodySide = el.dataset.v; render(); break;
      case 'body-go': ui.bodySlide = Number(el.dataset.v); render(); break;
      case 'body-prev': ui.bodySlide = bodySlide() + 2; render(); break;
      case 'body-next': ui.bodySlide = bodySlide() + 1; render(); break;
      case 'goal-add': {
        var gs = goalsState(), sg = Coach.suggestGoals(coachOpts()).goals.filter(function (g) { return g.id === el.dataset.id; })[0];
        if (sg) { gs.list.push(sg); save(); render(); }
        break;
      }
      case 'goal-skip': goalsState().dismissed.push(el.dataset.id); save(); render(); break;
      case 'goal-del': { var g2 = goalsState(); g2.list = g2.list.filter(function (g) { return g.id !== el.dataset.id; }); g2.dismissed.push(el.dataset.id); save(); render(); break; }
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
          (ei > 0 ? '<button class="opt" data-act="ex-up" data-b="' + bi + '" data-e="' + ei + '"><span>Move up</span></button>' : '') +
          (ei < S.current.blocks[bi].exercises.length - 1 ? '<button class="opt" data-act="ex-down" data-b="' + bi + '" data-e="' + ei + '"><span>Move down</span></button>' : '') +
          '<button class="opt" data-act="add-set" data-b="' + bi + '" data-e="' + ei + '"><span>Add a set</span></button>' +
          '<button class="opt" data-act="rm-set" data-b="' + bi + '" data-e="' + ei + '"><span>Remove last set</span></button>' +
          '<button class="opt" data-act="skip" data-b="' + bi + '" data-e="' + ei + '"><span>' + (ex.skipped ? 'Restore exercise' : 'Skip exercise') + '</span></button>' +
          '<div class="row-btns"><button class="btn secondary slim" data-act="close-sheet">Close</button></div>');
        break;
      case 'swap': swapSheet(bi, ei); break;
      case 'ex-up': case 'ex-down': {
        var arr = S.current.blocks[bi].exercises, to = a === 'ex-up' ? ei - 1 : ei + 1;
        if (to >= 0 && to < arr.length) { arr.splice(to, 0, arr.splice(ei, 1)[0]); ui.openEx = bi + '-' + to; save(); }
        closeSheet(); render(); break;
      }
      case 'save-tpl': saveSessionToTemplate(); render(); break;
      case 'st-add': { var sid2 = el.dataset.id; if (ui.start.adds[sid2]) delete ui.start.adds[sid2]; else ui.start.adds[sid2] = Number(el.dataset.v); render(); break; }
      case 'tpl-make': case 'tpl-reset': case 'sl-inc': case 'sl-dec': case 'sl-up': case 'sl-del': case 'blk-up': case 'blk-del': case 'blk-add': case 'blk-ren': case 'sl-swap': case 'sl-add': case 'tpl-all': case 'tpl-pick':
        tplAction(a, el); break;
      case 'add-ex': addSheet(bi); break;
      case 'more-filter': ui.moreFilter = el.dataset.v; addSheet(bi); break;
      case 'add-pick': {
        var nb = S.current.blocks[bi];
        nb.exercises.push(makeEx(libById()[el.dataset.id], 3, S.current.ctxKey, S.current.loc, new Date()));
        ui.openEx = bi + '-' + (nb.exercises.length - 1);
        save(); closeSheet(); render(); scrollToOpen();
        break;
      }
      case 'swap-pick': doSwap(bi, ei, libById()[el.dataset.id]); break;
      case 'custom-ex': {
        var name = window.prompt('Exercise name');
        if (!name || !name.trim()) break;
        var c = { id: 'custom-' + Date.now(), name: name.trim(), muscle: ex.muscle, equip: ['any'], kind: 'iso', pattern: null, rel: 1, reps: [8, 12], inc: 5, v: 'custom-' + Date.now() };
        S.custom.push(c);
        doSwap(bi, ei, c);
        break;
      }
      case 'add-set': ex.sets.push({ w: ex.sets.length ? ex.sets[ex.sets.length - 1].w : '', r: '', rpe: null, flag: false, done: false, extra: true }); save(); closeSheet(); ui.openEx = bi + '-' + ei; render(); break;
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
        if (window.confirm('Discard this session? Logged sets will be lost.')) { S.current = null; stopRest(); save(); go('#/home'); }
        break;
      case 'rest-on': S.settings.restTimer = !S.settings.restTimer; if (!S.settings.restTimer) stopRest(); save(); render(); break;
      case 'rest-snd': S.settings.restSound = !S.settings.restSound; save(); render(); if (S.settings.restSound) { unlockAudio(); beep(); } break;
      case 'rest-add': if (rest) { rest.end += 15000; rest.total += 15; rest.fired = false; rest.fired2 = false; if (rest.setRef) rest.setRef.rp = rest.total; tickRest(); } break;
      case 'rest-sub': if (rest) { rest.end -= 15000; rest.total = Math.max(15, rest.total - 15); if (rest.setRef) rest.setRef.rp = rest.total; tickRest(); } break;
      case 'rest-skip': stopRest(); break;
      case 'rest-start': {
        if (!rest) break;
        var rsec = Math.max(0, Math.round((Date.now() - rest.started) / 1000));
        if (rest.setRef) rest.setRef.ra = rsec;
        stopRest();
        toast('Rested ' + Math.floor(rsec / 60) + ':' + (rsec % 60 < 10 ? '0' : '') + (rsec % 60) + '. Go.');
        break;
      }
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
    } else if (t.dataset.name) {
      S.settings.name = t.value.trim().slice(0, 20) || 'Jesse'; S.greet.key = ''; saveSoon();
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

  var swipeX = null;
  document.addEventListener('touchstart', function (e) { swipeX = e.target.closest && e.target.closest('.body-wrap') ? e.touches[0].clientX : null; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (swipeX == null) return;
    var dx = e.changedTouches[0].clientX - swipeX; swipeX = null;
    if (Math.abs(dx) > 50) { ui.bodySlide = bodySlide() + 1; render(); }
  }, { passive: true });
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  window.addEventListener('hashchange', render);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) save();
    else { if (rest) { keepAwake(true); tickRest(); } }
  });

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }

  save();
  render();
  showSplash();
  window.__liftlog = { get state() { return S; }, render: render };
})();
