import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { FixedSizeList } from "react-window";
import { groupIssuesIntoSwimlanes } from "../../boardLogic";
import type { BoardIssueCard } from "../../hooks/useBoardMessaging";
import { Icon } from "../ui/Icon";
import { IssueCard } from "./IssueCard";

const PHASE_PREFIX = "phase-";
const CARD_HEIGHT = 92;
const COLUMN_WIDTH = 280;
const COLLAPSED_COLUMN_WIDTH = 40;

type WorkflowState = { id: string; name: string; color: string };

interface KanbanBoardViewProps {
  issues: BoardIssueCard[];
  workflowStates: WorkflowState[];
  hiddenStatusIds: string[];
  collapsedStatusIds: string[];
  groupBy: "none" | "phaseLabel" | "assignee";
  onMoveIssue: (issueId: string, stateId: string) => void;
  onOpenIssue: (issue: BoardIssueCard) => void;
  onCollapseColumn: (stateId: string) => void;
  onExpandColumn: (stateId: string) => void;
}

function useElementHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextHeight = Math.floor(entries[0]?.contentRect.height ?? 0);
      setHeight((current) => (current === nextHeight ? current : nextHeight));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, height };
}

function DraggableCard({
  issue,
  onOpen,
}: {
  issue: BoardIssueCard;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: issue.id });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="issue-card-wrapper"
      {...listeners}
      {...attributes}
    >
      <IssueCard issue={issue} onOpen={onOpen} />
    </div>
  );
}

function DroppableColumn({
  stateId,
  className,
  children,
}: {
  stateId: string;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${stateId}` });

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column${isOver ? " kanban-column-over" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      {children}
    </div>
  );
}

function ColumnIssueList({
  issues,
  onOpenIssue,
}: {
  issues: BoardIssueCard[];
  onOpenIssue: (issue: BoardIssueCard) => void;
}) {
  const { ref, height } = useElementHeight<HTMLDivElement>();

  return (
    <div ref={ref} className="kanban-column-body">
      {height > 0 &&
        (issues.length === 0 ? (
          <p className="kanban-column-empty">No issues</p>
        ) : (
          <FixedSizeList
            height={height}
            width={COLUMN_WIDTH}
            itemCount={issues.length}
            itemSize={CARD_HEIGHT}
          >
            {({ index, style }) => {
              const issue = issues[index];
              return (
                <div style={style}>
                  <DraggableCard
                    issue={issue}
                    onOpen={() => onOpenIssue(issue)}
                  />
                </div>
              );
            }}
          </FixedSizeList>
        ))}
    </div>
  );
}

function CollapsedColumnRail({
  state,
  count,
  onExpand,
}: {
  state: WorkflowState;
  count: number;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      className="kanban-column-collapsed"
      aria-label={`Expand ${state.name} column (${count})`}
      onClick={onExpand}
    >
      <span
        className="column-status-dot"
        style={{ backgroundColor: state.color }}
        aria-hidden
      />
      <span className="kanban-column-collapsed-label">{state.name}</span>
      <span className="column-count">{count}</span>
    </button>
  );
}

function ExpandedColumn({
  state,
  issues,
  onCollapseColumn,
  onOpenIssue,
}: {
  state: WorkflowState;
  issues: BoardIssueCard[];
  onCollapseColumn: (stateId: string) => void;
  onOpenIssue: (issue: BoardIssueCard) => void;
}) {
  return (
    <DroppableColumn stateId={state.id}>
      <header
        className="column-header"
        style={{ borderTopColor: state.color }}
      >
        <div className="column-header-main">
          <span
            className="column-status-dot"
            style={{ backgroundColor: state.color }}
            aria-hidden
          />
          <span className="column-title">{state.name}</span>
          <span className="column-count">{issues.length}</span>
        </div>
        <button
          type="button"
          className="column-collapse-btn"
          aria-label={`Collapse ${state.name} column`}
          onClick={() => onCollapseColumn(state.id)}
        >
          <Icon name="chevron-left" size={14} />
        </button>
      </header>
      <ColumnIssueList issues={issues} onOpenIssue={onOpenIssue} />
    </DroppableColumn>
  );
}

function partitionWorkflowStates(
  workflowStates: WorkflowState[],
  hiddenStatusIds: string[],
  collapsedStatusIds: string[]
) {
  const visible = workflowStates.filter(
    (state) => !hiddenStatusIds.includes(state.id)
  );
  return {
    collapsed: visible.filter((state) => collapsedStatusIds.includes(state.id)),
    expanded: visible.filter(
      (state) => !collapsedStatusIds.includes(state.id)
    ),
  };
}

export function KanbanBoardView({
  issues,
  workflowStates,
  hiddenStatusIds,
  collapsedStatusIds,
  groupBy,
  onMoveIssue,
  onOpenIssue,
  onCollapseColumn,
  onExpandColumn,
}: KanbanBoardViewProps) {
  const lanes = groupIssuesIntoSwimlanes(issues, groupBy, PHASE_PREFIX);
  const { collapsed, expanded } = partitionWorkflowStates(
    workflowStates,
    hiddenStatusIds,
    collapsedStatusIds
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const [activeIssue, setActiveIssue] = useState<BoardIssueCard | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const issue = issues.find((i) => i.id === event.active.id);
    setActiveIssue(issue ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveIssue(null);
    const issueId = String(event.active.id);
    const overId = event.over?.id;
    if (!overId || !String(overId).startsWith("column:")) {
      return;
    }
    const stateId = String(overId).replace("column:", "");
    onMoveIssue(issueId, stateId);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {lanes.map((lane) => (
          <section key={lane.id} className="kanban-swimlane">
            {groupBy !== "none" && (
              <h3 className="swimlane-title">{lane.label}</h3>
            )}
            <div className="kanban-columns">
              {collapsed.map((state) => {
                const columnIssues = lane.issues.filter(
                  (issue) => issue.state.id === state.id
                );
                return (
                  <CollapsedColumnRail
                    key={state.id}
                    state={state}
                    count={columnIssues.length}
                    onExpand={() => onExpandColumn(state.id)}
                  />
                );
              })}
              {expanded.map((state) => {
                const columnIssues = lane.issues.filter(
                  (issue) => issue.state.id === state.id
                );
                return (
                  <ExpandedColumn
                    key={state.id}
                    state={state}
                    issues={columnIssues}
                    onCollapseColumn={onCollapseColumn}
                    onOpenIssue={onOpenIssue}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? (
          <IssueCard issue={activeIssue} onOpen={() => undefined} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export {
  CARD_HEIGHT,
  COLLAPSED_COLUMN_WIDTH,
  COLUMN_WIDTH,
};
