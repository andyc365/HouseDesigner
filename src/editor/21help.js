
/* editor/help/controls.js */
editor.once('load', function () {
  'use strict';

  var root = editor.call('layout.root');

  var overlay = new ui.Overlay();
  overlay.class.add('help-controls');
  overlay.style.zIndex = 203;
  overlay.center = true;
  overlay.hidden = true;

  overlay.element.addEventListener('mousewheel', function (evt) {
      evt.stopPropagation();
  });

  // header
  var header = new ui.Label({
      unsafe: true,
      text: '<span class="icon">&#57654;</span>Controls'
  });
  header.class.add('header');
  overlay.append(header);

  // close
  var btnClose = new ui.Button();
  btnClose.class.add('close');
  btnClose.text = '&#57650;';
  btnClose.on('click', function () {
      overlay.hidden = true;
  });
  header.element.appendChild(btnClose.element);

  // top image
  var imgTop = new Image();
  imgTop.src = 'https://s3-eu-west-1.amazonaws.com/static.playcanvas.com/images/help-controls.png';
  imgTop.classList.add('top');
  imgTop.draggable = false;
  overlay.append(imgTop);

  var container = new ui.Panel();
  container.class.add('container');
  overlay.append(container);

  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');

  var items = [
      {
          buttons: ['Ctrl', '$+', 'Enter'],
          title: 'Launch',
          icons: ['&#57649;']
      }, {
          buttons: ['Ctrl', '$+', 'E'],
          title: 'New Entity',
          icons: ['&#57632;']
      }, {
          buttons: ['Ctrl', '$+', 'C'],
          title: 'Copy Entity',
          icons: ['&#58193;']
      }, {
          buttons: ['Ctrl', '$+', 'V'],
          title: 'Paste Entity',
          icons: ['&#58184;']
      }, {
          buttons: ['Delete', '$/', 'Ctrl', '$+', 'Backspace'],
          title: 'Delete Selected',
          icons: ['&#57636;']
      }, {
          buttons: ['Ctrl', '$+', 'D'],
          title: 'Duplicate Entity',
          icons: ['&#57638;']
      }, {
          buttons: ['N', '$/', 'F2'],
          title: 'Rename Entity / Asset',
          icons: ['&#57895;'],
      }, {
          buttons: ['F'],
          title: 'Focus on Entity',
          icons: ['&#58120;'],
      }, {
          buttons: ['Shift', '$+', 'Z'],
          title: 'Previous Selection',
          icons: ['&#57671;'],
      }, {
          buttons: ['Ctrl', '$+', 'Z'],
          title: 'Undo',
          icons: ['&#57620;']
      }, {
          buttons: ['Ctrl', '$+', 'Y', '$/', 'Ctrl', '$+', 'Shift', '$+', 'Z'],
          title: 'Redo',
          icons: ['&#57621;']
      }, {
          buttons: ['Ctrl', '$+', 'B'],
          title: 'Bake / Recalculate Lights',
          icons: ['&#57745;']
      }, {
          buttons: ['Space'],
          title: 'Toggle All Panels',
          icons: ['&#57639;']
      }, {
          buttons: ['1', '2', '3'],
          title: 'Translate / Rotate / Scale Gizmo',
          icons: ['&#57618;', '&#57619;', '&#57617;']
      }, {
          buttons: ['L'],
          title: 'Toggle space: World / Local ',
          icons: ['&#57879;']
      }, {
          buttons: ['Shift', '$+', '?'],
          title: 'Controls',
          icons: ['&#57654;']
      }, {
          buttons: ['Alt', '$+', 'A'],
          title: 'Focus on Assets Search Field',
          icons: ['&#57641;']
      }, {
          buttons: ['Ctrl', '$+', 'Space'],
          title: 'How do I...?',
          icons: ['&#57656;']
      }
  ];

  if (!legacyScripts) {
      items.push({
          buttons: ['Ctrl', '$+', 'I'],
          title: 'Open Code Editor',
          icons: ['&#57648;']
      });

      items.push({
          buttons: ['Ctrl', '$+', 'S'],
          title: 'New Checkpoint',
          icons: ['&#58265;']
      });
  }

  for (var i = 0; i < items.length; i++) {
      var row = document.createElement('div');
      row.classList.add('row');

      var buttons = document.createElement('div');
      buttons.classList.add('buttons');
      row.appendChild(buttons);

      for (var n = 0; n < items[i].buttons.length; n++) {
          var button = document.createElement('div');
          var divider = items[i].buttons[n].startsWith('$');
          var sign = '';
          if (divider) sign = items[i].buttons[n].slice(1);

          button.classList.add(divider ? 'divider' : 'button');
          if (sign === '+') button.classList.add('plus');
          if (sign === '/') button.classList.add('or');

          button.textContent = divider ? sign : items[i].buttons[n];
          buttons.appendChild(button);
      }

      var title = document.createElement('div');
      title.classList.add('title');
      title.textContent = items[i].title;
      row.appendChild(title);

      for (var n = 0; n < items[i].icons.length; n++) {
          var icon = document.createElement('div');
          icon.classList.add('icon');
          icon.innerHTML = items[i].icons[n];
          title.appendChild(icon);
      }

      container.append(row);
  }

  root.append(overlay);


  editor.method('help:controls', function () {
      overlay.hidden = false;
  });

  overlay.on('show', function () {
      editor.emit('help:controls:open');
      window.addEventListener('keydown', onKey);

      editor.emit('picker:open', 'controls');
  });

  overlay.on('hide', function () {
      editor.emit('help:controls:close');
      window.removeEventListener('keydown', onKey);

      editor.emit('picker:close', 'controls');
  });

  var onKey = function (e) {
      if (e.keyCode === 27) {
          overlay.hidden = true;
      }
  };

  // hotkey
  editor.call('hotkey:register', 'help:controls', {
      key: 'forward slash',
      shift: true,
      callback: function () {
          editor.call('help:controls');
      }
  });
});


