import { LinearTokenResponse, StoredLinearSession } from "./types";

export const OAUTH_CLIENT_ID = "3117bb53c858872ff5cd4f9e0b3d0b5d";
export const OAUTH_CLIENT_SECRET = "2cafd5d87b5fab6937ea3e157504dbd3";
export const OAUTH_AUTHORIZE_URL = "https://linear.app/oauth/authorize";
export const OAUTH_TOKEN_URL = "https://api.linear.app/oauth/token";
export const OAUTH_REVOKE_URL = "https://api.linear.app/oauth/revoke";

const TOKEN_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/x-www-form-urlencoded",
};

async function readTokenError(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as {
      error?: string;
      error_description?: string;
    };
    if (json.error_description) {
      return json.error_description;
    }
    if (json.error) {
      return json.error;
    }
  } catch {
    // fall through
  }
  return response.statusText;
}

export function buildAuthorizeUrl(params: {
  redirectUri: string;
  scopes: readonly string[];
  state: string;
}): string {
  const searchParams = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: params.scopes.join(","),
    state: params.state,
    prompt: "consent",
  });

  return `${OAUTH_AUTHORIZE_URL}?${searchParams.toString()}`;
}

export async function exchangeCodeForToken(params: {
  code: string;
  redirectUri: string;
}): Promise<LinearTokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET,
    grant_type: "authorization_code",
  });

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: TOKEN_HEADERS,
    body,
  });

  if (!response.ok) {
    throw new Error(await readTokenError(response));
  }

  return (await response.json()) as LinearTokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<LinearTokenResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET,
  });

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: TOKEN_HEADERS,
    body,
  });

  if (!response.ok) {
    throw new Error(await readTokenError(response));
  }

  return (await response.json()) as LinearTokenResponse;
}

export async function revokeToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token });

  const response = await fetch(OAUTH_REVOKE_URL, {
    method: "POST",
    headers: TOKEN_HEADERS,
    body,
  });

  if (!response.ok && response.status !== 400) {
    throw new Error(await readTokenError(response));
  }
}

export async function fetchViewer(accessToken: string): Promise<{
  id: string;
  name: string;
  email: string;
}> {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "{ viewer { id name email } }",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Linear viewer: ${response.statusText}`);
  }

  const json = (await response.json()) as {
    data?: { viewer?: { id: string; name: string; email: string } };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length || !json.data?.viewer) {
    throw new Error(
      json.errors?.[0]?.message ?? "Linear viewer missing from GraphQL response"
    );
  }

  return json.data.viewer;
}

export function tokenExpiresAt(expiresInSeconds: number): number {
  return Date.now() + expiresInSeconds * 1000;
}

export function applyTokenRefresh(
  session: StoredLinearSession,
  tokens: LinearTokenResponse
): StoredLinearSession {
  return {
    ...session,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? session.refreshToken,
    expiresAt: tokenExpiresAt(tokens.expires_in),
  };
}

export const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export function shouldRefreshToken(expiresAt: number, now = Date.now()): boolean {
  return expiresAt - REFRESH_BUFFER_MS <= now;
}
