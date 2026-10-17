# Tests (hors Illustrator)

Ces tests tournent avec **node** (et Python 3 + fontTools pour les vraies polices). Ils ne remplacent pas un essai dans Illustrator.

| Fichier | Contenu |
|---|---|
| `lib.js` | formes de test (V, W, M, n, A avec contreforme, étoiles), outils géométriques |
| `verify.js` | vérifications communes : pas de nouvelle auto-intersection, points d'origine gardés, nouvelle forme incluse dans l'ancienne, fond de l'encoche dans l'encre, distance ≥ engraissement |
| `engine.js` | moteur : détection des jonctions, 36 cas de lettres, simulation d'engraissement, 300 étoiles aléatoires tournées, contreformes, bras fins, segments courts, mémoire des pièges |
| `fonts.py` → `fontdata.json` | extrait 216 glyphes de 12 polices installées (DejaVu, Liberation, polices Google) avec fontTools |
| `fonttest.js` | pièges sur ces glyphes avec 4 réglages + vérification qu'un 2ᵉ passage ne change rien |
| `mockdom.js` | faux DOM Illustrator + faux ScriptUI : messages, Analyser, Poser, 2ᵉ passage, texte vectorisé, réglages, anglais… |
| `mutation.py` | 15 erreurs volontaires dans le script, chacune doit faire échouer `engine.js` ou `mockdom.js` |

```
npx acorn --ecma3 --silent PiegesEncre.jsx
node tests/engine.js
python3 tests/fonts.py && node tests/fonttest.js
node tests/mockdom.js
python3 tests/mutation.py
```
