"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
  useSessionContext,
  useSessionMessages,
  useTrackToggle,
  type AgentState,
} from "@livekit/components-react";
import { TokenSource, Track } from "livekit-client";
import "./voice-test.css";

const styles = new Proxy({} as Record<string, string>, {
  get: (_target, key) => `voiceTest-${String(key)}`,
});

const tokenSource = TokenSource.endpoint("/api/livekit/token");

type EventKind = "system" | "user" | "agent";
type SessionEvent = { id: number; kind: EventKind; text: string; time: string };

const stateLabels: Record<AgentState, string> = {
  disconnected: "Chưa kết nối",
  connecting: "Đang kết nối",
  "pre-connect-buffering": "Đang chuẩn bị",
  initializing: "Đang khởi động",
  idle: "Đang chờ",
  listening: "Đang nghe",
  thinking: "Đang xử lý",
  speaking: "Đang nói",
  failed: "Không kết nối được",
};

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function formatDuration(value: number | null) {
  if (value === null) return "—";
  return value < 1000 ? Math.round(value) + " ms" : (value / 1000).toFixed(2) + " s";
}

function VoiceTestPanel() {
  const session = useSessionContext();
  const agent = useAgent(session);
  const { messages } = useSessionMessages(session);
  const microphone = useTrackToggle({ source: Track.Source.Microphone, room: session.room });

  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [replyLatencySamples, setReplyLatencySamples] = useState<number[]>([]);
  const [speechStartSamples, setSpeechStartSamples] = useState<number[]>([]);
  const [roomConnectMs, setRoomConnectMs] = useState<number | null>(null);
  const [agentReadyMs, setAgentReadyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventListRef = useRef<HTMLDivElement>(null);
  const sequence = useRef(0);
  const seenMessageIds = useRef(new Set<string>());
  const pendingUserTranscriptAt = useRef<number | null>(null);
  const connectStartedAt = useRef<number | null>(null);
  const thinkingStartedAt = useRef<number | null>(null);
  const previousAgentState = useRef<AgentState>("disconnected");

  const addEvent = useCallback((kind: EventKind, text: string) => {
    const time = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const event = { id: ++sequence.current, kind, text, time };
    setEvents((current) =>
      [...current, event].slice(-80),
    );
  }, []);

  useEffect(() => {
    if (!session.isConnected || connectStartedAt.current === null || roomConnectMs !== null) return;
    setRoomConnectMs(performance.now() - connectStartedAt.current);
  }, [roomConnectMs, session.isConnected]);

  useEffect(() => {
    const state = agent.state;
    const previous = previousAgentState.current;
    if (state === previous) return;

    addEvent("system", "Trạng thái trợ lý: " + stateLabels[state]);
    const now = performance.now();

    if (
      (state === "listening" || state === "thinking" || state === "speaking") &&
      connectStartedAt.current !== null &&
      agentReadyMs === null
    ) {
      setAgentReadyMs(now - connectStartedAt.current);
    }

    if (state === "thinking") thinkingStartedAt.current = now;
    const thinkingAt = thinkingStartedAt.current;
    if (state === "speaking" && thinkingAt !== null) {
      setSpeechStartSamples((current) => [...current, now - thinkingAt].slice(-20));
      thinkingStartedAt.current = null;
    }
    if (state === "listening" || state === "disconnected" || state === "failed") {
      thinkingStartedAt.current = null;
    }

    previousAgentState.current = state;
  }, [addEvent, agent.state, agentReadyMs]);

  useEffect(() => {
    for (const message of messages) {
      if (seenMessageIds.current.has(message.id)) continue;
      if (message.type !== "userTranscript" && message.type !== "agentTranscript") continue;
      seenMessageIds.current.add(message.id);

      if (message.type === "userTranscript") {
        pendingUserTranscriptAt.current = performance.now();
        addEvent("user", message.message);
        continue;
      }

      const transcriptAt = pendingUserTranscriptAt.current;
      if (transcriptAt !== null) {
        const receivedAt = performance.now();
        setReplyLatencySamples((current) => [...current, receivedAt - transcriptAt].slice(-20));
        pendingUserTranscriptAt.current = null;
      }
      addEvent("agent", message.message);
    }
  }, [addEvent, messages]);

  useEffect(() => {
    if (eventListRef.current) eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
  }, [events.length]);

  const startSession = async () => {
    setError(null);
    setRoomConnectMs(null);
    setAgentReadyMs(null);
    setReplyLatencySamples([]);
    setSpeechStartSamples([]);
    pendingUserTranscriptAt.current = null;
    thinkingStartedAt.current = null;
    previousAgentState.current = "connecting";
    connectStartedAt.current = performance.now();
    addEvent("system", "Đang mở phiên và xin quyền microphone.");

    try {
      await session.start({ tracks: { microphone: { enabled: true } } });
      addEvent("system", "Đã kết nối phòng LiveKit.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Không thể mở phiên LiveKit.";
      setError(message);
      addEvent("system", "Kết nối thất bại: " + message);
      connectStartedAt.current = null;
    }
  };

  const endSession = async () => {
    try {
      await session.end();
      addEvent("system", "Đã kết thúc phiên.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Không thể kết thúc phiên.";
      setError(message);
    }
  };

  const clearMeasurements = () => {
    setEvents([]);
    setReplyLatencySamples([]);
    setSpeechStartSamples([]);
    setRoomConnectMs(null);
    setAgentReadyMs(null);
    pendingUserTranscriptAt.current = null;
  };

  const roomConnecting = session.connectionState === "connecting";
  const connected = session.isConnected;
  const replyMedian = median(replyLatencySamples);
  const speechMedian = median(speechStartSamples);
  const stateClass = styles["state-" + agent.state] ?? styles["state-idle"];

  return (
    <main className={styles.page} lang="vi">
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="SOS NOW Voice Lab">
          <span className={styles.brandMark}>S</span>
          <span>SOS NOW <small>/ VOICE LAB</small></span>
        </Link>
        <span className={styles.localBadge}><i /> MÔI TRƯỜNG THỬ NGHIỆM</span>
      </header>

      <section className={styles.intro}>
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>SOS NOW / VOICE LAB</p>
          <h1>Thử giọng nói.<br /><em>Đo từng lượt.</em></h1>
          <p className={styles.lede}>
            Kiểm tra hội thoại tiếng Việt, theo dõi transcript và so sánh độ trễ ngay trong một phiên.
          </p>
        </div>
        <div className={styles.introNote}>
          <span>LIVE TEST BENCH</span>
          <strong>Bắt đầu bằng một câu ngắn</strong>
          <small>Cấp quyền microphone khi bạn sẵn sàng.</small>
        </div>
      </section>

      <section className={styles.workspace} aria-label="Phiên thử giọng nói">
        <article className={styles.sessionCard}>
          <div className={styles.cardTopline}>
            <div>
              <span className={styles.eyebrow}>VOICE SESSION</span>
              <h2 className={styles.cardTitle}>Phiên thoại</h2>
            </div>
            <span className={styles.statePill}>
              <i className={stateClass} />
              {connected ? stateLabels[agent.state] : roomConnecting ? "Đang kết nối phòng" : "Chưa kết nối"}
            </span>
          </div>

          <div className={styles.voiceCore}>
            <div className={styles.voiceHalo + " " + (connected ? styles["halo-" + agent.state] ?? "" : "")}>
              <span className={styles.voiceCoreInner}>
                <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                  <rect x="9" y="2" width="6" height="13" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v4m-4 0h8" />
                </svg>
              </span>
            </div>
            <div>
              <h2>{connected ? stateLabels[agent.state] : "Sẵn sàng kiểm tra"}</h2>
              <p>{connected ? "Nói một câu ngắn bằng tiếng Việt, rồi đợi trợ lý trả lời." : "Bắt đầu phiên để cấp quyền microphone và gọi voice agent."}</p>
            </div>
          </div>

          <div className={styles.controls}>
            {!connected ? (
              <button className={styles.primaryButton} type="button" onClick={startSession} disabled={roomConnecting}>
                {roomConnecting ? "Đang kết nối…" : "Bắt đầu phiên"}
              </button>
            ) : (
              <>
                <button
                  className={microphone.enabled ? styles.secondaryButton : styles.mutedButton}
                  type="button"
                  aria-pressed={!microphone.enabled}
                  onClick={() => microphone.toggle()}
                >
                  {microphone.enabled ? "Tắt microphone" : "Bật microphone"}
                </button>
                <button className={styles.endButton} type="button" onClick={endSession}>Kết thúc phiên</button>
              </>
            )}
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
          {agent.state === "failed" && agent.failureReasons.length > 0 && (
            <p className={styles.error} role="status">{agent.failureReasons.join(" · ")}</p>
          )}

          <div className={styles.sessionFacts}>
            <span><i className={connected ? styles.goodDot : styles.idleDot} /> Phòng {connected ? "đã kết nối" : "đang chờ"}</span>
            <span><i className={agent.state === "failed" ? styles.badDot : styles.goodDot} /> Agent {stateLabels[agent.state].toLowerCase()}</span>
            <span><i className={styles.goodDot} /> Mic {connected ? (microphone.enabled ? "đang bật" : "đã tắt") : "chưa cấp quyền"}</span>
          </div>

          <p className={styles.privacyNote}>
            Transcript chỉ hiển thị trong tab. Model dùng cấu hình worker hiện tại (OpenRouter); hội thoại có thể được gửi tới provider. Trang không lưu âm thanh hay gửi telemetry.
          </p>
        </article>

        <article className={styles.transcriptCard}>
          <div className={styles.transcriptHeader}>
            <div>
              <span className={styles.eyebrow}>SESSION TRACE</span>
              <h2>Lượt hội thoại</h2>
            </div>
            <button className={styles.clearButton} type="button" onClick={clearMeasurements} disabled={events.length === 0}>
              Xóa log
            </button>
          </div>

          <div className={styles.eventList} ref={eventListRef} aria-live="polite" aria-relevant="additions text">
            {events.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>↗</span>
                <strong>Chưa có lượt nào</strong>
                <p>Bắt đầu phiên và nói một câu để xem transcript cùng các mốc thời gian.</p>
              </div>
            ) : (
              events.map((event) => (
                <div className={styles.eventRow + " " + styles["event-" + event.kind]} key={event.id}>
                  <time>{event.time}</time>
                  <div>
                    <span className={styles.eventSpeaker}>
                      {event.kind === "user" ? "BẠN" : event.kind === "agent" ? "TRỢ LÝ" : "HỆ THỐNG"}
                    </span>
                    <p>{event.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <footer className={styles.transcriptFooter}>
            <span>{events.filter((event) => event.kind === "user").length} lượt người nói</span>
            <span>{events.filter((event) => event.kind === "agent").length} lượt trợ lý</span>
            <span>{replyLatencySamples.length} phép đo</span>
          </footer>
        </article>
      </section>

      <section className={styles.metricsSection} aria-label="Đo độ trễ">
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>PERFORMANCE</span>
          <h2>Số đo phiên này</h2>
        </div>
        <div className={styles.metrics}>
          <Metric label="Phòng LiveKit kết nối" value={formatDuration(roomConnectMs)} detail="Từ lúc bấm gọi" />
          <Metric label="Trợ lý sẵn sàng" value={formatDuration(agentReadyMs)} detail="Từ lúc bấm gọi" />
          <Metric label="Transcript → trả lời chữ" value={formatDuration(replyMedian)} detail={"Trung vị · " + replyLatencySamples.length + " lượt"} />
          <Metric label="Agent nghĩ → bắt đầu nói" value={formatDuration(speechMedian)} detail={"Trung vị · " + speechStartSamples.length + " lượt"} />
        </div>
      </section>

      <section className={styles.pipelineSection} aria-label="Các giai đoạn xử lý giọng nói">
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>VOICE PIPELINE</span>
          <h2>Luồng xử lý</h2>
        </div>
        <div className={styles.pipeline}>
          <div><span className={styles.stageNumber}>01</span><strong>Microphone</strong><small>Trình duyệt</small></div>
          <span className={styles.pipelineArrow} aria-hidden="true">→</span>
          <div><span className={styles.stageNumber}>02</span><strong>FunASR</strong><small>Local · nhận dạng</small></div>
          <span className={styles.pipelineArrow} aria-hidden="true">→</span>
          <div><span className={styles.stageNumber}>03</span><strong>Voice agent</strong><small>Model theo cấu hình worker</small></div>
          <span className={styles.pipelineArrow} aria-hidden="true">→</span>
          <div><span className={styles.stageNumber}>04</span><strong>VieNeu</strong><small>Local · giọng nói</small></div>
        </div>
      </section>

      <footer className={styles.pageFooter}>
        <span>LOCAL VOICE TEST / SOS NOW</span>
        <span>Độ trễ transcript bắt đầu sau khi ASR gửi transcript; không bao gồm thời gian nhận dạng âm thanh.</span>
      </footer>

      <RoomAudioRenderer />
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className={styles.metricCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export default function VoiceTestClient() {
  const session = useSession(tokenSource, { agentConnectTimeoutMilliseconds: 30_000 });

  useEffect(() => {
    const room = session.room;
    return () => {
      void room.disconnect().catch(() => {});
    };
  }, [session.room]);

  return (
    <SessionProvider session={session}>
      <VoiceTestPanel />
    </SessionProvider>
  );
}
