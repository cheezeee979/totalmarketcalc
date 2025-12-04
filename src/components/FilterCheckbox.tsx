type Props = {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export const FilterCheckbox = ({ id, label, description, checked, onChange }: Props) => (
  <label
    htmlFor={id}
    className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-2 py-2 transition hover:border-brand-200 hover:bg-brand-50"
  >
    <input
      id={id}
      type="checkbox"
      className="mt-1 size-4 rounded border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-white"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <div>
      <div className="text-sm font-medium text-slate-900">{label}</div>
      {description ? <p className="text-xs text-slate-600">{description}</p> : null}
    </div>
  </label>
)
