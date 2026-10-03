import { createContext, useContext } from "react";

export const SceneTransitionContext = createContext({
  active: false,
  start: (commit: () => void, onComplete?: () => void) => {
    commit();
    onComplete?.();
  },
});

export function useSceneTransition() {
  return useContext(SceneTransitionContext);
}
