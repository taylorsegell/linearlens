import * as vscode from "vscode";
import type { LinearService } from "../linear/linearClient";
import { IssueDetailPanel } from "./IssueDetailPanel";
import { KanbanBoardPanel } from "./KanbanBoardPanel";

export function panelKey(kind: "issue" | "board", id: string): string {
  return `${kind}:${id}`;
}

type ManagedPanel = IssueDetailPanel | KanbanBoardPanel;

export class PanelManager implements vscode.Disposable {
  private readonly panels = new Map<string, ManagedPanel>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly workspaceState: vscode.Memento,
    private readonly getService: () => LinearService,
    private readonly onIssueUpdated: (issueId: string) => void
  ) {}

  openIssue(issueId: string, tabLabel: string): void {
    const key = panelKey("issue", issueId);
    const existing = this.panels.get(key);
    if (existing && existing instanceof IssueDetailPanel) {
      existing.reveal();
      return;
    }

    const panel = IssueDetailPanel.create(
      this.extensionUri,
      this.getService,
      issueId,
      tabLabel,
      (updatedIssueId) => this.onIssueUpdated(updatedIssueId),
      () => this.panels.delete(key)
    );
    this.panels.set(key, panel);
  }

  openBoard(projectId: string, tabLabel: string): void {
    const key = panelKey("board", projectId);
    const existing = this.panels.get(key);
    if (existing && existing instanceof KanbanBoardPanel) {
      existing.reveal();
      return;
    }

    const panel = KanbanBoardPanel.create(
      this.extensionUri,
      this.getService,
      this.workspaceState,
      projectId,
      tabLabel,
      (issueId, label) => this.openIssue(issueId, label),
      (issueId) => this.onIssueUpdated(issueId),
      () => this.panels.delete(key)
    );
    this.panels.set(key, panel);
  }

  dispose(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
  }
}
