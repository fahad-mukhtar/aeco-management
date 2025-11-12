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

  return (
    <section>
      <header className="section-header">
        <div>
          <h2>Attendance Console</h2>
          <p>Clock AECO staff in/out quickly, review their latest status, and correct punches when needed.</p>
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

      <div className="attendance-summary">
        {summaryCards.map((card) => (
          <article key={card.label}>
            <p>{card.label}</p>
            <h4>{card.value}</h4>
          </article>
        ))}
      </div>

      <div className="attendance-grid">
        <article className="attendance-card">
          <div className="card-header">
            <h3>Who are we clocking?</h3>
            <span>Pick an employee to view their timeline.</span>
          </div>
          <label>
            <span>Employee</span>
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
          <p className="card-helper">Shift window: 8:00 AM – 5:00 PM (break 1:00 PM – 2:00 PM)</p>
        </article>

        <article className="attendance-card">
          <div className="card-header">
            <h3>Quick clock controls</h3>
            <span>Use current time or switch to custom.</span>
          </div>
          <div className="quick-clock">
            <div className="quick-clock__section">
              <div className="switch-field">
                <label>
                  <input
                    type="checkbox"
                    checked={customClockInEnabled}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setCustomClockInEnabled(checked);
                      if (checked) {
                        setClockInPicker((prev) => ({
                          date: prev.date || todayIso(),
                          hour: "08",
                          minute: "00",
                          period: "AM",
                        }));
                      }
                    }}
                  />
                  <span>Custom clock-in time</span>
                </label>
              </div>
              {customClockInEnabled && (
                <TimePickerControls state={clockInPicker} onChange={setClockInPicker} disabled={!isSuperAdmin} />
              )}
              <button
                type="button"
                className="button button--primary wide"
                onClick={() => handleClock("clock-in")}
                disabled={!isSuperAdmin || !selectedEmployee}
              >
                Clock in now
              </button>
            </div>
            <div className="quick-clock__section">
              <div className="switch-field">
                <label>
                  <input
                    type="checkbox"
                    checked={customClockOutEnabled}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setCustomClockOutEnabled(checked);
                      if (checked) {
                        setClockOutPicker((prev) => ({
                          date: prev.date || todayIso(),
                          hour: "05",
                          minute: "00",
                          period: "PM",
                        }));
                      }
                    }}
                  />
                  <span>Custom clock-out time</span>
                </label>
              </div>
              {customClockOutEnabled && (
                <TimePickerControls state={clockOutPicker} onChange={setClockOutPicker} disabled={!isSuperAdmin} />
              )}
              <button
                type="button"
                className="button button--secondary wide"
                onClick={() => handleClock("clock-out")}
                disabled={!isSuperAdmin || !selectedEmployee}
              >
                Clock out now
              </button>
            </div>
          </div>
        </article>
      </div>
      <h3>Attendance history — {selectedEmployeeName}</h3>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Clock in</th>
              <th>Clock out</th>
              <th>Worked hours</th>
              <th>Day type</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loadingAttendance ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  Loading attendance…
                </td>
              </tr>
            ) : attendanceData && attendanceData.items.length ? (
              attendanceData.items.map((record) => (
                <tr key={record.id}>
                  <td>{record.work_date}</td>
                  <td>{formatTime12Hour(record.clock_in)}</td>
                  <td>{record.clock_out ? formatTime12Hour(record.clock_out) : "—"}</td>
                  <td>{(record.worked_minutes / 60).toFixed(2)} hrs</td>
                  <td style={{ textTransform: "capitalize" }}>{record.day_type ?? "pending"}</td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        setEditingRecordId(record.id);
                        setEditClockInPicker(createPickerState(new Date(record.clock_in)));
                        setEditClockOutPicker(
                          record.clock_out
                            ? createPickerState(new Date(record.clock_out))
                            : createEmptyPickerState(record.work_date)
                        );
                        setIsEditModalOpen(true);
                      }}
                      disabled={!isSuperAdmin}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="link muted"
                      onClick={() => handleDeleteAttendance(record.id)}
                      disabled={!isSuperAdmin}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="table-empty">
                  No attendance for this month.
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
            if (attendanceData && attendancePage > 1) {
              const newPage = Math.max(attendancePage - 1, 1);
              setAttendancePage(newPage);
              selectedEmployee && refreshAttendance(selectedEmployee, newPage);
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
            if (attendanceData && attendancePage < attendanceData.pages) {
              const newPage = attendancePage + 1;
              setAttendancePage(newPage);
              selectedEmployee && refreshAttendance(selectedEmployee, newPage);
            }
          }}
          disabled={attendanceData ? attendancePage >= attendanceData.pages : true}
        >
          Next
        </button>
      </footer>

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
