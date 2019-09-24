

/* editor/assets/assets.js */
/*

NAMESPACE
    asset

METHODS
    add
    remove
    get
    find
    findOne

EVENTS
    add
    remove

*/

editor.once('load', function() {
  'use strict';

  var uniqueIdToItemId = {};

  var assets = new ObserverList({
      index: 'id',
      sorted: function(a, b) {
          var f = (b._data['type'] === 'folder') - (a._data['type'] === 'folder');

          if (f !== 0)
              return f;

          if (a._data['name'].toLowerCase() > b._data['name'].toLowerCase()) {
              return 1;
          } else if (a._data['name'].toLowerCase() < b._data['name'].toLowerCase()) {
              return -1;
          } else {
              return 0;
          }
      }
  });


  // return assets ObserverList
  editor.method('assets:raw', function() {
      return assets;
  });

  // allow adding assets
  editor.method('assets:add', function(asset) {
      uniqueIdToItemId[asset.get('uniqueId')] = asset.get('id');

      var pos = assets.add(asset);

      if (pos === null)
          return;

      asset.on('name:set', function(name, nameOld) {
          name = name.toLowerCase();
          nameOld = nameOld.toLowerCase();

          var ind = assets.data.indexOf(this);
          var pos = assets.positionNextClosest(this, function(a, b) {
              var f = (b._data['type'] === 'folder') - (a._data['type'] === 'folder');

              if (f !== 0)
                  return f;

              if ((a === b ? nameOld : a._data['name'].toLowerCase()) > name) {
                  return 1;
              } else if ((a === b ? nameOld : a._data['name'].toLowerCase()) < name) {
                  return -1;
              } else {
                  return 0;
              }
          });

          if (pos === -1 && (ind + 1) == assets.data.length)
              return;

          if (ind !== -1 && (ind + 1 === pos) || (ind === pos))
              return;

          if (ind < pos)
              pos--;

          assets.move(this, pos);
          editor.emit('assets:move', asset, pos);
      });

      // publish added asset
      editor.emit('assets:add[' + asset.get('id') + ']', asset, pos);
      editor.emit('assets:add', asset, pos);
  });

  // allow removing assets
  editor.method('assets:remove', function(asset) {
      assets.remove(asset);
  });

  // remove all assets
  editor.method('assets:clear', function () {
      assets.clear();
      editor.emit('assets:clear');

      uniqueIdToItemId = {};
  });

  // get asset by id
  editor.method('assets:get', function(id) {
      return assets.get(id);
  });

  // get asset by unique id
  editor.method('assets:getUnique', function (uniqueId) {
      var id = uniqueIdToItemId[uniqueId];
      return id ? assets.get(id) : null;
  });

  // find assets by function
  editor.method('assets:find', function(fn) {
      return assets.find(fn);
  });

  // find one asset by function
  editor.method('assets:findOne', function(fn) {
      return assets.findOne(fn);
  });

  editor.method('assets:map', function (fn) {
      assets.map(fn);
  });

  editor.method('assets:list', function () {
      return assets.array();
  });

  // publish remove asset
  assets.on('remove', function(asset) {
      asset.destroy();
      editor.emit('assets:remove', asset);
      editor.emit('assets:remove[' + asset.get('id') + ']');

      delete uniqueIdToItemId[asset.get('uniqueId')];
  });
});


/* editor/assets/assets-registry.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:registry:bind', function (assetRegistry, assetTypes) {
      // add assets to asset registry
      editor.on('assets:add', function (asset) {
          // do only for target assets
          if (asset.get('source'))
              return;

          if (assetTypes && assetTypes.indexOf(asset.get('type')) === -1)
              return;

          // raw json data
          var assetJson = asset.json();

          // engine material data
          var data = {
              id: parseInt(assetJson.id, 10),
              name: assetJson.name,
              file: assetJson.file ? {
                  filename: assetJson.file.filename,
                  url: assetJson.file.url,
                  hash: assetJson.file.hash,
                  size: assetJson.file.size,
                  variants: assetJson.file.variants || null
              } : null,
              data: assetJson.data,
              type: assetJson.type
          };

          // add to registry
          // assetRegistry.createAndAddAsset(assetJson.id, data);

          var newAsset = new pc.Asset(data.name, data.type, data.file, data.data);
          newAsset.id = parseInt(assetJson.id, 10);

          if (assetJson.i18n) {
              for (var locale in assetJson.i18n) {
                  newAsset.addLocalizedAssetId(locale, assetJson.i18n[locale]);
              }
          }

          assetRegistry.add(newAsset);

          var timeout;
          var updatedFields = { };

          var updateFields = function () {
              var realtimeAsset = assetRegistry.get(asset.get('id'));

              for (var key in updatedFields) {
                  // this will trigger the 'update' event on the asset in the engine
                  // handling all resource loading automatically
                  realtimeAsset[key] = asset.get(key);
                  delete updatedFields[key];
              }

              timeout = null;
          };

          var checkPath = /^(data|file)\b/;
          var onUpdate = function(path, value) {
              var match = path.match(checkPath);
              if (! match) return;

              // skip firing change when an indidual frame changes
              // for performance reasons. We handle this elsewhere
              if (asset.get('type') === 'textureatlas') {
                  if (path.startsWith('data.frames.')) {
                      return;
                  }
              }

              var field = match[0];
              updatedFields[field] = true;

              // do this in a timeout to avoid multiple sets of the same
              // fields
              if (! timeout) {
                  timeout = setTimeout(updateFields);
              }

          };

          asset.on('*:set', onUpdate);
          asset.on('*:unset', onUpdate);
      });

      // remove assets from asset registry
      editor.on('assets:remove', function (asset) {
          var item = assetRegistry.get(asset.get('id'));
          if (item) {
              item.unload();
              assetRegistry.remove(item);
          }
      });
  });
});


/* editor/assets/assets-sync.js */
editor.once('load', function () {
  'use strict';

  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');
  var syncPaths = [
      'name',
      'preload',
      'scope',
      'data',
      'meta',
      'file',
      'i18n'
  ];
  var docs = {};

  editor.method('loadAsset', function (uniqueId, callback) {
      var connection = editor.call('realtime:connection');

      var doc = connection.get('assets', '' + uniqueId);

      docs[uniqueId] = doc;

      // error
      doc.on('error', function (err) {
          if (connection.state === 'connected') {
              console.log(err);
              return;
          }

          editor.emit('realtime:assets:error', err);
      });

      // ready to sync
      doc.on('load', function () {
          var assetData = doc.data;
          if (! assetData) {
              console.error('Could not load asset: ' + uniqueId);
              editor.call('status:error', 'Could not load asset: ' + uniqueId);
              doc.unsubscribe();
              doc.destroy();
              return callback && callback();
          }

          // notify of operations
          doc.on('op', function (ops, local) {
              if (local) return;

              for (var i = 0; i < ops.length; i++) {
                  editor.emit('realtime:op:assets', ops[i], uniqueId);
              }
          });

          // notify of asset load
          assetData.id = parseInt(assetData.item_id, 10);
          assetData.uniqueId = uniqueId;

          // delete unnecessary fields
          delete assetData.item_id;
          delete assetData.branch_id;

          if (assetData.file) {
              assetData.file.url = getFileUrl(assetData.id, assetData.revision, assetData.file.filename);

              if (assetData.file.variants) {
                  for (var key in assetData.file.variants) {
                      assetData.file.variants[key].url = getFileUrl(assetData.id, assetData.revision, assetData.file.variants[key].filename);
                  }
              }
          }

          // allow duplicate values in data.frameKeys of sprite asset
          var options = null;
          if (assetData.type === 'sprite') {
              options = {
                  pathsWithDuplicates: ['data.frameKeys']
              };
          }

          var asset = new Observer(assetData, options);
          editor.call('assets:add', asset);

          if (callback)
              callback(asset);
      });

      // subscribe for realtime events
      doc.subscribe();
  });

  editor.method('assets:fs:paths:patch', function (data) {
      var connection = editor.call('realtime:connection');
      var assets = connection.collections.assets;

      for(var i = 0; i < data.length; i++) {
          if (! assets.hasOwnProperty(data[i].uniqueId))
              continue;

          // force snapshot path data
          assets[data[i].uniqueId].data.path = data[i].path;

          // sync observer
          editor.emit('realtime:op:assets', {
              p: ['path'],
              oi: data[i].path,
              od: null
          }, data[i].uniqueId);
      }
  });

  var onLoad = function (data) {
      editor.call('assets:progress', 0.5);

      var count = 0;

      var load = function (uniqueId) {
          editor.call('loadAsset', uniqueId, function () {
              count++;
              editor.call('assets:progress', (count / data.length) * 0.5 + 0.5);
              if (count >= data.length) {
                  editor.call('assets:progress', 1);
                  editor.emit('assets:load');
              }
          });
      };

      if (data.length) {
          var connection = editor.call('realtime:connection');

          // do bulk subsribe in batches of 'batchSize' assets
          var batchSize = 256;
          var startBatch = 0;
          var total = data.length;

          while (startBatch < total) {
              // start bulk subscribe
              connection.startBulk();
              for (var i = startBatch; i < startBatch + batchSize && i < total; i++) {
                  load(data[i].uniqueId);
              }
              // end bulk subscribe and send message to server
              connection.endBulk();

              startBatch += batchSize;
          }

      } else {
          editor.call('assets:progress', 1);
          editor.emit('assets:load');
      }
  };

  // load all assets
  editor.on('realtime:authenticated', function () {
      editor.call('assets:clear');

      Ajax({
          url: '{{url.api}}/projects/{{project.id}}/assets?branchId={{self.branch.id}}&view=designer',
          auth: true
      })
      .on('load', function (status, data) {
          onLoad(data);
      })
      .on('progress', function (progress) {
          editor.call('assets:progress', 0.1 + progress * 0.4);
      })
      .on('error', function (status, evt) {
          console.log(status, evt);
      });
  });

  editor.call('assets:progress', 0.1);

  var onAssetSelect = function (asset) {
      editor.call('selector:set', 'asset', [asset]);

      // navigate to folder too
      var path = asset.get('path');
      if (path.length) {
          editor.call('assets:panel:currentFolder', editor.call('assets:get', path[path.length - 1]));
      } else {
          editor.call('assets:panel:currentFolder', null);
      }
  };

  // create asset
  editor.method('assets:create', function (data, fn, noSelect) {
      var evtAssetAdd;

      if (! noSelect) {
          editor.once('selector:change', function () {
              if (evtAssetAdd) {
                  evtAssetAdd.unbind();
                  evtAssetAdd = null;
              }
          });
      }

      editor.call('assets:uploadFile', data, function (err, res) {
          if (err) {
              editor.call('status:error', err);

              // TODO
              // disk allowance error

              if (fn) fn(err);

              return;
          }

          if (! noSelect) {
              var asset = editor.call('assets:get', res.id);
              if (asset) {
                  onAssetSelect(asset);
              } else {
                  evtAssetAdd = editor.once('assets:add[' + res.id + ']', onAssetSelect);
              }
          }

          if (fn) fn(err, res.id);
      });
  });

  // delete asset
  editor.method('assets:delete', function (list) {
      if (! (list instanceof Array))
          list = [list];

      var assets = [];

      for (var i = 0; i < list.length; i++) {
          if (legacyScripts && list[i].get('type') === 'script') {
              editor.emit('sourcefiles:remove', list[i]);
              Ajax({
                  url: '{{url.api}}/projects/' + config.project.id + '/repositories/directory/sourcefiles/' + list[i].get('filename'),
                  auth: true,
                  method: 'DELETE'
              });
          } else {
              assets.push(list[i]);
          }
      }

      if (assets.length)
          editor.call('assets:fs:delete', assets);
  });

  editor.on('assets:remove', function (asset) {
      var id = asset.get('uniqueId');
      if (docs[id]) {
          docs[id].unsubscribe();
          docs[id].destroy();
          delete docs[id];
      }
  });

  var getFileUrl = function (id, revision, filename) {
      return '/api/assets/' + id + '/file/' + encodeURIComponent(filename) + '?branchId=' + config.self.branch.id;
  };

  var assetSetThumbnailPaths = function (asset) {
      if (asset.get('type') !== 'texture' && asset.get('type') !== 'textureatlas')
          return;

      if (asset.get('has_thumbnail')) {
          asset.set('thumbnails', {
              's': '/api/assets/' + asset.get('id') + '/thumbnail/small?branchId=' + config.self.branch.id,
              'm': '/api/assets/' + asset.get('id') + '/thumbnail/medium?branchId=' + config.self.branch.id,
              'l': '/api/assets/' + asset.get('id') + '/thumbnail/large?branchId=' + config.self.branch.id,
              'xl': '/api/assets/' + asset.get('id') + '/thumbnail/xlarge?branchId=' + config.self.branch.id
          });
      } else {
          asset.unset('thumbnails');
      }
  };

  // hook sync to new assets
  editor.on('assets:add', function (asset) {
      if (asset.sync)
          return;

      // convert material data to flat
      if (asset.get('type') === 'material') {
          // store missing tilings / offset before we set default values
          editor.call('material:rememberMissingFields', asset);

          var assetData = asset.get('data');
          if (assetData)
              asset.set('data', editor.call('schema:material:getDefaultData', assetData));
      }

      asset.sync = new ObserverSync({
          item: asset,
          paths: syncPaths
      });

      // client > server
      asset.sync.on('op', function (op) {
          editor.call('realtime:assets:op', op, asset.get('uniqueId'));
      });

      // set thumbnails
      assetSetThumbnailPaths(asset);

      var setting = false;

      asset.on('*:set', function (path, value) {
          if (setting || ! path.startsWith('file') || path.endsWith('.url') || ! asset.get('file'))
              return;

          setting = true;

          var parts = path.split('.');

          if ((parts.length === 1 || parts.length === 2) && parts[1] !== 'variants') {
              // reset file url
              asset.set('file.url', getFileUrl(asset.get('id'), asset.get('revision'), asset.get('file.filename')));
              // set thumbnails
              assetSetThumbnailPaths(asset);
          } else if (parts.length >= 3 && parts[1] === 'variants') {
              var format = parts[2];
              asset.set('file.variants.' + format + '.url', getFileUrl(asset.get('id'), asset.get('revision'), asset.get('file.variants.' + format + '.filename')));
          }

          setting = false;
      });

      asset.on('has_thumbnail:set', function (value) {
          assetSetThumbnailPaths(asset);
      });
  });

  // write asset operations
  editor.method('realtime:assets:op', function (op, uniqueId) {
      if (! editor.call('permissions:write') || !docs[uniqueId])
          return;

      // console.trace();
      // console.log('out: [ ' + Object.keys(op).filter(function(i) { return i !== 'p' }).join(', ') + ' ]', op.p.join('.'));
      // console.log(op);

      docs[uniqueId].submitOp([op]);
  });


  // server > client
  editor.on('realtime:op:assets', function (op, uniqueId) {
      var asset = editor.call('assets:getUnique', uniqueId);
      if (asset) {
          // console.log('in: ' + id + ' [ ' + Object.keys(op).filter(function(i) { return i !== 'p' }).join(', ') + ' ]', op.p.join('.'));
          // console.log(op);
          asset.sync.write(op);
      } else {
          console.error('realtime operation on missing asset: ' + op.p[1]);
      }
  });

  // handle disconnection
  editor.on('realtime:disconnected', function () {
      var app = editor.call('viewport:app');
      if (app) {
          // clear ALL asset registry events
          // TODO: This will mean that after re-connection some events
          // that were registered on the asset registry will not be re-registered.
          // That might break some stuff. E.g. currently translations in the Editor
          // will not re-appear after re-connection because they rely on the asset registry's
          // 'add' event which gets removed.
          app.assets._callbacks = { };
      }

      editor.call('assets:clear');
  });
});


/* editor/assets/assets-fs.js */
editor.once('load', function() {
  'use strict';

  var getIds = function(assets) {
      if (! (assets instanceof Array))
          assets = [ assets ];

      var ids = [ ];
      for(var i = 0; i < assets.length; i++)
          ids.push(parseInt(assets[i].get('uniqueId'), 10));

      return ids;
  };

  editor.method('assets:fs:delete', function(assets) {
      editor.call('realtime:send', 'fs', {
          op: 'delete',
          ids: getIds(assets)
      });
  });

  editor.method('assets:fs:move', function(assets, assetTo) {
      editor.call('realtime:send', 'fs', {
          op: 'move',
          ids: getIds(assets),
          to: assetTo ? parseInt(assetTo.get('uniqueId'), 10) : null
      });
  });

  editor.method('assets:fs:duplicate', function(assets) {
      editor.call('realtime:send', 'fs', {
          op: 'duplicate',
          ids: getIds(assets)
      });
  });
});


