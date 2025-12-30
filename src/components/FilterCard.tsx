import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  icon?: ReactNode
  children: ReactNode
}

export const FilterCard = ({ title, description, icon, children }: Props) => (
  <section className="glass filter-card-hover group relative overflow-hidden rounded-2xl p-5">
    {/* Subtle gradient border effect on hover */}
    <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent-500/10 via-transparent to-glow-500/10" />
    </div>
    
    {/* Top accent line */}
    <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-500/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    
    <div className="relative">
      <header className="mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400 transition group-hover:bg-accent-500/20 group-hover:shadow-glow-sm">
              {icon}
            </div>
          )}
          <div>
            <h2 className="font-display text-base font-semibold text-white">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            )}
          </div>
        </div>
      </header>
      <div className="space-y-3">{children}</div>
    </div>
  </section>
)
