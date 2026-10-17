# Pièges à encre — PiegesEncre.jsx

Script Adobe Illustrator (ExtendScript) qui **pose automatiquement des pièges à encre** (*ink traps*) dans les **jonctions aiguës** d'un lettrage, d'un logo ou d'un jeu de pictos **vectorisés**. Il trouve tous les coins rentrants où l'encre va boucher (creux du V, du W, du M, jonction arche/fût du n et du m, contreformes pointues du A, du 4…) et y creuse une petite encoche le long de la bissectrice. **La taille de l'encoche est calculée à partir du procédé d'impression** (engraissement de l'encre et taille réelle imprimée), pour qu'après impression le coin redevienne net.

Les éditeurs de polices font cela (FontLab, plugins Glyphs et RoboFont). Dans Illustrator, il fallait jusqu'ici le faire à la main, coin par coin, et à l'œil.

> ⚠️ **Non testé dans Illustrator.** La syntaxe et la logique ont été vérifiées hors d'Illustrator (voir « État des tests »). Travaillez sur une **copie** de votre fichier.

## Ce que fait le script

1. **Trouve les jonctions** de chaque forme remplie fermée (tracé, tracé transparent, groupe ; textes vectorisés à la demande). Un coin est retenu si :
   - il est rentrant (le creux est blanc, la pointe opposée est dans l'encre ; règles non nul et pair-impair respectées, formes voisines comprises) ;
   - son angle est inférieur à l'angle maximal (100° par défaut) ;
   - il est anguleux (les tangentes viennent des poignées, donc les jonctions courbes, comme l'arche d'un n, sont comprises).
2. **Calcule l'encoche** :
   - **Selon le procédé** : vous choisissez un engraissement par bord (préréglages *indicatifs* : offset couché, non couché/journal, numérique, flexo, sérigraphie, tampon, laser, ou valeur personnalisée) et la taille réelle (document à 100 %, ou hauteur ou largeur imprimée de la sélection en mm). Dans un creux d'angle α, un engraissement *s* bouche une longueur *s / sin(α/2)*. Le script creuse plus profond que cette zone et ouvre l'encoche juste assez pour que **le coin dessiné reste à une distance ≥ s × (1 + marge) de l'encre après engraissement**.
   - **Style graphique** : des pièges visibles, avec une profondeur en % de l'épaisseur du fût et une demi-ouverture en degrés.
   - **Forme** : en V (conique), en U (fond arrondi par un vrai arc de Bézier) ou en fente à fond plat.
3. **Garde le dessin sain** :
   - la profondeur est limitée par l'épaisseur du fût (rayon lancé dans l'encre) et par la longueur des segments voisins ;
   - une encoche qui croiserait un autre bord ou une autre encoche est réduite, la plus grande d'abord, ou abandonnée (« impossible ») ;
   - un piège trop petit pour compenser l'engraissement est signalé (dessin trop petit à cette taille d'impression).
4. **Analyser** (ne modifie rien) : sur un calque **non imprimable** « Pièges à encre — repères », un cercle par jonction (rouge < 45°, orange < 75°, ambre au-delà), l'aperçu de l'encoche en pointillé magenta, la zone qui va boucher (losange rouge) et des étiquettes « angle · profondeur ». Un **rapport .txt** peut aussi être enregistré.
5. **Poser les pièges** :
   - remplace chaque coin par l'encoche ; les segments droits restent droits, les courbes sont coupées sans être déformées (De Casteljau) ;
   - copie les originaux sur un calque masqué et verrouillé « Pièges à encre — originaux » ;
   - note les pièges posés dans la note de l'objet (`[PiegesEncre] …`), pour qu'un **2ᵉ passage ne repique pas** les mêmes coins ;
   - les repères deviennent verts (posé), orange (réduit), gris (impossible) ou bleus (déjà piégé).
6. **Effacer les repères** : supprime le calque de repères (pas besoin de sélection).

## Pourquoi c'est nouveau

