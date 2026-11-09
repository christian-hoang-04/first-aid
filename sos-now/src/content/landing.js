// Nội dung landing page. Các mục còn `note` là khung giữ chỗ, sẽ thay bằng thiết kế thật khi có mẫu.
export const navLinks = [
  { id: 'cach-hoat-dong', label: 'HDSD' },
  { id: 'tinh-nang', label: 'Tính năng' },
  { id: 'bang-gia', label: 'Bảng giá' },
  { id: 'doi-ngu', label: 'Về chúng tôi' }
]

export const hero = {
  title: ['Ứng dụng', 'Sơ cứu', 'khẩn cấp'],
  description: 'Ứng dụng sơ cứu khẩn cấp tích hợp giọng nói AI, đào tạo sơ cứu và kết nối với các dịch vụ hỗ trợ',
  cta: 'Bắt đầu ngay',
  imageAlt: 'Quy trình SOS NOW: AI Voice hướng dẫn, bấm SOS gọi 115, định vị vị trí, tìm bệnh viện và được hỗ trợ'
}

// Vấn đề: chưa đưa số liệu, khi có nguồn tin cậy thì bổ sung vào từng thẻ
export const problem = {
  label: 'Vấn đề',
  title: ['Khi sự cố xảy ra,', 'bạn sẽ làm gì?'],
  subtitle: 'Trong vài phút đầu của một ca cấp cứu, người ở gần nạn nhân nhất thường lại là người lúng túng nhất.',
  items: [
    { icon: 'help', title: 'Lúng túng, hoảng loạn', text: 'Khi có người bất tỉnh, hóc dị vật hay đột quỵ, phần lớn người chứng kiến không biết nên bắt đầu từ đâu.' },
    { icon: 'timer', title: 'Bỏ lỡ thời gian vàng', text: 'Mỗi phút chậm trễ trước khi được sơ cứu đúng cách đều làm giảm cơ hội sống của nạn nhân.' },
    { icon: 'phone', title: 'Không biết gọi ai', text: 'Khi 115 bận hoặc không kết nối được, ít ai biết số của bệnh viện, cơ sở y tế gần mình nhất.' },
    { icon: 'book', title: 'Kiến thức dễ quên', text: 'Ít người được học sơ cứu bài bản, và những gì đã học rất dễ quên khi lâu không thực hành.' }
  ],
  solution: 'SOS NOW giúp bạn bình tĩnh và hành động đúng, từng bước một.',
  solutionLink: { label: 'Xem cách hoạt động', href: '#cach-hoat-dong' }
}

// Mô tả các bước là bản nháp, cần nhóm duyệt lại câu chữ
export const howItWorks = {
  label: 'HDSD',
  title: ['Quy trình', 'cơ bản'],
  steps: [
    { title: 'Một lần ấn nút SOS', description: 'Chỉ cần một chạm vào nút SOS, ứng dụng lập tức bật chế độ khẩn cấp và hướng dẫn bạn bằng giọng nói.' },
    { title: 'Chia sẻ vị trí', description: 'Vị trí của bạn được gửi ngay cho người thân và lực lượng hỗ trợ gần nhất để họ nắm rõ tình hình.' },
    { title: 'Gọi hỗ trợ', description: 'Kết nối nhanh với 115 và người biết sơ cứu ở gần, trong khi AI tiếp tục hướng dẫn bạn từng bước.' },
    { title: 'Dẫn đường', description: 'Chỉ đường tới cơ sở y tế gần nhất và giúp đội cứu hộ tìm đến bạn nhanh hơn.' }
  ]
}

// Phần "Tính năng": mỗi mục có một khung minh họa giao diện app (voice | course | sos)
export const features = {
  label: 'Tính năng',
  title: ['SOS NOW', 'cung cấp gì?'],
  items: [
    {
      visual: 'sos',
      tag: 'SOS khẩn cấp',
      title: 'SOS khẩn cấp',
      subtitle: 'Một lần chạm, tìm kiếm trợ giúp trong tình huống khẩn cấp',
      points: [
        'Phát tín hiệu SOS chỉ với một chạm',
        'Định vị, chia sẻ vị trí hiện tại',
        'Gọi cho 115 hoặc Hotline của bệnh viện, cơ sở y tế gần nhất',
        'Chỉ đường đến cơ sở y tế gần nhất'
      ]
    },
    {
      visual: 'voice',
      tag: 'AI Voice',
      title: 'AI Voice hướng dẫn sơ cứu',
      subtitle: 'Rảnh tay sơ cứu, AI đọc từng bước cho bạn',
      points: [
        'Nhận diện tình huống qua giọng nói tiếng Việt',
        'Hướng dẫn từng bước bằng giọng nói, video mô phỏng 3D',
        'Đếm nhịp ép tim CPR 100–120 lần/phút'
      ]
    },
    {
      visual: 'course',
      tag: 'Khóa học',
      title: 'Khóa học sơ cứu',
      subtitle: 'Chuẩn bị cho các tình huống khẩn cấp nhất',
      points: [
        'Khóa học online tại nhà',
        'Đăng ký tham gia lớp Sơ cứu cơ bản tại Hội Chữ thập đỏ',
        'Làm quiz để ôn tập và kiểm tra kiến thức'
      ]
    }
  ]
}

