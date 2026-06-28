/**
 * Linear workflow state icons and colors for tree items.
 */

import * as vscode from "vscode";
import type { LinearIssueSummary } from "./types";

const STATE_TYPE_ORDER: Record<string, number> = {
  triage: 0,
  backlog: 1,
  unstarted: 2,
  started: 3,
  completed: 4,
  canceled: 5,
  duplicate: 6,
};

/** VS Code theme colors approximating Linear workflow colors. */
function stateThemeColor(stateType: string, stateName: string): vscode.ThemeColor {
  const lower = stateName.toLowerCase();

  if (stateType === "completed" || lower.includes("done")) {
    return new vscode.ThemeColor("charts.green");
  }
  if (lower.includes("review")) {
    return new vscode.ThemeColor("charts.teal");
  }
  if (lower.includes("risk")) {
    return new vscode.ThemeColor("charts.red");
  }
  if (stateType === "started" || lower.includes("progress")) {
    return new vscode.ThemeColor("charts.yellow");
  }
  if (stateType === "backlog") {
    return new vscode.ThemeColor("charts.purple");
  }
  if (stateType === "unstarted" || lower.includes("todo")) {
    return new vscode.ThemeColor("charts.orange");
  }
  if (stateType === "canceled" || stateType === "duplicate") {
    return new vscode.ThemeColor("disabledForeground");
  }
  return new vscode.ThemeColor("foreground");
}

function stateTypeIconId(stateType: string, stateName: string): string {
  const lower = stateName.toLowerCase();

  if (stateType === "completed" || lower.includes("done")) {
    return "pass-filled";
  }
  if (lower.includes("review")) {
    return "git-pull-request";
  }
  if (lower.includes("risk")) {
    return "warning";
  }
  if (stateType === "started" || lower.includes("progress")) {
    return "record";
  }
  if (stateType === "backlog") {
    return "circle-large-outline";
  }
  if (stateType === "canceled" || stateType === "duplicate") {
    return "circle-slash";
  }
  return "circle-outline";
}

export function workflowStateIcon(state: {
  name: string;
  type: string;
}): vscode.ThemeIcon {
  return new vscode.ThemeIcon(
    stateTypeIconId(state.type, state.name),
    stateThemeColor(state.type, state.name)
  );
}

export function issueStateIcon(issue: LinearIssueSummary): vscode.ThemeIcon {
  return workflowStateIcon({ name: issue.state, type: issue.stateType });
}

export function projectIcon(): vscode.ThemeIcon {
  return new vscode.ThemeIcon("project");
}

export function statusGroupIcon(
  stateName: string,
  stateType: string,
  _stateColor: string
): vscode.ThemeIcon {
  return new vscode.ThemeIcon(
    stateTypeIconId(stateType, stateName),
    stateThemeColor(stateType, stateName)
  );
}

export function compareStateGroups(
  a: { state: string; stateType: string },
  b: { state: string; stateType: string }
): number {
  const typeOrder =
    (STATE_TYPE_ORDER[a.stateType] ?? 99) - (STATE_TYPE_ORDER[b.stateType] ?? 99);
  if (typeOrder !== 0) {
    return typeOrder;
  }
  return a.state.localeCompare(b.state);
}

export function groupIssuesByState(
  issues: LinearIssueSummary[]
): { state: string; stateType: string; stateColor: string; issues: LinearIssueSummary[] }[] {
  const groups = new Map<
    string,
    { state: string; stateType: string; stateColor: string; issues: LinearIssueSummary[] }
  >();

  for (const issue of issues) {
    const existing = groups.get(issue.state);
    if (existing) {
      existing.issues.push(issue);
      continue;
    }
    groups.set(issue.state, {
      state: issue.state,
      stateType: issue.stateType,
      stateColor: issue.stateColor,
      issues: [issue],
    });
  }

  return [...groups.values()].sort(compareStateGroups);
}
