import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'

type ApiRow = Array<string>

const year = process.env.CENSUS_YEAR ?? '2024'
const apiKey = process.env.CENSUS_API_KEY
const base = `https://api.census.gov/data/${year}/acs/acs1`
const profileBase = `https://api.census.gov/data/${year}/acs/acs1/profile`

const fetchCensus = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Request failed: ${res.status} ${res.statusText} – ${text}`)
  }
  return (await res.json()) as ApiRow[]
}

const withKey = (url: string) => (apiKey ? `${url}&key=${apiKey}` : url)

const parseNumber = (value: string | undefined) => Number(value ?? 0)

const run = async () => {
  console.log(`Fetching ACS ${year} data...`)

  const totalUrl = withKey(`${base}?get=B01003_001E&for=us:1`)
  const sexUrl = withKey(`${base}?get=B01001_001E,B01001_002E,B01001_026E&for=us:1`)
  const raceUrl = withKey(`${base}?get=B02001_001E,B02001_002E,B02001_003E,B02001_005E&for=us:1`)
  const regionUrl = withKey(`${base}?get=B01003_001E&for=region:*`)
  const employmentUrl = withKey(
    `${profileBase}?get=DP03_0001E,DP03_0004E,DP03_0005E,DP03_0007E&for=us:1`,
  )

  const [totalRows, sexRows, raceRows, regionRows, employmentRows] = await Promise.all([
    fetchCensus(totalUrl),
    fetchCensus(sexUrl),
    fetchCensus(raceUrl),
    fetchCensus(regionUrl),
    fetchCensus(employmentUrl),
  ])

  const totalPopulation = parseNumber(totalRows[1]?.[0])

  const maleCount = parseNumber(sexRows[1]?.[1])
  const femaleCount = parseNumber(sexRows[1]?.[2])

  const raceTotal = parseNumber(raceRows[1]?.[0])
  const whiteCount = parseNumber(raceRows[1]?.[1])
  const blackCount = parseNumber(raceRows[1]?.[2])
  const asianCount = parseNumber(raceRows[1]?.[3])
  const otherRaceCount = Math.max(raceTotal - whiteCount - blackCount - asianCount, 0)

  const regionCodeToKey: Record<string, 'northeast' | 'midwest' | 'south' | 'west'> = {
    '1': 'northeast',
    '2': 'midwest',
    '3': 'south',
    '4': 'west',
  }

  const regionCounts = regionRows.slice(1).reduce<Record<string, number>>((acc, row) => {
    const regionKey = regionCodeToKey[row[1]]
    if (regionKey) acc[regionKey] = parseNumber(row[0])
    return acc
  }, {})

  const employedCount = parseNumber(employmentRows[1]?.[1])
  const unemployedCount = parseNumber(employmentRows[1]?.[2])
  const notInLaborCount = parseNumber(employmentRows[1]?.[3])

  const share = (value: number) => (totalPopulation ? value / totalPopulation : 0)

  const dataset = {
    meta: {
      year: Number(year),
      source: 'ACS 1-year',
      generatedAt: new Date().toISOString(),
    },
    totalPopulation,
    dimensions: {
      sex: {
        male: { count: maleCount, share: share(maleCount) },
        female: { count: femaleCount, share: share(femaleCount) },
      },
      race: {
        white: { count: whiteCount, share: share(whiteCount) },
        black: { count: blackCount, share: share(blackCount) },
        asian: { count: asianCount, share: share(asianCount) },
        other: { count: otherRaceCount, share: share(otherRaceCount) },
      },
      region: {
        northeast: { count: regionCounts.northeast ?? 0, share: share(regionCounts.northeast ?? 0) },
        midwest: { count: regionCounts.midwest ?? 0, share: share(regionCounts.midwest ?? 0) },
        south: { count: regionCounts.south ?? 0, share: share(regionCounts.south ?? 0) },
        west: { count: regionCounts.west ?? 0, share: share(regionCounts.west ?? 0) },
      },
      employment: {
        employed: { count: employedCount, share: share(employedCount) },
        unemployed: { count: unemployedCount, share: share(unemployedCount) },
        notInLabor: { count: notInLaborCount, share: share(notInLaborCount) },
      },
    },
  }

  const outputPath = path.resolve(process.cwd(), 'public', 'data', 'populationShares.json')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')

  console.log(`Saved dataset to ${outputPath}`)
}

run().catch((err) => {
  console.error('Failed to fetch Census data', err)
  process.exit(1)
})