/* editor/help/howdoi.js */
editor.once('load', function () {
  'use strict';

  var viewport = editor.call('layout.viewport');
  var focusedMenuItem = null;
  var settings = editor.call('settings:user');

  // create main panel
  var panel = new ui.Panel();
  panel.class.add('help-howdoi');
  viewport.append(panel);
  panel.hidden = true;

  var settingsLoaded = false;
  var tipsLoaded = false;
  editor.once('help:howdoi:load', function () {
      tipsLoaded = true;
      checkShow();
  });

  editor.once('settings:user:load', function () {
      settingsLoaded = true;
      checkShow();
  });

  var checkShow = function () {
      if (tipsLoaded && settingsLoaded) {
          panel.hidden = !settings.get('editor.howdoi');
      }
  };

  // events when panel is shown
  panel.on('show', function () {
      editor.emit('help:howdoi:open');
      var history = settings.history.enabled;
      settings.history.enabled = false;
      settings.set('editor.howdoi', true);
      settings.history.enabled = history;

      editor.on('scene:name', positionWidget);
      editor.on('viewport:resize', positionWidget);
      positionWidget();
  });

  // events when panel is hidden
  panel.on('hide', function () {
      editor.emit('help:howdoi:close');

      var history = settings.history.enabled;
      settings.history.enabled = false;
      settings.set('editor.howdoi', false);
      settings.history.enabled = history;

      editor.unbind('scene:name', positionWidget);
      editor.unbind('viewport:resize', positionWidget);

      if (!config.self.flags.tips['howdoi'])
          editor.call('guide:bubble:show', 'howdoi', bubble, 200, true);
  });

  // bubble that appears after closing the widget for the first time
  var bubble = function () {
      var bubble = editor.call(
          'guide:bubble',
          'Get more help when you need it',
          "Click here to bring back the help widget whenever you want.",
          40,
          '',
          'bottom',
          editor.call('layout.toolbar')
      );

      bubble.element.style.top = '';
      bubble.element.style.bottom = '164px';
      return bubble;
  };

  // open / close panel depending on settings
  settings.on('editor.howdoi:set', function (value) {
      panel.hidden = !value;
  });

  // input field
  var input = new ui.TextField();
  input.blurOnEnter = false;
  input.renderChanges = false;
  input.keyChange = true;
  input.elementInput.placeholder = 'How do I...?';
  panel.append(input);

  // close button
  var close = new ui.Button({
      text: 'Hide <span class="font-icon" style="position: absolute; top: 0">&#57650;</span>'
  });
  close.class.add('close');
  panel.append(close);

  close.on('click', function () {
      panel.hidden = true;
  });

  // menu with all the suggestions
  var menu = new ui.Menu();
  menu.open = false;
  panel.append(menu);
  menu.elementOverlay.parentElement.removeChild(menu.elementOverlay);

  var suggestions = [];

  // method to register new suggestions
  editor.method('help:howdoi:register', function (data) {

      // create new menu item
      var menuItem = new ui.MenuItem({
          text: data.title
      });

      menu.append(menuItem);

      // add suggestion
      suggestions.push({
          data: data,
          menuItem: menuItem
      });

      // method that opens the popup for this menu item
      var openPopup = function () {
          // store popup event
          storeEvent(input.value, data.title);

          // open popup
          editor.call('help:howdoi:popup', data);
          // reset input value and blur field
          input.value = '';
          input.elementInput.blur();
          // hide menu
          menu.open = false;
      };

      // open popup on mousedown instead of 'click' because
      // for some reason the 'click' event doesn't always work here
      menuItem.element.addEventListener('mousedown', function (e) {
          e.stopPropagation() ;
          openPopup();
      });

      // focus element on mouse enter
      var mouseEnter = function () {
          if (focusedMenuItem && focusedMenuItem !== menuItem.element)
              focusedMenuItem.classList.remove('focused');

          focusedMenuItem = menuItem.element;
          focusedMenuItem.classList.add('focused');

          // remove mouseenter listener until mouseleave fires to prevent
          // an issue with Firefox
          menuItem.element.removeEventListener('mouseenter', mouseEnter);
      };

      menuItem.element.addEventListener('mouseenter', mouseEnter);

      // unfocus element on mouse leave
      var mouseLeave = function () {
          if (focusedMenuItem && focusedMenuItem === menuItem.element) {
              focusedMenuItem.classList.remove('focused');
              focusedMenuItem = null;
          }

          menuItem.element.addEventListener('mouseenter', mouseEnter);
      };

      menuItem.element.addEventListener('mouseleave', mouseLeave);


      // on enter open the popup
      input.elementInput.addEventListener('keydown', function (e) {
          if (e.keyCode === 13) {
              if (focusedMenuItem === menuItem.element) {
                  e.preventDefault();
                  e.stopPropagation();

                  openPopup();
              }
          }
      });

  });

  // on esc delete the input text or hide the widget if no text is there
  input.elementInput.addEventListener('keydown', function (e) {
      if (e.keyCode === 27) {
          if (input.value) {
              storeEvent(input.value);
              input.value = '';
              input.elementInput.focus();
          } else {
              menu.open = false;
          }
      }
  });

  var blurTimeout;
  var focusing = false;

  // on focus open the menu and then refocus the input field
  input.elementInput.addEventListener('focus', function () {
      if (focusing) return;

      focusing = true;
      menu.open = true;

      if (blurTimeout) {
          clearTimeout(blurTimeout);
          blurTimeout = null;
      }

      setTimeout(function () {
          input.elementInput.focus();
          focusing = false;
      });

  });

  // on blur hide the menu
  input.elementInput.addEventListener('blur', function () {
      if (focusing) return;

      menu.open = false;
  });

  // Store event for when viewing (or not viewing) a topic
  var storeEvent = function (search, topic) {
      Ajax.post('/editor/scene/{{scene.id}}/events', {
          name: 'editor:help',
          title: topic,
          text: search
      });
  };

  // filter suggestions as the user types
  input.on('change', function (value) {
      filterSuggestions(value);
  });

  var filterSuggestions = function (text) {
      var valid;

      // sort suggestions by title first
      suggestions.sort(function (a, b) {
          if (a.data.title < b.data.title)
              return -1;

          if (a.data.title > b.data.title)
              return 1;

          if (a.data.title === b.data.title)
              return 0;
      });

      if (text) {
          var query = [];

          // turn each word in a regex
          var words = text.split(' ');
          words.forEach(function (word) {
              word = word.replace(/[^\w]/g, ''); // remove invalid chars
              if (! word.length) return;

              query.push(new RegExp('(^|\\s)' + word.replace(/[^\w]/, ''), 'i'));
          });


          suggestions.forEach(function (suggestion) {
              suggestion.score = 0;
          });

          var matched = suggestions.slice();
          var foundSomeMatches = false;

          // Score suggestions for each word in the text
          // Each word filters the results more and more
          query.forEach(function (q, index) {
              var stageMatches = [];

              matched.forEach(function (suggestion) {
                  // reset score and make menu item hidden
                  if (index === 0) {
                      suggestion.score = 0;
                      suggestion.menuItem.class.add('hidden');
                  }

                  var title = suggestion.data.title;
                  var keywords = suggestion.data.keywords;

                  var score = 0;

                  // match the title and increase score
                  // if match is closer to the start the score is bigger
                  var match = q.exec(title);
                  if (match) {
                      score += 1 / (match.index || 0.1);
                  }

                  // add to the score for each matched keyword
                  for (var i = 0, len = keywords.length; i < len; i++) {
                      match = q.exec(keywords[i]);
                      if (match) {
                          score++;
                      }
                  }

                  // add suggestion to this stage's matches
                  // each subsequent stage has less and less matches
                  if (score) {
                      suggestion.score += score;
                      stageMatches.push(suggestion);
                  }
              });

              if (stageMatches.length === 0) {
                  // if the first few words have no matches then
                  // skip them until we find some matches first
                  if (foundSomeMatches)
                      matched = stageMatches;
              } else {
                  foundSomeMatches = true;
                  matched = stageMatches;
              }
          });

          // sort matches by score
          matched.sort(function (a, b) {
              return b.score - a.score;
          });

          // show matches
          for (i = matched.length - 1; i >= 0; i--) {
              matched[i].menuItem.class.remove('hidden');
              menu.innerElement.insertBefore(matched[i].menuItem.element, menu.innerElement.firstChild);
          }
      } else {
          // show all suggestions
          for (i = suggestions.length - 1; i >= 0; i--) {
              suggestions[i].menuItem.class.remove('hidden');
              menu.innerElement.insertBefore(suggestions[i].menuItem.element, menu.innerElement.firstChild);
          }

      }

  };


  // handle clicking outside menu in order to close it
  var click = function (e) {
      var parent = e.target;
      while (parent) {
          if (parent === panel.innerElement) {
              input.elementInput.focus();
              return;
          }

          parent = parent.parentElement;
      }

      menu.open = false;
  };

  // handle arrow keys to focus next / previous suggestion
  var key = function (e) {
      var result;

      // up arrow
      if (e.keyCode === 38) {
          result = focusNextSuggestion(false);
      }
      // down arrow
      else if (e.keyCode === 40) {
          result = focusNextSuggestion(true);
      }

      if (result) {
          e.preventDefault();
          e.stopPropagation();
      }
  };

  // Focus next or previous suggestion
  var focusNextSuggestion = function (forward) {
      var next = forward ? menu.innerElement.firstChild : menu.innerElement.lastChild;
      if (focusedMenuItem) {
          focusedMenuItem.classList.remove('focused');

          if (forward) {
              if (focusedMenuItem.nextSibling)
                  next = focusedMenuItem.nextSibling;
          } else {
              if (focusedMenuItem.previousSibling)
                  next = focusedMenuItem.previousSibling;
          }
      }

      var valueBeforeLoop = next;

      while (next.classList.contains('hidden')) {
          if (forward) {
              next = next.nextSibling || menu.innerElement.firstChild;
          } else {
              next =  next.previousSibling || menu.innerElement.lastChild;
          }

          if (next === valueBeforeLoop) // avoid infinite loop
              return;
      }

      focusedMenuItem = next;
      focusedMenuItem.classList.add('focused');

      // scroll into view if needed
      var focusedRect = focusedMenuItem.getBoundingClientRect();
      var menuRect = menu.innerElement.getBoundingClientRect();

      if (focusedRect.bottom > menuRect.bottom)
          menu.innerElement.scrollTop += focusedRect.bottom - menuRect.bottom;
      else if (focusedRect.top < menuRect.top) {
          menu.innerElement.scrollTop -= menuRect.top - focusedRect.top;
      }

      return true;
  };

  // handle open event
  menu.on('open', function (open) {
      if (open) {
          window.addEventListener('click', click);
          window.addEventListener('keydown', key);
          input.class.add('focus');
          menu.innerElement.scrollTop = 0;
          close.hidden = true;

          filterSuggestions();
      }
      else {
          window.removeEventListener('click', click);
          window.removeEventListener('keydown', key);
          input.class.remove('focus');
          if (focusedMenuItem) {
              focusedMenuItem.classList.remove('focused');
              focusedMenuItem = null;
          }
          close.hidden = false;

          if (input.value)
              storeEvent(input.value);

          input.value = '';
      }

  });

  var toggleWidget = function (toggle) {
      panel.hidden = !toggle;
      if (toggle) {
          setTimeout(function () {
              input.elementInput.focus();
          });
      }
  };

  // method to show the widget
  editor.method('help:howdoi', function () {
      toggleWidget(true);
  });

  // method to toggle the widget
  editor.method('help:howdoi:toggle', function () {
      toggleWidget(panel.hidden);
  });

  // hotkey
  editor.call('hotkey:register', 'help:howdoi', {
      key: 'space',
      ctrl: true,
      callback: function() {
          if (editor.call('picker:isOpen:otherThan', 'curve')) return;
          editor.call('help:howdoi');
      }
  });

  // position widget between top elements in viewport
  var positionWidget = function () {
      var canvas = editor.call('viewport:canvas');
      if (! canvas) return;

      var canvasRect = canvas.element.getBoundingClientRect();

      var titleWidget = document.querySelector('.widget-title');
      var titleWidgetRect = titleWidget ? titleWidget.getBoundingClientRect() : null;

      var topLeftWidth = titleWidgetRect ? titleWidgetRect.right - canvasRect.left : 0;

      var topControls = document.querySelector('.viewport-camera');
      var topControlsRect = topControls ? topControls.getBoundingClientRect() : null;

      var topRightWidth = topControlsRect ? canvasRect.left + canvasRect.width - topControlsRect.left : 0;

      var width = canvasRect.width - topLeftWidth - topRightWidth - 20;
      if (width < 150) {
          panel.class.add('hidden');
      } else {
          panel.class.remove('hidden');

          if (width > 400)
              width = 400;
      }


      panel.style.width = width + 'px';
      panel.style.left = (topLeftWidth + (((topControlsRect.left - titleWidgetRect.right) - width) / 2)) + 'px';
  };

});


