import { teamForQuestion, type ChallengeRun } from '../../services/games/teamRun'

export function RouletteOrder({ run, teamName }: { run: ChallengeRun; teamName: (id: string) => string }) {
  const current = teamForQuestion(run)?.team
  return <div className="roulette-order">
    <p>Roulette turn order</p>
    <ol aria-label="Roulette turn order">
      {run.runs.map((team) => <li key={team.team} aria-current={team.team === current ? 'step' : undefined}>
        {teamName(team.team)}
      </li>)}
    </ol>
  </div>
}
