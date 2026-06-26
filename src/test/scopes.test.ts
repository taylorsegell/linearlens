import { describe, it, expect } from "vitest";
import { scopesKey, scopesMatch } from "../oauth/scopes";

describe("scopesKey", () => {
  it("sorts and joins scopes", () => {
    expect(scopesKey(["write", "read"])).toBe("read,write");
  });

  it("does not mutate the input array", () => {
    const input = ["write", "read"];
    scopesKey(input);
    expect(input).toEqual(["write", "read"]);
  });
});

describe("scopesMatch", () => {
  it("matches when stored scopes cover requested scopes", () => {
    expect(scopesMatch(["read", "write"], ["read"])).toBe(true);
  });

  it("rejects when stored scopes are insufficient", () => {
    expect(scopesMatch(["read"], ["read", "write"])).toBe(false);
  });

  it("matches identical scopes", () => {
    expect(scopesMatch(["read"], ["read"])).toBe(true);
  });
});
