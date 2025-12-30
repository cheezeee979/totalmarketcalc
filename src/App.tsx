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
  IncomeKey,
  EducationKey,
  HouseholdTypeKey,
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
  // Income labels
  under25k: 'Under $25,000',
  income25to50k: '$25,000 - $49,999',
  income50to75k: '$50,000 - $74,999',
  income75to100k: '$75,000 - $99,999',
  income100to150k: '$100,000 - $149,999',
  over150k: '$150,000+',
  // Education labels
  lessThanHighSchool: 'Less than high school',
  highSchool: 'High school diploma',
  someCollege: 'Some college / Associate',
  bachelors: "Bachelor's degree",
  graduate: 'Graduate degree',
  // Household type labels
  marriedCouple: 'Married couple',
  singleParent: 'Single parent',
  livingAlone: 'Living alone',
  otherHousehold: 'Other household',
}

const createBlankSelection = (): SelectionState => ({
  sex: new Set(),
  race: new Set(),
  region: new Set(),
  employment: new Set(),
  age: new Set(),
  children: new Set(),
  income: new Set(),
  education: new Set(),
  householdType: new Set(),
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
    description: 'DP02 households with own children under 18',
  },
  {
    key: 'noChildren',
    label: 'No children in household',
    description: 'Population not in households with children',
  },
]

const incomeOptions: Array<{ key: IncomeKey; label: string; description: string }> = [
  { key: 'under25k', label: 'Under $25,000', description: 'Household income below $25K' },
  { key: 'income25to50k', label: '$25,000 - $49,999', description: 'Lower-middle income bracket' },
  { key: 'income50to75k', label: '$50,000 - $74,999', description: 'Middle income bracket' },
  { key: 'income75to100k', label: '$75,000 - $99,999', description: 'Upper-middle income bracket' },
  { key: 'income100to150k', label: '$100,000 - $149,999', description: 'High income bracket' },
  { key: 'over150k', label: '$150,000+', description: 'Top income bracket' },
]

const educationOptions: Array<{ key: EducationKey; label: string; description: string }> = [
  { key: 'lessThanHighSchool', label: 'Less than high school', description: 'No diploma or GED' },
  { key: 'highSchool', label: 'High school diploma', description: 'HS diploma or GED' },
  { key: 'someCollege', label: 'Some college / Associate', description: 'Some college or 2-year degree' },
  { key: 'bachelors', label: "Bachelor's degree", description: '4-year college degree' },
  { key: 'graduate', label: 'Graduate degree', description: "Master's, doctorate, or professional" },
]

