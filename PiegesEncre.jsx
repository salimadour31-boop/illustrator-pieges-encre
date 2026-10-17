//@target illustrator
/*
 * PiegesEncre.jsx — v1.0.0 (2026-10-17)
 * Auteur / Author : Amirouche Amwanes — Licence MIT (voir LICENSE)
 * https://github.com/salimadour31-boop/illustrator-pieges-encre
 *
 * FR — Pose automatiquement des PIÈGES À ENCRE (ink traps) dans les jonctions
 *      aiguës (creux) des lettrages, logos et pictos VECTORISÉS : repère chaque
 *      coin rentrant où l'encre va boucher (creux du V, du W, du M, jonction de
 *      l'arche et du fût du n, du m, du h, contreformes pointues du A…), puis
 *      creuse une encoche le long de la bissectrice, en V, en U ou à fond plat.
 *      Taille calculée selon le PROCÉDÉ (engraissement de l'encre par bord et
 *      taille réelle d'impression) : après engraissement, le coin dessiné
 *      redevient net. Ou mode STYLE (pièges visibles, % de l'épaisseur du fût).
 *      Analyser avec aperçu des encoches, zones qui vont boucher, repères sur un
 *      calque non imprimable, copie des originaux, rapport .txt.
 * EN — Automatically adds INK TRAPS to the acute (concave) joints of OUTLINED
 *      lettering, logos and icons: finds every inner corner where ink will fill
 *      in (crotch of V/W/M, arch-to-stem joint of n/m/h, pointed counters of A…)
 *      and cuts a notch along the bisector — V-shaped, U-shaped or flat-bottomed.
 *      Size computed from the PRINT PROCESS (ink spread per edge and real printed
 *      size) so that the drawn corner is sharp again after spreading; or STYLE
 *      mode (visible traps, % of the stem width). Analyse with notch preview,
 *      fill-in zones, non-printing markers layer, backup copy, .txt report.
 *
 * Code 100 % original. Aucun appel réseau, aucune collecte de données.
 * 100% original code. No network access, no data collection.
 * Travaillez sur une copie du fichier. / Work on a copy of your file.
 * Statut : non testé dans Illustrator (voir README). / Not tested in Illustrator.
 */