/* editor/assets/assets-panel.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var assetsPanel = editor.call('layout.assets');
  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');

  var dragging = false;
  var draggingData = { };
  var selector = {
      type: '',
      items: [ ],
      prev: {
          type: '',
          items: [ ]
      }
  };
  var searching = false;

  var overlay = new pcui.Container({
      flex: true
  });
  overlay.class.add('progress-overlay');
  assetsPanel.append(overlay);

  var loading = new ui.Progress();
  loading.on('progress:100', function() {
      overlay.hidden = true;
  });
  overlay.append(loading);

  editor.method('assets:progress', function(progress) {
      loading.progress = progress;
  });

  // folders panel
  var folders = new ui.Panel();
  folders.class.add('folders');
  folders.flexShrink = false;
  folders.style.width = '200px';
  folders.innerElement.style.width = '200px';
  folders.foldable = false;
  folders.horizontal = true;
  folders.scroll = true;
  folders.resizable = 'right';
  folders.resizeMin = 100;
  folders.resizeMax = 300;
  assetsPanel.append(folders);

  editor.method('assets:panel:folders', function() {
      return folders;
  });

  var currentFolder = null;
  editor.method('assets:panel:currentFolder', function(asset) {
      if (asset === undefined)
          return currentFolder;

      if (asset === currentFolder)
          return;

      // current folder style remove
      if (currentFolder && typeof(currentFolder) !== 'string' && assetsIndex[currentFolder.get('id')]) {
          assetsIndex[currentFolder.get('id')].tree.class.remove('current');
      } else {
          if (currentFolder === null) {
              treeRoot.class.remove('current');
          } else if (treeScripts && currentFolder === 'scripts') {
              treeScripts.class.remove('current');
          }
      }

      currentFolder = asset;

      // current folder style add
      if (currentFolder && typeof(currentFolder) !== 'string') {
          assetsIndex[currentFolder.get('id')].tree.class.add('current');

          // open tree up
          var path = currentFolder.get('path');
          for(var i = 0; i < path.length; i++) {
              if (! assetsIndex[path[i]] || ! assetsIndex[path[i]].tree)
                  continue;

              assetsIndex[path[i]].tree.open = true;
          }
      } else if (currentFolder === null) {
          treeRoot.class.add('current');
      } else if (treeScripts && currentFolder === 'scripts') {
          treeScripts.class.add('current');
          editor.call('assets:filter:type', 'all');
      }

      if (legacyScripts)
          gridScripts.hidden = currentFolder !== null;

      editor.emit('assets:panel:currentFolder', currentFolder);
  });

  editor.call('hotkey:register', 'assets:fs:up', {
      key: 'backspace',
      callback: function() {
          if (! currentFolder || editor.call('selector:type') !== 'asset')
              return;

          var path = typeof(currentFolder) === 'string' ? [ ] : currentFolder.get('path');
          if (path.length === 0) {
              editor.call('assets:panel:currentFolder', null);
          } else {
              editor.call('assets:panel:currentFolder', editor.call('assets:get', path[path.length - 1]));
          }
      }
  });

  editor.on('drop:active', function (state, type, data) {
      dragging = state;

      if (! dragging) {
          grid.dragOver = undefined;
          gridDropBorder.classList.remove('active');
          treeDropBorder.classList.remove('active');
      }
  });

  editor.on('drop:set', function (type, data) {
      draggingData = data;
  });

  // tree
  var tree = new ui.Tree();
  tree.enabled = false;
  tree.draggable = false;
  tree.class.add('assets');
  folders.append(tree);

  var dropRef = editor.call('drop:target', {
      ref: folders.element,
      hole: true,
      passThrough: true,
      filter: function(type, data) {
          return type.startsWith('asset');
      },
      drop: function(type, data) {
          if (! type || grid.dragOver === undefined || ! type.startsWith('asset'))
              return;

          var items = editor.call('selector:items');
          var assets = [ ];

          var addAsset = function(id) {
              var asset = editor.call('assets:get', id);

              // deselect moved asset
              if (items.indexOf(asset) !== -1)
                  editor.call('selector:remove', asset);

              assets.push(asset);
          };

          if (data.ids) {
              for(var i = 0; i < data.ids.length; i++)
                  addAsset(data.ids[i]);
          } else {
              addAsset(data.id);
          }
          editor.call('assets:fs:move', assets, grid.dragOver);
      }
  });
  dropRef.element.classList.add('assets-drop-area');

  var treeAppendQueue = { };

  // tree root
  var treeRoot = new ui.TreeItem({
      text: '/'
  });
  tree.append(treeRoot);
  treeRoot.open = true;
  treeRoot.class.add('current');
  treeRoot.on('select', function() {
      this.selected = false;
  });

  // scripts folder
  var gridScripts;
  var treeScripts;

  treeRoot.elementTitle.addEventListener('mouseover', function() {
      if (! dragging || grid.dragOver === null || (! draggingData.id && ! draggingData.ids))
          return;

      // already in that folder
      var dragAsset = editor.call('assets:get', draggingData.id || draggingData.ids[0]);
      if (! dragAsset.get('path').length)
          return;

      gridDropBorder.classList.remove('active');

      var rect = treeRoot.elementTitle.getBoundingClientRect();
      treeDropBorder.classList.add('active');
      treeDropBorder.style.left = rect.left + 'px';
      treeDropBorder.style.top = rect.top + 'px';
      treeDropBorder.style.right = (window.innerWidth - rect.right) + 'px';
      treeDropBorder.style.bottom = (window.innerHeight - rect.bottom) + 'px';

      grid.dragOver = null;
  }, false);

  treeRoot.elementTitle.addEventListener('mouseout', function() {
      if (! dragging || grid.dragOver === undefined)
          return;

      gridDropBorder.classList.remove('active');
      treeDropBorder.classList.remove('active');

      grid.dragOver = undefined;
  }, false);

  // tree width resizing
  var resizeQueued = false;
  var resizeTree = function() {
      resizeQueued = false;
      tree.element.style.width = '';
      tree.element.style.width = (folders.innerElement.scrollWidth - 5) + 'px';
  };
  var resizeQueue = function() {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(resizeTree);
  };
  folders.on('resize', resizeQueue);
  tree.on('open', resizeQueue);
  tree.on('close', resizeQueue);
  setInterval(resizeQueue, 1000);

  var files = new ui.Panel();
  files.class.add('files');
  files.flexGrow = true;
  files.foldable = false;
  files.horizontal = true;
  files.scroll = true;
  assetsPanel.append(files);

  editor.method('assets:panel:files', function() {
      return files;
  });

  // grid
  var grid = new ui.Grid();
  grid.enabled = false;
  grid.class.add('assets');
  files.append(grid);


  var dropRef = editor.call('drop:target', {
      ref: files.element,
      hole: true,
      passThrough: true,
      filter: function(type, data) {
          return type.startsWith('asset');
      },
      drop: function(type, data) {
          if (! type || grid.dragOver === undefined || ! type.startsWith('asset'))
              return;

          var assets = [ ];
          var items = editor.call('selector:items');

          var addAsset = function(id) {
              var asset = editor.call('assets:get', id);

              // deselect moved asset
              if (items.indexOf(asset) !== -1)
                  editor.call('selector:remove', asset);

              assets.push(asset);
          };

          if (data.ids) {
              for (var i = 0; i < data.ids.length; i++) {
                  addAsset(data.ids[i]);
              }
          } else {
              addAsset(data.id);
          }

          if (grid.dragOver.get('type') === 'folder') {
              editor.call('assets:fs:move', assets, grid.dragOver);
          } else if (grid.dragOver.get('type') === 'bundle') {
              var countAdded = editor.call('assets:bundles:addAssets', assets, grid.dragOver);
              if (countAdded) {
                  var item = assetsIndex[grid.dragOver.get('id')];
                  item.class.add('confirm-animation');
                  setTimeout(function () {
                      item.class.remove('confirm-animation');
                  }, 800);
              }
          }
      }
  });
  dropRef.element.classList.add('assets-drop-area');

  editor.on('permissions:writeState', function(state) {
      tree.enabled = state;
      grid.enabled = state;
  });

  var labelNoAssets = new ui.Label({
      unsafe: true
  });
  labelNoAssets.renderChanges = false;
  labelNoAssets.class.add('no-assets');
  labelNoAssets.hidden = true;
  files.append(labelNoAssets);

  editor.method('assets:panel:message', function (msg) {
      labelNoAssets.text = msg;
      labelNoAssets.hidden = !msg;
  });

  var scriptsIndex = { };
  var assetsIndex = { };
  var assetsChanged = false;
  grid.assetsIndex = assetsIndex;

  var gridDropBorder = document.createElement('div');
  gridDropBorder.classList.add('assets-drop-border');
  root.append(gridDropBorder);

  var treeDropBorder = document.createElement('div');
  treeDropBorder.classList.add('assets-drop-border');
  root.append(treeDropBorder);

  var tooltipAsset = new ui.Tooltip({
      text: 'Asset',
      align: 'top',
      hoverable: false
  });
  root.append(tooltipAsset);

  var tooltipTarget = null;
  var tooltipTimeout = null;

  var tooltipShow = function() {
      if (! tooltipTarget)
          return;

      while(tooltipTarget && tooltipTarget.nodeName !== 'LI' && ! tooltipTarget.classList.contains('ui-grid-item'))
          tooltipTarget = tooltipTarget.parentNode;

      if (! tooltipTarget || ! tooltipTarget.ui)
          return;

      var rect = tooltipTarget.getBoundingClientRect();
      var off = 16;

      if (rect.width < 64) off = rect.width / 2;
      tooltipAsset.flip = rect.left + off > window.innerWidth / 2;
      if (tooltipAsset.flip) {
          tooltipAsset.position(rect.right - off, rect.bottom);
      } else {
          tooltipAsset.position(rect.left + off, rect.bottom);
      }

      tooltipAsset.text = tooltipTarget.ui.asset.get('name');
      tooltipAsset.hidden = false;
  };

  var onAssetItemHover = function(evt) {
      if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
          tooltipTimeout = null;
      }

      tooltipTarget = evt.target;
      tooltipTimeout = setTimeout(tooltipShow, 300);
  };
  var onAssetItemBlur = function() {
      tooltipAsset.hidden = true;

      if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
          tooltipTimeout = null;
      }
  };
  var onAssetItemRemove = function() {
      if (! tooltipTarget || ! tooltipTarget.ui || tooltipTarget.ui.asset !== this)
          return;

      onAssetItemBlur();
  };

  grid.innerElement.addEventListener('mousewheel', function() {
      tooltipAsset.hidden = true;

      if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
          tooltipTimeout = null;
      }
  }, false);

  tree.on('select', function(item) {
      if (assetsChanged)
          return;

      if (item.asset) {
          if (! Tree._ctrl || ! Tree._ctrl()) {
              if (currentFolder !== item.asset) {
                  item.selected = false;
              } else {
                  editor.call('selector:set', 'asset', [ item.asset ]);
              }
          } else {
              editor.call('selector:add', 'asset', item.asset);
          }
      }

      if (! item.asset) {
          if (item === treeRoot) {
              editor.call('assets:filter:search', '');
              editor.call('assets:panel:currentFolder', null);
          } else if (item === treeScripts) {
              editor.call('assets:filter:search', '');
              editor.call('assets:panel:currentFolder', 'scripts');
          }
          return;
      }

      if (! Tree._ctrl || ! Tree._ctrl()) {
          editor.call('assets:filter:search', '');
          editor.call('assets:panel:currentFolder', item.asset);
      }
  });

  tree.on('deselect', function(item) {
      if (assetsChanged)
          return;

      if (item.asset)
          editor.call('selector:remove', item.asset);
  });

  grid.on('select', function(item) {
      if (assetsChanged)
          return;

      if (item.asset) {
          editor.call('selector:add', 'asset', item.asset);
      } else if (item.script) {
          editor.call('selector:add', 'asset', item.script);
      }
  });

  grid.on('deselect', function(item) {
      if (assetsChanged)
          return;

      if (item.asset) {
          editor.call('selector:remove', item.asset);
      } else if (item.script) {
          editor.call('selector:remove', item.script);
      }
  });

  editor.on('selector:change', function(type, items) {
      assetsChanged = true;

      selector.prev.type = selector.type;
      selector.prev.items = selector.items;

      selector.type = editor.call('selector:type');
      selector.items = editor.call('selector:items');

      if (type === 'asset') {
          tree.clear();
          items = items.slice(0);
          var assets = items.slice(0);

          for(var i = 0; i < items.length; i++) {
              if (legacyScripts && items[i].get('type') === 'script') {
                  assets[i] = scriptsIndex[items[i].get('filename')];
              } else {
                  assets[i] = assetsIndex[items[i].get('id')];
                  if (assets[i].tree) {
                      assets[i].tree.selected = true;

                      // open tree up
                      var path = items[i].get('path');
                      for(var n = 0; n < path.length; n++) {
                          if (! assetsIndex[path[n]] || ! assetsIndex[path[n]].tree)
                              continue;

                          assetsIndex[path[n]].tree.open = true;
                      }
                  }
              }
          }

          grid.selected = assets;
      } else {
          if ((legacyScripts && ! (gridScripts.selected && grid.selected.length === 1)) || selector.type !== 'asset')
              grid.selected = [ ];

          tree.clear();
      }

      assetsChanged = false;
  });

  // return grid
  editor.method('assets:grid', function() {
      return grid;
  });

  var searchingInProgress = false;
  var searchingElement = null;
  var searchingFunction = null;
  var searchingBatchLimit = 512;

  var searchNextBatch = function() {
      var done = 0;

      while(searchingElement && (searchingBatchLimit === 0 || done < searchingBatchLimit)) {
          var item = searchingElement.ui;

          if (item) {
              if (item.asset) {
                  item.hidden = ! searchingFunction('asset', item.asset);
              } else if (item.script) {
                  item.hidden = ! searchingFunction('script', item.script);
              }
              done++;
          }

          searchingElement = searchingElement.nextSibling;
      }

      if (! searchingElement) {
          searchingInProgress = false;
      } else {
          requestAnimationFrame(searchNextBatch);
      }
  };

  // filter assets in grid
  editor.method('assets:panel:filter', function(fn, immediate) {
      if (! fn)
          fn = editor.call('assets:panel:filter:default');

      labelNoAssets.hidden = true;

      searchingElement = grid._element.firstChild;
      searchingFunction = fn;

      var type = editor.call('assets:filter:type');
      var search = editor.call('assets:filter:search');

      if (! search || immediate) {
          searchingBatchLimit = 0;
      } else {
          searchingBatchLimit = 512;
      }

      if (! searchingInProgress) {
          searchingInProgress = true;
          requestAnimationFrame(searchNextBatch);
      }

      // navigate to selected assets folder
      if (searching && ! search) {
          searching = false;

          if (selector.type === 'asset') {
              var script = legacyScripts && selector.items[0].get('type') === 'script';
              var path = script ? [ ] : selector.items[0].get('path');
              var multiPath = false;
              for(var i = 1; i < selector.items.length; i++) {
                  var item = selector.items[i];
                  if (script !== (item.get('type') === 'script') || (! script && ! path.equals(item.get('path')))) {
                      multiPath = true;
                      break;
                  }
              }

              if (! multiPath) {
                  if (path.length) {
                      editor.call('assets:panel:currentFolder', editor.call('assets:get', path[path.length - 1]));
                      assetsIndex[selector.items[0].get('id')].element.focus();
                  } else if (script) {
                      editor.call('assets:panel:currentFolder', 'scripts');
                  } else {
                      editor.call('assets:panel:currentFolder', null);
                  }
              }
          }
      }

      if (search)
          searching = true;

      if (legacyScripts)
          gridScripts.hidden = ! fn('scripts', 'scripts');
  });


  // get grid item by id
  editor.method('assets:panel:get', function(id) {
      return assetsIndex[id] || scriptsIndex[id];
  });

  var appendChildFolders = function(item) {
      var queue = treeAppendQueue[item.asset.get('id')];
      if (! queue || ! queue.length)
          return;

      for(var i = 0; i < queue.length; i++) {
          var closest = treeFindClosest(item.tree, queue[i].tree);
          if (closest === -1) {
              item.tree.append(queue[i].tree);
          } else {
              item.tree.appendBefore(queue[i].tree, item.tree.child(closest).ui);
          }
          appendChildFolders(queue[i]);
      }

      delete treeAppendQueue[item.asset.get('id')];
  };

  var treeFindClosest = function(item, b, nameOld) {
      var l = Array.prototype.slice.call(item.element.childNodes, 1);
      if (item === treeRoot && legacyScripts)
          l = l.slice(1);

      var min = 0;
      var max = l.length - 1;
      var cur;
      var a, i;
      var aN, bN;

      if (l.length === 0)
          return -1;

      if (((a === b) ? nameOld.toLowerCase() : l[0].ui.text.toLowerCase()) === bN)
          return 0;

      while (min <= max) {
          cur = Math.floor((min + max) / 2);
          a = l[cur];

          aN = (a === b) ? nameOld.toLowerCase() : a.ui.text.toLowerCase();
          bN = b.text.toLowerCase();

          if (aN > bN) {
              max = cur - 1;
          } else if (aN < bN) {
              min = cur + 1;
          } else {
              return cur;
          }
      }

      if (aN > bN)
          return cur;

      if ((cur + 1) === l.length)
          return -1;

      return cur + 1;
  };

  var createLegacyScriptFolder = function() {
      gridScripts = new ui.GridItem();
      gridScripts.class.add('type-folder', 'scripts');
      grid.append(gridScripts);

      gridScripts.tree = treeScripts = new ui.TreeItem({
          text: 'scripts'
      });
      gridScripts.tree.class.add('scripts');
      gridScripts.tree.on('select', function() {
          this.selected = false;
      });
      treeRoot.append(gridScripts.tree);

      gridScripts.on('select', function() {
          editor.call('selector:clear');

          if (! selector.type) {
              selector.prev.type = null;
              selector.prev.items = [ ];
          }
      });

      // scripts open
      gridScripts.element.addEventListener('dblclick', function() {
          tree.clear();
          editor.call('assets:filter:search', '');
          editor.call('assets:panel:currentFolder', 'scripts');
          // change back selection

          if (selector.prev.type)
              editor.call('selector:set', selector.prev.type, selector.prev.items);
      }, false);

      var thumbnail = gridScripts.thumbnail = document.createElement('div');
      thumbnail.classList.add('thumbnail', 'placeholder');
      gridScripts.element.appendChild(thumbnail);

      var icon = document.createElement('div');
      icon.classList.add('icon');
      gridScripts.element.appendChild(icon);

      var label = gridScripts.labelElement = document.createElement('div');
      label.classList.add('label');
      label.textContent = 'scripts';
      gridScripts.element.appendChild(label);

      // context menu
      var menu = new ui.Menu();
      root.append(menu);

      // script
      var menuScript = new ui.MenuItem({
          text: 'New Script',
          value: 'script',
          icon: '&#57864;'
      });
      menuScript.on('select', function () {
          editor.call('sourcefiles:new');
      });
      menu.append(menuScript);

      editor.on('repositories:load', function (repositories) {
          if (repositories.get('current') !== 'directory')
              menuScript.disabled = true;
      });
      var onContextMenu = function(evt) {
          evt.stopPropagation();
          evt.preventDefault();

          if (! editor.call('permissions:write'))
              return;

          menu.position(evt.clientX + 1, evt.clientY);
          menu.open = true;
      };
      gridScripts.element.addEventListener('contextmenu', onContextMenu, false);
      treeScripts.elementTitle.addEventListener('contextmenu', onContextMenu, false);

      resizeQueue();
  };
  if (legacyScripts)
      createLegacyScriptFolder();

  // select all hotkey
  // ctrl + a
  editor.call('hotkey:register', 'asset:select-all', {
      ctrl: true,
      key: 'a',
      callback: function() {
          var assets = [ ];

          for(var key in assetsIndex) {
              if (! assetsIndex[key].hidden)
                  assets.push(assetsIndex[key].asset);
          }

          for(var key in scriptsIndex) {
              if (! scriptsIndex[key].hidden)
                  assets.push(scriptsIndex[key].script);
          }

          if (assets.length) {
              editor.call('selector:set', 'asset', assets);
          } else {
              editor.call('selector:clear');
          }
      }
  });

  var renderQueue = [ ];
  var renderQueueIndex = { };

  var renderQueueUpdate = function() {
      requestAnimationFrame(renderQueueUpdate);

      if (! renderQueue.length)
          return;

      var items = 0;
      while(items < 4 && renderQueue.length) {
          items++;
          var id = renderQueue.shift();
          delete renderQueueIndex[id];

          if (! assetsIndex[id] || ! assetsIndex[id].thumbnail || ! assetsIndex[id].thumbnail.render)
              continue;

          assetsIndex[id].thumbnail.render();
      }
  };
  requestAnimationFrame(renderQueueUpdate);

  var renderQueueAdd = function(asset) {
      var id = asset.get('id');
      if (renderQueueIndex[id])
          return;

      if (! assetsIndex[id] || ! assetsIndex[id].thumbnail || ! assetsIndex[id].thumbnail.render)
          return;

      renderQueueIndex[id] = true;
      renderQueue.push(id);
  };

  var renderQueueRemove = function(asset) {
      var id = parseInt(asset.get('id'), 10);
      if (! renderQueueIndex[id])
          return;

      var ind = renderQueue.indexOf(id);
      if (ind !== -1)
          renderQueue.splice(ind, 1);

      delete renderQueueIndex[id];
  };

  var showGridDropHighlight = function (item) {
      var clip = files.element.getBoundingClientRect();
      var rect = item.element.getBoundingClientRect();
      var top = Math.max(rect.top, clip.top);
      var bottom = Math.min(rect.bottom, clip.bottom);

      if ((bottom - top) > 8) {
          gridDropBorder.classList.add('active');
          gridDropBorder.style.left = rect.left + 'px';
          gridDropBorder.style.top = top + 'px';
          gridDropBorder.style.right = (window.innerWidth - rect.right) + 'px';
          gridDropBorder.style.bottom = (window.innerHeight - bottom) + 'px';
      }
  };

  var showTreeDropHighlight = function (item) {
      var clip = files.element.getBoundingClientRect();
      var rect = item.tree.elementTitle.getBoundingClientRect();
      var top = Math.max(rect.top, clip.top);
      var bottom = Math.min(rect.bottom, clip.bottom);
      if (rect.height && (bottom - top) > 4) {
          treeDropBorder.classList.add('active');
          treeDropBorder.style.left = rect.left + 'px';
          treeDropBorder.style.top = top + 'px';
          treeDropBorder.style.right = (window.innerWidth - rect.right) + 'px';
          treeDropBorder.style.bottom = (window.innerHeight - bottom) + 'px';
      }
  };

  // Called when a folder asset is added
  var onAddFolder = function (asset, item) {
      item.tree = new ui.TreeItem({
          text: asset.get('name')
      });
      item.tree.asset = asset;

      var path = asset.get('path');
      var parent;
      if (path.length) {
          var parentFolderId = path[path.length - 1];
          if (assetsIndex[parentFolderId]) {
              parent = assetsIndex[parentFolderId].tree;
          } else {
              if (! treeAppendQueue[parentFolderId])
                  treeAppendQueue[parentFolderId] = [];

              treeAppendQueue[parentFolderId].push(item);
          }
      } else {
          parent = treeRoot;
      }

      if (parent) {
          var closest = treeFindClosest(parent, item.tree);
          if (closest === -1) {
              parent.append(item.tree);
          } else {
              parent.appendBefore(item.tree, parent.child(closest).ui);
          }

          appendChildFolders(item);
      }

      var onMouseOver = function () {
          if (! dragging || grid.dragOver === asset)
              return;

          // don't allow to drag on it self
          if (draggingData.ids) {
              // multi-drag
              if (draggingData.ids.indexOf(parseInt(asset.get('id'), 10)) !== -1)
                  return;
          } else if (draggingData.id) {
              // single-drag
              if (parseInt(asset.get('id'), 10) === parseInt(draggingData.id, 10))
                  return;
          } else {
              // script file drag
              return;
          }


          // already in that folder
          var dragAsset = editor.call('assets:get', draggingData.id || draggingData.ids[0]);
          var path = dragAsset.get('path');
          if (path.length && path[path.length - 1] === parseInt(asset.get('id'), 10))
              return;

          // don't allow dragging into own child
          if (draggingData.ids) {
              // multi-drag
              var assetPath = asset.get('path');
              for (var i = 0; i < draggingData.ids.length; i++) {
                  if (assetPath.indexOf(draggingData.ids[i]) !== -1)
                      return;
              }
          } else {
              // single-drag
              if (asset.get('path').indexOf(parseInt(dragAsset.get('id'), 10)) !== -1)
                  return;
          }

          showGridDropHighlight(item);
          showTreeDropHighlight(item);

          grid.dragOver = asset;
      };

      var onMouseOut = function () {
          if (! dragging || grid.dragOver !== asset)
              return;

          gridDropBorder.classList.remove('active');
          treeDropBorder.classList.remove('active');
          grid.dragOver = undefined;
      };

      // draggable
      item.tree.elementTitle.draggable = true;

      item.element.addEventListener('mouseout', onMouseOut, false);
      item.tree.elementTitle.addEventListener('mouseout', onMouseOut, false);

      item.element.addEventListener('mouseover', onMouseOver, false);
      item.tree.elementTitle.addEventListener('mouseover', onMouseOver, false);
  };

  // Called when a script asset is added
  var onAddScript = function (asset, item, events) {
      events.push(editor.on('assets[' + asset.get('id') + ']:scripts:collide', function (script) {
          item.class.add('scripts-collide');
      }));
      events.push(editor.on('assets[' + asset.get('id') + ']:scripts:resolve', function (script) {
          item.class.remove('scripts-collide');
      }));
  };

  var onAddBundle = function (asset, item) {
      var confirmElement = document.createElement('div');
      confirmElement.classList.add('confirm');
      confirmElement.classList.add('thumbnail');
      item.element.appendChild(confirmElement);

      var onMouseOver = function () {
          if (! dragging || grid.dragOver === asset)
              return;

          if (! draggingData.ids && !draggingData.id) {
              // script file drag
              return;
          }

          var assetIds = draggingData.ids ? draggingData.ids.slice() : [draggingData.id];

          // don't allow to drag on it self
          if (assetIds.indexOf(parseInt(asset.get('id'), 10)) !== -1) {
              return;
          }

          // make sure we'fe found at least 1 valid asset
          var valid = false;
          var bundleAssets = asset.get('data.assets');
          for (var i = 0; i < assetIds.length; i++) {
              var draggedAsset = editor.call('assets:get', assetIds[i]);
              if (! draggedAsset) continue;
              if (bundleAssets.indexOf(draggedAsset.get('id')) !== -1) continue;

              if (!draggedAsset.get('source')) {
                  var type = draggedAsset.get('type');
                  if (['folder', 'script', 'bundle'].indexOf(type) === -1) {
                      valid = true;
                      break;
                  }
              }
          }

          if (!valid) return;

          showGridDropHighlight(item);

          grid.dragOver = asset;
      };

      var onMouseOut = function () {
          if (! dragging || grid.dragOver !== asset)
              return;

          gridDropBorder.classList.remove('active');
          grid.dragOver = undefined;
      };

      item.element.addEventListener('mouseout', onMouseOut, false);
      item.element.addEventListener('mouseover', onMouseOver, false);
  };

  editor.on('assets:add', function (asset, pos) {
      asset._type = 'asset';

      var events = [];
      var item = new ui.GridItem();
      item.asset = asset;
      item.class.add('type-' + asset.get('type'));

      item.element.addEventListener('mouseover', onAssetItemHover, false);
      item.element.addEventListener('mouseout', onAssetItemBlur, false);

      asset.once('destroy', onAssetItemRemove);

      var onMouseDown = function (evt) {
          evt.stopPropagation();
      };

      var onDragStart = function (evt) {
          evt.preventDefault();
          evt.stopPropagation();

          if (! editor.call('permissions:write'))
              return;

          var type = 'asset.' + asset.get('type');
          var data = {
              id: asset.get('id')
          };

          var selectorType = editor.call('selector:type');
          var selectorItems = editor.call('selector:items');

          if (selectorType === 'asset' && selectorItems.length > 1) {
              var path = selectorItems[0].get('path');

              if (selectorItems.indexOf(asset) !== -1) {
                  var ids = [ ];
                  for(var i = 0; i < selectorItems.length; i++) {
                      // don't allow multi-path dragging
                      if (path.length !== selectorItems[i].get('path').length || path[path.length - 1] !== selectorItems[i].get('path')[path.length - 1])
                          return;

                      ids.push(parseInt(selectorItems[i].get('id'), 10));
                  }

                  type = 'assets';
                  data = {
                      ids: ids
                  };
              }
          }

          editor.call('drop:set', type, data);
          editor.call('drop:activate', true);
      };

      if (asset.get('type') === 'folder') {
          onAddFolder(asset, item);
          item.tree.elementTitle.addEventListener('mousedown', onMouseDown, false);
          item.tree.elementTitle.addEventListener('dragstart', onDragStart, false);
      } else if (asset.get('type') === 'script') {
          onAddScript(asset, item, events);
      } else if (asset.get('type') === 'bundle') {
          onAddBundle(asset, item, events);
      }

      var updateTask = function() {
          var status = asset.get('task');
          item.class.remove('task', 'failed', 'running');
          if (status && typeof(status) === 'string' && status[0] !== '{') {
              item.class.add('task', status);
          }
      };

      // add task status
      updateTask();
      asset.on('task:set', updateTask);

      item.element.draggable = true;
      item.element.addEventListener('mousedown', onMouseDown, false);
      item.element.addEventListener('dragstart', onDragStart, false);

      assetsIndex[asset.get('id')] = item;

      // source
      if (asset.get('source'))
          item.class.add('source');

      if (! editor.call('assets:panel:filter:default')('asset', asset))
          item.hidden = true;

      var fileSize = asset.get('file.size');

      if (! asset.get('source')) {
          // update thumbnails change
          asset.on('thumbnails.m:set', function(value) {
              if (value.startsWith('/api')) {
                  value = value.appendQuery('t=' + asset.get('file.hash'));
              }

              thumbnail.style.backgroundImage = 'url(' + value + ')';
              thumbnail.classList.remove('placeholder');
          });

          asset.on('thumbnails.m:unset', function() {
              thumbnail.style.backgroundImage = 'none';
              thumbnail.classList.add('placeholder');
          });
      }

      // folder open
      if (asset.get('type') === 'folder') {
          item.element.addEventListener('dblclick', function() {
              tree.clear();
              item.tree.open = true;
              editor.call('assets:filter:search', '');
              editor.call('assets:panel:currentFolder', item.asset);

              // change back selection
              if (selector.type)
                  editor.call('selector:set', selector.prev.type, selector.prev.items);
          }, false);
      }

      // open sprite editor for textureatlas and sprite assets
      if (asset.get('type') === 'sprite' || asset.get('type') === 'textureatlas') {
          item.element.addEventListener('dblclick', function() {
              editor.call('picker:sprites', item.asset);
          }, false);
      }

      var thumbnail;
      var evtSceneSettings, evtAssetChanged;

      if (asset.get('type') === 'material' || asset.get('type') === 'model' || asset.get('type') === 'sprite' || (asset.get('type') === 'font') && !asset.get('source')) {
          var queuedRender = false;

          thumbnail = document.createElement('canvas');
          thumbnail.changed = true;
          thumbnail.width = 64;
          thumbnail.height = 64;

          if (asset.get('type') !== 'sprite') {
              thumbnail.classList.add('flipY');
          }

          var watching = null;

          var onRender = thumbnail.render = function() {
              queuedRender = false;

              if (item.hidden)
                  return;

              thumbnail.changed = false;

              editor.call('preview:render', asset, 64, 64, thumbnail);
          };
          var queueRender = function() {
              if (item.hidden) {
                  thumbnail.changed = true;
                  renderQueueRemove(asset);
              } else {
                  renderQueueAdd(asset);
              }
          };
          item.on('show', function() {
              if (thumbnail.changed)
                  queueRender();

              if (! watching) {
                  watching = editor.call('assets:' + asset.get('type') + ':watch', {
                      asset: asset,
                      autoLoad: true,
                      callback: queueRender
                  });
              }
          });
          var onUnwatch = function() {
              if (! watching)
                  return;

              editor.call('assets:' + asset.get('type') + ':unwatch', asset, watching);
              watching = null;

              renderQueueRemove(asset);
          };
          item.once('destroy', onUnwatch);
          if (! item.hidden) {
              requestAnimationFrame(queueRender);

              if (! watching) {
                  watching = editor.call('assets:' + asset.get('type') + ':watch', {
                      asset: asset,
                      autoLoad: true,
                      callback: queueRender
                  });
              }
          }

          evtSceneSettings = editor.on('preview:scene:changed', queueRender);
      } else if (asset.get('type') === 'cubemap') {
          thumbnail = document.createElement('canvas');
          thumbnail.changed = true;
          thumbnail.width = 64;
          thumbnail.height = 64;

          var watching = null;

          var positions = [ [ 32, 24 ], [ 0, 24 ], [ 16, 8 ], [ 16, 40 ], [ 16, 24 ], [ 48, 24 ] ];
          var images = [ null, null, null, null, null, null ];

          var onRender = thumbnail.render = function() {
              queuedRender = false;

              if (item.hidden)
                  return;

              thumbnail.changed = false;

              var ctx = thumbnail.ctx;
              if (! ctx) ctx = thumbnail.ctx = thumbnail.getContext('2d');

              ctx.clearRect(0, 0, 64, 64);

              // left
              for(var i = 0; i < 6; i++) {
                  var id = asset.get('data.textures.' + i);
                  var image = null;

                  if (id) {
                      var texture = editor.call('assets:get', id);
                      if (texture) {
                          var hash = texture.get('file.hash');
                          if (images[i] && images[i].hash === hash) {
                              image = images[i];
                          } else {
                              var url = texture.get('thumbnails.s');

                              if (images[i])
                                  images[i].onload = null;

                              images[i] = null;

                              if (url) {
                                  image = images[i] = new Image();
                                  image.hash = hash;
                                  image.onload = queueRender;
                                  image.src = url.appendQuery('t=' + hash);
                              }
                          }
                      } else if (images[i]) {
                          images[i].onload = null;
                          images[i] = null;
                      }
                  } else if (images[i]) {
                      images[i].onload = null;
                      images[i] = null;
                  }

                  if (image) {
                      ctx.drawImage(image, positions[i][0], positions[i][1], 16, 16);
                  } else {
                      ctx.beginPath();
                      ctx.rect(positions[i][0], positions[i][1], 16, 16);
                      ctx.fillStyle = '#000';
                      ctx.fill();
                  }
              }
          };
          var queueRender = function() {
              if (item.hidden) {
                  thumbnail.changed = true;
                  renderQueueRemove(asset);
              } else {
                  renderQueueAdd(asset);
              }
          };

          item.on('show', function() {
              if (thumbnail.changed)
                  queueRender();

              if (! watching) {
                  watching = editor.call('assets:cubemap:watch', {
                      asset: asset,
                      autoLoad: true,
                      callback: queueRender
                  });
              }
          });

          var onUnwatch = function() {
              if (! watching)
                  return;

              editor.call('assets:cubemap:unwatch', asset, watching);
              watching = null;

              renderQueueRemove(asset);
          };
          item.once('destroy', onUnwatch);

          if (! item.hidden) {
              requestAnimationFrame(queueRender);

              if (! watching) {
                  watching = editor.call('assets:cubemap:watch', {
                      asset: asset,
                      autoLoad: true,
                      callback: queueRender
                  });
              }
          }

          evtAssetChanged = asset.on('*:set', function(path) {
              if (queuedRender || ! path.startsWith('data.textures'))
                  return;

              queueRender();
          });
      } else {
          thumbnail = document.createElement('div');
      }

      item.thumbnail = thumbnail;
      thumbnail.classList.add('thumbnail');
      item.element.appendChild(thumbnail);

      if (asset.has('thumbnails') && ! asset.get('source')) {
          thumbnail.style.backgroundImage = 'url("' + config.url.home + asset.get('thumbnails.m') + '")';
      } else {
          thumbnail.classList.add('placeholder');
      }

      var icon = document.createElement('div');
      icon.classList.add('icon');
      item.element.appendChild(icon);

      var label = item.labelElement = document.createElement('div');
      label.classList.add('label');
      label.textContent = asset.get('name');
      item.element.appendChild(label);

      var users = item.users = document.createElement('div');
      users.classList.add('users');
      item.element.appendChild(users);

      // update name/filename change
      events.push(asset.on('name:set', function(name, nameOld) {
          // grid
          label.textContent = this.get('name');
          // tree
          if (item.tree) {
              item.tree.text = this.get('name');

              // resort element (move match alphabetical order)
              var parent = item.tree.parent;
              item.tree.parent.element.removeChild(item.tree.element);
              var closest = treeFindClosest(parent, item.tree, nameOld);
              if (closest === -1) {
                  parent.element.appendChild(item.tree.element);
              } else {
                  parent.element.insertBefore(item.tree.element, parent.child(closest));
              }

              resizeQueue();
          }

          keepLegacyScriptsAtTop();
      }));

      events.push(asset.on('path:set', function(path, pathOld) {
          // show or hide based on filters
          item.hidden = ! editor.call('assets:panel:filter:default')('asset', this);

          if (item.tree) {
              if (! pathOld.length || ! path.length || path[path.length - 1] !== pathOld[pathOld.length - 1]) {
                  item.tree.parent.remove(item.tree);
                  var parent;

                  if (path.length) {
                      parent = assetsIndex[path[path.length - 1]].tree;
                  } else {
                      parent = treeRoot;
                  }

                  var closest = treeFindClosest(parent, item.tree);
                  if (closest === -1) {
                      parent.append(item.tree);
                  } else {
                      parent.appendBefore(item.tree, parent.child(closest).ui);
                  }
              }

              if (currentFolder === asset)
                  editor.emit('assets:panel:currentFolder', currentFolder);
          }

          keepLegacyScriptsAtTop();
      }));

      if (! asset.get('source')) {
          // used event
          var evtUnused = editor.on('assets:used:' + asset.get('id'), function(state) {
              if (state) {
                  item.class.remove('unused');
              } else {
                  item.class.add('unused');
              }
          });
          // used state
          if (! editor.call('assets:used:get', asset.get('id')))
              item.class.add('unused');

          // clean events
          item.once('destroy', function() {
              evtUnused.unbind();
          });
      }

      // clean events
      item.once('destroy', function() {
          editor.call('selector:remove', asset);

          for(var i = 0; i < events.length; i++)
              events[i].unbind();
          events = null;

          delete assetsIndex[asset.get('id')];

          if (evtSceneSettings)
              evtSceneSettings.unbind();

          if (evtAssetChanged)
              evtAssetChanged.unbind();
      });

      // append to grid
      var assets = editor.call('assets:raw');
      if (pos === -1 || ! assets.data[pos + 1]) {
          grid.append(item);
      } else {
          grid.appendBefore(item, assetsIndex[assets.data[pos + 1].get('id')]);
      }

      resizeQueue();

      keepLegacyScriptsAtTop();
  });

  var keepLegacyScriptsAtTop = function() {
      if (! legacyScripts)
          return;

      // resort scripts folder in grid
      gridScripts.element.parentNode.removeChild(gridScripts.element);
      var first = grid.element.firstChild;
      if (first) {
          grid.element.insertBefore(gridScripts.element, first);
      } else {
          grid.element.appendChild(gridScripts.element);
      }

      // resort scripts folder in tree
      treeScripts.element.parentNode.removeChild(treeScripts.element);
      var next = treeRoot.elementTitle.nextSibling;
      if (next) {
          treeRoot.element.insertBefore(treeScripts.element, next);
      } else {
          treeRoot.element.appendChild(treeScripts.element);
      }
  };

  editor.on('assets:move', function(asset, pos) {
      var item = assetsIndex[asset.get('id')];
      // remove
      grid.element.removeChild(item.element);
      // append
      if (pos === -1) {
          // to end
          grid.append(item);
      } else {
          // before another element
          grid.appendBefore(item, assetsIndex[editor.call('assets:raw').data[pos + 1].get('id')]);
      }
  });

  editor.on('assets:remove', function(asset) {
      var treeItem = assetsIndex[asset.get('id')].tree;
      if (treeItem) {
          if (treeItem.parent)
              treeItem.parent.remove(treeItem);
          treeItem.destroy();
      }

      assetsIndex[asset.get('id')].destroy();

      resizeQueue();

      // reselect current directory, if selected was removed
      if (currentFolder && typeof(currentFolder) !== 'string') {
          var id = parseInt(currentFolder.get('id'), 10);
          var path = asset.get('path');
          var ind = path.indexOf(id);
          if (id === parseInt(asset.get('id'), 10) || ind !== -1) {
              if (ind === -1)
                  ind = path.length - 1;

              var found = false;
              i = ind + 1;
              while(i--) {
                  if (assetsIndex[path[i]]) {
                      found = true;
                      editor.call('assets:panel:currentFolder', assetsIndex[path[i]].asset);
                      break;
                  }
              }

              if (! found)
                  editor.call('assets:panel:currentFolder', null);
          }
      }
  });

  var addSourceFile = function(file) {
      file.set('type', 'script');

      var item = new ui.GridItem();
      item.script = file;
      item.class.add('type-script');
      grid.append(item);

      if (! editor.call('assets:panel:filter:default')('script', file))
          item.hidden = true;

      scriptsIndex[file.get('filename')] = item;

      var thumbnail = document.createElement('div');
      thumbnail.classList.add('thumbnail', 'placeholder');
      item.element.appendChild(thumbnail);

      var icon = document.createElement('div');
      icon.classList.add('icon');
      item.element.appendChild(icon);

      var label = item.labelElement = document.createElement('div');
      label.classList.add('label');
      label.textContent = file.get('filename');
      item.element.appendChild(label);

      var users = item.users = document.createElement('div');
      users.classList.add('users');
      item.element.appendChild(users);

      // update name/filename change
      var evtNameSet = file.on('filename:set', function(value, valueOld) {
          label.textContent = value;
          scriptsIndex[value] = item;
          delete scriptsIndex[valueOld];
      });
      item.on('destroy', function() {
          editor.call('selector:remove', file);
          evtNameSet.unbind();
          delete scriptsIndex[file.get('filename')];
      });
      file.on('destroy', function() {
          item.destroy();
      });

      editor.call('drop:item', {
          element: item.element,
          type: 'asset.script',
          data: {
              filename: file.get('filename')
          }
      });
  };
  var removeSourceFile = function(file) {
      file.destroy();
  };

  editor.on('sourcefiles:add', addSourceFile);
  editor.on('sourcefiles:remove', removeSourceFile);
});


/* editor/assets/assets-panel-control.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var assetsPanel = editor.call('layout.assets');

  // context menu
  var menu = new ui.Menu();
  root.append(menu);

  var assets = {
      'upload': {
          title: 'Upload',
          icon: '&#57909;'
      },
      'folder': {
          title: 'Folder',
          icon: '&#57657;'
      },
      'css': {
          title: 'CSS',
          icon: '&#57864;'
      },
      'cubemap': {
          title: 'CubeMap',
          icon: '&#57879;'
      },
      'html': {
          title: 'HTML',
          icon: '&#57864;'
      },
      'json': {
          title: 'JSON',
          icon: '&#57864;'
      },
      'material': {
          title: 'Material',
          icon: '&#57749;'
      },
      'script': {
          title: 'Script',
          icon: '&#57864;'
      },
      'shader': {
          title: 'Shader',
          icon: '&#57864;'
      },
      'text': {
          title: 'Text',
          icon: '&#57864;'
      }
  };

  if (editor.call('users:hasFlag', 'hasBundles')) {
      assets.bundle = {
          title: 'Asset Bundle',
          icon: '&#58384;'
      };
  }

  var addNewMenuItem = function(key, data) {
      // new folder
      var item = new ui.MenuItem({
          text: data.title,
          icon: data.icon || '',
          value: key
      });
      item.on('select', function() {
          var args = {
              parent: editor.call('assets:panel:currentFolder')
          };

          if (key === 'upload') {
              editor.call('assets:upload:picker', args);
          } else if (key === 'script') {
              if (editor.call('settings:project').get('useLegacyScripts')) {
                  editor.call('sourcefiles:new');
              } else {
                  editor.call('picker:script-create', function(filename) {
                      editor.call('assets:create:script', {
                          filename: filename,
                          boilerplate: true
                      });
                  });
              }
          } else {
              editor.call('assets:create:' + key, args)
          }
      });
      menu.append(item);

      if (key === 'script') {
          editor.on('repositories:load', function (repositories) {
              if (repositories.get('current') !== 'directory')
                  item.disabled = true;
          });
      }
  };

  var keys = Object.keys(assets);
  for(var i = 0; i < keys.length; i++) {
      if (! assets.hasOwnProperty(keys[i]))
          continue;

      addNewMenuItem(keys[i], assets[keys[i]]);
  }

  // controls
  var controls = new ui.Panel();
  controls.enabled = false;
  controls.class.add('assets-controls');
  assetsPanel.header.append(controls);
  editor.on('permissions:writeState', function(state) {
      controls.enabled = state;
  });


  // add
  var btnNew = new ui.Button();
  btnNew.hidden = ! editor.call('permissions:write');
  btnNew.class.add('create-asset');
  btnNew.text = '&#57632;';
  btnNew.on('click', function(evt) {
      var rect = btnNew.element.getBoundingClientRect();
      menu.position(rect.right, rect.top);
      menu.open = true;
  });
  controls.append(btnNew);

  var tooltipAdd = Tooltip.attach({
      target: btnNew.element,
      text: 'Add Asset',
      align: 'bottom',
      root: root
  });
  menu.on('open', function(state) {
      tooltipAdd.disabled = state;
  });

  // delete
  var btnDelete = new ui.Button({
      text: '&#57636;'
  });
  btnDelete.hidden = ! editor.call('permissions:write');
  btnDelete.style.fontWeight = 200;
  btnDelete.disabled = true;
  btnDelete.class.add('delete');
  btnDelete.on('click', function() {
      if (! editor.call('permissions:write'))
          return;

      var type = editor.call('selector:type');
      if (type !== 'asset')
          return;

      editor.call('assets:delete:picker', editor.call('selector:items'));
  });
  controls.append(btnDelete);

  var tooltipDelete = Tooltip.attach({
      target: btnDelete.element,
      text: 'Delete Asset',
      align: 'bottom',
      root: root
  });
  tooltipDelete.class.add('innactive');


  editor.on('permissions:writeState', function(state) {
      btnNew.hidden = ! state;
      btnDelete.hidden = ! state;
  });


  // folder up
  var btnUp = new ui.Button({
      text: '&#58117;'
  });
  btnUp.style.fontWeight = 200;
  btnUp.disabled = true;
  btnUp.class.add('up');
  btnUp.on('click', function() {
      var folder = editor.call('assets:panel:currentFolder');
      if (! folder) return;

      if (folder === 'scripts') {
          editor.call('assets:panel:currentFolder', null);
      } else {
          var path = folder.get('path');
          if (path.length) {
              var parent = editor.call('assets:get', path[path.length - 1]);
              if (parent) {
                  editor.call('assets:panel:currentFolder', parent);
              } else {
                  editor.call('assets:panel:currentFolder', null);
              }
          } else {
              editor.call('assets:panel:currentFolder', null);
          }
      }
  });
  controls.append(btnUp);

  editor.on('assets:panel:currentFolder', function(folder) {
      if (folder) {
          btnUp.disabled = false;
          tooltipUp.class.remove('innactive');
      } else {
          btnUp.disabled = true;
          tooltipUp.class.add('innactive');
      }
  });

  var tooltipUp = Tooltip.attach({
      target: btnUp.element,
      text: 'Folder Up',
      align: 'bottom',
      root: root
  });
  tooltipUp.class.add('innactive');


  var assetsGrid = assetsPanel.dom.querySelector('.ui-panel > .content > ul.ui-grid.assets').ui;

  // thumbnails size
  var btnThumbSize = new ui.Button({
      text: '&#57669;'
  });
  btnThumbSize.style.fontWeight = 200;
  btnThumbSize.class.add('size');
  btnThumbSize.on('click', function() {
      if (assetsGrid.class.contains('small')) {
          assetsGrid.class.remove('small');
          tooltipThumbSize.html = '<span style="color:#fff">Large</span> / Small';
          editor.call('localStorage:set', 'editor:assets:thumbnail:size', 'large');
      } else {
          assetsGrid.class.add('small');
          tooltipThumbSize.html = 'Large / <span style="color:#fff">Small</span>';
          editor.call('localStorage:set', 'editor:assets:thumbnail:size', 'small');
      }
  });
  controls.append(btnThumbSize);

  var tooltipThumbSize = Tooltip.attach({
      target: btnThumbSize.element,
      align: 'bottom',
      root: root
  });

  var size = editor.call('localStorage:get', 'editor:assets:thumbnail:size');

  if (size === 'small') {
      assetsGrid.class.add('small');
      tooltipThumbSize.html = 'Large / <span style="color:#fff">Small</span>';
  } else {
      assetsGrid.class.remove('small');
      tooltipThumbSize.html = '<span style="color:#fff">Large</span> / Small';
  }
  tooltipThumbSize.class.add('innactive');


  editor.on('attributes:clear', function() {
      // btnDuplicate.disabled = true;
      btnDelete.disabled = true;
      tooltipDelete.class.add('innactive');
  });

  editor.on('attributes:inspect[*]', function(type) {
      if (type.startsWith('asset')) {
          btnDelete.enabled = true;
          tooltipDelete.class.remove('innactive');
      } else {
          btnDelete.enabled = false;
          tooltipDelete.class.add('innactive');
      }
      // btnDuplicate.enabled = type === 'asset.material';
  });
});


/* editor/assets/assets-pipeline-settings.js */
editor.once('load', function() {
  'use strict';

  var settings = editor.call('settings:projectUser');
  var projectSettings = editor.call('settings:project');

  var foldStates = {
      'pipeline': true
  };

  editor.on('attributes:inspect[editorSettings]', function() {
      var panel = editor.call('attributes:addPanel', {
          name: 'Asset Tasks'
      });
      panel.foldable = true;
      panel.folded = foldStates['pipeline'];
      panel.on('fold', function() { foldStates['pipeline'] = true; });
      panel.on('unfold', function() { foldStates['pipeline'] = false; });
      panel.class.add('component', 'pipeline');
      // reference
      editor.call('attributes:reference:attach', 'settings:asset-tasks', panel, panel.headerElement);

      var fieldSearchRelatedAssets = editor.call('attributes:addField', {
          parent: panel,
          name: 'Search related assets',
          type: 'checkbox',
          link: settings,
          path: 'editor.pipeline.searchRelatedAssets'
      });
      fieldSearchRelatedAssets.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:asset-tasks:searchRelatedAssets', fieldSearchRelatedAssets.parent.innerElement.firstChild.ui);

      var panelTextureSettings = editor.call('attributes:addPanel', {
          parent: panel,
          name: 'Texture Import Settings'
      });

      var fieldTexturePOT = editor.call('attributes:addField', {
          parent: panelTextureSettings,
          name: 'Textures POT',
          type: 'checkbox',
          link: settings,
          path: 'editor.pipeline.texturePot'
      });
      editor.call('attributes:reference:attach', 'settings:asset-tasks:texturePot', fieldTexturePOT.parent.innerElement.firstChild.ui);

      var fieldPreferTextureAtlas = editor.call('attributes:addField', {
          parent: panelTextureSettings,
          name: 'Create Atlases',
          type: 'checkbox',
          link: settings,
          path: 'editor.pipeline.textureDefaultToAtlas'
      });
      editor.call('attributes:reference:attach', 'settings:asset-tasks:textureDefaultToAtlas', fieldPreferTextureAtlas.parent.innerElement.firstChild.ui);

      var panelModelSettings = editor.call('attributes:addPanel', {
          parent: panel,
          name: 'Model Import Settings'
      });

      var fieldMapping = editor.call('attributes:addField', {
          parent: panelModelSettings,
          name: 'Preserve material mappings',
          type: 'checkbox',
          link: settings,
          path: 'editor.pipeline.preserveMapping'
      });
      fieldMapping.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:asset-tasks:preserveMapping', fieldMapping.parent.innerElement.firstChild.ui);

      var fieldModelV2 = editor.call('attributes:addField', {
          parent: panelModelSettings,
          name: 'Force legacy model v2',
          type: 'checkbox',
          link: projectSettings,
          path: 'useModelV2'
      });
      fieldModelV2.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:asset-tasks:useModelV2', fieldModelV2.parent.innerElement.firstChild.ui);

      var fieldOverwriteModel = editor.call('attributes:addField', {
          parent: panelModelSettings,
          name: 'Ovewrite Models',
          type: 'checkbox',
          link: settings,
          path: 'editor.pipeline.overwriteModel'
      });
      fieldOverwriteModel.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:asset-tasks:overwrite:model', fieldOverwriteModel.parent.innerElement.firstChild.ui);

      var fieldOverwriteAnimation = editor.call('attributes:addField', {
          parent: panelModelSettings,
          name: 'Overwrite Animations',
          type: 'checkbox',
          link: settings,
          path: 'editor.pipeline.overwriteAnimation'
      });
      fieldOverwriteAnimation.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:asset-tasks:overwrite:animation', fieldOverwriteAnimation.parent.innerElement.firstChild.ui);

      var fieldOverwriteMaterial = editor.call('attributes:addField', {
          parent: panelModelSettings,
          name: 'Overwrite Materials',
          type: 'checkbox',
          link: settings,
          path: 'editor.pipeline.overwriteMaterial'
      });
      fieldOverwriteMaterial.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:asset-tasks:overwrite:material', fieldOverwriteMaterial.parent.innerElement.firstChild.ui);

      var fieldOverwriteTexture = editor.call('attributes:addField', {
          parent: panelModelSettings,
          name: 'Overwrite Textures',
          type: 'checkbox',
          link: settings,
          path: 'editor.pipeline.overwriteTexture'
      });
      fieldOverwriteTexture.parent.innerElement.firstChild.style.width = 'auto';
      editor.call('attributes:reference:attach', 'settings:asset-tasks:overwrite:texture', fieldOverwriteTexture.parent.innerElement.firstChild.ui);
  });
});


