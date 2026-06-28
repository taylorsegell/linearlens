/**
 * Linear sidebar commands — API key, refresh, open in browser.
 */

import * as vscode from "vscode";
import {
  CMD_CLEAR_ISSUE_FILTERS,
  CMD_FILTER_ISSUES_PROJECT,
  CMD_FILTER_ISSUES_STATUS,
  CMD_OPEN_ISSUE,
  CMD_OPEN_ISSUE_IN_BROWSER,
  CMD_OPEN_PROJECT_BOARD,
  CMD_OPEN_PROJECT_IN_BROWSER,
  CMD_OPEN_LINEAR,
  CMD_REFRESH,
  CMD_SET_API_KEY,
} from "./config";
import type { PanelManager } from "./panels/PanelManager";
import {
  LinearTreeItem,
  type LinearTreeDataProvider,
} from "./providers/linearTreeDataProvider";
import { clearApiKey, getStoredApiKey, storeApiKey } from "./linear/apiKeyStorage";
import { formatError, LinearService } from "./linear/linearClient";
import type { LinearStatusBar } from "./ui/statusBar";

async function pickIssueFilter(
  ctx: LinearCommandContext,
  kind: "status" | "project"
): Promise<void> {
  const provider = ctx.getTreeProvider();
  const service = ctx.getService();
  if (!service.isConfigured()) {
    void vscode.window.showWarningMessage(
      "Linear is not connected. Set your API key first."
    );
    return;
  }

  const issues = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: "Loading Linear issues…",
    },
    () => provider.ensureIssuesCached()
  );

  if (issues.length === 0) {
    void vscode.window.showInformationMessage("No issues found.");
    return;
  }

  const current = provider.getIssueFilters();
  const values =
    kind === "status"
      ? [...new Set(issues.map((issue) => issue.state))].sort()
      : [
          ...new Set(
            issues
              .map((issue) => issue.project)
              .filter((name): name is string => Boolean(name))
          ),
        ].sort();

  if (values.length === 0 && kind === "project") {
    void vscode.window.showInformationMessage("No projects found on issues.");
    return;
  }

  const picked = await vscode.window.showQuickPick(
    [
      {
        label: kind === "status" ? "All statuses" : "All projects",
        description: "Clear this filter",
        value: null as string | null,
      },
      ...values.map((value) => ({
        label: value,
        picked:
          kind === "status"
            ? current.status === value
            : current.project === value,
        value,
      })),
    ],
    {
      placeHolder:
        kind === "status"
          ? "Filter issues by status"
          : "Filter issues by project",
    }
  );

  if (picked === undefined) {
    return;
  }

  await provider.setIssueFilters({
    ...current,
    [kind === "status" ? "status" : "project"]: picked.value,
  });
}

export interface LinearCommandContext {
  context: vscode.ExtensionContext;
  getService: () => LinearService;
  setService: (service: LinearService) => void;
  getTreeProvider: () => LinearTreeDataProvider;
  getStatusBar: () => LinearStatusBar;
  getPanelManager: () => PanelManager;
}

export async function promptForApiKey(
  ctx: LinearCommandContext,
  options?: { silent?: boolean }
): Promise<boolean> {
  const apiKey = await vscode.window.showInputBox({
    title: "Linear Personal API Key",
    prompt: "Paste your Linear Personal API Key",
    password: true,
    ignoreFocusOut: true,
    placeHolder: "lin_api_…",
    validateInput: (value) =>
      value.trim().length === 0 ? "API key is required." : undefined,
  });

  if (!apiKey) {
    return false;
  }

  const service = new LinearService(apiKey.trim());
  const connection = await service.validateConnection();

  if (!connection.connected) {
    vscode.window.showErrorMessage(
      connection.error ?? "Could not validate Linear API key."
    );
    return false;
  }

  await storeApiKey(ctx.context.secrets, apiKey);
  ctx.setService(service);
  ctx.getTreeProvider().refresh();
  await ctx.getStatusBar().update(connection);

  if (!options?.silent) {
    vscode.window.showInformationMessage(
      `Linear connected as ${connection.userName ?? "user"}.`
    );
  }

  return true;
}

