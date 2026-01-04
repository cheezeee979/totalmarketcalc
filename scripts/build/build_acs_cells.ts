import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'

type ApiRow = Array<string>

type RegionKey = 'northeast' | 'midwest' | 'south' | 'west'
type SexKey = 'male' | 'female'
type AgeBandKey = '0_14' | '15_17' | '18_24' | '25_34' | '35_44' | '45_54' | '55_64' | '65_plus'

const year = process.env.CENSUS_YEAR ?? '2024'
const apiKey = process.env.CENSUS_API_KEY
const base = `https://api.census.gov/data/${year}/acs/acs1`

const regionCodeToKey: Record<string, RegionKey> = {
  '1': 'northeast',
  '2': 'midwest',
  '3': 'south',
  '4': 'west',
}

const regionAbbrev: Record<RegionKey, string> = {
  northeast: 'ne',
  midwest: 'mw',
  south: 'so',
  west: 'we',
}

// B01001 age buckets mapped to our age bands
// Under 5: B01001_003E (male), B01001_027E (female)
// 5 to 9: B01001_004E (male), B01001_028E (female)
// 10 to 14: B01001_005E (male), B01001_029E (female)
// 15 to 17: B01001_006E (male), B01001_030E (female)
//
// NOTE: ACS B01001 provides 15-17, not 16-17. Employment (DP03) is for 16+.
// We split children into 0_14 and 15_17 to better handle employment eligibility.
const ageBands: Record<SexKey, Record<AgeBandKey, string[]>> = {
  male: {
    '0_14': ['B01001_003E', 'B01001_004E', 'B01001_005E'], // Under 5, 5-9, 10-14
    '15_17': ['B01001_006E'], // 15-17 (includes 15, which is below employment universe)
    '18_24': ['B01001_007E', 'B01001_008E', 'B01001_009E', 'B01001_010E'],
    '25_34': ['B01001_011E', 'B01001_012E'],
    '35_44': ['B01001_013E', 'B01001_014E'],
    '45_54': ['B01001_015E', 'B01001_016E'],
    '55_64': ['B01001_017E', 'B01001_018E', 'B01001_019E'],
    '65_plus': ['B01001_020E', 'B01001_021E', 'B01001_022E', 'B01001_023E', 'B01001_024E', 'B01001_025E'],
  },
  female: {
    '0_14': ['B01001_027E', 'B01001_028E', 'B01001_029E'], // Under 5, 5-9, 10-14
    '15_17': ['B01001_030E'], // 15-17 (includes 15, which is below employment universe)
    '18_24': ['B01001_031E', 'B01001_032E', 'B01001_033E', 'B01001_034E'],
    '25_34': ['B01001_035E', 'B01001_036E'],
    '35_44': ['B01001_037E', 'B01001_038E'],
    '45_54': ['B01001_039E', 'B01001_040E'],
    '55_64': ['B01001_041E', 'B01001_042E', 'B01001_043E'],
    '65_plus': ['B01001_044E', 'B01001_045E', 'B01001_046E', 'B01001_047E', 'B01001_048E', 'B01001_049E'],
  },
}

const parseNumber = (value: string | undefined) => {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num : 0
}

