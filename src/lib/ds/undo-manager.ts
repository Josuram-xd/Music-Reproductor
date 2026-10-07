import { Stack } from "./stack";

/** Acción reversible (Command pattern). */
export interface Command {
  readonly label?: string;
  execute(): void;
  undo(): void;
}

/**
 * Pilas undo/redo sobre `Command`s. Ejecutar uno nuevo vacía el redo.
 * Si un comando lanza, las pilas no cambian.
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

  /** Comando que se desharía con el próximo `undo()`. */
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

  /** Deshace el último comando y lo devuelve, o `undefined` si no hay. */
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
