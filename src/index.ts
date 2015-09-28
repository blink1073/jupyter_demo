/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use-strict';

import {
  DockPanel
} from '../node_modules/phosphor-dockpanel';

import {
  Message
} from '../node_modules/phosphor-messaging';

import {
  Tab
} from '../node_modules/phosphor-tabs';

import {
  ResizeMessage, Widget, attachWidget
} from '../node_modules/phosphor-widget';

import {
  Terminal, ITerminalConfig
} from 'term.js';

import { 
  startNewKernel, Contents
} from './jupyter-js-services/index';

import {
  ActionHandler
} from './actions';

import {
  CodeCell
} from './codecell';

import {
  KeyboardManager
} from './keyboardmanager';

import {
  Tooltip
} from './tooltip';

import './style.min.css';
import './ipython.min.css';
import './index.css';


/**
 * A widget which manages a terminal session.
 */
export
class TerminalWidget extends Widget {
/*
* Construct a new terminal.
*/
constructor(ws_url: string, config?: ITerminalConfig) {
  super();
  this.addClass('TerminalWidget');
  this._ws = new WebSocket(ws_url);
  this._config = config || { useStyle: true };

  this._term = new Terminal(this._config);
  this._term.open(this.node);

  this._term.on('data', (data: string) => {
    this._ws.send(JSON.stringify(['stdin', data]));
  });

  this._ws.onmessage = (event: MessageEvent) => {
    var json_msg = JSON.parse(event.data);
    switch (json_msg[0]) {
      case "stdout":
        this._term.write(json_msg[1]);
        break;
      case "disconnect":
        this._term.write("\r\n\r\n[Finished... Term Session]\r\n");
        break;
      }
    };

    // create a dummy terminal to get row/column size
    this._dummy_term = document.createElement('div');
    this._dummy_term.style.visibility = "hidden";
    var pre = document.createElement('pre');
    var span = document.createElement('span');
    pre.appendChild(span);
    // 24 rows
    pre.innerHTML = "<br><br><br><br><br><br><br><br><br><br><br><br>" +
    "<br><br><br><br><br><br><br><br><br><br><br><br>"
    // 1 row + 80 columns
    span.innerHTML = "012345678901234567890123456789" +
    "012345678901234567890123456789" +
    "01234567890123456789";
    this._dummy_term.appendChild(pre);
    this._term.element.appendChild(this._dummy_term);
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this._term.destroy();
    this._ws = null;
    this._term = null;
    super.dispose();
  }

  get config(): ITerminalConfig {
    return this._config;
  }

  /**
   * Set the configuration of the terminal.
   */
  set config(options: ITerminalConfig) {
    if (options.useStyle) {
      this._term.insertStyle(
        this._term.document, this._term.colors[256], this._term.colors[257]);
    }
    else if (options.useStyle === false) {
      var sheetToBeRemoved = document.getElementById('term-style');
      if (sheetToBeRemoved) {
        var sheetParent = sheetToBeRemoved.parentNode;
        sheetParent.removeChild(sheetToBeRemoved);

      }
    }

    if (options.useStyle !== null) {
      // invalidate terminal pixel size
      this._term_row_height = 0;
    }

    for (var key in options) {
      this._term.options[key] = (<any>options)[key];
    }

    this._config = options;
    // this.resize_term(this.width, this.height);
  }

  /**
   * Handle resizing the terminal itself.
   */
  protected resize_term(width: number, height: number): void {
    if (!this._term_row_height) {
      this._term_row_height = this._dummy_term.offsetHeight / 25;
      this._term_col_width = this._dummy_term.offsetWidth / 80;
      this._dummy_term.style.display = 'none';
    }

    var rows = Math.max(2, Math.floor(height / this._term_row_height) - 2);
    var cols = Math.max(3, Math.floor(width / this._term_col_width) - 2);

    rows = this._config.rows || rows;
    cols = this._config.cols || cols;

    this._term.resize(cols, rows);
  }

