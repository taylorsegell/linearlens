import { isStoredLinearSession, StoredLinearSession } from "./types";

export function parseStoredSessions(
  json: string
): Record<string, StoredLinearSession> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid session storage JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid session storage shape");
  }

  const sessions = parsed as Record<string, unknown>;
  for (const [key, value] of Object.entries(sessions)) {
    if (!isStoredLinearSession(value)) {
      throw new Error(
        `Invalid stored session at key "${key}" — refreshToken required`
      );
    }
  }

  return sessions as Record<string, StoredLinearSession>;
}

export function serializeStoredSessions(
  sessions: Record<string, StoredLinearSession>
): string {
  return JSON.stringify(sessions);
}
