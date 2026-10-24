import { cardEffectLabel } from '../data/card-pool'
import { useCallback, useEffect, useState } from 'react'
import { GPTransaction } from '../models'
import { listGPTransactions } from '../services/gpTransactions'
import { useDbEventRefresh } from '../hooks/useDbEventRefresh'
import { DB_EVENTS } from '../hooks/useDbEvents'
import { useTeams } from '../hooks/useTeams'
const dates=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'})
const categories={opening:'Opening balance',reward:'Challenge reward',attack:'GigaRisk',card:'Card effects'}
export function GPTransactionsView(){
 const {teams}=useTeams();const [team,setTeam]=useState('');const [rows,setRows]=useState<GPTransaction[]>([]);const [error,setError]=useState<string|null>(null)
 const load=useCallback(async()=>{try{setRows(await listGPTransactions(team||undefined));setError(null)}catch(cause){setError(cardEffectLabel(cause instanceof Error?cause.message:String(cause)))}},[team])
 useEffect(()=>{void load()},[load]);useDbEventRefresh([DB_EVENTS.GP_TRANSACTIONS_CHANGED,DB_EVENTS.TEAMS_CHANGED],()=>{void load()})
 return <section className="view"><header className="view__header"><h2>GP Transactions</h2><p className="view__hint">Opening balances, challenge rewards, GigaRisk attacks and card effects. Times are shown in WIB.</p></header><label className="field"><span>Team</span><select value={team} onChange={event=>setTeam(event.target.value)}><option value="">All teams</option>{teams.map(entry=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>{error&&<p className="alert alert--error">{error}</p>}<div className="gp-ledger-wrap"><table className="gp-ledger" aria-label="GP Transactions"><thead><tr>{['Time (WIB)','Team','Challenge','Type','Before','Change','After','Description'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{dates.format(new Date(row.createdAt))}</td><td>{row.team_name}</td><td>{row.challenge_name||'—'}</td><td>{categories[row.category]}</td><td>{row.gp_before}</td><td className={row.delta<0?'is-negative':'is-positive'}>{row.delta>0?'+':''}{row.delta}</td><td>{row.gp_after}</td><td>{cardEffectLabel(row.description)}</td></tr>)}</tbody></table>{!rows.length&&<p>No transactions yet.</p>}</div></section>
}
