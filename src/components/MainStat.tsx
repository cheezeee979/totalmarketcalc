import { useAnimatedNumber } from '../hooks/useAnimatedNumber'
import { formatNumber, formatPercent } from '../utils/calculations'
import { PercentGrid } from './PercentGrid'

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
  const percentValue = formatPercent(probability)

  return (
    <section className="flex flex-col items-center gap-6 rounded-3xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200 sm:p-10">
      <div className="space-y-2">
        <div
          aria-live="polite"
          className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl"
        >
          {primaryText}
        </div>
        <p className="text-sm text-slate-600">Estimated people in the United States</p>
        <p className="text-base font-semibold text-slate-800" aria-live="polite">
          {percentValue}% of U.S. population
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <PercentGrid percent={probability * 100} />
      </div>

      <div className="space-y-3 text-sm text-slate-700">
        <p>
          Base population: <strong>{formatNumber(total)}</strong>.{' '}
          {isTiny ? `(Estimated count: ${formatNumber(animatedValue)} people)` : null}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <p>
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
      </div>
    </section>
  )
}
