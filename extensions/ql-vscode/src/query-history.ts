import * as vscode from 'vscode';
import { ExtensionContext, window as Window } from 'vscode';
import { QueryHistoryConfig } from './config';
import { CompletedQuery } from './query-results';
import { QueryWithResults } from './run-queries';
/**
 * query-history.ts
 * ------------
 * Managing state of previous queries that we've executed.
 *
 * The source of truth of the current state resides inside the
 * `TreeDataProvider` subclass below.
 */

/**
 * Tree data provider for the query history view.
 */
class HistoryTreeDataProvider implements vscode.TreeDataProvider<CompletedQuery> {

  /**
   * XXX: This idiom for how to get a `.fire()`-able event emitter was
   * cargo culted from another vscode extension. It seems rather
   * involved and I hope there's something better that can be done
   * instead.
   */
  private _onDidChangeTreeData: vscode.EventEmitter<CompletedQuery | undefined> = new vscode.EventEmitter<CompletedQuery | undefined>();
  readonly onDidChangeTreeData: vscode.Event<CompletedQuery | undefined> = this._onDidChangeTreeData.event;

  private history: CompletedQuery[] = [];

  /**
   * When not undefined, must be reference-equal to an item in `this.databases`.
   */
  private current: CompletedQuery | undefined;

  constructor() {
    this.history = [];
  }

  getTreeItem(element: CompletedQuery): vscode.TreeItem {
    const it = new vscode.TreeItem(element.toString());

    it.command = {
      title: 'Query History Item',
      command: 'codeQLQueryHistory.itemClicked',
      arguments: [element],
    };

    return it;
  }

  getChildren(element?: CompletedQuery): vscode.ProviderResult<CompletedQuery[]> {
    if (element == undefined) {
      return this.history;
    }
    else {
      return [];
    }
  }

  getParent(_element: CompletedQuery): vscode.ProviderResult<CompletedQuery> {
    return null;
  }

  getCurrent(): CompletedQuery | undefined {
    return this.current;
  }

  push(item: CompletedQuery): void {
    this.current = item;
    this.history.push(item);
    this.refresh();
  }

  setCurrentItem(item: CompletedQuery) {
    this.current = item;
  }

  remove(item: CompletedQuery) {
    if (this.current === item)
      this.current = undefined;
    const index = this.history.findIndex(i => i === item);
    if (index >= 0) {
      this.history.splice(index, 1);
      if (this.current === undefined && this.history.length > 0) {
        // Try to keep a current item, near the deleted item if there
        // are any available.
        this.current = this.history[Math.min(index, this.history.length - 1)];
      }
      this.refresh();
    }
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }
}

/**
 * Number of milliseconds two clicks have to arrive apart to be
 * considered a double-click.
 */
const DOUBLE_CLICK_TIME = 500;

export class QueryHistoryManager {
  treeDataProvider: HistoryTreeDataProvider;
  ctx: ExtensionContext;
  treeView: vscode.TreeView<CompletedQuery>;
  selectedCallback: ((item: CompletedQuery) => void) | undefined;
  lastItemClick: { time: Date, item: CompletedQuery } | undefined;


  async invokeCallbackOn(queryHistoryItem: CompletedQuery) {
    if (this.selectedCallback !== undefined) {
      const sc = this.selectedCallback;
      await sc(queryHistoryItem);
    }
  }

  async handleOpenQuery(queryHistoryItem: CompletedQuery) {
    const textDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(queryHistoryItem.query.program.queryPath));
    await vscode.window.showTextDocument(textDocument, vscode.ViewColumn.One);
  }

  async handleRemoveHistoryItem(queryHistoryItem: CompletedQuery) {
    this.treeDataProvider.remove(queryHistoryItem);
    const current = this.treeDataProvider.getCurrent();
    if (current !== undefined) {
      this.treeView.reveal(current);
      await this.invokeCallbackOn(current);
    }
  }

  async handleSetLabel(queryHistoryItem: CompletedQuery) {
    const response = await vscode.window.showInputBox({
      prompt: 'Label:',
      placeHolder: '(use default)',
      value: queryHistoryItem.getLabel(),
    });
    // undefined response means the user cancelled the dialog; don't change anything
    if (response !== undefined) {
      if (response === '')
        // Interpret empty string response as "go back to using default"
        queryHistoryItem.label = undefined;
      else
        queryHistoryItem.label = response;
      this.treeDataProvider.refresh();
    }
  }

  async handleItemClicked(queryHistoryItem: CompletedQuery) {
    this.treeDataProvider.setCurrentItem(queryHistoryItem);

    const now = new Date();
    const prevItemClick = this.lastItemClick;
    this.lastItemClick = { time: now, item: queryHistoryItem };

    if (prevItemClick !== undefined
      && (now.valueOf() - prevItemClick.time.valueOf()) < DOUBLE_CLICK_TIME
      && queryHistoryItem == prevItemClick.item) {
      // show original query file on double click
      await this.handleOpenQuery(queryHistoryItem);
    }
    else {
      // show results on single click
      await this.invokeCallbackOn(queryHistoryItem);
    }
  }

  constructor(
    ctx: ExtensionContext,
    private queryHistoryConfigListener: QueryHistoryConfig,
    selectedCallback?: (item: CompletedQuery) => Promise<void>
  ) {
    this.ctx = ctx;
    this.selectedCallback = selectedCallback;
    const treeDataProvider = this.treeDataProvider = new HistoryTreeDataProvider();
    this.treeView = Window.createTreeView('codeQLQueryHistory', { treeDataProvider });
    this.treeView.onDidChangeSelection(async ev => {
      if (ev.selection.length == 0) {
        const current = this.treeDataProvider.getCurrent();
        if (current != undefined)
          this.treeView.reveal(current); // don't allow selection to become empty
      }
    });
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.openQuery', this.handleOpenQuery));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.removeHistoryItem', this.handleRemoveHistoryItem.bind(this)));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.setLabel', this.handleSetLabel.bind(this)));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.itemClicked', async (item) => {
      return this.handleItemClicked(item);
    }));
    queryHistoryConfigListener.onDidChangeQueryHistoryConfiguration(() => {
      this.treeDataProvider.refresh();
    });
  }

  addQuery(info: QueryWithResults): CompletedQuery {
    const item = new CompletedQuery(info, this.queryHistoryConfigListener);
    this.treeDataProvider.push(item);
    this.treeView.reveal(item, { select: true });
    return item;
  }
}
