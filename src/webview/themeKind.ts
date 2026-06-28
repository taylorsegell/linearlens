import * as vscode from "vscode";
import type { ExtensionMessage } from "./messaging";

export type ThemeKind = "light" | "dark" | "highContrast";

export function getThemeKind(): ThemeKind {
  const kind = vscode.window.activeColorTheme.kind;
  if (
    kind === vscode.ColorThemeKind.HighContrast ||
    kind === vscode.ColorThemeKind.HighContrastLight
  ) {
    return "highContrast";
  }
  if (kind === vscode.ColorThemeKind.Light) {
    return "light";
  }
  return "dark";
}

export function wireWebviewTheme(
  webview: vscode.Webview,
  disposables: vscode.Disposable[]
): void {
  const postTheme = (): void => {
    const message: ExtensionMessage = { type: "theme", kind: getThemeKind() };
    void webview.postMessage(message);
  };
  postTheme();
  disposables.push(
    vscode.window.onDidChangeActiveColorTheme(() => postTheme())
  );
}
