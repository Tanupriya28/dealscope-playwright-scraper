"use client";
import { useEffect, useState } from "react";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("http://localhost:5000/api/alerts");
        const json = await res.json();
        if (json.success) setAlerts(json.alerts || []);
      } catch (err) {
        console.error("Failed to load alerts:", err);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function deleteAlertByIndex(index, alertObj) {
    const id = alertObj.id;

    // Remove locally
    setAlerts(prev => prev.filter((_, i) => i !== index));

    if (id) {
      try {
        const res = await fetch("http://localhost:5000/api/alerts/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });

        const json = await res.json();
        if (!json.success) console.error("Backend delete failed:", json.error);
      } catch (err) {
        console.error("Delete failed:", err);
      }
    }
  }

  return (
    <div
      style={{
        padding: "40px 20px",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #071428, #0b2540)"
      }}
    >
      {/* Page Heading */}
      <h2
        style={{
          fontSize: "2.6rem",
          fontWeight: "900",
          textAlign: "center",
          marginBottom: "32px",
          background: "linear-gradient(90deg, #55c0ff, #9b7bff)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "1.5px"
        }}
      >
        Your Alerts
      </h2>

      {/* Loading */}
      {loading && (
        <div
          style={{
            textAlign: "center",
            color: "#cfe2ff",
            fontSize: "1.2rem",
            marginTop: 40
          }}
        >
          Loading alerts…
        </div>
      )}

      {/* Empty State */}
      {!loading && alerts.length === 0 && (
        <div
          style={{
            marginTop: 40,
            textAlign: "center",
            fontSize: "1.15rem",
            color: "#bcd6ff",
            padding: "30px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
            maxWidth: 500,
            marginLeft: "auto",
            marginRight: "auto"
          }}
        >
          <div style={{ fontSize: "1.4rem", marginBottom: 10 }}>🔔 No Alerts Yet</div>
          You haven’t subscribed to any product alerts.  
          <br />
          Go back and track a deal!
        </div>
      )}

      {/* Alerts Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "20px",
          padding: "10px"
        }}
      >
        {alerts.map((a, index) => (
          <div
            key={a.id || index}
            style={{
              padding: 20,
              borderRadius: 14,
              background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
              boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-6px)";
              e.currentTarget.style.boxShadow = "0 14px 30px rgba(0,0,0,0.6)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,0,0,0.45)";
            }}
          >
            <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>
              {a.product_title}
            </div>

            <div style={{ color: "#bcd6ff", marginBottom: 8 }}>
              <b style={{ color: "#d7eefe" }}>Keyword:</b> {a.keyword}
            </div>

            <div style={{ color: "#bcd6ff", marginBottom: 8 }}>
              <b style={{ color: "#d7eefe" }}>Discount trigger:</b> {a.discount}
            </div>

            <div style={{ color: "#bcd6ff", marginBottom: 8 }}>
              <b style={{ color: "#d7eefe" }}>Notify via:</b> {a.method}
            </div>

            <div style={{ color: "#bcd6ff", marginBottom: 8 }}>
              <b style={{ color: "#d7eefe" }}>Contact:</b> {a.contact}
            </div>

            {a.product_url && (
              <div style={{ marginBottom: 10 }}>
                <b style={{ color: "#d7eefe" }}>Link: </b>
                <a
                  href={a.product_url}
                  target="_blank"
                  style={{ color: "#7fe0ff", textDecoration: "underline" }}
                >
                  Open Product
                </a>
              </div>
            )}

            <button
              onClick={() => deleteAlertByIndex(index, a)}
              style={{
                marginTop: 12,
                padding: "10px 16px",
                width: "100%",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(90deg, #ff4d4d, #ff3131)",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
                transition: "opacity 0.25s"
              }}
              onMouseOver={e => (e.target.style.opacity = "0.85")}
              onMouseOut={e => (e.target.style.opacity = "1")}
            >
              ❌ Cancel Alert
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
