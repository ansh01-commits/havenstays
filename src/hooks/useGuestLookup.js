// src/hooks/useGuestLookup.js
// Drop into hooks/ folder. Used by CheckIn.jsx for autofill on mobile blur.

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Returns:
 *   lookupGuest(mobile)  — call on mobile field blur
 *   guestHint            — { name, mobile, lastRoom, lastTariff } | null
 *   clearHint()          — call when user manually edits name
 *   lookupLoading        — boolean
 */
export function useGuestLookup() {
  const [guestHint, setGuestHint] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  const lookupGuest = useCallback(async (mobile) => {
    if (!mobile || mobile.trim().length < 7) return
    setLookupLoading(true)
    setGuestHint(null)

    try {
      // 1. Find guest by mobile
      const { data: guest, error: guestErr } = await supabase
        .from('guests')
        .select('id, name, mobile')
        .eq('mobile', mobile.trim())
        .maybeSingle()

      if (guestErr || !guest) return

      // 2. Get their most recent booking for room/tariff hint
      const { data: lastBooking } = await supabase
        .from('bookings')
        .select('tariff, rooms(room_no)')
        .eq('guest_id', guest.id)
        .order('checkin_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      setGuestHint({
        name: guest.name,
        mobile: guest.mobile,
        lastRoom: lastBooking?.rooms?.room_no || null,
        lastTariff: lastBooking?.tariff || null,
        stayCount: null, // fetched lazily only if needed
      })
    } finally {
      setLookupLoading(false)
    }
  }, [])

  const clearHint = useCallback(() => setGuestHint(null), [])

  return { lookupGuest, guestHint, clearHint, lookupLoading }
}
