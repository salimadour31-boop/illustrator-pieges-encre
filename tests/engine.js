// Tests du moteur / engine tests
var L = require('./lib'), PE = L.PE, check = L.check;
var DEG = Math.PI / 180;
var VF = require('./verify'), trapped = VF.trapped, applyCopy = VF.applyCopy, verify = VF.verify;
// 1. Détection / detection
(function () {
  var r = PE.plan([L.V()], L.opts({ spread: 0.5 }));
  check(r.joints.length === 1 && Math.abs(r.joints[0].alpha - 2 * Math.atan(30 / 75) / DEG) < 1e-6, 'V crotch angle');
  check(PE.plan([L.W()], L.opts()).joints.length === 3, 'W 3 crotches');
  check(PE.plan([L.Mx()], L.opts()).joints.length === 3, 'M 3 joints');
  var ra = PE.plan([L.A(true)], L.opts()), rb = PE.plan([L.A(false)], L.opts());
  check(ra.joints.length === 3 && rb.joints.length === 3, 'A counter corners evenodd/nonzero ' + ra.joints.length + '/' + rb.joints.length);
  check(ra.joints.every(function (j) { return j.ci === 1; }), 'A only counter (leg/bar 110° > 100°)');
  var rc = PE.plan([L.A(true)], L.opts({ maxAngle: 120 }));
  check(rc.joints.length === 5, 'A with 120° includes leg/bar joints ' + rc.joints.length);
  var rn = PE.plan([L.Nlet()], L.opts({ maxAngle: 100 }));
  check(rn.joints.length === 1 && rn.joints[0].i === 3, 'n outer shoulder joint');
  var r30 = PE.plan([L.W(), L.xf(L.Mx(), function (p) { return [p[0] + 200, p[1]]; }), L.xf(L.V(), function (p) { return [p[0] + 400, p[1]]; })], L.opts({ maxAngle: 30 }));
  check(r30.joints.length === 5, 'maxAngle 30 filter ' + r30.joints.length);
  // convexes jamais / never convex corners: carré, triangle / square, triangle
  check(PE.plan([L.shape([L.poly([[0,0],[10,0],[10,10],[0,10]])])], L.opts()).joints.length === 0, 'square none');
  check(PE.plan([L.shape([L.poly([[0,0],[10,0],[5,40]])])], L.opts()).joints.length === 0, 'triangle none');
  // Le sens de parcours n'a pas d'effet / path direction has no effect
  var vr = L.shape([L.rev(L.V().contours[0])]);
  check(PE.plan([vr], L.opts()).joints.length === 1, 'reversed V');
  // formes séparées superposées : coin caché ignoré / overlapping separate shapes: hidden corner skipped
  var cover = L.shape([L.poly([[40,15],[60,15],[60,40],[40,40]])], false, 'cover');
  check(PE.plan([L.V(), cover], L.opts()).joints.length === 0, 'covered crotch skipped');
  // points sélectionnés seulement / selected points only
  var w = L.W(); w.contours[0].pts[5].sel = true;
  var rs = PE.plan([w], L.opts({ onlySelected: true }));
  check(rs.joints.length === 1 && rs.joints[0].i === 5, 'only selected');
})();

// 2. Toutes lettres × modes × formes / all letters × modes × forms
var rnd = L.mulberry(7), nA = 0;
['V', 'W', 'Mx', 'Nlet'].concat(['A1', 'A0']).forEach(function (nm) {
  ['process', 'style'].forEach(function (method) {
    ['V', 'U', 'flat'].forEach(function (form) {
      var sh = nm === 'A1' ? L.A(true) : (nm === 'A0' ? L.A(false) : L[nm]());
      var o = L.opts({ method: method, form: form, spread: 0.35, maxAngle: nm === 'Nlet' ? 100 : 100 });
      var X = applyCopy([sh], o);
      check(trapped(X.r).length === X.r.joints.length, nm + ' ' + method + ' ' + form + ' all trapped ' + X.r.joints.map(function (j) { return j.status + ':' + j.reasons; }));
      verify(nm + '/' + method + '/' + form, X, o, rnd); nA++;
      // 2e passage : rien de nouveau / 2nd pass: nothing new
      var r2 = PE.plan(X.work, o);
      check(trapped(r2).length === 0, nm + ' ' + method + ' ' + form + ' idempotent ' + r2.joints.map(function (j) { return j.status; }));
      var r3 = PE.plan(X.work.map(L.clone).map(function (s, i) { s.memo = []; return s; }), o);
      if (form === 'V') check(r3.joints.length > 0, nm + ' ' + form + ' tips visible without memo');
    });
  });
});

// 3. Engraissement simulé : la zone bouchée sans piège / simulated spread: filled zone without trap
(function () {
  var sh = L.V(), o = L.opts({ spread: 0.5 }), j = PE.plan([L.clone(sh)], o).joints[0];
  var polys = PE.shapePolys(sh), fill = o.spread / Math.sin(j.h);
  var pIn = [j.V[0] + j.bis[0] * fill * 0.95, j.V[1] + j.bis[1] * fill * 0.95], pOut = [j.V[0] + j.bis[0] * fill * 1.05, j.V[1] + j.bis[1] * fill * 1.05];
  check(L.distPoly(pIn, polys) < o.spread && L.distPoly(pOut, polys) > o.spread, 'fill length s/sin(h) without trap');
  check(Math.abs(j.P.fill - fill) < 1e-12, 'reported fill length');
  // avec piège : marge = m·s / with trap: clearance = m·s
  var X = applyCopy([sh], o), tj = trapped(X.r)[0];
  var dV = L.distPoly(tj.V, PE.shapePolys(X.work[0]));
  check(Math.abs(dV - o.m * o.spread) < 0.01 * o.spread, 'clearance = m·s ' + dV + ' vs ' + o.m * o.spread);
})();

