/* ClassMix app logic. Everything runs in the browser; student data never leaves the computer. */
const $ = id => document.getElementById(id);
let rows = [], headers = [], fileName = "", students = [], classNames = [], teachers = [], rooms = [], sizes = [];
let rules = [], locks = {}, markWeights = {}, borderline = {list:[], cut:null}, unmatchedFriends = [];

const COLS = ["colName","colId","colGender","colSupport","colBehav","colLastT","colFriends"];
const PRI = [["wMarks","Marks",3],["wGender","Gender",3],["wSupport","Support needs",3],["wBehav","Behaviour",3],["wFriends","Friend requests",3],["wTeacher","Avoid last year's teacher",3]];
const LEVELS = ["Off","Low","Some","Medium","High","Highest"];
const LOCK_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';

/* ---------- small helpers ---------- */
const esc = t => String(t ?? "").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm = t => String(t ?? "").trim().toLowerCase().replace(/\s+/g," ");
const avg = list => { const m = list.filter(s=>s.mark!=null); return m.length ? m.reduce((t,s)=>t+s.mark,0)/m.length : 0; };
const fmt = m => m==null ? "–" : String(Math.round(m*10)/10);
const plural = (n, one, many) => `${n} ${n===1 ? one : (many || one+"s")}`;
const byMark = (a,b) => (b.mark ?? -1)-(a.mark ?? -1) || a.name.localeCompare(b.name);
const yes = v => { const t = norm(v); return t !== "" && !["no","n","0","false","none","-","nil","n/a"].includes(t); };
const noteOf = (v, fallback) => /^(yes|y|true|1|x)$/i.test(String(v).trim()) ? fallback : String(v).trim();
const surname = n => { const p = n.trim().split(/\s+/); return (p.length>1 ? p[p.length-1]+" "+p.slice(0,-1).join(" ") : n).toLowerCase(); };
const label = s => `${s.name}${s.id?" · "+s.id:""}`;
const byRef = () => Object.fromEntries(students.map(s=>[s.ref,s]));
const sameTeacher = s => s.lastTeacher && teachers[s.cls] && norm(teachers[s.cls]) === norm(s.lastTeacher);
const lonely = s => s.friends.length && !s.friends.some(f=>f.cls===s.cls);
function breakdown(L, flag, note){
  const t = {}; L.filter(s=>s[flag]).forEach(s=>t[s[note]]=(t[s[note]]||0)+1);
  const parts = Object.entries(t).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`);
  return parts.length ? parts.join(", ") : "None";
}
const nameList = (L, fn, max=6) => esc(L.slice(0,max).map(fn).join(", ")) + (L.length>max ? ` and ${L.length-max} more` : "");
let tt; function toast(m){ const t=$("toast"); t.textContent=m; t.hidden=false; clearTimeout(tt); tt=setTimeout(()=>t.hidden=true,2800); }
function markStale(){ $("stale").hidden = false; }

/* ---------- settings ---------- */
const num = (id, d) => { const v = parseInt($(id).value); return isNaN(v) ? d : v; };
function cfg(){
  const k = Math.min(20, Math.max(2, num("nClasses",4)));
  const size = Math.max(1, num("size",25));
  const streamed = Math.min(k-1, Math.max(0, num("streamed",1)));
  const cut = parseFloat($("cutoff").value);
  return { k, size, streamed, cutoff: isNaN(cut) ? null : cut,
    caps: Array.from({length:k},(_,c)=> sizes[c] > 0 ? sizes[c] : size),
    w: Object.fromEntries(PRI.map(([id])=>[id, +$(id).value])) };
}
function syncClassArrays(k){
  classNames = Array.from({length:k},(_,i)=> classNames[i] || `Class ${i+1}`);
  teachers = Array.from({length:k},(_,i)=> teachers[i] || "");
  rooms = Array.from({length:k},(_,i)=> rooms[i] || "");
  sizes = Array.from({length:k},(_,i)=> sizes[i] || 0);
}

/* ---------- example data ---------- */
function exampleData(){
  let s = 7; const rnd = () => (s = (s*9301+49297)%233280)/233280;
  const pick = a => a[Math.floor(rnd()*a.length)];
  const girls = ["Ava","Chloe","Zoe","Mia","Isla","Ruby","Grace","Sophie","Ella","Lily","Amelia","Harper","Evie","Leila","Mei"];
  const boys = ["Liam","Noah","Lucas","Ethan","Leo","Jack","Oliver","Max","Hugo","Sam","Kai","Theo","Arjun","Nikos","Omar"];
  const last = ["Nguyen","Smith","Papadopoulos","Chen","Wilson","Kaur","Brown","Rossi","Taylor","Kim","Martin","Ali","Walker","Singh","Lee","Hall","Young","Patel","Haddad","Wong"];
  const prevT = ["Ms Chen","Mr Rossi","Mrs Haddad","Mr Walker","Ms Patel","Mr Kim"];
  const used = new Set(), out = [];
  for(let i=0;i<100;i++){
    const g = rnd()<0.5 ? "F" : "M"; let n;
    do { n = pick(g==="F"?girls:boys)+" "+pick(last); } while(used.has(n)); used.add(n);
    const base = 68 + (rnd()+rnd()+rnd()-1.5)*30;
    const clamp = v => Math.round(Math.min(99, Math.max(25, v)));
    const sv = rnd(), bv = rnd();
    out.push({"Student ID":"S"+(24001+i), "Name":n, "Gender":g,
      "Maths":clamp(base+(rnd()-.5)*16-4), "English":clamp(base+(rnd()-.5)*16+3),
      "Support needs": sv<0.05?"Yes":sv<0.09?"Reading support":sv<0.12?"EAL/D":"",
      "Behaviour": bv<0.05?"Behaviour plan":bv<0.08?"Yes":"",
      "Last year's teacher": pick(prevT), "Friends":""});
  }
  const names = out.map(r=>r.Name);
  out.forEach(r=>{ if(rnd()<0.6){ const f = new Set(); while(f.size<2){ const o = pick(names); if(o!==r.Name) f.add(o); } r.Friends = [...f].join(", "); } });
  return out;
}

/* ---------- columns and ranking ---------- */
function fillSelect(sel, opts, pick, allowNone){
  sel.innerHTML = "";
  if(allowNone){ const o=document.createElement("option"); o.value=""; o.textContent="(none)"; sel.appendChild(o); }
  opts.forEach(v=>{ const o=document.createElement("option"); o.value=v; o.textContent=v; sel.appendChild(o); });
  sel.value = pick ?? "";
}
const guess = (re, fb, not) => headers.find(h=>re.test(h) && !(not && not.test(h))) ?? fb;
function numericCols(){
  return headers.filter(h=>{ const v = rows.map(r=>r[h]).filter(x=>x!==""&&x!=null); return v.length && v.every(x=>!isNaN(parseFloat(x)) && isFinite(x)); });
}
function setupColumns(){
  fillSelect($("colName"), headers, guess(/name/i, headers[0], /teacher|friend/i));
  fillSelect($("colId"), headers, guess(/\bid\b|number|no\./i, ""), true);
  fillSelect($("colGender"), headers, guess(/gender|sex/i, ""), true);
  fillSelect($("colSupport"), headers, guess(/support|need|learning|eal|iep|adjust/i, ""), true);
  fillSelect($("colBehav"), headers, guess(/behav|conduct/i, ""), true);
  fillSelect($("colLastT"), headers, guess(/teacher/i, ""), true);
  fillSelect($("colFriends"), headers, guess(/friend/i, ""), true);
  const nums = numericCols();
  const overall = nums.find(h=>/average|avg|overall|total|mark|score|result|%/i.test(h));
  markWeights = Object.fromEntries(nums.map(h=>[h, overall ? (h===overall?1:0) : 1]));
  renderWeights();
}
function renderWeights(){
  const idCol = $("colId").value, cols = Object.keys(markWeights).filter(h=>h!==idCol);
  $("weights").innerHTML = cols.length ? cols.map((h,i)=>`<label><span>${esc(h)}</span><input type="number" id="mw${i}" data-h="${esc(h)}" min="0" max="10" step="0.5" value="${markWeights[h]}"></label>`).join("")
    : `<div class="note">No number columns found. Check your file has marks as numbers.</div>`;
  $("weights").querySelectorAll("input").forEach(inp=>inp.addEventListener("input",()=>{ markWeights[inp.dataset.h] = Math.max(0, parseFloat(inp.value)||0); renderFormula(); markStale(); }));
  renderFormula();
}
function activeWeights(){ const idCol = $("colId").value; return Object.entries(markWeights).filter(([h,w])=>w>0 && h!==idCol && headers.includes(h)); }
function renderFormula(){
  const a = activeWeights(), tot = a.reduce((t,[,w])=>t+w,0);
  $("formula").className = "formula" + (a.length ? "" : " bad");
  $("formula").innerHTML = a.length ? `Score = ${a.map(([h,w])=>`${Math.round(w/tot*100)}% ${esc(h)}`).join(" + ")}` : "Give at least one column a weight above 0.";
}
function renderPriorities(){
  $("pri").innerHTML = PRI.map(([id,name,d])=>`<label id="${id}L"><span>${name}</span><output id="${id}O">${LEVELS[d]}</output><input type="range" id="${id}" min="0" max="5" step="1" value="${d}" aria-label="${name} priority"></label>`).join("");
  PRI.forEach(([id])=>{ $(id).addEventListener("input",()=>{ showLevel(id); markStale(); }); showLevel(id); });
}
function showLevel(id){ $(id+"O").textContent = LEVELS[+$(id).value]; $(id+"L").classList.toggle("off", +$(id).value===0); }

/* ---------- students ---------- */
function buildStudents(){
  const C = Object.fromEntries(COLS.map(id=>[id,$(id).value]));
  const act = activeWeights(), comparable = $("comparable").checked;
  const pct = {};
  if(comparable) act.forEach(([h])=>{
    const vals = rows.map(r=>parseFloat(r[h])).filter(v=>!isNaN(v));
    pct[h] = v => { if(vals.length<2) return 50; let lo=0, le=0; for(const x of vals){ if(x<v) lo++; if(x<=v) le++; } return ((lo+le-1)/2)/(vals.length-1)*100; };
  });
  const list = [];
  rows.forEach((r,i)=>{
    const name = String(r[C.colName] ?? "").trim(); if(!name) return;
    let tw = 0, ts = 0;
    act.forEach(([h,w])=>{ const v = parseFloat(r[h]); if(isNaN(v)) return; ts += w*(comparable ? pct[h](v) : v); tw += w; });
    const score = tw ? ts/tw : null;
    const id = C.colId ? String(r[C.colId] ?? "").trim() : "";
    const sup = C.colSupport ? r[C.colSupport] : "", beh = C.colBehav ? r[C.colBehav] : "";
    list.push({key:i, ref:id||name, name, id,
      gender: C.colGender ? String(r[C.colGender] ?? "").trim().toUpperCase() : "",
      support: yes(sup), supportNote: yes(sup) ? noteOf(sup,"Support") : "",
      behaviour: yes(beh), behaviourNote: yes(beh) ? noteOf(beh,"Behaviour") : "",
      lastTeacher: C.colLastT ? String(r[C.colLastT] ?? "").trim() : "",
      friendsRaw: C.colFriends ? String(r[C.colFriends] ?? "").split(/[,;\/\n]+|\s+&\s+|\s+and\s+/i).map(t=>t.trim()).filter(Boolean) : [],
      mark: score, noMark: score==null, cls: -1, locked: false});
  });
  unmatchedFriends = [];
  const idx = {}; list.forEach(s=>{ idx[norm(s.name)] = s; if(s.id) idx[norm(s.id)] = s; });
  list.forEach(s=>{ s.friends = [];
    s.friendsRaw.forEach(t=>{ const f = idx[norm(t)]; if(!f) unmatchedFriends.push(`${t} (for ${s.name})`); else if(f!==s && !s.friends.includes(f)) s.friends.push(f); }); });
  return list;
}
function resolveRef(v){
  const t = norm(v); if(!t) return "";
  const s = students.find(x=>x.id && norm(x.id)===t) || students.find(x=>norm(x.name)===t);
  return s ? s.ref : String(v).trim();
}

/* ---------- assignment ---------- */
function rng(seed){ return ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function assign(){
  const {k, streamed:start, caps, cutoff} = cfg(), mixed = k - start;
  syncClassArrays(k);
  students = buildStudents();
  students.forEach(s=>{ if(locks[s.ref] !== undefined && locks[s.ref] < k){ s.locked = true; s.cls = locks[s.ref]; } });
  students.sort(byMark);
  let free = students.filter(s=>!s.locked && !s.noMark);
  const noMark = students.filter(s=>!s.locked && s.noMark);
  // streamed classes, highest marks first
  for(let c=0;c<start;c++){
    const room = Math.max(0, caps[c] - students.filter(s=>s.locked && s.cls===c).length);
    const take = free.filter(s=>cutoff==null || s.mark>=cutoff).slice(0, room);
    take.forEach(s=>s.cls=c); free = free.filter(s=>s.cls<0);
  }
  borderline = {list:[], cut:null};
  if(start>0){
    const inLast = students.filter(s=>s.cls===start-1 && !s.locked && !s.noMark);
    if(inLast.length){ const cut = Math.min(...inLast.map(s=>s.mark)); borderline = {cut, list: free.filter(s=>s.mark>=cut-2)}; }
  }
  // snake draft the rest, then improve with swaps
  let dir = 1, pos = 0;
  free.forEach(s=>{ s.cls = start+pos; pos+=dir; if(pos===mixed||pos<0){ dir=-dir; pos+=dir; } });
  noMark.forEach(s=>{
    const fill = Array.from({length:mixed},(_,i)=>students.filter(x=>x.cls===start+i).length / caps[start+i]);
    s.cls = start + fill.indexOf(Math.min(...fill));
  });
  optimise(start, mixed);
  $("stale").hidden = true;
  render();
}

// score a placement of the mixed classes: lower is better
function makeCost(start, mixed){
  const {caps, w} = cfg();
  const pool = students.filter(s=>s.cls>=start);
  const capSum = caps.slice(start).reduce((a,b)=>a+b,0);
  const T = caps.slice(start).map(c=>pool.length*c/capSum);
  const overall = avg(pool);
  const gVals = [...new Set(pool.map(s=>s.gender).filter(Boolean))];
  const gShare = gVals.map(g=>pool.filter(s=>s.gender===g).length/pool.length);
  const sShare = pool.filter(s=>s.support).length/pool.length, bShare = pool.filter(s=>s.behaviour).length/pool.length;
  const fr = pool.filter(s=>s.friends.length), lt = pool.filter(s=>s.lastTeacher);
  const tn = teachers.map(norm), ltn = new Map(lt.map(s=>[s, norm(s.lastTeacher)]));
  const map = byRef(), rel = rules.map(r=>[r.type, map[r.a], map[r.b]]).filter(([,a,b])=>a&&b);
  const W = {m:2*w.wMarks/3, g:6*w.wGender/3, s:25*w.wSupport/3, b:25*w.wBehav/3, f:300*w.wFriends/3, t:300*w.wTeacher/3};
  return () => {
    const n = Array(mixed).fill(0), sum = Array(mixed).fill(0), mk = Array(mixed).fill(0), sup = Array(mixed).fill(0), beh = Array(mixed).fill(0);
    const g = gVals.map(()=>Array(mixed).fill(0));
    for(const s of pool){ const c = s.cls-start; n[c]++; if(s.mark!=null){ sum[c]+=s.mark; mk[c]++; } if(s.support) sup[c]++; if(s.behaviour) beh[c]++; if(W.g){ const gi = gVals.indexOf(s.gender); if(gi>=0) g[gi][c]++; } }
    let cost = 0;
    for(let c=0;c<mixed;c++){
      const cap = caps[start+c];
      cost += 300*(n[c]-T[c])**2 + (n[c]>cap ? 2000*(n[c]-cap)**2 : 0);
      if(W.m && mk[c]) cost += W.m*(sum[c]/mk[c]-overall)**2;
      if(W.s) cost += W.s*(sup[c]-n[c]*sShare)**2;
      if(W.b) cost += W.b*(beh[c]-n[c]*bShare)**2;
      if(W.g) for(let gi=0; gi<gVals.length; gi++) cost += W.g*(g[gi][c]-n[c]*gShare[gi])**2;
    }
    if(W.f) for(const s of fr){ if(!s.friends.some(f=>f.cls===s.cls)) cost += W.f; }
    if(W.t) for(const s of lt){ if(tn[s.cls] && tn[s.cls]===ltn.get(s)) cost += W.t; }
    for(const [t,a,b] of rel){ if((t==="apart") === (a.cls===b.cls)) cost += 5000; }
    return cost;
  };
}
function optimise(start, mixed){
  if(mixed < 2) return;
  const movable = students.filter(s=>s.cls>=start && !s.locked);
  if(movable.length < 2) return;
  const cost = makeCost(start, mixed), r = rng(12345);
  let best = cost();
  for(let it=0; it<30000; it++){
    const a = movable[Math.floor(r()*movable.length)];
    if(r() < 0.25){
      const old = a.cls, to = start + Math.floor(r()*mixed); if(to===old) continue;
      a.cls = to; const c = cost(); if(c < best) best = c; else a.cls = old;
    } else {
      const b = movable[Math.floor(r()*movable.length)]; if(a.cls===b.cls) continue;
      [a.cls,b.cls] = [b.cls,a.cls]; const c = cost(); if(c < best) best = c; else [a.cls,b.cls] = [b.cls,a.cls];
    }
  }
}

/* ---------- checks ---------- */
function ruleStatus(){
  const map = byRef();
  return rules.map(r=>{
    const a = map[r.a], b = map[r.b];
    if(!a || !b) return {r, a, b, state:"missing"};
    return {r, a, b, state: (r.type==="apart" ? a.cls!==b.cls : a.cls===b.cls) ? "ok" : "broken"};
  });
}
function renderChecks(){
  const {caps, streamed:start, w} = cfg(), items = [];
  classNames.forEach((n,c)=>{ const cnt = students.filter(s=>s.cls===c).length; if(cnt>caps[c]) items.push(["bad",`${esc(n)} has ${cnt} students, over its limit of ${caps[c]}.`]); });
  const total = caps.reduce((a,b)=>a+b,0);
  if(students.length > total) items.push(["bad",`${students.length} students but only ${total} places across ${classNames.length} classes.`]);
  ruleStatus().forEach(({r,a,b,state})=>{
    if(state==="missing") items.push(["bad",`Rule can't be checked: ${esc(!a?r.a:r.b)} isn't in the student list.`]);
    else if(state==="broken"){
      const inTop = a.cls<start || b.cls<start;
      const why = !inTop ? "" : r.type==="apart"
        ? " Both earned a streamed class on marks. To separate them, use the dropdown to move one to another class (this locks them there)."
        : " Only one earned a streamed class on marks. To keep them together, use the dropdown to move one so they share a class (this locks them there).";
      items.push(["bad", r.type==="apart"
        ? `Keep apart: <strong>${esc(a.name)}</strong> and <strong>${esc(b.name)}</strong> are both in ${esc(classNames[a.cls])}.${why}`
        : `Keep together: <strong>${esc(a.name)}</strong> is in ${esc(classNames[a.cls])} but <strong>${esc(b.name)}</strong> is in ${esc(classNames[b.cls])}.${why}`]);
    }
  });
  const rep = students.filter(sameTeacher), repFixed = rep.filter(s=>s.cls<start || s.locked), repFree = rep.filter(s=>!(s.cls<start || s.locked));
  if(repFree.length) items.push(["bad", `${plural(repFree.length,"student has","students have")} the same teacher as last year: ${nameList(repFree, s=>`${s.name} (${teachers[s.cls]})`)}. ${w.wTeacher===0?"“Avoid last year's teacher” is turned off.":"This clashed with other goals; raise “Avoid last year's teacher” or move them by hand."}`]);
  if(repFixed.length) items.push(["info", `${plural(repFixed.length,"student")} in a streamed class or locked in place will have last year's teacher again: ${nameList(repFixed, s=>`${s.name} (${teachers[s.cls]})`)}. ClassMix won't move these; change the teacher or move them by hand if needed.`]);
  if(w.wTeacher>0 && students.some(s=>s.lastTeacher) && !teachers.some(Boolean)) items.push(["info","Add teachers in the Summary, then click Assign, so nobody gets last year's teacher again."]);
  const alone = students.filter(s=>s.cls>=start && lonely(s));
  const cant = alone.filter(s=>s.friends.every(f=>f.cls<start)), could = alone.filter(s=>!cant.includes(s));
  if(could.length) items.push(["bad", `${plural(could.length,"student didn't","students didn't")} get any requested friend: ${nameList(could, s=>s.name)}. ${w.wFriends===0?"“Friend requests” is turned off.":"This clashed with other goals; raise “Friend requests” or move them by hand."}`]);
  if(cant.length) items.push(["info", `${plural(cant.length,"student")} only asked for friends who are in a streamed class, so they can't be placed together: ${nameList(cant, s=>s.name)}.`]);
  if(unmatchedFriends.length) items.push(["info", `Couldn't match ${plural(unmatchedFriends.length,"friend name")} to a student: ${nameList(unmatchedFriends, s=>s)}. Check the spelling or use student IDs.`]);
  const nm = students.filter(s=>s.noMark);
  if(nm.length) items.push(["info",`${plural(nm.length,"student has","students have")} no score, so ${nm.length===1?"was":"were"} placed in the emptiest class for you to check: ${nameList(nm, s=>`${s.name} (${classNames[s.cls]})`)}.`]);
  if(borderline.list.length) items.push(["info",`Just missed a streamed class (the lowest score that got in was ${fmt(borderline.cut)}): ${nameList(borderline.list, s=>`${s.name} ${fmt(s.mark)}`, 8)}. Move anyone you want to promote.`]);
  if(!items.some(i=>i[0]==="bad")) items.unshift(["ok", `All good. ${rules.length ? `${rules.length===1?"The rule is":`All ${rules.length} rules are`} met and e` : "E"}very class is within its size limit.`]);
  $("checks").innerHTML = items.map(([t,m])=>`<li class="${t==="bad"?"":t}">${m}</li>`).join("");
}

