import { CSSProperties, memo, ReactNode, useCallback, useMemo } from "react";
import {
  Dropdown,
  ICON_CLASS_NAME,
  Icon,
  IconHandleIndicator,
  NestedItem,
  NestedLabel,
  NestedMenu,
  NestedRadio,
  NestedSeparator,
  Size,
} from "@semio/ui";
import { useShallow } from "zustand/shallow";
import { clsx } from "clsx";
import {
  buildSelectedKeyContexts,
  contextHasNeighbor,
  normalizeTransitionForUi,
  resolvePairingForContext,
  type SelectedKeyContext,
} from "../../functions/key-transition-ui-utils";
import { useAnimationStore, useColors } from "../../hooks";
import {
  TransitionDirective,
  type TransitionPatch,
  type TransitionPreference,
} from "../../store-types";
import { StandardTransitionType, TransitionPairing } from "../../types";
import { ToolbarTooltipButton } from "./toolbar-tooltip-button";

const MIXED_VALUE = "__mixed__";
const TRANSITION_ICON_CLASS = ICON_CLASS_NAME;
const TRANSITION_TEXT_BUTTON_CLASS = "hidden @[750px]:flex";
const TRANSITION_ICON_ONLY_BUTTON_CLASS = "flex @[750px]:hidden";
type HandleIndicatorType = "diamond" | "circle" | "indeterminate";

const TRANSITION_OPTIONS: { value: TransitionPreference; label: string; icon?: ReactNode }[] = [
  {
    value: StandardTransitionType.Sine,
    label: "Sinusoidal",
    icon: <Icon name="vector-sine" />,
  },
  {
    value: StandardTransitionType.Cubic,
    label: "Cubic",
    icon: <Icon name="vector-cubic" />,
  },
  {
    value: StandardTransitionType.Quint,
    label: "Quintic",
    icon: <Icon name="vector-quint" />,
  },
  {
    value: StandardTransitionType.Circ,
    label: "Circular",
    icon: <Icon name="vector-circ" />,
  },
  {
    value: StandardTransitionType.Quad,
    label: "Quadratic",
    icon: <Icon name="vector-quad" />,
  },
  {
    value: StandardTransitionType.Quart,
    label: "Quartic",
    icon: <Icon name="vector-quart" />,
  },
  {
    value: StandardTransitionType.Expo,
    label: "Exponential",
    icon: <Icon name="vector-expo" />,
  },
  {
    value: StandardTransitionType.Back,
    label: "Back",
    icon: <Icon name="vector-back" />,
  },
  {
    value: StandardTransitionType.Linear,
    label: "Linear",
    icon: <Icon name="vector-linear" />,
  },
  {
    value: TransitionDirective.ExplicitHandles,
    label: "Bezier Handles",
    icon: <Icon name="vector-bezier-handles" />,
  },
  {
    value: TransitionDirective.InferredAutoClamped,
    label: "Auto Clamped",
    icon: <Icon name="vector-bezier-auto-clamp" />,
  },
];

const DEFAULT_NEW_KEY_TRANSITIONS: {
  in: TransitionPreference;
  out: TransitionPreference;
  pairing: TransitionPairing;
} = {
  in: StandardTransitionType.Cubic,
  out: StandardTransitionType.Cubic,
  pairing: TransitionPairing.Paired,
};

const TRANSITION_PREFERENCE_VALUES = new Set<string>([
  StandardTransitionType.Sine,
  StandardTransitionType.Cubic,
  StandardTransitionType.Quint,
  StandardTransitionType.Circ,
  StandardTransitionType.Quad,
  StandardTransitionType.Quart,
  StandardTransitionType.Expo,
  StandardTransitionType.Back,
  StandardTransitionType.Linear,
  TransitionDirective.ExplicitHandles,
  TransitionDirective.InferredAutoClamped,
]);

