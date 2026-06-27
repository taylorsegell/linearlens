import { useCallback, useEffect, useState } from "react";
import { postToExtension } from "../vscode";

export interface WorkflowStateOption {
  id: string;
  name: string;
  color: string;
}

export interface IssueDetail {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  priority: number;
  priorityLabel: string;
  state: { id: string; name: string; color: string };
  assignee?: { name: string };
  project?: { name: string };
  milestone?: { name: string };
  labels: { name: string; color?: string }[];
  subIssues: {
    id: string;
    identifier: string;
    title: string;
    state: string;
  }[];
  comments: {
    id: string;
    body: string;
    authorName?: string;
    createdAt: string;
  }[];
}

type ExtensionMessage =
  | {
      type: "issueLoaded";
      issue: IssueDetail;
      workflowStates: WorkflowStateOption[];
    }
  | { type: "issueUpdated"; issue: IssueDetail }
  | { type: "mutationError"; message: string };

export function useVscodeMessaging() {
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [workflowStates, setWorkflowStates] = useState<WorkflowStateOption[]>(
    []
  );
  const [error, setError] = useState<string | null>(null);

  const post = useCallback((message: unknown) => {
    postToExtension(message);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const msg = event.data;
      if (msg.type === "issueLoaded" || msg.type === "issueUpdated") {
        setIssue(msg.issue);
        if (msg.type === "issueLoaded") {
          setWorkflowStates(msg.workflowStates);
        }
        setError(null);
      } else if (msg.type === "mutationError") {
        setError(msg.message);
      }
    };
    window.addEventListener("message", handler);
    post({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, [post]);

  return { issue, workflowStates, error, post };
}
