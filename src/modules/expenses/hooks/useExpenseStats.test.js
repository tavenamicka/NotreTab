import { describe, it, expect } from 'vitest'
import { computeExpenseStats } from './useExpenseStats'

const members = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Carol' },
]

const expenses = [
  {
    id: 'e1', amount: 90, category: 'restaurant', date: '2026-05-10',
    month: '2026-05', year: 2026, paidById: '1',
    splitBetween: ['1', '2', '3'], splitMode: 'equal',
  },
  {
    id: 'e2', amount: 60, category: 'transport', date: '2026-05-20',
    month: '2026-05', year: 2026, paidById: '2',
    splitBetween: ['1', '2'], splitMode: 'equal',
  },
  {
    id: 'e3', amount: 120, category: 'restaurant', date: '2026-04-15',
    month: '2026-04', year: 2026, paidById: '1',
    splitBetween: ['1', '2', '3'], splitMode: 'equal',
  },
]

describe('computeExpenseStats', () => {
  it('retourne des zéros si la liste est vide', () => {
    const stats = computeExpenseStats([], members, '1')
    expect(stats.grandTotal).toBe(0)
    expect(stats.myShareTotal).toBe(0)
    expect(stats.topPayer).toBeNull()
  })

  it('calcule le total général correctement', () => {
    const { grandTotal } = computeExpenseStats(expenses, members, null)
    expect(grandTotal).toBe(270)
  })

  it('regroupe totalByMonth correctement', () => {
    const { totalByMonth } = computeExpenseStats(expenses, members, null)
    expect(totalByMonth['2026-05']).toBe(150)
    expect(totalByMonth['2026-04']).toBe(120)
  })

  it('agrège totalByCategory', () => {
    const { totalByCategory } = computeExpenseStats(expenses, members, null)
    expect(totalByCategory['restaurant']).toBe(210)
    expect(totalByCategory['transport']).toBe(60)
    expect(totalByCategory['logement']).toBeUndefined()
  })

  it('calcule myShareTotal pour parts égales', () => {
    const { myShareTotal } = computeExpenseStats(expenses, members, '1')
    // e1 : 90/3=30, e2 : 60/2=30, e3 : 120/3=40 → 100
    expect(myShareTotal).toBeCloseTo(100, 1)
  })

  it('identifie le topPayer correctement', () => {
    const { topPayer } = computeExpenseStats(expenses, members, null)
    // Alice (id=1) : e1(90) + e3(120) = 210
    expect(topPayer?.memberId).toBe('1')
    expect(topPayer?.name).toBe('Alice')
    expect(topPayer?.total).toBe(210)
  })

  it('calcule myShareTotal en mode custom (%)', () => {
    const exp = [{
      id: 'ec', amount: 100, category: 'autre', date: '2026-05-01',
      month: '2026-05', year: 2026, paidById: '1',
      splitBetween: ['1', '2'], splitMode: 'custom',
      customShares: { '1': 60, '2': 40 },
    }]
    const { myShareTotal } = computeExpenseStats(exp, members, '1')
    expect(myShareTotal).toBeCloseTo(60, 1)
  })

  it('calcule myShareTotal en mode amounts (montants fixes)', () => {
    const exp = [{
      id: 'ea', amount: 100, category: 'autre', date: '2026-05-01',
      month: '2026-05', year: 2026, paidById: '1',
      splitBetween: ['1', '2'], splitMode: 'amounts',
      customAmounts: { '1': 70, '2': 30 },
    }]
    const { myShareTotal } = computeExpenseStats(exp, members, '1')
    expect(myShareTotal).toBeCloseTo(70, 1)
  })

  it('retourne myShareTotal = 0 si currentMemberId absent du split', () => {
    const { myShareTotal } = computeExpenseStats(expenses, members, '99')
    expect(myShareTotal).toBe(0)
  })
})
