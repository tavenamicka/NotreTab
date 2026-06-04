# NotreTab — Suivi du projet

> Dernière mise à jour : 2026-05-29 — Sprint OPT2 : Qualité, sécurité, données

---

## Vue d'ensemble

**NotreTab** est une application web de partage de dépenses en groupe (type Splitwise), développée en React + Vite avec json-server comme backend local de développement.

- **Stack** : React 18, Vite 5, json-server 0.17, Vitest, bcryptjs
- **Lancer** : `npm install && npm run dev` → http://localhost:5173
- **Tests** : `npm test`
- **Compte admin** : `mtavenart@ikmail.com / Admin2025!` — mot de passe hashé bcrypt, flag `superAdmin: true`

---

## Architecture

```
src/
├── main.jsx              — Racine React (ToastProvider > AuthProvider > AppProvider > App)
├── App.jsx               — Shell principal : rendu pur, consomme useApp()
├── utils/
│   ├── AppContext.jsx    — État global : groupes, navigation, modaux, données groupe, auto-ajout membre
│   ├── api.js            — Couche fetch REST vers json-server (/api) + AbortController 10 s
│   ├── auth.js           — Session localStorage + hashPassword/verifyPassword (bcryptjs)
│   ├── AuthContext.jsx   — Contexte auth : user, login, logout, updateUser
│   ├── ToastContext.jsx  — Système de notifications global (error/success/info)
│   ├── balance.js        — Algorithmes : computeBalances / simplifyDebts / CATEGORIES
│   ├── balance.test.js   — Tests unitaires Vitest (10 tests)
│   ├── format.js         — Utilitaires de formatage : formatDateTime, formatDate, formatMonth
│   └── theme.js          — Palette partagée (AVATAR_COLORS, GROUP_COLORS)
├── hooks/
│   └── useGroup.js       — Chargement des données d'un groupe (membres, dépenses, paiements)
├── modules/
│   └── expenses/         — Module autonome de gestion des dépenses ✅ complet
│       ├── index.js           — Point d'entrée public (exports nommés)
│       ├── ExpenseManager.jsx — Page principale : KPIs + soldes + filtres + timeline + FAB + export CSV
│       ├── ExpenseSummary.jsx — Cartes KPI + barres répartition catégories
│       ├── ExpenseFilters.jsx — Navigation mois, filtre catégorie, recherche
│       ├── ExpenseTimeline.jsx— Liste groupée par mois avec toutes les infos
│       └── hooks/
│           ├── useExpenses.js          — Chargement + filtrage local (mois/année/catégorie/search)
│           ├── useExpenseStats.js      — Agrégations : totalByMonth, totalByCategory, topPayer…
│           └── useExpenseStats.test.js — 9 tests unitaires (fonction pure computeExpenseStats)
├── pages/
│   ├── Login.jsx         — Connexion / inscription (bcrypt + migration lazy)
│   ├── Dashboard.jsx     — Vue globale multi-groupes : soldes, dettes, cartes par groupe (useMemo)
│   ├── BudgetDashboard.jsx — Vue annuelle budget : grille 12 mois, nav ◄/►, catégories *(Sprint 9)*
│   ├── Members.jsx       — Gestion des membres et rôles (modal suppression custom)
│   ├── History.jsx       — Historique des transactions
│   ├── Reminders.jsx     — Rappels de dettes + paramètres persistés
│   └── Profile.jsx       — Profil utilisateur (infos, avatar, mot de passe, suppression)
└── components/
    ├── Modal.jsx          — Wrapper modal : Escape + clic extérieur + piège focus Tab/Shift+Tab + ARIA dialog *(M5)*
    ├── Spinner.jsx        — Spinner CSS animé partagé *(nouveau Sprint 10)*
    ├── ExpenseWizard.jsx  — Wizard 3 étapes : ajout/modif dépense + invite membre/invité inline + role="alert" *(M5)*
    ├── ParticipationWizard.jsx — Wizard 3 étapes participation ad-hoc (sans "groupe" visible) + role="alert" *(M5)*
    ├── GuestBadge.jsx     — Tag "Invité" réutilisable
    ├── PaymentModal.jsx   — Enregistrer un paiement
    ├── GroupModal.jsx     — Créer groupe/sous-groupe + sélecteur type 🤝/📊 + mode budget *(Sprint 15)* + htmlFor/id *(M5)*
    ├── InviteModal.jsx    — Inviter un membre par email
    ├── Avatar.jsx         — Icône utilisateur
    ├── Badge.jsx          — Label de statut coloré
    └── Btn.jsx            — Bouton réutilisable (default / primary / danger)
```

---

## Améliorations appliquées (ordre antéchronologique)

### Sprint OPT2 — Qualité, sécurité, données (2026-05-29)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 132 | **`api.js` — guard `userId/invitedByUserId: null` dans `addMember`** — `addMember` acceptait silencieusement des champs `*Id` nuls qui causent un crash json-server (`null.toString()` dans `getRemovable()`). Désormais, tout champ `userId` ou `invitedByUserId` à `null`/`undefined` est supprimé avant le POST. La protection existait uniquement dans `addGuest` ; elle est maintenant aussi au niveau `addMember`. | `src/utils/api.js` | ✅ Fait |
| 133 | **`setupTests.js` — mocks globaux** — fichier quasi-vide (une seule ligne). Ajout : `afterEach(() => localStorage.clear())` pour isoler les tests entre eux, et `navigator.vibrate = vi.fn()` pour éviter les erreurs silencieuses en jsdom (API absente). | `src/setupTests.js` | ✅ Fait |
| 134 | **`db.json` — normalisation `email: null` → `""`** — le membre guest "ez" avait `email: null` au lieu de `""`, en violation de la convention documentée dans CLAUDE.md (champ obligatoire, chaîne vide si absent). Corrigé. | `db.json` | ✅ Fait |
| — | **74/74 tests passent** — non-régression confirmée | — | ✅ Fait |

### Sprint UX3 — Bouton "En cours" Budget + auto-expand sous-groupe (2026-05-29)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 129 | **`AppContext.jsx` — `expandGroup(id)`** — nouvelle fonction exposée dans le contexte : force `expanded[id] = true` sans toucher aux autres entrées. Corrige le bug où un sous-groupe nouvellement créé n'était pas visible dans la sidebar sans cliquer sur la flèche, car `expanded` n'était initialisé qu'au login. | `src/utils/AppContext.jsx` | ✅ Fait |
| 130 | **`App.jsx` — auto-expand parent à la création d'un sous-groupe** — dans `onSaved` du `GroupModal`, si `subgroupParentId` est défini (création d'un sous-groupe), `expandGroup(subgroupParentId)` est appelé immédiatement après `refreshGroups()`. Le sous-groupe est désormais visible sans action supplémentaire. | `src/App.jsx` | ✅ Fait |
| 131 | **`Dashboard.jsx` — bouton "En cours →"** — dans la carte Budget Commun, bouton amber doré (`#C07800`) ajouté à côté de "Voir mes budgets →" quand au moins un budget existe. Cible : `activeGroup` s'il est un budget ou sous-budget, sinon le premier budget disponible. Clic → `selectGroup()` navigue directement vers ce groupe. Le nom du groupe apparaît en `title` au survol. Couleur choisie plus foncée et moins rouge que le bouton principal (`#D97706`). | `src/pages/Dashboard.jsx` | ✅ Fait |
| — | **74/74 tests passent** — non-régression confirmée | — | ✅ Fait |

