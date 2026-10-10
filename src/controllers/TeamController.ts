import { Team, TEAM_STATUSES, type TeamStatus } from '../models'
import { dbEvents, DB_EVENTS } from '../hooks/useDbEvents'
import { ChallengePoint } from '../models'

export interface TeamInput {
  name: string
  status?: TeamStatus
}

export interface HeartTowerColumn {
  team: Team
  /** Guard power earned beyond the 5 every team starts with. */
  earned: number
}

export class TeamController {
  static async list(options: { includeInactive?: boolean } = {}): Promise<Team[]> {
    return Team.findAll({
      where: options.includeInactive ? {} : { status: 'active' },
      order: [['name', 'ASC']],
    })
  }

  static async heartTower(options: { includeInactive?: boolean } = {}): Promise<HeartTowerColumn[]> {
    const teams = await Team.findAll({
      where: options.includeInactive ? {} : { status: 'active' },
      order: [['total_gp', 'DESC'], ['name', 'ASC']],
    })
    const earnedRows = await ChallengePoint.findAll({ attributes: ['team', 'guard_power'] })
    const earnedByTeam = new Map<string, number>()
    for (const entry of earnedRows) {
      earnedByTeam.set(entry.team, (earnedByTeam.get(entry.team) ?? 0) + Number(entry.guard_power ?? 0))
    }
    return teams.map((team) => ({ team, earned: earnedByTeam.get(team.id) ?? 0 }))
  }

  static async getById(id: string): Promise<Team | null> {
    return Team.findByPk(id)
  }

  static async create(input: string | TeamInput): Promise<Team> {
    const raw = typeof input === 'string' ? { name: input } : input
    const name = raw.name.trim()
    if (!name) throw new Error('Team name is required')
    const status = raw.status ?? 'active'
    if (!TEAM_STATUSES.includes(status)) throw new Error('Team status is invalid')

    const duplicate = await Team.findOne({ where: { name } })
    if (duplicate) throw new Error(`Team "${name}" already exists`)

    const team = await Team.create({ name, status })
    dbEvents.emit(DB_EVENTS.TEAMS_CHANGED)
    return team
  }

  static async rename(id: string, name: string): Promise<Team | null> {
    const team = await Team.findByPk(id)
    if (!team) return null
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Team name is required')
    const duplicate = await Team.findOne({ where: { name: trimmed } })
    if (duplicate && duplicate.id !== id) throw new Error(`Team "${trimmed}" already exists`)
    await team.update({ name: trimmed })
    dbEvents.emit(DB_EVENTS.TEAMS_CHANGED)
    return team
  }

  static async setStatus(id: string, status: TeamStatus): Promise<Team | null> {
    if (!TEAM_STATUSES.includes(status)) throw new Error('Team status is invalid')
    const team = await Team.findByPk(id)
    if (!team) return null
    await team.update({ status })
    dbEvents.emit(DB_EVENTS.TEAMS_CHANGED)
    return team
  }

  static async toggleStatus(id: string): Promise<Team | null> {
    const team = await Team.findByPk(id)
    if (!team) return null
    const result = await TeamController.setStatus(id, team.status === 'active' ? 'inactive' : 'active')
    return result
  }

  static async remove(id: string): Promise<boolean> {
    const deleted = await Team.destroy({ where: { id } })
    if (deleted > 0) {
      dbEvents.emit(DB_EVENTS.TEAMS_CHANGED)
    }
    return deleted > 0
  }
}