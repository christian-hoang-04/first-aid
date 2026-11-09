import type { Metadata } from "next";
import LiveVoiceLabClient from "./live-voice-lab-client";

export const metadata: Metadata = {
  title: "Live Voice Lab · SOS NOW",
  description: "Local Vietnamese speech recognition and synthesis experiment.",
};

export default function LiveVoiceLabPage() {
  return <LiveVoiceLabClient />;
}
