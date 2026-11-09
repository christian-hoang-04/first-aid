/** Tên agent LiveKit mà worker đăng ký và route token dispatch tới. */
export const LIVEKIT_AGENT_NAME = 'mastra-voice';

/** Lời chào agent đọc khi bắt đầu cuộc gọi (giao diện hiển thị cùng câu làm phụ đề). */
export const GREETING = 'Xin chào, tôi là trợ lý sơ cứu. Bạn hãy kể cho tôi chuyện gì đang xảy ra với nạn nhân.';

/** Tiền tố identity của người dùng do route token cấp, để worker tìm đúng participant. */
export const USER_IDENTITY_PREFIX = 'user-';
