// server/auth.cjs
// Authentification côté serveur + contrôle de propriété (sprint S4).
//
// Avant ce middleware, l'API était ouverte : n'importe qui pouvait lire et
// écrire toutes les collections avec un simple curl (V01), et tout id connu
// donnait accès à la ressource correspondante (V04). La comparaison du mot de
// passe se faisait dans le navigateur, ce qui obligeait l'API à livrer le hash
// bcrypt à qui demandait le bon email (V03).
//
// Ce fichier ferme les trois :
//   • le mot de passe est comparé ICI, le hash ne sort plus jamais ;
//   • toute requête hors /auth/* exige un jeton valide ;
//   • chaque ressource est cadrée aux groupes de l'utilisateur.
//
// Routes publiques (sans jeton) :
//   POST /auth/login     { email, password }              → { token, user }
//   POST /auth/register  { email, password, name, ... }   → { token, user }
//
// Routes authentifiées :
//   GET  /auth/me                                          → { user }
//   POST /auth/password  { currentPassword, newPassword }  → 204
//
// ⚠️ Ce middleware doit être monté AVANT privacy-middleware, qui suppose la
//    requête déjà authentifiée.

const crypto = require('crypto')
const fs = require('fs')
const bcrypt = require('bcryptjs')

const TOKEN_TTL_SECONDS = 30 * 24 * 3600 // 30 j — l'app garde la session ouverte
const SALT_ROUNDS = 10
const MIN_PASSWORD_LENGTH = 8 // V13 : 6 était insuffisant, l'API tranche désormais

// Collections rattachées à un groupe : le cadrage se fait sur leur `groupId`.
const GROUP_SCOPED = ['members', 'expenses', 'payments', 'reminders']

// ── Limitation des tentatives de connexion (V06, sprint S5) ──────────────────
// État en mémoire : un seul conteneur, un seul process. Un redémarrage remet
// les compteurs à zéro — acceptable, ce n'est pas une comptabilité.
//
// Deux clés, parce qu'aucune ne suffit seule :
//   • par compte  — non falsifiable, protège un compte ciblé même si
//                   l'attaquant change d'IP ;
//   • par IP      — attrape le balayage large, mais reste contournable
//                   (voir clientIp) : c'est un filet, pas une garantie.
//
// Le seuil par IP est volontairement large : une famille derrière un même NAT
// sortirait sinon en verrouillage sur les fautes de frappe des uns et des autres.
const MAX_FAILURES_ACCOUNT = 5
const MAX_FAILURES_IP = 20
const LOCK_STEPS_SECONDS = [60, 300, 900, 3600] // 1 min → 5 → 15 → 1 h, plafonné
const THROTTLE_TTL_MS = 2 * 3600 * 1000
const THROTTLE_MAX_ENTRIES = 1000

const attempts = new Map()

/**
 * IP réelle de l'appelant.
 * ⚠️ Le nginx du conteneur `app` ne pose PAS X-Forwarded-For : il relaie celui
 * du nginx de bordure, qui fait `$proxy_add_x_forwarded_for`. L'en-tête reçu
 * vaut donc « <ce que le client a envoyé>, <IP réelle> » — l'appelant contrôle
 * le début de la chaîne, jamais la fin. **Prendre le dernier élément.**
 * Lire le premier, comme le fait la plupart du code trouvé en ligne, rendrait
 * la limitation contournable par un simple en-tête forgé.
 */
