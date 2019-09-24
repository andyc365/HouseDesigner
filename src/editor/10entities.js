


/* editor/entities/entities.js */
editor.once('load', function() {
  'use strict';

  var entities = new ObserverList({
      index: 'resource_id'
  });

  var entityRoot = null;

  // on adding
  entities.on('add', function(entity) {
      editor.emit('entities:add', entity, entity === entityRoot);
  });

  // on removing
  entities.on('remove', function(entity) {
      editor.emit('entities:remove', entity);
      entity.destroy();
      entity.entity = null;
  });


  // allow adding entity
  editor.method('entities:add', function(entity) {
      if (! entity.get('parent'))
          entityRoot = entity;

      entities.add(entity);
  });

  // allow remove entity
  editor.method('entities:remove', function(entity) {
      entities.remove(entity);
  });

  // remove all entities
  editor.method('entities:clear', function () {
      entities.clear();
  });

  // get entity
  editor.method('entities:get', function(resourceId) {
      return entities.get(resourceId);
  });


  // list entities
  editor.method('entities:list', function() {
      return entities.array();
  });


  // get root entity
  editor.method('entities:root', function () {
      return entityRoot;
  });

});


/* editor/entities/entities-selection.js */
editor.once('load', function() {
  'use strict';

  // returns all selected entities
  editor.method('entities:selection', function () {
      if (editor.call('selector:type') !== 'entity')
          return [ ];

      return editor.call('selector:items').slice(0);
  });

  // returns first selected entity
  editor.method('entities:selectedFirst', function () {
      var selection = editor.call('entities:selection');
      if (selection.length) {
          return selection[0];
      } else {
          return null;
      }
  });
});


/* editor/entities/entities-edit.js */
editor.once('load', function () {
  'use strict';

  // An index where the key is the guid
  // of a child entity and the value is the guid of
  // a parent entity
  var childToParent = {};


  // An index where the key is the guid of
  // a deleted entity and the value is the JSON
  // representation of the entity at the time when
  // it was deleted. Used to re-create entities from
  // this cache instead of re-creating it from scratch
  var deletedCache = {};

  // Attach event listeners on a new entity.
  // Maintains the childToParent index
  editor.on('entities:add', function (entity) {
      var children = entity.get('children');
      for (var i = 0; i < children.length; i++)
          childToParent[children[i]] = entity.get('resource_id');

      entity.on('children:insert', function (value) {
          childToParent[value] = entity.get('resource_id');
      });
      entity.on('children:remove', function (value) {
          delete childToParent[value];
      });
  });

  /**
   * Updates entity references to the old entity to point to the new entity (which could also be null)
   * @param {Object} entityReferencesMap See addEntity
   * @param {String} oldValue The resource id that we want to replace
   * @param {String} newValue The new resource id that we want our references to point to
   */
  var updateEntityReferenceFields = function (entityReferencesMap, oldValue, newValue) {
      var referencesToThisEntity = entityReferencesMap[oldValue];
      if (! referencesToThisEntity) return;

      referencesToThisEntity.forEach(function (reference) {
          var sourceEntity = editor.call('entities:get', reference.sourceEntityGuid);
          if (! sourceEntity) return;

          var prevHistory = sourceEntity.history.enabled;
          sourceEntity.history.enabled = false;
          sourceEntity.set('components.' + reference.componentName + '.' + reference.fieldName, newValue);
          sourceEntity.history.enabled = prevHistory;
      });
  };

  /**
   * Adds an entity to the scene.
   * @param {Observer} entity The entity
   * @param {Observer} parent The parent of the entity
   * @param {Boolean} select Whether to select the new entity after it's added
   * @param {Number} ind The index in the parent's children array where we want to insert the entity
   * @param {Object} entityReferencesMap A dictionary holding references to entities
   * that need to be updated if we undo adding this entity. The format of this object looks like so:
   * targetResourceId: {
   *   sourceEntityGuid: GUID,
   *   componentName: String,
   *   fieldName: String
   * }
   */
  var addEntity = function (entity, parent, select, ind, entityReferencesMap) {
      entityReferencesMap = entityReferencesMap || {};

      childToParent[entity.get('resource_id')] = parent.get('resource_id');

      var children = entity.get('children');
      if (children.length)
          entity.set('children', []);

      // call add event
      editor.call('entities:add', entity);

      // shareDb
      editor.call('realtime:scene:op', {
          p: ['entities', entity.get('resource_id')],
          oi: entity.json()
      });

      // this is necessary for the entity to be added to the tree view
      parent.history.enabled = false;
      parent.insert('children', entity.get('resource_id'), ind);
      parent.history.enabled = true;

      if (select) {
          setTimeout(function () {
              editor.call('selector:history', false);
              editor.call('selector:set', 'entity', [entity]);
              editor.once('selector:change', function () {
                  editor.call('selector:history', true);
              });
          }, 0);
      }

      // add children too
      children.forEach(function (childIdOrData) {
          var data;

          // If we've been provided an id, we're re-creating children from the deletedCache
          if (typeof childIdOrData === 'string') {
              data = deletedCache[childIdOrData];
              if (!data) {
                  return;
              }
              // If we've been provided an object, we're creating children for a new entity
          } else if (typeof childIdOrData === 'object') {
              data = childIdOrData;
          } else {
              throw new Error('Unhandled childIdOrData format');
          }

          var child = new Observer(data);
          addEntity(child, entity, undefined, undefined, entityReferencesMap);
      });

      // Hook up any entity references which need to be pointed to this newly created entity
      // (happens when addEntity() is being called during the undoing of a deletion). In order
      // to force components to respond to the setter call even when they are running in other
      // tabs or in the Launch window, we unfortunately have to use a setTimeout() hack :(
      var guid = entity.get('resource_id');

      // First set all entity reference fields targeting this guid to null
      updateEntityReferenceFields(entityReferencesMap, guid, null);
      setTimeout(function () {
          // Then update the same fields to target the guid again
          updateEntityReferenceFields(entityReferencesMap, guid, guid);
      }, 0);

      if (entity.get('__postCreationCallback')) {
          entity.get('__postCreationCallback')(entity);
      }
  };

  /**
   * Removes an entity from the scene
   * @param {Observer} entity The entity
   * @param {Object} entityReferencesMap Holds references to entities that need to be updated when
   * this entity is removed. See addEntity for more.
   */
  var removeEntity = function (entity, entityReferencesMap) {
      entityReferencesMap = entityReferencesMap || {};
      deletedCache[entity.get('resource_id')] = entity.json();

      // Nullify any entity references which currently point to this guid
      updateEntityReferenceFields(entityReferencesMap, entity.get('resource_id'), null);

      // remove children
      entity.get('children').forEach(function (child) {
          var entity = editor.call('entities:get', child);
          if (!entity)
              return;

          removeEntity(entity, entityReferencesMap);
      });

      if (editor.call('selector:type') === 'entity' && editor.call('selector:items').indexOf(entity) !== -1) {
          editor.call('selector:history', false);
          editor.call('selector:remove', entity);
          editor.once('selector:change', function () {
              editor.call('selector:history', true);
          });
      }

      // remove from parent
      var parentId = childToParent[entity.get('resource_id')];
      if (parentId) {
          var parent = editor.call('entities:get', parentId);
          if (parent) {
              parent.history.enabled = false;
              parent.removeValue('children', entity.get('resource_id'));
              parent.history.enabled = true;
          }
      }

      // call remove method
      editor.call('entities:remove', entity);

      // sharedb
      editor.call('realtime:scene:op', {
          p: ['entities', entity.get('resource_id')],
          od: {}
      });
  };

  // Expose methods
  editor.method('entities:addEntity', addEntity);
  editor.method('entities:removeEntity', removeEntity);

  /**
   * Gets the resource id of the parent of the entityh with the specified resource id.
   * @param {String} childResourceId The resource id of an entity
   * @returns {String} The resource id of the entity's parent
   */
  editor.method('entities:getParentResourceId', function (childResourceId) {
      return childToParent[childResourceId];
  });

  /**
   * Updates the childToParent map with a new child-parent resource id pair. Used
   * from other methods that edit the scene hierarchy.
   * @param {String} childResourceId The resource id of the child entity
   * @param {String} parentResourceId The resource id of the parent entity
   */
  editor.method('entities:updateChildToParentIndex', function (childResourceId, parentResourceId) {
      childToParent[childResourceId] = parentResourceId;
  });

  /**
   * Gets an entity from the deleted cache
   * @returns {Observer} The deleted entity
   */
  editor.method('entities:getFromDeletedCache', function (resourceId) {
      return deletedCache[resourceId];
  });
});


/* editor/entities/entities-addComponent.js */
editor.once('load', function () {
  'use strict';

  var settings = editor.call('settings:project');

  /**
   * Adds the specified component to the specified entities.
   * @param {Observer[]} entities The entities
   * @param {String} component The name of the component
   */
  editor.method('entities:addComponent', function (entities, component) {
      var componentData = editor.call('components:getDefault', component);
      var records = [];

      for (var i = 0; i < entities.length; i++) {
          if (entities[i].has('components.' + component))
              continue;

          records.push({
              get: entities[i].history._getItemFn,
              value: componentData
          });

          entities[i].history.enabled = false;
          entities[i].set('components.' + component, componentData);
          entities[i].history.enabled = true;
      }

      // if it's a collision or rigidbody component then enable physics
      if (component === 'collision' || component === 'rigidbody') {
          var history = settings.history.enabled;
          settings.history.enabled = false;
          settings.set('use3dPhysics', true);
          settings.history.enabled = history;
      }

      editor.call('history:add', {
          name: 'entities.' + component,
          undo: function () {
              for (var i = 0; i < records.length; i++) {
                  var item = records[i].get();
                  if (!item)
                      continue;
                  item.history.enabled = false;
                  item.unset('components.' + component);
                  item.history.enabled = true;
              }
          },
          redo: function () {
              for (var i = 0; i < records.length; i++) {
                  var item = records[i].get();
                  if (!item)
                      continue;
                  item.history.enabled = false;
                  item.set('components.' + component, records[i].value);
                  item.history.enabled = true;
              }
          }
      });
  });
});


/* editor/entities/entities-create.js */
editor.once('load', function () {
  'use strict';

  var createNewEntityData = function (defaultData, parentResourceId) {
      var entityData = {
          name: defaultData.name || 'New Entity',
          tags: [],
          enabled: true,
          resource_id: pc.guid.create(),
          parent: parentResourceId,
          children: [],
          position: defaultData.position || [0, 0, 0],
          rotation: defaultData.rotation || [0, 0, 0],
          scale: defaultData.scale || [1, 1, 1],
          components: defaultData.components || {},
          __postCreationCallback: defaultData.postCreationCallback
      };

      if (defaultData.children) {
          for (var i = 0; i < defaultData.children.length; i++) {
              var childEntityData = createNewEntityData(defaultData.children[i], entityData.resource_id);
              entityData.children.push(childEntityData);
          }
      }

      return entityData;
  };

  /**
   * Creates a new entity.
   * @param {Object} defaultData The default entity data. This can also define a postCreationCallback argument at each level, which is
   * designed for cases where composite entity hierarchies need some post-processing, and the
   * post processing needs to be done both in the case of initial creation and also the case
   * of undo/redo.
   * @returns {Observer} The new entity
   */
  editor.method('entities:new', function (defaultData) {
      // get root if parent is null
      defaultData = defaultData || {};
      var parent = defaultData.parent || editor.call('entities:root');

      var data = createNewEntityData(defaultData, parent.get('resource_id'));

      var selectorType, selectorItems;

      if (!defaultData.noHistory) {
          selectorType = editor.call('selector:type');
          selectorItems = editor.call('selector:items');
          if (selectorType === 'entity') {
              for (var i = 0; i < selectorItems.length; i++)
                  selectorItems[i] = selectorItems[i].get('resource_id');
          }
      }

      // create new Entity data
      var entity = new Observer(data);
      editor.call('entities:addEntity', entity, parent, !defaultData.noSelect);

      // history
      if (!defaultData.noHistory) {
          var resourceId = entity.get('resource_id');
          var parentId = parent.get('resource_id');

          editor.call('history:add', {
              name: 'new entity ' + resourceId,
              undo: function () {
                  var entity = editor.call('entities:get', resourceId);
                  if (!entity)
                      return;

                  editor.call('entities:removeEntity', entity);

                  if (selectorType === 'entity' && selectorItems.length) {
                      var items = [];
                      for (var i = 0; i < selectorItems.length; i++) {
                          var item = editor.call('entities:get', selectorItems[i]);
                          if (item)
                              items.push(item);
                      }

                      if (items.length) {
                          editor.call('selector:history', false);
                          editor.call('selector:set', selectorType, items);
                          editor.once('selector:change', function () {
                              editor.call('selector:history', true);
                          });
                      }
                  }
              },
              redo: function () {
                  var parent = editor.call('entities:get', parentId);
                  if (!parent)
                      return;

                  var entity = new Observer(data);
                  editor.call('entities:addEntity', entity, parent, true);
              }
          });
      }

      return entity;
  });
});


/* editor/entities/entities-delete.js */
editor.once('load', function () {
  'use strict';

  // When entities are deleted, we need to do some work to identify references to the
  // deleted entities held by other entities in the graph. For example, if entityA has
  // a component that holds a reference to entityB and entityB is deleted, we should
  // nullify the reference so that entityA's component does not retain or try to access
  // the deleted entity. Similarly, if the deletion is undone, we need to re-populate
  // the reference so that it points once again at entityB.
  //
  // To achieve this, we perform a quick scan of the graph whenever one or more entities
  // are deleted, to build a snapshot of the entity references at that time. The snapshot
  // (which is just a map) is then used for identifying all references to any of the deleted
  // entities, and these are set to null. If the deletion is subsequently undone, the map
  // is used again in order to set all references back to the correct entity guids.
  var recursivelySearchForEntityReferences = function (sourceEntity, entityReferencesMap) {
      var componentNames = Object.keys(sourceEntity.get('components') || {});
      var i, j;

      for (i = 0; i < componentNames.length; i++) {
          var componentName = componentNames[i];
          var entityFields = editor.call('components:getFieldsOfType', componentName, 'entity');

          for (j = 0; j < entityFields.length; j++) {
              var fieldName = entityFields[j];
              var targetEntityGuid = sourceEntity.get('components.' + componentName + '.' + fieldName);

              entityReferencesMap[targetEntityGuid] = entityReferencesMap[targetEntityGuid] || [];
              entityReferencesMap[targetEntityGuid].push({
                  sourceEntityGuid: sourceEntity.get('resource_id'),
                  componentName: componentName,
                  fieldName: fieldName
              });
          }
      }

      var children = sourceEntity.get('children');

      if (children.length > 0) {
          for (i = 0; i < children.length; i++) {
              recursivelySearchForEntityReferences(editor.call('entities:get', children[i]), entityReferencesMap);
          }
      }

      // TODO: this doesn't seem to work for entity script attributes
  };

  /**
   * Deletes the specified entities
   * @param {Observer[]} entities The entities to delete
   */
  editor.method('entities:delete', function (entities) {
      var records = [];
      var entitiesToDelete = [];
      var i;
      var parent;

      // index entities
      var resourceIds = {};
      for (i = 0; i < entities.length; i++) {
          resourceIds[entities[i].get('resource_id')] = entities[i];
      }

      // find out if entity has ancestor
      for (i = 0; i < entities.length; i++) {
          var child = false;
          parent = editor.call('entities:getParentResourceId', entities[i].get('resource_id'));

          while (!child && parent) {
              if (resourceIds[parent]) {
                  child = true;
              } else {
                  parent = editor.call('entities:getParentResourceId', parent);
              }
          }

          if (!child) {
              entitiesToDelete.push(entities[i]);
          }
      }

      // delete only top level entities
      entities = entitiesToDelete;

      for (i = 0; i < entities.length; i++) {
          var resourceId = entities[i].get('resource_id');
          var parentId = editor.call('entities:getParentResourceId', resourceId);
          var ind;
          if (parentId) {
              parent = editor.call('entities:get', parentId);
              if (parent) {
                  ind = parent.get('children').indexOf(resourceId);
              }
          }

          records.push({
              resourceId: resourceId,
              parentId: parentId,
              ind: ind,
              data: entities[i].json()
          });
      }

      // Build a map of all entity reference properties in the graph. This is
      // effectively a snapshot of the entity references as they were at the point of deletion,
      // so that they can be re-constituted later if the deletion is undone.
      var entityReferencesMap = {};
      recursivelySearchForEntityReferences(editor.call('entities:root'), entityReferencesMap);

      // remove the entities from the scene
      for (i = 0; i < entities.length; i++) {
          editor.call('entities:removeEntity', entities[i], entityReferencesMap);
      }

      // sort records by index
      // so that entities are re-added
      // in the correct order in undo
      records.sort(function (a, b) {
          return a.ind - b.ind;
      });

      // add history action
      editor.call('history:add', {
          name: 'delete entities',
          undo: function () {
              var entities = [];
              for (var i = 0, len = records.length; i < len; i++) {
                  var parent = editor.call('entities:get', records[i].parentId);
                  if (!parent)
                      return;

                  var entity = new Observer(records[i].data);
                  entities.push(entity);
                  editor.call('entities:addEntity', entity, parent, false, records[i].ind, entityReferencesMap);
              }

              // select re-added entities
              setTimeout(function () {
                  editor.call('selector:history', false);
                  editor.call('selector:set', 'entity', entities);
                  editor.once('selector:change', function () {
                      editor.call('selector:history', true);
                  });
              }, 0);
          },
          redo: function () {
              for (var i = 0, len = records.length; i < len; i++) {
                  var entity = editor.call('entities:get', records[i].resourceId);
                  if (!entity)
                      return;

                  editor.call('entities:removeEntity', entity, entityReferencesMap);
              }
          }
      });
  });
});


