import type { AcsCells, AppData, PopulationData, TraitManifest, TraitProbabilityFile } from '../types'

const fetchJson = async <T>(url: string, onError: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(onError)
  }
  return (await res.json()) as T
}

export const loadAppData = async (): Promise<AppData> => {
  const [population, acsCells, manifest] = await Promise.all([
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

  const traitProbabilities: Record<string, Record<string, number>> = {}

  for (const trait of manifest.traits) {
    const traitPath = `/data/derived/${trait.file ?? `traits/${trait.key}.json`}`
    const payload = await fetchJson<TraitProbabilityFile>(
      traitPath,
      `Modeled trait file ${trait.key} is missing. Run npm run build:modeled-data.`,
    )
    traitProbabilities[trait.key] = payload.prob_by_cell
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
