import { AccessToken, RoomAgentDispatch, RoomConfiguration } from 'livekit-server-sdk';
import { LIVEKIT_AGENT_NAME, USER_IDENTITY_PREFIX } from '@/lib/voice-events';

/**
 * Token endpoint theo chuẩn `TokenSource.endpoint` của livekit-client:
 * cấp token vào một room mới và dispatch voice worker vào room đó.
 */
export async function POST() {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return Response.json({ error: 'Thiếu cấu hình LiveKit' }, { status: 500 });
  }

  const roomName = `voice-${crypto.randomUUID()}`;
  const identity = `${USER_IDENTITY_PREFIX}${crypto.randomUUID()}`;

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: 'Người dùng',
    ttl: '15m',
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });
  token.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: LIVEKIT_AGENT_NAME })],
  });

  return Response.json({
    server_url: LIVEKIT_URL,
    participant_token: await token.toJwt(),
  });
}
