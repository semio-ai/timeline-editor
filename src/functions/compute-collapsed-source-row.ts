import { uniq } from "lodash";
import { SourceRow } from "../types";

export function computeCollapsedSourceRow(sourceRow: SourceRow): SourceRow {
  // Attempts to collapse a source row such that if there is only one unique trackId present,
  // And only one attribute present (there may be a datapoint with the top-group trackId but no attribute),
  // then we can collapse the row to just that single trackId and attribute.
  if (sourceRow.data.length <= 1) return sourceRow;

  const uniqueTrackIds = uniq(sourceRow.data.map((d) => d.trackId));
  if (uniqueTrackIds.length > 1) return sourceRow;

  const uniqueAttributes = uniq(
    sourceRow.data.map((d) => d.attribute).filter((a) => a !== undefined),
  );
  if (uniqueAttributes.length > 1) return sourceRow;

  // If we reach here, we can collapse the source row
  const collapsedData =
    sourceRow.data.find((d) => d.attribute === uniqueAttributes[0]) || sourceRow.data[0];

  return {
    ...sourceRow,
    data: [collapsedData],
  };
}
