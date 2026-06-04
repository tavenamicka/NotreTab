# NotreTab — Application de partage de factures

## Prérequis
- Node.js 18+ installé ([nodejs.org](https://nodejs.org))

## Installation

```bash
# 1. Décompresser le dossier, puis :
cd splitease
npm install

# 2. Lancer l'application
npm run dev
```

Ouvrir **http://localhost:5173** dans le navigateur.

> json-server tourne sur le port **3001** (API REST).  
> Vite tourne sur le port **5173** (interface).

---

## Structure du projet

```
splitease/
├── db.json              ← base de données locale (JSON)
├── src/
│   ├── App.jsx          ← composant racine + navigation
│   ├── components/
│   │   ├── Avatar.jsx
│   │   ├── Badge.jsx
│   │   ├── Btn.jsx
│   │   ├── Modal.jsx
│   │   ├── ExpenseModal.jsx
│   │   ├── PaymentModal.jsx
│   │   ├── InviteModal.jsx
│   │   └── GroupModal.jsx
│   ├── pages/
│   │   ├── Overview.jsx   ← dépenses + soldes simplifiés
│   │   ├── Members.jsx    ← membres + droits d'accès
│   │   ├── History.jsx    ← historique complet
│   │   └── Reminders.jsx  ← rappels automatiques
│   ├── hooks/
│   │   └── useGroup.js    ← chargement des données du groupe
│   └── utils/
│       ├── api.js         ← appels REST vers json-server
│       └── balance.js     ← calcul des soldes & simplification des dettes
└── vite.config.js        ← proxy /api → localhost:3001
```

## Fonctionnalités

- **Groupes** : création, sélection, couleur personnalisée
- **Membres** : invitation, gestion admin/membre, suppression
- **Dépenses** : ajout, modification, suppression, répartition sur N membres
- **Paiements** : enregistrement des remboursements, soldes recalculés en temps réel
- **Historique** : journal complet (dépenses + paiements)
- **Rappels** : envoi manuel, historique, toggle automatique/hebdomadaire

## Données

Tout est stocké dans `db.json`. Pour repartir de zéro, vider les tableaux :
```json
{ "groups": [], "members": [], "expenses": [], "payments": [], "reminders": [] }
```