/* editor/assets/assets-context-menu.js */
editor.once('load', function() {
  'use strict';

  var currentAsset = null;
  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');
  var root = editor.call('layout.root');

  var customMenuItems = [ ];

  // menu
  var menu = new ui.Menu();
  root.append(menu);


  // edit
  var menuItemNewScript = new ui.MenuItem({
      text: 'New Script',
      icon: '&#57864;',
      value: 'script'
  });
  menuItemNewScript.on('select', function() {
      if (legacyScripts) {
          editor.call('sourcefiles:new');
      } else {
          editor.call('picker:script-create', function(filename) {
              editor.call('assets:create:script', {
                  filename: filename,
                  boilerplate: true
              });
          });
      }
  });
  menu.append(menuItemNewScript);


  // new asset
  var menuItemNew = new ui.MenuItem({
      text: 'New Asset',
      icon: '&#57632;',
      value: 'new'
  });
  menu.append(menuItemNew);

  var downloadable = {
      'texture': 1,
      'textureatlas': 1,
      'html': 1,
      'css': 1,
      'shader': 1,
      'scene': 1,
      'json': 1,
      'audio': 1,
      'text': 1
  };

  var icons = {
      'upload': '&#57909;',
      'folder': '&#57657;',
      'css': '&#57864;',
      'cubemap': '&#57879;',
      'html': '&#57864;',
      'json': '&#57864;',
      'layers': '&#57992',
      'material': '&#57749;',
      'script': '&#57864;',
      'shader': '&#57864;',
      'text': '&#57864;',
      'texture': '&#57857;',
      'textureatlas': '&#57857;',
      'model': '&#57735;',
      'scene': '&#57735;',
      'animation': '&#57875;',
      'audio': '&#57872;',
      'bundle': '&#58384;'
  };

  var ICONS = {
      REFERENCES: '&#57622;',
      TEXTURE_ATLAS: '&#58162;',
      SPRITE_ASSET: '&#58261;',
      REPLACE: '&#57640;',
      REIMPORT: '&#57889;',
      DOWNLOAD: '&#57896;',
      EDIT: '&#57648;',
      DUPLICATE: '&#57638;',
      DELETE: '&#57636;',
      SCENE_SETTINGS: '&#57652;'
  };

  var assets = {
      'upload': 'Upload',
      'folder': 'Folder',
      'css': 'CSS',
      'cubemap': 'CubeMap',
      'html': 'HTML',
      'json': 'JSON',
      'material': 'Material',
      'script': 'Script',
      'shader': 'Shader',
      'text': 'Text'
  };

  if (editor.call('users:hasFlag', 'hasBundles')) {
      assets.bundle = 'Asset Bundle';
  }

  var addNewMenuItem = function(key, title) {
      // new folder
      var item = new ui.MenuItem({
          text: title,
          icon: icons[key] || '',
          value: key
      });
      item.on('select', function() {
          var args = { };

          if (currentAsset && currentAsset.get('type') === 'folder') {
              args.parent = currentAsset;
          } else if (currentAsset === undefined) {
              args.parent = null;
          }

          if (key === 'upload') {
              editor.call('assets:upload:picker', args);
          } else if (key === 'script') {
              if (legacyScripts) {
                  editor.call('sourcefiles:new');
              } else {
                  editor.call('picker:script-create', function(filename) {
                      editor.call('assets:create:script', {
                          filename: filename,
                          boilerplate: true
                      });
                  });
              }
          } else {
              editor.call('assets:create:' + key, args)
          }
      });
      menuItemNew.append(item);

      if (key === 'script') {
          editor.on('repositories:load', function (repositories) {
              if (repositories.get('current') !== 'directory')
                  item.disabled = true;
          });
      }
  };

  var keys = Object.keys(assets);
  for(var i = 0; i < keys.length; i++) {
      if (! assets.hasOwnProperty(keys[i]))
          continue;

      addNewMenuItem(keys[i], assets[keys[i]]);
  }


  // related
  var menuItemReferences = new ui.MenuItem({
      text: 'References',
      icon: ICONS.REFERENCES,
      value: 'references'
  });
  menu.append(menuItemReferences);

  // Create Atlas
  var menuItemTextureToAtlas = new ui.MenuItem({
      text: 'Create Texture Atlas',
      icon: ICONS.TEXTURE_ATLAS,
      value: 'texture-to-atlas'
  });
  menu.append(menuItemTextureToAtlas);

  menuItemTextureToAtlas.on('select', function () {
      editor.call('assets:textureToAtlas', currentAsset);
  });

  // Create Sprite From Atlas
  var menuItemCreateSprite = new ui.MenuItem({
      text: 'Create Sprite Asset',
      icon: ICONS.SPRITE_ASSET,
      value: 'atlas-to-sprite'
  });
  menu.append(menuItemCreateSprite);

  menuItemCreateSprite.on('select', function () {
      editor.call('assets:atlasToSprite', {
          asset: currentAsset
      });
  });

  // Create Sliced Sprite From Atlas
  var menuItemCreateSlicedSprite = new ui.MenuItem({
      text: 'Create Sliced Sprite Asset',
      icon: ICONS.SPRITE_ASSET,
      value: 'atlas-to-sliced-sprite'
  });
  menu.append(menuItemCreateSlicedSprite);

  menuItemCreateSlicedSprite.on('select', function () {
      editor.call('assets:atlasToSprite', {
          asset: currentAsset,
          sliced: true
      });
  });

  // replace
  var replaceAvailable = {
      'material': true,
      'texture': true,
      'textureatlas': true,
      'model': true,
      'animation': true,
      'audio': true,
      'cubemap': true,
      'css': true,
      'html': true,
      'shader': true,
      'sprite': true,
      'json': true,
      'text': true
  };
  var menuItemReplace = new ui.MenuItem({
      text: 'Replace',
      icon: ICONS.REPLACE,
      value: 'replace'
  });
  menuItemReplace.on('select', function() {
      var id = parseInt(currentAsset.get('id'), 10);

      editor.call('picker:asset', {
          type: currentAsset.get('type'),
          currentAsset: currentAsset
      });

      var evtPick = editor.once('picker:asset', function(asset) {
          editor.call('assets:replace', currentAsset, asset);
          evtPick = null;
      });

      editor.once('picker:asset:close', function() {
          if (evtPick) {
              evtPick.unbind();
              evtPick = null;
          }
      });
  });
  menu.append(menuItemReplace);

  var menuItemReplaceTextureToSprite = new ui.MenuItem({
      text: 'Convert Texture To Sprite',
      icon: ICONS.SPRITE_ASSET,
      value: 'replaceTextureToSprite'
  });
  menuItemReplaceTextureToSprite.on('select', function() {
      var id = parseInt(currentAsset.get('id'), 10);

      editor.call('picker:asset', {
          type: 'sprite',
          currentAsset: currentAsset
      });

      var evtPick = editor.once('picker:asset', function(asset) {
          editor.call('assets:replaceTextureToSprite', currentAsset, asset);
          evtPick = null;
      });

      editor.once('picker:asset:close', function() {
          if (evtPick) {
              evtPick.unbind();
              evtPick = null;
          }
      });
  });
  menu.append(menuItemReplaceTextureToSprite);

  // todo: xdu.
  // todo: merge these 2 items.

  // extract. Used for source assets.
  var menuItemExtract = new ui.MenuItem({
      text: 'Re-Import',
      icon: ICONS.REIMPORT,
      value: 'extract'
  });
  menuItemExtract.on('select', function() {
      editor.call('assets:reimport', currentAsset.get('id'), currentAsset.get('type'));
  });
  menu.append(menuItemExtract);


  // re-import. Used for target assets.
  var menuItemReImport = new ui.MenuItem({
      text: 'Re-Import',
      icon: ICONS.REIMPORT,
      value: 're-import'
  });
  menuItemReImport.on('select', function() {
      editor.call('assets:reimport', currentAsset.get('id'), currentAsset.get('type'));
  });
  menu.append(menuItemReImport);

  // download
  var menuItemDownload = new ui.MenuItem({
      text: 'Download',
      icon: ICONS.DOWNLOAD,
      value: 'download'
  });
  menuItemDownload.on('select', function() {
      window.open(currentAsset.get('file.url'));
  });
  menu.append(menuItemDownload);


  // edit
  var menuItemEdit = new ui.MenuItem({
      text: 'Edit',
      icon: ICONS.EDIT,
      value: 'edit'
  });
  menuItemEdit.on('select', function() {
      editor.call('assets:edit', currentAsset);
  });
  menu.append(menuItemEdit);


  // duplicate
  var menuItemDuplicate = new ui.MenuItem({
      text: 'Duplicate',
      icon: ICONS.DUPLICATE,
      value: 'duplicate'
  });
  menuItemDuplicate.on('select', function() {
      editor.call('assets:duplicate', currentAsset);
  });
  menu.append(menuItemDuplicate);


  // delete
  var menuItemDelete = new ui.MenuItem({
      text: 'Delete',
      icon: ICONS.DELETE,
      value: 'delete'
  });
  menuItemDelete.style.fontWeight = 200;
  menuItemDelete.on('select', function() {
      var asset = currentAsset;
      var multiple = false;

      if (asset) {
          var assetType = asset.get('type');
          var type = editor.call('selector:type');
          var items;

          if (type === 'asset') {
              items = editor.call('selector:items');
              for (var i = 0; i < items.length; i++) {
                  // if the asset that was right-clicked is in the selection
                  // then include all the other selected items in the delete
                  // otherwise only delete the right-clicked item
                  if (assetType === 'script' && legacyScripts) {
                      if (items[i].get('filename') === asset.get('filename')) {
                          multiple = true;
                          break;
                      }
                  } else if (items[i].get('id') === asset.get('id')) {
                      multiple = true;
                      break;
                  }
              }
          }

          editor.call('assets:delete:picker', multiple ? items : [asset]);
      }
  });
  menu.append(menuItemDelete);


  // filter buttons
  menu.on('open', function() {
      menuItemNewScript.hidden = ! ((currentAsset === null || (currentAsset && currentAsset.get('type') === 'script')) && editor.call('assets:panel:currentFolder') === 'scripts');
      menuItemNew.hidden = ! menuItemNewScript.hidden;

      if (currentAsset) {
          // download
          menuItemDownload.hidden = ! ((! config.project.privateAssets || (config.project.privateAssets && editor.call('permissions:read'))) && currentAsset.get('type') !== 'folder' && (currentAsset.get('source') || downloadable[currentAsset.get('type')] || (! legacyScripts && currentAsset.get('type') === 'script')) && currentAsset.get('file.url'));

          // duplicate
          if (currentAsset.get('type') === 'material' || currentAsset.get('type') === 'sprite') {
              menuItemEdit.hidden = true;
              if (editor.call('selector:type') === 'asset') {
                  var items = editor.call('selector:items');
                  menuItemDuplicate.hidden = (items.length > 1 && items.indexOf(currentAsset) !== -1);
              } else {
                  menuItemDuplicate.hidden = false;
              }
          } else {
              menuItemDuplicate.hidden = true;
          }

          // edit
          if (! currentAsset.get('source') && ['html', 'css', 'json', 'text', 'script', 'shader'].indexOf(currentAsset.get('type')) !== -1) {
              if (editor.call('selector:type') === 'asset') {
                  var items = editor.call('selector:items');
                  menuItemEdit.hidden = (items.length > 1 && items.indexOf(currentAsset) !== -1);
              } else {
                  menuItemEdit.hidden = false;
              }
          } else {
              menuItemEdit.hidden = true;
          }

          // create atlas
          menuItemTextureToAtlas.hidden = (currentAsset.get('type') !== 'texture' || currentAsset.get('source') || currentAsset.get('task') || ! editor.call('permissions:write'));

          // create sprite
          menuItemCreateSprite.hidden = (currentAsset.get('type') !== 'textureatlas' || currentAsset.get('source') || currentAsset.get('task') || ! editor.call('permissions:write'));
          menuItemCreateSlicedSprite.hidden = menuItemCreateSprite.hidden;

          // delete
          menuItemDelete.hidden = false;

          if (! currentAsset.get('source')) {
              menuItemExtract.hidden = true;

              // re-import
              var sourceId = currentAsset.get('source_asset_id');
              if (sourceId) {
                  var source = editor.call('assets:get', sourceId)
                  if (source) {
                      if (source.get('type') === 'scene' && ([ 'texture', 'material' ].indexOf(currentAsset.get('type')) !== -1 || ! source.get('meta'))) {
                          menuItemReImport.hidden = true;
                      } else if (currentAsset.get('type') === 'animation' && ! source.get('meta.animation.available')) {
                          menuItemReImport.hidden = true;
                      } else if (currentAsset.get('type') === 'material' && ! currentAsset.has('meta.index')) {
                          menuItemReImport.hidden = true;
                      } else {
                          menuItemReImport.hidden = false;
                      }
                  } else {
                      menuItemReImport.hidden = true;
                  }
              } else {
                  menuItemReImport.hidden = true;
              }

              // references
              var ref = editor.call('assets:used:index')[currentAsset.get('id')];
              if (ref && ref.count && ref.ref) {
                  menuItemReferences.hidden = false;
                  menuItemReplace.hidden = replaceAvailable[currentAsset.get('type')] ? false : true;
                  menuItemReplaceTextureToSprite.hidden = !editor.call('users:hasFlag', 'hasTextureToSprite') || (currentAsset.get('type') !== 'texture');

                  while(menuItemReferences.innerElement.firstChild)
                      menuItemReferences.innerElement.firstChild.ui.destroy();

                  var menuItems = [ ];

                  var addReferenceItem = function(type, id) {
                      var menuItem = new ui.MenuItem();
                      var item = null;

                      if (type === 'editorSettings') {
                          menuItem.text = 'Scene Settings';
                          menuItem.icon = ICONS.SCENE_SETTINGS;
                          item = editor.call('settings:projectUser');
                          if (! item) return;
                      } else {
                          if (type === 'entity') {
                              item = editor.call('entities:get', id);
                              menuItem.icon = '&#57734;';
                          } else if (type === 'asset') {
                              item = editor.call('assets:get', id);
                              menuItem.icon = icons[item.get('type')] || '';
                          }
                          if (! item) return;
                          menuItem.text = item.get('name');
                      }

                      menuItems.push({
                          name: menuItem.text,
                          type: type,
                          element: menuItem
                      });

                      menuItem.on('select', function() {
                          editor.call('selector:set', type, [ item ]);

                          var folder = null;
                          var path = item.get('path') || [ ];
                          if (path.length)
                              folder = editor.call('assets:get', path[path.length - 1]);

                          editor.call('assets:panel:currentFolder', folder);

                          // unfold rendering tab
                          if (type === 'editorSettings') {
                              setTimeout(function() {
                                  editor.call('editorSettings:panel:unfold', 'rendering');
                              }, 0);
                          }
                      });
                  };

                  for(var key in ref.ref)
                      addReferenceItem(ref.ref[key].type, key);

                  var typeSort = {
                      'editorSettings': 1,
                      'asset': 2,
                      'entity': 3
                  };

                  menuItems.sort(function(a, b) {
                      if (a.type !== b.type) {
                          return typeSort[a.type] - typeSort[b.type];
                      } else {
                          if (a.name > b.name) {
                              return 1;
                          } else if (a.name < b.name) {
                              return -1;
                          } else {
                              return 0;
                          }
                      }
                  });

                  for(var i = 0; i < menuItems.length; i++)
                      menuItemReferences.append(menuItems[i].element);
              } else {
                  menuItemReferences.hidden = true;
                  menuItemReplace.hidden = true;
                  menuItemReplaceTextureToSprite.hidden = true;
              }
          } else {
              menuItemReferences.hidden = true;
              menuItemReplace.hidden = true;
              menuItemReplaceTextureToSprite.hidden = true;
              menuItemReImport.hidden = true;
              menuItemExtract.hidden = [ 'scene', 'texture', 'textureatlas' ].indexOf(currentAsset.get('type')) === -1 || ! currentAsset.get('meta');
          }
      } else {
          // no asset
          menuItemExtract.hidden = true;
          menuItemReImport.hidden = true;
          menuItemDownload.hidden = true;
          menuItemDuplicate.hidden = true;
          menuItemEdit.hidden = true;
          menuItemDelete.hidden = true;
          menuItemReferences.hidden = true;
          menuItemReplace.hidden = true;
          menuItemReplaceTextureToSprite.hidden = true;
          menuItemTextureToAtlas.hidden = true;
          menuItemCreateSprite.hidden = true;
          menuItemCreateSlicedSprite.hidden = true;
      }

      for(var i = 0; i < customMenuItems.length; i++) {
          if (! customMenuItems[i].filter)
              continue;

          customMenuItems[i].hidden = ! customMenuItems[i].filter(currentAsset);
      }
  });


  // for each asset added
  editor.on('assets:add', function(asset) {
      // get grid item
      var item = editor.call('assets:panel:get', asset.get('id'));
      if (! item) return;

      var contextMenuHandler = function(evt) {
          evt.stopPropagation();
          evt.preventDefault();

          if (! editor.call('permissions:write'))
              return;

          currentAsset = asset;
          menu.open = true;
          menu.position(evt.clientX + 1, evt.clientY);
      };

      // grid
      item.element.addEventListener('contextmenu', contextMenuHandler, false);

      // tree
      if (item.tree)
          item.tree.elementTitle.addEventListener('contextmenu', contextMenuHandler, false);
  });

  editor.on('sourcefiles:add', function(asset) {
      // get grid item
      var item = editor.call('assets:panel:get', asset.get('filename'));
      if (! item) return;

      // attach contextmenu event
      item.element.addEventListener('contextmenu', function(evt) {
          evt.stopPropagation();
          evt.preventDefault();

          if (! editor.call('permissions:write'))
              return;

          currentAsset = asset;
          menu.open = true;
          menu.position(evt.clientX + 1, evt.clientY);
      });
  });


  // folders
  editor.call('assets:panel:folders').innerElement.addEventListener('contextmenu', function(evt) {
      evt.preventDefault();
      evt.stopPropagation();

      if (! editor.call('permissions:write'))
          return;

      currentAsset = undefined;
      menu.open = true;
      menu.position(evt.clientX + 1, evt.clientY);
  }, false);

  // files
  editor.call('assets:panel:files').innerElement.addEventListener('contextmenu', function(evt) {
      evt.preventDefault();
      evt.stopPropagation();

      if (! editor.call('permissions:write'))
          return;

      currentAsset = null;
      menu.open = true;
      menu.position(evt.clientX + 1, evt.clientY);
  }, false);

  editor.method('assets:contextmenu:add', function(data) {
      var item = new ui.MenuItem({
          text: data.text,
          icon: data.icon,
          value: data.value
      });

      item.on('select', function() {
          data.select.call(item, currentAsset);
      });

      var parent = data.parent || menu;
      parent.append(item);

      if (data.filter)
          item.filter = data.filter;

      customMenuItems.push(item);

      return item;
  });
});


