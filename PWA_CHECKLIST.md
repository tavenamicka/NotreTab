# PWA Setup — Checklist de vérification

> Vérifiez que tout fonctionne après le setup PWA.

---

## ✅ Avant de commencer

```bash
# 1. S'assurer que node_modules sont à jour
npm install

# 2. Lancer l'app
npm run dev
# → http://localhost:5173

# 3. Ouvrir DevTools
F12 ou Ctrl+Shift+J
```

---

## 📋 Tests

### 1. Manifest.json chargé
**DevTools → Application → Manifest**

- [ ] Affiche "NotreTab — Partage de dépenses"
- [ ] Icons visibles (192×192, 512×512)
- [ ] `start_url: "/"` correct
- [ ] `display: "standalone"` présent
- [ ] `theme_color: "#1a1a1a"` affiché

**Attendu :**
```json
{
  "name": "NotreTab — Partage de dépenses",
  "short_name": "NotreTab",
  ...
}
```

---

### 2. Service Worker enregistré
**DevTools → Application → Service Workers**

- [ ] Status : `activated and running` (vert)
- [ ] Scope : `/`
- [ ] Messages console : `[SW] Service worker loaded`

**Expected :**
```
✅ http://localhost:5173/serviceWorker.js (activated and running)
```

---

### 3. Icons chargées
**DevTools → Application → Icons**

- [ ] 3 icônes listées :
  - ✓ favicon.svg (32×32)
  - ✓ icon-192.svg (192×192)
  - ✓ icon-512.svg (512×512)

**Clic → visualiser chaque icône**

---

### 4. Cache en cours de construction
**DevTools → Application → Cache Storage**

- [ ] `notretab-v1-assets` présent après 2-3 secondes
- [ ] Contient : `index.html`, `favicon.svg`, `icon-192.svg`, `icon-512.svg`, `/`

```
notretab-v1-assets
  ├─ http://localhost:5173/ 
  ├─ http://localhost:5173/index.html
  ├─ http://localhost:5173/favicon.svg
  ├─ http://localhost:5173/icon-192.svg
  └─ http://localhost:5173/icon-512.svg
```

---

### 5. Installation possible (Desktop)

**Chrome :**
1. Chercher l'**icône d'installation** dans la barre d'adresse (↙️)
2. Cliquer → **Installer**
3. L'app s'ouvre en fenêtre dédiée sans adresse bar

**Firefox :**
- Fonctionnalité pas encore supportée (normal)

---

### 6. Mode Offline

**Simuler la déconnexion :**

1. DevTools → **Network** tab
2. Sélectionner **Offline** dans le dropdown "No throttling"
3. Recharger la page (Ctrl+R)

**Expected :**
- [ ] L'app charge (index.html du cache)
- [ ] Navigation fonctionnelle (clics sidebar, etc.)
- [ ] Tentative API → erreur "Offline - API unavailable"
- [ ] Les dépenses affichées sont celles du cache

**Retour online :**
1. Sélectionner **Online** dans le dropdown
2. Attendre 2-3s
3. API devrait redevenir accessible

---

### 7. Lighthouse Audit

**DevTools → Lighthouse**

1. Sélectionner **PWA**
2. Cliquer sur **Analyze page load**
3. Attendre 30s

**Score attendu :**
```
✅ PWA Optimized : 90+
  ├─ Progressive Web App : ✓
  ├─ Installable : ✓
  ├─ Safe (HTTPS) : ⚠️ (OK sur localhost)
  └─ Fast and reliable : ✓
```

**Warnings courants sur localhost :**
- "Does not register a service worker" → NORMAL (première visite, attend 5s)
- "Is not configured for a custom splash screen" → OK (cosmétique)

---

### 8. Mobile Emulation

**Tester sur smartphone virtuel :**

1. DevTools → **Toggle device toolbar** (Ctrl+Shift+M)
2. Sélectionner un appareil : **Pixel 7** ou **iPhone 14**
3. Tester :
   - [ ] Navigation fonctionnelle
   - [ ] Sidebar drawer apparaît (< 600px)
   - [ ] Hamburger button (☰) visible
   - [ ] Touch interactions smooth

---

### 9. Accès WiFi (vrai smartphone)

**Prérequis :** Smartphone et ordinateur sur le même WiFi

```bash
# 1. Trouver l'IP locale
ipconfig  # Windows
ifconfig  # Mac/Linux

# 2. Accès depuis le smartphone
http://<IP>:5173
# Ex: http://192.168.1.10:5173

# 3. Sur iPhone → Safari → Partager → Ajouter à l'écran d'accueil
# Sur Android → Chrome menu → Installer l'application
```

**Expected :**
- [ ] App installe correctement
- [ ] Icône apparaît sur l'écran d'accueil
- [ ] App fonctionne en standalone (pas de barre d'adresse)

---

### 10. Métadonnées d'index.html

**Vérifier le contenu :**

```bash
grep -E "manifest|theme-color|apple" index.html
```

**Expected :**
```html
✓ <link rel="manifest" href="/manifest.json" />
✓ <meta name="theme-color" content="#22c55e" />
✓ <link rel="apple-touch-icon" href="/icon-192.svg" />
✓ <meta name="apple-mobile-web-app-capable" content="yes" />
```

---

## 🚨 Problèmes courants

| Problème | Cause | Solution |
|----------|-------|----------|
| Service Worker pas enregistré | Port non accessible | Redémarrer `npm run dev` |
| Icons 404 | Fichiers manquants | Vérifier `public/icon-*.svg` existe |
| Cache vide | SW pas activé | Hard refresh (Ctrl+Shift+R) |
| Installation échouée | Manifest invalide | Vérifier JSON dans DevTools |
| Offline non fonctionnel | Network throttling pas activé | Activer "Offline" dans DevTools Network |

---

## 📊 Résumé

Après avoir coché tous les points, la PWA est **prête pour la production** :

```
✅ Manifest.json        → Métadonnées OK
✅ Service Worker       → Cache + Offline OK
✅ Icons                → Assets trouvés OK
✅ Installation         → Possible sur tous navigateurs
✅ Offline mode         → Cache fonctionnel
✅ Lighthouse audit     → 90+ score
✅ Mobile support       → Responsive OK
✅ Meta tags            → iOS/Android support OK
```

---

**Prêt pour le déploiement ! 🚀**

Suivre [PWA_GUIDE.md](./PWA_GUIDE.md) pour l'installation utilisateur.