function clientIp(req) {
  const raw = req.get ? req.get('x-forwarded-for') : (req.headers || {})['x-forwarded-for']
  if (typeof raw === 'string') {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  return req.ip || 'inconnu'
}

function pruneThrottle(now) {
  if (attempts.size <= THROTTLE_MAX_ENTRIES) return
  for (const [key, entry] of attempts) {
    if (entry.lastSeen + THROTTLE_TTL_MS < now) attempts.delete(key)
  }
}

/** @returns {number} secondes restantes avant déblocage, 0 si non verrouillé */
function lockedFor(key, now = Date.now()) {
  const entry = attempts.get(key)
  if (!entry || !entry.lockedUntil || entry.lockedUntil <= now) return 0
  return Math.ceil((entry.lockedUntil - now) / 1000)
}

function recordFailure(key, threshold, now = Date.now()) {
  const entry = attempts.get(key) || { fails: 0, locks: 0, lockedUntil: 0, lastSeen: now }
  entry.fails += 1
  entry.lastSeen = now
  if (entry.fails >= threshold) {
    const step = LOCK_STEPS_SECONDS[Math.min(entry.locks, LOCK_STEPS_SECONDS.length - 1)]
    entry.locks += 1
    entry.fails = 0
    entry.lockedUntil = now + step * 1000
  }
  attempts.set(key, entry)
  pruneThrottle(now)
  return entry
}

function clearAttempts(...keys) {
  for (const k of keys) attempts.delete(k)
}

// Hash factice de coût identique aux vrais. Sert à faire durer une tentative
// sur compte inexistant aussi longtemps qu'une tentative sur compte réel :
// sans ça, le simple temps de réponse indique si l'adresse a un compte.
const DUMMY_HASH = bcrypt.hashSync('mot-de-passe-factice-pour-egaliser-le-temps', SALT_ROUNDS)

// ── Secret de signature ──────────────────────────────────────────────────────
// Priorité à la variable d'environnement. À défaut, un secret est généré et
// persisté : sans persistance, chaque redémarrage invaliderait toutes les
// sessions ouvertes.
function loadSecret() {
  if (process.env.NOTRETAB_AUTH_SECRET) return process.env.NOTRETAB_AUTH_SECRET

  const file = process.env.NOTRETAB_AUTH_SECRET_FILE || './.auth-secret'
  try {
    const existing = fs.readFileSync(file, 'utf8').trim()
    if (existing) return existing
  } catch { /* première exécution */ }

  const generated = crypto.randomBytes(32).toString('hex')
  try {
    fs.writeFileSync(file, generated, { mode: 0o600 })
  } catch (err) {
    console.warn(
      `[auth] Secret non persisté (${err.code}) : les sessions seront invalidées au redémarrage.`
    )
  }
  return generated
}

const SECRET = loadSecret()

// ── Jeton ────────────────────────────────────────────────────────────────────
// Format `<payload base64url>.<hmac base64url>`, HMAC-SHA256. Équivalent d'un
// JWT minimal, sans dépendance supplémentaire (règle projet : préférer
// l'existant à une nouvelle dépendance).

// ── Cookie de session (V07, sprint S6) ───────────────────────────────────────
// Le jeton vit dans un cookie HttpOnly : un XSS ne peut plus le lire, donc plus
// l'exfiltrer pour s'en servir ailleurs ou plus tard.
//
// ⚠️ Ce que ça ne règle PAS : un XSS peut toujours émettre des requêtes depuis
// la page, cookie joint automatiquement. HttpOnly empêche le vol, pas l'usage.
// La défense contre ça reste la CSP en `script-src 'self'` posée au vhost (S2).
const COOKIE_NAME = 'nt_token'

function parseCookies(req) {
  const raw = req.get ? req.get('cookie') : (req.headers || {}).cookie
  const out = {}
  if (typeof raw !== 'string') return out
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    if (k) out[k] = decodeURIComponent(part.slice(eq + 1).trim())
  }
  return out
}

/**
 * `Secure` est déduit du protocole vu par le nginx de bordure, pas codé en dur :
 * en développement l'app tourne en http, un cookie Secure n'y serait jamais
 * renvoyé et la session ne tiendrait pas.
 */
function isHttps(req) {
  const proto = req.get ? req.get('x-forwarded-proto') : (req.headers || {})['x-forwarded-proto']
  if (typeof proto === 'string' && proto.length) return proto.split(',')[0].trim() === 'https'
  return req.secure === true
}

function buildCookie(req, value, maxAgeSeconds) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Strict', // l'app est entièrement same-origin : ferme le CSRF sans rien casser
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (isHttps(req)) parts.push('Secure')
  return parts.join('; ')
}

const setAuthCookie = (req, res, token) =>
  res.set && res.set('Set-Cookie', buildCookie(req, token, TOKEN_TTL_SECONDS))

const clearAuthCookie = (req, res) =>
  res.set && res.set('Set-Cookie', buildCookie(req, '', 0))

const b64u = (buf) => Buffer.from(buf).toString('base64url')

function sign(payloadB64) {
  return crypto.createHmac('sha256', SECRET).update(payloadB64).digest('base64url')
}

