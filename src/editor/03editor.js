

/* editor/editor.js */
(function() {
  'use strict';

  function Editor() {
      Events.call(this);

      this._hooks = { };
  }
  Editor.prototype = Object.create(Events.prototype);


  Editor.prototype.method = function(name, fn) {
      if (this._hooks[name] !== undefined) {
          throw new Error('can\'t override hook: ' + name);
      }
      this._hooks[name] = fn;
  };


  Editor.prototype.methodRemove = function(name) {
      delete this._hooks[name];
  };


  Editor.prototype.call = function(name) {
      if (this._hooks[name]) {
          var args = Array.prototype.slice.call(arguments, 1);

          try {
              return this._hooks[name].apply(null, args);
          } catch(ex) {
              console.info('%c%s %c(editor.method error)', 'color: #06f', name, 'color: #f00');
              console.log(ex.stack);
          }
      }
      return null;
  };


  // editor
  window.editor = new Editor();
})();


// config
(function() {
  'use strict';

  var applyConfig = function(path, value) {
      if (typeof(value) === 'object') {
          for(var key in value) {
              applyConfig((path ? path + '.' : '') + key, value[key]);
          }
      } else {
          Ajax.param(path, value);
      }
  };

  applyConfig('', config);
})();


/* editor/first-load.js */
(function() {
  // first load
  document.addEventListener('DOMContentLoaded', function() {
      editor.call('status:text', 'loading');
      editor.emit('load');
      editor.call('status:text', 'starting');
      editor.emit('start');

      editor.call('status:text', 'ready');

      // if there is a merge in progress for our branch
      var merge = config.self.branch.merge;
      if (merge) {
          // if this user started it then show the conflict manager
          // otherwise if another user started then show the merge in progress overlay
          if (merge.user.id === config.self.id) {
              if (merge.hasConflicts && !merge.beforeReviewFinished) {
                  editor.call('picker:conflictManager');
              } else {
                  editor.call('picker:diffManager');
              }
          } else {
              editor.call('picker:versioncontrol:mergeOverlay');
          }
      } else {
          // open picker if no scene is loaded
          if (!config.scene.id) {
              editor.call('picker:scene');
          }
      }
  }, false);
})();


/* editor/storage/localstorage.js */
editor.once('load', function () {
  // Get a key from the local storage
  editor.method('localStorage:get', function (key) {
      var value = localStorage.getItem(key);
      if (value) {
          try {
              value = JSON.parse(value);
          } catch (e) {
              console.error(e);
          }
      }

      return value;
  });

  // Set a key-value pair in localStorage
  editor.method('localStorage:set', function (key, value) {
      localStorage.setItem(key, JSON.stringify(value));
  });

  // Returns true if the key exists in the local storage
  editor.method('localStorage:has', function (key) {
      return !!localStorage.getItem(key);
  });
});


/* editor/hotkeys.js */
editor.once('load', function() {
  'use strict';

  var hotkeys = { };
  var keyIndex = { };
  var keysDown = { };
  var ctrl = false;
  var shift = false;
  var alt = false;

  var isMac = navigator.userAgent.indexOf('Mac OS X') !== -1;

  var keyByKeyCode = { };
  var keyByCode = { };

  var keyMap = {
      'backspace': {
          keyCode: 8,
          code: 'Backspace'
      },
      'tab': {
          keyCode: 9,
          code: 'Tab',
      },
      'enter': {
          keyCode: 13,
          code: [ 'enter', 'NumpadEnter', 'Enter' ],
      },
      'shift': {
          keyCode: 16,
          code: [ 'ShiftLeft', 'ShiftRight' ],
      },
      'ctrl': {
          keyCode: 17,
          code: [ 'CtrlLeft', 'CtrlRight' ],
      },
      'alt': {
          keyCode: 18,
          code: [ 'AltLeft', 'AltRight' ],
      },
      'pause/break': {
          keyCode: 19,
          code: 'Pause',
      },
      'caps lock': {
          keyCode: 20,
          code: 'CapsLock',
      },
      'esc': {
          keyCode: 27,
          code: 'Escape',
      },
      'space': {
          keyCode: 32,
          code: 'Space',
      },
      'page up': {
          keyCode: 33,
          code: 'PageUp'
      },
      'page down': {
          keyCode: 34,
          code: 'PageDown'
      },
      'end': {
          keyCode: 35,
          code: 'End'
      },
      'home': {
          keyCode: 36,
          code: 'Home'
      },
      'left arrow': {
          keyCode: 37,
          code: 'ArrowLeft'
      },
      'up arrow': {
          keyCode: 38,
          code: 'ArrowUp'
      },
      'right arrow': {
          keyCode: 39,
          code: 'ArrowRight'
      },
      'down arrow': {
          keyCode: 40,
          code: 'ArrowDown'
      },
      'insert': {
          keyCode: 45,
          code: 'Insert'
      },
      'delete': {
          keyCode: 46,
          code: 'Delete'
      },
      '0': {
          keyCode: 48,
          code: 'Digit0'
      },
      '1': {
          keyCode: 49,
          code: 'Digit1'
      },
      '2': {
          keyCode: 50,
          code: 'Digit2'
      },
      '3': {
          keyCode: 51,
          code: 'Digit3'
      },
      '4': {
          keyCode: 52,
          code: 'Digit4'
      },
      '5': {
          keyCode: 53,
          code: 'Digit5'
      },
      '6': {
          keyCode: 54,
          code: 'Digit6'
      },
      '7': {
          keyCode: 55,
          code: 'Digit7'
      },
      '8': {
          keyCode: 56,
          code: 'Digit8'
      },
      '9': {
          keyCode: 57,
          code: 'Digit9'
      },
      'a': {
          keyCode: 65,
          code: 'KeyA'
      },
      'b': {
          keyCode: 66,
          code: 'KeyB'
      },
      'c': {
          keyCode: 67,
          code: 'KeyC'
      },
      'd': {
          keyCode: 68,
          code: 'KeyD'
      },
      'e': {
          keyCode: 69,
          code: 'KeyE'
      },
      'f': {
          keyCode: 70,
          code: 'KeyF'
      },
      'g': {
          keyCode: 71,
          code: 'KeyG'
      },
      'h': {
          keyCode: 72,
          code: 'KeyH'
      },
      'i': {
          keyCode: 73,
          code: 'KeyI'
      },
      'j': {
          keyCode: 74,
          code: 'KeyJ'
      },
      'k': {
          keyCode: 75,
          code: 'KeyK'
      },
      'l': {
          keyCode: 76,
          code: 'KeyL'
      },
      'm': {
          keyCode: 77,
          code: 'KeyM'
      },
      'n': {
          keyCode: 78,
          code: 'KeyN'
      },
      'o': {
          keyCode: 79,
          code: 'KeyO'
      },
      'p': {
          keyCode: 80,
          code: 'KeyP'
      },
      'q': {
          keyCode: 81,
          code: 'KeyQ'
      },
      'r': {
          keyCode: 82,
          code: 'KeyR'
      },
      's': {
          keyCode: 83,
          code: 'KeyS'
      },
      't': {
          keyCode: 84,
          code: 'KeyT'
      },
      'u': {
          keyCode: 85,
          code: 'KeyU'
      },
      'v': {
          keyCode: 86,
          code: 'KeyV'
      },
      'w': {
          keyCode: 87,
          code: 'KeyW'
      },
      'x': {
          keyCode: 88,
          code: 'KeyX'
      },
      'y': {
          keyCode: 89,
          code: 'KeyY'
      },
      'z': {
          keyCode: 90,
          code: 'KeyZ'
      },
      'left window key': {
          keyCode: 91,
          code: 'MetaLeft'
      },
      'right window key': {
          keyCode: 92,
          code: 'MetaRight'
      },
      'select key': {
          keyCode: 93,
          code: 'ContextMenu'
      },
      'numpad 0': {
          keyCode: 96,
          code: 'Numpad0'
      },
      'numpad 1': {
          keyCode: 97,
          code: 'Numpad1'
      },
      'numpad 2': {
          keyCode: 98,
          code: 'Numpad2'
      },
      'numpad 3': {
          keyCode: 99,
          code: 'Numpad3'
      },
      'numpad 4': {
          keyCode: 100,
          code: 'Numpad4'
      },
      'numpad 5': {
          keyCode: 101,
          code: 'Numpad5'
      },
      'numpad 6': {
          keyCode: 102,
          code: 'Numpad6'
      },
      'numpad 7': {
          keyCode: 103,
          code: 'Numpad7'
      },
      'numpad 8': {
          keyCode: 104,
          code: 'Numpad8'
      },
      'numpad 9': {
          keyCode: 105,
          code: 'Numpad9'
      },
      'multiply': {
          keyCode: 106,
          code: 'NumpadMultiply'
      },
      'add': {
          keyCode: 107,
          code: 'NumpadAdd'
      },
      'subtract': {
          keyCode: 109,
          code: 'NumpadSubtract'
      },
      'decimal point': {
          keyCode: 110,
          code: 'NumpadDecimal'
      },
      'divide': {
          keyCode: 111,
          code: 'NumpadDivide'
      },
      'f1': {
          keyCode: 112,
          code: 'F1'
      },
      'f2': {
          keyCode: 113,
          code: 'F2'
      },
      'f3': {
          keyCode: 114,
          code: 'F3'
      },
      'f4': {
          keyCode: 115,
          code: 'F4'
      },
      'f5': {
          keyCode: 116,
          code: 'F5'
      },
      'f6': {
          keyCode: 117,
          code: 'F6'
      },
      'f7': {
          keyCode: 118,
          code: 'F7'
      },
      'f8': {
          keyCode: 119,
          code: 'F8'
      },
      'f9': {
          keyCode: 120,
          code: 'F9'
      },
      'f10': {
          keyCode: 121,
          code: 'F10'
      },
      'f11': {
          keyCode: 122,
          code: 'F11'
      },
      'f12': {
          keyCode: 123,
          code: 'F12'
      },
      'num lock': {
          keyCode: 144,
          code: 'NumLock'
      },
      'scroll lock': {
          keyCode: 145,
          code: 'ScrollLock'
      },
      'semi-colon': {
          keyCode: 186,
          code: 'Semicolon'
      },
      'equal sign': {
          keyCode: 187,
          code: 'Equal'
      },
      'comma': {
          keyCode: 188,
          code: 'Comma'
      },
      'dash': {
          keyCode: 189,
          code: 'Minus'
      },
      'period': {
          keyCode: 190,
          code: 'Period'
      },
      'forward slash': {
          keyCode: 191,
          code: ''
      },
      'grave accent': {
          keyCode: 192,
          code: 'Backquote'
      },
      'open bracket': {
          keyCode: 219,
          code: 'BracketLeft'
      },
      'back slash': {
          keyCode: 220,
          code: [ 'Backslash', 'IntlBackslash' ]
      },
      'close bracket': {
          keyCode: 221,
          code: 'BracketRight'
      },
      'single quote': {
          keyCode: 222,
          code: 'Quote'
      },
  };

  for(var key in keyMap) {
      keyByKeyCode[keyMap[key].keyCode] = key;

      if (keyMap[key].code instanceof Array) {
          for(var i = 0; i < keyMap[key].code.length; i++) {
              keyByCode[keyMap[key].code[i]] = key;
          }
      } else {
          keyByCode[keyMap[key].code] = key;
      }
  }


  editor.method('hotkey:register', function(name, args) {
      hotkeys[name] = args;

      // keys list
      var keys = [ args.ctrl ? 1 : 0, args.alt ? 1 : 0, args.shift ? 1 : 0 ];

      // map keyCode to key
      if (typeof(args.key) === 'number')
          args.key = keyByKeyCode[args.key];

      // unknown key
      if (! args.key) {
          console.error('unknown key: ' + name + ', ' + args.key);
          return;
      }

      keys.push(args.key);

      args.index = keys.join('+');

      if (! keyIndex[args.index])
          keyIndex[args.index] = [ ];

      keyIndex[args.index].push(name);
  });


  editor.method('hotkey:unregister', function(name) {
      var hotkey = hotkeys[name];
      if (! hotkey) return;

      if (keyIndex[hotkey.index].length === 1) {
          delete keyIndex[hotkey.index];
      } else {
          keyIndex[hotkey.index].splice(keyIndex[hotkey.index].indexOf(name), 1);
      }

      delete hotkeys[name];
  });


  editor.method('hotkey:shift', function() {
      return shift;
  });

  editor.method('hotkey:ctrl', function() {
      return ctrl;
  });

  editor.method('hotkey:alt', function() {
      return alt;
  });


  var updateModifierKeys = function(evt) {
      if (shift !== evt.shiftKey) {
          shift = evt.shiftKey;
          editor.emit('hotkey:shift', shift);
      }

      if (ctrl !== (evt.ctrlKey || evt.metaKey)) {
          ctrl = evt.ctrlKey || evt.metaKey;
          editor.emit('hotkey:ctrl', ctrl);
      }

      if (alt !== evt.altKey) {
          alt = evt.altKey;
          editor.emit('hotkey:alt', alt);
      }
  };
  editor.method('hotkey:updateModifierKeys', updateModifierKeys);


  window.addEventListener('keydown', function(evt) {
      if (evt.target) {
          var tag = evt.target.tagName;
          if (/(input)|(textarea)/i.test(tag) && ! evt.target.classList.contains('hotkeys'))
              return;
      }

      updateModifierKeys(evt);

      var key = evt.code ? keyByCode[evt.code] : keyByKeyCode[evt.keyCode];

      if (evt.keyCode === 92 || evt.keyCode === 93)
          return;

      var index = [ ctrl+0, alt+0, shift+0, key ].join('+');

      if (keyIndex[index]) {
          var skipPreventDefault = false;
          for(var i = 0; i < keyIndex[index].length; i++) {
              if (! skipPreventDefault && hotkeys[keyIndex[index][i]].skipPreventDefault)
                  skipPreventDefault = true;

              hotkeys[keyIndex[index][i]].callback(evt);
          }
          if (! skipPreventDefault)
              evt.preventDefault();
      }
  }, false);


  // Returns Ctrl or Cmd for Mac
  editor.method('hotkey:ctrl:string', function () {
      return isMac ? 'Cmd' : 'Ctrl';
  });


  window.addEventListener('keyup', updateModifierKeys, false);
  window.addEventListener('mousedown', updateModifierKeys, false);
  window.addEventListener('mouseup', updateModifierKeys, false);
  window.addEventListener('click', updateModifierKeys, false);


  ui.Grid._ctrl = function() {
      return ctrl;
  };
  ui.Grid._shift = function() {
      return shift;
  };

  ui.Tree._ctrl = function() {
      return ctrl;
  };
  ui.Tree._shift = function() {
      return shift;
  };

  ui.List._ctrl = function() {
      return ctrl;
  };
  ui.List._shift = function() {
      return shift;
  };
});


/* editor/layout.js */
editor.on('load', function() {
  'use strict';

  var ignoreClasses = /(ui-list-item)|(ui-button)|(ui-text-field)|(ui-number-field)/i;
  var ignoreElements = /(input)|(textarea)/i;

  // prevent drag'n'select
  window.addEventListener('mousedown', function(evt) {
      // don't prevent for certain cases
      if (evt.target) {
          if (ignoreClasses.test(evt.target.className)) {
              return;
          } else if (ignoreElements.test(evt.target.tagName)) {
              return;
          } else if (evt.target.classList.contains('selectable')) {
              return;
          }
      }

      // blur inputs
      if (window.getSelection) {
          var focusNode = window.getSelection().focusNode;
          if (focusNode) {
              if (focusNode.tagName === 'INPUT') {
                  focusNode.blur();
              } else if (focusNode.firstChild && focusNode.firstChild.tagName === 'INPUT') {
                  focusNode.firstChild.blur();
              }
          }
      }

      // prevent default will prevent blur, dragstart and selection
      evt.preventDefault();
  }, false);


  // main container
  var root = new pcui.Container({
      id: 'layout-root',
      grid: true
  });
  document.body.appendChild(root.dom);
  // expose
  editor.method('layout.root', function () {
      return root;
  });

  // toolbar (left)
  var toolbar = new pcui.Container({
      id: 'layout-toolbar',
      flex: true
  });
  root.append(toolbar);
  // expose
  editor.method('layout.toolbar', function () { return toolbar; });

  // hierarchy
  var hierarchyPanel = new pcui.Panel({
      headerText: 'HIERARCHY',
      id: 'layout-hierarchy',
      flex: true,
      enabled: false,
      width: editor.call('localStorage:get', 'editor:layout:hierarchy:width') || 256,
      panelType: 'normal',
      collapsible: true,
      collapseHorizontally: true,
      collapsed: editor.call('localStorage:get', 'editor:layout:hierarchy:collapse') || window.innerWidth <= 480,
      scrollable: true,
      resizable: 'right',
      resizeMin: 196,
      resizeMax: 512
  });

  hierarchyPanel.on('resize', function () {
      editor.call('localStorage:set', 'editor:layout:hierarchy:width', hierarchyPanel.width);
  });
  hierarchyPanel.on('collapse', function () {
      editor.call('localStorage:set', 'editor:layout:hierarchy:collapse', true);
  });
  hierarchyPanel.on('expand', function () {
      editor.call('localStorage:set', 'editor:layout:hierarchy:collapse', false);
  });

  root.append(hierarchyPanel);
  // expose
  editor.method('layout.hierarchy', function () { return hierarchyPanel; });

  editor.on('permissions:writeState', function (state) {
      hierarchyPanel.enabled = state;
  });

  // viewport
  var viewport = new pcui.Container({
      id: 'layout-viewport'
  });
  viewport.class.add('viewport');
  root.append(viewport);
  // expose
  editor.method('layout.viewport', function () { return viewport; });

  // assets
  var assetsPanel = new pcui.Panel({
      id: 'layout-assets',
      headerText: 'ASSETS',
      flex: true,
      flexDirection: 'row',
      panelType: 'normal',
      collapsible: true,
      collapsed: editor.call('localStorage:get', 'editor:layout:assets:collapse') || window.innerHeight <= 480,
      height: editor.call('localStorage:get', 'editor:layout:assets:height') || 212,
      scrollable: true,
      resizable: 'top',
      resizeMin: 106,
      resizeMax: 106 * 6
  });
  assetsPanel.class.add('assets');

  assetsPanel.on('resize', function () {
      editor.call('localStorage:set', 'editor:layout:assets:height', assetsPanel.height);
  });
  assetsPanel.on('collapse', function () {
      editor.call('localStorage:set', 'editor:layout:assets:collapse', true);
  });
  assetsPanel.on('expand', function () {
      editor.call('localStorage:set', 'editor:layout:assets:collapse', false);
  });

  root.append(assetsPanel);
  // expose
  editor.method('layout.assets', function () { return assetsPanel; });

  // attributes
  var attributesPanel = new pcui.Panel({
      id: 'layout-attributes',
      headerText: 'INSPECTOR',
      enabled: false,
      panelType: 'normal',
      width: editor.call('localStorage:get', 'editor:layout:attributes:width') || 320,
      collapsible: true,
      collapseHorizontally: true,
      collapsed: editor.call('localStorage:get', 'editor:layout:attributes:collapse') || false,
      scrollable: true,
      resizable: 'left',
      resizeMin: 256,
      resizeMax: 512
  });
  attributesPanel.class.add('attributes');

  attributesPanel.on('resize', function () {
      editor.call('localStorage:set', 'editor:layout:attributes:width', attributesPanel.width);
  });
  attributesPanel.on('collapse', function () {
      editor.call('localStorage:set', 'editor:layout:attributes:collapse', true);
  });
  attributesPanel.on('expand', function () {
      editor.call('localStorage:set', 'editor:layout:attributes:collapse', false);
  });

  root.append(attributesPanel);
  // expose
  editor.method('layout.attributes', function () { return attributesPanel; });
  editor.on('permissions:writeState', function (state) {
      attributesPanel.enabled = state;
  });

  // status bar
  var statusBar = new pcui.Container({
      id: 'layout-statusbar',
      flex: true,
      flexDirection: 'row'
  });
  root.append(statusBar);
  // expose
  editor.method('layout.statusBar', function () { return statusBar; });

  if (window.innerWidth <= 720)
      attributesPanel.folded = true;
});


/* editor/messenger.js */
editor.on('start', function() {
  'use strict';

  if (typeof(Messenger) === 'undefined')
      return;

  var messenger = new Messenger();

  messenger.connect(config.url.messenger.ws);

  messenger.on('connect', function() {
      this.authenticate(config.accessToken, 'designer');
  });

  messenger.on('welcome', function() {
      this.projectWatch(config.project.id);
  });

  messenger.on('message', function(evt) {
      editor.emit('messenger:' + evt.name, evt.data);
  });

  window.msg = messenger;
});


