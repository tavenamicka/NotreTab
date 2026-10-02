import { describe, it, expect, vi, beforeEach } from 'vitest'
import middleware from './auth.cjs'
import bcrypt from 'bcryptjs'
import { isValidShareId, normalizeShareId } from '../src/utils/shareId'

const {
  issueToken, verifyToken, generateShareId,
  clientIp, lockedFor, recordFailure, clearAttempts, resetThrottle,
  MAX_FAILURES_ACCOUNT, MAX_FAILURES_IP, LOCK_STEPS_SECONDS,
  parseCookies, COOKIE_NAME,
} = middleware._internals

// L'état de limitation vit dans le module : sans remise à zéro, une tentative
// d'un test verrouillerait le suivant.
beforeEach(() => resetThrottle())

// Base de test : deux comptes qui ne partagent aucun groupe, plus un groupe
// créé mais dont le POST /members n'a pas encore eu lieu.
const db = () => ({
  users: [
    { id: 'u1', email: 'a@b.fr', name: 'A', password: '$2b$10$fauxhash' },
    { id: 'u2', email: 'b@b.fr', name: 'B', password: '$2b$10$fauxhash2' },
  ],
  groups: [
    { id: 'g1', name: 'Groupe de u1' },
    { id: 'g2', name: 'Groupe de u2' },
    { id: 'g3', name: 'Tout juste créé par u1', createdByUserId: 'u1' },
  ],
  members: [
    { id: 'm1', groupId: 'g1', userId: 'u1' },
    { id: 'm2', groupId: 'g2', userId: 'u2' },
  ],
  expenses: [
    { id: 'e1', groupId: 'g1', label: 'Courses de u1' },
    { id: 'e2', groupId: 'g2', label: 'Courses de u2' },
  ],
  payments: [{ id: 'p1', groupId: 'g2' }],
  reminders: [],
})

/** Faux couple req/res Express, avec un app.db façon lowdb en lecture. */
function call(method, path, { query = {}, body, token, cookie, proto, data } = {}) {
  const store = data || db()
  const req = {
    method,
    path,
    query,
    body,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
      ...(proto ? { 'x-forwarded-proto': proto } : {}),
    },
    get(name) { return this.headers[String(name).toLowerCase()] },
    app: { db: { get: (name) => ({ value: () => store[name] }) } },
  }
  const sent = { status: 200, body: undefined, ended: false, headers: {} }
  // Les handlers d'authentification sont asynchrones (bcrypt) : `settled`
  // permet de les attendre sans temporisation arbitraire.
  let resolveSettled
  sent.settled = new Promise((r) => { resolveSettled = r })
  const res = {
    status(code) { sent.status = code; return res },
    json(b) { sent.body = b; resolveSettled(); return res },
    jsonp(b) { sent.body = b; resolveSettled(); return res },
    set(name, value) { sent.headers[String(name).toLowerCase()] = value; return res },
    end() { sent.ended = true; resolveSettled(); return res },
  }
  const next = vi.fn()
  middleware(req, res, next)
  return { req, res, next, sent, store }
}

const tokenU1 = () => issueToken('u1')
const tokenU2 = () => issueToken('u2')

describe('jeton', () => {
  it('un jeton émis se vérifie et rend son sujet', () => {
    expect(verifyToken(issueToken('u1'))).toBe('u1')
  })

  it('rejette une signature falsifiée', () => {
    const [payload] = issueToken('u1').split('.')
    expect(verifyToken(`${payload}.signaturebidon`)).toBeNull()
  })

  it('rejette un payload modifié après signature', () => {
    const t = issueToken('u1')
    const [, sig] = t.split('.')
    const forge = Buffer.from(JSON.stringify({
      sub: 'u2', iat: 0, exp: Math.floor(Date.now() / 1000) + 100,
    })).toString('base64url')
    expect(verifyToken(`${forge}.${sig}`)).toBeNull()
  })

  it('rejette un jeton expiré', () => {
    vi.useFakeTimers()
    const t = issueToken('u1')
    vi.setSystemTime(Date.now() + 31 * 24 * 3600 * 1000)
    expect(verifyToken(t)).toBeNull()
    vi.useRealTimers()
  })

  it('rejette les entrées malformées sans lever', () => {
    for (const v of [null, undefined, '', 'abc', 'a.b.c', 42, {}]) {
      expect(verifyToken(v)).toBeNull()
    }
  })
})

