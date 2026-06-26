import * as vscode from "vscode";
import type { LinearService } from "../linear/linearClient";
import { IssueDetailPanel } from "./IssueDetailPanel";

export function panelKey(kind: "issue", id: string): string {
  return `${kind}:${id}`;
}

export class PanelManager implements vscode.Disposable {
  private readonly panels = new Map<string, IssueDetailPanel>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly getService: () => LinearService,
    private readonly onIssueUpdated: (issueId: string) => void
  ) {}

  openIssue(issueId: string, tabLabel: string): void {
    const key = panelKey("issue", issueId);
    const existing = this.panels.get(key);
    if (existing) {
      existing.reveal();
      return;
    }

    const panel = IssueDetailPanel.create(
      this.extensionUri,
      this.getService,
      issueId,
      tabLabel,
      (updatedIssueId) => {
        this.onIssueUpdated(updatedIssueId);
      },
      () => {
        this.panels.delete(key);
      }
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
