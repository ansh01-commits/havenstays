// src/components/AlertsPanel.jsx
// Drop this into your components/ folder and import in Dashboard.jsx

import { format, differenceInDays } from 'date-fns'

// ─── individual alert row ────────────────────────────────────────────────────

function AlertRow({ icon, label, sub, value, valueClass, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                  hover:bg-ink-800 transition-all duration-150 text-left
                  ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <span className="text-base leading-none">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{label}</p>
        {sub && <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">{sub}</p>}
      </div>
      {value !== undefined && (
        <span className={`text-xs font-mono font-semibold shrink-0 ${valueClass}`}>
          {value}
        </span>
      )}
    </button>
  )
}

// ─── section wrapper ─────────────────────────────────────────────────────────

function AlertSection({ title, color, children, count }) {
  if (count === 0) return null
  return (
    <div>
      <div className="flex items-center justify-between mb-1 px-1">
        <p className={`text-xs font-mono tracking-widest uppercase ${color}`}>{title}</p>
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full bg-ink-800 ${color}`}>
          {count}
        </span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

/**
 * Props:
 *   bookings  — array from occupied_rooms view (all active bookings)
 *   onScrollToRoom — optional fn(room_no) to highlight a card on the grid
 */
export default function AlertsPanel({ bookings = [], onScrollToRoom }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')

  // ── categorise ────────────────────────────────────────────────────────────
  const balanceDue   = bookings.filter(b => b.balance > 0)
  const checkingOut  = bookings.filter(b => b.checkout_date === today)
  const checkingOutTomorrow = bookings.filter(b => b.checkout_date === tomorrow)
  const longStay     = bookings.filter(b => {
    const nights = differenceInDays(new Date(b.checkout_date), new Date(b.checkin_date))
    return nights >= 7
  })

  const totalAlerts = balanceDue.length + checkingOut.length + checkingOutTomorrow.length

  if (totalAlerts === 0 && longStay.length === 0) {
    return (
      <div className="bg-ink-900 border border-ink-700 rounded-xl p-4">
        <p className="text-xs font-mono text-gray-500 tracking-widest uppercase mb-3">Alerts</p>
        <p className="text-xs text-gray-600 text-center py-3">No active alerts — all clear ✓</p>
      </div>
    )
  }

  return (
    <div className="bg-ink-900 border border-ink-700 rounded-xl p-4 space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-gray-500 tracking-widest uppercase">Alerts</p>
        {totalAlerts > 0 && (
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20">
            {totalAlerts} need attention
          </span>
        )}
      </div>

      {/* ── outstanding balances ── */}
      <AlertSection title="Balance Due" color="text-rose-400" count={balanceDue.length}>
        {balanceDue.map(b => (
          <AlertRow
            key={b.booking_id}
            icon="💸"
            label={b.guest_name}
            sub={`Room ${b.room_no} · ${b.mobile}`}
            value={`₹${Number(b.balance).toLocaleString()}`}
            valueClass="text-rose-400"
            onClick={() => onScrollToRoom?.(b.room_no)}
          />
        ))}
      </AlertSection>

      {/* ── checking out today ── */}
      <AlertSection title="Checkout Today" color="text-amber-400" count={checkingOut.length}>
        {checkingOut.map(b => (
          <AlertRow
            key={b.booking_id}
            icon="🔑"
            label={b.guest_name}
            sub={`Room ${b.room_no}`}
            value={b.balance > 0 ? `₹${Number(b.balance).toLocaleString()} due` : 'Paid ✓'}
            valueClass={b.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}
            onClick={() => onScrollToRoom?.(b.room_no)}
          />
        ))}
      </AlertSection>

      {/* ── checking out tomorrow ── */}
      <AlertSection title="Checkout Tomorrow" color="text-amber-400/70" count={checkingOutTomorrow.length}>
        {checkingOutTomorrow.map(b => (
          <AlertRow
            key={b.booking_id}
            icon="📅"
            label={b.guest_name}
            sub={`Room ${b.room_no}`}
            value={b.balance > 0 ? `₹${Number(b.balance).toLocaleString()} due` : undefined}
            valueClass="text-rose-400"
            onClick={() => onScrollToRoom?.(b.room_no)}
          />
        ))}
      </AlertSection>

      {/* ── long stays (info, not urgent) ── */}
      <AlertSection title="Long Stay (7+ nights)" color="text-blue-400" count={longStay.length}>
        {longStay.map(b => {
          const nights = differenceInDays(new Date(b.checkout_date), new Date(b.checkin_date))
          return (
            <AlertRow
              key={b.booking_id}
              icon="🏠"
              label={b.guest_name}
              sub={`Room ${b.room_no} · checking out ${format(new Date(b.checkout_date), 'dd MMM')}`}
              value={`${nights}n`}
              valueClass="text-blue-400"
              onClick={() => onScrollToRoom?.(b.room_no)}
            />
          )
        })}
      </AlertSection>
    </div>
  )
}
