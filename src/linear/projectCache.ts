import type { LinearProjectDetail } from "./types";

export const PROJECT_DETAIL_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  project: LinearProjectDetail;
  fetchedAt: number;
}

export class ProjectDetailCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<LinearProjectDetail>>();

  get(projectId: string): LinearProjectDetail | undefined {
    const entry = this.entries.get(projectId);
    if (!entry) {
      return undefined;
    }
    if (Date.now() - entry.fetchedAt > PROJECT_DETAIL_TTL_MS) {
      this.entries.delete(projectId);
      return undefined;
    }
    return entry.project;
  }

  set(project: LinearProjectDetail): void {
    this.entries.set(project.id, { project, fetchedAt: Date.now() });
  }

  invalidate(projectId: string): void {
    this.entries.delete(projectId);
    this.inflight.delete(projectId);
  }

  async getOrFetch(
    projectId: string,
    fetcher: () => Promise<LinearProjectDetail>
  ): Promise<LinearProjectDetail> {
    const cached = this.get(projectId);
    if (cached) {
      return cached;
    }

    const pending = this.inflight.get(projectId);
    if (pending) {
      return pending;
    }

    const promise = fetcher()
      .then((project) => {
        this.set(project);
        return project;
      })
      .finally(() => {
        this.inflight.delete(projectId);
      });

    this.inflight.set(projectId, promise);
    return promise;
  }
}
