import * as vscode from "vscode";
import * as jumplist from "./jumplist";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(jumplist.JumpList.getInstance());
}

export function deactivate() {}