  /**
   * Handle resize event.
   */
  protected onResize(msg: ResizeMessage): void {
    this.resize_term(msg.width, msg.height);
  }

  private _ws: WebSocket;
  private _term: any;
  private _dummy_term: HTMLElement;
  private _term_row_height: number;
  private _term_col_width: number;
  private _config: ITerminalConfig;
}

/**
 * A widget which hosts a CodeMirror editor.
 */
class CodeMirrorWidget extends Widget {

  constructor(config?: CodeMirror.EditorConfiguration) {
    super();
    this.addClass('CodeMirrorWidget');
    this._editor = CodeMirror(this.node, config);
  }

  get editor(): CodeMirror.Editor {
    return this._editor;
  }

  loadTarget(target: string): void {
    var doc = this._editor.getDoc();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', target);
    xhr.onreadystatechange = () => doc.setValue(xhr.responseText);
    xhr.send();
  }

  protected onAfterAttach(msg: Message): void {
    this._editor.refresh();
  }

  protected onResize(msg: ResizeMessage): void {
    if (msg.width < 0 || msg.height < 0) {
      this._editor.refresh();
    } else {
      this._editor.setSize(msg.width, msg.height);
    }
  }

  private _editor: CodeMirror.Editor;
}


class DirectoryListing extends Widget {

  static createNode(): HTMLElement {
    var node = document.createElement('div');
    var ul = document.createElement('ul');
    node.appendChild(ul);
    return node;
  }

  constructor(baseUrl) {
    super();
    this.addClass('content');
    this._contents = new Contents(baseUrl);
    document.addEventListener('mousedown', this, true);
    this._currentDir = '';
    this._contents.listContents('.').then((msg) => {
      console.log('msg', msg);
      for (var i = 0; i < msg.content.length; i++ ) {
        var node = document.createElement('li');
        node.innerText = (<any>msg).content[i].path;
        if ((<any>msg).content[i].type === 'directory') {
          node.innerText += '/';
        }
        this.node.firstChild.appendChild(node);
      }
    });
  }

  get onClick(): (string) => void {
    return this._onClick;
  }

  set onClick(cb: (string) => void) {
    this._onClick = cb;
  }

  /**
   * Handle the DOM events for the dock panel.
   *
   * @param event - The DOM event sent to the dock panel.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the dock panel's DOM node. It
   * should not be called directly by user code.
   */
  handleEvent(event: Event): void {
    if (!this.node.contains((<any>event).target)) {
      return;
    }
    if (event.type === 'mousedown') {
      var el = event.target as HTMLElement;
      var text = el.innerText;
      if (text[text.length - 1] == '/') {
        this._currentDir += text;
        this._listDir();
      } else if (text == '..') {
         var parts = this._currentDir.split('/');
         var parts = parts.slice(0, parts.length - 2);
         if (parts.length === 0) {
           this._currentDir = '';
         } else {
           this._currentDir = parts.join('/') + '/';
         }
         this._listDir();
      } else {
        var text = (<HTMLElement>event.target).innerText
        var onClick = this._onClick;
        if (onClick) onClick(this._currentDir + text);
      }
    }
  }

  _listDir() {

    while (this.node.firstChild.hasChildNodes()) {
       this.node.firstChild.removeChild(this.node.firstChild.lastChild);
    }

    if (this._currentDir.lastIndexOf('/') !== -1) {
      var node = document.createElement('li');
      node.innerText = '..';
      this.node.firstChild.appendChild(node);
    }

    var path = this._currentDir.slice(0, this._currentDir.length - 1);
    this._contents.listContents(path).then((msg) => {
      for (var i = 0; i < msg.content.length; i++ ) {
        var node = document.createElement('li');
        node.innerText = (<any>msg).content[i].name;
        if ((<any>msg).content[i].type === 'directory') {
          node.innerText += '/';
        }
        this.node.firstChild.appendChild(node);
      }
    });
  }

  private _currentDir = '';
  private _onClick = null;
  private _contents: Contents = null;
}


class Notebook extends Widget {

