import { describe, expect, it } from 'vitest'
import { toObservations } from './boston311'

describe('toObservations', () => {
  it('censors open cases at the extract cutoff and treats Noted/Transitioned as cause 2', () => {
    const cutoff = Date.parse('2026-10-24T09:00:00Z')
    const obs = toObservations(
      [
        { case_status: 'In progress', closure_reason: null, open_date: '2026-10-23 09:00:00+00', close_date: null },
        { case_status: 'Closed', closure_reason: 'Transitioned', open_date: '2026-10-20 00:00:00+00', close_date: '2026-10-20 12:00:00+00' },
        { case_status: 'Closed', closure_reason: 'Resolved', open_date: '2026-10-20 00:00:00+00', close_date: '2026-10-21 00:00:00+00' },
      ],
      cutoff,
    )
    expect(obs).toEqual([
      { hours: 24, cause: 0 },
      { hours: 12, cause: 2 },
      { hours: 24, cause: 1 },
    ])
  })

  it('reads timestamptz output ("+00:00"), the form fetchExtractCutoff gets back', () => {
    const obs = toObservations(
      [{ case_status: 'In progress', closure_reason: null, open_date: '2026-10-23T09:00:00.000000+00:00', close_date: null }],
      Date.parse('2026-10-24T09:00:00Z'),
    )
    expect(obs).toEqual([{ hours: 24, cause: 0 }])
  })
})
