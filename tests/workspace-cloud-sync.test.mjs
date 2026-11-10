import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceSync } from "../js/workspace-sync.js";

function environment(localUpdatedAt, remote) {
  const values = new Map();
  globalThis.localStorage = { getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,String(value)), removeItem:key=>values.delete(key) };
  globalThis.CustomEvent = class { constructor(type,options){this.type=type;this.detail=options?.detail;} };
  globalThis.document = { documentElement:{dataset:{}}, visibilityState:"visible", addEventListener(){} };
  const saved=[];
  globalThis.CodaAPI = { workspace:async()=>remote, saveWorkspace:async payload=>{saved.push(payload);return {data:payload};} };
  globalThis.window = { addEventListener(){}, dispatchEvent(){}, CodaAPI:globalThis.CodaAPI };
  const state={student:{role:"Aluno",email:"aluno@coda.com"},completed:{"html:0":true},activities:{},lessonChecks:{},adaptiveResults:{},bookmarks:{},notes:{},studyMinutes:{},dailyGoal:30,labCode:{},wiringByProject:{},threeDComponents:[],threeDWires:[]};
  localStorage.setItem("nexo-workspace-updated-at:aluno%40coda.com",localUpdatedAt);
  const sync=createWorkspaceSync({state,courses:[],completedCount:()=>0,saveStudentWorkspaceData:()=>{},syncStudentSnapshot:()=>{},showToast:()=>{}});
  return {state,sync,saved,values};
}

test("avanço offline mais novo é enviado e não sobrescrito pelo servidor",async()=>{
  const env=environment("2026-11-10T12:00:00.000Z",{updatedAt:"2026-11-10T11:00:00.000Z",data:{completed:{"css:0":true}}});
  await env.sync.hydrateServerWorkspace();
  assert.equal(env.state.completed["html:0"],true);
  assert.equal(env.saved.length,1);
  assert.equal(env.saved[0].completed["html:0"],true);
  assert.equal(env.saved[0].sync.schemaVersion,2);
});

test("cópia mais nova do servidor hidrata o computador atual",async()=>{
  const env=environment("2026-11-10T10:00:00.000Z",{updatedAt:"2026-11-10T12:00:00.000Z",data:{completed:{"css:0":true},activities:{},lessonChecks:{},adaptiveResults:{},bookmarks:{},notes:{},studyMinutes:{},dailyGoal:45,labCode:{}}});
  await env.sync.hydrateServerWorkspace();
  assert.equal(env.state.completed["css:0"],true);
  assert.equal(env.state.dailyGoal,45);
  assert.equal(env.saved.length,0);
});
