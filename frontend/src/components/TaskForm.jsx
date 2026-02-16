import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { API_URL } from "../apiConfig.js";
import { MapContainer } from "./MapContainer.jsx";
import "../styles/TaskForm.css";

export function TaskForm({ selectedUser, onSuccess, onCancel }) {
  const { token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    user_id: "",
    task_title: "",
    priority: "MEDIUM",
    destination: "",
    geofence_radius: 100,
    route_optimization: "FASTEST",
    expected_start_time: "",
    buffer_time: 15,
    home_lat: null,
    home_lng: null
  });
  
  const [routeData, setRouteData] = useState(null); 
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [destinationLoading, setDestinationLoading] = useState(false);
  
  // Compliance State
  const [complianceStatus, setComplianceStatus] = useState({ valid: true, errors: [] });

  // Generate Assignment ID Logic
  const generateAssignmentId = (employeeId) => {
      let empSuffix = "00";
      if (employeeId) {
          const strId = String(employeeId);
          empSuffix = strId.length >= 2 ? strId.slice(-2) : strId.padStart(2, '0');
      }

      const now = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      
      const mm = pad(now.getMinutes());
      const dd = pad(now.getDate());
      const MM = pad(now.getMonth() + 1);
      const yy = String(now.getFullYear()).slice(-2);

      // Format: [Last 2 digits of Emp ID] + [Minutes] + [Day] + [Month] + [Year]
      return `${empSuffix}${mm}${dd}${MM}${yy}`;
  };

  // Fetch employees only if no selectedUser passed
  useEffect(() => {
    if (!token) return;

    if (selectedUser) {
        setFormData(prev => ({
            ...prev,
            user_id: selectedUser.id,
            home_lat: selectedUser.home_lat,
            home_lng: selectedUser.home_lng,
            task_title: generateAssignmentId(selectedUser.employee_id)
        }));
        validateCompliance(selectedUser);
        return;
    }

    // Default ID with 00 if no user selected initially
    setFormData(prev => ({ ...prev, task_title: generateAssignmentId(null) }));

    fetch(`${API_URL}/api/users?role=employee`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setEmployees(Array.isArray(data) ? data : []))
    .catch(err => console.error("Failed to fetch employees", err));
  }, [token, selectedUser]);

  const validateCompliance = (user) => {
      // Compliance check is only for employee users (role 'USER')
      if (user.role !== 'USER') {
          setComplianceStatus({ valid: true, errors: [] });
          return;
      }

      const errors = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!user.bike_insurance_expiry || new Date(user.bike_insurance_expiry) < today) {
          errors.push("Bike Insurance is expired or missing.");
      }
      if (!user.bike_insurance_photo_url) {
          errors.push("Bike Insurance photo is missing.");
      }

      if (!user.dl_expiry || new Date(user.dl_expiry) < today) {
          errors.push("Driving License is expired or missing.");
      }
      if (!user.dl_photo_url) {
          errors.push("Driving License photo is missing.");
      }

      if (!user.helmet_photo_url) {
          errors.push("Helmet photo is missing.");
      }

      setComplianceStatus({
          valid: errors.length === 0,
          errors
      });
  };

  const handleEmployeeChange = (e) => {
      const userId = e.target.value;
      const employee = employees.find(u => u.id === parseInt(userId));
      
      setFormData(prev => ({
          ...prev,
          user_id: userId,
          home_lat: employee?.home_lat || null,
          home_lng: employee?.home_lng || null,
          task_title: generateAssignmentId(employee?.employee_id)
      }));

      if (employee) {
          validateCompliance(employee);
      } else {
          setComplianceStatus({ valid: true, errors: [] });
      }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const query = formData.destination.trim();
    if (!query || query.length < 3) {
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
      return;
    }
    let cancelled = false;
    setDestinationLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/trips/geocode-suggestions?address=${encodeURIComponent(
            query
          )}`
        );
        if (!res.ok) {
          throw new Error("Failed to fetch suggestions");
        }
        const data = await res.json();
        if (cancelled) {
          return;
        }
        const list = Array.isArray(data) ? data : [];
        setDestinationSuggestions(list);
        setShowDestinationSuggestions(list.length > 0);
      } catch (err) {
        if (!cancelled) {
          setDestinationSuggestions([]);
          setShowDestinationSuggestions(false);
        }
      } finally {
        if (!cancelled) {
          setDestinationLoading(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [formData.destination]);

  const handleDestinationSelect = (item) => {
    const destCoords = {
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    };
    setFormData(prev => ({
      ...prev,
      destination: item.display_name || prev.destination
    }));
    setRouteData({
      path: [],
      polyline: null,
      bounds: [
        [destCoords.lat, destCoords.lng],
        [destCoords.lat, destCoords.lng]
      ],
      destCoords
    });
    setDestinationSuggestions([]);
    setShowDestinationSuggestions(false);
  };

  const handlePreview = async () => {
    if (!formData.destination) return alert("Enter destination");
    setLoadingRoute(true);
    
    try {
        const res = await fetch(`${API_URL}/api/trips/geocode?address=${encodeURIComponent(formData.destination)}`);
        
        if (!res.ok) throw new Error("Failed to locate address");
        
        const coords = await res.json();
        
        if (coords && coords.lat) {
             const destCoords = { lat: parseFloat(coords.lat), lng: parseFloat(coords.lon) };
             
             setRouteData({
                 path: [],
                 polyline: null,
                 bounds: [[destCoords.lat, destCoords.lng], [destCoords.lat, destCoords.lng]],
                 destCoords: destCoords
             });
             setShowMapPreview(true);
        } else {
            alert("Address not found");
        }
    } catch(e) {
        console.error(e);
        alert("Failed to locate destination");
    } finally {
        setLoadingRoute(false);
    }
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      if (!formData.user_id) return alert("Select an employee");
      
      if (!complianceStatus.valid) {
          return alert("Cannot assign task: Employee is not compliant.\n" + complianceStatus.errors.join("\n"));
      }

      try {
        const payload = {
            ...formData,
            route_polyline: null,
            origin_lat: null,
            origin_lng: null,
            dest_lat: routeData?.destCoords?.lat || null,
            dest_lng: routeData?.destCoords?.lng || null,
            destination_address: formData.destination,
        };

        const res = await fetch(`${API_URL}/api/trips`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("Assignment Created!");
            setFormData({ ...formData, task_title: "", destination: "", expected_start_time: "" });
            setShowMapPreview(false);
            if (onSuccess) onSuccess();
        } else {
            const err = await res.json().catch(() => ({ error: "Unknown server error" }));
            alert(`Error: ${err.error || "Failed to create trip"}`);
        }
      } catch (err) {
          console.error(err);
          alert(`Error creating assignment: ${err.message}`);
      }
  };

  return (
    <div className="task-form-container">
      <h2>New Assignment</h2>
      <hr className="form-divider" />
      
      <form onSubmit={handleSubmit}>
        <div className="assignment-form">
            {/* Employee Selection */}
            <div className="form-group">
                <label>Employee Selection</label>
                {selectedUser ? (
                    <div className="input-wrapper" style={{ background: '#F3F4F6', padding: '12px', borderRadius: '8px', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <strong>{selectedUser.name}</strong>
                            <span style={{ fontSize: '0.8rem', color: '#6B7280', background: '#E5E7EB', padding: '2px 6px', borderRadius: '4px' }}>Emp ID: {selectedUser.employee_id || 'N/A'}</span>
                        </div>
                        <small style={{ color: '#4B5563' }}>{selectedUser.email}</small>
                    </div>
                ) : (
                <div className="input-wrapper left-icon-wrapper">
                    <svg className="input-icon left-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <select 
                        name="user_id" 
                        value={formData.user_id} 
                        onChange={handleEmployeeChange}
                        className="with-left-icon"
                    >
                        <option value="">Select Employee</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>
                        ))}
                    </select>
                     <svg className="input-icon right-icon menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                    </svg>
                </div>
                )}
                {/* Compliance Warnings */}
                {!complianceStatus.valid && (
                    <div className="compliance-warning" style={{ marginTop: '10px', padding: '10px', background: '#FEF2F2', border: '1px solid #EF4444', borderRadius: '6px', color: '#B91C1C', fontSize: '0.9rem' }}>
                        <strong>Compliance Issues:</strong>
                        <ul style={{ paddingLeft: '20px', marginTop: '5px', marginBottom: 0 }}>
                            {complianceStatus.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Task Title ID */}
            <div className="form-group">
                <label>Assignment ID</label>
                <input 
                    type="text" 
                    name="task_title" 
                    value={formData.task_title} 
                    readOnly
                    style={{ background: '#F9FAFB', color: '#6B7280', cursor: 'not-allowed' }}
                />
            </div>

            {/* Expected Start Time */}
            <div className="form-group">
                <label>Expected Start Time</label>
                <div className="input-wrapper">
                    <input 
                        type="datetime-local" 
                        name="expected_start_time" 
                        value={formData.expected_start_time} 
                        onChange={handleChange}
                    />
                    <svg className="input-icon right-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                </div>
            </div>

            {/* Destination Address */}
            <div className="form-group">
                <label>Destination Address</label>
                <div className="input-wrapper">
                    <input 
                        type="text" 
                        name="destination" 
                        value={formData.destination} 
                        onChange={handleChange} 
                    />
                    <svg className="input-icon right-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                         <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {destinationLoading && (
                      <div className="destination-suggestions">
                        <div className="destination-suggestion-item">
                          Searching...
                        </div>
                      </div>
                    )}
                    {!destinationLoading && showDestinationSuggestions && destinationSuggestions.length > 0 && (
                      <div className="destination-suggestions">
                        {destinationSuggestions.map((item, index) => (
                          <div
                            key={index}
                            className="destination-suggestion-item"
                            onMouseDown={() => handleDestinationSelect(item)}
                          >
                            {item.display_name || formData.destination}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
            </div>

            {/* Site Geofence Radius Slider */}
            <div className="form-group full-width slider-group">
                <label>Site Geofence Radius (meters)</label>
                <div className="slider-container">
                    <input 
                        type="range" 
                        name="geofence_radius" 
                        min="50" 
                        max="1000" 
                        value={formData.geofence_radius} 
                        onChange={handleChange} 
                        className="custom-slider"
                    />
                </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="form-footer">
            {onCancel && (
                <button type="button" onClick={onCancel} style={{ marginRight: 'auto', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: '0 10px' }}>
                    Cancel
                </button>
            )}
            <button type="button" className="preview-link" onClick={handlePreview}>
                Preview Destination
            </button>
            
            <div className="radius-display">
                {formData.geofence_radius}m
            </div>

            <button 
                type="submit" 
                className="create-btn"
                disabled={!complianceStatus.valid}
                style={{ opacity: !complianceStatus.valid ? 0.5 : 1, cursor: !complianceStatus.valid ? 'not-allowed' : 'pointer' }}
            >
                Create Assignment &rarr;
            </button>
        </div>
      </form>

      {/* Map Preview Modal/Box */}
      {showMapPreview && (
          <div className="map-preview-box">
             <MapContainer 
                routeData={routeData} 
                viewOnly={true} 
             />
             <button type="button" onClick={() => setShowMapPreview(false)} className="close-map-btn">Close Map</button>
          </div>
      )}
    </div>
  );
}
