import { forwardRef, type ReactNode } from "react";
import { Button, Tooltip, type ButtonProps } from "@semio/ui";

export interface ToolbarTooltipButtonProps extends ButtonProps {
  tooltip: ReactNode;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

export const ToolbarTooltipButton = forwardRef<HTMLButtonElement, ToolbarTooltipButtonProps>(
  ({ tooltip, tooltipSide = "top", ...props }, ref) => {
    return (
      <Tooltip content={tooltip} side={tooltipSide}>
        <Button ref={ref} {...props} />
      </Tooltip>
    );
  },
);

ToolbarTooltipButton.displayName = "ToolbarTooltipButton";
