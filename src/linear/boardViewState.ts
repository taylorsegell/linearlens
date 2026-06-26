import type * as vscode from "vscode";
import {
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
  return (
    workspaceState.get<BoardViewState>(boardViewStateKey(projectId)) ?? {
      ...DEFAULT_BOARD_VIEW_STATE,
      filters: { ...DEFAULT_BOARD_VIEW_STATE.filters },
    }
  );
}

export async function saveBoardViewState(
  workspaceState: vscode.Memento,
  projectId: string,
  viewState: BoardViewState
): Promise<void> {
  await workspaceState.update(boardViewStateKey(projectId), viewState);
}
