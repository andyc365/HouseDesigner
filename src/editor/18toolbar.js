

/* editor/toolbar/toolbar.js */
editor.once('load', function() {
  'use strict';

  var toolbar = editor.call('layout.toolbar');
});


/* editor/toolbar/toolbar-logo.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var toolbar = editor.call('layout.toolbar');
  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');


  var logo = new ui.Button();
  logo.class.add('logo');
  logo.on('click', function() {
      menu.open = true;
  });
  toolbar.append(logo);

  var componentsLogos = {
      'animation': '&#57875;',
      'audiolistener': '&#57750;',
      'audiosource': '&#57751;',
      'camera': '&#57874;',
      'collision': '&#57735;',
      'light': '&#57748;',
      'model': '&#57736;',
      'particlesystem': '&#57753;',
      'rigidbody': '&#57737;',
      'script': '&#57910;'
  };

  var hasLegacyScript = function (entity, url) {
      var scriptComponent = entity.get('components.script');
      if (scriptComponent) {
          for (var i = 0; i < scriptComponent.scripts.length; i++) {
              if (scriptComponent.scripts[i].url === url) {
                  return true;
              }
          }
      }

      return false;
  };

  var setField = function(items, field, value) {
      var records = [ ];

      for(var i = 0; i < items.length; i++) {
          records.push({
              get: items[i].history._getItemFn,
              value: value,
              valueOld: items[i].get(field)
          });

          items[i].history.enabled = false;
          items[i].set(field, value);
          items[i].history.enabled = true;
      }

      editor.call('history:add', {
          name: 'entities.set[' + field + ']',
          undo: function() {
              for(var i = 0; i < records.length; i++) {
                  var item = records[i].get();
                  if (! item)
                      continue;

                  item.history.enabled = false;
                  item.set(field, records[i].valueOld);
                  item.history.enabled = true;
              }
          },
          redo: function() {
              for(var i = 0; i < records.length; i++) {
                  var item = records[i].get();
                  if (! item)
                      continue;

                  item.history.enabled = false;
                  item.set(field, records[i].value);
                  item.history.enabled = true;
              }
          }
      });
  };

  var addBultinLegacyScript = function (entity, url) {
      var resourceId = entity.get('resource_id');

      var addedComponent = false;

      var action = {
          name: 'entity.' + resourceId + '.builtinscript',
          combine: false,
          undo: function () {
              var e = editor.call('entities:get', resourceId);
              if (! e) return;

              var history = e.history.enabled;
              e.history.enabled = false;

              if (addedComponent) {
                  e.unset('components.script');
              } else {
                  var scripts = e.get('components.script.scripts');
                  if (scripts) {
                      for (var i = 0; i < scripts.length; i++) {
                          if (scripts[i].url === url) {
                              e.remove('components.script.scripts', i);
                              break;
                          }
                      }
                  }
              }

              e.history.enabled = history;
          },
          redo: function () {
              var e = editor.call('entities:get', resourceId);
              if (! e) return;

              var history = e.history.enabled;
              e.history.enabled = false;

              if (!e.get('components.script')) {
                  editor.call('entities:addComponent', [e], 'script');
                  addedComponent = true;
              }

              // add script
              var script = new Observer({
                  url: url
              });
              e.insert('components.script.scripts', script);

              e.history.enabled = history;

              // scan script
              editor.call('sourcefiles:scan', url, function (data) {
                  e.history.enabled = false;

                  data.url = url;
                  script.patch(data);

                  e.history.enabled = history;
              });
          }
      };

      // perform action
      action.redo();

      // raise history event
      entity.history.emit('record', 'add', action);
  };

  var menuData = {
      'entity': {
          title: 'Entity',
          filter: function() {
              return editor.call('selector:type') === 'entity' && editor.call('permissions:write');
          },
          items: {
              'new-entity': {
                  title: 'New Entity',
                  filter: function () {
                      return editor.call('selector:items').length === 1;
                  },
                  select: function () {
                      editor.call('entities:new', {parent: editor.call('entities:selectedFirst')});
                  },
                  items: editor.call('menu:entities:new')
              },
              'add-component': {
                  title: 'Add Component',
                  filter: function() {
                      return editor.call('selector:type') === 'entity';
                  },
                  items: editor.call('menu:entities:add-component')
              }
          }
      },
      'edit': {
          title: 'Edit',
          filter: function() {
              return editor.call('permissions:write');
          },
          items: {
              'undo': {
                  title: 'Undo',
                  icon: '&#57620;',
                  filter: function() {
                      return editor.call('history:canUndo');
                  },
                  select: function() {
                      editor.call('history:undo');
                  }
              },
              'redo': {
                  title: 'Redo',
                  icon: '&#57621;',
                  filter: function() {
                      return editor.call('history:canRedo');
                  },
                  select: function() {
                      editor.call('history:redo');
                  }
              },
              'enable': {
                  title: 'Enable',
                  icon: '&#57651;',
                  filter: function() {
                      if (! editor.call('permissions:write'))
                          return false;

                      return editor.call('selector:type') === 'entity';
                  },
                  hide: function () {
                      var type = editor.call('selector:type');
                      if (type !== 'entity')
                          return true;

                      var items = editor.call('selector:items');

                      if (items.length === 1) {
                          return items[0].get('enabled');
                      } else {
                          var enabled = items[0].get('enabled');
                          for(var i = 1; i < items.length; i++) {
                              if (enabled !== items[i].get('enabled'))
                                  return false;
                          }
                          return enabled;
                      }
                  },
                  select: function() {
                      setField(editor.call('selector:items'), 'enabled', true);
                  }
              },
              'disable': {
                  title: 'Disable',
                  icon: '&#57650;',
                  filter: function() {
                      if (! editor.call('permissions:write'))
                          return false;

                      return editor.call('selector:type') === 'entity';
                  },
                  hide: function () {
                      var type = editor.call('selector:type');
                      if (type !== 'entity')
                          return true;

                      var items = editor.call('selector:items');

                      if (items.length === 1) {
                          return ! items[0].get('enabled');
                      } else {
                          var disabled = items[0].get('enabled');
                          for(var i = 1; i < items.length; i++) {
                              if (disabled !== items[i].get('enabled'))
                                  return false;
                          }
                          return ! disabled;
                      }
                  },
                  select: function() {
                      setField(editor.call('selector:items'), 'enabled', false);
                  }
              },
              'copy': {
                  title: 'Copy',
                  icon: '&#58193;',
                  filter: function () {
                      if (! editor.call('permissions:write'))
                          return false;

                      return editor.call('selector:type') === 'entity' && editor.call('selector:items').length;
                  },
                  select: function () {
                      var items = editor.call('selector:items');
                      editor.call('entities:copy', items);
                  }
              },
              'paste': {
                  title: 'Paste',
                  icon: '&#58184;',
                  filter: function () {
                      if (! editor.call('permissions:write'))
                          return false;

                      if (! editor.call('entities:clipboard:empty')) {
                          var items = editor.call('selector:items');
                          if (items.length === 0 || items.length === 1 && editor.call('selector:type') === 'entity') {
                              return true;
                          }
                      }

                      return false;
                  },
                  select: function () {
                      var items = editor.call('selector:items');
                      editor.call('entities:paste', items[0]);
                  }
              },
              'edit': {
                  title: 'Edit',
                  icon: '&#57648;',
                  filter: function() {
                      var type = editor.call('selector:type');
                      if (! type || type !== 'asset')
                          return false;

                      var items = editor.call('selector:items');
                      return items.length === 1 && ['html', 'css', 'json', 'text', 'script', 'shader'].indexOf(items[0].get('type')) !== -1;
                  },
                  select: function() {
                      var type = editor.call('selector:type');
                      if (! type || type !== 'asset') return;
                      var items = editor.call('selector:items');

                      editor.call('assets:edit', items[0]);
                  }
              },
              'duplicate': {
                  title: 'Duplicate',
                  icon: '&#57638;',
                  filter: function() {
                      if (! editor.call('permissions:write'))
                          return false;

                      var type = editor.call('selector:type');
                      if (! type)
                          return false;

                      var items = editor.call('selector:items');

                      if (type === 'entity') {
                          if (items.indexOf(editor.call('entities:root')) !== -1)
                              return false;

                          return items.length > 0;
                      } else if (type === 'asset') {
                          return items.length === 1 && items[0].get('type') === 'material';
                      } else {
                          return false;
                      }
                  },
                  select: function() {
                      var type = editor.call('selector:type');
                      if (! type) return;
                      var items = editor.call('selector:items');

                      if (type === 'entity') {
                          editor.call('entities:duplicate', items);
                      } else if (type === 'asset') {
                          editor.call('assets:duplicate', items[0]);
                      }
                  }
              },
              'delete': {
                  title: 'Delete',
                  icon: '&#57636;',
                  filter: function() {
                      if (! editor.call('permissions:write'))
                          return false;

                      var type = editor.call('selector:type');
                      if (!type) return false;

                      if (type === 'entity') {
                          var root = editor.call('entities:root');
                          var items = editor.call('selector:items');
                          for (var i = 0; i < items.length; i++) {
                              if (items[i] === root) {
                                  return false;
                              }
                          }
                      }

                      return true;
                  },
                  select: function() {
                      var type = editor.call('selector:type');
                      if (! type) return;
                      var items = editor.call('selector:items');

                      if (type === 'entity') {
                          var root = editor.call('entities:root');
                          if (items.indexOf(root) !== -1)
                              return;
                          editor.call('entities:delete', items);
                      } else if (type === 'asset') {
                          editor.call('assets:delete:picker', items);
                      }
                  }
              }
          }
      },
      'launch': {
          title: 'Launch',
          select: function() {
              editor.call('launch');
          },
          items: {
              'launch-remote': {
                  title: 'Launch',
                  icon: '&#57649;',
                  select: function() {
                      editor.call('launch', 'default');
                  }
              }
          }
      },
      'help': {
          title: 'Help',
          items: {
              'controls': {
                  title: 'Controls',
                  icon: '&#57654;',
                  select: function() {
                      editor.call('help:controls');
                  }
              },
              'reference': {
                  title: 'Reference',
                  icon: '&#57906;',
                  select: function() {
                      window.open('http://developer.playcanvas.com/en/engine/api/stable/');
                  }
              },
              'learn': {
                  title: 'Learn',
                  icon: '&#57906;',
                  select: function() {
                      window.open('http://developer.playcanvas.com/en/');
                  }
              },
              'forum': {
                  title: 'Forum',
                  icon: '&#57907;',
                  select: function() {
                      window.open('http://forum.playcanvas.com/');
                  }
              },
              'answers': {
                  title: 'Answers',
                  icon: '&#57656;',
                  select: function() {
                      window.open('http://answers.playcanvas.com/');
                  }
              },
              'howdoi': {
                  title: 'How do I...',
                  icon: '&#57656;',
                  select: function () {
                      editor.call('help:howdoi');
                  }
              },
              'resetTips': {
                  title: 'Reset Tips',
                  icon: '&#57656;',
                  select: function () {
                      editor.call('editor:tips:reset');
                  }
              }
          }
      },
      'scenes': {
          title: 'Scenes',
          icon: '&#57671;',
          select: function() {
              editor.call('picker:scene');
          }
      },
      'publishing': {
          title: 'Publishing',
          icon: '&#57911;',
          select: function() {
              editor.call('picker:publish');
          }
      },
      'version-control': {
          title: 'Version Control',
          icon: '&#58265;',
          hide: function () {
              return config.project.settings.useLegacyScripts || ! editor.call('permissions:read');
          },
          select: function() {
              editor.call('picker:versioncontrol');
          }
      },
      'bake': {
          title: 'Bake LightMaps',
          icon: '&#57745;',
          select: function() {
              editor.call('lightmapper:bake');
              editor.call('entities:shadows:update');
          }
      },
      'code-editor': {
          title: 'Code Editor',
          icon: '&#57648;',
          hide: function () {
              return editor.call('settings:project').get('useLegacyScripts');
          },
          select: function () {
              editor.call('picker:codeeditor');
          }
      },
      'settings': {
          title: 'Settings',
          icon: '&#57652;',
          filter: function() {
              return editor.call('selector:type') !== 'editorSettings' && ! editor.call('viewport:expand:state');
          },
          select: function() {
              editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
          }
      },
      'priorityScripts': null,
      'feedback': {
          title: 'Feedback',
          icon: '&#57625;',
          select: function() {
              window.open('http://forum.playcanvas.com/t/playcanvas-editor-feedback/616');
          }
      }
  };

  if (legacyScripts) {
      menuData['entity']['items']['add-builtin-script'] = {
          title: 'Add Built-In Script',
          filter: function () {
              return editor.call('selector:type') === 'entity';
          },
          items: {
              'post-effects': {
                  title: 'Post-Effects',
                  filter: function () {
                      return editor.call('selector:type') === 'entity';
                  },
                  items: {}
              },
              'camera-scripts': {
                  title: 'Camera',
                  filter: function () {
                      return editor.call('selector:type') === 'entity';
                  },
                  items: {}
              }
          }
      };

      menuData['priorityScripts'] = {
          title: 'Script Priority',
          icon: '&#57652;',
          filter: function() {
              return editor.call('permissions:write');
          },
          select: function() {
              editor.call('sceneSettings:priorityScripts');
          }
      };
  } else {
      // TODO scripts2
      // add built-in-scripts for new system

      menuData['priorityScripts'] = {
          title: 'Scripts Loading Order',
          icon: '&#57652;',
          filter: function() {
              return editor.call('permissions:write');
          },
          select: function() {
              editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
              setTimeout(function() {
                  editor.call('editorSettings:panel:unfold', 'scripts-order');
              }, 0);
          }
      };
  }

  if (legacyScripts) {
      var builtInScripts = [{
          group: 'post-effects',
          title: 'Bloom',
          name: 'posteffect-bloom',
          url: 'https://code.playcanvas.com/posteffects/posteffect_bloom.js',
          requires: 'camera'
      }, {
          group: 'post-effects',
          title: 'Bloom',
          name: 'posteffect-bloom',
          url: 'https://code.playcanvas.com/posteffects/posteffect_bloom.js',
          requires: 'camera'
      }, {
          group: 'post-effects',
          title: 'Bloom',
          name: 'posteffect-bloom',
          url: 'https://code.playcanvas.com/posteffects/posteffect_bloom.js',
          requires: 'camera'
      }, {
          group: 'post-effects',
          title: 'Brightness-Contrast',
          name: 'posteffect-brightnesscontrast',
          url: 'https://code.playcanvas.com/posteffects/posteffect_brightnesscontrast.js',
          requires: 'camera'
      }, {
          group: 'post-effects',
          title: 'Hue-Saturation',
          name: 'posteffect-huesaturation',
          url: 'https://code.playcanvas.com/posteffects/posteffect_huesaturation.js',
          requires: 'camera'
      }, {
          group: 'post-effects',
          title: 'FXAA',
          name: 'posteffect-fxaa',
          url: 'https://code.playcanvas.com/posteffects/posteffect_fxaa.js',
          requires: 'camera'
      }, {
          group: 'post-effects',
          title: 'Sepia',
          name: 'posteffect-sepia',
          url: 'https://code.playcanvas.com/posteffects/posteffect_sepia.js',
          requires: 'camera'
      }, {
          group: 'post-effects',
          title: 'Vignette',
          name: 'posteffect-vignette',
          url: 'https://code.playcanvas.com/posteffects/posteffect_vignette.js',
          requires: 'camera'
      }, {
          group: 'camera-scripts',
          title: 'Fly Camera',
          name: 'camera-fly',
          url: 'https://code.playcanvas.com/camera/camera_fly.js',
          requires: 'camera'
      }];

      builtInScripts.forEach(function (data) {
          menuData['entity'].items['add-builtin-script'].items[data.group].items[data.name] = {
              title: data.title,
              filter: function () {
                  var entity = editor.call('selector:items')[0];

                  return editor.call('selector:type') === 'entity' &&
                         editor.call('permissions:write') &&
                         !hasLegacyScript(entity, data.url) &&
                         (!data.requires || entity.get('components.' + data.requires));
              },
              select: function () {
                  var entity = editor.call('selector:items')[0];
                  addBultinLegacyScript(entity, data.url);
              }
          };
      });
  }

  var root = editor.call('layout.root');

  var menu = ui.Menu.fromData(menuData);
  menu.position(45, 0);
  root.append(menu);

  var tooltip = Tooltip.attach({
      target: logo.element,
      text: 'Menu',
      align: 'left',
      root: root
  });
  menu.on('open', function(state) {
      tooltip.disabled = state;
  });

  // get part of menu data
  editor.method('menu:get', function (name) {
      return menuData[name];
  });
});


/* editor/toolbar/toolbar-editor-settings.js */
editor.once('load', function() {
  'use strict';

  var toolbar = editor.call('layout.toolbar');

  // settings button
  var button = new ui.Button({
      text: '&#57652;'
  });
  button.class.add('pc-icon', 'editor-settings', 'bottom');
  toolbar.append(button);

  button.on('click', function() {
      editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
  });

  editor.on('attributes:clear', function() {
      button.class.remove('active');
  });

  editor.on('attributes:inspect[editorSettings]', function() {
      editor.call('attributes.rootPanel').collapsed = false;

      button.class.add('active');
  });

  editor.on('viewport:expand', function(state) {
      button.disabled = state;
  });

  Tooltip.attach({
      target: button.element,
      text: 'Settings',
      align: 'left',
      root: editor.call('layout.root')
  });
});