/* editor/entities/entities-duplicate.js */
editor.once('load', function () {
  'use strict';

  var settings = editor.call('settings:project');

  /**
   * When an entity that has properties that contain references to some entities
   * within its subtree is duplicated, the expectation of the user is likely that
   * those properties will be updated to point to the corresponding entities within
   * the newly created duplicate subtree. I realise that sentence is a bit insane,
   * so here is an example:
   *
   * Buttons, Scroll Views and other types of UI component are made up of several
   * related entities. For example, a Scroll View has child entities representing
   * the scroll bar track and handle, as well as the scrollable container area.
   * The Scroll View component needs references to each of these entities so that
   * it can add listeners to them, and move them around.
   *
   * If the user duplicates a Scroll View, they will end up with a set of newly
   * created entities that mirrors the original structure. However, as the properties
   * of all components have been copied verbatim from the original entities, any
   * properties that refer to entities will still refer to the one from the old
   * structure.
   *
   * What needs to happen is that properties that refer to entities within the old
   * duplicated structure are automatically updated to point to the corresponding
   * entities within the new structure. This function implements that requirement.
   * @param {Observer} oldSubtreeRoot The root entity from the tree that was duplicated
   * @param {Observer} oldEntity The source entity
   * @param {Observer} newEntity The duplicated entity
   * @param {Object} duplicatedIdsMap Contains a map that points from the old resource ids to the new resource ids
   */
  var resolveDuplicatedEntityReferenceProperties = function (oldSubtreeRoot, oldEntity, newEntity, duplicatedIdsMap) {
      // TODO Would be nice to also make this work for entity script attributes

      var components = oldEntity.get('components');

      Object.keys(components).forEach(function (componentName) {
          var component = components[componentName];
          var entityFields = editor.call('components:getFieldsOfType', componentName, 'entity');

          entityFields.forEach(function (fieldName) {
              var oldEntityId = component[fieldName];
              var entityWithinOldSubtree = oldSubtreeRoot.entity.findByGuid(oldEntityId);

              if (entityWithinOldSubtree) {
                  var newEntityId = duplicatedIdsMap[oldEntityId];

                  if (newEntityId) {
                      var prevHistory = newEntity.history.enabled;
                      newEntity.history.enabled = false;
                      newEntity.set('components.' + componentName + '.' + fieldName, newEntityId);
                      newEntity.history.enabled = prevHistory;
                  } else {
                      console.warn('Could not find corresponding entity id when resolving duplicated entity references');
                  }
              }
          });
      });

      // remap entity script attributes
      var scriptComponent = oldEntity.get('components.script');
      if (scriptComponent && !settings.get('useLegacyScripts')) {
          for (var scriptName in scriptComponent.scripts) {
              // get script asset
              var scriptAsset = editor.call('assets:scripts:assetByScript', scriptName);
              if (!scriptAsset) continue;

              // go through the script component attribute values
              for (var attributeName in scriptComponent.scripts[scriptName].attributes) {
                  var previousValue = scriptComponent.scripts[scriptName].attributes[attributeName];
                  // early out if the value is null
                  if (!previousValue || (Array.isArray(previousValue) && !previousValue.length)) continue;

                  // get the attribute definition from the asset and make sure it's an entity type
                  var attributeDef = scriptAsset.get('data.scripts.' + scriptName + '.attributes.' + attributeName);
                  if (!attributeDef || attributeDef.type !== 'entity') continue;

                  var newValue = null;
                  var dirty = false;

                  if (attributeDef.array) {
                      // remap entity array
                      newValue = previousValue.slice();
                      for (var i = 0; i < newValue.length; i++) {
                          if (!newValue[i] || !duplicatedIdsMap[newValue[i]]) continue;
                          newValue[i] = duplicatedIdsMap[newValue[i]];
                          dirty = true;
                      }
                  } else {
                      // remap entity
                      if (!duplicatedIdsMap[previousValue]) continue;
                      newValue = duplicatedIdsMap[previousValue];
                      dirty = true;
                  }

                  // save changes
                  if (dirty) {
                      var prevHistory = newEntity.history.enabled;
                      newEntity.history.enabled = false;
                      newEntity.set('components.script.scripts.' + scriptName + '.attributes.' + attributeName, newValue);
                      newEntity.history.enabled = prevHistory;
                  }
              }
          }
      }

      // Recurse into children. Note that we continue to pass in the same `oldSubtreeRoot`,
      // in order to correctly handle cases where a child has an entity reference
      // field that points to a parent or other ancestor that is still within the
      // duplicated subtree.
      var oldChildren = oldEntity.get('children');
      var newChildren = newEntity.get('children');

      if (oldChildren && oldChildren.length > 0) {
          oldChildren.forEach(function (oldChildId, index) {
              var oldChild = editor.call('entities:get', oldChildId);
              var newChild = editor.call('entities:get', newChildren[index]);

              resolveDuplicatedEntityReferenceProperties(oldSubtreeRoot, oldChild, newChild, duplicatedIdsMap);
          });
      }
  };

  // Gets the resource id of the parent of the entity with the specified resource id
  var getParent = function (childResourceId) {
      return editor.call('entities:getParentResourceId', childResourceId);
  };

  /**
   * Duplicates an entity in the scene
   * @param {Observer} entity The entity
   * @param {Observer} parent The parent of the new entity
   * @param {Number} ind The index in the parent's children array where we want to insert the new entity
   * @param {Object} duplicatedIdsMap A guid->guid map that contains references from the source resource ids to the new resource ids
   * @returns {Observer} The new entity
   */
  var duplicateEntity = function (entity, parent, ind, duplicatedIdsMap) {
      var originalResourceId = entity.get('resource_id');
      var data = entity.json();
      var children = data.children;

      data.children = [];
      data.resource_id = pc.guid.create();
      data.parent = parent.get('resource_id');

      entity = new Observer(data);
      editor.call('entities:updateChildToParentIndex', entity.get('resource_id'), parent.get('resource_id'));
      duplicatedIdsMap[originalResourceId] = entity.get('resource_id');

      // call add event
      editor.call('entities:add', entity);

      // sharedb
      editor.call('realtime:scene:op', {
          p: ['entities', entity.get('resource_id')],
          oi: entity.json()
      });

      // this is necessary for the entity to be added to the tree view
      parent.history.enabled = false;
      parent.insert('children', entity.get('resource_id'), ind);
      parent.history.enabled = true;

      // add children too
      children.forEach(function (childId) {
          duplicateEntity(editor.call('entities:get', childId), entity, undefined, duplicatedIdsMap);
      });

      return entity;
  };

  /**
   * Duplicates the specified entities and adds them to the scene.
   * @param {Observer[]} entities The entities to duplicate
   */
  editor.method('entities:duplicate', function (entities) {
      var i;
      var id;
      var item;
      var root = editor.call('entities:root');
      var items = entities.slice(0);
      var entitiesNew = [];
      var entitiesNewData = [];
      var entitiesNewMeta = {};
      var ids = {};

      // make sure not duplicating root
      if (items.indexOf(root) !== -1)
          return;

      // build entities index
      for (i = 0; i < items.length; i++) {
          id = items[i].get('resource_id');

          ids[id] = {
              id: id,
              entity: items[i],
              parentId: getParent(id),
              ind: editor.call('entities:get', getParent(id)).get('children').indexOf(id)
          };
      }

      // filter children off
      i = items.length;
      while (i--) {
          item = ids[items[i].get('resource_id')];
          var parentId = item.parentId;

          while (parentId && parentId !== root.get('resource_id')) {
              if (ids[parentId]) {
                  items.splice(i, 1);
                  delete ids[item.id];
                  break;
              }
              parentId = getParent(parentId);
          }
      }

      // sort by order index within parent
      items.sort(function (a, b) {
          return ids[b.get('resource_id')].ind - ids[a.get('resource_id')].ind;
      });

      // remember current selection
      var selectorType = editor.call('selector:type');
      var selectorItems = editor.call('selector:items');
      for (i = 0; i < selectorItems.length; i++) {
          item = selectorItems[i];
          if (selectorType === 'entity') {
              selectorItems[i] = {
                  type: 'entity',
                  id: item.get('resource_id')
              };
          } else if (selectorType === 'asset') {
              selectorItems[i] = {};
              if (selectorItems[i].get('type') === 'script') {
                  selectorItems[i].type = 'script';
                  selectorItems[i].id = item.get('filename');
              } else {
                  selectorItems[i].type = 'asset';
                  selectorItems[i].id = item.get('id');
              }
          }
      }

      // duplicate
      for (i = 0; i < items.length; i++) {
          var entity = items[i];
          id = entity.get('resource_id');
          var parent = editor.call('entities:get', getParent(id));
          var duplicatedIdsMap = {};
          var entityNew = duplicateEntity(entity, parent, ids[id].ind + 1, duplicatedIdsMap);
          resolveDuplicatedEntityReferenceProperties(entity, entity, entityNew, duplicatedIdsMap);
          entitiesNew.push(entityNew);
          entitiesNewData.push(entityNew.json());
          entitiesNewMeta[entityNew.get('resource_id')] = {
              parentId: getParent(id),
              ind: ids[id].ind
          };
      }

      // set new selection
      setTimeout(function () {
          editor.call('selector:history', false);
          editor.call('selector:set', 'entity', entitiesNew);
          editor.once('selector:change', function () {
              editor.call('selector:history', true);
          });
      }, 0);

      // add history action
      editor.call('history:add', {
          name: 'duplicate entities',
          undo: function () {
              var i;

              // remove duplicated entities
              for (i = 0; i < entitiesNewData.length; i++) {
                  var entity = editor.call('entities:get', entitiesNewData[i].resource_id);
                  if (!entity)
                      continue;

                  editor.call('entities:removeEntity', entity);
              }

              // restore selection
              if (selectorType) {
                  var items = [];
                  for (i = 0; i < selectorItems.length; i++) {
                      var item;

                      if (selectorItems[i].type === 'entity') {
                          item = editor.call('entities:get', selectorItems[i].id);
                      } else if (selectorItems[i].type === 'asset') {
                          item = editor.call('assets:get', selectorItems[i].id);
                      } else if (selectorItems[i].type === 'script') {
                          item = editor.call('sourcefiles:get', selectorItems[i].id);
                      }

                      if (!item)
                          continue;

                      items.push(item);
                  }

                  if (items.length) {
                      editor.call('selector:history', false);
                      editor.call('selector:set', selectorType, items);
                      editor.once('selector:change', function () {
                          editor.call('selector:history', true);
                      });
                  }
              }
          },
          redo: function () {
              var entities = [];

              for (var i = 0; i < entitiesNewData.length; i++) {
                  var id = entitiesNewData[i].resource_id;
                  var meta = entitiesNewMeta[id];
                  if (!meta)
                      continue;

                  var parent = editor.call('entities:get', meta.parentId);
                  if (!parent)
                      continue;

                  var entity = new Observer(entitiesNewData[i]);
                  editor.call('entities:addEntity', entity, parent, true, meta.ind + 1);

                  entities.push(entity);
              }

              if (entities.length) {
                  setTimeout(function () {
                      editor.call('selector:history', false);
                      editor.call('selector:set', 'entity', entities);
                      editor.once('selector:change', function () {
                          editor.call('selector:history', true);
                      });
                  }, 0);
              }
          }
      });
  });
});


/* editor/entities/entities-copy.js */
editor.once('load', function () {
  'use strict';

  var componentAssetPaths = editor.call('components:assetPaths');
  var settings = editor.call('settings:project');

  // Gets the parent resource if of the entity with the specified resource id
  var getParent = function (childResourceId) {
      return editor.call('entities:getParentResourceId', childResourceId);
  };

  // Stores asset paths in the assets dictionary by converting the array of
  // folder ids to an array of folder names
  var storeAssetPaths = function (assetIds, assets) {
      if (! Array.isArray(assetIds)) {
          assetIds = [assetIds];
      }

      for (var i = 0; i < assetIds.length; i++) {
          var assetId = assetIds[i];
          if (! assetId || assets[assetId]) continue;

          var asset = editor.call('assets:get', assetId);
          if (!asset) return;

          var parts = [];

          var path = asset.get('path');
          if (path && path.length) {
              for (var j = 0; j < path.length; j++) {
                  var a = editor.call('assets:get', path[j]);
                  if (!a) continue;

                  parts.push(a.get('name'));
              }
          }

          parts.push(asset.get('name'));

          assets[assetId] = {
              path: parts,
              type: asset.get('type')
          };
      }
  };

  // Gathers all dependencies for this entity
  var gatherDependencies = function (entity, data) {
      var i;
      var key;
      var containsStar = /\.\*\./;

      // store entity json
      var resourceId = entity.get('resource_id');
      if (!data.hierarchy[resourceId]) {
          data.hierarchy[resourceId] = entity.json();
      }

      // gather all asset references from the entity
      // and store their path + name
      for (i = 0; i < componentAssetPaths.length; i++) {
          var path = componentAssetPaths[i];
          var assets;

          // handle paths that contain a '*' as a wildcard
          if (containsStar.test(path)) {
              var parts = path.split('.*.');
              if (!entity.has(parts[0])) continue;

              var obj = entity.get(parts[0]);
              if (!obj) continue;

              for (key in obj) {
                  var fullKey = parts[0] + '.' + key + '.' + parts[1];
                  if (!entity.has(fullKey))
                      continue;

                  assets = entity.get(fullKey);
                  if (!assets) continue;

                  storeAssetPaths(assets, data.assets);
              }
          } else if (entity.has(path)) {
              // handle path without '*'
              assets = entity.get(path);
              if (!assets) continue;

              storeAssetPaths(assets, data.assets);
          }
      }

      // gather script attributes
      if (entity.has('components.script.scripts')) {
          var scripts = entity.get('components.script.scripts');
          var name;

          if (scripts) {
              // legacy scripts
              if (settings.get('useLegacyScripts')) {
                  for (i = 0, len = scripts.length; i < len; i++) {
                      var script = scripts[i];
                      if (!script.attributes) continue;
                      for (name in script.attributes) {
                          var attr = script.attributes[name];
                          if (!attr) continue;
                          if (attr.type === 'asset') {
                              if (attr.value) {
                                  storeAssetPaths(attr.value, data.assets);
                              }

                              if (attr.defaultValue) {
                                  storeAssetPaths(attr.defaultValue, data.assets);
                              }

                          }
                      }
                  }
              } else {
                  // scripts 2.0
                  for (key in scripts) {
                      var scriptData = scripts[key];
                      if (!scriptData || !scriptData.attributes) continue;

                      var asset = editor.call('assets:scripts:assetByScript', key);
                      if (!asset) continue;

                      // search for asset script attributes in script asset
                      var assetData = asset.get('data.scripts.' + key + '.attributes');
                      if (!assetData) continue;

                      for (name in assetData) {
                          if (assetData[name].type === 'asset' && scriptData.attributes[name]) {
                              storeAssetPaths(scriptData.attributes[name], data.assets);
                          }
                      }
                  }
              }
          }
      }

      var children = entity.get('children');
      for (i = 0; i < children.length; i++) {
          gatherDependencies(editor.call('entities:get', children[i]), data);
      }
  };

  /**
   * Copies the specified entities into localStorage
   * @param {Observer[]} entities The entities to copy
   */
  editor.method('entities:copy', function (entities) {
      var data = {
          project: config.project.id,
          legacy_scripts: settings.get('useLegacyScripts'),
          hierarchy: {},
          assets: {}
      };

      var i, len;

      // build index
      var selection = {};
      for (i = 0, len = entities.length; i < len; i++) {
          selection[entities[i].get('resource_id')] = entities[i];
      }

      // sort entities by their index in their parent's children list
      entities.sort(function (a, b) {
          var pA = a.get('parent');
          if (!pA)
              return -1;

          pA = editor.call('entities:get', pA);
          if (!pA)
              return -1;

          var indA = pA.get('children').indexOf(a.get('resource_id'));

          var pB = b.get('parent');
          if (!pB)
              return 1;

          pB = editor.call('entities:get', pB);
          if (!pB)
              return -1;

          var indB = pB.get('children').indexOf(b.get('resource_id'));

          return indA - indB;
      });

      for (i = 0, len = entities.length; i < len; i++) {
          var e = entities[i];

          var p = getParent(e.get('resource_id'));
          var isParentSelected = false;
          while (p) {
              if (selection[p]) {
                  isParentSelected = true;
                  break;
              }

              p = getParent(p);
          }

          // if parent is also selected then skip child
          // and only add parent to copied entities
          if (isParentSelected) {
              // remove entity from selection
              // since its parent is selected
              delete selection[e.get('resource_id')];
              continue;
          }

          // add entity to clipboard if not already added as a child of
          // a higher level entity
          gatherDependencies(e, data);
      }

      for (var key in selection) {
          // set parent of each copied entity to null
          if (data.hierarchy[key])
              data.hierarchy[key].parent = null;
      }

      // save to local storage
      editor.call('entities:clipboard:set', data);
  });
});


/* editor/entities/entities-paste.js */
editor.once('load', function () {
  'use strict';

  var settings = editor.call('settings:project');
  var legacy_scripts = settings.get('useLegacyScripts');
  var componentAssetPaths = editor.call('components:assetPaths');
  var containsStar = /\.\*\./;

  // try to find asset id in this project
  // from path of asset in old project
  /**
   * Try to find an assetId in this project that
   * corresponds to the specified assetId that may come from
   * a different project.
   * @param {Number} assetId The asset id we are trying to remap
   * @param {Object} assetsIndex The assets index stored in localStorage that contains paths of assets
   * @returns {Number} The asset id in this project
   */
  var remapAsset = function (assetId, assetsIndex) {
      if (!assetId) return null;

      // return the old asset id if not found
      var result = parseInt(assetId, 10);

      var assetData = assetsIndex[assetId];
      if (!assetData)
          return result;

      var len = assetData.path.length;
      var name = assetData.path[len - 1];
      var type = assetData.type;

      var pathToId = [];

      var assets = editor.call('assets:list');
      var assetLen = assets.length;

      var i, j, asset;

      // change path names to folder ids
      for (i = 0; i < len - 1; i++) {
          var folder = null;

          for (j = 0; j < assetLen; j++) {
              asset = assets[j];
              if (asset.get('name') === assetData.path[i] && asset.get('type') === 'folder') {
                  folder = asset;
                  break;
              }
          }

          if (!folder)
              return result;

          pathToId.push(parseInt(folder.get('id'), 10));
      }

      var pathToIdLen = pathToId.length;

      // search for asset of same name, type
      // and path as original
      for (i = 0; i < assetLen; i++) {
          asset = assets[i];

          if (asset.get('name') === name &&
              asset.get('type') === type &&
              !asset.get('source')) {
              var path = asset.get('path');
              var pathLen = path && path.length;
              if (path && pathLen === pathToIdLen) {
                  var pathsEqual = true;
                  for (j = 0; j < pathLen; j++) {
                      if (path[j] !== pathToId[j]) {
                          pathsEqual = false;
                          break;
                      }
                  }

                  if (!pathsEqual)
                      continue;
              }

              result = parseInt(asset.get('id'), 10);
              break;
          }
      }

      return result;
  };

  /**
   * Remaps the resource ids of the entities and their entity references in localStorage
   * with new resource ids
   * @param {Observer} entity The entity we are remapping
   * @param {Observer} parent The parent of the pasted entity
   * @param {Object} data The data in localStorage
   * @param {Object} mapping An index that maps old resource ids to new resource ids
   */
  var remapResourceIds = function (entity, parent, data, mapping) {
      var resourceId = entity.get('resource_id');

      var newResourceId = mapping[resourceId];
      entity.set('resource_id', newResourceId);

      // set new resource id for parent
      var parentId = entity.get('parent');
      if (parentId) {
          entity.set('parent', mapping[parentId]);
      } else {
          entity.set('parent', parent.get('resource_id'));
      }

      editor.call('entities:updateChildToParentIndex', newResourceId, entity.get('parent'));

      // set children to empty array because these
      // are going to get added later on
      entity.set('children', []);

      var i, j, key, assets;

      // remap assets and entities
      if (data.project !== config.project.id) {
          for (i = 0; i < componentAssetPaths.length; i++) {
              var path = componentAssetPaths[i];
              if (containsStar.test(path)) {
                  var parts = path.split('.*.');
                  if (!entity.has(parts[0])) continue;

                  var obj = entity.get(parts[0]);
                  if (!obj) continue;

                  for (key in obj) {
                      var fullKey = parts[0] + '.' + key + '.' + parts[1];
                      if (!entity.has(fullKey)) continue;

                      assets = entity.get(fullKey);
                      if (!assets) continue;

                      if (assets instanceof Array) {
                          for (j = 0; j < assets.length; j++) {
                              assets[j] = data.assets[assets[j]];
                          }
                          entity.set(fullKey, assets);
                      } else {
                          entity.set(fullKey, data.assets[assets]);
                      }
                  }
              }
              else if (entity.has(path)) {
                  assets = entity.get(path);
                  if (!assets) continue;

                  if (assets instanceof Array) {
                      for (j = 0; j < assets.length; j++) {
                          assets[j] = data.assets[assets[j]];
                      }
                      entity.set(path, assets);
                  } else {
                      entity.set(path, data.assets[assets]);
                  }
              }
          }
      }

      // remap script asset attributes
      if (entity.has('components.script.scripts')) {
          if (entity.has('components.script')) {
              // remove script component if legacy scripts flag is different between the two projects
              if (legacy_scripts !== data.legacy_scripts) {
                  entity.unset('components.script');
              } else {
                  var scripts = entity.get('components.script.scripts');
                  // legacy scripts
                  if (legacy_scripts) {
                      for (i = 0, len = scripts.length; i < len; i++) {
                          var script = scripts[i];
                          if (!script.attributes) continue;

                          for (var name in script.attributes) {
                              var attr = script.attributes[name];
                              if (!attr) continue;

                              if (attr.type === 'asset' && data.project !== config.project.id) {
                                  if (attr.value) {
                                      if (attr.value instanceof Array) {
                                          for (j = 0; j < attr.value.length; j++) {
                                              entity.set('components.script.scripts.' + i + '.attributes.' + name + '.value.' + j, data.assets[attr.value[j]])
                                          }
                                      } else {
                                          entity.set('components.script.scripts.' + i + '.attributes.' + name + '.value', data.assets[attr.value]);
                                      }
                                  }

                                  if (attr.defaultValue) {
                                      if (attr.defaultValue instanceof Array) {
                                          for (j = 0; j < attr.defaultValue.length; j++) {
                                              entity.set('components.script.scripts.' + i + '.attributes.' + name + '.defaultValue.' + j, data.assets[attr.value[j]])
                                          }
                                      } else {
                                          entity.set('components.script.scripts.' + i + '.attributes.' + name + '.defaultValue', data.assets[attr.value]);
                                      }
                                  }
                              } else if (attr.type === 'entity') {
                                  if (mapping[attr.value])
                                      entity.set('components.script.scripts.' + i + '.attributes.' + name + '.value', mapping[attr.value]);
                                  if (mapping[attr.defaultValue])
                                      entity.set('components.script.scripts.' + i + '.attributes.' + name + '.defaultValue', mapping[attr.defaultValue]);
                              }
                          }
                      }
                  } else {
                      // scripts 2.0
                      if (scripts) {
                          for (var script in scripts) {
                              var asset = editor.call('assets:scripts:assetByScript', script);
                              if (!asset) continue;

                              var attrs = scripts[script].attributes;
                              if (!attrs) continue;

                              for (key in attrs) {
                                  var attrData = asset.get('data.scripts.' + script + '.attributes.' + key);
                                  if (attrData) {
                                      if (attrData.type === 'asset' && data.project !== config.project.id) {
                                          // remap asset ids
                                          if (attrData.array) {
                                              for (j = 0; j < attrs[key].length; j++) {
                                                  entity.set('components.script.scripts.' + script + '.attributes.' + key + '.' + j, data.assets[attrs[key][j]]);
                                              }
                                          } else {
                                              entity.set('components.script.scripts.' + script + '.attributes.' + key, data.assets[attrs[key]]);
                                          }
                                      } else if (attrData.type === 'entity') {
                                          // try to remap entities
                                          if (attrData.array) {
                                              for (j = 0; j < attrs[key].length; j++) {
                                                  if (attrs[key][j] && mapping[attrs[key][j]]) {
                                                      entity.set('components.script.scripts.' + script + '.attributes.' + key + '.' + j, mapping[attrs[key][j]]);
                                                  }
                                              }
                                          } else {
                                              if (mapping[attrs[key]]) {
                                                  entity.set('components.script.scripts.' + script + '.attributes.' + key, mapping[attrs[key]]);
                                              }
                                          }
                                      }

                                  }
                              }
                          }
                      }
                  }
              }
          }

      }

      // remap entity references in components
      var components = entity.get('components');
      for (var componentName in components) {
          var component = components[componentName];
          var entityFields = editor.call('components:getFieldsOfType', componentName, 'entity');

          for (j = 0; j < entityFields; j++) {
              var fieldName = entityFields[j];
              var oldEntityId = component[fieldName];
              if (mapping[oldEntityId]) {
                  var newEntityId = mapping[oldEntityId];

                  if (newEntityId) {
                      entity.set('components.' + componentName + '.' + fieldName, newEntityId);
                  }
              }
          }
      }
  };

  /**
   * Pastes entities in localStore under the specified parent
   * @param {Observer} parent The parent entity
   */
  editor.method('entities:paste', function (parent) {
      // parse data from local storage
      var data = editor.call('entities:clipboard:get');
      if (!data)
          return;

      // paste on root if no parent specified
      if (!parent)
          parent = editor.call('entities:root');


      // remap assets
      if (data.assets) {
          for (var key in data.assets) {
              data.assets[key] = remapAsset(key, data.assets);
          }
      }

      // change resource ids
      var mapping = {};
      for (var guid in data.hierarchy) {
          mapping[guid] = pc.guid.create();
      }

      // add all entities with different resource ids
      var newEntities = [];
      var selectedEntities = [];

      var entity;

      for (var resourceId in data.hierarchy) {
          // create new entity
          entity = new Observer(data.hierarchy[resourceId]);

          // select the entity if its parent is not selected
          var select = !data.hierarchy[entity.get('parent')];

          // change resource ids
          remapResourceIds(entity, parent, data, mapping);

          // sharedb
          editor.call('realtime:scene:op', {
              p: ['entities', entity.get('resource_id')],
              oi: entity.json()
          });

          // add it
          editor.call('entities:add', entity);
          newEntities.push(entity);

          if (select)
              selectedEntities.push(entity);
      }

      // reparent children after they're all added
      for (var i = 0; i < newEntities.length; i++) {
          entity = newEntities[i];
          var parentEntity = editor.call('entities:get', entity.get('parent'));

          // this is necessary for the entity to be added to the tree view
          parentEntity.history.enabled = false;
          parentEntity.insert('children', entity.get('resource_id'));
          parentEntity.history.enabled = true;
      }

      // select pasted entities
      setTimeout(function () {
          editor.call('selector:history', false);
          editor.call('selector:set', 'entity', selectedEntities);
          editor.once('selector:change', function () {
              editor.call('selector:history', true);
          });
      }, 0);

      // add history
      editor.call('history:add', {
          name: 'paste entities',
          undo: function () {
              var i;
              for (i = selectedEntities.length - 1; i >= 0; i--) {
                  var entity = editor.call('entities:get', selectedEntities[i].get('resource_id'));
                  if (!entity) continue;

                  editor.call('entities:removeEntity', entity);
              }

              var selectorType = editor.call('selector:type');
              var selectorItems = editor.call('selector:items');
              if (selectorType === 'entity' && selectorItems.length) {
                  var items = [];
                  for (i = 0; i < selectorItems.length; i++) {
                      var item = editor.call('entities:get', selectorItems[i]);
                      if (item)
                          items.push(item);
                  }

                  if (items.length) {
                      editor.call('selector:history', false);
                      editor.call('selector:set', selectorType, items);
                      editor.once('selector:change', function () {
                          editor.call('selector:history', true);
                      });
                  }
              }
          },
          redo: function () {
              var newParent = editor.call('entities:get', parent.get('resource_id'));
              if (!newParent) return;

              var numChildren = newParent.get('children').length;

              var entities = [];
              // re-add entities
              for (var i = 0; i < selectedEntities.length; i++) {
                  var fromCache = editor.call('entities:getFromDeletedCache', selectedEntities[i].get('resource_id'));
                  if (!fromCache) continue;

                  var e = new Observer(fromCache);
                  editor.call('entities:addEntity', e, newParent, false, numChildren + i);
                  entities.push(e);
              }

              editor.call('selector:history', false);
              editor.call('selector:set', 'entity', entities);
              editor.once('selector:change', function () {
                  editor.call('selector:history', true);
              });
          }
      });
  });
});


