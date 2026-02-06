# QacaShield Platform: Technical & Operational Training Manual

**Duration:** 2 Days (Online Delivery)  
**Target Audience:** 46 Site Inspectors (UPW/Delhi), 2 Circle Managers  
**Platform Components:** Mobile App (Field), Web Dashboard (Office)  
**Core Philosophy:** Privacy-First Milestone Tracking (No Live GPS)

---

## **Training Schedule Overview**

| Day | Focus Area | Target Audience | Key Objectives |
| :--- | :--- | :--- | :--- |
| **Day 1** | **Field Operations** | Site Inspectors (46) | App mastery, Safety compliance, Trip execution, Emergency protocols. |
| **Day 2** | **Managerial Oversight** | Managers (2) | RBAC navigation, Assignment creation, Master data, Reporting & TAT analysis. |

---

## **Day 1: Field Operations (Mobile App)**

### **Module 1.1: System Access & Connectivity**
**Goal:** Ensure every inspector can access the QacaShield environment.

1.  **Installation & Configuration:**
    *   **APK Deployment:** Distribute the latest signed APK.
    *   **Connectivity Check:** Demonstrate the "Base URL" indicator on the login screen to verify server connection (LAN/WAN).
    *   **Permissions:** Walkthrough of mandatory Android permissions (Location, Camera, Notification).

2.  **Login Process:**
    *   Credentials provided by Circle Managers.
    *   **Troubleshooting:** What to do if "Invalid Credentials" or "Network Error" occurs.

### **Module 1.2: Attendance & Privacy (The "Clock-In" Logic)**
**Goal:** Replace manual attendance with verified geo-tags.

1.  **Daily Punch-In:**
    *   Open App -> Dashboard -> "Mark Attendance".
    *   **System Action:** Captures instantaneous GPS coordinates + Timestamp.
    *   *Note:* This marks the user as "Active" on the Manager's dashboard.

2.  **Exit Tracking (Privacy Protection):**
    *   **Scenario:** Inspector ends shift or takes a personal break.
    *   **Action:** Click "Exit Tracking" -> Select Reason (e.g., "Shift End", "Personal Emergency") -> Submit.
    *   **Outcome:** App stops all background data services. User status changes to "Inactive" in the system.

### **Module 1.3: The "Shield" Protocol (Pre-Trip Safety)**
**Goal:** Enforce 100% compliance before any trip starts. **CRITICAL STEP.**

1.  **Document Verification (One-Time/Periodic):**
    *   Navigate to **Profile > Documents**.
    *   **Upload:** Bike Insurance & Driving License photos.
    *   **Expiry Alerts:** Explain the 30-day auto-alert system for renewing documents.

2.  **Pre-Trip Safety Checklist (Per Assignment):**
    *   User selects an assigned trip.
    *   **Safety Check Screen:**
        *   **Helmet Verification:** User must take **two** photos of their helmet (Front & Side angles).
        *   **System Validation:** Photos are uploaded via multipart request. The "Start Assignment" button remains **LOCKED** until this upload is confirmed.

### **Module 1.4: Milestone-Based Trip Management**
**Goal:** Execute assignments using the "Snapshot" model.

1.  **Viewing Assignments:**
    *   Navigate to **Assignment Sidebar/List**.
    *   Identify "New Assignment" (Generated ID: *EmpID+Time+Date* format).
    *   Review details: Origin, Destination (Mine/Siding Code), and Priority.

2.  **Milestone 1: Start Assignment:**
    *   **Prerequisite:** Safety Check passed.
    *   **Action:** Click "Start Assignment".
    *   **System Event:** Captures **Snapshot A** (Start Lat/Lng + Time). Status changes to `ACTIVE`.
    *   *Visuals:* Route polyline appears (static reference, not turn-by-turn navigation).

3.  **Milestone 2: Complete Assignment:**
    *   Upon reaching destination.
    *   **Action:** Click "Complete Assignment".
    *   **System Event:** Captures **Snapshot B** (End Lat/Lng + Time). Status changes to `FINALIZED`.
    *   **Result:** Turnaround Time (TAT) is calculated (Snapshot B - Snapshot A).

### **Module 1.5: Emergency Protocols (SOS)**
**Goal:** Immediate assistance triggering.

*   **The SOS Button:** Located prominently on the Trip Screen.
*   **Trigger Logic:** Single tap triggers a high-priority alert.
*   **Data Packet:** Sends current static GPS coordinates immediately to the Manager's Dashboard.
*   **Manager View:** Displays a flashing modal with a direct Google Maps link to the inspector's location.

---

## **Day 2: Managerial Oversight (Web Dashboard)**

### **Module 2.1: Role-Based Access Control (RBAC)**
**Goal:** Data security and regional focus.

1.  **Login & Scope:**
    *   **UPW Manager:** Sees *only* inspectors and trips tagged with "UPW".
    *   **Delhi Manager:** Sees *only* inspectors and trips tagged with "Delhi".
    *   *Demo:* Show how the "All Employees" list is filtered automatically based on the logged-in manager's token.

### **Module 2.2: Master Data Management**
**Goal:** maintaining operational dropdowns.

1.  **Site Management:**
    *   **Mine Codes:** Add/Edit source locations (e.g., "M-001").
    *   **Siding Codes:** Add/Edit destination rail sidings (e.g., "SD-UPW-04").
    *   *Impact:* These codes populate the dropdowns in the "New Assignment" form, ensuring standardized data entry.

2.  **User Management:**
    *   **Onboarding:** Create new Inspector profiles.
    *   **Compliance Audit:** View uploaded DL/Insurance docs. Accept/Reject based on clarity/validity.

### **Module 2.3: Operational Monitoring (The Dashboard)**
**Goal:** Real-time situational awareness without live tracking.

1.  **Live Active Trips:**
    *   View list of currently `ACTIVE` assignments.
    *   **Indicators:** "On Route" status based on "Start" snapshot.
    *   *Note:* No moving car icons. Position is inferred between Start and End points.

2.  **Safety Validation:**
    *   Click on any active trip to view the **Helmet Photos** captured by the inspector.
    *   **Validation Protocol:** Manager visually confirms helmet usage.

3.  **Attendance Logs:**
    *   View "Daily Punch-In" table.
    *   Map View: See the geo-tag pins of where inspectors punched in.

### **Module 2.4: Reporting & TAT Analysis**
**Goal:** Performance measurement.

1.  **Validating Sample Entries:**
    *   Review a random 5% of completed trips daily.
    *   Check: Route adherence (via polyline comparison) and Time Taken.

2.  **TAT Reports:**
    *   **Calculation:** `Actual End Time` - `Actual Start Time`.
    *   **Outliers:** Highlight trips where TAT exceeds the "Expected Duration" + "Buffer Time".

3.  **Exporting Data:**
    *   **Formats:** PDF (Executive Summary) and Excel (Raw Data).
    *   **Fields:** Assignment ID, Inspector Name, Mine Code, Siding Code, Start Time, End Time, TAT, Safety Status.

---

## **Technical FAQ & Troubleshooting Guide**

*   **Q: Why can't I see the "Start Assignment" button?**
    *   *A: You likely haven't completed the Helmet Photo upload. Check the Safety Screen.*
*   **Q: The map isn't loading on the mobile app.**
    *   *A: Check your internet connection. If testing on a physical device, ensure the Base URL is set to the correct LAN IP.*
*   **Q: How do I change a wrong entry in Master Data?**
    *   *A: (Manager Only) Go to Admin Panel > Master Data > Edit icon next to the specific code.*
