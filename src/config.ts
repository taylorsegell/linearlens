/** Secret storage key for the Linear Personal API key (sidebar integration). */
export const LINEAR_API_KEY_SECRET = "linear.apiKey";

/** Tree view id registered in package.json. */
export const LINEAR_TREE_VIEW_ID = "linear.sidebar";

/** Command ids. */
export const CMD_SET_API_KEY = "linear.setApiKey";
export const CMD_REFRESH = "linear.refresh";
export const CMD_OPEN_LINEAR = "linear.openInBrowser";
export const CMD_FILTER_ISSUES_STATUS = "linear.filterIssuesByStatus";
export const CMD_FILTER_ISSUES_PROJECT = "linear.filterIssuesByProject";
export const CMD_CLEAR_ISSUE_FILTERS = "linear.clearIssueFilters";
export const CMD_OPEN_ISSUE = "linear.openIssue";
export const CMD_OPEN_ISSUE_IN_BROWSER = "linear.openIssueInBrowser";
export const CMD_OPEN_PROJECT_BOARD = "linear.openProjectBoard";
export const CMD_OPEN_PROJECT_IN_BROWSER = "linear.openProjectInBrowser";

/** Root section ids (fixed order). */
export type LinearSectionId =
  | "issues"
  | "projects"
  | "initiatives"
  | "reviews";

export const LINEAR_SECTIONS: readonly {
  id: LinearSectionId;
  label: string;
  icon: string;
}[] = [
  { id: "issues", label: "Issues", icon: "issues" },
  { id: "projects", label: "Projects", icon: "project" },
  { id: "initiatives", label: "Initiatives", icon: "rocket" },
  { id: "reviews", label: "Reviews", icon: "git-pull-request" },
] as const;
