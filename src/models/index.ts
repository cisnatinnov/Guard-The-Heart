import { DataTypes, Model, type Sequelize } from 'sequelize'
import { v4 as uuidv4 } from 'uuid'
import { BASE_TEAM_GUARD_POWER, MAX_TOTAL_CARD } from '../services/rankRules'

export type TeamStatus = 'active' | 'inactive'

export const TEAM_STATUSES: TeamStatus[] = ['active', 'inactive']

export class Challenge extends Model {
  declare id: string
  declare name: string
  declare cards_drawn_at: Date | null
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

export class ChallengePoint extends Model {
  declare id: string
  declare challenge: string
  declare team: string
  declare rank: number
  declare challenge_point: number
  declare guard_power: number
  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

export class Scoreboard extends Model {
  declare id: string
  declare team: string
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
  declare challenge_point: string | null
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
  declare challenge_point: string | null
  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

export class GameQuestion extends Model {
  declare id: string
  declare game_key: string
  declare number: number
  declare prompt: string
  declare answer: string
  declare options: string
  declare kind: 'decode' | 'choice'
  declare hint: string
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
      cards_drawn_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
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

  ChallengePoint.init(
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
      rank: { type: DataTypes.INTEGER({ length: 2 }), allowNull: false },
      challenge_point: { type: DataTypes.INTEGER({ length: 3 }), allowNull: false },
      guard_power: { type: DataTypes.INTEGER({ length: 3 }), allowNull: false },
    },
    {
      sequelize,
      modelName: 'challenge_point',
      tableName: 'challenge_point',
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
      challenge_point: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: ChallengePoint, key: 'id' },
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
      challenge_point: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: ChallengePoint, key: 'id' },
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

  GameQuestion.init(
    {
      id: { type: DataTypes.STRING(100), primaryKey: true, allowNull: false },
      game_key: { type: DataTypes.STRING(40), allowNull: false },
      number: { type: DataTypes.INTEGER, allowNull: false },
      prompt: { type: DataTypes.TEXT, allowNull: false },
      answer: { type: DataTypes.TEXT, allowNull: false },
      options: { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' },
      kind: { type: DataTypes.STRING(16), allowNull: false },
      hint: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    },
    {
      sequelize,
      modelName: 'game_question',
      tableName: 'game_question',
      indexes: [{ unique: true, fields: ['game_key', 'number'] }],
      timestamps: true,
    }
  )

  Challenge.hasMany(ChallengePoint, { foreignKey: 'challenge', as: 'scores' })
  ChallengePoint.belongsTo(Challenge, { foreignKey: 'challenge', as: 'challengeRef' })
  Team.hasMany(ChallengePoint, { foreignKey: 'team', as: 'challengeScores' })
  ChallengePoint.belongsTo(Team, { foreignKey: 'team', as: 'teamRef' })
  Team.hasOne(Scoreboard, { foreignKey: 'team', as: 'scoreboard' })
  Scoreboard.belongsTo(Team, { foreignKey: 'team', as: 'teamRef' })
  Challenge.hasMany(Card, { foreignKey: 'challenge', as: 'bonusCards' })
  Card.belongsTo(Challenge, { foreignKey: 'challenge', as: 'challengeBonusRef' })
  Team.hasMany(Card, { foreignKey: 'team', as: 'drawnCards' })
  Card.belongsTo(Team, { foreignKey: 'team', as: 'teamRef' })
  ChallengePoint.hasMany(Card, { foreignKey: 'challenge_point', as: 'earnedCards' })
  Card.belongsTo(ChallengePoint, { foreignKey: 'challenge_point', as: 'challengePointRef' })
  Team.hasMany(TeamCard, { foreignKey: 'team', as: 'teamCards' })
  TeamCard.belongsTo(Team, { foreignKey: 'team', as: 'teamRef' })
  ChallengePoint.hasMany(TeamCard, { foreignKey: 'challenge_point', as: 'earnedTeamCards' })
  TeamCard.belongsTo(ChallengePoint, { foreignKey: 'challenge_point', as: 'challengePointRef' })

  modelsDefined = true
}

export const models = { Challenge, Team, ChallengePoint, Scoreboard, Card, TeamCard, GameQuestion }
