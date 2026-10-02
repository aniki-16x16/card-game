/** Independent slots run together; overlapping slots retain rule order. */
export function presentationQueue() {
  const jobs = new Map<Promise<void>, Set<string>>();
  return {
    enqueue(keys: Iterable<string>, run: () => Promise<void>) {
      const resources = new Set(keys);
      const blockers = [...jobs].filter(([, held]) => [...resources].some((key) => held.has(key)));
      const done = Promise.all(blockers.map(([job]) => job)).then(run);
      jobs.set(done, resources);
      void done.finally(() => jobs.delete(done)).catch(() => {});
      return done;
    },
    async idle() {
      while (jobs.size) await Promise.all([...jobs.keys()]);
    },
  };
}
