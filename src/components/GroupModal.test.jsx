import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../utils/api'
import GroupModal from './GroupModal'

vi.mock('../utils/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Test', email: 'test@test.com', initials: 'T', color: '#1D9E75', textColor: '#fff' },
  }),
}))
vi.mock('../utils/ToastContext', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}))
vi.mock('../utils/api', () => ({
  api: {
    createGroup: vi.fn().mockResolvedValue({ id: 99 }),
    addMember:   vi.fn().mockResolvedValue({}),
    getMembersByGroup: vi.fn().mockResolvedValue([]),
  },
}))

const PARENT_GROUP         = { id: '1', name: 'Budget Principal', color: '#1D9E75', parentId: null }
const TEMPORAL_BUDGET_GROUP = { id: '2', name: 'Budget Annuel', color: '#1D9E75', parentId: null, type: 'budget', budgetMode: 'temporal' }

const DEFAULT_PROPS = {
  open: true,
  onClose: vi.fn(),
  onSaved: vi.fn(),
  groups: [],
}

describe('GroupModal — validation formulaire', () => {
  beforeEach(() => vi.clearAllMocks())

  it('désactive le bouton Créer quand le nom est vide', () => {
    render(<GroupModal {...DEFAULT_PROPS} />)
    expect(screen.getByRole('button', { name: /Créer le groupe/i })).toBeDisabled()
  })

  it('active le bouton Créer quand un nom est saisi (type occasional)', async () => {
    const user = userEvent.setup()
    render(<GroupModal {...DEFAULT_PROPS} defaultType="occasional" />)
    await user.type(screen.getByPlaceholderText(/Vacances/i), 'Budget vacances')
    expect(screen.getByRole('button', { name: /Créer le groupe/i })).not.toBeDisabled()
  })

  it('active le bouton Créer pour un budget temporel dès qu\'une année est sélectionnée', () => {
    render(<GroupModal {...DEFAULT_PROPS} defaultType="budget" />)
    // budgetYear defaults to CUR_YEAR — button should be enabled without typing a name
    expect(screen.getByRole('button', { name: /Créer le groupe/i })).not.toBeDisabled()
  })
})

describe('GroupModal — sélection de type', () => {
  beforeEach(() => vi.clearAllMocks())

  it('masque la section budget pour le type "occasional"', () => {
    render(<GroupModal {...DEFAULT_PROPS} defaultType="occasional" />)
    expect(screen.queryByText('Mode de budget')).not.toBeInTheDocument()
  })

  it('affiche la section budget pour le type "budget"', () => {
    render(<GroupModal {...DEFAULT_PROPS} defaultType="budget" />)
    expect(screen.getByText('Mode de budget')).toBeInTheDocument()
  })

  it('affiche la section budget après avoir cliqué sur le bouton Budget', async () => {
    const user = userEvent.setup()
    render(<GroupModal {...DEFAULT_PROPS} defaultType="occasional" />)
    expect(screen.queryByText('Mode de budget')).not.toBeInTheDocument()
    await user.click(screen.getByText(/Budget commun/))
    expect(screen.getByText('Mode de budget')).toBeInTheDocument()
  })
})

describe('GroupModal — config budget', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche uniquement le sélecteur d\'année en mode Temporel (sans boutons période)', () => {
    render(<GroupModal {...DEFAULT_PROPS} defaultType="budget" />)
    expect(screen.getByText(/Année du budget/)).toBeInTheDocument()
    expect(screen.queryByText(/Trimestre/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Mois$/)).not.toBeInTheDocument()
  })

  it('désactive le bouton Créer si l\'année budget temporel est effacée', async () => {
    const user = userEvent.setup()
    render(<GroupModal {...DEFAULT_PROPS} defaultType="budget" />)
    // Efface le sélecteur d'année (pas de champ Nom en mode temporel)
    await user.selectOptions(screen.getByRole('combobox', { name: /Année du budget/i }), '')
    expect(screen.getByRole('button', { name: /Créer le groupe/i })).toBeDisabled()
  })

  it('affiche les thèmes quand on bascule sur Thématique', async () => {
    const user = userEvent.setup()
    render(<GroupModal {...DEFAULT_PROPS} defaultType="budget" />)
    await user.click(screen.getByText(/Thématique/))
    expect(screen.getByText(/Voyage/)).toBeInTheDocument()
    expect(screen.getByText(/Événement/)).toBeInTheDocument()
    expect(screen.getByText(/Projet/)).toBeInTheDocument()
  })

  it('appelle createGroup avec budgetMode, budgetPeriod, budgetYear et nom auto pour un budget temporel', async () => {
    const user = userEvent.setup()
    render(<GroupModal {...DEFAULT_PROPS} defaultType="budget" />)
    // Pas de champ Nom en mode temporel — on clique directement
    await user.click(screen.getByRole('button', { name: /Créer le groupe/i }))
    await waitFor(() =>
      expect(api.createGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetMode: 'temporal',
          budgetPeriod: 'year',
          budgetYear: expect.any(Number),
          name: expect.stringMatching(/Budget \d{4}/),
        })
      )
    )
  })

  it('masque le champ Nom en mode budget temporel', () => {
    render(<GroupModal {...DEFAULT_PROPS} defaultType="budget" />)
    expect(screen.queryByPlaceholderText(/Vacances/i)).not.toBeInTheDocument()
  })
})

