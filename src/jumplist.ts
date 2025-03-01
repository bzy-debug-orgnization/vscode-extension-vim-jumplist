import * as vscode from "vscode";

class JumpPoint {
  private _loc: vscode.Location;
  constructor(loc: vscode.Location) {
    this._loc = loc;
  }

  toString(): string {
    const { uri } = this._loc;
    const { line, character } = this._loc.range.start;
    return `${JSON.stringify(uri.toString())} ${line + 1}:${character + 1}`;
  }

  async jump() {
    const doc = await vscode.window.showTextDocument(this._loc.uri);
    doc.revealRange(
      this._loc.range,
      vscode.TextEditorRevealType.InCenterIfOutsideViewport,
    );
  }

  public static currentPoint(textEditor: vscode.TextEditor): JumpPoint {
    const position = textEditor.selection.active;
    const uri = textEditor.document.uri;
    const location = new vscode.Location(uri, position);
    const point = new JumpPoint(location);
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
}
