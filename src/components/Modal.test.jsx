import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'

describe('Modal — comportement de base', () => {
  it('affiche le titre et le contenu quand open=true', () => {
    render(<Modal open onClose={() => {}} title="Mon titre">Contenu test</Modal>)
    expect(screen.getByText('Mon titre')).toBeInTheDocument()
    expect(screen.getByText('Contenu test')).toBeInTheDocument()
  })

  it('ne rend rien quand open=false', () => {
    render(<Modal open={false} onClose={() => {}} title="Mon titre">Contenu</Modal>)
    expect(screen.queryByText('Mon titre')).not.toBeInTheDocument()
  })

  it('appelle onClose au clic sur le bouton ✕', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="T">X</Modal>)
    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('appelle onClose sur touche Escape', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="T">X</Modal>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('appelle onClose au clic sur l\'overlay (hors panneau)', () => {
    const onClose = vi.fn()
    const { container } = render(<Modal open onClose={onClose} title="T">X</Modal>)
    const overlay = container.firstChild
    fireEvent.click(overlay, { target: overlay })
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('Modal — accessibilité', () => {
  it('le panneau a role="dialog" et aria-modal="true"', () => {
    render(<Modal open onClose={() => {}} title="T">X</Modal>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('relie aria-labelledby au titre via un id partagé', () => {
    render(<Modal open onClose={() => {}} title="Mon titre">X</Modal>)
    const dialog = screen.getByRole('dialog')
    const titleId = dialog.getAttribute('aria-labelledby')
    expect(titleId).toBeTruthy()
    expect(document.getElementById(titleId)).toHaveTextContent('Mon titre')
  })

  it('le bouton Fermer a aria-label="Fermer"', () => {
    render(<Modal open onClose={() => {}} title="T">X</Modal>)
    expect(screen.getByLabelText('Fermer')).toBeInTheDocument()
  })

  it('déplace le focus sur le premier élément focusable à l\'ouverture', async () => {
    render(<Modal open onClose={() => {}} title="T"><button>Test</button></Modal>)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Fermer')))
  })

  it('piège le focus : Tab cycle dans la modal', async () => {
    const user = userEvent.setup()
    render(
      <Modal open onClose={() => {}} title="T">
        <button>A</button>
        <button>B</button>
      </Modal>
    )
    const closeBtn = screen.getByLabelText('Fermer')
    const btnA = screen.getByText('A')
    const btnB = screen.getByText('B')

    await waitFor(() => expect(document.activeElement).toBe(closeBtn))
    await user.tab()
    expect(document.activeElement).toBe(btnA)
    await user.tab()
    expect(document.activeElement).toBe(btnB)
    await user.tab() // dépasse le dernier → revient au premier
    expect(document.activeElement).toBe(closeBtn)
  })

  it('piège le focus : Shift+Tab depuis le premier élément atteint le dernier', async () => {
    const user = userEvent.setup()
    render(
      <Modal open onClose={() => {}} title="T">
        <button>A</button>
        <button>B</button>
      </Modal>
    )
    const closeBtn = screen.getByLabelText('Fermer')
    const btnB = screen.getByText('B')

    await waitFor(() => expect(document.activeElement).toBe(closeBtn))
    await user.tab({ shift: true }) // Shift+Tab depuis le premier → dernier
    expect(document.activeElement).toBe(btnB)
  })

  it('restitue le focus au déclencheur à la fermeture', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = render(<Modal open onClose={() => {}} title="T">X</Modal>)
    rerender(<Modal open={false} onClose={() => {}} title="T">X</Modal>)

    await waitFor(() => expect(document.activeElement).toBe(trigger))
    document.body.removeChild(trigger)
  })
})
