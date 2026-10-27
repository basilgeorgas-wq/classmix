/* ClassMix app logic. Everything runs in the browser; student data never leaves the computer. */
const $ = id => document.getElementById(id);
let rows = [], headers = [], students = [], classNames = [], rules = [], locks = {}, skipped = [];
const LOCK_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';
const esc = t => String(t ?? "").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const avg = list => { const m = list.filter(s=>s.mark!=null); return m.length ? m.reduce((t,s)=>t+s.mark,0)/m.length : 0; };
const plural = (n, one, many) => `${n} ${n===1 ? one : (many || one+"s")}`;
const byMark = (a,b) => (b.mark ?? -1)-(a.mark ?? -1) || a.name.localeCompare(b.name);
const yes = v => { const t = String(v ?? "").trim().toLowerCase(); return t !== "" && !["no","n","0","false","none","-","nil"].includes(t); };

/* ---------- example data ---------- */
function exampleData(){
  let s = 7; const rnd = () => (s = (s*9301+49297)%233280)/233280;
  const girls = ["Ava","Chloe","Zoe","Mia","Isla","Ruby","Grace","Sophie","Ella","Lily","Amelia","Harper","Evie"];
  const first = [...girls,"Liam","Noah","Lucas","Ethan","Leo","Jack","Oliver","Max","Hugo","Sam","Kai","Theo"];
  const last = ["Nguyen","Smith","Papadopoulos","Chen","Wilson","Kaur","Brown","Rossi","Taylor","Kim","Martin","Ali","Walker","Singh","Lee","Hall","Young","Patel"];
  const out = [];
  for(let i=0;i<100;i++){
    const f = first[Math.floor(rnd()*first.length)];
    const mark = Math.round(Math.min(99, Math.max(28, 68 + (rnd()+rnd()+rnd()-1.5)*34)));
    out.push({"Student ID":"S"+(24001+i),"Name":f+" "+last[Math.floor(rnd()*last.length)],"Gender":girls.includes(f)?"F":"M","Support needs":rnd()<0.13?"Yes":"","2025 Average Mark":mark});
  }
  return out;
}

/* ---------- columns ---------- */
function fillSelect(sel, opts, pick, allowNone){
  sel.innerHTML = "";
  if(allowNone){ const o=document.createElement("option"); o.value=""; o.textContent="(none)"; sel.appendChild(o); }
  opts.forEach(v=>{ const o=document.createElement("option"); o.value=v; o.textContent=v; sel.appendChild(o); });
  sel.value = pick ?? "";
}
const guess = (re, fb) => headers.find(h=>re.test(h)) ?? fb;
function setupColumns(){
  const numeric = headers.filter(h => rows.some(r=>r[h]!==""&&r[h]!=null) && rows.filter(r=>r[h]!==""&&r[h]!=null).every(r=>!isNaN(parseFloat(r[h]))));
  fillSelect($("colName"), headers, guess(/name/i, headers[0]));
  fillSelect($("colMark"), numeric.length?numeric:headers, guess(/mark|score|result|average|avg|total|%/i, numeric[numeric.length-1] ?? headers[0]));
  fillSelect($("colId"), headers, guess(/\bid\b|number|no\./i, ""), true);
  fillSelect($("colGender"), headers, guess(/gender|sex/i, ""), true);
  fillSelect($("colSupport"), headers, guess(/support|need|learning|eal|iep|plan/i, ""), true);
}

/* ---------- students ---------- */
function buildStudents(){
  const nameC=$("colName").value, markC=$("colMark").value, idC=$("colId").value, gC=$("colGender").value, sC=$("colSupport").value;
  skipped = []; const list = [];
  rows.forEach((r,i)=>{
    const name = String(r[nameC] ?? "").trim(); const m = parseFloat(r[markC]);
    if(!name) return;
    const id = idC ? String(r[idC] ?? "").trim() : "";
    list.push({key:i, ref:id||name, name, id, gender:gC?String(r[gC]??"").trim().toUpperCase():"", support:sC?yes(r[sC]):false, mark:isNaN(m)?null:m, noMark:isNaN(m), cls:0});
  });
  return list;
}
const byRef = () => Object.fromEntries(students.map(s=>[s.ref,s]));
function resolveRef(v){
  const t = String(v ?? "").trim(); if(!t) return "";
  const lo = t.toLowerCase();
  const s = students.find(x=>x.id && x.id.toLowerCase()===lo) || students.find(x=>x.name.toLowerCase()===lo);
  return s ? s.ref : t;
}