describe('GroupModal — sous-groupe temporel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche les deux options de période (Automatique / Manuel)', () => {
    render(<GroupModal {...DEFAULT_PROPS} parentId="2" groups={[TEMPORAL_BUDGET_GROUP]} />)
    expect(screen.getByText(/Mois en cours/i)).toBeInTheDocument()
    expect(screen.getByText(/Choisir/i)).toBeInTheDocument()
  })

  it('pré-remplit le nom avec le mois et l\'année en cours en mode Automatique', () => {
    render(<GroupModal {...DEFAULT_PROPS} parentId="2" groups={[TEMPORAL_BUDGET_GROUP]} />)
    const input = screen.getByLabelText(/^Nom/i)
    expect(input.value).toMatch(/\d{4}/)
  })

  it('affiche les sélecteurs Mois et Année en mode Manuel', async () => {
    const user = userEvent.setup()
    render(<GroupModal {...DEFAULT_PROPS} parentId="2" groups={[TEMPORAL_BUDGET_GROUP]} />)
    await user.click(screen.getByText(/Choisir/i))
    expect(screen.getByLabelText(/^Mois$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Année$/i)).toBeInTheDocument()
  })

  it('met à jour le nom quand on change de mois en mode Manuel', async () => {
    const user = userEvent.setup()
    render(<GroupModal {...DEFAULT_PROPS} parentId="2" groups={[TEMPORAL_BUDGET_GROUP]} />)
    await user.click(screen.getByText(/Choisir/i))
    await user.selectOptions(screen.getByLabelText(/^Mois$/i), '1')
    const input = screen.getByLabelText(/^Nom/i)
    expect(input.value).toMatch(/Janvier/)
  })

  it('passe subgroupMonth et subgroupYear à createGroup', async () => {
    const user = userEvent.setup()
    render(<GroupModal {...DEFAULT_PROPS} parentId="2" groups={[TEMPORAL_BUDGET_GROUP]} />)
    await user.click(screen.getByRole('button', { name: /Créer le sous-groupe/i }))
    await waitFor(() =>
      expect(api.createGroup).toHaveBeenCalledWith(
        expect.objectContaining({ subgroupMonth: expect.any(Number), subgroupYear: expect.any(Number) })
      )
    )
  })
})

describe('GroupModal — mode sous-groupe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('affiche "Créer le sous-groupe" sur le bouton', () => {
    render(<GroupModal {...DEFAULT_PROPS} parentId="1" groups={[PARENT_GROUP]} />)
    expect(screen.getByRole('button', { name: /Créer le sous-groupe/i })).toBeInTheDocument()
  })

  it('masque la section budget pour un sous-groupe', () => {
    render(<GroupModal {...DEFAULT_PROPS} parentId="1" groups={[PARENT_GROUP]} defaultType="budget" />)
    expect(screen.queryByText('Mode de budget')).not.toBeInTheDocument()
  })

  it('affiche la checkbox d\'import des membres du parent', () => {
    render(<GroupModal {...DEFAULT_PROPS} parentId="1" groups={[PARENT_GROUP]} />)
    expect(screen.getByText(/Importer les membres du groupe parent/i)).toBeInTheDocument()
  })
})