export function registerLinearCommands(
  ctx: LinearCommandContext
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(CMD_SET_API_KEY, () =>
      promptForApiKey(ctx)
    ),

    vscode.commands.registerCommand(CMD_REFRESH, () => {
      if (!ctx.getService().isConfigured()) {
        void vscode.window
          .showWarningMessage(
            "Linear is not connected. Set your API key first?",
            "Set API Key"
          )
          .then((choice) => {
            if (choice === "Set API Key") {
              void promptForApiKey(ctx);
            }
          });
        return;
      }

      ctx.getTreeProvider().refresh();
    }),

    vscode.commands.registerCommand(CMD_OPEN_LINEAR, () => {
      void vscode.env.openExternal(vscode.Uri.parse("https://linear.app"));
    }),

    vscode.commands.registerCommand(CMD_FILTER_ISSUES_STATUS, () =>
      pickIssueFilter(ctx, "status")
    ),

    vscode.commands.registerCommand(CMD_FILTER_ISSUES_PROJECT, () =>
      pickIssueFilter(ctx, "project")
    ),

    vscode.commands.registerCommand(CMD_CLEAR_ISSUE_FILTERS, () =>
      ctx.getTreeProvider().clearIssueFilters()
    ),

    vscode.commands.registerCommand(
      CMD_OPEN_ISSUE,
      (
        issueId: string,
        label: string,
        _url?: string,
        stateType?: string,
        stateName?: string
      ) => {
        if (!issueId) {
          return;
        }
        if (!ctx.getService().isConfigured()) {
          void vscode.window.showWarningMessage(
            "Linear is not connected. Set your API key first."
          );
          return;
        }
        ctx.getPanelManager().openIssue(
          issueId,
          label ?? "Linear Issue",
          stateType && stateName ? { type: stateType, name: stateName } : undefined
        );
      }
    ),

    vscode.commands.registerCommand(
      CMD_OPEN_ISSUE_IN_BROWSER,
      (
        itemOrIssueId?: LinearTreeItem | string,
        _label?: string,
        url?: string
      ) => {
        if (itemOrIssueId instanceof LinearTreeItem && itemOrIssueId.url) {
          void vscode.env.openExternal(
            vscode.Uri.parse(itemOrIssueId.url)
          );
          return;
        }
        if (url) {
          void vscode.env.openExternal(vscode.Uri.parse(url));
        }
      }
    ),

    vscode.commands.registerCommand(
      CMD_OPEN_PROJECT_BOARD,
      async (projectId?: string, label?: string) => {
        const service = ctx.getService();
        if (!service.isConfigured()) {
          void vscode.window.showWarningMessage(
            "Linear is not connected. Set your API key first."
          );
          return;
        }

        let id = projectId;
        let tabLabel = label;
        if (!id) {
          const projects = ctx
            .getTreeProvider()
            .getCachedSection("projects") as
            | import("./linear/types").LinearProjectSummary[]
            | undefined;
          if (!projects?.length) {
            void vscode.window.showInformationMessage(
              "No projects loaded. Refresh the Linear sidebar first."
            );
            return;
          }
          const pick = await vscode.window.showQuickPick(
            projects.map((p) => ({
              label: p.name,
              description: `${p.state} · ${p.progress}%`,
              projectId: p.id,
            })),
            { placeHolder: "Select a project board" }
          );
          if (!pick) {
            return;
          }
          id = pick.projectId;
          tabLabel = pick.label;
        }

        ctx.getPanelManager().openBoard(id!, tabLabel ?? "Project Board");
      }
    ),

    vscode.commands.registerCommand(
      CMD_OPEN_PROJECT_IN_BROWSER,
      (_projectId: string, _label: string, url?: string) => {
        if (url) {
          void vscode.env.openExternal(vscode.Uri.parse(url));
        }
      }
    ),
  ];
}

export async function initializeLinearSidebarAuth(
  ctx: LinearCommandContext
): Promise<void> {
  const storedKey = await getStoredApiKey(ctx.context.secrets);
  if (!storedKey) {
    await ctx.getStatusBar().update({ connected: false });
    const choice = await vscode.window.showInformationMessage(
      "Linear sidebar needs a Personal API Key. Set one now?",
      "Set API Key",
      "Later"
    );
    if (choice === "Set API Key") {
      await promptForApiKey(ctx, { silent: false });
    }
    return;
  }

  const service = new LinearService(storedKey);
  const connection = await service.validateConnection();

  if (!connection.connected) {
    await clearApiKey(ctx.context.secrets);
    ctx.setService(new LinearService());
    ctx.getTreeProvider().clearAll();
    await ctx.getStatusBar().update(connection);
    const choice = await vscode.window.showErrorMessage(
      connection.error ?? formatError(new Error("Invalid API key.")),
      "Set API Key"
    );
    if (choice === "Set API Key") {
      await promptForApiKey(ctx);
    }
    return;
  }

  ctx.setService(service);
  await ctx.getStatusBar().update(connection);
}
