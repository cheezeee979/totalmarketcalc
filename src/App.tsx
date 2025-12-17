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
  AgeKey,
  ChildrenKey,
} from './types'
import type { SelectionState } from './utils/calculations'

type Route = 'home' | 'about' | 'data'

const pathForRoute = (route: Route) => (route === 'home' ? '/' : `/${route}`)

const resolveRoute = (pathname: string): Route => {
  if (pathname.startsWith('/about')) return 'about'
  if (pathname.startsWith('/data')) return 'data'
  return 'home'
}

const useInAppRoute = () => {
  const [route, setRoute] = useState<Route>(() => resolveRoute(window.location.pathname))

  useEffect(() => {
    const onPop = () => setRoute(resolveRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (next: Route) => {
    const nextPath = pathForRoute(next)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setRoute(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return { route, navigate }
}

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
  age0to17: '0-17',
  age18to34: '18-34',
  age35to54: '35-54',
  age55to74: '55-74',
  age75plus: '75+',
  hasChildren: 'Has children in household',
  noChildren: 'No children in household',
}

const createBlankSelection = (): SelectionState => ({
  sex: new Set(),
  race: new Set(),
  region: new Set(),
  employment: new Set(),
  age: new Set(),
  children: new Set(),
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

const ageOptions: Array<{ key: AgeKey; label: string; description: string }> = [
  { key: 'age0to17', label: '0-17', description: 'ACS B01001 aggregated youth population' },
  { key: 'age18to34', label: '18-34', description: 'ACS B01001 young adult population' },
  { key: 'age35to54', label: '35-54', description: 'ACS B01001 prime working years' },
  { key: 'age55to74', label: '55-74', description: 'ACS B01001 older adult population' },
  { key: 'age75plus', label: '75+', description: 'ACS B01001 seniors' },
]

const childrenOptions: Array<{ key: ChildrenKey; label: string; description: string }> = [
  {
    key: 'hasChildren',
    label: 'Has children in household',
    description: 'DP02 households with own children under 18 (scaled to population)',
  },
  {
    key: 'noChildren',
    label: 'No children in household',
    description: 'Complement population not in households with children',
  },
]

function App() {
  const { route, navigate } = useInAppRoute()
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

  const content =
    route === 'about' ? (
      <AboutPage />
    ) : route === 'data' ? (
      <DataPage data={data} loading={loading} />
    ) : (
      <HomePage
        data={data}
        error={error}
        selection={selection}
        toggleSelection={toggleSelection}
        resetFilters={resetFilters}
        summary={summary}
        estimated={estimated}
        probability={safeProbability}
      />
    )

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <SiteHeader currentRoute={route} onNavigate={navigate} />
      <main className="mx-auto max-w-5xl px-4 py-10">{content}</main>
      <SiteFooter data={data} />
    </div>
  )
}

type HomePageProps = {
  data: PopulationData | null
  error: string | null
  selection: SelectionState
  toggleSelection: (dimension: keyof SelectionState, key: string, checked: boolean) => void
  resetFilters: () => void
  summary: string
  estimated: number
  probability: number
}

const HomePage = ({
  data,
  error,
  selection,
  toggleSelection,
  resetFilters,
  summary,
  estimated,
  probability,
}: HomePageProps) => (
  <div className="space-y-10">
    <div className="space-y-2 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-700">
        U.S. population
      </p>
      <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
        Estimate any slice of the U.S. population
      </h1>
      <p className="mx-auto max-w-2xl text-sm text-slate-600">
        Use the filters below to select demographics, geography, and employment segments. The main
        number, percent, and 100-square grid update instantly as you toggle options.
      </p>
    </div>

    {error ? (
      <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-100">
        {error}
      </div>
    ) : null}

    {data ? (
      <MainStat
        total={data.totalPopulation}
        estimated={estimated}
        probability={probability}
        summary={summary}
        onReset={resetFilters}
      />
    ) : (
      <section className="flex flex-col items-center gap-3 rounded-3xl bg-white p-8 text-center shadow-soft ring-1 ring-slate-200">
        <div className="h-12 w-2/3 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-slate-200" />
      </section>
    )}

    <section className="space-y-2 text-center">
      <h2 className="text-xl font-semibold text-slate-900">Filters</h2>
      <p className="text-sm text-slate-600">
        Toggle the panels to refine the estimate. Cards wrap on smaller screens.
      </p>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <FilterCard
        title="Sex / race"
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
        title="Age bands"
        description="Broad age groups aggregated from ACS B01001."
      >
        <fieldset className="space-y-2" aria-label="Age bands">
          <legend className="mb-1 text-sm font-semibold text-slate-800">Age</legend>
          {ageOptions.map((option) => (
            <FilterCheckbox
              key={option.key}
              id={`age-${option.key}`}
              label={option.label}
              description={option.description}
              checked={selection.age.has(option.key)}
              onChange={(checked) => toggleSelection('age', option.key, checked)}
            />
          ))}
        </fieldset>
      </FilterCard>

      <FilterCard
        title="Geography"
        description="Census regions (ACS B01003). Multi-select uses union within this dimension."
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

      <FilterCard
        title="Has children"
        description="Households with own children under 18 (ACS DP02), scaled to population."
      >
        <fieldset className="space-y-2" aria-label="Household children">
          <legend className="mb-1 text-sm font-semibold text-slate-800">Children in household</legend>
          {childrenOptions.map((option) => (
            <FilterCheckbox
              key={option.key}
              id={`children-${option.key}`}
              label={option.label}
              description={option.description}
              checked={selection.children.has(option.key)}
              onChange={(checked) => toggleSelection('children', option.key, checked)}
            />
          ))}
        </fieldset>
      </FilterCard>

      <FilterCard title="Etc" description="Additional filters will appear here soon.">
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-500">
          Coming soon: education, income, household type, and more ways to slice the data.
        </div>
      </FilterCard>
    </div>
  </div>
)

const AboutPage = () => (
  <div className="space-y-6">
    <div className="space-y-2 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-700">About</p>
      <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">What this calculator does</h1>
      <p className="mx-auto max-w-2xl text-sm text-slate-600">
        A simple, interactive way to understand how many people in the United States match a set of
        demographic and economic filters. No accounts, no API calls on page load—just instant
        estimates based on cached Census data.
      </p>
    </div>

    <div className="space-y-3 rounded-3xl bg-white p-6 text-left text-slate-700 shadow-soft ring-1 ring-slate-200 sm:p-8">
      <p>
        The homepage lets you toggle sex, race, geography, and employment filters. As you make
        selections, the main number, percent, and 10x10 grid animate to show the share of the U.S.
        population that fits your choices.
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>Large, centered output keeps the focus on the estimated population.</li>
        <li>The percent text and grid visually map each percentage point to a square.</li>
        <li>Filters remain flexible with multi-select support within each dimension.</li>
      </ul>
    </div>
  </div>
)

type DataPageProps = {
  data: PopulationData | null
  loading: boolean
}

const DataPage = ({ data, loading }: DataPageProps) => (
  <div className="space-y-6">
    <div className="space-y-2 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-700">Data</p>
      <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Data sources & methodology</h1>
      <p className="mx-auto max-w-2xl text-sm text-slate-600">
        Powered by American Community Survey 1-year tables. Estimates assume independence across
        selected dimensions and are scaled to the total U.S. population.
      </p>
    </div>

    {data ? (
      <AboutPanel year={data.meta.year} generatedAt={data.meta.generatedAt} />
    ) : (
      <div className="rounded-3xl bg-white p-6 text-sm text-slate-700 ring-1 ring-slate-200">
        {loading ? 'Loading data details…' : 'Data is not available right now.'}
      </div>
    )}
  </div>
)

type SiteHeaderProps = {
  currentRoute: Route
  onNavigate: (route: Route) => void
}

const SiteHeader = ({ currentRoute, onNavigate }: SiteHeaderProps) => {
  const navItems: Array<{ label: string; route: Route }> = [
    { label: 'About', route: 'about' },
    { label: 'Data', route: 'data' },
  ]

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <a
          className="flex items-center gap-3 text-lg font-semibold text-slate-900"
          href="/"
          onClick={(e) => {
            e.preventDefault()
            onNavigate('home')
          }}
        >
          <span className="rounded-lg bg-slate-900 px-3 py-1 text-sm font-bold uppercase text-white">
            Logo
          </span>
          <span className="text-base font-medium text-slate-700">U.S. Population Calculator</span>
        </a>
        <nav className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {navItems.map((item) => (
            <a
              key={item.route}
              href={pathForRoute(item.route)}
              onClick={(e) => {
                e.preventDefault()
                onNavigate(item.route)
              }}
              aria-current={currentRoute === item.route ? 'page' : undefined}
              className={`rounded-full px-3 py-1 transition ${
                currentRoute === item.route
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}

const SiteFooter = ({ data }: { data: PopulationData | null }) => (
  <footer className="border-t border-slate-200 bg-white/90">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-slate-600">
      <p>
        Population estimates based on ACS data; independence assumption applied. Not for official
        use.
      </p>
      <div className="flex flex-wrap gap-3">
        {data ? (
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Data year: {data.meta.year} · Total: {formatNumber(data.totalPopulation)}
          </span>
        ) : null}
        <span className="text-slate-400">Demo interface</span>
      </div>
    </div>
  </footer>
)

export default App
