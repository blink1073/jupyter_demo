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
} from 'phosphor-messaging';

import {
  Tab
} from 'phosphor-tabs';

import {
  ResizeMessage, Widget, attachWidget
} from 'phosphor-widget';

import {
  Terminal, ITerminalConfig
} from 'term.js';

import { 
  startNewKernel, Contents
} from '../jupyter-js-services/index';

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

  loadFile(name: string, contents: string): void {
    var doc = this._editor.getDoc();
    if (name.indexOf('.py') !== -1) {
      this._editor.setOption('mode', 'python');
    } else if (name.indexOf('.ts') !== -1) {
      this._editor.setOption('mode', 'text/typescript');
    } else if (name.indexOf('.js') !== -1) {
      this._editor.setOption('mode', 'text/javascript');
    } else if (name.indexOf('.css') !== -1) {
      this._editor.setOption('mode', 'text/css');
    } else {
      this._editor.setOption('mode', 'text');
    }
    doc.setValue(contents);
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


class FileBrowser extends Widget {

  static createNode(): HTMLElement {
    var node = document.createElement('div');
    var inner = document.createElement('div');
    inner.className = 'list_container';
    node.appendChild(inner);
    return node;
  }

  constructor(baseUrl, currentDir) {
    super();
    this.addClass('content');
    this._contents = new Contents(baseUrl);
    document.addEventListener('mousedown', this, true);
    this._currentDir = currentDir;
  }

  get onClick(): (name: string, contents: string) => void {
    return this._onClick;
  }

  set onClick(cb: (name: string, contents: string) => void) {
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
      var text = el.textContent;
      if (text[text.length - 1] == '/') {
        this._currentDir += text;
        this.listDir();
      } else if (text == '..') {
         var parts = this._currentDir.split('/');
         var parts = parts.slice(0, parts.length - 2);
         if (parts.length === 0) {
           this._currentDir = '';
         } else {
           this._currentDir = parts.join('/') + '/';
         }
         this.listDir();
      } else {
        var path = this._currentDir + (<HTMLElement>event.target).textContent;
        this._contents.get(path, { type: "file" }).then(msg => {
          var onClick = this._onClick;
          if (onClick) onClick(msg.path, msg.content);
        });
      }
    }
  }

  listDir() {

    while (this.node.firstChild.hasChildNodes()) {
       this.node.firstChild.removeChild(this.node.firstChild.lastChild);
    }

    if (this._currentDir.lastIndexOf('/') !== -1) {
      this._addItem('..', true);
    }

    var path = this._currentDir.slice(0, this._currentDir.length - 1);
    this._contents.listContents(path).then((msg) => {
      for (var i = 0; i < msg.content.length; i++ ) {
        if ((<any>msg).content[i].type === 'directory') {
          this._addItem((<any>msg).content[i].name + '/', true);
        } else {
          this._addItem((<any>msg).content[i].name, false);
        }
      }
    });
  }

  private _addItem(text: string, isDirectory: boolean) {
    var top = document.createElement('div');
    top.className = 'list_item'
    top.classList.add('row');
    var node = document.createElement('div');
    node.classList.add('col-md-12');
    var inode = document.createElement('i');
    inode.className = 'item_icon';
    inode.style.display = 'inline-block'
    var lnode = document.createElement('div');
    lnode.className = 'item_link';
    lnode.classList.add('row');
    inode.classList.add('icon-fixed-width');
    lnode.style.display = 'inline-block';
    lnode.textContent = text;
    if (isDirectory) {
      inode.classList.add('folder_icon');
    } else {
      inode.classList.add('file_icon');
    }
    node.appendChild(inode);
    node.appendChild(lnode);
    top.appendChild(node);
    this.node.firstChild.appendChild(top);

  }

  private _currentDir = '';
  private _onClick: (name: string, contents: string) => void = null;
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
    mode: 'python',
    lineNumbers: true,
    tabSize: 2,
  });
  cm.editor.getDoc().setValue('import numpy as np\nx = np.ones(3)'); 
  var cmTab = new Tab('Editor');
  DockPanel.setTab(cm, cmTab);

  // Terminal tab
  //
  var wsUrl = "ws://localhost:8888/terminals/websocket/1"
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
  var listing = new FileBrowser('http://localhost:8888', '');
  var listingTab = new Tab('File Browser');
  DockPanel.setTab(listing, listingTab);
  listing.listDir();

  listing.onClick = (path, contents) => {
    cm.loadFile(path, contents);
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

