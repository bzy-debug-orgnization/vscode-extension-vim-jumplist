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

class JumpPointQuickPickItem implements vscode.QuickPickItem {
  label: string;
  description?: string | undefined;
  _point?: JumpPoint;

  constructor();
  constructor(
    point: JumpPoint,
    i: number,
    timesPad: number,
    linePad: number,
    colPad: number,
  );
  constructor(...args: any[]) {
    if (args.length === 0) {
      this.label = "";
    } else {
      const [point, i, timesPad, linePad, colPad] = args as [
        JumpPoint,
        number,
        number,
        number,
        number,
      ];
      let filename = uri.Utils.basename(point.loc.uri);
      const times = `${i}`.padStart(timesPad);
      const line = `${point.loc.range.start.line + 1}`.padStart(linePad);
      const col = `${point.loc.range.start.character + 1}`.padStart(colPad);
      this.label = `${times}: Ln ${line}, Col ${col}  ${filename}`;
      this.description = point.line;
      this._point = point;
    }
  }
}

export class JumpList implements vscode.Disposable {
  private list: linkedList.LinkedList<JumpPoint>;
  private current: linkedList.Node<JumpPoint> | undefined;
  private log: vscode.OutputChannel;
  private disposables: vscode.Disposable;

  private static _instance: JumpList;

  public static getInstance() {
    if (!JumpList._instance) {
      JumpList._instance = new JumpList();
    }
    return JumpList._instance;
  }

  private constructor() {
    this.log = vscode.window.createOutputChannel("JumpList");
    this.list = new linkedList.LinkedList();
    this.current = undefined;
    this.disposables = vscode.Disposable.from(
      this.log,
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
    for (const node of this.list.iterHead()) {
      if (node.data.isEqual(point)) {
        this.list.remove(node);
        break;
      }
    }
    this.list.insertLast(point);
    this.current = undefined;
    this.log.appendLine(`Registered jump point: ${point}`);
  }

  public async jumpBack(textEditor: vscode.TextEditor) {
    if (this.current === this.list.head) {
      this.log.appendLine("Already at the beginning of the jump list.");
      return;
    }

    if (!this.current) {
      const currentPoint = JumpPoint.currentPoint(textEditor);
      this.list.insertLast(currentPoint);
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
    } else {
      this.log.appendLine("Already at the end of the jump list.");
    }
  }

  private renderItems(): {
    items: vscode.QuickPickItem[];
    activeItems: vscode.QuickPickItem[];
  } {
    if (!this.current) {
      const prevPoints = collectJumpPoints(this.list.iterTail());
      const { timesPad, linePad, colPad } = getPads(prevPoints);
      const items = prevPoints.map(
        (point, i) =>
          new JumpPointQuickPickItem(point, i + 1, timesPad, linePad, colPad),
      );
      const current: vscode.QuickPickItem = new JumpPointQuickPickItem();
      items.push(current);
      return { items, activeItems: [current] };
    } else {
      const prevPoints = this.current.prev
        ? collectJumpPoints(this.list.iterPrev(this.current.prev))
        : [];
      const currentPoint = this.current.data;
      const nextPoints = this.current.next
        ? collectJumpPoints(this.list.iterNext(this.current.next))
        : [];
      const { timesPad, linePad, colPad } = getPads([
        ...prevPoints,
        currentPoint,
        ...nextPoints,
      ]);
      const prevItems = prevPoints.map(
        (point, i) =>
          new JumpPointQuickPickItem(point, i + 1, timesPad, linePad, colPad),
      );
      const nextItems = [currentPoint, ...nextPoints].map(
        (point, i) =>
          new JumpPointQuickPickItem(point, i, timesPad, linePad, colPad),
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
      const item = items[0] as JumpPointQuickPickItem;
      if (item) {
        item._point?.peek();
      }
    });
    quickPick.onDidAccept(() => {
      const item = quickPick.activeItems[0] as JumpPointQuickPickItem;
      if (item) {
        item._point?.jump();
      }
      quickPick.dispose();
    });
    quickPick.show();
  }
}

function collectJumpPoints(nodes: Generator<linkedList.Node<JumpPoint>>) {
  const points: JumpPoint[] = [];
  for (const node of nodes) {
    points.push(node.data);
  }
  return points;
}

function getPads(points: JumpPoint[]) {
  let maxLine = -1;
  let maxCol = -1;
  for (const point of points) {
    maxLine = Math.max(maxLine, point.loc.range.start.line);
    maxCol = Math.max(maxCol, point.loc.range.start.character);
  }
  const timesPad = `${points.length + 1}`.length;
  const linePad = `${maxLine + 1}`.length;
  const colPad = `${maxCol + 1}`.length;
  return { timesPad, linePad, colPad };
}