/* editor/assets/assets-filter.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var assetsPanel = editor.call('layout.assets');
  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');
  var currentFolder = null;
  var currentPath = [ ];

  var searchLastValue = '';
  var searchTags = null;

  // filters
  var panelFilters = new ui.Panel();
  panelFilters.class.add('filters');
  assetsPanel.header.append(panelFilters);

  var tagsCheck = function(asset, tags) {
      var data = asset.get('tags');

      if (! data.length)
          return false;

      tags = pc.Tags.prototype._processArguments(tags);

      if (! data.length || ! tags.length)
          return false;

      for(var i = 0; i < tags.length; i++) {
          if (tags[i].length === 1) {
              // single occurance
              if (data.indexOf(tags[i][0]) !== -1)
                  return true;
          } else {
              // combined occurance
              var multiple = true;

              for(var t = 0; t < tags[i].length; t++) {
                  if (data.indexOf(tags[i][t]) !== -1)
                      continue;

                  multiple = false;
                  break;
              }

              if (multiple)
                  return true;
          }
      }

      return false;
  };

  var filter = function(type, item) {
      if (! item)
          return false;

      var visible = true;

      // type
      if (visible && filterField.value !== 'all') {
          if (type === 'asset') {
              var assetType = item.get('type');

              if (assetType === 'texture') {
                  if (item.get('source')) {
                      assetType = 'textureSource';
                  } else {
                      assetType = 'textureTarget';
                  }
              } else if (assetType === 'textureatlas') {
                  if (item.get('source')) {
                      assetType = 'textureAtlasSource';
                  } else {
                      assetType = 'textureAtlasTarget';
                  }
              } else if (assetType === 'font') {
                  if (item.get('source')) {
                      assetType = 'fontSource';
                  } else {
                      assetType = 'fontTarget';
                  }
              }

              visible = assetType === filterField.value;
          } else if (type === 'script') {
              visible = filterField.value === 'script';
          }
      }

      // query
      if (visible && search.value) {
          var name = (type === 'scripts') ? item : item.get(type === 'asset' ? 'name' : 'filename');
          var normalSearch = true;

          if (searchTags !== false && ((searchTags instanceof Array) || (search.value[0] === '[' && search.value.length > 2 && /^\[.+\]$/.test(search.value)))) {
              if (searchTags === null) {
                  try {
                      var raw = search.value.slice(1, -1);
                      var bits = raw.split(',');
                      var tags = [ ];
                      var merge = '';

                      for(var i = 0; i < bits.length; i++) {
                          var tag = bits[i].trim();
                          if (! tag) continue;

                          if ((tag[0] === '[' && tag[tag.length - 1] !== ']') || (merge && tag[tag.length - 1] !== ']')) {
                              merge += tag + ',';
                              continue;
                          }

                          if (merge && tag[tag.length - 1] === ']') {
                              tag = merge + tag;
                              merge = '';
                          }

                          if (tag[0] === '[' && tag.length > 2 && tag[tag.length - 1] === ']') {
                              var subRaw = tag.slice(1, -1);
                              var subBits = subRaw.split(',');
                              if (subBits.length === 1) {
                                  var subTag = subBits[0].trim();
                                  if (! subTag) continue;
                                  tags.push(subTag);
                              } else {
                                  var subTags = [ ];
                                  for(var s = 0; s < subBits.length; s++) {
                                      var subTag = subBits[s].trim();
                                      if (! subTag) continue;
                                      subTags.push(subTag);
                                  }

                                  if (subTags.length === 0) {
                                      continue;
                                  } else if (subTags.length === 1) {
                                      tags.push(subTags[0]);
                                  } else {
                                      tags.push(subTags);
                                  }
                              }
                          } else {
                              tags.push(tag);
                          }
                      }

                      searchTags = tags;
                      normalSearch = false;
                  } catch(ex) {
                      searchTags = false;
                  }
              } else {
                  normalSearch = false;
              }

              if (searchTags) {
                  if (type === 'scripts' || (type === 'script' && legacyScripts)) {
                      visible = false;
                  } else {
                      visible = tagsCheck(item, searchTags);
                  }
              } else {
                  normalSearch = true;
              }
          } else if (search.value[0] === '*' && search.value.length > 1) {
              try {
                  visible = (new RegExp(search.value.slice(1), 'i')).test(name);
                  normalSearch = false;
              } catch(ex) { }
          }

          if (normalSearch) {
              visible = name.toLowerCase().indexOf(search.value.toLowerCase()) !== -1;

              if (! visible && type === 'asset') {
                  var id = parseInt(search.value, 10);
                  if (id && id.toString() === search.value)
                      visible = parseInt(item.get('id'), 10) === id;
              }
          }
      }

      // folder
      if (visible && ! search.value) {
          if (type === 'script' || currentFolder === 'scripts') {
              visible = currentFolder === 'scripts' && type === 'script';
          } else if (type === 'scripts') {
              visible = ! currentFolder && filterField.value === 'all';
          } else {
              var path = item.get('path');
              if (currentFolder === null) {
                  visible = path.length === 0;
              } else {
                  visible = (path.length === currentPath.length + 1) && path[path.length - 1] === currentFolder;
              }
          }
      }

      return visible;
  };
  editor.method('assets:panel:filter:default', function() {
      return filter;
  });


  // options
  var filterOptions;

  if (editor.call('users:hasFlag', 'hasBundles')) {
      filterOptions = {
          options: {
              all: 'All',
              animation: 'Animation',
              audio: 'Audio',
              bundle: 'Asset Bundle',
              binary: 'Binary',
              cubemap: 'Cubemap',
              css: 'Css',
              fontTarget: 'Font',
              fontSource: 'Font (source)',
              json: 'Json',
              html: 'Html',
              material: 'Material',
              model: 'Model',
              scene: 'Model (source)',
              script: 'Script',
              shader: 'Shader',
              sprite: 'Sprite',
              text: 'Text',
              textureTarget: 'Texture',
              textureSource: 'Texture (source)',
              textureAtlasTarget: 'Texture Atlas',
              textureAtlasSource: 'Texture Atlas (source)'
          }
      };
  } else {
      filterOptions = {
          options: {
              all: 'All',
              animation: 'Animation',
              audio: 'Audio',
              binary: 'Binary',
              cubemap: 'Cubemap',
              css: 'Css',
              fontTarget: 'Font',
              fontSource: 'Font (source)',
              json: 'Json',
              html: 'Html',
              material: 'Material',
              model: 'Model',
              scene: 'Model (source)',
              script: 'Script',
              shader: 'Shader',
              sprite: 'Sprite',
              text: 'Text',
              textureTarget: 'Texture',
              textureSource: 'Texture (source)',
              textureAtlasTarget: 'Texture Atlas',
              textureAtlasSource: 'Texture Atlas (source)'
          }
      };
  }

  var filterField = new ui.SelectField(filterOptions);

  filterField.class.add('options');
  filterField.value = 'all';
  filterField.renderChanges = false;
  panelFilters.append(filterField);

  filterField.on('change', function(value) {
      if (value !== 'all') {
          filterField.class.add('not-empty');
      } else {
          filterField.class.remove('not-empty');
      }
      editor.call('assets:panel:filter', filter);
  });

  var tooltipFilter = Tooltip.attach({
      target: filterField.element,
      text: 'Filter Assets',
      align: 'bottom',
      root: root
  });
  filterField.on('open', function() {
      tooltipFilter.disabled = true;
  });
  filterField.on('close', function() {
      tooltipFilter.disabled = false;
  });

  editor.method('assets:filter:search', function(query) {
      if (query === undefined)
          return search.value;

      search.value = query;
  });

  editor.method('assets:filter:type', function(type) {
      if (type === undefined)
          return filterField.value;

      filterField.value = type || 'all';
  });

  editor.method('assets:filter:type:disabled', function(state) {
      filterField.disabled = state;
  });

  editor.on('assets:panel:currentFolder', function(asset) {
      if (asset) {
          if (typeof(asset) === 'string') {
              if (legacyScripts) {
                  currentFolder = 'scripts';
              } else {
                  currentFolder = null;
              }
              currentPath = null;
          } else {
              currentFolder = parseInt(asset.get('id'));
              currentPath = asset.get('path');
          }
      } else {
          currentFolder = null;
          currentPath = null;
      }


      editor.call('assets:panel:filter', filter, true);
  });

  editor.on('assets:add', function(asset) {
      if (filterField.value === 'all' && ! search.value)
          return;

      if (! filter((asset.get('type') === 'script') ? 'script' : 'asset', asset))
          editor.call('assets:panel:get', asset.get('id')).hidden = true;
      else
          editor.call('assets:panel:message', null); // clear possible no assets message
  });

  editor.on('sourcefiles:add', function (file) {
      if (filterField.value === 'all' && ! search.value)
          return;

      if (! filter('script', file))
          editor.call('assets:panel:get', file.get('filename')).hidden = true;
      else
          editor.call('assets:panel:message', null); // clear possible no assets message

  });

  // search
  var search = new ui.TextField({
      placeholder: 'Search'
  });
  search.blurOnEnter = false;
  search.keyChange = true;
  search.class.add('search');
  search.renderChanges = false;
  panelFilters.append(search);

  search.element.addEventListener('keydown', function(evt) {
      if (evt.keyCode === 27)
          searchClear.click();
  }, false);

  // hotkeys
  editor.call('hotkey:register', 'assets-focus-search', {
      key: 'a',
      alt: true,
      callback: function (e) {
          if (editor.call('picker:isOpen:otherThan', 'curve')) return;
          search.focus();
      }
  });

  var searchClear = document.createElement('div');
  searchClear.innerHTML = '&#57650;';
  searchClear.classList.add('clear');
  search.element.appendChild(searchClear);

  searchClear.addEventListener('click', function() {
      search.value = '';
  }, false);

  search.on('change', function(value) {
      value = value.trim();

      if (searchLastValue === value)
          return;

      searchLastValue = value;

      if (value) {
          search.class.add('not-empty');
      } else {
          search.class.remove('not-empty');
      }

      searchTags = null;

      editor.call('assets:panel:filter', filter);
  });

  // var tooltipSearch = Tooltip.attach({
  //     target: search.element,
  //     align: 'bottom',
  //     root: root,
  //     hoverable: true,
  //     text: 'Search Assets',
  //     html: '<h1>Assets Search</h1><p>You can perform a global search for assets in your project using this Search box. Simply start typing into the box and the Editor will show matching results dynamically in the panel below.</p><p><strong>ID</strong> - A specific asset can be found by its unique ID, by simply typing the ID in the search field, it will recognize the exact match and only show one asset with that ID.</p><p><strong>RegExp</strong> - It is possible to search using regular expressions. Add <code>*</code> at the beginning of the search field and type a regexp query after. To search for all assets use the <code>*.</code> (any character) regexp query.</p><p><strong>Tags</strong> - To search by tags and their combinations type tags in square brackets <code>[ ]</code>. Simple query operators: AND, OR are allowed by expressing a query as an array of strings or other arrays with strings. The logic of the query is the same as for <a href="https://developer.playcanvas.com/en/api/pc.AssetRegistry.html#findByTag" target="_blank">findByTag</a> from <b>pc.AssetRegistry</b>.</p><p>Here are some examples:</p><p><code>[ level-1 ]</code> - returns all assets that are tagged by <code>level-1</code>.<br /><code>[ level-1, level-2 ]</code> - returns all assets that are tagged by <code>level-1 OR level-2</code>.<br /><code>[ [ level-1, monster ] ]</code> - returns all assets that are tagged by <code>level-1 AND monster</code>. Notice extra brackets.<br /><code>[ [ level-1, monster ], [ level-2, monster ] ]</code> - returns all assets that are tagged by <code>(level-1 AND monster) OR (level-2 AND monster)</code>.</p>'
  // });
  // tooltipSearch.class.add('assets-search-field');
});


/* editor/assets/assets-upload.js */
editor.once('load', function () {
  'use strict';

  var uploadJobs = 0;
  var userSettings = editor.call('settings:projectUser');
  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');

  var targetExtensions = {
      'jpg': true,
      'jpeg': true,
      'png': true,
      'gif': true,
      'css': true,
      'html': true,
      'json': true,
      'xml': true,
      'txt': true,
      'vert': true,
      'frag': true,
      'glsl': true,
      'mp3': true,
      'ogg': true,
      'wav': true,
      'mp4': true,
      'm4a': true,
      'js': true,
      'atlas': true
  };

  var typeToExt = {
      'scene': ['fbx', 'dae', 'obj', '3ds'],
      'text': ['txt', 'xml', 'atlas'],
      'html': ['html'],
      'css': ['css'],
      'json': ['json'],
      'texture': ['tif', 'tga', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'dds', 'hdr', 'exr'],
      'audio': ['wav', 'mp3', 'mp4', 'ogg', 'm4a'],
      'shader': ['glsl', 'frag', 'vert'],
      'script': ['js'],
      'font': ['ttf', 'ttc', 'otf', 'dfont']
  };

  var extToType = {};
  for (var type in typeToExt) {
      for (var i = 0; i < typeToExt[type].length; i++) {
          extToType[typeToExt[type][i]] = type;
      }
  }


  editor.method('assets:canUploadFiles', function (files) {
      // check usage first
      var totalSize = 0;
      for (var i = 0; i < files.length; i++) {
          totalSize += files[i].size;
      }

      return config.owner.size + totalSize <= config.owner.diskAllowance;
  });

  editor.method('assets:upload:script', function (file) {
      var reader = new FileReader();

      reader.addEventListener('load', function () {
          editor.call('sourcefiles:create', file.name, reader.result, function (err) {
              if (err)
                  return;

              editor.call('assets:panel:currentFolder', 'scripts');
          });
      }, false);

      reader.readAsText(file);
  });

  var appendCommon = function (form, args) {
      // NOTE
      // non-file form data should be above file,
      // to make it parsed on back-end first

      form.append('branchId', config.self.branch.id);

      // parent folder
      if (args.parent) {
          if (args.parent instanceof Observer) {
              form.append('parent', args.parent.get('id'));
          } else {
              var id = parseInt(args.parent, 10);
              if (!isNaN(id))
                  form.append('parent', id + '');
          }
      }

      // conversion pipeline specific parameters
      var settings = editor.call('settings:projectUser');
      switch (args.type) {
          case 'texture':
          case 'textureatlas':
              form.append('pow2', settings.get('editor.pipeline.texturePot'));
              form.append('searchRelatedAssets', settings.get('editor.pipeline.searchRelatedAssets'));
              break;
          case 'scene':
              form.append('searchRelatedAssets', settings.get('editor.pipeline.searchRelatedAssets'));
              form.append('overwriteModel', settings.get('editor.pipeline.overwriteModel'));
              form.append('overwriteAnimation', settings.get('editor.pipeline.overwriteAnimation'));
              form.append('overwriteMaterial', settings.get('editor.pipeline.overwriteMaterial'));
              form.append('overwriteTexture', settings.get('editor.pipeline.overwriteTexture'));
              form.append('pow2', settings.get('editor.pipeline.texturePot'));
              form.append('preserveMapping', settings.get('editor.pipeline.preserveMapping'));
              break;
          case 'font':
              break;
          default:
              break;
      }

      // filename
      if (args.filename) {
          form.append('filename', args.filename);
      }

      // file
      if (args.file && args.file.size) {
          form.append('file', args.file, (args.filename || args.name));
      }

      return form;
  };

  var create = function (args) {
      var form = new FormData();

      // scope
      form.append('projectId', config.project.id);

      // type
      if (!args.type) {
          console.error('\"type\" required for upload request');
      }
      form.append('type', args.type);

      // name
      if (args.name) {
          form.append('name', args.name);
      }

      // tags
      if (args.tags) {
          form.append('tags', args.tags.join('\n'));
      }

      // source_asset_id
      if (args.source_asset_id) {
          form.append('source_asset_id', args.source_asset_id);
      }

      // data
      if (args.data) {
          form.append('data', JSON.stringify(args.data));
      }

      // meta
      if (args.meta) {
          form.append('meta', JSON.stringify(args.meta));
      }

      // preload
      form.append('preload', args.preload === undefined ? true : args.preload);

      form = appendCommon(form, args);
      return form;
  };

  var update = function (assetId, args) {
      var form = new FormData();
      form = appendCommon(form, args);
      return form;
  };

  editor.method('assets:uploadFile', function (args, fn) {
      var method = 'POST';
      var url = '/api/assets';
      var form = null;
      if (args.asset) {
          var assetId = args.asset.get('id');
          method = 'PUT';
          url = '/api/assets/' + assetId;
          form = update(assetId, args);
      } else {
          form = create(args);
      }

      var job = ++uploadJobs;
      editor.call('status:job', 'asset-upload:' + job, 0);

      var data = {
          url: url,
          method: method,
          auth: true,
          data: form,
          ignoreContentType: true,
          headers: {
              Accept: 'application/json'
          }
      };

      Ajax(data)
      .on('load', function (status, data) {
          editor.call('status:job', 'asset-upload:' + job);
          if (fn) {
              fn(null, data);
          }
      })
      .on('progress', function (progress) {
          editor.call('status:job', 'asset-upload:' + job, progress);
      })
      .on('error', function (status, data) {
          if (/Disk allowance/.test(data)) {
              data += '. <a href="/upgrade" target="_blank">UPGRADE</a> to get more disk space.';
          }

          editor.call('status:error', data);
          editor.call('status:job', 'asset-upload:' + job);
          if (fn) {
              fn(data);
          }
      });
  });

  editor.method('assets:upload:files', function (files) {
      if (!editor.call('assets:canUploadFiles', files)) {
          var msg = 'Disk allowance exceeded. <a href="/upgrade" target="_blank">UPGRADE</a> to get more disk space.';
          editor.call('status:error', msg);
          return;
      }


      var currentFolder = editor.call('assets:panel:currentFolder');

      for (var i = 0; i < files.length; i++) {
          var path = [];

          if (currentFolder && currentFolder.get)
              path = currentFolder.get('path').concat(parseInt(currentFolder.get('id'), 10));

          var source = false;
          var ext = files[i].name.split('.');
          if (ext.length === 1)
              continue;

          ext = ext[ext.length - 1].toLowerCase();


          // Temp: disable uploading WASM files
          if (ext === 'wasm' && !editor.call('users:hasFlag', 'hasWasm')) {
              var msg = 'Uploading WASM files not supported';
              editor.call('status:error', msg);
              return;
          }

          if (legacyScripts && ext === 'js') {
              editor.call('assets:upload:script', files[i]);
          } else {
              var type = extToType[ext] || 'binary';

              var source = type !== 'binary' && !targetExtensions[ext];

              // check if we need to convert textures to texture atlases
              if (type === 'texture' && userSettings.get('editor.pipeline.textureDefaultToAtlas')) {
                  type = 'textureatlas';
              }

              // can we overwrite another asset?
              var sourceAsset = null;
              var candidates = editor.call('assets:find', function (item) {
                  // check files in current folder only
                  if (!item.get('path').equals(path))
                      return false;

                  // try locate source when dropping on its targets
                  if (source && !item.get('source') && item.get('source_asset_id')) {
                      var itemSource = editor.call('assets:get', item.get('source_asset_id'));
                      if (itemSource && itemSource.get('type') === type && itemSource.get('name').toLowerCase() === files[i].name.toLowerCase()) {
                          sourceAsset = itemSource;
                          return false;
                      }
                  }


                  if (item.get('source') === source && item.get('name').toLowerCase() === files[i].name.toLowerCase()) {
                      // we want the same type or try to replace a texture atlas with the same name if one exists
                      if (item.get('type') === type || (type === 'texture' && item.get('type') === 'textureatlas')) {
                          return true;
                      }
                  }

                  return false;
              });

              // candidates contains [index, asset] entries. Each entry
              // represents an asset that could be overwritten by the uploaded asset.
              // Use the first candidate by default (or undefined if the array is empty).
              // If we are uploading a texture try to find a textureatlas candidate and
              // if one exists then overwrite the textureatlas instead.
              var asset = candidates[0];
              if (type === 'texture') {
                  for (var j = 0; j < candidates.length; j++) {
                      if (candidates[j][1].get('type') === 'textureatlas') {
                          asset = candidates[j];
                          type = 'textureatlas';
                          break;
                      }
                  }
              }

              var data = null;
              if (ext === 'js') {
                  data = {
                      order: 100,
                      scripts: {}
                  };
              }

              editor.call('assets:uploadFile', {
                  asset: asset ? asset[1] : sourceAsset,
                  file: files[i],
                  type: type,
                  name: files[i].name,
                  parent: editor.call('assets:panel:currentFolder'),
                  pipeline: true,
                  data: data,
                  meta: asset ? asset[1].get('meta') : null
              }, function (err, data) {
                  if (err || ext !== 'js') return;

                  var onceAssetLoad = function (asset) {
                      var url = asset.get('file.url');
                      if (url) {
                          editor.call('scripts:parse', asset);
                      } else {
                          asset.once('file.url:set', function () {
                              editor.call('scripts:parse', asset);
                          });
                      }
                  };

                  var asset = editor.call('assets:get', data.id);
                  if (asset) {
                      onceAssetLoad(asset);
                  } else {
                      editor.once('assets:add[' + data.id + ']', onceAssetLoad);
                  }
              });
          }
      }
  });

  editor.method('assets:upload:picker', function (args) {
      args = args || {};

      var parent = args.parent || editor.call('assets:panel:currentFolder');

      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      // fileInput.accept = '';
      fileInput.multiple = true;
      fileInput.style.display = 'none';
      editor.call('layout.assets').append(fileInput);

      var onChange = function () {
          editor.call('assets:upload:files', this.files);

          this.value = null;
          fileInput.removeEventListener('change', onChange);
      };

      fileInput.addEventListener('change', onChange, false);
      fileInput.click();

      fileInput.parentNode.removeChild(fileInput);
  });
});


