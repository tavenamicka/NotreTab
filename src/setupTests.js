import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'

// Reset localStorage between tests
afterEach(() => localStorage.clear())

// jsdom ne supporte pas navigator.vibrate
Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), writable: true })
