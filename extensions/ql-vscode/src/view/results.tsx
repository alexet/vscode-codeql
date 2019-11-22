import * as React from 'react';
import * as Rdom from 'react-dom';
import { assertNever } from '../helpers-pure';
import { FromResultsViewMsg,  IntoResultsViewMsg, ResultsInfo, NavigatePathMsg } from '../interface-types';
import { ResultTables } from './result-tables';
import { EventHandlers as EventHandlerList } from './event-handler-list';

/**
 * results.tsx
 * -----------
 *
 * Displaying query results.
 */

interface VsCodeApi {
  /**
   * Post message back to vscode extension.
   */
  postMessage(msg: FromResultsViewMsg): void;
}
declare const acquireVsCodeApi: () => VsCodeApi;
export const vscode = acquireVsCodeApi();

interface ResultsState {
  // We use `null` instead of `undefined` here because in React, `undefined` is
  // used to mean "did not change" when updating the state of a component.
  resultsInfo: ResultsInfo | null;
  errorMessage: string;
}

interface ResultsViewState {
  displayedResults: ResultsState;
  isExpectingResultsUpdate: boolean;
}

export type NavigationEvent = NavigatePathMsg;

/**
 * Event handlers to be notified of navigation events coming from outside the webview.
 */
export const onNavigation = new EventHandlerList<NavigationEvent>();

/**
 * A minimal state container for displaying results.
 */
class App extends React.Component<{}, ResultsViewState> {
  constructor(props: any) {
    super(props);
    this.state = {
      displayedResults: {
        resultsInfo: null,
        errorMessage: ''
      },
      isExpectingResultsUpdate: true
    };
  }

  handleMessage(msg: IntoResultsViewMsg): void {
    switch (msg.t) {
      case 'setQuery':
        this.updateStateWithNewResultsInfo(msg.results);
        break;
      case 'resultsUpdating':
        this.setState({
          isExpectingResultsUpdate: true
        });
        break;
      case 'navigatePath':
        onNavigation.fire(msg);
        break;
      case "setResult":
        // Do nothing
        break;
      default:
        assertNever(msg);
    }
  }

  private updateStateWithNewResultsInfo(resultsInfo: ResultsInfo): void {
    this.setState(prevState => {
      const stateWithDisplayedResults = (displayedResults: ResultsState) => ({
        displayedResults,
        isExpectingResultsUpdate: prevState.isExpectingResultsUpdate,
        nextResultsInfo: resultsInfo
      });

      if (!prevState.isExpectingResultsUpdate && resultsInfo === null) {
        // No results to display
        return stateWithDisplayedResults({
          resultsInfo: null,
          errorMessage: 'No results to display'
        });
      }
      if (!resultsInfo) {
        // Display loading message
        return stateWithDisplayedResults({
          resultsInfo: null,
          errorMessage: 'Loading results…'
        });
      }
      return stateWithDisplayedResults({
        resultsInfo, errorMessage: ""
      });
    });
  }

  render() {
    const displayedResults = this.state.displayedResults;
    if (displayedResults.resultsInfo !== null) {
      return <ResultTables results={displayedResults.resultsInfo}></ResultTables>
    }
    else {
      return <span>{displayedResults.errorMessage}</span>;
    }
  }

  componentDidMount() {
    this.vscodeMessageHandler = evt => this.handleMessage(evt.data as IntoResultsViewMsg);
    window.addEventListener('message', this.vscodeMessageHandler);
  }

  componentWillUnmount() {
    if (this.vscodeMessageHandler) {
      window.removeEventListener('message', this.vscodeMessageHandler);
    }
  }

  private vscodeMessageHandler: ((ev: MessageEvent) => void) | undefined = undefined;
}

Rdom.render(
  <App />,
  document.getElementById('root')
);

vscode.postMessage({ t: "resultViewLoaded" })
