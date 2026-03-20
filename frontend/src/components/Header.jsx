import React from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Header.css";

export function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getPageTitle = () => {
    switch(location.pathname) {
      case "/": return "Dashboard";
      case "/reports": return "Reports";
      case "/users": return "User Management";
      default: return "QacaShield";
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        {user && (
          <button className="menu-toggle-btn" onClick={onMenuClick}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
        <h2 className="page-title">{getPageTitle()}</h2>
      </div>
      
      <div className="header-right">
        {user && (
           <button onClick={handleLogout} className="btn-logout">
             Logout
           </button>
        )}
      </div>
    </header>
  );
}
