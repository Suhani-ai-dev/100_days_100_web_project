// ── DATA ──
const STORAGE_KEY = 'focusOS_v2';
let db = load();

function load(){
  try{
    const s = localStorage.getItem(STORAGE_KEY);
    if(s) return JSON.parse(s);
  }catch(e){}
  return {sessions:[], dailyGoal:0, streak:0, lastActiveDate:''};
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
function todayStr(){ return new Date().toDateString(); }
function dateKey(d){ return new Date(d).toLocaleDateString('en-CA'); }
function todayKey(){ return dateKey(Date.now()); }

// ── TIMER STATE ──
const MODES = {
  work:   {label:'WORK SESSION',   time:25*60, stroke:'#00e5ff'},
  short:  {label:'SHORT BREAK',    time:5*60,  stroke:'#10b981'},
  long:   {label:'LONG BREAK',     time:15*60, stroke:'#a78bfa'},
};
let currentMode = 'work';
let totalTime = MODES.work.time;
let timeLeft  = MODES.work.time;
let timerInt  = null;
let running   = false;
const CIRCUM  = 2 * Math.PI * 100; // r=100

// ── QUOTES ──
const quotes = [
  "Stay focused and never give up.",
  "It's the job that's never started that takes longest to finish. — Tolkien",
  "Someday is not a day of the week. — Dailey",
  "A year from now you may wish you had started today.",
  "You may delay, but time will not. — Franklin",
  "Discipline creates freedom.",
  "One session at a time. One goal at a time.",
  "Deep work is a superpower in our distracted world.",
  "The secret of getting ahead is getting started. — Twain",
  "Success is the sum of small efforts repeated day in and day out.",
  "Focus on the step in front of you, not the whole staircase.",
  "You don't have to see the whole staircase, just take the first step. — MLK",
  "Small progress is still progress.",
  "Stay consistent, not perfect.",
  "Do the hard work now. Thank yourself later.",
];
let quoteIdx = Math.floor(Math.random() * quotes.length);
function nextQuote(){
  quoteIdx = (quoteIdx + 1) % quotes.length;
  const el = document.getElementById('quoteText');
  el.style.opacity = '0';
  setTimeout(()=>{
    el.textContent = `"${quotes[quoteIdx]}"`;
    el.style.opacity = '1';
  }, 300);
}
setInterval(nextQuote, 8000);
document.getElementById('quoteText').textContent = `"${quotes[quoteIdx]}"`;

// ── CLOCK ──
function updateClock(){
  const now = new Date();
  document.getElementById('clockDisplay').textContent =
    now.toLocaleTimeString('en-US',{hour12:false});
}
setInterval(updateClock, 1000);
updateClock();

// ── VIEW SWITCHING ──
function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t=>{
    t.classList.toggle('active', t.textContent.toLowerCase().includes(name));
  });
  if(name==='dashboard') renderDashboard();
}

// ── THEME ──
function toggleTheme(){
  document.body.classList.toggle('light');
  document.getElementById('themeBtn').textContent =
    document.body.classList.contains('light') ? '☀️' : '🌙';
}

// ── MODE ──
function setMode(mode){
  resetTimer();
  currentMode = mode;
  totalTime = MODES[mode].time;
  timeLeft   = MODES[mode].time;
  document.getElementById('modeLabel').textContent = MODES[mode].label;
  document.getElementById('progressCircle').style.stroke = MODES[mode].stroke;
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(mode === 'work' ? 'workBtn' : mode === 'short' ? 'shortBtn' : 'longBtn').classList.add('active');
  updateDisplay();
}

// ── TIMER ──
function updateDisplay(){
  const m = Math.floor(timeLeft/60);
  const s = timeLeft % 60;
  const str = `${m}:${s<10?'0':''}${s}`;
  document.getElementById('timerDisplay').textContent = str;
  document.getElementById('focusTimer').textContent = str;

  const pct = timeLeft / totalTime;
  const offset = CIRCUM * pct;
  document.getElementById('progressCircle').style.strokeDasharray = CIRCUM;
  document.getElementById('progressCircle').style.strokeDashoffset = CIRCUM - offset;
}

function startTimer(){
  if(running) return;
  running = true;
  timerInt = setInterval(tick, 1000);
}
function pauseTimer(){
  clearInterval(timerInt);
  running = false;
}
function resetTimer(){
  pauseTimer();
  timeLeft = totalTime;
  updateDisplay();
}

function tick(){
  if(timeLeft > 0){
    timeLeft--;
    updateDisplay();
  } else {
    clearInterval(timerInt);
    running = false;
    sessionComplete();
  }
}

