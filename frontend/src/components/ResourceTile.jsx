import { TYPE_CLASS, TYPE_LABELS } from "../constants";

// A single resource card. Reuses the mockup's tile classes. If the resource has
// an uploaded file, the card links to it; otherwise it renders a static preview.
export default function ResourceTile({ resource, showProject = true }) {
  const isVideo = resource.type_key === "vid";
  const typeLabel = resource.type_label || TYPE_LABELS[resource.type_key] || resource.type_key;
  const typeClass = TYPE_CLASS[resource.type_key] || "";

  const thumb = isVideo ? (
    <div className="tile-thumb tile-thumb-video">
      <div className="tile-thumb-play" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </div>
      <span className="tile-thumb-tag">VIDEO</span>
    </div>
  ) : (
    <div className="tile-thumb tile-thumb-pdf">
      <div className="tile-doc-page tile-doc-page-fallback">
        <div className="tile-doc-corner"></div>
        <div className="tile-doc-header"></div>
        <div className="tile-doc-line"></div>
        <div className="tile-doc-line short"></div>
        <div className="tile-doc-line"></div>
        <div className="tile-doc-line medium"></div>
      </div>
      <span className="tile-thumb-tag tile-thumb-tag-pdf">FILE</span>
    </div>
  );

  const body = (
    <>
      {thumb}
      <div className="tile-body">
        <span className={`res-type-badge ${typeClass}`}>{typeLabel}</span>
        <h3 className="tile-title">{resource.name}</h3>
        {showProject && <span className="tile-project">{resource.project_name}</span>}
        {resource.description && <p className="tile-desc">{resource.description}</p>}
      </div>
    </>
  );

  if (resource.file_url) {
    return (
      <a href={resource.file_url} target="_blank" rel="noopener" className="resource-tile">
        {body}
      </a>
    );
  }
  return <div className="resource-tile">{body}</div>;
}
