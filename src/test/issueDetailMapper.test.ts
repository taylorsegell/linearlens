import { describe, it, expect } from "vitest";
import { mapIssueDetail } from "../linear/issueDetailMapper";

describe("mapIssueDetail", () => {
  it("maps core fields and nested collections", () => {
    const detail = mapIssueDetail({
      id: "issue-1",
      identifier: "ABO-42",
      title: "Fix auth",
      description: "Details here",
      url: "https://linear.app/team/issue/ABO-42",
      updatedAt: "2026-06-26T12:00:00.000Z",
      priority: 2,
      priorityLabel: "High",
      teamId: "team-1",
      state: { id: "s1", name: "In Progress", type: "started", color: "#f00" },
      assignee: { id: "u1", name: "Alex" },
      project: { id: "p1", name: "Abodi Beta" },
      milestone: undefined,
      labels: [{ id: "l1", name: "phase-2", color: "#0f0" }],
      subIssues: [
        {
          id: "sub-1",
          identifier: "ABO-43",
          title: "Sub task",
          state: "Todo",
          stateColor: "#ccc",
        },
      ],
      comments: [
        {
          id: "c1",
          body: "Looks good",
          authorName: "Alex",
          createdAt: "2026-06-26T11:00:00.000Z",
        },
      ],
    });

    expect(detail.identifier).toBe("ABO-42");
    expect(detail.state.name).toBe("In Progress");
    expect(detail.labels).toHaveLength(1);
    expect(detail.subIssues[0].identifier).toBe("ABO-43");
    expect(detail.comments[0].body).toBe("Looks good");
  });

  it("defaults missing optional fields", () => {
    const detail = mapIssueDetail({
      id: "issue-2",
      identifier: "ABO-99",
      title: "Empty",
      url: "https://linear.app/x",
      updatedAt: "2026-06-26T12:00:00.000Z",
      priority: 0,
      priorityLabel: "No priority",
      teamId: "team-1",
      state: { id: "s2", name: "Backlog", type: "backlog", color: "#999" },
    });

    expect(detail.description).toBeUndefined();
    expect(detail.labels).toEqual([]);
    expect(detail.subIssues).toEqual([]);
    expect(detail.comments).toEqual([]);
  });
});
