import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../apiConfig.js";
import "../styles/DashboardSummary.css";

export function DashboardSummary() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeTrips: 9, 
    onRouteWorkers: 9,
    safetyAlerts: 0,
    completedTrips: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!token) return;
    let mounted = true;

    async function fetchStats() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const baseUrl = API_URL;

        const [activeRes, alertsRes, usersRes, completedRes] = await Promise.all([
            fetch(`${baseUrl}/api/trips/active`, { headers }).catch(e => null),
            fetch(`${baseUrl}/api/trips/alerts`, { headers }).catch(e => null),
            fetch(`${baseUrl}/api/users?role=employee`, { headers }).catch(e => null),
            fetch(`${baseUrl}/api/trips/completed/count`, { headers }).catch(e => null)
        ]);

        if (!mounted) return;

        let activeCount = 0; 
        let safetyAlertCount = 0;
        let recentAlerts = [];
        let activeEmployeesCount = 0;
        let completedCount = 0;
        
        if (activeRes && activeRes.ok) {
            const data = await activeRes.json();
            if (Array.isArray(data)) {
                activeCount = data.length; 
            }
        }

        if (usersRes && usersRes.ok) {
            const data = await usersRes.json();
            if (Array.isArray(data)) {
                // Count users where is_active is true (or undefined/null which defaults to true)
                activeEmployeesCount = data.filter(u => u.is_active !== false).length;
            }
        }

        if (alertsRes && alertsRes.ok) {
            const data = await alertsRes.json();
            if (Array.isArray(data)) {
                safetyAlertCount = data.length;
                recentAlerts = data;
            }
        }

        if (completedRes && completedRes.ok) {
            const data = await completedRes.json();
            if (data && typeof data.count === 'number') {
                completedCount = data.count;
            }
        }

        setStats({
          activeTrips: activeCount,
          onRouteWorkers: activeEmployeesCount, // Display Active Employees count instead of Active Trips count
          safetyAlerts: safetyAlertCount,
          completedTrips: completedCount
        });
        setAlerts(recentAlerts);

      } catch (err) {
        console.error("Failed to fetch dashboard stats", err);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => {
        mounted = false;
        clearInterval(interval);
    };
  }, [token]);

  return (
    <>
    <div className="stats-row">
        <div className="stat-card active-trips-card">
          <div className="stat-header">Active Assignments</div>
          <div className="stat-content">
            <div className="stat-icon-wrapper blue-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/>
                </svg>
            </div>
            <span className="stat-number">{stats.activeTrips}</span>
          </div>
        </div>

        {/* On-Route Workers Card */}
        <div className="stat-card workers-card">
          <div className="stat-header">Active Two Wheelers</div>
          <div className="stat-content">
             <div className="stat-icon-wrapper purple-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
             </div>
             <span className="stat-number">{stats.onRouteWorkers}</span>
          </div>
        </div>

        <div className="stat-card completed-trips-card">
          <div className="stat-header">Completed Assignments</div>
          <div className="stat-content">
             <div className="stat-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
             </div>
             <span className="stat-number">{stats.completedTrips}</span>
          </div>
        </div>

        {/* Safety Alerts Card */}
        <div className="stat-card alerts-card" onClick={() => setShowModal(true)}>
          <div className="stat-header">Safety Alerts</div>
          <div className="stat-content">
             <div className="stat-icon-wrapper red-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
             </div>
             <span className="stat-number">{stats.safetyAlerts}</span>
          </div>
        </div>
    </div>

    {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Safety Alerts Log</h3>
                    <button className="close-button" onClick={() => setShowModal(false)}>&times;</button>
                </div>
                <div className="alerts-list">
                    {alerts.length === 0 ? (
                        <p>No active alerts.</p>
                    ) : (
                        alerts.map(alert => (
                            <div key={alert.id} className="alert-item">
                                <div className="alert-item-header">
                                    <span>
                                        Assignment #{alert.trip_id} 
                                        {alert.Trip?.User?.name ? ` - ${alert.Trip.User.name}` : ''}
                                    </span>
                                    <span>{new Date(alert.createdAt || alert.created_at).toLocaleTimeString()}</span>
                                </div>
                                <div>{alert.message}</div>
                                {alert.lat && alert.lng && (
                                    <div className="alert-location">
                                        <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=${alert.lat},${alert.lng}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                        >
                                            View Location ({alert.lat}, {alert.lng})
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )}
    </>
  );
}
