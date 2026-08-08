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

  it('autorise la recherche par email exact (authentification)', () => {
    const { next } = call('GET', '/users', { email: 'a@b.fr' })
    expect(next).toHaveBeenCalled()
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
    { id: '1', name: 'A', password: '$2b$10$hash', shareId: 'NT-AAAA-BBBB' },
    { id: '2', name: 'B', password: '$2b$10$hash2', shareId: 'NT-CCCC-DDDD' },
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
    expect(sent.body.every(u => !('password' in u))).toBe(true)
  })

  it('conserve le hash sur la requête d’authentification par email', () => {
    const { res, sent } = call('GET', '/users', { email: 'a@b.fr' })
    res.json(withPassword)
    expect(sent.body[0].password).toBe('$2b$10$hash')
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
