import { createContext, useContext } from "react";

export const SceneTransitionContext = createContext({
  active: false,
  start: (commit: () => void) => commit(),
});

export function useSceneTransition() {
  return useContext(SceneTransitionContext);
}
