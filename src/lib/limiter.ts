// Runs at most `n` tasks at a time; extra ones wait in line.
export function limiter(n: number) {
  let running = 0;
  const queue: (() => void)[] = [];
  return async <T,>(task: () => Promise<T>): Promise<T> => {
    if (running >= n) await new Promise<void>((r) => queue.push(r));
    running++;
    try {
      return await task();
    } finally {
      running--;
      queue.shift()?.();
    }
  };
}
