import { describe, it, expect } from "vitest";
import { sessionChanged } from "../oauth/sessionChanged";
import {
  shouldRefreshToken,
  tokenExpiresAt,
  REFRESH_BUFFER_MS,
} from "../oauth/linearOAuth";
import type { StoredLinearSession } from "../oauth/types";

function makeSession(
  overrides: Partial<StoredLinearSession> = {}
): StoredLinearSession {
  return {
    id: "session-1",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: Date.now() + 86_400_000,
    account: { id: "user-1", label: "User (user@example.com)" },
    scopes: ["read"],
    ...overrides,
  };
}

describe("shouldRefreshToken", () => {
  it("returns true when within refresh buffer", () => {
    const now = Date.now();
    const expiresAt = now + REFRESH_BUFFER_MS - 1_000;
    expect(shouldRefreshToken(expiresAt, now)).toBe(true);
  });

  it("returns false when token is fresh", () => {
    const now = Date.now();
    const expiresAt = tokenExpiresAt(86_399);
    expect(shouldRefreshToken(expiresAt, now)).toBe(false);
  });
});

describe("sessionChanged", () => {
  it("returns false when session tokens are unchanged", () => {
    const session = makeSession();
    expect(sessionChanged(session, { ...session })).toBe(false);
  });

  it("returns true when accessToken changes", () => {
    const before = makeSession();
    const after = makeSession({ accessToken: "new-access-token" });
    expect(sessionChanged(before, after)).toBe(true);
  });

  it("returns true when refreshToken changes", () => {
    const before = makeSession();
    const after = makeSession({ refreshToken: "new-refresh-token" });
    expect(sessionChanged(before, after)).toBe(true);
  });

  it("returns true when expiresAt changes", () => {
    const before = makeSession();
    const after = makeSession({ expiresAt: before.expiresAt + 1 });
    expect(sessionChanged(before, after)).toBe(true);
  });
});