/* editor/history.js */
editor.once('load', function() {
  'use strict';

  var actions = [ ];
  var current = -1;
  var canUndo = false;
  var canRedo = false;

  var hotkeyExceptions = [
      'curve',
      'gradient',
      'sprite-editor'
  ];

  var checkCanUndoRedo = function() {
      if (canUndo && current == -1) {
          canUndo = false;
          editor.emit('history:canUndo', false);
      } else if (! canUndo && current >= 0) {
          canUndo = true;
          editor.emit('history:canUndo', true);
      }

      if (canRedo && current === actions.length - 1) {
          canRedo = false;
          editor.emit('history:canRedo', false);
      } else if (! canRedo && current < actions.length - 1) {
          canRedo = true;
          editor.emit('history:canRedo', true);
      }
  };

  editor.method('history:canUndo', function() {
      return canUndo;
  });
  editor.method('history:canRedo', function() {
      return canRedo;
  });


  // current
  editor.method('history:current', function() {
      if (current === -1)
          return null;

      return current;
  });


  // clear
  editor.method('history:clear', function() {
      if (! actions.length)
          return;

      actions = [ ];
      current = -1;
      checkCanUndoRedo();
  });


  // add action
  editor.method('history:add', function(action) {
      // some history needs erasing
      if (current !== actions.length - 1)
          actions = actions.slice(0, current + 1);

      // add action
      actions.push(action);

      editor.call('status:text', action.name);

      // current action state
      current = actions.length - 1;

      checkCanUndoRedo();
  });


  // update action
  editor.method('history:update', function(action) {
      if (current === -1 || actions[current].name !== action.name)
          return;

      actions[current].redo = action.redo;

      editor.call('status:text', action.name);
  });


  // undo
  editor.method('history:undo', function() {
      // no history
      if (current === -1)
          return;

      actions[current].undo();
      current--;

      if (current >= 0) {
          editor.call('status:text', actions[current].name);
      } else {
          editor.call('status:text', '');
      }

      editor.emit('history:undo', name);
      checkCanUndoRedo();
  });


  // redo
  editor.method('history:redo', function() {
      if (current === actions.length - 1)
          return;

      current++;
      actions[current].redo();
      editor.call('status:text', actions[current].name);

      editor.emit('history:redo', name);
      checkCanUndoRedo();
  });

  // list history
  editor.method('history:list', function() {
      return actions;
  });

  // hotkey undo
  editor.call('hotkey:register', 'history:undo', {
      key: 'z',
      ctrl: true,
      callback: function() {
          if (! editor.call('permissions:write'))
              return;

          if (editor.call('picker:isOpen:otherThan', hotkeyExceptions)) return;

          editor.call('history:undo');
      }
  });

  // hotkey redo
  editor.call('hotkey:register', 'history:redo', {
      key: 'z',
      ctrl: true,
      shift: true,
      callback: function() {
          if (! editor.call('permissions:write'))
              return;

          if (editor.call('picker:isOpen:otherThan', hotkeyExceptions)) return;

          editor.call('history:redo');
      }
  });

  // hotkey redo
  editor.call('hotkey:register', 'history:redo:y', {
      key: 'y',
      ctrl: true,
      callback: function() {
          if (! editor.call('permissions:write'))
              return;

          if (editor.call('picker:isOpen:otherThan', hotkeyExceptions)) return;

          editor.call('history:redo');
      }
  });
});


/* editor/status.js */
editor.once('load', function() {
  'use strict';

  var jobs = { };
  var panel = editor.call('layout.statusBar');


  // status
  var status = new ui.Label({
      text: 'PlayCanvas'
  });
  status.renderChanges = false;
  status.class.add('status');
  panel.append(status);

  // progress
  var progress = new ui.Progress();
  progress.class.add('jobsProgress');
  panel.append(progress);

  // jobs
  var jobsCount = new ui.Label({
      text: '0'
  });
  jobsCount.renderChanges = false;
  jobsCount.class.add('jobsCount');
  panel.append(jobsCount);


  // status text
  editor.method('status:text', function(text) {
      status.text = text;
      status.class.remove('error');
  });


  // status error
  editor.method('status:error', function(text) {
      status.text = text;
      status.class.add('error');
  });



  // update jobs
  var updateJobs = function() {
      var count = Object.keys(jobs).length;
      jobsCount.text = count;

      if (count > 0) {
          var least = 1;
          for(var key in jobs) {
              if (jobs[key] < least)
                  least = jobs[key];
          }
          progress.progress = least;
          progress.class.add('active');
      } else {
          progress.class.remove('active');
          progress.progress = 1;
      }
  };

  // status job
  editor.method('status:job', function(id, value) {
      if (jobs.hasOwnProperty(id) && value === undefined) {
          delete jobs[id];
      } else {
          jobs[id] = value;
      }

      updateJobs();
  });
});


/* editor/permissions.js */
editor.once('load', function() {
  'use strict';

  var permissions = { };

  // cache permissions in a dictionary
  ['read', 'write', 'admin'].forEach(function (access) {
      config.project.permissions[access].forEach(function (id) {
          permissions[id] = access;
      });
  });

  editor.method('permissions', function () {
      return config.project.permissions;
  });

  editor.method('permissions:read', function (userId) {
      if (! userId) userId = config.self.id;
      return permissions.hasOwnProperty(userId);
  });

  editor.method('permissions:write', function (userId) {
      if (!userId) userId = config.self.id;

      return permissions[userId] === 'write' || permissions[userId] === 'admin';
  });

  editor.method('permissions:admin', function (userId) {
      if (!userId) userId = config.self.id;

      return permissions[userId] === 'admin';
  });

  // subscribe to messenger
  editor.on('messenger:project.permissions', function (msg) {
      var userId = msg.user.id;

      // remove from read
      var ind = config.project.permissions.read.indexOf(userId);
      if (ind !== -1)
          config.project.permissions.read.splice(ind, 1);

      // remove from write
      ind = config.project.permissions.write.indexOf(userId);
      if (ind !== -1) {
          config.project.permissions.write.splice(ind, 1);
      }

      // remove from admin
      ind = config.project.permissions.admin.indexOf(userId);
      if (ind !== -1) {
          config.project.permissions.admin.splice(ind, 1);
      }

      delete permissions[userId];

      var accessLevel = msg.user.permission;

      // add new permission
      if (accessLevel) {
          config.project.permissions[accessLevel].push(userId);
          permissions[userId] = accessLevel;
      } else {
          // lock out user if private project
          if (config.self.id === userId && config.project.private)
              window.location.reload();
      }

      editor.emit('permissions:set:' + userId, accessLevel);
      if (userId === config.self.id)
          editor.emit('permissions:set', accessLevel);
  });

  // subscribe to project private changes
  editor.on('messenger:project.private', function (msg) {
      var projectId = msg.project.id;
      if (config.project.id !== projectId)
          return;

      config.project.private = msg.project.private;

      if (msg.project.private && ! editor.call('permissions:read', config.self.id)) {
          // refresh page so that user gets locked out
          window.location.reload();
      }
  });

  editor.on('messenger:user.logout', function (msg) {
      if (msg.user.id === config.self.id) {
          window.location.reload();
      }
  });

  editor.on('permissions:set:' + config.self.id, function (accessLevel) {
      var connection = editor.call('realtime:connection');
      editor.emit('permissions:writeState', connection && connection.state === 'connected' && (accessLevel === 'write' || accessLevel === 'admin'));
  });

  // emit initial event
  if (editor.call('permissions:write')) {
      editor.emit('permissions:set:' + config.self.id, 'write');
  }
});


/* editor/error.js */
editor.once('load', function() {
  'use strict';

  window.addEventListener('error', function(evt) {
      // console.log(evt);
      editor.call('status:error', evt.message);
  }, false);
});


/* editor/contextmenu.js */
editor.once('load', function() {
  'use strict';

  window.addEventListener('contextmenu', function(evt) {
      evt.preventDefault();
  }, false);
});


/* editor/drop.js */
editor.once('load', function() {
  'use strict';

  // overlay
  var overlay = document.createElement('div');
  overlay.classList.add('drop-overlay');
  editor.call('layout.root').append(overlay);

  var imgDrag = new Image();
  // imgDrag.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAACWCAYAAAAfduJyAAAAFUlEQVQoU2NkYGBgYBwlRsNgJKQDAOAfAJflUZweAAAAAElFTkSuQmCC';
  // imgDrag.style.display = 'none';

  var parts = [ 'top', 'right', 'bottom', 'left' ];
  for(var i = 0; i < parts.length; i++) {
      var part = document.createElement('div');
      part.classList.add('drop-overlay-hole-part', parts[i]);
      editor.call('layout.root').append(part);
      parts[i] = part;
  }

  // areas
  var areas = document.createElement('div');
  areas.classList.add('drop-areas');
  editor.call('layout.root').append(areas);


  var active = false;
  var currentType = '';
  var currentData = { };
  var currentElement = null;
  var dragOver = false;
  var items = [ ];
  var itemOver = null;

  var activate = function(state) {
      if (! editor.call('permissions:write'))
          return;

      if (active === state)
          return;

      active = state;

      if (active) {
          overlay.classList.add('active');
          areas.classList.add('active');
          editor.call('cursor:set', 'grabbing');
      } else {
          overlay.classList.remove('active');
          areas.classList.remove('active');
          dragOver = false;
          currentType = '';
          currentData = { };
          editor.emit('drop:set', currentType, currentData);
          editor.call('cursor:clear');
      }

      var onMouseUp = function() {
          window.removeEventListener('mouseup', onMouseUp);
          activate(false);
      };
      window.addEventListener('mouseup', onMouseUp, false);

      editor.emit('drop:active', active);
  };

  editor.method('drop:activate', activate);
  editor.method('drop:active', function() {
      return active;
  });


  // prevent drop file of redirecting
  window.addEventListener('dragenter', function(evt) {
      evt.preventDefault();

      if (! editor.call('permissions:write'))
          return;

      if (dragOver) return;
      dragOver = true;

      if (! currentType) {
          currentType = 'files';
          editor.emit('drop:set', currentType, currentData);
      }

      activate(true);
  }, false);

  window.addEventListener('dragover', function(evt) {
      evt.preventDefault();

      if (! editor.call('permissions:write'))
          return;

      evt.dataTransfer.dropEffect = 'move';

      if (dragOver) return;
      dragOver = true;

      activate(true);
  }, false);

  window.addEventListener('dragleave', function(evt) {
      evt.preventDefault();

      if (evt.clientX !== 0 || evt.clientY !== 0)
          return;

      if (! editor.call('permissions:write'))
          return;

      if (! dragOver) return;
      dragOver = false;

      setTimeout(function() {
          if (dragOver)
              return;

          activate(false);
      }, 0);
  }, false);

  window.addEventListener('drop', function(evt) {
      evt.preventDefault();
      activate(false);
  }, false);


  var evtDragOver = function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.add('over');

      if (itemOver && itemOver !== this)
          evtDragLeave.call(itemOver);

      itemOver = this;

      if (this._ref && this._ref.over && currentType) {
          var data = currentData;
          if (currentType == 'files' && e.dataTransfer)
              data = e.dataTransfer.files;
          this._ref.over(currentType, data);
      }
  };
  var evtDragLeave = function(e) {
      if (e) e.preventDefault();
      this.classList.remove('over');

      if (this._ref && this._ref.leave && currentType)
          this._ref.leave();

      if (itemOver === this)
          itemOver = null;
  };

  var fixChromeFlexBox = function(item) {
      // workaround for chrome
      // for z-index + flex-grow weird reflow bug
      // need to force reflow in next frames

      if (! window.chrome)
          return;

      // only for those who have flexgrow
      var flex = item.style.flexGrow;
      if (flex) {
          // changing overflow triggers reflow
          var overflow = item.style.overflow;
          item.style.overflow = 'hidden';
          // need to skip 2 frames, 1 is not enough
          requestAnimationFrame(function() {
              requestAnimationFrame(function() {
                  // change back to what it was
                  item.style.overflow = overflow;
              });
          });
      }
  };


  editor.method('drop:target', function(obj) {
      items.push(obj);
      obj.element = document.createElement('div');
      obj.element._ref = obj;
      obj.element.classList.add('drop-area');
      if (obj.hole)
          obj.element.classList.add('hole');

      if (obj.passThrough)
          obj.element.style.pointerEvents = 'none';

      areas.appendChild(obj.element);

      obj.evtDrop = function(e) {
          e.preventDefault();

          if (! currentType)
              return;

          // leave event
          if (obj.element.classList.contains('over')) {
              if (obj.leave && currentType) obj.leave();
              obj.element.classList.remove('over');
          }

          var data = currentData;
          if (currentType == 'files' && e.dataTransfer)
              data = e.dataTransfer.files;

          if (obj.drop)
              obj.drop(currentType, data);
      };

      obj.element.addEventListener('dragenter', evtDragOver, false);
      obj.element.addEventListener('mouseenter', evtDragOver, false);

      obj.element.addEventListener('dragleave', evtDragLeave, false);
      obj.element.addEventListener('mouseleave', evtDragLeave, false);

      var dropOn = obj.element;
      if (obj.passThrough)
          dropOn = obj.ref;

      dropOn.addEventListener('drop', obj.evtDrop, false);
      dropOn.addEventListener('mouseup', obj.evtDrop, false);

      obj.unregister = function() {
          if (! obj.element.classList.contains('drop-area'))
              return;

          obj.element.removeEventListener('dragenter', evtDragOver);
          obj.element.removeEventListener('mouseenter', evtDragOver);

          obj.element.removeEventListener('dragleave', evtDragLeave);
          obj.element.removeEventListener('mouseleave', evtDragLeave);

          dropOn.removeEventListener('drop', obj.evtDrop);
          dropOn.removeEventListener('mouseup', obj.evtDrop);

          var ind = items.indexOf(obj);
          if (ind !== -1)
              items.splice(ind, 1);

          if (obj.ref.classList.contains('drop-ref-highlight')) {
              obj.ref.classList.remove('drop-ref-highlight');
              fixChromeFlexBox(obj.ref);
          }

          obj.element.classList.remove('drop-area');
          areas.removeChild(obj.element);
      };

      return obj;
  });


  editor.method('drop:item', function(args) {
      args.element.draggable = true;

      args.element.addEventListener('mousedown', function(evt) {
          evt.stopPropagation();
      }, false);

      args.element.addEventListener('dragstart', function(evt) {
          evt.preventDefault();
          evt.stopPropagation();

          if (! editor.call('permissions:write'))
              return;

          currentType = args.type;
          currentData = args.data;
          itemOver = null;
          editor.emit('drop:set', currentType, currentData);

          activate(true);
      }, false);
  });


  editor.method('drop:set', function(type, data) {
      currentType = type || '',
      currentData = data || { };

      editor.emit('drop:set', currentType, currentData);
  });


  editor.on('drop:active', function(state) {
      areas.style.pointerEvents = '';

      if (state) {
          var bottom = 0;
          var top = window.innerHeight;
          var left = window.innerWidth;
          var right = 0;

          for(var i = 0; i < items.length; i++) {
              var visible = ! items[i].disabled;

              if (visible) {
                  if (items[i].filter) {
                      visible = items[i].filter(currentType, currentData);
                  } else if (items[i].type !== currentType) {
                      visible = false;
                  }
              }

              if (visible) {
                  var rect = items[i].ref.getBoundingClientRect();
                  var depth = 4;
                  var parent = items[i].ref;
                  while(depth--) {
                      if (! rect.width || ! rect.height || ! parent.offsetHeight || window.getComputedStyle(parent).getPropertyValue('visibility') === 'hidden') {
                          visible = false;
                          break;
                      }
                      parent = parent.parentNode;
                  }
              }

              if (visible) {
                  items[i].element.style.display = 'block';

                  if (items[i].hole) {
                      items[i].element.style.left = (rect.left + 2) + 'px';
                      items[i].element.style.top = (rect.top + 2) + 'px';
                      items[i].element.style.width = (rect.width - 4) + 'px';
                      items[i].element.style.height = (rect.height - 4) + 'px';

                      overlay.classList.remove('active');

                      if (top > rect.top)
                          top = rect.top;

                      if (bottom < rect.bottom)
                          bottom = rect.bottom;

                      if (left > rect.left)
                          left = rect.left;

                      if (right < rect.right)
                          right = rect.right;

                      parts[0].classList.add('active');
                      parts[0].style.height = top + 'px';

                      parts[1].classList.add('active');
                      parts[1].style.top = top + 'px';
                      parts[1].style.bottom = (window.innerHeight - bottom) + 'px';
                      parts[1].style.width = (window.innerWidth - right) + 'px';

                      parts[2].classList.add('active');
                      parts[2].style.height = (window.innerHeight - bottom) + 'px';

                      parts[3].classList.add('active');
                      parts[3].style.top = top + 'px';
                      parts[3].style.bottom = (window.innerHeight - bottom) + 'px';
                      parts[3].style.width = left + 'px';

                      if (items[i].passThrough)
                          areas.style.pointerEvents = 'none';
                  } else {
                      items[i].element.style.left = (rect.left + 1) + 'px';
                      items[i].element.style.top = (rect.top + 1) + 'px';
                      items[i].element.style.width = (rect.width - 2) + 'px';
                      items[i].element.style.height = (rect.height - 2) + 'px';
                      items[i].ref.classList.add('drop-ref-highlight');
                  }
              } else {
                  items[i].element.style.display = 'none';

                  if (items[i].ref.classList.contains('drop-ref-highlight')) {
                      items[i].ref.classList.remove('drop-ref-highlight');
                      fixChromeFlexBox(items[i].ref);
                  }
              }
          }
      } else {
          for(var i = 0; i < parts.length; i++)
              parts[i].classList.remove('active');

          for(var i = 0; i < items.length; i++) {
              if (! items[i].ref.classList.contains('drop-ref-highlight'))
                  continue;

              items[i].ref.classList.remove('drop-ref-highlight');
              fixChromeFlexBox(items[i].ref);
          }
      }
  });
});


/* editor/cursor.js */
editor.once('load', function() {
  'use strict';

  var cursorType = '';

  editor.method('cursor:set', function(type) {
      if (cursorType === type)
          return;

      cursorType = type;
      document.body.style.setProperty('cursor', type, 'important');
      document.body.style.setProperty('cursor', '-moz-' + type, 'important');
      document.body.style.setProperty('cursor', '-webkit-' + type, 'important');
  });

  editor.method('cursor:clear', function() {
      if (! cursorType)
          return;

      cursorType = '';
      document.body.style.cursor = '';
  });

  var hiddenTime = 0;
  var tooltip = new ui.Label({
      unsafe: true
  });
  tooltip.class.add('cursor-tooltip');
  tooltip.renderChanges = false;
  tooltip.hidden = true;
  editor.call('layout.root').append(tooltip);

  var lastX = 0;
  var lastY = 0;

  // move tooltip
  var onMove = function(evt) {
      lastX = evt.clientX;
      lastY = evt.clientY;

      if (tooltip.hidden && (Date.now() - hiddenTime) > 100)
          return;

      tooltip.style.transform = 'translate(' + evt.clientX + 'px,' + evt.clientY + 'px)';
  };
  window.addEventListener('mousemove', onMove, false);
  window.addEventListener('dragover', onMove, false);

  // set tooltip text
  editor.method('cursor:text', function(text) {
      if (text) tooltip.text = text;
      tooltip.hidden = ! text;

      tooltip.style.transform = 'translate(' + lastX + 'px,' + lastY + 'px)';

      if (! text)
          hiddenTime = Date.now();
  });
});


/* editor/datetime.js */
editor.once('load', function () {
  'use strict';

  // Converts specified date string to a date in this format:
  // Wed, Jul 18, 2018, 12:55:00
  editor.method('datetime:convert', function (date) {
      var d = new Date(date);
      var dateString = d.toDateString();
      var dateParts = dateString.split(' ');
      var timeString = d.toTimeString();
      var space = timeString.indexOf(' ');
      return dateParts[0] + ', ' + dateParts[1] + ' ' + dateParts[2] + ', ' + dateParts[3] + ', ' + timeString.substring(0, space);
  });
});


