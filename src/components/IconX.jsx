// src/components/IconX.jsx
// Croix « fermer / supprimer », dessinée plutôt qu'écrite.
//
// L'application utilisait le caractère ✕ (U+2715), absent de la police Inter :
// le navigateur retombait sur une police système et le rendu variait d'une
// machine à l'autre, jusqu'au carré « glyphe manquant » sur certains postes
// Windows. Un tracé ne dépend d'aucune police.
//
// `currentColor` fait hériter la couleur du parent : les appelants continuent
// de la piloter par `color`, comme avec un caractère.

export default function IconX({ size = 14, strokeWidth = 1.6, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      // inline-block + vertical-align : se comporte comme un caractère quand la
      // croix est posée à côté d'un texte (ex. « Effacer ✕ »).
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <path d="M2 2 L12 12 M12 2 L2 12" />
    </svg>
  )
}
