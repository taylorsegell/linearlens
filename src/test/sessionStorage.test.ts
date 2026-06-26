import { describe, it, expect } from "vitest";
import {
  parseStoredSessions,
  serializeStoredSessions,
} from "../oauth/sessionStorage";

const validSession = {
  id: "session-1",
  accessToken: "access-abc",
  refreshToken: "refresh-xyz",
  expiresAt: Date.now() + 86_400_000,
  account: { id: "user-1", label: "Ada (ada@example.com)" },
  scopes: ["read"],
};

describe("parseStoredSessions", () => {
  it("parses valid stored sessions", () => {
    const raw = serializeStoredSessions({ read: validSession });
    const parsed = parseStoredSessions(raw);
    expect(parsed.read.accessToken).toBe("access-abc");
    expect(parsed.read.refreshToken).toBe("refresh-xyz");
  });

  it("throws on legacy session without refreshToken", () => {
    const legacy = {
      read: {
        id: "old",
        accessToken: "token",
        account: { id: "u", label: "User" },
        scopes: ["read"],
      },
    };
    expect(() => parseStoredSessions(JSON.stringify(legacy))).toThrow(
      /refreshToken/
    );
  });

  it("throws on corrupted JSON", () => {
    expect(() => parseStoredSessions("{not-json")).toThrow();
  });
});
