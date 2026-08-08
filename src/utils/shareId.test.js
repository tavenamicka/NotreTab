import { describe, it, expect } from 'vitest'
import {
  generateShareId,
  normalizeShareId,
  isValidShareId,
  SHARE_ID_ALPHABET,
} from './shareId'

describe('generateShareId', () => {
  it('produit le format canonique NT-XXXX-XXXX', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateShareId()).toMatch(/^NT-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    }
  })

  it("n'utilise que l'alphabet sans caractères ambigus", () => {
    for (let i = 0; i < 50; i++) {
      const body = generateShareId().replace(/^NT-/, '').replace('-', '')
      expect([...body].every(c => SHARE_ID_ALPHABET.includes(c))).toBe(true)
    }
  })

  it('ne contient jamais I, L, O, 0 ni 1 (confusions à la dictée)', () => {
    const ids = Array.from({ length: 200 }, generateShareId).join('')
    expect(ids).not.toMatch(/[ILO01]/)
  })

  it('reste normalisable même si le corps commence par le préfixe', () => {
    expect(normalizeShareId('NTABCDEF')).toBe('NT-NTAB-CDEF')
    expect(normalizeShareId('NT-NTAB-CDEF')).toBe('NT-NTAB-CDEF')
  })

  it('ne se répète pas sur un petit échantillon', () => {
    const ids = new Set(Array.from({ length: 500 }, generateShareId))
    expect(ids.size).toBe(500)
  })
})

describe('normalizeShareId', () => {
  it('accepte la forme canonique telle quelle', () => {
    expect(normalizeShareId('NT-7K4M-2QXR')).toBe('NT-7K4M-2QXR')
  })

  it('tolère minuscules, espaces et tirets manquants', () => {
    expect(normalizeShareId('nt7k4m2qxr')).toBe('NT-7K4M-2QXR')
    expect(normalizeShareId('  NT 7K4M 2QXR ')).toBe('NT-7K4M-2QXR')
    expect(normalizeShareId('NT--7K4M--2QXR')).toBe('NT-7K4M-2QXR')
  })

  it('accepte la saisie sans le préfixe NT', () => {
    expect(normalizeShareId('7K4M2QXR')).toBe('NT-7K4M-2QXR')
  })

  it('corrige les confusions visuelles courantes', () => {
    expect(normalizeShareId('NT-O0I1-LQXR')).toBe('NT-QQJ7-JQXR')
  })

  it('rejette une longueur incorrecte', () => {
    expect(normalizeShareId('NT-7K4M-2QX')).toBe('')
    expect(normalizeShareId('NT-7K4M-2QXRR')).toBe('')
    expect(normalizeShareId('')).toBe('')
  })

  it('rejette les entrées non exploitables', () => {
    expect(normalizeShareId(null)).toBe('')
    expect(normalizeShareId(undefined)).toBe('')
    expect(normalizeShareId(42)).toBe('')
    expect(normalizeShareId('michel@exemple.com')).toBe('')
  })

  it('est stable : normaliser deux fois ne change rien', () => {
    const id = generateShareId()
    expect(normalizeShareId(normalizeShareId(id))).toBe(id)
  })
})

describe('isValidShareId', () => {
  it('valide un identifiant généré', () => {
    expect(isValidShareId(generateShareId())).toBe(true)
  })

  it('invalide un email ou du texte libre', () => {
    expect(isValidShareId('michel@exemple.com')).toBe(false)
    expect(isValidShareId('Michel')).toBe(false)
  })
})