### Sprint SEC1 — Sécurité suppression Budget (2026-05-29)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 126 | **`App.jsx` — import `api` + `useEffect`** — ajout des imports nécessaires pour la vérification async des dépenses d'un sous-groupe au moment de l'ouverture du modal de confirmation. | `src/App.jsx` | ✅ Fait |
| 127 | **`App.jsx` — blocage suppression groupe Budget avec sous-groupes** — si `confirmDelete.type === 'budget'` et que des sous-groupes existent, le modal affiche un bandeau d'alerte rouge listant les sous-groupes concernés ; le bouton "Supprimer" est absent et remplacé par "Fermer". La suppression est impossible tant que les sous-groupes n'ont pas été supprimés. | `src/App.jsx` | ✅ Fait |
| 128 | **`App.jsx` — blocage suppression sous-groupe avec dépenses** — à l'ouverture du modal sur un sous-groupe (`confirmDelete.parentId` défini), un `useEffect` fetch les dépenses du groupe via `api.getExpensesByGroup()`. Si des dépenses existent, un bandeau d'alerte rouge indique leur nombre ; le bouton "Supprimer" est masqué jusqu'à ce que toutes les dépenses soient supprimées ou validées. | `src/App.jsx` | ✅ Fait |
| — | **74/74 tests passent** — non-régression confirmée | — | ✅ Fait |

### Sprint AUDIT — Audit qualité et corrections ciblées (2026-05-29)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 123 | **Audit complet du projet** — examen de l'ensemble des fichiers src/, config, tests, CSS, db.json, PWA. 5 problèmes identifiés (2 critiques, 3 hauts). 3 faux positifs écartés après lecture approfondie du code. | — | ✅ Fait |
| 124 | **`main.jsx` — enregistrement du Service Worker** — `navigator.serviceWorker.register('/serviceWorker.js')` manquait : la PWA était configurée (manifest, SW, icônes) mais le SW n'était jamais activé. Ajout du guard `'serviceWorker' in navigator` + enregistrement sur `window.load`. | `src/main.jsx` | ✅ Fait |
| 125 | **`AppContext.jsx` — auto-add membre : correction silence sur erreur** — `.catch(() => {})` silencieux laissait la clé dans `autoAddedRef` après un échec API, rendant tout retry impossible. Remplacé par `.catch(() => { autoAddedRef.current.delete(key) })` : en cas d'erreur, la clé est retirée du Set et le prochain chargement peut retenter l'ajout. | `src/utils/AppContext.jsx` | ✅ Fait |
| — | **Faux positifs écartés** — C2 (icônes PWA) : présentes. H2 (typage IDs balance.js) : `String()` déjà partout. H3 (clé reset ExpenseWizard) : `initKey.current = ''` à la fermeture protège. | — | ✅ Vérifié |
| — | **74/74 tests passent** — non-régression confirmée | — | ✅ Fait |

### Sprint UX2 — Participations, sécurité et outils (2026-05-29)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 112 | **Suppression compte `aure.baudier@gmail.com`** — suppression manuelle de l'entrée utilisateur dans `db.json`. Aucune donnée liée (members, expenses, payments) n'existait. | `db.json` | ✅ Fait |
| 113 | **`Profile.jsx` — suppression compte séquentielle** — `Promise.all(memberships.map(deleteMember))` remplacé par une boucle `for...of` avec `sleep(60ms)` entre chaque DELETE, conformément à la convention json-server anti-ECONNRESET | `src/pages/Profile.jsx` | ✅ Fait |
| 114 | **`ExpenseWizard` — onglet Montants auto-complétion** — nouvelle fonction `setCustomAmount(id, val)` miroir de `setCustomShare` : saisir un montant pour un participant redistribue le restant proportionnellement aux autres (ou à parts égales si tous à 0) ; dernier participant absorbe les arrondis | `src/components/ExpenseWizard.jsx` | ✅ Fait |
| 115 | **`ParticipationCategoryPicker.jsx`** — nouveau composant modal : grille 2×3 des catégories (Restaurant, Logement, Transport, Activité, Courses, Autre) avec couleurs de fond distinctes. Sélectionner une catégorie crée le groupe (`occasional`) + ajoute l'utilisateur admin (séquentiel, 60ms sleep) puis appelle `onCreated(group, [member])`. Spinner sur la carte en cours, autres désactivées. Fix `useEffect([open])` + `finally` pour reset `creating` entre deux sessions. | `src/components/ParticipationCategoryPicker.jsx` *(nouveau)* | ✅ Fait |
| 116 | **`AppContext` — `catPickerOpen`** — état `catPickerOpen / setCatPickerOpen` ajouté au contexte global pour piloter le picker depuis Dashboard et App.jsx | `src/utils/AppContext.jsx` | ✅ Fait |
| 117 | **`App.jsx` — câblage picker** — import `ParticipationCategoryPicker` ; état local `pickerGroupId` + `pickerMembers` ; handler `handlePickerCreated` : `refreshGroups` + `selectGroup` + open `ExpenseWizard` avec le groupe et membre frais. Bouton sidebar "＋ Nouvelle participation" ouvre le picker (ne plus ouvrir GroupModal). `ExpenseWizard` reçoit `pickerGroupId ?? activeGroup?.id` et `pickerMembers ?? members` ; état nettoyé à la fermeture | `src/App.jsx` | ✅ Fait |
| 118 | **`Dashboard` — vue liste modules** — clic sur "Voir mes participations →" ou "Voir mes budgets →" affiche une vue liste interne (early return) au lieu de naviguer vers le premier groupe. Liste avec cartes cliquables : couleur groupe, nombre membres/dépenses, montant en attente (rouge). Bouton "← Retour" et "＋ Nouvelle/Nouveau". `goToModule` modifié : si data > 0 → `setModuleView`, sinon picker/GroupModal | `src/pages/Dashboard.jsx` | ✅ Fait |
| 119 | **`Dashboard` — bouton "＋ Participation"** — second CTA bleu-canard (`#1A7A9A`) affiché à côté de "Voir mes participations →" quand des participations existent ; ouvre directement le picker de catégories | `src/pages/Dashboard.jsx` | ✅ Fait |
| 120 | **`ExpenseTimeline` — icône suppression** — `🗑` (emoji peu lisible) remplacé par `✕` (caractère texte, taille 14px) | `src/modules/expenses/ExpenseTimeline.jsx` | ✅ Fait |
| 121 | **`AUDIT_SECURITE.md`** — rapport d'audit complet : 15 vulnérabilités (4 Critiques, 4 Hautes, 4 Moyennes, 3 Faibles), scénarios d'exploitation, patches, recommandations architecture cible | `AUDIT_SECURITE.md` *(nouveau)* | ✅ Fait |
| 122 | **`ngrok-pensebete.html`** — pense-bête HTML imprimable (→ PDF via Ctrl+P) : tuto 5 étapes, commandes utiles, interface d'inspection, règles de sécurité, tableau des ports | `ngrok-pensebete.html` *(nouveau)* | ✅ Fait |
| — | **74/74 tests passent** — non-régression confirmée | — | ✅ Fait |

