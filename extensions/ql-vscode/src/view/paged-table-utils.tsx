import * as React from "react";

/**
 * 
 * @param props A page number widget
 */
export function PageNumbers(props: {pages: number, selected: number, onPageSelected : (pageNumber : number) => void}): React.ReactElement<any> {
  function makePageLink(pageNumber: number): React.ReactNode {
    return <a href="#" onClick={(e) => {
      props.onPageSelected(pageNumber)
      e.preventDefault();
      e.stopPropagation();
    }} key={pageNumber}>{pageNumber + 1}</a>
  }
  let elements: React.ReactNode[] = [];
  let index = 0;
  while (index < props.selected && index < 3) {
    elements.push(makePageLink(index++));
    elements.push(", ")
  }
  if (index < props.selected - 5) {
    elements.push(<span key="e1">...</span>);
    index = props.selected - 3;
    elements.push(", ")
  }
  while (index < props.selected) {
    elements.push(makePageLink(index++));
    elements.push(", ")
  }
  elements.push(<span key={index}>{(index++) + 1}</span>);
  elements.push(", ")
  while (index < props.pages && index < props.selected + 3) {
    elements.push(makePageLink(index++));
    elements.push(", ")
  }
  if (index < props.pages - 5) {
    elements.push(<span key="e2">...</span>);
    elements.push(", ")
    index = props.pages - 3;
  }
  while (index < props.pages) {
    elements.push(makePageLink(index++));
    elements.push(", ")
  }
  // Remove trailing comma
  if (elements.length > 0)
    elements.pop();

  return <span>
    {
      elements
    }
  </span>
}
