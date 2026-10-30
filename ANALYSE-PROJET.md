# Analyse du projet — 30 octobre 2026

## Objectif et conclusion

Objectif confirmé par l’utilisateur pendant cet audit : reproduire fidèlement la vitrine publique Sberbank. Les liens de navigation publique doivent mener au site officiel. La référence du projet est l’accueil russe `/ru/person`, conservé dans les captures, le DOM et les configurations du dossier `references/home`.

Le projet est une intégration front-end déjà substantielle : toutes les grandes sections de l’accueil sont présentes, avec données, images, polices, responsive et plusieurs interactions. Il compile en production. Ce n’est pas encore une reproduction dont tous les états et tous les détails visuels sont certifiés. La priorité est la consolidation de la fidélité et des contrôles, sans ajouter de fonctionnalités étrangères au périmètre.

Il n’existe dans le code applicatif inspecté ni backend métier, ni base de données, ni authentification locale, ni parcours d’inscription, ni traitement de paiement. Leur absence est cohérente avec l’objectif confirmé.

## Périmètre et méthode

- Lecture du code TypeScript/TSX de l’application, de la configuration et des styles locaux ; inspection des styles de référence et de leur cascade.
- Lecture structurée des quatre JSON applicatifs, contrôle de leurs références de ressources et examen des données non consommées.
- Lecture des notes, validations et scripts de préparation/vérification disponibles localement, y compris ceux ignorés par Git.
- Inspection du statut et de l’historique Git, sans modifier les changements préexistants.
- Consultation de la documentation livrée dans `node_modules/next/dist/docs`, notamment sur les composants serveur/client, le CSS et Partial Prefetching.
- Compilation de production, contrôle ESLint, test du catalogue de recherche et vérifications dans Edge sans interface graphique sur la version compilée.

Les dépendances installées et les gros bundles tiers archivés ne sont pas assimilés au code écrit pour ce projet : cet audit ne prétend pas être une revue ligne par ligne de React, Next.js ou de Swiper. Les PNG/JPEG/WebP/WOFF2 sont des ressources binaires, contrôlées comme telles. Les captures locales consultées et les tests actuels ne constituent pas une comparaison exhaustive avec le site officiel en direct.

## Architecture et circulation des données

`layout.tsx` fournit le document russe et les métadonnées. `/` rend `Home` ; `/ru/person` réexporte exactement la même page. `Home` et `Header` sont des composants client, pré-rendus en HTML statique pendant la compilation puis hydratés dans le navigateur.

`Home` importe `home-data.json`. `Header` importe sa configuration, les régions et le catalogue de recherche. Les contenus sont des instantanés locaux ; aucun CMS ni service de contenu n’est interrogé au chargement. Les interactions sont pilotées par l’état React. Le carrousel confiance charge une distribution locale de Swiper par une balise script ajoutée dans un effet.

`officialHref` transforme les chemins commençant par un seul `/` en URL `https://www.sberbank.ru/...`. Les URL absolues et protocoles tels que `tel:` restent inchangés. Cela évite de naviguer vers des pages produit locales inexistantes et correspond au choix confirmé de l’utilisateur.

La recherche du header filtre localement 66 produits par mots-clés, dans l’ordre du catalogue, avec trois résultats maximum. La soumission complète et la recherche du bloc questions renvoient vers le site officiel. Il n’y a pas de conversation GigaChat locale.

## État par fonctionnalité

