type Props = {
  percent: number
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export const PercentGrid = ({ percent }: Props) => {
  const safePercent = Number.isFinite(percent) ? percent : 0
  const activeCount = clampPercent(safePercent)

  return (
    <div
      className="w-full"
      aria-label={`${safePercent.toFixed(1)}% selected; ${activeCount} of 100 squares highlighted`}
    >
      <div className="mx-auto grid max-w-lg grid-cols-10 gap-0.5 sm:gap-1">
        {Array.from({ length: 100 }).map((_, index) => {
          const isActive = index < activeCount
          // Stagger animation from top-left to bottom-right
          const row = Math.floor(index / 10)
          const col = index % 10
          const delay = (row + col) * 15

          return (
            <div
              key={index}
              className={`relative aspect-square rounded-sm transition-all duration-300 ease-out ${
                isActive
                  ? 'bg-gradient-to-br from-accent-400 to-accent-600 shadow-[0_0_6px_rgba(6,182,212,0.5)]'
                  : 'bg-dark-500/50 border border-dark-300/50'
              }`}
              style={{ transitionDelay: `${delay}ms` }}
            >
              {isActive && (
                <div className="absolute inset-0 rounded-sm bg-white/20 opacity-0 transition-opacity duration-200 hover:opacity-100" />
              )}
            </div>
          )
        })}
      </div>
      
      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-5 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-accent-400 to-accent-600 shadow-[0_0_4px_rgba(6,182,212,0.4)]" />
          <span>Selected ({activeCount}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm border border-dark-300/50 bg-dark-500/50" />
          <span>Remaining ({100 - activeCount}%)</span>
        </div>
      </div>
    </div>
  )
}
