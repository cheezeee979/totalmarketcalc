type Props = {
  id: string
  label: string
  description?: string
  badge?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export const FilterCheckbox = ({ id, label, description, badge, checked, onChange }: Props) => (
  <label
    htmlFor={id}
    className={`group flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 ${
      checked
        ? 'border-accent-500/40 bg-accent-500/10 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
        : 'border-transparent hover:border-dark-300 hover:bg-dark-600/50'
    }`}
  >
    <div className="relative mt-0.5 flex items-center">
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200 ${
          checked
            ? 'border-accent-500 bg-gradient-to-br from-accent-400 to-accent-600 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
            : 'border-dark-300 bg-dark-600 group-hover:border-accent-500/50'
        }`}
      >
        <svg
          className={`h-3 w-3 text-white transition-all duration-200 ${
            checked ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <div className={`text-sm font-medium transition-colors ${checked ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
          {label}
        </div>
        {badge ? (
          <span className="rounded-full border border-electric-500/40 bg-electric-500/10 px-2 text-[10px] font-semibold uppercase tracking-wide text-electric-300">
            {badge}
          </span>
        ) : null}
      </div>
      {description && (
        <p className="mt-0.5 truncate text-xs text-slate-500">{description}</p>
      )}
    </div>
    {checked && (
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" />
      </div>
    )}
  </label>
)
