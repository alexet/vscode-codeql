import * as React from 'react';
import { LocationValue, ResolvableLocationValue, tryGetResolvableLocation } from 'semmle-bqrs';
import { SortState } from '../interface-types';
import { ResultSet, vscode } from './results';

export interface ResultTableProps {
  resultSet: ResultSet;
  databaseUri: string;
  resultsPath: string | undefined;
  sortState?: SortState;
}

export const className = 'vscode-codeql__result-table';
export const tableSelectionHeaderClassName = 'vscode-codeql__table-selection-header';
export const toggleDiagnosticsClassName = `${className}-toggle-diagnostics`;
export const evenRowClassName = 'vscode-codeql__result-table-row--even';
export const oddRowClassName = 'vscode-codeql__result-table-row--odd';
export const pathRowClassName = 'vscode-codeql__result-table-row--path';
export const selectedRowClassName = 'vscode-codeql__result-table-row--selected';

export function jumpToLocationHandler(
  loc: ResolvableLocationValue,
  databaseUri: string,
  callback?: () => void
): (e: React.MouseEvent) => void {
  return (e) => {
    jumpToLocation(loc, databaseUri);
    e.preventDefault();
    e.stopPropagation();
    if (callback) callback();
  };
}

export function jumpToLocation(loc: ResolvableLocationValue, databaseUri: string) {
  vscode.postMessage({
    t: 'viewSourceFile',
    loc,
    databaseUri
  });
}

/**
 * Render a location as a link which when clicked displays the original location.
 */
export function renderLocation(loc: LocationValue | undefined, label: string | undefined,
  databaseUri: string, title?: string, callback?: () => void): JSX.Element {

  // If the label was empty, use a placeholder instead, so the link is still clickable.
  let displayLabel = label;
  if (label === undefined || label === '')
    displayLabel = '[empty string]';
  else if (label.match(/^\s+$/))
    displayLabel = `[whitespace: "${label}"]`;

  if (loc !== undefined) {
    const resolvableLoc = tryGetResolvableLocation(loc);
    if (resolvableLoc !== undefined) {
      return <a href="#"
        className="vscode-codeql__result-table-location-link"
        title={title}
        onClick={jumpToLocationHandler(resolvableLoc, databaseUri, callback)}>{displayLabel}</a>;
    } else {
      return <span title={title}>{displayLabel}</span>;
    }
  }
  return <span />
}

/**
 * Returns the attributes for a zebra-striped table row at position `index`.
 */
export function zebraStripe(index: number, ...otherClasses: string[]): { className: string } {
  return { className: [(index % 2) ? oddRowClassName : evenRowClassName, ...otherClasses].join(' ') };
}

/**
 * Returns the attributes for a zebra-striped table row at position `index`,
 * with highlighting if `isSelected` is true.
 */
export function selectableZebraStripe(isSelected: boolean, index: number, ...otherClasses: string[]): { className: string } {
  return isSelected
      ? { className: [selectedRowClassName, ...otherClasses].join(' ') }
      : zebraStripe(index, ...otherClasses)
}
