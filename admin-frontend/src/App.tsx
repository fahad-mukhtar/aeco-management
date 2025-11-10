import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Dashboard from "./pages/Dashboard";
import EmployeeForm from "./pages/EmployeeForm";
import EmployeesList from "./pages/EmployeesList";
import EmployeeDetail from "./pages/EmployeeDetail";
import AttendancePage from "./pages/Attendance";
import DailyAdvancesPage from "./pages/DailyAdvances";
import LeavesPage from "./pages/Leaves";
import Login from "./pages/Login";
import ServicesStatus from "./pages/ServicesStatus";

const AppShell = () => (
  <Layout>
    <Outlet />
  </Layout>
);

const App = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route
      element={
        <RequireAuth>
          <AppShell />
        </RequireAuth>
      }
    >
      <Route path="/" element={<Dashboard />} />
      <Route path="/employees" element={<EmployeesList />} />
      <Route path="/employees/:employeeId" element={<EmployeeDetail />} />
      <Route path="/employees/new" element={<EmployeeForm />} />
      <Route path="/employees/:employeeId/edit" element={<EmployeeForm />} />
      <Route path="/attendance" element={<AttendancePage />} />
      <Route path="/advances" element={<DailyAdvancesPage />} />
      <Route path="/leaves" element={<LeavesPage />} />
      <Route path="/status" element={<ServicesStatus />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
