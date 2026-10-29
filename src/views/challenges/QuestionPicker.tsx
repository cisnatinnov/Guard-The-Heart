export function QuestionPicker({ questions, selected, onChange }: {
  questions: { id: string; prompt: string }[]; selected: string[]; onChange: (ids: string[]) => void
}) {
  return <details className="question-picker">
    <summary>Choose questions · {selected.length}/10 selected</summary>
    <p>Select 1–10 questions. Questions play in bank order.</p>
    <div className="game__toolbar"><button type="button" className="ghost" onClick={() => onChange(questions.slice(0, 10).map((q) => q.id))}>First 10</button><button type="button" className="ghost" onClick={() => onChange([])}>Clear selection</button></div>
    <div className="question-picker__list">{questions.map((q, index) => <label key={q.id}>
      <input type="checkbox" checked={selected.includes(q.id)} disabled={!selected.includes(q.id) && selected.length >= 10} onChange={() => onChange(questions.filter((entry) => entry.id === q.id ? !selected.includes(q.id) : selected.includes(entry.id)).map((entry) => entry.id))} />
      <span>{index + 1}. {q.prompt}</span>
    </label>)}</div>
  </details>
}
