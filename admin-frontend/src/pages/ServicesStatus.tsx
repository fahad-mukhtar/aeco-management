import { useEffect, useState } from "react";

import { formatTime12Hour } from "@/utils/time";

type ServiceStatus = {
  name: string;
  url: string;
};

type ServiceState = {
  name: string;
  status: "unknown" | "online" | "offline";
  lastChecked: Date | null;
  error?: string;
};

const services: ServiceStatus[] = [{ name: "User Service API", url: "http://localhost:8001/health" }];

const ServicesStatus = () => {
  const [states, setStates] = useState<ServiceState[]>(
    services.map((service) => ({
      name: service.name,
      status: "unknown",
      lastChecked: null,
    }))
  );

  useEffect(() => {
    const controller = new AbortController();

    const fetchStatuses = async () => {
      const results = await Promise.all(
        services.map(async (service) => {
          try {
            const response = await fetch(service.url, { signal: controller.signal });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            await response.json();
            return {
              name: service.name,
              status: "online" as const,
              lastChecked: new Date(),
            };
          } catch (error) {
            return {
              name: service.name,
              status: "offline" as const,
              lastChecked: new Date(),
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        })
      );
      setStates(results);
    };

    fetchStatuses();
    const interval = window.setInterval(fetchStatuses, 15_000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section>
      <header>
        <h2>Platform Health</h2>
        <p>Quick overview of the unified backend service powering AECO operations.</p>
      </header>
      <div className="card-grid">
        {states.map((state) => (
          <article key={state.name} className={`card status-${state.status}`}>
            <h3>{state.name}</h3>
            <p>Status: {state.status === "online" ? "Online" : "Offline"}</p>
            {state.lastChecked && <p>Checked: {formatTime12Hour(state.lastChecked)}</p>}
            {state.error && <p className="card__error">Error: {state.error}</p>}
          </article>
        ))}
      </div>
    </section>
  );
};

export default ServicesStatus;
