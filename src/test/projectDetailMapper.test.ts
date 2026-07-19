import { describe, it, expect } from "vitest";
import { mapProjectDetail } from "../linear/projectDetailMapper";

describe("mapProjectDetail", () => {
  it("maps project fields, milestones, and recent issues", () => {
    const detail = mapProjectDetail({
      id: "p1",
      name: "Abodi Beta",
      description: "Ship private beta",
      state: "started",
      progress: 0.62,
      lead: "Taylor",
      url: "https://linear.app/p1",
      startDate: "2026-01-01",
      targetDate: "2026-06-01",
      milestones: [
        { id: "m1", name: "Phase 1", progress: 1, status: "done" },
        { id: "m2", name: "Phase 2", progress: 0.45, status: "started" },
      ],
      recentIssues: [
        {
          id: "i1",
          identifier: "ABO-1",
          title: "Auth",
          state: "In Progress",
          stateType: "started",
          stateName: "In Progress",
          url: "https://linear.app/i1",
        },
      ],
    });

    expect(detail.progress).toBe(62);
    expect(detail.milestones[0].progress).toBe(100);
    expect(detail.milestones[1].progress).toBe(45);
    expect(detail.recentIssues[0].identifier).toBe("ABO-1");
    expect(detail.description).toBe("Ship private beta");
  });

  it("defaults empty milestones and recentIssues", () => {
    const detail = mapProjectDetail({
      id: "p1",
      name: "Empty",
      state: "planned",
      progress: 0,
      url: "https://linear.app/p1",
    });
    expect(detail.milestones).toEqual([]);
    expect(detail.recentIssues).toEqual([]);
  });
});
