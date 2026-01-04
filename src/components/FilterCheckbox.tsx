type Props = {
  id: string
  label: string
  description?: string
  badge?: string
  secondaryBadge?: string
  checked: boolean
  disabled?: boolean
  disabledReason?: string
  onChange: (checked: boolean) => void
  onEnableClick?: () => void
}

export const FilterCheckbox = ({
  id,
  label,
  description,
  badge,
  secondaryBadge,
  checked,
  disabled,
  disabledReason,
  onChange,
  onEnableClick,
}: Props) => (
  <div className="relative group/checkbox">
    <label
      htmlFor={id}
      className={`group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 ${
        disabled
          ? 'cursor-not-allowed border-dark-400/50 bg-dark-700/30 opacity-60'
          : checked
            ? 'cursor-pointer border-accent-500/40 bg-accent-500/10 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
            : 'cursor-pointer border-transparent hover:border-dark-300 hover:bg-dark-600/50'
      }`}
      title={disabled ? disabledReason : undefined}
    >
      <div className="relative mt-0.5 flex items-center">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => !disabled && onChange(e.target.checked)}
        />
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200 ${
            disabled
              ? 'border-dark-400 bg-dark-600'
              : checked
                ? 'border-accent-500 bg-gradient-to-br from-accent-400 to-accent-600 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'border-dark-300 bg-dark-600 group-hover:border-accent-500/50'
          }`}
        >
          <svg
            className={`h-3 w-3 text-white transition-all duration-200 ${
              checked && !disabled ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
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
        <div className="flex flex-wrap items-center gap-2">
          <div className={`text-sm font-medium transition-colors ${
            disabled
              ? 'text-slate-500'
              : checked
                ? 'text-white'
                : 'text-slate-300 group-hover:text-white'
          }`}>
            {label}
          </div>
          {badge ? (
            <span className="rounded-full border border-electric-500/40 bg-electric-500/10 px-2 text-[10px] font-semibold uppercase tracking-wide text-electric-300">
              {badge}
            </span>
          ) : null}
          {secondaryBadge ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 text-[10px] font-medium text-amber-300">
              {secondaryBadge}
            </span>
          ) : null}
        </div>
        {description && (
          <p className={`mt-0.5 truncate text-xs ${disabled ? 'text-slate-600' : 'text-slate-500'}`}>
            {description}
          </p>
        )}
      </div>
      {checked && !disabled && (
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" />
        </div>
      )}
    </label>
    
    {/* Tooltip for disabled state */}
    {disabled && disabledReason && (
      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 opacity-0 transition-opacity group-hover/checkbox:opacity-100">
        <div className="relative rounded-lg border border-dark-300 bg-dark-700 px-3 py-2 text-xs text-slate-300 shadow-xl">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2">
            <div className="h-3 w-3 rotate-45 border-l border-t border-dark-300 bg-dark-700" />
          </div>
          <p className="max-w-[200px] text-center">{disabledReason}</p>
          {onEnableClick && (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onEnableClick()
              }}
              className="pointer-events-auto mt-2 w-full rounded-md bg-accent-500/20 px-2 py-1 text-[10px] font-semibold text-accent-400 hover:bg-accent-500/30"
            >
              Set age to 18+
            </button>
          )}
        </div>
      </div>
    )}
  </div>
)
