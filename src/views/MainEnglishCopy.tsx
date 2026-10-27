import { GameCharacters } from './GameCharacters'

/** Live English slides replace legacy character artwork and baked rule text. */
export function MainEnglishCopy({ index }: { index: number }) {
  if (index === 0) return <div className="fight-opening" aria-label="Fight the Dragon opening slide"><img className="fight-opening__logo" src="/fight-the-dragon-logo.png" alt="Fight the Dragon" /><GameCharacters className="opening-characters" /></div>
  if (index === 3) return <div className="fight-dragon-intro"><img src="/characters/gilgamesh.png" alt="Gilgamesh, the silver and cobalt dragon" /><h2>GILGAMESH</h2><p>The dragon is coming. Prepare your defenses.</p></div>
  if (index === 1) return <div className="brand-slide brand-slide--goals" aria-label="Game goals"><h2>GAME GOALS</h2><div className="goal-cards">
    {[
      ['◆', 'Protect the Heart', 'Protect the Heart of Awareness.'],
      ['✦', 'Complete challenges', 'Complete challenges and claim rewards.'],
      ['⬡', 'Face Gilgamesh', 'Survive Gilgamesh attacks.'],
      ['♜', 'Win together', 'The team with the most Guard Power wins.'],
    ].map(([icon, title, body], slot) => <article key={title}><span>{icon}</span><small>0{slot + 1}</small><h3>{title}</h3><p>{body}</p></article>)}
  </div></div>
  if (index === 2) return <div className="brand-slide brand-slide--gp" aria-label="Guard Power rules">
    <h2>WHAT IS GUARD POWER?</h2>
    <div className="brand-slide__copy"><article><h3>Guard Power (GP)</h3><p>Energy that helps the Heart of Awareness survive Gilgamesh attacks.</p></article>
      <article><h3>Team goal</h3><p>Collect GP to strengthen the Heart of Awareness.</p><strong>Every team starts with 5 GP.</strong></article>
      <article className="brand-slide__warning"><h3>Stay in the fight</h3><p>A team with 0 GP is eliminated and can no longer defend the Heart of Awareness.</p></article></div>
    <GameCharacters className="rules-characters" />
  </div>
  if (index === 4) return <div className="brand-slide brand-slide--challenge" aria-label="Image Decode introduction"><p className="brand-slide__eyebrow">CHALLENGE 1</p><h2>IMAGE<br />DECODE</h2><p className="brand-slide__tagline">Decode the clues. Strengthen your team.</p><GameCharacters className="challenge-characters" /></div>
  if (index === 5) return <div className="brand-slide brand-slide--rules" aria-label="Image Decode rules">
    <h2>HOW TO PLAY</h2><GameCharacters className="howto-characters" /><div className="brand-slide__rule-cards">
      <article><h3>1. Decode the clue</h3><p>Each answering team has 15 seconds to solve the image clue.</p><p className="brand-slide__clue">🔥 + 🌍 + 🔒 + 🛡️</p></article>
      <article><h3>2. Record the answer</h3><p>Answer yourself or pass to an opponent. The answering team receives the score.</p><p className="brand-slide__right">Right Answer: +10</p><p className="brand-slide__wrong">Wrong Answer or timeout: −10</p></article>
    </div>
  </div>
  return null
}
