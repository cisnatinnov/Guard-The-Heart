import { useSyncExternalStore } from 'react'
import { questionRevision, subscribeQuestions } from '../services/gameQuestionCache'
import { refreshGameQuestionCache } from '../services/gameQuestionSeeds'
import { useDbEventRefresh } from './useDbEventRefresh'
import { DB_EVENTS } from './useDbEvents'

export function useQuestionBank() {
  useDbEventRefresh(DB_EVENTS.QUESTIONS_CHANGED, () => { void refreshGameQuestionCache() })
  return useSyncExternalStore(subscribeQuestions, questionRevision)
}
