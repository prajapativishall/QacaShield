import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/ActiveTripsList.css'; // We'll create this or use inline for now

export function ActiveTripsList() {
    const { token } = useAuth();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;

        const fetchActiveTrips = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/trips/active`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setTrips(data);
                }
            } catch (err) {
                console.error("Error fetching active trips", err);
            } finally {
                setLoading(false);
            }
        };

        fetchActiveTrips();
        const interval = setInterval(fetchActiveTrips, 30000);
        return () => clearInterval(interval);
    }, [token]);

    if (loading) {
        return <div className="active-trips-loading">Loading active trips...</div>;
    }

    const getStatusBadge = (trip) => {
        if (trip.active || trip.current_phase === 'ACTIVE') {
            return <span className="status-badge active">On Route</span>;
        } else if (trip.current_phase === 'ACCEPTED') {
             return <span className="status-badge warning">Accepted</span>;
        } else if (trip.current_phase === 'PENDING' || trip.current_phase === 'PLANNED') {
             return <span className="status-badge pending">Pending</span>;
        } else {
             return <span className="status-badge completed">Completed</span>;
        }
    };

    return (
        <div className="live-active-trips-card">
            <div className="card-header">
                <h3>Live Active Trips</h3>
            </div>
            <div className="trips-list">
                {trips.length === 0 ? (
                    <div className="no-trips">
                        <div className="empty-state-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                        </div>
                        <p>No trips are currently in progress.</p>
                    </div>
                ) : (
                    <div className="trips-table-container">
                        <table className="trips-table">
                            <thead>
                                <tr>
                                    <th>Assignment ID</th>
                                    <th>Employee</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trips.map((trip) => (
                                    <tr key={trip.id}>
                                        <td>{trip.task_title || `#${trip.id}`}</td>
                                        <td>
                                            <div className="user-cell">
                                                <div className="user-avatar-sm">
                                                    {trip.User?.name?.charAt(0) || 'U'}
                                                </div>
                                                <span>{trip.User?.name || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            {getStatusBadge(trip)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