/* ---------- rules UI ---------- */
function renderRuleList(){
  $("studentList").innerHTML = students.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(s=>`<option value="${esc(label(s))}"></option>`).join("");
  const st = ruleStatus();
  $("rules").innerHTML = st.length ? st.map(({r,a,b,state},i)=>`<li>
    <span class="tag ${r.type}">${r.type==="apart"?"Apart":"Together"}</span>
    <span class="who">${esc(a?a.name:r.a)} &amp; ${esc(b?b.name:r.b)}</span>
    <span class="actions" style="gap:4px"><span class="state ${state==="ok"?"ok":"bad"}">${state==="ok"?"Met":state==="missing"?"Not found":"Broken"}</span><button class="x" type="button" data-i="${i}" aria-label="Remove rule">&times;</button></span></li>`).join("")
    : `<li style="grid-template-columns:1fr"><span class="note">No rules yet. Add a pair above, or include a “Rules” sheet in your file.</span></li>`;
  $("rules").querySelectorAll(".x").forEach(b=>b.addEventListener("click",()=>{ rules.splice(+b.dataset.i,1); assign(); toast("Rule removed and classes updated"); }));
}
function findByLabel(v){ const t = norm(v); return students.find(s=>norm(label(s))===t) || students.find(s=>norm(s.name)===t) || students.find(s=>s.id && norm(s.id)===t); }
$("ruleForm").addEventListener("submit", e=>{
  e.preventDefault();
  const a = findByLabel($("ruleA").value), b = findByLabel($("ruleB").value), type = $("ruleType").value;
  if(!a || !b) return toast("Pick both students from the list");
  if(a===b) return toast("Choose two different students");
  if(rules.some(r=>(r.a===a.ref&&r.b===b.ref)||(r.a===b.ref&&r.b===a.ref))) return toast("There's already a rule for these two");
  rules.push({type, a:a.ref, b:b.ref});
  $("ruleA").value = $("ruleB").value = "";
  assign(); toast("Rule added and classes updated");
});

