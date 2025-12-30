import type {
  CategoryStats,
  DimensionName,
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
} from '../types'

export type SelectionState = {
  sex: Set<SexKey>
  race: Set<RaceKey>
  region: Set<RegionKey>
  employment: Set<EmploymentKey>
  age: Set<AgeKey>
  children: Set<ChildrenKey>
  income: Set<IncomeKey>
  education: Set<EducationKey>
  householdType: Set<HouseholdTypeKey>
}

export const computeDimensionProbability = (
  selected: Set<string>,
  shares: Record<string, CategoryStats>,
): number => {
  if (!selected.size) return 1

  const remaining = Array.from(selected).reduce(
    (product, key) => product * (1 - (shares[key]?.share ?? 0)),
    1,
  )

  return 1 - remaining
}

export const computeOverallProbability = (
  selection: SelectionState,
  data: PopulationData,
): number => {
  const dimensionEntries: Array<[DimensionName, Set<string>, Record<string, CategoryStats>]> = [
    ['sex', selection.sex, data.dimensions.sex],
    ['race', selection.race, data.dimensions.race],
    ['region', selection.region, data.dimensions.region],
    ['employment', selection.employment, data.dimensions.employment],
    ['age', selection.age, data.dimensions.age],
    ['children', selection.children, data.dimensions.children],
    ['income', selection.income, data.dimensions.income],
    ['education', selection.education, data.dimensions.education],
    ['householdType', selection.householdType, data.dimensions.householdType],
  ]

  return dimensionEntries.reduce((prob, [, selected, shares]) => {
    const pDim = computeDimensionProbability(selected, shares)
    return prob * pDim
  }, 1)
}

export const computeEstimatedPopulation = (total: number, probability: number) =>
  Math.round(total * probability)

export const formatNumber = (value: number) =>
  value.toLocaleString('en-US', { maximumFractionDigits: 0 })

export const formatPercent = (probability: number) =>
  (probability * 100).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  })

export const buildFilterSummary = (
  selection: SelectionState,
  labels: Record<string, string>,
): string => {
  const parts: string[] = []

  if (selection.sex.size) {
    parts.push(
      `Sex: ${Array.from(selection.sex)
        .map((key) => labels[key] ?? key)
        .join(', ')}`,
    )
  }
  if (selection.race.size) {
    parts.push(
      `Race: ${Array.from(selection.race)
        .map((key) => labels[key] ?? key)
        .join(', ')}`,
    )
  }
  if (selection.region.size) {
    parts.push(
      `Region: ${Array.from(selection.region)
        .map((key) => labels[key] ?? key)
        .join(', ')}`,
    )
  }
  if (selection.employment.size) {
    parts.push(
      `Employment: ${Array.from(selection.employment)
        .map((key) => labels[key] ?? key)
        .join(', ')}`,
    )
  }
  if (selection.age.size) {
    parts.push(
      `Age: ${Array.from(selection.age)
        .map((key) => labels[key] ?? key)
        .join(', ')}`,
    )
  }
  if (selection.children.size) {
    parts.push(
      `Household: ${Array.from(selection.children)
        .map((key) => labels[key] ?? key)
        .join(', ')}`,
    )
  }
  if (selection.income.size) {
    parts.push(
      `Income: ${Array.from(selection.income)
        .map((key) => labels[key] ?? key)
        .join(', ')}`,
    )
  }
  if (selection.education.size) {
    parts.push(
      `Education: ${Array.from(selection.education)
        .map((key) => labels[key] ?? key)
        .join(', ')}`,
    )
  }
  if (selection.householdType.size) {
    parts.push(
      `Household Type: ${Array.from(selection.householdType)
        .map((key) => labels[key] ?? key)
        .join(', ')}`,
    )
  }

  return parts.length ? parts.join(' · ') : 'No filters applied'
}
