import { useContext, useEffect, useRef } from "react";
import type { RawValue } from "@semio/utils";
import type { AnimationData } from "../store-types";
import { AnimationContext } from "../context";

export function useValuesRef(): React.MutableRefObject<Map<string, RawValue | undefined>> {
  const store = useContext(AnimationContext);
  if (!store) {
    throw new Error("Missing AnimationProvider in the tree");
  }

  const valuesRef = useRef(store.getState().values);

  useEffect(() => {
    valuesRef.current = store.getState().values;
    return store.subscribe(
      (state: AnimationData) => state.values,
      (nextValues) => {
        valuesRef.current = nextValues;
      },
    );
  }, [store]);

  return valuesRef;
}
