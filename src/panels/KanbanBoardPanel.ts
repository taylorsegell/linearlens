import * as vscode from "vscode";
import * as crypto from "node:crypto";
import type { LinearService } from "../linear/linearClient";
import { BoardCache } from "../linear/boardCache";
import {
  loadBoardViewState,
  saveBoardViewState,
} from "../linear/boardViewState";
import { getWebviewHtml } from "./getWebviewHtml";
import {
  isWebviewRequest,
  type ExtensionMessage,
} from "../webview/messaging";
import { getThemeKind, wireWebviewTheme } from "../webview/themeKind";
import type { LinearBoardIssueCard } from "../linear/types";

const cache = new BoardCache();

export class KanbanBoardPanel implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly mutationQueues = new Map<string, Promise<void>>();

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly getService: () => LinearService,
    private readonly workspaceState: vscode.Memento,
    private readonly projectId: string,
    private readonly onOpenIssue: (
      issueId: string,
      label: string,
      initialState?: { type: string; name: string }
    ) => void,
    private readonly onIssueUpdated: (issueId: string) => void,
    private readonly onDisposeCallback: () => void
  ) {
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    wireWebviewTheme(this.panel.webview, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => void this.handleMessage(msg),
      null,
      this.disposables
    );
    void this.loadBoard();
  }

  static create(
    extensionUri: vscode.Uri,
    getService: () => LinearService,
    workspaceState: vscode.Memento,
    projectId: string,
    tabLabel: string,
    iconPath: vscode.ThemeIcon,
    onOpenIssue: (
      issueId: string,
      label: string,
      initialState?: { type: string; name: string }
    ) => void,
    onIssueUpdated: (issueId: string) => void,
    onDispose: () => void
  ): KanbanBoardPanel {
    const panel = vscode.window.createWebviewPanel(
      "linear.kanbanBoard",
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

    panel.iconPath = iconPath;

    const nonce = crypto.randomBytes(16).toString("hex");
    panel.webview.html = getWebviewHtml(
      panel.webview,
      extensionUri,
      nonce,
      { panel: "board", projectId, themeKind: getThemeKind() }
    );

    return new KanbanBoardPanel(
      panel,
      getService,
      workspaceState,
      projectId,
      onOpenIssue,
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

  private async loadBoard(options?: { invalidate?: boolean }): Promise<void> {
    const service = this.getService();
    if (!service.isConfigured()) {
      this.post({ type: "mutationError", message: "Linear not connected." });
      return;
    }

    if (options?.invalidate) {
      cache.invalidate(this.projectId);
    }

    try {
      const meta = await service.fetchProjectBoardMeta(this.projectId);
      const viewState = loadBoardViewState(
        this.workspaceState,
        this.projectId
      );
      const workflowStates = await service.fetchTeamWorkflowStates(
        meta.teamId
      );

      let page;
      if (cache.getIssues(this.projectId).length === 0) {
        page = await service.fetchProjectBoardPage(this.projectId);
        cache.appendPage(this.projectId, page);
      } else {
        page = {
          issues: cache.getIssues(this.projectId),
          hasNextPage: cache.hasNextPage(this.projectId),
          endCursor: cache.getCursor(this.projectId),
        };
      }

      this.post({
        type: "boardLoaded",
        meta,
        workflowStates,
        viewState,
        page,
      });
      this.panel.title = `${meta.name} · Board`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load board.";
      this.post({ type: "mutationError", message });
    }
  }

  private async loadMore(cursor?: string): Promise<void> {
    const service = this.getService();
    const page = await service.fetchProjectBoardPage(this.projectId, cursor);
    cache.appendPage(this.projectId, page, { append: true });
    this.post({ type: "boardPageLoaded", page, append: true });
  }

  private enqueueMutation(issueId: string, run: () => Promise<void>): void {
    const prev = this.mutationQueues.get(issueId) ?? Promise.resolve();
    const next = prev.then(run).catch(() => undefined);
    this.mutationQueues.set(issueId, next);
  }

  private patchBoardIssue(issue: LinearBoardIssueCard): void {
    cache.patchIssue(this.projectId, issue);
    this.post({ type: "boardIssueUpdated", issue });
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
      case "refreshBoard":
        await this.loadBoard({ invalidate: raw.type === "refreshBoard" });
        return;

      case "loadBoardPage":
        await this.loadMore(raw.cursor);
        return;

      case "saveBoardViewState":
        await saveBoardViewState(
          this.workspaceState,
          raw.projectId,
          raw.viewState
        );
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

      case "openExternal":
        await vscode.env.openExternal(vscode.Uri.parse(raw.url));
        return;

      case "moveIssue": {
        const previous = cache
          .getIssues(this.projectId)
          .find((issue) => issue.id === raw.issueId);
        const previousStateId = previous?.state.id;

        if (previous) {
          this.patchBoardIssue({
            ...previous,
            state: {
              ...previous.state,
              id: raw.stateId,
              name: previous.state.name,
            },
          });
        }

        this.enqueueMutation(raw.issueId, async () => {
          try {
            const updated = await service.updateIssue(raw.issueId, {
              stateId: raw.stateId,
            });
            const card: LinearBoardIssueCard = {
              id: updated.id,
              identifier: updated.identifier,
              title: updated.title,
              url: updated.url,
              updatedAt: updated.updatedAt,
              createdAt: updated.updatedAt,
              priority: updated.priority,
              priorityLabel: updated.priorityLabel,
              state: updated.state,
              assignee: updated.assignee,
              labels: updated.labels,
              milestone: updated.milestone,
            };
            this.patchBoardIssue(card);
            this.onIssueUpdated(updated.id);
          } catch (error) {
            if (previous && previousStateId) {
              this.post({
                type: "boardMoveFailed",
                issueId: raw.issueId,
                previousStateId,
                message:
                  error instanceof Error ? error.message : "Move failed.",
              });
            }
          }
        });
        return;
      }
    }
  }

  dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
    this.onDisposeCallback();
  }
}
