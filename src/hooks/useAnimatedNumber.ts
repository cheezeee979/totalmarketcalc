import { useEffect, useRef, useState } from 'react'

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const useAnimatedNumber = (target: number, durationMs = 420) => {
  const [displayValue, setDisplayValue] = useState(target)
  const startValue = useRef(target)
  const startTime = useRef<number | null>(null)

  useEffect(() => {
    startValue.current = displayValue
    startTime.current = null

    const step = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp
      const elapsed = timestamp - startTime.current
      const progress = clamp(elapsed / durationMs, 0, 1)
      const nextValue = Math.round(
        startValue.current + (target - startValue.current) * easeOutQuad(progress),
      )
      setDisplayValue(nextValue)
      if (progress < 1) requestAnimationFrame(step)
    }

    const animationId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationId)
  }, [target, durationMs])

  return displayValue
}

const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t)
