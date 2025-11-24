import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { EmployeeMonthSummary, PaginatedPayroll } from "@/types/employee";

const formatCurrency = (value: string | number) =>
  `Rs ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : "—");

type InfoRow = {
  label: string;
  value: string;
  note?: string[];
  highlight?: boolean;
};

const PayrollPage = () => {
  const { token } = useAuth();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedPayroll | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<EmployeeMonthSummary | null>(null);
  const [paidAmount, setPaidAmount] = useState("0");
  const [additionalAdvance, setAdditionalAdvance] = useState("0");
  const [payNote, setPayNote] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  const loadPayroll = async (targetPage = page) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<PaginatedPayroll>(
        `/payroll?month=${month}&page=${targetPage}&page_size=10`,
        { token }
      );
      setData(result);
      if (result.page !== targetPage) {
        setPage(result.page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payroll data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setData(null);
      return;
    }
    loadPayroll(1);
  }, [token, month]);

  const openPayModal = (item: EmployeeMonthSummary) => {
    setSelectedPayroll(item);
    setPaidAmount(item.net_payable);
    setAdditionalAdvance("0");
    setPayNote("");
    setPayError(null);
    setIsPayModalOpen(true);
  };

  const closePayModal = () => {
    setIsPayModalOpen(false);
    setSelectedPayroll(null);
    setPaidAmount("0");
    setPayError(null);
    setPayLoading(false);
  };

  const handlePaySalary = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !selectedPayroll) return;
    const additionalValue = Number(additionalAdvance || 0);
    const paidValue = Number(paidAmount || 0);
    if (Number.isNaN(additionalValue) || additionalValue < 0) {
      setPayError("Additional advance must be a non-negative number.");
      return;
    }
    const net = Number(selectedPayroll.net_payable);
    if (paidValue < 0 || paidValue > net) {
      setPayError("Paid amount must be between 0 and net payable.");
      return;
    }
    setPayLoading(true);
    setPayError(null);
    try {
      await apiFetch(`/payroll/payments/${selectedPayroll.employee.id}`, {
        method: "POST",
        token,
        body: JSON.stringify({
          month: selectedPayroll.month,
          paid_amount: paidValue,
          additional_advance: additionalValue,
          note: payNote || null,
        }),
      });
      setStatusMessage(`Salary marked as paid for ${selectedPayroll.employee.name}.`);
      closePayModal();
      loadPayroll(page);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Unable to mark salary as paid");
    } finally {
      setPayLoading(false);
    }
  };

  const totals = useMemo(() => {
    if (!data) {
      return {
        payable: 0,
        penalty: 0,
        overtime: 0,
        overtimeHours: 0,
      };
    }
    return data.items.reduce(
      (acc, item) => {
        acc.payable += Number(item.net_payable);
        acc.penalty += Number(item.penalty_deduction_amount);
        acc.overtime += Number(item.overtime_credit_amount);
        acc.overtimeHours += Number(item.overtime_total_hours);
        return acc;
      },
      { payable: 0, penalty: 0, overtime: 0, overtimeHours: 0 }
    );
  }, [data]);

  const summaryStats = useMemo(() => {
    if (!data || data.items.length === 0) {
      return { total: 0, paid: 0, pending: 0, averageNet: 0, maxNet: 0, minNet: 0 };
    }
    let paid = 0;
    let pending = 0;
    let netSum = 0;
    let maxNet = Number.NEGATIVE_INFINITY;
    let minNet = Number.POSITIVE_INFINITY;
    data.items.forEach((item) => {
      const net = Number(item.net_payable);
      netSum += net;
      if (item.salary_paid) {
        paid += 1;
      } else {
        pending += 1;
      }
      if (net > maxNet) maxNet = net;
      if (net < minNet) minNet = net;
    });
    return {
      total: data.items.length,
      paid,
      pending,
      averageNet: netSum / data.items.length,
      maxNet: maxNet === Number.NEGATIVE_INFINITY ? 0 : maxNet,
      minNet: minNet === Number.POSITIVE_INFINITY ? 0 : minNet,
    };
  }, [data]);

  const snapshotRows: InfoRow[] = [
    {
      label: "Total net payable (page)",
      value: formatCurrency(totals.payable),
      highlight: true,
    },
    {
      label: "Average net payable",
      value: formatCurrency(summaryStats.averageNet || 0),
    },
    {
      label: "Penalty deductions (page)",
      value: formatCurrency(totals.penalty),
    },
    {
      label: "Overtime credits (page)",
      value: formatCurrency(totals.overtime),
    },
  ];

  const insightRows: InfoRow[] = [
    {
      label: "Highest net payable",
      value: summaryStats.total ? formatCurrency(summaryStats.maxNet) : "—",
    },
    {
      label: "Lowest net payable",
      value: summaryStats.total ? formatCurrency(summaryStats.minNet) : "—",
    },
    {
      label: "Overtime hours (page)",
      value: `${totals.overtimeHours.toFixed(2)} hrs`,
    },
  ];

  const metricCards = [
    { label: "Employees listed", value: summaryStats.total },
    { label: "Paid payouts", value: summaryStats.paid },
    { label: "Pending payouts", value: summaryStats.pending },
    { label: "Export-ready rows", value: data?.items.length ?? 0 },
  ];

  const handleExport = () => {
    if (!data || data.items.length === 0) return;
    const header = [
      "Employee Code",
      "Name",
      "Month",
      "Present Days",
      "Paid Leaves",
      "Unpaid Leaves",
      "Penalty Fridays",
      "Friday Bonus Days",
      "Penalty Deduction",
      "Overtime Days",
      "Overtime Hours",
      "Overtime Credit",
      "Monthly Salary",
      "Base Pay",
      "Advances (Initial)",
      "Advances (Month)",
      "Total Advances",
      "Net Payable",
    ];
    const rows = data.items.map((item) => [
      item.employee.employee_code,
      item.employee.name,
      item.month,
      item.present_days,
      item.paid_leave_days,
      item.unpaid_leave_days,
      item.penalty_fridays,
      item.friday_bonus_days,
      item.penalty_deduction_amount,
      item.overtime_full_days,
      item.overtime_total_hours,
      item.overtime_credit_amount,
      item.monthly_salary,
      item.base_pay_for_period,
      item.initial_advance ?? 0,
      item.total_month_advances,
      item.total_advances,
      item.net_payable,
    ]);
    const csvContent = [header, ...rows]
      .map((cols) => cols.map((col) => `"${col}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aeco-payroll-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <header className="section-header">
        <div>
          <h2>Payroll overview</h2>
          <p>Track monthly penalty adjustments, overtime credits, and salary payouts (including partial payments that reduce outstanding advances).</p>
        </div>
        <div className="page-actions">
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
          <div className="page-actions__buttons">
            <button
              type="button"
              className="button button--dark button--compact"
              onClick={handleExport}
              disabled={!data || data.items.length === 0}
            >
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {error && <p className="alert alert--error">{error}</p>}
      {statusMessage && <p className="alert alert--info">{statusMessage}</p>}

      <div className="detail-panels">
        <section className="detail-panel">
          <header className="detail-panel__header">
            <p className="panel-label">Snapshot</p>
            <h3>Payroll snapshot</h3>
            <p>Current page totals with penalty and overtime adjustments factored in.</p>
          </header>
          <div className="info-table">
            {snapshotRows.map((row) => (
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

        <section className="detail-panel">
          <header className="detail-panel__header">
            <p className="panel-label">Insights</p>
            <h3>Payout insights</h3>
            <p>High/low payouts and overtime trends that influence this run.</p>
          </header>
          <div className="info-table">
            {insightRows.map((row) => (
              <div key={row.label} className="info-row">
                <div className="info-label">{row.label}</div>
                <div className="info-value">
                  <strong>{row.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <header className="detail-panel__header">
            <p className="panel-label">Status</p>
            <h3>Workforce coverage</h3>
            <p>Quick view of how many payrolls are pending versus paid.</p>
          </header>
          <div className="metric-grid">
            {metricCards.map((metric) => (
              <article key={metric.label} className="metric-card">
                <p>{metric.label}</p>
                <h4>{metric.value}</h4>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="table-wrapper" style={{ marginTop: "2rem" }}>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th>Present</th>
              <th>Paid leave</th>
              <th>Unpaid leave</th>
              <th>Penalty (Fridays)</th>
              <th>Friday bonus</th>
              <th>Penalty deduction</th>
              <th>Overtime days</th>
              <th>Overtime hours</th>
              <th>Overtime credit</th>
              <th>Base pay</th>
              <th>Advances (init / month)</th>
              <th>Net payable</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
              {loading ? (
                <tr>
                <td colSpan={14} className="table-empty">
                    Loading payroll…
                  </td>
                </tr>
              ) : data && data.items.length ? (
              data.items.map((item) => (
                <tr key={item.employee.id}>
                  <td>
                    <div>
                      <strong>{item.employee.employee_code}</strong>
                      <div>{item.employee.name}</div>
                    </div>
                  </td>
                  <td>
                    {item.salary_paid ? (
                      <div>
                        <span className="status-badge status-badge--paid">Paid</span>
                        <div className="muted small">{formatDate(item.salary_paid_on)}</div>
                        {item.salary_paid_advance_reduction && (
                          <div className="muted small">
                            Advance reduced: {formatCurrency(item.salary_paid_advance_reduction)}
                          </div>
                        )}
                        {item.salary_remaining_initial_advance && (
                          <div className="muted small">
                            Remaining advance: {formatCurrency(item.salary_remaining_initial_advance)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="status-badge status-badge--pending">Pending</span>
                    )}
                  </td>
                  <td>{item.present_days}</td>
                  <td>{item.paid_leave_days}</td>
                  <td>{item.unpaid_leave_days}</td>
                  <td>{item.penalty_fridays}</td>
                  <td>{Number(item.friday_bonus_days).toFixed(2)}</td>
                  <td>{formatCurrency(item.penalty_deduction_amount)}</td>
                  <td>{item.overtime_full_days}</td>
                  <td>{item.overtime_total_hours.toFixed(2)}</td>
                  <td>{formatCurrency(item.overtime_credit_amount)}</td>
                  <td>{formatCurrency(item.base_pay_for_period)}</td>
                  <td>
                    <div>
                      <div>Initial: {formatCurrency(item.initial_advance ?? 0)}</div>
                      <div>This month: {formatCurrency(item.total_month_advances)}</div>
                    </div>
                  </td>
                  <td>
                    <div>{formatCurrency(item.net_payable)}</div>
                    {item.pending_advances_balance && (
                      <div className="muted small">
                        Adjustments: {formatCurrency(item.pending_advances_balance)}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="payroll-table-actions">
                      <Link to={`/employees/${item.employee.id}`} className="button button--outline button--compact">
                        View
                      </Link>
                      <button
                        type="button"
                        className="button button--accent button--compact"
                        disabled={item.salary_paid}
                        onClick={() => openPayModal(item)}
                      >
                        Pay salary
                      </button>
                    </div>
                  </td>
                </tr>
              ))
              ) : (
                <tr>
                <td colSpan={14} className="table-empty">
                    No payroll data for this month.
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
              loadPayroll(newPage);
            }
          }}
          disabled={page === 1}
        >
          Previous
        </button>
        <span>
          Page {data?.page ?? page} of {data?.pages ?? 1}
        </span>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            if (data) {
              const newPage = Math.min(page + 1, data.pages);
              if (page < data.pages) {
                setPage(newPage);
                loadPayroll(newPage);
              }
            }
          }}
          disabled={data ? page >= data.pages : true}
        >
          Next
        </button>
      </footer>

      {isPayModalOpen && selectedPayroll && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <header>
              <h3>Pay salary — {selectedPayroll.employee.name}</h3>
              <button type="button" className="link muted" onClick={closePayModal}>
                Close
              </button>
            </header>
            <div className="modal-body">
              <p>
                Net payable: <strong>{formatCurrency(selectedPayroll.net_payable)}</strong>
              </p>
              <p>
                Penalty deduction: <strong>{formatCurrency(selectedPayroll.penalty_deduction_amount)}</strong>
              </p>
              <p>
                Overtime credit: <strong>{formatCurrency(selectedPayroll.overtime_credit_amount)}</strong>
              </p>
              <p className="muted">
                Outstanding initial advance: {formatCurrency(selectedPayroll.initial_advance ?? 0)}
              </p>
            </div>
            {payError && <p className="alert alert--error">{payError}</p>}
            <form className="form-grid" onSubmit={handlePaySalary}>
              <label>
                <span>Paid amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidAmount}
                  onChange={(event) => setPaidAmount(event.target.value)}
                />
                <small className="muted">
                  Net payable: {formatCurrency(selectedPayroll.net_payable)}. Paying less than net will reduce the
                  employee's initial advance balance.
                </small>
              </label>
              <label>
                <span>Additional advance</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={additionalAdvance}
                  onChange={(event) => setAdditionalAdvance(event.target.value)}
                />
              </label>
              <label>
                <span>Note (optional)</span>
                <textarea
                  value={payNote}
                  onChange={(event) => setPayNote(event.target.value)}
                  rows={3}
                  placeholder="Any remarks for this payout"
                />
              </label>
              <div className="form-actions right">
                <button type="button" className="button button--secondary" onClick={closePayModal}>
                  Cancel
                </button>
                <button type="submit" className="button button--primary" disabled={payLoading}>
                  {payLoading ? "Processing…" : "Confirm payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default PayrollPage;
