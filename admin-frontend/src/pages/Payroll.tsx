import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { EmployeeMonthSummary, PaginatedPayroll } from "@/types/employee";

const formatCurrency = (value: string | number) =>
  `Rs ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

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

  const totals = useMemo(() => {
    if (!data) {
      return {
        payable: 0,
        penalty: 0,
        overtime: 0,
      };
    }
    return data.items.reduce(
      (acc, item) => {
        acc.payable += Number(item.net_payable);
        acc.penalty += Number(item.penalty_deduction_amount);
        acc.overtime += Number(item.overtime_credit_amount);
        return acc;
      },
      { payable: 0, penalty: 0, overtime: 0 }
    );
  }, [data]);

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
      "Penalty Deduction",
      "Overtime Days",
      "Overtime Credit",
      "Monthly Salary",
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
      item.penalty_deduction_amount,
      item.overtime_full_days,
      item.overtime_credit_amount,
      item.monthly_salary,
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
          <p>Track monthly penalty adjustments and overtime credits before finalising salaries.</p>
        </div>
        <div className="button-row">
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
          <button
            type="button"
            className="button button--secondary"
            onClick={handleExport}
            disabled={!data || data.items.length === 0}
          >
            Export CSV
          </button>
        </div>
      </header>

      {error && <p className="alert alert--error">{error}</p>}

      <div className="stats-grid">
        <article className="stat-card highlight">
          <p>Total net payable (page)</p>
          <h3>{formatCurrency(totals.payable)}</h3>
        </article>
        <article className="stat-card">
          <p>Penalty deductions</p>
          <h3>{formatCurrency(totals.penalty)}</h3>
        </article>
        <article className="stat-card">
          <p>Overtime credits</p>
          <h3>{formatCurrency(totals.overtime)}</h3>
        </article>
      </div>

      <div className="table-wrapper" style={{ marginTop: "2rem" }}>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Present</th>
              <th>Paid leave</th>
              <th>Unpaid leave</th>
              <th>Penalty (Fridays)</th>
              <th>Penalty deduction</th>
              <th>Overtime days</th>
              <th>Overtime credit</th>
              <th>Advances (init / month)</th>
              <th>Net payable</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="table-empty">
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
                  <td>{item.present_days}</td>
                  <td>{item.paid_leave_days}</td>
                  <td>{item.unpaid_leave_days}</td>
                  <td>{item.penalty_fridays}</td>
                  <td>{formatCurrency(item.penalty_deduction_amount)}</td>
                  <td>{item.overtime_full_days}</td>
                  <td>{formatCurrency(item.overtime_credit_amount)}</td>
                  <td>
                    <div>
                      <div>Initial: {formatCurrency(item.initial_advance ?? 0)}</div>
                      <div>This month: {formatCurrency(item.total_month_advances)}</div>
                    </div>
                  </td>
                  <td>{formatCurrency(item.net_payable)}</td>
                  <td>
                    <Link to={`/employees/${item.employee.id}`} className="button button--secondary">
                      View
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11} className="table-empty">
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
    </section>
  );
};

export default PayrollPage;
