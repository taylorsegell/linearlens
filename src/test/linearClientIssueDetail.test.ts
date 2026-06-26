import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinearService } from "../linear/linearClient";

function makeIssueMock() {
  return {
    id: "issue-1",
    identifier: "ABO-1",
    title: "Hello",
    description: "Body",
    url: "https://linear.app/x/ABO-1",
    updatedAt: new Date("2026-06-26T12:00:00.000Z"),
    priority: 2,
    priorityLabel: "High",
    state: Promise.resolve({
      id: "state-1",
      name: "In Progress",
      type: "started",
      color: "#ff0000",
    }),
    assignee: Promise.resolve({ id: "u1", displayName: "Alex" }),
    project: Promise.resolve({ id: "p1", name: "Abodi" }),
    milestone: Promise.resolve(undefined),
    team: Promise.resolve({ id: "team-1" }),
    labels: vi.fn(async () => ({
      nodes: [{ id: "l1", name: "phase-1", color: "#00ff00" }],
    })),
    children: vi.fn(async () => ({
      nodes: [
        {
          id: "child-1",
          identifier: "ABO-2",
          title: "Child",
          state: Promise.resolve({
            name: "Todo",
            color: "#cccccc",
          }),
        },
      ],
    })),
    comments: vi.fn(async () => ({
      nodes: [
        {
          id: "c1",
          body: "Nice",
          createdAt: new Date("2026-06-26T11:00:00.000Z"),
          user: Promise.resolve({ displayName: "Alex" }),
        },
      ],
    })),
  };
}

describe("LinearService issue detail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchIssueDetail maps SDK issue", async () => {
    const service = new LinearService("lin_api_test");
    const issueMock = makeIssueMock();
    (
      service as unknown as {
        client: { issue: (id: string) => Promise<unknown> };
      }
    ).client = {
      issue: vi.fn(async () => issueMock),
    };

    const detail = await service.fetchIssueDetail("issue-1");
    expect(detail.identifier).toBe("ABO-1");
    expect(detail.labels[0].name).toBe("phase-1");
    expect(detail.subIssues[0].identifier).toBe("ABO-2");
    expect(detail.comments[0].body).toBe("Nice");
  });
});
