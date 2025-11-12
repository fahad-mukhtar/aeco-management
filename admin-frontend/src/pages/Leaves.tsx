import { FormEvent, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type {
  Employee,
  EmployeeMonthSummary,
  LeaveRecord,
  PaginatedEmployees,
  PaginatedLeaveRecords,
} from "@/types/employee";
import { formatDate12Hour } from "@/utils/time";

const formatCurrency = (value: string | number) =>
  `Rs ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const LeavesPage = () => {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [leaves, setLeaves] = useState<PaginatedLeaveRecords | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
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
  const [editingLeaveId, setEditingLeaveId] = useState<number | null>(null);
  const [summary, setSummary] = useState<EmployeeMonthSummary | null>(null);

  const isSuperAdmin = user?.role === "super_admin";
  const isEditing = editingLeaveId !== null;

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

  const loadSummary = async (employeeId: number) => {
    if (!token) return;
    setSummaryLoading(true);
    try {
      const data = await apiFetch<EmployeeMonthSummary>(
        `/employees/${employeeId}/summary?month=${month}`,
        { token }
      );
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load leave summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  const resetForm = () => {
    const [year, monthPart] = month.split("-");
    const anchor =
      year && monthPart ? `${year}-${monthPart}-01` : new Date().toISOString().slice(0, 10);
    setStartDate(anchor);
    setEndDate(anchor);
    setLeaveType("paid");
    setReason("");
    setEditingLeaveId(null);
  };

  useEffect(() => {
    if (!token || !selectedEmployee) {
      setLeaves(null);
      setSummary(null);
      return;
    }
    loadLeaves(selectedEmployee, 1);
    loadSummary(selectedEmployee);
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
      if (isEditing && editingLeaveId) {
        await apiFetch<LeaveRecord>(`/leaves/${editingLeaveId}`, {
          method: "PUT",
          token,
          body: JSON.stringify({
            start_date: startDate,
            end_date: endDate,
            leave_type: leaveType,
            reason: reason || null,
          }),
        });
        setStatusMessage("Leave updated successfully.");
      } else {
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
      }
      resetForm();
      await loadLeaves(selectedEmployee, 1);
      await loadSummary(selectedEmployee);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record leave");
    }
  };

  const handleEdit = (leave: LeaveRecord) => {
    if (leave.is_penalty) return;
    setEditingLeaveId(leave.id);
    setStartDate(leave.start_date);
    setEndDate(leave.end_date);
    setLeaveType(leave.leave_type);
    setReason(leave.reason ?? "");
    setStatusMessage(`Editing leave from ${leave.start_date} to ${leave.end_date}`);
  };

  const handleDelete = async (leave: LeaveRecord) => {
    if (!token || !selectedEmployee) return;
    const confirmDelete = window.confirm(
      leave.is_penalty
        ? "Remove this penalty leave? This will forgive the deduction for that date."
        : "Remove this leave entry? This cannot be undone."
    );
    if (!confirmDelete) return;
    try {
      if (leave.is_penalty) {
        await apiFetch(`/leaves/penalties/${selectedEmployee}?penalty_date=${leave.start_date}`, {
          method: "DELETE",
          token,
        });
      } else {
        await apiFetch(`/leaves/${leave.id}`, {
          method: "DELETE",
          token,
        });
        if (editingLeaveId === leave.id) {
          resetForm();
        }
      }
      setStatusMessage(leave.is_penalty ? "Penalty leave removed." : "Leave entry removed.");
      await loadLeaves(selectedEmployee, page);
      await loadSummary(selectedEmployee);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete leave");
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

      {summary && (
        <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
          <article className="stat-card">
            <p>Paid leaves ({month})</p>
            <h3>{summaryLoading ? "…" : summary.paid_leave_days}</h3>
          </article>
          <article className="stat-card">
            <p>Unpaid leaves ({month})</p>
            <h3>{summaryLoading ? "…" : summary.unpaid_leave_days}</h3>
          </article>
          <article className="stat-card">
            <p>Penalty Fridays</p>
            <h3>{summaryLoading ? "…" : summary.penalty_fridays}</h3>
          </article>
          <article className="stat-card">
            <p>Penalty deduction</p>
            <h3>{summaryLoading ? "…" : formatCurrency(summary.penalty_deduction_amount)}</h3>
          </article>
          <article className="stat-card">
            <p>Overtime credit</p>
            <h3>{summaryLoading ? "…" : formatCurrency(summary.overtime_credit_amount)}</h3>
          </article>
        </div>
      )}

      <form
        className="form-grid"
        onSubmit={handleSubmit}
        style={{ maxWidth: "100%", marginBottom: "1.5rem" }}
      >
        <div style={{ gridColumn: "1 / -1" }}>
          <p className="form-note">
            {isEditing
              ? "Editing an existing leave entry. Update the fields below and save your changes."
              : "Record a new paid or unpaid leave window for the selected employee."}
          </p>
        </div>
        <label>
          <span>Select employee</span>
          <select
            value={selectedEmployee ?? ""}
            onChange={(event) => {
              const value = event.target.value ? Number(event.target.value) : null;
              setSelectedEmployee(value);
              setPage(1);
            }}
            disabled={isEditing}
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
            {isEditing ? "Update leave" : "Record leave"}
          </button>
          {isEditing && (
            <button
              type="button"
              className="button button--secondary"
              onClick={resetForm}
              style={{ marginLeft: "0.5rem" }}
            >
              Cancel edit
            </button>
          )}
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
              {isSuperAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isSuperAdmin ? 6 : 5} className="table-empty">
                  Loading leave records…
                </td>
              </tr>
            ) : leaves && leaves.items.length ? (
              leaves.items.map((leave) => (
                <tr key={leave.id}>
                  <td>{leave.start_date}</td>
                  <td>{leave.end_date}</td>
                  <td style={{ textTransform: "capitalize" }}>
                    {leave.leave_type}
                    {leave.is_penalty && (
                      <span
                        style={{
                          marginLeft: "0.5rem",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "999px",
                          backgroundColor: "#fff3cd",
                          color: "#8a6d3b",
                          fontSize: "0.75rem",
                        }}
                      >
                        Penalty
                      </span>
                    )}
                  </td>
                  <td>{leave.is_penalty ? "Penalty Friday (auto)" : leave.reason ?? "—"}</td>
                  <td>{formatDate12Hour(leave.created_at)}</td>
                  {isSuperAdmin && (
                    <td>
                      <div className="button-row" style={{ gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="button button--secondary"
                          onClick={() => handleEdit(leave)}
                          disabled={leave.is_penalty || !isSuperAdmin}
                          title={
                            !isSuperAdmin
                              ? "Only super admins can edit leaves"
                              : leave.is_penalty
                                ? "Penalty entries cannot be edited"
                                : undefined
                          }
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => handleDelete(leave)}
                          disabled={!isSuperAdmin}
                          title={!isSuperAdmin ? "Only super admins can delete leaves" : undefined}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isSuperAdmin ? 6 : 5} className="table-empty">
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
