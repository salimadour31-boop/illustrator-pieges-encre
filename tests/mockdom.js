// Tests de l'interface et de l'accès au document avec un faux DOM Illustrator (node)
// UI and document access tests with a mock Illustrator DOM (node)
var fs = require('fs'), path = require('path');
var SRC = fs.readFileSync(process.env.PEF || path.join(__dirname, '..', 'PiegesEncre.jsx'), 'utf8');
var checks = 0, fails = 0; function check(c, m) { checks++; if (!c) { fails++; console.log('FAIL', m); } }
var uid = 0, DUPS = 0, FILES = {};
function PP(a, l, r, sel) {
  var o = { _a: a.slice(), _l: (l || a).slice(), _r: (r || a).slice(), pointType: 'CORNER', selected: sel ? 'ANCHOR' : 'NONE' };
  ['anchor:_a', 'leftDirection:_l', 'rightDirection:_r'].forEach(function (s) { var k = s.split(':');
    Object.defineProperty(o, k[0], { get: function () { return this[k[1]].slice(); }, set: function (v) { this[k[1]] = v.slice(); } }); });
  return o;
}
function Path(pts, opt) {
  opt = opt || {};
  var p = { typename: 'PathItem', uuid: String(++uid), pathPoints: pts, closed: opt.closed !== false, filled: opt.filled !== false, stroked: false,
    evenodd: !!opt.evenodd, locked: !!opt.locked, hidden: !!opt.hidden, guides: false, clipping: false, name: opt.name || '', parent: null, layer: null, note: opt.note || '' };
  p.setEntirePath = function (a) { p.pathPoints = a.map(function (q) { return PP(q); }); };
  p.duplicate = function (target) { var d = Path(p.pathPoints.map(function (q) { return PP(q.anchor, q.leftDirection, q.rightDirection); }), { name: p.name });
    if (target) { target.pageItems.push(d); d.parent = target; } DUPS++; return d; };
  p.remove = function () { p.removed = true; };
  Object.defineProperty(p, 'geometricBounds', { get: function () { var xs = p.pathPoints.map(function (q) { return q.anchor[0]; }), ys = p.pathPoints.map(function (q) { return q.anchor[1]; });
    return [Math.min.apply(0, xs), Math.max.apply(0, ys), Math.max.apply(0, xs), Math.min.apply(0, ys)]; } });
  return p;
}
function polyPath(a, opt, selIdx) { return Path(a.map(function (q, i) { return PP(q, null, null, selIdx && selIdx.indexOf(i) >= 0); }), opt); }
function Vpath(dx, opt, selIdx) { return polyPath([[0,100],[20,100],[50,25],[80,100],[100,100],[60,0],[40,0]].map(function (q) { return [q[0] + (dx || 0), q[1]]; }), opt, selIdx); }
function Mpath(dx) { return polyPath([[0,0],[0,100],[18,100],[50,40],[82,100],[100,100],[100,0],[84,0],[84,65],[56,12],[44,12],[16,65],[16,0]].map(function (q) { return [q[0] + dx, q[1]]; }), { name: 'M' }); }
function Group(items) { var g = { typename: 'GroupItem', uuid: String(++uid), pageItems: items, locked: false, hidden: false, name: '', layer: null, remove: function () { g.removed = true; } };
  items.forEach(function (i) { i.parent = g; }); return g; }
function TextFrame(dx) { var t = { typename: 'TextFrame', uuid: String(++uid), locked: false, hidden: false, name: '', layer: null };
  t.createOutline = function () { t.outlined = true; return Group([Vpath(dx, { name: 'outl' })]); };
  t.duplicate = function (target) { DUPS++; if (target) { target.pageItems.push({ typename: 'TextFrame' }); return null; } var c = TextFrame(dx); c.isTemp = true; TEMPS.push(c); return c; };
  return t; }
