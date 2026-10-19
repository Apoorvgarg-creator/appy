import { remainingNotes } from './notes';

const notes = [
  { id: 'one', title: 'Draft release notes', completed: false },
  { id: 'two', title: 'Review accessibility', completed: true },
];

// This is fixture input, not an executable test suite.
console.assert(remainingNotes(notes).length === 1);
