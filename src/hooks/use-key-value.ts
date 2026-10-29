import { useCallback, useSyncExternalStore } from "react";
import { fromTaggedValue, useDataStore, watchKey, type ScalarValue } from "@semio/data";

/**
 * The scalar `key` holds in the injected `DataStore`, `fallback` while it
 * holds none or no key is given; the component re-renders when it changes.
 */
export function useKeyValue(key: string | undefined, fallback: ScalarValue): ScalarValue {
  const store = useDataStore();
  const subscribe = useCallback(
    (notify: () => void) => (key === undefined ? () => {} : watchKey(store, key, fallback, notify)),
    [store, key, fallback],
  );
  return useSyncExternalStore(subscribe, () =>
    key === undefined ? fallback : (fromTaggedValue(store.slot(key).get()) ?? fallback),
  );
}
