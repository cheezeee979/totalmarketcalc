import type { AcsCells, AppData, PopulationData, TraitManifest, TraitProbabilityFile } from '../types'

const fetchJson = async <T>(url: string, onError: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(onError)
  }
  return (await res.json()) as T
}

/**
 * Validate ACS cells data integrity
 */
const validateAcsCells = (acsCells: AcsCells): AcsCells => {
  const summedPop = acsCells.cells.reduce((sum, cell) => sum + cell.pop, 0)
  
  if (Math.abs(summedPop - acsCells.total_pop) > 1) {
    console.warn(
      `[Data Health] ACS cells total_pop mismatch: stored ${acsCells.total_pop}, computed ${summedPop}. Using computed.`
    )
    return {
      ...acsCells,
      total_pop: summedPop,
    }
  }
  
  return acsCells
}

/**
 * Validate trait probability file
 */
const validateTraitProbabilities = (
  traitKey: string,
  probabilities: Record<string, number>,
  cellIds: Set<string>
): void => {
  // Check coverage
  const missingCells: string[] = []
  const invalidProbs: string[] = []
  
  cellIds.forEach((cellId) => {
    const prob = probabilities[cellId]
    if (prob === undefined) {
      missingCells.push(cellId)
    } else if (!Number.isFinite(prob) || prob < 0 || prob > 1) {
      invalidProbs.push(`${cellId}: ${prob}`)
    }
  })
  
  if (missingCells.length > 0) {
    throw new Error(
      `Trait ${traitKey} is missing probabilities for cells: ${missingCells.slice(0, 5).join(', ')}${
        missingCells.length > 5 ? ` and ${missingCells.length - 5} more` : ''
      }. Run npm run build:modeled-data.`
    )
  }
  
  if (invalidProbs.length > 0) {
    console.warn(
      `[Data Health] Trait ${traitKey} has invalid probabilities: ${invalidProbs.slice(0, 3).join(', ')}`
    )
  }
}

/**
 * Log data health summary
 */
const logDataHealth = (
  acsCells: AcsCells,
  manifest: TraitManifest,
  traitProbabilities: Record<string, Record<string, number>>
): void => {
  const nationalOnlyTraits = manifest.traits.filter((t) => t.regionSupport === 'national_only')
  const under18Cells = acsCells.cells.filter((c) => c.age_band === '0_17')
  const adultCells = acsCells.cells.filter((c) => c.age_band !== '0_17')
  
  console.log('[Data Health] Summary:')
  console.log(`  - ACS cells: ${acsCells.cells.length} total`)
  console.log(`    - Under-18 cells: ${under18Cells.length}`)
  console.log(`    - Adult cells: ${adultCells.length}`)
  console.log(`  - Total population: ${acsCells.total_pop.toLocaleString()}`)
  console.log(`  - Universe: ${acsCells.meta.universe ?? 'not specified'}`)
  console.log(`  - Traits loaded: ${manifest.traits.length}`)
  if (nationalOnlyTraits.length > 0) {
    console.log(`  - National-only traits: ${nationalOnlyTraits.map((t) => t.key).join(', ')}`)
  }
  console.log(`  - Generated: ${acsCells.meta.generatedAt}`)
}

export const loadAppData = async (): Promise<AppData> => {
  const [population, acsCellsRaw, manifest] = await Promise.all([
    fetchJson<PopulationData>(
      '/data/populationShares.json',
      'We could not load the Census-derived data. Please try refreshing.',
    ),
    fetchJson<AcsCells>(
      '/data/derived/acs_cells.json',
      'ACS cell backbone is missing. Run npm run build:acs-cells to regenerate.',
    ),
    fetchJson<TraitManifest>(
      '/data/derived/traits_manifest.json',
      'Modeled trait manifest is missing. Run npm run build:modeled-data.',
    ),
  ])

  // Validate and possibly correct ACS cells
  const acsCells = validateAcsCells(acsCellsRaw)
  
  // Build set of cell IDs for validation
  const cellIds = new Set(acsCells.cells.map((c) => c.cell_id))

  const traitProbabilities: Record<string, Record<string, number>> = {}

  for (const trait of manifest.traits) {
    const traitPath = `/data/derived/${trait.file ?? `traits/${trait.key}.json`}`
    const payload = await fetchJson<TraitProbabilityFile>(
      traitPath,
      `Modeled trait file ${trait.key} is missing. Run npm run build:modeled-data.`,
    )
    
    // Validate trait probabilities - only validate against adult cells for adult traits
    const eligibleCellIds = trait.minAge >= 18
      ? new Set(acsCells.cells.filter((c) => c.age_band !== '0_17').map((c) => c.cell_id))
      : cellIds
    validateTraitProbabilities(trait.key, payload.prob_by_cell, eligibleCellIds)
    
    traitProbabilities[trait.key] = payload.prob_by_cell
  }

  // Log data health in development
  if (import.meta.env.DEV) {
    logDataHealth(acsCells, manifest, traitProbabilities)
  }

  return {
    population,
    modeled: {
      acsCells,
      manifest,
      traitProbabilities,
    },
  }
}
