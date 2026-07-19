import { useCallback, useEffect, useState } from "react";
import { postToExtension } from "../vscode";

/** Local mirror of host `LinearProjectDetail` fields used in the UI. */
export interface ProjectDetail {
  id: string;
  name: string;
  description?: string;
  state: string;
  progress: number;
  lead?: string;
  url: string;
  startDate?: string;
  targetDate?: string;
  milestones: {
    id: string;
    name: string;
    progress: number;
    status?: string;
  }[];
  recentIssues: {
    id: string;
    identifier: string;
    title: string;
    state: string;
    stateType?: string;
    stateName?: string;
    url: string;
  }[];
}

type ExtensionMessage =
  | { type: "projectLoaded"; project: ProjectDetail }
  | { type: "projectUpdated"; project: ProjectDetail }
  | { type: "mutationError"; message: string };

export function useProjectMessaging() {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback((message: unknown) => {
    postToExtension(message);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      const msg = event.data;
      if (msg?.type === "projectLoaded" || msg?.type === "projectUpdated") {
        setProject(msg.project);
        setError(null);
      } else if (msg?.type === "mutationError") {
        setError(msg.message);
      }
    };
    window.addEventListener("message", handler);
    post({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, [post]);

  return { project, error, post };
}