export const KeyToolbarSection = memo(function KeyToolbarSection() {
  const {
    keypointSelectionMap,
    trackMap,
    preferences,
    updateNewKeyTransitionDefaults,
    updateSelectedKeyTransitions,
    flattenSelectedKeyHandles,
  } = useAnimationStore(
    useShallow((state) => ({
      keypointSelectionMap: state.selectionState.keypoints,
      trackMap: state.tracks,
      preferences: state.preferences,
      updateNewKeyTransitionDefaults: state.updateNewKeyTransitionDefaults,
      updateSelectedKeyTransitions: state.updateSelectedKeyTransitions,
      flattenSelectedKeyHandles: state.flattenSelectedKeyHandles,
    })),
  );

  const selectedKeyContexts = useMemo(
    () => buildSelectedKeyContexts(keypointSelectionMap, trackMap),
    [keypointSelectionMap, trackMap],
  );
  const selectedTracks = useMemo(
    () => [...new Set(selectedKeyContexts.map((c) => c.trackId))],
    [selectedKeyContexts],
  );

  const hasSelection = selectedKeyContexts.length > 0;
  const trackColor = useColors(selectedTracks);

  const defaultTransitions = preferences.newKeyDefaults?.transitions ?? DEFAULT_NEW_KEY_TRANSITIONS;
  const defaultIncoming = defaultTransitions.in;
  const defaultOutgoing = defaultTransitions.out;
  const defaultPairing = defaultTransitions.pairing ?? TransitionPairing.Paired;

  const selectedIncoming = useMemo(
    () =>
      resolveUniformValue(
        selectedKeyContexts.map((context) =>
          normalizeTransitionForUi(context.point.transitions?.in),
        ),
      ),
    [selectedKeyContexts],
  );
  const selectedOutgoing = useMemo(
    () =>
      resolveUniformValue(
        selectedKeyContexts.map((context) =>
          normalizeTransitionForUi(context.point.transitions?.out),
        ),
      ),
    [selectedKeyContexts],
  );
  const selectedPairing = useMemo(
    () =>
      resolveUniformValue(
        selectedKeyContexts.map(
          (context) => resolvePairingForContext(context) ?? TransitionPairing.Paired,
        ),
      ),
    [selectedKeyContexts],
  );

  const incomingValue = hasSelection ? (selectedIncoming ?? MIXED_VALUE) : defaultIncoming;
  const outgoingValue = hasSelection ? (selectedOutgoing ?? MIXED_VALUE) : defaultOutgoing;
  const pairingValue = hasSelection ? (selectedPairing ?? MIXED_VALUE) : defaultPairing;
  const incomingHasHandle = useMemo(
    () =>
      hasSelection
        ? selectedKeyContexts.every((context) => contextHasNeighbor(context, "in"))
        : true,
    [hasSelection, selectedKeyContexts],
  );
  const outgoingHasHandle = useMemo(
    () =>
      hasSelection
        ? selectedKeyContexts.every((context) => contextHasNeighbor(context, "out"))
        : true,
    [hasSelection, selectedKeyContexts],
  );
  const incomingHandleIndicator = useMemo<HandleIndicatorType>(
    () =>
      hasSelection
        ? resolveUniformHandleIndicator(
            selectedKeyContexts.map((context) =>
              resolveHandleIndicatorTypeForContext(context, "in"),
            ),
          )
        : resolveHandleIndicatorTypeFromPairing(defaultPairing),
    [defaultPairing, hasSelection, selectedKeyContexts],
  );
  const outgoingHandleIndicator = useMemo<HandleIndicatorType>(
    () =>
      hasSelection
        ? resolveUniformHandleIndicator(
            selectedKeyContexts.map((context) =>
              resolveHandleIndicatorTypeForContext(context, "out"),
            ),
          )
        : resolveHandleIndicatorTypeFromPairing(defaultPairing),
    [defaultPairing, hasSelection, selectedKeyContexts],
  );
  const transitionTypeValue = hasSelection
    ? resolveSharedTransitionType(selectedIncoming, selectedOutgoing)
    : resolveSharedTransitionType(defaultIncoming, defaultOutgoing);
  const incomingTransitionTooltip = useMemo(
    () =>
      buildTransitionButtonTooltip({
        side: "incoming",
        hasSelection,
      }),
    [hasSelection],
  );
  const outgoingTransitionTooltip = useMemo(
    () =>
      buildTransitionButtonTooltip({
        side: "outgoing",
        hasSelection,
      }),
    [hasSelection],
  );
  const pairingTooltip = useMemo(() => buildPairingButtonTooltip(hasSelection), [hasSelection]);

  const updateDefaultTransitions = useCallback(
    (patch: TransitionPatch) => {
      updateNewKeyTransitionDefaults(patch);
    },
    [updateNewKeyTransitionDefaults],
  );

  const updateSelectedTransitions = useCallback(
    (patch: TransitionPatch) => {
      updateSelectedKeyTransitions(patch);
    },
    [updateSelectedKeyTransitions],
  );

  const handleIncomingChange = useCallback(
    (value: string) => {
      if (!isTransitionPreferenceValue(value)) return;
      if (hasSelection) {
        updateSelectedTransitions({ in: value });
        return;
      }
      updateDefaultTransitions({ in: value });
    },
    [hasSelection, updateDefaultTransitions, updateSelectedTransitions],
  );

  const handleOutgoingChange = useCallback(
    (value: string) => {
      if (!isTransitionPreferenceValue(value)) return;
      if (hasSelection) {
        updateSelectedTransitions({ out: value });
        return;
      }
      updateDefaultTransitions({ out: value });
    },
    [hasSelection, updateDefaultTransitions, updateSelectedTransitions],
  );

  const handlePairingChange = useCallback(
    (value: string) => {
      if (value !== TransitionPairing.Paired && value !== TransitionPairing.Free) return;
      if (hasSelection) {
        updateSelectedTransitions({ pairing: value });
        return;
      }
      updateDefaultTransitions({ pairing: value });
    },
    [hasSelection, updateDefaultTransitions, updateSelectedTransitions],
  );

  const handleTransitionTypeChange = useCallback(
    (value: string) => {
      if (!isTransitionPreferenceValue(value)) return;
      if (hasSelection) {
        updateSelectedTransitions({ in: value, out: value });
        return;
      }
      updateDefaultTransitions({ in: value, out: value });
    },
    [hasSelection, updateDefaultTransitions, updateSelectedTransitions],
  );

  const handleFlattenHandles = useCallback(() => {
    flattenSelectedKeyHandles();
  }, [flattenSelectedKeyHandles]);

  return (
    <div className="hidden items-center @[325px]:flex">
      <div
        className={clsx(
          "responsive custom-color variant-responsive-persistent-outline flex gap-0.5 rounded-sm p-0.5",
          hasSelection ? "outline-2" : "outline-1",
        )}
        style={
          {
            "--custom-color": trackColor,
          } as CSSProperties
        }
      >
        <Dropdown
          side="top"
          trigger={
            <div className="flex">
              <div className={TRANSITION_TEXT_BUTTON_CLASS}>
                <ToolbarTooltipButton
                  tooltip={incomingTransitionTooltip}
                  color={trackColor}
                  visuals="inverted"
                  size={Size.Sm}
                  altText={incomingTransitionTooltip}
                  leftIcon={
                    <IconHandleIndicator
                      className={clsx(
                        TRANSITION_ICON_CLASS,
                        "-scale-x-100",
                        resolveHandleIndicatorClass(
                          incomingHandleIndicator,
                          incomingValue,
                          incomingHasHandle,
                        ),
                      )}
                      handle={incomingHandleIndicator}
                      fillOpacity={resolveHandleIndicatorFillOpacity(
                        incomingValue,
                        incomingHasHandle,
                      )}
                    />
                  }
                  className={clsx(
                    "bg-neutral-500/10 hover:bg-neutral-500/25",
                    "min-w-36 rounded-l-xs",
                  )}
                >
                  {getTransitionSettingText(incomingValue)}
                </ToolbarTooltipButton>
              </div>
              <div className={TRANSITION_ICON_ONLY_BUTTON_CLASS}>
                <ToolbarTooltipButton
                  tooltip={incomingTransitionTooltip}
                  color={trackColor}
                  visuals="inverted"
                  size={Size.Sm}
                  altText={incomingTransitionTooltip}
                  leftIcon={
                    <IconHandleIndicator
                      className={clsx(
                        TRANSITION_ICON_CLASS,
                        "-scale-x-100",
                        resolveHandleIndicatorClass(
                          incomingHandleIndicator,
                          incomingValue,
                          incomingHasHandle,
                        ),
                      )}
                      handle={incomingHandleIndicator}
                      fillOpacity={resolveHandleIndicatorFillOpacity(
                        incomingValue,
                        incomingHasHandle,
                      )}
                    />
                  }
                  className={clsx("bg-neutral-500/10 hover:bg-neutral-500/25", "rounded-l-xs")}
                />
              </div>
            </div>
          }
        >
          <NestedLabel>
            {hasSelection ? "Incoming Transition" : "Default Incoming Transition"}
          </NestedLabel>
          <NestedRadio
            value={incomingValue}
            onChange={handleIncomingChange}
            options={buildTransitionOptions(incomingValue === MIXED_VALUE)}
          />
        </Dropdown>
        <Dropdown
          side="top"
          trigger={
            <ToolbarTooltipButton
              tooltip={pairingTooltip}
              color={trackColor}
              visuals="inverted"
              size={Size.Sm}
              altText={pairingTooltip}
              leftIcon={getPairingStateIcon(pairingValue)}
              className="rounded-none bg-neutral-500/10 hover:bg-neutral-500/25"
            />
          }
        >
          <NestedLabel>{hasSelection ? "Handle Pairing" : "Default Handle Pairing"}</NestedLabel>
          <NestedRadio
            value={pairingValue}
            onChange={handlePairingChange}
            options={buildPairingOptions(pairingValue === MIXED_VALUE)}
          />

          <NestedSeparator />
          {/* Transition Type is nested behind a submenu since the easing list
              is long (10 options) and would dominate the dropdown otherwise.
              The trigger label stays short ("Transition Type") and the left
              icon carries the current value — duplicating the value as text
              made the trigger wrap awkwardly on long names ("Auto Clamped",
              "Explicit Handles"). The flanking incoming/outgoing toolbar
              buttons already show the per-side type with text, so the value
              is still visible at a glance. */}
          <NestedMenu
            label={hasSelection ? "Transition Type" : "Default Transition Type"}
            left={getTransitionTypeIcon(transitionTypeValue)}
          >
            <NestedRadio
              value={transitionTypeValue}
              onChange={handleTransitionTypeChange}
              options={buildTransitionOptions(transitionTypeValue === MIXED_VALUE)}
            />
          </NestedMenu>
          {/* Actions section. Disabled at the submenu level when nothing is
              selected — everything inside operates on the current selection. */}
          <NestedMenu
            label="Actions"
            left={<Icon name="transition-snap" />}
            disabled={!hasSelection}
          >
            <NestedItem
              onClick={handleFlattenHandles}
              left={<Icon name="align-keys" />}
            >
              Flatten Handles
            </NestedItem>
          </NestedMenu>
        </Dropdown>
        <Dropdown
          side="top"
          trigger={
            <div className="flex">
              <div className={TRANSITION_TEXT_BUTTON_CLASS}>
                <ToolbarTooltipButton
                  tooltip={outgoingTransitionTooltip}
                  color={trackColor}
                  visuals="inverted"
                  size={Size.Sm}
                  altText={outgoingTransitionTooltip}
                  rightIcon={
                    <IconHandleIndicator
                      className={clsx(
                        TRANSITION_ICON_CLASS,
                        resolveHandleIndicatorClass(
                          outgoingHandleIndicator,
                          outgoingValue,
                          outgoingHasHandle,
                        ),
                      )}
                      handle={outgoingHandleIndicator}
                      fillOpacity={resolveHandleIndicatorFillOpacity(
                        outgoingValue,
                        outgoingHasHandle,
                      )}
                    />
                  }
                  className="min-w-36 rounded-r-xs bg-neutral-500/10 hover:bg-neutral-500/25"
                >
                  {getTransitionSettingText(outgoingValue)}
                </ToolbarTooltipButton>
              </div>
              <div className={TRANSITION_ICON_ONLY_BUTTON_CLASS}>
                <ToolbarTooltipButton
                  tooltip={outgoingTransitionTooltip}
                  color={trackColor}
                  visuals="inverted"
                  size={Size.Sm}
                  altText={outgoingTransitionTooltip}
                  rightIcon={
                    <IconHandleIndicator
                      className={clsx(
                        TRANSITION_ICON_CLASS,
                        resolveHandleIndicatorClass(
                          outgoingHandleIndicator,
                          outgoingValue,
                          outgoingHasHandle,
                        ),
                      )}
                      handle={outgoingHandleIndicator}
                      fillOpacity={resolveHandleIndicatorFillOpacity(
                        outgoingValue,
                        outgoingHasHandle,
                      )}
                    />
                  }
                  className="rounded-r-xs bg-neutral-500/10 hover:bg-neutral-500/25"
                />
              </div>
            </div>
          }
        >
          <NestedLabel>
            {hasSelection ? "Outgoing Transition" : "Default Outgoing Transition"}
          </NestedLabel>
          <NestedRadio
            value={outgoingValue}
            onChange={handleOutgoingChange}
            options={buildTransitionOptions(outgoingValue === MIXED_VALUE)}
          />
        </Dropdown>
      </div>
    </div>
  );
});

