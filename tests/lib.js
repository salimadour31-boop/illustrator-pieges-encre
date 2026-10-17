// Outils de test communs / shared test helpers
var path = require('path');
var M = require(process.env.PEF || path.join(__dirname, '..', 'PiegesEncre.jsx'));
var PE = M.PE;
var checks = 0, fails = 0;
function check(c, m) { checks++; if (!c) { fails++; console.log('FAIL', m); } }
function P(a, l, r) { return { a: a.slice(), l: (l || a).slice(), r: (r || a).slice() }; }
function poly(arr) { return { pts: arr.map(function (q) { return Array.isArray(q[0]) ? P(q[0], q[1], q[2]) : P(q); }) }; }
function shape(contours, evenodd, id) { return { id: id || 'S', contours: contours, evenodd: !!evenodd, editable: true, label: id || 'S', memo: [] }; }
function clone(sh) { return JSON.parse(JSON.stringify({ id: sh.id, contours: sh.contours.map(function (c) { return { pts: c.pts }; }), evenodd: sh.evenodd, editable: true, label: sh.label, memo: sh.memo })); }
function rev(c) { var p = c.pts.slice().reverse().map(function (q) { return P(q.a, q.r, q.l); }); return { pts: p }; }
function xf(sh, f) { // transformation affine / affine transform
  sh.contours.forEach(function (c) { c.pts.forEach(function (q) { q.a = f(q.a); q.l = f(q.l); q.r = f(q.r); }); }); return sh; }
function rot(ang, cx, cy) { var c = Math.cos(ang), s = Math.sin(ang); return function (p) { var x = p[0] - cx, y = p[1] - cy; return [cx + c * x - s * y, cy + s * x + c * y]; }; }
// Lettres / letters
function V() { return shape([poly([[0,100],[20,100],[50,25],[80,100],[100,100],[60,0],[40,0]])], false, 'V'); }
function W() { return shape([poly([[0,100],[16,100],[30,30],[45,100],[55,100],[70,30],[84,100],[100,100],[80,0],[62,0],[50,60],[38,0],[20,0]])], false, 'W'); }
function Mx() { return shape([poly([[0,0],[0,100],[18,100],[50,40],[82,100],[100,100],[100,0],[84,0],[84,65],[56,12],[44,12],[16,65],[16,0]])], false, 'M'); }
function Nlet() { // n avec arche courbe / n with a curved arch
  return shape([poly([[0,0],[0,70],[15,70],[[15,60],[15,60],[22,68]],[[38,72],[28,72],[52,72]],[[60,52],[60,64],[60,52]],[60,0],[45,0],[[45,50],[45,50],[45,57]],[[35,58],[41,58],[27,58]],[[15,44],[18,53],[15,44]],[15,0]])], false, 'n'); }
function A(evenodd) { var outer = poly([[0,0],[40,100],[60,100],[100,0],[80,0],[72,22],[28,22],[20,0]]); var counter = poly([[34,38],[66,38],[50,80]]);
  return shape([outer, evenodd ? rev(counter) : counter], evenodd, 'A'); }
function star(n, r1, r2, cx, cy, ph, rnd) { var a = []; for (var i = 0; i < 2 * n; i++) { var r = (i % 2 ? r2 : r1) * (rnd ? (0.85 + 0.3 * rnd()) : 1), t = ph + i * Math.PI / n; a.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return shape([poly(a)], false, 'star'); }
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// Géométrie de contrôle / checking geometry
function fineFlat(pts, n) { var out = []; for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length], s = [p.a, p.r, q.l, q.a]; for (var k = 0; k < n; k++) out.push(PE.bezPt(s, k / n)); } return out; }
function distSeg(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1]; return Math.sqrt(x * x + y * y); }
function distPoly(p, polys) { var m = Infinity; polys.forEach(function (P) { for (var j = 0; j < P.length; j++) { var d = distSeg(p, P[j], P[(j + 1) % P.length]); if (d < m) m = d; } }); return m; }
function selfIntersections(poly) { var n = poly.length, c = 0; for (var i = 0; i < n; i++) for (var j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (PE.segX(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) c++; } return c; }
function opts(o) { var d = PE.defaults(); for (var k in (o || {})) d[k] = o[k]; return d; }
module.exports = { PE: PE, M: M, check: check, stats: function () { return { checks: checks, fails: fails }; }, P: P, poly: poly, shape: shape, clone: clone, rev: rev, xf: xf, rot: rot,
  V: V, W: W, Mx: Mx, Nlet: Nlet, A: A, star: star, mulberry: mulberry, fineFlat: fineFlat, distPoly: distPoly, distSeg: distSeg, selfIntersections: selfIntersections, opts: opts };
