import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { parseCambridgeTime, toCambridgeObservations, type CambridgeRow } from './cambridge311'

const cutoff = parseCambridgeTime('2026-10-24T04:00:00.000')

describe('toCambridgeObservations', () => {
  it('maps statuses: open/acknowledged censored at the cutoff, closed/archived as events', () => {
    const rows: CambridgeRow[] = [
      { ticket_status: 'Open', ticket_created_date_time: '2026-10-23T04:00:00.000' },
      // An open ticket that once had a close time is still open now.
      { ticket_status: 'Acknowledged', ticket_created_date_time: '2026-10-22T04:00:00.000', ticket_closed_date_time: '2026-10-22T05:00:00.000' },
      { ticket_status: 'Closed', ticket_created_date_time: '2026-10-20T00:00:00.000', ticket_closed_date_time: '2026-10-20T12:00:00.000' },
      { ticket_status: 'Archived', ticket_created_date_time: '2026-10-01T00:00:00.000', ticket_closed_date_time: '2026-10-03T00:00:00.000' },
      { ticket_status: 'Archived', ticket_created_date_time: '2026-10-01T00:00:00.000', ticket_closed_date_time: null },
    ]
    expect(toCambridgeObservations(rows, cutoff)).toEqual({
      obs: [
        { hours: 24, cause: 0 },
        { hours: 48, cause: 0 },
        { hours: 12, cause: 1 },
        { hours: 48, cause: 1 },
      ],
      excludedNoCloseTime: 1,
    })
  })

  it('accounts for every row: kept + excluded + dropped = input', () => {
    const status = fc.constantFrom('Open', 'Acknowledged', 'Closed', 'Archived', 'Other')
    const row = fc.record({
      ticket_status: status,
      open: fc.integer({ min: 0, max: 100 * 24 }),
      dur: fc.option(fc.integer({ min: -5, max: 100 * 24 }), { nil: null }),
    })
    fc.assert(
      fc.property(fc.array(row, { maxLength: 60 }), (spec) => {
        const base = parseCambridgeTime('2026-07-01T00:00:00')
        const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19)
        const rows: CambridgeRow[] = spec.map((s) => ({
          ticket_status: s.ticket_status,
          ticket_created_date_time: iso(base + s.open * 3_600_000),
          ticket_closed_date_time: s.dur === null ? null : iso(base + (s.open + s.dur) * 3_600_000),
        }))
        const { obs, excludedNoCloseTime } = toCambridgeObservations(rows, cutoff)
        const other = spec.filter((s) => s.ticket_status === 'Other').length
        const negative = spec.filter((s) => (s.ticket_status === 'Closed' || s.ticket_status === 'Archived') && s.dur !== null && s.dur < 0).length
        return obs.length + excludedNoCloseTime + other + negative === spec.length && obs.every((o) => o.hours >= 0)
      }),
    )
  })
})
