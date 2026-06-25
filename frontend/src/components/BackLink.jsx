import { Link } from "react-router-dom";

// A small pill "back" button with an arrow icon, used across detail/list pages.
export default function BackLink({ to = "/", children = "Back to Hub" }) {
  return (
    <Link to={to} className="back-link">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M12.5 15l-5-5 5-5" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </Link>
  );
}
