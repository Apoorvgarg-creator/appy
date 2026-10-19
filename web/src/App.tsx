import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ControllerSession, ControlAction, CreateTask, Task, TaskAction, Workspace } from './generated/api';
import { api, RequestError } from './api';
import { MobileAccess } from './MobileAccess';

type Page = 'home' | 'tasks' | 'activity' | 'runner';
type Route = { page: Page | 'task' | 'access'; id?: string };
type DialogState = { type: 'plan' | 'approval'; taskId: string } | { type: 'stop' } | null;
type Notice = { message: string; retry?: () => void };
type IconName = 'home' | 'tasks' | 'activity' | 'runner' | 'arrow' | 'close' | 'stop' | 'check' | 'download';

const labels: Record<Task['status'], string> = {
  draft: 'Ready to start', queued: 'Queued', running: 'In progress', waiting_approval: 'Needs review',
  paused: 'Paused', succeeded: 'Complete', cancelled: 'Cancelled', failed: 'Failed',
};
const terminal = new Set<Task['status']>(['succeeded', 'cancelled', 'failed']);
const pageLabels: Record<Route['page'], string> = {
  home: 'Your workspace', tasks: 'Tasks', activity: 'Activity', runner: 'Mac runner', task: 'Task details', access: 'Mobile access',
};
const navigation: { page: Page; icon: IconName; title: string }[] = [
  { page: 'home', icon: 'home', title: 'Home' },
  { page: 'tasks', icon: 'tasks', title: 'Tasks' },
  { page: 'activity', icon: 'activity', title: 'Activity' },
  { page: 'runner', icon: 'runner', title: 'Runner' },
];

function readRoute(): Route {
  if (typeof window === 'undefined') return { page: 'home' };
  const [page, id] = window.location.hash.slice(1).split('/');
  if (page === 'access') return { page };
  if (page === 'task' && id && /^[a-zA-Z0-9_-]{1,80}$/.test(id)) return { page, id };
  if (navigation.some((item) => item.page === page)) return { page: page as Page };
  return { page: 'home' };
}

function Icon({ name }: { name: IconName }) {
  const shapes: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" /></>,
    tasks: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    runner: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 10h16M8 7h.01M8 15h.01M8 18h8" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
    check: <path d="m5 12 4 4L19 6" />,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{shapes[name]}</svg>;
}

function Button({ children, primary = false, danger = false, className = '', ...props }: React.ComponentProps<'button'> & { primary?: boolean; danger?: boolean }) {
  return <button type="button" className={`btn ${primary ? 'primary' : ''} ${danger ? 'danger' : ''} ${className}`} {...props}>{children}</button>;
}

function Status({ task }: { task: Task }) {
  return <span className={`status status-${task.status}`}><span className="status-dot" />{labels[task.status]}</span>;
}

