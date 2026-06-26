import type { BoardIssuesPage, LinearBoardIssueCard } from "./types";

export const BOARD_CACHE_TTL_MS = 5 * 60 * 1000;

interface BoardCacheEntry {
  issues: LinearBoardIssueCard[];
  endCursor?: string;
  hasNextPage: boolean;
  fetchedAt: number;
}

export class BoardCache {
  private readonly entries = new Map<string, BoardCacheEntry>();

  private getEntry(projectId: string): BoardCacheEntry | undefined {
    const entry = this.entries.get(projectId);
    if (!entry) {
      return undefined;
    }
    if (Date.now() - entry.fetchedAt > BOARD_CACHE_TTL_MS) {
      this.entries.delete(projectId);
      return undefined;
    }
    return entry;
  }

  getIssues(projectId: string): LinearBoardIssueCard[] {
    return this.getEntry(projectId)?.issues ?? [];
  }

  getCursor(projectId: string): string | undefined {
    const entry = this.getEntry(projectId);
    return entry?.hasNextPage ? entry.endCursor : undefined;
  }

  hasNextPage(projectId: string): boolean {
    return this.getEntry(projectId)?.hasNextPage ?? false;
  }

  appendPage(
    projectId: string,
    page: BoardIssuesPage,
    options?: { append?: boolean }
  ): void {
    const existing = this.getEntry(projectId);
    const append = options?.append ?? false;

    const issues = append
      ? [...(existing?.issues ?? []), ...page.issues]
      : page.issues;

    this.entries.set(projectId, {
      issues,
      endCursor: page.endCursor,
      hasNextPage: page.hasNextPage,
      fetchedAt: Date.now(),
    });
  }

  patchIssue(projectId: string, issue: LinearBoardIssueCard): void {
    const entry = this.getEntry(projectId);
    if (!entry) {
      return;
    }
    entry.issues = entry.issues.map((existing) =>
      existing.id === issue.id ? issue : existing
    );
  }

  invalidate(projectId: string): void {
    this.entries.delete(projectId);
  }
}
