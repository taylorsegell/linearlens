import { useCallback, useEffect, useState } from "react";
import { postToExtension } from "../vscode";

export interface BoardIssueCard {
  id: string;
  identifier: string;
  title: string;
  url: string;
  updatedAt: string;
  createdAt: string;
  priority: number;
  priorityLabel: string;
  state: { id: string; name: string; type: string; color: string };
  assignee?: { id: string; name: string };
  labels: { id: string; name: string; color?: string }[];
  milestone?: { id: string; name: string };
}

export interface BoardMeta {
  id: string;
  name: string;
  url: string;
  teamId: string;
  progress: number;
}

export interface BoardFilters {
  statusIds: string[];
  labelIds: string[];
  assigneeIds: Array<string | "__unassigned__">;
  search: string;
}

export interface BoardViewState {
  view: "kanban" | "list";
  groupBy: "none" | "phaseLabel" | "assignee";
  filters: BoardFilters;
  sortBy: "priority" | "updatedAt" | "createdAt" | "identifier";
}

type ExtensionMessage =
  | {
      type: "boardLoaded";
      meta: BoardMeta;
      workflowStates: { id: string; name: string; color: string }[];
      viewState: BoardViewState;
      page: {
        issues: BoardIssueCard[];
        hasNextPage: boolean;
        endCursor?: string;
      };
    }
  | {
      type: "boardPageLoaded";
      page: {
        issues: BoardIssueCard[];
        hasNextPage: boolean;
        endCursor?: string;
      };
      append: boolean;
    }
  | { type: "boardIssueUpdated"; issue: BoardIssueCard }
  | {
      type: "boardMoveFailed";
      issueId: string;
      previousStateId: string;
      message: string;
    }
  | { type: "mutationError"; message: string };

export function useBoardMessaging() {
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [workflowStates, setWorkflowStates] = useState<
    { id: string; name: string; color: string }[]
  >([]);
  const [viewState, setViewStateLocal] = useState<BoardViewState | null>(null);
  const [issues, setIssues] = useState<BoardIssueCard[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const post = useCallback((message: unknown) => {
    postToExtension(message);
  }, []);

  const setViewState = useCallback(
    (next: BoardViewState) => {
      setViewStateLocal(next);
      if (meta) {
        post({
          type: "saveBoardViewState",
          projectId: meta.id,
          viewState: next,
        });
      }
    },
    [meta, post]
  );

  const loadMore = useCallback(() => {
    if (meta && endCursor) {
      post({ type: "loadBoardPage", projectId: meta.id, cursor: endCursor });
    }
  }, [meta, endCursor, post]);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case "boardLoaded":
          setMeta(msg.meta);
          setWorkflowStates(msg.workflowStates);
          setViewStateLocal(msg.viewState);
          setIssues(msg.page.issues);
          setHasNextPage(msg.page.hasNextPage);
          setEndCursor(msg.page.endCursor);
          setError(null);
          break;
        case "boardPageLoaded":
          setIssues((prev) =>
            msg.append ? [...prev, ...msg.page.issues] : msg.page.issues
          );
          setHasNextPage(msg.page.hasNextPage);
          setEndCursor(msg.page.endCursor);
          break;
        case "boardIssueUpdated":
          setIssues((prev) =>
            prev.map((issue) =>
              issue.id === msg.issue.id ? msg.issue : issue
            )
          );
          break;
        case "boardMoveFailed":
          setIssues((prev) =>
            prev.map((issue) =>
              issue.id === msg.issueId
                ? {
                    ...issue,
                    state: {
                      ...issue.state,
                      id: msg.previousStateId,
                    },
                  }
                : issue
            )
          );
          setError(msg.message);
          break;
        case "mutationError":
          setError(msg.message);
          break;
      }
    };
    window.addEventListener("message", handler);
    post({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, [post]);

  return {
    meta,
    workflowStates,
    viewState,
    issues,
    error,
    hasNextPage,
    post,
    setViewState,
    loadMore,
  };
}
