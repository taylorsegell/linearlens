import { describe, it, expect } from "vitest";
import {
  applyBoardFilters,
  extractPhaseLabel,
  groupIssuesIntoSwimlanes,
  sortIssuesForList,
} from "../linear/boardFilters";
import type { LinearBoardIssueCard } from "../linear/types";

const baseState = {
  id: "s1",
  name: "Todo",
  type: "unstarted",
  color: "#ccc",
};

function card(
  overrides: Partial<LinearBoardIssueCard> & { id: string }
): LinearBoardIssueCard {
  return {
    identifier: overrides.id.toUpperCase(),
    title: "Issue",
    url: "https://linear.app/x",
    updatedAt: "2026-06-26T00:00:00.000Z",
    createdAt: "2026-06-25T00:00:00.000Z",
    priority: 2,
    priorityLabel: "High",
    state: baseState,
    labels: [],
    ...overrides,
  };
}

describe("extractPhaseLabel", () => {
  it("returns first label matching prefix", () => {
    expect(
      extractPhaseLabel(
        [{ name: "bug" }, { name: "phase-2" }, { name: "phase-1" }],
        "phase-"
      )
    ).toBe("phase-2");
  });

  it("returns null when no match", () => {
    expect(extractPhaseLabel([{ name: "bug" }], "phase-")).toBeNull();
  });
});

describe("applyBoardFilters", () => {
  it("filters by status, label, assignee, and search", () => {
    const issues = [
      card({
        id: "1",
        title: "Auth setup",
        state: { ...baseState, id: "s1" },
        labels: [{ id: "l1", name: "phase-1", color: "#0f0" }],
        assignee: { id: "u1", name: "Alex" },
      }),
      card({
        id: "2",
        title: "Deploy",
        state: { ...baseState, id: "s2", name: "Done" },
        labels: [{ id: "l2", name: "phase-2", color: "#00f" }],
      }),
    ];

    const filtered = applyBoardFilters(issues, {
      statusIds: ["s1"],
      labelIds: ["l1"],
      assigneeIds: ["u1"],
      search: "auth",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });
});

describe("groupIssuesIntoSwimlanes", () => {
  it("groups by phase label with fallback lane", () => {
    const issues = [
      card({
        id: "1",
        labels: [{ id: "l1", name: "phase-1", color: "#0f0" }],
      }),
      card({ id: "2", labels: [] }),
    ];

    const lanes = groupIssuesIntoSwimlanes(issues, "phaseLabel", "phase-");
    expect(lanes.map((l) => l.label).sort()).toEqual(
      ["No phase", "phase-1"].sort()
    );
  });

  it("returns single lane when groupBy is none", () => {
    const issues = [card({ id: "1" }), card({ id: "2" })];
    const lanes = groupIssuesIntoSwimlanes(issues, "none", "phase-");
    expect(lanes).toHaveLength(1);
    expect(lanes[0].id).toBe("all");
    expect(lanes[0].issues).toHaveLength(2);
  });
});

describe("sortIssuesForList", () => {
  it("sorts by priority ascending (P0 first)", () => {
    const issues = [
      card({ id: "1", priority: 3 }),
      card({ id: "2", priority: 1 }),
    ];
    const sorted = sortIssuesForList(issues, "priority");
    expect(sorted.map((i) => i.id)).toEqual(["2", "1"]);
  });
});
