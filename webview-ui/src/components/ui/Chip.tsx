import type { ButtonHTMLAttributes } from "react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  dashed?: boolean;
}

export function Chip({
  active = false,
  dashed = false,
  className = "",
  type = "button",
  ...props
}: ChipProps) {
  const classes = [
    "ll-chip",
    active ? "ll-chip--active" : "",
    dashed ? "ll-chip--dashed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...props} />;
}