/* editor/entities/entities-panel.js */
editor.once('load', function() {
  'use strict'

  // hierarchy index
  var uiItemIndex = { };
  var awaitingParent = { };

  var panel = editor.call('layout.hierarchy');

  // list
  var hierarchy = new ui.Tree();
  hierarchy.allowRenaming = editor.call('permissions:write');
  hierarchy.draggable = hierarchy.allowRenaming;
  hierarchy.class.add('hierarchy');
  panel.append(hierarchy);

  editor.on('permissions:writeState', function(state) {
      hierarchy.allowRenaming = state;
  });

  var resizeQueued = false;
  var resizeTree = function() {
      resizeQueued = false;
      hierarchy.element.style.width = '';
      hierarchy.element.style.width = (panel.content.style.scrollWidth - 5) + 'px';
  };
  var resizeQueue = function() {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(resizeTree);
  };
  panel.on('resize', resizeQueue);
  hierarchy.on('open', resizeQueue);
  hierarchy.on('close', resizeQueue);
  setInterval(resizeQueue, 1000);


  // return hirarchy
  editor.method('entities:hierarchy', function () {
      return hierarchy;
  });

  // list item selected
  hierarchy.on('select', function(item) {
      // open items till parent
      var parent = item.parent;
      while(parent && parent instanceof ui.TreeItem) {
          parent.open = true;
          parent = parent.parent;
      }
      // focus
      item.elementTitle.focus();
      // add selection
      editor.call('selector:add', 'entity', item.entity);
  });

  // list item deselected
  hierarchy.on('deselect', function(item) {
      editor.call('selector:remove', item.entity);
  });


  // scrolling on drag
  var dragScroll = 0;
  var dragTimer;
  var dragLastEvt;
  var dragEvt = function(evt) {
      if (! hierarchy._dragging) {
          clearInterval(dragTimer);
          window.removeEventListener('mousemove', dragEvt);
          return;
      }
      var rect = panel.content.dom.getBoundingClientRect();

      if ((evt.clientY - rect.top) < 32 && panel.content.dom.scrollTop > 0) {
          dragScroll = -1;
      } else if ((rect.bottom - evt.clientY) < 32 && (panel.content.dom.scrollHeight - (rect.height + panel.content.dom.scrollTop)) > 0) {
          dragScroll = 1;
      } else {
          dragScroll = 0;
      }
  };
  hierarchy.on('dragstart', function() {
      dragTimer = setInterval(function() {
          if (dragScroll === 0)
              return;

          panel.content.dom.scrollTop += dragScroll * 8;
          hierarchy._dragOver = null;
          hierarchy._updateDragHandle();
      }, 1000 / 60);

      dragScroll = 0;
      window.addEventListener('mousemove', dragEvt, false);

      var resourceId = hierarchy._dragItems[0].entity.get('resource_id');
      editor.call('drop:set', 'entity', { resource_id: resourceId });
      editor.call('drop:activate', true);
  });

  hierarchy.on('dragend', function() {
      editor.call('drop:activate', false);
      editor.call('drop:set');
  });


  var target = editor.call('drop:target', {
      ref: panel.content.dom,
      type: 'entity',
      hole: true,
      passThrough: true
  });
  target.element.style.outline = 'none';


  // reparenting
  hierarchy.on('reparent', function(items) {
      var records = [ ];

      var preserveTransform = ! Tree._ctrl || ! Tree._ctrl();

      // make records and collect relevant data
      for(var i = 0; i < items.length; i++) {
          if (items[i].item.entity.reparenting)
              continue;

          var record = {
              item: items[i].item,
              parent: items[i].item.parent.entity,
              entity: items[i].item.entity,
              parentOld: items[i].old.entity,
              resourceId: items[i].item.entity.get('resource_id'),
              parentId: items[i].item.parent.entity.get('resource_id'),
              parentIdOld: items[i].old.entity.get('resource_id')
          };

          if (preserveTransform && record.entity) {
              record.position = record.entity.entity.getPosition().clone();
              record.rotation = record.entity.entity.getRotation().clone();
          }

          // relative entity
          record.indOld = record.parentOld.get('children').indexOf(record.resourceId);
          record.indNew = Array.prototype.indexOf.call(record.item.parent.innerElement.childNodes, record.item.element) - 1;

          records.push(record);
      }

      for(var i = 0; i < records.length; i++) {
          var record = records[i];

          record.entity.reparenting = true;

          record.parent.history.enabled = false;
          record.parentOld.history.enabled = false;
          record.entity.history.enabled = false;

          if (record.parent === record.parentOld) {
              // move
              record.parent.removeValue('children', record.resourceId);
              record.parent.insert('children', record.resourceId, record.indNew + ((record.indNew > record.indOld) ? (records.length - 1 - i) : 0));
          } else {
              // reparenting

              // remove from old parent
              record.parentOld.removeValue('children', record.resourceId);

              // add to new parent children
              if (record.indNew !== -1) {
                  // before other item
                  record.parent.insert('children', record.resourceId, record.indNew);
              } else {
                  // at the end
                  record.parent.insert('children', record.resourceId);
              }

              // set parent
              record.entity.set('parent', record.parentId);
          }

          if (preserveTransform && record.position) {
              record.entity.entity.setPosition(record.position);
              record.entity.entity.setRotation(record.rotation);

              var localPosition = record.entity.entity.getLocalPosition();
              var localRotation = record.entity.entity.getLocalEulerAngles();
              record.entity.set('position', [ localPosition.x, localPosition.y, localPosition.z ]);
              record.entity.set('rotation', [ localRotation.x, localRotation.y, localRotation.z ]);
          }

          record.parent.history.enabled = true;
          record.parentOld.history.enabled = true;
          record.entity.history.enabled = true;
          record.entity.reparenting = false;
      }

      editor.call('history:add', {
          name: 'reparent entities',
          undo: function() {
              for(var i = 0; i < records.length; i++) {
                  var entity = editor.call('entities:get', records[i].resourceId);
                  if (! entity) continue;

                  var parent = editor.call('entities:get', entity.get('parent'));
                  var parentOld = editor.call('entities:get', records[i].parentIdOld);
                  if (! parentOld || ! parent) continue;

                  if (parent.get('children').indexOf(records[i].resourceId) === -1 || (parentOld.get('children').indexOf(records[i].resourceId) !== -1 && parentOld !== parent))
                      return;

                  // check if not reparenting to own child
                  var deny = false;
                  var checkParent = editor.call('entities:get', parentOld.get('parent'));
                  while(checkParent) {
                      if (checkParent === entity) {
                          deny = true;
                          checkParent = null;
                          break;
                      } else {
                          checkParent = editor.call('entities:get', checkParent.get('parent'));
                      }
                  }
                  if (deny)
                      continue;

                  parent.history.enabled = false;
                  parent.removeValue('children', records[i].resourceId);
                  parent.history.enabled = true;

                  parentOld.history.enabled = false;
                  var off = parent !== parentOld ? 0 : ((records[i].indNew < records[i].indOld) ? (records.length - 1 - i) : 0);
                  parentOld.insert('children', records[i].resourceId, records[i].indOld === -1 ? undefined : records[i].indOld + off);
                  parentOld.history.enabled = true;

                  entity.history.enabled = false;
                  entity.set('parent', records[i].parentIdOld);

                  if (preserveTransform && records[i].position && entity.entity) {
                      entity.entity.setPosition(records[i].position);
                      entity.entity.setRotation(records[i].rotation);

                      var localPosition = entity.entity.getLocalPosition();
                      var localRotation = entity.entity.getLocalEulerAngles();
                      entity.set('position', [ localPosition.x, localPosition.y, localPosition.z ]);
                      entity.set('rotation', [ localRotation.x, localRotation.y, localRotation.z ]);
                  }

                  entity.history.enabled = true;

                  editor.call('viewport:render');
              }
          },
          redo: function() {
              for(var i = 0; i < records.length; i++) {
                  var entity = editor.call('entities:get', records[i].resourceId);
                  if (! entity) continue;

                  var parent = editor.call('entities:get', records[i].parentId);
                  var parentOld = editor.call('entities:get', entity.get('parent'));
                  if (! parentOld || ! parent) continue;

                  if (parentOld.get('children').indexOf(records[i].resourceId) === -1 || (parent.get('children').indexOf(records[i].resourceId) !== -1 && parent !== parentOld))
                      continue;

                  // check if not reparenting to own child
                  var deny = false;
                  var checkParent = editor.call('entities:get', parent.get('parent'));
                  while(checkParent) {
                      if (checkParent === entity) {
                          deny = true;
                          checkParent = null;
                          break;
                      } else {
                          checkParent = editor.call('entities:get', checkParent.get('parent'));
                      }
                  }
                  if (deny)
                      continue;

                  parentOld.history.enabled = false;
                  parentOld.removeValue('children', records[i].resourceId);
                  parentOld.history.enabled = true;

                  parent.history.enabled = false;
                  var off = parent !== parentOld ? 0 : ((records[i].indNew > records[i].indOld) ? (records.length - 1 - i) : 0);
                  parent.insert('children', records[i].resourceId, records[i].indNew + off);
                  parent.history.enabled = true;

                  entity.history.enabled = false;
                  entity.set('parent', records[i].parentId);

                  if (preserveTransform && records[i].position && entity.entity) {
                      entity.entity.setPosition(records[i].position);
                      entity.entity.setRotation(records[i].rotation);

                      var localPosition = entity.entity.getLocalPosition();
                      var localRotation = entity.entity.getLocalEulerAngles();
                      entity.set('position', [ localPosition.x, localPosition.y, localPosition.z ]);
                      entity.set('rotation', [ localRotation.x, localRotation.y, localRotation.z ]);
                  }

                  entity.history.enabled = true;

                  editor.call('viewport:render');
              }
          }
      });

      resizeQueue();
      editor.call('viewport:render');
  });


  // selector add
  editor.on('selector:add', function(entity, type) {
      if (type !== 'entity')
          return;

      uiItemIndex[entity.get('resource_id')].selected = true;
  });
  // selector remove
  editor.on('selector:remove', function(entity, type) {
      if (type !== 'entity')
          return;

      uiItemIndex[entity.get('resource_id')].selected = false;
  });
  // selector change
  editor.on('selector:change', function(type, items) {
      if (type !== 'entity') {
          hierarchy.clear();
      } else {
          var selected = hierarchy.selected;
          var ids = { };

          // build index of selected items
          for(var i = 0; i < items.length; i++) {
              ids[items[i].get('resource_id')] = true;
          };

          // deselect unselected items
          for(var i = 0; i < selected.length; i++) {
              if (! ids[selected[i].entity.get('resource_id')])
                  selected[i].selected = false;
          }
      }
  });


  // entity removed
  editor.on('entities:remove', function(entity) {
      uiItemIndex[entity.get('resource_id')].destroy();
      resizeQueue();
  });


  var componentList;

  // entity added
  editor.on('entities:add', function(entity, isRoot) {
      var classList = ['tree-item-entity', 'entity-id-' + entity.get('resource_id')];
      if (isRoot) {
          classList.push('tree-item-root');
      }

      var element = new ui.TreeItem({
          text: entity.get('name'),
          classList: classList
      });

      element.entity = entity;
      element.enabled = entity.get('enabled');

      if (! componentList)
          componentList = editor.call('components:list');

      // icon
      var components = Object.keys(entity.get('components'));
      for(var i = 0; i < components.length; i++)
          element.class.add('c-' + components[i]);

      var watchComponent = function(component) {
          entity.on('components.' + component + ':set', function() {
              element.class.add('c-' + component);
          });
          entity.on('components.' + component + ':unset', function() {
              element.class.remove('c-' + component);
          });
      };
      for(var i = 0; i < componentList.length; i++) {
          watchComponent(componentList[i]);
      }

      entity.reparenting = false;

      // index
      uiItemIndex[entity.get('resource_id')] = element;

      // name change
      entity.on('name:set', function(value) {
          element.text = value;
          resizeQueue();
      });

      entity.on('enabled:set', function(value) {
          element.enabled = value;
      });

      entity.on('children:move', function(value, ind, indOld) {
          var item = uiItemIndex[value];
          if (! item || item.entity.reparenting)
              return;

          element.remove(item);

          var next = uiItemIndex[entity.get('children.' + (ind + 1))];
          var after = null;
          if (next === item) {
              next = null;

              if (ind > 0)
                  after = uiItemIndex[entity.get('children.' + ind)]
          }

          if (item.parent)
              item.parent.remove(item);

          if (next) {
              element.appendBefore(item, next);
          } else if (after) {
              element.appendAfter(item, after);
          } else {
              element.append(item);
          }
      });

      // remove children
      entity.on('children:remove', function(value) {
          var item = uiItemIndex[value];
          if (! item || item.entity.reparenting)
              return;

          element.remove(item);
      });

      // add children
      entity.on('children:insert', function(value, ind) {
          var item = uiItemIndex[value];

          if (! item || item.entity.reparenting)
              return;

          if (item.parent)
              item.parent.remove(item);

          var next = uiItemIndex[entity.get('children.' + (ind + 1))];
          if (next) {
              element.appendBefore(item, next);
          } else {
              element.append(item);
          }
      });

      // collaborators
      var users = element.users = document.createElement('span');
      users.classList.add('users');
      element.elementTitle.appendChild(users);

      resizeQueue();
  });


  // append all treeItems according to child order
  editor.on('entities:load', function() {
      var entities = editor.call('entities:list');

      for(var i = 0; i < entities.length; i++) {
          var entity = entities[i];
          var element = uiItemIndex[entity.get('resource_id')];

          if (! entity.get('parent')) {
              // root
              hierarchy.append(element);
              element.open = true;
          }

          var children = entity.get('children');
          if (children.length) {
              for(var c = 0; c < children.length; c++) {
                  var child = uiItemIndex[children[c]];
                  if (!child) {
                      var err = 'Cannot find child entity ' + children[c];
                      editor.call('status:error', err);
                      console.error(err);
                      continue;
                  }
                  element.append(child);
              }
          }
      }
  });


  // deleting entity
  editor.on('entity:delete', function(entity) {
      editor.call('entities:remove', entity);
  });

  // get entity item
  editor.method('entities:panel:get', function (resourceId) {
      return uiItemIndex[resourceId];
  });

  // highlight entity
  editor.method('entities:panel:highlight', function (resourceId, highlight) {
      var item = uiItemIndex[resourceId];
      if (!item) return;

      if (highlight)
          item.class.add('highlight');
      else
          item.class.remove('highlight');
  });
});


