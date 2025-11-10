import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type {
  Employee,
  LeaveRecord,
  PaginatedEmployees,
  PaginatedLeaveRecords,
} from "@/types/employee";
import { formatDate12Hour } from "@/utils/time";

const LeavesPage = () => {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [leaves, setLeaves] = useState<PaginatedLeaveRecords | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [page, setPage] = useState(1);

  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveType, setLeaveType] = useState<"paid" | "unpaid">("paid");
  const [reason, setReason] = useState("");

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

  const loadLeaves = async (employeeId: number, targetPage = page) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PaginatedLeaveRecords>(
        `/leaves/by-employee/${employeeId}?month=${month}&page=${targetPage}&page_size=10`,
        { token }
      );
      setLeaves(data);
      if (data.page !== targetPage) {
        setPage(data.page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load leave records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !selectedEmployee) {
      setLeaves(null);
      return;
    }
    loadLeaves(selectedEmployee, 1);
  }, [token, selectedEmployee, month]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !selectedEmployee) return;
    if (endDate < startDate) {
      setError("End date must be after start date");
      return;
    }
    setError(null);
    try {
      await apiFetch<LeaveRecord>("/leaves", {
        method: "POST",
        token,
        body: JSON.stringify({
          employee_id: selectedEmployee,
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          reason: reason || null,
        }),
      });
      setStatusMessage("Leave recorded successfully.");
      setReason("");
      await loadLeaves(selectedEmployee, 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record leave");
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
          <h2>Leaves & Absences</h2>
          <p>Track paid and unpaid leave taken by AECO staff.</p>
        </div>
        <label className="month-picker">
          <span>Month</span>
          <input
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </header>

      {error && <p className="alert alert--error">{error}</p>}
      {statusMessage && <p className="alert alert--info">{statusMessage}</p>}

      <form className="form-grid" onSubmit={handleSubmit} style={{ maxWidth: "100%", marginBottom: "1.5rem" }}>
        <label>
          <span>Select employee</span>
          <select
            value={selectedEmployee ?? ""}
            onChange={(event) => {
              const value = event.target.value ? Number(event.target.value) : null;
              setSelectedEmployee(value);
              setPage(1);
            }}
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
          <span>Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
            disabled={!isSuperAdmin}
          />
        </label>
        <label>
          <span>End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
            disabled={!isSuperAdmin}
          />
        </label>
        <label>
          <span>Leave type</span>
          <select value={leaveType} onChange={(event) => setLeaveType(event.target.value as "paid" | "unpaid")}>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </label>
        <label>
          <span>Reason</span>
          <input
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional note"
            disabled={!isSuperAdmin}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={!isSuperAdmin}>
            Record leave
          </button>
        </div>
      </form>

      <h3>Leaves — {selectedEmployeeName}</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Recorded</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  Loading leave records…
                </td>
              </tr>
            ) : leaves && leaves.items.length ? (
              leaves.items.map((leave) => (
                <tr key={leave.id}>
                  <td>{leave.start_date}</td>
                  <td>{leave.end_date}</td>
                  <td style={{ textTransform: "capitalize" }}>{leave.leave_type}</td>
                  <td>{leave.reason ?? "—"}</td>
                  <td>{formatDate12Hour(leave.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="table-empty">
                  No leave recorded for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="pagination">
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            if (page > 1) {
              const newPage = Math.max(page - 1, 1);
              setPage(newPage);
              selectedEmployee && loadLeaves(selectedEmployee, newPage);
            }
          }}
          disabled={page === 1}
        >
          Previous
        </button>
        <span>
          Page {leaves?.page ?? page} of {leaves?.pages ?? 1}
        </span>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            if (leaves) {
              const newPage = Math.min(page + 1, leaves.pages);
              if (page < leaves.pages) {
                setPage(newPage);
                selectedEmployee && loadLeaves(selectedEmployee, newPage);
              }
            }
          }}
          disabled={leaves ? page >= leaves.pages : true}
        >
          Next
        </button>
      </footer>
    </section>
  );
};

export default LeavesPage;