// ============================================================================
//  MOTEUR GÉOMÉTRIQUE (fonctions pures, sans DOM Illustrator)
//  GEOMETRY ENGINE (pure functions, no Illustrator DOM)
//  Unités internes : points (pt). Internal units: points.
// ============================================================================
var PE = (function () {
    var DEG = Math.PI / 180;
    var MEMO_TAG = '[PiegesEncre]';

    // --- Vecteurs / vectors -------------------------------------------------
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
    function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
    function mul(a, k) { return [a[0] * k, a[1] * k]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
    function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
    function vlen(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1]); }
    function dist(a, b) { return vlen(sub(a, b)); }
    function unit(a) { var l = vlen(a); return l > 0 ? [a[0] / l, a[1] / l] : [0, 0]; }
    function perp(a) { return [-a[1], a[0]]; }
    function cp(a) { return [a[0], a[1]]; }
    function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

    // --- Bézier cubique / cubic Bézier ----------------------------------------
    function bezPt(s, t) {
        var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        return [a * s[0][0] + b * s[1][0] + c * s[2][0] + d * s[3][0],
                a * s[0][1] + b * s[1][1] + c * s[2][1] + d * s[3][1]];
    }
    function bezD(s, t) {
        var u = 1 - t, a = 3 * u * u, b = 6 * u * t, c = 3 * t * t;
        return [a * (s[1][0] - s[0][0]) + b * (s[2][0] - s[1][0]) + c * (s[3][0] - s[2][0]),
                a * (s[1][1] - s[0][1]) + b * (s[2][1] - s[1][1]) + c * (s[3][1] - s[2][1])];
    }
    // Découpe de De Casteljau / De Casteljau split
    function split(s, t) {
        var p01 = lerp(s[0], s[1], t), p12 = lerp(s[1], s[2], t), p23 = lerp(s[2], s[3], t);
        var p012 = lerp(p01, p12, t), p123 = lerp(p12, p23, t), m = lerp(p012, p123, t);
        return [[cp(s[0]), p01, p012, m], [cp(m), p123, p23, cp(s[3])]];
    }
    // Morceau [t0, t1] d'une cubique / piece [t0, t1] of a cubic
    function subBez(s, t0, t1) {
        var r = [cp(s[0]), cp(s[1]), cp(s[2]), cp(s[3])];
        if (t0 > 0) { r = split(r, t0)[1]; }
        if (t1 < 1) {
            var tt = t0 > 0 ? (t1 - t0) / (1 - t0) : t1;
            r = split(r, clamp(tt, 0, 1))[0];
        }
        return r;
    }
    function isLine(s) {
        var ch = sub(s[3], s[0]), L = vlen(ch);
        if (L < 1e-9) { return vlen(sub(s[1], s[0])) < 1e-9 && vlen(sub(s[2], s[3])) < 1e-9; }
        var tol = 1e-6 * Math.max(1, L);
        return Math.abs(cross(sub(s[1], s[0]), ch)) / L < tol && Math.abs(cross(sub(s[2], s[0]), ch)) / L < tol &&
               dot(sub(s[1], s[0]), ch) >= -tol && dot(sub(s[2], s[3]), ch) <= tol;
    }
    // Table des longueurs d'arc / arc-length table
    function lenTable(s) {
        // Toujours échantillonner : une droite à poignées rentrées n'est pas paramétrée à vitesse constante.
        // Always sample: a straight line with retracted handles is not parametrised at constant speed.
        var n = 64, ts = [0], ls = [0], prev = s[0], acc = 0, i;
        for (i = 1; i <= n; i++) {
            var t = i / n, p = bezPt(s, t);
            acc += dist(p, prev); prev = p; ts.push(t); ls.push(acc);
        }
        return { ts: ts, ls: ls, total: acc };
    }
    function tAtLen(tb, L) {
        if (L <= 0) { return 0; }
        if (L >= tb.total) { return 1; }
        var lo = 0, hi = tb.ls.length - 1;
        while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (tb.ls[mid] < L) { lo = mid; } else { hi = mid; } }
        var span = tb.ls[hi] - tb.ls[lo], f = span > 0 ? (L - tb.ls[lo]) / span : 0;
        return tb.ts[lo] + (tb.ts[hi] - tb.ts[lo]) * f;
    }
    function segOf(ct, i) {
        var n = ct.pts.length, p = ct.pts[(i + n) % n], q = ct.pts[(i + 1) % n];
        return [p.a, p.r, q.l, q.a];
    }

    // --- Aplatissement et tests de position / flattening and point tests -------
    function flatSeg(s, out) {
        if (isLine(s)) { out.push(cp(s[0])); return; }
        var ctrl = dist(s[0], s[1]) + dist(s[1], s[2]) + dist(s[2], s[3]);
        var n = clamp(Math.ceil(ctrl / 2), 8, 48), k;
        for (k = 0; k < n; k++) { out.push(bezPt(s, k / n)); }
    }
    function flatPts(pts) {
        var out = [], n = pts.length, i;
        for (i = 0; i < n; i++) { var p = pts[i], q = pts[(i + 1) % n]; flatSeg([p.a, p.r, q.l, q.a], out); }
        return out;
    }
    function bboxOf(polys) {
        var b = [Infinity, Infinity, -Infinity, -Infinity], i, j;
        for (i = 0; i < polys.length; i++) {
            for (j = 0; j < polys[i].length; j++) {
                var p = polys[i][j];
                if (p[0] < b[0]) { b[0] = p[0]; } if (p[1] < b[1]) { b[1] = p[1]; }
                if (p[0] > b[2]) { b[2] = p[0]; } if (p[1] > b[3]) { b[3] = p[1]; }
            }
        }
        return b;
    }
    function shapePolys(sh) {
        if (!sh._polys) {
            var ps = [], c;
            for (c = 0; c < sh.contours.length; c++) { ps.push(flatPts(sh.contours[c].pts)); }
            sh._polys = ps; sh._bb = bboxOf(ps);
        }
        return sh._polys;
    }
    function inShape(sh, p) {
        var polys = shapePolys(sh), bb = sh._bb;
        if (p[0] < bb[0] || p[0] > bb[2] || p[1] < bb[1] || p[1] > bb[3]) { return false; }
        var w = 0, cr = 0, i, j;
        for (i = 0; i < polys.length; i++) {
            var P = polys[i], n = P.length;
            for (j = 0; j < n; j++) {
                var a = P[j], b = P[(j + 1) % n];
                if ((a[1] > p[1]) !== (b[1] > p[1])) {
                    var x = a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1]);
                    if (p[0] < x) { cr++; w += (b[1] > a[1]) ? 1 : -1; }
                }
            }
        }
        return sh.evenodd ? (cr % 2 === 1) : (w !== 0);
    }
    function inScope(shapes, p) {
        var i;
        for (i = 0; i < shapes.length; i++) { if (inShape(shapes[i], p)) { return true; } }
        return false;
    }
    function raySeg(o, d, a, b) {
        var e = sub(b, a), den = cross(d, e);
        if (Math.abs(den) < 1e-14) { return -1; }
        var w = sub(a, o), t = cross(w, e) / den, u = cross(w, d) / den;
        return (t >= 0 && u >= -1e-12 && u <= 1 + 1e-12) ? t : -1;
    }
    // Distance jusqu'à la sortie réelle de la matière (union des formes)
    // Distance to the real exit from the fill (union of the shapes)
    function rayExit(shapes, o, d, minT) {
        var ts = [], i, c, j;
        for (i = 0; i < shapes.length; i++) {
            var polys = shapePolys(shapes[i]);
            for (c = 0; c < polys.length; c++) {
                var P = polys[c], n = P.length;
                for (j = 0; j < n; j++) {
                    var t = raySeg(o, d, P[j], P[(j + 1) % n]);
                    if (t > minT) { ts.push(t); }
                }
            }
        }
        ts.sort(function (x, y) { return x - y; });
        for (i = 0; i < ts.length && i < 24; i++) {
            var nx = i + 1 < ts.length ? ts[i + 1] : ts[i] + 1;
            var probe = add(o, mul(d, ts[i] + Math.min(1e-3, (nx - ts[i]) / 2)));
            if (!inScope(shapes, probe)) { return ts[i]; }
        }
        return ts.length ? ts[ts.length - 1] : Infinity;
    }
    // Intersection propre de deux segments / proper intersection of two segments
    function segX(p1, p2, q1, q2) {
        var r = sub(p2, p1), s = sub(q2, q1), den = cross(r, s);
        if (Math.abs(den) < 1e-14) { return false; }
        var w = sub(q1, p1), t = cross(w, s) / den, u = cross(w, r) / den, e = 1e-7;
        return t > e && t < 1 - e && u > e && u < 1 - e;
    }

    // --- Mémoire des pièges déjà posés (note de l'objet) ----------------------
    // --- Memory of traps already cut (object note) ------------------------------
    function parseMemo(note) {
        var out = [], s = String(note || ''), k = s.indexOf(MEMO_TAG);
        if (k < 0) { return out; }
        var line = s.substring(k + MEMO_TAG.length).split('\n')[0].split('\r')[0];
        var parts = line.split(';'), i;
        for (i = 0; i < parts.length; i++) {
            var xy = parts[i].replace(/^\s+|\s+$/g, '').split(',');
            if (xy.length === 2) {
                var x = parseFloat(xy[0]), y = parseFloat(xy[1]);
                if (!isNaN(x) && !isNaN(y)) { out.push([x, y]); }
            }
        }
        return out;
    }
    function writeMemo(note, list) {
        var s = String(note || ''), k = s.indexOf(MEMO_TAG);
        if (k >= 0) {
            var end = s.indexOf('\n', k);
            s = s.substring(0, k) + (end >= 0 ? s.substring(end + 1) : '');
            s = s.replace(/\s+$/, '');
        }
        if (!list.length) { return s; }
        var parts = [], i;
        for (i = 0; i < list.length; i++) { parts.push(list[i][0].toFixed(6) + ',' + list[i][1].toFixed(6)); }
        return (s ? s + '\n' : '') + MEMO_TAG + ' ' + parts.join(';');
    }
    function normPt(bb, p) {
        var w = Math.max(bb[2] - bb[0], 1e-9), h = Math.max(bb[3] - bb[1], 1e-9);
        return [(p[0] - bb[0]) / w, (p[1] - bb[1]) / h];
    }
    function isMemo(sh, p) {
        if (!sh.memo || !sh.memo.length) { return false; }
        shapePolys(sh);
        var q = normPt(sh._bb, p), i;
        for (i = 0; i < sh.memo.length; i++) {
            if (Math.abs(sh.memo[i][0] - q[0]) < 2e-4 && Math.abs(sh.memo[i][1] - q[1]) < 2e-4) { return true; }
        }
        return false;
    }

    // --- Repérage des jonctions / joint detection ------------------------------
    function tangents(ct, i) {
        var n = ct.pts.length, P = ct.pts[i], prev = ct.pts[(i - 1 + n) % n], next = ct.pts[(i + 1) % n];
        var tin = sub(P.a, P.l);
        if (vlen(tin) < 1e-7) { tin = sub(P.a, prev.r); }
        if (vlen(tin) < 1e-7) { tin = sub(P.a, prev.a); }
        var tout = sub(P.r, P.a);
        if (vlen(tout) < 1e-7) { tout = sub(next.l, P.a); }
        if (vlen(tout) < 1e-7) { tout = sub(next.a, P.a); }
        return { e1: unit(mul(tin, -1)), e2: unit(tout) };
    }
    function pointAlong(seg, tb, fromEnd, L) {
        var t = fromEnd ? tAtLen(tb, tb.total - L) : tAtLen(tb, L);
        var d = bezD(seg, t);
        if (vlen(d) < 1e-9) { d = sub(seg[3], seg[0]); }
        return { p: bezPt(seg, t), tg: unit(d) };
    }
    // Épaisseur du bras le long d'un bord / arm thickness along an edge
    function armWidth(shapes, seg, tb, fromEnd, L) {
        var m = Math.min(0.25 * tb.total, 0.5 * L);
        if (!(m > 0)) { return Infinity; }
        var q = pointAlong(seg, tb, fromEnd, m), n = perp(q.tg), tiny = Math.max(1e-4, 1e-3 * tb.total);
        if (!inScope(shapes, add(q.p, mul(n, tiny)))) { n = mul(n, -1); }
        if (!inScope(shapes, add(q.p, mul(n, tiny)))) { return Infinity; }
        return rayExit(shapes, q.p, n, tiny);
    }
    function findJoints(shapes, o) {
        var out = [], si, c, i;
        for (si = 0; si < shapes.length; si++) {
            var sh = shapes[si];
            if (sh.editable === false && !o.analyseAll) { continue; }
            for (c = 0; c < sh.contours.length; c++) {
                var ct = sh.contours[c], n = ct.pts.length;
                if (n < 3) { continue; }
                for (i = 0; i < n; i++) {
                    if (o.onlySelected && !ct.pts[i].sel) { continue; }
                    var segIn = segOf(ct, i - 1), segOut = segOf(ct, i);
                    var tbIn = lenTable(segIn), tbOut = lenTable(segOut);
                    if (tbIn.total < 1e-6 || tbOut.total < 1e-6) { continue; }
                    var tg = tangents(ct, i), V = ct.pts[i].a;
                    var theta = Math.acos(clamp(dot(tg.e1, tg.e2), -1, 1));
                    if (theta > Math.PI - o.minTurn * DEG || theta < 0.5 * DEG) { continue; }
                    var bis = unit(add(tg.e1, tg.e2));
                    var eps = Math.max(1e-4, Math.min(0.02 * Math.min(tbIn.total, tbOut.total), 0.05));
                    if (inScope(shapes, add(V, mul(bis, eps)))) { continue; }      // côté blanc ? / white side?
                    if (!inScope(shapes, sub(V, mul(bis, eps)))) { continue; }     // matière en face / fill opposite
                    var alpha = theta / DEG;
                    if (alpha > o.maxAngle) { continue; }
                    var J = { shape: sh, si: si, ci: c, i: i, V: cp(V), e1: tg.e1, e2: tg.e2, bis: bis, u: mul(bis, -1),
                              alpha: alpha, h: theta / 2, lenIn: tbIn.total, lenOut: tbOut.total, status: 'todo', reasons: [] };
                    if (o.skipMemo && isMemo(sh, V)) { J.status = 'deja'; out.push(J); continue; }
                    var tiny = Math.max(1e-4, 1e-3 * Math.min(tbIn.total, tbOut.total));
                    J.L = rayExit(shapes, add(V, mul(J.u, tiny)), J.u, 0) + tiny;
                    var w1 = armWidth(shapes, segIn, tbIn, true, J.L), w2 = armWidth(shapes, segOut, tbOut, false, J.L);
                    J.stemW = Math.min(w1, w2);
                    if (!isFinite(J.stemW)) { J.stemW = isFinite(J.L) ? J.L : 0; }
                    out.push(J);
                }
            }
        }
        return out;
    }

    // --- Dimensionnement d'un piège / sizing one trap ---------------------------
    function planJoint(J, o) {
        var h = J.h, d, g, P = { form: o.form, r: 0, wb: 0, f: 1 };
        if (o.method === 'process') {
            var s = o.spread;
            d = o.k * s / Math.sin(h);
            var sg = o.m * s / d, gMax = 0.8 * h;
            if (sg > Math.sin(gMax)) { d = o.m * s / Math.sin(gMax); sg = Math.sin(gMax); }
            g = Math.asin(sg);
            P.fill = s / Math.sin(h);                 // zone bouchée sans piège / filled length without trap
            P.kite = [cp(J.V), add(J.V, mul(J.e1, s / Math.tan(h))), add(J.V, mul(J.bis, P.fill)), add(J.V, mul(J.e2, s / Math.tan(h)))];
        } else {
            d = o.depthPct / 100 * J.stemW;
            g = Math.min(o.halfOpen * DEG, 0.8 * h);
        }
        P.d = d; P.g = g;
        P.dEff = d;
        if (o.form === 'U') { P.r = 0.45 * d * Math.tan(g); P.dEff = d + P.r * (1 / Math.sin(g) - 1); }
        else if (o.form === 'flat') { P.wb = 0.5 * d * Math.tan(g); }
        var den = Math.sin(h) - Math.tan(g) * Math.cos(h);
        P.a = den > 1e-9 ? P.dEff * Math.tan(g) / den : Infinity;
        var maxD = o.maxDepthRatio * J.L;
        if (isFinite(J.stemW) && J.stemW > 0) { maxD = Math.min(maxD, 1.2 * o.maxDepthRatio * J.stemW); }
        if (!(maxD > 0) || !isFinite(P.a) || !(P.d > 0)) { J.status = 'impossible'; J.reasons.push('geom'); return null; }
        if (P.dEff > maxD) { scalePlan(P, maxD / P.dEff); J.reasons.push('epaisseur'); }
        return P;
    }
    function scalePlan(P, f) {
        P.d *= f; P.dEff *= f; P.r *= f; P.wb *= f; P.a *= f; P.f *= f;
    }

    // --- Construction des encoches / building the notches -----------------------
    function notchPoints(J, P, A, B) {
        var V = J.V, u = J.u, T = add(V, mul(u, P.dEff)), pts = [];
        function corner(p) { return { a: cp(p), l: cp(p), r: cp(p), smooth: false, isNew: true }; }
        if (P.form === 'flat') {
            var base = add(V, mul(u, P.d)), w = sub(A, base), vA = unit(sub(w, mul(u, dot(w, u))));
            pts.push(corner(add(base, mul(vA, P.wb))));
            pts.push(corner(sub(base, mul(vA, P.wb))));
            P.tips = [pts[0].a, pts[1].a];
        } else if (P.form === 'U' && P.r > 0) {
            var dA = unit(sub(A, T)), dB = unit(sub(B, T));
            var phi = Math.acos(clamp(dot(dA, dB), -1, 1)) / 2, r = P.r;
            var td = r / Math.tan(phi), maxTd = 0.7 * Math.min(dist(A, T), dist(B, T));
            if (td > maxTd) { r = r * maxTd / td; td = maxTd; }
            var C1 = add(T, mul(dA, td)), C2 = add(T, mul(dB, td));
            var sweep = Math.PI - 2 * phi, hl = 4 / 3 * Math.tan(sweep / 4) * r;
            pts.push({ a: C1, l: cp(C1), r: add(C1, mul(dA, -hl)), smooth: false, isNew: true });
            pts.push({ a: C2, l: add(C2, mul(dB, -hl)), r: cp(C2), smooth: false, isNew: true });
            P.tips = [];
        } else {
            pts.push(corner(T));
            P.tips = [cp(T)];
        }
        return pts;
    }
    // Reconstruit un contour avec ses pièges / rebuilds a contour with its traps
    function buildContour(ct, plans) {
        var n = ct.pts.length, segs = [], i;
        for (i = 0; i < n; i++) {
            var s = segOf(ct, i), tb = lenTable(s);
            var c0 = plans[i] ? plans[i].P.a : 0, c1 = plans[(i + 1) % n] ? plans[(i + 1) % n].P.a : 0;
            var t0 = c0 > 0 ? tAtLen(tb, c0) : 0, t1 = c1 > 0 ? tAtLen(tb, tb.total - c1) : 1;
            if (isLine(s)) {
                // Droite gardée droite, poignées sur les points / straight stays straight, handles on anchors
                var q0 = bezPt(s, t0), q1 = bezPt(s, t1);
                segs.push([q0, cp(q0), cp(q1), q1]);
            } else { segs.push(subBez(s, t0, t1)); }
        }
        var out = [], owner = [];
        for (i = 0; i < n; i++) {
            var prev = segs[(i - 1 + n) % n], next = segs[i], pl = plans[i];
            if (pl) {
                var A = prev[3], B = next[0];
                out.push({ a: cp(A), l: cp(prev[2]), r: cp(A), smooth: false, isNew: true }); owner.push(-1);
                var np = notchPoints(pl.J, pl.P, A, B), k;
                pl.A = cp(A); pl.B = cp(B);
                for (k = 0; k < np.length; k++) { out.push(np[k]); owner.push(i); }
                out.push({ a: cp(B), l: cp(B), r: cp(next[1]), smooth: false, isNew: true }); owner.push(i);
            } else {
                var p = ct.pts[i];
                out.push({ a: cp(p.a), l: cp(prev[2]), r: cp(next[1]), smooth: !!p.smooth, isNew: false, sel: p.sel }); owner.push(-1);
            }
        }
        // owner[k] = i : le segment qui MÈNE au point k appartient à l'encoche i
        // owner[k] = i : the segment LEADING to point k belongs to notch i
        return { pts: out, owner: owner };
    }
    // Segments aplatis étiquetés / tagged flattened segments
    function taggedSegs(built) {
        var pts = built.pts, n = pts.length, segs = [], k, j;
        for (k = 0; k < n; k++) {
            var p = pts[k], q = pts[(k + 1) % n], s = [p.a, p.r, q.l, q.a], tag = built.owner[(k + 1) % n];
            var fl = [];
            flatSeg(s, fl); fl.push(cp(q.a));
            for (j = 0; j + 1 < fl.length; j++) { segs.push({ a: fl[j], b: fl[j + 1], tag: tag }); }
        }
        return segs;
    }
    function sharesEnd(s1, s2) {
        var e = 1e-7;
        return dist(s1.a, s2.a) < e || dist(s1.a, s2.b) < e || dist(s1.b, s2.a) < e || dist(s1.b, s2.b) < e;
    }
    // Encoches qui croisent un autre bord / notches crossing another edge
    function badNotches(built, otherSegs) {
        var segs = taggedSegs(built), bad = {}, i, j;
        for (i = 0; i < segs.length; i++) {
            var s1 = segs[i];
            if (s1.tag < 0 || bad[s1.tag]) { continue; }
            for (j = 0; j < segs.length; j++) {
                var s2 = segs[j];
                if (j === i || s2.tag === s1.tag || sharesEnd(s1, s2)) { continue; }
                if (segX(s1.a, s1.b, s2.a, s2.b)) { bad[s1.tag] = true; break; }
            }
            if (bad[s1.tag]) { continue; }
            for (j = 0; j < otherSegs.length; j++) {
                if (segX(s1.a, s1.b, otherSegs[j].a, otherSegs[j].b)) { bad[s1.tag] = true; break; }
            }
        }
        return bad;
    }
    function hasKeys(o) { var k; for (k in o) { if (o.hasOwnProperty(k)) { return true; } } return false; }
    function polySegs(poly) {
        var out = [], n = poly.length, j;
        for (j = 0; j < n; j++) { out.push({ a: poly[j], b: poly[(j + 1) % n], tag: -1 }); }
        return out;
    }

    // --- Plan complet / full plan --------------------------------------------------
    function plan(shapes, o) {
        var joints = findJoints(shapes, o), byCt = {}, i, k;
        for (i = 0; i < joints.length; i++) {
            var J = joints[i];
            if (J.status !== 'todo') { continue; }
            var P = planJoint(J, o);
            if (!P) { continue; }
            J.P = P;
            var key = J.si + ':' + J.ci;
            if (!byCt[key]) { byCt[key] = { si: J.si, ci: J.ci, plans: {} }; }
            byCt[key].plans[J.i] = { J: J, P: P };
        }
        var results = [];
        for (k in byCt) {
            if (!byCt.hasOwnProperty(k)) { continue; }
            var g = byCt[k], sh = shapes[g.si], ct = sh.contours[g.ci], n = ct.pts.length, idx;
            // Longueur disponible sur chaque segment / room on each segment
            for (idx = 0; idx < n; idx++) {
                var pa = g.plans[idx], pb = g.plans[(idx + 1) % n];
                if (!pa && !pb) { continue; }
                var L = lenTable(segOf(ct, idx)).total, need = (pa ? pa.P.a : 0) + (pb ? pb.P.a : 0);
                if (need > 0.8 * L) {
                    var f = 0.8 * L / need;
                    if (pa) { scalePlan(pa.P, f); pa.J.reasons.push('court'); }
                    if (pb && pb !== pa) { scalePlan(pb.P, f); pb.J.reasons.push('court'); }
                }
            }
            for (idx in g.plans) {
                if (g.plans.hasOwnProperty(idx) && g.plans[idx].P.f < o.minFactor) {
                    g.plans[idx].J.status = 'impossible'; g.plans[idx].J.reasons.push('trop-petit'); delete g.plans[idx];
                }
            }
            // Autres bords : autres contours et autres formes / other edges
            var others = [], si2, c2, polys;
            for (si2 = 0; si2 < shapes.length; si2++) {
                polys = shapePolys(shapes[si2]);
                for (c2 = 0; c2 < polys.length; c2++) {
                    if (si2 === g.si && c2 === g.ci) { continue; }
                    var bb = bboxOf([polys[c2]]), cb = shapePolys(sh)[g.ci], mb = bboxOf([cb]);
                    if (bb[0] > mb[2] || bb[2] < mb[0] || bb[1] > mb[3] || bb[3] < mb[1]) { continue; }
                    others = others.concat(polySegs(polys[c2]));
                }
            }
            // Résolution des croisements : on réduit d'abord l'encoche la plus grande, une à la fois
            // Crossing resolution: shrink the largest offending notch first, one at a time
            var built = null, iter, bad, idx2, worst;
            // Après 40 réductions, on supprime directement / after 40 shrinks, remove directly
            for (iter = 0; ; iter++) {
                if (!hasKeys(g.plans)) { built = null; break; }
                built = buildContour(ct, g.plans);
                bad = badNotches(built, others); worst = null;
                for (idx2 in bad) {
                    if (bad.hasOwnProperty(idx2) && g.plans[idx2] && (!worst || g.plans[idx2].P.dEff > worst.P.dEff)) { worst = g.plans[idx2]; worst.key = idx2; }
                }
                if (!worst) { break; }
                if (worst.P.f * 0.75 < o.minFactor || iter >= 40) {
                    worst.J.status = 'impossible'; worst.J.reasons.push('croise'); delete g.plans[worst.key];
                } else { scalePlan(worst.P, 0.75); if (worst.J.reasons[worst.J.reasons.length - 1] !== 'croise-reduit') { worst.J.reasons.push('croise-reduit'); } }
            }
            if (built) {
                for (idx in g.plans) {
                    if (!g.plans.hasOwnProperty(idx)) { continue; }
                    var pj = g.plans[idx];
                    pj.J.status = (pj.P.f < 0.999) ? 'reduit' : 'ok';
                    pj.J.A = pj.A; pj.J.B = pj.B; pj.J.tips = pj.P.tips;
                    pj.J.notch = notchOutline(built, +idx);
                    if (o.method === 'process') { pj.J.clearance = pj.P.d * Math.sin(pj.P.g); pj.J.enough = pj.J.clearance >= o.spread * 0.999; }
                }
                results.push({ shape: sh, si: g.si, ci: g.ci, pts: built.pts });
            }
        }
        return { joints: joints, contours: results };
    }
    // Polyligne de l'encoche (pour l'aperçu) / notch polyline (for the preview)
    function notchOutline(built, i) {
        var segs = taggedSegs(built), out = [], k;
        for (k = 0; k < segs.length; k++) {
            if (segs[k].tag === i) { if (!out.length) { out.push(cp(segs[k].a)); } out.push(cp(segs[k].b)); }
        }
        return out;
    }
    // Applique le plan aux formes (en mémoire) et met à jour la mémoire
    // Applies the plan to the shapes (in memory) and updates the memory
    function applyPlan(shapes, res) {
        var touched = [], i, j;
        for (i = 0; i < res.contours.length; i++) {
            var rc = res.contours[i];
            rc.shape.contours[rc.ci].pts = rc.pts;
            rc.shape.contours[rc.ci].changed = true;
            if (!rc.shape.changed) { rc.shape.changed = true; touched.push(rc.shape); }
        }
        for (i = 0; i < touched.length; i++) {
            var sh = touched[i], oldBB = sh._bb;
            sh._polys = null; shapePolys(sh);
            var memo = [];
            if (sh.memo) { for (j = 0; j < sh.memo.length; j++) { memo.push(sh.memo[j]); } }
            for (j = 0; j < res.joints.length; j++) {
                var J = res.joints[j];
                if (J.shape !== sh || (J.status !== 'ok' && J.status !== 'reduit') || !J.tips) { continue; }
                var t;
                for (t = 0; t < J.tips.length; t++) { memo.push(normPt(sh._bb, J.tips[t])); }
            }
            sh.memo = memo; sh._oldBB = oldBB;
        }
        return touched;
    }
    function defaults() {
        return { method: 'process', spread: 0.06 * 72 / 25.4, k: 2, m: 1.2, depthPct: 25, halfOpen: 12, form: 'V',
                 maxAngle: 100, minTurn: 8, maxDepthRatio: 0.5, minFactor: 0.3, onlySelected: false, skipMemo: true };
    }
    function counts(joints) {
        var c = { total: joints.length, ok: 0, reduit: 0, impossible: 0, deja: 0, todo: 0, insuff: 0 }, i;
        for (i = 0; i < joints.length; i++) {
            var s = joints[i].status;
            if (c.hasOwnProperty(s)) { c[s]++; }
            if ((s === 'ok' || s === 'reduit') && joints[i].enough === false) { c.insuff++; }
        }
        return c;
    }

    return { plan: plan, applyPlan: applyPlan, findJoints: findJoints, planJoint: planJoint, defaults: defaults, counts: counts,
             parseMemo: parseMemo, writeMemo: writeMemo, inShape: inShape, inScope: inScope, shapePolys: shapePolys, flatPts: flatPts,
             bezPt: bezPt, split: split, subBez: subBez, lenTable: lenTable, tAtLen: tAtLen, segX: segX, isMemo: isMemo, rayExit: rayExit,
             bboxOf: bboxOf, MEMO_TAG: MEMO_TAG };
})();

