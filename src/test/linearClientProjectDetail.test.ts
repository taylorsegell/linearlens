import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinearService } from "../linear/linearClient";

function makeProjectMock(overrides: Record<string, unknown> = {}) {
  const issues = vi.fn(async (args?: { first?: number; orderBy?: string }) => ({
    nodes: [
      {
        id: "issue-1",
        identifier: "ABO-1",
        title: "Auth",
        url: "https://linear.app/x/ABO-1",
        state: Promise.resolve({
          name: "In Progress",
          type: "started",
        }),
      },
    ],
    _args: args,
  }));

  const projectMilestones = vi.fn(async (args?: { first?: number }) => ({
    nodes: [
      {
        id: "m1",
        name: "Phase 1",
        progress: 1,
        status: "done",
      },
      {
        id: "m2",
        name: "Phase 2",
        progress: 0.45,
        status: "next",
      },
    ],
    _args: args,
  }));

  return {
    id: "proj-1",
    name: "Abodi Beta",
    description: "Ship private beta",
    progress: 0.62,
    url: "https://linear.app/x/project/abodi",
    startDate: "2026-01-01",
    targetDate: "2026-06-01",
    status: Promise.resolve({ name: "In Progress" }),
    lead: Promise.resolve({ displayName: "Taylor", name: "taylor" }),
    projectMilestones,
    issues,
    ...overrides,
  };
}

describe("LinearService project detail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchProjectDetail maps SDK project with milestones and recent issues", async () => {
    const service = new LinearService("lin_api_test");
    const projectMock = makeProjectMock();

    (
      service as unknown as {
        client: { project: (id: string) => Promise<unknown> };
      }
    ).client = {
      project: vi.fn(async () => projectMock),
    };

    const detail = await service.fetchProjectDetail("proj-1");

    expect(detail.id).toBe("proj-1");
    expect(detail.name).toBe("Abodi Beta");
    expect(detail.description).toBe("Ship private beta");
    expect(detail.state).toBe("In Progress");
    expect(detail.progress).toBe(62);
    expect(detail.lead).toBe("Taylor");
    expect(detail.url).toBe("https://linear.app/x/project/abodi");
    expect(detail.startDate).toBe("2026-01-01");
    expect(detail.targetDate).toBe("2026-06-01");

    expect(detail.milestones).toHaveLength(2);
    expect(detail.milestones[0]).toMatchObject({
      id: "m1",
      name: "Phase 1",
      progress: 100,
      status: "done",
    });
    expect(detail.milestones[1].progress).toBe(45);

    expect(detail.recentIssues).toHaveLength(1);
    expect(detail.recentIssues[0]).toMatchObject({
      id: "issue-1",
      identifier: "ABO-1",
      title: "Auth",
      state: "In Progress",
      stateType: "started",
      stateName: "In Progress",
      url: "https://linear.app/x/ABO-1",
    });

    expect(projectMock.projectMilestones).toHaveBeenCalledWith({ first: 50 });
    expect(projectMock.issues).toHaveBeenCalledWith(
      expect.objectContaining({
        first: 10,
        orderBy: "updatedAt",
      })
    );
  });

  it("updateProject calls client.updateProject then re-fetches detail", async () => {
    const service = new LinearService("lin_api_test");
    const projectMock = makeProjectMock({
      description: "Updated description",
    });
    const updateProject = vi.fn(async () => ({ success: true }));
    const project = vi.fn(async () => projectMock);

    (
      service as unknown as {
        client: {
          project: typeof project;
          updateProject: typeof updateProject;
        };
      }
    ).client = {
      project,
      updateProject,
    };

    const detail = await service.updateProject("proj-1", {
      description: "Updated description",
    });

    expect(updateProject).toHaveBeenCalledWith("proj-1", {
      description: "Updated description",
    });
    expect(project).toHaveBeenCalledWith("proj-1");
    expect(detail.description).toBe("Updated description");
    expect(detail.name).toBe("Abodi Beta");
  });

  it("updateProject throws when Linear rejects the update", async () => {
    const service = new LinearService("lin_api_test");

    (
      service as unknown as {
        client: {
          updateProject: () => Promise<{ success: boolean }>;
        };
      }
    ).client = {
      updateProject: vi.fn(async () => ({ success: false })),
    };

    await expect(
      service.updateProject("proj-1", { description: "x" })
    ).rejects.toThrow(/Failed to update project/);
  });
});
