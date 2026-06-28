import { Icon } from "../ui/Icon";

interface StatusColumnPickerProps {
  workflowStates: { id: string; name: string; color: string }[];
  hiddenStatusIds: string[];
  onToggleHidden: (stateId: string) => void;
}

export function StatusColumnPicker({
  workflowStates,
  hiddenStatusIds,
  onToggleHidden,
}: StatusColumnPickerProps) {
  const visibleCount = workflowStates.length - hiddenStatusIds.length;

  return (
    <details className="column-picker">
      <summary className="column-picker-trigger ll-btn-secondary">
        <Icon name="filters" size={14} label="Columns" />
        Columns ({visibleCount})
        <Icon name="chevron-down" size={12} />
      </summary>
      <div className="column-picker-menu" role="menu">
        <p className="column-picker-heading">Visible columns</p>
        {workflowStates.map((state) => {
          const visible = !hiddenStatusIds.includes(state.id);
          return (
            <label key={state.id} className="column-picker-item">
              <input
                type="checkbox"
                checked={visible}
                onChange={() => onToggleHidden(state.id)}
              />
              <span
                className="column-status-dot"
                style={{ backgroundColor: state.color }}
                aria-hidden
              />
              <span className="column-picker-label">{state.name}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}
