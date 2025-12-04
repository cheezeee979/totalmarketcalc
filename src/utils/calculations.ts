import type {
  CategoryStats,
  DimensionName,
  EmploymentKey,
  PopulationData,
  RaceKey,
  RegionKey,
  SexKey,
} from '../types'

export type SelectionState = {
  sex: Set<SexKey>
  race: Set<RaceKey>
  region: Set<RegionKey>
  employment: Set<EmploymentKey>
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

  return parts.length ? parts.join(' · ') : 'No filters applied'
}
