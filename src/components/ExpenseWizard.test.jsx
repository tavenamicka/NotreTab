import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../utils/api'
import ExpenseWizard from './ExpenseWizard'

vi.mock('../utils/ToastContext', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}))
vi.mock('../utils/api', () => ({
  api: {
    createExpense:  vi.fn().mockResolvedValue({ id: 10 }),
    updateExpense:  vi.fn().mockResolvedValue({}),
    addGuest:       vi.fn().mockResolvedValue({ id: 99, name: 'G', initials: 'G', color: '#fff', textColor: '#000' }),
    getUserByEmail: vi.fn().mockResolvedValue([]),
    addMember:      vi.fn().mockResolvedValue({}),
  },
}))

const MEMBERS = [
  { id: 1, name: 'Alice Dupont', initials: 'AD', color: '#1D9E75', textColor: '#fff', isGuest: false, userId: 1 },
  { id: 2, name: 'Bob Martin',   initials: 'BM', color: '#378ADD', textColor: '#fff', isGuest: false, userId: 2 },
]

const EXPENSE = {
  id: 5,
  description: 'Vieux repas',
  amount: 40,
  paidById: 1,
  splitBetween: [1, 2],
  splitMode: 'equal',
  customShares: {},
  customAmounts: {},
  date: '2026-01-01',
  category: 'restaurant',
  note: '',
  createdAt: '2026-01-01T10:00:00Z',
}

const DEFAULT_PROPS = {
  open: true,
  onClose: vi.fn(),
  onSaved: vi.fn(),
  groupId: 1,
  members: MEMBERS,
}

async function toStep2(user) {
  await user.type(screen.getByPlaceholderText(/Restaurant du soir/i), 'Repas midi')
  await user.type(screen.getByPlaceholderText('0.00'), '25')
  await user.click(screen.getByRole('button', { name: /Suivant/i }))
}

async function toStep3(user) {
  await toStep2(user)
  await user.click(screen.getByRole('button', { name: /Suivant/i }))
}

// ── Étape 1 ────────────────────────────────────────────────────

describe('ExpenseWizard — étape 1', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche les champs Description et Montant', () => {
    render(<ExpenseWizard {...DEFAULT_PROPS} />)
    expect(screen.getByPlaceholderText(/Restaurant du soir/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument()
  })

  it('bouton Suivant désactivé si aucun membre', () => {
    render(<ExpenseWizard {...DEFAULT_PROPS} members={[]} />)
    expect(screen.getByRole('button', { name: /Suivant/i })).toBeDisabled()
  })

  it('affiche une erreur si la description est trop courte', async () => {
    const user = userEvent.setup()
    render(<ExpenseWizard {...DEFAULT_PROPS} />)
    await user.click(screen.getByRole('button', { name: /Suivant/i }))
    expect(screen.getByText(/Description trop courte/i)).toBeInTheDocument()
  })

  it('affiche une erreur si le montant est invalide', async () => {
    const user = userEvent.setup()
    render(<ExpenseWizard {...DEFAULT_PROPS} />)
    await user.type(screen.getByPlaceholderText(/Restaurant/i), 'Repas')
    await user.click(screen.getByRole('button', { name: /Suivant/i }))
    expect(screen.getByText(/Montant invalide/i)).toBeInTheDocument()
  })

  it('passe à l\'étape 2 quand description et montant sont valides', async () => {
    const user = userEvent.setup()
    render(<ExpenseWizard {...DEFAULT_PROPS} />)
    await user.type(screen.getByPlaceholderText(/Restaurant/i), 'Repas midi')
    await user.type(screen.getByPlaceholderText('0.00'), '25')
    await user.click(screen.getByRole('button', { name: /Suivant/i }))
    expect(screen.getByText(/Mode de répartition/i)).toBeInTheDocument()
  })
})

// ── Étape 2 ────────────────────────────────────────────────────

describe('ExpenseWizard — étape 2', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche une erreur si tous les membres sont décochés', async () => {
    const user = userEvent.setup()
    render(<ExpenseWizard {...DEFAULT_PROPS} />)
    await toStep2(user)
    await user.click(screen.getByText('Alice'))
    await user.click(screen.getByText('Bob'))
    await user.click(screen.getByRole('button', { name: /Suivant/i }))
    expect(screen.getByText(/Sélectionnez au moins un membre/i)).toBeInTheDocument()
  })

  it('affiche une erreur si les pourcentages ne totalisent pas 100%', async () => {
    const user = userEvent.setup()
    render(<ExpenseWizard {...DEFAULT_PROPS} />)
    await toStep2(user)
    await user.click(screen.getByText('Pourcentages'))
    await user.click(screen.getByRole('button', { name: /Suivant/i }))
    expect(screen.getByText(/Le total des pourcentages doit être 100%/i)).toBeInTheDocument()
  })

  it('retourne à l\'étape 1 via le bouton Retour', async () => {
    const user = userEvent.setup()
    render(<ExpenseWizard {...DEFAULT_PROPS} />)
    await toStep2(user)
    await user.click(screen.getByRole('button', { name: /Retour/i }))
    expect(screen.getByPlaceholderText(/Restaurant du soir/i)).toBeInTheDocument()
  })
})

// ── Étape 3 ────────────────────────────────────────────────────

describe('ExpenseWizard — étape 3', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne à l\'étape 2 via le bouton Retour', async () => {
    const user = userEvent.setup()
    render(<ExpenseWizard {...DEFAULT_PROPS} />)
    await toStep3(user)
    await user.click(screen.getByRole('button', { name: /Retour/i }))
    expect(screen.getByText(/Mode de répartition/i)).toBeInTheDocument()
  })

  it('appelle createExpense lors de la soumission', async () => {
    const user = userEvent.setup()
    render(<ExpenseWizard {...DEFAULT_PROPS} />)
    await toStep3(user)
    await user.click(screen.getByRole('button', { name: /Ajouter/i }))
    await waitFor(() => expect(api.createExpense).toHaveBeenCalled())
  })
})

// ── Mode édition ───────────────────────────────────────────────

describe('ExpenseWizard — mode édition', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche "Modifier" dans le titre', () => {
    render(<ExpenseWizard {...DEFAULT_PROPS} expense={EXPENSE} />)
    expect(screen.getByText(/Modifier — Étape/i)).toBeInTheDocument()
  })

  it('appelle updateExpense à la soumission', async () => {
    const user = userEvent.setup()
    render(<ExpenseWizard {...DEFAULT_PROPS} expense={EXPENSE} />)
    await user.click(screen.getByRole('button', { name: /Suivant/i }))
    await user.click(screen.getByRole('button', { name: /Suivant/i }))
    await user.click(screen.getByRole('button', { name: 'Modifier' }))
    await waitFor(() => expect(api.updateExpense).toHaveBeenCalledWith(EXPENSE.id, expect.any(Object)))
  })
})
