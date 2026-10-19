'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const paths = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"/><path d="M14 3v5h5M9 12h6m-6 4h6"/>',
    folder: '<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11H3Z"/>',
    code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    server: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M5 10h14m-10-3h.01M9 14h.01M9 18h6"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8m-4-5v5"/>',
    laptop: '<rect x="5" y="4" width="14" height="12" rx="2"/><path d="m5 16-3 4h20l-3-4"/>',
    tablet: '<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M10 18h4"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 4 12 8-12 8Z"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    external: '<path d="M14 3h7v7m0-7L10 14M9 4H4v16h16v-5"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="m10 5-7 7 7 7M3 12h18"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z"/>',
    github: '<path d="M9 19c-4 1-4-2-6-2m12 5v-3.9a3.4 3.4 0 0 0-1-2.6c3.3-.4 6.8-1.6 6.8-7.4a5.8 5.8 0 0 0-1.5-4 5.4 5.4 0 0 0-.1-4s-1.2-.4-4 1.5a14 14 0 0 0-7.2 0C5.2-1.3 4 .1 4 .1a5.4 5.4 0 0 0-.1 4A5.8 5.8 0 0 0 2.4 8c0 5.8 3.5 7 6.8 7.4A3.4 3.4 0 0 0 8 18v4" transform="translate(1 1) scale(.9)"/>',
    key: '<circle cx="8" cy="9" r="5"/><path d="m12 13 8 8m-4-4 3-3m-6 0 3-3"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    alert: '<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3h.01"/>',
    hand: '<path d="M6 11V7a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v6-3a2 2 0 0 1 4 0v6c0 4-3 7-7 7h-2c-2 0-3-1-5-3l-6-6a2 2 0 0 1 3-3l3 3" transform="scale(.85)"/>',
    refresh: '<path d="M20 8a8 8 0 1 0 1 7M20 3v5h-5"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0v7l-2 3h16l-2-3Zm-9 13h6"/>'
  };
  const icon = name => `<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
  const badge = (label, tone = 'neutral') => `<span class="badge ${tone}">${escapeHtml(label)}</span>`;
  const device = id => devices.find(item => item.id === id);
  const task = id => tasks.find(item => item.id === id);
  const devices = [
    { id: 'gpu', name: 'Atlas', type: 'Linux GPU box', os: 'Ubuntu', icon: 'server', meta: 'RTX 4090 · 24 GB', reach: true, locked: false, desktop: false, note: 'Ready for files, code & local inference' },
    { id: 'mac', name: 'Moss', type: 'Mac Studio', os: 'macOS', icon: 'monitor', meta: 'Apple silicon · 64 GB', reach: true, locked: true, desktop: true, note: 'Connected · desktop needs a local unlock' },
    { id: 'windows', name: 'Field', type: 'Windows laptop', os: 'Windows', icon: 'laptop', meta: 'Last seen 18 minutes ago', reach: false, locked: false, desktop: true, note: 'Asleep · waiting for a connection' },
    { id: 'ipad', name: 'Canvas', type: 'iPad', os: 'iPadOS', icon: 'tablet', meta: 'Your portable control room', reach: true, locked: false, desktop: false, note: 'Review work & control remote workspaces' }
  ];
  const releaseBody = 'Orbit v0.8.0\n\n• Add device readiness indicators.\n• Improve offline task recovery.\n• Fix duplicate activity entries.\n\nPrepared from the approved local repository.';
  const tasks = [
    { id: 'index', title: 'Index engineering docs', device: 'gpu', state: 'running', progress: 62, detail: 'Reading document 128 of 206', scope: '/home/river/projects/docs', tools: 'files', time: 30, model: 'Local text model · Atlas', output: 'A searchable index and a short summary', events: [['Scope reviewed', 'Read the engineering docs folder; write the index inside it.'], ['Local model ready', 'Atlas is handling both execution and inference.'], ['Indexing source files', '128 of 206 documents processed.']] },
    { id: 'release', title: 'Prepare release notes', device: 'gpu', state: 'review', progress: 80, detail: 'The notes are ready. Review the GitHub draft.', scope: '/home/river/projects/orbit', tools: 'files', time: 15, model: 'Local text model · Atlas', output: 'Release notes for Orbit v0.8.0', events: [['Read the changelog', 'Used the repository’s read-only GitHub connection.'], ['Wrote the release notes', 'A local draft is ready for your review.'], ['Waiting for your decision', 'Creating a draft on GitHub needs separate permission.']] },
    { id: 'screens', title: 'Organize screenshots', device: 'mac', state: 'blocked', progress: 20, detail: 'Moss needs a local unlock to continue.', scope: '/Users/appy/Projects/Orbit/screenshots', tools: 'desktop', time: 15, model: 'Local vision model · Atlas', output: 'Screenshots grouped by product flow', events: [['Workspace selected', 'Supervised desktop in a dedicated user account.'], ['Waiting for local unlock', 'Screen capture and agent input are paused.']] }
  ];
  const state = {
    view: 'home', taskId: 'index', deviceId: 'mac', filter: 'all', stopped: false, approval: 'pending', approvalExpires: null,
    draft: null, homeGoal: '', pairStep: 1, pairOs: 'Linux', paired: false, grantRevoked: false, manual: false, dialog: null,
    events: [
      { time: '10:28', kind: 'task', title: 'Your docs are taking shape', text: 'Atlas indexed 128 engineering documents.' },
      { time: '10:23', kind: 'review', title: 'Release notes are ready for review', text: 'No GitHub draft has been created yet.' },
      { time: '10:17', kind: 'device', title: 'Moss is waiting for an unlock', text: 'Desktop work is paused until the local session is ready.' }
    ]
  };
  const statuses = {
    running: ['In progress', 'running'], review: ['Needs review', 'warning'], blocked: ['Needs unlock', 'warning'],
    queued: ['Waiting for device', 'neutral'], paused: ['Paused', 'neutral'], stopped: ['Stopped', 'neutral'],
    cancelling: ['Stop pending', 'warning'], done: ['Complete', 'success'], denied: ['Draft kept locally', 'neutral']
  };
  const labels = { home: 'Your workspace', tasks: 'Tasks', task: 'Task details', devices: 'Devices', device: 'Device workspace', review: 'Review inbox', connections: 'Connections', activity: 'Activity & safety' };
  let returnFocus = null;
  let toastTimer;

  function log(kind, title, text) {
    state.events.unshift({ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), kind, title, text });
  }
  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    $('toast').classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; $('toast').classList.add('hidden'); }, 5000);
  }
  function heading(eyebrow, title, copy, actions = '') {
    return `<div class="page-heading"><div><h1 tabindex="-1">${escapeHtml(title)}</h1>${copy ? `<p class="lede">${escapeHtml(copy)}</p>` : ''}</div>${actions ? `<div class="row">${actions}</div>` : ''}</div>`;
  }
  function section(title, detail = '', action = '') {
    return `<div class="section-heading"><div><h2>${escapeHtml(title)}</h2>${detail ? `<p>${escapeHtml(detail)}</p>` : ''}</div>${action}</div>`;
  }
  function showDialog(title, kicker, body, footer = '') {
    if (!$('app-dialog').open) returnFocus = document.activeElement;
    $('dialog-title').textContent = title;
    $('dialog-kicker').textContent = kicker;
    $('dialog-body').innerHTML = body;
    $('dialog-footer').innerHTML = footer;
    $('dialog-body').scrollTop = 0;
    if (!$('app-dialog').open) $('app-dialog').showModal();
    requestAnimationFrame(() => {
      const focus = $('dialog-body').querySelector('[autofocus]') || $('dialog-body').querySelector('input:not([type="checkbox"]), textarea, select') || $('dialog-title');
      focus.setAttribute('tabindex', focus.matches('input,textarea,select') ? '0' : '-1');
      focus.focus();
    });
  }
  function closeDialog(restoreFocus = true) {
    if (!restoreFocus) returnFocus = null;
    if ($('app-dialog').open) $('app-dialog').close();
    state.dialog = null;
  }
  $('app-dialog').addEventListener('close', () => {
    if (returnFocus?.isConnected) returnFocus.focus();
    else $('main-content').querySelector('h1')?.focus();
  });
  function navigate(view, id) {
    if (!labels[view]) return;
    state.view = view;
    if (view === 'task') state.taskId = id;
    if (view === 'device') state.deviceId = id;
    render(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('main-content').querySelector('h1')?.focus({ preventScroll: true });
  }
  function deviceStatus(d) {
    if (d.id === 'ipad') return ['Controller', 'neutral'];
    if (!d.reach) return ['Offline', 'neutral'];
    if (d.locked) return ['Needs unlock', 'warning'];
    if (d.id === 'pine' && !d.taskGranted) return ['No access granted', 'neutral'];
    return ['Ready', 'success'];
  }
  function taskRow(t) {
    const [label, tone] = statuses[t.state];
    const d = device(t.device);
    const action = t.state === 'review' ? 'Review' : t.state === 'done' ? 'View result' : 'Open';
    return `<article class="task-row"><span class="task-row-icon">${icon(t.id === 'release' ? 'file' : t.tools === 'desktop' ? 'image' : 'folder')}</span><div class="task-row-copy"><h3><button data-task="${t.id}" class="task-title-button">${escapeHtml(t.title)}</button></h3><p>${escapeHtml(t.detail)}</p></div><div class="task-row-meta">${badge(label, tone)}<span>${escapeHtml(d.name)}</span></div><div class="task-row-action"><button class="btn ghost" data-${t.state === 'review' ? 'action="review-approval"' : `task="${t.id}"`} aria-label="${escapeHtml(action+' '+t.title)}">${action}${icon('arrow')}</button></div></article>`;
  }
  function home() {
    const recentTasks = [...tasks].sort((a, b) => Number(b.state === 'review') - Number(a.state === 'review')).slice(0, 3);
    return `<section class="home-focus">${heading('', 'What would you like to get done?', 'Describe a task, then review the plan.')}<form id="goal-form" class="composer"><div class="composer-top"><label class="sr-only" for="home-goal">Describe your task</label><textarea id="home-goal" name="goal" placeholder="Describe a task…" maxlength="300" required ${state.stopped ? 'disabled' : ''}>${escapeHtml(state.homeGoal)}</textarea></div><div class="composer-footer"><div class="row"><button class="chip device-chip" type="button" data-action="routing">${icon('server')}Best available${icon('chevron')}</button></div><button class="btn primary" type="submit" ${state.stopped ? 'disabled' : ''}>Plan task${icon('arrow')}</button></div></form><details class="examples" data-disclosure="examples"><summary>Try an example</summary><div class="prompt-chips" aria-label="Task suggestions"><button class="chip" data-prompt="Summarize my engineering notes into a concise brief">Summarize notes</button><button class="chip" data-prompt="Find and fix a bug in my Orbit project, then run its tests">Fix a bug</button><button class="chip" data-prompt="Prepare release notes for the next Orbit release">Prepare a release</button></div></details></section><section class="work-section">${section('Recent tasks', '', '<button class="btn ghost" data-view="tasks">View all'+icon('arrow')+'</button>')}<div class="task-list">${recentTasks.map(taskRow).join('')}</div></section>`;
  }
  function taskList() {
    const filtered = tasks.filter(t => state.filter === 'all' || (state.filter === 'active' ? ['running', 'paused', 'queued', 'blocked'].includes(t.state) : state.filter === 'review' ? t.state === 'review' : t.state === 'done'));
    return `${heading('', 'Tasks', 'Track work and review results.', '<button class="btn primary" data-action="new-task" '+(state.stopped ? 'disabled' : '')+'>'+icon('plus')+'New task</button>')}<div class="tabs" aria-label="Filter tasks">${[['all', 'All'], ['active', 'In progress'], ['review', 'Needs review'], ['done', 'Completed']].map(([value, label]) => `<button data-filter="${value}" class="${state.filter === value ? 'active' : ''}" aria-pressed="${state.filter === value}">${label}</button>`).join('')}</div>${filtered.length ? `<div class="task-list">${filtered.map(taskRow).join('')}</div>` : `<div class="empty-state"><h2>No ${state.filter === 'review' ? 'pending reviews' : 'tasks here'}.</h2><button class="btn secondary" data-filter="all">View all tasks</button></div>`}`;
  }
  function facts(entries) {
    return `<dl class="fact-list">${entries.map(([label, value]) => `<div class="fact-row"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  }
  function timeline(t) {
    return `<ol class="timeline">${t.events.map(([title, text], index) => `<li class="timeline-step"><span class="step-dot ${index === t.events.length - 1 && t.state !== 'done' ? 'current' : 'complete'}">${index === t.events.length - 1 && t.state !== 'done' ? index + 1 : icon('check')}</span><div class="step-copy"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div></li>`).join('')}</ol>`;
  }
  function output(t) {
    if (t.id === 'release') return `<div class="output-preview"><span class="small muted">Local draft</span><h3>Orbit v0.8.0</h3><ul><li>Add device readiness indicators.</li><li>Improve offline task recovery.</li><li>Fix duplicate activity entries.</li></ul><div class="file-row">${icon('file')}<span class="grow">release-notes.txt</span><button class="btn ghost" data-download="${t.id}">${icon('download')}Download</button></div></div>`;
    if (t.tools === 'desktop') return `<div class="output-preview"><span class="small muted">${t.state === 'done' ? 'Folder result' : 'Planned folders'}</span>${['Dashboard', 'Device setup', 'Mobile controller'].map(name => `<div class="file-row">${icon('folder')}<span>${name}</span></div>`).join('')}<p class="small muted">${t.state === 'blocked' ? 'Waiting for a local unlock.' : 'Illustrative folder plan.'}</p></div>`;
    return `<div class="output-preview"><span class="small muted">${t.state === 'done' ? 'Local result' : 'Working draft'}</span><h3>${t.id === 'index' ? 'Engineering knowledge index' : escapeHtml(t.output)}</h3><p>${t.state === 'done' ? 'Your sample result is ready.' : 'Organizing the files you selected.'}</p><div class="file-row">${icon('file')}<span class="grow">${t.id === 'index' ? 'engineering-index.txt' : 'task-result.txt'}</span>${t.state === 'done' ? `<button class="btn ghost" data-download="${t.id}">${icon('download')}Download</button>` : badge('In progress', 'running')}</div></div>`;
  }
  function taskDetail() {
    const t = task(state.taskId);
    if (!t) return taskList();
    const d = device(t.device);
    const [label, tone] = statuses[t.state];
    const active = ['running', 'paused', 'blocked', 'queued', 'review'].includes(t.state);
    const action = t.state === 'review' ? '<button class="btn primary" data-action="review-approval">Review draft'+icon('arrow')+'</button>' : t.state === 'running' ? `<button class="btn secondary" data-action="pause-task" data-id="${t.id}">${icon('pause')}Pause task</button>` : t.state === 'paused' ? `<button class="btn primary" data-action="resume-task" data-id="${t.id}" ${state.stopped ? 'disabled' : ''}>${icon('play')}Resume task</button>` : '';
    const readiness = t.state === 'blocked' ? `<div class="info-strip warning">${icon('lock')}<div class="grow"><strong>${escapeHtml(d.name)} needs a local unlock.</strong><p>Desktop work is paused until the session is ready.</p></div><button class="btn secondary" data-device="${d.id}">Open ${escapeHtml(d.name)}${icon('arrow')}</button></div>` : t.state === 'queued' ? `<div class="info-strip warning">${icon('clock')}<div class="grow"><strong>Waiting for ${escapeHtml(d.name)}</strong><p>No execution has started. Resume explicitly after reconnecting.</p></div><button class="btn secondary" data-device="${d.id}">View device</button></div>` : '';
    return `<button class="btn ghost back-button" data-view="tasks">${icon('back')}Tasks</button>${heading('', t.title, t.detail)}<div class="task-detail-flow">${readiness}<section class="panel"><div class="panel-heading"><h2>${t.state === 'done' ? 'Result' : 'Output preview'}</h2>${badge(label, tone)}</div><div class="panel-body">${output(t)}${active ? `<div class="task-actions">${action}<button class="btn danger" data-action="stop-task" data-id="${t.id}">Stop task</button></div>` : ''}</div></section>${t.tools === 'desktop' ? `<div class="info-strip warning">${icon('shield')}<div><strong>Supervised desktop access</strong><p>The dedicated account’s apps, files and signed-in sessions are available. The file-tool folder does not confine native desktop actions.</p>${state.manual && d.id === 'mac' ? '<p>Manual control is active. Agent input remains paused until you return control and resume.</p>' : ''}</div></div>` : '<p class="scope-summary">'+icon('shield')+'Scoped file access. External changes and wider access need review.</p>'}<details class="disclosure" data-disclosure="task-access"><summary>Task access</summary><div class="disclosure-body">${facts([['Execution', `<button class="btn ghost" data-device="${d.id}">${escapeHtml(d.name)}</button>`], ['Inference', escapeHtml(t.model)], ['Tools', t.tools === 'desktop' ? 'Supervised desktop' : t.tools === 'browser' ? 'Browser & scoped files' : 'Scoped files'], ['File-tool folder', `<span class="mono">${escapeHtml(t.scope)}</span>`], ['Time limit', `${t.time} minutes`]])}<button class="btn ghost" data-action="evidence" data-id="${t.id}">View task record${icon('arrow')}</button></div></details><details class="disclosure" data-disclosure="activity"><summary>Activity <span class="muted">${t.events.length} events</span></summary><div class="disclosure-body">${timeline(t)}</div></details>${t.state === 'running' ? `<details class="disclosure" data-disclosure="demo-controls"><summary>Demo controls</summary><div class="disclosure-body"><button class="btn secondary" data-action="advance-task" data-id="${t.id}">${icon('play')}Simulate next step</button></div></details>` : ''}</div>`;
  }
  function deviceCard(d) {
    const [label, tone] = deviceStatus(d);
    return `<article class="device-card ${d.id}"><div class="row between">${badge(label, tone)}<span class="small muted">${escapeHtml(d.os)}</span></div><button class="device-art ${d.icon}" data-device="${d.id}" aria-label="Open ${escapeHtml(d.name)}">${icon(d.icon)}<span class="device-art-glow"></span></button><h2>${escapeHtml(d.name)}</h2><p class="device-type">${escapeHtml(d.type)}</p><p class="device-description">${escapeHtml(d.note)}</p><div class="device-card-footer"><span>${escapeHtml(d.meta)}</span><button class="btn ghost small" data-device="${d.id}">${d.id === 'ipad' ? 'About controller' : d.locked ? 'Help unlock' : !d.reach ? 'Reconnect' : 'Open workspace'}${icon('arrow')}</button></div></article>`;
  }
  function deviceList() {
    return `${heading('', 'Devices', 'Connection status and available capabilities.', '<button class="btn primary" data-action="pair">'+icon('plus')+'Add a device</button>')}<div class="device-grid">${devices.map(deviceCard).join('')}</div>`;
  }
  function deviceDetail() {
    const d = device(state.deviceId);
    if (!d) return deviceList();
    const [label, tone] = deviceStatus(d);
    const isController = d.id === 'ipad';
    const unavailable = d.locked || !d.reach;
    const screen = d.id === 'pine' && !d.taskGranted ? `<div class="screen-placeholder">${icon('shield')}<h2>Connected. Waiting for your first task.</h2><p>Pine’s identity is enrolled. No files, desktop or account access has been granted.</p><button class="btn primary" data-action="pair-first-task" ${state.stopped ? 'disabled' : ''}>Plan a first task${icon('arrow')}</button></div>` : isController ? `<div class="screen-placeholder">${icon('tablet')}<h2>Remote controller</h2><p>Review tasks, make decisions, and control supported remote devices from your iPad.</p></div>` : unavailable ? `<div class="screen-placeholder">${icon(d.locked ? 'lock' : 'laptop')}<h2>${d.locked ? 'A local unlock is needed.' : 'Field is offline.'}</h2><p>${d.locked ? 'Your Mac is connected. Unlock its dedicated account locally to make the desktop available.' : 'The laptop is offline. Open it and connect to the network to restore its session.'}</p>${d.locked ? '<button class="btn secondary" data-action="simulate-unlock">Simulate local unlock</button>' : '<button class="btn secondary" data-action="simulate-reconnect">Simulate reconnect</button>'}</div>` : d.desktop ? `<div class="mock-screen"><div class="mock-screen-bar"><span class="window-dots" aria-hidden="true">● ● ●</span><span>${d.os === 'Windows' ? 'File Explorer' : 'Finder'} — Orbit</span><span>Illustration</span></div><div class="mock-screen-content"><div class="mock-screen-sidebar"><strong>Favorites</strong><span>Projects</span><span>Screenshots</span><span>Downloads</span></div><div class="mock-screen-files">${['dashboard-draft.png', 'device-overview.png', 'mobile-controller.png'].map(name => `<div>${icon('image')}<span>${name}</span></div>`).join('')}</div></div></div>` : `<div class="code-preview"><span class="terminal-label">${escapeHtml(d.name.toUpperCase())} · HEADLESS WORKSPACE</span><pre>worker     ${escapeHtml(d.name.toLowerCase())} / ${escapeHtml(d.os.toLowerCase())}\nmodel      local text model\nworkspace  ${escapeHtml(d.id === 'gpu' ? '/home/river/projects/docs' : defaultPath(d.id))}\n\n<span class="terminal-success">✓</span> ${d.id === 'gpu' ? 'Local inference ready' : 'Inference route: Atlas'}\n<span class="terminal-success">✓</span> Scoped file tools ready\n<span class="terminal-muted">—</span> Desktop capture not enabled</pre></div>`;
    return `<button class="btn ghost small back-button" data-view="devices">${icon('back')}All devices</button>${heading('YOUR DEVICE WORKSPACE', d.name, d.type+' · '+d.meta, badge(label, tone))}<div class="detail-layout"><div class="detail-main"><section class="panel"><div class="panel-heading"><h2>${isController ? 'Controller' : 'Workspace preview'}</h2>${badge('Illustration · not live')}</div><div class="panel-body device-screen-body">${screen}</div>${d.desktop && d.reach && !d.locked ? `<div class="panel-body row between"><span class="small muted">${state.manual && d.id === 'mac' ? 'You have control · agent input paused' : 'Dedicated account · supervised access'}</span>${d.id === 'mac' ? `<button class="btn ${state.manual ? 'primary' : 'secondary'}" data-action="takeover" ${state.stopped ? 'disabled' : ''}>${icon('hand')}${state.manual ? 'End manual control' : 'Take over'}</button>` : ''}</div>` : ''}</section>${d.desktop ? `<div class="info-strip ${d.locked ? 'warning' : ''}">${icon('shield')}<div><strong>${state.manual && d.id === 'mac' ? 'You’re in control. Agent input is paused.' : 'Desktop access uses a dedicated account.'}</strong><p>${state.manual && d.id === 'mac' ? 'Ending manual control leaves agent tasks paused until you explicitly resume. Manual control is not a private-password session.' : 'Native apps can reach the files and signed-in sessions of this account. A file-tool folder does not confine desktop actions.'}</p></div></div>` : ''}${section('Assigned work')}<div class="task-list">${tasks.filter(t => t.device === d.id).map(taskRow).join('') || '<div class="empty-state"><h3>No work assigned.</h3><p>'+(isController ? 'This device is your controller, not an execution worker.' : 'Start a task when you’re ready to grant access.')+'</p></div>'}</div></div><aside class="detail-rail"><section class="panel"><div class="panel-heading"><h2>Capabilities</h2></div><div class="panel-body">${facts([['Connection', d.reach ? 'Connected' : 'Offline'], ['Role', isController ? 'Controller only' : 'Worker'], ['Files', isController ? 'No worker access' : d.id === 'pine' && !d.taskGranted ? 'No grant yet' : d.reach ? 'By task permission' : 'Unavailable'], ['Desktop', isController ? 'Remote viewing only' : !d.desktop ? 'Not enabled' : unavailable ? 'Unavailable' : 'Ready in user session'], ['Administrator', 'No standing access']])}</div></section>${!isController ? `<section class="panel"><div class="panel-heading"><h2>Device controls</h2></div><div class="panel-body stack">${d.id === 'mac' && !d.locked ? '<button class="btn secondary" data-action="simulate-lock">'+icon('lock')+'Simulate screen lock</button>' : ''}<button class="btn danger" data-action="stop-device" data-id="${d.id}">${icon('stop')}Stop device tasks</button><p class="small muted">Stopping work does not undo changes already made.</p></div></section>` : ''}</aside></div>`;
  }
  function review() {
    return `${heading('', 'Needs review', 'Review the change before allowing it.')}<div class="review-focus">${state.approval === 'pending' ? `<section class="panel"><div class="panel-heading"><h2>Create a GitHub draft?</h2>${badge('Needs review', 'warning')}</div><div class="panel-body"><p>One private draft release in <strong>river-lab / orbit</strong>. Nothing has been sent.</p>${output(task('release'))}<div class="task-actions"><button class="btn primary" data-action="review-approval">Review exact action${icon('arrow')}</button></div></div></section>` : `<div class="empty-state"><h2>No pending reviews.</h2><p>${state.approval === 'approved' ? 'Draft creation was approved in this simulation.' : state.approval === 'denied' ? 'The action was denied. Your local notes are retained.' : 'New requests will appear here.'}</p><button class="btn secondary" data-task="release">View release notes${icon('arrow')}</button></div>`}</div>`;
  }
  function connections() {
    return `${heading('', 'Connections', 'Manage account access and local models.')}<div class="connection-grid"><section class="connection-card"><div class="row between"><span class="connection-logo github-logo">${icon('github')}</span>${badge(state.grantRevoked ? 'Revoked' : 'Read only', state.grantRevoked ? 'neutral' : 'success')}</div><h2>GitHub</h2><p class="muted">Release reader · river-lab / orbit</p>${facts([['Allowed', 'Read repository metadata & releases'], ['Used by', 'Release notes task on Atlas'], ['Lifetime', 'Up to 10 minutes'], ['Changes', 'Separate one-use approval required']])}<div class="connection-footer"><button class="btn secondary small" data-action="grant-details">View access details</button><button class="btn danger small" data-action="revoke-grant" ${state.grantRevoked ? 'disabled' : ''}>${state.grantRevoked ? 'Access revoked' : 'Revoke access'}</button></div></section><section class="connection-card"><div class="row between"><span class="connection-logo model-logo">${icon('spark')}</span>${badge('Local', 'success')}</div><h2>Your local models</h2><p class="muted">A private inference route on Atlas</p>${facts([['Text tasks', 'Local text model'], ['Screen context', 'Local vision model'], ['Runs on', 'Atlas · Linux GPU box'], ['Cloud fallback', 'Off']])}<div class="connection-footer"><button class="btn secondary small" data-device="gpu">View Atlas${icon('arrow')}</button></div></section></div><div class="info-strip">${icon('key')}<div><strong>Keep passwords out of task prompts.</strong><p>Grant scoped account access through a connection.</p></div><button class="btn ghost small" data-action="credential-help">How access works${icon('arrow')}</button></div><div class="row wrap utility-links"><button class="btn ghost small" data-view="activity">${icon('clock')}Activity & controls</button><button class="btn ghost small" data-action="about">About this concept</button></div>`;
  }
  function activity() {
    const pending = tasks.filter(t => t.state === 'cancelling');
    return `${heading('', 'Activity & safety', 'Review decisions and stop status.', '<button class="btn secondary" data-action="export-log">'+icon('download')+'Export activity</button>')}<div class="detail-layout"><section class="panel"><div class="panel-heading"><h2>Recent activity</h2><span class="small muted">This demo session</span></div><div class="activity-list">${state.events.map(e => `<article class="activity-row"><span class="activity-icon ${escapeHtml(e.kind)}">${icon(e.kind === 'review' ? 'check' : e.kind === 'device' ? 'monitor' : e.kind === 'safety' ? 'shield' : 'file')}</span><div class="grow"><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.text)}</p></div><time>${escapeHtml(e.time)}</time></article>`).join('')}</div></section><aside class="detail-rail"><section class="panel"><div class="panel-heading"><h2>Workspace safety</h2>${icon('shield')}</div><div class="panel-body">${badge(state.stopped ? 'New work disabled' : 'Ready for reviewed tasks', state.stopped ? 'warning' : 'success')}<p class="small">${state.stopped ? 'Reachable workers acknowledged the stop in this simulation. '+(devices.some(d => !d.reach && d.id !== 'ipad') ? 'Field is unreachable; its acknowledgment remains pending.' : 'All worker connections are available.') : 'Stop all pauses admissions and revokes execution renewals across your workers.'}</p>${pending.length ? '<p class="small">Some task stops await device acknowledgment.</p>' : ''}<p class="small muted">After the last renewal: no new broker actions or input after 30 seconds; managed commands can cause effects until watchdog termination by 35 seconds. Completed changes and detached external jobs are not rolled back.</p><button class="btn danger" data-action="stop-all">${icon('stop')}Stop all work</button>${state.stopped ? '<button class="btn secondary" data-action="reset">Reset demo</button>' : ''}</div></section><section class="panel"><div class="panel-heading"><h2>About this concept</h2></div><div class="panel-body"><p class="small muted">A working interaction prototype with fictional machines and local, temporary state. No device control, credential storage or security enforcement is implemented.</p><button class="btn ghost small" data-action="about">Prototype details${icon('arrow')}</button></div></section></aside></div>`;
  }
  function render(preserveFocus = true) {
    const active = document.activeElement;
    const restore = preserveFocus && ($('main-content').contains(active) || $('global-status').contains(active));
    const focusData = restore ? { ...active.dataset } : {};
    const openDisclosures = preserveFocus ? new Set([...$('main-content').querySelectorAll('details[data-disclosure]')].filter(details => details.open).map(details => details.dataset.disclosure)) : new Set();
    const views = { home, tasks: taskList, task: taskDetail, devices: deviceList, device: deviceDetail, review, connections, activity };
    $('main-content').innerHTML = views[state.view]();
    if (preserveFocus) $('main-content').querySelectorAll('details[data-disclosure]').forEach(details => { details.open = openDisclosures.has(details.dataset.disclosure); });
    $('breadcrumb').textContent = labels[state.view];
    const pending = state.approval === 'pending' ? 1 : 0;
    $('review-count').textContent = pending;
    $('review-count').hidden = !pending;
    $('task-count').textContent = tasks.filter(t => !['done', 'stopped', 'denied'].includes(t.state)).length;
    $('device-count').textContent = devices.length;
    document.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === state.view || (state.view === 'task' && button.dataset.view === 'tasks') || (state.view === 'device' && button.dataset.view === 'devices');
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-action="new-task"]').forEach(button => { button.disabled = state.stopped; });
    const offline = devices.some(d => d.id !== 'ipad' && !d.reach);
    $('global-status').innerHTML = state.stopped ? `<div class="info-strip warning global-stop"><span>${icon('stop')}</span><div class="grow"><strong>Stop requested. New work is disabled.</strong><p>${offline ? 'Reachable workers acknowledged. Field is offline, so its stop is not confirmed.' : 'All workers acknowledged in this simulation.'} Changes already made are not undone.</p></div><button class="btn secondary small" data-view="activity">View status${icon('arrow')}</button></div>` : '';
    if (restore && !active.isConnected) {
      const keys = Object.keys(focusData);
      const replacement = keys.length ? [...$('main-content').querySelectorAll('button'), ...$('global-status').querySelectorAll('button')].find(button => keys.every(key => button.dataset[key] === focusData[key])) : null;
      const target = replacement && !replacement.disabled ? replacement : $('main-content').querySelector('h1');
      for (let ancestor = target?.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor.tagName === 'DETAILS') ancestor.open = true;
      }
      target?.focus({ preventScroll: true });
    }
  }
  function defaultPath(id) {
    if (id === 'pine') return device('pine')?.os === 'Windows' ? 'C:\\Users\\Appy\\Projects' : device('pine')?.os === 'macOS' ? '/Users/appy/Projects' : '/home/appy/projects';
    return { gpu: '/home/river/projects/notes', mac: '/Users/appy/Projects/notes', windows: 'C:\\Users\\River\\Projects\\notes' }[id];
  }
  function openPlan(goal = '') {
    if (!goal && !state.draft) goal = state.homeGoal;
    if (state.stopped) { toast('Reset the demo from Activity to start new work.'); return; }
    state.dialog = 'plan';
    const existing = state.draft;
    const draft = existing || { title: goal, device: 'gpu', tools: 'files', scope: defaultPath('gpu'), time: 15, output: 'A concise result saved in your selected folder' };
    showDialog('Plan task', 'NEW TASK · 1 OF 2', `<form id="plan-form" novalidate><div class="field"><label for="task-goal">What would you like to get done?</label><textarea id="task-goal" name="goal" maxlength="300" required autofocus placeholder="Describe a goal, and the result you want.">${escapeHtml(goal || draft.title)}</textarea></div><div class="review-plan"><div class="plan-step"><span>1</span><div><h3>Read selected files</h3><p>Use the workspace and tools you approve.</p></div></div><div class="plan-step"><span>2</span><div><h3>Run on your device</h3><p>Process the task with a local model.</p></div></div><div class="plan-step"><span>3</span><div><h3>Save the result</h3><p>Keep output local. Review external changes.</p></div></div></div><div class="info-strip"><span>${icon('server')}</span><div><strong id="route-title">${escapeHtml(device(draft.device).name)} is suggested for this work.</strong><p id="route-note">${draft.device === 'gpu' ? 'Ready for scoped files and code. Inference stays on Atlas.' : 'The selected device will be checked before the task starts.'}</p></div></div><details class="advanced"><summary>Adjust device & access <span class="small muted">Optional</span></summary><div class="field-grid"><div class="field"><label for="task-device">Execution device</label><select id="task-device">${devices.filter(d => d.id !== 'ipad').map(d => `<option value="${d.id}" ${draft.device === d.id ? 'selected' : ''}>${escapeHtml(d.name)} · ${escapeHtml(d.type)}${!d.reach ? ' (offline)' : d.locked ? ' (desktop locked)' : ''}</option>`).join('')}</select></div><div class="field"><label for="task-tools">Tools</label><select id="task-tools">${[['files', 'Scoped file tools'], ['browser', 'Browser + scoped file tools'], ['desktop', 'Supervised desktop']].map(([value, label]) => `<option value="${value}" ${draft.tools === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div></div><div class="field"><label for="task-scope">File-tool folder</label><input id="task-scope" value="${escapeHtml(draft.scope)}" required maxlength="200"><span class="small muted">Native desktop apps are not confined to this folder.</span></div><div class="field"><label for="task-time">Time limit</label><select id="task-time">${[15, 30, 60].map(time => `<option value="${time}" ${Number(draft.time) === time ? 'selected' : ''}>${time} minutes</option>`).join('')}</select></div></details><p id="plan-error" class="form-error" role="alert"></p></form>`, '<button class="btn secondary" data-action="close-dialog">Cancel</button><button class="btn primary" type="submit" form="plan-form">Review & continue'+icon('arrow')+'</button>');
  }
  function validateDraft(draft) {
    const d = device(draft.device);
    if (!draft.title.trim() || !draft.scope.trim()) return 'Add a goal and a file-tool folder.';
    if (!d || d.id === 'ipad') return 'Choose an execution worker. Canvas is a controller.';
    if (draft.tools === 'desktop' && !d.desktop) return `${d.name} is a headless worker. Choose Moss or Field for desktop work.`;
    if (state.stopped) return 'New work is disabled while Stop all is active.';
    return '';
  }
  function confirmPlan() {
    const draft = state.draft;
    const d = device(draft.device);
    state.dialog = 'confirm';
    const readiness = !d.reach ? ['This task will wait for '+d.name+'.', 'No execution starts while it is offline. Review and resume after reconnect.'] : draft.tools === 'desktop' && d.locked ? ['Moss needs a local unlock.', 'The task will stay blocked until the desktop is ready and you resume it.'] : draft.tools === 'desktop' && state.manual && d.id === 'mac' ? ['You currently have manual control.', 'The agent task will stay paused until you end manual control and explicitly resume.'] : ['Ready to start.', 'Review the access below before starting.'];
    showDialog('Review task access', 'NEW TASK · 2 OF 2', `<h3 class="plan-goal">${escapeHtml(draft.title)}</h3><div class="info-strip ${!d.reach || (draft.tools === 'desktop' && d.locked) ? 'warning' : ''}">${icon(!d.reach ? 'clock' : 'check')}<div><strong>${escapeHtml(readiness[0])}</strong><p>${escapeHtml(readiness[1])}</p></div></div>${facts([['Expected result', escapeHtml(draft.output)], ['Execute on', escapeHtml(d.name+' · '+d.type)], ['Inference', 'Local model on Atlas · no cloud fallback'], ['Tools', draft.tools === 'desktop' ? 'Supervised dedicated-account desktop' : draft.tools === 'browser' ? 'Browser & scoped file tools' : 'Scoped file tools'], ['File-tool folder', `<span class="mono">${escapeHtml(draft.scope)}</span>`], ['Time & budget', `${draft.time} minutes · up to 40 actions`], ['External changes', 'Review external writes, destructive actions, credential use or wider access'], ['Accounts', 'None granted']])}${draft.tools === 'desktop' ? '<div class="info-strip warning">'+icon('alert')+'<div><strong>Desktop access is broader than this folder.</strong><p>Native apps use the dedicated account’s files, signed-in sessions and network access. Keep this mode supervised.</p></div></div>' : '<p class="small muted">Network destinations need a separate grant. The selected folder is the file-tool boundary.</p>'}`, '<button class="btn secondary" data-action="edit-plan">'+icon('back')+'Edit plan</button><button class="btn primary" data-action="start-task">'+(!d.reach ? 'Queue task' : draft.tools === 'desktop' && d.locked ? 'Create waiting task' : 'Start task')+icon('arrow')+'</button>');
  }
  function startTask() {
    if (!state.draft) return;
    const draft = state.draft;
    const problem = validateDraft(draft);
    if (problem) { toast(problem); return; }
    const d = device(draft.device);
    const next = !d.reach ? 'queued' : draft.tools === 'desktop' && d.locked ? 'blocked' : draft.tools === 'desktop' && state.manual && d.id === 'mac' ? 'paused' : 'running';
    const t = { ...draft, id: 'task-'+Date.now(), state: next, progress: 0, model: `${draft.tools === 'desktop' ? 'Local vision' : 'Local text'} model · Atlas`, detail: next === 'queued' ? 'Waiting for the device to reconnect.' : next === 'blocked' ? 'A local unlock is needed before desktop work.' : next === 'paused' ? 'Waiting for you to return control and resume.' : 'Getting the right context together.', events: [['You reviewed the plan', `Access granted to ${d.name} for this task, within the selected mode.`], [next === 'running' ? 'Starting with your context' : 'Waiting for device readiness', next === 'running' ? 'Local simulation started. No real machine is being controlled.' : 'No execution has started.']] };
    tasks.unshift(t);
    if (d.id === 'pine') { d.taskGranted = true; d.note = 'Ready for explicitly granted file-tool tasks'; }
    log('task', 'A new task is ready', t.title+' · '+d.name);
    state.draft = null;
    state.homeGoal = '';
    closeDialog();
    navigate('task', t.id);
    toast(next === 'running' ? 'Task started in this interactive concept.' : 'Task created. It will wait for a ready device.');
  }
  function openApproval() {
    if (state.approval !== 'pending' || state.stopped) { toast('This action is no longer awaiting a decision.'); return; }
    state.dialog = 'approval';
    if (!state.approvalExpires) state.approvalExpires = Date.now() + 300000;
    const expires = new Date(state.approvalExpires).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const expired = Date.now() >= state.approvalExpires;
    showDialog('Create private release draft?', 'GitHub · one action', `${expired ? '<div class="info-strip warning"><div><strong>This request has expired.</strong><p>Request a fresh review of the unchanged content before deciding.</p></div></div>' : ''}<p>Create one draft release in the private repository <strong>river-lab / orbit</strong>. It stays unpublished. No code will be pushed.</p>${facts([['Account', 'river-lab release writer'], ['Release', 'v0.8.0 · existing tag'], ['Valid until', escapeHtml(expires)]])}<div class="output-preview"><h3>Release notes</h3><pre class="plain-preview">${escapeHtml(releaseBody)}</pre></div><p class="small muted">One use, bound to this request. The existing read-only connection cannot authorize this write.</p><details class="advanced"><summary>Request details</summary>${facts([['Task & worker', 'Prepare release notes · Atlas'], ['Destination', '<span class="mono">POST https://api.github.com/repos/river-lab/orbit/releases</span>'], ['Title', 'v0.8.0 release notes'], ['Visibility', 'draft: true · prerelease: false · visible to repository collaborators'], ['Binding', 'Exact content, destination, worker and task. Changes require a fresh review.'], ['Authorization', 'Separate one-use write capability · five-minute review window']])}<button class="btn secondary small" data-action="simulate-expiry" ${expired ? 'disabled' : ''}>Simulate expired request</button></details>`, `<button class="btn secondary" data-action="deny-approval">Deny action</button>${expired ? '<button class="btn primary" data-action="refresh-approval">Review fresh request</button>' : '<button class="btn primary" data-action="approve-once">Create draft once'+icon('check')+'</button>'}`);
  }
  function resolveApproval(approved) {
    if (state.approval !== 'pending' || state.stopped) { closeDialog(); toast('This request is no longer available.'); return; }
    if (approved && (!state.approvalExpires || Date.now() >= state.approvalExpires)) { openApproval(); toast('This review expired. Check the fresh request before approving.'); return; }
    state.approval = approved ? 'approved' : 'denied';
    const t = task('release');
    t.state = approved ? 'done' : 'denied';
    t.progress = approved ? 100 : 80;
    t.detail = approved ? 'GitHub draft creation simulated. Release notes are ready.' : 'No external change. Your local notes are still here.';
    t.events.push([approved ? 'You approved one draft creation' : 'You kept the draft local', approved ? 'One exact action simulated. The one-use approval is consumed.' : 'No GitHub request was made.']);
    log('review', approved ? 'Draft creation approved once' : 'Draft creation denied', 'Orbit v0.8.0 · '+(approved ? 'Simulated action; no real request sent.' : 'Local release notes retained.'));
    closeDialog(); render();
    toast(approved ? 'Decision recorded. Draft creation simulated.' : 'Action denied. Your local draft is safe to review.');
  }
  function pair() {
    state.dialog = 'pair';
    const stepper = `<div class="pair-stepper">${['Choose device', 'Verify identity', 'Ready to connect'].map((label, index) => `<div class="pair-step ${state.pairStep === index + 1 ? 'active' : state.pairStep > index + 1 ? 'complete' : ''}"><span>${state.pairStep > index + 1 ? icon('check') : index + 1}</span><small>${label}</small></div>`).join('')}</div>`;
    if (state.pairStep === 1) {
      showDialog('Add a device', 'ADD A DEVICE · 1 OF 3', `${stepper}<p>Choose the operating system of the new worker.</p><div class="pair-os-grid">${[['Linux', 'server'], ['macOS', 'monitor'], ['Windows', 'laptop']].map(([os, image]) => `<button class="pair-os ${state.pairOs === os ? 'selected' : ''}" data-pair-os="${os}" aria-pressed="${state.pairOs === os}">${icon(image)}<strong>${os}</strong>${state.pairOs === os ? icon('check') : ''}</button>`).join('')}</div><div class="info-strip">${icon('download')}<div><strong>Open the Appy worker on that machine.</strong><p>Production setup will use a signed installer. This concept simulates an already-open worker.</p></div></div>`, '<button class="btn secondary" data-action="close-dialog">Cancel</button><button class="btn primary" data-action="pair-next">Worker is open'+icon('arrow')+'</button>');
    } else if (state.pairStep === 2) {
      showDialog('Verify device', 'ADD A DEVICE · 2 OF 3', `${stepper}<p>Match the code and device fingerprint shown locally in the worker.</p><div class="pair-code">LIME <strong>4826</strong></div><span class="sample-caption">Demo code · intended validity: 5 minutes</span>${facts([['New device', 'Pine · '+escapeHtml(state.pairOs)+' worker'], ['Fingerprint', '<span class="mono">DEMO 3F91 A02C 7D45 88B2</span>'], ['Starting access', 'None · you grant access per task']])}<label class="pair-confirm"><input id="pair-confirm" type="checkbox"><span>The code and fingerprint match the simulated worker.</span></label>`, '<button class="btn secondary" data-action="pair-back">'+icon('back')+'Back</button><button id="pair-finish" class="btn primary" data-action="pair-enroll" disabled>Confirm identity'+icon('check')+'</button>');
    } else {
      showDialog('Device added', 'ADD A DEVICE · 3 OF 3', `${stepper}<div class="pair-success">${icon('check')}<h3>Identity confirmed.</h3><p>Your new worker is enrolled in this simulation. Files, screen control and account access are still off.</p></div><div class="info-strip">${icon('shield')}<div><strong>Grant access with the first task.</strong><p>Pairing never grants blanket control. Any OS permissions must be granted separately on the device.</p></div></div>`, '<button class="btn secondary" data-action="pair-done">View devices</button><button class="btn primary" data-action="pair-first-task" '+(state.stopped ? 'disabled' : '')+'>Plan a first task'+icon('arrow')+'</button>');
    }
  }
  function stopTasks(items, global = false) {
    items.forEach(t => {
      if (['done', 'stopped', 'denied'].includes(t.state)) return;
      const d = device(t.device);
      t.state = d.reach ? 'stopped' : 'cancelling';
      t.detail = d.reach ? 'Stop acknowledged in this simulation.' : 'Stop requested. Device acknowledgment pending.';
      t.events.push(['Stop requested', t.detail]);
      if (t.id === 'release' && state.approval === 'pending') state.approval = 'cancelled';
    });
    if (global) { state.stopped = true; state.manual = false; }
  }
  function stopAll() {
    if (!state.stopped) {
      stopTasks(tasks, true);
      log('safety', 'Stop requested across your workspace', 'Reachable workers acknowledged. '+(devices.some(d => !d.reach && d.id !== 'ipad') ? 'Field is offline; its actual state remains unverified until reconnect.' : 'No worker is currently unreachable.'));
    }
    closeDialog(); render();
    toast('New work disabled. Open Activity for worker stop status.');
  }
  function resume(t) {
    const d = device(t.device);
    if (t.state !== 'paused' || state.stopped || !d.reach || (t.tools === 'desktop' && (d.locked || !d.desktop || (d.id === 'mac' && state.manual)))) {
      toast('This task cannot resume until its device and control state are ready.'); return;
    }
    t.state = 'running'; t.detail = 'Picking up within the access you reviewed.';
    t.events.push(['You resumed the task', 'Readiness checked; the original scope is unchanged.']);
    log('task', 'Task resumed', t.title); render();
  }
  function download(name, content, type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Your sample file is ready to download.');
  }
  function downloadTask(t) {
    if (!t || (t.state !== 'done' && t.id !== 'release')) { toast('The result is not ready yet.'); return; }
    download(t.id === 'release' ? 'orbit-release-notes.txt' : 'appy-task-result.txt', `Appy interactive concept — illustrative output\nNo real machine or external service was used.\n\n${t.id === 'release' ? releaseBody : t.title+'\n\n'+t.output+'\n\n1. Review the source material.\n2. Group related findings.\n3. Save a concise local result.'}\n\nDevice: ${device(t.device).name}\nScope: ${t.scope}\n`);
  }
  function searchDialog(query = '') {
    state.dialog = 'search';
    showDialog('Search', 'SEARCH YOUR WORKSPACE', `<div class="field"><label for="workspace-search">Tasks or devices</label><input id="workspace-search" type="search" value="${escapeHtml(query)}" placeholder="Try “release” or “Atlas”" autocomplete="off" autofocus></div><div id="search-results"></div>`, '<span class="small muted">Esc to close</span>');
    searchResults(query);
  }
  function searchResults(query) {
    const q = query.trim().toLowerCase();
    const resultTasks = tasks.filter(t => `${t.title} ${t.detail}`.toLowerCase().includes(q));
    const resultDevices = devices.filter(d => `${d.name} ${d.type}`.toLowerCase().includes(q));
    $('search-results').innerHTML = `${resultTasks.map(t => `<button class="search-result" data-search-task="${t.id}">${icon('file')}<span class="grow"><strong>${escapeHtml(t.title)}</strong><small>Task · ${escapeHtml(statuses[t.state][0])}</small></span>${icon('arrow')}</button>`).join('')}${resultDevices.map(d => `<button class="search-result" data-search-device="${d.id}">${icon(d.icon)}<span class="grow"><strong>${escapeHtml(d.name)}</strong><small>${escapeHtml(d.type)}</small></span>${icon('arrow')}</button>`).join('')}${!resultTasks.length && !resultDevices.length ? '<div class="empty-state"><h3>No matches yet.</h3><p>Try a device name or a shorter task title.</p></div>' : ''}`;
  }
  function info(title, body) {
    state.dialog = 'info'; showDialog(title, 'YOUR WORKSPACE', body, '<button class="btn primary" data-action="close-dialog">Got it</button>');
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.view) { navigate(button.dataset.view); return; }
    if (button.dataset.task) { navigate('task', button.dataset.task); return; }
    if (button.dataset.device) { navigate('device', button.dataset.device); return; }
    if (button.dataset.searchTask) { closeDialog(false); navigate('task', button.dataset.searchTask); return; }
    if (button.dataset.searchDevice) { closeDialog(false); navigate('device', button.dataset.searchDevice); return; }
    if (button.dataset.download) { downloadTask(task(button.dataset.download)); return; }
    if (button.dataset.filter) { state.filter = button.dataset.filter; render(); return; }
    if (button.dataset.prompt) { state.draft = null; openPlan(button.dataset.prompt); return; }
    if (button.dataset.pairOs) { state.pairOs = button.dataset.pairOs; pair(); return; }
    const t = button.dataset.id ? task(button.dataset.id) : null;
    switch (button.dataset.action) {
      case 'close-dialog': closeDialog(); break;
      case 'new-task': state.draft = null; openPlan(); break;
      case 'edit-plan': openPlan(); break;
      case 'start-task': startTask(); break;
      case 'routing': info('Device routing', '<p>Appy suggests Atlas for file and code work because it is ready and hosts your local models.</p><p>You can change the execution device and tools in your task plan. A device switch always appears in the review before you start.</p><div class="info-strip">'+icon('shield')+'<div><strong>Inference stays local.</strong><p>There is no cloud fallback in this workspace.</p></div></div>'); break;
      case 'search': searchDialog(); break;
      case 'review-approval': openApproval(); break;
      case 'approve-once': resolveApproval(true); break;
      case 'deny-approval': resolveApproval(false); break;
      case 'refresh-approval': state.approvalExpires = Date.now() + 300000; openApproval(); break;
      case 'simulate-expiry': state.approvalExpires = Date.now() - 1; openApproval(); break;
      case 'pause-task':
        if (t?.state !== 'running') break;
        t.state = 'paused'; t.detail = 'Paused by you. Ready to start.';
        t.events.push(['You paused the task', 'No new actions admitted; a current atomic action may finish.']);
        log('task', 'Task paused', t.title); render(); toast('Task paused in this simulation.'); break;
      case 'resume-task': if (t) resume(t); break;
      case 'advance-task':
        if (!t || t.state !== 'running' || state.stopped) break;
        if (t.tools === 'desktop' && (device(t.device).locked || !device(t.device).reach || (t.device === 'mac' && state.manual))) { toast('Desktop readiness changed. The task cannot proceed.'); break; }
        t.progress = Math.min(100, t.progress + 38);
        t.state = t.progress === 100 ? 'done' : 'running';
        t.detail = t.state === 'done' ? 'Your sample result is ready.' : 'Working through the next part of your task.';
        t.events.push([t.state === 'done' ? 'Your sample result is ready' : 'Another step completed', t.state === 'done' ? 'An illustrative local artifact is available to download.' : 'A bounded processing step was simulated.']);
        log('task', t.state === 'done' ? 'Task completed in the simulation' : 'Task moved forward', t.title); render(); toast(t.detail); break;
      case 'stop-task': if (t) { stopTasks([t]); log('safety', 'Task stop requested', t.title); render(); toast(t.detail); } break;
      case 'stop-device': {
        const d = device(button.dataset.id);
        stopTasks(tasks.filter(item => item.device === d.id));
        log('safety', 'Device tasks stopped: '+d.name, d.reach ? 'Acknowledged in this simulation.' : 'Device unreachable; cancellation acknowledgment pending.');
        render(); toast(d.reach ? 'Device stop acknowledged in this simulation.' : 'Device unreachable. Stop acknowledgment is pending.'); break;
      }
      case 'stop-all': stopAll(); break;
      case 'simulate-unlock': {
        const d = device('mac'); d.locked = false; d.note = 'Ready for supervised desktop work';
        tasks.filter(item => item.device === 'mac' && item.state === 'blocked').forEach(item => { item.state = 'paused'; item.detail = 'Desktop ready. Resume when you’re ready.'; });
        log('device', 'Moss was unlocked locally', 'Desktop ready in the simulation. Tasks remain paused until you resume.'); render(); toast('Moss is ready. Resume its task when you’re ready.'); break;
      }
      case 'simulate-lock': {
        const d = device('mac'); d.locked = true; d.note = 'Connected · desktop needs a local unlock'; state.manual = false;
        tasks.filter(item => item.device === 'mac' && item.tools === 'desktop' && ['running', 'paused'].includes(item.state)).forEach(item => { item.state = 'blocked'; item.detail = 'Moss needs a local unlock to continue.'; });
        log('device', 'Moss desktop locked', 'Desktop input paused and manual control ended.'); render(); break;
      }
      case 'simulate-reconnect': {
        const d = device('windows'); d.reach = true; d.meta = 'Reconnected just now'; d.note = state.stopped ? 'Connected · global stop applied' : 'Connected · ready for reviewed work';
        tasks.filter(item => item.device === 'windows').forEach(item => {
          if (item.state === 'cancelling') { item.state = 'stopped'; item.detail = 'Stop acknowledged after reconnect.'; }
          else if (item.state === 'queued') { item.state = 'paused'; item.detail = 'Device ready. Review and resume the task.'; }
        });
        log('device', 'Field reconnected', state.stopped ? 'Global cancellation acknowledged. No tasks resumed.' : 'Queued work requires explicit resume.'); render(); toast('Field reconnected. No task starts automatically.'); break;
      }
      case 'takeover': {
        const d = device('mac');
        if (state.stopped || d.locked || !d.reach) { toast('The desktop is not ready for manual control.'); break; }
        state.manual = !state.manual;
        if (state.manual) tasks.filter(item => item.device === 'mac' && item.state === 'running' && item.tools === 'desktop').forEach(item => { item.state = 'paused'; item.detail = 'You have manual control. Agent input is paused.'; });
        log('device', state.manual ? 'You took control of Moss' : 'Manual control ended', state.manual ? 'Agent input paused before the simulated handoff.' : 'Tasks remain paused until explicitly resumed.'); render(); toast(state.manual ? 'You have control. Agent input is paused.' : 'Manual control ended. Resume tasks explicitly.'); break;
      }
      case 'pair':
        if (state.paired) {
          showDialog('Device already paired', 'DEMO DEVICE', '<p>This concept includes one additional enrollment to explore. Pine’s identity is already paired; its permissions are still granted separately for each task.</p>', '<button class="btn secondary" data-action="close-dialog">Close</button><button class="btn primary" data-action="pair-done">View devices'+icon('arrow')+'</button>');
        } else { state.pairStep = 1; pair(); }
        break;
      case 'pair-next': state.pairStep = 2; pair(); break;
      case 'pair-back': state.pairStep = 1; pair(); break;
      case 'pair-enroll':
        if (!$('pair-confirm')?.checked) break;
        if (!state.paired) { devices.push({ id: 'pine', name: 'Pine', type: state.pairOs+' worker', os: state.pairOs, icon: state.pairOs === 'Windows' ? 'laptop' : 'server', meta: 'Identity verified · demo', reach: true, locked: false, desktop: false, note: 'Paired. No task or desktop access granted.' }); state.paired = true; log('device', 'Pine joined the workspace', 'Device identity confirmed in the simulation. No access granted.'); }
        state.pairStep = 3; render(); pair(); break;
      case 'pair-done': closeDialog(); navigate('devices'); break;
      case 'pair-first-task': state.draft = { title: '', device: 'pine', tools: 'files', scope: defaultPath('pine'), time: 15, output: 'A concise result saved in your selected folder' }; openPlan(); break;
      case 'revoke-grant':
        state.grantRevoked = true; log('safety', 'GitHub read access revoked', 'No new read requests can use this grant. Previous effects are unchanged.'); render(); toast('Read access revoked in this simulation.'); break;
      case 'grant-details': info('Connection access', facts([['Account reference', '<span class="mono">vault://personal/github/orbit-read</span>'], ['Destination', '<span class="mono">https://api.github.com/repos/river-lab/orbit/*</span>'], ['Methods', 'GET only'], ['Bound to', 'Release notes task · Atlas'], ['Expiry', '10-minute maximum; shorter task lease applies'], ['Redirects', 'Denied'], ['Secret visibility', 'Reference only; no raw credential in this interface']])+'<p class="small muted">Creating a release draft requires a separate one-use write grant. An approved destination alone does not prevent every possible data leak.</p>'); break;
      case 'credential-help': info('Credential access', '<p>Use a scoped account connection where possible. The intended credential broker attaches credentials to permitted requests outside model context.</p><h3>When a person needs to sign in</h3><p>A private login requires a separate human-only channel with agent observation, recording, DOM access, clipboard and inference paused. If the adapter cannot enforce that separation, sign in locally.</p><p class="small muted">Normal manual takeover only pauses input. It is not a private-password session. These protections are proposed and are not implemented in this concept.</p>'); break;
      case 'evidence': if (t) info('Task record', facts([['Task', escapeHtml(t.title)], ['State', escapeHtml(statuses[t.state][0])], ['Device', escapeHtml(device(t.device).name)], ['File-tool scope', '<span class="mono">'+escapeHtml(t.scope)+'</span>'], ['Desktop authority', t.tools === 'desktop' ? 'Supervised dedicated account; not path-confined' : 'None'], ['Credential values', 'None displayed'], ['Evidence', 'Simulated events; not a real worker execution trace']])+'<div class="code-preview"><pre>'+escapeHtml(JSON.stringify({ simulation: true, task: t.id, progress: t.progress, events: t.events.length }, null, 2))+'</pre></div>'); break;
      case 'download-sample': download('appy-weekly-brief-sample.txt', 'Appy — Weekly brief sample\n\nIllustrative output only. No real files were read.\n\nThis week\n• Engineering notes organized into a searchable index.\n• Release draft prepared for review.\n• Product screenshots ready to group by flow.\n\nNext up\nReview the release draft and unlock Moss to continue.\n'); break;
      case 'export-log': download('appy-demo-activity.json', JSON.stringify({ simulation: true, exported_at: new Date().toISOString(), events: state.events }, null, 2), 'application/json'); break;
      case 'about': info('About Appy', '<p>Appy is a proposed open-source workspace for bounded agent work across your personal devices.</p><p>This interactive concept uses fictional devices, accounts, screens and task outputs. State stays in memory and resets when you refresh. No device agents, credential storage, authorization enforcement or backend are implemented.</p><p>No network requests, remote assets, analytics or real credentials are used. Downloads contain only synthetic output or this simulated activity.</p><p>Security boundaries are design goals, not a guarantee. Ordinary desktop access inherits the user account’s authority. Emergency stops do not roll back completed effects.</p>'); break;
      case 'reset': location.reload(); break;
    }
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'goal-form') {
      event.preventDefault(); state.draft = null; openPlan($('home-goal').value.trim());
    } else if (event.target.id === 'plan-form') {
      event.preventDefault();
      const draft = { title: $('task-goal').value.trim(), device: $('task-device').value, tools: $('task-tools').value, scope: $('task-scope').value.trim(), time: Number($('task-time').value), output: 'A concise result saved in your selected folder' };
      const error = validateDraft(draft);
      ['task-goal', 'task-scope', 'task-device', 'task-tools'].forEach(id => { $(id).removeAttribute('aria-invalid'); $(id).removeAttribute('aria-describedby'); });
      if (error) {
        $('plan-error').textContent = error;
        const invalid = !draft.title ? $('task-goal') : !draft.scope ? $('task-scope') : $('task-tools');
        invalid.setAttribute('aria-invalid', 'true');
        invalid.setAttribute('aria-describedby', 'plan-error');
        invalid.insertAdjacentElement('afterend', $('plan-error'));
        const disclosure = invalid.closest('details');
        if (disclosure) disclosure.open = true;
        invalid.focus();
        return;
      }
      state.draft = draft; confirmPlan();
    }
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'pair-confirm') $('pair-finish').disabled = !event.target.checked;
    if (event.target.id === 'task-device') {
      const d = device(event.target.value); $('task-scope').value = defaultPath(d.id);
      $('route-title').textContent = d.name+' will handle execution.';
      $('route-note').textContent = !d.reach ? 'Offline. Work will queue until you reconnect and resume.' : d.locked ? 'Connected. Desktop tasks need a local unlock; file tools can still be reviewed.' : 'The selected device will be checked before work starts. Inference stays on Atlas.';
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'workspace-search') searchResults(event.target.value);
    if (event.target.id === 'home-goal') state.homeGoal = event.target.value;
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (!$('app-dialog').open) searchDialog(); }
    if (event.key === 'Escape' && $('app-dialog').open) { event.preventDefault(); closeDialog(); }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && event.target.id === 'home-goal') { event.preventDefault(); $('goal-form').requestSubmit(); }
  });
  render();
})();
