import * as vscode from "vscode";
import * as uri from "vscode-uri";
import * as linkedList from "./linked-list";

class JumpPoint {
  loc: vscode.Location;
  line: string;
  private constructor(loc: vscode.Location, line: string) {
    this.loc = loc;
    this.line = line;
  }

  isEqual(other: JumpPoint): boolean {
    return (
      this.loc.uri.toString() === other.loc.uri.toString() &&
      this.loc.range.start.isEqual(other.loc.range.start) &&
      this.loc.range.end.isEqual(other.loc.range.end)
    );
  }

  toString(): string {
    const { uri } = this.loc;
    const { line, character } = this.loc.range.start;
    return `${JSON.stringify(uri.toString())} ${line + 1}:${character + 1}`;
  }

  jump() {
    const { uri, range } = this.loc;
    vscode.window.showTextDocument(uri, { selection: range });
  }

  async peek() {
    const { uri, range } = this.loc;
    const editor = await vscode.window.showTextDocument(uri, {
      selection: range,
      preserveFocus: true,
      preview: true,
    });
    const highlightDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgba(250, 240, 170, 0.5)",
    });
    editor.setDecorations(highlightDecoration, [
      editor.document.lineAt(range.start.line).range,
    ]);
    setTimeout(() => {
      highlightDecoration.dispose();
    }, 350);
  }

  public static currentPoint(textEditor: vscode.TextEditor): JumpPoint {
    const position = textEditor.selection.active;
    const uri = textEditor.document.uri;
    const location = new vscode.Location(uri, position);
    const line = textEditor.document.lineAt(position.line).text.trim();
    const point = new JumpPoint(location, line);
    return point;
  }
}

function isStack(): boolean {
  return (
    vscode.workspace.getConfiguration("vim-jumplist").get("stack") ?? false
  );
}

class QuickPickItem implements vscode.QuickPickItem {
  label: string;
  description?: string | undefined;
  _node?: linkedList.Node<JumpPoint>;

  constructor();
  constructor(
    node: linkedList.Node<JumpPoint>,
    i: number,
    timesPad: number,
    linePad: number,
    colPad: number,
  );
  constructor(...args: any[]) {
    if (args.length === 0) {
      this.label = "";
    } else {
      const [node, i, timesPad, linePad, colPad] = args as [
        linkedList.Node<JumpPoint>,
        number,
        number,
        number,
        number,
      ];
      const point = node.data;
      let filename = uri.Utils.basename(point.loc.uri);
      const times = `${i}`.padStart(timesPad);
      const line = `${point.loc.range.start.line + 1}`.padStart(linePad);
      const col = `${point.loc.range.start.character + 1}`.padStart(colPad);
      this.label = `${times}: Ln ${line}, Col ${col}  ${filename}`;
      this.description = point.line;
      this._node = node;
    }
  }
}

export class JumpList implements vscode.Disposable {
  static readonly MAX_LENGTH = 100;
  private list: linkedList.LinkedList<JumpPoint>;
  private current: linkedList.Node<JumpPoint> | undefined;
  private disposables: vscode.Disposable;

  private static _instance: JumpList;

  public static getInstance() {
    if (!JumpList._instance) {
      JumpList._instance = new JumpList();
    }
    return JumpList._instance;
  }

  private constructor() {
    this.list = new linkedList.LinkedList();
    this.current = undefined;
    this.disposables = vscode.Disposable.from(
      vscode.commands.registerTextEditorCommand(
        "vim-jumplist.registerJump",
        this.register.bind(this),
      ),
      vscode.commands.registerTextEditorCommand(
        "vim-jumplist.jumpBack",
        this.jumpBack.bind(this),
      ),
      vscode.commands.registerTextEditorCommand(
        "vim-jumplist.jumpForward",
        this.jumpForward.bind(this),
      ),
      vscode.commands.registerCommand(
        "vim-jumplist.jump",
        this.jump.bind(this),
      ),
      vscode.commands.registerCommand(
        "vim-jumplist.clear",
        this.clear.bind(this),
      ),
      vscode.workspace.onDidChangeTextDocument((e) => {
        const { document, contentChanges } = e;
        for (const node of this.list.iterHead()) {
          if (node.data.loc.uri.toString() !== document.uri.toString()) {
            continue;
          }
          const point = node.data;
          for (const change of contentChanges) {
            const { start, end } = change.range;
            const { uri, range } = point.loc;
            if (
              start.line <= range.start.line &&
              range.start.line <= end.line
            ) {
              point.loc = new vscode.Location(uri, start);
              point.line = document.lineAt(start.line).text.trim();
            } else if (end.line < range.start.line) {
              const deletedLines = end.line - start.line + 1;
              const addedLines = change.text.split("\n").length;
              const changedLines = addedLines - deletedLines;
              if (changedLines !== 0) {
                point.loc = new vscode.Location(
                  uri,
                  range.start.with({
                    line: range.start.line + changedLines,
                  }),
                );
              }
            }
          }
        }
      }),
      vscode.workspace.onDidDeleteFiles((e) => {
        const { files } = e;
        for (const node of this.list.iterHead()) {
          if (
            files.some((f) => f.toString() === node.data.loc.uri.toString())
          ) {
            this.list.remove(node);
          }
        }
      }),
      vscode.workspace.onDidRenameFiles((e) => {
        const { files } = e;
        for (const node of this.list.iterHead()) {
          for (const { oldUri, newUri } of files) {
            if (node.data.loc.uri.toString() === oldUri.toString()) {
              node.data.loc = new vscode.Location(newUri, node.data.loc.range);
            }
          }
        }
      }),
    );
  }

