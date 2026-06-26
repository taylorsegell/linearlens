import * as vscode from "vscode";
import { scopesKey, scopesMatch } from "./oauth/scopes";
import {
  applyTokenRefresh,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchViewer,
  refreshAccessToken,
  revokeToken,
  shouldRefreshToken,
  tokenExpiresAt,
} from "./oauth/linearOAuth";
import {
  parseStoredSessions,
  serializeStoredSessions,
} from "./oauth/sessionStorage";
import { sessionChanged } from "./oauth/sessionChanged";
import { StoredLinearSession } from "./oauth/types";

const OAUTH_REDIRECT_URL = `${vscode.env.uriScheme}://linear.linear-connect/callback`;
const SECRET_STORAGE_KEY = "linear.auth";

type SessionMap = Record<string, StoredLinearSession>;

export class LinearAuthenticationProvider
  implements vscode.AuthenticationProvider, vscode.Disposable
{
  constructor(private readonly context: vscode.ExtensionContext) {
    this.sessionsPromise = this.getSessions();

    this.disposable = vscode.Disposable.from(
      vscode.window.registerUriHandler(this.uriEventHandler),
      vscode.authentication.registerAuthenticationProvider(
        "linear",
        "Linear",
        this,
        { supportsMultipleAccounts: false }
      ),
      this.context.secrets.onDidChange(() => this.checkForUpdates())
    );
  }

  public dispose() {
    this.disposable.dispose();
  }

  public get onDidChangeSessions() {
    return this.sessionChangeEmitter.event;
  }

  public async getSessions(
    scopes?: string[],
    _options?: vscode.AuthenticationGetSessionOptions
  ): Promise<vscode.AuthenticationSession[]> {
    const sessions = await this.loadAndRefreshSessions();
    if (!scopes || scopes.length === 0) {
      return sessions.map(toAuthenticationSession);
    }

    return sessions
      .filter((session) => scopesMatch(session.scopes, scopes))
      .map(toAuthenticationSession);
  }

  public async createSession(
    scopes: string[]
  ): Promise<vscode.AuthenticationSession> {
    const existingSession = await this.retrieveSession(scopes);
    if (existingSession) {
      const refreshed = await this.refreshSessionIfNeeded(existingSession);
      if (sessionChanged(existingSession, refreshed)) {
        await this.storeSession(scopes, refreshed);
        this.sessionChangeEmitter.fire({
          added: [],
          removed: [],
          changed: [toAuthenticationSession(refreshed)],
        });
      }
      return toAuthenticationSession(refreshed);
    }

    const tokens = await this.login(scopes);
    const viewer = await fetchViewer(tokens.access_token);

    const session: StoredLinearSession = {
      id: crypto.randomUUID(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokenExpiresAt(tokens.expires_in),
      account: {
        label: `${viewer.name} (${viewer.email})`,
        id: viewer.id,
      },
      scopes: [...scopes],
    };

    await this.storeSession(scopes, session);

    this.sessionChangeEmitter.fire({
      added: [toAuthenticationSession(session)],
      removed: [],
      changed: [],
    });

    return toAuthenticationSession(session);
  }

  public async removeSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.readSessions();
      for (const [key, session] of Object.entries(sessions)) {
        if (session.id !== sessionId) {
          continue;
        }

        await revokeToken(session.accessToken).catch((err) =>
          console.error("Failed to revoke token", err)
        );
        await revokeToken(session.refreshToken).catch((err) =>
          console.error("Failed to revoke token", err)
        );

        const loggedOutSession = { ...session };
        delete sessions[key];
        await this.writeSessions(sessions);

        this.sessionChangeEmitter.fire({
          added: [],
          removed: [toAuthenticationSession(loggedOutSession)],
          changed: [],
        });
        return;
      }

      throw new LinearAuthenticationProviderError(
        `Session ${sessionId} not found`
      );
    } catch (error) {
      this.error(`Log out of Linear failed: ${error}`, {
        userPresentableMessage: "Logging out of Linear failed",
      });
      throw error;
    }
  }

  private async login(scopes: string[]) {
    const state = crypto.randomUUID();
    const authorizeUri = vscode.Uri.parse(
      buildAuthorizeUrl({
        redirectUri: OAUTH_REDIRECT_URL,
        scopes,
        state,
      })
    );

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Signing in to Linear...",
        cancellable: true,
      },
      async (_progress, token) => {
        await vscode.env.openExternal(authorizeUri);

        let subscription: vscode.Disposable | undefined;
        const codeExchangePromise = new Promise<
          Awaited<ReturnType<typeof exchangeCodeForToken>>
        >((resolve, reject) => {
          subscription = this.uriEventHandler.event((uri) => {
            void this.handleOAuthCallback(state, uri).then(resolve).catch(reject);
          });
          token.onCancellationRequested(() => {
            reject(new LinearAuthenticationProviderError("Cancelled"));
          });
        });

        try {
          return await Promise.race([
            codeExchangePromise,
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new LinearAuthenticationProviderError("Timed out")),
                60_000
              )
            ),
          ]);
        } finally {
          subscription?.dispose();
        }
      }
    );
  }

  private async handleOAuthCallback(state: string, uri: vscode.Uri) {
    const query = new URLSearchParams(uri.query);
    const code = query.get("code");
    const callbackState = query.get("state");

    if (!code) {
      throw new LinearAuthenticationProviderError("No authorization code");
    }

    if (state !== callbackState) {
      throw new LinearAuthenticationProviderError("OAuth state mismatch");
    }

    return exchangeCodeForToken({
      code,
      redirectUri: OAUTH_REDIRECT_URL,
    });
  }

  private async loadAndRefreshSessions(): Promise<StoredLinearSession[]> {
    const sessions = await this.readSessions();
    const refreshedSessions: StoredLinearSession[] = [];
    const changed: vscode.AuthenticationSession[] = [];
    let dirty = false;

    for (const [key, session] of Object.entries(sessions)) {
      const refreshed = await this.refreshSessionIfNeeded(session);
      refreshedSessions.push(refreshed);
      if (sessionChanged(session, refreshed)) {
        sessions[key] = refreshed;
        dirty = true;
        changed.push(toAuthenticationSession(refreshed));
      }
    }

    if (dirty) {
      await this.writeSessions(sessions);
      if (changed.length) {
        this.sessionChangeEmitter.fire({ added: [], removed: [], changed });
      }
    }

    return refreshedSessions;
  }

  private async refreshSessionIfNeeded(
    session: StoredLinearSession
  ): Promise<StoredLinearSession> {
    if (!shouldRefreshToken(session.expiresAt)) {
      return session;
    }

    const tokens = await refreshAccessToken(session.refreshToken);
    return applyTokenRefresh(session, tokens);
  }

  private async checkForUpdates() {
    const previousSessions = await this.sessionsPromise;
    this.sessionsPromise = this.getSessions();
    const storedSessions = await this.sessionsPromise;

    const added: vscode.AuthenticationSession[] = [];
    const removed: vscode.AuthenticationSession[] = [];

    for (const storedSession of storedSessions) {
      if (!previousSessions.find((s) => s.id === storedSession.id)) {
        added.push(storedSession);
      }
    }

    for (const previousSession of previousSessions) {
      if (!storedSessions.find((s) => s.id === previousSession.id)) {
        removed.push(previousSession);
      }
    }

    if (added.length || removed.length) {
      this.sessionChangeEmitter.fire({ added, removed, changed: [] });
    }
  }

  private async readSessions(): Promise<SessionMap> {
    const raw = await this.context.secrets.get(SECRET_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    try {
      return parseStoredSessions(raw);
    } catch (error) {
      console.error("Could not load valid data from secrets store", error);
      await this.context.secrets.delete(SECRET_STORAGE_KEY);
      return {};
    }
  }

  private async writeSessions(sessions: SessionMap): Promise<void> {
    this.sessionsPromise = Promise.resolve(
      Object.values(sessions).map(toAuthenticationSession)
    );
    await this.context.secrets.store(
      SECRET_STORAGE_KEY,
      serializeStoredSessions(sessions)
    );
  }

  private async storeSession(
    scopes: string[],
    session: StoredLinearSession
  ): Promise<void> {
    const sessions = await this.readSessions();
    sessions[scopesKey(scopes)] = session;
    await this.writeSessions(sessions);
  }

  private async retrieveSession(
    scopes: string[]
  ): Promise<StoredLinearSession | undefined> {
    const sessions = await this.readSessions();
    return sessions[scopesKey(scopes)];
  }

  private error(
    message: string,
    options?: { userPresentableMessage?: string }
  ) {
    console.error(message);
    vscode.window.showErrorMessage(options?.userPresentableMessage || message);
  }

  private sessionChangeEmitter =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  private disposable: vscode.Disposable;
  private sessionsPromise: Promise<vscode.AuthenticationSession[]>;
  private uriEventHandler = new UriEventHandler();
}

function toAuthenticationSession(
  session: StoredLinearSession
): vscode.AuthenticationSession {
  return {
    id: session.id,
    accessToken: session.accessToken,
    account: session.account,
    scopes: session.scopes,
  };
}

class UriEventHandler
  extends vscode.EventEmitter<vscode.Uri>
  implements vscode.UriHandler
{
  public handleUri(uri: vscode.Uri) {
    this.fire(uri);
  }
}

export class LinearAuthenticationProviderError extends Error {}
