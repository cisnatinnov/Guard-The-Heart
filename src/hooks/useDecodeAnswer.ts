import { useEffect, useState } from 'react'

interface DecodeAnswer {
  runId?: string
  questionIndex: number
  turnTeam: string
  answeringTeam: string
  answer: string
}
const keyFor = (challengeId: string) => `guard-the-heart-decode-answer:${challengeId}`

export function publishDecodeAnswer(challengeId: string, answer: DecodeAnswer) {
  const key = keyFor(challengeId)
  localStorage.setItem(key, JSON.stringify(answer))
  window.dispatchEvent(new Event(key))
}

export function useDecodeAnswer(challengeId: string) {
  const key = keyFor(challengeId)
  const read = (): DecodeAnswer | null => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? 'null') as DecodeAnswer | null
      return value && typeof value.answer === 'string' && Number.isInteger(value.questionIndex)
        && typeof value.turnTeam === 'string' && typeof value.answeringTeam === 'string' ? value : null
    }
    catch { return null }
  }
  const [answer, setAnswer] = useState(read)
  useEffect(() => {
    const update = () => setAnswer(read())
    const stored = (event: StorageEvent) => { if (event.key === key || event.key === null) update() }
    update()
    window.addEventListener('storage', stored)
    window.addEventListener(key, update)
    return () => { window.removeEventListener('storage', stored); window.removeEventListener(key, update) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return answer
}
