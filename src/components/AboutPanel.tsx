type Props = {
  year: number
  generatedAt: string
}

export const AboutPanel = ({ year, generatedAt }: Props) => (
  <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
    <h3 className="text-lg font-semibold text-slate-900">About the data</h3>
    <div className="mt-3 space-y-3 text-sm text-slate-700">
      <p>
        Estimates are based on U.S. Census Bureau American Community Survey (ACS) {year} 1-year
        tables. Counts are cached at build time; no personal data is collected.
      </p>
      <ul className="list-disc space-y-1 pl-4">
        <li>Totals: B01003 (Total population), B01001 (Sex by age), B02001 (Race).</li>
        <li>Regions: B01003 grouped by Census region codes 1–4.</li>
        <li>Employment: DP03 (Selected Economic Characteristics), shown as a share of total pop.</li>
        <li>
          Calculation assumes independence between dimensions. Multi-selects within a dimension are
          treated as a union.
        </li>
        <li>
          Employment status is defined for people 16+; here it is scaled to the total population for
          a consistent base.
        </li>
      </ul>
      <p className="text-xs text-slate-500">
        Data snapshot generated at {new Date(generatedAt).toLocaleString('en-US')}. Numbers are
        approximate and intended for exploratory use only.
      </p>
      <div className="flex flex-wrap gap-3 text-xs text-brand-800">
        <a
          className="underline decoration-2 underline-offset-4 hover:text-brand-900"
          href="https://www.census.gov/data/developers/data-sets/acs-1year.html"
          target="_blank"
          rel="noreferrer"
        >
          ACS 1-year
        </a>
        <a
          className="underline decoration-2 underline-offset-4 hover:text-brand-900"
          href="https://api.census.gov/data/2024/acs/acs1.html"
          target="_blank"
          rel="noreferrer"
        >
          ACS API reference
        </a>
        <a
          className="underline decoration-2 underline-offset-4 hover:text-brand-900"
          href="https://api.census.gov/data/2024/acs/acs1/profile.html"
          target="_blank"
          rel="noreferrer"
        >
          DP03 profile
        </a>
      </div>
    </div>
  </section>
)
