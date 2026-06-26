import type * as vscode from "vscode";

export interface LinearTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token: string;
}

export interface StoredLinearSession extends vscode.AuthenticationSession {
  refreshToken: string;
  expiresAt: number;
}

export function isStoredLinearSession(
  value: unknown
): value is StoredLinearSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as StoredLinearSession;
  return (
    typeof session.id === "string" &&
    typeof session.accessToken === "string" &&
    typeof session.refreshToken === "string" &&
    typeof session.expiresAt === "number" &&
    Array.isArray(session.scopes) &&
    session.scopes.every((scope) => typeof scope === "string") &&
    typeof session.account?.id === "string" &&
    typeof session.account?.label === "string"
  );
}