/* editor/entities/entities-menu.js */
editor.once('load', function() {
  'use strict';

  var componentsLogos = editor.call('components:logos');

  var applyAdditions = function(object, additions) {
      if (additions) {
          Object.keys(additions).forEach(function(name) {
              object[name] = additions[name];
          });
      }
  };

  var createGroupElementComponentData = function(additions) {
      var data = editor.call('components:getDefault', 'element');
      data.type = 'group';

      applyAdditions(data, additions);

      return data;
  };

  var createImageElementComponentData = function(additions) {
      var data = editor.call('components:getDefault', 'element');
      data.type = 'image';

      applyAdditions(data, additions);

      return data;
  };

  var createTextElementComponentData = function(additions) {
      var data = editor.call('components:getDefault', 'element');
      data.type = 'text';
      data.text = 'Text';
      data.autoWidth = true;
      data.autoHeight = true;

      applyAdditions(data, additions);

      return data;
  };

  var createButtonEntityData = function(additions) {
      var data = {
          components: {
              button: editor.call('components:getDefault', 'button'),
              element: createImageElementComponentData({ useInput: true })
          },
          // The button component needs references to its Image entity, which is
          // only known post-creation. Defining these as a post-creation callback
          // means that they'll also be correctly resolved if the user undoes the
          // button creation and then redoes it.
          postCreationCallback: function(button) {
              button.history.enabled = false;
              button.set('components.button.imageEntity', button.entity.getGuid());
              button.history.enabled = true;
          }
      };

      applyAdditions(data, additions);

      return data;
  };

  var createScrollbarEntityData = function(orientation, additions) {
      var scrollbarComponentData = editor.call('components:getDefault', 'scrollbar');
      scrollbarComponentData.orientation = orientation;

      var containerData = createImageElementComponentData();
      var containerElementDefaults = editor.call('components:scrollbar:getContainerElementDefaultsForOrientation', orientation);
      applyAdditions(containerData, containerElementDefaults);

      var handleData = createButtonEntityData({ name: 'Handle' });
      var handleElementDefaults = editor.call('components:scrollbar:getHandleElementDefaultsForOrientation', orientation);
      applyAdditions(handleData.components.element, handleElementDefaults);

      var data = {
          components: {
              scrollbar: scrollbarComponentData,
              element: containerData
          },
          postCreationCallback: function(scrollbar) {
              scrollbar.history.enabled = false;
              scrollbar.set('components.scrollbar.handleEntity', scrollbar.entity.findByName('Handle').getGuid());
              scrollbar.history.enabled = true;
          },
          children: [
              handleData
          ]
      };

      applyAdditions(data, additions);

      return data;
  };

  editor.method('menu:entities:new', function (getParentFn) {
      if (! getParentFn)
          getParentFn = function () {return editor.call('entities:selectedFirst');};

      return {
          'add-new-entity': {
              title: 'Entity',
              className: 'menu-item-add-entity',
              icon: '&#57632;',
              select: function() {
                  editor.call('entities:new', {parent: getParentFn()});
              }
          },
          'audio-sub-menu': {
              title: 'Audio',
              className: 'menu-item-audio-sub-menu',
              icon: componentsLogos.sound,
              items: {
                  'add-new-listener': {
                      title: 'Audio Listener',
                      className: 'menu-item-add-audio-listener',
                      icon: componentsLogos.audiolistener,
                      select: function() {
                          editor.call('entities:new', {
                              name: 'Audio Listener',
                              parent: getParentFn(),
                              components: {
                                  audiolistener: editor.call('components:getDefault', 'audiolistener')
                              }
                          });
                      }
                  },
                  'add-new-audiosource': {
                      title: 'Audio Source',
                      className: 'menu-item-add-audio-source',
                      icon: componentsLogos.audiosource,
                      hide: function () {
                          return ! editor.call('settings:project').get('useLegacyAudio');
                      },
                      select: function() {
                          editor.call('entities:new', {
                              name: 'Audio Source',
                              parent: getParentFn(),
                              components: {
                                  audiosource: editor.call('components:getDefault', 'audiosource')
                              }
                          });
                      }
                  },
                  'add-new-sound': {
                      title: 'Sound',
                      className: 'menu-item-add-sound',
                      icon: componentsLogos.sound,
                      select: function() {
                          editor.call('entities:new', {
                              name: 'Sound',
                              parent: getParentFn(),
                              components: {
                                  sound: editor.call('components:getDefault', 'sound')
                              }
                          });
                      }
                  }
              }
          },
          'add-new-camera': {
              title: 'Camera',
              className: 'menu-item-add-camera',
              icon: componentsLogos.camera,
              select: function() {
                  editor.call('entities:new', {
                      name: 'Camera',
                      parent: getParentFn(),
                      components: {
                          camera: editor.call('components:getDefault', 'camera')
                      }
                  });
              }
          },
          'light-sub-menu': {
              title: 'Light',
              className: 'menu-item-light-sub-menu',
              icon: componentsLogos.point,
              items: {
                  'add-new-directional': {
                      title: 'Directional Light',
                      className: 'menu-item-add-directional-light',
                      icon: componentsLogos.directional,
                      select: function() {
                          var component = editor.call('components:getDefault', 'light');
                          component.type = 'directional';

                          editor.call('entities:new', {
                              name: 'Directional Light',
                              parent: getParentFn(),
                              components: {
                                  light: component
                              }
                          });
                      }
                  },
                  'add-new-point': {
                      title: 'Point Light',
                      className: 'menu-item-add-point-light',
                      icon: componentsLogos.point,
                      select: function() {
                          var component = editor.call('components:getDefault', 'light');
                          component.type = 'point';
                          component.shadowResolution = 256;

                          editor.call('entities:new', {
                              name: 'Point Light',
                              parent: getParentFn(),
                              components: {
                                  light: component
                              }
                          });
                      }
                  },
                  'add-new-spot': {
                      title: 'Spot Light',
                      className: 'menu-item-add-spot-light',
                      icon: componentsLogos.spot,
                      select: function() {
                          var component = editor.call('components:getDefault', 'light');
                          component.type = 'spot';

                          editor.call('entities:new', {
                              name: 'Spot Light',
                              parent: getParentFn(),
                              components: {
                                  light: component
                              }
                          });
                      }
                  }
              }
          },
          'add-new-model': {
              title: 'Model',
              className: 'menu-item-add-model',
              icon: componentsLogos.model,
              select: function() {
                  var component = editor.call('components:getDefault', 'model');
                  component.type = 'asset';

                  editor.call('entities:new', {
                      name: 'Model',
                      parent: getParentFn(),
                      components: {
                          model: component
                      }
                  });
              }
          },
          'add-new-particles': {
              title: 'Particle System',
              className: 'menu-item-add-particle-system',
              icon: componentsLogos.particlesystem,
              select: function() {
                  editor.call('entities:new', {
                      name: 'Particle System',
                      parent: getParentFn(),
                      components: {
                          particlesystem: editor.call('components:getDefault', 'particlesystem')
                      }
                  });
              }
          },
          'primitive-sub-menu': {
              title: 'Primitive',
              className: 'menu-item-primitive-sub-menu',
              icon: componentsLogos.model,
              items: {
                  'add-new-box': {
                      title: 'Box',
                      className: 'menu-item-add-box-primitive',
                      icon: componentsLogos.model,
                      select: function() {
                          var component = editor.call('components:getDefault', 'model');
                          component.type = 'box';

                          editor.call('entities:new', {
                              name: 'Box',
                              parent: getParentFn(),
                              components: {
                                  model: component
                              }
                          });
                      }
                  },
                  'add-new-capsule': {
                      title: 'Capsule',
                      className: 'menu-item-add-capsule-primitive',
                      icon: componentsLogos.model,
                      select: function() {
                          var component = editor.call('components:getDefault', 'model');
                          component.type = 'capsule';

                          editor.call('entities:new', {
                              name: 'Capsule',
                              parent: getParentFn(),
                              components: {
                                  model: component
                              }
                          });
                      }
                  },
                  'add-new-cone': {
                      title: 'Cone',
                      className: 'menu-item-add-cone-primitive',
                      icon: componentsLogos.model,
                      select: function() {
                          var component = editor.call('components:getDefault', 'model');
                          component.type = 'cone';

                          editor.call('entities:new', {
                              name: 'Cone',
                              parent: getParentFn(),
                              components: {
                                  model: component
                              }
                          });
                      }
                  },
                  'add-new-cylinder': {
                      title: 'Cylinder',
                      className: 'menu-item-add-cylinder-primitive',
                      icon: componentsLogos.model,
                      select: function() {
                          var component = editor.call('components:getDefault', 'model');
                          component.type = 'cylinder';

                          editor.call('entities:new', {
                              name: 'Cylinder',
                              parent: getParentFn(),
                              components: {
                                  model: component
                              }
                          });
                      }
                  },

                  'add-new-plane': {
                      title: 'Plane',
                      className: 'menu-item-add-plane-primitive',
                      icon: componentsLogos.model,
                      select: function() {
                          var component = editor.call('components:getDefault', 'model');
                          component.type = 'plane';

                          editor.call('entities:new', {
                              name: 'Plane',
                              parent: getParentFn(),
                              components: {
                                  model: component
                              }
                          });
                      }
                  },
                  'add-new-sphere': {
                      title: 'Sphere',
                      className: 'menu-item-add-sphere-primitive',
                      icon: componentsLogos.model,
                      select: function() {
                          var component = editor.call('components:getDefault', 'model');
                          component.type = 'sphere';

                          editor.call('entities:new', {
                              name: 'Sphere',
                              parent: getParentFn(),
                              components: {
                                  model: component
                              }
                          });
                      }
                  }
              }
          },
          'sprite-sub-menu': {
              title: 'Sprite',
              className: 'menu-item-sprite-sub-menu',
              icon: componentsLogos.sprite,
              items: {
                  'add-new-sprite': {
                      title: 'Sprite',
                      className: 'menu-item-add-sprite',
                      icon: componentsLogos.sprite,
                      select: function() {
                          var data = editor.call('components:getDefault', 'sprite');
                          editor.call('entities:new', {
                              name: 'Sprite',
                              parent: getParentFn(),
                              components: {
                                  sprite: data
                              }
                          });
                      }
                  },
                  'add-new-animated-sprite': {
                      title: 'Animated Sprite',
                      className: 'menu-item-add-animated-sprite',
                      icon: componentsLogos.sprite,
                      select: function() {
                          var data = editor.call('components:getDefault', 'sprite');
                          data.type = 'animated';
                          data.clips = {
                              '0': {
                                  name: 'Clip 1',
                                  fps: 10,
                                  loop: true,
                                  autoPlay: true,
                                  spriteAsset: null
                              }
                          };
                          data.autoPlayClip = 'Clip 1';
                          editor.call('entities:new', {
                              name: 'Animated Sprite',
                              parent: getParentFn(),
                              components: {
                                  sprite: data
                              }
                          });
                      }
                  }
              }
          },
          'ui-sub-menu': {
              title: 'User Interface',
              className: 'menu-item-ui-sub-menu',
              icon: componentsLogos.userinterface,
              items: {
                  'add-new-2d-screen': {
                      title: '2D Screen',
                      className: 'menu-item-add-2d-screen-ui',
                      icon: componentsLogos['2d-screen'],
                      select: function() {
                          var data = editor.call('components:getDefault', 'screen');
                          data.screenSpace = true;

                          editor.call('entities:new', {
                              name: '2D Screen',
                              parent: getParentFn(),
                              components: {
                                  screen: data
                              }
                          });
                      }
                  },
                  'add-new-3d-screen': {
                      title: '3D Screen',
                      className: 'menu-item-add-3d-screen-ui',
                      icon: componentsLogos['3d-screen'],
                      select: function() {
                          var data = editor.call('components:getDefault', 'screen');
                          data.screenSpace = false;

                          editor.call('entities:new', {
                              name: '3D Screen',
                              parent: getParentFn(),
                              scale: [0.01, 0.01, 0.01],
                              components: {
                                  screen: data
                              }
                          });
                      }
                  },
                  'add-new-text': {
                      title: 'Text Element',
                      className: 'menu-item-add-text-element-ui',
                      icon: componentsLogos['text-element'],
                      select: function() {
                          editor.call('entities:new', {
                              name: 'Text',
                              parent: getParentFn(),
                              components: {
                                  element: createTextElementComponentData()
                              }
                          });
                      }
                  },
                  'add-new-image': {
                      title: 'Image Element',
                      className: 'menu-item-add-image-element-ui',
                      icon: componentsLogos['image-element'],
                      select: function() {
                          editor.call('entities:new', {
                              name: 'Image',
                              parent: getParentFn(),
                              components: {
                                  element: createImageElementComponentData()
                              }
                          });
                      }
                  },
                  'add-new-group': {
                      title: 'Element Group',
                      className: 'menu-item-add-element-group-ui',
                      icon: componentsLogos['group-element'],
                      select: function() {
                          var data = editor.call('components:getDefault', 'element');
                          data.type = 'group';
                          editor.call('entities:new', {
                              name: 'Group',
                              parent: getParentFn(),
                              components: {
                                  element: createGroupElementComponentData()
                              }
                          });
                      }
                  },
                  'add-new-button': {
                      title: 'Button Element',
                      className: 'menu-item-add-button-element-ui',
                      icon: componentsLogos.button,
                      select: function() {
                          editor.call('entities:new', createButtonEntityData({
                              name: 'Button',
                              parent: getParentFn(),
                              children: [
                                  {
                                      name: 'Text',
                                      components: {
                                          element: createTextElementComponentData()
                                      }
                                  }
                              ]
                          }));
                      }
                  },
                  'add-new-scroll-view': {
                      title: 'Scroll View Element',
                      className: 'menu-item-add-scroll-view-element-ui',
                      icon: componentsLogos.scrollview,
                      select: function() {
                          var viewportSize = 200;
                          var scrollbarSize = 20;

                          editor.call('entities:new', {
                              name: 'ScrollView',
                              parent: getParentFn(),
                              components: {
                                  scrollview: editor.call('components:getDefault', 'scrollview'),
                                  element: createGroupElementComponentData({
                                      width: viewportSize,
                                      height: viewportSize,
                                      pivot: [0, 1]
                                  })
                              },
                              postCreationCallback: function(scrollView) {
                                  scrollView.history.enabled = false;
                                  scrollView.set('components.scrollview.viewportEntity', scrollView.entity.findByName('Viewport').getGuid());
                                  scrollView.set('components.scrollview.contentEntity', scrollView.entity.findByName('Content').getGuid());
                                  scrollView.set('components.scrollview.verticalScrollbarEntity', scrollView.entity.findByName('VerticalScrollbar').getGuid());
                                  scrollView.set('components.scrollview.horizontalScrollbarEntity', scrollView.entity.findByName('HorizontalScrollbar').getGuid());
                                  scrollView.history.enabled = true;
                              },
                              children: [
                                  {
                                      name: 'Viewport',
                                      components: {
                                          element: createImageElementComponentData({
                                              anchor: [0, 0, 1, 1],
                                              margin: [0, scrollbarSize, scrollbarSize, 0],
                                              pivot: [0, 1],
                                              color: [.2, .2, .2],
                                              mask: true
                                          })
                                      },
                                      children: [
                                          {
                                              name: 'Content',
                                              components: {
                                                  element: createGroupElementComponentData({
                                                      anchor: [0, 1, 0, 1],
                                                      margin: [0, 0, 0, 0],
                                                      width: viewportSize * 2,
                                                      height: viewportSize * 2,
                                                      pivot: [0, 1],
                                                      useInput: true
                                                  })
                                              }
                                          }
                                      ]
                                  },
                                  createScrollbarEntityData(ORIENTATION_HORIZONTAL, {
                                      name: 'HorizontalScrollbar'
                                  }),
                                  createScrollbarEntityData(ORIENTATION_VERTICAL, {
                                      name: 'VerticalScrollbar'
                                  })
                              ]
                          });
                      }
                  },
                  'add-new-scrollbar': {
                      title: 'Scrollbar Element',
                      className: 'menu-item-add-scrollbar-element-ui',
                      icon: componentsLogos.scrollbar,
                      select: function() {
                          editor.call('entities:new', createScrollbarEntityData(ORIENTATION_VERTICAL, {
                              name: 'Scrollbar',
                              parent: getParentFn()
                          }));
                      }
                  }
              }
          }
      };
  });
});


/* editor/entities/entities-control.js */
editor.once('load', function() {
  'use strict'

  var root = editor.call('layout.root');
  var panel = editor.call('layout.hierarchy');

  // controls
  var controls = new pcui.Container({
      flex: true,
      flexDirection: 'row',
      alignItems: 'center',
      hidden: !editor.call('permissions:write')
  });
  controls.class.add('hierarchy-controls');

  editor.on('permissions:writeState', function(state) {
      controls.hidden = ! state;
  });

  panel.header.append(controls);

  // controls add
  var btnAdd = new ui.Button({
      text: '&#57632;'
  });
  btnAdd.class.add('add');
  btnAdd.on('click', function() {
      menuEntities.open = true;
      var rect = btnAdd.element.getBoundingClientRect();
      menuEntities.position(rect.left, rect.top);
  });
  controls.append(btnAdd);

  Tooltip.attach({
      target: btnAdd.element,
      text: 'Add Entity',
      align: 'top',
      root: root
  });

  // controls duplicate
  var btnDuplicate = new ui.Button({
      text: '&#57638;'
  });
  btnDuplicate.disabled = true;
  btnDuplicate.class.add('duplicate');
  btnDuplicate.on('click', function() {
      var type = editor.call('selector:type');
      var items = editor.call('selector:items');

      if (type === 'entity' && items.length)
          editor.call('entities:duplicate', items);
  });
  controls.append(btnDuplicate);

  var tooltipDuplicate = Tooltip.attach({
      target: btnDuplicate.element,
      text: 'Duplicate Entity',
      align: 'top',
      root: root
  });
  tooltipDuplicate.class.add('innactive');

  var menuEntities = ui.Menu.fromData(editor.call('menu:entities:new'));
  root.append(menuEntities);

   // controls delete
   var btnDelete = new ui.Button({
      text: '&#57636;'
  });
  btnDelete.class.add('delete');
  btnDelete.style.fontWeight = 200;
  btnDelete.on('click', function() {
      var type = editor.call('selector:type');

      if (type !== 'entity')
          return;

      editor.call('entities:delete', editor.call('selector:items'));
  });
  controls.append(btnDelete);

  var tooltipDelete = Tooltip.attach({
      target: btnDelete.element,
      text: 'Delete Entity',
      align: 'top',
      root: root
  });
  tooltipDelete.class.add('innactive');


  editor.on('attributes:clear', function() {
      btnDuplicate.disabled = true;
      btnDelete.disabled = true;
      tooltipDelete.class.add('innactive');
      tooltipDuplicate.class.add('innactive');
  });

  editor.on('attributes:inspect[*]', function(type, items) {
      var root = editor.call('entities:root');

      if (type === 'entity' && items[0] !== root) {
          btnDelete.enabled = true;
          btnDuplicate.enabled = true;
          tooltipDelete.class.remove('innactive');
          tooltipDuplicate.class.remove('innactive');
      } else {
          btnDelete.enabled = false;
          btnDuplicate.enabled = false;
          tooltipDelete.class.add('innactive');
          tooltipDuplicate.class.add('innactive');
      }
  });
});


/* editor/entities/entities-fuzzy-search.js */
editor.once('load', function () {
  'use strict';


  editor.method('entities:fuzzy-search', function (query) {
      var items = [];
      var entities = editor.call('entities:list');

      for (var i = 0; i < entities.length; i++)
          items.push([entities[i].get('name'), entities[i]]);

      return editor.call('search:items', items, query);
  });
});


/* editor/entities/entities-fuzzy-search-ui.js */
editor.once('load', function() {
  'use strict';

  var panel = editor.call('layout.hierarchy');
  var hierarchy = editor.call('entities:hierarchy');
  var changing = false;
  var itemsIndex = { };

  var results = new ui.List();
  results.element.tabIndex = 0;
  results.hidden = true;
  results.class.add('search-results');
  panel.append(results);

  // clear on escape
  results.element.addEventListener('keydown', function(evt) {
      if (evt.keyCode === 27) { // esc
          searchClear.click();

      } else if (evt.keyCode === 13) { // enter
          if (! results.selected) {
              var firstElement = results.element.firstChild;
              if (firstElement && firstElement.ui && firstElement.ui.entity)
                  editor.call('selector:set', 'entity', [ firstElement.ui.entity ]);
          }
          search.value = '';

      } else if (evt.keyCode === 40) { // down
          selectNext();
          evt.stopPropagation();

      } else if (evt.keyCode === 38) { // up
          selectPrev();
          evt.stopPropagation();
      }
  }, false);

  // deselecting
  results.unbind('deselect', results._onDeselect);
  results._onDeselect = function(item) {
      var ind = this._selected.indexOf(item);
      if (ind !== -1) this._selected.splice(ind, 1);

      if (this._changing)
          return;

      if (List._ctrl && List._ctrl()) {

      } else {
          this._changing = true;

          var items = editor.call('selector:type') === 'entity' && editor.call('selector:items') || [ ];
          var inSelected = items.indexOf(item.entity) !== -1;

          if (items.length >= 2 && inSelected) {
              var selected = this.selected;
              for(var i = 0; i < selected.length; i++)
                  selected[i].selected = false;

              item.selected = true;
          }

          this._changing = false;
      }

      this.emit('change');
  };
  results.on('deselect', results._onDeselect);

  // results selection change
  results.on('change', function() {
      if (changing)
          return;

      if (results.selected) {
          editor.call('selector:set', 'entity', results.selected.map(function(item) {
              return item.entity;
          }));
      } else {
          editor.call('selector:clear');
      }
  });

  // selector change
  editor.on('selector:change', function(type, items) {
      if (changing)
          return;

      changing = true;

      if (type === 'entity') {
          results.selected = [ ];

          for(var i = 0; i < items.length; i++) {
              var item = itemsIndex[items[i].get('resource_id')];
              if (! item) continue;
              item.selected = true;
          }
      } else {
          results.selected = [ ];
      }

      changing = false;
  });

  var selectNext = function() {
      var children = results.element.children;

      // could be nothing or only one item to select
      if (! children.length)
          return;

      var toSelect = null;
      var items = results.element.querySelectorAll('.ui-list-item.selected');
      var multi = (ui.List._ctrl && ui.List._ctrl()) || (ui.List._shift && ui.List._shift());

      if (items.length) {
          var last = items[items.length - 1];
          var next = last.nextSibling;
          if (next) {
              // select next
              toSelect = next.ui;
          } else {
              // loop through
              if (! multi) toSelect = children[0].ui;
          }
      } else {
          // select first
          toSelect = children[0].ui;
      }

      if (toSelect) {
          if (! multi) results.selected = [ ];
          toSelect.selected = true;
      }
  };
  var selectPrev = function() {
      var children = results.element.children;

      // could be nothing or only one item to select
      if (! children.length)
          return;

      var toSelect = null;
      var items = results.element.querySelectorAll('.ui-list-item.selected');
      var multi = (ui.List._ctrl && ui.List._ctrl()) || (ui.List._shift && ui.List._shift());

      if (items.length) {
          var first = items[0];
          var prev = first.previousSibling;
          if (prev) {
              // select previous
              toSelect = prev.ui;
          } else {
              // loop through
              if (! multi) toSelect = children[children.length - 1].ui;
          }
      } else {
          // select last
          toSelect = children[children.length - 1].ui;
      }

      if (toSelect) {
          if (! multi) results.selected = [ ];
          toSelect.selected = true;
      }
  };


  var lastSearch = '';
  var search = new ui.TextField({
      placeholder: 'Search'
  });
  search.blurOnEnter = false;
  search.keyChange = true;
  search.class.add('search');
  search.renderChanges = false;
  panel.prepend(search);

  search.element.addEventListener('keydown', function(evt) {
      if (evt.keyCode === 27) {
          searchClear.click();

      } else if (evt.keyCode === 13) {
          if (! results.selected.length) {
              var firstElement = results.element.firstChild;
              if (firstElement && firstElement.ui && firstElement.ui.entity)
                  editor.call('selector:set', 'entity', [ firstElement.ui.entity ]);
          }
          search.value = '';

      } else if (evt.keyCode === 40) { // down
          editor.call('hotkey:updateModifierKeys', evt);
          selectNext();
          evt.stopPropagation();
          evt.preventDefault();

      } else if (evt.keyCode === 38) { // up
          editor.call('hotkey:updateModifierKeys', evt);
          selectPrev();
          evt.stopPropagation();
          evt.preventDefault();

      } else if (evt.keyCode === 65 && evt.ctrlKey) { // ctrl + a
          var toSelect = [ ];

          var items = results.element.querySelectorAll('.ui-list-item');
          for(var i = 0; i < items.length; i++)
              toSelect.push(items[i].ui);

          results.selected = toSelect;

          evt.stopPropagation();
          evt.preventDefault();
      }
  }, false);

  var searchClear = document.createElement('div');
  searchClear.innerHTML = '&#57650;';
  searchClear.classList.add('clear');
  search.element.appendChild(searchClear);

  searchClear.addEventListener('click', function() {
      search.value = '';
  }, false);


  // if entity added, check if it maching query
  editor.on('entities:add', function(entity) {
      var query = search.value.trim();
      if (! query)
          return;

      var items = [ [ entity.get('name'), entity ] ];
      var result = editor.call('search:items', items, query);

      if (! result.length)
          return;

      performSearch();
  });


  var addItem = function(entity) {
      var events = [ ];

      var item = new ui.ListItem({
          text: entity.get('name')
      });
      item.disabledClick = true;
      item.entity = entity;

      if (entity.get('children').length)
          item.class.add('container');

      // relate to tree item
      var treeItem = editor.call('entities:panel:get', entity.get('resource_id'));

      item.disabled = treeItem.disabled;

      var onStateChange = function() {
          item.disabled = treeItem.disabled;
      };

      events.push(treeItem.on('enable', onStateChange));
      events.push(treeItem.on('disable', onStateChange));

      var onNameSet = function(name) {
          item.text = name;
      };
      events.push(entity.on('name:set', onNameSet));

      // icon
      var components = Object.keys(entity.get('components'));
      for(var c = 0; c < components.length; c++)
          item.class.add('c-' + components[c]);

      var onContextMenu = function(evt) {
          var openned = editor.call('entities:contextmenu:open', entity, evt.clientX, evt.clientY);

          if (openned) {
              evt.preventDefault();
              evt.stopPropagation();
          }
      };

      var onDblClick = function(evt) {
          search.value = '';
          editor.call('selector:set', 'entity', [ entity ]);

          evt.stopPropagation();
          evt.preventDefault();
      };

      item.element.addEventListener('contextmenu', onContextMenu);
      item.element.addEventListener('dblclick', onDblClick);

      events.push(item.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();
          events = null;

          item.element.removeEventListener('contextmenu', onContextMenu);
          item.element.removeEventListener('dblclick', onDblClick);
      }));

      events.push(treeItem.once('destroy', function() {
          // if entity removed, perform search again
          performSearch();
      }));

      return item;
  };


  var performSearch = function() {
      var query = lastSearch;

      // clear results list
      results.clear();
      itemsIndex = { };

      if (query) {
          var result = editor.call('entities:fuzzy-search', query);

          hierarchy.hidden = true;
          results.hidden = false;

          var selected = [ ];
          if (editor.call('selector:type') === 'entity')
              selected = editor.call('selector:items');

          for(var i = 0; i < result.length; i++) {
              var item = addItem(result[i]);

              itemsIndex[result[i].get('resource_id')] = item;

              if (selected.indexOf(result[i]) !== -1)
                  item.selected = true;

              results.append(item);
          }
      } else {
          results.hidden = true;
          hierarchy.hidden = false;
      }
  };


  search.on('change', function(value) {
      value = value.trim();

      if (lastSearch === value) return;
      lastSearch = value;

      if (value) {
          search.class.add('not-empty');
      } else {
          search.class.remove('not-empty');
      }

      performSearch();
  });
});


