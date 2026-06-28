/** Normalized issue row for the sidebar tree. */
export interface LinearIssueSummary {
  id: string;
  identifier: string;
  title: string;
  state: string;
  stateType: string;
  stateColor: string;
  priority: number;
  priorityLabel: string;
  assignee?: string;
  project?: string;
  projectId?: string;
  url: string;
}

/** Normalized project row for the sidebar tree. */
export interface LinearProjectSummary {
  id: string;
  name: string;
  state: string;
  progress: number;
  lead?: string;
  url: string;
}

/** Normalized initiative row for the sidebar tree. */
export interface LinearInitiativeSummary {
  id: string;
  name: string;
  status: string;
  owner?: string;
  progress?: number;
  projectNames: string[];
  url: string;
}

/** Normalized review / diff notification row for the sidebar tree. */
export interface LinearReviewSummary {
  id: string;
  title: string;
  status: string;
  author?: string;
  url: string;
}

export type LinearSectionData =
  | LinearIssueSummary[]
  | LinearProjectSummary[]
  | LinearInitiativeSummary[]
  | LinearReviewSummary[];

export interface LinearConnectionState {
  connected: boolean;
  userName?: string;
  error?: string;
}

/** Workflow column / status option for issue updates. */
export interface LinearWorkflowState {
  id: string;
  name: string;
  type: string;
  color: string;
}

/** Comment on an issue. */
export interface LinearCommentDetail {
  id: string;
  body: string;
  authorName?: string;
  createdAt: string;
}

/** Child issue (one level). */
export interface LinearSubIssueSummary {
  id: string;
  identifier: string;
  title: string;
  state: string;
  stateType: string;
  stateColor: string;
}

/** Full issue payload for Task Detail panel. */
export interface LinearIssueDetail {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  updatedAt: string;
  state: LinearWorkflowState;
  priority: number;
  priorityLabel: string;
  assignee?: { id: string; name: string };
  project?: { id: string; name: string };
  milestone?: { id: string; name: string };
  labels: { id: string; name: string; color?: string }[];
  subIssues: LinearSubIssueSummary[];
  comments: LinearCommentDetail[];
  teamId: string;
}

export interface TeamMemberOption {
  id: string;
  name: string;
}

export interface TeamLabelOption {
  id: string;
  name: string;
  color?: string;
}

/** Lightweight issue card for Kanban/List boards. */
export interface LinearBoardIssueCard {
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
  labels: { id: string; name: string; color?: string }[];
  milestone?: { id: string; name: string };
}

/** Project metadata needed to render a board header. */
export interface LinearProjectBoardMeta {
  id: string;
  name: string;
  url: string;
  teamId: string;
  progress: number;
}

/** Paginated project issues page. */
export interface BoardIssuesPage {
  issues: LinearBoardIssueCard[];
  hasNextPage: boolean;
  endCursor?: string;
}

export type BoardGroupBy = "none" | "phaseLabel" | "assignee";
export type BoardViewMode = "kanban" | "list";
export type ListSortKey = "priority" | "updatedAt" | "createdAt" | "identifier";

export interface BoardFilters {
  statusIds: string[];
  labelIds: string[];
  assigneeIds: Array<string | "__unassigned__">;
  search: string;
}

export interface BoardViewState {
  view: BoardViewMode;
  groupBy: BoardGroupBy;
  filters: BoardFilters;
  sortBy: ListSortKey;
  /** Status columns removed from the board until re-enabled. */
  hiddenStatusIds: string[];
  /** Visible status columns collapsed to a narrow rail. */
  collapsedStatusIds: string[];
  /** When false, hidden columns follow smart defaults from boardColumns. */
  statusColumnPrefsCustomized: boolean;
}

export const DEFAULT_BOARD_FILTERS: BoardFilters = {
  statusIds: [],
  labelIds: [],
  assigneeIds: [],
  search: "",
};

export const DEFAULT_BOARD_VIEW_STATE: BoardViewState = {
  view: "kanban",
  groupBy: "phaseLabel",
  filters: DEFAULT_BOARD_FILTERS,
  sortBy: "priority",
  hiddenStatusIds: [],
  collapsedStatusIds: [],
  statusColumnPrefsCustomized: false,
};

/** Swimlane row when groupBy !== "none". */
export interface BoardSwimlane {
  id: string;
  label: string;
  issues: LinearBoardIssueCard[];
}