function time(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateTime(value: string) {
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ErrorNotice({ notice, disabled }: { notice: Notice; disabled?: boolean }) {
  return <div className="notice error" role="alert"><p>{notice.message}</p>{notice.retry && <Button disabled={disabled} onClick={notice.retry}>Retry</Button>}</div>;
}

function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty"><Icon name="tasks" /><h2>{title}</h2><p>{children}</p>{action}</div>;
}

function TaskRows({ tasks, open }: { tasks: Task[]; open: (id: string) => void }) {
  return <ul className="task-list">{tasks.map((task) => <li key={task.id} className="task-row">
    <div className="task-row-copy"><button className="task-title" onClick={() => open(task.id)}>{task.goal}</button><p>{task.summary}</p><Status task={task} /></div>
    <Button onClick={() => open(task.id)} aria-label={`Open task: ${task.goal}`}>{task.status === 'waiting_approval' ? 'Review' : 'Open'}<Icon name="arrow" /></Button>
  </li>)}</ul>;
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return <dl className="facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function Modal({ children, title, subtitle, footer, close }: { children: ReactNode; title: string; subtitle: string; footer: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const target = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      if (target?.isConnected) target.focus();
      else document.querySelector<HTMLElement>('main h1')?.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby="dialog-title" aria-describedby="dialog-description" onCancel={(event) => { event.preventDefault(); closeRef.current(); }}>
    <header className="dialog-header"><div><p className="eyebrow" id="dialog-description">{subtitle}</p><h2 id="dialog-title" tabIndex={-1} autoFocus>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={close}><Icon name="close" /></button></header>
    <div className="dialog-body">{children}</div>
    <footer className="dialog-footer">{footer}</footer>
  </dialog>;
}

export function App({ initialWorkspace = null, initialRoute, session, onLogout }: { initialWorkspace?: Workspace | null; initialRoute?: Route; session?: ControllerSession; onLogout?: () => void } = {}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(initialWorkspace);
  const [route, setRoute] = useState<Route>(initialRoute ?? readRoute);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [goal, setGoal] = useState('Summarize the sample repository');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Notice | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'complete'>('all');
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  const mounted = useRef(true);
  const mutationBusy = useRef(false);
  const polling = useRef(false);

  const refresh = useCallback(async () => {
    if (!mounted.current || polling.current || mutationBusy.current) return;
    polling.current = true;
    const stamp = generation.current;
    try {
      const fresh = await api.request<Workspace>('/api/v1/workspace');
      if (mounted.current && stamp === generation.current) {
        setWorkspace(fresh);
        setConnectionError(null);
      }
    } catch (cause) {
      if (mounted.current && stamp === generation.current) setConnectionError(cause instanceof Error ? cause.message : 'Can’t load the workspace.');
    } finally {
      polling.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = window.setInterval(() => { setNow(Date.now()); if (document.visibilityState === 'visible') void refresh(); }, 2000);
    const visible = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); void refresh(); } };
    document.addEventListener('visibilitychange', visible);
    return () => { mounted.current = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);

  useEffect(() => {
    const onHash = () => { setRoute(readRoute()); setError(null); setDialog(null); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('main h1')?.focus();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [route.page, route.id]);

  function navigate(page: Route['page'], id?: string) {
    window.location.hash = id ? `task/${id}` : page;
  }

  const openTask = (id: string) => navigate('task', id);
  const stopped = workspace?.admission === 'stopped';
  const remote = session?.mode === 'remote';
  const disabled = busy || !!connectionError;
  const tasks = workspace?.tasks ?? [];
  const selected = tasks.find((task) => task.id === route.id);
  const dialogTask = dialog && 'taskId' in dialog ? tasks.find((task) => task.id === dialog.taskId) : undefined;

  function mergeTask(task: Task) {
    setWorkspace((old) => {
      if (!old) return old;
      // Replaying an uncertain operation can return an older successful response.
      // Keep a newer snapshot already seen by this tab until the next refresh.
      if (old.tasks.some((item) => item.id === task.id && item.revision > task.revision)) return old;
      return { ...old, tasks: [task, ...old.tasks.filter((item) => item.id !== task.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)) };
    });
  }

  async function mutate<T>(path: string, body: unknown, success: (result: T) => void) {
    if (!mounted.current || mutationBusy.current) return;
    mutationBusy.current = true;
    generation.current += 1;
    setBusy(true);
    setError(null);
    try {
      const result = await api.request<T>(path, body);
      if (mounted.current) {
        success(result);
        setConnectionError(null);
      }
    } catch (cause) {
      if (!mounted.current) return;
      const requestError = cause instanceof RequestError ? cause : new RequestError('The request could not be completed.');
      setError({
        message: requestError.status === 409 ? `${requestError.message} Refreshing the latest state; review it before trying again.` : requestError.message,
        // The closure retains the original body/revision as well as the client's key.
        retry: requestError.uncertain ? () => { void mutate<T>(path, body, success); } : undefined,
      });
    } finally {
      generation.current += 1;
      mutationBusy.current = false;
      if (mounted.current) {
        setBusy(false);
        void refresh();
      }
    }
  }

  function createPlan(event: React.FormEvent) {
    event.preventDefault();
    if (!goal.trim() || stopped) return;
    const body: CreateTask = { goal: goal.trim(), recipe: 'repository_summary' };
    void mutate<Task>('/api/v1/tasks', body, (task) => {
      mergeTask(task);
      setDialog({ type: 'plan', taskId: task.id });
    });
  }

  function act(task: Task, action: TaskAction['action'], close = false) {
    const body: TaskAction = { action, expected_revision: task.revision };
    if (['approve', 'deny'].includes(action) && task.approval) body.approval_id = task.approval.id;
    void mutate<Task>(`/api/v1/tasks/${task.id}/actions`, body, (updated) => {
      mergeTask(updated);
      if (close) { setDialog(null); openTask(updated.id); }
    });
  }

  function control(action: ControlAction['action']) {
    void mutate<Workspace>('/api/v1/control', { action } satisfies ControlAction, (fresh) => {
      setWorkspace(fresh);
      setDialog(null);
    });
  }

  function review(task: Task, type: 'plan' | 'approval') {
    setError(null);
    setDialog({ type, taskId: task.id });
  }

  function taskDetail(task: Task) {
    const canPause = task.status === 'running' || task.status === 'queued';
    return <>
      <div className="page-heading"><p className="eyebrow">Repository analysis</p><h1 tabIndex={-1}>{task.goal}</h1><div className="task-subline"><Status task={task} /><span>Created {dateTime(task.created_at)}</span></div></div>
      <section className="panel" aria-labelledby="result-title"><div className="panel-heading"><h2 id="result-title">{task.artifact ? 'Your report is ready' : task.status === 'waiting_approval' ? 'Your report needs review' : 'Task progress'}</h2>{task.artifact && <Icon name="check" />}</div><div className="panel-body">
        <p className="task-summary" role="status">{task.summary}</p>
        {task.artifact ? <><div className="actions"><a className="btn primary" href={`/api/v1/tasks/${task.id}/artifact`} download={task.artifact.filename}><Icon name="download" />Download report</a></div><details className="report-disclosure"><summary>Preview report</summary><pre className="report">{task.artifact.content}</pre></details></> : <>
          {['running', 'queued', 'paused'].includes(task.status) && <div className="progress-wrap"><progress aria-label="Task progress" max="100" value={task.progress} /><span>{task.progress}%</span></div>}
          <div className="actions">
            {task.status === 'draft' && <Button primary disabled={disabled || stopped} onClick={() => review(task, 'plan')}>Review plan<Icon name="arrow" /></Button>}
            {task.status === 'waiting_approval' && <Button primary disabled={disabled} onClick={() => review(task, 'approval')}>Review report<Icon name="arrow" /></Button>}
            {canPause && <Button disabled={disabled} onClick={() => act(task, 'pause')}>Pause task</Button>}
            {task.status === 'paused' && <Button primary disabled={disabled || stopped} onClick={() => act(task, 'resume')}>Resume task</Button>}
            {!terminal.has(task.status) && <Button disabled={disabled} onClick={() => act(task, 'cancel')}>Cancel task</Button>}
            {terminal.has(task.status) && <Button onClick={() => navigate('home')}>Create another task</Button>}
          </div>
        </>}
      </div></section>
      <details className="disclosure"><summary>Task access <span>Bundled sample only</span></summary><div className="panel-body"><Facts items={[
        ['Input', task.plan.input], ['Runner', task.plan.worker], ['Permissions', task.plan.permissions.join(' · ')],
      ]} /><p className="help">The task label names this run. This runner uses a fixed recipe; it does not execute arbitrary instructions.</p></div></details>
      <details className="disclosure"><summary>Activity <span>{task.events.length} events</span></summary><div className="panel-body"><ol className="timeline">{task.events.map((event) => <li key={event.id}><span className="timeline-dot" /><div><p>{event.message}</p><time dateTime={event.at}>{dateTime(event.at)}</time></div></li>)}</ol></div></details>
    </>;
  }

  function content() {
    if (!workspace) return connectionError
      ? <><div className="page-heading"><h1 tabIndex={-1}>Reconnect to your Mac</h1><p className="lede">Check your connection and that Appy is running on your Mac.</p></div><ErrorNotice notice={{ message: connectionError, retry: () => { void refresh(); } }} /></>
      : <><div className="page-heading"><h1 tabIndex={-1}>Opening your workspace</h1><p className="lede" role="status">Loading tasks from your Mac…</p></div><div className="skeleton" aria-hidden="true" /></>;

    if (route.page === 'access') return remote ? <><div className="page-heading"><h1 tabIndex={-1}>Manage access on your Mac</h1><p className="lede">Create pairing codes and disconnect browsers from Appy on your Mac.</p></div><Button onClick={() => navigate('runner')}>Back to runner</Button></> : <MobileAccess />;

    if (route.page === 'home') {
      const recent = [...tasks].sort((a, b) => Number(b.status === 'waiting_approval') - Number(a.status === 'waiting_approval') || b.created_at.localeCompare(a.created_at)).slice(0, 3);
      return <div className="home-focus"><div className="page-heading"><h1 tabIndex={-1}>Your first task, end to end.</h1><p className="lede">Analyze the bundled sample repository, then review and download its report.</p></div>
        <form className="composer" onSubmit={createPlan}>
          <label htmlFor="task-goal">Task label</label><textarea id="task-goal" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={300} rows={2} aria-describedby="recipe-note" required />
          <div className="composer-footer"><span id="recipe-note">Repository analysis <span className="muted">· Sample data</span></span><Button type="submit" primary disabled={disabled || stopped || !goal.trim()}>{busy ? 'Preparing…' : 'Review plan'}<Icon name="arrow" /></Button></div>
        </form>
        <section className="recent-work"><div className="section-heading"><h2>Recent tasks</h2>{tasks.length > 0 && <button className="text-button" onClick={() => navigate('tasks')}>View all<Icon name="arrow" /></button>}</div>
          {recent.length ? <TaskRows tasks={recent} open={openTask} /> : <div className="first-task"><span className="step-number">1</span><p>Review the plan above to start your first run.<span>Your tasks and decisions will be saved on your Mac.</span></p></div>}
        </section>
      </div>;
    }
    if (route.page === 'tasks') {
      const visible = tasks.filter((task) => filter === 'all' || (filter === 'complete' ? task.status === 'succeeded' : !terminal.has(task.status)));
      return <><div className="page-heading heading-with-action"><div><h1 tabIndex={-1}>Tasks</h1><p className="lede">Pick up a run or review its result.</p></div><Button primary onClick={() => navigate('home')}>New task</Button></div>
        <div className="filters" aria-label="Filter tasks">{(['all', 'active', 'complete'] as const).map((value) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All tasks' : value === 'active' ? 'Active' : 'Completed'}</button>)}</div>
        {visible.length ? <TaskRows tasks={visible} open={openTask} /> : <Empty title={tasks.length ? 'No tasks in this view' : 'Your first run starts here'} action={<Button onClick={() => tasks.length ? setFilter('all') : navigate('home')}>{tasks.length ? 'Show all tasks' : 'Create a task'}</Button>}>{tasks.length ? 'Try another filter, or create a new task.' : 'Give the sample analysis a label, review its plan, and watch it run.'}</Empty>}
      </>;
    }
    if (route.page === 'task') return selected ? taskDetail(selected) : <><div className="page-heading"><h1 tabIndex={-1}>Task not found</h1><p className="lede">This task isn’t in the current local workspace.</p></div><Button onClick={() => navigate('tasks')}>Back to tasks</Button></>;
    if (route.page === 'activity') {
      const events = tasks.flatMap((task) => task.events.map((event) => ({ ...event, task }))).sort((a, b) => b.at.localeCompare(a.at));
      return <><div className="page-heading"><h1 tabIndex={-1}>Activity</h1><p className="lede">A record of each task’s decisions and progress.</p></div>{events.length ? <ol className="activity-list">{events.map((event) => <li key={`${event.task.id}-${event.id}`}><div><p>{event.message}</p><button className="text-button task-link" onClick={() => openTask(event.task.id)}>{event.task.goal}</button></div><time dateTime={event.at} title={dateTime(event.at)}>{time(event.at)}</time></li>)}</ol> : <Empty title="Nothing here yet">Activity will appear when you create your first task.</Empty>}</>;
    }
    return <><div className="page-heading"><p className="eyebrow">Mac workspace</p><h1 tabIndex={-1}>One runner. A real task flow.</h1><p className="lede">This development build exercises task planning, persistence, approval, and cancellation on your Mac.</p></div>
      <section className="panel"><div className="panel-heading"><h2>{workspace.worker.name}</h2><span className="status status-succeeded"><span className="status-dot" />Available</span></div><div className="panel-body"><p>{workspace.worker.description}</p><Facts items={[
        ['Recipe', 'Repository analysis'], ['Input', 'Bundled sample files'], ['Output', 'Markdown report'], ['Task admission', stopped ? 'Stopped' : 'Open'],
      ]} /></div></section>
      <section className="plain-section"><h2>What you can try</h2><p>Review a task plan, watch it run, pause or cancel it, then approve a specific report for download. Reload the page to return to your saved tasks.</p></section>
      {remote ? <section className="plain-section"><h2>This browser</h2><p>{session.name ?? 'Paired browser'} · {session.expires_at ? `Access until ${dateTime(session.expires_at)}` : 'Connected to your Mac'}</p><div className="actions"><Button onClick={onLogout}>Disconnect this browser</Button></div></section> : <section className="plain-section"><h2>Take your workspace with you</h2><p>Pair your iPhone or iPad to use this task workflow from Safari.</p><div className="actions"><Button onClick={() => navigate('access')}>Connect a phone<Icon name="arrow" /></Button></div></section>}
      <section className="plain-section"><h2>What comes next</h2><p>Local models, scoped tools, and device control are planned. This build runs a bundled sample analysis; it cannot control your screen or access your personal files.</p></section>
      {stopped && <Button primary disabled={disabled} onClick={() => control('enable_new_tasks')}>Enable new tasks</Button>}
    </>;
  }

  function modalContent() {
    if (!dialog) return null;
    const close = () => setDialog(null);
    const notice = <>
      {connectionError && <ErrorNotice notice={{ message: `${connectionError} Actions are paused until the server reconnects.`, retry: () => { void refresh(); } }} disabled={busy} />}
      {error && <ErrorNotice notice={error} disabled={busy} />}
    </>;
    if (dialog.type === 'stop') return <Modal title="Stop all tasks?" subtitle="Local workspace" close={close} footer={<><Button onClick={close}>Keep working</Button><Button danger disabled={disabled} onClick={() => control('stop_all')}>{busy ? 'Stopping…' : 'Stop all tasks'}</Button></>}>
      {notice}<p>Cancel every unfinished task and stop accepting new ones. Completed reports stay available.</p><p>You can enable new tasks afterwards. Cancelled work will stay cancelled.</p>
    </Modal>;
    if (!dialogTask) return null;
    const task = dialogTask;
    if (dialog.type === 'plan') return <Modal title="Review your plan" subtitle="Repository analysis · Sample data" close={close} footer={<><Button onClick={close}>Save for later</Button><Button primary disabled={disabled || stopped || task.status !== 'draft'} onClick={() => act(task, 'start', true)}>{busy ? 'Starting…' : 'Start task'}<Icon name="arrow" /></Button></>}>
      {notice}<p className="plan-goal">{task.goal}</p><ol className="plan-steps">{task.plan.steps.map((step, index) => <li key={step}><span className="step-number">{index + 1}</span><p>{step}</p></li>)}</ol>
      <Facts items={ [['Input', task.plan.input], ['Runner', task.plan.worker], ['Access', task.plan.permissions.join(' · ')]] } />
      <p className="help">This is a fixed sample analysis. Your label names the run; it doesn’t change the recipe or grant access to your files.</p>{task.status !== 'draft' && <p className="notice">This task is now {labels[task.status].toLowerCase()}. Close this plan to see its current state.</p>}
    </Modal>;
    const approval = task.approval;
    if (!approval || task.status !== 'waiting_approval') return <Modal title="This review is no longer pending" subtitle="Task updated" close={close} footer={<Button primary onClick={close}>Close review</Button>}><p>The task is now {labels[task.status].toLowerCase()}. Its current result is available in task details.</p>{notice}</Modal>;
    const expired = Date.parse(approval.expires_at) <= now;
    return <Modal title="Approve this report?" subtitle="One action · Local task journal" close={close} footer={<><Button disabled={disabled} onClick={() => act(task, 'deny', true)}>Deny</Button>{expired ? <Button primary disabled={disabled} onClick={() => act(task, 'refresh_approval')}>{busy ? 'Refreshing…' : 'Refresh review'}</Button> : <Button primary disabled={disabled} onClick={() => act(task, 'approve', true)}>{busy ? 'Approving…' : 'Approve report'}</Button>}</>}>
      {notice}<p>Make this exact report available to download. Its preview and review history are already saved in the local task journal. Nothing is sent to an external service.</p>
      <div className="approval-expiry" role="status">{expired ? 'This review has expired. Refresh it before approving.' : `Valid until ${time(approval.expires_at)}`}</div>
      <h3>Report preview</h3><pre className="report approval-report">{approval.preview}</pre>
      <details className="request-details"><summary>Request details</summary><Facts items={[
        ['Action', 'Save fixture report'], ['Destination', approval.target], ['Approval', approval.id], ['Content SHA-256', <code>{approval.sha256}</code>],
      ]} /><p className="help">Approval applies once to this exact report and task revision. Refreshing replaces the previous approval.</p></details>
    </Modal>;
  }

  return <>
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={() => navigate('home')} aria-label="Appy home"><span className="brand-mark">a</span>appy</button><p className="workspace-label">Personal workspace</p><nav aria-label="Main navigation">{navigation.map((item) => <button key={item.page} className={`nav-item ${route.page === item.page || (item.page === 'tasks' && route.page === 'task') ? 'active' : ''}`} aria-current={route.page === item.page || (item.page === 'tasks' && route.page === 'task') ? 'page' : undefined} onClick={() => navigate(item.page)}><Icon name={item.icon} />{item.title}</button>)}</nav></aside>
      <div className="workspace-main"><header className="topbar"><span className="breadcrumb">{pageLabels[route.page]}</span><button className="mobile-brand" onClick={() => navigate('home')}>appy</button><div className="topbar-actions"><span className="lab-label">{remote ? 'On your Mac' : 'Local lab'}</span><button className="stop-button" disabled={disabled || !workspace || stopped} onClick={() => { setError(null); setDialog({ type: 'stop' }); }}><Icon name="stop" />{stopped ? 'Stopped' : 'Stop all'}</button></div></header>
        <main id="main-content" className="content-shell" tabIndex={-1}>
          {workspace && connectionError && <ErrorNotice notice={{ message: `${connectionError} Showing the last known state.`, retry: () => { void refresh(); } }} disabled={busy} />}
          {error && !dialog && <ErrorNotice notice={error} disabled={busy} />}
          {workspace && stopped && <div className="notice stopped"><div><strong>New tasks are stopped</strong><p>Enable new tasks when you’re ready. Cancelled work stays cancelled.</p></div><Button disabled={disabled} onClick={() => control('enable_new_tasks')}>Enable new tasks</Button></div>}
          {content()}
        </main>
      </div>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.map((item) => <button key={item.page} className={route.page === item.page || (item.page === 'tasks' && route.page === 'task') ? 'active' : ''} aria-current={route.page === item.page || (item.page === 'tasks' && route.page === 'task') ? 'page' : undefined} onClick={() => navigate(item.page)}><Icon name={item.icon} /><span>{item.title}</span></button>)}</nav>
    {modalContent()}
  </>;
}
