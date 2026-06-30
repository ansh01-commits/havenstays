import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  format, parseISO, differenceInDays,
  startOfMonth, endOfMonth, eachMonthOfInterval,
} from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line,
} from 'recharts'
import toast from 'react-hot-toast'

// ── colour tokens ─────────────────────────────────────────────────────────────
const C = {
  cash:    '#34D399',
  online:  '#60A5FA',
  agoda:   '#F59E0B',
  bar:     '#A78BFA',
  line:    '#F472B6',
}

const toNum = (val) => {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

const computeOutstanding = (b) => {
  const billed  = toNum(b.total_amount)
  const paid    = toNum(b.paid_cash) + toNum(b.paid_online) + toNum(b.paid_agoda)
  return Math.max(0, billed - paid)
}

const getNights = (b) => {
  if (b.no_days && toNum(b.no_days) > 0) return toNum(b.no_days)
  if (b.checkin_date && b.checkout_date) {
    const d = differenceInDays(parseISO(b.checkout_date), parseISO(b.checkin_date))
    return d > 0 ? d : 1
  }
  return 1
}

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-ink-900 border border-ink-700 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload, label, prefix = '₹' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      {label && <p className="text-gray-400 mb-1 font-mono">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-mono">
          {p.name}: {prefix}{Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-ink-900 border border-ink-700 rounded-xl p-5">
      <p className="text-xs font-mono text-gray-500 tracking-widest uppercase mb-4">{title}</p>
      {children}
    </div>
  )
}

const TOTAL_ROOMS = 21

export default function Reports() {
  const [from, setFormFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to,   setFormTo]   = useState(format(endOfMonth(new Date()),   'yyyy-MM-dd'))
  
  // Real active window controls
  const [activeRange, setActiveRange] = useState({ from, to })
  const [bookings, setBookings] = useState([])
  const [loading,  setLoading]  = useState(false)

  const fetchBookings = useCallback(async (fromDate = from, toDate = to) => {
    setLoading(true)
    setActiveRange({ from: fromDate, to: toDate })
    
    const { data, error } = await supabase
      .from('bookings')
      .select(`*, rooms(room_no, floor, type), guests(name, mobile)`)
      .gte('checkin_date', fromDate)
      .lte('checkin_date', toDate)
      .order('checkin_date', { ascending: true })

    if (error) {
      toast.error('Failed to load report data')
      setLoading(false)
      return
    }
    setBookings(data || [])
    setLoading(false)
  }, [from, to])

  useEffect(() => { 
    fetchBookings(activeRange.from, activeRange.to) 
  }, [])

  const applyPreset = (newFrom, newTo) => {
    setFormFrom(newFrom)
    setFormTo(newTo)
    fetchBookings(newFrom, newTo)
  }

  // Derived Summary Metric Blocks
  const stats = useMemo(() => {
    if (!bookings.length) return null

    const aggregated = bookings.reduce((acc, b) => {
      const billed = toNum(b.total_amount)
      const cash = toNum(b.paid_cash)
      const online = toNum(b.paid_online)
      const agoda = toNum(b.paid_agoda)
      
      acc.totalBilled += billed
      acc.totalCash += cash
      acc.totalOnline += online
      acc.totalAgoda += agoda
      acc.totalOutstanding += computeOutstanding(b)
      acc.totalNights += getNights(b)
      
      return acc
    }, { totalBilled: 0, totalCash: 0, totalOnline: 0, totalAgoda: 0, totalOutstanding: 0, totalNights: 0 })

    return {
      ...aggregated,
      totalCollected: aggregated.totalCash + aggregated.totalOnline + aggregated.totalAgoda,
      avgStay: aggregated.totalNights / bookings.length,
      count: bookings.length,
    }
  }, [bookings])

  const channelData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'Cash',   value: stats.totalCash,   fill: C.cash   },
      { name: 'Online', value: stats.totalOnline, fill: C.online },
      { name: 'Agoda',  value: stats.totalAgoda,  fill: C.agoda  },
    ].filter(d => d.value > 0)
  }, [stats])

  // Fixed Issue #1: Linear Linear Map Hashing ($O(N)$) for chronometric scaling 
  const monthlyDataCollection = useMemo(() => {
    if (!bookings.length) return { monthlyRevenue: [], occupancyData: [], avgStayData: [] }
    
    const months = eachMonthOfInterval({ 
      start: parseISO(activeRange.from), 
      end: parseISO(activeRange.to) 
    })
    
    // Set map groups up front
    const dataMap = {}
    months.forEach(m => {
      const key = format(m, 'yyyy-MM')
      dataMap[key] = { revenue: 0, collected: 0, bookingsCount: 0, roomNights: 0 }
    })

    // Compute logs in a single operational step
    bookings.forEach(b => {
      if (!b.checkin_date) return
      const key = b.checkin_date.substring(0, 7) // Extract 'yyyy-MM'
      if (dataMap[key]) {
        const cash = toNum(b.paid_cash)
        const online = toNum(b.paid_online)
        const agoda = toNum(b.paid_agoda)
        const nights = getNights(b)

        dataMap[key].revenue += toNum(b.total_amount)
        dataMap[key].collected += (cash + online + agoda)
        dataMap[key].bookingsCount += 1
        dataMap[key].roomNights += nights
      }
    })

    // Transform computed hashes back to coordinate layouts
    const monthlyRevenue = []
    const occupancyData = []
    const avgStayData = []

    months.forEach(m => {
      const key = format(m, 'yyyy-MM')
      const label = format(m, 'MMM yy')
      const metrics = dataMap[key] || { revenue: 0, collected: 0, bookingsCount: 0, roomNights: 0 }
      
      const daysInMonth = differenceInDays(endOfMonth(m), startOfMonth(m)) + 1
      const rate = Math.min(100, Math.round((metrics.roomNights / (TOTAL_ROOMS * daysInMonth)) * 100))
      const avgDuration = metrics.bookingsCount ? metrics.roomNights / metrics.bookingsCount : 0

      monthlyRevenue.push({
        month: label,
        revenue: metrics.revenue,
        collected: metrics.collected,
        bookings: metrics.bookingsCount
      })
      
      occupancyData.push({ month: label, occupancy: rate })
      avgStayData.push({ month: label, avg: parseFloat(avgDuration.toFixed(1)) })
    })

    return { monthlyRevenue, occupancyData, avgStayData }
  }, [bookings, activeRange])

  const empty = !loading && bookings.length === 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Revenue Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Analyse bookings, revenue, and occupancy</p>
      </div>

      {/* Date controls input triggers */}
      <div className="bg-ink-900 border border-ink-700 rounded-xl px-5 py-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 font-medium">From</label>
          <input
            type="date"
            className="input-base"
            value={from}
            onChange={e => setFormFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 font-medium">To</label>
          <input
            type="date"
            className="input-base"
            value={to}
            onChange={e => setFormTo(e.target.value)}
          />
        </div>
        <button
          onClick={() => fetchBookings(from, to)}
          disabled={loading}
          className="btn-primary px-6"
        >
          {loading ? 'Loading...' : 'Generate Report'}
        </button>

        <div className="flex gap-2 ml-auto">
          {[
            {
              label: 'This month',
              fn: () => applyPreset(
                format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                format(endOfMonth(new Date()),   'yyyy-MM-dd'),
              ),
            },
            {
              label: 'Last 3 months',
              fn: () => {
                const d = new Date(); d.setMonth(d.getMonth() - 2)
                applyPreset(
                  format(startOfMonth(d),        'yyyy-MM-dd'),
                  format(endOfMonth(new Date()), 'yyyy-MM-dd'),
                )
              },
            },
            {
              label: 'This year',
              fn: () => {
                const y = new Date().getFullYear()
                applyPreset(`${y}-01-01`, `${y}-12-31`)
              },
            },
          ].map(({ label, fn }) => (
            <button
              key={label}
              onClick={fn}
              className="text-xs px-3 py-1.5 rounded-lg border border-ink-600
                         text-gray-400 hover:text-white hover:border-ink-500 transition-all"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {empty && (
        <div className="bg-ink-900 border border-ink-700 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-sm">No bookings found for this date range.</p>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Billed" value={`₹${stats.totalBilled.toLocaleString()}`} sub="Expected revenue" />
          <StatCard label="Bookings" value={stats.count} sub={`Avg ${stats.avgStay.toFixed(1)} nights`} color="text-amber-400" />
          <StatCard label="Cash Collected" value={`₹${stats.totalCash.toLocaleString()}`} color="text-emerald-400" />
          <StatCard label="Online (UPI)" value={`₹${stats.totalOnline.toLocaleString()}`} color="text-blue-400" />
          <StatCard label="Agoda" value={`₹${stats.totalAgoda.toLocaleString()}`} color="text-amber-400" />
          <StatCard
            label="Outstanding"
            value={`₹${stats.totalOutstanding.toLocaleString()}`}
            sub={stats.totalOutstanding > 0 ? 'Dues pending' : 'All clear ✓'}
            color={stats.totalOutstanding > 0 ? 'text-rose-400' : 'text-emerald-400'}
          />
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Revenue by Channel">
              {channelData.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-8">No payment data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={channelData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {channelData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend formatter={v => <span className="text-xs text-gray-400">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Section>

            <Section title="Monthly Revenue">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyDataCollection.monthlyRevenue} barSize={28}>
                  <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name="Billed" radius={[4, 4, 0, 0]} fill={C.bar} />
                  <Bar dataKey="collected" name="Collected" radius={[4, 4, 0, 0]} opacity={0.6} fill={C.cash} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Occupancy Rate (%)">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyDataCollection.occupancyData}>
                  <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<ChartTooltip prefix="" />} />
                  <Line type="monotone" dataKey="occupancy" name="Occupancy %" stroke={C.online} strokeWidth={2} dot={{ fill: C.online, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Avg Stay Duration (nights)">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyDataCollection.avgStayData}>
                  <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip prefix="" />} />
                  <Line type="monotone" dataKey="avg" name="Avg nights" stroke={C.line} strokeWidth={2} dot={{ fill: C.line, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          </div>

          <Section title={`Bookings in range (${bookings.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-ink-700">
                    {['Guest', 'Room', 'Check-in', 'Check-out', 'Nights', 'Billed', 'Cash', 'Online', 'Agoda', 'Outstanding'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {bookings.map(b => {
                    const outstanding = computeOutstanding(b)
                    return (
                      <tr key={b.id} className="hover:bg-ink-800/50 transition-colors">
                        <td className="py-2 pr-4 text-white font-medium">{b.guests?.name}</td>
                        <td className="py-2 pr-4 font-mono text-gray-300">{b.rooms?.room_no}</td>
                        <td className="py-2 pr-4 font-mono text-gray-400">{b.checkin_date ? format(parseISO(b.checkin_date), 'dd MMM') : '—'}</td>
                        <td className="py-2 pr-4 font-mono text-gray-400">{b.checkout_date ? format(parseISO(b.checkout_date), 'dd MMM') : '—'}</td>
                        <td className="py-2 pr-4 font-mono text-gray-400">{getNights(b)}</td>
                        <td className="py-2 pr-4 font-mono text-white">₹{toNum(b.total_amount).toLocaleString()}</td>
                        <td className="py-2 pr-4 font-mono text-emerald-400">₹{toNum(b.paid_cash).toLocaleString()}</td>
                        <td className="py-2 pr-4 font-mono text-blue-400">₹{toNum(b.paid_online).toLocaleString()}</td>
                        <td className="py-2 pr-4 font-mono text-amber-400">₹{toNum(b.paid_agoda).toLocaleString()}</td>
                        <td className="py-2 pr-4 font-mono">
                          <span className={outstanding > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                            ₹{outstanding.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-ink-600 text-gray-300 font-semibold">
                    <td className="pt-3 pr-4" colSpan={5}>Totals</td>
                    <td className="pt-3 pr-4 font-mono text-white">₹{stats.totalBilled.toLocaleString()}</td>
                    <td className="pt-3 pr-4 font-mono text-emerald-400">₹{stats.totalCash.toLocaleString()}</td>
                    <td className="pt-3 pr-4 font-mono text-blue-400">₹{stats.totalOnline.toLocaleString()}</td>
                    <td className="pt-3 pr-4 font-mono text-amber-400">₹{stats.totalAgoda.toLocaleString()}</td>
                    <td className="pt-3 pr-4 font-mono text-rose-400">₹{stats.totalOutstanding.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}