/* ---------- render ---------- */
function render(){
  const {streamed:start, size} = cfg();
  const hasG = students.some(s=>s.gender), hasS = !!$("colSupport").value, hasB = !!$("colBehav").value;
  const gVals = [...new Set(students.map(s=>s.gender).filter(Boolean))].sort();
  let h = `<thead><tr><th>Class</th><th>Teacher</th><th>Room</th><th>Size limit</th><th>Students</th><th>Average</th><th>Lowest</th><th>Highest</th>${hasG?"<th>Gender</th>":""}${hasS?"<th>Support</th>":""}${hasB?"<th>Behaviour</th>":""}<th>Locked</th></tr></thead><tbody>`;
  classNames.forEach((n,c)=>{
    const L = students.filter(s=>s.cls===c), ms = L.map(s=>s.mark).filter(m=>m!=null), cap = sizes[c]>0 ? sizes[c] : size;
    h += `<tr><td><input class="cn" type="text" id="cn${c}" data-c="${c}" data-f="n" value="${esc(n)}" aria-label="Class name">${c<start?'<span class="pill">Top</span>':""}</td>
      <td><input class="tc" type="text" id="tc${c}" data-c="${c}" data-f="t" value="${esc(teachers[c])}" placeholder="Add teacher" aria-label="Teacher for ${esc(n)}"></td>
      <td><input class="rm" type="text" id="rm${c}" data-c="${c}" data-f="r" value="${esc(rooms[c])}" placeholder="Room" aria-label="Room for ${esc(n)}"></td>
      <td><input class="sz" type="number" min="1" max="60" id="sz${c}" data-c="${c}" data-f="s" value="${sizes[c]||""}" placeholder="${size}" aria-label="Size limit for ${esc(n)}"></td>
      <td class="mono ${L.length>cap?"over":""}">${L.length}</td>
      <td class="mono">${ms.length?avg(L).toFixed(1):"–"}</td>
      <td class="mono">${ms.length?fmt(Math.min(...ms)):"–"}</td>
      <td class="mono">${ms.length?fmt(Math.max(...ms)):"–"}</td>
      ${hasG?`<td class="mono">${gVals.map(g=>`${esc(g)} ${L.filter(s=>s.gender===g).length}`).join(" · ")}</td>`:""}
      ${hasS?`<td class="mono" title="${esc(breakdown(L,"support","supportNote"))}">${L.filter(s=>s.support).length}</td>`:""}
      ${hasB?`<td class="mono" title="${esc(breakdown(L,"behaviour","behaviourNote"))}">${L.filter(s=>s.behaviour).length}</td>`:""}
      <td class="mono">${L.filter(s=>s.locked).length}</td></tr>`;
  });
  $("sum").innerHTML = h + "</tbody>";
  $("sum").querySelectorAll("input").forEach(inp=>inp.addEventListener("input",e=>{
    const c = +e.target.dataset.c, f = e.target.dataset.f, v = e.target.value;
    if(f==="n") classNames[c] = v || `Class ${c+1}`;
    if(f==="t"){ teachers[c] = v; if(students.some(s=>s.lastTeacher)) markStale(); }
    if(f==="r") rooms[c] = v;
    if(f==="s"){ sizes[c] = Math.max(0, parseInt(v)||0); markStale(); }
    renderCards(); renderChecks(); if(f==="n") renderRuleList();
  }));
  renderCards(); renderChecks(); renderRuleList();
}
function renderCards(){
  const {streamed:start, caps} = cfg(), q = norm($("search").value);
  const hasS = !!$("colSupport").value, hasB = !!$("colBehav").value;
  const flag = new Set(); ruleStatus().forEach(({a,b,state})=>{ if(state==="broken"){ flag.add(a.ref); flag.add(b.ref); } });
  students.forEach(s=>{ if(sameTeacher(s) || (s.cls>=start && lonely(s))) flag.add(s.ref); });
  const opts = classNames.map((n,i)=>`<option value="${i}">${esc(n)}</option>`).join("");
  $("classes").innerHTML = classNames.map((n,c)=>{
    const L = students.filter(s=>s.cls===c).sort(byMark), tr = [teachers[c], rooms[c]].filter(Boolean).join(" · ");
    return `<article class="cls ${c<start?"top":""}"><header><h2>${esc(n)}${tr?`<small>${esc(tr)}</small>`:""}</h2>
      <span class="meta"><span class="mono">${L.length}/${caps[c]} · avg ${L.length?avg(L).toFixed(1):"–"}</span>${hasS?`<span class="supc" title="Support needs: ${esc(breakdown(L,"support","supportNote"))}">S ${L.filter(s=>s.support).length}</span>`:""}${hasB?`<span class="supc b" title="Behaviour: ${esc(breakdown(L,"behaviour","behaviourNote"))}">B ${L.filter(s=>s.behaviour).length}</span>`:""}</span></header>
    <ol>${L.map(s=>{
      const why = [sameTeacher(s)?`Same teacher as last year (${s.lastTeacher})`:"", s.cls>=start&&lonely(s)?"No requested friend in this class":""].filter(Boolean).join(". ");
      return `<li class="${flag.has(s.ref)?"broken":""} ${q&&norm(s.name).includes(q)?"hit":""}" ${why?`title="${esc(why)}"`:""}>
      <button class="lock" type="button" data-k="${s.key}" aria-pressed="${s.locked}" aria-label="${s.locked?"Unlock":"Lock"} ${esc(s.name)}" title="${s.locked?"Locked: stays here when you re-run":"Lock in this class"}">${LOCK_SVG}</button>
      <span class="nm" title="${esc(label(s))}">${esc(s.name)}${s.support?`<span class="sup" title="${esc(s.supportNote)}">S</span>`:""}${s.behaviour?`<span class="sup b" title="${esc(s.behaviourNote)}">B</span>`:""}</span><span class="mono" ${s.noMark?'title="No score"':""}>${fmt(s.mark)}</span>
      <select data-k="${s.key}" aria-label="Move ${esc(s.name)}">${opts.replace(`value="${c}"`,`value="${c}" selected`)}</select></li>`; }).join("")}</ol></article>`;
  }).join("");
  $("classes").querySelectorAll("select").forEach(sel=>sel.addEventListener("change",e=>{
    const s = students.find(x=>x.key===+e.target.dataset.k); s.cls = +e.target.value; s.locked = true; locks[s.ref] = s.cls;
    toast(`Moved ${s.name} to ${classNames[s.cls]} and locked them`); render();
  }));
  $("classes").querySelectorAll(".lock").forEach(btn=>btn.addEventListener("click",()=>{
    const s = students.find(x=>x.key===+btn.dataset.k); s.locked = !s.locked;
    if(s.locked) locks[s.ref] = s.cls; else delete locks[s.ref];
    toast(s.locked ? `${s.name} locked in ${classNames[s.cls]}` : `${s.name} unlocked`); render();
  }));
  if(q) document.querySelector(".cls li.hit")?.scrollIntoView({block:"nearest"});
}