function sessionComplete(){
  const isWork = currentMode === 'work';
  const task   = document.getElementById('currentTask').textContent.trim();
  const dur    = totalTime / 60;

  // Log session
  const entry = {
    date: todayKey(),
    dateStr: todayStr(),
    time: new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}),
    task: task === 'No task set' ? '—' : task,
    type: isWork ? 'Work' : 'Break',
    duration: dur,
    ts: Date.now(),
  };
  db.sessions.push(entry);

  // Streak
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  if(db.lastActiveDate === dateKey(yesterday)){
    db.streak = (db.streak || 0) + (isWork ? 1 : 0);
  } else if(db.lastActiveDate !== todayKey()){
    db.streak = isWork ? 1 : 0;
  }
  if(isWork) db.lastActiveDate = todayKey();
  save();

  nextQuote();
  renderTimerStats();
  renderSessionLog();
  renderMiniChart();
  checkGoal();

  // auto-switch
  setTimeout(()=>{
    if(currentMode === 'work') setMode('short');
    else setMode('work');
  }, 400);
}

// ── TASK ──
document.getElementById('taskInput').addEventListener('keydown', e=>{
  if(e.key !== 'Enter') return;
  const v = e.target.value.trim();
  if(!v) return;
  document.getElementById('currentTask').textContent = v;
  document.getElementById('currentTask').classList.remove('done');
  document.getElementById('taskCheck').checked = false;
  document.getElementById('focusTaskLabel').textContent = v;
  e.target.value = '';
});
document.getElementById('taskCheck').addEventListener('change', function(){
  const el = document.getElementById('currentTask');
  if(this.checked){
    el.classList.add('done');
    setTimeout(()=>{
      el.textContent = 'No task set';
      el.classList.remove('done');
      this.checked = false;
      document.getElementById('focusTaskLabel').textContent = 'Stay in the zone';
    },1500);
  } else {
    el.classList.remove('done');
  }
});

