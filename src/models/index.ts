import { DataTypes, Model, type Sequelize } from 'sequelize'
import { v4 as uuidv4 } from 'uuid'
import { BASE_TEAM_GUARD_POWER, MAX_TOTAL_CARD } from '../services/rankRules'

export type TeamStatus = 'active' | 'inactive'

export const TEAM_STATUSES: TeamStatus[] = ['active', 'inactive']

export class Challenge extends Model {
  declare id: string
  declare name: string
  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

export class Team extends Model {
  declare id: string
  declare name: string
  declare status: TeamStatus
  declare total_gp: number
  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

export class ChallengeScoreboard extends Model {
  declare id: string
  declare challenge: string
  declare team: string
  declare score: number
  declare rank: number
  declare challenge_point: number
  declare guard_power: number
  declare card: number
  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

export class Scoreboard extends Model {
  declare id: string
  declare team: string
  declare total_score: number
  declare rank: number
  declare total_cp: number
  declare total_card: number
  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

export type CardType = 'Normal' | 'Rare' | 'Epic' | 'Legendary'
export type CardEffect = 'Defense' | 'Attack' | 'Heal' | 'Utility' | 'Support' | 'Thief'

export class Card extends Model {
  declare id: string
  declare name: string
  declare type: CardType
  declare effect: CardEffect
  declare effect_action: string
  declare icon: string
  declare challenge: string | null
  declare team: string | null
  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

export class TeamCard extends Model {
  declare id: string
  declare name: string
  declare type: CardType
  declare effect: CardEffect
  declare effect_action: string
  declare icon: string
  declare team: string | null
  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

let modelsDefined = false

export function defineModels(sequelize: Sequelize): void {
  if (modelsDefined) return

  Challenge.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      name: {
        type: DataTypes.STRING(225),
        allowNull: false,
        unique: true,
      },
    },
    { sequelize, modelName: 'challenge', tableName: 'challenge', timestamps: true }
  )

  Team.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      name: {
        type: DataTypes.STRING(225),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM(...TEAM_STATUSES),
        allowNull: false,
        defaultValue: 'active',
      },
      total_gp: {
        type: DataTypes.INTEGER({ length: 3 }),
        allowNull: false,
        defaultValue: BASE_TEAM_GUARD_POWER,
      },
    },
    { sequelize, modelName: 'team', tableName: 'team', timestamps: true }
  )

  ChallengeScoreboard.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      challenge: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Challenge, key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      team: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Team, key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      score: { type: DataTypes.INTEGER({ length: 3 }), allowNull: false },
      rank: { type: DataTypes.INTEGER({ length: 2 }), allowNull: false },
      challenge_point: { type: DataTypes.INTEGER({ length: 3 }), allowNull: false },
      guard_power: { type: DataTypes.INTEGER({ length: 3 }), allowNull: false },
      card: { type: DataTypes.INTEGER({ length: 3 }), allowNull: false },
    },
    {
      sequelize,
      modelName: 'challenge_scoreboard',
      tableName: 'challenge_scoreboard',
      indexes: [{ unique: true, fields: ['challenge', 'team'] }],
      timestamps: true,
    }
  )

  Scoreboard.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      team: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: Team, key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      total_score: { type: DataTypes.INTEGER({ length: 3 }), allowNull: false },
      rank: { type: DataTypes.INTEGER({ length: 2 }), allowNull: false },
      total_cp: { type: DataTypes.INTEGER({ length: 3 }), allowNull: false },
      total_card: {
        type: DataTypes.INTEGER({ length: 3 }),
        allowNull: false,
        validate: { max: { args: [MAX_TOTAL_CARD], msg: `total_card cannot exceed ${MAX_TOTAL_CARD}` } },
      },
    },
    {
      sequelize,
      modelName: 'scoreboard',
      tableName: 'scoreboard',
      timestamps: true,
    }
  )

  Card.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM('Normal', 'Rare', 'Epic', 'Legendary'),
        allowNull: false,
      },
      effect: {
        type: DataTypes.ENUM('Defense', 'Attack', 'Heal', 'Utility', 'Support', 'Thief'),
        allowNull: false,
      },
      effect_action: {
        type: DataTypes.STRING(225),
        allowNull: false,
        defaultValue: 'Card action details unavailable.',
      },
      icon: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      challenge: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: Challenge, key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      team: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: Team, key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
    },
    {
      sequelize,
      modelName: 'card',
      tableName: 'card',
      timestamps: true,
    }
  )

  TeamCard.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: () => uuidv4(),
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM('Normal', 'Rare', 'Epic', 'Legendary'),
        allowNull: false,
      },
      effect: {
        type: DataTypes.ENUM('Defense', 'Attack', 'Heal', 'Utility', 'Support', 'Thief'),
        allowNull: false,
      },
      effect_action: {
        type: DataTypes.STRING(225),
        allowNull: false,
        defaultValue: 'Card action details unavailable.',
      },
      icon: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      team: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: Team, key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
    },
    {
      sequelize,
      modelName: 'team_card',
      tableName: 'team_card',
      timestamps: true,
    }
  )

  Challenge.hasMany(ChallengeScoreboard, { foreignKey: 'challenge', as: 'scores' })
  ChallengeScoreboard.belongsTo(Challenge, { foreignKey: 'challenge', as: 'challengeRef' })
  Team.hasMany(ChallengeScoreboard, { foreignKey: 'team', as: 'challengeScores' })
  ChallengeScoreboard.belongsTo(Team, { foreignKey: 'team', as: 'teamRef' })
  Team.hasOne(Scoreboard, { foreignKey: 'team', as: 'scoreboard' })
  Scoreboard.belongsTo(Team, { foreignKey: 'team', as: 'teamRef' })
  Challenge.hasMany(Card, { foreignKey: 'challenge', as: 'bonusCards' })
  Card.belongsTo(Challenge, { foreignKey: 'challenge', as: 'challengeRef' })
  Team.hasMany(Card, { foreignKey: 'team', as: 'drawnCards' })
  Card.belongsTo(Team, { foreignKey: 'team', as: 'teamRef' })
  Team.hasMany(TeamCard, { foreignKey: 'team', as: 'teamCards' })
  TeamCard.belongsTo(Team, { foreignKey: 'team', as: 'teamRef' })

  modelsDefined = true
}

export const models = { Challenge, Team, ChallengeScoreboard, Scoreboard, Card, TeamCard }