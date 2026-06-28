import * as vscode from "vscode";
import * as fs from "node:fs";
import type { WebviewPanelBootstrap } from "../webview/messaging";

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string,
  bootstrap: WebviewPanelBootstrap
): string {
  const distDir = vscode.Uri.joinPath(extensionUri, "dist", "webview");
  const indexPath = vscode.Uri.joinPath(distDir, "index.html");
  const htmlOnDisk = fs.readFileSync(indexPath.fsPath, "utf8");

  const scriptMatch = htmlOnDisk.match(/src="[^"]*\/assets\/([^"]+\.js)"/);
  const styleMatch = htmlOnDisk.match(/href="[^"]*\/assets\/([^"]+\.css)"/);

  if (!scriptMatch) {
    throw new Error(
      "dist/webview/index.html missing script — run yarn build:webview"
    );
  }

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(distDir, "assets", scriptMatch[1])
  );
  const styleUri = styleMatch
    ? webview.asWebviewUri(
        vscode.Uri.joinPath(distDir, "assets", styleMatch[1])
      )
    : undefined;

  const bootstrapJson = JSON.stringify(bootstrap).replace(/</g, "\\u003c");

  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  const themeKind = bootstrap.themeKind ?? "dark";

  return `<!DOCTYPE html>
<html lang="en" data-theme="${themeKind}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Linear</title>
  ${styleUri ? `<link rel="stylesheet" href="${styleUri}">` : ""}
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.__LINEAR_PANEL__ = ${bootstrapJson};
  </script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}

/** @deprecated Use getWebviewHtml */
export function getIssueDetailWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string
): string {
  return getWebviewHtml(webview, extensionUri, nonce, {
    panel: "issue",
  });
}
