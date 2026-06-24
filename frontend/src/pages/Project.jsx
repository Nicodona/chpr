import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchProject, fetchResources } from "../api";
import { TYPE_FILTERS } from "../constants";
import ResourceTile from "../components/ResourceTile";
import Filters from "../components/Filters";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 12;

export default function Project() {
  const { slug } = useParams();
  const [project, setProject] = useState(null);
  const [projectError, setProjectError] = useState("");
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const panelRef = useRef(null);

  useEffect(() => {
    fetchProject(slug)
      .then(setProject)
      .catch(() => setProjectError("Couldn't load this project."));
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPage(1);
    fetchResources({ project: slug, type })
      .then((data) => { if (!cancelled) setResources(data); })
      .catch(() => { if (!cancelled) setError("Couldn't load resources. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, type]);

  if (projectError) {
    return (
      <main className="main">
        <Link to="/" className="back-link">← Back to Hub</Link>
        <div className="empty-state" style={{ marginTop: "1rem" }}><p>{projectError}</p></div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="main">
        <Link to="/" className="back-link">← Back to Hub</Link>
        <p style={{ marginTop: "1rem" }}>Loading…</p>
      </main>
    );
  }

  const pageCount = Math.ceil(resources.length / PAGE_SIZE);
  const shown = resources.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  function goToPage(p) {
    setPage(p);
    if (panelRef.current) panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="main">
      <Link to="/" className="back-link">← Back to Hub</Link>

      <div className="project-hero">
        <div className="project-hero-info">
          <h1>{project.name}</h1>
          <p>{project.description}</p>
          <div className="project-hero-meta">
            <span className={`badge badge-${project.status === "completed" ? "completed" : "active"}`}>
              {project.status_display || project.status}
            </span>
            <span className="badge badge-primary">CHPR</span>
          </div>
        </div>
      </div>

      <div className="section-header">
        <h2 className="section-title">Resources</h2>
      </div>

      <Filters label="Filter by type:" options={TYPE_FILTERS} value={type} onChange={setType} />

      <div className="resource-panel" ref={panelRef}>
        <div className="resource-panel-header">
          <h3>{project.name} Resources</h3>
          {!loading && !error && (
            <span>{resources.length} resource{resources.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        {loading ? (
          <div className="resources-grid" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
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
          <>
            <div className="resources-grid">
              {shown.map((r) => (
                <ResourceTile key={r.id} resource={r} showProject={false} />
              ))}
            </div>
            <Pagination page={page} pageCount={pageCount} onChange={goToPage} />
          </>
        )}
      </div>
    </main>
  );
}
