import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  drawCard,
  markSacrifice,
  planDeploy,
  planRound,
  planSearch,
  selectSummon,
} from "../../domain/game";
import type { Battle, BattleFrame, DrawPile } from "../../domain/game";
import { animateBattleAction } from "./battleAnimation";
import { prepareBattlePresentation } from "./battlePresentation";
import { presentationQueue } from "./presentationQueue";

export function useBattleController(initial: Battle | null = null) {
  const [battle, renderBattle] = useState(initial);
  const current = useRef(initial);
  const [settling, setSettling] = useState(false);
  const [pending, setPending] = useState(0);
  const [actionLabel, setActionLabel] = useState("");
  const playing = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  const queue = useRef(presentationQueue());
  const generation = useRef(0);
  const setBattle = (next: Battle | null) => {
    current.current = next;
    renderBattle(next);
  };
  function abort() {
    generation.current++;
    controllers.current.forEach((controller) => controller.abort());
    controllers.current.clear();
    queue.current = presentationQueue();
    playing.current = false;
    setPending(0);
    setSettling(false);
    setActionLabel("");
  }
  useEffect(() => {
    const active = controllers.current;
    const version = generation;
    return () => {
      version.current++;
      active.forEach((controller) => controller.abort());
      active.clear();
    };
  }, []);

  function present(before: Battle, plan: { state: Battle; frames: BattleFrame[] }) {
    if (plan.state === before) return;
    if (!plan.frames.length) {
      setBattle(plan.state);
      return;
    }
    const controller = new AbortController();
    const epoch = generation.current;
    controllers.current.add(controller);
    const presentation = prepareBattlePresentation(before, plan.frames, controller.signal);
    // Rules commit immediately. Animation completion never writes a stale snapshot.
    flushSync(() => {
      setBattle(plan.state);
      setPending((count) => count + 1);
    });
    void queue.current
      .enqueue(presentation.keys, presentation.play)
      .catch((error) => {
        if (!controller.signal.aborted) console.error("部署动画失败", error);
      })
      .finally(() => {
        presentation.dispose();
        controllers.current.delete(controller);
        if (epoch === generation.current) setPending((count) => count - 1);
      });
  }

  async function playRoundPlan(
    plan: { state: Battle; frames: BattleFrame[] },
    waitForDeployments = false,
  ) {
    if (playing.current) return;
    playing.current = true;
    const epoch = generation.current;
    const controller = new AbortController();
    controllers.current.add(controller);
    flushSync(() => setSettling(true));
    try {
      if (waitForDeployments) await queue.current.idle();
      if (controller.signal.aborted) return;
      for (const frame of plan.frames) {
        const retained: (() => void)[] = [];
        try {
          flushSync(() => setActionLabel(frame.action.label));
          await animateBattleAction(frame.action, controller.signal, frame.state, retained);
          if (controller.signal.aborted) return;
          // The next action must see the newly committed card, before cleanup
          // restores any hidden source or removes its landing/death pose.
          flushSync(() => setBattle(frame.state));
        } finally {
          retained.forEach((cleanup) => cleanup());
        }
      }
      if (!controller.signal.aborted) flushSync(() => setBattle(plan.state));
    } finally {
      controllers.current.delete(controller);
      if (epoch === generation.current) {
        playing.current = false;
        setSettling(false);
        setActionLabel("");
      }
    }
  }

  return {
    battle,
    setBattle,
    settling,
    pending: pending > 0,
    actionLabel,
    abort,
    select(id: string | null) {
      if (current.current && !playing.current) setBattle(selectSummon(current.current, id));
    },
    draw(pile: DrawPile) {
      if (current.current && !playing.current) setBattle(drawCard(current.current, pile));
    },
    sacrifice(id: string) {
      if (current.current && !playing.current)
        present(current.current, markSacrifice(current.current, id));
    },
    deploy(row: number, col: number) {
      const state = current.current;
      if (state?.summon && !playing.current)
        present(state, planDeploy(state, state.summon.cardId, row, col));
    },
    end() {
      if (!current.current || playing.current) return;
      const plan = planRound(current.current);
      if (plan.state !== current.current) void playRoundPlan(plan, true);
    },
    search(id: string) {
      const state = current.current;
      if (!state || playing.current) return;
      const plan = planSearch(state, id);
      if (state.continuation?.operation.kind === "round") void playRoundPlan(plan);
      else present(state, plan);
    },
  };
}
