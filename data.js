(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Data = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function x(id, name, muscle, equip, kind, pattern, rel, reps, inc, also) {
    var o = { id: id, name: name, muscle: muscle, equip: equip, kind: kind, pattern: pattern, rel: rel, reps: reps, inc: inc };
    if (also) o.also = also;
    return o;
  }

  var LIB = [
    x('lat_pulldown', 'Lat Pulldown (Cable)', 'lats', ['cable', 'gym'], 'compound', 'vpull', 1, [8, 12], 5, { midback: 0.5 }),
    x('pulldown_close', 'Close-Grip Pulldown (Cable)', 'lats', ['cable', 'gym'], 'compound', 'vpull', 0.95, [8, 12], 5, { midback: 0.5 }),
    x('pulldown_single', 'Single-Arm Pulldown (Cable)', 'lats', ['cable', 'gym'], 'compound', 'vpull', 0.45, [8, 12], 2.5),
    x('straight_arm', 'Straight-Arm Pulldown (Cable)', 'lats', ['cable'], 'iso', null, 1, [10, 15], 2.5),
    x('pullup', 'Pull-Up', 'lats', ['rack'], 'bw', null, 1, [6, 10], 5, { midback: 0.5 }),
    x('pullover_db', 'Dumbbell Pullover', 'lats', ['dumbbell', 'bench'], 'iso', null, 1, [10, 12], 5),
    x('row_db_lat', 'One-Arm Dumbbell Row (Elbow Tucked)', 'lats', ['dumbbell', 'bench'], 'compound', 'row', 0.55, [8, 12], 5, { midback: 0.5 }),

    x('row_bent_db', 'Bent Over Row (Dumbbell)', 'midback', ['dumbbell'], 'compound', 'row', 0.42, [8, 12], 5, { lats: 0.5 }),
    x('row_bb', 'Bent Over Row (Barbell)', 'midback', ['barbell'], 'compound', 'row', 1, [6, 8], 5, { lats: 0.5 }),
    x('row_pendlay', 'Pendlay Row (Barbell)', 'midback', ['barbell'], 'compound', 'row', 0.9, [5, 8], 5, { lats: 0.5 }),
    x('row_chest_db', 'Chest-Supported Row (Dumbbell)', 'midback', ['dumbbell', 'bench'], 'compound', 'row', 0.5, [8, 12], 5, { lats: 0.5 }),
    x('row_cable_seated', 'Seated Cable Row', 'midback', ['cable', 'gym'], 'compound', 'row', 1, [8, 12], 5, { lats: 0.5 }),
    x('row_wide_cable', 'Wide-Grip Cable Row', 'midback', ['cable', 'gym'], 'compound', 'row', 0.8, [8, 12], 5),
    x('row_chest_machine', 'Chest-Supported Row (Machine)', 'midback', ['machine'], 'compound', 'row', 0.9, [8, 12], 5, { lats: 0.5 }),
    x('row_db', 'Dumbbell Row', 'midback', ['dumbbell', 'bench'], 'compound', 'row', 0.55, [8, 12], 5, { lats: 0.5 }),
    x('row_inverted', 'Inverted Row', 'midback', ['rack'], 'bw', null, 1, [8, 15], 5),
    x('row_seal', 'Seal Row (Barbell)', 'midback', ['barbell', 'bench'], 'compound', 'row', 0.7, [8, 10], 5),

    x('back_ext', 'Back Extension (Weighted Hyperextension)', 'lowback', ['hyper'], 'bw', null, 1, [10, 15], 5),

    x('bench_bb', 'Bench Press (Barbell)', 'chest_flat', ['barbell', 'bench', 'rack'], 'compound', 'hpress', 1, [6, 8], 5, { tri_lat: 0.5 }),
    x('bench_db', 'Bench Press (Dumbbell)', 'chest_flat', ['dumbbell', 'bench'], 'compound', 'hpress', 0.32, [8, 10], 5, { tri_lat: 0.5 }),
    x('chest_press_machine', 'Chest Press (Machine)', 'chest_flat', ['machine'], 'compound', 'hpress', 0.85, [8, 12], 5, { tri_lat: 0.5 }),
    x('cable_fly', 'Cable Fly', 'chest_flat', ['cable'], 'iso', null, 1, [10, 15], 2.5),
    x('dips_chest', 'Dips (Chest)', 'chest_flat', ['gym'], 'bw', null, 1, [8, 12], 5, { tri_lat: 0.5 }),

    x('incline_db', 'Incline Bench Press (Dumbbell)', 'chest_incline', ['dumbbell', 'bench'], 'compound', 'hpress', 0.25, [8, 10], 5, { tri_lat: 0.5 }),
    x('incline_bb', 'Incline Bench Press (Barbell)', 'chest_incline', ['barbell', 'bench', 'rack'], 'compound', 'hpress', 0.8, [6, 8], 5, { tri_lat: 0.5 }),
    x('incline_smith', 'Incline Bench Press (Smith)', 'chest_incline', ['smith', 'bench'], 'compound', 'hpress', 0.75, [8, 10], 5, { tri_lat: 0.5 }),
    x('low_high_fly', 'Low-to-High Cable Fly', 'chest_incline', ['cable'], 'iso', null, 1, [10, 15], 2.5),
    x('incline_fly_db', 'Incline Fly (Dumbbell)', 'chest_incline', ['dumbbell', 'bench'], 'iso', null, 1, [10, 15], 5),

    x('lat_raise_db', 'Lateral Raise (Dumbbell)', 'side_delt', ['dumbbell'], 'iso', 'latraise', 1, [12, 15], 5),
    x('lat_raise_cable', 'Lateral Raise (Cable)', 'side_delt', ['cable'], 'iso', 'latraise', 0.5, [12, 15], 2.5),
    x('lat_raise_lean', 'Leaning Cable Lateral Raise', 'side_delt', ['cable'], 'iso', 'latraise', 0.5, [12, 15], 2.5),
    x('y_raise_cable', 'Cable Y-Raise', 'side_delt', ['cable'], 'iso', null, 1, [12, 15], 2.5),
    x('ohp_bb', 'Overhead Press (Barbell)', 'side_delt', ['barbell', 'rack'], 'compound', 'vpress', 1, [6, 8], 5, { tri_lat: 0.5 }),
    x('shoulder_press_machine', 'Shoulder Press (Machine)', 'side_delt', ['machine'], 'compound', 'vpress', 1.1, [8, 12], 5),

    x('rear_fly_db', 'Rear Delt Reverse Fly (Dumbbell)', 'rear_delt', ['dumbbell'], 'iso', 'reardelt', 1, [10, 15], 5),
    x('rear_fly_chest', 'Chest-Supported Reverse Fly (Dumbbell)', 'rear_delt', ['dumbbell', 'bench'], 'iso', 'reardelt', 0.9, [10, 15], 5),
    x('rear_fly_cable', 'Cable Reverse Fly', 'rear_delt', ['cable'], 'iso', null, 1, [10, 15], 2.5),
    x('face_pull', 'Face Pull (Cable)', 'rear_delt', ['cable'], 'iso', null, 1, [12, 15], 2.5, { midback: 0.5 }),

    x('skull_db', 'Skullcrusher (Dumbbell)', 'tri_long', ['dumbbell', 'bench'], 'iso', 'triext', 1, [6, 10], 5),
    x('skull_bb', 'Skullcrusher (Barbell)', 'tri_long', ['barbell', 'bench'], 'iso', 'triext', 1.4, [6, 10], 5),
    x('overhead_cable', 'Overhead Cable Extension (Rope)', 'tri_long', ['cable'], 'iso', null, 1, [8, 12], 2.5),
    x('overhead_db', 'Overhead Dumbbell Extension', 'tri_long', ['dumbbell'], 'iso', null, 1, [8, 12], 5),

    x('pushdown_cable', 'Single Arm Triceps Pushdown (Cable)', 'tri_lat', ['cable'], 'iso', 'tripush', 1, [8, 12], 2.5),
    x('pushdown_rope', 'Rope Pushdown (Cable)', 'tri_lat', ['cable'], 'iso', 'tripush', 1.6, [8, 12], 2.5),
    x('close_grip_bench', 'Close-Grip Bench Press', 'tri_lat', ['barbell', 'bench', 'rack'], 'compound', 'hpress', 0.85, [6, 8], 5, { chest_flat: 0.5 }),
    x('dips_tri', 'Dips (Triceps)', 'tri_lat', ['gym'], 'bw', null, 1, [8, 12], 5),

    x('curl_incline', 'Incline Dumbbell Curl', 'bi_long', ['dumbbell', 'bench'], 'iso', 'curl', 0.8, [8, 12], 5),
    x('curl_bayesian', 'Behind-the-Body Cable Curl', 'bi_long', ['cable'], 'iso', 'curl', 1, [8, 12], 2.5),
    x('curl_drag', 'Drag Curl (Barbell)', 'bi_long', ['barbell'], 'iso', 'curl', 1.6, [8, 12], 5),

    x('curl_db', 'Bicep Curl (Dumbbell)', 'bi_short', ['dumbbell'], 'iso', 'curl', 1, [8, 12], 5),
    x('curl_preacher', 'Preacher Curl (Dumbbell)', 'bi_short', ['dumbbell', 'bench'], 'iso', 'curl', 0.85, [8, 12], 5),
    x('curl_spider', 'Spider Curl (Dumbbell)', 'bi_short', ['dumbbell', 'bench'], 'iso', 'curl', 0.8, [8, 12], 5),
    x('curl_cable', 'Cable Curl', 'bi_short', ['cable'], 'iso', 'curl', 1.2, [8, 12], 2.5),
    x('curl_bb', 'Barbell Curl', 'bi_short', ['barbell'], 'iso', 'curl', 1.9, [8, 12], 5),
    x('curl_ez', 'EZ-Bar Curl', 'bi_short', ['barbell'], 'iso', 'curl', 1.7, [8, 12], 5),

    x('rev_curl_cable', 'Reverse Curl (Cable)', 'forearms', ['cable'], 'iso', 'revcurl', 1, [8, 12], 2.5),
    x('rev_curl_bb', 'Reverse Curl (Barbell)', 'forearms', ['barbell'], 'iso', 'revcurl', 1.6, [8, 12], 5),
    x('wrist_curl', 'Seated Palms Up Wrist Curl', 'forearms', ['dumbbell', 'bench'], 'iso', 'wrist', 1, [10, 15], 2.5),
    x('wrist_rev', 'Reverse Wrist Curl (Dumbbell)', 'forearms', ['dumbbell', 'bench'], 'iso', 'wrist', 0.6, [10, 15], 2.5),
    x('hammer_curl', 'Hammer Curl (Dumbbell)', 'forearms', ['dumbbell'], 'iso', 'curl', 1.05, [8, 12], 5),

    x('hack_squat', 'Hack Squat (Machine)', 'quads', ['machine'], 'compound', 'squat', 0.9, [8, 12], 5),
    x('squat_bb', 'Squat (Barbell)', 'quads', ['barbell', 'rack'], 'compound', 'squat', 1, [6, 8], 5),
    x('front_squat', 'Front Squat (Barbell)', 'quads', ['barbell', 'rack'], 'compound', 'squat', 0.8, [6, 8], 5),
    x('squat_smith', 'Squat (Smith)', 'quads', ['smith'], 'compound', 'squat', 0.95, [6, 10], 5),
    x('leg_press', 'Leg Press (Machine)', 'quads', ['machine'], 'compound', 'squat', 1.7, [8, 12], 10),
    x('split_squat_db', 'Bulgarian Split Squat (Dumbbell)', 'quads', ['dumbbell', 'bench'], 'compound', 'squat', 0.3, [8, 10], 5),
    x('leg_ext', 'Leg Extension (Machine)', 'quads', ['machine'], 'iso', 'legext', 1, [10, 15], 5),

    x('rdl_db', 'Romanian Deadlift (Dumbbell)', 'hamstrings', ['dumbbell'], 'compound', 'hinge', 0.3, [8, 10], 5),
    x('rdl_bb', 'Romanian Deadlift (Barbell)', 'hamstrings', ['barbell'], 'compound', 'hinge', 1, [6, 8], 5),
    x('good_morning', 'Good Morning (Barbell)', 'hamstrings', ['barbell', 'rack'], 'compound', 'hinge', 0.6, [8, 10], 5),
    x('sldl_db', 'Single-Leg RDL (Dumbbell)', 'hamstrings', ['dumbbell'], 'compound', 'hinge', 0.2, [8, 10], 5),
    x('leg_curl_seated', 'Seated Leg Curl (Machine)', 'hamstrings', ['machine'], 'iso', 'legcurl', 1, [10, 12], 5),
    x('leg_curl_lying', 'Lying Leg Curl (Machine)', 'hamstrings', ['machine'], 'iso', 'legcurl', 1, [10, 12], 5),
    x('nordic', 'Nordic Curl', 'hamstrings', ['any'], 'bw', null, 1, [4, 8], 5),

    x('hip_add', 'Hip Adduction (Machine)', 'adductors', ['machine'], 'iso', 'hipadd', 1, [10, 15], 5),
    x('cable_adduct', 'Cable Hip Adduction', 'adductors', ['cable'], 'iso', null, 1, [10, 15], 2.5),
    x('copenhagen', 'Copenhagen Plank', 'adductors', ['bench'], 'bw', null, 1, [15, 30], 5)
  ];

  var VARIANT = {
    pulldown_close: 'pulldown', lat_pulldown: 'pulldown',
    row_bb: 'row_bent', row_bent_db: 'row_bent', row_chest_db: 'row_chest', row_chest_machine: 'row_chest',
    bench_db: 'bench_press', bench_bb: 'bench_press', chest_press_machine: 'bench_press',
    incline_db: 'incline_press', incline_bb: 'incline_press', incline_smith: 'incline_press',
    lat_raise_cable: 'latraise_cable', lat_raise_lean: 'latraise_cable',
    ohp_bb: 'ohp', shoulder_press_machine: 'ohp',
    rear_fly_chest: 'rearfly', rear_fly_db: 'rearfly',
    skull_bb: 'skull', skull_db: 'skull', overhead_cable: 'overhead_ext', overhead_db: 'overhead_ext',
    pushdown_rope: 'pushdown', pushdown_cable: 'pushdown',
    curl_bb: 'curl_bar', curl_ez: 'curl_bar',
    rev_curl_bb: 'revcurl', rev_curl_cable: 'revcurl',
    hack_squat: 'squat_pattern', squat_bb: 'squat_pattern', squat_smith: 'squat_pattern', front_squat: 'squat_pattern',
    rdl_db: 'rdl', rdl_bb: 'rdl',
    leg_curl_seated: 'legcurl', leg_curl_lying: 'legcurl'
  };
  LIB.forEach(function (e) { e.v = VARIANT[e.id] || e.id; });

  var MUSCLE_LABEL = {
    lats: 'Lats', midback: 'Mid-back', lowback: 'Lower back',
    chest_flat: 'Chest (flat)', chest_incline: 'Chest (incline)',
    side_delt: 'Side delts', rear_delt: 'Rear delts',
    tri_long: 'Triceps long head', tri_lat: 'Triceps lateral',
    bi_long: 'Biceps long head', bi_short: 'Biceps short head',
    forearms: 'Forearms', quads: 'Quads', hamstrings: 'Hamstrings', adductors: 'Adductors', glutes: 'Glutes'
  };

  var GLUTE = { hack_squat: 0.5, squat_bb: 0.5, front_squat: 0.5, squat_smith: 0.5, leg_press: 0.5, split_squat_db: 1, rdl_db: 1, rdl_bb: 1, good_morning: 1, sldl_db: 1 };

  var MUSCLE_CFG = {
    lats: { target: 10, cap: 6, min: 3 },
    midback: { target: 10, cap: 6, min: 3 },
    lowback: { target: 4, cap: 3, min: 2 },
    chest_flat: { target: 10, cap: 6, min: 3 },
    chest_incline: { target: 10, cap: 6, min: 3 },
    side_delt: { target: 10, cap: 6, min: 3 },
    rear_delt: { target: 8, cap: 5, min: 2 },
    tri_long: { target: 8, cap: 5, min: 2 },
    tri_lat: { target: 8, cap: 5, min: 2 },
    bi_long: { target: 8, cap: 5, min: 2 },
    bi_short: { target: 8, cap: 5, min: 2 },
    forearms: { target: 6, cap: 4, min: 2 },
    quads: { target: 8, cap: 6, min: 3 },
    hamstrings: { target: 8, cap: 6, min: 3 },
    adductors: { target: 6, cap: 4, min: 2 }
  };

  var OLD_MUSCLE = { chest: 1, back: 1, shoulders: 1, triceps: 1, biceps: 1 };
  function subFor(oldMuscle, name) {
    var n = String(name || '');
    if (oldMuscle === 'chest') return /incline/i.test(n) ? 'chest_incline' : 'chest_flat';
    if (oldMuscle === 'back') return /pulldown|pull-up|pullup|chin|lat /i.test(n) ? 'lats' : 'midback';
    if (oldMuscle === 'shoulders') return /rear|reverse|face/i.test(n) ? 'rear_delt' : 'side_delt';
    if (oldMuscle === 'triceps') return /overhead|skull|extension/i.test(n) ? 'tri_long' : 'tri_lat';
    if (oldMuscle === 'biceps') return /incline|bayesian|behind|drag/i.test(n) ? 'bi_long' : 'bi_short';
    return oldMuscle;
  }

  function blk(id, name, muscles) { return { id: id, name: name, muscles: muscles }; }
  var SESSIONS = {
    Push: { blocks: [blk('chest', 'Chest', ['chest_flat', 'chest_incline']), blk('triceps', 'Triceps', ['tri_long', 'tri_lat']), blk('shoulders', 'Shoulders', ['side_delt', 'rear_delt'])] },
    Pull: { blocks: [blk('back', 'Back', ['lats', 'midback', 'lowback']), blk('arms', 'Biceps and forearms', ['bi_long', 'bi_short', 'forearms'])] },
    Legs: { blocks: [blk('quads', 'Quads', ['quads']), blk('hams', 'Hamstrings', ['hamstrings']), blk('adductors', 'Adductors', ['adductors'])] },
    Upper: { blocks: [blk('chest', 'Chest', ['chest_flat', 'chest_incline']), blk('back', 'Back', ['lats', 'midback']), blk('shoulders', 'Shoulders', ['side_delt', 'rear_delt']), blk('arms', 'Arms', ['tri_long', 'tri_lat', 'bi_long', 'bi_short', 'forearms'])] },
    Lower: { blocks: [blk('quads', 'Quads', ['quads']), blk('post', 'Hamstrings and lower back', ['hamstrings', 'lowback']), blk('adductors', 'Adductors', ['adductors'])] }
  };

  function sets(list) {
    return list.map(function (p) { return { w: p[0], r: p[1], rpe: null, flag: false, done: true }; });
  }
  var BY_ID = {};
  LIB.forEach(function (e) { BY_ID[e.id] = e; });
  function ex(id, muscle, list) { return { exId: id, muscle: BY_ID[id] ? BY_ID[id].muscle : muscle, sets: sets(list), note: '' }; }

  function seedSessions() {
    return [
      {
        id: 'seed-push', seed: true, type: 'Push', date: null, finished: true, loc: 'gym', fed: 'fed', bucket: 'afternoon',
        exercises: [
          ex('bench_bb', 'chest', [[205, 9]]),
          ex('incline_db', 'chest', [[50, 10], [50, 11], [50, 7]]),
          ex('skull_db', 'triceps', [[70, 13], [70, 7], [70, 7]]),
          ex('pushdown_cable', 'triceps', [[30, 7], [30, 6], [30, 4]]),
          ex('lat_raise_db', 'shoulders', [[50, 15], [50, 13], [50, 11]]),
          ex('rear_fly_db', 'shoulders', [[45, 10], [45, 10], [45, 6]])
        ]
      },
      {
        id: 'seed-pull', seed: true, type: 'Pull', date: '2026-10-08T12:00:00', finished: true, loc: 'gym', fed: 'fed', bucket: 'midday',
        exercises: [
          ex('lat_pulldown', 'back', [[160, 10], [160, 6], [160, 6]]),
          ex('row_bent_db', 'back', [[60, 12], [60, 8], [60, 7]]),
          ex('row_db', 'back', [[75, 9], [75, 6], [75, 6]]),
          ex('back_ext', 'lowback', [[0, 11], [0, 6], [0, 4]]),
          ex('curl_db', 'biceps', [[35, 15], [35, 9], [35, 6]]),
          ex('rev_curl_cable', 'forearms', [[42.5, 10], [42.5, 8], [42.5, 11]]),
          ex('wrist_curl', 'forearms', [[17.5, 11], [17.5, 9], [17.5, 11]])
        ]
      },
      {
        id: 'seed-legs', seed: true, type: 'Legs', date: '2026-09-17T12:00:00', finished: true, loc: 'gym', fed: 'fed', bucket: 'midday',
        exercises: [
          ex('hack_squat', 'quads', [[185, 12], [185, 10], [185, 9]]),
          ex('rdl_db', 'hamstrings', [[50, 7], [50, 6], [50, 4]]),
          ex('leg_ext', 'quads', [[220, 11], [220, 8], [220, 6]]),
          ex('hip_add', 'adductors', [[250, 10], [250, 9], [250, 9]])
        ]
      }
    ];
  }

  return { GLUTE: GLUTE, LIB: LIB, MUSCLE_LABEL: MUSCLE_LABEL, MUSCLE_CFG: MUSCLE_CFG, SESSIONS: SESSIONS, seedSessions: seedSessions, subFor: subFor, OLD_MUSCLE: OLD_MUSCLE };
});
