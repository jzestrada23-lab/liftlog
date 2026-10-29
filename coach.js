(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.Coach = factory(root.Engine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  var DAY = 86400000;
  var ARM_FRONT = ['bi_long', 'bi_short', 'forearms'];
  var ARM_BACK = ['tri_long', 'tri_lat', 'forearms'];
  var LEGS = ['quads', 'hamstrings', 'adductors'];

  function ts(d) { return d ? new Date(d).getTime() : null; }
  function doneSets(e) { return (e.sets || []).filter(function (s) { return s.done; }); }
  function fmt(n) { n = Number(n); return n % 1 ? n.toFixed(1).replace(/\.0$/, '') : String(n); }
  function round1(n) { return Math.round(n * 10) / 10; }

  function weekStats(sessions, cfg, now) {
    var ws = E.weekStart(now).getTime();
    var lw = ws - 7 * DAY;
    var out = { done: {}, last: {}, lastDate: {}, lastType: {}, lastWeek: {}, sessions: 0, sessionsLast: 0 };
    Object.keys(cfg).forEach(function (m) { out.done[m] = 0; out.lastWeek[m] = 0; });
    sessions.forEach(function (s) {
      var t = ts(s.date);
      if (t == null) return;
      if (t >= ws) out.sessions += 1;
      else if (t >= lw) out.sessionsLast += 1;
      (s.exercises || []).forEach(function (e) {
        var n = doneSets(e).length;
        if (!n || !(e.muscle in cfg)) return;
        if (t >= ws) out.done[e.muscle] += n;
        else if (t >= lw) out.lastWeek[e.muscle] += n;
        if (out.lastDate[e.muscle] == null || t > out.lastDate[e.muscle]) { out.lastDate[e.muscle] = t; out.lastType[e.muscle] = s.type; }
      });
    });
    return out;
  }

  function regionState(sessions, cfg, labels, now) {
    var w = weekStats(sessions, cfg, now);
    var n = now.getTime ? now.getTime() : new Date(now).getTime();
    var st = {};
    Object.keys(cfg).forEach(function (m) {
      var days = w.lastDate[m] != null ? Math.max(0, (n - w.lastDate[m]) / DAY) : null;
      var target = cfg[m].target;
      st[m] = { pct: Math.min(100, target ? 100 * w.done[m] / target : 0), days: days, done: w.done[m], target: target, label: labels[m] || m, lastDate: w.lastDate[m] || null, lastType: w.lastType[m] || null };
    });
    var arm = function (id, subs, label) {
      var ds = subs.map(function (k) { return st[k] && st[k].days; }).filter(function (d) { return d != null; });
      st[id] = { pct: null, days: ds.length ? Math.min.apply(null, ds) : null, label: label, group: subs };
    };
    arm('arm_front', ARM_FRONT, 'Front of arm');
    arm('arm_back', ARM_BACK, 'Back of arm');
    return st;
  }

  function agoText(ms) {
    var h = ms / 3600000;
    if (h < 1) return 'less than an hour ago';
    if (h < 23.5) return Math.round(h) + (Math.round(h) === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(h / 24);
    if (d === 1) return 'yesterday';
    return d + ' days ago';
  }

  function bestForSession(e) { return E.bestE(doneSets(e)); }

  function exSeries(sessions, exId) {
    var pts = [];
    sessions.forEach(function (s) {
      var t = ts(s.date);
      if (t == null) return;
      (s.exercises || []).forEach(function (e) {
        if (e.exId !== exId || e.skipped) return;
        var b = bestForSession(e);
        if (b) pts.push({ t: t, E: b });
      });
    });
    pts.sort(function (a, b) { return a.t - b.t; });
    return pts;
  }

  function buildCtx(o) {
    var now = o.now, nowMs = now.getTime();
    var w = weekStats(o.sessions, o.cfg, now);
    var subs = Object.keys(o.cfg);
    var setsTarget = 0, setsDone = 0, atFull = 0, under = [];
    subs.forEach(function (m) {
      var t = o.cfg[m].target, d = Math.min(w.done[m], t);
      setsTarget += t; setsDone += d;
      if (w.done[m] >= t) atFull += 1;
      else under.push({ m: m, label: o.labels[m], done: w.done[m], target: t, pct: w.done[m] / t, last: w.lastWeek[m] });
    });
    under.sort(function (a, b) { return a.pct - b.pct || a.m.localeCompare(b.m); });
    var real = o.sessions.filter(function (s) { return s.date && !s.seed; }).sort(function (a, b) { return ts(b.date) - ts(a.date); });
    var lastAny = o.sessions.filter(function (s) { return s.date && s.type !== 'Extra'; }).sort(function (a, b) { return ts(b.date) - ts(a.date); })[0];
    var neglect = null;
    var legDays = LEGS.map(function (m) { return w.lastDate[m] != null ? (nowMs - w.lastDate[m]) / DAY : null; });
    if (legDays.every(function (d) { return d != null && d >= 14; })) {
      neglect = { label: 'Legs', days: Math.round(Math.min.apply(null, legDays)), date: new Date(Math.max.apply(null, LEGS.map(function (m) { return w.lastDate[m]; }))) };
    } else {
      subs.forEach(function (m) {
        if (LEGS.indexOf(m) >= 0 || w.lastDate[m] == null) return;
        var d = (nowMs - w.lastDate[m]) / DAY;
        if (d >= 14 && (!neglect || d > neglect.days)) neglect = { label: o.labels[m], days: Math.round(d), date: new Date(w.lastDate[m]) };
      });
    }
    var pr = null;
    if (real.length) {
      var latest = real[0];
      if ((nowMs - ts(latest.date)) / DAY <= 7) {
        (latest.exercises || []).forEach(function (e) {
          var pts = exSeries(o.sessions, e.exId);
          if (pts.length < 2) return;
          var last = pts[pts.length - 1], prevBest = Math.max.apply(null, pts.slice(0, -1).map(function (p) { return p.E; }));
          if (Math.abs(last.t - ts(latest.date)) < 1000 || true) {
            var gain = last.E / prevBest - 1;
            if (last.E >= prevBest * 1.01 && Math.abs(last.t - ts(latest.date)) < 36 * 3600000 && (!pr || gain > pr.gain)) {
              pr = { name: (o.exName && o.exName(e.exId)) || e.name || e.exId, gain: gain, from: Math.round(prevBest), to: Math.round(last.E) };
            }
          }
        });
      }
    }
    var recent = [];
    subs.forEach(function (m) { if (w.lastDate[m] != null && (nowMs - w.lastDate[m]) < 30 * 3600000) recent.push(o.labels[m]); });
    var h = now.getHours();
    var ws = E.weekStart(now).getTime();
    var lastWeekLow = null;
    subs.forEach(function (m) {
      var p = w.lastWeek[m] / o.cfg[m].target;
      if (w.sessionsLast && (!lastWeekLow || p < lastWeekLow.p)) lastWeekLow = { label: o.labels[m], done: w.lastWeek[m], target: o.cfg[m].target, p: p };
    });
    return {
      name: o.name || 'Jesse', period: h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night',
      dowName: now.toLocaleDateString('en-US', { weekday: 'long' }), dow: now.getDay(),
      weekPct: setsTarget ? Math.round(100 * setsDone / setsTarget) : 0, setsDone: setsDone, setsTarget: setsTarget, setsLeft: setsTarget - setsDone,
      sessionsWeek: w.sessions, sessionsLast: w.sessionsLast,
      lastType: lastAny ? lastAny.type : null, lastMs: lastAny ? nowMs - ts(lastAny.date) : null, lastAgo: lastAny ? agoText(nowMs - ts(lastAny.date)) : null,
      nextType: o.nextType, neglect: neglect, under: under, atFull: atFull, subCount: subs.length, pr: pr, recent: recent, lastWeekLow: lastWeekLow,
      daysToWeekEnd: Math.max(0, 7 - Math.floor((nowMs - ws) / DAY))
    };
  }

  function L(id, cat, when, text) { return { id: id, cat: cat, when: when, text: text }; }
  function list(arr) {
    var n = arr.length;
    if (n === 1) return arr[0];
    if (n === 2) return arr[0] + ' and ' + arr[1];
    return arr.slice(0, -1).join(', ') + ', and ' + arr[n - 1];
  }
  function low(c, k) { return c.under.slice(0, k).map(function (u) { return u.label.toLowerCase(); }); }

  var LINES = [
    L('nw1', 'new', function (c) { return c.sessionsWeek === 0 && c.nextType; }, function (c) { return 'Nothing logged yet this week. ' + c.nextType + ' is the next session on the rotation.'; }),
    L('nw2', 'new', function (c) { return c.sessionsWeek === 0; }, function (c) { return c.setsTarget + ' target sets are open this week across ' + c.subCount + ' sub-muscles. Start filling them.'; }),
    L('nw3', 'new', function (c) { return c.sessionsWeek === 0 && c.lastType; }, function (c) { return 'Last session was ' + c.lastType + ', ' + c.lastAgo + '. The week is at zero.'; }),
    L('nw4', 'new', function (c) { return c.sessionsWeek === 0 && c.lastWeekLow; }, function (c) { return 'Last week your lowest was ' + c.lastWeekLow.label.toLowerCase() + ' at ' + c.lastWeekLow.done + ' of ' + c.lastWeekLow.target + ' sets. Fix that first.'; }),
    L('nw5', 'new', function (c) { return c.sessionsWeek === 0 && c.under.length > 2; }, function (c) { return 'Every bar is empty. ' + list(low(c, 3)) + ' are the first three to fill.'; }),
    L('nw6', 'new', function (c) { return c.sessionsWeek === 0 && c.dow >= 3; }, function (c) { return c.dowName + ' and no sessions yet. ' + c.daysToWeekEnd + ' days left to log ' + c.setsTarget + ' sets.'; }),
    L('nw7', 'new', function (c) { return c.sessionsWeek === 0 && c.sessionsLast > 0; }, function (c) { return 'You trained ' + c.sessionsLast + (c.sessionsLast === 1 ? ' time' : ' times') + ' last week. Beat it.'; }),

    L('ea1', 'early', function (c) { return c.sessionsWeek > 0 && c.weekPct < 35; }, function (c) { return 'The week is ' + c.weekPct + '% done. ' + c.setsLeft + ' sets to go.'; }),
    L('ea2', 'early', function (c) { return c.sessionsWeek > 0 && c.weekPct < 35 && c.under.length >= 2; }, function (c) { return 'Furthest behind: ' + list(low(c, 2)) + '. Start there.'; }),
    L('ea3', 'early', function (c) { return c.sessionsWeek === 1 && c.weekPct < 35; }, function (c) { return 'One session in. ' + c.setsDone + ' of ' + c.setsTarget + ' weekly sets are done.'; }),
    L('ea4', 'early', function (c) { return c.sessionsWeek > 0 && c.weekPct < 35 && c.nextType; }, function (c) { return c.nextType + ' fills the most open sets today.'; }),
    L('ea5', 'early', function (c) { return c.sessionsWeek > 0 && c.weekPct < 35 && c.daysToWeekEnd <= 4; }, function (c) { return 'Only ' + c.daysToWeekEnd + ' days left and ' + c.setsLeft + ' sets open. Today counts.'; }),

    L('mi1', 'mid', function (c) { return c.weekPct >= 35 && c.weekPct < 70; }, function (c) { return c.weekPct + '% of the week is done. ' + c.setsLeft + ' sets left across ' + c.under.length + ' sub-muscles.'; }),
    L('mi2', 'mid', function (c) { return c.weekPct >= 35 && c.weekPct < 70 && c.under.length >= 3; }, function (c) { return 'The gaps now are ' + list(low(c, 3)) + '.'; }),
    L('mi3', 'mid', function (c) { return c.weekPct >= 35 && c.weekPct < 70 && c.atFull > 0; }, function (c) { return c.atFull + ' of ' + c.subCount + ' sub-muscles already hit their weekly target.'; }),
    L('mi4', 'mid', function (c) { return c.weekPct >= 35 && c.weekPct < 70 && c.sessionsWeek >= 2; }, function (c) { return c.sessionsWeek + ' sessions logged so far this week. The pace is good.'; }),
    L('mi5', 'mid', function (c) { return c.weekPct >= 35 && c.weekPct < 70 && c.nextType; }, function (c) { return 'Halfway there. ' + c.nextType + ' is next.'; }),

    L('la1', 'late', function (c) { return c.weekPct >= 70 && c.weekPct < 100; }, function (c) { return 'You are ' + c.weekPct + '% of the way through the week. ' + c.setsLeft + ' sets finish it.'; }),
    L('la2', 'late', function (c) { return c.weekPct >= 70 && c.weekPct < 100 && c.under.length >= 1; }, function (c) { return 'Still open: ' + list(low(c, 3)) + '.'; }),
    L('la3', 'late', function (c) { return c.weekPct >= 70 && c.weekPct < 100 && c.under.length === 1; }, function (c) { return 'One gap left: ' + c.under[0].label.toLowerCase() + ', ' + c.under[0].done + ' of ' + c.under[0].target + ' sets.'; }),
    L('la4', 'late', function (c) { return c.weekPct >= 70 && c.weekPct < 100 && c.atFull >= 3; }, function (c) { return c.atFull + ' sub-muscles are complete. Close out the rest.'; }),
    L('la5', 'late', function (c) { return c.weekPct >= 70 && c.weekPct < 100 && c.daysToWeekEnd <= 2; }, function (c) { return c.daysToWeekEnd + (c.daysToWeekEnd === 1 ? ' day' : ' days') + ' left in the week and ' + c.setsLeft + ' sets to finish.'; }),

    L('co1', 'done', function (c) { return c.weekPct >= 100; }, function (c) { return 'Every sub-muscle hit its weekly target. Extra work is optional now.'; }),
    L('co2', 'done', function (c) { return c.weekPct >= 100; }, function (c) { return 'Week complete at ' + c.setsDone + ' sets. Recover well.'; }),

    L('re1', 'recover', function (c) { return c.lastMs != null && c.lastMs < 20 * 3600000; }, function (c) { return c.lastType + ' ended ' + c.lastAgo + '. Check the red areas before you pick today.'; }),
    L('re2', 'recover', function (c) { return c.recent.length >= 2; }, function (c) { return list(c.recent.slice(0, 3).map(function (x) { return x.toLowerCase(); })) + ' were trained in the last day. Give them time.'; }),
    L('re3', 'recover', function (c) { return c.lastMs != null && c.lastMs >= 20 * 3600000 && c.lastMs < 48 * 3600000; }, function (c) { return c.lastType + ' was ' + c.lastAgo + '. Recovery is on track.'; }),

    L('gap1', 'gap', function (c) { return c.lastMs != null && c.lastMs >= 4 * DAY; }, function (c) { return c.lastAgo.replace(/^(\d+) days ago$/, '$1 days') + ' since your last session. Ease back in with ' + (c.nextType || 'your next session') + '.'; }),
    L('gap2', 'gap', function (c) { return c.lastMs != null && c.lastMs >= 3 * DAY; }, function (c) { return 'It has been ' + Math.round(c.lastMs / DAY) + ' days. The body map shows what is ready.'; }),

    L('ne1', 'neglect', function (c) { return !!c.neglect; }, function (c) { return c.neglect.label + ': ' + c.neglect.days + ' days since the last direct set. That is the biggest hole.'; }),
    L('ne2', 'neglect', function (c) { return !!c.neglect; }, function (c) { return c.neglect.label + ' last got work on ' + c.neglect.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '. Time to change that.'; }),
    L('ne3', 'neglect', function (c) { return !!c.neglect && c.neglect.days >= 21; }, function (c) { return c.neglect.days + ' days without ' + c.neglect.label.toLowerCase() + '. Plan one session this week.'; }),
    L('ne4', 'neglect', function (c) { return !!c.neglect; }, function (c) { return 'The map shows ' + c.neglect.label.toLowerCase() + ' with no color for ' + c.neglect.days + ' days.'; }),

    L('pr1', 'pr', function (c) { return !!c.pr; }, function (c) { return 'Last session: ' + c.pr.name + ' estimated max went from ' + c.pr.from + ' to ' + c.pr.to + ' lb, up ' + (c.pr.gain * 100).toFixed(1) + '%.'; }),
    L('pr2', 'pr', function (c) { return !!c.pr; }, function (c) { return 'New best on ' + c.pr.name + ': ' + c.pr.to + ' lb estimated, ' + (c.pr.gain * 100).toFixed(1) + '% above before.'; }),
    L('pr3', 'pr', function (c) { return !!c.pr && c.pr.gain >= 0.05; }, function (c) { return c.pr.name + ' jumped ' + (c.pr.gain * 100).toFixed(0) + '%. Keep the form that got you there.'; }),

    L('lg1', 'lag', function (c) { return c.under.length > 0 && c.sessionsWeek > 0; }, function (c) { return 'Lowest bar: ' + c.under[0].label.toLowerCase() + ', ' + c.under[0].done + ' of ' + c.under[0].target + ' sets.'; }),
    L('lg2', 'lag', function (c) { return c.under.length > 0 && c.under[0].last != null && c.under[0].last < c.under[0].target * 0.7 && c.sessionsLast > 0; }, function (c) { return c.under[0].label + ' fell short last week too, ' + c.under[0].last + ' of ' + c.under[0].target + '. Fix it now.'; }),
    L('lg3', 'lag', function (c) { return c.under.length >= 2; }, function (c) { return 'If you add ' + (c.under[0].target - c.under[0].done) + ' sets of ' + c.under[0].label.toLowerCase() + ' today, the lowest bar clears.'; }),

    L('tm1', 'time', function (c) { return c.period === 'morning'; }, function (c) { return 'Morning session. ' + (c.nextType ? c.nextType + ' is suggested.' : 'Pick your session.'); }),
    L('tm2', 'time', function (c) { return c.period === 'afternoon'; }, function (c) { return 'Afternoon session. ' + c.setsLeft + ' sets left this week.'; }),
    L('tm3', 'time', function (c) { return c.period === 'evening'; }, function (c) { return 'Evening session. ' + (c.nextType ? c.nextType + ' fits the rotation.' : 'Pick your session.'); }),
    L('tm4', 'time', function (c) { return c.period === 'night'; }, function (c) { return 'Late session. Keep the volume to what you can recover from.'; }),
    L('tm5', 'time', function (c) { return c.dow === 1; }, function (c) { return 'Monday. ' + c.setsTarget + ' sets are open for the week.'; }),
    L('tm6', 'time', function (c) { return c.dow === 5; }, function (c) { return 'Friday. ' + c.setsLeft + ' sets left before the week resets.'; }),
    L('tm7', 'time', function (c) { return c.dow === 0 || c.dow === 6; }, function (c) { return 'Weekend. ' + c.setsLeft + ' sets left before Monday.'; })
  ];

  var CAT_W = { pr: 4, neglect: 3, lag: 2, early: 2.5, mid: 2.5, late: 2.5, done: 3, recover: 2, gap: 2, new: 3, time: 1 };

  function greeting(c, seen, rand) {
    rand = rand || Math.random;
    seen = seen || [];
    var pool = LINES.filter(function (l) { return l.when(c); });
    var fresh = pool.filter(function (l) { return seen.indexOf(l.id) < 0; });
    if (fresh.length) pool = fresh;
    var total = pool.reduce(function (a, l) { return a + (CAT_W[l.cat] || 1); }, 0);
    var r = rand() * total, pick = pool[pool.length - 1];
    for (var i = 0; i < pool.length; i++) {
      r -= CAT_W[pool[i].cat] || 1;
      if (r <= 0) { pick = pool[i]; break; }
    }
    var heads = ['Welcome, ' + c.name + '.', 'Good ' + c.period + ', ' + c.name + '.', c.name + ', welcome back.', 'Ready when you are, ' + c.name + '.', 'Let\'s get to work, ' + c.name + '.'];
    var head = heads[Math.floor(rand() * heads.length)];
    if (c.period === 'night') head = heads[[0, 2, 3, 4][Math.floor(rand() * 4)]];
    return { id: pick ? pick.id : null, head: head, line: pick ? pick.text(c) : 'Pick a session to start.' };
  }

  function goalWeight(libEx, target, rpe) {
    var mid = Math.round((libEx.reps[0] + libEx.reps[1]) / 2);
    var w = target / (1 + (mid + (10 - (rpe || 9))) / 30);
    var inc = libEx.inc || 5;
    return { w: Math.round(w / inc) * inc, r: mid };
  }

  function suggestGoals(o) {
    var now = o.now, nowMs = now.getTime();
    var w = weekStats(o.sessions, o.cfg, now);
    var out = [], notes = [];
    var weekKey = E.weekStart(now).toISOString().slice(0, 10);
    var covered = {};
    var legDays = LEGS.map(function (m) { return w.lastDate[m] != null ? (nowMs - w.lastDate[m]) / DAY : null; });
    if (legDays.every(function (d) { return d != null && d >= 14; })) {
      var dmin = Math.round(Math.min.apply(null, legDays));
      var last = new Date(Math.max.apply(null, LEGS.map(function (m) { return w.lastDate[m]; })));
      var done = LEGS.reduce(function (a, m) { return a + w.done[m]; }, 0);
      out.push({ id: 'neglect-legs', week: weekKey, type: 'sets', subs: LEGS.slice(), target: 9, base: done, severity: 100 + dmin,
        title: 'Train legs once: 9 sets',
        evidence: 'Last leg work was ' + last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + dmin + ' days ago. Quads, hamstrings, and adductors are at ' + done + ' of ' + LEGS.reduce(function (a, m) { return a + o.cfg[m].target; }, 0) + ' weekly sets.' });
      LEGS.forEach(function (m) { covered[m] = true; });
    }
    Object.keys(o.cfg).forEach(function (m) {
      if (covered[m]) return;
      var t = o.cfg[m].target, d = w.done[m], lw = w.lastWeek[m];
      if (w.lastDate[m] != null && (nowMs - w.lastDate[m]) / DAY >= 14) {
        var days = Math.round((nowMs - w.lastDate[m]) / DAY);
        out.push({ id: 'neglect-' + m, week: weekKey, type: 'sets', subs: [m], target: 3, base: d, severity: 90 + days,
          title: 'Train ' + o.labels[m].toLowerCase() + ': 3 sets',
          evidence: o.labels[m] + ' has had no direct sets for ' + days + ' days.' });
        return;
      }
      if (lw >= 1.2 * t) {
        notes.push(o.labels[m] + ' hit ' + lw + ' of ' + t + ' sets last week. No extra volume goal.');
        return;
      }
      if (d >= t) return;
      var behind = d < 0.5 * t && (now.getDay() >= 3 || now.getDay() === 0 || lw < 0.7 * t);
      if (behind) {
        var n = Math.min(t - d, 6);
        out.push({ id: 'gap-' + m, week: weekKey, type: 'sets', subs: [m], target: n, base: d, severity: 50 + (t - d),
          title: 'Add ' + n + ' ' + o.labels[m].toLowerCase() + ' sets',
          evidence: o.labels[m] + ': ' + d + ' of ' + t + ' sets this week, ' + lw + ' last week.' });
      }
    });
    var ids = {};
    var realS = o.sessions.filter(function (s) { return !s.seed; });
    realS.forEach(function (s) { (s.exercises || []).forEach(function (e) { ids[e.exId] = true; }); });
    Object.keys(ids).forEach(function (id) {
      var pts = exSeries(realS, id);
      if (pts.length < 3) return;
      var last3 = pts.slice(-3);
      if ((last3[2].t - last3[0].t) / DAY < 14) return;
      var ch = last3[2].E / last3[0].E - 1;
      var ex = o.libById[id];
      var name = ex ? ex.name : id;
      var seq = last3.map(function (p) { return Math.round(p.E); }).join(', ');
      var span = new Date(last3[0].t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' to ' + new Date(last3[2].t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (Math.abs(ch) <= 0.025 && ex) {
        var best = Math.max.apply(null, pts.map(function (p) { return p.E; }));
        var tgt = Math.round(best * 1.025);
        var gw = goalWeight(ex, tgt, 9);
        out.push({ id: 'lift-' + id, week: weekKey, type: 'lift', exId: id, target: tgt, base: Math.round(best), severity: 70,
          title: 'Beat ' + name + ': ' + tgt + ' lb estimated max',
          evidence: 'Estimated max over the last 3 sessions (' + span + '): ' + seq + ' lb, a change of ' + (ch >= 0 ? '+' : '') + (ch * 100).toFixed(1) + '%. About ' + gw.w + ' lb for ' + gw.r + ' reps at RPE 9 gets there.' });
      } else if (ch > 0.05) {
        notes.push(name + ' estimated max: ' + seq + ' lb over ' + span + ', up ' + (ch * 100).toFixed(0) + '%. No push goal. Keep climbing.');
      } else if (ch < -0.05) {
        notes.push(name + ' estimated max is down ' + (Math.abs(ch) * 100).toFixed(0) + '% over 3 sessions (' + seq + ' lb). Check sleep and food before adding load.');
      }
    });
    if (w.sessions === 0 || now.getDay() <= 3) {
      var weeks = [];
      var ws = E.weekStart(now).getTime();
      for (var k = 1; k <= 3; k++) {
        var cnt = o.sessions.filter(function (s) { var t = ts(s.date); return t != null && t >= ws - k * 7 * DAY && t < ws - (k - 1) * 7 * DAY && s.type !== 'Extra' && !s.seed; }).length;
        weeks.push(cnt);
      }
      var active = weeks.filter(function (n) { return n > 0; });
      if (active.length >= 2) {
        var avg = Math.round(active.reduce(function (a, b) { return a + b; }, 0) / active.length);
        if (avg >= 2) out.push({ id: 'freq', week: weekKey, type: 'freq', target: avg, base: w.sessions, severity: 40,
          title: 'Train ' + avg + ' sessions this week',
          evidence: 'Your last ' + active.length + ' active weeks had ' + active.join(', ') + ' sessions.' });
      }
    }
    out.sort(function (a, b) { return b.severity - a.severity; });
    return { goals: out.slice(0, 5), notes: notes.slice(0, 3) };
  }

  function goalProgress(g, o) {
    var now = o.now, w = weekStats(o.sessions, o.cfg, now);
    if (g.type === 'sets') {
      var done = g.subs.reduce(function (a, m) { return a + (w.done[m] || 0); }, 0);
      var got = Math.max(0, done - g.base);
      return { pct: Math.min(100, 100 * got / g.target), text: got + ' of ' + g.target + ' sets', done: got >= g.target };
    }
    if (g.type === 'lift') {
      var ws = E.weekStart(now).getTime(), best = 0;
      o.sessions.forEach(function (s) {
        var t = ts(s.date);
        if (t == null || t < ws) return;
        (s.exercises || []).forEach(function (e) { if (e.exId === g.exId) best = Math.max(best, bestForSession(e) || 0); });
      });
      var span = g.target - g.base;
      var p = best ? Math.max(0, Math.min(100, 100 * (best - g.base) / (span > 0 ? span : 1))) : 0;
      return { pct: best >= g.target ? 100 : p, text: best ? Math.round(best) + ' of ' + g.target + ' lb est. max' : 'Not logged yet. Goal ' + g.target + ' lb', done: best >= g.target };
    }
    if (g.type === 'freq') {
      return { pct: Math.min(100, 100 * w.sessions / g.target), text: w.sessions + ' of ' + g.target + ' sessions', done: w.sessions >= g.target };
    }
    return { pct: 0, text: '', done: false };
  }

  return {
    weekStats: weekStats, regionState: regionState, buildCtx: buildCtx, greeting: greeting, LINES: LINES,
    suggestGoals: suggestGoals, goalProgress: goalProgress, exSeries: exSeries, agoText: agoText
  };
});
