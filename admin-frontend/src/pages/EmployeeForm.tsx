import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type { Employee } from "@/types/employee";

type FormState = {
  name: string;
  designation: string;
  monthly_salary: string;
  per_day_salary: string;
  regular_employee: boolean;
  daily_allowance: string;
  advance_payment_received: string;
  advance_pending: string;
  joining_date: string;
};

const emptyState: FormState = {
  name: "",
  designation: "",
  monthly_salary: "",
  per_day_salary: "",
  regular_employee: true,
  daily_allowance: "",
  advance_payment_received: "",
  advance_pending: "",
  joining_date: "",
};

const EmployeeForm = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const isEditMode = Boolean(employeeId);

  const [form, setForm] = useState<FormState>(() => ({ ...emptyState }));
  const [employeeCode, setEmployeeCode] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) {
      setForm({ ...emptyState });
      setEmployeeCode(null);
      return;
    }
  }, [employeeId]);

  useEffect(() => {
    const loadEmployee = async () => {
      if (!token || !employeeId) return;
      setIsFetching(true);
      try {
        const data = await apiFetch<Employee>(`/employees/${employeeId}`, { token });
        setForm({
          name: data.name,
          designation: data.designation,
          monthly_salary: data.monthly_salary ?? "",
          per_day_salary: data.per_day_salary ?? "",
          regular_employee: data.regular_employee,
          daily_allowance: data.daily_allowance ?? "",
          advance_payment_received: data.advance_payment_received ?? "",
          advance_pending: data.advance_pending ?? "",
          joining_date: data.joining_date ?? "",
        });
        setEmployeeCode(data.employee_code);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load employee";
        setError(message);
      } finally {
        setIsFetching(false);
      }
    };

    loadEmployee();
  }, [employeeId, token]);

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = field === "regular_employee" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setIsSubmitting(true);

    const payload = {
      name: form.name.trim(),
      designation: form.designation.trim(),
      monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : 0,
      regular_employee: form.regular_employee,
      daily_allowance: form.daily_allowance ? Number(form.daily_allowance) : null,
      advance_payment_received: form.advance_payment_received
        ? Number(form.advance_payment_received)
        : null,
      advance_pending: form.advance_pending ? Number(form.advance_pending) : null,
      joining_date: form.joining_date || null,
    };

    try {
      if (isEditMode) {
        await apiFetch<Employee>(`/employees/${employeeId}`, {
          method: "PUT",
          token,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<Employee>("/employees", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
      }
      navigate("/employees");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save employee";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isEditMode ? "Edit employee" : "Add employee";

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <section>
      <header className="section-header">
        <div>
          <h2>{title}</h2>
          <p>Keep employee information current for attendance tracking.</p>
        </div>
      </header>

      {error && <p className="alert alert--error">{error}</p>}
      {isFetching && <p className="alert alert--info">Loading employee details…</p>}

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field info-field">
          <span>Employee ID</span>
          <p>{employeeCode ?? "Will be generated automatically after saving"}</p>
        </div>
        <div className="form-field info-field">
          <span>Per day salary</span>
          <p>
            {form.per_day_salary
              ? `Rs ${Number(form.per_day_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : "Calculated from monthly salary"}
          </p>
        </div>
        <label>
          <span>Name</span>
          <input
            type="text"
            value={form.name}
            onChange={handleChange("name")}
            required
            disabled={isFetching || isSubmitting}
          />
        </label>
        <label>
          <span>Designation</span>
          <input
            type="text"
            value={form.designation}
            onChange={handleChange("designation")}
            required
            disabled={isFetching || isSubmitting}
          />
        </label>
        <label>
          <span>Monthly salary</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.monthly_salary}
            onChange={handleChange("monthly_salary")}
            required
            disabled={isFetching || isSubmitting}
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.regular_employee}
            onChange={handleChange("regular_employee")}
            disabled={isFetching || isSubmitting}
          />
          <span>Regular employee</span>
        </label>
        <label>
          <span>Daily allowance</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.daily_allowance}
            onChange={handleChange("daily_allowance")}
            disabled={isFetching || isSubmitting}
          />
        </label>
        <label>
          <span>Advance payment received</span>
          <input
            type="number"
            step="0.01"
            value={form.advance_payment_received}
            onChange={handleChange("advance_payment_received")}
            disabled={isFetching || isSubmitting}
          />
        </label>
        <label>
          <span>Advance pending</span>
          <input
            type="number"
            step="0.01"
            value={form.advance_pending}
            onChange={handleChange("advance_pending")}
            disabled={isFetching || isSubmitting}
          />
        </label>
        <label>
          <span>Joining date</span>
          <input
            type="date"
            value={form.joining_date}
            onChange={handleChange("joining_date")}
            disabled={isFetching || isSubmitting}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="button button--secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={isSubmitting || !isSuperAdmin}
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
        {!isSuperAdmin && (
          <p className="alert alert--info">
            Only super administrators can create or update employee records.
          </p>
        )}
      </form>
    </section>
  );
};

export default EmployeeForm;
