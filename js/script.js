(function () {
  "use strict";

  // Shared configuration comes from data.js so page-specific behavior stays here.
  var data = window.SmartComplaintData || {
    departments: ["IT", "Electrical", "Cleaning", "Hostel", "Library", "Academic", "Maintenance", "Transportation"],
    credentials: {},
    dashboards: {}
  };
  var seed = [
    { id: "CMP-1042", title: "Campus Wi-Fi issue", category: "IT", priority: "High", status: "Forwarded to Department", department: "IT", student: "Aarav Shah", date: "18 Sep 2026", description: "Connection drops repeatedly in the computer lab.", remarks: "Technician assigned.", timeline: [["Submitted", "18 Sep 2026"], ["Accepted by Admin", "19 Sep 2026"], ["Forwarded to IT", "19 Sep 2026"]] },
    { id: "CMP-1041", title: "Hostel water cooler", category: "Hostel", priority: "Medium", status: "Pending Admin Review", department: "", student: "Meera Patel", date: "17 Sep 2026", description: "The second-floor water cooler needs servicing.", timeline: [["Submitted", "17 Sep 2026"]] },
    { id: "CMP-1038", title: "Library study lights", category: "Library", priority: "Low", status: "Resolved", department: "Library", student: "Rohan Joshi", date: "12 Sep 2026", description: "Three lights were not working near the reference section.", remarks: "Lights replaced.", timeline: [["Submitted", "12 Sep 2026"], ["Accepted by Admin", "12 Sep 2026"], ["Forwarded to Library", "13 Sep 2026"], ["Resolved", "14 Sep 2026"]] }
  ];

  // Storage helpers keep the demo data in one place. This is browser-only storage,
  // not secure authentication or a replacement for a backend database.
  function read(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }
  function complaints() {
    var value = read("scsComplaints", null);
    if (!Array.isArray(value)) {
      save(seed);
      return seed.slice();
    }
    return value;
  }
  function save(value) { localStorage.setItem("scsComplaints", JSON.stringify(value)); }
  // The active sign-in is tab-local on purpose. sessionStorage belongs to a single
  // browser tab, so a Student tab keeps its Student login while an Admin or a
  // different department signs in in another tab. Complaints, notifications,
  // accounts, and student profiles deliberately stay in localStorage because that
  // data has to be shared between roles and tabs.
  var SESSION_KEY = "scsDemoSession";
  function session() {
    try {
      var value = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      return value && typeof value === "object" ? value : {};
    } catch (error) {
      // Storage is unavailable (or holds unreadable data): treat the tab as signed out.
      return {};
    }
  }
  function writeSession(value) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    } catch (error) {
      // A tab that refuses storage stays signed in for the current page only.
    }
  }
  function clearSession() {
    // Logout ends the sign-in of this tab and of no other tab.
    try { sessionStorage.removeItem(SESSION_KEY); } catch (error) { /* storage unavailable */ }
    try { localStorage.removeItem(SESSION_KEY); } catch (error) { /* storage unavailable */ }
  }
  function query(name) { return new URLSearchParams(location.search).get(name); }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
  function badge(status) {
    return status === "Resolved" ? "badge-success" : status === "Rejected" ? "badge-danger" : status.indexOf("Pending") === 0 ? "badge-warning" : "badge";
  }
  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (element) { element.textContent = value; });
  }
  function addTimeline(complaint, label) {
    complaint.timeline = complaint.timeline || [];
    complaint.timeline.push([label, formatDate()]);
  }
  function isForwarded(complaint) {
    return Boolean(complaint.department) && ["Forwarded to Department", "In Progress", "Resolved"].indexOf(complaint.status) >= 0;
  }
  function currentDepartment() { return session().department || ""; }
  function students() {
    var value = read("scsUsers", []);
    return Array.isArray(value) ? value : [];
  }
  function saveStudents(list) {
    try {
      localStorage.setItem("scsUsers", JSON.stringify(list));
      return true;
    } catch (error) {
      return false;
    }
  }
  function findStudent(email) {
    var wanted = String(email || "").trim().toLowerCase();
    return students().filter(function (student) { return String(student.email || "").toLowerCase() === wanted; })[0] || null;
  }
  // One stable student identifier is used everywhere: the normalized account
  // email. Session, complaint, and notification records all resolve their owner
  // through these helpers so a complaint written on one page is still found by
  // the details page, My Complaints, and the notification list after a refresh.
  function normalizeKey(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }
  function studentKey(active) {
    var value = active || session();
    return normalizeKey(value.id || value.email);
  }
  function ownerKey(complaint) {
    if (!complaint) return "";
    return normalizeKey(complaint.studentId || complaint.studentEmail);
  }
  // Older builds stored sessions, accounts, and complaints without the stable
  // student id, which made a student's own complaint look like it belonged to
  // somebody else. Repair those keys in place so nothing is lost on upgrade.
  function repairStoredIdentity() {
    try {
      // Builds before this fix kept the active sign-in in localStorage, which every
      // tab of the browser shares. Adopt it into this tab once, then drop the global
      // copy so no tab can silently change another tab's identity.
      var legacy = localStorage.getItem(SESSION_KEY);
      if (legacy !== null) {
        if (sessionStorage.getItem(SESSION_KEY) === null) sessionStorage.setItem(SESSION_KEY, legacy);
        localStorage.removeItem(SESSION_KEY);
      }
      var active = session();
      if (active && typeof active === "object" && active.role === "student") {
        var key = normalizeKey(active.id || active.email);
        if (key && active.id !== key) {
          active.id = key;
          writeSession(active);
        }
      }
      var accounts = read("scsUsers", null);
      if (Array.isArray(accounts)) {
        var accountsChanged = false;
        accounts.forEach(function (account) {
          if (!account || !account.email) return;
          var accountKey = normalizeKey(account.email);
          if (account.id !== accountKey) { account.id = accountKey; accountsChanged = true; }
        });
        if (accountsChanged) localStorage.setItem("scsUsers", JSON.stringify(accounts));
      }
      var stored = read("scsComplaints", null);
      if (Array.isArray(stored)) {
        var storedChanged = false;
        stored.forEach(function (complaint) {
          if (!complaint) return;
          var owner = normalizeKey(complaint.studentId || complaint.studentEmail);
          if (!owner || complaint.studentId === owner) return;
          complaint.studentId = owner;
          storedChanged = true;
        });
        if (storedChanged) save(stored);
      }
    } catch (error) {
      // Repairs are best effort; unreadable storage must not break the page.
    }
  }
  // Demo-only digest so a sign-in still works after a page refresh. Plain passwords
  // are never written to storage; a real deployment must verify credentials on a server.
  function digest(value) {
    var text = "scs::" + String(value || "");
    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(16);
  }
  function studentLabel() {
    var active = session();
    return active.role === "admin" ? "Admin" : active.role === "department" ? "Department team" : "Student";
  }
  function studentProfile() { return read("scsStudentProfile", {}); }
  function formatDate(date) {
    var value = date || new Date();
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var day = String(value.getDate());
    return (day.length === 1 ? "0" + day : day) + " " + months[value.getMonth()] + " " + value.getFullYear();
  }
  function resizeImage(file, maxEdge, quality, done) {
    var reader = new FileReader();
    reader.onload = function () {
      var original = String(reader.result || "");
      var image = new Image();
      image.onload = function () {
        var width = image.width || maxEdge;
        var height = image.height || maxEdge;
        var scale = Math.min(1, maxEdge / Math.max(width, height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        try {
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          done(canvas.toDataURL("image/jpeg", quality) || original);
        } catch (error) {
          done(original);
        }
      };
      image.onerror = function () { done(""); };
      image.src = original;
    };
    reader.onerror = function () { done(""); };
    reader.readAsDataURL(file);
  }
  function notifications() {
    var value = read("scsNotifications", []);
    return Array.isArray(value) ? value : [];
  }
  function statusKind(status) {
    if (status === "Rejected") return "rejected";
    if (status === "In Progress") return "in-progress";
    if (status === "Resolved") return "resolved";
    if (status === "Forwarded to Department") return "forwarded";
    return "submitted";
  }
  function notificationKind(complaint) {
    return statusKind(complaint && complaint.status);
  }
  // Notifications belong to the stable student id. Repeating the same status
  // action on the same complaint refreshes the existing entry instead of
  // stacking duplicates, while a new status always adds a new notification.
  function notifyStudent(complaint, title, message) {
    if (!complaint) return;
    var owner = ownerKey(complaint);
    if (!owner) return;
    var kind = notificationKind(complaint);
    var list = notifications();
    var entry = { id: "NTF-" + Date.now() + "-" + list.length, studentId: owner, complaintId: complaint.id, kind: kind, title: title, message: message, status: complaint.status, date: formatDate() };
    var position = -1;
    list.forEach(function (note, index) {
      if (!note) return;
      if (normalizeKey(note.studentId) !== owner) return;
      if (note.complaintId !== complaint.id) return;
      if (normalizeKey(note.kind || statusKind(note.status)) !== kind) return;
      position = index;
    });
    if (position >= 0) {
      entry.id = list[position].id;
      list[position] = entry;
    } else {
      list.unshift(entry);
    }
    try {
      localStorage.setItem("scsNotifications", JSON.stringify(list.slice(0, 60)));
    } catch (error) {
      // Storage is full; notifications stay informational so the complaint itself still saves.
    }
  }
  function studentStatusMessage(complaint) {
    var reference = "Complaint " + complaint.id;
    if (complaint.status === "In Progress") return "Your complaint is now in progress. " + reference + " is being handled by the " + complaint.department + " department.";
    if (complaint.status === "Resolved") return "Your complaint has been resolved. " + reference + " was closed by the " + complaint.department + " department.";
    return "Your complaint is now " + complaint.status + ". " + reference + ".";
  }
  function studentStatusTitle(complaint) {
    if (complaint.status === "In Progress") return "Complaint in progress";
    if (complaint.status === "Resolved") return "Complaint resolved";
    return "Complaint update";
  }
  function isStudentComplaint(complaint) {
    var active = session();
    var key = studentKey(active);
    if (active.role !== "student" || !key) return false;
    return ownerKey(complaint) === key;
  }
  function requireStudent() {
    var page = (location.pathname.split("/").pop() || "").toLowerCase();
    if (page.indexOf("student-") !== 0 || page === "student-login.html" || page === "student-register.html") return true;
    var active = session();
    if (active.role === "student" && active.id) return true;
    location.replace("student-login.html");
    return false;
  }

  // Complaint cards are rendered from data because the same records appear in
  // student, admin, and department views. Static page headings and form structure
  // remain in the HTML files so they are easy to find and edit.
  function render(list, target, role) {
    if (!target) return;
    target.innerHTML = list.length ? list.map(function (complaint) {
      var detail = role === "admin" ? "admin-complaint-details.html?id=" : role === "department" ? "department-complaint-details.html?id=" : "student-complaint-details.html?id=";
      var showDescription = location.pathname.indexOf("dashboard") < 0;
      return '<article class="complaint" data-complaint-id="' + escapeHtml(complaint.id) + '"><div class="complaint-top"><div><h3>' + escapeHtml(complaint.title) + '</h3><small class="text-muted">' + escapeHtml(complaint.id) + " · " + escapeHtml(complaint.date) + " · " + escapeHtml(complaint.student || "You") + '</small></div><span class="badge ' + badge(complaint.status) + '">' + escapeHtml(complaint.status) + '</span></div>' +
        (showDescription ? "<p>" + escapeHtml(complaint.description) + "</p>" : "") + '<span class="badge">' + escapeHtml(complaint.category) + "</span> " + (role === "student" && complaint.priority ? '<span class="badge">Priority: ' + escapeHtml(complaint.priority) + "</span> " : "") +
        (complaint.department ? '<span class="badge">Assigned: ' + escapeHtml(complaint.department) + "</span> " : "") +
        '<a class="btn btn-secondary btn-small" href="' + detail + encodeURIComponent(complaint.id) + '">View details</a>' +
        (role === "department" ? '<div class="filters dept-update"><select data-dept-status><option' + (complaint.status === "In Progress" ? " selected" : "") + '>In Progress</option><option' + (complaint.status === "Resolved" ? " selected" : "") + '>Resolved</option></select><input data-dept-remarks placeholder="Resolution remarks"><button type="button" class="btn btn-primary btn-small" data-update>Save update</button></div>' : "") + "</article>";
    }).join("") : '<div class="empty">No complaints match these filters.</div>';
  }
  function stats(list) {
    setText("[data-count=total]", list.length);
    setText("[data-count=pending]", list.filter(function (c) { return c.status === "Pending Admin Review"; }).length);
    setText("[data-count=progress]", list.filter(function (c) { return c.status === "Forwarded to Department" || c.status === "In Progress"; }).length);
    setText("[data-count=resolved]", list.filter(function (c) { return c.status === "Resolved"; }).length);
  }

  function renderAdminControls(complaint, target) {
    if (!target) return;
    if (complaint.status === "Rejected" || isForwarded(complaint)) {
      target.innerHTML = '<p class="notice">This complaint has already received an admin decision.</p>';
      return;
    }
    target.innerHTML = '<input id="adminRemarks" placeholder="Admin remarks (optional)"> <select id="assignDepartment"><option value="">Select department to forward</option>' +
      data.departments.map(function (department) { return "<option>" + escapeHtml(department) + "</option>"; }).join("") +
      '</select> <input id="rejectionReason" placeholder="Rejection reason (required)"> <button type="button" class="btn btn-primary" data-action="forward">Accept &amp; Forward to Department</button> <button type="button" class="btn btn-danger" data-action="reject">Reject Complaint</button><p class="form-error" data-admin-error aria-live="polite"></p>';
    target.addEventListener("click", function (event) {
      var action = event.target.getAttribute("data-action");
      if (!action) return;
      var list = complaints();
      var item = list.find(function (entry) { return entry.id === complaint.id; });
      var error = target.querySelector("[data-admin-error]");
      var remarks = target.querySelector("#adminRemarks").value.trim();
      if (action === "forward") {
        var department = target.querySelector("#assignDepartment").value;
        if (!department) { error.textContent = "Select a department before forwarding."; return; }
        item.status = "Forwarded to Department";
        item.department = department;
        item.decision = "Accepted and forwarded";
        item.adminRemarks = remarks;
        addTimeline(item, "Forwarded to " + department);
        notifyStudent(item, "Complaint forwarded", "Your complaint has been forwarded to the " + department + " department. Complaint " + item.id + " (submitted " + item.date + ") is now with the " + department + " team.");
      } else if (action === "reject") {
        var reason = target.querySelector("#rejectionReason").value;
        if (!reason || !reason.trim()) { error.textContent = "A rejection reason is required."; return; }
        item.status = "Rejected";
        item.department = "";
        item.decision = "Rejected";
        item.rejectionReason = reason.trim();
        item.adminRemarks = remarks;
        addTimeline(item, "Rejected by Admin");
        notifyStudent(item, "Complaint rejected", "Your complaint has been rejected. Complaint " + item.id + " (submitted " + item.date + ") was closed. Reason: " + reason.trim());
      }
      save(list);
      renderDetail(item, true);
    });
  }
  function renderDepartmentControls(complaint, target) {
    if (!target || !isForwarded(complaint) || complaint.department !== currentDepartment()) return;
    target.innerHTML = '<select id="departmentStatus"><option>In Progress</option><option>Resolved</option></select><input id="departmentRemarks" placeholder="Department remarks"><button type="button" class="btn btn-primary" data-department-save>Save department update</button>';
    target.querySelector("[data-department-save]").addEventListener("click", function () {
      var list = complaints();
      var item = list.find(function (entry) { return entry.id === complaint.id; });
      item.status = target.querySelector("#departmentStatus").value;
      item.departmentRemarks = target.querySelector("#departmentRemarks").value.trim();
      addTimeline(item, item.status);
      notifyStudent(item, studentStatusTitle(item), studentStatusMessage(item));
      save(list);
      renderDetail(item, false);
    });
  }
  function renderDetail(complaint, admin) {
    var root = document.querySelector("[data-detail]");
    if (!root || !complaint) return;
    var timeline = (complaint.timeline || [["Submitted", complaint.date]]).map(function (entry) {
      return '<div class="timeline-item"><strong>' + escapeHtml(entry[0]) + '</strong><p class="text-muted">' + escapeHtml(entry[1]) + "</p></div>";
    }).join("");
    var assignment = isForwarded(complaint) ? complaint.department : "Department not assigned yet";
    var decision = complaint.decision || (complaint.status === "Rejected" ? "Rejected" : complaint.status === "Pending Admin Review" ? "Awaiting Admin Review" : "Accepted and forwarded");
    var studentView = location.pathname.indexOf("student-complaint-details") >= 0;
    var rows = [["Category", complaint.category || "Not specified"], ["Decision", decision], ["Assignment", assignment]];
    if (complaint.priority) rows.push(["Priority", complaint.priority]);
    if (complaint.date) rows.push(["Submitted on", complaint.date]);
    if (complaint.adminRemarks) rows.push(["Admin remarks", complaint.adminRemarks]);
    if (complaint.departmentRemarks || complaint.remarks) rows.push(["Department remarks", complaint.departmentRemarks || complaint.remarks]);
    if (complaint.rejectionReason) rows.push(["Rejection reason", complaint.rejectionReason]);
    if (studentView && complaint.studentEmail) rows.push(["Registered email", complaint.studentEmail]);
    if (studentView && complaint.studentPhone) rows.push(["Contact number", complaint.studentPhone]);
    if (studentView && complaint.studentNumber) rows.push(["Student ID", complaint.studentNumber]);
    var detailRows = rows.map(function (row) { return "<p><strong>" + escapeHtml(row[0]) + ":</strong> " + escapeHtml(row[1]) + "</p>"; }).join("");
    var photos = (complaint.attachments || []).length ? "<h2>Attached photos</h2><div class=\"preview-grid\">" + complaint.attachments.map(function (file) { return "<figure class=\"preview\"><img src=\"" + escapeHtml(file.dataUrl) + "\" alt=\"" + escapeHtml(file.name) + "\"><figcaption class=\"text-muted\">" + escapeHtml(file.name) + "</figcaption></figure>"; }).join("") + "</div>" : "";
    root.innerHTML = '<div class="complaint-top"><div><span class="eyebrow">' + escapeHtml(complaint.id) + '</span><h1>' + escapeHtml(complaint.title) + '</h1><p class="text-muted">Submitted by ' + escapeHtml(complaint.student || "Student") + " on " + escapeHtml(complaint.date) + '</p></div><span class="badge ' + badge(complaint.status) + '">' + escapeHtml(complaint.status) + "</span></div><p>" + escapeHtml(complaint.description) + "</p>" + detailRows +
      (admin ? '<div class="filters" data-admin-controls></div>' : location.pathname.indexOf("department-complaint-details") >= 0 ? '<div class="filters" data-department-controls></div>' : "") +
      photos +
      "<h2>Progress timeline</h2><div class=\"timeline\">" + timeline + "</div>";
    if (admin) renderAdminControls(complaint, root.querySelector("[data-admin-controls]"));
    if (!admin && location.pathname.indexOf("department-complaint-details") >= 0) renderDepartmentControls(complaint, root.querySelector("[data-department-controls]"));
  }

  function departmentFromPath() {
    var path = location.pathname.toLowerCase();
    var match = path.match(/(?:department-)?(it|electrical|cleaning|hostel|library|academic|maintenance|transportation|transport)-(?:login|dashboard)/);
    if (!match) return "";
    return match[1] === "it" ? "IT" : match[1] === "transport" ? "Transportation" : match[1].charAt(0).toUpperCase() + match[1].slice(1);
  }
  function showPasswordToggles() {
    document.querySelectorAll('input[type="password"]').forEach(function (input) {
      if (input.parentNode.querySelector("[data-show-password]")) return;
      input.setAttribute("data-password-field", "true");
      var label = document.createElement("label");
      label.className = "password-toggle";
      label.innerHTML = '<input type="checkbox" data-show-password> Show Password';
      label.querySelector("input").addEventListener("change", function (event) {
        input.type = event.target.checked ? "text" : "password";
      });
      input.parentNode.appendChild(label);
    });
  }
  function setupLogin() {
    var form = document.querySelector("#loginForm, #adminLoginForm, #departmentLoginForm");
    if (!form) return;
    var error = document.createElement("p");
    error.className = "form-error";
    error.setAttribute("aria-live", "polite");
    form.appendChild(error);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = (form.querySelector('input[type="email"], input[name="email"]') || {}).value || "";
      var password = (form.querySelector('input[type="password"], input[name="password"], input[data-password-field]') || {}).value || "";
      var isAdmin = form.id === "adminLoginForm";
      var isDepartment = form.id === "departmentLoginForm";
      var department = isDepartment ? departmentFromPath() : "";
      var invalid = "Invalid credentials. Check your email/username and password.";
      var emailKey = email.trim().toLowerCase();
      if (!emailKey || !password) { error.textContent = "Enter your email and password."; return; }
      if (isAdmin || isDepartment) {
        var expected = data.credentials[isAdmin ? "admin" : department];
        if (!expected || emailKey !== String(expected.username).toLowerCase() || password !== expected.password) { error.textContent = invalid; return; }
        writeSession({ name: isAdmin ? "Admin" : department + " team", role: isAdmin ? "admin" : "department", department: department });
        location.href = isAdmin ? "admin-dashboard.html" : data.dashboards[department];
        return;
      }
      var record = findStudent(emailKey);
      if (record) {
        if (String(record.passwordDigest) !== digest(password)) { error.textContent = invalid; return; }
      } else {
        var universityAccount = data.credentials.student;
        if (!universityAccount || emailKey !== String(universityAccount.username).toLowerCase() || password !== universityAccount.password) { error.textContent = invalid; return; }
      }
      var id = normalizeKey((record && record.id) || emailKey);
      var stored = studentProfile();
      var displayName = stored.ownerId === id && stored.studentName ? stored.studentName : (record ? record.name : "Student");
      writeSession({ id: id, name: displayName, email: emailKey, role: "student", department: "" });
      location.href = "student-dashboard.html";
    });
  }
  function setupRegistration() {
    var form = document.querySelector("#registerForm");
    if (!form) return;
    var error = document.createElement("p");
    error.className = "form-error";
    error.setAttribute("aria-live", "polite");
    form.appendChild(error);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = (form.querySelector("#name") || {}).value || "";
      var email = (form.querySelector("#email") || {}).value || "";
      var password = (form.querySelector("#password") || {}).value || "";
      var confirmPassword = (form.querySelector("#confirmPassword") || {}).value || "";
      if (!name.trim() || !email.trim() || password.length < 4 || password !== confirmPassword) {
        error.textContent = password !== confirmPassword ? "Passwords do not match." : "Complete all fields and use a password of at least four characters.";
        return;
      }
      var emailKey = email.trim().toLowerCase();
      if (findStudent(emailKey)) { error.textContent = "That email is already registered. Sign in instead."; return; }
      var list = students();
      list.push({ id: emailKey, name: name.trim(), email: emailKey, passwordDigest: digest(password) });
      if (!saveStudents(list)) { error.textContent = "Browser storage is full, so the account could not be created."; return; }
      writeSession({ id: emailKey, name: name.trim(), email: emailKey, role: "student", department: "" });
      location.href = "student-dashboard.html";
    });
  }
  function setupProfileForms() {
    document.querySelectorAll("#adminProfileForm, #studentProfileForm").forEach(function (form) {
      if (form.id === "studentProfileForm") {
        var active = session();
        var stored = studentProfile();
        if (stored.ownerId && active.id && stored.ownerId !== active.id) stored = {};
        var defaults = {
          studentName: stored.studentName || active.name || "",
          studentEmail: stored.studentEmail || active.email || "",
          studentPhone: stored.studentPhone || "",
          studentId: stored.studentId || ""
        };
        ["studentName", "studentEmail", "studentPhone", "studentId"].forEach(function (id) {
          var field = form.querySelector("#" + id);
          if (field && defaults[id] && !field.value) field.value = defaults[id];
        });
        var storedAvatar = stored.studentAvatar;
        var preview = form.querySelector("#profilePreview");
        if (storedAvatar && preview && String(storedAvatar).indexOf("data:image") === 0) preview.src = storedAvatar;
        var picture = form.querySelector("#studentPicture");
        if (picture) picture.addEventListener("change", function () {
          var file = picture.files[0];
          if (!file) return;
          if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
            window.alert("Choose a JPG, PNG, or WebP image no larger than 2 MB.");
            picture.value = "";
            return;
          }
          resizeImage(file, 192, 0.8, function (dataUrl) {
            if (dataUrl && preview) preview.src = dataUrl;
          });
        });
      }
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var name = form.id === "studentProfileForm" ? form.querySelector("#studentName") : form.querySelector("input[type=text], input:not([type])");
        var message = form.querySelector("#profileMessage");
        if (name && !name.value.trim()) {
          message.textContent = "Name is required.";
          return;
        }
        if (form.id === "studentProfileForm") {
          var phone = form.querySelector("#studentPhone");
          if (phone && phone.value.trim() && !/^[0-9+()\s-]{7,20}$/.test(phone.value.trim())) {
            message.textContent = "Enter a valid phone number.";
            return;
          }
          var active = session();
          var profile = { ownerId: active.id || "" };
          ["studentName", "studentEmail", "studentPhone", "studentId"].forEach(function (id) {
            var field = form.querySelector("#" + id);
            if (field) profile[id] = field.value.trim();
          });
          var current = form.querySelector("#profilePreview");
          if (current && String(current.src).indexOf("data:image") === 0) profile.studentAvatar = current.src;
          try {
            localStorage.setItem("scsStudentProfile", JSON.stringify(profile));
          } catch (error) {
            delete profile.studentAvatar;
            try {
              localStorage.setItem("scsStudentProfile", JSON.stringify(profile));
            } catch (second) {
              message.textContent = "Profile could not be saved because browser storage is full.";
              return;
            }
          }
          var roster = students();
          var matched = false;
          roster.forEach(function (student) {
            if (student.id === active.id) {
              student.name = profile.studentName;
              student.phone = profile.studentPhone;
              student.studentId = profile.studentId;
              matched = true;
            }
          });
          if (matched) saveStudents(roster);
          active.name = profile.studentName;
          writeSession(active);
          setText("[data-user-name]", active.name || "Student");
          message.textContent = "Profile saved.";
          return;
        }
        message.textContent = "Saved for demo.";
      });
    });
  }
  function setupStudentSidebar() {
    var toggle = document.querySelector("[data-student-menu]");
    var sidebar = document.querySelector(".student-sidebar");
    var backdrop = document.querySelector(".student-sidebar-backdrop");
    if (!toggle || !sidebar || !backdrop) return;
    function close() { sidebar.classList.remove("open"); backdrop.classList.remove("open"); }
    toggle.addEventListener("click", function () { sidebar.classList.toggle("open"); backdrop.classList.toggle("open"); });
    backdrop.addEventListener("click", close);
    sidebar.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", close); });
  }
  function setupPortalShell() {
    var path = location.pathname.toLowerCase();
    var isAdmin = path.indexOf("admin-") >= 0 && path.indexOf("-login") < 0;
    var isDepartment = path.indexOf("department-") >= 0 && path.indexOf("-login") < 0 && path.indexOf("department-portal") < 0;
    if ((!isAdmin && !isDepartment) || !document.querySelector(".navbar")) return;
    if (isDepartment) {
      document.querySelectorAll("[data-demo-update]").forEach(function (button) {
        var parent = button.closest(".filters");
        if (parent) parent.remove();
      });
    }
    var activePath = path.split("/").pop() || "";
    if (isDepartment && activePath.indexOf("dashboard") >= 0) {
      var dashboardList = document.querySelector("#complaintList");
      if (dashboardList) {
        var dashboardCard = dashboardList.closest(".card");
        if (dashboardCard) dashboardCard.remove();
      }
    }
    var active = function (href) {
      var parts = href.split("?");
      if (activePath !== parts[0]) return "";
      if (parts[1]) return query("view") === parts[1].replace("view=", "") ? " class=\"active\"" : "";
      return " class=\"active\"";
    };
    var links = isAdmin ? [
      ["admin-dashboard.html", "Dashboard"],
      ["admin-complaints.html", "New Complaints"],
      ["admin-departments.html", "Departments"],
      ["admin-reports.html", "Reports"],
      ["admin-notifications.html", "Notifications"],
      ["admin-profile.html", "Profile"]
    ] : [
      [data.dashboards[currentDepartment()] || "department-dashboard.html", "Dashboard"],
      ["department-complaints.html?view=new", "New Complaints"],
      ["department-complaints.html?view=assigned", "Assigned Complaints"],
      ["department-complaints.html?view=progress", "In Progress"],
      ["department-complaints.html?view=resolved", "Resolved"],
      ["department-notifications.html", "Notifications"],
      ["department-profile.html", "Profile"]
    ];
    var navbar = document.querySelector(".navbar");
    navbar.innerHTML = '<div class="container navbar-content"><a class="brand" href="' + (isAdmin ? "admin-dashboard.html" : (data.dashboards[currentDepartment()] || "department-dashboard.html")) + '">Smart <span>Complaint System</span> <small>' + (isAdmin ? "ADMIN" : "DEPARTMENT") + '</small></a><button class="btn btn-secondary portal-menu-toggle" type="button" data-portal-menu aria-label="Open navigation">Menu</button><div class="nav-links"><span class="text-muted" data-user-name>' + escapeHtml(session().name || (isAdmin ? "Admin" : currentDepartment() + " team")) + '</span></div></div>';
    var sidebar = document.createElement("aside");
    sidebar.className = "portal-sidebar";
    sidebar.innerHTML = '<nav aria-label="' + (isAdmin ? "Admin" : "Department") + ' navigation">' +
      links.map(function (link) { return '<a' + active(link[0]) + ' href="' + link[0] + '">' + link[1] + "</a>"; }).join("") +
      '<a class="logout-link" href="index.html">Logout</a></nav>';
    var main = document.querySelector("main");
    if (main) {
      document.body.classList.add("portal-page");
      main.classList.add("portal-main");
      document.body.insertBefore(sidebar, main);
      var toggle = navbar.querySelector("[data-portal-menu]");
      var close = function () { sidebar.classList.remove("open"); };
      toggle.addEventListener("click", function () { sidebar.classList.toggle("open"); });
      sidebar.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", close); });
    }
  }
  function setupDemoButtons() {
    document.querySelectorAll("[data-demo-update]").forEach(function (button) {
      button.addEventListener("click", function () {
        button.textContent = "Saved for demo";
        button.disabled = true;
      });
    });
  }
  var pendingAttachments = [];
  function setupAttachments() {
    var input = document.querySelector("#attachments");
    var previews = document.querySelector("#previews");
    if (!input || !previews) return;
    function draw() {
      previews.innerHTML = pendingAttachments.map(function (file, index) {
        return "<div class=\"preview\"><img src=\"" + escapeHtml(file.dataUrl) + "\" alt=\"" + escapeHtml(file.name) + "\"><span>" + escapeHtml(file.name) + "</span><button type=\"button\" data-remove-file=\"" + index + "\" aria-label=\"Remove file\">&#215;</button></div>";
      }).join("");
      previews.querySelectorAll("[data-remove-file]").forEach(function (button) {
        button.addEventListener("click", function () {
          pendingAttachments.splice(Number(button.getAttribute("data-remove-file")), 1);
          draw();
        });
      });
    }
    input.addEventListener("change", function () {
      var chosen = Array.prototype.slice.call(input.files);
      var invalid = chosen.filter(function (file) { return !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024; });
      if (invalid.length || pendingAttachments.length + chosen.length > 5) {
        window.alert("Choose up to five JPG, PNG, or WebP images, each no larger than 2 MB.");
        input.value = "";
        return;
      }
      var waiting = chosen.length;
      chosen.forEach(function (file) {
        resizeImage(file, 1000, 0.72, function (dataUrl) {
          if (dataUrl) pendingAttachments.push({ name: file.name, dataUrl: dataUrl });
          waiting -= 1;
          if (waiting === 0) draw();
        });
      });
      input.value = "";
    });
  }

  // Shared navigation and form behavior is initialized only when its matching
  // elements exist, so the same script can safely load on every page.
  repairStoredIdentity();
  // Delegated so the handler also covers the logout link that setupPortalShell()
  // builds later for the admin and department sidebars. It ends this tab's sign-in
  // only; other tabs keep their own session.
  document.addEventListener("click", function (event) {
    if (event.target && event.target.closest && event.target.closest(".logout-link")) clearSession();
  });
  document.querySelectorAll("[data-menu]").forEach(function (button) {
    button.addEventListener("click", function () { document.querySelector(".navbar-content").classList.toggle("open"); });
  });
  if (!requireStudent()) return;
  var categoryField = document.querySelector("#category");
  if (categoryField && categoryField.tagName === "SELECT") categoryField.innerHTML = data.departments.map(function (department) { return "<option>" + escapeHtml(department) + "</option>"; }).join("");
  var hourOfDay = new Date().getHours();
  setText("[data-greeting]", hourOfDay < 12 ? "Good morning" : hourOfDay < 17 ? "Good afternoon" : "Good evening");
  showPasswordToggles();
  setupLogin();
  setupRegistration();
  setupProfileForms();
  setupDemoButtons();
  setupAttachments();
  setupStudentSidebar();
  setupPortalShell();

  // The submit page already owns a message area (#formMessage), so the success
  // confirmation stays on the form instead of sending the student straight to
  // the details page. Both follow-up links are plain, working links.
  function showSubmissionMessage(complaint, extra) {
    var form = document.querySelector("#complaintForm");
    var previews = document.querySelector("#previews");
    var notice = document.querySelector("#formMessage");
    pendingAttachments = [];
    if (previews) previews.innerHTML = "";
    if (form) form.reset();
    if (!notice) {
      window.alert("Your complaint has been submitted successfully. Complaint " + complaint.id + ".");
      return;
    }
    notice.innerHTML = "<strong>Your complaint has been submitted successfully.</strong> " +
      (extra ? escapeHtml(extra) + " " : "") +
      "Complaint <strong>" + escapeHtml(complaint.id) + "</strong> was submitted on " + escapeHtml(complaint.date) +
      " and is pending admin review." +
      '<span class="submission-actions"><a class="btn btn-primary btn-small" href="student-my-complaints.html">View My Complaints</a> ' +
      '<a class="btn btn-secondary btn-small" href="student-complaint-details.html?id=' + encodeURIComponent(complaint.id) + '">View complaint details</a> ' +
      '<a class="btn btn-secondary btn-small" href="student-submit-complaint.html">Submit another complaint</a></span>';
    if (notice.scrollIntoView) notice.scrollIntoView({ block: "nearest" });
  }
  function showSubmissionFailure() {
    var notice = document.querySelector("#formMessage");
    if (notice) {
      notice.textContent = "Browser storage is full, so the complaint could not be saved. Remove the photos and submit again.";
      return;
    }
    window.alert("Browser storage is full, so the complaint could not be saved.");
  }
  var complaintForm = document.querySelector("#complaintForm");
  if (complaintForm) complaintForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var formData = new FormData(complaintForm);
    var title = String(formData.get("title") || "").trim();
    var description = String(formData.get("description") || "").trim();
    if (!title || !description) {
      var formMessage = document.querySelector("#formMessage");
      if (formMessage) formMessage.textContent = "Title and description are required.";
      return;
    }
    var active = session();
    var owner = studentKey(active);
    if (!owner) {
      var expired = document.querySelector("#formMessage");
      if (expired) expired.textContent = "Your sign-in is no longer valid. Please sign in again and submit the complaint.";
      window.setTimeout(function () { location.href = "student-login.html"; }, 1200);
      return;
    }
    var list = complaints();
    var nextNumber = list.reduce(function (highest, complaint) {
      var number = Number(String(complaint.id || "").replace("CMP-", ""));
      return Number.isFinite(number) && number > highest ? number : highest;
    }, 1042) + 1;
    var usedIds = {};
    list.forEach(function (complaint) { usedIds[String(complaint.id)] = true; });
    while (usedIds["CMP-" + nextNumber]) nextNumber += 1;
    var profile = studentProfile();
    var submittedOn = formatDate();
    var item = { id: "CMP-" + nextNumber, title: title, description: description, category: formData.get("category"), priority: formData.get("priority"), status: "Pending Admin Review", department: "", student: active.name || "Student", studentId: owner, studentEmail: normalizeKey(active.email) || owner, studentPhone: profile.studentPhone || "", studentNumber: profile.studentId || "", date: submittedOn, decision: "Awaiting Admin Review", attachments: pendingAttachments.slice(0, 5), timeline: [["Submitted", submittedOn]] };
    list.unshift(item);
    var storageNotice = "";
    try {
      save(list);
    } catch (storageError) {
      item.attachments = [];
      list = complaints();
      list.unshift(item);
      try {
        save(list);
      } catch (retryError) {
        showSubmissionFailure();
        return;
      }
      storageNotice = "The complaint was saved without photos because browser storage is full.";
    }
    notifyStudent(item, "Complaint submitted", "Your complaint has been submitted successfully. Complaint " + item.id + " was received on " + item.date + " and is pending admin review.");
    pendingAttachments = [];
    showSubmissionMessage(item, storageNotice);
  });

  var complaintList = document.querySelector("#complaintList");
  if (!complaintList && (location.pathname.toLowerCase().indexOf("admin-") >= 0 || location.pathname.toLowerCase().indexOf("department-") >= 0)) {
    var overview = complaints();
    var overviewRole = location.pathname.toLowerCase().indexOf("admin-") >= 0 ? "admin" : "department";
    if (overviewRole === "department") overview = overview.filter(function (complaint) { return isForwarded(complaint) && complaint.department === currentDepartment(); });
    stats(overview);
  }
  if (complaintList) {
    var all = complaints();
    var path = location.pathname;
    var role = path.indexOf("admin") >= 0 ? "admin" : path.indexOf("student") >= 0 ? "student" : "department";
    var expectedDepartment = departmentFromPath();
    if (role === "department" && expectedDepartment && expectedDepartment !== currentDepartment()) {
      complaintList.innerHTML = '<p class="notice">This dashboard is not available for the signed-in department.</p>';
      stats([]);
      return;
    }
    if (role === "student") all = all.filter(function (complaint) { return isStudentComplaint(complaint); });
    if (role === "department") all = all.filter(function (complaint) { return isForwarded(complaint) && complaint.department === currentDepartment(); });
    if (role === "admin" && document.querySelector("[data-admin-view=new]")) all = all.filter(function (complaint) { return complaint.status === "Pending Admin Review"; });
    if (role === "department") {
      var view = query("view");
      if (view === "new") all = all.filter(function (complaint) { return complaint.status === "Forwarded to Department"; });
      if (view === "progress") all = all.filter(function (complaint) { return complaint.status === "In Progress"; });
      if (view === "resolved") all = all.filter(function (complaint) { return complaint.status === "Resolved"; });
    }
    render(all, complaintList, role);
    stats(all);
    document.querySelectorAll("[data-filter]").forEach(function (input) {
      input.addEventListener("input", function () {
        var search = (document.querySelector("[data-filter=search]") || {}).value || "";
        var status = (document.querySelector("[data-filter=status]") || {}).value || "All";
        render(all.filter(function (complaint) {
          return (!search || (complaint.title + " " + complaint.id + " " + complaint.category).toLowerCase().indexOf(search.toLowerCase()) >= 0) && (status === "All" || complaint.status === status);
        }), complaintList, role);
      });
    });
    if (role === "department") complaintList.addEventListener("click", function (event) {
      if (!event.target.hasAttribute("data-update")) return;
      var card = event.target.closest("[data-complaint-id]");
      var list = complaints();
      var item = list.find(function (complaint) { return complaint.id === card.getAttribute("data-complaint-id"); });
      if (!item || item.department !== currentDepartment() || !isForwarded(item)) return;
      item.status = card.querySelector("[data-dept-status]").value;
      item.departmentRemarks = card.querySelector("[data-dept-remarks]").value.trim();
      addTimeline(item, item.status);
      notifyStudent(item, studentStatusTitle(item), studentStatusMessage(item));
      save(list);
      location.reload();
    });
  }
  if (!complaintList && document.querySelector("[data-count=total]")) stats(complaints());

  var trackList = document.querySelector("#trackList");
  if (trackList) {
    var tracked = complaints().filter(function (complaint) { return isStudentComplaint(complaint); });
    render(tracked, trackList, "student");
  }
  var notificationList = document.querySelector("#notificationList");
  if (notificationList) {
    var currentStudentKey = studentKey();
    var ownNotes = notifications().filter(function (note) {
      return Boolean(currentStudentKey) && note && normalizeKey(note.studentId) === currentStudentKey;
    });
    notificationList.innerHTML = ownNotes.length ? ownNotes.map(function (note) {
      return "<article class=\"complaint\"><div class=\"complaint-top\"><div><h3>" + escapeHtml(note.title) + "</h3><small class=\"text-muted\">" + escapeHtml(note.complaintId) + " on " + escapeHtml(note.date) + "</small></div><span class=\"badge " + badge(note.status) + "\">" + escapeHtml(note.status || "") + "</span></div><p>" + escapeHtml(note.message) + "</p><a class=\"btn btn-secondary btn-small\" href=\"student-complaint-details.html?id=" + encodeURIComponent(note.complaintId) + "\">View complaint</a></article>";
    }).join("") : "<p class=\"notice\">No new notifications.</p>";
  }
  var detailRoot = document.querySelector("[data-detail]");
  if (detailRoot) {
    var requestedId = normalizeKey(query("id"));
    var item = complaints().find(function (complaint) { return normalizeKey(complaint.id) === requestedId; });
    var studentDetailPage = location.pathname.indexOf("student-complaint-details") >= 0;
    if (!item) {
      detailRoot.innerHTML = studentDetailPage
        ? '<p class="notice">Complaint not found. It is not stored in this browser. <a href="student-my-complaints.html">Back to my complaints</a></p>'
        : '<p class="notice">Complaint not found.</p>';
    } else if (studentDetailPage && !isStudentComplaint(item)) {
      detailRoot.innerHTML = '<p class="notice">This complaint is not available in your student portal. It belongs to a different account. <a href="student-my-complaints.html">Back to my complaints</a></p>';
    } else if (location.pathname.indexOf("department-complaint-details") >= 0 && (!isForwarded(item) || item.department !== currentDepartment())) {
      detailRoot.innerHTML = '<p class="notice">This complaint has not been forwarded to your department.</p>';
    } else {
      renderDetail(item, location.pathname.indexOf("admin-") >= 0);
    }
  }
  setText("[data-user-name]", session().name || studentLabel());
}());
