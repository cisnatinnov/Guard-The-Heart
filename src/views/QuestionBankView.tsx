import { useState, type FormEvent } from 'react'
import { getGameQuestions, type GameQuestionRecord, type QuestionBankKey } from '../services/gameQuestionCache'
import { deleteQuestion, saveQuestion } from '../services/questionBank'
import { useQuestionBank } from '../hooks/useQuestionBank'
import '../styles/question-bank.css'

const empty = { prompt: '', answer: '', hint: '', explanation: '', options: ['', '', '', ''] }
export function QuestionBankView() {
  useQuestionBank()
  const [bank, setBank] = useState<QuestionBankKey>('image-decode')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const questions = getGameQuestions(bank)
  const filtered = questions.filter(q => `${q.prompt} ${q.answer} ${q.hint}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, pages)
  const start = (question?: GameQuestionRecord) => {
    setEditing(question?.id ?? null)
    setForm(question ? { prompt: question.prompt, answer: question.answer, hint: question.hint, explanation: question.explanation ?? '', options: question.options.length ? [...question.options] : ['', '', '', ''] } : { ...empty, options: ['', '', '', ''] })
    setOpen(true); setPendingDelete(null); setError(''); setNotice('')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await saveQuestion({ ...form, bank }, editing ?? undefined); setOpen(false); setNotice(editing ? 'Question updated.' : 'Question added.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setBusy(true); setError('')
    try { await deleteQuestion(id); setPendingDelete(null); setNotice('Question deleted.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  return <section className="view question-bank">
    <header className="view__header"><div><h2>Question Bank</h2><p>Manage the questions used in your challenges. Changes are saved on this device.</p></div></header>
    <div className="question-bank__toolbar">
      <label className="field"><span>Question bank</span><select aria-label="Question bank" value={bank} disabled={busy} onChange={event => { setBank(event.target.value as QuestionBankKey); setPage(1); setSearch(''); setOpen(false); setPendingDelete(null); setError(''); setNotice('') }}><option value="image-decode">Challenge 1 · Image Decode</option><option value="match-card">Challenges 2 &amp; 3 · Shared questions</option></select></label>
      <label className="field"><span>Search questions</span><input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
      <button type="button" disabled={busy} onClick={() => start()}>Add question</button>
    </div>
    <p className="muted">{questions.length} questions · {bank === 'image-decode' ? 'Only used by Challenge 1.' : 'The same questions and answers are available in Challenges 2 and 3.'}</p>
    {error && <p className="alert alert--error" role="alert">{error}</p>}
    {notice && <p className="alert alert--ok" role="status">{notice}</p>}
    {open && <form className="question-editor" onSubmit={event => void submit(event)} aria-label={editing ? 'Edit question' : 'Add question'}>
      <h3>{editing ? 'Edit question' : 'Add question'}</h3>
      <fieldset disabled={busy}>
        <label className="field"><span>{bank === 'image-decode' ? 'Question / emoji clue' : 'Question'}</span><textarea aria-label={bank === 'image-decode' ? 'Question / emoji clue' : 'Question'} required rows={3} value={form.prompt} onChange={event => setForm({ ...form, prompt: event.target.value })} /></label>
        <label className="field"><span>Hint / topic</span><input value={form.hint} onChange={event => setForm({ ...form, hint: event.target.value })} /></label>
        {bank === 'match-card' && <div className="question-editor__options">{form.options.map((option, index) => <label className="field" key={index}><span>Option {String.fromCharCode(65 + index)}</span><input required value={option} onChange={event => { const options = form.options.map((value, i) => i === index ? event.target.value : value); setForm({ ...form, options, answer: option !== '' && form.answer === option ? event.target.value : form.answer }) }} /></label>)}</div>}
        <label className="field"><span>Correct answer</span>{bank === 'image-decode' ? <input required value={form.answer} onChange={event => setForm({ ...form, answer: event.target.value })} /> : <select aria-label="Correct answer" required value={form.answer} onChange={event => setForm({ ...form, answer: event.target.value })}><option value="">Choose the correct option</option>{form.options.map((option, i) => <option key={i} value={option} disabled={!option.trim()}>{String.fromCharCode(65 + i)} · {option || 'Enter option text'}</option>)}</select>}</label>
        <label className="field"><span>Explanation</span><textarea aria-label="Explanation" rows={3} value={form.explanation} onChange={event => setForm({ ...form, explanation: event.target.value })} /></label>
        <div className="game__toolbar"><button type="submit">{busy ? 'Saving…' : 'Save question'}</button><button className="ghost" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
      </fieldset>
    </form>}
    <div className="question-bank__list">{filtered.slice((currentPage - 1) * 10, currentPage * 10).map(question => <article className="question-bank__item" key={question.id}>
      <div><p className="muted">#{question.number} · {question.hint || (question.kind === 'decode' ? 'Image Decode' : 'Multiple choice')}</p><h3>{question.prompt}</h3>
        {question.options.length > 0 && <ol type="A">{question.options.map((option, i) => <li key={i}>{option}</li>)}</ol>}
        <p><strong>Correct answer:</strong> {question.answer}</p>{question.explanation && <p className="muted">{question.explanation}</p>}
      </div>
      <div className="question-bank__actions"><button className="ghost" disabled={busy} type="button" onClick={() => start(question)}>Edit</button><button className="danger" disabled={busy} type="button" onClick={() => { setPendingDelete(question.id); setError('') }}>Delete</button></div>
      {pendingDelete === question.id && <div className="question-bank__delete" role="group" aria-label="Confirm deletion"><p>Delete this question from {bank === 'image-decode' ? 'Challenge 1' : 'both Challenges 2 and 3'}?</p><button className="danger" type="button" disabled={busy} onClick={() => void remove(question.id)}>Confirm delete</button><button className="ghost" type="button" disabled={busy} onClick={() => setPendingDelete(null)}>Keep question</button></div>}
    </article>)}</div>
    {!filtered.length && <p role="status">No questions match your search.</p>}
    <div className="game__toolbar" aria-label="Question pages"><button className="ghost" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous page</button><span>Page {currentPage} of {pages} · {filtered.length} results</span><button className="ghost" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next page</button></div>
  </section>
}
