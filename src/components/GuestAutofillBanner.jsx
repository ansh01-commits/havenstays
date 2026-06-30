// src/components/GuestAutofillBanner.jsx
// Rendered inside CheckIn.jsx below the mobile input when a returning guest is found.

/**
 * Props:
 *   hint        — { name, mobile, lastRoom, lastTariff }
 *   onApply     — fn() — called when manager clicks "Use this guest"
 *   onDismiss   — fn() — called when manager clicks ✕
 *   loading     — boolean — show skeleton while lookup is in flight
 */
export default function GuestAutofillBanner({ hint, onApply, onDismiss, loading }) {
  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-800 border border-ink-700 animate-pulse">
        <div className="w-3 h-3 rounded-full bg-ink-600" />
        <p className="text-xs text-gray-600">Looking up guest...</p>
      </div>
    )
  }

  if (!hint) return null

  return (
    <div className="mt-2 flex items-start justify-between gap-3
                    px-3 py-2.5 rounded-lg
                    bg-amber-500/8 border border-amber-500/25">
      {/* left: info */}
      <div className="flex items-start gap-2">
        <span className="text-sm mt-0.5">↩</span>
        <div>
          <p className="text-xs font-medium text-amber-300">
            Returning guest — <span className="font-semibold">{hint.name}</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {hint.lastRoom ? `Last stayed: Room ${hint.lastRoom}` : 'Previous stay on record'}
            {hint.lastTariff ? ` · ₹${hint.lastTariff}/day` : ''}
          </p>
        </div>
      </div>

      {/* right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onApply}
          className="text-xs px-2.5 py-1 rounded-md
                     bg-amber-500/15 text-amber-400 border border-amber-500/30
                     hover:bg-amber-500/25 transition-all duration-150"
        >
          Autofill
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
