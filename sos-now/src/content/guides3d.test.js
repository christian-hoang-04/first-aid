import { describe, expect, it } from 'vitest'
import { guideForScenario, guideForText, guides3d } from './guides3d'

describe('3D guides', () => {
  it('opens the abdominal thrust guide when the user names it', () => {
    expect(guideForText('Ép bụng')?.id).toBe('ep-bung')
    expect(guideForText('hướng dẫn tôi ép bụng cho người lớn')?.id).toBe('ep-bung')
  })
  it('opens the femur fracture guide by keyword', () => {
    expect(guideForText('Gãy xương đùi')?.id).toBe('gay-xuong-dui')
    expect(guideForText('bạn tôi bị gãy đùi')?.id).toBe('gay-xuong-dui')
  })
  it('opens the scoop stretcher guide by keyword', () => {
    expect(guideForText('Xúc thìa')?.id).toBe('xuc-thia')
    expect(guideForText('cách đưa nạn nhân lên cáng')?.id).toBe('xuc-thia')
  })
  it('does not open a 3D guide for unrelated text', () => expect(guideForText('chảy máu nhiều')).toBeUndefined())
  it('ignores guides without a scenario when matching scenarios', () => expect(guideForScenario(null)).toBeUndefined())
  it('links the choking scenario to the 3D guide', () => expect(guideForScenario('choking')?.path).toBe('/app/huong-dan/ep-bung'))
  it('serves every guide from public/guides', () => guides3d.forEach((g) => expect(g.file).toMatch(/^\/guides\/.+\.html$/)))
})
