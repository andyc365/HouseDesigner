

/* editor/settings/settings.js */
editor.once('load', function () {
  'use strict';

  editor.method('settings:create', function (args) {
      // settings observer
      var settings = new Observer(args.data);
      settings.id = args.id;

      // Get settings
      editor.method('settings:' + args.name, function () {
          return settings;
      });

      var doc;

      settings.reload = function () {
          var connection = editor.call('realtime:connection');

          if (doc)
              doc.destroy();

          doc = connection.get('settings', settings.id);

          // handle errors
          doc.on('error', function (err) {
              console.error(err);
              editor.emit('settings:' + args.name + ':error', err);
          });

          // load settings
          doc.on('load', function () {
              var data = doc.data;

              // remove unnecessary fields
              delete data._id;
              delete data.name;
              delete data.user;
              delete data.project;
              delete data.item_id;
              delete data.branch_id;
              delete data.checkpoint_id;

              if (! settings.sync) {
                  settings.sync = new ObserverSync({
                      item: settings,
                      paths: Object.keys(settings._data)
                  });

                  // local -> server
                  settings.sync.on('op', function (op) {
                      if (doc)
                          doc.submitOp([ op ]);
                  });
              }

              var history = settings.history.enabled;
              if (history) {
                  settings.history.enabled = false;
              }

              settings.sync._enabled = false;
              for (var key in data) {
                  if (data[key] instanceof Array) {
                      settings.set(key, data[key].slice(0));
                  } else {
                      settings.set(key, data[key]);
                  }
              }
              settings.sync._enabled = true;
              if (history)
                  settings.history.enabled = true;

              // server -> local
              doc.on('op', function (ops, local) {
                  if (local) return;

                  var history = settings.history.enabled;
                  if (history)
                      settings.history.enabled = false;
                  for (var i = 0; i < ops.length; i++) {
                      settings.sync.write(ops[i]);
                  }
                  if (history)
                      settings.history.enabled = true;
              });

              editor.emit('settings:' + args.name + ':load');
          });

          // subscribe for realtime events
          doc.subscribe();
      };

      if (! args.deferLoad) {
          editor.on('realtime:authenticated', function () {
              settings.reload();
          });
      }

      editor.on('realtime:disconnected', function () {
          if (doc) {
              doc.destroy();
              doc = null;
          }
      });

      settings.disconnect = function () {
          if (doc) {
              doc.destroy();
              doc = null;
          }

          if (settings.sync) {
              settings.sync.unbind();
              delete settings.sync;
          }
      };


      return settings;
  });

});


/* editor/settings/user-settings.js */
editor.once('load', function () {
  'use strict';

  var settings = editor.call('settings:create', {
      name: 'user',
      id: 'user_' + config.self.id,
      data: {
          editor: {
              howdoi: true,
              iconSize: 0.2
          }
      }
  });

  // add history
  settings.history = new ObserverHistory({
      item: settings,
      getItemFn: function () {return settings;}
  });

  // record history
  settings.history.on('record', function(action, data) {
      editor.call('history:' + action, data);
  });
});


/* editor/settings/project-user-settings.js */
editor.once('load', function () {
  'use strict';

  var isConnected = false;

  var settings = editor.call('settings:create', {
      name: 'projectUser',
      id: 'project_' + config.project.id + '_' + config.self.id,
      deferLoad: true,
      data: {
          editor: {
              cameraNearClip: 0.1,
              cameraFarClip: 1000,
              cameraClearColor: [
                  0.118,
                  0.118,
                  0.118,
                  1
              ],
              gridDivisions: 8,
              gridDivisionSize: 1,
              snapIncrement: 1,
              localServer: 'http://localhost:51000',
              launchDebug: true,
              locale: 'en-US',
              pipeline: {
                  texturePot: true,
                  textureDefaultToAtlas: false,
                  searchRelatedAssets: true,
                  preserveMapping: false,
                  overwriteModel: true,
                  overwriteAnimation: true,
                  overwriteMaterial: false,
                  overwriteTexture: true
              }
          },
          branch: config.self.branch.id
      },
      userId: config.self.id
  });

  // add history
  settings.history = new ObserverHistory({
      item: settings,
      getItemFn: function () {return settings;}
  });

  // record history
  settings.history.on('record', function(action, data) {
      editor.call('history:' + action, data);
  });

  // migrations
  editor.on('settings:projectUser:load', function () {
      setTimeout(function () {
          var history = settings.history.enabled;
          settings.history.enabled = false;

          var sync = settings.sync.enabled;
          settings.sync.enabled = editor.call('permissions:read'); // read permissions enough for project user settings

          if (! settings.has('editor.pipeline'))
              settings.set('editor.pipeline', {});

          if (! settings.has('editor.pipeline.texturePot'))
              settings.set('editor.pipeline.texturePot', true);

          if (! settings.has('editor.pipeline.searchRelatedAssets'))
              settings.set('editor.pipeline.searchRelatedAssets', true);

          if (! settings.has('editor.pipeline.preserveMapping'))
              settings.set('editor.pipeline.preserveMapping', false);

          if (! settings.has('editor.pipeline.textureDefaultToAtlas'))
              settings.set('editor.pipeline.textureDefaultToAtlas', false);

          if (! settings.has('editor.pipeline.overwriteModel'))
              settings.set('editor.pipeline.overwriteModel', true);

          if (! settings.has('editor.pipeline.overwriteAnimation'))
              settings.set('editor.pipeline.overwriteAnimation', true);

          if (! settings.has('editor.pipeline.overwriteMaterial'))
              settings.set('editor.pipeline.overwriteMaterial', false);

          if (! settings.has('editor.pipeline.overwriteTexture'))
              settings.set('editor.pipeline.overwriteTexture', true);

          if (! settings.has('editor.locale')) {
              settings.set('editor.locale', 'en-US');
          }

          settings.history.enabled = history;
          settings.sync.enabled = sync;
      });
  });

  var reload = function () {
      // config.project.hasReadAccess is only for the launch page
      if (isConnected && (editor.call('permissions:read') || config.project.hasReadAccess)) {
          settings.reload(settings.scopeId);
      }
  };

  // handle permission changes
  editor.on('permissions:set:' + config.self.id, function (accesslevel) {
      if (editor.call('permissions:read')) {
          // reload settings
          if (! settings.sync) {
              settings.history.enabled = true;
              reload();
          }
      } else {
          // unset private settings
          if (settings.sync) {
              settings.disconnect();
              settings.history.enabled = false;
          }
      }
  });

  editor.on('realtime:authenticated', function () {
      isConnected = true;
      reload();
  });

  editor.on('realtime:disconnected', function () {
      isConnected = false;
  });
});


/* editor/settings/project-settings.js */
editor.once('load', function () {
  'use strict';

  var syncPaths = [
      'antiAlias',
      'batchGroups',
      'fillMode',
      'resolutionMode',
      'height',
      'width',
      'use3dPhysics',
      'preferWebGl2',
      'preserveDrawingBuffer',
      'scripts',
      'transparentCanvas',
      'useDevicePixelRatio',
      'useLegacyScripts',
      'useKeyboard',
      'useMouse',
      'useGamepads',
      'useTouch',
      'vr',
      'loadingScreenScript',
      'externalScripts',
      'plugins',
      'useModelV2',
      'layers',
      'layerOrder',
      'i18nAssets'
  ];

  var data = {};
  for (var i = 0; i < syncPaths.length; i++)
      data[syncPaths[i]] = config.project.settings.hasOwnProperty(syncPaths[i]) ? config.project.settings[syncPaths[i]] : null;

  var settings = editor.call('settings:create', {
      name: 'project',
      id: config.project.settings.id,
      data: data
  });

  if (! settings.get('useLegacyScripts')) {
      pc.script.legacy = false;
  } else {
      pc.script.legacy = true;
  }

  // add history
  settings.history = new ObserverHistory({
      item: settings,
      getItemFn: function () {return settings;}
  });

  // record history
  settings.history.on('record', function(action, data) {
      editor.call('history:' + action, data);
  });

  settings.on('*:set', function (path, value) {
      var parts = path.split('.');
      var obj = config.project.settings;
      for (var i = 0; i < parts.length - 1; i++) {
          if (! obj.hasOwnProperty(parts[i]))
              obj[parts[i]] = {};

          obj = obj[parts[i]];
      }

      // this is limited to simple structures for now
      // so take care
      if (value instanceof Object) {
          var path = parts[parts.length-1];
          obj[path] = {};
          for (var key in value) {
              obj[path][key] = value[key];
          }
      } else {
          obj[parts[parts.length-1]] = value;
      }
  });

  settings.on('*:unset', function (path) {
      var parts = path.split('.');
      var obj = config.project.settings;
      for (var i = 0; i < parts.length - 1; i++) {
          obj = obj[parts[i]];
      }

      delete obj[parts[parts.length-1]];
  });

  settings.on('*:insert', function (path, value, index) {
      var parts = path.split('.');
      var obj = config.project.settings;
      for (var i = 0; i < parts.length - 1; i++) {
          obj = obj[parts[i]];
      }

      var arr = obj[parts[parts.length - 1]];
      if (Array.isArray(arr)) {
          arr.splice(index, 0, value);
      }
  });

  settings.on('*:remove', function (path, value, index) {
      var parts = path.split('.');
      var obj = config.project.settings;
      for (var i = 0; i < parts.length - 1; i++) {
          obj = obj[parts[i]];
      }

      var arr = obj[parts[parts.length - 1]];
      if (Array.isArray(arr)) {
          arr.splice(index, 1);
      }
  });

  // migrations
  editor.on('settings:project:load', function () {
      var history = settings.history.enabled;
      var sync = settings.sync.enabled;

      settings.history.enabled = false;
      settings.sync.enabled = editor.call('permissions:write');

      if (! settings.get('batchGroups')) {
          settings.set('batchGroups', {});
      }
      if (! settings.get('layers')) {
          settings.set('layers', {
              0: {
                  name: 'World',
                  opaqueSortMode: 2,
                  transparentSortMode: 3
              },
              1: {
                  name: 'Depth',
                  opaqueSortMode: 2,
                  transparentSortMode: 3
              },
              2: {
                  name: 'Skybox',
                  opaqueSortMode: 0,
                  transparentSortMode: 3
              },
              3: {
                  name: 'Immediate',
                  opaqueSortMode: 0,
                  transparentSortMode: 3
              },
              4: {
                  name: 'UI',
                  opaqueSortMode: 1,
                  transparentSortMode: 1
              }
          });

          settings.set('layerOrder', []);
          settings.insert('layerOrder', {
              layer: LAYERID_WORLD,
              transparent: false,
              enabled: true
          });
          settings.insert('layerOrder', {
              layer: LAYERID_DEPTH,
              transparent: false,
              enabled: true
          });
          settings.insert('layerOrder', {
              layer: LAYERID_SKYBOX,
              transparent: false,
              enabled: true
          });
          settings.insert('layerOrder', {
              layer: LAYERID_WORLD,
              transparent: true,
              enabled: true
          });
          settings.insert('layerOrder', {
              layer: LAYERID_IMMEDIATE,
              transparent: false,
              enabled: true
          });
          settings.insert('layerOrder', {
              layer: LAYERID_IMMEDIATE,
              transparent: true,
              enabled: true
          });
          settings.insert('layerOrder', {
              layer: LAYERID_UI,
              transparent: true,
              enabled: true
          });
      }

      if (settings.has('useKeyboard')) {
          settings.set('useKeyboard', true);
      }
      if (settings.has('useMouse')) {
          settings.set('useMouse', true);
      }
      if (settings.has('useTouch')) {
          settings.set('useTouch', true);
      }
      if (settings.has('useGamepads')) {
          settings.set('useGamepads', !!settings.get('vr'));
      }

      if (!settings.get('i18nAssets')) {
          settings.set('i18nAssets', []);
      }

      if (!settings.get('externalScripts')) {
          settings.set('externalScripts', []);
      }

      settings.history.enabled = history;
      settings.sync.enabled = sync;
  });
});


