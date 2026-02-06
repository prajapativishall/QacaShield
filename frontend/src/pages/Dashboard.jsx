import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardSummary } from "../components/DashboardSummary.jsx";
import { RecentActivities } from "../components/RecentActivities.jsx";
import { ActiveTripsList } from "../components/ActiveTripsList.jsx";
import { AssignmentSidebar } from "../components/AssignmentSidebar.jsx";
import { SafetyCheck } from "../components/SafetyCheck/SafetyCheck.jsx";
import { MapContainer } from "../components/MapContainer.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Dashboard.css";

export function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTrip, setCurrentTrip] = useState(null);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (user?.role === "USER") {
      fetchCurrentTrip();
    }
  }, [user, token]);

  const fetchCurrentTrip = async () => {
    setLoadingTrip(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/trips/my-trips`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const trips = await res.json();
        if (trips.length > 0) {
          const activeOrPlanned = trips.find(t => t.active || t.current_phase === "PLANNED");
          setCurrentTrip(activeOrPlanned || null);
        }
      }
    } catch (err) {
      console.error("Error fetching trips", err);
    } finally {
      setLoadingTrip(false);
    }
  };

  const handleTripStarted = () => {
    fetchCurrentTrip();
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) return <div>Loading...</div>;

  const isManager = user.role === "MANAGER" || user.role === "ADMIN";

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });

  return (
    <div className="dashboard-page">
      {isManager ? (
        <div className="manager-dashboard">
             {/* Header */}
             <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '32px' }}>
                 
                 <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                     <div className="dashboard-date" style={{ color: '#6B7280', fontSize: '0.95rem', fontWeight: '500', textAlign: 'right' }}>
                        <div>{currentDate}</div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{currentTime}</div>
                     </div>
                     
                     <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="new-assignment-btn"
                        style={{ 
                            padding: '10px 20px', 
                            background: 'linear-gradient(135deg, #FF5252 0%, #FF1744 100%)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '10px', 
                            fontSize: '0.95rem', 
                            cursor: 'pointer', 
                            fontWeight: '600', 
                            boxShadow: '0 4px 12px rgba(255, 82, 82, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        New Assignment
                    </button>

                    <button 
                        onClick={handleLogout}
                        style={{ 
                            padding: '10px 20px', 
                            background: 'white', 
                            color: '#4B5563', 
                            border: '1px solid #E5E7EB', 
                            borderRadius: '10px', 
                            fontSize: '0.95rem', 
                            cursor: 'pointer', 
                            fontWeight: '600', 
                            transition: 'all 0.2s'
                        }}
                    >
                        Logout
                    </button>
                 </div>
             </div>

             {/* Stats Row */}
             <div style={{ marginBottom: '24px' }}>
                <DashboardSummary />
             </div>

             {/* Main Content Grid */}
             <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '24px' }}>
                {/* Left Column: Active Trips List */}
                <div>
                    <ActiveTripsList />
                </div>

                {/* Right Column: Recent Activities */}
                <div>
                    <RecentActivities />
                </div>
             </div>

             <AssignmentSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </div>
      ) : (
        <div className="user-dashboard">
           <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
               <button 
                   onClick={handleLogout}
                   style={{ 
                       padding: '8px 16px', 
                       background: 'white', 
                       color: '#4B5563', 
                       border: '1px solid #E5E7EB', 
                       borderRadius: '8px', 
                       fontSize: '0.9rem', 
                       cursor: 'pointer', 
                       fontWeight: '600'
                   }}
               >
                   Logout
               </button>
           </div>
           {loadingTrip ? (
             <p>Loading trip status...</p>
           ) : currentTrip ? (
             <>
               {(!currentTrip.is_safety_verified || currentTrip.current_phase === "PLANNED") ? (
                 <SafetyCheck tripId={currentTrip.id} onTripStarted={handleTripStarted} />
               ) : (
                 <div style={{ height: "80vh" }}>
                    <h2>Trip #{currentTrip.id} - Active</h2>
                    <MapContainer viewOnly={false} /> 
                 </div>
               )}
             </>
           ) : (
             <div style={{ textAlign: "center", padding: "50px" }}>
               <h2>No Active Trips</h2>
               <p>You have no assigned trips at the moment.</p>
             </div>
           )}
        </div>
      )}
    </div>
  );
}
