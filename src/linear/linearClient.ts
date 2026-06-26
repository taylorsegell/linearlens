/**
 * Linear API client wrapper around @linear/sdk.
 * Validates keys, maps SDK models to sidebar-friendly summaries.
 */

import {
  LinearClient,
  LinearError,
  NotificationCategory,
} from "@linear/sdk";
import { mapIssueDetail } from "./issueDetailMapper";
import { mapBoardIssue } from "./boardIssueMapper";
import {
  buildCommentCreateInput,
  buildIssueUpdateInput,
} from "./mutations";
import type {
  BoardIssuesPage,
  LinearConnectionState,
  LinearInitiativeSummary,
  LinearIssueDetail,
  LinearIssueSummary,
  LinearProjectBoardMeta,
  LinearProjectSummary,
  LinearReviewSummary,
  LinearWorkflowState,
} from "./types";
import type { LinearSectionId } from "../config";
import type { IssuePatch } from "../webview/messaging";

const PAGE_SIZE = 50;
const BOARD_PAGE_SIZE = 50;

function formatError(error: unknown): string {
    if (error instanceof LinearError) {
      if (error.status === 401 || error.status === 403) {
        return "Invalid or expired Linear API key. Run “Linear: Set API Key” to update it.";
      }
    return error.message || "Linear API request failed.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown Linear API error.";
}

function humanizeNotificationType(type: string): string {
  return type
    .replace(/Notification$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function progressPercent(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value)) {
    return undefined;
  }
  return Math.round(value * 100);
}

export class LinearService {
  private client: LinearClient | undefined;

  constructor(private apiKey?: string) {
    if (apiKey) {
      this.client = new LinearClient({ apiKey });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.client);
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client = new LinearClient({ apiKey });
  }

  async validateConnection(): Promise<LinearConnectionState> {
    if (!this.client) {
      return { connected: false, error: "No API key configured." };
    }

    try {
      const viewer = await this.client.viewer;
      return {
        connected: true,
        userName: viewer.displayName || viewer.name,
      };
    } catch (error) {
      return { connected: false, error: formatError(error) };
    }
  }

  async fetchSection(
    sectionId: LinearSectionId
  ): Promise<
    | LinearIssueSummary[]
    | LinearProjectSummary[]
    | LinearInitiativeSummary[]
    | LinearReviewSummary[]
  > {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    switch (sectionId) {
      case "issues":
        return this.fetchIssues();
      case "projects":
        return this.fetchProjects();
      case "initiatives":
        return this.fetchInitiatives();
      case "reviews":
        return this.fetchReviews();
      default: {
        const exhaustive: never = sectionId;
        return exhaustive;
      }
    }
  }

  private async fetchIssues(): Promise<LinearIssueSummary[]> {
    const connection = await this.client!.issues({ first: PAGE_SIZE });
    const summaries: LinearIssueSummary[] = [];

    for (const issue of connection.nodes) {
      const [state, assignee, project] = await Promise.all([
        issue.state,
        issue.assignee,
        issue.project,
      ]);

      summaries.push({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        state: state?.name ?? "Unknown",
        stateType: state?.type ?? "unstarted",
        stateColor: state?.color ?? "#bec2c8",
        priority: issue.priority,
        priorityLabel: issue.priorityLabel,
        assignee: assignee?.displayName ?? assignee?.name,
        project: project?.name,
        projectId: project?.id,
        url: issue.url,
      });
    }

    return summaries;
  }

  private async fetchProjects(): Promise<LinearProjectSummary[]> {
    const connection = await this.client!.projects({ first: PAGE_SIZE });
    const summaries: LinearProjectSummary[] = [];

    for (const project of connection.nodes) {
      const [status, lead] = await Promise.all([
        project.status,
        project.lead,
      ]);

      summaries.push({
        id: project.id,
        name: project.name,
        state: status?.name ?? "Unknown",
        progress: progressPercent(project.progress) ?? 0,
        lead: lead?.displayName ?? lead?.name,
        url: project.url,
      });
    }

    return summaries;
  }

  private async fetchInitiatives(): Promise<LinearInitiativeSummary[]> {
    const connection = await this.client!.initiatives({ first: PAGE_SIZE });
    const summaries: LinearInitiativeSummary[] = [];

    for (const initiative of connection.nodes) {
      const [owner, projectsConnection] = await Promise.all([
        initiative.owner,
        initiative.projects({ first: 10 }),
      ]);

      const projectNames = projectsConnection.nodes.map((project) => project.name);

      const health = initiative.health;
      const statusLabel = health
        ? `${initiative.status} · ${health}`
        : initiative.status;

      summaries.push({
        id: initiative.id,
        name: initiative.name,
        status: statusLabel,
        owner: owner?.displayName ?? owner?.name,
        progress: undefined,
        projectNames,
        url: initiative.url,
      });
    }

    return summaries;
  }

  private async fetchReviews(): Promise<LinearReviewSummary[]> {
    const connection = await this.client!.notifications({
      first: PAGE_SIZE,
    });

    const summaries: LinearReviewSummary[] = [];

    for (const notification of connection.nodes) {
      if (notification.category !== NotificationCategory.Reviews) {
        continue;
      }
      const actor = await notification.actor;
      const author =
        actor?.displayName ??
        actor?.name ??
        (await notification.externalUserActor)?.name;

      const readStatus = notification.readAt ? "Read" : "Unread";
      let title = humanizeNotificationType(notification.type);
      let url = "https://linear.app/inbox";

      const issueId = (notification as { issueId?: string }).issueId;
      const pullRequestId = (notification as { pullRequestId?: string })
        .pullRequestId;

      if (issueId) {
        try {
          const issue = await this.client!.issue(issueId);
          title = `${issue.identifier} · ${issue.title}`;
          url = issue.url;
        } catch {
          title = `${title} (${issueId.slice(0, 8)}…)`;
        }
      } else if (pullRequestId) {
        title = `${title} · PR ${pullRequestId.slice(0, 8)}…`;
        url = "https://linear.app/reviews";
      }

      summaries.push({
        id: notification.id,
        title,
        status: readStatus,
        author,
        url,
      });
    }

    return summaries;
  }

  async fetchIssueDetail(issueId: string): Promise<LinearIssueDetail> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const issue = await this.client.issue(issueId);
    const [state, assignee, project, projectMilestone, team] = await Promise.all([
      issue.state,
      issue.assignee,
      issue.project,
      issue.projectMilestone,
      issue.team,
    ]);

    const [labelsConnection, childrenConnection, commentsConnection] =
      await Promise.all([
        issue.labels(),
        issue.children({ first: 50 }),
        issue.comments({ first: 20 }),
      ]);

    const subIssues = await Promise.all(
      childrenConnection.nodes.map(async (child) => {
        const childState = await child.state;
        return {
          id: child.id,
          identifier: child.identifier,
          title: child.title,
          state: childState?.name ?? "Unknown",
          stateColor: childState?.color ?? "#bec2c8",
        };
      })
    );

    const comments = await Promise.all(
      commentsConnection.nodes.map(async (comment) => {
        const user = await comment.user;
        return {
          id: comment.id,
          body: comment.body,
          authorName: user?.displayName ?? user?.name,
          createdAt: comment.createdAt.toISOString(),
        };
      })
    );

    if (!state || !team) {
      throw new Error("Issue is missing required state or team.");
    }

    return mapIssueDetail({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? undefined,
      url: issue.url,
      updatedAt: issue.updatedAt.toISOString(),
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      teamId: team.id,
      state: {
        id: state.id,
        name: state.name,
        type: state.type,
        color: state.color,
      },
      assignee: assignee
        ? {
            id: assignee.id,
            name: assignee.displayName ?? assignee.name,
          }
        : undefined,
      project: project
        ? { id: project.id, name: project.name }
        : undefined,
      milestone: projectMilestone
        ? { id: projectMilestone.id, name: projectMilestone.name }
        : undefined,
      labels: labelsConnection.nodes.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      })),
      subIssues,
      comments,
    });
  }

  async fetchTeamWorkflowStates(
    teamId: string
  ): Promise<LinearWorkflowState[]> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const team = await this.client.team(teamId);
    const statesConnection = await team.states();
    return statesConnection.nodes.map((state) => ({
      id: state.id,
      name: state.name,
      type: state.type,
      color: state.color,
    }));
  }

  async updateIssue(
    issueId: string,
    patch: IssuePatch
  ): Promise<LinearIssueDetail> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const { id, input } = buildIssueUpdateInput(issueId, patch);
    const result = await this.client.updateIssue(id, input);
    if (!result.success) {
      throw new Error("Linear rejected issue update.");
    }
    return this.fetchIssueDetail(issueId);
  }

  async createComment(
    issueId: string,
    body: string
  ): Promise<LinearIssueDetail> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const { issueId: id, body: commentBody } = buildCommentCreateInput(
      issueId,
      body
    );
    const result = await this.client.createComment({
      issueId: id,
      body: commentBody,
    });
    if (!result.success) {
      throw new Error("Linear rejected comment creation.");
    }
    return this.fetchIssueDetail(issueId);
  }

  private async mapBoardIssueNode(
    issue: Awaited<ReturnType<LinearClient["issue"]>>
  ) {
    const [state, assignee, projectMilestone, labelsConnection] =
      await Promise.all([
        issue.state,
        issue.assignee,
        issue.projectMilestone,
        issue.labels(),
      ]);

    if (!state) {
      throw new Error(`Issue ${issue.id} is missing workflow state.`);
    }

    return mapBoardIssue({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      url: issue.url,
      updatedAt: issue.updatedAt.toISOString(),
      createdAt: issue.createdAt.toISOString(),
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      state: {
        id: state.id,
        name: state.name,
        type: state.type,
        color: state.color,
      },
      assignee: assignee
        ? {
            id: assignee.id,
            name: assignee.displayName ?? assignee.name,
          }
        : undefined,
      labels: labelsConnection.nodes.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      })),
      milestone: projectMilestone
        ? { id: projectMilestone.id, name: projectMilestone.name }
        : undefined,
    });
  }

  async fetchProjectBoardMeta(
    projectId: string
  ): Promise<LinearProjectBoardMeta> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const project = await this.client.project(projectId);
    const teamsConnection = await project.teams();
    const team = teamsConnection.nodes[0];
    if (!team) {
      throw new Error("Project has no linked team.");
    }

    return {
      id: project.id,
      name: project.name,
      url: project.url,
      teamId: team.id,
      progress: progressPercent(project.progress) ?? 0,
    };
  }

  async fetchProjectBoardPage(
    projectId: string,
    cursor?: string,
    pageSize: number = BOARD_PAGE_SIZE
  ): Promise<BoardIssuesPage> {
    if (!this.client) {
      throw new Error("Linear API key is not configured.");
    }

    const project = await this.client.project(projectId);
    const connection = await project.issues({
      first: pageSize,
      after: cursor,
    });

    const issues = await Promise.all(
      connection.nodes.map((issue) => this.mapBoardIssueNode(issue))
    );

    return {
      issues,
      hasNextPage: connection.pageInfo.hasNextPage,
      endCursor: connection.pageInfo.endCursor ?? undefined,
    };
  }
}

export { formatError };
