import { IconChevronDown } from "@tabler/icons-react";
import { clsx } from "clsx";
import { Button, ICON_CLASS_NAME, Size, Tooltip } from "@semio/ui";

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
        size={Size.Md}
        visuals="inverted"
        color={color}
        disabled={isDisabled}
        onClick={isDisabled ? undefined : () => onToggle?.(!expanded)}
        leftIcon={
          <IconChevronDown
            className={clsx(
              ICON_CLASS_NAME,
              "transition-transform",
              expanded ? "-rotate-180" : "rotate-0",
            )}
          />
        }
      />
    </Tooltip>
  );
}
