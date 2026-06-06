import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchProjects, fetchResources } from "../api";
import { TYPE_FILTERS } from "../constants";
import ResourceTile from "../components/ResourceTile";
import Filters from "../components/Filters";

export default function AllResources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [resources, setResources] = useState([]);

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
    fetchResources({ type, project, search }).then(setResources).catch(console.error);
  }, [type, project, search]);

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

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
          <span>{resources.length} resource{resources.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="resources-grid">
          {resources.map((r) => (
            <ResourceTile key={r.id} resource={r} />
          ))}
        </div>
        {resources.length === 0 && (
          <div className="empty-state"><p>No resources found.</p></div>
        )}
      </div>
    </main>
  );
}
