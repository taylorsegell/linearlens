import type * as vscode from "vscode";
import {
  DEFAULT_BOARD_FILTERS,
  DEFAULT_BOARD_VIEW_STATE,
  type BoardViewState,
} from "./types";

export function boardViewStateKey(projectId: string): string {
  return `linear.boardViewState.${projectId}`;
}

export function loadBoardViewState(
  workspaceState: vscode.Memento,
  projectId: string
): BoardViewState {
  const stored = workspaceState.get<BoardViewState>(
    boardViewStateKey(projectId)
  );
  if (!stored) {
    return {
      ...DEFAULT_BOARD_VIEW_STATE,
      filters: { ...DEFAULT_BOARD_VIEW_STATE.filters },
    };
  }
  return {
    ...DEFAULT_BOARD_VIEW_STATE,
    ...stored,
    filters: { ...DEFAULT_BOARD_FILTERS, ...stored.filters },
    hiddenStatusIds: stored.hiddenStatusIds ?? [],
    collapsedStatusIds: stored.collapsedStatusIds ?? [],
    statusColumnPrefsCustomized:
      stored.statusColumnPrefsCustomized ??
      (stored.hiddenStatusIds?.length ?? 0) > 0,
  };
}

export async function saveBoardViewState(
  workspaceState: vscode.Memento,
  projectId: string,
  viewState: BoardViewState
): Promise<void> {
  await workspaceState.update(boardViewStateKey(projectId), viewState);
}