function buildTransitionOptions(includeMixed: boolean) {
  const mixed = includeMixed
    ? [{ value: MIXED_VALUE, label: "Mixed (Multiple)", disabled: true }]
    : [];
  return [
    ...mixed,
    ...TRANSITION_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      icon: option.icon,
    })),
  ];
}

function buildPairingOptions(includeMixed: boolean) {
  const mixed = includeMixed
    ? [
        {
          value: MIXED_VALUE,
          label: "Mixed (Multiple)",
          disabled: true,
          icon: <Icon name="vertex-indeterminate" />,
        },
      ]
    : [];
  return [
    ...mixed,
    {
      value: TransitionPairing.Paired,
      label: "Paired",
      icon: <Icon name="vertex-paired" />,
    },
    {
      value: TransitionPairing.Free,
      label: "Free",
      icon: <Icon name="vertex-free" />,
    },
  ];
}

function isTransitionPreferenceValue(value: string): value is TransitionPreference {
  return TRANSITION_PREFERENCE_VALUES.has(value);
}

function getPairingStateIcon(pairing: TransitionPairing | typeof MIXED_VALUE): ReactNode {
  if (pairing === TransitionPairing.Paired) {
    return <Icon name="vertex-paired" />;
  } else if (pairing === TransitionPairing.Free) {
    return <Icon name="vertex-free" />;
  } else {
    return <Icon name="vertex-indeterminate" />;
  }
}

