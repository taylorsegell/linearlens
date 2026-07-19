import type {
  LinearProjectDetail,
  LinearProjectMilestoneSummary,
  LinearProjectRecentIssue,
} from "./types";

function progressPercent(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return 0;
  }
  // Linear SDK progress is 0–1; already-percent values (>1) pass through capped.
  const pct = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export interface RawProjectDetailInput {
  id: string;
  name: string;
  description?: string;
  state: string;
  progress: number;
  lead?: string;
  url: string;
  startDate?: string;
  targetDate?: string;
  milestones?: {
    id: string;
    name: string;
    progress: number;
    status?: string;
  }[];
  recentIssues?: LinearProjectRecentIssue[];
}

export function mapProjectDetail(
  input: RawProjectDetailInput
): LinearProjectDetail {
  const milestones: LinearProjectMilestoneSummary[] = (
    input.milestones ?? []
  ).map((m) => ({
    id: m.id,
    name: m.name,
    progress: progressPercent(m.progress),
    status: m.status,
  }));

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    state: input.state,
    progress: progressPercent(input.progress),
    lead: input.lead,
    url: input.url,
    startDate: input.startDate,
    targetDate: input.targetDate,
    milestones,
    recentIssues: input.recentIssues ?? [],
  };
}
