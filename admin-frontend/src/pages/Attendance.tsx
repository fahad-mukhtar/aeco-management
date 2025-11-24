import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import type {
  AttendanceRecord,
  PaginatedAttendance,
  Employee,
  PaginatedEmployees,
} from "@/types/employee";
import { formatDate12Hour, formatTime12Hour } from "@/utils/time";

type PickerState = {
  date: string;
  hour: string;
  minute: string;
  period: "AM" | "PM";
};

const hourOptions = Array.from({ length: 12 }, (_, idx) => String(idx + 1).padStart(2, "0"));
const minuteOptions = Array.from({ length: 12 }, (_, idx) => String(idx * 5).padStart(2, "0"));
const periodOptions: PickerState["period"][] = ["AM", "PM"];

const createPickerState = (date: Date): PickerState => {
  const pad = (val: number) => String(val).padStart(2, "0");
  const hours = date.getHours();
  return {
    date: date.toISOString().slice(0, 10),
    hour: pad((hours % 12) || 12),
    minute: pad(date.getMinutes()),
    period: hours >= 12 ? "PM" : "AM",
  };
};

const createEmptyPickerState = (baseDate?: string): PickerState => ({
  date: baseDate ?? "",
  hour: "08",
  minute: "00",
  period: "AM",
});

const pickerStateToISO = (picker: PickerState): string | undefined => {
  if (!picker.date) {
    return undefined;
  }
  const [yearStr, monthStr, dayStr] = picker.date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  let hour = Number(picker.hour);
  const minute = Number(picker.minute);
  if ([year, month, day, hour, minute].some((val) => Number.isNaN(val))) {
    return undefined;
  }
  hour = hour % 12;
  if (picker.period === "PM") {
    hour += 12;
  }
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
};

const TimePickerControls = ({
  state,
  onChange,
  disabled,
}: {
  state: PickerState;
  onChange: Dispatch<SetStateAction<PickerState>>;
  disabled?: boolean;
}) => (
  <div className="time-picker">
    <input
      type="date"
      value={state.date}
      onChange={(event) => onChange((prev) => ({ ...prev, date: event.target.value }))}
      disabled={disabled}
    />
    <select
      value={state.hour}
      onChange={(event) => onChange((prev) => ({ ...prev, hour: event.target.value }))}
      disabled={disabled}
    >
      {hourOptions.map((hour) => (
        <option key={hour} value={hour}>
          {hour}
        </option>
      ))}
    </select>
    <span className="time-picker__colon">:</span>
    <select
      value={state.minute}
      onChange={(event) => onChange((prev) => ({ ...prev, minute: event.target.value }))}
      disabled={disabled}
    >
      {minuteOptions.map((minute) => (
        <option key={minute} value={minute}>
          {minute}
        </option>
      ))}
    </select>
    <select
      value={state.period}
      onChange={(event) =>
        onChange((prev) => ({ ...prev, period: event.target.value as PickerState["period"] }))
      }
      disabled={disabled}
    >
      {periodOptions.map((period) => (
        <option key={period} value={period}>
          {period}
        </option>
      ))}
    </select>
  </div>
);

