import type { AcsCell, ModeledAssets, ModeledTraitKey, PopulationData } from '../types'
import type { SelectionState } from './calculations'
import { computeDimensionProbability } from './calculations'

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const filterCells = (cells: AcsCell[], selection: SelectionState) =>
  cells.filter((cell) => {
    const matchesRegion = selection.region.size ? selection.region.has(cell.region) : true
    const matchesSex = selection.sex.size ? selection.sex.has(cell.sex) : true
    const matchesAge = selection.ageBand.size ? selection.ageBand.has(cell.age_band) : true
    return matchesRegion && matchesSex && matchesAge
  })

const computeShareFactor = (selection: SelectionState, population: PopulationData) => {
  const entries: Array<[Set<string>, Record<string, { share: number; count: number }>]> = [
    [selection.race, population.dimensions.race],
    [selection.employment, population.dimensions.employment],
    [selection.children, population.dimensions.children],
    [selection.income, population.dimensions.income],
    [selection.education, population.dimensions.education],
    [selection.householdType, population.dimensions.householdType],
  ]

  const product = entries.reduce((acc, [selected, shares]) => {
    const p = computeDimensionProbability(selected, shares)
    return acc * p
  }, 1)

  return clamp(product, 0, 1)
}

const traitProduct = (
  cellId: string,
  traitKeys: ModeledTraitKey[],
  probabilities: ModeledAssets['traitProbabilities'],
) =>
  traitKeys.reduce((acc, key) => {
    const prob = probabilities[key]?.[cellId]
    if (prob === undefined) {
      throw new Error(`Missing probability for trait ${key} at cell ${cellId}. Run npm run build:modeled-data.`)
    }
    return acc * prob
  }, 1)

export const estimatePopulation = (opts: {
  selection: SelectionState
  modeled: ModeledAssets
  population: PopulationData
}) => {
  const { selection, modeled, population } = opts
  const filtered = filterCells(modeled.acsCells.cells, selection)
  const traitKeys = Array.from(selection.modeledTraits)
  const shareFactor = computeShareFactor(selection, population)

  const weightedSum = filtered.reduce((acc, cell) => {
    const modeledMultiplier = traitKeys.length ? traitProduct(cell.cell_id, traitKeys, modeled.traitProbabilities) : 1
    return acc + cell.pop * modeledMultiplier
  }, 0)

  const estimated = weightedSum * shareFactor
  const probability = modeled.acsCells.total_pop ? estimated / modeled.acsCells.total_pop : 0

  return {
    estimated: Math.round(estimated),
    probability: clamp(probability, 0, 1),
    shareFactor,
    matchingCells: filtered.length,
  }
}
