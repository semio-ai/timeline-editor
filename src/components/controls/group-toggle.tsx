import { Icon } from "@semio/ui";
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
      onPointerDown={(e) => e.stopPropagation()}
      onClick={isDisabled ? undefined : () => onToggle?.(!expanded)}
      className={clsx(
        "flex items-center justify-center",
        "size-5 cursor-pointer rounded-xs",
        "transition-colors hover:bg-neutral-500/20",
        isDisabled && "pointer-events-none opacity-40",
      )}
      style={{ color: color ?? "currentColor" }}
    >
      <Icon
        name="chevron-down"
        size="none"
        className={clsx(
          "size-[16px] transition-transform",
          expanded ? "rotate-0" : "-rotate-90",
        )}
      />
    </button>
  );
}
