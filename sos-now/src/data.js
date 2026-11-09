export const scenarios = [
  {
    id: 'cardiac',
    title: 'Bất tỉnh / Ngừng thở',
    short: 'CPR',
    tone: 'red',
    keywords: ['bất tỉnh', 'không thở', 'ngừng tim', 'tim ngừng', 'ngã quỵ'],
    warning: 'Nếu nạn nhân không phản ứng và không thở bình thường, hãy gọi 115 ngay.',
    steps: [
      'Kiểm tra hiện trường an toàn. Gọi lớn và vỗ nhẹ vai để kiểm tra phản ứng.',
      'Nhờ một người gọi 115 và tìm máy AED. Nếu ở một mình, bật loa ngoài khi gọi.',
      'Đặt nạn nhân nằm ngửa trên mặt phẳng cứng. Đặt gót bàn tay giữa ngực.',
      'Ép ngực mạnh và nhanh 100–120 lần/phút, sâu khoảng 5–6 cm ở người lớn.',
      'Tiếp tục chu kỳ 30 lần ép và 2 lần thổi ngạt nếu đã được huấn luyện.'
    ]
  },
  {
    id: 'choking',
    title: 'Hóc / Nghẹn',
    short: 'Đường thở',
    tone: 'amber',
    keywords: ['hóc', 'nghẹn', 'không nói được', 'không ho được', 'dị vật'],
    warning: 'Nếu nạn nhân không thể nói, ho hoặc thở, đây là tình huống khẩn cấp.',
    steps: [
      'Hỏi nhanh “Bạn có bị nghẹn không?”. Khuyến khích ho nếu họ vẫn ho được.',
      'Nếu tắc nghẽn nặng, gọi 115 và thực hiện 5 lần vỗ lưng giữa hai bả vai.',
      'Thực hiện 5 lần ép bụng ở người lớn; luân phiên 5 vỗ lưng và 5 ép bụng.',
      'Nếu nạn nhân bất tỉnh, đặt xuống nền an toàn và bắt đầu CPR.',
      'Không móc họng bằng tay nếu không nhìn thấy dị vật.'
    ]
  },
  {
    id: 'stroke',
    title: 'Dấu hiệu đột quỵ',
    short: 'FAST',
    tone: 'violet',
    keywords: ['méo miệng', 'yếu tay', 'nói khó', 'đột quỵ', 'tai biến'],
    warning: 'Ghi nhớ thời điểm xuất hiện triệu chứng và gọi 115 ngay — không tự lái xe.',
    steps: [
      'F — Face: Yêu cầu cười, quan sát một bên mặt có xệ xuống không.',
      'A — Arms: Yêu cầu giơ hai tay, quan sát một tay có rơi xuống không.',
      'S — Speech: Yêu cầu nhắc một câu đơn giản, nghe xem có nói khó hay lẫn không.',
      'T — Time: Ghi lại thời điểm khởi phát và gọi 115 ngay lập tức.',
      'Đặt nạn nhân nằm nghiêng nếu nôn; không cho ăn, uống hoặc tự dùng thuốc.'
    ]
  },
  {
    id: 'bleeding',
    title: 'Chảy máu nhiều',
    short: 'Cầm máu',
    tone: 'blue',
    keywords: ['chảy máu', 'mất máu', 'đứt tay', 'vết thương', 'tai nạn'],
    warning: 'Máu phun thành tia hoặc thấm đẫm nhanh cần hỗ trợ y tế khẩn cấp.',
    steps: [
      'Đảm bảo an toàn và đeo găng hoặc dùng lớp vải sạch nếu có.',
      'Đặt gạc hoặc vải sạch lên vết thương và ấn trực tiếp, liên tục.',
      'Nếu máu thấm qua, chồng thêm lớp mới; không bóc lớp đang ép.',
      'Gọi 115 nếu chảy máu nhiều, nạn nhân tái lạnh hoặc lơ mơ.',
      'Giữ nạn nhân ấm và yên. Không cho ăn uống trong khi chờ trợ giúp.'
    ]
  }
]

export const quiz = [
  { question: 'Khi thấy người bất tỉnh và không thở bình thường, việc ưu tiên là gì?', options: ['Cho uống nước', 'Gọi 115 và bắt đầu CPR', 'Đỡ ngồi dậy'], answer: 1 },
  { question: 'Tốc độ ép ngực khuyến nghị cho người lớn là bao nhiêu?', options: ['40–60 lần/phút', '70–80 lần/phút', '100–120 lần/phút'], answer: 2 },
  { question: 'Trong quy tắc FAST, chữ T nhắc bạn làm gì?', options: ['Ghi thời điểm và gọi cấp cứu', 'Đo thân nhiệt', 'Cho thuốc ngay'], answer: 0 },
]

export function classifyEmergency(input = '') {
  const text = input.toLocaleLowerCase('vi')
  let best = scenarios[0]
  let bestScore = 0
  for (const item of scenarios) {
    const score = item.keywords.filter((keyword) => text.includes(keyword)).length
    if (score > bestScore) { best = item; bestScore = score }
  }
  return { scenario: best, confidence: bestScore ? Math.min(0.97, 0.72 + bestScore * 0.1) : 0.48 }
}