/* editor/toolbar/toolbar-contact.js */
editor.once('load', function() {
  'use strict';

  var toolbar = editor.call('layout.toolbar');

  var contact = new ui.Button({
      text: '&#57625;'
  });
  contact.class.add('pc-icon', 'contact', 'bottom');
  toolbar.append(contact);

  Tooltip.attach({
      target: contact.element,
      text: 'Feedback',
      align: 'left',
      root: editor.call('layout.root')
  });

  contact.on('click', function() {
      window.open('http://forum.playcanvas.com/t/playcanvas-editor-feedback/616');
  });
});


/* editor/toolbar/toolbar-controls.js */
editor.once('load', function() {
  'use strict';

  var toolbar = editor.call('layout.toolbar');

  var button = new ui.Button({
      text: '&#57654;'
  });
  button.class.add('pc-icon', 'help-controls', 'bottom');
  toolbar.append(button);

  button.on('click', function() {
      editor.call('help:controls');
  });

  editor.on('help:controls:open', function () {
      button.class.add('active');
  });

  editor.on('help:controls:close', function () {
      button.class.remove('active');
  });

  Tooltip.attach({
      target: button.element,
      text: 'Controls',
      align: 'left',
      root: editor.call('layout.root')
  });
});


/* editor/toolbar/toolbar-help.js */
editor.once('load', function() {
  'use strict';

  var toolbar = editor.call('layout.toolbar');

  var button = new ui.Button({
      text: '&#57656;'
  });
  button.class.add('pc-icon', 'help-howdoi', 'bottom', 'push-top');
  toolbar.append(button);

  button.on('click', function() {
      editor.call('help:howdoi:toggle');
  });

  editor.on('help:howdoi:open', function () {
      button.class.add('active');
  });

  editor.on('help:howdoi:close', function () {
      button.class.remove('active');
  });

  Tooltip.attach({
      target: button.element,
      text: 'How do I...?',
      align: 'left',
      root: editor.call('layout.root')
  });
});


