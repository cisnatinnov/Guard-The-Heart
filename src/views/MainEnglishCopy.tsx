/** English copy covers baked labels while retaining the supplied artwork. */
export function MainEnglishCopy({ index }: { index: number }) {
  if (index === 1) return <div className="english-slide-copy english-slide-copy--goals" aria-label="Game goals">
    <h2>GAME GOALS</h2>
    {['Protect the Heart of Awareness.', 'Complete challenges and claim rewards.', 'Survive GigaRisk attacks.', 'The team with the most Guard Power wins.'].map((text, slot) => <p key={text} style={{ left: `${5.6 + slot * 23.1}%` }}>{text}</p>)}
  </div>
  if (index === 2) return <div className="english-slide-copy english-slide-copy--gp" aria-label="Guard Power rules">
    <h2>WHAT IS GUARD POWER?</h2><h3 className="english-gp-label">Guard Power (GP)</h3>
    <p className="english-gp-body">Energy that helps the Heart of Awareness survive GigaRisk attacks.</p>
    <h3 className="english-gp-task">Team Goal</h3><p className="english-gp-task-body">Collect GP to strengthen the Heart of Awareness.</p>
    <p className="english-gp-start">Every team starts with <strong>5 GP</strong>.</p>
    <h3 className="english-gp-warning">Warning</h3><p className="english-gp-warning-body">A team with 0 GP is eliminated and can no longer help defend the Heart of Awareness.</p>
  </div>
  if (index === 5) return <div className="english-slide-copy english-slide-copy--rules" aria-label="Image Decode rules">
    <h2>HOW TO PLAY</h2><div><h3>1. Decode the clue</h3><p>Each answering team has 15 seconds to solve the image clue.</p><p className="english-rule-clue">🔥 + 🌍 + 🔒 + 🛡️</p></div>
    <div><h3>2. Record the answer</h3><p>Answer yourself or pass the question to an opponent. The answering team receives the score.</p><p><strong>Right Answer: +10</strong></p><p><strong>Wrong Answer or timeout: −10</strong></p></div>
  </div>
  return null
}
