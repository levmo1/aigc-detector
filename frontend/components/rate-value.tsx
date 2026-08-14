
import { useEffect, useRef, useState } from 'react'

interface RateValueProps {
  value: number
  duration?: number
}

export function RateValue({ value, duration = 600 }: RateValueProps) {
  const [display, setDisplay] = useState(value)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const reduceMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    const from = 0

    const tick = (now: number) => {
      if (reduceMotion) {
        setDisplay(value)
        return
      }
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [value, duration])

  return <strong>{display}%</strong>
}
