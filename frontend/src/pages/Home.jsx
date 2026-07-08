import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchProjects, fetchResources, fetchSiteConfig } from "../api";
import { availableTypeFilters, filterByType, hasPoolResources } from "../filters";
import { useAuth } from "../context/AuthContext";
import ResourceTile from "../components/ResourceTile";
import ProjectCard from "../components/ProjectCard";
import Filters from "../components/Filters";

const PUBLIC_TILES = [
  { to:"/resources",          mark:"All", label:"Browse all",   color:"#46556e", bg:"#eef1f6" },
  { to:"/resources?type=alg", mark:"A",   label:"Algorithms",   color:"#0054A6", bg:"#e6f1fb" },
  { to:"/resources?type=job", mark:"J",   label:"Job Aids",     color:"#0f6e56", bg:"#e1f5ee" },
  { to:"/resources?type=vid", mark:"V",   label:"Videos",       color:"#46556e", bg:"#eef1f6" },
  { to:"/resources?type=pool",mark:"P",   label:"Pool Tests",   color:"#8a5410", bg:"#faeeda" },
];
const ADMIN_TILE = { to:"/manage", mark:"Mg", label:"Admin Panel", color:"#0f172a", bg:"#334155", isAdmin:true };

export default function Home() {
  const { user }        = useAuth();
  const [projects, setProjects]   = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [type, setType]           = useState("all");
  const [q, setQ]                 = useState("");
  const [homeCount, setHomeCount] = useState(6);
  const navigate                  = useNavigate();

  // Hide the "Pool Tests" quick link until pool resources actually exist.
  const tiles = useMemo(() => {
    const base = hasPoolResources(resources)
      ? PUBLIC_TILES
      : PUBLIC_TILES.filter((t) => t.label !== "Pool Tests");
    return user?.role === "admin" ? [...base, ADMIN_TILE] : base;
  }, [user, resources]);

  // Projects are staff-only — only fetch them for logged-in users.
  useEffect(() => {
    if (!user) { setProjects([]); return; }
    fetchProjects().then(setProjects).catch(console.error);
  }, [user]);
  useEffect(() => {
    fetchSiteConfig().then((c) => setHomeCount(c.home_projects_count)).catch(() => {});
  }, []);
  // Fetch everything once; type pills + filtering are derived client-side.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchResources({})
      .then((data) => { if (!cancelled) setResources(data); })
      .catch(() => { if (!cancelled) setError("Couldn't load resources. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const typeFilters = useMemo(() => availableTypeFilters(resources), [resources]);
  const filtered = useMemo(() => filterByType(resources, type), [resources, type]);

  return (
    <>
      {/* ── Hero ── */}
      <section className="hero-anim" aria-label="CHPR Resources Hub">

        {/* Foreground — centered content */}
        <div className="hero-fg">
          <h1 className="hero-anim-title">
            Advancing Health <span className="hero-anim-title-accent">Together</span>
          </h1>

          <div className="hero-search hero-anim-search">
            <svg className="hero-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search resources, protocols, materials…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && q.trim() && navigate(`/resources?search=${encodeURIComponent(q.trim())}`)}
            />
            <button className="hero-search-btn" onClick={() => q.trim() && navigate(`/resources?search=${encodeURIComponent(q.trim())}`)}>
              Search
            </button>
          </div>

          <div className="hero-tiles">
            {tiles.map(tile => (
              <Link
                key={tile.label}
                to={tile.to}
                className={"hero-tile" + (tile.isAdmin ? " hero-tile-admin" : "")}
                style={{ "--tile-color": tile.color, "--tile-bg": tile.bg }}
              >
                <span className="hero-tile-mark">{tile.mark}</span>
                <span className="hero-tile-label">{tile.label}</span>
              </Link>
            ))}
          </div>
        </div>

      </section>

      {/* ── Main content ── */}
      <main className="main">
        {/* Projects are visible to logged-in staff only. */}
        {user && (
          <>
            <div className="section-header">
              <div>
                <span className="section-eyebrow">Active programmes</span>
                <h2 className="section-title">Projects</h2>
              </div>
              {projects.length > homeCount && (
                <Link to="/projects" className="section-link">View all projects →</Link>
              )}
            </div>

            <div className="projects-grid">
              {projects.slice(0, homeCount).map((p) => (
                <ProjectCard key={p.slug} project={p} />
              ))}
            </div>

            <div className="divider" />
          </>
        )}

        <div className="section-header">
          <div>
            <span className="section-eyebrow">Latest</span>
            <h2 className="section-title">Recently added resources</h2>
          </div>
          <Link to="/resources" className="section-link">See all →</Link>
        </div>

        <Filters label="Filter:" options={typeFilters} value={type} onChange={setType} />

        <div className="resource-panel">
          <div className="resource-panel-header">
            <h3>All resources</h3>
            {!loading && !error && (
              <span>{filtered.length} resource{filtered.length !== 1 ? "s" : ""}</span>
            )}
          </div>
          {loading ? (
            <div className="resources-grid" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="resource-tile tile-skeleton" aria-hidden="true">
                  <div className="tile-thumb tile-thumb-skel" />
                  <div className="tile-body">
                    <div className="skel-line skel-badge" />
                    <div className="skel-line" />
                    <div className="skel-line short" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="empty-state"><p>{error}</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>No resources found.</p></div>
          ) : (
            <div className="resources-grid">
              {filtered.slice(0, 8).map(r => (
                <ResourceTile key={r.id} resource={r} showProject={!!user} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
