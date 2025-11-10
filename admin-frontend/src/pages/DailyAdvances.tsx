import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { DailyAdvance, Employee, PaginatedEmployees } from "@/types/employee";

const DailyAdvancesPage = () => {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [advances, setAdvances] = useState<DailyAdvance[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [recordedDate, setRecordedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    if (!token) return;
    const loadEmployees = async () => {
      try {
        const result = await apiFetch<PaginatedEmployees>("/employees?page=1&page_size=100", { token });
        setEmployees(result.items);
        if (result.items.length > 0 && selectedEmployee === null) {
          setSelectedEmployee(result.items[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load employees");
      }
    };
    loadEmployees();
  }, [token, selectedEmployee]);

  const loadAdvances = async (employeeId: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const records = await apiFetch<DailyAdvance[]>(
        `/attendance/advances?employee_id=${employeeId}`,
        { token }
      );
      setAdvances(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load advances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !selectedEmployee) {
      setAdvances([]);
      return;
    }
    loadAdvances(selectedEmployee);
  }, [token, selectedEmployee]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !selectedEmployee || !amount) return;
    setError(null);
    try {
      await apiFetch<DailyAdvance>("/attendance/advances", {
        method: "POST",
        token,
        body: JSON.stringify({
          employee_id: selectedEmployee,
          amount: Number(amount),
          note: note || null,
          recorded_for: recordedDate,
        }),
      });
      setAmount("");
      setNote("");
      setRecordedDate(new Date().toISOString().slice(0, 10));
      await loadAdvances(selectedEmployee);
      setStatusMessage("Daily advance recorded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record advance");
    }
  };

  const selectedEmployeeName = useMemo(
    () => employees.find((emp) => emp.id === selectedEmployee)?.name ?? "Employee",
    [employees, selectedEmployee]
  );

  return (
    <section>
      <header className="section-header">
        <div>
          <h2>Daily Advances</h2>
          <p>Track allowances issued to AECO staff throughout the month.</p>
        </div>
      </header>

      {error && <p className="alert alert--error">{error}</p>}
      {statusMessage && <p className="alert alert--info">{statusMessage}</p>}

      <form className="form-grid" onSubmit={handleSubmit} style={{ maxWidth: "100%", marginBottom: "1.5rem" }}>
        <label>
          <span>Select employee</span>
          <select
            value={selectedEmployee ?? ""}
            onChange={(event) => setSelectedEmployee(event.target.value ? Number(event.target.value) : null)}
          >
            {employees.length === 0 && <option value="">No employees found</option>}
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employee_code} — {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            disabled={!isSuperAdmin}
          />
        </label>
        <label>
          <span>Recorded for</span>
          <input
            type="date"
            value={recordedDate}
            onChange={(event) => setRecordedDate(event.target.value)}
            required
            disabled={!isSuperAdmin}
          />
        </label>
        <label>
          <span>Note</span>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Allowance reason (optional)"
            disabled={!isSuperAdmin}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={!isSuperAdmin || !amount}>
            Record advance
          </button>
        </div>
      </form>

      <h3>Advances — {selectedEmployeeName}</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="table-empty">
                  Loading advances…
                </td>
              </tr>
            ) : advances.length ? (
              advances.map((advance) => (
                <tr key={advance.id}>
                  <td>{advance.recorded_for}</td>
                  <td>Rs {Number(advance.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>{advance.note ?? "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="table-empty">
                  No advances logged.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default DailyAdvancesPage;