/* editor/toolbar/toolbar-gizmos.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var toolbar = editor.call('layout.toolbar');

  var activeGizmo = null;
  var gizmoButtons = { };

  // create gizmo type buttons
  [{
      icon: '&#57617;',
      tooltip: 'Translate',
      op: 'translate'
  }, {
      icon: '&#57619;',
      tooltip: 'Rotate',
      op: 'rotate'
  }, {
      icon: '&#57618;',
      tooltip: 'Scale',
      op: 'scale'
  }, {
      icon: '&#57666;',
      tooltip: 'Resize Element Component',
      op: 'resize'
  }].forEach(function (item, index) {
      var button = new ui.Button({
          text: item.icon
      });
      button.hidden = ! editor.call('permissions:write');
      button.op = item.op;
      button.class.add('pc-icon');

      gizmoButtons[item.op] = button;

      button.on('click', function () {
          if (activeGizmo.op === this.op)
              return;

          activeGizmo.class.remove('active');
          activeGizmo.tooltip.class.add('innactive');
          activeGizmo = this;
          activeGizmo.class.add('active');
          activeGizmo.tooltip.class.remove('innactive');

          editor.call('gizmo:type', this.op);
      });

      toolbar.append(button);

      button.tooltip = Tooltip.attach({
          target: button.element,
          text: item.tooltip,
          align: 'left',
          root: root
      });

      if (item.op === 'translate') {
          activeGizmo = button;
          button.class.add('active');
      } else {
          button.tooltip.class.add('innactive');
      }
  });

  // coordinate system
  var buttonWorld = new ui.Button({
      text: '&#57624;'
  });
  buttonWorld.hidden = ! editor.call('permissions:write');
  buttonWorld.class.add('pc-icon', 'active');
  toolbar.append(buttonWorld);

  buttonWorld.on('click', function () {
      if (this.class.contains('active')) {
          this.class.remove('active');
          tooltipWorld.html = 'World / <span style="color:#fff">Local</span>';
      } else {
          this.class.add('active');
          tooltipWorld.html = '<span style="color:#fff">World</span> / Local';
      }
      editor.call('gizmo:coordSystem', this.class.contains('active') ? 'world' : 'local');
  });

  var tooltipWorld = Tooltip.attach({
      target: buttonWorld.element,
      align: 'left',
      root: root
  });
  tooltipWorld.html = '<span style="color:#fff">World</span> / Local';
  tooltipWorld.class.add('innactive');


  // toggle grid snap
  var buttonSnap = new ui.Button({
      text: '&#57622;'
  });
  buttonSnap.hidden = ! editor.call('permissions:write');
  buttonSnap.class.add('pc-icon');
  buttonSnap.on('click', function () {
      if (this.class.contains('active')) {
          this.class.remove('active');
          tooltipSnap.class.add('innactive');
      } else {
          this.class.add('active');
          tooltipSnap.class.remove('innactive');
      }
      editor.call('gizmo:snap', this.class.contains('active'));
  });
  toolbar.append(buttonSnap);

  var tooltipSnap = Tooltip.attach({
      target: buttonSnap.element,
      text: 'Snap',
      align: 'left',
      root: root
  });
  tooltipSnap.class.add('innactive');


  editor.on('permissions:writeState', function(state) {
      for(var key in gizmoButtons) {
          gizmoButtons[key].hidden = ! state;
      }

      buttonWorld.hidden = ! state;
      buttonSnap.hidden = ! state;
  });


  // focus on entity
  var buttonFocus = new ui.Button({
      text: '&#57623;'
  });
  buttonFocus.disabled = true;
  buttonFocus.class.add('pc-icon');
  buttonFocus.on('click', function() {
      editor.call('viewport:focus');
  });
  toolbar.append(buttonFocus);

  editor.on('attributes:clear', function() {
      buttonFocus.disabled = true;
      tooltipFocus.class.add('innactive');
  });
  editor.on('attributes:inspect[*]', function(type) {
      buttonFocus.disabled = type !== 'entity';
      if (type === 'entity') {
          tooltipFocus.class.remove('innactive');
      } else {
          tooltipFocus.class.add('innactive');
      }
  });

  var tooltipFocus = Tooltip.attach({
      target: buttonFocus.element,
      text: 'Focus',
      align: 'left',
      root: root
  });
  tooltipFocus.class.add('innactive');


  // translate hotkey
  editor.call('hotkey:register', 'gizmo:translate', {
      key: '1',
      callback: function() {
          if (editor.call('picker:isOpen:otherThan', 'curve')) return;
          gizmoButtons['translate'].emit('click');
      }
  });

  // rotate hotkey
  editor.call('hotkey:register', 'gizmo:rotate', {
      key: '2',
      callback: function() {
          if (editor.call('picker:isOpen:otherThan', 'curve')) return;
          gizmoButtons['rotate'].emit('click');
      }
  });

  // scale hotkey
  editor.call('hotkey:register', 'gizmo:scale', {
      key: '3',
      callback: function() {
          if (editor.call('picker:isOpen:otherThan', 'curve')) return;
          gizmoButtons['scale'].emit('click');
      }
  });

  // resize hotkey
  editor.call('hotkey:register', 'gizmo:resize', {
      key: '4',
      callback: function() {
          if (editor.call('picker:isOpen:otherThan', 'curve')) return;
          gizmoButtons['resize'].emit('click');
      }
  });

  // world/local hotkey
  editor.call('hotkey:register', 'gizmo:world', {
      key: 'l',
      callback: function() {
          if (editor.call('picker:isOpen:otherThan', 'curve')) return;
          buttonWorld.emit('click');
      }
  });

  // focus
  editor.call('hotkey:register', 'viewport:focus', {
      key: 'f',
      callback: function() {
          if (editor.call('picker:isOpen:otherThan', 'curve')) return;
          editor.call('viewport:focus');
      }
  });
});


/* editor/toolbar/toolbar-history.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var toolbar = editor.call('layout.toolbar');


  // undo
  var buttonUndo = new ui.Button({
      text: '&#57620;'
  });
  buttonUndo.hidden = ! editor.call('permissions:write');
  buttonUndo.class.add('pc-icon');
  buttonUndo.enabled = editor.call('history:canUndo');
  toolbar.append(buttonUndo);

  editor.on('history:canUndo', function(state) {
      buttonUndo.enabled = state;
      if (state) {
          tooltipUndo.class.remove('innactive');
      } else {
          tooltipUndo.class.add('innactive');
      }
  });
  buttonUndo.on('click', function() {
      editor.call('history:undo');
  });

  var tooltipUndo = Tooltip.attach({
      target: buttonUndo.element,
      text: 'Undo',
      align: 'left',
      root: root
  });
  if (! editor.call('history:canUndo'))
      tooltipUndo.class.add('innactive');


  // redo
  var buttonRedo = new ui.Button({
      text: '&#57621;'
  });
  buttonRedo.hidden = ! editor.call('permissions:write');
  buttonRedo.class.add('pc-icon');
  buttonRedo.enabled = editor.call('history:canRedo');
  toolbar.append(buttonRedo);

  editor.on('history:canRedo', function(state) {
      buttonRedo.enabled = state;
      if (state) {
          tooltipRedo.class.remove('innactive');
      } else {
          tooltipRedo.class.add('innactive');
      }
  });
  buttonRedo.on('click', function() {
      editor.call('history:redo');
  });

  var tooltipRedo = Tooltip.attach({
      target: buttonRedo.element,
      text: 'Redo',
      align: 'left',
      root: root
  });
  if (! editor.call('history:canUndo'))
      tooltipRedo.class.add('innactive');

  editor.on('permissions:writeState', function(state) {
      buttonUndo.hidden = buttonRedo.hidden = ! state;
  });
});





/* editor/toolbar/toolbar-lightmapper.js */
editor.once('load', function() {
  'use strict';

  var app;
  var root = editor.call('layout.root');
  var toolbar = editor.call('layout.toolbar');

  // coordinate system
  var buttonBake = new ui.Button({
      text: '&#57745;'
  });
  buttonBake.class.add('pc-icon', 'light-mapper');
  toolbar.append(buttonBake);

  buttonBake.on('click', function () {
      editor.call('lightmapper:bake');
      editor.call('entities:shadows:update');
  });
  editor.on('lightmapper:uv1Missing', function(state) {
      if (state) {
          buttonBake.class.add('active');
      } else {
          buttonBake.class.remove('active');
      }
  });


  // tooltip
  var tooltipBake = Tooltip.attach({
      target: buttonBake.element,
      align: 'left',
      root: root
  });
  tooltipBake.class.add('light-mapper');
  tooltipBake.hoverable = true;


  // header
  var elHeader = document.createElement('span');
  elHeader.classList.add('header');
  elHeader.textContent = 'Light Mapper';
  tooltipBake.innerElement.appendChild(elHeader);


  // auto toggle
  var elAuto = document.createElement('div');

  if (! editor.call('permissions:write'))
      elAuto.style.display = 'none';

  editor.on('permissions:writeState', function(state) {
      if (state) {
          elAuto.style.display = '';
      } else {
          elAuto.style.display = 'none';
      }
  });

  elAuto.classList.add('auto-toggle');
  tooltipBake.innerElement.appendChild(elAuto);

  var checkAuto = new ui.Checkbox();
  checkAuto.class.add('tick');
  checkAuto.parent = tooltipBake;
  elAuto.appendChild(checkAuto.element);
  editor.on('lightmapper:auto', function(state) {
      checkAuto.value = state;
  });
  checkAuto.on('change', function(value) {
      editor.call('lightmapper:auto', value);
  });

  var labelAuto = new ui.Label({ text: 'Auto Rebake' });
  labelAuto.parent = tooltipBake;
  elAuto.appendChild(labelAuto.element);



  // uv1 missing
  var elUV1 = document.createElement('div');
  elUV1.classList.add('uv1');
  elUV1.textContent = 'UV1 is missing on some models. Please upload models with UV1 or use ';
  tooltipBake.innerElement.appendChild(elUV1);

  var btnAutoUnwrap = new ui.Button({
      text: 'Auto-Unwrap'
  });
  btnAutoUnwrap.parent = tooltipBake;
  elUV1.appendChild(btnAutoUnwrap.element);
  btnAutoUnwrap.on('click', function() {
      if (! uv1Missing)
          return;

      var assetIds = Object.keys(uv1MissingAssets);
      for(var i = 0; i < assetIds.length; i++) {
          if (! uv1MissingAssets.hasOwnProperty(assetIds[i]))
              continue;

          var asset = uv1MissingAssets[assetIds[i]];
          editor.call('assets:model:unwrap', asset);
      }
  });


  // hotkey ctrl+b
  editor.call('hotkey:register', 'lightmapper:bake', {
      key: 'b',
      ctrl: true,
      callback: function() {
          if (editor.call('picker:isOpen:otherThan', 'curve')) return;

          editor.call('lightmapper:bake');
          editor.call('entities:shadows:update');
      }
  });


  // manage if uv1 is missing
  var uv1Missing = false;
  var uv1MissingAssets = { };

  editor.on('assets:model:unwrap', function(asset) {
      if (! uv1MissingAssets[asset.get('id')])
          return;

      delete uv1MissingAssets[asset.get('id')];
      editor.call('lightmapper:uv1missing', uv1MissingAssets);
  })

  editor.method('lightmapper:uv1missing', function(assets) {
      if (assets === undefined)
          return uv1Missing;

      uv1MissingAssets = assets;

      var state = Object.keys(assets).length !== 0

      if (uv1Missing === state)
          return;

      uv1Missing = state;
      editor.emit('lightmapper:uv1Missing', uv1Missing);
  });

  tooltipBake.on('show', function() {
      if (uv1Missing) {
          elUV1.classList.remove('hidden');
      } else {
          elUV1.classList.add('hidden');
      }
  });
});