// ── GOAL ──
function setGoal(){
  const v = parseInt(document.getElementById('goalInput').value);
  if(!v || v < 1) return;
  db.dailyGoal = v;
  save();
  document.getElementById('goalInput').value = '';
  renderTimerStats();
  checkGoal();
}
function checkGoal(){
  const done = todaySessions();
  const goal = db.dailyGoal;
  const el = document.getElementById('goalSuccessMsg');
  if(goal > 0 && done >= goal){
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function todaySessions(){
  return db.sessions.filter(s => s.date === todayKey() && s.type === 'Work').length;
}
function todayMinutes(){
  return db.sessions.filter(s => s.date === todayKey() && s.type === 'Work').reduce((a,s)=>a+s.duration,0);
}

// ── RENDER TIMER STATS ──
function renderTimerStats(){
  const done = todaySessions();
  const mins = todayMinutes();
  const goal = db.dailyGoal;

  document.getElementById('statCompleted').textContent = done;
  document.getElementById('statTime').textContent = mins >= 60
    ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`;
  document.getElementById('statGoal').textContent = goal > 0 ? goal : '—';
  document.getElementById('statStreak').textContent = `${db.streak || 0}🔥`;
  document.getElementById('goalProgressText').textContent = `${done} / ${goal > 0 ? goal : '—'} sessions`;

  // progress bar
  const pct = goal > 0 ? Math.min((done/goal)*100, 100) : 0;
  document.getElementById('goalBar').style.width = pct + '%';
  document.getElementById('statGoal').textContent = goal > 0 ? goal : '—';
}

// ── SESSION LOG (timer sidebar) ──
function renderSessionLog(){
  const container = document.getElementById('sessionLog');
  const today = db.sessions.filter(s => s.date === todayKey()).reverse();
  if(!today.length){
    container.innerHTML = '<div class="log-empty">No sessions yet. Start focusing!</div>';
    return;
  }
  container.innerHTML = today.map(s=>`
    <div class="log-item">
      <div>
        <div class="log-task">${s.task}</div>
        <div class="log-meta">${s.time} · ${s.duration}min</div>
      </div>
      <span class="log-badge ${s.type==='Work'?'badge-work':'badge-break'}">${s.type}</span>
    </div>
  `).join('');
}

// ── MINI WEEKLY BARS ──
function renderMiniChart(){
  const bars = document.getElementById('miniBars');
  const labels = document.getElementById('miniLabels');
  const days = getLast7Days();
  const maxSess = Math.max(...days.map(d=>d.sessions), 1);
  bars.innerHTML = days.map((d,i)=>`
    <div class="mini-bar ${d.isToday?'today':''}"
      style="height:${Math.max(4, (d.sessions/maxSess)*44)}px;background:${d.isToday?'var(--accent)':'var(--accent)'}"
      title="${d.label}: ${d.sessions} sessions"></div>
  `).join('');
  labels.innerHTML = days.map(d=>`<span>${d.short}</span>`).join('');
}

function getLast7Days(){
  const result = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = dateKey(d);
    const sessions = db.sessions.filter(s=>s.date===key && s.type==='Work').length;
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    result.push({
      key, sessions,
      label: d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}),
      short: days[d.getDay()],
      isToday: key === todayKey(),
      minutes: db.sessions.filter(s=>s.date===key && s.type==='Work').reduce((a,s)=>a+s.duration,0),
    });
  }
  return result;
}

// ── FOCUS MODE ──
function enterFocus(){
  document.getElementById('focusOverlay').classList.add('active');
}
function exitFocus(){
  document.getElementById('focusOverlay').classList.remove('active');
}

// ── DASHBOARD ──
function renderDashboard(){
  const allWork = db.sessions.filter(s=>s.type==='Work');
  const allBreak = db.sessions.filter(s=>s.type==='Break');
  const totalMins = allWork.reduce((a,s)=>a+s.duration,0);

  document.getElementById('dTotalTime').textContent =
    totalMins >= 60 ? `${Math.floor(totalMins/60)}h ${totalMins%60}m` : `${totalMins}m`;
  document.getElementById('dTotalSessions').textContent = allWork.length;
  document.getElementById('dStreak').textContent = `${db.streak||0} days`;

  // Best day
  const byDay = {};
  allWork.forEach(s=>{ byDay[s.date]=(byDay[s.date]||0)+1; });
  const bestDay = Object.entries(byDay).sort((a,b)=>b[1]-a[1])[0];
  if(bestDay){
    document.getElementById('dBestDay').textContent = `${bestDay[1]} sessions`;
    document.getElementById('dBestDayLabel').textContent = new Date(bestDay[0]).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  }

  // 7-day chart
  renderWeekChart();

  // Donut
  const totalAll = allWork.length + allBreak.length || 1;
  const workPct = allWork.length / totalAll;
  const breakPct = allBreak.length / totalAll;
  const circum = 2*Math.PI*40; // r=40
  document.getElementById('donutWork').style.strokeDasharray =
    `${workPct*circum} ${circum}`;
  document.getElementById('donutWork').style.strokeDashoffset = 0;
  // break ring offset
  document.getElementById('donutBreak').style.strokeDasharray =
    `${breakPct*circum} ${circum}`;
  document.getElementById('donutBreak').style.strokeDashoffset = -(workPct*circum);
  document.getElementById('donutWorkVal').textContent = allWork.length;
  document.getElementById('donutBreakVal').textContent = allBreak.length;
  document.getElementById('donutTimeVal').textContent = totalMins + ' min';

  // Heatmap
  renderHeatmap();

  // History table
  renderHistoryTable();
}

function renderWeekChart(){
  const days = getLast7Days();
  const maxSess = Math.max(...days.map(d=>d.sessions),1);
  const maxMins = Math.max(...days.map(d=>d.minutes),1);
  const H = 130;
  const container = document.getElementById('weekChart');
  container.innerHTML = days.map(d=>`
    <div class="bar-group">
      <div class="bar-val">${d.sessions||''}</div>
      <div class="bar-pair">
        <div class="bar-col work-bar"
          style="height:${Math.max(4,(d.sessions/maxSess)*H)}px"
          title="${d.sessions} sessions"></div>
        <div class="bar-col time-bar"
          style="height:${Math.max(4,(d.minutes/maxMins)*H)}px"
          title="${d.minutes} minutes"></div>
      </div>
      <div class="bar-day ${d.isToday?'today-label':''}">${d.short}</div>
    </div>
  `).join('');
}

function renderHeatmap(){
  const container = document.getElementById('heatmap');
  const cells = [];
  for(let i=27;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = dateKey(d);
    const count = db.sessions.filter(s=>s.date===key && s.type==='Work').length;
    const level = count===0?0:count<=1?1:count<=3?2:count<=5?3:4;
    cells.push(`<div class="heat-cell heat-${level}" title="${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}: ${count} sessions"></div>`);
  }
  container.innerHTML = cells.join('');
}

function renderHistoryTable(){
  const tbody = document.getElementById('historyTable');
  const all = [...db.sessions].reverse();
  if(!all.length){
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px;">No sessions recorded yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = all.slice(0,50).map(s=>`
    <tr>
      <td style="color:var(--muted)">${new Date(s.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</td>
      <td style="font-family:var(--font-mono);font-size:12px;color:var(--muted)">${s.time}</td>
      <td style="color:var(--text)">${s.task}</td>
      <td><span class="log-badge ${s.type==='Work'?'badge-work':'badge-break'}">${s.type}</span></td>
      <td style="font-family:var(--font-mono);color:var(--muted)">${s.duration}m</td>
    </tr>
  `).join('');
}

function clearAll(){
  if(!confirm('Clear all session history and stats? This cannot be undone.')) return;
  db = {sessions:[],dailyGoal:db.dailyGoal,streak:0,lastActiveDate:''};
  save();
  renderDashboard();
  renderTimerStats();
  renderSessionLog();
  renderMiniChart();
}

// ── INIT ──
updateDisplay();
renderTimerStats();
renderSessionLog();
renderMiniChart();
checkGoal();
