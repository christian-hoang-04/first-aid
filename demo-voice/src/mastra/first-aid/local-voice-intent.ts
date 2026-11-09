import { StopResponse, voice } from '@livekit/agents';
import { getGuide } from '../../lib/first-aid/guides';
import { optionalVoiceGuideBridge } from './voice-bridge';
import { presentStepByVoice, proposeGuideByVoice } from './tools';
import { logVoiceInteraction } from './interaction-logger';

const AFFIRMATIVE = new Set(['dung', 'dung roi', 'chinh xac', 'dung vay', 'vang', 'vang a', 'da', 'da dung', 'duoc', 'dong y', 'toi dong y']);
const NEGATIVE = new Set(['khong', 'khong dung', 'khong phai', 'sai', 'sai roi', 'khong phai vay']);
const PROCEED_REQUESTS = ['huong dan toi', 'chi toi', 'giup toi', 'bat dau', 'tiep tuc', 'lam tiep', 'mo huong dan', 'cho toi xem'];
const AFFIRMATIVE_PREFIXES = ['đúng rồi', 'chính xác', 'đúng vậy', 'đúng', 'vâng ạ', 'vâng', 'dạ', 'đã đúng', 'được', 'đồng ý', 'tôi đồng ý'];
const NEGATIVE_PREFIXES = ['đừng', 'không phải', 'không', 'sai', 'chưa'];
const STEP_NUMBERS: Record<string, number> = {
  mot: 1,
  nhat: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  tu: 4,
  nam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
  muoi: 10,
};

function normalizeTranscript(text: string) {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeConfirmationTranscript(text: string) {
  return text
    .toLocaleLowerCase('vi-VN')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function startsWithPhrase(text: string, phrase: string) {
  return text === phrase || text.startsWith(`${phrase} `);
}

function isAffirmativeConfirmation(rawTranscript: string, transcript: string) {
  const preserved = normalizeConfirmationTranscript(rawTranscript);
  if (NEGATIVE_PREFIXES.some((phrase) => startsWithPhrase(preserved, phrase))) return false;
  if (AFFIRMATIVE.has(transcript)) return true;
  if (PROCEED_REQUESTS.some((phrase) => startsWithPhrase(transcript, phrase))) return true;

  const positivePrefix = AFFIRMATIVE_PREFIXES.find((phrase) => startsWithPhrase(preserved, phrase));
  if (!positivePrefix) return false;
  const requestAfterYes = normalizeTranscript(preserved.slice(positivePrefix.length));
  return PROCEED_REQUESTS.some((phrase) => startsWithPhrase(requestAfterYes, phrase));
}

function isExplicitAbdominalThrustRequest(text: string) {
  const mentionsForeignObject = text.includes('di vat');
  const mentionsAbdominalThrust = text.includes('ep bung');
  const asksForHelp = ['huong dan', 'chi toi', 'lam sao', 'giup toi', 'toi can', 'toi muon'].some((phrase) =>
    text.includes(phrase),
  );
  return mentionsForeignObject && mentionsAbdominalThrust && asksForHelp;
}

function requestedStepIndex(text: string, totalSteps: number) {
  const match = text.match(/(?:^|\s)buoc(?:\s+thu)?\s+(?:so\s+)?(\d+|mot|nhat|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)(?=$|\s)/);
  if (!match) return undefined;

  const number = /^\d+$/.test(match[1]) ? Number(match[1]) : STEP_NUMBERS[match[1]];
  const isDirectNavigation = /^(?:chuyen|sang|qua|den|toi|di|cho toi|quay lai)\b/.test(text);
  const isOnlyStepReference = /^buoc(?:\s+thu)?\s+(?:so\s+)?(?:\d+|mot|nhat|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)$/.test(text);

  if (!isDirectNavigation && !isOnlyStepReference) return undefined;
  if (!Number.isInteger(number) || number < 1 || number > totalSteps) return undefined;
  return number - 1;
}

function requestedRelativeStep(text: string, currentStepIndex: number, totalSteps: number) {
  const next = new Set(['xong', 'xong roi', 'da xong', 'tiep tuc', 'buoc tiep theo', 'sang buoc tiep theo', 'chuyen qua buoc tiep theo', 'chuyen sang buoc tiep theo', 'qua buoc tiep theo', 'sang buoc sau']);
  const previous = new Set(['buoc truoc', 'quay lai buoc truoc', 'lui lai buoc truoc', 've buoc truoc']);
  const repeat = new Set(['nhac lai', 'nhac lai buoc nay', 'lap lai', 'lap lai buoc nay', 'noi lai buoc nay', 'doc lai buoc nay']);

  if (next.has(text)) return currentStepIndex + 1 < totalSteps ? currentStepIndex + 1 : undefined;
  if (previous.has(text)) return currentStepIndex > 0 ? currentStepIndex - 1 : undefined;
  if (repeat.has(text)) return currentStepIndex;
  return undefined;
}

async function handleLocalVoiceIntent(rawTranscript: string) {
  const bridge = optionalVoiceGuideBridge();
  if (!bridge) return false;

  const transcript = normalizeTranscript(rawTranscript);
  const state = bridge.callState();

  if (state.phase === 'triage' && isExplicitAbdominalThrustRequest(transcript)) {
    const result = await proposeGuideByVoice('ep-bung');
    return !('error' in result);
  }

  if (state.phase === 'confirming' && state.pendingGuideId && isAffirmativeConfirmation(rawTranscript, transcript)) {
    await presentStepByVoice(state.pendingGuideId, 0);
    return true;
  }

  if (state.phase === 'confirming' && state.pendingGuideId && NEGATIVE.has(transcript)) {
    await bridge.dispatch({ type: 'guide-rejected' });
    return true;
  }

  if (state.phase === 'guiding' && state.guideId && state.stepIndex !== undefined) {
    const totalSteps = getGuide(state.guideId).steps.length;
    const stepIndex = requestedStepIndex(transcript, totalSteps) ?? requestedRelativeStep(transcript, state.stepIndex, totalSteps);
    if (stepIndex !== undefined) {
      await presentStepByVoice(state.guideId, stepIndex);
      return true;
    }
  }

  return false;
}

/** Handle explicit guide selection, confirmation, and navigation without an LLM call. */
export function attachLocalVoiceIntent(agent: voice.Agent) {
  const previousHook = agent.onUserTurnCompleted.bind(agent);
  agent.onUserTurnCompleted = async (chatContext, message) => {
    await previousHook(chatContext, message);
    const transcript = message.textContent ?? message.rawTextContent ?? '';
    const state = optionalVoiceGuideBridge()?.callState();
    const handledLocally = await handleLocalVoiceIntent(transcript);
    logVoiceInteraction('user_turn_routing', {
      handledLocally,
      phase: state?.phase,
      guideId: state?.guideId ?? state?.pendingGuideId,
      stepIndex: state?.stepIndex,
    });
    if (handledLocally) throw new StopResponse();
  };
}
