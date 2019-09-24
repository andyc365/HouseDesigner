


/* editor/pickers/picker.js */
editor.once('load', function () {
  'use strict';

  var openPickers = {};

  // the number of open pickers that block the main Editor
  var editorBlockingPickers = 0;

  // This event is fired by pickers that
  // block the main Editor view
  editor.on('picker:open', function (name) {
      if (openPickers[name]) {
          console.warn('picker:open fired for already open picker ' + name);
          return;
      }

      openPickers[name] = true;
      editorBlockingPickers++;
  });

  editor.on('picker:close', function (name) {
      if (! openPickers[name]) {
          console.warn('picker:close fired for already closed picker ' + name);
          return;
      }

      editorBlockingPickers--;
      if (editorBlockingPickers < 0) {
          editorBlockingPickers = 0;
      }

      delete openPickers[name];
  });

  // If true then a picker that blocks the main Editor is open
  // If the name is specified then only returns true if that picker is open
  editor.method('picker:isOpen', function (name) {
      if (! name) {
          return editorBlockingPickers > 0;
      }

      return openPickers[name];
  });

  // Returns true if any picker is open other than the pickers with the
  // specified names
  editor.method('picker:isOpen:otherThan', function (names) {
      if (typeof names === 'string') {
          names = [names];
      }

      for (var key in openPickers) {
          if (names.indexOf(key) === -1) {
              return true;
          }
      }

      return false;
  });

});


/* editor/pickers/picker-confirm.js */
editor.once('load', function () {
  'use strict';

  var callback = null;

  // overlay
  var overlay = new ui.Overlay();
  overlay.class.add('picker-confirm');
  overlay.hidden = true;

  // label
  var label = new ui.Label();
  label.text = 'Are you sure?';
  label.class.add('text');
  label.renderChanges = false;
  overlay.append(label);

  // no
  var btnNo = new ui.Button();
  btnNo.text = 'No';
  btnNo.class.add('no');
  btnNo.on('click', function () {
      editor.emit('picker:confirm:no');
      overlay.hidden = true;
  });
  overlay.append(btnNo);

  // yes
  var btnYes = new ui.Button();
  btnYes.text = 'Yes';
  btnYes.class.add('yes');
  btnYes.on('click', function () {
      editor.emit('picker:confirm:yes');

      if (callback)
          callback();

      overlay.hidden = true;
  });
  overlay.append(btnYes);

  var root = editor.call('layout.root');
  root.append(overlay);


  // esc > no
  editor.call('hotkey:register', 'picker:confirm:no', {
      key: 'esc',
      callback: function () {
          if (overlay.hidden)
              return;

          // do this in a timeout so that other Esc listeners
          // can query whether the picker is currently open during
          // this Esc press
          requestAnimationFrame(function () {
              btnNo.emit('click');
          });
      }
  });

  window.addEventListener('keydown', function (evt) {
      if (overlay.hidden) return;

      evt.preventDefault();
      evt.stopPropagation();

      // enter > click focused button
      if (evt.keyCode === 13) {
          if (document.activeElement === btnYes.element) {
              if (!btnYes.disabled) {
                  btnYes.emit('click');
              }
          } else if (! btnNo.disabled) {
              btnNo.emit('click');
          }
      }

      // tab - focus yes / no buttons
      else if (evt.keyCode === 9) {
          if (document.activeElement === btnYes.element) {
              btnNo.element.focus();
          } else {
              btnYes.element.focus();
          }
      }
  });

  overlay.on('show', function () {
      editor.emit('picker:confirm:open');
      // editor-blocking picker open
      editor.emit('picker:open', 'confirm');
  });

  // on overlay hide
  overlay.on('hide', function () {
      editor.emit('picker:confirm:close');
      // editor-blocking picker closed
      editor.emit('picker:close', 'confirm');
  });

  // call picker
  editor.method('picker:confirm', function (text, fn, options) {
      label.text = text || 'Are you sure?';
      callback = fn || null;

      if (options && options.yesText) {
          btnYes.text = options.yesText;
      } else {
          btnYes.text = 'Yes';
      }

      if (options && options.noText) {
          btnNo.text = options.noText;
      } else {
          btnNo.text = 'No';
      }

      // show overlay
      overlay.hidden = false;
  });

  // close picker
  editor.method('picker:confirm:close', function () {
      overlay.hidden = true;
  });
});


/* editor/pickers/picker-color.js */
editor.once('load', function() {
  'use strict';

  var size = 144;
  var directInput = true;
  var colorHSV = [ 0, 0, 0 ];
  var channels = [ ];
  var channelsNumber = 4;
  var changing = false;
  var dragging = false;


  // make hex out of channels
  var getHex = function() {
      var hex = '';
      for(var i = 0; i < channelsNumber; i++) {
          hex += ('00' + channels[i].value.toString(16)).slice(-2).toUpperCase();
      }
      return hex;
  };

  // rect drag
  var pickRectMouseMove = function(evt) {
      changing = true;
      var rect = pickRect.getBoundingClientRect();
      var x = Math.max(0, Math.min(size, Math.floor(evt.clientX - rect.left)));
      var y = Math.max(0, Math.min(size, Math.floor(evt.clientY - rect.top)));

      colorHSV[1] = x / size;
      colorHSV[2] = 1.0 - (y / size);

      directInput = false;
      var rgb = hsv2rgb([ colorHSV[0], colorHSV[1], colorHSV[2] ]);
      for(var i = 0; i < 3; i++) {
          channels[i].value = rgb[i];
      }
      fieldHex.value = getHex();
      directInput = true;

      pickRectHandle.style.left = Math.max(4, Math.min(size - 4, x)) + 'px';
      pickRectHandle.style.top = Math.max(4, Math.min(size - 4, y)) + 'px';
      changing = false;
  };

  // rect drag stop
  var pickRectMouseUp = function() {
      window.removeEventListener('mousemove', pickRectMouseMove, false);
      window.removeEventListener('mouseup', pickRectMouseUp, false);
      dragging = false;
      editor.emit('picker:color:end');
  };

  // hue drag
  var pickHueMouseMove = function(evt) {
      changing = true;
      var rect = pickHue.getBoundingClientRect();
      var y = Math.max(0, Math.min(size, Math.floor(evt.clientY - rect.top)));
      var h = y / size;

      var rgb = hsv2rgb([ h, colorHSV[1], colorHSV[2] ]);
      colorHSV[0] = h;

      directInput = false;
      for(var i = 0; i < 3; i++) {
          channels[i].value = rgb[i];
      }
      fieldHex.value = getHex();
      updateRects();
      directInput = true;
      changing = false;
  };

  // hue drag stop
  var pickHueMouseUp = function() {
      window.removeEventListener('mousemove', pickHueMouseMove, false);
      window.removeEventListener('mouseup', pickHueMouseUp, false);
      dragging = false;
      editor.emit('picker:color:end');
  };

  // opacity drag
  var pickOpacityMouseMove = function(evt) {
      changing = true;
      var rect = pickHue.getBoundingClientRect();
      var y = Math.max(0, Math.min(size, Math.floor(evt.clientY - rect.top)));
      var o = 1.0 - y / size;

      directInput = false;
      fieldA.value = Math.max(0, Math.min(255, Math.round(o * 255)));
      fieldHex.value = getHex();
      directInput = true;
      changing = false;
  };

  // opacity drag stop
  var pickOpacityMouseUp = function() {
      window.removeEventListener('mousemove', pickOpacityMouseMove, false);
      window.removeEventListener('mouseup', pickOpacityMouseUp, false);
      dragging = false;
      editor.emit('picker:color:end');
  };


  var updateHex = function() {
      if (! directInput)
          return;

      changing = true;

      var hex = fieldHex.value.trim().toLowerCase();
      if (/^([0-9a-f]{2}){3,4}$/.test(hex)) {
          for(var i = 0; i < channelsNumber; i++) {
              channels[i].value = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
          }
      }

      changing = false;
  };


  // update rgb
  var updateRects = function() {
      var color = channels.map(function(channel) {
          return channel.value || 0;
      }).slice(0, channelsNumber);

      var hsv = rgb2hsv(color);
      if (directInput) {
          var sum = color[0] + color[1] + color[2];
          if (sum !== 765 && sum !== 0)
              colorHSV[0] = hsv[0];

          colorHSV[1] = hsv[1];
          colorHSV[2] = hsv[2];

          dragging = true;
          editor.emit('picker:color:start');
      }

      // hue position
      pickHueHandle.style.top = Math.floor(size * colorHSV[0]) + 'px'; // h

      // rect position
      pickRectHandle.style.left = Math.max(4, Math.min(size - 4, size * colorHSV[1])) + 'px'; // s
      pickRectHandle.style.top = Math.max(4, Math.min(size - 4, size * (1.0 - colorHSV[2]))) + 'px'; // v

      if (channelsNumber >= 3) {
          var plainColor = hsv2rgb([ colorHSV[0], 1, 1 ]).join(',');

          // rect background color
          pickRect.style.backgroundColor = 'rgb(' + plainColor + ')';

          // rect handle color
          pickRectHandle.style.backgroundColor = 'rgb(' + color.slice(0, 3).join(',') + ')';

          // hue handle color
          pickHueHandle.style.backgroundColor = 'rgb(' + plainColor + ')';
      }

      callCallback();
  };

  // update alpha handle
  var updateRectAlpha = function(value) {
      if (channelsNumber !== 4)
          return;

      // position
      pickOpacityHandle.style.top = Math.floor(size * (1.0 - (Math.max(0, Math.min(255, value)) / 255))) + 'px';

      // color
      pickOpacityHandle.style.backgroundColor = 'rgb(' + [ value, value, value ].join(',') + ')';

      callCallback();
  };


  var callingCallaback = false;
  var callbackHandle = function() {
      callingCallaback = false;

      editor.emit('picker:color', channels.map(function(channel) {
          return channel.value || 0;
      }).slice(0, channelsNumber));
  };
  var callCallback = function() {
      if (callingCallaback)
          return;

      callingCallaback = true;
      setTimeout(callbackHandle, 1000 / 60);
  };


  // overlay
  var overlay = new ui.Overlay();
  overlay.class.add('picker-color');
  overlay.center = false;
  overlay.transparent = true;
  overlay.hidden = true;


  // rectangular picker
  var pickRect = document.createElement('div');
  pickRect.classList.add('pick-rect');
  overlay.append(pickRect);

  // rect drag start
  pickRect.addEventListener('mousedown', function(evt) {
      pickRectMouseMove(evt);

      window.addEventListener('mousemove', pickRectMouseMove, false);
      window.addEventListener('mouseup', pickRectMouseUp, false);

      evt.stopPropagation();
      evt.preventDefault();
      dragging = true;
      editor.emit('picker:color:start');
  });

  // white
  var pickRectWhite = document.createElement('div');
  pickRectWhite.classList.add('white');
  pickRect.appendChild(pickRectWhite);

  // black
  var pickRectBlack = document.createElement('div');
  pickRectBlack.classList.add('black');
  pickRect.appendChild(pickRectBlack);

  // handle
  var pickRectHandle = document.createElement('div');
  pickRectHandle.classList.add('handle');
  pickRect.appendChild(pickRectHandle);


  // hue (rainbow) picker
  var pickHue = document.createElement('div');
  pickHue.classList.add('pick-hue');
  overlay.append(pickHue);

  // hue drag start
  pickHue.addEventListener('mousedown', function(evt) {
      pickHueMouseMove(evt);

      window.addEventListener('mousemove', pickHueMouseMove, false);
      window.addEventListener('mouseup', pickHueMouseUp, false);

      evt.stopPropagation();
      evt.preventDefault();
      dragging = true;
      editor.emit('picker:color:start');
  });

  // handle
  var pickHueHandle = document.createElement('div');
  pickHueHandle.classList.add('handle');
  pickHue.appendChild(pickHueHandle);


  // opacity (gradient) picker
  var pickOpacity = document.createElement('div');
  pickOpacity.classList.add('pick-opacity');
  overlay.append(pickOpacity);

  // opacoty drag start
  pickOpacity.addEventListener('mousedown', function(evt) {
      pickOpacityMouseMove(evt);

      window.addEventListener('mousemove', pickOpacityMouseMove, false);
      window.addEventListener('mouseup', pickOpacityMouseUp, false);

      evt.stopPropagation();
      evt.preventDefault();
      dragging = true;
      editor.emit('picker:color:start');
  });

  // handle
  var pickOpacityHandle = document.createElement('div');
  pickOpacityHandle.classList.add('handle');
  pickOpacity.appendChild(pickOpacityHandle);



  // fields
  var panelFields = document.createElement('div');
  panelFields.classList.add('fields');
  overlay.append(panelFields);


  // R
  var fieldR = new ui.NumberField({
      precision: 1,
      step: 1,
      min: 0,
      max: 255
  });
  channels.push(fieldR);
  fieldR.renderChanges = false;
  fieldR.placeholder = 'r';
  fieldR.flexGrow = 1;
  fieldR.class.add('field', 'field-r');
  fieldR.on('change', updateRects);
  panelFields.appendChild(fieldR.element);

  // G
  var fieldG = new ui.NumberField({
      precision: 1,
      step: 1,
      min: 0,
      max: 255
  });
  channels.push(fieldG);
  fieldG.renderChanges = false;
  fieldG.placeholder = 'g';
  fieldG.class.add('field', 'field-g');
  fieldG.on('change', updateRects);
  panelFields.appendChild(fieldG.element);

  // B
  var fieldB = new ui.NumberField({
      precision: 1,
      step: 1,
      min: 0,
      max: 255
  });
  channels.push(fieldB);
  fieldB.renderChanges = false;
  fieldB.placeholder = 'b';
  fieldB.class.add('field', 'field-b');
  fieldB.on('change', updateRects);
  panelFields.appendChild(fieldB.element);


  // A
  var fieldA = new ui.NumberField({
      precision: 1,
      step: 1,
      min: 0,
      max: 255
  });
  channels.push(fieldA);
  fieldA.renderChanges = false;
  fieldA.placeholder = 'a';
  fieldA.class.add('field', 'field-a');
  fieldA.on('change', updateRectAlpha);
  panelFields.appendChild(fieldA.element);


  // HEX
  var fieldHex = new ui.TextField();
  fieldHex.renderChanges = false;
  fieldHex.placeholder = '#';
  fieldHex.class.add('field', 'field-hex');
  fieldHex.on('change', function() {
      updateHex();
  });
  panelFields.appendChild(fieldHex.element);


  var root = editor.call('layout.root');
  root.append(overlay);


  // esc to close
  editor.call('hotkey:register', 'picker:color:close', {
      key: 'esc',
      callback: function() {
          if (overlay.hidden)
              return;

          overlay.hidden = true;
      }
  });


  overlay.on('hide', function() {
      editor.emit('picker:color:close');
  });


  // call picker
  editor.method('picker:color', function(color) {
      // class for channels
      for(var i = 0; i < 4; i++) {
          if (color.length - 1 < i) {
              overlay.class.remove('c-' + (i + 1));
          } else {
              overlay.class.add('c-' + (i + 1));
          }
      }

      // number of channels
      channelsNumber = color.length;

      if (channelsNumber >= 3) {
          var hsv = rgb2hsv(color);
          colorHSV[0] = hsv[0];
          colorHSV[1] = hsv[1];
          colorHSV[2] = hsv[2];
      }

      // set fields
      directInput = false;
      for(var i = 0; i < color.length; i++) {
          channels[i].value = color[i];
      }
      fieldHex.value = getHex();
      directInput = true;

      // show overlay
      overlay.hidden = false;

      // focus on hex field
      fieldHex.elementInput.focus();

      setTimeout(function() {
          fieldHex.elementInput.focus();
          fieldHex.elementInput.select();
      }, 100);
  });

  editor.method('picker:color:close', function() {
      overlay.hidden = true;
  });

  editor.method('picker:color:rect', function() {
      return overlay.rect;
  });

  // position color picker
  editor.method('picker:color:position', function(x, y) {
      overlay.position(x, y);
  });

  // position color picker
  editor.method('picker:color:set', function(color) {
      if (changing || dragging)
          return;

      if (channelsNumber >= 3) {
          var hsv = rgb2hsv(color);
          colorHSV[0] = hsv[0];
          colorHSV[1] = hsv[1];
          colorHSV[2] = hsv[2];
      }

      // set fields
      directInput = false;
      for(var i = 0; i < color.length; i++) {
          channels[i].value = color[i];
      }
      fieldHex.value = getHex();
      directInput = true;
  });
});


/* editor/pickers/picker-asset.js */
editor.once('load', function () {
  'use strict';

  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');

  var overlay = new ui.Overlay();
  overlay.class.add('picker-asset');
  overlay.center = false;
  overlay.hidden = true;

  var root = editor.call('layout.root');
  root.append(overlay);

  // initial select state
  var currentType = '';
  var currentAsset = null;
  var gridSelected = null;
  var allowMultiSelection = false;
  var assetSelection = [];

  var assetsPanelFolded = false;
  var assetsPanelFilter = '';
  var assetsPanelSearch = '';
  var assetsPanelFolder = null;
  // elements
  var assetsGrid = editor.call('assets:grid');
  var assetsPanel = editor.call('layout.assets');

  var pluralize = function (word) {
      return word + ' assets';
  };

  // empty filter messages
  var getNoResultsMessage = function (type, filter) {
      var result;

      if (legacyScripts && type === 'script') {
          result = 'There are no scripts. Click on the <span class="font-icon" style="font-size: 18px">&#57632;</span> button to add one';
      } else if (type === 'material' || type === 'cubemap' || type === 'text' || type === 'json' || type === 'html' || type === 'shader' || type === 'css' || (!legacyScripts && type === 'script')) {
          result = 'There are no ' + pluralize(type) + ' in this folder. Click on the <span class="font-icon" style="font-size: 18px">&#57632;</span> button to add one';
      } else {
          result = 'There are no ' + pluralize(type) + ' in this folder. Add one by uploading a ' + type + ' file';
      }

      if (filter) {
          result += ' or change your search term.';
      } else {
          result += '.';
      }

      return result;
  };

  // esc to close
  editor.call('hotkey:register', 'picker:assets:close', {
      key: 'esc',
      callback: function () {
          if (overlay.hidden)
              return;

          overlay.hidden = true;
      }
  });

  assetsGrid.on('deselect', function (item) {
      if (overlay.hidden || !item.asset)
          return;

      if (item.asset === currentAsset) {
          this.selected = [item];
      } else {
          if (allowMultiSelection) {
              var idx = assetSelection.indexOf(item.asset);
              if (idx !== -1) {
                  assetSelection.splice(idx, 1);
                  editor.emit('picker:assets', assetSelection);
              }
          }
      }
  });

  // picked asset
  assetsGrid.on('select', function (item) {
      if (item.asset) {
          if (overlay.hidden ||
              (currentType !== '*' && item.asset.get('type') !== currentType) ||
              item.asset === currentAsset) {
              return;
          }

          // emit event
          if (item.asset) {
              if (allowMultiSelection) {
                  assetSelection.push(item.asset);
                  editor.emit('picker:assets', assetSelection);
              } else {
                  editor.emit('picker:asset', item.asset);
              }
          }
      } else if (item.script) {
          if (overlay.hidden ||
              (currentType !== '*' && currentType !== "script")) {
              return;
          }

          if (item.script) {
              if (allowMultiSelection) {
                  assetSelection.push(item.script);
                  editor.emit('picker:assets', assetSelection);
              } else {
                  editor.emit('picker:asset', item.script);
              }
          }
      }

      if (!allowMultiSelection) {
          // hide picker
          overlay.hidden = true;
      }
  });


  // on close asset picker
  overlay.on('hide', function () {
      // show all assets back
      editor.call('assets:filter:type:disabled', false);
      editor.call('assets:filter:type', assetsPanelFilter);
      editor.call('assets:filter:search', assetsPanelSearch);
      editor.call('assets:panel:currentFolder', assetsPanelFolder);
      // fold back assets panel if needed
      if (assetsPanelFolded)
          assetsPanel.collapsed = true;
      // enable selector
      editor.call('selector:enabled', true);
      // select what was selected
      assetsGrid.selected = gridSelected;

      if (allowMultiSelection) {
          editor.emit('picker:assets', assetSelection);
      }

      // emit event
      editor.emit('picker:asset:close');
      // styling
      assetsPanel.style.zIndex = '';
      assetsPanel.style.overflow = '';
  });


  /**
   * Opens the asset picker. To get the selected asset(s) listen for the 'picker:asset' event or
   * the 'picker:assets' event if args.multi is true.
   * @param {Object} args Arguments
   * @param {String} [args.type] The asset type that this picker can pick. Can also be '*' for all
   * @param {Boolean} [args.multi] Allows selection of multiple assets
   * @param {Observer} [args.currentAsset] The currently selected asset
   */
  editor.method('picker:asset', function (args) {
      var type = args.type;

      allowMultiSelection = !!args.multi;
      assetSelection.length = 0;

      // show only asset assets
      assetsPanelFilter = editor.call('assets:filter:type');
      assetsPanelSearch = editor.call('assets:filter:search');
      assetsPanelFolder = editor.call('assets:panel:currentFolder');
      // navigate to scripts folder

      if (legacyScripts && type === 'script')
          editor.call('assets:panel:currentFolder', 'scripts');
      // initial grid selected items
      gridSelected = assetsGrid.selected;
      // filters
      var pickerType = type;
      if (type === 'texture') {
          pickerType = 'textureTarget';
      } else if (type === 'textureatlas') {
          pickerType = 'textureAtlasTarget';
      } else if (type === 'font') {
          pickerType = 'fontTarget';
      }

      editor.call('assets:filter:type', (pickerType === '*') ? 'all' : pickerType);
      editor.call('assets:filter:type:disabled', (!pickerType || pickerType === '*') ? false : true);

      // disable selector
      editor.call('selector:enabled', false);
      // find current asset
      currentType = type;
      currentAsset = args.currentAsset;
      if (currentAsset) {
          var gridItem = assetsGrid.assetsIndex[currentAsset.get('id')];
          // select in grid
          if (gridItem) {
              assetsGrid.selected = [gridItem];
              // navigate to folder of referenced file
              if (legacyScripts && type === 'script') {
                  editor.call('assets:panel:currentFolder', 'scripts');
              } else {
                  var path = currentAsset.get('path');
                  if (path.length) {
                      editor.call('assets:panel:currentFolder', editor.call('assets:get', path[path.length - 1]));
                  } else {
                      editor.call('assets:panel:currentFolder', null);
                  }
              }
          }
      }
      // show asset panel in front
      assetsPanel.style.zIndex = 102;
      assetsPanel.style.overflow = 'visible';
      // if panel folded?
      assetsPanelFolded = assetsPanel.collapsed;
      if (assetsPanelFolded)
          assetsPanel.collapsed = false;
      // show overlay
      overlay.hidden = false;
      // flash assets panel
      assetsPanel.flash();
      // focus on panel
      setTimeout(function () {
          if (assetsGrid.selected && assetsGrid.selected.length) {
              assetsGrid.selected[0].element.focus();
          } else {
              assetsGrid.element.focus();
          }

          // if no assets then show message
          var visible = assetsGrid.element.querySelectorAll('.ui-grid-item:not(.hidden)');
          if (visible.length === 0) {
              var msg = getNoResultsMessage(type, assetsPanelSearch);
              editor.call('assets:panel:message', msg);
          }
      }, 100);

  });

  // Deselects all picked assets
  editor.method('picker:asset:deselect', function () {
      assetsGrid.selected = currentAsset ? [currentAsset] : [];
  });

  // close asset picker
  editor.method('picker:asset:close', function () {
      // hide overlay
      overlay.hidden = true;
  });
});


/* editor/pickers/picker-curve.js */
editor.once('load', function() {
  'use strict';

  // used to disable event handlers
  var suspendEvents = false;

  // true while changing curves
  var changing = false;

  // overlay
  var overlay = new ui.Overlay();
  overlay.class.add('picker-curve');
  overlay.center = false;
  overlay.transparent = true;
  overlay.hidden = true;

  // color variables
  var colors = {
      bg: '#293538',
      gridLines: '#20292b',
      anchors: ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(133, 133, 252)', 'rgb(255, 255, 255)'],
      curves: ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(133, 133, 252)', 'rgb(255, 255, 255)'],
      curveFilling: ['rgba(255, 0, 0, 0.5)', 'rgba(0, 255, 0, 0.5)', 'rgba(133, 133, 252, 0.5)', 'rgba(255, 255, 255, 0.5)'],
      text: 'white',
      highlightedLine: 'yellow'
  };

  // canvas variables
  var padding = 10;
  var axisSpacing = 20;
  var anchorRadius = 4;
  var curveHoverRadius = 8;
  var anchorHoverRadius = 8;
  var textSize = 10;

  // input related variables
  var curves = []; // holds all the curves
  var enabledCurves = []; // holds the rendered order of the curves
  var numCurves; // number of pairs of curves
  var betweenCurves = false;
  var curveType = 1;
  var curveNames = [];
  var verticalValue = 5;
  var verticalTopValue = 5;
  var verticalBottomValue = -5;
  var maxVertical = null;
  var minVertical = null;
  var hoveredAnchor = null;
  var hoveredCurve = null;
  var selectedAnchor = null;
  var selectedAnchorIndex = -1;
  var selectedCurve = null;
  var selectedCurveIndex = -1;
  var dragging = false;
  var scrolling = false;
  var gradient = false;
  var mouseY = 0;

  var swizzle = [0, 1, 2, 3];

  var root = editor.call('layout.root');
  root.append(overlay);

  overlay.on('show', function () {
      editor.emit('picker:open', 'curve');
  });

  overlay.on('hide', function () {
      editor.emit('picker:curve:close');
      editor.emit('picker:close', 'curve');
      cleanup();
  });

  // rectangular picker
  var panel = document.createElement('div');
  panel.classList.add('picker-curve-panel');
  overlay.append(panel);

  // header
  var header = new ui.Panel();
  header.class.add('picker-curve-header');

  panel.appendChild(header.element);

  header.append(new ui.Label({
      text: 'Type'
  }));


  // esc to close
  editor.call('hotkey:register', 'picker:curve:close', {
      key: 'esc',
      callback: function() {
          if (overlay.hidden)
              return;

          overlay.hidden = true;
      }
  });


  // type selector
  var fieldType = new ui.SelectField({
      options: {
          0: 'Linear',
          1: 'Smooth Step',
          2: 'Legacy Spline', // catmull, deprecated
          // 3: 'Spline (Legacy)', // cardinal, deprecated
          4: 'Spline',  // spline
          5: 'Step'
      },
      type: 'number'
  });

  fieldType.style['font-size'] = '11px';
  fieldType.value = 1;

  fieldType.on('change', function (value) {
      changing = true;

      curveType = value;

      var paths, values;

      if (! suspendEvents) {
          paths = [];
          values = [];
      }

      // set type for each curve
      curves.forEach(function (curve, i) {
          curve.type = value;
          if (! suspendEvents) {
              paths.push(i.toString() + '.type');
              values.push(curveType);
          }
      });

      if (! suspendEvents)
          editor.emit('picker:curve:change', paths, values);

      render();

      changing = false;
  });

  header.append(fieldType);

  // randomize
  var labelRandomize = new ui.Label({
      text: 'Randomize'
  });

  labelRandomize.style['margin-left'] = '25px';
  header.append(labelRandomize);

  var fieldRandomize = new ui.Checkbox();
  fieldRandomize.class.add('component-toggle');
  fieldRandomize.on('change', function (value) {
      var i;

      changing = true;

      betweenCurves = value;

      var paths, values;

      if (! suspendEvents) {
          paths = ['0.betweenCurves'];
          values = [betweenCurves];
      }

      if (!betweenCurves) {
          for (i = 0; i < numCurves; i++) {
              if (! curves[i + numCurves]) continue;

              // disable the secondary graph
              toggleCurve(curves[i + numCurves], false);

              // make keys of secondary graph to be the same
              // as the primary graph
              if (! suspendEvents) {
                  paths.push(getKeysPath(curves[i + numCurves]));
                  values.push(serializeCurveKeys(curves[i]));
              }
          }
      } else {
          // enable the secondary graphs if their respective primary graphs are enabled
          for (i = 0; i < numCurves; i++) {
              if (! curves[i + numCurves]) continue;

              // we might have a different value for the secondary graphs
              // when we re-enable betweenCurves so fire change event
              // to make sure the different values are saved
              if (! suspendEvents) {
                  paths.push(getKeysPath(curves[i + numCurves]));
                  values.push(serializeCurveKeys(curves[i + numCurves]));
              }

              var isEnabled = enabledCurves.indexOf(curves[i]) >= 0;
              toggleCurve(curves[i + numCurves], false);
              if (isEnabled) {
                  toggleCurve(curves[i + numCurves], true);
              }
          }
      }

      if (! suspendEvents)
          editor.emit('picker:curve:change', paths, values);

      changing = false;
  });

  header.append(fieldRandomize);

  // curve toggles
  var curveToggles = [];

  var onCurveToggleClick = function () {
      var i = curveToggles.indexOf(this);
      var enabled = !this.class.contains('active');
      if (enabled) {
          this.class.add('active');
      } else {
          this.class.remove('active');
      }

      toggleCurve(curves[i], enabled);
  };

  for (var i = 0; i < colors.curves.length; i++) {
      var btn = new ui.Button();
      btn.class.add('picker-curve-toggle', 'active');
      btn.element.style.color = colors.curves[3 - i];
      curveToggles.splice(0, 0, btn);
      header.append(btn);

      btn.on('click', onCurveToggleClick.bind(btn));
  }

  // canvas
  var canvas = new ui.Canvas();
  canvas.resize(panel.clientWidth, 200);
  panel.appendChild(canvas.element);

  // canvas for checkerboard pattern
  var checkerboardCanvas = new ui.Canvas();
  checkerboardCanvas.width = 16;
  checkerboardCanvas.height = 16;
  var pctx = checkerboardCanvas.element.getContext('2d');
  pctx.fillStyle = "#949a9c";
  pctx.fillRect(0,0,8,8);
  pctx.fillRect(8,8,8,8);
  pctx.fillStyle = "#657375";
  pctx.fillRect(8,0,8,8);
  pctx.fillRect(0,8,8,8);
  var checkerboardPattern = canvas.element.getContext('2d').createPattern(checkerboardCanvas.element, 'repeat');

  // gradient canvas
  var gradientCanvas = new ui.Canvas();
  gradientCanvas.resize(panel.clientWidth, 32);
  gradientCanvas.style.display = 'block';
  panel.appendChild(gradientCanvas.element);

  // footer
  var footer = new ui.Panel();
  footer.class.add('picker-curve-footer');
  panel.appendChild(footer.element);

  // time input field
  var fieldTime = new ui.NumberField({
      min: 0,
      max: 1,
      step: 0.1
  });

  fieldTime.renderChanges = false;
  fieldTime.value = 0;
  fieldTime.on('change', onFieldChanged);
  fieldTime.flexGrow = 1;
  fieldTime.placeholder = 'Time';
  footer.append(fieldTime);

  // value input field
  var fieldValue = new ui.NumberField();
  fieldValue.renderChanges = false    ;
  fieldValue.value = 0;
  fieldValue.on('change', onFieldChanged);
  fieldValue.flexGrow = 1;
  fieldValue.placeholder = 'Value';
  footer.append(fieldValue);

  // called when time or value field change value
  function onFieldChanged () {
      if (suspendEvents || !selectedAnchor) return;

      changing = true;

      var newAnchorTime = fieldTime.value;
      var newAnchorValue = fieldValue.value;

      // set time for the selected anchor
      updateAnchor(selectedCurve, selectedAnchor, newAnchorTime, newAnchorValue);

      collapseAnchors();

      if (newAnchorValue > verticalTopValue || newAnchorValue < verticalBottomValue) {
          resetZoom();
      }

      render();

      changing = false;
  }

  // reset zoom
  var btnResetZoom = new ui.Button({
      text: '&#57623;'
  });

  btnResetZoom.flexGrow = 1;

  btnResetZoom.on('click', function () {
      if (resetZoom()) {
          render();
      }
  });

  footer.append(btnResetZoom);

  Tooltip.attach({
      target: btnResetZoom.element,
      text: 'Reset Zoom',
      align: 'bottom',
      root: root
  });

  // reset curve
  var btnResetCurve = new ui.Button({
      text: '&#57680;'
  });

  btnResetCurve.flexGrow = 1;

  Tooltip.attach({
      target: btnResetCurve.element,
      text: 'Reset Curve',
      align: 'bottom',
      root: root
  });

  btnResetCurve.on('click', function () {
      // reset keys of the selected (or only visible) curve
      var curveToReset = selectedCurve || (enabledCurves.length === 1 ? enabledCurves[0] : undefined);
      if (curveToReset) {
          changing = true;

          resetCurve(curveToReset);

          render();

          changing = false;
      }
  });

  footer.append(btnResetCurve);

  var btnCopy = new ui.Button({
      text: '&#58193'
  });

  btnCopy.on('click', function () {
      var data = {
          primaryKeys: [],
          secondaryKeys: [],
          betweenCurves: betweenCurves,
          curveType: curveType
      };

      for (var i = 0; i < numCurves; i++) {
          data.primaryKeys.push(serializeCurveKeys(curves[i]));
      }

      for (var i = 0; i < numCurves; i++) {
          if (! curves[numCurves + i]) continue;

          if (betweenCurves) {
              data.secondaryKeys.push(serializeCurveKeys(curves[numCurves + i]));
          } else {
              data.secondaryKeys.push(serializeCurveKeys(curves[i]));
          }
      }

      editor.call('localStorage:set', 'playcanvas_editor_clipboard_curves', data);
  });

  Tooltip.attach({
      target: btnCopy.element,
      text: 'Copy',
      align: 'bottom',
      root: root
  });

  footer.append(btnCopy);

  var btnPaste = new ui.Button({
      text: '&#58184'
  });

  btnPaste.on('click', function () {
      var data = editor.call('localStorage:get', 'playcanvas_editor_clipboard_curves');
      if (! data) return;

      var paths = [];
      var values = [];

      curveType = data.curveType;
      betweenCurves = data.betweenCurves && !fieldRandomize.hidden;

      var copyKeys = function (i, data) {
          if (data && curves[i]) {
              var keys = data;

              // clamp keys to min max values
              if (minVertical != null || maxVertical != null) {
                  keys = [];
                  for (var j = 0, len = data.length; j < len; j += 2) {
                      keys.push(data[j]);

                      var value = data[j+1];
                      if (minVertical != null && value < minVertical)
                          keys.push(minVertical);
                      else if (maxVertical != null && value > maxVertical)
                          keys.push(maxVertical);
                      else
                          keys.push(value);
                  }
              }

              curves[i] = new pc.Curve(keys);
              curves[i].type = curveType;

              paths.push(getKeysPath(curves[i]));
              values.push(keys);

              if (fieldType.value !== curveType) {
                  paths.push(i.toString() + '.type');
                  values.push(curveType);
              }
          }
      };

      for (var i = 0; i < numCurves; i++) {
          copyKeys(i, data.primaryKeys[i]);
      }

      for (var i = 0; i < numCurves; i++) {
          copyKeys(i + numCurves, data.secondaryKeys[i]);
      }

      enabledCurves.length = 0;
      for (var i = 0; i < numCurves; i++)  {
          if (curveToggles[i].class.contains('active')) {
              enabledCurves.push(curves[i]);
              if (betweenCurves) {
                  enabledCurves.push(curves[i+numCurves]);
              }
          }
      }

      setHovered(null, null);
      setSelected(enabledCurves[0], null);

      var suspend = suspendEvents;
      suspendEvents = true;

      if (fieldRandomize.value !== betweenCurves) {
          fieldRandomize.value = betweenCurves;
          paths.push('0.betweenCurves');
          values.push(betweenCurves);
      }

      if (fieldType.value !== curveType) {
          fieldType.value = curveType;
      }

      suspendEvents = suspend;

      if (! suspendEvents)
          editor.emit('picker:curve:change', paths, values);

      if (shouldResetZoom())
          resetZoom();

      render();
  });

  Tooltip.attach({
      target: btnPaste.element,
      text: 'Paste',
      align: 'bottom',
      root: root
  });

  footer.append(btnPaste);

  var context = canvas.element.getContext('2d');

  function cleanup () {
      selectedCurve = null;
      selectedCurveIndex = -1;
      selectedAnchor = null;
      selectedAnchorIndex = -1;
      changing = false;
      dragging = false;
      scrolling = false;
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousewheel', onMouseWheel);
      window.removeEventListener('DOMMouseScroll', onMouseWheel);
  }

  function resetCurve (curve) {
      var suspend = suspendEvents;
      suspendEvents = true;

      curve.keys.length = 0;
      createAnchor(curve, 0, 0);
      fieldTime.value = 0;
      fieldValue.value = 0;
      setSelected(curve, null);

      var paths = [getKeysPath(curve)];
      var values = [serializeCurveKeys(curve)];

      // reset secondary curve too
      var otherCurve = getOtherCurve(curve);
      if (otherCurve) {
          otherCurve.keys.length = 0;
          createAnchor(otherCurve, 0, 0);

          paths.push(getKeysPath(otherCurve));
          values.push(serializeCurveKeys(otherCurve));
      }

      suspendEvents = suspend;

      if (! suspendEvents)
          editor.emit('picker:curve:change', paths, values);
  }

  // Sets value for the picker and render it
  function setValue (value, args) {
      // sanity checks mostly for script 'curve' attributes
      if (!(value instanceof Array) || value.length === 0 || value[0].keys === undefined)
          return;

      var suspend = suspendEvents;
      suspendEvents = true;

      numCurves = value[0].keys[0].length ? value[0].keys.length : 1;

      betweenCurves = value[0].betweenCurves;
      fieldRandomize.value = betweenCurves;

      curveType = value[0].type;
      fieldType.value = curveType;

      gradient = args.gradient !== undefined ? args.gradient : false;
      gradientCanvas.style.display = gradient ? 'block' : 'none';
      fieldRandomize.hidden = gradient || args.hideRandomize;
      labelRandomize.hidden = gradient || args.hideRandomize;

      maxVertical = args.max;
      fieldValue.max = args.max;

      minVertical = args.min;
      fieldValue.min = args.min;

      curveNames = args.curves || [];
      for (var i = 0; i < colors.curves.length; i++) {
          if (i < numCurves) {
              curveToggles[i].text = curveNames[i];
              curveToggles[i].class.remove('hidden');
          } else {
              curveToggles[i].class.add('hidden');
          }
      }

      curves.length = 0;
      value.forEach(function (data) {
          if (numCurves === 1) {
              var c = new pc.Curve(data.keys);
              c.type = curveType;
              curves.push(c);
          } else {
              data.keys.forEach(function (keys) {
                  var c = new pc.Curve(keys);
                  c.type = curveType;
                  curves.push(c);
              });
          }
      });

      enabledCurves.length = 0;
      for (var i = 0; i < numCurves; i++)  {
          if (curveToggles[i].class.contains('active')) {
              enabledCurves.push(curves[i]);
              if (betweenCurves) {
                  enabledCurves.push(curves[i+numCurves]);
              }
          }
      }

      // try to select the same curve / anchor as the ones selected before setting the value
      var selCurve = selectedCurveIndex >= 0 ? curves[selectedCurveIndex] : enabledCurves[numCurves - 1];
      var selAnchor = selectedAnchorIndex >= 0 ? (selCurve ? selCurve.keys[selectedAnchorIndex] : null) : null;
      setSelected(selCurve, selAnchor);

      setHovered(null, null);

      suspendEvents = suspend;

      if (!args.keepZoom) {
          verticalValue = args.verticalValue !== undefined ? args.verticalValue : 5;
          verticalTopValue = args.max !== undefined ? Math.min(verticalValue, args.max) : verticalValue;
          verticalBottomValue = args.min !== undefined ? Math.max(-verticalValue, args.min) : -verticalValue;

          if (shouldResetZoom()) {
              resetZoom();
          }
      }

      // refresh swizzle
      swizzle = getColorSwizzle();

      // refresh toggle colors in case we are rendering single color curves
      for (var i = 0; i < curveToggles.length; i++) {
          curveToggles[i].style.color = colors.curves[swizzle[i]];
      }

      render();
  }

  function render () {
      renderGrid();
      renderCurves();
      renderHighlightedAnchors();
      renderMask();
      renderText();

      if (gradient) {
          renderColorGradient();
      }
  }

  function renderGrid() {
      var i;

      // draw background
      context.fillStyle = colors.bg;
      context.fillRect(0, 0, canvas.width, canvas.height);

      // draw grid
      for (i=0; i<5; i++) {
          var y = gridTop() + gridHeight() * i / 4;
          drawLine([gridLeft(), y], [gridRight(), y], colors.gridLines);
      }

      for (i=0; i<11; i++) {
          var x = gridLeft() + gridWidth() * i / 10;
          drawLine([x, gridTop()], [x, gridBottom()], colors.gridLines);
      }
  }

  function gridWidth () {
      return canvas.width - 2 * padding - axisSpacing;
  }

  function gridHeight () {
      return canvas.height - 2 * padding - axisSpacing;
  }

  function gridLeft () {
      return padding + axisSpacing;
  }

  function gridRight () {
      return gridLeft() + gridWidth();
  }

  function gridTop () {
      return padding;
  }

  function gridBottom () {
      return gridTop() + gridHeight();
  }

  function drawLine (start, end, color) {
      context.beginPath();
      context.moveTo(start[0], start[1]);
      context.lineTo(end[0], end[1]);
      context.strokeStyle = color;
      context.stroke();
  }

  // Draws text at the specified coordinates
  function drawText (text, x, y) {
      context.font = textSize + 'px Verdana';
      context.fillStyle = colors.text;
      context.fillText(text.toString(), x, y);
  }

  function renderCurves() {
      // holds indices of graphs that were rendered to avoid
      // rendering the same graphs twice
      var renderedCurveIndices = {};

      // draw curves in the order in which they were enabled
      for (var i = 0; i < enabledCurves.length; i++) {
          var curve = enabledCurves[i];
          var index = curves.indexOf(curve);

          if (!renderedCurveIndices[index]) {
              renderedCurveIndices[index] = true;

              var otherCurve = getOtherCurve(curve);
              drawCurvePair(curve, betweenCurves ? otherCurve : null);

              drawCurveAnchors(curve);

              if (betweenCurves && otherCurve) {
                  var otherIndex = curves.indexOf(otherCurve);
                  if (!renderedCurveIndices[otherIndex]) {
                      drawCurveAnchors(otherCurve);
                      renderedCurveIndices[otherIndex] = true;
                  }
              }
          }
      }
  }

  // If the specified curve is the primary returns the secondary
  // otherwise if the specified curve is the secondary returns the primary
  function getOtherCurve (curve) {
      var ind = curves.indexOf(curve);
      if (ind < numCurves) {
          return curves[numCurves + ind];
      } else {
          return curves[ind - numCurves];
      }
  }

  // Draws a pair of curves with their in-between filling. If the second
  // curve is null then only the first curve will be rendered
  function drawCurvePair (curve1, curve2) {
      var colorIndex = swizzle[curves.indexOf(curve1) % numCurves];

      context.strokeStyle = colors.curves[colorIndex];
      context.fillStyle = colors.curveFilling[colorIndex];
      context.beginPath();

      var time = 0;
      var value = curve1.value(time);
      var x;
      var coords = calculateAnchorCoords([time, value]);
      context.moveTo(coords[0], coords[1]);

      var precision = 1;
      var width = canvas.width;

      for (x = precision; x <= Math.ceil(width / precision); x++) {
          time = x * precision / width;
          value = curve1.value(time);
          coords = calculateAnchorCoords([time, value]);
          context.lineTo(coords[0], coords[1]);
      }

      if (curve2) {
         for (x = Math.ceil(width / precision); x >= 0; x--) {
              time = x * precision / width;
              value = curve2.value(time);
              coords = calculateAnchorCoords([time, value]);
              context.lineTo(coords[0], coords[1]);
          }

          context.closePath();
          context.fill();
      }

      context.stroke();
  }

  // Returns the coordinates of the specified anchor on this grid
  function calculateAnchorCoords (anchor) {
      var time = anchor[0];
      var value = anchor[1];

      var coords = [0, 0];
      coords[0] = gridLeft() + time * gridWidth();

      var top = gridTop();
      coords[1] = top + gridHeight() * (value - verticalTopValue) / (verticalBottomValue - verticalTopValue);

      return coords;
  }

  // Draws the anchors for the specified curve
  function drawCurveAnchors (curve) {
      var colorIndex = swizzle[curves.indexOf(curve) % numCurves];
      curve.keys.forEach(function (anchor) {
          if (anchor !== hoveredAnchor && anchor !== selectedAnchor) {
              var color = colors.anchors[colorIndex];
              var lineColor = colors.curves[colorIndex];
              drawAnchor(calculateAnchorCoords(anchor), color, lineColor);
          }
      });
  }

  // Draws an anchor point at the specified coordinates
  function drawAnchor (coords, fillColor, lineColor) {
      context.beginPath();
      context.arc(coords[0], coords[1], anchorRadius, 0, 2 * Math.PI, false);
      context.fillStyle = fillColor;
      context.fill();
      var lineWidth = context.lineWidth;
      context.lineWidth = 2;
      context.strokeStyle = lineColor;
      context.stroke();
      context.lineWidth = lineWidth;
  }

  function renderHighlightedAnchors() {
      // draw highlighted anchors on top of the others
      if (hoveredAnchor) {
          drawAnchor(
              calculateAnchorCoords(hoveredAnchor),
              colors.anchors[curves.indexOf(hoveredCurve) % numCurves],
              colors.highlightedLine
          );
      }

      if (selectedAnchor && selectedAnchor !== hoveredAnchor) {
          drawAnchor(
              calculateAnchorCoords(selectedAnchor),
              colors.anchors[curves.indexOf(selectedCurve) % numCurves],
              colors.highlightedLine
          );
      }
  }

  // renders a quad in the same color as the bg color
  // to hide the portion of the curves that is outside the grid
  function renderMask () {
      context.fillStyle = colors.bg;

      var offset = anchorRadius + 1;

      // top
      context.fillRect(0, 0, canvas.width, gridTop() - offset);

      // bottom
      context.fillRect(0, gridBottom() + offset, canvas.width, 33 - offset);
  }

  function renderText () {
      // draw vertical axis values
      var left = gridLeft() - textSize * 2;
      drawText(+verticalTopValue.toFixed(2), left, gridTop() + textSize * 0.5);
      drawText(+((verticalTopValue + verticalBottomValue) * 0.5).toFixed(2), left, gridTop() + (gridHeight() + textSize) * 0.5);
      drawText(+verticalBottomValue.toFixed(2), left, gridBottom() + textSize * 0.5);

      // draw horizontal axis values
      drawText('0.0', left + textSize * 2, gridBottom() + 2 * textSize);
      drawText('1.0', gridRight() - textSize * 2, gridBottom() + 2 * textSize);
  }

  // if we only have one curve then
  // use 'swizzle' - an array of indexes
  // that remaps other arrays to different colors
  var getColorSwizzle = function () {
      var result = [0, 1, 2, 3];
      if (gradient && curves.length === 1) {
          if (curveNames[0] === 'g') {
              result = [1, 0, 2, 3];
          } else if (curveNames[0] === 'b') {
              result = [2, 1, 0, 3];
          } else if (curveNames[0] === 'a') {
              result = [3, 1, 2, 0];
          }
      }

      return result;
  };

  // Draws color gradient for a set of curves
  function renderColorGradient () {
      var ctx = gradientCanvas.element.getContext('2d');
      var t;
      var rgb = [];
      var precision = 2;

      var keys = [];
      for (var i = 0; i < curves.length; i++) {
          var k = curves[i].keys;
          var ka = [];
          for (var j = 0, len = k.length; j < len; j++ ) {
              ka.push(k[j][0], k[j][1]);
          }
          keys.push(ka);
      }

      var curveset = new pc.CurveSet(keys);
      curveset.type = curveType;

      ctx.fillStyle = checkerboardPattern;
      ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

      var gradient = ctx.createLinearGradient(0, 0, gradientCanvas.width, gradientCanvas.height);

      for (t = 0; t <= gradientCanvas.width; t += precision) {

          curveset.value(t / gradientCanvas.width, rgb);
          var rgba = Math.round((rgb[swizzle[0]] || 0) * 255) + ',' +
                     Math.round((rgb[swizzle[1]] || 0) * 255) + ',' +
                     Math.round((rgb[swizzle[2]] || 0) * 255) + ',' +
                     (isNaN(rgb[swizzle[3]]) ? 1 : rgb[swizzle[3]]);

          gradient.addColorStop(t / gradientCanvas.width, 'rgba(' + rgba + ')');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);
  }

  // Calculate the anchor value based on the specified coordinates
  function calculateAnchorValue (coords) {
      var top = gridTop();
      var height = gridHeight();

      return pc.math.lerp(verticalTopValue, verticalBottomValue, (coords[1] - top) / height);
  }

  // Calculate the anchor time based on the specified coordinates
  function calculateAnchorTime (coords) {
      return pc.math.clamp((coords[0] - gridLeft()) / gridWidth(), 0, 1);
  }

  // zoom in - out based on delta
  function adjustZoom (delta) {
      var maxDelta = 1;
      if (delta > maxDelta) delta = maxDelta;
      else if (delta < -maxDelta) delta = -maxDelta;

      var speed = delta * (verticalTopValue - verticalBottomValue) / 10;

      var verticalTop = verticalTopValue - speed;
      var verticalBottom = verticalBottomValue + speed;

      // if we have a hovered or selected anchor then try to focus on
      // that when zooming in
      var focus = hoveredAnchor || selectedAnchor;
      if (delta > 0 && focus) {
          var value = focus[1];
          var mid = (verticalTopValue + verticalBottomValue) / 2;
          verticalTop += (value - mid) * delta;
          verticalBottom += (value - mid) * delta;
      } else if (delta > 0 && minVertical != null) {
          verticalBottom = verticalBottomValue;
      }

      // keep limits
      if (maxVertical != null && verticalTop > maxVertical)
          verticalTop = maxVertical;

      if (minVertical != null && verticalBottom < minVertical)
          verticalBottom = minVertical;

      // try not to bring values too close together
      if (+(verticalTop - verticalBottom).toFixed(2) <= 0.01)
          return;

      verticalTopValue = verticalTop;
      verticalBottomValue = verticalBottom;

      render();
  }

  function resetZoom () {
      var minMax = getCurvesMinMax(enabledCurves);

      var oldVerticalTop = verticalTopValue;
      var oldVerticalBottom = verticalBottomValue;

      var maxLimit = Math.ceil(2 * Math.max(Math.abs(minMax[0]), Math.abs(minMax[1])));
      if (maxLimit === 0) {
          maxLimit = verticalValue;
      }

      verticalTopValue = maxLimit;
      if (maxVertical != null) {
          verticalTopValue = Math.min(maxLimit, maxVertical);
      }

      verticalBottomValue = -verticalTopValue;
      if (minVertical != null) {
          verticalBottomValue = Math.max(minVertical, verticalBottomValue);
      }

      return oldVerticalTop != verticalTopValue || oldVerticalBottom != verticalBottomValue;
  }

  function scroll (delta) {
      var range = verticalTopValue - verticalBottomValue;
      var fraction = delta / gridHeight();
      var diff = range * fraction;

      if (maxVertical != null && verticalTopValue + diff > maxVertical) {
          diff = maxVertical - verticalTopValue;
      }

      if (minVertical != null && verticalBottomValue + diff < minVertical) {
          diff = minVertical - verticalBottomValue;
          if (maxVertical != null && verticalTopValue + diff > maxVertical) {
              diff = maxVertical - verticalTopValue;
          }
      }

      verticalTopValue += diff;
      verticalBottomValue += diff;

      render();
  }

  function getCurvesMinMax (curves) {
      var maxValue = -Infinity;
      var minValue = Infinity;

      curves.forEach(function (curve) {
          curve.keys.forEach(function (anchor) {
              var value = anchor[1];
              if (value > maxValue) {
                  maxValue = value;
              }

              if (value < minValue) {
                  minValue = value;
              }
          });
      });

      if (maxValue == -Infinity) {
          maxValue = maxVertical != null ? maxVertical : verticalValue;
      }

      if (minValue == Infinity) {
          minValue = minVertical != null ? minVertical : -verticalValue;
      }

      return [minValue, maxValue];
  }

  function updateFields (anchor) {
      var suspend = suspendEvents;
      suspendEvents = true;
      fieldTime.value = anchor ? +anchor[0].toFixed(3) : 0;
      fieldValue.value = anchor ? +anchor[1].toFixed(3) : 0;
      suspendEvents = suspend;
  }

  function getTargetCoords (e) {
      var rect = canvas.element.getBoundingClientRect();
      var left = Math.floor(rect.left);
      var top = Math.floor(rect.top);

      return [e.clientX - left, e.clientY - top];
  }

  // Returns true if the specidifed coordinates are within the grid bounds
  function areCoordsInGrid (coords) {
      return coords[0] >= gridLeft() &&
             coords[0] <= gridRight() &&
             coords[1] >= gridTop() &&
             coords[1] <= gridBottom();
  }

  function areCoordsClose (coords1, coords2, range) {
      return Math.abs(coords1[0] - coords2[0]) <= range &&
             Math.abs(coords1[1] - coords2[1]) <= range;
  }

  // If there are any anchors with the same time, collapses them to one
  function collapseAnchors () {
      var changedCurves = {};

      var paths, values;
      if (! suspendEvents) {
          paths = [];
          values = [];
      }

      enabledCurves.forEach(function (curve) {
          for (var i = curve.keys.length - 1; i > 0; i--) {
              var key = curve.keys[i];
              var prevKey = curve.keys[i-1];
              if (key[0].toFixed(3) === prevKey[0].toFixed(3)) {
                  curve.keys.splice(i, 1);

                  changedCurves[i] = true;

                  if (selectedAnchor === key) {
                      setSelected(selectedCurve, prevKey);
                  }

                  if (hoveredAnchor === key) {
                      setHovered(hoveredCurve, prevKey);
                  }
              }
          }
      });


      if (! suspendEvents) {
          for (var index in changedCurves) {
              var curve = curves[parseInt(index)];
              if (curve) {
                  var val = serializeCurveKeys(curve);
                  paths.push(getKeysPath(curve));
                  values.push(val.slice(0));

                  // if randomize is false set secondary graph the same as the first
                  if (! betweenCurves) {
                      var other = getOtherCurve(curve);
                      if (other) {
                          paths.push(getKeysPath(other));
                          values.push(val);
                      }
                  }
              }
          }

          if (paths.length) {
              editor.emit('picker:curve:change', paths, values);
          }
      }

  }

  // Creates and returns an anchor and fires change event
  function createAnchor (curve, time, value) {
      var anchor = curve.add(time, value);

      if (! suspendEvents)
          onCurveKeysChanged(curve);

      return anchor;
  }

  // Updates the time / value of an anchor and fires change event
  function updateAnchor (curve, anchor, time, value) {
      anchor[0] = time;
      anchor[1] = value;
      curve.sort();

      // reset selected anchor index because it
      // might have changed after sorting the curve keys
      if (selectedCurve === curve && selectedAnchor) {
          selectedAnchorIndex = curve.keys.indexOf(selectedAnchor);
      }

      if (! suspendEvents)
          onCurveKeysChanged(curve);
  }

  // Deletes an anchor from the curve and fires change event
  function deleteAnchor (curve, anchor) {
      var index = curve.keys.indexOf(anchor);
      if (index >= 0) {
          curve.keys.splice(index, 1);
      }

      // Have at least one key in the curve
      if (curve.keys.length === 0) {
          createAnchor(curve, 0, 0);
      } else {
          if (! suspendEvents)
              onCurveKeysChanged(curve);
      }
  }

  function getKeysPath (curve) {
      var curveIndex = curves.indexOf(curve);
      if (numCurves > 1) {
          return curveIndex >= numCurves ? '1.keys.' + (curveIndex - numCurves) : '0.keys.' + curveIndex;
      } else {
          return curveIndex === 0 ? '0.keys' : '1.keys';
      }
  }

  function serializeCurveKeys (curve) {
      var result = [];
      curve.keys.forEach(function (k) {
          result.push(k[0], k[1]);
      });
      return result;
  }

  function onCurveKeysChanged (curve) {
      var paths = [getKeysPath(curve)];
      var values = [serializeCurveKeys(curve)];

      // if randomize is false set secondary graph the same as the first
      if (! betweenCurves) {
          var other = getOtherCurve(curve);
          if (other) {
              paths.push(getKeysPath(other));
              values.push(values[0].slice(0));
          }
      }

      editor.emit('picker:curve:change', paths, values);
  }

  // Make the specified curve appear in front of the others
  function sendCurveToFront (curve) {
      var index = enabledCurves.indexOf(curve);
      if (index >= 0) {
          enabledCurves.splice(index, 1);
      }

      enabledCurves.push(curve);
  }

  // Sets the hovered graph and anchor
  function setHovered (curve, anchor) {
      hoveredCurve = curve;
      hoveredAnchor = anchor;

      // Change the mouse cursor to a pointer
      if (curve || anchor) {
          canvas.element.style.cursor = 'pointer';
          updateFields(anchor);
      } else {
          canvas.element.style.cursor = '';
          updateFields(selectedAnchor);
      }
  }

  // Sets the selected anchor and curve
  function setSelected (curve, anchor) {
      selectedCurve = curve;
      selectedAnchor = anchor;

      updateFields(anchor);

      // make the selected curve appear in front of all the others
      if (curve) {
          // set selected curve index
          selectedCurveIndex = curves.indexOf(curve);

          // set selected anchor index
          selectedAnchorIndex = anchor ? curve.keys.indexOf(anchor) : -1;

          // render curve pair in front of the others
          if (betweenCurves) {
              var otherCurve = getOtherCurve(curve);
              if (otherCurve) {
                  sendCurveToFront(otherCurve);
              }
          }


          sendCurveToFront(curve);
      } else {
          selectedCurveIndex = -1;
          selectedAnchorIndex = -1;
      }
  }

  // Return the hovered anchor and graph
  function getHoveredAnchor (coords) {
      var x,y;

      var result = {
          graph: null,
          anchor: null
      };

      var hoveredTime = calculateAnchorTime(coords);

      // go through all the curves from front to back
      // and check if the mouse cursor is hovering on them
      for (var j = enabledCurves.length - 1; j >= 0; j--) {
          var curve = enabledCurves[j];

          if (!result.curve) {
              // get the value at the current hovered time
              var value = curve.value(hoveredTime);

              // convert hoveredTime, value to coords
              var curvePointCoords = calculateAnchorCoords([hoveredTime, value]);

              // check coords are close to a radius
              x = coords[0] - curvePointCoords[0];
              y = coords[1] - curvePointCoords[1];

              if (areCoordsClose(coords, curvePointCoords, curveHoverRadius)) {
                  result.curve = curve;
              }
          }

          for (var i = 0, imax = curve.keys.length; i < imax; i++) {
              var anchor = curve.keys[i];
              var anchorCoords = calculateAnchorCoords(anchor);

              if (areCoordsClose(coords, anchorCoords, anchorHoverRadius)) {
                  result.anchor = anchor;
                  result.curve = curve;
                  return result;
              }
          }
      }

      return result;
  }

  // Enables / disables a curve
  function toggleCurve (curve, toggle) {
      if (toggle) {
          // when we enable a curve make it the selected one
          setSelected(curve, null);
      } else {
          // remove the curve from the enabledCurves array
          var index = enabledCurves.indexOf(curve);
          if (index >= 0) {
              enabledCurves.splice(index, 1);
          }

          // remove its matching curve too
          if (betweenCurves) {
              var otherCurve = getOtherCurve(curve);
              if (otherCurve) {
                  index = enabledCurves.indexOf(otherCurve);
                  if (index >= 0) {
                      enabledCurves.splice(index, 1);
                  }
              }
          }


          // if the selected curve was disabled select the next enabled one
          if (selectedCurve === curve || selectedCurve === otherCurve) {
              setSelected(null, null);

              if (enabledCurves.length) {
                  selectedCurve = enabledCurves[enabledCurves.length - 1];
                  selectedCurveIndex = curves.indexOf(selectedCurve);

                  // make sure we select the primary curve
                  if (betweenCurves && selectedCurveIndex >= numCurves) {
                      selectedCurveIndex -= numCurves;
                      selectedCurve = curves[selectedCurveIndex];
                  }
              }
          }

          if (hoveredCurve === curve || hoveredCurve === otherCurve) {
              hoveredCurve = null;
          }
      }

      render();
  }

  // Returns true if it would be a good idea to reset the zoom
  function shouldResetZoom () {
      var minMax = getCurvesMinMax(enabledCurves);

      // if min value is less than the bottom vertical value...
      if (minMax[0] < verticalBottomValue) {
          return true;
      }

      // ... or if max is bigger than the top vertical value...
      if (minMax[1] > verticalTopValue) {
          return true;
      }

      // // ... or if min and max are between the [25%, 75%] interval of the editor, return true
      // if (minMax[1] < Math.ceil(pc.math.lerp(verticalBottomValue, verticalTopValue, 0.75)) &&
      //     minMax[0] > Math.ceil(pc.math.lerp(verticalBottomValue, verticalTopValue, 0.25))) {
      //     return true;
      // }

      // don't reset zoom
      return false;
  }

  function toggleTextSelection (enable) {
      if (enable) {
          document.body.classList.remove('noSelect');
      } else {
          if (!document.body.classList.contains('noSelect')) {
              document.body.classList.add('noSelect');
          }
      }
  }

  // Handles mouse down
  canvas.element.addEventListener('mousedown', function (e) {
      if (e.target !== canvas.element) {
          return;
      }

      toggleTextSelection(false);

      var point = getTargetCoords(e);
      var inGrid = areCoordsInGrid(point);

      // collapse anchors on mouse down because we might
      // have placed another anchor on top of another by directly
      // editing its time through the input fields
      var suspend = suspendEvents;
      suspendEvents = true;
      collapseAnchors();
      suspendEvents = suspend;

      // select or add anchor on left click
      if (e.button === 0) {
          dragging = true;
          changing = true;
          scrolling = false;

          // if we are clicking on an empty area
          if (!hoveredAnchor) {

              if (!inGrid) {
                  return;
              }

              var curve = hoveredCurve || selectedCurve;

              // create a new anchor
              if (curve) {

                  var time = calculateAnchorTime(point);
                  var value = calculateAnchorValue(point);
                  var anchor = createAnchor(curve, time, value);

                  // combine changes from now on until mouse is up
                  editor.emit('picker:curve:change:start');

                  // select the new anchor and make it hovered
                  setSelected(curve, anchor);
                  setHovered(curve, anchor);
              }
          } else {
              // if we are hovered over a graph or an anchor then select it
              setSelected(hoveredCurve, hoveredAnchor);
              onCurveKeysChanged(selectedCurve);
          }
      } else if (e.button === 2) {
          if (! dragging) {
              scrolling = true;
              mouseY = e.y;

              panel.classList.add('scroll');
          }
      }

      render();
  });

  // Handles mouse move
  var onMouseMove = function (e) {
      var coords = getTargetCoords(e);

      // if we are dragging the selected anchor
      if (selectedAnchor && dragging) {
          // clamp coords to grid
          coords[0] = pc.math.clamp(coords[0], gridLeft(), gridRight());
          coords[1] = pc.math.clamp(coords[1], gridTop(), gridBottom());

          var time = calculateAnchorTime(coords);
          var value = calculateAnchorValue(coords);

          // if there is another point with the same time
          // then make the two points have the same values
          var keys = selectedCurve.keys;
          for (var i = 0, len = keys.length; i < len; i++) {
              if (keys[i] !== selectedAnchor && keys[i][0] === time) {
                  value = keys[i][1];
              }
          }

          updateAnchor(selectedCurve, selectedAnchor, time, value);
          updateFields(selectedAnchor);

          // combine changes from now on
          editor.emit('picker:curve:change:start');

          render();
      } else {

          if (scrolling) {
              scroll(e.y - mouseY);
              mouseY = e.y;
          }

          // mouse is moving without selected anchors so just check for hovered anchors or hovered curves
          var hovered = getHoveredAnchor(coords);
          if (hovered.curve != hoveredCurve || hovered.anchor != hoveredAnchor) {
              setHovered(hovered.curve, hovered.anchor);
              render();
          }
      }
  };

  // Handles mouse up
  var onMouseUp = function (e) {
      toggleTextSelection(true);

      if (e.button === 0) {
          if (changing) {
              // collapse anchors on mouse up because we might have
              // placed an anchor on top of another one
              collapseAnchors();

              dragging = false;
              changing = false;

              render();
          }

          editor.emit('picker:curve:change:end');
      } else if (e.button === 2 && !dragging) {
          scrolling = false;
          panel.classList.remove('scroll');

          // delete anchor on right click
          if (hoveredAnchor) {
              deleteAnchor(hoveredCurve, hoveredAnchor);

              // clean up selected anchor
              if (selectedAnchor == hoveredAnchor) {
                  setSelected(selectedCurve, null);
              }

              // clean up hovered anchor
              setHovered(null, null);

              render();
          }
      }
  };

  // Handle mouse wheel
  var onMouseWheel = function (e) {
      var delta = 0;
      if (e.detail)
          delta = -1 * e.detail * 0.05;
      else if (e.wheelDelta)
          delta = e.wheelDelta / 120;

      if (delta !== 0)
          adjustZoom(delta);
  };

  // call picker
  editor.method('picker:curve', function (value, args) {
      // show overlay
      overlay.hidden = false;

      var suspend = suspendEvents;
      suspendEvents = true;
      curveToggles.forEach(function (toggle) {
          toggle.class.add('active');
      });
      suspendEvents = suspend;

      setValue(value, args || {});

      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mousewheel', onMouseWheel);
      window.addEventListener('DOMMouseScroll', onMouseWheel);
  });

  editor.method('picker:curve:close', function () {
      overlay.hidden = true;
      cleanup();

      toggleTextSelection(true);
  });

  editor.method('picker:curve:rect', function () {
      return overlay.rect;
  });

  // position picker
  editor.method('picker:curve:position', function (x, y) {
      // limit to bottom of screen
      if (y + panel.clientHeight > window.innerHeight) {
          y = window.innerHeight - panel.clientHeight;
      }

      overlay.position(x, y);
  });

  // update value of picker
  editor.method('picker:curve:set', function (value, args) {
      if (!changing) {
          setValue(value, args || {});
      }
  });

  var onDeleteKey = function () {
      if (hoveredCurve && hoveredAnchor) {
          deleteAnchor(hoveredCurve, hoveredAnchor);
      } else if (selectedCurve && selectedAnchor) {
          deleteAnchor(selectedCurve, selectedAnchor);
      }
  };

  // delete key
  editor.call('hotkey:register', 'curve-anchor:delete', {
      key: 'delete',
      callback: onDeleteKey
  });
  // ctrl + backspace
  editor.call('hotkey:register', 'curve-anchor:delete', {
      ctrl: true,
      key: 'backspace',
      callback: onDeleteKey
  });
});


/* editor/pickers/picker-entity.js */
editor.once('load', function() {
  'use strict';

  var overlay = new ui.Overlay();
  overlay.class.add('picker-entity');
  overlay.center = false;
  overlay.hidden = true;

  var root = editor.call('layout.root');
  root.append(overlay);

  // initial select state
  var currentEntity = null;
  var initialSelection = null;

  // elements
  var hierarchy = editor.call('entities:hierarchy');
  var hierarchyPanel = hierarchy.parent;
  var hierarchyFolded = false;
  var filter = null;

  // esc to close
  editor.call('hotkey:register', 'picker:entity:close', {
      key: 'esc',
      callback: function() {
          if (overlay.hidden)
              return;

          overlay.hidden = true;
      }
  });

  hierarchy.on('deselect', function (item) {
      if (overlay.hidden || !item.entity || item.entity !== currentEntity)
          return;
  });

  // picked entity
  hierarchy.on('select', function (item) {
      if (overlay.hidden || item.entity === currentEntity || (filter && ! filter(item.entity)))
          return;

      // emit event
      if (item.entity)
          editor.emit('picker:entity', item.entity);

      // hide picker
      overlay.hidden = true;
  });


  // on close entity picker
  overlay.on('hide', function() {
      // fold back hierarchy panel if needed
      if (hierarchyFolded)
          hierarchyPanel.folded = true;

      // disable new selections
      for (var i = 0, len = hierarchy.selected.length; i < len; i++)
          hierarchy.selected[i].selected = false;

      // select what was selected
      hierarchy.selected = initialSelection;
      for (var i = 0, len = initialSelection.length; i < len; i++)
          initialSelection[i].selected = true;

      if (initialSelection.length)
          initialSelection[initialSelection.length - 1].elementTitle.focus();

      currentEntity = null;

      var entities = editor.call('entities:list');
      for(var i = 0; i < entities.length; i++) {
          var id = entities[i].get('resource_id');
          var item = editor.call('entities:panel:get', id);
          if (! item) continue;
          item.elementTitle.classList.remove('disabled');
      }

      // enable selector
      editor.call('selector:enabled', true);

      // emit event
      editor.emit('picker:entity:close');
      // styling
      hierarchyPanel.style.zIndex = '';
      hierarchyPanel.style.overflow = '';
  });


  // open entity picker
  editor.method('picker:entity', function(resourceId, fn) {
      // disable selector
      editor.call('selector:enabled', false);

      // get current hierarchy selection
      initialSelection = hierarchy.selected ? hierarchy.selected.slice(0) : [];
      if (initialSelection) {
          for (var i = 0, len = initialSelection.length; i < len; i++) {
              initialSelection[i].selected = false;
          }
      }

      // find current entity
      if (resourceId)
          currentEntity = editor.call('entities:get', resourceId);

      if (currentEntity) {
          var item = editor.call('entities:panel:get', resourceId);
          // select in hierarchy
          if (item) {
              hierarchy.selected = [ item ];
              item.selected = true;
          }
      } else {
          hierarchy.selected = [ ];
      }

      filter = fn || null;
      var entities = editor.call('entities:list');
      for(var i = 0; i < entities.length; i++) {
          var id = entities[i].get('resource_id');
          var item = editor.call('entities:panel:get', id);
          if (! item) continue;

          if (filter) {
              if (! filter(entities[i]))
                  item.elementTitle.classList.add('disabled');
          }
      }

      // show hierarchy panel in front
      hierarchyPanel.style.zIndex = 102;
      hierarchyPanel.style.overflow = 'visible';
      // if panel folded?
      hierarchyFolded = hierarchyPanel.folded;
      if (hierarchyFolded)
          hierarchyPanel.folded = false;

      // show overlay
      overlay.hidden = false;
      // flash entities panel
      hierarchyPanel.flash();
      // focus on panel
      setTimeout(function() {
          if (hierarchy.selected.length) {
              hierarchy.selected[0].elementTitle.focus();
          } else {
              hierarchy.element.focus();
          }
      }, 100);
  });


  // close entity picker
  editor.method('picker:entity:close', function() {
      // hide overlay
      overlay.hidden = true;
  });
});


/* editor/pickers/picker-node.js */
editor.once('load', function() {
  'use strict';

  var overlay = new ui.Overlay();
  overlay.class.add('picker-node');
  overlay.center = false;
  overlay.hidden = true;

  var root = editor.call('layout.root');
  root.append(overlay);

  var currentEntities = null;
  var currentAsset = null;

  // esc to close
  editor.call('hotkey:register', 'picker:node:close', {
      key: 'esc',
      callback: function() {
          if (overlay.hidden)
              return;

          overlay.hidden = true;
      }
  });

  // on close asset picker
  overlay.on('hide', function() {
      // reset root header
      var root = editor.call('attributes.rootPanel');
      root.style.zIndex = '';

      // select entities again
      editor.call('selector:history', false);
      editor.call('selector:set', 'entity', currentEntities);
      editor.once('selector:change', function () {
          editor.call('selector:history', true);
      });

      // emit event
      editor.emit('picker:node:close');

      currentEntities = null;
      currentAsset = null;
  });

  var addMapping = function (index, assetId) {
      var resourceIds = [];
      var actions = [];

      for (var i = 0, len = currentEntities.length; i < len; i++) {

          var history = currentEntities[i].history.enabled;
          currentEntities[i].history.enabled = false;

          if (! currentEntities[i].get('components.model.mapping')) {
              var mapping = {};
              mapping[index] = parseInt(assetId, 10);

              actions.push({
                  path: 'components.model.mapping',
                  undo: undefined,
                  redo: mapping
              });

              currentEntities[i].set('components.model.mapping', mapping);

              resourceIds.push(currentEntities[i].get('resource_id'));
          } else {
              if (currentEntities[i].has('components.model.mapping.' + index))
                  continue;

              var id = parseInt(assetId, 10);

              actions.push({
                  path: 'components.model.mapping.' + index,
                  undo: undefined,
                  redo: id
              });

              currentEntities[i].set('components.model.mapping.' + index, id);

              resourceIds.push(currentEntities[i].get('resource_id'));
          }

          currentEntities[i].history.enabled = history;
      }

      editor.call('history:add', {
          name: 'entities.' + (resourceIds.length > 1 ? '*' : resourceIds[0]) + '.components.model.mapping',
          undo: function() {
              for(var i = 0; i < resourceIds.length; i++) {
                  var item = editor.call('entities:get', resourceIds[i]);
                  if (! item)
                      continue;

                  var history = item.history.enabled;
                  item.history.enabled = false;

                  if (actions[i].undo === undefined)
                      item.unset(actions[i].path);
                  else
                      item.set(actions[i].path, actions[i].undo);

                  item.history.enabled = history;
              }
          },
          redo: function() {
              for(var i = 0; i < resourceIds.length; i++) {
                  var item = editor.call('entities:get', resourceIds[i]);
                  if (! item)
                      continue;

                  var history = item.history.enabled;
                  item.history.enabled = false;
                  item.set(actions[i].path, actions[i].redo);
                  item.history.enabled = history;
              }
          }
      });


  };

  var addClickEvent = function (field, index) {
      field.addEventListener('click', function () {
          addMapping(index, currentAsset.get('data.mapping.' + index + '.material'));
          overlay.hidden = true;
      });
  };

  var isAlreadyOverriden = function (index) {
      var len = currentEntities.length;
      var overrideCount = 0;
      for (var i = 0; i < len; i++) {
          if (currentEntities[i].has('components.model.mapping.' + index))
              overrideCount++;
      }

      return overrideCount && overrideCount === len;
  };


  // open asset picker
  editor.method('picker:node', function(entities) {
      // show overlay
      overlay.hidden = false;

      currentEntities = entities;

      // select model asset
      currentAsset = editor.call('assets:get', entities[0].get('components.model.asset'));
      editor.call('selector:history', false);
      editor.call('selector:set', 'asset', [currentAsset]);

      editor.once('attributes:inspect[asset]', function () {
          editor.call('selector:history', true);

          // change header name
          editor.call('attributes:header', 'Entity Materials');

          // hide asset info
          editor.emit('attributes:assets:toggleInfo', false);

          // get mesh instances panel
          var panelNodes = editor.call('attributes:asset:model:nodesPanel');
          if (! panelNodes)
              return;

          panelNodes.style.overflow = 'visible';

          var root = editor.call('attributes.rootPanel');
          root.style.zIndex = 102;

          // flash panel
          panelNodes.flash();

          // add special class
          panelNodes.class.add('picker-node', 'noHeader');

          // add help
          var help = new ui.Label({
              text: '<h5>SELECT MESH INSTANCE</h5>Choose a mesh instance to customize the material for ' + (currentEntities.length > 1 ? 'these Entities.' : 'this Entity.'),
              unsafe: true
          });
          help.class.add('help');
          panelNodes.prepend(help);

          // add click events for each mesh instance field
          var fields = panelNodes.element.getElementsByClassName('field-asset');
          for (var i = 0, len = fields.length; i < len; i++) {
              if (isAlreadyOverriden(i)) {
                  fields[i].classList.add('disabled');
              } else {
                  addClickEvent(fields[i], i);
              }
          }

          // focus panel
          setTimeout(function() {
              panelNodes.element.focus();
          }, 100);
      });

  });


  // close asset picker
  editor.method('picker:node:close', function() {
      // hide overlay
      overlay.hidden = true;
  });
});


/* editor/pickers/picker-project.js */
editor.once('load', function () {
  'use strict';

  // overlay
  var overlay = new ui.Overlay();
  overlay.class.add('picker-project');
  overlay.clickable = true;
  overlay.hidden = true;

  var root = editor.call('layout.root');
  root.append(overlay);

  // main panel
  var panel = new ui.Panel();
  panel.class.add('project');
  overlay.append(panel);

  // left side panel
  var leftPanel = new ui.Panel();
  panel.append(leftPanel);
  leftPanel.class.add('left');

  // project image
  var blankImage = config.url.static + '/platform/images/common/blank_project.png';

  var projectImg = document.createElement('div');
  projectImg.classList.add('image');
  projectImg.style.backgroundImage = 'url("' + (config.project.thumbnails.m || blankImage) + '")';
  leftPanel.append(projectImg);

  var uploadProjectImage = function (file) {
      if (! editor.call('permissions:write'))
          return;

      if (uploadingImage)
          return;

      projectImg.style.backgroundImage = 'url("' + config.url.static + '/platform/images/common/ajax-loader.gif")';
      projectImg.classList.add('progress');

      uploadingImage = true;

      editor.call('images:upload', file, function (data) {
          editor.call('project:save', {image_url: data.url}, function () {
              uploadingImage = false;

          }, function () {
              // error
              uploadingImage = false;

          });
      }, function (status, data) {
          // error
          uploadingImage = false;
      });
  };

  var dropRef = editor.call('drop:target', {
      ref: projectImg,
      filter: function (type, data) {
          return editor.call('permissions:write') &&
                 !leftPanel.disabled &&
                 ! uploadingImage &&
                 type === 'files';
      },
      drop: function (type, data) {
          if (type !== 'files')
              return;

          var file = data[0];
          if (! file)
              return;

          if (! /^image\//.test(file.type))
              return;

          uploadProjectImage(file);
      }
  });

  dropRef.element.classList.add('drop-area-project-img');

  // hidden file input to upload project image
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';

  var currentSelection = null;
  var uploadingImage = false;

  projectImg.addEventListener('click', function () {
      if (! editor.call('permissions:write') || leftPanel.disabled)
          return;

      fileInput.click();
  });


  fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      fileInput.value = null;

      uploadProjectImage(file);
  });

  // project info
  var info = document.createElement('div');
  info.classList.add('info');
  leftPanel.append(info);

  // name
  var projectName = new ui.Label({
      text: config.project.name
  });
  projectName.class.add('name');
  info.appendChild(projectName.element);

  // quick stats
  // TODO

  // store all panels for each menu option
  var menuOptions = {};

  var defaultMenuOption = null;

  // menu
  var list = new ui.List();
  leftPanel.append(list);

  // right side panel
  var rightPanel = new ui.Panel('Project');
  panel.append(rightPanel);
  rightPanel.class.add('right');

  // close button
  var btnClose = new ui.Button({
      text: '&#57650;'
  });
  btnClose.class.add('close');
  btnClose.on('click', function () {
      overlay.hidden = true;
  });
  rightPanel.headerElement.appendChild(btnClose.element);

  // register new panel / menu option
  editor.method('picker:project:registerMenu', function (name, title, panel) {
      var menuItem = new ui.ListItem({text: name});
      menuItem.class.add(name.replace(' ', '-'));
      list.append(menuItem);

      menuItem.on('click', function () {
          select(name);
      });

      menuOptions[name] = {
          item: menuItem,
          title: title,
          panel: panel
      };
      panel.hidden = true;
      rightPanel.append(panel);
      return menuItem;
  });

  // register panel without a menu option
  editor.method('picker:project:registerPanel', function (name, title, panel) {
      // just do the regular registration but hide the menu
      var item = editor.call('picker:project:registerMenu', name, title, panel);
      item.class.add('hidden');
      return item;
  });

  // set default menu option
  editor.method('picker:project:setDefaultMenu', function (name) {
      defaultMenuOption = name;
  });

  // open popup
  editor.method('picker:project', function (option) {
      overlay.hidden = false;
      select(option || defaultMenuOption);
  });

  // close popup
  editor.method('picker:project:close', function () {
      overlay.hidden = true;
  });

  // ESC key should close popup
  var onKeyDown = function (e) {
      if (e.target && /(input)|(textarea)/i.test(e.target.tagName))
          return;

      if (e.keyCode === 27 && overlay.clickable) {
          overlay.hidden = true;
      }
  };

  // handle show
  overlay.on('show', function () {
      window.addEventListener('keydown', onKeyDown);

      projectImg.classList.remove('progress');
      projectImg.style.backgroundImage = 'url("' + (config.project.thumbnails.m || blankImage) + '")';

      if (editor.call('permissions:write')) {
          projectImg.classList.add('hover');
      } else {
          projectImg.classList.remove('hover');
      }

      // editor-blocking picker open
      editor.emit('picker:open', 'project');
  });

  // handle hide
  overlay.on('hide', function () {
      currentSelection = null;

      // unsubscribe from keydown
      window.removeEventListener('keydown', onKeyDown);

      // hide all panels
      for (var key in menuOptions) {
          menuOptions[key].panel.hidden = true;
          menuOptions[key].item.class.remove('active');
          menuOptions[key].item.class.remove('selected');
      }

      // editor-blocking picker closed
      editor.emit('picker:close', 'project');
  });

  // prevent user closing popup
  editor.method('picker:project:setClosable', function (closable) {
      btnClose.hidden = !closable;
      overlay.clickable = closable;
  });

  // disable / enable the state of the left panel
  editor.method('picker:project:toggleLeftPanel', function (enabled) {
      leftPanel.disabled = !enabled;
  });

  // disables / enables a menu option on the left
  editor.method('picker:project:toggleMenu', function (name, enabled) {
      menuOptions[name].item.hidden = ! enabled;
      if (! enabled) {
          menuOptions[name].panel.hidden = true;
      }
  });

  // activate menu option
  var select = function (name) {
      if (! name) return;

      if (currentSelection === name)
          return;

      currentSelection = name;

      // if this is not a scene URL disallow closing the popup
      if (!config.scene.id) {
          editor.call('picker:project:setClosable', false);
      } else {
          // reset closable state
          editor.call('picker:project:setClosable', true);
      }

      // hide all first
      for (var key in menuOptions) {
          menuOptions[key].item.class.remove('active');
          menuOptions[key].panel.hidden = true;
      }

      // show desired option
      menuOptions[name].item.class.add('active');
      menuOptions[name].panel.hidden = false;
      rightPanel.headerElementTitle.textContent = menuOptions[name].title;
      rightPanel.innerElement.scrollTop = 0;
  };

  // subscribe to project image
  editor.on('messenger:project.image', function (data) {
      config.project.thumbnails = data.project.thumbnails;
      projectImg.style.backgroundImage = 'url("' + (data.project.thumbnails && data.project.thumbnails.m || blankImage) + '")';
      projectImg.classList.remove('progress');
  });


});


/* editor/pickers/picker-scene.js */
editor.once('load', function () {
  'use strict';

  var panel = new ui.Panel();
  panel.class.add('picker-scene-panel');

  editor.call('picker:project:registerMenu', 'scenes', 'Scenes', panel);

  // scene should be the default
  editor.call('picker:project:setDefaultMenu', 'scenes');

  if (!editor.call('permissions:write'))
      panel.class.add('disabled');

  // progress bar and loading label
  var loading = new ui.Label({
      text: 'Loading...'
  });
  panel.append(loading);

  var progressBar = new ui.Progress({progress: 1});
  progressBar.hidden = true;
  panel.append(progressBar);

  var container = new ui.List();
  container.class.add('scene-list');
  panel.append(container);
  container.hidden = true;

  var tooltips = [];
  var events = [];
  var scenes = [];

  var toggleProgress = function (toggle) {
      loading.hidden = !toggle;
      progressBar.hidden = !toggle;
      container.hidden = toggle || !scenes.length;
  };

  // dropdown menu for each scene
  var dropdownMenu = ui.Menu.fromData({
      'scene-duplicate': {
          title: 'Duplicate Scene',
          filter: function () {
              return editor.call('permissions:write');
          },
          select: function () {
              var name = dropdownScene.name;
              var regex = /^(.*?) ([0-9]+)$/;
              var numberPart = 2;
              var namePart = dropdownScene.name;
              var matches = dropdownScene.name.match(regex);
              if (matches && matches.length === 3) {
                  namePart = matches[1];
                  numberPart = parseInt(matches[2], 10);
              }

              // create duplicate scene name
              while (true)  {
                  name = namePart + ' ' + numberPart;
                  var found = true;
                  for (var i = 0; i < scenes.length; i++) {
                      if (scenes[i].name === name) {
                          numberPart++;
                          found = false;
                          break;
                      }
                  }

                  if (found)
                      break;
              }

              editor.call('scenes:duplicate', dropdownScene.id, name);
          }
      },
      'scene-delete': {
          title: 'Delete Scene',
          filter: function () {
              return editor.call('permissions:write');
          },
          select: function () {
              editor.call('picker:confirm', 'Are you sure you want to delete this Scene?');
              editor.once('picker:confirm:yes', function () {
                  var id = dropdownScene.id;
                  onSceneDeleted(id);
                  editor.call('scenes:delete', id);
              });
          }
      }
  });

  editor.call('layout.root').append(dropdownMenu);

  var dropdownScene = null;

  // disables / enables field depending on permissions
  var handlePermissions = function (field) {
      field.disabled = ! editor.call('permissions:write');
      return editor.on('permissions:set:' + config.self.id, function (accessLevel) {
          if (accessLevel === 'write' || accessLevel == 'admin') {
              field.disabled = false;
          } else {
              field.disabled = true;
          }
      });
  };

  // on closing menu remove 'clicked' class from respective dropdown
  dropdownMenu.on('open', function (open) {
      if (! open && dropdownScene) {
          var item = document.getElementById('picker-scene-' + dropdownScene.id);
          if (item) {
              var clicked = item.querySelector('.clicked');
              if (clicked) {
                  clicked.classList.remove('clicked');
                  clicked.innerHTML = '&#57689;';
              }
          }
      }
  });

  // new scene button
  var newScene = new ui.Button({
      text: 'Add new Scene'
  });

  handlePermissions(newScene);
  newScene.class.add('new');

  panel.append(newScene);

  newScene.on('click', function () {
      if (! editor.call('permissions:write'))
          return;

      newScene.disabled = true;

      // add list item
      var listItem = new ui.ListItem();
      container.append(listItem);
      container.hidden = false;

      // add label
      var label = new ui.Label({
          text: 'Enter Scene name and press Enter:'
      });
      label.class.add('new-scene-label');
      listItem.element.appendChild(label.element);

      // add new scene input field
      var input = new ui.TextField({
          default: 'Untitled',
          placeholder: 'Enter Scene name and press Enter'
      });

      input.blurOnEnter = false;

      listItem.element.appendChild(input.element);

      input.elementInput.focus();
      input.elementInput.select();

      var destroyField = function () {
          listItem.destroy();
          newScene.disabled = false;
      };

      input.elementInput.addEventListener('blur', destroyField);

      input.elementInput.addEventListener('keydown', function (e) {
          if (e.keyCode === 13) {
               if (! input.value) return;

              editor.call('picker:scene:close');
              editor.call('scenes:new', input.value, function (scene) {
                  editor.call('scene:load', scene.uniqueId, true);
              });
          }
      });
  });

  // on show
  panel.on('show', function () {
      toggleProgress(true);

      // load scenes
      editor.call('scenes:list', function (items) {
          toggleProgress(false);
          scenes = items;
          refreshScenes();
      });

      if (editor.call('viewport:inViewport'))
          editor.emit('viewport:hover', false);
  });

  // on hide
  panel.on('hide', function() {
      destroyTooltips();
      destroyEvents();
      scenes = [];

      // destroy scene items because same row ids
      // might be used by download / new build popups
      container.element.innerHTML = '';

      editor.emit('picker:scene:close');

      if (editor.call('viewport:inViewport'))
          editor.emit('viewport:hover', true);
  });

  editor.on('viewport:hover', function(state) {
      if (state && ! panel.hidden) {
          setTimeout(function() {
              editor.emit('viewport:hover', false);
          }, 0);
      }
  });

  // create row for scene
  var createSceneEntry = function (scene) {
      var row = new ui.ListItem();
      row.element.id = 'picker-scene-' + scene.id;

      container.append(row);

      if (config.scene.id && parseInt(scene.id, 10) === parseInt(config.scene.id, 10))
          row.class.add('current');

      // scene name
      var name = new ui.Label({
          text: scene.name
      });
      name.class.add('name');

      row.element.appendChild(name.element);

      // scene date
      var date = new ui.Label({
          text: editor.call('datetime:convert', scene.modified)
      });
      date.class.add('date');
      row.element.appendChild(date.element);

      // dropdown
      var dropdown = new ui.Button({
          text: '&#57689;'
      });
      dropdown.class.add('dropdown');
      row.element.appendChild(dropdown.element);

      dropdown.on('click', function () {
          dropdown.class.add('clicked');
          dropdown.element.innerHTML = '&#57687;';

          dropdownScene = scene;
          dropdownMenu.open = true;
          var rect = dropdown.element.getBoundingClientRect();
          dropdownMenu.position(rect.right - dropdownMenu.innerElement.clientWidth, rect.bottom);
      });

      if (parseInt(config.scene.id, 10) !== parseInt(scene.id, 10)) {
          events.push(row.on('click', function (e) {
              if (e.target === row.element || e.target === name.element || e.target === date.element) {
                  if (parseInt(config.scene.id, 10) === parseInt(scene.id, 10))
                      return;

                  editor.call('picker:scene:close');
                  editor.call('scene:load', scene.uniqueId);
              }
          }));
      }

      return row;
  };

  var sortScenes = function (scenes) {
      scenes.sort(function (a, b) {
          if (a.modified < b.modified) {
              return 1;
          } else if (a.modified > b.modified) {
              return -1;
          }

          return 0;
      });
  };

  var refreshScenes = function () {
      dropdownMenu.open = false;
      destroyTooltips();
      destroyEvents();
      container.element.innerHTML = '';
      sortScenes(scenes);
      container.hidden = scenes.length === 0;
      scenes.forEach(createSceneEntry);
  };

  // call picker
  editor.method('picker:scene', function() {
      editor.call('picker:project', 'scenes');
  });

  // close picker
  editor.method('picker:scene:close', function() {
      editor.call('picker:project:close');
  });

  var onSceneDeleted = function (sceneId) {
      // if loaded scene deleted do not allow closing popup
      if (!config.scene.id || parseInt(config.scene.id, 10) === parseInt(sceneId, 10)) {
          editor.call('picker:project:setClosable', false);
      }

      if (panel.hidden) return;

      var row = document.getElementById('picker-scene-' + sceneId);
      if (row) {
          row.parentElement.removeChild(row);
      }

      for (var i = 0; i < scenes.length; i++) {
          if (parseInt(scenes[i].id, 10) === parseInt(sceneId, 10)) {
              // close dropdown menu if current scene deleted
              if (dropdownScene === scenes[i])
                  dropdownMenu.open = false;

              scenes.splice(i, 1);
              break;
          }
      }

      if (! scenes.length) {
          container.hidden = true;
      }

  };

  // subscribe to messenger scene.delete
  editor.on('messenger:scene.delete', function (data) {
      if (data.scene.branchId !== config.self.branch.id) return;
      onSceneDeleted(data.scene.id);
  });

  // subscribe to messenger scene.new
  editor.on('messenger:scene.new', function (data) {
      if (panel.hidden) return;
      if (data.scene.branchId !== config.self.branch.id) return;

      editor.call('scenes:get', data.scene.id, function (err, scene) {
          if (panel.hidden) return; // check if hidden when Ajax returns

          scenes.push(scene);

          refreshScenes();
      });
  });

  var destroyTooltips = function () {
      tooltips.forEach(function (tooltip) {
          tooltip.destroy();
      });
      tooltips = [];
  };

  var destroyEvents = function () {
      events.forEach(function (evt) {
          evt.unbind();
      });
      events = [];
  };

});


/* editor/pickers/picker-script-create.js */
editor.once('load', function() {
  'use strict';

  var callback = null;
  var filenameValid = /^([^0-9.#<>$+%!`&='{}@\\/:*?"<>|\n])([^#<>$+%!`&='{}@\\/:*?"<>|\n])*$/i;

  // overlay
  var overlay = new ui.Overlay();
  overlay.class.add('picker-script-create');
  overlay.hidden = true;

  // label
  var label = new ui.Label();
  label.text = 'Enter script filename:';
  label.class.add('text');
  overlay.append(label);

  var input = new ui.TextField();
  input.blurOnEnter = false;
  input.renderChanges = false;
  overlay.append(input);

  var validate = new ui.Label();
  validate.text = 'Invalid filename';
  validate.class.add('validate');
  overlay.append(validate);

  input.element.addEventListener('keydown', function(evt) {
      if (overlay.hidden) return;

      if (evt.keyCode === 13) {
          // enter
          var filename = input.value.trim();
          if (! filename || ! filenameValid.test(filename)) {
              validate.hidden = false;
          } else {
              validate.hidden = true;

              if (! filename.endsWith('.js'))
                  filename += '.js';

              if (callback)
                  callback(filename);

              overlay.hidden = true;
          }
      } else if (evt.keyCode === 27) {
          // esc
          overlay.hidden = true;
      }
  }, false);

  var root = editor.call('layout.root');
  root.append(overlay);


  // on overlay hide
  overlay.on('hide', function() {
      editor.emit('picker:script-create:close');
  });

  editor.method('picker:script-create:validate', function(filename) {
      if (! filename || ! filenameValid.test(filename)) {
          return false;
      } else {
          if (! filename.endsWith('.js'))
              filename += '.js';

          return filename;
      }
  });

  // call picker
  editor.method('picker:script-create', function(fn, string) {
      callback = fn || null;

      // show overlay
      overlay.hidden = false;
      validate.hidden = true;
      input.value = string || '';

      setTimeout(function() {
          input.elementInput.focus();
      }, 100);
  });

  // close picker
  editor.method('picker:script-create:close', function() {
      overlay.hidden = true;
  });
});


/* editor/pickers/picker-builds.js */
editor.once('load', function () {
  'use strict';

  // main panel
  var panel = new ui.Panel();
  panel.class.add('picker-builds');

  // holds events that need to be destroyed
  var events = [];

  var projectSettings = editor.call('settings:project');

  // disables / enables field depending on permissions
  var handlePermissions = function (field) {
      field.disabled = ! editor.call('permissions:write');
      return editor.on('permissions:set:' + config.self.id, function (accessLevel) {
          if (accessLevel === 'write' || accessLevel == 'admin') {
              field.disabled = false;
          } else {
              field.disabled = true;
          }
      });
  };

  // progress bar and loading label
  var loading = new ui.Label({
      text: 'Loading...'
  });
  panel.append(loading);

  var progressBar = new ui.Progress({progress: 1});
  progressBar.hidden = true;
  panel.append(progressBar);

  // no builds message
  var noBuilds = new ui.Label({
      text: 'You have not published any builds. Click PUBLISH to create a new build.'
  });
  noBuilds.hidden = true;
  noBuilds.style.padding = '15px';
  panel.append(noBuilds);

  // published build section
  var publishedBuild = new ui.Label({
      text: 'Your primary build is available at <a href="' + config.project.playUrl + '" target="_blank">' + config.project.playUrl + '</a>.',
      unsafe: true
  });
  publishedBuild.class.add('build');
  panel.append(publishedBuild);

  // container for builds
  var container = new ui.List();
  panel.append(container);

  // app whose dropdown was last clicked
  var dropdownApp = null;

  // all loaded builds
  var apps = [];

  // holds all tooltips
  var tooltips = [];

  var dropdownMenu = ui.Menu.fromData({
      'app-delete': {
          title: 'Delete',
          filter: function () {
              return editor.call('permissions:write');
          },
          select: function () {
              editor.call('picker:confirm', 'Are you sure you want to delete this Build?');
              editor.once('picker:confirm:yes', function () {
                  removeApp(dropdownApp);
                  editor.call('apps:delete', dropdownApp.id);
              });
          }
      }
  });

  // add menu
  editor.call('layout.root').append(dropdownMenu);

  // on closing menu remove 'clicked' class from respective dropdown
  dropdownMenu.on('open', function (open) {
      if (! open && dropdownApp) {
          var item = document.getElementById('app-' + dropdownApp.id);
          if (item) {
              var clicked = item.querySelector('.clicked');
              if (clicked) {
                  clicked.innerHTML = '&#57689;';
                  clicked.classList.remove('clicked');
              }
          }
      }
  });

  // register panel with project popup
  editor.call('picker:project:registerMenu', 'builds', 'Builds', panel);

  // open publishing popup
  editor.method('picker:builds', function () {
      editor.call('picker:project', 'builds');
  });

  var toggleProgress = function (toggle) {
      loading.hidden = !toggle;
      progressBar.hidden = !toggle;
      container.hidden = toggle || apps.length === 0;
      publishedBuild.hidden = toggle || !config.project.primaryApp;
      noBuilds.hidden = toggle || apps.length > 0;
  };

  // load app list
  var loadApps = function () {
      toggleProgress(true);

      editor.call('apps:list', function (results) {
          apps = results;
          toggleProgress(false);
          refreshApps();
      });
  };

  // recreate app list UI
  var refreshApps = function () {
      dropdownMenu.open = false;
      destroyTooltips();
      destroyEvents();
      container.element.innerHTML = '';
      sortApps(apps);
      container.hidden = apps.length === 0;
      apps.forEach(createAppItem);
  };

  var destroyTooltips = function () {
      tooltips.forEach(function (tooltip) {
          tooltip.destroy();
      });
      tooltips = [];
  };

  var destroyEvents = function () {
      events.forEach(function (evt) {
          evt.unbind();
      });
      events = [];
  };

  // sort apps by primary first and then created date
  var sortApps = function (apps) {
      return apps.sort(function (a, b) {
          if (config.project.primaryApp === a.id) {
              return -1;
          } else if (config.project.primaryApp === b.id) {
              return 1;
          } else {
              if (a.created_at < b.created_at) {
                  return 1;
              } else if (a.created_at > b.created_at) {
                  return -1;
              } else {
                  return 0;
              }
          }
      });
  };

  // create UI for single app
  var createAppItem = function (app) {
      var item = new ui.ListItem();
      item.element.id = 'app-' + app.id;

      container.append(item);

      if (config.project.primaryApp === app.id) {
          item.class.add('primary');
      }

      item.class.add(app.task.status);

      // primary app button
      var primary = new ui.Button({
          text: '&#57891'
      });
      events.push(handlePermissions(primary));
      if (! primary.disabled && app.task.status !== 'complete')
          primary.disabled = true;
      primary.class.add('primary');
      item.element.appendChild(primary.element);

      // set primary app
      events.push(primary.on('click', function () {
          if (config.project.primaryApp === app.id || app.task.status !== 'complete')
              return;

          editor.call('project:setPrimaryApp', app.id, null, function () {
              // error - refresh apps again to go back to previous state
              refreshApps();
          });

          // refresh apps instantly
          refreshApps();
      }));

      // primary icon tooltip
      var tooltipText = config.project.primaryApp === app.id ? 'Primary build' : 'Change the projects\'s primary build';
      var tooltip = Tooltip.attach({
          target: primary.element,
          text: tooltipText,
          align: 'right',
          root: editor.call('layout.root')
      });
      tooltips.push(tooltip);

      // status icon or image
      var status = document.createElement('span');
      status.classList.add('status');
      item.element.appendChild(status);

      var img;

      if (app.task.status === 'complete') {
          img = new Image();
          img.src = app.thumbnails ? app.thumbnails.s : (config.project.thumbnails.s || config.url.static + '/platform/images/common/blank_project.png');
          status.appendChild(img);
      } else if (app.task.status === 'running') {
          img = new Image();
          img.src = config.url.static + "/platform/images/common/ajax-loader.gif";
          status.appendChild(img);
      }

      var nameRow = document.createElement('div');
      nameRow.classList.add('name-row');
      item.element.appendChild(nameRow);

      // app name
      var name = new ui.Label({
          text: app.name
      });
      name.class.add('name');
      nameRow.appendChild(name.element);

      // app version
      var version = new ui.Label({
          text: app.version
      });
      version.class.add('version');
      nameRow.appendChild(version.element);

      // row below name
      var info = document.createElement('div');
      info.classList.add('info');
      item.element.appendChild(info);

      // date
      var date = new ui.Label({
          text: editor.call('datetime:convert', app.created_at)
      });
      date.class.add('date');
      date.hidden = app.task.status === 'error';
      info.appendChild(date.element);

      // views
      var views = new ui.Label({
          text: numberWithCommas(app.views)
      });
      views.class.add('views');
      views.hidden = app.task.status !== 'complete';
      info.appendChild(views.element);

      // size
      var size = new ui.Label({
          text: sizeToString(app.size)
      });
      size.hidden = app.task.status !== 'complete';
      size.class.add('size');
      info.appendChild(size.element);

      // branch
      var branch = new ui.Label({
          text: app.branch && app.branch.name || 'master'
      });
      branch.hidden = app.task.status !== 'complete' || projectSettings.get('useLegacyScripts');
      branch.class.add('branch');
      info.appendChild(branch.element);

      // error message
      var error = new ui.Label({
          text: app.task.message
      });
      error.hidden = app.task.status !== 'error';
      error.class.add('error');
      item.element.appendChild(error.element);

      // release notes
      var releaseNotes = app.release_notes || '';
      var indexOfNewLine = releaseNotes.indexOf('\n');
      if (indexOfNewLine !== -1) {
          releaseNotes = releaseNotes.substring(0, indexOfNewLine);
      }
      var notes = new ui.Label({
          text: app.release_notes
      });
      notes.renderChanges = false;
      notes.class.add('notes');
      notes.hidden = !error.hidden;
      item.element.appendChild(notes.element);

      // dropdown
      var dropdown = new ui.Button({
          text: '&#57689;'
      });
      dropdown.class.add('dropdown');
      item.element.appendChild(dropdown.element);

      events.push(dropdown.on('click', function () {
          dropdown.class.add('clicked');
          // change arrow
          dropdown.element.innerHTML = '&#57687;';
          dropdownApp = app;

          // open menu
          dropdownMenu.open = true;

          // position dropdown menu
          var rect = dropdown.element.getBoundingClientRect();
          dropdownMenu.position(rect.right - dropdownMenu.innerElement.clientWidth, rect.bottom);
      }));

      var more = new ui.Button({text: 'more...'});
      more.class.add('more');
      item.element.appendChild(more.element);
      more.hidden = true;

      events.push(more.on('click', function () {
          if (notes.class.contains('no-wrap')) {
              notes.text = app.release_notes;
              notes.class.remove('no-wrap');
              more.text = 'less...';
          } else {
              notes.class.add('no-wrap');
              more.text = 'more...';
              notes.text = releaseNotes;
          }
      }));

      if (notes.element.clientHeight > 22) {
          more.hidden = false;
          notes.class.add('no-wrap');
          notes.text = releaseNotes;
      }

      if (app.task.status === 'complete') {
          // handle row click
          var validTargets = [
              status,
              img,
              info,
              item.element,
              name.element,
              date.element,
              size.element,
              views.element,
              notes.element
          ];

          events.push(item.on('click', function (e) {
              if (validTargets.indexOf(e.target) !== -1) {
                  e.stopPropagation();
                  window.open(app.url);
              }
          }));
      }


      return item;
  };

  // Return the size fixed to 2 digits precision.
  // If the result does not have any decimal points then remove them
  var toFixed = function (size) {
      var result = size.toFixed(2);
      if (result % 1 === 0) {
          result = Math.floor(result);
      }

      return result;
  };

  // convert size in bytes to readable string
  var sizeToString = function (size) {
      var base = 1000;

      if (isNaN(size))
          size = 0;

      if (size < base)
          return size + ' Bytes';

      size /= base;

      if (size < base)
          return toFixed(size) + ' KB';

      size /= base;

      if (size < base)
          return toFixed(size) + ' MB';

      size /= base;

      if (size < base)
          return toFixed(size) + ' GB';

      size /= base;

      return toFixed(size) + ' TB';
  };

  // adds commas every 3 decimals
  var numberWithCommas = function (number) {
      var parts = number.toString().split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return parts.join(".");
  };

  // removes an app from the UI
  var removeApp = function (app) {
      var item = document.getElementById('app-' + app.id);
      if (item) {
          item.remove();
      }

      // remove from apps array
      for (var i = 0; i < apps.length; i++) {
          if (apps[i].id === app.id) {
              // close dropdown menu if current app deleted
              if (dropdownApp === apps[i])
                  dropdownMenu.open = false;

              apps.splice(i, 1);
              break;
          }
      }

      container.hidden = apps.length === 0;
  };

  // handle external updates to primary app
  editor.on('project:primaryApp', function (newValue, oldValue) {
      if (panel.hidden) return;

      if (!newValue) {
          publishedBuild.hidden = true;
          return;
      }

      publishedBuild.hidden = false;

      // check if we need to refresh UI
      var currentPrimary = document.getElementById('app-' + newValue);
      if (currentPrimary && currentPrimary.classList.contains('primary'))
          return;

      refreshApps();
  });

  // handle app created externally
  editor.on('messenger:app.new', function (data) {
      if (panel.hidden) return;

      // get app from server
      editor.call('apps:get', data.app.id, function (app) {
          // add app if it's not already inside the apps array
          var found = false;
          for (var i = 0; i < apps.length; i++) {
              if (apps[i].id === data.app.id) {
                  found = true;
                  break;
              }
          }

          if (! found) {
              apps.push(app);
              refreshApps();
          }
      });
  });

  // handle external delete
  editor.on('messenger:app.delete', function (data) {
      if (panel.hidden) return;

      removeApp(data.app);
  });

  // handle external app updates
  editor.on('messenger:app.update', function (data) {
      if (panel.hidden) return;

      // get app from server
      editor.call('apps:get', data.app.id, function (app) {
          for (var i = 0; i < apps.length; i++) {
              if (apps[i].id === app.id) {
                  apps[i] = app;
              }
          }
          refreshApps();
      });
  });

  // on show
  panel.on('show', function () {
      loadApps();

      if (editor.call('viewport:inViewport'))
          editor.emit('viewport:hover', false);
  });

  // on hide
  panel.on('hide', function () {
      apps = [];
      destroyTooltips();
      destroyEvents();

      if (editor.call('viewport:inViewport'))
          editor.emit('viewport:hover', true);
  });

  editor.on('viewport:hover', function(state) {
      if (state && ! panel.hidden) {
          setTimeout(function() {
              editor.emit('viewport:hover', false);
          }, 0);
      }
  });
});


/* editor/pickers/picker-publish.js */
editor.once('load', function () {
  'use strict';

  // main panel
  var panel = new ui.Panel();
  panel.class.add('picker-publish');
  panel.flex = true;

  // register panel with project popup
  editor.call('picker:project:registerMenu', 'publish', 'Publish', panel);

  // disables / enables field depending on permissions
  var handlePermissions = function (field) {
      field.disabled = ! editor.call('permissions:write');
      return editor.on('permissions:set:' + config.self.id, function (accessLevel) {
          if (accessLevel === 'write' || accessLevel == 'admin') {
              field.disabled = false;
          } else {
              field.disabled = true;
          }
      });
  };

  // open publishing popup
  editor.method('picker:publish', function () {
      editor.call('picker:project', 'publish');
  });


  // playcanv.as
  var panelPlaycanvas = new ui.Panel();
  panelPlaycanvas.flex = true;
  panelPlaycanvas.class.add('buttons');
  panel.append(panelPlaycanvas);

  var labelIcon = new ui.Label({
      text: '&#57960;',
      unsafe: true
  });
  labelIcon.class.add('icon');
  panelPlaycanvas.append(labelIcon);

  var labelDesc = new ui.Label({
      text: 'Publish your project publicly on PlayCanvas.'
  });
  labelDesc.class.add('desc');
  panelPlaycanvas.append(labelDesc);

  // publish button
  var btnPublish = new ui.Button({text: 'Publish To PlayCanvas'});
  btnPublish.class.add('publish');
  handlePermissions(btnPublish);
  panelPlaycanvas.append(btnPublish);

  panelPlaycanvas.on('click', function () {
      editor.call('picker:publish:new');
  });

  // self host
  var panelSelfHost = new ui.Panel();
  panelSelfHost.flex = true;
  panelSelfHost.class.add('buttons');
  panel.append(panelSelfHost);

  labelIcon = new ui.Label({
      text: '&#57925;',
      unsafe: true
  });
  labelIcon.class.add('icon');
  panelSelfHost.append(labelIcon);

  labelDesc = new ui.Label({
      text: 'Download build and host it on your own server.'
  });
  labelDesc.class.add('desc');
  panelSelfHost.append(labelDesc);

  // download button
  var btnDownload = new ui.Button({text: 'Download .zip'});
  btnDownload.class.add('download');
  handlePermissions(btnDownload);
  panelSelfHost.append(btnDownload);

  panelSelfHost.on('click', function () {
      editor.call('picker:publish:download');
  });

  // on show
  panel.on('show', function () {
      editor.emit('picker:publish:open');

      if (editor.call('viewport:inViewport'))
          editor.emit('viewport:hover', false);
  });

  // on hide
  panel.on('hide', function () {
      editor.emit('picker:publish:close');

      if (editor.call('viewport:inViewport'))
          editor.emit('viewport:hover', true);
  });

  editor.on('viewport:hover', function(state) {
      if (state && ! panel.hidden) {
          setTimeout(function() {
              editor.emit('viewport:hover', false);
          }, 0);
      }
  });
});


/* editor/pickers/picker-publish-new.js */
editor.once('load', function () {
  'use strict';

  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');

  // holds all tooltips
  var tooltips = [];

  // holds events that need to be destroyed
  var events = [];

  // main panel
  var panel = new ui.Panel();
  panel.class.add('picker-publish-new');

  // register panel with project popup
  editor.call('picker:project:registerPanel', 'publish-download', 'Download New Build', panel);
  editor.call('picker:project:registerPanel', 'publish-new', 'Publish New Build', panel);

  var mode = 'publish';

  var primaryScene = null;

  editor.method('picker:publish:new', function () {
      mode = 'publish';
      editor.call('picker:project', 'publish-new');
      panel.class.remove('download-mode');
      panel.class.remove('upgrade');
  });

  editor.method('picker:publish:download', function () {
      mode = 'download';
      editor.call('picker:project', 'publish-download');
      panel.class.add('download-mode');

      if (config.owner.plan.type === 'free') {
          panel.class.add('upgrade');
      } else {
          panel.class.remove('upgrade');
      }
  });

  // upgrade notice
  var labelUpgrade = new ui.Label({
      text: 'This is a premium feature. <a href="/upgrade?account=' + config.owner.username + '" target="_blank">UPGRADE</a> to be able to download your project.',
      unsafe: true
  });
  labelUpgrade.class.add('upgrade');
  panel.append(labelUpgrade);

  // info panel
  var panelInfo = new ui.Panel();
  panelInfo.class.add('info');
  panel.append(panelInfo);

  // image
  var imageField = document.createElement('div');
  imageField.classList.add('image');
  panelInfo.append(imageField);

  var blankImage = config.url.static + '/platform/images/common/blank_project.png';

  var clearAppImage = function () {
      imageField.classList.remove('progress');
      if (config.project.thumbnails.m) {
          imageField.classList.remove('blank');
          imageField.style.backgroundImage = 'url("' + config.project.thumbnails.m + '")';
      } else {
          imageField.classList.add('blank');
          imageField.style.backgroundImage = 'url("' + blankImage + '")';
      }
  };

  var setAppImage = function (url) {
      imageField.classList.remove('progress');
      imageField.classList.remove('blank');
      imageField.style.backgroundImage = 'url("' + url + '")';
  };

  clearAppImage();

  // hidden file picker used to upload image
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';

  imageField.addEventListener('click', function () {
      if (! editor.call('permissions:write'))
          return;

      fileInput.click();
  });

  var imageS3Key = null;
  var isUploadingImage = false;

  fileInput.addEventListener('change', function () {
      if (isUploadingImage)
          return;

      isUploadingImage = true;
      refreshButtonsState();

      imageField.classList.remove('blank');
      imageField.classList.add('progress');
      imageField.style.backgroundImage = 'url("' + config.url.static + '/platform/images/common/ajax-loader.gif")';

      var file = fileInput.files[0];
      fileInput.value = null;

      editor.call('images:upload', file, function (data) {
          imageS3Key = data.s3Key;
          isUploadingImage = false;
          refreshButtonsState();

          setAppImage(data.url);
      }, function (status, data) {
          // error
          isUploadingImage = false;
          refreshButtonsState();

          clearAppImage();
      });
  });

  var group = document.createElement('span');
  panelInfo.append(group);

  // name
  var label = new ui.Label({text: 'Title'});
  label.class.add('field-label');
  group.appendChild(label.element);

  var inputNameError = new ui.Label({
      text: 'Cannot exceed 1000 characters'
  });
  inputNameError.class.add('error');
  inputNameError.hidden = true;
  group.appendChild(inputNameError.element);

  var inputName = new ui.TextField();
  inputName.renderChanges = false;
  inputName.placeholder = 'Required';
  inputName.class.add('name');
  inputName.class.add('input-field');
  group.appendChild(inputName.element);

  inputName.elementInput.addEventListener('keyup', function (e) {
      inputNameError.hidden = inputName.elementInput.value.length <= 1000;
      refreshButtonsState();
  });

  label = new ui.Label({text: 'Click on the image to upload artwork. 720 x 720px'});
  label.class.add('image-click');
  group.appendChild(label.element);

  // description
  var panelDescription = new ui.Panel();
  panelDescription.class.add('description');
  panel.append(panelDescription);

  label = new ui.Label({text: 'Description'});
  label.class.add('field-label');
  panelDescription.append(label);

  var inputDescError = new ui.Label({
      text: 'Cannot exceed 10000 characters'
  });
  inputDescError.class.add('error');
  inputDescError.hidden = true;
  panelDescription.append(inputDescError);

  var inputDescription = document.createElement('textarea');
  inputDescription.addEventListener('keyup', function (e) {
      if (e.keyCode === 27) {
          inputDescription.blur();
      }

      inputDescError.hidden = inputDescription.value.length < 10000;
      refreshButtonsState();
  });
  panelDescription.append(inputDescription);

  // version
  var panelVersion = new ui.Panel();
  panelVersion.class.add('version');
  panel.append(panelVersion);

  label = new ui.Label({text: 'Version'});
  label.class.add('field-label');
  panelVersion.append(label);

  var inputVersionError = new ui.Label({
      text: 'Cannot exceed 20 characters'
  });
  inputVersionError.class.add('error');
  inputVersionError.hidden = true;
  panelVersion.append(inputVersionError);

  var inputVersion = new ui.TextField();
  inputVersion.renderChanges = false;
  inputVersion.class.add('input-field');
  inputVersion.placeholder = 'e.g. 1.0.0';
  panelVersion.append(inputVersion);

  inputVersion.elementInput.addEventListener('keyup', function (e) {
      inputVersionError.hidden = inputVersion.value.length <= 20;
      refreshButtonsState();
  });

  // release notes
  var panelNotes = new ui.Panel();
  panelNotes.class.add('notes');
  panel.append(panelNotes);

  var label = new ui.Label({text: 'Release Notes'});
  label.class.add('field-label');
  panelNotes.append(label);

  var inputNotesError = new ui.Label({
      text: 'Cannot exceed 10000 characters'
  });
  inputNotesError.class.add('error');
  inputNotesError.hidden = true;
  panelNotes.append(inputNotesError);

  var inputNotes = document.createElement('textarea');
  panelNotes.append(inputNotes);
  inputNotes.addEventListener('keyup', function (e) {
      if (e.keyCode === 27) {
          inputNotes.blur();
      }

      inputNotesError.hidden = inputNotes.value.length <= 10000;
      refreshButtonsState();
  });


  if (! legacyScripts) {
      // options
      var panelOptions = new ui.Panel();
      panelOptions.class.add('options');
      panel.append(panelOptions);

      label = new ui.Label({text: 'Options'});
      label.class.add('field-label');
      panelOptions.append(label);

      // concatenate scripts
      var panelOptionsConcat = new ui.Panel();
      panelOptionsConcat.class.add('field');
      panelOptions.append(panelOptionsConcat);
      var fieldOptionsConcat = new ui.Checkbox();
      fieldOptionsConcat.value = true;
      fieldOptionsConcat.class.add('tick');
      panelOptionsConcat.append(fieldOptionsConcat);
      var label = new ui.Label({ text: 'Concatenate Scripts' });
      panelOptionsConcat.append(label);

      // create preload bundle
      if (editor.call('users:hasFlag', 'hasPreloadBundling')) {
          var panelOptionsPreload = new ui.Panel();
          panelOptionsPreload.class.add('field');
          panelOptions.append(panelOptionsPreload);
          var fieldOptionsPreload = new ui.Checkbox();
          fieldOptionsPreload.value = true;
          fieldOptionsPreload.class.add('tick');
          panelOptionsPreload.append(fieldOptionsPreload);
          var labelPreload = new ui.Label({ text: 'Create Preload Bundles' });
          panelOptionsPreload.append(labelPreload);
      }
  }


  // scenes
  var panelScenes = new ui.Panel();
  panelScenes.class.add('scenes');
  panel.append(panelScenes);

  label = new ui.Label({text: 'Choose Scenes'});
  panelScenes.append(label);

  var selectAll = new ui.Checkbox();
  selectAll.class.add('tick');
  panelScenes.append(selectAll);

  label = new ui.Label({text: 'Select all'});
  panelScenes.append(label);
  label.class.add('select-all');

  // scenes container
  var container = new ui.List();
  container.class.add('scene-list');
  panelScenes.append(container);

  var panelNoScenes = new ui.Panel();
  panelNoScenes.class.add('scenes');
  panel.append(panelNoScenes);

  // no scenes msg
  var labelNoScenes = new ui.Label({text: 'There are no scenes.'});
  labelNoScenes.class.add('error');
  labelNoScenes.hidden = true;
  panelNoScenes.append(labelNoScenes);

  // loading scenes
  var loadingScenes = new ui.Label({
      text: 'Loading scenes...'
  });
  panelNoScenes.append(loadingScenes);

  var progressBar = new ui.Progress({progress: 1});
  progressBar.hidden = false;
  panelNoScenes.append(progressBar);

  // holds all scenes
  var scenes = [];

  // returns a list of the selected scenes
  // with the primary scene first
  var getSelectedScenes = function () {
      var result = [];

      var listItems = container.innerElement.childNodes;
      for (var i = 0; i < listItems.length; i++) {
          if (listItems[i].ui.isSelected()) {
              result.push(listItems[i].ui.sceneId);
          }
      }

      // put primary scene first
      result.sort(function (a, b) {
          if (a === primaryScene) return -1;
          if (b === primaryScene) return 1;
          return 0;
      });

      return result;
  };

  var jobInProgress = false;

  // publish button
  var btnPublish = new ui.Button({
      text: 'Publish Now'
  });
  btnPublish.class.add('publish');
  panel.append(btnPublish);

  btnPublish.on('click', function () {
      if (jobInProgress)
          return;

      jobInProgress = true;

      refreshButtonsState();

      var data = {
          name: inputName.value,
          project_id: config.project.id,
          branch_id: config.self.branch.id,
          scenes: getSelectedScenes()
      };

      if (inputDescription.value)
          data.description = inputDescription.value;

      if (inputVersion.value)
          data.version = inputVersion.value;

      if (inputNotes.value)
          data.release_notes = inputNotes.value;

      if (imageS3Key)
          data.image_s3_key = imageS3Key;

      if (fieldOptionsConcat)
          data.scripts_concatenate = fieldOptionsConcat.value;

      if (fieldOptionsPreload)
          data.preload_bundle = fieldOptionsPreload.value;

      editor.call('apps:new', data, function () {
          jobInProgress = false;
          editor.call('picker:builds');
      }, function (status) {
          jobInProgress = false;
          editor.call('status:error', 'Error while publishing: ' + status);
          editor.call('picker:builds');
      });
  });

  // web download button
  var btnWebDownload = new ui.Button({
      text: 'Web Download'
  });
  btnWebDownload.class.add('web-download');
  panel.append(btnWebDownload);

  var urlToDownload = null;

  // download app for specified target (web or ios)
  var download = function (target) {
      jobInProgress = true;

      refreshButtonsState();

      // post data
      var data = {
          name: inputName.value,
          project_id: config.project.id,
          branch_id: config.self.branch.id,
          scenes: getSelectedScenes(),
          target: target,
          scripts_concatenate: fieldOptionsConcat ? fieldOptionsConcat.value : false,
          preload_bundle: fieldOptionsPreload ? fieldOptionsPreload.value : false
      };

      // ajax call
      editor.call('apps:download', data, function (job) {
          // show download progress
          panelDownloadProgress.hidden = false;
          btnDownloadReady.hidden = true;
          downloadProgressIconWrapper.classList.remove('success');
          downloadProgressIconWrapper.classList.remove('error');

          downloadProgressTitle.class.remove('error');
          downloadProgressTitle.text = 'Preparing build...';

          // when job is updated get the job and
          // proceed depending on job status
          var evt = editor.on('messenger:job.update', function (msg) {
              if (msg.job.id === job.id) {
                  evt.unbind();

                  // get job
                  Ajax({
                      url: '{{url.api}}/jobs/' + job.id,
                      auth: true
                  })
                  .on('load', function (status, data) {
                      var job = data;
                      // success ?
                      if (job.status === 'complete') {
                          downloadProgressIconWrapper.classList.add('success');
                          downloadProgressTitle.text = 'Your build is ready';
                          urlToDownload = job.data.download_url;
                          btnDownloadReady.hidden = false;
                          jobInProgress = false;

                          refreshButtonsState();
                      }
                      // handle error
                      else if (job.status === 'error') {
                          downloadProgressIconWrapper.classList.add('error');
                          downloadProgressTitle.class.add('error');
                          downloadProgressTitle.text = job.messages[0];
                          jobInProgress = false;

                          refreshButtonsState();
                      }
                  }).on('error', function () {
                      // error
                      downloadProgressIconWrapper.classList.add('error');
                      downloadProgressTitle.class.add('error');
                      downloadProgressTitle.text = 'Error: Could not start download';
                      jobInProgress = false;

                      refreshButtonsState();
                  });
              }
          });
          events.push(evt);
      }, function () {
          jobInProgress = false;

          refreshButtonsState();

          // error
          console.error(arguments);
      });
  };

  btnWebDownload.on('click', function () {
      if (jobInProgress)
          return;

      download('web');
  });

  // ios download button
  var btnIosDownload = new ui.Button({
      text: 'iOS Download'
  });
  btnIosDownload.class.add('ios-download');
  panel.append(btnIosDownload);

  btnIosDownload.on('click', function () {
      if (jobInProgress)
          return;

      if (config.owner.plan.type !== 'org' && config.owner.plan.type !== 'organization') {
          editor.call('picker:confirm', 'You need an Organization account to be able to download for iOS. Would you like to upgrade?', function () {
              window.open('/upgrade');
          });

          return;
      }
      download('ios');
  });

  // download progress
  var panelDownloadProgress = document.createElement('div');
  panelDownloadProgress.classList.add('progress');
  panelDownloadProgress.classList.add('download');
  panel.append(panelDownloadProgress);

  // icon
  var downloadProgressIconWrapper = document.createElement('span');
  downloadProgressIconWrapper.classList.add('icon');
  panelDownloadProgress.appendChild(downloadProgressIconWrapper);

  var downloadProgressImg = new Image();
  downloadProgressIconWrapper.appendChild(downloadProgressImg);
  downloadProgressImg.src = config.url.static + "/platform/images/common/ajax-loader.gif";

  // progress info
  var downloadProgressInfo = document.createElement('span');
  downloadProgressInfo.classList.add('progress-info');
  panelDownloadProgress.appendChild(downloadProgressInfo);

  var downloadProgressTitle = new ui.Label({text: 'Preparing build'});
  downloadProgressTitle.renderChanges = false;
  downloadProgressTitle.class.add('progress-title');
  downloadProgressInfo.appendChild(downloadProgressTitle.element);

  var btnDownloadReady = new ui.Button({text: 'Download'});
  btnDownloadReady.class.add('ready');
  downloadProgressInfo.appendChild(btnDownloadReady.element);

  btnDownloadReady.on('click', function () {
      if (urlToDownload) {
          window.open(urlToDownload);
      }

      editor.call('picker:publish');
  });

  var refreshButtonsState = function () {
      var selectedScenes = getSelectedScenes();
      var disabled = !inputName.value ||
                     !selectedScenes.length ||
                     inputName.value.length > 1000 ||
                     inputDescription.value.length > 10000 ||
                     inputNotes.value.length > 10000 ||
                     inputVersion.value.length > 20 ||
                     isUploadingImage ||
                     jobInProgress;

      btnPublish.disabled = disabled;
      btnWebDownload.disabled = disabled;
      btnIosDownload.disabled = disabled;
  };

  var createSceneItem = function (scene) {
      var row = new ui.ListItem();
      row.element.id = 'picker-scene-' + scene.id;
      row.sceneId = scene.id;

      container.append(row);

      if (config.scene.id && parseInt(scene.id, 10) === parseInt(config.scene.id, 10))
          row.class.add('current');

      if (scene.id === primaryScene) {
          row.class.add('primary');
      }
      // primary scene icon
      var primary = new ui.Button({
          text: '&#57891'
      });
      primary.class.add('primary');
      row.element.appendChild(primary.element);

      primary.on('click', function () {
          if (!editor.call('permissions:write'))
              return;

          primaryScene = scene.id;
          refreshScenes();
      });

      // show tooltip for primary scene icon
      var tooltipText = scene.id === primaryScene ? 'Primary Scene' : 'Set Primary Scene';
      var tooltip = Tooltip.attach({
          target: primary.element,
          text: tooltipText,
          align: 'right',
          root: editor.call('layout.root')
      });
      tooltips.push(tooltip);

      // scene name
      var name = new ui.Label({
          text: scene.name
      });
      name.class.add('name');

      row.element.appendChild(name.element);

      // scene date
      var date = new ui.Label({
          text: editor.call('datetime:convert', scene.modified)
      });
      date.class.add('date');
      row.element.appendChild(date.element);

      // selection
      var select = new ui.Checkbox();
      select.class.add('tick');
      row.element.appendChild(select.element);

      // if selectAll changes then change this too
      events.push(selectAll.on('change', function (value) {
          select.value = value;
      }));

      // handle checkbox tick
      select.on('change', refreshButtonsState);

      row.select = function () {
          select.value = true;
      };
      row.isSelected = function () {
          return select.value;
      };

      return row;
  };

  var destroyTooltips = function () {
      tooltips.forEach(function (tooltip) {
          tooltip.destroy();
      });
      tooltips = [];
  };

  var destroyEvents = function () {
      events.forEach(function (evt) {
          evt.unbind();
      });

      events = [];
  };

  // handle permission changes
  editor.on('permissions:set:' + config.self.id, function (accessLevel) {
      if (accessLevel === 'write' || accessLevel === 'admin') {
          panel.class.remove('disabled');
      } else {
          panel.class.add('disabled');
      }
  });

  var sortScenes = function (scenes) {
      scenes.sort(function (a, b) {
          if (primaryScene === a.id) {
              return -1;
          } else if (primaryScene === b.id) {
              return 1;
          }

          if (a.modified < b.modified) {
              return 1;
          } else if (a.modified > b.modified) {
              return -1;
          }

          return 0;
      });
  };

  var refreshScenes = function () {
      var content = document.querySelector('.ui-panel.right > .content');
      var scrollTop = content.scrollTop;

      var selectedScenes = getSelectedScenes();

      destroyTooltips();
      destroyEvents();
      container.element.innerHTML = '';
      sortScenes(scenes);
      panelScenes.hidden = !scenes.length;
      panelNoScenes.hidden = !panelScenes.hidden;
      labelNoScenes.hidden = scenes.length;
      loadingScenes.hidden = true;
      progressBar.hidden = true;
      refreshButtonsState();

      // keep previous scene selection or
      // if no scene is selected then select
      // the primary scene
      scenes.forEach(function (scene) {
          var item = createSceneItem(scene);
          if (selectedScenes.indexOf(scene.id) !== -1 || selectedScenes.length === 0 && scene.id === primaryScene) {
              item.select();
          }
      });

      content.scrollTop = scrollTop;
  };

  // on show
  panel.on('show', function () {
      panelDownloadProgress.hidden = true;
      panelNoScenes.hidden = false;
      labelNoScenes.hidden = true;
      loadingScenes.hidden = false;
      progressBar.hidden = false;
      container.element.innerHTML = '';
      inputName.value = config.project.name;
      inputDescription.value = config.project.description;
      inputVersion.value = '';
      inputNotes.value = '';
      imageS3Key = null;
      if (config.project.thumbnails.xl) {
          imageS3Key = config.project.thumbnails.xl.substring(config.url.images.length + 1);
      }

      clearAppImage();

      selectAll.value = false;

      var loadedApps = mode !== 'publish';
      var loadedScenes = false;

      editor.call('scenes:list', function (items) {
          loadedScenes = true;

          scenes = items;
          // select primary scene
          if (! primaryScene && items[0]) {
              primaryScene = items[0].id;
          }

          if (loadedApps) {
              refreshScenes();
          }
      });

      if (! loadedApps) {
          editor.call('apps:list', function (apps) {
              loadedApps = true;

              var version = 'e.g. 1.0.0';

              if (apps.length) {
                  apps.sort(function (a, b) {
                      if (a.id === config.project.primaryApp)
                          return -1;
                      if (b.id === config.project.primaryApp)
                          return 1;
                      if (b.modified_at < a.modified_at)
                          return -1;
                      else if (a.modified_at > b.modified_at)
                          return 1;

                      return 0;
                  });

                  if (apps[0].version) {
                      version = 'Previous version: ' + apps[0].version;
                  }
              }

              inputVersion.placeholder = version;

              if (loadedScenes)
                  refreshScenes();
          });
      }


      inputName.elementInput.focus();

      if (editor.call('viewport:inViewport'))
          editor.emit('viewport:hover', false);
  });

  // on hide
  panel.on('hide', function () {
      scenes = [];
      primaryScene = null;
      imageS3Key = null;
      isUploadingImage = false;
      urlToDownload = null;
      jobInProgress = false;
      destroyTooltips();
      destroyEvents();

      if (editor.call('viewport:inViewport'))
          editor.emit('viewport:hover', true);
  });

  editor.on('viewport:hover', function(state) {
      if (state && ! panel.hidden) {
          setTimeout(function() {
              editor.emit('viewport:hover', false);
          }, 0);
      }
  });

  // subscribe to messenger scene.delete
  editor.on('messenger:scene.delete', function (data) {
      if (panel.hidden) return;
      if (data.scene.branchId !== config.self.branch.id) return;

      var sceneId = parseInt(data.scene.id, 10);

      var row = document.getElementById('picker-scene-' + sceneId);
      if (row) {
          row.remove();
      }

      for (var i = 0; i < scenes.length; i++) {
          if (parseInt(scenes[i].id, 10) === sceneId) {
              scenes.splice(i, 1);
              break;
          }
      }

      if (! scenes.length) {
          panelScenes.hidden = true;
          panelNoScenes.hidden = false;
          refreshButtonsState();
      }
  });

  // subscribe to messenger scene.new
  editor.on('messenger:scene.new', function (data) {
      if (panel.hidden) return;
      if (data.scene.branchId !== config.self.branch.id) return;

      editor.call('scenes:get', data.scene.id, function (err, scene) {
          if (panel.hidden) return; // check if hidden when Ajax returns

          scenes.push(scene);

          refreshScenes();
      });
  });

});


/* editor/pickers/picker-gradient.js */

// helpers

function Helpers() { }

Object.assign(Helpers, {
  rgbaStr : function(colour, scale) {
      if (!scale) { scale = 1; }
      var rgba = colour.map(function(element, index) {
          return index < 3 ? Math.round(element * scale) : element;
      } ).join(',');
      for (var i=colour.length; i<4; ++i) {
          rgba += ',' + (i < 3 ? scale : 1);
      }
      return 'rgba(' + rgba + ')';
  },

  hexStr : function(clr) {
      return clr.map(function(v) {
          return ('00' + v.toString(16)).slice(-2).toUpperCase();
      }).join('');
  },

  // rgb(a) -> hsva
  toHsva : function(rgba) {
      var hsva = rgb2hsv(rgba.map(function(v) { return v * 255; }));
      hsva.push(rgba.length > 3 ? rgba[3] : 1);
      return hsva;
  },

  // hsv(1) -> rgba
  toRgba : function(hsva) {
      var rgba = hsv2rgb(hsva).map(function(v) { return v / 255; });
      rgba.push(hsva.length > 3 ? hsva[3] : 1);
      return rgba;
  },

  // calculate the normalized coordinate [x,y] relative to rect
  normalizedCoord : function(widget, x, y) {
      var rect = widget.element.getBoundingClientRect();
      return [(x - rect.left) / rect.width,
              (y - rect.top) / rect.height];
  },
});

// color picker

function ColorPicker(parent) {
  Events.call(this);

  // capture this for the event handler
  function genEvtHandler(self, func) {
      return function(evt) {
          func.apply(self, [evt]);
      }
  };

  // pixel scale
  var ps = window.devicePixelRatio;

  this.panel = new ui.Panel();
  this.panel.class.add('color-panel')
  parent.appendChild(this.panel.element);

  this.colorRect = new ui.Canvas();
  this.colorRect.class.add('color-rect');
  this.panel.append(this.colorRect.element);
  this.colorRect.resize(this.colorRect.element.clientWidth * ps,
                        this.colorRect.element.clientHeight * ps);

  this.colorHandle = document.createElement('div');
  this.colorHandle.classList.add('color-handle');
  this.panel.append(this.colorHandle);

  this.hueRect = new ui.Canvas();
  this.hueRect.class.add('hue-rect');
  this.panel.append(this.hueRect.element);
  this.hueRect.resize(this.hueRect.element.clientWidth * ps,
                      this.hueRect.element.clientHeight * ps);

  this.hueHandle = document.createElement('div');
  this.hueHandle.classList.add('hue-handle');
  this.panel.append(this.hueHandle);

  this.alphaRect = new ui.Canvas();
  this.alphaRect.class.add('alpha-rect');
  this.panel.append(this.alphaRect.element);
  this.alphaRect.resize(this.alphaRect.element.clientWidth * ps,
                        this.alphaRect.element.clientHeight * ps);

  this.alphaHandle = document.createElement('div');
  this.alphaHandle.classList.add('alpha-handle');
  this.panel.append(this.alphaHandle);

  this.fields = document.createElement('div');
  this.fields.classList.add('fields');
  this.panel.append(this.fields);

  this.fieldChangeHandler = genEvtHandler(this, this._onFieldChanged);
  this.hexChangeHandler = genEvtHandler(this, this._onHexChanged);
  this.downHandler = genEvtHandler(this, this._onMouseDown);
  this.moveHandler = genEvtHandler(this, this._onMouseMove);
  this.upHandler = genEvtHandler(this, this._onMouseUp);

  function numberField(label) {
      var field = new ui.NumberField({
          precision : 1,
          step : 1,
          min : 0,
          max : 255
      });
      field.renderChanges = false;
      field.placeholder = label;
      field.on('change', this.fieldChangeHandler);
      this.fields.appendChild(field.element);
      return field;
  };

  this.rField = numberField.call(this, 'r');
  this.gField = numberField.call(this, 'g');
  this.bField = numberField.call(this, 'b');
  this.aField = numberField.call(this, 'a');

  this.hexField = new ui.TextField({});
  this.hexField.renderChanges = false;
  this.hexField.placeholder = '#';
  this.hexField.on('change', this.hexChangeHandler);
  this.fields.appendChild(this.hexField.element);

  // hook up mouse handlers
  this.colorRect.element.addEventListener('mousedown', this.downHandler);
  this.hueRect.element.addEventListener('mousedown', this.downHandler);
  this.alphaRect.element.addEventListener('mousedown', this.downHandler);

  this._generateHue(this.hueRect);
  this._generateAlpha(this.alphaRect);

  this._hsva = [-1, -1, -1, 1];
  this._storeHsva = [0, 0, 0, 1];
  this._dragMode = 0;
  this._changing = false;
};

ColorPicker.prototype = {
  _generateHue : function (canvas) {
      var ctx = canvas.element.getContext('2d');
      var w = canvas.element.width;
      var h = canvas.element.height;
      var gradient = ctx.createLinearGradient(0, 0, 0, h);
      for (var t=0; t<=6; t+=1) {
          gradient.addColorStop(t / 6, Helpers.rgbaStr(hsv2rgb([t / 6, 1, 1])));
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
  },

  _generateAlpha : function (canvas) {
      var ctx = canvas.element.getContext('2d');
      var w = canvas.element.width;
      var h = canvas.element.height;
      var gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, 'rgb(255, 255, 255)');
      gradient.addColorStop(1, 'rgb(0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
  },

  _generateGradient : function (canvas, clr) {
      var ctx = canvas.element.getContext('2d');
      var w = canvas.element.width;
      var h = canvas.element.height;

      var gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, Helpers.rgbaStr([255, 255, 255, 255]));
      gradient.addColorStop(1, Helpers.rgbaStr([clr[0], clr[1], clr[2], 255]));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 255)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
  },

  _onFieldChanged : function() {
      if (!this._changing) {
          var rgba = [this.rField.value,
                      this.gField.value,
                      this.bField.value,
                      this.aField.value].map(function (v) { return v / 255; });
          this.hsva = Helpers.toHsva(rgba);
          this.emit('change', this.color);
      }
  },

  _onHexChanged : function() {
      if (!this._changing) {
          var hex = this.hexField.value.trim().toLowerCase();
          if (/^([0-9a-f]{2}){3,4}$/.test(hex)) {
              var rgb = [ parseInt(hex.substring(0, 2), 16),
                          parseInt(hex.substring(2, 4), 16),
                          parseInt(hex.substring(4, 6), 16) ];
              this.hsva = rgb2hsv(rgb).concat([this.hsva[3]]);
              this.emit('change', this.color);
          }
      }
  },

  _onMouseDown : function(evt) {
      if (evt.currentTarget === this.colorRect.element) {
          this._dragMode = 1;     // drag color
      } else if (evt.currentTarget === this.hueRect.element) {
          this._dragMode = 2;     // drag hue
      } else {
          this._dragMode = 3;     // drag alpha
      }

      this._storeHsva = this._hsva.slice();
      this._onMouseMove(evt);

      // hook up mouse
      window.addEventListener('mousemove', this.moveHandler);
      window.addEventListener('mouseup', this.upHandler);
  },

  _onMouseMove : function(evt) {
      var newhsva;
      if (this._dragMode === 1) {
          var m = Helpers.normalizedCoord(this.colorRect, evt.pageX, evt.pageY);
          var s = pc.math.clamp(m[0], 0, 1);
          var v = pc.math.clamp(m[1], 0, 1);
          newhsva = [this.hsva[0], s, 1 - v, this._hsva[3]];
      } else if (this._dragMode === 2) {
          var m = Helpers.normalizedCoord(this.hueRect, evt.pageX, evt.pageY);
          var h = pc.math.clamp(m[1], 0, 1);
          newhsva = [h, this.hsva[1], this.hsva[2], this.hsva[3]];
      } else {
          var m = Helpers.normalizedCoord(this.alphaRect, evt.pageX, evt.pageY);
          var a = pc.math.clamp(m[1], 0, 1);
          newhsva = [this.hsva[0], this.hsva[1], this.hsva[2], 1 - a];
      }
      if (newhsva[0] !== this._hsva[0] ||
          newhsva[1] !== this._hsva[1] ||
          newhsva[2] !== this._hsva[2] ||
          newhsva[3] !== this._hsva[3]) {
          this.hsva = newhsva;
          this.emit('changing', this.color);
      }
  },

  _onMouseUp : function(evt) {
      window.removeEventListener('mousemove', this.moveHandler);
      window.removeEventListener('mouseup', this.upHandler);

      if (this._storeHsva[0] !== this._hsva[0] ||
          this._storeHsva[1] !== this._hsva[1] ||
          this._storeHsva[2] !== this._hsva[2] ||
          this._storeHsva[3] !== this._hsva[3]) {
              this.emit('change', this.color);
      }
  },

  __proto__ : Events.prototype,
};

Object.defineProperty(ColorPicker.prototype, 'hsva', {
  get: function() {
      return this._hsva;
  },
  set: function(hsva) {
      var rgb = hsv2rgb(hsva);
      var hueRgb = hsv2rgb([hsva[0], 1, 1]);

      // regenerate gradient canvas if hue changes
      if (hsva[0] !== this._hsva[0]) {
          this._generateGradient(this.colorRect, hueRgb);
      }

      var e = this.colorRect.element;
      var r = e.getBoundingClientRect();
      var w = r.width - 2;
      var h = r.height - 2;

      this.colorHandle.style.backgroundColor = Helpers.rgbaStr(rgb);
      this.colorHandle.style.left = e.offsetLeft - 7 + Math.floor(w * hsva[1]) + 'px';
      this.colorHandle.style.top = e.offsetTop - 7 + Math.floor(h * (1 - hsva[2])) + 'px';

      this.hueHandle.style.backgroundColor = Helpers.rgbaStr(hueRgb);
      this.hueHandle.style.top = e.offsetTop - 3 + Math.floor(140 * hsva[0]) + 'px';
      this.hueHandle.style.left = '162px';

      this.alphaHandle.style.backgroundColor = Helpers.rgbaStr(hsv2rgb([0, 0, hsva[3]]));
      this.alphaHandle.style.top = e.offsetTop - 3 + Math.floor(140 * (1 - hsva[3]))  + 'px';
      this.alphaHandle.style.left = '194px';

      this._changing = true;
      this.rField.value = rgb[0];
      this.gField.value = rgb[1];
      this.bField.value = rgb[2];
      this.aField.value = Math.round(hsva[3] * 255);
      this.hexField.value = Helpers.hexStr(rgb);
      this._changing = false;

      this._hsva = hsva;
  }
});

Object.defineProperty(ColorPicker.prototype, 'color', {
  get: function() {
      return Helpers.toRgba(this._hsva);
  },
  set: function(clr) {
      var hsva = Helpers.toHsva(clr);
      if (hsva[0] === 0 && hsva[1] === 0 && this._hsva[0] !== -1) {
          // if the incoming RGB is a shade of grey (without hue),
          // use the current active hue instead.
          hsva[0] = this._hsva[0];
      }
      this.hsva = hsva;
  },
});

Object.defineProperty(ColorPicker.prototype, 'editAlpha', {
  set: function(editAlpha) {
      if (editAlpha) {
          this.alphaRect.element.style.display = 'inline';
          this.alphaHandle.style.display = 'block';
          this.aField.element.style.display = 'inline-block';
      } else {
          this.alphaRect.element.style.display = 'none';
          this.alphaHandle.style.display = 'none';
          this.aField.element.style.display = 'none';
      }
  }
});

// gradient picker

editor.once('load', function() {
  'use strict';

  // open the picker
  function open() {
      UI.overlay.hidden = false;
  }

  // close the picker
  function close() {
      UI.overlay.hidden = true;
  }

  // handle the picker being opened
  function onOpen() {
      window.addEventListener('mousemove', anchorsOnMouseMove);
      window.addEventListener('mouseup', anchorsOnMouseUp);
      UI.anchors.element.addEventListener('mousedown', anchorsOnMouseDown);
      editor.emit('picker:gradient:open');
      editor.emit('picker:open', 'gradient');
  };

  // handle the picker being closed
  function onClose() {
      STATE.hoveredAnchor = -1;
      window.removeEventListener('mousemove', anchorsOnMouseMove);
      window.removeEventListener('mouseup', anchorsOnMouseUp);
      UI.anchors.element.removeEventListener('mousedown', anchorsOnMouseDown);
      editor.emit('picker:gradient:close');
      editor.emit('picker:close', 'gradient');
  };

  function onDeleteKey() {
      if (!UI.overlay.hidden) {
          if (STATE.selectedAnchor !== -1) {
              var deleteTime = STATE.anchors[STATE.selectedAnchor];
              STATE.selectedAnchor = -1;
              deleteAnchor(deleteTime);
          }
      }
  };

  function onTypeChanged(value) {
      value = STATE.typeMap[value];
      var paths = [];
      var values = [];
      for (var i=0; i<STATE.curves.length; ++i) {
          paths.push(i.toString() + '.type');
          values.push(value);
      }
      editor.emit('picker:curve:change', paths, values);
  };

  function render() {
      renderGradient();
      renderAnchors();
  };

  function renderGradient() {
      var ctx = UI.gradient.element.getContext('2d');
      var w = UI.gradient.width;
      var h = UI.gradient.height;

      var s = STATE;

      // fill background
      ctx.fillStyle = UI.checkerPattern;
      ctx.fillRect(0, 0, w, h);

      // fill gradient
      var gradient = ctx.createLinearGradient(0, 0, w, 0);
      for (var t=0; t<=w; t+=2) {

          var x = t / w;
          gradient.addColorStop(x, Helpers.rgbaStr(evaluateGradient(x), 255));
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // render the tip of the selected anchor
      if (STATE.selectedAnchor !== -1) {
          var toDevice = function(value) {
              return value * window.devicePixelRatio;
          }

          var time = STATE.anchors[STATE.selectedAnchor];
          var coords = [time * w, h];

          ctx.beginPath();
          ctx.rect(coords[0] - toDevice(2),
                   coords[1],
                   toDevice(4),
                   toDevice(-6));
          ctx.fillStyle = 'rgb(255, 255, 255)';
          ctx.fill();

          ctx.beginPath();
          ctx.rect(coords[0] - toDevice(1),
                   coords[1],
                   toDevice(2),
                   toDevice(-6));
          ctx.fillStyle = 'rgb(0, 0, 0)';
          ctx.fill();
      }
  };

  function renderAnchors() {
      var ctx = UI.anchors.element.getContext('2d');
      var w = UI.anchors.width;
      var h = UI.anchors.height;

      ctx.fillStyle = CONST.bg;
      ctx.fillRect(0, 0, w, h);

      // render plain anchors
      for (var index=0; index<STATE.anchors.length; ++index) {

          if (index !== STATE.hoveredAnchor &&
              index !== STATE.selectedAnchor) {
              renderAnchor(ctx, STATE.anchors[index]);
          }
      }

      if ((STATE.hoveredAnchor !== -1) &&
          (STATE.hoveredAnchor !== STATE.selectedAnchor)) {
          renderAnchor(ctx, STATE.anchors[STATE.hoveredAnchor], "hovered");
      }

      if (STATE.selectedAnchor !== -1) {
          renderAnchor(ctx, STATE.anchors[STATE.selectedAnchor], "selected");
      }
  };

  function renderAnchor(ctx, time, type) {
      var coords = [time * UI.anchors.width, UI.anchors.height / 2];
      var radius = (type === "selected" ? CONST.selectedRadius : CONST.anchorRadius);
      var lineWidth = ctx.lineWidth;

      // html element px units are virtual pixel units. this maps html pixel units to
      // physical device pixel units
      var toDevice = function(value) {
          return value * window.devicePixelRatio;
      }

      // render selected arrow
      if (type === "selected") {
          ctx.beginPath();
          ctx.rect(coords[0] - toDevice(2),
                   coords[1],
                   toDevice(4),
                   toDevice(-coords[1]));
          ctx.fillStyle = 'rgb(255, 255, 255)';
          ctx.fill();

          ctx.beginPath();
          ctx.rect(coords[0] - toDevice(1),
                   coords[1],
                   toDevice(2),
                   toDevice(-coords[1]));
          ctx.fillStyle = 'rgb(0, 0, 0)';
          ctx.fill();
      }

      // render selection highlight
      if (type === "selected" || type === "hovered") {
          ctx.beginPath();
          ctx.arc(coords[0], coords[1], toDevice(radius + 2), 0, 2 * Math.PI, false);
          ctx.fillStyle = 'rgb(255, 255, 255)';
          ctx.fill();
      }

      // render the colour circle and border
      ctx.beginPath();
      ctx.arc(coords[0], coords[1], toDevice(radius + 1), 0, 2 * Math.PI, false);
      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(coords[0], coords[1], toDevice(radius), 0, 2 * Math.PI, false);
      ctx.fillStyle = Helpers.rgbaStr(evaluateGradient(time, 1), 255);
      ctx.fill();
  };

  function evaluateGradient(time, alphaOverride) {
      var result = [];
      for (var i=0; i<3; ++i)
      {
          result.push(STATE.curves[i].value(time));
      }

      if (alphaOverride) {
          result.push(alphaOverride);
      } else if (STATE.curves.length > 3) {
          result.push(STATE.curves[3].value(time));
      } else {
          result.push(1);
      }

      return result;
  };

  function calcAnchorTimes() {
      // get curve anchor points
      var times = [ ];
      for (var i=0; i<STATE.curves.length; i++) {
          var curve = STATE.curves[i];
          for (var j=0; j<curve.keys.length; ++j) {
              times.push(curve.keys[j][0]);
          }
      }

      // sort anchors and remove duplicates
      times.sort();
      times = times.filter(function(item, pos, ary) { return !pos || item != ary[pos-1]; });

      return times;
  };

  // helper function for calculating the normalized coordinate
  // x,y relative to rect
  function calcNormalizedCoord(x, y, rect) {
      return [(x - rect.left) / rect.width,
              (y - rect.top) / rect.height];
  }

  // get the bounding client rect minus padding
  function getClientRect(element) {
      var styles = window.getComputedStyle(element);

      var paddingTop = parseFloat(styles.paddingTop);
      var paddingRight = parseFloat(styles.paddingRight);
      var paddingBottom = parseFloat(styles.paddingBottom);
      var paddingLeft = parseFloat(styles.paddingLeft);

      var rect = element.getBoundingClientRect();

      return new DOMRect(rect.x + paddingLeft,
                         rect.y + paddingTop,
                         rect.width - paddingRight - paddingLeft,
                         rect.height - paddingTop - paddingBottom);
  }

  function anchorsOnMouseDown(e) {
      if (STATE.hoveredAnchor === -1) {
          // user clicked in empty space, create new anchor and select it
          var coord = calcNormalizedCoord(e.clientX,
                                          e.clientY,
                                          getClientRect(UI.anchors.element));
          insertAnchor(coord[0], evaluateGradient(coord[0]));
          selectAnchor(STATE.anchors.indexOf(coord[0]));
      } else if (STATE.hoveredAnchor !== STATE.selectedAnchor) {
          // select the hovered anchor
          selectAnchor(STATE.hoveredAnchor);
      }

      // drag the selected anchor
      dragStart();
      UI.draggingAnchor = true;
  };

  function anchorsOnMouseMove(e) {
      var coord = calcNormalizedCoord(e.clientX,
                                      e.clientY,
                                      getClientRect(UI.anchors.element));

      if (UI.draggingAnchor) {
          dragUpdate(pc.math.clamp(coord[0], 0, 1));
      } else if (coord[0] >= 0 &&
                 coord[0] <= 1 &&
                 coord[1] >= 0 &&
                 coord[1] <= 1) {
          var closest = -1;
          var closestDist = 0;
          for (var index=0; index<STATE.anchors.length; ++index) {
              var dist = Math.abs(STATE.anchors[index] - coord[0]);
              if (closest === -1 || dist < closestDist) {
                  closest = index;
                  closestDist = dist;
              }
          }

          var hoveredAnchor = (closest !== -1 && closestDist < 0.02) ? closest : -1;
          if (hoveredAnchor != STATE.hoveredAnchor) {
              selectHovered(hoveredAnchor);
              render();
          }
      } else if (STATE.hoveredAnchor !== -1) {
          selectHovered(-1);
          render();
      }
  };

  function anchorsOnMouseUp(e) {
      if (UI.draggingAnchor) {
          dragEnd();
          UI.draggingAnchor = false;
      }
  }

  function selectHovered(index) {
      STATE.hoveredAnchor = index;
      UI.anchors.element.style.cursor = (index === -1 ? '' : 'pointer');
  }

  function selectAnchor(index) {
      STATE.selectedAnchor = index;
      STATE.changing = true;
      if (index === -1) {
          UI.positionEdit.value = "";
          UI.colorPicker.color = [0, 0, 0];
      } else {
          var time = STATE.anchors[index];
          UI.positionEdit.value = Math.round(time * 100);
          STATE.selectedValue = evaluateGradient(time);
          UI.colorPicker.color = STATE.selectedValue;
      }
      STATE.changing = false;
      render();
  };

  function dragStart() {
      if (STATE.selectedAnchor === -1) {
          return;
      }
      var time = STATE.anchors[STATE.selectedAnchor];
      // make a copy of the curve data before editing starts
      STATE.keystore = [];
      for (var i=0; i<STATE.curves.length; ++i) {
          var keys = [];
          STATE.curves[i].keys.forEach(function(element) {
              if (element[0] !== time) {
                  keys.push([ element[0], element[1] ] );
              }
          } );
          STATE.keystore.push(keys);
      }
  }

  function dragUpdate(time) {
      if (STATE.selectedAnchor === -1) {
          return;
      }
      for (var i=0; i<STATE.curves.length; ++i) {
          var curve = STATE.curves[i];
          var keystore = STATE.keystore[i];

          // merge keystore with the drag anchor (ignoring existing anchors at
          // the current anchor location)
          curve.keys = keystore.map(function (element) { return [ element[0], element[1] ]; } )
                               .filter(function (element) { return element[0] !== time; });
          curve.keys.push([time, STATE.selectedValue[i]]);
          curve.sort();
      }

      STATE.anchors = calcAnchorTimes();
      selectAnchor(STATE.anchors.indexOf(time));
  }

  function dragEnd() {
      if (STATE.selectedAnchor !== -1) {
          emitCurveChange();
      }
  }

  // insert an anchor at the given time with the given color
  function insertAnchor(time, color) {
      for (var i=0; i<STATE.curves.length; ++i) {
          var keys = STATE.curves[i].keys;

          var j=0;
          while (j<keys.length) {
              if (keys[j][0] >= time) {
                  break;
              }
              ++j;
          }

          if (j < keys.length && keys[j][0] === time) {
              keys[j][1] = color[i];
          } else {
              keys.splice(j, 0, [time, color[i]]);
          }
      }
      emitCurveChange();
  }

  // delete the anchor(s) at the given time
  function deleteAnchor(time) {
      for (var i=0; i<STATE.curves.length; ++i) {
          var curve = STATE.curves[i];

          for (var j=0; j<curve.keys.length; ++j) {
              if (curve.keys[j][0] === time) {
                  curve.keys.splice(j, 1);
                  break;
              }
          }
      }
      selectHovered(-1);
      emitCurveChange();
  }

  function moveSelectedAnchor(time) {
      if (STATE.selectedAnchor !== -1) {
          dragStart();
          dragUpdate(time);
          dragEnd();
      }
  };

  function colorSelectedAnchor(clr, dragging) {
      if (STATE.selectedAnchor !== -1) {
          var time = STATE.anchors[STATE.selectedAnchor];

          for (var i=0; i<STATE.curves.length; ++i) {
              var curve = STATE.curves[i];

              for (var j=0; j<curve.keys.length; ++j) {
                  if (curve.keys[j][0] === time) {
                      curve.keys[j][1] = clr[i];
                      break;
                  }
              }
          }
          STATE.selectedValue = clr;
          if (dragging) {
              render();
          } else {
              emitCurveChange();
          }
      }
  }

  function emitCurveChange() {
      var paths = [];
      var values = [];
      STATE.curves.forEach(function(curve, index) {
          paths.push('0.keys.' + index);
          var keys = [];
          curve.keys.forEach(function(key) {
              keys.push(key[0], key[1]);
          });
          values.push(keys);
      });
      editor.emit('picker:curve:change', paths, values);
  };

  function doCopy() {
      var data = {
          type: STATE.curves[0].type,
          keys: STATE.curves.map(function(c) {
              return [].concat.apply([], c.keys);
          })
      };
      editor.call('localStorage:set', 'playcanvas_editor_clipboard_gradient', data);
  };

  function doPaste() {
      var data = editor.call('localStorage:get', 'playcanvas_editor_clipboard_gradient');
      if (data) {
          // only paste the number of curves we're currently editing
          var pasteData = {
              type: data.type,
              keys: [],
          };

          for (var index=0; index<STATE.curves.length; ++index) {
              if (index < data.keys.length) {
                  pasteData.keys.push(data.keys[index]);
              } else {
                  pasteData.keys.push([].concat.apply([], STATE.curves[index].keys));
              }
          }

          setValue([pasteData]);
          emitCurveChange();
      }
  };

  function createCheckerPattern() {
      var canvas = new ui.Canvas();
      canvas.width = 16;
      canvas.height = 16;
      var ctx = canvas.element.getContext('2d');
      ctx.fillStyle = "#949a9c";
      ctx.fillRect(0,0,8,8);
      ctx.fillRect(8,8,8,8);
      ctx.fillStyle = "#657375";
      ctx.fillRect(8,0,8,8);
      ctx.fillRect(0,8,8,8);
      return ctx.createPattern(canvas.element, 'repeat');
  }

  function setValue(value, args) {
      // sanity checks mostly for script 'curve' attributes
      if (!(value instanceof Array) ||
          value.length !== 1 ||
          value[0].keys == undefined ||
          (value[0].keys.length !== 3 && value[0].keys.length !== 4))
          return;

      // store the curve type
      var comboItems = {
          0: 'Step',
          1: 'Linear',
          2: 'Spline',
      };
      STATE.typeMap = {
          0: CURVE_STEP,
          1: CURVE_LINEAR,
          2: CURVE_SPLINE
      };
      // check if curve is using a legacy curve type
      if (value[0].type !== CURVE_STEP &&
          value[0].type !== CURVE_LINEAR &&
          value[0].type !== CURVE_SPLINE) {
          comboItems[3] = 'Legacy';
          STATE.typeMap[3] = value[0].type;
      }
      UI.typeCombo._updateOptions(comboItems);
      UI.typeCombo.value = { 0:1, 1:3, 2:3, 3:3, 4:2, 5:0 }[value[0].type];

      // store the curves
      STATE.curves = [];
      value[0].keys.forEach(function (keys) {
          var curve = new pc.Curve(keys);
          curve.type = value[0].type;
          STATE.curves.push(curve);
      });

      // calculate the anchor times
      STATE.anchors = calcAnchorTimes();

      // select the anchor
      if (STATE.anchors.length === 0) {
          selectAnchor(-1);
      } else {
          selectAnchor(pc.math.clamp(STATE.selectedAnchor, 0, STATE.anchors.length - 1));
      }

      UI.colorPicker.editAlpha = STATE.curves.length > 3;
  };

  // constants
  var CONST = {
      bg: '#2c393c',
      anchorRadius : 5,
      selectedRadius : 7,
  };

  // ui widgets
  var UI = {
      root : editor.call('layout.root'),
      overlay : new ui.Overlay(),
      panel : document.createElement('div'),
      gradient : new ui.Canvas(),
      checkerPattern : createCheckerPattern(),
      anchors : new ui.Canvas(),
      footer : new ui.Panel(),
      typeLabel : new ui.Label( { text : 'Type' }),
      typeCombo : new ui.SelectField({
          options : { 0: 'placeholder' },
          type : 'number'
      }),
      positionLabel : new ui.Label( { text : 'Position' }),
      positionEdit : new ui.NumberField( { min : 0, max : 100, step : 1 } ),
      copyButton : new ui.Button({ text: '&#58193' }),
      pasteButton : new ui.Button({ text: '&#58184' }),
      colorPicker : null,
  };

  // current state
  var STATE = {
      curves : [],            // holds all the gradient curves (either 3 or 4 of them)
      keystore : [],          // holds the curve during edit
      anchors : [],           // holds the times of the anchors
      hoveredAnchor : -1,     // index of the hovered anchor
      selectedAnchor : -1,    // index of selected anchor
      selectedValue : [],     // value being dragged
      changing : false,       // UI is currently changing
      draggingAnchor : false,
      typeMap : { },          // map from curve type dropdown to engine curve enum
  };

  // initialize overlay
  UI.root.append(UI.overlay);
  UI.overlay.class.add('picker-gradient');
  UI.overlay.center = false;
  UI.overlay.transparent = true;
  UI.overlay.hidden = true;

  UI.overlay.on('show', function () {
      onOpen();
  });

  UI.overlay.on('hide', function () {
      onClose();
  });

  // panel
  UI.panel.classList.add('picker-gradient-panel');
  UI.overlay.append(UI.panel);

  // gradient
  UI.panel.appendChild(UI.gradient.element);
  UI.gradient.class.add('picker-gradient-gradient');
  var r = getClientRect(UI.gradient.element);
  UI.gradient.resize(r.width * window.devicePixelRatio,
                     r.height * window.devicePixelRatio);

  // anchors
  UI.panel.appendChild(UI.anchors.element);
  UI.anchors.class.add('picker-gradient-anchors');
  r = getClientRect(UI.anchors.element);
  UI.anchors.resize(r.width * window.devicePixelRatio,
                    r.height * window.devicePixelRatio);

  // footer
  UI.panel.appendChild(UI.footer.element);
  UI.footer.append(UI.typeLabel);
  UI.footer.class.add('picker-gradient-footer');

  UI.footer.append(UI.typeCombo);
  UI.typeCombo.value = 1;
  UI.typeCombo.on('change', onTypeChanged);

  UI.footer.append(UI.positionLabel);

  UI.footer.append(UI.positionEdit);
  UI.positionEdit.style.width = '40px';
  UI.positionEdit.renderChanges = false;
  UI.positionEdit.on('change', function(value) { if (!STATE.changing) { moveSelectedAnchor(value/100); } } );

  UI.copyButton.on('click', doCopy);
  UI.footer.append(UI.copyButton);
  Tooltip.attach({
      target: UI.copyButton.element,
      text: 'Copy',
      align: 'bottom',
      root: UI.root
  });

  UI.pasteButton.on('click', doPaste);
  UI.footer.append(UI.pasteButton);
  Tooltip.attach({
      target: UI.pasteButton.element,
      text: 'Paste',
      align: 'bottom',
      root: UI.root
  });

  // construct the color picker
  UI.colorPicker = new ColorPicker(UI.panel);
  UI.colorPicker.on('change', colorSelectedAnchor);
  UI.colorPicker.on('changing', function(color) {
      colorSelectedAnchor(color, true);
  });

  // esc to close
  editor.call('hotkey:register', 'picker:gradient:close', {
      key: 'esc',
      callback: close
  });

  editor.call('hotkey:register', 'gradient-anchor:delete', {
      key: 'delete',
      callback: onDeleteKey
  });

  editor.call('hotkey:register', 'gradient-anchor:delete', {
      key: 'backspace',
      ctrl: true,
      callback: onDeleteKey
  });

  // show the gradient picker
  editor.method('picker:gradient', function (value, args) {
      setValue(value, args);
      open();
  });

  editor.method('picker:gradient:set', function(value, args) {
      setValue(value, args);
  });

  editor.method('picker:gradient:rect', function () {
      return UI.overlay.rect;
  });

  editor.method('picker:gradient:position', function(x, y) {
      if (y + UI.panel.clientHeight > window.innerHeight) {
          y = window.innerHeight - UI.panel.clientHeight;
      }
      UI.overlay.position(x, y);
  });
});


/* editor/pickers/version-control/picker-version-control-svg.js */
editor.once('load', function () {
  'use strict';

  // spinner svg
  editor.method('picker:versioncontrol:svg:spinner', function (size) {
      var spinner = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      spinner.classList.add('spin');
      spinner.setAttribute('width', size);
      spinner.setAttribute('height', size);
      spinner.setAttribute('x', 0);
      spinner.setAttribute('y', 0);
      spinner.setAttribute('viewBox', '0 0 64 64');
      spinner.innerHTML = '<g width="65" height="65"><path fill="#773417" d="M32,60 C47.463973,60 60,47.463973 60,32 C60,16.536027 47.463973,4 32,4 C16.536027,4 4,16.536027 4,32 C4,47.463973 16.536027,60 32,60 Z M32,64 C14.326888,64 0,49.673112 0,32 C0,14.326888 14.326888,0 32,0 C49.673112,0 64,14.326888 64,32 C64,49.673112 49.673112,64 32,64 Z"></path><path class="spin" fill="#FF6600" d="M62.3041668,42.3124142 C58.1809687,54.9535127 46.0037894,64 32,64 L32,60.0514995 C44.0345452,60.0514995 54.8533306,51.9951081 58.5660922,41.0051114 L62.3041668,42.3124142 Z"></path></g>';
      return spinner;
  });

  // completed svg
  editor.method('picker:versioncontrol:svg:completed', function (size) {
      var completed = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      completed.setAttribute('width', size);
      completed.setAttribute('height', size);
      completed.setAttribute('x', 0);
      completed.setAttribute('y', 0);
      completed.setAttribute('viewBox', '0 0 65 65');
      completed.innerHTML = '<defs><path id="playcanvas-spinner-complete-a" d="M55.6576027,9.34239734 C58.6394896,12.564759 60.9420008,16.1598026 62.5652053,20.127636 C64.1884099,24.0954693 65,28.2195494 65,32.5 C65,36.7804506 64.1884099,40.9045307 62.5652053,44.872364 C60.9420008,48.8401974 58.6394896,52.435241 55.6576027,55.6576027 C52.435241,58.6394896 48.8401974,60.9420008 44.872364,62.5652053 C40.9045307,64.1884099 36.7804506,65 32.5,65 C28.2195494,65 24.0954693,64.1884099 20.127636,62.5652053 C16.1598026,60.9420008 12.564759,58.6394896 9.34239734,55.6576027 C6.28836801,52.483336 3.96782148,48.9183513 2.38068812,44.9625416 C0.793554772,41.006732 0,36.852593 0,32.5 C0,28.147407 0.793554772,23.993268 2.38068812,20.0374584 C3.96782148,16.0816487 6.28836801,12.516664 9.34239734,9.34239734 C12.564759,6.36051043 16.1598026,4.05799924 20.127636,2.43479467 C24.0954693,0.811590108 28.2195494,0 32.5,0 C36.7804506,0 40.9045307,0.811590108 44.872364,2.43479467 C48.8401974,4.05799924 52.435241,6.36051043 55.6576027,9.34239734 Z M32.5,61.953125 C37.8388067,61.953125 42.7668619,60.6376936 47.2843137,58.0067913 C51.8017655,55.3758889 55.3758889,51.8017655 58.0067913,47.2843137 C60.6376936,42.7668619 61.953125,37.8388067 61.953125,32.5 C61.953125,27.1611933 60.6376936,22.2331381 58.0067913,17.7156863 C55.3758889,13.1982345 51.8017655,9.62411106 47.2843137,6.99320874 C42.7668619,4.36230643 37.8388067,3.046875 32.5,3.046875 C27.1611933,3.046875 22.2331381,4.36230643 17.7156863,6.99320874 C13.1982345,9.62411106 9.62411106,13.1982345 6.99320874,17.7156863 C4.36230643,22.2331381 3.046875,27.1611933 3.046875,32.5 C3.046875,37.8388067 4.36230643,42.7668619 6.99320874,47.2843137 C9.62411106,51.8017655 13.1982345,55.3758889 17.7156863,58.0067913 C22.2331381,60.6376936 27.1611933,61.953125 32.5,61.953125 Z M47.7580466,26.5843507 L28.063263,46.0627081 L16.0155383,33.9789123 L19.1424459,30.8520047 L28.063263,39.7728219 L44.3786418,23.4574431 L47.7580466,26.5843507 Z"/></defs><g fill="none" fill-rule="evenodd"><use fill="#F60" xlink:href="#playcanvas-spinner-complete-a"/></g>';
      return completed;
  });

  // error svg
  editor.method('picker:versioncontrol:svg:error', function (size) {
      var error = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      error.setAttribute('width', size);
      error.setAttribute('height', size);
      error.setAttribute('x', 0);
      error.setAttribute('y', 0);
      error.setAttribute('viewBox', '0 0 65 65');
      error.innerHTML = '<defs><path id="playcanvas-spinner-error-a" d="M55.6576027,9.34239734 C58.6394896,12.564759 60.9420008,16.1598026 62.5652053,20.127636 C64.1884099,24.0954693 65,28.2195494 65,32.5 C65,36.7804506 64.1884099,40.9045307 62.5652053,44.872364 C60.9420008,48.8401974 58.6394896,52.435241 55.6576027,55.6576027 C52.435241,58.6394896 48.8401974,60.9420008 44.872364,62.5652053 C40.9045307,64.1884099 36.7804506,65 32.5,65 C28.2195494,65 24.0954693,64.1884099 20.127636,62.5652053 C16.1598026,60.9420008 12.564759,58.6394896 9.34239734,55.6576027 C6.28836801,52.483336 3.96782148,48.9183513 2.38068812,44.9625416 C0.793554772,41.006732 0,36.852593 0,32.5 C0,28.147407 0.793554772,23.993268 2.38068812,20.0374584 C3.96782148,16.0816487 6.28836801,12.516664 9.34239734,9.34239734 C12.564759,6.36051043 16.1598026,4.05799924 20.127636,2.43479467 C24.0954693,0.811590108 28.2195494,0 32.5,0 C36.7804506,0 40.9045307,0.811590108 44.872364,2.43479467 C48.8401974,4.05799924 52.435241,6.36051043 55.6576027,9.34239734 Z M32.5,61.953125 C37.8388067,61.953125 42.7668619,60.6376936 47.2843137,58.0067913 C51.8017655,55.3758889 55.3758889,51.8017655 58.0067913,47.2843137 C60.6376936,42.7668619 61.953125,37.8388067 61.953125,32.5 C61.953125,27.1611933 60.6376936,22.2331381 58.0067913,17.7156863 C55.3758889,13.1982345 51.8017655,9.62411106 47.2843137,6.99320874 C42.7668619,4.36230643 37.8388067,3.046875 32.5,3.046875 C27.1611933,3.046875 22.2331381,4.36230643 17.7156863,6.99320874 C13.1982345,9.62411106 9.62411106,13.1982345 6.99320874,17.7156863 C4.36230643,22.2331381 3.046875,27.1611933 3.046875,32.5 C3.046875,37.8388067 4.36230643,42.7668619 6.99320874,47.2843137 C9.62411106,51.8017655 13.1982345,55.3758889 17.7156863,58.0067913 C22.2331381,60.6376936 27.1611933,61.953125 32.5,61.953125 Z M35.5816525,32.2391268 L43.7840074,40.4684849 L40.6947836,43.605265 L32.3920037,35.3937245 L24.0892238,43.605265 L21,40.4684849 L29.2023549,32.2391268 L21,24.1269076 L24.3794048,21 L32.3920037,29.0389773 L40.4046026,21 L43.7840074,24.1269076 L35.5816525,32.2391268 Z"/></defs><g fill="none" fill-rule="evenodd"><use fill="#fb222f" xlink:href="#playcanvas-spinner-error-a"/></g>';
      return error;
  });
});


/* editor/pickers/version-control/picker-version-control-common.js */
"use strict";

/**
* Represents a box widget that is commonly used in version control side panels
* @param {Object} args Various options for the widget
* @param {String} [args.header] The box title
* @param {String} [args.headerNote] The text of the note next to the header
* @param {Boolean} [args.discardChanges] If true then this box will also contain a panel to discard un-checkpointed changes
* @param {String} [args.discardChangesHelp] The text of the help tooltip in the discard changes panel
* @param {Boolean} [args.noIcon] If true the box header will not have a top left icon
*/
var VersionControlSidePanelBox = function (args) {
  Events.call(this);

  // main box panel
  this.panel = new ui.Panel(args && args.header || ' ');
  this.panel.headerElementTitle.classList.add('selectable');

  if (args && args.noIcon) {
      this.panel.class.add('no-icon');
  }

  var panel = this.panel;
  panel.flexGrow = 1;
  panel.class.add('version-control-side-panel-box');

  // holds child panels appended to the box with the `append` method
  this.children = [];

  // add little note on the right of the header
  if (args && args.headerNote) {
      var labelHeader = new ui.Label({
          text: args.headerNote
      });
      labelHeader.class.add('header-note');
      panel.headerElement.appendChild(labelHeader.element);
  }

  // add discard your changes panel
  if (args && args.discardChanges) {
      var panelDiscard = new ui.Panel();
      this.panelDiscard = panelDiscard;
      panelDiscard.class.add('discard');
      panelDiscard.flexGrow = 1;
      var label = new ui.Label({
          text: 'Discard un-checkpointed changes?'
      });
      panelDiscard.append(label);

      var checkboxDiscardChanges = new ui.Checkbox();
      this.checkboxDiscardChanges = checkboxDiscardChanges;
      checkboxDiscardChanges.class.add('tick');
      panelDiscard.append(checkboxDiscardChanges);

      checkboxDiscardChanges.on('change', function (value) {
          this.emit('discardChanges', value);
      }.bind(this));

      // add little help icon
      var labelDiscardHelp = new ui.Label({
          text: '&#57656;',
          unsafe: true
      });
      labelDiscardHelp.class.add('help');
      panelDiscard.append(labelDiscardHelp);

      if (args.discardChangesHelp) {
          var tooltip = Tooltip.attach({
              target: labelDiscardHelp.element,
              text: args.discardChangesHelp,
              align: 'top',
              root: editor.call('layout.root')
          });
          tooltip.class.add('discard-changes-tooltip');
      }
  }
};

VersionControlSidePanelBox.prototype = Object.create(Events.prototype);

/**
* Adds specified panel to the box
* @param {ui.Panel} panel The panel
*/
VersionControlSidePanelBox.prototype.append = function (panel) {
  // make sure we remove the discard panel first
  // because it's meant to be added to the end
  if (this.panelDiscard) {
      this.panel.remove(this.panelDiscard);
  }

  this.panel.append(panel);
  this.children.push(panel);

  // add discard panel after the content
  if (this.panelDiscard) {
      this.panel.append(this.panelDiscard);
  }
};

/**
* Creates a panel to show info for the specified checkpoint and adds this panel to the box
* @param {Object} checkpoint The checkpoint
*/
VersionControlSidePanelBox.prototype.setCheckpoint = function (checkpoint) {
  // create panel to show checkpoint info
  var panel = editor.call('picker:versioncontrol:widget:checkpoint', checkpoint);
  this.append(panel);

  // this needs to be called to update the 'read more' button
  panel.onAddedToDom();
};

/**
* Clears the contents of the box
*/
VersionControlSidePanelBox.prototype.clear = function () {
  var panel = this.panel;

  if (this.panelDiscard) {
      panel.remove(this.panelDiscard);
      this.checkboxDiscardChanges.value = false;
  }

  this.children.forEach(function (child) {
      child.destroy();
  });
};

/**
* Gets / sets the header text of the box
*/
Object.defineProperty(VersionControlSidePanelBox.prototype, 'header', {
  get: function () {
      return this.panel.header;
  },
  set: function (value) {
      this.panel.header = value;
  }
});

window.ui.VersionControlSidePanelBox = VersionControlSidePanelBox;


/* editor/pickers/version-control/picker-version-control-side-panel.js */
editor.once('load', function () {
  'use strict';

  var sidePanelIndex = 1;

  editor.method('picker:versioncontrol:createSidePanel', function (args) {
      var panel = new ui.Panel();
      panel.class.add('side-panel-widget');

      var panelTop = new ui.Panel();
      panelTop.class.add('top');
      panel.append(panelTop);

      var labelTitle = new ui.Label({
          text: args.title || ''
      });
      labelTitle.renderChanges = false;
      labelTitle.class.add('title', 'selectable');
      panelTop.append(labelTitle);

      var labelNote = new ui.Label({
          text: args.note || ''
      });
      labelNote.renderChanges = false;
      labelNote.class.add('note', 'selectable');
      panelTop.append(labelNote);

      var panelMain;
      if (args.mainContents) {
          panelMain = new ui.Panel();
          panel.append(panelMain);
          panelMain.class.add('main');
          panelMain.flex = true;

          for (var i = 0; i < args.mainContents.length; i++) {
              panelMain.append(args.mainContents[i]);
          }
      }

      var panelButtons = new ui.Panel();
      panelButtons.class.add('buttons');
      panel.append(panelButtons);

      var getButtonOption = function (button, name) {
          return args.buttons && args.buttons[button] && args.buttons[button][name];
      };

      var btnConfirm = new ui.Button({
          text: getButtonOption('confirm', 'text') || 'Confirm'
      });
      if (getButtonOption('confirm', 'highlighted')) {
          btnConfirm.class.add('highlighted');
      }
      panelButtons.append(btnConfirm);

      btnConfirm.on('click', function () {
          var onClick = getButtonOption('confirm', 'onClick');
          if (onClick) {
              onClick();
          } else {
              panel.emit('confirm');
          }
      });

      var btnCancel = new ui.Button({
          text: getButtonOption('cancel', 'text') || 'Cancel'
      });
      if (getButtonOption('cancel', 'highlighted')) {
          btnCancel.class.add('highlighted');
      }
      panelButtons.append(btnCancel);
      btnCancel.on('click', function () {
          var onClick = getButtonOption('cancel', 'onClick');
          if (onClick) {
              onClick();
          } else {
              panel.emit('cancel');
          }
      });

      panel.labelTitle = labelTitle;
      panel.labelNote = labelNote;
      panel.panelMain = panelMain;
      panel.buttonCancel = btnCancel;
      panel.buttonConfirm = btnConfirm;

      var enterHotkeyAction = 'version-control-enter-' + sidePanelIndex++;

      panel.on('show', function () {
          // make main panel cover all the height between the top and bottom sections
          if (panelMain) {
              panelMain.element.style.height = 'calc(100% - ' + (panelTop.element.offsetHeight + panelButtons.element.offsetHeight) + 'px)';
          }

          // Register Enter hotkey to click the highlighted button
          editor.call('hotkey:register', enterHotkeyAction, {
              key: 'enter',
              callback: function (e) {
                  if (btnCancel.class.contains('highlighted')) {
                      if (btnCancel.disabled) return;
                      btnCancel.emit('click');
                  } else if (btnConfirm.class.contains('highlighted')) {
                      if (btnConfirm.disabled) return;
                      btnConfirm.emit('click');
                  }
              }
          });
      });

      panel.on('hide', function () {
          // if we remove during the 'hide' event it will throw an error in the hotkey lib
          requestAnimationFrame(function () {
              editor.call('hotkey:unregister', enterHotkeyAction);
          });
      });

      return panel;
  });
});


/* editor/pickers/version-control/picker-version-control-progress.js */
editor.once('load', function () {
  'use strict';

  // this is true if ANY progress widget is currently
  // showing a spinner. This is so that we don't show
  // version control overlays on top of these windows if any widget here is showing a spinner
  // because it looks bad.
  var showingProgress = false;
  var showingError = false;

  editor.method('picker:versioncontrol:isProgressWidgetVisible', function () {
      return showingProgress;
  });

  editor.method('picker:versioncontrol:isErrorWidgetVisible', function () {
      return showingError;
  });

  editor.method('picker:versioncontrol:createProgressWidget', function (args) {
      var panel = new ui.Panel();
      panel.class.add('progress-widget');

      // message
      var labelMessage = new ui.Label({
          text: args.progressText
      });
      labelMessage.renderChanges = false;
      panel.append(labelMessage);

      // note
      var labelNote = new ui.Label();
      labelNote.class.add('note');
      labelNote.renderChanges = false;
      panel.append(labelNote);

      // spinner svg
      var spinner = editor.call('picker:versioncontrol:svg:spinner', 65);
      panel.innerElement.appendChild(spinner);

      // completed svg
      var completed = editor.call('picker:versioncontrol:svg:completed', 65);
      panel.innerElement.appendChild(completed);
      completed.classList.add('hidden');

      // error svg
      var error = editor.call('picker:versioncontrol:svg:error', 65);
      panel.innerElement.appendChild(error);
      error.classList.add('hidden');

      // Call this when the asynchronous action is finished
      panel.finish = function (err) {
          if (err) {
              panel.setMessage(args.errorText);
              panel.setNote(err);
              error.classList.remove('hidden');
              showingError = true;
          } else {
              panel.setMessage(args.finishText);
              panel.setNote('');
              completed.classList.remove('hidden');
              showingError = false;
          }
          spinner.classList.add('hidden');
      };

      panel.setMessage = function (text) {
          labelMessage.text = text;
      };

      panel.setNote = function (text) {
          labelNote.text = text;
          labelNote.hidden = !text;
      };

      panel.on('show', function () {
          showingProgress = true;
          panel.parent.class.add('align-center');
      });

      // restore panel contents when the panel is hidden
      panel.on('hide', function () {
          if (panel.parent) {
              panel.parent.class.remove('align-center');
          }

          labelMessage.text = args.progressText;
          labelNote.hidden = true;
          completed.classList.add('hidden');
          error.classList.add('hidden');
          spinner.classList.remove('hidden');
          showingProgress = false;
          showingError = false;
      });

      return panel;
  });
});


/* editor/pickers/version-control/picker-version-control-create-checkpoint.js */
editor.once('load', function () {
  'use strict';

  var labelDesc = new ui.Label({
      text: 'Description:'
  });
  labelDesc.class.add('small');

  var fieldDescription = new ui.TextAreaField({
      blurOnEnter: false
  });
  fieldDescription.renderChanges = false;
  fieldDescription.keyChange = true;
  fieldDescription.flexGrow = 1;

  var create = function () {
      panel.emit('confirm', {
          description: fieldDescription.value.trim()
      });
  };

  fieldDescription.elementInput.addEventListener('keydown', function (e) {
      if (e.keyCode === 13 && (e.ctrlKey || e.metaKey)) {
          if (! panel.buttonConfirm.disabled) {
              create();
          }
      }
  });

  var panel = editor.call('picker:versioncontrol:createSidePanel', {
      title: 'Create a new checkpoint',
      note: 'A new checkpoint will take a snapshot of the current branch which you can revert to at a later date.',
      mainContents: [labelDesc, fieldDescription],
      buttons: {
          confirm: {
              highlighted: true,
              text: 'Create Checkpoint',
              onClick: create
          }
      }
  });
  panel.class.add('create-checkpoint');

  panel.buttonConfirm.disabled = true;

  fieldDescription.on('change', function (value) {
      panel.buttonConfirm.disabled = !value.trim();
  });

  panel.on('hide', function () {
      fieldDescription.value = '';
      panel.buttonConfirm.disabled = true;
  });

  panel.on('show', function () {
      setTimeout(function () {
          fieldDescription.focus();
      });
  });

  editor.method('picker:versioncontrol:widget:createCheckpoint', function () {
      return panel;
  });
});


/* editor/pickers/version-control/picker-version-control-restore-checkpoint.js */
editor.once('load', function () {
  'use strict';

  var boxRestore = new ui.VersionControlSidePanelBox({
      header: 'RESTORING TO',
      discardChanges: true,
      discardChangesHelp: 'If you choose not to discard your changes then a checkpoint will be created first, before restoring.'
  });

  var panel = editor.call('picker:versioncontrol:createSidePanel', {
      mainContents: [boxRestore.panel],
      buttons: {
          cancel: {
              highlighted: true
          },
          confirm: {
              text: 'Restore Checkpoint'
          }
      }
  });
  panel.class.add('restore-checkpoint');

  editor.method('picker:versioncontrol:widget:restoreCheckpoint', function () {
      return panel;
  });

  panel.setCheckpoint = function (checkpoint) {
      panel.checkpoint = checkpoint;
      boxRestore.setCheckpoint(checkpoint);
      panel.labelTitle.text = 'Restore checkpoint "' + checkpoint.id.substring(0, 7) + '" ?';
  };

  boxRestore.on('discardChanges', function (value) {
      panel.discardChanges = value;
  });

  panel.on('hide', function () {
      boxRestore.clear();
  });
});


/* editor/pickers/version-control/picker-version-control-create-branch.js */
editor.once('load', function () {
  'use strict';

  var boxFrom = new ui.VersionControlSidePanelBox({
      headerNote: 'Branching from'
  });

  var labelIcon = new ui.Label({
      text: '&#58265;',
      unsafe: true
  });
  labelIcon.class.add('branch-icon');

  var boxNewBranch = new ui.VersionControlSidePanelBox({
      headerNote: 'New branch'
  });

  var panelName = new ui.Panel();
  panelName.flex = true;
  var label = new ui.Label({
      text: 'New Branch Name'
  });
  label.class.add('left');
  panelName.append(label);
  panelName.style.padding = '10px';

  var fieldBranchName = new ui.TextField();
  fieldBranchName.flexGrow = 1;
  fieldBranchName.renderChanges = false;
  fieldBranchName.keyChange = true;
  panelName.append(fieldBranchName);

  // blur on enter
  fieldBranchName.elementInput.addEventListener('keydown', function (e) {
      if (e.keyCode === 13) {
          this.blur();
          createBranch();
      }
  });

  boxNewBranch.append(panelName);

  var panel = editor.call('picker:versioncontrol:createSidePanel', {
      title: 'Create a new branch',
      note: 'A new branch will create an independent line of development where you can work in isolation from other team members.',
      mainContents: [boxFrom.panel, labelIcon, boxNewBranch.panel],
      buttons: {
          confirm: {
              text: 'Create New Branch',
              highlighted: true,
              onClick: function () {
                  createBranch();
              }
          }
      }
  });
  panel.class.add('create-branch');

  var createBranch = function () {
      if (panel.buttonConfirm.disabled) return;
      panel.emit('confirm', {
          name: fieldBranchName.value
      });
  };

  panel.on('hide', function () {
      boxFrom.clear();
      boxNewBranch.header = ' ';
      fieldBranchName.value = '';
      panel.buttonConfirm.disabled = true;
  });

  panel.on('show', function () {
      panel.checkpoint = null;
      panel.sourceBranch = null;
      fieldBranchName.focus();
  });

  fieldBranchName.on('change', function (value) {
      panel.buttonConfirm.disabled = !value;
      boxNewBranch.header = value || ' ';
  });

  panel.setSourceBranch = function (branch) {
      panel.sourceBranch = branch;
      boxFrom.header = branch.name;
  };

  panel.setCheckpoint = function (checkpoint) {
      panel.checkpoint = checkpoint;
      boxFrom.setCheckpoint(checkpoint);
  };

  editor.method('picker:versioncontrol:widget:createBranch', function () {
      return panel;
  });
});


/* editor/pickers/version-control/picker-version-control-close-branch.js */
editor.once('load', function () {
  'use strict';

  var boxBranch = new ui.VersionControlSidePanelBox({

      discardChanges: true,
      discardChangesHelp: 'If you choose to not discard your changes, a checkpoint will be created before closing the branch.'
  });

  var labelIcon = new ui.Label({
      text: '&#57686;',
      unsafe: true
  });
  labelIcon.class.add('close-icon');

  var boxConfirm = new ui.VersionControlSidePanelBox({
      header: 'ARE YOU SURE?',
      noIcon: true,
  });

  var panelTypeName = new ui.Panel();
  panelTypeName.flex = true;
  panelTypeName.style.padding = '10px';

  var label = new ui.Label({
      text: 'Type branch name to confirm:'
  });
  label.class.add('small');
  panelTypeName.append(label);

  var fieldName = new ui.TextField();
  fieldName.renderChanges = false;
  fieldName.flexGrow = 1;
  fieldName.keyChange = true;
  panelTypeName.append(fieldName);

  fieldName.elementInput.addEventListener('keydown', function (e) {
      if (e.keyCode === 13 && ! panel.buttonConfirm.disabled) {
          panel.emit('confirm');
      }
  });

  boxConfirm.append(panelTypeName);

  var checkpointRequest = null;

  var panel = editor.call('picker:versioncontrol:createSidePanel', {
      title: 'Close branch?',
      note: 'You will no longer be able to work on this branch unless you re-open it again.',
      mainContents: [boxConfirm.panel, labelIcon, boxBranch.panel],
      buttons: {
          confirm: {
              highlighted: true,
              text: 'Close Branch'
          }
      }
  });
  panel.class.add('close-branch');

  panel.buttonConfirm.disabled = true;
  fieldName.on('change', function () {
      if (! panel.branch) return;

      panel.buttonConfirm.disabled = fieldName.value.toLowerCase() !== panel.branch.name.toLowerCase();
  });

  boxBranch.on('discardChanges', function (value) {
      panel.discardChanges = value;
  });

  panel.on('show', function () {
      fieldName.focus();
  });

  panel.on('hide', function () {
      fieldName.value = '';
      panel.buttonConfirm.disabled = true;
      boxBranch.clear();
      if (checkpointRequest) {
          checkpointRequest.abort();
          checkpointRequest = null;
      }
  });

  panel.setBranch = function (branch) {
      panel.branch = branch;
      boxBranch.header = branch.name;

      if (checkpointRequest) {
          checkpointRequest.abort();
      }

      checkpointRequest = editor.call('checkpoints:get', branch.latestCheckpointId, function (err, checkpoint) {
          checkpointRequest = null;
          boxBranch.setCheckpoint(checkpoint);
      });
  };

  editor.method('picker:versioncontrol:widget:closeBranch', function () {
      return panel;
  });
});


/* editor/pickers/version-control/picker-version-control-merge-branches.js */
editor.once('load', function () {
  'use strict';

  var boxFrom = new ui.VersionControlSidePanelBox({
      headerNote: 'Merge from'
  });

  var labelArrow = new ui.Label({
      text: '&#57704;',
      unsafe: true
  });
  labelArrow.class.add('arrow');

  var boxInto = new ui.VersionControlSidePanelBox({
      headerNote: 'Merge to',
      discardChanges: true,
      discardChangesHelp: 'If you choose not to discard your changes then a new checkpoint will be created before merging.'
  });

  // holds pending requests to get checkpoints
  var checkpointRequests = [];

  var panel = editor.call('picker:versioncontrol:createSidePanel', {
      title: 'Merge branches',
      note: 'Beginning the merge process will lock other active users\' sessions in the current branch.',
      mainContents: [boxFrom.panel, labelArrow, boxInto.panel],
      buttons: {
          cancel: {
              highlighted: true
          },
          confirm: {
              text: 'START MERGE'
          }
      }
  });
  panel.class.add('merge-branches');

  boxInto.on('discardChanges', function (value) {
      panel.discardChanges = value;
  });

  panel.on('hide', function () {
      panel.setSourceBranch(null);
      panel.setDestinationBranch(null);

      boxFrom.clear();
      boxInto.clear();

      // abort all pending requests
      checkpointRequests.forEach(function (request) {
          request.abort();
      });
      checkpointRequests.length = 0;
  });

  var setBranchInfo = function (branch, isSourceBranch) {
      var panelField = isSourceBranch ? 'sourceBranch' : 'destinationBranch';
      panel[panelField] = branch;

      if (! branch) return;

      var box = isSourceBranch ? boxFrom : boxInto;
      box.header = branch.name;

      // get checkpoint from server
      var request = editor.call('checkpoints:get', branch.latestCheckpointId, function (err, checkpoint) {
          // remove request from pending array
          var idx = checkpointRequests.indexOf(request);
          checkpointRequests.splice(idx, 1);

          box.setCheckpoint(checkpoint);
      });

      // add the request to the pending array
      checkpointRequests.push(request);
  };

  panel.setSourceBranch = function (sourceBranch) {
      setBranchInfo(sourceBranch, true);
  };
  panel.setDestinationBranch = function (destinationBranch) {
      setBranchInfo(destinationBranch, false);
  };

  editor.method('picker:versioncontrol:widget:mergeBranches', function () {
      return panel;
  });
});


/* editor/pickers/version-control/picker-version-control-checkpoints.js */
editor.once('load', function () {
  'use strict';

  var events = [];

  var diffMode = false;

  var panel = new ui.Panel();
  panel.class.add('checkpoints-container');

  // checkpoints top
  var panelCheckpointsTop = new ui.Panel();
  panelCheckpointsTop.class.add('checkpoints-top');
  panel.append(panelCheckpointsTop);

  // current branch history
  var labelBranchHistory = new ui.Label({
      text: 'CHECKPOINTS'
  });
  labelBranchHistory.renderChanges = false;
  labelBranchHistory.class.add('branch-history', 'selectable');
  panelCheckpointsTop.append(labelBranchHistory);

  // new checkpoint button
  var btnNewCheckpoint = new ui.Button({
      text: 'NEW CHECKPOINT'
  });
  btnNewCheckpoint.class.add('icon', 'create');
  panelCheckpointsTop.append(btnNewCheckpoint);

  // open diff checkpoints panel
  var btnDiff = new ui.Button({
      text: 'VIEW DIFF'
  });
  btnDiff.class.add('icon', 'diff');
  panelCheckpointsTop.append(btnDiff);

  var toggleTopButtons = function () {
      btnNewCheckpoint.hidden = ! editor.call('permissions:write') || ! panel.branch || panel.branch.id !== config.self.branch.id;
  };

  toggleTopButtons();

  // checkpoints main panel
  var panelCheckpoints = new ui.Panel();
  panelCheckpoints.class.add('checkpoints');
  panel.append(panelCheckpoints);

  // checkpoints list
  var listCheckpoints = new ui.List();
  panelCheckpoints.append(listCheckpoints);

  // used to group displayed checkpoints into days
  var lastCheckpointDateDisplayed = null;

  // load more checkpoints list item
  var listItemLoadMore = new ui.ListItem();
  listItemLoadMore.class.add('load-more');
  listItemLoadMore.hidden = true;
  var btnLoadMore = new ui.Button({
      text: 'LOAD MORE'
  });
  listItemLoadMore.element.appendChild(btnLoadMore.element);

  // checkpoints for which context menu is currenty open
  var currentCheckpoint = null;

  var currentCheckpointListRequest = null;
  var checkpointsSkip = null;

  // checkpoints context menu
  var menuCheckpoints = new ui.Menu();
  menuCheckpoints.class.add('version-control');

  // restore checkpoint
  var menuCheckpointsRestore = new ui.MenuItem({
      text: 'Restore',
      value: 'restore-checkpoint'
  });
  menuCheckpoints.append(menuCheckpointsRestore);

  // branch from checkpoint
  var menuCheckpointsBranch = new ui.MenuItem({
      text: 'New Branch',
      value: 'new-branch'
  });
  menuCheckpoints.append(menuCheckpointsBranch);

  editor.call('layout.root').append(menuCheckpoints);

  // loading checkpoints icon
  var spinner = editor.call('picker:versioncontrol:svg:spinner', 64);
  spinner.classList.add('hidden');
  spinner.classList.add('spinner');
  panelCheckpoints.innerElement.appendChild(spinner);

  // Set the current branch of the panel
  panel.setBranch = function (branch) {
      // make sure we don't have any running checkpoint:list requests
      currentCheckpointListRequest = null;

      panel.branch = branch;

      panel.setCheckpoints(null);
      panel.toggleLoadMore(false);

      toggleTopButtons();
  };

  // Set the checkpoints to be displayed
  panel.setCheckpoints = function (checkpoints) {
      listCheckpoints.clear();
      panelCheckpoints.element.scrollTop = 0;
      lastCheckpointDateDisplayed = null;

      var length = checkpoints && checkpoints.length;
      if (length && panel.branch && !panel.branch.closed) {
          createCurrentStateUi();
      }

      // create checkpoints
      panel.checkpoints = checkpoints;
      if (length) {
          checkpoints.forEach(createCheckpointListItem);
          checkpointsSkip = checkpoints[checkpoints.length - 1].id;
      } else {
          checkpointsSkip = null;
      }


      listCheckpoints.append(listItemLoadMore);
  };

  // Show button to load more checkpoints or not
  panel.toggleLoadMore = function (toggle) {
      listItemLoadMore.hidden = !toggle;
  };

  panel.loadCheckpoints = function () {
      btnLoadMore.disabled = true;
      btnLoadMore.text = 'LOADING...';

      var params = {
          branch: panel.branch.id,
          limit: 20
      };

      if (checkpointsSkip) {
          params.skip = checkpointsSkip;
      } else {
          // hide list of checkpoints and show spinner
          listCheckpoints.hidden = true;
          spinner.classList.remove('hidden');
      }

      // list checkpoints but make sure in the response
      // that the results are from this request and not another
      // Happens sometimes when this request takes a long time
      var request = editor.call('checkpoints:list', params, function (err, data) {
          if (request !== currentCheckpointListRequest || panel.hidden || panel.parent.hidden) {
              return;
          }

          btnLoadMore.disabled = false;
          btnLoadMore.text = 'LOAD MORE';

          // show list of checkpoints and hide spinner
          listCheckpoints.hidden = false;
          spinner.classList.add('hidden');

          currentCheckpointListRequest = null;

          if (err) {
              return console.error(err);
          }

          if (params.skip) {
              data.result = panel.checkpoints.concat(data.result);
          }

          panel.setCheckpoints(data.result);
          panel.toggleLoadMore(data.pagination.hasMore);
      });

      currentCheckpointListRequest = request;
  };

  var createCheckpointWidget = function (checkpoint) {
      var panelWidget = new ui.Panel();
      panelWidget.class.add('checkpoint-widget');
      panelWidget.flex = true;

      var imgUser = new Image();
      imgUser.src = '/api/users/' + checkpoint.user.id + '/thumbnail?size=28';
      imgUser.classList.add('noSelect');
      panelWidget.append(imgUser);

      var panelInfo = new ui.Panel();
      panelInfo.class.add('info');
      panelInfo.flex = true;
      panelWidget.append(panelInfo);

      var panelTopRow = new ui.Panel();
      panelTopRow.flexGrow = 1;
      panelTopRow.class.add('top-row');
      panelInfo.append(panelTopRow);

      var descWithoutNewLine = checkpoint.description;
      var newLineIndex = descWithoutNewLine.indexOf('\n');
      if (newLineIndex >= 0) {
          descWithoutNewLine = descWithoutNewLine.substring(0, newLineIndex);
      }
      var labelDesc = new ui.Label({
          text: descWithoutNewLine
      });
      labelDesc.renderChanges = false;
      labelDesc.class.add('desc', 'selectable');
      panelTopRow.append(labelDesc);

      var btnMore = new ui.Button({
          text: '...read more'
      });
      btnMore.on('click', function () {
          if (labelDesc.class.contains('more')) {
              labelDesc.class.remove('more');
              labelDesc.text = descWithoutNewLine;
              labelDesc.style.whiteSpace = '';
              btnMore.text = '...read more';
          } else {
              labelDesc.class.add('more');
              labelDesc.text = checkpoint.description;
              labelDesc.style.whiteSpace = 'pre-wrap';
              btnMore.text = '...read less';
          }
      });

      panelTopRow.append(btnMore);

      var panelBottomRow = new ui.Panel();
      panelBottomRow.flexGrow = 1;
      panelBottomRow.class.add('bottom-row');
      panelInfo.append(panelBottomRow);

      var labelInfo = new ui.Label({
          text: editor.call('datetime:convert', checkpoint.createdAt) +
                ' - ' +
                checkpoint.id.substring(0, 7) +
                (checkpoint.user.fullName ? ' by ' + checkpoint.user.fullName : '')
      });
      labelInfo.class.add('info', 'selectable');
      panelBottomRow.append(labelInfo);


      // hide more button if necessary - do this here because the element
      // must exist in the DOM before scrollWidth / clientWidth are available,
      // Users of this widget need to call this function once the panel has been added to the DOM
      panelWidget.onAddedToDom = function () {
          btnMore.hidden = labelDesc.element.scrollWidth <= labelDesc.element.clientWidth && newLineIndex < 0;
      };

      return panelWidget;
  };

  var createCheckpointSectionHeader = function (title) {
      var header = document.createElement('div');
      header.classList.add('date');
      header.classList.add('selectable');
      header.textContent = title;
      listCheckpoints.innerElement.appendChild(header);
      return header;
  };

  var createCheckpointListItem = function (checkpoint) {
      // add current date if necessary
      var date = (new Date(checkpoint.createdAt)).toDateString();
      if (lastCheckpointDateDisplayed !== date) {
          lastCheckpointDateDisplayed = date;

          if (lastCheckpointDateDisplayed === (new Date()).toDateString()) {
              createCheckpointSectionHeader('Today');
          } else {
              var parts = lastCheckpointDateDisplayed.split(' ');
              createCheckpointSectionHeader(parts[0] + ', ' + parts[1] + ' ' + parts[2] + ', ' + parts[3]);
          }
      }

      var item = new ui.ListItem();
      item.element.id = 'checkpoint-' + checkpoint.id;

      var panelListItem = createCheckpointWidget(checkpoint);
      item.element.appendChild(panelListItem.element);

      // dropdown
      var dropdown = new ui.Button({
          text: '&#57689;'
      });
      dropdown.class.add('dropdown');
      panelListItem.append(dropdown);

      if (! editor.call('permissions:write') || diffMode) {
          dropdown.hidden = true;
      }

      dropdown.on('click', function (e) {
          e.stopPropagation();

          currentCheckpoint = checkpoint;

          dropdown.class.add('clicked');
          dropdown.element.innerHTML = '&#57687;';

          menuCheckpoints.open = true;
          var rect = dropdown.element.getBoundingClientRect();
          menuCheckpoints.position(rect.right - menuCheckpoints.innerElement.clientWidth, rect.bottom);
      });

      // select
      var checkboxSelect = new ui.Checkbox();
      checkboxSelect.class.add('tick');
      panelListItem.append(checkboxSelect);
      checkboxSelect.value = editor.call('picker:versioncontrol:widget:diffCheckpoints:isCheckpointSelected', panel.branch, checkpoint);

      var suppressCheckboxEvents = false;
      checkboxSelect.on('change', function (value) {
          if (suppressCheckboxEvents) return;
          if (value) {
              editor.emit('checkpoint:diff:select', panel.branch, checkpoint);
          } else {
              editor.emit('checkpoint:diff:deselect', panel.branch, checkpoint);
          }
      });

      events.push(editor.on('checkpoint:diff:deselect', function (deselectedBranch, deselectedCheckpoint) {
          if (deselectedCheckpoint && deselectedCheckpoint.id === checkpoint.id) {
              suppressCheckboxEvents = true;
              checkboxSelect.value = false;
              suppressCheckboxEvents = false;
          }
      }));

      listCheckpoints.append(item);

      if (!panelCheckpoints.hidden) {
          panelListItem.onAddedToDom();
      }
  };

  // Creates a list item for the current state visible only in diffMode
  var createCurrentStateListItem = function () {
      var item = new ui.ListItem();
      var panelItem = new ui.Panel();
      // panelItem.class.add('checkpoint-widget');
      panelItem.flex = true;

      var label = new ui.Label({
          text: 'Changes made since the last checkpoint'
      });
      panelItem.append(label);

      // select
      var checkboxSelect = new ui.Checkbox();
      checkboxSelect.class.add('tick');
      panelItem.append(checkboxSelect);
      checkboxSelect.value = editor.call('picker:versioncontrol:widget:diffCheckpoints:isCheckpointSelected', panel.branch, null);

      var suppressCheckboxEvents = false;
      checkboxSelect.on('change', function (value) {
          if (suppressCheckboxEvents) return;
          if (value) {
              editor.emit('checkpoint:diff:select', panel.branch, null);
          } else {
              editor.emit('checkpoint:diff:deselect', panel.branch, null);
          }
      });

      events.push(editor.on('checkpoint:diff:deselect', function (deselectedBranch, deselectedCheckpoint) {
          if (!deselectedCheckpoint && deselectedBranch && deselectedBranch.id === panel.branch.id) {
              suppressCheckboxEvents = true;
              checkboxSelect.value = false;
              suppressCheckboxEvents = false;
          }
      }));

      listCheckpoints.append(item);

      item.element.appendChild(panelItem.element);

      return item;
  };

  var createCurrentStateUi = function() {
      var currentStateHeader = createCheckpointSectionHeader('CURRENT STATE');
      currentStateHeader.classList.add('current-state');
      var currentStateListItem = createCurrentStateListItem();
      currentStateListItem.class.add('current-state');
  }

  // show create checkpoint panel
  btnNewCheckpoint.on('click', function () {
      panel.emit('checkpoint:new');
  });

  // generate diff
  btnDiff.on('click', function () {
      panel.emit('checkpoint:diff');
  });

  // load more button
  btnLoadMore.on('click', function () {
      panel.loadCheckpoints();
  });

  // restore checkpoint
  menuCheckpointsRestore.on('select', function () {
      panel.emit('checkpoint:restore', currentCheckpoint);
  });

  // branch from checkpoint
  menuCheckpointsBranch.on('select', function () {
      panel.emit('checkpoint:branch', currentCheckpoint);
  });

  menuCheckpoints.on('open', function (open) {
      if (! currentCheckpoint) return;

      // filter menu options
      if (open) {
          menuCheckpointsRestore.hidden = panel.branch.id !== config.self.branch.id || ! editor.call('permissions:write');
          menuCheckpointsBranch.hidden = ! editor.call('permissions:write');
      }

      // when the checkpoints context menu is closed 'unclick' dropdowns
      if (! open) {
          var item = document.getElementById('checkpoint-' + currentCheckpoint.id);
          currentCheckpoint = null;
          if (! item) return;

          var dropdown = item.querySelector('.clicked');
          if (! dropdown) return;

          dropdown.classList.remove('clicked');
          dropdown.innerHTML = '&#57689;';
      }
  });

  panel.on('show', function () {
      toggleTopButtons();

      events.push(editor.on('permissions:writeState', function (writeEnabled) {
          // hide all dropdowns if we no longer have write access
          panel.innerElement.querySelectorAll('.dropdown').forEach(function (dropdown) {
              dropdown.ui.hidden = ! writeEnabled;
          });

          // hide new checkpoint button if we no longer have write access
          toggleTopButtons();
      }));

      if (!panelCheckpoints.hidden) {
          // go through all the checkpoint list items and call onAddedToDom() to recalculate
          // whether we need to show read more or not
          var listItems = listCheckpoints.element.querySelectorAll('.checkpoint-widget');
          for (var i = 0, len = listItems.length; i < len; i++) {
              var item = listItems[i].ui;
              item.onAddedToDom();
          }
      }
  });

  // clean up
  panel.on('hide', function () {
      if (currentCheckpointListRequest) {
          currentCheckpointListRequest.abort();
          currentCheckpointListRequest = null;
      }

      // restore state of buttons
      btnLoadMore.disabled = false;
      btnLoadMore.text = 'LOAD MORE';
      listCheckpoints.hidden = false;
      spinner.classList.add('hidden');

      events.forEach(function (evt) {
          evt.unbind();
      });
      events.length = 0;
  });

  // Toggles diff mode for the checkpoint view.
  panel.toggleDiffMode = function (enabled) {
      diffMode = enabled;
      btnNewCheckpoint.disabled = enabled;
      btnDiff.disabled = enabled;
  };

  // Return checkpoints container panel
  editor.method('picker:versioncontrol:widget:checkpoints', function () {
      return panel;
  });

  // Creates single widget for a checkpoint useful for other panels
  // that show checkpoints
  editor.method('picker:versioncontrol:widget:checkpoint', createCheckpointWidget);
});


/* editor/pickers/version-control/picker-version-control-diff-checkpoints.js */
editor.once('load', function () {
  'use strict';

  var leftBranch = null;
  var leftCheckpoint = null;
  var rightBranch = null;
  var rightCheckpoint = null;

  var panel = new ui.Panel('DIFF');
  panel.class.add('diff-checkpoints');

  // close button
  var btnClose = new ui.Button({
      text: '&#57650;'
  });
  btnClose.class.add('close');
  btnClose.on('click', function () {
      panel.hidden = true;
  });
  panel.headerElement.appendChild(btnClose.element);

  // left checkpoint
  var panelLeft = new ui.Panel();
  panelLeft.class.add('checkpoint', 'checkpoint-left', 'empty');
  panel.append(panelLeft);

  var labelLeftInfo = new ui.Label({
      text: 'Select a checkpoint or a branch\'s current state'
  });
  labelLeftInfo.class.add('diff-info');
  panelLeft.append(labelLeftInfo);

  var panelLeftContent = new ui.Panel('title');
  panelLeftContent.class.add('checkpoint-content');

  // clear button
  var btnClearLeft = new ui.Button({
      text: '&#57650;'
  });
  btnClearLeft.class.add('close');
  btnClearLeft.on('click', function () {
      editor.emit('checkpoint:diff:deselect', leftBranch, leftCheckpoint);
  });
  panelLeftContent.headerElement.appendChild(btnClearLeft.element);

  var labelLeftCheckpoint = new ui.Label({
      text: 'Left Checkpoint'
  });
  labelLeftCheckpoint.renderChanges = false;
  labelLeftCheckpoint.class.add('title');
  panelLeftContent.append(labelLeftCheckpoint);

  var labelLeftDesc = new ui.Label({
      text: 'Description'
  });
  labelLeftDesc.renderChanges = false;
  labelLeftDesc.class.add('desc');
  panelLeftContent.append(labelLeftDesc);

  panelLeft.append(panelLeftContent);

  // arrow
  var labelArrow = new ui.Label({
      text: '&#57702;',
      unsafe: true
  });
  labelArrow.class.add('arrow');
  panel.append(labelArrow);

  // right checkpoint
  var panelRight = new ui.Panel();
  panelRight.class.add('checkpoint', 'checkpoint-right', 'empty');
  panel.append(panelRight);

  var labelRightInfo = new ui.Label({
      text: 'Select a checkpoint or a branch\'s current state'
  });
  labelRightInfo.renderChanges = false;
  labelRightInfo.class.add('diff-info');
  panelRight.append(labelRightInfo);

  var panelRightContent = new ui.Panel('title');
  panelRightContent.class.add('checkpoint-content');
  var labelRightCheckpoint = new ui.Label({
      text: 'Right Checkpoint'
  });
  labelRightCheckpoint.renderChanges = false;
  labelRightCheckpoint.class.add('title');
  panelRightContent.append(labelRightCheckpoint);

  // clear button
  var btnClearRight = new ui.Button({
      text: '&#57650;'
  });
  btnClearRight.class.add('close');
  btnClearRight.on('click', function () {
      editor.emit('checkpoint:diff:deselect', rightBranch, rightCheckpoint);
  });
  panelRightContent.headerElement.appendChild(btnClearRight.element);

  var labelRightDesc = new ui.Label({
      text: 'Description'
  });
  labelRightDesc.renderChanges = false;
  labelRightDesc.class.add('desc');
  panelRightContent.append(labelRightDesc);

  panelRight.append(panelRightContent);

  // compare button
  var btnCompare = new ui.Button({
      text: 'COMPARE'
  });
  btnCompare.class.add('compare');
  btnCompare.disabled = true;
  panel.append(btnCompare);

  btnCompare.on('click', function () {
      panel.emit('diff',
          leftBranch.id,
          leftCheckpoint ? leftCheckpoint.id : null,
          rightBranch.id,
          rightCheckpoint ? rightCheckpoint.id : null
      );
  });

  // swap button
  var btnSwitch = new ui.Button({
      text: 'SWAP'
  });
  btnSwitch.class.add('switch');
  btnSwitch.disabled = true;
  panel.append(btnSwitch);

  btnSwitch.on('click', function () {
      var tempCheckpoint = leftCheckpoint;
      var tempBranch = leftBranch;
      setLeftCheckpoint(rightBranch, rightCheckpoint);
      setRightCheckpoint(tempBranch, tempCheckpoint);
  });

  var setCheckpointContent = function (panel, panelCheckpoint, labelCheckpoint, labelDesc, branch, checkpoint) {
      if (branch) {
          panelCheckpoint.header = branch.name;
      }

      if (checkpoint || branch) {
          labelCheckpoint.text = checkpoint ? checkpoint.description : 'Current State';
          var text;
          if (checkpoint) {
              text = editor.call('datetime:convert', checkpoint.createdAt) + ' - ' + checkpoint.id.substring(0, 7) + (checkpoint.user.fullName ? ' by ' + checkpoint.user.fullName : '');
          } else {
              text = 'As of ' + editor.call('datetime:convert', Date.now());
          }

          labelDesc.text = text;

          panel.class.remove('empty');
      } else {
          panel.class.add('empty');
      }
  }

  var setLeftCheckpoint = function (branch, checkpoint) {
      leftBranch = branch;
      leftCheckpoint = checkpoint;
      setCheckpointContent(panelLeft, panelLeftContent, labelLeftCheckpoint, labelLeftDesc, branch, checkpoint);

  };

  var setRightCheckpoint = function (branch, checkpoint) {
      rightBranch = branch;
      rightCheckpoint = checkpoint;
      setCheckpointContent(panelRight, panelRightContent, labelRightCheckpoint, labelRightDesc, branch, checkpoint);
  };

  var isLeft = function (branch, checkpoint) {
      if (leftBranch && branch.id === leftBranch.id) {
          return (checkpoint && leftCheckpoint && checkpoint.id === leftCheckpoint.id) ||
                 (!checkpoint && !leftCheckpoint);
      }
  };

  var isRight = function (branch, checkpoint) {
      if (rightBranch && branch.id === rightBranch.id) {
          return (checkpoint && rightCheckpoint && checkpoint.id === rightCheckpoint.id) ||
                 (!checkpoint && !rightCheckpoint);
      }
  };

  panel.onCheckpointSelected = function (branch, checkpoint) {
      if (!leftCheckpoint && !leftBranch) {
          setLeftCheckpoint(branch, checkpoint);
      } else {
          setRightCheckpoint(branch, checkpoint);
      }

      if (panel.getSelectedCount() === 2) {
          btnCompare.disabled = false;
          btnSwitch.disabled = false;
      }
  };

  panel.onCheckpointDeselected = function (branch, checkpoint) {
      if (isLeft(branch, checkpoint)) {
          setLeftCheckpoint(null, null);
      } else if (isRight(branch, checkpoint)) {
          setRightCheckpoint(null, null);
      }

      if (panel.getSelectedCount() !== 2) {
          btnCompare.disabled = true;
          btnSwitch.disabled = true;
      }
  };

  panel.getSelectedCount = function () {
      var result = 0;
      if (leftCheckpoint || leftBranch) result++;
      if (rightCheckpoint || rightBranch) result++;
      return result;
  };

  panel.on('hide', function () {
      editor.emit('checkpoint:diff:deselect', leftBranch, leftCheckpoint);
      editor.emit('checkpoint:diff:deselect', rightBranch, rightCheckpoint);
  });

  editor.method('picker:versioncontrol:widget:diffCheckpoints:isCheckpointSelected', function (branch, checkpoint) {
      return isLeft(branch, checkpoint) || isRight(branch, checkpoint);
  });

  // Gets the diff checkpoints panel
  editor.method('picker:versioncontrol:widget:diffCheckpoints', function () {
      return panel;
  });
});


/* editor/pickers/version-control/picker-version-control.js */
editor.once('load', function () {
  'use strict';

  if (config.project.settings.useLegacyScripts) {
      return;
  }

  var events = [];

  var projectUserSettings = editor.call('settings:projectUser');
  var branches = {}; // branches by id

  var branchesSkip = null;
  var selectedBranch = null;
  var showNewCheckpointOnLoad = false;

  // main panel
  var panel = new ui.Panel();
  panel.class.add('picker-version-control');
  editor.call('picker:project:registerMenu', 'version control', 'Version Control', panel);
  panel.flex = true;

  // hide version control picker if we are not part of the team
  if (! editor.call('permissions:read')) {
      editor.call('picker:project:toggleMenu', 'version control', false);
  }
  editor.on('permissions:set', function () {
      editor.call('picker:project:toggleMenu', 'version control', editor.call('permissions:read'));
  });

  // branches container panel
  var panelBranchesContainer = new ui.Panel();
  panelBranchesContainer.class.add('branches-container');
  panel.append(panelBranchesContainer);
  panelBranchesContainer.flex = true;

  // branches top
  // var panelBranchesTop = new ui.Panel();
  // panelBranchesTop.class.add('branches-top');
  // panelBranchesTop.flex = true;
  // panelBranchesContainer.append(panelBranchesTop);

  // branches filter
  var panelBranchesFilter = new ui.Panel();
  panelBranchesFilter.class.add('branches-filter');
  panelBranchesFilter.flex = true;
  panelBranchesContainer.append(panelBranchesFilter);

  // filter
  var fieldBranchesFilter = new ui.SelectField({
      options: [{
          v: 'open', t: 'Open Branches'
      }, {
          v: 'closed', t: 'Closed Branches'
      }]
  });
  fieldBranchesFilter.value = 'open';
  fieldBranchesFilter.flexGrow = 1;
  panelBranchesFilter.append(fieldBranchesFilter);

  // branches main panel
  var panelBranches = new ui.Panel();
  panelBranches.class.add('branches');
  panelBranches.flexGrow = 1;
  panelBranchesContainer.append(panelBranches);

  // branches list
  var listBranches = new ui.List();
  panelBranches.append(listBranches);

  var loadMoreListItem = new ui.ListItem();
  loadMoreListItem.hidden = true;
  loadMoreListItem.class.add('load-more');
  var btnLoadMoreBranches = new ui.Button({
      text: 'LOAD MORE'
  });
  loadMoreListItem.element.append(btnLoadMoreBranches.element);
  btnLoadMoreBranches.on('click', function (e) {
      e.stopPropagation(); // do not select parent list item on click
      loadBranches();
  });

  // right side container panel
  var panelRight = new ui.Panel();
  panelRight.class.add('side-panel');
  panelRight.flex = true;
  panelRight.flexGrow = 1;
  panel.append(panelRight);

  // checkpoints panel
  var panelCheckpoints = editor.call('picker:versioncontrol:widget:checkpoints');
  panelRight.append(panelCheckpoints);

  panelCheckpoints.on('checkpoint:new', function () {
      showRightSidePanel(panelCreateCheckpoint);
  });

  panelCheckpoints.on('checkpoint:restore', function (checkpoint) {
      showRightSidePanel(panelRestoreCheckpoint);
      panelRestoreCheckpoint.setCheckpoint(checkpoint);
  });

  panelCheckpoints.on('checkpoint:branch', function (checkpoint) {
      showRightSidePanel(panelCreateBranch);
      panelCreateBranch.setSourceBranch(panelCheckpoints.branch);
      panelCreateBranch.setCheckpoint(checkpoint);
  });

  panelCheckpoints.on('checkpoint:diff', function () {
      panelDiffCheckpoints.hidden = false;
  });

  editor.on('checkpoint:diff:select', function (branch, checkpoint) {
      var numSelected = panelDiffCheckpoints.getSelectedCount();
      panel.class.remove('diff-checkpoints-selected-' + numSelected)
      panelDiffCheckpoints.onCheckpointSelected(branch, checkpoint);
      numSelected = panelDiffCheckpoints.getSelectedCount();
      if (numSelected) {
          panel.class.add('diff-checkpoints-selected-' + numSelected)
      }
  });

  editor.on('checkpoint:diff:deselect', function (branch, checkpoint) {
      var numSelected = panelDiffCheckpoints.getSelectedCount();
      panel.class.remove('diff-checkpoints-selected-' + numSelected)
      panelDiffCheckpoints.onCheckpointDeselected(branch, checkpoint);
      numSelected = panelDiffCheckpoints.getSelectedCount();
      if (numSelected) {
          panel.class.add('diff-checkpoints-selected-' + numSelected)
      }
  });

  var panelDiffCheckpoints = editor.call('picker:versioncontrol:widget:diffCheckpoints');
  panelDiffCheckpoints.hidden = true;
  panel.append(panelDiffCheckpoints);

  panelDiffCheckpoints.on('show', function () {
      panel.class.add('diff-mode');
      panelCheckpoints.toggleDiffMode(true);
  });

  panelDiffCheckpoints.on('hide', function () {
      panel.class.remove('diff-mode');
      panelCheckpoints.toggleDiffMode(false);
  });

  // new checkpoint panel
  var panelCreateCheckpoint = editor.call('picker:versioncontrol:widget:createCheckpoint');
  panelCreateCheckpoint.hidden = true;
  panelRight.append(panelCreateCheckpoint);

  // create checkpoint progress
  var panelCreateCheckpointProgress = editor.call('picker:versioncontrol:createProgressWidget', {
      progressText: 'Creating checkpoint',
      finishText: 'Checkpoint created',
      errorText: 'Failed to create new checkpoint'
  });
  panelCreateCheckpointProgress.hidden = true;
  panelRight.append(panelCreateCheckpointProgress);

  // generate diff progress panel
  var panelGenerateDiffProgress = editor.call('picker:versioncontrol:createProgressWidget', {
      progressText: 'Getting changes',
      finishText: 'Showing changes',
      errorText: 'Failed to get changes'
  });
  panelGenerateDiffProgress.hidden = true;
  panelRight.append(panelGenerateDiffProgress);

  // new branch panel
  var panelCreateBranch = editor.call('picker:versioncontrol:widget:createBranch');
  panelCreateBranch.hidden = true;
  panelRight.append(panelCreateBranch);

  // create branch progress
  var panelCreateBranchProgress = editor.call('picker:versioncontrol:createProgressWidget', {
      progressText: 'Creating branch',
      finishText: 'Branch created - refreshing the browser',
      errorText: 'Failed to create new branch'
  });
  panelCreateBranchProgress.hidden = true;
  panelRight.append(panelCreateBranchProgress);

  // close branch panel
  var panelCloseBranch = editor.call('picker:versioncontrol:widget:closeBranch');
  panelCloseBranch.hidden = true;
  panelRight.append(panelCloseBranch);

  // close progress
  var panelCloseBranchProgress = editor.call('picker:versioncontrol:createProgressWidget', {
      progressText: 'Closing branch',
      finishText: 'Branch closed',
      errorText: 'Failed to close branch'
  });
  panelCloseBranchProgress.hidden = true;
  panelRight.append(panelCloseBranchProgress);

  // Close branch
  panelCloseBranch.on('cancel', function () {
      showCheckpoints();
  });
  panelCloseBranch.on('confirm', function (data) {
      togglePanels(false);

      var close = function () {
          showRightSidePanel(panelCloseBranchProgress);

          editor.call('branches:close', panelCloseBranch.branch.id, function (err) {
              panelCloseBranchProgress.finish(err);
              // if there was an error re-add the item to the list
              if (err) {
                  togglePanels(true);
              } else {
                  // remove item from list
                  setTimeout(function () {
                      togglePanels(true);
                      showCheckpoints();
                  }, 1000);
              }
          });
      };

      if (! panelCloseBranch.discardChanges) {
          // take a checkpoint first
          createCheckpoint(panelCloseBranch.branch.id, 'Checkpoint before closing branch "' + panelCloseBranch.branch.name + '"', close);
      } else {
          close();
      }

  });

  // open branch progress panel
  var panelOpenBranchProgress = editor.call('picker:versioncontrol:createProgressWidget', {
      progressText: 'Opening branch',
      finishText: 'Branch opened',
      errorText: 'Failed to open branch'
  });
  panelOpenBranchProgress.hidden = true;
  panelRight.append(panelOpenBranchProgress);

  // merge branches panel
  var panelMergeBranches = editor.call('picker:versioncontrol:widget:mergeBranches');
  panelMergeBranches.hidden = true;
  panelRight.append(panelMergeBranches);

  // merge branches progress
  var panelMergeBranchesProgress = editor.call('picker:versioncontrol:createProgressWidget', {
      progressText: 'Attempting to auto merge branches',
      finishText: 'Merge ready - Opening Merge Review',
      errorText: 'Unable to auto merge'
  });
  panelMergeBranchesProgress.hidden = true;
  panelRight.append(panelMergeBranchesProgress);

  // Merge branches
  panelMergeBranches.on('cancel', function () {
      showCheckpoints();
  });
  panelMergeBranches.on('confirm', function () {
      var sourceBranch = panelMergeBranches.sourceBranch;
      var destinationBranch = panelMergeBranches.destinationBranch;
      var discardChanges = panelMergeBranches.discardChanges;

      togglePanels(false);

      var merge = function () {
          showRightSidePanel(panelMergeBranchesProgress);

          editor.call('branches:merge', sourceBranch.id, destinationBranch.id, function (err, data) {
              panelMergeBranchesProgress.finish(err);
              if (err) {
                  togglePanels(true);
              } else {
                  // update merge object in config
                  config.self.branch.merge = data;

                  // if there are merge conflicts then show
                  // conflict manager
                  if (data.numConflicts) {
                      panelMergeBranchesProgress.setMessage('Unable to auto merge - opening conflict manager');
                      setTimeout(function () {
                          editor.call('picker:project:close');
                          editor.call('picker:versioncontrol:mergeOverlay:hide'); // hide this in case it's open
                          editor.call('picker:conflictManager');
                      }, 1500);
                  } else {
                      // otherwise merge was successful
                      // so review changes
                      setTimeout(function () {
                          editor.call('picker:project:close');
                          editor.call('picker:versioncontrol:mergeOverlay:hide'); // hide this in case it's open
                          editor.call('picker:diffManager');
                      }, 1500);
                  }
              }
          });
      };

      if (discardChanges) {
          merge();
      } else {
          // take a checkpoint first
          createCheckpoint(config.self.branch.id, 'Checkpoint before merging checkpoint "' + sourceBranch.latestCheckpointId + '" into "' + destinationBranch.latestCheckpointId + '"', merge);
      }
  });

  // restore checkpoint panel
  var panelRestoreCheckpoint = editor.call('picker:versioncontrol:widget:restoreCheckpoint');
  panelRestoreCheckpoint.hidden = true;
  panelRight.append(panelRestoreCheckpoint);

  // restore branch progress
  var panelRestoreCheckpointProgress = editor.call('picker:versioncontrol:createProgressWidget', {
      progressText: 'Restoring checkpoint',
      finishText: 'Checkpoint restored - refreshing the browser',
      errorText: 'Failed to restore checkpoint'
  });
  panelRestoreCheckpointProgress.hidden = true;
  panelRight.append(panelRestoreCheckpointProgress);

  // Restore checkpoints
  panelRestoreCheckpoint.on('cancel', function () {
      showCheckpoints();
  });
  panelRestoreCheckpoint.on('confirm', function () {
      togglePanels(false);

      var restore = function () {
          showRightSidePanel(panelRestoreCheckpointProgress);

          editor.call('checkpoints:restore', panelRestoreCheckpoint.checkpoint.id, config.self.branch.id, function (err, data) {
              panelRestoreCheckpointProgress.finish(err);
              if (err) {
                  togglePanels(true);
              } else {
                  refreshBrowser();
              }
          });
      };

      if (! panelRestoreCheckpoint.discardChanges) {
          // take a checkpoint first
          createCheckpoint(config.self.branch.id, 'Checkpoint before restoring "' + panelRestoreCheckpoint.checkpoint.id.substring(0, 7) + '"', restore);
      } else {
          restore();
      }

  });

  // switch branch progress
  var panelSwitchBranchProgress = editor.call('picker:versioncontrol:createProgressWidget', {
      progressText: 'Switching branch',
      finishText: 'Switched branch - refreshing the browser',
      errorText: 'Failed to switch branch'
  });
  panelSwitchBranchProgress.hidden = true;
  panelRight.append(panelSwitchBranchProgress);

  var showRightSidePanel = function (panel) {
      // hide all right side panels first
      var p = panelRight.innerElement.firstChild;
      while (p && p.ui) {
          p.ui.hidden = true;
          p = p.nextSibling;
      }

      // show specified panel
      if (panel) {
          panel.hidden = false;
      }
  };

  var showCheckpoints = function () {
      showRightSidePanel(panelCheckpoints);
  };

  // new branch button
  // var btnNewBranch = new ui.Button({
  //     text: 'NEW BRANCH'
  // });
  // btnNewBranch.flexGrow = 1;
  // btnNewBranch.class.add('icon', 'create');
  // panelBranchesTop.append(btnNewBranch);

  // branch for which context menu is open
  var contextBranch = null;

  // branches context menu
  var menuBranches = new ui.Menu();
  menuBranches.class.add('version-control');

  // when the branches context menu is closed 'unclick' dropdowns
  menuBranches.on('open', function (open) {
      if (open || ! contextBranch) return;

      var item = document.getElementById('branch-' + contextBranch.id);
      if (! item) return;

      var dropdown = item.querySelector('.clicked');
      if (! dropdown) return;

      dropdown.classList.remove('clicked');
      dropdown.innerHTML = '&#57689;';

      if (! open) {
          contextBranch = null;
      }
  });

  // checkout branch
  var menuBranchesSwitchTo = new ui.MenuItem({
      text: 'Switch To This Branch',
      value: 'switch-branch'
  });
  menuBranches.append(menuBranchesSwitchTo);

  // switch to branch
  menuBranchesSwitchTo.on('select', function () {
      if (contextBranch) {
          togglePanels(false);
          showRightSidePanel(panelSwitchBranchProgress);
          editor.call('branches:checkout', contextBranch.id, function (err, data) {
              panelSwitchBranchProgress.finish(err);
              if (err) {
                  togglePanels(true);
              } else {
                  refreshBrowser();
              }
          });
      }
  });

  // merge branch
  var menuBranchesMerge = new ui.MenuItem({
      text: 'Merge Into Current Branch',
      value: 'merge-branch'
  });
  menuBranches.append(menuBranchesMerge);

  // merge branch
  menuBranchesMerge.on('select', function () {
      if (contextBranch) {
          showRightSidePanel(panelMergeBranches);
          panelMergeBranches.setSourceBranch(contextBranch);
          panelMergeBranches.setDestinationBranch(config.self.branch);
      }
  });


  // close branch
  var menuBranchesClose = new ui.MenuItem({
      text: 'Close This Branch',
      value: 'close-branch'
  });
  menuBranches.append(menuBranchesClose);

  // close branch
  menuBranchesClose.on('select', function () {
      if (contextBranch) {
          showRightSidePanel(panelCloseBranch);
          panelCloseBranch.setBranch(contextBranch);
      }
  });

  // open branch
  var menuBranchesOpen = new ui.MenuItem({
      text: 'Re-Open This Branch',
      value: 'open-branch'
  });
  menuBranches.append(menuBranchesOpen);

  // open branch
  menuBranchesOpen.on('select', function () {
      if (! contextBranch) return;

      var branch = contextBranch;

      togglePanels(false);
      showRightSidePanel(panelOpenBranchProgress);

      editor.call('branches:open', branch.id, function (err) {
          panelOpenBranchProgress.finish(err);
          if (err) {
              togglePanels(true);
          } else {
              // do this in a timeout to give time for the
              // success message to appear
              setTimeout(function () {
                  togglePanels(true);
                  showCheckpoints();
              }, 1000);
          }
      });
  });

  // Filter context menu items
  menuBranches.on('open', function () {
      var writeAccess = editor.call('permissions:write');

      menuBranchesClose.hidden = !writeAccess || !contextBranch || contextBranch.closed || contextBranch.id === config.project.masterBranch || contextBranch.id === projectUserSettings.get('branch');
      menuBranchesOpen.hidden = !writeAccess || !contextBranch || !contextBranch.closed;

      menuBranchesSwitchTo.hidden = !contextBranch || contextBranch.id === projectUserSettings.get('branch') || contextBranch.closed;
      menuBranchesMerge.hidden = !writeAccess || !contextBranch || contextBranch.id === projectUserSettings.get('branch') || contextBranch.closed;
  });

  editor.call('layout.root').append(menuBranches);


  var createBranchListItem = function (branch) {
      var item = new ui.ListItem({
          allowDeselect: false
      });
      item.branch = branch;
      item.element.id = 'branch-' + branch.id;

      var panel = new ui.Panel();
      item.element.appendChild(panel.element);

      var labelIcon = new ui.Label({
          text: '&#58208;',
          unsafe: true
      });
      labelIcon.class.add('icon');
      panel.append(labelIcon);

      var labelName = new ui.Label({
          text: branch.name
      });
      labelName.class.add('name', 'selectable');
      panel.append(labelName);

      var labelBranchId = new ui.Label({
          text: branch.id
      });
      labelBranchId.class.add('branch-id', 'selectable');
      panel.append(labelBranchId);

      // dropdown
      var dropdown = new ui.Button({
          text: '&#57689;'
      });
      dropdown.branch = branch;
      dropdown.class.add('dropdown');
      panel.append(dropdown);

      dropdown.on('click', function (e) {
          e.stopPropagation();

          if (panelCheckpoints.hidden) {
              showCheckpoints();
          }

          if (panelBranches.disabled) return;

          dropdown.class.add('clicked');
          dropdown.element.innerHTML = '&#57687;';

          contextBranch = branch;
          menuBranches.open = true;
          var rect = dropdown.element.getBoundingClientRect();
          menuBranches.position(rect.right - menuBranches.innerElement.clientWidth, rect.bottom);
      });

      listBranches.append(item);

      // select branch
      item.on('select', function () {
          selectBranch(branch);
      });

      // if we are currently showing an error and we click
      // on a branch that is already selected then hide the error
      // and show the checkpoints
      var wasItemSelectedBeforeClick = false;
      item.element.addEventListener('mousedown', function () {
          wasItemSelectedBeforeClick = item.selected;
      });
      item.element.addEventListener('mouseup', function () {
          if (! wasItemSelectedBeforeClick || ! item.selected) return;
          wasItemSelectedBeforeClick = false;

          if (editor.call('picker:versioncontrol:isErrorWidgetVisible')) {
              showCheckpoints();
          }
      });

      // if this is our current branch then change the status icon
      // and hide the dropdown button because it doesn't currently
      // have any available actions for the current branch
      if (branch.id === config.self.branch.id) {
          labelIcon.class.add('active');
          dropdown.hidden = true;
      }
  };

  // Get the list item for a branch
  var getBranchListItem = function (branchId) {
      var item = document.getElementById('branch-' + branchId);
      return item && item.ui;
  };

  // Select specified branch and show its checkpoints
  var selectBranch = function (branch) {
      selectedBranch = branch;
      showCheckpoints();

      panelCheckpoints.setBranch(branch);
      panelCheckpoints.loadCheckpoints();
  };

  var createCheckpoint = function (branchId, description, callback) {
      togglePanels(false);
      showRightSidePanel(panelCreateCheckpointProgress);

      editor.call('checkpoints:create', branchId, description, function (err, checkpoint) {
          panelCreateCheckpointProgress.finish(err);
          if (err) {
              return togglePanels(true);
          }

          callback(checkpoint);
      });
  };

  panelDiffCheckpoints.on('diff', function (srcBranchId, srcCheckpointId, dstBranchId, dstCheckpointId) {
      panelDiffCheckpoints.hidden = true;

      togglePanels(false);
      showRightSidePanel(panelGenerateDiffProgress);
      editor.call('diff:create', srcBranchId, srcCheckpointId, dstBranchId, dstCheckpointId, function (err, diff) {
          panelGenerateDiffProgress.finish(err);

          togglePanels(true);

          if (!err && diff.numConflicts === 0) {
              panelGenerateDiffProgress.setMessage("There are no changes");
              setTimeout(function () {
                  showCheckpoints();
              }, 1500);
          } else if (! err) {
              editor.call('picker:project:close');
              editor.call('picker:versioncontrol:mergeOverlay:hide'); // hide this in case it's open
              editor.call('picker:diffManager', diff);
          }
      });
  });

  // show create branch panel
  // btnNewBranch.on('click', function () {
  //     showRightSidePanel(panelCreateBranch);
  //     panelCreateBranch.setSourceBranch(config.self.branch);
  //     if (config.self.branch.latestCheckpointId) {
  //         panelCreateBranch.setCheckpointId(config.self.branch.latestCheckpointId);
  //     }
  // });

  // Create checkpoint
  panelCreateCheckpoint.on('cancel', function () {
      // we need to load the checkpoints if we cancel creating checkpoints
      // because initially we might have opened this picker by showing the create checkpoint
      // panel without having a chance to load the checkpoints first
      if (! panelCheckpoints.checkpoints)  {
          selectBranch(selectedBranch);
      } else {
          showCheckpoints();
      }
  });
  panelCreateCheckpoint.on('confirm', function (data) {
      createCheckpoint(config.self.branch.id, data.description, function (checkpoint) {
          setTimeout(function () {
              togglePanels(true);

              // show checkpoints unless they haven't been loaded yet in which
              // case re-select the branch which reloads the checkpoints
              if (! panelCheckpoints.checkpoints) {
                  selectBranch(selectedBranch);
              } else {
                  showCheckpoints();
              }
          },  1000);
      });
  });

  // Create branch
  panelCreateBranch.on('cancel', showCheckpoints);
  panelCreateBranch.on('confirm', function (data) {
      togglePanels(false);
      showRightSidePanel(panelCreateBranchProgress);

      var params = {
          name: data.name,
          projectId: config.project.id,
          sourceBranchId: panelCheckpoints.branch.id
      };

      if (panelCreateBranch.checkpoint) {
          params.sourceCheckpointId = panelCreateBranch.checkpoint.id;
      }

      editor.call('branches:create', params, function (err, branch) {
          panelCreateBranchProgress.finish(err);
          if (err) {
              togglePanels(true);
          } else {
              refreshBrowser();
          }
      });
  });

  // Enable or disable the clickable parts of this picker
  var togglePanels = function (enabled) {
      editor.call('picker:project:setClosable', enabled && config.scene.id);
      editor.call('picker:project:toggleLeftPanel', enabled);
      // panelBranchesTop.disabled = !enabled;
      panelBranches.disabled = !enabled;
      panelBranchesFilter.disabled = !enabled;
  };

  var refreshBrowser = function () {
      // Do this in a timeout to give some time to the user
      // to read any information messages.
      // Also file picker-version-control-messenger.js will actually
      // refresh the browser first - so this is here really to make sure
      // the browser is refreshed if for some reason the messenger fails to deliver the message.
      // That's why the timeout here is larger than what's in picker-version-control-messenger
      setTimeout(function () {
          window.location.reload();
      }, 2000);
  };

  var loadBranches = function () {
      // change status of loading button
      btnLoadMoreBranches.disabled = true;
      btnLoadMoreBranches.text = 'LOADING...';

      // if we are reloading
      // clear branch from checkpoints so that checkpoints are also hidden
      if (! branchesSkip) {
          panelCheckpoints.setBranch(null);
          selectedBranch = null;
      }

      // request branches from server
      editor.call('branches:list', {
          limit: 20,
          skip: branchesSkip,
          closed: fieldBranchesFilter.value === 'closed'
      }, function (err, data) {
          if (err) {
              return console.error(err);
          }

          // change status of loading button
          btnLoadMoreBranches.disabled = false;
          btnLoadMoreBranches.text = 'LOAD MORE';
          loadMoreListItem.hidden = !data.pagination.hasMore;


          // if we are re-loading the branch list then clear the current items
          if (! branchesSkip) {
              listBranches.clear();
              branches = {};

              // create current branch as first item
              if (fieldBranchesFilter.value !== 'closed') {
                  createBranchListItem(config.self.branch);
              }
          }

          // use last item as a marker for loading the next batch of branches
          var lastItem = data.result[data.result.length - 1];
          branchesSkip = lastItem ? lastItem.id : null;

          if (! data.result[0]) return;

          // convert array to dict
          branches = data.result.reduce(function (map, branch) {
              map[branch.id] = branch;
              return map;
          }, branches);

          var selected = selectedBranch;

          // create list items for each branch
          data.result.forEach(function (branch) {
              // skip the current branch as we've already
              // created that first
              if (branch.id !== config.self.branch.id) {
                  createBranchListItem(branch);
              }
          });

          // if we didn't find a proper selection then select our branch
          if (! selected) {
              selected = config.self.branch;
          }

          if (selected) {
              var item = getBranchListItem(selected.id);
              if (item) {
                  item.selected = true;
              }
          }

          // add load more list item in the end
          listBranches.append(loadMoreListItem);

          // show new checkpoint panel if necessary
          if (showNewCheckpointOnLoad) {
              showNewCheckpointOnLoad = false;
              showRightSidePanel(panelCreateCheckpoint);
          }
      });
  };

  // When the filter changes clear our branch list and reload branches
  fieldBranchesFilter.on('change', function () {
      branchesSkip = null;
      listBranches.clear();
      loadBranches();
  });

  // on show
  panel.on('show', function () {
      showCheckpoints();

      // load and create branches
      branchesSkip = null;
      selectedBranch = null;
      loadBranches();

      events.push(editor.on('permissions:writeState', function (writeEnabled) {
          // hide all dropdowns if we no longer have write access
          panelBranches.innerElement.querySelectorAll('.dropdown').forEach(function (dropdown) {
              dropdown.ui.hidden = ! writeEnabled || dropdown.ui.branch.id === config.self.branch.id;
          });
      }));

      // when a checkpoint is created add it to the list
      events.push(editor.on('messenger:checkpoint.createEnded', function (data) {
          if (data.status === 'error') return;

          // update latest checkpoint in current branches
          if (branches[data.branch_id]) {
              branches[data.branch_id].latestCheckpointId = data.checkpoint_id;
          }

          // add new checkpoint to checkpoint list
          // but only if the checkpoints panel has loaded its checkpoints.
          // Otherwise do not add it but wait until the panel is shown and all of its checkpoints
          // (including the new one) are loaded
          if (panelCheckpoints.branch.id === data.branch_id) {
              var existingCheckpoints = panelCheckpoints.checkpoints;
              if (existingCheckpoints) {
                  existingCheckpoints.unshift({
                      id: data.checkpoint_id,
                      user: {
                          id: data.user_id,
                          fullName: data.user_full_name
                      },
                      createdAt: new Date(data.created_at),
                      description: data.description
                  });
                  panelCheckpoints.setCheckpoints(existingCheckpoints);
              }
          }
      }));

      // when a branch is closed remove it from the list and select the next one
      events.push(editor.on('messenger:branch.close', function (data) {
          if (fieldBranchesFilter.value === 'closed') {
              return;
          }

          // we are seeing the open branches view so remove this branch from the list
          // and select the next branch
          var item = getBranchListItem(data.branch_id);
          if (! item) return;

          var nextItem = null;
          if (item.selected) {
              if (item.element.nextSibling !== loadMoreListItem.element) {
                  nextItem = item.element.nextSibling;
              }

              if (! nextItem) {
                  nextItem = item.element.previousSibling;
              }
          }

          listBranches.remove(item);

          // select next or previous sibling
          if (nextItem && nextItem !== loadMoreListItem.element) {

              // if the progress panel is open it means we are the ones
              // closing the branch (or some other branch..) - so wait a bit
              // so that we can show the progress end message before selecting another branch
              if (! panelCloseBranchProgress.hidden) {
                  setTimeout(function () {
                      nextItem.ui.selected = true;
                  }, 500);
              } else {
                  // otherwise immediately select the next branch
                  nextItem.ui.selected = true;
              }
          }
      }));

      events.push(editor.on('messenger:branch.open', function (data) {
          if (fieldBranchesFilter.value === 'open') {
              return;
          }

          // we are seeing the closed branches list so remove this
          // branch from this list and select the next one or if there
          // are no more branches in this list then view the open branches
          var item = getBranchListItem(data.branch_id);
          if (! item) return;

          var wasSelected = item.selected;
          var nextItem = null;
          if (item.element.nextSibling !== loadMoreListItem.element) {
              nextItem = item.element.nextSibling;
          }

          if (! nextItem) {
              nextItem = item.element.previousSibling;
          }

          // remove branch from the list
          listBranches.remove(item);

          // select next or previous item
          var selectNext = function () {
              if (nextItem && wasSelected) {
                  nextItem.ui.selected = true;
              } else if (! nextItem) {
                  // if no more items exist in the list then view the open list
                  showRightSidePanel(null);
                  fieldBranchesFilter.value = 'open';
              }
          };

          // if the progress panel is open it means we are the ones
          // opening the branch (or some other branch..) - so wait a bit
          // so that we can show the progress end message before selecting another branch
          if (! panelOpenBranchProgress.hidden) {
              setTimeout(selectNext, 500);
          } else {
              // otherwise immediately select the next branch
              selectNext();
          }

      }));

      if (editor.call('viewport:inViewport')) {
          editor.emit('viewport:hover', false);
      }
  });

  // on hide
  panel.on('hide', function () {
      showRightSidePanel(null);

      // clear checkpoint
      panelCheckpoints.setCheckpoints(null);
      panelCheckpoints.toggleLoadMore(false);

      // hide diff panel
      panelDiffCheckpoints.hidden = true;

      showNewCheckpointOnLoad = false;

      events.forEach(function (evt) {
          evt.unbind();
      });
      events.length = 0;

      if (editor.call('viewport:inViewport')) {
          editor.emit('viewport:hover', true);
      }
  });

  // Prevent viewport hovering when the picker is shown
  editor.on('viewport:hover', function (state) {
      if (state && ! panel.hidden) {
          setTimeout(function () {
              editor.emit('viewport:hover', false);
          }, 0);
      }
  });

  // Show the picker
  editor.method('picker:versioncontrol', function () {
      editor.call('picker:project', 'version control');
  });

  // hotkey to create new checkpoint
  editor.call('hotkey:register', 'new-checkpoint', {
      key: 's',
      ctrl: true,
      callback: function (e) {
          if (! editor.call('permissions:write')) return;
          if (editor.call('picker:isOpen:otherThan', 'project')) {
              return;
          }

          if (panel.hidden) {
              showNewCheckpointOnLoad = true;
              editor.call('picker:versioncontrol');
          } else {
              showRightSidePanel(panelCreateCheckpoint);
          }
      }
  });

});


/* editor/pickers/version-control/picker-version-control-overlay-message.js */
editor.once('load', function () {
  'use strict';

  editor.method('picker:versioncontrol:createOverlay', function (args) {
      // overlay
      var overlay = new ui.Overlay();
      overlay.class.add('version-control-overlay');
      overlay.clickable = false;
      overlay.hidden = true;

      var root = editor.call('layout.root');
      root.append(overlay);

      // main panel
      var panel = new ui.Panel();
      panel.class.add('main');
      overlay.append(panel);

      // icon on the left
      var panelIcon = new ui.Panel();
      panelIcon.class.add('left');
      panel.append(panelIcon);

      panelIcon.innerElement.appendChild(args.icon);

      // content on the right
      var panelRight = new ui.Panel();
      panelRight.class.add('right');
      panel.append(panelRight);

      // title
      var labelTitle = new ui.Label({
          text: args.title
      });
      labelTitle.renderChanges = false;
      labelTitle.class.add('title');
      panelRight.append(labelTitle);

      // message
      var labelMessage = new ui.Label({
          text: args.message
      });
      labelMessage.renderChanges = false;
      labelMessage.class.add('message');
      panelRight.append(labelMessage);

      // public methods
      overlay.setMessage = function (msg) {
          labelMessage.text = msg;
      };

      overlay.setTitle = function (title) {
          labelTitle.text = title;
      };

      overlay.on('show', function () {
          if (editor.call('picker:versioncontrol:isProgressWidgetVisible')) {
              overlay.class.add('show-behind-picker');
          }

          // editor-blocking popup opened
          editor.emit('picker:open', 'version-control-overlay');
      });

      overlay.on('hide', function () {
          // editor-blocking popup closed
          editor.emit('picker:close', 'version-control-overlay');
      });

      return overlay;

  });
});


/* editor/pickers/version-control/picker-version-control-messenger.js */
editor.once('load', function () {
  'use strict';

  var currentCheckpointBeingCreated = null;

  var overlayBranchSwitched = editor.call('picker:versioncontrol:createOverlay', {
      message: 'Refreshing browser window...',
      icon: editor.call('picker:versioncontrol:svg:completed', 50)
  });

  var overlayCreatingCheckpoint = editor.call('picker:versioncontrol:createOverlay', {
      message: 'Please wait while the checkpoint is being created.',
      icon: editor.call('picker:versioncontrol:svg:spinner', 50)
  });

  var overlayRestoringCheckpoint = editor.call('picker:versioncontrol:createOverlay', {
      message: 'Please wait while the checkpoint is restored.',
      icon: editor.call('picker:versioncontrol:svg:spinner', 50)
  });

  var overlayCheckpointRestored = editor.call('picker:versioncontrol:createOverlay', {
      message: 'Refreshing browser window...',
      icon: editor.call('picker:versioncontrol:svg:completed', 50)
  });

  var overlayBranchClosed = editor.call('picker:versioncontrol:createOverlay', {
      title: 'This branch has been closed.',
      message: 'Switching to master branch...',
      icon: editor.call('picker:versioncontrol:svg:spinner', 50)
  });

  var overlayMergeStopped = editor.call('picker:versioncontrol:createOverlay', {
      message: 'Refreshing browser...',
      icon: editor.call('picker:versioncontrol:svg:error', 50)
  });

  var overlayMergeCompleted = editor.call('picker:versioncontrol:createOverlay', {
      title: 'Merge completed.',
      message: 'Refreshing browser...',
      icon: editor.call('picker:versioncontrol:svg:completed', 50)
  });


  // don't let the user's full name be too big
  var truncateFullName = function (fullName) {
      return fullName.length > 36 ? fullName.substring(0, 33) + '...' : fullName;
  };

  // If we are currently in a scene this will first request the
  // scene from the server. If the scene no longer exists then we will
  // refresh to the Project URL. If the scene exists then just refresh the browser window
  var refresh = function () {
      setTimeout(function () {
          if (config.scene && config.scene.id) {
              editor.call('scenes:get', config.scene.id, function (err, data) {
                  if (err || ! data) {
                      window.location = '/editor/project/' + config.project.id + window.location.search;
                  } else {
                      window.location.reload();
                  }
              });
          } else {
              window.location.reload();
          }
      }, 1000);
  };

  // show overlay when branch ended
  editor.on('messenger:branch.createEnded', function (data) {
      if (data.status === 'error' || data.user_id !== config.self.id) {
          return;
      }

      // if this is us then we need to refresh the browser
      config.self.branch.id = data.branch_id;
      overlayBranchSwitched.setTitle('Switched to branch "' + data.name + '"');
      overlayBranchSwitched.hidden = false;
      refresh();
  });

  // show overlay when the branch of this user has been changed
  editor.on('messenger:branch.switch', function (data) {
      if (data.project_id !== config.project.id) {
          return;
      }

      config.self.branch.id = data.branch_id;
      overlayBranchSwitched.setTitle('Switched to branch "' + data.name + '"');
      overlayBranchSwitched.hidden = false;
      refresh();
  });

  // Show overlay when checkpoint started being created
  editor.on('messenger:checkpoint.createStarted', function (data) {
      if (data.branch_id !== config.self.branch.id) return;

      currentCheckpointBeingCreated = data.checkpoint_id;
      overlayCreatingCheckpoint.setTitle(truncateFullName(data.user_full_name) + ' is creating a checkpoint.');
      overlayCreatingCheckpoint.hidden = false;
  });

  // If the checkpoint that was being created finished and we were showing an
  // overlay for it then hide that overlay
  editor.on('messenger:checkpoint.createEnded', function (data) {
      if (data.checkpoint_id !== currentCheckpointBeingCreated) return;
      currentCheckpointBeingCreated = null;
      overlayCreatingCheckpoint.hidden = true;

      // update latest checkpoint in branch
      if (data.status !== 'error' && data.branch_id === config.self.branch.id) {
          config.self.branch.latestCheckpointId = data.checkpoint_id;
      }
  });

  // show overlay when checkpoint starts being restored
  editor.on('messenger:checkpoint.revertStarted', function (data) {
      if (data.branch_id !== config.self.branch.id) return;
      overlayRestoringCheckpoint.setTitle(truncateFullName(data.user_full_name) + ' is restoring checkpoint ' + data.checkpoint_id.substring(0, 7));
      overlayRestoringCheckpoint.hidden = false;
  });

  // show overlay when checkpoint was restored
  editor.on('messenger:checkpoint.revertEnded', function (data) {
      if (data.branch_id !== config.self.branch.id) return;
      if (data.status === 'success') {
          overlayRestoringCheckpoint.hidden = true;
          overlayCheckpointRestored.setTitle(truncateFullName(data.user_full_name) + ' restored checkpoint ' + data.checkpoint_id.substring(0, 7));
          overlayCheckpointRestored.hidden = false;
          refresh();
      } else {
          // hide the overlay
          overlayRestoringCheckpoint.hidden = true;
      }
  });

  // show overlay if our current branch was closed
  editor.on('messenger:branch.close', function (data) {
      if (data.branch_id !== config.self.branch.id) return;

      overlayBranchClosed.hidden = false;

      // check out master branch and then refresh the browser
      Ajax({
          url: '/api/branches/{{project.masterBranch}}/checkout',
          method: 'POST',
          auth: true
      })
      .on('load', refresh)
      .on('error', refresh);
  });

  // if a merge has started for our branch then show overlay
  editor.on('messenger:merge.new', function (data) {
      if (data.dst_branch_id !== config.self.branch.id) return;

      config.self.branch.merge = {
          id: data.merge_id,
          user: {
              id: data.user_id,
              fullName: data.user_full_name
          }
      };

      editor.call('picker:versioncontrol:mergeOverlay');
  });

  // show overlay if the current merge has been force stopped
  editor.on('messenger:merge.delete', function (data) {
      if (! config.self.branch.merge) return;
      if (config.self.branch.merge.id !== data.merge_id) return;

      editor.call('picker:versioncontrol:mergeOverlay:hide');

      var name = data.user.length > 33 ? data.user.substring(0, 30) + '...' : data.user;
      overlayMergeStopped.setTitle('Merge force stopped by ' + name);
      overlayMergeStopped.hidden = false;
      setTimeout(refresh, 1000); // delay this a bit more
  });

  // show overlay when merge is complete and refresh browser
  editor.on('messenger:merge.complete', function (data) {
      if (data.dst_branch_id !== config.self.branch.id) return;
      if (editor.call('picker:isOpen', 'conflict-manager')) return;

      editor.call('picker:versioncontrol:mergeOverlay:hide');
      overlayMergeCompleted.hidden = false;
      refresh();
  });

  // if we stopped the merge but the conflict manager is open then show the overlay behind the conflict manager
  overlayMergeStopped.on('show', function () {
      if (editor.call('picker:isOpen', 'conflict-manager')) {
          overlayMergeStopped.class.add('show-behind-picker');
      } else {
          overlayMergeStopped.class.remove('show-behind-picker');
      }
  });
});


/* editor/pickers/version-control/picker-version-control-overlay-merge.js */
editor.once('load', function () {
  'use strict';

  var icon = document.createElement('div');
  icon.classList.add('icon');
  icon.innerHTML = '&#57880;';

  var overlay = editor.call('picker:versioncontrol:createOverlay', {
      message: 'Please wait until merging has been completed',
      icon: icon
  });
  overlay.class.add('merge-overlay');

  // switch to branch ui
  var panelSwitch = new ui.Panel();
  panelSwitch.class.add('switch-branch');
  var labelSwitch = new ui.Label({
      text: 'Switch to'
  });
  panelSwitch.append(labelSwitch);

  var dropdownBranches = new ui.SelectField({
      placeholder: 'Select Branch'
  });
  panelSwitch.append(dropdownBranches);

  var btnSwitch = new ui.Button({
      text: 'SWITCH'
  });
  btnSwitch.disabled = true;
  panelSwitch.append(btnSwitch);
  overlay.innerElement.querySelector('.right').ui.append(panelSwitch);

  // switch to branch
  btnSwitch.on('click', function () {
      overlay.innerElement.classList.add('hidden'); // hide the inner contents of the overlay but not the whole overlay
      editor.call('branches:checkout', dropdownBranches.value, refresh);
  });

  // If we are currently in a scene this will first request the
  // scene from the server. If the scene no longer exists then we will
  // refresh to the Project URL. If the scene exists then just refresh the browser window
  var refresh = function () {
      setTimeout(function () {
          if (config.scene && config.scene.id) {
              editor.call('scenes:get', config.scene.id, function (err, data) {
                  if (err || ! data) {
                      window.location = '/editor/project/' + config.project.id + window.location.search;
                  } else {
                      window.location.reload();
                  }
              });
          } else {
              window.location.reload();
          }
      }, 1000);
  };

  // bottom buttons panel
  var panelButtons = new ui.Panel();
  panelButtons.class.add('buttons');
  overlay.append(panelButtons);

  var btnForceStopMerge = new ui.Button({
      text: 'FORCE STOP MERGE'
  });
  btnForceStopMerge.disabled = ! editor.call('permissions:write');
  panelButtons.append(btnForceStopMerge);
  btnForceStopMerge.on('click', function () {
      editor.call('picker:confirm', 'Are you sure you want to force stop this merge process?', function () {
          overlay.innerElement.classList.add('hidden'); // hide the inner contents of the overlay but not the whole overlay
          editor.call('branches:forceStopMerge', config.self.branch.merge.id, function (err, data) {
              window.location.reload();
          });
      });
  });

  // load 100 branches
  var branches = [];
  var loadBranches = function (skip, fn) {
      var params = {};
      if (skip) {
          params.skip = skip;
      }
      editor.call('branches:list', params, function (err, data) {
          if (err) {
              console.error(err);
              return;
          }

          var lastBranch = data.result[data.result.length - 1];

          // remove 'our' branch
          for (var i = 0; i < data.result.length; i++) {
              if (data.result[i].id === config.self.branch.id) {
                  data.result.splice(i, 1);
                  break;
              }
          }

          // concatenate result and load more branches
          branches = branches.concat(data.result);
          if (lastBranch && data.pagination.hasMore && branches.length < 100) {
              loadBranches(lastBranch.id, fn);
          } else {
              fn();
          }
      });
  };

  overlay.on('show', function () {
      loadBranches(null, function () {
          if (! branches.length) {
              return;
          }

          // update dropdown
          btnSwitch.disabled = false;
          dropdownBranches._updateOptions(branches.map(function (branch) {
              return {
                  v: branch.id, t: branch.name
              };
          }));
          dropdownBranches.value = branches[0].id;
      });
  });

  overlay.on('hide', function () {
      dropdownBranches._updateOptions({});
      dropdownBranches.value = null;
      btnSwitch.disabled = true;
  });

  editor.method('picker:versioncontrol:mergeOverlay', function () {
      var fullName = config.self.branch.merge.user.fullName;
      if (fullName && fullName.length > 33) {
          fullName = fullName.substring(0, 30) + '...';
      }

      overlay.setTitle(fullName ? fullName + ' is merging branches' : 'Merge in progress');
      overlay.hidden = false;
  });

  editor.method('picker:versioncontrol:mergeOverlay:hide', function () {
      overlay.hidden = true;
  });
});


/* editor/pickers/conflict-manager/picker-conflict-manager-section-field.js */
editor.once('load', function () {
  'use strict';

  // Base class for fields
  var ConflictField = function () {
      this.element = null;
  };

  // Creates a field with the specified value based on the specified type
  ConflictField.create = function (type, value) {
      switch (type) {
          case 'asset':
              return new ConflictFieldAsset(value);
          case 'curve':
          case 'curveset':
              return new ConflictFieldCurve(value);
          case 'entity':
              return new ConflictFieldEntity(value);
          case 'layer':
          case 'batchGroup':
              return new ConflictFieldLayer(value);
          case 'sublayer':
              return new ConflictFieldSublayer(value);
          case 'vec2':
          case 'vec3':
          case 'vec4':
              return new ConflictFieldVector(value);
          case 'rgb':
          case 'rgba':
              return new ConflictFieldColor(value);
          case 'object':
              return new ConflictFieldNotRenderable();
          default:
              return new ConflictFieldString(value);
      }
  };

  ConflictField.prototype.onAddedToDom = function () {
      // reset height
      this.element.parent.style.height = '';
  };

  // Gets / sets the height of the field
  Object.defineProperty(ConflictField.prototype, 'height', {
      get: function () {
          return this.element.parent.element.clientHeight;
      },
      set: function (value) {
          this.element.parent.style.height = value + 'px';
      }
  });

  // A String field
  var ConflictFieldString = function (value) {
      this.element = new ui.Label({
          text: value + ''
      });
      this.element.class.add('field-string', 'selectable');
  };
  ConflictFieldString.prototype = Object.create(ConflictField.prototype);

  // A Vector field
  var ConflictFieldVector = function (value) {
      var panel = new ui.Panel();
      var vars = ['x: ', 'y: ', 'z: ', 'w: '];
      for (var i = 0; i < value.length; i++) {
          var label = new ui.Label({
              text: vars[i] + value[i] + ''
          });
          label.class.add('selectable');
          panel.append(label);
      }

      this.element = panel;
      this.element.class.add('field-vector');
  };
  ConflictFieldVector.prototype = Object.create(ConflictField.prototype);

  // A Color field
  var ConflictFieldColor = function (value) {
      this.element = new ui.ColorField();
      this.element.value = value.map(function (c) { return c * 255; });
      this.element.class.add('field-color');
  };
  ConflictFieldColor.prototype = Object.create(ConflictField.prototype);

  // A Curve field
  var ConflictFieldCurve = function (value) {
      this.element = new ui.CurveField({
          lineWidth: 3
      });
      this.element.value = value ? [value] : null;
      this.element.class.add('field-curve');
  };
  ConflictFieldCurve.prototype = Object.create(ConflictField.prototype);

  // An Asset field
  var ConflictFieldAsset = function (value) {
      this.element = new ui.Panel();
      this.element.class.add('field-asset');

      if (value && value.name) {
          var labelName = new ui.Label({
              text: value.name
          });
          labelName.class.add('asset-name', 'selectable');
          this.element.append(labelName);
      }

      var labelId = new ui.Label({
          text: value ? 'ID: ' + value.id : value + ''
      });
      labelId.class.add('asset-id', 'selectable');
      this.element.append(labelId);
  };
  ConflictFieldAsset.prototype = Object.create(ConflictField.prototype);

  // An Entity field
  var ConflictFieldEntity = function (value) {
      this.element = new ui.Panel();
      this.element.class.add('field-entity');

      if (value) {
          if (value.deleted) {
              var labelDeleted = new ui.Label({
                  text: 'The following parent was deleted on this branch:'
              });
              labelDeleted.class.add('deleted');
              this.element.append(labelDeleted);
          }

          if (value.name) {
              var labelName = new ui.Label({
                  text: value.name
              });
              labelName.class.add('entity-name', 'selectable');
              this.element.append(labelName);
          }
      }

      var labelId = new ui.Label({
          text: value ? 'GUID: ' + value.id : value + ''
      });
      labelId.class.add('entity-id', 'selectable');
      this.element.append(labelId);
  };
  ConflictFieldEntity.prototype = Object.create(ConflictField.prototype);

  // A Layer field
  var ConflictFieldLayer = function (value) {
      this.element = new ui.Label({
          text: value !== null && value !== undefined ? (value.name || value.id) : value + ''
      });
      this.element.class.add('field-layer', 'selectable');
  };
  ConflictFieldLayer.prototype = Object.create(ConflictField.prototype);

  // A sublayer field
  var ConflictFieldSublayer = function (value) {
      this.element = new ui.Label({
          text: value ? value.layer + ' ' + (value.transparent ? 'Transparent' : 'Opaque') : value
      });
      this.element.class.add('field-sublayer', 'selectable');
  };
  ConflictFieldSublayer.prototype = Object.create(ConflictField.prototype);


  // A field saying that the object was deleted in one branch
  var ConflictFieldDeleted = function () {
      this.element = new ui.Panel();
      this.element.class.add('field-deleted');

      var label =  new ui.Label({
          text: 'DELETED'
      });
      label.class.add('title');
      this.element.append(label);

      label =  new ui.Label({
          text: 'This item was deleted on this branch'
      });
      this.element.append(label);
  };
  ConflictFieldDeleted.prototype = Object.create(ConflictField.prototype);

  // A field saying that the object was created in this branch
  var ConflictFieldCreated = function () {
      this.element = new ui.Panel();
      this.element.class.add('field-edited');

      var label =  new ui.Label({
          text: 'CREATED'
      });
      label.class.add('title');
      this.element.append(label);

      label =  new ui.Label({
          text: 'This item was created on this branch'
      });
      this.element.append(label);
  };
  ConflictFieldCreated.prototype = Object.create(ConflictField.prototype);

  // A field saying that the object was edited in one branch
  var ConflictFieldEdited = function () {
      this.element = new ui.Panel();
      this.element.class.add('field-edited');

      var label =  new ui.Label({
          text: 'EDITED'
      });
      label.class.add('title');
      this.element.append(label);

      label =  new ui.Label({
          text: 'This item was edited on this branch'
      });
      this.element.append(label);
  };
  ConflictFieldEdited.prototype = Object.create(ConflictField.prototype);

  // A field saying that no value is available
  var ConflictFieldNotAvailable = function (value) {
      this.element = new ui.Label({
          text: 'Not available'
      });
      this.element.class.add('field-missing');
  };
  ConflictFieldNotAvailable.prototype = Object.create(ConflictField.prototype);

  // A field saying that its value is not renderable
  var ConflictFieldNotRenderable = function (value) {
      this.element = new ui.Label({
          text: 'No preview available'
      });
      this.element.class.add('field-missing');
  };
  ConflictFieldNotRenderable.prototype = Object.create(ConflictField.prototype);

  // An array field is a list of other fields
  var ConflictArrayField = function (type, value) {
      this._size = value.length;

      this.element = new ui.Panel();
      this.element.class.add('field-array');
      this._labelSize = new ui.Label({
          text: 'Array Size: ' + this._size
      });
      this._labelSize.class.add('size');
      this.element.append(this._labelSize);

      this._list = new ui.List();

      for (var i = 0; i < this._size; i++) {
          var item = new ui.ListItem();
          var field = ConflictField.create(type, value[i]);
          field.element.class.add('array-' + type);
          item.element.appendChild(field.element.element);
          this._list.append(item);
      }

      this.element.append(this._list);
  };
  ConflictArrayField.prototype = Object.create(ConflictField.prototype);

  Object.defineProperty(ConflictArrayField.prototype, 'size', {
      get: function () {
          return this._size;
      }
  });

  window.ui.ConflictField = ConflictField;
  window.ui.ConflictArrayField = ConflictArrayField;
  window.ui.ConflictFieldDeleted = ConflictFieldDeleted;
  window.ui.ConflictFieldCreated = ConflictFieldCreated;
  window.ui.ConflictFieldEdited = ConflictFieldEdited;
  window.ui.ConflictFieldNotAvailable = ConflictFieldNotAvailable;
  window.ui.ConflictFieldNotRenderable = ConflictFieldNotRenderable;
});


/* editor/pickers/conflict-manager/picker-conflict-manager-section-row.js */
editor.once('load', function () {
  'use strict';

  var BASE_PANEL = 0;
  var DEST_PANEL = 1;
  var SOURCE_PANEL = 2;

  /**
   * A row that contains the base, source and destination fields.
   * @param {Object} resolver The conflict resolver object
   * @param {Object} args The arguments
   * @param {String} args.name The name of the field
   * @param {Boolean} args.noPath If true then this field has no path (which means the whole object is considered to be a conflict e.g. a whole asset)
   * @param {String} args.type The type of the field (if same type for base, source and destination values)
   * @param {String} args.baseType The type of the base value
   * @param {String} args.sourceType The type of the source value
   * @param {String} args.destType The type of the destination value
   * @param {Object} args.conflict The conflict object
   * @param {Boolean} args.prettify If true the name will be prettified
   */
  var ConflictSectionRow = function (resolver, args) {
      Events.call(this);

      var self = this;
      this._resolver = resolver;
      this._name = args.name;
      if (args.type) {
          this._types = [args.type, args.type, args.type];
      } else {
          this._types = [args.baseType || '', args.destType || '', args.sourceType || ''];
      }
      this._conflict = args.conflict;
      this._resolved = false;

      this._indent = 0;

      this._panels = [];
      this._fields = [];

      var values = this._convertValues(self._conflict);

      // Create 3 panels for base, source and destionation values
      for (var i = 0; i < 3; i++) {
          var panel = new ui.Panel();
          panel.class.add('conflict-field');
          var isArray = self._types[i].startsWith('array:');
          if (isArray) {
              panel.class.add('field-array-container');
              self._types[i] = self._types[i].slice('array:'.length);
          }
          this._panels.push(panel);

          if (!resolver.isDiff) {
              panel.on('hover', this._onHover.bind(this));
              panel.on('blur', this._onUnHover.bind(this));
          }

          // Add indentation to all panels
          // except the base
          if (i !== BASE_PANEL) {
              if (this._indent) {
                  panel.class.add('indent-' + this._indent);
              }
          }

          var label = null;
          if (self._name) {
              label = new ui.Label({
                  text: (args.prettify ? this._prettifyName(self._name) : self._name) + ' :'
              });
              label.class.add('name');
              panel.append(label);
          }

          var field = null;

          if (this._wasMissing(i, self._conflict, resolver.isDiff)) {
              field = new ui.ConflictFieldNotAvailable();
          } else if (this._wasDeleted(i, self._conflict, resolver.isDiff)) {
              field = new ui.ConflictFieldDeleted();
          } else if (this._wasCreated(i, self._conflict, resolver.isDiff)) {
              field = new ui.ConflictFieldCreated();
          } else if (self._types[i].endsWith('object') || args.noPath) {
              if (this._wasEdited(i, self._conflict, resolver.isDiff)) {
                  field = new ui.ConflictFieldEdited();
              } else {
                  field = new ui.ConflictFieldNotRenderable();
              }
          }

          // if for some reason the value is undefined (e.g it could have been too big)
          // then show a missing field
          if (! field && values[i] === undefined) {
              field = new ui.ConflictFieldNotAvailable();
          }

          if (! field) {
              if (isArray) {
                  field = new ui.ConflictArrayField(self._types[i], values[i]);
              } else {
                  field = ui.ConflictField.create(self._types[i], values[i]);
              }
          }

          field.element.class.add('value');
          this._fields.push(field);

          panel.append(field.element);
      }

      if (self._conflict.useSrc) {
          this._panels[SOURCE_PANEL].class.add('selected');
          this._resolved = true;
      } else if (self._conflict.useDst) {
          this._panels[DEST_PANEL].class.add('selected');
          this._resolved = true;
      }

      if (!resolver.isDiff) {
          this._panels[SOURCE_PANEL].on('click', function () {
              if (self._conflict.useSrc) {
                  self.unresolve();
              } else {
                  self.resolveUsingSource();
              }
          });

          this._panels[DEST_PANEL].on('click', function () {
              if (self._conflict.useDst) {
                  self.unresolve();
              } else {
                  self.resolveUsingDestination();
              }
          });
      }
  };

  ConflictSectionRow.prototype = Object.create(Events.prototype);

  ConflictSectionRow.prototype._wasMissing = function (side, conflict, isDiff) {
      if (side === BASE_PANEL && conflict.missingInBase) {
          return true;
      }
      if (side === SOURCE_PANEL && conflict.missingInSrc) {
          if (isDiff) {
              return conflict.missingInDst;
          }
          return conflict.missingInBase;
      }

      if (side === DEST_PANEL && conflict.missingInDst) {
          if (isDiff) {
              return true;
          }
          return conflict.missingInBase;
      }

      return false;
  };

  ConflictSectionRow.prototype._wasDeleted = function (side, conflict, isDiff) {
      if (side === SOURCE_PANEL) {
          if (conflict.missingInSrc) {
              if (isDiff) {
                  return !conflict.missingInDst;
              }
              return !conflict.missingInBase;
          }
      } else if (side === DEST_PANEL) {
          if (conflict.missingInDst) {
              if (isDiff) {
                  // for diffs 'dest' is considered to be the base
                  return false;
              }
              return !conflict.missingInBase;
          }
      }

      return false;
  };

  ConflictSectionRow.prototype._wasCreated = function (side, conflict, isDiff) {
      if (side === SOURCE_PANEL) {
          if (!conflict.missingInSrc) {
              if (isDiff) {
                  return conflict.missingInDst;
              }
              return conflict.missingInBase;
          }
      } else if (side === DEST_PANEL) {
          if (!conflict.missingInDst) {
              if (isDiff) {
                  // we assume the base is the dest when diffing
                  return false;
              }
              return conflict.missingInBase;
          }
      }

      return false;
  };

  ConflictSectionRow.prototype._wasEdited = function (side, conflict, isDiff) {
      if (side === SOURCE_PANEL) {
          if (!conflict.missingInSrc) {
              if (isDiff) {
                  return !conflict.missingInDst;
              }
              return !conflict.missingInBase;
          }
      } else if (side === DEST_PANEL) {
          if (!conflict.missingInDst) {
              if (isDiff) {
                  // we assume the base is the dest when diffing
                  return false;
              }
              return !conflict.missingInBase;
          }
      }

      return false;
  };

  // Returns an array of the 3 values (base, source, dest) after it converts
  // those values from IDs to names (if necessary)
  ConflictSectionRow.prototype._convertValues = function (conflict) {
      var self = this;

      var base = conflict.baseValue;
      var src = conflict.srcValue;
      var dst = conflict.dstValue;

      var baseType = self._types[BASE_PANEL];
      var srcType = self._types[SOURCE_PANEL];
      var dstType = self._types[DEST_PANEL];

      var indexes = {
          'asset': [self._resolver.srcAssetIndex, self._resolver.dstAssetIndex],
          'entity': [self._resolver.srcEntityIndex, self._resolver.dstEntityIndex],
          'layer': [self._resolver.srcSettingsIndex.layers, self._resolver.dstSettingsIndex.layers],
          'batchGroup': [self._resolver.srcSettingsIndex.batchGroups, self._resolver.dstSettingsIndex.batchGroups]
      };

      // convert ids to names
      if (base) {
          // for base values try to find the name first in the source index and then in the destination index
          var handled = false;
          for (var type in indexes) {
              if (baseType === type) {
                  base = self._convertIdToName(base, indexes[type][0], indexes[type][1]);
                  handled = true;
                  break;
              } else if (baseType === 'array:' + type) {
                  base = base.map(function (id) {
                      return self._convertIdToName(id, indexes[type][0], indexes[type][1]);
                  });
                  handled = true;
                  break;
              }
          }

          // special handling for sublayers - use the 'layer' field as the id for the field
          if (! handled && baseType === 'array:sublayer' && base) {
              base.forEach(function (sublayer) {
                  self._convertSublayer(sublayer, indexes.layer[0], indexes.layer[1]);
              });
          }
      }

      if (src) {
          var handled = false;
          for (var type in indexes) {
              if (srcType === type) {
                  src = self._convertIdToName(src, indexes[type][0]);
                  handled = true;
                  break;

                  // TODO: Commented out because in order to do this we also need the base checkpoint
                  // to see if the entity exists in there. Ideally whether the parent was deleted or not should
                  // be stored in the conflict object.
                  // if (type === 'entity' && conflict.path.endsWith('.parent')) {
                  //     // check if parent is deleted
                  //     if (! self._resolver.dstEntityIndex[conflict.srcValue]) {
                  //         src.deleted = true;
                  //     }
                  // }

              } else if (srcType === 'array:' + type) {
                  src = src.map(function (id) {
                      return self._convertIdToName(id, indexes[type][0]);
                  });
                  handled = true;
                  break;
              }
          }

          // special handling for sublayers - use the 'layer' field as the id for the field
          if (! handled && srcType === 'array:sublayer' && src) {
              src.forEach(function (sublayer) {
                  self._convertSublayer(sublayer, indexes.layer[0]);
              });
          }
      }

      if (dst) {
          var handled = false;
          for (var type in indexes) {
              if (dstType === type) {
                  dst = self._convertIdToName(dst, indexes[type][1]);
                  handled = true;
                  break;

                  // TODO: Commented out because in order to do this we also need the base checkpoint
                  // to see if the entity exists in there. Ideally whether the parent was deleted or not should
                  // be stored in the conflict object.
                  // if (type === 'entity' && conflict.path.endsWith('.parent')) {
                  //     // check if parent is deleted
                  //     if (! self._resolver.srcEntityIndex[conflict.dstValue]) {
                  //         dst.deleted = true;
                  //     }
                  // }
              } else if (dstType === 'array:' + type) {
                  dst = dst.map(function (id) {
                      return self._convertIdToName(id, indexes[type][1]);
                  });
                  handled = true;
                  break;
              }
          }

          // special handling for sublayers - use the 'layer' field as the id for the field
          if (! handled && dstType === 'array:sublayer' && dst) {
              dst.forEach(function (sublayer) {
                  self._convertSublayer(sublayer, indexes.layer[1]);
              });
          }
      }

      var result = new Array(3);
      result[BASE_PANEL] = base;
      result[SOURCE_PANEL] = src;
      result[DEST_PANEL] = dst;
      return result;
  };

  ConflictSectionRow.prototype._convertIdToName = function (id, index, alternativeIndex) {
      if (id === null || id === undefined) {
          return id;
      }

      var result = {
          id: id,
          name: null
      };

      var name = index[id];
      if (name === undefined && alternativeIndex) {
          name = alternativeIndex[id];
      }

      if (name !== undefined) {
          result.name = name;
      }

      return result;
  };

  ConflictSectionRow.prototype._convertSublayer = function (sublayer, index, alternativeIndex) {
      var layer = this._convertIdToName(sublayer.layer, index, alternativeIndex);
      sublayer.layer = (layer.name || layer.id);
  };

  ConflictSectionRow.prototype._onHover = function () {
      for (var i = 0; i < 3; i++) {
          this._panels[i].class.add('hovered');
      }
  };

  ConflictSectionRow.prototype._onUnHover = function () {
      for (var i = 0; i < 3; i++) {
          this._panels[i].class.remove('hovered');
      }
  };

  ConflictSectionRow.prototype.indent = function () {
      this._panels[BASE_PANEL].class.remove('indent-' + this._indent);
      this._indent++;
      this._panels[BASE_PANEL].class.add('indent-' + this._indent);
  };

  ConflictSectionRow.prototype.unindent = function () {
      this._panels[BASE_PANEL].class.remove('indent-' + this._indent);
      this._indent--;
      if (this._indent) {
          this._panels[BASE_PANEL].class.add('indent-' + this._indent);
      }
  };

  // Converts values like so: thisIsSomeValue to this: This Is Some Value
  ConflictSectionRow.prototype._prettifyName = function (name) {
      var firstLetter = name[0];
      var rest = name.slice(1);
      return firstLetter.toUpperCase() +
      rest
      // insert a space before all caps and numbers
      .replace(/([A-Z0-9])/g, ' $1')
      // replace special characters with spaces
      .replace(/[^a-zA-Z0-9](.)/g, function (match, group) {
          return ' ' + group.toUpperCase();
      });
  };

  ConflictSectionRow.prototype.unresolve = function () {
      if (! this._resolved) return;

      this._resolved = false;

      this._conflict.useDst = false;
      this._conflict.useSrc = false;

      this._panels[SOURCE_PANEL].class.remove('selected');
      this._panels[DEST_PANEL].class.remove('selected');

      this.emit('unresolve', this._conflict.id);
  };

  ConflictSectionRow.prototype.resolveUsingSource = function () {
      if (this._conflict.useSrc) return;

      this.unresolve();
      this._conflict.useSrc = true;
      this._panels[SOURCE_PANEL].class.add('selected');
      this._resolved = true;

      this.emit('resolve', this._conflict.id, {
          useSrc: true
      });
  };

  ConflictSectionRow.prototype.resolveUsingDestination = function () {
      if (this._conflict.useDst) return;

      this.unresolve();
      this._conflict.useDst = true;
      this._panels[DEST_PANEL].class.add('selected');
      this._resolved = true;

      this.emit('resolve', this._conflict.id, {
          useDst: true
      });
  };

  // Appends all row panels to parent panels
  ConflictSectionRow.prototype.appendToParents = function (parents) {
      for (var i = 0; i < parents.length; i++) {
          parents[i].append(this._panels[i]);
      }
  };

  // Sets the height of each value to be the maximum of the 3 heights
  ConflictSectionRow.prototype.onAddedToDom = function () {
      var i;
      for (i = 0; i < 3; i++) {
          this._fields[i].onAddedToDom();
      }

      var maxHeight = Math.max(this._fields[0].height, this._fields[1].height);
      maxHeight = Math.max(maxHeight, this._fields[2].height);

      for (i = 0; i < 3; i++) {
          this._fields[i].height = maxHeight;
      }
  };

  ConflictSectionRow.prototype.destroy = function () {
      this.unbind();
  };

  Object.defineProperty(ConflictSectionRow.prototype, 'resolved', {
      get: function () {
          return this._resolved;
      }
  });

  window.ui.ConflictSectionRow = ConflictSectionRow;
});


/* editor/pickers/conflict-manager/picker-conflict-manager-section.js */
editor.once('load', function () {
  'use strict';

  // A section contains multiple conflicts and it's meant to group
  // conflicts into meaningful categories
  var ConflictSection = function (resolver, title, foldable, allowCloaking) {
      Events.call(this);
      this._resolver = resolver;
      this._numConflicts = 0;
      this._numResolvedConflicts = 0;
      this._indent = 0;

      this._foldable = foldable;
      this._allowCloaking = allowCloaking;
      this._cloaked = false;
      this._cloakFn = this.cloakIfNecessary.bind(this);

      this.panel = new ui.Panel(title);
      this.panel.class.add('section');
      this.panel.foldable = foldable;
      this.panel.flex = true;
      this.panel.on('fold', function () {
          resolver.emit('section:fold');
      });
      this.panel.on('unfold', function () {
          resolver.emit('section:unfold');
      });

      if (this._allowCloaking) {
          resolver.on('section:fold', this.cloakIfNecessaryDeferred.bind(this));
          resolver.on('section:unfold', this.cloakIfNecessaryDeferred.bind(this));
          resolver.on('scroll', this.cloakIfNecessaryDeferred.bind(this));
      }

      this._panelBase = new ui.Panel();
      this._panelBase.class.add('base');
      this.panel.append(this._panelBase);
      this._panelBase.hidden = resolver.isDiff;

      this._panelDest = new ui.Panel();
      this._panelDest.class.add('mine');
      this.panel.append(this._panelDest);

      this._panelSource = new ui.Panel();
      this._panelSource.class.add('theirs');
      this.panel.append(this._panelSource);

      this.panels = [
          this._panelBase,
          this._panelDest,
          this._panelSource
      ];

      this._labelNumConflicts = new ui.Label({
          text: '0/0'
      });
      this._labelNumConflicts.renderChanges = false;
      this._labelNumConflicts.class.add('num-conflicts');
      this._labelNumConflicts.hidden = resolver.isDiff;
      this.panel.headerElement.appendChild(this._labelNumConflicts.element);

      this._rows = [];
  };

  ConflictSection.prototype = Object.create(Events.prototype);

  ConflictSection.prototype.indent = function () {
      this._indent++;
  };

  ConflictSection.prototype.unindent = function () {
      this._indent--;
  };

  // Adds a title that spans all 3 panels
  ConflictSection.prototype.appendTitle = function (title, light) {
      var label;

      var startIndex = this._resolver.isDiff ? 1 : 0;

      for (var i = startIndex; i < 3; i++) {
          label = new ui.Label({
              text: i === startIndex ? title : ''
          });
          label.class.add('title');
          if (light) {
              label.class.add('light');
          }
          if (this._indent) {
              label.class.add('indent-' + this._indent);
          }
          this.panels[i].append(label);
      }
  };

  /**
   * Append a new field to the section. This will create
   * a new field on all 3 panels (base, source, destination);
   * @param {Object} args The field options
   * @param {String} args.name The name of the field
   * @param {Boolean} args.prettify If true the name will be 'prettified'
   * @param {String} args.type The type of the field if it's the same for all base, source and destination values
   * @param {String} args.baseType The type of the base value
   * @param {String} args.sourceType The type of the source value
   * @param {String} args.destType The type of the destination value
   * @param {Object} args.conflict The conflict object
   */
  ConflictSection.prototype.appendField = function (args) {
      var row = new ui.ConflictSectionRow(this._resolver, args);
      this._rows.push(row);

      for (var i = 0; i < this._indent; i++) {
          row.indent();
      }

      row.appendToParents(this.panels);

      row.on('resolve', this.onConflictResolved.bind(this));
      row.on('unresolve', this.onConflictUnresolved.bind(this));

      this.numConflicts++;
      if (row.resolved) {
          this.numResolvedConflicts++;
      }
  };

  ConflictSection.prototype.appendAllFields = function (args) {
      var fields = args.fields;
      var title = args.title;
      var except = args.except;
      var schema = args.schema;

      // check if 'fields' is actually a conflict object already
      // and if missingInDst or missingInSrc is true in which case
      // report this entry as 'deleted' or 'edited' in the UI
      if (fields.missingInDst || fields.missingInSrc) {
          this.appendField({
              type: editor.call('schema:' + schema + ':getType', fields.path),
              conflict: fields
          });
          return;
      }

      var addedTitle = false;

      for (var field in fields)  {
          if (except && except.indexOf(field) !== -1) continue;

          var path = fields[field].path;
          if (! path) continue;

          if (! addedTitle && title) {
              addedTitle = true;
              this.appendTitle(title);
          }

          var type = editor.call('schema:' + schema + ':getType', path);

          this.appendField({
              name: field,
              type: type,
              conflict: fields[field],
              prettify: true
          });
      }
  };

  ConflictSection.prototype.onConflictResolved = function (conflictId, data) {
      this.numResolvedConflicts++;
      this.emit('resolve', conflictId, data);
  };

  ConflictSection.prototype.onConflictUnresolved = function (conflictId) {
      this.numResolvedConflicts--;
      this.emit('unresolve', conflictId);
  };

  ConflictSection.prototype.onAddedToDom = function () {
      // make value fields in the same row have equal heights
      for (var i = 0, len = this._rows.length; i < len; i++) {
          this._rows[i].onAddedToDom();
      }

      if (this._allowCloaking) {
          this.cloakIfNecessary();
      }
  };

  ConflictSection.prototype.cloakIfNecessaryDeferred = function () {
      setTimeout(this._cloakFn, 100);
  };

  // Checks if the section is visible in the viewport. If not it will 'cloak'
  // it meaning it will hide all of its contents but keep its original height
  // to make the DOM faster to render
  ConflictSection.prototype.cloakIfNecessary = function () {
      if (!this.panel.parent) {
          return;
      }

      var parentRect = this.panel.parent.element.getBoundingClientRect();
      var rect = this.panel.element.getBoundingClientRect();
      var safetyMargin = 200;
      if (rect.bottom < parentRect.top - safetyMargin || rect.top > parentRect.bottom + safetyMargin) {
          if (!this._cloaked) {
              this._cloaked = true;
              var height = rect.height;
              this.panel.element.style.height = height + 'px';
              this.panel.class.remove('foldable');
              this.panel.class.add('cloaked');
          }
      } else if (this._cloaked) {
          this._cloaked = false;
          this.panel.element.style.height = '';
          this.panel.class.remove('cloaked');
          if (this._foldable) {
              this.panel.foldable = true;
          }
      }
  };

  ConflictSection.prototype.resolveUsingSource = function () {
      for (var i = 0, len = this._rows.length; i < len; i++) {
          this._rows[i].resolveUsingSource();
      }
  };

  ConflictSection.prototype.resolveUsingDestination = function () {
      for (var i = 0, len = this._rows.length; i < len; i++) {
          this._rows[i].resolveUsingDestination();
      }
  };

  ConflictSection.prototype.destroy = function () {
      this.unbind();
      this.panel.destroy();
      this.panels.length = 0;
      this._rows.forEach(function (row) {
          row.destroy();
      });
      this._rows.length = 0;
  };

  Object.defineProperty(ConflictSection.prototype, 'numConflicts', {
      get: function () {
          return this._numConflicts;
      },
      set: function (value) {
          this._numConflicts = value;
          this._labelNumConflicts.text = this._numResolvedConflicts + '/' + this._numConflicts;
      }
  });

  Object.defineProperty(ConflictSection.prototype, 'numResolvedConflicts', {
      get: function () {
          return this._numResolvedConflicts;
      },
      set: function (value) {
          this._numResolvedConflicts = value;
          this._labelNumConflicts.text = this._numResolvedConflicts + '/' + this._numConflicts;
      }
  });

  window.ui.ConflictSection = ConflictSection;
});


/* editor/pickers/conflict-manager/picker-conflict-manager-resolver.js */
editor.once('load', function () {
  'use strict';

  // Shows all the conflicts for an item
  var ConflictResolver = function (conflicts, mergeObject) {
      Events.call(this);

      // holds conflict UI elements
      this.elements = [];

      this._conflicts = conflicts;
      this._mergeId = mergeObject.id;
      this.isDiff = mergeObject.isDiff;

      this.srcAssetIndex = mergeObject.srcCheckpoint.assets;
      this.dstAssetIndex = mergeObject.dstCheckpoint.assets;

      var srcScene = conflicts.itemType === 'scene' ? mergeObject.srcCheckpoint.scenes[conflicts.itemId] : null;
      this.srcEntityIndex = srcScene && srcScene.entities || {};
      var dstScene = conflicts.itemType === 'scene' ? mergeObject.dstCheckpoint.scenes[conflicts.itemId] : null;
      this.dstEntityIndex = dstScene && dstScene.entities || {};

      this.srcSettingsIndex = mergeObject.srcCheckpoint.settings;
      this.dstSettingsIndex = mergeObject.dstCheckpoint.settings;

      this._pendingResolvedConflicts = {};
      this._pendingRevertedConflicts = {};
      this._timeoutSave = null;

      this._parent = null;

      this._scrollListener = function () {
          this.emit('scroll');
      }.bind(this);
  };

  ConflictResolver.prototype = Object.create(Events.prototype);

  // When a conflict is resolved add it to the pending resolved conflicts
  // So that it's saved to the server after a frame
  ConflictResolver.prototype.onConflictResolved = function (conflictId, data) {
      delete this._pendingRevertedConflicts[conflictId];
      this._pendingResolvedConflicts[conflictId] = data;
      if (this._timeoutSave) {
          clearTimeout(this._timeoutSave);
      }
      this._timeoutSave = setTimeout(this.saveConflicts.bind(this));

      this.emit('resolve', conflictId, data);
  };

  // When a conflict is unresolved add it to the pending unresolved conflicts
  // so that it's saved to the server after a frame
  ConflictResolver.prototype.onConflictUnresolved = function (conflictId) {
      delete this._pendingResolvedConflicts[conflictId];
      this._pendingRevertedConflicts[conflictId] = true;
      if (this._timeoutSave) {
          clearTimeout(this._timeoutSave);
      }
      this._timeoutSave = setTimeout(this.saveConflicts.bind(this));

      this.emit('unresolve', conflictId);
  };

  // Save conflict status on the server
  ConflictResolver.prototype.saveConflicts = function () {
      var useSrc = [];
      var useDst = [];
      var revert = Object.keys(this._pendingRevertedConflicts);

      // Group conflicts by status to minimize REST API calls
      for (var conflictId in this._pendingResolvedConflicts) {
          if (this._pendingResolvedConflicts[conflictId].useSrc) {
              useSrc.push(conflictId);
          } else {
              useDst.push(conflictId);
          }
      }

      if (useSrc.length) {
          editor.call('branches:resolveConflicts', this._mergeId, useSrc, { useSrc: true });
      }
      if (useDst.length) {
          editor.call('branches:resolveConflicts', this._mergeId, useDst, { useDst: true });
      }
      if (revert.length) {
          editor.call('branches:resolveConflicts', this._mergeId, revert, { revert: true });
      }
  };

  // Creates a section that has a title and can be foldable. Sections contain conflicts
  ConflictResolver.prototype.createSection = function (title, foldable, cloakIfNecessary) {
      var section = new ui.ConflictSection(this, title, foldable, cloakIfNecessary);
      section.on('resolve', this.onConflictResolved.bind(this));
      section.on('unresolve', this.onConflictUnresolved.bind(this));
      this.elements.push(section);
      return section;
  };

  // Creates a separator which is a title that spans all conflict panels
  ConflictResolver.prototype.createSeparator = function (title) {
      var label = new ui.Label({
          text: title
      });
      label.class.add('section-separator');
      this.elements.push(label);
      return label;
  };

  // Append the resolver to a parent
  ConflictResolver.prototype.appendToParent = function (parent) {
      this._parent = parent;

      for (var i = 0, len = this.elements.length; i < len; i++) {
          var element = this.elements[i];
          if (element instanceof ui.ConflictSection) {
              // only append a section if it has conflicts
              if (element.numConflicts) {
                  parent.append(element.panel);
              }
          } else {
              parent.append(element);
          }
      }

      parent.element.addEventListener('scroll', this._scrollListener, false);

      // Reflow (call onAddedToDom) after 2 frames. The reason why it's 2 frames
      // and not 1 is it doesn't always work on 1 frame and I don't know why yet..
      // The problem is that if we don't wait then sometimes some elements will not report
      // the correct height, probably because of some animation or delayed layout calculation
      // somewhere...
      var self = this;
      requestAnimationFrame(function () {
          requestAnimationFrame(self.reflow.bind(self));
      });
  };

  // Calls onAddedToDom on every section
  ConflictResolver.prototype.reflow = function () {
      for (var i = 0, len = this.elements.length; i < len; i++) {
          var element = this.elements[i];
          if (element instanceof ui.ConflictSection) {
              element.onAddedToDom();
          }
      }

      this.emit('reflow');
  };

  // Resolves all conflicts using the source values
  ConflictResolver.prototype.resolveUsingSource = function () {
      for (var i = 0, len = this.elements.length; i < len; i++) {
          var element = this.elements[i];
          if (element instanceof ui.ConflictSection) {
              element.resolveUsingSource();
          }
      }
  };

  // Resolves all conflicts using the destination values
  ConflictResolver.prototype.resolveUsingDestination = function () {
      for (var i = 0, len = this.elements.length; i < len; i++) {
          var element = this.elements[i];
          if (element instanceof ui.ConflictSection) {
              element.resolveUsingDestination();
          }
      }
  };

  // Destroyes the resolver and its UI elements
  ConflictResolver.prototype.destroy = function () {
      this.unbind();

      if (this._parent) {
          this._parent.element.removeEventListener('scroll', this._scrollListener, false);
          this._parent = null;
      }

      for (var i = 0, len = this.elements.length; i < len; i++) {
          this.elements[i].destroy();
      }
      this.elements.length = 0;
  };

  window.ui.ConflictResolver = ConflictResolver;
});


/* editor/pickers/conflict-manager/picker-conflict-manager-text-resolver.js */
editor.once('load', function () {
  'use strict';

  /**
   * Contains the UI for showing text conflicts using
   * an i-framed code editor. Also contains buttons to resolve
   * the merged file.
   * @param {Object} conflict The conflict group
   * @param {Object} mergeObject The merge object
   */
  var TextResolver = function (conflict, mergeObject) {
      Events.call(this);

      this._mergeId = mergeObject.id;
      this._conflict = conflict;
      this._sourceBranchId = mergeObject.sourceBranchId;
      this._destBranchId = mergeObject.destinationBranchId;

      this._isDiff = mergeObject.isDiff;

      this._panelTop = new ui.Panel();
      this._panelTop.class.add('textmerge-top');
      this._panelTop.hidden = true;

      this._labelName = new ui.Label({
          text: conflict.itemName
      });
      this._labelName.class.add('name');
      this._labelName.renderChanges = false;
      this._panelTop.append(this._labelName);

      // find textual merge conflict
      this._textualMergeConflict = null;
      for (var i = 0; i < conflict.data.length; i++) {
          if (conflict.data[i].isTextualMerge) {
              this._textualMergeConflict = conflict.data[i];
              break;
          }
      }

      // button to mark resolved
      this._btnMarkResolved = new ui.Button({
          text: 'MARK AS RESOLVED'
      });
      this._btnMarkResolved.class.add('mark-resolved');
      this._btnMarkResolved.on('click', this._onClickMarkResolved.bind(this));
      this._btnMarkResolved.hidden = this._isDiff;
      this._panelTop.append(this._btnMarkResolved);

      // button that opens dropdown menu
      this._btnUseAllFrom = new ui.Button({
          text: 'USE ALL FROM...'
      });
      this._btnUseAllFrom.class.add('use-all');
      this._panelTop.append(this._btnUseAllFrom);
      this._btnUseAllFrom.on('click', this._onClickUseAllFrom.bind(this));
      this._btnUseAllFrom.hidden = this._isDiff;

      // revert all changes
      this._btnRevert = new ui.Button({
          text: 'REVERT CHANGES'
      });
      this._btnRevert.on('click', this._onClickRevert.bind(this));
      this._panelTop.append(this._btnRevert);
      this._btnRevert.hidden = this._isDiff;

      // dropdown menu
      this._menu = new ui.Menu();
      this._menu.class.add('textmerge-dropdown');
      editor.call('layout.root').append(this._menu);

      // use all from source
      this._btnUseSource = new ui.MenuItem({
          icon: '&#58265;',
          text: mergeObject.sourceBranchName
      });
      this._menu.append(this._btnUseSource);
      this._btnUseSource.on('select', this._onClickUseSource.bind(this));

      // use all from dest
      this._btnUseDest = new ui.MenuItem({
          icon: '&#58265;',
          text: mergeObject.destinationBranchName
      });
      this._menu.append(this._btnUseDest);
      this._btnUseDest.on('select', this._onClickUseDest.bind(this));

      // go to next conflict
      this._btnNextConflict = new ui.Button({
          text: 'NEXT'
      });
      this._btnNextConflict.class.add('go-to-next');
      this._panelTop.append(this._btnNextConflict);
      this._btnNextConflict.on('click', this._onClickNext.bind(this));
      this._btnNextConflict.hidden = this._isDiff;

      // go to prev conflict
      this._btnPrevConflict = new ui.Button({
          text: 'PREV'
      });
      this._btnPrevConflict.class.add('go-to-prev');
      this._panelTop.append(this._btnPrevConflict);
      this._btnPrevConflict.on('click', this._onClickPrev.bind(this));
      this._btnPrevConflict.hidden = this._isDiff;

      // go back to asset conflicts
      this._btnGoBack = new ui.Button({
          text: this._isDiff ? 'VIEW ASSET CHANGES' : 'VIEW ASSET CONFLICTS'
      });
      // hide this button if there are only textual conflicts
      if (this._textualMergeConflict && conflict.data.length <= 1)  {
          this._btnGoBack.hidden = true;
      }

      this._btnGoBack.class.add('go-back');
      this._panelTop.append(this._btnGoBack);
      this._btnGoBack.on('click', this._onClickGoBack.bind(this));

      this._iframe = document.createElement('iframe');
      this._iframe.addEventListener('load', function () {
          this._panelTop.hidden = false;
      }.bind(this));

      this._iframe.src = '/editor/code/' + config.project.id + '?mergeId=' + this._mergeId + '&conflictId=' + this._textualMergeConflict.id + '&assetType=' + this._conflict.assetType + '&mergedFilePath=' + this._textualMergeConflict.mergedFilePath;

      this._sourceFile = null;
      this._destFile = null;
      this._unresolvedFile = null;
  };

  TextResolver.prototype = Object.create(Events.prototype);

  TextResolver.prototype.appendToParent = function (parent) {
      parent.append(this._panelTop);
      parent.append(this._iframe);
  };

  TextResolver.prototype.destroy = function () {
      this._panelTop.destroy();
      if (this._iframe.parentElement) {
          this._iframe.parentElement.removeChild(this._iframe);
      }

      this._panelTop = null;
      this._iframe = null;
  };

  TextResolver.prototype._codeEditorMethod = function (method, arg1, arg2, arg3, arg4) {
      return this._iframe.contentWindow.editor.call(method, arg1, arg2, arg3, arg4);
  };

  TextResolver.prototype._onClickMarkResolved = function () {
      var hasMoreConflicts = this._codeEditorMethod('editor:merge:getNumberOfConflicts') > 0;
      if (hasMoreConflicts) {
          editor.call(
              'picker:confirm',
              'There are more unresolved conflicts in this file. Are you sure you want to mark it as resolved?',
              this._uploadResolved.bind(this)
          );
      } else {
          this._uploadResolved();
      }
  };

  TextResolver.prototype._uploadResolved = function () {
      this._toggleButtons(false);

      this._btnMarkResolved.disabled = true;
      var content = this._codeEditorMethod('editor:merge:getContent');
      var file = new Blob([content]);
      editor.call('conflicts:uploadResolvedFile', this._textualMergeConflict.id, file, function (err) {
          this._toggleButtons(true);
          this._btnMarkResolved.disabled = false;
          if (err) {
              console.error(err);
              return;
          }

          this._textualMergeConflict.useMergedFile = true;
          this.emit('resolve', this._textualMergeConflict.id, {
              useMergedFile: true
          });

      }.bind(this));
  };

  TextResolver.prototype._toggleButtons = function (toggle) {
      this._btnGoBack.disabled = !toggle;
      this._btnMarkResolved.disabled = !toggle;
      this._btnUseAllFrom.disabled = !toggle;
      this._btnRevert.disabled = !toggle;
      this._btnUseDest.disabled = !toggle;
      this._btnUseSource.disabled = !toggle;
  };

  TextResolver.prototype._onClickUseAllFrom = function () {
      this._menu.open = !this._menu.open;
      requestAnimationFrame(function () {
          var menuRect = this._menu.innerElement.getBoundingClientRect();
          var btnRect = this._btnUseAllFrom.element.getBoundingClientRect();
          this._menu.position(btnRect.left - (menuRect.width - btnRect.width), btnRect.bottom);
      }.bind(this));
  };

  TextResolver.prototype._onClickGoBack = function () {
      if (!this._isDiff && this._codeEditorMethod('editor:merge:isDirty')) {
          editor.call('picker:confirm', 'Your changes will not be saved unless you hit "Mark As Resolved". Are you sure you want to go back?', function () {
              this.emit('close');
          }.bind(this));
      } else {
          this.emit('close');
      }
  };

  TextResolver.prototype._onClickUseSource = function () {
      if (this._sourceFile) {
          this._codeEditorMethod('editor:merge:setContent', this._sourceFile);
          return;
      }

      this._toggleButtons(false);

      editor.call(
          'checkpoints:getAssetFile',
          this._conflict.itemId,
          this._sourceBranchId,
          this._conflict.srcImmutableBackup,
          this._conflict.srcFilename,
          function (err, data) {
              this._toggleButtons(true);

              if (err) {
                  return editor.call('status:error', err);
              }

              this._sourceFile = data;
              this._codeEditorMethod('editor:merge:setContent', this._sourceFile);

          }.bind(this)
      );
  };

  TextResolver.prototype._onClickUseDest = function () {

      if (this._destFile) {
          this._codeEditorMethod('editor:merge:setContent', this._destFile);
          return;
      }

      this._toggleButtons(false);
      editor.call(
          'checkpoints:getAssetFile',
          this._conflict.itemId,
          this._destBranchId,
          this._conflict.dstImmutableBackup,
          this._conflict.dstFilename,
          function (err, data) {
              this._toggleButtons(true);

              if (err) {
                  return editor.call('status:error', err);
              }

              this._destFile = data;
              this._codeEditorMethod('editor:merge:setContent', this._destFile);
          }.bind(this)
      );

  };

  TextResolver.prototype._onClickRevert = function () {
      if (this._unresolvedFile) {
          this._codeEditorMethod('editor:merge:setContent', this._unresolvedFile);
          return;
      }

      this._toggleButtons(false);

      editor.call('conflicts:getUnresolvedFile',
          this._mergeId,
          this._textualMergeConflict.id,
          this._textualMergeConflict.mergedFilePath,
          function (err, data) {
              this._toggleButtons(true);
              if (err) {
                  return editor.call('status:error', err);
              }

              this._unresolvedFile = data;
              this._codeEditorMethod('editor:merge:setContent', this._unresolvedFile);
          }.bind(this)
      );
  };

  TextResolver.prototype._onClickNext = function () {
      this._codeEditorMethod('editor:merge:goToNextConflict');
  };

  TextResolver.prototype._onClickPrev = function () {
      this._codeEditorMethod('editor:merge:goToPrevConflict');
  };

  window.ui.TextResolver = TextResolver;
});


/* editor/pickers/conflict-manager/picker-conflict-manager-scene.js */
editor.once('load', function () {
  'use strict';

  var componentSchema = config.schema.scene.entities.$of.components;

  // Shows conflicts for a scene
  editor.method('picker:conflictManager:showSceneConflicts', function (parent, conflicts, mergeObject) {
      // create resolver
      var resolver = new ui.ConflictResolver(conflicts, mergeObject);

      // Build index of conflicts so that the conflicts become
      // a hierarchical object
      var index = {};
      for (var i = 0, len = conflicts.data.length; i < len; i++) {
          var conflict = conflicts.data[i];
          // check if the whole scene has changed (e.g. deleted in one branch)
          if (conflict.path === '') {
              index = conflict;
              break;
          }

          var parts = conflict.path.split('.');
          var plen = parts.length;
          var target = index;

          for (var p = 0; p < plen - 1; p++) {
              if (! target.hasOwnProperty(parts[p])) {
                  target[parts[p]] = {};
              }
              target = target[parts[p]];
          }

          target[parts[plen - 1]] = conflict;
      }

      // Check if the whole scene has been deleted in one branch
      if (index.missingInDst || index.missingInSrc) {
          var sectionScene = resolver.createSection(conflicts.itemName);
          sectionScene.appendField({
              type: 'object',
              conflict: index
          });

          resolver.appendToParent(parent);
          return resolver;
      }

      // Scene properties
      var sectionProperties = resolver.createSection('PROPERTIES');
      sectionProperties.appendAllFields({
          schema: 'scene',
          fields: index
      });

      // append scene settings
      if (index.settings) {
          for (var key in index.settings) {
              sectionProperties.appendAllFields({
                  schema: 'scene',
                  fields: index.settings[key]
              });
          }
      }

      // Entities
      if (index.entities) {
          resolver.createSeparator('ENTITIES');

          // for diffs it's more likely that we are going to have a large
          // number of entities so cloak sections that are out of view if we have a lot
          // of entities to improve DOM performance
          var allowSectionCloaking = false;
          if (resolver.isDiff) {
              var numEntities = Object.keys(index.entities).length;
              allowSectionCloaking = numEntities > 50;
          }

          for (var key in index.entities) {
              // create title for entity section
              var entityName = resolver.srcEntityIndex[key] || resolver.dstEntityIndex[key];
              if (entityName) {
                  entityName = "'" + entityName + "' - " + key;
              } else {
                  entityName = key;
              }

              // create entity section
              var sectionEntity = resolver.createSection(entityName, true, allowSectionCloaking);
              var entity = index.entities[key];

              // append entity properties
              sectionEntity.appendAllFields({
                  schema: 'scene',
                  fields: entity,
                  title: 'ENTITY PROPERTIES'
              });

              // Components
              if (entity.components) {
                  for (var component in componentSchema) {
                      if (! entity.components.hasOwnProperty(component)) continue;
                      sectionEntity.appendTitle(component.toUpperCase() + ' COMPONENT');

                      // handle script component so that script attributes appear
                      // after the rest of the component properties
                      if (component === 'script') {
                          sectionEntity.appendAllFields({
                              schema: 'scene',
                              fields: entity.components[component],
                              except: ['scripts']
                          });

                          // add script attributes after
                          var scripts = entity.components.script.scripts;
                          if (scripts) {
                              for (var scriptName in scripts) {
                                  if (! scripts[scriptName]) continue;

                                  sectionEntity.appendTitle(scriptName, true);

                                  // check if script was deleted in one of the branches
                                  if (scripts[scriptName].missingInSrc || scripts[scriptName].missingInDst) {
                                      sectionEntity.appendField({
                                          type: editor.call('schema:scene:getType', scripts[scriptName].path),
                                          conflict: scripts[scriptName]
                                      });
                                      continue;
                                  }

                                  // append all fields for that specific script instance
                                  // except script attributes which are done after
                                  sectionEntity.appendAllFields({
                                      schema: 'scene',
                                      fields: scripts[scriptName],
                                      except: ['attributes']
                                  });

                                  var attributes = scripts[scriptName].attributes;
                                  if (! attributes) continue;

                                  for (var attributeName in attributes) {
                                      var attribute = attributes[attributeName];
                                      if (! attribute) continue;

                                      sectionEntity.appendField({
                                          name: attributeName,
                                          baseType: attribute.baseType,
                                          sourceType: attribute.srcType,
                                          destType: attribute.dstType,
                                          conflict: attribute
                                      });
                                  }
                              }
                          }
                      } else if (component === 'sound') {
                          // handle sound component so that sound slots appear after the rest of the component properties
                          sectionEntity.appendAllFields({
                              schema: 'scene',
                              fields: entity.components[component],
                              except: ['slots']
                          });

                          var slots = entity.components.sound.slots;
                          if (slots) {
                              for (var key in slots) {
                                  sectionEntity.appendTitle('SOUND SLOT ' + key, true);
                                  sectionEntity.appendAllFields({
                                      schema: 'scene',
                                      fields: slots[key]
                                  });
                              }
                          }
                      } else if (component === 'sprite') {
                          // handle sprite component so that clips appear after the rest of the component properties
                          sectionEntity.appendAllFields({
                              schema: 'scene',
                              fields: entity.components[component],
                              except: ['clips']
                          });

                          var clips = entity.components.sprite.clips;
                          if (clips) {
                              for (var key in clips) {
                                  sectionEntity.appendTitle('CLIP ' + key, true);
                                  sectionEntity.appendAllFields({
                                      schema: 'scene',
                                      fields: clips[key]
                                  });
                              }
                          }
                      } else if (component === 'model') {
                          // handle all model properties except mapping
                          sectionEntity.appendAllFields({
                              schema: 'scene',
                              fields: entity.components[component],
                              except: ['mapping']
                          });

                          // handle mapping
                          var mapping = entity.components.model.mapping;
                          if (mapping) {
                              for (var key in mapping) {
                                  sectionEntity.appendTitle('ENTITY MATERIAL ' + key, true);

                                  sectionEntity.appendField({
                                      name: 'Material',
                                      type: editor.call('schema:scene:getType', mapping[key].path),
                                      conflict: mapping[key]
                                  });
                              }
                          }
                      } else {
                          // add component fields
                          sectionEntity.appendAllFields({
                              schema: 'scene',
                              fields: entity.components[component]
                          });
                      }
                  }
              }

          }
      }

      resolver.appendToParent(parent);

      return resolver;
  });
});


/* editor/pickers/conflict-manager/picker-conflict-manager-settings.js */
editor.once('load', function () {
  'use strict';

  var getLayerName = function (id, mergeObject) {
      // try to get layer name from destination checkpoint first and if not
      // available try the source checkpoint
      return mergeObject.dstCheckpoint.settings.layers[id] ||
             mergeObject.srcCheckpoint.settings.layers[id] ||
             id;
  };

  var getBatchGroupName = function (id, mergeObject) {
      // try to get batch group name from destination checkpoint first and if not
      // available try the source checkpoint
      return mergeObject.dstCheckpoint.settings.batchGroups[id] ||
             mergeObject.srcCheckpoint.settings.batchGroups[id] ||
             id;
  };

  // Shows conflicts for project settings
  editor.method('picker:conflictManager:showSettingsConflicts', function (parent, conflicts, mergeObject) {
      var resolver = new ui.ConflictResolver(conflicts, mergeObject);

      // temp check to see if just all settings have changed with no
      // more details
      if (conflicts.data.length === 1 && conflicts.data[0].path === '') {
          var sectionSettings = resolver.createSection('PROJECT SETTINGS');
          sectionSettings.appendField({
              type: 'object',
              conflict: conflicts.data[0]
          });
          resolver.appendToParent(parent);
          return resolver;
      }

      // Build index of conflicts so that the conflicts become
      // a hierarchical object
      var index = {};
      for (var i = 0, len = conflicts.data.length; i < len; i++) {
          var conflict = conflicts.data[i];
          var parts = conflict.path.split('.');
          var target = index;

          for (var p = 0; p < parts.length - 1; p++) {
              if (! target.hasOwnProperty(parts[p])) {
                  target[parts[p]] = {};
              }
              target = target[parts[p]];
          }

          target[parts[parts.length - 1]] = conflict;
      }

      // Settings that need no special handling first
      var sectionProperties = resolver.createSection('SETTINGS');
      sectionProperties.appendAllFields({
          schema: 'settings',
          fields: index,
          except: ['batchGroups', 'layers', 'layerOrder', 'scripts']
      });

      // Layers
      if (index.layers || index.layerOrder) {
          resolver.createSeparator('LAYERS');
      }

      if (index.layers) {
          for (var key in index.layers) {
              var section = resolver.createSection('LAYER ' + getLayerName(key, mergeObject), true);
              section.appendAllFields({
                  schema: 'settings',
                  fields: index.layers[key]
              });
          }
      }

      if (index.layerOrder) {
          var section = resolver.createSection('LAYER ORDER', true);
          section.appendField({
              type: 'array:sublayer',
              conflict: index.layerOrder
          });
      }

      // Batch groups
      if (index.batchGroups) {
          resolver.createSeparator('BATCH GROUPS');
          for (var key in index.batchGroups) {
              var section = resolver.createSection('BATCH GROUP ' + getBatchGroupName(key, mergeObject), true);
              section.appendAllFields({
                  schema: 'settings',
                  fields: index.batchGroups[key]
              });
          }
      }

      // Script order
      if (index.scripts) {
          resolver.createSeparator('SCRIPTS LOADING ORDER');
          var section = resolver.createSection('SCRIPTS', true);
          section.appendField({
              type: 'array:asset',
              conflict: index.scripts
          });
      }

      resolver.appendToParent(parent);

      return resolver;
  });
});


/* editor/pickers/conflict-manager/picker-conflict-manager-asset.js */
editor.once('load', function () {
  'use strict';

  // Shows asset field conflicts
  editor.method('picker:conflictManager:showAssetFieldConflicts', function (parent, conflicts, mergeObject) {
      var resolver = new ui.ConflictResolver(conflicts, mergeObject);

      var sectionAsset = resolver.createSection(conflicts.itemName + ' - ID: ' + conflicts.itemId);

      for (var i = 0; i < conflicts.data.length; i++) {
          if (conflicts.data[i].isTextualMerge) continue;

          // get the type from the path - force 'data' to be an object for now
          var path = conflicts.data[i].path;
          var noPath = !path;
          var type = !path || path === 'data' ? 'object' : editor.call('schema:asset:getType', conflicts.data[i].path);

          sectionAsset.appendField({
              name: conflicts.data[i].path,
              noPath: noPath,
              prettify: true,
              type: type,
              conflict: conflicts.data[i]
          });
      }

      resolver.appendToParent(parent);
      return resolver;
  });

  // Shows asset text file contents
  editor.method('picker:conflictManager:showAssetFileConflicts', function (parent, conflicts, mergeObject) {
      var resolver = new ui.TextResolver(conflicts, mergeObject);
      resolver.appendToParent(parent);
      return resolver;
  });
});


/* editor/pickers/conflict-manager/picker-conflict-manager.js */
editor.once('load', function () {
  'use strict';

  var LAYOUT_NONE = 0;
  var LAYOUT_FIELDS_ONLY = 1;
  var LAYOUT_FIELDS_AND_FILE_CONFLICTS = 2;
  var LAYOUT_FILE_CONFLICTS_ONLY = 3;

  var layoutMode = LAYOUT_NONE;

  // if true then we are showing a diff instead of a merge
  var diffMode = false;

  // overlay
  var root = editor.call('layout.root');
  var overlay = new ui.Overlay();
  overlay.clickable = false;
  overlay.hidden = true;
  overlay.class.add('picker-conflict-manager');
  root.append(overlay);

  // main panel
  var panel = new ui.Panel('CONFLICT MANAGER');
  panel.flex = true;
  overlay.append(panel);

  // left panel
  var panelLeft = new ui.Panel();
  panelLeft.flex = true;
  panelLeft.class.add('left');
  panel.append(panelLeft);

  // list of conflicted items
  var listItems = new ui.List();
  listItems.flexGrow = 1;
  panelLeft.append(listItems);

  // review merge button
  var btnReview = new ui.Button({
      text: 'REVIEW MERGE'
  });
  btnReview.disabled = true;
  panelLeft.append(btnReview);

  // complete merge button
  var btnComplete = new ui.Button({
      text: 'COMPLETE MERGE'
  });
  panelLeft.append(btnComplete);

  // right panel
  var panelRight = new ui.Panel();
  panelRight.class.add('right');
  panelRight.flex = true;
  panelRight.flexGrow = 1;
  panel.append(panelRight);


  // main progress text
  var labelMainProgress = new ui.Label();
  labelMainProgress.class.add('progress-text');
  labelMainProgress.renderChanges = false;
  labelMainProgress.hidden = true;
  panelRight.append(labelMainProgress);

  // main progress icons
  var spinnerIcon = editor.call('picker:versioncontrol:svg:spinner', 64);
  spinnerIcon.classList.add('progress-icon');
  spinnerIcon.classList.add('hidden');
  spinnerIcon.classList.add('spin');
  var completedIcon = editor.call('picker:versioncontrol:svg:completed', 64);
  completedIcon.classList.add('progress-icon');
  completedIcon.classList.add('hidden');
  var errorIcon = editor.call('picker:versioncontrol:svg:error', 64);
  errorIcon.classList.add('progress-icon');
  errorIcon.classList.add('hidden');
  panelRight.innerElement.appendChild(spinnerIcon);
  panelRight.innerElement.appendChild(completedIcon);
  panelRight.innerElement.appendChild(errorIcon);

  // create vertical borders
  var verticalBorders = [];
  for (var i = 0; i < 2; i++) {
      var border = document.createElement('div');
      border.classList.add('vertical-border');
      border.classList.add('vertical-border-' + i);
      panelRight.append(border);
      verticalBorders.push(border);
  }

  // headers for each branch
  var panelTop = new ui.Panel();
  panelTop.flex = true;
  panelTop.class.add('top');
  panelRight.append(panelTop);

  var panelTopBase = new ui.Panel();
  panelTopBase.class.add('base');
  var label = new ui.Label({
      text: 'BASE'
  });
  label.renderChanges = false;
  panelTopBase.append(label);
  panelTop.append(panelTopBase);

  var panelDest = new ui.Panel();
  panelDest.class.add('mine');
  var labelTopMine = new ui.Label({
      text: 'DEST'
  });
  labelTopMine.renderChanges = false;
  panelDest.append(labelTopMine);
  panelTop.append(panelDest);

  var panelSource = new ui.Panel();
  panelSource.class.add('theirs');
  var labelTopTheirs = new ui.Label({
      text: 'SOURCE'
  });
  labelTopTheirs.renderChanges = false;
  panelSource.append(labelTopTheirs);
  panelTop.append(panelSource);

  // conflict panel
  var panelConflicts = new ui.Panel();
  panelConflicts.class.add('conflicts');
  panelRight.append(panelConflicts);

  // bottom panel with buttons
  var panelBottom = new ui.Panel();
  panelBottom.flex = true;
  panelBottom.class.add('bottom');

  var panelBottomBase = new ui.Panel();
  panelBottomBase.flex = true;
  panelBottomBase.class.add('base');
  panelBottom.append(panelBottomBase);

  var panelBottomDest = new ui.Panel();
  panelBottomDest.flex = true;
  panelBottomDest.class.add('mine');
  panelBottom.append(panelBottomDest);

  var btnPickDest = new ui.Button({
      text: 'USE ALL FROM THIS BRANCH'
  });
  panelBottomDest.append(btnPickDest);
  btnPickDest.on('click', function () {
      if (resolver) {
          resolver.resolveUsingDestination();
      }
  });

  var panelBottomSource = new ui.Panel();
  panelBottomSource.flex = true;
  panelBottomSource.class.add('theirs');
  panelBottom.append(panelBottomSource);

  var btnPickSource = new ui.Button({
      text: 'USE ALL FROM THIS BRANCH'
  });
  panelBottomSource.append(btnPickSource);
  btnPickSource.on('click', function () {
      if (resolver) {
          resolver.resolveUsingSource();
      }
  });

  panelRight.append(panelBottom);

  // panel that warns about file merge
  var panelFileConflicts = new ui.Panel('FILE CONFLICTS');
  panelFileConflicts.class.add('file-conflicts');
  panelFileConflicts.flex = true;
  panelFileConflicts.hidden = true;
  panelRight.append(panelFileConflicts);

  var labelInfo = new ui.Label({
      text: '&#58368;',
      unsafe: true
  });
  labelInfo.class.add('font-icon');
  panelFileConflicts.append(labelInfo);

  var labelFileConflicts = new ui.Label({
      text: 'FILE CONFLICTS'
  });
  labelFileConflicts.renderChanges = false;
  labelFileConflicts.class.add('file-conflicts');
  panelFileConflicts.append(labelFileConflicts);

  var labelFileConflictsSmall = new ui.Label({
      text: 'The asset also has file conflicts'
  });
  labelFileConflictsSmall.renderChanges = false;
  labelFileConflictsSmall.class.add('file-conflicts-small');
  panelFileConflicts.append(labelFileConflictsSmall);

  var btnViewFileConflicts = new ui.Button({
      text: 'VIEW FILE CONFLICTS'
  });
  panelFileConflicts.append(btnViewFileConflicts);

  // close button
  var btnClose = new ui.Button({
      text: '&#57650;'
  });
  btnClose.class.add('close');
  btnClose.on('click', function () {
      if (config.self.branch.merge) {
          editor.call('picker:confirm', 'Closing the conflict manager will stop the merge. Are you sure?', function () {
              if (resolver) {
                  resolver.destroy();
              }

              setLayoutMode(LAYOUT_NONE);
              showMainProgress(spinnerIcon, 'Stopping merge');
              editor.call('branches:forceStopMerge', config.self.branch.merge.id, function (err) {
                  if (err) {
                      showMainProgress(errorIcon, err);
                  } else {
                      showMainProgress(completedIcon, 'Merge stopped. Refreshing browser');
                      setTimeout(function () {
                          window.location.reload();
                      }, 1000);
                  }
              });

              if (diffMode && currentMergeObject && currentMergeObject.id !== config.self.branch.merge.id) {
                  // delete current diff too
                  editor.call('branches:forceStopMerge', currentMergeObject.id);
              }
          });
      } else if (diffMode && currentMergeObject) {
          // delete regular diff
          editor.call('branches:forceStopMerge', currentMergeObject.id);
          overlay.hidden = true;
          editor.call('picker:versioncontrol');
      }
  });
  panel.headerElement.appendChild(btnClose.element);

  // the current conflict we are editing
  var currentConflicts = null;
  // the merge data that we requested from the server
  var currentMergeObject = null;
  // the UI to resolve conflicts for an item
  var resolver = null;

  // Returns true if the conflict group has any file conflicts
  var hasFileConflicts = function (group) {
      for (var i = 0; i < group.data.length; i++) {
          if (group.data[i].isTextualMerge) {
              return true;
          }
      }

      return false;
  };

  // Returns true if the conflict group has any regular data conflicts
  var hasDataConflicts = function (group) {
      for (var i = 0; i < group.data.length; i++) {
          if (! group.data[i].isTextualMerge) {
              return true;
          }
      }

      return false;
  };

  // Returns true if all of the conflicts of a group (a group has a unique itemId)
  // have been resolved
  var isConflictGroupResolved = function (group) {
      var resolved = true;
      for (var i = 0; i < group.data.length; i++) {
          if (!group.data[i].useSrc && !group.data[i].useDst && !group.data[i].useMergedFile) {
              resolved = false;
              break;
          }
      }
      return resolved;
  };

  // Returns true if all of the conflicts have been resolved for all groups
  var checkAllResolved = function () {
      var result = true;

      for (var i = 0; i < currentMergeObject.conflicts.length; i++) {
          if (!isConflictGroupResolved(currentMergeObject.conflicts[i])) {
              return false;
          }
      }

      return result;
  };

  // Creates a list item for the list on the left panel
  var createLeftListItem = function (conflictGroup) {
      var item = new ui.ListItem();

      // add some links between the item and the data
      item.conflict = conflictGroup;
      conflictGroup.listItem = item;

      var panel = new ui.Panel();
      item.element.appendChild(panel.element);

      // icon
      var labelIcon = new ui.Label({
          text: '&#58208;',
          unsafe: true
      });
      labelIcon.class.add('icon');
      labelIcon.class.add(isConflictGroupResolved(conflictGroup) ? 'resolved' : 'conflict');

      panel.append(labelIcon);
      item.icon = labelIcon;

      var panelInfo = new ui.Panel();
      panel.append(panelInfo);

      // name
      var labelName = new ui.Label({
          text: conflictGroup.itemName === 'project settings' ? 'Project Settings' : conflictGroup.itemName
      });
      labelName.class.add('name');
      panelInfo.append(labelName);

      // type
      var type = conflictGroup.assetType || conflictGroup.itemType;
      var labelType = new ui.Label({
          text: type
      });
      labelType.renderChanges = false;
      labelType.class.add('type');
      panelInfo.append(labelType);

      listItems.append(item);

      item.on('select', function () {
          showConflicts(conflictGroup);
      });

      // Called when all the conflicts of this list item have been resolved
      item.onResolved = function () {
          labelIcon.class.remove('conflict');
          labelIcon.class.add('resolved');
      };

      // Called when a conflict of this list item has been un-resolved
      item.onUnresolved = function () {
          labelIcon.class.add('conflict');
          labelIcon.class.remove('resolved');
      };

      item.refreshResolvedCount = function () {
          var resolved = 0;
          var total = conflictGroup.data.length;
          for (var i = 0; i < total; i++) {
              if (conflictGroup.data[i].useSrc ||
                  conflictGroup.data[i].useDst ||
                  conflictGroup.data[i].useMergedFile) {

                  resolved++;
              }
          }

          if (diffMode) {
              labelType.text = type + ' -  ' + total + ' Change' + (total > 1 ? 's' : '');
          } else {
              labelType.text = type + ' - Resolved ' + resolved + '/' + total;
          }
      };

      item.refreshResolvedCount();

      return item;
  };

  var showRegularConflicts = function () {
      panelTop.hidden = false;
      panelConflicts.hidden = false;
      panelBottom.hidden = diffMode;

      for (var i = 0; i < verticalBorders.length; i++) {
          verticalBorders[i].classList.remove('hidden');
      }
  };

  var showFileConflictsPanel = function () {
      panelFileConflicts.hidden = false;
      panelRight.class.add('file-conflicts-visible');
  };

  // Enables / disables the appropriate panels for the right
  // side depending on the specified mode
  var setLayoutMode = function (mode)  {
      layoutMode = mode;

      // turn off all right panel children first
      // and then enable the fields required by
      // the mode
      panelRight.class.remove('file-conflicts-visible');
      var children = panelRight.innerElement.childNodes;
      for (var i = 0; i < children.length; i++) {
          children[i].classList.add('hidden');
      }

      switch (mode) {
          case LAYOUT_FIELDS_ONLY:
              showRegularConflicts();
              break;
          case LAYOUT_FIELDS_AND_FILE_CONFLICTS:
              showRegularConflicts();
              showFileConflictsPanel();
              break;
      }
  };

  // Hide conflicts and show a progress icon
  var showMainProgress = function (icon, text) {
      [spinnerIcon, completedIcon, errorIcon].forEach(function (i) {
          if (icon === i) {
              i.classList.remove('hidden');
          } else {
              i.classList.add('hidden');
          }
      });

      labelMainProgress.hidden = false;
      labelMainProgress.text = text;
  };

  // Shows the conflicts of a group
  var showConflicts = function (group, forceLayoutMode) {
      // destroy the current resolver
      if (resolver) {
          resolver.destroy();
          resolver = null;
      }

      currentConflicts = group;

      var parent = panelConflicts;

      var mode = forceLayoutMode ||  LAYOUT_FIELDS_ONLY;
      if (! forceLayoutMode) {
          if (hasFileConflicts(group)) {
              if (hasDataConflicts(group)) {
                  mode = LAYOUT_FIELDS_AND_FILE_CONFLICTS;
              } else {
                  mode = LAYOUT_FILE_CONFLICTS_ONLY;
              }
          }
      }

      // create resolver based on type
      var methodName;
      switch (group.itemType) {
          case 'scene':
              methodName = 'picker:conflictManager:showSceneConflicts';
              break;
          case 'settings':
              methodName = 'picker:conflictManager:showSettingsConflicts';
              break;
          default: // asset
              if (mode === LAYOUT_FILE_CONFLICTS_ONLY) {
                  parent = panelRight;
                  methodName = 'picker:conflictManager:showAssetFileConflicts';
              } else {
                  methodName = 'picker:conflictManager:showAssetFieldConflicts';
              }
              break;
      }

      setLayoutMode(mode);

      resolver = editor.call(
          methodName,
          parent,
          currentConflicts,
          currentMergeObject
      );

      var timeoutCheckAllResolved;

      // Called when any conflict is resolved
      resolver.on('resolve', function () {
          group.listItem.refreshResolvedCount();

          // go back to regular layout
          if (layoutMode === LAYOUT_FILE_CONFLICTS_ONLY) {
              if (hasDataConflicts(group)) {
                  showConflicts(group);
              }
          }

          // Check if all the conflicts of a group have been
          // resolved
          if (! isConflictGroupResolved(group)) return;

          // Check if all conflicts of all groups are now resolved
          // in a timeout. Do it in a timeout in case the user
          // clicks on one of the resolve all buttons in which case
          // the resolve event will be fired mutliple times in the same frame
          group.listItem.onResolved();

          if (timeoutCheckAllResolved) {
              clearTimeout(timeoutCheckAllResolved);
          }
          timeoutCheckAllResolved = setTimeout(function () {
              timeoutCheckAllResolved = null;
              btnReview.disabled = ! checkAllResolved();
          });
      });

      // Called when any conflict has been un-resolved
      resolver.on('unresolve', function () {
          group.listItem.onUnresolved();
          if (timeoutCheckAllResolved) {
              clearTimeout(timeoutCheckAllResolved);
              timeoutCheckAllResolved = null;
          }

          group.listItem.refreshResolvedCount();
          btnReview.disabled = true;
      });

      // fired by the text resolver to go back
      // to viewing asset conflicts
      resolver.on('close', function () {
          if (hasDataConflicts(group)) {
              showConflicts(group);
          }
      });

      // adjust the positioning of the vertical borders because a scrollbar
      // might have been displayed which might have changed the rendered width
      // of the conflicts panel
      resolver.on('reflow', function () {
          var width = panelConflicts.element.clientWidth / (diffMode ? 2 : 3);
          verticalBorders[0].style.left = width + 'px';
          verticalBorders[1].style.left = 2 * width + 'px';
      });
  };

  btnViewFileConflicts.on('click', function () {
      showConflicts(currentConflicts, LAYOUT_FILE_CONFLICTS_ONLY);
  });

  // Complete merge button click
  btnComplete.on('click', function () {
      listItems.selected = [];
      btnComplete.disabled = true;

      if (resolver) {
          resolver.destroy();
          resolver = null;
      }

      setLayoutMode(LAYOUT_NONE);
      showMainProgress(spinnerIcon, 'Completing merge...');

      editor.call('branches:applyMerge', config.self.branch.merge.id, true, function (err) {

          if (err) {
              // if there was an error show it in the UI and then go back to the conflicts
              showMainProgress(errorIcon, err);
              setTimeout(function () {
                  btnComplete.disabled = false;
                  listItems.innerElement.firstChild.ui.selected = true;
              }, 2000);
          } else {
              // if no error then refresh the browser
              showMainProgress(completedIcon, 'Merge complete - refreshing browser...');
              setTimeout(function () {
                  window.location.reload();
              }, 1000);
          }
      });
  });

  // Review merge button click
  btnReview.on('click', function () {
      listItems.selected = [];
      btnReview.disabled = true;

      if (resolver) {
          resolver.destroy();
          resolver = null;
      }

      setLayoutMode(LAYOUT_NONE);
      showMainProgress(spinnerIcon, 'Resolving conflicts...');

      editor.call('branches:applyMerge', config.self.branch.merge.id, false, function (err) {
          if (err) {
              // if there was an error show it in the UI and then go back to the conflicts
              showMainProgress(errorIcon, err);
              setTimeout(function () {
                  btnReview.disabled = false;
                  listItems.innerElement.firstChild.ui.selected = true;
              }, 2000);
          } else {
              // if no error then show the merge diff
              // vaios
              showMainProgress(spinnerIcon, 'Loading changes...');
              editor.call('diff:merge', function (err, data) {
                  toggleDiffMode(true);
                  if (err) {
                      return showMainProgress(errorIcon, err);
                  }

                  btnReview.disabled = false;
                  btnReview.hidden = true;
                  btnComplete.disabled = false;
                  btnComplete.hidden = false;
                  onMergeDataLoaded(data);
              });
          }
      });
  });

  // Called when we load the merge object from the server
  var onMergeDataLoaded = function (data) {
      listItems.clear();
      currentMergeObject = data;

      if (diffMode) {
          if (config.self.branch.merge) {
              labelTopTheirs.text = 'Merge Result';
          } else {
              labelTopTheirs.text = data.sourceBranchName + ' - ' + (data.sourceCheckpointId ? 'Checkpoint [' + data.sourceCheckpointId.substring(0, 7) + ']' : 'Current State');
          }
          labelTopMine.text = data.destinationBranchName + ' - ' + (data.destinationCheckpointId ? 'Checkpoint [' + data.destinationCheckpointId.substring(0, 7) + ']' : 'Current State');
      } else {
          labelTopTheirs.text = data.sourceBranchName + ' - [Source Branch]';
          labelTopMine.text = data.destinationBranchName + ' - [Destination Branch]';
      }

      if (!currentMergeObject.conflicts || !currentMergeObject.conflicts.length) {
          btnReview.disabled = false;
          if (diffMode) {
              return showMainProgress(completedIcon, 'No changes found - Click Complete Merge');
          } else {
              return showMainProgress(completedIcon, 'No conflicts found - Click Review Merge');
          }
      }

      for (var i = 0; i < currentMergeObject.conflicts.length; i++) {
          var item = createLeftListItem(currentMergeObject.conflicts[i]);
          if (i === 0) {
              item.selected = true;
          }
      }

      if (!diffMode) {
          btnReview.disabled = !checkAllResolved();
      }
  };

  // Enables / Disables diff mode
  var toggleDiffMode = function (toggle) {
      diffMode = toggle;
      if (diffMode) {
          overlay.class.add('diff');
      } else {
          overlay.class.remove('diff');
      }

      if (diffMode) {
          if (config.self.branch.merge) {
              btnComplete.hidden = false;
              btnComplete.disabled = false;
              btnReview.hidden = true;
              panel.header = 'REVIEW MERGE CHANGES';
          } else {
              btnComplete.hidden = true;
              btnReview.hidden = true;
              panel.header = 'DIFF'
          }

          labelFileConflicts.text = "FILE CHANGES";
          labelFileConflictsSmall.text = "The asset also has file changes";
          btnViewFileConflicts.text = "VIEW FILE CHANGES";
          panelFileConflicts.header = 'FILE CHANGES';
      } else {
          btnReview.hidden = false;
          btnReview.disabled = true;
          btnComplete.hidden = true;
          panel.header = 'RESOLVE CONFLICTS'

          labelFileConflicts.text = "FILE CONFLICTS";
          labelFileConflictsSmall.text = "The asset also has file conflicts";
          btnViewFileConflicts.text = "VIEW FILE CONFLICTS";
          panelFileConflicts.header = 'FILE CONFLICTS';
      }
      panelBottom.hidden = diffMode;
      panelTopBase.hidden = diffMode;
  };

  // load and show data
  overlay.on('show', function () {
      // editor-blocking picker opened
      editor.emit('picker:open', 'conflict-manager');

      setLayoutMode(LAYOUT_NONE);

      if (!currentMergeObject) {
          if (diffMode) {
              // in this case we are doing a diff between the current merge
              // and the destination checkpoint
              showMainProgress(spinnerIcon, 'Loading changes...');
              editor.call('diff:merge', function (err, data) {
                  console.log(data);
                  if (err) {
                      return showMainProgress(errorIcon, err);
                  }

                  onMergeDataLoaded(data);
              });

          } else {
              // get the conflicts of the current merge
              showMainProgress(spinnerIcon, 'Loading conflicts...');
              editor.call('branches:getMerge', config.self.branch.merge.id, function (err, data) {
                  console.log(data);
                  if (err) {
                      return showMainProgress(errorIcon, err);
                  }

                  onMergeDataLoaded(data);
              });
          }

      } else {
          onMergeDataLoaded(currentMergeObject);
      }


      if (editor.call('viewport:inViewport')) {
          editor.emit('viewport:hover', false);
      }
  });

  // clean up
  overlay.on('hide', function () {
      currentMergeObject = null;

      listItems.clear();

      if (resolver) {
          resolver.destroy();
          resolver = null;
      }

      // editor-blocking picker closed
      editor.emit('picker:close', 'conflict-manager');

      if (editor.call('viewport:inViewport')) {
          editor.emit('viewport:hover', true);
      }
  });

  // Prevent viewport hovering when the picker is shown
  editor.on('viewport:hover', function (state) {
      if (state && !overlay.hidden) {
          setTimeout(function () {
              editor.emit('viewport:hover', false);
          }, 0);
      }
  });

  // show conflict manager
  editor.method('picker:conflictManager', function (data) {
      toggleDiffMode(false);
      currentMergeObject = data;
      overlay.hidden = false;
  });

  // Returns the current merge object
  editor.method('picker:conflictManager:currentMerge', function () {
      return currentMergeObject;
  });

  editor.method('picker:conflictManager:rightPanel', function () {
      return panelRight;
  });

  // shows diff manager which is the conflict manager in a different mode
  editor.method('picker:diffManager', function (diff) {
      toggleDiffMode(true);
      currentMergeObject = diff;
      overlay.hidden = false;
  });
});


/* editor/pickers/sprite-editor/sprite-editor-atlas-panel.js */
editor.once('load', function() {
  'use strict';

  editor.method('picker:sprites:attributes:atlas', function (atlasAsset) {
      var rootPanel = editor.call('picker:sprites:rightPanel');

      rootPanel.header = 'TEXTURE ATLAS';

      var panel = editor.call('attributes:addPanel', {
          parent: rootPanel
      });

      var events = [];

      // atlas id
      var fieldId = editor.call('attributes:addField', {
          parent: panel,
          name: 'ID',
          link: atlasAsset,
          path: 'id'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:id', fieldId.parent.innerElement.firstChild.ui, null, panel);

      // atlas width
      var fieldWidth = editor.call('attributes:addField', {
          parent: panel,
          name: 'Width',
          path: 'meta.width',
          link: atlasAsset
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:atlas:width', fieldWidth.parent.innerElement.firstChild.ui, null, panel);

      // atlas height
      var fieldHeight = editor.call('attributes:addField', {
          parent: panel,
          name: 'Height',
          path: 'meta.height',
          link: atlasAsset
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:atlas:height', fieldHeight.parent.innerElement.firstChild.ui, null, panel);

      // number of frames
      var fieldFrames = editor.call('attributes:addField', {
          parent: panel,
          name: 'Frames'
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:atlas:frames', fieldFrames.parent.innerElement.firstChild.ui, null, panel);

      var timeout;

      // Update number of frames field
      var updateFrameCount = function () {
          timeout = null;
          var frames = atlasAsset.getRaw('data.frames')._data;
          fieldFrames.value = Object.keys(frames).length;
      };

      updateFrameCount();

      // Update number of frames when data.frames changes or when a new frame is added
      atlasAsset.on('*:set', function (path, value) {
          if (! /^data\.frames(\.\d+)?$/.test(path)) return;

          // do this in a timeout to avoid updating
          // when we add a lot of frames at once
          if (! timeout)
              timeout = setTimeout(updateFrameCount) ;

      });

      // Update number of frames when a frame is deleted
      atlasAsset.on('*:unset', function (path) {
          if (! /^data\.frames\.\d+$/.test(path)) return;

          // do this in a timeout to avoid updating
          // when we add a lot of frames at once
          if (! timeout)
              timeout = setTimeout(updateFrameCount) ;
      });

      events.push(rootPanel.on('clear', function () {
          panel.destroy();
      }));

      panel.on('destroy', function () {
          for (var i = 0, len = events.length; i<len; i++) {
              events[i].unbind();
          }
          events.length = 0;
      });
  });
});


/* editor/pickers/sprite-editor/sprite-editor-frames-attributes-panel.js */
editor.once('load', function() {
  'use strict';

  editor.method('picker:sprites:attributes:frames', function (args) {
      var events = [];
      var suspendChanges = false;
      var atlasAsset = args.atlasAsset;
      var atlasImage = args.atlasImage;
      var frames = args.frames;
      var numFrames = frames.length;

      var rootPanel = editor.call('picker:sprites:rightPanel');
      if (numFrames > 1) {
          rootPanel.header = 'FRAME INSPECTOR - MULTIPLE FRAMES';
      } else {
          rootPanel.header = 'FRAME INSPECTOR - ' + atlasAsset.get('data.frames.' + frames[0] + '.name');
      }

      editor.call('picker:sprites:attributes:frames:preview', {
          atlasAsset: atlasAsset,
          atlasImage: atlasImage,
          frames: frames
      });

      var panel = editor.call('attributes:addPanel', {
          parent: rootPanel
      });
      panel.disabled = ! editor.call('permissions:write');
      events.push(editor.on('permissions:writeState', function (canWrite) {
          panel.disabled = ! canWrite;
      }));

      var fieldName = editor.call('attributes:addField', {
          parent: panel,
          name: 'Name',
          type: 'string',
          link: atlasAsset,
          paths: frames.map(function (f) {return 'data.frames.' + f + '.name';})
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:frame:name', fieldName.parent.innerElement.firstChild.ui, null, panel);

      fieldName.on('change', function (value) {
          if (numFrames === 1) {
              rootPanel.header = 'FRAME INSPECTOR - ' + value;
          }
      });

      // add field for frame rect but hide it and only use it for multi-editing
      // The user only will see position and size fields in pixels which is more helpful
      // but we'll use the internal rect fields to edit it
      var fieldRect = editor.call('attributes:addField', {
          parent: panel,
          type: 'vec4',
          link: atlasAsset,
          paths: frames.map(function (f) {return 'data.frames.' + f + '.rect';})
      });
      fieldRect[0].parent.hidden = true;

      fieldRect[0].on('change', function () {
          if (suspendChanges) return;

          suspendChanges = true;
          updatePositionX();
          updateSizeX();
          updateBorderMax();
          suspendChanges = false;
      });

      fieldRect[1].on('change', function () {
          if (suspendChanges) return;

          suspendChanges = true;
          updatePositionY();
          updateSizeY();
          updateBorderMax();
          suspendChanges = false;
      });

      fieldRect[2].on('change', function () {
          if (suspendChanges) return;

          suspendChanges = true;
          updateSizeX();
          updateBorderMax();
          suspendChanges = false;
      });

      fieldRect[3].on('change', function () {
          if (suspendChanges) return;

          suspendChanges = true;
          updatePositionY();
          updateSizeY();
          updateBorderMax();
          suspendChanges = false;
      });

      var updateMaxPosition = function (field) {
          var dimension = field === 0 ? atlasImage.width : atlasImage.height;
          var maxPos = dimension;

          var rectIndex = field === 0 ? 2 : 3;

          var frameData = atlasAsset.getRaw('data.frames')._data;

          for (var i = 0, len = frames.length; i<len; i++) {
              var f = frameData[frames[i]];
              if (! f) continue;
              var rect = f._data.rect;
              maxPos = Math.min(maxPos, dimension - rect[rectIndex]);
          }

          fieldPosition[field].max = maxPos;
      };

      var updateMaxSize = function (field) {
          var dimension = field === 0 ? atlasImage.width : atlasImage.height;
          var maxSize = dimension;

          var rectIndex = field === 0 ? 0 : 1;

          var frameData = atlasAsset.getRaw('data.frames')._data;

          for (var i = 0, len = frames.length; i<len; i++) {
              var f = frameData[frames[i]];
              if (! f) continue;
              var rect = f._data.rect;
              maxSize = Math.min(maxSize, dimension - rect[rectIndex]);
          }

          fieldSize[field].max = maxSize;
      };

      var updatePositionX = function () {
          if (fieldRect[0].proxy) {
              fieldPosition[0].value = null;
          } else {
              fieldPosition[0].value = fieldRect[0].value;
          }

          updateMaxPosition(0);

          // give time to rect proxy to update
          setTimeout(function () {
              fieldPosition[0].proxy = fieldRect[0].proxy;
          });
      };

      var updatePositionY = function () {
          if (fieldRect[1].proxy) {
              fieldPosition[1].value = null;
          } else {
              fieldPosition[1].value = fieldRect[1].value;
          }

          updateMaxPosition(1);

          // give time to rect proxy to update
          setTimeout(function () {
              fieldPosition[1].proxy = fieldRect[1].proxy;
          });
      };

      var updateSizeX = function () {
          if (fieldRect[2].proxy) {
              fieldSize[0].value = null;
          } else {
              fieldSize[0].value = fieldRect[2].value;
          }

          updateMaxSize(0);

          // give time to rect proxy to update
          setTimeout(function () {
              fieldSize[0].proxy = fieldRect[2].proxy;
          });
      };

      var updateSizeY = function () {
          if (fieldRect[3].proxy) {
              fieldSize[1].value = null;
          } else {
              fieldSize[1].value = fieldRect[3].value;
          }

          updateMaxSize(1);

          // give time to rect proxy to update
          setTimeout(function () {
              fieldSize[1].proxy = fieldRect[3].proxy;
          });
      };

      // position in pixels
      var fieldPosition = editor.call('attributes:addField', {
          parent: panel,
          name: 'Position',
          type: 'vec2',
          precision: 0,
          min: 0,
          placeholder: ['→', '↑']
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:frame:position', fieldPosition[0].parent.innerElement.firstChild.ui, null, panel);

      updatePositionX();
      updatePositionY();

      fieldPosition[0].on('change', function (value) {
          if (suspendChanges) return;
          suspendChanges = true;
          fieldRect[0].value = value;
          fieldPosition[0].proxy = fieldRect[0].proxy;
          updateMaxPosition(0);
          suspendChanges = false;
      });

      fieldPosition[1].on('change', function (value) {
          if (suspendChanges) return;
          suspendChanges = true;
          fieldRect[1].value = value;
          fieldPosition[1].proxy = fieldRect[1].proxy;
          updateMaxPosition(1);
          suspendChanges = false;
      });

      // size in pixels
      var fieldSize = editor.call('attributes:addField', {
          parent: panel,
          name: 'Size',
          type: 'vec2',
          precision: 0,
          min: 1,
          placeholder: ['→', '↑']
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:frame:size', fieldSize[0].parent.innerElement.firstChild.ui, null, panel);

      updateSizeX();
      updateSizeY();

      fieldSize[0].on('change', function (value) {
          if (suspendChanges) return;

          updateSizeAndAdjustBorder(value, false);
      });

      fieldSize[1].on('change', function (value) {
          if (suspendChanges) return;

          updateSizeAndAdjustBorder(value, true);
      });

      // Updates the rect of the selected frames adjusting
      // their borders if necessary.
      var updateSizeAndAdjustBorder = function (value, isHeight) {
          var prev = null;

          var rect = isHeight ? 3 : 2;
          var border = isHeight ? 1 : 0;

          var redo = function () {
              var asset = editor.call('assets:get', atlasAsset.get('id'));
              if (! asset) return;

              var history = asset.history.enabled;
              asset.history.enabled = false;

              var frameData = asset.getRaw('data.frames')._data;
              for (var i = 0, len = frames.length; i<len; i++) {
                  var frame = frameData[frames[i]];
                  if (! frame) continue;

                  if (frame._data.rect[rect] !== value) {
                      if (! prev) prev = {};

                      prev[frames[i]] = {
                          value: frame._data.rect[rect],
                          border: [frame._data.border[border], frame._data.border[border + 2]]
                      }

                      // set property
                      asset.set('data.frames.' + frames[i] + '.rect.' + rect, value);

                      // check if border needs to be adjusted
                      if (frame._data.border[border] > value - frame._data.border[border + 2]) {
                          asset.set('data.frames.' + frames[i] + '.border.' + border, Math.max(0, value - frame._data.border[border + 2]));
                      }

                      if (frame._data.border[border + 2] > value - frame._data.border[border]) {
                          asset.set('data.frames.' + frames[i] + '.border.' + (border + 2), Math.max(0, value - frame._data.border[border]));
                      }
                  }
              }

              asset.history.enabled = history;
          };

          var undo = function () {

              var asset = editor.call('assets:get', atlasAsset.get('id'));
              if (! asset) return;

              var history = asset.history.enabled;
              asset.history.enabled = false;

              var frameData = asset.getRaw('data.frames')._data;

              for (var key in prev) {
                  if (! frameData[key]) continue;

                  asset.set('data.frames.' + key + '.rect.' + rect, prev[key].value);
                  asset.set('data.frames.' + key + '.border.' + border, prev[key].border[0]);
                  asset.set('data.frames.' + key + '.border.' + (border + 2), prev[key].border[1]);
              }

              asset.history.enabled = history;

              prev = null;
          };

          editor.call('history:add', {
              name: 'change rect',
              undo: undo,
              redo: redo
          })

          redo();
      };

      // pivot presets
      var presetValues = [
          [0, 1],
          [0.5, 1],
          [1, 1],
          [0, 0.5],
          [0.5, 0.5],
          [1, 0.5],
          [0, 0],
          [0.5, 0],
          [1, 0]
      ];

      var fieldPivotPreset = editor.call('attributes:addField', {
          parent: panel,
          name: 'Pivot Preset',
          type: 'string',
          enum: [
              { v: 0, t: 'Top Left' },
              { v: 1, t: 'Top' },
              { v: 2, t: 'Top Right' },
              { v: 3, t: 'Left' },
              { v: 4, t: 'Center' },
              { v: 5, t: 'Right' },
              { v: 6, t: 'Bottom Left' },
              { v: 7, t: 'Bottom' },
              { v: 8, t: 'Bottom Right' }
          ]
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:frame:pivotPreset', fieldPivotPreset.parent.innerElement.firstChild.ui, null, panel);

      fieldPivotPreset.on('change', function (value) {
          if (suspendChanges) return;

          var newValue = presetValues[parseInt(value, 10)];
          if (! newValue) return;

          var prevValues = {};
          for (var i = 0; i < numFrames; i++) {
              prevValues[frames[i]] = atlasAsset.get('data.frames.' + frames[i] + '.pivot');
          }

          var redo = function () {
              var asset = editor.call('assets:get', atlasAsset.get('id'));
              if (! asset) return;

              var history = asset.history.enabled;
              asset.history.enabled = false;
              for (var i = 0; i < numFrames; i++) {
                  var key = 'data.frames.' + frames[i];
                  if (asset.has(key)) {
                      asset.set(key + '.pivot', newValue);
                  }
              }
              asset.history.enabled = history;
          };

          var undo = function () {
              var asset = editor.call('assets:get', atlasAsset.get('id'));
              if (! asset) return;

              var history = asset.history.enabled;
              asset.history.enabled = false;
              for (var i = 0; i < numFrames; i++) {
                  var key = 'data.frames.' + frames[i];
                  if (asset.has(key) && prevValues[frames[i]]) {
                      asset.set(key + '.pivot', prevValues[frames[i]]);
                  }

              }
              asset.history.enabled = history;
          };

          editor.call('history:add', {
              name: 'edit pivot',
              undo: undo,
              redo: redo
          });

          redo();
      });

      // pivot
      var fieldPivot = editor.call('attributes:addField', {
          parent: panel,
          name: 'Pivot',
          type: 'vec2',
          min: 0,
          max: 1,
          precision: 2,
          step: 0.1,
          placeholder: ['↔', '↕'],
          link: atlasAsset,
          paths: frames.map(function (f) {return 'data.frames.' + f + '.pivot';})
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:frame:pivot', fieldPivot[0].parent.innerElement.firstChild.ui, null, panel);

      fieldPivot[0].on('change', function (value) {
          if (suspendChanges) return;
          updatePivotPreset();
      });
      fieldPivot[1].on('change', function (value) {
          if (suspendChanges) return;
          updatePivotPreset();
      });

      var updatePivotPreset = function () {
          var suspend = suspendChanges;
          suspendChanges = true;
          for (var i = 0; i < presetValues.length; i++) {
              if (presetValues[i][0] === fieldPivot[0].value && presetValues[i][1] === fieldPivot[1].value) {
                  fieldPivotPreset.value = i;
                  break;
              }
          }
          suspendChanges = suspend;
      };

      updatePivotPreset();

      // border
      var fieldBorder = editor.call('attributes:addField', {
          parent: panel,
          placeholder: ['←', '↓', '→', '↑'],
          name: 'Border',
          type: 'vec4',
          link: atlasAsset,
          min: 0,
          paths: frames.map(function (f) {return 'data.frames.' + f + '.border';})
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:frame:border', fieldBorder[0].parent.innerElement.firstChild.ui, null, panel);

      var updateBorderMax = function () {
          // set left border max to not exceed the right border in any frame
          var maxLeft = atlasImage.width;
          var maxRight = atlasImage.width;
          var maxBottom = atlasImage.height;
          var maxTop = atlasImage.height;

          var frameData = atlasAsset.getRaw('data.frames')._data;

          for (var i = 0, len = frames.length; i<len; i++) {
              var f = frameData[frames[i]];
              if (! f) continue;
              var rect = f._data.rect;
              var border = f._data.border;
              maxLeft = Math.min(maxLeft, rect[2] - border[2]);
              maxRight = Math.min(maxRight, rect[2] - border[0]);
              maxBottom = Math.min(maxBottom, rect[3] - border[3]);
              maxTop = Math.min(maxTop, rect[3] - border[1]);
          }

          fieldBorder[0].max = maxLeft;
          fieldBorder[2].max = maxRight;
          fieldBorder[1].max = maxBottom;
          fieldBorder[3].max = maxTop;
      };

      for (var i = 0; i<4; i++) {
          fieldBorder[i].on('change', updateBorderMax);
      }

      var panelButtons = editor.call('attributes:addPanel', {
          parent: rootPanel,
          name: 'ACTIONS'
      });
      panelButtons.class.add('buttons');
      panelButtons.disabled = ! editor.call('permissions:write');
      events.push(editor.on('permissions:writeState', function (canWrite) {
          panelButtons.disabled = ! canWrite;
      }));

      // new sprite
      var btnCreateSprite = new ui.Button({
          text: 'New Sprite From Selection'
      });
      btnCreateSprite.class.add('icon', 'wide', 'create');
      panelButtons.append(btnCreateSprite);

      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:frame:newsprite', btnCreateSprite, null, panel);

      btnCreateSprite.on('click', function () {
          btnCreateSprite.disabled = true;
          editor.call('picker:sprites:spriteFromSelection', {
              callback: function () {
                  btnCreateSprite.disabled = false;
              }
          });
      });

      // new sliced sprite
      var btnCreateSlicedSprite = new ui.Button({
          text: 'New Sliced Sprite From Selection'
      });
      btnCreateSlicedSprite.class.add('icon', 'wide', 'create');
      panelButtons.append(btnCreateSlicedSprite);

      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:frame:newsprite', btnCreateSlicedSprite, null, panel);

      btnCreateSlicedSprite.on('click', function () {
          btnCreateSlicedSprite.disabled = true;
          editor.call('picker:sprites:spriteFromSelection', {
              sliced: true,
              callback: function () {
                  btnCreateSprite.disabled = false;
              }
          });
      });

      // focus frame
      var btnFocus = new ui.Button({
          text: 'Focus On Selection'
      });
      btnFocus.class.add('icon', 'wide', 'focus');
      panelButtons.append(btnFocus);
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:frame:focus', btnFocus, null, panel);

      btnFocus.on('click', function () {
          editor.call('picker:sprites:focus');
      });

      // trim rect
      var btnTrim = new ui.Button({
          text: 'Trim Selected Frames'
      });
      btnTrim.class.add('icon', 'wide', 'trim');
      panelButtons.append(btnTrim);

      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:frame:trim', btnTrim, null, panel);

      // trim transparent pixels around frame
      btnTrim.on('click', function () {
          editor.call('picker:sprites:trimFrames', frames);
      });

      // delete frame
      var btnDelete = new ui.Button({
          text: 'Delete Selected Frames'
      });
      btnDelete.class.add('icon', 'wide', 'remove');
      panelButtons.append(btnDelete);

      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:frame:delete', btnDelete, null, panel);

      btnDelete.on('click', function () {
          editor.call('picker:sprites:deleteFrames', frames, {
              history: true
          });
      });

      // clean up
      events.push(rootPanel.on('clear', function () {
          panel.destroy();
          panelButtons.destroy();
      }));

      panel.on('destroy', function () {
          for (var i = 0, len = events.length; i<len; i++) {
              events[i].unbind();
          }
          events.length = 0;
      });
  });
});


/* editor/pickers/sprite-editor/sprite-editor-frames-related-sprites-panel.js */
editor.once('load', function() {
  'use strict';

  editor.method('picker:sprites:attributes:frames:relatedSprites', function (args) {
      var events = [];

      var atlasAsset = args.atlasAsset;
      var frames = args.frames;
      var numFrames = frames.length;

      var rootPanel = editor.call('picker:sprites:rightPanel');

      var panel = editor.call('attributes:addPanel', {
          parent: rootPanel,
          name: 'RELATED SPRITE ASSETS'
      });

      panel.class.add('component');

      var labelNoAssets = new ui.Label({
          text: 'None'
      });
      panel.append(labelNoAssets);

      var list = new ui.List();
      list.class.add('related-assets');
      panel.append(list);

      var assets = editor.call('assets:find', function (asset) {
          if (asset.get('type') !== 'sprite' || asset.get('data.textureAtlasAsset') !== atlasAsset.get('id')) {
              return false;
          }

          var keys = asset.getRaw('data.frameKeys');
          for (var i = 0; i < numFrames; i++) {
              if (keys.indexOf(frames[i]) !== -1) {
                  return true;
              }
          }

          return false;
      });

      labelNoAssets.hidden = assets.length > 0;
      list.hidden = assets.length === 0;

      var createAssetPanel = function (asset) {
          var assetEvents = [];

          var item = new ui.ListItem({
              text: asset.get('name')
          });
          item.class.add('type-sprite');
          list.append(item);
          item.on('click', function () {
              editor.call('picker:sprites:selectSprite', asset);
          });

          assetEvents.push(asset.on('name:set', function (value) {
              item.text = value;
          }));

          assetEvents.push(asset.once('destroy', function () {
              item.destroy();
          }));

          item.on('destroy', function () {
              for (var i = 0; i < assetEvents.length; i++) {
                  assetEvents[i].unbind();
              }
              assetEvents.length = 0;
          });
      };

      for (var i = 0; i < assets.length; i++) {
          createAssetPanel(assets[i][1]);
      }

      // clean up
      events.push(rootPanel.on('clear', function () {
          panel.destroy();
      }));

      panel.on('destroy', function () {
          for (var i = 0, len = events.length; i<len; i++) {
              events[i].unbind();
          }
          events.length = 0;
      });
  });
});


/* editor/pickers/sprite-editor/sprite-editor-preview-panel.js */
editor.once('load', function () {
  'use strict';

  editor.method('picker:sprites:attributes:frames:preview', function (args) {
      var parent = editor.call('picker:sprites:rightPanel');

      var atlasAsset = args.atlasAsset;
      var atlasImage = args.atlasImage;
      var frames = args.frames;
      var frameObservers = frames.map(function (f) {return atlasAsset.getRaw('data.frames.' + f);});

      var events = [];

      var previewContainer = document.createElement('div');
      previewContainer.classList.add('asset-preview-container');

      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 256;
      canvas.classList.add('asset-preview');
      previewContainer.append(canvas);

      canvas.addEventListener('click', function() {
          if (parent.class.contains('large')) {
              parent.class.remove('large');
          } else {
              parent.class.add('large');
          }
          queueRender();
      }, false);

      parent.class.add('asset-preview');
      parent.element.insertBefore(previewContainer, parent.innerElement);

      var panelControls = new ui.Panel();
      panelControls.class.add('preview-controls');
      previewContainer.appendChild(panelControls.element);

      var time = 0;
      var playing = true;
      var fps = 10;
      var frame = 0;
      var lastTime = Date.now();

      // var btnPlay = new ui.Button({
      //     text: '&#57649;'
      // });
      // panelControls.append(btnPlay);

      // btnPlay.on('click', function() {
      //     playing = !playing;

      //     if (playing) {
      //         lastTime = Date.now();
      //         btnPlay.class.add('active', 'pinned');
      //     } else {
      //         btnPlay.class.remove('active', 'pinned');
      //     }

      //     queueRender();
      // });

      var renderQueued;

      // queue up the rendering to prevent too oftern renders
      var queueRender = function() {
          if (renderQueued) return;
          renderQueued = true;
          requestAnimationFrame(renderPreview);
      };

      var renderPreview = function () {
          if (! previewContainer) return;

          if (renderQueued)
              renderQueued = false;

          if (playing) {
              var now = Date.now();
              time += (now - lastTime) / 1000;

              frame = Math.floor(time * fps);
              var numFrames = frames.length;
              if (frame >= numFrames) {
                  frame = 0;
                  time -= numFrames / fps;
              }

              lastTime = now;
          }

          canvas.width = canvas.clientWidth;
          canvas.height = canvas.clientHeight;

          // render
          var frameData = frameObservers[frame] && frameObservers[frame]._data;
          editor.call('picker:sprites:renderFramePreview', frameData, canvas, frameObservers, true);

          if (playing) {
              queueRender();
          }
      };
      renderPreview();


      // render on resize
      events.push(parent.on('resize', queueRender));

      events.push(parent.on('clear', function () {
          parent.class.remove('asset-preview', 'animate');

          previewContainer.parentElement.removeChild(previewContainer);
          previewContainer = null;

          playing = false;

          panelControls.destroy();

          for (var i = 0, len = events.length; i<len; i++) {
              events[i].unbind();
          }
          events.length = 0;
      }));

      return {
          setFrames: function (newFrames) {
              frames = newFrames;
              frameObservers = frames.map(function (f) {return atlasAsset.getRaw('data.frames.' + f);});
          }
      };
  });
});


/* editor/pickers/sprite-editor/sprite-editor-generate-frames-panel.js */
editor.once('load', function () {
  'use strict';

  editor.method('picker:sprites:attributes:slice', function (args) {
      var events = [];

      var atlasAsset = args.atlasAsset;
      var atlasImage = args.atlasImage;
      var imageData = args.atlasImageData;

      var rootPanel = editor.call('picker:sprites:rightPanel');

      var panel = editor.call('attributes:addPanel', {
          parent: rootPanel,
          name: 'GENERATE FRAMES'
      });

      panel.disabled = ! editor.call('permissions:write');

      events.push(editor.on('permissions:writeState', function (canWrite) {
          panel.disabled = ! canWrite;
      }));

      var METHOD_DELETE_EXISTING = 1;
      var METHOD_ONLY_APPEND = 2;

      var TYPE_GRID_BY_FRAME_COUNT  = 1;
      var TYPE_GRID_BY_FRAME_SIZE  = 2;
      var TYPE_GRID_AUTO = 3; // not implemented

      var PIVOT_TOP_LEFT  = 0;
      var PIVOT_TOP       = 1;
      var PIVOT_TOP_RIGHT = 2;
      var PIVOT_LEFT      = 3;
      var PIVOT_CENTER    = 4;
      var PIVOT_RIGHT     = 5;
      var PIVOT_BOTTOM_LEFT   = 6;
      var PIVOT_BOTTOM        = 7;
      var PIVOT_BOTTOM_RIGHT  = 8;


      var fieldMethod = editor.call('attributes:addField', {
          parent: panel,
          name: 'Method',
          type: 'number',
          value: METHOD_DELETE_EXISTING,
          enum: [
              { v: METHOD_DELETE_EXISTING, t: 'Delete Existing' },
              { v: METHOD_ONLY_APPEND, t: 'Only Append' },
          ],
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:generate:method', fieldMethod.parent.innerElement.firstChild.ui, null, panel);

      var fieldType = editor.call('attributes:addField', {
          parent: panel,
          name: 'Type',
          type: 'number',
          value: TYPE_GRID_BY_FRAME_COUNT,
          enum: [
              {v: TYPE_GRID_BY_FRAME_COUNT, t: 'Grid By Frame Count'},
              {v: TYPE_GRID_BY_FRAME_SIZE, t: 'Grid By Frame Size'}
              // {v: 3, t: 'Auto'}
          ]
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:generate:type', fieldType.parent.innerElement.firstChild.ui, null, panel);

      var fieldColsRows = editor.call('attributes:addField', {
          parent: panel,
          name: 'Frame Count',
          type: 'vec2',
          value: [1, 1],
          precision: 0,
          min: 1,
          placeholder: ['Cols', 'Rows']
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:generate:count', fieldColsRows[0].parent.innerElement.firstChild.ui, null, panel);

      var fieldPixels = editor.call('attributes:addField', {
          parent: panel,
          name: 'Frame Size',
          type: 'vec2',
          value: [atlasImage.width, atlasImage.height],
          precision: 0,
          min: 1,
          placeholder: ['X', 'Y']
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:generate:size', fieldPixels[0].parent.innerElement.firstChild.ui, null, panel);

      var fieldOffset = editor.call('attributes:addField', {
          parent: panel,
          name: 'Offset',
          type: 'vec2',
          value: [0, 0],
          precision: 0,
          min: 0,
          placeholder: ['X', 'Y']
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:generate:offset', fieldOffset[0].parent.innerElement.firstChild.ui, null, panel);

      var fieldSpacing = editor.call('attributes:addField', {
          parent: panel,
          name: 'Spacing',
          type: 'vec2',
          value: [0, 0],
          precision: 0,
          min: 0,
          placeholder: ['X', 'Y']
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:generate:spacing', fieldSpacing[0].parent.innerElement.firstChild.ui, null, panel);

      // pivot presets
      var presetValues = [
          [0, 1],
          [0.5, 1],
          [1, 1],
          [0, 0.5],
          [0.5, 0.5],
          [1, 0.5],
          [0, 0],
          [0.5, 0],
          [1, 0]
      ];

      var fieldPivot = editor.call('attributes:addField', {
          parent: panel,
          name: 'Pivot',
          type: 'number',
          enum: [
              { v: PIVOT_TOP_LEFT, t: 'Top Left' },
              { v: PIVOT_TOP, t: 'Top' },
              { v: PIVOT_TOP_RIGHT, t: 'Top Right' },
              { v: PIVOT_LEFT, t: 'Left' },
              { v: PIVOT_CENTER, t: 'Center' },
              { v: PIVOT_RIGHT, t: 'Right' },
              { v: PIVOT_BOTTOM_LEFT, t: 'Bottom Left' },
              { v: PIVOT_BOTTOM, t: 'Bottom' },
              { v: PIVOT_BOTTOM_RIGHT, t: 'Bottom Right' }
          ],
          value: PIVOT_CENTER
      });
      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:generate:pivot', fieldPivot.parent.innerElement.firstChild.ui, null, panel);

      var toggleFields = function () {
          fieldColsRows[0].parent.hidden = fieldType.value !== TYPE_GRID_BY_FRAME_COUNT;
          fieldPixels[0].parent.hidden = fieldType.value !== TYPE_GRID_BY_FRAME_SIZE;
          fieldOffset[0].parent.hidden = fieldType.value !== TYPE_GRID_BY_FRAME_COUNT && fieldType.value !== TYPE_GRID_BY_FRAME_SIZE;
          fieldSpacing[0].parent.hidden = fieldType.value !== TYPE_GRID_BY_FRAME_COUNT && fieldType.value !== TYPE_GRID_BY_FRAME_SIZE;
      };

      toggleFields();

      fieldType.on('change', toggleFields);

      var btnGenerate = editor.call('attributes:addField', {
          parent: panel,
          text: 'GENERATE FRAMES',
          type: 'button',
          name: ' '
      });

      btnGenerate.class.add('icon', 'generate');

      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:generate:generate', btnGenerate, null, panel);

      btnGenerate.on('click', function () {
          btnGenerate.disabled = true;
          var type = fieldType.value;
          var method = fieldMethod.value;

          var oldFrames = atlasAsset.get('data.frames');
          var newFrames = method === METHOD_DELETE_EXISTING ? {} : atlasAsset.get('data.frames');

          var redo = function () {
              var asset = editor.call('assets:get', atlasAsset.get('id'));
              if (! asset) return;
              var history = asset.history.enabled;
              asset.history.enabled = false;

              if (type === TYPE_GRID_BY_FRAME_COUNT) {
                  sliceGridByCount(fieldColsRows[0].value, fieldColsRows[1].value, newFrames);

                  // set frames and manually emit 'set' event
                  // to avoid huge performance hit if there's a lot of frames
                  setFrames(asset, newFrames);
              } else if (type === TYPE_GRID_BY_FRAME_SIZE) {
                  var width = atlasImage.width;
                  var height = atlasImage.height;
                  sliceGridBySize(fieldPixels[0].value, fieldPixels[1].value, newFrames);
                  setFrames(asset, newFrames);
              } else if (type === TYPE_GRID_AUTO) {
                  // TODO
              }

              asset.history.enabled = history;
          };

          var undo = function () {
              var asset = editor.call('assets:get', atlasAsset.get('id'));
              if (! asset) return;
              var history = asset.history.enabled;
              asset.history.enabled = false;
              setFrames(asset, oldFrames);
              asset.history.enabled = history;
          };

          editor.call('history:add', {
              name: 'slice',
              redo: redo,
              undo: undo
          });

          // do this in a timeout to give a chance to the button to
          // appear disabled
          setTimeout(function () {
              redo();
              btnGenerate.disabled = false;
          }, 50);
      });

      var btnClear = editor.call('attributes:addField', {
          parent: panel,
          text: 'Delete All Frames',
          type: 'button',
          name: ' '
      });

      btnClear.class.add('icon', 'remove');

      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:generate:clear', btnClear, null, panel);

      btnClear.on('click', function () {
          editor.call('picker:confirm', 'Are you sure you want to delete all the frames?', function () {
              var frames = atlasAsset.get('data.frames');

              btnClear.disabled = true;

              var redo = function () {
                  var asset = editor.call('assets:get', atlasAsset.get('id'));
                  if (! asset) return;
                  var history = asset.history.enabled;
                  asset.history.enabled = false;
                  setFrames(asset, {});
                  asset.history.enabled = history;
              };

              var undo = function () {
                  var asset = editor.call('assets:get', atlasAsset.get('id'));
                  if (! asset) return;
                  var history = asset.history.enabled;
                  asset.history.enabled = false;
                  setFrames(asset, frames);
                  asset.history.enabled = history;
              };

              editor.call('history:add', {
                  name: 'delete all frames',
                  undo: undo,
                  redo: redo
              });

              // do this in a timeout so that the button can appear disabled
              setTimeout(function () {
                  redo();
                  btnClear.disabled = false;
              });
          });
      });

      // Set frames without firing events for each individual json field
      var setFrames = function (asset, frames) {
          var suspend = asset.suspendEvents;
          asset.suspendEvents = true;
          asset.set('data.frames', frames);
          asset.suspendEvents = suspend;
          asset.emit('data.frames:set', frames, null, false);
          asset.emit('*:set', 'data.frames', frames, null, false);
      };

      // Slice atlas in frames using a grid
      var sliceGridByCount = function (cols, rows, frames) {
          var pivot = presetValues[fieldPivot.value];

          var maxKey = 1;
          for (var key in frames) {
              maxKey = Math.max(maxKey, parseInt(key, 10) + 1);
          }

          var offsetX = fieldOffset[0].value;
          var offsetY = fieldOffset[1].value;

          var spacingX = fieldSpacing[0].value;
          var spacingY = fieldSpacing[1].value;

          var imgWidth = atlasImage.width - offsetX;
          var imgHeight = atlasImage.height - offsetY;

          var totalSpacingX = spacingX * (cols - 1);
          var totalSpacingY = spacingY * (rows - 1);

          var frameWidth = Math.floor((imgWidth - totalSpacingX) / cols);
          var frameHeight = Math.floor((imgHeight - totalSpacingY) / rows);

          var spacedWidth = frameWidth + spacingX;
          var spacedHeight = frameHeight + spacingY;

          for (var r = 0; r < rows; r++) {
              for (var c = 0; c < cols; c++) {
                  var left = offsetX + c * (frameWidth + spacingX);
                  var top = offsetY + r * (frameHeight + spacingY) - offsetY - spacingY;

                  if (! isRegionEmpty(left, top+spacingY, frameWidth, frameHeight)) {
                      frames[maxKey] = {
                          name: 'Frame ' + maxKey,
                          rect: [left, Math.floor(imgHeight - (top + spacedHeight)), frameWidth, frameHeight],
                          pivot: pivot,
                          border: [0,0,0,0]
                      };
                      maxKey++;
                  }
              }
          }
      };

      var sliceGridBySize = function (frameWidth, frameHeight, frames) {
          var pivot = presetValues[fieldPivot.value];

          var maxKey = 1;
          for (var key in frames) {
              maxKey = Math.max(maxKey, parseInt(key, 10) + 1);
          }

          var offsetX = fieldOffset[0].value;
          var offsetY = fieldOffset[1].value;

          var spacingX = fieldSpacing[0].value;
          var spacingY = fieldSpacing[1].value;

          var imgWidth = atlasImage.width - offsetX;
          var imgHeight = atlasImage.height - offsetY;

          var cols = Math.floor((imgWidth + spacingX) / (frameWidth + spacingX));
          var rows = Math.floor((imgHeight + spacingY) / (frameHeight + spacingY));

          var totalSpacingX = spacingX * (cols - 1);
          var totalSpacingY = spacingY * (rows - 1);

          var spacedWidth = frameWidth + spacingX;
          var spacedHeight = frameHeight + spacingY;

          for (var r = 0; r < rows; r++) {
              for (var c = 0; c < cols; c++) {
                  var left = offsetX + c * (frameWidth + spacingX);
                  var top = offsetY + r * (frameHeight + spacingY) - offsetY - spacingY;

                  if (! isRegionEmpty(left, top+spacingY, frameWidth, frameHeight)) {
                      frames[maxKey] = {
                          name: 'Frame ' + maxKey,
                          rect: [left, Math.floor(imgHeight - (top + spacedHeight)), frameWidth, frameHeight],
                          pivot: pivot,
                          border: [0,0,0,0]
                      };
                      maxKey++;
                  }
              }
          }
      };

      // Checks if an image region has alpha
      var isRegionEmpty = function (left, top, width, height) {
          var right = left + width;
          var bottom = top + height;

          for (var x = left; x < right; x++) {
              for (var y = top; y < bottom; y++) {
                  if (! isPixelEmpty(x, y)) {
                      return false;
                  }
              }
          }

          return true;
      };

      var isPixelEmpty = function (x, y) {
          var alpha = y * (atlasImage.width * 4) + x * 4 + 3;
          return imageData.data[alpha] === 0;
      };

      events.push(rootPanel.on('clear', function () {
          panel.destroy();
      }));

      panel.on('destroy', function () {
          for (var i = 0, len = events.length; i<len; i++) {
              events[i].unbind();
          }
          events.length = 0;
      });
  });
});


/* editor/pickers/sprite-editor/sprite-editor-import-frames-panel.js */
editor.once('load', function () {
  'use strict';

  editor.method('picker:sprites:attributes:importFrames', function (args) {
      var events = [];
      var atlasAsset = args.atlasAsset;

      var rootPanel = editor.call('picker:sprites:rightPanel');

      var panel = editor.call('attributes:addPanel', {
          parent: rootPanel,
          name: 'IMPORT FRAME DATA'
      });
      panel.class.add('component');

      panel.disabled = ! editor.call('permissions:write');

      events.push(editor.on('permissions:writeState', function (canWrite) {
          panel.disabled = ! canWrite;
      }));

      var panelError = new ui.Panel('Invalid JSON file');
      panelError.class.add('import-error');
      panel.append(panelError);
      panelError.flex = true;
      panelError.hidden = true;

      var labelError = new ui.Label({
          text: 'Please upload a valid JSON file that has been created with the Texture Packer application.'
      });
      labelError.flexGrow = 1;
      labelError.renderChanges = false;
      panelError.append(labelError);

      var btnCloseError = new ui.Button({
          text: '&#57650;'
      });
      btnCloseError.class.add('close');
      panelError.headerElement.appendChild(btnCloseError.element);

      btnCloseError.on('click', function () {
          panelError.hidden = true;
      });

      var panelButtons = new ui.Panel();
      panelButtons.flex = true;
      panel.append(panelButtons);

      var hiddenInput = document.createElement('input');
      hiddenInput.type = 'file';
      hiddenInput.accept = '.json';
      hiddenInput.style.display = 'none';
      panel.innerElement.appendChild(hiddenInput);

      var btnImport = new ui.Button({
          text: 'UPLOAD TEXTURE PACKER JSON'
      });
      btnImport.flexGrow = 1;
      btnImport.class.add('icon', 'upload');
      panelButtons.append(btnImport);

      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:import:texturepacker', btnImport, null, panel);

      btnImport.on('click', function () {
          panelError.hidden = true;

          var hasFrames = false;
          var currentFrames = atlasAsset.getRaw('data.frames')._data;
          for (var key in currentFrames) {
              hasFrames = true;
              break;
          }

          if (hasFrames) {
              editor.call('picker:confirm', 'Uploading frame data will replace all current frames - Are you sure you want to upload?', function () {
                  hiddenInput.click();
              });
          } else {
              hiddenInput.click();
          }
      });

      hiddenInput.addEventListener('change', function () {
          if (! hiddenInput.files[0]) return;

          btnImport.disabled = true;
          btnImport.text = 'PROCESSING...';

          var reader = new FileReader();
          reader.onload = function (e) {
              hiddenInput.value = null;
              var text = reader.result;
              var data = null;
              try {
                  data = JSON.parse(text);
                  importFramesFromTexturePacker(data);
              } catch (err) {
                  console.error(err);
                  panelError.hidden = false;
                  return;
              } finally {
                  btnImport.text = 'UPLOAD TEXTURE PACKER JSON';
                  btnImport.disabled = false;
              }
          };
          reader.readAsText(hiddenInput.files[0]);
      });

      var importFramesFromTexturePacker = function (data) {
          var width = data.meta.size.w;
          var height = data.meta.size.h;
          var actualWidth = atlasAsset.get('meta.width');
          var actualHeight = atlasAsset.get('meta.height');

          var scaleWidth = actualWidth / width;
          var scaleHeight = actualHeight / height;

          var newFrames = {};
          var counter = 0;

          for (var key in data.frames) {
              var frameData = data.frames[key];

              // the free version of texturepacker doesn't include the pivot data, so provide defaults if necessary
              if (!frameData.pivot) {
                  frameData.pivot = {
                      x: 0.5,
                      y: 0.5
                  };
              }
              newFrames[counter++] = {
                  name: frameData.filename || key,
                  border: [0,0,0,0],
                  rect: [
                      frameData.frame.x * scaleWidth,
                      (height - frameData.frame.y - frameData.frame.h) * scaleHeight,
                      frameData.frame.w * scaleWidth,
                      frameData.frame.h * scaleHeight
                  ],
                  pivot: [
                      frameData.pivot.x,
                      frameData.pivot.y
                  ]
              };
          }

          atlasAsset.set('data.frames', newFrames);
      };

      events.push(rootPanel.on('clear', function () {
          panel.destroy();
      }));

      panel.on('destroy', function () {
          for (var i = 0, len = events.length; i<len; i++) {
              events[i].unbind();
          }
          events.length = 0;
      });
  });
});


/* editor/pickers/sprite-editor/sprite-editor-sprite-panel.js */
editor.once('load', function() {
  'use strict';

  editor.method('picker:sprites:attributes:sprite', function (args) {
      var atlasAsset = args.atlasAsset;
      var atlasImage = args.atlasImage;
      var spriteAsset = args.spriteAsset;

      var frameKeys = spriteAsset.get('data.frameKeys');

      var spriteEditMode = false;
      var selectedFrames = null;

      var events = [];

      var rootPanel = editor.call('picker:sprites:rightPanel');
      rootPanel.header = 'SPRITE ASSET - ' + spriteAsset.get('name');

      var fieldPreview = editor.call('picker:sprites:attributes:frames:preview', {
          atlasAsset: atlasAsset,
          atlasImage: atlasImage,
          frames: frameKeys
      });

      var panel = editor.call('attributes:addPanel', {
          parent: rootPanel
      });
      panel.disabled = ! editor.call('permissions:write');
      events.push(editor.on('permissions:writeState', function (canWrite) {
          panel.disabled = ! canWrite;
      }));

      var fieldId = editor.call('attributes:addField', {
          parent: panel,
          name: 'ID',
          link: spriteAsset,
          path: 'id'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:id', fieldId.parent.innerElement.firstChild.ui, null, panel);

      var suspendRenameEvt = false;

      var fieldName = editor.call('attributes:addField', {
          parent: panel,
          name: 'Name',
          type: 'string',
          value: spriteAsset.get('name')
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:name', fieldName.parent.innerElement.firstChild.ui, null, panel);

      events.push(fieldName.on('change', function (value) {
          rootPanel.header = 'SPRITE ASSET - ' + value;
          if (value !== spriteAsset.get('name') && ! suspendRenameEvt) {
              suspendRenameEvt = true;
              editor.call('assets:rename', spriteAsset, value);
              suspendRenameEvt = false;
          }
      }));

      events.push(spriteAsset.on('name:set', function (value) {
          suspendRenameEvt = true;
          fieldName.value = value;
          suspendRenameEvt = false;
      }));

      var fieldPpu = editor.call('attributes:addField', {
          parent: panel,
          name: 'Pixels Per Unit',
          type: 'number',
          link: spriteAsset,
          min: 0,
          path: 'data.pixelsPerUnit'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:sprite:pixelsPerUnit', fieldPpu.parent.innerElement.firstChild.ui, null, panel);

      var fieldRenderMode = editor.call('attributes:addField', {
          parent: panel,
          name: 'Render Mode',
          type: 'number',
          enum: [
              {v: 0, t: 'Simple'},
              {v: 1, t: 'Sliced'},
              {v: 2, t: 'Tiled'}
          ],
          link: spriteAsset,
          path: 'data.renderMode'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:sprite:renderMode', fieldRenderMode.parent.innerElement.firstChild.ui, null, panel);

      var panelEdit = editor.call('attributes:addPanel', {
          parent: rootPanel,
          name: 'FRAMES IN SPRITE ASSET'
      });
      panelEdit.flex = true;
      panelEdit.class.add('buttons');

      panelEdit.disabled = ! editor.call('permissions:write');
      events.push(editor.on('permissions:writeState', function (canWrite) {
          panelEdit.disabled = ! canWrite;
      }));

      // add frames tooltip
      var panelAddFramesInfo = new ui.Panel('Adding more frames to a sprite');
      panelAddFramesInfo.class.add('add-frames-info');
      panelAddFramesInfo.hidden = true;
      panelEdit.append(panelAddFramesInfo);

      var labelInfo = new ui.Label({
          text: 'To add more frames to a sprite asset, select the frames you wish to add either on the texture atlas viewport or from the panel on the left, then click ADD SELECTED FRAMES.'
      });
      panelAddFramesInfo.append(labelInfo);

      var btnAddFrames = new ui.Button({
          text: 'ADD FRAMES TO SPRITE ASSET'
      });
      btnAddFrames.flexGrow = 1;
      btnAddFrames.class.add('icon', 'wide', 'create');
      panelEdit.append(btnAddFrames);


      // reference
      editor.call('attributes:reference:attach', 'spriteeditor:sprites:addFrames', btnAddFrames, null, panel);

      btnAddFrames.on('click', function () {
          editor.call('picker:sprites:pickFrames');
      });

      var btnAddSelected = new ui.Button({
          text: 'ADD SELECTED FRAMES'
      });
      btnAddSelected.class.add('icon', 'create');
      btnAddSelected.flexGrow = 3;
      btnAddSelected.hidden = true;
      panelEdit.append(btnAddSelected);

      // add selected frames to sprite asset
      btnAddSelected.on('click', function () {
          editor.call('picker:sprites:pickFrames:add');
      });

      var btnCancel = new ui.Button({
          text: 'DONE'
      });
      btnCancel.class.add('icon', 'done');
      btnCancel.flexGrow = 1;
      btnCancel.hidden = true;
      panelEdit.append(btnCancel);

      btnCancel.on('click', function () {
          editor.call('picker:sprites:pickFrames:cancel');
      });

      var panelFrames = editor.call('attributes:addPanel', {
          parent: panelEdit,
      });
      panelFrames.class.add('frames');

      var draggedPanel = null;
      var draggedIndex = null;

      var panels = [];

      var addFramePanel = function (key, index) {
          var frameEvents = [];

          var panel = new ui.Panel();
          panel.class.add('frame');
          panel._frameKey = key;
          if (index !== undefined) {
              panels.splice(index, 0, panel);
          } else {
              panels.push(panel);
          }

          // drag handle
          var handle = document.createElement('div');
          handle.classList.add('handle');
          panel.append(handle);


          var onDragStart = function (evt) {
              if (! editor.call('permissions:write')) return;

              draggedPanel = panel;
              draggedIndex = panels.indexOf(panel);

              panel.class.add('dragged');

              window.addEventListener('mouseup', onDragEnd);
              panelFrames.innerElement.addEventListener('mousemove', onDragMove);
          };

          handle.addEventListener('mousedown', onDragStart);

          // preview
          var canvas = new ui.Canvas();
          var previewWidth = 26;
          var previewHeight = 26;
          canvas.class.add('preview');
          canvas.resize(previewWidth, previewHeight);

          panel.append(canvas);

          var ctx = canvas.element.getContext('2d');

          var renderQueued = false;

          panel.queueRender = function () {
              if (renderQueued) return;
              renderQueued = true;
              requestAnimationFrame(renderPreview);
          };

          var renderPreview = function () {
              renderQueued = false;

              ctx.clearRect(0, 0, previewWidth, previewHeight);

              if (! atlasImage) return;

              var frame = atlasAsset.getRaw('data.frames.' + key);
              if (! frame) return;
              frame = frame._data;

              var x = frame.rect[0];
              // convert bottom left WebGL coord to top left pixel coord
              var y = atlasImage.height - frame.rect[1] - frame.rect[3];
              var w = frame.rect[2];
              var h = frame.rect[3];

              // choose targetWidth and targetHeight keeping the aspect ratio
              var aspectRatio = w / h;
              var targetWidth = previewWidth;
              var targetHeight = previewHeight;

              if (w >= h) {
                  targetHeight = previewWidth / aspectRatio;
              } else {
                  targetWidth = targetHeight * aspectRatio;
              }

              var offsetX = (previewWidth - targetWidth) / 2;
              var offsetY = (previewHeight - targetHeight) / 2;

              ctx.drawImage(atlasImage, x, y, w, h, offsetX, offsetY, targetWidth, targetHeight);
          };

          renderPreview();

          // sprite name
          var fieldName = new ui.Label();
          fieldName.class.add('name');
          fieldName.value = atlasAsset.get('data.frames.' + key + '.name') || 'Missing';
          panel.append(fieldName);

          frameEvents.push(atlasAsset.on('data.frames.' + key + '.name:set', function (value) {
              fieldName.value = value;
          }));

          frameEvents.push(atlasAsset.on('data.frames.' + key + ':unset', function () {
              fieldName.value = 'Missing';
              panel.queueRender();
          }));

          // remove frame
          var btnRemove = new ui.Button();
          btnRemove.class.add('remove');
          panel.append(btnRemove);

          btnRemove.on('click', function (e) {
              e.stopPropagation();

              var idx = panels.indexOf(panel);
              if (idx !== -1) {
                  spriteAsset.remove('data.frameKeys', idx);
              }
          });

          panel.on('click', function () {
              // do not select missing frames
              if (! atlasAsset.has('data.frames.' + key)) return;

              // select frame
              editor.call('picker:sprites:selectFrames', key, {
                  history: true,
                  clearSprite: true
              });
          });

          // clean up events
          panel.on('destroy', function () {
              for (var i = 0, len = frameEvents.length; i<len; i++) {
                  frameEvents[i].unbind();
              }
              frameEvents.length = 0;

              handle.removeEventListener('mousedown', onDragStart);
              if (draggedPanel === panel) {
                  draggedPanel = null;
                  draggedIndex = null;
                  panelFrames.innerElement.removeEventListener('mousemove', onDragMove);
                  window.removeEventListener('mouseup', onDragEnd);
              }
          });

          var before = null;
          if (typeof(index) === 'number')
              before = panelFrames.innerElement.childNodes[index];

          if (before) {
              panelFrames.appendBefore(panel, before);
          } else {
              panelFrames.append(panel);
          }
      };

      var onDragMove = function (evt) {
          var rect = panelFrames.innerElement.getBoundingClientRect();
          var height = draggedPanel.element.offsetHeight;
          var top = evt.clientY - rect.top - 6;
          var overPanelIndex = Math.floor(top / height);
          var overPanel = panels[overPanelIndex];//panelFrames.innerElement.childNodes[overPanelIndex];

          if (overPanel && overPanel !== draggedPanel) {
              panelFrames.remove(draggedPanel);
              panelFrames.appendBefore(draggedPanel, panelFrames.innerElement.childNodes[overPanelIndex]);

              var idx = panels.splice(panels.indexOf(draggedPanel), 1);
              panels.splice(overPanelIndex, 0, draggedPanel);
          }
      };

      var onDragEnd = function () {
          if (! draggedPanel) return;

          var oldIndex = draggedIndex;
          var newIndex = Array.prototype.indexOf.call(panelFrames.innerElement.childNodes, draggedPanel.element);

          // change order in sprite asset
          if (oldIndex !== newIndex) {
              spriteAsset.move('data.frameKeys', oldIndex, newIndex);
          }

          draggedPanel.class.remove('dragged');
          draggedPanel = null;
          draggedIndex = null;

          panelFrames.innerElement.removeEventListener('mousemove', onDragMove);
          window.removeEventListener('mouseup', onDragEnd);
      };

      for (var i = 0, len = frameKeys.length; i<len; i++) {
          addFramePanel(frameKeys[i]);
      }

      events.push(spriteAsset.on('data.frameKeys:remove', function (value, index) {
          if (! panels[index]) return;

          panels[index].destroy();
          panels.splice(index, 1);

          frameKeys = spriteAsset.get('data.frameKeys');

          fieldPreview.setFrames(frameKeys);
      }));

      events.push(spriteAsset.on('data.frameKeys:insert', function (value, index) {
          frameKeys = spriteAsset.get('data.frameKeys');
          addFramePanel(frameKeys[index], index);
          fieldPreview.setFrames(frameKeys);
      }));

      events.push(spriteAsset.on('data.frameKeys:move', function (value, indNew, indOld) {
          // update the draggedIndex if another user dragged the same frame we're dragging
          if (indOld === draggedIndex) {
              draggedIndex = indNew;
          }

          if (draggedIndex === indNew) return;

          var movedPanel = panels[indOld];
          if (movedPanel && movedPanel._frameKey === value) {
              panelFrames.remove(movedPanel);
              panelFrames.appendBefore(movedPanel, panelFrames.innerElement.childNodes[indNew]);

              panels.splice(indOld, 1);
              panels.splice(indNew, 0, movedPanel);
          }

          frameKeys = spriteAsset.get('data.frameKeys');
          fieldPreview.setFrames(frameKeys);
      }));

      events.push(spriteAsset.on('data.frameKeys:set', function (value) {
          var i, len;

          for (i = 0, len = panels.length; i<len; i++) {
              panels[i].destroy();
          }
          panels.length = 0;

          frameKeys = spriteAsset.get('data.frameKeys');
          for (i = 0, len = frameKeys.length; i<len; i++) {
              addFramePanel(frameKeys[i]);
          }

          fieldPreview.setFrames(frameKeys);
      }));

      events.push(atlasAsset.on('*:set', function (path) {
          if (! path.startsWith('data.frames')) {
              return;
          }

          var parts = path.split('.');
          var partsLen = parts.length;
          if (partsLen >= 3) {
              // re-render frame preview
              for (var i = 0, len = panels.length; i<len; i++) {
                  if (panels[i]._frameKey === parts[2]) {
                      panels[i].queueRender();

                      // if this frame was added back to the atlas
                      // then re-render preview
                      if (partsLen === 3) {
                          fieldPreview.setFrames(frameKeys);
                      }

                      break;
                  }
              }
          }
      }));

      events.push(editor.on('picker:sprites:pickFrames:start', function () {
          spriteEditMode = true;
          btnAddFrames.hidden = true;
          btnAddSelected.disabled = true;
          btnAddSelected.hidden = false;
          btnCancel.hidden = false;
          panelAddFramesInfo.hidden = false;
      }));

      events.push(editor.on('picker:sprites:pickFrames:end', function () {
          spriteEditMode = false;
          btnAddFrames.hidden = false;
          btnAddSelected.hidden = true;
          btnCancel.hidden = true;
          panelAddFramesInfo.hidden = true;

          // restore preview to the actual frames that the sprite currently has
          fieldPreview.setFrames(frameKeys);
      }));

      events.push(editor.on('picker:sprites:framesSelected', function (keys) {
          if (! spriteEditMode) return;

          selectedFrames = keys;

          var len = keys ? keys.length : 0;
          btnAddSelected.disabled = !len;

          // update preview to show what sprite would look like after
          // the selected keys were added
          if (len) {
              fieldPreview.setFrames(frameKeys.slice().concat(keys));
          }
      }));

      events.push(rootPanel.on('clear', function () {
          panel.destroy();
          panelEdit.destroy();
      }));

      panel.on('destroy', function () {
          for (var i = 0; i < events.length; i++) {
              events[i].unbind();
          }

          events.length = 0;
          panels.length = 0;
          spriteEditMode = false;
      });

  });
});


/* editor/pickers/sprite-editor/sprite-editor-sprite-assets-panel.js */
editor.once('load', function() {
  'use strict';

  editor.method('picker:sprites:spriteassets', function(args) {
      var events = [];

      var atlasAsset = args.atlasAsset;

      // context menu
      var menu = new ui.Menu();
      editor.call('layout.root').append(menu);
      var contextMenuAsset = null;

      // context menu options

      // duplicate
      var menuDuplicate = new ui.MenuItem({
          text: 'Duplicate',
          icon: '&#57638;',
          value: 'duplicate'
      });
      menuDuplicate.on('select', function () {
          if (! contextMenuAsset) return;
          editor.call('assets:duplicate', contextMenuAsset);
      })
      menu.append(menuDuplicate);

      // delete
      var menuDelete = new ui.MenuItem({
          text: 'Delete',
          icon: '&#57636;',
          value: 'delete'
      });
      menuDelete.on('select', function () {
          if (! contextMenuAsset) return;
          editor.call('assets:delete:picker', [ contextMenuAsset ]);
      });
      menu.append(menuDelete);

      var rootPanel = editor.call('picker:sprites:bottomPanel');

      // grid
      var grid = new ui.Grid({
          multiSelect: false
      });
      grid.class.add('sprites');
      rootPanel.append(grid);

      // holds all sprite items indexed by asset id
      var spriteItems = {};
      // holds the key of the first frame for each sprite asset - used for rendering preview
      var firstFramePerSprite = {};

      var createSpriteItem = function (asset) {
          var spriteEvents = [];

          // sprite item
          var spriteItem = new ui.GridItem({
              toggleSelectOnClick: false
          });

          // sprite preview
          var canvas = new ui.Canvas();
          canvas.class.add('thumbnail');
          canvas.resize(64, 64);
          spriteItem.element.appendChild(canvas.element);

          spriteItems[asset.get('id')] = spriteItem;

          spriteItem.updateFirstFrame = function () {
              var frameKeys = asset.getRaw('data.frameKeys');
              firstFramePerSprite[asset.get('id')] = frameKeys[0];
          };

          spriteItem.updateFirstFrame();

          var renderQueued = false;

          spriteItem.queueRender = function () {
              if (renderQueued) return;
              renderQueued = true;
              requestAnimationFrame(renderPreview);
          };

          var renderPreview = function () {
              renderQueued = false;

              var frameKeys = asset.getRaw('data.frameKeys');
              var frames = frameKeys.map(function (f) {
                  if (f) {
                      var frame = atlasAsset.getRaw('data.frames.' + f);
                      return frame && frame._data;
                  } else {
                      return null;
                  }
              });

              editor.call('picker:sprites:renderFramePreview', frames[0], canvas.element, frames);
          };

          renderPreview();

          // sprite name
          var fieldName = new ui.Label();
          fieldName.class.add('label');
          fieldName.value = asset.get('name');
          spriteItem.element.appendChild(fieldName.element);

          spriteEvents.push(asset.on('name:set', function (value) {
              fieldName.value = value;
          }));

          spriteEvents.push(asset.on('data.frameKeys:insert', function (value, index) {
              if (index === 0) {
                  spriteItem.updateFirstFrame();
                  spriteItem.queueRender();
              }
          }));

          spriteEvents.push(asset.on('data.frameKeys:remove', function (value, index) {
              if (index === 0) {
                  spriteItem.updateFirstFrame();
                  spriteItem.queueRender();
              }
          }));

          spriteEvents.push(asset.on('data.frameKeys:move', function (value, indNew, indOld) {
              if (indNew === 0 || indOld === 0) {
                  spriteItem.updateFirstFrame();
                  spriteItem.queueRender();
              }
          }));

          spriteEvents.push(asset.on('data.frameKeys:set', function (value) {
              spriteItem.updateFirstFrame();
              spriteItem.queueRender();
          }));

          // link to sprite asset
          spriteItem.on('click', function () {
              editor.call('picker:sprites:selectSprite', asset, {
                  history: true
              });
          });

          spriteEvents.push(editor.on('assets:remove[' + asset.get('id') + ']', function () {
              spriteItem.destroy();
              delete spriteItems[asset.get('id')];
              if (contextMenuAsset && contextMenuAsset.get('id') === asset.get('id')) {
                  contextMenuAsset = null;
                  if (menu.open) {
                      menu.open = false;
                  }
              }
          }));

          // context menu
          var contextMenu = function (e) {
              if (! editor.call('permissions:write')) return;

              contextMenuAsset = asset;
              menu.open = true;
              menu.position(e.clientX + 1, e.clientY);
          };

          spriteItem.element.addEventListener('contextmenu', contextMenu);

          // clean up events
          spriteItem.on('destroy', function () {
              for (var i = 0, len = spriteEvents.length; i<len; i++) {
                  spriteEvents[i].unbind();
              }
              spriteEvents.length = 0;

              spriteItem.element.removeEventListener('contextmenu', contextMenu);
          });

          grid.append(spriteItem);

          return spriteItem;
      };

      // find all sprite assets associated with this atlas
      var spriteAssets = editor.call('assets:find', function (asset) {
          var atlasId = parseInt(atlasAsset.get('id'), 10);
          return asset.get('type') === 'sprite' && parseInt(asset.get('data.textureAtlasAsset'), 10) === atlasId;
      });

      for (var i = 0; i<spriteAssets.length; i++) {
          createSpriteItem(spriteAssets[i][1]);
      }

      // Add / modify frame event
      events.push(atlasAsset.on('*:set', function (path) {
          if (! path.startsWith('data.frames')) {
              return;
          }

          var parts = path.split('.');
          if (parts.length >= 3) {
              var key = parts[2];
              for (var assetId in firstFramePerSprite) {
                  if (firstFramePerSprite[assetId] === key) {
                      var p = spriteItems[assetId];
                      if (p) {
                          p.queueRender();
                      }
                  }
              }
          }
      }));

      // Delete frame event
      events.push(atlasAsset.on('*:unset', function (path) {
          if (! path.startsWith('data.frames')) {
              return;
          }

          var parts = path.split('.');
          if (parts.length >= 3) {
              var key = parts[2];
              for (var assetId in firstFramePerSprite) {
                  if (firstFramePerSprite[assetId] === key) {
                      var p = spriteItems[assetId];
                      if (p) {
                          p.queueRender();
                      }
                  }
              }
          }
      }));

      // Sprite selection event
      events.push(editor.on('picker:sprites:spriteSelected', function (sprite) {
          if (! sprite) {
              grid.selected = [];
          } else {
              var item = spriteItems[sprite.get('id')];
              if (item) {
                  grid.selected = [item];
              } else {
                  grid.selected = [];
              }
          }
      }));

      // Asset create event
      events.push(editor.on('assets:add', function (asset) {
          if (asset.get('type') !== 'sprite') return;

          var id = parseInt(asset.get('data.textureAtlasAsset'), 10);
          if (id !== parseInt(atlasAsset.get('id'), 10)) return;

          spriteAssets.push(asset);
          var item = createSpriteItem(asset);
          if (item) {
              item.flash();
          }
      }));

      // Sprite edit mode
      events.push(editor.on('picker:sprites:pickFrames:start', function () {
          rootPanel.disabled = true;
      }));

      events.push(editor.on('picker:sprites:pickFrames:end', function () {
          rootPanel.disabled = false;
      }));

      events.push(rootPanel.on('clear', function () {
          grid.destroy();
      }));

      grid.on('destroy', function () {
          menu.destroy();
          contextMenuAsset = null;

          for (var i = 0, len = events.length; i<len; i++) {
              events[i].unbind();
          }
          events.length = 0;
      });
  });
});


/* editor/pickers/sprite-editor/sprite-editor.js */
editor.once('load', function () {
  'use strict';

  var handleWidth = 10;
  var pivotWidth = 7;

  var COLOR_GRAY = '#B1B8BA';
  var COLOR_DARKEST = '#20292b';
  var COLOR_DARK = '#1B282B';
  var COLOR_GREEN = '#0f0';
  var COLOR_ORANGE = '#f60';
  var COLOR_TRANSPARENT_ORANGE = '#ff660099';
  var COLOR_BLUE = '#00f';

  var atlasAsset = null;
  var atlasImage = new Image();
  var atlasImageLoaded = false;
  var atlasImageDataCanvas = document.createElement('canvas');
  var atlasImageData = null;

  var shiftDown = false;
  var ctrlDown = false;
  var leftButtonDown = false;
  var rightButtonDown = false;

  var panning = false;
  var spriteEditMode = false;

  var newFrame = null;
  var hoveredFrame = null;
  var oldFrame = null;

  var selectedHandle = null;
  var hoveringHandle = null;
  var startingHandleFrame = null;
  var startingHandleCoords = { x: 0, y: 0 };

  var resizeInterval = null;
  var pivotX = 0;
  var pivotY = 0;
  var pivotOffsetX = 0;
  var pivotOffsetY = 0;
  var zoomOffsetX = 0;
  var zoomOffsetY = 0;
  var prevMouseX = 0;
  var prevMouseY = 0;
  var mouseX = 0;
  var mouseY = 0;
  var aspectRatio = 1;
  var canvasRatio = 1;

  var queuedRender = false;

  var suspendCloseUndo = false;

  var HANDLE = {
      TOP_LEFT: 1,
      TOP_RIGHT: 2,
      BOTTOM_LEFT: 3,
      BOTTOM_RIGHT: 4,
      BORDER_TOP_LEFT: 5,
      BORDER_TOP: 6,
      BORDER_TOP_RIGHT: 7,
      BORDER_LEFT: 8,
      BORDER_RIGHT: 9,
      BORDER_BOTTOM_LEFT: 10,
      BORDER_BOTTOM: 11,
      BORDER_BOTTOM_RIGHT: 12,
      PIVOT: 13,
      FRAME: 14,
      TOP: 15,
      RIGHT: 16,
      BOTTOM: 17,
      LEFT: 18
  };

  var events = [];

  // create UI
  var root = editor.call('layout.root');

  // overlay
  var overlay = new ui.Overlay();
  overlay.class.add('sprites-editor');
  overlay.hidden = true;
  root.append(overlay);


  var panel = new ui.Panel();
  panel.class.add('root-panel');
  panel.flex = true;
  panel.flexDirection = 'row';
  panel.header = 'SPRITE EDITOR';
  overlay.append(panel);
  // close button
  var btnClose = new ui.Button({
      text: '&#57650;'
  });
  btnClose.class.add('close');
  btnClose.on('click', function () {
      editor.call('picker:sprites:close');
  });
  panel.headerElement.appendChild(btnClose.element);

  var leftColumns = new ui.Panel();
  leftColumns.class.add('left-columns');
  leftColumns.flex = true;
  leftColumns.flexGrow = true;
  leftColumns.flexDirection = 'column';
  panel.append(leftColumns);

  var leftRows = new ui.Panel();
  leftRows.class.add('left-rows');
  leftRows.flex = true;
  leftRows.flexDirection = 'row';
  leftColumns.append(leftRows);

  var leftPanel = new ui.Panel();
  leftPanel.class.add('left-panel');
  // leftPanel.class.add('attributes');
  leftPanel.flexShrink = false;
  leftPanel.style.width = '320px';
  leftPanel.innerElement.style.width = '320px';
  leftPanel.horizontal = true;
  leftPanel.foldable = true;
  // leftPanel.scroll = true;
  leftPanel.resizable = 'right';
  leftPanel.resizeMin = 256;
  leftPanel.resizeMax = 512;
  leftRows.append(leftPanel);

  // middle panel
  var middlePanel = new ui.Panel();
  middlePanel.class.add('middle-panel');
  middlePanel.flex = true;
  middlePanel.flexGrow = true;
  middlePanel.flexDirection = 'column';
  leftRows.append(middlePanel);

  // canvas
  var canvasPanel = new ui.Panel();
  canvasPanel.class.add('canvas-panel');
  canvasPanel.flexible = true;
  canvasPanel.flexGrow = true;
  middlePanel.append(canvasPanel);

  var canvas = new ui.Canvas();
  canvas.class.add('canvas');
  canvasPanel.append(canvas);

  // Canvas Context
  var ctx = canvas.element.getContext("2d");

  // bottom panel
  var bottomPanel = new ui.Panel('SPRITE ASSETS');
  bottomPanel.class.add('bottom-panel');
  bottomPanel.innerElement.style.height = '219px';
  bottomPanel.foldable = true;
  bottomPanel.flexShrink = false;
  bottomPanel.scroll = true;
  bottomPanel.resizable = 'top';
  bottomPanel.resizeMin = 106;
  bottomPanel.resizeMax = 106 * 3;
  bottomPanel.headerSize = -1;
  middlePanel.append(bottomPanel);

  // // Canvas control
  var canvasControl = new ui.Panel();
  canvasControl.flex = true;
  canvasControl.flexDirection = 'row';
  canvasControl.class.add('canvas-control');
  leftColumns.append(canvasControl);

  // var alphaControl = new ui.Panel();
  // alphaControl.class.add('alpha-control');
  // alphaControl.flex = true;
  // alphaControl.flexDirection = 'row';
  // alphaControl.append(new ui.Label({
  //     text: 'Alpha'
  // }));
  // canvasControl.append(alphaControl);

  // var zoomControl = new ui.Panel();
  // zoomControl.class.add('slider-control');
  // zoomControl.flex = true;
  // zoomControl.flexDirection = 'row';
  // zoomControl.append(new ui.Label({
  //     text: 'Zoom'
  // }));

  // var zoomField = new ui.NumberField({
  //     min: 1,
  //     precision: 2,
  //     placeholder: 'X',
  // });
  // zoomField.link(controls, 'zoom');
  // zoomControl.append(zoomField);
  // var zoomSlider = new ui.Slider({
  //     min: 1,
  //     max: 100,
  //     precision: 2,
  // });
  // zoomSlider.link(controls, 'zoom');
  // zoomControl.append(zoomSlider);
  // canvasControl.append(zoomControl);

  // var brightnessControl = new ui.Panel();
  // brightnessControl.class.add('slider-control');
  // brightnessControl.flex = true;
  // brightnessControl.flexDirection = 'row';
  // brightnessControl.append(new ui.Label({
  //     text: 'Brightness'
  // }));

  // var brightnessField = new ui.NumberField({
  //     min: 0,
  //     max: 100,
  //     precision: 1,
  //     placeholder: '%',
  // });
  // brightnessField.link(controls, 'brightness');
  // brightnessControl.append(brightnessField);
  // var brightnessSlider = new ui.Slider({
  //     min: 0,
  //     max: 100,
  //     precision: 1,
  // });
  // brightnessSlider.link(controls, 'brightness');
  // brightnessControl.append(brightnessSlider);
  // canvasControl.append(brightnessControl);

  // Right panel
  var rightPanel = null;

  // controls observer (for zoom/brightness).
  var controls = new Observer({
      zoom: 1,
      brightness: 100
  });


  var imageWidth = function () {
      return controls.get('zoom') * (canvasRatio > aspectRatio ? canvas.height * aspectRatio : canvas.width);
  };

  var imageHeight = function (zoom) {
      return controls.get('zoom') * (canvasRatio <= aspectRatio ? canvas.width / aspectRatio : canvas.height);
  };

  var imageLeft = function () {
      return (pivotX + pivotOffsetX + zoomOffsetX) * canvas.width;
  };

  var imageTop = function () {
      return (pivotY + pivotOffsetY + zoomOffsetY) * canvas.height;
  };

  var frameLeft = function (frame, leftOffset, scaledWidth) {
      return leftOffset + frame.rect[0] * scaledWidth / atlasImage.width;
  };

  var frameTop = function (frame, topOffset, scaledHeight) {
      var inverted = 1 - (frame.rect[1] + frame.rect[3]) / atlasImage.height;
      return topOffset + inverted * scaledHeight;
  };

  var frameWidth = function (frame, scaledWidth) {
      return frame.rect[2] * scaledWidth / atlasImage.width;
  };

  var frameHeight = function (frame, scaledHeight) {
      return frame.rect[3] * scaledHeight / atlasImage.height;
  };

  var windowToCanvas = function (windowX, windowY) {
      var rect = canvas.element.getBoundingClientRect();
      return {
          x: Math.round(windowX - rect.left),
          y: Math.round(windowY - rect.top),
      };
  };

  var resizeCanvas = function () {
      var result = false;

      var width = canvasPanel.element.clientWidth;
      var height = canvasPanel.element.clientHeight;

      // If it's resolution does not match change it
      if (canvas.element.width !== width || canvas.element.height !== height) {
          canvas.element.width = width;
          canvas.element.height = height;
          result = true;
      }

      canvasRatio = canvas.width / canvas.height;

      return result;
  };

  var resetControls = function () {
      controls.set('zoom', 1);
      pivotX = 0;
      pivotY = 0;
      pivotOffsetX = 0;
      pivotOffsetY = 0;
      zoomOffsetX = 0;
      zoomOffsetY = 0;
  };

  var registerInputListeners = function () {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('mousemove', onMouseMove);
      canvas.element.addEventListener('mousedown', onMouseDown);
      canvas.element.addEventListener('mousewheel', onWheel); // WekKit
      canvas.element.addEventListener('DOMMouseScroll', onWheel); // Gecko

      // 'F' hotkey to focus canvas
      editor.call('hotkey:register', 'sprite-editor-focus', {
          key: 'f',
          callback: function () {
              editor.call('picker:sprites:focus');
          }
      });

      // Esc to deselect and if no selection close the window
      editor.call('hotkey:register', 'sprite-editor-esc', {
          key: 'esc',
          callback: function () {
              if (editor.call('picker:isOpen', 'confirm')) {
                  return;
              }

              var spriteAsset = editor.call('picker:sprites:selectedSprite');
              if (spriteAsset) {
                  if (spriteEditMode) {
                      editor.call('picker:sprites:pickFrames:cancel');
                  } else {
                      editor.call('picker:sprites:selectSprite', null, {
                          history: true
                      });
                  }
              } else {
                  var selected = editor.call('picker:sprites:selectedFrame');
                  if (selected) {
                      selected = editor.call('picker:sprites:selectFrames', null, {
                          history: true
                      });
                  } else {
                      overlay.hidden = true;
                  }
              }
          }
      });
  };

  var unregisterInputListeners = function () {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.element.removeEventListener('mousedown', onMouseDown);
      canvas.element.removeEventListener("mousewheel", onWheel);
      canvas.element.removeEventListener("DOMMouseScroll", onWheel);

      editor.call('hotkey:unregister', 'sprite-editor-focus');
      editor.call('hotkey:unregister', 'sprite-editor-esc');
  };

  var onKeyDown = function (e) {
      if (e.shiftKey) {
          shiftDown = true;
          updateCursor();
      }

      ctrlDown = e.ctrlKey || e.metaKey;
  };

  var onKeyUp = function (e) {
      if (!e.shiftKey) {
          shiftDown = false;
          if (panning) {
              stopPanning();
          }

          updateCursor();
      }

      ctrlDown = e.ctrlKey || e.metaKey;
  };

  var onMouseDown = function (e) {
      if (e.button === 0) {
          leftButtonDown = true;
      } else if (e.button === 2) {
          rightButtonDown = true;
      }

      ctrlDown = e.ctrlKey || e.metaKey;

      if (e.button !== 0) return;

      // start panning with left button and shift
      if (!panning && leftButtonDown && shiftDown) {
          startPanning(e.clientX, e.clientY);
          return;
      }

      var p = windowToCanvas(e.clientX, e.clientY);

      var selected = editor.call('picker:sprites:selectedFrame');

      // if a frame is already selected try to select one of its handles
      if (selected && !ctrlDown) {
          oldFrame = atlasAsset.get('data.frames.' + selected);
          if (oldFrame) {
              setHandle(handlesHitTest(p, oldFrame), oldFrame, p);

              if (selectedHandle) {
                  updateCursor();
                  queueRender();
              }

          }
      }

      // if no handle selected try to select the frame under the cursor
      if (!selected || !selectedHandle) {
          var frameUnderCursor = framesHitTest(p);
          if (!frameUnderCursor) {
              // clear selection unless Ctrl is down
              if (!ctrlDown) {
                  selected = editor.call('picker:sprites:selectFrames', null, {
                      history: true,
                      clearSprite: !spriteEditMode
                  });
              }
          } else {
              var keys = spriteEditMode ? editor.call('picker:sprites:newSpriteFrames') : editor.call('picker:sprites:highlightedFrames');
              var idx = keys.indexOf(frameUnderCursor);
              // deselect already highlighted frame if ctrl is pressed
              if (idx !== -1 && ctrlDown) {
                  keys = keys.slice();
                  keys.splice(idx, 1);
                  selected = editor.call('picker:sprites:selectFrames', keys, {
                      history: true,
                      clearSprite: !spriteEditMode
                  });
              } else {
                  // select new frame
                  selected = editor.call('picker:sprites:selectFrames', frameUnderCursor, {
                      history: true,
                      clearSprite: !spriteEditMode,
                      add: ctrlDown
                  });
              }
          }
      }

      // if no frame selected then start a new frame
      if (!selected && !spriteEditMode && editor.call('permissions:write')) {
          var diffX = clamp((p.x - imageLeft()) / imageWidth(), 0, 1);
          var diffY = clamp((1 - (p.y - imageTop()) / imageHeight()), 0, 1);

          var x = Math.floor(atlasImage.width * diffX);
          var y = Math.floor(atlasImage.height * diffY);
          newFrame = {
              rect: [x, y, 0, 0],
              pivot: [0.5, 0.5],
              border: [0, 0, 0, 0]
          };
          setHandle(HANDLE.BOTTOM_RIGHT, newFrame, p);

          updateCursor();
      }
  };

  var onMouseMove = function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // keep panning
      if (panning) {
          pivotOffsetX = (mouseX - prevMouseX) / canvas.width;
          pivotOffsetY = (mouseY - prevMouseY) / canvas.height;
          queueRender();
          return;
      }

      var p = windowToCanvas(mouseX, mouseY);

      var selected = editor.call('picker:sprites:selectedFrame');

      var previousHoveringHandle = hoveringHandle;
      hoveringHandle = null;

      // if a handle is selected then modify the selected frame
      if (newFrame) {
          modifyFrame(selectedHandle, newFrame, p);
          queueRender();
      } else if (selected && selectedHandle) {
          var frame = atlasAsset.get('data.frames.' + selected);
          modifyFrame(selectedHandle, frame, p);

          // set asset so that other users can see changes too
          var history = atlasAsset.history.enabled;
          atlasAsset.history.enabled = false;
          if (selectedHandle === HANDLE.PIVOT) {
              atlasAsset.set('data.frames.' + selected + '.pivot', frame.pivot);
          } else {
              atlasAsset.set('data.frames.' + selected + '.rect', frame.rect);
              atlasAsset.set('data.frames.' + selected + '.border', frame.border);
          }
          atlasAsset.history.enabled = history;

          queueRender();
      }
      // if no handle is selected then change cursor if the user hovers over a handle
      else if (selected) {
          var selectedFrame = atlasAsset.getRaw('data.frames.' + selected);
          if (selectedFrame) {
              selectedFrame = selectedFrame._data;
              hoveringHandle = handlesHitTest(p, selectedFrame);
          }
      }

      if (hoveringHandle !== previousHoveringHandle) {
          updateCursor();
      }

  };

  var onMouseUp = function (e) {
      if (e.button === 0) {
          leftButtonDown = false;
      } else if (e.button === 1) {
          rightButtonDown = false;
      }

      if (e.button !== 0) return;

      // stop panning
      if (panning && !leftButtonDown) {
          stopPanning();
      }

      var selected = editor.call('picker:sprites:selectedFrame');

      // if we've been editing a new frame then create it
      if (newFrame) {

          // don't generate it if it's too small
          if (newFrame.rect[2] !== 0 && newFrame.rect[3] !== 0) {
              // generate key name for new frame
              var key = 1;
              for (var existingKey in atlasAsset.getRaw('data.frames')._data) {
                  key = Math.max(parseInt(existingKey, 10) + 1, key);
              }

              newFrame.name = 'Frame ' + key;

              editor.call('picker:sprites:commitFrameChanges', key.toString(), newFrame);
              selected = editor.call('picker:sprites:selectFrames', key.toString(), {
                  clearSprite: true
              });
          }

          newFrame = null;
          hoveringHandle = null;
          setHandle(null);
          queueRender();
      }
      // if we have edited the selected frame then commit the changes
      else if (selected) {
          // clear selected handle
          if (selectedHandle) {
              setHandle(null);
              queueRender();
          }

          if (oldFrame) {
              var frame = atlasAsset.getRaw('data.frames.' + selected)._data;
              var dirty = false;
              for (var i = 0; i < 4; i++) {
                  if (oldFrame.rect[i] !== frame.rect[i]) {
                      dirty = true;
                      break;
                  }


                  if (oldFrame.border[i] !== frame.border[i]) {
                      dirty = true;
                      break;
                  }
              }

              if (!dirty) {
                  for (var i = 0; i < 2; i++) {
                      if (oldFrame.pivot[i] !== frame.pivot[i]) {
                          dirty = true;
                          break;
                      }
                  }
              }

              if (dirty) {
                  editor.call('picker:sprites:commitFrameChanges', selected, frame, oldFrame);
                  oldFrame = null;
              }
          }
      }
  };

  var onWheel = function (e) {
      e.preventDefault();

      var wheel = 0;

      // FF uses 'detail' and returns a value in 'no. of lines' to scroll
      // WebKit and Opera use 'wheelDelta', WebKit goes in multiples of 120 per wheel notch
      if (e.detail) {
          wheel = -1 * e.detail;
      } else if (e.wheelDelta) {
          wheel = e.wheelDelta / 120;
      } else {
          wheel = 0;
      }

      var zoom = controls.get('zoom');
      controls.set('zoom', Math.max(0.75, zoom + wheel * 0.1));
  };

  var clamp = function (value, minValue, maxValue) {
      return Math.min(Math.max(value, minValue), maxValue);
  };

  // Modify a frame using the specified handle
  var modifyFrame = function (handle, frame, mousePoint) {
      var imgWidth = imageWidth();
      var imgHeight = imageHeight();
      var imgLeft = imageLeft();
      var imgTop = imageTop();

      var realWidth = atlasImage.width;
      var realHeight = atlasImage.height;

      var p = mousePoint;

      var currentX = realWidth * (p.x - imgLeft) / imgWidth;
      if (currentX < 0 && startingHandleCoords.x <= 0) return;
      var currentY = realHeight * (p.y - imgTop) / imgHeight;
      if (currentY < 0 && startingHandleCoords.y <= 0) return;

      var dx = Math.floor(currentX - startingHandleCoords.x);
      var dy = Math.floor(currentY - startingHandleCoords.y);

      switch (handle) {
          case HANDLE.TOP_LEFT: {
              // limit x coord between image edges
              var x = clamp(startingHandleFrame.rect[0] + dx, 0, realWidth);
              dx = x - startingHandleFrame.rect[0];
              frame.rect[0] = startingHandleFrame.rect[0] + dx;
              // adjust width
              frame.rect[2] = startingHandleFrame.rect[2] - dx;
              // adjust height and limit between image edges
              frame.rect[3] = startingHandleFrame.rect[3] - dy;
              if (frame.rect[1] + frame.rect[3] > realHeight) {
                  frame.rect[3] = realHeight - frame.rect[1];
              }

              // if width became negative then make it positive and
              // adjust x coord, then switch handle to top right
              if (frame.rect[2] < 0) {
                  frame.rect[2] *= -1;
                  frame.rect[0] -= frame.rect[2];
                  setHandle(HANDLE.TOP_RIGHT, frame, p);
              }
              if (frame.rect[3] < 0) {
                  frame.rect[3] *= -1;
                  frame.rect[1] -= frame.rect[3];
                  setHandle(selectedHandle === HANDLE.TOP_RIGHT ? HANDLE.BOTTOM_RIGHT : HANDLE.BOTTOM_LEFT, frame, p);
              }

              // push right border if necessary
              if (frame.border[2] > frame.rect[2] - frame.border[0]) {
                  frame.border[2] = Math.max(frame.rect[2] - frame.border[0], 0);
              }

              // then push left border if necessary
              if (frame.border[0] > frame.rect[2] - frame.border[2]) {
                  frame.border[0] = Math.max(frame.rect[2] - frame.border[2], 0);
              }

              // push bottom border if necessary
              if (frame.border[1] > frame.rect[3] - frame.border[3]) {
                  frame.border[1] = Math.max(frame.rect[3] - frame.border[3], 0);
              }

              // then push top border if necessary
              if (frame.border[3] > frame.rect[3] - frame.border[1]) {
                  frame.border[3] = Math.max(frame.rect[3] - frame.border[1], 0);
              }

              break;
          }
          case HANDLE.TOP_RIGHT: {
              frame.rect[2] = startingHandleFrame.rect[2] + dx;
              frame.rect[3] = startingHandleFrame.rect[3] - dy;

              if (frame.rect[0] + frame.rect[2] > realWidth) {
                  frame.rect[2] = realWidth - frame.rect[0];
              }
              if (frame.rect[1] + frame.rect[3] > realHeight) {
                  frame.rect[3] = realHeight - frame.rect[1];
              }

              if (frame.rect[2] < 0) {
                  frame.rect[2] *= -1;
                  frame.rect[0] -= frame.rect[2];
                  setHandle(HANDLE.TOP_LEFT, frame, p);
              }
              if (frame.rect[3] < 0) {
                  frame.rect[3] *= -1;
                  frame.rect[1] -= frame.rect[3];
                  setHandle(selectedHandle === HANDLE.TOP_LEFT ? HANDLE.BOTTOM_LEFT : HANDLE.BOTTOM_RIGHT, frame, p);
              }

              if (frame.border[0] > frame.rect[2] - frame.border[2]) {
                  frame.border[0] = Math.max(frame.rect[2] - frame.border[2], 0);
              }

              if (frame.border[2] > frame.rect[2] - frame.border[0]) {
                  frame.border[2] = Math.max(frame.rect[2] - frame.border[0], 0);
              }

              if (frame.border[1] > frame.rect[3] - frame.border[3]) {
                  frame.border[1] = Math.max(frame.rect[3] - frame.border[3], 0);
              }

              if (frame.border[3] > frame.rect[3] - frame.border[1]) {
                  frame.border[3] = Math.max(frame.rect[3] - frame.border[1], 0);
              }

              break;
          }
          case HANDLE.BOTTOM_LEFT: {
              var x = clamp(startingHandleFrame.rect[0] + dx, 0, realWidth);
              dx = x - startingHandleFrame.rect[0];
              frame.rect[0] = startingHandleFrame.rect[0] + dx;
              frame.rect[2] = startingHandleFrame.rect[2] - dx;

              var y = clamp(startingHandleFrame.rect[1] - dy, 0, realHeight);
              dy = y - startingHandleFrame.rect[1];
              frame.rect[1] = startingHandleFrame.rect[1] + dy;
              frame.rect[3] = startingHandleFrame.rect[3] - dy;

              if (frame.rect[2] < 0) {
                  frame.rect[2] *= -1;
                  frame.rect[0] -= frame.rect[2];
                  setHandle(HANDLE.BOTTOM_RIGHT, frame, p);
              }
              if (frame.rect[3] < 0) {
                  frame.rect[3] *= -1;
                  frame.rect[1] -= frame.rect[3];
                  setHandle(selectedHandle === HANDLE.BOTTOM_RIGHT ? HANDLE.TOP_RIGHT : HANDLE.TOP_LEFT, frame, p);
              }

              if (frame.border[2] > frame.rect[2] - frame.border[0]) {
                  frame.border[2] = Math.max(frame.rect[2] - frame.border[0], 0);
              }

              if (frame.border[0] > frame.rect[2] - frame.border[2]) {
                  frame.border[0] = Math.max(frame.rect[2] - frame.border[2], 0);
              }

              if (frame.border[3] > frame.rect[3] - frame.border[1]) {
                  frame.border[3] = Math.max(frame.rect[3] - frame.border[1], 0);
              }

              if (frame.border[1] > frame.rect[3] - frame.border[3]) {
                  frame.border[1] = Math.max(frame.rect[3] - frame.border[3], 0);
              }

              break;
          }
          case HANDLE.BOTTOM_RIGHT: {
              frame.rect[2] = startingHandleFrame.rect[2] + dx;

              var y = clamp(startingHandleFrame.rect[1] - dy, 0, realHeight);
              dy = y - startingHandleFrame.rect[1];
              frame.rect[1] = startingHandleFrame.rect[1] + dy;
              frame.rect[3] = startingHandleFrame.rect[3] - dy;

              if (frame.rect[0] + frame.rect[2] > realWidth) {
                  frame.rect[2] = realWidth - frame.rect[0];
              }
              if (frame.rect[1] + frame.rect[3] > realHeight) {
                  frame.rect[3] = realHeight - frame.rect[1];
              }

              if (frame.rect[2] < 0) {
                  frame.rect[2] *= -1;
                  frame.rect[0] -= frame.rect[2];
                  setHandle(HANDLE.BOTTOM_LEFT, frame, p);
              }
              if (frame.rect[3] < 0) {
                  frame.rect[3] *= -1;
                  frame.rect[1] -= frame.rect[3];
                  setHandle(selectedHandle === HANDLE.BOTTOM_LEFT ? HANDLE.TOP_LEFT : HANDLE.TOP_RIGHT, frame, p);
              }

              if (frame.border[0] > frame.rect[2] - frame.border[2]) {
                  frame.border[0] = Math.max(frame.rect[2] - frame.border[2], 0);
              }

              if (frame.border[2] > frame.rect[2] - frame.border[0]) {
                  frame.border[2] = Math.max(frame.rect[2] - frame.border[0], 0);
              }

              if (frame.border[3] > frame.rect[3] - frame.border[1]) {
                  frame.border[3] = Math.max(frame.rect[3] - frame.border[1], 0);
              }

              if (frame.border[1] > frame.rect[3] - frame.border[3]) {
                  frame.border[1] = Math.max(frame.rect[3] - frame.border[3], 0);
              }

              break;
          }
          case HANDLE.RIGHT: {
              frame.rect[2] = startingHandleFrame.rect[2] + dx;

              if (frame.rect[0] + frame.rect[2] > realWidth) {
                  frame.rect[2] = realWidth - frame.rect[0];
              }

              if (frame.rect[2] < 0) {
                  frame.rect[2] *= -1;
                  frame.rect[0] -= frame.rect[2];
                  setHandle(HANDLE.LEFT, frame, p);
              }

              if (frame.border[0] > frame.rect[2] - frame.border[2]) {
                  frame.border[0] = Math.max(frame.rect[2] - frame.border[2], 0);
              }

              if (frame.border[2] > frame.rect[2] - frame.border[0]) {
                  frame.border[2] = Math.max(frame.rect[2] - frame.border[0], 0);
              }


              break;
          }
          case HANDLE.LEFT: {
              // limit x coord between image edges
              var x = clamp(startingHandleFrame.rect[0] + dx, 0, realWidth);
              dx = x - startingHandleFrame.rect[0];
              frame.rect[0] = startingHandleFrame.rect[0] + dx;
              // adjust width
              frame.rect[2] = startingHandleFrame.rect[2] - dx;

              // if width became negative then make it positive and
              // adjust x coord, then switch handle to top right
              if (frame.rect[2] < 0) {
                  frame.rect[2] *= -1;
                  frame.rect[0] -= frame.rect[2];
                  setHandle(HANDLE.RIGHT, frame, p);
              }

              // push right border if necessary
              if (frame.border[2] > frame.rect[2] - frame.border[0]) {
                  frame.border[2] = Math.max(frame.rect[2] - frame.border[0], 0);
              }

              // then push left border if necessary
              if (frame.border[0] > frame.rect[2] - frame.border[2]) {
                  frame.border[0] = Math.max(frame.rect[2] - frame.border[2], 0);
              }

              break;
          }
          case HANDLE.TOP: {
              // adjust height and limit between image edges
              frame.rect[3] = startingHandleFrame.rect[3] - dy;
              if (frame.rect[1] + frame.rect[3] > realHeight) {
                  frame.rect[3] = realHeight - frame.rect[1];
              }

              if (frame.rect[3] < 0) {
                  frame.rect[3] *= -1;
                  frame.rect[1] -= frame.rect[3];
                  setHandle(HANDLE.BOTTOM, frame, p);
              }

              // push bottom border if necessary
              if (frame.border[1] > frame.rect[3] - frame.border[3]) {
                  frame.border[1] = Math.max(frame.rect[3] - frame.border[3], 0);
              }

              // then push top border if necessary
              if (frame.border[3] > frame.rect[3] - frame.border[1]) {
                  frame.border[3] = Math.max(frame.rect[3] - frame.border[1], 0);
              }

              break;
          }
          case HANDLE.BOTTOM: {
              var y = clamp(startingHandleFrame.rect[1] - dy, 0, realHeight);
              dy = y - startingHandleFrame.rect[1];
              frame.rect[1] = startingHandleFrame.rect[1] + dy;
              frame.rect[3] = startingHandleFrame.rect[3] - dy;


              if (frame.rect[1] + frame.rect[3] > realHeight) {
                  frame.rect[3] = realHeight - frame.rect[1];
              }

              if (frame.rect[3] < 0) {
                  frame.rect[3] *= -1;
                  frame.rect[1] -= frame.rect[3];
                  setHandle(HANDLE.TOP, frame, p);
              }

              if (frame.border[3] > frame.rect[3] - frame.border[1]) {
                  frame.border[3] = Math.max(frame.rect[3] - frame.border[1], 0);
              }

              if (frame.border[1] > frame.rect[3] - frame.border[3]) {
                  frame.border[1] = Math.max(frame.rect[3] - frame.border[3], 0);
              }

              break;
          }
          case HANDLE.BORDER_TOP_LEFT: {
              frame.border[3] = Math.min(Math.max(startingHandleFrame.border[3] + dy, 0), frame.rect[3] - frame.border[1]);
              frame.border[0] = Math.min(Math.max(startingHandleFrame.border[0] + dx, 0), frame.rect[2] - frame.border[2]);
              break;
          }
          case HANDLE.BORDER_TOP: {
              frame.border[3] = Math.min(Math.max(startingHandleFrame.border[3] + dy, 0), frame.rect[3] - frame.border[1]);
              break;
          }
          case HANDLE.BORDER_TOP_RIGHT: {
              frame.border[2] = Math.min(Math.max(startingHandleFrame.border[2] - dx, 0), frame.rect[2] - frame.border[0]);
              frame.border[3] = Math.min(Math.max(startingHandleFrame.border[3] + dy, 0), frame.rect[3] - frame.border[1]);
              break;
          }
          case HANDLE.BORDER_LEFT: {
              frame.border[0] = Math.min(Math.max(startingHandleFrame.border[0] + dx, 0), frame.rect[2] - frame.border[2]);
              break;
          }
          case HANDLE.BORDER_RIGHT: {
              frame.border[2] = Math.min(Math.max(startingHandleFrame.border[2] - dx, 0), frame.rect[2] - frame.border[0]);
              break;
          }
          case HANDLE.BORDER_BOTTOM_LEFT: {
              frame.border[0] = Math.min(Math.max(startingHandleFrame.border[0] + dx, 0), frame.rect[2] - frame.border[2]);
              frame.border[1] = Math.min(Math.max(startingHandleFrame.border[1] - dy, 0), frame.rect[3] - frame.border[3]);
              break;
          }
          case HANDLE.BORDER_BOTTOM: {
              frame.border[1] = Math.min(Math.max(startingHandleFrame.border[1] - dy, 0), frame.rect[3] - frame.border[3]);
              break;
          }
          case HANDLE.BORDER_BOTTOM_RIGHT: {
              frame.border[2] = Math.min(Math.max(startingHandleFrame.border[2] - dx, 0), frame.rect[2] - frame.border[0]);
              frame.border[1] = Math.min(Math.max(startingHandleFrame.border[1] - dy, 0), frame.rect[3] - frame.border[3]);
              break;
          }
          case HANDLE.PIVOT: {
              var left = frameLeft(frame, imgLeft, imgWidth);
              var top = frameTop(frame, imgTop, imgHeight);
              var width = frameWidth(frame, imgWidth);
              var height = frameHeight(frame, imgHeight);
              frame.pivot[0] = clamp((p.x - left) / width, 0, 1);
              frame.pivot[1] = clamp(1 - (p.y - top) / height, 0, 1);
              break;
          }
          case HANDLE.FRAME: {
              frame.rect[0] = clamp(startingHandleFrame.rect[0] + (dx), 0, realWidth - frame.rect[2]);
              frame.rect[1] = clamp(startingHandleFrame.rect[1] - (dy), 0, realHeight - frame.rect[3]);
              break;
          }


      }
  };

  var setHandle = function (handle, frame, mousePoint) {
      selectedHandle = handle;
      if (handle) {
          // this frame will be used as the source frame
          // when calculating offsets in modifyFrame
          startingHandleFrame = utils.deepCopy(frame);

          // Store the real image coords of the mouse point
          // All offsets in modifyFrame will be calculated based on these coords
          if (mousePoint) {
              startingHandleCoords.x = clamp((mousePoint.x - imageLeft()) * atlasImage.width / imageWidth(), 0, atlasImage.width);
              startingHandleCoords.y = clamp((mousePoint.y - imageTop()) * atlasImage.height / imageHeight(), 0, atlasImage.height);
          }
      }

      updateCursor();
  }


  var startPanning = function (x, y) {
      panning = true;
      mouseX = x;
      mouseY = y;
      prevMouseX = x;
      prevMouseY = y;
      updateCursor();
  };

  var stopPanning = function () {
      panning = false;
      pivotX += pivotOffsetX;
      pivotY += pivotOffsetY;
      pivotOffsetX = 0;
      pivotOffsetY = 0;
      updateCursor();
  };

  controls.on('zoom:set', function (value, oldValue) {
      if (overlay.hidden) return;

      // store current zoom offset
      pivotX += zoomOffsetX;
      pivotY += zoomOffsetY;
      // reset current zoom offset
      zoomOffsetX = 0;
      zoomOffsetY = 0;

      var x = 0;
      var y = 0;

      // if the mouse cursor is not on the canvas
      // then use canvas center point as zoom pivot
      var canvasRect = canvas.element.getBoundingClientRect();
      if (mouseX < canvasRect.left || mouseX > canvasRect.right ||
          mouseY < canvasRect.top || mouseY > canvasRect.bottom) {
          x = canvas.width / 2;
          y = canvas.height / 2;
      } else {
          x = mouseX - canvasRect.left;
          y = mouseY - canvasRect.top;
      }

      // calculate zoom difference percentage
      var zoomDiff = (value - oldValue);
      var z = zoomDiff / oldValue;

      // calculate zoom offset based on the current zoom pivot
      zoomOffsetX = -z * (x - imageLeft()) / canvas.width;
      zoomOffsetY = -z * (y - imageTop()) / canvas.height;

      // re-render
      queueRender();
  });

  var queueRender = function () {
      if (queuedRender || overlay.hidden) return;
      queuedRender = true;
      requestAnimationFrame(renderCanvas);
  };

  var renderCanvas = function () {
      queuedRender = false;

      if (overlay.hidden) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!atlasImageLoaded) return;

      var selected = editor.call('picker:sprites:selectedFrame');

      // clear selection if no longer exists
      if (selected && !atlasAsset.has('data.frames.' + selected)) {
          selected = editor.call('picker:sprites:selectFrames', null);
      }

      var left = imageLeft();
      var top = imageTop();
      var width = imageWidth();
      var height = imageHeight();

      var highlightedFrames = editor.call('picker:sprites:highlightedFrames');
      var newSpriteFrames = editor.call('picker:sprites:newSpriteFrames');
      var spriteAsset = editor.call('picker:sprites:selectedSprite');

      // disable smoothing
      ctx.mozImageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.msImageSmoothingEnabled = false;
      ctx.imageSmoothingEnabled = false;

      // draw background outside image
      ctx.fillStyle = COLOR_DARKEST;
      // left
      ctx.fillRect(0, 0, left, canvas.height);
      // top
      ctx.fillRect(0, 0, canvas.width, top);
      // right
      ctx.fillRect(left + width, 0, canvas.width - left - width, canvas.height);
      // bottom
      ctx.fillRect(0, top + height, canvas.width, canvas.height - top - height);

      // draw image
      ctx.drawImage(
          atlasImage,
          0, 0,
          atlasImage.width, atlasImage.height,
          left, top, width, height
      );

      // scroll checkerboard pattern
      var checkLeft = left;
      var checkTop = top;
      canvas.style.backgroundPosition = checkLeft + 'px ' + checkTop + 'px, ' + (checkLeft + 12) + 'px ' + (checkTop + 12) + 'px';

      // draw frames
      var frames = atlasAsset.getRaw('data.frames')._data;
      ctx.beginPath();
      ctx.strokeStyle = COLOR_GRAY;
      ctx.lineWidth = 1;
      for (var key in frames) {
          if (highlightedFrames.indexOf(key) !== -1 || newSpriteFrames.indexOf(key) !== -1) continue;

          renderFrame(frames[key]._data, left, top, width, height);
      }
      ctx.stroke();

      // draw highlighted frames
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = spriteAsset ? COLOR_ORANGE : COLOR_DARK;
      for (var i = 0, len = highlightedFrames.length; i < len; i++) {
          var key = highlightedFrames[i];
          if (selected && selected === key) continue;

          // check if frame no longer exists
          if (!frames[key]) {
              highlightedFrames.splice(i, 1);
              len--;
              i--;
          } else {
              if (newSpriteFrames.indexOf(key) === -1) {
                  renderFrame(frames[key]._data, left, top, width, height, 0, !spriteEditMode);
              }
          }
      }
      ctx.stroke();

      // draw sprite edit mode frames
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = COLOR_DARK;
      for (var i = 0, len = newSpriteFrames.length; i < len; i++) {
          var key = newSpriteFrames[i];

          // check if frame no longer exists
          if (!frames[key]) {
              newSpriteFrames.splice(i, 1);
              len--;
              i--;
          } else {
              renderFrame(frames[key]._data, left, top, width, height, 0, !spriteEditMode);
          }
      }
      ctx.stroke();

      // render border lines
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.setLineDash([4]);
      if (!spriteEditMode) {
          for (var i = 0, len = highlightedFrames.length; i < len; i++) {
              var key = highlightedFrames[i];
              if (selected && selected === key) continue;
              renderBorderLines(frames[key]._data, left, top, width, height);
          }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      var frame;

      // render hovered frame
      if (hoveredFrame) {
          ctx.beginPath();
          ctx.lineWidth = 1;
          ctx.fillStyle = COLOR_TRANSPARENT_ORANGE;
          frame = atlasAsset.getRaw('data.frames.' + hoveredFrame);
          if (frame) {
              frame = frame._data;
              renderFrame(frame, left, top, width, height, 1);
          }
          ctx.fill();
      }

      frame = newFrame || (selected ? atlasAsset.getRaw('data.frames.' + selected) : null);
      if (frame && frame._data)
          frame = frame._data;

      if (frame) {
          ctx.beginPath();
          ctx.strokeStyle = COLOR_DARK;

          // draw newFrame or selected frame
          if (frame !== newFrame || newFrame.rect[2] !== 0 && newFrame.rect[3] !== 0) {
              renderFrame(frame, left, top, width, height);
          }

          ctx.stroke();

          // draw handles
          if (frame !== newFrame)
              renderHandles(frame, left, top, width, height);
      }
  };

  var renderFrame = function (frame, left, top, width, height, offset, renderPivot) {
      var x = frameLeft(frame, left, width);
      var y = frameTop(frame, top, height);
      var w = frameWidth(frame, width);
      var h = frameHeight(frame, height);

      offset = offset || 0;

      // render rect
      ctx.moveTo(x - offset, y - offset);
      ctx.lineTo(x - offset, y + offset + h);
      ctx.lineTo(x + offset + w, y + offset + h);
      ctx.lineTo(x + offset + w, y - offset);
      ctx.lineTo(x - offset, y - offset);

      if (renderPivot) {
          // render pivot
          var px = x + frame.pivot[0] * w;
          var py = y + (1 - frame.pivot[1]) * h;
          ctx.moveTo(px, py);
          ctx.arc(px, py, pivotWidth, 0, 2 * Math.PI);
      }
  };

  var renderBorderLines = function (frame, left, top, width, height) {
      var x = frameLeft(frame, left, width);
      var y = frameTop(frame, top, height);
      var w = frameWidth(frame, width);
      var h = frameHeight(frame, height);

      var borderWidthModifier = width / atlasImage.width;
      var borderHeightModifier = height / atlasImage.height;
      var lb = x + frame.border[0] * borderWidthModifier;
      var bb = y + h - frame.border[1] * borderHeightModifier;
      var rb = x + w - frame.border[2] * borderWidthModifier;
      var tb = y + frame.border[3] * borderHeightModifier;

      // left line
      if (frame.border[0]) {
          ctx.moveTo(lb, y);
          ctx.lineTo(lb, y + h);
      }

      // right line
      if (frame.border[2]) {
          ctx.moveTo(rb, y);
          ctx.lineTo(rb, y + h);
      }

      // bottom line
      if (frame.border[1]) {
          ctx.moveTo(x, bb);
          ctx.lineTo(x + w, bb);
      }

      // top line
      if (frame.border[3]) {
          ctx.moveTo(x, tb);
          ctx.lineTo(x + w, tb);
      }
  };

  var renderHandles = function (frame, left, top, width, height) {
      var x = frameLeft(frame, left, width);
      var y = frameTop(frame, top, height);
      var w = frameWidth(frame, width);
      var h = frameHeight(frame, height);
      var px = x + frame.pivot[0] * w;
      var py = y + (1 - frame.pivot[1]) * h;
      var i;

      ctx.fillStyle = COLOR_BLUE;
      ctx.strokeStyle = COLOR_BLUE;
      ctx.lineWidth = 1;

      var borderWidthModifier = width / atlasImage.width;
      var borderHeightModifier = height / atlasImage.height;
      var lb = x + frame.border[0] * borderWidthModifier;
      var bb = y + h - frame.border[1] * borderHeightModifier;
      var rb = x + w - frame.border[2] * borderWidthModifier;
      var tb = y + frame.border[3] * borderHeightModifier;

      // border lines
      ctx.beginPath();
      ctx.setLineDash([4]);

      // left line
      if (frame.border[0]) {
          ctx.moveTo(lb, y);
          ctx.lineTo(lb, y + h);
      }

      // right line
      if (frame.border[2]) {
          ctx.moveTo(rb, y);
          ctx.lineTo(rb, y + h);
      }

      // bottom line
      if (frame.border[1]) {
          ctx.moveTo(x, bb);
          ctx.lineTo(x + w, bb);
      }

      // top line
      if (frame.border[3]) {
          ctx.moveTo(x, tb);
          ctx.lineTo(x + w, tb);
      }

      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = COLOR_DARK;
      ctx.fillStyle = COLOR_GREEN;
      ctx.lineWidth = 1;

      // top left corner
      ctx.fillRect(
          x - handleWidth / 2,
          y - handleWidth / 2,
          handleWidth,
          handleWidth
      );

      ctx.strokeRect(
          x - handleWidth / 2,
          y - handleWidth / 2,
          handleWidth,
          handleWidth
      );
      // top right corner
      ctx.fillRect(
          x + w - handleWidth / 2,
          y - handleWidth / 2,
          handleWidth,
          handleWidth
      );

      ctx.strokeRect(
          x + w - handleWidth / 2,
          y - handleWidth / 2,
          handleWidth,
          handleWidth
      );

      // bottom left corner
      ctx.fillRect(
          x - handleWidth / 2,
          y + h - handleWidth / 2,
          handleWidth,
          handleWidth
      );

      ctx.strokeRect(
          x - handleWidth / 2,
          y + h - handleWidth / 2,
          handleWidth,
          handleWidth
      );
      // bottom right corner
      ctx.fillRect(
          x + w - handleWidth / 2,
          y + h - handleWidth / 2,
          handleWidth,
          handleWidth
      );

      ctx.strokeRect(
          x + w - handleWidth / 2,
          y + h - handleWidth / 2,
          handleWidth,
          handleWidth
      );


      ctx.fillStyle = COLOR_BLUE;
      ctx.strokeStyle = COLOR_DARK;

      // left border
      ctx.fillRect(
          lb - handleWidth / 2,
          (bb + tb) / 2 - handleWidth / 2,
          handleWidth,
          handleWidth
      );
      ctx.strokeRect(
          lb - handleWidth / 2,
          (bb + tb) / 2 - handleWidth / 2,
          handleWidth,
          handleWidth
      );


      // bottom border
      ctx.fillRect(
          (lb + rb) / 2 - handleWidth / 2,
          bb - handleWidth / 2,
          handleWidth,
          handleWidth
      );
      ctx.strokeRect(
          (lb + rb) / 2 - handleWidth / 2,
          bb - handleWidth / 2,
          handleWidth,
          handleWidth
      );

      // right border
      ctx.fillRect(
          rb - handleWidth / 2,
          (bb + tb) / 2 - handleWidth / 2,
          handleWidth,
          handleWidth
      );
      ctx.strokeRect(
          rb - handleWidth / 2,
          (bb + tb) / 2 - handleWidth / 2,
          handleWidth,
          handleWidth
      );

      // top border
      ctx.fillRect(
          (lb + rb) / 2 - handleWidth / 2,
          tb - handleWidth / 2,
          handleWidth,
          handleWidth
      );
      ctx.strokeRect(
          (lb + rb) / 2 - handleWidth / 2,
          tb - handleWidth / 2,
          handleWidth,
          handleWidth
      );

      // bottom left border
      if (frame.border[0] || frame.border[1]) {
          ctx.fillRect(
              lb - handleWidth / 2,
              bb - handleWidth / 2,
              handleWidth,
              handleWidth
          );
          ctx.strokeRect(
              lb - handleWidth / 2,
              bb - handleWidth / 2,
              handleWidth,
              handleWidth
          );
      }

      // bottom right border
      if (frame.border[1] || frame.border[2]) {
          ctx.fillRect(
              rb - handleWidth / 2,
              bb - handleWidth / 2,
              handleWidth,
              handleWidth
          );
          ctx.strokeRect(
              rb - handleWidth / 2,
              bb - handleWidth / 2,
              handleWidth,
              handleWidth
          );
      }


      // top right border
      if (frame.border[2] || frame.border[3]) {
          ctx.fillRect(
              rb - handleWidth / 2,
              tb - handleWidth / 2,
              handleWidth,
              handleWidth
          );
          ctx.strokeRect(
              rb - handleWidth / 2,
              tb - handleWidth / 2,
              handleWidth,
              handleWidth
          );
      }

      // top left border
      if (frame.border[3] || frame.border[0]) {
          ctx.fillRect(
              lb - handleWidth / 2,
              tb - handleWidth / 2,
              handleWidth,
              handleWidth
          );
          ctx.strokeRect(
              lb - handleWidth / 2,
              tb - handleWidth / 2,
              handleWidth,
              handleWidth
          );
      }

      // pivot
      ctx.beginPath();

      // border
      ctx.lineWidth = 5;
      ctx.strokeStyle = COLOR_DARK;
      ctx.moveTo(px + pivotWidth, py);
      ctx.arc(px, py, pivotWidth, 0, 2 * Math.PI);
      ctx.stroke();

      // inside border
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLOR_GREEN;
      ctx.stroke();
  };

  var updateRightPanel = function () {
      if (!rightPanel) {
          rightPanel = new ui.Panel();
          rightPanel.class.add('right-panel');
          rightPanel.class.add('attributes');
          rightPanel.flexShrink = false;
          rightPanel.style.width = '320px';
          rightPanel.innerElement.style.width = '320px';
          rightPanel.horizontal = true;
          rightPanel.foldable = true;
          rightPanel.scroll = true;
          rightPanel.resizable = 'left';
          rightPanel.resizeMin = 256;
          rightPanel.resizeMax = 512;
          panel.append(rightPanel);
      } else {
          // emit 'clear' event to clear existing children of right panel
          rightPanel.emit('clear');
      }

      if (!atlasImageLoaded) return;

      var spriteAsset = editor.call('picker:sprites:selectedSprite');

      if (spriteAsset) {
          editor.call('picker:sprites:attributes:sprite', { atlasAsset: atlasAsset, atlasImage: atlasImage, spriteAsset: spriteAsset });
      } else {
          var highlightedFrames = editor.call('picker:sprites:highlightedFrames');
          if (highlightedFrames.length) {
              editor.call('picker:sprites:attributes:frames', { atlasAsset: atlasAsset, atlasImage: atlasImage, frames: highlightedFrames });
              editor.call('picker:sprites:attributes:frames:relatedSprites', { atlasAsset: atlasAsset, frames: highlightedFrames });
          } else {
              editor.call('picker:sprites:attributes:atlas', atlasAsset);
              editor.call('picker:sprites:attributes:slice', { atlasAsset: atlasAsset, atlasImage: atlasImage, atlasImageData: atlasImageData });
              editor.call('picker:sprites:attributes:importFrames', { atlasAsset: atlasAsset });
          }
      }
  };

  var rectContainsPoint = function (p, left, top, width, height) {
      return left <= p.x && left + width >= p.x && top <= p.y && top + height >= p.y;
  };

  var framesHitTest = function (p) {
      var imgWidth = imageWidth();
      var imgHeight = imageHeight();
      var imgLeft = imageLeft();
      var imgTop = imageTop();

      var frames = atlasAsset.getRaw('data.frames')._data;
      for (var key in frames) {
          var frame = frames[key]._data;
          var left = frameLeft(frame, imgLeft, imgWidth);
          var top = frameTop(frame, imgTop, imgHeight);
          var width = frameWidth(frame, imgWidth);
          var height = frameHeight(frame, imgHeight);

          if (rectContainsPoint(p, left, top, width, height)) {
              return key;
          }
      }

      return null;
  };

  var handlesHitTest = function (p, frame) {
      if (! editor.call('permissions:write')) return false;

      var imgWidth = imageWidth();
      var imgHeight = imageHeight();
      var imgLeft = imageLeft();
      var imgTop = imageTop();

      var left = frameLeft(frame, imgLeft, imgWidth);
      var top = frameTop(frame, imgTop, imgHeight);
      var width = frameWidth(frame, imgWidth);
      var height = frameHeight(frame, imgHeight);

      var borderWidthModifier = imgWidth / atlasImage.width;
      var borderHeightModifier = imgHeight / atlasImage.height;
      var lb = left + frame.border[0] * borderWidthModifier;
      var bb = top + height - frame.border[1] * borderHeightModifier;
      var rb = left + width - frame.border[2] * borderWidthModifier;
      var tb = top + frame.border[3] * borderHeightModifier;

      // pivot
      var pivotX = left + frame.pivot[0] * width;
      var pivotY = top + (1 - frame.pivot[1]) * height;
      var distFromCenter = Math.sqrt((p.x - pivotX) * (p.x - pivotX) + (p.y - pivotY) * (p.y - pivotY));
      if (distFromCenter < pivotWidth + 1 && distFromCenter > pivotWidth - 3) {
          return HANDLE.PIVOT;
      }

      // top left border
      if (frame.border[0] || frame.border[3]) {
          if (rectContainsPoint(p, lb - handleWidth / 2, tb - handleWidth / 2, handleWidth, handleWidth)) {
              return HANDLE.BORDER_TOP_LEFT;
          }
      }

      // top border
      if (rectContainsPoint(p, (lb + rb) / 2 - handleWidth / 2, tb - handleWidth / 2, handleWidth, handleWidth)) {
          return HANDLE.BORDER_TOP;
      }

      // top right border
      if (frame.border[2] || frame.border[3]) {
          if (rectContainsPoint(p, rb - handleWidth / 2, tb - handleWidth / 2, handleWidth, handleWidth)) {
              return HANDLE.BORDER_TOP_RIGHT;
          }
      }

      // left border
      if (rectContainsPoint(p, lb - handleWidth / 2, (bb + tb) / 2 - handleWidth / 2, handleWidth, handleWidth)) {
          return HANDLE.BORDER_LEFT;
      }

      // right border
      if (rectContainsPoint(p, rb - handleWidth / 2, (bb + tb) / 2 - handleWidth / 2, handleWidth, handleWidth)) {
          return HANDLE.BORDER_RIGHT;
      }

      // bottom left border
      if (frame.border[0] || frame.border[1]) {
          if (rectContainsPoint(p, lb - handleWidth / 2, bb - handleWidth / 2, handleWidth, handleWidth)) {
              return HANDLE.BORDER_BOTTOM_LEFT;
          }
      }

      // bottom border
      if (rectContainsPoint(p, (lb + rb) / 2 - handleWidth / 2, bb - handleWidth / 2, handleWidth, handleWidth)) {
          return HANDLE.BORDER_BOTTOM;
      }

      // bottom right border
      if (frame.border[1] || frame.border[2]) {
          if (rectContainsPoint(p, rb - handleWidth / 2, bb - handleWidth / 2, handleWidth, handleWidth)) {
              return HANDLE.BORDER_BOTTOM_RIGHT;
          }
      }

      // top left corner
      if (rectContainsPoint(p, left - handleWidth / 2, top - handleWidth / 2, handleWidth, handleWidth)) {
          return HANDLE.TOP_LEFT;
      }
      // top right corner
      if (rectContainsPoint(p, left + width - handleWidth / 2, top - handleWidth / 2, handleWidth, handleWidth)) {
          return HANDLE.TOP_RIGHT;
      }
      // bottom left corner
      if (rectContainsPoint(p, left - handleWidth / 2, top + height - handleWidth / 2, handleWidth, handleWidth)) {
          return HANDLE.BOTTOM_LEFT;
      }
      // bottom right corner
      if (rectContainsPoint(p, left + width - handleWidth / 2, top + height - handleWidth / 2, handleWidth, handleWidth)) {
          return HANDLE.BOTTOM_RIGHT;
      }

      // left border edge
      if (frame.border[0]) {
          if (rectContainsPoint(p, lb - handleWidth / 2, top + handleWidth / 2, handleWidth, height - handleWidth)) {
              return HANDLE.BORDER_LEFT;
          }
      }
      // right border edge
      if (frame.border[2]) {
          if (rectContainsPoint(p, rb - handleWidth / 2, top + handleWidth / 2, handleWidth, height - handleWidth)) {
              return HANDLE.BORDER_RIGHT;
          }
      }
      // bottom border edge
      if (frame.border[1]) {
          if (rectContainsPoint(p, left + handleWidth / 2, bb - handleWidth / 2, width - handleWidth, handleWidth)) {
              return HANDLE.BORDER_BOTTOM;
          }
      }
      // top border edge
      if (frame.border[3]) {
          if (rectContainsPoint(p, left + handleWidth / 2, tb - handleWidth / 2, width - handleWidth, handleWidth)) {
              return HANDLE.BORDER_TOP;
          }
      }

      // left edge
      if (rectContainsPoint(p, left - handleWidth / 2, top + handleWidth / 2, handleWidth, height - handleWidth)) {
          return HANDLE.LEFT;
      }
      // right edge
      if (rectContainsPoint(p, left + width - handleWidth / 2, top + handleWidth / 2, handleWidth, height - handleWidth)) {
          return HANDLE.RIGHT;
      }
      // top edge
      if (rectContainsPoint(p, left + handleWidth / 2, top - handleWidth / 2, width - handleWidth, handleWidth)) {
          return HANDLE.TOP;
      }
      // bottom edge
      if (rectContainsPoint(p, left + handleWidth / 2, top + height - handleWidth / 2, width - handleWidth, handleWidth)) {
          return HANDLE.BOTTOM;
      }

      // frame
      if (rectContainsPoint(p, left, top, width, height)) {
          return HANDLE.FRAME;
      }

      return null;
  };


  var showEditor = function (asset) {
      var _spriteAsset = null;
      if (asset.get('type') === 'textureatlas') {
          atlasAsset = asset;
      } else if (asset.get('type') === 'sprite') {
          atlasAsset = editor.call('assets:get', asset.get('data.textureAtlasAsset'));
          _spriteAsset = asset;
      } else {
          atlasAsset = null;
      }

      if (!atlasAsset)
          return;

      panel.header = 'SPRITE EDITOR - ' + atlasAsset.get('name').toUpperCase();

      // show overlay
      overlay.hidden = false;

      atlasImageLoaded = false;
      atlasImage.onload = function () {
          atlasImageLoaded = true;

          // get image data
          atlasImageDataCanvas.width = atlasImage.width;
          atlasImageDataCanvas.height = atlasImage.height;
          atlasImageDataCanvas.getContext('2d').drawImage(atlasImage, 0, 0, atlasImage.width, atlasImage.height);
          atlasImageData = atlasImageDataCanvas.getContext('2d').getImageData(0, 0, atlasImage.width, atlasImage.height);

          aspectRatio = atlasImage.width / atlasImage.height;

          editor.call('picker:sprites:frames', { atlasAsset: atlasAsset });
          editor.call('picker:sprites:spriteassets', { atlasAsset: atlasAsset });
          editor.emit('picker:sprites:open');

          if (_spriteAsset) {
              editor.call('picker:sprites:selectSprite', _spriteAsset);
          } else {
              updateRightPanel();
              renderCanvas();
          }

      };
      atlasImage.src = atlasAsset.get('file.url').appendQuery('t=' + atlasAsset.get('file.hash'));

      // listen to atlas changes and render
      events.push(atlasAsset.on('*:set', queueRender));
      events.push(atlasAsset.on('*:unset', queueRender));
      events.push(atlasAsset.on('name:set', function (value) {
          panel.header = 'SPRITE EDITOR - ' + value.toUpperCase();
      }));

      // resize 20 times a second - if size is the same nothing will happen
      if (resizeInterval) {
          clearInterval(resizeInterval);
      }
      resizeInterval = setInterval(function () {
          if (resizeCanvas()) {
              queueRender();
          }
      }, 1000 / 60);

      resizeCanvas();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      updateRightPanel();

      registerInputListeners();

      // clear current selection so that we don't
      // accidentally delete any selected assets when pressing delete
      editor.call('selector:history', false);
      editor.call('selector:clear');
      // restore selector history in a timeout
      // because selector:clear emits a history
      // event also in a timeout... annoying
      setTimeout(function () {
          editor.call('selector:history', true);
      });
  };

  var updateCursor = function () {
      var cls = middlePanel.class;

      cls.remove('ew-resize');
      cls.remove('ns-resize');
      cls.remove('nwse-resize');
      cls.remove('nesw-resize');
      cls.remove('move');
      cls.remove('grab');
      cls.remove('grabbing');


      if ((panning || shiftDown) && !selectedHandle) {
          if (panning) {
              cls.add('grabbing');
          } else if (shiftDown) {
              cls.add('grab');
          }
      } else {
          var handle = selectedHandle !== null ? selectedHandle : hoveringHandle;
          if (handle !== null) {
              switch (handle) {
                  case HANDLE.LEFT:
                  case HANDLE.RIGHT:
                  case HANDLE.BORDER_LEFT:
                  case HANDLE.BORDER_RIGHT:
                      cls.add('ew-resize');
                      break;

                  case HANDLE.TOP:
                  case HANDLE.BOTTOM:
                  case HANDLE.BORDER_TOP:
                  case HANDLE.BORDER_BOTTOM:
                      cls.add('ns-resize');
                      break;

                  case HANDLE.TOP_LEFT:
                  case HANDLE.BOTTOM_RIGHT:
                  case HANDLE.BORDER_TOP_LEFT:
                  case HANDLE.BORDER_BOTTOM_RIGHT:
                      cls.add('nwse-resize');
                      break;

                  case HANDLE.TOP_RIGHT:
                  case HANDLE.BOTTOM_LEFT:
                  case HANDLE.BORDER_TOP_RIGHT:
                  case HANDLE.BORDER_BOTTOM_LEFT:
                      cls.add('nesw-resize');
                      break;

                  case HANDLE.PIVOT:
                      if (handle === selectedHandle) {
                          cls.add('grabbing');
                      } else {
                          cls.add('grab');
                      }
                      break;

                  case HANDLE.FRAME:
                      cls.add('move');
                      break;
              }
          }
      }
  };

  var cleanUp = function () {
      // reset controls
      controls.set('zoom', 1);
      controls.set('brightness', 100);

      resetControls();

      if (resizeInterval) {
          clearInterval(resizeInterval);
          resizeInterval = null;
      }

      // destroy right panel
      if (rightPanel) {
          rightPanel.emit('clear');
          rightPanel.destroy();
          rightPanel = null;
      }

      leftPanel.emit('clear');
      bottomPanel.emit('clear');

      newFrame = null;
      hoveredFrame = null;
      startingHandleFrame = null;
      hoveringHandle = null;
      selectedHandle = null;
      atlasImageData = null;
      atlasImageDataCanvas.getContext('2d').clearRect(0, 0, atlasImageDataCanvas.width, atlasImageDataCanvas.height);
      atlasImage = new Image();

      leftButtonDown = false;
      rightButtonDown = false;
      shiftDown = false;

      if (spriteEditMode) {
          editor.call('picker:sprites:pickFrames:cancel');
      }

      atlasAsset = null;

      middlePanel.class.remove('grab');
      middlePanel.class.remove('grabbing');

      for (var i = 0; i < events.length; i++) {
          events[i].unbind();
      }
      events.length = 0;

      unregisterInputListeners();

      editor.emit('picker:sprites:close');
  };

  // Return canvas
  editor.method('picker:sprites:canvas', function () {
      return canvas.element;
  });

  // Return left panel
  editor.method('picker:sprites:leftPanel', function () {
      return leftPanel;
  });

  // Return right panel
  editor.method('picker:sprites:rightPanel', function () {
      return rightPanel;
  });

  // Return main panel
  editor.method('picker:sprites:mainPanel', function () {
      return panel;
  });

  // Return bottom panel
  editor.method('picker:sprites:bottomPanel', function () {
      return bottomPanel;
  });

  // Return atlas asset
  editor.method('picker:sprites:atlasAsset', function () {
      return atlasAsset;
  });

  // Return atlas image
  editor.method('picker:sprites:atlasImage', function () {
      return atlasImage;
  });

  // Return atlas image data
  editor.method('picker:sprites:atlasImageData', function () {
      return atlasImageData;
  });

  // Return sprite editor controls
  editor.method('picker:sprites:controls', function () {
      return controls;
  });

  editor.method('picker:sprites:hoverFrame', function (frameKey) {
      hoveredFrame = frameKey;
      queueRender();
  });

  // Queue re-render
  editor.method('picker:sprites:queueRender', queueRender);

  // Focus the selected frame if one exists otherwise resets view
  editor.method('picker:sprites:focus', function () {
      var selected = editor.call('picker:sprites:selectedFrame');
      // if we have a selected frame then focus on that
      // otherwise completely reset view
      if (selected) {
          var frame = atlasAsset.getRaw('data.frames.' + selected)._data;

          // these are derived by solving the equations so that frameLeft + frameWidth / 2 === canvas.width / 2
          // and frameTop + frameHeight / 2 === canvas.height / 2
          var frameWidthPercentage = (frame.rect[0] + frame.rect[2] / 2) / atlasImage.width;
          var imageWidthPercentage = imageWidth() / canvas.width;

          var frameHeightPercentage = (atlasImage.height - frame.rect[1] - frame.rect[3] * 0.5) / atlasImage.height;
          var imageHeightPercentage = imageHeight() / canvas.height;

          // set pivotX and pivotY and zero out the other offsets
          pivotX = 0.5 - frameWidthPercentage * imageWidthPercentage;
          pivotY = 0.5 - frameHeightPercentage * imageHeightPercentage;
          zoomOffsetX = 0;
          pivotOffsetX = 0;
          zoomOffsetY = 0;
          pivotOffsetY = 0;

      } else {
          resetControls();
      }
      queueRender();
  });

  // Update inspector when selection changes
  editor.on('picker:sprites:framesSelected', function () {
      hoveringHandle = null;
      setHandle(null);
      updateCursor();

      if (!spriteEditMode) {
          updateRightPanel();
      }

      queueRender();
  });

  // Track sprite edit mode
  editor.on('picker:sprites:pickFrames:start', function () {
      spriteEditMode = true;
      queueRender();
  });

  editor.on('picker:sprites:pickFrames:end', function () {
      spriteEditMode = false;
      queueRender();
  });

  // open Sprite Editor (undoable)
  editor.method('picker:sprites', function (asset) {
      editor.call('history:add', {
          name: 'open sprite editor',
          undo: function () {
              overlay.hidden = true;
          },
          redo: function () {
              var currentAsset = editor.call('assets:get', asset.get('id'));
              if (!currentAsset) return;

              showEditor(currentAsset);
          }
      });

      showEditor(asset);
  });

  // Close Sprite Editor (undoable)
  editor.method('picker:sprites:close', function () {
      overlay.hidden = true;
  });

  overlay.on('show', function () {
      // editor-blocking picker opened
      editor.emit('picker:open', 'sprite-editor');
  })

  // Clean up
  overlay.on('hide', function () {
      if (!suspendCloseUndo) {
          var currentAsset = atlasAsset;

          editor.call('history:add', {
              name: 'close sprite editor',
              undo: function () {
                  var asset = editor.call('assets:get', currentAsset.get('id'));
                  if (!asset) return;

                  showEditor(asset);
              },
              redo: function () {
                  suspendCloseUndo = true;
                  overlay.hidden = true;
                  suspendCloseUndo = false;
              }
          });
      }

      cleanUp();

      // editor-blocking picker closed
      editor.emit('picker:close', 'sprite-editor');
  });
});


/* editor/pickers/sprite-editor/sprite-editor-frames-panel.js */
editor.once('load', function() {
  'use strict';

  editor.method('picker:sprites:frames', function(args) {
      var events = [];

      var atlasAsset = args.atlasAsset;

      var panels = {};
      var selectedKeys = [];
      var spriteEditModeKeys = [];
      var spriteEditMode = false;
      var selectedSprite = null;

      var shiftDown = false;
      var ctrlDown = false;

      var scrollSelectionIntoView = true;

      var leftPanel = editor.call('picker:sprites:leftPanel');
      leftPanel.header = 'FRAMES IN TEXTURE ATLAS';

      var panelFrames = editor.call('attributes:addPanel', {
          parent: leftPanel
      });

      // var panelFrames = new ui.Panel();
      panelFrames.scroll = true;
      panelFrames.class.add('frames');
      // panel.append(panelFrames);

      var addFramePanel = function (key, frame, afterPanel, beforePanel) {
          var frameEvents = [];

          var panel = new ui.Panel();
          panel.class.add('frame');
          panel.frameKey = key;

          panels[key] = panel;

          // preview
          var canvas = new ui.Canvas();
          var previewWidth = 26;
          var previewHeight = 26;
          canvas.class.add('preview');
          canvas.resize(previewWidth, previewHeight);

          panel.append(canvas);

          var renderQueued = false;

          panel.queueRender = function () {
              if (renderQueued) return;
              renderQueued = true;
              requestAnimationFrame(renderPreview);
          };

          var renderPreview = function () {
              editor.call('picker:sprites:renderFramePreview', frame, canvas.element);
              renderQueued = false;
          };

          renderPreview();

          // sprite name
          var fieldName = new ui.Label();
          fieldName.class.add('name');
          fieldName.value = frame.name;
          panel.append(fieldName);

          frameEvents.push(atlasAsset.on('data.frames.' + key + '.name:set', function (value) {
              fieldName.value = value;
          }));

          // remove frame
          var btnRemove = new ui.Button();
          btnRemove.class.add('remove');
          panel.append(btnRemove);

          btnRemove.disabled = ! editor.call('permissions:write');

          frameEvents.push(editor.on('permissions:writeState', function (canWrite) {
              btnRemove.disabled = ! canWrite;
          }));

          btnRemove.on('click', function (e) {
              e.stopPropagation();
              editor.call('picker:sprites:deleteFrames', [key], {
                  history: true
              });
          });

          panel.on('click', function () {
              scrollSelectionIntoView = false;

              if (shiftDown) {
                  // if another frame was selected then add range to selection
                  var keys = spriteEditMode ? spriteEditModeKeys : selectedKeys;
                  var len = keys.length;
                  if (len) {
                      var diff = parseInt(key, 10) - parseInt(keys[len-1], 10);
                      var dir = diff < 0 ? -1 : 1;
                      var p = panels[keys[len-1]];
                      var range = [];
                      while (diff !== 0) {
                          p = dir > 0 ? p.element.nextSibling : p.element.previousSibling;
                          if (! p) break;
                          p = p.ui;

                          range.push(p.frameKey);

                          if (p.frameKey === key)
                              break;

                          diff -= dir;
                      }

                      if (range.length) {
                          editor.call('picker:sprites:selectFrames', range, {
                              add: true,
                              history: true,
                              clearSprite: !spriteEditMode
                          });
                      }
                  } else {
                      // otherwise just select single frame
                      editor.call('picker:sprites:selectFrames', key, {
                          history: true,
                          clearSprite: !spriteEditMode
                      });
                  }
              } else if (ctrlDown) {
                  // if not selected add frame to selection
                  var keys = spriteEditMode ? spriteEditModeKeys : selectedKeys;
                  var idx = keys.indexOf(key);
                  if (idx === -1) {
                      editor.call('picker:sprites:selectFrames', key, {
                          add: true,
                          history: true,
                          clearSprite: !spriteEditMode
                      });
                  } else {
                      // if selected remove from selection
                      keys.splice(idx, 1);
                      editor.call('picker:sprites:selectFrames', keys, {
                          history: true,
                          clearSprite: !spriteEditMode
                      });
                  }

              } else {
                  // select single frame
                  editor.call('picker:sprites:selectFrames', key, {
                      history: true,
                      clearSprite: !spriteEditMode
                  });
              }

              scrollSelectionIntoView = true;

          });

          var onMouseEnter = function () {
              editor.call('picker:sprites:hoverFrame', key);
          };

          var onMouseLeave = function () {
              editor.call('picker:sprites:hoverFrame', null);
          };

          panel.element.addEventListener('mouseenter', onMouseEnter);
          panel.element.addEventListener('mouseleave', onMouseLeave);

          // clean up events
          panel.on('destroy', function () {
              for (var i = 0, len = frameEvents.length; i<len; i++) {
                  frameEvents[i].unbind();
              }
              frameEvents.length = 0;


              panel.element.removeEventListener('mouseenter', onMouseEnter);
              panel.element.removeEventListener('mouseleave', onMouseLeave);
          });

          if (afterPanel) {
              panelFrames.appendAfter(panel, afterPanel);
          } else if (beforePanel) {
              panelFrames.appendBefore(panel, beforePanel);
          } else {
              panelFrames.append(panel);
          }
      };

      // create frames
      var frames = atlasAsset.getRaw('data.frames')._data;
      for (var key in frames) {
          addFramePanel(key, frames[key]._data);
      }

      // keydown
      var onKeyDown = function (e) {
          ctrlDown = e.ctrlKey || e.metaKey;
          shiftDown = e.shiftKey;
      };
      window.addEventListener('keydown', onKeyDown);

      // keyup
      var onKeyUp = function (e) {
          ctrlDown = e.ctrlKey || e.metaKey;
          shiftDown = e.shiftKey;
      };
      window.addEventListener('keyup', onKeyUp);

      // listen to atlas set event
      var checkPath = /^data\.frames(.(\d+))?$/;
      events.push(atlasAsset.on('*:set', function (path, value) {
          if (! path.startsWith('data.frames')) return;

          var parts = path.split('.');
          if (parts.length === 2) {
              // if all frames are set then re-create all frame panels
              for (key in panels) {
                  panels[key].destroy();
                  delete panels[key];
              }

              panels = {};

              var raw = atlasAsset.getRaw('data.frames')._data;

              for (key in value) {
                  addFramePanel(key, raw[key]._data);
              }
          } else if (parts.length === 3) {
              // if a frame was set and it doesn't exist create it
              var key = parts[2];
              if (key) {
                  if (! panels[key]) {
                      var panelBefore = null;
                      var panelAfter = null;

                      var search = parseInt(key, 10);
                      for (var k in panels) {
                          if (search < parseInt(k, 10)) {
                              panelBefore = panels[k];
                              break;
                          } else {
                              panelAfter = panels[k];
                          }
                      }


                      var raw = atlasAsset.getRaw('data.frames')._data;
                      addFramePanel(key, raw[key]._data, panelAfter, panelBefore);
                  }
              }
          } else {
              // if a field changed then re-render the preview for that frame
              var key = parts[2];
              if (panels[key]) {
                  panels[key].queueRender();
              }
          }
      }));

      // listen to atlas unset event
      var checkUnsetPath = /^data\.frames\.(\d+)$/;
      events.push(atlasAsset.on('*:unset', function (path) {
          var match = path.match(checkUnsetPath);
          if (! match) return;

          var key = match[1];
          if (panels[key]) {
              panels[key].destroy();
              delete panels[key];
          }
      }));

      // Listen to framesSelected event to highlight panels
      events.push(editor.on('picker:sprites:framesSelected', function (keys) {
          var index = {};
          var key;

          if (spriteEditMode) {
              // unhighlight old keys
              var highlighted = panelFrames.innerElement.querySelectorAll('.frame.highlighted');
              for (var i = 0, len = highlighted.length; i<len; i++) {
                  if (! keys || keys.indexOf(highlighted[i].ui.frameKey) === -1) {
                      highlighted[i].ui.class.remove('highlighted');
                  }
              }

              if (keys) {
                  spriteEditModeKeys = keys.slice();
              } else {
                  spriteEditModeKeys.length = 0;
              }

          } else {
              var selected = panelFrames.innerElement.querySelectorAll('.frame.selected');
              for (var i = 0, len = selected.length; i<len; i++) {
                  if (! keys || keys.indexOf(selected[i].ui.frameKey) === -1) {
                      selected[i].ui.class.remove('selected');
                      selected[i].ui.class.remove('sprite-frame');
                  }
              }

              if (keys) {
                  selectedKeys = keys.slice();
              } else {
                  selectedKeys.length = 0;
              }
          }

          // select new keys
          if (keys && keys.length) {
              for (var i = 0, len = keys.length; i < len; i++) {
                  key = keys[i];
                  index[key] = true;

                  if (! panels[key]) continue;

                  if (scrollSelectionIntoView) {
                      var scroll = false;
                      if (i === 0) {
                          scroll = spriteEditMode ? ! panels[key].class.contains('highlighted') : ! panels[key].class.contains('selected');
                          if (scroll) {
                              panelFrames.innerElement.scrollTop = panels[key].element.offsetTop;
                          }
                      }
                  }

                  panels[key].class.add(spriteEditMode ? 'highlighted' : 'selected');
                  if (selectedSprite && (keys === selectedKeys || selectedKeys.indexOf(key) !== -1)) {
                      panels[key].class.add('sprite-frame');
                  }
              }
          }
      }));

      events.push(editor.on('picker:sprites:pickFrames:start', function () {
          spriteEditMode = true;
      }));

      events.push(editor.on('picker:sprites:pickFrames:end', function () {
          spriteEditMode = false;

          for (var i = 0, len = spriteEditModeKeys.length; i<len; i++) {
              if (panels[spriteEditModeKeys[i]]) {
                  panels[spriteEditModeKeys[i]].class.remove('highlighted');
              }
          }

          spriteEditModeKeys.length = 0;
      }));

      events.push(editor.on('picker:sprites:spriteSelected', function (spriteAsset) {
          selectedSprite = spriteAsset;
          var keys = spriteEditMode ? spriteEditModeKeys : selectedKeys;
          for (var i = 0, len = keys.length; i<len; i++) {
              var panel = panels[keys[i]];
              if (! panel) continue;

              if (selectedSprite) {
                  panel.class.add('sprite-frame');
              } else {
                  panel.class.remove('sprite-frame');
              }
          }
      }));

      // clean up
      events.push(leftPanel.on('clear', function () {
          panelFrames.destroy();
      }));

      panelFrames.on('destroy', function () {
          for (var i = 0; i < events.length; i++) {
              events[i].unbind();
          }

          events.length = 0;

          window.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('keyup', onKeyUp);

          panels = {};
          selectedKeys.length = 0;
          spriteEditModeKeys.length = 0;
      });
  });
});


/* editor/pickers/sprite-editor/sprite-editor-selection.js */
editor.once('load', function () {
  'use strict';

  var selected = null;
  var highlightedFrames = [];
  var newSpriteFrames = [];

  var atlasAsset = null;
  var spriteAsset = null;

  var spriteEditMode = false;

  var events = [];

  // Select frames by keys
  // options.history: Whether to add this action to the history
  // options.add: Whether to add the frames to the existing selection
  // options.clearSprite: Clear sprite selection if true
  var selectFrames = function (keys, options) {
      if (keys && ! (keys instanceof Array))
          keys = [keys];

      // check if new selection differs from old
      var dirty = false;
      if (! keys && selected || ! keys && options && options.clearSprite && spriteAsset) {
          dirty = true;
      } else if (keys && ! selected) {
          dirty = true;
      } else if (selected && spriteAsset && (! options || ! options.clearSprite)) {
          dirty = true;
      } else {
          var klen = keys ? keys.length : 0;
          var hlen = highlightedFrames.length;
          if (klen !== hlen) {
              dirty = true;
          } else {
              for (var i = 0; i < klen; i++) {
                  if (keys[i] !== highlightedFrames[i]) {
                      dirty = true;
                      break;
                  }
              }
          }
      }

      if (! dirty)
          return;

      var prevSelection = selected;
      var prevHighlighted = spriteEditMode ? newSpriteFrames.slice() : highlightedFrames.slice();
      var prevSprite = spriteAsset;

      // add to selection if necessary
      if (keys && options && options.add) {
          var temp = prevHighlighted.slice();
          for (var i = 0, len = keys.length; i<len; i++) {
              if (temp.indexOf(keys[i]) === -1) {
                  temp.push(keys[i]);
              }
          }
          keys = temp;
      }

      var select = function (newKeys, newSelection, oldKeys) {
          selected = null;

          if (oldKeys) {
              if (spriteEditMode) {
                  newSpriteFrames.length = 0;
              } else {
                  highlightedFrames.length = 0;
              }
          }

          var asset = editor.call('assets:get', atlasAsset.get('id'));
          if (asset) {
              var len = newKeys && newKeys.length;
              if (len) {
                  if (spriteEditMode) {
                      newSpriteFrames = newKeys.slice();
                  } else {
                      highlightedFrames = newKeys.slice();
                  }

                  if (! spriteAsset) {
                      selected = newSelection || newKeys[len-1];

                  }
              }
          }

          editor.emit('picker:sprites:framesSelected', newKeys);
      };

      var redo = function () {
          if (options && options.clearSprite) {
              setSprite(null);
          }

          select(keys, null, prevHighlighted);
      };

      var undo = function () {
          if (options && options.clearSprite && prevSprite) {
              selectSprite(prevSprite);
          } else {
              select(prevHighlighted, prevSelection, keys);
          }
      };

      if (options && options.history) {
          editor.call('history:add', {
              name: 'select frame',
              undo: undo,
              redo: redo
          });

      }

      redo();

      return selected;
  };

  // Sets the selected sprite and hooks event listeners
  var setSprite = function (asset) {
      if (spriteAsset) {
          spriteAsset.unbind('data.frameKeys:remove', selectSpriteFrames);
          spriteAsset.unbind('data.frameKeys:insert', selectSpriteFrames);
          spriteAsset.unbind('data.frameKeys:set', selectSpriteFrames);
      }

      spriteAsset = asset;
      editor.emit('picker:sprites:spriteSelected', asset);

      if (! spriteAsset) return;

      spriteAsset.on('data.frameKeys:remove', selectSpriteFrames);
      spriteAsset.on('data.frameKeys:insert', selectSpriteFrames);
      spriteAsset.on('data.frameKeys:set', selectSpriteFrames);
  };

  var selectSpriteFrames = function () {
      if (spriteAsset) {
          selectFrames(spriteAsset.getRaw('data.frameKeys'));
      }
  };

  // Select specified sprite asset
  // Options are:
  // - history: If true make action undoable
  var selectSprite = function (asset, options) {
      if (options && options.history) {
          var prevSprite = spriteAsset;
          var newSprite = asset;
          var selectedFrames = selected && ! prevSprite ? highlightedFrames : null;

          var redo = function () {
              setSprite(asset);
              if (spriteAsset) {
                  selectFrames(spriteAsset.getRaw('data.frameKeys'));
              } else {
                  selectFrames(null);
              }
          };

          var undo = function () {
              setSprite(prevSprite);
              if (spriteAsset) {
                  selectFrames(spriteAsset.getRaw('data.frameKeys'));
              } else {
                  selectFrames(selectedFrames);
              }
          };

          editor.call('history:add', {
              name: 'select sprite',
              undo: undo,
              redo: redo
          });

          redo();
      } else {
          setSprite(asset);
          if (spriteAsset) {
              selectFrames(spriteAsset.getRaw('data.frameKeys'));
          } else {
              selectFrames(null);
          }
      }
  };

  // Methods

  editor.method('picker:sprites:selectSprite', selectSprite);

  editor.method('picker:sprites:selectFrames', selectFrames);

  // Create sprite asset from selected frames
  editor.method('picker:sprites:spriteFromSelection', function (args) {
      if (! highlightedFrames.length )
          return;

      // rendermode: 1 - sliced, 0 - simple
      var renderMode = args && args.sliced ? 1 : 0;
      // default ppu to 1 if we're using sliced mode and we have just one frame
      // as that's likely going to be used for Image Elements otherwise default to 100
      // which is better for world-space sprites
      var ppu = args && args.sliced && highlightedFrames.length === 1 ? 1 : 100;

      // get the atlas name without the extension
      var atlasNameWithoutExt = atlasAsset.get('name');
      var lastDot = atlasNameWithoutExt.lastIndexOf('.');
      if (lastDot > 0) {
          atlasNameWithoutExt = atlasNameWithoutExt.substring(0, lastDot);
      }

      var name;

      // if we just have one frame in the atlas use the atlas name for the sprite name
      // without the extension, otherwise if it's only 1 frame selected use the frame name,
      // otherwise use a generic name
      if (highlightedFrames.length === 1) {
          if (Object.keys(atlasAsset.get('data.frames')).length === 1) {
              name = atlasNameWithoutExt;
          } else {
              name = atlasAsset.get('data.frames.' + highlightedFrames[0] + '.name');
          }
      }

      if (! name) {
          name = 'New Sprite';
      }

      editor.call('assets:create:sprite', {
          name: name,
          pixelsPerUnit: ppu,
          renderMode: renderMode,
          frameKeys: highlightedFrames,
          textureAtlasAsset: atlasAsset.get('id'),
          noSelect: true,
          fn: function (err, id) {
              var asset = editor.call('assets:get', id);
              if (asset) {
                  selectSprite(asset);
                  if (args && args.callback) {
                      args.callback(asset);
                  }
              } else {
                  editor.once('assets:add[' + id + ']', function (asset) {
                      // do this in a timeout in order to wait for
                      // assets:add to be raised first
                      requestAnimationFrame(function () {
                          selectSprite(asset);
                          if (args && args.callback) {
                              args.callback(asset);
                          }
                      });
                  });
              }
          }
      });
  });

  var startSpriteEditMode = function () {
      spriteEditMode = true;
      editor.emit('picker:sprites:pickFrames:start');

      // Enter key to add frames and end sprite edit mode
      editor.call('hotkey:register', 'sprite-editor-add-frames', {
          key: 'enter',
          callback: function () {
              // do this in a timeout because this will terminate sprite edit mode
              // which will unregister the hotkey which will cause an error because
              // we are still in the hotkey execution loop
              setTimeout(function () {
                  editor.call('picker:sprites:pickFrames:add');
              });
          }
      })


  };

  var endSpriteEditMode = function () {
      spriteEditMode = false;
      newSpriteFrames.length = 0;

      editor.call('hotkey:unregister', 'sprite-editor-add-frames');
      editor.emit('picker:sprites:pickFrames:end');

      selectSpriteFrames();
  };

  // Start sprite edit mode
  editor.method('picker:sprites:pickFrames', function () {
      if (spriteEditMode) return;

      editor.call('history:add', {
          name: 'add frames',
          undo: endSpriteEditMode,
          redo: startSpriteEditMode
      });

      startSpriteEditMode();
  });

  // Adds picked frames to sprite asset and exits sprite edit mode
  editor.method('picker:sprites:pickFrames:add', function () {
      if (! spriteAsset) return;

      var length = newSpriteFrames.length;
      if (length) {
          var keys = spriteAsset.get('data.frameKeys');
          keys = keys.concat(newSpriteFrames);
          spriteAsset.set('data.frameKeys', keys);
      }

      endSpriteEditMode();
  });

  // Exits sprite edit mode
  editor.method('picker:sprites:pickFrames:cancel', function () {
      endSpriteEditMode();
  });

  // Return selected frame
  editor.method('picker:sprites:selectedFrame', function () {
      return selected;
  });

  // Return highlighted frames
  editor.method('picker:sprites:highlightedFrames', function () {
      return highlightedFrames;
  });

  // Return sprite edit mode picked frames
  editor.method('picker:sprites:newSpriteFrames', function () {
      return newSpriteFrames;
  });

  // Return selected sprite
  editor.method('picker:sprites:selectedSprite', function () {
      return spriteAsset;
  });

  // if the selected sprite is deleted then deselect it
  events.push(editor.on('assets:remove', function (asset) {
      if (spriteAsset && spriteAsset.get('id') === asset.get('id')) {
          selectSprite(null);
      }
  }));

  editor.on('picker:sprites:open', function () {
      atlasAsset = editor.call('picker:sprites:atlasAsset');

      // Delete hotkey to delete selected frames
      editor.call('hotkey:register', 'sprite-editor-delete', {
          key: 'delete',
          callback: function () {
              if (! spriteAsset && highlightedFrames.length) {
                  editor.call('picker:sprites:deleteFrames', highlightedFrames, {
                      history: true
                  });
              }
          }
      });
  });

  editor.on('picker:sprites:close', function () {
      atlasAsset = null;
      selected = null;
      highlightedFrames.length = 0;
      newSpriteFrames.length = 0;
      setSprite(null);

      for (var i = 0; i < events.length; i++) {
          events[i].unbind();
      }
      events.length = 0;

      editor.call('hotkey:unregister', 'sprite-editor-delete');
  });


});


/* editor/pickers/sprite-editor/sprite-editor-render-preview.js */
editor.once('load', function () {
  'use strict';

  var centerPivot = [0.5, 0.5];

  // Renders a frame to the canvas taking into account the size of all the specified frames
  // to determine aspect ratio.
  // - frame: The frame index to render
  // - canvas: The canvas where the preview will be rendered
  // - allFrames: All the frames relevant to this render
  // - animating: If true then the frames pivot will be used otherwise everything will be rendered as if centered
  editor.method('picker:sprites:renderFramePreview', function (frame, canvas, allFrames, animating) {
      var ctx = canvas.getContext('2d');
      var width = canvas.width;
      var height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (! frame || ! frame.pivot || ! frame.rect) {
          return;
      }

      var atlasImage = editor.call('picker:sprites:atlasImage');
      if (! atlasImage) return;

      var x = frame.rect[0];
      // convert bottom left WebGL coord to top left pixel coord
      var y = atlasImage.height - frame.rect[1] - frame.rect[3];
      var w = frame.rect[2];
      var h = frame.rect[3];

      // choose targetWidth and targetHeight keeping the aspect ratio
      var targetWidth = width;
      var targetHeight = height;
      var offsetX = 0;
      var offsetY = 0;

      if (allFrames) {
          var maxHeight = 0;
          var maxWidth = 0;
          var leftBound = Number.POSITIVE_INFINITY;
          var rightBound = Number.NEGATIVE_INFINITY;
          var bottomBound = Number.POSITIVE_INFINITY;
          var topBound = Number.NEGATIVE_INFINITY;
          for (var i = 0, len = allFrames.length; i<len; i++) {
              var f = allFrames[i];
              if (! f) continue;

              if (f._data)
                  f = f._data;

              var pivot = animating ? f.pivot : centerPivot;

              var left = -f.rect[2] * pivot[0];
              var right = (1-pivot[0]) * f.rect[2];
              var bottom = -f.rect[3] * pivot[1];
              var top = (1 - pivot[1]) * f.rect[3];

              leftBound = Math.min(leftBound, left);
              rightBound = Math.max(rightBound, right);
              bottomBound = Math.min(bottomBound, bottom);
              topBound = Math.max(topBound, top);
          }

          maxWidth = rightBound - leftBound;
          maxHeight = topBound - bottomBound;

          var widthFactor = width;
          var heightFactor = height;

          var canvasRatio = width / height;
          var aspectRatio = maxWidth / maxHeight;

          // resize all frames based on aspect ratio of all frames
          // together
          if (canvasRatio > aspectRatio) {
              widthFactor = height * aspectRatio;
          } else {
              heightFactor = width / aspectRatio;
          }

          // calculate x and width
          var pivot = animating ? frame.pivot : centerPivot;
          var left = -frame.rect[2] * pivot[0];
          offsetX = widthFactor * (left - leftBound) / maxWidth;
          targetWidth = widthFactor * frame.rect[2] / maxWidth;

          // calculate y and height
          var top = (1 - pivot[1]) * frame.rect[3];
          offsetY = heightFactor * (1 - (top - bottomBound) / maxHeight);
          targetHeight = heightFactor * frame.rect[3] / maxHeight;

          // center it
          offsetX += (width - widthFactor) / 2;
          offsetY += (height - heightFactor) / 2;
      } else {
          var aspectRatio = w / h;

          if (aspectRatio >= 1) {
              targetHeight = width / aspectRatio;
          } else {
              targetWidth = height * aspectRatio;
          }

          offsetX = (width - targetWidth) / 2;
          offsetY = (height - targetHeight) / 2;
      }


      // disable smoothing
      ctx.mozImageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.msImageSmoothingEnabled = false;
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(atlasImage, x, y, w, h, offsetX, offsetY, targetWidth, targetHeight);
  });

});


/* editor/pickers/sprite-editor/sprite-editor-trim.js */
editor.once('load', function () {
  'use strict';

  editor.on('picker:sprites:open', function () {
      // Trim selected frames
      editor.call('hotkey:register', 'sprite-editor-trim', {
          key: 't',
          callback: function () {
              var spriteAsset = editor.call('picker:sprites:selectedSprite');
              if (spriteAsset) return;

              var highlightedFrames = editor.call('picker:sprites:highlightedFrames');
              if (highlightedFrames.length) {
                  editor.call('picker:sprites:trimFrames', highlightedFrames);
              }
          }
      });

  });

  editor.on('picker:sprites:close', function () {
      editor.call('hotkey:unregister', 'sprite-editor-trim');
  });

  // Trim transparent pixels from specified frames
  editor.method('picker:sprites:trimFrames', function (frames) {
      if (! editor.call('permissions:write')) return;

      var prev = {};

      var frames = frames.slice();
      var atlasAsset = editor.call('picker:sprites:atlasAsset');
      if (! atlasAsset) return;
      var imageData = editor.call('picker:sprites:atlasImageData');
      if (! imageData) return;

      var redo = function () {
          var asset = editor.call('assets:get', atlasAsset.get('id'));
          if (! asset) return;

          var history = asset.history.enabled;
          asset.history.enabled = false;

          var dirty = false;

          var width = atlasAsset.get('meta.width');
          var height = atlasAsset.get('meta.height');

          var frameData = atlasAsset.getRaw('data.frames')._data;
          for (var i = 0, len = frames.length; i<len; i++) {
              var frame = frameData[frames[i]];
              if (! frame) continue;
              frame = frame._data;

              var left = Math.max(0, frame.rect[0]);
              var right = Math.min(frame.rect[0] + frame.rect[2] - 1, width - 1);
              var top = Math.max(0, height - frame.rect[1] - frame.rect[3]);
              var bottom = Math.min(height - frame.rect[1] - 1, height - 1);

              // trim vertically from left to right
              for (var x = left; x<=right; x++) {
                  var foundPixel = false;
                  for (var y = top; y<=bottom; y++) {
                      left = x;
                      if (! isPixelEmpty(x, y, width, imageData)) {
                          foundPixel = true;
                          break;
                      }
                  }

                  if (foundPixel) {
                      break;
                  }
              }

              // trim vertically from right to left
              for (var x = right; x>=left; x--) {
                  var foundPixel = false;
                  for (var y = top; y<=bottom; y++) {
                      right = x;
                      if (! isPixelEmpty(x, y, width, imageData)) {
                          foundPixel = true;
                          break;
                      }
                  }

                  if (foundPixel) {
                      break;
                  }
              }

              // trim horizontally from top to bottom
              for (var y = top; y<=bottom; y++) {
                  var foundPixel = false;
                  for (var x = left; x<=right; x++) {
                      top = y;
                      if (! isPixelEmpty(x, y, width, imageData)) {
                          foundPixel = true;
                          break;
                      }
                  }

                  if (foundPixel) {
                      break;
                  }
              }

              // trim horizontally from bottom to top
              for (var y = bottom; y>=top; y--) {
                  var foundPixel = false;
                  for (var x = left; x<=right; x++) {
                      bottom = y;
                      if (! isPixelEmpty(x, y, width, imageData)) {
                          foundPixel = true;
                          break;
                      }
                  }

                  if (foundPixel) {
                      break;
                  }
              }

              // set new rect
              var l = left;
              var b = height - bottom - 1;
              var w = Math.max(1, right - left + 1); // don't make 0 width/height rects
              var h = Math.max(1, bottom - top + 1);

              if (l !== frame.rect[0] || b !== frame.rect[1] || w !== frame.rect[2] || h !== frame.rect[3]) {
                  dirty = true;
                  prev[frames[i]] = frame.rect.slice();
                  atlasAsset.set('data.frames.' + frames[i] + '.rect', [l,b,w,h]);
              }
          }

          asset.history.enabled = history;

          return dirty;
      };

      var undo = function () {
          var asset = editor.call('assets:get', atlasAsset.get('id'));
          if (! asset) return;

          var history = asset.history.enabled;
          asset.history.enabled = false;
          for (var key in prev) {
              atlasAsset.set('data.frames.' + key + '.rect', prev[key]);
          }
          asset.history.enabled = history;

          prev = {};
      };

      if (redo()) {
          editor.call('history:add', {
              name: 'trim frames',
              undo: undo,
              redo: redo
          });
      }
  });

  var isPixelEmpty = function (x, y, width, imageData) {
      var alpha = y * (width * 4) + x * 4 + 3;
      return imageData.data[alpha] === 0;
  };
});


/* editor/pickers/sprite-editor/sprite-editor-edit-frame.js */
editor.once('load', function () {
  'use strict';

  // Modify frame and make the action undoable
  editor.method('picker:sprites:commitFrameChanges', function (key, frame, oldFrame) {
      if (! editor.call('permissions:write')) return;

      var atlasAsset = editor.call('picker:sprites:atlasAsset');
      if (! atlasAsset) return;

      var newValue = {
          name: frame.name,
          rect: frame.rect.slice(),
          pivot: frame.pivot.slice(),
          border: frame.border.slice()
      };

      // make sure width / height are positive
      if (newValue.rect[2] < 0) {
          newValue.rect[2] = Math.max(1, -newValue.rect[2]);
          newValue.rect[0] -= newValue.rect[2];
      }

      if (newValue.rect[3] < 0) {
          newValue.rect[3] = Math.max(1, -newValue.rect[3]);
          newValue.rect[1] -= newValue.rect[3];
      }

      var redo = function () {
          var asset = editor.call('assets:get', atlasAsset.get('id'));
          if (! asset) return;
          var history = asset.history.enabled;
          asset.history.enabled = false;
          asset.set('data.frames.' + key, newValue);
          asset.history.enabled = history;
      };

      var undo = function () {
          var asset = editor.call('assets:get', atlasAsset.get('id'));
          if (! asset) return;
          var history = asset.history.enabled;
          asset.history.enabled = false;
          if (oldFrame) {
              asset.set('data.frames.' + key, oldFrame);
          } else {
              editor.call('picker:sprites:deleteFrames', [key]);
          }
          asset.history.enabled = history;
      };

      editor.call('history:add', {
          name: 'data.frames.' + key,
          undo: undo,
          redo: redo
      });

      redo();
  });
});


/* editor/pickers/sprite-editor/sprite-editor-delete.js */
editor.once('load', function () {
  'use strict';

  // Delete frames with specified keys from atlas and also
  // remove these frames from any sprite assets that are referencing them
  // Options can be:
  // - history: if true then make this undoable
  editor.method('picker:sprites:deleteFrames', function (keys, options) {
      if (! editor.call('permissions:write')) return;

      var atlasAsset = editor.call('picker:sprites:atlasAsset');
      if (! atlasAsset)
          return;

      var history = options && options.history;
      if (history) {
          // make copy of array to make sure undo / redo works
          keys = keys.slice();
      }

      var numKeys = keys.length;

      if (history) {
          var oldFrames = {};
          for (var i = 0; i < numKeys; i++) {
              oldFrames[keys[i]] = atlasAsset.get('data.frames.' + keys[i]);
          }
      }

      var redo = function () {
          var asset = editor.call('assets:get', atlasAsset.get('id'));
          if (! asset) return;
          var history = asset.history.enabled;
          asset.history.enabled = false;

          for (var i = 0; i < numKeys; i++) {
              asset.unset('data.frames.' + keys[i]);
          }

          editor.call('picker:sprites:selectFrames', null, {
              clearSprite: true
          })

          asset.history.enabled = history;
      };

      if (history) {
          var undo = function () {
              var asset = editor.call('assets:get', atlasAsset.get('id'));
              if (! asset) return;
              var history = asset.history.enabled;
              asset.history.enabled = false;

              for (var i = 0; i < numKeys; i++) {
                  asset.set('data.frames.' + keys[i], oldFrames[keys[i]]);
              }

              editor.call('picker:sprites:selectFrames', keys, {
                  clearSprite: true
              })

              asset.history.enabled = history;

          };

          editor.call('history:add', {
              name: 'delete frames',
              undo: undo,
              redo: redo
          });
      }

      redo();
  });
});

