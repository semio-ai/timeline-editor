import { IconChevronDown } from "@tabler/icons-react";
import { clsx } from "clsx";
import { Button, Tooltip } from "@semio/ui";

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
    <Tooltip content={expanded ? "Collapse" : "Expand"} disabled={false} invert>
      <Button
        size="fit"
        visuals="inverted"
        color={color}
        disabled={isDisabled}
        onClick={isDisabled ? undefined : () => onToggle?.(!expanded)}
        leftIcon={
          <IconChevronDown
            className={clsx(
              "transition-transform",
              expanded ? "-rotate-180 size-3" : "rotate-0 size-3",
            )}
          />
        }
      />
    </Tooltip>
  );
}
