// Vérifications génériques partagées / shared generic checks
var L = require('./lib'), PE = L.PE, check = L.check;
function trapped(r) { return r.joints.filter(function (j) { return j.status === 'ok' || j.status === 'reduit'; }); }
function applyCopy(shapes, o) {
  var orig = shapes.map(L.clone), work = shapes.map(L.clone);
  var r = PE.plan(work, o); PE.applyPlan(work, r);
  return { orig: orig, work: work, r: r };
}
// Vérifications génériques d'une application / generic checks of an application
function verify(name, X, o, rnd) {
  var r = X.r, tj = trapped(r);
  X.work.forEach(function (sh, si) {
    var osh = X.orig[si];
    sh.contours.forEach(function (ct, ci) {
      var fl = PE.flatPts(ct.pts);
      var si0 = L.selfIntersections(PE.flatPts(osh.contours[ci].pts));
      check(L.selfIntersections(fl) <= si0, name + ' self-intersection c' + ci);
      // anciens points conservés / old points kept
      var olds = ct.pts.filter(function (p) { return !p.isNew; });
      var trappedHere = tj.filter(function (j) { return j.si === si && j.ci === ci; }).length;
      check(olds.length === osh.contours[ci].pts.length - (ct.changed ? trappedHere : 0), name + ' kept anchors ' + olds.length);
      olds.forEach(function (p) { var ok = osh.contours[ci].pts.some(function (q) { return Math.abs(q.a[0] - p.a[0]) < 1e-9 && Math.abs(q.a[1] - p.a[1]) < 1e-9; }); check(ok, name + ' anchor moved'); });
      // segments hors encoches posés sur l'original / non-notch segments lie on the original
      if (ct.changed) {
        var ofine = [L.fineFlat(osh.contours[ci].pts, 400)], maxd = 0, n = ct.pts.length;
        for (var k = 0; k < n; k++) {
          var p = ct.pts[k], q = ct.pts[(k + 1) % n];
          if (q.isNew && !(q.l[0] === q.a[0] && q.l[1] === q.a[1] && !p.isNew)) { }
          var isNotch = (p.isNew && q.isNew) || (q.isNew && !isOnOrig(q, ofine)) || (p.isNew && !isOnOrig(p, ofine));
          if (isNotch) continue;
          var s = [p.a, p.r, q.l, q.a];
          for (var t = 0; t <= 1; t += 0.125) { var d = L.distPoly(PE.bezPt(s, t), ofine); if (d > maxd) maxd = d; }
        }
        check(maxd < 0.02, name + ' segments off original ' + maxd.toFixed(4));
      }
    });
    // nouvelle forme incluse dans l'ancienne / new shape inside the old one
    var bb = PE.bboxOf(PE.shapePolys(osh)), out = 0, inside = 0;
    for (var k2 = 0; k2 < 400; k2++) {
      var pt = [bb[0] + rnd() * (bb[2] - bb[0]), bb[1] + rnd() * (bb[3] - bb[1])];
      if (PE.inShape(sh, pt)) { inside++; if (!PE.inShape(osh, pt) && L.distPoly(pt, PE.shapePolys(osh)) > 1e-3) out++; }
    }
    check(out === 0, name + ' new shape leaks outside old ' + out);
  });
  // encoches dans la matière d'origine / notches inside the original fill
  tj.forEach(function (j) {
    var T = PE.bezPt([j.V, j.V, j.V, j.V], 0);
    var fr = o.form === 'U' ? 0.6 : 0.98, deep = [j.V[0] + j.u[0] * j.P.d * fr, j.V[1] + j.u[1] * j.P.d * fr];
    check(PE.inScope(X.orig, deep), name + ' notch apex outside original fill');
    check(!PE.inScope(X.work, deep), name + ' notch apex still filled');
    var dV = L.distPoly(j.V, [].concat.apply([], X.work.map(function (s) { return PE.shapePolys(s); })));
    check(!PE.inScope(X.work, [j.V[0] + j.u[0] * 1e-3, j.V[1] + j.u[1] * 1e-3]), name + ' V not opened');
    if (o.method === 'process' && j.status === 'ok') {
      // après engraissement s, le coin dessiné V reste blanc / after spread s the drawn corner stays white
      check(dV >= o.spread * 0.999, name + ' spread not compensated dV=' + dV.toFixed(4) + ' s=' + o.spread.toFixed(4) + ' form=' + o.form);
      check(j.enough === true, name + ' enough flag');
    }
  });
}
var ofineCache = null;
function isOnOrig(p, ofine) { return L.distPoly(p.a, ofine) < 0.02; }

module.exports = { trapped: trapped, applyCopy: applyCopy, verify: verify };
