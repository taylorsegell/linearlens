function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatInline(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>'
  );
  return html;
}

function isHorizontalRule(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim());
}

function isTableRow(line: string): boolean {
  return line.trim().includes("|");
}

function isTableSeparator(line: string): boolean {
  const cells = parseTableCells(line);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-+:?$/.test(cell))
  );
}

function parseTableCells(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.endsWith("|")) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed.split("|").map((cell) => cell.trim());
}

function renderTable(headerLine: string, bodyLines: string[]): string {
  const headers = parseTableCells(headerLine);
  const head = `<tr>${headers
    .map((cell) => `<th>${formatInline(cell)}</th>`)
    .join("")}</tr>`;
  const body = bodyLines
    .map((line) => {
      const cells = parseTableCells(line);
      return `<tr>${cells
        .map((cell) => `<td>${formatInline(cell)}</td>`)
        .join("")}</tr>`;
    })
    .join("");
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

type ListKind = "bullet" | "ordered" | "task";

function parseListItem(line: string): { kind: ListKind; checked?: boolean; text: string } | null {
  const trimmed = line.trim();
  const taskMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
  if (taskMatch) {
    return {
      kind: "task",
      checked: taskMatch[1].toLowerCase() === "x",
      text: taskMatch[2],
    };
  }
  const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
  if (bulletMatch) {
    return { kind: "bullet", text: bulletMatch[1] };
  }
  const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
  if (orderedMatch) {
    return { kind: "ordered", text: orderedMatch[1] };
  }
  return null;
}

function renderListItem(item: { kind: ListKind; checked?: boolean; text: string }): string {
  if (item.kind === "task") {
    const checkedAttr = item.checked ? " checked" : "";
    return `<li class="task-list-item"><input type="checkbox" disabled${checkedAttr} aria-hidden="true" tabindex="-1" /><span>${formatInline(item.text)}</span></li>`;
  }
  return `<li>${formatInline(item.text)}</li>`;
}

function renderList(items: { kind: ListKind; checked?: boolean; text: string }[]): string {
  const kind = items[0]?.kind ?? "bullet";
  if (kind === "task") {
    return `<ul class="task-list">${items.map(renderListItem).join("")}</ul>`;
  }
  if (kind === "ordered") {
    return `<ol>${items.map(renderListItem).join("")}</ol>`;
  }
  return `<ul>${items.map(renderListItem).join("")}</ul>`;
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let i = 0;

  const flushCode = () => {
    if (codeLines.length === 0) {
      return;
    }
    blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        flushCode();
      } else {
        inCodeBlock = true;
      }
      i += 1;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      i += 1;
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    if (isHorizontalRule(trimmed)) {
      blocks.push("<hr>");
      i += 1;
      continue;
    }

    if (
      isTableRow(trimmed) &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1].trim())
    ) {
      const headerLine = trimmed;
      const bodyLines: string[] = [];
      i += 2;
      while (i < lines.length) {
        const row = lines[i].trim();
        if (!row || !isTableRow(row) || isTableSeparator(row)) {
          break;
        }
        bodyLines.push(row);
        i += 1;
      }
      blocks.push(renderTable(headerLine, bodyLines));
      continue;
    }

    const firstItem = parseListItem(line);
    if (firstItem) {
      const listItems = [firstItem];
      i += 1;
      while (i < lines.length) {
        const nextItem = parseListItem(lines[i]);
        if (!nextItem || nextItem.kind !== firstItem.kind) {
          break;
        }
        listItems.push(nextItem);
        i += 1;
      }
      blocks.push(renderList(listItems));
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(`<h4>${formatInline(trimmed.slice(4))}</h4>`);
      i += 1;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push(`<h3>${formatInline(trimmed.slice(3))}</h3>`);
      i += 1;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push(`<h2>${formatInline(trimmed.slice(2))}</h2>`);
      i += 1;
      continue;
    }

    const paragraphLines = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i];
      const nextTrimmed = next.trim();
      if (
        !nextTrimmed ||
        isHorizontalRule(nextTrimmed) ||
        isTableSeparator(nextTrimmed) ||
        parseListItem(next) ||
        (isTableRow(nextTrimmed) &&
          i + 1 < lines.length &&
          isTableSeparator(lines[i + 1].trim())) ||
        nextTrimmed.startsWith("#") ||
        nextTrimmed.startsWith("```")
      ) {
        break;
      }
      paragraphLines.push(nextTrimmed);
      i += 1;
    }
    blocks.push(
      `<p>${paragraphLines.map((part) => formatInline(part)).join("<br>")}</p>`
    );
  }

  if (inCodeBlock) {
    flushCode();
  }

  return blocks.join("\n");
}
