# NotreTab
Application web de gestion de dépenses partagées — colocation, voyages, sorties entre amis.

## Prérequis
- Node.js 18+ installé ([nodejs.org](https://nodejs.org))

---

📸 Aperçu

<img width="1915" height="811" alt="image" src="https://github.com/user-attachments/assets/a86023a3-ec70-4bc9-9cfe-04af215cc665" />

## Structure du projet

```
NotreTab/
├── db.json                    ← base de données locale (JSON)
├── server/
│   └── privacy-middleware.cjs ← garde de confidentialité côté API
├── public/
│   ├── manifest.json          ← métadonnées PWA
│   └── serviceWorker.js       ← cache + support hors ligne
├── src/
│   ├── main.jsx               ← ToastProvider > AuthProvider > AppProvider > App
│   ├── App.jsx                ← shell : navigation + rendu
│   ├── components/
│   │   ├── Modal.jsx              ← wrapper modal (Escape, piège focus, ARIA)
│   │   ├── ExpenseWizard.jsx      ← wizard 3 étapes : ajout/modif dépense
│   │   ├── ParticipationWizard.jsx← wizard 3 étapes : participation ponctuelle
│   │   ├── ShareIdLookup.jsx      ← recherche d'un compte par identifiant
│   │   ├── GroupModal.jsx / InviteModal.jsx / PaymentModal.jsx
│   │   └── Avatar.jsx / Badge.jsx / Btn.jsx / Spinner.jsx / GuestBadge.jsx
│   ├── modules/
│   │   └── expenses/          ← module dépenses (KPIs, filtres, timeline, export CSV)
│   ├── pages/
│   │   ├── Login.jsx          ← connexion / inscription (bcrypt)
│   │   ├── Dashboard.jsx      ← hub : participations ponctuelles + budgets
│   │   ├── BudgetDashboard.jsx← vue annuelle d'un budget (grille 12 mois)
│   │   ├── Members.jsx        ← membres + droits d'accès
│   │   ├── History.jsx        ← historique complet
│   │   ├── Reminders.jsx      ← rappels de dettes
│   │   └── Profile.jsx        ← profil, mot de passe, visibilité et partage
│   ├── hooks/
│   │   └── useGroup.js        ← chargement des données du groupe
│   └── utils/
│       ├── api.js             ← appels REST vers json-server
│       ├── auth.js / AuthContext.jsx  ← session + bcryptjs
│       ├── shareId.js         ← identifiant de partage NT-XXXX-XXXX
│       ├── balance.js         ← calcul des soldes & simplification des dettes
│       └── ToastContext.jsx / format.js / theme.js
└── vite.config.js             ← proxy /api → localhost:3001
```

## Fonctionnalités

- **Comptes** : inscription, connexion (mots de passe hashés bcrypt), profil et avatar
- **Groupes** : participations ponctuelles et budgets communs annuels avec sous-groupes
- **Membres** : invitation, invités sans compte, gestion admin/membre, suppression
- **Dépenses** : ajout, modification, suppression, répartition sur N membres, catégories, export CSV
- **Paiements** : enregistrement des remboursements, soldes recalculés en temps réel
- **Historique** : journal complet (dépenses + paiements)
- **Rappels** : envoi manuel, historique, toggle automatique/hebdomadaire
- **Confidentialité** : un compte est privé par défaut et ne peut être ajouté que via son
  identifiant de partage `NT-XXXX-XXXX` ; la recherche par nom ou email est un opt-in
  explicite depuis le profil
- **PWA** : installable sur mobile, fonctionne hors ligne (voir `PWA_GUIDE.md`)

## Installation

```bash
# 1. Décompresser le dossier, puis :
cd NotreTab
npm install

# 2. Lancer l'application
npm run dev
```

Ouvrir **http://localhost:5173** dans le navigateur.

> json-server tourne sur le port **3001** (API REST).  
> Vite tourne sur le port **5173** (interface)

## Tests

```bash
npm test          # 103 tests (logique pure, composants React, middleware API)
npm run test:watch
```

## Données

Tout est stocké dans `db.json`. Pour repartir de zéro, vider les tableaux :
```json
{ "users": [], "groups": [], "members": [], "expenses": [], "payments": [], "reminders": [] }
```

> ⚠️ Ne pas éditer `db.json` à la main pendant que json-server tourne : il recharge le fichier
> et peut corrompre son état interne. Arrêter le serveur d'abord, ou passer par l'API.

## Auteur

### Mickaël Tavenart

**Administrateur réseau & systèmes**
**Consultant coach‑numérique**
**Développeur full‑stack & créateur d’applications assistées par IA**

> *"L’IA comme moteur, l’humain comme destination."*

[GitHub](https://github.com/tavenamicka)