/* editor/toolbar/toolbar-publish.js */
editor.once('load', function() {
  'use strict';

  var toolbar = editor.call('layout.toolbar');

  var button = new ui.Button({
      text: '&#57911;'
  });
  button.class.add('pc-icon', 'publish-download');
  toolbar.append(button);

  button.on('click', function() {
      editor.call('picker:publish');
  });

  editor.on('picker:publish:open', function () {
      button.class.add('active');
  });

  editor.on('picker:publish:close', function () {
      button.class.remove('active');
  });

  Tooltip.attach({
      target: button.element,
      text: 'Publish / Download',
      align: 'left',
      root: editor.call('layout.root')
  });
});


/* editor/toolbar/toolbar-code-editor.js */
editor.once('load', function() {
  'use strict';

  if (editor.call('settings:project').get('useLegacyScripts'))
      return;

  var toolbar = editor.call('layout.toolbar');
  var firefox = navigator.userAgent.indexOf('Firefox') !== -1;

  var button = new ui.Button({
      text: '&#57648;'
  });
  button.class.add('pc-icon');

  var publishButton = toolbar.dom.querySelector('.publish-download');
  toolbar.appendBefore(button, publishButton);

  button.on('click', function() {
      editor.call('picker:codeeditor');
  });

  editor.method('picker:codeeditor', function (asset) {
      // open the new code editor - try to focus existing tab if it exists
      // (only works in Chrome and only if the Code Editor has been opened by the Editor)

      var url = '/editor/code/' + config.project.id;
      if (asset) {
          url += '?tabs=' + asset.get('id');
      }
      var name = 'codeeditor:' + config.project.id;

      if (firefox) {
          // (Firefox doesn't work at all so open a new tab everytime)
          window.open(url);
      } else {
          var wnd = window.open('', name);
          try {
              if (wnd.editor && wnd.editor.isCodeEditor) {
                  if (asset) {
                      wnd.editor.call('integration:selectWhenReady', asset.get('id'));
                  }
              } else {
                  wnd.location = url;
              }
          } catch (ex) {
              // accessing wnd will throw an exception if it
              // is at a different domain
              window.open(url, name);
          }

      }
  });

  Tooltip.attach({
      target: button.element,
      text: 'Code Editor',
      align: 'left',
      root: editor.call('layout.root')
  });

  editor.call('hotkey:register', 'code-editor', {
      key: 'i',
      ctrl: true,
      callback: function () {
          editor.call('picker:codeeditor');
      }
  });
});


