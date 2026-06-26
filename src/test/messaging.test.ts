import { describe, it, expect } from "vitest";
import {
  isWebviewRequest,
  type WebviewRequest,
} from "../webview/messaging";

describe("isWebviewRequest", () => {
  it("accepts updateIssue", () => {
    const msg: WebviewRequest = {
      type: "updateIssue",
      issueId: "abc",
      patch: { title: "New title" },
    };
    expect(isWebviewRequest(msg)).toBe(true);
  });

  it("rejects unknown type", () => {
    expect(isWebviewRequest({ type: "nope" })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isWebviewRequest(null)).toBe(false);
    expect(isWebviewRequest("ready")).toBe(false);
  });

  it("accepts moveIssue", () => {
    const msg: WebviewRequest = {
      type: "moveIssue",
      issueId: "issue-1",
      stateId: "state-2",
      projectId: "proj-1",
    };
    expect(isWebviewRequest(msg)).toBe(true);
  });

  it("accepts openIssue from board", () => {
    const msg: WebviewRequest = {
      type: "openIssue",
      issueId: "issue-1",
      label: "ABO-1: Fix auth",
    };
    expect(isWebviewRequest(msg)).toBe(true);
  });
});
