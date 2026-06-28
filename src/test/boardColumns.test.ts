import { describe, expect, it } from "vitest";
import {
  computeDefaultHiddenStatusIds,
  getWorkflowStateRank,
  resolveHiddenStatusIds,
  sortWorkflowStatesForBoard,
} from "../linear/boardColumns";

const states = [
  { id: "s-risk", name: "At Risk" },
  { id: "s-todo", name: "Todo" },
  { id: "s-dup", name: "Duplicate" },
  { id: "s-review", name: "In Review" },
  { id: "s-cancel", name: "Canceled" },
  { id: "s-done", name: "Done" },
  { id: "s-progress", name: "In Progress" },
  { id: "s-backlog", name: "Backlog" },
];

describe("boardColumns", () => {
  it("sorts workflow states into the default board order", () => {
    expect(sortWorkflowStatesForBoard(states).map((state) => state.name)).toEqual([
      "Todo",
      "In Progress",
      "In Review",
      "Done",
      "At Risk",
      "Backlog",
      "Duplicate",
      "Canceled",
    ]);
  });

  it("ranks backlog after the main workflow columns", () => {
    expect(getWorkflowStateRank("Backlog")).toBeGreaterThan(
      getWorkflowStateRank("Done")
    );
  });

  it("hides duplicate, canceled, and empty at risk by default", () => {
    const issues = [{ state: { id: "s-todo" } }, { state: { id: "s-done" } }];

    expect(computeDefaultHiddenStatusIds(states, issues)).toEqual([
      "s-risk",
      "s-dup",
      "s-cancel",
    ]);
  });

  it("shows at risk when it has issues", () => {
    const issues = [{ state: { id: "s-risk" } }];

    expect(computeDefaultHiddenStatusIds(states, issues)).toEqual([
      "s-dup",
      "s-cancel",
    ]);
  });

  it("uses saved hidden ids once column prefs are customized", () => {
    const issues = [{ state: { id: "s-todo" } }];

    expect(
      resolveHiddenStatusIds(states, issues, ["s-todo"], true)
    ).toEqual(["s-todo"]);
    expect(
      resolveHiddenStatusIds(states, issues, ["s-todo"], false)
    ).toEqual(["s-risk", "s-dup", "s-cancel"]);
  });
});