/* editor/search.js */
editor.once('load', function() {
  'use strict';

  // calculate, how many string `a`
  // requires edits, to become string `b`
  editor.method('search:stringEditDistance', function(a, b) {
      // Levenshtein distance
      // https://en.wikibooks.org/wiki/Algorithm_Implementation/Strings/Levenshtein_distance#JavaScript
      if(a.length === 0) return b.length;
      if(b.length === 0) return a.length;
      if(a === b) return 0;

      var i, j;
      var matrix = [];

      for(i = 0; i <= b.length; i++)
          matrix[i] = [i];

      for(j = 0; j <= a.length; j++)
          matrix[0][j] = j;

      for(i = 1; i <= b.length; i++){
          for(j = 1; j <= a.length; j++){
              if(b.charAt(i-1) === a.charAt(j-1)){
                  matrix[i][j] = matrix[i-1][j-1];
              } else {
                  matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1));
              }
          }
      }

      return matrix[b.length][a.length];
  });


  // calculate, how many characters string `b`
  // contains of a string `a`
  editor.method('search:charsContains', function(a, b) {
      if (a === b)
          return a.length;

      var contains = 0;
      var ind = { };
      var i;

      for(i = 0; i < b.length; i++)
          ind[b.charAt(i)] = true;

      for(i = 0; i < a.length; i++) {
          if(ind[a.charAt(i)])
              contains++;
      }

      return contains;
  });


  // tokenize string into array of tokens
  editor.method('search:stringTokenize', function(name) {
      var tokens = [ ];

      // camelCase
      // upperCASE123
      var string = name.replace(/([^A-Z])([A-Z][^A-Z])/g, '$1 $2').replace(/([A-Z0-9]{2,})/g, ' $1');

      // space notation
      // dash-notation
      // underscore_notation
      var parts = string.split(/(\s|\-|_)/g);

      // filter valid tokens
      for(var i = 0; i < parts.length; i++) {
          parts[i] = parts[i].toLowerCase().trim();
          if (parts[i] && parts[i] !== '-' && parts[i] !== '_')
              tokens.push(parts[i]);
      }

      return tokens;
  });


  var searchItems = function(items, search, args) {
      var results = [ ];

      for(var i = 0; i < items.length; i++) {
          var item = items[i];

          // direct hit
          if (item.subFull !== Infinity) {
              results.push(item);

              if (item.edits === Infinity)
                  item.edits = 0;

              if (item.sub === Infinity)
                  item.sub = item.subFull;

              continue;
          } else if (item.name === search || item.name.indexOf(search) === 0) {
              results.push(item);

              if (item.edits === Infinity)
                  item.edits = 0;

              if (item.sub === Infinity)
                  item.sub = 0;

              continue;
          }

          // check if name contains enough of search characters
          var contains = editor.call('search:charsContains', search, item.name);
          if (contains / search.length < args.containsCharsTolerance)
              continue;

          var editsCandidate = Infinity;
          var subCandidate = Infinity;

          // for each token
          for(var t = 0; t < item.tokens.length; t++) {
              // direct token match
              if (item.tokens[t] === search) {
                  editsCandidate = 0;
                  subCandidate = t;
                  break;
              }

              var edits = editor.call('search:stringEditDistance', search, item.tokens[t]);

              if ((subCandidate === Infinity || edits < editsCandidate) && item.tokens[t].indexOf(search) !== -1) {
                  // search is a substring of a token
                  subCandidate = t;
                  editsCandidate = edits;
                  continue;
              } else if (subCandidate === Infinity && edits < editsCandidate) {
                  // new edits candidate, not a substring of a token
                  if ((edits / Math.max(search.length, item.tokens[t].length)) <= args.editsDistanceTolerance) {
                      // check if edits tolerance is satisfied
                      editsCandidate = edits;
                  }
              }
          }

          // no match candidate
          if (editsCandidate === Infinity)
              continue;

          // add new result
          results.push(item);
          item.edits = item.edits === Infinity ? editsCandidate : item.edits + editsCandidate;
          item.sub = item.sub === Infinity ? subCandidate : item.sub + subCandidate;
      }

      return results;
  };

  // perform search through items
  // items is an array with arrays of two values
  // where first value is a string to be searched by
  // and second value is an object to be found
  /*
  [
      [ 'camera', {object} ],
      [ 'New Entity', {object} ],
      [ 'Sun', {object} ]
  ]
  */
  editor.method('search:items', function(items, search, args) {
      search = (search || '').toLowerCase().trim();

      if (! search)
          return [ ];

      var searchTokens = editor.call('search:stringTokenize', search);
      if (! searchTokens.length)
          return [ ];

      args = args || { };
      args.containsCharsTolerance = args.containsCharsTolerance || 0.5;
      args.editsDistanceTolerance = args.editsDistanceTolerance || 0.5;

      var result = [ ];
      var records = [ ];

      for(var i = 0; i < items.length; i++) {
          var subInd = items[i][0].toLowerCase().trim().indexOf(search);

          records.push({
              name: items[i][0],
              item: items[i][1],
              tokens: editor.call('search:stringTokenize', items[i][0]),
              edits: Infinity,
              subFull: (subInd !== -1) ? subInd : Infinity,
              sub: Infinity
          });
      }

      // search each token
      for(var i = 0; i < searchTokens.length; i++)
          records = searchItems(records, searchTokens[i], args);

      // sort result first by substring? then by edits number
      records.sort(function(a, b) {
          if (a.subFull !== b.subFull) {
              return a.subFull - b.subFull;
          } else if (a.sub !== b.sub) {
              return a.sub - b.sub;
          } else if (a.edits !== b.edits) {
              return a.edits - b.edits;
          } else {
              return a.name.length - b.name.length;
          }
      });

      // return only items without match information
      for(var i = 0; i < records.length; i++)
          records[i] = records[i].item;

      // limit number of results
      if (args.hasOwnProperty('limitResults') && records.length > args.limitResults) {
          records = records.slice(0, args.limitResults);
      }

      return records;
  });
});


/* editor/notifications.js */
editor.once('load', function() {
  'use strict';

  var TIMEOUT = 5000;
  var TIMEOUT_OVERLAP = 500;
  var last;
  var logo = 'https://s3-eu-west-1.amazonaws.com/static.playcanvas.com/platform/images/logo/playcanvas-logo-360.jpg';
  var visible = ! document.hidden;

  document.addEventListener('visibilitychange', function() {
      if (visible === ! document.hidden)
          return;

      visible = ! document.hidden;
      if (visible) {
          editor.emit('visible');
      } else {
          editor.emit('hidden');
      }
      editor.emit('visibility', visible);
  }, false);

  editor.method('visibility', function() {
      return visible;
  });

  editor.method('notify:state', function() {
      if (! window.Notification)
          return null;

      return Notification.permission;
  });

  editor.method('notify:permission', function(fn) {
      if (! window.Notification)
          return;

      if (Notification.permission !== 'denied') {
          Notification.requestPermission(function(permission) {
              editor.emit('notify:permission', permission);
              if (fn) fn();
          });
      }
  });

  editor.method('notify', function(args) {
      // no supported
      if (! window.Notification || ! args.title || visible)
          return;

      args = args || { };

      var timeout;
      var queueClose = function(item) {
          setTimeout(function() {
              item.close();
          }, TIMEOUT_OVERLAP);
      };
      var notify = function() {
          if (last) {
              queueClose(last);
              last = null;
          }

          var notification = last = new Notification(args.title, {
              body: args.body,
              icon: args.icon || logo
          });

          timeout = setTimeout(function() {
              notification.close();
          }, args.timeout || TIMEOUT);

          notification.onclick = function(evt) {
              evt.preventDefault();
              notification.close();

              if (args.click)
                  args.click(evt);
          };

          notification.onclose = function(evt) {
              clearTimeout(timeout);
              timeout = null;

              if (last === notification)
                  last = null;
          };
      };

      if (Notification.permission === 'granted') {
          // allowed
          notify();
      } else if (Notification.permission !== 'denied') {
          // ask for permission
          editor.call('notify:permission', function(permission) {
              if (permission === 'granted')
                  notify();
          });
      } else {
          // no permission
      }
  });

  editor.method('notify:title', function(title) {
      document.title = title;
  });
});


/* editor/refocus.js */
editor.once('load', function() {
  'use strict';

  var last = null;
  var timeout = null;

  var onClear = function() {
      last = null;

      if (timeout) {
          clearTimeout(timeout);
          timeout = null;
      }
  };

  window.addEventListener('focus', onClear, true);

  window.addEventListener('blur', function(evt) {
      if (! evt.target || ! evt.target.ui || ! evt.target.ui.focus || ! evt.target.ui.refocusable) {
          onClear();
      } else {
          timeout = setTimeout(function() {
              last = evt.target.ui;
          }, 0);
      }
  }, true);

  window.addEventListener('keydown', function(evt) {
      if (! last)
          return;

      if (evt.keyCode === 13) {
          last.focus(true);
      } else {
          onClear();
      }
  }, false)

  window.addEventListener('mousedown', function() {
      if (last) onClear();
  }, false);
});


/* realtime/share.uncompressed.js */
(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
var textType = require('ot-text').type;
window.share = require('sharedb/lib/client');
window.share.types.register(textType);

// Copy below to node_modules/ot-text/lib/text.js bottom
/*

// Calculate the cursor position after the given operation
exports.applyToCursor = function (op) {
  var pos = 0;
  for (var i = 0; i < op.length; i++) {
      var c = op[i];
      switch (typeof c) {
          case 'number':
              pos += c;
              break;
          case 'string':
              pos += c.length;
              break;
          case 'object':
              //pos -= c.d;
              break;
      }
  }
  return pos;
};

// Generate an operation that semantically inverts the given operation
// when applied to the provided snapshot.
// It needs a snapshot of the document before the operation
// was applied to invert delete operations.
exports.semanticInvert = function (str, op) {
  if (typeof str !== 'string') {
      throw Error('Snapshot should be a string');
  }
  checkOp(op);

  // Save copy
  var originalOp = op.slice();

  // Shallow copy
  op = op.slice();

  var len = op.length;
  var cursor, prevOps, tmpStr;
  for (var i = 0; i < len; i++) {
      var c = op[i];
      switch (typeof c) {
          case 'number':
              // In case we have cursor movement we do nothing
              break;
          case 'string':
              // In case we have string insertion we generate a string deletion
              op[i] = {d: c.length};
              break;
          case 'object':
              // In case of a deletion we need to reinsert the deleted string
              prevOps = originalOp.slice(0, i);
              cursor = applyToCursor(prevOps);
              tmpStr = apply(str, trim(prevOps));
              op[i] = tmpStr.substring(cursor, cursor + c.d);
              break;
      }
  }

  return normalize(op);
};
* */

// Run "./node_modules/.bin/browserify buildme.js -o public/js/realtime/share.uncompressed.js"


},{"ot-text":9,"sharedb/lib/client":14}],2:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
  this._events = objectCreate(null);
  this._eventsCount = 0;
}

this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
var o = {};
if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    // check whether the input is a positive number (whose value is zero or
    // greater and not a NaN).
    if (typeof arg !== 'number' || arg < 0 || arg !== arg)
      throw new TypeError('"defaultMaxListeners" must be a positive number');
    defaultMaxListeners = arg;
  }
});
} else {
EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
if (typeof n !== 'number' || n < 0 || isNaN(n))
  throw new TypeError('"n" argument must be a positive number');
this._maxListeners = n;
return this;
};

function $getMaxListeners(that) {
if (that._maxListeners === undefined)
  return EventEmitter.defaultMaxListeners;
return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
if (isFn)
  handler.call(self);
else {
  var len = handler.length;
  var listeners = arrayClone(handler, len);
  for (var i = 0; i < len; ++i)
    listeners[i].call(self);
}
}
function emitOne(handler, isFn, self, arg1) {
if (isFn)
  handler.call(self, arg1);
else {
  var len = handler.length;
  var listeners = arrayClone(handler, len);
  for (var i = 0; i < len; ++i)
    listeners[i].call(self, arg1);
}
}
function emitTwo(handler, isFn, self, arg1, arg2) {
if (isFn)
  handler.call(self, arg1, arg2);
else {
  var len = handler.length;
  var listeners = arrayClone(handler, len);
  for (var i = 0; i < len; ++i)
    listeners[i].call(self, arg1, arg2);
}
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
if (isFn)
  handler.call(self, arg1, arg2, arg3);
else {
  var len = handler.length;
  var listeners = arrayClone(handler, len);
  for (var i = 0; i < len; ++i)
    listeners[i].call(self, arg1, arg2, arg3);
}
}

function emitMany(handler, isFn, self, args) {
if (isFn)
  handler.apply(self, args);
else {
  var len = handler.length;
  var listeners = arrayClone(handler, len);
  for (var i = 0; i < len; ++i)
    listeners[i].apply(self, args);
}
}

EventEmitter.prototype.emit = function emit(type) {
var er, handler, len, args, i, events;
var doError = (type === 'error');

events = this._events;
if (events)
  doError = (doError && events.error == null);
else if (!doError)
  return false;

// If there is no 'error' event listener then throw.
if (doError) {
  if (arguments.length > 1)
    er = arguments[1];
  if (er instanceof Error) {
    throw er; // Unhandled 'error' event
  } else {
    // At least give some kind of context to the user
    var err = new Error('Unhandled "error" event. (' + er + ')');
    err.context = er;
    throw err;
  }
  return false;
}

handler = events[type];

if (!handler)
  return false;

var isFn = typeof handler === 'function';
len = arguments.length;
switch (len) {
    // fast cases
  case 1:
    emitNone(handler, isFn, this);
    break;
  case 2:
    emitOne(handler, isFn, this, arguments[1]);
    break;
  case 3:
    emitTwo(handler, isFn, this, arguments[1], arguments[2]);
    break;
  case 4:
    emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
    break;
    // slower
  default:
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];
    emitMany(handler, isFn, this, args);
}

return true;
};

function _addListener(target, type, listener, prepend) {
var m;
var events;
var existing;

if (typeof listener !== 'function')
  throw new TypeError('"listener" argument must be a function');

events = target._events;
if (!events) {
  events = target._events = objectCreate(null);
  target._eventsCount = 0;
} else {
  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (events.newListener) {
    target.emit('newListener', type,
        listener.listener ? listener.listener : listener);

    // Re-assign `events` because a newListener handler could have caused the
    // this._events to be assigned to a new object
    events = target._events;
  }
  existing = events[type];
}

if (!existing) {
  // Optimize the case of one listener. Don't need the extra array object.
  existing = events[type] = listener;
  ++target._eventsCount;
} else {
  if (typeof existing === 'function') {
    // Adding the second element, need to change to array.
    existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
  } else {
    // If we've already got an array, just append.
    if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }
  }

  // Check for listener leak
  if (!existing.warned) {
    m = $getMaxListeners(target);
    if (m && m > 0 && existing.length > m) {
      existing.warned = true;
      var w = new Error('Possible EventEmitter memory leak detected. ' +
          existing.length + ' "' + String(type) + '" listeners ' +
          'added. Use emitter.setMaxListeners() to ' +
          'increase limit.');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      if (typeof console === 'object' && console.warn) {
        console.warn('%s: %s', w.name, w.message);
      }
    }
  }
}

return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
  function prependListener(type, listener) {
    return _addListener(this, type, listener, true);
  };

function onceWrapper() {
if (!this.fired) {
  this.target.removeListener(this.type, this.wrapFn);
  this.fired = true;
  switch (arguments.length) {
    case 0:
      return this.listener.call(this.target);
    case 1:
      return this.listener.call(this.target, arguments[0]);
    case 2:
      return this.listener.call(this.target, arguments[0], arguments[1]);
    case 3:
      return this.listener.call(this.target, arguments[0], arguments[1],
          arguments[2]);
    default:
      var args = new Array(arguments.length);
      for (var i = 0; i < args.length; ++i)
        args[i] = arguments[i];
      this.listener.apply(this.target, args);
  }
}
}

function _onceWrap(target, type, listener) {
var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
var wrapped = bind.call(onceWrapper, state);
wrapped.listener = listener;
state.wrapFn = wrapped;
return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
if (typeof listener !== 'function')
  throw new TypeError('"listener" argument must be a function');
this.on(type, _onceWrap(this, type, listener));
return this;
};

EventEmitter.prototype.prependOnceListener =
  function prependOnceListener(type, listener) {
    if (typeof listener !== 'function')
      throw new TypeError('"listener" argument must be a function');
    this.prependListener(type, _onceWrap(this, type, listener));
    return this;
  };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
  function removeListener(type, listener) {
    var list, events, position, i, originalListener;

    if (typeof listener !== 'function')
      throw new TypeError('"listener" argument must be a function');

    events = this._events;
    if (!events)
      return this;

    list = events[type];
    if (!list)
      return this;

    if (list === listener || list.listener === listener) {
      if (--this._eventsCount === 0)
        this._events = objectCreate(null);
      else {
        delete events[type];
        if (events.removeListener)
          this.emit('removeListener', type, list.listener || listener);
      }
    } else if (typeof list !== 'function') {
      position = -1;

      for (i = list.length - 1; i >= 0; i--) {
        if (list[i] === listener || list[i].listener === listener) {
          originalListener = list[i].listener;
          position = i;
          break;
        }
      }

      if (position < 0)
        return this;

      if (position === 0)
        list.shift();
      else
        spliceOne(list, position);

      if (list.length === 1)
        events[type] = list[0];

      if (events.removeListener)
        this.emit('removeListener', type, originalListener || listener);
    }

    return this;
  };

EventEmitter.prototype.removeAllListeners =
  function removeAllListeners(type) {
    var listeners, events, i;

    events = this._events;
    if (!events)
      return this;

    // not listening for removeListener, no need to emit
    if (!events.removeListener) {
      if (arguments.length === 0) {
        this._events = objectCreate(null);
        this._eventsCount = 0;
      } else if (events[type]) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else
          delete events[type];
      }
      return this;
    }

    // emit removeListener for all listeners on all events
    if (arguments.length === 0) {
      var keys = objectKeys(events);
      var key;
      for (i = 0; i < keys.length; ++i) {
        key = keys[i];
        if (key === 'removeListener') continue;
        this.removeAllListeners(key);
      }
      this.removeAllListeners('removeListener');
      this._events = objectCreate(null);
      this._eventsCount = 0;
      return this;
    }

    listeners = events[type];

    if (typeof listeners === 'function') {
      this.removeListener(type, listeners);
    } else if (listeners) {
      // LIFO order
      for (i = listeners.length - 1; i >= 0; i--) {
        this.removeListener(type, listeners[i]);
      }
    }

    return this;
  };

EventEmitter.prototype.listeners = function listeners(type) {
var evlistener;
var ret;
var events = this._events;

if (!events)
  ret = [];
else {
  evlistener = events[type];
  if (!evlistener)
    ret = [];
  else if (typeof evlistener === 'function')
    ret = [evlistener.listener || evlistener];
  else
    ret = unwrapListeners(evlistener);
}

return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
if (typeof emitter.listenerCount === 'function') {
  return emitter.listenerCount(type);
} else {
  return listenerCount.call(emitter, type);
}
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
var events = this._events;

if (events) {
  var evlistener = events[type];

  if (typeof evlistener === 'function') {
    return 1;
  } else if (evlistener) {
    return evlistener.length;
  }
}

return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
  list[i] = list[k];
list.pop();
}

function arrayClone(arr, n) {
var copy = new Array(n);
for (var i = 0; i < n; ++i)
  copy[i] = arr[i];
return copy;
}

function unwrapListeners(arr) {
var ret = new Array(arr.length);
for (var i = 0; i < ret.length; ++i) {
  ret[i] = arr[i].listener || arr[i];
}
return ret;
}

