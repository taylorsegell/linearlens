import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  applyTokenRefresh,
  exchangeCodeForToken,
  refreshAccessToken,
  revokeToken,
  fetchViewer,
  buildAuthorizeUrl,
} from "../oauth/linearOAuth";
import { StoredLinearSession } from "../oauth/types";

describe("buildAuthorizeUrl", () => {
  it("joins scopes as comma-separated string", () => {
    const url = buildAuthorizeUrl({
      redirectUri: "vscode://linear.linear-connect/callback",
      scopes: ["read", "write"],
      state: "state-123",
    });
    expect(url).toContain("scope=read%2Cwrite");
    expect(url).toContain("state=state-123");
  });
});

describe("exchangeCodeForToken", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns token response on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 86399,
        token_type: "Bearer",
        scope: "read",
      }),
    });

    const result = await exchangeCodeForToken({
      code: "auth-code",
      redirectUri: "vscode://linear.linear-connect/callback",
    });

    expect(result.access_token).toBe("new-access");
    expect(result.refresh_token).toBe("new-refresh");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linear.app/oauth/token",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on HTTP error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: "invalid_grant" }),
    });

    await expect(
      exchangeCodeForToken({
        code: "bad",
        redirectUri: "vscode://linear.linear-connect/callback",
      })
    ).rejects.toThrow(/invalid_grant|Bad Request/);
  });
});

describe("applyTokenRefresh", () => {
  const baseSession: StoredLinearSession = {
    id: "session-1",
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAt: 1_000,
    account: { id: "u1", label: "Ada (ada@example.com)" },
    scopes: ["read"],
  };

  it("updates access token and expiry from refresh response", () => {
    const before = Date.now();
    const refreshed = applyTokenRefresh(baseSession, {
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "read",
    });

    expect(refreshed.accessToken).toBe("new-access");
    expect(refreshed.refreshToken).toBe("new-refresh");
    expect(refreshed.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(refreshed.id).toBe(baseSession.id);
    expect(refreshed.account).toEqual(baseSession.account);
  });

  it("preserves existing refresh token when omitted from response", () => {
    const refreshed = applyTokenRefresh(baseSession, {
      access_token: "new-access",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "read",
    } as Parameters<typeof applyTokenRefresh>[1]);

    expect(refreshed.accessToken).toBe("new-access");
    expect(refreshed.refreshToken).toBe("old-refresh");
  });
});

describe("refreshAccessToken", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("sends refresh_token grant", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 86399,
        token_type: "Bearer",
        scope: "read",
      }),
    });

    const result = await refreshAccessToken("old-refresh");
    expect(result.access_token).toBe("rotated-access");

    const [, init] = fetchMock.mock.calls[0];
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-refresh");
  });
});

describe("revokeToken", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("posts token to revoke endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await revokeToken("token-to-revoke");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linear.app/oauth/revoke",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("fetchViewer", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns viewer fields from GraphQL", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          viewer: { id: "u1", name: "Ada", email: "ada@example.com" },
        },
      }),
    });

    const viewer = await fetchViewer("access-token");
    expect(viewer).toEqual({
      id: "u1",
      name: "Ada",
      email: "ada@example.com",
    });
  });
});
