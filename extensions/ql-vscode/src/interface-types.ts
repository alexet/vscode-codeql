import * as sarif from 'sarif';
import { ResolvableLocationValue } from './locations';
import { Column, DecodedBqrsChunk } from './bqrs-cli-types';

/**
 * Only ever show this many results per run in interpreted results.
 */
export const INTERPRETED_RESULTS_PER_RUN_LIMIT = 100;

/** Arbitrary query metadata */
export interface QueryMetadata {	
  name?: string,	
  description?: string,	
  id?: string,	
  kind?: string	
}
export interface ResultsInfo {
  runId: number;
  resultsInfo: Results[];
}

export interface ResultsPaths {
  resultsPath: string;
  interpretedResultsPath: string;
  sortedResultsPath: string;
}	

export type Results = (RawResults | AlertResults)

export interface RawResults {
  t: "raw"
  name: string,
  rows: number,
  columns: Column[],
}

export interface AlertResults {
  t: "alerts"
  name: string,
  interpretation: Interpretation
}

export interface Interpretation {
  sourceLocationPrefixUri: string;
  numTruncatedResults: number;
  sarif: sarif.Log;
}

/**
 * A message to indicate that the results are being updated.
 *
 * As a result of receiving this message, listeners might want to display a loading indicator.
 */
export interface ResultsUpdatingMsg {
  t: 'resultsUpdating';
}

export interface SetQueryMsg {
  t: 'setQuery';
  results: ResultsInfo;
};

export interface SetValues {
  t: 'setResult';
  resultPage: ResultPageSpecifier
  results: DecodedBqrsChunk;
};

/** Advance to the next or previous path no in the path viewer */
export interface NavigatePathMsg {
  t: 'navigatePath',

  /** 1 for next, -1 for previous */
  direction: number;
}

export type IntoResultsViewMsg = ResultsUpdatingMsg
  | SetQueryMsg
  | NavigatePathMsg
  | SetValues;

export type FromResultsViewMsg = ViewSourceFileMsg
  | ToggleDiagnostics
  | ResultViewLoaded
  | GetPageData;



export interface ViewSourceFileMsg {
  t: 'viewSourceFile';
  loc: ResolvableLocationValue;
  runId: number;
};

export interface ToggleDiagnostics {
  t: 'toggleDiagnostics';
  runId: number;
  visible: boolean;
};

export interface ResultViewLoaded {
  t: 'resultViewLoaded';
};
export interface GetPageData {
  t: 'getPageData';
  resultPage: ResultPageSpecifier
};


export enum SortDirection {
  asc, desc
}


export interface ResultPageSpecifier {
  runId: number;
  page: number;
  resultSetName: string
  sortState: SortState | null;
}

export interface SortState {
  readonly columnIndex: number;
  readonly direction: SortDirection;
}

export function sameSortState(lhs: SortState | null, rhs: SortState | null): boolean {
  if (lhs === rhs) return true;
  if (!lhs || !rhs) return false
  return lhs.columnIndex === rhs.columnIndex && lhs.direction === rhs.direction
}


export function sameResultPageSpecifier(lhs: ResultPageSpecifier, rhs: ResultPageSpecifier): boolean {
  return lhs.page === rhs.page && lhs.resultSetName === rhs.resultSetName && lhs.runId === rhs.runId && sameSortState(lhs.sortState, rhs.sortState);
}

