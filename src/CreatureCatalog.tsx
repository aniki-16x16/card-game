import { SigilIcon } from './SigilIcon'
import { useState } from 'react'
import { CardFace } from './Cards'
import { allCreatures, allTokens, SIGILS, TRIBES, sigils } from './game'
import type { Tribe } from './game'
import './App.css'
import './CreatureCatalog.css'

export function CreatureCatalog() {
  const [tribe, setTribe] = useState<Tribe | 'all'>('all')
  const [cost, setCost] = useState('all')
  const [search, setSearch] = useState('')
  const [tokens, setTokens] = useState(false)
  const pool = tokens ? allTokens() : allCreatures()
  const cards = pool.filter(card => (tribe === 'all' || card.tribe === tribe) && (cost === 'all' || card.cost === Number(cost)) && `${card.name} ${sigils(card).map(s => SIGILS[s].name + SIGILS[s].description).join(' ')}`.includes(search.trim()))
  return <main className="creature-catalog">
    <header className="catalog-heading">
      <div><span className="eyebrow">VERDANT PACT / BESTIARY</span><h1>生物图鉴</h1><p>{allCreatures().length} 张基础牌 · 6 个类别 · {Object.keys(SIGILS).length} 种印记</p></div>
      <a href="/">返回冒险 →</a>
    </header>
    <div className="catalog-filters">
      <div className="catalog-tribes" aria-label="种族筛选"><button aria-pressed={tribe === 'all'} onClick={() => setTribe('all')}>全部种族</button>{Object.entries(TRIBES).map(([key, name]) => <button key={key} aria-pressed={tribe === key} onClick={() => setTribe(key as Tribe)}>{name} <small>{pool.filter(c => c.tribe === key).length}</small></button>)}</div>
      <label>费用 <select value={cost} onChange={e => setCost(e.target.value)}><option value="all">全部费用</option>{[0, 1, 2, 3].map(n => <option key={n} value={n}>{n} 费</option>)}</select></label>
      <label className="catalog-search">搜索 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="名称、印记或效果" /></label>
      <label><input type="checkbox" checked={tokens} onChange={e => setTokens(e.target.checked)} /> 查看衍生物</label>
      <p role="status">显示 {cards.length} / {pool.length} 张{tokens ? '衍生物（由效果生成，不进入奖励池）' : '基础牌'}</p>
    </div>
    <section className="catalog-grid" aria-label="全部生物卡片">
      {cards.map(card => <article className="catalog-entry" key={card.id} aria-label={card.name}>
        <CardFace card={card} />
        <div className="catalog-description">
          <h2>{card.name}<small>{TRIBES[card.tribe]} · {card.cost} 费</small></h2>
          {sigils(card).length ? sigils(card).map(sigil => <p key={sigil}><strong><SigilIcon sigil={sigil}/> {SIGILS[sigil].name} <small>转移占用 {SIGILS[sigil].weight} 容量</small></strong>{SIGILS[sigil].description}</p>) : <p className="catalog-muted">无天生印记</p>}
        </div>
      </article>)}
    </section>
    {!cards.length && <p className="catalog-empty">没有符合筛选条件的生物。</p>}
  </main>
}