/* editor/assets/assets-reimport.js */
editor.once('load', function () {
  'use strict';

  var index = 0;
  editor.method('assets:reimport', function (assetId, type, callback) {
      var data = {};

      // conversion pipeline specific parameters
      var settings = editor.call('settings:projectUser');
      if (type === 'texture' || type === 'textureatlas' || type === 'scene') {
          data.pow2 = settings.get('editor.pipeline.texturePot');
          data.searchRelatedAssets = settings.get('editor.pipeline.searchRelatedAssets');

          if (type === 'scene') {
              data.overwriteModel = settings.get('editor.pipeline.overwriteModel');
              data.overwriteAnimation = settings.get('editor.pipeline.overwriteAnimation');
              data.overwriteMaterial = settings.get('editor.pipeline.overwriteMaterial');
              data.overwriteTexture = settings.get('editor.pipeline.overwriteTexture');
              data.preserveMappping = settings.get('editor.pipeline.preserveMapping');
          }
      }

      var jobId = ++index;
      var jobName = 'asset-reimport:' + jobId;
      editor.call('status:job', jobName, 0);

      Ajax({
          url: '/api/assets/' + assetId + '/reimport?branchId=' + config.self.branch.id,
          method: 'POST',
          auth: true,
          data: data
      })
      .on('load', function (status, res) {
          editor.call('status:job', jobName);
          if (callback) {
              callback(null, res);
          }
      })
      .on('progress', function (progress) {
          editor.call('status:job', jobName, progress);
      })
      .on('error', function (status, res) {
          editor.call('status:error', res);
          editor.call('status:job', jobName);
          if (callback) {
              callback(res);
          }
      });
  });
});


/* editor/assets/assets-drop.js */
editor.once('load', function() {
  'use strict';

  var assetsPanel = editor.call('layout.assets');

  var dropRef = editor.call('drop:target', {
      ref: assetsPanel.dom,
      type: 'files',
      drop: function(type, data) {
          if (type !== 'files')
              return;

          editor.call('assets:upload:files', data);
      }
  });

  dropRef.element.classList.add('assets-drop-area');
});


/* editor/assets/assets-messenger.js */
editor.once('load', function () {
  'use strict';

  var create = function (data) {
      if (data.asset.branchId !== config.self.branch.id) return;

      var uniqueId = parseInt(data.asset.id, 10);

      if (data.asset.source === false && data.asset.status && data.asset.status !== 'complete') {
          return;
      }

      // todo: data.asset.source_asset_id

      // todo: possibly convert this to a new event `assets:update`
      var asset = editor.call('assets:getUnique', uniqueId);
      if (asset) {
          return;
      }

      editor.call('loadAsset', uniqueId);
  };

  // create new asset
  editor.on('messenger:asset.new', create);

  // remove
  editor.on('messenger:asset.delete', function(data) {
      var asset = editor.call('assets:getUnique', data.asset.id);
      if (! asset) return;
      editor.call('assets:remove', asset);
  });

  // remove multiple
  editor.on('messenger:assets.delete', function(data) {
      for (var i = 0; i < data.assets.length; i++) {
          var asset = editor.call('assets:getUnique', parseInt(data.assets[i], 10));
          if (! asset) continue;
          editor.call('assets:remove', asset);
      }
  });
});


/* editor/assets/assets-delete.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:delete:picker', function(items) {
      if (! editor.call('permissions:write'))
          return;

      var msg = 'Delete Asset?';

      if (items.length === 1 && items[0].get('type') === 'folder')
          msg = 'Delete Folder?';

      if (items.length > 1)
          msg = 'Delete ' + items.length + ' Assets?';

      editor.call('picker:confirm', msg, function() {
          if (! editor.call('permissions:write'))
              return;

          editor.call('assets:delete', items);
      }, {
          yesText: 'Delete',
          noText: 'Cancel'
      });
  });

  var deleteCallback = function() {
      if (! editor.call('permissions:write'))
          return;

      var type = editor.call('selector:type');
      if (type !== 'asset')
          return;

      editor.call('assets:delete:picker', editor.call('selector:items'));
  };
  // delete
  editor.call('hotkey:register', 'asset:delete', {
      key: 'delete',
      callback: deleteCallback
  });
  // ctrl + backspace
  editor.call('hotkey:register', 'asset:delete', {
      ctrl: true,
      key: 'backspace',
      callback: deleteCallback
  });
});


/* editor/assets/assets-duplicate.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:duplicate', function(asset) {
      if (asset.get('type') !== 'material' && asset.get('type') !== 'sprite') return;

      var path = asset.get('path');
      var parent = path.length ? path[path.length - 1] : null;

      var raw = {
          // only materials can be duplicated at the moment
          type: asset.get('type'),
          name: asset.get('name') + ' Copy',
          tags: asset.get('tags'),
          source: false,
          data: asset.get('data'),
          preload: asset.get('preload'),
          parent: parent ? editor.call('assets:get', parent) : null,
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', raw);
  });
});


/* editor/assets/assets-edit.js */
editor.once('load', function() {
  'use strict';

  var types = {
      'css': 1,
      'html': 1,
      'json': 1,
      'script': 1,
      'shader': 1,
      'text': 1
  };

  editor.method('assets:edit', function (asset) {
      if (asset.get('type') === 'script' && editor.call('settings:project').get('useLegacyScripts')) {
          window.open('/editor/code/' + config.project.id + '/' + asset.get('filename'));
      } else {
          if (!editor.call('settings:project').get('useLegacyScripts')) {
              editor.call('picker:codeeditor', asset);
          } else {
              window.open('/editor/asset/' + asset.get('id'), asset.get('id')).focus();
          }
      }
  });

  var dblClick = function(key, asset) {
      var gridItem = editor.call('assets:panel:get', asset.get(key));
      if (! gridItem)
          return;

      gridItem.element.addEventListener('dblclick', function(evt) {
          editor.call('assets:edit', asset);
      }, false);
  };

  editor.on('assets:add', function(asset) {
      if (! types[asset.get('type')])
          return;

      dblClick('id', asset);
  });

  editor.on('sourcefiles:add', function(file) {
      dblClick('filename', file);
  });
});


/* editor/assets/assets-replace.js */
editor.once('load', function () {
  'use strict';

  var slots = ['aoMap', 'diffuseMap', 'emissiveMap', 'glossMap', 'lightMap', 'metalnessMap', 'opacityMap', 'specularMap', 'normalMap', 'sphereMap'];

  /**
   * Replaces the specified asset with the replacement asset everywhere
   * @param {Observer} asset The original asset
   * @param {Observer} replacement The replacement asset
   */
  var AssetReplace = function (asset, replacement) {
      this.asset = asset;
      this.replacement = replacement;

      this.oldId = parseInt(asset.get('id'), 10);
      this.newId = parseInt(replacement.get('id'), 10);

      this.entities = editor.call('entities:list');
      this.assets = editor.call('assets:list');

      this.records = [];
  };

  /**
   * Set the replacement asset for the specified object at the specified path
   * @param {Observer} obj The object
   * @param {String} path The path that we are replacing
   */
  AssetReplace.prototype.set = function (obj, path) {
      var history = obj.history.enabled;
      obj.history.enabled = false;
      obj.set(path, this.newId);
      obj.history.enabled = history;

      if (history) {
          this.records.push({
              get: obj.history._getItemFn,
              path: path
          });
      }
  };

  AssetReplace.prototype.handleAnimation = function () {
      // entity
      for (var i = 0; i < this.entities.length; i++) {
          var obj = this.entities[i];

          // animation
          var animation = obj.get('components.animation');
          if (animation && animation.assets) {
              for (var ind = 0; ind < animation.assets.length; ind++) {
                  if (animation.assets[ind] !== this.oldId)
                      continue;

                  // components.animation.assets.?
                  this.set(obj, 'components.animation.assets.' + ind);
              }
          }
      }
  };

  AssetReplace.prototype.handleAudio = function () {
      // entity
      for (var i = 0; i < this.entities.length; i++) {
          var obj = this.entities[i];

          // sound
          var sound = obj.get('components.sound');
          if (sound) {
              for (var ind in sound.slots) {
                  if (!sound.slots[ind] || sound.slots[ind].asset !== this.oldId)
                      continue;

                  // components.sound.slots.?.asset
                  this.set(obj, 'components.sound.slots.' + ind + '.asset');
              }
          }

          // audiosource
          var audiosource = obj.get('components.audiosource');
          if (audiosource && audiosource.assets) {
              for (var a = 0; a < audiosource.assets.length; a++) {
                  if (audiosource.assets[a] !== this.oldId)
                      continue;

                  // components.audiosource.assets.?
                  this.set(obj, 'components.audiosource.assets.' + a);
              }
          }
      }
  };

  AssetReplace.prototype.handleCubemap = function () {
      var i;
      var obj;

      // entity
      for (i = 0; i < this.entities.length; i++) {
          obj = this.entities[i];

          // light
          var light = obj.get('components.light');
          if (light && light.cookieAsset === this.oldId) {
              // components.light.cookieAsset
              this.set(obj, 'components.light.cookieAsset');
          }
      }

      // asset
      for (i = 0; i < this.assets.length; i++) {
          obj = this.assets[i];

          if (obj.get('type') === 'material' && obj.get('data.cubeMap') === this.oldId) {
              // data.cubeMap
              this.set(obj, 'data.cubeMap');
          }
      }

      // sceneSettings
      obj = editor.call('sceneSettings');
      if (obj.get('render.skybox') === this.oldId) {
          // render.skybox
          this.set(obj, 'render.skybox');
      }
  };

  AssetReplace.prototype.handleMaterial = function () {
      var obj;
      var i;
      var ind;

      // entity
      for (i = 0; i < this.entities.length; i++) {
          obj = this.entities[i];

          // model
          var model = obj.get('components.model');
          if (model) {
              if (model.materialAsset === this.oldId) {
                  // components.model.materialAsset
                  this.set(obj, 'components.model.materialAsset');
              }
              if (model.mapping) {
                  for (ind in model.mapping) {
                      if (model.mapping[ind] === this.oldId) {
                          // components.model.mapping.?
                          this.set(obj, 'components.model.mapping.' + ind);
                      }
                  }
              }
          }

          // element
          var element = obj.get('components.element');
          if (element && element.materialAsset === this.oldId) {
              // components.element.materialAsset
              this.set(obj, 'components.element.materialAsset');
          }
      }

      // asset
      for (i = 0; i < this.assets.length; i++) {
          obj = this.assets[i];

          if (obj.get('type') === 'model') {
              var mapping = obj.get('data.mapping');
              if (mapping) {
                  for (ind = 0; ind < mapping.length; ind++) {
                      if (mapping[ind].material !== this.oldId)
                          continue;

                      // data.mapping.?.material
                      this.set(obj, 'data.mapping.' + ind + '.material');

                      // change meta.userMapping as well
                      var history = obj.history.enabled;
                      obj.history.enabled = false;
                      if (!obj.get('meta')) {
                          obj.set('meta', {
                              userMapping: {}
                          });
                      } else {
                          if (!obj.has('meta.userMapping'))
                              obj.set('meta.userMapping', {});
                      }

                      obj.set('meta.userMapping.' + ind, true);

                      obj.history.enabled = history;
                  }
              }
          }
      }
  };

  AssetReplace.prototype.handleModel = function () {
      var obj;
      var i;

      // entity
      for (i = 0; i < this.entities.length; i++) {
          obj = this.entities[i];

          // model
          var model = obj.get('components.model');
          if (model && model.asset === this.oldId) {
              // components.model.asset
              this.set(obj, 'components.model.asset');
          }

          // collision
          var collision = obj.get('components.collision');
          if (collision && collision.asset === this.oldId) {
              // components.collision.asset
              this.set(obj, 'components.collision.asset');
          }

          // particlesystem
          var particlesystem = obj.get('components.particlesystem');
          if (particlesystem && particlesystem.mesh === this.oldId) {
              // components.particlesystem.mesh
              this.set(obj, 'components.particlesystem.mesh');
          }
      }
  };

  AssetReplace.prototype.handleSprite = function () {
      var obj;
      var i;

      // entity
      for (i = 0; i < this.entities.length; i++) {
          obj = this.entities[i];

          // sprite component
          var sprite = obj.get('components.sprite');
          if (sprite) {
              if (sprite.spriteAsset && sprite.spriteAsset === this.oldId) {
                  this.set(obj, 'components.sprite.spriteAsset');
              }

              if (sprite.clips) {
                  for (var key in sprite.clips) {
                      if (sprite.clips[key].spriteAsset && sprite.clips[key].spriteAsset === this.oldId) {
                          this.set(obj, 'components.sprite.clips.' + key + '.spriteAsset');
                      }
                  }
              }
          }

          // button component
          var button = obj.get('components.button');
          if (button) {
              if (button.hoverSpriteAsset && button.hoverSpriteAsset === this.oldId) {
                  this.set(obj, 'components.button.hoverSpriteAsset');
              }

              if (button.pressedSpriteAsset && button.pressedSpriteAsset === this.oldId) {
                  this.set(obj, 'components.button.pressedSpriteAsset');
              }

              if (button.inactiveSpriteAsset && button.inactiveSpriteAsset === this.oldId) {
                  this.set(obj, 'components.button.inactiveSpriteAsset');
              }
          }

          // element component
          var element = obj.get('components.element');
          if (element) {
              if (element.spriteAsset && element.spriteAsset === this.oldId) {
                  this.set(obj, 'components.element.spriteAsset');
              }
          }
      }
  };

  AssetReplace.prototype.handleTexture = function () {
      var i;
      var obj;

      // entity
      for (i = 0; i < this.entities.length; i++) {
          obj = this.entities[i];

          // light
          var light = obj.get('components.light');
          if (light && light.cookieAsset === this.oldId) {
              // components.light.cookieAsset
              this.set(obj, 'components.light.cookieAsset');
          }

          // particlesystem
          var particlesystem = obj.get('components.particlesystem');
          if (particlesystem) {
              if (particlesystem.colorMapAsset === this.oldId) {
                  // components.particlesystem.colorMapAsset
                  this.set(obj, 'components.particlesystem.colorMapAsset');
              }
              if (particlesystem.normalMapAsset === this.oldId) {
                  // components.particlesystem.normalMapAsset
                  this.set(obj, 'components.particlesystem.normalMapAsset');
              }
          }

          // element
          var element = obj.get('components.element');
          if (element && element.textureAsset === this.oldId) {
              // components.element.textureAsset
              this.set(obj, 'components.element.textureAsset');
          }

          // button component
          var button = obj.get('components.button');
          if (button) {
              if (button.hoverTextureAsset && button.hoverTextureAsset === this.oldId) {
                  this.set(obj, 'components.button.hoverTextureAsset');
              }

              if (button.pressedTextureAsset && button.pressedTextureAsset === this.oldId) {
                  this.set(obj, 'components.button.pressedTextureAsset');
              }

              if (button.inactiveTextureAsset && button.inactiveTextureAsset === this.oldId) {
                  this.set(obj, 'components.button.inactiveTextureAsset');
              }
          }

      }

      // asset
      for (i = 0; i < this.assets.length; i++) {
          obj = this.assets[i];

          if (obj.get('type') === 'cubemap') {
              var textures = obj.get('data.textures');
              if (textures && textures instanceof Array) {
                  for (var ind = 0; ind < textures.length; ind++) {
                      if (textures[ind] !== this.oldId)
                          continue;

                      // data.mapping.?.material
                      this.set(obj, 'data.textures.' + ind);
                  }
              }
          } else if (obj.get('type') === 'material') {
              var data = obj.get('data');
              if (data) {
                  for (var s = 0; s < slots.length; s++) {
                      if (data[slots[s]] !== this.oldId)
                          continue;

                      this.set(obj, 'data.' + slots[s]);
                  }
              }
          }
      }
  };

  AssetReplace.prototype.handleTextureAtlas = function () {
      var obj;
      var i;

      // asset
      for (i = 0; i < this.assets.length; i++) {
          obj = this.assets[i];

          if (obj.get('type') === 'sprite') {
              var atlas = obj.get('data.textureAtlasAsset');
              if (atlas !== this.oldId) {
                  continue;
              }

              this.set(obj, 'data.textureAtlasAsset');
          }
      }
  };

  AssetReplace.prototype.handleTextureToSprite = function () {
      var obj;
      var i;

      var oldId = this.oldId;
      var newId = this.newId;
      var changed = [];

      for (i = 0; i < this.entities.length; i++) {
          obj = this.entities[i];

          var element = obj.get('components.element');
          if (element && element.textureAsset === oldId) {
              changed.push(obj);
              var history = obj.history.enabled;
              obj.history.enabled = false;
              obj.set('components.element.textureAsset', null);
              obj.set('components.element.spriteAsset', newId);
              obj.history.enabled = history;

              if (history) {
                  // set up undo
                  editor.call('history:add', {
                      name: 'asset texture to sprite',
                      undo: function () {
                          for (var i = 0; i < changed.length; i++) {
                              var obj = changed[i];
                              var history = obj.history.enabled;
                              obj.history.enabled = false;
                              obj.set('components.element.textureAsset', oldId);
                              obj.set('components.element.spriteAsset', null);
                              obj.history.enabled = history;
                          }
                      },

                      redo: function () {
                          for (var i = 0; i < changed.length; i++) {
                              var obj = changed[i];
                              var history = obj.history.enabled;
                              obj.history.enabled = false;
                              obj.set('components.element.textureAsset', null);
                              obj.set('components.element.spriteAsset', newId);
                              obj.history.enabled = history;
                          }
                      }
                  });
              }
          }
      }

  };

  AssetReplace.prototype.replaceScriptAttributes = function () {
      // entity.components.script
      for (var i = 0; i < this.entities.length; i++) {
          var obj = this.entities[i];

          // script
          var scripts = obj.get('components.script.scripts');
          if (scripts) {
              for (var script in scripts) {
                  var assetScript = editor.call('assets:scripts:assetByScript', script);
                  if (!assetScript)
                      continue;

                  var assetScripts = assetScript.get('data.scripts');
                  if (!assetScripts || !assetScripts[script] || !assetScripts[script].attributes)
                      continue;

                  var attributes = assetScripts[script].attributes;

                  for (var attrName in scripts[script].attributes) {
                      if (!attributes[attrName] || attributes[attrName].type !== 'asset')
                          continue;

                      if (attributes[attrName].array) {
                          var attrArray = scripts[script].attributes[attrName];
                          for (var j = 0; j < attrArray.length; j++) {
                              if (attrArray[j] !== this.oldId) continue;
                              this.set(obj, 'components.script.scripts.' + script + '.attributes.' + attrName + '.' + j);
                          }
                      } else {
                          if (scripts[script].attributes[attrName] !== this.oldId)
                              continue;

                          this.set(obj, 'components.script.scripts.' + script + '.attributes.' + attrName);
                      }
                  }
              }
          }
      }
  };

  AssetReplace.prototype.saveChanges = function () {
      var records = this.records;
      if (! records.length) return;

      var asset = this.asset;
      var oldId = this.oldId;
      var newId = this.newId;

      editor.call('history:add', {
          name: 'asset replace',
          undo: function () {
              for (var i = 0; i < records.length; i++) {
                  var obj = records[i].get();
                  if (!obj || !obj.has(records[i].path))
                      continue;

                  var history = asset.history.enabled;
                  obj.history.enabled = false;

                  obj.set(records[i].path, oldId);

                  // if we changed data.mapping also change meta.userMapping
                  if (/^data.mapping/.test(records[i].path)) {
                      if (obj.has('meta.userMapping')) {
                          var parts = records[i].path.split('.');
                          obj.unset('meta.userMapping.' + parts[2], true);
                          if (Object.keys(obj.get('meta.userMapping')).length === 0)
                              obj.unset('meta.userMapping');
                      }
                  }

                  obj.history.enabled = history;
              }
          },
          redo: function () {
              for (var i = 0; i < records.length; i++) {
                  var obj = records[i].get();
                  if (!obj || !obj.has(records[i].path))
                      continue;

                  var history = asset.history.enabled;
                  obj.history.enabled = false;
                  obj.set(records[i].path, newId);

                  // if we changed data.mapping also change meta.userMapping
                  if (/^data.mapping/.test(records[i].path)) {
                      if (!obj.get('meta')) {
                          obj.set('meta', {
                              userMapping: {}
                          });
                      } else {
                          if (!obj.has('meta.userMapping'))
                              obj.set('meta.userMapping', {});
                      }


                      var parts = records[i].path.split('.');
                      obj.set('meta.userMapping.' + parts[2], true);
                  }

                  obj.history.enabled = history;
              }
          }
      });
  };

  /**
   * Replaces the asset in all assets and components that it's referenced
   */
  AssetReplace.prototype.replace = function () {
      switch (this.asset.get('type')) {
          case 'animation':
              this.handleAnimation();
              break;
          case 'audio':
              this.handleAudio();
              break;
          case 'cubemap':
              this.handleCubemap();
              break;
          case 'material':
              this.handleMaterial();
              break;
          case 'model':
              this.handleModel();
              break;
          case 'sprite':
              this.handleSprite();
              break;
          case 'texture':
              this.handleTexture();
              break;
          case 'textureatlas':
              this.handleTextureAtlas();
              break;
      }

      this.replaceScriptAttributes();
      this.saveChanges();
  };

  // Special-case where we want to replace textures with sprites
  // This will only work on Element components and will replace a texture asset with sprite asset
  // It is not available generally only behind a user flag
  AssetReplace.prototype.replaceTextureToSprite = function () {
      var srcType = this.asset.get('type');
      var dstType = this.replacement.get('type');

      if (srcType !== 'texture' || dstType !== 'sprite') {
          console.error('replaceTextureToSprite must take texture and replace with sprite');
      }

      this.handleTextureToSprite();
      this.saveChanges();
  };

  editor.method('assets:replace', function (asset, replacement) {
      new AssetReplace(asset, replacement).replace();
  });

  editor.method('assets:replaceTextureToSprite', function (asset, replacement) {
      new AssetReplace(asset, replacement).replaceTextureToSprite();
  });

});