| Élément | Présent | Limite actuelle |
| --- | --- | --- |
| Header fixe et comportement au scroll | Oui | Parité visuelle de tous les états à revalider |
| Menu principal et sous-menus | 25 entrées principales | Perte de focus à l’ouverture d’un sous-menu |
| Menus supplémentaires et applications | Oui | Anciennes vérifications partiellement obsolètes |
| Catalogue de recherche | 66 produits | Filtrage local ; pas de moteur distant intégré |
| Régions | 89 noms, filtre russe et conversion clavier latin | Sélection en mémoire uniquement ; pas de personnalisation des offres |
| Segments d’audience | 5 segments utilisés | Autres variantes présentes dans le JSON mais non rendues |
| Héro | Oui, portrait de référence | Portrait choisi explicitement selon les notes locales |
| Stories principales | 7 groupes, 11 diapositives | Navigation manuelle ; durée configurée non consommée |
| Nouveautés | 5 cartes | Stories GigaChat liées à l’index fixe 4 |
| Produits en accès rapide | 8 cartes | Navigation vers les destinations officielles |
| Raccourcis de services | 4 visuels avec états de survol/focus | Calculateur et installation sans action au clic |
| Bloc confiance | Desktop et carrousel mobile/tablette | Vérification complète des géométries selon hauteur à conserver |
| Questions et suggestions | Champ et 6 suggestions | Navigation vers la recherche officielle |
| Évaluation | 3 notes, commentaire limité à 300 caractères | Envoi volontairement désactivé ; aucun stockage |
| Footer clair | 4 colonnes, 53 liens | Références de tests à adapter aux liens officiels |
| Footer sombre | Navigation, mentions, contacts, applications, réseaux, langue | Métriques typographiques de base non certifiées |

## Carte des fichiers applicatifs

Les lignes ci-dessous correspondent à l’état lu lors de l’audit, avant toute modification applicative.

