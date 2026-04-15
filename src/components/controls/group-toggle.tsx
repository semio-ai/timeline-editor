import { IconChevronDown } from "@tabler/icons-react";
import { clsx } from "clsx";

export interface GroupToggleProps {
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  disabled?: boolean;
  color?: string;
}

export function GroupToggle({
  expanded = true,
  onToggle,
  disabled = false,
  color,
}: GroupToggleProps) {
  const isDisabled = disabled || !onToggle;
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={isDisabled ? undefined : () => onToggle?.(!expanded)}
      className={clsx(
        "flex items-center justify-center",
        "size-5 cursor-pointer rounded-xs",
        "transition-colors hover:bg-neutral-500/20",
        isDisabled && "pointer-events-none opacity-40",
      )}
      style={{ color: color ?? "currentColor" }}
    >
      <IconChevronDown
        size={16}
        className={clsx(
          "transition-transform",
          expanded ? "rotate-0" : "-rotate-90",
        )}
      />
    </button>
  );
}
