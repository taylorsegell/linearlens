import * as vscode from "vscode";
import type { LinearService } from "../linear/linearClient";
import {
  projectIcon,
} from "../linear/stateColors";
import { IssueDetailPanel } from "./IssueDetailPanel";
import { KanbanBoardPanel } from "./KanbanBoardPanel";
import { ProjectDetailPanel } from "./ProjectDetailPanel";

export function panelKey(
  kind: "issue" | "board" | "project",
  id: string
): string {
  return `${kind}:${id}`;
}

type ManagedPanel =
  | IssueDetailPanel
  | KanbanBoardPanel
  | ProjectDetailPanel;

export class PanelManager implements vscode.Disposable {
  private readonly panels = new Map<string, ManagedPanel>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly workspaceState: vscode.Memento,
    private readonly getService: () => LinearService,
    private readonly onIssueUpdated: (issueId: string) => void
  ) {}

  openIssue(
    issueId: string,
    tabLabel: string,
    initialState?: { type: string; name: string }
  ): void {
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
      initialState,
      (childId, label, state) => this.openIssue(childId, label, state),
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
      projectIcon(),
      (issueId, label, state) => this.openIssue(issueId, label, state),
      (issueId) => this.onIssueUpdated(issueId),
      () => this.panels.delete(key)
    );
    this.panels.set(key, panel);
  }

  openProject(projectId: string, tabLabel: string): void {
    const key = panelKey("project", projectId);
    const existing = this.panels.get(key);
    if (existing && existing instanceof ProjectDetailPanel) {
      existing.reveal();
      return;
    }

    const panel = ProjectDetailPanel.create(
      this.extensionUri,
      this.getService,
      projectId,
      tabLabel,
      (childId, label, state) => this.openIssue(childId, label, state),
      (id, label) => this.openBoard(id, label),
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