/* editor/assets/assets-rename.js */
editor.once('load', function() {
  'use strict';

  var changeName = function (assetId, assetName) {
      var form = new FormData();
      form.append('name', assetName);
      form.append('branchId', config.self.branch.id);
      Ajax({
          url: '{{url.api}}/assets/' + assetId,
          auth: true,
          data: form,
          method: 'PUT',
          ignoreContentType: true,
          notJson: true
      }).on('error', function (err, data) {
          console.error(err + data);
          editor.call('status:error', 'Couldn\'t update the name: ' + data);
      });
  }

  editor.method('assets:rename', function (asset, newName) {
      var oldName = asset.get('name');
      var id = asset.get('id');
      editor.call('history:add', {
          name: 'asset rename',
          undo: function() {
              if(editor.call('assets:get', id)) {
                  changeName(id, oldName);
              }
          },
          redo: function() {
              if(editor.call('assets:get', id)) {
                  changeName(id, newName);
              }
          }
      });

      changeName(id, newName);
  });
});


/* editor/assets/assets-rename-select.js */
editor.once('load', function() {
  'use strict';

  var onRename = function() {
      if (! editor.call('permissions:write'))
          return;

      var type = editor.call('selector:type');
      if (type !== 'asset')
          return;

      var items = editor.call('selector:items');
      if (items.length !== 1)
          return;

      var root = editor.call('attributes.rootPanel');
      if (! root)
          return;

      var input = root.dom.querySelector('.ui-text-field.asset-name');

      if (! input || ! input.ui)
          return;

      input.ui.flash();
      input.ui.elementInput.select();
  };

  editor.method('assets:rename-select', onRename);

  editor.call('hotkey:register', 'assets:rename-select', {
      key: 'n',
      callback: onRename
  });

  editor.call('hotkey:register', 'assets:rename-select:f2', {
      key: 'f2',
      callback: onRename
  });
});


/* editor/assets/assets-history.js */
editor.once('load', function() {
  'use strict';

  editor.on('assets:add', function(asset) {
      if (asset.history)
          return;

      var id = asset.get('id');

      asset.history = new ObserverHistory({
          item: asset,
          prefix: 'asset.' + id + '.',
          getItemFn: function () {
              return editor.call('assets:get', id);
          }
      });

      // record history
      asset.history.on('record', function(action, data) {
          editor.call('history:' + action, data);
      });
  });
});


/* editor/assets/assets-migrate.js */
editor.once('load', function() {
  'use strict';

  var migrateAsset = function(asset) {
      asset.history.enabled = false;

      if (asset.get('type') === 'material' && asset.get('data')) {
          if (! asset.has('data.useFog'))
              asset.set('data.useFog', true);

          if (! asset.has('data.useLighting'))
              asset.set('data.useLighting', true);

          if (! asset.has('data.useSkybox'))
              asset.set('data.useSkybox', true);

          if (! asset.has('data.useGammaTonemap'))
              asset.set('data.useGammaTonemap', true);

          if (! asset.get('data.cubeMapProjectionBox'))
              asset.set('data.cubeMapProjectionBox', { center: [ 0, 0, 0 ], halfExtents: [ 0.5, 0.5, 0.5 ] });

          if (! asset.has('data.alphaToCoverage'))
              asset.set('data.alphaToCoverage', false);
      }

      if ((asset.get('type') === 'texture' || asset.get('type') === 'textureatlas') && ! asset.get('source')) {
          if (asset.get('meta')) {
              if (! asset.has('meta.compress')) {
                  var alpha = asset.get('meta.alpha') || (asset.get('meta.type').toLowerCase() || '') === 'truecoloralpha' || false;

                  asset.set('meta.compress', {
                      alpha: alpha,
                      dxt: false,
                      pvr: false,
                      pvrBpp: 4,
                      etc1: false,
                      etc2: false
                  });
              } else {
                  if (! asset.has('meta.compress.pvr'))
                      asset.set('meta.compress.pvr', false);

                  if (! asset.has('meta.compress.pvrBpp'))
                      asset.set('meta.compress.pvrBpp', 4);

                  if (! asset.has('meta.compress.etc1'))
                      asset.set('meta.compress.etc1', false);

                  if (! asset.has('meta.compress.etc2'))
                      asset.set('meta.compress.etc2', false);
              }
          }
          if (asset.get('data')) {
              if (! asset.has('data.mipmaps'))
                  asset.set('data.mipmaps', true);
          }
      }

      if (asset.get('type') === 'font' && !asset.get('source')) {
          if (asset.get('data') && !asset.has('data.intensity')) {
              asset.set('data.intensity', 0.0);
          }
      }

      if (!asset.has('i18n')) {
          asset.set('i18n', {});
      }

      if (asset.get('type') === 'script') {
          if (asset.get('data') && !asset.has('data.loadingType')) {
              asset.set('data.loadingType', LOAD_SCRIPT_AS_ASSET);
          }
      }

      asset.history.enabled = true;
  };

  editor.on('assets:add', migrateAsset);
  editor.call('assets:list').forEach(migrateAsset);
});


/* editor/assets/assets-create-folder.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:create:folder', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var asset = {
          name: 'New Folder',
          type: 'folder',
          source: true,
          preload: false,
          data: null,
          parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset);
  });
});


/* editor/assets/assets-cubemap-prefiltering.js */
editor.once('load', function () {

  var app = null;

  editor.once('viewport:load', function() {
      app = editor.call('viewport:app');
  });

  // var device = editor.call('preview:device');
  // var assets = editor.call('preview:assetRegistry');

  var getTextureAssets = function (assetCubeMap) {
      var result = [];
      var textures = assetCubeMap.get('data.textures');
      for (var i = 0; i < textures.length; i++) {
          var id = textures[i];
          if (parseInt(id) >= 0) {
              var texture = editor.call('assets:get', id);
              if (!texture) {
                  return null;
              }

              result.push(texture);
          } else {
              return null;
          }
      }

      return result;
  };

  var prefilterHdrCubemap = function (assetCubeMap, cubemap, callback) {
      if (! app) {
          // webgl not available
          callback(new Error('webgl not available'));
          return;
      }

      try {
          var textureAssets = getTextureAssets(assetCubeMap);
          if (textureAssets) {
              var l = textureAssets.length;
              var count = l;
              var textures = [];

              var onLoad = function () {
                  editor.call('status:job', 'prefilter');

                  cubemap = new pc.Texture(app.graphicsDevice, {
                      cubemap: true,
                      rgbm: false,
                      fixCubemapSeams: true,
                      format: textures[0].format,
                      width: textures[0].width,
                      height: textures[0].height
                  });

                  cubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                  cubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

                  cubemap._levels[0] = [ textures[0]._levels[0],
                                         textures[1]._levels[0],
                                         textures[2]._levels[0],
                                         textures[3]._levels[0],
                                         textures[4]._levels[0],
                                         textures[5]._levels[0] ];

                  // prefilter cubemap
                  var options = {
                      device: app.graphicsDevice,
                      sourceCubemap: cubemap,
                      method: 1,
                      samples: 4096,
                      cpuSync: true,
                      filteredFixed: [],
                      filteredFixedRgbm: [],
                      singleFilteredFixedRgbm: true
                  };

                  pc.prefilterCubemap(options);

                  // get dds and create blob
                  var dds = options.singleFilteredFixedRgbm.getDds();
                  var blob = new Blob([dds], {type: 'image/dds'});

                  // upload blob as dds
                  editor.call('assets:uploadFile', {
                      file: blob,
                      name: assetCubeMap.get('name') + '.dds',
                      asset: assetCubeMap,
                      type: 'cubemap'
                  }, function (err, data) {
                      if (!err) {
                          callback();
                      } else {
                          editor.call('status:job', 'prefilter');
                          callback(err);
                      }
                  });
              };

              textureAssets.forEach(function (asset, index) {
                  editor.call('status:job', 'prefilter', index);

                  // when prefiltering we load a dds file that the pipeline put next to the png as well as the dds file
                  // as far as I know, this isn't referenced anywhere else and is only used here to generate the cubemap
                  // but honestly, who knows it could be used elsewhere too.
                  var url = swapExtension(asset.get('file.url'), '.png', '.dds');

                  app.assets._loader.load(url, "texture", function (err, resource) {
                      if (!err) {
                          textures[index] = resource;
                      } else {
                          console.warn(err);
                      }

                      count--;
                      if (count === 0) {
                          onLoad();
                      }
                  });
              });
          }
      } catch (ex) {
          callback(ex);
      }
  };

  var prefilterCubemap = function (assetCubeMap, cubemap, callback) {
      if (! app) {
          // webgl not available
          callback(new Error('webgl not available'));
          return;
      }

      try {
          var count = 0;
          var textures = [ ];
          var texturesAssets = [ ];
          var textureIds = assetCubeMap.get('data.textures');

          for(var i = 0; i < 6; i++) {
              // missing texture
              if (! textureIds[i])
                  return;

              texturesAssets[i] = editor.call('assets:get', textureIds[i]);

              // texture is not in registry
              if (! texturesAssets[i])
                  return;
          }

          var texturesReady = function() {
              editor.call('status:job', 'prefilter');

              var options = {
                  device: app.graphicsDevice,
                  sourceCubemap: cubemap,
                  method: 1,
                  samples: 4096,
                  cpuSync: true,
                  filteredFixed: [ ],
                  singleFilteredFixed: true
              };

              pc.prefilterCubemap(options);

              var dds = options.singleFilteredFixed.getDds();
              var blob = new Blob([ dds ], { type: 'image/dds' });

              // upload blob as dds
              editor.call('assets:uploadFile', {
                  file: blob,
                  name: assetCubeMap.get('name') + '.dds',
                  asset: assetCubeMap,
                  type: 'cubemap'
              }, function (err, data) {
                  if (callback)
                      callback(null);
              });
          };

          var textureLoad = function(ind, url) {
              editor.call('status:job', 'prefilter', ind);

              app.assets._loader.load(url, 'texture', function (err, resource) {
                  if (err)
                      console.warn(err);

                  textures[ind] = resource;

                  count++;
                  if (count === 6)
                      texturesReady();
              });
          };

          for(var i = 0; i < 6; i++)
              textureLoad(i, texturesAssets[i].get('file.url'))
      } catch (ex) {
          if (callback)
              callback(ex);
      }
  };

  editor.method('assets:cubemaps:prefilter', function (assetCubeMap, callback) {
      if (! app) {
          // webgl not available
          callback(new Error('webgl not available'));
          return;
      }

      var asset = app.assets.get(parseInt(assetCubeMap.get('id'), 10));
      if (! asset)
          return;

      var cubemap;
      var onLoad = function() {
          if (app.graphicsDevice.textureFloatRenderable && cubemap.rgbm) {
              prefilterHdrCubemap(assetCubeMap, cubemap, callback);
          } else {
              prefilterCubemap(assetCubeMap, cubemap, callback);
          }
      };

      if (asset.resource) {
          cubemap = asset.resource;
          onLoad();
      } else {
          asset.once('load', function(asset) {
              cubemap = asset.resource;
              onLoad();
          });
          app.assets.load(asset);
      }
  });

  // invalidate prefiltering data on cubemaps
  // when one of face textures file is changed
  editor.on('assets:add', function(asset) {
      if (asset.get('type') !== 'cubemap')
          return;

      asset._textures = [ ];

      var invalidate = function() {
          if (! asset.get('file'))
              return;

          // TODO: do not set the file here but use the asset server
          asset.set('file', null);
      };

      var watchTexture = function(ind, id) {
          if (asset._textures[ind])
              asset._textures[ind].unbind();

          asset._textures[ind] = null;

          if (! id)
              return;

          var texture = editor.call('assets:get', id);
          if (texture)
              asset._textures[ind] = texture.on('file.hash:set', invalidate);
      };

      var watchFace = function(ind) {
          // update watching on face change
          asset.on('data.textures.' + ind + ':set', function(id) {
              watchTexture(ind, id);
          });
          // start watching
          watchTexture(ind, asset.get('data.textures.' + ind));
      };

      for(var i = 0; i < 6; i++)
          watchFace(i);
  });
});


/* editor/assets/assets-create-bundle.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:create:bundle', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var asset = {
          name: 'New Bundle',
          type: 'bundle',
          source: false,
          preload: true,
          data: {
              assets: []
          },
          parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset);
  });
});


/* editor/assets/assets-create-material.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:create:material', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var data = editor.call('schema:material:getDefaultData');

      var asset = {
          name: 'New Material',
          type: 'material',
          source: false,
          preload: true,
          data: data,
          parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset);
  });
});


/* editor/assets/assets-create-cubemap.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:create:cubemap', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var asset = {
          name: 'New Cubemap',
          type: 'cubemap',
          source: false,
          preload: true,
          parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
          data: {
              name: 'New Cubemap',
              textures: [ null, null, null, null, null, null ],
              minFilter: 5, // linear mipmap linear
              magFilter: 1, // linear
              anisotropy: 1
          },
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset);
  });
});


/* editor/assets/assets-create-html.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:create:html', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var asset = {
          name: 'New Html',
          type: 'html',
          source: false,
          preload: true,
          parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
          filename: 'asset.html',
          file: new Blob([ '\n' ], { type: 'text/html' }),
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset);
  });
});


/* editor/assets/assets-create-css.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:create:css', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var asset = {
          name: 'New Css',
          type: 'css',
          source: false,
          preload: true,
          parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
          filename: 'asset.css',
          file: new Blob([ '\n' ], { type: 'text/css' }),
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset);
  });
});


/* editor/assets/assets-create-json.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:create:json', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var asset = {
          name: 'New Json',
          type: 'json',
          source: false,
          preload: true,
          parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
          filename: 'asset.json',
          file: new Blob([ '{ }' ], { type: 'application/json' }),
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset);
  });
});


/* editor/assets/assets-create-text.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:create:text', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var asset = {
          name: 'New Text',
          type: 'text',
          source: false,
          preload: true,
          parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
          filename: 'asset.txt',
          file: new Blob([ '\n' ], { type: 'text/plain' }),
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset);
  });
});


/* editor/assets/assets-create-script.js */
editor.once('load', function() {
  'use strict';

  var scriptBoilerplate = "var {className} = pc.createScript('{scriptName}');\n\n// initialize code called once per entity\n{className}.prototype.initialize = function() {\n    \n};\n\n// update code called every frame\n{className}.prototype.update = function(dt) {\n    \n};\n\n// swap method called for script hot-reloading\n// inherit your script state here\n// {className}.prototype.swap = function(old) { };\n\n// to learn more about script anatomy, please read:\n// http://developer.playcanvas.com/en/user-manual/scripting/";
  var filenameValid = /^([^0-9.#<>$+%!`&='{}@\\/:*?"<>|\n])([^#<>$+%!`&='{}@\\/:*?"<>|\n])*$/i;


  editor.method('assets:create:script', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var filename = args.filename || 'script.js';

      if (args.boilerplate) {
          var name = filename.slice(0, -3);
          var className = args.className || '';
          var scriptName = args.scriptName || '';

          if (! className || ! scriptName) {
              // tokenize filename
              var tokens = [ ];
              var string = name.replace(/([^A-Z])([A-Z][^A-Z])/g, '$1 $2').replace(/([A-Z0-9]{2,})/g, ' $1');
              var parts = string.split(/(\s|\-|_|\.)/g);

              // filter valid tokens
              for(var i = 0; i < parts.length; i++) {
                  parts[i] = parts[i].toLowerCase().trim();
                  if (parts[i] && parts[i] !== '-' && parts[i] !== '_' && parts[i] !== '.')
                      tokens.push(parts[i]);
              }

              if (tokens.length) {
                  if (! scriptName) {
                      scriptName = tokens[0];

                      for(var i = 1; i < tokens.length; i++) {
                          scriptName += tokens[i].charAt(0).toUpperCase() + tokens[i].slice(1);
                      }
                  }

                  if (! className) {
                      for(var i = 0; i < tokens.length; i++) {
                          className += tokens[i].charAt(0).toUpperCase() + tokens[i].slice(1);
                      }
                  }
              } else {
                  if (! className)
                      className = 'Script';

                  if (! scriptName)
                      scriptName = 'script';
              }
          }

          if (! filenameValid.test(className))
              className = 'Script';

          args.content = scriptBoilerplate.replace(/\{className\}/g, className).replace(/\{scriptName\}/g, scriptName);
      }

      var asset = {
          name: filename,
          type: 'script',
          source: false,
          preload: true,
          parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
          filename: filename,
          file: new Blob([ args.content || '' ], { type: 'text/javascript' }),
          data: {
              scripts: { },
              loading: false,
              loadingType: LOAD_SCRIPT_AS_ASSET
          },
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset, function(err, assetId) {
          if (err) return;

          var onceAssetLoad = function(asset) {
              var url = asset.get('file.url');
              if (url) {
                  onParse(asset);
              } else {
                  asset.once('file.url:set', function() {
                      onParse(asset)
                  });
              }
          };

          var onParse = function(asset) {
              editor.call('scripts:parse', asset, function(err, result) {
                  if (args.callback)
                      args.callback(err, asset, result);
              });
          };

          var asset = editor.call('assets:get', assetId);
          if (asset) {
              onceAssetLoad(asset);
          } else {
              editor.once('assets:add[' + assetId + ']', onceAssetLoad);
          }
      }, args.noSelect);
  });
});


/* editor/assets/assets-create-shader.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:create:shader', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var asset = {
          name: 'New Shader',
          type: 'shader',
          source: false,
          preload: true,
          parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
          filename: 'asset.glsl',
          file: new Blob([ '\n' ], { type: 'text/x-glsl' }),
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset);
  });
});


/* editor/assets/assets-create-sprite.js */
editor.once('load', function() {
  'use strict';

  editor.method('assets:create:sprite', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var data = {
          pixelsPerUnit: args.pixelsPerUnit !== undefined ? args.pixelsPerUnit : 100,
          frameKeys: args.frameKeys !== undefined ? args.frameKeys : [],
          textureAtlasAsset: args.textureAtlasAsset !== undefined ? parseInt(args.textureAtlasAsset, 10) : null,
          renderMode: args.renderMode !== undefined ? args.renderMode : 0
      };

      var asset = {
          name: args.name !== undefined ? args.name : 'New Sprite',
          type: 'sprite',
          source: false,
          preload: true,
          data: data,
          parent: (args.parent !== undefined) ? args.parent : editor.call('assets:panel:currentFolder'),
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset, args.fn, args.noSelect);
  });
});


/* editor/assets/assets-create-i18n.js */
editor.once('load', function () {
  'use strict';

  if (!editor.call('users:hasFlag', 'hasLocalization')) return;

  var content = JSON.stringify({
      "header": {
          "version": 1
      },
      "data": [{
          "info": {
              "locale": "en-US"
          },
          "messages": {
              "key": "Single key translation",
              "key plural": ["One key translation", "Translation for {number} keys"]
          }
      }]
  }, null, 4);

  editor.method('assets:create:i18n', function (args) {
      if (! editor.call('permissions:write'))
          return;

      args = args || { };

      var filename = 'Localization.json';

      var asset = {
          name: filename,
          type: 'json',
          source: false,
          preload: true,
          parent: editor.call('assets:panel:currentFolder'),
          filename: filename,
          file: new Blob([content], { type: 'application/json' }),
          scope: {
              type: 'project',
              id: config.project.id
          }
      };

      editor.call('assets:create', asset);
  });
});


/* editor/assets/assets-unwrap.js */
editor.once('load', function() {
  'use strict';

  var unwrapping = { };

  editor.method('assets:model:unwrap', function(asset, args, fn) {
      if (asset.get('type') !== 'model' || ! asset.has('file.filename') || unwrapping[asset.get('id')])
          return;

      if (typeof(args) === 'function')
          fn = args;

      if (typeof(args) !== 'object')
          args = { };

      args = args || { };

      var filename = asset.get('file.filename');
      var worker = new Worker('/editor/scene/js/editor/assets/assets-unwrap-worker.js');
      worker.asset = asset;
      worker.progress = 0;

      unwrapping[asset.get('id')] = worker;

      worker.onmessage = function(evt) {
          if (! evt.data.name)
              return;

          switch(evt.data.name) {
              case 'finish':
                  var data = evt.data.data;

                  // save area
                  asset.set('data.area', evt.data.area);

                  var blob = new Blob([
                      JSON.stringify(data)
                  ], {
                      type: 'application/json'
                  });

                  // upload blob as dds
                  editor.call('assets:uploadFile', {
                      file: blob,
                      name: filename,
                      asset: asset,
                      type: 'model'
                  }, function (err, data) {
                      // remove from unwrapping list
                      delete unwrapping[asset.get('id')];
                      // render
                      editor.call('viewport:render');
                      // callback
                      if (fn) fn(err, asset);
                      // emit global event
                      editor.emit('assets:model:unwrap', asset);
                  });
                  break;

              case 'progress':
                  worker.progress = evt.data.progress;
                  editor.emit('assets:model:unwrap:progress:' + asset.get('id'), evt.data.progress);
                  editor.emit('assets:model:unwrap:progress', asset, evt.data.progress);
                  break;
          }
      };

      worker.onerror = function(err) {
          if (fn) fn(err);
          // remove from unwrapping list
          delete unwrapping[asset.get('id')];
      };

      worker.postMessage({
          name: 'start',
          id: asset.get('id'),
          filename: filename,
          padding: args.padding || 2.0
      });
  });


  editor.method('assets:model:unwrap:cancel', function(asset) {
      var worker = unwrapping[asset.get('id')];
      if (! worker)
          return;

      worker.terminate();
      delete unwrapping[asset.get('id')];
  });


  editor.method('assets:model:unwrapping', function(asset) {
      if (asset) {
          return unwrapping[asset.get('id')] || null;
      } else {
          var list = [ ];
          for(var key in unwrapping) {
              if (! unwrapping.hasOwnProperty(key))
                  continue;

              list.push(unwrapping[key]);
          }
          return list.length ? list : null;
      }
  });


  editor.method('assets:model:area', function(asset, fn) {
      if (asset.get('type') !== 'model' || ! asset.has('file.filename'))
          return;

      var filename = asset.get('file.filename');
      var worker = new Worker('/editor/scene/js/editor/assets/assets-unwrap-worker.js');

      worker.onmessage = function(evt) {
          if (evt.data.name && evt.data.name === 'finish') {
              // save area
              asset.set('data.area', evt.data.area || null);
              // callback
              if (fn) fn(null, asset, evt.data.area || null);
          }
      };

      worker.onerror = function(err) {
          if (fn) fn(err);
      };

      worker.postMessage({
          name: 'area',
          id: asset.get('id'),
          filename: filename
      });
  });
});