/* editor/settings/project-private-settings.js */
editor.once('load', function () {
  'use strict';

  // this used to have facebook settings
  // but we removed those so leaving this here in case
  // it is needed in the future
  var defaultData = {
  };

  var isConnected = false;

  var settings = editor.call('settings:create', {
      name: 'projectPrivate',
      id: 'project-private_' + config.project.id,
      deferLoad: true,
      data: defaultData
  });


  // add history
  settings.history = new ObserverHistory({
      item: settings,
      getItemFn: function () {return settings;}
  });

  // record history
  settings.history.on('record', function(action, data) {
      editor.call('history:' + action, data);
  });

  var reload = function () {
      if (! isConnected) return;

      if (config.project.hasPrivateSettings && editor.call('permissions:write')) {
          settings.reload(settings.scopeId);
      }

      if (! config.project.hasPrivateSettings) {
          var pendingChanges = {};

          var evtOnSet = settings.on('*:set', function (path, value, valueOld) {
              // store pending changes until we load document from C3 in order to send
              // them to the server
              if (! settings.sync) {
                  pendingChanges[path] = value;
              }

              if (! config.project.hasPrivateSettings) {
                  config.project.hasPrivateSettings = true;
                  settings.reload(settings.scopeId);
              }
          });

          // when settings are created and loaded from the server sync any pending changes
          editor.once('settings:projectPrivate:load', function () {
              evtOnSet.unbind();

              var history = settings.history.enabled;
              settings.history.enabled = false;
              for (var key in pendingChanges) {
                  settings.set(key, pendingChanges[key]);
              }
              settings.history.enabled = history;

              pendingChanges = null;
          });
      }
  };

  // handle permission changes
  editor.on('permissions:set:' + config.self.id, function (accesslevel) {
      if (accesslevel !== 'admin' && accesslevel !== 'write') {
          // unset private settings
          settings.disconnect();
          settings.history.enabled = false;
          for (var key in defaultData) {
              settings.unset(key);
          }
      } else {
          // reload settings
          settings.history.enabled = true;
          reload();
      }
  });

  editor.on('realtime:authenticated', function () {
      isConnected = true;
      reload();
  });

  editor.on('realtime:disconnected', function () {
      isConnected = false;
  });

  if (! config.project.hasPrivateSettings) {
      editor.on('messenger:settings.create', function (msg) {
          if (config.project.hasPrivateSettings) return; // skip if we've already created the settings locally

          if (msg.settings.name === 'project-private') {
              config.project.hasPrivateSettings = true;
              reload();
          }
      });
  }

});


/* editor/settings/scene-settings.js */
editor.once('load', function() {
  'use strict';

  var sceneSettings = new Observer();

  // get scene settings
  editor.method('sceneSettings', function() {
      return sceneSettings;
  });


  // loaded scene
  editor.on('scene:raw', function(data) {
      var sync = sceneSettings.sync ? sceneSettings.sync.enabled : false;
      if (sync)
          sceneSettings.sync.enabled = false;

      var history = sceneSettings.history ? sceneSettings.history.enabled : false;
      if (history)
          sceneSettings.history.enabled = false;

      sceneSettings.patch(data.settings);

      if (data.settings.priority_scripts === undefined && sceneSettings.has('priority_scripts'))
          sceneSettings.unset('priority_scripts');

      if (sync)
          sceneSettings.sync.enabled = sync;

      if (history)
          sceneSettings.history.enabled = true;

      editor.emit('sceneSettings:load', sceneSettings);
  });

  // migrations
  editor.on('sceneSettings:ready', function() {
      // lightmapSizeMultiplier
      if (! sceneSettings.has('render.lightmapSizeMultiplier'))
          sceneSettings.set('render.lightmapSizeMultiplier', 16);

      // lightmapMaxResolution
      if (! sceneSettings.has('render.lightmapMaxResolution'))
          sceneSettings.set('render.lightmapMaxResolution', 2048);

      // lightmapMode
      if (! sceneSettings.has('render.lightmapMode'))
          sceneSettings.set('render.lightmapMode', 0);

      // skyboxIntensity
      if (! sceneSettings.has('render.skyboxIntensity'))
          sceneSettings.set('render.skyboxIntensity', 1);

      // skyboxMip
      if (! sceneSettings.has('render.skyboxMip'))
          sceneSettings.set('render.skyboxMip', 0);
  });

  var onUnload = function() {
      if (sceneSettings.history)
          sceneSettings.history.enabled = false;
      if (sceneSettings.sync)
          sceneSettings.sync.enabled = false;

      sceneSettings.set('render.skybox', null);

      if (sceneSettings.history)
          sceneSettings.history.enabled = true;
      if (sceneSettings.sync)
          sceneSettings.sync.enabled = true;
  };

  editor.on('realtime:disconnected', onUnload);
  editor.on('scene:unload', onUnload);
});


/* editor/settings/scene-settings-history.js */
editor.once('load', function() {
  'use strict';

  editor.on('sceneSettings:load', function(settings) {
      if (settings.history)
          settings.history.destroy();

      settings.history = new ObserverHistory({
          item: settings,
          prefix: 'settings.',
          getItemFn: function () {
              return editor.call('sceneSettings');
          }
      });

      // record history
      settings.history.on('record', function(action, data) {
          editor.call('history:' + action, data);
      });
  });
});


/* editor/settings/scene-settings-sync.js */
editor.once('load', function() {
  'use strict';

  editor.on('sceneSettings:load', function(settings) {
      if (! settings.sync) {
          settings.sync = new ObserverSync({
              item: settings,
              prefix: [ 'settings' ]
          });

          // client > server
          settings.sync.on('op', function(op) {
              editor.call('realtime:scene:op', op);
          });

          // server > client
          editor.on('realtime:scene:op:settings', function(op) {
              settings.sync.write(op);
          });
      }

      editor.emit('sceneSettings:ready');
  });
});


