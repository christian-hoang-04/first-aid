import type { Processor, ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';
import { PHASE_TOOLS, phaseBrief } from '../../lib/first-aid/call-state';
import { optionalVoiceGuideBridge } from './voice-bridge';

/**
 * Mỗi lượt của voice agent: cho LLM biết giai đoạn cuộc gọi hiện tại và chỉ mở các tool hợp với giai
 * đoạn đó. Luồng do máy trạng thái quyết định; trong phạm vi được phép, LLM vẫn linh hoạt theo người dùng.
 */
export class CallPhaseProcessor implements Processor {
  id = 'call-phase';

  async processInputStep({ stepNumber, systemMessages }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const bridge = optionalVoiceGuideBridge();
    if (!bridge) return {};
    let state: ReturnType<typeof bridge.callState>;
    try {
      state = bridge.callState();
    } catch {
      return {};
    }
    // Giai đoạn có thể đổi ngay trong lượt (sau khi tool chạy), nên giới hạn tool ở MỌI bước của vòng lặp;
    // mô tả giai đoạn chỉ thêm một lần ở bước đầu để không lặp trong system prompt.
    if (stepNumber !== 0) return { activeTools: PHASE_TOOLS[state.phase] };
    return {
      activeTools: PHASE_TOOLS[state.phase],
      systemMessages: [...systemMessages, { role: 'system', content: phaseBrief(state) }],
    };
  }
}
