import { Range, window, SnippetString } from "vscode";

async function addConsoleLog() {
   await window.showInputBox({
    prompt: "Line Number"
  });

 
}

export { addConsoleLog };