/* ---------- assignment ---------- */
function rng(seed){ return ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function assign(){
  const k = Math.min(20, Math.max(2, parseInt($("nClasses").value)||4));
  const size = Math.max(1, parseInt($("size").value)||25);
  const topOn = $("topOn").checked, start = topOn ? 1 : 0, mixed = k - start;
  students = buildStudents();
  students.forEach(s=>{ s.locked = locks[s.ref] !== undefined && locks[s.ref] < k; if(s.locked) s.cls = locks[s.ref]; });
  students.sort(byMark);

  let free = students.filter(s=>!s.locked && !s.noMark);
  const noMark = students.filter(s=>!s.locked && s.noMark);
  if(topOn){
    const room = Math.max(0, size - students.filter(s=>s.locked && s.cls===0).length);
    free.slice(0, room).forEach(s=>s.cls=0);
    free = free.slice(room);
  }
  // snake draft the rest, then improve with swaps
  let dir = 1, pos = 0;
  free.forEach(s=>{ s.cls = start+pos; pos+=dir; if(pos===mixed||pos<0){ dir=-dir; pos+=dir; } });
  // students with no mark go into the smallest mixed class
  noMark.forEach(s=>s.cls = -1);
  noMark.forEach(s=>{
    const sizes = Array.from({length:mixed},(_,i)=>students.filter(x=>x.cls===start+i).length);
    s.cls = start + sizes.indexOf(Math.min(...sizes));
  });
  optimise(start, mixed, size);

  classNames = Array.from({length:k},(_,i)=> classNames[i] && !/^Class \d+$/.test(classNames[i]) ? classNames[i] : `Class ${i+1}`);
  render();
}

// score a placement of the mixed classes: lower is better
function makeCost(start, mixed, size){
  const pool = students.filter(s=>s.cls>=start);
  const T = pool.length / mixed, overall = avg(pool), marked = Array(mixed).fill(0);
  const gBal = $("genderBal").checked && pool.some(s=>s.gender), sBal = $("supBal").checked && pool.some(s=>s.support);
  const gVals = [...new Set(pool.map(s=>s.gender).filter(Boolean))];
  const gShare = Object.fromEntries(gVals.map(g=>[g, pool.filter(s=>s.gender===g).length/pool.length]));
  const sShare = pool.filter(s=>s.support).length / pool.length;
  const map = byRef();
  const rel = rules.map(r=>[r.type, map[r.a], map[r.b]]).filter(([,a,b])=>a&&b);
  return () => {
    const n = Array(mixed).fill(0), sum = Array(mixed).fill(0), sup = Array(mixed).fill(0); marked.fill(0);
    const g = gVals.map(()=>Array(mixed).fill(0));
    for(const s of pool){ const c = s.cls-start; n[c]++; if(s.mark!=null){ sum[c]+=s.mark; marked[c]++; } if(s.support) sup[c]++; if(gBal){ const gi=gVals.indexOf(s.gender); if(gi>=0) g[gi][c]++; } }
    let cost = 0;
    for(let c=0;c<mixed;c++){
      cost += 60*(n[c]-T)**2 + (n[c]>size ? 400*(n[c]-size)**2 : 0);
      if(marked[c]) cost += 2*(sum[c]/marked[c]-overall)**2;
      if(sBal) cost += 25*(sup[c]-n[c]*sShare)**2;
      if(gBal) gVals.forEach((gv,gi)=> cost += 6*(g[gi][c]-n[c]*gShare[gv])**2);
    }
    for(const [t,a,b] of rel){ if((t==="apart") === (a.cls===b.cls)) cost += 5000; }
    return cost;
  };
}
function optimise(start, mixed, size){
  if(mixed < 2) return;
  const movable = students.filter(s=>s.cls>=start && !s.locked);
  if(movable.length < 2) return;
  const cost = makeCost(start, mixed, size), r = rng(12345);
  let best = cost();
  for(let it=0; it<25000; it++){
    const a = movable[Math.floor(r()*movable.length)];
    if(r() < 0.3){
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
    const ok = r.type==="apart" ? a.cls!==b.cls : a.cls===b.cls;
    return {r, a, b, state: ok ? "ok" : "broken"};
  });
}
function renderChecks(){
  const size = parseInt($("size").value)||25, topOn = $("topOn").checked;
  const items = [];
  classNames.forEach((n,c)=>{ const cnt = students.filter(s=>s.cls===c).length; if(cnt>size) items.push(["bad",`${n} has ${cnt} students, over the limit of ${size}.`]); });
  const total = classNames.length*size;
  if(students.length > total) items.push(["bad",`${students.length} students but only ${total} places (${classNames.length} × ${size}).`]);
  ruleStatus().forEach(({r,a,b,state})=>{
    if(state==="missing") items.push(["bad",`Rule can't be checked: ${esc(!a?r.a:r.b)} isn't in the student list.`]);
    else if(state==="broken"){
      const inTop = topOn && (a.cls===0 || b.cls===0);
      const why = !inTop ? "" : r.type==="apart"
        ? ` Both earned the top stream on marks. To separate them, use the dropdown to move one to another class (this locks them there).`
        : ` Only one earned the top stream on marks. To keep them together, use the dropdown to move one so they share a class (this locks them there).`;
      items.push(["bad", r.type==="apart"
        ? `Keep apart: <strong>${esc(a.name)}</strong> and <strong>${esc(b.name)}</strong> are both in ${esc(classNames[a.cls])}.${why}`
        : `Keep together: <strong>${esc(a.name)}</strong> is in ${esc(classNames[a.cls])} but <strong>${esc(b.name)}</strong> is in ${esc(classNames[b.cls])}.${why}`]);
    }
  });
  const nm = students.filter(s=>s.noMark);
  if(nm.length) items.push(["info",`${plural(nm.length,"student has","students have")} no mark, so ${nm.length===1?"was":"were"} placed in the smallest class${nm.length===1?"":"es"} for you to check: ${esc(nm.slice(0,6).map(s=>`${s.name} (${classNames[s.cls]})`).join(", "))}${nm.length>6?"…":""}`]);
  if(!items.some(i=>i[0]==="bad")) items.unshift(["ok", `All good. ${rules.length ? `${rules.length===1?"The rule is":`All ${rules.length} rules are`} met, and e` : "E"}very class has ${size} or fewer students.`]);
  $("checks").innerHTML = items.map(([t,m])=>`<li class="${t==="bad"?"":t}">${m}</li>`).join("");
}

/* ---------- rules UI ---------- */
function label(s){ return `${s.name}${s.id?" · "+s.id:""}`; }
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
function findByLabel(v){ const t = v.trim().toLowerCase(); return students.find(s=>label(s).toLowerCase()===t) || students.find(s=>s.name.toLowerCase()===t) || students.find(s=>s.id && s.id.toLowerCase()===t); }
$("ruleForm").addEventListener("submit", e=>{
  e.preventDefault();
  const a = findByLabel($("ruleA").value), b = findByLabel($("ruleB").value), type = $("ruleType").value;
  if(!a || !b) return toast("Pick both students from the list");
  if(a===b) return toast("Choose two different students");
  if(rules.some(r=>(r.a===a.ref&&r.b===b.ref)||(r.a===b.ref&&r.b===a.ref))) return toast("There's already a rule for these two");
  rules.push({type, a:a.ref, b:b.ref});
  $("ruleA").value = $("ruleB").value = "";
  assign(); toast(`Rule added and classes updated`);
});

/* ---------- render ---------- */
function render(){
  const k = classNames.length, size = parseInt($("size").value)||25, topOn = $("topOn").checked;
  const hasG = students.some(s=>s.gender), hasS = !!$("colSupport").value;
  const gVals = [...new Set(students.map(s=>s.gender).filter(Boolean))].sort();
  let h = `<thead><tr><th>Class</th><th>Students</th><th>Average</th><th>Lowest</th><th>Highest</th>${hasG?"<th>Gender</th>":""}${hasS?"<th>Support</th>":""}<th>Locked</th></tr></thead><tbody>`;
  for(let c=0;c<k;c++){
    const L = students.filter(s=>s.cls===c), ms = L.map(s=>s.mark).filter(m=>m!=null);
    h += `<tr><td><input type="text" id="cn${c}" data-c="${c}" value="${esc(classNames[c])}" aria-label="Class name">${c===0&&topOn?'<span class="pill">Top</span>':""}</td>
      <td class="mono ${L.length>size?"over":""}">${L.length}</td>
      <td class="mono">${L.length?avg(L).toFixed(1):"–"}</td>
      <td class="mono">${ms.length?Math.min(...ms):"–"}</td>
      <td class="mono">${ms.length?Math.max(...ms):"–"}</td>
      ${hasG?`<td class="mono">${gVals.map(g=>`${esc(g)} ${L.filter(s=>s.gender===g).length}`).join(" · ")}</td>`:""}
      ${hasS?`<td class="mono">${L.filter(s=>s.support).length}</td>`:""}
      <td class="mono">${L.filter(s=>s.locked).length}</td></tr>`;
  }
  $("sum").innerHTML = h + "</tbody>";
  $("sum").querySelectorAll("input").forEach(inp=>inp.addEventListener("input",e=>{ const c=+e.target.dataset.c; classNames[c]=e.target.value||`Class ${c+1}`; renderCards(); renderChecks(); renderRuleList(); }));
  renderCards(); renderChecks(); renderRuleList();
}
function renderCards(){
  const topOn = $("topOn").checked, q = $("search").value.trim().toLowerCase();
  const broken = new Set(); ruleStatus().forEach(({a,b,state})=>{ if(state==="broken"){ broken.add(a.ref); broken.add(b.ref); } });
  const opts = classNames.map((n,i)=>`<option value="${i}">${esc(n)}</option>`).join("");
  $("classes").innerHTML = classNames.map((n,c)=>{
    const L = students.filter(s=>s.cls===c).sort(byMark);
    return `<article class="cls ${c===0&&topOn?"top":""}"><header><h2>${esc(n)}</h2><span class="meta mono">${L.length} · avg ${L.length?avg(L).toFixed(1):"–"}</span></header>
    <ol>${L.map(s=>`<li class="${broken.has(s.ref)?"broken":""} ${q&&s.name.toLowerCase().includes(q)?"hit":""}">
      <button class="lock" type="button" data-k="${s.key}" aria-pressed="${s.locked}" aria-label="${s.locked?"Unlock":"Lock"} ${esc(s.name)}" title="${s.locked?"Locked: stays here when you re-run":"Lock in this class"}">${LOCK_SVG}</button>
      <span class="nm" title="${esc(label(s))}">${esc(s.name)}${s.support?'<span class="sup" title="Support needs">S</span>':""}</span><span class="mono" ${s.noMark?'title="No mark in the file"':""}>${s.mark ?? "–"}</span>
      <select data-k="${s.key}" aria-label="Move ${esc(s.name)}">${opts.replace(`value="${c}"`,`value="${c}" selected`)}</select></li>`).join("")}</ol></article>`;
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
  if(q){ document.querySelector(".cls li.hit")?.scrollIntoView({block:"nearest"}); }
}
let tt; function toast(m){ const t=$("toast"); t.textContent=m; t.hidden=false; clearTimeout(tt); tt=setTimeout(()=>t.hidden=true,2600); }

/* ---------- file load ---------- */
$("file").addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return;
  try{
    const wb = XLSX.read(await f.arrayBuffer(), {type:"array"});
    const mainName = wb.SheetNames.find(n=>!/rules|instructions|read ?me/i.test(n)) || wb.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(wb.Sheets[mainName], {defval:""});
    if(!data.length) throw new Error("empty");
    rows = data; headers = Object.keys(data[0]); locks = {}; rules = []; classNames = [];
    setupColumns(); students = buildStudents();
    const rulesName = wb.SheetNames.find(n=>/rules/i.test(n));
    let nRules = 0;
    if(rulesName){
      XLSX.utils.sheet_to_json(wb.Sheets[rulesName], {defval:""}).forEach(r=>{
        const vals = Object.values(r).map(v=>String(v).trim());
        const typ = /together/i.test(vals[0]) ? "together" : /apart|separate/i.test(vals[0]) ? "apart" : null;
        if(!typ || !vals[1] || !vals[2]) return;
        rules.push({type:typ, a:resolveRef(vals[1]), b:resolveRef(vals[2])}); nRules++;
      });
    }
    $("banner").innerHTML = `Loaded <strong>${esc(f.name)}</strong>: ${data.length} students from “${esc(mainName)}”${rulesName?` and ${nRules} rule${nRules===1?"":"s"} from “${esc(rulesName)}”`:""}. Check the columns in step 2.`;
    $("fileinfo").textContent = `Columns found: ${headers.join(", ")}`;
    assign();
  }catch(err){
    $("banner").innerHTML = `Couldn't read that file. Make sure it's an .xlsx, .xls or .csv with a header row.`;
  }
  e.target.value = "";
});
$("run").addEventListener("click", ()=>{ assign(); toast("Students assigned"); });
$("search").addEventListener("input", renderCards);

/* ---------- saving files ---------- */
async function saveWorkbook(wb, filename){
  if(window.claude && window.claude.use){
    const dl = await window.claude.use("downloads");
    if(!dl) return toast("Saving files isn't available in this view");
    try{ await dl.save({filename, data:new Blob([XLSX.write(wb,{bookType:"xlsx",type:"array"})])}); toast(`Saved ${filename}`); }
    catch(err){ if(err?.code!=="declined") toast("Couldn't save the file. Try again in a moment."); }
  } else { XLSX.writeFile(wb, filename); toast(`Saved ${filename}`); }
}
$("export").addEventListener("click", ()=>{
  if(!students.length) return toast("Nothing to export yet");
  const wb = XLSX.utils.book_new();
  const all = [...students].sort((a,b)=>a.cls-b.cls || byMark(a,b)).map(s=>({"Class":classNames[s.cls],"Student ID":s.id,"Name":s.name,"Gender":s.gender,"Support needs":s.support?"Yes":"","Mark":s.mark ?? "","Locked":s.locked?"Yes":"","Note":s.noMark?"No mark: placed in smallest class":""}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(all), "All students");
  const used = new Set(["All students","Rules"]);
  classNames.forEach((n,c)=>{
    let nm = n.replace(/[\\\/\?\*\[\]:]/g," ").slice(0,31).trim() || `Class ${c+1}`;
    while(used.has(nm)) nm = nm.slice(0,28)+" "+(c+1); used.add(nm);
    const L = students.filter(s=>s.cls===c).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>({"Student ID":s.id,"Name":s.name,"Gender":s.gender,"Support needs":s.support?"Yes":"","Mark":s.mark ?? ""}));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(L.length?L:[{Name:""}]), nm);
  });
  const rs = ruleStatus().map(({r,a,b,state})=>({"Rule":r.type==="apart"?"Keep apart":"Keep together","Student 1":a?(a.id||a.name):r.a,"Student 2":b?(b.id||b.name):r.b,"Status":state==="ok"?"Met":state==="missing"?"Not found":"Broken"}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rs.length?rs:[{"Rule":"","Student 1":"","Student 2":""}]), "Rules");
  saveWorkbook(wb, "class-placements.xlsx");
});
$("template").addEventListener("click", ()=>{
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    {"Student ID":"S1001","Name":"Example Student","Gender":"F","Support needs":"Yes","2025 Average Mark":78},
    {"Student ID":"S1002","Name":"Another Student","Gender":"M","Support needs":"","2025 Average Mark":64}]), "Students");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    {"Rule":"Keep apart","Student 1":"S1001","Student 2":"S1002"},
    {"Rule":"Keep together","Student 1":"S1001","Student 2":"S1002"}]), "Rules");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["How to fill this in"],
    ["Students sheet: one row per student. Name and a mark are required; ID, gender and support needs are optional."],
    ["Support needs: write Yes (or any note) for students who need support. Leave blank otherwise."],
    ["Rules sheet: Keep apart or Keep together, then two students by ID (or exact name). Delete the example rows."],
    ["You can rename the mark column; you'll pick it in the app."]]), "Instructions");
  saveWorkbook(wb, "class-placement-template.xlsx");
});

/* ---------- install as app (offline support) ---------- */
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

/* ---------- start with example data ---------- */
rows = exampleData(); headers = Object.keys(rows[0]); setupColumns(); students = buildStudents();
const ex = [...students].sort(byMark).slice(25);
rules = [{type:"apart", a:ex[0].ref, b:ex[5].ref}, {type:"apart", a:ex[10].ref, b:ex[16].ref}, {type:"together", a:ex[20].ref, b:ex[40].ref}];
assign();
