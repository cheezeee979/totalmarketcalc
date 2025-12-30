type Props = {
  year: number
  generatedAt: string
}

export const AboutPanel = ({ year, generatedAt }: Props) => (
  <section className="glass gradient-border overflow-hidden rounded-3xl">
    {/* Header */}
    <div className="border-b border-white/5 bg-dark-700/30 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-electric-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-white">About the Data</h3>
          <p className="text-xs text-slate-500">Source: U.S. Census Bureau</p>
        </div>
      </div>
    </div>
    
    {/* Content */}
    <div className="space-y-5 p-6">
      <p className="text-sm leading-relaxed text-slate-300">
        Estimates are based on U.S. Census Bureau American Community Survey (ACS) {year} 1-year
        tables. Counts are cached at build time; no personal data is collected.
      </p>
      
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-accent-400">Data Sources</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          {[
            { label: 'Totals', value: 'B01003 (Total population), B01001 (Sex by age), B02001 (Race)' },
            { label: 'Regions', value: 'B01003 grouped by Census region codes 1–4' },
            { label: 'Employment', value: 'DP03 (Selected Economic Characteristics), shown as share of total pop' },
            { label: 'Age bands', value: 'Aggregated buckets from B01001 (youth, young adult, prime working, older adult, seniors)' },
            { label: 'Children', value: 'DP02 households with own children under 18, scaled to total population' },
          ].map((item) => (
            <li key={item.label} className="flex gap-3 rounded-lg border border-dark-400/50 bg-dark-700/30 p-3">
              <span className="shrink-0 text-xs font-semibold text-slate-300">{item.label}</span>
              <span className="text-slate-500">—</span>
              <span className="text-xs">{item.value}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-glow-400">Methodology</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-glow-500/60" />
            <span>Calculation assumes independence between dimensions. Multi-selects within a dimension are treated as a union.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-glow-500/60" />
            <span>Employment status is defined for people 16+; here it is scaled to the total population for a consistent base.</span>
          </li>
        </ul>
      </div>
      
      {/* Timestamp */}
      <div className="flex items-center gap-2 rounded-xl border border-dark-300 bg-dark-700/50 px-4 py-3 text-xs text-slate-500">
        <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Data snapshot generated at {new Date(generatedAt).toLocaleString('en-US')}</span>
      </div>
      
      {/* External links */}
      <div className="flex flex-wrap gap-3 pt-2">
        {[
          { label: 'ACS 1-year', href: 'https://www.census.gov/data/developers/data-sets/acs-1year.html' },
          { label: 'ACS API reference', href: 'https://api.census.gov/data/2024/acs/acs1.html' },
          { label: 'DP03 profile', href: 'https://api.census.gov/data/2024/acs/acs1/profile.html' },
        ].map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-lg border border-dark-300 bg-dark-600/50 px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-accent-500/50 hover:text-accent-400"
          >
            {link.label}
            <svg className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  </section>
)
