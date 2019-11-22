import * as React from 'react';
import { vscode } from './results';
import { ResolvableLocationValue, LocationValue, tryGetResolvableLocation } from '../locations';

export const className = 'vscode-codeql__result-table';
export const tableSelectionHeaderClassName = 'vscode-codeql__table-selection-header';
export const toggleDiagnosticsClassName = `${className}-toggle-diagnostics`;
export const evenRowClassName = 'vscode-codeql__result-table-row--even';
export const oddRowClassName = 'vscode-codeql__result-table-row--odd';
export const pathRowClassName = 'vscode-codeql__result-table-row--path';
export const selectedRowClassName = 'vscode-codeql__result-table-row--selected';

export function jumpToLocationHandler(
  loc: ResolvableLocationValue,
  runId: number,
  callback?: () => void
): (e: React.MouseEvent) => void {
  return (e) => {
    jumpToLocation(loc, runId);
    e.preventDefault();
    e.stopPropagation();
    if (callback) callback();
  };
}

export function jumpToLocation(loc: ResolvableLocationValue, runId: number) {
  vscode.postMessage({
    t: 'viewSourceFile',
    loc,
    runId
  });
}

/**
 * Render a location as a link which when clicked displays the original location.
 */
export function renderLocation(loc: LocationValue | undefined, label: string | undefined,
  runId: number, title?: string, callback?: () => void): JSX.Element {

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
        onClick={jumpToLocationHandler(resolvableLoc, runId, callback)}>{displayLabel}</a>;
    }
  }
  return<span title={title}>{displayLabel}</span>;
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
