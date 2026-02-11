import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/RecentActivities.css';

export function RecentActivities() {
    const { token } = useAuth();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;

        const fetchActivities = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/dashboard/activities`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setActivities(data);
                }
            } catch (err) {
                console.error("Error fetching activities", err);
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
        const interval = setInterval(fetchActivities, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [token]);

    const getIcon = (type) => {
        switch (type) {
            case 'ASSIGNMENT':
                return (
                    <div className="activity-icon assignment">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                            <line x1="20" y1="8" x2="20" y2="14" />
                            <line x1="23" y1="11" x2="17" y2="11" />
                        </svg>
                    </div>
                );
            case 'STARTED':
                return (
                    <div className="activity-icon started">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polygon points="10 8 16 12 10 16 10 8" />
                        </svg>
                    </div>
                );
            case 'COMPLETION':
                return (
                    <div className="activity-icon completion">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                    </div>
                );
            case 'ALERT':
                return (
                    <div className="activity-icon alert">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                             <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                             <line x1="12" y1="9" x2="12" y2="13"/>
                             <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                    </div>
                );
            default:
                return <div className="activity-icon default">●</div>;
        }
    };

    if (loading && activities.length === 0) {
        return <div className="recent-activities-loading">Loading activities...</div>;
    }

    return (
        <div className="recent-activities-card">
            <div className="card-header">
                <h3>Recent Activities</h3>
            </div>
            <div className="activities-list">
                {activities.length === 0 ? (
                    <div className="no-activities">No recent activities found.</div>
                ) : (
                    activities.map((activity) => (
                        <div key={activity.id} className="activity-item">
                            {getIcon(activity.type)}
                            <div className="activity-content">
                                <div className="activity-title">
                                    {activity.title}
                                    <span className="activity-time">
                                        {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="activity-desc">{activity.description}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
