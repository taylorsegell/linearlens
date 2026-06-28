import boardIcon from "../../assets/icons/board.svg?raw";
import viewListIcon from "../../assets/icons/view-list.svg?raw";
import filtersIcon from "../../assets/icons/filters.svg?raw";
import plusIcon from "../../assets/icons/plus.svg?raw";
import chevronDownIcon from "../../assets/icons/chevron-down.svg?raw";
import chevronLeftIcon from "../../assets/icons/chevron-left.svg?raw";

const ICONS = {
  board: boardIcon,
  "view-list": viewListIcon,
  filters: filtersIcon,
  plus: plusIcon,
  "chevron-down": chevronDownIcon,
  "chevron-left": chevronLeftIcon,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  label?: string;
}

export function Icon({ name, size = 16, className, label }: IconProps) {
  const svg = ICONS[name];
  return (
    <span
      className={["ll-icon", className].filter(Boolean).join(" ")}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ display: "inline-flex", width: size, height: size, color: "inherit" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
