import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type {
  AttendanceRecord,
  DailyAdvance,
  EmployeeMonthSummary,
  PaginatedAttendance,
  PaginatedDailyAdvance,
} from "@/types/employee";
import { formatTime12Hour } from "@/utils/time";

const formatCurrency = (value: string | number) =>
  `Rs ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const EmployeeDetail = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [summary, setSummary] = useState<EmployeeMonthSummary | null>(null);
  const [attendanceData, setAttendanceData] = useState<PaginatedAttendance | null>(null);
  const [advancesData, setAdvancesData] = useState<PaginatedDailyAdvance | null>(null);
  const [attendancePage, setAttendancePage] = useState(1);
  const [advancePage, setAdvancePage] = useState(1);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeName = useMemo(() => summary?.employee.name ?? "Employee", [summary?.employee.name]);

  useEffect(() => {
    if (!employeeId || !token) return;
    const controller = new AbortController();
    const fetchSummary = async () => {
      setLoadingSummary(true);
      setError(null);
      try {
        const result = await apiFetch<EmployeeMonthSummary>(
          `/employees/${employeeId}/summary?month=${month}`,
          { token }
        );
        setSummary(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load employee summary");
      } finally {
        setLoadingSummary(false);
      }
    };
    fetchSummary();
    return () => controller.abort();
  }, [employeeId, token, month]);

  useEffect(() => {
    if (!employeeId || !token) return;
    const fetchAttendance = async () => {
      setLoadingAttendance(true);
      try {
        const result = await apiFetch<PaginatedAttendance>(
          `/attendance/by-employee/${employeeId}?month=${month}&page=${attendancePage}&page_size=10`,
          { token }
        );
        setAttendanceData(result);
        if (result.page !== attendancePage) {
          setAttendancePage(result.page);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load attendance history");
      } finally {
        setLoadingAttendance(false);
      }
    };
    fetchAttendance();
  }, [employeeId, token, month, attendancePage]);

  useEffect(() => {
    if (!employeeId || !token) return;
    const fetchAdvances = async () => {
      setLoadingAdvances(true);
      try {
        const result = await apiFetch<PaginatedDailyAdvance>(
          `/attendance/advances/by-employee/${employeeId}?month=${month}&page=${advancePage}&page_size=10`,
          { token }
        );
        setAdvancesData(result);
        if (result.page !== advancePage) {
          setAdvancePage(result.page);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load daily advances");
      } finally {
        setLoadingAdvances(false);
      }
    };
    fetchAdvances();
  }, [employeeId, token, month, advancePage]);

  if (!employeeId) {
    return (
      <section>
        <p className="alert alert--error">Employee not found.</p>
        <button type="button" className="button button--secondary" onClick={() => navigate("/employees")}>
          Back to employees
        </button>
      </section>
    );
  }

  return (
    <section>
      <header className="section-header">
        <div>
          <h2>{employeeName}</h2>
          <p>Monthly attendance and allowances for AECO staff.</p>
        </div>
        <div className="button-row">
          <label className="month-picker">
            <span>Month</span>
            <input
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setAttendancePage(1);
                setAdvancePage(1);
              }}
            />
          </label>
          <Link to="/employees" className="button button--secondary">
            Back to list
          </Link>
        </div>
      </header>

      {error && <p className="alert alert--error">{error}</p>}

      <div className="stats-grid">
        <article className="stat-card">
          <p>Monthly salary</p>
          <h3>{summary ? formatCurrency(summary.monthly_salary) : "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Initial advance</p>
          <h3>{summary ? formatCurrency(summary.initial_advance ?? 0) : "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Advances this month</p>
          <h3>{summary ? formatCurrency(summary.total_month_advances) : "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Total advances</p>
          <h3>{summary ? formatCurrency(summary.total_advances) : "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Present days</p>
          <h3>{summary?.present_days ?? "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Full days</p>
          <h3>{summary?.full_days ?? "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Half days</p>
          <h3>{summary?.half_days ?? "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Paid leaves</p>
          <h3>{summary?.paid_leave_days ?? "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Unpaid leaves</p>
          <h3>{summary?.unpaid_leave_days ?? "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Hours worked</p>
          <h3>{summary ? summary.total_worked_hours.toFixed(2) : "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Penalty Fridays</p>
          <h3>{summary?.penalty_fridays ?? 0}</h3>
        </article>
        <article className="stat-card">
          <p>Overtime credit days</p>
          <h3>{summary?.overtime_full_days ?? 0}</h3>
        </article>
        <article className="stat-card">
          <p>Penalty deduction</p>
          <h3>{summary ? formatCurrency(summary.penalty_deduction_amount) : "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Overtime credit</p>
          <h3>{summary ? formatCurrency(summary.overtime_credit_amount) : "—"}</h3>
        </article>
        <article className="stat-card">
          <p>Per-day salary ({month})</p>
          <h3>{summary ? formatCurrency(summary.per_day_salary_for_month) : "—"}</h3>
        </article>
        <article className="stat-card highlight">
          <p>Net payable</p>
          <h3>{summary ? formatCurrency(summary.net_payable) : "—"}</h3>
        </article>
      </div>

      <h3 style={{ marginTop: "2rem" }}>Attendance</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Clock in</th>
              <th>Clock out</th>
              <th>Worked hours</th>
              <th>Day type</th>
            </tr>
          </thead>
          <tbody>
            {loadingAttendance ? (
              <tr>
                <td colSpan={4} className="table-empty">
                  Loading attendance…
                </td>
              </tr>
            ) : attendanceData && attendanceData.items.length > 0 ? (
              attendanceData.items.map((record: AttendanceRecord) => (
                <tr key={record.id}>
                  <td>{record.work_date}</td>
                  <td>{formatTime12Hour(record.clock_in)}</td>
                  <td>{record.clock_out ? formatTime12Hour(record.clock_out) : "—"}</td>
                  <td>{(record.worked_minutes / 60).toFixed(2)} hrs</td>
                  <td style={{ textTransform: "capitalize" }}>{record.day_type ?? "pending"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="table-empty">
                  No attendance records this month.
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
          onClick={() => setAttendancePage((prev) => Math.max(prev - 1, 1))}
          disabled={attendancePage === 1}
        >
          Previous
        </button>
        <span>
          Page {attendanceData?.page ?? attendancePage} of {attendanceData?.pages ?? 1}
        </span>
        <button
          type="button"
          className="button button--secondary"
          onClick={() =>
            attendanceData
              ? setAttendancePage((prev) => Math.min(prev + 1, attendanceData.pages))
              : setAttendancePage((prev) => prev)
          }
          disabled={attendanceData ? attendancePage >= attendanceData.pages : true}
        >
          Next
        </button>
      </footer>

      <h3 style={{ marginTop: "2rem" }}>Daily advances</h3>
      <div className="info-strip">
        <div>
          <p>Total advances (initial + month)</p>
          <h4>{summary ? formatCurrency(summary.total_advances) : "—"}</h4>
        </div>
        <small>Includes opening advance plus all allowances recorded during {month}.</small>
      </div>
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
            {loadingAdvances ? (
              <tr>
                <td colSpan={3} className="table-empty">
                  Loading advances…
                </td>
              </tr>
            ) : advancesData && advancesData.items.length > 0 ? (
              advancesData.items.map((advance: DailyAdvance) => (
                <tr key={advance.id}>
                  <td>{advance.recorded_for}</td>
                  <td>{formatCurrency(advance.amount)}</td>
                  <td>{advance.note ?? "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="table-empty">
                  No advances recorded.
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
          onClick={() => setAdvancePage((prev) => Math.max(prev - 1, 1))}
          disabled={advancePage === 1}
        >
          Previous
        </button>
        <span>
          Page {advancesData?.page ?? advancePage} of {advancesData?.pages ?? 1}
        </span>
        <button
          type="button"
          className="button button--secondary"
          onClick={() =>
            advancesData ? setAdvancePage((prev) => Math.min(prev + 1, advancesData.pages)) : undefined
          }
          disabled={advancesData ? advancePage >= advancesData.pages : true}
        >
          Next
        </button>
      </footer>
    </section>
  );
};

export default EmployeeDetail;
