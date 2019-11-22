import * as React from 'react';
import { toggleDiagnosticsClassName, tableSelectionHeaderClassName } from './result-table-utils';
import { vscode } from './results';
import { ResultsInfo, Results } from '../interface-types';
import { PathTable } from './alert-table';
import { PagedRawTable } from './raw-results-table';

/**
 * Properties for the `ResultTables` component.
 */
export interface ResultTablesProps {
  results: ResultsInfo;
}

/**
 * State for the `ResultTables` component.
 */
interface ResultTablesState {
  results: ResultsInfo,
  selectedTable: string;// name of selected result set
}

const ALERTS_TABLE_NAME = 'alerts';
const SELECT_TABLE_NAME = '#select';



function getResultCount(resultSet: Results): number {
  switch (resultSet.t) {
    case 'raw':
      return resultSet.rows;
    case 'alerts':
      if (resultSet.interpretation.sarif.runs.length === 0) return 0;
      if (resultSet.interpretation.sarif.runs[0].results === undefined) return 0;
      return resultSet.interpretation.sarif.runs[0].results.length + resultSet.interpretation.numTruncatedResults;
  }
}

function renderResultCountString(resultSet: Results): JSX.Element {
  const resultCount = getResultCount(resultSet);
  return <span className="number-of-results">
    {resultCount} {resultCount === 1 ? 'result' : 'results'}
  </span>;
}

/**
 * Displays multiple `ResultTable` tables, where the table to be displayed is selected by a
 * dropdown.
 */
export class ResultTables
  extends React.Component<ResultTablesProps, ResultTablesState> {

  constructor(props: ResultTablesProps) {
    super(props);

    this.state = {
      results: props.results,
      selectedTable: ResultTables.getDefaultResultSet(props.results.resultsInfo)
    };
  }

  static getDerivedStateFromProps(nextProps: Readonly<ResultTablesProps>,
    prevState: ResultTablesState): Partial<ResultTablesState> | null {

    // Only update if `resultsInfo` changed.
    if (nextProps.results !== prevState.results) {
      return {
        results: nextProps.results,
        selectedTable: ResultTables.getDefaultResultSet(nextProps.results.resultsInfo)
      };
    }

    return null;
  }

  private static getDefaultResultSet(resultSets: readonly Results[]): string {
    const resultSetNames = resultSets.map(resultSet => resultSet.name)
    // Choose first available result set from the array
    return [ALERTS_TABLE_NAME, SELECT_TABLE_NAME, resultSets[0].name].filter(resultSetName => resultSetNames.includes(resultSetName))[0];
  }

  private onChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.setState({ selectedTable: event.target.value });
  }


  render(): React.ReactNode {
    const selectedTable = this.state.selectedTable;
    const resultSets = this.props.results.resultsInfo;

    const selectedTableData = resultSets.find(t => t.name === selectedTable) || resultSets[0];
    let table;

    if (selectedTableData.t === "raw") {
      table = <PagedRawTable runId={this.props.results.runId} resultSet={selectedTableData} />
    } else {
      table = <>
        <div className={toggleDiagnosticsClassName}>
          <input type="checkbox" id="toggle-diagnostics" name="toggle-diagnostics" onChange={(e) => {
            vscode.postMessage({
              t: 'toggleDiagnostics',
              runId: this.props.results.runId,
              visible: e.target.checked,
            });
          }} />
          <label htmlFor="toggle-diagnostics">Show results in Problems view</label>
        </div>
        <PathTable runId={this.props.results.runId} sarif={selectedTableData.interpretation.sarif} sourceLocationPrefixUri={selectedTableData.interpretation.sourceLocationPrefixUri}
          numTruncatedResults={selectedTableData.interpretation.numTruncatedResults}
        />
      </>
    }

    const resultSet = resultSets.find(resultSet => resultSet.name == selectedTable);
    const numberOfResults = resultSet && renderResultCountString(selectedTableData);

    return <div>
      <div className={tableSelectionHeaderClassName}>
        <select value={selectedTable} onChange={this.onChange}>
          {
            resultSets.map(resultSet =>
              <option key={resultSet.name} value={resultSet.name}>
                {resultSet.name}
              </option>
            )
          }
        </select>
        {numberOfResults}
      </div>
      {table}
    </div>;
  }
}