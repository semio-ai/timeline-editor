import { useEffect, useRef } from "react";
import { type RawValue, useValuesStore } from "@semio/utils";

export function useValuesRef(): React.MutableRefObject<Map<string, RawValue | undefined>> {
  const valuesRef = useRef(useValuesStore.getState().values);

  useEffect(() => {
    valuesRef.current = useValuesStore.getState().values;
    return useValuesStore.subscribe(
      (state) => state.values,
      (nextValues) => {
        valuesRef.current = nextValues;
      },
    );
  }, []);

  return valuesRef;
}
