/**
 * Extension entry — OAuth auth provider + Linear sidebar tree.
 */

import * as vscode from "vscode";
import { LinearAuthenticationProvider } from "./LinearAuthenticationProvider";
import {
  initializeLinearSidebarAuth,
  registerLinearCommands,
  type LinearCommandContext,
} from "./commands";
import { LINEAR_TREE_VIEW_ID } from "./config";
import { LinearService } from "./linear/linearClient";
import { PanelManager } from "./panels/PanelManager";
import { LinearTreeDataProvider } from "./providers/linearTreeDataProvider";
import { LinearStatusBar } from "./ui/statusBar";

export async function activate(context: vscode.ExtensionContext) {
  const linearAuthProvider = new LinearAuthenticationProvider(context);
  context.subscriptions.push(linearAuthProvider);

  const logoutCommand = vscode.commands.registerCommand(
    "linear-connect.logout",
    async () => {
      const sessions = await linearAuthProvider.getSessions();
      for (const session of sessions) {
        await linearAuthProvider.removeSession(session.id);
      }

      vscode.window.showInformationMessage(
        "Logged out of all Linear API sessions."
      );
    }
  );
  context.subscriptions.push(logoutCommand);

  linearAuthProvider.onDidChangeSessions(() => {
    void checkForSessions(linearAuthProvider);
  });
  void checkForSessions(linearAuthProvider);

  let linearService = new LinearService();
  const statusBar = new LinearStatusBar();
  const treeProvider = new LinearTreeDataProvider(
    linearService,
    context.workspaceState
  );

  const panelManager = new PanelManager(
    context.extensionUri,
    context.workspaceState,
    () => linearService,
    (issueId) => {
      treeProvider.refresh();
    }
  );

  const treeView = vscode.window.createTreeView(LINEAR_TREE_VIEW_ID, {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  treeView.message = treeProvider.getFilterMessage();
  context.subscriptions.push(
    treeView,
    statusBar,
    panelManager,
    treeProvider.onDidChangeFilters(() => {
      treeView.message = treeProvider.getFilterMessage();
    })
  );

  const commandCtx: LinearCommandContext = {
    context,
    getService: () => linearService,
    setService: (service) => {
      linearService = service;
      treeProvider.setService(service);
    },
    getTreeProvider: () => treeProvider,
    getStatusBar: () => statusBar,
    getPanelManager: () => panelManager,
  };

  for (const disposable of registerLinearCommands(commandCtx)) {
    context.subscriptions.push(disposable);
  }

  await initializeLinearSidebarAuth(commandCtx);
}

export function deactivate() {}

async function checkForSessions(
  linearAuthProvider: LinearAuthenticationProvider
) {
  const existingSessions = await linearAuthProvider.getSessions();
  await vscode.commands.executeCommand(
    "setContext",
    "linear-connect.hasLinearSessions",
    existingSessions.length > 0
  );
}
