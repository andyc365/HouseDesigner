

/* editor/selector/selector.js */
editor.once('load', function() {
  'use strict';

  var enabled = true;
  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');
  var selector = new ObserverList();
  selector.type = null;


  var index = { };

  var keyByType = function(type) {
      switch(type) {
          case 'entity':
              return 'resource_id';
          case 'asset':
              return 'id';
      }
      return null;
  };

  var setIndex = function(type, item) {
      var key = keyByType(type);
      if (! key) return;

      if (! index[type])
          index[type] = { };

      index[type][item.get[key]] = item.once('destroy', function() {
          var state = editor.call('selector:history');
          if (state)
              editor.call('selector:history', false);

          selector.remove(item);
          delete index[type][item.get[key]];

          if (state)
              editor.call('selector:history', true);
      });
  };

  var removeIndex = function(type, item) {
      if (! index[type]) return;

      var key = keyByType(type);
      if (! key) return;

      var ind = index[type][item.get[key]];
      if (! ind) return;

      ind.unbind();
  };

  var evtChange = false;
  var evtChangeFn = function() {
      evtChange = false;
      editor.emit('selector:change', selector.type, selector.array());
  };

  // adding
  selector.on('add', function(item) {
      // add index
      setIndex(this.type, item);

      editor.emit('selector:add', item, this.type);

      if (! evtChange) {
          evtChange = true;
          setTimeout(evtChangeFn, 0);
      }
  });


  // removing
  selector.on('remove', function(item) {
      editor.emit('selector:remove', item, this.type);

      // remove index
      removeIndex(this.type, item);

      if (this.length === 0)
          this.type = null;

      if (! evtChange) {
          evtChange = true;
          setTimeout(evtChangeFn, 0);
      }
  });


  // selecting item (toggle)
  editor.method('selector:toggle', function(type, item) {
      if (! enabled)
          return;

      if (selector.length && selector.type !== type) {
          selector.clear();
      }
      selector.type = type;

      if (selector.has(item)) {
          selector.remove(item);
      } else {
          selector.add(item);
      }
  });


  // selecting list of items
  editor.method('selector:set', function(type, items) {
      if (! enabled)
          return;

      selector.clear();

      if (! type || ! items.length)
          return;

      // make sure items still exist
      if (type === 'asset') {
          items = items.filter(function(item) {
              return (legacyScripts && item.get('type') === 'script') || !! editor.call('assets:get', item.get('id'));
          });
      } else if (type === 'entity') {
          items = items.filter(function(item) {
              return !! editor.call('entities:get', item.get('resource_id'));
          });
      }

      if (! items.length)
          return;

      // type
      selector.type = type;

      // remove
      selector.find(function(item) {
          return items.indexOf(item) === -1;
      }).forEach(function(item) {
          selector.remove(item);
      });

      // add
      for(var i = 0; i < items.length; i++)
          selector.add(items[i]);
  });


  // selecting item
  editor.method('selector:add', function(type, item) {
      if (! enabled)
          return;

      if (selector.has(item))
          return;

      if (selector.length && selector.type !== type)
          selector.clear();

      selector.type = type;
      selector.add(item);
  });


  // deselecting item
  editor.method('selector:remove', function(item) {
      if (! enabled)
          return;

      if (! selector.has(item))
          return;

      selector.remove(item);
  });


  // deselecting
  editor.method('selector:clear', function(item) {
      if (! enabled)
          return;

      selector.clear();
  });


  // return select type
  editor.method('selector:type', function() {
      return selector.type;
  });


  // return selected count
  editor.method('selector:count', function() {
      return selector.length;
  });


  // return selected items
  editor.method('selector:items', function() {
      return selector.array();
  });

  // return selected items without making copy of array
  editor.method('selector:itemsRaw', function() {
      return selector.data;
  });

  // return if it has item
  editor.method('selector:has', function(item) {
      return selector.has(item);
  });


  editor.method('selector:enabled', function(state) {
      enabled = state;
  });
});


/* editor/selector/selector-sync.js */
editor.once('load', function() {
  'use strict';

  var lastSelectionType = null;
  var lastIds = [ ];
  var selection = { };
  var timeout;
  var lastCheck = 0;


  var checkSelector = function() {
      timeout = null;
      lastCheck = Date.now();

      var type = editor.call('selector:type');
      var items = editor.call('selector:items');

      var selectionType = editor.call('selector:type');
      var ids = [ ];

      if (type === 'entity') {
          for(var i = 0; i < items.length; i++)
              ids.push(items[i].get('resource_id'));
      } else if (type === 'asset') {
          for(var i = 0; i < items.length; i++) {
              var id = items[i].get('id');
              if (items[i].get('type') === 'script' && ! id) {
                  ids.push(items[i].get('filename'));
              } else {
                  ids.push(id);
              }
          }
      } else if (type === 'editorSettings') {
          // editor settings always single
      } else {
          selectionType = null;
      }

      var changed = false;
      if (lastSelectionType !== selectionType)
          changed = true;

      if (! changed) {
          if (ids.length !== lastIds.length) {
              changed = true;
          } else {
              for(var i = 0; i < ids.length; i++) {
                  if (ids[i] !== lastIds[i]) {
                      changed = true;
                      break;
                  }
              }
          }
      }

      lastSelectionType = selectionType;
      lastIds = ids;

      if (changed) {
          editor.call('realtime:send', 'selection', {
              t: selectionType,
              ids: ids
          });
      }
  };

  editor.on('selector:change', function(type, items) {
      if (timeout)
          return;

      if ((Date.now() - lastCheck) > 500) {
          checkSelector();
      } else {
          timeout = setTimeout(checkSelector, 500);
      }
  });

  editor.on('selector:sync:raw', function(data) {
      data = JSON.parse(data);
      var id = data.u;

      // select
      selection[id] = {
          type: data.t,
          ids: data.ids
      };

      editor.emit('selector:sync[' + id + ']', selection[id]);
      editor.emit('selector:sync', id, selection[id]);
  });
});


/* editor/selector/selector-history.js */
editor.once('load', function() {
  'use strict';

  var selectorHistory = true;
  var changing = false;

  var newType = editor.call('selector:type');
  var newItems = editor.call('selector:items');

  var onSelectorChange = function() {
      changing = false;

      var oldType = newType;
      var oldItems = newItems;

      var type = editor.call('selector:type');
      var items = editor.call('selector:items');

      newType = type;
      newItems = items;

      editor.call('history:add', {
          name: (items.length === 0) ? 'deselect' : ('select ' + type),
          select: true,
          undo: function() {
              var prev = selectorHistory;
              selectorHistory = false;
              editor.call('selector:set', oldType, oldItems);
              editor.once('selector:change', function() {
                  selectorHistory = prev;
              });
          },
          redo: function() {
              var prev = selectorHistory;
              selectorHistory = false;
              editor.call('selector:set', type, items);
              editor.once('selector:change', function() {
                  selectorHistory = prev;
              });
          }
      });
  };

  editor.on('selector:change', function(type, items) {
      if (! selectorHistory) {
          newType = type;
          newItems = items;
          return;
      }

      if (changing)
          return;

      changing = true;
      setTimeout(onSelectorChange, 0);
  });

  editor.method('selector:history', function (toggle) {
      if (toggle === undefined)
          return selectorHistory;

      selectorHistory = toggle;
  });
});