var TEMPS = [];
function Layer(doc, name) {
  var L = { typename: 'Layer', name: name, locked: false, visible: true, printable: true, pageItems: [], parent: doc };
  function track(it) { it.remove = function () { L.pageItems.splice(L.pageItems.indexOf(it), 1); }; L.pageItems.push(it); return it; }
  L.pathItems = { add: function () { var p = Path([], { filled: false }); p.kind = 'line'; return track(p); },
    ellipse: function (top, left, w, h) { var p = Path([PP([left, top])], { filled: false }); p.kind = 'ellipse'; p.c = [left + w / 2, top - h / 2]; return track(p); } };
  L.textFrames = { pointText: function (at) { return track({ typename: 'TextFrame', at: at, contents: '', textRange: { characterAttributes: {} } }); } };
  L.zOrder = function () {}; L.remove = function () { doc.layers.splice(doc.layers.indexOf(L), 1); };
  return L;
}
function Doc(sel, cs) {
  var d = { name: 'test.ai', saved: true, fullName: '/tmp/test.ai', documentColorSpace: cs || 'RGB', selection: sel, layers: [] };
  d.path = { exists: true, toString: function () { return '/tmp/petest'; } };
  d.layers.add = function () { var l = Layer(d, 'Calque'); d.layers.unshift(l); return l; };
  return d;
}
function layerNamed(d, n) { return d.layers.filter(function (l) { return l.name === n; })[0]; }
var MARK = 'Pièges à encre — repères', BACK = 'Pièges à encre — originaux';
function makeEnv(docs, button, ov, locale) {
  var alerts = [];
  var env = {
    app: { documents: docs, activeDocument: docs[0], redraw: function () {}, locale: locale || 'fr_FR' },
    $: { locale: locale || 'fr_FR' }, alert: function (m) { alerts.push(String(m)); },
    DocumentColorSpace: { CMYK: 'CMYK', RGB: 'RGB' }, ZOrderMethod: { BRINGTOFRONT: 1 }, ElementPlacement: { PLACEATEND: 1 },
    PathPointType: { SMOOTH: 'SMOOTH', CORNER: 'CORNER' }, PathPointSelection: { ANCHORPOINT: 'ANCHOR', NOSELECTION: 'NONE' },
    RGBColor: function () { this.t = 'rgb'; }, CMYKColor: function () { this.t = 'cmyk'; },
    Folder: { userData: '/tmp/ud', desktop: { exists: true, toString: function () { return '/tmp/desk'; } } },
    File: function (p) { var f = this; f.p = String(p); f.fsName = f.p; Object.defineProperty(f, 'exists', { get: function () { return FILES[f.p] !== undefined; } });
      var buf = '', lines = [], pos = 0, mode = '';
      f.open = function (m) { mode = m; if (m === 'r') { lines = (FILES[f.p] || '').split('\n'); if (lines[lines.length - 1] === '') lines.pop(); pos = 0; f.eof = pos >= lines.length; } else buf = ''; return true; };
      f.readln = function () { var l = lines[pos++]; f.eof = pos >= lines.length; return l; }; f.writeln = function (s) { buf += s + '\n'; }; f.write = function (s) { buf += s; };
      f.close = function () { if (mode === 'w') FILES[f.p] = buf; }; },
    Window: function () { var w = this, ctrls = [];
      function add(type, b, text) { var c = { type: type, text: text === undefined ? '' : String(text), value: false, characters: 0, items: [], add: add, enabled: true };
        if (type === 'dropdownlist') { c.items = text.map(function (t, i) { return { text: t, index: i }; }); c.text = '';
          Object.defineProperty(c, 'selection', { get: function () { return c._sel; }, set: function (v) { c._sel = typeof v === 'number' ? c.items[v] : v; } }); }
        ctrls.push(c); return c; }
      w.add = add; w.close = function () {}; w.show = function () { if (ov) ov(ctrls); var b = ctrls.filter(function (c) { return c.type === 'button' && c.text === button; })[0]; b.onClick(); return 1; }; }
  };
  return { env: env, alerts: alerts };
}
function runScript(docs, button, ov, locale, keepCfg) { if (!keepCfg) { delete FILES['/tmp/ud/PiegesEncre.ini']; } var E = makeEnv(docs, button, ov, locale), names = Object.keys(E.env);
  new Function(names.concat(['module']).join(','), SRC).apply(null, names.map(function (n) { return E.env[n]; }).concat([undefined])); return E.alerts; }