/* editor/help/howdoi-popup.js */
editor.once('load', function () {
  'use strict';

  var root = editor.call('layout.root');
  var overlay = new ui.Overlay();
  overlay.class.add('help-howdoi');
  overlay.hidden = true;
  overlay.clickable = true;
  root.append(overlay);

  var panel = new ui.Panel();
  overlay.append(panel);

  var content = new ui.Label({
      unsafe: true
  });
  content.renderChanges = false;
  panel.append(content);

  var docs = new ui.Button({
      text: 'View Docs'
  });
  docs.class.add('docs');
  panel.append(docs);
  docs.hidden = true;

  var key = function (e) {
      // close on esc
      if (e.keyCode === 27) {
          overlay.hidden = true;
      }
  };

  overlay.on('show', function () {
      editor.emit('help:howdoi:popup:open');
      window.addEventListener('keydown', key);
  });

  overlay.on('hide', function () {
      window.removeEventListener('keydown', key);
      editor.emit('help:howdoi:popup:close');
  });


  editor.method('help:howdoi:popup', function (data) {
      overlay.hidden = false;
      content.text = data.text;

      setTimeout(function () {
          var closeButton = panel.innerElement.querySelector('.close');
          if (closeButton)
              closeButton.addEventListener('click', function () {
                  overlay.hidden = true;
              });
      });
  });

});


