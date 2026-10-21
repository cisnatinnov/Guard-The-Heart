import { EventTimerDisplay } from './EventTimerDisplay'
import { EventTimerControls } from './EventTimerControls'
import '../styles/timer.css'

export function EventTimerView({admin=false}:{admin?:boolean}) {
 return <section className={admin?'view event-timer-admin':'event-timer-public'}>
  {admin&&<><header className="view__header"><h2>Timer</h2><p className="view__hint">Set the countdown, then start, pause or reset it. Click a team name below to choose whose turn it is. The countdown continues when you leave this page.</p></header><EventTimerControls/></>}
  <EventTimerDisplay admin={admin}/>
 </section>
}
