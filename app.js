(() => {
  "use strict";

  const STORAGE_KEY = "cognitiveTracker.sessions.v1";
  const $ = id => document.getElementById(id);

  const steps = [
    ["Context","stepContext"],
    ["Memory","stepMemory"],
    ["Working memory","stepWorking"],
    ["Attention","stepAttention"],
    ["Executive function","stepExecutive"],
    ["Delayed recall","stepRecall"],
    ["Everyday function","stepFunction"]
  ];

  const wordBanks = [
    ["garden","velvet","candle","river","ticket"],
    ["planet","coffee","window","pencil","orange"],
    ["forest","silver","button","market","cloud"],
    ["camera","lemon","bridge","jacket","ocean"],
    ["harbor","mirror","basket","purple","engine"],
    ["meadow","bottle","paper","castle","banana"],
    ["winter","button","ladder","pocket","tomato"],
    ["station","cotton","island","hammer","violet"],
    ["sunset","folder","pepper","bridge","silver"],
    ["museum","blanket","apple","window","forest"],
    ["garden","piano","rocket","yellow","basket"],
    ["coffee","island","mirror","candle","jacket"]
  ];

  const functionItems = [
    "I repeat questions or recently told information more than I used to.",
    "I forget recent conversations, appointments, or events despite trying to remember them.",
    "I lose track of familiar multi-step tasks.",
    "I struggle more with planning, scheduling, budgeting, or problem-solving.",
    "I have become disoriented in familiar places.",
    "Cognitive problems interfere with work, school, or everyday responsibilities."
  ];

  let currentStep = 0;
  let installPrompt = null;
  let session = freshSession();
  let reactionTrial = 0;
  let reactionStart = 0;
  let reactionTimer = null;
  let reactionFalseStart = false;

  function freshSession(){
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
      date: new Date().toISOString(),
      context: {},
      words: [],
      recallScore: null,
      digitSequence: "",
      digitCorrect: null,
      reactionTimes: [],
      executiveCorrect: null,
      functionScore: 0,
      scores: {}
    };
  }

  function loadSessions(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  }

  function saveSessions(sessions){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  function showView(id){
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    $(id).classList.add("active");
    window.scrollTo({top:0,behavior:"smooth"});
    if(id === "homeView") updateHome();
    if(id === "historyView") renderHistory();
  }

  function setupFunctionQuestions(){
    const host = $("functionQuestions");
    host.innerHTML = "";
    functionItems.forEach((text, idx) => {
      const wrap = document.createElement("div");
      wrap.className = "field";
      wrap.innerHTML = `
        <span>${text}</span>
        <select data-function="${idx}">
          <option value="">Select</option>
          <option value="0">No</option>
          <option value="1">Slightly</option>
          <option value="2">Noticeably</option>
          <option value="3">Substantially</option>
        </select>`;
      host.appendChild(wrap);
    });
  }

  function resetAssessmentUI(){
    session = freshSession();
    reactionTrial = 0;
    currentStep = 0;
    ["sleepHours","stressLevel","screenTime"].forEach(id => $(id).value = "");
    $("illnessToday").checked = false;
    $("wordDisplay").classList.add("hidden");
    $("wordDisplay").textContent = "";
    $("wordTimer").textContent = "";
    $("startWordsBtn").disabled = false;
    $("digitDisplay").classList.add("hidden");
    $("digitEntry").classList.add("hidden");
    $("digitAnswer").value = "";
    $("startDigitsBtn").disabled = false;
    $("digitStatus").textContent = "";
    $("reactionTarget").classList.add("hidden");
    $("reactionTarget").classList.remove("ready");
    $("reactionStatus").textContent = "";
    $("startReactionBtn").disabled = false;
    $("alternateAnswer").value = "";
    $("recallAnswer").value = "";
    setupFunctionQuestions();
    renderStep();
  }

  function renderStep(){
    steps.forEach(([_, id], idx) => $(id).classList.toggle("hidden", idx !== currentStep));
    $("stepTitle").textContent = steps[currentStep][0];
    $("stepCounter").textContent = `${currentStep + 1} / ${steps.length}`;
    $("progressBar").style.width = `${((currentStep + 1) / steps.length) * 100}%`;
    $("backBtn").disabled = currentStep === 0;
    $("nextBtn").textContent = currentStep === steps.length - 1 ? "Finish assessment" : "Continue";
  }

  function collectCurrentStep(){
    if(currentStep === 0){
      session.context = {
        sleepHours: Number($("sleepHours").value || 0),
        stressLevel: Number($("stressLevel").value || 0),
        screenTime: Number($("screenTime").value || 0),
        illnessToday: $("illnessToday").checked
      };
    }
    if(currentStep === 4){
      const ans = $("alternateAnswer").value.toUpperCase().replace(/[^A-Z0-9]/g,"");
      session.executiveCorrect = ans === "1A2B3C4D";
    }
    if(currentStep === 5){
      const tokens = $("recallAnswer").value.toLowerCase()
        .split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
      session.recallScore = session.words.filter(w => tokens.includes(w.toLowerCase())).length;
    }
    if(currentStep === 6){
      const vals = [...document.querySelectorAll("[data-function]")]
        .map(el => Number(el.value || 0));
      session.functionScore = vals.reduce((a,b)=>a+b,0);
    }
  }

  function startWords(){
    session.words = wordBanks[Math.floor(Math.random() * wordBanks.length)];
    $("startWordsBtn").disabled = true;
    $("wordDisplay").textContent = session.words.join(" • ");
    $("wordDisplay").classList.remove("hidden");
    let remaining = 15;
    $("wordTimer").textContent = `${remaining} seconds`;
    const timer = setInterval(() => {
      remaining--;
      $("wordTimer").textContent = remaining > 0 ? `${remaining} seconds` : "Words hidden. Continue.";
      if(remaining <= 0){
        clearInterval(timer);
        $("wordDisplay").classList.add("hidden");
        $("wordDisplay").textContent = "";
      }
    },1000);
  }

  function startDigits(){
    session.digitSequence = String(Math.floor(100000 + Math.random()*900000));
    $("startDigitsBtn").disabled = true;
    $("digitDisplay").textContent = session.digitSequence;
    $("digitDisplay").classList.remove("hidden");
    $("digitStatus").textContent = "Memorize the number.";
    setTimeout(() => {
      $("digitDisplay").classList.add("hidden");
      $("digitDisplay").textContent = "";
      $("digitEntry").classList.remove("hidden");
      $("digitAnswer").focus();
      $("digitStatus").textContent = "Enter the six digits.";
    },4000);
  }

  function submitDigits(){
    const ans = $("digitAnswer").value.replace(/\D/g,"");
    if(ans.length !== 6){
      $("digitStatus").textContent = "Please enter six digits.";
      return;
    }
    session.digitCorrect = ans === session.digitSequence;
    $("digitEntry").classList.add("hidden");
    $("digitStatus").textContent = "Answer recorded.";
  }

  function startReaction(){
    session.reactionTimes = [];
    reactionTrial = 0;
    $("startReactionBtn").disabled = true;
    $("reactionTarget").classList.remove("hidden");
    scheduleReactionTrial();
  }

  function scheduleReactionTrial(){
    reactionFalseStart = false;
    $("reactionTarget").classList.remove("ready");
    $("reactionTarget").textContent = "Wait…";
    $("reactionStatus").textContent = `Trial ${reactionTrial + 1} of 5`;
    const delay = 1400 + Math.floor(Math.random()*2200);
    reactionTimer = setTimeout(() => {
      reactionStart = performance.now();
      $("reactionTarget").classList.add("ready");
      $("reactionTarget").textContent = "TAP!";
    },delay);
  }

  function tapReaction(){
    if(!$("reactionTarget").classList.contains("ready")){
      clearTimeout(reactionTimer);
      reactionFalseStart = true;
      $("reactionStatus").textContent = "Too early — retrying this trial.";
      setTimeout(scheduleReactionTrial,900);
      return;
    }

    const rt = Math.round(performance.now() - reactionStart);
    session.reactionTimes.push(rt);
    reactionTrial++;
    $("reactionTarget").classList.remove("ready");
    $("reactionTarget").textContent = `${rt} ms`;

    if(reactionTrial >= 5){
      const avg = Math.round(session.reactionTimes.reduce((a,b)=>a+b,0)/session.reactionTimes.length);
      $("reactionStatus").textContent = `Average reaction time: ${avg} ms`;
      $("reactionTarget").classList.add("hidden");
    } else {
      setTimeout(scheduleReactionTrial,800);
    }
  }

  function computeScores(){
    const memory = Math.round((session.recallScore ?? 0) / 5 * 100);
    const working = session.digitCorrect === true ? 100 : session.digitCorrect === false ? 0 : 0;

    let attention = 0;
    if(session.reactionTimes.length){
      const avg = session.reactionTimes.reduce((a,b)=>a+b,0)/session.reactionTimes.length;
      attention = Math.max(0, Math.min(100, Math.round(100 - ((avg - 250)/400)*100)));
    }

    const executive = session.executiveCorrect ? 100 : 0;
    const overall = Math.round(memory*0.35 + working*0.20 + attention*0.25 + executive*0.20);

    session.scores = {memory,working,attention,executive,overall};
    return session.scores;
  }

  function finishAssessment(){
    collectCurrentStep();
    const scores = computeScores();
    const sessions = loadSessions();
    sessions.push(session);
    saveSessions(sessions);

    $("overallScore").textContent = scores.overall;
    $("memoryScore").textContent = scores.memory;
    $("workingScore").textContent = scores.working;
    $("attentionScore").textContent = scores.attention;
    $("executiveScore").textContent = scores.executive;

    const n = sessions.length;
    let msg = "This score is best interpreted as a personal benchmark, not against other people.";
    if(n <= 3) msg = `Session ${n} of 3 for your initial personal baseline. Avoid over-interpreting individual scores.`;
    else {
      const baseline = baselineOverall(sessions);
      const delta = scores.overall - baseline;
      msg = `Current overall score is ${Math.abs(Math.round(delta))} points ${delta >= 0 ? "above" : "below"} your initial baseline. Trends across multiple sessions matter more than one result.`;
    }
    $("resultMessage").textContent = msg;

    if(session.functionScore >= 5){
      $("functionNotice").classList.remove("hidden");
      $("functionNotice").textContent =
        "You reported noticeable changes in everyday cognitive function. Persistent or progressive functional change is worth discussing with a healthcare professional.";
    } else {
      $("functionNotice").classList.add("hidden");
    }

    showView("resultView");
  }

  function baselineOverall(sessions){
    const first = sessions.slice(0,Math.min(3,sessions.length));
    if(!first.length) return null;
    return first.reduce((a,s)=>a+(s.scores?.overall||0),0)/first.length;
  }

  function updateHome(){
    const sessions = loadSessions();
    $("sessionCount").textContent = sessions.length;
    if(sessions.length >= 3){
      $("baselineStatus").textContent = Math.round(baselineOverall(sessions));
    } else {
      $("baselineStatus").textContent = `${sessions.length}/3 sessions`;
    }

    const hasTrend = sessions.length >= 2;
    $("homeTrendEmpty").classList.toggle("hidden",hasTrend);
    $("homeTrend").classList.toggle("hidden",!hasTrend);
    if(hasTrend){
      drawLineChart($("homeChart"), sessions.map(s=>s.scores.overall), sessions.map(s=>shortDate(s.date)), ["Overall"]);
      const first = sessions[0].scores.overall;
      const latest = sessions.at(-1).scores.overall;
      const diff = latest-first;
      $("trendSummary").textContent =
        `From your first session to your latest, overall performance changed by ${diff >= 0 ? "+" : ""}${diff} points.`;
    }
  }

  function shortDate(iso){
    const d = new Date(iso);
    return `${d.getMonth()+1}/${String(d.getFullYear()).slice(-2)}`;
  }

  function renderHistory(){
    const sessions = loadSessions();
    const has = sessions.length > 0;
    $("historyEmpty").classList.toggle("hidden",has);
    $("historyChart").classList.toggle("hidden",!has);
    $("domainEmpty").classList.toggle("hidden",!has);
    $("domainChart").classList.toggle("hidden",!has);

    if(has){
      const labels=sessions.map(s=>shortDate(s.date));
      drawLineChart($("historyChart"), sessions.map(s=>s.scores.overall), labels, ["Overall"]);
      drawMultiChart($("domainChart"), [
        sessions.map(s=>s.scores.memory),
        sessions.map(s=>s.scores.working),
        sessions.map(s=>s.scores.attention),
        sessions.map(s=>s.scores.executive)
      ], labels, ["Memory","Working","Attention","Executive"]);
    }

    $("historyTable").innerHTML = sessions.length ? sessions.slice().reverse().map(s => `
      <div class="history-row">
        <div><strong>${new Date(s.date).toLocaleDateString()}</strong><br><span class="muted">${s.context?.sleepHours || "—"} h sleep • ${s.context?.screenTime || "—"} h screen</span></div>
        <div><strong>${s.scores.overall}</strong><br><span class="muted">overall</span></div>
        <div class="hide-mobile"><strong>${s.scores.memory}</strong><br><span class="muted">memory</span></div>
      </div>`).join("") : '<div class="empty-state">No sessions stored.</div>';
  }

  function drawLineChart(canvas, values, labels){
    drawMultiChart(canvas,[values],labels,["Overall"]);
  }

  function drawMultiChart(canvas, series, labels, names){
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 800;
    const cssHeight = Math.max(260, Math.round(cssWidth*0.46));
    canvas.width = cssWidth*dpr;
    canvas.height = cssHeight*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);

    const w=cssWidth,h=cssHeight;
    ctx.clearRect(0,0,w,h);
    const left=42,right=16,top=20,bottom=38;
    const pw=w-left-right,ph=h-top-bottom;

    ctx.strokeStyle="#e4e7ec"; ctx.lineWidth=1;
    ctx.fillStyle="#667085"; ctx.font="12px system-ui";
    [0,25,50,75,100].forEach(v=>{
      const y=top+ph-(v/100)*ph;
      ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();
      ctx.fillText(String(v),8,y+4);
    });

    const palette=["#3157d5","#12b76a","#f79009","#7a5af8"];
    series.forEach((vals,si)=>{
      ctx.strokeStyle=palette[si%palette.length];
      ctx.fillStyle=palette[si%palette.length];
      ctx.lineWidth=2.5;
      ctx.beginPath();
      vals.forEach((v,i)=>{
        const x=left+(vals.length===1?pw/2:(i/(vals.length-1))*pw);
        const y=top+ph-(v/100)*ph;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
      vals.forEach((v,i)=>{
        const x=left+(vals.length===1?pw/2:(i/(vals.length-1))*pw);
        const y=top+ph-(v/100)*ph;
        ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();
      });
    });

    labels.forEach((lab,i)=>{
      const x=left+(labels.length===1?pw/2:(i/(labels.length-1))*pw);
      ctx.fillStyle="#667085";
      ctx.textAlign="center";
      ctx.fillText(lab,x,h-12);
    });

    if(series.length>1){
      ctx.textAlign="left";
      names.forEach((name,i)=>{
        ctx.fillStyle=palette[i%palette.length];
        ctx.fillRect(left+i*95,4,10,10);
        ctx.fillStyle="#475467";
        ctx.fillText(name,left+14+i*95,13);
      });
    }
  }

  function exportData(){
    const data = {
      app:"Cognitive Tracker",
      version:1,
      exportedAt:new Date().toISOString(),
      sessions:loadSessions()
    };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`cognitive-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file){
    try{
      const text=await file.text();
      const parsed=JSON.parse(text);
      if(!Array.isArray(parsed.sessions)) throw new Error("Invalid backup");
      saveSessions(parsed.sessions);
      alert("Backup imported.");
      renderHistory();
    }catch(e){
      alert("Could not import this backup file.");
    }
  }

  function eraseData(){
    if(confirm("Erase all locally stored Cognitive Tracker sessions? This cannot be undone unless you exported a backup.")){
      localStorage.removeItem(STORAGE_KEY);
      renderHistory();
      updateHome();
    }
  }

  function bind(){
    $("startAssessmentBtn").addEventListener("click",()=>{resetAssessmentUI();showView("assessmentView")});
    $("showHistoryBtn").addEventListener("click",()=>showView("historyView"));
    $("historyHomeBtn").addEventListener("click",()=>showView("homeView"));
    $("resultHomeBtn").addEventListener("click",()=>showView("homeView"));
    $("resultHistoryBtn").addEventListener("click",()=>showView("historyView"));

    $("backBtn").addEventListener("click",()=>{
      collectCurrentStep();
      if(currentStep>0){currentStep--;renderStep();}
    });
    $("nextBtn").addEventListener("click",()=>{
      collectCurrentStep();
      if(currentStep<steps.length-1){currentStep++;renderStep();}
      else finishAssessment();
    });

    $("startWordsBtn").addEventListener("click",startWords);
    $("startDigitsBtn").addEventListener("click",startDigits);
    $("submitDigitsBtn").addEventListener("click",submitDigits);
    $("startReactionBtn").addEventListener("click",startReaction);
    $("reactionTarget").addEventListener("click",tapReaction);

    $("exportBtn").addEventListener("click",exportData);
    $("importFile").addEventListener("change",e=>{if(e.target.files[0]) importData(e.target.files[0])});
    $("clearDataBtn").addEventListener("click",eraseData);

    window.addEventListener("beforeinstallprompt",e=>{
      e.preventDefault(); installPrompt=e; $("installBtn").classList.remove("hidden");
    });
    $("installBtn").addEventListener("click",async()=>{
      if(installPrompt){installPrompt.prompt();installPrompt=null;$("installBtn").classList.add("hidden");}
    });

    window.addEventListener("resize",()=>{
      if($("homeView").classList.contains("active")) updateHome();
      if($("historyView").classList.contains("active")) renderHistory();
    });
  }

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
  }

  document.addEventListener("DOMContentLoaded",()=>{
    bind();
    setupFunctionQuestions();
    updateHome();
  });
})();
