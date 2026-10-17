# Tests par mutation : chaque erreur volontaire doit être détectée
# Mutation tests: each injected bug must be caught
import subprocess, os, tempfile
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
src=open('PiegesEncre.jsx').read()
M=[
 ("var sg = o.m * s / d, gMax = 0.8 * h;","var sg = s / d, gMax = 0.8 * h;"),
 ("P.fill = s / Math.sin(h);","P.fill = s * Math.sin(h);"),
 ("P.a = den > 1e-9 ? P.dEff * Math.tan(g) / den : Infinity;","P.a = den > 1e-9 ? P.dEff * Math.tan(g) : Infinity;"),
 ("if (alpha > o.maxAngle) { continue; }","if (alpha > o.maxAngle + 60) { continue; }"),
 ("if (need > 0.8 * L) {","if (need > 1.8 * L) {"),
 ("P.r = 0.45 * d * Math.tan(g); P.dEff = d + P.r * (1 / Math.sin(g) - 1);","P.r = 0.45 * d * Math.tan(g); P.dEff = d;"),
 ("bad = badNotches(built, others); worst = null;","bad = {}; worst = null;"),
 ("var e = 1e-7;","var e = 0.5;"),
 ("o.spreadPrint = sPt; o.scale = scale; o.spread = sPt / scale;","o.spreadPrint = sPt; o.scale = scale; o.spread = sPt;"),
 ("if (cfg.backup === 'true' && !sh.fromText) { backupItem(doc, sh.ref, bk); }","if (cfg.backup === 'true' && !sh.fromText) { }"),
 ("try { sh.ref.note = PE.writeMemo(getNote(sh.ref), sh.memo); } catch (e) { }",""),
 ("q.leftDirection = [pts[i].l[0], pts[i].l[1]];","q.leftDirection = [pts[i].a[0], pts[i].a[1]];"),
 ("if (theta > Math.PI - o.minTurn * DEG || theta < 0.5 * DEG) { continue; }","if (theta < 0.5 * DEG) { continue; }"),
 ("if (cfg.onlySel === 'true' && !acc.anySel) { removeTemps(acc); alert(T.noPts); return; }",""),
 ("lay.printable = false;","lay.printable = true;"),
]
tmp=tempfile.mkdtemp()
killed=0
for i,(a,b) in enumerate(M):
    assert src.count(a)>=1, a
    p=os.path.join(tmp,'m%d.jsx'%i); open(p,'w').write(src.replace(a,b,1))
    env=dict(os.environ,PEF=p); det=False
    for t in ['tests/mockdom.js','tests/engine.js']:
        try:
            r=subprocess.run(['node',t],env=env,capture_output=True,text=True,timeout=300)
            out=r.stdout+r.stderr
            if r.returncode!=0 or 'FAIL' in out: det=True; break
        except subprocess.TimeoutExpired: det=True; break
    killed+=det; print(i,'detected' if det else 'SURVIVED',a[:60])
print('killed',killed,'/',len(M))