function issueToken(userId) {
  const now = Math.floor(Date.now() / 1000)
  const payload = b64u(JSON.stringify({ sub: String(userId), iat: now, exp: now + TOKEN_TTL_SECONDS }))
  return `${payload}.${sign(payload)}`
}

/** @returns {string|null} l'id utilisateur, ou null si le jeton est invalide/expiré */
function verifyToken(token) {
  if (typeof token !== 'string') return null
  const [payloadB64, signature] = token.split('.')
  if (!payloadB64 || !signature) return null

  const expected = sign(payloadB64)
  // Comparaison à temps constant : une comparaison naïve fuit la signature
  // attendue octet par octet.
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  let payload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch { return null }

  if (!payload || typeof payload.sub !== 'string') return null
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload.sub
}

// ── Accès aux données ────────────────────────────────────────────────────────
// json-server expose son instance lowdb sur `app.db` (cf. cli/run.js), ce qui
// évite de relire le fichier à chaque requête.
const table = (req, name) => {
  const rows = req.app && req.app.db ? req.app.db.get(name).value() : null
  return Array.isArray(rows) ? rows : []
}

const publicUser = ({ password, ...rest }) => rest

// ── Identifiant de partage ───────────────────────────────────────────────────
// L'allocation ne peut plus se faire côté client : elle exige de sonder
// /users?shareId=, désormais authentifié, alors que l'inscription se fait sans
// jeton. Le serveur s'en charge.
//
// ⚠️ L'alphabet doit rester identique à src/utils/shareId.js, sinon
//    normalizeShareId() côté client rejetterait les identifiants émis ici.
//    Couvert par un test de cohérence.
const SHARE_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const SHARE_ID_LENGTH = 8

function generateShareId() {
  let raw = ''
  // randomInt est uniforme par construction : pas de biais de modulo à corriger.
  for (let i = 0; i < SHARE_ID_LENGTH; i++) {
    raw += SHARE_ID_ALPHABET[crypto.randomInt(0, SHARE_ID_ALPHABET.length)]
  }
  return `NT-${raw.slice(0, 4)}-${raw.slice(4)}`
}

function allocateShareId(req, maxAttempts = 5) {
  const users = table(req, 'users')
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateShareId()
    if (!users.some((u) => u && u.shareId === candidate)) return candidate
  }
  throw new Error('Impossible de générer un identifiant de partage.')
}

/**
 * Groupes auxquels l'utilisateur a droit.
 * « créateur » couvre la fenêtre entre POST /groups et le POST /members qui
 * l'ajoute : sans ça, l'application ne pourrait pas créer de groupe.
 */
function authorizedGroupIds(req, userId) {
  const ids = new Set()
  for (const m of table(req, 'members')) {
    if (m && String(m.userId) === String(userId)) ids.add(String(m.groupId))
  }
  for (const g of table(req, 'groups')) {
    if (g && String(g.createdByUserId) === String(userId)) ids.add(String(g.id))
  }
  return ids
}

function findGroupIdOfResource(req, collection, id) {
  const row = table(req, collection).find((r) => r && String(r.id) === String(id))
  return row ? String(row.groupId) : null
}

// ── Réponses ─────────────────────────────────────────────────────────────────
const deny = (res, code, error) => res.status(code).json({ error })

/** Filtre la collection renvoyée par json-server aux seuls éléments autorisés. */
function scopeResponse(res, keep) {
  for (const method of ['json', 'jsonp']) {
    const original = res[method].bind(res)
    res[method] = (body) => {
      if (!Array.isArray(body)) return original(body)
      return original(body.filter((row) => row && typeof row === 'object' && keep(row)))
    }
  }
}

// ── Endpoints d'authentification ─────────────────────────────────────────────

