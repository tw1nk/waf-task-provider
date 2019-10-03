
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import {
	OutputChannel,
	window
} from 'vscode';

import {
	wscriptFuncRe,
	noCommandTasks
} from './constants';

let _channel: OutputChannel;
export function getOutputChannel(): OutputChannel {
	if (!_channel) {
		_channel = window.createOutputChannel('Waf Auto Detection');
	}
	return _channel;
}

interface WafCommand {
	name: string;
	line?: number;
}

export function exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		cp.exec(command, options, (error, stdout, stderr) => {
			if (error) {
				reject({ error, stdout, stderr });
			}
			resolve({ stdout, stderr });
		});
	});
}


export async function discoverTaskNames(filepath: string, getLineNumbers: boolean): Promise<WafCommand[]> {

	let commandLine = 'waf --help';
	let cwd = path.dirname(filepath);
	let foundTasks: WafCommand[] = [];
	let foundTaskNames: string[] = [];
	try {

		let { stdout, stderr } = await exec(commandLine, {
			cwd: cwd
		});
		if (stderr && stderr.length > 0) {
			getOutputChannel().appendLine(stderr);
			getOutputChannel().show(true);
		}
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
					foundTaskNames.push(taskName);
					let out: WafCommand = {
						name: taskName
					};
					foundTasks.push(out);
				}
			}
		}
		// unfortunately this isn't the only tasks that can be run.
		// so we will have to read the file and parse the def taskname(random):
		// to get non listed waf function.
		let wscriptContent = fs.readFileSync(filepath, { encoding: "UTF-8" });
		if (wscriptContent) {
			//
			let m;
			while ((m = wscriptFuncRe.exec(wscriptContent)) !== null) {
				// This is necessary to avoid infinite loops with zero-width matches
				if (m.index === wscriptFuncRe.lastIndex) {
					wscriptFuncRe.lastIndex++;
				}
				let taskName = m[1];
				if (foundTaskNames.indexOf(taskName) == -1) {
					let wafTask: WafCommand = {
						name: taskName,
					};

					if (noCommandTasks.indexOf(taskName) === -1) {
						let out: WafCommand = {
							name: taskName
						};
						foundTasks.push(out);
					}
				}
			}
			if (getLineNumbers) {
				let lines = wscriptContent.split(/\r{0,1}\n/);
				let task;
				for (task of foundTasks) {

					for (let i = 0; i < lines.length; ++i) {
						if (lines[i].indexOf(`def ${task.name}(`) == 0) {
							task.line = i;
							break;
						}
					}
				}
			}
		}
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
	}

	return foundTasks;
}