/* ---------- loading a student file ---------- */
function readSheets(wb){
  const SPECIAL = /^\s*(rules|classes|teachers|instructions|read ?me|test notes)\s*$/i;
  const mainName = wb.SheetNames.find(n=>!SPECIAL.test(n)) || wb.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(wb.Sheets[mainName], {defval:""});
  if(!data.length) throw new Error("empty");
  rows = data; headers = Object.keys(data[0]); locks = {}; rules = []; classNames = []; teachers = []; rooms = []; sizes = [];
  const clsName = wb.SheetNames.find(n=>/^\s*(classes|teachers)\s*$/i.test(n));
  let nCls = 0;
  if(clsName){
    XLSX.utils.sheet_to_json(wb.Sheets[clsName], {defval:""}).forEach(r=>{
      const get = re => { const key = Object.keys(r).find(h=>re.test(h)); return key ? String(r[key]).trim() : ""; };
      const cn = get(/class/i), t = get(/teacher/i), rm = get(/room/i), sz = parseInt(get(/size|places|max/i));
      if(!cn && !t && !rm) return;
      classNames[nCls] = cn || `Class ${nCls+1}`; teachers[nCls] = t; rooms[nCls] = rm; sizes[nCls] = sz>0 ? sz : 0; nCls++;
    });
    if(nCls >= 2) $("nClasses").value = nCls;
  }
  setupColumns(); students = buildStudents();
  const rulesName = wb.SheetNames.find(n=>/^\s*rules\s*$/i.test(n));
  let nRules = 0;
  if(rulesName){
    XLSX.utils.sheet_to_json(wb.Sheets[rulesName], {defval:""}).forEach(r=>{
      const vals = Object.values(r).map(v=>String(v).trim());
      const typ = /together/i.test(vals[0]) ? "together" : /apart|separate/i.test(vals[0]) ? "apart" : null;
      if(!typ || !vals[1] || !vals[2]) return;
      rules.push({type:typ, a:resolveRef(vals[1]), b:resolveRef(vals[2])}); nRules++;
    });
  }
  return {mainName, rulesName, nRules, clsName, nCls};
}
$("file").addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return;
  try{
    const info = readSheets(XLSX.read(await f.arrayBuffer(), {type:"array"}));
    fileName = f.name;
    $("banner").innerHTML = `Loaded <strong>${esc(f.name)}</strong>: ${rows.length} students from “${esc(info.mainName)}”${info.rulesName?`, ${plural(info.nRules,"rule")}`:""}${info.clsName?`, ${info.nCls} classes with teachers`:""}. Check the columns and ranking score, then adjust if needed.`;
    $("fileinfo").textContent = `Columns found: ${headers.join(", ")}`;
    assign();
  }catch(err){
    $("banner").innerHTML = `Couldn't read that file. Make sure it's an .xlsx, .xls or .csv with a header row.`;
  }
  e.target.value = "";
});
$("run").addEventListener("click", ()=>{ assign(); toast("Students assigned"); });
$("search").addEventListener("input", renderCards);
document.querySelectorAll(".setup select, .setup input:not([type=file])").forEach(el=>{
  if(el.closest("#weights") || el.closest("#pri")) return;
  el.addEventListener("change", ()=>{ if(el.id==="colId") renderWeights(); markStale(); });
});

