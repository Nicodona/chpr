import { useLocation, useNavigate } from "react-router-dom";

export default function FAQButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (pathname === "/faq") return null;

  return (
    <button
      className="faq-float-btn"
      onClick={() => navigate("/faq")}
      title="Frequently Asked Questions"
      aria-label="Open FAQ"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
        <circle cx="12" cy="17" r="0.5" fill="currentColor" />
      </svg>
      <span className="faq-float-label">FAQ</span>
    </button>
  );
}
