import type { IssuePatch } from "../webview/messaging";

export function buildIssueUpdateInput(
  issueId: string,
  patch: IssuePatch
): { id: string; input: Record<string, unknown> } {
  const input: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    input.title = patch.title;
  }
  if (patch.description !== undefined) {
    input.description = patch.description;
  }
  if (patch.priority !== undefined) {
    input.priority = patch.priority;
  }
  if (patch.stateId !== undefined) {
    input.stateId = patch.stateId;
  }

  if (Object.keys(input).length === 0) {
    throw new Error("Issue patch cannot be empty");
  }

  return { id: issueId, input };
}

export function buildCommentCreateInput(
  issueId: string,
  body: string
): { issueId: string; body: string } {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Comment body is required");
  }
  return { issueId, body: trimmed };
}
