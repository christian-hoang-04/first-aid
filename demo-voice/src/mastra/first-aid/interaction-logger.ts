const LOG_PREFIX = "[voice-interaction]"

export function shortenInteractionText(text: string, limit = 4000) {
  return text.length > limit ? `${text.slice(0, limit)}… [truncated]` : text
}

export function interactionErrorText(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return String(error)
}

/** Write a structured, text-only event to the voice worker's stdout. Nothing is persisted to disk. */
export function logVoiceInteraction(event: string, details: Record<string, unknown>, at = Date.now()) {
  const entry = {
    timestamp: new Date(at).toISOString(),
    event,
    ...details,
  }
  console.info(`${LOG_PREFIX} ${JSON.stringify(entry)}`)
}
