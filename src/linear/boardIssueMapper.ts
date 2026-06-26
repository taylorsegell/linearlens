import type { LinearBoardIssueCard, LinearWorkflowState } from "./types";

export interface RawBoardIssueInput {
  id: string;
  identifier: string;
  title: string;
  url: string;
  updatedAt: string;
  createdAt: string;
  priority: number;
  priorityLabel: string;
  state: LinearWorkflowState;
  assignee?: { id: string; name: string };
  labels?: { id: string; name: string; color?: string }[];
  milestone?: { id: string; name: string };
}

export function mapBoardIssue(input: RawBoardIssueInput): LinearBoardIssueCard {
  return {
    id: input.id,
    identifier: input.identifier,
    title: input.title,
    url: input.url,
    updatedAt: input.updatedAt,
    createdAt: input.createdAt,
    priority: input.priority,
    priorityLabel: input.priorityLabel,
    state: input.state,
    assignee: input.assignee,
    labels: input.labels ?? [],
    milestone: input.milestone,
  };
}