/* editor/assets/assets-used.js */
editor.once('load', function () {
  'use strict';

  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');
  var index = {};
  var keys = {
      'cubemap': {
          'data.textures.0': true,
          'data.textures.1': true,
          'data.textures.2': true,
          'data.textures.3': true,
          'data.textures.4': true,
          'data.textures.5': true
      },
      'material': {
          'data.aoMap': true,
          'data.diffuseMap': true,
          'data.specularMap': true,
          'data.metalnessMap': true,
          'data.glossMap': true,
          'data.emissiveMap': true,
          'data.opacityMap': true,
          'data.normalMap': true,
          'data.heightMap': true,
          'data.sphereMap': true,
          'data.cubeMap': true,
          'data.lightMap': true
      },
      'sprite': {
          'data.textureAtlasAsset': true
      },
      'model': {},
      'entity': {
          'components.model.materialAsset': true,
          'components.model.asset': true,
          'components.collision.asset': true,
          'components.particlesystem.colorMapAsset': true,
          'components.particlesystem.normalMapAsset': true,
          'components.particlesystem.mesh': true,
          'components.element.textureAsset': true,
          'components.element.spriteAsset': true,
          'components.element.materialAsset': true,
          'components.element.fontAsset': true,
          'components.light.cookieAsset': true,
          'components.sprite.spriteAsset': true
      },
      'entity-lists': {
          'components.animation.assets': true,
          'components.audiosource.assets': true,
          // 'components.script.scripts': true
      }
  };
  var updateAsset = function (referer, type, oldId, newId) {
      if (oldId && index[oldId] !== undefined) {
          index[oldId].count--;

          if (index[oldId].ref[referer]) {
              if (editor.call('assets:used:get', referer)) {
                  index[oldId].parent--;
                  if (index[oldId].count !== 0 && index[oldId].parent === 0)
                      editor.emit('assets:used:' + oldId, false);
              }

              index[oldId].ref[referer][0].unbind();
              if (index[oldId].ref[referer][1])
                  index[oldId].ref[referer][1].unbind();

              delete index[oldId].ref[referer];
          }

          if (index[oldId].count === 0)
              editor.emit('assets:used:' + oldId, false);
      }

      if (newId) {
          if (index[newId] === undefined) {
              index[newId] = {
                  count: 0,
                  parent: 0,
                  ref: {}
              };
          }

          index[newId].count++;

          if (!index[newId].ref[referer]) {
              index[newId].ref[referer] = [];
              index[newId].ref[referer].type = type;

              index[newId].ref[referer][0] = editor.on('assets:used:' + referer, function (state) {
                  if (!index[newId])
                      return;

                  index[newId].parent += state * 2 - 1;

                  if (index[newId].parent === 0) {
                      // now not used
                      editor.emit('assets:used:' + newId, false);
                  } else if (index[newId].parent === 1) {
                      // now used
                      editor.emit('assets:used:' + newId, true);
                  }
              });

              // referer can be destroyed
              var itemType = 'asset';
              var item = editor.call('assets:get', referer);
              if (!item) {
                  item = editor.call('entities:get', referer);
                  itemType = 'entity';
              }

              if (item) {
                  index[newId].ref[referer][1] = item.once('destroy', function () {
                      updateAsset(referer, itemType, newId);
                  });
              }

              if (editor.call('assets:used:get', referer)) {
                  index[newId].parent++;

                  if (index[newId].count !== 1 && index[newId].parent === 1)
                      editor.emit('assets:used:' + newId, true);
              }
          }

          if (index[newId].count === 1 && index[newId].parent)
              editor.emit('assets:used:' + newId, true);
      }
  };
  var onSetMethods = {
      'cubemap': function (path, value, valueOld) {
          if (!keys['cubemap'][path])
              return;

          updateAsset(this.get('id'), 'asset', valueOld, value);
      },
      'material': function (path, value, valueOld) {
          if (!keys['material'][path])
              return;

          updateAsset(this.get('id'), 'asset', valueOld, value);
      },
      'model': function (path, value, valueOld) {
          if (path.startsWith('data.mapping.') && path.slice(-8) === 'material')
              updateAsset(this.get('id'), 'asset', valueOld, value);

          if (!keys['model'][path])
              return;

          updateAsset(this.get('id'), 'asset', valueOld, value);
      },
      'model-insert': function (path, value) {
          if (!path.startsWith('data.mapping.'))
              return;

          updateAsset(this.get('id'), 'asset', null, value);
      },
      'model-remove': function (path, value) {
          if (!path.startsWith('data.mapping.'))
              return;

          updateAsset(this.get('id'), 'asset', value);
      },
      'sprite': function (path, value, valueOld) {
          if (!keys['sprite'][path])
              return;

          updateAsset(this.get('id'), 'asset', valueOld, value);
      },
      'entity': function (path, value, valueOld) {
          if (path.startsWith('components.animation.assets.')) {
              var parts = path.split('.');
              if (parts.length !== 4)
                  return;
          } else if (path.startsWith('components.model.mapping.')) {
              var parts = path.split('.');
              if (parts.length !== 4)
                  return;
          } else if (path.startsWith('components.sound.slots')) {
              var parts = path.split('.');
              if (parts.length !== 5 || parts[4] !== 'asset')
                  return;
          } else if (path.startsWith('components.sprite.clips')) {
              var parts = path.split('.');
              if (parts.length !== 5 || parts[4] !== 'spriteAsset')
                  return;
          } else if (!legacyScripts && path.startsWith('components.script.scripts')) {
              var parts = path.split('.');
              if (parts.length === 6 && parts[4] === 'attributes') {
                  var primaryScript = editor.call('assets:scripts:assetByScript', parts[3]);
                  if (primaryScript) {
                      var type = primaryScript.get('data.scripts.' + parts[3] + '.attributes.' + parts[5] + '.type');
                      if (type !== 'asset')
                          return;
                  } else {
                      return;
                  }
              } else if (parts.length === 4) {
                  var primaryScript = editor.call('assets:scripts:assetByScript', parts[3]);
                  if (primaryScript) {
                      updateAsset(this.get('resource_id'), 'entity', null, primaryScript.get('id'));
                      return;
                  } else {
                      return;
                  }
              } else {
                  return;
              }
          } else if (!keys['entity'][path]) {
              return;
          }

          if (value instanceof Array) {
              for (var i = 0; i < value.length; i++) {
                  updateAsset(this.get('resource_id'), 'entity', valueOld && valueOld[i] || null, value[i]);
              }
          } else {
              updateAsset(this.get('resource_id'), 'entity', valueOld, value);
          }
      },
      'entity-unset': function (path, value) {
          if (path.startsWith('components.model.mapping.')) {
              var parts = path.split('.');
              if (parts.length !== 4)
                  return;
          } else if (path.startsWith('components.sound.slots')) {
              var parts = path.split('.');
              if (parts.length !== 5 || parts[4] !== 'asset')
                  return;
          } else if (path.startsWith('components.sprite.clips')) {
              var parts = path.split('.');
              if (parts.length !== 5 || parts[4] !== 'spriteAsset')
                  return;
          } else if (!legacyScripts && path.startsWith('components.script.scripts')) {
              var parts = path.split('.');
              if (parts.length === 6 && parts[4] === 'attributes') {
                  var primaryScript = editor.call('assets:scripts:assetByScript', parts[3]);
                  if (primaryScript) {
                      var type = primaryScript.get('data.scripts.' + parts[3] + '.attributes.' + parts[5] + '.type');
                      if (type !== 'asset')
                          return;
                  } else {
                      return;
                  }
              } else if (parts.length === 5) {
                  var primaryScript = editor.call('assets:scripts:assetByScript', parts[3]);
                  if (primaryScript) {
                      var type = primaryScript.get('data.scripts.' + parts[3] + '.attributes.' + parts[5] + '.type');
                      if (type === 'asset') {
                          if (value.attributes[parts[5]] instanceof Array) {
                              for (var i = 0; i < value.attributes[parts[5]].length; i++) {
                                  updateAsset(this.get('resource_id'), 'entity', value.attributes[parts[5]][i], null);
                              }
                          } else {
                              updateAsset(this.get('resource_id'), 'entity', value.attributes[parts[5]], null);
                          }
                      }
                  } else {
                      return;
                  }
              } else if (parts.length === 4) {
                  var primaryScript = editor.call('assets:scripts:assetByScript', parts[3]);
                  if (primaryScript) {
                      updateAsset(this.get('resource_id'), 'entity', primaryScript.get('id'), null);

                      for (var attrName in value.attributes) {
                          var type = primaryScript.get('data.scripts.' + parts[3] + '.attributes.' + attrName + '.type');
                          if (type === 'asset') {
                              if (value.attributes[attrName] instanceof Array) {
                                  for (var i = 0; i < value.attributes[attrName].length; i++) {
                                      updateAsset(this.get('resource_id'), 'entity', value.attributes[attrName][i], null);
                                  }
                              } else {
                                  updateAsset(this.get('resource_id'), 'entity', value.attributes[attrName], null);
                              }
                          }
                      }
                  }
                  return;
              } else {
                  return;
              }
          } else if (!keys['entity'][path]) {
              return;
          }

          if (value instanceof Array) {
              for (var i = 0; i < value.length; i++) {
                  updateAsset(this.get('resource_id'), 'entity', value[i], null);
              }
          } else {
              updateAsset(this.get('resource_id'), 'entity', value, null);
          }
      },
      'entity-insert': function (path, value) {
          if (legacyScripts && path.startsWith('components.script.scripts.')) {
              var parts = path.split('.');
              if (parts.length !== 7 || parts[4] !== 'attributes' || parts[6] !== 'value' || this.get(parts.slice(0, 6).join('.') + '.type') !== 'asset')
                  return;
          } else if (!legacyScripts && path.startsWith('components.script.scripts')) {
              var parts = path.split('.');
              if (parts.length === 6 && parts[4] === 'attributes') {
                  var primaryScript = editor.call('assets:scripts:assetByScript', parts[3]);
                  if (primaryScript) {
                      var type = primaryScript.get('data.scripts.' + parts[3] + '.attributes.' + parts[5] + '.type');
                      if (type !== 'asset')
                          return;
                  } else {
                      return;
                  }
              } else {
                  return;
              }
          } else if (!keys['entity-lists'][path]) {
              return;
          }

          if (value instanceof Array) {
              for (var i = 0; i < value.length; i++) {
                  updateAsset(this.get('resource_id'), 'entity', null, value[i]);
              }
          } else {
              updateAsset(this.get('resource_id'), 'entity', null, value);
          }
      },
      'entity-remove': function (path, value) {
          if (legacyScripts && path.startsWith('components.script.scripts.')) {
              var parts = path.split('.');
              if (parts.length !== 7 || parts[4] !== 'attributes' || parts[6] !== 'value' || this.get(parts.slice(0, 6).join('.') + '.type') !== 'asset')
                  return;
          } else if (!legacyScripts && path.startsWith('components.script.scripts')) {
              var parts = path.split('.');
              if (parts.length === 6 && parts[4] === 'attributes') {
                  var primaryScript = editor.call('assets:scripts:assetByScript', parts[3]);
                  if (primaryScript) {
                      var type = primaryScript.get('data.scripts.' + parts[3] + '.attributes.' + parts[5] + '.type');
                      if (type !== 'asset')
                          return;
                  } else {
                      return;
                  }
              } else {
                  return;
              }
          } else if (!keys['entity-lists'][path]) {
              return;
          }

          updateAsset(this.get('resource_id'), 'entity', value, null);
      }
  };

  editor.on('assets:scripts:primary:set', function (asset, script) {
      var entities = editor.call('entities:list:byScript', script);
      var len = entities.length;
      if (!len) {
          return;
      }

      var i;
      var itemsOrder = asset.get('data.scripts.' + script + '.attributesOrder');
      var items = asset.get('data.scripts.' + script + '.attributes');
      var attributes = [];
      for (i = 0; i < itemsOrder.length; i++) {
          if (items[itemsOrder[i]].type === 'asset')
              attributes.push(itemsOrder[i]);
      }

      for (i = 0; i < len; i++) {
          var entity = entities[i];

          updateAsset(entity.get('resource_id'), 'entity', null, asset.get('id'));

          for (var a = 0; a < attributes.length; a++) {
              var value = entity.get('components.script.scripts.' + script + '.attributes.' + attributes[a]);
              if (!value)
                  continue;

              if (value instanceof Array) {
                  for (var v = 0; v < value.length; v++) {
                      if (typeof (value[v]) === 'number') {
                          updateAsset(entity.get('resource_id'), 'entity', null, value[v]);
                      }
                  }
              } else if (typeof (value) === 'number') {
                  updateAsset(entity.get('resource_id'), 'entity', null, value);
              }
          }
      }
  });

  editor.on('assets:scripts:primary:unset', function (asset, script) {
      var entities = editor.call('entities:list:byScript', script);
      var len = entities.length;
      if (!len) {
          return;
      }

      var data = asset.get('data.scripts.' + script);
      var attributes = [];
      var i;

      if (data) {
          var itemsOrder = data.attributesOrder;
          var items = data.attributes;

          for (i = 0; i < itemsOrder.length; i++) {
              if (items[itemsOrder[i]].type === 'asset')
                  attributes.push(itemsOrder[i]);
          }
      }

      for (i = 0; i < len; i++) {
          var entity = entities[i];

          updateAsset(entity.get('resource_id'), 'entity', asset.get('id'), null);

          for (var a = 0; a < attributes.length; a++) {
              var value = entity.get('components.script.scripts.' + script + '.attributes.' + attributes[a]);
              if (!value)
                  continue;

              if (value instanceof Array) {
                  for (var v = 0; v < value.length; v++) {
                      if (typeof (value[v]) === 'number') {
                          updateAsset(entity.get('resource_id'), 'entity', value[v], null);
                      }
                  }
              } else if (typeof (value) === 'number') {
                  updateAsset(entity.get('resource_id'), 'entity', value, null);
              }
          }
      }
  });

  // assets
  editor.on('assets:add', function (asset) {
      if (asset.get('source'))
          return;

      var type = asset.get('type');

      if (type === 'folder')
          return;

      if (onSetMethods[type]) {
          asset.on('*:set', onSetMethods[type]);

          if (onSetMethods[type + '-insert'])
              asset.on('*:insert', onSetMethods[type + '-insert']);

          if (onSetMethods[type + '-remove'])
              asset.on('*:remove', onSetMethods[type + '-remove']);

          for (var key in keys[type])
              updateAsset(asset.get('id'), 'asset', null, asset.get(key));

          if (type === 'model') {
              var mapping = asset.get('data.mapping');
              if (mapping) {
                  for (var i = 0; i < mapping.length; i++)
                      updateAsset(asset.get('id'), 'asset', null, mapping[i].material);
              }
          }
      }
  });

  // entities
  editor.on('entities:add', function (entity) {
      entity.on('*:set', onSetMethods['entity']);
      entity.on('*:unset', onSetMethods['entity-unset']);
      entity.on('*:insert', onSetMethods['entity-insert']);
      entity.on('*:remove', onSetMethods['entity-remove']);

      for (var key in keys['entity'])
          updateAsset(entity.get('resource_id'), 'entity', null, entity.get(key));

      var mappings = entity.get('components.model.mapping');
      if (mappings) {
          for (var ind in mappings) {
              if (!mappings.hasOwnProperty(ind) || !mappings[ind])
                  continue;

              updateAsset(entity.get('resource_id'), 'entity', null, mappings[ind]);
          }
      }

      for (var key in keys['entity-lists']) {
          var items = entity.get(key);
          if (!items || !items.length)
              continue;

          for (var i = 0; i < items.length; i++)
              updateAsset(entity.get('resource_id'), 'entity', null, items[i]);
      }

      var slots = entity.get('components.sound.slots');
      if (slots) {
          for (var i in slots) {
              if (!slots.hasOwnProperty(i) || !slots[i].asset)
                  continue;

              updateAsset(entity.get('resource_id'), 'entity', null, slots[i].asset);
          }
      }

      var clips = entity.get('components.sprite.clips');
      if (clips) {
          for (var key in clips) {
              if (!clips.hasOwnProperty(key) || !clips[key].spriteAsset) {
                  continue;
              }

              updateAsset(entity.get('resource_id'), 'entity', null, clips[key].spriteAsset);
          }
      }

      var scripts = entity.get('components.script.scripts');

      if (scripts) {
          for (var script in scripts) {
              if (!scripts.hasOwnProperty(script))
                  continue;

              var primaryScript = editor.call('assets:scripts:assetByScript', script);
              if (primaryScript) {
                  updateAsset(entity.get('resource_id'), 'entity', null, primaryScript.get('id'));

                  var attributes = scripts[script].attributes;
                  for (var attr in attributes) {
                      if (!attributes.hasOwnProperty(attr))
                          continue;

                      var type = primaryScript.get('data.scripts.' + script + '.attributes.' + attr + '.type');
                      if (type === 'asset') {
                          var value = attributes[attr];

                          if (value instanceof Array) {
                              for (var v = 0; v < value.length; v++) {
                                  updateAsset(entity.get('resource_id'), 'entity', null, value[v]);
                              }
                          } else if (value) {
                              updateAsset(entity.get('resource_id'), 'entity', null, value);
                          }
                      }
                  }
              }
          }
      }
  });

  // scene settings
  var sceneSettings = editor.call('sceneSettings');
  sceneSettings.on('render.skybox:set', function (value, valueOld) {
      updateAsset('sceneSettings', 'editorSettings', valueOld, value);
  });

  editor.method('assets:used:index', function () {
      return index;
  });
  editor.method('assets:used:get', function (id) {
      if (isNaN(id))
          return true;

      if (!index[id])
          return false;

      return !!(index[id].count && index[id].parent);
  });
});


/* editor/assets/assets-user-color.js */
editor.once('load', function() {
  'use strict';

  var colors = { };
  var items = { };
  var pool = { };

  editor.on('selector:sync', function(user, data) {
      // deselect
      if (items[user] && items[user].length) {
          for(var i = 0; i < items[user].length; i++) {
              var element = items[user][i];
              element.parentNode.removeChild(element);
              pool[user].push(element);
          }

          items[user] = [ ];
      }

      if (data.type === 'asset') {
          // select
          if (! items[user]) {
              items[user] = [ ];
              pool[user] = [ ];
          }

          if (! colors[user])
              colors[user] = editor.call('whoisonline:color', user, 'hex');

          for(var i = 0; i < data.ids.length; i++) {
              var element = editor.call('assets:panel:get', data.ids[i]);
              if (! element)
                  continue;

              var point;

              if (pool[user].length) {
                  point = pool[user].pop();
              } else {
                  point = document.createElement('span');
                  point.style.backgroundColor = colors[user];
              }

              element.users.appendChild(point);
              items[user].push(point);
          }
      }
  });

  editor.on('whoisonline:remove', function(id) {
      if (! items[id])
          return;

      for(var i = 0; i < items[id].length; i++)
          items[id][i].parentNode.removeChild(items[id][i]);

      delete items[id];
      delete pool[id];
      delete colors[id];
  });
});


/* editor/assets/assets-script-parse.js */
editor.once('load', function() {
  'use strict';

  if (editor.call('settings:project').get('useLegacyScripts'))
      return;


  // parse script file and its attributes
  // update attributes accordingly


  editor.method('scripts:parse', function(asset, fn) {
      var worker = new Worker('/editor/scene/js/editor/assets/assets-script-parse-worker.js');
      worker.asset = asset;
      worker.progress = 0;

      worker.onmessage = function(evt) {
          if (! evt.data.name)
              return;

          switch(evt.data.name) {
              case 'results':
                  worker.terminate();
                  var result = evt.data.data;

                  var scripts = asset.get('data.scripts');

                  asset.history.enabled = false;

                  // loading screen?
                  if (result.loading !== asset.get('data.loading'))
                      asset.set('data.loading', result.loading);

                  // remove scripts
                  for(var key in scripts) {
                      if (! scripts.hasOwnProperty(key) || result.scripts.hasOwnProperty(key))
                          continue;

                      asset.unset('data.scripts.' + key);
                  }

                  // add scripts
                  for(var key in result.scripts) {
                      if (! result.scripts.hasOwnProperty(key))
                          continue;

                      var attributes = { };

                      // TODO scripts2
                      // attributes validation

                      for(var attr in result.scripts[key].attributes) {
                          if (! result.scripts[key].attributes.hasOwnProperty(attr))
                              continue;

                          attributes[attr] = result.scripts[key].attributes[attr];
                      }

                      var script = asset.get('data.scripts.' + key);
                      var attributesOrder = result.scripts[key].attributesOrder;

                      if (! script) {
                          // new script
                          asset.set('data.scripts.' + key, {
                              'attributesOrder': attributesOrder || [ ],
                              'attributes': attributes
                          });
                      } else {
                          // change attributes
                          for(var attr in attributes) {
                              if (! attributes.hasOwnProperty(attr) || ! script.attributes.hasOwnProperty(attr))
                                  continue;

                              asset.set('data.scripts.' + key + '.attributes.' + attr, attributes[attr]);
                          }

                          // remove attributes
                          for(var attr in script.attributes) {
                              if (! script.attributes.hasOwnProperty(attr) || attributes.hasOwnProperty(attr))
                                  continue;

                              asset.unset('data.scripts.' + key + '.attributes.' + attr);
                              asset.removeValue('data.scripts.' + key + '.attributesOrder', attr);
                          }

                          // add attributes
                          for(var attr in attributes) {
                              if (! attributes.hasOwnProperty(attr) || script.attributes.hasOwnProperty(attr))
                                  continue;

                              var ind = attributesOrder.indexOf(attr);
                              asset.set('data.scripts.' + key + '.attributes.' + attr, attributes[attr]);
                              asset.insert('data.scripts.' + key + '.attributesOrder', attr, ind);
                          }

                          // TODO scritps2
                          // move attribute
                          var attrIndex = { };
                          for(var i = 0; i < attributesOrder.length; i++)
                              attrIndex[attributesOrder[i]] = i;

                          var scriptAttributeOrder = asset.get('data.scripts.' + key + '.attributesOrder');
                          var i = scriptAttributeOrder.length;
                          while(i--) {
                              var attr = scriptAttributeOrder[i];
                              var indOld = asset.get('data.scripts.' + key + '.attributesOrder').indexOf(attr);
                              var indNew = attrIndex[attr];
                              if (indOld !== indNew)
                                  asset.move('data.scripts.' + key + '.attributesOrder', indOld, indNew);
                          }
                      }
                  }

                  asset.history.enabled = true;

                  if (fn) fn(null, result);
                  break;
          }
      };

      worker.onerror = function(err) {
          console.log('worker onerror', err);
          if (fn) fn(err);
      };

      worker.postMessage({
          name: 'parse',
          asset: asset.get('id'),
          url: asset.get('file.url'),
          engine: config.url.engine
      });
  });
});


