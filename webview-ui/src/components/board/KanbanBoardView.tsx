import { useState, type ReactNode } from "react";
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
import { IssueCard } from "./IssueCard";

const PHASE_PREFIX = "phase-";
const CARD_HEIGHT = 88;
const COLUMN_WIDTH = 280;
const COLUMN_HEIGHT = 480;

interface KanbanBoardViewProps {
  issues: BoardIssueCard[];
  workflowStates: { id: string; name: string; color: string }[];
  groupBy: "none" | "phaseLabel" | "assignee";
  onMoveIssue: (issueId: string, stateId: string) => void;
  onOpenIssue: (issue: BoardIssueCard) => void;
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
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 }
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
  children,
}: {
  stateId: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${stateId}` });

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column${isOver ? " kanban-column-over" : ""}`}
    >
      {children}
    </div>
  );
}

export function KanbanBoardView({
  issues,
  workflowStates,
  groupBy,
  onMoveIssue,
  onOpenIssue,
}: KanbanBoardViewProps) {
  const lanes = groupIssuesIntoSwimlanes(issues, groupBy, PHASE_PREFIX);
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
              {workflowStates.map((state) => {
                const columnIssues = lane.issues.filter(
                  (i) => i.state.id === state.id
                );
                return (
                  <DroppableColumn key={state.id} stateId={state.id}>
                    <header
                      className="column-header"
                      style={{ borderColor: state.color }}
                    >
                      {state.name}
                      <span className="column-count">
                        {columnIssues.length}
                      </span>
                    </header>
                    <FixedSizeList
                      height={COLUMN_HEIGHT}
                      width={COLUMN_WIDTH}
                      itemCount={columnIssues.length}
                      itemSize={CARD_HEIGHT}
                    >
                      {({ index, style }) => {
                        const issue = columnIssues[index];
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
                  </DroppableColumn>
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
