# Smart Complaint System — University Complaint Management Demo

Smart Complaint System is a beginner-friendly, responsive **frontend-only** prototype for a university complaint workflow. It includes a public landing page, student sign-in and registration screens, student dashboard and complaint filters, admin review, and department portals.

## Run locally

Open `index.html` directly in a browser (`file://` works), or use any static web server. No build step, package manager, backend, database, or external CDN is required.

## Demo behaviour

- Sign-in forms validate the documented demo username/password pair for the selected portal.
- Complaints and the demo session are stored in browser `localStorage`; reset them by clearing site data.
- The complaint form accepts up to five image attachments (JPG, PNG, or WebP; 2 MB each), previews filenames and images, and supports removal before submit and supports removing previews.
- Search and status filters update the complaint list immediately.
- Admin and department screens are visual workflow demonstrations, not protected production portals.

There is no real authentication, password hashing, server persistence, email, or AI service. AI-assisted categorisation is intentionally described as a future enhancement.

## Main pages

`index.html`, `about.html`, `contact.html`, `index-login.html`, `register.html`, `student-dashboard.html`, `student-complaints.html`, `admin-login.html`, `admin-dashboard.html`, `department-login.html`, and `department-dashboard.html`.

## Complete page surface

Public: `index.html`, `how-it-works.html`, `features.html`, `about.html`, and `contact.html`.
Student: `student-login.html`, `student-register.html`, `student-submit-complaint.html`, `student-dashboard.html`, `student-my-complaints.html`, `student-complaints.html`, `student-complaint-details.html`, and `student-profile.html`.
Admin: `admin-login.html`, `admin-dashboard.html`, `admin-complaints.html`, `admin-complaint-details.html`, `admin-departments.html`, `admin-reports.html`, and `admin-profile.html`.
Department: `department-portal.html`, shared `department-login.html` / `department-dashboard.html`, plus dedicated IT, Electrical, Cleaning, Hostel, Library, Academic, Maintenance, and Transportation login/dashboard pairs.

Shared behavior lives in `js/script.js` and shared demo configuration lives in `js/data.js`; shared presentation lives in `css/style.css`.

## Beginner-friendly file guide

- **HTML files:** contain the readable page structure, headings, navigation, forms, tables, and empty containers for dynamic records. Start here when changing page text or adding a form field.
- **`css/style.css`:** contains the complete visual theme. It is organized into global values, navigation/public content, authentication, portal components, feedback, attachment previews, and responsive rules. Change the colour variables near the top when adjusting the theme.
- **`js/data.js`:** contains department names, demo credentials, dashboard routes, and allowed complaint statuses.
- **`js/script.js`:** contains behavior only: storage, demo login/registration, navigation, validation, attachment previews, complaint rendering, filters, admin decisions, department updates, and dashboard statistics. Dynamic complaint records remain in JavaScript because they depend on browser data.

The HTML pages were formatted so each element can be read and edited directly. Repeated portal pages intentionally remain separate static entry points to preserve every existing route; their shared appearance comes from the single stylesheet and shared script.

### Common changes

- Change a heading or paragraph in the matching `.html` file.
- Change colours or button appearance in the variables and button section of `css/style.css`.
- Add a form field in the relevant HTML form, then update the submit handler in `js/script.js` if the value must be validated or stored.
- Add a dashboard card in the page's `.stats-grid`; use a matching `data-count` attribute only when `stats()` should calculate its value.
- Add a navigation link inside that page's `.nav-links` container.

The application remains a frontend demonstration. A real implementation still needs server-side authentication, authorization, validation, and durable database storage.


## Demo credentials
- Student: student@demo.edu / student123
- Admin: admin@demo.edu / admin123
- IT & Technical: it@university.edu / it123
- Electrical: electrical@university.edu / electrical123
- Cleaning & Sanitation: cleaning@university.edu / cleaning123
- Hostel: hostel@university.edu / hostel123
- Library: library@university.edu / library123
- Academic: academic@university.edu / academic123
- Maintenance: maintenance@university.edu / maintenance123
- Transportation: transport@university.edu / transport123

Credentials are documentation for the frontend demonstration only. The browser validates them for this demo, but this is not production authentication. Passwords are never stored in localStorage; the demo only stores the selected role, department, and display name. Real authentication, authorization, session management, password hashing, and durable complaint storage still require a PHP/MySQL backend.
