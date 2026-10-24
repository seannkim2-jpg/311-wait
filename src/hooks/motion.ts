import { useEffect, useRef, useState } from 'react'

export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Count from `from` to `to` once per change of `to`. Strong ease-out (animate skill), so the
 * number arrives quickly and settles. With reduced motion it jumps straight to `to`.
 */
export function useCountUp(to: number, from: number, durationMs = 900): number {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(reduced ? to : from)
  useEffect(() => {
    if (reduced || !Number.isFinite(to) || !Number.isFinite(from)) {
      setValue(to)
      return
    }
    let raf = 0
    const start = performance.now()
    // cubic-bezier(0.23, 1, 0.32, 1) is close to easeOutQuint; quint keeps this dependency-free.
    const ease = (t: number) => 1 - Math.pow(1 - t, 5)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setValue(from + (to - from) * ease(t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    setValue(from)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, from, durationMs, reduced])
  return value
}

/**
 * Tween toward `target` from whatever is on screen now. Unlike useCountUp, a new target
 * mid-flight retargets from the current value instead of restarting, so stepping a number
 * input quickly stays smooth. With reduced motion it jumps.
 */
export function useTween(target: number, durationMs = 420, initial = target): number {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(reduced ? target : initial)
  const current = useRef(reduced ? target : initial)
  useEffect(() => {
    const from = current.current
    if (reduced || !Number.isFinite(target) || !Number.isFinite(from)) {
      current.current = target
      setValue(target)
      return
    }
    if (from === target) return
    let raf = 0
    const start = performance.now()
    const ease = (t: number) => 1 - Math.pow(1 - t, 5)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      current.current = from + (target - from) * ease(t)
      setValue(current.current)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, reduced])
  return value
}

/**
 * False for the first painted frame, then true. A CSS transition does not run on mount, so a
 * bar that should grow in starts from its floor while this is false.
 */
export function useAfterFirstFrame(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setReady(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])
  return ready
}

/** True once the element has scrolled into view. Fires once. */
export function useInViewOnce<T extends Element>(rootMargin = '0px 0px -15% 0px') {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin, seen])
  return { ref, seen }
}
