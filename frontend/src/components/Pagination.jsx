// Numbered pagination: « 1 2 … 5 6 7 … 12 »
// `page` is 1-indexed. Renders nothing for a single page.
export default function Pagination({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;

  const win = 1; // how many pages to show on each side of the current one
  const items = [];
  let last = 0;
  for (let i = 1; i <= pageCount; i++) {
    const edge = i === 1 || i === pageCount;
    const near = i >= page - win && i <= page + win;
    if (edge || near) {
      if (last && i - last > 1) items.push({ gap: true, key: `gap-${i}` });
      items.push({ n: i, key: i });
      last = i;
    }
  }

  const go = (n) => {
    if (n < 1 || n > pageCount || n === page) return;
    onChange(n);
  };

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        className="page-btn page-nav"
        onClick={() => go(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        ‹
      </button>
      {items.map((it) =>
        it.gap ? (
          <span key={it.key} className="page-ellipsis" aria-hidden="true">…</span>
        ) : (
          <button
            key={it.key}
            className={"page-btn" + (it.n === page ? " page-btn-active" : "")}
            onClick={() => go(it.n)}
            aria-current={it.n === page ? "page" : undefined}
            aria-label={`Page ${it.n}`}
          >
            {it.n}
          </button>
        )
      )}
      <button
        className="page-btn page-nav"
        onClick={() => go(page + 1)}
        disabled={page === pageCount}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
}
