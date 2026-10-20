import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** One deadline per solo question; retries share the same countdown. */
export function useSoloQuestionTimer(key: string, active: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState(15)
  const expire = useRef(onExpire)
  useLayoutEffect(() => { expire.current = onExpire }, [onExpire])
  useEffect(() => {
    if (!active) return
    const deadline = Date.now() + 15_000
    setRemaining(15)
    const interval = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(seconds)
      if (seconds === 0) {
        window.clearInterval(interval)
        expire.current()
      }
    }, 100)
    return () => window.clearInterval(interval)
  }, [key, active])
  return remaining
}
