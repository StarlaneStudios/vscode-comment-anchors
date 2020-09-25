/**
 * Utility used for awaiting a timeout
 *
 * @param delay Delay in ms
 */
export function asyncDelay(delay: number): Promise<void> {
  return new Promise((success) => {
    setTimeout(() => {
      success();
    }, delay);
  });
}
