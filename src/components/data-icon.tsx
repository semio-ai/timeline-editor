import {
  IconAngle,
  IconChartScatter,
  IconChartScatter3d,
  IconFolder,
  IconHash,
  IconPalette,
  IconPercentage,
  IconRotate360,
  IconRuler2,
} from "@tabler/icons-react";

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
      return <IconAngle className={className} size={size} {...props} />;
    case "deg":
      return <IconAngle className={className} size={size} {...props} />;
    case "m":
      return <IconRuler2 className={className} size={size} {...props} />;
    case "mm":
      return <IconRuler2 className={className} size={size} {...props} />;
    case "cm":
      return <IconRuler2 className={className} size={size} {...props} />;
    case "km":
      return <IconRuler2 className={className} size={size} {...props} />;
    case "%":
      return <IconPercentage className={className} size={size} {...props} />;
    default:
      return <IconHash className={className} size={size} {...props} />;
  }
}
