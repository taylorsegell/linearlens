export type ThemeKind = "light" | "dark" | "highContrast";

export interface WebviewPanelBootstrap {
  panel: "issue" | "board";
  issueId?: string;
  projectId?: string;
  themeKind?: ThemeKind;
}

declare global {
  interface Window {
    __LINEAR_PANEL__?: WebviewPanelBootstrap;
  }
}

export function readBootstrap(): WebviewPanelBootstrap {
  return window.__LINEAR_PANEL__ ?? { panel: "issue" };
}