function fieldAfter(c, label) { var i = c.findIndex(function (x) { return x.type === 'statictext' && x.text === label; }); return c[i + 1]; }
function ctl(c, text) { return c.filter(function (x) { return x.text === text; })[0]; }
function dd(c, n) { return c.filter(function (x) { return x.type === 'dropdownlist'; })[n]; }
function anchors(p) { return JSON.stringify(p.pathPoints.map(function (q) { return q.anchor; })); }

// 1-4. messages
var a = runScript([], 'Analyser'); check(/Aucun document/.test(a[0]), 'noDoc ' + a);
a = runScript([Doc([])], 'Analyser'); check(/Rien n'est s/.test(a[0]), 'noSel ' + a);
a = runScript([Doc({ typename: 'TextRange' })], 'Analyser'); check(/Quittez/.test(a[0]), 'textSel');
a = runScript([Doc([TextFrame(0)])], 'Analyser'); check(/Aucune forme/.test(a[0]) && /1 texte/.test(a[0]), 'text not outlined ' + a);
a = runScript([Doc([polyPath([[0,0],[10,0],[10,10]], { closed: false }), polyPath([[0,0],[10,0],[10,10]], { filled: false })])], 'Analyser');
check(/Aucune forme/.test(a[0]) && /1 tracé\(s\) ouvert/.test(a[0]) && /1 trait/.test(a[0]), 'open/stroke skipped ' + a);

// 5. analyse : rien ne bouge / nothing moves
var V = Vpath(0, { name: 'V' }), M = Mpath(200), lockedV = Vpath(400, { locked: true }), d = Doc([Group([V, M]), lockedV]);
var v0 = anchors(V), m0 = anchors(M);
a = runScript([d], 'Analyser');
check(anchors(V) === v0 && anchors(M) === m0, 'analyse changed geometry');
var mk = layerNamed(d, MARK); check(mk && mk.printable === false, 'marker layer non printable');
var ells = mk ? mk.pageItems.filter(function (i) { return i.kind === 'ellipse'; }) : [];
check(ells.length === 4, 'one circle per joint (V:1, M:3) ' + ells.length);
check(/4 jonction\(s\) aiguë\(s\) trouvée\(s\)/.test(a[0]) && /piège\(s\) possible\(s\)/.test(a[0]) && /1 verrouillé/.test(a[0]), 'analyse summary ' + a[0]);
check(/Engraissement retenu : 0,060 mm/.test(a[0]), 'spread info ' + a[0]);
check(!layerNamed(d, BACK) && V.note === '', 'analyse: no backup, no memo');
console.log('--- analyse:\n' + a[0]);

// 6. poser les pièges + rapport / apply + report
var V2 = Vpath(0, { name: 'V' }), M2 = Mpath(200), d2 = Doc([Group([V2, M2])]); DUPS = 0;
a = runScript([d2], 'Poser les pièges', function (c) { ctl(c, 'Enregistrer un rapport .txt').value = true; });
check(V2.pathPoints.length > 7 && M2.pathPoints.length > 13, 'points added ' + V2.pathPoints.length + ' ' + M2.pathPoints.length);
var bl = layerNamed(d2, BACK); check(bl && bl.visible === false && bl.locked === true && DUPS === 2 && bl.pageItems.length === 2, 'backup layer ' + DUPS);
check(/^\[PiegesEncre\] /.test(V2.note) && /^\[PiegesEncre\] /.test(M2.note), 'memo in note ' + V2.note);
check(/4 piège\(s\) posé\(s\)/.test(a[0]) && /Formes modifiées : 2/.test(a[0]), 'apply summary ' + a[0]);
var orig = [[0,100],[20,100],[50,25],[80,100],[100,100],[60,0],[40,0]];
check(orig.every(function (q, i) { return i === 2 || V2.pathPoints.some(function (p) { return p.anchor[0] === q[0] && p.anchor[1] === q[1]; }); }), 'other anchors kept');
check(!V2.pathPoints.some(function (p) { return p.anchor[0] === 50 && p.anchor[1] === 25; }), 'crotch point replaced');
var tip = V2.pathPoints.filter(function (p) { return Math.abs(p.anchor[0] - 50) < 1e-9 && p.anchor[1] < 25; })[0];
check(tip && tip.anchor[1] < 25 - 0.17 && tip.anchor[1] > 23, 'notch tip along the bisector ' + (tip && tip.anchor));
var rep = FILES['/tmp/petest/test_pieges-encre.txt']; check(rep && /V @ /.test(rep) && /à piéger \/ piégé/.test(rep), 'report saved');
check(/Rapport enregistré/.test(a[0]), 'report path in summary');
console.log('--- apply:\n' + a[0]); console.log('--- report:\n' + rep);
// 7. deuxième passage : rien de nouveau / second run: nothing new
var v2 = anchors(V2), m2 = anchors(M2);
a = runScript([d2], 'Poser les pièges');
check(anchors(V2) === v2 && anchors(M2) === m2, 'second run changes nothing');
check(!/posé/.test(a[0]), 'second run summary ' + a[0]);
// 8. sans mémoire : les pointes V sont revues, mais refusées si l'option est décochée ? / without memo option
a = runScript([Doc([Vpath(0)])], 'Analyser', function (c) { ctl(c, 'Ignorer les pièges déjà posés par ce script (note de l\'objet)').value = false; });
check(/1 jonction/.test(a[0]), 'skipMemo off fresh ' + a[0]);
// 9. coins sélectionnés / selected corners
a = runScript([Doc([Vpath(0)])], 'Poser les pièges', function (c) { ctl(c, 'Seulement les coins sélectionnés à la Sélection directe').value = true; });
check(/aucun point d'ancrage n'est sélectionné/.test(a[0]), 'onlySel without points ' + a);
var M3 = polyPath([[0,0],[0,100],[18,100],[50,40],[82,100],[100,100],[100,0],[84,0],[84,65],[56,12],[44,12],[16,65],[16,0]], {}, [3]);
a = runScript([Doc([M3])], 'Poser les pièges', function (c) { ctl(c, 'Seulement les coins sélectionnés à la Sélection directe').value = true; });
check(M3.pathPoints.length === 15 && /1 piège\(s\) posé/.test(a[0]), 'only the selected corner ' + M3.pathPoints.length + ' ' + a[0]);
// 10. texte vectorisé / text outline
var t1 = TextFrame(0), d4 = Doc([t1]); TEMPS = [];
a = runScript([d4], 'Analyser', function (c) { ctl(c, 'Vectoriser les textes sélectionnés (original gardé sur le calque des originaux)').value = true; });
check(!t1.outlined && TEMPS.length === 1 && TEMPS[0].outlined, 'analyse outlines a temporary copy');
check(/1 jonction/.test(a[0]), 'text analysed ' + a[0]);
var t2 = TextFrame(0), d5 = Doc([t2]); DUPS = 0;
a = runScript([d5], 'Poser les pièges', function (c) { ctl(c, 'Vectoriser les textes sélectionnés (original gardé sur le calque des originaux)').value = true; });
check(t2.outlined && DUPS === 1 && layerNamed(d5, BACK).pageItems.length === 1 && /1 piège\(s\) posé/.test(a[0]), 'text outlined and trapped, original backed up once ' + DUPS + ' ' + a[0]);
// 11. style, forme U, unité pt, CMYK
var V6 = Vpath(0), d6 = Doc([V6], 'CMYK');
a = runScript([d6], 'Poser les pièges', function (c) { ctl(c, 'Style graphique (pièges visibles)').value = true; ctl(c, 'Selon le procédé d\'impression (l\'encre qui s\'étale bouche les creux)').value = false;
  dd(c, 2).selection = 1; dd(c, 3).selection = 1; });
check(V6.pathPoints.some(function (p) { return p.pointType === 'SMOOTH' || p.leftDirection[0] !== p.anchor[0]; }), 'U form has curves');
check(!/Engraissement retenu/.test(a[0]) && /1 piège/.test(a[0]), 'style summary ' + a[0]);
var lab = layerNamed(d6, MARK).pageItems.filter(function (i) { return i.typename === 'TextFrame'; })[0];
check(lab && / pt$/.test(lab.contents), 'label in pt ' + (lab && lab.contents));
// 12. taille imprimée / printed size: 10 mm high instead of ~35 mm -> plus gros piège dans le document
var Va = Vpath(0), Vb = Vpath(0);
runScript([Doc([Va])], 'Poser les pièges');
runScript([Doc([Vb])], 'Poser les pièges', function (c) { dd(c, 1).selection = 1; fieldAfter(c, 'Taille réelle :').text = ''; c.filter(function (x) { return x.type === 'edittext'; })[1].text = '10'; });
function depth(p) { return 25 - Math.min.apply(0, p.pathPoints.filter(function (q) { return Math.abs(q.anchor[0] - 50) < 1e-6; }).map(function (q) { return q.anchor[1]; })); }
check(depth(Vb) > depth(Va) * 2, 'smaller print -> deeper trap ' + depth(Va) + ' ' + depth(Vb));
// 13. nombre incorrect / bad number
a = runScript([Doc([Vpath(0)])], 'Analyser', function (c) { fieldAfter(c, 'Marge de sécurité (%) :').text = 'abc'; ctl(c, 'Annuler').onClick = function () {}; });
check(/Valeur numérique incorrecte : abc/.test(a[0]), 'bad number ' + a);
a = runScript([Doc([Vpath(0)])], 'Analyser', function (c) { fieldAfter(c, 'Engraissement par bord (mm) :').text = '0,04'; });
check(/0,040 mm/.test(a[0]), 'comma decimal ' + a[0]);
check(/form=V/.test(FILES['/tmp/ud/PiegesEncre.ini'] || '') && /spread=0,04/.test(FILES['/tmp/ud/PiegesEncre.ini']), 'settings saved ' + FILES['/tmp/ud/PiegesEncre.ini']);
// 14. annuler / cancel
var d7 = Doc([Vpath(0)]); a = runScript([d7], 'Annuler'); check(a.length === 0 && d7.layers.length === 0, 'cancel');
// 15. effacer les repères / clear markers (works without selection)
d.selection = []; a = runScript([d], 'Effacer les repères', null, null, true); check(!layerNamed(d, MARK) && /Repères effacés/.test(a[0]), 'clear markers ' + a);
// 16. réglages relus / settings reloaded
runScript([Doc([Vpath(0)])], 'Analyser', function (c) { dd(c, 2).selection = 2; });
var seen = null; runScript([Doc([Vpath(0)])], 'Annuler', function (c) { seen = dd(c, 2).selection.index; }, null, true); check(seen === 2, 'settings reloaded (form flat) ' + seen);
// 17. anglais / English
a = runScript([Doc([Vpath(0)])], 'Analyse', null, 'en_US'); check(/acute joint\(s\) found/.test(a[0]) && /0\.060 mm/.test(a[0]), 'EN ' + a[0]);
a = runScript([], 'Analyse', null, 'en_US'); check(/No document open/.test(a[0]), 'EN noDoc');
// 18. formes sans jonction / no joint
a = runScript([Doc([polyPath([[0,0],[100,0],[100,100],[0,100]])])], 'Analyser'); check(/Aucune jonction aiguë/.test(a[0]) && /Unir/.test(a[0]), 'none + hint ' + a[0]);
console.log('mockdom checks', checks, 'fails', fails);
