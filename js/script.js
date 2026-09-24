(function () {
  "use strict";

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
  function session() { return read("scsDemoSession", {}); }
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
    complaint.timeline.push([label, "Today"]);
  }
  function isForwarded(complaint) {
    return Boolean(complaint.department) && ["Forwarded to Department", "In Progress", "Resolved"].indexOf(complaint.status) >= 0;
  }
  function currentDepartment() { return session().department || ""; }

  function render(list, target, role) {
    if (!target) return;
    target.innerHTML = list.length ? list.map(function (complaint) {
      var detail = role === "admin" ? "admin-complaint-details.html?id=" : role === "department" ? "department-complaint-details.html?id=" : "student-complaint-details.html?id=";
      var showDescription = location.pathname.indexOf("dashboard") < 0;
      return '<article class="complaint" data-complaint-id="' + escapeHtml(complaint.id) + '"><div class="complaint-top"><div><h3>' + escapeHtml(complaint.title) + '</h3><small class="text-muted">' + escapeHtml(complaint.id) + " · " + escapeHtml(complaint.date) + " · " + escapeHtml(complaint.student || "You") + '</small></div><span class="badge ' + badge(complaint.status) + '">' + escapeHtml(complaint.status) + '</span></div>' +
        (showDescription ? "<p>" + escapeHtml(complaint.description) + "</p>" : "") + '<span class="badge">' + escapeHtml(complaint.category) + "</span> " +
        (complaint.department ? '<span class="badge">Assigned: ' + escapeHtml(complaint.department) + "</span> " : "") +
        '<a class="btn btn-secondary btn-small" href="' + detail + encodeURIComponent(complaint.id) + '">View details</a>' +
        (role === "department" ? '<div class="filters dept-update"><select data-dept-status><option>In Progress</option><option>Resolved</option></select><input data-dept-remarks placeholder="Resolution remarks"><button type="button" class="btn btn-primary btn-small" data-update>Save update</button></div>' : "") + "</article>";
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
      } else if (action === "reject") {
        var reason = target.querySelector("#rejectionReason").value;
        if (!reason || !reason.trim()) { error.textContent = "A rejection reason is required."; return; }
        item.status = "Rejected";
        item.department = "";
        item.decision = "Rejected";
        item.rejectionReason = reason.trim();
        item.adminRemarks = remarks;
        addTimeline(item, "Rejected by Admin");
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
    root.innerHTML = '<div class="complaint-top"><div><span class="eyebrow">' + escapeHtml(complaint.id) + '</span><h1>' + escapeHtml(complaint.title) + '</h1><p class="text-muted">Submitted by ' + escapeHtml(complaint.student) + " · " + escapeHtml(complaint.date) + '</p></div><span class="badge ' + badge(complaint.status) + '">' + escapeHtml(complaint.status) + "</span></div><p>" + escapeHtml(complaint.description) + '</p><p><strong>Decision:</strong> ' + escapeHtml(decision) + "<br><strong>Assignment:</strong> " + escapeHtml(assignment) + "<br><strong>Admin remarks:</strong> " + escapeHtml(complaint.adminRemarks || "—") + "<br><strong>Department remarks:</strong> " + escapeHtml(complaint.departmentRemarks || complaint.remarks || "—") + "<br><strong>Rejection reason:</strong> " + escapeHtml(complaint.rejectionReason || "—") + "</p>" +
      (admin ? '<div class="filters" data-admin-controls></div>' : location.pathname.indexOf("department-complaint-details") >= 0 ? '<div class="filters" data-department-controls></div>' : "") +
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
      var key = isAdmin ? "admin" : isDepartment ? department : "student";
      var expected = data.credentials[key];
      if (!email.trim() || !password || !expected || email.trim().toLowerCase() !== expected.username.toLowerCase() || password !== expected.password) {
        error.textContent = "Invalid credentials. Check your email/username and password.";
        return;
      }
      localStorage.setItem("scsDemoSession", JSON.stringify({ name: isAdmin ? "Admin" : isDepartment ? department + " team" : "Demo student", role: isAdmin ? "admin" : isDepartment ? "department" : "student", department: department }));
      location.href = isAdmin ? "admin-dashboard.html" : isDepartment ? data.dashboards[department] : "student-dashboard.html";
    });
  }
  function setupAttachments() {
    var input = document.querySelector("#attachments");
    var previews = document.querySelector("#previews");
    if (!input || !previews) return;
    var files = [];
    function draw() {
      previews.innerHTML = files.map(function (file, index) {
        return '<div class="preview">' + (file.previewUrl ? '<img src="' + file.previewUrl + '" alt="' + escapeHtml(file.name) + '">' : "") + '<span>' + escapeHtml(file.name) + '</span><button type="button" data-remove-file="' + index + '" aria-label="Remove ' + escapeHtml(file.name) + '">×</button></div>';
      }).join("");
      previews.querySelectorAll("[data-remove-file]").forEach(function (button) {
        button.addEventListener("click", function () {
          files.splice(Number(button.getAttribute("data-remove-file")), 1);
          draw();
        });
      });
    }
    input.addEventListener("change", function () {
      var invalid = Array.prototype.slice.call(input.files).filter(function (file) {
        return !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024;
      });
      if (invalid.length || files.length + input.files.length > 5) {
        window.alert("Choose up to five JPG, PNG, or WebP images, with each file no larger than 2 MB.");
        input.value = "";
        return;
      }
      files = files.concat(Array.prototype.slice.call(input.files).map(function (file) {
        file.previewUrl = URL.createObjectURL(file);
        return file;
      }));
      draw();
    });
  }

  document.querySelectorAll(".logout-link").forEach(function (link) {
    link.addEventListener("click", function () { localStorage.removeItem("scsDemoSession"); });
  });
  document.querySelectorAll("[data-menu]").forEach(function (button) {
    button.addEventListener("click", function () { document.querySelector(".navbar-content").classList.toggle("open"); });
  });
  showPasswordToggles();
  setupLogin();
  setupAttachments();

  var complaintForm = document.querySelector("#complaintForm");
  if (complaintForm) complaintForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var formData = new FormData(complaintForm);
    var list = complaints();
    var item = { id: "CMP-" + (1043 + list.length), title: formData.get("title"), description: formData.get("description"), category: formData.get("category"), priority: formData.get("priority"), status: "Pending Admin Review", department: "", student: session().name || "Demo student", date: "Today", decision: "Awaiting Admin Review", timeline: [["Submitted", "Today"]] };
    list.unshift(item);
    save(list);
    location.href = "student-complaint-details.html?id=" + encodeURIComponent(item.id);
  });

  var complaintList = document.querySelector("#complaintList");
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
    if (role === "student") all = all.filter(function (complaint) { return !session().name || complaint.student === session().name || complaint.student === "Demo student"; });
    if (role === "department") all = all.filter(function (complaint) { return isForwarded(complaint) && complaint.department === currentDepartment(); });
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
      save(list);
      location.reload();
    });
  }

  var detailRoot = document.querySelector("[data-detail]");
  if (detailRoot) {
    var item = complaints().find(function (complaint) { return complaint.id === query("id"); });
    if (!item) {
      detailRoot.innerHTML = '<p class="notice">Complaint not found.</p>';
    } else if (location.pathname.indexOf("department-complaint-details") >= 0 && (!isForwarded(item) || item.department !== currentDepartment())) {
      detailRoot.innerHTML = '<p class="notice">This complaint has not been forwarded to your department.</p>';
    } else {
      renderDetail(item, location.pathname.indexOf("admin-") >= 0);
    }
  }
  setText("[data-user-name]", session().name || "Demo user");
}());
