import { DecodedBqrsChunk } from "../bqrs-cli-types";
import { vscode } from "./results";
import { IntoResultsViewMsg, ResultPageSpecifier, sameResultPageSpecifier } from "../interface-types";




export async function getPage(resultPage: ResultPageSpecifier): Promise<DecodedBqrsChunk | undefined> {
  return new Promise((resolve, reject) => {
    const callback = (event: MessageEvent) => {
      const message = (event.data as IntoResultsViewMsg);
      if (message.t == "setResult") {
        if (sameResultPageSpecifier(message.resultPage, resultPage)) {
          window.removeEventListener('message', callback);
          resolve(message.results)
        }
      }
    };

    window.addEventListener('message', callback);
    vscode.postMessage({
      t: "getPageData",
      resultPage,
    })
  });
}