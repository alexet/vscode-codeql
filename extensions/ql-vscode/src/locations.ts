
export interface LineColumnLocation {
    t: LocationStyle.FivePart;
    uri: string;
    lineStart: number;
    colStart: number;
    lineEnd: number;
    colEnd: number;
}

export interface OffsetLengthLocation {
    t: LocationStyle.OffsetLength;
    uri: string;
    offset: number;
    length: number;
}
export interface UriLocation {
    t: LocationStyle.String;
    loc: string;
}
/**
 * A location representing an entire filesystem resource.
 * This is usually derived from a `StringLocation` with the entire filesystem URL.
 */
export interface WholeFileLocation {
    t: LocationStyle.WholeFile;
    uri: string;
}
export type RawLocationValue = LineColumnLocation | UriLocation | OffsetLengthLocation;
export type LocationValue = RawLocationValue | WholeFileLocation;
/** A location that may (currently) be resolved to a source code element. */
export type ResolvableLocationValue = LineColumnLocation | WholeFileLocation;

export enum LocationStyle {
    None = 0,
    String = 1,
    FivePart = 2,
    OffsetLength = 3,
    WholeFile = 4
}

/**
 * Gets a resolvable source file location for the specified `LocationValue`, if possible.
 * @param loc The location to test.
 */
export function tryGetResolvableLocation(loc: LocationValue | undefined): ResolvableLocationValue | undefined {
    if (loc === undefined) {
      return undefined;
    }
    else if ((loc.t === LocationStyle.FivePart) && loc.uri) {
      return loc;
    }
    else if ((loc.t === LocationStyle.WholeFile) && loc.uri) {
      return loc;
    }
    else {
      return undefined;
    }
  }

  