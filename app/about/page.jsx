import Link from "next/link";

export default function AboutPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(-45deg, #071428, #0b2540, #13294b, #1a355a)",
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

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "40px auto 0" }}>
        <h1 style={{ fontSize: "2.4rem", fontWeight: 800, marginBottom: 12 }}>
          About DealScope
        </h1>

        <p
          style={{
            color: "#c7d8ff",
            marginBottom: 16,
            lineHeight: 1.7,
            fontSize: "1.05rem",
          }}
        >
          DealScope is a real-time deal discovery platform that helps users
          instantly find the best prices across Amazon, Flipkart, and Nykaa. It
          combines advanced web scraping, fast APIs, and an interactive UI to
          make online shopping smarter and more transparent.
        </p>

        <p
          style={{
            color: "#c7d8ff",
            marginBottom: 26,
            lineHeight: 1.7,
            fontSize: "1.05rem",
          }}
        >
          Whether you're comparing gadgets, beauty products, or daily
          essentials, DealScope analyzes live prices, highlights the biggest
          discounts, and even allows you to set alerts for future price drops.
        </p>

        {/* Card */}
        <div
          style={{
            padding: 24,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.08)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
            boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: "1.35rem" }}>
            How it Works
          </h2>

          <p style={{ color: "#bcd6ff", lineHeight: 1.65, marginBottom: 18 }}>
            DealScope runs three Playwright-powered scrapers in parallel,
            extracts structured product data, normalizes it, and serves it
            through a fast Flask API. The frontend consumes this data and
            presents it through a smooth, Next.js-based experience with instant
            interactions.
          </p>

          <h2 style={{ marginTop: 16, marginBottom: 10, fontSize: "1.3rem" }}>
            Tech Stack
          </h2>

          <ul style={{ color: "#c7d8ff", lineHeight: 1.8, fontSize: ".98rem" }}>
            <li>
              <b>Frontend:</b> Next.js + React, Lottie animations, responsive UI
              components
            </li>
            <li>
              <b>Backend:</b> Flask REST API, JSON-based alert registry
            </li>
            <li>
              <b>Web Scraping:</b> Playwright for dynamic rendering, lazy-loaded
              images, anti-bot handling, and browser-level automation
            </li>
            <li>
              <b>Data Pipeline:</b> price extraction, discount calculation,
              normalization, filtering & sorting
            </li>
            <li>
              <b>Features:</b> live deal search, wishlist, price trend
              sparkline, search history, and “Notify Me” alerts
            </li>
          </ul>

          <h2 style={{ marginTop: 22, marginBottom: 10, fontSize: "1.3rem" }}>
            Future Enhancements
          </h2>

          <ul style={{ color: "#bcd6ff", lineHeight: 1.7, fontSize: ".95rem" }}>
            <li>Historical price tracking with charts</li>
            <li>Automatic periodic scraping (scheduled tasks)</li>
            <li>
              Support for more shopping platforms like Myntra, Ajio, Croma
            </li>
            <li>Real SMS/WhatsApp alerts using Twilio/Meta APIs</li>
            <li>ML-based personalized deal recommendations</li>
          </ul>

          <p
            style={{
              marginTop: 18,
              fontSize: ".95rem",
              color: "#9fb7e8",
              lineHeight: 1.6,
            }}
          >
            DealScope demonstrates a complete end-to-end system — from real-time
            data extraction to a polished consumer-grade interface. It is
            designed for performance, accuracy, and future scalability.
          </p>
        </div>
      </div>
    </div>
  );
}