const fetchCensus = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Request failed: ${res.status} ${res.statusText} – ${text}`)
  }
  return (await res.json()) as ApiRow[]
}

const withKey = (url: string) => (apiKey ? `${url}&key=${apiKey}` : url)

const buildCellId = (region: RegionKey, sex: SexKey, ageBand: AgeBandKey) =>
  `${regionAbbrev[region]}_${sex}_${ageBand}`

const sumCodes = (row: ApiRow, idx: Record<string, number>, codes: string[]) =>
  codes.reduce((total, code) => total + parseNumber(row[idx[code]]), 0)

const writePayload = (payload: unknown) => {
  const outputPath = path.resolve(process.cwd(), 'data', 'derived', 'acs_cells.json')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  const publicPath = path.resolve(process.cwd(), 'public', 'data', 'derived', 'acs_cells.json')
  fs.mkdirSync(path.dirname(publicPath), { recursive: true })
  fs.copyFileSync(outputPath, publicPath)
  console.log(`Copied cell backbone to ${publicPath} for runtime usage`)
}

const fallbackFromExisting = () => {
  const existingPath = path.resolve(process.cwd(), 'data', 'derived', 'acs_cells.json')
  if (!fs.existsSync(existingPath)) return null
  console.warn('Checking existing data/derived/acs_cells.json...')
  const payload = JSON.parse(fs.readFileSync(existingPath, 'utf8'))
  
  // Validate that the existing file has the new age bands (0_14, 15_17)
  const ageBandsInFile = new Set(payload.cells?.map((c: { age_band: string }) => c.age_band) ?? [])
  if (!ageBandsInFile.has('0_14') || !ageBandsInFile.has('15_17')) {
    console.error('Existing acs_cells.json has outdated age bands (missing 0_14 or 15_17).')
    console.error('The app requires the updated age band structure. Falling back to placeholder generation.')
    return null // Force fallback to placeholder or fail
  }
  
  console.warn('Using existing data/derived/acs_cells.json because ACS API is unreachable.')
  payload.meta.generatedAt = new Date().toISOString()
  payload.meta.note = 'Reused existing ACS cells because ACS API fetch failed.'
  writePayload(payload)
  return payload
}

const fallbackFromPopulationShares = () => {
  const sharesPath = path.resolve(process.cwd(), 'public', 'data', 'populationShares.json')
  if (!fs.existsSync(sharesPath)) return null
  console.warn('Building placeholder ACS cells from public/data/populationShares.json (no API access).')
  const shares = JSON.parse(fs.readFileSync(sharesPath, 'utf8'))
  const regionMap: Record<string, string> = { northeast: 'ne', midwest: 'mw', south: 'so', west: 'we' }
  // Approximate age distribution with split child bands
  // Under-18 is ~22%, split approximately: 0-14 ~18%, 15-17 ~4%
  const ageWeights: Record<AgeBandKey, number> = {
    '0_14': 0.18,
    '15_17': 0.04,
    '18_24': 0.10,
    '25_34': 0.13,
    '35_44': 0.14,
    '45_54': 0.13,
    '55_64': 0.13,
    '65_plus': 0.15,
  }
  const sexWeights: Record<SexKey, number> = { male: 0.495, female: 0.505 }
  const cells = []
  let total_pop = 0
  for (const [regionKey, stats] of Object.entries(shares.dimensions.region ?? {})) {
    for (const [sex, sexShare] of Object.entries(sexWeights)) {
      for (const [age_band, weight] of Object.entries(ageWeights)) {
        const pop = Math.round((stats as any).count * sexShare * weight)
        const cell_id = `${regionMap[regionKey as RegionKey]}_${sex}_${age_band}`
        cells.push({ cell_id, region: regionKey, sex, age_band, pop })
        total_pop += pop
      }
    }
  }
  const payload = {
    meta: {
      year: shares.meta?.year ?? Number(year),
      source: shares.meta?.source ?? 'ACS 1-year',
      table: 'B01001',
      generatedAt: new Date().toISOString(),
      universe: 'all_ages',
      note: 'Placeholder split using populationShares.json because ACS API was unreachable.',
    },
    total_pop,
    cells,
  }
  writePayload(payload)
  return payload
}

const run = async () => {
  console.log(`Building ACS cell backbone for year ${year}...`)
  const requestedFields = new Set<string>(['NAME'])

  Object.values(ageBands).forEach((bands) => {
    Object.values(bands).forEach((codes) => codes.forEach((code) => requestedFields.add(code)))
  })

  try {
    const url = withKey(`${base}?get=${Array.from(requestedFields).join(',')}&for=region:*`)
    const rows = await fetchCensus(url)
    const [header, ...dataRows] = rows
    const index: Record<string, number> = header.reduce((acc, key, idx) => {
      acc[key] = idx
      return acc
    }, {} as Record<string, number>)

    const cells: Array<{
      cell_id: string
      region: RegionKey
      sex: SexKey
      age_band: AgeBandKey
      pop: number
    }> = []

    let total_pop = 0

    dataRows.forEach((row) => {
      const regionCode = row[index.region]
      const regionKey = regionCodeToKey[regionCode]
      if (!regionKey) return

      ;(['male', 'female'] as SexKey[]).forEach((sex) => {
        ;(Object.keys(ageBands[sex]) as AgeBandKey[]).forEach((band) => {
          const pop = sumCodes(row, index, ageBands[sex][band])
          const cell_id = buildCellId(regionKey, sex, band)
          cells.push({ cell_id, region: regionKey, sex, age_band: band, pop })
          total_pop += pop
        })
      })
    })

    // Validate total_pop vs sum of cells
    const summedPop = cells.reduce((sum, cell) => sum + cell.pop, 0)
    if (Math.abs(summedPop - total_pop) > 1) {
      console.warn(`total_pop mismatch: computed ${total_pop}, sum of cells ${summedPop}. Using sum.`)
      total_pop = summedPop
    }

    const payload = {
      meta: {
        year: Number(year),
        source: 'ACS 1-year',
        table: 'B01001',
        generatedAt: new Date().toISOString(),
        universe: 'all_ages',
      },
      total_pop,
      cells,
    }

    writePayload(payload)
    console.log(`Wrote ${cells.length} cells (all ages) to data/derived/acs_cells.json`)
    return
  } catch (err) {
    console.error(err)
    const reused = fallbackFromExisting() ?? fallbackFromPopulationShares()
    if (!reused) {
      throw new Error('Unable to build ACS cells: ACS API failed and no fallback data found.')
    }
  }
}

run().catch((err) => {
  console.error('Failed to build ACS cells', err)
  process.exit(1)
})
