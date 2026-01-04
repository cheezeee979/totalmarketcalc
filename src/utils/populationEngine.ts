import type { AcsCell, ModeledAssets, ModeledTraitKey, PopulationData, TraitManifestEntry } from '../types'
import type { SelectionState } from './calculations'
import { computeDimensionProbability } from './calculations'
import {
  computeDenominatorPop,
  computeEffectiveMinAge,
  filterEligibleCells,
  getUniverseLabel,
  isAgeBandEligible,
} from './traitHelpers'

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const filterCells = (cells: AcsCell[], selection: SelectionState, effectiveMinAge: number) =>
  cells.filter((cell) => {
    // Exclude cells that don't meet the minAge requirement for modeled traits
    if (!isAgeBandEligible(cell.age_band, effectiveMinAge)) return false
    
    const matchesRegion = selection.region.size ? selection.region.has(cell.region) : true
    const matchesSex = selection.sex.size ? selection.sex.has(cell.sex) : true
    // For age bands, only consider eligible ones
    const matchesAge = selection.ageBand.size
      ? selection.ageBand.has(cell.age_band) && isAgeBandEligible(cell.age_band, effectiveMinAge)
      : true
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

export type EstimateResult = {
  estimated: number
  probability: number
  shareFactor: number
  matchingCells: number
  denominatorPop: number
  universeLabel: string
  nationalModelSelected: boolean
  effectiveMinAge: number
}

export const estimatePopulation = (opts: {
  selection: SelectionState
  modeled: ModeledAssets
  population: PopulationData
}): EstimateResult => {
  const { selection, modeled, population } = opts
  const traitKeys = Array.from(selection.modeledTraits)
  
  // Look up trait metadata for selected traits
  const selectedTraits = modeled.manifest.traits.filter((t) => traitKeys.includes(t.key))
  
  // Compute effective minAge from selected traits (0 if no traits selected)
  const effectiveMinAge = computeEffectiveMinAge(selectedTraits)
  
  // Determine if any national-only trait is selected
  const nationalModelSelected = selectedTraits.some((t) => t.regionSupport === 'national_only')
  
  // Get universe label and denominator based on effective minAge
  const universeLabel = getUniverseLabel(effectiveMinAge)
  const denominatorPop = effectiveMinAge === 0
    ? modeled.acsCells.total_pop
    : computeDenominatorPop(modeled.acsCells.cells, effectiveMinAge)
  
  // Filter cells with age eligibility
  const filtered = filterCells(modeled.acsCells.cells, selection, effectiveMinAge)
  const shareFactor = computeShareFactor(selection, population)

  const weightedSum = filtered.reduce((acc, cell) => {
    const modeledMultiplier = traitKeys.length ? traitProduct(cell.cell_id, traitKeys, modeled.traitProbabilities) : 1
    return acc + cell.pop * modeledMultiplier
  }, 0)

  const estimated = weightedSum * shareFactor
  const probability = denominatorPop ? estimated / denominatorPop : 0

  return {
    estimated: Math.round(estimated),
    probability: clamp(probability, 0, 1),
    shareFactor,
    matchingCells: filtered.length,
    denominatorPop,
    universeLabel,
    nationalModelSelected,
    effectiveMinAge,
  }
}
