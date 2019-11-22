import {  QueryWithResults, QueryInfo } from "./run-queries";
import * as messages from './messages';
import * as helpers from './helpers';
import * as cli from './cli';
import * as sarif from 'sarif';
import * as fs from 'fs-extra';
import { SortState, QueryMetadata, sameSortState, ResultsPaths } from "./interface-types";
import { QueryHistoryConfig } from "./config";
import { BQRSInfo, DecodedBqrsChunk, PAGE_SIZE, ResultSetSchema } from "./bqrs-cli-types";


interface SortedResult {
  sortState: SortState;
  sortedSet: string;
  sortedHeader: BQRSInfo;
}

export class CompletedQuery implements QueryWithResults{
  readonly query: QueryInfo;
  readonly result: messages.EvaluationResult;
  readonly time: string;
  public label?: string;

  private sortedResult?: SortedResult;
  private sortInProgress = false;
  private sortQueue: (() => void)[] = [];

  constructor(
    evalaution: QueryWithResults,
    public config: QueryHistoryConfig,
    public header: BQRSInfo | undefined
  ) {
    this.query = evalaution.query;
    this.result = evalaution.result;
    this.time = new Date().toLocaleString();
  }

  get databaseName(): string {
    return this.query.dbItem.name;
  }
  get queryName(): string {
    return helpers.getQueryName(this.query);
  }

  /**
   * Holds if this query should produce interpreted results.
   */
  canInterpretedResults(): Promise<boolean> {
    return this.query.dbItem.hasMetadataFile();
  }

  get statusString(): string {
    switch (this.result.resultType) {
      case messages.QueryResultType.CANCELLATION:
        return `cancelled after ${this.result.evaluationTime / 1000} seconds`;
      case messages.QueryResultType.OOM:
        return `out of memory`;
      case messages.QueryResultType.SUCCESS:
        return `finished in ${this.result.evaluationTime / 1000} seconds`;
      case messages.QueryResultType.TIMEOUT:
        return `timed out after ${this.result.evaluationTime / 1000} seconds`;
      case messages.QueryResultType.OTHER_ERROR:
      default:
        return `failed`;
    }
  }


  interpolate(template: string): string {
    const { databaseName, queryName, time, statusString } = this;
    const replacements: { [k: string]: string } = {
      t: time,
      q: queryName,
      d: databaseName,
      s: statusString,
      '%': '%',
    };
    return template.replace(/%(.)/g, (match, key) => {
      const replacement = replacements[key];
      return replacement !== undefined ? replacement : match;
    });
  }

  getLabel(): string {
    if (this.label !== undefined)
      return this.label;
    return this.config.format;
  }

  private acquireSortLock(): Promise<void> {
    return new Promise((resolve, _reject) => {
      if (!this.sortInProgress) {
        this.sortInProgress = true;
        resolve();
      } else {
        this.sortQueue.push(resolve);
      }
    });
  }

  private releaseSortLock() {
    const next = this.sortQueue.pop();
    if (next) {
      next()
    } else {
      this.sortInProgress = false;
    }
  }

  async getResults(server: cli.CodeQLCliServer, resultName: string, pageNumber: number, sortState?: SortState): Promise<DecodedBqrsChunk | undefined> {
    if (!this.header) {
      return undefined;
    }
    if (sortState) {
      try {
        await this.acquireSortLock();
        const sortedPath  = this.query.resultsPaths.sortedResultsPath;
        if (!this.sortedResult || resultName !== this.sortedResult.sortedSet || !sameSortState(this.sortedResult.sortState, sortState)) {
          if (this.sortedResult) {
            await fs.unlink(sortedPath)

          }
          await server.sortBqrs(this.query.resultsPaths.resultsPath, sortedPath, resultName, [sortState.columnIndex], [sortState.direction]);
          const info = await server.bqrsInfo(sortedPath, PAGE_SIZE);
          this.sortedResult = {
            sortState,
            sortedHeader: info,
            sortedSet: resultName
          };
        }
        const schema = this.sortedResult.sortedHeader["result-sets"][0];
        return await this.decodeResults(server, sortedPath, resultName, schema, pageNumber);
      } finally {
        this.releaseSortLock();
      }
    } else {
      const schema = this.header["result-sets"].filter(rs => rs.name === resultName).pop();
      return await this.decodeResults(server, this.query.resultsPaths.resultsPath, resultName, schema, pageNumber);
    }
  }


  private async decodeResults(server: cli.CodeQLCliServer, resultPath: string,resultName: string, schema : ResultSetSchema | undefined, pageNumber: number): Promise<DecodedBqrsChunk | undefined> {
      if (!schema || ! schema.pagination) {
        return undefined;
      }
      if (!(pageNumber in schema.pagination.offsets)) {
        return undefined;
      }
      const offset = schema.pagination.offsets[pageNumber];
      return await server.bqrsDecode(resultPath, resultName, PAGE_SIZE, offset);
  }

  toString(): string {
    return this.interpolate(this.getLabel());
  }
}

export async function getResultsHeader(server: cli.CodeQLCliServer, info: QueryWithResults): Promise<BQRSInfo | undefined> {
  if (info.result.resultType != messages.QueryResultType.SUCCESS) {
    return undefined;
  }
  return await server.bqrsInfo(info.query.resultsPaths.resultsPath, PAGE_SIZE);
}


/**
 * Call cli command to interpret results.
 */
export async function interpretResults(server: cli.CodeQLCliServer, metadata: QueryMetadata | undefined, resultsPaths: ResultsPaths, sourceInfo?: cli.SourceInfo): Promise<sarif.Log> {
  const interpretedResultsPath = resultsPaths.interpretedResultsPath;

  if (await fs.pathExists(interpretedResultsPath)) {
    return JSON.parse(await fs.readFile(interpretedResultsPath, 'utf8'));
  }
  if (metadata === undefined) {
    throw new Error('Can\'t interpret results without query metadata');
  }
  let { kind, id } = metadata;
  if (kind === undefined) {
    throw new Error('Can\'t interpret results without query metadata including kind');
  }
  if (id === undefined) {
    // Interpretation per se doesn't really require an id, but the
    // SARIF format does, so in the absence of one, we use a dummy id.
    id = "dummy-id";
  }
  return await server.interpretBqrs({ kind, id }, resultsPaths.resultsPath, interpretedResultsPath, sourceInfo);
}