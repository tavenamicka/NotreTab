# NotreTab — CLAUDE.md

> Contexte de développement pour Claude Code / Cowork.
> Pour l'historique complet des sprints, voir `SUIVI.md`.

---

## Projet

Application web de partage de dépenses en groupe (type Splitwise).
**Stack :** React 18 · Vite 5 · json-server 0.17.4 · Vitest · bcryptjs

```bash
npm run dev     # front (5173) + API json-server (3001) en parallèle
npm test        # 19 tests passent (balance + expenseStats)
npm run build
```

**Compte de test :** `mickael.tavenart@gmail.com` / mot de passe bcrypt dans db.json

---

## Architecture

```
src/
├── main.jsx                   — ToastProvider > AuthProvider > AppProvider > App
├── App.jsx                    — Shell : rendu pur, consomme useApp()
├── utils/
│   ├── AppContext.jsx          — État global : groupes, nav, modaux, auto-add membre
│   ├── api.js                  — fetch REST /api → json-server, AbortController 10s
│   ├── auth.js / AuthContext.jsx
│   ├── ToastContext.jsx        — Notifications (error/success/info) avec animations
│   ├── balance.js              — computeBalances, simplifyDebts, CATEGORIES, computeMyShare
│   └── format.js / theme.js
├── hooks/useGroup.js           — Chargement données d'un groupe
├── modules/expenses/           — Module autonome complet (KPIs, filtres, timeline, CSV)
├── pages/
│   ├── Dashboard.jsx           — Hub principal : deux modules (ponctuel + budget)
│   ├── BudgetDashboard.jsx     — Vue annuelle budget (grille 12 mois)
│   ├── Members.jsx / History.jsx / Reminders.jsx / Profile.jsx / Login.jsx
└── components/
    ├── Modal.jsx               — Wrapper modal avec animations fade+scale
    ├── ParticipationWizard.jsx — Wizard 3 étapes participation ad-hoc (sans "groupe" visible)
    ├── ExpenseWizard.jsx       — Wizard 3 étapes ajout/édition dépense
    ├── GroupModal.jsx / InviteModal.jsx / PaymentModal.jsx
    ├── Avatar.jsx / Spinner.jsx / Badge.jsx / Btn.jsx / GuestBadge.jsx
```

---

## Conventions critiques

### json-server — pièges connus

**Ne jamais stocker `userId: null`** dans la table `members`.
json-server appelle `getRemovable()` sur chaque write/delete, qui itère tous les champs `*Id` et appelle `getById(db['users'], value)`. Si `value` est `null`, `null.toString()` crash → 500 sur tout DELETE.

```js
// ✅ Bon — omettre le champ si null
const payload = { groupId, name, ... }
if (p.userId) payload.userId = p.userId

// ❌ Mauvais
{ userId: null, ... }
```

**Requêtes séquentielles, jamais parallèles** pour les POSTs/DELETEs multiples.
json-server 0.17 crashe (ECONNRESET) sur les écritures concurrentes.

```js
// ✅ Bon
for (const item of items) { await api.deleteX(item.id); await sleep(60) }

// ❌ Mauvais
await Promise.all(items.map(item => api.deleteX(item.id)))
```

**Vite proxy** déjà configuré avec `keepAlive: false` dans `vite.config.js`.

**Ne pas éditer `db.json` à la main** pendant que json-server tourne — il recharge le fichier et peut corrompre son état interne. Arrêter le serveur d'abord ou utiliser l'API.

### Groupes — types

| Type | Description |
|------|-------------|
| `'budget'` | Budget commun annuel, peut avoir des sous-groupes (mois, etc.) |
| `'occasional'` | Participation occasionnelle |
| `'ponctuel'` | Groupe éphémère créé par ParticipationWizard (invisible pour l'utilisateur) |
| `null` | Sous-groupe d'un budget |

### Guests (membres sans compte)

Champs obligatoires : `name`, `email` (peut être `""`), `initials`, `color`, `textColor`, `isGuest: true`, `role: 'guest'`.
Champs **à ne pas inclure** : `userId`, `invitedByUserId` (finissent en `Id` → piège getRemovable).

### Animations (index.css)

Classes disponibles : `.modal-overlay-enter/exit`, `.modal-panel-enter/exit`, `.toast-enter/exit`, `.step-forward`, `.step-back`, `.anim-slide-up`, `.anim-stagger-1/2/3/4`, `.balance-pos`, `.balance-neg`.

Durées : modal 170ms · toast 220ms · step 200ms · stagger 40/100/160/220ms.

---

## État actuel (après Sprint PWA)

- ✅ Dashboard hub avec deux modules (ponctuel + budget)
- ✅ ParticipationWizard (wizard 3 étapes, groupe éphémère `ponctuel`)
- ✅ Animations : modaux, toasts, transitions étapes, stagger dashboard, flash solde
- ✅ Suppression de groupe résiliente (retry 500, 404 = succès, sleep 60ms entre deletes)
- ✅ Sprint 15 : sélecteur Temporel/Thématique à la création d'un groupe Budget
- ✅ Sprint 16/16b : 47 tests composants (Modal, GroupModal, ExpenseWizard, ParticipationWizard)
- ✅ Sprint M5 : piège focus + ARIA (role="dialog", aria-modal, aria-labelledby, role="alert", htmlFor/id)
- ✅ Sprint M6 : sidebar drawer mobile (hamburger ☰, backdrop, auto-fermeture, topbar épurée)
- ✅ Sprint PWA : Progressive Web App (manifest.json, service worker, installation mobile, support offline)
- ✅ Sprint OPT : audit performances (N+1 Dashboard, useCallback/useMemo AppContext, composants BudgetDashboard, code mort GroupModal)
- ✅ 74/74 tests passent

---

## Backlog (prochains sprints)

| Sprint | Sujet | Priorité |
|--------|-------|----------|
| B1 | Migration styles inline → index.css (amorcée Sprint 12) | Basse |
| P2 | Suppression de groupe non-atomique (amélioration résilience) | Basse |

---

## Fichiers de référence

- `SUIVI.md` — historique complet de tous les sprints
- `db.json` — base de données json-server (ne pas modifier à chaud)
- `src/utils/balance.js` — algorithmes de calcul (logique pure, bien testée)
- `src/index.css` — seul fichier CSS global (classes `.db-*`, animations)
- `public/manifest.json` — métadonnées PWA (nom, icônes, thème, shortcuts)
- `public/serviceWorker.js` — cache intelligent + offline support (cache-first assets, network-first API)
- `PWA_GUIDE.md` — documentation d'installation et d'utilisation PWA pour les utilisateurs
- `PWA_CHECKLIST.md` — checklist de vérification pour développeurs (manifest, SW, icons, offline, Lighthouse)