/* editor/toolbar/toolbar-scene.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var viewport = editor.call('layout.viewport');

  var panel = new ui.Panel();
  panel.class.add('widget-title');
  viewport.append(panel);

  editor.method('layout.toolbar.scene', function () {
      return panel;
  });

  var projectName = new ui.Label();
  projectName.text = config.project.name;
  projectName.class.add('project-name');
  projectName.renderChanges = false;
  panel.append(projectName);

  projectName.on('click', function (argument) {
      window.open('/project/' + config.project.id, '_blank');
  });

  Tooltip.attach({
      target: projectName.element,
      text: 'Project',
      align: 'top',
      root: root
  });

  var sceneName = new ui.Label();
  sceneName.class.add('scene-name');
  sceneName.renderChanges = false;
  panel.append(sceneName);

  Tooltip.attach({
      target: sceneName.element,
      text: 'Settings',
      align: 'top',
      root: root
  });

  editor.on('scene:name', function(name) {
      sceneName.text = name;
  });

  sceneName.on('click', function() {
      editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
  });

  editor.on('attributes:clear', function() {
      sceneName.class.remove('active');
  });

  editor.on('attributes:inspect[editorSettings]', function() {
      sceneName.class.add('active');
  });

  editor.on('scene:unload', function () {
      sceneName.text = '';
  });

  if (! config.project.settings.useLegacyScripts) {
      var name = config.self.branch.name;
      if (name.length > 33) {
          name = name.substring(0, 30) + '...';
      }
      var branchButton = new ui.Label({
          text: name
      });
      branchButton.class.add('branch-name');
      panel.append(branchButton);
      branchButton.on('click', function () {
          editor.call('picker:versioncontrol');
      });

      Tooltip.attach({
          target: branchButton.element,
          text: 'Version Control',
          align: 'top',
          root: root
      });

      // hide version control picker if we are not part of the team
      if (! editor.call('permissions:read')) {
          branchButton.hidden = true;
      }
      editor.on('permissions:set', function () {
          branchButton.hidden = ! editor.call('permissions:read');
      });
  }

  var sceneList = new ui.Label();
  sceneList.class.add('scene-list');
  panel.append(sceneList);

  Tooltip.attach({
      target: sceneList.element,
      text: 'Manage Scenes',
      align: 'top',
      root: root
  });

  sceneList.on('click', function () {
      editor.call('picker:scene');
  });

  editor.on('picker:scene:open', function () {
      sceneList.class.add('active');
  });

  editor.on('picker:scene:close', function () {
      sceneList.class.remove('active');
  });
});


/* editor/toolbar/toolbar-launch.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var viewport = editor.call('layout.viewport');
  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');

  var settings = editor.call('settings:projectUser');
  var privateSettings = editor.call('settings:projectPrivate');

  // panel
  var panel = new ui.Panel();
  panel.class.add('top-controls');
  viewport.append(panel);

  editor.method('layout.toolbar.launch', function () {
      return panel;
  });

  // launch
  var launch = new ui.Panel();
  launch.class.add('launch');
  panel.append(launch);
  launch.disabled = true;

  editor.on('scene:load', function () {
      launch.disabled = false;
  });

  editor.on('scene:unload', function () {
      launch.disabled = true;
  });

  var buttonLaunch = new ui.Button({
      text: '&#57649;'
  });
  buttonLaunch.class.add('icon');
  launch.append(buttonLaunch);

  var launchApp = function () {
      var url = config.url.launch + config.scene.id;

      var query = [ ];

      if (launchOptions.local) {
          url = url.replace(/^https/, 'http');
          query.push('local=' + settings.get('editor.localServer'));
      }

      if (launchOptions.webgl1) {
          query.push('webgl1=true');
      }

      if (launchOptions.profiler) {
          query.push('profile=true');
      }

      if (launchOptions.debug) {
          query.push('debug=true');
      }

      if (launchOptions.concatenate) {
          query.push('concatenateScripts=true');
      }

      if (launchOptions.disableBundles) {
          query.push('useBundles=false');
      }

      if (query.length)
          url += '?' + query.join('&');

      var launcher = window.open();
      launcher.opener = null;
      launcher.location = url;
  };

  buttonLaunch.on('click', launchApp);

  var tooltip = Tooltip.attach({
      target: launch.element,
      text: 'Launch',
      root: root
  });

  var layoutRight = editor.call('layout.attributes');

  var launchOptions = { };

  var panelOptions = new ui.Panel();
  panelOptions.class.add('options');
  launch.append(panelOptions);
  panelOptions.hidden = true;

  var createOption = function (name, title) {
      var panel = new ui.Panel();
      panelOptions.append(panel);

      var option = new ui.Checkbox();
      option.value = false;
      option.class.add('tick');
      panel.append(option);

      option.on('click', function (e) {
          e.stopPropagation();
      });

      var label = new ui.Label({text: title});
      panel.append(label);

      panel.on('click', function () {
          option.value = !option.value;
      });

      launchOptions[name] = false;
      option.on('change', function (value) {
          launchOptions[name] = value;
      });

      return option;
  };

  var optionProfiler = createOption('profiler', 'Profiler');
  var tooltipProfiler = Tooltip.attach({
      target: optionProfiler.parent.element,
      text: 'Enable the visual performance profiler in the launch page.',
      align: 'right',
      root: root
  });
  tooltipProfiler.class.add('launch-tooltip');

  var optionDebug = createOption('debug', 'Debug');

  var suspendDebug = false;
  optionDebug.value = settings.get('editor.launchDebug');
  settings.on('editor.launchDebug:set', function (value) {
      suspendDebug = true;
      optionDebug.value = value;
      suspendDebug = false;
  });
  optionDebug.on('change', function (value) {
      if (suspendDebug) return;
      settings.set('editor.launchDebug', value);
  });

  var tooltipDebug = Tooltip.attach({
      target: optionDebug.parent.element,
      text: 'Enable the logging of warning and error messages to the JavaScript console.',
      align: 'right',
      root: root
  });
  tooltipDebug.class.add('launch-tooltip');


  if (legacyScripts) {
      var local = createOption('local', 'Use Local Server');

      var getTooltipText = function () {
          var tooltipText = 'Enable this if you want to load scripts from your local server.';
          if (settings.get('editor.localServer')) {
              tooltipText +=  ' If enabled scripts will be loaded from <a href="' +
                     settings.get('editor.localServer') + '" target="_blank">' + settings.get('editor.localServer') + '</a>.';
          }

          tooltipText += ' You can change your Local Server URL from the Editor settings.';
          return tooltipText;
      };

      settings.on('editor.localServer:set', function () {
          tooltipLocal.html = getTooltipText();
      });

      var tooltipLocal = Tooltip.attach({
          target: local.parent.element,
          html: getTooltipText(),
          align: 'right',
          root: root
      });

      tooltipLocal.class.add('launch-tooltip');
  } else {
      var optionConcatenate = createOption('concatenate', 'Concatenate Scripts');
      var tooltipConcatenate = Tooltip.attach({
          target: optionConcatenate.parent.element,
          text: 'Concatenate scripts on launch to reduce scene load time.',
          align: 'right',
          root: root
      });
      tooltipConcatenate.class.add('launch-tooltip');
  }

  if (editor.call('users:hasFlag', 'hasBundles')) {
      var optionDisableBundles = createOption('disableBundles', 'Disable Asset Bundles');

      var tooltipBundles = Tooltip.attach({
          target: optionDisableBundles.parent.element,
          text: 'Disable loading assets from Asset Bundles.',
          align: 'right',
          root: root
      });
      tooltipBundles.class.add('launch-tooltip');
  }

  var preferWebGl1 = createOption('webgl1', 'Prefer WebGL 1.0');

  var tooltipPreferWebGl1 = Tooltip.attach({
      target: preferWebGl1.parent.element,
      text: 'Force the use of WebGL 1 regardless of whether WebGL 2 is preferred in Scene Settings.',
      align: 'right',
      root: root
  });
  tooltipPreferWebGl1.class.add('launch-tooltip');

  if (! editor.call('settings:project').get('preferWebGl2'))
      preferWebGl1.parent.disabled = true;

  editor.call('settings:project').on('preferWebGl2:set', function(value) {
      preferWebGl1.parent.disabled = ! value;
  });

  editor.method('launch', launchApp);

  editor.call('hotkey:register', 'launch', {
      key: 'enter',
      ctrl: true,
      callback: function () {
          if (editor.call('picker:isOpen')) return;
          launchApp();
      }
  });


  var timeout;

  // show dropdown menu
  launch.element.addEventListener('mouseenter', function () {
      if (! editor.call('permissions:read') || launch.disabled)
          return;

      tooltip.align = (layoutRight && (layoutRight.hidden || layoutRight.folded)) ? 'right' : 'left';

      panelOptions.hidden = false;
      if (timeout)
          clearTimeout(timeout);
  });

  // hide dropdown menu after a delay
  launch.element.addEventListener('mouseleave', function () {
      if (! editor.call('permissions:write'))
          return;

      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(function () {
          panelOptions.hidden = true;
          timeout = null;
      }, 50);
  });

  // cancel hide
  panel.element.addEventListener('mouseenter', function () {
      if (!panelOptions.hidden && timeout)
          clearTimeout(timeout);

  });

  // hide options after a while
  panel.element.addEventListener('mouseleave', function () {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(function () {
          panelOptions.hidden = true;
          timeout = null;
      }, 50);
  });


  // fullscreen
  var buttonExpand = new ui.Button({
      text: '&#57639;'
  });
  buttonExpand.class.add('icon', 'expand');
  panel.append(buttonExpand);

  buttonExpand.on('click', function() {
      editor.call('viewport:expand');
  });
  editor.on('viewport:expand', function(state) {
      if (state) {
          tooltipExpand.text = 'Show Panels';
          buttonExpand.class.add('active');
      } else {
          tooltipExpand.text = 'Hide Panels';
          buttonExpand.class.remove('active');
      }

      tooltipExpand.hidden = true;
  });

  var tooltipExpand = Tooltip.attach({
      target: buttonExpand.element,
      text: 'Hide Panels',
      align: 'top',
      root: root
  });
});


/* editor/toolbar/toolbar-options.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var viewport = editor.call('layout.viewport');
  var controls = editor.call('layout.toolbar.launch');

  var panel = new ui.Panel();
  panel.class.add('modes');
  panel.hidden = true;
  controls.append(panel);


  // show collision
  var panelCollision = new ui.Panel();
  panelCollision.class.add('field');
  panel.append(panelCollision);
  // field
  var fieldCollisionVisible = new ui.Checkbox();
  fieldCollisionVisible.class.add('tick');
  panelCollision.append(fieldCollisionVisible);
  fieldCollisionVisible.value = editor.call('gizmo:collision:visible');
  fieldCollisionVisible.on('change', function(value) {
      editor.call('gizmo:collision:visible', value);
  });
  editor.on('gizmo:collision:visible', function(visible) {
      fieldCollisionVisible.value = visible;
  });
  // label
  var label = new ui.Label({
      text: 'Physics Edit Mode'
  });
  label.on('click', function() {
      fieldCollisionVisible.element.click();
  });
  panelCollision.append(label);


  // show zones
  var panelZones = new ui.Panel();
  panelZones.class.add('field');
  panel.append(panelZones);
  // field
  var fieldZonesVisible = new ui.Checkbox();
  fieldZonesVisible.class.add('tick');
  panelZones.append(fieldZonesVisible);
  fieldZonesVisible.value = editor.call('gizmo:zone:visible');
  fieldZonesVisible.on('change', function(value) {
      editor.call('gizmo:zone:visible', value);
  });
  editor.on('gizmo:zone:visible', function(visible) {
      fieldZonesVisible.value = visible;
  });
  // label
  var label = new ui.Label({
      text: 'Zones Edit Mode'
  });
  label.on('click', function() {
      fieldZonesVisible.element.click();
  });
  panelZones.append(label);



  // fullscreen
  var buttonOptions = new ui.Button({
      text: '&#57652;'
  });
  buttonOptions.class.add('icon', 'options');
  controls.append(buttonOptions);


  var timeout;

  var onHover = function() {
      if (timeout) {
          clearTimeout(timeout);
          timeout = null;
      }

      panel.hidden = false;
  };

  var onBlur = function() {
      if (timeout) {
          clearTimeout(timeout);
          timeout = null;
      }

      timeout = setTimeout(function() {
          panel.hidden = true;
          timeout = null;
      }, 50);
  };

  buttonOptions.element.addEventListener('mouseenter', function() {
      if (! editor.call('permissions:read') || buttonOptions.disabled)
          return;

      onHover();
  }, false);

  buttonOptions.element.addEventListener('mouseleave', function() {
      if (! editor.call('permissions:read'))
          return;

      onBlur();
  }, false);

  panel.element.addEventListener('mouseenter', function() {
      if (! panel.hidden)
          onHover();
  }, false);

  panel.element.addEventListener('mouseleave', function() {
      onBlur();
  }, false);
});


/* editor/toolbar/toolbar-cameras.js */
editor.once('viewport:load', function() {
  'use strict';

  var viewport = editor.call('layout.viewport');
  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var options = { };
  var index = { };
  var events = { };

  var combo = new ui.SelectField({
      options: options,
      optionClassNamePrefix: 'viewport-camera'
  });
  combo.disabledClick = true;
  combo.class.add('viewport-camera');

  combo.on('open', function() {
      tooltip.disabled = true;
  });
  combo.on('close', function() {
      tooltip.disabled = false;
  });


  viewport.append(combo);

  combo.on('change', function(value) {
      var entity = app.root.findByGuid(value);
      editor.call('camera:set', entity);
  });

  var tooltip = Tooltip.attach({
      target: combo.element,
      text: 'Camera',
      align: 'top',
      root: editor.call('layout.root')
  });

  var refreshOptions = function() {
      combo._updateOptions(options);

      var writePermission = editor.call('permissions:write');
      for(var key in combo.optionElements) {
          if (index[key].__editorCamera)
              continue;

          if (writePermission) {
              combo.optionElements[key].classList.remove('hidden');
          } else {
              combo.optionElements[key].classList.add('hidden');
          }
      }
  };

  editor.on('permissions:writeState', refreshOptions);

  editor.on('camera:add', function(entity) {
      options[entity.getGuid()] = entity.name;
      index[entity.getGuid()] = entity;
      refreshOptions();

      if (events[entity.getGuid()])
          events[entity.getGuid()].unbind();

      var obj = editor.call('entities:get', entity.getGuid());
      if (obj) {
          events[entity.getGuid()] = obj.on('name:set', function (value) {
              options[entity.getGuid()] = value;
              refreshOptions();

              if (combo.value === entity.getGuid())
                  combo.elementValue.textContent = value;
          });
      }
  });

  editor.on('camera:remove', function(entity) {
      delete options[entity.getGuid()];
      refreshOptions();

      if (events[entity.getGuid()]) {
          events[entity.getGuid()].unbind();
          delete events[entity.getGuid()];
      }
  });

  editor.on('camera:change', function(entity) {
      combo.value = entity.getGuid();
  });
});


