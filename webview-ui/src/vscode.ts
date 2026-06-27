declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

export const vscode =
  typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;

export function postToExtension(message: unknown): void {
  vscode?.postMessage(message);
}
