// server/privacy-middleware.cjs
// Middleware json-server — applique le modèle de visibilité côté API.
//
// Sans lui, GET /users renvoie l'intégralité des comptes (hash bcrypt compris) :
// le filtrage fait dans le client serait contournable en tapant l'URL.
//
// Règles sur la collection `users` :
//   • GET /users sans filtre autorisé            → 403 (pas de listing global)
//   • GET /users?email=<exact>                   → autorisé : authentification
//   • GET /users?shareId=<exact>                 → autorisé : ajout par identifiant
//   • GET /users?discoverable=true&…             → autorisé : recherche des comptes visibles
//   • GET /users/:id                             → 403 (pas de lecture de profil tiers)
//   • Toute réponse hors authentification est débarrassée du champ `password`.
//
// ⚠️ Limite assumée : la connexion compare le hash bcrypt dans le navigateur,
// donc la requête par email exact doit encore renvoyer `password`. Fermer ce
// dernier canal suppose de déplacer l'authentification côté serveur.

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

/** Remplace res.json/res.jsonp pour filtrer ce que json-server s'apprête à écrire. */
function stripResponse(res) {
  for (const method of ['json', 'jsonp']) {
    const original = res[method].bind(res)
    res[method] = (body) => original(strip(body))
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
    const byEmail = typeof q.email === 'string' && q.email.length > 0
    const byShareId = typeof q.shareId === 'string' && q.shareId.length > 0
    const discoverableOnly = q.discoverable === 'true'

    if (!byEmail && !byShareId && !discoverableOnly) {
      return res.status(403).json({
        error: 'Recherche non autorisée : filtrez par email exact, identifiant de partage, ou discoverable=true.',
      })
    }

    // Seule l'authentification a besoin du hash ; tout le reste est nettoyé.
    if (!byEmail) stripResponse(res)
    return next()
  }

  // POST / PATCH / PUT / DELETE : la réponse ne doit jamais réémettre le hash.
  stripResponse(res)
  return next()
}