/* editor/entities/entities-load.js */
editor.on('load', function() {
  var hierarchyOverlay = new pcui.Container({
      flex: true
  });
  hierarchyOverlay.class.add('progress-overlay');
  editor.call('layout.hierarchy').append(hierarchyOverlay);

  var p = new ui.Progress();
  p.on('progress:100', function() {
      hierarchyOverlay.hidden = true;
  });
  hierarchyOverlay.append(p);
  p.hidden = true;

  var loadedEntities = false;

  editor.method('entities:loaded', function() {
      return loadedEntities;
  });

  editor.on('scene:raw', function(data) {
      editor.call('selector:clear');
      editor.call('entities:clear');
      editor.call('attributes:clear');

      var total = Object.keys(data.entities).length;
      var i = 0;

      // list
      for(var key in data.entities) {
          editor.call('entities:add',  new Observer(data.entities[key]));
          p.progress = (++i / total) * 0.8 + 0.1;
      }

      p.progress = 1;

      loadedEntities = true;
      editor.emit('entities:load');
  });

  editor.on('realtime:disconnected', function() {
      editor.call('selector:clear');
      editor.call('entities:clear');
      editor.call('attributes:clear');
  });

  editor.call('attributes:clear');

  editor.on('scene:unload', function () {
      editor.call('entities:clear');
      editor.call('attributes:clear');
  });

  editor.on('scene:beforeload', function () {
      hierarchyOverlay.hidden = false;
      p.hidden = false;
      p.progress = 0.1;
  });
});


/* editor/entities/entities-layout-utils.js */
editor.once('load', function() {
  'use strict';

  var getLayoutGroup = function(entityId) {
      var entity = editor.call('entities:get', entityId);
      return entity && entity.entity && entity.entity.layoutgroup;
  };

  var getLayoutChild = function(entityId) {
      var entity = editor.call('entities:get', entityId);
      return entity && entity.entity && entity.entity.layoutchild;
  };

  function forceSet(entity, path, value) {
      entity.set(path, value, false, false, true);
  }

  // Update the stored positions and sizes of entities that are children
  // of a layout group. This is necessary because if the user the disables
  // a layout group or moves its children out to a different part of the
  // graph, we still want the positions to stay the same after the page
  // is refreshed.
  editor.method('entities:layout:storeLayout', function(childEntityIds) {
      for (var i = 0; i < childEntityIds.length; ++i) {
          var entity = editor.call('entities:get', childEntityIds[i]);
          var historyEnabled = entity.history.enabled;
          entity.history.enabled = false;

          forceSet(entity, 'components.element.width', entity.entity.element.width);
          forceSet(entity, 'components.element.height', entity.entity.element.height);

          var anchor = entity.entity.element.anchor;
          forceSet(entity, 'components.element.anchor', [anchor.x, anchor.y, anchor.z, anchor.w]);

          var pos = entity.entity.getLocalPosition();
          forceSet(entity, 'position', [pos.x, pos.y, pos.z]);

          entity.history.enabled = historyEnabled;
      }
  });

  // return true if the entity's properties are controlled by a layout group parent
  editor.method('entities:layout:isUnderControlOfLayoutGroup', function(entity) {
      var layoutGroup = getLayoutGroup(entity.get('parent'));
      var isElement = entity.has('components.element');
      var exludedFromLayout = entity.get('components.layoutchild.excludeFromLayout');

      var isControlledByLayoutGroup = layoutGroup && layoutGroup.enabled && !exludedFromLayout;

      return isElement && isControlledByLayoutGroup;
  });

  editor.method('entities:layout:scheduleReflow', function(entityId) {
      pc.app.systems.layoutgroup.scheduleReflow(getLayoutGroup(entityId));
  });
});


/* editor/entities/entities-history.js */
editor.once('load', function() {
  'use strict';

  editor.on('entities:add', function(entity) {
      if (entity.history)
          return;

      var resourceId = entity.get('resource_id');

      entity.history = new ObserverHistory({
          item: entity,
          prefix: 'entity.' + resourceId + '.',
          getItemFn: function () {
              return editor.call('entities:get', resourceId);
          }
      });

      // record history
      entity.history.on('record', function(action, data) {
          editor.call('history:' + action, data);
      });
  });
});


/* editor/entities/entities-sync.js */
editor.once('load', function() {
  'use strict';


  var syncPaths = [
      'name',
      'tags',
      'parent',
      'children',
      'position',
      'rotation',
      'scale',
      'enabled',
      'components'
  ];

  editor.on('entities:add', function(entity) {
      if (entity.sync)
          return;

      entity.sync = new ObserverSync({
          item: entity,
          prefix: [ 'entities', entity.get('resource_id') ],
          paths: syncPaths
      });

      // client > server
      entity.sync.on('op', function(op) {
          editor.call('realtime:scene:op', op);
      });
  });


  // server > client
  editor.on('realtime:scene:op:entities', function(op) {
      var entity = null;
      if (op.p[1])
          entity = editor.call('entities:get', op.p[1]);

      if (op.p.length === 2) {
          if (op.hasOwnProperty('od')) {
              // delete entity
              if (entity) {
                  editor.call('entities:remove', entity);
              } else {
                  console.log('delete operation entity not found', op);
              }
          } else if (op.hasOwnProperty('oi')) {
              // new entity
              editor.call('entities:add', new Observer(op.oi));
          } else {
              console.log('unknown operation', op);
          }
      } else if (entity) {
          // write operation
          entity.sync.write(op);
      } else {
          console.log('unknown operation', op);
      }
  });
});


/* editor/entities/entities-migrations.js */
editor.once('load', function() {
  'use strict'

  editor.on('entities:add', function(entity) {
      setTimeout(function() {
          entity.history.enabled = false;

          // tags
          if (! entity.has('tags'))
              entity.set('tags', [ ]);

          // components

          // camera
          if (entity.has('components.camera')) {
              // frustumCulling
              if (! entity.has('components.camera.frustumCulling')) {
                  entity.set('components.camera.frustumCulling', false);
              }

              // layers
              if (! entity.has('components.camera.layers')) {
                  entity.set('components.camera.layers', []);
                  entity.insert('components.camera.layers', LAYERID_WORLD);
                  entity.insert('components.camera.layers', LAYERID_DEPTH);
                  entity.insert('components.camera.layers', LAYERID_SKYBOX);
                  entity.insert('components.camera.layers', LAYERID_IMMEDIATE);
                  entity.insert('components.camera.layers', LAYERID_UI);
              }
          }

          // light
          if (entity.has('components.light')) {
              // isStatic
              if (! entity.has('components.light.isStatic'))
                  entity.set('components.light.isStatic', false);

              // bake
              if (! entity.has('components.light.bake'))
                  entity.set('components.light.bake', false);

              // bakeDir
              if (! entity.has('components.light.bakeDir'))
                  entity.set('components.light.bakeDir', true);

              // affectDynamic
              if (! entity.has('components.light.affectDynamic'))
                  entity.set('components.light.affectDynamic', true);

              // affectLightmapped
              if (! entity.has('components.light.affectLightmapped'))
                  entity.set('components.light.affectLightmapped', false);

              // shadowUpdateMode
              var shadowUpdateMode = entity.get('components.light.shadowUpdateMode');
              if (shadowUpdateMode === null || isNaN(shadowUpdateMode))
                  entity.set('components.light.shadowUpdateMode', pc.SHADOWUPDATE_REALTIME);

              // shadowType
              if (! entity.has('components.light.shadowType'))
                  entity.set('components.light.shadowType', 0);

              // vsmBlurMode
              if (! entity.has('components.light.vsmBlurMode'))
                  entity.set('components.light.vsmBlurMode', 0);

              // vsmBlurSize
              if (! entity.has('components.light.vsmBlurSize'))
                  entity.set('components.light.vsmBlurSize', 5);

              // vsmBias
              if (! entity.has('components.light.vsmBias'))
                  entity.set('components.light.vsmBias', 0.01 * 0.25);

              // cookieAsset
              if (! entity.has('components.light.cookieAsset'))
                  entity.set('components.light.cookieAsset', null);

              // cookieIntensity
              if (! entity.has('components.light.cookieIntensity'))
                  entity.set('components.light.cookieIntensity', 1.0);

              // cookieFalloff
              if (! entity.has('components.light.cookieFalloff'))
                  entity.set('components.light.cookieFalloff', true);

              // cookieChannel
              if (! entity.has('components.light.cookieChannel'))
                  entity.set('components.light.cookieChannel', 'rgb');

              // cookieAngle
              if (! entity.has('components.light.cookieAngle'))
                  entity.set('components.light.cookieAngle', 0);

              // cookieScale
              if (! entity.has('components.light.cookieScale'))
                  entity.set('components.light.cookieScale', [ 1.0, 1.0 ]);

              // cookieOffset
              if (! entity.has('components.light.cookieOffset'))
                  entity.set('components.light.cookieOffset', [ 0.0, 0.0 ]);

              // layers
              if (! entity.has('components.light.layers')) {
                  entity.set('components.light.layers', []);
                  entity.insert('components.light.layers', LAYERID_WORLD);
              }
          }

          // model
          if(entity.has('components.model')) {
              // isStatic
              if (! entity.has('components.model.isStatic'))
                  entity.set('components.model.isStatic', false);

              // lightmapped
              if (! entity.has('components.model.lightmapped'))
                  entity.set('components.model.lightmapped', false);

              // castShadowsLightmap
              if (! entity.has('components.model.castShadowsLightmap'))
                  entity.set('components.model.castShadowsLightmap', true);

              // lightmapSizeMultiplier
              if (! entity.has('components.model.lightmapSizeMultiplier'))
                  entity.set('components.model.lightmapSizeMultiplier', 1.0);

              // batch group id
              if (! entity.has('components.model.batchGroupId'))
                  entity.set('components.model.batchGroupId', null);

              // layers
              if (! entity.has('components.model.layers')) {
                  entity.set('components.model.layers', []);
                  entity.insert('components.model.layers', LAYERID_WORLD);
              }
          }

          // element
          if (entity.has('components.element')) {
              var color = entity.get('components.element.color');
              var opacity = 1.0;
              if (color.length > 3) {
                  opacity = color[3];
                  entity.set('components.element.color', [color[0], color[1], color[2]]);
              }

              if (! entity.has('components.element.opacity')) {
                  entity.set('components.element.opacity', opacity);
              }

              if (! entity.has('components.element.useInput')) {
                  entity.set('components.element.useInput', false);
              }

              if (! entity.has('components.element.autoWidth')) {
                  entity.set('components.element.autoWidth', entity.get('components.element.type') === 'text');
              }

              if (! entity.has('components.element.autoHeight')) {
                  entity.set('components.element.autoHeight', entity.get('components.element.type') === 'text');
              }

              if (! entity.has('components.element.margin')) {
                  if (entity.entity && entity.entity.element) {
                      var margin = entity.entity.element.margin;
                      entity.set('components.element.margin', [margin.x, margin.y, margin.z, margin.w]);
                  } else {
                      entity.set('components.element.margin', [0, 0, 0, 0]);
                  }
              }

              if (! entity.has('components.element.alignment')) {
                  entity.set('components.element.alignment', [0.5, 0.5]);
              }

              if (! entity.has('components.element.wrapLines')) {
                  entity.set('components.element.wrapLines', false);
              }

              if (! entity.has('components.element.batchGroupId')) {
                  entity.set('components.element.batchGroupId', null);
              }
              if (! entity.has('components.element.mask')) {
                  entity.set('components.element.mask', false);
              }
              if (! entity.has('components.element.spriteAsset')) {
                  entity.set('components.element.spriteAsset', null);
              }
              if (! entity.has('components.element.spriteFrame')) {
                  entity.set('components.element.spriteFrame', 0);
              }
              if (! entity.has('components.element.pixelsPerUnit')) {
                  entity.set('components.element.pixelsPerUnit', null);
              }

              if (! entity.has('components.element.outlineColor')) {
                  entity.set('components.element.outlineColor', [0.0, 0.0, 0.0, 1.0]);
              }
              if (! entity.has('components.element.outlineThickness')) {
                  entity.set('components.element.outlineThickness', 0.0);
              }
              if (! entity.has('components.element.shadowColor')) {
                  entity.set('components.element.shadowColor', [0.0, 0.0, 0.0, 1.0]);
              }
              if (! entity.has('components.element.shadowOffset')) {
                  entity.set('components.element.shadowOffset', [0.0, 0.0]);
              }

              // layers
              if (! entity.has('components.element.layers')) {
                  entity.set('components.element.layers', []);
                  entity.insert('components.element.layers', LAYERID_UI);
              }

              if (!entity.has('components.element.autoFitWidth')) {
                  entity.set('components.element.autoFitWidth', false);
              }

              if (!entity.has('components.element.autoFitHeight')) {
                  entity.set('components.element.autoFitHeight', false);
              }

              if (!entity.has('components.element.maxLines')) {
                  entity.set('components.element.maxLines', null);
              }

              if (!entity.has('components.element.minFontSize')) {
                  entity.set('components.element.minFontSize', 8);
              }

              if (!entity.has('components.element.maxFontSize')) {
                  entity.set('components.element.maxFontSize', entity.get('components.element.fontSize') || 32);
              }

              if (! entity.has('components.element.enableMarkup')) {
                  entity.set('components.element.enableMarkup', false);
              }
          }

          // sprite
          if (entity.has('components.sprite')) {
              if (! entity.has('components.sprite.width')) {
                  entity.set('components.sprite.width', 1);
              }
              if (! entity.has('components.sprite.height')) {
                  entity.set('components.sprite.height', 1);
              }
              // layers
              if (! entity.has('components.sprite.layers')) {
                  entity.set('components.sprite.layers', []);
                  entity.insert('components.sprite.layers', LAYERID_WORLD);
              }
              // draw order
              if (! entity.has('components.sprite.drawOrder')) {
                  entity.set('components.sprite.drawOrder', 0);
              }
          }

          // layoutchild
          if (entity.has('components.layoutchild')) {
              if (! entity.has('components.layoutchild.excludeFromLayout')) {
                  entity.set('components.layoutchild.excludeFromLayout', false);
              }
          }

          // particles
          if (entity.has('components.particlesystem')) {
              // layers
              if (! entity.has('components.particlesystem.layers')) {
                  entity.set('components.particlesystem.layers', []);
                  entity.insert('components.particlesystem.layers', LAYERID_WORLD);
              }
              if (! entity.has('components.particlesystem.emitterRadiusInner')) {
                  entity.set('components.particlesystem.emitterRadiusInner', 0.0);
              }
              if (! entity.has('components.particlesystem.emitterExtentsInner')) {
                  entity.set('components.particlesystem.emitterExtentsInner', [0.0, 0.0, 0.0]);
              }
              if (! entity.has('components.particlesystem.orientation')) {
                  entity.set('components.particlesystem.orientation', 0);
              }
              if (! entity.has('components.particlesystem.particleNormal')) {
                  entity.set('components.particlesystem.particleNormal', [0.0, 1.0, 0.0]);
              }
              if (! entity.has('components.particlesystem.radialSpeedGraph')) {
                  entity.set('components.particlesystem.radialSpeedGraph', {
                      type: 1,
                      keys: [0, 0],
                      betweenCurves: false
                  });
              }
              if (! entity.has('components.particlesystem.radialSpeedGraph2')) {
                  entity.set('components.particlesystem.radialSpeedGraph2', {
                      type: 1,
                      keys: [0, 0]
                  });
              }
              if (! entity.has('components.particlesystem.localSpace')) {
                  entity.set('components.particlesystem.localSpace', false);
              }
          }

          entity.history.enabled = true;
      }, 0);
  });
});


