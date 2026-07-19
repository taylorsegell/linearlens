import * as vscode from "vscode";
import * as crypto from "node:crypto";
import type { LinearService } from "../linear/linearClient";
import { ProjectDetailCache } from "../linear/projectCache";
import { projectIcon } from "../linear/stateColors";
import { getWebviewHtml } from "./getWebviewHtml";
import {
  isWebviewRequest,
  type ExtensionMessage,
} from "../webview/messaging";
import { getThemeKind, wireWebviewTheme } from "../webview/themeKind";

const cache = new ProjectDetailCache();

export class ProjectDetailPanel implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly mutationQueues = new Map<string, Promise<void>>();

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly getService: () => LinearService,
    private readonly projectId: string,
    private readonly onOpenIssue: (
      issueId: string,
      label: string,
      initialState?: { type: string; name: string }
    ) => void,
    private readonly onOpenBoard: (projectId: string, tabLabel: string) => void,
    private readonly onDisposeCallback: () => void
  ) {
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    wireWebviewTheme(this.panel.webview, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => void this.handleMessage(msg),
      null,
      this.disposables
    );
    void this.loadProject();
  }

  static create(
    extensionUri: vscode.Uri,
    getService: () => LinearService,
    projectId: string,
    tabLabel: string,
    onOpenIssue: (
      issueId: string,
      label: string,
      initialState?: { type: string; name: string }
    ) => void,
    onOpenBoard: (projectId: string, tabLabel: string) => void,
    onDispose: () => void
  ): ProjectDetailPanel {
    const panel = vscode.window.createWebviewPanel(
      "linear.projectDetail",
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

    panel.iconPath = projectIcon();

    const nonce = crypto.randomBytes(16).toString("hex");
    panel.webview.html = getWebviewHtml(
      panel.webview,
      extensionUri,
      nonce,
      { panel: "project", projectId, themeKind: getThemeKind() }
    );

    return new ProjectDetailPanel(
      panel,
      getService,
      projectId,
      onOpenIssue,
      onOpenBoard,
      onDispose
    );
  }

  reveal(): void {
    this.panel.reveal();
  }

  private post(message: ExtensionMessage): void {
    void this.panel.webview.postMessage(message);
  }

  private async loadProject(): Promise<void> {
    const service = this.getService();
    if (!service.isConfigured()) {
      this.post({ type: "mutationError", message: "Linear not connected." });
      return;
    }

    try {
      const project = await cache.getOrFetch(this.projectId, () =>
        service.fetchProjectDetail(this.projectId)
      );
      this.post({ type: "projectLoaded", project });
      this.panel.title = project.name;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load project.";
      this.post({ type: "mutationError", message });
    }
  }

  private enqueueMutation(run: () => Promise<void>): void {
    const prev =
      this.mutationQueues.get(this.projectId) ?? Promise.resolve();
    const next = prev.then(run).catch(() => undefined);
    this.mutationQueues.set(this.projectId, next);
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
      case "refreshProject":
        cache.invalidate(this.projectId);
        await this.loadProject();
        return;

      case "openExternal":
        await vscode.env.openExternal(vscode.Uri.parse(raw.url));
        return;

      case "openIssue":
        this.onOpenIssue(
          raw.issueId,
          raw.label,
          raw.stateType && raw.stateName
            ? { type: raw.stateType, name: raw.stateName }
            : undefined
        );
        return;

      case "openBoard":
        this.onOpenBoard(raw.projectId, raw.label);
        return;

      case "updateProject":
        this.enqueueMutation(async () => {
          try {
            const project = await service.updateProject(
              raw.projectId,
              raw.patch
            );
            cache.set(project);
            this.post({ type: "projectUpdated", project });
            this.panel.title = project.name;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Update failed.";
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
