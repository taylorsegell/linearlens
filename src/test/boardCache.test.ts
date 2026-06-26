import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BoardCache } from "../linear/boardCache";
import type { LinearBoardIssueCard } from "../linear/types";

const state = {
  id: "s1",
  name: "Todo",
  type: "unstarted",
  color: "#ccc",
};

const issue = (id: string): LinearBoardIssueCard => ({
  id,
  identifier: id.toUpperCase(),
  title: "Test",
  url: "https://linear.app/x",
  updatedAt: "2026-06-26T00:00:00.000Z",
  createdAt: "2026-06-25T00:00:00.000Z",
  priority: 1,
  priorityLabel: "Urgent",
  state,
  labels: [],
});

describe("BoardCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("appends pages and tracks cursor", () => {
    const cache = new BoardCache();
    cache.appendPage("p1", {
      issues: [issue("1")],
      hasNextPage: true,
      endCursor: "cursor-1",
    });
    cache.appendPage(
      "p1",
      { issues: [issue("2")], hasNextPage: false },
      { append: true }
    );

    expect(cache.getIssues("p1")).toHaveLength(2);
    expect(cache.getCursor("p1")).toBeUndefined();
  });

  it("patches a single issue in place", () => {
    const cache = new BoardCache();
    cache.appendPage("p1", { issues: [issue("1")], hasNextPage: false });
    cache.patchIssue("p1", { ...issue("1"), title: "Updated" });
    expect(cache.getIssues("p1")[0].title).toBe("Updated");
  });

  it("invalidates after TTL", () => {
    const cache = new BoardCache();
    cache.appendPage("p1", { issues: [issue("1")], hasNextPage: false });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(cache.getIssues("p1")).toEqual([]);
  });
});
