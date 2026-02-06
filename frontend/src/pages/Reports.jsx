import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Reports.css";

export function Reports() {
  const { token, logout } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/trips/assigned-history`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (res.status === 401) {
            logout(); // Auto-logout if token is invalid
            return;
        }
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch assignments (${res.status})`);
        }
        
        const data = await res.json();
        setAssignments(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchAssignments();
    }
  }, [token, logout]);

  const handleRowClick = (trip) => {
    setSelectedTrip(trip);
  };

  const closeModal = () => {
    setSelectedTrip(null);
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) return "N/A";
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diff = endTime - startTime; // in ms
    if (diff < 0) return "N/A";
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const generateAssignmentId = (trip) => {
    if (!trip) return "";
    // Unique ID: last 2 digit of empid + minute(2) + date(2) + month(2) + year(2)
    const date = new Date(trip.createdAt || trip.created_at);
    const empid = trip.User?.id || 0;
    
    const empPart = empid.toString().slice(-2).padStart(2, '0');
    const minPart = date.getMinutes().toString().padStart(2, '0');
    const dayPart = date.getDate().toString().padStart(2, '0');
    const monthPart = (date.getMonth() + 1).toString().padStart(2, '0');
    const yearPart = date.getFullYear().toString().slice(-2);
    
    return `${empPart}${minPart}${dayPart}${monthPart}${yearPart}`;
  };

  if (loading) return <div className="reports-page">Loading...</div>;
  if (error) return <div className="reports-page">Error: {error}</div>;

  return (
    <div className="reports-page">
      <h2>Assignments History</h2>
      {assignments.length === 0 ? (
        <div className="report-card">
          <p>No assignments found.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Assignment ID</th>
                <th>Assigned To</th>
                <th>Assigned By</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(trip => (
                <tr key={trip.id} onClick={() => handleRowClick(trip)} className="clickable-row">
                  <td>{trip.task_title || generateAssignmentId(trip)}</td>
                  <td>{trip.User ? trip.User.name : "Unknown"}</td>
                  <td>{trip.Assigner ? trip.Assigner.name : "System"}</td>
                  <td>
                    <span className={`status-badge status-${trip.current_phase.toLowerCase()}`}>
                      {trip.current_phase === 'FINALIZED' ? 'COMPLETED' : trip.current_phase}
                    </span>
                  </td>
                  <td>{new Date(trip.createdAt || trip.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTrip && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Task Details: {selectedTrip.task_title || `Trip #${selectedTrip.id}`}</h3>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h4>Assignment Info</h4>
                <p><strong>Assignment ID:</strong> {generateAssignmentId(selectedTrip)}</p>
                <p><strong>Assigned To:</strong> {selectedTrip.User ? selectedTrip.User.name : "Unknown"}</p>
                <p><strong>Assigned By:</strong> {selectedTrip.Assigner ? selectedTrip.Assigner.name : "System"}</p>
                <p><strong>Status:</strong> {selectedTrip.current_phase === 'FINALIZED' ? 'COMPLETED' : selectedTrip.current_phase}</p>
                <p><strong>Created At:</strong> {new Date(selectedTrip.createdAt || selectedTrip.created_at).toLocaleString()}</p>
              </div>

              <div className="detail-section">
                <h4>Completion Data</h4>
                <p><strong>Start Time:</strong> {selectedTrip.actual_start_time ? new Date(selectedTrip.actual_start_time).toLocaleString() : "Not started"}</p>
                <p><strong>Completion Time:</strong> {selectedTrip.actual_end_time ? new Date(selectedTrip.actual_end_time).toLocaleString() : "Not completed"}</p>
                <p><strong>Time Taken:</strong> {calculateDuration(selectedTrip.actual_start_time, selectedTrip.actual_end_time)}</p>
              </div>

              <div className="detail-section">
                <h4>Route Details</h4>
                <p><strong>Origin:</strong> {selectedTrip.origin_lat}, {selectedTrip.origin_lng}</p>
                <p><strong>Destination:</strong> {selectedTrip.dest_lat}, {selectedTrip.dest_lng}</p>
                {selectedTrip.helmet_image_url && (
                    <div className="helmet-check-section">
                        <p><strong>Helmet Check:</strong> Verified</p>
                        <div className="helmet-image-container">
                            <img 
                                src={selectedTrip.helmet_image_url.startsWith('http') 
                                    ? selectedTrip.helmet_image_url 
                                    : `${import.meta.env.VITE_BACKEND_URL}${selectedTrip.helmet_image_url}`} 
                                alt="Helmet Check" 
                                className="helmet-image"
                            />
                        </div>
                    </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