### Sprint OPT — Audit et optimisation performances (2026-05-27)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 104 | **Suppression du pattern N+1 dans `Dashboard.jsx`** — au lieu d'appeler `api.getMembersByGroup()` pour chaque groupe (1+N requêtes réseau), on fetch tous les membres en une seule requête `api.getAllMembers()` puis on filtre en mémoire. La boucle `Promise.all(myGroups.map(async ...))` devient une map synchrone. Gain en latence proportionnel au nombre de groupes. | `src/utils/api.js`, `src/pages/Dashboard.jsx` | ✅ Fait |
| 105 | **`computeModuleStats` sorti du composant** — était une fonction instable définie dans le corps du rendu et capturant `user.id` par closure sans figurer dans les deps des `useMemo`. Extraite en fonction pure `(list, userId)` au niveau module. | `src/pages/Dashboard.jsx` | ✅ Fait |
| 106 | **`AppContext.jsx` — `loadGroups`/`refreshGroups` en `useCallback`** — les deux fonctions étaient recréées à chaque rendu ; wrappées en `useCallback` avec deps corrects (loadGroups : `[]`, refreshGroups : `[activeGroup?.id]`) pour stabiliser les références et éviter des ré-exécutions d'effets. | `src/utils/AppContext.jsx` | ✅ Fait |
| 107 | **`AppContext.jsx` — `topGroups` en `useMemo`, `subGroups` en `useCallback`** — `topGroups` était un `groups.filter()` calculé à chaque rendu et passé par contexte (provoquait des re-rendus inutiles des consommateurs) ; mémorisé. `subGroups(parentId)` idem — wrappé avec `useCallback([groups])`. | `src/utils/AppContext.jsx` | ✅ Fait |
| 108 | **`AppContext.jsx` — simplification de `pendingCount`** — réimplémentait manuellement le calcul des soldes (boucles sur expenses/payments/membres) alors que `computeBalances`/`simplifyDebts` existent déjà dans `balance.js`. Remplacé par 2 lignes : `simplifyDebts(computeBalances(...)).filter(tx => tx.from === myMember.id).length`. | `src/utils/AppContext.jsx` | ✅ Fait |
| 109 | **`AppContext.jsx` — `sleep` sorti du composant** — fonction utilitaire pure définie dans le corps du composant à chaque rendu ; déplacée au niveau module (avant `AppProvider`). | `src/utils/AppContext.jsx` | ✅ Fait |
| 110 | **`BudgetDashboard.jsx` — `NavBtn` et `SectionTitle` extraits** — `NavBtn` (composant bouton navigation ◄/►) et `sectionTitle` (titre de section) étaient des fonctions/composants définis dans le corps du rendu et recréés à chaque cycle. Extraits comme `NavBtn` et `SectionTitle` au niveau module. | `src/pages/BudgetDashboard.jsx` | ✅ Fait |
| 111 | **`GroupModal.jsx` — suppression de `BUDGET_PERIODS` (code mort)** — la constante `BUDGET_PERIODS` (Année/Trimestre/Mois) n'était plus utilisée depuis la suppression des boutons de période en Sprint 15. | `src/components/GroupModal.jsx` | ✅ Fait |
| — | **74/74 tests passent** — non-régression confirmée après toutes les optimisations | — | ✅ Fait |

