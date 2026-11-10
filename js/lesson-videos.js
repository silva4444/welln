(() => {
  "use strict";

  /*
   * Fontes reais por matéria. Cada aula abre um trecho diferente da fonte
   * pública, em vez de exibir um card animado que finge ser uma videoaula.
   * Os IDs são os vídeos que já faziam parte do catálogo do CODA e foram
   * conferidos por título antes de serem usados nesta versão.
   */
  const sourceByCourse = {
    html: { id: "UB1O30fR-EE", step: 420, title: "HTML Crash Course For Absolute Beginners" },
    css: { id: "1PnVor36_40", step: 160, title: "Learn CSS in 20 Minutes" },
    javascript: { id: "W6NZfCO5SIk", step: 420, title: "JavaScript Tutorial" },
    typescript: { id: "BwuLxPH8IDs", step: 420, title: "TypeScript Course for Beginners" },
    python: { id: "kqtD5dpn9C8", step: 420, title: "Python for Beginners" },
    c: { id: "KJgsSFOSQv0", step: 600, title: "C Programming Tutorial for Beginners" },
    cplus: { id: "vLnPwxZdW4Y", step: 600, title: "C++ Tutorial for Beginners - Full Course" },
    cpp: { id: "ZzaPdXTrSb8", step: 420, title: "C++ Tutorial for Beginners - Learn C++ in 1 Hour" },
    csharp: { id: "GhQdlIFylQ8", step: 600, title: "C# Tutorial - Full Course for Beginners" },
    java: { id: "eIrMbAQSU34", step: 600, title: "Java Tutorial" },
    react: { id: "SqcY0GlETPk", step: 420, title: "React Tutorial for Beginners" },
    reactnative: { id: "0-S5a0eXPoc", step: 420, title: "React Native Tutorial for Beginners" },
    esp32: { id: "xPlN_Tk3VLQ", step: 420, title: "ESP32 / MicroPython" },
    sql: { id: "HXV3zeQKqGY", step: 600, title: "SQL Tutorial - Full Database Course for Beginners" }
  };

  function get(courseId, lessonIndex, mode = "short") {
    const source = sourceByCourse[courseId] || sourceByCourse.html;
    const lesson = Math.max(0, Math.min(6, Number(lessonIndex) || 0));
    const start = lesson * source.step;
    const short = mode !== "full";
    return {
      id: source.id,
      start,
      end: short ? start + Math.max(100, source.step - 20) : null,
      title: source.title,
      label: short ? "TRECHO REAL • VIDEOAULA" : "VIDEOAULA COMPLETA",
      duration: short ? Math.round(Math.max(2, (source.step - 20) / 60)) : null
    };
  }

  window.CodaLessonVideos = { get, sourceByCourse };
})();