// ============================================================================
//  INTERFACE ET DOCUMENT ILLUSTRATOR / ILLUSTRATOR UI AND DOCUMENT
// ============================================================================
var PEUI = (function () {
    var VERSION = '1.0.0';
    var LAYER_MARK = 'Pièges à encre — repères', LAYER_BACKUP = 'Pièges à encre — originaux';
    var PT_MM = 25.4 / 72;
    // Engraissement par bord, valeurs de départ indicatives (mm) — à ajuster avec l'imprimeur
    // Spread per edge, indicative starting values (mm) — adjust with your printer
    var PRESETS = [
        { fr: 'Offset couché', en: 'Coated offset', v: 0.015 },
        { fr: 'Offset non couché / journal', en: 'Uncoated offset / newsprint', v: 0.04 },
        { fr: 'Impression numérique', en: 'Digital print', v: 0.02 },
        { fr: 'Flexographie', en: 'Flexography', v: 0.06 },
        { fr: 'Sérigraphie', en: 'Screen printing', v: 0.08 },
        { fr: 'Tampon encreur', en: 'Rubber stamp', v: 0.12 },
        { fr: 'Gravure / marquage laser', en: 'Laser engraving / marking', v: 0.08 },
        { fr: 'Personnalisé', en: 'Custom', v: null }
    ];

    function isFr() {
        var l = '';
        try { l = String($.locale || ''); } catch (e) { l = ''; }
        if (!l) { try { l = String(app.locale || ''); } catch (e2) { l = ''; } }
        return l === '' || l.toLowerCase().indexOf('fr') === 0;
    }
    var FR = {
        title: 'Pièges à encre', noDoc: 'Aucun document ouvert.\nOuvrez un document puis relancez le script.',
        noSel: 'Rien n\'est sélectionné.\nSélectionnez le lettrage, le logo ou les pictos vectorisés.',
        textSel: 'Quittez l\'édition de texte et sélectionnez des objets (formes vectorisées).',
        nothing: 'Aucune forme remplie fermée dans la sélection.',
        noPts: 'L\'option « Seulement les coins sélectionnés » est cochée, mais aucun point d\'ancrage n\'est sélectionné à la Sélection directe.',
        pMethod: 'Méthode', mProc: 'Selon le procédé d\'impression (l\'encre qui s\'étale bouche les creux)',
        proc: 'Procédé :', spread: 'Engraissement par bord (mm) :', scale: 'Taille réelle :',
        sc100: 'Document à 100 %', scH: 'Hauteur imprimée de la sélection', scW: 'Largeur imprimée de la sélection', mmLbl: 'mm',
        margin: 'Marge de sécurité (%) :', mStyle: 'Style graphique (pièges visibles)',
        depth: 'Profondeur (% de l\'épaisseur du fût) :', open: 'Demi-ouverture (°) :',
        pJoint: 'Jonctions', maxAng: 'Angle maximal du creux (°) :', onlySel: 'Seulement les coins sélectionnés à la Sélection directe',
        outline: 'Vectoriser les textes sélectionnés (original gardé sur le calque des originaux)',
        skipMemo: 'Ignorer les pièges déjà posés par ce script (note de l\'objet)',
        pForm: 'Forme du piège', fV: 'En V (conique)', fU: 'En U (fond arrondi)', fFlat: 'Fente à fond plat',
        maxDepth: 'Profondeur maximale (% de l\'épaisseur) :',
        pOut: 'Sortie', unit: 'Unité d\'affichage :', markers: 'Repères et aperçu sur un calque non imprimable', labels: 'Étiquettes (angle, profondeur)',
        backup: 'Copie des originaux sur un calque masqué', report: 'Enregistrer un rapport .txt',
        advice: 'Conseil : travaillez sur une copie du fichier. Tout s\'annule par Édition > Annuler.',
        analyse: 'Analyser', apply: 'Poser les pièges', clear: 'Effacer les repères', cancel: 'Annuler', badNum: 'Valeur numérique incorrecte : ',
        sum: 'Résumé', found: 'jonction(s) aiguë(s) trouvée(s)', planned: 'piège(s) possible(s)', done: 'piège(s) posé(s)',
        reduced: 'dont %1 réduit(s) (place ou épaisseur limitée)', impossible: 'impossible(s) (segment trop court ou encoche qui croiserait un bord)',
        already: 'déjà piégée(s) (ignorée(s))', insuff: 'Attention : %1 piège(s) trop petit(s) pour compenser l\'engraissement (dessin trop petit à cette taille d\'impression).',
        scaleInfo: 'Engraissement retenu : %1 par bord à l\'impression = %2 dans le document (échelle %3 %).',
        shapes: 'Formes modifiées : %1.', skipped: 'Ignorés : %1 texte(s) (cochez la vectorisation), %2 tracé(s) ouvert(s), %3 trait(s) sans fond (vectorisez le contour), %4 verrouillé(s)/masqué(s), %5 autre(s).',
        none: 'Aucune jonction aiguë à piéger.', cleared: 'Repères effacés.', reportSaved: 'Rapport enregistré : ',
        st: { ok: 'à piéger / piégé', reduit: 'réduit', impossible: 'impossible', deja: 'déjà piégé', todo: '—' },
        rs: { epaisseur: 'limité par l\'épaisseur', court: 'segment court', 'trop-petit': 'trop petit', croise: 'croiserait un bord', 'croise-reduit': 'réduit pour ne pas croiser', geom: 'géométrie' },
        hint: 'Astuce : des formes qui se chevauchent sans être unies n\'ont pas de point à leurs jonctions — unissez-les (Pathfinder > Unir) avant.'
    };
    var EN = {
        title: 'Ink Traps', noDoc: 'No document open.\nOpen a document and run the script again.',
        noSel: 'Nothing is selected.\nSelect the outlined lettering, logo or icons.',
        textSel: 'Leave text editing and select objects (outlined shapes).',
        nothing: 'No closed filled shape in the selection.',
        noPts: '"Only corners selected" is ticked but no anchor point is selected with the Direct Selection tool.',
        pMethod: 'Method', mProc: 'From the print process (spreading ink fills the crotches)',
        proc: 'Process:', spread: 'Ink spread per edge (mm):', scale: 'Real size:',
        sc100: 'Document at 100%', scH: 'Printed height of the selection', scW: 'Printed width of the selection', mmLbl: 'mm',
        margin: 'Safety margin (%):', mStyle: 'Graphic style (visible traps)',
        depth: 'Depth (% of the stem width):', open: 'Half opening (°):',
        pJoint: 'Joints', maxAng: 'Maximum crotch angle (°):', onlySel: 'Only corners selected with the Direct Selection tool',
        outline: 'Outline selected text (original kept on the backup layer)',
        skipMemo: 'Skip traps already cut by this script (object note)',
        pForm: 'Trap shape', fV: 'V-shaped (conical)', fU: 'U-shaped (round bottom)', fFlat: 'Flat-bottom slot',
        maxDepth: 'Maximum depth (% of the thickness):',
        pOut: 'Output', unit: 'Display unit:', markers: 'Markers and preview on a non-printing layer', labels: 'Labels (angle, depth)',
        backup: 'Copy originals to a hidden layer', report: 'Save a .txt report',
        advice: 'Tip: work on a copy of your file. Everything can be undone with Edit > Undo.',
        analyse: 'Analyse', apply: 'Cut the traps', clear: 'Clear markers', cancel: 'Cancel', badNum: 'Invalid number: ',
        sum: 'Summary', found: 'acute joint(s) found', planned: 'trap(s) possible', done: 'trap(s) cut',
        reduced: 'of which %1 reduced (limited room or thickness)', impossible: 'impossible (segment too short or notch would cross an edge)',
        already: 'already trapped (skipped)', insuff: 'Warning: %1 trap(s) too small to compensate the spread (artwork too small at this printed size).',
        scaleInfo: 'Spread used: %1 per edge when printed = %2 in the document (scale %3%).',
        shapes: 'Shapes modified: %1.', skipped: 'Skipped: %1 text frame(s) (tick outlining), %2 open path(s), %3 unfilled stroke(s) (outline the stroke), %4 locked/hidden, %5 other(s).',
        none: 'No acute joint to trap.', cleared: 'Markers cleared.', reportSaved: 'Report saved: ',
        st: { ok: 'to trap / trapped', reduit: 'reduced', impossible: 'impossible', deja: 'already trapped', todo: '—' },
        rs: { epaisseur: 'limited by thickness', court: 'short segment', 'trop-petit': 'too small', croise: 'would cross an edge', 'croise-reduit': 'reduced to avoid crossing', geom: 'geometry' },
        hint: 'Tip: overlapping shapes that are not united have no point at their joints — unite them first (Pathfinder > Unite).'
    };
    var T = isFr() ? FR : EN;
    function fmtStr(s, a) { var i; for (i = 0; i < a.length; i++) { s = s.split('%' + (i + 1)).join(String(a[i])); } return s; }
    function parseNum(s) {
        var v = parseFloat(String(s).replace(/^\s+|\s+$/g, '').replace(',', '.'));
        return isNaN(v) ? null : v;
    }
    function fromPt(v, unit) { return unit === 'mm' ? v * PT_MM : v; }
    function fmt(v, unit, dec) {
        var s = fromPt(v, unit).toFixed(dec === undefined ? 3 : dec);
        if (T === FR) { s = s.replace('.', ','); }
        return s + ' ' + unit;
    }
    function fmtN(v, dec) { var s = v.toFixed(dec); return T === FR ? s.replace('.', ',') : s; }

    // --- Réglages mémorisés / saved settings -------------------------------------
    function cfgFile() { return new File(Folder.userData + '/PiegesEncre.ini'); }
    function defaultCfg() {
        return { method: 'process', preset: '3', spread: '0.06', scaleMode: '100', scaleVal: '20', margin: '20', depth: '25', open: '12',
                 maxAngle: '100', onlySel: 'false', outline: 'false', skipMemo: 'true', form: 'V', maxDepth: '50', unit: 'mm',
                 markers: 'true', labels: 'true', backup: 'true', report: 'false' };
    }
    function loadCfg() {
        var c = defaultCfg(), f = cfgFile();
        try {
            if (f.exists && f.open('r')) {
                f.encoding = 'UTF-8';
                while (!f.eof) {
                    var line = f.readln(), p = line.indexOf('=');
                    if (p > 0) { var k = line.substring(0, p); if (c.hasOwnProperty(k)) { c[k] = line.substring(p + 1); } }
                }
                f.close();
            }
        } catch (e) { }
        return c;
    }
    function saveCfg(c) {
        var f = cfgFile(), k;
        try {
            f.encoding = 'UTF-8';
            if (f.open('w')) { for (k in c) { if (c.hasOwnProperty(k)) { f.writeln(k + '=' + c[k]); } } f.close(); }
        } catch (e) { }
    }

    // --- Dialogue / dialog -----------------------------------------------------------
    function showDialog(c) {
        var w = new Window('dialog', T.title + ' v' + VERSION), result = null, i;
        w.orientation = 'column'; w.alignChildren = ['fill', 'top'];
        var p1 = w.add('panel', undefined, T.pMethod); p1.alignChildren = ['left', 'top'];
        var rP = p1.add('radiobutton', undefined, T.mProc);
        var gp = p1.add('group'); gp.orientation = 'column'; gp.alignChildren = ['left', 'top'];
        var g1 = gp.add('group'); g1.add('statictext', undefined, T.proc);
        var names = []; for (i = 0; i < PRESETS.length; i++) { names.push(T === FR ? PRESETS[i].fr : PRESETS[i].en); }
        var dP = g1.add('dropdownlist', undefined, names); dP.selection = Math.min(parseInt(c.preset, 10) || 0, PRESETS.length - 1);
        var g2 = gp.add('group'); g2.add('statictext', undefined, T.spread); var eS = g2.add('edittext', undefined, c.spread); eS.characters = 7;
        dP.onChange = function () { var k = dP.selection ? dP.selection.index : 0; if (PRESETS[k] && PRESETS[k].v !== null) { eS.text = String(PRESETS[k].v); } };
        var g3 = gp.add('group'); g3.add('statictext', undefined, T.scale);
        var dSc = g3.add('dropdownlist', undefined, [T.sc100, T.scH, T.scW]); dSc.selection = c.scaleMode === 'h' ? 1 : (c.scaleMode === 'w' ? 2 : 0);
        var eSc = g3.add('edittext', undefined, c.scaleVal); eSc.characters = 6; g3.add('statictext', undefined, T.mmLbl);
        var g4 = gp.add('group'); g4.add('statictext', undefined, T.margin); var eM = g4.add('edittext', undefined, c.margin); eM.characters = 5;
        var rS = p1.add('radiobutton', undefined, T.mStyle);
        var gs = p1.add('group'); gs.orientation = 'column'; gs.alignChildren = ['left', 'top'];
        var g5 = gs.add('group'); g5.add('statictext', undefined, T.depth); var eD = g5.add('edittext', undefined, c.depth); eD.characters = 5;
        var g6 = gs.add('group'); g6.add('statictext', undefined, T.open); var eO = g6.add('edittext', undefined, c.open); eO.characters = 5;
        rP.value = c.method !== 'style'; rS.value = c.method === 'style';
        function sync() { gp.enabled = rP.value; gs.enabled = rS.value; eSc.enabled = rP.value && dSc.selection && dSc.selection.index > 0; }
        rP.onClick = sync; rS.onClick = sync; dSc.onChange = sync; sync();

        var p2 = w.add('panel', undefined, T.pJoint); p2.alignChildren = ['left', 'top'];
        var g7 = p2.add('group'); g7.add('statictext', undefined, T.maxAng); var eA = g7.add('edittext', undefined, c.maxAngle); eA.characters = 5;
        var cSel = p2.add('checkbox', undefined, T.onlySel); cSel.value = c.onlySel === 'true';
        var cOut = p2.add('checkbox', undefined, T.outline); cOut.value = c.outline === 'true';
        var cMem = p2.add('checkbox', undefined, T.skipMemo); cMem.value = c.skipMemo !== 'false';

        var p3 = w.add('panel', undefined, T.pForm); p3.alignChildren = ['left', 'top'];
        var dF = p3.add('dropdownlist', undefined, [T.fV, T.fU, T.fFlat]); dF.selection = c.form === 'U' ? 1 : (c.form === 'flat' ? 2 : 0);
        var g8 = p3.add('group'); g8.add('statictext', undefined, T.maxDepth); var eX = g8.add('edittext', undefined, c.maxDepth); eX.characters = 5;

        var p4 = w.add('panel', undefined, T.pOut); p4.alignChildren = ['left', 'top'];
        var g9 = p4.add('group'); g9.add('statictext', undefined, T.unit);
        var dU = g9.add('dropdownlist', undefined, ['mm', 'pt']); dU.selection = c.unit === 'pt' ? 1 : 0;
        var cMk = p4.add('checkbox', undefined, T.markers); cMk.value = c.markers === 'true';
        var cLb = p4.add('checkbox', undefined, T.labels); cLb.value = c.labels === 'true';
        var cBk = p4.add('checkbox', undefined, T.backup); cBk.value = c.backup === 'true';
        var cRp = p4.add('checkbox', undefined, T.report); cRp.value = c.report === 'true';
        w.add('statictext', undefined, T.advice);

        var gb = w.add('group'); gb.alignment = 'right';
        var bA = gb.add('button', undefined, T.analyse), bP = gb.add('button', undefined, T.apply);
        var bE = gb.add('button', undefined, T.clear), bC = gb.add('button', undefined, T.cancel, { name: 'cancel' });
        function num(e, lo, hi) {
            var v = parseNum(e.text);
            if (v === null || v < lo || v > hi) { alert(T.badNum + e.text); return null; }
            return v;
        }
        function collectCfg(action) {
            var style = rS.value;
            if (!style) {
                if (num(eS, 0.0001, 5) === null || num(eM, 0, 300) === null) { return null; }
                if (dSc.selection && dSc.selection.index > 0 && num(eSc, 0.1, 100000) === null) { return null; }
            } else if (num(eD, 1, 100) === null || num(eO, 1, 45) === null) { return null; }
            if (num(eA, 5, 170) === null || num(eX, 5, 90) === null) { return null; }
            return { action: action, cfg: { method: style ? 'style' : 'process', preset: String(dP.selection ? dP.selection.index : 0), spread: eS.text,
                scaleMode: dSc.selection && dSc.selection.index === 1 ? 'h' : (dSc.selection && dSc.selection.index === 2 ? 'w' : '100'), scaleVal: eSc.text,
                margin: eM.text, depth: eD.text, open: eO.text, maxAngle: eA.text, onlySel: String(cSel.value), outline: String(cOut.value),
                skipMemo: String(cMem.value), form: dF.selection && dF.selection.index === 1 ? 'U' : (dF.selection && dF.selection.index === 2 ? 'flat' : 'V'),
                maxDepth: eX.text, unit: dU.selection ? dU.selection.text : 'mm', markers: String(cMk.value), labels: String(cLb.value),
                backup: String(cBk.value), report: String(cRp.value) } };
        }
        bA.onClick = function () { var r = collectCfg('analyse'); if (r) { result = r; w.close(1); } };
        bP.onClick = function () { var r = collectCfg('apply'); if (r) { result = r; w.close(1); } };
        bE.onClick = function () { result = { action: 'clear', cfg: c }; w.close(1); };
        bC.onClick = function () { result = null; w.close(0); };
        w.show();
        return result;
    }
    function buildOpts(c, selBox) {
        var o = PE.defaults();
        o.method = c.method === 'style' ? 'style' : 'process';
        o.m = 1 + parseNum(c.margin) / 100;
        o.depthPct = parseNum(c.depth); o.halfOpen = parseNum(c.open);
        o.maxAngle = parseNum(c.maxAngle); o.maxDepthRatio = parseNum(c.maxDepth) / 100;
        o.form = c.form; o.onlySelected = c.onlySel === 'true'; o.skipMemo = c.skipMemo !== 'false';
        var sPt = parseNum(c.spread) / PT_MM, scale = 1;
        if (c.scaleMode !== '100' && selBox) {
            var ref = c.scaleMode === 'h' ? selBox[3] - selBox[1] : selBox[2] - selBox[0];
            if (ref > 0) { scale = (parseNum(c.scaleVal) / PT_MM) / ref; }
        }
        o.spreadPrint = sPt; o.scale = scale; o.spread = sPt / scale;
        return o;
    }

    // --- Lecture de la sélection / reading the selection --------------------------
    function readContour(p) {
        var pts = [], pp = p.pathPoints, i, q, sel, smooth;
        for (i = 0; i < pp.length; i++) {
            q = pp[i]; sel = false; smooth = false;
            try { sel = q.selected === PathPointSelection.ANCHORPOINT; } catch (e) { sel = false; }
            try { smooth = q.pointType === PathPointType.SMOOTH; } catch (e2) { smooth = false; }
            pts.push({ a: [q.anchor[0], q.anchor[1]], l: [q.leftDirection[0], q.leftDirection[1]], r: [q.rightDirection[0], q.rightDirection[1]], sel: sel, smooth: smooth });
        }
        return { pts: pts, ref: p };
    }
    function itemLabel(it, n) {
        var s = '';
        try { s = it.name; } catch (e) { s = ''; }
        return s ? s : (it.typename + ' #' + n);
    }
    function isLockedOrHidden(it) {
        var p;
        try {
            if (it.locked || it.hidden) { return true; }
            p = it.layer;
            while (p && p.typename === 'Layer') { if (p.locked || !p.visible) { return true; } p = p.parent; }
        } catch (e) { }
        return false;
    }
    function itemKey(it) {
        try { if (it.uuid) { return 'u' + it.uuid; } } catch (e) { }
        try { return 'b' + it.typename + it.geometricBounds.join(','); } catch (e2) { return 'x' + Math.random(); }
    }
    function getNote(it) { try { return String(it.note || ''); } catch (e) { return ''; } }
    function getLayer(doc, name, create) {
        var i;
        for (i = 0; i < doc.layers.length; i++) { if (doc.layers[i].name === name) { return doc.layers[i]; } }
        if (!create) { return null; }
        var l = doc.layers.add(); l.name = name; return l;
    }
    function backupItem(doc, it, state) {
        if (!state.layer) {
            state.layer = getLayer(doc, LAYER_BACKUP, true);
            state.layer.locked = false; state.layer.visible = true;
        }
        try { it.duplicate(state.layer, ElementPlacement.PLACEATEND); state.count++; } catch (e) { }
    }
    // action : 'analyse' (textes vectorisés sur copies temporaires) ou 'apply'
    // action: 'analyse' (text outlined on temporary copies) or 'apply'
    function collect(doc, sel, cfg, action, state) {
        var acc = { shapes: [], skipped: { text: 0, open: 0, stroke: 0, locked: 0, other: 0 }, seen: {}, n: 0, temps: [], anySel: false };
        function visit(it, editable, fromText) {
            var i, key = itemKey(it);
            if (acc.seen[key]) { return; }
            acc.seen[key] = true;
            if (isLockedOrHidden(it)) { acc.skipped.locked++; return; }
            var tn = it.typename;
            if (tn === 'GroupItem') {
                for (i = 0; i < it.pageItems.length; i++) {
                    var ch = it.pageItems[i];
                    if (ch.typename === 'PathItem' && ch.clipping) { continue; }
                    visit(ch, editable, fromText);
                }
            } else if (tn === 'PathItem') {
                if (it.guides || it.clipping) { return; }
                if (it.parent && it.parent.typename === 'CompoundPathItem') { acc.seen[key] = false; visit(it.parent, editable, fromText); return; }
                acc.n++;
                if (!it.filled) { acc.skipped.stroke++; return; }
                if (!it.closed) { acc.skipped.open++; return; }
                if (it.pathPoints.length < 3) { acc.skipped.other++; return; }
                var ct = readContour(it);
                acc.shapes.push({ id: 'S' + acc.n, contours: [ct], evenodd: !!it.evenodd, editable: editable, fromText: !!fromText, ref: it, label: itemLabel(it, acc.n),
                                  memo: PE.parseMemo(getNote(it)) });
                for (i = 0; i < ct.pts.length; i++) { if (ct.pts[i].sel) { acc.anySel = true; break; } }
            } else if (tn === 'CompoundPathItem') {
                acc.n++;
                var cs = [], first = it.pathItems.length ? it.pathItems[0] : null;
                if (!first) { acc.skipped.other++; return; }
                if (!first.filled) { acc.skipped.stroke++; return; }
                for (i = 0; i < it.pathItems.length; i++) {
                    var pi = it.pathItems[i];
                    if (pi.closed && pi.pathPoints.length >= 3) {
                        var c2 = readContour(pi); cs.push(c2);
                        var k; for (k = 0; k < c2.pts.length; k++) { if (c2.pts[k].sel) { acc.anySel = true; break; } }
                    } else if (!pi.closed) { acc.skipped.open++; }
                }
                if (cs.length) { acc.shapes.push({ id: 'S' + acc.n, contours: cs, evenodd: !!first.evenodd, editable: editable, fromText: !!fromText, ref: it, label: itemLabel(it, acc.n), memo: PE.parseMemo(getNote(it)) }); }
            } else if (tn === 'TextFrame') {
                if (cfg.outline !== 'true') { acc.skipped.text++; return; }
                var g = null;
                try {
                    if (action === 'apply') {
                        if (cfg.backup === 'true') { backupItem(doc, it, state); }
                        g = it.createOutline();
                    } else {
                        g = it.duplicate().createOutline(); acc.temps.push(g);
                    }
                } catch (e) { g = null; }
                // Copies temporaires analysées normalement (jamais écrites) / temporary copies analysed normally (never written)
                if (g) { visit(g, true, true); } else { acc.skipped.text++; }
            } else { acc.skipped.other++; }
        }
        var i;
        for (i = 0; i < sel.length; i++) { visit(sel[i], true); }
        return acc;
    }
    function removeTemps(acc) {
        var i;
        for (i = 0; i < acc.temps.length; i++) { try { acc.temps[i].remove(); } catch (e) { } }
        acc.temps = [];
    }
    function unionBox(shapes) {
        var polys = [], i, c;
        for (i = 0; i < shapes.length; i++) { var ps = PE.shapePolys(shapes[i]); for (c = 0; c < ps.length; c++) { polys.push(ps[c]); } }
        return PE.bboxOf(polys);
    }

    // --- Écriture / writing -------------------------------------------------------------
    function writeContour(ct) {
        var p = ct.ref, pts = ct.pts, anchors = [], i;
        for (i = 0; i < pts.length; i++) { anchors.push([pts[i].a[0], pts[i].a[1]]); }
        p.setEntirePath(anchors);
        try { p.closed = true; } catch (e0) { }
        var pp = p.pathPoints;
        for (i = 0; i < pts.length && i < pp.length; i++) {
            var q = pp[i];
            try { q.pointType = pts[i].smooth ? PathPointType.SMOOTH : PathPointType.CORNER; } catch (e) { }
            q.leftDirection = [pts[i].l[0], pts[i].l[1]];
            q.rightDirection = [pts[i].r[0], pts[i].r[1]];
        }
    }

    // --- Repères / markers ----------------------------------------------------------------
    function mkColor(doc, r, g, b) {
        var c;
        if (doc.documentColorSpace === DocumentColorSpace.CMYK) {
            c = new CMYKColor();
            var k = 1 - Math.max(r, g, b) / 255;
            if (k >= 1) { c.cyan = 0; c.magenta = 0; c.yellow = 0; c.black = 100; return c; }
            c.cyan = 100 * (1 - r / 255 - k) / (1 - k); c.magenta = 100 * (1 - g / 255 - k) / (1 - k);
            c.yellow = 100 * (1 - b / 255 - k) / (1 - k); c.black = 100 * k;
            return c;
        }
        c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c;
    }
    function median(a) { var b = a.slice(0).sort(function (x, y) { return x - y; }); return b.length ? b[Math.floor(b.length / 2)] : 0; }
    function clearMarkers(doc) {
        var lay = getLayer(doc, LAYER_MARK, false);
        if (!lay) { return false; }
        lay.locked = false; lay.visible = true;
        try { lay.remove(); } catch (e) { while (lay.pageItems.length) { lay.pageItems[0].remove(); } }
        return true;
    }
    function drawMarkers(doc, res, o, cfg, applied) {
        var lay = getLayer(doc, LAYER_MARK, true), i;
        lay.locked = false; lay.visible = true;
        while (lay.pageItems.length) { lay.pageItems[0].remove(); }
        lay.printable = false;
        try { lay.zOrder(ZOrderMethod.BRINGTOFRONT); } catch (e) { }
        var col = { red: mkColor(doc, 230, 0, 40), orange: mkColor(doc, 255, 140, 0), amber: mkColor(doc, 220, 170, 0), green: mkColor(doc, 0, 150, 70),
                    grey: mkColor(doc, 150, 150, 150), blue: mkColor(doc, 0, 110, 220), mag: mkColor(doc, 230, 0, 160) };
        var sw = [];
        for (i = 0; i < res.joints.length; i++) { if (res.joints[i].stemW > 0 && isFinite(res.joints[i].stemW)) { sw.push(res.joints[i].stemW); } }
        var ms = median(sw) || 10, rad = Math.max(0.4, Math.min(8, ms * 0.12)), lw = Math.max(0.05, Math.min(0.6, ms * 0.012)), fs = Math.max(2.5, Math.min(10, ms * 0.22));
        function poly(pts, closed, c, dash, width) {
            var p = lay.pathItems.add();
            p.setEntirePath(pts); p.closed = !!closed; p.filled = false; p.stroked = true; p.strokeColor = c; p.strokeWidth = width || lw;
            if (dash) { p.strokeDashes = [lw * 3, lw * 2]; }
            return p;
        }
        for (i = 0; i < res.joints.length; i++) {
            var J = res.joints[i], c;
            if (J.status === 'deja') { c = col.blue; }
            else if (J.status === 'impossible') { c = col.grey; }
            else if (applied) { c = (J.status === 'reduit' || J.enough === false) ? col.orange : col.green; }
            else { c = J.alpha < 45 ? col.red : (J.alpha < 75 ? col.orange : col.amber); }
            var e = lay.pathItems.ellipse(J.V[1] + rad, J.V[0] - rad, 2 * rad, 2 * rad);
            e.filled = false; e.stroked = true; e.strokeColor = c; e.strokeWidth = lw;
            if (J.status === 'impossible') { e.strokeDashes = [lw * 3, lw * 2]; }
            if (J.notch && J.notch.length > 1) { poly(J.notch, false, col.mag, !applied); }
            if (J.P && J.P.kite && o.method === 'process') { poly(J.P.kite, true, col.red, false, lw * 0.6); }
            if (cfg.labels === 'true') {
                var txt = fmtN(J.alpha, 0) + '°';
                if (J.P && J.status !== 'impossible') { txt += ' · ' + fmt(J.P.dEff, cfg.unit, cfg.unit === 'mm' ? 2 : 1); }
                if (J.status === 'deja' || J.status === 'impossible') { txt += ' · ' + T.st[J.status]; }
                var tf = lay.textFrames.pointText([J.V[0] + rad * 1.3, J.V[1] + rad * 1.3]);
                tf.contents = txt;
                try { tf.textRange.characterAttributes.size = fs; tf.textRange.characterAttributes.fillColor = c; } catch (e2) { }
            }
        }
        return lay;
    }

    // --- Rapport / report ----------------------------------------------------------------------
    function buildReport(doc, res, o, cfg, lines) {
        var L = [], i, j;
        L.push(T.title + ' v' + VERSION + ' — ' + (doc ? doc.name : '') + ' — ' + new Date().toString());
        for (i = 0; i < lines.length; i++) { L.push(lines[i]); }
        L.push('');
        for (i = 0; i < res.joints.length; i++) {
            var J = res.joints[i], rs = [];
            for (j = 0; j < J.reasons.length; j++) { if (T.rs[J.reasons[j]]) { rs.push(T.rs[J.reasons[j]]); } }
            var line = (J.shape.label || J.shape.id) + ' @ ' + fmt(J.V[0], cfg.unit, 2) + ' ; ' + fmt(J.V[1], cfg.unit, 2) + ' — ' + fmtN(J.alpha, 1) + '° — ' + (T.st[J.status] || J.status);
            if (J.P && J.status !== 'impossible' && J.status !== 'deja') { line += ' — ' + fmt(J.P.dEff, cfg.unit) + ' / ' + fmt(J.P.a, cfg.unit); }
            if (isFinite(J.stemW)) { line += ' — e=' + fmt(J.stemW, cfg.unit); }
            if (rs.length) { line += ' [' + rs.join(', ') + ']'; }
            L.push(line);
        }
        return L.join('\n');
    }
    function saveReport(doc, txt) {
        var folder = null, base = 'document';
        try { if (doc.saved || doc.fullName) { folder = doc.path; base = doc.name.replace(/\.[^\.]+$/, ''); } } catch (e) { folder = null; }
        if (!folder || !folder.exists) { folder = Folder.desktop; }
        var f = new File(folder + '/' + base + '_pieges-encre.txt');
        f.encoding = 'UTF-8';
        if (f.open('w')) { f.write(txt); f.close(); return f.fsName; }
        return null;
    }

    // --- Programme principal / main ----------------------------------------------------------
    function run() {
        if (app.documents.length === 0) { alert(T.noDoc); return; }
        var doc = app.activeDocument, sel = doc.selection;
        if (sel && sel.typename && sel.typename === 'TextRange') { alert(T.textSel); return; }
        if ((!sel || !sel.length) && !getLayer(doc, LAYER_MARK, false)) { alert(T.noSel); return; }
        var dlg = showDialog(loadCfg());
        if (!dlg) { return; }
        if (dlg.action === 'clear') { clearMarkers(doc); alert(T.title + '\n\n' + T.cleared); return; }
        saveCfg(dlg.cfg);
        var cfg = dlg.cfg;
        if (!sel || !sel.length) { alert(T.noSel); return; }
        var items = [], i;
        for (i = 0; i < sel.length; i++) { items.push(sel[i]); }
        var bk = { layer: null, count: 0 };
        var acc = collect(doc, items, cfg, dlg.action, bk);
        var sk = fmtStr(T.skipped, [acc.skipped.text, acc.skipped.open, acc.skipped.stroke, acc.skipped.locked, acc.skipped.other]);
        if (!acc.shapes.length) { removeTemps(acc); if (bk.layer) { bk.layer.visible = false; bk.layer.locked = true; } alert(T.nothing + '\n' + sk); return; }
        if (cfg.onlySel === 'true' && !acc.anySel) { removeTemps(acc); alert(T.noPts); return; }
        var o = buildOpts(cfg, unionBox(acc.shapes));
        var res = PE.plan(acc.shapes, o), cnt = PE.counts(res.joints), msg = [];
        msg.push(cnt.total + ' ' + T.found + (cnt.deja ? ' (' + cnt.deja + ' ' + T.already + ')' : ''));
        if (o.method === 'process') {
            msg.push(fmtStr(T.scaleInfo, [fmt(o.spreadPrint, 'mm', 3), fmt(o.spread, cfg.unit, 4), fmtN(o.scale * 100, 1)]));
        }
        var nTrap = cnt.ok + cnt.reduit;
        if (dlg.action === 'apply' && nTrap > 0) {
            var touched = PE.applyPlan(acc.shapes, res), nSh = 0;
            for (i = 0; i < touched.length; i++) {
                var sh = touched[i];
                if (sh.editable === false) { continue; }
                // Le texte d'origine est déjà sauvegardé / the original text is already backed up
                if (cfg.backup === 'true' && !sh.fromText) { backupItem(doc, sh.ref, bk); }
                var c;
                for (c = 0; c < sh.contours.length; c++) { if (sh.contours[c].changed) { writeContour(sh.contours[c]); } }
                try { sh.ref.note = PE.writeMemo(getNote(sh.ref), sh.memo); } catch (e) { }
                nSh++;
            }
            msg.push(nTrap + ' ' + T.done + (cnt.reduit ? ' — ' + fmtStr(T.reduced, [cnt.reduit]) : ''));
            msg.push(fmtStr(T.shapes, [nSh]));
        } else if (nTrap > 0) {
            msg.push(nTrap + ' ' + T.planned + (cnt.reduit ? ' — ' + fmtStr(T.reduced, [cnt.reduit]) : ''));
        }
        if (bk.layer) { bk.layer.visible = false; bk.layer.locked = true; }
        if (cnt.impossible) { msg.push(cnt.impossible + ' ' + T.impossible); }
        if (cnt.insuff) { msg.push(fmtStr(T.insuff, [cnt.insuff])); }
        if (cnt.total === 0) { msg.push(T.none); msg.push(T.hint); }
        if (cfg.markers === 'true') { drawMarkers(doc, res, o, cfg, dlg.action === 'apply'); }
        if (cfg.report === 'true') {
            var path = saveReport(doc, buildReport(doc, res, o, cfg, msg.concat([sk])));
            if (path) { msg.push(T.reportSaved + path); }
        }
        removeTemps(acc);
        msg.push(sk);
        try { app.redraw(); } catch (e3) { }
        alert(T.title + ' — ' + T.sum + '\n\n' + msg.join('\n'));
    }

    return { run: run, collect: collect, buildOpts: buildOpts, defaultCfg: defaultCfg, buildReport: buildReport, drawMarkers: drawMarkers,
             writeContour: writeContour, fmt: fmt, T: T, PRESETS: PRESETS };
})();

// --- Lancement / start --------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PE: PE, PEUI: PEUI };
} else if (typeof app !== 'undefined') {
    try { PEUI.run(); } catch (err) { alert('PiegesEncre : ' + err + (err.line ? ' (ligne ' + err.line + ')' : '')); }
}
