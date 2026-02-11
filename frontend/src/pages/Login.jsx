import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../apiConfig.js";
import "../styles/Login.css";

export function Login() {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      login(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="logo-container">
            <img src="/assets/logo.png" alt="QacaShield Logo" className="login-logo" />
        </div>
        <h2>QacaShield Login</h2>
        {error && <div className="error-message">{error}</div>}
        <div className="input-group">
            <input 
              placeholder="Employee ID" 
              value={employeeId} 
              onChange={(e) => setEmployeeId(e.target.value)} 
            />
        </div>
        <div className="input-group">
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
        </div>
        <button type="submit" className="login-btn">Login</button>
      </form>
    </div>
  );
}
