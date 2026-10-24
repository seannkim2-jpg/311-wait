import type { ReactNode } from 'react'
import { useInViewOnce } from '../hooks/motion'

export function Section({
  id,
  title,
  lede,
  tone = 'plain',
  children,
}: {
  id: string
  title: string
  lede?: ReactNode
  tone?: 'plain' | 'mist'
  children: ReactNode
}) {
  // The page is read top to bottom once, so each heading rises in the first time it is reached.
  const { ref, seen } = useInViewOnce<HTMLDivElement>()
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={tone === 'mist' ? 'bg-mist' : ''}>
      <div className="mx-auto max-w-page px-5 py-16 sm:px-8 sm:py-24">
        <div ref={ref} className="reveal" data-visible={seen}>
          <h2 id={`${id}-title`} className="section-title">
            {title}
          </h2>
          {lede && <p className="section-lede">{lede}</p>}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}
