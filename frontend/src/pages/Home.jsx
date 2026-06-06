/**
 * Home page — updated for auth.
 *
 * The "+ Add resource" quick-access tile is now hidden for visitors who are
 * not logged in (they'd just get redirected to /login anyway). Everything
 * else is identical to the original.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchProjects, fetchResources } from "../api";
import { TYPE_FILTERS } from "../constants";
import { useAuth } from "../context/AuthContext";
import ResourceTile from "../components/ResourceTile";
import Filters from "../components/Filters";

// Static navigation shortcuts — Add Resource tile is conditionally rendered.
const PUBLIC_TILES = [
  { to: "/resources",        mark: "All",  label: "Browse all",  color: "#46556e", bg: "#eef1f6" },
  { to: "/resources?type=alg", mark: "Alg", label: "Algorithms",  color: "#0054A6", bg: "#e6f1fb" },
  { to: "/resources?type=job", mark: "Job", label: "Job Aids",    color: "#0f6e56", bg: "#e1f5ee" },
  { to: "/resources?type=vid", mark: "Vid", label: "Videos",      color: "#46556e", bg: "#eef1f6" },
  { to: "/resources?type=pool",mark: "Pool","label": "Pool Tests", color: "#8a5410", bg: "#faeeda" },
];

const ADD_TILE = {
  to: "/resources/new", mark: "+", label: "Add resource", color: "#0f6e56", bg: "#e1f5ee",
};

export default function Home() {
  const { user }       = useAuth();
  const [projects, setProjects] = useState([]);
  const [resources, setResources] = useState([]);
  const [type, setType] = useState("all");
  const [q, setQ]       = useState("");
  const navigate        = useNavigate();

  // Inject the Add Resource tile only when authenticated.
  const tiles = useMemo(
    () => (user ? [PUBLIC_TILES[0], ADD_TILE, ...PUBLIC_TILES.slice(1)] : PUBLIC_TILES),
    [user],
  );

  useEffect(() => {
    fetchProjects().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    fetchResources(type === "pool" ? { type: "pool" } : { type }).then(setResources).catch(console.error);
  }, [type]);

  return (
    <>
      <section className="hero-minimal">
        <div className="hero-minimal-inner">
          <div className="hero-search">
            <svg className="hero-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search resources, projects, or material types…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && q.trim() &&
                navigate(`/resources?search=${encodeURIComponent(q.trim())}`)
              }
            />
            <button
              className="hero-search-btn"
              onClick={() =>
                q.trim() && navigate(`/resources?search=${encodeURIComponent(q.trim())}`)
              }
            >
              Search
            </button>
          </div>

          <div className="hero-tiles">
            {tiles.map((tile) => (
              <Link
                key={tile.label}
                to={tile.to}
                className="hero-tile"
                style={{ "--tile-color": tile.color, "--tile-bg": tile.bg }}
              >
                <span className="hero-tile-mark">{tile.mark}</span>
                <span className="hero-tile-label">{tile.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <main className="main">
        <div className="section-header">
          <div>
            <span className="section-eyebrow">Active programmes</span>
            <h2 className="section-title">Projects</h2>
          </div>
          <Link to="/resources" className="section-link">View all resources →</Link>
        </div>

        <div className="projects-grid">
          {projects.map((p) => (
            <Link
              key={p.slug}
              to={`/projects/${p.slug}`}
              className="project-card"
              style={{ "--card-accent": p.color, "--card-accent-light": p.light_color }}
            >
              <div className="project-card-top">
                <span className="project-card-mark">
                  {p.short_name?.slice(0, 2).toUpperCase() || p.name.slice(0, 2).toUpperCase()}
                </span>
                <span className={`badge badge-${p.status === "completed" ? "completed" : "active"}`}>
                  {p.status_display || p.status}
                </span>
              </div>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <div className="project-meta">
                <span className="project-count">
                  {p.resource_count} resource{p.resource_count !== 1 ? "s" : ""}
                </span>
                <span className="project-arrow" aria-hidden="true">→</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="divider" />

        <div className="section-header">
          <div>
            <span className="section-eyebrow">Latest</span>
            <h2 className="section-title">Recently added resources</h2>
          </div>
          <Link to="/resources" className="section-link">See all →</Link>
        </div>

        <Filters label="Filter:" options={TYPE_FILTERS} value={type} onChange={setType} />

        <div className="resource-panel">
          <div className="resource-panel-header">
            <h3>All resources</h3>
            <span>
              {resources.length} resource{resources.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="resources-grid">
            {resources.slice(0, 8).map((r) => (
              <ResourceTile key={r.id} resource={r} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
