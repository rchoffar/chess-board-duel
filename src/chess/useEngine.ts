import { useEffect } from 'react';
import { initEngine, shutdownEngine } from './engine';

// Detail and review screens can be stacked; the engine must survive until the
// last consumer unmounts, hence the ref count.
let consumers = 0;

export function useEngine(): void {
  useEffect(() => {
    consumers++;
    initEngine().catch(() => {});
    return () => {
      consumers--;
      if (consumers <= 0) {
        consumers = 0;
        shutdownEngine().catch(() => {});
      }
    };
  }, []);
}
