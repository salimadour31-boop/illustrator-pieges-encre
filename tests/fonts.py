# Extrait des contours de vraies polices pour les tests (fontTools)
# Extracts real font outlines for the tests (fontTools)
import json, os
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
G = "/usr/share/fonts/truetype/sand-box/google/"
FONTS = ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
         "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
         G+"Barlow/Barlow-Regular.ttf", G+"Lato/Lato-Regular.ttf", G+"PT Sans/PTSans-Regular.ttf", G+"Poppins/Poppins-Regular.ttf",
         G+"Ubuntu/Ubuntu-Regular.ttf", G+"Hammersmith One/HammersmithOne-Regular.ttf", G+"Michroma/Michroma-Regular.ttf",
         G+"Quattrocento/Quattrocento-Regular.ttf", G+"Martel/Martel-SemiBold.ttf"]
CHARS = "AKMNVWXYZkmnvwxyz4"
class P(BasePen):
    def __init__(s, gs, sc):
        BasePen.__init__(s, gs); s.sc = sc; s.contours = []; s.cur = None
    def T(s, p): return [p[0]*s.sc, p[1]*s.sc]
    def _moveTo(s, p):
        q = s.T(p); s.cur = [{'a': q, 'l': q[:], 'r': q[:]}]; s.contours.append(s.cur)
    def _lineTo(s, p):
        q = s.T(p); s.cur.append({'a': q, 'l': q[:], 'r': q[:]})
    def _curveToOne(s, c1, c2, p):
        s.cur[-1]['r'] = s.T(c1); q = s.T(p); s.cur.append({'a': q, 'l': s.T(c2), 'r': q[:]})
    def _qCurveToOne(s, c, p):
        p0 = s._getCurrentPoint()
        c1 = (p0[0]+2/3*(c[0]-p0[0]), p0[1]+2/3*(c[1]-p0[1])); c2 = (p[0]+2/3*(c[0]-p[0]), p[1]+2/3*(c[1]-p[1]))
        s._curveToOne(c1, c2, p)
    def _closePath(s):
        c = s.cur
        if len(c) > 1 and abs(c[-1]['a'][0]-c[0]['a'][0]) < 1e-9 and abs(c[-1]['a'][1]-c[0]['a'][1]) < 1e-9:
            c[0]['l'] = c[-1]['l']; c.pop()
    _endPath = _closePath
out = []
for fp in FONTS:
    if not os.path.exists(fp): continue
    f = TTFont(fp); gs = f.getGlyphSet(); cmap = f.getBestCmap(); sc = 100.0/f['head'].unitsPerEm
    name = os.path.basename(fp).split('.')[0]
    for ch in CHARS:
        gn = cmap.get(ord(ch))
        if gn is None: continue
        pen = P(gs, sc); gs[gn].draw(pen)
        out.append({'font': name, 'ch': ch, 'contours': [c for c in pen.contours if len(c) >= 3]})
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fontdata.json'), 'w'))
print(len(out), 'glyphs')
