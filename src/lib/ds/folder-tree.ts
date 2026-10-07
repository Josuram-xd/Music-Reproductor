export type FolderId = string;

export interface Folder {
  id: FolderId;
  name: string;
  /** `null` = top-level folder. */
  parentId: FolderId | null;
}

interface TreeNode {
  folder: Folder;
  parent: TreeNode | null;
  children: TreeNode[];
}

/** A folder plus its depth, as yielded by `traverse` (0 = top level). */
export interface FolderEntry {
  folder: Folder;
  depth: number;
}

/**
 * N-ary tree of library folders. Top-level folders hang from an implicit
 * root (`parentId = null`). Nodes are indexed by id for O(1) lookup.
 * Every read returns copies, so callers cannot corrupt the tree.
 */
export class FolderTree {
  private readonly root: TreeNode = {
    folder: { id: "", name: "", parentId: null },
    parent: null,
    children: [],
  };
  private readonly index = new Map<FolderId, TreeNode>();

  /** Builds a tree from rows in any order (e.g. straight from the DB). */
  static fromList(folders: Iterable<Folder>): FolderTree {
    const tree = new FolderTree();
    const pending = new Map<FolderId, Folder>();
    for (const folder of folders) {
      if (pending.has(folder.id)) throw new Error(`Duplicate folder id "${folder.id}"`);
      pending.set(folder.id, folder);
    }
    const visit = (folder: Folder, stack: Set<FolderId>) => {
      if (tree.has(folder.id)) return;
      if (stack.has(folder.id)) throw new Error(`Cycle detected at folder "${folder.id}"`);
      if (folder.parentId !== null && !tree.has(folder.parentId)) {
        const parent = pending.get(folder.parentId);
        if (!parent) throw new Error(`Parent folder "${folder.parentId}" does not exist`);
        stack.add(folder.id);
        visit(parent, stack);
        stack.delete(folder.id);
      }
      tree.add(folder);
    };
    for (const folder of pending.values()) visit(folder, new Set());
    return tree;
  }

  get size(): number {
    return this.index.size;
  }

  has(id: FolderId): boolean {
    return this.index.has(id);
  }

  get(id: FolderId): Folder | undefined {
    const node = this.index.get(id);
    return node && { ...node.folder };
  }

  /** Adds a folder under `folder.parentId`, which must already exist. */
  add(folder: Folder): void {
    if (this.index.has(folder.id)) throw new Error(`Folder "${folder.id}" already exists`);
    const parent = this.nodeOrRoot(folder.parentId);
    const node: TreeNode = { folder: { ...folder }, parent, children: [] };
    parent.children.push(node);
    this.index.set(folder.id, node);
  }

  rename(id: FolderId, name: string): void {
    this.node(id).folder.name = name;
  }

  /** Direct children of `id` (`null` = top-level folders), in insertion order. */
  children(id: FolderId | null): Folder[] {
    return this.nodeOrRoot(id).children.map((n) => ({ ...n.folder }));
  }

  /** Moves `id` (with its subtree) under `newParentId`. Rejects cycles. */
  move(id: FolderId, newParentId: FolderId | null): void {
    const node = this.node(id);
    const newParent = this.nodeOrRoot(newParentId);
    for (let n: TreeNode | null = newParent; n; n = n.parent) {
      if (n === node) throw new Error(`Cannot move "${id}" into itself or a descendant`);
    }
    if (node.parent === newParent) return;
    this.detach(node);
    node.parent = newParent;
    node.folder.parentId = newParentId;
    newParent.children.push(node);
  }

  /** Removes `id` and its whole subtree. Returns the removed ids (subtree first, preorder). */
  remove(id: FolderId): FolderId[] {
    const node = this.node(id);
    const removed = [...this.walk(node, 0)].map((e) => e.folder.id);
    this.detach(node);
    for (const removedId of removed) this.index.delete(removedId);
    return removed;
  }

  /** Folders from the top level down to `id` (inclusive), for breadcrumbs. */
  path(id: FolderId): Folder[] {
    const path: Folder[] = [];
    for (let n: TreeNode | null = this.node(id); n && n !== this.root; n = n.parent) {
      path.unshift({ ...n.folder });
    }
    return path;
  }

  /** 0 for top-level folders. */
  depth(id: FolderId): number {
    return this.path(id).length - 1;
  }

  /** Whether `id` is `ancestorId` or lies inside it. */
  isDescendantOf(id: FolderId, ancestorId: FolderId): boolean {
    const ancestor = this.node(ancestorId);
    for (let n: TreeNode | null = this.node(id); n; n = n.parent) {
      if (n === ancestor) return true;
    }
    return false;
  }

  /** Preorder depth-first walk (`null` = whole tree). Handy to render the sidebar. */
  *traverse(id: FolderId | null = null): IterableIterator<FolderEntry> {
    const start = this.nodeOrRoot(id);
    if (start === this.root) {
      for (const child of start.children) yield* this.walk(child, 0);
    } else {
      yield* this.walk(start, 0);
    }
  }

  toArray(): Folder[] {
    return [...this.traverse()].map((e) => e.folder);
  }

  private *walk(node: TreeNode, depth: number): IterableIterator<FolderEntry> {
    yield { folder: { ...node.folder }, depth };
    for (const child of node.children) yield* this.walk(child, depth + 1);
  }

  private detach(node: TreeNode): void {
    const siblings = node.parent?.children;
    if (siblings) siblings.splice(siblings.indexOf(node), 1);
  }

  private node(id: FolderId): TreeNode {
    const node = this.index.get(id);
    if (!node) throw new Error(`Folder "${id}" does not exist`);
    return node;
  }

  private nodeOrRoot(id: FolderId | null): TreeNode {
    return id === null ? this.root : this.node(id);
  }
}