/* ---------- saving files ---------- */
async function saveFile(filename, blob){
  if(window.claude && window.claude.use){
    const dl = await window.claude.use("downloads");
    if(!dl) return toast("Saving files isn't available in this view");
    try{ await dl.save({filename, data:blob}); toast(`Saved ${filename}`); }
    catch(err){ if(err?.code!=="declined") toast("Couldn't save the file. Try again in a moment."); }
  } else {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000); toast(`Saved ${filename}`);
  }
}
const saveWorkbook = (wb, filename) => saveFile(filename, new Blob([XLSX.write(wb,{bookType:"xlsx",type:"array"})], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));

$("export").addEventListener("click", ()=>{
  if(!students.length) return toast("Nothing to export yet");
  const {caps} = cfg(), wb = XLSX.utils.book_new();
  const overview = classNames.map((n,c)=>{ const L = students.filter(s=>s.cls===c); return {"Class":n,"Teacher":teachers[c],"Room":rooms[c],"Size limit":caps[c],"Students":L.length,"Average score":+avg(L).toFixed(1),"Need support":L.filter(s=>s.support).length,"Support breakdown":breakdown(L,"support","supportNote"),"Behaviour flags":L.filter(s=>s.behaviour).length}; });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overview), "Classes");
  const all = [...students].sort((a,b)=>a.cls-b.cls || byMark(a,b)).map(s=>({"Class":classNames[s.cls],"Teacher":teachers[s.cls],"Room":rooms[s.cls],"Student ID":s.id,"Name":s.name,"Gender":s.gender,"Score":s.mark==null?"":+fmt(s.mark),
    "Support needs":s.supportNote,"Behaviour":s.behaviourNote,"Last year's teacher":s.lastTeacher,"Same teacher again":sameTeacher(s)?"Yes":"",
    "Friends requested":s.friendsRaw.join(", "),"Friends in class":s.friends.filter(f=>f.cls===s.cls).map(f=>f.name).join(", "),"Locked":s.locked?"Yes":"","Note":s.noMark?"No score: placed in emptiest class":""}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(all), "All students");
  const used = new Set(["All students","Rules","Classes"]);
  classNames.forEach((n,c)=>{
    let nm = n.replace(/[\\\/\?\*\[\]:]/g," ").slice(0,31).trim() || `Class ${c+1}`;
    while(used.has(nm)) nm = nm.slice(0,28)+" "+(c+1); used.add(nm);
    const L = students.filter(s=>s.cls===c).sort((a,b)=>surname(a.name).localeCompare(surname(b.name)));
    const aoa = [[n],["Teacher", teachers[c]],["Room", rooms[c]],["Students", L.length, "Need support", L.filter(s=>s.support).length, "Behaviour flags", L.filter(s=>s.behaviour).length],[],
      ["#","Student ID","Name","Gender","Support needs","Behaviour","Score"], ...L.map((s,i)=>[i+1,s.id,s.name,s.gender,s.supportNote,s.behaviourNote,s.mark==null?"":+fmt(s.mark)])];
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = [{wch:5},{wch:12},{wch:26},{wch:8},{wch:20},{wch:18},{wch:7}];
    XLSX.utils.book_append_sheet(wb, ws, nm);
  });
  const rs = ruleStatus().map(({r,a,b,state})=>({"Rule":r.type==="apart"?"Keep apart":"Keep together","Student 1":a?(a.id||a.name):r.a,"Student 2":b?(b.id||b.name):r.b,"Status":state==="ok"?"Met":state==="missing"?"Not found":"Broken"}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rs.length?rs:[{"Rule":"","Student 1":"","Student 2":""}]), "Rules");
  saveWorkbook(wb, "class-placements.xlsx");
});
$("template").addEventListener("click", ()=>{
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    {"Student ID":"S1001","Name":"Example Student","Gender":"F","Maths":78,"English":84,"Support needs":"Reading support","Behaviour":"","Last year's teacher":"Ms Chen","Friends":"S1002"},
    {"Student ID":"S1002","Name":"Another Student","Gender":"M","Maths":64,"English":59,"Support needs":"","Behaviour":"Behaviour plan","Last year's teacher":"Mr Rossi","Friends":"Example Student, S1003"}]), "Students");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    {"Rule":"Keep apart","Student 1":"S1001","Student 2":"S1002"},
    {"Rule":"Keep together","Student 1":"S1001","Student 2":"S1002"}]), "Rules");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    {"Class":"7 Gold","Teacher":"Ms Chen","Room":"B12","Size":25},{"Class":"7 Blue","Teacher":"Mr Rossi","Room":"B14","Size":25},
    {"Class":"7 Green","Teacher":"Mrs Haddad","Room":"C3","Size":25},{"Class":"7 Red","Teacher":"Mr Walker","Room":"C5","Size":18}]), "Classes");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["How to fill this in"],
    ["Students sheet: one row per student. Name and at least one mark column are required; everything else is optional. Add or rename subject columns freely and choose how they're weighted in the app."],
    ["Support needs: write Yes, or the type of support (e.g. Reading support, EAL/D). Leave blank or write No otherwise. The type appears on the class lists."],
    ["Behaviour: same idea, e.g. Yes or Behaviour plan. These students are spread evenly across the mixed classes."],
    ["Last year's teacher: the app tries not to give students the same teacher again (needs teachers on the Classes sheet or entered in the app)."],
    ["Friends: names or student IDs separated by commas. Each student gets at least one requested friend where possible."],
    ["Rules sheet: Keep apart or Keep together, then two students by ID (or exact name). Delete the example rows."],
    ["Classes sheet (optional): one row per class, streamed classes first. Sets the class names, teachers, rooms, size limits and the number of classes."]]), "Instructions");
  saveWorkbook(wb, "classmix-template.xlsx");
});

