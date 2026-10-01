import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MapView } from '../src/features/adventure/AdventureView'
import { newAdventure, enterNode, finishNode } from '../src/domain/adventure'
import '../src/app/index.css'
import '../src/app/App.css'

// Development harness only: actual map component, deterministic samples and
// simulated event completion. No seed/debug controls are added to the game.
export function MapCheck() {
  const [seed, setSeed] = useState(1)
  const [run, setRun] = useState(() => newAdventure(1))
  const [narrow, setNarrow] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  return <main style={{ padding: 20, maxWidth: 1100, margin: 'auto' }}>
    <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
      <label>种子 <input aria-label="种子" type="number" value={seed} onChange={e => setSeed(Number(e.target.value))} /></label>
      <button onClick={() => setRun(newAdventure(seed))}>生成</button>
      <button onClick={() => { const next = seed + 1; setSeed(next); setRun(newAdventure(next)) }}>下一个种子</button>
      <label><input type="checkbox" checked={narrow} onChange={e => setNarrow(e.target.checked)} />窄屏容器</label>
      <label><input type="checkbox" checked={readOnly} onChange={e => setReadOnly(e.target.checked)} />只读地图</label>
      <button disabled={!run.visit} onClick={() => setRun(finishNode({ ...run, visit: run.visit ? { ...run.visit, done: true } : null }))}>完成节点</button>
      <output aria-label="当前访问">{run.visit?.nodeId ?? '无'} · 已完成 {run.path.length}</output>
    </header>
    <div className="map-layout" style={narrow ? { width: 360, maxWidth: '100%' } : undefined}>
      <MapView run={run} onEnter={id => setRun(enterNode(run, id))} readOnly={readOnly} />
    </div>
  </main>
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<MapCheck />)
