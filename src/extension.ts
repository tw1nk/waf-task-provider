/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { WafTaskProvider } from './wafTaskProvider';

let wafTaskProvider: vscode.Disposable | undefined;

export function activate(_context: vscode.ExtensionContext): void {
	let workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {

		return;
	}
	let workspaceRoot = workspaceFolders[0].uri.fsPath;
	if (!workspaceRoot) {
		return;
	}

	wafTaskProvider = vscode.tasks.registerTaskProvider(WafTaskProvider.WafType, new WafTaskProvider(workspaceRoot));
}

export function deactivate(): void {
	if (wafTaskProvider) {
		wafTaskProvider.dispose();
	}
}
