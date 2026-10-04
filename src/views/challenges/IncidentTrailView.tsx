import { useMemo, useState } from 'react'
import {
  INCIDENT_TRAIL_ANSWER_SHEET_COUNT,
  INCIDENT_TRAIL_CLUES,
  INCIDENT_TRAIL_INFORMATION,
  INCIDENT_TRAIL_SCENES,
  assignIncidentTrailClue,
  isClueCorrectForScene,
  scoreIncidentTrail,
  searchIncidentTrail,
  type IncidentTrailAssignments,
} from '../../services/games'

export function IncidentTrailView() {
  const [assignments, setAssignments] = useState<IncidentTrailAssignments>({})
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null)
  const [openSheetId, setOpenSheetId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const score = useMemo(() => scoreIncidentTrail(assignments), [assignments])
  const visibleInformation = useMemo(
    () =>
      searchIncidentTrail(search).map((entry) => ({
        entry,
        index: INCIDENT_TRAIL_INFORMATION.indexOf(entry) + 1,
      })),
    [search]
  )

  function fileClue(sceneId: string) {
    if (!selectedClueId) return
    const result = assignIncidentTrailClue(assignments, selectedClueId, sceneId)
    setAssignments(result.assignments)
    setMessage(result.correct ? 'Clue locks in. Scene closed.' : 'That clue belongs to another scene.')
    setSelectedClueId(null)
  }

  function reset() {
    setAssignments({})
    setSelectedClueId(null)
    setOpenSheetId(null)
    setSearch('')
    setMessage(null)
  }

  return (
    <div className="game">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__label">Scenes closed</span>
          <span className="stat__value">
            {score.solved}/{INCIDENT_TRAIL_SCENES.length}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Score</span>
          <span className="stat__value">
            {score.score}/{score.maximum}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Information</span>
          <span className="stat__value">{INCIDENT_TRAIL_INFORMATION.length}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Answer sheets</span>
          <span className="stat__value">{INCIDENT_TRAIL_ANSWER_SHEET_COUNT}</span>
        </div>
      </div>

      {message && <p className="alert alert--info">{message}</p>}

      <ul className="scene-grid">
        {INCIDENT_TRAIL_SCENES.map((scene) => {
          const clueId = assignments[scene.id]
          const solved = clueId ? isClueCorrectForScene(clueId, scene.id) : false
          const clue = INCIDENT_TRAIL_CLUES.find((entry) => entry.id === clueId)
          return (
            <li key={scene.id} className={`scene${solved ? ' scene--solved' : ''}`}>
              <span className="scene__title">{scene.title}</span>
              <span className="scene__question">{scene.question}</span>
              <span className={solved ? 'scene__answer' : 'muted'}>
                {clue ? (solved ? scene.answer : `Filed: ${clue.text}`) : 'No clue filed'}
              </span>
              <button type="button" className="ghost" disabled={!selectedClueId} onClick={() => fileClue(scene.id)}>
                {clueId ? 'Re-file selected clue' : 'File selected clue'}
              </button>
            </li>
          )
        })}
      </ul>

      <h3 className="game__subtitle">Clue tray</h3>
      <p className="muted">
        Pick a clue, then file it against a scene. {INCIDENT_TRAIL_CLUES.length} of the{' '}
        {INCIDENT_TRAIL_INFORMATION.length} pieces are clues.
      </p>
      <ul className="clue-tray">
        {INCIDENT_TRAIL_CLUES.map((clue) => (
          <li key={clue.id}>
            <button
              type="button"
              className={`clue${selectedClueId === clue.id ? ' clue--selected' : ''}`}
              onClick={() => setSelectedClueId((previous) => (previous === clue.id ? null : clue.id))}
            >
              {clue.text}
            </button>
          </li>
        ))}
      </ul>

      <h3 className="game__subtitle">Information and answer sheets</h3>
      <label className="field">
        <span>Search the evidence box</span>
        <input
          type="search"
          value={search}
          placeholder="harbour, badge, lens…"
          aria-label="Search information"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <ul className="evidence-grid">
        {visibleInformation.map(({ entry, index }) => (
          <li key={entry.id} className="evidence">
            <button
              type="button"
              className="ghost"
              onClick={() => setOpenSheetId((previous) => (previous === entry.id ? null : entry.id))}
            >
              #{index} {entry.headline}
            </button>
            <p className="muted">{entry.detail}</p>
            {openSheetId === entry.id && (
              <p className="evidence__sheet">
                <strong>Answer sheet:</strong> {entry.answerSheet}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="game__toolbar">
        <button type="button" className="ghost" onClick={reset}>
          Clear the board
        </button>
      </div>
    </div>
  )
}