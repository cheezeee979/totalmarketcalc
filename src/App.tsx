import { useEffect, useMemo, useState } from 'react'
import { AboutPanel } from './components/AboutPanel'
import { FilterCard } from './components/FilterCard'
import { FilterCheckbox } from './components/FilterCheckbox'
import { MainStat } from './components/MainStat'
import {
  buildFilterSummary,
  computeEstimatedPopulation,
  computeOverallProbability,
  formatNumber,
} from './utils/calculations'
import type {
  EmploymentKey,
  PopulationData,
  RaceKey,
  RegionKey,
  SexKey,
} from './types'
import type { SelectionState } from './utils/calculations'

const labelLookup: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  white: 'White alone',
  black: 'Black or African American alone',
  asian: 'Asian alone',
  other: 'All other / multiracial',
  northeast: 'Northeast',
  midwest: 'Midwest',
  south: 'South',
  west: 'West',
  employed: 'Employed',
  unemployed: 'Unemployed',
  notInLabor: 'Not in labor force',
}

const createBlankSelection = (): SelectionState => ({
  sex: new Set(),
  race: new Set(),
  region: new Set(),
  employment: new Set(),
})

const sexOptions: Array<{ key: SexKey; label: string; description: string }> = [
  { key: 'male', label: 'Male', description: 'ACS B01001_002E / total population' },
  { key: 'female', label: 'Female', description: 'ACS B01001_026E / total population' },
]

const raceOptions: Array<{ key: RaceKey; label: string; description: string }> = [
  { key: 'white', label: 'White alone', description: 'ACS B02001_002E / total' },
  { key: 'black', label: 'Black or African American alone', description: 'ACS B02001_003E / total' },
  { key: 'asian', label: 'Asian alone', description: 'ACS B02001_005E / total' },
  { key: 'other', label: 'All other / multiracial', description: 'Remainder of B02001 total' },
]

const regionOptions: Array<{ key: RegionKey; label: string; description: string }> = [
  { key: 'northeast', label: 'Northeast', description: 'Census region code 1' },
  { key: 'midwest', label: 'Midwest', description: 'Census region code 2' },
  { key: 'south', label: 'South', description: 'Census region code 3' },
  { key: 'west', label: 'West', description: 'Census region code 4' },
]

const employmentOptions: Array<{ key: EmploymentKey; label: string; description: string }> = [
  { key: 'employed', label: 'Employed', description: 'DP03_0004E (16+ civilian employed)' },
  { key: 'unemployed', label: 'Unemployed', description: 'DP03_0005E (16+ in labor force)' },
  { key: 'notInLabor', label: 'Not in labor force', description: 'DP03_0007E (16+)' },
]