async function handleLogin(req, res) {
  const { email, password } = req.body || {}
  if (typeof email !== 'string' || typeof password !== 'string') {
    return deny(res, 400, 'Email et mot de passe requis.')
  }

  const normalized = email.trim().toLowerCase()
  // La clé de compte est l'email SAISI, pas un compte trouvé : compter
  // uniquement les comptes existants ferait du 429 un oracle d'existence,
  // exactement ce que le message d'erreur unique cherche à éviter.
  const accountKey = `compte:${normalized}`
  const ipKey = `ip:${clientIp(req)}`

  const wait = Math.max(lockedFor(accountKey), lockedFor(ipKey))
  if (wait > 0) {
    res.set && res.set('Retry-After', String(wait))
    return deny(res, 429, `Trop de tentatives. Réessayez dans ${wait} seconde${wait > 1 ? 's' : ''}.`)
  }

  const user = table(req, 'users').find(
    (u) => u && String(u.email).toLowerCase() === normalized
  )

  // Comparaison menée même sans compte, contre un hash factice : les deux
  // chemins doivent coûter le même temps (voir DUMMY_HASH).
  const ok = await bcrypt.compare(password, (user && user.password) || DUMMY_HASH)

  if (!user || !user.password || !ok) {
    recordFailure(accountKey, MAX_FAILURES_ACCOUNT)
    recordFailure(ipKey, MAX_FAILURES_IP)
    // Message identique que le compte existe ou non : distinguer les deux
    // reviendrait à offrir un oracle d'existence de compte.
    return deny(res, 401, 'Email ou mot de passe incorrect.')
  }

  clearAttempts(accountKey, ipKey)
  const token = issueToken(user.id)
  setAuthCookie(req, res, token)
  // Le jeton n'est plus renvoyé dans le corps : il n'y a plus rien à stocker
  // côté client, donc plus rien à voler par XSS.
  return res.status(200).json({ user: publicUser(user) })
}

async function handleRegister(req, res) {
  const { email, password, name, initials, color, textColor } = req.body || {}
  if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
    return deny(res, 400, 'Email, mot de passe et nom requis.')
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return deny(res, 400, `Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum).`)
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return deny(res, 400, "Format d'adresse email invalide.")
  }

  const normalized = email.trim().toLowerCase()
  const exists = table(req, 'users').some(
    (u) => u && String(u.email).toLowerCase() === normalized
  )
  if (exists) return deny(res, 409, 'Un compte avec cet email existe déjà.')

  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  req.app.db
    .get('users')
    .insert({
      email: email.trim(),
      password: hash,
      name: name.trim(),
      initials: typeof initials === 'string' ? initials : name.trim().slice(0, 2).toUpperCase(),
      color: color || '#9FE1CB',
      textColor: textColor || '#085041',
      shareId: allocateShareId(req),
      discoverable: false, // privé par défaut (Sprint VIS1)
      createdAt: new Date().toISOString(),
    })
    .write()

  // Relecture par email plutôt que de se fier à la valeur de retour de
  // .write() : elle rend bien le document inséré avec l'adaptateur mémoire,
  // mais pas avec l'adaptateur fichier utilisé par `json-server --watch`.
  // Le symptôme était un jeton émis pour `sub: "undefined"`.
  const created = table(req, 'users').find(
    (u) => u && String(u.email).toLowerCase() === normalized
  )
  if (!created || created.id === undefined) {
    return deny(res, 500, 'Compte créé mais illisible.')
  }

  setAuthCookie(req, res, issueToken(created.id))
  return res.status(201).json({ user: publicUser(created) })
}

async function handlePasswordChange(req, res, user) {
  const { currentPassword, newPassword } = req.body || {}
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return deny(res, 400, 'Mot de passe actuel et nouveau mot de passe requis.')
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return deny(res, 400, `Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum).`)
  }
  const ok = await bcrypt.compare(currentPassword, user.password || '')
  if (!ok) return deny(res, 403, 'Mot de passe actuel incorrect.')

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  req.app.db.get('users').find({ id: user.id }).assign({ password: hash }).write()
  return res.status(204).end()
}

// ── Middleware ───────────────────────────────────────────────────────────────

