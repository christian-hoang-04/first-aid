import { describe, expect, it } from 'vitest'
import { cityCenter, distanceMeters, facilities, formatPhone, nearestFacilities } from './facilities'
import { validateFacilities } from '../maps/api'

describe('facility catalog', () => {
  it('passes the same checks the facility API response must pass', () => expect(() => validateFacilities(facilities)).not.toThrow())
  it('stays inside Ho Chi Minh City and records its source', () => facilities.forEach((f) => {
    expect(f.latitude).toBeGreaterThan(10.3); expect(f.latitude).toBeLessThanOrEqual(11.3)
    expect(f.longitude).toBeGreaterThan(106.3); expect(f.longitude).toBeLessThanOrEqual(107.4)
    expect(f.verificationSource).toBeTruthy(); expect(f.verifiedAt).toBeTruthy()
  }))
  it('has unique ids', () => expect(new Set(facilities.map((f) => f.id)).size).toBe(facilities.length))
})

describe('nearest facilities', () => {
  it('measures distance in meters', () => expect(distanceMeters({ lat: 10.7769, lng: 106.7009 }, { lat: 10.7859, lng: 106.7009 })).toBeCloseTo(1000, -1))
  it('returns the closest five, nearest first', () => {
    const list = nearestFacilities({ lat: 10.8039, lng: 106.6941 })
    expect(list).toHaveLength(5)
    expect(list[0].id).toBe('benh-vien-da-khoa-binh-thanh')
    list.slice(1).forEach((f, i) => expect(f.distanceMeters).toBeGreaterThanOrEqual(list[i].distanceMeters))
  })
  it('works from the city center when there is no location', () => expect(nearestFacilities(cityCenter)[0].distanceMeters).toBeLessThan(2000))
  it('formats phone numbers for reading', () => {
    expect(formatPhone('02838412692')).toBe('028 3841 2692')
    expect(formatPhone('0903023194')).toBe('0903 023 194')
  })
})
