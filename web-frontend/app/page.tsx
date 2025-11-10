"use client";

import Link from "next/link";

const HomePage = () => (
  <main style={{ padding: "3rem", maxWidth: "960px", margin: "0 auto" }}>
    <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>AECO Operations Portal</h1>
    <p style={{ maxWidth: "640px" }}>
      This Next.js app represents the customer or operator-facing experience for Arshad Engineering Company. Extend
      it with dashboards, production KPIs, or order submission flows as your project evolves.
    </p>
    <section style={{ display: "grid", gap: "1.5rem", marginTop: "2rem" }}>
      <article style={{ background: "#fff", padding: "1.5rem", borderRadius: "1rem", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)" }}>
        <h2>Admin Panel</h2>
        <p>Jump into the admin app for deeper configuration and team management tasks.</p>
        <Link href="http://localhost:5173" style={{ color: "#2563eb", fontWeight: 600 }}>
          Open admin panel
        </Link>
      </article>
      <article style={{ background: "#fff", padding: "1.5rem", borderRadius: "1rem", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)" }}>
        <h2>API Reference</h2>
        <p>Explore interactive API docs for the unified backend service.</p>
        <Link href="http://localhost:8001/docs" style={{ color: "#2563eb", fontWeight: 600 }}>
          View FastAPI docs
        </Link>
      </article>
    </section>
  </main>
);

export default HomePage;
