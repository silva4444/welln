export function createWorkspaceSync({ state, courses, completedCount, saveStudentWorkspaceData, syncStudentSnapshot, showToast }) {
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
      if (Object.keys(data).length) {
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
      } else {
        await CodaAPI.saveWorkspace(serverWorkspacePayload());
      }
    } catch (error) {
      console.warn("Falha ao hidratar workspace remoto:", error?.message || error);
      showToast("Servidor temporariamente indisponível; seu progresso continua salvo neste navegador.");
    }
  }

  function queueServerWorkspace() {
    if (state.student?.role !== "Aluno" || !window.CodaAPI) return;
    clearTimeout(queueServerWorkspace.timer);
    queueServerWorkspace.timer = setTimeout(() => {
      const request = CodaAPI.saveWorkspace(serverWorkspacePayload());
      request?.catch?.(error => console.warn("Falha ao sincronizar workspace:", error?.message || error));
    }, 600);
  }

  function saveStudentWorkspace() {
    if (!state.student) return;
    saveStudentWorkspaceData(state);
    syncStudentSnapshot();
    queueServerWorkspace();
  }

  return { serverWorkspacePayload, hydrateServerWorkspace, queueServerWorkspace, saveStudentWorkspace };
}

globalThis.CodaWorkspaceSyncModule = { createWorkspaceSync };
