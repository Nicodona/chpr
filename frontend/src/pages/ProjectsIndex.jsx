import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProjects } from "../api";
import ProjectCard from "../components/ProjectCard";

export default function ProjectsIndex() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchProjects()
      .then((data) => { if (!cancelled) setProjects(data); })
      .catch(() => { if (!cancelled) setError("Couldn't load projects. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="main">
      <Link to="/" className="back-link">← Back to Hub</Link>

      <div className="section-header">
        <div>
          <span className="section-eyebrow">Programmes</span>
          <h2 className="section-title">All Projects</h2>
        </div>
        {!loading && !error && (
          <span className="section-count">{projects.length} project{projects.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {loading ? (
        <div className="projects-grid" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="project-card tile-skeleton" aria-hidden="true">
              <div className="project-card-body">
                <div className="skel-line skel-badge" />
                <div className="skel-line" />
                <div className="skel-line short" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="empty-state"><p>{error}</p></div>
      ) : projects.length === 0 ? (
        <div className="empty-state"><p>No projects yet.</p></div>
      ) : (
        <div className="projects-grid">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      )}
    </main>
  );
}
