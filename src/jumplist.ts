import * as vscode from "vscode";

class JumpPoint {
  loc: vscode.Location;
  line: string;
  constructor(loc: vscode.Location, line: string) {
    this.loc = loc;
    this.line = line;
  }

  toString(): string {
    const { uri } = this.loc;
    const { line, character } = this.loc.range.start;
    return `${JSON.stringify(uri.toString())} ${line + 1}:${character + 1}`;
  }

  async jump() {
    const start = this.loc.range.start;
    const selection = new vscode.Selection(start, start);
    await vscode.window.showTextDocument(this.loc.uri, { selection });
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

export class JumpList implements vscode.Disposable {
  private _points: JumpPoint[] = [];
  private _index: number = 0;
  private _log: vscode.OutputChannel;
  private _disposables: vscode.Disposable;

  private static _instance: JumpList;

  public static getInstance() {
    if (!JumpList._instance) {
      JumpList._instance = new JumpList();
    }
    return JumpList._instance;
  }

  private constructor() {
    this._log = vscode.window.createOutputChannel("JumpList");
    this._disposables = vscode.Disposable.from(
      this._log,
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
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  public register(textEditor: vscode.TextEditor) {
    const point = JumpPoint.currentPoint(textEditor);
    this._points.push(point);
    this._index++;
    this._log.appendLine(`Register jump point: ${point}`);
  }

  public async jumpBack(textEditor: vscode.TextEditor) {
    this._index--;

    if (this._index < 0) {
      this._index = 0;
      this._log.appendLine("Already at the beginning of the jump list.");
      return;
    }

    const toPoint = this._points[this._index];
    if (this._index === this._points.length - 1) {
      const currentPoint = JumpPoint.currentPoint(textEditor);
      this._points.push(currentPoint);
    }
    await toPoint.jump();
    this._log.appendLine(`Jump back to: ${toPoint}`);
  }

  public async jumpForward() {
    this._index++;
    if (this._index >= this._points.length) {
      this._index = this._points.length - 1;
      this._log.appendLine("Already at the end of the jump list.");
      return;
    }
    const toPoint = this._points[this._index];
    await toPoint.jump();
    this._log.appendLine(`Jump forward to: ${toPoint}`);
  }

  public jump() {
    const items: vscode.QuickPickItem[] = this._points.map((point) => {
      return {
        label: point.toString(),
        description: point.line,
      };
    });
    vscode.window.showQuickPick(items).then((item) => {
      if (!item) {
        return;
      }
    });
  }
}