/* ---------- drafts ---------- */
$("saveDraft").addEventListener("click", ()=>{
  if(!rows.length) return toast("Nothing to save yet");
  const draft = {app:"ClassMix", version:2, savedAt:new Date().toISOString(), fileName, rows,
    settings:{ cols:Object.fromEntries(COLS.map(id=>[id,$(id).value])), markWeights, comparable:$("comparable").checked,
      nClasses:$("nClasses").value, size:$("size").value, streamed:$("streamed").value, cutoff:$("cutoff").value,
      priorities:Object.fromEntries(PRI.map(([id])=>[id,$(id).value])) },
    classNames, teachers, rooms, sizes, rules, locks, placements:Object.fromEntries(students.map(s=>[s.ref,s.cls])) };
  const d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  saveFile(`classmix-draft-${stamp}.json`, new Blob([JSON.stringify(draft)], {type:"application/json"}));
});
$("draftFile").addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return;
  try{
    const d = JSON.parse(await f.text());
    if(d.app!=="ClassMix" || !Array.isArray(d.rows) || !d.rows.length) throw new Error("not a draft");
    rows = d.rows; headers = Object.keys(rows[0]); fileName = d.fileName || "";
    const S = d.settings || {};
    ["nClasses","size","streamed","cutoff"].forEach(id=>{ if(S[id]!==undefined) $(id).value = S[id]; });
    setupColumns();
    COLS.forEach(id=>{ if(S.cols && S.cols[id]!==undefined) $(id).value = S.cols[id]; });
    if(S.markWeights) markWeights = S.markWeights;
    $("comparable").checked = !!S.comparable; renderWeights();
    PRI.forEach(([id])=>{ if(S.priorities && S.priorities[id]!==undefined){ $(id).value = S.priorities[id]; showLevel(id); } });
    classNames = d.classNames||[]; teachers = d.teachers||[]; rooms = d.rooms||[]; sizes = d.sizes||[]; rules = d.rules||[]; locks = d.locks||{};
    const {k} = cfg(); syncClassArrays(k);
    students = buildStudents();
    const P = d.placements || {};
    if(students.every(s=>Number.isInteger(P[s.ref]) && P[s.ref]>=0 && P[s.ref]<k)){
      students.forEach(s=>{ s.cls = P[s.ref]; s.locked = locks[s.ref]!==undefined; });
      const start = cfg().streamed, inLast = students.filter(s=>s.cls===start-1 && !s.locked && !s.noMark);
      borderline = {list:[], cut:null};
      if(start>0 && inLast.length){ const cut = Math.min(...inLast.map(s=>s.mark)); borderline = {cut, list: students.filter(s=>s.cls>=start && !s.noMark && s.mark>=cut-2).sort(byMark)}; }
      $("stale").hidden = true; render();
    } else assign();
    $("banner").innerHTML = `Opened draft <strong>${esc(f.name)}</strong>${d.savedAt?` saved ${esc(new Date(d.savedAt).toLocaleString())}`:""}: ${rows.length} students, ${plural(rules.length,"rule")}. Everything is as you left it.`;
    $("fileinfo").textContent = `Columns found: ${headers.join(", ")}`;
  }catch(err){
    $("banner").innerHTML = `Couldn't open that file as a ClassMix draft. Choose a .json file saved with “Save draft”.`;
  }
  e.target.value = "";
});

