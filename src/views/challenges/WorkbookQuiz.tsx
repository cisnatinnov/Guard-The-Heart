import { useEffect, useState } from 'react'
import { QuestionPicker } from './QuestionPicker'
import { ChallengeTurnOrder } from './ChallengeTurnOrder'
import { TurnReminder } from './TurnReminder'
import { getGameQuestions } from '../../services/gameQuestionCache'

export function useWorkbookQuiz(challengeId: string, gameKey: 'match-card' | 'jaws-of-risk') {
  const key = `guard-the-heart-quiz:${challengeId}`
  const read = () => {
    try { return JSON.parse(localStorage.getItem(key) ?? '{}') as { index?: number; revealed?: boolean; selected?: string[]; hovered?: string; graded?: boolean; answerSelection?: {questionId: string; teamId: string; option: string} } }
    catch { return {} }
  }
  const [state, setState] = useState(read)
  useEffect(() => {
    const update = () => setState(read())
    update()
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) update() }
    window.addEventListener('storage', storage)
    window.addEventListener(key, update)
    return () => { window.removeEventListener('storage', storage); window.removeEventListener(key, update) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const all = getGameQuestions(gameKey)
  const selected = state.selected ?? all.slice(0, 10).map((q) => q.id)
  const bank = all.filter((q) => selected.includes(q.id)).slice(0, 10)
  const index = Math.max(0, Math.min(bank.length - 1, state.index ?? 0))
  const question = bank[index]
  const save = (next: { index: number; revealed: boolean }) => {
    localStorage.setItem(key, JSON.stringify({ ...state, ...next, graded: false, hovered: undefined, answerSelection: next.index === index ? state.answerSelection : undefined }))
    window.dispatchEvent(new Event(key))
  }
  const choose = (ids: string[]) => {
    localStorage.setItem(key, JSON.stringify({ index: 0, revealed: false, selected: ids }))
    window.dispatchEvent(new Event(key))
  }
  const patch = (value: object) => { localStorage.setItem(key, JSON.stringify({...read(), ...value})); window.dispatchEvent(new Event(key)) }
  const selectAnswer = (option: string, teamId: string) => { if(question?.options.includes(option)) patch({answerSelection:{questionId:question.id, teamId, option}}) }
  const hover = (hovered?: string) => patch({hovered})
  const grade = () => patch({graded:true, revealed:true, hovered:undefined})
  return { state, all, selected, bank, index, question, save, choose, selectAnswer, hover, grade }
}

export function WorkbookQuiz({ challengeId, gameKey, canControl, locked = false, teamId = '', eliminatedIds = [], answerDisabled = false, selectedAnswer, onAnswer }: {
  challengeId: string; gameKey: 'match-card' | 'jaws-of-risk'; canControl: boolean; locked?: boolean; teamId?: string; eliminatedIds?: string[]; answerDisabled?: boolean; selectedAnswer?: string; onAnswer?: (option: string) => void
}) {
  const { state, all, selected, bank, index, question, save, choose, hover } = useWorkbookQuiz(challengeId, gameKey)
  return <section className="workbook-quiz" aria-label="Workbook question">
    {canControl && <><ChallengeTurnOrder disabled={locked} unavailableIds={eliminatedIds} showOut={gameKey === 'jaws-of-risk'} /><fieldset disabled={locked}><QuestionPicker questions={all} selected={selected} onChange={choose} /></fieldset></>}
    {question ? <>

    <p className="workbook-quiz__eyebrow">Question {index + 1} / {bank.length} · {question.hint}</p>
    <h2>{question.prompt}</h2>{canControl && <TurnReminder challengeId={challengeId} turnKey={`${question.id}:${teamId}`} canControl />}
    <ol className="workbook-quiz__options" aria-label="Answer options">{question.options.map((option, index) => {
      const selected = (state.answerSelection?.questionId === question.id && state.answerSelection.teamId === teamId ? state.answerSelection.option : selectedAnswer) === option
      const className = `quiz-option${selected ? ' is-selected' : ''}${state.hovered === option ? ' is-hovered' : ''}`
      const content = <><b aria-hidden="true">{String.fromCharCode(65+index)}</b><span>{option}</span></>
      return <li key={option}>{canControl ? <button type="button" className={className} disabled={locked || answerDisabled} aria-pressed={selected} onMouseEnter={() => hover(option)} onMouseLeave={() => hover()} onFocus={() => hover(option)} onBlur={() => hover()} onClick={() => onAnswer?.(option)}>{content}</button> : <div className={`${className} quiz-option--public`}>{content}</div>}</li>
    })}</ol>
    {state.graded && <div className="grade-result" role="status"><strong>{state.answerSelection?.option === question.answer ? '\u2713 Correct answer' : '\u2715 Wrong answer'}</strong><p>Correct answer: {question.answer}</p></div>}
    {state.revealed && <div className="workbook-quiz__answer" role="status"><strong>{question.answer}</strong><p>{question.explanation}</p></div>}
    {canControl && <div className="game__toolbar">
      <button className="ghost" disabled={locked || index === 0} onClick={() => save({ index: index - 1, revealed: false })}>Previous question</button>
      <button className="ghost" onClick={() => save({ index, revealed: !state.revealed })}>{state.revealed ? 'Hide answer' : 'Reveal answer'}</button>
      <button disabled={locked || index === bank.length - 1} onClick={() => save({ index: index + 1, revealed: false })}>Next question</button>
    </div>}
    </> : <p role="status">Choose at least one question to play.</p>}
  </section>
}