const householdTypeOptions: Array<{ key: HouseholdTypeKey; label: string; description: string }> = [
  { key: 'marriedCouple', label: 'Married couple', description: 'Married-couple household' },
  { key: 'singleParent', label: 'Single parent', description: 'Single parent with children' },
  { key: 'livingAlone', label: 'Living alone', description: 'One-person household' },
  { key: 'otherHousehold', label: 'Other household', description: 'Roommates, multigenerational, etc.' },
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
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient background effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="hero-glow hero-glow-cyan" />
        <div className="hero-glow hero-glow-pink" />
        <div className="hero-glow hero-glow-blue" />
      </div>
      
      {/* Grid overlay */}
      <div className="pointer-events-none fixed inset-0 grid-pattern opacity-50" />
      
      <div className="relative z-10">
        <SiteHeader currentRoute={route} onNavigate={navigate} />
        <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">{content}</main>
        <SiteFooter data={data} />
      </div>
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
  <div className="space-y-12">
    {/* Hero Section */}
    <div className="space-y-4 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-4 py-1.5 text-sm font-medium text-accent-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-400"></span>
        </span>
        Live U.S. Census Data
      </div>
      <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
        Slice the <span className="text-gradient">U.S. Population</span>
      </h1>
      <p className="mx-auto max-w-2xl text-lg text-slate-400">
        Interactive demographic explorer powered by American Community Survey data. 
        Toggle filters and watch population estimates update in real-time.
      </p>
    </div>

    {error ? (
      <div className="glass rounded-2xl border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
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
      <section className="glass gradient-border flex flex-col items-center gap-4 rounded-3xl p-8 text-center sm:p-12">
        <div className="h-16 w-2/3 animate-pulse rounded-lg bg-dark-400" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-dark-400" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-dark-400" />
      </section>
    )}

    {/* Filters Section */}
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-semibold text-white">Demographic Filters</h2>
          <p className="text-sm text-slate-400">
            Multi-select across dimensions to narrow your population estimate
          </p>
        </div>
        <button
          onClick={resetFilters}
          className="group flex items-center gap-2 rounded-xl border border-dark-300 bg-dark-600/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-accent-500/50 hover:text-white"
        >
          <svg className="h-4 w-4 transition group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset All
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <FilterCard
          title="Sex / Race"
          description="Multi-select allowed. Shares derived from ACS B01001 and B02001."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        >
          <fieldset className="space-y-2" aria-label="Sex">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-400">Sex</legend>
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

          <div className="my-3 h-px bg-gradient-to-r from-transparent via-dark-300 to-transparent" />

          <fieldset className="space-y-2" aria-label="Race">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-400">Race</legend>
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
          title="Age Bands"
          description="Broad age groups aggregated from ACS B01001."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        >
          <fieldset className="space-y-2" aria-label="Age bands">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-400">Age</legend>
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
          description="Census regions (ACS B01003). Multi-select uses union within dimension."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <fieldset className="space-y-2" aria-label="Region">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-400">Census Region</legend>
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
          description="DP03 employment status, scaled to the total population (16+ base)."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        >
          <fieldset className="space-y-2" aria-label="Employment status">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-400">Status</legend>
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
          title="Household Children"
          description="Households with own children under 18 (ACS DP02), scaled to population."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          }
        >
          <fieldset className="space-y-2" aria-label="Household children">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-400">Children</legend>
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

        <FilterCard
          title="Household Income"
          description="Annual household income brackets based on ACS data."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <fieldset className="space-y-2" aria-label="Household income">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-400">Income</legend>
            {incomeOptions.map((option) => (
              <FilterCheckbox
                key={option.key}
                id={`income-${option.key}`}
                label={option.label}
                description={option.description}
                checked={selection.income.has(option.key)}
                onChange={(checked) => toggleSelection('income', option.key, checked)}
              />
            ))}
          </fieldset>
        </FilterCard>

        <FilterCard
          title="Education Level"
          description="Highest educational attainment (25+ population)."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
            </svg>
          }
        >
          <fieldset className="space-y-2" aria-label="Education level">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-400">Education</legend>
            {educationOptions.map((option) => (
              <FilterCheckbox
                key={option.key}
                id={`education-${option.key}`}
                label={option.label}
                description={option.description}
                checked={selection.education.has(option.key)}
                onChange={(checked) => toggleSelection('education', option.key, checked)}
              />
            ))}
          </fieldset>
        </FilterCard>

        <FilterCard
          title="Household Type"
          description="Living arrangement and household composition."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        >
          <fieldset className="space-y-2" aria-label="Household type">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-400">Type</legend>
            {householdTypeOptions.map((option) => (
              <FilterCheckbox
                key={option.key}
                id={`householdType-${option.key}`}
                label={option.label}
                description={option.description}
                checked={selection.householdType.has(option.key)}
                onChange={(checked) => toggleSelection('householdType', option.key, checked)}
              />
            ))}
          </fieldset>
        </FilterCard>
      </div>
    </section>

    {/* CTA Section */}
    <section className="glass gradient-border rounded-3xl p-8 text-center sm:p-12">
      <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">
        Need Custom Demographics Data?
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-slate-400">
        Get access to advanced filters, historical trends, and export capabilities with our Pro plan.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <button className="cta-button group relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-glow-500 px-8 py-3 font-semibold text-white shadow-glow-md transition hover:shadow-glow-lg">
          <span>Upgrade to Pro</span>
          <svg className="h-5 w-5 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
        <button className="inline-flex items-center gap-2 rounded-xl border border-dark-300 bg-dark-600/50 px-8 py-3 font-medium text-slate-300 transition hover:border-accent-500/50 hover:text-white">
          Learn More
        </button>
      </div>
    </section>
  </div>
)

const AboutPage = () => (
  <div className="space-y-8">
    <div className="space-y-4 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-glow-500/30 bg-glow-500/10 px-4 py-1.5 text-sm font-medium text-glow-400">
        About
      </div>
      <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
        What This <span className="text-gradient">Calculator</span> Does
      </h1>
      <p className="mx-auto max-w-2xl text-lg text-slate-400">
        A simple, interactive way to understand how many people in the United States match a set of
        demographic and economic filters. No accounts, no API calls on page load—just instant
        estimates based on cached Census data.
      </p>
    </div>

    <div className="glass gradient-border space-y-4 rounded-3xl p-6 text-slate-300 sm:p-8">
      <p>
        The homepage lets you toggle sex, race, geography, and employment filters. As you make
        selections, the main number, percent, and 10×10 grid animate to show the share of the U.S.
        population that fits your choices.
      </p>
      <ul className="list-inside space-y-3">
        <li className="flex items-start gap-3">
          <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-accent-400">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
          Large, centered output keeps the focus on the estimated population.
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-accent-400">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
          The percent text and grid visually map each percentage point to a square.
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-accent-400">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
          Filters remain flexible with multi-select support within each dimension.
        </li>
      </ul>
    </div>
  </div>
)

