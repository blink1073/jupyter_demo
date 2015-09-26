/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';

import $ = require('jQuery');

import { 
  startNewKernel
} from 'jupyter-js-services';

import {
  KeyboardManager
} from './keyboardmanager';

import {
  ToolTip
} from './tooltip';

import './style.min.css';
import './ipython.min.css':


function main(): void {
  var Events = function () {};
  events = $([new Events()]);

  var manager = new KeyboardManager(events);
  var tooltop = new ToolTip(events);

  var kernelOptions = {
    baseUrl: 'http://localhost:8888',
    wsUrl: 'ws://localhost:8888',
    name: 'python'
  }
  startNewKernel(options).then((kernelOptions) => {
    options = {
      keyboard_manager: manager,
      events: events,
      tooltop: tooltip
    }
    var codeCell = new CodeCell(kernel, options);
    cell.set_input_prompt();
    // TODO: add to the DOM
    cell.render();
    events.trigger('create.Cell', {'cell': cell, 'index': 0});
    cell.refresh();
  }

}

window.onload = main;
