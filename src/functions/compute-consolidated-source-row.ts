import { SourceRow, Source } from "../types";
import { computeSourceRowsFromSources } from "./compute-source-rows-from-sources";

export function computeConsolidatedSourceRow(
  sources: Source[],
  activeInstance?: string,
  idOverride?: string,
): SourceRow {
  const sourceRow: SourceRow = {
    id: "",
    data: [],
  };

  const unconsolidatedRows = computeSourceRowsFromSources(sources, activeInstance);

  sourceRow.data = unconsolidatedRows
    .flatMap((row) => row.data)
    .filter((data) => data.type !== "group");

  sourceRow.id = idOverride ?? commonString(unconsolidatedRows.map((data) => data.id));

  return sourceRow;
}

function commonString(values: string[]): string {
  // Return the substring shared by all strings in the array
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  let prefix = values[0];
  for (let i = 1; i < values.length; i++) {
    while (values[i].startsWith(prefix)) {
      prefix = prefix.substring(0, prefix.length - 1);
      if (prefix === "") return "";
    }
  }
  return prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
}
