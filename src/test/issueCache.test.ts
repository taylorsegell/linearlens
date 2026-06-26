import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IssueDetailCache } from "../linear/issueCache";
import type { LinearIssueDetail } from "../linear/types";

const issue: LinearIssueDetail = {
  id: "i1",
  identifier: "ABO-1",
  title: "Test",
  url: "https://linear.app/x",
  updatedAt: "2026-06-26T00:00:00.000Z",
  state: { id: "s", name: "Todo", type: "unstarted", color: "#000" },
  priority: 0,
  priorityLabel: "None",
  labels: [],
  subIssues: [],
  comments: [],
  teamId: "t1",
};

describe("IssueDetailCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached value within TTL", async () => {
    const cache = new IssueDetailCache();
    cache.set(issue);
    const fetcher = vi.fn(async () => issue);
    const result = await cache.getOrFetch("i1", fetcher);
    expect(result).toEqual(issue);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refetches after TTL expires", async () => {
    const cache = new IssueDetailCache();
    cache.set(issue);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    const updated = { ...issue, title: "Updated" };
    const fetcher = vi.fn(async () => updated);
    const result = await cache.getOrFetch("i1", fetcher);
    expect(result.title).toBe("Updated");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("dedupes concurrent fetches for same id", async () => {
    const cache = new IssueDetailCache();
    const fetcher = vi.fn(
      () =>
        new Promise<LinearIssueDetail>((resolve) =>
          setTimeout(() => resolve(issue), 50)
        )
    );
    const p1 = cache.getOrFetch("i1", fetcher);
    const p2 = cache.getOrFetch("i1", fetcher);
    vi.advanceTimersByTime(50);
    await Promise.all([p1, p2]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
