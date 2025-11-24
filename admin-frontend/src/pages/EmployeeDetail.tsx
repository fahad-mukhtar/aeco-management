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
  PaginatedSalaryPayments,
  SalaryPayment,
} from "@/types/employee";
import { formatTime12Hour } from "@/utils/time";

const formatCurrency = (value: string | number) =>
  `Rs ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

type InfoRow = {
  label: string;
  value: string;
  highlight?: boolean;
  note?: string[];
};

const EmployeeDetail = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
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
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const isSuperAdmin = user?.role === "super_admin";

  const employeeName = useMemo(() => summary?.employee.name ?? "Employee", [summary?.employee.name]);

  useEffect(() => {
    if (!employeeId || !token || !isSuperAdmin) return;
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

  useEffect(() => {
    if (!employeeId || !token) return;
    let ignore = false;
    const fetchPayments = async () => {
      setLoadingPayments(true);
      setPaymentsError(null);
      try {
        const result = await apiFetch<PaginatedSalaryPayments>(
          `/payroll/payments?employee_id=${employeeId}&page=1&page_size=5`,
          { token }
        );
        if (!ignore) {
          setSalaryPayments(result.items);
        }
      } catch (err) {
        if (!ignore) {
          setPaymentsError(err instanceof Error ? err.message : "Unable to load salary payments");
        }
      } finally {
        if (!ignore) {
          setLoadingPayments(false);
        }
      }
    };
    fetchPayments();
    return () => {
      ignore = true;
    };
  }, [employeeId, token, isSuperAdmin]);

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

  const compensationRows: InfoRow[] = [
    {
      label: "Monthly salary",
      value: summary ? formatCurrency(summary.monthly_salary) : "—",
    },
    {
      label: "Earned this month",
      value: summary ? formatCurrency(summary.base_pay_for_period) : "—",
    },
    {
      label: `Per-day salary (${month})`,
      value: summary ? formatCurrency(summary.per_day_salary_for_month) : "—",
    },
    {
      label: "Initial advance",
      value: summary ? formatCurrency(summary.initial_advance ?? "0") : "—",
    },
    {
      label: "Advances this month",
      value: summary ? formatCurrency(summary.total_month_advances ?? "0") : "—",
    },
    summary
      ? {
          label: "Total advances",
          value: formatCurrency(summary.total_advances ?? "0"),
          note: [`Outstanding adjustments: ${formatCurrency(summary.pending_advances_balance ?? "0")}`],
        }
      : null,
    summary?.salary_remaining_initial_advance
      ? {
          label: "Remaining initial advance",
          value: formatCurrency(summary.salary_remaining_initial_advance),
        }
      : null,
  ].filter(Boolean) as InfoRow[];

  const attendanceMetrics = [
    { label: "Present days", value: summary?.present_days ?? "—" },
    { label: "Full days", value: summary?.full_days ?? "—" },
    { label: "Half days", value: summary?.half_days ?? "—" },
    { label: "Paid leaves", value: summary?.paid_leave_days ?? "—" },
    { label: "Unpaid leaves", value: summary?.unpaid_leave_days ?? "—" },
    { label: "Penalty Fridays", value: summary?.penalty_fridays ?? "—" },
    { label: "Friday bonus days", value: summary ? Number(summary.friday_bonus_days).toFixed(2) : "—" },
    { label: "Hours worked", value: summary ? `${summary.total_worked_hours.toFixed(2)} hrs` : "—" },
    { label: "Overtime credit days", value: summary?.overtime_full_days ?? "—" },
    { label: "Overtime hours", value: summary ? `${summary.overtime_total_hours.toFixed(2)} hrs` : "—" },
  ];

  const overtimeNotes =
    summary && (summary.overtime_full_days || summary.overtime_total_hours)
      ? [
          `Converted days: ${summary.overtime_full_days ?? 0}`,
          `Hours logged: ${summary.overtime_total_hours.toFixed(2)}`,
        ]
      : undefined;

  const salaryNotes: string[] = [];
  if (summary?.salary_paid_amount) {
    salaryNotes.push(`Amount: ${formatCurrency(summary.salary_paid_amount)}`);
  }
  if (summary?.salary_paid_note) {
    salaryNotes.push(summary.salary_paid_note);
  }
  if (summary?.salary_paid_advance_reduction) {
    salaryNotes.push(
      `Advance reduced: ${formatCurrency(summary.salary_paid_advance_reduction)}; extra advance: ${formatCurrency(
        summary.salary_paid_additional_advance ?? "0"
      )}`
    );
  }
  if (summary?.salary_remaining_initial_advance) {
    salaryNotes.push(`Remaining initial advance: ${formatCurrency(summary.salary_remaining_initial_advance)}`);
  }
  if (summary?.salary_pending_advance_after) {
    salaryNotes.push(`Pending advance after payout: ${formatCurrency(summary.salary_pending_advance_after)}`);
  }

  const payrollRows: InfoRow[] = [
    {
      label: "Penalty deduction",
      value: summary ? formatCurrency(summary.penalty_deduction_amount ?? "0") : "—",
    },
    {
      label: "Overtime credit",
      value: summary ? formatCurrency(summary.overtime_credit_amount ?? "0") : "—",
      note: overtimeNotes,
    },
    {
      label: "Net payable",
      value: summary ? formatCurrency(summary.net_payable) : "—",
      highlight: true,
    },
    {
      label: "Salary status",
      value: summary?.salary_paid
        ? `Paid ${summary.salary_paid_on ? new Date(summary.salary_paid_on).toLocaleDateString() : ""}`
        : "Pending",
      note: salaryNotes.length ? salaryNotes : undefined,
    },
  ];

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

      <div className="detail-panels">
        <section className="detail-panel">
          <header className="detail-panel__header">
            <p className="panel-label">Compensation</p>
            <h3>Compensation & Advances</h3>
            <p>Baseline pay, monthly earnings, and advance health for {employeeName}.</p>
          </header>
          <div className="info-table">
            {compensationRows.map((row) => (
              <div key={row.label} className="info-row">
                <div className="info-label">{row.label}</div>
                <div className="info-value">
                  <strong>{row.value}</strong>
                  {row.note &&
                    row.note.map((noteLine, index) => (
                      <span key={`${row.label}-${index}`} className="info-note">
                        {noteLine}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <header className="detail-panel__header">
            <p className="panel-label">Attendance</p>
            <h3>Attendance & Leave Summary</h3>
            <p>Track presence, leave mix, and total time captured for the selected month.</p>
          </header>
          <div className="metric-grid">
            {attendanceMetrics.map((metric) => (
              <article key={metric.label} className="metric-card">
                <p>{metric.label}</p>
                <h4>{metric.value}</h4>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <header className="detail-panel__header">
            <p className="panel-label">Payroll</p>
            <h3>Adjustments & Status</h3>
            <p>Penalty, overtime, and payout status for the pay period.</p>
          </header>
          <div className="info-table">
            {payrollRows.map((row) => (
              <div key={row.label} className={`info-row${row.highlight ? " info-row--highlight" : ""}`}>
                <div className="info-label">{row.label}</div>
                <div className="info-value">
                  <strong>{row.value}</strong>
                  {row.note &&
                    row.note.map((noteLine, index) => (
                      <span key={`${row.label}-${index}`} className="info-note">
                        {noteLine}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {isSuperAdmin && (
        <section style={{ marginTop: "2rem" }}>
          <div className="section-header" style={{ marginBottom: "0.5rem" }}>
            <h3>Salary payments</h3>
          </div>
          {paymentsError && <p className="alert alert--error">{paymentsError}</p>}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Paid amount</th>
                <th>Extra advance</th>
                <th>Advance reduction</th>
                <th>Initial advance after</th>
                <th>Carry forward</th>
                <th>Pending after</th>
                <th>Paid on</th>
                <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {loadingPayments ? (
                  <tr>
                  <td colSpan={9} className="table-empty">
                      Loading salary payments…
                    </td>
                  </tr>
                ) : salaryPayments.length ? (
                  salaryPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.month}</td>
                      <td>{formatCurrency(payment.paid_amount)}</td>
                    <td>{formatCurrency(payment.additional_advance)}</td>
                    <td>{formatCurrency(payment.advance_reduction_amount)}</td>
                    <td>{formatCurrency(payment.initial_advance_after)}</td>
                    <td>{formatCurrency(payment.carry_forward_advance)}</td>
                    <td>{formatCurrency(payment.pending_advance_after)}</td>
                      <td>{new Date(payment.paid_on).toLocaleString()}</td>
                      <td>{payment.note ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                  <td colSpan={9} className="table-empty">
                      No salary payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