/* editor/assets/assets-script-registry.js */
editor.once('load', function () {
  'use strict';

  if (editor.call('settings:project').get('useLegacyScripts'))
      return;


  // track all script assets
  // detect any collisions of script object within assets
  // notify about primary script asset
  // provide api to access assets by scripts and list available script objects

  var collisionScripts = {};
  var collisionStates = {};

  var assetToScripts = {};
  var scriptsList = [];
  var scripts = {};
  var scriptsPrimary = {};


  var addScript = function (asset, script) {
      var assetId = asset.get('id');

      if (!assetToScripts[assetId])
          assetToScripts[assetId] = {};

      if (assetToScripts[assetId][script]) {
          // 1. check if already indexed, then update
          editor.emit('assets:scripts:change', asset, script);
          editor.emit('assets:scripts[' + script + ']:change', asset);
          // console.log('assets:scripts:change', asset.json(), script);
      } else {
          // 2. if not indexed, then add
          assetToScripts[assetId][script] = true;
          if (!scripts[script]) scripts[script] = {};
          scripts[script][assetId] = asset;

          editor.emit('assets:scripts:add', asset, script);
          editor.emit('assets[' + asset.get('id') + ']:scripts:add', script);
          // console.log('assets:scripts:add', asset.json(), script);
      }

      // 3. check for collisions
      if (scriptsList.indexOf(script) === -1) {
          scriptsList.push(script);

          primaryScriptSet(asset, script);
      } else {
          if (!collisionScripts[script])
              collisionScripts[script] = {};

          if (!collisionScripts[script][assetId]) {
              for (var key in scripts[script]) {
                  if (!scripts[script].hasOwnProperty(key) || collisionScripts[script][key])
                      continue;

                  collisionScripts[script][key] = scripts[script][key];
              }

              checkCollisions(asset, script);
          }
      }
  };

  var removeScript = function (asset, script) {
      var assetId = asset.get('id');

      if (!assetToScripts[assetId] || !assetToScripts[assetId][script] || !scripts[script])
          return;

      delete assetToScripts[assetId][script];
      if (Object.keys(assetToScripts[assetId]).length === 0)
          delete assetToScripts[assetId];

      checkCollisions(null, script);

      delete scripts[script][assetId];
      var scriptAssets = Object.keys(scripts[script]).length;
      if (scriptAssets === 0) {
          delete scripts[script];
          var ind = scriptsList.indexOf(script);
          scriptsList.splice(ind, 1);
      } else if (collisionScripts[script] && collisionScripts[script][assetId]) {
          delete collisionScripts[script][assetId];
          var collisions = collisionScripts[script];
          if (Object.keys(collisionScripts[script]).length === 1)
              delete collisionScripts[script];

          for (var key in collisions)
              checkCollisions(collisions[key], script);
      }

      editor.emit('assets:scripts:remove', asset, script);
      editor.emit('assets[' + assetId + ']:scripts:remove', script);
      editor.emit('assets:scripts[' + script + ']:remove', asset);
      editor.emit('assets[' + assetId + ']:scripts[' + script + ']:remove');
      // console.log('assets:scripts:remove', asset.json(), script);
  };

  var checkCollisions = function (asset, script) {
      var collides = [];

      if (collisionScripts[script]) {
          for (var key in collisionScripts[script]) {
              if (!collisionScripts[script].hasOwnProperty(key))
                  continue;

              if (collisionScripts[script][key].get('preload'))
                  collides.push(collisionScripts[script][key]);
          }
      }

      if (collides.length > 1) {
          // collision occurs
          if (!collisionStates[script])
              collisionStates[script] = {};

          for (var i = 0; i < collides.length; i++) {
              var key = collides[i].get('id');
              if (collisionStates[script][key])
                  continue;

              collisionStates[script][key] = collides[i];
              editor.emit('assets:scripts:collide', collides[i], script);
              editor.emit('assets[' + key + ']:scripts:collide', script);
              editor.emit('assets:scripts[' + script + ']:collide', collides[i]);
              editor.emit('assets[' + key + ']:scripts[' + script + ']:collide');
          }

          primaryScriptSet(null, script);
      } else {
          // no collision
          if (collisionStates[script]) {
              for (var key in collisionStates[script]) {
                  if (!collisionStates[script].hasOwnProperty(key))
                      continue;

                  editor.emit('assets:scripts:resolve', collisionStates[script][key], script);
                  editor.emit('assets[' + key + ']:scripts:resolve', script);
                  editor.emit('assets:scripts[' + script + ']:resolve', collisionStates[script][key]);
                  editor.emit('assets[' + key + ']:scripts[' + script + ']:resolve');
              }

              delete collisionStates[script];
          }

          if (collides.length === 1) {
              primaryScriptSet(collides[0], script);
          } else if (asset && asset.get('preload')) {
              primaryScriptSet(asset, script);
          } else {
              primaryScriptSet(null, script);
          }
      }
  };

  var primaryScriptSet = function (asset, script) {
      if (asset === null && scriptsPrimary[script]) {
          // unset
          asset = scriptsPrimary[script];
          delete scriptsPrimary[script];
          editor.emit('assets:scripts:primary:unset', asset, script);
          editor.emit('assets[' + asset.get('id') + ']:scripts:primary:unset', script);
          editor.emit('assets:scripts[' + script + ']:primary:unset', asset);
          editor.emit('assets[' + asset.get('id') + ']:scripts[' + script + ']:primary:unset');
      } else if (asset && asset.get('preload') && (!scriptsPrimary[script] || scriptsPrimary[script] !== asset)) {
          // set
          scriptsPrimary[script] = asset;
          editor.emit('assets:scripts:primary:set', asset, script);
          editor.emit('assets[' + asset.get('id') + ']:scripts:primary:set', script);
          editor.emit('assets:scripts[' + script + ']:primary:set', asset);
          editor.emit('assets[' + asset.get('id') + ']:scripts[' + script + ']:primary:set');
      }
  };

  editor.on('assets:add', function (asset) {
      if (asset.get('type') !== 'script')
          return;

      var assetId = asset.get('id');

      // index scripts
      var scripts = asset.get('data.scripts');
      for (var key in scripts) {
          if (!scripts.hasOwnProperty(key))
              continue;

          addScript(asset, key);
      }

      // subscribe to changes
      asset.on('*:set', function (path, value, old) {
          if (path === 'preload') {
              var scripts = Object.keys(this.get('data.scripts'));
              for (var i = 0; i < scripts.length; i++)
                  checkCollisions(this, scripts[i]);

              return;
          }

          if (!path.startsWith('data.scripts.'))
              return;

          var parts = path.split('.');
          if (parts.length < 3) return;

          var script = parts[2];

          if (parts.length === 3) {
              // data.scripts.*
              addScript(asset, script);
          } else if (parts.length === 5 && parts[3] === 'attributes') {
              // data.scripts.*.attributes.*
              var attr = parts[4];
              editor.emit('assets:scripts:attribute:change', asset, script, attr, value, old);
              editor.emit('assets:scripts[' + script + ']:attribute:change', asset, attr, value, old);
          }
      });

      asset.on('*:unset', function (path, value) {
          if (!path.startsWith('data.scripts.'))
              return;

          var parts = path.split('.');
          if (parts.length < 3) return;

          var script = parts[2];

          if (parts.length === 3) // data.scripts.*
              removeScript(asset, script);
      });

      // add attribute
      asset.on('*:insert', function (path, value, ind) {
          if (!path.startsWith('data.scripts.'))
              return;

          var parts = path.split('.');
          if (parts.length !== 4 || parts[3] !== 'attributesOrder') return;

          var script = parts[2];
          editor.emit('assets:scripts:attribute:set', asset, script, value, ind);
          editor.emit('assets[' + asset.get('id') + ']:scripts:attribute:set', script, value, ind);
          editor.emit('assets:scripts[' + script + ']:attribute:set', asset, value, ind);
          editor.emit('assets[' + asset.get('id') + ']:scripts[' + script + ']:attribute:set', value, ind);
      });

      // remove attribute
      asset.on('*:remove', function (path, value) {
          if (!path.startsWith('data.scripts.'))
              return;

          var parts = path.split('.');
          if (parts.length !== 4 || parts[3] !== 'attributesOrder') return;

          var script = parts[2];
          editor.emit('assets:scripts:attribute:unset', asset, script, value);
          editor.emit('assets[' + asset.get('id') + ']:scripts:attribute:unset', script, value);
          editor.emit('assets:scripts[' + script + ']:attribute:unset', asset, value);
          editor.emit('assets[' + asset.get('id') + ']:scripts[' + script + ']:attribute:unset', value);
      });

      asset.on('*:move', function (path, value, ind, indOld) {
          if (!path.startsWith('data.scripts.'))
              return;

          var parts = path.split('.');

          if (parts.length === 4 && parts[3] === 'attributesOrder') {
              var script = parts[2];

              editor.emit('assets:scripts:attribute:move', asset, script, value, ind, indOld);
              editor.emit('assets[' + asset.get('id') + ']:scripts:attribute:move', script, value, ind, indOld);
              editor.emit('assets:scripts[' + script + ']:attribute:move', asset, value, ind, indOld);
              editor.emit('assets[' + asset.get('id') + ']:scripts[' + script + ']:attribute:move', value, ind, indOld);
          }
      });

      asset.once('destroy', function () {
          var scripts = asset.get('data.scripts');
          for (var key in scripts) {
              if (!scripts.hasOwnProperty(key))
                  continue;

              removeScript(asset, key);
          }
      });
  });

  editor.method('assets:scripts:list', function () {
      return scriptsList.slice(0);
  });

  editor.method('assets:scripts:assetByScript', function (script) {
      return scriptsPrimary[script] || null;
  });

  editor.method('assets:scripts:collide', function (script) {
      return collisionStates[script];
  });
});


/* editor/assets/assets-sprite-utils.js */
editor.once('load', function() {
  'use strict';

  // Creates new texture atlas asset from texture asset
  editor.method('assets:textureToAtlas', function (asset, callback) {
      if (asset.get('type') !== 'texture' || asset.get('source')) return;

      Ajax({
          url: '/api/assets/' + asset.get('id') + '/duplicate',
          method: 'POST',
          auth: true,
          data: {
              type: 'textureatlas',
              branchId: config.self.branch.id
          },
          headers: {
              Accept: 'application/json'
          }
      })
      .on('load', function (status, res) {
          if (callback) {
              callback(null, res.id);
          }
      })
      .on('error', function (status, res) {
          if (callback) {
              callback(status);
          } else {
              console.error('error', status, res);
          }
      });
  });

  // Creates new Sprite Asset from Texture Atlas Asset
  editor.method('assets:atlasToSprite', function (args) {
      var asset = args && args.asset;
      if (! asset || asset.get('type') !== 'textureatlas' || asset.get('source')) return;

      var sliced = args && args.sliced;

      // create a frame that covers the full atlas unless such a frame already exists
      var frames = asset.getRaw('data.frames')._data;
      var count = Object.keys(frames).length;
      var frame = null;

      var width = asset.get('meta.width') || 1;
      var height = asset.get('meta.height') || 1;

      if (count) {
          for (var key in frames) {
              // search for existing frame that covers the entire atlas
              if (frames[key]._data.rect[0] <= 0 &&
                  frames[key]._data.rect[1] <= 0 &&
                  frames[key]._data.rect[2] >= width &&
                  frames[key]._data.rect[3] >= height) {

                  frame = key;
                  break;
              }
          }
      }

      if (frame === null) {
          var maxKey = 1;
          for (var key in frames) {
              maxKey = Math.max(maxKey, parseInt(key, 10) + 1);
          }

          frame = maxKey;

          // default border to 10% of dimensions if sliced otherwise set to 0
          var horBorder = sliced ? Math.floor(0.1 * Math.max(width, height)) || 0 : 0;
          var verBorder = sliced ? Math.floor(0.1 * Math.max(width, height)) || 0 : 0;

          var history = asset.history.enabled;
          asset.history.enabled = false;
          asset.set('data.frames.' + maxKey, {
              name: 'Frame ' + maxKey,
              rect: [0, 0, width, height],
              pivot: [0.5, 0.5],
              border: [horBorder,verBorder,horBorder,verBorder]
          });
          asset.history.enabled = history;
      }

      // rendermode: 1 - sliced, 0 - simple
      var renderMode = sliced ? 1 : 0;
      // default ppu to 1 if we're using sliced mode otherwise default to
      // 100 which is better for world-space sprites
      var ppu = sliced ? 1 : 100;

      // get atlas asset name without extension
      var name = asset.get('name');
      var lastDot = name.lastIndexOf('.');
      if (lastDot > 0) {
          name = name.substring(0, lastDot);
      }

      editor.call('assets:create:sprite', {
          name: name,
          pixelsPerUnit: ppu,
          renderMode: renderMode,
          frameKeys: [frame],
          textureAtlasAsset: asset.get('id'),
          fn: args && args.callback
      });
  });

});


/* editor/assets/assets-bundles.js */
editor.once('load', function () {
  'use strict';

  var INVALID_TYPES = ['script', 'folder', 'bundle'];

  // stores <asset id, [bundle assets]> index for mapping
  // any asset it to the bundles that it's referenced from
  var bundlesIndex = {};

  // stores all bundle assets
  var bundleAssets = [];

  var addToIndex = function (assetIds, bundleAsset) {
      if (! assetIds) return;

      for (var i = 0; i < assetIds.length; i++) {
          if (! bundlesIndex[assetIds[i]]) {
              bundlesIndex[assetIds[i]] = [bundleAsset];
              editor.emit('assets:bundles:insert', bundleAsset, assetIds[i]);
          } else {
              if (bundlesIndex[assetIds[i]].indexOf(bundleAsset) === -1) {
                  bundlesIndex[assetIds[i]].push(bundleAsset);
                  editor.emit('assets:bundles:insert', bundleAsset, assetIds[i]);
              }
          }
      }
  };

  // fill bundlexIndex when a new bundle asset is added
  editor.on('assets:add', function (asset) {
      if (asset.get('type') !== 'bundle') return;

      bundleAssets.push(asset);
      addToIndex(asset.get('data.assets'), asset);

      asset.on('data.assets:set', function (assetIds) {
          addToIndex(assetIds, asset);
      });

      asset.on('data.assets:insert', function (assetId) {
          addToIndex([assetId], asset);
      });

      asset.on('data.assets:remove', function (assetId) {
          if (! bundlesIndex[assetId]) return;
          var idx = bundlesIndex[assetId].indexOf(asset);
          if (idx !== -1) {
              bundlesIndex[assetId].splice(idx, 1);
              editor.emit('assets:bundles:remove', asset, assetId);
              if (! bundlesIndex[assetId].length) {
                  delete bundlesIndex[assetId];
              }
          }
      });
  });

  // remove bundle asset from bundlesIndex when a bundle asset is
  // removed
  editor.on('assets:remove', function (asset) {
      if (asset.get('type') !== 'bundle') return;

      var idx = bundleAssets.indexOf(asset);
      if (idx !== -1) {
          bundleAssets.splice(idx, 1);
      }

      for (var id in bundlesIndex) {
          idx = bundlesIndex[id].indexOf(asset);
          if (idx !== -1) {
              bundlesIndex[id].splice(idx, 1);
              editor.emit('assets:bundles:remove', asset, id);

              if (! bundlesIndex[id].length) {
                  delete bundlesIndex[id];
              }
          }
      }
  });

  /**
   * Returns all of the bundle assets for the specified asset
   * @param {Observer} asset The asset
   * @returns {Observer[]} The bundles for the asset or an empty array.
   */
  editor.method('assets:bundles:listForAsset', function (asset) {
      return bundlesIndex[asset.get('id')] || [];
  });

  /**
   * Returns a list of all the bundle assets
   * @returns {Observer[]} The bundle assets
   */
  editor.method('assets:bundles:list', function () {
      return bundleAssets.slice();
  });

  /**
   * Returns true if the specified asset id is in a bundle
   * @returns {Boolean} True of false
   */
  editor.method('assets:bundles:containAsset', function (assetId) {
      return !!bundlesIndex[assetId];
  });

  var isAssetValid = function (asset, bundleAsset) {
      var id = asset.get('id');
      if (asset.get('source')) return false;
      if (INVALID_TYPES.indexOf(asset.get('type')) !== -1) return false;

      if (bundleAsset) {
          var existingAssetIds = bundleAsset.getRaw('data.assets');
          if (existingAssetIds.indexOf(id) !== -1) return false;
      }

      return true;
  };

  /**
   * Checks if the specified asset is valid to be added to a bundle
   * with the specified existing asset ids
   */
  editor.method('assets:bundles:canAssetBeAddedToBundle', isAssetValid);

  /**
   * Adds assets to the bundle asset. Does not add already existing
   * assets or assets with invalid types.
   * @param {Observer[]} assets The assets to add to the bundle
   * @param {Observer} bundleAsset The bundle asset
   */
  editor.method('assets:bundles:addAssets', function (assets, bundleAsset) {
      var validAssets = assets.filter(function (asset) {
          return isAssetValid(asset, bundleAsset);
      });

      var len = validAssets.length;
      if (!len) return;

      var undo = function () {
          var asset = editor.call('assets:get', bundleAsset.get('id'));
          if (! asset) return;

          var history = asset.history.enabled;
          asset.history.enabled = false;
          for (var i = 0; i < len; i++) {
              asset.removeValue('data.assets', validAssets[i].get('id'));
          }
          asset.history.enabled = history;
      };

      var redo = function () {
          var asset = editor.call('assets:get', bundleAsset.get('id'));
          if (! asset) return;

          var history = asset.history.enabled;
          asset.history.enabled = false;
          for (var i = 0; i < len; i++) {
              if (isAssetValid(validAssets[i], asset)) {
                  asset.insert('data.assets', validAssets[i].get('id'));
              }
          }
          asset.history.enabled = history;
      };

      redo();

      editor.call('history:add', {
          name: 'asset.' + bundleAsset.get('id') + '.data.assets',
          undo: undo,
          redo: redo
      });

      return len;
  });

  /**
   * Removes the specified assets from the specified bundle asset
   * @param {Observer[]} assets The assets to remove
   * @param {Observer} bundleAsset The bundle asset
   */
  editor.method('assets:bundles:removeAssets', function (assets, bundleAsset) {
      var redo = function () {
          var asset = editor.call('assets:get', bundleAsset.get('id'));
          if (! asset) return;

          var history = asset.history.enabled;
          asset.history.enabled = false;
          for (var i = 0; i < assets.length; i++) {
              asset.removeValue('data.assets', assets[i].get('id'));
          }
          asset.history.enabled = history;
      };

      var undo = function () {
          var asset = editor.call('assets:get', bundleAsset.get('id'));
          if (! asset) return;

          var history = asset.history.enabled;
          asset.history.enabled = false;
          for (var i = 0; i < assets.length; i++) {
              if (isAssetValid(assets[i], asset)) {
                  asset.insert('data.assets', assets[i].get('id'));
              }
          }
          asset.history.enabled = history;
      };

      redo();

      editor.call('history:add', {
          name: 'asset.' + bundleAsset.get('id') + '.data.assets',
          undo: undo,
          redo: redo
      });
  });

  /**
   * Calculates the file size of a bundle Asset by adding up the file
   * sizes of all the assets it references.
   * @param {Observer} The bundle asset
   * @returns {Number} The file size
   */
  editor.method('assets:bundles:calculateSize', function (bundleAsset) {
      var size = 0;
      var assets = bundleAsset.get('data.assets');
      for (var i = 0; i < assets.length; i++) {
          var asset = editor.call('assets:get', assets[i]);
          if (! asset || !asset.has('file.size')) continue;

          size += asset.get('file.size');
      }
      return size;
  });
});


/* editor/assets/assets-store.js */
editor.once('load', function () {
  'use strict';

  var assetsPanel = editor.call('layout.assets');

  var btnStore = new ui.Button({
      text: "Library"
  });
  btnStore.class.add('store');
  assetsPanel.header.append(btnStore);

  btnStore.on('click', function () {
      window.open('https://store.playcanvas.com/', '_blank');
  });
});


/* editor/project/project-scripts-order.js */
editor.once('load', function() {
  'use strict';

  if (editor.call('settings:project').get('useLegacyScripts'))
      return;

  var foldStates = {
      'scripts': true
  };

  var projectSettings = editor.call('settings:project');


  editor.on('attributes:inspect[editorSettings]', function() {
      var events = [ ];

      // scripts order
      var panel = editor.call('attributes:addPanel', {
          name: 'Scripts Loading Order'
      });
      panel.foldable = true;
      panel.folded = foldStates['scripts'];
      panel.on('fold', function() { foldStates['scripts'] = true; });
      panel.on('unfold', function() { foldStates['scripts'] = false; });
      panel.class.add('component', 'scripts-order');
      panel.element.tabIndex = 0;


      var panelItems = new ui.Panel();
      panelItems.class.add('scripts-order');
      panel.append(panelItems);

      var itemsIndex = { };
      var dragPlaceholder = null;
      var dragInd = null;
      var dragOut = true;
      var dragItem = null;
      var dragItemInd = null;
      var dragItems = [ ];

      // drop area
      var target = editor.call('drop:target', {
          ref: panelItems.innerElement,
          type: 'script-order',
          hole: true,
          passThrough: true
      });
      target.element.style.outline = '1px dotted #f60';
      panelItems.once('drestroy', function() {
          target.unregister();
      });

      var dragCalculateSizes = function() {
          dragItems = [ ];
          var children = panelItems.innerElement.children;

          for(var i = 0; i < children.length; i++) {
              var item = children[i].ui ? children[i].ui.assetId : children[i].assetId;

              dragItems.push({
                  item: item,
                  ind: projectSettings.get('scripts').indexOf(item),
                  y: children[i].offsetTop,
                  height: children[i].clientHeight
              });
          }
      };
      var onItemDragStart = function(evt) {
          // dragend
          window.addEventListener('blur', onItemDragEnd, false);
          window.addEventListener('mouseup', onItemDragEnd, false);
          window.addEventListener('mouseleave', onItemDragEnd, false);
          document.body.addEventListener('mouseleave', onItemDragEnd, false);
          // dragmove
          window.addEventListener('mousemove', onItemDragMove, false);

          itemsIndex[dragItem].class.add('dragged');

          dragCalculateSizes();
          for(var i = 0; i < dragItems.length; i++) {
              if (dragItems[i].item === dragItem)
                  dragItemInd = i;
          }

          var panel = itemsIndex[dragItem];
          var parent = panel.element.parentNode;
          dragPlaceholder = document.createElement('div');
          dragPlaceholder.assetId = dragItem;
          dragPlaceholder.classList.add('dragPlaceholder');
          dragPlaceholder.style.height = (dragItems[dragItemInd].height - 8) + 'px';
          parent.insertBefore(dragPlaceholder, panel.element);
          parent.removeChild(panel.element);

          onItemDragMove(evt);

          editor.call('drop:set', 'script-order', { asset: dragItem });
          editor.call('drop:activate', true);
      };
      var onItemDragMove = function(evt) {
          if (! dragItem) return;

          var rect = panelItems.innerElement.getBoundingClientRect();

          dragOut = (evt.clientX < rect.left || evt.clientX > rect.right || evt.clientY < rect.top || evt.clientY > rect.bottom);

          if (! dragOut) {
              var y = evt.clientY - rect.top;
              var ind = null;
              var height = dragPlaceholder.clientHeight;

              var c = 0;
              for(var i = 0; i < dragItems.length; i++) {
                  if (dragItems[i].item === dragItem) {
                      c = i;
                      break;
                  }
              }

              // hovered item
              for(var i = 0; i < dragItems.length; i++) {
                  var off = Math.max(0, dragItems[i].height - height);
                  if (c < i) {
                      if (y >= (dragItems[i].y + off) && y <= (dragItems[i].y + dragItems[i].height)) {
                          ind = i;
                          if (ind > dragItemInd) ind++;
                          break;
                      }
                  } else {
                      if (y >= dragItems[i].y && y <= (dragItems[i].y + dragItems[i].height - off)) {
                          ind = i;
                          if (ind > dragItemInd) ind++;
                          break;
                      }
                  }
              }

              if (ind !== null && dragInd !== ind) {
                  dragInd = ind;

                  var parent = dragPlaceholder.parentNode;
                  parent.removeChild(dragPlaceholder);

                  var ind = dragInd;
                  if (ind > dragItemInd) ind--;
                  var next = parent.children[ind];

                  if (next) {
                      parent.insertBefore(dragPlaceholder, next);
                  } else {
                      parent.appendChild(dragPlaceholder);
                  }

                  dragCalculateSizes();
              }
          } else {
              dragInd = dragItemInd;
              var parent = dragPlaceholder.parentNode;
              parent.removeChild(dragPlaceholder);
              var next = parent.children[dragItemInd];
              if (next) {
                  parent.insertBefore(dragPlaceholder, next);
              } else {
                  parent.appendChild(dragPlaceholder);
              }
              dragCalculateSizes();
          }
      };
      var onItemDragEnd = function() {
          // dragend
          window.removeEventListener('blur', onItemDragEnd);
          window.removeEventListener('mouseup', onItemDragEnd);
          window.removeEventListener('mouseleave', onItemDragEnd);
          document.body.removeEventListener('mouseleave', onItemDragEnd);
          // dragmove
          window.removeEventListener('mousemove', onItemDragMove);

          if (dragItem) {
              itemsIndex[dragItem].class.remove('dragged');

              var panel = itemsIndex[dragItem];
              panelItems.innerElement.removeChild(dragPlaceholder);
              var next = panelItems.innerElement.children[dragItemInd];
              if (next) {
                  panelItems.innerElement.insertBefore(panel.element, next);
              } else {
                  panelItems.innerElement.appendChild(panel.element);
              }

              if (! dragOut && dragInd !== null && dragInd !== dragItemInd && dragInd !== (dragItemInd + 1)) {
                  var ind = dragInd;
                  if (ind > dragItemInd) ind--;
                  projectSettings.move('scripts', dragItemInd, ind);

                  var data = {
                      item: dragItem,
                      indNew: ind,
                      indOld: dragItemInd
                  };

                  editor.call('history:add', {
                      name: 'project.scripts.move',
                      undo: function() {
                          var indOld = projectSettings.get('scripts').indexOf(data.item);
                          if (indOld === -1) return;
                          projectSettings.move('scripts', indOld, data.indOld);
                      },
                      redo: function() {
                          var indOld = projectSettings.get('scripts').indexOf(data.item);
                          if (indOld === -1) return;
                          projectSettings.move('scripts', indOld, data.indNew);
                      }
                  });
              }
          }

          dragItem = null;
          dragItems = [ ];
          dragInd = null;

          editor.call('drop:activate', false);
          editor.call('drop:set');
      };


      var assetFullSet = function() {
          var scripts = projectSettings.get('scripts');

          // clear panel
          var first = panelItems.innerElement.firstChild;
          while(first) {
              panelItems.innerElement.removeChild(first);
              first = panelItems.innerElement.firstChild;
          }

          // reappend
          for(var i = 0; i < scripts.length; i++) {
              if (itemsIndex[scripts[i]]) {
                  panelItems.innerElement.appendChild(itemsIndex[scripts[i]].element);
              } else {
                  assetAdd(scripts[i]);
              }
          }

          assetUpdateNumbers();
      };


      var assetUpdateNumbers = function() {
          var children = panelItems.innerElement.children;
          for(var i = 0; i < children.length; i++)
              children[i].ui.number.textContent = i + 1;
      };


      var assetAdd = function(assetId, ind) {
          var events = [ ];
          var asset = editor.call('assets:get', assetId);
          if (! asset)
              return;

          assetId = parseInt(assetId, 10);

          if (itemsIndex[assetId])
              return;

          var panel = itemsIndex[assetId] = new ui.Panel();
          panel.header = asset.get('name');
          panel.assetId = assetId;
          panel.class.add('asset');

          panel.headerElement.addEventListener('click', function() {
              editor.call('selector:set', 'asset', [ asset ]);
          }, false);

          // name
          events.push(asset.on('name:set', function(value) {
              panel.header = value;
          }));

          // number
          panel.number = document.createElement('div');
          panel.number.classList.add('number');
          panel.number.textContent = projectSettings.get('scripts').indexOf(assetId) + 1;
          panel.headerAppend(panel.number);

          // handle
          panel.handle = document.createElement('div');
          panel.handle.classList.add('handle');
          panel.handle.addEventListener('mousedown', function(evt) {
              evt.stopPropagation();
              evt.preventDefault();

              dragItem = panel.assetId;
              onItemDragStart(evt);
          }, false);
          panel.headerAppend(panel.handle);

          // position
          var next = null;
          if (typeof(ind) === 'number')
              next = panelItems.innerElement.children[ind];

          if (next) {
              panelItems.appendBefore(panel, next);
          } else {
              panelItems.append(panel);
          }

          panel.once('destroy', function() {
              for(var i = 0; i < events.length; i++)
                  events[i].unbind();

              events = null;
          });
      };


      var assetMove = function(assetId, ind) {
          var panel = itemsIndex[assetId];
          if (! panel) return;

          panelItems.innerElement.removeChild(panel.element);
          var next = panelItems.innerElement.children[ind];

          if (next) {
              panelItems.innerElement.insertBefore(panel.element, next);
          } else {
              panelItems.innerElement.appendChild(panel.element);
          }

          assetUpdateNumbers();
      };


      var assetRemove = function(assetId) {
          if (! itemsIndex[assetId])
              return;

          itemsIndex[assetId].destroy();
          delete itemsIndex[assetId];

          assetUpdateNumbers();
      };

      // get assets
      var assets = projectSettings.get('scripts') || [ ];

      // remove null assets
      if (editor.call('permissions:write')) {
          var i = assets.length;
          while(i--) {
              if (assets[i] === null)
                  projectSettings.remove('scripts', i);
          }
      }

      // add assets
      for(var i = 0; i < assets.length; i++)
          assetAdd(assets[i]);


      // on add
      events.push(projectSettings.on('scripts:insert', function(assetId, ind) {
          assetAdd(assetId, ind);
      }));
      // on move
      events.push(projectSettings.on('scripts:move', function(assetId, ind) {
          assetMove(parseInt(assetId, 10), ind);
      }));
      // on remove
      events.push(projectSettings.on('scripts:remove', function(assetId) {
          assetRemove(parseInt(assetId, 10));
      }));
      // on set
      events.push(projectSettings.on('scripts:set', function() {
          assetFullSet();
      }));
      // on asset add
      events.push(editor.on('assets:add', function(asset) {
          if (asset.get('type') !== 'script') return;

          var assetId = parseInt(asset.get('id'), 10);
          if (projectSettings.get('scripts').indexOf(assetId) !== -1)
              assetAdd(assetId);
      }));


      panel.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();

          events = null;
      });
  });
});