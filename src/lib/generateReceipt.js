// src/lib/generateReceipt.js
// Client-side PDF receipt using jsPDF. No backend needed.
// Install: npm install jspdf

import { jsPDF } from 'jspdf'
import { format, differenceInDays } from 'date-fns'

/**
 * generateReceipt(booking)
 *
 * booking shape (from occupied_rooms view or checkout flow):
 *   booking_id, guest_name, mobile, room_no, floor, type,
 *   checkin_date, checkout_date, tariff,
 *   paid_online, paid_cash, paid_agoda,
 *   total_amount, balance, occupancy_type, notes
 *
 * Opens the PDF in a new tab as a data URL (works without a server).
 */
export function generateReceipt(booking) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' })

  const W = 148   // A5 width mm
  const PAD = 14
  const COL2 = W - PAD

  const nights = differenceInDays(
    new Date(booking.checkout_date),
    new Date(booking.checkin_date)
  )
  const paid = (booking.paid_online || 0) + (booking.paid_cash || 0) + (booking.paid_agoda || 0)
  const receiptNo = `RCP-${String(booking.booking_id).padStart(5, '0')}`
  const printedAt = format(new Date(), 'dd MMM yyyy, hh:mm a')

  // ── helpers ────────────────────────────────────────────────────────────────
  const line   = (y) => { doc.setDrawColor(60, 60, 80); doc.line(PAD, y, W - PAD, y) }
  const row    = (label, value, y, labelColor = [150,150,170], valueColor = [230,230,245]) => {
    doc.setFontSize(8.5)
    doc.setTextColor(...labelColor)
    doc.text(label, PAD, y)
    doc.setTextColor(...valueColor)
    doc.text(String(value), COL2, y, { align: 'right' })
  }

  // ── background ─────────────────────────────────────────────────────────────
  doc.setFillColor(10, 10, 20)
  doc.rect(0, 0, W, 210, 'F')

  // ── header band ────────────────────────────────────────────────────────────
  doc.setFillColor(24, 24, 38)
  doc.rect(0, 0, W, 28, 'F')

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(245, 180, 60)        // amber
  doc.text('Haven Stays', PAD, 12)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 140)
  doc.text('Guest Receipt', PAD, 18)
  doc.text(receiptNo, COL2, 12, { align: 'right' })
  doc.text(`Printed: ${printedAt}`, COL2, 18, { align: 'right' })

  // ── guest info ─────────────────────────────────────────────────────────────
  let y = 36
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(230, 230, 245)
  doc.text(booking.guest_name, PAD, y)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 140)
  doc.text(booking.mobile, PAD, y + 5.5)

  // ── stay details ───────────────────────────────────────────────────────────
  y = 52
  line(y); y += 6

  row('Room', `${booking.room_no}  ·  Floor ${booking.floor}  ·  ${booking.type}`, y); y += 6
  row('Occupancy', booking.occupancy_type?.charAt(0).toUpperCase() + booking.occupancy_type?.slice(1), y); y += 6
  row('Check-in', format(new Date(booking.checkin_date), 'dd MMM yyyy'), y); y += 6
  row('Check-out', format(new Date(booking.checkout_date), 'dd MMM yyyy'), y); y += 6
  row('Duration', `${nights} night${nights !== 1 ? 's' : ''}`, y); y += 6
  row('Rate', `₹${Number(booking.tariff).toLocaleString()} / night`, y); y += 7

  // ── payment breakdown ─────────────────────────────────────────────────────
  line(y); y += 6

  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 140)
  doc.text('PAYMENT BREAKDOWN', PAD, y); y += 6

  if (booking.paid_cash > 0)   row('Cash',   `₹${Number(booking.paid_cash).toLocaleString()}`,   y), (y += 6)
  if (booking.paid_online > 0) row('Online', `₹${Number(booking.paid_online).toLocaleString()}`, y), (y += 6)
  if (booking.paid_agoda > 0)  row('Agoda',  `₹${Number(booking.paid_agoda).toLocaleString()}`,  y), (y += 6)

  y += 2
  line(y); y += 7

  // ── totals ─────────────────────────────────────────────────────────────────
  row('Total Amount', `₹${Number(booking.total_amount).toLocaleString()}`, y, [150,150,170], [230,230,245])
  y += 6
  row('Total Paid',   `₹${paid.toLocaleString()}`,                         y, [150,150,170], [52,211,153])  // emerald
  y += 6

  const balanceColor = booking.balance > 0 ? [251, 113, 133] : [52, 211, 153]  // rose / emerald
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...balanceColor)
  doc.text(booking.balance > 0 ? 'Balance Due' : 'Fully Paid', PAD, y)
  doc.text(
    booking.balance > 0 ? `₹${Number(booking.balance).toLocaleString()}` : '✓',
    COL2, y, { align: 'right' }
  )

  // ── notes ─────────────────────────────────────────────────────────────────
  if (booking.notes) {
    y += 10
    line(y); y += 6
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 140)
    doc.text('Notes', PAD, y); y += 5
    doc.setTextColor(180, 180, 200)
    const wrapped = doc.splitTextToSize(booking.notes, W - PAD * 2)
    doc.text(wrapped, PAD, y)
  }

  // ── footer ─────────────────────────────────────────────────────────────────
  doc.setFontSize(7)
  doc.setTextColor(70, 70, 90)
  doc.text('Thank you for staying with Haven Stays.', W / 2, 200, { align: 'center' })

  // ── output ────────────────────────────────────────────────────────────────
  doc.output('dataurlnewwindow')
}
