const Dashboard = () => (
  <section>
    <header>
      <h2>AECO Overview</h2>
      <p>Welcome to the Arshad Engineering Company management console.</p>
    </header>
    <div className="card-grid">
      <article className="card">
        <h3>Production</h3>
        <p>Monitor production orders and schedule upcoming work.</p>
      </article>
      <article className="card">
        <h3>Inventory</h3>
        <p>Track stock levels across warehouses in real time.</p>
      </article>
      <article className="card">
        <h3>Maintenance</h3>
        <p>Plan preventative maintenance to reduce downtime.</p>
      </article>
    </div>
  </section>
);

export default Dashboard;
