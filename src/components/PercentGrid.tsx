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
      <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
        {Array.from({ length: 100 }).map((_, index) => {
          const isActive = index < activeCount
          const delay = (index % 10) * 10

          return (
            <div
              key={index}
              className={`aspect-square rounded-md border transition duration-300 ease-out ${
                isActive
                  ? 'border-brand-500 bg-brand-500/10 opacity-100 shadow-[0_0_0_2px_rgba(15,131,230,0.1)] ring-1 ring-brand-200'
                  : 'border-slate-200 bg-white opacity-60'
              }`}
              style={{ transitionDelay: `${delay}ms` }}
            />
          )
        })}
      </div>
    </div>
  )
}