function objectCreatePolyfill(proto) {
var F = function() {};
F.prototype = proto;
return new F;
}
function objectKeysPolyfill(obj) {
var keys = [];
for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
  keys.push(k);
}
return k;
}
function functionBindPolyfill(context) {
var fn = this;
return function () {
  return fn.apply(context, arguments);
};
}

},{}],3:[function(require,module,exports){
// ISC @ Julien Fontanet

'use strict'

// ===================================================================

var construct = typeof Reflect !== 'undefined' ? Reflect.construct : undefined
var defineProperty = Object.defineProperty

// -------------------------------------------------------------------

var captureStackTrace = Error.captureStackTrace
if (captureStackTrace === undefined) {
captureStackTrace = function captureStackTrace (error) {
  var container = new Error()

  defineProperty(error, 'stack', {
    configurable: true,
    get: function getStack () {
      var stack = container.stack

      // Replace property with value for faster future accesses.
      defineProperty(this, 'stack', {
        configurable: true,
        value: stack,
        writable: true
      })

      return stack
    },
    set: function setStack (stack) {
      defineProperty(error, 'stack', {
        configurable: true,
        value: stack,
        writable: true
      })
    }
  })
}
}

// -------------------------------------------------------------------

function BaseError (message) {
if (message !== undefined) {
  defineProperty(this, 'message', {
    configurable: true,
    value: message,
    writable: true
  })
}

var cname = this.constructor.name
if (
  cname !== undefined &&
  cname !== this.name
) {
  defineProperty(this, 'name', {
    configurable: true,
    value: cname,
    writable: true
  })
}

captureStackTrace(this, this.constructor)
}

BaseError.prototype = Object.create(Error.prototype, {
// See: https://github.com/JsCommunity/make-error/issues/4
constructor: {
  configurable: true,
  value: BaseError,
  writable: true
}
})

// -------------------------------------------------------------------

// Sets the name of a function if possible (depends of the JS engine).
var setFunctionName = (function () {
function setFunctionName (fn, name) {
  return defineProperty(fn, 'name', {
    configurable: true,
    value: name
  })
}
try {
  var f = function () {}
  setFunctionName(f, 'foo')
  if (f.name === 'foo') {
    return setFunctionName
  }
} catch (_) {}
})()

// -------------------------------------------------------------------

function makeError (constructor, super_) {
if (super_ == null || super_ === Error) {
  super_ = BaseError
} else if (typeof super_ !== 'function') {
  throw new TypeError('super_ should be a function')
}

var name
if (typeof constructor === 'string') {
  name = constructor
  constructor = construct !== undefined
    ? function () { return construct(super_, arguments, constructor) }
    : function () { super_.apply(this, arguments) }

  // If the name can be set, do it once and for all.
  if (setFunctionName !== undefined) {
    setFunctionName(constructor, name)
    name = undefined
  }
} else if (typeof constructor !== 'function') {
  throw new TypeError('constructor should be either a string or a function')
}

// Also register the super constructor also as `constructor.super_` just
// like Node's `util.inherits()`.
constructor.super_ = constructor['super'] = super_

var properties = {
  constructor: {
    configurable: true,
    value: constructor,
    writable: true
  }
}

// If the name could not be set on the constructor, set it on the
// prototype.
if (name !== undefined) {
  properties.name = {
    configurable: true,
    value: name,
    writable: true
  }
}
constructor.prototype = Object.create(super_.prototype, properties)

return constructor
}
exports = module.exports = makeError
exports.BaseError = BaseError

},{}],4:[function(require,module,exports){
// These methods let you build a transform function from a transformComponent
// function for OT types like JSON0 in which operations are lists of components
// and transforming them requires N^2 work. I find it kind of nasty that I need
// this, but I'm not really sure what a better solution is. Maybe I should do
// this automatically to types that don't have a compose function defined.

// Add transform and transformX functions for an OT type which has
// transformComponent defined.  transformComponent(destination array,
// component, other component, side)
module.exports = bootstrapTransform
function bootstrapTransform(type, transformComponent, checkValidOp, append) {
var transformComponentX = function(left, right, destLeft, destRight) {
  transformComponent(destLeft, left, right, 'left');
  transformComponent(destRight, right, left, 'right');
};

var transformX = type.transformX = function(leftOp, rightOp) {
  checkValidOp(leftOp);
  checkValidOp(rightOp);
  var newRightOp = [];

  for (var i = 0; i < rightOp.length; i++) {
    var rightComponent = rightOp[i];

    // Generate newLeftOp by composing leftOp by rightComponent
    var newLeftOp = [];
    var k = 0;
    while (k < leftOp.length) {
      var nextC = [];
      transformComponentX(leftOp[k], rightComponent, newLeftOp, nextC);
      k++;

      if (nextC.length === 1) {
        rightComponent = nextC[0];
      } else if (nextC.length === 0) {
        for (var j = k; j < leftOp.length; j++) {
          append(newLeftOp, leftOp[j]);
        }
        rightComponent = null;
        break;
      } else {
        // Recurse.
        var pair = transformX(leftOp.slice(k), nextC);
        for (var l = 0; l < pair[0].length; l++) {
          append(newLeftOp, pair[0][l]);
        }
        for (var r = 0; r < pair[1].length; r++) {
          append(newRightOp, pair[1][r]);
        }
        rightComponent = null;
        break;
      }
    }

    if (rightComponent != null) {
      append(newRightOp, rightComponent);
    }
    leftOp = newLeftOp;
  }
  return [leftOp, newRightOp];
};

// Transforms op with specified type ('left' or 'right') by otherOp.
type.transform = function(op, otherOp, type) {
  if (!(type === 'left' || type === 'right'))
    throw new Error("type must be 'left' or 'right'");

  if (otherOp.length === 0) return op;

  if (op.length === 1 && otherOp.length === 1)
    return transformComponent([], op[0], otherOp[0], type);

  if (type === 'left')
    return transformX(op, otherOp)[0];
  else
    return transformX(otherOp, op)[1];
};
};

},{}],5:[function(require,module,exports){
// Only the JSON type is exported, because the text type is deprecated
// otherwise. (If you want to use it somewhere, you're welcome to pull it out
// into a separate module that json0 can depend on).

module.exports = {
type: require('./json0')
};

},{"./json0":6}],6:[function(require,module,exports){
/*
This is the implementation of the JSON OT type.

Spec is here: https://github.com/josephg/ShareJS/wiki/JSON-Operations

Note: This is being made obsolete. It will soon be replaced by the JSON2 type.
*/

/**
* UTILITY FUNCTIONS
*/

/**
* Checks if the passed object is an Array instance. Can't use Array.isArray
* yet because its not supported on IE8.
*
* @param obj
* @returns {boolean}
*/
var isArray = function(obj) {
return Object.prototype.toString.call(obj) == '[object Array]';
};

/**
* Checks if the passed object is an Object instance.
* No function call (fast) version
*
* @param obj
* @returns {boolean}
*/
var isObject = function(obj) {
return (!!obj) && (obj.constructor === Object);
};

/**
* Clones the passed object using JSON serialization (which is slow).
*
* hax, copied from test/types/json. Apparently this is still the fastest way
* to deep clone an object, assuming we have browser support for JSON.  @see
* http://jsperf.com/cloning-an-object/12
*/
var clone = function(o) {
return JSON.parse(JSON.stringify(o));
};

/**
* JSON OT Type
* @type {*}
*/
var json = {
name: 'json0',
uri: 'http://sharejs.org/types/JSONv0'
};

// You can register another OT type as a subtype in a JSON document using
// the following function. This allows another type to handle certain
// operations instead of the builtin JSON type.
var subtypes = {};
json.registerSubtype = function(subtype) {
subtypes[subtype.name] = subtype;
};

json.create = function(data) {
// Null instead of undefined if you don't pass an argument.
return data === undefined ? null : clone(data);
};

json.invertComponent = function(c) {
var c_ = {p: c.p};

// handle subtype ops
if (c.t && subtypes[c.t]) {
  c_.t = c.t;
  c_.o = subtypes[c.t].invert(c.o);
}

if (c.si !== void 0) c_.sd = c.si;
if (c.sd !== void 0) c_.si = c.sd;
if (c.oi !== void 0) c_.od = c.oi;
if (c.od !== void 0) c_.oi = c.od;
if (c.li !== void 0) c_.ld = c.li;
if (c.ld !== void 0) c_.li = c.ld;
if (c.na !== void 0) c_.na = -c.na;

if (c.lm !== void 0) {
  c_.lm = c.p[c.p.length-1];
  c_.p = c.p.slice(0,c.p.length-1).concat([c.lm]);
}

return c_;
};

json.invert = function(op) {
var op_ = op.slice().reverse();
var iop = [];
for (var i = 0; i < op_.length; i++) {
  iop.push(json.invertComponent(op_[i]));
}
return iop;
};

json.checkValidOp = function(op) {
for (var i = 0; i < op.length; i++) {
  if (!isArray(op[i].p)) throw new Error('Missing path');
}
};

json.checkList = function(elem) {
if (!isArray(elem))
  throw new Error('Referenced element not a list');
};

json.checkObj = function(elem) {
if (!isObject(elem)) {
  throw new Error("Referenced element not an object (it was " + JSON.stringify(elem) + ")");
}
};

// helper functions to convert old string ops to and from subtype ops
function convertFromText(c) {
c.t = 'text0';
var o = {p: c.p.pop()};
if (c.si != null) o.i = c.si;
if (c.sd != null) o.d = c.sd;
c.o = [o];
}

function convertToText(c) {
c.p.push(c.o[0].p);
if (c.o[0].i != null) c.si = c.o[0].i;
if (c.o[0].d != null) c.sd = c.o[0].d;
delete c.t;
delete c.o;
}

json.apply = function(snapshot, op) {
json.checkValidOp(op);

op = clone(op);

var container = {
  data: snapshot
};

for (var i = 0; i < op.length; i++) {
  var c = op[i];

  // convert old string ops to use subtype for backwards compatibility
  if (c.si != null || c.sd != null)
    convertFromText(c);

  var parent = null;
  var parentKey = null;
  var elem = container;
  var key = 'data';

  for (var j = 0; j < c.p.length; j++) {
    var p = c.p[j];

    parent = elem;
    parentKey = key;
    elem = elem[key];
    key = p;

    if (parent == null)
      throw new Error('Path invalid');
  }

  // handle subtype ops
  if (c.t && c.o !== void 0 && subtypes[c.t]) {
    elem[key] = subtypes[c.t].apply(elem[key], c.o);

  // Number add
  } else if (c.na !== void 0) {
    if (typeof elem[key] != 'number')
      throw new Error('Referenced element not a number');

    elem[key] += c.na;
  }

  // List replace
  else if (c.li !== void 0 && c.ld !== void 0) {
    json.checkList(elem);
    // Should check the list element matches c.ld
    elem[key] = c.li;
  }

  // List insert
  else if (c.li !== void 0) {
    json.checkList(elem);
    elem.splice(key,0, c.li);
  }

  // List delete
  else if (c.ld !== void 0) {
    json.checkList(elem);
    // Should check the list element matches c.ld here too.
    elem.splice(key,1);
  }

  // List move
  else if (c.lm !== void 0) {
    json.checkList(elem);
    if (c.lm != key) {
      var e = elem[key];
      // Remove it...
      elem.splice(key,1);
      // And insert it back.
      elem.splice(c.lm,0,e);
    }
  }

  // Object insert / replace
  else if (c.oi !== void 0) {
    json.checkObj(elem);

    // Should check that elem[key] == c.od
    elem[key] = c.oi;
  }

  // Object delete
  else if (c.od !== void 0) {
    json.checkObj(elem);

    // Should check that elem[key] == c.od
    delete elem[key];
  }

  else {
    throw new Error('invalid / missing instruction in op');
  }
}

return container.data;
};

// Helper to break an operation up into a bunch of small ops.
json.shatter = function(op) {
var results = [];
for (var i = 0; i < op.length; i++) {
  results.push([op[i]]);
}
return results;
};

// Helper for incrementally applying an operation to a snapshot. Calls yield
// after each op component has been applied.
json.incrementalApply = function(snapshot, op, _yield) {
for (var i = 0; i < op.length; i++) {
  var smallOp = [op[i]];
  snapshot = json.apply(snapshot, smallOp);
  // I'd just call this yield, but thats a reserved keyword. Bah!
  _yield(smallOp, snapshot);
}

return snapshot;
};

// Checks if two paths, p1 and p2 match.
var pathMatches = json.pathMatches = function(p1, p2, ignoreLast) {
if (p1.length != p2.length)
  return false;

for (var i = 0; i < p1.length; i++) {
  if (p1[i] !== p2[i] && (!ignoreLast || i !== p1.length - 1))
    return false;
}

return true;
};

json.append = function(dest,c) {
c = clone(c);

if (dest.length === 0) {
  dest.push(c);
  return;
}

var last = dest[dest.length - 1];

// convert old string ops to use subtype for backwards compatibility
if ((c.si != null || c.sd != null) && (last.si != null || last.sd != null)) {
  convertFromText(c);
  convertFromText(last);
}

if (pathMatches(c.p, last.p)) {
  // handle subtype ops
  if (c.t && last.t && c.t === last.t && subtypes[c.t]) {
    last.o = subtypes[c.t].compose(last.o, c.o);

    // convert back to old string ops
    if (c.si != null || c.sd != null) {
      var p = c.p;
      for (var i = 0; i < last.o.length - 1; i++) {
        c.o = [last.o.pop()];
        c.p = p.slice();
        convertToText(c);
        dest.push(c);
      }

      convertToText(last);
    }
  } else if (last.na != null && c.na != null) {
    dest[dest.length - 1] = {p: last.p, na: last.na + c.na};
  } else if (last.li !== undefined && c.li === undefined && c.ld === last.li) {
    // insert immediately followed by delete becomes a noop.
    if (last.ld !== undefined) {
      // leave the delete part of the replace
      delete last.li;
    } else {
      dest.pop();
    }
  } else if (last.od !== undefined && last.oi === undefined && c.oi !== undefined && c.od === undefined) {
    last.oi = c.oi;
  } else if (last.oi !== undefined && c.od !== undefined) {
    // The last path component inserted something that the new component deletes (or replaces).
    // Just merge them.
    if (c.oi !== undefined) {
      last.oi = c.oi;
    } else if (last.od !== undefined) {
      delete last.oi;
    } else {
      // An insert directly followed by a delete turns into a no-op and can be removed.
      dest.pop();
    }
  } else if (c.lm !== undefined && c.p[c.p.length - 1] === c.lm) {
    // don't do anything
  } else {
    dest.push(c);
  }
} else {
  // convert string ops back
  if ((c.si != null || c.sd != null) && (last.si != null || last.sd != null)) {
    convertToText(c);
    convertToText(last);
  }

  dest.push(c);
}
};

json.compose = function(op1,op2) {
json.checkValidOp(op1);
json.checkValidOp(op2);

var newOp = clone(op1);

for (var i = 0; i < op2.length; i++) {
  json.append(newOp,op2[i]);
}

return newOp;
};

json.normalize = function(op) {
var newOp = [];

op = isArray(op) ? op : [op];

for (var i = 0; i < op.length; i++) {
  var c = op[i];
  if (c.p == null) c.p = [];

  json.append(newOp,c);
}

return newOp;
};

// Returns the common length of the paths of ops a and b
json.commonLengthForOps = function(a, b) {
var alen = a.p.length;
var blen = b.p.length;
if (a.na != null || a.t)
  alen++;

if (b.na != null || b.t)
  blen++;

if (alen === 0) return -1;
if (blen === 0) return null;

alen--;
blen--;

for (var i = 0; i < alen; i++) {
  var p = a.p[i];
  if (i >= blen || p !== b.p[i])
    return null;
}

return alen;
};

// Returns true if an op can affect the given path
json.canOpAffectPath = function(op, path) {
return json.commonLengthForOps({p:path}, op) != null;
};

// transform c so it applies to a document with otherC applied.
json.transformComponent = function(dest, c, otherC, type) {
c = clone(c);

var common = json.commonLengthForOps(otherC, c);
var common2 = json.commonLengthForOps(c, otherC);
var cplength = c.p.length;
var otherCplength = otherC.p.length;

if (c.na != null || c.t)
  cplength++;

if (otherC.na != null || otherC.t)
  otherCplength++;

// if c is deleting something, and that thing is changed by otherC, we need to
// update c to reflect that change for invertibility.
if (common2 != null && otherCplength > cplength && c.p[common2] == otherC.p[common2]) {
  if (c.ld !== void 0) {
    var oc = clone(otherC);
    oc.p = oc.p.slice(cplength);
    c.ld = json.apply(clone(c.ld),[oc]);
  } else if (c.od !== void 0) {
    var oc = clone(otherC);
    oc.p = oc.p.slice(cplength);
    c.od = json.apply(clone(c.od),[oc]);
  }
}

if (common != null) {
  var commonOperand = cplength == otherCplength;

  // backward compatibility for old string ops
  var oc = otherC;
  if ((c.si != null || c.sd != null) && (otherC.si != null || otherC.sd != null)) {
    convertFromText(c);
    oc = clone(otherC);
    convertFromText(oc);
  }

  // handle subtype ops
  if (oc.t && subtypes[oc.t]) {
    if (c.t && c.t === oc.t) {
      var res = subtypes[c.t].transform(c.o, oc.o, type);

      if (res.length > 0) {
        // convert back to old string ops
        if (c.si != null || c.sd != null) {
          var p = c.p;
          for (var i = 0; i < res.length; i++) {
            c.o = [res[i]];
            c.p = p.slice();
            convertToText(c);
            json.append(dest, c);
          }
        } else {
          c.o = res;
          json.append(dest, c);
        }
      }

      return dest;
    }
  }

  // transform based on otherC
  else if (otherC.na !== void 0) {
    // this case is handled below
  } else if (otherC.li !== void 0 && otherC.ld !== void 0) {
    if (otherC.p[common] === c.p[common]) {
      // noop

      if (!commonOperand) {
        return dest;
      } else if (c.ld !== void 0) {
        // we're trying to delete the same element, -> noop
        if (c.li !== void 0 && type === 'left') {
          // we're both replacing one element with another. only one can survive
          c.ld = clone(otherC.li);
        } else {
          return dest;
        }
      }
    }
  } else if (otherC.li !== void 0) {
    if (c.li !== void 0 && c.ld === undefined && commonOperand && c.p[common] === otherC.p[common]) {
      // in li vs. li, left wins.
      if (type === 'right')
        c.p[common]++;
    } else if (otherC.p[common] <= c.p[common]) {
      c.p[common]++;
    }

    if (c.lm !== void 0) {
      if (commonOperand) {
        // otherC edits the same list we edit
        if (otherC.p[common] <= c.lm)
          c.lm++;
        // changing c.from is handled above.
      }
    }
  } else if (otherC.ld !== void 0) {
    if (c.lm !== void 0) {
      if (commonOperand) {
        if (otherC.p[common] === c.p[common]) {
          // they deleted the thing we're trying to move
          return dest;
        }
        // otherC edits the same list we edit
        var p = otherC.p[common];
        var from = c.p[common];
        var to = c.lm;
        if (p < to || (p === to && from < to))
          c.lm--;

      }
    }

    if (otherC.p[common] < c.p[common]) {
      c.p[common]--;
    } else if (otherC.p[common] === c.p[common]) {
      if (otherCplength < cplength) {
        // we're below the deleted element, so -> noop
        return dest;
      } else if (c.ld !== void 0) {
        if (c.li !== void 0) {
          // we're replacing, they're deleting. we become an insert.
          delete c.ld;
        } else {
          // we're trying to delete the same element, -> noop
          return dest;
        }
      }
    }

  } else if (otherC.lm !== void 0) {
    if (c.lm !== void 0 && cplength === otherCplength) {
      // lm vs lm, here we go!
      var from = c.p[common];
      var to = c.lm;
      var otherFrom = otherC.p[common];
      var otherTo = otherC.lm;
      if (otherFrom !== otherTo) {
        // if otherFrom == otherTo, we don't need to change our op.

        // where did my thing go?
        if (from === otherFrom) {
          // they moved it! tie break.
          if (type === 'left') {
            c.p[common] = otherTo;
            if (from === to) // ugh
              c.lm = otherTo;
          } else {
            return dest;
          }
        } else {
          // they moved around it
          if (from > otherFrom) c.p[common]--;
          if (from > otherTo) c.p[common]++;
          else if (from === otherTo) {
            if (otherFrom > otherTo) {
              c.p[common]++;
              if (from === to) // ugh, again
                c.lm++;
            }
          }

          // step 2: where am i going to put it?
          if (to > otherFrom) {
            c.lm--;
          } else if (to === otherFrom) {
            if (to > from)
              c.lm--;
          }
          if (to > otherTo) {
            c.lm++;
          } else if (to === otherTo) {
            // if we're both moving in the same direction, tie break
            if ((otherTo > otherFrom && to > from) ||
                (otherTo < otherFrom && to < from)) {
              if (type === 'right') c.lm++;
            } else {
              if (to > from) c.lm++;
              else if (to === otherFrom) c.lm--;
            }
          }
        }
      }
    } else if (c.li !== void 0 && c.ld === undefined && commonOperand) {
      // li
      var from = otherC.p[common];
      var to = otherC.lm;
      p = c.p[common];
      if (p > from) c.p[common]--;
      if (p > to) c.p[common]++;
    } else {
      // ld, ld+li, si, sd, na, oi, od, oi+od, any li on an element beneath
      // the lm
      //
      // i.e. things care about where their item is after the move.
      var from = otherC.p[common];
      var to = otherC.lm;
      p = c.p[common];
      if (p === from) {
        c.p[common] = to;
      } else {
        if (p > from) c.p[common]--;
        if (p > to) c.p[common]++;
        else if (p === to && from > to) c.p[common]++;
      }
    }
  }
  else if (otherC.oi !== void 0 && otherC.od !== void 0) {
    if (c.p[common] === otherC.p[common]) {
      if (c.oi !== void 0 && commonOperand) {
        // we inserted where someone else replaced
        if (type === 'right') {
          // left wins
          return dest;
        } else {
          // we win, make our op replace what they inserted
          c.od = otherC.oi;
        }
      } else {
        // -> noop if the other component is deleting the same object (or any parent)
        return dest;
      }
    }
  } else if (otherC.oi !== void 0) {
    if (c.oi !== void 0 && c.p[common] === otherC.p[common]) {
      // left wins if we try to insert at the same place
      if (type === 'left') {
        json.append(dest,{p: c.p, od:otherC.oi});
      } else {
        return dest;
      }
    }
  } else if (otherC.od !== void 0) {
    if (c.p[common] == otherC.p[common]) {
      if (!commonOperand)
        return dest;
      if (c.oi !== void 0) {
        delete c.od;
      } else {
        return dest;
      }
    }
  }
}

json.append(dest,c);
return dest;
};

require('./bootstrapTransform')(json, json.transformComponent, json.checkValidOp, json.append);

/**
* Register a subtype for string operations, using the text0 type.
*/
var text = require('./text0');

json.registerSubtype(text);
module.exports = json;


},{"./bootstrapTransform":4,"./text0":7}],7:[function(require,module,exports){
// DEPRECATED!
//
// This type works, but is not exported. Its included here because the JSON0
// embedded string operations use this library.


// A simple text implementation
//
// Operations are lists of components. Each component either inserts or deletes
// at a specified position in the document.
//
// Components are either:
//  {i:'str', p:100}: Insert 'str' at position 100 in the document
//  {d:'str', p:100}: Delete 'str' at position 100 in the document
//
// Components in an operation are executed sequentially, so the position of components
// assumes previous components have already executed.
//
// Eg: This op:
//   [{i:'abc', p:0}]
// is equivalent to this op:
//   [{i:'a', p:0}, {i:'b', p:1}, {i:'c', p:2}]

var text = module.exports = {
name: 'text0',
uri: 'http://sharejs.org/types/textv0',
create: function(initial) {
  if ((initial != null) && typeof initial !== 'string') {
    throw new Error('Initial data must be a string');
  }
  return initial || '';
}
};

/** Insert s2 into s1 at pos. */
var strInject = function(s1, pos, s2) {
return s1.slice(0, pos) + s2 + s1.slice(pos);
};

/** Check that an operation component is valid. Throws if its invalid. */
var checkValidComponent = function(c) {
if (typeof c.p !== 'number')
  throw new Error('component missing position field');

if ((typeof c.i === 'string') === (typeof c.d === 'string'))
  throw new Error('component needs an i or d field');

if (c.p < 0)
  throw new Error('position cannot be negative');
};

/** Check that an operation is valid */
var checkValidOp = function(op) {
for (var i = 0; i < op.length; i++) {
  checkValidComponent(op[i]);
}
};

/** Apply op to snapshot */
text.apply = function(snapshot, op) {
var deleted;

checkValidOp(op);
for (var i = 0; i < op.length; i++) {
  var component = op[i];
  if (component.i != null) {
    snapshot = strInject(snapshot, component.p, component.i);
  } else {
    deleted = snapshot.slice(component.p, component.p + component.d.length);
    if (component.d !== deleted)
      throw new Error("Delete component '" + component.d + "' does not match deleted text '" + deleted + "'");

    snapshot = snapshot.slice(0, component.p) + snapshot.slice(component.p + component.d.length);
  }
}
return snapshot;
};

/**
* Append a component to the end of newOp. Exported for use by the random op
* generator and the JSON0 type.
*/
var append = text._append = function(newOp, c) {
if (c.i === '' || c.d === '') return;

if (newOp.length === 0) {
  newOp.push(c);
} else {
  var last = newOp[newOp.length - 1];

  if (last.i != null && c.i != null && last.p <= c.p && c.p <= last.p + last.i.length) {
    // Compose the insert into the previous insert
    newOp[newOp.length - 1] = {i:strInject(last.i, c.p - last.p, c.i), p:last.p};

  } else if (last.d != null && c.d != null && c.p <= last.p && last.p <= c.p + c.d.length) {
    // Compose the deletes together
    newOp[newOp.length - 1] = {d:strInject(c.d, last.p - c.p, last.d), p:c.p};

  } else {
    newOp.push(c);
  }
}
};

/** Compose op1 and op2 together */
text.compose = function(op1, op2) {
checkValidOp(op1);
checkValidOp(op2);
var newOp = op1.slice();
for (var i = 0; i < op2.length; i++) {
  append(newOp, op2[i]);
}
return newOp;
};

/** Clean up an op */
text.normalize = function(op) {
var newOp = [];

// Normalize should allow ops which are a single (unwrapped) component:
// {i:'asdf', p:23}.
// There's no good way to test if something is an array:
// http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
// so this is probably the least bad solution.
if (op.i != null || op.p != null) op = [op];

for (var i = 0; i < op.length; i++) {
  var c = op[i];
  if (c.p == null) c.p = 0;

  append(newOp, c);
}

return newOp;
};

// This helper method transforms a position by an op component.
//
// If c is an insert, insertAfter specifies whether the transform
// is pushed after the insert (true) or before it (false).
//
// insertAfter is optional for deletes.
var transformPosition = function(pos, c, insertAfter) {
// This will get collapsed into a giant ternary by uglify.
if (c.i != null) {
  if (c.p < pos || (c.p === pos && insertAfter)) {
    return pos + c.i.length;
  } else {
    return pos;
  }
} else {
  // I think this could also be written as: Math.min(c.p, Math.min(c.p -
  // otherC.p, otherC.d.length)) but I think its harder to read that way, and
  // it compiles using ternary operators anyway so its no slower written like
  // this.
  if (pos <= c.p) {
    return pos;
  } else if (pos <= c.p + c.d.length) {
    return c.p;
  } else {
    return pos - c.d.length;
  }
}
};

// Helper method to transform a cursor position as a result of an op.
//
// Like transformPosition above, if c is an insert, insertAfter specifies
// whether the cursor position is pushed after an insert (true) or before it
// (false).
text.transformCursor = function(position, op, side) {
var insertAfter = side === 'right';
for (var i = 0; i < op.length; i++) {
  position = transformPosition(position, op[i], insertAfter);
}

return position;
};

// Transform an op component by another op component. Asymmetric.
// The result will be appended to destination.
//
// exported for use in JSON type
var transformComponent = text._tc = function(dest, c, otherC, side) {
//var cIntersect, intersectEnd, intersectStart, newC, otherIntersect, s;

checkValidComponent(c);
checkValidComponent(otherC);

if (c.i != null) {
  // Insert.
  append(dest, {i:c.i, p:transformPosition(c.p, otherC, side === 'right')});
} else {
  // Delete
  if (otherC.i != null) {
    // Delete vs insert
    var s = c.d;
    if (c.p < otherC.p) {
      append(dest, {d:s.slice(0, otherC.p - c.p), p:c.p});
      s = s.slice(otherC.p - c.p);
    }
    if (s !== '')
      append(dest, {d: s, p: c.p + otherC.i.length});

  } else {
    // Delete vs delete
    if (c.p >= otherC.p + otherC.d.length)
      append(dest, {d: c.d, p: c.p - otherC.d.length});
    else if (c.p + c.d.length <= otherC.p)
      append(dest, c);
    else {
      // They overlap somewhere.
      var newC = {d: '', p: c.p};

      if (c.p < otherC.p)
        newC.d = c.d.slice(0, otherC.p - c.p);

      if (c.p + c.d.length > otherC.p + otherC.d.length)
        newC.d += c.d.slice(otherC.p + otherC.d.length - c.p);

      // This is entirely optional - I'm just checking the deleted text in
      // the two ops matches
      var intersectStart = Math.max(c.p, otherC.p);
      var intersectEnd = Math.min(c.p + c.d.length, otherC.p + otherC.d.length);
      var cIntersect = c.d.slice(intersectStart - c.p, intersectEnd - c.p);
      var otherIntersect = otherC.d.slice(intersectStart - otherC.p, intersectEnd - otherC.p);
      if (cIntersect !== otherIntersect)
        throw new Error('Delete ops delete different text in the same region of the document');

      if (newC.d !== '') {
        newC.p = transformPosition(newC.p, otherC);
        append(dest, newC);
      }
    }
  }
}

return dest;
};

var invertComponent = function(c) {
return (c.i != null) ? {d:c.i, p:c.p} : {i:c.d, p:c.p};
};

// No need to use append for invert, because the components won't be able to
// cancel one another.
text.invert = function(op) {
// Shallow copy & reverse that sucka.
op = op.slice().reverse();
for (var i = 0; i < op.length; i++) {
  op[i] = invertComponent(op[i]);
}
return op;
};

require('./bootstrapTransform')(text, transformComponent, checkValidOp, append);

},{"./bootstrapTransform":4}],8:[function(require,module,exports){
// Text document API for the 'text' type. This implements some standard API
// methods for any text-like type, so you can easily bind a textarea or
// something without being fussy about the underlying OT implementation.
//
// The API is desigend as a set of functions to be mixed in to some context
// object as part of its lifecycle. It expects that object to have getSnapshot
// and submitOp methods, and call _onOp when an operation is received.
//
// This API defines:
//
// - getLength() returns the length of the document in characters
// - getText() returns a string of the document
// - insert(pos, text, [callback]) inserts text at position pos in the document
// - remove(pos, length, [callback]) removes length characters at position pos
//
// A user can define:
// - onInsert(pos, text): Called when text is inserted.
// - onRemove(pos, length): Called when text is removed.

module.exports = api;
function api(getSnapshot, submitOp) {
return {
  // Returns the text content of the document
  get: function() { return getSnapshot(); },

  // Returns the number of characters in the string
  getLength: function() { return getSnapshot().length; },

  // Insert the specified text at the given position in the document
  insert: function(pos, text, callback) {
    return submitOp([pos, text], callback);
  },

  remove: function(pos, length, callback) {
    return submitOp([pos, {d:length}], callback);
  },

  // When you use this API, you should implement these two methods
  // in your editing context.
  //onInsert: function(pos, text) {},
  //onRemove: function(pos, removedLength) {},

  _onOp: function(op) {
    var pos = 0;
    var spos = 0;
    for (var i = 0; i < op.length; i++) {
      var component = op[i];
      switch (typeof component) {
        case 'number':
          pos += component;
          spos += component;
          break;
        case 'string':
          if (this.onInsert) this.onInsert(pos, component);
          pos += component.length;
          break;
        case 'object':
          if (this.onRemove) this.onRemove(pos, component.d);
          spos += component.d;
      }
    }
  }
};
};
api.provides = {text: true};

},{}],9:[function(require,module,exports){
var type = require('./text');
type.api = require('./api');

module.exports = {
type: type
};

},{"./api":8,"./text":10}],10:[function(require,module,exports){
/* Text OT!
*
* This is an OT implementation for text. It is the standard implementation of
* text used by ShareJS.
*
* This type is composable but non-invertable. Its similar to ShareJS's old
* text-composable type, but its not invertable and its very similar to the
* text-tp2 implementation but it doesn't support tombstones or purging.
*
* Ops are lists of components which iterate over the document.
* Components are either:
*   A number N: Skip N characters in the original document
*   "str"     : Insert "str" at the current position in the document
*   {d:N}     : Delete N characters at the current position in the document
*
* Eg: [3, 'hi', 5, {d:8}]
*
* The operation does not have to skip the last characters in the document.
*
* Snapshots are strings.
*
* Cursors are either a single number (which is the cursor position) or a pair of
* [anchor, focus] (aka [start, end]). Be aware that end can be before start.
*/

/** @module text */

exports.name = 'text';
exports.uri = 'http://sharejs.org/types/textv1';

/** Create a new text snapshot.
*
* @param {string} initial - initial snapshot data. Optional. Defaults to ''.
*/
exports.create = function(initial) {
if ((initial != null) && typeof initial !== 'string') {
  throw Error('Initial data must be a string');
}
return initial || '';
};

var isArray = Array.isArray || function(obj) {
return Object.prototype.toString.call(obj) === "[object Array]";
};

/** Check the operation is valid. Throws if not valid. */
var checkOp = function(op) {
if (!isArray(op)) throw Error('Op must be an array of components');

var last = null;
for (var i = 0; i < op.length; i++) {
  var c = op[i];
  switch (typeof c) {
    case 'object':
      // The only valid objects are {d:X} for +ive values of X.
      if (!(typeof c.d === 'number' && c.d > 0)) throw Error('Object components must be deletes of size > 0');
      break;
    case 'string':
      // Strings are inserts.
      if (!(c.length > 0)) throw Error('Inserts cannot be empty');
      break;
    case 'number':
      // Numbers must be skips. They have to be +ive numbers.
      if (!(c > 0)) throw Error('Skip components must be >0');
      if (typeof last === 'number') throw Error('Adjacent skip components should be combined');
      break;
  }
  last = c;
}

if (typeof last === 'number') throw Error('Op has a trailing skip');
};

/** Check that the given selection range is valid. */
var checkSelection = function(selection) {
// This may throw from simply inspecting selection[0] / selection[1]. Thats
// sort of ok, though it'll generate the wrong message.
if (typeof selection !== 'number'
    && (typeof selection[0] !== 'number' || typeof selection[1] !== 'number'))
  throw Error('Invalid selection');
};

/** Make a function that appends to the given operation. */
var makeAppend = function(op) {
return function(component) {
  if (!component || component.d === 0) {
    // The component is a no-op. Ignore!

  } else if (op.length === 0) {
    return op.push(component);

  } else if (typeof component === typeof op[op.length - 1]) {
    if (typeof component === 'object') {
      return op[op.length - 1].d += component.d;
    } else {
      return op[op.length - 1] += component;
    }
  } else {
    return op.push(component);
  }
};
};

/** Makes and returns utility functions take and peek. */
var makeTake = function(op) {
// The index of the next component to take
var idx = 0;
// The offset into the component
var offset = 0;

// Take up to length n from the front of op. If n is -1, take the entire next
// op component. If indivisableField == 'd', delete components won't be separated.
// If indivisableField == 'i', insert components won't be separated.
var take = function(n, indivisableField) {
  // We're at the end of the operation. The op has skips, forever. Infinity
  // might make more sense than null here.
  if (idx === op.length)
    return n === -1 ? null : n;

  var part;
  var c = op[idx];
  if (typeof c === 'number') {
    // Skip
    if (n === -1 || c - offset <= n) {
      part = c - offset;
      ++idx;
      offset = 0;
      return part;
    } else {
      offset += n;
      return n;
    }
  } else if (typeof c === 'string') {
    // Insert
    if (n === -1 || indivisableField === 'i' || c.length - offset <= n) {
      part = c.slice(offset);
      ++idx;
      offset = 0;
      return part;
    } else {
      part = c.slice(offset, offset + n);
      offset += n;
      return part;
    }
  } else {
    // Delete
    if (n === -1 || indivisableField === 'd' || c.d - offset <= n) {
      part = {d: c.d - offset};
      ++idx;
      offset = 0;
      return part;
    } else {
      offset += n;
      return {d: n};
    }
  }
};

// Peek at the next op that will be returned.
var peekType = function() { return op[idx]; };

return [take, peekType];
};

/** Get the length of a component */
var componentLength = function(c) {
// Uglify will compress this down into a ternary
if (typeof c === 'number') {
  return c;
} else {
  return c.length || c.d;
}
};

/** Trim any excess skips from the end of an operation.
*
* There should only be at most one, because the operation was made with append.
*/
var trim = function(op) {
if (op.length > 0 && typeof op[op.length - 1] === 'number') {
  op.pop();
}
return op;
};

exports.normalize = function(op) {
var newOp = [];
var append = makeAppend(newOp);
for (var i = 0; i < op.length; i++) {
  append(op[i]);
}
return trim(newOp);
};

/** Apply an operation to a document snapshot */
exports.apply = function(str, op) {
if (typeof str !== 'string') {
  throw Error('Snapshot should be a string');
}
checkOp(op);

// We'll gather the new document here and join at the end.
var newDoc = [];

for (var i = 0; i < op.length; i++) {
  var component = op[i];
  switch (typeof component) {
    case 'number':
      if (component > str.length) throw Error('The op is too long for this document');

      newDoc.push(str.slice(0, component));
      // This might be slow for big strings. Consider storing the offset in
      // str instead of rewriting it each time.
      str = str.slice(component);
      break;
    case 'string':
      newDoc.push(component);
      break;
    case 'object':
      str = str.slice(component.d);
      break;
  }
}

return newDoc.join('') + str;
};

/** Transform op by otherOp.
*
* @param op - The operation to transform
* @param otherOp - Operation to transform it by
* @param side - Either 'left' or 'right'
*/
exports.transform = function(op, otherOp, side) {
if (side != 'left' && side != 'right') throw Error("side (" + side + ") must be 'left' or 'right'");

checkOp(op);
checkOp(otherOp);

var newOp = [];
var append = makeAppend(newOp);

var _fns = makeTake(op);
var take = _fns[0],
    peek = _fns[1];

for (var i = 0; i < otherOp.length; i++) {
  var component = otherOp[i];

  var length, chunk;
  switch (typeof component) {
    case 'number': // Skip
      length = component;
      while (length > 0) {
        chunk = take(length, 'i');
        append(chunk);
        if (typeof chunk !== 'string') {
          length -= componentLength(chunk);
        }
      }
      break;

    case 'string': // Insert
      if (side === 'left') {
        // The left insert should go first.
        if (typeof peek() === 'string') {
          append(take(-1));
        }
      }

      // Otherwise skip the inserted text.
      append(component.length);
      break;

    case 'object': // Delete
      length = component.d;
      while (length > 0) {
        chunk = take(length, 'i');
        switch (typeof chunk) {
          case 'number':
            length -= chunk;
            break;
          case 'string':
            append(chunk);
            break;
          case 'object':
            // The delete is unnecessary now - the text has already been deleted.
            length -= chunk.d;
        }
      }
      break;
  }
}

// Append any extra data in op1.
while ((component = take(-1)))
  append(component);

return trim(newOp);
};

/** Compose op1 and op2 together and return the result */
exports.compose = function(op1, op2) {
checkOp(op1);
checkOp(op2);

var result = [];
var append = makeAppend(result);
var take = makeTake(op1)[0];

for (var i = 0; i < op2.length; i++) {
  var component = op2[i];
  var length, chunk;
  switch (typeof component) {
    case 'number': // Skip
      length = component;
      while (length > 0) {
        chunk = take(length, 'd');
        append(chunk);
        if (typeof chunk !== 'object') {
          length -= componentLength(chunk);
        }
      }
      break;

    case 'string': // Insert
      append(component);
      break;

    case 'object': // Delete
      length = component.d;

      while (length > 0) {
        chunk = take(length, 'd');

        switch (typeof chunk) {
          case 'number':
            append({d: chunk});
            length -= chunk;
            break;
          case 'string':
            length -= chunk.length;
            break;
          case 'object':
            append(chunk);
        }
      }
      break;
  }
}

while ((component = take(-1)))
  append(component);

return trim(result);
};


var transformPosition = function(cursor, op) {
var pos = 0;
for (var i = 0; i < op.length; i++) {
  var c = op[i];
  if (cursor <= pos) break;

  // I could actually use the op_iter stuff above - but I think its simpler
  // like this.
  switch (typeof c) {
    case 'number':
      if (cursor <= pos + c)
        return cursor;
      pos += c;
      break;

    case 'string':
      pos += c.length;
      cursor += c.length;
      break;

    case 'object':
      cursor -= Math.min(c.d, cursor - pos);
      break;
  }
}
return cursor;
};

exports.transformSelection = function(selection, op, isOwnOp) {
var pos = 0;
if (isOwnOp) {
  // Just track the position. We'll teleport the cursor to the end anyway.
  // This works because text ops don't have any trailing skips at the end - so the last
  // component is the last thing.
  for (var i = 0; i < op.length; i++) {
    var c = op[i];
    switch (typeof c) {
      case 'number':
        pos += c;
        break;
      case 'string':
        pos += c.length;
        break;
      // Just eat deletes.
    }
  }
  return pos;
} else {
  return typeof selection === 'number' ?
    transformPosition(selection, op) : [transformPosition(selection[0], op), transformPosition(selection[1], op)];
}
};

exports.selectionEq = function(c1, c2) {
if (c1[0] != null && c1[0] === c1[1]) c1 = c1[0];
if (c2[0] != null && c2[0] === c2[1]) c2 = c2[0];
return c1 === c2 || (c1[0] != null && c2[0] != null && c1[0] === c2[0] && c1[1] == c2[1]);
};


// Calculate the cursor position after the given operation
exports.applyToCursor = function (op) {
  var pos = 0;
  for (var i = 0; i < op.length; i++) {
      var c = op[i];
      switch (typeof c) {
          case 'number':
              pos += c;
              break;
          case 'string':
              pos += c.length;
              break;
          case 'object':
              //pos -= c.d;
              break;
      }
  }
  return pos;
};

// Generate an operation that semantically inverts the given operation
// when applied to the provided snapshot.
// It needs a snapshot of the document before the operation
// was applied to invert delete operations.
exports.semanticInvert = function (str, op) {
  if (typeof str !== 'string') {
      throw Error('Snapshot should be a string');
  }
  checkOp(op);

  // Save copy
  var originalOp = op.slice();

  // Shallow copy
  op = op.slice();

  var len = op.length;
  var cursor, prevOps, tmpStr;
  for (var i = 0; i < len; i++) {
      var c = op[i];
      switch (typeof c) {
          case 'number':
              // In case we have cursor movement we do nothing
              break;
          case 'string':
              // In case we have string insertion we generate a string deletion
              op[i] = {d: c.length};
              break;
          case 'object':
              // In case of a deletion we need to reinsert the deleted string
              prevOps = originalOp.slice(0, i);
              cursor = this.applyToCursor(prevOps);
              tmpStr = this.apply(str, trim(prevOps));
              op[i] = tmpStr.substring(cursor, cursor + c.d);
              break;
      }
  }

  return this.normalize(op);
};

},{}],11:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
  throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
  throw new Error('clearTimeout has not been defined');
}
(function () {
  try {
      if (typeof setTimeout === 'function') {
          cachedSetTimeout = setTimeout;
      } else {
          cachedSetTimeout = defaultSetTimout;
      }
  } catch (e) {
      cachedSetTimeout = defaultSetTimout;
  }
  try {
      if (typeof clearTimeout === 'function') {
          cachedClearTimeout = clearTimeout;
      } else {
          cachedClearTimeout = defaultClearTimeout;
      }
  } catch (e) {
      cachedClearTimeout = defaultClearTimeout;
  }
} ())
function runTimeout(fun) {
  if (cachedSetTimeout === setTimeout) {
      //normal enviroments in sane situations
      return setTimeout(fun, 0);
  }
  // if setTimeout wasn't available but was latter defined
  if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
      cachedSetTimeout = setTimeout;
      return setTimeout(fun, 0);
  }
  try {
      // when when somebody has screwed with setTimeout but no I.E. maddness
      return cachedSetTimeout(fun, 0);
  } catch(e){
      try {
          // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
          return cachedSetTimeout.call(null, fun, 0);
      } catch(e){
          // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
          return cachedSetTimeout.call(this, fun, 0);
      }
  }


}
function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
      //normal enviroments in sane situations
      return clearTimeout(marker);
  }
  // if clearTimeout wasn't available but was latter defined
  if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
      cachedClearTimeout = clearTimeout;
      return clearTimeout(marker);
  }
  try {
      // when when somebody has screwed with setTimeout but no I.E. maddness
      return cachedClearTimeout(marker);
  } catch (e){
      try {
          // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
          return cachedClearTimeout.call(null, marker);
      } catch (e){
          // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
          // Some versions of I.E. have different rules for clearTimeout vs setTimeout
          return cachedClearTimeout.call(this, marker);
      }
  }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
  if (!draining || !currentQueue) {
      return;
  }
  draining = false;
  if (currentQueue.length) {
      queue = currentQueue.concat(queue);
  } else {
      queueIndex = -1;
  }
  if (queue.length) {
      drainQueue();
  }
}

