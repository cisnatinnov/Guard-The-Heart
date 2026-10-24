import { hasDistinctFortuneEffects, type FortuneChoice } from '../services/tacticalPhase'
import { CARD_BACK_IMAGE, cardTitleFor } from '../data/card-pool'
import { CardTile } from './CardTile'
import { englishText } from '../services/english'

export function FortuneReveal({ teamName, offer, selectedId, onClose, onChoose, busy = false }: {
  teamName:string; offer:FortuneChoice; selectedId?:string; onClose:()=>void; onChoose?:(id:string)=>void; busy?:boolean
}) {
  const options = hasDistinctFortuneEffects(offer.options) ? offer.options : []
  const selected = options.find((option) => option.id === selectedId)
  const closed = offer.publicClosed !== false
  return <aside className="fortune-reveal" aria-label={`Fortune Draw · ${teamName}`}>
    <header><h2>Team {teamName.replace(/^tim\s+/i, '')} · Fortune Draw</h2><button type="button" onClick={onClose}>Back to Card Reveal</button></header>
    <div className="fortune-reveal__body">
      <div className="fortune-reveal__options" style={{gridTemplateColumns:`repeat(${Math.max(1,options.length)},minmax(0,1fr))`}} aria-label="Fortune Draw options">
        {!options.length && <p role="status">Waiting for the admin to refresh the Fortune Draw choices.</p>}
        {options.map((option,index) => <button type="button" className={`fortune-reveal__option${option.id === selectedId ? ' is-selected' : ''}`}
          key={option.id} disabled={busy || !!selectedId || !onChoose} onClick={() => onChoose?.(option.id)}
          aria-label={option.id === selectedId ? `${cardTitleFor(option.name,option.type)} · Chosen card` : closed ? `Choose closed card ${index+1}` : `Choose ${option.type} ${cardTitleFor(option.name,option.type)} option ${index+1}`}>
          {option.id === selectedId || !closed ? <CardTile {...option} /> : <div className="card-art"><img src={CARD_BACK_IMAGE} alt="Closed card" /></div>}
          <span>{option.id === selectedId ? '✓ Chosen card' : closed ? `Card ${index+1}` : `${option.type} · ${cardTitleFor(option.name,option.type)}`}</span>
        </button>)}
      </div>
      <div className="fortune-reveal__effect" aria-live="polite"><h3>{selected ? cardTitleFor(selected.name,selected.type) : closed ? 'Choose one closed card' : 'Choose one card'}</h3>
        <p>{selected ? englishText(selected.effect_action) : 'Click one card to choose your reward. The choice is final.'}</p>
        {selected && <p className="fortune-reveal__timing">Added to this team’s collection for the next challenge. This effect does not activate in the current attack.</p>}
      </div>
    </div>
  </aside>
}
