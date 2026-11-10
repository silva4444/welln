export function createWorkspaceSync({ state, courses, completedCount, saveStudentWorkspaceData, syncStudentSnapshot, showToast }) {
  const localKey = () => `nexo-workspace-updated-at:${encodeURIComponent(state.student?.email?.toLowerCase() || "anonymous")}`;
  const pendingKey = () => `nexo-workspace-pending:${encodeURIComponent(state.student?.email?.toLowerCase() || "anonymous")}`;

  function setSyncStatus(status, message) {
    document.documentElement.dataset.syncStatus = status;
    window.dispatchEvent(new CustomEvent("coda-workspace-sync", { detail: { status, message } }));
  }

  function serverWorkspacePayload() {
    return {
      completed: state.completed,
      activities: state.activities,
      lessonChecks: state.lessonChecks,
      adaptiveResults: state.adaptiveResults,
      bookmarks: state.bookmarks,
      notes: state.notes,
      studyMinutes: state.studyMinutes,
      dailyGoal: state.dailyGoal,
      labCode: state.labCode,
      wiringByProject: state.wiringByProject,
      wiringComponents: JSON.parse(localStorage.getItem("nexo-wiring-components") || "[]"),
      threeDComponents: state.threeDComponents,
      threeDWires: state.threeDWires,
      sync: { clientUpdatedAt: localStorage.getItem(localKey()) || new Date().toISOString(), schemaVersion: 2 },
      summary: {
        lessons: Object.values(state.completed).filter(Boolean).length,
        activities: Object.values(state.activities).filter(Boolean).length,
        checks: Object.values(state.lessonChecks).filter(Boolean).length,
        adaptive: Object.values(state.adaptiveResults).filter(item => item?.correct).length,
        bookmarks: Object.values(state.bookmarks).filter(Boolean).length,
        studyMinutes: Object.values(state.studyMinutes).reduce((sum, value) => sum + Number(value || 0), 0),
        tracks: courses.filter(course => completedCount(course.id) > 0).length
      }
    };
  }

  async function hydrateServerWorkspace() {
    if (state.student?.role !== "Aluno" || !window.CodaAPI) return;
    try {
      const remote = await CodaAPI.workspace();
      const data = remote?.data || {};
      const remoteTime = Date.parse(remote?.updatedAt || data.sync?.clientUpdatedAt || 0) || 0;
      const localTime = Date.parse(localStorage.getItem(localKey()) || 0) || 0;
      if (Object.keys(data).length) {
        // Se este aparelho trabalhou offline depois da última gravação do servidor,
        // preserva o avanço local e o envia para a conta em vez de sobrescrevê-lo.
        if (localTime > remoteTime) {
          const saved = await CodaAPI.saveWorkspace(serverWorkspacePayload());
          if (saved?.updatedAt) localStorage.setItem(localKey(), saved.updatedAt);
          localStorage.removeItem(pendingKey());
          setSyncStatus("synced", "Avanço offline enviado para sua conta.");
          return;
        }
        state.completed = data.completed || {};
        state.activities = data.activities || {};
        state.lessonChecks = data.lessonChecks || {};
        state.adaptiveResults = data.adaptiveResults || {};
        state.bookmarks = data.bookmarks || {};
        state.notes = data.notes || {};
        state.studyMinutes = data.studyMinutes || {};
        state.dailyGoal = Number(data.dailyGoal || 30);
        Object.assign(state.labCode, data.labCode || {});
        if (data.wiringByProject && typeof data.wiringByProject === "object") {
          state.wiringByProject = data.wiringByProject;
          localStorage.setItem("nexo-wiring", JSON.stringify(state.wiringByProject));
        }
        if (Array.isArray(data.wiringComponents)) localStorage.setItem("nexo-wiring-components", JSON.stringify(data.wiringComponents));
        if (Array.isArray(data.threeDComponents)) {
          state.threeDComponents = data.threeDComponents;
          localStorage.setItem("nexo-3d-prototype", JSON.stringify(state.threeDComponents));
        }
        if (Array.isArray(data.threeDWires)) {
          state.threeDWires = data.threeDWires;
          localStorage.setItem("nexo-3d-wires", JSON.stringify(state.threeDWires));
        }
        localStorage.setItem(localKey(), remote?.updatedAt || data.sync?.clientUpdatedAt || new Date().toISOString());
      } else {
        await CodaAPI.saveWorkspace(serverWorkspacePayload());
      }
      localStorage.removeItem(pendingKey());
      setSyncStatus("synced", "Progresso salvo na sua conta.");
    } catch (error) {
      console.warn("Falha ao hidratar workspace remoto:", error?.message || error);
      showToast("Servidor temporariamente indisponível; seu progresso continua salvo neste navegador.");
      setSyncStatus("offline", "Sem conexão. O avanço será enviado automaticamente quando a internet voltar.");
    }
  }

  async function flushServerWorkspace() {
    if (state.student?.role !== "Aluno" || !window.CodaAPI) return false;
    const payload = serverWorkspacePayload();
    localStorage.setItem(pendingKey(), JSON.stringify(payload));
    setSyncStatus("saving", "Salvando progresso…");
    try {
      const saved = await CodaAPI.saveWorkspace(payload);
      if (saved?.updatedAt) localStorage.setItem(localKey(), saved.updatedAt);
      localStorage.removeItem(pendingKey());
      setSyncStatus("synced", "Progresso salvo na sua conta.");
      return true;
    } catch (error) {
      console.warn("Falha ao sincronizar workspace:", error?.message || error);
      setSyncStatus("offline", "Sem conexão. O avanço está guardado neste aparelho e será reenviado.");
      return false;
    }
  }

  function queueServerWorkspace() {
    if (state.student?.role !== "Aluno" || !window.CodaAPI) return;
    localStorage.setItem(pendingKey(), JSON.stringify(serverWorkspacePayload()));
    setSyncStatus("saving", "Salvando progresso…");
    clearTimeout(queueServerWorkspace.timer);
    queueServerWorkspace.timer = setTimeout(flushServerWorkspace, 600);
  }

  function saveStudentWorkspace() {
    if (!state.student) return;
    saveStudentWorkspaceData(state);
    syncStudentSnapshot();
    queueServerWorkspace();
  }

  window.addEventListener("online", () => flushServerWorkspace());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && localStorage.getItem(pendingKey())) flushServerWorkspace(); });

  return { serverWorkspacePayload, hydrateServerWorkspace, queueServerWorkspace, flushServerWorkspace, saveStudentWorkspace };
}

globalThis.CodaWorkspaceSyncModule = { createWorkspaceSync };
