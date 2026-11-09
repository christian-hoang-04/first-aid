import { Mastra } from '@mastra/core/mastra';
import { chatAgent, voiceAgent } from './agents/first-aid-agents';

export const mastra = new Mastra({
  agents: { voiceAgent, chatAgent },
});
