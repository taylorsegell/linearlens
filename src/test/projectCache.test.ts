import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProjectDetailCache, PROJECT_DETAIL_TTL_MS } from "../linear/projectCache";
import type { LinearProjectDetail } from "../linear/types";

function sample(id = "p1"): LinearProjectDetail {
  return {
    id,
    name: "P",
    state: "started",
    progress: 10,
    url: "https://linear.app/p",
    milestones: [],
    recentIssues: [],
  };
}

describe("ProjectDetailCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached project within TTL", async () => {
    const cache = new ProjectDetailCache();
    const project = sample();
    cache.set(project);
    expect(cache.get("p1")).toEqual(project);
  });

  it("expires after TTL", () => {
    const cache = new ProjectDetailCache();
    cache.set(sample());
    vi.advanceTimersByTime(PROJECT_DETAIL_TTL_MS + 1);
    expect(cache.get("p1")).toBeUndefined();
  });

  it("getOrFetch dedupes inflight", async () => {
    const cache = new ProjectDetailCache();
    let calls = 0;
    const fetcher = () => {
      calls += 1;
      return Promise.resolve(sample());
    };
    const [a, b] = await Promise.all([
      cache.getOrFetch("p1", fetcher),
      cache.getOrFetch("p1", fetcher),
    ]);
    expect(a).toEqual(b);
    expect(calls).toBe(1);
  });
});