function App() {
  const [data, setData] = useState<PopulationData | null>(null)
  const [selection, setSelection] = useState<SelectionState>(createBlankSelection)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/data/populationShares.json')
        if (!res.ok) throw new Error('Failed to load data')
        const json = (await res.json()) as PopulationData
        setData(json)
      } catch (err) {
        console.error(err)
        setError('We could not load the Census-derived data. Please try refreshing.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const probability = useMemo(
    () => (data ? computeOverallProbability(selection, data) : 0),
    [selection, data],
  )

  const safeProbability = Math.min(1, Math.max(0, probability))

  const estimated = useMemo(
    () => (data ? computeEstimatedPopulation(data.totalPopulation, safeProbability) : 0),
    [data, safeProbability],
  )

  const summary = buildFilterSummary(selection, labelLookup)

  const toggleSelection = (dimension: keyof SelectionState, key: string, checked: boolean) => {
    setSelection((prev) => {
      const nextSet = new Set(prev[dimension])
      if (checked) {
        nextSet.add(key as never)
      } else {
        nextSet.delete(key as never)
      }
      return { ...prev, [dimension]: nextSet }
    })
  }

  const resetFilters = () => setSelection(createBlankSelection())

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="h-10 w-10 rounded-2xl bg-brand-500/10 text-brand-700 ring-1 ring-brand-100 flex items-center justify-center text-lg font-bold">
              US
            </span>
            <div>
              <p className="text-lg font-semibold text-slate-900">Population Calculator</p>
              <p className="text-sm text-slate-600">Explore U.S. segments in a click</p>
            </div>
          </div>
          <nav className="hidden items-center gap-4 text-sm font-medium text-slate-700 sm:flex">
            <a className="text-brand-700" href="#calculator">
              Calculator
            </a>
            <a className="hover:text-brand-700" href="#about">
              About the data
            </a>
          </nav>
        </div>
      </header>

      <main id="calculator" className="mx-auto max-w-6xl px-4 pb-14 pt-10 space-y-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          {data ? (
            <MainStat
              total={data.totalPopulation}
              estimated={estimated}
              probability={safeProbability}
              summary={summary}
              onReset={resetFilters}
            />
          ) : (
            <section className="space-y-3 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200">
              <div className="h-12 w-2/3 animate-pulse rounded-lg bg-slate-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200" />
            </section>
          )}
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700">
              Explore the numbers
            </p>
            <h1 className="text-3xl font-bold text-slate-900">
              Estimate U.S. population segments in seconds.
            </h1>
            <p className="mt-3 text-base text-slate-700">
              Use the checkboxes below to filter the U.S. population by demographics, geography, and
              employment status. The main number updates instantly based on American Community Survey
              data and a simple independence assumption.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-100">
              <span className="size-2 rounded-full bg-brand-600" />
              Data cached at build time — no API calls on page load.
            </div>
          </section>
        </div>

        {error ? (
          <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-3">
          <FilterCard
            title="Demographics"
            description="Multi-select allowed. Shares derived from ACS B01001 and B02001."
          >
            <fieldset className="space-y-2" aria-label="Sex">
              <legend className="mb-1 text-sm font-semibold text-slate-800">Sex</legend>
              {sexOptions.map((option) => (
                <FilterCheckbox
                  key={option.key}
                  id={`sex-${option.key}`}
                  label={option.label}
                  description={option.description}
                  checked={selection.sex.has(option.key)}
                  onChange={(checked) => toggleSelection('sex', option.key, checked)}
                />
              ))}
            </fieldset>

            <fieldset className="space-y-2" aria-label="Race">
              <legend className="mb-1 text-sm font-semibold text-slate-800">Race</legend>
              {raceOptions.map((option) => (
                <FilterCheckbox
                  key={option.key}
                  id={`race-${option.key}`}
                  label={option.label}
                  description={option.description}
                  checked={selection.race.has(option.key)}
                  onChange={(checked) => toggleSelection('race', option.key, checked)}
                />
              ))}
            </fieldset>
          </FilterCard>

          <FilterCard
            title="Geography"
            description="U.S. Census regions (ACS B01003). Multi-select uses union within the region dimension."
          >
            <fieldset className="space-y-2" aria-label="Region">
              <legend className="mb-1 text-sm font-semibold text-slate-800">Census region</legend>
              {regionOptions.map((option) => (
                <FilterCheckbox
                  key={option.key}
                  id={`region-${option.key}`}
                  label={option.label}
                  description={option.description}
                  checked={selection.region.has(option.key)}
                  onChange={(checked) => toggleSelection('region', option.key, checked)}
                />
              ))}
            </fieldset>
          </FilterCard>

          <FilterCard
            title="Employment"
            description="DP03 employment status, scaled to the total population (16+ base in source data)."
          >
            <fieldset className="space-y-2" aria-label="Employment status">
              <legend className="mb-1 text-sm font-semibold text-slate-800">Status</legend>
              {employmentOptions.map((option) => (
                <FilterCheckbox
                  key={option.key}
                  id={`employment-${option.key}`}
                  label={option.label}
                  description={option.description}
                  checked={selection.employment.has(option.key)}
                  onChange={(checked) => toggleSelection('employment', option.key, checked)}
                />
              ))}
            </fieldset>
          </FilterCard>
        </div>

        {data && !loading ? (
          <section id="about">
            <AboutPanel year={data.meta.year} generatedAt={data.meta.generatedAt} />
          </section>
        ) : null}
      </main>

      <footer className="border-t border-slate-200 bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-slate-600">
          <p>
            Population estimates based on ACS data; independence assumption used for intersections.
            Not for official use.
          </p>
          <div className="flex flex-wrap gap-3">
            {data ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Data year: {data.meta.year} · Total: {formatNumber(data.totalPopulation)}
              </span>
            ) : null}
            <a
              href="https://github.com/"
              className="font-semibold text-brand-700 hover:text-brand-900"
              target="_blank"
              rel="noreferrer"
            >
              View source (placeholder)
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
