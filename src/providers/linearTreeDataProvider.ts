/**
 * Sidebar tree data provider — lazy-loads Issues, Projects, Initiatives, Reviews.
 */

import * as vscode from "vscode";
import {
  CMD_OPEN_ISSUE,
  CMD_OPEN_PROJECT_BOARD,
  LINEAR_SECTIONS,
  type LinearSectionId,
} from "../config";
import {
  applyIssueFilters,
  DEFAULT_ISSUE_FILTERS,
  formatFilterMessage,
  loadIssueFilters,
  saveIssueFilters,
  type IssueFilters,
} from "../linear/issueFilters";
import { LinearService } from "../linear/linearClient";
import {
  groupIssuesByState,
  issueStateIcon,
  projectIcon,
  statusGroupIcon,
} from "../linear/stateColors";
import type {
  LinearInitiativeSummary,
  LinearIssueSummary,
  LinearProjectSummary,
  LinearReviewSummary,
} from "../linear/types";

export enum LinearTreeItemKind {
  Section = "section",
  IssueStatusGroup = "issueStatusGroup",
  Loading = "loading",
  Error = "error",
  Empty = "empty",
  Hint = "hint",
  Issue = "issue",
  Project = "project",
  Initiative = "initiative",
  Review = "review",
}

export class LinearTreeItem extends vscode.TreeItem {
  issue?: LinearIssueSummary;
  review?: LinearReviewSummary;
  statusGroup?: {
    state: string;
    stateType: string;
    stateColor: string;
    issues: LinearIssueSummary[];
  };

  constructor(
    public readonly kind: LinearTreeItemKind,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly sectionId?: LinearSectionId,
    public readonly url?: string,
    public readonly tooltipText?: string
  ) {
    super(label, collapsibleState);

    if (url) {
      this.command = {
        command: "vscode.open",
        title: "Open in Linear",
        arguments: [vscode.Uri.parse(url)],
      };
    }

    if (tooltipText) {
      this.tooltip = tooltipText;
    }
  }
}

type SectionCacheEntry =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | {
      state: "loaded";
      items:
        | LinearIssueSummary[]
        | LinearProjectSummary[]
        | LinearInitiativeSummary[]
        | LinearReviewSummary[];
    };

function initiativeIcon(): vscode.ThemeIcon {
  return new vscode.ThemeIcon("rocket");
}

function reviewIcon(review: LinearReviewSummary): vscode.ThemeIcon {
  return review.status === "Unread"
    ? new vscode.ThemeIcon("git-pull-request-create")
    : new vscode.ThemeIcon("git-pull-request");
}

