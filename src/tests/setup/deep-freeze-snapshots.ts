// Every test runs with each derived snapshot deep-frozen as it is published.
//
// The store freezes only a snapshot's top-level object (see
// `sealDerivedSnapshot`), so in the package nothing stops code from editing a
// row, frame or segment in place. Here Immer's own deep freeze is applied
// instead, which also makes a frozen Map or Set throw on `set`, `add`,
// `delete` and `clear`. An edit to a published snapshot anywhere in the
// package, components included, then throws in whichever test reaches it.
import { freeze } from "immer";
import { vi } from "vitest";
import type { DerivedSnapshot } from "../../types";

vi.mock("../../subscriptions/seal-derived-snapshot", () => ({
  sealDerivedSnapshot: (snapshot: DerivedSnapshot) => freeze(snapshot, true),
}));
