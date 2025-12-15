// Regular debounce falls asleep in the apocalypse.
// Regular debouncing does not work with scroll events as they can fire continuously without stopping.
// Throttling with intervals allows us to limit how often we respond to scroll events,
// while still ensuring we handle the most recent event data.
// My goal is to make the ultimate debounce that triggers immediately on the first call, and triggers after the last call in a burst,

/**
 * Creates a throttled wrapper around a callback using a fixed `setInterval` cadence.
 *
 * The returned function executes the callback immediately on the first call. While the interval
 * is active, subsequent calls do not execute the callback right away; instead, the latest arguments
 * are stored and a single trailing execution will occur on the next interval tick (if any calls were
 * made since the last tick). If no calls are pending on a tick, the interval is cleared automatically.
 *
 * This implementation also avoids overlapping executions: if the callback returns a `Promise`,
 * it will not start a new execution until the prior promise settles.
 *
 * @typeParam T - Tuple type of the callback arguments.
 * @typeParam Ret - Callback return type (may be a `Promise` or a synchronous value).
 *
 * @param callback - Function to throttle.
 * @param delay - Interval delay in milliseconds. Must be at least `1`.
 *
 * @returns A callable function with additional state and control properties:
 * - `cancel()`: Stops the interval and resets internal state (clears queued args and flags).
 * - `isExecuting`: `true` while the callback is currently running (including while an async promise is pending).
 * - `queuedArgs`: The most recently provided arguments waiting to be executed, or `null`.
 * - `lastReturnValue`: The return value from the most recent callback execution.
 * - `intervalId`: The active interval id, or `null` when idle/cancelled.
 * - `isAwaitingCall`: `true` when at least one call has occurred since the last tick and is awaiting execution.
 *
 * @throws {@link RangeError} If `delay` is less than `1`.
 *
 * @example
 * ```ts
 * const throttledLog = throttleWithInterval((msg: string) => {
 *   console.log(msg);
 * }, 200);
 *
 * throttledLog('First call'); // Executes immediately
 * throttledLog('Second call'); // Queued for next tick
 * throttledLog('Third call'); // Overwrites queued args
 *
 * // logs: 'First call'
 * // After 200ms, logs: 'Third call'
 * ```
 *
 * @remarks
 * - Only the latest call's arguments are retained while throttled (previous queued args are overwritten).
 * - The wrapper returns `lastReturnValue` for calls that are queued (i.e., calls made while throttled).
 */
export function throttleWithInterval<T extends unknown[], Ret>(
  callback: (...args: T) => Ret,
  delay = 100,
): {
  (...args: T): Ret;
  cancel(): void;
  isExecuting: boolean;
  queuedArgs: T | null;
  lastReturnValue: Ret | null;
  intervalId: ReturnType<typeof setInterval> | null;
  isAwaitingCall: boolean;
} {
  // Input validation
  if (delay < 1) {
    throw new RangeError('Delay must be at least 1 millisecond');
  }

  const throttled: {
    (...args: T): Ret;
    cancel(): void;
    isExecuting: boolean;
    queuedArgs: T | null;
    lastReturnValue: Ret;
    intervalId: ReturnType<typeof setInterval> | null;
    isAwaitingCall: boolean;
  } = (...args: T) => {
    // Always use the most recent arguments
    throttled.queuedArgs = args;

    if (!throttled.intervalId) {
      // First call executes immediately
      throttled.isExecuting = true;
      try {
        throttled.lastReturnValue = callback(...args);
      } catch (e) {
        throttled.isExecuting = false;
        throw e;
      }

      if (throttled.lastReturnValue instanceof Promise) {
        void throttled.lastReturnValue.finally(() => {
          throttled.isExecuting = false;
        });
      } else {
        throttled.isExecuting = false;
      }

      // Start the interval for subsequent calls
      throttled.intervalId = setInterval(() => {
        if (throttled.isExecuting) return; // Prevent overlapping executions

        if (throttled.isAwaitingCall && throttled.queuedArgs) {
          // Execute with the most recent queued arguments
          throttled.isAwaitingCall = false;

          throttled.isExecuting = true;
          try {
            throttled.lastReturnValue = callback(...throttled.queuedArgs);
          } catch (e) {
            throttled.isExecuting = false;
            throw e;
          }

          if (throttled.lastReturnValue instanceof Promise) {
            void throttled.lastReturnValue.finally(() => {
              throttled.isExecuting = false;
            });
          } else {
            throttled.isExecuting = false;
          }
        } else {
          // No pending calls, clean up the interval
          throttled.cancel();
        }
      }, delay);
      return throttled.lastReturnValue;
    } else {
      // Subsequent calls just mark that we're waiting
      throttled.isAwaitingCall = true;
      return throttled.lastReturnValue;
    }
  };

  throttled.cancel = () => {
    if (throttled.intervalId) {
      clearInterval(throttled.intervalId);
      throttled.intervalId = null;
    }
    // Reset state
    throttled.isAwaitingCall = false;
    throttled.queuedArgs = null;
    throttled.isExecuting = false;
  };

  throttled.isExecuting = false;
  throttled.queuedArgs = null;
  throttled.lastReturnValue = null as unknown as Ret;
  throttled.intervalId = null;
  throttled.isAwaitingCall = false;

  return throttled;
}
