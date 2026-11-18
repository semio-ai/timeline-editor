import type { AnimationApi } from "../store-types";

type State = ReturnType<AnimationApi["getState"]>;
type Listener = (state: State, previous: State) => void;

export interface InternalListeners {
  /**
   * The store's API with `subscribe` replaced: a listener subscribed through
   * it joins the store's own subscriptions, which run before every host
   * listener in each notification.
   */
  api: AnimationApi;
}

/**
 * The store's own subscriptions, run as one listener the store registers when
 * it is created, ahead of any listener a host can register.
 *
 * Each notification has to reach the store's subscriptions before a host's
 * listeners: they answer a write with the writes that complete it, and the
 * derived orchestrator, the last of them, builds the snapshot once they have.
 * A host listener running first would see the new inputs with the snapshot of
 * the old ones. Registering the subscriptions on the store directly orders them
 * by when they were subscribed, so restarting them (`initAnimationSubscriptions`
 * again) would put them behind every host listener subscribed in between.
 *
 * `subscribe` behaves as the store's own: with a selector it calls the listener
 * only when the selected value changes (by `equalityFn`, `Object.is` by
 * default), and `fireImmediately` calls it once at once.
 */
export function createInternalListeners(api: AnimationApi): InternalListeners {
  const listeners = new Set<Listener>();
  const add = (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  function subscribe(listener: Listener): () => void;
  function subscribe<U>(
    selector: (state: State) => U,
    listener: (selected: U, previous: U) => void,
    options?: { equalityFn?: (a: U, b: U) => boolean; fireImmediately?: boolean },
  ): () => void;
  function subscribe<U>(
    selectorOrListener: ((state: State) => U) | Listener,
    listener?: (selected: U, previous: U) => void,
    options?: { equalityFn?: (a: U, b: U) => boolean; fireImmediately?: boolean },
  ): () => void {
    if (!listener) return add(selectorOrListener as Listener);
    const selector = selectorOrListener as (state: State) => U;
    const equalityFn = options?.equalityFn ?? Object.is;
    let current = selector(api.getState());
    const onChange: Listener = (state) => {
      const next = selector(state);
      if (equalityFn(current, next)) return;
      const previous = current;
      current = next;
      listener(next, previous);
    };
    if (options?.fireImmediately) listener(current, current);
    return add(onChange);
  }

  // As the store does: iterate the live set, so a listener subscribed during a
  // notification hears it and one unsubscribed during it does not, and hand
  // each listener the state as it stands when it is called. A listener earlier
  // in the set may have written, and the ones after it must see that write,
  // not the state the notification began with.
  api.subscribe((_state, previous) =>
    listeners.forEach((listener) => listener(api.getState(), previous)),
  );

  return { api: { ...api, subscribe: subscribe as AnimationApi["subscribe"] } };
}
