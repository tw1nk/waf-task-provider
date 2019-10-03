/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { WafTaskProvider } from './wafTaskProvider';
import { WscriptCodeLensProvider } from './wafCodeLens';

let wafTaskProvider: vscode.Disposable | undefined;
import { wafRun } from './commands';


export function activate(ctx: vscode.ExtensionContext): void {
	let workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {

		return;
	}
	let workspaceRoot = workspaceFolders[0].uri.fsPath;
	if (!workspaceRoot) {
		return;
	}

	let commandDisposable = vscode.commands.registerCommand(
		"waf.run",
		wafRun
	);

	wafTaskProvider = vscode.tasks.registerTaskProvider(WafTaskProvider.WafType, new WafTaskProvider(workspaceRoot));
	let docSelector = {
		language: "waf",
		scheme: "file"
	};
	let cl = new WscriptCodeLensProvider();
	let codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(docSelector, cl);

	ctx.subscriptions.push(codeLensProviderDisposable);

}

export function deactivate(): void {
	if (wafTaskProvider) {
		wafTaskProvider.dispose();
	}
}
