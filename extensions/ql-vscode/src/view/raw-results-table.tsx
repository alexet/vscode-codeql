import * as React from "react";
import { UrlValue, ColumnKind, ColumnValue, EntityValue, PAGE_SIZE, Column } from "../bqrs-cli-types";
import { getPage } from "./parserApi";
import { RawResults, SortState, SortDirection,  ResultPageSpecifier, sameResultPageSpecifier } from "../interface-types";
import { renderLocation, className, zebraStripe } from "./result-table-utils";
import { ResolvableLocationValue, LocationStyle } from "../locations";
import { assertNever } from "../helpers-pure";
import { PageNumbers } from "./paged-table-utils";



export interface RawPageProps {
  initialIndex: number;
  runId: number;
  rows: ResultValue[][];
  schema: RawResults;
  sortState: SortState | null;
  toggleCallback: (column: number) => void;
}

/**
 * Render one column of a tuple.
 */
function renderTupleValue(v: ResultValue, runId: number): JSX.Element {
  if (typeof v === 'string') {
    return <span>{v}</span>
  }
  else {
    return renderLocation(v.locationUri, v.label, runId);
  }
}

export class RawTablePage extends React.Component<RawPageProps, {}> {
  constructor(props: RawPageProps) {
    super(props);
  }

  render(): React.ReactNode {
    const { rows, runId, schema, initialIndex, sortState, toggleCallback } = this.props;
   
    const tableRows = rows.map((row, rowIndex) =>
    <tr key={rowIndex} {...zebraStripe(rowIndex)}>
      {
        [
          <td key={-1}>{rowIndex + initialIndex + 1}</td>,
          ...row.map((value, columnIndex) =>
            <td key={columnIndex}>
              {
                renderTupleValue(value, runId)
              }
            </td>)
        ]
      }
    </tr>
  );

    return <table className={className}>
      <thead>
        <tr>
          {
            [
              <th key={-1}><b>#</b></th>,
              ...schema.columns.map((col, index) => {
                const displayName = col.name || `[${index}]`;
                const sortDirection = sortState && index === sortState.columnIndex ? sortState.direction : undefined;
                return <th className={"sort-" + (sortDirection !== undefined ? SortDirection[sortDirection] : "none")} key={index} onClick={() => toggleCallback(index)}><b>{displayName}</b></th>;
              })
            ]
          }
        </tr>
      </thead>
      <tbody>
        {tableRows}
      </tbody>
    </table>;
  }
}


export interface PagedRawTableProps {
  resultSet: RawResults;
  runId: number;
}



interface PagedRawTableState {
  currentPage: ResultPageSpecifier
  currentVisiblePage: ResultPageSpecifier | null
  currentVisibleSet: ResultValue[][] | null,
}


export class PagedRawTable extends React.Component<PagedRawTableProps, PagedRawTableState> {
  _isMounted = false;

  constructor(props: PagedRawTableProps) {
    super(props);
    this.state = { currentPage: { page: 0, resultSetName: props.resultSet.name, runId: props.runId, sortState : null}, currentVisiblePage : null,  currentVisibleSet: null };
    this.refreshResults();
  }

  render(): React.ReactNode {
    const { resultSet, runId } = this.props;
    const { currentVisibleSet, currentPage } = this.state;
    const pageCallback = (selectedPage: number) => {this.setState(prevSate => {
      return {currentPage : {...prevSate.currentPage, page :selectedPage}};
     });}
    return <>
      <PageNumbers pages={Math.floor((resultSet.rows - 1) / PAGE_SIZE) + 1} selected={currentPage.page} onPageSelected={pageCallback}/>
      {
        !this.state.currentVisiblePage || !sameResultPageSpecifier(this.state.currentPage, this.state.currentVisiblePage) ? "Loading results ..." : null
      }
      {
        (currentVisibleSet) ?
          <RawTablePage initialIndex={currentPage.page * PAGE_SIZE} rows={currentVisibleSet} schema={resultSet} runId={runId}
            sortState={currentPage.sortState} toggleCallback={col => this.toggleSort(col)}
          />
          : null
      }
    </>
  }