| Fichier | Rôle et observations |
| --- | --- |
| `src/app/layout.tsx` | Lignes 1–7 : import CSS et métadonnées russes/favicons. Lignes 9–15 : document `lang="ru"`. Le type global `LayoutProps` est accepté par la compilation de cette version de Next. |
| `src/app/page.tsx` | Lignes 1–21 : frontière client, imports des données/styles, types Swiper et stories. Lignes 23–36 : états et sélection des slides. Lignes 38–45 : ouverture/fermeture du dialogue et verrouillage du scroll. Lignes 47–55 : apparition du bloc confiance. Lignes 56–82 : chargement et destruction de Swiper. Lignes 83–88 : navigation entre stories. Lignes 90–152 : alerte, héro, stories, nouveautés, produits et raccourcis. Lignes 153–197 : confiance, questions et évaluation. Lignes 199–234 : les deux footers. Lignes 235–240 : dialogue de stories. Le composant concentre presque toute la page et ses comportements. |
| `src/app/header.tsx` | Lignes 1–24 : imports, modèles de menus, abonnements au scroll et au breakpoint 1366 px. Lignes 26–38 : SVG. Lignes 40–68 : états, résultats, ouverture et fermeture. Lignes 70–108 : scroll, Échap, tabulation, clic extérieur et focus. Lignes 110–134 : rendu des menus, recherche et liens. Lignes 135–139 : filtre des régions avec conversion clavier. Lignes 141–168 : header fermé/ouvert, sous-menus et fenêtres régions/segments. À surveiller : focus lors du changement de `activeSection`, sémantique clavier des menus et combobox. |
| `src/app/header-search.ts` | Lignes 3–8 : correspondance partielle sur au moins un mot, ordre du catalogue, limite de trois. Lignes 10–13 : destination exacte par nom ou mot-clé, sinon fallback. Logique simple et cohérente avec l’intention documentée. |
| `src/app/official-href.ts` | Surcharges pour chaîne définie ou optionnelle ; conversion des chemins publics. Le commentaire évoque une inscription locale absente du dépôt : commentaire à corriger ultérieurement. |
| `src/app/ru/person/page.tsx` | Réexport de l’accueil. Deux URL servent donc le même contenu. Aucun redirect ni canonical explicite. |
| `src/app/home-data.json` | Configuration de toutes les sections de la page, données sources et valeurs de présentation. Contient aussi les anciens `moreLinks`, `menuLinks`, `menu`, désormais non utilisés par le header courant, ainsi que des paramètres de fenêtres non implémentées. |
| `src/app/header-data.json` | 14 liens supérieurs, 3 applications, 5 segments utilisés et 25 entrées de menu. Conserve des options source non implémentées, notamment `customSegments` et `objectModelItems`. Le flag `objectModelEnabled` vaut true, mais le rendu local n’implémente pas toute cette variante. Comparaison de référence nécessaire avant d’y voir une erreur de produit. |
| `src/app/header-search-data.json` | 66 produits, destinations, icônes et mots-clés. Les icônes du catalogue existent localement. Attention au nom de fichier contenant un caractère cyrillique dans `сredit_icon.svg`. |
| `src/app/header-regions.json` | Liste locale de 89 régions. La sélection ne persiste pas au rechargement. |
| `src/app/globals.css` | Polices principales, reset réduit, couleurs de fond et focus global. `textarea` ne fait pas partie du sélecteur global de focus ; son état est géré dans les styles du formulaire. |
| `src/app/home.css` | Héro, stories, nouveautés, produits et responsive. Contient aussi des styles d’un ancien header (`.site-header`, `.brand`, `.main-menu`, etc.) absents du JSX actuel. Ne pas supprimer indistinctement les styles de référence : certains appartiennent à des états conditionnels. |
| `src/app/header-reference.css` | 862 lignes, 499 règles CSS : styles publics extraits du header, variantes, responsive, fenêtres, animations, régions et recherche. Les polices ont été renommées pour isoler le header. Nombreuses variantes non rendues actuellement. |
| `src/app/header.css` | Adaptation des règles de référence à React, reset des boutons, focus, états ouverts, positionnement, abonnements visuels au scroll, responsive et mouvement réduit. À maintenir après le CSS de référence. |
| `src/app/quick-actions.css` | Composition et animations des quatre raccourcis ; styles partagés entre survol et focus. Utilise `zoom` pour les tailles intermédiaires. Valeurs financières de démonstration figées. |
| `src/app/trust-reference.css` | Styles extraits des cartes confiance, de leur apparition et du slider ; dépend à la fois de la largeur et de la hauteur du viewport. |
| `src/app/trust.css` | Intégration locale, polices, fond, visibilité desktop à partir de 1366 px, carte mobile et mouvement réduit. |
| `src/app/questions-reference.css` | Styles des questions, champ, fonds et suggestions ; tailles responsive reprises de la référence. |
| `src/app/questions.css` | Variables de fonds/couleurs, correctifs de largeur, espacement de l’évaluation et intégration du formulaire. |
| `src/app/feedback-reference.css` | Boutons de notation, animation de sélection, infobulles, textarea et compteur. L’infobulle est déclenchée dans React par la souris, sans état de focus équivalent. |
| `src/app/footer-links.css` | Styles du footer clair et police Medium isolée. Titres et liens gardent leurs comportements distincts. |
| `src/app/footer-dark-reference.css` | Styles fournis pour le footer sombre, styles de liens génériques limités à ce footer avec `:where`, responsive et états de survol. Les styles de base `.dk-sbol-text` ne sont pas intégralement présents. |
| `src/app/footer-dark.css` | Polices du footer sombre et neutralisation des transitions en mouvement réduit. |
| `src/app/favicon.ico` | Icône servie via la convention de fichier Next. |

## Configuration, ressources et outillage

