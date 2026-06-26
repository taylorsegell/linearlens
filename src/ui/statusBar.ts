/**
 * Status bar item showing Linear connection state.
 */

import * as vscode from "vscode";
import { CMD_SET_API_KEY } from "../config";
import type { LinearConnectionState } from "../linear/types";

export class LinearStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      50
    );
    this.item.command = CMD_SET_API_KEY;
    this.item.show();
  }

  async update(state: LinearConnectionState): Promise<void> {
    if (state.connected) {
      const user = state.userName ? ` (${state.userName})` : "";
      this.item.text = `$(pass-filled) Linear: Connected${user}`;
      this.item.tooltip = "Linear API key is configured. Click to update key.";
      this.item.backgroundColor = undefined;
      this.item.command = CMD_SET_API_KEY;
      return;
    }

    this.item.text = "$(circle-slash) Linear: Not Connected";
    this.item.tooltip = state.error
      ? `${state.error}\n\nClick to set API key.`
      : "Click to set your Linear Personal API Key.";
    this.item.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
    this.item.command = CMD_SET_API_KEY;
  }

  dispose(): void {
    this.item.dispose();
  }
}