  private toggleSort(index: number) {
    this.setState(prevState => {
      const sortState = this.state.currentPage.sortState;
      const prevDirection = sortState && sortState.columnIndex === index ? sortState.direction : undefined;
      const nextDirection = nextSortDirection(prevDirection);
      const nextSortState = nextDirection === null ? null : {
        columnIndex: index,
        direction: nextDirection
      };
      return { currentPage: { ...prevState.currentPage, sortState: nextSortState } };
    });
  }

  static getDerivedStateFromProps(nextProps: Readonly<PagedRawTableProps>,
    prevState: PagedRawTableState): Partial<PagedRawTableState> | null {

    // Only update if `resultsInfo` changed.
    if (nextProps.runId !== prevState.currentPage.runId || nextProps.resultSet.name !== prevState.currentPage.resultSetName) {
      return {
        currentPage: {
          page: 0,
          runId: nextProps.runId,
          resultSetName: nextProps.resultSet.name,
          sortState: null,
        },
        currentVisibleSet: null,
        currentVisiblePage: null
      };
    }
    return null;
  }

  componentDidUpdate(prevProps: Readonly<PagedRawTableProps>, prevState: Readonly<PagedRawTableState>):
    void {
    if (!sameResultPageSpecifier(this.state.currentPage, prevState.currentPage)) {
      this.refreshResults();
    }
  }


  componentDidMount() {
    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }
  private refreshResults() {
    this.loadResults(this.state.currentPage);
  }


  private async loadResults(pageId : ResultPageSpecifier) {
    const columns = this.props.resultSet.columns;
    const results = await getResultSetChunk(pageId, columns);
    if (this._isMounted) {
      this.setState(prevSate => {
        if (results && sameResultPageSpecifier(pageId, prevSate.currentPage)) {
          return { currentVisibleSet: results, currentVisiblePage: pageId };
        } else {
          return { currentVisibleSet: prevSate.currentVisibleSet, currentVisiblePage: prevSate.currentVisiblePage };
        }
      });
    }
  }
}




async function getResultSetChunk(pageId: ResultPageSpecifier, columns : Column[]): Promise<ResultValue[][] | undefined> {
  const page = await getPage(pageId);
  if (!page) {
    return;
  }
  const columnTypes = columns.map((column) => column.kind);
  const rows: ResultValue[][] = [];

  page.tuples.forEach((tuple) => {
    const row: ResultValue[] = [];
    tuple.forEach((value, index) => {
      const type = columnTypes[index];
      row.push(translateElement(type, value));
    });
    rows.push(row);
  });
  return rows;
};

export interface LocatedResultValue {
  label: string;
  locationUri?: ResolvableLocationValue
}

type ResultValue = LocatedResultValue | string;

function translateElement(type: ColumnKind, value: ColumnValue): ResultValue {
  switch (type) {
    case 'i':
    case 'f':
    case 's':
    case 'd':
    case 'b':
      return value.toString();
    case 'e':
      const ev: EntityValue = value as EntityValue;

      const loc = ev.url === undefined ? undefined : translateLocation(ev.url);
      return { label: ev.label || "", locationUri: loc };
  }
}


function translateLocation(location: UrlValue): ResolvableLocationValue | undefined {
  if (typeof location === "string") {
    return undefined
  } else if (location.startLine !== undefined) {
    if (location.startLine == 0 && location.endLine == 0 && location.startColumn == 0 && location.endLine == 0) {
      return { t: LocationStyle.WholeFile, uri: location.uri }
    }
    return { t: LocationStyle.FivePart, lineStart: location.startLine, lineEnd: location.endLine, colStart: location.startColumn, colEnd: location.endLine, uri: location.uri };
  } else {
    return undefined
  }

}

function nextSortDirection(direction: SortDirection | undefined): SortDirection {
  switch (direction) {
    case SortDirection.asc:
      return SortDirection.desc;
    case SortDirection.desc:
    case undefined:
      return SortDirection.asc;
    default:
      return assertNever(direction);
  }
}
