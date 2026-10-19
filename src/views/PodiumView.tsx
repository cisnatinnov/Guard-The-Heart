import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useTeams } from '../hooks/useTeams'
import { rankGuardPointStandings } from '../services/rankRules'
import { ScoreboardController } from '../controllers/ScoreboardController'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import { DB_EVENTS } from '../hooks/useDbEvents'
import { GPShield } from './GPShield'
import '../styles/podium.css'
const PRIZES_KEY='guard-the-heart-podium-prizes'
function readPrizes(): string[] { try { const values=JSON.parse(localStorage.getItem(PRIZES_KEY)??'[]');return Array.from({length:3},(_,i)=>String(values[i]??'')) } catch {return ['','','']} }
export function PodiumView({admin=false}:{admin?:boolean}) {
  const {teams,error:teamError}=useTeams()
  const [,refresh]=useState(0)
  const [prizes,setPrizes]=useState(readPrizes)
  const [error,setError]=useState<string|null>(null)
  const [points,setPoints]=useState<Map<string,number>>(new Map())
  const loadPoints=useCallback(async()=>{try{setPoints(new Map((await ScoreboardController.list()).map(row=>[row.team,row.total_cp])))}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}},[])
  useEffect(()=>{void loadPoints()},[loadPoints])
  useDbEventRefresh([DB_EVENTS.SCOREBOARD_CHANGED,DB_EVENTS.CHALLENGE_POINTS_CHANGED],()=>{void loadPoints()})
  useEffect(()=>{const update=()=>{refresh(value=>value+1);setPrizes(readPrizes())};window.addEventListener('storage',update);window.addEventListener('guard-the-heart:tactical',update);return()=>{window.removeEventListener('storage',update);window.removeEventListener('guard-the-heart:tactical',update)}},[])
  const sorted=rankGuardPointStandings(teams.map(team=>({id:team.id,name:team.name,team:team.name,gp:team.total_gp,guardPower:team.total_gp,points:points.get(team.id)??0})))
  const ranks=sorted.map(team=>team.rank)
  function savePrize(slot:number,value:string){const next=prizes.map((prize,index)=>index===slot?value:prize);localStorage.setItem(PRIZES_KEY,JSON.stringify(next));setPrizes(next)}
  return <section className={admin?'view podium-admin':'podium-public'}>
    {admin&&<><header className="view__header"><h2>Podium</h2><p className="view__hint">Top three teams by GP, then CP. Equal totals share a rank.</p></header><div className="admin-toolbar">{prizes.map((prize,index)=><label className="field" key={index}><span>Prize position {index+1} (Rp)</span><input type="number" min="0" inputMode="numeric" value={prize} onChange={event=>savePrize(index,event.target.value)}/></label>)}</div></>}
    {(error||teamError)&&<p className="alert alert--error">{error??teamError}</p>}
    <section className="podium-stage" aria-label="Podium ranked by GP"><img className="podium-art" src="/ui/podium-no-gp.png" alt="Celebration podium with the guardians and Gardimon"/><h1 className="sr-only">Podium</h1>
      {[0,1,2].map(slot=>{
        const team=sorted[slot]
        const name=team?`Tim ${team.name.replace(/^tim\s+/i,'')}`:'—'
        const gp=String(team?.gp??'—')
        const prize=`Rp ${prizes[slot]?new Intl.NumberFormat('id-ID').format(Number(prizes[slot])):'—'}`
        const size={
          '--name-size':`${Math.max(1.2,Math.min(slot===0?2:1.9,25/Math.max(12,name.length)))}cqw`,
          '--gp-size':`${Math.min(slot===0?2.5:1.95,(slot===0?7.2:5.1)/Math.max(1,gp.length))}cqw`,
          '--prize-size':`${Math.min(slot===0?1.85:1.5,(slot===0?22:18)/Math.max(12,prize.length))}cqw`,
        } as CSSProperties
        return <article key={slot} className={`podium-winner podium-winner--${slot+1}`} style={size} aria-label={team?`Rank ${ranks[slot]}: ${team.name}, ${team.gp} GP`:'Empty podium position'}>
          {team && <img className="podium-rank" src={`/ui/Icon%20rank/Icon-Rank_${team.rank}.png`} alt={`Rank ${team.rank}`} />}
          <span className="podium-name" title={name}><span>{name}</span></span>
          <GPShield className="podium-gp-icon" />
          <strong className="podium-gp" title={`${gp} GP`}>{gp}</strong>
          <span className="podium-prize" title={prize}>{prize}</span>
        </article>
      })}
    </section>
  </section>
}
