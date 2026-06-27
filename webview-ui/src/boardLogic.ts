import type { BoardIssueCard, BoardViewState } from "./hooks/useBoardMessaging";

export type BoardFilters = BoardViewState["filters"];
export type BoardGroupBy = BoardViewState["groupBy"];
export type ListSortKey = BoardViewState["sortBy"];

export interface BoardSwimlane {
  id: string;
  label: string;
  issues: BoardIssueCard[];
}

export function extractPhaseLabel(
  labels: { name: string }[],
  prefix: string
): string | null {
  const match = labels.find((label) =>
    label.name.toLowerCase().startsWith(prefix.toLowerCase())
  );
  return match?.name ?? null;
}

export function applyBoardFilters(
  issues: BoardIssueCard[],
  filters: BoardFilters
): BoardIssueCard[] {
  const search = filters.search.trim().toLowerCase();

  return issues.filter((issue) => {
    if (
      filters.statusIds.length > 0 &&
      !filters.statusIds.includes(issue.state.id)
    ) {
      return false;
    }

    if (filters.labelIds.length > 0) {
      const issueLabelIds = new Set(issue.labels.map((l) => l.id));
      const hasLabel = filters.labelIds.some((id) => issueLabelIds.has(id));
      if (!hasLabel) {
        return false;
      }
    }

    if (filters.assigneeIds.length > 0) {
      const wantsUnassigned = filters.assigneeIds.includes("__unassigned__");
      const assigneeId = issue.assignee?.id;
      const matchesAssignee =
        assigneeId !== undefined &&
        filters.assigneeIds.includes(assigneeId);
      if (!matchesAssignee && !(wantsUnassigned && !assigneeId)) {
        return false;
      }
    }

    if (search) {
      const haystack = `${issue.identifier} ${issue.title}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    return true;
  });
}

export function groupIssuesIntoSwimlanes(
  issues: BoardIssueCard[],
  groupBy: BoardGroupBy,
  phasePrefix: string
): BoardSwimlane[] {
  if (groupBy === "none") {
    return [{ id: "all", label: "All issues", issues }];
  }

  const laneMap = new Map<string, BoardSwimlane>();

  for (const issue of issues) {
    let laneId: string;
    let laneLabel: string;

    if (groupBy === "phaseLabel") {
      const phase = extractPhaseLabel(issue.labels, phasePrefix);
      laneId = phase ?? "__no_phase__";
      laneLabel = phase ?? "No phase";
    } else {
      laneId = issue.assignee?.id ?? "__unassigned__";
      laneLabel = issue.assignee?.name ?? "Unassigned";
    }

    const existing = laneMap.get(laneId);
    if (existing) {
      existing.issues.push(issue);
    } else {
      laneMap.set(laneId, { id: laneId, label: laneLabel, issues: [issue] });
    }
  }

  return Array.from(laneMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

export function sortIssuesForList(
  issues: BoardIssueCard[],
  sortBy: ListSortKey
): BoardIssueCard[] {
  const copy = [...issues];

  copy.sort((a, b) => {
    switch (sortBy) {
      case "priority":
        return a.priority - b.priority;
      case "updatedAt":
        return b.updatedAt.localeCompare(a.updatedAt);
      case "createdAt":
        return b.createdAt.localeCompare(a.createdAt);
      case "identifier":
        return a.identifier.localeCompare(b.identifier);
      default:
        return 0;
    }
  });

  return copy;
}
