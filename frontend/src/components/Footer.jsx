import { useSiteText } from "../context/SiteTextContext";

export default function Footer() {
  const orgName = useSiteText("footer.org_name", "CHPR Resources Hub");
  const orgLine = useSiteText(
    "footer.org_line",
    "Centre for Health Promotion and Research, Bamenda, Cameroon",
  );
  const copyright = useSiteText("footer.copyright", "CHPR. All rights reserved.");

  return (
    <footer className="footer">
      <p>
        <strong>{orgName}</strong> — {orgLine}
      </p>
      <p style={{ marginTop: 6 }}>
        © {new Date().getFullYear()} {copyright}
      </p>
    </footer>
  );
}
