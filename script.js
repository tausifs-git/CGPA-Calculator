(function(){
  "use strict";

  // ===== Grading scales (official published grade-point tables) =====
  const SCALES = {
    uiu: {
      name: "UIU — United International University",
      short: "UIU",
      grades: [
        {g:"A",p:4.00},{g:"A-",p:3.67},{g:"B+",p:3.33},{g:"B",p:3.00},{g:"B-",p:2.67},
        {g:"C+",p:2.33},{g:"C",p:2.00},{g:"C-",p:1.67},{g:"D+",p:1.33},{g:"D",p:1.00},{g:"F",p:0.00}
      ]
    },
    nsu: {
      name: "NSU — North South University",
      short: "NSU",
      grades: [
        {g:"A",p:4.00},{g:"A-",p:3.70},{g:"B+",p:3.30},{g:"B",p:3.00},{g:"B-",p:2.70},
        {g:"C+",p:2.30},{g:"C",p:2.00},{g:"C-",p:1.70},{g:"D+",p:1.30},{g:"D",p:1.00},{g:"F",p:0.00}
      ]
    },
    brac: {
      name: "BRAC University",
      short: "BRACU",
      grades: [
        {g:"A+",p:4.00},{g:"A",p:4.00},{g:"A-",p:3.70},{g:"B+",p:3.30},{g:"B",p:3.00},{g:"B-",p:2.70},
        {g:"C+",p:2.30},{g:"C",p:2.00},{g:"C-",p:1.70},{g:"D+",p:1.30},{g:"D",p:1.00},{g:"D-",p:0.70},{g:"F",p:0.00}
      ]
    },
    aiub: {
      name: "AIUB — American International University-Bangladesh",
      short: "AIUB",
      grades: [
        {g:"A+",p:4.00},{g:"A",p:3.75},{g:"B+",p:3.50},{g:"B",p:3.25},{g:"C+",p:3.00},{g:"C",p:2.75},
        {g:"D+",p:2.50},{g:"D",p:2.25},{g:"F",p:0.00}
      ]
    },
    generic: {
      name: "Generic 4.0 scale (A+ to F)",
      short: "Generic",
      grades: [
        {g:"A+",p:4.00},{g:"A",p:4.00},{g:"A-",p:3.70},{g:"B+",p:3.30},{g:"B",p:3.00},{g:"B-",p:2.70},
        {g:"C+",p:2.30},{g:"C",p:2.00},{g:"C-",p:1.70},{g:"D+",p:1.30},{g:"D",p:1.00},{g:"D-",p:0.70},{g:"F",p:0.00}
      ]
    }
  };

  const STORAGE_KEY = "cgpa_ledger_v4";

  // Which color theme each university's grading scale switches to
  const SCALE_THEME = { uiu:"uiu", nsu:"nsu", brac:"brac", aiub:"aiub", generic:"dark" };
  let state = loadState();
  let justSwitchedScale = false;

  function currentGrades(){ return SCALES[state.scaleKey].grades; }
  function gradePoint(g){
    const f = currentGrades().find(x=>x.g===g);
    return f ? f.p : null;
  }
  function gradeExists(g){ return currentGrades().some(x=>x.g===g); }

  function uid(){ return Math.random().toString(36).slice(2,9); }
  function clamp(n,min,max){ return Math.min(max, Math.max(min,n)); }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && Array.isArray(parsed.courses)){
          if(!SCALES[parsed.scaleKey]) parsed.scaleKey = "uiu";
          return parsed;
        }
      }
    }catch(e){}
    return {
      scaleKey: "uiu",
      prevCGPA: "",
      prevCredits: "",
      courses: [
        { id:uid(), title:"", credits:"3", grade:"A", retake:false, prevGrade:"" }
      ]
    };
  }

  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const tick = document.getElementById("saveTick");
      tick.classList.add("show");
      clearTimeout(saveState._t);
      saveState._t = setTimeout(()=>tick.classList.remove("show"), 900);
    }catch(e){}
  }

  function gradeOptionsHTML(selected, includeBlank){
    let html = includeBlank ? `<option value="" ${!selected?"selected":""}>—</option>` : "";
    html += currentGrades().map(x=>`<option value="${x.g}" ${x.g===selected?"selected":""}>${x.g}</option>`).join("");
    return html;
  }

  function compute(){
    const prevCGPA = parseFloat(state.prevCGPA) || 0;
    const prevCredits = parseFloat(state.prevCredits) || 0;
    const prevQP = prevCGPA * prevCredits;

    let semQP = 0, semCredits = 0;
    let addedCredits = 0;
    let deltaQP = 0;
    let retakesApplied = 0;
    let retakesPending = 0;

    state.courses.forEach(c=>{
      const credits = parseFloat(c.credits) || 0;
      const newPts = gradePoint(c.grade);
      if(newPts === null || credits <= 0) return;

      semQP += newPts * credits;
      semCredits += credits;

      if(c.retake){
        const oldPts = gradePoint(c.prevGrade);
        if(oldPts !== null){
          deltaQP += (newPts - oldPts) * credits;
          retakesApplied++;
        } else {
          retakesPending++;
        }
      } else {
        deltaQP += newPts * credits;
        addedCredits += credits;
      }
    });

    const newCredits = prevCredits + addedCredits;
    const newQP = prevQP + deltaQP;
    const newCGPA = newCredits > 0 ? newQP / newCredits : 0;
    const semGPA = semCredits > 0 ? semQP / semCredits : 0;

    return { prevCGPA, prevCredits, prevQP, semQP, semCredits, semGPA,
      addedCredits, deltaQP, newCredits, newQP, newCGPA, retakesApplied, retakesPending };
  }

  function populateScaleSelect(){
    const sel = document.getElementById("scaleSelect");
    sel.innerHTML = Object.keys(SCALES).map(key=>
      `<option value="${key}" ${key===state.scaleKey?"selected":""}>${SCALES[key].name}</option>`
    ).join("");
  }

  function escapeHTML(s){
    return (s||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  }
  function escapeAttr(s){ return escapeHTML(s); }

  // ---- Lightweight refresh: updates only computed numbers, never touches
  // the row inputs or the prior-record inputs, so it's safe to call on
  // every keystroke without stealing focus. ----
  function refreshStats(){
    const r = compute();

    document.getElementById("prevQPNote").innerHTML =
      (state.prevCGPA !== "" && state.prevCredits !== "")
        ? `Prior quality points: <b>${r.prevQP.toFixed(2)}</b> (${r.prevCGPA.toFixed(2)} × ${r.prevCredits})`
        : `Leave both at 0 if this is your very first semester.`;

    // Seal arc: 0 -> 360 degrees as CGPA goes 0.00 -> 4.00 (capped at a full circle)
    const sealDeg = Math.max(0, Math.min(1, r.newCGPA / 4)) * 360;
    document.getElementById("seal").style.setProperty("--seal-deg", sealDeg.toFixed(1));
    document.getElementById("sealVal").textContent = r.newCGPA.toFixed(2);
    document.getElementById("statNewCGPA").textContent = r.newCGPA.toFixed(2);
    document.getElementById("cgpaWarning").classList.toggle("show", r.newCGPA > 4 + 1e-9);
    document.getElementById("statSemGPA").textContent = r.semGPA.toFixed(2);
    document.getElementById("statNewCredits").textContent = r.newCredits;
    document.getElementById("statRetakes").textContent = r.retakesApplied + (r.retakesPending ? ` (+${r.retakesPending} pending)` : "");
    const delta = r.newCGPA - r.prevCGPA;
    const deltaEl = document.getElementById("statDelta");
    deltaEl.textContent = (delta>=0?"+":"") + delta.toFixed(2);
    deltaEl.classList.toggle("up", delta > 0);
    deltaEl.classList.toggle("down", delta < 0);

    document.getElementById("calcLines").innerHTML = `
      <div class="calc-line"><span>Prior quality points</span><span>${r.prevCGPA.toFixed(2)} × ${r.prevCredits} = ${r.prevQP.toFixed(2)}</span></div>
      <div class="calc-line"><span>New/added course credits this semester</span><span>+${r.addedCredits}</span></div>
      <div class="calc-line"><span>Net quality-point change (new courses + retake deltas)</span><span>${r.deltaQP>=0?'+':''}${r.deltaQP.toFixed(2)}</span></div>
      <div class="calc-line"><span>Cumulative credits</span><span>${r.prevCredits} + ${r.addedCredits} = ${r.newCredits}</span></div>
      <div class="calc-line"><span>Cumulative quality points</span><span>${r.prevQP.toFixed(2)} + ${r.deltaQP.toFixed(2)} = ${r.newQP.toFixed(2)}</span></div>
      <div class="calc-line total"><span>New CGPA</span><span>${r.newQP.toFixed(2)} ÷ ${r.newCredits} = ${r.newCGPA.toFixed(2)}</span></div>
    `;
  }

  // ---- Full row rebuild: only called on structural changes (add/delete
  // row, retake toggle, scale switch, load, reset) — never on a keystroke. ----
  function renderRows(){
    const rowsEl = document.getElementById("courseRows");
    rowsEl.innerHTML = "";
    state.courses.forEach(c=>{
      const tr = document.createElement("tr");
      tr.dataset.id = c.id;
      tr.className = c.retake ? "retake-row" : "";
      const pendingWarn = c.retake && !c.prevGrade;
      tr.innerHTML = `
        <td class="col-title"><input class="cell-input" data-field="title" value="${escapeAttr(c.title)}" placeholder="Course name (optional)"></td>
        <td class="col-credits"><input class="cell-input credits-input" data-field="credits" type="text" inputmode="decimal" value="${escapeAttr(c.credits)}"></td>
        <td class="col-grade"><select class="cell-input grade-input" data-field="grade">${gradeOptionsHTML(c.grade,false)}</select></td>
        <td class="col-retake"><label class="retake-toggle"><input type="checkbox" data-field="retake" ${c.retake?"checked":""}> retake</label></td>
        <td class="col-prevgrade">${
          c.retake
            ? `<select class="cell-input grade-input" data-field="prevGrade">${gradeOptionsHTML(c.prevGrade,true)}</select>${pendingWarn ? '<div class="warn-pill">pick one</div>' : ''}`
            : `<span class="muted-dash">—</span>`
        }</td>
        <td class="col-del"><button class="row-del-btn" data-action="del-row" title="Remove row">✕</button></td>
      `;
      rowsEl.appendChild(tr);

      const titleInp = tr.querySelector('[data-field="title"]');
      titleInp.addEventListener("input", ()=>{
        c.title = titleInp.value;
        saveState();
      });

      const creditsInp = tr.querySelector('[data-field="credits"]');
      creditsInp.addEventListener("input", ()=>{
        c.credits = creditsInp.value;
        saveState();
        refreshStats();
      });
      creditsInp.addEventListener("blur", ()=>{
        const n = clamp(parseFloat(creditsInp.value) || 0, 0, 400);
        const formatted = n.toString();
        c.credits = formatted;
        creditsInp.value = formatted;
        saveState();
        refreshStats();
      });

      const gradeSel = tr.querySelector('[data-field="grade"]');
      gradeSel.addEventListener("change", ()=>{
        c.grade = gradeSel.value;
        saveState();
        refreshStats();
      });

      const retakeChk = tr.querySelector('[data-field="retake"]');
      retakeChk.addEventListener("change", ()=>{
        c.retake = retakeChk.checked;
        if(!c.retake) c.prevGrade = "";
        saveState();
        renderRows();
        refreshStats();
      });

      const prevGradeSel = tr.querySelector('[data-field="prevGrade"]');
      if(prevGradeSel){
        prevGradeSel.addEventListener("change", ()=>{
          c.prevGrade = prevGradeSel.value;
          saveState();
          renderRows();
          refreshStats();
        });
      }

      tr.querySelector('[data-action="del-row"]').addEventListener("click", ()=>{
        state.courses = state.courses.filter(x=>x.id!==c.id);
        saveState();
        renderRows();
        refreshStats();
      });
    });
  }

  // ---- Full render: header/scale label + rows + stats. Used on load,
  // scale switch, add row, and reset — not on every keystroke. ----
  // Grading scale reference: one small table per university, current one highlighted.
  // Built from SCALES, so the values always match what the calculator uses.
  function renderGradeTables(){
    document.getElementById("gradeTables").innerHTML = Object.keys(SCALES).map(key=>{
      const sc = SCALES[key];
      const rows = sc.grades.map(x=>
        `<div class="grade-row"><span class="gp">${x.p.toFixed(2)}</span><span class="gl">${x.g}</span></div>`
      ).join("");
      const active = key === state.scaleKey;
      return `<div class="grade-table${active ? " active" : ""}">
        <div class="grade-table-head" title="${escapeAttr(sc.name)}"><span>${escapeHTML(sc.short)}</span>${active ? '<span class="sel-pill">selected</span>' : ""}</div>
        ${rows}
      </div>`;
    }).join("");
  }

  function render(){
    document.getElementById("scaleName").textContent = SCALES[state.scaleKey].name;
    document.getElementById("eyebrow").textContent = SCALES[state.scaleKey].short + " · 4.00 Scale";
    document.getElementById("scaleChangedNote").classList.toggle("show", justSwitchedScale);
    document.getElementById("prevCGPA").value = state.prevCGPA;
    document.getElementById("prevCredits").value = state.prevCredits;
    renderGradeTables();
    renderRows();
    refreshStats();
  }

  // ===== Prior record fields =====
  const prevCGPAInput = document.getElementById("prevCGPA");
  const prevCGPAErr = document.getElementById("prevCGPAErr");
  prevCGPAInput.addEventListener("input", ()=>{
    state.prevCGPA = prevCGPAInput.value;
    saveState();
    refreshStats();
  });
  prevCGPAInput.addEventListener("blur", ()=>{
    const raw = prevCGPAInput.value.trim();
    if(raw === ""){ prevCGPAErr.classList.remove("show"); return; }
    let n = parseFloat(raw);
    if(isNaN(n)){ n = 0; prevCGPAErr.classList.add("show"); }
    else {
      const clamped = clamp(n,0,4);
      prevCGPAErr.classList.toggle("show", clamped !== n);
      n = clamped;
    }
    const formatted = n.toFixed(2);
    state.prevCGPA = formatted;
    prevCGPAInput.value = formatted;
    saveState();
    refreshStats();
  });

  const prevCreditsInput = document.getElementById("prevCredits");
  const prevCreditsErr = document.getElementById("prevCreditsErr");
  prevCreditsInput.addEventListener("input", ()=>{
    state.prevCredits = prevCreditsInput.value;
    saveState();
    refreshStats();
  });
  prevCreditsInput.addEventListener("blur", ()=>{
    const raw = prevCreditsInput.value.trim();
    if(raw === ""){ prevCreditsErr.classList.remove("show"); return; }
    let n = parseFloat(raw);
    if(isNaN(n)){ n = 0; prevCreditsErr.classList.add("show"); }
    else {
      const clamped = clamp(n,0,600);
      prevCreditsErr.classList.toggle("show", clamped !== n);
      n = clamped;
    }
    const formatted = n.toString();
    state.prevCredits = formatted;
    prevCreditsInput.value = formatted;
    saveState();
    refreshStats();
  });

  document.getElementById("addRowBtn").addEventListener("click", ()=>{
    state.courses.push({ id:uid(), title:"", credits:"3", grade:currentGrades()[0].g, retake:false, prevGrade:"" });
    saveState();
    renderRows();
    refreshStats();
  });

  document.getElementById("resetBtn").addEventListener("click", ()=>{
    if(confirm("This clears everything from this browser. Continue?")){
      localStorage.removeItem(STORAGE_KEY);
      state = loadState();
      justSwitchedScale = false;
      populateScaleSelect();
      render();
    }
  });

  document.getElementById("scaleSelect").addEventListener("change", e=>{
    const newKey = e.target.value;
    if(newKey === state.scaleKey) return;
    state.scaleKey = newKey;
    let anyReset = false;
    state.courses.forEach(c=>{
      if(!gradeExists(c.grade)){ c.grade = currentGrades()[0].g; anyReset = true; }
      if(c.prevGrade && !gradeExists(c.prevGrade)){ c.prevGrade = ""; anyReset = true; }
    });
    justSwitchedScale = anyReset;
    saveState();
    applyTheme(SCALE_THEME[newKey] || "dark");
    render();
  });

  // ===== Download / save / load =====
  const dlMsg = document.getElementById("dlMsg");
  function setDlMsg(text, isErr){
    dlMsg.textContent = text;
    dlMsg.classList.toggle("err", !!isErr);
  }

  function todayStr(){
    const d = new Date(), p = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function downloadFile(filename, text, mime){
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  // One place that gathers everything the exports need
  function reportData(){
    const r = compute();
    const scale = SCALES[state.scaleKey];
    const courses = state.courses.map(c=>{
      const pts = gradePoint(c.grade);
      return {
        title: c.title || "",
        credits: parseFloat(c.credits) || 0,
        grade: c.grade,
        points: pts === null ? "" : pts.toFixed(2),
        retake: !!c.retake,
        prevGrade: c.retake ? (c.prevGrade || "") : ""
      };
    });
    return { r, scale, courses };
  }

  // ---- CSV ----
  // User-typed text is wrapped as {t: "..."} so a leading = + - @ can't run as a spreadsheet formula
  const T = s => ({ t: String(s) });
  function csvCell(v){
    let s, userText = false;
    if(v && typeof v === "object"){ s = v.t; userText = true; }
    else s = String(v);
    if(userText && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCSV(){
    const { r, scale, courses } = reportData();
    const delta = r.newCGPA - r.prevCGPA;
    const rows = [
      ["CGPA Ledger report"],
      ["Grading scale", scale.name],
      ["Date", todayStr()],
      ["Previous CGPA", r.prevCGPA.toFixed(2)],
      ["Previous credits completed", r.prevCredits],
      [],
      ["Course", "Credits", "Grade", "Grade points", "Retake", "Previous grade"],
      ...courses.map(c => [T(c.title), c.credits, c.grade, c.points, c.retake ? "Yes" : "No", c.prevGrade]),
      [],
      ["This semester GPA", r.semGPA.toFixed(2)],
      ["Credits added to cumulative", r.addedCredits],
      ["Total credits (cumulative)", r.newCredits],
      ["CGPA change", (delta >= 0 ? "+" : "") + delta.toFixed(2)],
      ["New CGPA", r.newCGPA.toFixed(2)]
    ];
    return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  }

  // ---- JSON save / load ----
  function buildJSON(){
    return JSON.stringify({
      app: "cgpa-ledger",
      version: 1,
      savedAt: new Date().toISOString(),
      state: {
        scaleKey: state.scaleKey,
        prevCGPA: state.prevCGPA,
        prevCredits: state.prevCredits,
        courses: state.courses.map(c => ({
          title: c.title, credits: c.credits, grade: c.grade, retake: !!c.retake, prevGrade: c.prevGrade || ""
        }))
      }
    }, null, 2);
  }

  // Never trust a loaded file: check every field before it touches the app state
  function sanitizeLoaded(data){
    const src = data && typeof data === "object" && data.state ? data.state : data;
    if(!src || typeof src !== "object") throw new Error("This is not a CGPA Ledger file.");
    if(!Object.prototype.hasOwnProperty.call(SCALES, src.scaleKey)) throw new Error("Unknown grading scale in file.");
    if(!Array.isArray(src.courses)) throw new Error("No courses found in file.");
    if(src.courses.length > 200) throw new Error("Too many courses in file.");

    const grades = SCALES[src.scaleKey].grades;
    const valid = g => grades.some(x => x.g === g);
    const num = (v, min, max) => {
      const n = parseFloat(v);
      return isNaN(n) ? 0 : Math.min(max, Math.max(min, n));
    };
    const hasValue = v => v !== "" && v !== null && v !== undefined;

    return {
      scaleKey: src.scaleKey,
      prevCGPA: hasValue(src.prevCGPA) ? num(src.prevCGPA, 0, 4).toFixed(2) : "",
      prevCredits: hasValue(src.prevCredits) ? String(num(src.prevCredits, 0, 600)) : "",
      courses: src.courses.map(c => {
        c = c && typeof c === "object" ? c : {};
        const retake = c.retake === true;
        return {
          id: uid(),
          title: typeof c.title === "string" ? c.title.slice(0, 200) : "",
          credits: String(num(c.credits, 0, 400)),
          grade: valid(c.grade) ? c.grade : grades[0].g,
          retake,
          prevGrade: retake && valid(c.prevGrade) ? c.prevGrade : ""
        };
      })
    };
  }

  // ---- Printable report (PDF via the browser's print dialog) ----
  function buildPrintReport(){
    const { r, scale, courses } = reportData();
    const e = escapeHTML;
    const delta = r.newCGPA - r.prevCGPA;
    const rows = courses.map(c => `
      <tr>
        <td>${c.title ? e(c.title) : "&mdash;"}</td>
        <td class="num">${c.credits}</td>
        <td class="num">${e(c.grade)}</td>
        <td class="num">${c.points}</td>
        <td class="num">${c.retake ? "Yes" : "No"}</td>
        <td class="num">${c.prevGrade ? e(c.prevGrade) : "&mdash;"}</td>
      </tr>`).join("");
    document.getElementById("printReport").innerHTML = `
      <h1>CGPA Report</h1>
      <p class="pr-meta">Grading scale: ${e(scale.name)} &middot; Date: ${todayStr()}</p>

      <h2>Prior record</h2>
      <table class="pr-kv">
        <tr><th>Previous CGPA</th><td>${r.prevCGPA.toFixed(2)}</td></tr>
        <tr><th>Credits completed so far</th><td>${r.prevCredits}</td></tr>
      </table>

      <h2>This semester</h2>
      <table>
        <thead><tr><th>Course</th><th class="num">Credits</th><th class="num">Grade</th><th class="num">Points</th><th class="num">Retake</th><th class="num">Previous grade</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <h2>Result</h2>
      <table class="pr-kv">
        <tr><th>This semester GPA</th><td>${r.semGPA.toFixed(2)}</td></tr>
        <tr><th>Total credits (cumulative)</th><td>${r.newCredits}</td></tr>
        <tr><th>CGPA change</th><td>${(delta >= 0 ? "+" : "") + delta.toFixed(2)}</td></tr>
        <tr><th>New CGPA</th><td>${r.newCGPA.toFixed(2)}</td></tr>
      </table>
      ${r.newCGPA > 4 + 1e-9 ? '<p class="pr-note">Note: the calculated CGPA is above 4.00, which is not possible. Please check the input values.</p>' : ""}

      <h2>Calculation</h2>
      ${document.getElementById("calcLines").innerHTML}
    `;
  }
  window.addEventListener("beforeprint", buildPrintReport);

  document.getElementById("dlPdf").addEventListener("click", ()=>{
    buildPrintReport();
    window.print();
    setDlMsg("In the print window, choose \"Save as PDF\" as the destination.");
  });

  document.getElementById("dlCsv").addEventListener("click", ()=>{
    const name = "cgpa-ledger-" + todayStr() + ".csv";
    downloadFile(name, buildCSV(), "text/csv;charset=utf-8");
    setDlMsg("Downloaded " + name);
  });

  document.getElementById("dlJson").addEventListener("click", ()=>{
    const name = "cgpa-ledger-" + todayStr() + ".json";
    downloadFile(name, buildJSON(), "application/json");
    setDlMsg("Downloaded " + name);
  });

  const loadInput = document.getElementById("loadJsonInput");
  document.getElementById("loadJsonBtn").addEventListener("click", ()=> loadInput.click());
  loadInput.addEventListener("change", ()=>{
    const file = loadInput.files && loadInput.files[0];
    loadInput.value = "";           // lets the same file be chosen again later
    if(!file) return;
    if(file.size > 500 * 1024){ setDlMsg("That file is too large to be a CGPA Ledger file.", true); return; }
    const reader = new FileReader();
    reader.onerror = ()=> setDlMsg("Could not read that file.", true);
    reader.onload = ()=>{
      try{
        state = sanitizeLoaded(JSON.parse(reader.result));
        justSwitchedScale = false;
        saveState();
        populateScaleSelect();
        render();
        setDlMsg("Loaded " + state.courses.length + " course" + (state.courses.length === 1 ? "" : "s") + " from " + file.name);
      }catch(err){
        setDlMsg(err instanceof SyntaxError ? "That file is not valid JSON." : err.message, true);
      }
    };
    reader.readAsText(file);
  });

  // ===== Color themes =====
  const THEME_KEY = "cgpa_ledger_theme";
  const THEMES = {
    dark:  "Dark",
    light: "Light",
    uiu:   "UIU · Orange",
    nsu:   "NSU · Azure",
    brac:  "BRACU · Blue",
    aiub:  "AIUB · Navy"
  };
  const themeLabel = document.getElementById("themeLabel");
  const themeSwatches = document.querySelectorAll(".theme-swatch");

  function syncThemeUI(){
    const key = document.documentElement.getAttribute("data-theme");
    themeLabel.textContent = "Theme: " + (THEMES[key] || THEMES.dark);
    themeSwatches.forEach(btn=>{
      const on = btn.dataset.themeKey === key;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function applyTheme(key){
    if(!THEMES[key]) key = "dark";
    document.documentElement.setAttribute("data-theme", key);
    try{ localStorage.setItem(THEME_KEY, key); }catch(e){}
    syncThemeUI();
  }

  themeSwatches.forEach(btn=>{
    btn.addEventListener("click", ()=> applyTheme(btn.dataset.themeKey));
  });
  syncThemeUI();

  populateScaleSelect();
  render();
})();