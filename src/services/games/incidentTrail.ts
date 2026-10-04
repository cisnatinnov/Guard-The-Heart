import raw from '../../data/incident-trail.json'

export interface IncidentTrailScene {
  id: string
  title: string
  question: string
  answer: string
}

export interface IncidentTrailClue {
  id: string
  sceneId: string
  informationIndex: number
  text: string
}

export interface IncidentTrailInformation {
  id: string
  headline: string
  detail: string
  answerSheet: string
}

export const INCIDENT_TRAIL_SECONDS_PER_QUESTION = 20
export const INCIDENT_TRAIL_SCENES: IncidentTrailScene[] = raw.scenes
export const INCIDENT_TRAIL_CLUES: IncidentTrailClue[] = raw.clues
export const INCIDENT_TRAIL_INFORMATION: IncidentTrailInformation[] = raw.information

export const INCIDENT_TRAIL_SCENE_COUNT = INCIDENT_TRAIL_SCENES.length
export const INCIDENT_TRAIL_CLUE_COUNT = INCIDENT_TRAIL_CLUES.length
export const INCIDENT_TRAIL_INFORMATION_COUNT = INCIDENT_TRAIL_INFORMATION.length
export const INCIDENT_TRAIL_ANSWER_SHEET_COUNT = INCIDENT_TRAIL_INFORMATION.length
export const INCIDENT_TRAIL_POINTS_PER_SCENE = 20
export const INCIDENT_TRAIL_DECK_PATH = '/decks/incident-trail.pptx'
export const INCIDENT_TRAIL_CHALLENGE_ID = '4a8d1c76-9e30-42fb-85a7-6c1d0b73e924'

export type IncidentTrailAssignments = Record<string, string>

export function clueForScene(sceneId: string): IncidentTrailClue | undefined {
  return INCIDENT_TRAIL_CLUES.find((clue) => clue.sceneId === sceneId)
}

export function informationForClue(clueId: string): IncidentTrailInformation | undefined {
  const clue = INCIDENT_TRAIL_CLUES.find((entry) => entry.id === clueId)
  return clue ? INCIDENT_TRAIL_INFORMATION[clue.informationIndex] : undefined
}

export function isClueCorrectForScene(clueId: string, sceneId: string): boolean {
  return INCIDENT_TRAIL_CLUES.some((clue) => clue.id === clueId && clue.sceneId === sceneId)
}

export interface IncidentTrailAssignmentResult {
  assignments: IncidentTrailAssignments
  correct: boolean
}

/**
 * A clue can only be filed once. Filing it against the wrong scene removes any
 * clue already held by that scene so every scene keeps a single, honest slot.
 */
export function assignIncidentTrailClue(
  assignments: IncidentTrailAssignments,
  clueId: string,
  sceneId: string
): IncidentTrailAssignmentResult {
  if (!INCIDENT_TRAIL_CLUES.some((clue) => clue.id === clueId)) {
    return { assignments, correct: false }
  }
  if (!INCIDENT_TRAIL_SCENES.some((scene) => scene.id === sceneId)) {
    return { assignments, correct: false }
  }

  const withoutScene = Object.fromEntries(
    Object.entries(assignments).filter(([assignedScene, assignedClue]) => assignedScene !== sceneId && assignedClue !== clueId)
  )

  return {
    assignments: { ...withoutScene, [sceneId]: clueId },
    correct: isClueCorrectForScene(clueId, sceneId),
  }
}

export interface IncidentTrailScore {
  solved: number
  score: number
  maximum: number
  complete: boolean
}

export function scoreIncidentTrail(assignments: IncidentTrailAssignments): IncidentTrailScore {
  const solved = INCIDENT_TRAIL_SCENES.filter(
    (scene) => assignments[scene.id] && isClueCorrectForScene(assignments[scene.id], scene.id)
  ).length
  return {
    solved,
    score: solved * INCIDENT_TRAIL_POINTS_PER_SCENE,
    maximum: INCIDENT_TRAIL_SCENE_COUNT * INCIDENT_TRAIL_POINTS_PER_SCENE,
    complete: solved === INCIDENT_TRAIL_SCENE_COUNT,
  }
}

export function searchIncidentTrail(term: string): IncidentTrailInformation[] {
  const needle = term.trim().toLocaleLowerCase()
  if (needle.length === 0) return INCIDENT_TRAIL_INFORMATION
  return INCIDENT_TRAIL_INFORMATION.filter((entry) =>
    [entry.headline, entry.detail, entry.answerSheet].some((field) =>
      field.toLocaleLowerCase().includes(needle)
    )
  )
}