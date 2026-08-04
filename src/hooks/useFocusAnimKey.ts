import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// Replays the entrance stagger every time a tab regains focus — but only if the
// previous play has had time to fully settle. Without this guard, switching tabs
// faster than the stagger takes to finish would remount mid-animation and cut it
// off ("starts, cuts off, restarts" — see DECISIONS.md DS-007 Addendum 5). The
// longest stagger delay across tab screens is 360ms (Profile) + ~600ms for a
// damping:18/stiffness:140 spring to settle, so 1000ms covers every screen with
// margin. A fast switch simply skips the replay for that visit rather than
// interrupting one already in flight.
const MIN_REPLAY_GAP_MS = 1000;

export function useFocusAnimKey(): number {
  const [animKey, setAnimKey] = useState(0);
  const lastBumpAt = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastBumpAt.current > MIN_REPLAY_GAP_MS) {
        lastBumpAt.current = now;
        setAnimKey((k) => k + 1);
      }
    }, [])
  );

  return animKey;
}
