// Regular debounce falls asleep in the apocalypse.
// Regular debouncing does not work with scroll events as they can fire continuously without stopping.
// Throttling with intervals allows us to limit how often we respond to scroll events,
// while still ensuring we handle the most recent event data.
// My goal is to make the ultimate debounce that triggers immediately on the first call, and triggers after the last call in a burst,

/**
 * Creates a throttled version of the provided callback that executes at most once per specified interval.
 * The first call executes immediately. Subsequent calls within the interval are queued and will execute
 * at the next interval tick with the **most recent arguments**. If no calls are made within an interval,
 * the interval is automatically cleared.
 *
 * - First call: Executes immediately with provided arguments
 * - Subsequent calls: Queues the latest arguments, overwriting previous ones
 * - Interval execution: Runs the queued callback at each interval tick if calls are pending
 * - Auto-cleanup: Clears the interval when no calls are pending for a full tick
 *
 * @template T - The argument types for the callback function.
 * @param callback - The function to throttle. Receives the most recent arguments from queued calls.
 * @param delay - The throttling interval in milliseconds. Minimum 1ms. Defaults to 100ms.
 * @returns An object containing:
 *   - The throttled function that can be called with the same arguments as the original callback
 *   - A `cancel()` method to immediately clear the interval and stop all pending executions
 *
 * @example
 * ```typescript
 * // Basic usage: Search input handling
 * const handleSearch = throttleWithInterval((query: string) => {
 *   console.debug(`Searching for: ${query}`);
 *   // API call would go here
 * }, 300);
 *
 * // These calls demonstrate the throttling behavior:
 * handleSearch("apple");     // Logs: "Searching for: apple" (immediate)
 * handleSearch("appl");      // Queued, will execute at 300ms with "appl"
 * handleSearch("ap");        // Queued, overwrites with "ap"
 * handleSearch("app");       // Queued, overwrites with "app"
 * // At 300ms: Logs: "Searching for: app" (most recent args)
 *
 * // No further calls for 300ms → interval auto-clears
 *
 * // Example with multiple arguments
 * const logPosition = throttleWithInterval((x: number, y: number) => {
 *   console.debug(`Position: (${x}, ${y})`);
 * }, 100);
 *
 * logPosition(10, 20);  // Logs: "Position: (10, 20)" (immediate)
 * logPosition(15, 25);  // Queued, will log at 100ms: "Position: (15, 25)"
 *
 * // Cancel example: Stop scroll handling
 * const handleScroll = throttleWithInterval((scrollTop: number) => {
 *   console.debug(`Scrolled to: ${scrollTop}px`);
 * }, 50);
 *
 * window.addEventListener('scroll', (e) => {
 *   handleScroll(window.scrollY);
 * });
 *
 * // Later, to stop listening:
 * // handleScroll.cancel();
 * // window.removeEventListener('scroll', handleScroll);
 *
 * // Edge case: Minimum delay validation
 * const invalidThrottle = throttleWithInterval(() => console.debug('test'), 0);
 * // Throws: RangeError: Delay must be at least 1 millisecond
 * ```
 */
export function throttleWithInterval<T extends unknown[]>(
  callback: (...args: T) => void,
  delay = 100,
): { (...args: T): void; cancel(): void } {
  // Input validation
  if (delay < 1) {
    throw new RangeError('Delay must be at least 1 millisecond');
  }

  let intervalId: NodeJS.Timer | null = null;
  let queuedArgs: T | null = null;
  let isAwaitingCall = false;

  const throttled = (...args: T) => {
    // Always use the most recent arguments
    queuedArgs = args;

    if (!intervalId) {
      // First call executes immediately
      callback(...args);

      // Start the interval for subsequent calls
      intervalId = setInterval(() => {
        if (isAwaitingCall && queuedArgs) {
          // Execute with the most recent queued arguments
          isAwaitingCall = false;
          callback(...queuedArgs);
          queuedArgs = null; // Clear after execution
        } else {
          // No pending calls, clean up the interval
          throttled.cancel();
        }
      }, delay);
    } else {
      // Subsequent calls just mark that we're waiting
      isAwaitingCall = true;
    }
  };

  throttled.cancel = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    // Reset state
    isAwaitingCall = false;
    queuedArgs = null;
  };

  return throttled;
}