function getTransitionSettingText(transition: typeof MIXED_VALUE | TransitionPreference): string {
  // Get the label based on the Transition Options
  const option = TRANSITION_OPTIONS.find((o) => o.value === transition);
  return option?.label ?? "Mixed (Multiple)";
}

function getTransitionTypeIcon(
  transition: typeof MIXED_VALUE | TransitionPreference,
): ReactNode {
  return TRANSITION_OPTIONS.find((o) => o.value === transition)?.icon;
}

function resolveHandleIndicatorTypeFromPairing(pairing?: TransitionPairing): HandleIndicatorType {
  if (pairing === TransitionPairing.Paired) {
    return "circle";
  }
  if (pairing === TransitionPairing.Free) {
    return "diamond";
  }
  return "indeterminate";
}

function resolveHandleIndicatorTypeForContext(
  context: SelectedKeyContext,
  side: "in" | "out",
): HandleIndicatorType {
  const hasNeighbor =
    side === "in"
      ? context.pointIndex > 0
      : context.pointIndex < context.sortedTrackPoints.length - 1;
  if (!hasNeighbor) {
    return "indeterminate";
  }

  // Use the same collinearity-based inference as the canvas (resolvePairingByPoint)
  // so that the toolbar indicators match the handle shapes rendered in the spline view.
  const pairing = resolvePairingForContext(context);
  return resolveHandleIndicatorTypeFromPairing(pairing);
}

