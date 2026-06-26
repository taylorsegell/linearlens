import { describe, it, expect } from "vitest";
import { mapBoardIssue } from "../linear/boardIssueMapper";

describe("mapBoardIssue", () => {
  it("maps card fields including labels and milestone", () => {
    const card = mapBoardIssue({
      id: "i1",
      identifier: "ABO-42",
      title: "Kanban card",
      url: "https://linear.app/x/ABO-42",
      updatedAt: "2026-06-26T12:00:00.000Z",
      createdAt: "2026-06-25T12:00:00.000Z",
      priority: 2,
      priorityLabel: "High",
      state: { id: "s1", name: "In Progress", type: "started", color: "#f00" },
      assignee: { id: "u1", name: "Alex" },
      labels: [{ id: "l1", name: "phase-2", color: "#0f0" }],
      milestone: { id: "m1", name: "Phase 2 API" },
    });

    expect(card.identifier).toBe("ABO-42");
    expect(card.labels[0].name).toBe("phase-2");
    expect(card.milestone?.name).toBe("Phase 2 API");
    expect(card.state.name).toBe("In Progress");
  });

  it("defaults missing optional fields", () => {
    const card = mapBoardIssue({
      id: "i2",
      identifier: "ABO-99",
      title: "Minimal",
      url: "https://linear.app/x",
      updatedAt: "2026-06-26T12:00:00.000Z",
      createdAt: "2026-06-26T12:00:00.000Z",
      priority: 0,
      priorityLabel: "No priority",
      state: { id: "s2", name: "Backlog", type: "backlog", color: "#999" },
    });

    expect(card.labels).toEqual([]);
    expect(card.assignee).toBeUndefined();
    expect(card.milestone).toBeUndefined();
  });
});