const AttendancePage = () => {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [attendanceData, setAttendanceData] = useState<PaginatedAttendance | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [attendancePage, setAttendancePage] = useState(1);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todayIso = () => new Date().toISOString().slice(0, 10);
  const defaultClockInPicker = (): PickerState => ({
    date: todayIso(),
    hour: "08",
    minute: "00",
    period: "AM",
  });
  const defaultClockOutPicker = (): PickerState => ({
    date: todayIso(),
    hour: "05",
    minute: "00",
    period: "PM",
  });

  const [clockInPicker, setClockInPicker] = useState<PickerState>(() => defaultClockInPicker());
  const [clockOutPicker, setClockOutPicker] = useState<PickerState>(() => defaultClockOutPicker());
  const [customClockInEnabled, setCustomClockInEnabled] = useState(false);
  const [customClockOutEnabled, setCustomClockOutEnabled] = useState(false);
  const [clockAction, setClockAction] = useState<"clock-in" | "clock-out">("clock-in");
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [editClockInPicker, setEditClockInPicker] = useState<PickerState>(() => createEmptyPickerState());
  const [editClockOutPicker, setEditClockOutPicker] = useState<PickerState>(() => createEmptyPickerState());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  const refreshAttendance = async (employeeId: number, pageOverride?: number) => {
    if (!token) return;
    const targetPage = pageOverride ?? attendancePage;
    const data = await apiFetch<PaginatedAttendance>(
      `/attendance/by-employee/${employeeId}?month=${month}&page=${targetPage}&page_size=10`,
      { token }
    );
    setAttendanceData(data);
    setAttendancePage(data.page);
    if (data.items.length === 0) {
      setEditingRecordId(null);
      setIsEditModalOpen(false);
    }
  };

  useEffect(() => {
    if (!token || !selectedEmployee) {
      setAttendanceData(null);
      return;
    }
    const loadAttendance = async () => {
      setLoadingAttendance(true);
      setError(null);
      try {
        await refreshAttendance(selectedEmployee, 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load attendance");
      } finally {
        setLoadingAttendance(false);
      }
    };

    loadAttendance();
  }, [token, selectedEmployee, month]);

  const handleClock = async (type: "clock-in" | "clock-out") => {
    if (!token || !selectedEmployee) return;
    setStatusMessage(null);
    setError(null);
    try {
      const useCustom = type === "clock-in" ? customClockInEnabled : customClockOutEnabled;
      const picker = type === "clock-in" ? clockInPicker : clockOutPicker;
      const isoTimestamp = useCustom ? pickerStateToISO(picker) : new Date().toISOString();
      if (useCustom && !isoTimestamp) {
        setError("Select a valid custom date/time.");
        return;
      }
      await apiFetch<AttendanceRecord>(`/attendance/${type}`, {
        method: "POST",
        token,
        body: JSON.stringify({
          employee_id: selectedEmployee,
          timestamp: isoTimestamp,
        }),
      });
      setStatusMessage(`Successfully ${type.replace("-", " ")} for employee.`);
      await refreshAttendance(selectedEmployee);
      const now = new Date();
      setClockInPicker(createPickerState(now));
      setClockOutPicker(createPickerState(now));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update attendance");
    }
  };

  const handleEditAttendance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRecordId || !token || !selectedEmployee) return;
    setError(null);
    try {
      const parsedClockIn = pickerStateToISO(editClockInPicker);
      const parsedClockOut = pickerStateToISO(editClockOutPicker);
      await apiFetch<AttendanceRecord>(`/attendance/${editingRecordId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          clock_in: parsedClockIn,
          clock_out: parsedClockOut,
        }),
      });
      await refreshAttendance(selectedEmployee);
      setStatusMessage("Attendance record updated.");
      setIsEditModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to edit attendance");
    }
  };

  const handleDeleteAttendance = async (recordId: number) => {
    if (!token || !selectedEmployee) return;
    if (!window.confirm("Delete this attendance record? This cannot be undone.")) {
      return;
    }
    try {
      await apiFetch(`/attendance/${recordId}`, {
        method: "DELETE",
        token,
      });
      setStatusMessage("Attendance record deleted.");
      await refreshAttendance(selectedEmployee, attendancePage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete attendance record");
    }
  };

  const selectedEmployeeName = useMemo(() => {
    return employees.find((emp) => emp.id === selectedEmployee)?.name ?? "Employee";
  }, [employees, selectedEmployee]);
  const filteredEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      `${employee.employee_code} ${employee.name}`.toLowerCase().includes(term)
    );
  }, [employees, employeeSearch]);
  const isEmployeeSelected = Boolean(selectedEmployee);
  const latestRecord = attendanceData?.items?.[0];
  const summaryCards = [
    {
      label: "Last clock-in",
      value: latestRecord ? formatDate12Hour(latestRecord.clock_in) : "—",
    },
    {
      label: "Last clock-out",
      value: latestRecord?.clock_out ? formatDate12Hour(latestRecord.clock_out) : "—",
    },
    {
      label: "Status",
      value: latestRecord?.day_type ? latestRecord.day_type.toUpperCase() : "Pending",
    },
  ];
  const isClockInAction = clockAction === "clock-in";
  const currentCustomEnabled = isClockInAction ? customClockInEnabled : customClockOutEnabled;
  const currentPicker = isClockInAction ? clockInPicker : clockOutPicker;

  const handleCustomToggle = (checked: boolean) => {
    if (isClockInAction) {
      setCustomClockInEnabled(checked);
      if (checked) {
        setClockInPicker((prev) => ({
          date: prev.date || todayIso(),
          hour: "08",
          minute: "00",
          period: "AM",
        }));
      }
    } else {
      setCustomClockOutEnabled(checked);
      if (checked) {
        setClockOutPicker((prev) => ({
          date: prev.date || todayIso(),
          hour: "05",
          minute: "00",
          period: "PM",
        }));
      }
    }
  };

  return (
    <section className="attendance-shell">
      <div className="attendance-layout">
        <aside className="attendance-sidebar">
          <div className="card sidebar-card">
            <header className="card__header">
              <div>
                <h3>Team roster</h3>
                <p className="muted small">Pick someone to review or punch.</p>
              </div>
            </header>
            <input
              type="search"
              placeholder="Search by code or name"
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
            />
            <div className="employee-list">
              {filteredEmployees.length === 0 && <p className="muted small">No matching employees.</p>}
              {filteredEmployees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  className={`employee-list__item ${selectedEmployee === employee.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedEmployee(employee.id);
                    setAttendancePage(1);
                    refreshAttendance(employee.id, 1);
                  }}
                >
                  <div>
                    <strong>{employee.name}</strong>
                    <span>{employee.designation}</span>
                  </div>
                  <span className="muted">{employee.employee_code}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="attendance-main">
          <header className="section-header">
            <div>
              <h2>Attendance console</h2>
              <p>Clock AECO staff in/out, glance at live status, and fix mistakes in seconds.</p>
            </div>
            <label className="month-picker">
              <span>Month</span>
              <input
                type="month"
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value);
                  setAttendancePage(1);
                  if (selectedEmployee) {
                    refreshAttendance(selectedEmployee, 1);
                  }
                }}
              />
            </label>
          </header>

          {error && <p className="alert alert--error">{error}</p>}
          {statusMessage && <p className="alert alert--info">{statusMessage}</p>}

          <div className="stats-grid" style={{ marginTop: "1rem" }}>
            {summaryCards.map((card) => (
              <article key={card.label} className="stat-card">
                <p>{card.label}</p>
                <h3>{card.value}</h3>
              </article>
            ))}
          </div>

          <section className="card" style={{ marginTop: "1.5rem" }}>
            <header className="card__header">
              <div>
                <h3>Quick actions</h3>
                <p className="muted">All punches apply to {selectedEmployeeName}.</p>
              </div>
            </header>
            <div className="action-toggle">
              <button
                type="button"
                className={clockAction === "clock-in" ? "active" : ""}
                onClick={() => setClockAction("clock-in")}
              >
                Clock in
              </button>
              <button
                type="button"
                className={clockAction === "clock-out" ? "active" : ""}
                onClick={() => setClockAction("clock-out")}
              >
                Clock out
              </button>
            </div>
            <div className="quick-clock single">
              <div className="switch-field">
                <label>
                  <input
                    type="checkbox"
                    checked={currentCustomEnabled}
                    onChange={(event) => handleCustomToggle(event.target.checked)}
                    disabled={!isSuperAdmin}
                  />
                  <span>Use custom date & time</span>
                </label>
              </div>
              {currentCustomEnabled && (
                <TimePickerControls
                  state={currentPicker}
                  onChange={isClockInAction ? setClockInPicker : setClockOutPicker}
                  disabled={!isSuperAdmin}
                />
              )}
              <button
                type="button"
                className={`button ${isClockInAction ? "button--primary" : "button--secondary"} wide`}
                onClick={() => handleClock(clockAction)}
                disabled={!isSuperAdmin || !selectedEmployee}
              >
                {isClockInAction ? "Clock in now" : "Clock out now"}
              </button>
            </div>
          </section>

          <section style={{ marginTop: "2rem" }}>
            <header className="section-header">
              <div>
                <h3>Attendance history — {selectedEmployeeName}</h3>
                <p>Entries for {month}.</p>
              </div>
            </header>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clock in</th>
                    <th>Clock out</th>
                    <th>Worked hours</th>
                    <th>Day type</th>
                    {isSuperAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loadingAttendance ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 6 : 5} className="table-empty">
                        Loading attendance…
                      </td>
                    </tr>
                  ) : attendanceData && attendanceData.items.length > 0 ? (
                    attendanceData.items.map((record) => (
                      <tr key={record.id}>
                        <td>{record.work_date}</td>
                        <td>{formatDate12Hour(record.clock_in)}</td>
                        <td>{record.clock_out ? formatDate12Hour(record.clock_out) : "—"}</td>
                        <td>{(record.worked_minutes / 60).toFixed(2)}</td>
                        <td style={{ textTransform: "capitalize" }}>{record.day_type ?? "pending"}</td>
                        {isSuperAdmin && (
                          <td>
                            <div className="button-row" style={{ gap: "0.5rem" }}>
                              <button
                                type="button"
                                className="button button--secondary"
                                onClick={() => handleOpenEdit(record)}
                                disabled={!isSuperAdmin}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="button button--ghost"
                                onClick={() => handleDeleteAttendance(record.id)}
                                disabled={!isSuperAdmin}
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
                        {selectedEmployee ? "No attendance for this month." : "Select an employee to see attendance."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {attendanceData && attendanceData.pages > 1 && (
              <footer className="pagination">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    if (attendancePage > 1 && selectedEmployee) {
                      const newPage = Math.max(attendancePage - 1, 1);
                      setAttendancePage(newPage);
                      refreshAttendance(selectedEmployee, newPage);
                    }
                  }}
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
                  onClick={() => {
                    if (attendanceData && selectedEmployee && attendancePage < attendanceData.pages) {
                      const newPage = attendancePage + 1;
                      setAttendancePage(newPage);
                      refreshAttendance(selectedEmployee, newPage);
                    }
                  }}
                  disabled={attendanceData ? attendancePage >= attendanceData.pages : true}
                >
                  Next
                </button>
              </footer>
            )}
          </section>
        </div>
      </div>

      {isEditModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <header>
              <h3>Edit attendance</h3>
              <button type="button" className="link muted" onClick={() => setIsEditModalOpen(false)}>
                Close
              </button>
            </header>
            <form className="form-grid" onSubmit={handleEditAttendance}>
              <label>
                <span>Clock-in time</span>
                <TimePickerControls state={editClockInPicker} onChange={setEditClockInPicker} disabled={!isSuperAdmin} />
              </label>
              <label>
                <span>Clock-out time</span>
                <TimePickerControls state={editClockOutPicker} onChange={setEditClockOutPicker} disabled={!isSuperAdmin} />
              </label>
              <div className="form-actions right">
                <button type="button" className="button button--secondary" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="button button--primary" disabled={!isSuperAdmin}>
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default AttendancePage;
