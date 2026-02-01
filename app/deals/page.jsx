"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function parsePriceToNumber(str) {
  if (!str) return null;
  const s = String(str).replace(/,/g, "");
  const m = s.match(/[\d.]+/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

export default function DealsPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("dealscope_last_results");
      if (!raw) return;
      const arr = JSON.parse(raw) || [];
      // sort by highest discount
      arr.sort((a, b) => (b.discount_percent || 0) - (a.discount_percent || 0));
      setItems(arr);
    } catch {
      /* ignore */
    }
  }, []);

  const hasItems = items && items.length > 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(-45deg, #071428, #0b2540, #13294b, #1a355a)",
        backgroundSize: "300% 300%",
        fontFamily:
          "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
        color: "#e9f0ff",
        padding: "16px 24px 40px",
      }}
    >
      {/* Top nav */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 0 16px 0",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: "1.45rem",
            fontWeight: 800,
            letterSpacing: 0.6,
            background: "linear-gradient(90deg,#55c0ff,#9b7bff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          DealScope
        </div>
        <div style={{ display: "flex", gap: 18, fontWeight: 500 }}>
          <Link href="/">Home</Link>
          <Link href="/deals">Deals</Link>
          <Link href="/alerts">Alerts</Link>
          <Link href="/about">About</Link>
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 1100, margin: "40px auto 0" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: 10 }}>
          All Deals (Highest Discounts First)
        </h1>
        <p style={{ color: "#b9c9ea", marginBottom: 24 }}>
          These are the latest products from your last search on the Home page,
          sorted by biggest discount across all sites.
        </p>

        {!hasItems && (
          <div
            style={{
              padding: 20,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
              boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
            }}
          >
            <p style={{ color: "#c7d8ff", fontSize: ".98rem", lineHeight: 1.7 }}>
              No deals found here yet. This page shows results from your last search.
              Go to{" "}
              <Link href="/" style={{ textDecoration: "underline" }}>
                Home
              </Link>{" "}
              and run a search first.
            </p>
          </div>
        )}

        {hasItems && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20,
              marginTop: 10,
            }}
          >
            {items.map((p, idx) => (
              <div
                key={idx}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
                  boxShadow: "0 8px 22px rgba(0,0,0,0.5)",
                }}
              >
                <div style={{ fontWeight: 700, color: "#f2f8ff", marginBottom: 4 }}>
                  {p.title}
                </div>
                <div style={{ fontSize: ".85rem", color: "#9fb7e8", marginBottom: 8 }}>
                  {p.site && p.site.toUpperCase()}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {p.price_text ? `₹${p.price_text}` : "Price unavailable"}
                  </div>
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: ".8rem",
                      background: "rgba(0,184,255,0.15)",
                      color: "#7fe0ff",
                      fontWeight: 700,
                    }}
                  >
                    {typeof p.discount_percent === "number"
                      ? `${p.discount_percent}% OFF`
                      : "Deal"}
                  </div>
                </div>
                {p.original_price_text && (
                  <div
                    style={{
                      fontSize: ".8rem",
                      color: "#9fb7e8",
                      textDecoration: "line-through",
                      marginBottom: 10,
                    }}
                  >
                    MRP {p.original_price_text}
                  </div>
                )}
                {p.url && (
                  <button
                    onClick={() =>
                      window.open(p.url, "_blank", "noopener,noreferrer")
                    }
                    style={{
                      marginTop: 4,
                      background: "linear-gradient(90deg,#0072ff,#00c6ff)",
                      border: "none",
                      borderRadius: 999,
                      padding: "8px 14px",
                      cursor: "pointer",
                      fontSize: ".9rem",
                      fontWeight: 600,
                    }}
                  >
                    View deal
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
