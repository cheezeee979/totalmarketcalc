import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  children: ReactNode
}

export const FilterCard = ({ title, description, children }: Props) => (
  <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
    <header className="mb-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {description ? <p className="text-sm text-slate-600">{description}</p> : null}
    </header>
    <div className="space-y-3">{children}</div>
  </section>
)
