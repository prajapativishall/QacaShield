import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { API_URL } from "../apiConfig.js";
import { TaskForm } from "./TaskForm.jsx";
import "../styles/AssignmentSidebar.css";

export function AssignmentSidebar({ isOpen, onClose }) {
  const { token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [view, setView] = useState("list"); // 'list' or 'form'

  useEffect(() => {
    if (!token || !isOpen) return;
    fetchEmployees();
  }, [token, isOpen]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users?role=employee`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        // Filter out inactive users
        const activeUsers = data.filter(u => u.is_active !== false);
        setEmployees(activeUsers);
      }
    } catch (err) {
      console.error("Failed to fetch employees", err);
    }
  };

  const getStatus = (user) => {
    const lastTrip = user.Trips && user.Trips[0];
    
    // Check if busy (Active trip)
    if (lastTrip && (lastTrip.active || lastTrip.current_phase === 'ACTIVE' || lastTrip.current_phase === 'PLANNED')) {
        return { status: "BUSY", label: "Busy (On Trip)", color: "#EF4444" };
    }

    // Check Cooling Period (8 hours)
    if (lastTrip && lastTrip.actual_end_time && lastTrip.current_phase !== 'CANCELLED') {
        const endTime = new Date(lastTrip.actual_end_time);
        const now = new Date();
        const diffHours = (now - endTime) / (1000 * 60 * 60);
        
        if (diffHours < 8) {
             const remaining = Math.ceil(8 - diffHours);
             return { status: "COOLING", label: `Cooling (${remaining}h left)`, color: "#F59E0B" };
        }
    }
    
    return { status: "AVAILABLE", label: "Available", color: "#10B981" };
  };

  const handleUserSelect = (user) => {
     const status = getStatus(user);
     if (status.status === 'BUSY') {
         alert("This user is currently on a trip and cannot be assigned a new task.");
         return;
     }
     
     if (status.status === 'COOLING') {
         if (!window.confirm(`User is in cooling period (${status.label}). Assign anyway?`)) return;
     }
     
     setSelectedUser(user);
     setView("form");
  };

  const handleBack = () => {
      setSelectedUser(null);
      setView("list");
  };

  const handleAssignmentSuccess = () => {
      // alert("Assignment created successfully!"); // TaskForm already alerts
      handleBack();
      fetchEmployees(); // Refresh list to update status if needed
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="assignment-sidebar-overlay" onClick={onClose}>
        <div className={`assignment-sidebar ${view === 'list' ? 'sidebar-narrow' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="sidebar-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {view === 'form' && <button onClick={handleBack} className="back-btn">&larr;</button>}
                    <h2>{view === 'form' ? 'Assign Task' : 'Select Employee'}</h2>
                </div>
                <button className="close-btn" onClick={onClose}>&times;</button>
            </div>
            
            <div className="sidebar-content">
                {view === 'list' ? (
                    <div className="employee-list">
                        {employees.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#6B7280' }}>No employees found.</p>
                        ) : (
                            employees.map(user => {
                                const { status, label, color } = getStatus(user);
                                return (
                                    <div key={user.id} className="employee-card" onClick={() => handleUserSelect(user)}>
                                        <div className="employee-info">
                                            <h4>{user.name}</h4>
                                            <p>{user.email}</p>
                                        </div>
                                        <span className="status-badge" style={{ backgroundColor: color }}>
                                            {label}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <TaskForm 
                        selectedUser={selectedUser} 
                        onSuccess={handleAssignmentSuccess}
                        onCancel={handleBack}
                    />
                )}
            </div>
        </div>
    </div>
  );
}
