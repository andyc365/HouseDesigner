


/* editor/schema/schema.js */
editor.once('load', function () {
  'use strict';

  /**
   * Gets the schema object that corresponds to the specified dot separated
   * path from the specified schema object.
   * @param {String} path The path separated by dots
   * @param {Object} schema The schema object
   * @returns {Object} The sub schema
   */
  var pathToSchema = function (path, schema) {
      if (typeof(path) === 'string') {
          path = path.split('.');
      }

      if (typeof(path) === 'number') {
          path = [path];
      }

      var result = schema;
      for (var i = 0, len = path.length; i < len; i++) {
          var p = path[i];
          if (result.$type === 'map' && result.$of) {
              result = result.$of;
          } else if (result[p] || (result.$type && result.$type[p])) {
              result = result[p] || result.$type[p];
          } else if (!isNaN(parseInt(p, 10)) && Array.isArray(result) || Array.isArray(result.$type)) {
              result = Array.isArray(result) ? result[0] : result.$type[0];
          } else {
              return null;
          }
      }

      return result;
  };

  /**
   * Converts the specified schema object to a type recursively.
   * @param {Object} schema The schema object or field of a parent schema object.
   * @param {Boolean} fixedLength Whether the specified schema field has a fixed length if it's an array type.
   * @returns {String} The type
   */
  var schemaToType = function (schema, fixedLength) {
      if (typeof schema === 'string') {
          if (schema === 'map' || schema === 'mixed') {
              schema = 'object';
          }

          return schema.toLowerCase();
      }

      if (schema.$editorType) {
          return schema.$editorType;
      }

      if (Array.isArray(schema)) {
          if (schema[0] === 'number' && fixedLength) {
              if (fixedLength === 2) {
                  return 'vec2';
              } else if (fixedLength === 3) {
                  return 'vec3';
              } else if (fixedLength === 4) {
                  return 'vec4';
              }
          }

          return 'array:' + schemaToType(schema[0]);
      }

      if (schema.$type) {
          return schemaToType(schema.$type, schema.$length);
      }

      return 'object';
  };

  /**
   * Gets the type of the specified schema object,
   * @param {Object} schemaField A field of the schema
   * @param {Boolean} fixedLength Whether this field has a fixed length if it's an array type
   * @returns {String} The type
   */
  editor.method('schema:getType', function (schemaField, fixedLength) {
      return schemaToType(schemaField, fixedLength);
  });

  /**
   * Gets the type of the specified path from the specified schema
   * @param {Object} schema The schema object
   * @param {String} path A path separated by dots
   * @param {String} The type
   */
  editor.method('schema:getTypeForPath', function (schema, path) {
      var subSchema = pathToSchema(path, schema);
      var type = subSchema && schemaToType(subSchema);

      if (! type) {
          console.warn('Unknown type for ' + path);
          type = 'string';
      }

      return type;
  });
});


/* editor/schema/schema-scene.js */
editor.once('load', function () {
  'use strict';

  /**
   * Gets the type of a path in the scene schema
   * @param {String} path The path in the schema separated by dots
   * @returns {String} The type
   */
  editor.method('schema:scene:getType', function (path) {
      return editor.call('schema:getTypeForPath', config.schema.scene, path);
  });
});


/* editor/schema/schema-asset.js */
editor.once('load', function () {
  'use strict';

  /**
   * Gets the type of a path in the asset schema
   * @param {String} path The path in the schema separated by dots
   * @returns {String} The type
   */
  editor.method('schema:asset:getType', function (path) {
      return editor.call('schema:getTypeForPath', config.schema.asset, path);
  });
});


/* editor/schema/schema-settings.js */
editor.once('load', function () {
  'use strict';

  /**
   * Gets the type of a path in the settings schema
   * @param {String} path The path in the schema separated by dots
   * @returns {String} The type
   */
  editor.method('schema:settings:getType', function (path) {
      return editor.call('schema:getTypeForPath', config.schema.settings, path);
  });
});