/* editor/settings/settings-attributes-editor.js */
editor.once('load', function() {
  'use strict';

  var settings = editor.call('settings:projectUser');
  var userSettings = editor.call('settings:user');

  var sceneName = 'Untitled';
  editor.on('scene:raw', function(data) {
      editor.emit('scene:name', data.name);
  });
  editor.on('realtime:scene:op:name', function(op) {
      editor.emit('scene:name', op.oi);
  });
  editor.on('scene:name', function(name) {
      sceneName = name;
  });

  var foldStates = {
      'editor': true
  };

  // inspecting
  editor.on('attributes:inspect[editorSettings]', function() {

      var panelScene = editor.call('attributes:addPanel');
      panelScene.class.add('component');

      // scene name
      var fieldName = editor.call('attributes:addField', {
          parent: panelScene,
          name: 'Scene Name',
          type: 'string',
          value: sceneName
      });
      var changingName = false;
      fieldName.on('change', function(value) {
          if (changingName)
              return;

          editor.call('realtime:scene:op', {
              p: [ 'name' ],
              od: sceneName || '',
              oi: value || ''
          });
          editor.emit('scene:name', value);
      });
      var evtNameChange = editor.on('realtime:scene:op:name', function(op) {
          changingName = true;
          fieldName.value = op.oi;
          changingName = false;
      });
      fieldName.on('destroy', function() {
          evtNameChange.unbind();
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:name', fieldName.parent.innerElement.firstChild.ui);


      // editor
      var panel = editor.call('attributes:addPanel', {
          name: 'Editor'
      });
      panel.foldable = true;
      panel.folded = foldStates['editor'];
      panel.on('fold', function() { foldStates['editor'] = true; });
      panel.on('unfold', function() { foldStates['editor'] = false; });
      panel.class.add('component');

      // grid divisions
      var fieldGrid = editor.call('attributes:addField', {
          parent: panel,
          name: 'Grid',
          placeholder: 'Divisions',
          type: 'number',
          precision: 1,
          step: 1,
          min: 0,
          link: settings,
          path: 'editor.gridDivisions'
      });
      fieldGrid.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'settings:grid', fieldGrid.parent.innerElement.firstChild.ui);


      // grid divisions size
      var fieldGridDivisionSize = new ui.NumberField({
          precision: 1,
          step: 1,
          min: 0
      });
      fieldGridDivisionSize.placeholder = 'Size';
      fieldGridDivisionSize.style.width = '32px';
      fieldGridDivisionSize.flexGrow = 1;
      fieldGridDivisionSize.link(settings, 'editor.gridDivisionSize');
      fieldGrid.parent.append(fieldGridDivisionSize);


      // snap increment
      var fieldSnap = editor.call('attributes:addField', {
          parent: panel,
          name: 'Snap',
          type: 'number',
          precision: 2,
          step: 1,
          min: 0,
          placeholder: 'Increment',
          link: settings,
          path: 'editor.snapIncrement'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:snap', fieldSnap.parent.innerElement.firstChild.ui);


      // camera near clip
      var fieldClip = editor.call('attributes:addField', {
          parent: panel,
          name: 'Camera Clip',
          placeholder: 'Near',
          type: 'number',
          precision: 2,
          step: .1,
          min: 0,
          link: settings,
          path: 'editor.cameraNearClip'
      });
      fieldClip.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'settings:cameraClip', fieldClip.parent.innerElement.firstChild.ui);


      // camera far clip
      var fieldFarClip = new ui.NumberField({
          precision: 2,
          step: 1,
          min: 0
      });
      fieldFarClip.placeholder = 'Far';
      fieldFarClip.style.width = '32px';
      fieldFarClip.flexGrow = 1;
      fieldFarClip.link(settings, 'editor.cameraFarClip');
      fieldClip.parent.append(fieldFarClip);


      // clear color
      var fieldClearColor = editor.call('attributes:addField', {
          parent: panel,
          name: 'Clear Color',
          type: 'rgb',
          link: settings,
          path: 'editor.cameraClearColor'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:clearColor', fieldClearColor.parent.innerElement.firstChild.ui);


      // icons size
      var fieldIconsSize = editor.call('attributes:addField', {
          parent: panel,
          name: 'Icons Size',
          type: 'number',
          precision: 2,
          step: .1,
          min: 0,
          link: userSettings,
          path: 'editor.iconSize'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:iconsSize', fieldIconsSize.parent.innerElement.firstChild.ui);


      // local server
      var fieldLocalServer = editor.call('attributes:addField', {
          parent: panel,
          name: 'Local Server',
          type: 'string',
          link: settings,
          path: 'editor.localServer'
      });

      var changingLocalServer = false;
      var oldLocalServer = fieldLocalServer.value;
      fieldLocalServer.on('change', function (value) {
          if (changingLocalServer) return;

          changingLocalServer = true;
          if (! /^http(s)?:\/\/\S+/.test(value)) {
              fieldLocalServer.value = oldLocalServer;
          } else {
              oldLocalServer = value;
          }

          changingLocalServer = false;
      });

      // reference
      editor.call('attributes:reference:attach', 'settings:localServer', fieldLocalServer.parent.innerElement.firstChild.ui);

      var fieldLocale = editor.call('attributes:addField', {
          parent: panel,
          name: 'Locale',
          type: 'string',
          link: settings,
          path: 'editor.locale'
      });

      editor.call('attributes:reference:attach', 'settings:locale', fieldLocale.parent.innerElement.firstChild.ui);

      fieldLocale.parent.hidden = !editor.call('users:hasFlag', 'hasLocalization');

      // chat notification
      var fieldChatNotification = editor.call('attributes:addField', {
          parent: panel,
          name: 'Chat Notification',
          type: 'checkbox'
      });
      var checkChatNotificationState = function() {
          var permission = editor.call('notify:state');

          fieldChatNotification.disabled = permission === 'denied';

          if (permission !== 'granted' && permission !== 'denied')
              fieldChatNotification.value = null;

          if (permission === 'granted') {
              // restore localstorage state
              var granted = editor.call('localStorage:get', 'editor:notifications:chat');
              if (granted === null) {
                  fieldChatNotification.value = true;
              } else {
                  fieldChatNotification.value = granted;
              }
          }
      };
      var evtPermission = editor.on('notify:permission', checkChatNotificationState);
      var evtChatNofityState = editor.on('chat:notify', checkChatNotificationState);
      checkChatNotificationState();
      fieldChatNotification.on('change', function(value) {
          if (editor.call('notify:state') !== 'granted') {
              editor.call('notify:permission');
          } else {
              editor.call('localStorage:set', 'editor:notifications:chat', value);
              editor.emit('chat:notify', value);
              checkChatNotificationState();
          }
      });
      fieldChatNotification.once('destroy', function() {
          evtPermission.unbind();
          evtChatNofityState.unbind();
          evtPermission = null;
          evtChatNofityState = null;
      });
  });
});


/* editor/settings/settings-attributes-scene.js */
editor.once('load', function() {
  'use strict';

  editor.method('editorSettings:panel:unfold', function(panel) {
      var element = editor.call('layout.attributes').dom.querySelector('.ui-panel.component.foldable.' + panel);
      if (element && element.ui) {
          element.ui.folded = false;
      }
  });

  editor.on('attributes:inspect[editorSettings]', function() {
      editor.call('attributes:header', 'Settings');
  });
});


/* editor/settings/settings-attributes-physics.js */
editor.once('load', function() {
  'use strict';

  var sceneSettings = editor.call('sceneSettings');
  var projectSettings = editor.call('settings:project');

  var folded = true;

  editor.on('attributes:inspect[editorSettings]', function() {
      // physics
      var physicsPanel = editor.call('attributes:addPanel', {
          name: 'Physics'
      });
      physicsPanel.foldable = true;
      physicsPanel.folded = folded;
      physicsPanel.on('fold', function() { folded = true; });
      physicsPanel.on('unfold', function() { folded = false; });
      physicsPanel.class.add('component');

      // enable 3d physics
      var fieldPhysics = editor.call('attributes:addField', {
          parent: physicsPanel,
          name: 'Enable',
          type: 'checkbox',
          link: projectSettings,
          path: 'use3dPhysics'
      });
      editor.call('attributes:reference:attach', 'settings:project:physics', fieldPhysics.parent.innerElement.firstChild.ui);

      // gravity
      var fieldGravity = editor.call('attributes:addField', {
          parent: physicsPanel,
          name: 'Gravity',
          placeholder: [ 'X', 'Y', 'Z' ],
          precision: 2,
          step: .1,
          type: 'vec3',
          link: sceneSettings,
          path: 'physics.gravity'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:gravity', fieldGravity[0].parent.innerElement.firstChild.ui);

  });
});


/* editor/settings/settings-attributes-rendering.js */
editor.once('load', function() {
  'use strict';

  var sceneSettings = editor.call('sceneSettings');
  var projectSettings = editor.call('settings:project');

  var folded = true;

  editor.on('attributes:inspect[editorSettings]', function() {
      var app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      var filteredFields = [ ];

      var addFiltered = function (field, filter) {
          filteredFields.push({
              element: field.length ? field[0].parent : field.parent,
              filter: filter
          });
          return field;
      };

      var filter = function () {
          filteredFields.forEach(function (f) {
              f.element.hidden = !f.filter();
          });
      };

      // environment
      var panelRendering = editor.call('attributes:addPanel', {
          name: 'Rendering'
      });
      panelRendering.foldable = true;
      panelRendering.folded = folded;
      panelRendering.on('fold', function() { folded = true; });
      panelRendering.on('unfold', function() { folded = false; });
      panelRendering.class.add('component', 'rendering');

      // ambient
      var fieldGlobalAmbient = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Ambient Color',
          type: 'rgb',
          link: sceneSettings,
          path: 'render.global_ambient'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:ambientColor', fieldGlobalAmbient.parent.innerElement.firstChild.ui);


      // skyboxHover
      var skyboxOld = null;
      var hoverSkybox = null;
      var setSkybox = function() {
          if (! hoverSkybox)
              return;

          app.scene.setSkybox(hoverSkybox.resources);
          editor.call('viewport:render');
      };

      // skybox
      var fieldSkybox = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Skybox',
          type: 'asset',
          kind: 'cubemap',
          link: sceneSettings,
          path: 'render.skybox',
          over: function(type, data) {
              skyboxOld = app.assets.get(sceneSettings.get('render.skybox')) || null;

              hoverSkybox = app.assets.get(parseInt(data.id, 10));
              if (hoverSkybox) {
                  if (sceneSettings.get('render.skyboxMip') === 0)
                      hoverSkybox.loadFaces = true;

                  app.assets.load(hoverSkybox);
                  hoverSkybox.on('load', setSkybox);
                  setSkybox();
              }
          },
          leave: function() {
              if (skyboxOld) {
                  app.scene.setSkybox(skyboxOld.resources)
                  skyboxOld = null;
                  editor.call('viewport:render');
              }
              if (hoverSkybox) {
                  hoverSkybox.off('load', setSkybox);
                  hoverSkybox = null;
              }
          }
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:skybox', fieldSkybox._label);


      // skyboxIntensity
      var fieldSkyboxIntensity = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Intensity',
          type: 'number',
          precision: 3,
          step: .05,
          min: 0,
          link: sceneSettings,
          path: 'render.skyboxIntensity'
      });
      fieldSkyboxIntensity.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'settings:skyboxIntensity', fieldSkyboxIntensity.parent.innerElement.firstChild.ui);

      // skyboxIntensity slider
      var fieldExposureSlider = new ui.Slider({
          min: 0,
          max: 8,
          precision: 3
      });
      fieldExposureSlider.flexGrow = 4;
      fieldExposureSlider.link(sceneSettings, 'render.skyboxIntensity');
      fieldSkyboxIntensity.parent.append(fieldExposureSlider);


      // skyboxMip
      var fieldSkyboxMip = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Mip',
          type: 'number',
          enum: {
              0: '1',
              1: '2',
              2: '3',
              3: '4',
              4: '5'
          },
          link: sceneSettings,
          path: 'render.skyboxMip'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:skyboxMip', fieldSkyboxMip.parent.innerElement.firstChild.ui);


      // divider
      var divider = document.createElement('div');
      divider.classList.add('fields-divider');
      panelRendering.append(divider);


      // tonemapping
      var fieldTonemapping = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Tonemapping',
          type: 'number',
          enum: {
              0: 'Linear',
              1: 'Filmic',
              2: 'Hejl',
              3: 'ACES'
          },
          link: sceneSettings,
          path: 'render.tonemapping'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:toneMapping', fieldTonemapping.parent.innerElement.firstChild.ui);


      // exposure
      var fieldExposure = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Exposure',
          type: 'number',
          precision: 2,
          step: .1,
          min: 0,
          link: sceneSettings,
          path: 'render.exposure'
      });
      fieldExposure.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'settings:exposure', fieldExposure.parent.innerElement.firstChild.ui);


      // exposure slider
      var fieldExposureSlider = new ui.Slider({
          min: 0,
          max: 8,
          precision: 2
      });
      fieldExposureSlider.flexGrow = 4;
      fieldExposureSlider.link(sceneSettings, 'render.exposure');
      fieldExposure.parent.append(fieldExposureSlider);


      // gamma correction
      var fieldGammaCorrection = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Gamma',
          type: 'number',
          enum: {
              0: '1.0',
              1: '2.2'
          },
          link: sceneSettings,
          path: 'render.gamma_correction'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:gammaCorrection', fieldGammaCorrection.parent.innerElement.firstChild.ui);


      // divider
      var divider = document.createElement('div');
      divider.classList.add('fields-divider');
      panelRendering.append(divider);


      // fog type
      var fieldFogType = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Fog',
          type: 'string',
          enum: {
              'none': 'None',
              'linear': 'Linear',
              'exp': 'Exponential',
              'exp2': 'Exponential Squared'
          },
          link: sceneSettings,
          path: 'render.fog'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:fog', fieldFogType.parent.innerElement.firstChild.ui);


      // fog density
      var fieldFogDensity = addFiltered(editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Density',
          type: 'number',
          precision: 3,
          step: .01,
          min: 0,
          link: sceneSettings,
          path: 'render.fog_density'
      }), function () {
          return /^exp/.test(sceneSettings.get('render.fog'));
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:fogDensity', fieldFogDensity.parent.innerElement.firstChild.ui);


      // fog distance near
      var fieldFogDistance = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Distance',
          placeholder: 'Start',
          type: 'number',
          precision: 2,
          step: 1,
          min: 0,
          link: sceneSettings,
          path: 'render.fog_start'
      });
      fieldFogDistance.style.width = '32px';
      addFiltered(fieldFogDistance, function () {
          return sceneSettings.get('render.fog') === 'linear';
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:fogDistance', fieldFogDistance.parent.innerElement.firstChild.ui);


      // fog dinstance far
      var fieldFogEnd = new ui.NumberField({
          precision: 2,
          step: 1,
          min: 0
      });
      fieldFogEnd.placeholder = 'End';
      fieldFogEnd.style.width = '32px';
      fieldFogEnd.flexGrow = 1;
      fieldFogEnd.link(sceneSettings, 'render.fog_end');
      fieldFogDistance.parent.append(fieldFogEnd);

      // fog color
      var fieldFogColor = addFiltered(editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Color',
          type: 'rgb',
          link: sceneSettings,
          path: 'render.fog_color'
      }), function () {
          return sceneSettings.get('render.fog') !== 'none';
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:fogColor', fieldFogColor.parent.innerElement.firstChild.ui);

      // divider
      var divider = document.createElement('div');
      divider.classList.add('fields-divider');
      panelRendering.append(divider);

      // Resolution related
      var fieldWidth = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Resolution',
          placeholder: 'w',
          type: 'number',
          link: projectSettings,
          path: 'width',
          precision: 0,
          min: 1
      });

      editor.call('attributes:reference:attach', 'settings:project:width', fieldWidth);

      var fieldHeight = editor.call('attributes:addField', {
          panel: fieldWidth.parent,
          placeholder: 'h',
          type: 'number',
          link: projectSettings,
          path: 'height',
          precision: 0,
          min: 1
      });
      editor.call('attributes:reference:attach', 'settings:project:height', fieldHeight);

      var fieldResolutionMode = editor.call('attributes:addField', {
          panel: fieldWidth.parent,
          type: 'string',
          enum: {
              'FIXED': 'Fixed',
              'AUTO': 'Auto'
          },
          link: projectSettings,
          path: 'resolutionMode'
      });
      editor.call('attributes:reference:attach', 'settings:project:resolutionMode', fieldResolutionMode);


      var fieldFillMode = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Fill mode',
          type: 'string',
          enum: {
              'NONE': 'None',
              'KEEP_ASPECT': 'Keep aspect ratio',
              'FILL_WINDOW': 'Fill window',
          },
          link: projectSettings,
          path: 'fillMode'
      });
      editor.call('attributes:reference:attach', 'settings:project:fillMode', fieldFillMode.parent.innerElement.firstChild.ui);


      var fieldPreferWebGl2 = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Prefer WebGL 2.0',
          type: 'checkbox',
          link: projectSettings,
          path: 'preferWebGl2'
      });
      fieldPreferWebGl2.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:project:preferWebGl2', fieldPreferWebGl2.parent.innerElement.firstChild.ui);


      var fieldAntiAlias = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Anti-Alias',
          type: 'checkbox',
          link: projectSettings,
          path: 'antiAlias'
      });
      fieldAntiAlias.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:project:antiAlias', fieldAntiAlias.parent.innerElement.firstChild.ui);

      var fieldPixelRatio = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Device Pixel Ratio',
          type: 'checkbox',
          link: projectSettings,
          path: 'useDevicePixelRatio'
      });
      fieldPixelRatio.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:project:pixelRatio', fieldPixelRatio.parent.innerElement.firstChild.ui);


      var fieldTransparentCanvas = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Transparent Canvas',
          type: 'checkbox',
          link: projectSettings,
          path: 'transparentCanvas'
      });
      fieldTransparentCanvas.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:project:transparentCanvas', fieldTransparentCanvas.parent.innerElement.firstChild.ui);

      var fieldPreserveDrawingBuffer = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Preserve Drawing Buffer',
          type: 'checkbox',
          link: projectSettings,
          path: 'preserveDrawingBuffer'
      });
      fieldPreserveDrawingBuffer.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:project:preserveDrawingBuffer', fieldPreserveDrawingBuffer.parent.innerElement.firstChild.ui);

      var fieldVr = editor.call('attributes:addField', {
          parent: panelRendering,
          name: 'Enable VR',
          type: 'checkbox',
          link: projectSettings,
          path: 'vr'
      });
      fieldVr.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:project:vr', fieldVr.parent.innerElement.firstChild.ui);

      filter();

      // filter fields when scene settings change
      var evtFilter = sceneSettings.on('*:set', filter);

      // clean up filter event when one of the panels is destroyed
      panelRendering.on('destroy', function () {
          evtFilter.unbind();
      });

  });
});