/* editor/toolbar/toolbar-whois.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var viewport = editor.call('layout.viewport');

  var panel = new ui.Panel();
  panel.class.add('whoisonline');
  viewport.append(panel);

  editor.on('viewport:expand', function(state) {
      if (state) {
          panel.class.add('expanded');
      } else {
          panel.class.remove('expanded');
      }
  });


  editor.on('whoisonline:add', function (id) {
      for(var i = 0; i < panel.innerElement.childNodes.length; i++) {
          var child = panel.innerElement.childNodes[i];
          if (child.userId === id)
              return;
      }

      var link = document.createElement('a');
      link.userId = id;
      link.href = '/' + id;
      link.target = "_blank";
      panel.append(link);

      var img = document.createElement('img');
      img.src = '/api/users/' + id + '/thumbnail?size=28';
      link.appendChild(img);

      link.tooltip = Tooltip.attach({
          target: link,
          text: '',
          align: 'bottom',
          root: root
      });

      editor.call('users:loadOne', id, function (user) {
          link.href = '/' + user.username;
          link.tooltip.text = user.username;
          link.style.backgroundColor = editor.call('whoisonline:color', user.id, 'hex');
      });
  });


  editor.on('whoisonline:remove', function (id, index) {
      for(var i = 0; i < panel.innerElement.childNodes.length; i++) {
          var child = panel.innerElement.childNodes[i];
          if (child.userId === id) {
              if (child.tooltip)
                  child.tooltip.destroy();
              panel.innerElement.removeChild(child);
              return;
          }
      }
  });


  editor.method('whoisonline:panel', function() {
      return panel;
  });

  var chatWidget = editor.call('chat:panel');
  if (chatWidget) {
      panel.class.add('chat-minified');

      chatWidget.on('fold', function() {
          panel.class.add('chat-minified');
      });
      chatWidget.on('unfold', function() {
          panel.class.remove('chat-minified');
      });

      if (! editor.call('permissions:read'))
          panel.class.add('no-chat');
  }

  editor.on('permissions:set', function(level) {
      if (level) {
          panel.class.remove('no-chat');
      } else {
          panel.class.add('no-chat');
      }
  });
});


/* editor/toolbar/toolbar-connection.js */
editor.once('load', function() {
  'use strict';

  var timeout;
  var viewportError = false;

  // overlay
  var overlay = new ui.Overlay();
  overlay.class.add('connection-overlay');
  overlay.center = false;
  overlay.transparent = false;
  overlay.clickable = false;
  overlay.hidden = true;

  var root = editor.call('layout.root');
  root.append(overlay);

  // icon
  var icon = document.createElement('div');
  icon.classList.add('connection-icon');
  icon.classList.add('error');
  overlay.innerElement.appendChild(icon);

  // content
  var content = document.createElement('div');
  content.classList.add('connection-content');
  overlay.innerElement.appendChild(content);

  editor.on('realtime:connected', function () {
      if (viewportError) return;

      overlay.hidden = true;
  });

  editor.on('realtime:disconnected', function () {
      content.innerHTML = 'You have been disconnected from the server.';
      overlay.hidden = false;
  });

  editor.on('realtime:nextAttempt', function (time) {
      function setText (remaining) {
          content.innerHTML = 'Disconnected. Reconnecting in ' + remaining + ' seconds...';
      }

      var before = new Date();

      function renderTime () {
          var now = new Date();
          var elapsed = now.getTime() - before.getTime();
          before = now;
          time -= Math.round(elapsed / 1000);
          if (time < 0) {
              time = 0;
          } else {
              timeout = setTimeout(renderTime, 1000);
          }

          setText(time);
      }

      setText(time);

      timeout = setTimeout(renderTime, 1000);
  });

  editor.on('realtime:connecting', function (attempt) {
      if (viewportError) return;

      overlay.hidden = true;
      clearTimeout(timeout);
  });

  editor.on('realtime:cannotConnect', function () {
      overlay.hidden = false;
      clearTimeout(timeout);
      content.innerHTML = 'Cannot connect to the server. Please try again later.';
  });

  var onError = function (err) {
      console.log(err);
      console.trace();
      content.innerHTML = 'Error while saving changes. Please refresh the editor.';
      overlay.hidden = false;
  };

  editor.on('viewport:error', function(err) {
      viewportError = true;
      console.error(err);
      console.trace();
      content.innerHTML = 'Failed creating WebGL Context.<br />Please check <a href="http://webglreport.com/" target="_blank">WebGL Report</a> and report to <a href="http://forum.playcanvas.com/" target="_blank">Forum</a>.';
      overlay.hidden = false;
  });

  editor.on('realtime:error', onError);
  editor.on('realtime:scene:error', onError);
  editor.on('realtime:userdata:error', function (err) {
      console.error(err);
  });
  editor.on('realtime:assets:error', onError);

  editor.on('messenger:scene.delete', function (data) {
      if (data.scene.branchId !== config.self.branch.id) return;

      if (config.scene.id && data.scene.id === parseInt(config.scene.id, 10)) {
          content.innerHTML = 'This scene has been deleted.';
          overlay.hidden = false;
      }
  });

  editor.on('scene:unload', function () {
      if (viewportError) return;

      overlay.hidden = true;
  });
});


