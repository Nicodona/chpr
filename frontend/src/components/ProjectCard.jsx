import { Link } from "react-router-dom";

// A single project card. When the project has a logo it shows faintly behind
// the content as a watermark (the low opacity is the "overlay" that keeps the
// text on top readable).
export default function ProjectCard({ project: p }) {
  const initials = (p.short_name || p.name || "").slice(0, 2).toUpperCase();
  return (
    <Link
      to={`/projects/${p.slug}`}
      className={"project-card" + (p.logo_url ? " has-logo" : "")}
      style={{ "--card-accent": p.color, "--card-accent-light": p.light_color }}
    >
      {p.logo_url && (
        <span
          className="project-card-logo"
          aria-hidden="true"
          style={{ backgroundImage: `url(${p.logo_url})` }}
        />
      )}
      <div className="project-card-body">
        <div className="project-card-top">
          <span className="project-card-mark">{initials}</span>
          <span className={`badge badge-${p.status === "completed" ? "completed" : "active"}`}>
            {p.status_display || p.status}
          </span>
        </div>
        <h3>{p.name}</h3>
        {p.description && <p>{p.description}</p>}
        <div className="project-meta">
          <span className="project-count">
            {p.resource_count} resource{p.resource_count !== 1 ? "s" : ""}
          </span>
          <span className="project-arrow" aria-hidden="true">→</span>
        </div>
      </div>
    </Link>
  );
}
