"use client";

import { useEffect, useRef, useState } from "react";
import Lottie from "lottie-react";
import Link from "next/link";

// ✅ FINAL, SIMPLE, STABLE BACKEND URL
const API = "http://127.0.0.1:5000";

const LOTTIE_HERO =
  "https://assets10.lottiefiles.com/packages/lf20_puciaact.json";
const LOTTIE_CONFETTI =
  "https://assets2.lottiefiles.com/packages/lf20_hbr24nzz.json";

function parsePriceToNumber(str) {
  if (!str) return null;
  const s = String(str).replace(/,/g, "");
  const m = s.match(/[\d.]+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

// tiny sparkline for “price history”
function PriceSparkline({ points }) {
  if (!points || points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const norm = points.map((v, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = 90 - ((v - min) / (max - min || 1)) * 70;
    return { x, y };
  });
  const d = norm.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: 60 }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00c6ff" />
          <stop offset="100%" stopColor="#9b7bff" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke="url(#sparkGrad)" strokeWidth="2.5" />
    </svg>
  );
}

export default function DealScopePage() {
  const [heroAnim, setHeroAnim] = useState(null);
  const [confettiAnim, setConfettiAnim] = useState(null);

  useEffect(() => {
    fetch(LOTTIE_HERO)
      .then((r) => r.json())
      .then(setHeroAnim)
      .catch(() => setHeroAnim(null));
    fetch(LOTTIE_CONFETTI)
      .then((r) => r.json())
      .then(setConfettiAnim)
      .catch(() => setConfettiAnim(null));
  }, []);

  // UI state
  const [q, setQ] = useState("");
  const [minDisc, setMinDisc] = useState("Any");
  const [savedOnly, setSavedOnly] = useState(false);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);

  // wishlist & stats
  const [wishlist, setWishlist] = useState([]);
  const [viewCounts, setViewCounts] = useState({});

  // subscribe
  const [watching, setWatching] = useState(null);
  const [method, setMethod] = useState("Email");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const [graphProduct, setGraphProduct] = useState(null);

  const subscribeRef = useRef(null);

  // search history dropdown
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // ---------- Load from localStorage on first render ----------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawWishlist = window.localStorage.getItem("dealscope_wishlist");
      if (rawWishlist) setWishlist(JSON.parse(rawWishlist));

      const rawHist = window.localStorage.getItem("dealscope_search_history");
      if (rawHist) {
        const parsed = JSON.parse(rawHist);
        if (Array.isArray(parsed)) setSearchHistory(parsed);
      }

      const rawResults = window.localStorage.getItem("dealscope_last_results");
      const rawQuery = window.localStorage.getItem("dealscope_last_query");
      const rawMinDisc = window.localStorage.getItem("dealscope_last_minDisc");
      const rawSort = window.localStorage.getItem("dealscope_last_sort");
      const rawSavedOnly = window.localStorage.getItem(
        "dealscope_last_savedOnly",
      );

      if (rawResults) {
        const parsed = JSON.parse(rawResults);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
          setHasSearched(true);
        }
      }
      if (rawQuery) setQ(rawQuery);
      if (rawMinDisc) setMinDisc(rawMinDisc);
      if (rawSort) setSort(rawSort);
      if (rawSavedOnly === "true") setSavedOnly(true);
    } catch {
      // ignore
    }
  }, []);

  // ---------- Persist wishlist & search history ----------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "dealscope_wishlist",
        JSON.stringify(wishlist),
      );
    } catch {}
  }, [wishlist]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "dealscope_search_history",
        JSON.stringify(searchHistory),
      );
    } catch {}
  }, [searchHistory]);

  function isSaved(p) {
    if (!p?.url) return false;
    return wishlist.some((w) => w.url === p.url);
  }

  function toggleSave(p) {
    if (!p?.url) return;
    setWishlist((prev) => {
      const exists = prev.some((w) => w.url === p.url);
      if (exists) return prev.filter((w) => w.url !== p.url);
      const slim = {
        title: p.title,
        url: p.url,
        price_text: p.price_text,
        discount_percent: p.discount_percent,
        site: p.site,
      };
      return [...prev, slim];
    });
  }

  // ---------- Backend call (Flask) ----------
  async function fetchLiveProducts(keyword) {
    try {
      const url = `${API}/api/scrape`;
      console.log("Calling backend:", url);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keyword, max_products: 24 }),
      });

      if (!res.ok) {
        console.error("Backend returned status:", res.status);
        setError(
          "Unable to reach backend. Make sure Flask is running on port 5000.",
        );
        return [];
      }

      const json = await res.json().catch((err) => {
        console.error("JSON parse error:", err);
        return null;
      });

      if (!json) {
        setError("Invalid backend response.");
        return [];
      }

      if (json.success) {
        return json.items || [];
      } else {
        console.error("Backend error:", json.error);
        setError("Backend error: " + (json.error || "Unknown error"));
        return [];
      }
    } catch (err) {
      console.error("Scrape error", err);
      setError("Cannot connect to backend. Ensure Flask server is running.");
      return [];
    }
  }

  // ---------- Loading animation ----------
  useEffect(() => {
    if (!loading) {
      setProgress(0);
      setStageText("");
      return;
    }

    const stages = [
      "Checking Amazon…",
      "Checking Flipkart…",
      "Checking Nykaa…",
    ];
    let stageIndex = 0;
    setStageText(stages[stageIndex]);

    let val = 0;
    const progressId = setInterval(() => {
      val = Math.min(val + 8 + Math.random() * 10, 96);
      setProgress(val);
    }, 350);

    const stageId = setInterval(() => {
      stageIndex = (stageIndex + 1) % stages.length;
      setStageText(stages[stageIndex]);
    }, 900);

    return () => {
      clearInterval(progressId);
      clearInterval(stageId);
    };
  }, [loading]);

  // ---------- Search button handler ----------
  async function handleSearch() {
    setMsg(null);
    setError(null);

    if (!q.trim()) {
      setMsg({
        type: "warn",
        text: "Please enter a product name before searching.",
      });
      return;
    }

    const keyword = q.trim();

    setLoading(true);
    setHasSearched(true);
    setProducts([]);
    setWatching(null);
    setGraphProduct(null);
    setShowHistory(false);

    const items = await fetchLiveProducts(keyword);

    setProducts(items);

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "dealscope_last_results",
          JSON.stringify(items || []),
        );
        window.localStorage.setItem("dealscope_last_query", keyword);
        window.localStorage.setItem("dealscope_last_minDisc", minDisc);
        window.localStorage.setItem("dealscope_last_sort", sort);
        window.localStorage.setItem(
          "dealscope_last_savedOnly",
          String(savedOnly),
        );
      }
    } catch {}

    setSearchHistory((prev) => {
      const filtered = prev.filter(
        (term) => term.toLowerCase() !== keyword.toLowerCase(),
      );
      return [keyword, ...filtered].slice(0, 10);
    });

    if (!items || items.length === 0) {
      setError(`No live deals found for “${keyword}”.`);
      setWatching({ title: keyword, url: null });
    } else {
      setError(null);
      setWatching(null);
    }

    setProgress(100);
    setTimeout(() => setLoading(false), 600);
  }

  // ---------- Filtering & sorting ----------
  function filter_products(data, query, _category, min_disc, onlySaved) {
    let res = data.slice();

    // Keep Flipkart & Nykaa results even if the query is not literally in the title
    if (query) {
      const qlow = query.toLowerCase();
      res = res.filter((p) => {
        const title = (p.title || "").toLowerCase();
        const site = (p.site || "").toLowerCase();

        if (site === "flipkart" || site === "nykaa") {
          return true;
        }

        // For other sites (e.g., Amazon), still require the query in the title
        return title.includes(qlow);
      });
    }

    // 🔧 CHANGED BLOCK: discount filter is now "≤ threshold" and requires a numeric discount
    if (min_disc && min_disc !== "Any") {
      const threshold = parseInt(min_disc.replace("%", ""), 10);
      res = res.filter(
        (p) =>
          typeof p.discount_percent === "number" &&
          p.discount_percent <= threshold,
      );
    }

    if (onlySaved) {
      res = res.filter((p) => isSaved(p));
    }

    return res;
  }

  let filtered = filter_products(products, q, null, minDisc, savedOnly);

  // ---------- Derived sections ----------
  const topDeals = [...products]
    .filter((p) => typeof p.discount_percent === "number")
    .sort((a, b) => (b.discount_percent || 0) - (a.discount_percent || 0))
    .slice(0, 6);

  const mostViewed = [...products]
    .filter((p) => p.url && viewCounts[p.url])
    .sort((a, b) => (viewCounts[b.url] || 0) - (viewCounts[a.url] || 0))
    .slice(0, 4);

  const trendingDeals = topDeals.slice(0, 4);

  function handleNotify(product) {
    setWatching(product);
    setGraphProduct(product);
    setTimeout(() => {
      subscribeRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function handleViewDeal(p) {
    if (!p?.url) return;
    setViewCounts((prev) => ({
      ...prev,
      [p.url]: (prev[p.url] || 0) + 1,
    }));
    window.open(p.url, "_blank", "noopener,noreferrer");
  }

  function buildDummyHistory(p) {
    const mrp = parsePriceToNumber(p.original_price_text);
    const selling = parsePriceToNumber(p.price_text);
    const base = mrp || selling || 1000;
    const disc = p.discount_percent || 0;
    const current = base * (1 - disc / 100);

    return [
      Math.round(base * 1.05),
      Math.round(base * 1.02),
      Math.round(base * 0.98),
      Math.round(base * 0.95),
      Math.round(current),
    ];
  }

  async function handleSubscribe(e) {
    e.preventDefault();
    setMsg(null);

    if (!contact.trim()) {
      setMsg({
        type: "warn",
        text: "Please enter contact details to subscribe.",
      });
      return;
    }
    if (!watching) {
      setMsg({ type: "warn", text: "No product selected for alerts." });
      return;
    }

    setSubmitting(true);

    try {
      const url = `${API}/api/subscribe`;
      console.log("Subscribe call:", url);

      const res = await fetch(`${API}/api/subscribe`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: watching,
          keyword: watching?.title || q,
          discount: minDisc,
          method,
          contact,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Subscribe failed.");

      setMsg({
        type: "ok",
        text: `Subscribed! We'll notify you via ${method} when a matching deal is found.`,
      });

      setWatching(null);
      setContact("");
    } catch (err) {
      console.error("Subscribe error", err);
      setMsg({
        type: "err",
        text: "Could not subscribe right now. Please try again.",
      });
    } finally {
      setSubmitting(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  function msgColor(t) {
    if (!t) return "#bcd6ff";
    if (t.type === "ok") return "#b4ffda";
    if (t.type === "warn") return "#ffd9a8";
    if (t.type === "err") return "#ffb4b4";
    return "#bcd6ff";
  }

  return (
    <div
      style={{
        fontFamily:
          "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
        color: "#e9f0ff",
        minHeight: "100vh",
      }}
    >
      <style>{`
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .page-bg {
          background: linear-gradient(-45deg, #071428, #0b2540, #13294b, #1a355a);
          background-size: 300% 300%;
          animation: gradientMove 15s ease infinite;
        }
        .top-nav {
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding: 14px 24px;
          margin-bottom: 8px;
        }
        .brand {
          font-size: 1.45rem;
          font-weight: 800;
          letter-spacing: 0.6px;
          background: linear-gradient(90deg,#55c0ff,#9b7bff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .nav-links a {
          color: #bcd6ff;
          text-decoration: none;
          margin-left: 18px;
          font-weight:500;
          transition: color 0.3s ease;
        }
        .nav-links a:hover { color:#fff; }
        .hero {
          display:flex;
          gap:32px;
          align-items:center;
          justify-content:space-between;
          padding: 36px;
          margin-bottom: 18px;
        }
        .hero-left { max-width: 58%; }
        .hero-title {
          font-size: 2.8rem;
          font-weight: 800;
          margin: 0 0 12px 0;
          color: #ffffff;
        }
        .hero-sub {
          color: #b9c9ea;
          margin-bottom: 18px;
          font-size:1.05rem;
        }
        .grid {
          display:grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap:20px;
        }
        .card {
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 16px;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          box-shadow: 0 6px 18px rgba(2,12,27,0.45);
        }
        .card:hover {
          transform: translateY(-8px);
          box-shadow: 0 14px 36px rgba(2,12,27,0.6);
        }
        .prod-img {
          width:100%;
          border-radius:10px;
          object-fit:cover;
          max-height:170px;
        }
        .prod-name {
          font-weight:700;
          color:#f2f8ff;
          margin-top:10px;
        }
        .prod-meta {
          color:#bcd6ff;
          margin-top:6px;
          display:flex;
          justify-content:space-between;
          align-items:center;
        }
        .badge {
          background: rgba(0,184,255,0.12);
          color:#7fe0ff;
          padding:6px 10px;
          border-radius:8px;
          font-weight:700;
        }
        .subscribe-pane {
          margin-top:18px;
          padding: 18px;
          border-radius:12px;
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
        }
        input, select {
          color:#f5f7ff;
          background-color: #091a33;
          border:1px solid rgba(255,255,255,0.15);
        }
        select option {
          color:#f5f7ff;
          background-color:#091a33;
        }
        button { color:#fff; }
        @media (max-width: 800px) {
          .hero { flex-direction:column; }
          .hero-left { max-width:100%; }
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div
        className="page-bg"
        style={{ paddingBottom: 32, minHeight: "100vh" }}
      >
        {/* Top nav */}
        <div className="top-nav">
          <div className="brand">DealScope</div>
          <div className="nav-links" style={{ display: "flex", gap: 12 }}>
            <Link href="/">Home</Link>
            <Link href="/deals">Deals</Link>
            <Link href="/alerts">Alerts</Link>
            <Link href="/about">About</Link>
          </div>
        </div>

        {/* ⚠ Backend not reachable message */}
        {error ===
          "Unable to reach backend. Make sure Flask is running on port 5000." && (
          <div
            style={{
              margin: "10px auto",
              background: "rgba(255,0,0,0.2)",
              padding: "10px 16px",
              width: "fit-content",
              borderRadius: 10,
              color: "#ffdada",
              fontSize: ".9rem",
            }}
          >
            ⚠ Backend not reachable. Start Flask using: <b>python app.py</b>
          </div>
        )}

        {/* Hero */}
        <div className="hero">
          <div className="hero-left">
            <h1 className="hero-title">
              Find the deals you care about — instantly.
            </h1>
            <div className="hero-sub">
              Track products across apps, compare discounts, and get notified
              the moment prices drop. Clean, fast, and built for shoppers who
              want the best.
            </div>

            {/* Search + button + dropdown */}
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                marginTop: 6,
              }}
            >
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  placeholder="e.g. smartwatch, lipstick, running shoes"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onFocus={() => {
                    if (searchHistory.length > 0) setShowHistory(true);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 36px 12px 12px",
                    borderRadius: 8,
                  }}
                />
                {searchHistory.length > 0 && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowHistory((v) => !v);
                    }}
                    style={{
                      position: "absolute",
                      right: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      borderRadius: 999,
                      border: "none",
                      padding: "4px 8px",
                      background: "rgba(255,255,255,0.08)",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    ⌄
                  </button>
                )}

                {showHistory && searchHistory.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "110%",
                      left: 0,
                      right: 0,
                      background: "#091a33",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      maxHeight: 220,
                      overflowY: "auto",
                      boxShadow: "0 10px 26px rgba(0,0,0,0.6)",
                      zIndex: 50,
                    }}
                  >
                    {searchHistory.map((term, idx) => (
                      <div
                        key={term + idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setQ(term);
                          setShowHistory(false);
                        }}
                        style={{
                          padding: "8px 10px",
                          fontSize: ".9rem",
                          cursor: "pointer",
                          borderBottom:
                            idx === searchHistory.length - 1
                              ? "none"
                              : "1px solid rgba(255,255,255,0.06)",
                          color: "#dbe6ff",
                        }}
                      >
                        {term}
                      </div>
                    ))}
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchHistory([]);
                        setShowHistory(false);
                      }}
                      style={{
                        padding: "8px 10px",
                        fontSize: ".8rem",
                        cursor: "pointer",
                        color: "#ffb4b4",
                        borderTop: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      Clear history
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleSearch}
                style={{
                  padding: "11px 20px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  background: "linear-gradient(90deg, #0072ff, #00c6ff)",
                  boxShadow: "0px 4px 10px rgba(0,0,0,0.3)",
                }}
              >
                {loading ? "Scanning..." : "Search deals"}
              </button>
            </div>

            {/* Filters + Saved only */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 12,
                alignItems: "center",
              }}
            >
              <select
                value={minDisc}
                onChange={(e) => setMinDisc(e.target.value)}
                style={{ padding: 10, borderRadius: 8, width: 120 }}
              >
                {[
                  "Any",
                  "10%",
                  "20%",
                  "30%",
                  "40%",
                  "50%",
                  "60%",
                  "70%",
                  "80%",
                  "90%",
                ].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>

              <button
                onClick={() => setSavedOnly((v) => !v)}
                style={{
                  marginLeft: 4,
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  fontSize: ".8rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: savedOnly
                    ? "rgba(255, 206, 91, 0.25)"
                    : "rgba(255,255,255,0.06)",
                }}
              >
                <span style={{ fontSize: "1rem" }}>⭐</span>
                Saved only
              </button>
            </div>

            {/* Status / messages */}
            {loading && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontSize: ".9rem",
                    color: "#bcd6ff",
                    marginBottom: 4,
                  }}
                >
                  {stageText || "Scanning stores for best prices…"}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 8,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progress}%`,
                      background: "linear-gradient(90deg, #00c6ff, #9b7bff)",
                      transition: "width 0.25s ease",
                    }}
                  />
                </div>
              </div>
            )}

            {msg && (
              <div
                style={{
                  marginTop: 10,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: msgColor(msg),
                }}
              >
                <span style={{ color: "#00152f", fontSize: ".9rem" }}>
                  {msg.text}
                </span>
              </div>
            )}

            {hasSearched && !loading && error && (
              <div
                style={{ marginTop: 10, color: "#ffb4b4", fontSize: ".95rem" }}
              >
                {error}
              </div>
            )}
          </div>

          <div
            style={{ width: 320, display: "flex", justifyContent: "center" }}
          >
            {heroAnim ? (
              <div style={{ width: 320 }}>
                <Lottie animationData={heroAnim} loop />
              </div>
            ) : (
              <img
                src="https://cdn-icons-png.flaticon.com/512/2331/2331970.png"
                width={140}
                alt="hero"
              />
            )}
          </div>
        </div>

        {/* Results */}
        <div style={{ padding: "0 36px" }}>
          <div style={{ marginTop: 18, marginBottom: 12 }}>
            <h3 style={{ color: "#eaf4ff" }}>
              {hasSearched
                ? `Featured Deals for “${q || ""}”`
                : "Featured Deals"}
            </h3>
          </div>

          {!loading && hasSearched && filtered.length === 0 && (
            <div style={{ color: "#bcd6ff", marginBottom: 20 }}>
              <div style={{ marginBottom: 6 }}>
                No deals matched your filters. You can still subscribe below to
                get notified when we find something.
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!q.trim()) return;
                  setWatching({ title: q.trim(), url: null });
                  setTimeout(() => {
                    subscribeRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 80);
                }}
                style={{
                  marginTop: 4,
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  fontSize: ".9rem",
                  background: "rgba(0,184,255,0.35)",
                }}
              >
                Create alert for this search
              </button>
            </div>
          )}

          <div className="grid">
            {filtered.map((p, idx) => (
              <div className="card" key={idx}>
                <img
                  className="prod-img"
                  src={
                    p.image ||
                    "https://images.pexels.com/photos/5632396/pexels-photo-5632396.jpeg?auto=compress&cs=tinysrgb&w=600"
                  }
                  alt={p.title}
                />
                <div className="prod-name">{p.title}</div>
                <div
                  style={{ marginTop: 4, fontSize: ".85rem", color: "#9fb7e8" }}
                >
                  {p.site && p.site.toUpperCase()}
                </div>

                <div className="prod-meta">
                  <div style={{ fontWeight: 700, color: "#d7eefe" }}>
                    {p.price_text ? `₹${p.price_text}` : "Price unavailable"}
                  </div>
                  <div className="badge">
                    {typeof p.discount_percent === "number"
                      ? `${p.discount_percent}% OFF`
                      : "Deal"}
                  </div>
                </div>

                {p.original_price_text && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: ".8rem",
                      color: "#9fb7e8",
                      textDecoration: "line-through",
                    }}
                  >
                    MRP {p.original_price_text}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={() => toggleSave(p)}
                    style={{
                      borderRadius: 999,
                      border: "none",
                      padding: "6px 10px",
                      background: isSaved(p)
                        ? "rgba(255, 206, 91, 0.3)"
                        : "rgba(255,255,255,0.05)",
                      fontSize: ".8rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>⭐</span> {isSaved(p) ? "Saved" : "Save"}
                  </button>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleViewDeal(p)}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      background: "rgba(255,255,255,0.06)",
                      padding: "8px 12px",
                      borderRadius: 50,
                      fontSize: ".9rem",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    View deal
                  </button>
                  <button
                    onClick={() => handleNotify(p)}
                    style={{
                      flex: 1,
                      background: "linear-gradient(90deg, #0072ff, #00c6ff)",
                      borderRadius: 50,
                      padding: "8px 12px",
                      fontWeight: 600,
                      boxShadow: "0px 4px 10px rgba(0,0,0,0.3)",
                      cursor: "pointer",
                      border: "none",
                      fontSize: ".9rem",
                    }}
                  >
                    Notify Me
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Trending Deals */}
          {trendingDeals && trendingDeals.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <h3 style={{ color: "#eaf4ff", marginBottom: 4 }}>
                📈 Trending Deals
              </h3>
              <div
                style={{
                  color: "#9fb7e8",
                  fontSize: ".95rem",
                  marginBottom: 14,
                }}
              >
                Hot deals with the strongest discounts right now.
              </div>
              <div className="grid">
                {trendingDeals.map((p, idx) => (
                  <div className="card" key={"trend-" + idx}>
                    <div className="prod-name">{p.title}</div>
                    <div className="prod-meta">
                      <div style={{ fontWeight: 700, color: "#d7eefe" }}>
                        {p.price_text
                          ? `₹${p.price_text}`
                          : "Price unavailable"}
                      </div>
                      <div className="badge">{p.discount_percent}% OFF</div>
                    </div>
                    {p.url && (
                      <div style={{ marginTop: 10 }}>
                        <button
                          onClick={() => handleViewDeal(p)}
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            padding: "8px 16px",
                            borderRadius: 999,
                            border: "none",
                            cursor: "pointer",
                            fontSize: ".9rem",
                          }}
                        >
                          Open on {p.site?.toUpperCase()}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Most viewed */}
          {mostViewed && mostViewed.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <h3 style={{ color: "#eaf4ff", marginBottom: 4 }}>
                👀 Most Viewed in This Session
              </h3>
              <div
                style={{
                  color: "#9fb7e8",
                  fontSize: ".95rem",
                  marginBottom: 14,
                }}
              >
                These are the deals you (or the user during this session)
                clicked the most.
              </div>
              <div className="grid">
                {mostViewed.map((p, idx) => (
                  <div className="card" key={"view-" + idx}>
                    <div className="prod-name">{p.title}</div>
                    <div className="prod-meta">
                      <div style={{ fontWeight: 700, color: "#d7eefe" }}>
                        {p.price_text ? `₹${p.price_text}` : "₹ —"}
                      </div>
                      <div className="badge">{p.discount_percent}% OFF</div>
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: ".8rem",
                        color: "#9fb7e8",
                      }}
                    >
                      Views this session: {viewCounts[p.url] || 0}
                    </div>
                    {p.url && (
                      <div style={{ marginTop: 10 }}>
                        <button
                          onClick={() => handleViewDeal(p)}
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            padding: "8px 16px",
                            borderRadius: 999,
                            border: "none",
                            cursor: "pointer",
                            fontSize: ".9rem",
                          }}
                        >
                          Open again
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Always-visible Top Deals */}
          {topDeals && topDeals.length > 0 && (
            <div style={{ marginTop: 50, marginBottom: 40 }}>
              <h3 style={{ color: "#eaf4ff", marginBottom: 4 }}>
                🔥 Top Deals Right Now
              </h3>
              <div
                style={{
                  color: "#9fb7e8",
                  fontSize: ".95rem",
                  marginBottom: 14,
                }}
              >
                The biggest discounts across Amazon, Flipkart & Nykaa — in any
                category.
              </div>
              <div className="grid">
                {topDeals.map((p, idx) => (
                  <div className="card" key={"global-top-" + idx}>
                    <img
                      className="prod-img"
                      src={
                        p.image ||
                        "https://images.pexels.com/photos/5632389/pexels-photo-5632389.jpeg?auto=compress&cs=tinysrgb&w=600"
                      }
                      alt={p.title}
                    />
                    <div className="prod-name">{p.title}</div>
                    <div
                      style={{
                        fontSize: ".85rem",
                        color: "#9fb7e8",
                        marginTop: 4,
                      }}
                    >
                      {p.site?.toUpperCase()}
                    </div>
                    <div className="prod-meta">
                      <div style={{ fontWeight: 700, color: "#d7eefe" }}>
                        {p.price_text ? `₹${p.price_text}` : "₹ —"}
                      </div>
                      <div className="badge">{p.discount_percent}% OFF</div>
                    </div>
                    {p.url && (
                      <div style={{ marginTop: 12 }}>
                        <button
                          onClick={() => handleViewDeal(p)}
                          style={{
                            background:
                              "linear-gradient(90deg, #0072ff, #00c6ff)",
                            padding: "8px 16px",
                            borderRadius: 999,
                            border: "none",
                            cursor: "pointer",
                            fontSize: ".9rem",
                            fontWeight: 600,
                          }}
                        >
                          View deal
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Subscribe section */}
        <div id="alerts" ref={subscribeRef} style={{ padding: "28px 36px" }}>
          {watching && (
            <div
              className="subscribe-pane"
              style={{ display: "flex", gap: 20, flexWrap: "wrap" }}
            >
              <div style={{ flex: 2, minWidth: 260 }}>
                <h4 style={{ margin: "0 0 8px 0" }}>
                  Get alerts for <b>{watching.title || watching.name}</b>
                </h4>

                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {["Email", "WhatsApp", "SMS"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background:
                          method === m
                            ? "rgba(0,184,255,0.9)"
                            : "rgba(255,255,255,0.06)",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        fontSize: ".9rem",
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubscribe}>
                  <input
                    placeholder={
                      method === "Email"
                        ? "Enter email address"
                        : method === "WhatsApp"
                          ? "Enter WhatsApp number (with country code)"
                          : "Enter mobile number"
                    }
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 10,
                    }}
                  />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      disabled={submitting}
                      type="submit"
                      style={{
                        background: "linear-gradient(90deg, #0072ff, #00c6ff)",
                        padding: "10px 18px",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {submitting ? "Subscribing..." : "Subscribe & Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => (window.location.href = "/alerts")}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        padding: "10px 18px",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      View all alerts
                    </button>
                  </div>
                </form>
              </div>

              <div style={{ flex: 1, minWidth: 220 }}>
                <img
                  src={
                    watching.image ||
                    "https://images.pexels.com/photos/5632389/pexels-photo-5632389.jpeg?auto=compress&cs=tinysrgb&w=600"
                  }
                  alt={watching.title || watching.name}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    objectFit: "cover",
                    maxHeight: 220,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Confetti on success */}
        {msg && msg.type === "ok" && confettiAnim && (
          <div style={{ position: "fixed", right: 20, bottom: 20, width: 180 }}>
            <Lottie animationData={confettiAnim} loop={false} />
          </div>
        )}

        <div
          style={{
            color: "#9fb7e8",
            marginTop: 10,
            textAlign: "center",
            fontSize: ".95rem",
            paddingBottom: 18,
          }}
        >
          DealScope — smart price tracking. Built with Next.js + Playwright +
          Python
        </div>
      </div>
    </div>
  );
}