/* editor/toolbar/toolbar-usage.js */
editor.once('load', function () {
  'use strict';

  if (config.owner.plan.type !== 'free')
      return;

  var root = editor.call('layout.root');
  var container = new pcui.Container({
      id: 'usage-alert'
  });

  var label = new ui.Label({
      unsafe: true
  });
  container.append(label);

  var btnClose = new ui.Button({
      text: '&#57650;'
  });
  container.append(btnClose);
  btnClose.class.add('close');
  btnClose.on('click', function () {
      container.hidden = true;
  });

  var refreshUsage = function () {
      var diff = config.owner.diskAllowance - config.owner.size;
      var upgrade = '<a href="/upgrade" target="_blank">UPGRADE</a> to get more disk space.';
      if (diff > 0 && diff < 30000000) {
          label.text = 'You are close to your disk allowance limit. ' + upgrade;
          container.hidden = false;
      } else if (diff < 0) {
          label.text = 'You are over your disk allowance limit. ' + upgrade;
          container.hidden = false;
      } else {
          container.hidden = true;
      }
  };

  root.append(container);

  refreshUsage();

  editor.on('user:' + config.owner.id + ':usage', refreshUsage);
});


/* editor/toolbar/toolbar-script.js */
editor.once('load', function () {
  'use script';

  if (! editor.call('settings:project').get('useLegacyScripts'))
      return;

  var root = editor.call('layout.root');
  var overlay = new ui.Overlay();
  overlay.class.add('new-script');
  overlay.clickable = true;
  overlay.hidden = true;
  root.append(overlay);

  var panel = new ui.Panel();
  overlay.append(panel);

  var label = new ui.Label({
      text: 'Enter script name and press Enter:'
  });
  label.class.add('action');
  panel.append(label);

  var fieldName = new ui.TextField();
  fieldName.blurOnEnter = false;
  fieldName.renderChanges = false;
  panel.append(fieldName);

  var fieldError = new ui.Label();
  fieldError.renderChanges = false;
  fieldError.class.add('error');
  panel.append(fieldError);
  fieldError.hidden = true;

  var newContent = '';
  var creating = false;

  // close overlay on esc
  var onKey = function (e) {
      if (e.keyCode === 27) {
          overlay.hidden = true;
      }
  };

  overlay.on('show', function () {
      editor.emit('sourcefiles:new:open');
      window.addEventListener('keydown', onKey);
      setTimeout(function () {
          fieldName.elementInput.focus();
      }, 100);
  });

  overlay.on('hide', function () {
      window.removeEventListener('keydown', onKey);
      fieldName.value = '';
      fieldError.hidden = true;
      fieldError.text = '';
      newContent = '';
      creating = false;
      editor.emit('sourcefiles:new:close');

  });

  editor.method('sourcefiles:new', function (content) {
      newContent = content;
      overlay.hidden = false;
  });

  var onError = function (error) {
      fieldError.text = error;
      fieldError.hidden = false;
  };

  var onSubmit = function () {
      if (creating)
          return;

      creating = true;

      fieldError.hidden = true;

      if (! validateFilename(fieldName.value)) {
          creating = false;
          onError('Invalid filename');
          return;
      }

      if (!fieldName.value.toLowerCase().endsWith('.js'))
          fieldName.value = fieldName.value + '.js';

      createScript(fieldName.value, function (err, script) {
          creating = false;

          if (err) {
              onError(err);
          } else {
              // select script
              editor.call('assets:panel:currentFolder', 'scripts');
              editor.call('selector:set', 'asset', [script]);

              overlay.hidden = true;
          }
      });
  };

  // submit on enter
  fieldName.elementInput.addEventListener('keydown', function (e) {
      if (e.keyCode === 13) {
          onSubmit();
      }
  });

  // clear error on input
  fieldName.elementInput.addEventListener('input', function () {
      if (!fieldError.hidden) {
          fieldError.hidden = true;
          fieldError.text = '';
      }
  });

  var pattern = /^(?:[\w\.-]+\/)*[_\.-]*[A-Za-z][\w_\.-]*?$/i;
  var validateFilename = function (filename) {
      return pattern.test(filename);
  };

  var createScript = function (filename, callback) {
      // try to get the file first and create it only if it doesn't exist
      // TODO: don't do that when scripts are assets
      editor.call('sourcefiles:content', filename, function (err) {
          if (! err) {
              // already exists
              callback('Script with that name already exists.');
          } else {
              // create script
              var content = newContent || editor.call('sourcefiles:skeleton', filename);
              editor.call('sourcefiles:create', filename, content, function (err, sourcefile) {
                  callback(err, sourcefile);
              });
          }
      });
  };
});