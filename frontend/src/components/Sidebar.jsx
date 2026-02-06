import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Sidebar.css";

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role;

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
           <img src="/assets/logo2.png" alt="Logo" style={{ height: "40px", width: "auto" }} />
        </div>
        <span className="brand-name">QacaShield</span>
      </div>

      <nav className="sidebar-nav">
        <Link to="/" className={`nav-link ${isActive("/") ? "active" : ""}`}>
          <span className="nav-icon">📊</span>
          <span className="nav-text">Dashboard</span>
        </Link>
        
        {["MANAGER", "ADMIN"].includes(role) && (
          <Link to="/reports" className={`nav-link ${isActive("/reports") ? "active" : ""}`}>
            <span className="nav-icon">📑</span>
            <span className="nav-text">Reports</span>
          </Link>
        )}

        {["MANAGER", "ADMIN"].includes(role) && (
          <Link to="/users" className={`nav-link ${isActive("/users") ? "active" : ""}`}>
            <span className="nav-icon">👥</span>
            <span className="nav-text">Users</span>
          </Link>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info-mini">
          <div className="avatar-circle">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{role}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