/* ---------- class lists page ---------- */
function renderRosters(){
  const {streamed:start} = cfg();
  const showM = $("showMarks").checked, showI = $("showIds").checked, showS = $("showSupport").checked && !!$("colSupport").value, showB = $("showBehav").checked && !!$("colBehav").value;
  const gVals = [...new Set(students.map(s=>s.gender).filter(Boolean))].sort();
  $("rosters").innerHTML = classNames.map((n,c)=>{
    const L = students.filter(s=>s.cls===c).sort((a,b)=>surname(a.name).localeCompare(surname(b.name)));
    const who = [teachers[c] ? esc(teachers[c]) : `<span class="empty">No teacher yet</span>`, rooms[c] ? `<span>Room</span> ${esc(rooms[c])}` : ""].filter(Boolean).join(" &nbsp;·&nbsp; ");
    return `<article class="roster ${c<start?"top":""}">
      <div><h2 class="cname">${esc(n)}${c<start?'<span class="pill">Top stream</span>':""}</h2><div class="who">${who}</div></div>
      <div class="stats"><span><b>${L.length}</b> students</span>${gVals.map(g=>`<span>${esc(g)} <b>${L.filter(s=>s.gender===g).length}</b></span>`).join("")}${showS?`<span title="${esc(breakdown(L,"support","supportNote"))}"><b>${L.filter(s=>s.support).length}</b> need support</span>`:""}${showB?`<span title="${esc(breakdown(L,"behaviour","behaviourNote"))}"><b>${L.filter(s=>s.behaviour).length}</b> behaviour</span>`:""}${showM?`<span>Average <b>${avg(L).toFixed(1)}</b></span>`:""}</div>
      <ol>${L.map((s,i)=>`<li><span class="i">${i+1}</span><span class="n">${esc(s.name)}${showI&&s.id?`<small>${esc(s.id)}</small>`:""}</span><span class="r">${showS&&s.support?`<span class="chip" title="${esc(s.supportNote)}">${esc(s.supportNote)}</span>`:""}${showB&&s.behaviour?`<span class="chip b" title="${esc(s.behaviourNote)}">${esc(s.behaviourNote)}</span>`:""}${showM?`<span class="mk">${fmt(s.mark)}</span>`:""}</span></li>`).join("") || '<li><span></span><span class="empty">No students</span></li>'}</ol>
    </article>`;
  }).join("");
}
function route(){
  const lists = location.hash === "#lists";
  $("editor").hidden = lists; $("lists").hidden = !lists;
  if(lists){ renderRosters(); window.scrollTo(0,0); }
}
$("viewLists").addEventListener("click", ()=>{ location.hash = "lists"; route(); });
$("backBtn").addEventListener("click", ()=>{ location.hash = ""; route(); });
["showMarks","showIds","showSupport","showBehav"].forEach(id=>$(id).addEventListener("change", renderRosters));
window.addEventListener("hashchange", route);
// printing is blocked inside claude.ai, so only offer it in the standalone app
if(window.claude) $("printBtn").hidden = true;
$("printBtn").addEventListener("click", ()=>window.print());

/* ---------- install as app (offline support) ---------- */
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

/* ---------- start with example data ---------- */
renderPriorities();
rows = exampleData(); headers = Object.keys(rows[0]); fileName = "example"; setupColumns(); students = buildStudents();
teachers = ["Ms Chen","Mr Rossi","Mrs Haddad","Mr Walker"]; rooms = ["B12","B14","C3","C5"];
const ex = [...students].sort(byMark).slice(25);
rules = [{type:"apart", a:ex[0].ref, b:ex[5].ref}, {type:"apart", a:ex[10].ref, b:ex[16].ref}, {type:"together", a:ex[20].ref, b:ex[40].ref}];
assign(); route();
