/** MC-02: typed input reaches a query only as a well-formed case ID. */
import { describe, expect, it, vi, afterEach } from 'vitest'
import fc from 'fast-check'
import { CASE_ID_PATTERN, fetchCase, parseCaseId } from './boston311'

const digits8 = fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 8, maxLength: 8 }).map((d) => d.join(''))

describe('parseCaseId', () => {
  it('only ever returns null or a string matching ^BCS-\\d{8}$', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (s) => {
        const id = parseCaseId(s)
        return id === null || CASE_ID_PATTERN.test(id)
      }),
      { numRuns: 2000 },
    )
  })

  // Surrounding whitespace is trimmed on purpose (see the next property), so it is not in this list:
  // fast-check found that "\nBCS-00000000" correctly parses to the clean ID.
  it('never lets quotes, semicolons or SQL comment markers through', () => {
    fc.assert(
      fc.property(digits8, fc.constantFrom("'", ';', '--', '/*', '"', ' OR 1=1', "'; DROP"), (d, bad) => {
        return parseCaseId(`BCS-${d}${bad}`) === null && parseCaseId(`${bad}BCS-${d}`) === null
      }),
    )
  })

  it('accepts real IDs, trimming and upper-casing what was typed', () => {
    fc.assert(
      fc.property(digits8, fc.constantFrom('', ' ', '  ', '\t'), fc.boolean(), (d, pad, lower) => {
        const typed = `${pad}${lower ? 'bcs' : 'BCS'}-${d}${pad}`
        return parseCaseId(typed) === `BCS-${d}`
      }),
    )
    expect(parseCaseId('BCS-00253943')).toBe('BCS-00253943')
  })

  it('rejects near misses', () => {
    for (const s of ['', 'BCS-0025394', 'BCS-002539430', 'BCS00253943', 'BCS-0025394X', 'XYZ-00253943', 'BCS-0025 3943']) {
      expect(parseCaseId(s), s).toBeNull()
    }
  })
})

describe('fetchCase', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('refuses a malformed ID without touching the network', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    await expect(fetchCase("BCS-00253943' OR '1'='1")).rejects.toThrow('Not a case ID')
    expect(spy).not.toHaveBeenCalled()
  })

  it('asks for the one case and no address or location fields', async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ success: true, result: { records: [] } })))
    vi.stubGlobal('fetch', spy)
    expect(await fetchCase('BCS-00253943')).toBeNull()
    const sql = decodeURIComponent(String((spy.mock.calls[0] as unknown[])[0]).split('sql=')[1])
    expect(sql).toContain("case_id = 'BCS-00253943'")
    for (const field of ['full_address', 'street', 'latitude', 'longitude', 'photo', 'comments']) {
      expect(sql).not.toContain(field)
    }
  })
})
