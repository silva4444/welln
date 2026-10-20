"use strict";

(function exposeCodaApi(){
  async function request(path, options = {}) {
    const config = { credentials: "same-origin", ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } };
    if (config.body && typeof config.body !== "string") config.body = JSON.stringify(config.body);
    const response = await fetch(path, config);
    const type = response.headers.get("content-type") || "";
    const data = type.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const error = new Error(data?.message || `Erro ${response.status}`);
      error.status = response.status; error.code = data?.error; error.data = data;
      throw error;
    }
    return data;
  }

  const api = {
    request,
    me: () => request("/api/auth/me"),
    login: data => request("/api/auth/login", { method: "POST", body: data }),
    registerStudent: data => request("/api/auth/register", { method: "POST", body: data }),
    logout: () => request("/api/auth/logout", { method: "POST", body: {} }),
    changePassword: data => request("/api/auth/change-password", { method: "POST", body: data }),
    resetUserPassword: (id, password) => request(`/api/admin/users/${encodeURIComponent(id)}/password`, { method: "POST", body: { password } }),
    community: () => request("/api/community"),
    communityMutate: data => request("/api/community/mutate", { method: "POST", body: data }),
    adminDashboard: () => request("/api/admin/dashboard"),
    saveInstitution: data => request("/api/admin/institution", { method: "PUT", body: data }),
    setUserActive: (id, active) => request(`/api/admin/users/${id}`, { method: "PATCH", body: { active } }),
    updateUserAccess: (id, data) => request(`/api/admin/users/${id}`, { method: "PATCH", body: data }),
    setPrivacyTask: (id, completed) => request(`/api/admin/privacy/${id}`, { method: "PATCH", body: { completed } }),
    overview: () => request("/api/overview"),
    classes: () => request("/api/classes"),
    createClass: data => request("/api/classes", { method: "POST", body: data }),
    updateClass: (id, data) => request(`/api/classes/${id}`, { method: "PATCH", body: data }),
    joinClass: code => request("/api/classes/join", { method: "POST", body: { code } }),
    students: () => request("/api/students"),
    classMembers: id => request(`/api/classes/${id}/members`),
    enrollStudent: (classId, studentId) => request(`/api/classes/${classId}/members`, { method: "POST", body: { studentId } }),
    setEnrollment: (classId, studentId, status) => request(`/api/classes/${classId}/members/${studentId}`, { method: "PATCH", body: { status } }),
    announcements: classId => request(`/api/announcements${classId ? `?classId=${encodeURIComponent(classId)}` : ""}`),
    createAnnouncement: data => request("/api/announcements", { method: "POST", body: data }),
    messages: classId => request(`/api/messages${classId ? `?classId=${encodeURIComponent(classId)}` : ""}`),
    createMessage: data => request("/api/messages", { method: "POST", body: data }),
    chatStatus: () => request("/api/chat/status"),
    chatConversations: () => request("/api/chat/conversations"),
    createChatConversation: data => request("/api/chat/conversations", { method: "POST", body: data }),
    chatMessages: id => request(`/api/chat/conversations/${id}/messages`),
    deleteChatConversation: id => request(`/api/chat/conversations/${id}`, { method: "DELETE", body: {} }),
    sendChatMessage: data => request("/api/chat/messages", { method: "POST", body: data }),
    rateChatMessage: (id, feedback) => request(`/api/chat/messages/${id}/feedback`, { method: "POST", body: { feedback } }),
    notifications: () => request("/api/notifications"),
    markNotificationsRead: () => request("/api/notifications/read", { method: "POST", body: {} }),
    workspace: () => request("/api/workspace"),
    saveWorkspace: data => request("/api/workspace", { method: "PUT", body: data }),
    event: data => request("/api/events", { method: "POST", body: data }),
    analytics: classId => request(`/api/analytics${classId ? `?classId=${encodeURIComponent(classId)}` : ""}`),
    diary: (classId, date) => request(`/api/teacher/diary?classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`),
    saveAttendance: data => request("/api/teacher/attendance", { method: "PUT", body: data }),
    saveGrade: data => request("/api/teacher/grades", { method: "POST", body: data }),
    saveRubric: data => request("/api/teacher/rubrics", { method: "POST", body: data }),
    importStudents: rows => request("/api/teacher/students/import", { method: "POST", body: { rows } }),
    assessments: () => request("/api/assessments"),
    assessment: id => request(`/api/assessments/${id}`),
    createAssessment: data => request("/api/assessments", { method: "POST", body: data }),
    assessmentStatus: (id, status) => request(`/api/assessments/${id}/status`, { method: "PATCH", body: { status } }),
    submitAssessment: (id, answers) => request(`/api/assessments/${id}/submit`, { method: "POST", body: { answers } }),
    reviewSubmission: (id, data) => request(`/api/submissions/${id}/review`, { method: "PATCH", body: data }),
    content: () => request("/api/content"),
    saveLesson: data => request("/api/content/lesson", { method: "PUT", body: data }),
    addMaterial: data => request("/api/materials", { method: "POST", body: data }),
    challenges: () => request("/api/challenges"),
    addChallenge: data => request("/api/challenges", { method: "POST", body: data }),
    backups: () => request("/api/backups"),
    createBackup: () => request("/api/backups", { method: "POST", body: {} }),
    auditLog: () => request("/api/admin/audit-log")
  };
  window.CodaAPI = Object.freeze(api);
})();
