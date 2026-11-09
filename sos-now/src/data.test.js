import { describe, expect, it } from 'vitest'
import { classifyEmergency } from './data'

describe('classifyEmergency', () => {
  it('recognizes stroke language', () => expect(classifyEmergency('Bố tôi bị méo miệng và yếu tay').scenario.id).toBe('stroke'))
  it('recognizes choking language', () => expect(classifyEmergency('Có người bị hóc nghẹn').scenario.id).toBe('choking'))
})