/* editor/help/howdoi-load.js */
editor.once('load', function () {
  var data = {
      url: config.url.howdoi,
      method: 'GET'
  };

  Ajax(data)
  .on('load', function(status, data) {
      if (! data || !data.length)
          return;

      data.forEach(function (tip) {
          editor.call('help:howdoi:register', {
              title: tip.title,
              text: tip.html,
              keywords: tip.keywords
          });
      });

      editor.emit('help:howdoi:load');
  })
  .on('error', function(status, data) {
      console.error(status);
  });
});

/* editor/demo_project.js */
// if you have loading the Demo Ball project for the first time
// we show a splash screen with some simple instructions
editor.once('load', function() {
  'use strict';

  if (editor.call('users:hasOpenedEditor')) {
      return;
  }

  if (config.project.name !== 'My First Project')
      return;

  // do not show if not owner
  if (config.owner.id !== config.self.id)
      return;

  var root = editor.call('layout.root');

  // overlay
  var overlay = new ui.Overlay();
  overlay.hidden = true;
  overlay.clickable = true;
  overlay.class.add('demo');
  root.append(overlay);

  // panel
  var panel = new ui.Panel();
  overlay.append(panel);

  // contents
  var header = new ui.Label({
      text: "Editor Intro"
  });
  header.class.add('header');
  panel.append(header);

  var main = new ui.Label({
      text: "To help you learn PlayCanvas we've created your first project. It's a simple ball rolling game. Complete the design of the level by adding an extra platform, then design your own levels.<br/><br/>We'll pop up some tips to help you along the way.",
      unsafe: true
  });
  main.class.add('main');
  panel.append(main);

  var close = new ui.Button({
      text: "LET'S GO"
  });
  close.class.add('close');
  panel.append(close);
  close.on('click', function () {
      overlay.hidden = true;
  });

  editor.once('scene:raw', function() {
      overlay.hidden = false;
  });

  overlay.on('show', function () {
      editor.emit('help:demo:show');
  });

  overlay.on('hide', function () {
      editor.emit('help:demo:close');
  });
});
