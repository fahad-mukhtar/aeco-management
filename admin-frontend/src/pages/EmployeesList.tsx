import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { PaginatedEmployees } from "@/types/employee";

const PAGE_SIZE = 10;

const EmployeesList = () => {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedEmployees | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSuperAdmin = user?.role === "super_admin";
  const columnCount = 8;

  useEffect(() => {
    if (!token) {
      return;
    }

    const fetchEmployees = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await apiFetch<PaginatedEmployees>(
          `/employees?page=${page}&page_size=${PAGE_SIZE}`,
          { token }
        );
        setData(result);
        if (result.page !== page) {
          setPage(result.page);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load employees";
        if (message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("credentials")) {
          logout();
          navigate("/login", { replace: true });
        } else {
          setError(message);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployees();
  }, [page, token, logout, navigate]);

  const handlePrev = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNext = () => {
    if (!data) return;
    setPage((prev) => Math.min(prev + 1, data.pages));
  };

  return (
    <section>
      <header className="section-header">
        <div>
          <h2>Employees</h2>
          <p>Manage attendance-ready employee records.</p>
        </div>
        {isSuperAdmin && (
          <Link to="/employees/new" className="button button--primary">
            Add employee
          </Link>
        )}
      </header>

      {error && <p className="alert alert--error">{error}</p>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Monthly Salary</th>
              <th>Per Day</th>
              <th>Regular</th>
              <th>Joining Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columnCount} className="table-empty">
                  Loading employees…
                </td>
              </tr>
            ) : data && data.items.length > 0 ? (
              data.items.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.employee_code}</td>
                  <td>{employee.name}</td>
                  <td>{employee.designation}</td>
                  <td>Rs {Number(employee.monthly_salary).toLocaleString()}</td>
                  <td>
                    {employee.per_day_salary
                      ? `Rs ${Number(employee.per_day_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td>{employee.regular_employee ? "Yes" : "No"}</td>
                  <td>{employee.joining_date ?? "—"}</td>
                  <td className="actions-cell">
                    <Link to={`/employees/${employee.id}`} className="link">
                      View
                    </Link>
                    {isSuperAdmin && (
                      <Link to={`/employees/${employee.id}/edit`} className="link muted">
                        Edit
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columnCount} className="table-empty">
                  No employees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="pagination">
        <button type="button" className="button button--secondary" onClick={handlePrev} disabled={page === 1}>
          Previous
        </button>
        <span>
          Page {data?.page ?? page} of {data?.pages ?? 1}
        </span>
        <button
          type="button"
          className="button button--secondary"
          onClick={handleNext}
          disabled={data ? page >= data.pages : true}
        >
          Next
        </button>
      </footer>
    </section>
  );
};

export default EmployeesList;
