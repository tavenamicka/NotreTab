import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../utils/api'
import ParticipationWizard from './ParticipationWizard'

vi.mock('../utils/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Alice Test', email: 'alice@test.com', initials: 'AT', color: '#1D9E75', textColor: '#fff' },
  }),
}))
vi.mock('../utils/ToastContext', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}))
vi.mock('../utils/api', () => ({
  api: {
    createGroup:    vi.fn().mockResolvedValue({ id: 1 }),
    addMember:      vi.fn().mockResolvedValue({ id: 10 }),
    createExpense:  vi.fn().mockResolvedValue({ id: 100 }),
    getUserByEmail: vi.fn().mockResolvedValue([]),
  },
}))

const DEFAULT_PROPS = {
  open: true,
  onClose: vi.fn(),
  onSaved: vi.fn(),
}

async function fillStep1(user) {
  await user.type(screen.getByPlaceholderText(/Dîner au restaurant/i), 'Repas du soir')
  await user.type(screen.getByPlaceholderText('0,00'), '45')
  await user.click(screen.getByRole('button', { name: /Suivant/i }))
}

async function addGuest(user, name = 'Bob Invité') {
  await user.click(screen.getByText(/Ajouter un invité sans compte/i))
  await user.type(screen.getByPlaceholderText(/Prénom Nom/i), name)
  await user.click(screen.getByRole('button', { name: 'Ajouter' }))
}

async function toStep3(user) {
  await fillStep1(user)
  await addGuest(user)
  await user.click(screen.getByRole('button', { name: /Suivant/i }))
}

// ── Étape 1 ────────────────────────────────────────────────────

describe('ParticipationWizard — étape 1', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche les champs Description, Montant et Catégorie', () => {
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    expect(screen.getByPlaceholderText(/Dîner au restaurant/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('0,00')).toBeInTheDocument()
    expect(screen.getByText(/Catégorie/i)).toBeInTheDocument()
  })

  it('affiche une erreur si la description est trop courte', async () => {
    const user = userEvent.setup()
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    await user.click(screen.getByRole('button', { name: /Suivant/i }))
    expect(screen.getByText(/Description trop courte/i)).toBeInTheDocument()
  })

  it('affiche une erreur si le montant est invalide', async () => {
    const user = userEvent.setup()
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    await user.type(screen.getByPlaceholderText(/Dîner/i), 'Repas du soir')
    await user.click(screen.getByRole('button', { name: /Suivant/i }))
    expect(screen.getByText(/Montant invalide/i)).toBeInTheDocument()
  })

  it('passe à l\'étape 2 quand description et montant sont valides', async () => {
    const user = userEvent.setup()
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    await fillStep1(user)
    expect(screen.getByText(/Les participants/i)).toBeInTheDocument()
  })
})

// ── Étape 2 ────────────────────────────────────────────────────

describe('ParticipationWizard — étape 2', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche le créateur comme participant', async () => {
    const user = userEvent.setup()
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    await fillStep1(user)
    expect(screen.getByText(/Alice Test/i)).toBeInTheDocument()
  })

  it('affiche une erreur si le créateur est le seul participant', async () => {
    const user = userEvent.setup()
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    await fillStep1(user)
    await user.click(screen.getByRole('button', { name: /Suivant/i }))
    expect(screen.getByText(/Ajoutez au moins un autre participant/i)).toBeInTheDocument()
  })

  it('peut ajouter un invité et l\'afficher dans la liste', async () => {
    const user = userEvent.setup()
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    await fillStep1(user)
    await addGuest(user, 'Marie Curie')
    expect(screen.getByText('Marie Curie')).toBeInTheDocument()
  })

  it('retourne à l\'étape 1 via le bouton Retour', async () => {
    const user = userEvent.setup()
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    await fillStep1(user)
    await user.click(screen.getByRole('button', { name: /Retour/i }))
    expect(screen.getByPlaceholderText(/Dîner au restaurant/i)).toBeInTheDocument()
  })
})

// ── Étape 3 ────────────────────────────────────────────────────

describe('ParticipationWizard — étape 3', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passe à l\'étape 3 avec deux participants', async () => {
    const user = userEvent.setup()
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    await toStep3(user)
    expect(screen.getByText(/répartition/i)).toBeInTheDocument()
  })

  it('affiche une erreur si les pourcentages custom ne totalisent pas 100%', async () => {
    const user = userEvent.setup()
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    await toStep3(user)
    await user.click(screen.getByText('Pourcentages'))
    await user.click(screen.getByRole('button', { name: /Créer et enregistrer/i }))
    expect(screen.getByText(/doit être 100/i)).toBeInTheDocument()
  })

  it('affiche une erreur si les montants custom ne totalisent pas le total', async () => {
    const user = userEvent.setup()
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    await toStep3(user)
    await user.click(screen.getByText('Montants'))
    await user.click(screen.getByRole('button', { name: /Créer et enregistrer/i }))
    expect(screen.getByText(/doit être 45/i)).toBeInTheDocument()
  })

  it('appelle createGroup, addMember et createExpense à la soumission', async () => {
    const user = userEvent.setup()
    render(<ParticipationWizard {...DEFAULT_PROPS} />)
    await toStep3(user)
    await user.click(screen.getByRole('button', { name: /Créer et enregistrer/i }))
    await waitFor(() => {
      expect(api.createGroup).toHaveBeenCalledWith(expect.objectContaining({ type: 'ponctuel' }))
      expect(api.addMember).toHaveBeenCalledTimes(2)
      expect(api.createExpense).toHaveBeenCalled()
    })
  })
})
