interface PriorityIconProps {
  priority: number;
  className?: string;
}

const BAR_HEIGHTS = [3, 5, 7, 9, 11];

export function PriorityIcon({ priority, className }: PriorityIconProps) {
  if (priority <= 0) {
    return null;
  }
  const level = Math.min(Math.max(priority, 1), 4);
  return (
    <span className={`ll-priority${className ? ` ${className}` : ""}`} aria-hidden>
      {BAR_HEIGHTS.map((h, i) => (
        <span
          key={i}
          className={`ll-priority__bar${i < level ? " ll-priority__bar--filled" : ""}`}
          style={{ height: h }}
        />
      ))}
    </span>
  );
}