// 4. Étoiles aléatoires tournées / random rotated stars
var nStar = 0, STAT = {};
for (var it = 0; it < 300; it++) {
  var rr = L.mulberry(1000 + it), n = 3 + Math.floor(rr() * 7), r1 = 40 + rr() * 60, r2 = r1 * (0.25 + rr() * 0.5);
  var st = L.star(n, r1, r2, 0, 0, rr() * 6.28, rr);
  var o = L.opts({ method: rr() < 0.5 ? 'process' : 'style', form: ['V', 'U', 'flat'][Math.floor(rr() * 3)], spread: 0.05 + rr() * 1.5, maxAngle: 170,
                   depthPct: 10 + rr() * 40, halfOpen: 5 + rr() * 20 });
  var X = applyCopy([st], o);
  X.r.joints.forEach(function (j) { STAT[j.status] = (STAT[j.status] || 0) + 1; if (o.method === 'process' && j.status === 'ok') STAT.spreadChecked = (STAT.spreadChecked || 0) + 1; });
  verify('star' + it, X, o, rr);
  var r2p = PE.plan(X.work, o); check(trapped(r2p).length === 0, 'star idempotent ' + it);
  // invariance par rotation / rotation invariance
  var ang = rr() * 6.28, st2 = L.xf(L.clone(st), L.rot(ang, 3, -7));
  var Y = PE.plan([st2], o), a = trapped(X.r), b = trapped(Y);
  check(a.length === b.length, 'rotation count ' + it + ' ' + a.length + '/' + b.length);
  var da = a.map(function (j) { return j.P.dEff; }).sort(), db = b.map(function (j) { return j.P.dEff; }).sort();
  check(da.every(function (v, i) { return Math.abs(v - db[i]) < 1e-6 * Math.max(1, v); }), 'rotation depths ' + it);
  nStar++;
}

// 5. Trou juste sous le creux / hole right below the crotch
(function () {
  var v = L.V(), hole = L.poly([[48,17],[52,17],[52,21],[48,21]]);
  var sh = L.shape([v.contours[0], hole], true, 'Vhole');
  var o = L.opts({ spread: 0.6 });
  var X = applyCopy([sh], o), j = X.r.joints[0];
  check(j.status === 'impossible' || j.reasons.indexOf('croise-reduit') >= 0 || j.reasons.indexOf('epaisseur') >= 0, 'hole avoided ' + j.status + ' ' + j.reasons);
  verify('Vhole', X, o, rnd);
})();

// 6. Bras fins : profondeur limitée, compensation insuffisante signalée / thin arms
(function () {
  var thin = L.shape([L.poly([[0,100],[3,100],[50,8],[97,100],[100,100],[51.5,2],[48.5,2]])], false, 'thinV');
  var o = L.opts({ spread: 2 });
  var X = applyCopy([thin], o), j = X.r.joints[0];
  check(j && (j.status === 'reduit' || j.status === 'impossible') && j.reasons.indexOf('epaisseur') >= 0, 'thin limited ' + (j && j.status) + ' ' + (j && j.reasons));
  if (j && j.status === 'reduit') check(j.enough === false && PE.counts(X.r.joints).insuff === 1, 'insufficient flagged');
  verify('thinV', X, o, rnd);
})();

// 7. Segments courts / short segments
(function () {
  var sh = L.shape([L.poly([[0,0],[0,30],[10,30],[14.5,26],[19,30],[29,30],[29,0]])], false, 'short');
  var o = L.opts({ spread: 2.2 });
  var X = applyCopy([sh], o), j = X.r.joints[0];
  check(j && j.reasons.indexOf('court') >= 0, 'short reason ' + (j && j.reasons));
  verify('short', X, o, rnd);
})();

// 8. Mémoire / memo
(function () {
  var memo = [[0.1, 0.2], [0.5, 0.75]];
  var note = PE.writeMemo('Client : logo v2', memo);
  check(/^Client : logo v2\n\[PiegesEncre\] /.test(note), 'memo appended');
  var back = PE.parseMemo(note);
  check(back.length === 2 && Math.abs(back[1][1] - 0.75) < 1e-9, 'memo parsed');
  var note2 = PE.writeMemo(note, [[0.3, 0.3]]);
  check(PE.parseMemo(note2).length === 1 && note2.indexOf('Client : logo v2') === 0 && note2.split('[PiegesEncre]').length === 2, 'memo replaced');
  check(PE.writeMemo(note, []) === 'Client : logo v2', 'memo removed');
})();

var s = L.stats();
console.log('stars joints: ' + JSON.stringify(STAT));
console.log('engine: ' + nA + ' letter cases, ' + nStar + ' random stars; checks ' + s.checks + ', fails ' + s.fails);
process.exit(s.fails ? 1 : 0);