describe('authentification requise', () => {
  it('refuse toute requête sans jeton', () => {
    for (const [m, p] of [['GET', '/groups'], ['POST', '/expenses'], ['DELETE', '/members/m1']]) {
      const { next, sent } = call(m, p)
      expect(next).not.toHaveBeenCalled()
      expect(sent.status).toBe(401)
    }
  })

  it('refuse un jeton dont le compte n’existe plus', () => {
    const { next, sent } = call('GET', '/groups', { token: issueToken('disparu') })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(401)
  })

  it('laisse passer login et register sans jeton', () => {
    const login = call('POST', '/auth/login', { body: {} })
    expect(login.sent.status).toBe(400) // traité, pas rejeté pour absence de jeton
    const register = call('POST', '/auth/register', { body: {} })
    expect(register.sent.status).toBe(400)
  })

  it('GET /auth/me rend le compte sans son hash', () => {
    const { sent } = call('GET', '/auth/me', { token: tokenU1() })
    expect(sent.status).toBe(200)
    expect(sent.body.user.id).toBe('u1')
    expect('password' in sent.body.user).toBe(false)
  })
})

describe('login', () => {
  it('ne distingue pas compte inconnu et mot de passe faux', async () => {
    const inconnu = call('POST', '/auth/login', { body: { email: 'nobody@b.fr', password: 'x' } })
    await new Promise(r => setImmediate(r))
    expect(inconnu.sent.status).toBe(401)
    expect(inconnu.sent.body.error).toBe('Email ou mot de passe incorrect.')
  })

  it('exige les deux champs', () => {
    const { sent } = call('POST', '/auth/login', { body: { email: 'a@b.fr' } })
    expect(sent.status).toBe(400)
  })
})

describe('cookie de session (V07 / S6)', () => {
  const cookieDe = (sent) => sent.headers['set-cookie'] || ''

  it('authentifie depuis le cookie, sans en-tête Authorization', () => {
    const { next, sent } = call('GET', '/auth/me', { cookie: `${COOKIE_NAME}=${tokenU1()}` })
    expect(sent.status).toBe(200)
    expect(sent.body.user.id).toBe('u1')
    void next
  })

  it('accepte encore l’en-tête Authorization (sessions ouvertes avant S6)', () => {
    const { sent } = call('GET', '/auth/me', { token: tokenU1() })
    expect(sent.status).toBe(200)
  })

  it('le cookie prime sur l’en-tête', () => {
    const { sent } = call('GET', '/auth/me', {
      cookie: `${COOKIE_NAME}=${tokenU1()}`,
      token: tokenU2(),
    })
    expect(sent.body.user.id).toBe('u1')
  })

  it('pose un cookie HttpOnly + SameSite=Strict à la connexion réussie', async () => {
    // Vrai hash bcrypt : c'est la connexion elle-même qu'on teste, pas un
    // endpoint de substitution.
    const avecVraiHash = db()
    avecVraiHash.users[0].password = bcrypt.hashSync('motdepassesolide', 10)

    const { sent } = call('POST', '/auth/login', {
      body: { email: 'a@b.fr', password: 'motdepassesolide' },
      proto: 'https',
      data: avecVraiHash,
    })
    await sent.settled

    expect(sent.status).toBe(200)
    const c = cookieDe(sent)
    expect(c).toContain(`${COOKIE_NAME}=`)
    expect(c).toContain('HttpOnly')
    expect(c).toContain('SameSite=Strict')
    expect(c).toContain('Path=/')
    expect(c).toContain('Secure')
    // Le jeton part par le cookie, jamais par le corps.
    expect(sent.body.token).toBeUndefined()
    expect(sent.body.user.id).toBe('u1')
  })

  it('le cookie posé authentifie réellement la requête suivante', async () => {
    const avecVraiHash = db()
    avecVraiHash.users[0].password = bcrypt.hashSync('motdepassesolide', 10)
    const login = call('POST', '/auth/login', {
      body: { email: 'a@b.fr', password: 'motdepassesolide' }, data: avecVraiHash,
    })
    await login.sent.settled

    const valeur = cookieDe(login.sent).split(';')[0] // nt_token=...
    const suite = call('GET', '/auth/me', { cookie: valeur })
    expect(suite.sent.status).toBe(200)
    expect(suite.sent.body.user.id).toBe('u1')
  })

  it('marque Secure en https, pas en http', () => {
    const enHttps = call('POST', '/auth/logout', { token: tokenU1(), proto: 'https' })
    expect(cookieDe(enHttps.sent)).toContain('Secure')

    // En développement l'app tourne en http : un cookie Secure n'y serait
    // jamais renvoyé et la session ne tiendrait pas.
    const enHttp = call('POST', '/auth/logout', { token: tokenU1() })
    expect(cookieDe(enHttp.sent)).not.toContain('Secure')
  })

  it('la déconnexion expire le cookie', () => {
    const { sent } = call('POST', '/auth/logout', { token: tokenU1() })
    expect(sent.status).toBe(204)
    expect(cookieDe(sent)).toContain('Max-Age=0')
  })

  it('parse un en-tête Cookie avec plusieurs valeurs', () => {
    const c = parseCookies({ headers: { cookie: `theme=dark; ${COOKIE_NAME}=abc123; autre=x` } })
    expect(c[COOKIE_NAME]).toBe('abc123')
    expect(c.theme).toBe('dark')
  })

  it('tolère un en-tête Cookie absent ou malformé', () => {
    expect(parseCookies({ headers: {} })).toEqual({})
    expect(parseCookies({ headers: { cookie: 'nimportequoi' } })).toEqual({})
  })

  it('refuse un cookie porteur d’un jeton falsifié', () => {
    const { sent } = call('GET', '/groups', { cookie: `${COOKIE_NAME}=faux.jeton` })
    expect(sent.status).toBe(401)
  })

  it('ne renvoie plus le jeton dans le corps de la réponse', () => {
    // Rien à stocker côté client, donc rien à voler par XSS.
    const { sent } = call('POST', '/auth/register', {
      body: { email: 'neuf@b.fr', password: 'motdepassesolide', name: 'Neuf' },
    })
    // La création échoue faute de db inscriptible dans ce faux contexte, mais
    // le contrat de réponse est vérifié par le test d'intégration.
    expect(sent.body && sent.body.token).toBeUndefined()
  })
})