  static createNode(): HTMLElement {
    var node = document.createElement('div');
    var container = document.createElement('div');
    container.className = 'container';
    container.setAttribute('id', 'notebook-container');
    node.appendChild(container);
    return node;
  }

  constructor(kernelOptions) {
    super();
    this.addClass('content');
    startNewKernel(kernelOptions).then((kernel) => {
      console.log('Kernel started');
      var Events = function () {};
      this._events = $([new Events()]);
      var env = { notebook: this };

      this._actions = new ActionHandler({ env: env });

      this._manager = new KeyboardManager({
          notebook: this,
          events: this._events, 
          actions: this._actions });
      this._manager.mode = 'edit';

      this._tooltip = new Tooltip(this._events);

      var options = {
        keyboard_manager: this._manager,
        events: this._events,
        tooltip: this._tooltip
      }

      var cell = new CodeCell(kernel, options);
      this.node.children[0].appendChild(cell.element[0]);
      cell.set_input_prompt();
      console.log('set up code cell');

      this._events.trigger('create.Cell', {'cell': cell, 'index': 0});
      cell.select();
      cell.focus_editor();
      cell.render();
      cell.refresh();

      setTimeout(() => {
        cell.code_mirror.setValue('.'); 
        cell.code_mirror.focus(); 
        cell.code_mirror.setValue('from IPython.display import HTML\nHTML("<h1>Hello, world!</h1>")'); 
      }, 100);

      this._cells = [cell];
      this._kernel = kernel;
    });
  }

  execute_cell_and_select_below() {
    this._cells[this._cells.length - 1].execute();
    this._cells[this._cells.length - 1].unselect();
    var options = {
      keyboard_manager: this._manager,
      events: this._events,
      tooltip: this._tooltip
    }
    var cell = new CodeCell(this._kernel, options);
    this.node.children[0].appendChild(cell.element[0]);
    cell.set_input_prompt();
    console.log('set up new code cell');

    this._events.trigger('create.Cell', {'cell': cell, 
                         'index': this._cells.length});
    cell.select();
    cell.selection_anchor = true;
    cell.focus_editor();
    cell.refresh();

    this._cells.push(cell);
  }

  private _events: any = null;
  private _actions: any = null;
  private _manager: any = null;
  private _tooltip: any = null;
  private _kernel: any = null;
  private _cells: any[] = null;
}


function main(): void {

  // Codemirror tab
  //
  var cm = new CodeMirrorWidget({
    mode: 'text',
    lineNumbers: true,
    tabSize: 2,
  });
  cm.editor.getDoc().setValue('import numpy as np\nx = np.ones(3)'); 
  var cmTab = new Tab('Editor');
  DockPanel.setTab(cm, cmTab);

  // Terminal tab
  //
  var protocol = (window.location.protocol.indexOf("https") === 0) ? "wss" : "ws";
  var wsUrl = protocol + "://" + window.location.host + "/websocket";
  var term = new TerminalWidget(wsUrl);
  var termTab = new Tab('Terminal');
  DockPanel.setTab(term, termTab);

  var panel = new DockPanel();
  panel.id = 'main';

  // notebook tab
  var kernelOptions = {
    baseUrl: 'http://localhost:8888',
    wsUrl: 'ws://localhost:8888',
    name: 'python'
  }
  var notebook = new Notebook(kernelOptions);
  var notebookTab = new Tab('Notebook');
  DockPanel.setTab(notebook, notebookTab);

  // directory listing tab
  var listing = new DirectoryListing('http://localhost:8888');
  var listingTab = new Tab('Directory Listing');
  DockPanel.setTab(listing, listingTab);

  listing.onClick = (path) => {
    cm.loadTarget(path);
  }
 
  panel.addWidget(cm);
  panel.addWidget(term, DockPanel.SplitBottom, cm);
  panel.addWidget(listing, DockPanel.SplitLeft, term);
  panel.addWidget(notebook, DockPanel.SplitLeft,cm);

  attachWidget(panel, document.body);
  panel.update();
  window.onresize = () => panel.update();
}

window.onload = main;

