export interface BoardWorkflowState {
  id: string;
  name: string;
}

export interface BoardIssueStateRef {
  state: { id: string };
}

function normalizeStatusName(name: string): string {
  return name.trim().toLowerCase();
}

/** Lower rank = further left on the board. */
export function getWorkflowStateRank(name: string): number {
  const normalized = normalizeStatusName(name);

  switch (normalized) {
    case "todo":
    case "to do":
      return 10;
    case "in progress":
      return 20;
    case "in review":
      return 30;
    case "done":
      return 40;
    case "at risk":
      return 50;
    case "duplicate":
      return 910;
    case "canceled":
    case "cancelled":
      return 920;
    case "backlog":
      return 900;
    default:
      return 500;
  }
}

export function sortWorkflowStatesForBoard<T extends BoardWorkflowState>(
  states: T[]
): T[] {
  return [...states].sort((a, b) => {
    const rankDiff =
      getWorkflowStateRank(a.name) - getWorkflowStateRank(b.name);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return a.name.localeCompare(b.name);
  });
}

export function countIssuesByStateId(
  issues: BoardIssueStateRef[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    counts.set(issue.state.id, (counts.get(issue.state.id) ?? 0) + 1);
  }
  return counts;
}

/** Default hidden columns before the user customizes visibility. */
export function computeDefaultHiddenStatusIds(
  states: BoardWorkflowState[],
  issues: BoardIssueStateRef[]
): string[] {
  const counts = countIssuesByStateId(issues);
  const hidden: string[] = [];

  for (const state of states) {
    const normalized = normalizeStatusName(state.name);

    if (normalized === "duplicate" || normalized === "canceled" || normalized === "cancelled") {
      hidden.push(state.id);
      continue;
    }

    if (normalized === "at risk" && (counts.get(state.id) ?? 0) === 0) {
      hidden.push(state.id);
    }
  }

  return hidden;
}

export function resolveHiddenStatusIds(
  states: BoardWorkflowState[],
  issues: BoardIssueStateRef[],
  hiddenStatusIds: string[],
  statusColumnPrefsCustomized: boolean
): string[] {
  if (statusColumnPrefsCustomized) {
    return hiddenStatusIds;
  }
  return computeDefaultHiddenStatusIds(states, issues);
}
