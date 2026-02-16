import React, { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { API_URL } from "../../apiConfig.js";
import "./SafetyCheck.css";

export function SafetyCheck({ tripId, onTripStarted }) {
  const { token } = useAuth();
  const [checklist, setChecklist] = useState({
    brakes: false,
    fuel: false,
    lights: false,
    fitToDrive: false
  });
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleCheck = (e) => {
    const { name, checked } = e.target;
    setChecklist(prev => ({ ...prev, [name]: checked }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      handleUpload(file);
    }
  };

  const handleUpload = async (file) => {
    setUploading(true);
    setError("");
    
    const formData = new FormData();
    formData.append("helmet_image", file);
    formData.append("tripId", tripId);

    try {
      const res = await fetch(`${API_URL}/api/safety/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await res.json();
      if (res.ok) {
        setIsVerified(true);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      setError("Network error during upload");
    } finally {
      setUploading(false);
    }
  };

  const handleStartTrip = async () => {
    if (!isVerified) return;
    
    try {
      const res = await fetch(`${API_URL}/api/trips/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tripId })
      });

      const data = await res.json();
      if (res.ok) {
        onTripStarted();
      } else {
        setError(data.error || "Failed to start trip");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to start trip");
    }
  };

  const allChecksPassed = Object.values(checklist).every(v => v) && isVerified;

  return (
    <div className="safety-check-container">
      <div className="safety-header">
        <h2>🛡️ Safety Gateway</h2>
        <p>Complete the safety check to unlock your assignment.</p>
      </div>

      <div className="checklist-group">
        <div className="checklist-item">
          <input 
            type="checkbox" 
            name="brakes" 
            id="chk-brakes"
            checked={checklist.brakes} 
            onChange={handleCheck} 
          />
          <label htmlFor="chk-brakes">Brakes Working</label>
        </div>
        <div className="checklist-item">
          <input 
            type="checkbox" 
            name="fuel" 
            id="chk-fuel"
            checked={checklist.fuel} 
            onChange={handleCheck} 
          />
          <label htmlFor="chk-fuel">Fuel Sufficient</label>
        </div>
        <div className="checklist-item">
          <input 
            type="checkbox" 
            name="lights" 
            id="chk-lights"
            checked={checklist.lights} 
            onChange={handleCheck} 
          />
          <label htmlFor="chk-lights">Lights Functional</label>
        </div>
        <div className="checklist-item" style={{ marginTop: '20px', fontWeight: 'bold' }}>
          <input 
            type="checkbox" 
            name="fitToDrive" 
            id="chk-fit"
            checked={checklist.fitToDrive} 
            onChange={handleCheck} 
          />
          <label htmlFor="chk-fit">I am fit to drive (Mandatory)</label>
        </div>
      </div>

      <div className="upload-section" onClick={() => !isVerified && fileInputRef.current.click()}>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: "none" }} 
          accept="image/*" 
          capture="user"
          onChange={handleFileChange}
          disabled={isVerified}
        />
        {previewUrl ? (
          <div>
            <img src={previewUrl} alt="Helmet Selfie" className="preview-image" />
            {!isVerified && <p>{uploading ? "Verifying..." : "Tap to change"}</p>}
          </div>
        ) : (
          <div>
            <span style={{ fontSize: "2em" }}>📸</span>
            <p>Tap to upload Helmet Selfie</p>
          </div>
        )}
      </div>

      {isVerified && (
        <div className="shield-verified">
          <span>🛡️</span> Shield Verified
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      <button 
        className="start-trip-btn" 
        disabled={!allChecksPassed}
        onClick={handleStartTrip}
      >
        {allChecksPassed ? "🚀 Start Assignment" : "🔒 Complete Safety Check to Start"}
      </button>
    </div>
  );
}
