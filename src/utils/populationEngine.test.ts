/// <reference types="vitest" />
import { describe, expect, it } from 'vitest'
import acsCells from '../../data/derived/acs_cells.json' assert { type: 'json' }
import highChildcare from '../../data/derived/traits/high_childcare_time.json' assert { type: 'json' }
import physicallyActive from '../../data/derived/traits/physically_active.json' assert { type: 'json' }
import smokes from '../../data/derived/traits/smokes.json' assert { type: 'json' }
import traitManifest from '../../data/derived/traits_manifest.json' assert { type: 'json' }
import populationShares from '../../public/data/populationShares.json' assert { type: 'json' }
import type { SelectionState } from './calculations'
import { estimatePopulation } from './populationEngine'
import type { AcsCells, ModeledAssets, PopulationData, TraitProbabilityFile, TraitManifest } from '../types'

const modeled: ModeledAssets = {
  acsCells: acsCells as unknown as AcsCells,
  manifest: traitManifest as TraitManifest,
  traitProbabilities: {
    smokes: (smokes as TraitProbabilityFile).prob_by_cell,
    physically_active: (physicallyActive as TraitProbabilityFile).prob_by_cell,
    high_childcare_time: (highChildcare as TraitProbabilityFile).prob_by_cell,
  },
}

const blankSelection: SelectionState = {
  sex: new Set(),
  race: new Set(),
  region: new Set(),
  ageBand: new Set(),
  modeledTraits: new Set(),
  employment: new Set(),
  children: new Set(),
  income: new Set(),
  education: new Set(),
  householdType: new Set(),
}

describe('population engine', () => {
  const population = populationShares as PopulationData

  it('returns total_pop when no filters are selected', () => {
    const result = estimatePopulation({ selection: blankSelection, modeled, population })
    expect(result.estimated).toBe(modeled.acsCells.total_pop)
    expect(result.probability).toBeCloseTo(1, 5)
  })

  it('never exceeds total_pop', () => {
    const selection: SelectionState = {
      ...blankSelection,
      region: new Set(['west']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    expect(result.estimated).toBeLessThanOrEqual(modeled.acsCells.total_pop)
  })

  it('drops when modeled traits are applied', () => {
    const baseline = estimatePopulation({ selection: blankSelection, modeled, population })
    const selection: SelectionState = {
      ...blankSelection,
      modeledTraits: new Set(['smokes', 'physically_active']),
    }
    const withTraits = estimatePopulation({ selection, modeled, population })
    expect(withTraits.estimated).toBeLessThanOrEqual(baseline.estimated)
  })
})
