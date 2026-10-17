// Vraies polices : contours lus par fontTools (tests/fonts.py) / real fonts
var L = require('./lib'), PE = L.PE, check = L.check, VF = require('./verify');
var fs = require('fs'); if (!fs.existsSync(require('path').join(__dirname, 'fontdata.json'))) { console.log('fontdata.json absent : lancez d\'abord python3 tests/fonts.py / run tests/fonts.py first'); process.exit(0); }
var data = require('./fontdata.json'), rnd = L.mulberry(11), STAT = { glyphs: 0, joints: 0, ok: 0, reduit: 0, impossible: 0, spreadChecked: 0 }, per = {};
data.forEach(function (g) {
  var sh = L.shape(g.contours.map(function (c) { return { pts: c.map(function (q) { return { a: q.a, l: q.l, r: q.r }; }) }; }), false, g.font + ':' + g.ch);
  STAT.glyphs++;
  [['process', 'V', 1.0], ['process', 'U', 1.0], ['process', 'flat', 1.0], ['style', 'V', 0]].forEach(function (cfg) {
    var o = L.opts({ method: cfg[0], form: cfg[1], spread: cfg[2] || 1, depthPct: 25, halfOpen: 12 });
    var X = VF.applyCopy([L.clone(sh)], o);
    VF.verify(g.font + ':' + g.ch + ':' + cfg.join('/'), X, o, rnd);
    var r2 = PE.plan(X.work, o);
    check(VF.trapped(r2).length === 0, 'font idempotent ' + g.font + ' ' + g.ch + ' ' + cfg.join('/'));
    if (cfg[0] === 'process' && cfg[1] === 'V') {
      X.r.joints.forEach(function (j) { STAT.joints++; STAT[j.status] = (STAT[j.status] || 0) + 1; if (j.status === 'ok') STAT.spreadChecked++; });
      per[g.ch] = (per[g.ch] || 0) + X.r.joints.length;
    }
  });
});
console.log('fonts: ' + JSON.stringify(STAT));
console.log('joints per char (12 fonts): ' + JSON.stringify(per));
var s = L.stats(); console.log('fonttest checks ' + s.checks + ', fails ' + s.fails);
process.exit(s.fails ? 1 : 0);
