# PMS Work Summary

## Overview
This project is a Hotel Property Management System (PMS) frontend built with React, Vite, Tailwind CSS, Supabase, and Recharts. It covers the core hotel operations needed for day-to-day management, including room monitoring, check-in/out flows, guest lookup, reports, and authentication.

---

## Project Scope Covered From Start to End

### 1. Application foundation
- Set up the project structure with React + Vite.
- Created the main app shell, routing, and shared layout.
- Added the dashboard, check-in, guest search, reports, and login pages.
- Integrated Supabase for persistence and real-time room/booking data handling.

### 2. Room management
- Built a room dashboard to visually display rooms by floor.
- Added room status handling for:
  - Available
  - Occupied
  - Cleaning
  - Out of Service
  - Checkout Today
- Added room cards with guest and booking details.
- Implemented status update actions from the dashboard.
- Expanded the room catalog to include the full room list:
  - 001–004 (Ground Floor)
  - 101–106 (First Floor)
  - 201–206 (Second Floor)
  - 301–305 (Top Floor)

### 3. Check-in flow
- Built a complete check-in experience for guests.
- Added guest form fields for room, occupancy, dates, tariff, payments, and notes.
- Added photo upload support for ID verification.
- Added confirmation modal before finalizing check-in.
- Connected room selection to the available room list.
- Ensured occupied rooms are not repeatedly selected.

### 4. Guest management
- Added guest search by name or mobile number.
- Implemented guest history and stay details.
- Added recurring customer lookup and suggestions.
- Displayed useful customer insights including:
  - stay count
  - lifetime spend
  - outstanding balance

### 5. Reports and analytics
- Added a reports page with occupancy and stay insights.
- Integrated charts and summary metrics for hotel operations.
- Displayed recent bookings and booking-level data.

### 6. Authentication and security flow
- Added login for managers.
- Protected private routes so unauthorized users cannot access the PMS.
- Updated authentication behavior so the app requires login again after being closed and reopened.
- Added a proper sign-out flow and sign-out icon.

### 7. UX and welcome experience
- Added a polished login screen with a branded welcome message.
- Added a temporary startup welcome animation using Framer Motion.
- Added a daily welcome screen that appears before the main PMS loads.

---

## Recent Enhancements Added

### Room and floor updates
- Added the full room list with consistent default attributes.
- Updated floor labels to display properly for:
  - Ground Floor
  - First Floor
  - Second Floor
  - Top Floor

### Login / session improvements
- Enforced login on each restart.
- Added a more user-friendly sign-out action.
- Added visible welcome text for the login experience.

### Guest search improvements
- Added live suggestions while typing.
- Displayed recurring customer summary details.

### Startup animation
- Added a temporary welcome animation for first-time startup of the day.

---

## Files Involved
- src/App.jsx
- src/components/Layout.jsx
- src/hooks/useAuth.jsx
- src/lib/roomCatalog.js
- src/lib/supabase.js
- src/pages/Dashboard.jsx
- src/pages/Checkin.jsx
- src/pages/GuestSearch.jsx
- src/pages/Login.jsx
- src/pages/Reports.jsx

---

## Verification
The project was verified successfully by running:

- `npm run build`

Result: build completed successfully.
