import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Sidebar.css";

export function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role;

  const isActive = (path) => location.pathname === path;

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
           <img src="/assets/logo2.png" alt="Logo" style={{ height: "40px", width: "auto" }} />
        </div>
        <span className="brand-name">QacaShield</span>
        <button className="mobile-close-btn" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
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
