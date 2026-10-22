// @vitest-environment jsdom
import { expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { RowNoticeContext, useRowNotice } from "../../components/controls/label-with-notice";
import type { SourceRow } from "../../types";

const row = (data: { namespaceId: string; animatableId: string; type: string }[]) =>
  ({ id: "row", data }) as unknown as SourceRow;

/** The host's notice: the namespace and the animatable it was asked about. */
const host = ({ children }: { children: ReactNode }) => (
  <RowNoticeContext.Provider
    value={(namespaceId, animatableId) => `${namespaceId} ${animatableId}`}
  >
    {children}
  </RowNoticeContext.Provider>
);

it("shows the host's notice for a one-track row's track", () => {
  const { result } = renderHook(
    () => useRowNotice(row([{ namespaceId: "e@target", animatableId: "joint", type: "number" }])),
    { wrapper: host },
  );
  expect(result.current).toBe("e@target joint");
});

it("shows the caller's notice in its place, and none for a group row or without a host", () => {
  const leaf = row([{ namespaceId: "e@target", animatableId: "joint", type: "number" }]);
  expect(renderHook(() => useRowNotice(leaf, "given"), { wrapper: host }).result.current).toBe(
    "given",
  );
  const group = row([
    { namespaceId: "e@target", animatableId: "x", type: "number" },
    { namespaceId: "e@target", animatableId: "y", type: "number" },
  ]);
  expect(renderHook(() => useRowNotice(group), { wrapper: host }).result.current).toBeUndefined();
  expect(renderHook(() => useRowNotice(leaf)).result.current).toBeUndefined();
});