function drainQueue() {
  if (draining) {
      return;
  }
  var timeout = runTimeout(cleanUpNextTick);
  draining = true;

  var len = queue.length;
  while(len) {
      currentQueue = queue;
      queue = [];
      while (++queueIndex < len) {
          if (currentQueue) {
              currentQueue[queueIndex].run();
          }
      }
      queueIndex = -1;
      len = queue.length;
  }
  currentQueue = null;
  draining = false;
  runClearTimeout(timeout);
}

process.nextTick = function (fun) {
  var args = new Array(arguments.length - 1);
  if (arguments.length > 1) {
      for (var i = 1; i < arguments.length; i++) {
          args[i - 1] = arguments[i];
      }
  }
  queue.push(new Item(fun, args));
  if (queue.length === 1 && !draining) {
      runTimeout(drainQueue);
  }
};

// v8 likes predictible objects
function Item(fun, array) {
  this.fun = fun;
  this.array = array;
}
Item.prototype.run = function () {
  this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
  throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
  throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],12:[function(require,module,exports){
(function (process){
var Doc = require('./doc');
var Query = require('./query');
var emitter = require('../emitter');
var ShareDBError = require('../error');
var types = require('../types');
var util = require('../util');

/**
* Handles communication with the sharejs server and provides queries and
* documents.
*
* We create a connection with a socket object
*   connection = new sharejs.Connection(sockset)
* The socket may be any object handling the websocket protocol. See the
* documentation of bindToSocket() for details. We then wait for the connection
* to connect
*   connection.on('connected', ...)
* and are finally able to work with shared documents
*   connection.get('food', 'steak') // Doc
*
* @param socket @see bindToSocket
*/
module.exports = Connection;
function Connection(socket) {
emitter.EventEmitter.call(this);

// Map of collection -> id -> doc object for created documents.
// (created documents MUST BE UNIQUE)
this.collections = {};

// Each query is created with an id that the server uses when it sends us
// info about the query (updates, etc)
this.nextQueryId = 1;

// Map from query ID -> query object.
this.queries = {};

// A unique message number for the given id
this.seq = 1;

// Equals agent.clientId on the server
this.id = null;

// This direct reference from connection to agent is not used internal to
// ShareDB, but it is handy for server-side only user code that may cache
// state on the agent and read it in middleware
this.agent = null;

this.debug = false;

this.bindToSocket(socket);
}
emitter.mixin(Connection);


/**
* Use socket to communicate with server
*
* Socket is an object that can handle the websocket protocol. This method
* installs the onopen, onclose, onmessage and onerror handlers on the socket to
* handle communication and sends messages by calling socket.send(message). The
* sockets `readyState` property is used to determine the initaial state.
*
* @param socket Handles the websocket protocol
* @param socket.readyState
* @param socket.close
* @param socket.send
* @param socket.onopen
* @param socket.onclose
* @param socket.onmessage
* @param socket.onerror
*/
Connection.prototype.bindToSocket = function(socket) {
if (this.socket) {
  this.socket.close();
  this.socket.onmessage = null;
  this.socket.onopen = null;
  this.socket.onerror = null;
  this.socket.onclose = null;
}

this.socket = socket;

// State of the connection. The correspoding events are emmited when this changes
//
// - 'connecting'   The connection is still being established, or we are still
//                    waiting on the server to send us the initialization message
// - 'connected'    The connection is open and we have connected to a server
//                    and recieved the initialization message
// - 'disconnected' Connection is closed, but it will reconnect automatically
// - 'closed'       The connection was closed by the client, and will not reconnect
// - 'stopped'      The connection was closed by the server, and will not reconnect
this.state = (socket.readyState === 0 || socket.readyState === 1) ? 'connecting' : 'disconnected';

// This is a helper variable the document uses to see whether we're
// currently in a 'live' state. It is true if and only if we're connected
this.canSend = false;

var connection = this;

socket.onmessage = function(event) {
  try {
    var data = (typeof event.data === 'string') ?
      JSON.parse(event.data) : event.data;
  } catch (err) {
    console.warn('Failed to parse message', event);
    return;
  }

  if (connection.debug) console.log('RECV', JSON.stringify(data));

  var request = {data: data};
  connection.emit('receive', request);
  if (!request.data) return;

  try {
    connection.handleMessage(request.data);
  } catch (err) {
    process.nextTick(function() {
      connection.emit('error', err);
    });
  }
};

socket.onopen = function() {
  connection._setState('connecting');
};

socket.onerror = function(err) {
  // This isn't the same as a regular error, because it will happen normally
  // from time to time. Your connection should probably automatically
  // reconnect anyway, but that should be triggered off onclose not onerror.
  // (onclose happens when onerror gets called anyway).
  connection.emit('connection error', err);
};

socket.onclose = function(reason) {
  // node-browserchannel reason values:
  //   'Closed' - The socket was manually closed by calling socket.close()
  //   'Stopped by server' - The server sent the stop message to tell the client not to try connecting
  //   'Request failed' - Server didn't respond to request (temporary, usually offline)
  //   'Unknown session ID' - Server session for client is missing (temporary, will immediately reestablish)

  if (reason === 'closed' || reason === 'Closed') {
    connection._setState('closed', reason);

  } else if (reason === 'stopped' || reason === 'Stopped by server') {
    connection._setState('stopped', reason);

  } else {
    connection._setState('disconnected', reason);
  }
};
};

/**
* @param {object} message
* @param {String} message.a action
*/
Connection.prototype.handleMessage = function(message) {
var err = null;
if (message.error) {
  // wrap in Error object so can be passed through event emitters
  err = new Error(message.error.message);
  err.code = message.error.code;
  // Add the message data to the error object for more context
  err.data = message;
  delete message.error;
}
// Switch on the message action. Most messages are for documents and are
// handled in the doc class.
switch (message.a) {
  case 'init':
    // Client initialization packet
    if (message.protocol !== 1) {
      err = new ShareDBError(4019, 'Invalid protocol version');
      return this.emit('error', err);
    }
    if (types.map[message.type] !== types.defaultType) {
      err = new ShareDBError(4020, 'Invalid default type');
      return this.emit('error', err);
    }
    if (typeof message.id !== 'string') {
      err = new ShareDBError(4021, 'Invalid client id');
      return this.emit('error', err);
    }
    this.id = message.id;

    this._setState('connected');
    return;

  case 'qf':
    var query = this.queries[message.id];
    if (query) query._handleFetch(err, message.data, message.extra);
    return;
  case 'qs':
    var query = this.queries[message.id];
    if (query) query._handleSubscribe(err, message.data, message.extra);
    return;
  case 'qu':
    // Queries are removed immediately on calls to destroy, so we ignore
    // replies to query unsubscribes. Perhaps there should be a callback for
    // destroy, but this is currently unimplemented
    return;
  case 'q':
    // Query message. Pass this to the appropriate query object.
    var query = this.queries[message.id];
    if (!query) return;
    if (err) return query._handleError(err);
    if (message.diff) query._handleDiff(message.diff);
    if (message.hasOwnProperty('extra')) query._handleExtra(message.extra);
    return;

  case 'bf':
    return this._handleBulkMessage(message, '_handleFetch');
  case 'bs':
    return this._handleBulkMessage(message, '_handleSubscribe');
  case 'bu':
    return this._handleBulkMessage(message, '_handleUnsubscribe');

  case 'f':
    var doc = this.getExisting(message.c, message.d);
    if (doc) doc._handleFetch(err, message.data);
    return;
  case 's':
    var doc = this.getExisting(message.c, message.d);
    if (doc) doc._handleSubscribe(err, message.data);
    return;
  case 'u':
    var doc = this.getExisting(message.c, message.d);
    if (doc) doc._handleUnsubscribe(err);
    return;
  case 'op':
    var doc = this.getExisting(message.c, message.d);
    if (doc) doc._handleOp(err, message);
    return;

  default:
    console.warn('Ignoring unrecognized message', message);
}
};

Connection.prototype._handleBulkMessage = function(message, method) {
if (message.data) {
  for (var id in message.data) {
    var doc = this.getExisting(message.c, id);
    if (doc) doc[method](message.error, message.data[id]);
  }
} else if (Array.isArray(message.b)) {
  for (var i = 0; i < message.b.length; i++) {
    var id = message.b[i];
    var doc = this.getExisting(message.c, id);
    if (doc) doc[method](message.error);
  }
} else if (message.b) {
  for (var id in message.b) {
    var doc = this.getExisting(message.c, id);
    if (doc) doc[method](message.error);
  }
} else {
  console.error('Invalid bulk message', message);
}
};

Connection.prototype._reset = function() {
this.seq = 1;
this.id = null;
this.agent = null;
};

// Set the connection's state. The connection is basically a state machine.
Connection.prototype._setState = function(newState, reason) {
if (this.state === newState) return;

// I made a state diagram. The only invalid transitions are getting to
// 'connecting' from anywhere other than 'disconnected' and getting to
// 'connected' from anywhere other than 'connecting'.
if (
  (newState === 'connecting' && this.state !== 'disconnected' && this.state !== 'stopped' && this.state !== 'closed') ||
  (newState === 'connected' && this.state !== 'connecting')
) {
  var err = new ShareDBError(5007, 'Cannot transition directly from ' + this.state + ' to ' + newState);
  return this.emit('error', err);
}

this.state = newState;
this.canSend = (newState === 'connected');

if (newState === 'disconnected' || newState === 'stopped' || newState === 'closed') this._reset();

// Group subscribes together to help server make more efficient calls
this.startBulk();
// Emit the event to all queries
for (var id in this.queries) {
  var query = this.queries[id];
  query._onConnectionStateChanged();
}
// Emit the event to all documents
for (var collection in this.collections) {
  var docs = this.collections[collection];
  for (var id in docs) {
    docs[id]._onConnectionStateChanged();
  }
}
this.endBulk();

this.emit(newState, reason);
this.emit('state', newState, reason);
};

Connection.prototype.startBulk = function() {
if (!this.bulk) this.bulk = {};
};

Connection.prototype.endBulk = function() {
if (this.bulk) {
  for (var collection in this.bulk) {
    var actions = this.bulk[collection];
    this._sendBulk('f', collection, actions.f);
    this._sendBulk('s', collection, actions.s);
    this._sendBulk('u', collection, actions.u);
  }
}
this.bulk = null;
};

Connection.prototype._sendBulk = function(action, collection, values) {
if (!values) return;
var ids = [];
var versions = {};
var versionsCount = 0;
var versionId;
for (var id in values) {
  var value = values[id];
  if (value == null) {
    ids.push(id);
  } else {
    versions[id] = value;
    versionId = id;
    versionsCount++;
  }
}
if (ids.length === 1) {
  var id = ids[0];
  this.send({a: action, c: collection, d: id});
} else if (ids.length) {
  this.send({a: 'b' + action, c: collection, b: ids});
}
if (versionsCount === 1) {
  var version = versions[versionId];
  this.send({a: action, c: collection, d: versionId, v: version});
} else if (versionsCount) {
  this.send({a: 'b' + action, c: collection, b: versions});
}
};

Connection.prototype._sendAction = function(action, doc, version) {
// Ensure the doc is registered so that it receives the reply message
this._addDoc(doc);
if (this.bulk) {
  // Bulk subscribe
  var actions = this.bulk[doc.collection] || (this.bulk[doc.collection] = {});
  var versions = actions[action] || (actions[action] = {});
  var isDuplicate = versions.hasOwnProperty(doc.id);
  versions[doc.id] = version;
  return isDuplicate;
} else {
  // Send single doc subscribe message
  var message = {a: action, c: doc.collection, d: doc.id, v: version};
  this.send(message);
}
};

Connection.prototype.sendFetch = function(doc) {
return this._sendAction('f', doc, doc.version);
};

Connection.prototype.sendSubscribe = function(doc) {
return this._sendAction('s', doc, doc.version);
};

Connection.prototype.sendUnsubscribe = function(doc) {
return this._sendAction('u', doc);
};

Connection.prototype.sendOp = function(doc, op) {
// Ensure the doc is registered so that it receives the reply message
this._addDoc(doc);
var message = {
  a: 'op',
  c: doc.collection,
  d: doc.id,
  v: doc.version,
  src: op.src,
  seq: op.seq
};
if (op.op) message.op = op.op;
if (op.create) message.create = op.create;
if (op.del) message.del = op.del;
this.send(message);
};


/**
* Sends a message down the socket
*/
Connection.prototype.send = function(message) {
if (this.debug) console.log('SEND', JSON.stringify(message));

this.emit('send', message);
this.socket.send(JSON.stringify(message));
};


/**
* Closes the socket and emits 'closed'
*/
Connection.prototype.close = function() {
this.socket.close();
};

Connection.prototype.getExisting = function(collection, id) {
if (this.collections[collection]) return this.collections[collection][id];
};


/**
* Get or create a document.
*
* @param collection
* @param id
* @return {Doc}
*/
Connection.prototype.get = function(collection, id) {
var docs = this.collections[collection] ||
  (this.collections[collection] = {});

var doc = docs[id];
if (!doc) {
  doc = docs[id] = new Doc(this, collection, id);
  this.emit('doc', doc);
}

return doc;
};


/**
* Remove document from this.collections
*
* @private
*/
Connection.prototype._destroyDoc = function(doc) {
var docs = this.collections[doc.collection];
if (!docs) return;

delete docs[doc.id];

// Delete the collection container if its empty. This could be a source of
// memory leaks if you slowly make a billion collections, which you probably
// won't do anyway, but whatever.
if (!util.hasKeys(docs)) {
  delete this.collections[doc.collection];
}
};

Connection.prototype._addDoc = function(doc) {
var docs = this.collections[doc.collection];
if (!docs) {
  docs = this.collections[doc.collection] = {};
}
if (docs[doc.id] !== doc) {
  docs[doc.id] = doc;
}
};

// Helper for createFetchQuery and createSubscribeQuery, below.
Connection.prototype._createQuery = function(action, collection, q, options, callback) {
var id = this.nextQueryId++;
var query = new Query(action, this, id, collection, q, options, callback);
this.queries[id] = query;
query.send();
return query;
};

// Internal function. Use query.destroy() to remove queries.
Connection.prototype._destroyQuery = function(query) {
delete this.queries[query.id];
};

// The query options object can contain the following fields:
//
// db: Name of the db for the query. You can attach extraDbs to ShareDB and
//   pick which one the query should hit using this parameter.

// Create a fetch query. Fetch queries are only issued once, returning the
// results directly into the callback.
//
// The callback should have the signature function(error, results, extra)
// where results is a list of Doc objects.
Connection.prototype.createFetchQuery = function(collection, q, options, callback) {
return this._createQuery('qf', collection, q, options, callback);
};

// Create a subscribe query. Subscribe queries return with the initial data
// through the callback, then update themselves whenever the query result set
// changes via their own event emitter.
//
// If present, the callback should have the signature function(error, results, extra)
// where results is a list of Doc objects.
Connection.prototype.createSubscribeQuery = function(collection, q, options, callback) {
return this._createQuery('qs', collection, q, options, callback);
};

Connection.prototype.hasPending = function() {
return !!(
  this._firstDoc(hasPending) ||
  this._firstQuery(hasPending)
);
};
function hasPending(object) {
return object.hasPending();
}

Connection.prototype.hasWritePending = function() {
return !!this._firstDoc(hasWritePending);
};
function hasWritePending(object) {
return object.hasWritePending();
}

Connection.prototype.whenNothingPending = function(callback) {
var doc = this._firstDoc(hasPending);
if (doc) {
  // If a document is found with a pending operation, wait for it to emit
  // that nothing is pending anymore, and then recheck all documents again.
  // We have to recheck all documents, just in case another mutation has
  // been made in the meantime as a result of an event callback
  doc.once('nothing pending', this._nothingPendingRetry(callback));
  return;
}
var query = this._firstQuery(hasPending);
if (query) {
  query.once('ready', this._nothingPendingRetry(callback));
  return;
}
// Call back when no pending operations
process.nextTick(callback);
};
Connection.prototype._nothingPendingRetry = function(callback) {
var connection = this;
return function() {
  process.nextTick(function() {
    connection.whenNothingPending(callback);
  });
};
};

Connection.prototype._firstDoc = function(fn) {
for (var collection in this.collections) {
  var docs = this.collections[collection];
  for (var id in docs) {
    var doc = docs[id];
    if (fn(doc)) {
      return doc;
    }
  }
}
};

Connection.prototype._firstQuery = function(fn) {
for (var id in this.queries) {
  var query = this.queries[id];
  if (fn(query)) {
    return query;
  }
}
};

}).call(this,require('_process'))
},{"../emitter":16,"../error":17,"../types":18,"../util":19,"./doc":13,"./query":15,"_process":11}],13:[function(require,module,exports){
(function (process){
var emitter = require('../emitter');
var ShareDBError = require('../error');
var types = require('../types');

/**
* A Doc is a client's view on a sharejs document.
*
* It is is uniquely identified by its `id` and `collection`.  Documents
* should not be created directly. Create them with connection.get()
*
*
* Subscriptions
* -------------
*
* We can subscribe a document to stay in sync with the server.
*   doc.subscribe(function(error) {
*     doc.subscribed // = true
*   })
* The server now sends us all changes concerning this document and these are
* applied to our data. If the subscription was successful the initial
* data and version sent by the server are loaded into the document.
*
* To stop listening to the changes we call `doc.unsubscribe()`.
*
* If we just want to load the data but not stay up-to-date, we call
*   doc.fetch(function(error) {
*     doc.data // sent by server
*   })
*
*
* Events
* ------
*
* You can use doc.on(eventName, callback) to subscribe to the following events:
* - `before op (op, source)` Fired before a partial operation is applied to the data.
*   It may be used to read the old data just before applying an operation
* - `op (op, source)` Fired after every partial operation with this operation as the
*   first argument
* - `create (source)` The document was created. That means its type was
*   set and it has some initial data.
* - `del (data, source)` Fired after the document is deleted, that is
*   the data is null. It is passed the data before delteion as an
*   arguments
* - `load ()` Fired when a new snapshot is ingested from a fetch, subscribe, or query
*/

module.exports = Doc;
function Doc(connection, collection, id) {
emitter.EventEmitter.call(this);

this.connection = connection;

this.collection = collection;
this.id = id;

this.version = null;
this.type = null;
this.data = undefined;

// Array of callbacks or nulls as placeholders
this.inflightFetch = [];
this.inflightSubscribe = [];
this.inflightUnsubscribe = [];
this.pendingFetch = [];

// Whether we think we are subscribed on the server. Synchronously set to
// false on calls to unsubscribe and disconnect. Should never be true when
// this.wantSubscribe is false
this.subscribed = false;
// Whether to re-establish the subscription on reconnect
this.wantSubscribe = false;

// The op that is currently roundtripping to the server, or null.
//
// When the connection reconnects, the inflight op is resubmitted.
//
// This has the same format as an entry in pendingOps
this.inflightOp = null;

// All ops that are waiting for the server to acknowledge this.inflightOp
// This used to just be a single operation, but creates & deletes can't be
// composed with regular operations.
//
// This is a list of {[create:{...}], [del:true], [op:...], callbacks:[...]}
this.pendingOps = [];

// The OT type of this document. An uncreated document has type `null`
this.type = null;

// The applyStack enables us to track any ops submitted while we are
// applying an op incrementally. This value is an array when we are
// performing an incremental apply and null otherwise. When it is an array,
// all submitted ops should be pushed onto it. The `_otApply` method will
// reset it back to null when all incremental apply loops are complete.
this.applyStack = null;

// Disable the default behavior of composing submitted ops. This is read at
// the time of op submit, so it may be toggled on before submitting a
// specifc op and toggled off afterward
this.preventCompose = false;
}
emitter.mixin(Doc);

Doc.prototype.destroy = function(callback) {
var doc = this;
doc.whenNothingPending(function() {
  doc.connection._destroyDoc(doc);
  if (doc.wantSubscribe) {
    return doc.unsubscribe(callback);
  }
  if (callback) callback();
});
};


// ****** Manipulating the document data, version and type.

// Set the document's type, and associated properties. Most of the logic in
// this function exists to update the document based on any added & removed API
// methods.
//
// @param newType OT type provided by the ottypes library or its name or uri
Doc.prototype._setType = function(newType) {
if (typeof newType === 'string') {
  newType = types.map[newType];
}

if (newType) {
  this.type = newType;

} else if (newType === null) {
  this.type = newType;
  // If we removed the type from the object, also remove its data
  this.data = undefined;

} else {
  var err = new ShareDBError(4008, 'Missing type ' + newType);
  return this.emit('error', err);
}
};

// Ingest snapshot data. This data must include a version, snapshot and type.
// This is used both to ingest data that was exported with a webpage and data
// that was received from the server during a fetch.
//
// @param snapshot.v    version
// @param snapshot.data
// @param snapshot.type
// @param callback
Doc.prototype.ingestSnapshot = function(snapshot, callback) {
if (!snapshot) return callback && callback();

if (typeof snapshot.v !== 'number') {
  var err = new ShareDBError(5008, 'Missing version in ingested snapshot. ' + this.collection + '.' + this.id);
  if (callback) return callback(err);
  return this.emit('error', err);
}

// If the doc is already created or there are ops pending, we cannot use the
// ingested snapshot and need ops in order to update the document
if (this.type || this.hasWritePending()) {
  // The version should only be null on a created document when it was
  // created locally without fetching
  if (this.version == null) {
    if (this.hasWritePending()) {
      // If we have pending ops and we get a snapshot for a locally created
      // document, we have to wait for the pending ops to complete, because
      // we don't know what version to fetch ops from. It is possible that
      // the snapshot came from our local op, but it is also possible that
      // the doc was created remotely (which would conflict and be an error)
      return callback && this.once('no write pending', callback);
    }
    // Otherwise, we've encounted an error state
    var err = new ShareDBError(5009, 'Cannot ingest snapshot in doc with null version. ' + this.collection + '.' + this.id);
    if (callback) return callback(err);
    return this.emit('error', err);
  }
  // If we got a snapshot for a version further along than the document is
  // currently, issue a fetch to get the latest ops and catch us up
  if (snapshot.v > this.version) return this.fetch(callback);
  return callback && callback();
}

// Ignore the snapshot if we are already at a newer version. Under no
// circumstance should we ever set the current version backward
if (this.version > snapshot.v) return callback && callback();

this.version = snapshot.v;
var type = (snapshot.type === undefined) ? types.defaultType : snapshot.type;
this._setType(type);
this.data = (this.type && this.type.deserialize) ?
  this.type.deserialize(snapshot.data) :
  snapshot.data;
this.emit('load');
callback && callback();
};

Doc.prototype.whenNothingPending = function(callback) {
if (this.hasPending()) {
  this.once('nothing pending', callback);
  return;
}
callback();
};

Doc.prototype.hasPending = function() {
return !!(
  this.inflightOp ||
  this.pendingOps.length ||
  this.inflightFetch.length ||
  this.inflightSubscribe.length ||
  this.inflightUnsubscribe.length ||
  this.pendingFetch.length
);
};

Doc.prototype.hasWritePending = function() {
return !!(this.inflightOp || this.pendingOps.length);
};

Doc.prototype._emitNothingPending = function() {
if (this.hasWritePending()) return;
this.emit('no write pending');
if (this.hasPending()) return;
this.emit('nothing pending');
};

// **** Helpers for network messages

Doc.prototype._emitResponseError = function(err, callback) {
if (callback) {
  callback(err);
  this._emitNothingPending();
  return;
}
this._emitNothingPending();
this.emit('error', err);
};

Doc.prototype._handleFetch = function(err, snapshot) {
var callback = this.inflightFetch.shift();
if (err) return this._emitResponseError(err, callback);
this.ingestSnapshot(snapshot, callback);
this._emitNothingPending();
};

Doc.prototype._handleSubscribe = function(err, snapshot) {
var callback = this.inflightSubscribe.shift();
if (err) return this._emitResponseError(err, callback);
// Indicate we are subscribed only if the client still wants to be. In the
// time since calling subscribe and receiving a response from the server,
// unsubscribe could have been called and we might already be unsubscribed
// but not have received the response. Also, because requests from the
// client are not serialized and may take different async time to process,
// it is possible that we could hear responses back in a different order
// from the order originally sent
if (this.wantSubscribe) this.subscribed = true;
this.ingestSnapshot(snapshot, callback);
this._emitNothingPending();
};

Doc.prototype._handleUnsubscribe = function(err) {
var callback = this.inflightUnsubscribe.shift();
if (err) return this._emitResponseError(err, callback);
if (callback) callback();
this._emitNothingPending();
};

Doc.prototype._handleOp = function(err, message) {
if (err) {
  if (this.inflightOp) {
    // The server has rejected submission of the current operation. If we get
    // an error code 4002 "Op submit rejected", this was done intentionally
    // and we should roll back but not return an error to the user.
    if (err.code === 4002) err = null;
    return this._rollback(err);
  }
  return this.emit('error', err);
}

if (this.inflightOp &&
    message.src === this.inflightOp.src &&
    message.seq === this.inflightOp.seq) {
  // The op has already been applied locally. Just update the version
  // and pending state appropriately
  this._opAcknowledged(message);
  return;
}

if (this.version == null || message.v > this.version) {
  // This will happen in normal operation if we become subscribed to a
  // new document via a query. It can also happen if we get an op for
  // a future version beyond the version we are expecting next. This
  // could happen if the server doesn't publish an op for whatever reason
  // or because of a race condition. In any case, we can send a fetch
  // command to catch back up.
  //
  // Fetch only sends a new fetch command if no fetches are inflight, which
  // will act as a natural debouncing so we don't send multiple fetch
  // requests for many ops received at once.
  this.fetch();
  return;
}

if (message.v < this.version) {
  // We can safely ignore the old (duplicate) operation.
  return;
}

if (this.inflightOp) {
  var transformErr = transformX(this.inflightOp, message);
  if (transformErr) return this._hardRollback(transformErr);
}

for (var i = 0; i < this.pendingOps.length; i++) {
  var transformErr = transformX(this.pendingOps[i], message);
  if (transformErr) return this._hardRollback(transformErr);
}

this.version++;
this._otApply(message, false);
return;
};

// Called whenever (you guessed it!) the connection state changes. This will
// happen when we get disconnected & reconnect.
Doc.prototype._onConnectionStateChanged = function() {
if (this.connection.canSend) {
  this.flush();
  this._resubscribe();
} else {
  if (this.inflightOp) {
    this.pendingOps.unshift(this.inflightOp);
    this.inflightOp = null;
  }
  this.subscribed = false;
  if (this.inflightFetch.length || this.inflightSubscribe.length) {
    this.pendingFetch = this.pendingFetch.concat(this.inflightFetch, this.inflightSubscribe);
    this.inflightFetch.length = 0;
    this.inflightSubscribe.length = 0;
  }
  if (this.inflightUnsubscribe.length) {
    var callbacks = this.inflightUnsubscribe;
    this.inflightUnsubscribe = [];
    callEach(callbacks);
  }
}
};

Doc.prototype._resubscribe = function() {
var callbacks = this.pendingFetch;
this.pendingFetch = [];

if (this.wantSubscribe) {
  if (callbacks.length) {
    this.subscribe(function(err) {
      callEach(callbacks, err);
    });
    return;
  }
  this.subscribe();
  return;
}

if (callbacks.length) {
  this.fetch(function(err) {
    callEach(callbacks, err);
  });
}
};

// Request the current document snapshot or ops that bring us up to date
Doc.prototype.fetch = function(callback) {
if (this.connection.canSend) {
  var isDuplicate = this.connection.sendFetch(this);
  pushActionCallback(this.inflightFetch, isDuplicate, callback);
  return;
}
this.pendingFetch.push(callback);
};

// Fetch the initial document and keep receiving updates
Doc.prototype.subscribe = function(callback) {
this.wantSubscribe = true;
if (this.connection.canSend) {
  var isDuplicate = this.connection.sendSubscribe(this);
  pushActionCallback(this.inflightSubscribe, isDuplicate, callback);
  return;
}
this.pendingFetch.push(callback);
};

// Unsubscribe. The data will stay around in local memory, but we'll stop
// receiving updates
Doc.prototype.unsubscribe = function(callback) {
this.wantSubscribe = false;
// The subscribed state should be conservative in indicating when we are
// subscribed on the server. We'll actually be unsubscribed some time
// between sending the message and hearing back, but we cannot know exactly
// when. Thus, immediately mark us as not subscribed
this.subscribed = false;
if (this.connection.canSend) {
  var isDuplicate = this.connection.sendUnsubscribe(this);
  pushActionCallback(this.inflightUnsubscribe, isDuplicate, callback);
  return;
}
if (callback) process.nextTick(callback);
};

function pushActionCallback(inflight, isDuplicate, callback) {
if (isDuplicate) {
  var lastCallback = inflight.pop();
  inflight.push(function(err) {
    lastCallback && lastCallback(err);
    callback && callback(err);
  });
} else {
  inflight.push(callback);
}
}


// Operations //

// Send the next pending op to the server, if we can.
//
// Only one operation can be in-flight at a time. If an operation is already on
// its way, or we're not currently connected, this method does nothing.
Doc.prototype.flush = function() {
// Ignore if we can't send or we are already sending an op
if (!this.connection.canSend || this.inflightOp) return;

// Send first pending op unless paused
if (!this.paused && this.pendingOps.length) {
  this._sendOp();
}
};

// Helper function to set op to contain a no-op.
function setNoOp(op) {
delete op.op;
delete op.create;
delete op.del;
}

// Transform server op data by a client op, and vice versa. Ops are edited in place.
function transformX(client, server) {
// Order of statements in this function matters. Be especially careful if
// refactoring this function

// A client delete op should dominate if both the server and the client
// delete the document. Thus, any ops following the client delete (such as a
// subsequent create) will be maintained, since the server op is transformed
// to a no-op
if (client.del) return setNoOp(server);

if (server.del) {
  return new ShareDBError(4017, 'Document was deleted');
}
if (server.create) {
  return new ShareDBError(4018, 'Document alredy created');
}

// Ignore no-op coming from server
if (!server.op) return;

// I believe that this should not occur, but check just in case
if (client.create) {
  return new ShareDBError(4018, 'Document already created');
}

// They both edited the document. This is the normal case for this function -
// as in, most of the time we'll end up down here.
//
// You should be wondering why I'm using client.type instead of this.type.
// The reason is, if we get ops at an old version of the document, this.type
// might be undefined or a totally different type. By pinning the type to the
// op data, we make sure the right type has its transform function called.
if (client.type.transformX) {
  var result = client.type.transformX(client.op, server.op);
  client.op = result[0];
  server.op = result[1];
} else {
  var clientOp = client.type.transform(client.op, server.op, 'left');
  var serverOp = client.type.transform(server.op, client.op, 'right');
  client.op = clientOp;
  server.op = serverOp;
}
};

/**
* Applies the operation to the snapshot
*
* If the operation is create or delete it emits `create` or `del`. Then the
* operation is applied to the snapshot and `op` and `after op` are emitted.
* If the type supports incremental updates and `this.incremental` is true we
* fire `op` after every small operation.
*
* This is the only function to fire the above mentioned events.
*
* @private
*/
Doc.prototype._otApply = function(op, source) {
if (op.op) {
  if (!this.type) {
    var err = new ShareDBError(4015, 'Cannot apply op to uncreated document. ' + this.collection + '.' + this.id);
    return this.emit('error', err);
  }

  // Iteratively apply multi-component remote operations and rollback ops
  // (source === false) for the default JSON0 OT type. It could use
  // type.shatter(), but since this code is so specific to use cases for the
  // JSON0 type and ShareDB explicitly bundles the default type, we might as
  // well write it this way and save needing to iterate through the op
  // components twice.
  //
  // Ideally, we would not need this extra complexity. However, it is
  // helpful for implementing bindings that update DOM nodes and other
  // stateful objects by translating op events directly into corresponding
  // mutations. Such bindings are most easily written as responding to
  // individual op components one at a time in order, and it is important
  // that the snapshot only include updates from the particular op component
  // at the time of emission. Eliminating this would require rethinking how
  // such external bindings are implemented.
  if (!source && this.type === types.defaultType && op.op.length > 1) {
    if (!this.applyStack) this.applyStack = [];
    var stackLength = this.applyStack.length;
    for (var i = 0; i < op.op.length; i++) {
      var component = op.op[i];
      var componentOp = {op: [component]};
      // Transform componentOp against any ops that have been submitted
      // sychronously inside of an op event handler since we began apply of
      // our operation
      for (var j = stackLength; j < this.applyStack.length; j++) {
        var transformErr = transformX(this.applyStack[j], componentOp);
        if (transformErr) return this._hardRollback(transformErr);
      }
      // Apply the individual op component
      this.emit('before op', componentOp.op, source);
      this.data = this.type.apply(this.data, componentOp.op);
      this.emit('op', componentOp.op, source);
    }
    // Pop whatever was submitted since we started applying this op
    this._popApplyStack(stackLength);
    return;
  }

  // The 'before op' event enables clients to pull any necessary data out of
  // the snapshot before it gets changed
  this.emit('before op', op.op, source);
  // Apply the operation to the local data, mutating it in place
  this.data = this.type.apply(this.data, op.op);
  // Emit an 'op' event once the local data includes the changes from the
  // op. For locally submitted ops, this will be synchronously with
  // submission and before the server or other clients have received the op.
  // For ops from other clients, this will be after the op has been
  // committed to the database and published
  this.emit('op', op.op, source);
  return;
}

if (op.create) {
  this._setType(op.create.type);
  this.data = (this.type.deserialize) ?
    (this.type.createDeserialized) ?
      this.type.createDeserialized(op.create.data) :
      this.type.deserialize(this.type.create(op.create.data)) :
    this.type.create(op.create.data);
  this.emit('create', source);
  return;
}

if (op.del) {
  var oldData = this.data;
  this._setType(null);
  this.emit('del', oldData, source);
  return;
}
};


// ***** Sending operations

// Actually send op to the server.
Doc.prototype._sendOp = function() {
// Wait until we have a src id from the server
var src = this.connection.id;
if (!src) return;

// When there is no inflightOp, send the first item in pendingOps. If
// there is inflightOp, try sending it again
if (!this.inflightOp) {
  // Send first pending op
  this.inflightOp = this.pendingOps.shift();
}
var op = this.inflightOp;
if (!op) {
  var err = new ShareDBError(5010, 'No op to send on call to _sendOp');
  return this.emit('error', err);
}

// Track data for retrying ops
op.sentAt = Date.now();
op.retries = (op.retries == null) ? 0 : op.retries + 1;

// The src + seq number is a unique ID representing this operation. This tuple
// is used on the server to detect when ops have been sent multiple times and
// on the client to match acknowledgement of an op back to the inflightOp.
// Note that the src could be different from this.connection.id after a
// reconnect, since an op may still be pending after the reconnection and
// this.connection.id will change. In case an op is sent multiple times, we
// also need to be careful not to override the original seq value.
if (op.seq == null) op.seq = this.connection.seq++;

this.connection.sendOp(this, op);

// src isn't needed on the first try, since the server session will have the
// same id, but it must be set on the inflightOp in case it is sent again
// after a reconnect and the connection's id has changed by then
if (op.src == null) op.src = src;
};


// Queues the operation for submission to the server and applies it locally.
//
// Internal method called to do the actual work for submit(), create() and del().
// @private
//
// @param op
// @param [op.op]
// @param [op.del]
// @param [op.create]
// @param [callback] called when operation is submitted
Doc.prototype._submit = function(op, source, callback) {
// Locally submitted ops must always have a truthy source
if (!source) source = true;

// The op contains either op, create, delete, or none of the above (a no-op).
if (op.op) {
  if (!this.type) {
    var err = new ShareDBError(4015, 'Cannot submit op. Document has not been created. ' + this.collection + '.' + this.id);
    if (callback) return callback(err);
    return this.emit('error', err);
  }
  // Try to normalize the op. This removes trailing skip:0's and things like that.
  if (this.type.normalize) op.op = this.type.normalize(op.op);
}

this._pushOp(op, callback);
this._otApply(op, source);

// The call to flush is delayed so if submit() is called multiple times
// synchronously, all the ops are combined before being sent to the server.
var doc = this;
process.nextTick(function() {
  doc.flush();
});
};

Doc.prototype._pushOp = function(op, callback) {
if (this.applyStack) {
  // If we are in the process of incrementally applying an operation, don't
  // compose the op and push it onto the applyStack so it can be transformed
  // against other components from the op or ops being applied
  this.applyStack.push(op);
} else {
  // If the type supports composes, try to compose the operation onto the
  // end of the last pending operation.
  var composed = this._tryCompose(op);
  if (composed) {
    composed.callbacks.push(callback);
    return;
  }
}
// Push on to the pendingOps queue of ops to submit if we didn't compose
op.type = this.type;
op.callbacks = [callback];
this.pendingOps.push(op);
};

Doc.prototype._popApplyStack = function(to) {
if (to > 0) {
  this.applyStack.length = to;
  return;
}
// Once we have completed the outermost apply loop, reset to null and no
// longer add ops to the applyStack as they are submitted
var op = this.applyStack[0];
this.applyStack = null;
if (!op) return;
// Compose the ops added since the beginning of the apply stack, since we
// had to skip compose when they were originally pushed
var i = this.pendingOps.indexOf(op);
if (i === -1) return;
var ops = this.pendingOps.splice(i);
for (var i = 0; i < ops.length; i++) {
  var op = ops[i];
  var composed = this._tryCompose(op);
  if (composed) {
    composed.callbacks = composed.callbacks.concat(op.callbacks);
  } else {
    this.pendingOps.push(op);
  }
}
};

// Try to compose a submitted op into the last pending op. Returns the
// composed op if it succeeds, undefined otherwise
Doc.prototype._tryCompose = function(op) {
if (this.preventCompose) return;

// We can only compose into the last pending op. Inflight ops have already
// been sent to the server, so we can't modify them
var last = this.pendingOps[this.pendingOps.length - 1];
if (!last) return;

// Compose an op into a create by applying it. This effectively makes the op
// invisible, as if the document were created including the op originally
if (last.create && op.op) {
  last.create.data = this.type.apply(last.create.data, op.op);
  return last;
}

// Compose two ops into a single op if supported by the type. Types that
// support compose must be able to compose any two ops together
if (last.op && op.op && this.type.compose) {
  last.op = this.type.compose(last.op, op.op);
  return last;
}
};

// *** Client OT entrypoints.

// Submit an operation to the document.
//
// @param operation handled by the OT type
// @param options  {source: ...}
// @param [callback] called after operation submitted
//
// @fires before op, op, after op
Doc.prototype.submitOp = function(component, options, callback) {
if (typeof options === 'function') {
  callback = options;
  options = null;
}
var op = {op: component};
var source = options && options.source;
this._submit(op, source, callback);
};

// Create the document, which in ShareJS semantics means to set its type. Every
// object implicitly exists in the database but has no data and no type. Create
// sets the type of the object and can optionally set some initial data on the
// object, depending on the type.
//
// @param data  initial
// @param type  OT type
// @param options  {source: ...}
// @param callback  called when operation submitted
Doc.prototype.create = function(data, type, options, callback) {
if (typeof type === 'function') {
  callback = type;
  options = null;
  type = null;
} else if (typeof options === 'function') {
  callback = options;
  options = null;
}
if (!type) {
  type = types.defaultType.uri;
}
if (this.type) {
  var err = new ShareDBError(4016, 'Document already exists');
  if (callback) return callback(err);
  return this.emit('error', err);
}
var op = {create: {type: type, data: data}};
var source = options && options.source;
this._submit(op, source, callback);
};

// Delete the document. This creates and submits a delete operation to the
// server. Deleting resets the object's type to null and deletes its data. The
// document still exists, and still has the version it used to have before you
// deleted it (well, old version +1).
//
// @param options  {source: ...}
// @param callback  called when operation submitted
Doc.prototype.del = function(options, callback) {
if (typeof options === 'function') {
  callback = options;
  options = null;
}
if (!this.type) {
  var err = new ShareDBError(4015, 'Document does not exist');
  if (callback) return callback(err);
  return this.emit('error', err);
}
var op = {del: true};
var source = options && options.source;
this._submit(op, source, callback);
};


// Stops the document from sending any operations to the server.
Doc.prototype.pause = function() {
this.paused = true;
};

// Continue sending operations to the server
Doc.prototype.resume = function() {
this.paused = false;
this.flush();
};


// *** Receiving operations

// This is called when the server acknowledges an operation from the client.
Doc.prototype._opAcknowledged = function(message) {
if (this.inflightOp.create) {
  this.version = message.v;

} else if (message.v !== this.version) {
  // We should already be at the same version, because the server should
  // have sent all the ops that have happened before acknowledging our op
  console.warn('Invalid version from server. Expected: ' + this.version + ' Received: ' + message.v, message);

  // Fetching should get us back to a working document state
  return this.fetch();
}

// The op was committed successfully. Increment the version number
this.version++;

this._clearInflightOp();
};

Doc.prototype._rollback = function(err) {
// The server has rejected submission of the current operation. Invert by
// just the inflight op if possible. If not possible to invert, cancel all
// pending ops and fetch the latest from the server to get us back into a
// working state, then call back
var op = this.inflightOp;

if (op.op && op.type.invert) {
  op.op = op.type.invert(op.op);

  // Transform the undo operation by any pending ops.
  for (var i = 0; i < this.pendingOps.length; i++) {
    var transformErr = transformX(this.pendingOps[i], op);
    if (transformErr) return this._hardRollback(transformErr);
  }

  // ... and apply it locally, reverting the changes.
  //
  // This operation is applied to look like it comes from a remote source.
  // I'm still not 100% sure about this functionality, because its really a
  // local op. Basically, the problem is that if the client's op is rejected
  // by the server, the editor window should update to reflect the undo.
  this._otApply(op, false);

  this._clearInflightOp(err);
  return;
}

this._hardRollback(err);
};

Doc.prototype._hardRollback = function(err) {
// Cancel all pending ops and reset if we can't invert
var op = this.inflightOp;
var pending = this.pendingOps;
this._setType(null);
this.version = null;
this.inflightOp = null;
this.pendingOps = [];

// Fetch the latest from the server to get us back into a working state
var doc = this;
this.fetch(function() {
  var called = op && callEach(op.callbacks, err);
  for (var i = 0; i < pending.length; i++) {
    callEach(pending[i].callbacks, err);
  }
  if (err && !called) return doc.emit('error', err);
});
};

Doc.prototype._clearInflightOp = function(err) {
var called = callEach(this.inflightOp.callbacks, err);

this.inflightOp = null;
this.flush();
this._emitNothingPending();

if (err && !called) return this.emit('error', err);
};

function callEach(callbacks, err) {
var called = false;
for (var i = 0; i < callbacks.length; i++) {
  var callback = callbacks[i];
  if (callback) {
    callback(err);
    called = true;
  }
}
return called;
}

}).call(this,require('_process'))
},{"../emitter":16,"../error":17,"../types":18,"_process":11}],14:[function(require,module,exports){
exports.Connection = require('./connection');
exports.Doc = require('./doc');
exports.Error = require('../error');
exports.Query = require('./query');
exports.types = require('../types');

},{"../error":17,"../types":18,"./connection":12,"./doc":13,"./query":15}],15:[function(require,module,exports){
(function (process){
var emitter = require('../emitter');

// Queries are live requests to the database for particular sets of fields.
//
// The server actively tells the client when there's new data that matches
// a set of conditions.
module.exports = Query;
function Query(action, connection, id, collection, query, options, callback) {
emitter.EventEmitter.call(this);

// 'qf' or 'qs'
this.action = action;

this.connection = connection;
this.id = id;
this.collection = collection;

// The query itself. For mongo, this should look something like {"data.x":5}
this.query = query;

// A list of resulting documents. These are actual documents, complete with
// data and all the rest. It is possible to pass in an initial results set,
// so that a query can be serialized and then re-established
this.results = null;
if (options && options.results) {
  this.results = options.results;
  delete options.results;
}
this.extra = undefined;

// Options to pass through with the query
this.options = options;

this.callback = callback;
this.ready = false;
this.sent = false;
}
emitter.mixin(Query);

Query.prototype.hasPending = function() {
return !this.ready;
};

// Helper for subscribe & fetch, since they share the same message format.
//
// This function actually issues the query.
Query.prototype.send = function() {
if (!this.connection.canSend) return;

var message = {
  a: this.action,
  id: this.id,
  c: this.collection,
  q: this.query
};
if (this.options) {
  message.o = this.options;
}
if (this.results) {
  // Collect the version of all the documents in the current result set so we
  // don't need to be sent their snapshots again.
  var results = [];
  for (var i = 0; i < this.results.length; i++) {
    var doc = this.results[i];
    results.push([doc.id, doc.version]);
  }
  message.r = results;
}

this.connection.send(message);
this.sent = true;
};

// Destroy the query object. Any subsequent messages for the query will be
// ignored by the connection.
Query.prototype.destroy = function(callback) {
if (this.connection.canSend && this.action === 'qs') {
  this.connection.send({a: 'qu', id: this.id});
}
this.connection._destroyQuery(this);
// There is a callback for consistency, but we don't actually wait for the
// server's unsubscribe message currently
if (callback) process.nextTick(callback);
};

Query.prototype._onConnectionStateChanged = function() {
if (this.connection.canSend && !this.sent) {
  this.send();
} else {
  this.sent = false;
}
};

Query.prototype._handleFetch = function(err, data, extra) {
// Once a fetch query gets its data, it is destroyed.
this.connection._destroyQuery(this);
this._handleResponse(err, data, extra);
};

Query.prototype._handleSubscribe = function(err, data, extra) {
this._handleResponse(err, data, extra);
};

Query.prototype._handleResponse = function(err, data, extra) {
var callback = this.callback;
this.callback = null;
if (err) return this._finishResponse(err, callback);
if (!data) return this._finishResponse(null, callback);

var query = this;
var wait = 1;
var finish = function(err) {
  if (err) return query._finishResponse(err, callback);
  if (--wait) return;
  query._finishResponse(null, callback);
};

if (Array.isArray(data)) {
  wait += data.length;
  this.results = this._ingestSnapshots(data, finish);
  this.extra = extra;

} else {
  for (var id in data) {
    wait++;
    var snapshot = data[id];
    var doc = this.connection.get(snapshot.c || this.collection, id);
    doc.ingestSnapshot(snapshot, finish);
  }
}

finish();
};

Query.prototype._ingestSnapshots = function(snapshots, finish) {
var results = [];
for (var i = 0; i < snapshots.length; i++) {
  var snapshot = snapshots[i];
  var doc = this.connection.get(snapshot.c || this.collection, snapshot.d);
  doc.ingestSnapshot(snapshot, finish);
  results.push(doc);
}
return results;
};

Query.prototype._finishResponse = function(err, callback) {
this.emit('ready');
this.ready = true;
if (err) {
  this.connection._destroyQuery(this);
  if (callback) return callback(err);
  return this.emit('error', err);
}
if (callback) callback(null, this.results, this.extra);
};

Query.prototype._handleError = function(err) {
this.emit('error', err);
};

Query.prototype._handleDiff = function(diff) {
// We need to go through the list twice. First, we'll ingest all the new
// documents. After that we'll emit events and actually update our list.
// This avoids race conditions around setting documents to be subscribed &
// unsubscribing documents in event callbacks.
for (var i = 0; i < diff.length; i++) {
  var d = diff[i];
  if (d.type === 'insert') d.values = this._ingestSnapshots(d.values);
}

for (var i = 0; i < diff.length; i++) {
  var d = diff[i];
  switch (d.type) {
    case 'insert':
      var newDocs = d.values;
      Array.prototype.splice.apply(this.results, [d.index, 0].concat(newDocs));
      this.emit('insert', newDocs, d.index);
      break;
    case 'remove':
      var howMany = d.howMany || 1;
      var removed = this.results.splice(d.index, howMany);
      this.emit('remove', removed, d.index);
      break;
    case 'move':
      var howMany = d.howMany || 1;
      var docs = this.results.splice(d.from, howMany);
      Array.prototype.splice.apply(this.results, [d.to, 0].concat(docs));
      this.emit('move', docs, d.from, d.to);
      break;
  }
}

this.emit('changed', this.results);
};

Query.prototype._handleExtra = function(extra) {
this.extra = extra;
this.emit('extra', extra);
};

}).call(this,require('_process'))
},{"../emitter":16,"_process":11}],16:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;

