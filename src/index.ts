/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2015, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
'use strict';

import $ = require('jquery');

import { 
  startNewKernel
} from './jupyter-js-services/index';

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


function main(): void {
  var Events = function () {};
  var events = $([new Events()]);

  var manager = new KeyboardManager(events);
  var tooltip = new Tooltip(events);

  var kernelOptions = {
    baseUrl: 'http://localhost:8888',
    wsUrl: 'ws://localhost:8888',
    name: 'python'
  }
  startNewKernel(kernelOptions).then((kernel) => {
    var options = {
      keyboard_manager: manager,
      events: events,
      tooltip: tooltip
    }
    var cell = new CodeCell(kernel, options);
    cell.set_input_prompt();
    // TODO: add to the DOM
    cell.render();
    events.trigger('create.Cell', {'cell': cell, 'index': 0});
    cell.refresh();
  });
}

window.onload = main;
