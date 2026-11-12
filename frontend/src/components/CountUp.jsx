import React, { useEffect, useState } from 'react'

const DURATION_MS = 700

// True when the browser can animate and the user has not asked for less motion
function canAnimate() {
  return (
    typeof window.matchMedia === 'function' &&
    typeof window.requestAnimationFrame === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// "66 / 84" -> ["", 66, " / ", 84, ""]: text parts and number parts
function splitNumbers(text) {
  return String(text).split(/(\d+)/).map((part, index) => (index % 2 === 1 ? Number(part) : part))
}

/**
 * CountUp Component
 *
 * Shows a value like "84", "66 / 84" or "2000+" and counts its numbers up
 * from 0 the first time it appears (and when the value changes). Text that is
 * not a number ("--", "Not given") is shown as it is.
 *
 * Without animation support, or with "reduce motion" switched on, the final
 * value is shown at once. Screen readers always get the final value.
 *
 * @param {Object} props
 * @param {string | number} props.value
 */
export function CountUp({ value }) {
  const text = String(value)
  const [progress, setProgress] = useState(1) // 0 = start, 1 = final value

  useEffect(() => {
    if (!canAnimate() || !/\d/.test(text)) return undefined
    let frame = 0
    let start = null
    function step(time) {
      if (start === null) start = time
      const linear = Math.min(1, (time - start) / DURATION_MS)
      setProgress(1 - Math.pow(1 - linear, 3)) // ease out
      if (linear < 1) frame = window.requestAnimationFrame(step)
    }
    frame = window.requestAnimationFrame((time) => {
      setProgress(0)
      step(time)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [text])

  const shown = splitNumbers(text)
    .map((part) => (typeof part === 'number' ? Math.round(part * progress) : part))
    .join('')

  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{text}</span>
    </>
  )
}

export default CountUp
