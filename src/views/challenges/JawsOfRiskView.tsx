import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { CROCODILE_TEETH, createCrocodileRound, pressCrocodileTooth, type CrocodileRound } from '../../services/games/crocodile'
import '../../styles/crocodile.css'
import { useCrocodileHover } from './useCrocodileHover'

const ASSET_ROOT = '/ui/jaw-of-risk/'
const BITE_GIF = `${ASSET_ROOT}GIF-Gigarisk Gigit.gif`
const SOUNDS = {
  hover: 'CH-3_Sound_Belum Click.mp3',
  click: 'CH-3_Sound_Click.mp3',
  safe: 'CH-3_Sound_Click-Aman.mp3',
  bite: 'CH-3_Sound_Click-Tergigit.mp3',
} as const

function HandCursor({ tooth, x, y }: { tooth: number; x: number; y: number }) {
  const side = tooth < CROCODILE_TEETH / 2 ? 'Kiri' : 'Kanan'
  return <img className={`crocodile__hand crocodile__hand--${side.toLowerCase()}`} src={`${ASSET_ROOT}Tangan - Pencet Gigi ${side}.png`} alt="" aria-hidden="true" draggable={false} style={{ left: `${x / 19.2}%`, top: `${y / 10.8}%` }} />
}

function PressHand({ tooth, x, y, pressedAt }: { tooth: number; x: number; y: number; pressedAt: number }) {
  const [visible, setVisible] = useState(() => Date.now() < pressedAt + 650)
  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), Math.max(0, pressedAt + 650 - Date.now()))
    return () => window.clearTimeout(timeout)
  }, [pressedAt])
  if (!visible) return null
  return <HandCursor tooth={tooth} x={x} y={y} />
}

