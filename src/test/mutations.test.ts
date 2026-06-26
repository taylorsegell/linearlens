import { describe, it, expect } from "vitest";
import {
  buildCommentCreateInput,
  buildIssueUpdateInput,
} from "../linear/mutations";

describe("buildIssueUpdateInput", () => {
  it("maps title and stateId", () => {
    expect(
      buildIssueUpdateInput("id-1", { title: "New", stateId: "state-1" })
    ).toEqual({
      id: "id-1",
      input: { title: "New", stateId: "state-1" },
    });
  });

  it("omits undefined patch keys", () => {
    expect(buildIssueUpdateInput("id-1", { priority: 1 })).toEqual({
      id: "id-1",
      input: { priority: 1 },
    });
  });

  it("throws on empty patch", () => {
    expect(() => buildIssueUpdateInput("id-1", {})).toThrow(
      "Issue patch cannot be empty"
    );
  });
});

describe("buildCommentCreateInput", () => {
  it("trims body", () => {
    expect(buildCommentCreateInput("id-1", "  hello  ")).toEqual({
      issueId: "id-1",
      body: "hello",
    });
  });

  it("throws on empty body", () => {
    expect(() => buildCommentCreateInput("id-1", "   ")).toThrow(
      "Comment body is required"
    );
  });
});
