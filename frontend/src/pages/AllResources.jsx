import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchProjects, fetchResources } from "../api";
import { availableTypeFilters, filterByType } from "../filters";
import ResourceTile from "../components/ResourceTile";
import Filters from "../components/Filters";
import Pagination from "../components/Pagination";
import BackLink from "../components/BackLink";

const PAGE_SIZE = 12;

export default function AllResources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

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

  // Fetch without the type filter so the type pills reflect what's available
  // and switching type is instant (client-side); re-fetch only on project/search.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchResources({ project, search })
      .then((data) => { if (!cancelled) setResources(data); })
      .catch(() => { if (!cancelled) setError("Couldn't load resources. Please check your connection and try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project, search]);

  // Reset to page 1 whenever the active type changes.
  useEffect(() => { setPage(1); }, [type]);

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  const typeFilters = useMemo(() => availableTypeFilters(resources), [resources]);
  const filtered = useMemo(() => filterByType(resources, type), [resources, type]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const panelRef = useRef(null);
  function goToPage(p) {
    setPage(p);
    if (panelRef.current) panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="main">
      <BackLink />

      <div className="section-header">
        <h2 className="section-title">All Resources</h2>
      </div>

      <Filters options={typeFilters} value={type} onChange={(v) => setParam("type", v)} />
      <Filters options={projectFilters} value={project} onChange={(v) => setParam("project", v)} />

      <div className="resource-panel" ref={panelRef}>
        <div className="resource-panel-header">
          <h3>{search ? `Results for “${search}”` : "All Resources"}</h3>
          {!loading && !error && (
            <span>{filtered.length} resource{filtered.length !== 1 ? "s" : ""}</span>
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
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No resources found.</p></div>
        ) : (
          <>
            <div className="resources-grid">
              {shown.map((r) => (
                <ResourceTile key={r.id} resource={r} />
              ))}
            </div>
            <Pagination page={page} pageCount={pageCount} onChange={goToPage} />
          </>
        )}
      </div>
    </main>
  );
}