| Fichier ou dossier | Analyse |
| --- | --- |
| `package.json` | Next 16.4.0, React/React DOM 19.3.0 ; TypeScript strict et ESLint 9. Scripts dev/build/start/lint uniquement. Aucun script de test déclaré. |
| `package-lock.json` | Verrouillage npm présent. Ne pas le modifier lors d’une intervention visuelle sans changement de dépendances. |
| `next.config.ts` | Indicateur dev désactivé, origine de dev 127.0.0.1 autorisée, Cache Components et Partial Prefetching activés. Options acceptées par le build local. Peu de bénéfice actuel du prefetch sur une vitrine dont les liens sont des ancres externes. |
| `tsconfig.json` | Mode strict, résolution bundler, import JSON, alias `@/*`, inclusion des types générés Next. `skipLibCheck` ne valide pas les déclarations des dépendances. |
| `eslint.config.mjs` | Base Next/TypeScript correcte ; exclusions insuffisantes pour les références et le vendor. Ne reprend pas automatiquement les exclusions de `.gitignore`. |
| `.gitignore` | Exclut `references/`, `scripts/`, `verification/`, sorties de build et fichiers locaux. Les preuves de validation et le processus de préparation disparaissent d’un clone frais. |
| `AGENTS.md` | Oblige à consulter la documentation de la version Next installée avant de coder. Instruction prise en compte. |
| `README.md` | README create-next-app générique ; mentionne encore Geist alors que le projet utilise SBSans. N’explique ni la fidélité recherchée, ni les données figées, ni les limites, ni les contrôles locaux. |
| `public/` | 128 fichiers : images, SVG, polices, vendor Swiper et quelques ressources du squelette Next inutilisées. Les ressources réellement affichées ont chargé pendant les contrôles actuels. |
| `public/vendor/swiper/` | Swiper 12.2.0 avec licence MIT ; bibliothèque chargée localement. Son minifié n’a pas à être soumis aux règles de style du code applicatif. |
| Fichiers à la racine `1778653460576.svg`, `favicon.ico`, `favicon-32x32.png` | Fichiers fournis utilisés comme sources de copie par les scripts historiques. Ils ne sont pas tous servis directement depuis la racine. |
| `next-env.d.ts`, `tsconfig.tsbuildinfo`, `.next/`, `node_modules/` | Fichiers générés, cache et dépendances ; ne constituent pas une spécification métier. |

## Scripts et références locales

Les scripts de préparation ne doivent pas être relancés aveuglément : ils écrivent dans les données et styles applicatifs, plusieurs remplacent des fichiers entiers, et ils dépendent de chemins absolus de pièces jointes ou de fichiers temporaires propres à cette machine. Certains téléchargements historiques utilisent HTTP ou désactivent la vérification TLS. Cela concerne l’outillage de récupération, pas un appel exécuté par la vitrine au chargement.

| Script | Fonction |
| --- | --- |
| `extract-header-data.cjs` | Décode les données compactées du DOM fourni sans exécuter le JavaScript source. |
| `extract-menu.cjs` | Extrait l’ancien arbre de navigation vers `home-data.json`. |
| `prepare-reference.cjs` | Archive le DOM et les tokens fournis, copie logos/favicons, prépare les premières données et ressources. Peut écraser les sections ajoutées ensuite si relancé. |
| `prepare-header-source.cjs` | Télécharge et analyse statiquement les bundles du header pour récupérer le CSS. |
| `prepare-header.cjs` | Prépare configuration, 89 régions, CSS et ressources du header inspecté. |
| `prepare-header-search.cjs` | Extrait le catalogue littéral de 66 produits et récupère les icônes. |
| `prepare-launcher.cjs` | Intègre les huit cartes produit depuis la configuration source. |
| `prepare-novelties.cjs` | Intègre les nouveautés, stories et ressources associées. |
| `prepare-quick-actions.cjs` | Extrait les visuels/hover et fixe les taux de la capture. |
| `prepare-trust.cjs` | Extrait données et CSS confiance, récupère les ressources. |
| `prepare-questions.cjs` | Extrait questions, formulaire CSAT, SVG et styles ; exclut deux sélecteurs placeholder invalides. |
| `prepare-footer-links.cjs` | Extrait quatre colonnes et 53 liens du HTML fourni. |
| `prepare-dark-footer.cjs` | Extrait le footer sombre et neuf ressources ; déduplique et limite la portée du CSS. |
| `inspect-dark-footer.cjs` | Tente de relever des styles sur le site officiel ; les notes signalent un blocage WAF lors des tentatives historiques. |
| `test-header-search.cjs` | Vérifie le filtre et les icônes ; 278 cas passent actuellement. Beaucoup d’attendus recopient l’algorithme : valeur limitée pour détecter une mauvaise règle métier. |
| `verify-home.cjs` | Vérification historique de l’accueil ; contient des sélecteurs d’ancien header et des liens locaux devenus obsolètes. |
| `verify-novelties.cjs` | Textes, destinations, géométrie, responsive et stories GigaChat. Attendus de liens à adapter. |
| `verify-launcher.cjs` | Huit cartes, géométrie, focus, liens et responsive. Attendus de liens à adapter. |
| `verify-quick-actions.cjs` | Quatre visuels, valeurs, liens, animations, focus et mouvement réduit. Attendus de liens à adapter. |
| `verify-trust.cjs` | Cartes desktop, carrousel, glissement, pagination, responsive, focus et mouvement réduit. |
| `verify-questions.cjs` | Champ, suggestions, notation, limite de commentaire, bouton désactivé et recherche ; plusieurs contrôles restent utiles, mais l’ensemble n’a pas été relancé ici. |
| `verify-footer-links.cjs` | 53 liens, attributs, géométrie et responsive ; comparaison brute aux chemins source incompatible avec la nouvelle normalisation. |
| `verify-dark-footer.cjs` | Contenus, neuf assets, styles, responsive et contrôles de régression ; même problème d’attendus sur les liens. |

