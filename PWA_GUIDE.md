# NotreTab — Guide PWA

> Progressive Web App : installez NotreTab comme une application native sur votre smartphone ou ordinateur.

---

## 📱 Installation sur smartphone

### iPhone (iOS)
1. Ouvrir NotreTab dans **Safari**
2. Appuyer sur le bouton **Partage** (↗️ en bas)
3. Sélectionner **Sur l'écran d'accueil**
4. Choisir le nom et appuyer sur **Ajouter**

**Résultat :** L'app apparaît comme une icône native sur votre écran d'accueil.

### Android
1. Ouvrir NotreTab dans **Chrome** (ou tout navigateur Chromium)
2. Appuyer sur le **⋮ menu** en haut à droite
3. Sélectionner **Installer l'application**
4. Confirmer

**Résultat :** L'app s'installe avec un accès direct depuis le tiroir d'applications.

---

## 💻 Installation sur ordinateur

### Chrome / Chromium
1. Ouvrir NotreTab dans Chrome
2. Cliquer sur **l'icône d'installation** dans la barre d'adresse (↙️)
3. Cliquer sur **Installer**

**Résultat :** L'app s'ouvre dans une fenêtre dédiée sans barre d'adresse ni onglets.

### Firefox
- Marquer comme **Favori** (Ctrl+D) pour un accès rapide
- Firefox ne supporte pas PWA standalone pour le moment

---

## 🔄 Fonctionnement offline

La PWA fonctionne **sans connexion internet** avec les données en cache :

### ✅ Disponible offline
- Navigation entre les écrans
- Lecture des dépenses (dernière version synchronisée)
- Interface complète

### ⚠️ Limité offline
- Ajout/édition de dépenses : possible, mais sera synchronisée au retour online
- API non accessible → message "Offline - API unavailable"

### 🌐 Synchronisation auto
Une fois la connexion rétablie :
1. Le service worker détecte le network
2. Les données en cache sont mises à jour
3. Les modales affichent les données fraîches

---

## 🗑️ Gérer la PWA

### Vider le cache manuellement

**Chrome DevTools :**
```
Ctrl+Shift+J → Application → Storage → Clear site data
```

**Settings d'une app native :**
1. Ouvrir l'app
2. Aller dans Paramètres du navigateur
3. Chercher "Données du site" → supprimer NotreTab

### Désinstaller l'app

**Android :** Appui long sur l'icône → Désinstaller

**iOS :** Appui long sur l'icône → Supprimer l'app

**Ordinateur :** Les PWAs standalone sont gérées par le navigateur.
- Chrome : Paramètres → Applications installées → NotreTab → Désinstaller

---

## 🚀 Updates et versioning

Le service worker utilise `notretab-v1` comme version de cache.

### Pour forcer une nouvelle version :
1. Modifier `src/serviceWorker.js` — changer `CACHE_VERSION` en `'notretab-v2'`
2. Redéployer l'app
3. Les utilisateurs recevront la mise à jour au prochain accès

### Notification de mise à jour (futur)
Ajouter une modal :
```javascript
navigator.serviceWorker.addEventListener('controllerchange', () => {
  // Nouvelle version disponible
  showUpdateNotification();
});
```

---

## 📋 Fichiers PWA

| Fichier | Rôle |
|---------|------|
| `public/manifest.json` | Métadonnées PWA (nom, icônes, thème) |
| `public/serviceWorker.js` | Cache + offline support |
| `public/icon-192.svg` | Icône 192×192 pour l'écran d'accueil |
| `public/icon-512.svg` | Icône 512×512 pour les stores |
| `public/favicon.svg` | Petite icône onglet |
| `index.html` | Liens manifest + enregistrement SW |

---

## 🔍 Vérifier le support PWA

### Test sur localhost
```bash
npm run dev
# http://localhost:5173
```

Ouvrir **DevTools** (F12) → **Application** → **Manifest** : doit afficher le manifest.json

### Lighthouse Audit
1. DevTools → **Lighthouse**
2. Sélectionner **PWA**
3. Lancer l'audit

**Score attendu :** 90+ si tout est configuré.

---

## 🛠️ Développement

### Modifier le service worker
Le fichier `public/serviceWorker.js` est chargé directement.

Après modifications :
1. Redémarrer `npm run dev`
2. Hard refresh (Ctrl+Shift+R)
3. Vérifier DevTools → Application → Service Workers → nouvelle version active

### Ajouter des assets au cache
Éditer `STATIC_ASSETS` dans `serviceWorker.js` :
```javascript
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/new-asset.js', // Ajouter ici
];
```

---

## 📦 Build & Déploiement

### Build pour production
```bash
npm run build
# Génère dist/
```

### Vérifier le manifest
Le manifest.json est servable depuis `dist/manifest.json` sur le serveur de production.

### HTTPS requis
Les PWA ne fonctionnent qu'en **HTTPS** en production.
- `localhost` est exempté (développement)
- Les déploiements sur Vercel/Netlify sont auto-HTTPS

---

## Troubleshooting

| Problème | Solution |
|----------|----------|
| App ne s'installe pas | Vérifier HTTPS, `manifest.json` valide, icons accessibles |
| Service Worker ne s'enregistre pas | Hard refresh, vérifier DevTools console, chemin correct `/serviceWorker.js` |
| Cache trop gros | Vider le cache via DevTools ou réduire `STATIC_ASSETS` |
| Données stales | Utiliser Network-first pour l'API (déjà implémenté) |

---

**Dernière mise à jour :** 2026-05-27  
**Statut :** ✅ Opérationnel
