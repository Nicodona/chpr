import { useEffect, useRef, useState } from "react";
import { fetchFAQs } from "../api";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function submitContact(fields) {
  const res = await fetch(`${BASE}/api/contact/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? Object.values(err).flat().join(" ") ?? "Submission failed");
  }
  return res.json();
}

function AccordionItem({ faq, isOpen, onToggle }) {
  const bodyRef = useRef(null);
  return (
    <div className={`faq-item${isOpen ? " faq-item-open" : ""}`}>
      <button className="faq-question" onClick={onToggle} aria-expanded={isOpen}>
        <span>{faq.question}</span>
        <span className="faq-chevron" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <polyline points="5 8 10 13 15 8" />
          </svg>
        </span>
      </button>
      <div
        className="faq-answer-wrap"
        ref={bodyRef}
        style={{ maxHeight: isOpen ? bodyRef.current?.scrollHeight + "px" : "0px" }}
      >
        <div className="faq-answer">{faq.answer}</div>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);

  // contact form
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    fetchFAQs()
      .then(setFaqs)
      .catch(() => setError("Could not load FAQs."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = faqs.filter(
    (f) =>
      !search ||
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase())
  );

  async function handleContact(e) {
    e.preventDefault();
    setSending(true);
    setSendError("");
    try {
      await submitContact({ ...form, team: "" });
      setSent(true);
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="faq-page">
      {/* Hero */}
      <section className="faq-hero">
        <div className="faq-hero-inner">
          <div className="faq-hero-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
              <circle cx="24" cy="24" r="22" fill="rgba(255,255,255,0.15)" />
              <text x="24" y="32" textAnchor="middle" fontSize="26" fill="white" fontWeight="700"
                fontFamily="Sora, sans-serif">?</text>
            </svg>
          </div>
          <h1 className="faq-hero-title">Frequently Asked Questions</h1>
          <p className="faq-hero-sub">
            Find answers to the most common questions about the CHPR Resources Hub.
          </p>
          <div className="faq-search-wrap">
            <svg className="faq-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
              strokeWidth="1.8" width="17" height="17" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <line x1="12.5" y1="12.5" x2="17" y2="17" />
            </svg>
            <input
              className="faq-search"
              type="search"
              placeholder="Search questions…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOpenId(null); }}
            />
          </div>
        </div>
      </section>

      {/* FAQ list */}
      <section className="faq-body">
        <div className="faq-container">
          {loading ? (
            <div className="faq-state">
              <div className="faq-spinner" />
              <p>Loading questions…</p>
            </div>
          ) : error ? (
            <div className="faq-state faq-state-error">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="faq-state">
              <svg viewBox="0 0 48 48" fill="none" width="40" height="40" aria-hidden="true">
                <circle cx="24" cy="24" r="20" stroke="var(--border)" strokeWidth="2" />
                <line x1="16" y1="16" x2="32" y2="32" stroke="var(--muted-2)" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="32" y1="16" x2="16" y2="32" stroke="var(--muted-2)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <p>No questions match "<strong>{search}</strong>".</p>
            </div>
          ) : (
            <div className="faq-list">
              {filtered.map((f) => (
                <AccordionItem
                  key={f.id}
                  faq={f}
                  isOpen={openId === f.id}
                  onToggle={() => setOpenId(openId === f.id ? null : f.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact section */}
      <section className="faq-contact-section">
        <div className="faq-container">
          <div className="faq-contact-card">
            <div className="faq-contact-left">
              <div className="faq-contact-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <div>
                <h2 className="faq-contact-title">Still have questions?</h2>
                <p className="faq-contact-sub">
                  Can't find what you're looking for? Send us a message and our team will get back to you.
                </p>
              </div>
            </div>

            {sent ? (
              <div className="faq-sent">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="8 12 11 15 16 9" />
                </svg>
                <p><strong>Message sent!</strong> We'll be in touch soon.</p>
                <button className="faq-sent-btn" onClick={() => setSent(false)}>Send another</button>
              </div>
            ) : (
              <form className="faq-contact-form" onSubmit={handleContact}>
                <div className="faq-form-row">
                  <div className="field">
                    <label className="field-label">Your name</label>
                    <input
                      className="field-input"
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Email address</label>
                    <input
                      className="field-input"
                      type="email"
                      placeholder="jane@example.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Message</label>
                  <textarea
                    className="field-input"
                    rows={4}
                    placeholder="Describe your question or issue…"
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    required
                    style={{ resize: "vertical" }}
                  />
                </div>
                {sendError && <p className="field-error" style={{ display: "block" }}>{sendError}</p>}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn-primary" disabled={sending}>
                    {sending ? "Sending…" : "Send message"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
