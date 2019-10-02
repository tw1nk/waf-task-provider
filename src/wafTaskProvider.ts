/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as vscode from 'vscode';


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

function exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		cp.exec(command, options, (error, stdout, stderr) => {
			if (error) {
				reject({ error, stdout, stderr });
			}
			resolve({ stdout, stderr });
		});
	});
}

let _channel: vscode.OutputChannel;
function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Waf Auto Detection');
	}
	return _channel;
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

const wscriptFuncRe = /^def\s([A-Za-z]\S*)\([A-Za-z0-9_]+\):/gm;

let skipTasks = ['init', 'options'];

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

	let commandLine = 'waf --help';
	try {
		let { stdout, stderr } = await exec(commandLine, { cwd: workspaceRoot });
		if (stderr && stderr.length > 0) {
			getOutputChannel().appendLine(stderr);
			getOutputChannel().show(true);
		}
		let result: vscode.Task[] = [];
		let foundTasks: string[] = [];
		if (stdout) {
			let lines = stdout.split(/\r{0,1}\n/);

			let foundCommandLineStart = false;

			for (let line of lines) {

				if (!foundCommandLineStart && line.indexOf("Main commands") == 0) {
					foundCommandLineStart = true;
					continue;
				}
				if (!foundCommandLineStart) {
					continue;
				}
				if (foundCommandLineStart) {
					// time to parse the lines.

					// if the line is empty we have collected all tasks
					if (line.length === 0) {
						break;
					}
					let parts = line.split(":");
					let taskName = parts[0].trim();
					foundTasks.push(taskName);

					//let taskDescription = parts[1];
					let kind: WafTaskDefinition = {
						type: 'waf',
						task: taskName
					};
					let task = new vscode.Task(kind, taskName, 'waf', new vscode.ShellExecution(`waf ${taskName}`));
					result.push(task);
					let lowerCaseTaskName = taskName.toLowerCase();
					if (isBuildTask(lowerCaseTaskName)) {
						task.group = vscode.TaskGroup.Build;
					} else if (isTestTask(lowerCaseTaskName)) {
						task.group = vscode.TaskGroup.Test;
					}
				}
			}
		}

		// unfortunately this isn't the only tasks that can be run.
		// so we will have to read the file and parse the def taskname(random):
		// to get non listed waf function.
		let wscriptContent = fs.readFileSync(wafFile, { encoding: "UTF-8" });
		if (wscriptContent) {
			//let lines = wscriptContent.split(/\r{0,1}\n/);
			let m;
			while ((m = wscriptFuncRe.exec(wscriptContent)) !== null) {
				// This is necessary to avoid infinite loops with zero-width matches
				if (m.index === wscriptFuncRe.lastIndex) {
					wscriptFuncRe.lastIndex++;
				}
				let taskName = m[1];
				if (skipTasks.indexOf(taskName) === -1 && foundTasks.indexOf(taskName) === -1) {
					// we found a previously undiscovered task. Yay us.
					let kind: WafTaskDefinition = {
						type: 'waf',
						task: taskName
					};
					let task = new vscode.Task(kind, taskName, 'waf', new vscode.ShellExecution(`waf ${taskName}`));
					result.push(task);

				}
			}
		}

		return result;
	} catch (err) {
		let channel = getOutputChannel();
		if (err.stderr) {
			channel.appendLine(err.stderr);
		}
		if (err.stdout) {
			channel.appendLine(err.stdout);
		}
		channel.appendLine('Auto detecting waf tasts failed.');
		channel.show(true);
		return emptyTasks;
	}
}