module.exports = (req, res, next) => {
  const path = req.path
  const method = req.method

  // 1. Routes publiques
  if (path === '/auth/login' && method === 'POST') {
    return handleLogin(req, res).catch(() => deny(res, 500, 'Erreur interne.'))
  }
  if (path === '/auth/register' && method === 'POST') {
    return handleRegister(req, res).catch(() => deny(res, 500, 'Erreur interne.'))
  }

  // 2. Authentification — tout le reste l'exige
  // Le cookie d'abord. L'en-tête Authorization reste accepté en repli pour ne
  // pas déconnecter les sessions ouvertes avant S6 : elles s'éteindront d'
  // elles-mêmes à expiration du jeton (30 j), après quoi ce repli pourra sauter.
  const cookieToken = parseCookies(req)[COOKIE_NAME] || null
  const header = req.get ? req.get('authorization') : (req.headers || {}).authorization
  const headerToken = typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : null
  const token = cookieToken || headerToken

  const userId = token ? verifyToken(token) : null
  if (!userId) return deny(res, 401, 'Authentification requise.')

  const user = table(req, 'users').find((u) => u && String(u.id) === String(userId))
  if (!user) return deny(res, 401, 'Compte introuvable.') // compte supprimé, jeton orphelin

  req.authUser = user

  if (path === '/auth/me' && method === 'GET') {
    return res.status(200).json({ user: publicUser(user) })
  }
  if (path === '/auth/password' && method === 'POST') {
    return handlePasswordChange(req, res, user).catch(() => deny(res, 500, 'Erreur interne.'))
  }
  if (path === '/auth/logout' && method === 'POST') {
    // Le cookie étant HttpOnly, le client ne peut pas l'effacer lui-même :
    // la déconnexion doit passer par le serveur.
    clearAuthCookie(req, res)
    return res.status(204).end()
  }
  if (path.startsWith('/auth/')) return deny(res, 404, 'Route inconnue.')

  // 3. Contrôle de propriété
  const segments = path.split('/').filter(Boolean)
  const collection = segments[0]
  const resourceId = segments[1]

  // `users` : la lecture est régie par privacy-middleware ; ici on interdit
  // seulement d'écrire sur le compte d'autrui.
  if (collection === 'users') {
    if (method !== 'GET' && resourceId && String(resourceId) !== String(user.id)) {
      return deny(res, 403, 'Modification d’un autre compte non autorisée.')
    }
    if (method === 'POST' && !resourceId) {
      // La création passe par /auth/register, qui hache le mot de passe.
      return deny(res, 403, 'Création de compte : utiliser /auth/register.')
    }
    return next()
  }

  const allowed = authorizedGroupIds(req, user.id)

  if (collection === 'groups') {
    if (resourceId) {
      if (!allowed.has(String(resourceId))) return deny(res, 403, 'Groupe non autorisé.')
      return next()
    }
    if (method === 'POST') {
      // Le créateur est tracé ici, pas côté client : c'est ce qui rend la
      // propriété non falsifiable.
      req.body = { ...(req.body || {}), createdByUserId: user.id }
      return next()
    }
    scopeResponse(res, (g) => allowed.has(String(g.id)))
    return next()
  }

  if (GROUP_SCOPED.includes(collection)) {
    if (resourceId) {
      const groupId = findGroupIdOfResource(req, collection, resourceId)
      // Ressource inexistante : laisser json-server répondre 404 plutôt que
      // 403, qui révélerait qu'elle existe ailleurs.
      if (groupId !== null && !allowed.has(groupId)) return deny(res, 403, 'Ressource non autorisée.')
      return next()
    }

    if (method === 'POST') {
      const target = String((req.body || {}).groupId)
      if (!allowed.has(target)) return deny(res, 403, 'Groupe non autorisé.')
      return next()
    }

    // Liste : si un groupId est demandé, il doit être autorisé ; sinon on
    // réduit la réponse aux groupes de l'utilisateur (cas des fetchs bulk du
    // Dashboard, qui interrogeaient toute la base — V10).
    const asked = req.query && req.query.groupId
    if (asked !== undefined && !allowed.has(String(asked))) {
      return deny(res, 403, 'Groupe non autorisé.')
    }
    scopeResponse(res, (row) => allowed.has(String(row.groupId)))
    return next()
  }

  // Collection inconnue : refus par défaut plutôt que passage silencieux.
  return deny(res, 403, 'Collection non autorisée.')
}

module.exports._internals = {
  issueToken, verifyToken, generateShareId, TOKEN_TTL_SECONDS, MIN_PASSWORD_LENGTH,
  // Limitation des tentatives — exposée pour les tests : la tester à travers
  // des connexions réelles coûterait un bcrypt par tentative.
  clientIp, lockedFor, recordFailure, clearAttempts,
  resetThrottle: () => attempts.clear(),
  MAX_FAILURES_ACCOUNT, MAX_FAILURES_IP, LOCK_STEPS_SECONDS,
  parseCookies, buildCookie, isHttps, COOKIE_NAME,
}
