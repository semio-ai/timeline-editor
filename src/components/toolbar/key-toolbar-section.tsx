import { CSSProperties, memo, ReactNode, useCallback, useMemo } from "react";
import {
  Dropdown,
  ICON_CLASS_NAME,
  IconHandleIndicator,
  IconVectorBack,
  IconVectorBezierAutoClamp,
  IconVectorBezierHandles,
  IconVectorCirc,
  IconVectorCubic,
  IconVectorExpo,
  IconVectorLinear,
  IconVectorQuad,
  IconVectorQuart,
  IconVectorQuint,
  IconVectorSine,
  IconVertexFree,
  IconVertexIndeterminate,
  IconVertexPaired,
  NestedLabel,
  NestedRadio,
  NestedSeparator,
  Size,
} from "@semio/ui";
import { useShallow } from "zustand/shallow";
import { clsx } from "clsx";
import {
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
import type { SimpleKeypoint } from "../../types/data/simple-track";
import { ToolbarTooltipButton } from "./toolbar-tooltip-button";

const MIXED_VALUE = "__mixed__";
const TRANSITION_ICON_CLASS = ICON_CLASS_NAME;
const TRANSITION_TEXT_BUTTON_CLASS = "hidden @[500px]:flex";
const TRANSITION_ICON_ONLY_BUTTON_CLASS = "flex @[500px]:hidden";
type HandleIndicatorType = "diamond" | "circle" | "indeterminate";

const TRANSITION_OPTIONS: { value: TransitionPreference; label: string; icon?: ReactNode }[] = [
  {
    value: StandardTransitionType.Sine,
    label: "Sinusoidal",
    icon: <IconVectorSine className={TRANSITION_ICON_CLASS} />,
  },
  {
    value: StandardTransitionType.Cubic,
    label: "Cubic",
    icon: <IconVectorCubic className={TRANSITION_ICON_CLASS} />,
  },
  {
    value: StandardTransitionType.Quint,
    label: "Quintic",
    icon: <IconVectorQuint className={TRANSITION_ICON_CLASS} />,
  },
  {
    value: StandardTransitionType.Circ,
    label: "Circular",
    icon: <IconVectorCirc className={TRANSITION_ICON_CLASS} />,
  },
  {
    value: StandardTransitionType.Quad,
    label: "Quadratic",
    icon: <IconVectorQuad className={TRANSITION_ICON_CLASS} />,
  },
  {
    value: StandardTransitionType.Quart,
    label: "Quartic",
    icon: <IconVectorQuart className={TRANSITION_ICON_CLASS} />,
  },
  {
    value: StandardTransitionType.Expo,
    label: "Exponential",
    icon: <IconVectorExpo className={TRANSITION_ICON_CLASS} />,
  },
  {
    value: StandardTransitionType.Back,
    label: "Back",
    icon: <IconVectorBack className={TRANSITION_ICON_CLASS} />,
  },
  {
    value: StandardTransitionType.Linear,
    label: "Linear",
    icon: <IconVectorLinear className={TRANSITION_ICON_CLASS} />,
  },
  {
    value: TransitionDirective.ExplicitHandles,
    label: "Bezier Handles",
    icon: <IconVectorBezierHandles className={TRANSITION_ICON_CLASS} />,
  },
  {
    value: TransitionDirective.InferredAutoClamped,
    label: "Auto Clamped",
    icon: <IconVectorBezierAutoClamp className={TRANSITION_ICON_CLASS} />,
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
  } = useAnimationStore(
    useShallow((state) => ({
      keypointSelectionMap: state.selectionState.keypoints,
      trackMap: state.tracks,
      preferences: state.preferences,
      updateNewKeyTransitionDefaults: state.updateNewKeyTransitionDefaults,
      updateSelectedKeyTransitions: state.updateSelectedKeyTransitions,
    })),
  );

  const { selectedTracks, selectedKeyContexts } = useMemo(() => {
    const trackIds: string[] = [];
    const keyContexts: SelectedKeyContext[] = [];
    const sortedByTrackId = new Map<
      string,
      { points: SimpleKeypoint[]; indexById: Map<string, number> }
    >();

    keypointSelectionMap.forEach((selectedKeyIds, trackId) => {
      if (selectedKeyIds.size === 0) return;
      const track = trackMap[trackId];
      if (!track) return;
      trackIds.push(trackId);

      let sortedEntry = sortedByTrackId.get(trackId);
      if (!sortedEntry) {
        const points = track.points.slice().sort((a, b) => a.stamp - b.stamp);
        const indexById = new Map(points.map((point, index) => [point.id, index]));
        sortedEntry = { points, indexById };
        sortedByTrackId.set(trackId, sortedEntry);
      }

      selectedKeyIds.forEach((keypointId) => {
        const point = track.points.find((entry) => entry.id === keypointId);
        if (!point) return;
        const pointIndex = sortedEntry.indexById.get(keypointId);
        if (pointIndex === undefined) return;
        keyContexts.push({
          trackId,
          point,
          sortedTrackPoints: sortedEntry.points,
          pointIndex,
        });
      });
    });

    return { selectedTracks: trackIds, selectedKeyContexts: keyContexts };
  }, [keypointSelectionMap, trackMap]);

  const hasSelection = selectedKeyContexts.length > 0;
  const trackColor = useColors(selectedTracks);

  const defaultTransitions = preferences.newKeyDefaults?.transitions ?? DEFAULT_NEW_KEY_TRANSITIONS;
  const defaultIncoming = normalizeTransitionPreferenceForUi(defaultTransitions.in);
  const defaultOutgoing = normalizeTransitionPreferenceForUi(defaultTransitions.out);
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

  return (
    <div className="sm:flex items-center hidden">
      <div
        className={clsx(
          "rounded-sm flex responsive custom-color variant-responsive-persistent-outline gap-0.5 p-0.5",
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
                    "rounded-l-xs min-w-36",
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
              className="bg-neutral-500/10 hover:bg-neutral-500/25 rounded-none"
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
          <NestedLabel>{hasSelection ? "Transition Type" : "Default Transition Type"}</NestedLabel>
          <NestedRadio
            value={transitionTypeValue}
            onChange={handleTransitionTypeChange}
            options={buildTransitionOptions(transitionTypeValue === MIXED_VALUE)}
          />
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
                  className="bg-neutral-500/10 hover:bg-neutral-500/25 rounded-r-xs min-w-36"
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
                  className="bg-neutral-500/10 hover:bg-neutral-500/25 rounded-r-xs"
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
          icon: <IconVertexIndeterminate className={ICON_CLASS_NAME} />,
        },
      ]
    : [];
  return [
    ...mixed,
    {
      value: TransitionPairing.Paired,
      label: "Paired",
      icon: <IconVertexPaired className={ICON_CLASS_NAME} />,
    },
    {
      value: TransitionPairing.Free,
      label: "Free",
      icon: <IconVertexFree className={ICON_CLASS_NAME} />,
    },
  ];
}

function isTransitionPreferenceValue(value: string): value is TransitionPreference {
  return TRANSITION_PREFERENCE_VALUES.has(value);
}

function getPairingStateIcon(pairing: TransitionPairing | typeof MIXED_VALUE): ReactNode {
  if (pairing === TransitionPairing.Paired) {
    return <IconVertexPaired className={TRANSITION_ICON_CLASS} />;
  } else if (pairing === TransitionPairing.Free) {
    return <IconVertexFree className={TRANSITION_ICON_CLASS} />;
  } else {
    return <IconVertexIndeterminate className={TRANSITION_ICON_CLASS} />;
  }
}

function getTransitionSettingText(transition: typeof MIXED_VALUE | TransitionPreference): string {
  // Get the label based on the Transition Options
  const option = TRANSITION_OPTIONS.find((o) => o.value === transition);
  return option?.label ?? "Mixed (Multiple)";
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
  return pairing === TransitionPairing.Paired ? "circle" : "diamond";
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

function contextHasNeighbor(context: SelectedKeyContext, side: "in" | "out"): boolean {
  return side === "in"
    ? context.pointIndex > 0
    : context.pointIndex < context.sortedTrackPoints.length - 1;
}

function normalizeTransitionPreferenceForUi(
  preference: TransitionPreference,
): TransitionPreference {
  return preference;
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
