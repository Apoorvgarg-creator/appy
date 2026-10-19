package hub

import "time"

type Event struct {
	ID      string    `json:"id"`
	At      time.Time `json:"at"`
	Kind    string    `json:"kind"`
	Message string    `json:"message"`
}
type Plan struct {
	Input       string   `json:"input"`
	Worker      string   `json:"worker"`
	Steps       []string `json:"steps"`
	Permissions []string `json:"permissions"`
}
type Artifact struct {
	Filename  string `json:"filename"`
	MediaType string `json:"media_type"`
	Content   string `json:"content"`
	SHA256    string `json:"sha256"`
}
type Approval struct {
	ID        string    `json:"id"`
	ExpiresAt time.Time `json:"expires_at"`
	SHA256    string    `json:"sha256"`
	Action    string    `json:"action"`
	Target    string    `json:"target"`
	Preview   string    `json:"preview"`
}
type Task struct {
	ID        string    `json:"id"`
	Goal      string    `json:"goal"`
	Recipe    string    `json:"recipe"`
	Status    string    `json:"status"`
	Revision  int       `json:"revision"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Progress  int       `json:"progress"`
	Summary   string    `json:"summary"`
	Plan      Plan      `json:"plan"`
	Events    []Event   `json:"events"`
	Artifact  *Artifact `json:"artifact"`
	Approval  *Approval `json:"approval"`
}
type Worker struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	State       string `json:"state"`
	Description string `json:"description"`
}
type Workspace struct {
	Mode      string `json:"mode"`
	Admission string `json:"admission"`
	Tasks     []Task `json:"tasks"`
	Worker    Worker `json:"worker"`
}
type CreateTask struct {
	Goal   string `json:"goal"`
	Recipe string `json:"recipe"`
}
type TaskAction struct {
	Action           string `json:"action"`
	ExpectedRevision int    `json:"expected_revision"`
	ApprovalID       string `json:"approval_id,omitempty"`
}
type ControlAction struct {
	Action string `json:"action"`
}
type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
type errorBody struct {
	Error apiError `json:"error"`
}

func fixedPlan() Plan {
	return Plan{Input: "Bundled Example Notes repository", Worker: "Local fixture runner", Steps: []string{"Inventory the bundled example files", "Compose a deterministic Markdown report", "Approve the report as a downloadable result"}, Permissions: []string{"Read embedded example files only", "Store task events and the report preview in the local journal", "Publish one exact downloadable result after approval"}}
}
