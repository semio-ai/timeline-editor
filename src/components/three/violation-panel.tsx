import { Fragment, useMemo } from "react";
import { clsx } from "clsx";
import { IconAlertTriangle } from "@tabler/icons-react";
import { uniq } from "lodash";
import { Violation, ViolationSegment, ViolationType } from "../../types";
import { useColors, useNames } from "../../hooks";

export interface ViolationPanelProps {
  segment: ViolationSegment;
  violations: Record<string, Violation>;
}

export function ViolationPanel({ segment, violations }: ViolationPanelProps) {
  const uniqueTracks = useMemo(() => {
    return uniq(segment.violations.map((violationId) => violations[violationId].trackId));
  }, [segment, violations]);

  const name = useNames(uniqueTracks, "MultipleTracks");

  return (
    <div className="flex-col max-w-72">
      <div
        className={clsx(
          "px-2 py-1.5 bg-neutral-50/50 dark:bg-neutral-950/50",
          "text-(--track-color) flex-row flex justify-between items-center",
        )}
      >
        <div className="flex-row flex items-center">
          <IconAlertTriangle size={20} className="mr-2" />
          {name}
        </div>
        <div className="bg-(--track-color) text-black min-w-6 text-center">
          {segment.violations.length}
        </div>
      </div>

      <div className="p-2 grid grid-cols-3 gap-2">
        {segment.violations.map((violationId) => {
          return (
            <ViolationDescription
              key={violationId}
              violation={violations[violationId]}
              onlyTrack={uniqueTracks.length <= 1}
            />
          );
        })}
      </div>
    </div>
  );
}

function ViolationDescription({
  violation,
  onlyTrack,
}: {
  violation: Violation;
  onlyTrack?: boolean;
}) {
  const sourceTrack = violation.trackId;
  const violationType = violation.type;
  const color = useColors(sourceTrack);
  const name = useNames(sourceTrack);

  return (
    <Fragment key={violation.id}>
      <div
        key={`${violation.id}-label`}
        style={{ backgroundColor: color }}
        className="bg-opacity-25 text-black px-2 py-0.5"
      >
        {violationType === ViolationType.Upper && <span>Upper Limit</span>}
        {violationType === ViolationType.Lower && <span>Lower Limit</span>}
        {violationType === ViolationType.Velocity && <span>Velocity Limit</span>}
        {violationType === ViolationType.Rate && <span>Rate Limit</span>}
      </div>
      <div key={`${violation.id}-description`} className="col-span-2 text-wrap">
        {!onlyTrack && (
          <>
            <span style={{ color }}>{name}</span>
            <br />
          </>
        )}

        {violationType === ViolationType.Upper && <span>Value exceeds upper bounds</span>}
        {violationType === ViolationType.Lower && <span>Value exceeds lower bounds</span>}
        {violationType === ViolationType.Velocity && (
          <span>Value is changing faster than allowed by velocity limits</span>
        )}
        {violationType === ViolationType.Rate && (
          <span>Value is updating faster than allowed by rate limits</span>
        )}
      </div>
    </Fragment>
  );
}
