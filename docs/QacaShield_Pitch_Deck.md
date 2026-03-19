# QacaShield Pitch Deck

## 1. One‑Line
- Privacy‑first milestone tracking and safety management for two‑wheeler fleets

## 2. Problem
- Fragmented tracking, manual check‑ins, and inconsistent compliance on daily assignments
- High operational effort to verify safety, arrival, and return‑home
- Poor visibility for managers across active trips and history

## 3. Solution
- Mobile app with auto‑arrival geofence detection and helmet safety verification
- Backend monitors destination and return‑home with debounced geofences
- Web manager dashboard with real‑time tracking and rich reports

## 4. Key Features
- Auto‑arrival at destination (debounced to avoid false positives)
- Auto finalize on return‑home (debounced)
- Year/month filters in History; badges for Completed/Cancelled/Early Exit
- Per‑row “Track” in Reports; shows live lat/lon updates
- CORS allowlist; env‑driven configuration; offline route cache

## 5. Architecture Overview
- Mobile: Flutter (Android/Web) with background location and geofenced phases
- Backend: Node.js + Express + Sequelize + Socket.io
- Web: React + Leaflet for maps, manager controls, and reports

## 6. Flow: Assignment Lifecycle
- Pending → Accepted → Safety Verified → Active → Reached Destination → Returning Home → Completed/Finalized
- Early Exit supported with reason capture

## 7. Geofence Logic Highlights
- Destination arrival: requires sustained presence in radius (hits + seconds)
- Return‑home finalization: same debounce pattern to reduce GPS jitter effects
- Radius default 100 m; min enforced 10 m; per‑assignment override supported

## 8. Privacy & Compliance
- Privacy guard middleware blocks GPS pings unless assignment is ACTIVE
- Debouncing reduces accidental phase changes from brief pings
- Service windows and safe defaults for messaging channels

## 9. Pricing: WhatsApp Business API (2026 India)
- Model: per‑message pricing (post‑July 2025) by category and destination country
- India 2026 (examples):
  - Marketing: ~₹0.8631 per message
  - Utility: ~₹0.115 per message
  - Authentication (domestic): ~₹0.115 per message
  - Authentication‑International: ~₹2.30 per message
- Notes:
  - Service replies within a customer‑initiated 24h window are free
  - Volume tiers apply to Utility and Authentication (not Marketing)
- References:
  - Authkey pricing update (January 2026): https://authkey.io/blogs/whatsapp-pricing-update-2026/
  - Category and per‑message model details: https://chatarmin.com/en/blog/whats-app-api-pricing
  - 2026 overview and ranges: https://www.spurnow.com/en/blogs/whatsapp-business-api-pricing-explained

## 10. Pricing: SMS (India)
- SMS costs depend on provider, route, sender ID type, and registration (DLT)
- Typical ranges with major providers:
  - ~$0.002–$0.008 per outbound SMS (domestic A2P), plus carrier/DLT fees
  - Segmented billing applies for long messages (160 GSM chars baseline)
- References:
  - Twilio India SMS pricing page: https://www.twilio.com/en-us/sms/pricing/in
  - Twilio global SMS overview: https://www.twilio.com/en-us/pricing
- Recommendation:
  - Select a BSP/SMS aggregator with transparent pass‑through rates
  - Confirm exact INR rate card per sender ID and DLT registration

## 11. Cost Optimization Playbook
- Maximize free messaging windows (service replies; Click‑to‑WhatsApp entries)
- Prefer Utility/Authentication over Marketing whenever appropriate
- Use audience segmentation and template reuse; leverage volume tiers
- For SMS, keep templates concise; avoid multi‑segment messages

## 12. ROI Snapshot
- Faster arrivals and fewer manual updates reduce manager overhead
- Live tracking lowers “where is my rider?” queries
- Safety verification reduces non‑compliance risk

## 13. Demo Highlights
- Mobile auto‑arrival → return‑home flow
- Web Reports row “Track” showing live lat/lon
- History filters and status badges

## 14. Roadmap
- Live large map monitor; route replay and anomalies
- Admin rate configuration (per region/channel) in settings
- Optional OTP over WhatsApp vs SMS; dynamic failovers

## 15. Contact
- GitHub: https://github.com/prajapativishall/QacaShield
- Email/WhatsApp: Add your contact here

