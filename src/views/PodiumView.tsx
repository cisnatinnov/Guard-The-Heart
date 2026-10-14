import { useEffect, useState } from 'react'
import { useTeams } from '../hooks/useTeams'
import { competitionRanks } from '../services/rankRules'
import { publishPublicDisplay } from '../services/publicDisplay'
import '../styles/podium.css'
const PRIZES_KEY='guard-the-heart-podium-prizes'
function readPrizes(): string[] { try { const values=JSON.parse(localStorage.getItem(PRIZES_KEY)??'[]');return Array.from({length:3},(_,i)=>String(values[i]??'')) } catch {return ['','','']} }
export function PodiumView({admin=false}:{admin?:boolean}) {
  const {teams,error:teamError}=useTeams()
  const [,refresh]=useState(0)
  const [prizes,setPrizes]=useState(readPrizes)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{const update=()=>{refresh(value=>value+1);setPrizes(readPrizes())};window.addEventListener('storage',update);window.addEventListener('guard-the-heart:tactical',update);return()=>{window.removeEventListener('storage',update);window.removeEventListener('guard-the-heart:tactical',update)}},[])
  const sorted=teams.map(team=>({id:team.id,name:team.name,gp:team.total_gp})).sort((a,b)=>b.gp-a.gp||a.name.localeCompare(b.name))
  const ranks=competitionRanks(sorted.map(team=>team.gp))
  function savePrize(slot:number,value:string){const next=prizes.map((prize,index)=>index===slot?value:prize);localStorage.setItem(PRIZES_KEY,JSON.stringify(next));setPrizes(next)}
  return <section className={admin?'view podium-admin':'podium-public'}>
    {admin&&<><header className="view__header"><h2>Podium</h2><p className="view__hint">Top three teams by final GP.</p></header><div className="admin-toolbar"><button onClick={()=>{window.open('/podium','_blank','noopener');void publishPublicDisplay('podium','').catch((cause:unknown)=>setError(cause instanceof Error?cause.message:String(cause)))}}>Show Podium (Public)</button>{prizes.map((prize,index)=><label className="field" key={index}><span>Prize position {index+1} (Rp)</span><input type="number" min="0" inputMode="numeric" value={prize} onChange={event=>savePrize(index,event.target.value)}/></label>)}</div></>}
    {(error||teamError)&&<p className="alert alert--error">{error??teamError}</p>}
    <section className="podium-stage" aria-label="Podium ranked by GP"><img className="podium-art" src="/ui/visual-guide-slide-10.png" alt="Celebration podium with the guardians and Gardimon"/><h1 className="sr-only">Podium</h1>
      {[0,1,2].map(slot=>{const team=sorted[slot];return <article key={slot} className={`podium-winner podium-winner--${slot+1}`} aria-label={team?`Rank ${ranks[slot]}: ${team.name}, ${team.gp} GP`:'Empty podium position'}><span className="podium-name">{team?`Tim ${team.name.replace(/^tim\s+/i,'')}`:'—'}</span><strong className="podium-gp">{team?.gp??'—'}</strong><span className="podium-prize">Rp {prizes[slot]?new Intl.NumberFormat('id-ID').format(Number(prizes[slot])):'—'}</span>{team&&ranks[slot]!==slot+1&&<span className="podium-tied-rank">{ranks[slot]}</span>}</article>})}
    </section>
  </section>
}
