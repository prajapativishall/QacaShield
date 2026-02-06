import React from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Header.css";

export function Header() {
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
      default: return "QacaShield";
    }
  };

  // Hide header on Dashboard as it has its own summary/controls
  if (location.pathname === "/") return null;

  return (
    <header className="app-header">
      <div className="header-left">
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
