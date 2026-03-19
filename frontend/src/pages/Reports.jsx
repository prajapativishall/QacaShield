import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { API_URL } from "../apiConfig.js";
import "../styles/Reports.css";

const AutocompleteInput = ({ suggestions, value, onChange, name, placeholder }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  const filteredSuggestions = useMemo(() => {
    if (!value) return [];
    return suggestions.filter(item => 
      item.toLowerCase().includes(value.toLowerCase())
    );
  }, [suggestions, value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (suggestion) => {
    onChange({ target: { name, value: suggestion } });
    setShowSuggestions(false);
  };

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => {
          onChange(e);
          setShowSuggestions(true);
        }}
        onFocus={() => {
          if (value) setShowSuggestions(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul className="autocomplete-dropdown">
          {filteredSuggestions.map(suggestion => (
            <li key={suggestion} onClick={() => handleSelect(suggestion)}>
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export function Reports() {
  const { token, logout, user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [trackingTripId, setTrackingTripId] = useState(null);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const trackingRef = useRef(null);
  const [filters, setFilters] = useState({
    assignmentId: '',
    assignedTo: '',
    assignedBy: '',
    status: ''
  });

  const resolveHelmetUrl = (raw) => {
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    if (raw.startsWith("/uploads")) return `${API_URL}${raw}`;
    return `${API_URL}/uploads/safety_checks/${raw.replace(/^\/+/, "")}`;
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Not authenticated");
      return;
    }

    let cancelled = false;

    const fetchAssignments = async () => {
      try {
        const res = await fetch(`${API_URL}/api/assignments/assigned-history?limit=200`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (res.status === 401) {
            if (!cancelled) logout();
            return;
        }
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch assignments (${res.status})`);
        }
        
        const data = await res.json();
        if (!cancelled) setAssignments(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAssignments();

    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const handleRowClick = (trip) => {
    setSelectedTrip(trip);
  };

  const closeModal = () => {
    setSelectedTrip(null);
  };

  const handleCancelAssignment = async () => {
    if (!selectedTrip) return;
    const confirmed = window.confirm("Are you sure you want to cancel this assignment?");
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_URL}/api/assignments/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tripId: selectedTrip.id })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to cancel assignment");
        return;
      }

      const updated = {
        ...selectedTrip,
        current_phase: "CANCELLED",
        active: false
      };

      setSelectedTrip(updated);
      setAssignments(prev =>
        prev.map(t => (t.id === updated.id ? updated : t))
      );
    } catch (e) {
      console.error("Cancel assignment error:", e);
      alert("Error cancelling assignment");
    }
  };

  const calculateDuration = (trip) => {
    if (!trip) return "N/A";
    const { actual_start_time, arrival_time, return_time, actual_end_time, exit_reason } = trip;

    if (!actual_start_time) return "N/A";
    const start = new Date(actual_start_time);
    const isEarlyExit = !!exit_reason;

    // Early exit: use arrival_time if present, otherwise fall back to completion time
    if (isEarlyExit) {
      const endForEarly = arrival_time
        ? new Date(arrival_time)
        : (actual_end_time ? new Date(actual_end_time) : null);

      if (!endForEarly || endForEarly < start) return "N/A";

      const minutes = Math.max(0, Math.floor((endForEarly - start) / 60000));
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;

      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins}m`;
    }

    // Normal flow: need arrival_time at minimum
    if (!arrival_time) return "N/A";

    const arrival = new Date(arrival_time);
    let totalMinutes = Math.max(0, Math.floor((arrival - start) / 60000));

    if (return_time && actual_end_time) {
      const ret = new Date(return_time);
      const end = new Date(actual_end_time);
      if (end >= ret) {
        totalMinutes += Math.max(0, Math.floor((end - ret) / 60000));
      }
    }

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

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

  const processedAssignments = useMemo(() => {
    return assignments.map(trip => ({
      ...trip,
      displayId: trip.task_title || generateAssignmentId(trip),
      displayStatus: trip.exit_reason
        ? 'EARLY_EXIT'
        : (trip.current_phase === 'FINALIZED' ? 'COMPLETED' : trip.current_phase)
    }));
  }, [assignments]);

  const uniqueAssignmentIds = useMemo(() => 
    [...new Set(processedAssignments.map(a => a.displayId))].filter(Boolean).sort(),
    [processedAssignments]
  );

  const uniqueAssignedTo = useMemo(() => 
    [...new Set(processedAssignments.map(a => a.User?.name).filter(Boolean))].sort(),
    [processedAssignments]
  );

  const uniqueAssignedBy = useMemo(() => 
    [...new Set(processedAssignments.map(a => a.Assigner?.name).filter(Boolean))].sort(),
    [processedAssignments]
  );

  const uniqueStatuses = useMemo(() => 
    [...new Set(processedAssignments.map(a => a.displayStatus))].filter(Boolean).sort(),
    [processedAssignments]
  );

  const filteredAssignments = useMemo(() => {
    return processedAssignments.filter(trip => {
      const id = trip.displayId.toLowerCase();
      const to = (trip.User?.name || "").toLowerCase();
      const by = (trip.Assigner?.name || "").toLowerCase();
      const status = trip.displayStatus;

      return (
        (!filters.assignmentId || id.includes(filters.assignmentId.toLowerCase())) &&
        (!filters.assignedTo || to.includes(filters.assignedTo.toLowerCase())) &&
        (!filters.assignedBy || by.includes(filters.assignedBy.toLowerCase())) &&
        (!filters.status || status === filters.status)
      );
    });
  }, [processedAssignments, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const stopTracking = () => {
    if (trackingRef.current) {
      clearInterval(trackingRef.current);
      trackingRef.current = null;
    }
  };

  const startTrackingFor = (id) => {
    stopTracking();
    if (!id) return;
    setTrackingTripId(id);
    const poll = async () => {
      try {
        const url = `${API_URL}/api/assignments/current-location?tripId=${encodeURIComponent(id)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          logout();
          return;
        }
        let data;
        try {
          data = await res.json();
        } catch {
          // Fallback when server lacks endpoint or returns HTML
          if (res.status === 404) {
            try {
              const altUrl = `${API_URL}/api/assignments/assigned-history?limit=500`;
              const altRes = await fetch(altUrl, { headers: { Authorization: `Bearer ${token}` } });
              const list = await altRes.json();
              const match = Array.isArray(list) ? list.find(t => String(t.id) === String(id)) : null;
              if (match) {
                setTrackingInfo({
                  lat: match.current_lat ?? match.dest_lat ?? null,
                  lng: match.current_lng ?? match.dest_lng ?? null,
                  phase: match.current_phase,
                  active: match.active,
                  updatedAt: match.updated_at ?? match.created_at,
                  fallback: true
                });
                return;
              }
              setTrackingInfo({ error: 'Not found (fallback failed)', status: 404, url: altUrl });
              return;
            } catch (e) {
              setTrackingInfo({ error: 'Non-JSON response and fallback error', url, bodyPreview: 'fallback failed', status: res.status });
              return;
            }
          } else {
            const txt = await res.text().catch(() => '');
            setTrackingInfo({
              error: 'Non-JSON response',
              status: res.status,
              statusText: res.statusText,
              url,
              bodyPreview: (txt || '').slice(0, 120)
            });
            return;
          }
        }
        if (!res.ok) {
          if (res.status === 404) {
            // Fallback path (duplicate of above but for JSON 404)
            try {
              const altUrl = `${API_URL}/api/assignments/assigned-history?limit=500`;
              const altRes = await fetch(altUrl, { headers: { Authorization: `Bearer ${token}` } });
              const list = await altRes.json();
              const match = Array.isArray(list) ? list.find(t => String(t.id) === String(id)) : null;
              if (match) {
                setTrackingInfo({
                  lat: match.current_lat ?? match.dest_lat ?? null,
                  lng: match.current_lng ?? match.dest_lng ?? null,
                  phase: match.current_phase,
                  active: match.active,
                  updatedAt: match.updated_at ?? match.created_at,
                  fallback: true
                });
                return;
              }
            } catch {}
          }
          setTrackingInfo({ error: data.error || 'Unable to fetch location', status: res.status, statusText: res.statusText, url });
          return;
        }
        setTrackingInfo({
          lat: data.current_lat,
          lng: data.current_lng,
          phase: data.current_phase,
          active: data.active,
          updatedAt: data.updated_at
        });
        if (!data.active || ['COMPLETED','FINALIZED','CANCELLED'].includes(data.current_phase)) {
          stopTracking();
        }
      } catch (e) {
        setTrackingInfo({ error: e.message });
      }
    };
    poll();
    trackingRef.current = setInterval(poll, 5000);
  };

  useEffect(() => () => stopTracking(), []);

  if (loading) return <div className="reports-page">Loading...</div>;
  if (error) return <div className="reports-page">Error: {error}</div>;

  return (
    <div className="reports-page">
      <h2>Assignments History</h2>

      <div className="filters-container">

        <div className="filter-group">
          <label>Assignment ID</label>
          <AutocompleteInput
            suggestions={uniqueAssignmentIds}
            value={filters.assignmentId}
            onChange={handleFilterChange}
            name="assignmentId"
            placeholder="Search ID..."
          />
        </div>
        
        <div className="filter-group">
            <label>Assigned To</label>
            <AutocompleteInput
                suggestions={uniqueAssignedTo}
                value={filters.assignedTo}
                onChange={handleFilterChange}
                name="assignedTo"
                placeholder="Search Employee..."
            />
        </div>

        <div className="filter-group">
            <label>Assigned By</label>
            <AutocompleteInput
                suggestions={uniqueAssignedBy}
                value={filters.assignedBy}
                onChange={handleFilterChange}
                name="assignedBy"
                placeholder="Search Admin/Manager..."
            />
        </div>

        <div className="filter-group">
            <label>Status</label>
            <select name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">All Statuses</option>
                {uniqueStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                ))}
            </select>
        </div>
      </div>

      {filteredAssignments.length === 0 ? (
        <div className="report-card">
          <p>No assignments found matching your criteria.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Assignment ID</th>
                <th>Assigned To</th>
                <th>Assigned By</th>
                <th>Track</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map(trip => (
                <tr key={trip.id} className="clickable-row">
                  <td>{trip.displayId}</td>
                  <td>{trip.User ? trip.User.name : "Unknown"}</td>
                  <td>{trip.Assigner ? trip.Assigner.name : "System"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {!['COMPLETED','FINALIZED','CANCELLED'].includes((trip.displayStatus || '').toUpperCase()) ? (
                      trackingTripId === trip.id ? (
                        <div style={{ fontSize: '0.85rem' }}>
                          {trackingInfo?.error ? (
                            <span style={{ color: '#b91c1c' }}>
                              {trackingInfo.error}
                              {trackingInfo.status ? ` (${trackingInfo.status} ${trackingInfo.statusText || ''})` : ''}
                              {trackingInfo.url ? ` — ${trackingInfo.url}` : ''}
                              {trackingInfo.bodyPreview ? ` — ${trackingInfo.bodyPreview}` : ''}
                            </span>
                          ) : (
                            <>
                              <div><strong>Tracking…</strong></div>
                              <div><strong>Lat,Lon:</strong> {trackingInfo?.lat ?? '…'}, {trackingInfo?.lng ?? '…'}</div>
                              <div><strong>Updated:</strong> {trackingInfo?.updatedAt ? new Date(trackingInfo.updatedAt).toLocaleString() : '…'}</div>
                            </>
                          )}
                        </div>
                      ) : (
                        <button className="btn-secondary" onClick={() => startTrackingFor(trip.id)}>Track</button>
                      )
                    ) : (
                      <span style={{ color: '#9CA3AF' }}>N/A</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-badge status-${(trip.displayStatus || 'unknown').toLowerCase()}`}
                      title={trip.exit_reason ? `Early exit: ${trip.exit_reason}` : undefined}
                    >
                      {trip.displayStatus}
                    </span>
                  </td>
                  <td onClick={() => handleRowClick(trip)}>{new Date(trip.createdAt || trip.created_at).toLocaleString()}</td>
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
                <p><strong>Arrival Time:</strong> {selectedTrip.arrival_time
                  ? new Date(selectedTrip.arrival_time).toLocaleString()
                  : (selectedTrip.exit_reason && selectedTrip.actual_end_time
                      ? new Date(selectedTrip.actual_end_time).toLocaleString()
                      : "N/A")}</p>
                <p><strong>Return Time:</strong> {selectedTrip.return_time
                  ? new Date(selectedTrip.return_time).toLocaleString()
                  : "N/A"}</p>
                {!selectedTrip.exit_reason && (
                  <p><strong>Completion Time:</strong> {selectedTrip.actual_end_time ? new Date(selectedTrip.actual_end_time).toLocaleString() : "Not completed"}</p>
                )}
                <p><strong>Time Taken:</strong> {calculateDuration(selectedTrip)}</p>
                {selectedTrip.exit_reason && (
                  <p><strong>Early Exit Reason:</strong> {selectedTrip.exit_reason}</p>
                )}
              </div>

              <div className="detail-section">
                <h4>Route Details</h4>
                <p><strong>Origin:</strong> {selectedTrip.origin_lat}, {selectedTrip.origin_lng}</p>
                <p><strong>Destination:</strong> {selectedTrip.dest_lat}, {selectedTrip.dest_lng}</p>
                {(selectedTrip.helmet_start_image_url || selectedTrip.helmet_return_image_url || selectedTrip.helmet_image_url) && (
                    <div className="helmet-check-section">
                        <p><strong>Helmet Check:</strong> Verified</p>
                        <div className="helmet-images-row">
                          {selectedTrip.helmet_start_image_url && resolveHelmetUrl(selectedTrip.helmet_start_image_url) && (
                            <div className="helmet-image-col">
                              <p><strong>Start of Assignment</strong></p>
                              <div className="helmet-image-container">
                                <img
                                  src={resolveHelmetUrl(selectedTrip.helmet_start_image_url)}
                                  alt="Helmet Check at Start"
                                  className="helmet-image"
                                />
                              </div>
                            </div>
                          )}
                          {selectedTrip.helmet_return_image_url && resolveHelmetUrl(selectedTrip.helmet_return_image_url) && (
                            <div className="helmet-image-col">
                              <p><strong>Return to Source</strong></p>
                              <div className="helmet-image-container">
                                <img
                                  src={resolveHelmetUrl(selectedTrip.helmet_return_image_url)}
                                  alt="Helmet Check on Return"
                                  className="helmet-image"
                                />
                              </div>
                            </div>
                          )}
                          {!selectedTrip.helmet_start_image_url && !selectedTrip.helmet_return_image_url && selectedTrip.helmet_image_url && resolveHelmetUrl(selectedTrip.helmet_image_url) && (
                            <div className="helmet-image-col">
                              <div className="helmet-image-container">
                                <img
                                  src={resolveHelmetUrl(selectedTrip.helmet_image_url)}
                                  alt="Helmet Check"
                                  className="helmet-image"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                    </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {user?.role === 'ADMIN' && !['COMPLETED','FINALIZED','CANCELLED'].includes(selectedTrip.current_phase) && (
                <button className="btn-danger" onClick={handleCancelAssignment}>
                  Cancel Assignment
                </button>
              )}
              <button className="btn-secondary" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
