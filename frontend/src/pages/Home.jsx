import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchProjects, fetchResources } from "../api";
import { TYPE_FILTERS } from "../constants";
import { useAuth } from "../context/AuthContext";
import ResourceTile from "../components/ResourceTile";
import Filters from "../components/Filters";

const PUBLIC_TILES = [
  { to:"/resources",          mark:"All", label:"Browse all",   color:"#46556e", bg:"#eef1f6" },
  { to:"/resources?type=alg", mark:"A",   label:"Algorithms",   color:"#0054A6", bg:"#e6f1fb" },
  { to:"/resources?type=job", mark:"J",   label:"Job Aids",     color:"#0f6e56", bg:"#e1f5ee" },
  { to:"/resources?type=vid", mark:"V",   label:"Videos",       color:"#46556e", bg:"#eef1f6" },
  { to:"/resources?type=pool",mark:"P",   label:"Pool Tests",   color:"#8a5410", bg:"#faeeda" },
];
const ADMIN_TILE = { to:"/manage", mark:"Mg", label:"Admin Panel", color:"#0f172a", bg:"#334155", isAdmin:true };

// TB education info-cards — monogram + title + description; duplicated in JSX for seamless loop
const TICKER_TOP = [
  { icon:"CC", title:"Cover your cough",     desc:"Use your inner elbow to block respiratory droplets from spreading." },
  { icon:"WM", title:"Wear a mask",           desc:"Essential in crowded or poorly ventilated indoor spaces." },
  { icon:"IV", title:"Improve ventilation",   desc:"Open windows and doors — fresh air dilutes airborne TB bacteria." },
  { icon:"SC", title:"Sputum collection",     desc:"Collect early morning on an empty stomach for the best sample." },
  { icon:"CT", title:"Complete treatment",    desc:"Never stop TB medication early — it prevents dangerous resistance." },
  { icon:"IW", title:"Isolate when ill",      desc:"Stay home and wear a mask until you are no longer infectious." },
  { icon:"KS", title:"Know the symptoms",     desc:"Persistent cough, night sweats, fever, unexplained weight loss." },
  { icon:"KY", title:"Know your status",      desc:"Early testing leads to early treatment and full recovery." },
];
const TICKER_BOTTOM = [
  { icon:"ED", title:"Early diagnosis",       desc:"Getting tested quickly saves lives — TB is curable when caught early." },
  { icon:"BG", title:"BCG vaccination",       desc:"Protects infants and children against severe forms of tuberculosis." },
  { icon:"FP", title:"Follow your plan",      desc:"Take every prescribed dose daily — consistency is the key to cure." },
  { icon:"NM", title:"Nutrition matters",     desc:"A healthy, balanced diet helps your immune system fight TB faster." },
  { icon:"SC", title:"See a clinician",       desc:"Don't wait — consult a healthcare worker for any cough over 2 weeks." },
  { icon:"TC", title:"TB is curable",         desc:"With proper treatment 95% of TB patients make a full recovery." },
  { icon:"GX", title:"GeneXpert testing",     desc:"Rapid molecular test detects TB and drug resistance in under 2 hours." },
  { icon:"ET", title:"End TB together",       desc:"Community awareness and action are the key to eliminating tuberculosis." },
];

export default function Home() {
  const { user }        = useAuth();
  const [projects, setProjects]   = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [type, setType]           = useState("all");
  const [q, setQ]                 = useState("");
  const navigate                  = useNavigate();

  const tiles = useMemo(
    () => user?.role === "admin" ? [...PUBLIC_TILES, ADMIN_TILE] : PUBLIC_TILES,
    [user],
  );

  useEffect(() => { fetchProjects().then(setProjects).catch(console.error); }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchResources(type === "pool" ? { type:"pool" } : { type })
      .then((data) => { if (!cancelled) setResources(data); })
      .catch(() => { if (!cancelled) setError("Couldn't load resources. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type]);

  return (
    <>
      {/* ── Hero ── */}
      <section className="hero-anim" aria-label="CHPR Resources Hub">

        {/* Background — slow continuous scroll along the bottom */}
        <div className="hero-bg-anim" aria-hidden="true">
          <div className="hero-ticker">
            <div className="hero-ticker-track">
              {[...TICKER_BOTTOM, ...TICKER_BOTTOM].map((item, i) => (
                <div key={i} className="htic-card">
                  <div className="htic-icon-wrap">
                    <span className="htic-monogram">{item.icon}</span>
                  </div>
                  <div className="htic-info">
                    <div className="htic-title">{item.title}</div>
                    <div className="htic-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

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
        <div className="section-header">
          <div>
            <span className="section-eyebrow">Active programmes</span>
            <h2 className="section-title">Projects</h2>
          </div>
          <Link to="/resources" className="section-link">View all resources →</Link>
        </div>

        <div className="projects-grid">
          {projects.map(p => (
            <Link
              key={p.slug}
              to={`/projects/${p.slug}`}
              className="project-card"
              style={{ "--card-accent": p.color, "--card-accent-light": p.light_color }}
            >
              <div className="project-card-top">
                <span className="project-card-mark">
                  {p.short_name?.slice(0,2).toUpperCase() || p.name.slice(0,2).toUpperCase()}
                </span>
                <span className={`badge badge-${p.status === "completed" ? "completed" : "active"}`}>
                  {p.status_display || p.status}
                </span>
              </div>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <div className="project-meta">
                <span className="project-count">{p.resource_count} resource{p.resource_count !== 1 ? "s" : ""}</span>
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
            {!loading && !error && (
              <span>{resources.length} resource{resources.length !== 1 ? "s" : ""}</span>
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
          ) : resources.length === 0 ? (
            <div className="empty-state"><p>No resources found.</p></div>
          ) : (
            <div className="resources-grid">
              {resources.slice(0, 8).map(r => (
                <ResourceTile key={r.id} resource={r} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