### Sprint PWA — Progressive Web App (2026-05-27)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 97 | **`manifest.json`** — métadonnées PWA complètes : `name`, `short_name`, `description`, `start_url`, `display: standalone`, `theme_color`, `background_color`, `icons` (192×192, 512×512, 32×32), `screenshots`, `categories`, `shortcuts` pour accès rapide (Participation, Budget) | `public/manifest.json` *(nouveau)* | ✅ Fait |
| 98 | **Icons PWA en SVG** — 3 icônes vectorielles créées : `icon-192.svg` (écran d'accueil smartphone), `icon-512.svg` (stores & splash), `favicon.svg` (onglet). Design minimaliste : fond vert gradient `#22c55e→#16a34a`, symbole `$` blanc, cercles superposés "split" | `public/icon-192.svg` *(nouveau)*, `public/icon-512.svg` *(nouveau)*, `public/favicon.svg` *(nouveau)* | ✅ Fait |
| 99 | **Service Worker** — cache intelligent à 2 stratégies : *cache-first* pour assets statiques (vitesse + offline), *network-first* pour l'API (données fraîches, fallback cache offline). Version `notretab-v1` avec nettoyage des anciens caches à l'activation. Suporte les messages `SKIP_WAITING` pour update forcé. | `public/serviceWorker.js` *(nouveau)* | ✅ Fait |
| 100 | **`index.html` — PWA meta tags** — ajout `manifest.json` link, `apple-touch-icon`, `theme-color`, `color-scheme`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`. Enregistrement SW dans `<script>` avec gestion erreur et logs. | `index.html` | ✅ Fait |
| 101 | **`vite.config.js` — expose réseau** — ajout `server.host: '0.0.0.0'` pour écouter sur tous les adaptateurs (WiFi, Ethernet, etc.) et exposer l'adresse Network utilisable depuis un smartphone sur le même réseau. | `vite.config.js` | ✅ Fait |
| 102 | **`PWA_GUIDE.md`** — documentation complète : installation iOS/Android/Desktop, fonctionnement offline, synchronisation auto, gestion du cache, versioning, verification support PWA (Lighthouse), troubleshooting | `PWA_GUIDE.md` *(nouveau)* | ✅ Fait |
| 103 | **`PWA_CHECKLIST.md`** — checklist de vérification détaillée : manifest chargé, SW enregistré, icons visibles, cache en cours, installation possible, mode offline, Lighthouse audit, emulation mobile, accès WiFi, métadonnées, résumé final | `PWA_CHECKLIST.md` *(nouveau)* | ✅ Fait |
| — | **66/66 tests passent** — non-régression confirmée (PWA n'affecte pas la logique React) | — | ✅ Fait |
| — | **App testable sur smartphone via WiFi** — `npm run dev` expose `http://<IP>:5174` → installation PWA sur iOS/Android fonctionnelle | — | ✅ Fait |

### Sprint M6 — Navigation mobile : sidebar drawer (2026-05-27)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 92 | **Sidebar → tiroir (drawer) sur mobile** — en dessous de 600 px, `.sidebar-root` passe en `position: fixed; transform: translateX(-100%); transition: 0.25s ease` ; la sidebar sort du flux, le contenu occupe toute la largeur. Classe `.drawer-open` applique `transform: translateX(0)` pour faire glisser le panneau. | `src/index.css`, `src/App.jsx` | ✅ Fait |
| 93 | **Bouton hamburger ☰ dans la topbar** — `className="hamburger-btn"` : `display: none` sur desktop, `display: flex` sur mobile. Présent dans les trois variants de topbar (profil, dashboard, groupe). Ouvre le drawer via `drawerOpen` (état local, hors AppContext). | `src/App.jsx` | ✅ Fait |
| 94 | **Backdrop cliquable** — `<div className="drawer-backdrop">` (`position: fixed; inset: 0; z-index: 49`) rendu conditionellement quand `drawerOpen` ; clic → fermeture. La sidebar a `z-index: 50` pour passer au-dessus. | `src/App.jsx`, `src/index.css` | ✅ Fait |
| 95 | **Auto-fermeture du drawer à la navigation** — `closeDrawer()` ajouté à chaque handler de clic dans la sidebar : profil, tableau de bord, items nav, groupes, sous-groupes, boutons "＋ Nouvelle participation / Nouveau budget". | `src/App.jsx` | ✅ Fait |
| 96 | **Topbar groupe épurée sur mobile** — `className="topbar-badge"` sur les badges "sous-groupe" et "👑 Admin", `className="topbar-breadcrumb"` sur le fil d'Ariane parent, `className="topbar-meta"` sur le compteur membres/dépenses, `className="topbar-invite"` sur le bouton Inviter : tous masqués (`display: none !important`) sur mobile. Résultat : `☰ \| Nom du groupe \| ＋ Dépense` uniquement. | `src/App.jsx`, `src/index.css` | ✅ Fait |
| — | **66/66 tests passent** — non-régression confirmée | — | ✅ Fait |

### Sprint M5 — Accessibilité : focus trap et attributs ARIA (2026-05-27)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 85 | **`Modal.jsx` — piège focus (Tab/Shift+Tab)** — `onKeyDown` sur l'overlay intercepte Tab : si focus sur le dernier focusable → revient au premier ; si Shift+Tab sur le premier → va au dernier. `FOCUSABLE` sélecteur couvre `a[href]`, `button`, `input`, `select`, `textarea`, `[tabindex]` non `-1`. | `components/Modal.jsx` | ✅ Fait |
| 86 | **`Modal.jsx` — sauvegarde/restauration du focus** — à l'ouverture `prevFocusRef` mémorise `document.activeElement` et un `setTimeout(0)` déplace le focus sur le premier focusable ; à la fermeture `prevFocusRef.current.focus()` restitue le focus au déclencheur. | `components/Modal.jsx` | ✅ Fait |
| 87 | **`Modal.jsx` — attributs ARIA** — panneau : `role="dialog"` `aria-modal="true"` `aria-labelledby={titleId}` ; titre : `id={titleId}` (via `useId()`) ; bouton fermer : `aria-label="Fermer"`. | `components/Modal.jsx` | ✅ Fait |
| 88 | **`ExpenseWizard.jsx` — `role="alert"` + labels** — `htmlFor="ew-desc"`/`id="ew-desc"` sur description, `htmlFor="ew-amount"`/`id="ew-amount"` sur montant ; les 3 zones d'erreur (`errors.desc`, `errors.amount`, `errors.split`) ont `role="alert"`. | `components/ExpenseWizard.jsx` | ✅ Fait |
| 89 | **`ParticipationWizard.jsx` — `role="alert"` + labels** — helper `field()` mis à jour avec `inputId` 4e param, `htmlFor` sur le label, `role="alert"` sur la zone erreur ; appliqué à description (`pw-desc`) et montant (`pw-amount`) ; erreurs étapes 2 et 3 ont `role="alert"`. | `components/ParticipationWizard.jsx` | ✅ Fait |
| 90 | **`GroupModal.jsx` — label/input** — `htmlFor="gm-name"` sur le label Nom et `id="gm-name"` sur l'input correspondant. | `components/GroupModal.jsx` | ✅ Fait |
| 91 | **`Modal.test.jsx` — 6 nouveaux tests accessibilité** — `role="dialog"` + `aria-modal`, `aria-labelledby` relié au titre, `aria-label="Fermer"` sur bouton, focus initial sur premier focusable, piège Tab (cycle ✕→A→B→✕), piège Shift+Tab (✕→B), restitution focus au déclencheur. | `components/Modal.test.jsx` | ✅ Fait |
| — | **66/66 tests passent** (19 logique pure + 47 composants) | — | ✅ Fait |

### Sprint 16 — Tests composants (@testing-library/react) (2026-05-27)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 78 | **Infrastructure tests composants** — `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` installés ; `src/setupTests.js` créé (import jest-dom) ; `vite.config.js` mis à jour (`setupFiles`) | `package.json`, `vite.config.js`, `src/setupTests.js` *(nouveau)* | ✅ Fait |
| 79 | **`Modal.test.jsx` — 5 tests** — titre et contenu visibles à l'ouverture, rien rendu si `open=false`, bouton ✕ appelle `onClose`, touche Escape appelle `onClose`, clic overlay appelle `onClose` | `components/Modal.test.jsx` *(nouveau)* | ✅ Fait |
| 80 | **`GroupModal.test.jsx` — 7 tests** — bouton désactivé sans nom, activé avec nom, section budget masquée pour `occasional`, section budget visible pour `budget`, options période en mode Temporel, thèmes visibles en mode Thématique, payload `createGroup` correct avec `budgetMode`/`budgetPeriod` | `components/GroupModal.test.jsx` *(nouveau)* | ✅ Fait |
| 81 | **`ExpenseWizard.test.jsx` — 5 tests** — champs étape 1 présents, bouton Suivant désactivé sans membres, erreur description trop courte, erreur montant invalide, navigation vers étape 2 avec données valides | `components/ExpenseWizard.test.jsx` *(nouveau)* | ✅ Fait |
| — | **36/36 tests passent** (19 logique pure + 17 composants) | — | ✅ Fait |

### Sprint 16b — Tests composants : validation multi-étapes (2026-05-27)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 82 | **`ExpenseWizard.test.jsx` — +7 tests** — étape 2 : erreur membres décochés, erreur pourcentages ≠ 100%, retour étape 1 ; étape 3 : retour étape 2, `createExpense` appelé ; mode édition : titre "Modifier", `updateExpense` appelé | `components/ExpenseWizard.test.jsx` | ✅ Fait |
| 83 | **`ParticipationWizard.test.jsx` — 12 tests** — étape 1 : champs présents, erreurs description/montant, navigation étape 2 ; étape 2 : créateur affiché, erreur si seul participant, ajout invité, retour étape 1 ; étape 3 : navigation, erreur pourcentages/montants custom, `createGroup` + `addMember×2` + `createExpense` appelés | `components/ParticipationWizard.test.jsx` *(nouveau)* | ✅ Fait |
| 84 | **`GroupModal.test.jsx` — +3 tests** — sections en describe blocks, clic "Budget commun" affiche la config, mode sous-groupe (bouton texte, budget masqué, checkbox import membres) | `components/GroupModal.test.jsx` | ✅ Fait |
| — | **59/59 tests passent** (19 logique pure + 40 composants) | — | ✅ Fait |

### Sprint 15 — Sélecteur Temporel/Thématique (création budget) (2026-05-27)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 76 | **`GroupModal` — section "Mode de budget"** — quand `type === 'budget'` et pas de sous-groupe, affiche une section de configuration avec deux modes : Temporel 🗓 (sous-options Année/Trimestre/Mois) ou Thématique 🏷 (grille de thèmes : Voyage ✈️, Événement 🎉, Projet 💼, Maison 🏠, Sport 🏃, Autre 🏷). Les champs `budgetMode`, `budgetPeriod` (si temporel) ou `budgetTheme` (si thématique) sont persistés sur le groupe via `api.createGroup`. Export `BUDGET_THEMES` pour réutilisation | `components/GroupModal.jsx` | ✅ Fait |
| 77 | **`BudgetDashboard` — affichage adapté au mode** — lit `budgetMode`/`budgetPeriod`/`budgetTheme` sur le groupe (défaut : `temporal/year`). Badge coloré dans l'en-tête (ex : "📅 Annuel", "✈️ Voyage"). Grille annuelle (12 mois) conservée pour `year` ; nouvelle grille trimestrielle (T1–T4) pour `quarter` avec `matchQuarterIdx()` ; mode `month` et `thematic` masquent les grilles et affichent les sous-groupes comme section primaire. Titres de section et empty state adaptés au mode | `pages/BudgetDashboard.jsx` | ✅ Fait |
| — | **Non-régression** — 19/19 tests passent | — | ✅ Fait |

### Sprint 14 — Animations & feedback visuel (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 69 | **Keyframes + classes utilitaires** — 12 `@keyframes` ajoutés dans `index.css` : `overlay-in/out`, `modal-in/out`, `toast-in/out`, `slide-up`, `step-in-right/left`, `balance-flash-green/red`, `stagger-fade`. Classes utilitaires : `.anim-slide-up`, `.anim-stagger-1/2/3/4`, `.step-forward`, `.step-back`, `.toast-enter/exit`, `.balance-pos/neg`, `.modal-overlay/panel-enter/exit` | `src/index.css` | ✅ Fait |
| 70 | **`Modal.jsx` — fade + scale** — overlay et panneau animés à l'ouverture (`modal-in` 0.20s ease-out) et à la fermeture (`modal-out` 0.16s ease-in) via état interne `visible`/`closing` ; le composant reste monté pendant l'animation de sortie (170 ms) avant démontage | `components/Modal.jsx` | ✅ Fait |
| 71 | **`ToastContext.jsx` — slide-in / slide-out** — chaque toast entre par la droite (`toast-in` 0.24s) ; à la fermeture (manuelle ou auto), animation `toast-out` jouée 220 ms avant suppression du DOM ; auto-dismiss déclenché à 3,78 s pour laisser le temps à la sortie | `utils/ToastContext.jsx` | ✅ Fait |
| 72 | **Dashboard — stagger au chargement** — bandeau welcome : `.anim-slide-up` (0.22s) ; cartes modules : `.anim-stagger-1` (délai 40 ms) ; bande stats : `.anim-stagger-2` (délai 100 ms) | `pages/Dashboard.jsx` | ✅ Fait |
| 73 | **Dashboard — flash solde net** — le montant du solde porte une `key={balanceKey}` ; à chaque mise à jour des données, React recrée le nœud, déclenchant `.balance-pos` (flash vert, 0.7s) ou `.balance-neg` (flash rouge) selon le signe | `pages/Dashboard.jsx` | ✅ Fait |
| 74 | **`ParticipationWizard` — slide entre étapes** — état `stepDir` (`'forward'`/`'back'`) ; chaque bloc d'étape reçoit `key="step-N"` + classe `.step-forward` ou `.step-back` (glissement 0.20s depuis droite ou gauche) | `components/ParticipationWizard.jsx` | ✅ Fait |
| 75 | **`Spinner` — couleur adaptative** — prop `color` ajoutée (défaut `#fff` pour fonds colorés, passer `var(--green)` sur fond blanc) ; Dashboard utilise désormais `<Spinner color="var(--green)" size={20} />` | `components/Spinner.jsx`, `pages/Dashboard.jsx` | ✅ Fait |

### Sprint 13 — Module A : Participation Ponctuelle (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 63 | **`ParticipationWizard.jsx`** — wizard 3 étapes autonome : Étape 1 (description + montant + catégorie + date), Étape 2 (participants : recherche par email avec debounce 400 ms → carte utilisateur trouvé / "Ajouter comme invité" si inconnu, formulaire invité inline), Étape 3 (répartition : parts égales / pourcentages / montants avec preview live et validation totaux). Aucun vocabulaire "groupe" visible. | `components/ParticipationWizard.jsx` *(nouveau)* | ✅ Fait |
| 64 | **Groupe éphémère `ponctuel`** — à la soumission, le wizard crée silencieusement un groupe `type: 'ponctuel'`, ajoute tous les participants en membres séquentiels, puis crée la dépense. Réutilise entièrement la logique existante (balance, soldes, historique). | `components/ParticipationWizard.jsx` | ✅ Fait |
| 65 | **Haptique sur validation** — `navigator.vibrate(40)` au passage étape 1→2→3 et `vibrate(60)` à la création finale | `components/ParticipationWizard.jsx` | ✅ Fait |
| 66 | **Câblage AppContext + App.jsx** — `partWizardOpen` / `setPartWizardOpen` ajoutés au contexte ; `<ParticipationWizard>` monté dans App.jsx avec callback `onSaved(group)` → `selectGroup` + `refreshGroups` | `utils/AppContext.jsx`, `App.jsx` | ✅ Fait |
| 67 | **Dashboard : CTA vert → wizard** — si aucune participation existante, le bouton "Créer une participation →" ouvre le `ParticipationWizard` ; si participation(s) existante(s), navigue vers la première. Les groupes `ponctuel` sont comptés dans les stats du module A | `pages/Dashboard.jsx` | ✅ Fait |
| 68 | **`Spinner` — props `size` et `color`** — composant étendu pour fonctionner sur fond blanc (color `var(--green)`) ou fond coloré (color `#fff` par défaut). Rétro-compatible | `components/Spinner.jsx` | ✅ Fait |

### Sprint 12 — Dashboard hub (deux modules) (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 58 | **Dashboard comme écran d'accueil** — `showDashboard` initialisé à `true` dans AppContext : le tableau de bord est désormais la destination directe après authentification, sans passer par le premier groupe | `utils/AppContext.jsx` | ✅ Fait |
| 59 | **Réécriture `Dashboard.jsx` — hub deux modules** — nouveau layout avec : bandeau d'accueil + solde net global, deux cartes hero (🤝 Participation Ponctuelle / 📊 Budget Commun) avec gradient, stats dynamiques par module (nombre de groupes, montant en attente, total du mois), bouton CTA contextuel (« Voir mes X » ou « Créer ») ; sections dettes et dépenses récentes conservées | `pages/Dashboard.jsx` | ✅ Fait |
| 60 | **CSS responsive dashboard** — toutes les classes `.db-*` ajoutées dans `index.css` (premier fichier CSS non-inline du projet) ; media query `@600px` : cartes en colonne unique, stats en grille 2×1, solde net affiché en pleine largeur sous le nom | `src/index.css` | ✅ Fait |
| 61 | **Retour haptique** — helper `haptic()` via `navigator.vibrate?.()` déclenché au clic sur les deux cartes modules | `pages/Dashboard.jsx` | ✅ Fait |
| 62 | **Navigation intelligente depuis les cartes** — clic sur une carte navigue vers le premier groupe du type correspondant ; si aucun groupe n'existe, ouvre directement le `GroupModal` avec le bon type pré-sélectionné | `pages/Dashboard.jsx` | ✅ Fait |
| — | **Non-régression** — 19/19 tests passent (rolldown non disponible en sandbox Linux — non régressif, pré-existant) | — | ✅ Fait |

### Sprint 11 — Fix suppression sous-groupes (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 50 | **Bouton ✕ sous-groupes invisible** — condition `isGroupAdmin && activeGroup?.id === sub.id` ne fonctionnait pas car `isGroupAdmin` est calculé sur le groupe actif, pas sur le parent. Nouvelle condition : admin du parent OU admin du sous-groupe | `App.jsx` | ✅ Fait |
| 51 | **`db.json` données incohérentes** — Mickael avait `role: 'member'` dans le groupe 2 (auto-ajout → rôle fixe) et aucun enregistrement dans le groupe 3. Corrigé : `role: 'admin'` dans groupe 2, ajout membre admin dans groupe 3 | `db.json` | ✅ Fait |
| 52 | **`setSubgroupParentId` non exposé** — utilisé dans App.jsx pour reset le parentId à la fermeture/création de GroupModal, mais non exposé par AppContext → TypeError silencieux. Exposé dans le contexte | `utils/AppContext.jsx`, `App.jsx` | ✅ Fait |
| 53 | **`GroupModal` — selectedParent ne se synchronisait pas** — état `selectedParent` initialisé une seule fois au montage ; ajout d'un `useEffect([open])` qui réinitialise tous les champs à chaque ouverture (nom, couleur, type, parent, importMembers) | `components/GroupModal.jsx` | ✅ Fait |
| 54 | **`GroupModal` — pas de gestion d'erreur** — aucun `catch` dans `handleSubmit` ; les erreurs API étaient silencieuses → "rien ne se passe". Ajout `catch` + `toast.error` | `components/GroupModal.jsx` | ✅ Fait |
| 55 | **`GroupModal` — imports membres concurrents** — `Promise.all(toImport.map(addMember))` remplacé par une boucle `for...of` séquentielle pour éviter les ECONNRESET json-server sur POSTs parallèles | `components/GroupModal.jsx` | ✅ Fait |
| 56 | **`deleteGroup` — GET parallèles** — `Promise.all([getMembersByGroup, getExpensesByGroup, getPaymentsByGroup])` + `Promise.all(deletes)` remplacés par des appels séquentiels `await` pour éliminer les ECONNRESET | `utils/AppContext.jsx` | ✅ Fait |
| 57 | **Vite proxy keepAlive** — root cause des ECONNRESET : json-server reçoit RST sur connexions keepalive réutilisées. Ajout `agent: new http.Agent({ keepAlive: false })` dans le proxy → une connexion TCP par requête. **Nécessite redémarrage de `npm run dev`** | `vite.config.js` | ✅ Fait |
| — | **Non-régression** — 19/19 tests passent | — | ✅ Fait |

### Sprint 10 — Audit & optimisations (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 42 | **`computeMyShare` extrait dans `balance.js`** — helper partagé unique pour calculer la part d'un membre dans une dépense ; supprime 4 copies identiques et corrige le bug mode `amounts` absent dans Dashboard | `utils/balance.js`, `modules/expenses/ExpenseTimeline.jsx`, `modules/expenses/hooks/useExpenseStats.js`, `pages/Dashboard.jsx`, `modules/expenses/ExpenseManager.jsx` | ✅ Fait |
| 43 | **`Spinner` extrait en composant partagé** — `components/Spinner.jsx` remplace deux définitions identiques inline | `components/Spinner.jsx` *(nouveau)*, `components/ExpenseWizard.jsx`, `components/PaymentModal.jsx` | ✅ Fait |
| 44 | **Bug border `ExpenseTimeline`** — condition toujours identique (`var(--border)` vs `var(--border)`) ; les dépenses "à payer" ont maintenant un fond rouge clair + bordure rouge | `modules/expenses/ExpenseTimeline.jsx` | ✅ Fait |
| 45 | **`Members.jsx` — `confirm()` → modal custom** — suppression de membre protégée par une modal de confirmation cohérente avec le reste du design | `pages/Members.jsx` | ✅ Fait |
| 46 | **Hook `useExpenses` supprimé** — jamais appelé nulle part ; `enrichExpensePayload` conservé dans le même fichier | `modules/expenses/hooks/useExpenses.js`, `modules/expenses/index.js` | ✅ Fait |
| 47 | **`useExpenseStats` — paramètre `payments` retiré des deps** — n'était pas utilisé dans `computeExpenseStats`, forçait des recalculs inutiles | `modules/expenses/hooks/useExpenseStats.js`, `modules/expenses/ExpenseManager.jsx` | ✅ Fait |
| 48 | **`Dashboard.myExpenses` → `useMemo`** — recalcul des 8 dépenses récentes mémorisé | `pages/Dashboard.jsx` | ✅ Fait |
| 49 | **`BudgetDashboard` dep array stable** — `subGroups.map(s => s.id).join(',')` remplacé par `useMemo subGroupIds` | `pages/BudgetDashboard.jsx` | ✅ Fait |
| — | **Non-régression** — 19/19 tests passent | — | ✅ Fait |

### Sprint 9 — UI Budget / Participations (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 37 | **Sidebar restructurée** — section "Groupes" → deux sections distinctes : "Participations occasionnelles" (vert) et "Budgets communs" (ambré) avec séparateur horizontal | `App.jsx` | ✅ Fait |
| 38 | **Distinction visuelle couleurs** — labels avec point coloré, items actifs en vert (participations) ou ambré (budgets), sous-groupes budget avec point orange, boutons "＋" colorés différemment | `App.jsx` | ✅ Fait |
| 39 | **`BudgetDashboard.jsx`** — vue annuelle : grille 12 mois cliquable, navigation ◄/► entre années, barres répartition catégories, section "Autres périodes", état vide illustré | `pages/BudgetDashboard.jsx` *(nouveau)* | ✅ Fait |
| 40 | **Routing budget** — clic sur un groupe `type:'budget'` top-level → `BudgetDashboard` (au lieu de `ExpenseManager`) | `App.jsx` | ✅ Fait |
| 41 | **`GroupModal` sélecteur de type** — boutons 🤝 Participation / 📊 Budget pour les groupes top-level ; `groupModalDefaultType` dans AppContext pré-sélectionne selon le bouton "＋" cliqué | `components/GroupModal.jsx`, `utils/AppContext.jsx`, `App.jsx` | ✅ Fait |
| — | **Fix JSX** — `</NavBtn>` → `</button>` dans BudgetDashboard | `pages/BudgetDashboard.jsx` | ✅ Fait |
| — | **Fix bugs data** — `deleteGroup` supprime les paiements (plus d'orphelins) ; `subGroups()` comparaison `String()` ; `db.json` groupe 2 `parentId: "1"` → `1` | `utils/AppContext.jsx`, `utils/api.js`, `db.json` | ✅ Fait |
| — | **Fichiers morts supprimés** — `ExpenseModal.jsx`, `Overview.jsx`, `hooks/useToast.jsx` | — | ✅ Fait |
| — | **Non-régression** — 19/19 tests passent | — | ✅ Fait |

### Sprint 8 — Fonctionnalités UX (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 34 | **Inviter depuis le wizard** — bouton "+ Membre existant" en étape 1 ; recherche par email, carte de confirmation, `api.addMember` pour ajouter au groupe et au split | `components/ExpenseWizard.jsx` | ✅ Fait |
| 35 | **Export CSV** — bouton "↓ CSV" dans l'en-tête Dépenses ; exporte les dépenses **filtrées** (date, description, catégorie, montant, payeur, mode, ma part) avec BOM UTF-8 Excel | `modules/expenses/ExpenseManager.jsx` | ✅ Fait |
| 36 | **Dashboard enrichi** — cartes par groupe (solde perso + total du mois) ; `fetch` raw remplacés par `api.getAllExpenses()` / `api.getAllPayments()` | `pages/Dashboard.jsx`, `utils/api.js` | ✅ Fait |
| — | **Non-régression** — 19/19 tests passent | — | ✅ Fait |

### Sprint 7 — Robustesse réseau (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 33 | **`AbortController` + timeout** — chaque requête `fetch` annulée après 10 s (`TIMEOUT_MS = 10_000`) ; timer nettoyé dans `finally` | `utils/api.js` | ✅ Fait |
| — | **Non-régression** — 19/19 tests passent | — | ✅ Fait |

### Sprint 6 — Bugs & cohérence données (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 31 | **Héritage membres sous-groupes** — `GroupModal` affiche un toggle "Importer les membres du groupe parent" (coché par défaut) ; membres non-guests du parent copiés avec leur rôle | `components/GroupModal.jsx` | ✅ Fait |
| 32 | **Cohérence type IDs** — `coerceId()` dans `ExpenseWizard.handleSubmit` préserve le type original (`number` vs `string`) ; `paidById` et `splitBetween` stockés en `number` | `components/ExpenseWizard.jsx`, `db.json` | ✅ Fait |
| — | **Non-régression** — 19/19 tests passent | — | ✅ Fait |

### Sprint 5 — Architecture & robustesse (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 29 | **`AppContext.jsx`** — extraction des 11 `useState` de `App.jsx` : groupes, navigation, modaux, données du groupe actif, `pendingCount`, `deleteGroup`, `refreshGroups` | `utils/AppContext.jsx` *(nouveau)*, `main.jsx`, `App.jsx` | ✅ Fait |
| 30 | **Auto-ajout membre manquant** — au chargement d'un groupe, si l'utilisateur n'a pas de fiche membre, elle est créée silencieusement (`role: 'member'`) avec un verrou `Set` anti-doublon | `utils/AppContext.jsx` | ✅ Fait |
| — | **Non-régression** — 19/19 tests passent | — | ✅ Fait |

### Sprint 4b — Correction membres (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 27b | **`GroupModal` — créateur auto-admin** — après création d'un groupe, le créateur est automatiquement ajouté comme membre `admin` via `api.addMember` | `components/GroupModal.jsx` | ✅ Fait |
| 27c | **`InviteModal` — crash email null** — `m.email?.toLowerCase()` remplace `m.email.toLowerCase()` pour ne pas planter sur les invités sans email | `components/InviteModal.jsx` | ✅ Fait |
| 27d | **`db.json` — seed membres existants** — Mickael Tavenart ajouté admin des groupes 1/2/3, Aurélie Baudier ajoutée membre du groupe 3, pour les groupes créés avant le fix | `db.json` | ✅ Fait |

### Sprint 4a — Polish UX (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 26b | **`PaymentModal` — reset + toast** — `useEffect` réinitialise le formulaire à chaque ouverture ; `toast.success` après confirmation, bouton désactivé si champs vides | `components/PaymentModal.jsx` | ✅ Fait |
| 26c | **`ExpenseWizard` — toast succès** — `toast.success('Dépense ajoutée'/'Dépense modifiée')` après sauvegarde | `components/ExpenseWizard.jsx` | ✅ Fait |
| 26d | **`ExpenseManager` — état vide + filtres conditionnels** — illustration 💸 avec CTA quand aucune dépense ; filtres et timeline masqués tant que le groupe est vide ; `toast.success` après suppression | `modules/expenses/ExpenseManager.jsx` | ✅ Fait |

### Sprint 4 — Nettoyage codebase (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 26 | **Suppression `Layout.jsx`** — fichier mort hérité de l'ancienne architecture router-based | `components/Layout.jsx` *(supprimé)* | ✅ Fait |
| 27 | **Suppression `react-router-dom`** — désinstallé (`npm uninstall`) + `BrowserRouter` retiré de `main.jsx` | `main.jsx`, `package.json` | ✅ Fait |
| 28 | **`src/utils/format.js`** — `formatDateTime`, `formatDate`, `formatMonth` centralisés ; 4 occurrences inline remplacées | `utils/format.js` *(nouveau)*, `History.jsx`, `Reminders.jsx`, `ExpenseFilters.jsx`, `ExpenseTimeline.jsx` | ✅ Fait |
| — | **Non-régression** — 19/19 tests passent | — | ✅ Fait |

### Sprint 3 — Module Expenses — Session 3 : Page complète (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 20 | **`ExpenseSummary.jsx`** — 3 cartes KPI (total, solde, moy/dépense + top payeur) + barres de répartition par catégorie | `modules/expenses/ExpenseSummary.jsx` | ✅ Fait |
| 21 | **`ExpenseFilters.jsx`** — navigation mois ◄/►, accès rapide aux mois disponibles, filtre catégorie par chips, recherche texte, bouton "Effacer" contextuel | `modules/expenses/ExpenseFilters.jsx` | ✅ Fait |
| 22 | **`ExpenseTimeline.jsx`** — liste groupée par mois avec total mensuel, lignes dépenses (emoji catégorie, avatar payeur, GuestBadge, note 📝, ma part, badge statut, actions edit/delete) | `modules/expenses/ExpenseTimeline.jsx` | ✅ Fait |
| 23 | **`ExpenseManager.jsx`** — page principale : KPIs + soldes simplifiés + filters + timeline + FAB flottant + wizard ; soldes sur TOUTES les dépenses, stats sur les FILTRÉES | `modules/expenses/ExpenseManager.jsx` | ✅ Fait |
| 24 | **Intégration App.jsx** — `Overview` → `ExpenseManager`, `ExpenseModal` → `ExpenseWizard` | `App.jsx` | ✅ Fait |
| 25 | **`index.js` étendu** — exports publics des 4 composants UI du module | `modules/expenses/index.js` | ✅ Fait |
| — | **Non-régression** — 19/19 tests passent | — | ✅ Fait |

### Sprint 3 — Module Expenses — Session 2 : UI Components (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 18 | **`GuestBadge.jsx`** — tag visuel "Invité" (orange) réutilisable | `components/GuestBadge.jsx` | ✅ Fait |
| 19 | **`ExpenseWizard.jsx`** — modal 3 étapes : Étape 1 (description + montant + payeur + guest inline), Étape 2 (equal/custom%/amounts, toggle membres, preview), Étape 3 (catégorie + date + note + récapitulatif) | `components/ExpenseWizard.jsx` | ✅ Fait |
| — | **Validation step-by-step** — description ≥ 2 car., montant > 0, split ≥ 1 membre, custom% = 100%, amounts = total | intégré dans ExpenseWizard | ✅ Fait |
| — | **Enrichissement payload** — `month` + `year` calculés via `enrichExpensePayload` à la soumission | intégré dans ExpenseWizard | ✅ Fait |

### Sprint 3 — Module Expenses — Session 1 : Data & Hooks (2026-05-25)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 13 | **Nouvelles routes API** — `getExpensesByMonth`, `getExpensesByYear`, `getExpensesByRange`, `getGuestsByGroup`, `addGuest` | `utils/api.js` | ✅ Fait |
| 14 | **`useExpenses`** — filtrage client-side (mois/année/catégorie/search) + `byMonth` + `availableMonths` + `enrichExpensePayload` | `modules/expenses/hooks/useExpenses.js` | ✅ Fait |
| 15 | **`useExpenseStats`** — agrégations : `totalByMonth`, `totalByCategory`, `grandTotal`, `avgPerExpense`, `myShareTotal`, `topPayer` ; logique extraite en `computeExpenseStats` (testable sans React) | `modules/expenses/hooks/useExpenseStats.js` | ✅ Fait |
| 16 | **Tests `computeExpenseStats`** — 9 tests : vide, totalByMonth, totalByCategory, myShareTotal (equal/custom/amounts), topPayer, membre absent | `modules/expenses/hooks/useExpenseStats.test.js` | ✅ Fait — 9/9 ✓ |
| 17 | **Point d'entrée du module** — exports publics nommés | `modules/expenses/index.js` | ✅ Fait |

### Sprint 2 — Auth & Profil utilisateur (2026-05-24)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 7  | **Hachage bcrypt** — `bcryptjs` installé, `hashPassword` / `verifyPassword` async remplacent la comparaison en clair | `auth.js`, `Login.jsx` | ✅ Fait |
| 8  | **Migration lazy des mots de passe** — au premier login d'un compte legacy, le mot de passe est re-hashé en bcrypt | `Login.jsx` (`isLegacyPassword`) | ✅ Fait |
| 9  | **Longueur minimale 6 caractères** à l'inscription (était 4) | `Login.jsx` | ✅ Fait |
| 10 | **`AuthContext.updateUser()`** — met à jour le state React et le localStorage en une seule opération | `AuthContext.jsx` | ✅ Fait |
| 11 | **Page Profil utilisateur** — modifier nom + couleur avatar, changer mot de passe, statistiques, suppression de compte | `Profile.jsx` *(nouveau)*, `App.jsx`, `api.js` | ✅ Fait |
| 12 | **Navigation vers le profil** — clic sur l'avatar dans la sidebar ouvre la page Profil | `App.jsx` | ✅ Fait |

### Sprint 1 — Qualité du code (2026-05-24)

| # | Description | Fichiers impactés | Statut |
|---|-------------|-------------------|--------|
| 1 | **Centralisation des couleurs** — `AVATAR_COLORS` dupliqué dans Login + InviteModal déplacé dans `theme.js` | `theme.js` *(nouveau)*, `Login.jsx`, `InviteModal.jsx` | ✅ Fait |
| 2 | **Système de notifications Toast** — remplace tous les `console.error` silencieux | `ToastContext.jsx` *(nouveau)*, `main.jsx`, `useGroup.js`, `App.jsx`, `Dashboard.jsx`, `Members.jsx`, `Reminders.jsx` | ✅ Fait |
| 3 | **Correction AuthContext** — `login()` ne persistait pas la session en localStorage | `AuthContext.jsx`, `Login.jsx` | ✅ Fait |
| 4 | **Infrastructure de tests** — Vitest + jsdom, scripts `npm test` / `npm run test:watch` | `package.json`, `vite.config.js` | ✅ Fait |
| 5 | **Tests unitaires balance.js** — 10 tests couvrant `computeBalances` et `simplifyDebts` | `balance.test.js` *(nouveau)* | ✅ Fait — 10/10 ✓ |
| 6 | **Persistance des paramètres Reminders** — toggles appellent `api.updateGroup()`, synchro au changement de groupe | `Reminders.jsx`, `App.jsx` | ✅ Fait |

---

## État des tests

```
npm test  →  74 passed (74)
```

| Suite | Tests | Résultat |
|-------|-------|---------|
| `computeBalances` | 5 | ✅ Pass |
| `simplifyDebts` | 5 | ✅ Pass |
| `computeExpenseStats` | 9 | ✅ Pass |
| `Modal.test.jsx` | 11 | ✅ Pass |
| `GroupModal.test.jsx` | 10 | ✅ Pass |
| `ExpenseWizard.test.jsx` | 12 | ✅ Pass |
| `ParticipationWizard.test.jsx` | 12 | ✅ Pass |
| **Total logique pure** | **19** | ✅ |
| **Total composants** | **47** | ✅ |

---

## Problèmes connus et travaux restants

### Priorité haute

| Réf | Problème | Fichier | Notes |
|-----|----------|---------|-------|
| P1 | **Backend exposé** — json-server accessible sans auth | `db.json`, `api.js` | Acceptable en local — nécessite un vrai backend pour la prod |
| P2 | **Suppression non atomique** — cascade groupe > membres > dépenses > paiements peut laisser des orphelins en cas d'erreur mi-parcours | `utils/AppContext.jsx` | Nécessite un backend transactionnel |
| ~~P3~~ | ~~**Aucun test de composants**~~ | — | ✅ Résolu (Sprints 16/16b — 47 tests composants) |

### Priorité moyenne

| Réf | Problème | Fichier | Notes |
|-----|----------|---------|-------|
| ~~M1~~ | ~~Validation des formulaires incomplète~~ | — | ✅ Résolu — `ExpenseWizard` valide description, montant, split à chaque étape |
| ~~M2~~ | ~~Pas de spinner dans les boutons de soumission~~ | — | ✅ Résolu — `Spinner.jsx` partagé dans `PaymentModal` et `ExpenseWizard` |
| ~~M3~~ | ~~react-router-dom installé mais inutilisé~~ | — | ✅ Résolu (Sprint 4) |
| ~~M4~~ | ~~`Layout.jsx` jamais importé~~ | — | ✅ Résolu (Sprint 4) |
| ~~M5~~ | ~~**Accessibilité absente** — modaux sans piège focus, pas d'ARIA~~ | — | ✅ Résolu (Sprint M5 — `role="dialog"`, piège focus, `role="alert"`, `aria-labelledby`) |
| ~~M6~~ | ~~**Navigation mobile absente** — sidebar non accessible sur petit écran~~ | — | ✅ Résolu (Sprint M6 — drawer + hamburger) |

### Priorité basse

| Réf | Problème | Fichier | Notes |
|-----|----------|---------|-------|
| B1 | **Styles majoritairement inline** — maintenance difficile à l'échelle | Tous | Migration amorcée : `index.css` utilisé pour le Dashboard hub (Sprint 12) — continuer sur les nouveaux écrans |
| ~~B2~~ | ~~`App.jsx` trop chargé — 11 `useState`~~ | — | ✅ Résolu (Sprint 5 — AppContext) |
| ~~B3~~ | ~~Formatage des dates non centralisé~~ | — | ✅ Résolu (Sprint 4) |
| ~~B4~~ | ~~Pas de timeout sur les requêtes API~~ | — | ✅ Résolu (Sprint 7 — AbortController) |
| ~~B5~~ | ~~Code mort (`ExpenseModal`, `Overview`, `useToast`, `useExpenses`)~~ | — | ✅ Résolu (Sprints 9–10) |
| ~~B6~~ | ~~`computeMyShare` dupliqué en 4 endroits~~ | — | ✅ Résolu (Sprint 10 — `balance.js`) |

---

## Prochaines étapes recommandées

```
Backlog restant (tout est basse priorité)
[ ] B1 — Continuer migration styles inline → index.css (amorcée Sprint 12)
[ ] P2 — Suppression de groupe non-atomique (améliorer résilience existante)

Terminé
[x] Progressive Web App (PWA) — manifest.json + service worker ✅ (Sprint PWA)
[x] Ajouter @testing-library/react — tests composants React ✅ (Sprints 16 / 16b)
[x] M5 — Accessibilité : piège focus + ARIA ✅ (Sprint M5)
[x] M6 — Navigation mobile : sidebar drawer + hamburger ✅ (Sprint M6)
[x] Sprint 13 — Module A : Participation Ponctuelle ✅
[x] Sprint 14 — Animations ✅
[x] Sprint 15 — Module B : sélecteur Temporel / Thématique ✅
```

---

## Commandes utiles

```bash
# Démarrer l'application (front + API)
npm run dev

# Lancer les tests (mode CI)
npm test

# Lancer les tests en mode watch
npm run test:watch

# Builder pour la production
npm run build
```