/* editor/settings/settings-attributes-layers.js */
editor.once('load', function() {
  'use strict';

  var projectSettings = editor.call('settings:project');

  var folded = true;

  var root = editor.call('layout.root');

  // overlay
  var overlay = new ui.Overlay();
  overlay.class.add('layers-drag');
  overlay.hidden = true;
  root.append(overlay);

  editor.on('attributes:inspect[editorSettings]', function() {
      var events = [];

      var draggedSublayer = null;

      var indexSublayerPanels = {};
      var indexLayerPanels = {};

      var panel = editor.call('attributes:addPanel', {
          name: 'Layers'
      });
      panel.foldable = true;
      panel.folded = folded;
      panel.on('fold', function () {folded = true;});
      panel.on('unfold', function () {folded = false;});
      panel.class.add('component', 'layers');

      // reference
      editor.call('attributes:reference:attach', 'settings:layers', panel, panel.headerElement);

      var fieldNewLayerName = editor.call('attributes:addField', {
          parent: panel,
          name: 'New Layer',
          type: 'string',
          placeholder: 'Name',
      });
      fieldNewLayerName.class.add('new-name');

      var btnAddLayer = editor.call('attributes:addField', {
          parent: panel,
          name: ' ',
          text: 'ADD LAYER',
          type: 'button'
      });
      btnAddLayer.class.add('icon', 'create');

      // Add new layer
      btnAddLayer.on('click', function () {
          var name = fieldNewLayerName.value;

          if (! name) {
              fieldNewLayerName.class.add('error');
              return;
          }

          fieldNewLayerName.class.remove('error');

          var key = createLayer(name);

          if (key) {
              indexLayerPanels[key].folded = false;
              scrollIntoView(indexLayerPanels[key]);
          }
      });

      var panelLayers = new ui.Panel();
      panelLayers.class.add('layers-container');
      panel.append(panelLayers);

      var createLayerPanel = function (key, data, index) {
          var panelEvents = [];

          var panelLayer = new ui.Panel(data.name);
          panelLayer.class.add('component', 'layer');
          panelLayer.element.id = 'layer-panel-' + key;
          panelLayer.foldable = true;
          panelLayer.folded = true;
          indexLayerPanels[key] = panelLayer;

          var isBuiltIn = key <= 4;

          var btnRemove = new ui.Button();
          btnRemove.class.add('remove');
          panelLayer.headerElement.appendChild(btnRemove.element);
          btnRemove.disabled = isBuiltIn;

          // Remove sublayer
          btnRemove.on('click', function () {
              removeLayer(key);
          });

          if (isBuiltIn) {
              var tooltip = Tooltip.attach({
                  target: btnRemove.element,
                  text: 'You cannot delete a built-in layer',
                  align: 'bottom',
                  root: editor.call('layout.root')
              });
          }

          var fieldName = editor.call('attributes:addField', {
              parent: panelLayer,
              name: 'Name',
              type: 'string',
              link: projectSettings,
              path: 'layers.' + key + '.name'
          });

          fieldName.disabled = isBuiltIn;

          fieldName.on('change', function (value) {
              panelLayer.header = value;
          });

          // reference
          editor.call('attributes:reference:attach', 'settings:layers:name', fieldName.parent.innerElement.firstChild.ui);

          var fieldOpaqueSort = editor.call('attributes:addField', {
              parent: panelLayer,
              name: 'Opaque Sort',
              type: 'number',
              enum: [
                  {v: 0, t: 'None'},
                  {v: 1, t: 'Manual'},
                  {v: 2, t: 'Material / Mesh'},
                  {v: 3, t: 'Back To Front'},
                  {v: 4, t: 'Front To Back'}
              ],
              link: projectSettings,
              path: 'layers.' + key + '.opaqueSortMode'
          });

          fieldOpaqueSort.disabled = isBuiltIn;

          // reference
          editor.call('attributes:reference:attach', 'settings:layers:opaqueSort', fieldOpaqueSort.parent.innerElement.firstChild.ui);

          var fieldTransparentSort = editor.call('attributes:addField', {
              parent: panelLayer,
              name: 'Transparent Sort',
              type: 'number',
              enum: [
                  {v: 0, t: 'None'},
                  {v: 1, t: 'Manual'},
                  {v: 2, t: 'Material / Mesh'},
                  {v: 3, t: 'Back To Front'},
                  {v: 4, t: 'Front To Back'}
              ],
              link: projectSettings,
              path: 'layers.' + key + '.transparentSortMode'
          });

          fieldTransparentSort.disabled = isBuiltIn;

          // reference
          editor.call('attributes:reference:attach', 'settings:layers:transparentSort', fieldTransparentSort.parent.innerElement.firstChild.ui);

          panelLayer.on('destroy', function () {
              for (var i = 0; i < panelEvents.length; i++) {
                  panelEvents[i].unbind();
              }
              panelEvents.length = 0;

              if (tooltip)
                  tooltip.destroy();
          });


          var before;
          if (typeof(index) === 'number')
              before = panelLayers.innerElement.childNodes[index];

          if (before) {
              panelLayers.appendBefore(panelLayer, before);
          } else {
              panelLayers.append(panelLayer);
          }
      };

      var createLayer = function (name) {
          var layer = {
              name: name,
              opaqueSortMode: 2,
              transparentSortMode: 3
          };

          var newLayerKey = null;

          var redo = function () {
              var history = projectSettings.history.enabled;
              projectSettings.history.enabled = false;

              // find max key to insert new layer
              var maxKey = 1000; // start at 1000 for user layers
              var layers = projectSettings.get('layers');
              for (var key in layers) {
                  maxKey = Math.max(parseInt(key, 10) + 1, maxKey);
              }

              // create new layer
              newLayerKey = maxKey;

              projectSettings.set('layers.' + newLayerKey, layer);

              projectSettings.history.enabled = history;

              return newLayerKey;
          };

          var undo = function () {
              var history = projectSettings.history.enabled;
              projectSettings.history.enabled = false;

              var transparentIndex = null;
              var opaqueIndex = null;

              // remove any sublayers that might have
              // been created by another user
              var order = projectSettings.get('layerOrder');
              var i = order.length;
              while (i--) {
                  if (order[i].layer === newLayerKey) {
                      projectSettings.remove('layerOrder', i);
                  }
              }

              projectSettings.unset('layers.' + newLayerKey);

              newLayerKey = null;

              projectSettings.history.enabled = history;
          };

          editor.call('history:add', {
              name: 'new layer',
              undo: undo,
              redo: redo
          });

          return redo();
      };

      var addSublayer = function (key, transparent) {
          var redo = function () {
              var history = projectSettings.history.enabled;
              projectSettings.history.enabled = false;

              var order = projectSettings.get('layerOrder');
              for (var i = 0; i < order.length; i++) {
                  if (order[i].layer === key && order[i].transparent === transparent) {
                      // already exists so return
                      return;
                  }
              }

              projectSettings.insert('layerOrder', {
                  layer: key,
                  transparent: transparent,
                  enabled: true
              });

              projectSettings.history.enabled = history;

              return true;
          };

          var undo = function () {
              var history = projectSettings.history.enabled;
              projectSettings.history.enabled = false;

              var order = projectSettings.get('layerOrder');
              for (var i = 0; i < order.length; i++) {
                  if (order[i].layer === key && order[i].transparent === transparent) {
                      projectSettings.remove('layerOrder', i);
                      break;
                  }
              }

              projectSettings.history.enabled = history;
          };


          if (redo()) {
              editor.call('history:add', {
                  name: 'add sublayer',
                  undo: undo,
                  redo: redo
              });
          }
      };

      var removeSublayer = function (key, transparent) {
          var index = null;
          var enabled = false;

          var redo = function () {
              var order = projectSettings.get('layerOrder');

              for (var i = 0, len = order.length; i<len; i++) {
                  if (order[i].layer === key && order[i].transparent === transparent) {
                      index = i;
                      enabled = order[i].enabled;
                      break;
                  }
              }

              var history = projectSettings.history.enabled;
              projectSettings.history.enabled = false;

              if (index !== null) {
                  projectSettings.remove('layerOrder', index);
              }

              projectSettings.history.enabled = history;
          };

          var undo = function () {
              if (index === null) return;

              var history = projectSettings.history.enabled;
              projectSettings.history.enabled = false;

              // check if the sublayer already exists
              var order = projectSettings.get('layerOrder');

              for (var i = 0, len = order.length; i<len; i++) {
                  if (order[i].layer === key && order[i].transparent === transparent) {
                      // layer already exists so return
                      return;
                  }
              }

              projectSettings.insert('layerOrder', {
                  layer: key,
                  transparent: transparent,
                  enabled: enabled
              }, Math.min(index, order.length));

              index = null;
              enabled = false;

              projectSettings.history.enabled = history;
          };

          editor.call('history:add', {
              name: 'remove sublayer',
              undo: undo,
              redo: redo
          });

          redo();
      };

      var removeLayer = function (key) {
          var prev = null;
          var prevSublayers = [];

          var redo = function () {
              var history = projectSettings.history.enabled;
              projectSettings.history.enabled = false;
              prev = projectSettings.get('layers.' + key);
              projectSettings.unset('layers.' + key);

              var order = projectSettings.get('layerOrder');
              var i = order.length;
              while (i--) {
                  if (order[i].layer === key) {
                      projectSettings.remove('layerOrder', i);
                      prevSublayers.unshift({
                          index: i,
                          transparent: order[i].transparent,
                          enabled: order[i].enabled
                      });
                  }
              }

              projectSettings.history.enabled = history;
          };

          var undo = function () {
              var history = projectSettings.history.enabled;
              projectSettings.history.enabled = false;
              projectSettings.set('layers.' + key, prev);

              var layerOrder = projectSettings.getRaw('layerOrder');

              for (var i = 0; i < prevSublayers.length; i++) {
                  var idx = prevSublayers[i].index;
                  var transparent = prevSublayers[i].transparent;
                  var enabled = prevSublayers[i].enabled;
                  projectSettings.insert('layerOrder', {
                      layer: key,
                      transparent: transparent,
                      enabled: enabled
                  },  Math.min(idx, layerOrder.length));
              }

              prevSublayers.length = 0;
              prev = null;

              projectSettings.history.enabled = history;
          };

          editor.call('history:add', {
              name: 'remove layer',
              undo: undo,
              redo: redo
          });

          redo();
      };

      var scrollIntoView = function (panel) {
          var attributesPanel = editor.call('attributes.rootPanel');
          var parentRect = attributesPanel.innerElement.getBoundingClientRect();
          var rect = panel.element.getBoundingClientRect();
          var diff;
          if (rect.bottom > parentRect.bottom) {
              diff = rect.bottom - parentRect.bottom;
              attributesPanel.content.dom.scrollTop += diff;
          } else if (rect.top < parentRect.top) {
              diff = parentRect.top - rect.top;
              attributesPanel.content.dom.scrollTop -= diff;
          }
      };

      var panelRenderOrder = editor.call('attributes:addPanel', {
          parent: panel,
          name: 'RENDER ORDER'
      });
      panelRenderOrder.foldable = true;
      panelRenderOrder.folded = false;
      panelRenderOrder.class.add('layer-order');

      // reference
      editor.call('attributes:reference:attach', 'settings:layers:sublayers', panelRenderOrder, panelRenderOrder.headerElement);

      // add sublayer to order
      var panelAddSublayer = editor.call('attributes:addPanel', {
          parent: panelRenderOrder
      });
      panelAddSublayer.class.add('add-sublayer');

      var lastAutoCompleteText = null;
      var highlightedAutoCompleteItem = null;
      var inputAddSublayer = new ui.TextField();
      inputAddSublayer.blurOnEnter = false;
      inputAddSublayer.renderChanges = false;
      inputAddSublayer.keyChange = true;
      panelAddSublayer.append(inputAddSublayer);

      inputAddSublayer.on('input:focus', function () {
          autoComplete.hidden = false;
          focusFirstAutocomplete();
      });

      inputAddSublayer.on('input:blur', function () {
          autoComplete.hidden = true;
          highlightedAutoCompleteItem = null;
          for (var key in autoComplete.index) {
              for (var field in autoComplete.index[key][field]) {
                  autoComplete.index[key][field].class.remove('active');
              }
          }
      });

      inputAddSublayer.on('change', function (value) {
          if (lastAutoCompleteText === value)
              return;

          lastAutoCompleteText = value;
          if (value) {
              inputAddSublayer.class.add('not-empty');

              var items = [];
              for (var key in autoComplete.index) {
                  if (autoComplete.index[key].transparent) {
                      items.push([autoComplete.index[key].transparent.item.text, {key: key, transparent: true}]);
                      autoComplete.index[key].transparent.item.class.remove('active');
                  }
                  if (autoComplete.index[key].opaque) {
                      items.push([autoComplete.index[key].opaque.item.text, {key: key, transparent: false}]);
                      autoComplete.index[key].opaque.item.class.remove('active');
                  }
              }

              var search = editor.call('search:items', items, value) ;
              var searchIndex = {};
              for (var i = 0; i < search.length; i++) {
                  if (! searchIndex[search[i].key]) {
                      searchIndex[search[i].key] = {};
                  }
                  searchIndex[search[i].key][search[i].transparent ? 'transparent' : 'opaque'] = true;
              }

              for (var key in autoComplete.index) {
                  if (autoComplete.index[key].transparent) {
                      autoComplete.index[key].transparent.item.hidden = !searchIndex[key] || !searchIndex[key].transparent;
                  }

                  if (autoComplete.index[key].opaque) {
                      autoComplete.index[key].opaque.item.hidden = !searchIndex[key] || !searchIndex[key].opaque;
                  }
              }
          } else {
              inputAddSublayer.class.remove('not-empty');

              for (var key in autoComplete.index) {
                  if (autoComplete.index[key].transparent) {
                      autoComplete.index[key].transparent.item.hidden = false;
                      autoComplete.index[key].transparent.item.class.remove('active');
                  }

                  if (autoComplete.index[key].opaque) {
                      autoComplete.index[key].opaque.item.hidden = false;
                      autoComplete.index[key].opaque.item.class.remove('active');
                  }
              }
          }

          focusFirstAutocomplete();
      });

      var focusFirstAutocomplete = function() {
          var first = autoComplete.innerElement.firstChild;
          var found = false;
          while(! found && first) {
              if (first.ui && ! first.ui.hidden) {
                  found = true;
                  break;
              }
              first = first.nextSibling;
          }

          if (found && first && first.ui) {
              highlightedAutoCompleteItem = first.ui;
              highlightedAutoCompleteItem.class.add('active');
          } else {
              highlightedAutoCompleteItem = null;
          }
      };

      var onInputKeyDown = function (evt) {
          var candidate, found;
          var findFirst = false;
          var direction = '';

          if (evt.keyCode === 40 || (evt.keyCode === 9 && ! evt.shiftKey)) {
              // down
              if (highlightedAutoCompleteItem) {
                  direction = 'nextSibling';
              } else {
                  findFirst = true;
              }

              evt.preventDefault();
          } else if (evt.keyCode === 38 || (evt.keyCode === 9 && evt.shiftKey)) {
              // up
              if (highlightedAutoCompleteItem) {
                  direction = 'previousSibling';
              } else {
                  findFirst = true;
              }

              evt.preventDefault();
          } else if (evt.keyCode === 13) {
              // enter
              if (highlightedAutoCompleteItem) {
                  addSublayer(highlightedAutoCompleteItem.layerKey, highlightedAutoCompleteItem.transparent);
                  inputAddSublayer.value = '';
                  inputAddSublayer.elementInput.blur();
              } else {
                  findFirst = true;
              }
          }

          if (findFirst) {
              // try finding first available option
              candidate = autoComplete.innerElement.firstChild;
              found = false;

              while(! found && candidate) {
                  if (candidate.ui && ! candidate.ui.hidden) {
                      found = true;
                      break;
                  }
                  candidate = candidate.nextSibling;
              }

              if (found && candidate && candidate.ui) {
                  highlightedAutoCompleteItem = candidate.ui;
                  highlightedAutoCompleteItem.class.add('active');
              }

              if (evt.keyCode === 13) {
                  if (highlightedAutoCompleteItem) {
                      addSublayer(highlightedAutoCompleteItem.layerKey, highlightedAutoCompleteItem.transparent);
                  }

                  inputAddSublayer.elementInput.blur();
              }
          } else if (direction) {
              // try finding next or previous available option
              candidate = highlightedAutoCompleteItem.element[direction];
              found = false;

              while(! found && candidate) {
                  if (candidate.ui && ! candidate.ui.hidden) {
                      found = true;
                      break;
                  }
                  candidate = candidate[direction];
              }
              if (candidate && candidate.ui) {
                  highlightedAutoCompleteItem.class.remove('active');
                  highlightedAutoCompleteItem = candidate.ui;
                  highlightedAutoCompleteItem.class.add('active');
              }
          }
      };

      inputAddSublayer.elementInput.addEventListener('keydown', onInputKeyDown);
      inputAddSublayer.once('destroy', function () {
          inputAddSublayer.elementInput.removeEventListener('keydown', onInputKeyDown);
      });

      var autoComplete = new ui.List();
      autoComplete.empty = true;
      autoComplete.hidden = true;
      autoComplete.index = {};
      panelAddSublayer.append(autoComplete);

      var addAutoCompleteItem = function (layerKey, transparent) {
          if (autoComplete.index[layerKey] && autoComplete.index[layerKey][transparent ? 'transparent' : 'opaque']) {
              return;
          }

          if (transparent) {
              if (layerKey === LAYERID_DEPTH || layerKey === LAYERID_SKYBOX) {
                  return;
              }
          } else if (layerKey === LAYERID_UI) {
              return;
          }

          var item = new ui.ListItem({
              text: projectSettings.get('layers.' + layerKey + '.name') + (transparent ? ' Transparent' : ' Opaque')
          });
          item.element.addEventListener('mousedown', function () {
              addSublayer(layerKey, transparent);
          });
          item.layerKey = layerKey;
          item.transparent = transparent;

          autoComplete.append(item);

          if (! autoComplete.index[layerKey]) {
              autoComplete.index[layerKey] = {};
          }

          var entry = {
              item: item
          };

          // listen to name change to update the item's text
          entry.evtName = projectSettings.on('layers.' + layerKey + '.name:set', function (value) {
              item.text = value + (transparent ? ' Transparent' : ' Opaque');
          });

          autoComplete.index[layerKey][transparent ? 'transparent' : 'opaque'] = entry;

          return item;
      };

      var removeAutoCompleteItem = function (layerKey, transparent) {
          if (! autoComplete.index[layerKey]) return;
          var field = transparent ? 'transparent' : 'opaque';
          var entry = autoComplete.index[layerKey][field];
          if (! entry) return;

          entry.item.destroy();
          entry.evtName.unbind();

          delete autoComplete.index[layerKey][field];
          if (! Object.keys(autoComplete.index[layerKey]).length) {
              delete autoComplete.index[layerKey];
          }
      };

      var panelSublayers = editor.call('attributes:addPanel', {
          parent: panelRenderOrder
      });
      panelSublayers.class.add('sublayers', 'component');

      var createSublayerPanel = function (key, transparent, enabled, index) {
          var panelEvents = [];
          var tooltips = [];

          var panelSublayer = new ui.Panel();
          panelSublayer.class.add('sublayer');

          var isBuiltIn = (key <= 4);

          if (transparent)
              panelSublayer.class.add('transparent');

          if (! indexSublayerPanels[key]) {
              indexSublayerPanels[key] = {
                  opaque: null,
                  transparent: null
              };
          }

          if (transparent) {
              indexSublayerPanels[key].transparent = panelSublayer;
          } else {
              indexSublayerPanels[key].opaque = panelSublayer;
          }

          var fieldHandle = document.createElement('div');
          fieldHandle.classList.add('handle');
          panelSublayer.append(fieldHandle);

          var onDragStart = function (evt) {
              draggedSublayer = {
                  key: key,
                  transparent: transparent,
                  index: Array.prototype.indexOf.call(panelSublayers.innerElement.childNodes, panelSublayer.element)
              };

              panel.class.add('dragged');
              panelSublayer.class.add('dragged');

              window.addEventListener('mouseup', onDragEnd);
              panelSublayers.innerElement.addEventListener('mousemove', onDragMove);

              overlay.hidden = false;
          };

          fieldHandle.addEventListener('mousedown', onDragStart);

          // name
          var fieldName = new ui.Label({
              text: projectSettings.get('layers.' + key + '.name')
          });
          fieldName.class.add('name');
          panelSublayer.append(fieldName);
          panelSublayer.fieldName = fieldName;

          panelEvents.push(projectSettings.on('layers.' + key + '.name:set', function (value) {
              fieldName.value = value;
          }));

          // transparent
          var fieldTransparent = new ui.Label({
              text: transparent ? 'Transparent' : 'Opaque'
          });
          fieldTransparent.class.add('transparent');
          panelSublayer.append(fieldTransparent);

          // reference
          editor.call('attributes:reference:attach', 'settings:layers:sublayers:' + (transparent ? 'transparent' : 'opaque'), fieldTransparent);

          // enabled
          var fieldEnabled = new ui.Checkbox();
          fieldEnabled.class.add('tick');
          panelSublayer.append(fieldEnabled);
          fieldEnabled.value = enabled;
          panelSublayer.fieldEnabled = fieldEnabled;

          // reference
          editor.call('attributes:reference:attach', 'settings:layers:sublayers:enabled', fieldEnabled);

          fieldEnabled.on('change', function (value) {
              var order = projectSettings.get('layerOrder');
              for (var i = 0; i < order.length; i++) {
                  if (order[i].layer === key && order[i].transparent === transparent) {
                      projectSettings.set('layerOrder.' + i + '.enabled', value);
                      break;
                  }
              }
          });

          // remove
          var btnRemove = new ui.Button();
          btnRemove.class.add('remove');
          panelSublayer.append(btnRemove);

          btnRemove.disabled = isBuiltIn;

          if (isBuiltIn) {
              tooltips.push(Tooltip.attach({
                  target: btnRemove.element,
                  text: 'You cannot delete a built-in layer',
                  align: 'bottom',
                  root: editor.call('layout.root')
              }));
          }


          // Remove sublayer
          btnRemove.on('click', function () {
              removeSublayer(key, transparent);
          });

          panelSublayer.on('destroy', function () {
              fieldHandle.removeEventListener('mousedown', onDragStart);
              if (panelSublayer.class.contains('dragged')) {
                  panelSublayers.innerElement.removeEventListener('mousemove', onDragMove);
                  window.removeEventListener('mouseup', onDragEnd);
              }

              var i, len;
              for (i = 0, len = panelEvents.length; i<len; i++) {
                  panelEvents[i].unbind();
              }
              panelEvents.length = 0;

              for (i = 0, len = tooltips.length; i<len; i++) {
                  tooltips[i].destroy();
              }
              tooltips.length = 0;
          });

          var before = null;

          if (typeof(index) === 'number')
              before = panelSublayers.innerElement.childNodes[index];

          if (before) {
              panelSublayers.appendBefore(panelSublayer, before);
          } else {
              panelSublayers.append(panelSublayer);
          }
      };

      // Move dragged sublayer
      var onDragMove = function (evt) {
          var draggedPanel = indexSublayerPanels[draggedSublayer.key][draggedSublayer.transparent ? 'transparent' : 'opaque'];
          var rect = panelSublayers.innerElement.getBoundingClientRect();
          var height = draggedPanel.element.offsetHeight;
          var top = evt.clientY - rect.top - 6;
          var overPanelIndex = Math.floor(top / height);
          var overPanel = panelSublayers.innerElement.childNodes[overPanelIndex];

          if (overPanel && overPanel.ui !== draggedPanel) {
              panelSublayers.remove(draggedPanel);
              panelSublayers.appendBefore(draggedPanel, panelSublayers.innerElement.childNodes[overPanelIndex]);
          }
      };

      // End sublayer drag
      var onDragEnd = function (evt) {
          var draggedPanel = indexSublayerPanels[draggedSublayer.key][draggedSublayer.transparent ? 'transparent' : 'opaque'];
          if (draggedPanel) {
              draggedPanel.class.remove('dragged');
          }
          panel.class.remove('dragged');
          window.removeEventListener('mouseup', onDragEnd);
          panelSublayers.innerElement.removeEventListener('mousemove', onDragMove);

          overlay.hidden = true;

          var oldIndex = draggedSublayer.index;
          var newIndex = Array.prototype.indexOf.call(panelSublayers.innerElement.childNodes, draggedPanel.element);

          if (newIndex !== oldIndex) {
              // NOTE: If a remote user moves the same indices then undoing this move
              // will move the wrong items.
              projectSettings.move('layerOrder', oldIndex, newIndex);
          }

          draggedSublayer = null;

      };

      // Create sublayer panels
      var init = function () {
          var layers = projectSettings.get('layers');
          for (var key in layers) {
              createLayerPanel(parseInt(key, 10), layers[key]);
          }

          var index = {};

          var order = projectSettings.get('layerOrder');
          for (var i = 0, len = order.length; i<len; i++) {
              var layer = layers[order[i].layer];
              if (layer) {
                  var transparent = order[i].transparent;
                  createSublayerPanel(order[i].layer, transparent, order[i].enabled);
                  if (! index[order[i].layer]) {
                      index[order[i].layer] = {};
                  }

                  index[order[i].layer][transparent ? 'transparent' : 'opaque'] = true;
              }
          }

          // Add missing items to autoComplete
          for (var key in layers) {
              key = parseInt(key, 10);
              if (! index[key]) {
                  addAutoCompleteItem(key, false);
                  addAutoCompleteItem(key, true);
              } else if (! index[key].opaque) {
                  addAutoCompleteItem(key, false);
              } else if (! index[key].transparent) {
                  addAutoCompleteItem(key, true);
              }
          }
      };

      init();

      // On layer removed
      events.push(projectSettings.on('*:unset', function (path) {
          var match = path.match(/^layers\.(\d+)$/);
          if (! match) return;

          var key = match[1];
          if (indexLayerPanels[key]) {
              indexLayerPanels[key].destroy();
              delete indexLayerPanels[key];
          }

          removeAutoCompleteItem(key, true);
          removeAutoCompleteItem(key, false);
      }));

      events.push(projectSettings.on('*:set', function (path, value) {
          // On layer added
          var match = path.match(/^layers\.(\d+)$/);
          if (match) {
              var key = parseInt(match[1], 10);
              if (indexLayerPanels[key]) {
                  indexLayerPanels[key].destroy();
              }

              var layers = projectSettings.get('layers');
              var index = Object.keys(layers).indexOf(key);

              createLayerPanel(key, layers[key], index);

              addAutoCompleteItem(key, false);
              addAutoCompleteItem(key, true);
          }

          // on layerOrder enabled
          var match = path.match(/^layerOrder\.(\d+)\.enabled$/);
          if (match) {
              var order = projectSettings.get('layerOrder.' + match[1]);
              if (order) {
                  var key = order.layer;
                  var field = order.transparent ? 'transparent' : 'opaque';
                  if (indexSublayerPanels[key] && indexSublayerPanels[key][field]) {
                      indexSublayerPanels[key][field].fieldEnabled.value = value;
                  }
              }
          }

      }));

      // On sublayer removed
      events.push(projectSettings.on('layerOrder:remove', function (value, index) {
          var key = value.get('layer');
          var transparent = value.get('transparent');
          var field = transparent ? 'transparent' : 'opaque';
          var otherField = transparent ? 'opaque' : 'transparent';

          if (indexSublayerPanels[key] && indexSublayerPanels[key][field]) {
              indexSublayerPanels[key][field].destroy();
              indexSublayerPanels[key][field] = null;
              if (! indexSublayerPanels[key][otherField]) {
                  delete indexSublayerPanels[key];
              }
          }

          addAutoCompleteItem(key, transparent);
      }));

      // on sublayer added
      events.push(projectSettings.on('layerOrder:insert', function (value, index, remote) {
          var key = value.get('layer');
          var transparent = value.get('transparent');
          var field = transparent ? 'transparent' : 'opaque';
          var enabled = value.get('enabled');
          if (! indexSublayerPanels[key] || ! indexSublayerPanels[key][field]) {
              var name = projectSettings.get('layers.' + key + '.name');
              createSublayerPanel(key, transparent, enabled, index);
          }

          removeAutoCompleteItem(key, transparent);
      }));

      // on sublayer moved
      events.push(projectSettings.on('layerOrder:move', function (value, indNew, indOld) {
          var key = value.get('layer');
          var transparent = value.get('transparent');

          if (! indexSublayerPanels[key]) return;

          var movedPanel = indexSublayerPanels[key][transparent ? 'transparent' : 'opaque'];
          if (! movedPanel) return;

          var index = Array.prototype.indexOf.call(panelSublayers.innerElement.childNodes, movedPanel.element);
          if (index === indOld) {
              panelSublayers.remove(movedPanel);
              panelSublayers.appendBefore(movedPanel, panelSublayers.innerElement.childNodes[indNew]);
          }
      }));

      // Clean up
      panel.once('destroy', function() {
          for (var i = 0, len = events.length; i<len; i++) {
              events[i].unbind();
          }
          events = null;

          for (var key in autoComplete.index) {
              if (autoComplete.index[key].transparent) {
                  autoComplete.index[key].transparent.evtName.unbind();
              }

              if (autoComplete.index[key].opaque) {
                  autoComplete.index[key].opaque.evtName.unbind();
              }
          }

          autoComplete.index = {};
      });
  });

  // Focus layer UI - only works if settings are open
  editor.method('editorSettings:layers:focus', function (layerId) {
      editor.call('editorSettings:panel:unfold', 'layers');
      var panel = document.getElementById('layer-panel-' + layerId);
      if (panel && panel.ui) {
          panel.ui.folded = false;
      }
  });
});