exports.EventEmitter = EventEmitter;
exports.mixin = mixin;

function mixin(Constructor) {
for (var key in EventEmitter.prototype) {
  Constructor.prototype[key] = EventEmitter.prototype[key];
}
}

},{"events":2}],17:[function(require,module,exports){
var makeError = require('make-error');

function ShareDBError(code, message) {
ShareDBError.super.call(this, message);
this.code = code;
}

makeError(ShareDBError);

module.exports = ShareDBError;

},{"make-error":3}],18:[function(require,module,exports){

exports.defaultType = require('ot-json0').type;

exports.map = {};

exports.register = function(type) {
if (type.name) exports.map[type.name] = type;
if (type.uri) exports.map[type.uri] = type;
};

exports.register(exports.defaultType);

},{"ot-json0":5}],19:[function(require,module,exports){

exports.doNothing = doNothing;
function doNothing() {}

exports.hasKeys = function(object) {
for (var key in object) return true;
return false;
};

},{}]},{},[1]);


/* editor/realtime.js */
editor.once('load', function() {
  'use strict';

  editor.once('start', function() {
      var auth = false;

      var socket, connection;
      var scene = null;
      var data;
      var reconnectAttempts = 0;
      var reconnectInterval = 3;

      editor.method('realtime:connection', function () {
          return connection;
      });

      var connect = function () {
          if (reconnectAttempts > 4) {
              editor.emit('realtime:cannotConnect');
              return;
          }

          reconnectAttempts++;
          editor.emit('realtime:connecting', reconnectAttempts);

          var shareDbMessage = connection.socket.onmessage;

          connection.socket.onmessage = function(msg) {
              try {
                  if (msg.data.startsWith('auth')) {
                      if (!auth) {
                          auth = true;
                          data = JSON.parse(msg.data.slice(4));

                          editor.emit('realtime:authenticated');

                          // load scene
                          if (! scene && config.scene.uniqueId) {
                              editor.call('realtime:loadScene', config.scene.uniqueId);
                          }
                      }
                  } else if (msg.data.startsWith('whoisonline:')) {
                      var parts = msg.data.split(':');
                      if (parts.length === 5 && parts[1] === 'scene') {
                          var data;
                          var op = parts[3];
                          if (op === 'set') {
                              data = JSON.parse(parts[4]);
                          } else if (op === 'add' || op === 'remove') {
                              data = parseInt(parts[4], 10);
                          }
                          editor.call('whoisonline:' + op, data);
                      }
                  } else if (msg.data.startsWith('chat:')) {
                      data = msg.data.slice('chat:'.length);

                      var ind = data.indexOf(':');
                      if (ind !== -1) {
                          var op = data.slice(0, ind);
                          data = JSON.parse(data.slice(ind + 1));

                          if (op === 'typing') {
                              editor.call('chat:sync:typing', data);
                          } else if (op === 'msg') {
                              editor.call('chat:sync:msg', data);
                          }
                      }
                  } else if (msg.data.startsWith('selection')) {
                      var data = msg.data.slice('selection:'.length);
                      editor.emit('selector:sync:raw', data);
                  } else if (msg.data.startsWith('fs:')) {
                      data = msg.data.slice('fs:'.length);
                      var ind = data.indexOf(':');
                      if (ind !== -1) {
                          var op = data.slice(0, ind);
                          if (op === 'paths') {
                              data = JSON.parse(data.slice(ind + 1));
                              editor.call('assets:fs:paths:patch', data);
                          }
                      } else {
                          shareDbMessage(msg);
                      }
                  } else {
                      shareDbMessage(msg);
                  }
              } catch (e) {
                  console.error(e);
              }

          };

          connection.on('connected', function() {
              reconnectAttempts = 0;
              reconnectInterval = 3;

              this.socket.send('auth' + JSON.stringify({
                  accessToken: config.accessToken
              }));

              editor.emit('realtime:connected');
          });

          connection.on('error', function(msg) {
              if (connection.state === 'connected')
                  return;
              editor.emit('realtime:error', msg);
          });

          connection.on('bs error', function (msg) {
              editor.call('status:error', msg);
          });

          var onConnectionClosed = connection.socket.onclose;
          connection.socket.onclose = function (reason) {
              auth = false;

              if (scene) {
                  scene.unsubscribe();
                  scene.destroy();
                  scene = null;
              }

              editor.emit('realtime:disconnected', reason);
              onConnectionClosed(reason);

              // try to reconnect after a while
              editor.emit('realtime:nextAttempt', reconnectInterval);

              if (editor.call('visibility')) {
                  setTimeout(reconnect, reconnectInterval * 1000);
              } else {
                  editor.once('visible', reconnect);
              }

              reconnectInterval++;
          };
      };

      var reconnect = function () {
          // create new socket...
          socket = new WebSocket(config.url.realtime.http);
          // ... and new sharedb connection
          connection = new window.share.Connection(socket);
          // connect again
          connect();
      };

      if (editor.call('visibility')) {
          reconnect();
      } else {
          editor.once('visible', reconnect);
      }

      var emitOp = function(type, op) {
          // console.log('in: [ ' + Object.keys(op).filter(function(i) { return i !== 'p' }).join(', ') + ' ]', op.p.join('.'));
          // console.log(op);

          if (op.p[0])
              editor.emit('realtime:' + type + ':op:' + op.p[0], op);
      };

      editor.method('realtime:loadScene', function (uniqueId) {
          scene = connection.get('scenes', '' + uniqueId);

          // error
          scene.on('error', function(err) {
              editor.emit('realtime:scene:error', err);
          });

          // ready to sync
          scene.on('load', function () {
              // notify of operations
              scene.on('op', function (ops, local) {
                  if (local) return;

                  for (var i = 0; i < ops.length; i++)
                      emitOp('scene', ops[i]);
              });

              // notify of scene load
              editor.emit('scene:load', scene.data.item_id, uniqueId);
              editor.emit('scene:raw', scene.data);
          });

          // subscribe for realtime events
          scene.subscribe();
      });

      // write scene operations
      editor.method('realtime:scene:op', function(op) {
          if (! editor.call('permissions:write') || ! scene)
              return;

          // console.trace();
          // console.log('out: [ ' + Object.keys(op).filter(function(i) { return i !== 'p' }).join(', ') + ' ]', op.p.join('.'));
          // console.log(op)

          try {
              scene.submitOp([ op ]);
          } catch (e) {
              console.error(e);
              editor.emit('realtime:scene:error', e);
          }
      });

      editor.method('realtime:send', function(name, data) {
          // console.log(name, data);
          if (socket.readyState === 1)
              socket.send(name + JSON.stringify(data));
      });

      editor.on('realtime:disconnected', function () {
          editor.emit('permissions:writeState', false);
      });

      editor.on('realtime:connected', function () {
          editor.emit('permissions:writeState', editor.call('permissions:write'));
      });

      editor.on('scene:unload', function (id, uniqueId) {
          if (scene) {
              scene.unsubscribe();
              scene.destroy();
              scene = null;

              connection.socket.send('close:scene:' + uniqueId);
          }
      });
  });
});