Ces scripts utilisent Playwright et Sharp via des chemins absolus vers le runtime Codex et un chemin Windows fixe vers Edge. Ils ne sont pas reproductibles par un simple `npm ci` sur une autre machine. Plusieurs ports sont codés en dur à 3100, parfois paramétrables.

`references/home/NOTES.md` conserve les décisions et l’intégration progressive des sections. Les validations questions/footer clair/footer sombre documentent des contrôles historiques, avec des périmètres différents selon leur date. Les HTML/CSS/JSON/bundles archivés permettent de retrouver les contenus source ; ils ne sont pas chargés comme scripts applicatifs. `verification/` et `references/home/verification/` conservent des captures et rapports de campagnes antérieures. Les anciens rapports ne prouvent pas automatiquement que l’état courant passe encore.

## Vérifications effectuées pendant cet audit

| Contrôle | Résultat actuel |
| --- | --- |
| `npm run build` | Réussi ; TypeScript réussi ; `/` et `/ru/person` pré-rendues statiquement |
| `npm run lint` | Échec : 142 erreurs et 2 597 avertissements, dans les références/bundles tiers et certains scripts CJS |
| `npx eslint src next.config.ts eslint.config.mjs --max-warnings 0` | Réussi sans avertissement |
| `node scripts/test-header-search.cjs` | 278 cas réussis ; icônes des 66 produits valides |
| HTTP des deux routes locales compilées | 200 sur les deux |
| Largeurs 320, 390, 768, 1024, 1282, 1424 et 1920 px | Pas de débordement horizontal détecté |
| Images affichées après chargement | Aucune manquante dans les parcours vérifiés |
| Menu, ouverture du sous-menu crédits, fermeture Échap | Fonctionnent ; retour de focus au bouton de menu après fermeture confirmé |
| Focus à l’entrée du sous-menu crédits | Défaut reproduit : `document.activeElement` devient `BODY` |
| Stories : ouverture, flèche droite, Échap | Fonctionnent |
| Commentaire de 301 caractères | Limité à 300 ; bouton d’envoi désactivé |
| Carrousel confiance à 390 px | Initialisé ; clic deuxième pagination → index 1 |
| Exceptions JavaScript et réponses HTTP en erreur | Aucune dans les parcours vérifiés |
| Requêtes externes déclenchées pendant ces parcours locaux | Aucune observée ; liens sortants non suivis |

Preuves actuelles : `verification/audit-current-report.json`, `verification/audit-current-desktop.png`, `verification/audit-current-mobile.png`. Script de diagnostic : `verification/audit-current.cjs`. Ces fichiers sont ignorés par Git comme le reste de `verification/`.

Le diagnostic attend le chargement des images et force leur chargement eager uniquement dans la page de test pour éviter de confondre lazy-loading et fichier cassé. Cela ne modifie pas le code de la vitrine. Les tests ne certifient ni tous les navigateurs, ni tous les états tactiles, ni une identité pixel à pixel avec la référence.

## Constats à traiter, par priorité