/* editor/settings/settings-attributes-lightmapping.js */
editor.once('load', function() {
  'use strict';

  var sceneSettings = editor.call('sceneSettings');

  var folded = true;

  editor.on('attributes:inspect[editorSettings]', function() {
      // lightmapping
      var panelLightmapping = editor.call('attributes:addPanel', {
          name: 'Lightmapping'
      });
      panelLightmapping.foldable = true;
      panelLightmapping.folded = folded;
      panelLightmapping.on('fold', function() { folded = true; });
      panelLightmapping.on('unfold', function() { folded = false; });
      panelLightmapping.class.add('component', 'lightmapping');

      // lightmapSizeMultiplier
      var fieldLightmapSizeMultiplier = editor.call('attributes:addField', {
          parent: panelLightmapping,
          name: 'Size Multiplier',
          type: 'number',
          min: 0,
          link: sceneSettings,
          path: 'render.lightmapSizeMultiplier'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:lightmapSizeMultiplier', fieldLightmapSizeMultiplier.parent.innerElement.firstChild.ui);

      // lightmapMaxResolution
      var fieldLightmapMaxResolution = editor.call('attributes:addField', {
          parent: panelLightmapping,
          name: 'Max Resolution',
          type: 'number',
          min: 2,
          link: sceneSettings,
          path: 'render.lightmapMaxResolution'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:lightmapMaxResolution', fieldLightmapMaxResolution.parent.innerElement.firstChild.ui);


      // lightmapMode
      var fieldLightmapMode = editor.call('attributes:addField', {
          parent: panelLightmapping,
          name: 'Mode',
          type: 'number',
          enum: {
              0: "Color Only",
              1: "Color and Direction"
          },
          link: sceneSettings,
          path: 'render.lightmapMode'
      });
      // reference
      editor.call('attributes:reference:attach', 'settings:lightmapMode', fieldLightmapMode.parent.innerElement.firstChild.ui);

  });
});


/* editor/settings/settings-attributes-audio.js */
editor.once('load', function() {
  'use strict';

  var projectSettings = editor.call('settings:project');

  var folded = true;

  editor.on('attributes:inspect[editorSettings]', function() {
      if (projectSettings.has('useLegacyAudio')) {

          var panelAudio = editor.call('attributes:addPanel', {
              name: 'Audio'
          });
          panelAudio.foldable = true;
          panelAudio.folded = folded;
          panelAudio.on('fold', function() { folded = true; });
          panelAudio.on('unfold', function() { folded = false; });
          panelAudio.class.add('component', 'audio');

          var fieldLegacyAudio = editor.call('attributes:addField', {
              parent: panelAudio,
              name: 'Use Legacy Audio',
              type: 'checkbox',
              link: projectSettings,
              path: 'useLegacyAudio'
          });
          fieldLegacyAudio.parent.innerElement.firstChild.style.width = 'auto';
          editor.call('attributes:reference:attach', 'settings:project:useLegacyAudio', fieldLegacyAudio.parent.innerElement.firstChild.ui);
      }
  });
});


/* editor/settings/settings-attributes-scripts-priority.js */
editor.once('load', function() {
  'use strict';

  if (! editor.call('settings:project').get('useLegacyScripts'))
      return;

  var sceneSettings = editor.call('sceneSettings');
  var sourcefiles = null;
  var priorityScripts = [];

  var refreshPriorityList = function () {
      priorityList.clear();

      if (priorityScripts.length === 0) {
          var item = new ui.ListItem();
          priorityList.append(item);
      } else {
          priorityScripts.forEach(function (script, index) {
              var item = new ui.ListItem();
              item.text = script;

              var moveUp = new ui.Button();
              moveUp.class.add('move-up');
              if (index) {
                  moveUp.on("click", function () {
                      var index = priorityScripts.indexOf(script);
                      priorityScripts.splice(index, 1);
                      priorityScripts.splice(index-1, 0, script);
                      sceneSettings.set("priority_scripts", priorityScripts);
                      refreshPriorityList();
                  });
              } else {
                  moveUp.class.add('not-visible')
              }

              var moveDown = new ui.Button();
              moveDown.class.add('move-down');
              if (index < priorityScripts.length-1) {
                  moveDown.on("click", function () {
                      var index = priorityScripts.indexOf(script);
                      priorityScripts.splice(index, 1);
                      priorityScripts.splice(index+1, 0, script);
                      sceneSettings.set("priority_scripts", priorityScripts);
                      refreshPriorityList();
                  });
              } else {
                  moveDown.class.add('not-visible');
              }

              var remove = new ui.Button();
              remove.class.add('remove');
              remove.on("click", function () {
                  var index = priorityScripts.indexOf(script);
                  priorityScripts.splice(index, 1);
                  sceneSettings.set("priority_scripts", priorityScripts);
                  refreshPriorityList();
              });

              item.element.insertBefore(remove.element, item.element.lastChild);
              item.element.insertBefore(moveDown.element, item.element.lastChild);
              item.element.insertBefore(moveUp.element, item.element.lastChild);

              priorityList.append(item);
          });
      }
  };

  editor.on('sourcefiles:load', function (obs) {
      sourcefiles = obs;
  });

  var root = editor.call('layout.root');

  var overlay = new ui.Overlay();
  overlay.class.add("script-priorities");
  overlay.hidden = true;

  var label = new ui.Label();
  label.text = "Script Loading Priority";
  label.class.add('title');
  overlay.append(label);

  var description = new ui.Label();
  description.text = "Scripts in the priority list are loaded first in the order that they are listed. Other scripts are loaded in an unspecified order.";
  description.class.add('description');
  overlay.append(description);

  var panel = new ui.Panel();
  overlay.append(panel);

  // Add new script button
  var button = new ui.Button();
  button.text = "Add Script";
  button.class.add('add-script');
  button.on("click", function (evt) {
      // use asset-picker to select script
      overlay.hidden = true;
      editor.once("picker:asset", function (asset) {
          overlay.hidden = false;
          var value = asset.get("filename");
          if (priorityScripts.indexOf(value) < 0) {
              priorityScripts.push(value);
              if (sceneSettings.has('priority_scripts')) {
                  sceneSettings.insert("priority_scripts", value);
              } else {
                  sceneSettings.set('priority_scripts', priorityScripts);
              }
              refreshPriorityList();
          }
      });
      editor.once("picker:asset:close", function (asset) {
          overlay.hidden = false;
      });

      // show asset picker
      editor.call("picker:asset", { type: "script" });
  });
  overlay.append(button);

  var priorityList = new ui.List();
  sceneSettings.on("priority_scripts:set", function (scripts) {
      priorityScripts = scripts.slice();
      refreshPriorityList();
  });
  sceneSettings.on("priority_scripts:unset", function () {
      priorityScripts = [];
      refreshPriorityList();
  });
  panel.append(priorityList);

  root.append(overlay);

  // esc > no
  editor.call('hotkey:register', 'sceneSettings:priorityScripts:close', {
      key: 'esc',
      callback: function() {
          if (overlay.hidden)
              return;

          overlay.hidden = true;
      }
  });

  editor.method('sceneSettings:priorityScripts', function () {
      overlay.hidden = false;
      refreshPriorityList();
  });
});


/* editor/settings/settings-attributes-batch-groups.js */
editor.once('load', function() {
  'use strict';

  var projectSettings = editor.call('settings:project');

  var foldStates = {
      'batchGroups': true,
  };

  editor.on('attributes:inspect[editorSettings]', function() {
      // batch groups
      var panelBatchGroups = editor.call('attributes:addPanel', {
          name: 'Batch Groups'
      });
      panelBatchGroups.foldable = true;
      panelBatchGroups.folded = foldStates['batchGroups'];
      panelBatchGroups.on('fold', function () { foldStates['batchGroups'] = true; });
      panelBatchGroups.on('unfold', function () { foldStates['batchGroups'] = false; });
      panelBatchGroups.class.add('component', 'batching');

      // reference
      editor.call('attributes:reference:attach', 'settings:batchGroups', panelBatchGroups, panelBatchGroups.headerElement);

      var batchGroupPanels = {};

      var createBatchGroupPanel = function (group) {
          var groupId = group.id || group.get('id');

          var panelGroup = new ui.Panel(group.name || group.get('name'));
          panelGroup.element.id = 'batchgroup-panel-' + groupId;
          panelGroup.class.add('batch-group');
          panelGroup.foldable = true;
          panelGroup.folded = true;

          // button to remove batch group
          var btnRemove = new ui.Button();
          btnRemove.class.add('remove');
          panelGroup.headerElement.appendChild(btnRemove.element);

          // remove batch group and clear entity references
          btnRemove.on('click', function () {
              var oldValue = projectSettings.get('batchGroups.' + groupId);
              var affectedModels = [];
              var affectedElements = [];

              var redo = function () {
                  var settingsHistory = projectSettings.history.enabled;
                  projectSettings.history.enabled = false;
                  projectSettings.unset('batchGroups.' + groupId);
                  projectSettings.history.enabled = settingsHistory;

                  var entities = editor.call('entities:list');
                  for (var i = 0, len = entities.length; i < len; i++) {
                      var entity = entities[i];

                      if (entity.get('components.model.batchGroupId') === groupId) {
                          var history = entity.history.enabled;
                          entity.history.enabled = false;
                          affectedModels.push(entity.get('resource_id'));
                          entity.set('components.model.batchGroupId', null);
                          entity.history.enabled = history;
                      }

                      if (entity.get('components.element.batchGroupId') === groupId) {
                          var history = entity.history.enabled;
                          entity.history.enabled = false;
                          affectedElements.push(entity.get('resource_id'));
                          entity.set('components.element.batchGroupId', null);
                          entity.history.enabled = history;
                      }
                  }
              };

              var undo = function () {
                  var settingsHistory = projectSettings.history.enabled;
                  projectSettings.history.enabled = false;
                  projectSettings.set('batchGroups.' + groupId, oldValue);
                  projectSettings.history.enabled = settingsHistory;

                  for (var i = 0, len = affectedModels.length; i < len; i++) {
                      var entity = editor.call('entities:get', affectedModels[i]);
                      if (! entity) continue;

                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      entity.set('components.model.batchGroupId', groupId);
                      entity.history.enabled = history;
                  }
                  affectedModels.length = 0;

                  for (var i = 0, len = affectedElements.length; i < len; i++) {
                      var entity = editor.call('entities:get', affectedElements[i]);
                      if (! entity) continue;

                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      entity.set('components.element.batchGroupId', groupId);
                      entity.history.enabled = history;
                  }
                  affectedElements.length = 0;
              };

              editor.call('history:add', {
                  name: 'projectSettings.batchGroups.' + groupId,
                  undo: undo,
                  redo: redo
              });

              redo();
          });

          // group name
          var fieldName = editor.call('attributes:addField', {
              parent: panelGroup,
              name: 'Name',
              type: 'string'
          });
          fieldName.class.add('field-batchgroup-name');
          fieldName.value = panelGroup.header;

          // reference
          editor.call('attributes:reference:attach', 'settings:batchGroups:name', fieldName.parent.innerElement.firstChild.ui);

          var suspendEvents = false;
          var evtName = projectSettings.on('batchGroups.' + groupId + '.name:set', function (value) {
              suspendEvents = true;
              fieldName.value = value;
              panelGroup.header = value;
              suspendEvents = false;
          });

          fieldName.on('change', function (value) {
              if (suspendEvents) return;

              if (! value) {
                  fieldName.class.add('error');
                  fieldName.focus();
                  return;
              } else {
                  var batchGroups = projectSettings.get('batchGroups');
                  for (var key in batchGroups) {
                      if (batchGroups[key].name === value) {
                          fieldName.class.add('error');
                          fieldName.focus();
                          return;
                      }
                  }

                  fieldName.class.remove('error');
                  projectSettings.set('batchGroups.' + groupId + '.name', value);
              }
          });

          // dynamic
          var fieldDynamic = editor.call('attributes:addField', {
              parent: panelGroup,
              name: 'Dynamic',
              type: 'checkbox',
              link: projectSettings,
              path: 'batchGroups.' + groupId + '.dynamic'
          });

          // reference
          editor.call('attributes:reference:attach', 'settings:batchGroups:dynamic', fieldDynamic.parent.innerElement.firstChild.ui);

          // max aabb size
          var fieldMaxAabb = editor.call('attributes:addField', {
              parent: panelGroup,
              name: 'Max AABB',
              type: 'number',
              min: 0,
              link: projectSettings,
              path: 'batchGroups.' + groupId + '.maxAabbSize'
          });

          // reference
          editor.call('attributes:reference:attach', 'settings:batchGroups:maxAabbSize', fieldMaxAabb.parent.innerElement.firstChild.ui);

          // layers
          var layers = projectSettings.get('layers');
          var layersEnum = {
              '': ''
          };
          for (var key in layers) {
              layersEnum[key] = layers[key].name;
          }
          delete layersEnum[LAYERID_DEPTH];
          delete layersEnum[LAYERID_SKYBOX];
          delete layersEnum[LAYERID_IMMEDIATE];

          var fieldLayers = editor.call('attributes:addField', {
              parent: panelGroup,
              name: 'Layers',
              type: 'tags',
              tagType: 'number',
              enum: layersEnum,
              placeholder: 'Add Layer',
              link: projectSettings,
              path: 'batchGroups.' + groupId + '.layers',
              tagToString: function (tag) {
                  return projectSettings.get('layers.' + tag + '.name') || 'Missing';
              },
              onClickTag: function () {
                  // focus layer
                  var layerId = this.originalValue;
                  editor.call('editorSettings:layers:focus', layerId);
              }
          });

          // reference
          editor.call('attributes:reference:attach', 'settings:batchGroups:layers', fieldLayers.parent.parent.innerElement.firstChild.ui);

          // layers
          if (!projectSettings.has('batchGroups.' + groupId + '.layers')) {
              projectSettings.set('batchGroups.' + groupId + '.layers', []);
              projectSettings.insert('batchGroups.' + groupId + '.layers', LAYERID_WORLD);
          }

          var prevKey = null;
          var batchGroups = projectSettings.get('batchGroups');
          for (var key in batchGroups) {
              if (parseInt(key, 10) === groupId) {
                  batchGroupPanels[key] = panelGroup;

                  if (prevKey) {
                      panelBatchGroups.appendAfter(panelGroup, batchGroupPanels[prevKey]);
                  } else {
                      panelBatchGroups.prepend(panelGroup);
                  }

                  break;
              } else if (batchGroups[key]) {
                  prevKey = key;
              }
          }

          panelGroup.on('destroy', function () {
              evtName.unbind();
          });
      };

      var removeBatchGroupPanel = function (id) {
          var panel = batchGroupPanels[id];
          if (panel) {
              panel.destroy();
          }

          delete batchGroupPanels[id];
      };

      var evtNewBatchGroup = projectSettings.on('*:set', function (path, value) {
          if (/^batchGroups\.\d+$/.test(path)) {
              if (value) {
                  createBatchGroupPanel(value);
              } else {
                  var parts = path.split('.');
                  removeBatchGroupPanel(parts[parts.length - 1]);
              }
          }
      });

      var evtDeleteBatchGroup = projectSettings.on('*:unset', function (path, value) {
          if (/^batchGroups\.\d+$/.test(path)) {
              removeBatchGroupPanel(value.id);
          }
      });

      panelBatchGroups.on('destroy', function () {
          evtNewBatchGroup.unbind();
          evtDeleteBatchGroup.unbind();
      });

      // existing batch groups
      var batchGroups = projectSettings.get('batchGroups') || {};
      for (var id in batchGroups) {
          createBatchGroupPanel(batchGroups[id]);
      }

      // new batch group button
      var btnAddBatchGroup = new ui.Button({
          text: 'ADD GROUP'
      });
      btnAddBatchGroup.class.add('add-batch-group');
      panelBatchGroups.append(btnAddBatchGroup);
      btnAddBatchGroup.on('click', function () {
          var id = editor.call('editorSettings:batchGroups:create');
          editor.call('editorSettings:batchGroups:focus', id);
      });
  });

  editor.method('editorSettings:batchGroups:create', function () {
      var batchGroups = projectSettings.get('batchGroups');

      // calculate id of new group and new name
      var id = 100000;
      for (var key in batchGroups) {
          id = Math.max(parseInt(key, 10) + 1, id);
      }

      projectSettings.set('batchGroups.' + id, {
          id: id,
          name: 'New Batch Group',
          maxAabbSize: 100,
          dynamic: true
      });

      return id;
  });

  editor.method('editorSettings:batchGroups:focus', function (groupId) {
      var element = document.getElementById('batchgroup-panel-' + groupId);
      if (! element) return;

      editor.call('editorSettings:panel:unfold', 'batching');
      element.ui.folded = false;
      element.querySelector('.field-batchgroup-name > input').focus();
  });
});


/* editor/settings/settings-attributes-loading-screen.js */
editor.once('load', function() {
  'use strict';

  var projectSettings = editor.call('settings:project');

  var foldStates = {
      'loading': true
  };

  editor.on('attributes:inspect[editorSettings]', function() {
      var root = editor.call('layout.root');

      // loading screen
      var panelLoadingScreen = editor.call('attributes:addPanel', {
          name: 'Loading Screen'
      });
      panelLoadingScreen.foldable = true;
      panelLoadingScreen.folded = foldStates['loading'];
      panelLoadingScreen.on('fold', function() { foldStates['loading'] = true; });
      panelLoadingScreen.on('unfold', function() { foldStates['loading'] = false; });
      panelLoadingScreen.class.add('component', 'loading-screen');

      if (!editor.call("users:isSuperUser") && config.owner.plan.type !== 'org' && config.owner.plan.type !== 'organization') {
          var labelUpgrade = new ui.Label({
              text: 'This is an ORGANIZATION account feature. <a href="/upgrade?plan=organization&account=' + config.owner.username + '" target="_blank">UPGRADE</a> to create custom loading screens.',
              unsafe: true
          });
          labelUpgrade.style.fontSize = '12px';
          labelUpgrade.style.color = '#fff';
          panelLoadingScreen.append(labelUpgrade);
          return;
      }


      var panelButtons = new ui.Panel();
      panelButtons.class.add('flex', 'component');
      panelLoadingScreen.append(panelButtons);

      var btnDefaultScript = new ui.Button({
          text: 'Create default'
      });
      btnDefaultScript.class.add('add');
      btnDefaultScript.class.add('loading-screen');

      panelButtons.append(btnDefaultScript);

      var tooltipText = 'Create a default loading screen script.';

      if (projectSettings.get('useLegacyScripts')) {
          var repositories = editor.call('repositories');
          // disable create button for non directory repos
          btnDefaultScript.disabled = repositories.get('current') !== 'directory';

          if (btnDefaultScript.disabled) {
              tooltipText += '<br/><small><em>(Disabled because you are synced to an external code repository)</em></small>';
          }

          btnDefaultScript.on('click', function () {
              editor.call('selector:enabled', false);
              editor.call('sourcefiles:new', editor.call('sourcefiles:loadingScreen:skeleton'));
              var evtNew = editor.once('sourcefiles:add', function (file) {
                  setLoadingScreen(file.get('filename'));
                  evtNew = null;
              });

              editor.once('sourcefiles:new:close', function () {
                  editor.call('selector:enabled', true);
                  if (evtNew) {
                      evtNew.unbind();
                      evtNew = null;
                  }
              });
          });

          var setLoadingScreen = function (data) {
              var loadingScreen = data && data.get ? data.get('filename') : data;
              projectSettings.set('loadingScreenScript', loadingScreen);
              fieldScriptPicker.text = loadingScreen ? loadingScreen : 'Select loading screen script';
              if (loadingScreen) {
                  btnRemove.class.remove('not-visible');
              } else {
                  btnRemove.class.add('not-visible');
              }
          };
      } else {

          var setLoadingScreen = function (asset) {
              if (asset) {
                  if (! asset.get('data.loading'))
                      return;

                  asset.set('preload', false);
              }

              projectSettings.set('loadingScreenScript', asset ? asset.get('id') + '' : null);
              fieldScriptPicker.text = asset ? asset.get('name') : 'Select loading screen script';
              if (asset) {
                  btnRemove.class.remove('not-visible');
              } else {
                  btnRemove.class.add('not-visible');
              }
          };

          btnDefaultScript.on('click', function () {
              // editor.call('selector:enabled', false);

              editor.call('picker:script-create', function(filename) {
                  editor.call('assets:create:script', {
                      filename: filename,
                      content: editor.call('sourcefiles:loadingScreen:skeleton'),
                      callback: function (err, asset) {
                          if (err)
                              return;

                          setLoadingScreen(asset);
                      }
                  });

              });

          });
      }

      Tooltip.attach({
          target: btnDefaultScript.element,
          html:  tooltipText,
          align: 'right',
          root: root
      });

      var btnSelectScript = new ui.Button({
          text: 'Select existing'
      });
      btnSelectScript.class.add('loading-screen');
      panelButtons.append(btnSelectScript);

      btnSelectScript.on('click', function () {
          var evtPick = editor.once("picker:asset", function (asset) {
              setLoadingScreen(asset);
              evtPick = null;
          });

          // show asset picker
          editor.call("picker:asset", { type: "script" });

          editor.once('picker:asset:close', function () {
              if (evtPick) {
                  evtPick.unbind();
                  evtPick = null;
              }
          });
      });

      Tooltip.attach({
          target: btnSelectScript.element,
          text: 'Select an existing loading screen script',
          align: 'bottom',
          root: root
      });

      var fieldScriptPicker = editor.call('attributes:addField', {
          parent: panelLoadingScreen,
          name: 'Script',
          type: 'button'
      });
      fieldScriptPicker.class.add('script-picker');

      fieldScriptPicker.style['font-size'] = '11px';
      fieldScriptPicker.parent.hidden = true;

      var btnRemove = new ui.Button();
      btnRemove.class.add('remove');
      fieldScriptPicker.parent.append(btnRemove);
      btnRemove.on("click", function () {
          setLoadingScreen(null);
      });


      var onLoadingScreen = function (loadingScreen) {
          var text;
          var missing = false;
          if (projectSettings.get('useLegacyScripts')) {
              text = loadingScreen;
          } else if (loadingScreen) {
              var asset = editor.call('assets:get', loadingScreen);
              if (asset) {
                  text = asset.get('name');
              } else {
                  missing = true;
                  text = 'Missing';
              }
          }

          if (text) {
              fieldScriptPicker.text = text;
              fieldScriptPicker.parent.hidden = false;
              panelButtons.hidden = true;
          } else {
              fieldScriptPicker.parent.hidden = true;
              panelButtons.hidden = false;
          }

          if (missing) {
              fieldScriptPicker.class.add('error');
          } else {
              fieldScriptPicker.class.remove('error');
          }
      };

      var evtLoadingScreen = projectSettings.on('loadingScreenScript:set', onLoadingScreen);

      panelLoadingScreen.on('destroy', function () {
          evtLoadingScreen.unbind();
      });

      onLoadingScreen(projectSettings.get('loadingScreenScript'));

      fieldScriptPicker.on('click', function () {
          var evtPick = editor.once("picker:asset", function (asset) {
              setLoadingScreen(asset);
              evtPick = null;
          });

          // show asset picker
          editor.call("picker:asset", { type: "script" });

          editor.once('picker:asset:close', function () {
              if (evtPick) {
                  evtPick.unbind();
                  evtPick = null;
              }
          });
      });

      // reference
      editor.call('attributes:reference:attach', 'settings:loadingScreenScript', fieldScriptPicker.parent.innerElement.firstChild.ui);

      // drag drop
      var dropRef = editor.call('drop:target', {
          ref: panelLoadingScreen.element,
          filter: function(type, data) {
              var rectA = root.innerElement.getBoundingClientRect();
              var rectB = panelLoadingScreen.element.getBoundingClientRect();
              if (type === 'asset.script' && rectB.top > rectA.top && rectB.bottom < rectA.bottom) {

                  if (projectSettings.get('useLegacyScripts')) {
                      return data.filename !== fieldScriptPicker.text;
                  } else {
                      var asset = editor.call('assets:get', data.id);
                      return asset && asset.get('data.loading');
                  }
              }

              return false;
          },
          drop: function(type, data) {
              if (type !== 'asset.script')
                  return;

              if (projectSettings.get('useLegacyScripts')) {
                  setLoadingScreen(data.filename);
              } else {
                  var asset = editor.call('assets:get', data.id);
                  if (asset && asset.get('data.loading'))
                      setLoadingScreen(asset);
              }
          }
      });
  });
});


/* editor/settings/settings-attributes-external-scripts.js */
editor.once('load', function () {
  'use strict';

  var projectSettings = editor.call('settings:project');
  if (projectSettings.get('useLegacyScripts')) return;

  var folded = true;

  editor.on('attributes:inspect[editorSettings]', function() {
      var panel = editor.call('attributes:addPanel', {
          name: 'External Scripts'
      });
      panel.foldable = true;
      panel.folded = folded;
      panel.on('fold', function () { folded = true; });
      panel.on('unfold', function () { folded = false; });
      panel.class.add('component', 'external-scripts');

      var fieldExternalScripts = editor.call('attributes:addArrayField', {
          panel: panel,
          name: 'URLs',
          type: 'string',
          link: [projectSettings],
          path: 'externalScripts',
          placeholder: 'URL'
      });
      editor.call('attributes:reference:attach', 'settings:project:externalScripts', fieldExternalScripts.parent.innerElement.firstChild.ui);
  });
});


/* editor/settings/settings-attributes-input.js */
editor.once('load', function () {
  'use strict';

  var projectSettings = editor.call('settings:project');

  var folded = true;

  editor.on('attributes:inspect[editorSettings]', function () {
      // input
      var inputPanel = editor.call('attributes:addPanel', {
          name: 'Input'
      });
      inputPanel.foldable = true;
      inputPanel.folded = folded;
      inputPanel.on('fold', function () { folded = true; });
      inputPanel.on('unfold', function () { folded = false; });
      inputPanel.class.add('component');

      // enable keyboard
      var fieldKeyboard = editor.call('attributes:addField', {
          parent: inputPanel,
          name: 'Keyboard',
          type: 'checkbox',
          link: projectSettings,
          path: 'useKeyboard'
      });
      editor.call('attributes:reference:attach', 'settings:project:useKeyboard', fieldKeyboard.parent.innerElement.firstChild.ui);

      // enable mouse
      var fieldMouse = editor.call('attributes:addField', {
          parent: inputPanel,
          name: 'Mouse',
          type: 'checkbox',
          link: projectSettings,
          path: 'useMouse'
      });
      editor.call('attributes:reference:attach', 'settings:project:useMouse', fieldMouse.parent.innerElement.firstChild.ui);

      // enable touch
      var fieldTouch = editor.call('attributes:addField', {
          parent: inputPanel,
          name: 'Touch',
          type: 'checkbox',
          link: projectSettings,
          path: 'useTouch'
      });
      editor.call('attributes:reference:attach', 'settings:project:useTouch', fieldTouch.parent.innerElement.firstChild.ui);

      // enable gamepads
      var fieldGamepads = editor.call('attributes:addField', {
          parent: inputPanel,
          name: 'Gamepads',
          type: 'checkbox',
          link: projectSettings,
          path: 'useGamepads'
      });
      editor.call('attributes:reference:attach', 'settings:project:useGamepads', fieldGamepads.parent.innerElement.firstChild.ui);

  });
});


/* editor/settings/settings-attributes-i18n.js */
editor.once('load', function () {
  'use strict';

  if (!editor.call('users:hasFlag', 'hasLocalization')) return;

  var projectSettings = editor.call('settings:project');

  var folded = true;

  editor.on('attributes:inspect[editorSettings]', function () {
      var panelLocalization = editor.call('attributes:addPanel', {
          name: 'Localization'
      });
      panelLocalization.foldable = true;
      panelLocalization.folded = folded;
      panelLocalization.on('fold', function () { folded = true; });
      panelLocalization.on('unfold', function () { folded = false; });
      panelLocalization.class.add('component', 'i18n');

      var fieldAssets = editor.call('attributes:addAssetsList', {
          panel: panelLocalization,
          name: 'Assets',
          type: 'json',
          link: [projectSettings],
          path: 'i18nAssets',
          reference: 'settings:localization:i18nAssets'
      });

      var btnCreate = editor.call('attributes:addField', {
          parent: panelLocalization,
          type: 'button',
          text: 'Create New Asset'
      });
      btnCreate.class.add('add-i18n-asset');
      btnCreate.style.marginTop = '10px';

      btnCreate.on('click', function () {
          editor.call('assets:create:i18n');
      });

      editor.call('attributes:reference:attach', 'settings:localization:createAsset', btnCreate);

  });
});
