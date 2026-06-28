import { describe, expect, it } from "vitest";
import { markdownToHtml } from "../linear/markdown";

describe("markdownToHtml", () => {
  it("renders bold text and bullet lists", () => {
    const html = markdownToHtml("**Plan:**\n\n* First item\n* Second item");
    expect(html).toContain("<strong>Plan:</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>First item</li>");
  });

  it("renders links and inline code", () => {
    const html = markdownToHtml("See [docs](https://linear.app) and `code`");
    expect(html).toContain('<a href="https://linear.app">docs</a>');
    expect(html).toContain("<code>code</code>");
  });

  it("renders GFM tables", () => {
    const html = markdownToHtml(
      "| Tool | Maps to |\n| --- | --- |\n| get_inventory | Inventory API |"
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Tool</th>");
    expect(html).toContain("<td>get_inventory</td>");
    expect(html).not.toContain("| --- |");
  });

  it("renders tables with short (-- ) separator rows from Linear", () => {
    const html = markdownToHtml(
      "| MCP tool name | Maps to | Description |\n| -- | -- | -- |\n| `abodi_get_inventory` | Inventory API | Get inventory |"
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<th>MCP tool name</th>");
    expect(html).toContain("<code>abodi_get_inventory</code>");
    expect(html).toContain("<td>Inventory API</td>");
    expect(html).not.toContain("| -- |");
  });

  it("renders horizontal rules", () => {
    const html = markdownToHtml("Above\n\n---\n\nBelow");
    expect(html).toContain("<hr>");
    expect(html).not.toContain("<p>---</p>");
  });

  it("renders task lists", () => {
    const html = markdownToHtml("- [ ] Todo item\n- [x] Done item");
    expect(html).toContain('class="task-list"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Todo item");
    expect(html).toContain("checked");
    expect(html).toContain("Done item");
  });

  it("joins soft line breaks within a paragraph", () => {
    const html = markdownToHtml("Line one\nLine two");
    expect(html).toContain("Line one<br>Line two");
  });
});