1. **Rendre les contrôles fiables.** Corriger le périmètre ESLint, préserver les scripts utiles dans Git, déclarer leurs dépendances et adapter les attendus aux URL officielles. Le build réussi et le lint ciblé ne doivent pas masquer l’échec de la commande standard.
2. **Corriger le focus des sous-menus.** `activeSection` remplace le contenu focalisé, mais l’effet de focus dépend uniquement de `popup` et `menuOpen`. Déplacer explicitement le focus vers Retour ou un titre focalisable lors du changement de niveau. Le défaut est reproduit, pas simplement supposé.
3. **Terminer la validation du footer sombre.** Les notes signalent l’absence des règles de base `.dk-sbol-text`, `_size_sm`, `_size_md`, particulièrement les hauteurs de ligne. Relever la source ou demander les règles manquantes avant d’inventer des valeurs et d’annoncer une fidélité parfaite.
4. **Valider les états interactifs face à la référence.** Stories : `skipSlideDuration` existe dans les données mais n’est jamais utilisé ; pas de timer ni de progression temporelle. Transitions de changement de sous-menu : le CSS possède des états d’animation non pilotés par React. Vérifier l’attendu exact avant implémentation.
5. **Réduire les couplages fragiles.** La carte stories nouveautés est retrouvée via `blocks[4]`, et le groupe spécial via `story === data.stories.length`. Des identifiants explicites seraient plus robustes si le contenu évolue. Préserver d’abord le rendu existant.
6. **Clarifier les données conservées mais non utilisées.** Huit ressources référencées par `customSegments`/`objectModelItems` sont absentes localement ; les composants actuels ne les affichent pas. Ne pas les annoncer comme huit images cassées visibles. Vérifier le besoin de ces variantes avant de les intégrer ou de retirer leur configuration.
7. **Améliorer la maintenabilité sans dégrader la fidélité.** Découper progressivement `Home` et le header, conserver l’ordre de cascade, éliminer le vieux CSS et les anciens menus seulement après contrôle. Une frontière client plus étroite éviterait d’envoyer autant de données statiques dans le JavaScript ; ce n’est pas un blocage actuel et aucune mesure de performance chiffrée n’est fournie ici.
8. **Mettre la documentation en accord avec le projet.** README, commentaire d’inscription dans `official-href.ts`, anciennes notes sur les liens locaux, procédures de test et limites documentées.

Autres points de lecture : le dialogue stories n’a pas de nom accessible explicite ; la combobox de recherche et les menus ne proposent pas toute la navigation fléchée attendue de ces rôles ; la note CSAT n’affiche son infobulle qu’à la souris. Ces points demandent une validation accessibilité dédiée. Les deux routes identiques n’ont pas de canonical explicite : à trancher avant une publication indexable.

## Limites intentionnelles à conserver tant que le périmètre ne change pas

- Envoi des avis désactivé : décision explicite dans les notes de validation.
- Fenêtres du calculateur et d’installation non intégrées : périmètre historique en attente de précision, sans action au clic dans le code courant.
- Taux EUR/USD et montants issus de la capture : données visuelles figées, sans actualisation financière.
- Pas de traceurs ni d’API privée bancaire dans les interactions locales inspectées.
- Navigation publique vers le site officiel : choix confirmé lors de cet audit.

## État Git et conduite de la suite

Au début de l’audit, `src/app/header.tsx` et `src/app/page.tsx` étaient modifiés et `src/app/official-href.ts` était non suivi. Ces changements remplacent les destinations publiques locales par des URL officielles. Ils ont été conservés intacts. L’historique visible montre quatre étapes : header/héro, footer sombre, catalogue d’origine, puis menus/listes déroulantes.

Aucune modification du code applicatif n’a été faite pendant l’analyse. Seuls ce rapport et les diagnostics/preuves dans le dossier ignoré `verification/` ont été ajoutés. Le serveur de production temporaire de l’audit utilise le port 3197 et doit être arrêté à la fin de la session.

Pour la suite : rester dans la reproduction fidèle, utiliser les références déjà fournies, consulter les guides de la version Next installée avant les changements, vérifier chaque section et ses interactions après modification, et demander une précision dès qu’une information manquante influence le résultat visuel ou fonctionnel. Les absences documentées ne doivent pas être comblées par des comportements inventés.
