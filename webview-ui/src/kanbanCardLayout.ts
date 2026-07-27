/**
 * Kanban FixedSizeList row geometry for IssueCard.
 * Keep in sync with `.issue-card*` rules in webview-ui/src/styles.css.
 *
 * Usable card box = KANBAN_CARD_HEIGHT - KANBAN_CARD_VERTICAL_MARGIN
 * (wrapper is 100% of the list row; card uses height: calc(100% - 12px)).
 */

export const KANBAN_CARD_TITLE_LINES = 2;

/** Matches `.issue-card { height: calc(100% - 12px) }` (6px + 6px vertical margin). */
export const KANBAN_CARD_VERTICAL_MARGIN = 12;

const PADDING_Y = 24; // padding: 12px
const HEADER_Y = 18;
const TITLE_MARGIN_Y = 10; // margin: 4px 0 6px
const TITLE_LINE_Y = 17; // ceil(12px * 1.35)
const FOOTER_Y = 22;

export const KANBAN_CARD_CONTENT_HEIGHT =
  PADDING_Y +
  HEADER_Y +
  TITLE_MARGIN_Y +
  TITLE_LINE_Y * KANBAN_CARD_TITLE_LINES +
  FOOTER_Y;

/** react-window FixedSizeList itemSize */
export const KANBAN_CARD_HEIGHT =
  KANBAN_CARD_CONTENT_HEIGHT + KANBAN_CARD_VERTICAL_MARGIN;

/** @deprecated Prefer KANBAN_CARD_HEIGHT — kept as the board's public constant name. */
export const CARD_HEIGHT = KANBAN_CARD_HEIGHT;
