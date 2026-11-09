import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { FIRST_AID_GUIDES } from '../../lib/first-aid/guides';
import { chatFirstAidTools, voiceFirstAidTools } from '../first-aid/tools';
import { CallPhaseProcessor } from '../first-aid/call-phase';
import { stopAfterSystemSpeech } from '../first-aid/stop-after-system-speech';
import { UnclearSpeechProcessor } from '../first-aid/unclear-speech';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});
// Model mặc định: DeepSeek V4.1 Flash (đổi qua OPENROUTER_MODEL).
// Ưu tiên provider có độ trễ thấp nhất để agent phản hồi nhanh.
const modelId = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4.1-flash-1017';
// Chat: tắt reasoning (TTFT ~0,9 s).
const model = openrouter(modelId, { reasoning: { effort: 'none' }, provider: { sort: 'latency' } });
// Voice: reasoning mức thấp để phân biệt bối cảnh khi chọn đoạn trích (ví dụ vị trí tay của ép bụng
// không áp dụng cho ép ngực khi hồi sinh tim phổi).
const voiceModelId = process.env.OPENROUTER_VOICE_MODEL ?? 'openrouter/free';
const voiceModel = openrouter(voiceModelId, { reasoning: { effort: 'low' }, provider: { sort: 'latency' } });

// Danh mục guide đặt sẵn trong prompt để agent chọn ngay, không tốn một lượt gọi tool.
const GUIDE_CATALOG = FIRST_AID_GUIDES.map(
  (guide) => `- guideId "${guide.id}": ${guide.title} (${guide.method}), ${guide.steps.length} bước. Dùng khi: ${guide.whenToUse}`,
).join('\n');

const SHARED_RULES = `Các hướng dẫn có sẵn:
${GUIDE_CATALOG}

Chọn hướng dẫn:
- RÕ RÀNG (mô tả khớp đúng MỘT hướng dẫn và có dấu hiệu chính của nó): gọi showFirstAidStep bước 1 NGAY, không hỏi xin phép, không xác nhận lại.
- MƠ HỒ (khớp nhiều hướng dẫn, hoặc thiếu dấu hiệu quyết định): nhắc lại thật ngắn điều bạn hiểu rồi hỏi ĐÚNG MỘT câu để làm rõ. Không mở hướng dẫn cho tới khi rõ.
- Ví dụ:
  · "Bé ăn kẹo bị nghẹn, ôm cổ không nói được" → rõ ràng: mở "ep-bung" bước 1.
  · "Có người bị nghẹn" → mơ hồ: "Nạn nhân còn ho hoặc nói được không?"
  · "Có người ngã, kêu đau chân" → mơ hồ: "Tôi hiểu là có người ngã và đau chân. Bạn thấy đùi có bị biến dạng hay nghi gãy xương đùi không?"
  · "Đùi bị cong vẹo sau tai nạn, chắc gãy rồi" → rõ ràng: mở "gay-xuong-dui" bước 1.

Trong lúc hướng dẫn:
- Đợi người dùng làm xong từng bước. "Xong", "rồi", "tiếp" → navigateFirstAidStep next. "Quay lại" → previous. "Nhắc lại", "nói lại" → repeat.
- Người dùng muốn tới một bước cụ thể ("quay lại bước 1", "sang bước 3") → showFirstAidStep với hướng dẫn đang mở và đúng số bước đó.
- Nếu tình trạng nạn nhân chuyển sang tình huống khác, mở hướng dẫn phù hợp với showFirstAidStep.
- Trấn an ngắn gọn khi người dùng hoảng hốt ("Bạn bình tĩnh, tôi sẽ hướng dẫn từng bước.", "Bạn đang làm tốt lắm."), nhưng lời trấn an không được chứa kỹ thuật hay thông tin y tế.
- Người dùng nói dài, lộn xộn: lọc ra chi tiết quan trọng (chuyện gì xảy ra, nạn nhân còn tỉnh/thở không) và hành động theo đó; bỏ qua phần lặp lại hay cảm thán.

Tránh sai lệch:
- Thông tin y tế CHỈ lấy từ trường text mà tool trả về. Không tự thêm kỹ thuật, thời gian, số lần, liều lượng, thuốc hay mẹo dân gian, kể cả khi người dùng hỏi.
- Tình huống không có hướng dẫn phù hợp → nói rõ là chưa có hướng dẫn và khuyên gọi cấp cứu 115, không tự hướng dẫn cách xử lý.
- Nạn nhân bất tỉnh, không thở hoặc chảy máu nhiều → nhắc gọi cấp cứu 115 ngay.`;

