/**
 * Shared microtask flush utility for tests.
 *
 * Why:
 * - Many store subscriptions and derived computations schedule work via microtasks.
 * - Flushing the microtask queue is usually enough to let subscriptions settle in tests,
 *   without relying on timers like setTimeout (which linters and CI can flag as flaky).
 *
 * Usage:
 *   import { flushMicrotasks } from "../utils/flush-microtasks";
 *
 *   // After initializing subscriptions or triggering async store updates:
 *   await flushMicrotasks(); // default: two passes, which is typically sufficient
 *
 *   // If you need more passes (deep chains of microtasks), adjust the count:
 *   await flushMicrotasks(3);
 */

/**
 * Flushes the microtask queue by awaiting a resolved promise multiple times.
 *
 * @param passes - Number of times to await the microtask queue. Defaults to 2 which
 *                 is generally sufficient for chained microtask work (e.g., subscription → recompute).
 */
export async function flushMicrotasks(passes = 2): Promise<void> {
  for (let i = 0; i < passes; i += 1) {
    await Promise.resolve();
  }
}

/**
 * Convenience alias for a single microtask tick; clearer intent at call site when only
 * one microtask cycle is desired.
 */
export async function flushOneMicrotask(): Promise<void> {
  await flushMicrotasks(1);
}
