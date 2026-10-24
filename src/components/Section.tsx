import type { ReactNode } from 'react'

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
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={tone === 'mist' ? 'bg-mist' : ''}>
      <div className="mx-auto max-w-page px-5 py-16 sm:px-8 sm:py-24">
        <h2 id={`${id}-title`} className="section-title">
          {title}
        </h2>
        {lede && <p className="section-lede">{lede}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}
