// src/utils/shareId.js
// Identifiant public de partage — le seul moyen d'ajouter un utilisateur
// qui n'a pas activé la visibilité publique (voir Profile → Visibilité).
//
// Format canonique : NT-XXXX-XXXX (8 caractères significatifs)
// Alphabet sans caractères ambigus (pas de I, L, O, 0, 1) — l'identifiant est
// destiné à être dicté à l'oral ou recopié à la main.

export const SHARE_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const SHARE_ID_LENGTH = 8
export const SHARE_ID_PREFIX = 'NT'

// Confusions les plus fréquentes à la saisie manuelle → caractère de l'alphabet
const LOOKALIKES = { I: 'J', L: 'J', O: 'Q', '0': 'Q', '1': '7' }

function randomChars(n) {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  // 256 % 31 ≠ 0 : on rejette la queue non uniforme plutôt que biaiser le modulo
  let out = ''
  for (let i = 0; i < n; i++) {
    let b = bytes[i]
    while (b >= 248) {                       // 248 = 31 * 8, plus grand multiple < 256
      const extra = new Uint8Array(1)
      crypto.getRandomValues(extra)
      b = extra[0]
    }
    out += SHARE_ID_ALPHABET[b % SHARE_ID_ALPHABET.length]
  }
  return out
}

/** Génère un identifiant de partage au format canonique NT-XXXX-XXXX. */
export function generateShareId() {
  const raw = randomChars(SHARE_ID_LENGTH)
  return `${SHARE_ID_PREFIX}-${raw.slice(0, 4)}-${raw.slice(4)}`
}

/**
 * Normalise une saisie utilisateur vers la forme canonique.
 * Tolère : minuscules, espaces, tirets manquants ou en trop, préfixe NT absent,
 * et les confusions visuelles courantes (O→Q, 0→Q, I/L→J, 1→7).
 * @returns {string} identifiant canonique, ou '' si la saisie est inexploitable
 */
export function normalizeShareId(input) {
  if (typeof input !== 'string') return ''
  let s = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  // Le préfixe n'est retiré que s'il est en trop : un identifiant saisi sans
  // préfixe peut lui-même commencer par NT (ex. NTABCDEF).
  if (s.length === SHARE_ID_LENGTH + SHARE_ID_PREFIX.length && s.startsWith(SHARE_ID_PREFIX)) {
    s = s.slice(SHARE_ID_PREFIX.length)
  }
  s = s.split('').map(c => LOOKALIKES[c] ?? c).join('')
  if (s.length !== SHARE_ID_LENGTH) return ''
  if (![...s].every(c => SHARE_ID_ALPHABET.includes(c))) return ''
  return `${SHARE_ID_PREFIX}-${s.slice(0, 4)}-${s.slice(4)}`
}

/** true si la saisie correspond à un identifiant de partage exploitable. */
export function isValidShareId(input) {
  return normalizeShareId(input) !== ''
}
