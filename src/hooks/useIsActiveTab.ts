import { useRoute } from 'expo-router';
import { useNavigationState } from 'expo-router/react-navigation';

// Whether this screen is the currently selected tab. Unlike useIsFocused, this
// stays true while a stack screen is pushed above the tabs, so tab content
// doesn't vanish under a push/modal transition. Tab screens early-return a
// blank view when inactive: returning to a tab remounts its content, replaying
// the entrance stagger from blank instead of flashing the stale settled state.
export function useIsActiveTab(): boolean {
  const route = useRoute();
  return useNavigationState((state) => state.routes[state.index]?.name === route.name);
}
