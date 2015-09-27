/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';

import {
  Widget, attachWidget
} from '../node_modules/phosphor-widget';

import { 
  startNewKernel
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


class Notebook extends Widget {

  static createNode(): HTMLElement {
    var node = document.createElement('div');
    var container = document.createElement('div');
    //container.className = 'container';
    container.setAttribute('id', 'notebook-container');
    var end_space = document.createElement('div');
    end_space.className = 'end_space';
    container.appendChild(end_space);
    node.appendChild(container);
    return node;
  }

  constructor(kernel) {
    super();
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
      cell.code_mirror.setValue(''); 
    }, 100);

    this._cells = [cell];
    this._kernel = kernel;
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

  var kernelOptions = {
    baseUrl: 'http://localhost:8888',
    wsUrl: 'ws://localhost:8888',
    name: 'python'
  }
  startNewKernel(kernelOptions).then((kernel) => {
    console.log('Kernel started');
    var notebook = new Notebook(kernel);
    attachWidget(notebook, document.body);
  });
}

window.onload = main;
