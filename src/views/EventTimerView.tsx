import { useState } from 'react'
import { EventTimerDisplay } from './EventTimerDisplay'
import { EventTimerControls } from './EventTimerControls'
import { publishPublicDisplay } from '../services/publicDisplay'
import '../styles/timer.css'

export function EventTimerView({admin=false}:{admin?:boolean}) {
 const [error,setError]=useState<string|null>(null)
 async function showPublic(){
  window.open('/timer','_blank','noopener')
  try{await publishPublicDisplay('timer','');setError(null)}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
 }
 return <section className={admin?'view event-timer-admin':'event-timer-public'}>
  {admin&&<><header className="view__header"><h2>Timer</h2><p className="view__hint">Set the event countdown, then start, pause or reset it. The countdown continues when you leave this page.</p></header><div className="admin-toolbar"><button onClick={()=>void showPublic()}>Show Timer (Public)</button></div><EventTimerControls/></>}
  {error&&<p className="alert alert--error" role="alert">{error}</p>}
  <EventTimerDisplay/>
 </section>
}
