import type {
  LinearCommentDetail,
  LinearIssueDetail,
  LinearSubIssueSummary,
  LinearWorkflowState,
} from "./types";

export interface RawIssueDetailInput {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  updatedAt: string;
  priority: number;
  priorityLabel: string;
  teamId: string;
  state: LinearWorkflowState;
  assignee?: { id: string; name: string };
  project?: { id: string; name: string };
  milestone?: { id: string; name: string };
  labels?: { id: string; name: string; color?: string }[];
  subIssues?: LinearSubIssueSummary[];
  comments?: LinearCommentDetail[];
}

export function mapIssueDetail(input: RawIssueDetailInput): LinearIssueDetail {
  return {
    id: input.id,
    identifier: input.identifier,
    title: input.title,
    description: input.description,
    url: input.url,
    updatedAt: input.updatedAt,
    priority: input.priority,
    priorityLabel: input.priorityLabel,
    teamId: input.teamId,
    state: input.state,
    assignee: input.assignee,
    project: input.project,
    milestone: input.milestone,
    labels: input.labels ?? [],
    subIssues: input.subIssues ?? [],
    comments: input.comments ?? [],
  };
}
