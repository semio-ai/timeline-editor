// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createStore } from "zustand/vanilla";
import { AnimationContext } from "../../context";
import type { AnimationStore } from "../../store";
import { AnimatableControlList } from "../../components/animatable-control-list";

vi.mock("../../components/animatable-control", () => ({
  AnimatableControl: (props: {
    kind?: string;
    groupId?: string;
    animatableId?: string;
    sourceRowId?: string;
  }) => <div data-testid={props.groupId ?? props.animatableId} data-source={props.sourceRowId} />,
}));
afterEach(cleanup);

function renderList(instanceId: string | null) {
  // Same instance id in two namespaces exercises the list's explicit namespace boundary.
  const store = createStore(() => ({
    selectionState: { instanceId: "i" },
    animatables: {
      joint: { id: "joint", name: "Joint", type: "number", group: { id: "arm" } },
      spare: { id: "spare", name: "Spare", type: "number", group: { id: "arm" } },
    },
    instancedTrackSources: {
      "e1@target/i/t1": {
        id: "e1@target/i/t1",
        data: [{ instanceId: "i", namespaceId: "e1@target", animatableId: "joint" }],
      },
      "e2@target/i/t1": {
        id: "e2@target/i/t1",
        data: [{ instanceId: "i", namespaceId: "e2@target", animatableId: "joint" }],
      },
    },
  }));
  return render(
    <AnimationContext.Provider value={store as unknown as AnimationStore}>
      <AnimatableControlList
        animatableIds={["joint", "spare"]}
        sourceNamespaceId="e1@target"
        sourceInstanceId={instanceId}
      />
    </AnimationContext.Provider>,
  );
}

describe("animatable control source scope", () => {
  it("uses only the requested namespace, even when another entity shares identities", () => {
    renderList("i");
    expect(screen.getByTestId("joint").getAttribute("data-source")).toBe("e1@target/i/t1");
    expect(screen.getByTestId("spare").hasAttribute("data-source")).toBe(false);
    expect(screen.getByTestId("arm").getAttribute("data-source")).toBe("e1@target/i/arm");
  });
  it("clears both leaf and group track associations in direct mode", () => {
    renderList(null);
    for (const id of ["joint", "spare", "arm"]) {
      expect(screen.getByTestId(id).hasAttribute("data-source")).toBe(false);
    }
  });
  it("does not adopt tracks from another instance when the requested one has none", () => {
    renderList("empty-instance");
    expect(screen.getByTestId("joint").hasAttribute("data-source")).toBe(false);
    expect(screen.getByTestId("arm").hasAttribute("data-source")).toBe(false);
  });
});
