// A row of single-select filter buttons, reusing the mockup's .filter-bar styles.
export default function Filters({ label, options, value, onChange }) {
  return (
    <div className="filter-bar">
      {label && <span className="filter-label">{label}</span>}
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`filter-btn ${value === opt.value ? "active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