type DataPageProps = {
  data: PopulationData | null
  loading: boolean
}

const DataPage = ({ data, loading }: DataPageProps) => (
  <div className="space-y-8">
    <div className="space-y-4 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-electric-500/30 bg-electric-500/10 px-4 py-1.5 text-sm font-medium text-electric-400">
        Data Sources
      </div>
      <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
        Data & <span className="text-gradient-electric">Methodology</span>
      </h1>
      <p className="mx-auto max-w-2xl text-lg text-slate-400">
        Powered by American Community Survey 1-year tables. Estimates assume independence across
        selected dimensions and are scaled to the total U.S. population.
      </p>
    </div>

    {data ? (
      <AboutPanel year={data.meta.year} generatedAt={data.meta.generatedAt} />
    ) : (
      <div className="glass gradient-border rounded-3xl p-6 text-sm text-slate-400">
        {loading ? (
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 animate-spin text-accent-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading data details…
          </div>
        ) : (
          'Data is not available right now.'
        )}
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
    <header className="sticky top-0 z-50 border-b border-white/5 bg-dark-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a
          className="group flex items-center gap-3"
          href="/"
          onClick={(e) => {
            e.preventDefault()
            onNavigate('home')
          }}
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-glow-500 shadow-glow-sm transition group-hover:shadow-glow-md">
            <span className="font-display text-lg font-bold text-white">P</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-semibold text-white">PopScope</span>
            <span className="text-xs text-slate-500">U.S. Demographics</span>
          </div>
        </a>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <a
              key={item.route}
              href={pathForRoute(item.route)}
              onClick={(e) => {
                e.preventDefault()
                onNavigate(item.route)
              }}
              aria-current={currentRoute === item.route ? 'page' : undefined}
              className={`relative rounded-lg px-4 py-2 text-sm font-medium transition ${
                currentRoute === item.route
                  ? 'text-white nav-active'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.label}
            </a>
          ))}
          <button className="ml-4 rounded-lg bg-gradient-to-r from-accent-500 to-accent-600 px-4 py-2 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow-md">
            Get Pro
          </button>
        </nav>
      </div>
    </header>
  )
}

const SiteFooter = ({ data }: { data: PopulationData | null }) => (
  <footer className="border-t border-white/5 bg-dark-900/50">
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-glow-500">
              <span className="font-display text-lg font-bold text-white">P</span>
            </div>
            <span className="font-display text-lg font-semibold text-white">PopScope</span>
          </div>
          <p className="text-sm text-slate-500">
            Real-time U.S. population estimates powered by American Community Survey data.
          </p>
        </div>
        
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Product</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><a href="#" className="transition hover:text-accent-400">Features</a></li>
            <li><a href="#" className="transition hover:text-accent-400">Pricing</a></li>
            <li><a href="#" className="transition hover:text-accent-400">API Access</a></li>
          </ul>
        </div>
        
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resources</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><a href="#" className="transition hover:text-accent-400">Documentation</a></li>
            <li><a href="#" className="transition hover:text-accent-400">Census Data</a></li>
            <li><a href="#" className="transition hover:text-accent-400">Methodology</a></li>
          </ul>
        </div>
        
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Legal</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><a href="#" className="transition hover:text-accent-400">Privacy</a></li>
            <li><a href="#" className="transition hover:text-accent-400">Terms</a></li>
            <li><a href="#" className="transition hover:text-accent-400">Disclaimer</a></li>
          </ul>
        </div>
      </div>
      
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-8">
        <p className="text-sm text-slate-500">
          © 2024 PopScope. Population estimates based on ACS data; independence assumption applied.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {data ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-dark-300 bg-dark-600/50 px-3 py-1 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
              Data: {data.meta.year} · {formatNumber(data.totalPopulation)} total
            </span>
          ) : null}
        </div>
      </div>
    </div>
  </footer>
)

export default App
