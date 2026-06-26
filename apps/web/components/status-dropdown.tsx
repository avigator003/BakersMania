"use client";

type StatusOption<T extends string> = {
  value: T;
  label: string;
  className: string;
};

export function StatusDropdown<T extends string>({
  value,
  options,
  onChange,
  title = "Change status"
}: {
  value: T;
  options: Array<StatusOption<T>>;
  onChange: (value: T) => void;
  title?: string;
}) {
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <div className="relative inline-flex">
      <select
        aria-label={title}
        className={`focus-ring h-9 min-w-32 appearance-none rounded-full border px-3 pr-8 text-xs font-semibold outline-none ${selected.className}`}
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-current">⌄</span>
    </div>
  );
}