/* editor/entities/entities-scripts.js */
editor.once('load', function () {
  'use strict';

  // Default values per script attribute type
  var DEFAULTS = {
      boolean: false,
      number: 0,
      string: '',
      json: '{ }',
      asset: null,
      entity: null,
      rgb: [1, 1, 1],
      rgba: [1, 1, 1, 1],
      vec2: [0, 0],
      vec3: [0, 0, 0],
      vec4: [0, 0, 0, 0],
      curve: { keys: [0, 0], type: CURVE_SPLINE }
  };

  // The expected typeof value for each script attribute type
  var TYPES = {
      boolean: 'boolean',
      number: 'number',
      string: 'string',
      json: 'string',
      asset: 'number',
      entity: 'string',
      rgb: 'object',
      rgba: 'object',
      vec2: 'object',
      vec3: 'object',
      vec4: 'object',
      curve: 'object'
  };

  // Indexes all entities with scripts
  // When primary script is set, update attributes on entities components
  // When script attributes change, update attributes on entities components
  var EntitiesScriptsIndex = function () {
      this._index = {};
  };

  // Returns a list of entities that have the specified script name
  EntitiesScriptsIndex.prototype.listEntitiesByScript = function (script) {
      var result = [];
      var entry = this._index[script];
      if (entry) {
          for (var key in entry) {
              result.push(entry[key].entity);
          }
      }

      return result;
  };

  // Adds an entry into the index when the specified
  // script name has been added to the specified entity.
  EntitiesScriptsIndex.prototype.add = function (entity, script) {
      var index = this._index;

      if (!index[script])
          index[script] = {};

      if (index[script][entity.get('resource_id')])
          return;

      index[script][entity.get('resource_id')] = {
          entity: entity,
          asset: null,
          events: []
      };

      this._updateAllAttributes(entity, script);
  };

  // When the specified script is removed from the specified entity
  // remove it from the index
  EntitiesScriptsIndex.prototype.remove = function (entity, script) {
      var index = this._index;

      if (!index[script])
          return;

      var item = index[script][entity.get('resource_id')];
      if (!item) return;

      for (var i = 0; i < item.events.length; i++)
          item.events[i].unbind();

      delete index[script][entity.get('resource_id')];
      if (Object.keys(index[script]).length === 0)
          delete index[script];
  };

  EntitiesScriptsIndex.prototype._updateAllAttributes =  function (entity, script) {
      var asset = editor.call('assets:scripts:assetByScript', script);
      if (!asset) return;

      var i;
      var history;
      var index = this._index;
      var item = index[script][entity.get('resource_id')];
      var assetOld = null;

      // clean up old item.asset if it points to a different script asset
      if (item.asset && item.asset !== asset.get('id')) {
          assetOld = item.asset;

          for (i = 0; i < item.events.length; i++)
              item.events[i].unbind();

          item.events = [];
          item.asset = asset.get('id');
      }

      // unset attributes
      var attributes = entity.get('components.script.scripts.' + script + '.attributes');
      for (var key in attributes) {
          if (!attributes.hasOwnProperty(key))
              continue;

          if (!asset.has('data.scripts.' + script + '.attributes.' + key)) {
              history = entity.history.enabled;
              entity.history.enabled = false;
              entity.unset('components.script.scripts.' + script + '.attributes.' + key);
              entity.history.enabled = history;
          }
      }

      // set/update attributes
      var attributesOrder = asset.get('data.scripts.' + script + '.attributesOrder');
      for (i = 0; i < attributesOrder.length; i++) {
          var name = attributesOrder[i];
          var attribute = asset.get('data.scripts.' + script + '.attributes.' + name);

          var oldAttribute = null;
          if (assetOld) {
              oldAttribute = assetOld.get('data.scripts.' + script + '.attributes.' + name);
          }

          this._setNewDefaultAttributeValueIfNeeded(entity, script, name, attribute, oldAttribute);
      }

      // subscribe to script asset attribute changes
      // set attribute
      var self = this;
      item.events.push(asset.on('*:set', function (path, attribute, old) {
          self._onSetAssetField(entity, script, path, attribute, old);

      }));
      // unset attribute
      item.events.push(asset.on('*:unset', function (path, attribute) {
          self._onUnsetAssetField(entity, script, path, attribute);
      }));
  };

  EntitiesScriptsIndex.prototype._setNewDefaultAttributeValueIfNeeded = function (entity, script, name, attribute, oldAttribute) {
      if (! oldAttribute) {
          oldAttribute = attribute;
      }

      var setNewDefaultValue = false;
      var oldDefaultValue = this._getDefaultAttributeValue(oldAttribute);

      if (entity.has('components.script.scripts.' + script + '.attributes.' + name)) {
          // update attribute
          var value = entity.get('components.script.scripts.' + script + '.attributes.' + name);
          setNewDefaultValue = this._isValueEqualToOldDefault(value, oldDefaultValue);

          // value type
          if (!setNewDefaultValue && ((typeof (value) !== typeof (oldDefaultValue) && oldDefaultValue !== null) || attribute.type !== oldAttribute.type || attribute.array !== oldAttribute.array)) {
              setNewDefaultValue = true;
          }

          // curve types
          if (!setNewDefaultValue && attribute.type === 'curve') {
              if (attribute.color || attribute.curves) {
                  var len = attribute.color ? attribute.color.length : attribute.curves.length;
                  if (attribute.array) {
                      if (!value || (!(value instanceof Array))) {
                          setNewDefaultValue = true;
                      } else {
                          for (var j = 0; j < value.length && !setNewDefaultValue; j++) {
                              var val = value[j];
                              if (len !== 1 && (!(val.keys[0] instanceof Array) || val.keys.length !== len)) {
                                  setNewDefaultValue = true;
                              } else if (len === 1 && (val.keys[0] instanceof Array)) {
                                  setNewDefaultValue = true;
                              }
                          }
                      }
                  } else {
                      if (len !== 1 && (!(value.keys[0] instanceof Array) || value.keys.length !== len)) {
                          setNewDefaultValue = true;
                      } else if (len === 1 && (value.keys[0] instanceof Array)) {
                          setNewDefaultValue = true;
                      }
                  }

              } else if (value.keys[0] instanceof Array) {
                  setNewDefaultValue = true;
              }
          }
      } else {
          // set new attribute
          setNewDefaultValue = true;
      }

      if (setNewDefaultValue) {
          var newDefaultValue = this._getDefaultAttributeValue(attribute);
          var history = entity.history.enabled;
          entity.history.enabled = false;
          entity.set('components.script.scripts.' + script + '.attributes.' + name, newDefaultValue);
          entity.history.enabled = history;
      }
  };

  // Returns a new default value for the specified attribute
  EntitiesScriptsIndex.prototype._getDefaultAttributeValue = function (attribute) {
      var value = attribute.array ? [] : null;

      if (attribute.default !== undefined && attribute.default !== null) {
          if (attribute.array) {
              if (attribute.default instanceof Array) {
                  value = attribute.default;
                  for (var i = 0; i < attribute.default.length; i++) {
                      if (typeof (attribute.default[i]) !== TYPES[attribute.type]) {
                          value = [];
                          break;
                      }
                  }
              }
          } else if (typeof (attribute.default) === TYPES[attribute.type]) {
              value = attribute.default;
          }
      }

      if (value === null) {
          value = DEFAULTS[attribute.type];
          if (value instanceof Array) {
              value = value.slice(0);
          }

          if (attribute.type === 'curve') {
              if (attribute.array) {
                  value = [];
              } else {
                  value = utils.deepCopy(value);
                  if (attribute.color || attribute.curves) {
                      var len = attribute.color ? attribute.color.length : attribute.curves.length;
                      var v = attribute.color ? 1 : 0;
                      value.keys = [];
                      for (var c = 0; c < len; c++) {
                          value.keys.push([0, v]);
                      }
                  }
              }
          }
      }

      return value;
  };

  // Checks if the specified value equals the default attribute value
  EntitiesScriptsIndex.prototype._isValueEqualToOldDefault = function (value, defaultValue) {
      if ((defaultValue instanceof Array) && (value instanceof Array) && defaultValue.equals(value)) {
          // was default array value
          return true;
      } else if ((defaultValue instanceof Object) && (value instanceof Object) && defaultValue.type === value.type && (defaultValue.keys instanceof Array) && (value.keys instanceof Array) && defaultValue.keys.length === value.keys.length) {
          if ((defaultValue.keys[0] instanceof Array) && (value.keys[0] instanceof Array)) {
              for (var k = 0; k < defaultValue.keys.length; k++) {
                  if (!defaultValue.keys[k].equals(value.keys[k])) {
                      // was curveset default value
                      return false;
                  }
              }
              return true;
          } else if (defaultValue.keys.equals(value.keys)) {
              // was curve default value
              return true;
          }
      } else if (defaultValue === value) {
          // was default value
          return true;
      }
      return false;
  };

  // Called when a new entity is added. Adds the entity to the index
  // and subscribes to component script events
  EntitiesScriptsIndex.prototype.onEntityAdd = function (entity) {
      var self = this;

      var scripts = entity.get('components.script.order');
      if (scripts) {
          for (var i = 0; i < scripts.length; i++) {
              self.add(entity, scripts[i]);
          }
      }

      entity.on('components.script.order:insert', function (script) {
          self.add(entity, script);
      });

      entity.on('components.script.order:remove', function (script) {
          self.remove(entity, script);
      });

      entity.on('components.script:unset', function (scriptComponent) {
          var scriptOrder = scriptComponent && scriptComponent.order;
          if (scriptOrder) {
              var i = scriptOrder.length;
              while (i--) {
                  self.remove(entity, scriptOrder[i]);
              }
          }
      });
  };

  // Called when an entity is removed to remove the entity from the index
  EntitiesScriptsIndex.prototype.onEntityRemove = function (entity) {
      var scripts = entity.get('components.script.order');
      if (scripts) {
          var i = scripts.length;
          while (i--) {
              this.remove(entity, scripts[i]);
          }
      }
  };

  // Called when the primary script is set
  EntitiesScriptsIndex.prototype.onSetPrimaryScript = function (asset, script) {
      var index = this._index;
      if (!index[script])
          return;

      for (var key in index[script]) {
          if (!index[script].hasOwnProperty(key))
              continue;

          this._updateAllAttributes(index[script][key].entity, script);
      }
  };

  // Handles setting the script attributes on a script asset
  EntitiesScriptsIndex.prototype._onSetAssetField = function (entity, script, path, attribute, oldAttribute) {
      if (!path.startsWith('data.scripts.' + script + '.attributes.'))
          return;

      var parts = path.split('.');
      if (parts.length !== 5)
          return;

      var name = parts[4];

      this._setNewDefaultAttributeValueIfNeeded(entity, script, name, attribute, oldAttribute);
  };

  // Handled unsetting script attributes from a script asset
  EntitiesScriptsIndex.prototype._onUnsetAssetField = function (entity, script, path, attribute) {
      if (!path.startsWith('data.scripts.' + script + '.attributes.'))
          return;

      var parts = path.split('.');
      if (parts.length !== 5)
          return;

      var name = parts[4];

      if (!entity.has('components.script.scripts.' + script + '.attributes.' + name))
          return;

      var history = entity.history.enabled;
      entity.history.enabled = false;
      entity.unset('components.script.scripts.' + script + '.attributes.' + name);
      entity.history.enabled = history;
  };

  // create a new instance of the index
  var entitiesScriptsIndex = new EntitiesScriptsIndex();

  // register event listeners
  editor.on('entities:add', function (entity) {
      entitiesScriptsIndex.onEntityAdd(entity);
  });

  editor.on('entities:remove', function (entity) {
      entitiesScriptsIndex.onEntityRemove(entity);
  });

  editor.on('assets:scripts:primary:set', function (asset, script) {
      entitiesScriptsIndex.onSetPrimaryScript(asset, script);
  });

  editor.method('entities:list:byScript', function (script) {
      return entitiesScriptsIndex.listEntitiesByScript(script);
  });
});


/* editor/entities/entities-hotkeys.js */
editor.once('load', function() {
  'use strict';

  // new
  editor.call('hotkey:register', 'entity:new', {
      key: 'e',
      ctrl: true,
      callback: function() {
          if (! editor.call('permissions:write'))
              return;

          if (editor.call('picker:isOpen')) return;

          var type = editor.call('selector:type');
          var items = editor.call('selector:items');

          if (type === 'entity') {
              if (items.length !== 1)
                  return;

              editor.call('entities:new', {
                  parent: items[0]
              });
          } else {
              editor.call('entities:new');
          }
      }
  });


  // duplicate
  editor.call('hotkey:register', 'entity:duplicate', {
      key: 'd',
      ctrl: true,
      callback: function () {
          if (! editor.call('permissions:write')) return;
          if (editor.call('picker:isOpen')) return;

          var type = editor.call('selector:type');
          var items = editor.call('selector:items');

          if (! items.length) return;

          if (type === 'entity') {
              if (items.indexOf(editor.call('entities:root')) !== -1) return;
              editor.call('entities:duplicate', items);
          } else if (type === 'asset' && items.length === 1) {
              if (items[0].get('type') !== 'material' && items[0].get('type') !== 'sprite') return;
              editor.call('assets:duplicate', items[0]);
          }
      }
  });

  // delete
  var deleteCallback = function() {
      if (editor.call('picker:isOpen')) return;

      if (! editor.call('permissions:write'))
          return;

      var type = editor.call('selector:type');
      if (type !== 'entity')
          return;

      var root = editor.call('entities:root');
      var items = editor.call('selector:items');

      if (items.indexOf(root) !== -1)
          return;

      editor.call('entities:delete', items);
  };
  // delete
  editor.call('hotkey:register', 'entity:delete', {
      key: 'delete',
      callback: deleteCallback
  });
  // ctrl + backspace
  editor.call('hotkey:register', 'entity:delete', {
      ctrl: true,
      key: 'backspace',
      callback: deleteCallback
  });

  // copy
  editor.call('hotkey:register', 'entity:copy', {
      key: 'c',
      ctrl: true,
      skipPreventDefault: true,
      callback: function () {
          // write permissions only (perhaps we could also allow read permissions)
          if (! editor.call('permissions:write'))
              return;

          if (editor.call('picker:isOpen')) return;

          var type = editor.call('selector:type');
          if (type !== 'entity')
              return;

          var items = editor.call('selector:items');
          if (!items.length)
              return;

          editor.call('entities:copy', items);
      }
  });

  // paste
  editor.call('hotkey:register', 'entity:paste', {
      key: 'v',
      ctrl: true,
      callback: function () {
          // write permissions only (perhaps we could also allow read permissions)
          if (! editor.call('permissions:write'))
              return;

          if (editor.call('picker:isOpen')) return;

          var items = editor.call('selector:items');
          if (items.length === 0 || items.length === 1 && editor.call('selector:type') === 'entity')
              editor.call('entities:paste', items[0]);
      }
  });

  // rename
  var onRename = function() {
      if (! editor.call('permissions:write'))
          return;

      var type = editor.call('selector:type');
      if (type !== 'entity')
          return;

      var items = editor.call('selector:items');
      if (! items.length)
          return;

      var root = editor.call('attributes.rootPanel');
      if (! root)
          return;

      var input = root.dom.querySelector('.ui-text-field.entity-name');

      if (! input || ! input.ui)
          return;

      input.ui.flash();
      input.ui.elementInput.select();
  };

  editor.method('entities:rename', onRename);

  editor.call('hotkey:register', 'entities:rename', {
      key: 'n',
      callback: function () {
          if (editor.call('picker:isOpen')) return;
          onRename();
      }
  });

  editor.call('hotkey:register', 'entities:rename:f2', {
      key: 'f2',
      callback: function () {
          if (editor.call('picker:isOpen')) return;
          onRename();
      }
  });
});


/* editor/entities/entities-context-menu.js */
editor.once('load', function() {
  'use strict';

  var entity = null; // the entity that was clicked on to open the context menu
  var items = [ ];   // the current selection
  var customMenuItems = [ ];
  var root = editor.call('layout.root');

  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');

  // Selenium's moveToObject (http://webdriver.io/api/action/moveToObject.html)
  // doesn't seem to work properly in terms of activating nested submenus in the
  // entities context menu. I spent a while trying various combinations of workarounds
  // from the Selenium side but nothing worked.
  //
  // This query string flag allows the submenus to be openable via mouse click,
  // which Selenium has no problem doing.
  var clickableSubmenus = /clickableContextSubmenus=true/.test(location.search);

  // create data for entity menu
  var menu;

  var getSelection = function() {
      var selection = editor.call('selector:items');

      if (selection.indexOf(entity) !== -1) {
          return selection;
      } else {
          return [ entity ];
      }
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

  var addBultinScript = function (entity, url) {
      if (! legacyScripts)
          return;

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

  var setField = function(field, value) {
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

  // wait until all entities are loaded
  // before creating the menu to make sure
  // that the menu data for entities have been created
  editor.once('entities:load', function () {
      var menuData = { };

      menuData['new-entity'] = {
          title: 'New Entity',
          className: 'menu-item-new-entity',
          filter: function() {
              return items.length === 1;
          },
          select: function () {
              editor.call('entities:new', {parent: items[0]});
          },
          items: editor.call('menu:entities:new', function () {return items[0];})
      };

      menuData['add-component'] = {
          title: 'Add Component',
          className: 'menu-item-add-component',
          items: editor.call('menu:entities:add-component')
      };

      if (legacyScripts) {
          menuData['add-builtin-script'] = {
              title: 'Add Built-In Script',
              filter: function () {
                  return items.length === 1;
              },
              items: {
                  'post-effects': {
                      title: 'Post-Effects',
                      filter: function () {
                          return items.length === 1;
                      },
                      items: { }
                  },
                  'camera-scripts': {
                      title: 'Camera',
                      filter: function () {
                          return items.length === 1;
                      },
                      items: { }
                  }
              }
          };
      } else {
          // TODO scripts2
          // built-in scripts
      }

      menuData['enable'] = {
          title: 'Enable',
          className: 'menu-item-enable',
          icon: '&#57651;',
          hide: function () {
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
              setField('enabled', true);
          }
      };

      menuData['disable'] = {
          title: 'Disable',
          className: 'menu-item-disable',
          icon: '&#57650;',
          hide: function () {
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
              setField('enabled', false);
          }
      };

      menuData['copy'] = {
          title: 'Copy',
          className: 'menu-item-copy',
          icon: '&#58193;',
          select: function() {
              editor.call('entities:copy', items);
          }
      };

      menuData['paste'] = {
          title: 'Paste',
          className: 'menu-item-paste',
          icon: '&#58184;',
          filter: function () {
              return items.length <= 1 && ! editor.call('entities:clipboard:empty');
          },
          select: function() {
              editor.call('entities:paste', entity);
          }
      };

      menuData['duplicate'] = {
          title: 'Duplicate',
          className: 'menu-item-duplicate',
          icon: '&#57638;',
          filter: function () {
              var items = getSelection();

              if (items.indexOf(editor.call('entities:root')) !== -1)
                  return false;

              return items.length > 0;
          },
          select: function() {
              editor.call('entities:duplicate', getSelection());
          }
      };

      menuData['delete'] = {
          title: 'Delete',
          className: 'menu-item-delete',
          icon: '&#57636;',
          filter: function () {
              var root = editor.call('entities:root');
              for(var i = 0; i < items.length; i++) {
                  if (items[i] === root)
                      return false;
              }
              return true;
          },
          select: function() {
              editor.call('entities:delete', items);
          }
      };

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
              menuData['add-builtin-script'].items[data.group].items[data.name] = {
                  title: data.title,
                  filter: function () {
                      return items.length === 1 &&
                             editor.call('permissions:write') &&
                             !hasLegacyScript(items[0], data.url) &&
                             (!data.requires || items[0].get('components.' + data.requires));
                  },
                  select: function () {
                      addBultinScript(items[0], data.url);
                  }
              };
          });
      } else {
          // TODO scripts2
          // built-in scripts
      }

      // menu
      menu = ui.Menu.fromData(menuData, { clickableSubmenus: clickableSubmenus });
      root.append(menu);

      menu.on('open', function() {
          var selection = getSelection();

          for(var i = 0; i < customMenuItems.length; i++) {
              if (! customMenuItems[i].filter)
                  continue;

              customMenuItems[i].hidden = ! customMenuItems[i].filter(selection);
          }
      });
  });

  editor.method('entities:contextmenu:add', function(data) {
      var item = new ui.MenuItem({
          text: data.text,
          icon: data.icon,
          value: data.value,
          hasChildren: !!(data.items && Object.keys(data.items).length > 0),
          clickableSubmenus: clickableSubmenus
      });

      item.on('select', function() {
          data.select.call(item, getSelection());
      });

      var parent = data.parent || menu;
      parent.append(item);

      if (data.filter)
          item.filter = data.filter;

      customMenuItems.push(item);

      return item;
  });

  editor.method('entities:contextmenu:open', function(item, x, y, ignoreSelection) {
      if (! menu || ! editor.call('permissions:write')) return;

      entity = item;

      if (ignoreSelection) {
          items = [ ];
      } else {
          items = getSelection();
      }

      menu.open = true;
      menu.position(x + 1, y);

      return true;
  });

  // get the entity that was right-clicked when opening the context menu
  editor.method('entities:contextmenu:entity', function () {
      return entity;
  });

  // for each entity added
  editor.on('entities:add', function(item) {
      // get tree item
      var treeItem = editor.call('entities:panel:get', item.get('resource_id'));
      if (! treeItem) return;

      // attach contextmenu event
      treeItem.element.addEventListener('contextmenu', function(evt) {
          var openned = editor.call('entities:contextmenu:open', item, evt.clientX, evt.clientY);

          if (openned) {
              evt.preventDefault();
              evt.stopPropagation();
          }
      });
  });
});


/* editor/entities/entities-components-menu.js */
editor.once('load', function() {
  'use strict';

  var logos = editor.call('components:logos');

  editor.method('menu:entities:add-component', function () {
      // Create empty menu with sub-menus
      var items = {
          'audio-sub-menu': {
              title: 'Audio',
              icon: logos.sound,
              items: {}
          },
          'ui-sub-menu': {
              title: 'User Interface',
              icon: logos.userinterface,
              items: {}
          },
          'physics-sub-menu': {
              title: 'Physics',
              icon: logos.rigidbody,
              items: {}
          },
      };

      // fill menu with available components
      var components = editor.call('components:schema');
      var list = editor.call('components:list');

      for (var i = 0; i < list.length; i++) {
          var key = list[i];
          var submenu = getSubMenu(key);
          if (submenu) {
              items[submenu].items[key] = makeAddComponentMenuItem(key, components, logos);
          } else {
              items[key] = makeAddComponentMenuItem(key, components, logos);
          }
      }

      // sort alphabetically and add to new object to be returned
      var orderedKeys = Object.keys(items).sort();
      var sorted = {};
      for (var i = 0; i < orderedKeys.length; i++) {
          sorted[orderedKeys[i]] = items[orderedKeys[i]];
      }

      return sorted;
  });

  var getSubMenu = function (key) {
      if (['audiolistener', 'sound'].indexOf(key) >= 0) return 'audio-sub-menu';
      if (['element', 'screen', 'layoutgroup', 'layoutchild', 'button', 'scrollview', 'scrollbar'].indexOf(key) >= 0) return 'ui-sub-menu';
      if (['rigidbody', 'collision'].indexOf(key) >= 0) return 'physics-sub-menu';

      return null;
  };

  // Get Entites on which to apply the result of the context menu
  // If the entity that is clicked on is part of a selection, then the entire
  // selection is returned.
  // Otherwise return just the entity that is clicked on.
  var getSelection = function() {
      var selection = editor.call('selector:items');
      var entity = editor.call('entities:contextmenu:entity');

      if (entity) {
          if (selection.indexOf(entity) !== -1) {
              return selection;
          } else {
              return [entity];
          }
      } else {
          return selection;
      }
  };

  var makeAddComponentMenuItem = function (key, components, logos) {
      var data = {
          title: components[key].$title,
          icon: logos[key],
          filter: function () {
              // if any entity in the selection does not have the component
              // then it should be available to add
              var selection = getSelection();
              var name = 'components.' + key;
              for (var i = 0, len = selection.length; i < len; i++) {
                  if (!selection[i].has(name)) {
                      return true;
                  }
              }

              // disable component in menu
              return false;
          },

          select: function () {
              var selection = getSelection();
              editor.call('entities:addComponent', selection, this._value)
          }
      };

      if (key === 'audiosource') {
          data.hide = function () {
              return !editor.call('settings:project').get('useLegacyAudio');
          };
      }

      return data;
  };
});


/* editor/entities/entities-pick.js */
editor.once('load', function() {
  'use strict';

  editor.on('viewport:pick:clear', function() {
      if (! editor.call('hotkey:ctrl'))
          editor.call('selector:clear');
  });

  editor.on('viewport:pick:node', function(node, picked) {
      // icon
      if (node._icon || (node.__editor && node._getEntity)) {
          node = node._getEntity();
          if (! node) return;
      }

      // get entity
      var entity = editor.call('entities:get', node.getGuid());
      if (! entity) return;

      // get selector data
      var type = editor.call('selector:type');
      var items = editor.call('selector:items');

      if (type === 'entity' && items.length === 1 && items.indexOf(entity) !== -1 && ! editor.call('hotkey:ctrl')) {
          // if entity already selected
          // try selecting model asset
          // with highlighting mesh instance
          if (node.model && node.model.type === 'asset' && node.model.model) {
              var meshInstances = node.model.model.meshInstances;

              for(var i = 0; i < meshInstances.length; i++) {
                  var instance = meshInstances[i];

                  if (instance !== picked && instance !== picked._staticSource)
                      continue;

                  var index = i;

                  // if the model component has a material mapping then
                  // open the model component otherwise go to the model asset
                  if (node.model.mapping && node.model.mapping[i] !== undefined) {
                      editor.call('selector:set', 'entity', [entity]);
                  } else {
                      // get model asset
                      var asset = editor.call('assets:get', node.model.asset);
                      if (! asset) break;

                      // select model asset
                      editor.call('selector:set', 'asset', [ asset ]);
                  }

                  // highlight selected node
                  setTimeout(function() {
                      var node = editor.call('attributes.rootPanel').dom.querySelector('.field-asset.node-' + index);
                      if (node) {
                          node.classList.add('active');
                          var field = node.querySelector('.ui-image-field');
                          field.focus();
                          field.blur();
                      }
                  }, 200);

                  break;
              }
          }
      } else {
          // select entity
          if (type === 'entity' && editor.call('hotkey:ctrl')) {
              // with ctrl
              if (items.indexOf(entity) !== -1) {
                  // deselect
                  editor.call('selector:remove', entity);
              } else {
                  // add to selection
                  editor.call('selector:add', 'entity', entity);
              }
          } else {
              // set selection
              editor.call('selector:set', 'entity', [ entity ]);
          }
      }
  })
});


