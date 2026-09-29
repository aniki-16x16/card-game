import { CardFace } from './Cards'
import { allCreatures, SIGILS, sigils } from './game'
import './App.css'
import './CreatureCatalog.css'

export function CreatureCatalog() {
  const cards = allCreatures()
  return <main className="creature-catalog">
    <header className="catalog-heading">
      <div><span className="eyebrow">VERDANT PACT / BESTIARY</span><h1>生物图鉴</h1><p>全部 {cards.length} 种生物 · 基础属性与天生印记</p></div>
      <a href="/">返回战场 →</a>
    </header>
    <section className="catalog-grid" aria-label="全部生物卡片">
      {cards.map(card => <article className="catalog-entry" key={card.id} aria-label={card.name}>
        <CardFace card={card} />
        <div className="catalog-description">
          <h2>{card.name}<small>{card.cost ? `${card.cost} 点献祭费用` : '免费召唤'}</small></h2>
          {sigils(card).length ? sigils(card).map(sigil => <p key={sigil}><strong>{SIGILS[sigil].icon} {SIGILS[sigil].name}</strong>{SIGILS[sigil].description}</p>) : <p className="catalog-muted">无天生印记</p>}
        </div>
      </article>)}
    </section>
  </main>
}
