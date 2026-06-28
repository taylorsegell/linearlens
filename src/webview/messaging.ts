import type {
  LinearBoardIssueCard,
  LinearIssueDetail,
  LinearProjectBoardMeta,
  BoardIssuesPage,
  BoardViewState,
  TeamLabelOption,
  TeamMemberOption,
} from "../linear/types";

export type IssuePatch = Partial<
  Pick<LinearIssueDetail, "title" | "description" | "priority">
> & {
  stateId?: string;
  assigneeId?: string | null;
  labelIds?: string[];
};

/** webview → extension host */
export type WebviewRequest =
  | { type: "ready" }
  | { type: "refresh"; issueId: string }
  | { type: "updateIssue"; issueId: string; patch: IssuePatch }
  | { type: "createComment"; issueId: string; body: string }
  | { type: "openExternal"; url: string }
  | {
      type: "openIssue";
      issueId: string;
      label: string;
      stateType?: string;
      stateName?: string;
    }
  | {
      type: "moveIssue";
      issueId: string;
      stateId: string;
      projectId: string;
    }
  | { type: "loadBoardPage"; projectId: string; cursor?: string }
  | { type: "saveBoardViewState"; projectId: string; viewState: BoardViewState }
  | { type: "refreshBoard"; projectId: string };

/** extension host → webview */
export type ExtensionMessage =
  | {
      type: "issueLoaded";
      issue: LinearIssueDetail;
      workflowStates: WorkflowStateOption[];
      teamMembers: TeamMemberOption[];
      teamLabels: TeamLabelOption[];
    }
  | { type: "issueUpdated"; issue: LinearIssueDetail }
  | {
      type: "boardLoaded";
      meta: LinearProjectBoardMeta;
      workflowStates: WorkflowStateOption[];
      viewState: BoardViewState;
      page: BoardIssuesPage;
    }
  | {
      type: "boardPageLoaded";
      page: BoardIssuesPage;
      append: boolean;
    }
  | { type: "boardIssueUpdated"; issue: LinearBoardIssueCard }
  | {
      type: "boardMoveFailed";
      issueId: string;
      previousStateId: string;
      message: string;
    }
  | { type: "mutationError"; message: string }
  | { type: "theme"; kind: "light" | "dark" | "highContrast" };

export interface WorkflowStateOption {
  id: string;
  name: string;
  color: string;
}

export type ThemeKind = "light" | "dark" | "highContrast";

export interface WebviewPanelBootstrap {
  panel: "issue" | "board";
  issueId?: string;
  projectId?: string;
  themeKind?: ThemeKind;
}

export function isWebviewRequest(value: unknown): value is WebviewRequest {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  const type = (value as { type: unknown }).type;
  return (
    type === "ready" ||
    type === "refresh" ||
    type === "updateIssue" ||
    type === "createComment" ||
    type === "openExternal" ||
    type === "openIssue" ||
    type === "moveIssue" ||
    type === "loadBoardPage" ||
    type === "saveBoardViewState" ||
    type === "refreshBoard"
  );
}