/* editor/entities/entities-icons.js */
editor.once('load', function() {
  'use strict';

  var app;
  var iconsEntity;
  var textureNames = [ 'animation', 'audiolistener', 'audiosource', 'sound', 'camera', 'collision', 'light-point', 'light-directional', 'light-spot', 'particlesystem', 'rigidbody', 'script', 'unknown' ];
  var components = [ 'camera', 'light', 'audiolistener', 'audiosource', 'sound', 'particlesystem', 'script', 'animation', 'model' ];
  var icons = [ ];
  var pool = [ ];
  var dirtifyKeys = [
      'enabled:set',
      'components.model.type:set',
      'components.model.asset:set'
  ];
  var dirtifyLocalKeys = {
      'light': [
          'components.light.color.0:set',
          'components.light.color.1:set',
          'components.light.color.2:set',
          'components.light.type:set'
      ]
  };
  var material = null;
  var materialBehind = null;
  var iconColor = new pc.Color(1, 1, 1, 1);
  var textures = { };
  var scale = .5;
  var cameraRotation = new pc.Quat();
  var rotateMatrix = new pc.Mat4().setFromAxisAngle(pc.Vec3.LEFT, -90);
  var quadMaterial = new pc.Material();
  var selectedIds = { };

  // icon class
  function Icon() {
      var self = this;

      this.entity = null;
      this.behind = null;
      this.color = new pc.Color();
      this.colorUniform = new Float32Array(4);

      this._link = null;
      this.events = [ ];
      this.eventsLocal = [ ];
      this.local = '';
      this.dirty = true;
      this.dirtify = function() {
          self.dirty = true;
      };
  }

  Icon.prototype.entityCreate = function() {
      if (this.entity)
          return;

      if (! app) return; // webgl not available

      var self = this;

      this.entity = new pc.Entity('front', app);
      this.entity._icon = true;
      this.entity._getEntity = function() {
          return self._link && self._link.entity || null;
      };

      var layerFront = editor.call('gizmo:layers', 'Bright Gizmo');
      var layerBehind = editor.call('gizmo:layers', 'Dim Gizmo');

      this.entity.addComponent('model', {
          type: 'plane',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layerFront.id],
      });
      this.entity.model.meshInstances[0].__editor = true;
      this.entity.model.meshInstances[0].mask = GIZMO_MASK;

      if (this._link && this._link.entity)
          this.entity.setPosition(this._link.entity.getPosition());

      this.entity.setLocalScale(scale, scale, scale);
      this.entity.setRotation(cameraRotation);
      this.entity.rotateLocal(90, 0, 0);

      this.behind = new pc.Entity('behind', app);
      this.behind._icon = true;
      this.behind._getEntity = this.entity._getEntity;
      this.entity.addChild(this.behind);
      this.behind.addComponent('model', {
          type: 'plane',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layerBehind.id]
      });
      // this.behind.model.model.meshInstances[0].layer = pc.LAYER_GIZMO;
      this.behind.model.model.meshInstances[0].mask = GIZMO_MASK;
      this.behind.model.model.meshInstances[0].pick = false;

      iconsEntity.addChild(this.entity);
  };

  Icon.prototype.entityDelete = function() {
      if (! this.entity)
          return;

      this.entity.destroy();

      this.entity = null;
      this.behind = null;
  };

  Icon.prototype.update = function() {
      if (! this._link || ! this._link.entity)
          return;

      // don't render if selected or disabled
      if (! this._link.entity._enabled || ! this._link.entity._enabledInHierarchy || this._link.entity.__noIcon || scale === 0 || selectedIds[this._link.entity.getGuid()]) {
          if (this.entity)
              this.entityDelete();

          this.dirty = true;
          return;
      }

      if (this.entity) {
          // position
          this.entity.setPosition(this._link.entity.getPosition());
          this.entity.setLocalScale(scale, scale, scale);
          this.entity.setRotation(cameraRotation);
          this.entity.rotateLocal(90, 0, 0);
      }

      if (! this.dirty) return;
      this.dirty = false;

      // hide icon if model is set
      if (this._link.has('components.model') && this._link.get('components.model.enabled') && (this._link.get('components.model.type') !== 'asset' || this._link.get('components.model.asset'))) {
          if (this.entity)
              this.entityDelete();
          return;
      }

      var component = '';
      for(var i = 0; i < components.length; i++) {
          if (! this._link.has('components.' + components[i]))
              continue;

          component = components[i];
          break;
      }

      if (component) {
          if (! this.entity)
              this.entityCreate();

          this.entity.enabled = true;
          this.entity.model.material = material;
          this.behind.model.material = materialBehind;

          this.color.copy(iconColor);
          var textureName = components[i];
          if (components[i] === 'light') {
              textureName += '-' + this._link.entity.light.type;
              this.color.copy(this._link.entity.light.color);
          }

          if (! textureName || ! textures[textureName])
              textureName = 'unknown';

          this.entity.model.model.meshInstances[0].setParameter('texture_diffuseMap', textures[textureName]);
          this.colorUniform[0] = this.color.r;
          this.colorUniform[1] = this.color.g;
          this.colorUniform[2] = this.color.b;
          this.colorUniform[3] = this.color.a;
          this.entity.model.model.meshInstances[0].setParameter('uColor', this.colorUniform);

          this.behind.model.model.meshInstances[0].setParameter('texture_diffuseMap', textures[textureName]);
          this.color.a = 0.25;
          this.colorUniform[3] = this.color.a;
          this.behind.model.model.meshInstances[0].setParameter('uColor', this.colorUniform);

          if (this.local !== components[i]) {
              // clear local binds
              for(var n = 0; n < this.eventsLocal.length; n++)
                  this.eventsLocal[n].unbind();
              this.eventsLocal = [ ];

              // add local binds
              if (dirtifyLocalKeys[components[i]]) {
                  for(var n = 0; n < dirtifyLocalKeys[components[i]].length; n++)
                      this.eventsLocal.push(this._link.on(dirtifyLocalKeys[components[i]][n], this.dirtify));
              }
          }
      } else if (this.entity) {
          this.entityDelete();
      }
  };
  Icon.prototype.link = function(obj) {
      this.unlink();

      this._link = obj;
      for(var i = 0; i < dirtifyKeys.length; i++)
          this.events.push(obj.on(dirtifyKeys[i], this.dirtify));

      for(var i = 0; i < components.length; i++) {
          this.events.push(obj.on('components.' + components[i] + ':set', this.dirtify));
          this.events.push(obj.on('components.' + components[i] + ':unset', this.dirtify));
      }

      var self = this;
      this.events.push(obj.once('destroy', function() {
          self.unlink();
      }));

      icons.push(this);

      this.dirty = true;
  };
  Icon.prototype.unlink = function() {
      if (! this._link)
          return;

      for(var i = 0; i < this.events.length; i++)
          this.events[i].unbind();

      if (this.entity)
          this.entityDelete();

      this.events = [ ];
      this._link = null;

      var ind = icons.indexOf(this);
      icons.splice(ind, 1);
      pool.push(this);
  };

  editor.once('viewport:load', function() {
      app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      var shader;

      material = new pc.BasicMaterial();
      material.updateShader = function(device) {
          if (! shader) {
              shader = new pc.Shader(device, {
                  attributes: {
                      vertex_position: 'POSITION'
                  },
                  vshader: ' \
                      attribute vec3 vertex_position;\n \
                      uniform mat4 matrix_model;\n \
                      uniform mat4 matrix_viewProjection;\n \
                      varying vec2 vUv0;\n \
                      void main(void)\n \
                      {\n \
                          mat4 modelMatrix = matrix_model;\n \
                          vec4 positionW = modelMatrix * vec4(vertex_position, 1.0);\n \
                          gl_Position = matrix_viewProjection * positionW;\n \
                          vUv0 = vertex_position.xz + vec2(0.5);\n \
                          vUv0.y = 1.0 - vUv0.y;\n \
                      }\n',
                  fshader: ' \
                      precision ' + device.precision + ' float;\n \
                      uniform vec4 uColor;\n \
                      varying vec2 vUv0;\n \
                      uniform sampler2D texture_diffuseMap;\n \
                      void main(void)\n \
                      {\n \
                          float alpha = texture2D(texture_diffuseMap, vUv0).b;\n \
                          if (alpha < 0.5) discard;\n \
                          gl_FragColor = vec4(uColor.rgb, uColor.a * alpha);\n \
                      }\n'
              });
          }

          this.shader = shader;
      };
      material.update();

      materialBehind = new pc.BasicMaterial();
      materialBehind.blend = true;
      materialBehind.blendSrc = pc.BLENDMODE_SRC_ALPHA;
      materialBehind.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
      materialBehind.updateShader = material.updateShader;
      materialBehind.update();

      iconsEntity = new pc.Entity(app);
      app.root.addChild(iconsEntity);

      for(var i = 0; i < textureNames.length; i++) {
          textures[textureNames[i]] = new pc.Texture(app.graphicsDevice, {
              width: 64,
              height: 64
          });
          textures[textureNames[i]].anisotropy = 16;
          textures[textureNames[i]].addressU = pc.ADDRESS_CLAMP_TO_EDGE;
          textures[textureNames[i]].addressV = pc.ADDRESS_CLAMP_TO_EDGE;

          var img = new Image();
          img.textureName = textureNames[i];
          img.onload = function() {
              textures[this.textureName].setSource(this);
          };
          img.src = '/editor/scene/img/entity-icons/' + textureNames[i] + '.png';
      }

      editor.on('entities:add', function(obj) {
          var icon = pool.shift();
          if (! icon)
              icon = new Icon();

          icon.link(obj);
      });
  });

  editor.on('selector:change', function(type, items) {
      selectedIds = { };

      if (type !== 'entity')
          return;

      for(var i = 0; i < items.length; i++)
          selectedIds[items[i].get('resource_id')] = true;
  });

  editor.on('viewport:postUpdate', function() {
      if (app) cameraRotation.copy(editor.call('camera:current').getRotation());

      for(var i = 0; i < icons.length; i++)
          icons[i].update();
  });

  editor.method('viewport:icons:size', function(size) {
      if (size === undefined)
          return scale;

      scale = size;
      editor.call('viewport:render');
  });

  var settings = editor.call('settings:user');
  editor.call('viewport:icons:size', settings.get('editor.iconSize'));
  settings.on('editor.iconSize:set', function(size) {
      editor.call('viewport:icons:size', size);
  });
});


/* editor/entities/entities-gizmo-translate.js */
editor.once('load', function() {
  'use strict';

  var events = [ ];
  var items = [ ];
  var quat = new pc.Quat();
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();
  var startPosition = new pc.Vec3();
  var timeoutUpdatePosition, timeoutUpdateRotation;
  var coordSystem = 'world';
  var app;
  var gizmoMoving = false;
  var gizmoAxis, gizmoPlane;
  var movingStart = new pc.Vec3();
  var linesColorActive = new pc.Color(1, 1, 1, 1);
  var linesColor = new pc.Color(1, 1, 1, .2);
  var linesColorBehind = new pc.Color(1, 1, 1, .05);
  var immediateRenderOptions;
  var brightImmediateRenderOptions;

  editor.on('gizmo:coordSystem', function(system) {
      if (coordSystem === system)
          return;

      coordSystem = system;

      var pos = getGizmoPosition();
      if (pos)
          editor.call('gizmo:translate:position', pos.x, pos.y, pos.z);

      var rot = getGizmoRotation();
      if (rot)
          editor.call('gizmo:translate:rotation', rot[0], rot[1], rot[2]);

      editor.call('viewport:render');
  });

  // get position of gizmo based on selected entities
  var getGizmoPosition = function() {
      if (! items.length)
          return;

      if (items.length === 1) {
          if (items[0].obj.entity) {
              vecA.copy(items[0].obj.entity.getPosition());
          } else {
              return null;
          }
      } else if (coordSystem === 'local') {
          var reference = items[items.length - 1];
          var parent = reference.parent;
          while(parent) {
              reference = parent;
              parent = parent.parent;
          }
          vecA.copy(reference.obj.entity.getPosition());
      } else {
          var selection = editor.call('selection:aabb');
          if (! selection) return;
          vecA.copy(selection.center);
      }

      return vecA;
  };

  var getGizmoRotation = function() {
      if (! items.length)
          return;

      if (coordSystem === 'local') {
          var reference = items[items.length - 1];
          var parent = reference.parent;
          while(parent) {
              reference = parent;
              parent = parent.parent;
          }
          var rot = reference.obj.entity.getEulerAngles()
          return [ rot.x, rot.y, rot.z ];
      } else {
          return [ 0, 0, 0 ];
      }
  };

  // update gizmo position
  var updateGizmoPosition = function() {
      if (! items.length || timeoutUpdatePosition || gizmoMoving)
          return;

      timeoutUpdatePosition = true;

      setTimeout(function() {
          timeoutUpdatePosition = false;

          var vec = getGizmoPosition();
          if (vec)
              editor.call('gizmo:translate:position', vec.x, vec.y, vec.z);
      });
  };

  // update gizmo position
  var updateGizmoRotation = function() {
      if (! items.length || timeoutUpdateRotation)
          return;

      timeoutUpdateRotation = true;

      setTimeout(function() {
          timeoutUpdateRotation = false;

          var vec = getGizmoRotation();
          if (vec)
              editor.call('gizmo:translate:rotation', vec[0], vec[1], vec[2]);
      });
  };

  // start translating
  var onGizmoStart = function(axis, plane) {
      gizmoAxis = axis;
      gizmoPlane = plane;
      gizmoMoving = true;

      movingStart.copy(getGizmoPosition());

      for(var i = 0; i < items.length; i++) {
          var pos = items[i].obj.entity.getPosition();
          items[i].start[0] = pos.x;
          items[i].start[1] = pos.y;
          items[i].start[2] = pos.z;
          items[i].pos = items[i].start.slice(0);

          pos = items[i].obj.get('position');
          items[i].startLocal[0] = pos[0];
          items[i].startLocal[1] = pos[1];
          items[i].startLocal[2] = pos[2];

          items[i].obj.history.enabled = false;
      }
  };

  // end translating
  var onGizmoEnd = function() {
      gizmoMoving = false;
      var records = [ ];

      for(var i = 0; i < items.length; i++) {
          items[i].obj.history.enabled = true;

          var data = {
              get: items[i].obj.history._getItemFn,
              valueOld: items[i].startLocal.slice(0),
              value: items[i].obj.get('position')
          };

          records.push(data);
      }

      editor.call('history:add', {
          name: 'entities.translate',
          undo: function() {
              for(var i = 0; i < records.length; i++) {
                  var item = records[i].get();
                  if (! item)
                      continue;

                  item.history.enabled = false;
                  item.set('position', records[i].valueOld);
                  item.history.enabled = true;
              }
          },
          redo: function() {
              for(var i = 0; i < records.length; i++) {
                  var item = records[i].get();
                  if (! item)
                      continue;

                  item.history.enabled = false;
                  item.set('position', records[i].value);
                  item.history.enabled = true;
              }
          }
      });
  };

  // translated
  var onGizmoOffset = function(x, y, z) {
      timeoutUpdateRotation = true;

      for(var i = 0; i < items.length; i++) {
          if (items[i].child)
              continue;

          var entity = items[i].obj.entity;

          if (coordSystem === 'local') {
              vecA.set(x, y, z);

              // scale by inverse world scale to ensure correct movement
              entity.parent.getWorldTransform().getScale(vecB);
              vecB.x = 1 / vecB.x;
              vecB.y = 1 / vecB.y;
              vecB.z = 1 / vecB.z;

              quat.copy(entity.getLocalRotation()).transformVector(vecA, vecA);
              vecA.mul(vecB);
              entity.setLocalPosition(items[i].startLocal[0] + vecA.x, items[i].startLocal[1] + vecA.y, items[i].startLocal[2] + vecA.z);
          } else {
              entity.setPosition(items[i].start[0] + x, items[i].start[1] + y, items[i].start[2] + z);
          }

          // if (entity.collision) {
          //     app.systems.collision.onTransformChanged(entity.collision, entity.getPosition(), entity.getRotation(), entity.getLocalScale());
          // }

          var pos = entity.getLocalPosition();
          items[i].obj.set('position', [ pos.x, pos.y, pos.z ]);
      }

      timeoutUpdateRotation = false;

      var pos = getGizmoPosition();
      editor.call('gizmo:translate:position', pos.x, pos.y, pos.z);
  };

  var onRender = function() {
      if (! app) return; // webgl not available

      if (! gizmoMoving && items.length) {
          var dirty = false;
          for(var i = 0; i < items.length; i++) {
              if (! items[i].obj.entity)
                  continue;

              var pos = items[i].obj.entity.getPosition();
              if (pos.x !== items[i].pos[0] || pos.y !== items[i].pos[1] || pos.z !== items[i].pos[2]) {
                  dirty = true;
                  items[i].pos[0] = pos.x;
                  items[i].pos[1] = pos.y;
                  items[i].pos[2] = pos.z;
              }
          }

          if (dirty) {
              var pos = getGizmoPosition();
              editor.call('gizmo:translate:position', pos.x, pos.y, pos.z);
          }
      }

      if (gizmoMoving && items.length) {
          var camera = editor.call('camera:current');
          var pos;

          var len = coordSystem === 'local' ? items.length : 1;
          for(var i = 0; i < len; i++) {
              if (items[i].child)
                  continue;

              if (coordSystem === 'local') {
                  pos = items[i].obj.entity.getPosition();
                  quat.copy(items[i].obj.entity.getRotation());
              } else {
                  pos = editor.call('gizmo:translate:position');
                  quat.setFromEulerAngles(0, 0, 0);
              }

              // x
              vecB.set(camera.camera.farClip * 2, 0, 0);
              quat.transformVector(vecB, vecB).add(pos);
              vecC.set(camera.camera.farClip * -2, 0, 0);
              quat.transformVector(vecC, vecC).add(pos);
              app.renderLine(vecB, vecC, linesColorBehind, immediateRenderOptions);
              if ((gizmoAxis === 'x' && ! gizmoPlane) || (gizmoPlane && (gizmoAxis === 'y' || gizmoAxis === 'z'))) {
                  app.renderLine(vecB, vecC, linesColorActive, brightImmediateRenderOptions);
              } else {
                  app.renderLine(vecB, vecC, linesColor, brightImmediateRenderOptions);
              }

              // y
              vecB.set(0, camera.camera.farClip * 2, 0);
              quat.transformVector(vecB, vecB).add(pos);
              vecC.set(0, camera.camera.farClip * -2, 0);
              quat.transformVector(vecC, vecC).add(pos);
              app.renderLine(vecB, vecC, linesColorBehind, immediateRenderOptions);
              if ((gizmoAxis === 'y' && ! gizmoPlane) || (gizmoPlane && (gizmoAxis === 'x' || gizmoAxis === 'z'))) {
                  app.renderLine(vecB, vecC, linesColorActive, brightImmediateRenderOptions);
              } else {
                  app.renderLine(vecB, vecC, linesColor, brightImmediateRenderOptions);
              }

              // z
              vecB.set(0, 0, camera.camera.farClip * 2);
              quat.transformVector(vecB, vecB).add(pos);
              vecC.set(0, 0, camera.camera.farClip * -2);
              quat.transformVector(vecC, vecC).add(pos);
              app.renderLine(vecB, vecC, linesColorBehind, immediateRenderOptions);
              if ((gizmoAxis === 'z' && ! gizmoPlane) || (gizmoPlane && (gizmoAxis === 'x' || gizmoAxis === 'y'))) {
                  app.renderLine(vecB, vecC, linesColorActive, brightImmediateRenderOptions);
              } else {
                  app.renderLine(vecB, vecC, linesColor, brightImmediateRenderOptions);
              }
          }
      }
  };

  editor.once('viewport:load', function() {
      app = editor.call('viewport:app');

      immediateRenderOptions = {
          layer: editor.call("gizmo:layers", 'Axis Gizmo Immediate')
      };

      brightImmediateRenderOptions = {
          layer: editor.call("gizmo:layers", 'Bright Gizmo')
      }
  });

  var updateChildRelation = function() {
      var itemIds = { };
      for(var i = 0; i < items.length; i++) {
          itemIds[items[i].obj.get('resource_id')] = items[i];
      }

      for(var i = 0; i < items.length; i++) {
          var child = false;
          var parent = items[i].obj.entity._parent;
          var id = '';
          while(! child && parent) {
              id = parent.getGuid();
              if (itemIds[id]) {
                  parent = itemIds[id];
                  child = true;
                  break;
              }
              parent = parent._parent;
          }
          items[i].child = child;
          items[i].parent = child ? parent : null;
      }
  };

  var updateGizmo = function() {
      if (! editor.call('permissions:write'))
          return;

      var objects = editor.call('selector:items');

      for(var i = 0; i < events.length; i++)
          events[i].unbind();
      events = [ ];
      items = [ ];

      if (editor.call('selector:type') === 'entity' && editor.call('gizmo:type') === 'translate') {
          for(var i = 0; i < objects.length; i++) {
              if (! objects[i].entity)
                  continue;

              var pos = objects[i].entity.getPosition();

              items.push({
                  obj: objects[i],
                  pos: [ pos.x, pos.y, pos.z ],
                  start: [ 0, 0, 0 ],
                  startLocal: [ 0, 0, 0 ]
              });

              // position
              events.push(objects[i].on('position:set', updateGizmoPosition));
              // position.*
              for(var n = 0; n < 3; n++)
                  events.push(objects[i].on('position.' + n + ':set', updateGizmoPosition));

              // rotation
              events.push(objects[i].on('rotation:set', updateGizmoRotation));
              // rotation.*
              for(var n = 0; n < 3; n++)
                  events.push(objects[i].on('rotation.' + n + ':set', updateGizmoRotation));

              events.push(objects[i].on('parent:set', updateChildRelation));
          }

          if (! items.length)
              return;

          updateChildRelation();

          var rot = getGizmoRotation();
          editor.call('gizmo:translate:rotation', rot[0], rot[1], rot[2]);

          // gizmo start
          events.push(editor.on('gizmo:translate:start', onGizmoStart));
          // gizmo end
          events.push(editor.on('gizmo:translate:end', onGizmoEnd));
          // gizmo offset
          events.push(editor.on('gizmo:translate:offset', onGizmoOffset));

          // position gizmo
          var pos = getGizmoPosition();
          editor.call('gizmo:translate:position', pos.x, pos.y, pos.z);
          // show gizmo
          editor.call('gizmo:translate:toggle', true);
          // on render
          events.push(editor.on('gizmo:translate:render', onRender));
          // render
          editor.call('viewport:render');
      } else {
          // hide gizmo
          editor.call('gizmo:translate:toggle', false);
          // render
          editor.call('viewport:render');
      }
  };

  editor.on('gizmo:type', updateGizmo);
  editor.on('selector:change', updateGizmo);
  editor.on('gizmo:translate:sync', updateGizmo);
});


