import * as vscode from "vscode";
import * as crypto from "node:crypto";
import type { LinearService } from "../linear/linearClient";
import { IssueDetailCache } from "../linear/issueCache";
import { getWebviewHtml } from "./getWebviewHtml";
import {
  isWebviewRequest,
  type ExtensionMessage,
} from "../webview/messaging";

const cache = new IssueDetailCache();

export class IssueDetailPanel implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly mutationQueues = new Map<string, Promise<void>>();

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly getService: () => LinearService,
    private readonly issueId: string,
    private readonly onIssueUpdated: (issueId: string) => void,
    private readonly onDisposeCallback: () => void
  ) {
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => void this.handleMessage(msg),
      null,
      this.disposables
    );
    void this.loadIssue();
  }

  static create(
    extensionUri: vscode.Uri,
    getService: () => LinearService,
    issueId: string,
    tabLabel: string,
    onIssueUpdated: (issueId: string) => void,
    onDispose: () => void
  ): IssueDetailPanel {
    const panel = vscode.window.createWebviewPanel(
      "linear.issueDetail",
      tabLabel,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist", "webview"),
        ],
      }
    );

    const nonce = crypto.randomBytes(16).toString("hex");
    panel.webview.html = getWebviewHtml(
      panel.webview,
      extensionUri,
      nonce,
      { panel: "issue", issueId }
    );

    return new IssueDetailPanel(
      panel,
      getService,
      issueId,
      onIssueUpdated,
      onDispose
    );
  }

  reveal(): void {
    this.panel.reveal();
  }

  private post(message: ExtensionMessage): void {
    void this.panel.webview.postMessage(message);
  }

  private async loadIssue(): Promise<void> {
    const service = this.getService();
    if (!service.isConfigured()) {
      this.post({ type: "mutationError", message: "Linear not connected." });
      return;
    }

    try {
      const issue = await cache.getOrFetch(this.issueId, () =>
        service.fetchIssueDetail(this.issueId)
      );
      const workflowStates = await service.fetchTeamWorkflowStates(
        issue.teamId
      );
      this.post({ type: "issueLoaded", issue, workflowStates });
      this.panel.title = `${issue.identifier}`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load issue.";
      this.post({ type: "mutationError", message });
    }
  }

  private enqueueMutation(run: () => Promise<void>): void {
    const prev =
      this.mutationQueues.get(this.issueId) ?? Promise.resolve();
    const next = prev.then(run).catch(() => undefined);
    this.mutationQueues.set(this.issueId, next);
  }

  private async handleMessage(raw: unknown): Promise<void> {
    if (!isWebviewRequest(raw)) {
      return;
    }

    const service = this.getService();
    if (!service.isConfigured()) {
      this.post({ type: "mutationError", message: "Linear not connected." });
      return;
    }

    switch (raw.type) {
      case "ready":
      case "refresh":
        cache.invalidate(this.issueId);
        await this.loadIssue();
        return;

      case "openExternal":
        await vscode.env.openExternal(vscode.Uri.parse(raw.url));
        return;

      case "updateIssue":
        this.enqueueMutation(async () => {
          try {
            const issue = await service.updateIssue(raw.issueId, raw.patch);
            cache.set(issue);
            this.post({ type: "issueUpdated", issue });
            this.onIssueUpdated(issue.id);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Update failed.";
            this.post({ type: "mutationError", message });
          }
        });
        return;

      case "createComment":
        this.enqueueMutation(async () => {
          try {
            const issue = await service.createComment(
              raw.issueId,
              raw.body
            );
            cache.set(issue);
            this.post({ type: "issueUpdated", issue });
            this.onIssueUpdated(issue.id);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Comment failed.";
            this.post({ type: "mutationError", message });
          }
        });
        return;
    }
  }

  dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
    this.onDisposeCallback();
  }
}
