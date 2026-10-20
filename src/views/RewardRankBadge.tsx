export function RewardRankBadge({ rank }: { rank: number }) {
  return <img className="reward-stage__medal"
    src={`/ui/Icon%20rank/Icon-Rank_${rank}.png`} alt={`Rank ${rank}`} />
}