/* editor/entities/entities-gizmo-scale.js */
editor.once('load', function() {
  'use strict';

  var events = [ ];
  var items = [ ];
  var quat = new pc.Quat();
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();
  var startPosition = new pc.Vec3();
  var timeoutUpdatePosition, timeoutUpdateRotation;
  var app;
  var gizmoMoving = false;
  var gizmoAxis, gizmoMiddle;
  var linesColorActive = new pc.Color(1, 1, 1, 1);
  var linesColor = new pc.Color(1, 1, 1, .2);
  var linesColorBehind = new pc.Color(1, 1, 1, .05);
  var immediateRenderOptions;
  var brightRenderOptions;

  // get position of gizmo based on selected entities
  var getGizmoPosition = function() {
      if (! items.length)
          return;

      var reference = items[items.length - 1];
      var parent = reference.parent;
      while(parent) {
          reference = parent;
          parent = parent.parent;
      }
      vecA.copy(reference.obj.entity.getPosition());

      return vecA;
  };

  var getGizmoRotation = function() {
      if (! items.length)
          return;

      var reference = items[items.length - 1];
      var parent = reference.parent;
      while(parent) {
          reference = parent;
          parent = parent.parent;
      }
      var rot = reference.obj.entity.getEulerAngles();

      return [ rot.x, rot.y, rot.z ];
  };

  // update gizmo position
  var updateGizmoPosition = function() {
      if (! items.length || timeoutUpdatePosition)
          return;

      timeoutUpdatePosition = true;

      setTimeout(function() {
          timeoutUpdatePosition = false;

          var vec = getGizmoPosition();
          if (vec)
              editor.call('gizmo:scale:position', vec.x, vec.y, vec.z);
      });
  };

  // update gizmo position
  var updateGizmoRotation = function() {
      if (! items.length || timeoutUpdateRotation)
          return;

      timeoutUpdateRotation = true;

      setTimeout(function() {
          timeoutUpdateRotation = false;

          var vec = getGizmoRotation();
          if (vec)
              editor.call('gizmo:scale:rotation', vec[0], vec[1], vec[2]);
      });
  };

  // start translating
  var onGizmoStart = function(axis, middle) {
      gizmoAxis = axis;
      gizmoMiddle = middle;
      gizmoMoving = true;

      for(var i = 0; i < items.length; i++) {
          var scale = items[i].obj.get('scale');
          items[i].start[0] = scale[0];
          items[i].start[1] = scale[1];
          items[i].start[2] = scale[2];
          items[i].pos = items[i].start.slice(0);
          items[i].obj.history.enabled = false;
      }
  };

  // end translating
  var onGizmoEnd = function() {
      gizmoMoving = false;
      var records = [ ];

      for(var i = 0; i < items.length; i++) {
          items[i].obj.history.enabled = true;

          records.push({
              get: items[i].obj.history._getItemFn,
              valueOld: items[i].start.slice(0),
              value: items[i].obj.get('scale')
          });
      }

      editor.call('history:add', {
          name: 'entities.scale',
          undo: function() {
              for(var i = 0; i < records.length; i++) {
                  var item = records[i].get();
                  if (! item)
                      continue;

                  item.history.enabled = false;
                  item.set('scale', records[i].valueOld);
                  item.history.enabled = true;
              }
          },
          redo: function() {
              for(var i = 0; i < records.length; i++) {
                  var item = records[i].get();
                  if (! item)
                      continue;

                  item.history.enabled = false;
                  item.set('scale', records[i].value);
                  item.history.enabled = true;
              }
          }
      });
  };

  // scaled
  var onGizmoOffset = function(x, y, z) {
      for(var i = 0; i < items.length; i++) {
          if (items[i].child)
              continue;

          // skip 2D screens
          if (items[i].obj.get('components.screen.screenSpace'))
              continue;

          items[i].obj.set('scale', [ items[i].start[0] * x, items[i].start[1] * y, items[i].start[2] * z ]);
      }
  };

  var onRender = function() {
      if (! app) return; // webgl not available

      if (gizmoMoving) {
          var camera = editor.call('camera:current');

          for(var i = 0; i < items.length; i++) {
              if (items[i].child)
                  continue;

              vecA.copy(items[i].obj.entity.getPosition());
              quat.copy(items[i].obj.entity.getRotation());

              if (gizmoAxis === 'x' || gizmoMiddle) {
                  vecB.set(camera.camera.farClip * 2, 0, 0);
                  quat.transformVector(vecB, vecB).add(vecA);
                  vecC.set(camera.camera.farClip * -2, 0, 0);
                  quat.transformVector(vecC, vecC).add(vecA);
                  app.renderLine(vecB, vecC, linesColorBehind, immediateRenderOptions);
                  app.renderLine(vecB, vecC, linesColorActive, brightRenderOptions);
              }
              if (gizmoAxis === 'y' || gizmoMiddle) {
                  vecB.set(0, camera.camera.farClip * 2, 0);
                  quat.transformVector(vecB, vecB).add(vecA);
                  vecC.set(0, camera.camera.farClip * -2, 0);
                  quat.transformVector(vecC, vecC).add(vecA);
                  app.renderLine(vecB, vecC, linesColorBehind, immediateRenderOptions);
                  app.renderLine(vecB, vecC, linesColorActive, brightRenderOptions);
              }
              if (gizmoAxis === 'z' || gizmoMiddle) {
                  vecB.set(0, 0, camera.camera.farClip * 2);
                  quat.transformVector(vecB, vecB).add(vecA);
                  vecC.set(0, 0, camera.camera.farClip * -2);
                  quat.transformVector(vecC, vecC).add(vecA);
                  app.renderLine(vecB, vecC, linesColorBehind, immediateRenderOptions);
                  app.renderLine(vecB, vecC, linesColorActive, brightRenderOptions);
              }
          }
      } else {
          var dirty = false;
          for(var i = 0; i < items.length; i++) {
              if (! items[i].obj.entity)
                  continue;

              var pos = items[i].obj.entity.getPosition();
              if (pos.x !== items[i].pos[0] || pos.y !== items[i].pos[1] || pos.z !== items[i].pos[2]) {
                  dirty = true;
                  items[i].pos[0] = pos.x;
                  items[i].pos[1] = pos.y;
                  items[i].pos[2] = pos.z;
              }
          }

          if (dirty) {
              var pos = getGizmoPosition();
              editor.call('gizmo:scale:position', pos.x, pos.y, pos.z);
          }
      }
  };

  editor.once('viewport:load', function() {
      app = editor.call('viewport:app');

      immediateRenderOptions = {
          layer: editor.call('gizmo:layers', 'Axis Gizmo Immediate')
      };

      brightRenderOptions = {
          layer: editor.call('gizmo:layers', 'Bright Gizmo')
      };
  });

  var updateChildRelation = function() {
      var itemIds = { };
      for(var i = 0; i < items.length; i++) {
          itemIds[items[i].obj.get('resource_id')] = items[i];
      }

      for(var i = 0; i < items.length; i++) {
          var child = false;
          var parent = items[i].obj.entity._parent;
          var id = '';
          while(! child && parent) {
              id = parent.getGuid();
              if (itemIds[id]) {
                  parent = itemIds[id];
                  child = true;
                  break;
              }
              parent = parent._parent;
          }
          items[i].child = child;
          items[i].parent = child ? parent : null;
      }
  };

  var updateGizmo = function() {
      if (! editor.call('permissions:write'))
          return;

      var objects = editor.call('selector:items');

      for(var i = 0; i < events.length; i++)
          events[i].unbind();
      events = [ ];
      items = [ ];

      if (editor.call('selector:type') === 'entity' && editor.call('gizmo:type') === 'scale') {
          for(var i = 0; i < objects.length; i++) {
              if (! objects[i].entity)
                  continue;

              var pos = objects[i].entity.getPosition();

              items.push({
                  obj: objects[i],
                  pos: [ pos.x, pos.y, pos.z ],
                  start: [ 1, 1, 1 ]
              });

              // position
              events.push(objects[i].on('position:set', updateGizmoPosition));
              // position.*
              for(var n = 0; n < 3; n++)
                  events.push(objects[i].on('position.' + n + ':set', updateGizmoPosition));

              // rotation
              events.push(objects[i].on('rotation:set', updateGizmoRotation));
              // rotation.*
              for(var n = 0; n < 3; n++)
                  events.push(objects[i].on('rotation.' + n + ':set', updateGizmoRotation));

              events.push(objects[i].on('parent:set', updateChildRelation));
          }

          if (! items.length)
              return;

          updateChildRelation();

          var rot = getGizmoRotation();
          editor.call('gizmo:scale:rotation', rot[0], rot[1], rot[2]);

          // gizmo start
          events.push(editor.on('gizmo:scale:start', onGizmoStart));
          // gizmo end
          events.push(editor.on('gizmo:scale:end', onGizmoEnd));
          // gizmo offset
          events.push(editor.on('gizmo:scale:offset', onGizmoOffset));

          // position gizmo
          var pos = getGizmoPosition();
          editor.call('gizmo:scale:position', pos.x, pos.y, pos.z);
          // show gizmo
          editor.call('gizmo:scale:toggle', true);
          // on render
          events.push(editor.on('gizmo:scale:render', onRender));
          // render
          editor.call('viewport:render');
      } else {
          // hide gizmo
          editor.call('gizmo:scale:toggle', false);
          // render
          editor.call('viewport:render');
      }
  };

  editor.on('gizmo:type', updateGizmo);
  editor.on('selector:change', updateGizmo);
});


/* editor/entities/entities-gizmo-rotate.js */
editor.once('load', function() {
  'use strict';

  var events = [ ];
  var items = [ ];
  var quat = new pc.Quat();
  var quatB = new pc.Quat();
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();
  var startPosition = new pc.Vec3();
  var timeoutUpdatePosition, timeoutUpdateRotation;
  var coordSystem = 'world';
  var gizmoPos = new pc.Vec3();
  var gizmoMoving = false;
  var gizmoAxis;

  editor.on('gizmo:coordSystem', function(system) {
      if (coordSystem === system)
          return;

      coordSystem = system;

      var rot = getGizmoRotation();
      if (rot)
          editor.call('gizmo:rotate:rotation', rot[0], rot[1], rot[2]);

      var vec = getGizmoPosition();
      if (vec)
          editor.call('gizmo:rotate:position', vec.x, vec.y, vec.z);

      editor.call('viewport:render');
  });

  // get position of gizmo based on selected entities
  var getGizmoPosition = function() {
      if (! items.length)
          return;

      if (items.length === 1) {
          vecA.copy(items[0].obj.entity.getPosition());
      } else if (coordSystem === 'local') {
          var reference = items[items.length - 1];
          var parent = reference.parent;
          while(parent) {
              reference = parent;
              parent = parent.parent;
          }
          vecA.copy(reference.obj.entity.getPosition());
      } else {
          var selection = editor.call('selection:aabb');
          if (! selection) return;
          vecA.copy(selection.center);
      }

      return vecA;
  };

  var getGizmoRotation = function() {
      if (! items.length)
          return;

      if (coordSystem === 'local') {
          var reference = items[items.length - 1];
          var parent = reference.parent;
          while(parent) {
              reference = parent;
              parent = parent.parent;
          }
          var rot = reference.obj.entity.getEulerAngles();

          return [ rot.x, rot.y, rot.z ];
      } else {
          return [ 0, 0, 0 ];
      }
  };

  // update gizmo position
  var updateGizmoPosition = function() {
      if (! items.length || timeoutUpdatePosition || gizmoMoving)
          return;

      timeoutUpdatePosition = true;

      setTimeout(function() {
          timeoutUpdatePosition = false;

          var vec = getGizmoPosition();
          if (vec)
              editor.call('gizmo:rotate:position', vec.x, vec.y, vec.z);
      });
  };

  // update gizmo position
  var updateGizmoRotation = function() {
      if (! gizmoMoving)
          updateGizmoPosition();

      if (! items.length || timeoutUpdateRotation)
          return;

      timeoutUpdateRotation = true;

      setTimeout(function() {
          timeoutUpdateRotation = false;

          var vec = getGizmoRotation();
          if (vec)
              editor.call('gizmo:rotate:rotation', vec[0], vec[1], vec[2]);
      });
  };

  // start translating
  var onGizmoStart = function(axis) {
      gizmoAxis = axis;
      gizmoMoving = true;

      gizmoPos.copy(editor.call('gizmo:rotate:position'));

      for(var i = 0; i < items.length; i++) {
          var rot = items[i].obj.entity.getEulerAngles();
          items[i].start[0] = rot.x;
          items[i].start[1] = rot.y;
          items[i].start[2] = rot.z;
          items[i].pos = items[i].start.slice(0);

          var posLocal = items[i].obj.entity.getLocalPosition();

          items[i].startPosLocal[0] = posLocal.x;
          items[i].startPosLocal[1] = posLocal.y;
          items[i].startPosLocal[2] = posLocal.z;

          var pos = items[i].obj.entity.getPosition();

          items[i].offset[0] = pos.x - gizmoPos.x;
          items[i].offset[1] = pos.y - gizmoPos.y;
          items[i].offset[2] = pos.z - gizmoPos.z;

          rot = items[i].obj.get('rotation');
          items[i].startLocal[0] = rot[0];
          items[i].startLocal[1] = rot[1];
          items[i].startLocal[2] = rot[2];

          items[i].startLocalQuat.copy(items[i].obj.entity.getLocalRotation());
          items[i].startQuat.copy(items[i].obj.entity.getRotation());

          items[i].obj.history.enabled = false;
      }
  };

  // end translating
  var onGizmoEnd = function() {
      gizmoMoving = false;
      var records = [ ];

      for(var i = 0; i < items.length; i++) {
          items[i].obj.history.enabled = true;

          records.push({
              get: items[i].obj.history._getItemFn,
              valueRotOld: items[i].startLocal.slice(0),
              valueRot: items[i].obj.get('rotation'),
              valuePosOld: items[i].startPosLocal.slice(0),
              valuePos: items[i].obj.get('position')
          });
      }

      editor.call('history:add', {
          name: 'entities.rotate',
          undo: function() {
              for(var i = 0; i < records.length; i++) {
                  var item = records[i].get();
                  if (! item)
                      continue;

                  item.history.enabled = false;
                  item.set('position', records[i].valuePosOld);
                  item.set('rotation', records[i].valueRotOld);
                  item.history.enabled = true;
              }
          },
          redo: function() {
              for(var i = 0; i < records.length; i++) {
                  var item = records[i].get();
                  if (! item)
                      continue;

                  item.history.enabled = false;
                  item.set('position', records[i].valuePos);
                  item.set('rotation', records[i].valueRot);
                  item.history.enabled = true;
              }
          }
      });

      var pos = getGizmoPosition();
      editor.call('gizmo:rotate:position', pos.x, pos.y, pos.z);
  };

  // translated
  var onGizmoOffset = function(angle, point) {
      timeoutUpdateRotation = true;

      for(var i = 0; i < items.length; i++) {
          if (items[i].child)
              continue;

          // skip 2D screens
          if (items[i].obj.get('components.screen.screenSpace'))
              continue;

          vecA.set(0, 0, 0);
          vecA[gizmoAxis] = 1;

          quat.setFromAxisAngle(vecA, angle);

          if (coordSystem === 'local') {
              quatB.copy(items[i].startLocalQuat).mul(quat);
              items[i].obj.entity.setLocalRotation(quatB);
          } else if (items.length === 1) {
              quatB.copy(quat).mul(items[i].startQuat);
              items[i].obj.entity.setRotation(quatB);
          } else {
              vecA.set(items[i].offset[0], items[i].offset[1], items[i].offset[2]);
              quat.transformVector(vecA, vecA);
              quatB.copy(quat).mul(items[i].startQuat);
              items[i].obj.entity.setRotation(quatB);
              items[i].obj.entity.setPosition(vecA.add(gizmoPos));

              var pos = items[i].obj.entity.getLocalPosition();
              items[i].obj.set('position', [ pos.x, pos.y, pos.z ]);
          }

          var angles = items[i].obj.entity.getLocalEulerAngles();
          items[i].obj.set('rotation', [ angles.x, angles.y, angles.z ]);
      }

      timeoutUpdateRotation = false;

      if (items.length > 1 || coordSystem === 'local') {
          var rot = getGizmoRotation();
          editor.call('gizmo:rotate:rotation', rot[0], rot[1], rot[2]);
      }
  };

  var onRender = function() {
      if (! gizmoMoving && items.length) {
          var dirty = false;
          for(var i = 0; i < items.length; i++) {
              if (! items[i].obj.entity)
                  continue;

              var pos = items[i].obj.entity.getPosition();
              if (pos.x !== items[i].pos[0] || pos.y !== items[i].pos[1] || pos.z !== items[i].pos[2]) {
                  dirty = true;
                  items[i].pos[0] = pos.x;
                  items[i].pos[1] = pos.y;
                  items[i].pos[2] = pos.z;
              }
          }

          if (dirty) {
              var pos = getGizmoPosition();
              editor.call('gizmo:translate:position', pos.x, pos.y, pos.z);
          }
      }

      if (items.length > 1 && ! coordSystem === 'world') {
          var rot = getGizmoRotation();
          editor.call('gizmo:rotate:rotation', rot[0], rot[1], rot[2]);
      }
  };

  var updateChildRelation = function() {
      var itemIds = { };
      for(var i = 0; i < items.length; i++) {
          itemIds[items[i].obj.get('resource_id')] = items[i];
      }

      for(var i = 0; i < items.length; i++) {
          var child = false;
          var parent = items[i].obj.entity._parent;
          var id = '';
          while(! child && parent) {
              id = parent.getGuid();
              if (itemIds[id]) {
                  parent = itemIds[id];
                  child = true;
                  break;
              }
              parent = parent._parent;
          }
          items[i].child = child;
          items[i].parent = child ? parent : null;
      }

      updateGizmoPosition();
  };

  var updateGizmo = function() {
      if (! editor.call('permissions:write'))
          return;

      var objects = editor.call('selector:items');

      for(var i = 0; i < events.length; i++)
          events[i].unbind();
      events = [ ];
      items = [ ];

      if (editor.call('selector:type') === 'entity' && editor.call('gizmo:type') === 'rotate') {
          for(var i = 0; i < objects.length; i++) {
              if (! objects[i].entity)
                  continue;

              var pos = objects[i].entity.getPosition();

              items.push({
                  obj: objects[i],
                  startLocalQuat: objects[i].entity.getLocalRotation().clone(),
                  startQuat: objects[i].entity.getRotation().clone(),
                  pos: [ pos.x, pos.y, pos.z ],
                  offset: [ 0, 0, 0 ],
                  start: [ 0, 0, 0 ],
                  startLocal: [ 0, 0, 0 ],
                  startPosLocal: [ 0, 0, 0 ]
              });

              // position
              events.push(objects[i].on('position:set', updateGizmoPosition));
              // position.*
              for(var n = 0; n < 3; n++)
                  events.push(objects[i].on('position.' + n + ':set', updateGizmoPosition));

              // rotation
              events.push(objects[i].on('rotation:set', updateGizmoRotation));
              // rotation.*
              for(var n = 0; n < 3; n++)
                  events.push(objects[i].on('rotation.' + n + ':set', updateGizmoRotation));

              events.push(objects[i].on('parent:set', updateChildRelation));
          }

          if (! items.length)
              return;

          updateChildRelation();

          // gizmo start
          events.push(editor.on('gizmo:rotate:start', onGizmoStart));
          // gizmo end
          events.push(editor.on('gizmo:rotate:end', onGizmoEnd));
          // gizmo offset
          events.push(editor.on('gizmo:rotate:offset', onGizmoOffset));

          // rotation gizmo
          var rot = getGizmoRotation();
          editor.call('gizmo:rotate:rotation', rot[0], rot[1], rot[2]);
          // position gizmo
          var pos = getGizmoPosition();
          editor.call('gizmo:rotate:position', pos.x, pos.y, pos.z);
          // show gizmo
          editor.call('gizmo:rotate:toggle', true);
          // on render
          events.push(editor.on('gizmo:rotate:render', onRender));
          // render
          editor.call('viewport:render');
      } else {
          // hide gizmo
          editor.call('gizmo:rotate:toggle', false);
          // render
          editor.call('viewport:render');
      }
  };

  editor.on('gizmo:type', updateGizmo);
  editor.on('selector:change', updateGizmo);
});


/* editor/entities/entities-clipboard.js */
editor.once('load', function () {
  var CLIPBOARD_NAME = 'playcanvas_editor_clipboard';
  var CLIPBOARD_META = CLIPBOARD_NAME + '_meta';

  // get current clipboard value
  editor.method('entities:clipboard:get', function () {
      return editor.call('localStorage:get', CLIPBOARD_NAME);
  });

  // set current clipboard value
  editor.method('entities:clipboard:set', function (data) {
      editor.call('localStorage:set', CLIPBOARD_META, {project: config.project.id});
      editor.call('localStorage:set', CLIPBOARD_NAME, data);
  });

  // return true if there is no data in the clipboard
  editor.method('entities:clipboard:empty', function () {
      return !editor.call('localStorage:get', CLIPBOARD_META);
  });
});

/* editor/entities/entities-user-color.js */
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

      if (data.type === 'entity') {
          // select
          if (! items[user]) {
              items[user] = [ ];
              pool[user] = [ ];
          }

          if (! colors[user])
              colors[user] = editor.call('whoisonline:color', user, 'hex');

          for(var i = 0; i < data.ids.length; i++) {
              var element = editor.call('entities:panel:get', data.ids[i]);
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