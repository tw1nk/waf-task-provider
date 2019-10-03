import { Range, window, SnippetString } from "vscode";

import cp = require('child_process');
import path = require('path');
import { discoverTaskNames } from "./utils";

const outputChannel = window.createOutputChannel('Waf Output');

async function wafRun(taskName: string) {

	const editor = window.activeTextEditor;
	if (!editor) {
		window.showInformationMessage('No editor is active.');
		return;
	}
	if (!editor.document.fileName.endsWith('wscript')) {
		window.showInformationMessage('No waf command found. Current file is wscript.');
		return;
	}
	await editor.document.save();

	let cwd = path.dirname(editor.document.uri.path);

	if (!taskName) {
		let wafTasks = await discoverTaskNames(cwd, false);

		await window.showQuickPick(wafTasks.map(task => task.name), {

		}).then(function (resp) {
			if (resp) {
				taskName = resp;
			}
		});


		if (!taskName) {
			window.showInformationMessage('No command selected.');
			return;
		}
	}

	outputChannel.clear();
	outputChannel.show(true);
	let args = [taskName];




	outputChannel.appendLine(`Running waf ${taskName} in ${cwd}`);

	const tp = cp.spawn("waf", args, {
		cwd: cwd
	});
	//const outBuf = new LineBuffer();
	tp.stdout.on('data', function (chunk) {
		outputChannel.append(chunk.toString());
	});
	tp.stderr.on('data', function (chunk) {
		outputChannel.appendLine("ERR");
		outputChannel.append(chunk.toString());
	});
	tp.on('close', function (code, signal) {
		if (code) {
			outputChannel.appendLine(`Error: ${taskName} failed. ${code}`);
			/*} else if (signal === sendSignal) {
				outputChannel.appendLine(`Error: ${taskName} terminated by user.`);
			*/
		} else {
			outputChannel.appendLine(`Success: ${taskName} passed.`);
		}
	});
}

export { wafRun };
