(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Data = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function x(id, name, muscle, equip, kind, pattern, rel, reps, inc) {
    return { id: id, name: name, muscle: muscle, equip: equip, kind: kind, pattern: pattern, rel: rel, reps: reps, inc: inc };
  }

  var LIB = [
    x('bench_bb', 'Bench Press (Barbell)', 'chest', ['barbell', 'bench', 'rack'], 'compound', 'hpress', 1, [6, 8], 5),
    x('incline_db', 'Incline Bench Press (Dumbbell)', 'chest', ['dumbbell', 'bench'], 'compound', 'hpress', 0.25, [8, 10], 5),
    x('chest_press_machine', 'Chest Press (Machine)', 'chest', ['machine'], 'compound', 'hpress', 0.85, [8, 12], 5),
    x('incline_smith', 'Incline Bench Press (Smith)', 'chest', ['smith', 'bench'], 'compound', 'hpress', 0.75, [8, 10], 5),

    x('skull_db', 'Skullcrusher (Dumbbell)', 'triceps', ['dumbbell', 'bench'], 'iso', 'triext', 1, [6, 10], 5),
    x('pushdown_cable', 'Single Arm Triceps Pushdown (Cable)', 'triceps', ['cable'], 'iso', 'tripush', 1, [8, 12], 2.5),
    x('skull_bb', 'Skullcrusher (Barbell)', 'triceps', ['barbell', 'bench'], 'iso', 'triext', 1.4, [6, 10], 5),

    x('lat_raise_db', 'Lateral Raise (Dumbbell)', 'shoulders', ['dumbbell'], 'iso', 'latraise', 1, [12, 15], 5),
    x('rear_fly_db', 'Rear Delt Reverse Fly (Dumbbell)', 'shoulders', ['dumbbell'], 'iso', 'reardelt', 1, [10, 15], 5),
    x('ohp_bb', 'Overhead Press (Barbell)', 'shoulders', ['barbell', 'rack'], 'compound', 'vpress', 1, [6, 8], 5),
    x('shoulder_press_machine', 'Shoulder Press (Machine)', 'shoulders', ['machine'], 'compound', 'vpress', 1.1, [8, 12], 5),
    x('lat_raise_cable', 'Lateral Raise (Cable)', 'shoulders', ['cable'], 'iso', 'latraise', 0.5, [12, 15], 2.5),

    x('lat_pulldown', 'Lat Pulldown (Cable)', 'back', ['machine'], 'compound', 'vpull', 1, [8, 12], 5),
    x('row_bent_db', 'Bent Over Row (Dumbbell)', 'back', ['dumbbell'], 'compound', 'row', 0.42, [8, 12], 5),
    x('row_db', 'Dumbbell Row', 'back', ['dumbbell', 'bench'], 'compound', 'row', 0.55, [8, 12], 5),
    x('row_bb', 'Bent Over Row (Barbell)', 'back', ['barbell'], 'compound', 'row', 1, [6, 8], 5),
    x('row_cable_seated', 'Seated Cable Row (Machine)', 'back', ['machine'], 'compound', 'row', 1, [8, 12], 5),

    x('back_ext', 'Back Extension (Weighted Hyperextension)', 'lowback', ['hyper'], 'bw', null, 1, [10, 15], 5),

    x('curl_db', 'Bicep Curl (Dumbbell)', 'biceps', ['dumbbell'], 'iso', 'curl', 1, [8, 12], 5),
    x('curl_bb', 'Barbell Curl', 'biceps', ['barbell'], 'iso', 'curl', 1.9, [8, 12], 5),
    x('curl_cable', 'Cable Curl', 'biceps', ['cable'], 'iso', 'curl', 1.2, [8, 12], 2.5),

    x('rev_curl_cable', 'Reverse Curl (Cable)', 'forearms', ['cable'], 'iso', 'revcurl', 1, [8, 12], 2.5),
    x('wrist_curl', 'Seated Palms Up Wrist Curl', 'forearms', ['dumbbell', 'bench'], 'iso', 'wrist', 1, [10, 15], 2.5),

    x('hack_squat', 'Hack Squat (Machine)', 'quads', ['machine'], 'compound', 'squat', 0.9, [8, 12], 5),
    x('squat_bb', 'Squat (Barbell)', 'quads', ['barbell', 'rack'], 'compound', 'squat', 1, [6, 8], 5),
    x('squat_smith', 'Squat (Smith)', 'quads', ['smith'], 'compound', 'squat', 0.95, [6, 10], 5),
    x('leg_ext', 'Leg Extension (Machine)', 'quads', ['machine'], 'iso', 'legext', 1, [10, 15], 5),

    x('rdl_db', 'Romanian Deadlift (Dumbbell)', 'hamstrings', ['dumbbell'], 'compound', 'hinge', 0.3, [8, 10], 5),
    x('rdl_bb', 'Romanian Deadlift (Barbell)', 'hamstrings', ['barbell'], 'compound', 'hinge', 1, [6, 8], 5),
    x('leg_curl_seated', 'Seated Leg Curl (Machine)', 'hamstrings', ['machine'], 'iso', 'legcurl', 1, [10, 12], 5),

    x('hip_add', 'Hip Adduction (Machine)', 'adductors', ['machine'], 'iso', 'hipadd', 1, [10, 15], 5)
  ];

  var VARIANT = {
    chest_press_machine: 'bench', incline_smith: 'incline_db', incline_db: 'incline_db',
    skull_bb: 'skull_db', shoulder_press_machine: 'ohp_bb', lat_raise_cable: 'lat_raise_db',
    row_bb: 'row_bent_db', curl_bb: 'curl_db', curl_cable: 'curl_db',
    squat_bb: 'hack_squat', squat_smith: 'hack_squat', rdl_bb: 'rdl_db'
  };
  LIB.forEach(function (e) { e.v = VARIANT[e.id] || e.id; });

  var MUSCLE_LABEL = {
    chest: 'Chest', back: 'Back', lowback: 'Lower back', shoulders: 'Shoulders', triceps: 'Triceps',
    biceps: 'Biceps', forearms: 'Forearms', quads: 'Quads', hamstrings: 'Hamstrings', adductors: 'Adductors'
  };

  var MUSCLE_CFG = {
    chest: { target: 12, cap: 8, min: 4 },
    back: { target: 14, cap: 10, min: 4 },
    lowback: { target: 4, cap: 3, min: 2 },
    shoulders: { target: 12, cap: 8, min: 3 },
    triceps: { target: 10, cap: 6, min: 3 },
    biceps: { target: 8, cap: 5, min: 3 },
    forearms: { target: 6, cap: 4, min: 2 },
    quads: { target: 12, cap: 8, min: 4 },
    hamstrings: { target: 10, cap: 6, min: 3 },
    adductors: { target: 6, cap: 4, min: 2 }
  };

  function blk(id, name, muscles) { return { id: id, name: name, muscles: muscles }; }
  var SESSIONS = {
    Push: { blocks: [blk('chest', 'Chest', ['chest']), blk('triceps', 'Triceps', ['triceps']), blk('shoulders', 'Shoulders', ['shoulders'])] },
    Pull: { blocks: [blk('back', 'Back', ['back', 'lowback']), blk('arms', 'Biceps and forearms', ['biceps', 'forearms'])] },
    Legs: { blocks: [blk('quads', 'Quads', ['quads']), blk('hams', 'Hamstrings', ['hamstrings']), blk('adductors', 'Adductors', ['adductors'])] },
    Upper: { blocks: [blk('chest', 'Chest', ['chest']), blk('back', 'Back', ['back']), blk('shoulders', 'Shoulders', ['shoulders']), blk('arms', 'Arms', ['triceps', 'biceps', 'forearms'])] },
    Lower: { blocks: [blk('quads', 'Quads', ['quads']), blk('post', 'Hamstrings and lower back', ['hamstrings', 'lowback']), blk('adductors', 'Adductors', ['adductors'])] }
  };

  function sets(list) {
    return list.map(function (p) { return { w: p[0], r: p[1], rpe: null, flag: false, done: true }; });
  }
  function ex(id, muscle, list) { return { exId: id, muscle: muscle, sets: sets(list), note: '' }; }

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

  return { LIB: LIB, MUSCLE_LABEL: MUSCLE_LABEL, MUSCLE_CFG: MUSCLE_CFG, SESSIONS: SESSIONS, seedSessions: seedSessions };
});
