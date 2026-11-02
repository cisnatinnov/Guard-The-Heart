import { ChallengeRunController } from '../../controllers/ChallengeRunController'
import { readSharedChallengeRun, publishSharedChallengeRun } from './runSync'
import { withPlayLock } from './playLock'

export async function playMatchingCard(challengeId: string, answerId: string, cardId: string) {
  await withPlayLock(`matching:${challengeId}`, async () => {
    const run = readSharedChallengeRun('word-assembly', challengeId)
    if (!run?.matchingOnly || run.matchingAnswerId !== answerId || !run.matchingDeadline || !run.matchingPreviewDeadline) return
    const next = await ChallengeRunController.flipMatchingOnly(run, cardId)
    // A host may have ended or replaced the attempt while scoring was saved.
    if (readSharedChallengeRun('word-assembly', challengeId) !== null
      && readSharedChallengeRun('word-assembly', challengeId)?.matchingAnswerId === answerId) {
      publishSharedChallengeRun('word-assembly', challengeId, next)
    }
  })
}

export async function closeMatchingCards(challengeId: string, answerId: string, deadline: number) {
  await withPlayLock(`matching:${challengeId}`, async () => {
    const run = readSharedChallengeRun('word-assembly', challengeId)
    if (!run || run.matchingAnswerId !== answerId || run.matchingCloseDeadline !== deadline
      || run.matchingBoard?.revealed.length !== 2 || Date.now() < deadline) return
    const next = await ChallengeRunController.finishMatchingTurn({ ...run, matchingCloseDeadline: undefined })
    if (readSharedChallengeRun('word-assembly', challengeId)?.matchingAnswerId === answerId) {
      publishSharedChallengeRun('word-assembly', challengeId, next)
    }
  })
}
