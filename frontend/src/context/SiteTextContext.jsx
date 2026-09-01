import { createContext, useContext, useEffect, useState } from "react";
import { fetchSiteText } from "../api";

/**
 * Editable on-site copy, fetched once and read by key with a hardcoded
 * fallback. If the request fails or a key is missing, the fallback is used, so
 * the page never renders blank or breaks.
 */
const SiteTextContext = createContext({ map: {}, ready: false });

export function SiteTextProvider({ children }) {
  const [map, setMap] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSiteText()
      .then((list) => {
        if (!cancelled) {
          setMap(Object.fromEntries((list || []).map((t) => [t.key, t.value])));
        }
      })
      .catch(() => {}) // fall back to hardcoded defaults; never break the UI
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteTextContext.Provider value={{ map, ready }}>
      {children}
    </SiteTextContext.Provider>
  );
}

/** Read an editable string by key, always with a hardcoded fallback. */
export function useSiteText(key, fallback = "") {
  const { map } = useContext(SiteTextContext);
  const v = map[key];
  return v === undefined || v === null ? fallback : v;
}
