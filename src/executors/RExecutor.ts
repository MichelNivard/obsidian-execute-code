import {ChildProcessWithoutNullStreams, spawn} from "child_process";
import {Outputter} from "src/Outputter";
import {ExecutorSettings} from "src/settings/Settings";
import AsyncExecutor from "./AsyncExecutor";
import ReplExecutor from "./ReplExecutor.js";


export default class RExecutor extends ReplExecutor {

	process: ChildProcessWithoutNullStreams

	constructor(settings: ExecutorSettings, file: string) {
		//use empty array for empty string, instead of [""]
		const args = settings.RArgs ? settings.RArgs.split(" ") : [];
		
		let conArgName = `notebook_connection_${Math.random().toString(16).substring(2)}`;

		// This is the R repl. 
		// It's coded by itself because Rscript has no REPL, and adding an additional dep on R would be lazy.
		//It doesn't handle printing by itself because of the need to print the sigil, so
		//   it's really more of a REL.
		args.unshift(`-e`, 
			/*R*/
			`${conArgName}=file("stdin", "r"); while(1) { eval(parse(text=tail(readLines(con = ${conArgName}, n=1)))) }`
		)
		

		super(settings, settings.RPath, args, file, "r");
	}

	/**
	 * Writes a single newline to ensure that the stdin is set up correctly.
	 */
	async setup() {
		console.log("setup");
		//this.process.stdin.write("\n");
	}
	
	wrapCode(code: string, finishSigil: string): string {		
		return `tryCatch({ 

ak <- evaluate::evaluate( ${JSON.stringify(code)} )

what <- lapply(ak , class)  

out <- c("")

for(i in 1:length(ak)){
  if(what[[i]][1]  == "character"){
    out <- paste0(out,ak[[i]])
  }
  if(what[[i]][1] == "rlang_message"){

    out <- paste0(ak[[i]],out)
  }
  if(what[[i]][1] == "recordedplot"){
   tempFile = tempfile(pattern = "file", tmpdir = tempdir(), fileext = ".png")
   png(tempFile);ak[[i]]; dev.off(); 
   out <- paste0(out,paste0('\${TOGGLE_HTML_SIGIL}<img src="file:///',tempFile,'}" align="center">\${TOGGLE_HTML_SIGIL}'))

   }



print(out)


},error = function(e){
  cat(sprintf("%s", e), file=stderr())
}, 
		finally = {
			cat(${JSON.stringify(finishSigil)});
			flush.console()
		})`.replace(/\r?\n/g, "") +
			"\n";
	}
	
	removePrompts(output: string, source: "stdout" | "stderr"): string {
		return output;
	}

}
