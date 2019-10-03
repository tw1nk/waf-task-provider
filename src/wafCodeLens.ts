
import { 
    CodeLensProvider, 
    CancellationToken, 
    CodeLens, 
    Command, 
    TextDocument, 
    Range,
    DocumentFilter
} from 'vscode';




export class WscriptCodeLensProvider implements CodeLensProvider {


    public provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | Thenable<CodeLens[]> {
		return this.getCodelenses(document, token);
    }


    private async getCodelenses(document: TextDocument, token: CancellationToken): Promise<CodeLens[]> {

        const codelens: CodeLens[] = [];
        let topOfDocument = new Range(0, 0, 0, 0);

        // Define what command we want to trigger when activating the CodeLens
        let c: Command = {
          command: "extension.addConsoleLog",
          title: "Insert console.log"
        };
    
        codelens.push(new CodeLens(topOfDocument, c));
    
        return codelens;
    }
};