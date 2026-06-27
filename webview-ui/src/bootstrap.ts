export interface WebviewPanelBootstrap {
  panel: "issue" | "board";
  issueId?: string;
  projectId?: string;
}

declare global {
  interface Window {
    __LINEAR_PANEL__?: WebviewPanelBootstrap;
  }
}

export function readBootstrap(): WebviewPanelBootstrap {
  return window.__LINEAR_PANEL__ ?? { panel: "issue" };
}
