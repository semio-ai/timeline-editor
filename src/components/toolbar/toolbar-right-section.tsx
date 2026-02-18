import { memo } from "react";
import { Button, Size, Tooltip } from "@semio/ui";
import { IconArrowUpRight } from "@tabler/icons-react";

export const ToolbarRightSection = memo(function ToolbarRightSection() {
  return (
    <div className="rounded-sm flex responsive variant-responsive-persistent-outline gap-0.5 p-0.5">
      <Tooltip content="Pop out timeline (Coming Soon)">
        <span className="inline-flex">
          <Button
            visuals="inverted"
            size={Size.Sm}
            leftIcon={<IconArrowUpRight className="h-3/4 aspect-square" />}
            className="bg-neutral-500/10 hover:bg-neutral-500/25 rounded-xs"
            altText="Pop Out (Coming Soon)"
            disabled
          />
        </span>
      </Tooltip>
    </div>
  );
});
