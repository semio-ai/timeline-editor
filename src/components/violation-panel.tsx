import { Fragment, useMemo } from "react";
import { clsx } from "clsx";
import { IconAlertTriangle } from "@tabler/icons-react";
import { uniq } from "lodash";
import { Violation, ViolationSegment, ViolationType } from "../types";
import { useColors, useNames } from "../hooks";

export interface ViolationPanelProps {
  segment: ViolationSegment;
  violations: Record<string, Violation>;
}

export function ViolationPanel({ segment, violations }: ViolationPanelProps) {
  const uniqueTracks: string[] = useMemo(() => {
    return uniq(segment.violations.map((violationId) => violations[violationId].trackId));
  }, [segment, violations]);

  const defaultViolations: Violation[] = [];
  const collapsedViolations = segment.violations.reduce((list, v) => {
    const violation = violations[v];
    if (!violation) return list;
    const existing = list.find(
      (item) => item.type === violation.type && item.trackId === violation.trackId,
    );
    if (!existing) {
      list.push(violation);
    }
    return list;
  }, defaultViolations);

  const name = useNames(uniqueTracks, "MultipleTracks");
  const color = useColors(uniqueTracks);

  return (
    <div className="max-w-72 flex-col">
      <div
        className={clsx(
          "bg-neutral-50/50 px-2 py-1.5 dark:bg-neutral-950/50",
          "flex flex-row items-center justify-between",
        )}
        style={{ color }}
      >
        <div className="flex flex-row items-center">
          <IconAlertTriangle size={20} className="mr-2" />
          {name}
        </div>
        <div className="min-w-6 text-center text-black" style={{ backgroundColor: color }}>
          {segment.violations.length}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 p-2">
        {collapsedViolations.map((violation) => {
          return (
            <ViolationDescription
              key={violation.id}
              violation={violation}
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
        className="bg-opacity-25 px-2 py-0.5 text-sm text-black"
      >
        {violationType === ViolationType.Upper && <span>Upper Limit</span>}
        {violationType === ViolationType.Lower && <span>Lower Limit</span>}
        {violationType === ViolationType.Velocity && <span>Velocity Limit</span>}
        {violationType === ViolationType.Rate && <span>Rate Limit</span>}
      </div>
      <div
        key={`${violation.id}-description`}
        className="col-span-2 text-sm text-wrap dark:text-neutral-100 text-neutral-900"
      >
        {!onlyTrack && (
          <>
            <span style={{ color }}>{name}</span>
            <br />
          </>
        )}

        {violationType === ViolationType.Upper && (
          <span className="text-xs">Value exceeds upper bounds</span>
        )}
        {violationType === ViolationType.Lower && (
          <span className="text-xs">Value exceeds lower bounds</span>
        )}
        {violationType === ViolationType.Velocity && (
          <span className="text-xs">Value is changing faster than allowed by velocity limits</span>
        )}
        {violationType === ViolationType.Rate && (
          <span className="text-xs">Value is updating faster than allowed by rate limits</span>
        )}
      </div>
    </Fragment>
  );
}