// Bảng giá: giá và quyền lợi là dữ liệu mẫu, nhóm sẽ chốt lại sau
export const pricing = {
  label: 'Bảng giá',
  includesLabel: 'Bao gồm:',
  plans: [
    {
      id: 'free',
      name: 'Free',
      price: '0VND',
      period: '/tháng',
      features: [
        'Hướng dẫn sơ cứu bằng giọng nói AI',
        'Nút SOS và gọi nhanh 115',
        'Bài học sơ cứu cơ bản'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '50VND',
      period: '/tháng',
      featured: true,
      ribbon: 'Đề xuất cho bạn',
      features: [
        'Mọi tính năng của gói Free',
        'Toàn bộ khóa học online và quiz',
        'Định vị, chia sẻ vị trí cho người thân',
        'Chỉ đường đến cơ sở y tế gần nhất'
      ]
    },
    {
      id: 'ultra',
      name: 'Ultra',
      price: '100VND',
      period: '/tháng',
      features: [
        'Mọi tính năng của gói Pro',
        'Ưu tiên kết nối người hỗ trợ ở gần',
        'Ưu đãi đăng ký lớp sơ cứu trực tiếp'
      ]
    }
  ]
}

// Về chúng tôi: thứ tự trong mảng là thứ tự trên băng chuyền, phần tử đầu nằm giữa khi tải trang
export const team = {
  label: 'Về chúng tôi',
  title: ['Gặp gỡ', 'đội ngũ sáng lập'],
  subtitle: 'Thành viên ESMARCH cùng xây dựng SOS NOW',
  members: [
    { id: 'my-dung', name: 'Mỹ Dung', role: 'Co-Founder & CEO', area: 'Điều hành chung' },
    { id: 'ngoc-huu', name: 'Ngọc Hữu', role: 'Chief Operating Officer', area: 'Vận hành' },
    { id: 'quynh-giao', name: 'Quỳnh Giao', role: 'Chief Financial Officer', area: 'Tài chính' },
    { id: 'yen-nhi', name: 'Yến Nhi', role: 'Chief Marketing Officer', area: 'Marketing' },
    { id: 'thu-huyen', name: 'Thu Huyền', role: 'Chief Technology Officer', area: 'Công nghệ' },
    { id: 'hoang-nam', name: 'Hoàng Nam', role: 'Chief AI Officer', area: 'Trí tuệ nhân tạo' }
  ]
}

// Câu hỏi thường gặp: câu trả lời bám theo phạm vi đã chốt (không cần đăng nhập, chỉ TP.HCM, vị trí không lưu lại)
export const faq = {
  label: 'FAQ',
  title: ['Câu hỏi', 'thường gặp'],
  subtitle: 'Những điều bạn nên biết trước khi dùng SOS NOW.',
  items: [
    { q: 'SOS NOW có thay thế việc gọi 115 không?', a: 'Không. SOS NOW giúp bạn gọi 115 nhanh hơn và hướng dẫn sơ cứu trong lúc chờ xe cấp cứu. Khi có nguy hiểm tính mạng, hãy luôn gọi 115 trước.' },
    { q: 'Nếu không gọi được 115 thì sao?', a: 'Ứng dụng hiển thị sẵn số điện thoại cấp cứu của bệnh viện, cơ sở y tế gần bạn nhất để bạn gọi trực tiếp.' },
    { q: 'SOS NOW dùng vị trí của tôi để làm gì?', a: 'Vị trí chỉ dùng để tìm bệnh viện, cơ sở y tế gần nhất và chỉ đường cho bạn. Vị trí không được chia sẻ cho ai và không được lưu lại.' }
  ]
}

export const sections = [
  { id: 'van-de', title: 'Vấn đề' },
  { id: 'cach-hoat-dong', title: 'Hướng dẫn sử dụng' },
  { id: 'tinh-nang', title: 'Tính năng' },
  { id: 'bang-gia', title: 'Bảng giá' },
  { id: 'doi-ngu', title: 'Về chúng tôi' },
  { id: 'faq', title: 'Câu hỏi thường gặp' },
  { id: 'cta', title: 'Kêu gọi hành động' }
]

export const callToAction = {
  //   giữ "SOS NOW" luôn trên cùng một dòng
  title: 'Sẵn sàng sơ cứu khẩn cấp với SOS NOW',
  stores: [
    { id: 'google-play', label: 'Tải SOS NOW trên Google Play' },
    { id: 'app-store', label: 'Tải SOS NOW trên App Store' }
  ],
  phone: {
    question: 'Bạn đang gặp nguy hiểm?',
    hint: 'Nhấn nút bên dưới, trợ giúp sẽ sớm tìm đến bạn.'
  }
}

// Link footer trỏ tới mục tương ứng trên landing hoặc trang app; mục chưa có trang riêng tạm về trang Nút SOS
export const footer = {
  developer: 'ESMARCH',
  contactLabel: 'Liên hệ:',
  contact: 'Đang cập nhật',
  columns: [
    { title: 'Company', links: [{ label: 'About Us', to: '/#doi-ngu' }, { label: 'Services', to: '/#tinh-nang' }, { label: 'Community', to: '/app/sos' }] },
    { title: 'Links', links: [{ label: 'Courses', to: '/#tinh-nang' }, { label: 'Become Teacher', to: '/app/sos' }, { label: 'Service', to: '/#bang-gia' }, { label: 'All in One', to: '/app/sos' }] },
    { title: 'Support', links: [{ label: 'Help Center', to: '/#faq' }] }
  ]
}