/* editor/schema/schema-components.js */
editor.once('load', function() {
  'use strict';

  var projectSettings = editor.call('settings:project');

  var schema = config.schema.scene.entities.$of.components;

  var componentName;

  // make titles for each component
  for (componentName in schema) {
      var title;
      switch (componentName) {
          case 'audiosource':
              title = 'Audio Source';
              break;
          case 'audiolistener':
              title = 'Audio Listener';
              break;
          case 'particlesystem':
              title = 'Particle System';
              break;
          case 'rigidbody':
              title = 'Rigid Body';
              break;
          case 'scrollview':
              title = 'Scroll View';
              break;
          case 'layoutgroup':
              title = 'Layout Group';
              break;
          case 'layoutchild':
              title = 'Layout Child';
              break;
          default:
              title = componentName[0].toUpperCase() + componentName.substring(1);
              break;
      }

      schema[componentName].$title = title;
  }

  // some property defaults should be dynamic so
  // patch them in
  if (schema.screen) {
      // default resolution to project resolution for screen components
      schema.screen.resolution.$default = function () {
          return [
              projectSettings.get('width'),
              projectSettings.get('height')
          ];
      };
      schema.screen.referenceResolution.$default = function () {
          return [
              projectSettings.get('width'),
              projectSettings.get('height')
          ];
      };
  }

  if (schema.element) {
      schema.element.fontAsset.$default = function () {
          // Reuse the last selected font, if it still exists in the library
          var lastSelectedFontId = editor.call('settings:projectUser').get('editor.lastSelectedFontId');
          var lastSelectedFontStillExists = lastSelectedFontId !== -1 && !!editor.call('assets:get', lastSelectedFontId);

          if (lastSelectedFontStillExists) {
              return lastSelectedFontId;
          }

          // Otherwise, select the first available font in the library
          var firstAvailableFont = editor.call('assets:findOne', function (asset) { return ! asset.get('source') && asset.get('type') === 'font'; });

          return firstAvailableFont ? parseInt(firstAvailableFont[1].get('id'), 10) : null;
      };
  }

  // Paths in components that represent assets.
  // Does not include asset script attributes.
  var assetPaths = [];
  var gatherAssetPathsRecursively = function (schemaField, path) {
      if (schemaField.$editorType === 'asset' || schemaField.$editorType === 'array:asset') {
          // this is for cases like components.model.mapping
          assetPaths.push(path);
          return;
      }

      for (var fieldName in schemaField) {
          if (fieldName.startsWith('$')) continue;

          var field = schemaField[fieldName];
          var type = editor.call('schema:getType', field);
          if (type === 'asset' || type === 'array:asset') {
              assetPaths.push(path + '.' + fieldName);
          } else if (type === 'object' && field.$of) {
              gatherAssetPathsRecursively(field.$of, path + '.' + fieldName + '.*');
          }
      }
  };

  for (componentName in schema) {
      gatherAssetPathsRecursively(schema[componentName], 'components.' + componentName);
  }


  editor.method('components:assetPaths', function () {
      return assetPaths;
  });

  if (editor.call('settings:project').get('useLegacyScripts')) {
      schema.script.scripts.$default = [];
      delete schema.script.order;
  }

  var list = Object.keys(schema).sort(function (a, b) {
      if (a > b) {
          return 1;
      } else if (a < b) {
          return -1;
      }

      return 0;
  });

  editor.method('components:convertValue', function (component, property, value) {
      var result = value;

      if (value) {
          var data = schema[component];
          if (data && data[property]) {
              var type = editor.call('schema:getType', data[property]);
              switch (type) {
                  case 'rgb':
                      result = new pc.Color(value[0], value[1], value[2]);
                      break;
                  case 'rgba':
                      result = new pc.Color(value[0], value[1], value[2], value[3]);
                      break;
                  case 'vec2':
                      result = new pc.Vec2(value[0], value[1]);
                      break;
                  case 'vec3':
                      result = new pc.Vec3(value[0], value[1], value[2]);
                      break;
                  case 'vec4':
                      result = new pc.Vec4(value[0], value[1], value[2], value[3]);
                      break;
                  case 'curveset':
                      result = new pc.CurveSet(value.keys);
                      result.type = value.type;
                      break;
                  case 'curve':
                      result = new pc.Curve(value.keys);
                      result.type = value.type;
                      break;
                  case 'entity':
                      result = value; // Entity fields should just be a string guid
                      break;
              }
          }
      }

      // for batchGroupId convert null to -1 for runtime
      if (result === null && property === 'batchGroupId')
          result = -1;

      return result;
  });

  editor.method('components:list', function () {
      var result = list.slice(0);
      var idx;

      // filter out zone (which is not really supported)
      if (!editor.call('users:hasFlag', 'hasZoneComponent')) {
          idx = result.indexOf('zone');
          if (idx !== -1) {
              result.splice(idx, 1);
          }
      }

      return result;
  });

  editor.method('components:schema', function () {
      return schema;
  });

  editor.method('components:getDefault', function (component) {
      var result = {};
      for (var fieldName in schema[component]) {
          if (fieldName.startsWith('$')) continue;
          var field = schema[component][fieldName];
          if (field.hasOwnProperty('$default')) {
              result[fieldName] = utils.deepCopy(field.$default);
          }
      }

      resolveLazyDefaults(result);

      return result;
  });

  function resolveLazyDefaults(defaults) {
      // Any functions in the default property set are used to provide
      // lazy resolution, to handle cases where the values are not known
      // at startup time.
      Object.keys(defaults).forEach(function (key) {
          var value = defaults[key];

          if (typeof value === 'function') {
              defaults[key] = value();
          }
      });
  }

  editor.method('components:getFieldsOfType', function (component, type) {
      var matchingFields = [];

      for (var field in schema[component]) {
          if (schema[component][field].$editorType === type) {
              matchingFields.push(field);
          }
      }

      return matchingFields;
  });

});


/* editor/schema/schema-material.js */
editor.once('load', function () {
  'use strict';

  /**
   * Returns a JSON object that contains all of the default material data.
   * @param {Object} existingData If a field already exists in this object
   * then use that instead of the default value.
   */
  editor.method('schema:material:getDefaultData', function (existingData) {
      var result = {};
      var schema = config.schema.materialData;

      for (var key in schema) {
          if (key.startsWith('$')) continue;
          if (existingData && existingData[key] !== undefined) {
              result[key] = existingData[key];
          } else {
              var field = schema[key];
              if (field.hasOwnProperty('$default')) {
                  result[key] = utils.deepCopy(field.$default);
              }
          }
      }

      return result;
  });

  /**
   * Gets the default value of a specific field from the material schema
   * @param {String} fieldName The name of the field
   * @returns {*} The default value or undefined
   */
  editor.method('schema:material:getDefaultValueForField', function (fieldName) {
      var field = config.schema.materialData[fieldName];

      if (field && field.hasOwnProperty('$default')) {
          return utils.deepCopy(field.$default);
      }

      return undefined;
  });

  /**
   * Returns the type of a data field
   * @param {String} fieldName The name of the field
   */
  editor.method('schema:material:getType', function (fieldName) {
      return editor.call('schema:getTypeForPath', config.schema.materialData, fieldName);
  });
});

