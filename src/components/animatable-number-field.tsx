import { SliderNumberField, Size } from "@semio/ui";
import { unitDisplay } from "@semio/utils";
import { type AnimatableNumber } from "@semio/data";

export interface AnimatableNumberFieldProps {
  animatable: AnimatableNumber;
  /** The STORED value: radians, a fraction for a percentage. */
  value: number;
  /** Called with the STORED value for what the person entered. */
  onChange: (stored: number) => void;
  color?: string;
  disabled?: boolean;
  label?: string;
  wrapperClassName?: string;
  className?: string;
}

/**
 * A numeric animatable's value as an editable field, in the units a person reads.
 *
 * The one place a field converts between stored and displayed values (see
 * `unitDisplay`): it shows radians in degrees and a percentage's fraction as 0–100,
 * converts the animatable's limits the same way, and hands `onChange` the stored
 * value back. Every surface editing a numeric animatable's value directly renders
 * this rather than wiring the conversion itself, so none of them can show one unit
 * and store another.
 */
export function AnimatableNumberField({
  animatable,
  value,
  onChange,
  color,
  disabled,
  label,
  wrapperClassName,
  className,
}: AnimatableNumberFieldProps) {
  const display = unitDisplay(animatable.pub?.units);
  const constraints = animatable.constraints;
  const min = typeof constraints?.min === "number" ? display.toDisplay(constraints.min) : undefined;
  const max = typeof constraints?.max === "number" ? display.toDisplay(constraints.max) : undefined;
  const hasFiniteBounds =
    min !== undefined && max !== undefined && min !== -Infinity && max !== Infinity;

  return (
    <SliderNumberField
      size={Size.Sm}
      strictText={false}
      strictSlider={hasFiniteBounds}
      disabled={disabled}
      value={display.toDisplay(value)}
      min={min}
      max={max}
      relativeDragRange={hasFiniteBounds ? undefined : display.relativeDragRange}
      color={color}
      onChange={(shown) => onChange(display.fromDisplay(shown))}
      units={display.label}
      label={label}
      wrapperClassName={wrapperClassName}
      className={className}
    />
  );
}
