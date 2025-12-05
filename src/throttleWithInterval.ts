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

// --- Test Setup ---
export async function testThrottleWithInterval() {
  // Mocking console.log to capture output
  let capturedThrottledCalls: { message: string; count: number }[] = [];
  let capturedLogMessages: string[] = []; // To capture the "Calling with...", "Waiting for...", etc.

  const mockConsoleLog = (...args: unknown[]) => {
    const message = args.join(' ');
    capturedLogMessages.push(message); // Capture all console messages for debugging

    // Check if this is a throttled call output
    if (message.startsWith('[THROTTLED]')) {
      const match = message.match(/Message: "(.*?)",\sCount:\s(\d+)/);
      if (match) {
        capturedThrottledCalls.push({
          message: match[1],
          count: parseInt(match[2], 10),
        });
      }
    }
  };

  // Helper to simulate time passing
  const simulateTime = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  // --- Test Case ---

  console.debug('--- Starting throttleWithInterval Refined Test ---');

  // Reset captured data for this test
  capturedThrottledCalls = [];
  capturedLogMessages = [];

  // Define the throttled function
  const throttledLogger = throttleWithInterval(
    (message: string, count: number) => {
      mockConsoleLog(`[THROTTLED] Message: "${message}", Count: ${count}`); // This is what gets captured
    },
    200,
  ); // 200ms delay

  // --- Test Sequence ---

  // 1. First call: Should execute immediately
  console.debug("Calling with ('Initial', 1)");
  throttledLogger('Initial', 1);

  await simulateTime(50); // Wait a short duration, less than the delay

  // 2. Second call: Should queue arguments
  console.debug("Calling with ('Update 1', 2)");
  throttledLogger('Update 1', 2);

  // 3. Third call: Should overwrite queued arguments
  console.debug("Calling with ('Latest Update', 3)");
  throttledLogger('Latest Update', 3);

  console.debug('Waiting for interval tick...');
  await simulateTime(200); // Wait for the first interval tick. Should execute 'Latest Update', 3.

  console.debug('Waiting for another interval tick (no calls made)...');
  await simulateTime(200); // Interval should auto-clear.

  // 4. Call after auto-clear: Should execute immediately again
  console.debug('Attempting call after interval should have cleared:');
  console.debug("Calling with ('After Clear', 4)");
  throttledLogger('After Clear', 4);

  await simulateTime(50); // Short wait

  // 5. Another queued call
  console.debug("Calling with ('Another Update', 5)");
  throttledLogger('Another Update', 5);

  console.debug('Waiting for interval tick...');
  await simulateTime(200); // Interval tick, executes 'Another Update', 5

  console.debug('Cancelling any pending operations...');
  throttledLogger.cancel(); // Explicitly cancel

  await simulateTime(50); // Wait a bit

  // 6. Call after explicit cancel: Should execute immediately
  console.debug("Calling with ('After Cancel', 6)");
  throttledLogger('After Cancel', 6);

  // Small delay to ensure the immediate call is processed before we check
  await simulateTime(50);

  console.debug('\n--- Test Complete ---');

  // --- Verification ---
  console.debug('\n--- Captured Throttled Calls ---');
  capturedThrottledCalls.forEach((call) =>
    console.debug(`Message: "${call.message}", Count: ${call.count}`),
  );

  const expectedCalls = [
    { message: 'Initial', count: 1 }, // Immediate first call
    { message: 'Latest Update', count: 3 }, // First interval execution with latest args
    { message: 'After Clear', count: 4 }, // Immediate call after interval auto-cleared
    { message: 'Another Update', count: 5 }, // Second interval execution
    { message: 'After Cancel', count: 6 }, // Immediate call after explicit cancel
  ];

  console.debug('\n--- Verification Result ---');
  if (
    capturedThrottledCalls.length === expectedCalls.length &&
    capturedThrottledCalls.every(
      (call, index) =>
        call.message === expectedCalls[index].message &&
        call.count === expectedCalls[index].count,
    )
  ) {
    console.debug(
      '✅ Test passed: Captured throttled calls match expected behavior.',
    );
  } else {
    console.error('❌ Test failed: Captured throttled calls mismatch.');
    console.error('Expected Calls:', expectedCalls);
    console.error('Captured Calls:', capturedThrottledCalls);
  }

  // Optionally, you could also verify capturedLogMessages if needed for debugging the test itself.
  // console.debug("\n--- All Captured Log Messages (for debugging test) ---");
  // capturedLogMessages.forEach(line => console.debug(line));
}

// Run the refined test
// testThrottleWithInterval();
