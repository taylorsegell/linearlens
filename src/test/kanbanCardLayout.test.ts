import { describe, expect, it } from "vitest";
import {
  KANBAN_CARD_CONTENT_HEIGHT,
  KANBAN_CARD_HEIGHT,
  KANBAN_CARD_TITLE_LINES,
  KANBAN_CARD_VERTICAL_MARGIN,
} from "../../webview-ui/src/kanbanCardLayout";

describe("kanbanCardLayout", () => {
  it("reserves two title lines and a footer inside FixedSizeList rows", () => {
    expect(KANBAN_CARD_TITLE_LINES).toBe(2);
    expect(KANBAN_CARD_CONTENT_HEIGHT).toBe(108);
    expect(KANBAN_CARD_VERTICAL_MARGIN).toBe(12);
    expect(KANBAN_CARD_HEIGHT).toBe(
      KANBAN_CARD_CONTENT_HEIGHT + KANBAN_CARD_VERTICAL_MARGIN
    );
    expect(KANBAN_CARD_HEIGHT).toBe(120);
  });

  it("is taller than the previous 92px row that clipped assignees", () => {
    expect(KANBAN_CARD_HEIGHT).toBeGreaterThan(92);
  });
});
