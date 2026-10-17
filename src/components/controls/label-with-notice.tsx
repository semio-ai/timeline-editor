import { createContext, useContext, type ReactNode } from "react";
import type { SourceRow } from "../../types";
import { GROUP_TYPES } from "../../constants";

/** A row's label with a notice after it, when there is one. */
export function LabelWithNotice({ notice, children }: { notice?: ReactNode; children: ReactNode }) {
  if (notice === undefined || notice === null || notice === false) return <>{children}</>;
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-center">{notice}</div>
    </div>
  );
}

/**
 * What a host shows beside a track row's name: a statement about what the
 * track animates on one instance — `namespaceId` the instance's namespace,
 * `animatableId` what the track animates — or nothing.
 */
export type RowNotice = (namespaceId: string, animatableId: string) => ReactNode;

/**
 * The host's {@link RowNotice}, which every track row of one animatable shows
 * beside its name, in the timeline as in a controls list. None by default.
 */
export const RowNoticeContext = createContext<RowNotice | undefined>(undefined);

/**
 * What a track row shows beside its name: `notice` when the caller gives
 * one, else, for a row of one track, the host's {@link RowNoticeContext} for
 * that track; nothing for a group row.
 */
export function useRowNotice(sourceRow: SourceRow, notice?: ReactNode): ReactNode {
  const rowNotice = useContext(RowNoticeContext);
  if (notice !== undefined) return notice;
  const [datum, ...others] = sourceRow.data;
  if (!datum || others.length > 0 || GROUP_TYPES.has(datum.type)) return undefined;
  return rowNotice?.(datum.namespaceId, datum.animatableId);
}
