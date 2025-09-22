import { SourceRow, SourceRowData } from "../types";

export function computeCollapsedSourceRow(sourceRow: SourceRow): SourceRow {
  const defaultRowList: SourceRowData[] = [];
  // Attempts to collapse a source row such that if there is only one unique trackId present,
  // And only one attribute present (there may be a datapoint with the top-group trackId but no attribute),
  // then we can collapse the row to just that single trackId and attribute.
  //
  const collapsedRowData = sourceRow.data.reduce((acc, data) => {
    // Find if there is a match in acc already that matches everything other than the attribute or superficial properties
    const matchIndex = acc.findIndex((item) => compareSourceRowDataEntries(item, data));

    if (matchIndex !== -1) {
      const match = acc[matchIndex];

      // If there is a match, and the current data has an attribute and the match does not, replace the match with the current data
      if (data.attribute && !match.attribute) {
        acc[matchIndex] = data;
      }
      // If there is, and the current data does not have an attribute, do nothing
      else if (!data.attribute && match.attribute) {
        // Do nothing - keep the existing match with attribute
      }
      // If there is an attribute in the current data and the match, keep both
      else if (data.attribute && match.attribute && data.attribute !== match.attribute) {
        acc.push(data);
      }
      // If both have the same attribute or both have no attribute, keep just the existing one
    } else {
      // No match found, add to accumulator
      acc.push(data);
    }

    return acc;
  }, defaultRowList);

  return {
    ...sourceRow,
    data: collapsedRowData,
  };
}

const compareSourceRowDataEntries = (a: SourceRowData, b: SourceRowData): boolean => {
  return ["animatableId", "namespaceId", "trackId", "instanceId"].every(
    (key) => a[key as keyof SourceRowData] === b[key as keyof SourceRowData],
  );
};
