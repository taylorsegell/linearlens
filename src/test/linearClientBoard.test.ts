import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinearService } from "../linear/linearClient";

function makeBoardIssueMock(id: string) {
  return {
    id,
    identifier: `ABO-${id}`,
    title: `Issue ${id}`,
    url: `https://linear.app/x/ABO-${id}`,
    updatedAt: new Date("2026-06-26T12:00:00.000Z"),
    createdAt: new Date("2026-06-25T12:00:00.000Z"),
    priority: 2,
    priorityLabel: "High",
    state: Promise.resolve({
      id: "state-1",
      name: "In Progress",
      type: "started",
      color: "#ff0000",
    }),
    assignee: Promise.resolve({ id: "u1", displayName: "Alex" }),
    projectMilestone: Promise.resolve({ id: "m1", name: "Phase 2" }),
    labels: vi.fn(async () => ({
      nodes: [{ id: "l1", name: "phase-2", color: "#00ff00" }],
    })),
  };
}

describe("LinearService board fetch", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fetchProjectBoardPage maps issues with pagination", async () => {
    const service = new LinearService("lin_api_test");
    const issueMock = makeBoardIssueMock("1");

    (service as unknown as {
      client: {
        project: (id: string) => Promise<{
          id: string;
          name: string;
          url: string;
          progress: number;
          teams: () => Promise<{ nodes: { id: string }[] }>;
          issues: (args: unknown) => Promise<{
            nodes: unknown[];
            pageInfo: { hasNextPage: boolean; endCursor?: string };
          }>;
        }>;
      };
    }).client = {
      project: vi.fn(async () => ({
        id: "proj-1",
        name: "Abodi Beta",
        url: "https://linear.app/x/project/abodi",
        progress: 0.62,
        teams: vi.fn(async () => ({ nodes: [{ id: "team-1" }] })),
        issues: vi.fn(async () => ({
          nodes: [issueMock],
          pageInfo: { hasNextPage: true, endCursor: "cursor-abc" },
        })),
      })),
    };

    const page = await service.fetchProjectBoardPage("proj-1");
    expect(page.issues).toHaveLength(1);
    expect(page.issues[0].identifier).toBe("ABO-1");
    expect(page.issues[0].labels[0].name).toBe("phase-2");
    expect(page.hasNextPage).toBe(true);
    expect(page.endCursor).toBe("cursor-abc");
  });

  it("fetchProjectBoardMeta returns teamId", async () => {
    const service = new LinearService("lin_api_test");

    (service as unknown as {
      client: {
        project: (id: string) => Promise<{
          id: string;
          name: string;
          url: string;
          progress: number;
          teams: () => Promise<{ nodes: { id: string }[] }>;
        }>;
      };
    }).client = {
      project: vi.fn(async () => ({
        id: "proj-1",
        name: "Abodi Beta",
        url: "https://linear.app/x/project/abodi",
        progress: 0.62,
        teams: vi.fn(async () => ({ nodes: [{ id: "team-1" }] })),
      })),
    };

    const meta = await service.fetchProjectBoardMeta("proj-1");
    expect(meta.teamId).toBe("team-1");
    expect(meta.name).toBe("Abodi Beta");
    expect(meta.progress).toBe(62);
  });
});