export class LinearTreeDataProvider
  implements vscode.TreeDataProvider<LinearTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    LinearTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly _onDidChangeFilters = new vscode.EventEmitter<IssueFilters>();
  readonly onDidChangeFilters = this._onDidChangeFilters.event;

  private readonly cache = new Map<LinearSectionId, SectionCacheEntry>();
  private readonly expandedSections = new Set<LinearSectionId>();
  private issueFilters: IssueFilters;

  constructor(
    private linearService: LinearService,
    private readonly workspaceState: vscode.Memento
  ) {
    this.issueFilters = loadIssueFilters(workspaceState);
  }

  setService(service: LinearService): void {
    this.linearService = service;
  }

  getIssueFilters(): IssueFilters {
    return { ...this.issueFilters };
  }

  getFilterMessage(): string | undefined {
    return formatFilterMessage(this.issueFilters);
  }

  getCachedIssues(): LinearIssueSummary[] {
    const entry = this.cache.get("issues");
    if (!entry || entry.state !== "loaded") {
      return [];
    }
    return entry.items as LinearIssueSummary[];
  }

  getCachedSection(sectionId: LinearSectionId) {
    const entry = this.cache.get(sectionId);
    return entry?.state === "loaded" ? entry.items : undefined;
  }

  async ensureIssuesCached(): Promise<LinearIssueSummary[]> {
    const entry = this.cache.get("issues");
    if (entry?.state === "loaded") {
      return entry.items as LinearIssueSummary[];
    }
    this.expandedSections.add("issues");
    await this.loadSection("issues");
    return this.getCachedIssues();
  }

  async setIssueFilters(filters: IssueFilters): Promise<void> {
    this.issueFilters = filters;
    await saveIssueFilters(this.workspaceState, filters);
    this._onDidChangeFilters.fire(this.issueFilters);
    this._onDidChangeTreeData.fire(undefined);
  }

  async clearIssueFilters(): Promise<void> {
    await this.setIssueFilters({ ...DEFAULT_ISSUE_FILTERS });
  }

  refresh(): void {
    this.cache.clear();
    for (const sectionId of this.expandedSections) {
      void this.loadSection(sectionId);
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  markSectionExpanded(sectionId: LinearSectionId): void {
    this.expandedSections.add(sectionId);
    const entry = this.cache.get(sectionId);
    if (!entry || entry.state === "idle") {
      void this.loadSection(sectionId);
    }
  }

  clearAll(): void {
    this.cache.clear();
    this.expandedSections.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  patchCachedIssue(
    issueId: string,
    patch: Partial<LinearIssueSummary>
  ): void {
    const entry = this.cache.get("issues");
    if (!entry || entry.state !== "loaded") {
      return;
    }
    const items = entry.items as LinearIssueSummary[];
    const index = items.findIndex((i) => i.id === issueId);
    if (index === -1) {
      return;
    }
    items[index] = { ...items[index], ...patch };
    this.cache.set("issues", { state: "loaded", items });
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: LinearTreeItem): vscode.TreeItem {
    switch (element.kind) {
      case LinearTreeItemKind.Section: {
        const meta = LINEAR_SECTIONS.find((s) => s.id === element.sectionId);
        element.iconPath = new vscode.ThemeIcon(meta?.icon ?? "folder");
        break;
      }
      case LinearTreeItemKind.IssueStatusGroup:
        if (element.statusGroup) {
          element.iconPath = statusGroupIcon(
            element.statusGroup.state,
            element.statusGroup.stateType,
            element.statusGroup.stateColor
          );
        }
        break;
      case LinearTreeItemKind.Loading:
        element.iconPath = new vscode.ThemeIcon("loading~spin");
        break;
      case LinearTreeItemKind.Error:
        element.iconPath = new vscode.ThemeIcon("error");
        break;
      case LinearTreeItemKind.Empty:
      case LinearTreeItemKind.Hint:
        element.iconPath = new vscode.ThemeIcon("info");
        break;
      case LinearTreeItemKind.Issue:
        if (element.issue) {
          element.iconPath = issueStateIcon(element.issue);
        } else {
          element.iconPath = new vscode.ThemeIcon("issue-open");
        }
        break;
      case LinearTreeItemKind.Project:
        element.iconPath = projectIcon();
        break;
      case LinearTreeItemKind.Initiative:
        element.iconPath = initiativeIcon();
        break;
      case LinearTreeItemKind.Review:
        if (element.review) {
          element.iconPath = reviewIcon(element.review);
        } else {
          element.iconPath = new vscode.ThemeIcon("git-pull-request");
        }
        break;
    }

    return element;
  }

  getChildren(element?: LinearTreeItem): Thenable<LinearTreeItem[]> {
    if (!this.linearService.isConfigured()) {
      return Promise.resolve([
        new LinearTreeItem(
          LinearTreeItemKind.Hint,
          "Set API key to connect (status bar or command palette)",
          vscode.TreeItemCollapsibleState.None
        ),
      ]);
    }

    if (!element) {
      return Promise.resolve(
        LINEAR_SECTIONS.map(
          (section) =>
            new LinearTreeItem(
              LinearTreeItemKind.Section,
              section.label,
              vscode.TreeItemCollapsibleState.Collapsed,
              section.id,
              undefined,
              section.id === "issues"
                ? "Expand to load issues grouped by status"
                : "Expand to load from Linear"
            )
        )
      );
    }

    if (element.kind === LinearTreeItemKind.IssueStatusGroup && element.sectionId) {
      return Promise.resolve(
        mapIssueItems(element.sectionId, element.statusGroup?.issues ?? [])
      );
    }

    if (element.kind !== LinearTreeItemKind.Section || !element.sectionId) {
      return Promise.resolve([]);
    }

    const sectionId = element.sectionId;
    this.markSectionExpanded(sectionId);

    const entry = this.cache.get(sectionId) ?? { state: "idle" };

    switch (entry.state) {
      case "idle":
      case "loading":
        return Promise.resolve([
          new LinearTreeItem(
            LinearTreeItemKind.Loading,
            "Loading…",
            vscode.TreeItemCollapsibleState.None,
            sectionId
          ),
        ]);
      case "error":
        return Promise.resolve([
          new LinearTreeItem(
            LinearTreeItemKind.Error,
            entry.message,
            vscode.TreeItemCollapsibleState.None,
            sectionId
          ),
        ]);
      case "loaded":
        if (sectionId === "issues") {
          return Promise.resolve(this.mapIssueGroups(entry.items as LinearIssueSummary[]));
        }
        if (entry.items.length === 0) {
          return Promise.resolve([
            new LinearTreeItem(
              LinearTreeItemKind.Empty,
              emptyLabel(sectionId),
              vscode.TreeItemCollapsibleState.None,
              sectionId
            ),
          ]);
        }
        return Promise.resolve(mapItems(sectionId, entry.items));
    }
  }

  private mapIssueGroups(issues: LinearIssueSummary[]): LinearTreeItem[] {
    const filtered = applyIssueFilters(issues, this.issueFilters);
    if (filtered.length === 0) {
      const message =
        this.issueFilters.status || this.issueFilters.project
          ? "No issues match the current filters"
          : "No issues found";
      return [
        new LinearTreeItem(
          LinearTreeItemKind.Empty,
          message,
          vscode.TreeItemCollapsibleState.None,
          "issues"
        ),
      ];
    }

    return groupIssuesByState(filtered).map((group) => {
      const item = new LinearTreeItem(
        LinearTreeItemKind.IssueStatusGroup,
        `${group.state} (${group.issues.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        "issues",
        undefined,
        `${group.state}\n${group.issues.length} issue(s)`
      );
      item.statusGroup = {
        state: group.state,
        stateType: group.stateType,
        stateColor: group.stateColor,
        issues: group.issues,
      };
      return item;
    });
  }

  private async loadSection(sectionId: LinearSectionId): Promise<void> {
    this.cache.set(sectionId, { state: "loading" });
    this._onDidChangeTreeData.fire(undefined);

    try {
      const items = await this.linearService.fetchSection(sectionId);
      this.cache.set(sectionId, { state: "loaded", items });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load section.";
      this.cache.set(sectionId, { state: "error", message });
    }

    this._onDidChangeTreeData.fire(undefined);
  }
}

function emptyLabel(sectionId: LinearSectionId): string {
  switch (sectionId) {
    case "issues":
      return "No issues found";
    case "projects":
      return "No projects found";
    case "initiatives":
      return "No initiatives found";
    case "reviews":
      return "No reviews found";
  }
}

function mapIssueItems(
  sectionId: LinearSectionId,
  issues: LinearIssueSummary[]
): LinearTreeItem[] {
  return issues.map((issue) => {
    const parts = [issue.priorityLabel];
    if (issue.assignee) {
      parts.push(issue.assignee);
    }
    if (issue.project) {
      parts.push(issue.project);
    }

    const tooltip = [
      issue.identifier,
      issue.title,
      `State: ${issue.state}`,
      `Priority: ${issue.priorityLabel}`,
      issue.assignee ? `Assignee: ${issue.assignee}` : undefined,
      issue.project ? `Project: ${issue.project}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");

    const item = new LinearTreeItem(
      LinearTreeItemKind.Issue,
      `${issue.identifier}  ${issue.title}`,
      vscode.TreeItemCollapsibleState.None,
      sectionId,
      issue.url,
      tooltip
    );
    item.command = {
      command: CMD_OPEN_ISSUE,
      title: "Open Issue",
      arguments: [
        issue.id,
        `${issue.identifier}: ${issue.title}`,
        issue.url,
        issue.stateType,
        issue.state,
      ],
    };
    item.contextValue = "linearIssue";
    item.description = parts.join(" · ");
    item.issue = issue;
    return item;
  });
}

function mapItems(
  sectionId: LinearSectionId,
  items:
    | LinearIssueSummary[]
    | LinearProjectSummary[]
    | LinearInitiativeSummary[]
    | LinearReviewSummary[]
): LinearTreeItem[] {
  switch (sectionId) {
    case "issues":
      return mapIssueItems(sectionId, items as LinearIssueSummary[]);
    case "projects":
      return (items as LinearProjectSummary[]).map((project) => {
        const tooltip = [
          project.name,
          `State: ${project.state}`,
          `Progress: ${project.progress}%`,
          project.lead ? `Lead: ${project.lead}` : undefined,
        ]
          .filter(Boolean)
          .join("\n");

        const item = new LinearTreeItem(
          LinearTreeItemKind.Project,
          project.name,
          vscode.TreeItemCollapsibleState.None,
          sectionId,
          project.url,
          tooltip
        );
        item.command = {
          command: CMD_OPEN_PROJECT_BOARD,
          title: "Open Project Board",
          arguments: [project.id, project.name, project.url],
        };
        item.contextValue = "linearProject";
        item.description = `${project.state} · ${project.progress}%`;
        return item;
      });
    case "initiatives":
      return (items as LinearInitiativeSummary[]).map((initiative) => {
        const projectsHint =
          initiative.projectNames.length > 0
            ? initiative.projectNames.join(", ")
            : "No linked projects";
        const tooltip = [
          initiative.name,
          `Status: ${initiative.status}`,
          initiative.owner ? `Owner: ${initiative.owner}` : undefined,
          `Projects: ${projectsHint}`,
        ]
          .filter(Boolean)
          .join("\n");

        const item = new LinearTreeItem(
          LinearTreeItemKind.Initiative,
          initiative.name,
          vscode.TreeItemCollapsibleState.None,
          sectionId,
          initiative.url,
          tooltip
        );
        item.description = initiative.status;
        return item;
      });
    case "reviews":
      return (items as LinearReviewSummary[]).map((review) => {
        const tooltip = [
          review.title,
          `Status: ${review.status}`,
          review.author ? `Author: ${review.author}` : undefined,
        ]
          .filter(Boolean)
          .join("\n");

        const item = new LinearTreeItem(
          LinearTreeItemKind.Review,
          review.title,
          vscode.TreeItemCollapsibleState.None,
          sectionId,
          review.url,
          tooltip
        );
        item.description = [review.status, review.author]
          .filter(Boolean)
          .join(" · ");
        item.review = review;
        return item;
      });
  }
}