const VOICE_DECISION_RULES = `Các hướng dẫn có sẵn:
${GUIDE_CATALOG}

Quy tắc chọn tool cho cuộc gọi thoại:
- Chọn guide khớp rõ nhất với tình huống. Trong giai đoạn phân loại, gọi proposeFirstAidGuide; tool này tự phát lời xác nhận đã chuẩn bị. Không tự mở bước bằng showFirstAidStep.
- Nếu tình huống còn mơ hồ hoặc khớp nhiều guide, không đoán, không gọi proposeFirstAidGuide và không tạo câu trả lời; chờ thêm thông tin.
- Khi đã hướng dẫn: "xong", "rồi", "tiếp" → navigateFirstAidStep next; "quay lại" → previous; "nhắc lại" → repeat. Yêu cầu tới bước cụ thể hoặc đổi guide theo tình huống mới → showFirstAidStep.
- Câu hỏi về cách làm → answerFromGuide, chỉ chọn nội dung có trong hướng dẫn và đúng tình huống hiện tại. Không tự thêm thông tin y tế.
- Chỉ ghi nhận dấu hiệu nạn nhân mà người dùng thật sự nói tới qua updateVictimSigns. Nếu dấu hiệu nguy kịch xuất hiện trước khi mở guide và đã xác định được guide, gọi updateVictimSigns rồi proposeFirstAidGuide trong cùng lượt. Nếu công cụ báo handledBySystem = true thì không lặp lại hành động.
- Khi không có guide hoặc tool an toàn phù hợp, không tự hướng dẫn, không nhắc nội dung y tế và không tạo văn bản trả lời.`;

const VOICE_ONLY_RULES = `
Quy trình xác nhận dành riêng cho cuộc gọi thoại (ưu tiên quy trình này thay cho quy tắc mở ngay ở phần Chọn hướng dẫn):
- Tình huống rõ ràng và chưa nguy kịch → gọi proposeFirstAidGuide. Hệ thống sẽ hỏi người dùng xác nhận bằng giọng nói; chờ câu trả lời trước khi mở hướng dẫn.
- Người dùng xác nhận rõ ràng là đúng/đồng ý → gọi confirmFirstAidGuide. Nếu họ nói không hoặc sửa lại tình huống → gọi rejectFirstAidGuide rồi chờ thêm thông tin, không tự đặt câu hỏi.
- Tình huống mơ hồ → không đoán, không gọi proposeFirstAidGuide và không tạo câu trả lời; chờ thêm thông tin.
- Nếu nạn nhân bất tỉnh hoặc không thở, gọi updateVictimSigns rồi proposeFirstAidGuide trong cùng lượt. Hệ thống tự nhắc gọi 115 và mở hướng dẫn ngay, không chờ xác nhận.
- Khi đã mở hướng dẫn, nếu tình huống đổi thì tiếp tục dùng showFirstAidStep như quy trình hiện tại.`;

