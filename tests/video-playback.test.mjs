import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const core = readFileSync(process.env.CODA_TEST_CORE || new URL("../js/core.js", import.meta.url), "utf8");
const sources = readFileSync(new URL("../js/lesson-videos.js", import.meta.url), "utf8");
const embed = core.slice(core.indexOf("function youtubeEmbedUrl("), core.indexOf("function microVideoMarkup("));
const render = core.slice(core.indexOf("function renderVideos("), core.indexOf("function languageOptions("));

// Small DOM double: preserve event handlers, replace the frame on each render,
// and record navigations. No network, accounts, or external videos are required.
function player() {
  const elements = new Map();
  const node = () => ({ hidden: false, dataset: {}, classList: { toggle() {} }, addEventListener(type, handler) { this[type] = handler; } });
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, node());
    return elements.get(selector);
  };
  const frame = get(".player-frame");
  Object.defineProperty(frame, "innerHTML", { set(markup) {
    this.markup = markup;
    const iframe = node();
    iframe.navigations = [];
    iframe.getAttribute = key => key === "src" ? iframe.src : null;
    Object.defineProperty(iframe, "src", { get() { return this.navigations.at(-1); }, set(url) { this.navigations.push(url); } });
    elements.set("#videoFrame", iframe);
    elements.set("#videoPlaceholder", node());
  }});
  Object.defineProperty(get("#playerInfo"), "innerHTML", { set(markup) {
    this.markup = markup;
    get("#retryVideo").hidden = true;
    get("#videoPlaybackHelp").hidden = true;
  }});
  get("#videoCourseSelect").options = [{}, {}];
  const courses = [{ id: "html", name: "HTML" }, { id: "css", name: "CSS" }];
  const catalog = [{ courseId: "html", lessonIndex: 0 }, { courseId: "html", lessonIndex: 1 }, { courseId: "css", lessonIndex: 0 }];
  const queue = catalog.map((_, index) => Object.assign(node(), { dataset: { video: String(index) } }));
  const events = [];
  const sandbox = {
    window: {}, URLSearchParams, $: get, $$: selector => selector === "[data-video]" ? queue : [],
    state: { currentVideo: 0, videoCourse: "Todas", videoSearch: "", videoLength: "short" },
    courseBlueprints: courses, videoCatalog: catalog, renderVideoFilters() {},
    courseById: id => courses.find(course => course.id === id), lessonTitle: (course, index) => `${course.name} aula ${index + 1}`,
    lessonDeepDiveData: () => ({ checkpoint: "Pratique" }), escapeHtml: value => String(value || ""),
    trackLearningEvent: (name, data) => events.push({ name, data }), openCourse() {}
  };
  runInNewContext(sources, sandbox);
  sandbox.lessonVideoData = (course, index, mode) => ({
    ...sandbox.window.CodaLessonVideos.get(course.id, index, mode), kind: "youtube", courseId: course.id, lessonIndex: index,
    minutes: 7, note: "Assista", url: "https://www.youtube.com/watch?v=UB1O30fR-EE"
  });
  sandbox.visibleVideos = () => catalog.map((item, index) => ({ ...item, index, course: sandbox.courseById(item.courseId), ...sandbox.lessonVideoData(sandbox.courseById(item.courseId), item.lessonIndex, sandbox.state.videoLength) }));
  runInNewContext(embed + render, sandbox);
  sandbox.renderVideos();
  return { get, queue, sandbox, events };
}

test("abrir a lista não inicia vídeo; o botão central solicita reprodução", () => {
  const { get, events } = player();
  assert.equal(get("#videoFrame").src, undefined);
  get("#loadVideo").onclick();
  const url = new URL(get("#videoFrame").src);
  assert.equal(url.searchParams.get("autoplay"), "1");
  assert.equal(url.searchParams.get("end"), "400");
  assert.equal(url.searchParams.get("playsinline"), "1");
  assert.equal(get("#videoPlaceholder").hidden, true);
  assert.equal(events.length, 1);
  assert.match(get(".player-frame").markup, /allow="[^"]*autoplay[^"]*encrypted-media/);
  assert.match(get(".player-frame").markup, /referrerpolicy="strict-origin-when-cross-origin"/);
});

test("um clique no ▶ da fila carrega o trecho escolhido e substitui o vídeo anterior", () => {
  const { get, queue, events } = player();
  const originalFrame = get("#videoFrame");
  queue[1].click();
  assert.notEqual(get("#videoFrame"), originalFrame);
  let url = new URL(get("#videoFrame").src);
  assert.equal(url.searchParams.get("start"), "420");
  assert.equal(url.searchParams.get("end"), "820");
  assert.equal(url.searchParams.get("autoplay"), "1");
  queue[2].click();
  url = new URL(get("#videoFrame").src);
  assert.equal(url.pathname, "/embed/1PnVor36_40");
  assert.equal(url.searchParams.get("end"), "140");
  assert.equal(events.at(-1).data.courseId, "css");
  assert.equal(events.length, 2);
});

test("recarregar mantém o trecho e oferece a alternativa externa", () => {
  const { get, queue } = player();
  queue[1].click();
  assert.equal(get("#retryVideo").hidden, false);
  assert.equal(get("#videoPlaybackHelp").hidden, false);
  const iframe = get("#videoFrame"), previous = iframe.src;
  get("#retryVideo").onclick();
  assert.equal(iframe.src, previous);
  assert.equal(iframe.navigations.length, 2);
  assert.match(get("#playerInfo").markup, /Abrir trecho no YouTube/);
});

test("as 98 aulas conservam seus recortes; modo completo começa do início sem fim imposto", () => {
  const sandbox = { window: {} };
  runInNewContext(sources, sandbox);
  const catalog = sandbox.window.CodaLessonVideos;
  for (const [courseId, source] of Object.entries(catalog.sourceByCourse)) {
    for (let lesson = 0; lesson < 7; lesson++) {
      const short = catalog.get(courseId, lesson, "short"), full = catalog.get(courseId, lesson, "full");
      assert.equal(short.start, lesson * source.step);
      assert.ok(short.end > short.start);
      assert.equal(full.start, 0);
      assert.equal(full.end, null);
      assert.equal(full.id, short.id);
    }
  }
});

test("sincronização do conteúdo mantém o player em reprodução", () => {
  const { get, queue, sandbox } = player();
  queue[1].click();
  const playing = get("#videoFrame");
  sandbox.renderVideos({preservePlayback:true});
  assert.equal(get("#videoFrame"), playing);
  assert.equal(playing.navigations.length, 1);
});
