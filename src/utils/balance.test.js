import { describe, it, expect } from 'vitest'
import { computeBalances, simplifyDebts } from './balance'

describe('computeBalances', () => {
  it('retourne des soldes à zéro sans données', () => {
    const members = [{ id: 1 }, { id: 2 }]
    expect(computeBalances([], [], members)).toEqual({ '1': 0, '2': 0 })
  })

  it('crédite le payeur et débite les participants à parts égales', () => {
    const members = [{ id: 1 }, { id: 2 }]
    const expenses = [{ paidById: 1, amount: 100, splitBetween: [1, 2], splitMode: 'equal' }]
    const result = computeBalances(expenses, [], members)
    expect(result['1']).toBeCloseTo(50)
    expect(result['2']).toBeCloseTo(-50)
  })

  it('applique un partage personnalisé en pourcentages', () => {
    const members = [{ id: 1 }, { id: 2 }]
    const expenses = [{
      paidById: 1, amount: 100,
      splitBetween: ['1', '2'],
      splitMode: 'custom',
      customShares: { '1': 70, '2': 30 },
    }]
    const result = computeBalances(expenses, [], members)
    expect(result['1']).toBeCloseTo(30)
    expect(result['2']).toBeCloseTo(-30)
  })

  it('réduit les soldes lors d\'un paiement', () => {
    const members = [{ id: 1 }, { id: 2 }]
    const expenses = [{ paidById: 1, amount: 100, splitBetween: [1, 2], splitMode: 'equal' }]
    const payments = [{ fromId: 2, toId: 1, amount: 50 }]
    const result = computeBalances(expenses, payments, members)
    expect(result['1']).toBeCloseTo(0)
    expect(result['2']).toBeCloseTo(0)
  })

  it('gère plusieurs dépenses avec des payeurs différents', () => {
    const members = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const expenses = [
      { paidById: 1, amount: 90, splitBetween: [1, 2, 3], splitMode: 'equal' },
      { paidById: 2, amount: 60, splitBetween: [1, 2, 3], splitMode: 'equal' },
    ]
    const result = computeBalances(expenses, [], members)
    expect(result['1']).toBeCloseTo(40)
    expect(result['2']).toBeCloseTo(10)
    expect(result['3']).toBeCloseTo(-50)
  })
})

describe('simplifyDebts', () => {
  it('retourne un tableau vide si tout le monde est à zéro', () => {
    expect(simplifyDebts({ '1': 0, '2': 0 })).toEqual([])
  })

  it('ignore les soldes inférieurs à 0.01', () => {
    expect(simplifyDebts({ '1': 0.005, '2': -0.005 })).toEqual([])
  })

  it('crée une transaction unique pour une dette simple', () => {
    const result = simplifyDebts({ '1': 50, '2': -50 })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ from: '2', to: '1', amount: 50 })
  })

  it('répartit une dette entre plusieurs débiteurs', () => {
    const result = simplifyDebts({ '1': 100, '2': -60, '3': -40 })
    const total = result.reduce((s, t) => s + t.amount, 0)
    expect(total).toBeCloseTo(100)
    expect(result.every(t => t.to === '1')).toBe(true)
  })

  it('arrondit les montants à 2 décimales', () => {
    const result = simplifyDebts({ '1': 100, '2': -50, '3': -50 })
    result.forEach(t => {
      const dec = t.amount.toString().split('.')[1]
      expect(!dec || dec.length <= 2).toBe(true)
    })
  })
})
