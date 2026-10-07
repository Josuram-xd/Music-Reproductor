import { Stack } from "./stack";

/** Reversible action (Command pattern). */
export interface Command {
  readonly label?: string;
  execute(): void;
  undo(): void;
}

/**
 * Undo/redo stacks of `Command`s. Executing a new command clears redo.
 * If a command throws, the stacks are left unchanged.
 */
export class UndoManager {
  private readonly undoStack: Stack<Command>;
  private readonly redoStack: Stack<Command>;

  constructor(limit = 100) {
    this.undoStack = new Stack(limit);
    this.redoStack = new Stack(limit);
  }

  get canUndo(): boolean {
    return !this.undoStack.isEmpty;
  }

  get canRedo(): boolean {
    return !this.redoStack.isEmpty;
  }

  /** Command that the next `undo()` would revert. */
  peekUndo(): Command | undefined {
    return this.undoStack.peek();
  }

  peekRedo(): Command | undefined {
    return this.redoStack.peek();
  }

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack.clear();
  }

  /** Reverts the last command and returns it, or `undefined` if none. */
  undo(): Command | undefined {
    const command = this.undoStack.peek();
    if (!command) return undefined;
    command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    return command;
  }

  redo(): Command | undefined {
    const command = this.redoStack.peek();
    if (!command) return undefined;
    command.execute();
    this.redoStack.pop();
    this.undoStack.push(command);
    return command;
  }

  clear(): void {
    this.undoStack.clear();
    this.redoStack.clear();
  }
}
