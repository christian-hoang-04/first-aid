import type { Metadata } from "next";
import VoiceTestClient from "./voice-test-client";

export const metadata: Metadata = {
  title: "Voice Lab · SOS NOW",
  description: "Local test bench for the Vietnamese live voice assistant.",
};

export default function VoiceTestPage() {
  return <VoiceTestClient />;
}