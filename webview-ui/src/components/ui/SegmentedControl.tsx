import { Icon, type IconName } from "./Icon";

export interface SegmentedOption<T extends string> {
  value: T;
  icon: IconName;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  "aria-label"?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div className="ll-segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={
            value === opt.value
              ? "ll-segmented__btn ll-segmented__btn--active"
              : "ll-segmented__btn"
          }
          title={opt.label}
          aria-label={opt.label}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          <Icon name={opt.icon} size={14} />
        </button>
      ))}
    </div>
  );
}
