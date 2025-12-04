import { useAnimatedNumber } from '../hooks/useAnimatedNumber'
import { formatNumber, formatPercent } from '../utils/calculations'

type Props = {
  total: number
  estimated: number
  probability: number
  summary: string
  onReset: () => void
}

export const MainStat = ({ estimated, probability, summary, onReset, total }: Props) => {
  const animatedValue = useAnimatedNumber(estimated)
  const isTiny = estimated > 0 && estimated < 1000
  const primaryText = isTiny ? 'Fewer than 1,000' : formatNumber(animatedValue)

  return (
    <section className="space-y-3 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-3">
        <div
          aria-live="polite"
          className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl"
        >
          {primaryText}
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800 ring-1 ring-brand-100">
          {formatPercent(probability)}% of U.S. population
        </span>
      </div>
      <p className="text-sm text-slate-700">
        Estimated people in the United States matching your filters. Base population:{' '}
        <strong>{formatNumber(total)}</strong>.{' '}
        {isTiny ? `(Estimated count: ${formatNumber(animatedValue)} people)` : null}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Filters:</span> {summary}
        </p>
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-semibold text-brand-700 underline decoration-2 underline-offset-4 hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          Reset all
        </button>
      </div>
    </section>
  )
}
