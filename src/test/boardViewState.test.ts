import { describe, it, expect } from "vitest";
import {
  boardViewStateKey,
  loadBoardViewState,
  saveBoardViewState,
} from "../linear/boardViewState";
import { DEFAULT_BOARD_VIEW_STATE } from "../linear/types";

describe("boardViewState", () => {
  it("loads defaults when nothing stored", () => {
    const memento = {
      get: () => undefined,
      update: async () => undefined,
      keys: () => [],
    };
    expect(loadBoardViewState(memento, "proj-1")).toEqual(
      DEFAULT_BOARD_VIEW_STATE
    );
  });

  it("round-trips saved state", async () => {
    let stored: unknown;
    const memento = {
      get: (key: string) => (key === boardViewStateKey("proj-1") ? stored : undefined),
      update: async (_key: string, value: unknown) => {
        stored = value;
      },
      keys: () => [],
    };

    const custom = {
      ...DEFAULT_BOARD_VIEW_STATE,
      view: "list" as const,
      groupBy: "none" as const,
    };
    await saveBoardViewState(memento, "proj-1", custom);
    expect(loadBoardViewState(memento, "proj-1")).toEqual(custom);
  });

  it("merges defaults for stored state missing column layout fields", () => {
    const memento = {
      get: () => ({
        view: "kanban" as const,
        groupBy: "phaseLabel" as const,
        filters: DEFAULT_BOARD_VIEW_STATE.filters,
        sortBy: "priority" as const,
      }),
      update: async () => undefined,
      keys: () => [],
    };
    expect(loadBoardViewState(memento, "proj-1")).toEqual(
      DEFAULT_BOARD_VIEW_STATE
    );
  });
});
