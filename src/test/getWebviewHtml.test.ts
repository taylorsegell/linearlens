import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";

const Uri = {
  file: (p: string) => ({ fsPath: p, path: p.replace(/\\/g, "/") }),
  joinPath: (base: { fsPath: string }, ...parts: string[]) => {
    const joined = path.join(base.fsPath, ...parts);
    return { fsPath: joined, path: joined.replace(/\\/g, "/") };
  },
};

describe("getIssueDetailWebviewHtml", () => {
  it("inlines script with webview URI and nonce", async () => {
    const { getIssueDetailWebviewHtml } = await import(
      "../panels/getWebviewHtml"
    );
    const extPath = path.resolve(__dirname, "../..");
    const extensionUri = Uri.file(extPath);

    const webviewDist = path.join(extPath, "dist/webview");
    if (!fs.existsSync(path.join(webviewDist, "index.html"))) {
      return;
    }

    const html = getIssueDetailWebviewHtml(
      {
        asWebviewUri: (uri: { path: string }) => {
          const file = Uri.file(uri.path.replace(/^\//, ""));
          return `https://webview.example/${file.path}` as unknown as import("vscode").Uri;
        },
        cspSource: "webview.csp.example",
      } as unknown as import("vscode").Webview,
      extensionUri as unknown as import("vscode").Uri,
      "test-nonce-123"
    );

    expect(html).toContain("test-nonce-123");
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("assets/");
  });
});
