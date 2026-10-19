export interface Note {
  id: string;
  title: string;
  completed: boolean;
}

export function remainingNotes(notes: readonly Note[]): Note[] {
  return notes.filter((note) => !note.completed);
}
