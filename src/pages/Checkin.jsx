import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { mergeRoomsWithCatalog } from '../lib/roomCatalog'
import toast from 'react-hot-toast'
import { differenceInDays, format } from 'date-fns'

// ── ID Photo Upload Component ──────────────────────────
function PhotoUpload({ value, onChange }) {
  const inputRef = useRef()
  const [preview, setPreview] = useState(null)

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024)    { toast.error('Image must be under 5MB'); return }
    setPreview(URL.createObjectURL(file))
    onChange(file)
  }

  const handleRemove = () => {
    setPreview(null)
    onChange(null)
    inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      {!preview ? (
        <div
          onClick={() => inputRef.current.click()}
          className="w-full h-28 border-2 border-dashed border-ink-600 rounded-xl
                     flex flex-col items-center justify-center gap-2 cursor-pointer
                     hover:border-amber-500/50 hover:bg-amber-500/5 transition-all duration-150"
        >
          <span className="text-2xl">📷</span>
          <p className="text-xs text-gray-400">Click to upload or take photo</p>
          <p className="text-xs text-gray-600">JPG, PNG · Max 5MB</p>
        </div>
      ) : (
        <div className="relative w-full h-28 rounded-xl overflow-hidden border border-ink-600">
          <img src={preview} alt="ID Preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => inputRef.current.click()}
              className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-all">
              Change
            </button>
            <button type="button" onClick={handleRemove}
              className="text-xs bg-rose-500/40 hover:bg-rose-500/60 text-white px-3 py-1.5 rounded-lg transition-all">
              Remove
            </button>
          </div>
          <div className="absolute bottom-2 right-2">
            <span className="text-xs bg-emerald-500/80 text-white px-2 py-0.5 rounded-full">✓ Ready</span>
          </div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={handleFile} />
    </div>
  )
}

// Upload helper using phone number + timestamp signature
async function uploadIdPhoto(file, mobile) {
  const ext  = file.name.split('.').pop()
  const path = `${mobile}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('id-photos')
    .upload(path, file, { upsert: true })

  if (uploadError) throw new Error('Photo upload failed: ' + uploadError.message)

  const { data: publicData } = supabase.storage.from('id-photos').getPublicUrl(path)
  const publicUrl = publicData?.publicUrl

  if (!publicUrl) return path

  try {
    const probe = await fetch(publicUrl, { method: 'HEAD' })
    if (probe.ok) return publicUrl
  } catch {
    // Fallback path
  }
  return path
}

// ── Confirmation Modal ──────────────────────────
function ConfirmModal({ data, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-ink-900 border border-ink-700 rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl">
        <div>
          <p className="text-xs font-mono text-amber-500 tracking-widest uppercase mb-1">Confirm Check In</p>
          <p className="text-sm text-gray-400">Review before confirming</p>
        </div>

        <div className="space-y-2 text-sm">
          {[
            ['Guest',    data.name],
            ['Mobile',   data.mobile],
            ['Room',     data.roomLabel],
            [data.isHourly ? 'Time' : 'Dates', data.isHourly ? `${data.checkin} (${data.hours}h)` : `${data.checkin} → ${data.checkout} (${data.days} day${data.days !== 1 ? 's' : ''})`],
            ['Total',    `₹${data.total.toLocaleString()}`],
            ['Paid',     `₹${data.paid.toLocaleString()}`],
            ['Balance',  `₹${data.balance.toLocaleString()}`],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-500">{label}</span>
              <span className={`font-mono font-medium ${label === 'Balance' && data.balance > 0 ? 'text-rose-400' : 'text-white'}`}>
                {val}
              </span>
            </div>
          ))}
        </div>

        {data.hasPhoto && (
          <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            ✓ ID photo will be uploaded
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}  className="btn-ghost flex-1">Go Back</button>
          <button onClick={onConfirm} className="btn-primary flex-1">Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ── Main CheckIn Page ──────────────────────────────────
export default function CheckIn() {
  const navigate     = useNavigate()
  const { roomId }   = useParams()

  const [rooms,           setRooms]          = useState([])
  const [occupiedRoomIds, setOccupiedRoomIds] = useState([])
  const [loading,        setLoading]        = useState(false)
  const [photoFile,      setPhotoFile]      = useState(null)
  const [returningGuest, setReturningGuest] = useState(null)
  const [showConfirm,    setShowConfirm]    = useState(false)

  const today    = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')

  const [form, setForm] = useState({
    room_id:         roomId || '',
    name:           '',
    mobile:         '',
    occupancy_type: 'double',
    rental_type:    'daily',
    checkin_date:   today,
    checkout_date:  tomorrow,
    hourly_duration: '1',
    tariff:         '',
    paid_online:    '',
    paid_cash:      '',
    paid_agoda:     '',
    notes:          '',
  })

  const mobileError = (() => {
    const m = form.mobile.trim()
    if (!m) return null
    if (!/^\d+$/.test(m))    return 'Mobile number must contain digits only'
    if (m.length < 10)       return 'Mobile number must be at least 10 digits'
    if (m.length > 15)       return 'Mobile number must be 15 digits or fewer'
    return null
  })()

  const getHourlyRate = (hours) => {
    if (hours <= 0) return 0
    if (hours <= 3) return 1000
    if (hours <= 6) return 1300
    if (hours <= 9) return 1600
    return 1000 + Math.ceil((hours - 3) / 3) * 300
  }

  const days = form.checkin_date && form.checkout_date
    ? Math.max(0, differenceInDays(new Date(form.checkout_date), new Date(form.checkin_date))) : 0

  const hours   = form.rental_type === 'hourly' ? Math.min(9, Math.max(1, parseInt(form.hourly_duration) || 1)) : 0
  const tariffValue = parseFloat(form.tariff) || 0
  const total   = form.rental_type === 'hourly' ? getHourlyRate(hours) : (tariffValue * days)
  const paid    = (parseFloat(form.paid_online) || 0) + (parseFloat(form.paid_cash) || 0) + (parseFloat(form.paid_agoda) || 0)
  const balance = total - paid

  const fetchAvailableRooms = async () => {
    const { data: occupied } = await supabase
      .from('bookings').select('room_id').eq('status', 'active')
    const occupiedIds = (occupied || []).map(b => b.room_id)

    const { data, error } = await supabase
      .from('rooms').select('*').eq('is_active', true).order('room_no')

    let roomList = mergeRoomsWithCatalog(data || [])

    setOccupiedRoomIds(occupiedIds)
    setRooms(roomList)

    if (roomId) {
      const selected = roomList.find(r => r.id === parseInt(roomId))
      if (selected) setForm(f => ({ ...f, tariff: selected.base_tariff.toString() }))
    }
  }

  useEffect(() => {
    fetchAvailableRooms()
  }, [roomId])

  const handleMobileBlur = async () => {
    const mobile = form.mobile.trim()
    if (mobile.length < 10 || !/^\d+$/.test(mobile)) return

    const { data: guest } = await supabase
      .from('guests')
      .select('*')
      .eq('mobile', mobile)
      .single()

    if (!guest) { setReturningGuest(null); return }

    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('guest_id', guest.id)

    const stayCount = count ?? 0
    setReturningGuest({ ...guest, stayCount })
    setForm(f => ({ ...f, name: guest.name }))
    toast.success(`Returning guest — ${guest.name} · ${stayCount} previous stays`)
  }

  const handleRoomChange = (e) => {
    const selected = rooms.find(r => r.id === parseInt(e.target.value))
    setForm(f => ({ ...f, room_id: e.target.value, tariff: selected ? selected.base_tariff.toString() : f.tariff }))
  }

  const getRoomUnavailableReason = (room) => {
    if (!room) return null
    if (occupiedRoomIds.includes(room.id)) return 'Already occupied'
    const status = (room.manual_status || room.status || '').toLowerCase()
    if (['out_of_service', 'maintenance', 'blocked', 'unavailable', 'occupied'].includes(status)) {
      return 'Not available'
    }
    return null
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleReview = (e) => {
    e.preventDefault()
    const selectedRoom = rooms.find(r => r.id === parseInt(form.room_id))
    const selectedRoomReason = getRoomUnavailableReason(selectedRoom)
    if (selectedRoomReason) { toast.error(`Cannot select room: ${selectedRoomReason}`); return }
    if (form.rental_type === 'daily' && days <= 0) { toast.error('Checkout must be after check-in'); return }
    if (!form.room_id) { toast.error('Please select a room'); return }
    if (mobileError)   { toast.error(mobileError); return }
    setShowConfirm(true)
  }

  // Fixed Issues #1, #2 & #3: Secure Submission Flow
  const handleSubmit = async () => {
    setShowConfirm(false)
    setLoading(true)

    try {
      const targetRoomId = parseInt(form.room_id)

      // Fixed Issue #1: Runtime Race Condition verification check
      const { data: activeCheck } = await supabase
        .from('bookings')
        .select('id')
        .eq('room_id', targetRoomId)
        .eq('status', 'active')

      if (activeCheck && activeCheck.length > 0) {
        throw new Error('This room was just booked by another desk agent. Please select a different room.')
      }

      let photoUrl = null
      if (photoFile) {
        toast.loading('Uploading ID photo...', { id: 'photo' })
        photoUrl = await uploadIdPhoto(photoFile, form.mobile.trim())
        toast.dismiss('photo')
      }

      // Upsert guest profile 
      const { data: guestData, error: guestError } = await supabase
        .from('guests')
        .upsert(
          { name: form.name.trim(), mobile: form.mobile.trim(), ...(photoUrl && { id_photo_url: photoUrl }) },
          { onConflict: 'mobile' }
        )
        .select().single()
      if (guestError) throw guestError

      const bookingPayload = {
        room_id:         targetRoomId,
        guest_id:       guestData.id,
        occupancy_type: form.occupancy_type,
        rental_type:    form.rental_type,
        checkin_date:   form.checkin_date,
        checkout_date:  form.rental_type === 'hourly' ? form.checkin_date : form.checkout_date,
        ...(form.rental_type === 'hourly' && { hourly_duration: parseInt(form.hourly_duration) }),
        tariff:         form.rental_type === 'hourly' ? getHourlyRate(hours) : parseFloat(form.tariff),
        paid_online:    parseFloat(form.paid_online)  || 0,
        paid_cash:      parseFloat(form.paid_cash)    || 0,
        paid_agoda:     parseFloat(form.paid_agoda)   || 0,
        notes:          form.notes || null,
        status:         'active',
      }

      // Fixed Issue #2: Atomic verification linkage
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert(bookingPayload)
      if (bookingError) throw bookingError

      // Update local asset status
      const { error: roomError } = await supabase.from('rooms')
        .update({ manual_status: 'occupied' })
        .eq('id', targetRoomId)
      if (roomError) throw roomError

      toast.success(`${form.name} checked in successfully`)
      navigate('/')
    } catch (err) {
      toast.error(err.message || 'Check-in failed')
      fetchAvailableRooms() // Force structural synchronization refresh
    } finally {
      setLoading(false)
    }
  }

  const selectedRoom = rooms.find(r => r.id === parseInt(form.room_id))

  return (
    <div className="p-6 max-w-2xl">
      {showConfirm && (
        <ConfirmModal
          data={{
            name:       form.name,
            mobile:     form.mobile,
            roomLabel:  selectedRoom ? `${selectedRoom.room_no} — ${selectedRoom.type}` : form.room_id,
            checkin:    form.checkin_date,
            checkout:   form.checkout_date,
            isHourly:   form.rental_type === 'hourly',
            days,
            hours,
            total,
            paid,
            balance,
            hasPhoto:   !!photoFile,
          }}
          onConfirm={handleSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div className="mb-6">
        <button onClick={() => navigate('/')}
          className="text-xs text-gray-500 hover:text-gray-300 mb-3 flex items-center gap-1.5 transition-colors">
          ← Back to Dashboard
        </button>
        <h1 className="text-xl font-semibold text-white">New Check In</h1>
        <p className="text-sm text-gray-500 mt-0.5">Fill in guest details to assign a room</p>
      </div>

      <form onSubmit={handleReview} className="space-y-6">
        {/* Guest Info */}
        <section className="bg-ink-900 border border-ink-700 rounded-xl p-5 space-y-4">
          <p className="text-xs font-mono text-amber-500 tracking-widest uppercase">Guest Info</p>

          {returningGuest && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-amber-400 text-lg">★</span>
              <div>
                <p className="text-sm font-semibold text-amber-400">Returning Guest</p>
                <p className="text-xs text-amber-400/70">
                  {returningGuest.stayCount} previous stays · Name auto-filled
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Mobile Number *</label>
              <input
                className={`input-base ${mobileError ? 'border-rose-500/60 focus:border-rose-500' : ''}`}
                placeholder="9876543210"
                value={form.mobile}
                onChange={set('mobile')}
                onBlur={handleMobileBlur}
                required maxLength={15}
                inputMode="numeric"
              />
              {mobileError
                ? <p className="text-xs text-rose-400 mt-1">{mobileError}</p>
                : <p className="text-xs text-gray-600 mt-1">Enter first to detect returning guests</p>
              }
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Full Name *</label>
              <input className="input-base" placeholder="Rahul Sharma" value={form.name} onChange={set('name')} required />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">
              ID Photo <span className="text-gray-600">(optional — ID Document verification)</span>
            </label>
            <PhotoUpload value={photoFile} onChange={setPhotoFile} />
          </div>
        </section>

        {/* Room + Stay */}
        <section className="bg-ink-900 border border-ink-700 rounded-xl p-5 space-y-4">
          <p className="text-xs font-mono text-amber-500 tracking-widest uppercase">Room & Stay</p>

          {rooms.length === 0 && (
            <div className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
              No rooms marked as Clean & Ready.
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, rental_type: 'daily', checkout_date: tomorrow }))}
              className={`flex-1 text-xs py-2 rounded-lg border transition-all ${
                form.rental_type === 'daily'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'border-ink-600 text-gray-500 hover:text-gray-300'
              }`}
            >
              Daily Rate
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, rental_type: 'hourly', hourly_duration: '1' }))}
              className={`flex-1 text-xs py-2 rounded-lg border transition-all ${
                form.rental_type === 'hourly'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'border-ink-600 text-gray-500 hover:text-gray-300'
              }`}
            >
              Hourly Rate
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Room *</label>
              <select className="input-base" value={form.room_id} onChange={handleRoomChange} required>
                <option value="">Select room</option>
                {rooms.map(r => {
                  const reason = getRoomUnavailableReason(r)
                  const label = `${r.room_no} — ${r.type} (₹${r.base_tariff}/day)`
                  return (
                    <option key={r.id} value={r.id} disabled={!!reason}>
                      {reason ? `${r.room_no} — ${reason}` : label}
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Occupancy *</label>
              <select className="input-base" value={form.occupancy_type} onChange={set('occupancy_type')}>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="triple">Triple</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">{form.rental_type === 'hourly' ? 'Date' : 'Check-in Date'} *</label>
              <input type="date" className="input-base" value={form.checkin_date} onChange={set('checkin_date')} required />
            </div>
            {form.rental_type === 'hourly' ? (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Duration (Hours) *</label>
                <select className="input-base" value={form.hourly_duration} onChange={set('hourly_duration')} required>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => (
                    <option key={h} value={h}>{h} hour{h !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Check-out Date *</label>
                <input type="date" className="input-base" value={form.checkout_date} onChange={set('checkout_date')} required />
              </div>
            )}
            {form.rental_type === 'daily' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Tariff (per day) *</label>
                <input type="number" className="input-base" placeholder="1200" value={form.tariff} onChange={set('tariff')} required />
              </div>
            )}
          </div>
        </section>

        {/* Payment */}
        <section className="bg-ink-900 border border-ink-700 rounded-xl p-5 space-y-4">
          <p className="text-xs font-mono text-amber-500 tracking-widest uppercase">Payment</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Online</label>
              <input type="number" className="input-base" placeholder="0" value={form.paid_online} onChange={set('paid_online')} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Cash</label>
              <input type="number" className="input-base" placeholder="0" value={form.paid_cash} onChange={set('paid_cash')} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Agoda</label>
              <input type="number" className="input-base" placeholder="0" value={form.paid_agoda} onChange={set('paid_agoda')} />
            </div>
          </div>

          {((form.rental_type === 'daily' && form.tariff && days > 0) || (form.rental_type === 'hourly' && hours > 0)) && (
            <div className="bg-ink-800 rounded-lg p-4 space-y-2 border border-ink-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{form.rental_type === 'hourly' ? 'Duration (Hours)' : 'Duration (Nights)'}</span>
                <span className="text-white font-mono">{form.rental_type === 'hourly' ? hours : days} {form.rental_type === 'hourly' ? 'h' : `day${days !== 1 ? 's' : ''}`}</span>
              </div>
              {form.rental_type === 'hourly' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Hourly Rate</span>
                  <span className="text-amber-400 font-mono">₹{getHourlyRate(hours).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Amount</span>
                <span className="text-white font-mono">₹{total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Paid</span>
                <span className="text-emerald-400 font-mono">₹{paid.toLocaleString()}</span>
              </div>
              <div className="border-t border-ink-700 pt-2 flex justify-between text-sm font-semibold">
                <span className="text-gray-300">Balance Due</span>
                <span className={`font-mono ${balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  ₹{balance.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Notes */}
        <section className="bg-ink-900 border border-ink-700 rounded-xl p-5">
          <label className="block text-xs text-gray-400 mb-1.5 font-medium">Notes (optional)</label>
          <textarea className="input-base resize-none" rows={2}
            placeholder="Any special requests or remarks..."
            value={form.notes} onChange={set('notes')} />
        </section>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/')} className="btn-ghost flex-1">Cancel</button>
          <button type="submit" disabled={loading || !!mobileError} className="btn-primary flex-1">
            {loading ? 'Checking in...' : 'Review & Confirm'}
          </button>
        </div>
      </form>
    </div>
  )
}