/* editor/users/users.js */
editor.once('load', function() {
  'use strict';

  var users = { };
  var userRequests = { };

  // Loads a user from the server
  editor.method('users:loadOne', function (id, callback) {
      if (users[id])
          return callback(users[id]);

      if (userRequests[id])
          return userRequests[id].push(callback);

      userRequests[id] = [ callback ];

      Ajax({
          url: '{{url.api}}/users/' + id,
          auth: true
      })
      .on('load', function (status, data) {
          users[id] = data;

          for(var i = 0; i < userRequests[id].length; i++)
              userRequests[id][i](data);

          delete userRequests[id];
      });
  });

  editor.method('users:get', function(id) {
      return users[id] || null;
  });
});


/* editor/users/users-usage.js */
editor.once('load', function () {
  'use strict';

  editor.on('messenger:user.usage', function (data) {
      if (data.user !== config.owner.id) return;

      config.owner.size += data.usage.total;

      editor.emit('user:' + config.owner.id + ':usage', config.owner.size);
  });
});


/* editor/users/users-flags.js */
editor.once("load", function () {
  'use strict';

  editor.method('users:hasOpenedEditor', function () {
      return (config.self && config.self.flags.openedEditor);
  });

  editor.method('users:isSuperUser', function () {
      return (config.self && config.self.flags.superUser);
  });

  editor.method('users:hasFlag', function (flag) {
      return (config.self && config.self.flags[flag] || config.self.flags.superUser);
  });
});


/* editor/project/project.js */
editor.once('load', function() {
  'use strict';

  // Saves specified data to server
  editor.method('project:save', function (data, success, error) {
      Ajax({
          url: '{{url.api}}/projects/{{project.id}}',
          auth: true,
          method: 'PUT',
          data: data
      })
      .on('load', function () {
          if (success)
              success();
      })
      .on('error', function () {
          if (error)
              error();
      });
  });

  editor.method('project:setPrimaryApp', function (appId, success, error) {
      var prevPrimary = config.project.primaryApp;
      config.project.primaryApp = parseInt(appId, 10);
      editor.call('project:save', {
          primary_app: config.project.primaryApp
      }, success, function (err) {
          config.project.primaryApp = prevPrimary;
          error(err);
      });
  });

  editor.on('messenger:project.primary_app', function (data) {
      var primaryApp = parseInt(data.project.primary_app, 10);
      var prev = config.project.primaryApp;

      config.project.primaryApp = primaryApp;

      editor.emit('project:primaryApp', primaryApp, prev);
  });

});