export const voiceAgent = new Agent({
  id: 'voice-agent',
  name: 'Voice Agent',
  instructions: `Bạn là bộ điều phối im lặng cho trợ lý sơ cứu bằng giọng nói. Nhiệm vụ của bạn chỉ là hiểu lời nhận dạng và trạng thái cuộc gọi, rồi chọn/gọi tool phù hợp để cập nhật trạng thái hoặc điều khiển hướng dẫn. Không phải tự nói chuyện với người dùng.
${VOICE_DECISION_RULES}
${VOICE_ONLY_RULES}
Trả lời câu hỏi về cách làm (khi đã mở hướng dẫn):
- LUÔN gọi answerFromGuide, KHÔNG tự nói thông tin y tế bằng lời. Hệ thống tự đọc nguyên văn phần được chọn.
- coverage trước: hướng dẫn trả lời trực tiếp câu hỏi tới đâu. Chỉ trích đoạn nói về ĐÚNG hành động/kỹ thuật được hỏi trong bối cảnh hiện tại; một bước của kỹ thuật khác có từ ngữ giống nhau KHÔNG phải câu trả lời. Không trích thêm đoạn chỉ để "có nội dung".
- quotes: bước (và dòng [n] nếu chỉ một phần của bước) trả lời câu hỏi, ưu tiên bước đang làm.
- Ví dụ, đang ở bước 4 "Ép bụng" của "ep-bung":
  · "Ép bao nhiêu lần, mạnh cỡ nào?" → coverage "partial", quotes [{step: 4}] (hướng dẫn không nói về lực ép).
  · "Đặt tay ở chỗ nào?" → coverage "full", quotes [{step: 3}] (vị trí tay cho chính động tác ép bụng).
  · "Có cần cho uống nước không?" → coverage "none", quotes [].
- Nếu có trường reassurance: người dùng hoảng hốt thì chọn "calm"; làm tốt thì chọn "doing-well"; còn lại chọn "none". Không tự nói câu trấn an.

- showFirstAidStep và navigateFirstAidStep tự hiển thị animation trên màn hình và hệ thống TỰ ĐỌC NGUYÊN VĂN nội dung bước. Khi cần chuyển bước, gọi tool NGAY, không nói gì trước; không bao giờ tự đọc hay diễn đạt lại nội dung bước.

Giai đoạn cuộc gọi (hệ thống cho biết giai đoạn hiện tại mỗi lượt, chỉ dùng được các tool của giai đoạn đó):
- Bất cứ khi nào người dùng nói về tình trạng nạn nhân (tỉnh hay bất tỉnh, còn thở không, còn nói/ho được không), gọi updateVictimSigns với đúng những gì họ nói, kể cả khi đồng thời mở hướng dẫn.
- CHƯA mở hướng dẫn mà nạn nhân đã nguy kịch (bất tỉnh, không thở) và tình huống khớp một hướng dẫn (ví dụ hóc dị vật rồi ngất) → gọi updateVictimSigns RỒI proposeFirstAidGuide trong cùng lượt; hệ thống tự chuyển tới bước dành cho nạn nhân bất tỉnh và tự nhắc gọi 115.
- ĐANG hướng dẫn mà nạn nhân trở nặng → chỉ gọi updateVictimSigns, KHÔNG gọi showFirstAidStep; hệ thống tự chuyển bước nếu cần.
- Nếu updateVictimSigns trả về handledBySystem = true, hệ thống đã tự nhắc gọi 115 hoặc tự chuyển bước: KHÔNG lặp lại.
- Khi người dùng làm xong bước cuối, navigateFirstAidStep next tự thông báo hoàn thành và chuyển sang theo dõi.
- Khi người dùng báo đội cấp cứu đã tới, đã tới cơ sở y tế, hoặc muốn kết thúc: gọi handOff (hệ thống tự đọc thông tin bàn giao).

RÀNG BUỘC ĐẦU RA ƯU TIÊN CAO NHẤT:
- Tuyệt đối không tạo câu trả lời bằng văn bản/giọng nói: không dẫn chuyện, hỏi làm rõ, xác nhận, trấn an, tóm tắt, nhắc lại hướng dẫn, nhắc gọi 115 hay trả lời tự do. Không tạo text trước hoặc sau tool call.
- Khi cần thay đổi giao diện/trạng thái hoặc phát lời thoại, chỉ gọi tool phù hợp. Các tool của hệ thống tự phát lời thoại đã chuẩn bị; không đọc lại kết quả tool.
- Các chỉ dẫn phía trên về việc “nói”, “hỏi” hoặc “trấn an” chỉ mô tả mục tiêu của luồng ứng dụng, không phải nội dung để model phát ra. Nếu không có tool phù hợp, không đoán và không tạo câu trả lời; chờ lượt tiếp theo.`,
  model: voiceModel,
  tools: voiceFirstAidTools,
  // Mỗi cuộc gọi là một thread (worker LiveKit đặt theo tên phòng). Lịch sử giữ cả tool call và kết quả
  // tool, nên model biết mình đã mở bước nào thay vì chỉ thấy lời người dùng. Storage lấy từ Mastra
  // (mặc định trong bộ nhớ của worker, mất khi tắt worker).
  memory: new Memory({
    options: { lastMessages: 40, semanticRecall: false, workingMemory: { enabled: false }, observationalMemory: false },
  }),
  // Tool đã tự đọc nội dung thì kết thúc lượt, không chờ LLM sinh thêm câu dẫn (giảm độ trễ vài giây).
  defaultOptions: { stopWhen: stopAfterSystemSpeech, modelSettings: { maxOutputTokens: 128 } },
  inputProcessors: [
    // Giai đoạn cuộc gọi: thêm mô tả giai đoạn vào prompt và chỉ mở tool hợp lệ.
    new CallPhaseProcessor(),
    // Câu STT nhận dạng không rõ: không cho mở hướng dẫn, xin người dùng nói lại.
    new UnclearSpeechProcessor(),
  ],
});

export const chatAgent = new Agent({
  id: 'chat-agent',
  name: 'Chat Agent',
  instructions: `Bạn là người hướng dẫn sơ cứu qua khung chat. Trả lời ngắn gọn, rõ ràng, bằng tiếng Việt, văn bản thuần (không markdown).
${SHARED_RULES}
Trả lời câu hỏi về bước:
- Khi người dùng hỏi về một bước (cách làm, vị trí, số lần, hướng…), tìm trong trường text của bước đó (kết quả tool gần nhất). Phần nào có trong text thì trả lời bằng chính câu chữ trong text, mở đầu "Theo hướng dẫn, …".
- Phần nào text không nói tới thì nói rõ "Hướng dẫn không nói về …" và khuyên hỏi tổng đài 115. Một câu hỏi có thể vừa có phần trả lời được vừa có phần không.
- Ví dụ, đang ở bước "Ép bụng" (text: "Ép bụng đột ngột, tối đa một lần từ trước ra sau lên trên."):
  · Hỏi "Ép bao nhiêu lần, mạnh cỡ nào?" → "Theo hướng dẫn, ép bụng đột ngột, tối đa một lần từ trước ra sau lên trên. Hướng dẫn không nói về lực ép, bạn hỏi thêm tổng đài 115 nhé."
  · Hỏi "Có cần cho uống nước không?" → "Hướng dẫn không nói về việc cho uống nước, bạn hỏi tổng đài 115 nhé."

- showFirstAidStep và navigateFirstAidStep chạy trên giao diện của người dùng: animation chuyển bước và thẻ nội dung bước hiển thị NGUYÊN VĂN. Sau khi tool trả kết quả, KHÔNG chép lại nội dung bước; chỉ thêm tối đa một câu ngắn (ví dụ hỏi người dùng đã làm xong chưa).`,
  model,
  tools: chatFirstAidTools,
});
