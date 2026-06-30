import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export default function GuestSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [guestStats, setGuestStats] = useState({})

  // Fixed Issue #1 & #2: Single Optimized Search pipeline with server-side computations
  useEffect(() => {
    const searchGuests = async () => {
      const trimmed = query.trim()
      if (!trimmed) {
        setResults([])
        setSearched(false)
        return
      }

      setLoading(true)
      
      // Pull guests matching query parameters
      const { data: guests, error: guestError } = await supabase
        .from('guests')
        .select('*')
        .or(`name.ilike.%${trimmed}%,mobile.ilike.%${trimmed}%`)
        .limit(8)

      if (guestError || !guests || guests.length === 0) {
        setResults([])
        setSearched(true)
        setLoading(false)
        return
      }

      const ids = guests.map((g) => g.id)

      // Fetch aggregated metric items in a single grouped call instead of parsing raw objects on frontend
      const { data: bookingStats, error: statsError } = await supabase
        .from('bookings')
        .select('guest_id, total_amount, balance')
        .in('guest_id', ids)

      const statsMap = {}
      guests.forEach(g => {
        statsMap[g.id] = { stays: 0, spend: 0, balance: 0 }
      })

      if (!statsError && bookingStats) {
        bookingStats.forEach(b => {
          if (statsMap[b.guest_id]) {
            statsMap[b.guest_id].stays += 1
            statsMap[b.guest_id].spend += (b.total_amount || 0)
            statsMap[b.guest_id].balance += (b.balance || 0)
          }
        })
      }

      setGuestStats(statsMap)
      setResults(guests)
      setSearched(true)
      setLoading(false)
    }

    const timeout = window.setTimeout(searchGuests, 250)
    return () => window.clearTimeout(timeout)
  }, [query])

  const handleSelectGuest = async (guest) => {
    setSelected(guest)

    const { data, error } = await supabase
      .from('bookings')
      .select(`*, rooms(room_no, floor, type)`)
      .eq('guest_id', guest.id)
      .order('checkin_date', { ascending: false })

    if (!error) setBookings(data || [])
  }

  // Unified property calculation variables
  const totalSpend = useMemo(() => bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0), [bookings])
  const selectedStats = useMemo(() => guestStats[selected?.id] || null, [guestStats, selected])

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Guest Search</h1>
        <p className="text-sm text-gray-500 mt-0.5">Search by name or mobile number</p>
      </div>

      {/* Search bar */}
      <form onSubmit={(e) => { e.preventDefault(); setSearched(true) }} className="flex gap-3 mb-6">
        <input
          className="input-base flex-1"
          placeholder="Name or mobile number..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" disabled={loading} className="btn-primary px-6">
          {loading ? '...' : 'Search'}
        </button>
      </form>

      {/* Results */}
      {searched && results.length === 0 && !loading && (
        <p className="text-sm text-gray-500 text-center py-8">No guests found for "{query}"</p>
      )}

      {results.length > 0 && !selected && (
        <div className="space-y-2">
          {results.map(guest => {
            const stats = guestStats[guest.id] || { stays: 0, spend: 0, balance: 0 }
            return (
              <button
                key={guest.id}
                onClick={() => handleSelectGuest(guest)}
                className="w-full bg-ink-900 border border-ink-700 hover:border-amber-500/40
                           rounded-xl px-4 py-3 flex items-center justify-between
                           transition-all duration-150 group"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors">
                    {guest.name}
                  </p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{guest.mobile}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-amber-400">{stats.stays} stay{stats.stays === 1 ? '' : 's'}</p>
                  <p className="text-xs text-emerald-400">₹{stats.spend.toLocaleString()}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="space-y-4">
          <button
            onClick={() => { setSelected(null); setBookings([]) }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back to results
          </button>

          {/* Guest card */}
          <div className="bg-ink-900 border border-ink-700 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-white">{selected.name}</p>
                <p className="text-sm font-mono text-gray-400 mt-0.5">{selected.mobile}</p>
                {selected.created_at && (
                  <p className="text-xs text-gray-600 mt-1">
                    First seen: {format(new Date(selected.created_at), 'dd MMM yyyy')}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total stays</p>
                <p className="text-2xl font-semibold font-mono text-amber-400">{bookings.length}</p>
                <p className="text-xs text-gray-500 mt-1">Lifetime spend</p>
                <p className="text-sm font-mono text-emerald-400">₹{totalSpend.toLocaleString()}</p>
                {selectedStats && selectedStats.balance > 0 && (
                  <p className="text-xs text-rose-400 font-semibold mt-1">Outstanding: ₹{selectedStats.balance.toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>

          {/* Booking history */}
          <div>
            <p className="text-xs font-mono text-gray-500 tracking-widest uppercase mb-3">Stay History</p>
            <div className="space-y-2">
              {bookings.map(b => (
                <div key={b.id} className="bg-ink-900 border border-ink-700 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-semibold text-white">
                        Room {b.rooms?.room_no}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        b.status === 'active' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-ink-700 text-gray-400 border border-ink-600'
                      }`}>
                        {b.status === 'active' ? 'Active' : 'Checked out'}
                      </span>
                    </div>
                    <span className={`text-sm font-mono font-semibold ${
                      b.balance > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      ₹{b.total_amount?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                    <span>{format(new Date(b.checkin_date), 'dd MMM yyyy')} → {format(new Date(b.checkout_date), 'dd MMM yyyy')}</span>
                    <span>{b.no_days || b.hourly_duration || 0} {b.rental_type === 'hourly' ? 'hours' : 'days'}</span>
                    <span>₹{b.tariff}/{b.rental_type === 'hourly' ? 'hr' : 'day'}</span>
                  </div>
                  {b.balance > 0 && (
                    <p className="text-xs text-rose-400 mt-1">Balance due: ₹{b.balance}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}