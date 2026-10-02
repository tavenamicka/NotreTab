// server/privacy-middleware.cjs
// Middleware json-server — applique le modèle de visibilité côté API.
//
// Sans lui, GET /users renvoie l'intégralité des comptes (hash bcrypt compris) :
// le filtrage fait dans le client serait contournable en tapant l'URL.
//
// Règles sur la collection `users` :
//   • GET /users sans filtre autorisé            → 403 (pas de listing global)
//   • GET /users?shareId=<exact>                 → autorisé : ajout par identifiant
//   • GET /users?discoverable=true&…             → autorisé : recherche des comptes visibles
//   • GET /users/:id                             → 403 (pas de lecture de profil tiers)
//   • Le champ `password` est retiré de TOUTES les réponses, sans exception.
//
// Depuis le sprint S4, `?email=<exact>` n'est plus un filtre autorisé et le hash
// bcrypt ne sort plus jamais : l'authentification est passée côté serveur
// (`POST /auth/login` dans server/auth.cjs), le navigateur ne compare plus rien.
// C'est ce qui ferme complètement V03, qui n'était jusque-là qu'atténuée.
//
// ⚠️ Autoriser un filtre ne suffit pas : le middleware le RÉAPPLIQUE lui-même sur
// la réponse. json-server 0.17 écarte silencieusement un filtre dont la clé
// n'existe sur aucun enregistrement — `?shareId=X` sur une base où personne n'a
// encore de `shareId` renvoyait donc toute la collection, et le 403 sur le
// listing nu se contournait en ajoutant un `?shareId=` bidon. Constaté en
// production le 2026-08-09 (aucun compte n'avait encore de `shareId`, la
// migration `ensureShareId()` étant paresseuse et déclenchée au login).
// Ne pas déléguer le filtrage à json-server : il est optionnel côté json-server,
// il est la garantie ici.
//
const PRIVATE_FIELDS = ['password']

function strip(payload) {
  if (Array.isArray(payload)) return payload.map(strip)
  if (payload && typeof payload === 'object') {
    const copy = { ...payload }
    for (const f of PRIVATE_FIELDS) delete copy[f]
    return copy
  }
  return payload
}

/**
 * Prédicats correspondant aux filtres autorisés présents dans la query.
 * Un compte auquel le champ manque est exclu, jamais renvoyé par défaut.
 */
function buildFilters(q) {
  const filters = []

  if (typeof q.shareId === 'string' && q.shareId.length > 0) {
    filters.push((u) => String(u.shareId ?? '') === q.shareId)
  }
  if (q.discoverable === 'true') {
    filters.push((u) => u.discoverable === true || String(u.discoverable) === 'true')
  }

  return filters
}

/** N'applique les prédicats qu'aux collections ; un objet seul passe tel quel. */
function applyFilters(payload, filters) {
  if (!filters.length || !Array.isArray(payload)) return payload
  return payload.filter(
    (item) => item && typeof item === 'object' && filters.every((f) => f(item))
  )
}

/** Remplace res.json/res.jsonp pour filtrer ce que json-server s'apprête à écrire. */
function transformResponse(res, { filters = [], stripPassword = true } = {}) {
  for (const method of ['json', 'jsonp']) {
    const original = res[method].bind(res)
    res[method] = (body) => {
      const filtered = applyFilters(body, filters)
      return original(stripPassword ? strip(filtered) : filtered)
    }
  }
}

function isUsersCollection(path) {
  return path === '/users' || path === '/users/'
}

function isUsersItem(path) {
  return /^\/users\/[^/]+\/?$/.test(path)
}

module.exports = (req, res, next) => {
  const path = req.path
  if (!isUsersCollection(path) && !isUsersItem(path)) return next()

  if (req.method === 'GET') {
    if (isUsersItem(path)) {
      return res.status(403).json({ error: 'Lecture de profil non autorisée.' })
    }

    const q = req.query || {}
    const byShareId = typeof q.shareId === 'string' && q.shareId.length > 0
    const discoverableOnly = q.discoverable === 'true'

    if (!byShareId && !discoverableOnly) {
      return res.status(403).json({
        error: 'Recherche non autorisée : filtrez par identifiant de partage, ou discoverable=true.',
      })
    }

    transformResponse(res, { filters: buildFilters(q), stripPassword: true })
    return next()
  }

  // POST / PATCH / PUT / DELETE : la réponse ne doit jamais réémettre le hash.
  transformResponse(res, { filters: [], stripPassword: true })
  return next()
}
