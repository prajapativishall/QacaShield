import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/UserManagement.css";

export function UserManagement() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [empIdFilter, setEmpIdFilter] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER",
    home_lat: "",
    home_lng: "",
    employee_id: "",
    phone_number: "",
      emergency_contact: "",
      circle_zone: "",
      blood_group: "",
      bike_insurance_expiry: "",
    bike_insurance_photo_url: "",
    dl_expiry: "",
    dl_photo_url: "",
    helmet_photo_url: "",
    profile_pic_url: ""
  });

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        console.error("Failed to fetch users");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (user) => {
    try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/${user.id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ is_active: !user.is_active })
        });
        if (res.ok) {
            setUsers(users.map(u => u.id === user.id ? { ...u, is_active: !user.is_active } : u));
        } else {
            alert("Failed to update status");
        }
    } catch (error) {
        console.error("Error updating status:", error);
        alert("Error updating status");
    }
  };

  const handleDelete = (id) => {
    const user = users.find(u => u.id === id);
    setUserToDelete(user);
    setDeleteReason("");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ reason: deleteReason })
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userToDelete.id));
        setShowDeleteModal(false);
        setDeleteReason("");
        setUserToDelete(null);
      } else {
        alert("Failed to delete user");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting user");
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "", // Don't show hash
      role: user.role,
      home_lat: user.home_lat || "",
      home_lng: user.home_lng || "",
      employee_id: user.employee_id || "",
      phone_number: user.phone_number || "",
      emergency_contact: user.emergency_contact || "",
      circle_zone: user.circle_zone || "",
      blood_group: user.blood_group || "",
      bike_insurance_expiry: user.bike_insurance_expiry || "",
      bike_insurance_photo_url: user.bike_insurance_photo_url || "",
      dl_expiry: user.dl_expiry || "",
      dl_photo_url: user.dl_photo_url || "",
      helmet_photo_url: user.helmet_photo_url || "",
      profile_pic_url: user.profile_pic_url || ""
    });
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "USER",
      home_lat: "",
      home_lng: "",
      employee_id: "",
      phone_number: "",
      emergency_contact: "",
      circle_zone: "",
      blood_group: "",
      bike_insurance_expiry: "",
      bike_insurance_photo_url: "",
      dl_expiry: "",
      dl_photo_url: "",
      helmet_photo_url: "",
      profile_pic_url: ""
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingUser 
      ? `${import.meta.env.VITE_BACKEND_URL}/api/users/${editingUser.id}`
      : `${import.meta.env.VITE_BACKEND_URL}/api/users`;
    
    const method = editingUser ? "PUT" : "POST";

    const payload = { ...formData };

    // If role is not USER, remove compliance fields
    if (payload.role !== 'USER') {
        delete payload.bike_insurance_expiry;
        delete payload.bike_insurance_photo_url;
        delete payload.dl_expiry;
        delete payload.dl_photo_url;
        delete payload.helmet_photo_url;
    }

    // Handle empty optional fields
    Object.keys(payload).forEach(key => {
        if (payload[key] === "") payload[key] = null;
    });

    // If editing and password is empty, remove it
    if (editingUser && !payload.password) {
        delete payload.password;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setShowModal(false);
        fetchUsers();
      } else {
        const err = await res.json();
        alert("Error: " + (err.error || "Operation failed"));
      }
    } catch (err) {
      console.error(err);
      alert("Submission failed");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append("file", file);

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: uploadData
      });
      
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, [fieldName]: data.url }));
      } else {
        alert("Upload failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading file");
    }
  };

  // Compliance Logic
  const getDaysRemaining = (expiryDate) => {
    if (!expiryDate) return null;
    const diff = new Date(expiryDate) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const isExpiringSoon = (date) => {
    const days = getDaysRemaining(date);
    return days !== null && days <= 30;
  };

  const getStatusIcon = (type, dateValue, photoUrl) => {
    let isValid = false;
    let isWarning = false;
    let missingPhoto = false;

    if (type === 'helmet') {
        isValid = !!photoUrl;
    } else {
        // DL and Insurance
        if (dateValue) {
            const days = getDaysRemaining(dateValue);
            if (days > 30) isValid = true;
            else if (days > 0) { isValid = true; isWarning = true; }
            else isValid = false; // Expired
        }
        
        // If date is valid/warning, check photo
        if (isValid && !photoUrl) {
            isValid = false;
            missingPhoto = true;
        }
    }

    const color = missingPhoto ? '#EF4444' : (isWarning ? '#F59E0B' : (isValid ? '#10B981' : '#EF4444'));
    const icon = type === 'insurance' ? '📄' : (type === 'dl' ? '🪪' : '⛑️');
    const title = type === 'helmet' 
        ? (isValid ? 'Helmet Photo Uploaded' : 'Missing Helmet Photo')
        : (missingPhoto ? 'Missing Photo' : (isValid ? (isWarning ? 'Expiring Soon' : 'Valid') : 'Expired/Missing Date'));
    
    return (
        <a 
            href={photoUrl ? `${import.meta.env.VITE_BACKEND_URL}${photoUrl}` : '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', cursor: photoUrl ? 'pointer' : 'default' }}
            onClick={(e) => !photoUrl && e.preventDefault()}
        >
            <span style={{ color, fontSize: '1.2rem', margin: '0 4px' }} title={title}>{icon}</span>
        </a>
    );
  };

  const filteredUsers = users.filter(user => 
    user.employee_id?.toString().toLowerCase().includes(empIdFilter.toLowerCase())
  );

  return (
    <div className="user-management-page">
      <div className="page-header">
        <h2>User Management</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
            <input 
                type="text" 
                placeholder="Search Emp ID..." 
                value={empIdFilter}
                onChange={(e) => setEmpIdFilter(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <button className="btn-primary" onClick={handleCreate}>+ Add User</button>
        </div>
      </div>

      {loading ? <p>Loading...</p> : (
        <table className="user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>EmpID</th>
              <th>Compliance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <tr key={u.id} className={u.is_active === false ? "row-deactive" : ""}>
                <td>
                  <div className="user-name">{u.name}</div>
                  <div className="user-email">{u.email}</div>
                </td>
                <td>
                  <span className={`role-badge role-${u.role.toLowerCase()}`}>{u.role}</span>
                </td>
                <td>
                  {u.employee_id || "-"}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {u.role === 'USER' ? (
                    <>
                      {getStatusIcon('insurance', u.bike_insurance_expiry, u.bike_insurance_photo_url)}
                      {getStatusIcon('dl', u.dl_expiry, u.dl_photo_url)}
                      {getStatusIcon('helmet', null, u.helmet_photo_url)}
                    </>
                  ) : (
                    <span style={{ color: '#9CA3AF' }}>N/A</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                    <button 
                      className={`status-toggle-btn ${u.is_active === false ? 'deactive' : 'active'}`}
                      onClick={() => toggleStatus(u)}
                    >
                        {u.is_active === false ? 'Deactive' : 'Active'}
                    </button>
                </td>
                <td className="action-buttons">
                  <button onClick={() => handleEdit(u)} className="btn-icon edit" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(u.id)} className="btn-icon delete" title="Delete">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>{editingUser ? "Edit User" : "Add User"}</h3>
              <button onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form grid-form">
              {/* Basic Info */}
              <div className="form-section">
                <h4>Basic Info</h4>
                <div className="form-row">
                    <div className="form-group">
                        <label>Name *</label>
                        <input name="name" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Email *</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Password {editingUser && "(Leave blank)"}</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} required={!editingUser} />
                    </div>
                    <div className="form-group">
                        <label>Role</label>
                        <select name="role" value={formData.role} onChange={handleChange}>
                        <option value="USER">User (Employee)</option>
                        <option value="MANAGER">Manager</option>
                        <option value="ADMIN">Admin</option>
                        </select>
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Profile Picture</label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
                            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'profile_pic_url')} />
                            {formData.profile_pic_url && (
                                <small style={{ color: '#10B981' }}>
                                    <a href={`${import.meta.env.VITE_BACKEND_URL}${formData.profile_pic_url}`} target="_blank" rel="noopener noreferrer">View Uploaded</a>
                                </small>
                            )}
                        </div>
                    </div>
                </div>
              </div>

              {/* Employee Details */}
              <div className="form-section">
                <h4>Employee Details</h4>
                <div className="form-row">
                    <div className="form-group">
                        <label>Employee ID</label>
                        <input name="employee_id" value={formData.employee_id} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label>Circle/Zone</label>
                        <input name="circle_zone" value={formData.circle_zone} onChange={handleChange} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Phone Number</label>
                        <input name="phone_number" value={formData.phone_number} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label>Emergency Contact</label>
                        <input name="emergency_contact" value={formData.emergency_contact} onChange={handleChange} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Blood Group</label>
                        <select name="blood_group" value={formData.blood_group} onChange={handleChange}>
                            <option value="">Select Blood Group</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                        </select>
                    </div>
                </div>
              </div>

              {/* Compliance */}
              {formData.role === 'USER' && (
              <div className="form-section">
                <h4>Compliance</h4>
                
                {/* Bike Insurance */}
                <div className="form-row" style={{ alignItems: 'flex-start' }}>
                    <div className="form-group">
                        <label>Bike Insurance Expiry</label>
                        <input type="date" name="bike_insurance_expiry" value={formData.bike_insurance_expiry} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label>Insurance Photo</label>
                        <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'bike_insurance_photo_url')} />
                        {formData.bike_insurance_photo_url && (
                            <small style={{ color: '#10B981', display: 'block', marginTop: '4px' }}>
                                <a href={`${import.meta.env.VITE_BACKEND_URL}${formData.bike_insurance_photo_url}`} target="_blank" rel="noopener noreferrer">View Uploaded</a>
                            </small>
                        )}
                    </div>
                </div>

                {/* DL */}
                <div className="form-row" style={{ alignItems: 'flex-start' }}>
                    <div className="form-group">
                        <label>DL Expiry</label>
                        <input type="date" name="dl_expiry" value={formData.dl_expiry} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label>DL Photo</label>
                        <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'dl_photo_url')} />
                        {formData.dl_photo_url && (
                            <small style={{ color: '#10B981', display: 'block', marginTop: '4px' }}>
                                <a href={`${import.meta.env.VITE_BACKEND_URL}${formData.dl_photo_url}`} target="_blank" rel="noopener noreferrer">View Uploaded</a>
                            </small>
                        )}
                    </div>
                </div>

                {/* Helmet */}
                <div className="form-row">
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>Helmet Photo</label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'helmet_photo_url')} />
                            {formData.helmet_photo_url && (
                                <small style={{ color: '#10B981' }}>
                                    <a href={`${import.meta.env.VITE_BACKEND_URL}${formData.helmet_photo_url}`} target="_blank" rel="noopener noreferrer">View Uploaded</a>
                                </small>
                            )}
                        </div>
                    </div>
                </div>
              </div>
              )}

              {/* Location */}
              <div className="form-section">
                <h4>Home Location (Optional)</h4>
                <div className="form-row">
                    <div className="form-group">
                        <label>Latitude</label>
                        <input type="number" step="any" name="home_lat" value={formData.home_lat} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label>Longitude</label>
                        <input type="number" step="any" name="home_lng" value={formData.home_lng} onChange={handleChange} />
                    </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Delete User</h3>
              <button onClick={() => setShowDeleteModal(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
                <p>Are you sure you want to delete user <strong>{userToDelete?.name}</strong>?</p>
                <div className="form-group" style={{ marginTop: '15px' }}>
                    <label>Reason for deletion *</label>
                    <textarea 
                        value={deleteReason} 
                        onChange={(e) => setDeleteReason(e.target.value)} 
                        rows={3} 
                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                        required
                        placeholder="Please provide a reason..."
                    />
                </div>
                <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={() => setShowDeleteModal(false)} className="btn-secondary">Cancel</button>
                    <button 
                        onClick={confirmDelete} 
                        className="btn-danger" 
                        disabled={!deleteReason.trim()}
                        style={{ backgroundColor: '#EF4444', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: deleteReason.trim() ? 'pointer' : 'not-allowed', opacity: deleteReason.trim() ? 1 : 0.6 }}
                    >
                        Delete User
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