Recherches faites le 17/10/2026 (moteurs de recherche, GitHub, Adobe Community, Reddit r/AdobeIllustrator, Graphic Design Stack Exchange, auteurs connus : creold, Sato/shspage, Wundes, Ladygin, wckdtall, Kelso ; boutiques : aescripts, Astute Graphics) :

- **Aucun script ni plugin Illustrator ne pose de pièges à encre.** Sur GitHub, aucun dépôt « ink trap illustrator » et aucun fichier .jsx Illustrator qui le fasse (les résultats parlent du *trapping* d'InDesign, qui est autre chose). Sur Reddit et Adobe Community, la réponse donnée est de déplacer le point à la main.
- Les scripts proches font autre chose :
  - `notches.jsx` (shspage) trace des traits de graduation le long de segments ;
  - `MakeTrappingStroke` (creold) ajoute un contour de grossi-maigri (*trapping* couleur), pas d'encoche dans un coin ;
  - les arrondis de coins (natif, VectorScribe Dynamic Corners, ShapeRounder) arrondissent un coin mais ne le creusent pas.
- Les outils de pièges à encre existent **seulement dans les éditeurs de polices** : FontLab (Smart Corners, action « Add Ink Traps »), Glyphs (Corner Components, plugins inktrapeze et InkTrapGenerator), RoboFont (RoundingUFO), FontCreator (Corner Decorations). Ils demandent une profondeur fixe ou en % de fût choisie à l'œil.
- **Ce qui est nouveau ici**, même par rapport aux éditeurs de polices :
  - le calcul de la taille à partir de l'engraissement réel et de la taille imprimée, avec vérification que le coin reste blanc ;
  - l'aperçu de la zone qui va boucher ;
  - le refus des encoches qui croiseraient un bord ;
  - la mémoire des pièges posés ;
  - le tout dans Illustrator, sur des logos et pictos et pas seulement sur des glyphes.

## Installation

1. Téléchargez `PiegesEncre.jsx`.
2. Soit **Fichier > Scripts > Autre script…** (Ctrl+F12 / Cmd+F12) et choisissez le fichier ;
3. soit copiez-le dans le dossier des scripts puis redémarrez Illustrator (il apparaît dans **Fichier > Scripts**) :
   - Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\<langue>\Scripts\`
   - macOS : `/Applications/Adobe Illustrator <version>/Presets.localized/<langue>/Scripts/`

## Utilisation

1. Vectorisez le texte (ou cochez « Vectoriser les textes sélectionnés »). **Unissez** les formes qui se chevauchent (Pathfinder > Unir) : sans point à la jonction, il n'y a pas de coin à piéger.
2. Sélectionnez le lettrage, le logo ou les pictos, puis lancez le script.
3. Choisissez la méthode, puis cliquez sur **Analyser** pour voir les encoches prévues, et enfin sur **Poser les pièges**.

| Réglage | Par défaut | Rôle |
|---|---|---|
| Procédé / Engraissement par bord | Flexographie, 0,06 mm | engraissement de l'encre de chaque côté d'un bord, à l'impression (valeurs indicatives : demandez-les à votre imprimeur) |
| Taille réelle | document à 100 % | ou hauteur / largeur imprimée de la sélection en mm (un logo de 35 mm dessiné à 200 mm) |
| Marge de sécurité | 20 % | le coin reste à s × 1,2 de l'encre après engraissement |
| Style : profondeur / demi-ouverture | 25 % du fût / 12° | pièges visibles, choisis à l'œil |
| Angle maximal du creux | 100° | les creux plus ouverts ne bouchent pas |
| Seulement les coins sélectionnés | non | ne piège que les points choisis à la Sélection directe |
| Ignorer les pièges déjà posés | oui | lit la note de l'objet |
| Forme | en V | V, U (fond arrondi) ou fente à fond plat |
| Profondeur maximale | 50 % de l'épaisseur | garde-fou pour les fûts fins |
| Unité, repères, étiquettes, copie des originaux, rapport | mm, oui, oui, oui, non | sortie |

Les réglages sont mémorisés dans `PiegesEncre.ini` (dossier des données utilisateur). L'interface est en français, ou en anglais si Illustrator n'est pas en français.

## Limites connues

- Seuls les **coins existants** sont piégés. Deux formes superposées non unies, ou un trait non vectorisé, n'ont pas de jonction (le script le rappelle). Les textes sont piégés après vectorisation.
- Les préréglages d'engraissement sont des **ordres de grandeur** : ils varient selon la machine, le papier, l'encre et la trame. Faites un essai.
- Une encoche en U, ou très ouverte, enlève plus de matière qu'une encoche en V : vérifiez à l'œil les petits corps.
- Les coins très rapprochés (deux jonctions d'un k collées sur le fût) reçoivent des pièges réduits, voire aucun.
- Les apparences dynamiques (effets, contours de forme) ne sont pas lues ; développez-les d'abord.
- Les annulations : toutes les modifications d'une exécution se font d'un bloc, mais leur annulation en un seul *Édition > Annuler* n'a pas été vérifiée. Gardez une copie du fichier.

## Version ciblée

Illustrator CC 2018 → 2026 (Windows et macOS), ExtendScript ES3, interface ScriptUI. Aucun appel réseau, aucune collecte de données.

## État des tests

**Non testé dans Illustrator.** Tests effectués sur la machine de développement (scripts dans `tests/`) :

- **Syntaxe** : analyse par acorn en ECMAScript 3 et 5, sans erreur.
- **Moteur** (`tests/engine.js`) : 11 695 vérifications, 0 échec. Cas couverts :
  - détection sur des lettres V, W, M, n (arche courbe) et A (contreforme, non nul et pair-impair) ;
  - 36 combinaisons forme × méthode × tracé ;
  - 300 étoiles aléatoires tournées (1 604 pièges complets, 39 réduits) ;
  - contreformes, bras fins, segments courts, mémoire des pièges.
  - À chaque fois, le script vérifie : pas de nouvelle auto-intersection, autres points inchangés, forme piégée incluse dans l'originale, fond de l'encoche dans l'encre. Pour le mode procédé, il vérifie aussi par **simulation de l'engraissement** que le coin d'origine est bien à ≥ s × (1 + marge) de la nouvelle forme.
- **Vraies polices** (`tests/fonts.py` + `tests/fonttest.js`) : 216 glyphes (AKMNVWXYZkmnvwxyz4) de 12 polices (DejaVu, Liberation, polices Google), contours lus par fontTools.
  - Avec le réglage V/procédé : 529 jonctions, dont 197 pièges complets, 283 réduits et 49 impossibles.
  - Avec 4 réglages par glyphe, plus la vérification qu'un 2ᵉ passage ne pose rien de nouveau : 30 445 vérifications, 0 échec.
- **DOM Illustrator et ScriptUI simulés** (`tests/mockdom.js`) : 41 vérifications, 0 échec. Cas couverts :
  - pas de document, rien de sélectionné, texte en cours d'édition, tracés ouverts et traits ;
  - Analyser sans rien modifier ;
  - Poser avec copie des originaux, note et rapport ; 2ᵉ passage sans effet ;
  - coins sélectionnés ; texte vectorisé (copie temporaire pour l'analyse) ;
  - style + U en CMJN et en pt ; taille imprimée ;
  - saisie invalide et virgule décimale, Annuler, Effacer les repères, réglages mémorisés et relus, interface anglaise.
- **Tests par mutation** (`tests/mutation.py`) : sur 15 erreurs volontaires, 13 sont détectées. Les 2 autres :
  - suppression du seuil de rotation minimale : sans effet, car elle est couverte par l'angle maximal ≤ 170° ;
  - tolérance d'extrémités commune élargie : sans effet visible sur les cas testés.

Si vous l'essayez dans Illustrator, signalez le résultat dans une *issue*.

## Licence

MIT — © 2026 Amirouche Amwanes. Code 100 % original.
