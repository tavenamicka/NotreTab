import { describe, it, expect, vi } from 'vitest'
import middleware from './privacy-middleware.cjs'

/** Faux couple req/res Express, suffisant pour ce middleware. */
function call(method, path, query = {}) {
  const req = { method, path, query }
  const sent = { status: 200, body: undefined }
  const res = {
    status(code) { sent.status = code; return res },
    json(body) { sent.body = body; return res },
    jsonp(body) { sent.body = body; return res },
  }
  const next = vi.fn()
  middleware(req, res, next)
  return { res, next, sent }
}

describe('collections autres que users', () => {
  it('laisse passer sans filtrer', () => {
    const { next, sent } = call('GET', '/groups')
    expect(next).toHaveBeenCalled()
    expect(sent.status).toBe(200)
  })

  it('ne bloque pas un chemin qui contient users sans être la collection', () => {
    const { next } = call('GET', '/members')
    expect(next).toHaveBeenCalled()
  })
})

describe('GET /users — filtres obligatoires', () => {
  it('refuse le listing global', () => {
    const { next, sent } = call('GET', '/users')
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('refuse une recherche floue sans restriction de visibilité', () => {
    const { next, sent } = call('GET', '/users', { name_like: 'mic' })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('refuse la pagination utilisée comme listing', () => {
    const { next, sent } = call('GET', '/users', { _start: '0', _limit: '100' })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('refuse la lecture directe d’un profil par id', () => {
    const { next, sent } = call('GET', '/users/aDdL2aa')
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  // Depuis S4, l'authentification passe par POST /auth/login : plus personne
  // n'a besoin de chercher un compte par email, et ce canal donnait le hash.
  it('refuse désormais la recherche par email, même exact', () => {
    const { next, sent } = call('GET', '/users', { email: 'a@b.fr' })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('autorise la recherche par identifiant de partage', () => {
    const { next } = call('GET', '/users', { shareId: 'NT-7K4M-2QXR' })
    expect(next).toHaveBeenCalled()
  })

  it('autorise la recherche floue restreinte aux comptes visibles', () => {
    const { next } = call('GET', '/users', { discoverable: 'true', name_like: 'mic' })
    expect(next).toHaveBeenCalled()
  })

  it('refuse discoverable=false comme échappatoire', () => {
    const { next, sent } = call('GET', '/users', { discoverable: 'false', name_like: 'mic' })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })
})

describe('retrait du hash de mot de passe', () => {
  const withPassword = [
    { id: '1', name: 'A', email: 'a@b.fr', password: '$2b$10$hash', shareId: 'NT-AAAA-BBBB', discoverable: true },
    { id: '2', name: 'B', email: 'b@b.fr', password: '$2b$10$hash2', shareId: 'NT-CCCC-DDDD', discoverable: true },
  ]

  it('nettoie la réponse d’une recherche par identifiant', () => {
    const { res, sent } = call('GET', '/users', { shareId: 'NT-AAAA-BBBB' })
    res.json(withPassword)
    expect(sent.body.every(u => !('password' in u))).toBe(true)
    expect(sent.body[0].shareId).toBe('NT-AAAA-BBBB')
  })

  it('nettoie la réponse d’une recherche de comptes visibles', () => {
    const { res, sent } = call('GET', '/users', { discoverable: 'true' })
    res.jsonp(withPassword)
    expect(sent.body).toHaveLength(2)
    expect(sent.body.every(u => !('password' in u))).toBe(true)
  })

  // Contrat inversé par S4 : il n'existe plus AUCUNE requête qui ressorte un
  // hash. C'était la dernière brèche de V03.
  it('ne laisse plus jamais sortir le hash, quelle que soit la requête', () => {
    const parIdentifiant = call('GET', '/users', { shareId: 'NT-AAAA-BBBB' })
    parIdentifiant.res.json(withPassword)
    expect(parIdentifiant.sent.body.every(u => !('password' in u))).toBe(true)

    const parVisibilite = call('GET', '/users', { discoverable: 'true' })
    parVisibilite.res.json(withPassword)
    expect(parVisibilite.sent.body.every(u => !('password' in u))).toBe(true)

    const ecriture = call('PATCH', '/users/1')
    ecriture.res.json(withPassword[0])
    expect('password' in ecriture.sent.body).toBe(false)
  })

  it('nettoie la réponse d’un PATCH', () => {
    const { res, sent } = call('PATCH', '/users/1')
    res.json(withPassword[0])
    expect('password' in sent.body).toBe(false)
  })

  it('nettoie la réponse d’une création de compte', () => {
    const { res, sent } = call('POST', '/users')
    res.json(withPassword[0])
    expect('password' in sent.body).toBe(false)
  })
})

// Régression : json-server 0.17 écarte un filtre dont la clé n'existe sur aucun
// enregistrement. En production le 2026-08-09, aucun compte n'avait encore de
// `shareId` (migration paresseuse au login) : `?shareId=nimportequoi` renvoyait
// donc les 3 comptes avec leurs emails, contournant le 403 sur le listing nu.
// Le middleware réapplique désormais les filtres qu'il autorise.
describe('filtrage réappliqué par le middleware', () => {
  const base = [
    { id: '1', name: 'A', email: 'a@b.fr', shareId: 'NT-AAAA-BBBB', discoverable: true },
    { id: '2', name: 'B', email: 'b@b.fr', shareId: 'NT-CCCC-DDDD', discoverable: false },
    { id: '3', name: 'C', email: 'c@b.fr' }, // antérieur à VIS1 : ni shareId ni discoverable
  ]

  it('ne renvoie rien pour un identifiant qui ne correspond à aucun compte', () => {
    const { res, sent } = call('GET', '/users', { shareId: 'NT-ZZZZ-ZZZZ' })
    res.json(base)
    expect(sent.body).toEqual([])
  })

  it('ne renvoie que le compte dont l’identifiant correspond', () => {
    const { res, sent } = call('GET', '/users', { shareId: 'NT-CCCC-DDDD' })
    res.json(base)
    expect(sent.body).toHaveLength(1)
    expect(sent.body[0].id).toBe('2')
  })

  it('n’expose jamais un compte dépourvu de shareId sur une recherche par identifiant', () => {
    const { res, sent } = call('GET', '/users', { shareId: 'NT-AAAA-BBBB' })
    res.json(base)
    expect(sent.body.map(u => u.id)).not.toContain('3')
  })

  it('exclut les comptes privés et ceux sans le champ sur discoverable=true', () => {
    const { res, sent } = call('GET', '/users', { discoverable: 'true' })
    res.json(base)
    expect(sent.body.map(u => u.id)).toEqual(['1'])
  })

  it('applique aussi le filtre quand discoverable est combiné à une recherche floue', () => {
    const { res, sent } = call('GET', '/users', { discoverable: 'true', name_like: 'A' })
    res.json(base)
    expect(sent.body.map(u => u.id)).toEqual(['1'])
  })

  it('refuse la requête par email avant même de filtrer', () => {
    const { next, sent } = call('GET', '/users', { email: 'b@b.fr' })
    expect(next).not.toHaveBeenCalled()
    expect(sent.status).toBe(403)
  })

  it('combine les filtres en ET quand plusieurs sont fournis', () => {
    const { res, sent } = call('GET', '/users', { shareId: 'NT-AAAA-BBBB', discoverable: 'true' })
    res.json(base)
    expect(sent.body.map(u => u.id)).toEqual(['1'])

    const second = call('GET', '/users', { shareId: 'NT-CCCC-DDDD', discoverable: 'true' })
    second.res.json(base)
    expect(second.sent.body).toEqual([])
  })

  it('tolère discoverable stocké en chaîne', () => {
    const { res, sent } = call('GET', '/users', { discoverable: 'true' })
    res.json([{ id: '9', discoverable: 'true' }])
    expect(sent.body).toHaveLength(1)
  })

  it('laisse passer un objet seul sans tenter de le filtrer', () => {
    const { res, sent } = call('POST', '/users')
    res.json({ id: '4', name: 'D', password: '$2b$10$x' })
    expect(sent.body.id).toBe('4')
    expect('password' in sent.body).toBe(false)
  })

  it('ne filtre pas les collections autres que users', () => {
    const { res, sent } = call('GET', '/groups', { shareId: 'NT-ZZZZ-ZZZZ' })
    res.json([{ id: 'g1' }, { id: 'g2' }])
    expect(sent.body).toHaveLength(2)
  })
})
