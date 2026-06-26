import type { LinearIssueDetail } from "./types";

export const ISSUE_DETAIL_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  issue: LinearIssueDetail;
  fetchedAt: number;
}

export class IssueDetailCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<LinearIssueDetail>>();

  get(issueId: string): LinearIssueDetail | undefined {
    const entry = this.entries.get(issueId);
    if (!entry) {
      return undefined;
    }
    if (Date.now() - entry.fetchedAt > ISSUE_DETAIL_TTL_MS) {
      this.entries.delete(issueId);
      return undefined;
    }
    return entry.issue;
  }

  set(issue: LinearIssueDetail): void {
    this.entries.set(issue.id, { issue, fetchedAt: Date.now() });
  }

  invalidate(issueId: string): void {
    this.entries.delete(issueId);
    this.inflight.delete(issueId);
  }

  async getOrFetch(
    issueId: string,
    fetcher: () => Promise<LinearIssueDetail>
  ): Promise<LinearIssueDetail> {
    const cached = this.get(issueId);
    if (cached) {
      return cached;
    }

    const pending = this.inflight.get(issueId);
    if (pending) {
      return pending;
    }

    const promise = fetcher()
      .then((issue) => {
        this.set(issue);
        return issue;
      })
      .finally(() => {
        this.inflight.delete(issueId);
      });

    this.inflight.set(issueId, promise);
    return promise;
  }
}
