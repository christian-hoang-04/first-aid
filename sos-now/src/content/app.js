// Các trang của ứng dụng: hiện chỉ có tiêu đề và mô tả chức năng, sẽ được làm dần
// Nút "Bắt đầu ngay" trên landing mở thẳng trang Nút SOS
export const appStart = '/app/sos'

export const appPages = [
  {
    path: '/app/sos',
    nav: 'SOS',
    title: 'Nút SOS',
    description: 'Một chạm để gọi 115, đồng thời định vị vị trí hiện tại rồi chuyển sang danh sách cơ sở y tế gần nhất.'
  },
  {
    path: '/app/co-so-y-te',
    title: 'Cơ sở y tế gần nhất',
    description: 'Danh sách bệnh viện, cơ sở y tế gần vị trí hiện tại kèm số điện thoại để gọi khi không liên lạc được 115, cùng nút chỉ đường.'
  },
  {
    path: '/app/ai-voice',
    nav: 'AI Voice',
    title: 'AI Voice hướng dẫn sơ cứu',
    description: 'Mô tả tình huống bằng giọng nói tiếng Việt, AI nhận diện và đọc hướng dẫn sơ cứu từng bước.'
  },
  // Hai tính năng dưới đây chưa làm, trang chỉ hiện dòng Coming Soon
  {
    path: '/app/tre-em',
    nav: 'Tính năng cho trẻ em',
    title: 'Tính năng cho trẻ em',
    comingSoon: true
  },
  {
    path: '/app/aed',
    nav: 'Tìm kiếm AED và người hỗ trợ',
    title: 'Tìm kiếm AED và người hỗ trợ',
    comingSoon: true
  }
]

// Màn hình Nút SOS: nhấn nút mở màn Cơ sở y tế gần nhất kèm hộp xác nhận gọi 115
export const sosScreen = {
  question: 'Bạn đang gặp nguy hiểm?',
  hint: 'Nhấn nút bên dưới để gọi 115 và xem cơ sở y tế gần bạn nhất. Hãy bình tĩnh, trợ giúp sẽ sớm đến với bạn.',
  button: 'SOS',
  buttonLabel: 'Gọi 115 ngay',
  note: 'Cuộc gọi đến 115 hoàn toàn miễn phí.'
}

// Màn hình AI Voice: hiện mới là giao diện tĩnh, chưa ghi âm hay gọi AI
export const voiceScreen = {
  title: 'AI Voice hướng dẫn sơ cứu',
  question: 'Bạn đang gặp tình huống gì?',
  suggestions: [
    { icon: 'wind', label: 'Sơ cứu hóc dị vật: ép bụng' },
    { icon: 'bone', label: 'Cố định gãy xương đùi' },
    { icon: 'carry', label: 'Đưa nạn nhân lên cáng: xúc thìa' }
  ],
  inputPlaceholder: 'Mô tả điều bạn đang thấy, hoặc nhấn micro để nói...',
  language: 'Tiếng Việt',
  micLabel: 'Nói với AI',
  sendLabel: 'Gửi',
  emergency: 'Nguy hiểm tính mạng? Gọi ngay 115'
}

// Menu trên các trang app; trang Cơ sở y tế được mở từ luồng SOS nên không nằm trong menu
export const appNav = appPages.filter((page) => page.nav).map((page) => ({ path: page.path, label: page.nav }))

export const authPages = [
  { path: '/dang-nhap', title: 'Đăng nhập', description: 'Đăng nhập tài khoản để lưu tiến độ khóa học và quản lý gói sử dụng. Nút SOS vẫn dùng được khi chưa đăng nhập.' },
  { path: '/dang-ky', title: 'Đăng ký', description: 'Tạo tài khoản SOS NOW mới để học sơ cứu và nâng cấp gói Pro, Ultra.' }
]

// Màn hình Cơ sở y tế gần nhất: nhấn SOS sẽ mở màn này kèm hộp Gọi 115 / Hủy.
// Bản demo không gọi thật: nút Gọi chỉ hiện trạng thái đang gọi
export const facilityScreen = {
  title: 'Cơ sở y tế gần bạn',
  locating: 'Đang xác định vị trí của bạn…',
  located: 'Đã xác định vị trí của bạn.',
  locatedNearLandmark: 'Bạn đang ở gần {landmark}.',
  locatedInDirectionOfLandmark: 'Bạn đang ở phía {direction} của {landmark}.',
  cardinalDirections: { north: 'Bắc', east: 'Đông', south: 'Nam', west: 'Tây' },
  failed: 'Không lấy được vị trí, đang hiển thị các cơ sở gần trung tâm TP.HCM.',
  retry: 'Thử định vị lại',
  call115: 'Gọi 115',
  showOnMap: 'Xem trên bản đồ',
  emergency: 'Có cấp cứu',
  hours24: 'Trực 24/24',
  roadDistanceNote: 'đường bộ ước tính',
  source: 'Thông tin theo danh sách 65 địa điểm cấp cứu được người dùng xác nhận và nền bản đồ Mapbox. Khoảng cách đường bộ được ước tính khi dữ liệu tuyến có sẵn.',
  dialog: {
    title: 'Gọi cấp cứu 115?',
    text: 'Bạn sắp gọi đến tổng đài cấp cứu 115. Danh sách cơ sở y tế gần bạn vẫn hiện ở phía sau.',
    call: 'Gọi',
    cancel: 'Hủy',
    calling: 'Đang gọi 115…',
    demo: 'Bản demo: không thực hiện cuộc gọi thật.',
    end: 'Kết thúc'
  }
}
