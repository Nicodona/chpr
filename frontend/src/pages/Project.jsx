import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchProject, fetchResources } from "../api";
import { TYPE_FILTERS } from "../constants";
import ResourceTile from "../components/ResourceTile";
import Filters from "../components/Filters";

export default function Project() {
  const { slug } = useParams();
  const [project, setProject] = useState(null);
  const [resources, setResources] = useState([]);
  const [type, setType] = useState("all");

  useEffect(() => {
    fetchProject(slug).then(setProject).catch(console.error);
  }, [slug]);

  useEffect(() => {
    fetchResources({ project: slug, type }).then(setResources).catch(console.error);
  }, [slug, type]);

  if (!project) {
    return (
      <main className="main">
        <Link to="/" className="back-link">← Back to Hub</Link>
        <p style={{ marginTop: "1rem" }}>Loading…</p>
      </main>
    );
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

      <div className="resource-panel">
        <div className="resource-panel-header">
          <h3>{project.name} Resources</h3>
          <span>{resources.length} resource{resources.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="resources-grid">
          {resources.map((r) => (
            <ResourceTile key={r.id} resource={r} showProject={false} />
          ))}
        </div>
        {resources.length === 0 && (
          <div className="empty-state"><p>No resources found.</p></div>
        )}
      </div>
    </main>
  );
}
