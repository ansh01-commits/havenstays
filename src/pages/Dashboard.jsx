import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateReceipt } from '../lib/generateReceipt'
import { mergeRoomsWithCatalog } from '../lib/roomCatalog'
import AlertsPanel from '../components/AlertsPanel'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

// ── status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  available:      { label: 'Available',      dot: 'bg-emerald-400',  badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',  border: 'border-ink-700 hover:border-emerald-500/40 cursor-pointer' },
  occupied:       { label: 'Occupied',       dot: 'bg-rose-400',     badge: 'bg-rose-500/15 text-rose-400 border-rose-500/25',           border: 'border-ink-700' },
  checkout_today: { label: 'Checkout Today', dot: 'bg-amber-400',    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25',        border: 'border-amber-500/20' },
  cleaning:       { label: 'Cleaning',       dot: 'bg-orange-400',   badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25',     border: 'border-orange-500/20' },
  out_of_service: { label: 'Out of Service', dot: 'bg-gray-500',     badge: 'bg-gray-500/15 text-gray-400 border-gray-500/25',          border: 'border-gray-600/40' },
}

const FLOOR_LABELS = {
  0: 'Ground Floor',
  1: 'First Floor',
  2: 'Second Floor',
  3: 'Top Floor',
}

function getFloorLabel(floor) {
  return FLOOR_LABELS[floor] || `Floor ${floor}`
}

// ── room status action menu ───────────────────────────────────────────────────
function StatusMenu({ roomId, currentStatus, onStatusChange, onClose }) {
  const options = [
    { status: 'available',    icon: '✓', label: 'Mark Available' },
    { status: 'cleaning',     icon: '🧹', label: 'Mark Cleaning' },
    { status: 'out_of_service', icon: '⛔', label: 'Out of Service' },
  ].filter(o => o.status !== currentStatus)

  return (
    <div className="absolute top-full right-0 mt-1.5 z-20 bg-ink-900 border border-ink-600
                    rounded-xl shadow-xl shadow-black/40 overflow-hidden min-w-[160px]"
         onClick={e => e.stopPropagation()}>
      {options.map(({ status, icon, label }) => (
        <button
          key={status}
          onClick={() => { onStatusChange(roomId, status); onClose() }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-gray-300
                     hover:bg-ink-800 hover:text-white transition-colors text-left"
        >
          <span>{icon}</span>
          <span>{label}</span>
        </button>
      ))}
      <div className="border-t border-ink-700" />
      <button
        onClick={onClose}
        className="w-full px-3.5 py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors text-left"
      >
        Cancel
      </button>
    </div>
  )
}

// ── room card ─────────────────────────────────────────────────────────────────
function RoomCard({ room, booking, onCheckout, onStatusChange }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  // Fixed Issue #3: Clean Outside click tracking using DOM Refs
  useEffect(() => {
    if (!menuOpen) return
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [menuOpen])

  let effectiveStatus = room.status
  if (booking) {
    effectiveStatus = booking.checkout_date === today ? 'checkout_today' : 'occupied'
  }

  const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.available
  const isClickable = effectiveStatus === 'available'

  return (
    <div
      id={`room-${room.room_no}`}
      className={`relative bg-ink-900 border rounded-xl p-4 flex flex-col gap-3
                  transition-all duration-200 ${cfg.border}`}
      onClick={() => isClickable && navigate(`/checkin/${room.id}`)}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-mono">Room</p>
          <p className="text-2xl font-semibold text-white font-mono">{room.room_no}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${cfg.badge}`}>
            {cfg.label}
          </span>
          {!booking && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-1"
                title="Change room status"
              >
                ⋯
              </button>
              {menuOpen && (
                <StatusMenu
                  roomId={room.id}
                  currentStatus={effectiveStatus}
                  onStatusChange={onStatusChange}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 capitalize">{room.type} · {getFloorLabel(room.floor)}</p>

      {booking && (
        <div className="border-t border-ink-700 pt-3 space-y-1.5">
          <p className="text-sm font-medium text-white truncate">{booking.guest_name}</p>
          <p className="text-xs text-gray-400 font-mono">{booking.mobile}</p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{format(new Date(booking.checkin_date), 'dd MMM')} → {format(new Date(booking.checkout_date), 'dd MMM')}</span>
            <span className="font-mono">₹{booking.tariff}/day</span>
          </div>

          {booking.balance > 0 ? (
            <div className="flex items-center justify-between bg-rose-500/10 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-rose-400">Balance due</span>
              <span className="text-xs font-mono font-semibold text-rose-400">₹{booking.balance}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-emerald-500/10 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-emerald-400">Fully paid</span>
              <span className="text-xs font-mono font-semibold text-emerald-400">₹{booking.total_amount}</span>
            </div>
          )}

          <div className="flex gap-2 mt-1">
            <button
              onClick={e => { e.stopPropagation(); onCheckout(booking) }}
              className="flex-1 text-xs py-1.5 rounded-lg border border-amber-500/30
                         text-amber-400 hover:bg-amber-500/10 transition-all duration-150"
            >
              Check Out
            </button>
            <button
              onClick={e => { e.stopPropagation(); generateReceipt(booking) }}
              className="text-xs px-3 py-1.5 rounded-lg border border-ink-600
                         text-gray-400 hover:text-white hover:border-ink-500
                         transition-all duration-150"
              title="Print receipt"
            >
              🖨
            </button>
          </div>
        </div>
      )}

      {effectiveStatus === 'cleaning' && (
        <div className="border-t border-ink-700 pt-3">
          <p className="text-xs text-orange-400/70">Awaiting housekeeping</p>
          <button
            onClick={e => { e.stopPropagation(); onStatusChange(room.id, 'available') }}
            className="w-full mt-2 text-xs py-1.5 rounded-lg border border-emerald-500/30
                       text-emerald-400 hover:bg-emerald-500/10 transition-all duration-150"
          >
            ✓ Mark Clean & Ready
          </button>
        </div>
      )}

      {effectiveStatus === 'out_of_service' && (
        <div className="border-t border-ink-700 pt-3">
          <p className="text-xs text-gray-600">Blocked — not available</p>
          <button
            onClick={e => { e.stopPropagation(); onStatusChange(room.id, 'available') }}
            className="w-full mt-2 text-xs py-1.5 rounded-lg border border-gray-600
                       text-gray-400 hover:bg-gray-500/10 transition-all duration-150"
          >
            Restore to Available
          </button>
        </div>
      )}

      {effectiveStatus === 'available' && (
        <div className="border-t border-ink-700 pt-3">
          <p className="text-xs text-gray-600">Base tariff: ₹{room.base_tariff}/day</p>
          <p className="text-xs text-emerald-500 mt-1">← Click to check in</p>
        </div>
      )}
    </div>
  )
}

// ── legend ────────────────────────────────────────────────────────────────────
function StatusLegend() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className="text-xs text-gray-500">{cfg.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [rooms, setRooms] = useState([])
  const [occupiedMap, setOccupiedMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    occupied: 0, available: 0, cleaning: 0,
    outOfService: 0, checkoutToday: 0, balanceDue: 0,
  })

  // Calculations extracted to separate utility function to optimize real-time usage
  const calculateStats = (roomList, currentBookingsMap) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const bookingList = Object.values(currentBookingsMap)
    
    let occupied = 0, available = 0, cleaning = 0, outOfService = 0
    roomList.forEach(r => {
      let st = r.status
      if (currentBookingsMap[r.room_no]) st = 'occupied'
      if (st === 'occupied') occupied++
      else if (st === 'available') available++
      else if (st === 'cleaning') cleaning++
      else if (st === 'out_of_service') outOfService++
    })

    setStats({
      occupied, available, cleaning, outOfService,
      checkoutToday: bookingList.filter(b => b.checkout_date === today).length,
      balanceDue:    bookingList.filter(b => b.balance > 0).length,
    })
  }

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .order('room_no')

    let roomsToUse = mergeRoomsWithCatalog(roomData || [])

    const { data: bookingData, error: bookingError } = await supabase
      .from('occupied_rooms')
      .select('*')

    if (bookingError) { 
      toast.error('Failed to load bookings')
      setLoading(false)
      return 
    }

    const map = {}
    bookingData.forEach(b => { map[b.room_no] = b })

    setRooms(roomsToUse)
    setOccupiedMap(map)
    calculateStats(roomsToUse, map)
    setLoading(false)
  }

  // Fixed Issue #1: Integrated Real-Time Subscription Channels
  useEffect(() => {
    fetchData()

    const roomSubscription = supabase
      .channel('pms-realtime-dashboard')
      .on('postgres_changes', { event: '*', scheme: 'public', table: 'rooms' }, () => {
        fetchData(true) // Silent reload on changes
      })
      .on('postgres_changes', { event: '*', scheme: 'public', table: 'bookings' }, () => {
        fetchData(true) 
      })
      .subscribe()

    return () => {
      supabase.removeChannel(roomSubscription)
    }
  }, [])

  const handleCheckout = async (booking) => {
    const confirm = window.confirm(
      `Check out ${booking.guest_name} from Room ${booking.room_no}?\n` +
      (booking.balance > 0 ? `⚠️ Balance due: ₹${booking.balance}` : '✓ Fully paid')
    )
    if (!confirm) return

    // Fixed Issue #2: Optimistic UI state update before mutation request completes
    setRooms(prev => prev.map(r => r.room_no === booking.room_no ? { ...r, status: 'cleaning' } : r))

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'checked_out' })
      .eq('id', booking.booking_id)

    if (error) { 
      toast.error('Checkout failed')
      fetchData(true) // Revert on failure
      return 
    }

    toast.success(`${booking.guest_name} checked out · Room ${booking.room_no} queued for cleaning`)
  }

  const handleStatusChange = async (roomId, newStatus) => {
    // Fixed Issue #2: Update room element state optimally
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: newStatus } : r))

    const { error } = await supabase
      .from('rooms')
      .update({ status: newStatus })
      .eq('id', roomId)

    if (error) { 
      toast.error('Failed to update room status')
      fetchData(true) // Reset cleanly if update fails
      return 
    }

    const labels = {
      available:      'Room marked available ✓',
      cleaning:       'Room marked for cleaning',
      out_of_service: 'Room set out of service',
    }
    toast.success(labels[newStatus] || 'Status updated')
  }

  const scrollToRoom = (roomNo) => {
    const el = document.getElementById(`room-${roomNo}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const floors = [0, 1, 2, 3]

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
      Loading rooms...
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Room Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: 'Occupied',       value: stats.occupied,      color: 'text-rose-400' },
          { label: 'Available',      value: stats.available,     color: 'text-emerald-400' },
          { label: 'Cleaning',       value: stats.cleaning,      color: 'text-orange-400' },
          { label: 'Out of Service', value: stats.outOfService,  color: 'text-gray-400' },
          { label: 'Checkout Today', value: stats.checkoutToday, color: 'text-amber-400' },
          { label: 'Balance Due',    value: stats.balanceDue,    color: 'text-rose-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-ink-900 border border-ink-700 rounded-xl px-4 py-3">
            <p className={`text-2xl font-semibold font-mono ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {Object.keys(occupiedMap).length > 0 && (
        <AlertsPanel
          bookings={Object.values(occupiedMap)}
          onScrollToRoom={scrollToRoom}
        />
      )}

      <StatusLegend />

      {floors.map(floor => (
        <div key={floor}>
          <p className="text-xs font-mono text-gray-500 tracking-widest uppercase mb-3">
            {getFloorLabel(floor)}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {rooms
              .filter(r => r.floor === floor)
              .map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  booking={occupiedMap[room.room_no] || null}
                  onCheckout={handleCheckout}
                  onStatusChange={handleStatusChange}
                />
              ))
            }
          </div>
        </div>
      ))}
    </div>
  )
}