
import {
	CodeLensProvider,
	CancellationToken,
	CodeLens,
	Command,
	TextDocument,
	Range,
	DocumentFilter
} from 'vscode';

import {
	discoverTaskNames
} from './utils';

import {
	wscriptFuncRe,
	noCommandTasks
} from './constants';



export class WscriptCodeLensProvider implements CodeLensProvider {


	public provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | Thenable<CodeLens[]> {
		return this.getCodelenses(document, token);
	}


	private async getCodelenses(document: TextDocument, token: CancellationToken): Promise<CodeLens[]> {

		const codelens: CodeLens[] = [];
		let topOfDocument = new Range(0, 0, 0, 0);

		// Define what command we want to trigger when activating the CodeLens
		let foundTasks = await discoverTaskNames(document.uri.path, true);

		let wafTask;
		for (wafTask of foundTasks) {
			if (wafTask.line !== undefined) {
				let c: Command = {
					command: "waf.run",
					title: "▶️ " + wafTask.name,
					arguments: [wafTask.name]
				};
				codelens.push(new CodeLens(new Range(wafTask.line, 0, wafTask.line, 0), c));
			}
		}

		return codelens;
	}
}
