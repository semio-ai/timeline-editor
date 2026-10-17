import { Icon, KeyIcon, ToggleSquare, Size } from "@semio/ui";
import { useAnimationStore } from "../hooks";
import { ControlStripMode } from "../store-types";

export function ControlStripModeToggle() {
  const mode = useAnimationStore((state) => state.preferences.controlStripMode);
  const setPreferences = useAnimationStore((state) => state.setPreferences);
  const properties = mode === ControlStripMode.Properties;
  return (
    <ToggleSquare
      sizing="inner"
      size={Size.Xs}
      label={properties ? "Show key controls" : "Show track properties"}
      value={properties}
      onChange={() =>
        setPreferences({
          controlStripMode: properties ? ControlStripMode.KeySkip : ControlStripMode.Properties,
        })
      }
    >
      {properties ? (
        <Icon name="settings" size="none" className="block w-3.5 h-3.5 shrink-0" />
      ) : (
        <KeyIcon fillOpacity={0} className="block w-3.5 h-3.5 shrink-0" />
      )}
    </ToggleSquare>
  );
}
