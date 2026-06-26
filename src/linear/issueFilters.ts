/** Persisted issue list filters for the sidebar tree. */

import * as vscode from "vscode";

const WORKSPACE_KEY = "linear.issueFilters";

export interface IssueFilters {
  status: string | null;
  project: string | null;
}

export const DEFAULT_ISSUE_FILTERS: IssueFilters = {
  status: null,
  project: null,
};

export function loadIssueFilters(
  workspaceState: vscode.Memento
): IssueFilters {
  return (
    workspaceState.get<IssueFilters>(WORKSPACE_KEY) ?? {
      ...DEFAULT_ISSUE_FILTERS,
    }
  );
}

export async function saveIssueFilters(
  workspaceState: vscode.Memento,
  filters: IssueFilters
): Promise<void> {
  await workspaceState.update(WORKSPACE_KEY, filters);
}

export function formatFilterMessage(filters: IssueFilters): string | undefined {
  const parts: string[] = [];
  if (filters.status) {
    parts.push(`Status: ${filters.status}`);
  }
  if (filters.project) {
    parts.push(`Project: ${filters.project}`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function applyIssueFilters(
  issues: import("./types").LinearIssueSummary[],
  filters: IssueFilters
): import("./types").LinearIssueSummary[] {
  return issues.filter((issue) => {
    if (filters.status && issue.state !== filters.status) {
      return false;
    }
    if (filters.project && issue.project !== filters.project) {
      return false;
    }
    return true;
  });
}