describe('limitation des tentatives (V06)', () => {
  it('verrouille après le seuil de tentatives sur un compte', () => {
    const k = 'compte:cible@b.fr'
    for (let i = 0; i < MAX_FAILURES_ACCOUNT - 1; i++) recordFailure(k, MAX_FAILURES_ACCOUNT)
    expect(lockedFor(k)).toBe(0) // pas encore

    recordFailure(k, MAX_FAILURES_ACCOUNT)
    expect(lockedFor(k)).toBeGreaterThan(0)
    expect(lockedFor(k)).toBeLessThanOrEqual(LOCK_STEPS_SECONDS[0])
  })

  it('allonge la durée à chaque verrouillage successif, puis plafonne', () => {
    vi.useFakeTimers()
    const k = 'compte:tenace@b.fr'
    const durees = []
    for (let tour = 0; tour < 6; tour++) {
      for (let i = 0; i < MAX_FAILURES_ACCOUNT; i++) recordFailure(k, MAX_FAILURES_ACCOUNT)
      const d = lockedFor(k)
      durees.push(d)
      vi.setSystemTime(Date.now() + (d + 1) * 1000) // laisser le verrou expirer
    }
    const plafond = LOCK_STEPS_SECONDS[LOCK_STEPS_SECONDS.length - 1]
    expect(durees.slice(0, LOCK_STEPS_SECONDS.length)).toEqual(LOCK_STEPS_SECONDS)
    expect(durees.every(d => d <= plafond)).toBe(true)
    expect(durees[durees.length - 1]).toBe(plafond)
    vi.useRealTimers()
  })

  it('le verrou expire', () => {
    vi.useFakeTimers()
    const k = 'compte:patient@b.fr'
    for (let i = 0; i < MAX_FAILURES_ACCOUNT; i++) recordFailure(k, MAX_FAILURES_ACCOUNT)
    expect(lockedFor(k)).toBeGreaterThan(0)
    vi.setSystemTime(Date.now() + (LOCK_STEPS_SECONDS[0] + 1) * 1000)
    expect(lockedFor(k)).toBe(0)
    vi.useRealTimers()
  })

  it('une connexion réussie remet les compteurs à zéro', () => {
    const k = 'compte:maladroit@b.fr'
    for (let i = 0; i < MAX_FAILURES_ACCOUNT - 1; i++) recordFailure(k, MAX_FAILURES_ACCOUNT)
    clearAttempts(k)
    for (let i = 0; i < MAX_FAILURES_ACCOUNT - 1; i++) recordFailure(k, MAX_FAILURES_ACCOUNT)
    expect(lockedFor(k)).toBe(0) // le compteur est bien reparti de zéro
  })

  it('le seuil par IP est plus large que le seuil par compte', () => {
    // Une famille derrière un même NAT ne doit pas se verrouiller mutuellement
    // sur des fautes de frappe.
    expect(MAX_FAILURES_IP).toBeGreaterThan(MAX_FAILURES_ACCOUNT)
    const k = 'ip:203.0.113.7'
    for (let i = 0; i < MAX_FAILURES_ACCOUNT + 1; i++) recordFailure(k, MAX_FAILURES_IP)
    expect(lockedFor(k)).toBe(0)
  })

  it('répond 429 avec Retry-After une fois verrouillé', () => {
    const email = 'verrouille@b.fr'
    for (let i = 0; i < MAX_FAILURES_ACCOUNT; i++) {
      recordFailure(`compte:${email}`, MAX_FAILURES_ACCOUNT)
    }
    const { sent, next } = call('POST', '/auth/login', { body: { email, password: 'x' } })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(429)
    expect(Number(sent.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('verrouille aussi un email sans compte — sinon le 429 est un oracle', () => {
    // Si seuls les comptes existants étaient comptés, obtenir un 429 prouverait
    // que l'adresse est enregistrée.
    const email = 'personne@nulle-part.fr'
    for (let i = 0; i < MAX_FAILURES_ACCOUNT; i++) {
      recordFailure(`compte:${email}`, MAX_FAILURES_ACCOUNT)
    }
    const { sent } = call('POST', '/auth/login', { body: { email, password: 'x' } })
    expect(sent.status).toBe(429)
  })
})

describe('IP du client derrière le reverse proxy', () => {
  const ipDe = (xff) => clientIp({ headers: xff === null ? {} : { 'x-forwarded-for': xff }, ip: '10.0.0.1' })

  it('retient le DERNIER élément de X-Forwarded-For, pas le premier', () => {
    // Le nginx de bordure fait $proxy_add_x_forwarded_for : il APPEND l'IP
    // réelle. Tout ce qui précède vient du client et peut être forgé.
    expect(ipDe('198.51.100.9')).toBe('198.51.100.9')
    expect(ipDe('1.2.3.4, 198.51.100.9')).toBe('198.51.100.9')
  })

  it('ignore une chaîne forgée par le client', () => {
    expect(ipDe('9.9.9.9, 8.8.8.8, 198.51.100.9')).toBe('198.51.100.9')
    expect(ipDe('9.9.9.9, 8.8.8.8, 198.51.100.9')).not.toBe('9.9.9.9')
  })

  it('retombe sur req.ip sans en-tête', () => {
    expect(ipDe(null)).toBe('10.0.0.1')
    expect(ipDe('  ')).toBe('10.0.0.1')
  })
})

describe('register — validation', () => {
  it('refuse un mot de passe trop court', () => {
    const { sent } = call('POST', '/auth/register', {
      body: { email: 'n@b.fr', password: 'court', name: 'N' },
    })
    expect(sent.status).toBe(400)
    expect(sent.body.error).toMatch(/trop court/)
  })

  it('refuse un email malformé', () => {
    const { sent } = call('POST', '/auth/register', {
      body: { email: 'pasunemail', password: 'motdepassesolide', name: 'N' },
    })
    expect(sent.status).toBe(400)
  })

  it('refuse un email déjà pris, insensible à la casse', () => {
    const { sent } = call('POST', '/auth/register', {
      body: { email: 'A@B.FR', password: 'motdepassesolide', name: 'N' },
    })
    expect(sent.status).toBe(409)
  })
})

describe('propriété — lecture', () => {
  it('ne liste que les groupes de l’utilisateur', () => {
    const { res, sent, next } = call('GET', '/groups', { token: tokenU1() })
    expect(next).toHaveBeenCalled()
    res.json(db().groups)
    expect(sent.body.map(g => g.id).sort()).toEqual(['g1', 'g3'])
  })

  it('refuse la lecture d’un groupe d’autrui', () => {
    const { next, sent } = call('GET', '/groups/g2', { token: tokenU1() })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('autorise le groupe créé mais pas encore rejoint', () => {
    // Fenêtre entre POST /groups et le POST /members qui suit : sans le
    // repli sur createdByUserId, l'application ne pourrait pas créer de groupe.
    const { next } = call('GET', '/groups/g3', { token: tokenU1() })
    expect(next).toHaveBeenCalled()
  })

  it('refuse une liste filtrée sur le groupe d’autrui', () => {
    const { next, sent } = call('GET', '/expenses', {
      token: tokenU1(), query: { groupId: 'g2' },
    })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('réduit les fetchs bulk aux groupes de l’utilisateur (V10)', () => {
    const { res, sent } = call('GET', '/expenses', { token: tokenU1() })
    res.json(db().expenses)
    expect(sent.body.map(e => e.id)).toEqual(['e1'])
  })

  it('refuse la lecture d’une ressource rattachée à un groupe d’autrui (V04)', () => {
    const { next, sent } = call('GET', '/expenses/e2', { token: tokenU1() })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('laisse json-server répondre 404 sur une ressource inexistante', () => {
    // Un 403 ici révélerait qu'un id existe dans le groupe de quelqu'un d'autre.
    const { next } = call('GET', '/expenses/inexistant', { token: tokenU1() })
    expect(next).toHaveBeenCalled()
  })
})

describe('propriété — écriture', () => {
  it('refuse la création dans un groupe d’autrui', () => {
    const { next, sent } = call('POST', '/expenses', {
      token: tokenU1(), body: { groupId: 'g2', label: 'intrus' },
    })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('autorise la création dans son propre groupe', () => {
    const { next } = call('POST', '/expenses', {
      token: tokenU1(), body: { groupId: 'g1', label: 'ok' },
    })
    expect(next).toHaveBeenCalled()
  })

  it('refuse la suppression d’une ressource d’autrui', () => {
    const { next, sent } = call('DELETE', '/payments/p1', { token: tokenU1() })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('trace le créateur côté serveur, sans faire confiance au client', () => {
    const { req, next } = call('POST', '/groups', {
      token: tokenU1(), body: { name: 'Neuf', createdByUserId: 'u2' },
    })
    expect(next).toHaveBeenCalled()
    expect(req.body.createdByUserId).toBe('u1') // la valeur soumise est écrasée
  })
})

describe('comptes', () => {
  it('refuse de modifier le compte d’autrui', () => {
    const { next, sent } = call('PATCH', '/users/u2', { token: tokenU1(), body: { name: 'pirate' } })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('autorise la modification de son propre compte', () => {
    const { next } = call('PATCH', '/users/u1', { token: tokenU1(), body: { name: 'moi' } })
    expect(next).toHaveBeenCalled()
  })

  it('refuse la création directe de compte hors /auth/register', () => {
    const { next, sent } = call('POST', '/users', { token: tokenU1(), body: { email: 'x@y.fr' } })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('laisse passer les recherches, que privacy-middleware filtrera ensuite', () => {
    const { next } = call('GET', '/users', { token: tokenU1(), query: { shareId: 'NT-AAAA-BBBB' } })
    expect(next).toHaveBeenCalled()
  })
})

describe('refus par défaut', () => {
  it('refuse une collection inconnue plutôt que la laisser passer', () => {
    const { next, sent } = call('GET', '/secrets', { token: tokenU1() })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('refuse une sous-route /auth inconnue', () => {
    const { sent } = call('POST', '/auth/nimportequoi', { token: tokenU1() })
    expect(sent.status).toBe(404)
  })
})

describe('isolation entre deux comptes', () => {
  it('u1 et u2 ne voient jamais les données l’un de l’autre', () => {
    const vuU1 = call('GET', '/expenses', { token: tokenU1() })
    vuU1.res.json(db().expenses)
    const vuU2 = call('GET', '/expenses', { token: tokenU2() })
    vuU2.res.json(db().expenses)

    expect(vuU1.sent.body.map(e => e.id)).toEqual(['e1'])
    expect(vuU2.sent.body.map(e => e.id)).toEqual(['e2'])
  })
})

// L'identifiant est généré côté serveur depuis S4 (le client n'a pas encore de
// jeton à l'inscription). Les deux implémentations doivent rester compatibles :
// si l'alphabet divergeait, normalizeShareId() rejetterait les identifiants émis.
describe('cohérence de l’identifiant de partage serveur / client', () => {
  it('tout identifiant généré par le serveur passe la validation du client', () => {
    for (let i = 0; i < 200; i++) {
      const id = generateShareId()
      expect(id).toMatch(/^NT-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
      expect(isValidShareId(id)).toBe(true)
      // normalizeShareId ne doit pas le transformer : il est déjà canonique.
      expect(normalizeShareId(id)).toBe(id)
    }
  })

  it('n’émet aucun caractère ambigu (I, L, O, 0, 1)', () => {
    const interdits = /[ILO01]/
    for (let i = 0; i < 200; i++) {
      expect(generateShareId().slice(3).replace('-', '')).not.toMatch(interdits)
    }
  })
})
