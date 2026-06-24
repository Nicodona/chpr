import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchProjects, fetchResources } from "../api";
import { TYPE_FILTERS } from "../constants";
import ResourceTile from "../components/ResourceTile";
import Filters from "../components/Filters";

const PAGE_SIZE = 12;

export default function AllResources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const type = searchParams.get("type") || "all";
  const project = searchParams.get("project") || "all";
  const search = searchParams.get("search") || "";

  const projectFilters = useMemo(
    () => [{ value: "all", label: "All projects" }, ...projects.map((p) => ({ value: p.slug, label: p.short_name || p.name }))],
    [projects]
  );

  useEffect(() => {
    fetchProjects().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setVisible(PAGE_SIZE);
    fetchResources({ type, project, search })
      .then((data) => { if (!cancelled) setResources(data); })
      .catch(() => { if (!cancelled) setError("Couldn't load resources. Please check your connection and try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type, project, search]);

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  const shown = resources.slice(0, visible);

  return (
    <main className="main">
      <Link to="/" className="back-link">← Back to Hub</Link>

      <div className="section-header">
        <h2 className="section-title">All Resources</h2>
      </div>

      <Filters options={TYPE_FILTERS} value={type} onChange={(v) => setParam("type", v)} />
      <Filters options={projectFilters} value={project} onChange={(v) => setParam("project", v)} />

      <div className="resource-panel">
        <div className="resource-panel-header">
          <h3>{search ? `Results for “${search}”` : "All Resources"}</h3>
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
          <div className="empty-state">
            <p>{error}</p>
            <button className="btn-primary" onClick={() => setParam("_r", String(Date.now()))}>Retry</button>
          </div>
        ) : resources.length === 0 ? (
          <div className="empty-state"><p>No resources found.</p></div>
        ) : (
          <>
            <div className="resources-grid">
              {shown.map((r) => (
                <ResourceTile key={r.id} resource={r} />
              ))}
            </div>
            {visible < resources.length && (
              <div className="load-more-wrap">
                <button className="btn-load-more" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Load more ({resources.length - visible} more)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