export function JawsOfRiskView({ challengeId }: { challengeId: string }) {
  const canControl = window.location.pathname.startsWith('/admin/')
  const stage = useRef<HTMLElement>(null)
  const [pointerHand, setPointerHand] = useCrocodileHover(challengeId, canControl)
  function moveHand(event: PointerEvent<HTMLButtonElement>, tooth: number) {
    if (!canControl || event.pointerType !== 'mouse' || !stage.current) return
    const box = stage.current.getBoundingClientRect()
    setPointerHand({ tooth, x: (event.clientX - box.left) / box.width * 1920, y: (event.clientY - box.top) / box.height * 1080 })
  }
  const sounds = useRef<Partial<Record<keyof typeof SOUNDS, HTMLAudioElement>>>({})
  function playSound(name: keyof typeof SOUNDS) {
    if (!canControl) return
    const audio = sounds.current[name]
    if (!audio) return
    if (name === 'click') {
      sounds.current.hover?.pause()
      sounds.current.safe?.pause()
      sounds.current.bite?.pause()
    }
    audio.currentTime = 0
    void audio.play().catch(() => { /* Hover audio waits until the browser allows playback. */ })
  }
  useEffect(() => () => {
    for (const audio of Object.values(sounds.current)) audio.pause()
  }, [])
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

  function pressTooth(tooth: number, keyboard: boolean) {
    if (!canControl) return
    const current = read() ?? round
    const next = pressCrocodileTooth(current, tooth)
    if (next === current) return
    setPointerHand(null)
    if (keyboard) playSound('click')
    playSound(next.reopenAt === null ? 'safe' : 'bite')
    publish(next)
  }
  const biting = round.reopenAt !== null
  // Coordinates share the supplied 1920 x 1080 background's coordinate system.
  const toothRoots = [
    [448.4, 746, .414], [504.1, 803.4, .414], [578.3, 841.3, .425], [661.1, 884.9, .414],
    [741, 926.2, .425], [831.2, 943.4, .414], [926.7, 951.5, .425], [1022.7, 954.9, .425],
    [1115.8, 951.5, .425], [1210.6, 922.8, .425], [1299.2, 884.9, .425], [1382.5, 843.6, .425],
    [1458.4, 813.7, .425], [1525.1, 766.7, .425],
  ]
  const toothCrops = [[130, 89, 340, 487], [127, 87, 342, 477], [128, 88, 355, 459], [130, 88, 368, 468], [130, 88, 355, 464], [130, 89, 357, 467], [130, 89, 362, 457], [129, 88, 360, 463], [125, 85, 365, 471], [129, 87, 372, 465], [128, 89, 366, 465], [126, 89, 340, 497], [125, 86, 327, 511], [129, 90, 348, 530]]
  const lastTooth = round.pressed.at(-1)
  const handRoot = lastTooth === undefined ? null : toothRoots[lastTooth]
  return <section ref={stage} className={`crocodile-stage${canControl && pointerHand ? ' has-hand-cursor' : ''}${biting ? ' is-biting' : ''}`} aria-label="Crocodile bite toy">
    <link rel="preload" as="image" href={BITE_GIF} />
    <link rel="preload" as="image" href={`${ASSET_ROOT}Tangan - Pencet Gigi Kiri.png`} />
    <link rel="preload" as="image" href={`${ASSET_ROOT}Tangan - Pencet Gigi Kanan.png`} />
    {Object.entries(SOUNDS).map(([name, file]) => <audio key={name} data-sound={name} ref={(element) => { if (element) sounds.current[name as keyof typeof SOUNDS] = element }} src={`${ASSET_ROOT}Sound/${file}`} preload="auto" />)}
    <header className="crocodile-stage__header"><img src="/Logo_Game-5.png" alt="Guard the Heart" /><h1>Challenge 3 - Jaw of Risk</h1></header>
    <p className="crocodile-stage__instruction">{canControl ? 'Press a tooth. Take a chance.' : 'Watch closely. One tooth will bite.'}</p>
    <div className="crocodile" aria-label={biting ? 'Crocodile bites!' : 'Crocodile mouth open'}>
      <img className="crocodile__base-art" src="/ui/jaw-of-risk/CH-3_Background-Polos.png" alt="GigaRisk head" />
      <div className="crocodile__teeth" role="group" aria-label="Lower jaw teeth">
        {toothRoots.map(([x, y, scale], tooth) => {
          const pressed = round.pressed.includes(tooth)
          const [left, top, right, bottom] = toothCrops[tooth]
          const number = tooth === 0 ? '01' : String(tooth + 1)
          return <button key={tooth} type="button"
            className={`crocodile__tooth${pressed ? ' is-pressed' : ''}${pointerHand?.tooth === tooth && !biting && !pressed ? ' is-hovered' : ''}`}
            style={{ left: `${x / 19.2}%`, top: `${y / 10.8}%`, width: `${(right - left) * scale / 19.2}%`, aspectRatio: `${right - left} / ${bottom - top}` }}
            aria-label={`Tooth ${tooth + 1}`} aria-pressed={pressed}
            disabled={!canControl || biting || pressed}
            onPointerEnter={(event) => { moveHand(event, tooth); playSound('hover') }}
            onPointerMove={(event) => moveHand(event, tooth)}
            onPointerLeave={() => setPointerHand(null)}
            onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) playSound('hover') }}
            onPointerDown={() => playSound('click')}
            onClick={(event) => pressTooth(tooth, event.detail === 0)}>
            <svg viewBox={`${left} ${top} ${right - left} ${bottom - top}`} aria-hidden="true">
              <image href={`/ui/jaw-of-risk/${pressed ? `Gigi-Pencet/Gigi-Pencet_${number}` : `Gigi-Utuh/Gigi-Full_${number}`}.png`} width="600" height="600" />
            </svg>
          </button>
        })}
      </div>
      {biting && <img key={round.reopenAt} className="crocodile__bite" src={`${BITE_GIF}#${round.reopenAt}`} alt="" aria-hidden="true" draggable={false} />}
      {pointerHand && !biting && !round.pressed.includes(pointerHand.tooth) && <HandCursor {...pointerHand} />}
      {!pointerHand && handRoot && lastTooth !== undefined && typeof round.lastPressedAt === 'number' && <PressHand key={round.lastPressedAt} tooth={lastTooth} x={handRoot[0]} y={handRoot[1] - 100} pressedAt={round.lastPressedAt} />}
    </div>
    <p className="crocodile-stage__status" role="status" aria-live="polite">{biting ? 'CHOMP! Watch your fingers!' : round.pressed.length ? 'Safe! Choose another tooth.' : 'Which tooth will bite?'}</p>
  </section>
}