  dispose() {
    this.disposables.dispose();
  }

  public clear() {
    this.list.clear();
    this.current = undefined;
  }

  public register(textEditor: vscode.TextEditor) {
    const point = JumpPoint.currentPoint(textEditor);
    if (isStack() && this.current) {
      this.list.removeAllAfter(this.current);
    }
    for (const node of this.list.iterHead()) {
      if (node.data.isEqual(point)) {
        this.list.remove(node);
        break;
      }
    }
    this.list.insertLast(point);
    if (this.list.size > JumpList.MAX_LENGTH) {
      this.list.remove(this.list.head!);
    }
    this.current = undefined;
  }

  public async jumpBack(textEditor: vscode.TextEditor) {
    if (this.current === this.list.head) {
      return;
    }

    if (!this.current) {
      const currentPoint = JumpPoint.currentPoint(textEditor);
      this.list.insertLast(currentPoint);
      if (this.list.size > JumpList.MAX_LENGTH) {
        this.list.remove(this.list.head!);
      }
      this.current = this.list.tail;
    }
    if (this.current?.prev) {
      this.current = this.current.prev;
      this.current.data.jump();
    }
  }

  public async jumpForward() {
    if (this.current?.next) {
      this.current = this.current.next;
      this.current.data.jump();
    }
  }

  private renderItems(): {
    items: vscode.QuickPickItem[];
    activeItems: vscode.QuickPickItem[];
  } {
    if (!this.current) {
      const prevNodes = collect(this.list.iterTail());
      const { timesPad, linePad, colPad } = getPads(prevNodes);
      const items = prevNodes
        .map(
          (node, i) =>
            new QuickPickItem(node, i + 1, timesPad, linePad, colPad),
        )
        .reverse();
      const current: vscode.QuickPickItem = new QuickPickItem();
      items.push(current);
      return { items, activeItems: [current] };
    } else {
      const prevNodes = this.current.prev
        ? collect(this.list.iterPrev(this.current.prev))
        : [];
      const currentNode = this.current;
      const nextNodes = this.current.next
        ? collect(this.list.iterNext(this.current.next))
        : [];
      const { timesPad, linePad, colPad } = getPads([
        ...prevNodes,
        currentNode,
        ...nextNodes,
      ]);
      const prevItems = prevNodes.map(
        (point, i) =>
          new QuickPickItem(point, i + 1, timesPad, linePad, colPad),
      );
      const nextItems = [currentNode, ...nextNodes].map(
        (point, i) => new QuickPickItem(point, i, timesPad, linePad, colPad),
      );
      const items = [...prevItems.reverse(), ...nextItems];
      return { items, activeItems: [nextItems[0]] };
    }
  }

  public jump() {
    const quickPick = vscode.window.createQuickPick();
    const { items, activeItems } = this.renderItems();
    quickPick.items = items;
    quickPick.activeItems = activeItems;
    quickPick.onDidHide(() => {
      quickPick.dispose();
    });
    quickPick.onDidChangeActive((items) => {
      const item = items[0] as QuickPickItem;
      if (item) {
        item._node?.data.peek();
      }
    });
    quickPick.onDidAccept(() => {
      const item = quickPick.activeItems[0] as QuickPickItem;
      if (item) {
        this.current = item._node;
        item._node?.data.jump();
      }
      quickPick.dispose();
    });
    quickPick.show();
  }
}

function collect<T>(nodeGen: Generator<linkedList.Node<T>>) {
  const nodes: linkedList.Node<T>[] = [];
  for (const node of nodeGen) {
    nodes.push(node);
  }
  return nodes;
}

function getPads(points: linkedList.Node<JumpPoint>[]) {
  let maxLine = -1;
  let maxCol = -1;
  for (const { data } of points) {
    maxLine = Math.max(maxLine, data.loc.range.start.line);
    maxCol = Math.max(maxCol, data.loc.range.start.character);
  }
  const timesPad = `${points.length + 1}`.length;
  const linePad = `${maxLine + 1}`.length;
  const colPad = `${maxCol + 1}`.length;
  return { timesPad, linePad, colPad };
}
