/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

import {
	exec,
	getOutputChannel,
	discoverTaskNames
} from './utils';

import {
	wscriptFuncRe,
	noCommandTasks,
} from './constants';


export class WafTaskProvider implements vscode.TaskProvider {
	static WafType: string = 'waf';
	private wafPromise: Thenable<vscode.Task[]> | undefined = undefined;

	constructor(workspaceRoot: string) {
		let pattern = path.join(workspaceRoot, 'wscript');
		let fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		fileWatcher.onDidChange(() => this.wafPromise = undefined);
		fileWatcher.onDidCreate(() => this.wafPromise = undefined);
		fileWatcher.onDidDelete(() => this.wafPromise = undefined);
	}

	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.wafPromise) {
			this.wafPromise = getWafTasks();
		}
		return this.wafPromise;
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const task = _task.definition.task;
		// A Waf task consists of a task and an optional file as specified in WafTaskDefinition
		// Make sure that this looks like a Waf task by checking that there is a task.
		if (task) {
			// resolveTask requires that the same definition object be used.
			const definition: WafTaskDefinition = <any>_task.definition;
			return new vscode.Task(definition, definition.task, 'waf', new vscode.ShellExecution(`waf ${definition.task}`));
		}
		return undefined;
	}
}

function exists(file: string): Promise<boolean> {
	return new Promise<boolean>((resolve, _reject) => {
		fs.exists(file, (value) => {
			resolve(value);
		});
	});
}


interface WafTaskDefinition extends vscode.TaskDefinition {
	/**
	 * The task name
	 */
	task: string;

	/**
	 * The waf file containing the task
	 */
	file?: string;
}

const buildNames: string[] = ['build'];
function isBuildTask(name: string): boolean {
	for (let buildName of buildNames) {
		if (name.indexOf(buildName) !== -1) {
			return true;
		}
	}
	return false;
}

const testNames: string[] = ['test'];
function isTestTask(name: string): boolean {
	for (let testName of testNames) {
		if (name.indexOf(testName) !== -1) {
			return true;
		}
	}
	return false;
}



async function getWafTasks(): Promise<vscode.Task[]> {
	let workspaceFolders = vscode.workspace.workspaceFolders;
	let emptyTasks: vscode.Task[] = [];
	if (!workspaceFolders) {
		return emptyTasks;
	}

	let workspaceRoot = workspaceFolders[0].uri.fsPath;
	if (!workspaceRoot) {
		return emptyTasks;
	}
	let wafFile = path.join(workspaceRoot, 'wscript');
	if (!await exists(wafFile)) {
		return emptyTasks;
	}

	let foundTasks = await discoverTaskNames(wafFile, false);

	let result: vscode.Task[] = [];
	let waftask;

	for (waftask of foundTasks) {
		//let taskDescription = parts[1];
		let kind: WafTaskDefinition = {
			type: 'waf',
			task: waftask.name,
		};
		let task = new vscode.Task(kind, waftask.name, 'waf', new vscode.ShellExecution(`waf ${waftask.name}`));
		result.push(task);
		let lowerCaseTaskName = task.name.toLowerCase();
		if (isBuildTask(lowerCaseTaskName)) {
			task.group = vscode.TaskGroup.Build;
		} else if (isTestTask(lowerCaseTaskName)) {
			task.group = vscode.TaskGroup.Test;
		}
	}

	return result;

}
