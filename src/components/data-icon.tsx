import { Icon } from "@semio/ui";

export function DataIcon({
  iconCode,
  className,
  size,
}: {
  iconCode: string;
  className?: string;
  size?: number | string;
}) {
  // When a caller passes an explicit size, disable Icon's self-sizing and let
  // the className carry the dimensions; otherwise Icon self-sizes.
  const sizeProps = size !== undefined ? ({ size: "none" } as const) : {};
  switch (iconCode) {
    case "group":
      return <Icon name="data-group" className={className} {...sizeProps} />;
    case "vector2":
      return <Icon name="data-vector2" className={className} {...sizeProps} />;
    case "vector3":
      return <Icon name="data-vector3" className={className} {...sizeProps} />;
    case "euler":
      return <Icon name="data-euler" className={className} {...sizeProps} />;
    case "rgb":
      return <Icon name="data-rgb" className={className} {...sizeProps} />;
    case "hsl":
      return <Icon name="data-hsl" className={className} {...sizeProps} />;
    case "rad":
      return <Icon name="unit-radian" className={className} {...sizeProps} />;
    case "deg":
      return <Icon name="unit-degree" className={className} {...sizeProps} />;
    case "m":
      return <Icon name="unit-meter" className={className} {...sizeProps} />;
    case "mm":
      return <Icon name="unit-millimeter" className={className} {...sizeProps} />;
    case "cm":
      return <Icon name="unit-centimeter" className={className} {...sizeProps} />;
    case "km":
      return <Icon name="unit-kilometer" className={className} {...sizeProps} />;
    case "%":
      return <Icon name="unit-percent" className={className} {...sizeProps} />;
    case "number":
      return <Icon name="data-number" className={className} {...sizeProps} />;
    case "text":
      return <Icon name="data-text" className={className} {...sizeProps} />;
    case "binary":
      return <Icon name="data-binary" className={className} {...sizeProps} />;
    case "none":
      return <Icon name="data-none" className={className} {...sizeProps} />;
    default:
      return <Icon name="data-none" className={className} {...sizeProps} />;
  }
}
