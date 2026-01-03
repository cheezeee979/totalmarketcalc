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
    <section className="glass gradient-border stat-pulse relative overflow-hidden rounded-3xl p-6 sm:p-10">
      {/* Decorative elements */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-accent-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-glow-500/10 blur-3xl" />
      
      <div className="relative flex flex-col items-center gap-8">
        {/* Main number display */}
        <div className="space-y-3 text-center">
          <div
            aria-live="polite"
            className="number-counter font-display text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            <span className="text-gradient">{primaryText}</span>
          </div>
          <p className="text-base text-slate-400">Estimated people in the United States</p>
        </div>

        {/* Percentage display */}
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-2 rounded-2xl border border-accent-500/20 bg-accent-500/5 px-6 py-3">
            <span className="font-mono text-4xl font-bold text-accent-400" aria-live="polite">
              {percentValue}
            </span>
            <span className="text-xl font-medium text-accent-400/70">%</span>
          </div>
          <span className="text-sm text-slate-500">of U.S. adult population (ACS cells)</span>
        </div>

        {/* Percent Grid */}
        <div className="w-full max-w-2xl">
          <PercentGrid percent={probability * 100} />
        </div>

        {/* Summary section */}
        <div className="w-full space-y-4 rounded-2xl border border-dark-300 bg-dark-700/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Base population:</span>
              <span className="font-mono font-semibold text-white">{formatNumber(total)}</span>
            </div>
            {isTiny && (
              <span className="rounded-lg bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
                Estimated: {formatNumber(animatedValue)} people
              </span>
            )}
          </div>
          
          <div className="h-px bg-gradient-to-r from-transparent via-dark-300 to-transparent" />
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-slate-400">Active filters:</span>
              <span className="text-slate-200">{summary}</span>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-dark-300 bg-dark-600/50 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-accent-500/50 hover:text-white"
            >
              <svg className="h-3.5 w-3.5 transition group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
