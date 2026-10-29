(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Body = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var MIRROR = 'matrix(-1 0 0 1 220 0)';

  var FRONT_NEUTRAL = [
    { d: 'M102 46 L118 46 L121 66 L99 66 Z' },
    { d: 'M112 66 L130 70 L146 70 L148 82 L112 82 Z', m: true },
    { d: 'M112 128 C124 130 136 130 143 126 C146 142 144 172 140 196 L112 204 Z', m: true, core: true },
    { d: 'M112 204 L140 196 C148 208 150 218 148 228 L112 228 Z', m: true },
    { d: 'M118 330 C128 328 140 330 142 338 C144 368 140 398 137 418 L121 418 C117 384 117 352 118 330 Z', m: true },
    { d: 'M121 418 L137 418 L142 430 L119 430 Z', m: true },
    { d: 'M177 220 C186 218 192 226 190 236 C188 246 180 248 176 240 Z', m: true },
    { d: 'M119 328 L141 328 L141 334 L119 334 Z', m: true }
  ];
  var BACK_NEUTRAL = [
    { d: 'M102 46 L118 46 L121 66 L99 66 Z' },
    { d: 'M112 62 C126 64 140 68 148 72 L148 84 L112 82 Z', m: true },
    { d: 'M112 204 C128 200 146 204 150 220 C150 236 132 242 112 240 Z', m: true },
    { d: 'M118 336 C128 332 140 334 142 342 C144 370 140 398 137 418 L121 418 C117 388 117 360 118 336 Z', m: true },
    { d: 'M121 418 L137 418 L142 430 L119 430 Z', m: true },
    { d: 'M177 220 C186 218 192 226 190 236 C188 246 180 248 176 240 Z', m: true },
    { d: 'M119 326 L141 326 L141 336 L119 336 Z', m: true }
  ];

  var FRONT = [
    { id: 'chest_incline', m: true, nd: 1, d: 'M112 81 C124 78 138 79 148 85 C151 91 149 97 145 101 C132 98 120 96 112 96 Z', t: [129, 92] },
    { id: 'chest_flat', m: true, d: 'M112 97 C122 97 134 99 145 102 C151 110 149 120 142 126 C132 132 120 131 112 128 Z', t: [129, 113] },
    { id: 'side_delt', m: true, d: 'M147 70 C160 68 172 76 174 90 C175 100 172 108 168 116 C160 108 153 100 150 90 C148 84 147 77 147 70 Z', t: [163, 94], s: 1, nd: 1 },
    { id: 'arm_front', m: true, arm: ['bi_long', 'bi_short', 'forearms'], d: 'M169 118 C178 120 184 128 184 140 C184 150 182 158 180 162 L168 162 C166 148 166 132 169 118 Z M168 166 L181 166 C184 184 186 202 188 218 L177 222 C171 204 167 184 168 166 Z', t: [176, 142], s: 2 },
    { id: 'adductors', m: true, d: 'M111 230 L123 230 C124 262 122 296 118 322 L111 326 Z', t: [117, 276], s: 1 },
    { id: 'quads', m: true, d: 'M124 228 C136 226 148 232 150 246 C154 272 150 302 144 328 L120 328 C122 296 124 262 124 228 Z', t: [136, 270] }
  ];
  var BACK = [
    { id: 'midback', m: true, d: 'M112 82 C124 80 136 84 145 90 C147 102 143 114 135 120 C128 128 120 128 112 128 Z', t: [128, 104] },
    { id: 'rear_delt', m: true, d: 'M147 72 C160 70 172 78 174 92 C175 102 172 110 168 118 C160 110 153 102 150 92 C148 86 147 79 147 72 Z', t: [163, 96], s: 1, nd: 1 },
    { id: 'lats', m: true, d: 'M136 122 C148 112 160 112 164 122 C162 146 152 170 134 190 L126 188 C126 164 132 142 136 122 Z', t: [146, 150] },
    { id: 'lowback', m: true, d: 'M112 130 C120 130 128 134 128 144 C128 162 128 180 126 190 L124 204 L112 204 Z', t: [119, 168], s: 1 },
    { id: 'arm_back', m: true, arm: ['tri_long', 'tri_lat', 'forearms'], d: 'M169 120 C178 122 184 130 184 142 C184 152 182 160 180 164 L168 164 C166 150 166 134 169 120 Z M168 168 L181 168 C184 186 186 204 188 220 L177 224 C171 206 167 186 168 168 Z', t: [176, 144], s: 2 },
    { id: 'hamstrings', m: true, d: 'M112 242 C128 240 148 244 150 258 C154 282 150 308 144 326 L118 326 C112 304 112 270 112 242 Z', t: [132, 284] }
  ];

  var ARM_FRONT = [
    { id: 'bi_short', d: 'M34 42 C42 36 52 34 60 34 L60 112 C52 114 42 114 36 112 C32 92 30 64 34 42 Z', t: [47, 74], lab: 'Short head' },
    { id: 'bi_long', d: 'M62 34 C74 34 86 40 90 54 C94 74 92 98 88 112 C80 114 70 114 62 112 Z', t: [77, 74], lab: 'Long head' },
    { id: 'forearms', d: 'M38 118 C50 116 76 116 88 118 C92 144 84 184 76 226 L54 226 C44 186 36 146 38 118 Z', t: [62, 168], lab: 'Forearm' }
  ];
  var ARM_BACK = [
    { id: 'tri_long', d: 'M34 42 C42 36 52 34 60 34 L60 112 C52 114 42 114 36 112 C32 92 30 64 34 42 Z', t: [47, 74], lab: 'Long head' },
    { id: 'tri_lat', d: 'M62 34 C74 34 86 40 90 54 C94 74 92 98 88 112 C80 114 70 114 62 112 Z', t: [77, 74], lab: 'Lateral head' },
    { id: 'forearms', d: 'M38 118 C50 116 76 116 88 118 C92 144 84 184 76 226 L54 226 C44 186 36 146 38 118 Z', t: [62, 168], lab: 'Forearm' }
  ];

  function heat(days) {
    if (days == null || !isFinite(days) || days >= 7) return { fill: 'rgba(140,150,165,0.10)', ink: '#c9ced6', on: false };
    var d = Math.max(0, days);
    var hue = d <= 1 ? 4 : d >= 5 ? 48 : 4 + (d - 1) * (44 / 4);
    var alpha = d <= 1 ? 0.92 : 0.92 - (d - 1) * (0.62 / 6);
    return { fill: 'hsla(' + hue.toFixed(0) + ',86%,56%,' + alpha.toFixed(2) + ')', ink: d < 4 ? '#fff' : '#fff', on: true };
  }

  function dayText(days) {
    if (days == null || !isFinite(days)) return '';
    if (days < 1) return Math.max(1, Math.round(days * 24)) + 'h';
    return Math.round(days) + 'd';
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function shape(d, attrs, mirror) {
    var out = '<path d="' + d + '" ' + attrs + '/>';
    if (mirror) out += '<path d="' + d + '" ' + attrs + ' transform="' + MIRROR + '"/>';
    return out;
  }

  function figure(neutral, regions, state, opts) {
    opts = opts || {};
    var h = '<svg class="body-svg" viewBox="0 0 220 436" role="img" aria-label="' + esc(opts.label || 'Muscle map') + '" xmlns="http://www.w3.org/2000/svg">';
    h += '<circle cx="110" cy="28" r="17" class="b-neutral"/>';
    neutral.forEach(function (n) {
      h += shape(n.d, 'class="b-neutral"', n.m);
      if (n.core) h += '<path d="M110 132 L110 200 M112 150 L140 150 M112 168 L141 168 M112 186 L139 186" class="b-line" transform="translate(0,0)"/><path d="M110 132 L110 200 M112 150 L140 150 M112 168 L141 168 M112 186 L139 186" class="b-line" transform="' + MIRROR + '"/>';
    });
    regions.forEach(function (r) {
      var st = state[r.id] || {};
      var hs = heat(st.days);
      var attrs = 'class="b-reg' + (hs.on ? ' on' : '') + '" style="fill:' + hs.fill + '"';
      h += '<g class="b-g" data-region="' + r.id + '" tabindex="0" role="button" aria-label="' + esc(st.label || r.id) + '">' + shape(r.d, attrs, r.m);
      if (st.pct != null && r.t) {
        var big = r.s ? (r.s === 2 ? 7 : 8) : 10;
        h += '<text x="' + r.t[0] + '" y="' + r.t[1] + '" class="b-pct" style="font-size:' + big + 'px">' + Math.round(st.pct) + '%</text>';
        var dt = dayText(st.days);
        if (dt && !r.nd) h += '<text x="' + r.t[0] + '" y="' + (r.t[1] + big - 0.5) + '" class="b-day" style="font-size:' + (big - 3) + 'px">' + dt + '</text>';
      }
      h += '</g>';
    });
    return h + '</svg>';
  }

  function armFigure(regions, state, label) {
    var h = '<svg class="arm-svg" viewBox="0 0 124 236" role="img" aria-label="' + esc(label) + '" xmlns="http://www.w3.org/2000/svg">';
    var wide = 'translate(-21.7 0) scale(1.35 1)';
    h += '<path d="M30 20 C44 8 76 8 92 20 C96 28 94 36 90 38 L34 38 C28 36 26 28 30 20 Z" class="b-neutral" transform="' + wide + '"/>';
    regions.forEach(function (r) {
      var st = state[r.id] || {};
      var hs = heat(st.days);
      h += '<g class="b-g" data-region="' + r.id + '" tabindex="0" role="button" aria-label="' + esc(st.label || r.id) + '"><path d="' + r.d + '" class="b-reg' + (hs.on ? ' on' : '') + '" style="fill:' + hs.fill + '" transform="' + wide + '"/>';
      if (st.pct != null) {
        var tx = 62 + (r.t[0] - 62) * 1.35;
        h += '<text x="' + tx.toFixed(1) + '" y="' + r.t[1] + '" class="b-pct" style="font-size:14px">' + Math.round(st.pct) + '%</text>';
        var dt = dayText(st.days);
        if (dt) h += '<text x="' + tx.toFixed(1) + '" y="' + (r.t[1] + 13) + '" class="b-day" style="font-size:10px">' + dt + '</text>';
      }
      h += '</g>';
    });
    return h + '</svg>';
  }

  function legend() {
    var stops = [0, 1, 2, 3, 4, 5, 6, 7].map(function (d) { return heat(d).fill; });
    return '<div class="b-legend"><span>Trained today</span><span class="b-bar" style="background:linear-gradient(90deg,' + stops.join(',') + ')"></span><span>7+ days</span></div>';
  }

  return {
    front: function (state) { return figure(FRONT_NEUTRAL, FRONT, state, { label: 'Front muscle map' }); },
    back: function (state) { return figure(BACK_NEUTRAL, BACK, state, { label: 'Back muscle map' }); },
    armFront: function (state) { return armFigure(ARM_FRONT, state, 'Front of arm'); },
    armBack: function (state) { return armFigure(ARM_BACK, state, 'Back of arm'); },
    ARM_FRONT: ARM_FRONT, ARM_BACK: ARM_BACK,
    legend: legend, heat: heat, dayText: dayText
  };
});
