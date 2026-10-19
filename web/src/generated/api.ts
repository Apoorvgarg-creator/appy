// Generated from contracts/openapi.json by npm run generate. Do not edit.

export type Event = {
  "id": string;
  "at": string;
  "kind": string;
  "message": string;
};

export type Plan = {
  "input": string;
  "worker": string;
  "steps": Array<string>;
  "permissions": Array<string>;
};

export type Artifact = {
  "filename": string;
  "media_type": "text/markdown";
  "content": string;
  "sha256": string;
};

export type Approval = {
  "id": string;
  "expires_at": string;
  "sha256": string;
  "action": "save_fixture_report";
  "target": "Local task journal";
  "preview": string;
};

export type Task = {
  "id": string;
  "goal": string;
  "recipe": "repository_summary";
  "status": "draft" | "queued" | "running" | "waiting_approval" | "paused" | "succeeded" | "cancelled" | "failed";
  "revision": number;
  "created_at": string;
  "updated_at": string;
  "progress": number;
  "summary": string;
  "plan": Plan;
  "events": Array<Event>;
  "artifact": Artifact | null;
  "approval": Approval | null;
};

export type Worker = {
  "id": "fixture";
  "name": "Local fixture runner";
  "kind": "fixture";
  "state": "ready";
  "description": string;
};

export type Workspace = {
  "mode": "fixture";
  "admission": "open" | "stopped";
  "tasks": Array<Task>;
  "worker": Worker;
};

export type CreateTask = {
  "goal": string;
  "recipe": "repository_summary";
};

export type TaskAction = {
  "action": "start" | "pause" | "resume" | "cancel" | "approve" | "deny" | "refresh_approval";
  "expected_revision": number;
  "approval_id"?: string;
};

export type ControlAction = {
  "action": "stop_all" | "enable_new_tasks";
};

export type Error = {
  "error": {
  "code": string;
  "message": string;
};
};

export type ControllerSession = {
  "mode": "local" | "remote";
  "authenticated": boolean;
  "name": string | null;
  "expires_at": string | null;
};

export type PairingInvite = {
  "code": string;
  "expires_at": string;
};

export type PairedBrowser = {
  "id": string;
  "name": string;
  "created_at": string;
  "expires_at": string;
};

export type MobileAccess = {
  "enabled": boolean;
  "origin": string | null;
  "invite": PairingInvite | null;
  "sessions": Array<PairedBrowser>;
};

export type PairBrowser = {
  "code": string;
  "name": string;
};

export type RevokeBrowser = {
  "session_id": string;
};

export type EmptyRequest = {

};
