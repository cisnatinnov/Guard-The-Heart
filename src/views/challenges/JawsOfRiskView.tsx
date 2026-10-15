import { useEffect, useState } from 'react'
import { CROCODILE_TEETH, createCrocodileRound, pressCrocodileTooth, type CrocodileRound } from '../../services/games/crocodile'
import '../../styles/crocodile.css'

export function JawsOfRiskView({ challengeId }: { challengeId: string }) {
  const storageKey = `guard-the-heart-crocodile:${challengeId}`
  function read(): CrocodileRound | null {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as CrocodileRound | null
      return value && Number.isInteger(value.bitingTooth) && value.bitingTooth >= 0 && value.bitingTooth < CROCODILE_TEETH && Array.isArray(value.pressed) && (value.reopenAt === null || typeof value.reopenAt === 'number') ? value : null
    } catch { return null }
  }
  const [round, setRound] = useState(() => read() ?? createCrocodileRound())
  function publish(next: CrocodileRound) {
    localStorage.setItem(storageKey, JSON.stringify(next))
    setRound(next)
    window.dispatchEvent(new Event(storageKey))
  }
  useEffect(() => {
    if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(round))
    const receive = () => { const next = read(); if (next) setRound(next) }
    const stored = (event: StorageEvent) => { if (event.key === storageKey) receive() }
    window.addEventListener('storage', stored)
    window.addEventListener(storageKey, receive)
    return () => { window.removeEventListener('storage', stored); window.removeEventListener(storageKey, receive) }
    // The game is remounted when its challenge changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])
  useEffect(() => {
    if (round.reopenAt === null) return
    const timeout = window.setTimeout(() => {
      const current = read()
      if (current && current.reopenAt !== null && current.reopenAt === round.reopenAt) publish(createCrocodileRound(current.bitingTooth))
    }, Math.max(0, round.reopenAt - Date.now()))
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.reopenAt, storageKey])

  const biting = round.reopenAt !== null
  const toothRoots = [
    [205, 355], [190, 415], [205, 475], [245, 535], [305, 558], [368, 570],
    [432, 570], [495, 558], [555, 535], [595, 475], [610, 415], [595, 355],
  ]
  return <section className={`crocodile-stage${biting ? ' is-biting' : ''}`} aria-label="Crocodile bite toy">
    <header className="crocodile-stage__header"><img src="/Logo_Game-5.png" alt="Guard the Heart" /><h1>Challenge 3 - Jaw of Risk</h1>
    </header>
    <p className="crocodile-stage__instruction">Press a tooth. Take a chance.</p>
    <div className="crocodile" aria-label={biting ? 'Crocodile bites!' : 'Crocodile mouth open'}>
      <svg className="crocodile__base-art" viewBox="0 0 800 620" aria-hidden="true">
        <defs>
          <linearGradient id="toy-green" x2=".3" y2="1"><stop stopColor="#87f52a" /><stop offset=".5" stopColor="#2fc515" /><stop offset="1" stopColor="#087c26" /></linearGradient>
          <linearGradient id="toy-gum" x2="0" y2="1"><stop stopColor="#ff6755" /><stop offset=".45" stopColor="#dc201f" /><stop offset="1" stopColor="#99121b" /></linearGradient>
          <radialGradient id="toy-mouth"><stop stopColor="#4d0c15" /><stop offset="1" stopColor="#160e14" /></radialGradient>
        </defs>
        <ellipse cx="400" cy="586" rx="280" ry="26" fill="#001d18" opacity=".45" />
        <g fill="url(#toy-green)" stroke="#148b25" strokeWidth="6">
          <path d="M167 333 Q90 306 70 377 Q69 407 142 410Z" />
          <path d="M633 333 Q710 306 730 377 Q731 407 658 410Z" />
          <path d="M193 445 Q109 443 98 492 Q90 520 174 518Z" />
          <path d="M607 445 Q691 443 702 492 Q710 520 626 518Z" />
          <path d="M181 273 Q117 309 129 443 L176 476 238 298Z" />
          <path d="M619 273 Q683 309 671 443 L624 476 562 298Z" />
        </g>
        <g fill="#e9d92d"><ellipse cx="78" cy="392" rx="9" ry="15" /><ellipse cx="100" cy="399" rx="9" ry="15" /><ellipse cx="722" cy="392" rx="9" ry="15" /><ellipse cx="700" cy="399" rx="9" ry="15" /><ellipse cx="107" cy="505" rx="9" ry="13" /><ellipse cx="129" cy="512" rx="9" ry="13" /><ellipse cx="693" cy="505" rx="9" ry="13" /><ellipse cx="671" cy="512" rx="9" ry="13" /></g>
        <path d="M165 315 C110 355 105 485 184 548 C270 620 530 620 616 548 C695 485 690 355 635 315Z" fill="url(#toy-green)" stroke="#096c23" strokeWidth="7" />
        <path d="M180 330 C130 365 135 470 201 525 C290 595 510 595 599 525 C665 470 670 365 620 330Z" fill="url(#toy-gum)" stroke="#ff7462" strokeWidth="6" />
        <path d="M232 333 C195 363 192 451 250 490 C325 543 475 543 550 490 C608 451 605 363 568 333Z" fill="url(#toy-mouth)" />
        <path d="M298 471 Q400 430 502 471 Q497 508 400 516 Q303 508 298 471" fill="#a72535" opacity=".6" />
        <path d="M400 474V505" stroke="#6d1927" strokeWidth="4" strokeLinecap="round" />
        <path d="M211 561 Q400 628 589 561" fill="none" stroke="#62e82a" strokeWidth="8" strokeLinecap="round" />
        <g fill="#39c91b" stroke="#0c8125" strokeWidth="5"><circle cx="155" cy="345" r="20" /><circle cx="645" cy="345" r="20" /></g>
      </svg>
      <div className="crocodile__head">
        <svg viewBox="0 0 800 620" aria-hidden="true">
          <path d="M178 281 Q164 190 219 127 Q246 78 309 99 Q400 65 491 99 Q554 78 581 127 Q636 190 622 281Z" fill="url(#toy-green)" stroke="#14912b" strokeWidth="6" />
          <g fill="#e9ffbc" stroke="#219c2b" strokeWidth="5"><ellipse cx="320" cy="154" rx="39" ry="51" /><ellipse cx="480" cy="154" rx="39" ry="51" /></g>
          <g fill="#1d622e"><ellipse cx="330" cy="163" rx="18" ry="29" /><ellipse cx="470" cy="163" rx="18" ry="29" /></g>
          <g fill="#102d23"><ellipse cx="334" cy="166" rx="9" ry="22" /><ellipse cx="466" cy="166" rx="9" ry="22" /></g>
          <g fill="white"><circle cx="325" cy="151" r="7" /><circle cx="475" cy="151" r="7" /></g>
          <path d="M279 115 Q310 115 353 140 M521 115 Q490 115 447 140" fill="none" stroke="#2ec71b" strokeWidth="25" strokeLinecap="round" />
          <path d="M220 245 Q400 205 580 245 L569 289 Q400 322 231 289Z" fill="#c82127" stroke="#941323" strokeWidth="5" />
          <g fill="#fff8d9" stroke="#dbd2ad" strokeWidth="2"><path d="M250 279L268 310 283 282Z" /><path d="M304 287L320 319 336 289Z" /><path d="M360 292L376 324 391 293Z" /><path d="M416 293L431 324 447 291Z" /><path d="M472 288L488 319 504 285Z" /><path d="M527 280L542 310 558 276Z" /></g>
          <path d="M223 192 Q400 150 577 192 L620 238 Q645 269 610 286 Q400 318 190 286 Q155 269 180 238Z" fill="url(#toy-green)" stroke="#108d24" strokeWidth="6" />
          <path d="M240 202 Q400 170 560 202 M220 224 Q400 191 580 224" fill="none" stroke="#99fb47" strokeWidth="7" strokeLinecap="round" opacity=".7" />
          <g fill="#123b22" stroke="#46d52a" strokeWidth="5"><ellipse cx="252" cy="262" rx="29" ry="23" transform="rotate(17 252 262)" /><ellipse cx="548" cy="262" rx="29" ry="23" transform="rotate(-17 548 262)" /></g>
          <path d="M298 281 Q400 294 502 281" fill="none" stroke="#73f13c" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="crocodile__teeth" role="group" aria-label="Lower jaw teeth">
        {toothRoots.map(([x, y], tooth) => <button key={tooth} type="button"
          className={`crocodile__tooth${round.pressed.includes(tooth) ? ' is-pressed' : ''}`}
          style={{ left: `${x / 8}%`, top: `${y / 6.2}%` }}
          aria-label={`Tooth ${tooth + 1}`} aria-pressed={round.pressed.includes(tooth)}
          disabled={biting || round.pressed.includes(tooth)}
          onClick={() => publish(pressCrocodileTooth(read() ?? round, tooth))}><span>{tooth + 1}</span></button>)}
      </div>
    </div>
    <p className="crocodile-stage__status" role="status" aria-live="polite">{biting ? 'CHOMP! Watch your fingers!' : round.pressed.length ? 'Safe! Choose another tooth.' : 'Which tooth will bite?'}</p>
  </section>
}
