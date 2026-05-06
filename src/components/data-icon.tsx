import {
  IconChartScatter,
  IconChartScatter3d,
  IconFolder,
  IconHash,
  IconPalette,
  IconPercentage,
  IconRotate360,
} from "@tabler/icons-react";
import { Angle } from "@semio/ui";
import { Ruler } from "@solar-icons/react-perf/LineDuotone";

export function DataIcon({
  iconCode,
  className,
  size,
  ...props
}: {
  iconCode: string;
  className?: string;
  size?: number | string;
}) {
  switch (iconCode) {
    case "group":
      return <IconFolder className={className} size={size} {...props} />;
    case "vector2":
      return <IconChartScatter className={className} size={size} {...props} />;
    case "vector3":
      return <IconChartScatter3d className={className} size={size} {...props} />;
    case "euler":
      return <IconRotate360 className={className} size={size} {...props} />;
    case "rgb":
    case "hsl":
      return <IconPalette className={className} size={size} {...props} />;
    case "rad":
      return <Angle className={className} size="100%" {...props} />;
    case "deg":
      return <Angle className={className} size="100%" {...props} />;
    case "m":
      return <Ruler className={className} size="100%" {...props} />;
    case "mm":
      return <Ruler className={className} size="100%" {...props} />;
    case "cm":
      return <Ruler className={className} size="100%" {...props} />;
    case "km":
      return <Ruler className={className} size="100%" {...props} />;
    case "%":
      return <IconPercentage className={className} size={size} {...props} />;
    default:
      return <IconHash className={className} size={size} {...props} />;
  }
}
