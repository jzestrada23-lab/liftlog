(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var DAY = 86400000;
  var TARGET_RPE = 9;
  var MIN_PER_SET = 3.2;

  function roundTo(x, inc) { return Math.round(x / inc) * inc; }
  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function daysBetween(a, b) { return (new Date(b).getTime() - new Date(a).getTime()) / DAY; }

  function e1rm(w, reps, rpe) {
    var used = rpe == null ? TARGET_RPE : rpe;
    return w * (1 + (reps + (10 - used)) / 30);
  }
  function repsAt(E, w, rpe) {
    var used = rpe == null ? TARGET_RPE : rpe;
    return 30 * (E / w - 1) - (10 - used);
  }

  function usableSets(sets) {
    return (sets || []).filter(function (s) {
      return s.done && !s.flag && Number(s.r) > 0 && Number(s.w) > 0;
    });
  }
  function bestE(sets) {
    var best = 0;
    usableSets(sets).forEach(function (s) {
      var e = e1rm(Number(s.w), Number(s.r), s.rpe);
      if (e > best) best = e;
    });
    return best || null;
  }

  function dFactor(d2, k) {
    if (k <= 0) return 1;
    return Math.max(0.8, d2 - 0.012 * (k - 1));
  }

  function pickWeight(E, range, inc, wStart) {
    var lo = range[0], hi = range[1];
    var w = wStart != null ? wStart : E / (1 + (hi + 1) / 30);
    w = Math.max(inc, roundTo(w, inc));
    var guard = 0;
    while (repsAt(E, w + inc) >= hi && guard++ < 200) w += inc;
    guard = 0;
    while (w > inc && repsAt(E, w) < lo && guard++ < 200) w -= inc;
    var r = Math.round(repsAt(E, w) + 0.35);
    r = clamp(r, 1, hi);
    return { w: w, r: r };
  }

  function weightForReps(E, reps, inc) {
    return Math.max(inc, roundTo(E / (1 + (reps + 1) / 30), inc));
  }

  function gapInfo(lastDate, now) {
    if (!lastDate) return { days: null, mgap: 0.95, growthWeeks: 0 };
    var days = Math.max(0, daysBetween(lastDate, now));
    var weeks = days / 7;
    var mgap = days <= 14 ? 1 : Math.max(0.88, 1 - 0.012 * (weeks - 2));
    return { days: days, mgap: mgap, growthWeeks: Math.min(weeks, 3) };
  }

  function observedGrowth(points, fallback) {
    var pts = points.filter(function (p) { return p.date && p.E; });
    if (pts.length < 3) return fallback;
    var t0 = new Date(pts[0].date).getTime();
    var span = (new Date(pts[pts.length - 1].date).getTime() - t0) / DAY;
    if (span < 14) return fallback;
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) {
      var x = (new Date(p.date).getTime() - t0) / DAY / 7;
      var y = Math.log(p.E);
      sx += x; sy += y; sxx += x * x; sxy += x * y;
    });
    var den = n * sxx - sx * sx;
    if (!den) return fallback;
    var slope = (n * sxy - sx * sy) / den;
    return clamp(Math.exp(slope) - 1, 0, 0.01);
  }

  function ctxKey(bucket, fed) { return bucket + '|' + fed; }
  function ctxMult(learned, key) {
    var c = learned && learned.ctx && learned.ctx[key];
    if (!c || c.n < 4) return 1;
    var shrink = Math.min(1, (c.n - 3) / 8);
    return clamp(1 + (c.mean - 1) * shrink, 0.95, 1.05);
  }
  function timeBucket(date) {
    var h = new Date(date).getHours();
    if (h < 9) return 'early';
    if (h < 14) return 'midday';
    if (h < 20) return 'afternoon';
    return 'night';
  }

  function weekStart(now) {
    var d = new Date(now);
    d.setHours(0, 0, 0, 0);
    var day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }

  function setsFor(cfg, done, again) {
    var deficit = Math.max(0, cfg.target - done);
    var s;
    if (again === 'yes') s = Math.ceil(deficit / 2);
    else if (again === 'no') s = deficit;
    else s = Math.round(deficit * 0.45);
    return clamp(s, cfg.min, cfg.cap);
  }

  function distribute(S, n) {
    var out = [], left = S;
    for (var i = 0; i < n; i++) {
      var take = Math.ceil(left / (n - i));
      out.push(take);
      left -= take;
    }
    return out;
  }

  function composeSets(S) {
    if (S <= 0) return [];
    if (S <= 2) return [Math.max(2, S)];
    var n3 = Math.floor(S / 3), rem = S % 3, out = [], i;
    if (rem === 0) { for (i = 0; i < n3; i++) out.push(3); return out; }
    if (rem === 2) { for (i = 0; i < n3; i++) out.push(3); out.push(2); return out; }
    for (i = 0; i < n3 - 1; i++) out.push(3);
    out.push(2, 2);
    return out;
  }

  function prefRank(e) {
    var t = e.equip || [];
    if (t.indexOf('barbell') >= 0 || t.indexOf('dumbbell') >= 0 || t.indexOf('cable') >= 0 || t.indexOf('any') >= 0 || t.indexOf('rack') >= 0) return 0;
    if (t.indexOf('smith') >= 0) return 1;
    return 2;
  }
  function rankCands(list, hasHist, histFirst) {
    var idx = {};
    list.forEach(function (e, i) { idx[e.id] = i; });
    return list.slice().sort(function (a, b) {
      var pa = prefRank(a), pb = prefRank(b);
      var ha = hasHist && hasHist(a.id) ? 0 : 1, hb = hasHist && hasHist(b.id) ? 0 : 1;
      if (histFirst && ha !== hb) return ha - hb;
      if (pa !== pb) return pa - pb;
      if (ha !== hb) return ha - hb;
      return idx[a.id] - idx[b.id];
    });
  }
  function threeFriendly(S, min) {
    if (S >= 4 && S % 3 === 1) return S - 1 >= min ? S - 1 : S + 1;
    return S;
  }

  function trimToTime(alloc, cfgs, capMinutes, done) {
    var total = function () {
      var t = 0;
      for (var m in alloc) t += alloc[m];
      return t;
    };
    var guard = 0;
    while (total() * MIN_PER_SET > capMinutes && guard++ < 200) {
      var pick = null, room = 0;
      for (var m in alloc) {
        var r = alloc[m] - cfgs[m].min;
        if (r > room) { room = r; pick = m; }
      }
      if (!pick) {
        var drop = null, least = Infinity, live = 0;
        for (var k in alloc) {
          if (alloc[k] > 0) {
            live++;
            var need = cfgs[k].target - ((done && done[k]) || 0);
            if (need <= least) { least = need; drop = k; }
          }
        }
        if (!drop || live <= 1) break;
        alloc[drop] = 0;
        continue;
      }
      alloc[pick] -= 1;
      if (alloc[pick] >= 4 && alloc[pick] % 3 === 1 && alloc[pick] - 1 >= cfgs[pick].min) alloc[pick] -= 1;
    }
    return alloc;
  }

  function projectE(ex, hist, now, g, mctx) {
    if (!hist.length) return null;
    var last = hist[hist.length - 1];
    var E = bestE(last.sets);
    if (!E) return null;
    var gi = gapInfo(last.date, now);
    var pts = hist.map(function (h) { return { date: h.date, E: bestE(h.sets) }; });
    var gUse = observedGrowth(pts, g);
    var proj = E * Math.pow(1 + gUse, gi.growthWeeks) * gi.mgap;
    return { Eraw: proj, E: proj * (mctx || 1), gap: gi, last: last, Elast: E };
  }

  function clampDumbbell(ex, loc, res, E, inc) {
    if (loc !== 'garage' || ex.equip.indexOf('dumbbell') < 0) return res;
    if (res.w <= 80) return res;
    return { w: 80, r: clamp(Math.round(repsAt(E, 80) + 0.35), 1, ex.reps[1] + 6), capped: true };
  }

  function planExercise(opts) {
    var ex = opts.ex, lib = opts.lib, hist = opts.histOf, now = opts.now;
    var learned = opts.learned || { k: {}, ctx: {}, d2: {}, unavail: {} };
    var loc = opts.location;
    var mctx = ctxMult(learned, opts.ctxKey);
    var d2 = learned.d2[ex.id] != null ? learned.d2[ex.id] : 0.92;
    var base = { exId: ex.id, inc: ex.inc, reps: ex.reps, d2: d2, kind: ex.kind, loc: loc };
    var own = hist(ex.id);
    if (ex.kind === 'bw') {
      if (!own.length) return Object.assign(base, { mode: 'calibrate', note: 'No history. Log set 1 to set targets.' });
      var lastSets = own[own.length - 1].sets.filter(function (s) { return s.done; });
      var lastR = lastSets.map(function (s) { return Number(s.r) || 0; });
      var w = lastSets.length ? Number(lastSets[0].w) || 0 : 0;
      var r1 = lastR[0] || ex.reps[0];
      var repT = [];
      if (r1 >= ex.reps[1]) { w += ex.inc; repT.push(ex.reps[0]); }
      else repT.push(Math.min(ex.reps[1], r1 + 1));
      for (var i = 1; i < 8; i++) repT.push(lastR[i] != null && lastR[i] > 0 ? lastR[i] : Math.max(1, Math.round(repT[0] * 0.6)));
      return Object.assign(base, { mode: 'bw', w: w, repT: repT, note: '' });
    }
    var proj = projectE(ex, own, now, opts.g, mctx);
    if (proj) {
      var gap = proj.gap;
      var consistent = gap.days != null && gap.days <= 14;
      var lastTop = null;
      var ls = usableSets(proj.last.sets);
      if (ls.length) lastTop = Number(ls[0].w);
      if (consistent) {
        var pw = clampDumbbell(ex, loc, pickWeight(proj.E, ex.reps, ex.inc, lastTop), proj.E, ex.inc);
        return Object.assign(base, { mode: 'known', E: proj.E, Eraw: proj.Eraw, w: pw.w, r: pw.r, capped: !!pw.capped, conf: 'high', note: '' });
      }
      var top = clampDumbbell(ex, loc, pickWeight(proj.E, ex.reps, ex.inc, null), proj.E, ex.inc);
      var low = clampDumbbell(ex, loc, pickWeight(proj.E * 0.92, ex.reps, ex.inc, null), proj.E * 0.92, ex.inc);
      var why = gap.days == null ? 'Last session date unknown.' : Math.round(gap.days) + ' days since last session.';
      return Object.assign(base, { mode: 'range', E: proj.E, Eraw: proj.Eraw, wLo: low.w, wHi: top.w, rLo: Math.min(low.r, top.r), rHi: Math.max(low.r, top.r), capped: !!top.capped, conf: 'medium', note: why + ' Set 1 is a range.' });
    }
    var best = null;
    lib.forEach(function (o) {
      if (o.id === ex.id || !o.pattern || o.pattern !== ex.pattern) return;
      var h = hist(o.id);
      if (!h.length) return;
      var p = projectE(o, h, now, opts.g, 1);
      if (!p) return;
      var date = h[h.length - 1].date;
      var stamp = date ? new Date(date).getTime() : 0;
      if (!best || stamp > best.stamp) best = { ex: o, proj: p, stamp: stamp };
    });
    if (best) {
      var key = best.ex.id + '>' + ex.id;
      var learnedK = learned.k[key];
      var k = learnedK ? learnedK.k : ex.rel / best.ex.rel;
      var Eest = best.proj.Eraw * k * mctx;
      var spread = learnedK ? 0.9 : 0.75;
      var t2 = clampDumbbell(ex, loc, pickWeight(Eest, ex.reps, ex.inc, null), Eest, ex.inc);
      var l2 = clampDumbbell(ex, loc, pickWeight(Eest * spread, ex.reps, ex.inc, null), Eest * spread, ex.inc);
      return Object.assign(base, { mode: 'swap', E: Eest, Eraw: best.proj.Eraw * k, wLo: l2.w, wHi: t2.w, rLo: Math.min(l2.r, t2.r), rHi: Math.max(l2.r, t2.r), capped: !!t2.capped, conf: learnedK ? 'medium' : 'low', from: best.ex.name, note: (learnedK ? 'Estimated from ' : 'Rough estimate from ') + best.ex.name + '. Set 1 is a range.' });
    }
    return Object.assign(base, { mode: 'calibrate', note: 'No history. Pick a weight you can lift for about ' + ex.reps[1] + ' reps. Log set 1 to set targets.' });
  }

  function firstDoneE(sets) {
    for (var i = 0; i < sets.length; i++) {
      var s = sets[i];
      if (s.done && Number(s.r) > 0 && Number(s.w) > 0 && !s.flag) return e1rm(Number(s.w), Number(s.r), s.rpe);
    }
    return null;
  }

  function setTarget(plan, sets, k) {
    if (plan.mode === 'bw') {
      return { w: k === 0 ? plan.w : (sets[k - 1] && sets[k - 1].w !== '' ? Number(sets[k - 1].w) : plan.w), r: plan.repT[k] || plan.repT[plan.repT.length - 1] };
    }
    var E1 = firstDoneE(sets);
    if (k === 0) {
      if (plan.mode === 'known') return { w: plan.w, r: plan.r };
      if (plan.mode === 'range' || plan.mode === 'swap') return { wLo: plan.wLo, wHi: plan.wHi, rLo: plan.rLo, rHi: plan.rHi, w: roundTo((plan.wLo + plan.wHi) / 2, plan.inc) };
      return null;
    }
    var Ebase = E1 != null ? E1 : (plan.mode === 'known' ? plan.E : null);
    if (Ebase == null) return null;
    var prev = sets[k - 1];
    var w = prev && Number(prev.w) > 0 ? Number(prev.w) : (plan.mode === 'known' ? plan.w : (sets[0] && Number(sets[0].w)) || null);
    if (!w) return null;
    var Ek = Ebase * dFactor(plan.d2, k);
    var r = clamp(Math.round(repsAt(Ek, w)), 1, plan.reps[1] + 2);
    if (prev && prev.done && Number(prev.r) > 0) r = Math.max(r, Math.round(Number(prev.r) * 0.65));
    if (sets[k] && sets[k].extra && prev && prev.done && Number(prev.r) > 0) r = Math.min(r, Math.round(Number(prev.r)));
    var out = { w: w, r: r };
    if (r < plan.reps[0] - 1) {
      var wAlt = weightForReps(Ek, plan.reps[0], plan.inc);
      if (wAlt < w && !(sets[k] && sets[k].extra)) out.alt = { w: wAlt, r: plan.reps[0] };
    }
    return out;
  }

  var FAT_K = 0.015, FAT_MIN = 0.85;
  function fatigueLoad(cur, prior, libById) {
    var n = 0, def;
    prior.forEach(function (p) {
      if (!p.n) return;
      if (p.muscle === cur.muscle) { n += p.n; return; }
      def = libById && libById[p.exId];
      if (def && def.also && def.also[cur.muscle]) n += p.n * def.also[cur.muscle];
    });
    return Math.round(n * 10) / 10;
  }
  function fatMult(n, k) {
    var kk = k != null ? k : FAT_K;
    return Math.max(FAT_MIN, 1 - kk * n);
  }
  function fatPlan(base, mult) {
    var p = JSON.parse(JSON.stringify(base));
    if (!(mult < 1)) return p;
    var inc = p.inc || 5;
    if (p.mode === 'known') {
      p.E = p.E * mult;
      var w = roundTo(p.w * mult, inc);
      if (w === p.w) p.r = Math.max(1, Math.min(p.r, Math.round(repsAt(p.E, p.w))));
      else { p.w = w; p.r = Math.max(1, Math.round(repsAt(p.E, w))); }
    } else if (p.mode === 'range' || p.mode === 'swap') {
      p.E = p.E * mult;
      p.wLo = roundTo(p.wLo * mult, inc);
      p.wHi = roundTo(p.wHi * mult, inc);
    }
    return p;
  }

  function weekDone(sessions, now, libById) {
    var start = weekStart(now).getTime();
    var done = {};
    sessions.forEach(function (s) {
      if (!s.date || new Date(s.date).getTime() < start) return;
      s.exercises.forEach(function (e) {
        var n = e.sets.filter(function (x) { return x.done; }).length;
        done[e.muscle] = (done[e.muscle] || 0) + n;
      });
    });
    return done;
  }

  function weekIndirect(sessions, now, libById) {
    var start = weekStart(now).getTime();
    var out = {};
    sessions.forEach(function (s) {
      if (!s.date || new Date(s.date).getTime() < start) return;
      s.exercises.forEach(function (e) {
        var def = libById[e.exId];
        if (!def || !def.also) return;
        var n = e.sets.filter(function (x) { return x.done; }).length;
        Object.keys(def.also).forEach(function (k) { out[k] = (out[k] || 0) + n * def.also[k]; });
      });
    });
    return out;
  }

  function availableList(lib, muscle, location, settings, unavail, now) {
    var out = lib.filter(function (e) { return e.muscle === muscle && isAvailable(e, location, settings); });
    var recent = function (id) {
      var u = unavail && unavail[id];
      if (!u || !u.last) return 0;
      return daysBetween(u.last, now) <= 14 ? u.count : 0;
    };
    var idx = {};
    out.forEach(function (e, i) { idx[e.id] = i + (recent(e.id) >= 2 ? 100 : 0); });
    out.sort(function (a, b) { return idx[a.id] - idx[b.id]; });
    return out;
  }

  function uniqueVariants(list) {
    var seen = {}, out = [];
    list.forEach(function (e) {
      var key = e.v || e.id;
      if (seen[key]) return;
      seen[key] = true;
      out.push(e);
    });
    return out;
  }

  function interleaveSubs(list) {
    var keys = [], groups = {};
    list.forEach(function (e) {
      var k = e.sub || '_';
      if (!groups[k]) { groups[k] = []; keys.push(k); }
      groups[k].push(e);
    });
    if (keys.length < 2) return list;
    var out = [], i = 0, more = true;
    while (more) {
      more = false;
      keys.forEach(function (k) {
        if (groups[k][i]) { out.push(groups[k][i]); more = true; }
      });
      i++;
    }
    return out;
  }

  function median(a) {
    var b = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(b.length / 2);
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }
  var REST_DEFAULT = { compound: 150, iso: 150, bw: 90 };
  function restSeconds(exId, kind, sessions) {
    var gaps = [];
    (sessions || []).forEach(function (s) {
      (s.exercises || []).forEach(function (e) {
        if (e.exId !== exId) return;
        var us = (e.sets || []).filter(function (x) { return x.done && x.at; });
        for (var i = 0; i + 1 < us.length; i++) {
          var g = Number(us[i].ra) > 0 ? Number(us[i].ra) : (new Date(us[i + 1].at) - new Date(us[i].at)) / 1000;
          if (g >= 30 && g <= 480) gaps.push(g);
        }
      });
    });
    var sec = REST_DEFAULT[kind] || 150;
    if (gaps.length >= 3) {
      var m1 = median(gaps);
      var kept = gaps.filter(function (g) { return g <= 2 * m1; });
      sec = kept.length >= 3 ? median(kept) : m1;
    }
    return clamp(Math.round(sec / 15) * 15, 45, 360);
  }

  var REST_BUCKETS = [
    { label: 'Under 2:00', lo: 0, hi: 120 },
    { label: '2:00 to 3:00', lo: 120, hi: 180 },
    { label: 'Over 3:00', lo: 180, hi: 481 }
  ];
  function restStats(sessions) {
    var pairs = [], per = [];
    (sessions || []).forEach(function (s) {
      var vol = 0, gaps = [];
      (s.exercises || []).forEach(function (e) {
        var ss = (e.sets || []).filter(function (x) { return x.done; });
        ss.forEach(function (x) { if (Number(x.w) > 0 && Number(x.r) > 0) vol += Number(x.w) * Number(x.r); });
        var u = ss.filter(function (x) { return x.at && !x.flag && Number(x.r) > 0 && Number(x.w) > 0; });
        for (var i = 0; i + 1 < u.length; i++) {
          var g = Number(u[i].ra) > 0 ? Number(u[i].ra) : (new Date(u[i + 1].at) - new Date(u[i].at)) / 1000;
          if (g < 30 || g > 480) continue;
          var a = e1rm(Number(u[i].w), Number(u[i].r), u[i].rpe), b = e1rm(Number(u[i + 1].w), Number(u[i + 1].r), u[i + 1].rpe);
          pairs.push({ g: g, ret: b / a, rp: Number(u[i].rp) || 0 });
          gaps.push(g);
        }
      });
      if (!s.seed && gaps.length && s.finishedAt && s.date) {
        var min = (new Date(s.finishedAt) - new Date(s.date)) / 60000;
        if (min > 5) per.push({ id: s.id, type: s.type, date: s.date, avgRest: gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length, volume: vol, minutes: min, perMin: vol / min });
      }
    });
    var buckets = REST_BUCKETS.map(function (b) {
      var x = pairs.filter(function (p) { return p.g >= b.lo && p.g < b.hi; });
      return { label: b.label, n: x.length, ret: x.length ? x.reduce(function (a, p) { return a + p.ret; }, 0) / x.length : null };
    });
    var planned = pairs.filter(function (p) { return p.rp > 0; });
    var over = planned.filter(function (p) { return p.g > p.rp + 30; });
    var on = planned.filter(function (p) { return p.g <= p.rp + 30; });
    var avg = function (a) { return a.length ? a.reduce(function (t, p) { return t + p.ret; }, 0) / a.length : null; };
    var adherence = {
      n: planned.length, overN: over.length, onN: on.length, overRet: avg(over), onRet: avg(on),
      avgOver: over.length ? over.reduce(function (t, p) { return t + (p.g - p.rp); }, 0) / over.length : 0
    };
    return { buckets: buckets, sessions: per, pairs: pairs.length, adherence: adherence };
  }

  var GARAGE_TAGS = ['barbell', 'dumbbell', 'cable', 'smith', 'rack'];
  function isAvailable(ex, location, settings) {
    if (ex.equip.indexOf('any') >= 0) return true;
    if (location !== 'garage') return true;
    var tags = GARAGE_TAGS.slice();
    if (settings && settings.garageBench) tags.push('bench');
    return ex.equip.every(function (t) { return tags.indexOf(t) >= 0; });
  }

  function planSession(o) {
    var tpl = o.template, cfgs = o.muscleCfg, done = o.weekDone || {};
    var muscles = [];
    tpl.blocks.forEach(function (b) { b.muscles.forEach(function (m) { if (muscles.indexOf(m) < 0) muscles.push(m); }); });
    var alloc = {};
    muscles.forEach(function (m) {
      var cands = availableList(o.lib, m, o.location, o.settings, o.learned && o.learned.unavail, o.now);
      alloc[m] = cands.length ? threeFriendly(setsFor(cfgs[m], done[m] || 0, o.again), cfgs[m].min) : 0;
    });
    trimToTime(alloc, cfgs, o.timeCap || 60, done);
    var blocks = tpl.blocks.map(function (b) {
      var exs = [];
      b.muscles.forEach(function (m) {
        var S = alloc[m];
        if (!S) return;
        var cands = uniqueVariants(rankCands(availableList(o.lib, m, o.location, o.settings, o.learned && o.learned.unavail, o.now), o.hasHist, true));
        var parts = composeSets(S);
        while (parts.length > cands.length) {
          var last = parts.pop();
          parts[parts.length - 1] += last;
        }
        for (var i = 0; i < parts.length; i++) {
          exs.push({ ex: cands[i], sets: parts[i] });
        }
      });
      return { id: b.id, name: b.name, items: exs };
    });
    var total = 0;
    blocks.forEach(function (b) { b.items.forEach(function (it) { total += it.sets; }); });
    return { blocks: blocks, alloc: alloc, totalSets: total, minutes: Math.round(total * MIN_PER_SET) };
  }

  function updateLearning(learned, session, o) {
    learned.k = learned.k || {}; learned.ctx = learned.ctx || {}; learned.d2 = learned.d2 || {}; learned.unavail = learned.unavail || {};
    var key = ctxKey(session.bucket, session.fed);
    session.exercises.forEach(function (e) {
      var sets = e.sets.filter(function (s) { return s.done && !s.extra; });
      var E1 = firstDoneE(e.sets);
      if (e.fatN > 0 && e.planBase && e.planBase.mode === 'known' && E1 && e.planBase.E) {
        learned.fatK = learned.fatK || {};
        if (e.fatN >= 2) {
          var kObs = clamp((1 - E1 / e.planBase.E) / e.fatN, 0, 0.05);
          var fk = learned.fatK[e.muscle];
          learned.fatK[e.muscle] = fk ? { k: fk.k * 0.7 + kObs * 0.3, n: fk.n + 1 } : { k: FAT_K * 0.5 + kObs * 0.5, n: 1 };
        }
      }
      if (!(e.fatN > 0) && e.plan && e.plan.mode === 'known' && E1 && e.plan.Eraw) {
        var ratio = clamp(E1 / e.plan.Eraw, 0.8, 1.2);
        var c = learned.ctx[key] || { n: 0, mean: 1 };
        c.mean = c.n ? c.mean * 0.8 + ratio * 0.2 : ratio;
        c.n += 1;
        learned.ctx[key] = c;
      }
      if (sets.length >= 2 && E1) {
        var s2 = sets[1];
        if (!s2.flag && Number(s2.r) > 0 && Number(s2.w) > 0) {
          var E2 = e1rm(Number(s2.w), Number(s2.r), s2.rpe);
          var rr = clamp(E2 / E1, 0.8, 1.0);
          var prev = learned.d2[e.exId];
          learned.d2[e.exId] = prev != null ? prev * 0.7 + rr * 0.3 : rr;
        }
      }
    });
    if (o && o.libById && o.histOf) {
      session.exercises.forEach(function (e) {
        var ex = o.libById[e.exId];
        var Enow = bestE(e.sets);
        if (!ex || !ex.pattern || !Enow) return;
        Object.keys(o.libById).forEach(function (id) {
          var other = o.libById[id];
          if (id === e.exId || !other.pattern || other.pattern !== ex.pattern) return;
          var h = o.histOf(id);
          if (!h.length) return;
          var Eo = bestE(h[h.length - 1].sets);
          if (!Eo) return;
          var date = h[h.length - 1].date;
          if (date && Math.abs(daysBetween(date, session.date)) > 21) return;
          var kk = id + '>' + e.exId;
          var ratio2 = Enow / Eo;
          var cur = learned.k[kk];
          learned.k[kk] = cur ? { k: cur.k * 0.6 + ratio2 * 0.4, n: cur.n + 1 } : { k: ratio2, n: 1 };
          var kr = e.exId + '>' + id;
          var inv = 1 / ratio2;
          var cur2 = learned.k[kr];
          learned.k[kr] = cur2 ? { k: cur2.k * 0.6 + inv * 0.4, n: cur2.n + 1 } : { k: inv, n: 1 };
        });
      });
    }
    return learned;
  }

  function seedLearn(sessions, learned) {
    learned.d2 = learned.d2 || {};
    sessions.forEach(function (s) {
      s.exercises.forEach(function (e) {
        var sets = e.sets.filter(function (x) { return x.done; });
        if (sets.length < 2) return;
        var E1 = e1rm(Number(sets[0].w), Number(sets[0].r), null);
        var E2 = e1rm(Number(sets[1].w), Number(sets[1].r), null);
        if (!(E1 > 0) || !(E2 > 0)) return;
        learned.d2[e.exId] = clamp(E2 / E1, 0.8, 1.0);
      });
    });
    return learned;
  }

  function expectedRpe(E, w, reps) {
    var rEff = 30 * (E / w - 1);
    return clamp(10 - (rEff - reps), 5, 10);
  }

  return {
    DAY: DAY, TARGET_RPE: TARGET_RPE, MIN_PER_SET: MIN_PER_SET,
    roundTo: roundTo, clamp: clamp, daysBetween: daysBetween,
    e1rm: e1rm, repsAt: repsAt, bestE: bestE, usableSets: usableSets, firstDoneE: firstDoneE,
    dFactor: dFactor, pickWeight: pickWeight, weightForReps: weightForReps,
    gapInfo: gapInfo, observedGrowth: observedGrowth, projectE: projectE,
    ctxKey: ctxKey, ctxMult: ctxMult, timeBucket: timeBucket, weekStart: weekStart,
    setsFor: setsFor, distribute: distribute, trimToTime: trimToTime,
    planExercise: planExercise, setTarget: setTarget, planSession: planSession,
    weekDone: weekDone, weekIndirect: weekIndirect, composeSets: composeSets, rankCands: rankCands, prefRank: prefRank, availableList: availableList, uniqueVariants: uniqueVariants, interleaveSubs: interleaveSubs, restSeconds: restSeconds, restStats: restStats, isAvailable: isAvailable,
    fatigueLoad: fatigueLoad, fatMult: fatMult, fatPlan: fatPlan, FAT_K: FAT_K,
    updateLearning: updateLearning, seedLearn: seedLearn, expectedRpe: expectedRpe
  };
});
