import type { PropsWithChildren } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { path: "/", label: "Dashboard" },
  { path: "/employees", label: "Employees" },
  { path: "/attendance", label: "Attendance" },
  { path: "/payroll", label: "Payroll" },
  { path: "/leaves", label: "Leaves" },
  { path: "/advances", label: "Daily Advances - خرچہ" },
  { path: "/status", label: "Service Status" },
];

const Layout = ({ children }: PropsWithChildren) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const roleLabel = user?.role === "super_admin" ? "Super Admin" : "Admin";
  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "A";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="sidebar__title">AECO Admin</h1>
        <nav className="sidebar__nav">
          <ul>
            {navItems.map((item) => {
              const isActive =
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.path);
              return (
                <li key={item.path} className={isActive ? "active" : ""}>
                  <Link to={item.path}>{item.label}</Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="topbar__identity">
            <span className="avatar">{userInitial}</span>
            <div>
              <p className="topbar__greeting">Welcome back</p>
              <p className="topbar__role">{roleLabel}</p>
            </div>
          </div>
          <button type="button" className="button button--secondary" onClick={handleLogout}>
            Sign out
          </button>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