function resolveUniformHandleIndicator(values: HandleIndicatorType[]): HandleIndicatorType {
  if (values.length === 0) return "indeterminate";
  const first = values[0];
  if (values.every((value) => value === first)) return first;
  return "indeterminate";
}

function resolveHandleIndicatorFillOpacity(
  transition: typeof MIXED_VALUE | TransitionPreference,
  hasHandle: boolean,
): number {
  if (!hasHandle) {
    return 0.5;
  }
  return transition === TransitionDirective.ExplicitHandles ? 1 : 0.5;
}

function resolveHandleIndicatorClass(
  handle: HandleIndicatorType,
  transition: typeof MIXED_VALUE | TransitionPreference,
  hasHandle: boolean,
): string | undefined {
  const fillOpacity = resolveHandleIndicatorFillOpacity(transition, hasHandle);
  return handle === "indeterminate" && fillOpacity < 1 ? "opacity-20" : undefined;
}

function resolveUniformValue<T extends string>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  const first = values[0];
  if (values.every((value) => value === first)) return first;
  return undefined;
}

function resolveSharedTransitionType(
  incoming: TransitionPreference | undefined,
  outgoing: TransitionPreference | undefined,
): TransitionPreference | typeof MIXED_VALUE {
  if (!incoming || !outgoing) return MIXED_VALUE;
  return incoming === outgoing ? incoming : MIXED_VALUE;
}

function buildTransitionButtonTooltip(params: {
  side: "incoming" | "outgoing";
  hasSelection: boolean;
}): string {
  const { side, hasSelection } = params;
  const scope = hasSelection ? "selected keyframes" : "new keyframes";
  const sideLabel = side === "incoming" ? "Incoming" : "Outgoing";
  return `Configure ${sideLabel.toLowerCase()} transition settings for ${scope}.`;
}

function buildPairingButtonTooltip(hasSelection: boolean): string {
  const scope = hasSelection ? "selected keyframes" : "new keyframes";
  return `Configure handle pairing and shared transition type for ${scope}.`;
}
