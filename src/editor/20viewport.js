

/* editor/viewport/viewport-application.js */
editor.once('load', function() {
  var time;
  var rect = new pc.Vec4(0, 0, 1, 1);

  var Application = function (canvas, options) {
      this._inTools = true;
      pc.app = this;

      if (! this.scene)
          this.scene = new pc.Scene();

      for (var key in this.systems) {
          if (this.systems.hasOwnProperty(key))
              this.systems[key]._inTools = true;
      }

      this.grid = null;
      this.setEditorSettings(options.editorSettings);

      this.picker = new pc.Picker(this, 1, 1);
      this.shading = pc.RENDERSTYLE_SOLID;

      // Draw immediately
      this.redraw = true;

      // define the tick method
      this.tick = this.makeTick();

      pc.ComponentSystem.on('toolsUpdate', this.systems.particlesystem.onUpdate, this.systems.particlesystem);
      pc.ComponentSystem.on('toolsUpdate', this.systems.animation.onUpdate, this.systems.animation);

      // TODO: remove if once layoutgroups merged
      if (this.systems.layoutgroup) {
          pc.ComponentSystem.on('toolsUpdate', this.systems.layoutgroup._onPostUpdate, this.systems.layoutgroup);
      }
  };

  editor.method('viewport:application', function() {
      return Application;
  });

  Application = pc.inherits(Application, pc.Application);

  Application.prototype.render = function() {
      this.root.syncHierarchy();

      this.fire('prerender', null);
      editor.emit('viewport:preRender');

      // render current camera
      var cameraEntity = editor.call('camera:current');
      if (cameraEntity && cameraEntity.camera) {
          if (cameraEntity.__editorCamera) {
              var clearColor = this.editorSettings.cameraClearColor;
              cameraEntity.camera.clearColor = new pc.Color(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
              if (cameraEntity.camera.projection === pc.PROJECTION_PERSPECTIVE) {
                  cameraEntity.camera.nearClip = this.editorSettings.cameraNearClip || 0.0001;
                  cameraEntity.camera.farClip = this.editorSettings.cameraFarClip;
              }
          }

          cameraEntity.camera.rect = rect;
      }

      this.renderer.renderComposition(this.scene.layers);
      this.fire('postrender');
  };

  Application.prototype.getDt = function () {
      var now = (window.performance && window.performance.now) ? performance.now() : Date.now();
      var dt = (now - (time || now)) / 1000.0;
      dt = pc.math.clamp(dt, 0, 0.1); // Maximum delta is 0.1s or 10 fps.
      time = now;
      return dt;
  };

  Application.prototype.makeTick = function() {
      var app = this;
      return function() {
          requestAnimationFrame(app.tick);

          pc.app = app;

          var dt = app.getDt();

          if (app.redraw) {
              app.redraw = editor.call('viewport:keepRendering');

              app.graphicsDevice.updateClientRect();

              // Perform ComponentSystem update
              editor.emit('viewport:preUpdate', dt);
              editor.emit('viewport:update', dt);
              pc.ComponentSystem.fire('toolsUpdate', dt);
              editor.emit('viewport:postUpdate', dt);

              editor.emit('viewport:gizmoUpdate', dt);

              app.render();

              editor.emit('viewport:postRender');
          }
      };
  };

  Application.prototype.resize = function (w, h) {
      this.graphicsDevice.width = w;
      this.graphicsDevice.height = h;
      this.picker.resize(w, h);
      this.redraw = true;
  };

  Application.prototype.setEditorSettings = function (settings) {
      this.editorSettings = settings;

      var gridLayer = editor.call('gizmo:layers', 'Viewport Grid');

       if (this.grid) {
           gridLayer.removeMeshInstances(this.grid.model.meshInstances);
           this.grid.destroy();
       }

       settings.gridDivisions = parseInt(settings.gridDivisions, 10);
       if (settings.gridDivisions > 0 && settings.gridDivisionSize > 0) {
           var size = settings.gridDivisions * settings.gridDivisionSize;
           this.grid = new pc.Grid(this.graphicsDevice, size, settings.gridDivisions);
           this.grid.model.meshInstances[0].aabb.halfExtents.set(size / 2, size / 2, size / 2);
           gridLayer.addMeshInstances(this.grid.model.meshInstances);
       }

      this.redraw = true;
  };

  // Redraw when we set the skybox
  Application.prototype._setSkybox = function (cubemaps) {
      Application._super._setSkybox.call(this, cubemaps);
      this.redraw = true;
  };
});


/* editor/viewport/viewport-grid.js */
pc.Grid = function (device, size, divisions) {
  // Create the vertex format
  var vertexFormat = new pc.VertexFormat(device, [
      { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.TYPE_UINT8, normalize: true }
  ]);

  var size = size || 140;
  var divisions = divisions || 14;
  var interval = size / divisions;
  var numVerts = (divisions + 1) * 4;
  var gridColor = [136, 136, 136, 255];
  var axisColor = [0, 0, 0, 255];
  var color;

  // Create a vertex buffer
  this.vertexBuffer = new pc.VertexBuffer(device, vertexFormat, numVerts);
  var vertexBuffer = this.vertexBuffer;

  // Fill the vertex buffer
  var iterator = new pc.VertexIterator(vertexBuffer);
  for (i = -(divisions / 2); i <= divisions / 2; i++) {
      color = (i === 0) ? axisColor : gridColor;
      iterator.element[pc.SEMANTIC_POSITION].set(-size/2, 0.0, i * interval);
      iterator.element[pc.SEMANTIC_COLOR].set(color[0], color[1], color[2], color[3]);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set( size/2, 0.0, i * interval);
      iterator.element[pc.SEMANTIC_COLOR].set(color[0], color[1], color[2], color[3]);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(i * interval, 0.0, -size/2);
      iterator.element[pc.SEMANTIC_COLOR].set(color[0], color[1], color[2], color[3]);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(i * interval, 0.0,  size/2);
      iterator.element[pc.SEMANTIC_COLOR].set(color[0], color[1], color[2], color[3]);
      if (i !== divisions / 2) {
          iterator.next();
      }
  }
  iterator.end();

  var library = device.getProgramLibrary();
  var shader = library.getProgram("basic", { vertexColors: true, diffuseMapping: false });

  var material = new pc.Material();
  material.shader = shader;

  var mesh = new pc.Mesh();
  mesh.vertexBuffer = vertexBuffer;
  mesh.indexBuffer[0] = null;
  mesh.primitive[0].type = pc.PRIMITIVE_LINES;
  mesh.primitive[0].base = 0;
  mesh.primitive[0].count = vertexBuffer.getNumVertices();
  mesh.primitive[0].indexed = false;

  var node = new pc.GraphNode('grid');

  var meshInstance = new pc.MeshInstance(node, mesh, material);
  meshInstance.mask = GIZMO_MASK;

  var model = new pc.Model();
  model.graph = node;
  model.meshInstances = [ meshInstance ];

  this.model = model;
};

pc.Grid.prototype = {
  destroy: function () {
      if (this.vertexBuffer) {
          this.vertexBuffer.destroy();
          this.vertexBuffer = null;
      }
  }
};


/* editor/viewport/viewport.js */
editor.once('load', function() {
  'use strict'

  var canvas = new ui.Canvas({
      id: 'canvas-3d'
  });

  var keepRendering = false;
  var editorSettings = editor.call('settings:projectUser');
  var Application = editor.call('viewport:application');

  var idleFlagTimeoutId = null;
  var idleFlagTimeoutDelay = 250;

  // Allow anti-aliasing to be forcibly disabled - this is useful for Selenium tests in
  // order to ensure that the generated screenshots are consistent across different GPUs.
  var disableAntiAliasing = /disableAntiAliasing=true/.test(location.search);

  // create playcanvas application
  try {
      var app = new Application(canvas.element, {
          mouse: new pc.input.Mouse(canvas.element),
          touch: !!('ontouchstart' in window) ? new pc.input.TouchDevice(canvas.element) : null,
          editorSettings: editorSettings.json().editor,
          graphicsDeviceOptions: {
              antialias: !disableAntiAliasing,
              alpha: false
          }
      });

      app.enableBundles = false;
  } catch(ex) {
      editor.emit('viewport:error', ex);
      return;
  }

  editorSettings.on('*:set', function() {
      app.setEditorSettings(editorSettings.json().editor);
  });


  // add canvas
  editor.call('layout.viewport').prepend(canvas);

  // get canvas
  editor.method('viewport:canvas', function() {
      return canvas;
  });

  // get app
  editor.method('viewport:app', function() {
      return app;
  });

  // re-render viewport
  editor.method('viewport:render', function () {
      canvas.class.remove('viewport-idle');

      app.redraw = true;

      clearTimeout(idleFlagTimeoutId);
      idleFlagTimeoutId = setTimeout(function() {
          if (!canvas.class.contains('viewport-idle')) {
              canvas.class.add('viewport-idle');
          }
      }, idleFlagTimeoutDelay);
  });

  // returns true if the viewport should continuously render
  editor.method('viewport:keepRendering', function (value) {
      if (typeof(value) === 'boolean')
          keepRendering = value;

      return keepRendering;
  });

  editor.method('viewport:flyMode', function () {
      return flyMode;
  });

  app.start();
  editor.emit('viewport:load', app);
});


/* editor/viewport/viewport-resize.js */
editor.once('load', function() {
  'use strict'

  var container = editor.call('layout.viewport');
  var canvas = editor.call('viewport:canvas');
  var app = editor.call('viewport:app');

  if (! app) return; // webgl not available

  if (! canvas)
      return;

  // once canvas resized
  // notify app
  canvas.on('resize', function(width, height) {
      app.resize(width, height);
      editor.call('viewport:render');
      editor.emit('viewport:resize', width, height);
  });

  // handle canvas resizing
  // 20 times a second
  // if size is already same, nothing will happen
  window.resizeInterval = setInterval(function() {
      var rect = container.dom.getBoundingClientRect();
      canvas.resize(Math.floor(rect.width), Math.floor(rect.height));
  }, 1000 / 60);
});


/* editor/viewport/viewport-expand.js */
editor.once('load', function() {
  'use strict';

  var panels = [ ];
  panels.push(editor.call('layout.hierarchy'));
  panels.push(editor.call('layout.assets'));
  panels.push(editor.call('layout.attributes'));

  var expanded = false;


  editor.method('viewport:expand', function(state) {
      if (state === undefined)
          state = ! expanded;

      if (expanded === state)
          return;

      expanded = state;

      for(var i = 0; i < panels.length; i++)
          panels[i].hidden = expanded;

      editor.emit('viewport:expand', state);
  });


  editor.method('viewport:expand:state', function() {
      return expanded;
  });


  // expand hotkey
  editor.call('hotkey:register', 'viewport:expand', {
      key: 'space',
      callback: function() {
          editor.call('viewport:expand');
      }
  });
});


/* editor/viewport/viewport-entities-create.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');

  // entities indexes for parenting
  var childIndex = { };
  var entitiesIndex = { };
  var unknowns = { };

  // queue for hierarchy resync
  var awaitingResyncHierarchy = false;

  var resyncHierarchy = function() {
      awaitingResyncHierarchy = false;

      if (! app) return; // webgl not available

      // sync hierarchy
      app.context.root.syncHierarchy();

      // render
      editor.call('viewport:render');
  };

  var createEntity = function (obj) {
      var entity = new pc.Entity();

      entitiesIndex[obj.get('resource_id')] = entity;

      entity.name = obj.get('name');
      entity.setGuid(obj.get('resource_id'));
      entity.setLocalPosition(obj.get('position.0'), obj.get('position.1'), obj.get('position.2'));
      entity.setLocalEulerAngles(obj.get('rotation.0'), obj.get('rotation.1'), obj.get('rotation.2'));
      entity.setLocalScale(obj.get('scale.0'), obj.get('scale.1'), obj.get('scale.2'));
      entity._enabled = obj.has('enabled') ? obj.get('enabled') : true;

      if (obj.has('labels')) {
          obj.get('labels').forEach(function (label) {
              entity.addLabel(label);
          });
      }

      entity.template = obj.get('template');

      return entity;
  };

  var insertChild = function (parent, node, index) {
      // try to insert the node at the right index
      for (var i = 0, len = parent._children.length; i < len; i++) {
          var child = parent._children[i];
          if (child instanceof pc.Entity && childIndex[child.getGuid()]) {
              // if our index is less than this child's index
              // then put the item here
              if (index < childIndex[child.getGuid()].index) {
                  parent.insertChild(node, i);
                  return;
              }
          }
      }

      // the node can be safely added to the end of the child list
      parent.addChild(node);
  };

  var processEntity = function (obj) {
      if (! app) return; // webgl not available

      // create entity
      var entity = obj.entity = createEntity(obj);

      // add components
      var components = obj.json().components;
      for(var key in components) {
          if (app.context.systems[key]) {
              if (key === 'script')
                  continue;

              // override particlesystem
              if (key === 'particlesystem') {
                  components[key].enabled = false;
                  components[key].autoPlay = true;
              } else if (key === 'animation') {
                  components[key].enabled = false;
              }

              app.context.systems[key].addComponent(entity, components[key]);
          } else if (! unknowns[key]) {
              unknowns[key] = true;
              console.log('unknown component "' + key + '", in entity ' + obj.get('resource_id'));
          }
      }

      var children = obj.get('children');
      for(var i = 0; i < children.length; i++) {
          childIndex[children[i]] = {
              index: i,
              parent: entity
          };

          if (entitiesIndex[children[i]]) {
              insertChild(entity, entitiesIndex[children[i]], i);
          }
      }

      // parenting
      if (! obj.get('parent')) {
          // root
          app.context.root.addChild(entity);
      } else {
          // child
          var details = childIndex[obj.get('resource_id')];
          if (details && details.parent) {
              insertChild(details.parent, entity, details.index);
          }
      }

      // queue resync hierarchy
      // done on timeout to allow bulk entity creation
      // without rerender and sync after each entity
      if (! awaitingResyncHierarchy) {
          awaitingResyncHierarchy = true;
          setTimeout(resyncHierarchy, 0);
      }

      editor.emit('entities:add:entity', obj);
  };

  var createEntities = function() {
      // new entity created
      editor.on('entities:add', function (obj) {
          processEntity(obj);
      });

      // clear entitiesIndex and childIndex
      editor.on('entities:remove', function (obj) {
          delete entitiesIndex[obj.get('resource_id')];
          var children = obj.get('children');
          for(var i = 0; i < children.length; i++) {
              delete childIndex[children[i]];
          }
      });

      var entities = editor.call('entities:list');
      entities.forEach(processEntity);

      // give components that need it a chance to process entity references now
      // that the scene graph has loaded
      app.fire('tools:sceneloaded');
  };

  // handle synchronization - all assets must be loaded
  // before creating entities in the engine
  var assetsLoaded = false;
  var entitiesLoaded = false;

  editor.once('assets:load', function () {
      assetsLoaded = true;
      // if entities already loaded then create them
      if (entitiesLoaded)
          createEntities();
  });

  editor.once('entities:load', function() {
      entitiesLoaded = true;
      // if assets already loaded then create entities
      if (assetsLoaded)
          createEntities();
  });
});


/* editor/viewport/viewport-entities-observer-binding.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  editor.on('entities:add', function (obj) {
      // subscribe to changes
      obj.on('*:set', function(path, value) {
          var entity = obj.entity;
          if (! entity)
              return;

          if (path === 'name') {
              entity.name = obj.get('name');

          } else if (path.startsWith('position')) {
              entity.setLocalPosition(obj.get('position.0'), obj.get('position.1'), obj.get('position.2'));

          } else if (path.startsWith('rotation')) {
              entity.setLocalEulerAngles(obj.get('rotation.0'), obj.get('rotation.1'), obj.get('rotation.2'));

          } else if (path.startsWith('scale')) {
              entity.setLocalScale(obj.get('scale.0'), obj.get('scale.1'), obj.get('scale.2'));

          } else if (path.startsWith('enabled')) {
              entity.enabled = obj.get('enabled');

          } else if (path.startsWith('parent')) {
              var parent = editor.call('entities:get', obj.get('parent'));
              if (parent && parent.entity && entity.parent !== parent.entity)
                  entity.reparent(parent.entity);
          } else if (path === 'components.model.type' && value === 'asset') {
              // WORKAROUND
              // entity deletes asset when switching to primitive, restore it
              // do this in a timeout to allow the model type to change first
              setTimeout(function () {
                  var assetId = obj.get('components.model.asset');
                  if (assetId)
                      entity.model.asset = assetId;
              });
          }

          // render
          editor.call('viewport:render');
      });

      var reparent = function (child, index) {
          var childEntity = editor.call('entities:get', child);
          if (childEntity && childEntity.entity && obj.entity) {
              var oldParent = childEntity.entity.parent;

              if (oldParent)
                  oldParent.removeChild(childEntity.entity);

              // skip any graph nodes
              if (index > 0) {
                  var children = obj.entity.children;
                  for (var i = 0, len = children.length; i < len && index > 0; i++) {
                      if (children[i] instanceof pc.Entity) {
                          index--;
                      }
                  }

                  index = i;
              }

              // re-insert
              obj.entity.insertChild(childEntity.entity, index);

              // persist the positions and sizes of elements if they were previously
              // under control of a layout group but have now been reparented
              if (oldParent && oldParent.layoutgroup) {
                  editor.call('entities:layout:storeLayout', [childEntity.entity.getGuid()]);
              }
          }
      };

      obj.on('children:insert', reparent);
      obj.on('children:move', reparent);

      obj.on('destroy', function () {
          if (obj.entity) {
              obj.entity.destroy();
              editor.call('viewport:render');
          }
      });
  });

  editor.on('entities:remove', function (obj) {
      var entity = obj.entity;
      if (! entity)
          return;

      entity.destroy();
      editor.call('viewport:render');
  });
});


/* editor/viewport/viewport-entities-components-binding.js */
editor.once('load', function() {
  'use strict';

  // converts the data to runtime types
  var runtimeComponentData = function (component, data) {
      var result = {};
      for (var key in data) {
          if (data.hasOwnProperty(key)) {
              result[key] = editor.call('components:convertValue', component, key, data[key]);
          }
      }

      return result;
  };

  var approxEqual = function(a, b) {
      return Math.abs(a - b) < 1e-4;
  };

  editor.on('entities:add', function (obj) {
      var app;

      // subscribe to changes
      obj.on('*:set', function(path, value) {
          if (obj._silent || ! path.startsWith('components'))
              return;

          var entity = obj.entity;
          if (! entity) return;

          var parts = path.split('.');
          var component = parts[1];
          var property = parts[2];
          var callSetter = true;

          // ignore script component
          if (component === 'script')
              return;

          if (!entity[component]) {
              if (!property) {
                  // add component
                  var data = runtimeComponentData(component, value);

                  // override particlesystem
                  if (component === 'particlesystem') {
                      data.enabled = false;
                      data.autoPlay = true;
                  } else if (component === 'animation') {
                      data.enabled = false;
                  }

                  app = editor.call('viewport:app');
                  if (! app) return; // webgl not available
                  app.context.systems[component].addComponent(entity, data);

                  // render
                  editor.call('viewport:render');
              }
          } else if (property) {
              // edit component property
              value = obj.get('components.' + component + '.' + property);

              if (component === 'particlesystem') {
                  if (property === 'enabled') {
                      value = false;
                  } else if (property === 'autoPlay') {
                      value = true;
                  }
              } else if (component === 'animation') {
                  if (property === 'enabled') {
                      value = false;
                  }
              } else if (component === 'sprite') {
                  if (property === 'autoPlayClip') {
                      // stop current clip so that we can show the new one
                      if (entity.sprite) {
                          entity.sprite.stop();
                      }
                  }
              } else if (component === 'camera') {
                  // do not let cameras get enabled by changes to the observer
                  // because we want to control which cameras are being rendered manually
                  if (property === 'enabled') {
                      value = false;
                  }
              } else if (component === 'element') {
                  // Only propagate values to the margin or anchor if the value has
                  // actually been modified. Doing so in other cases gives the element
                  // the impression that the user has intentionally changed the margin,
                  // which in turn will change its width/height unnecessarily.
                  if (property === 'margin' || property === 'anchor') {
                      var existing = entity.element[property];

                      if (approxEqual(value[0], existing.x) &&
                          approxEqual(value[1], existing.y) &&
                          approxEqual(value[2], existing.z) &&
                          approxEqual(value[3], existing.w)) {
                          callSetter = false;
                      }
                  }
              }

              if (callSetter) {
                  entity[component][property] = editor.call('components:convertValue', component, property, value);
              }

              // render
              editor.call('viewport:render');
          }
      });

      var setComponentProperty = function (path, value) {
          if (obj._silent || ! path.startsWith('components'))
              return;

          var entity = obj.entity;
          if (! entity) return;

          var parts = path.split('.');
          var component = parts[1];
          var property = parts[2];

          // ignore script component
          if (component === 'script')
              return;

          if (property) {
              // edit component property
              value = obj.get('components.' + component + '.' + property);
              entity[component][property] = editor.call('components:convertValue', component, property, value);

              // render
              editor.call('viewport:render');
          }
      };

      obj.on('*:insert', setComponentProperty);
      obj.on('*:remove', setComponentProperty);

      obj.on('*:unset', function (path) {
          if (obj._silent || ! path.startsWith('components'))
              return;

          var entity = obj.entity;
          if (! entity) return;

          var parts = path.split('.');
          var component = parts[1];
          var property = parts[2];

          if (component === 'script')
              return;

          if (property) {
              // edit component property
              var value = obj.get('components.' + component + '.' + property);
              entity[component][property] = editor.call('components:convertValue', component, property, value);
          } else if (entity[component]) {
              // remove component
              var app = editor.call('viewport:app');
              if (! app) return; // webgl not available

              app.context.systems[component].removeComponent(entity);
          }

          // render
          editor.call('viewport:render');
      });
  });
});


/* editor/viewport/viewport-entities-elements.js */
editor.once('load', function() {
  'use strict';

  var events = [];

  editor.on('attributes:inspect[entity]', function(entities) {
      if (events.length)
          clear();

      for (var i = 0, len = entities.length; i < len; i++) {
          updateElementProperties(entities[i]);
          addEvents(entities[i]);
      }
  });

  var fixed = function (value) {
      return +value.toFixed(3);
  };

  // update entities stored properties with whatever the realtime element
  // has - that's because depending on the screen size an element might not have
  // the correct properties when inspected so make sure these are right
  var updateElementProperties = function (entity) {
      if (! entity.entity || ! entity.has('components.element')) return;

      var history = entity.history.enabled;
      var sync = entity.sync.enabled;
      // turn off history and syncing
      // this is only for the local user
      entity.history.enabled = false;
      entity.sync.enabled = false;
      var margin = entity.entity.element.margin;
      entity.set('components.element.margin', [margin.x, margin.y, margin.z, margin.w]);
      var anchor = entity.entity.element.anchor;
      entity.set('components.element.anchor', [anchor.x, anchor.y, anchor.z, anchor.w]);
      entity.set('components.element.width', entity.entity.element.width);
      entity.set('components.element.height', entity.entity.element.height);
      var pos = entity.entity.getLocalPosition();
      entity.set('position', [pos.x, pos.y, pos.z]);
      entity.sync.enabled = sync;
      entity.history.enabled = history;
  };

  var applyProperties = function(entity, pathPrefix, properties) {
      Object.keys(properties).forEach(function(key) {
          var value = properties[key];
          var path = pathPrefix + '.' + key;
          var prevHistory = entity.history.enabled;

          entity.history.enabled = false;
          entity.set(path, value, undefined, undefined, true);
          entity.history.enabled = prevHistory;
      });
  };

  var addEvents = function (entity) {
      var setting = {
          pos: false,
          anchor: false,
          pivot: false,
          size: false,
          margin: false,
          text: false,
          autoWidth: false,
          autoHeight: false
      };

      events.push(entity.on('*:set', function (path, value, valueOld, remote) {
          if (remote || ! entity.entity || ! entity.has('components.element')) return;

          // position change
          if (/^position/.test(path)) {
              if (setting.position) return;

              setting.position = true;

              // timeout because if we do it in the handler
              // it won't get sent to C3 due to observer.silence
              setTimeout(function () {
                  if (!editor.call('entities:layout:isUnderControlOfLayoutGroup', entity)) {
                      var margin = entity.entity.element.margin;
                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      setting.margin = true;
                      entity.set('components.element.margin', [fixed(margin.x), fixed(margin.y), fixed(margin.z), fixed(margin.w)]);
                      setting.margin = false;
                      entity.history.enabled = history;
                  }

                  setting.position = false;
              });
          }
          // anchor change
          else if (/^components.element.anchor/.test(path)) {
              if (setting.anchor) return;
              setting.anchor = true;

              setTimeout(function () {
                  var pos = entity.entity.getLocalPosition();
                  var width = entity.entity.element.width;
                  var height = entity.entity.element.height;

                  var history = entity.history.enabled;
                  entity.history.enabled = false;
                  setting.size = true;
                  entity.set('position', [fixed(pos.x), fixed(pos.y), fixed(pos.z)]);
                  entity.set('components.element.width', fixed(width));
                  entity.set('components.element.height', fixed(height));
                  setting.size = false;
                  entity.history.enabled = history;

                  setting.anchor = false;
              });
          }
          // pivot change
          else if (/^components.element.pivot/.test(path)) {
              if (setting.pivot) return;

              setting.pivot = true;

              setTimeout(function () {

                  var pos = entity.entity.getLocalPosition();
                  var margin = entity.entity.element.margin;

                  var history = entity.history.enabled;
                  entity.history.enabled = false;
                  setting.position = true;
                  setting.margin = true;
                  entity.set('position', [fixed(pos.x), fixed(pos.y), fixed(pos.z)]);
                  entity.set('components.element.margin', [fixed(margin.x), fixed(margin.y), fixed(margin.z), fixed(margin.w)]);
                  setting.position = false;
                  setting.margin = false;
                  entity.history.enabled = history;

                  setting.pivot = false;
              });
          }
          // width / height change
          else if (/^components.element.(width|height)/.test(path)) {
              if (setting.size) return;

              setting.size = true;

              setTimeout(function () {
                  var margin = entity.entity.element.margin;

                  var history = entity.history.enabled;
                  entity.history.enabled = false;
                  setting.margin = true;
                  entity.set('components.element.margin', [fixed(margin.x), fixed(margin.y), fixed(margin.z), fixed(margin.w)]);
                  setting.margin = false;
                  entity.history.enabled = history;

                  setting.size = false;
              });
          }
          // margin change
          else if (/^components.element.margin/.test(path)) {
              if (setting.margin) return;

              setting.margin = true;

              setTimeout(function () {
                  var pos = entity.entity.getLocalPosition();
                  var width = entity.entity.element.width;
                  var height = entity.entity.element.height;

                  var history = entity.history.enabled;
                  entity.history.enabled = false;
                  setting.position = true;
                  setting.size = true;
                  entity.set('position', [fixed(pos.x), fixed(pos.y), fixed(pos.z)]);
                  entity.set('components.element.width', fixed(width));
                  entity.set('components.element.height', fixed(height));
                  setting.size = false;
                  setting.position = false;
                  entity.history.enabled = history;

                  setting.margin = false;
              });
          }
          // autoWidth change
          else if (/^components.element.autoWidth/.test(path)) {
              if (setting.autoWidth) return;

              setting.autoWidth = true;
              setTimeout(function () {
                  var width = entity.entity.element.width;

                  var history = entity.history.enabled;
                  entity.history.enabled = false;
                  entity.set('components.element.width', fixed(width));
                  entity.history.enabled = history;
                  setting.autoWidth = false;
              });
          }
          // autoHeight change
          else if (/^components.element.autoHeight/.test(path)) {
              if (setting.autoHeight) return;

              setting.autoHeight = true;
              setTimeout(function () {
                  var height = entity.entity.element.height;

                  var history = entity.history.enabled;
                  entity.history.enabled = false;
                  entity.set('components.element.height', fixed(height));
                  entity.history.enabled = history;
                  setting.autoHeight = false;
              });
          }
          // text / font change
          else if (/^components.element.(text|fontAsset)/.test(path)) {
              if (setting.text) return;

              setting.text = true;
              if (entity.get('components.element.autoWidth') ||
                  entity.get('components.element.autoHeight')) {

                  setTimeout(function () {
                      var width = entity.entity.element.width;
                      var height = entity.entity.element.height;

                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      if (entity.get('components.element.autoWidth'))
                          entity.set('components.element.width', fixed(width));
                      if (entity.get('components.element.autoHeight'))
                          entity.set('components.element.height', fixed(height));
                      entity.history.enabled = history;

                      setting.text = false;
                  });

              }
          }
          // disabling a layout group
          else if (/^components.layoutgroup.enabled/.test(path)) {
              if (value === false && valueOld === true) {
                  editor.call('entities:layout:storeLayout', entity.get('children'));
              }
          }
          // excluding a layout child from the layout
          else if (/^components.layoutchild.excludeFromLayout/.test(path)) {
              if (value === true && valueOld === false) {
                  editor.call('entities:layout:storeLayout', [entity.entity.getGuid()]);
              }
          }
          // switching the orientation of a scrollbar - we need to update the anchoring
          // and margins of the track element and handle element to account for the new
          // orientation.
          else if (/^components.scrollbar.orientation/.test(path)) {
              if (value !== valueOld) {
                  var orientation = value;

                  var containerElementDefaults = editor.call('components:scrollbar:getContainerElementDefaultsForOrientation', orientation);
                  var handleElementDefaults = editor.call('components:scrollbar:getHandleElementDefaultsForOrientation', orientation);

                  if (orientation === ORIENTATION_HORIZONTAL) {
                      delete containerElementDefaults.width;
                  } else if (orientation === ORIENTATION_VERTICAL) {
                      delete containerElementDefaults.height;
                  }

                  var containerEntity = entity;
                  applyProperties(containerEntity, 'components.element', containerElementDefaults);

                  var handleEntityGuid = entity.get('components.scrollbar.handleEntity');
                  var handleEntity = handleEntityGuid && editor.call('entities:get', handleEntityGuid);
                  if (handleEntity) {
                      applyProperties(handleEntity, 'components.element', handleElementDefaults);
                  }
              }
          }
      }));

      // removing a layout group component
      events.push(entity.on('components.layoutgroup:unset', function () {
          setTimeout(function () {
              editor.call('entities:layout:storeLayout', entity.get('children'));
          });
      }));

      events.push(editor.on('gizmo:translate:end', function() {
          var translatedEntities = editor.call('selector:items');

          setTimeout(function () {
              var didReflow = false;

              // Trigger reflow if the user has moved an element that is under
              // the control of a layout group.
              for (var i = 0; i < translatedEntities.length; ++i) {
                  var entity = translatedEntities[i];

                  if (editor.call('entities:layout:isUnderControlOfLayoutGroup', entity)) {
                      editor.call('entities:layout:scheduleReflow', entity.get('parent'));
                      didReflow = true;
                  }
              }

              if (didReflow) {
                  setTimeout(function () {
                      // Ensure the reflowed positions are synced to other clients.
                      var parent = editor.call('entities:get', entity.get('parent'));
                      var siblings = parent.get('children');
                      editor.call('entities:layout:storeLayout', siblings);

                      // Trigger the translate gizmo to re-sync with the position of
                      // the selected elements, as they will likely have moved as a
                      // result of the reflow.
                      editor.emit('gizmo:translate:sync');
                  });
              }
          });
      }));
  };

  var clear = function () {
      for (var i = 0, len = events.length; i < len; i++)
          events[i].unbind();

      events.length = 0;
  };

  editor.on('attributes:clear', clear);

});


/* editor/viewport/viewport-layers.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var projectSettings = editor.call('settings:project');

  var layerIndex = {};

  var events = [];

  var createLayer = function (id, data) {
      id = parseInt(id, 10);
      return new pc.Layer({
          id: id,
          enabled: id !== LAYERID_DEPTH, // disable depth layer - it will be enabled by the engine as needed
          name: data.name,
          opaqueSortMode: data.opaqueSortMode,
          transparentSortMode: data.transparentSortMode
      });
  };

  var initLayers = function () {
      for (var i = 0; i < events.length; i++) {
          events[i].unbind();
      }
      events.length = 0;

      // on settings change
      events.push(projectSettings.on('*:set', function (path, value) {
          var parts, id;

          if (path.startsWith('layers.')) {
              parts = path.split('.');

              if (parts.length === 2) {
                  id = parseInt(parts[1],10);
                  var layer = createLayer(id, value);
                  layerIndex[layer.id] = layer;

                  var existing = app.scene.layers.getLayerById(value.id);
                  if (existing) {
                      app.scene.layers.remove(existing);
                  }
              } else if (parts.length === 3) {
                  id = parseInt(parts[1],10);
                  // change layer property
                  if (layerIndex[id]) {
                      layerIndex[id][parts[2]] = value;
                  }
              }

          } else if (path.startsWith('layerOrder.')) {
              parts = path.split('.');

              if (parts.length === 3) {
                  if (parts[2] === 'enabled') {
                      editor.call('gizmo:layers:removeFromComposition');

                      var subLayerId = parseInt(parts[1]);
                      app.scene.layers.subLayerEnabled[subLayerId] = value;

                      editor.call('gizmo:layers:addToComposition');

                      editor.call('viewport:render');
                  }
              }
          }
      }));

      events.push(projectSettings.on('*:unset', function (path) {
          if (path.startsWith('layers.')) {
              var parts = path.split('.');
              // remove layer
              if (parts.length === 2) {
                  var id = parseInt(parts[1],10);
                  delete layerIndex[id];

                  var existing = app.scene.layers.getLayerById(id);
                  if (existing) {
                      app.scene.layers.remove(existing);
                  }

              }
          }
      }));

      events.push(projectSettings.on('layerOrder:insert', function (value, index) {
          var id = value.get('layer');
          var layer = layerIndex[id];
          if (! layer) return;

          var transparent = value.get('transparent');

          editor.call('gizmo:layers:removeFromComposition');

          if (transparent) {
              app.scene.layers.insertTransparent(layer, index);
          } else {
              app.scene.layers.insertOpaque(layer, index);
          }

          editor.call('gizmo:layers:addToComposition');


          editor.call('viewport:render');
      }));

      events.push(projectSettings.on('layerOrder:remove', function (value) {
          var id = value.get('layer');
          var layer = layerIndex[id];
          if (! layer) return;

          var transparent = value.get('transparent');

          editor.call('gizmo:layers:removeFromComposition');

          if (transparent) {
              app.scene.layers.removeTransparent(layer);
          } else {
              app.scene.layers.removeOpaque(layer);
          }

          editor.call('gizmo:layers:addToComposition');

          editor.call('viewport:render');
      }));

      events.push(projectSettings.on('layerOrder:move', function (value, indNew, indOld) {
          var id = value.get('layer');
          var layer = layerIndex[id];
          if (! layer) return;

          editor.call('gizmo:layers:removeFromComposition');

          var transparent = value.get('transparent');
          if (transparent) {
              app.scene.layers.removeTransparent(layer);
              app.scene.layers.insertTransparent(layer, indNew);
          } else {
              app.scene.layers.removeOpaque(layer);
              app.scene.layers.insertOpaque(layer, indNew);
          }

          editor.call('gizmo:layers:addToComposition');

          editor.call('viewport:render');
      }));

      var layers = projectSettings.get('layers');
      if (! layers) return;

      var layerOrder = projectSettings.get('layerOrder');
      if (! layerOrder) return;

      var i, len;
      var composition = new pc.LayerComposition();

      var index = {};
      for (var key in layers) {
          layerIndex[key] = createLayer(key, layers[key]);
      }

      for (i = 0, len = layerOrder.length; i<len; i++) {
          var sublayer = layerOrder[i];
          var layer = layerIndex[sublayer.layer];
          if (! layer) continue;

          if (sublayer.transparent) {
              composition.pushTransparent(layer);
          } else {
              composition.pushOpaque(layer);
          }

          composition.subLayerEnabled[i] = sublayer.enabled;
      }

      editor.call('gizmo:layers:addToComposition', composition);

      app.scene.layers = composition;
  };

  editor.on('settings:project:load', initLayers);

});


/* editor/viewport/viewport-scene-settings.js */
editor.once('load', function() {
  'use strict';

  var sceneSettings = editor.call('sceneSettings');
  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var assetsLoaded = false;
  var sceneSettingsLoaded = false;
  var updating;

  // queue settings apply
  var queueApplySettings = function() {
      if (! sceneSettingsLoaded || updating || ! assetsLoaded)
          return;

      updating = true;

      editor.call('viewport:render');
      editor.once('viewport:update', applySettings);
  };

  // apply settings
  var applySettings = function() {
      if (! app) return;

      updating = false;

      // apply scene settings
      app.applySceneSettings(sceneSettings.json());

      // need to update all materials on scene settings change
      for(var i = 0; i < app.assets._assets.length; i++) {
          if (app.assets._assets[i].type !== 'material' || !app.assets._assets[i].resource)
              continue;

          app.assets._assets[i].resource.update();
      }

      editor.call('viewport:render');
  };

  // on settings change
  sceneSettings.on('*:set', queueApplySettings);

  editor.on('assets:load', function () {
      assetsLoaded = true;
      queueApplySettings();
  });

  editor.on('sceneSettings:load', function () {
      sceneSettingsLoaded = true;
      queueApplySettings();
  });
});


/* editor/viewport/viewport-assets.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return;

  var assets = app.assets;

  editor.call('assets:registry:bind', assets);

  var regexFrameUpdate = /^data\.frames\.(\d+)/;
  var regexFrameRemove = /^data\.frames\.(\d+)$/;
  var regexI18n = /^i18n\.[^\.]+?$/;

  // add assets to asset registry
  editor.on('assets:add', function (asset) {
      // do only for target assets
      if (asset.get('source'))
          return;

      var assetEngine = assets.get(asset.get('id'));
      // render on asset load
      assetEngine.on('load', function() {
          editor.call('viewport:render');
      });
      // render on asset data change
      assetEngine.on('change', function() {
          editor.call('viewport:render');
      });

      // when data is changed
      asset.on('*:set', function (path, value) {

          // handle i18n changes
          if (regexI18n.test(path)) {
              var parts = path.split('.');
              assetEngine.addLocalizedAssetId(parts[1], value);

          } else if (asset.get('type') === 'textureatlas') {
              // handle frame changes for texture atlas
              var match = path.match(regexFrameUpdate);
              if (match) {
                  var frameKey = match[1];
                  var frame = asset.get('data.frames.' + frameKey);

                  if (assetEngine.resource) {
                      if (frame) {
                          assetEngine.resource.setFrame(frameKey, {
                              rect: new pc.Vec4(frame.rect),
                              pivot: new pc.Vec2(frame.pivot),
                              border: new pc.Vec4(frame.border)
                          });
                      }
                  }

                  if (! assetEngine.data.frames) {
                      assetEngine.data.frames = {};
                  }
                  assetEngine.data.frames[frameKey] = frame;
              }
          }

          editor.call('viewport:render');
      });

      asset.on('*:unset', function (path) {
          if (regexI18n.test(path)) {
              var parts = path.split('.');
              assetEngine.removeLocalizedAssetId(parts[1]);

              editor.call('viewport:render');
          } else if (asset.get('type') === 'textureatlas') {
              var match = path.match(regexFrameRemove);
              if (match) {
                  var frameKey = match[1];

                  if (assetEngine.resource) {
                      assetEngine.resource.removeFrame(frameKey);
                  }

                  if (assetEngine.frames && assetEngine.frames[frameKey]) {
                      delete assetEngine.frames;
                  }

                  editor.call('viewport:render');
              }
          }
      });

      if (asset.get('type') === 'sprite') {
          var updateFrameKeys = function () {
              if (assetEngine.resource) {
                  assetEngine.resource.frameKeys = asset.get('data.frameKeys');
              }

              assetEngine.data.frameKeys = asset.get('data.frameKeys');

              editor.call('viewport:render');
          };

          asset.on('data.frameKeys:set', updateFrameKeys);
          asset.on('data.frameKeys:insert', updateFrameKeys);
          asset.on('data.frameKeys:remove', updateFrameKeys);
          asset.on('data.frameKeys:move', updateFrameKeys);
      }

      // render
      editor.call('viewport:render');
  });

  // remove assets from asset registry
  editor.on('assets:remove', function (asset) {
      // re-render
      editor.call('viewport:render');
  });

  // patch update for materials to re-render the viewport
  var update = pc.PhongMaterial.prototype.update;
  pc.PhongMaterial.prototype.update = function () {
      update.call(this);
      editor.call('viewport:render');
  };
});


/* editor/viewport/viewport-lightmapper.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var uv1MissingAssets = { };


  // bake
  editor.method('lightmapper:bake', function(entities) {
      if (! entities) {
          entities = editor.call('entities:list').filter(function(e) {
              return e.get('components.model.lightmapped');
          });
      }

      uv1MissingAssets = { };
      var areaJobs = { };
      var jobs = 0;

      var readyForBake = function() {
          app.lightmapper.bake(null, app.scene.lightmapMode);
          app.renderer.prepareStaticMeshes(app.graphicsDevice, app.scene);
          editor.call('viewport:render');
          editor.emit('lightmapper:baked');
      };

      // validate lightmapped entities
      for(var i = 0; i < entities.length; i++) {
          var obj = entities[i];

          // might be primitive
          if (obj.get('components.model.type') !== 'asset')
              continue;

          // might have no model asset attached
          var assetId = obj.get('components.model.asset');
          if (! assetId)
              continue;

          // model asset might be missing
          var asset = editor.call('assets:get', assetId);
          if (! asset)
              continue;

          // check if asset has uv1
          var uv1 = asset.has('meta.attributes.texCoord1');
          if (! uv1) {
              // uv1 might be missing
              if (! uv1MissingAssets[assetId])
                  uv1MissingAssets[assetId] = asset;
              continue;
          }

          // check if asset has area
          var area = asset.get('data.area');
          if (! area && ! areaJobs[assetId]) {
              // if area not available
              // recalculate area
              areaJobs[assetId] = asset;
              jobs++;
              editor.call('assets:model:area', asset, function() {
                  jobs--;

                  if (jobs === 0)
                      readyForBake();
              });
          }
      }

      editor.call('lightmapper:uv1missing', uv1MissingAssets);

      if (jobs === 0)
          readyForBake();
  });


  editor.method('entities:shadows:update', function() {
      var entities = editor.call('entities:list').filter(function(e) {
          return e.get('components.light.castShadows') && e.get('components.light.shadowUpdateMode') === 1 && e.entity && e.entity.light && e.entity.light.shadowUpdateMode === pc.SHADOWUPDATE_THISFRAME;
      });

      if (! entities.length)
          return;

      for(var i = 0; i < entities.length; i++)
          entities[i].entity.light.light.shadowUpdateMode = pc.SHADOWUPDATE_THISFRAME;

      editor.call('viewport:render');
  });
});


/* editor/viewport/viewport-lightmapper-auto.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var entityAssetLoading = { };
  var bakingNextFrame = false;
  var state = false;
  var timeLast = 0;
  var timeDelay = 500;
  var queued = false;


  editor.on('lightmapper:baked', function() {
      queued = false;
      timeLast = Date.now();
  });


  editor.method('lightmapper:auto', function(value) {
      if (value === undefined)
          return state;

      if (state === value)
          return;

      state = value;
      editor.emit('lightmapper:auto', state);

      rebakeScene();
  });
  editor.emit('lightmapper:auto', state);


  // track entities model assets loading state to re-bake
  var rebakeEntity = function(entity, force) {
      if (! (state || force))
          return;

      if (! entity.has('components.model'))
          return;

      var type = entity.get('components.model.type');

      if (type === 'asset') {
          var assetId = entity.get('components.model.asset');
          if (! assetId)
              return;

          var asset = app.assets.get(parseInt(assetId, 10));
          if (! asset || ! asset.resource) {
              var loading = entityAssetLoading[entity.get('resource_id')];
              if (loading) {
                  if (loading.assetId === assetId)
                      return;

                  app.assets.off('load:' + loading.assetId, loading.fn);
                  delete entityAssetLoading[entity.get('resource_id')];
              }

              loading = {
                  assetId: assetId,
                  fn: function(asset) {
                      delete entityAssetLoading[entity.get('resource_id')];

                      if (asset.id !== parseInt(entity.get('components.model.asset'), 10))
                          return;

                      rebakeEntity(entity);
                  }
              };
              app.assets.once('load:' + assetId, loading.fn);
              return;
          }
      }

      editor.call('viewport:render');
      editor.once('viewport:update', function() {
          // console.log('rebake self');
          editor.call('lightmapper:bake', [ entity ]);
      });
  };

  var rebakeScene = function(force) {
      if (! (state || force))
          return;

      if (bakingNextFrame)
          return;

      if (! force && (Date.now() - timeLast) < timeDelay) {
          if (! queued) {
              queued = true;
              setTimeout(function() {
                  if (! queued) return;
                  rebakeScene();
              }, (timeDelay - (Date.now() - timeLast)) + 16);
          }
          return;
      }

      bakingNextFrame = true;
      editor.call('viewport:render');
      editor.once('viewport:update', function() {
          if (! bakingNextFrame)
              return;

          bakingNextFrame = false;
          editor.call('lightmapper:bake');
          editor.call('entities:shadows:update');
      });
  };


  editor.on('viewport:update', function() {
      if (queued && (Date.now() - timeLast) >= timeDelay)
          rebakeScene();
  });


  // bake once all assets are loaded on first time-load
  var loadingAssets = { };
  var onLoadStart = function(asset) {
      loadingAssets[asset.id] = true;
      asset.once('load', function() {
          delete loadingAssets[asset.id];

          if (Object.keys(loadingAssets).length === 0) {
              app.assets.off('load:start', onLoadStart);
              rebakeScene(true);
          }
      });
  };
  app.assets.on('load:start', onLoadStart);

  // re-bake on scene switches
  editor.on('scene:load', function() {
      // needs to wait 3 frames
      // before it is safe to re-bake
      // don't ask why :D

      editor.call('viewport:render');
      editor.once('viewport:update', function() {
          editor.call('viewport:render');
          editor.once('viewport:update', function() {
              rebakeScene(true);
          });
      });
  });

  // re-bake on scene settings loaded
  editor.on('sceneSettings:load', function() {
      rebakeScene(true);
  });


  var evtRebakeEntity = function() {
      rebakeEntity(this);
  };
  var evtRebakeLight = function() {
      if (! this.get('components.light.bake'))
          return;

      rebakeScene();
  };

  var evtRebakeScene = function() {
      rebakeScene();
  };

  // subscribe to model, light and scene changes
  // to do rebaking
  var fieldsLocal = [
      'components.model.lightmapped',
      'components.model.lightmapSizeMultiplier',
      'components.model.receiveShadows'
  ];
  var fieldsLight = [
      'components.light.color',
      'components.light.intensity',
      'components.light.range',
      'components.light.falloffMode',
      'components.light.castShadows',
      'components.light.shadowResolution',
      'components.light.shadowBias',
      'components.light.normalOffsetBias'
  ];
  var fieldsGlobal = [
      'enabled',
      'components.model.enabled',
      'components.model.type',
      'components.model.asset',
      'components.model.castShadowsLightmap',
      'components.light.bake'
  ];

  editor.on('entities:add', function(entity) {
      // model
      for(var i = 0; i < fieldsLocal.length; i++)
          entity.on(fieldsLocal[i] + ':set', evtRebakeEntity);

      // light
      for(var i = 0; i < fieldsLight.length; i++)
          entity.on(fieldsLight[i] + ':set', evtRebakeLight);

      // global
      for(var i = 0; i < fieldsGlobal.length; i++)
          entity.on(fieldsGlobal[i] + ':set', evtRebakeScene);
  });

  editor.on('gizmo:translate:end', evtRebakeScene);
  editor.on('gizmo:rotate:end', evtRebakeScene);
  editor.on('gizmo:scale:end', evtRebakeScene);
});


/* editor/viewport/viewport-drop-model.js */
editor.once('load', function() {
  'use strict';

  var canvas = editor.call('viewport:canvas');
  if (! canvas) return;

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var aabb = new pc.BoundingBox();
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();


  var dropRef = editor.call('drop:target', {
      ref: canvas.element,
      filter: function(type, data) {
          if (type === 'asset.model') {
              var asset = app.assets.get(data.id);
              if (asset) app.assets.load(asset);

              return true;
          }

          if (type === 'assets') {
              for(var i = 0; i < data.ids.length; i++) {
                  var asset = editor.call('assets:get', data.ids[i]);
                  if (! asset)
                      return false;

                  if (asset.get('type') !== 'model')
                      return false;
              }

              for(var i = 0; i < data.ids.length; i++) {
                  var asset = app.assets.get(data.ids[i]);
                  if (asset) app.assets.load(asset);
              }

              return true;
          }
      },
      drop: function(type, data) {
          if (! config.scene.id)
              return;

          var assets = [ ];

          if (type === 'asset.model') {
              var asset = editor.call('assets:get', parseInt(data.id, 10));
              if (asset) assets.push(asset);
          } else if (type === 'assets') {
              for(var i = 0; i < data.ids.length; i++) {
                  var asset = editor.call('assets:get', parseInt(data.ids[i], 10));
                  if (asset && asset.get('type') === 'model')
                      assets.push(asset);
              }
          }

          if (! assets.length)
              return;

          // parent
          var parent = null;
          if (editor.call('selector:type') === 'entity')
              parent = editor.call('selector:items')[0];

          if (! parent)
              parent = editor.call('entities:root');

          var entities = [ ];
          var data = [ ];

          // calculate aabb
          var first = true;
          for(var i = 0; i < assets.length; i++) {
              var assetEngine = app.assets.get(assets[i].get('id'));
              if (! assetEngine) continue;

              if (assetEngine.resource) {
                  var meshes = assetEngine.resource.meshInstances;
                  for(var m = 0; m < meshes.length; m++) {
                      if (first) {
                          first = false;
                          aabb.copy(meshes[m].aabb);
                      } else {
                          aabb.add(meshes[m].aabb);
                      }
                  }
              }
          }

          if (first) {
              aabb.center.set(0, 0, 0);
              aabb.halfExtents.set(1, 1, 1);
          }

          // calculate point
          var camera = editor.call('camera:current');
          var distance = 0;

          if (ui.Tree._ctrl && ui.Tree._ctrl()) {
              vecA.copy(camera.forward).scale(aabb.halfExtents.length() * 2.2);
              vecB.copy(camera.getPosition()).add(vecA);
              vecC.copy(vecB).sub(aabb.center);

              var tmp = new pc.Entity();
              parent.entity.addChild(tmp);
              tmp.setPosition(vecC);
              vecC.copy(tmp.getLocalPosition());
              tmp.destroy();

              // focus distance
              distance = vecA.copy(camera.getPosition()).sub(vecB).length();
          } else {
              vecC.set(0, 0, 0);
              vecB.copy(parent.entity.getPosition()).add(aabb.center);
              distance = aabb.halfExtents.length() * 2.2;
          }

          for(var i = 0; i < assets.length; i++) {
              var component = editor.call('components:getDefault', 'model');
              component.type = 'asset';
              component.asset = parseInt(assets[i].get('id'), 10);

              var name = assets[i].get('name');
              if (/\.json$/i.test(name))
                  name = name.slice(0, -5) || 'Untitled';

              // new entity
              var entity = editor.call('entities:new', {
                  parent: parent,
                  name: name,
                  position: [ vecC.x, vecC.y, vecC.z ],
                  components: {
                      model: component
                  },
                  noSelect: true,
                  noHistory: true
              });

              entities.push(entity);
              data.push(entity.json());
          }

          editor.call('selector:history', false);
          editor.call('selector:set', 'entity', entities);
          editor.once('selector:change', function() {
              editor.call('selector:history', true);
          });

          var selectorType = editor.call('selector:type');
          var selectorItems = editor.call('selector:items');
          if (selectorType === 'entity') {
              for(var i = 0; i < selectorItems.length; i++)
                  selectorItems[i] = selectorItems[i].get('resource_id');
          }

          var parentId = parent.get('resource_id');
          var resourceIds = [ ];
          for(var i = 0; i < entities.length; i++)
              resourceIds.push(entities[i].get('resource_id'));

          editor.call('history:add', {
              name: 'new model entities ' + entities.length,
              undo: function() {
                  for(var i = 0; i < resourceIds.length; i++) {
                      var entity = editor.call('entities:get', resourceIds[i]);
                      if (! entity)
                          continue;

                      editor.call('entities:removeEntity', entity);
                  }

                  if (selectorType === 'entity' && selectorItems.length) {
                      var items = [ ];
                      for(var i = 0; i < selectorItems.length; i++) {
                          var item = editor.call('entities:get', selectorItems[i]);
                          if (item)
                              items.push(item);
                      }

                      if (items.length) {
                          editor.call('selector:history', false);
                          editor.call('selector:set', selectorType, items);
                          editor.once('selector:change', function() {
                              editor.call('selector:history', true);
                          });
                      }
                  }
              },
              redo: function() {
                  var parent = editor.call('entities:get', parentId);
                  if (! parent)
                      return;

                  var entities = [ ];

                  for(var i = 0; i < data.length; i++) {
                      var entity = new Observer(data[i]);
                      entities.push(entity);
                      editor.call('entities:addEntity', entity, parent, false);
                  }

                  editor.call('selector:history', false);
                  editor.call('selector:set', 'entity', entities);
                  editor.once('selector:change', function() {
                      editor.call('selector:history', true);
                  });

                  editor.call('viewport:render');
                  editor.call('camera:focus', vecB, distance);
              }
          });

          editor.call('viewport:render');
          editor.call('camera:focus', vecB, distance);
      }
  });
});


/* editor/viewport/viewport-drop-material.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var canvas = editor.call('viewport:canvas');
  var active = false;
  var hoverMaterial = null;
  var hoverAsset = null;
  var hoverEntity = null;
  var hoverNode = null;
  var hoverPicked = null;
  var hoverMeshInstance = null;


  editor.on('viewport:pick:hover', function(node, picked) {
      hoverNode = node;
      hoverPicked = picked;

      if (active)
          onPick(node, picked);
  });


  var onPick = function(node, picked) {
      var meshInstance = null;

      if (node && node._icon)
          node = node._getEntity();

      if (! node || ! editor.call('entities:get', node.getGuid())) {
          onHover(null);
          return;
      }

      if (picked instanceof pc.MeshInstance)
          meshInstance = picked;

      if (node.model && meshInstance && (! meshInstance.node._parent || ! meshInstance.node._parent._icon)) {
          onHover(node, meshInstance);
      } else {
          onHover(null);
      }
  };


  var onLeave = function() {
      if (! hoverEntity)
          return;

      if (hoverEntity.model.type === 'asset') {

          if (hoverAsset) {
              hoverAsset.data.mapping[hoverAsset._materialIndHover].material = hoverAsset._materialBeforeHover;
              hoverAsset.fire('change', hoverAsset, 'data', hoverAsset.data, hoverAsset.data);
              delete hoverAsset._materialBeforeHover;
          } else {
              var mapping = hoverEntity.model.mapping;
              if (hoverEntity._materialBeforeHover === undefined)
                  delete mapping[hoverEntity._materialIndHover];
              else
                  mapping[hoverEntity._materialIndHover] = hoverEntity._materialBeforeHover;
              hoverEntity.model.mapping = mapping;
          }
      } else if (hoverEntity._materialBeforeHover) {
          hoverEntity.model.material = hoverEntity._materialBeforeHover;
      }

      delete hoverEntity._materialBeforeHover;
      delete hoverEntity._materialIndHover;

      editor.call('viewport:render');
  };

  var onHover = function(entity, meshInstance) {
      if (entity === hoverEntity && meshInstance === hoverMeshInstance)
          return;

      onLeave();

      hoverAsset = null;
      hoverEntity = entity;
      hoverMeshInstance = meshInstance;

      if (hoverEntity) {
          if (hoverEntity.model.type === 'asset') {
              var ind = hoverEntity.model.model.meshInstances.indexOf(hoverMeshInstance);
              if (ind !== -1) {
                  var mapping = hoverEntity.model.mapping;
                  if (!mapping || !mapping.hasOwnProperty(ind)) {

                      hoverAsset = app.assets.get(hoverEntity.model.asset);
                      hoverAsset._materialBeforeHover = hoverAsset.data.mapping[ind].material;
                      hoverAsset._materialIndHover = ind;

                      hoverAsset.data.mapping[ind].material = hoverMaterial.id;
                      hoverAsset.fire('change', hoverAsset, 'data', hoverAsset.data, hoverAsset.data);
                  } else {
                      hoverEntity._materialBeforeHover = mapping[ind];
                      hoverEntity._materialIndHover = ind;

                      mapping[ind] = hoverMaterial.id;
                      hoverEntity.model.mapping = mapping;
                  }

                  editor.call('viewport:render');
              }
          } else {
              hoverEntity._materialBeforeHover = hoverEntity.model.material;
              hoverEntity.model.material = hoverMaterial.resource;
              editor.call('viewport:render');
          }
      }
  };

  var dropRef = editor.call('drop:target', {
      ref: canvas.element,
      type: 'asset.material',
      hole: true,
      drop: function(type, data) {
          if (! config.scene.id)
              return;

          active = false;

          if (! hoverEntity || ! hoverEntity.model)
              return;

          var entity = editor.call('entities:get', hoverEntity.getGuid());
          if (! entity)
              return;

          if (entity.get('components.model.type') === 'asset') {
              var ind = hoverEntity.model.model.meshInstances.indexOf(hoverMeshInstance);
              if (ind === -1)
                  return;

              // if we are setting the model asset mapping then set it and return
              if (hoverAsset) {
                  var asset = editor.call('assets:get', hoverAsset.id);
                  if (asset.has('data.mapping.' + ind + '.material')) {
                      var history = asset.history.enabled;
                      asset.history.enabled = false;

                      var prevMapping = asset.get('data.mapping.' + ind + '.material');
                      var prevUserMapping = asset.get('meta.userMapping.' + ind);
                      var newMapping = hoverMaterial.id;

                      // set mapping and also userMapping
                      asset.set('data.mapping.' + ind + '.material', newMapping);
                      if (! asset.get('meta')) {
                          asset.set('meta', {
                              userMapping: {}
                          });
                      } else {
                          if (! asset.has('meta.userMapping')) {
                              asset.set('meta.userMapping', {});
                          }
                      }

                      asset.set('meta.userMapping.' + ind, true);

                      asset.history.enabled = history;

                      editor.call('history:add', {
                          name: 'assets.' + asset.get('id') + '.data.mapping.' + ind + '.material',
                          undo: function() {
                              var item = editor.call('assets:get', asset.get('id'));
                              if (! item) return;

                              var history = item.history.enabled;
                              item.history.enabled = false;
                              item.set('data.mapping.' + ind + '.material', prevMapping);

                              if (! prevUserMapping) {
                                  item.unset('meta.userMapping.' + ind);

                                  if (! Object.keys(item.get('meta.userMapping')).length) {
                                      item.unset('meta.userMapping');
                                  }
                              }

                              item.history.enabled = history;
                          },
                          redo: function() {
                              var item = editor.call('assets:get', asset.get('id'));
                              if (! item) return;

                              var history = item.history.enabled;
                              item.history.enabled = false;
                              item.set('data.mapping.' + ind + '.material', newMapping);
                              if (! item.get('meta')) {
                                  item.set('meta', {
                                      userMapping: {}
                                  });
                              } else {
                                  if (! item.has('meta.userMapping')) {
                                      item.set('meta.userMapping', {});
                                  }
                              }

                              item.set('meta.userMapping.' + ind, true);
                              item.history.enabled = history;
                          }
                      });
                  }
              } else {
                  // set mapping with custom history action
                  // to prevent bug where undoing will set the mapping to
                  // null instead of unsetting it
                  var history = entity.history.enabled;
                  entity.history.enabled = false;
                  var resourceId = entity.get('resource_id');

                  var undo = {};
                  var redo = {};

                  if (!entity.get('components.model.mapping')) {
                      var mapping = {};
                      mapping[ind] = parseInt(hoverMaterial.id, 10);
                      entity.set('components.model.mapping', mapping);
                      undo.path = 'components.model.mapping';
                      undo.value = undefined;
                      redo.path = undo.path;
                      redo.value = mapping;
                  } else {
                      undo.path = 'components.model.mapping.' + ind;
                      undo.value = entity.has('components.model.mapping.' + ind) ?
                                   entity.get('components.model.mapping.' + ind) :
                                   undefined;
                      redo.path = undo.path;
                      redo.value = parseInt(hoverMaterial.id, 10);

                      entity.set('components.model.mapping.' + ind, parseInt(hoverMaterial.id, 10));

                  }
                  entity.history.enabled = history;

                  editor.call('history:add', {
                      name: 'entities.' + resourceId + '.components.model.mapping',
                      undo: function() {
                          var item = editor.call('entities:get', resourceId);
                          if (! item) return;

                          var history = item.history.enabled;
                          item.history.enabled = false;

                          if (undo.value === undefined)
                              item.unset(undo.path);
                          else
                              item.set(undo.path, undo.value);

                          item.history.enabled = history;
                      },
                      redo: function() {
                          var item = editor.call('entities:get', resourceId);
                          if (! item) return;

                          var history = item.history.enabled;
                          item.history.enabled = false;
                          if (redo.value === undefined)
                              item.unset(redo.path);
                          else
                              item.set(redo.path, redo.value);
                          item.history.enabled = history;
                      }
                  });
              }
          } else {
              // primitive model
              entity.set('components.model.materialAsset', hoverMaterial.id);
          }
      },
      over: function(type, data) {
          if (! config.scene.id)
              return;

          hoverMaterial = app.assets.get(parseInt(data.id, 10));
          if (! hoverMaterial)
              return;

          app.assets.load(hoverMaterial);

          hoverEntity = null;
          hoverMeshInstance = null;

          active = true;

          onPick(hoverNode, hoverPicked);
      },
      leave: function() {
          if (!config.scene.id)
              return;

          active = false;

          onLeave();
      }
  });
});


/* editor/viewport/viewport-drop-cubemap.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var canvas = editor.call('viewport:canvas');
  var evtPickHover = null;
  var evtViewportHover = null;
  var evtOnLoad = null;
  var hoverSkybox = null;
  var hoverMaterial = null;
  var hoverCubemap = null;
  var hoverEntity = undefined;
  var hoverMeshInstance = null;
  var hoverSkyboxFields = [ 'cubeMap', 'prefilteredCubeMap128', 'prefilteredCubeMap64', 'prefilteredCubeMap32', 'prefilteredCubeMap16', 'prefilteredCubeMap8', 'prefilteredCubeMap4' ]

  var onPickHover = function(node, picked) {
      var meshInstance = null;

      if (node && node._icon)
          node = node._getEntity();

      if (! node) {
          onHover(null);
          return;
      }

      if (picked instanceof pc.MeshInstance)
          meshInstance = picked;

      if (node.model && meshInstance && (! meshInstance.node._parent || ! meshInstance.node._parent._icon)) {
          onHover(node, meshInstance);
      } else {
          onHover(null);
      }
  };

  var onLeave = function() {
      if (hoverSkybox) {
          app.scene.setSkybox(hoverSkybox);
          hoverSkybox = null;
          editor.call('viewport:render');
      }

      if (hoverMaterial) {
          for(var i = 0; i < hoverSkyboxFields.length; i++)
              hoverMaterial[hoverSkyboxFields[i]] = hoverMaterial._hoverCubeMap[hoverSkyboxFields[i]];
          hoverMaterial.update();
          delete hoverMaterial._hoverCubeMap;
          hoverMaterial = null;

          editor.call('viewport:render');
      }
  };

  var onCubemapLoad = function() {
      setCubemap();
  };

  var setCubemap = function() {
      if (hoverEntity) {
          hoverMaterial = hoverMeshInstance.material;

          if (hoverMaterial) {
              if (! hoverMaterial._hoverCubeMap) {
                  hoverMaterial._hoverCubeMap = { };
                  for(var i = 0; i < hoverSkyboxFields.length; i++)
                      hoverMaterial._hoverCubeMap[hoverSkyboxFields[i]] = hoverMaterial[hoverSkyboxFields[i]];
              }

              for(var i = 0; i < hoverSkyboxFields.length; i++)
                  hoverMaterial[hoverSkyboxFields[i]] = hoverCubemap.resources[i];

              hoverMaterial.update();

              editor.call('viewport:render');
          }
      } else {
          if (! hoverSkybox) {
              hoverSkybox = [ null, null, null, null, null, null ];
              var id = editor.call('sceneSettings').get('render.skybox');
              if (id) {
                  var engineCubemap = app.assets.get(id);
                  if (engineCubemap)
                      hoverSkybox = engineCubemap.resources;
              }
          }

          if (hoverCubemap)
              app.scene.setSkybox(hoverCubemap.resources);

          editor.call('viewport:render');
      }
  };

  var onHover = function(entity, meshInstance) {
      if (entity === hoverEntity && meshInstance === hoverMeshInstance)
          return;

      onLeave();

      hoverEntity = entity;
      hoverMeshInstance = meshInstance;

      setCubemap();
  };

  var dropRef = editor.call('drop:target', {
      ref: canvas.element,
      type: 'asset.cubemap',
      hole: true,
      drop: function(type, data) {
          if (!config.scene.id)
              return;

          if (evtPickHover) {
              evtPickHover.unbind();
              evtPickHover = null;
          }

          hoverCubemap.off('load', onCubemapLoad);

          onLeave();

          if (hoverEntity) {
              var materialId;
              if (hoverEntity.model.type === 'asset') {
                  var ind = hoverEntity.model.model.meshInstances.indexOf(hoverMeshInstance);

                  if (hoverEntity.model.mapping && hoverEntity.model.mapping[ind]) {
                      materialId = hoverEntity.model.mapping[ind];
                  } else if (hoverEntity.model.asset) {
                      var modelAsset = editor.call('assets:get', hoverEntity.model.asset);

                      if (modelAsset && ind !== -1)
                          materialId = modelAsset.get('data.mapping.' + ind + '.material');
                  }
              } else if (hoverEntity.model.materialAsset) {
                  materialId = hoverEntity.model.materialAsset.id;
              }

              if (materialId) {
                  var materialAsset = editor.call('assets:get', materialId);
                  if (materialAsset)
                      materialAsset.set('data.cubeMap', hoverCubemap.id);
              }
              editor.call('viewport:render');
          } else {
              editor.call('sceneSettings').set('render.skybox', hoverCubemap.id);
              app.scene.setSkybox(hoverCubemap.resources);
              editor.call('viewport:render');
          }
      },
      over: function(type, data) {
          if (!config.scene.id)
              return;

          hoverCubemap = app.assets.get(parseInt(data.id, 10));
          if (! hoverCubemap)
              return;

          hoverCubemap.loadFaces = true;
          app.assets.load(hoverCubemap);
          hoverCubemap.on('load', onCubemapLoad);

          hoverEntity = undefined;
          hoverMeshInstance = null;

          evtPickHover = editor.on('viewport:pick:hover', onPickHover);
          onHover(null, null);
      },
      leave: function() {
          if (!config.scene.id)
              return;

          if (evtPickHover) {
              evtPickHover.unbind();
              evtPickHover = null;
          }

          hoverCubemap.off('load', onCubemapLoad);

          onLeave();
      }
  });
});


/* editor/viewport/viewport-drop-sprite.js */
editor.once('load', function() {
  'use strict';

  var canvas = editor.call('viewport:canvas');
  if (! canvas) return;

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var aabb = new pc.BoundingBox();
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();


  var dropRef = editor.call('drop:target', {
      ref: canvas.element,
      filter: function(type, data) {
          if (type === 'asset.sprite') {
              var asset = app.assets.get(data.id);
              if (asset) app.assets.load(asset);

              return true;
          }

          if (type === 'assets') {
              for(var i = 0; i < data.ids.length; i++) {
                  var asset = editor.call('assets:get', data.ids[i]);
                  if (! asset)
                      return false;

                  if (asset.get('type') !== 'sprite')
                      return false;
              }

              for(var i = 0; i < data.ids.length; i++) {
                  var asset = app.assets.get(data.ids[i]);
                  if (asset) app.assets.load(asset);
              }

              return true;
          }
      },
      drop: function(type, data) {
          if (! config.scene.id)
              return;

          var assets = [ ];

          if (type === 'asset.sprite') {
              var asset = editor.call('assets:get', parseInt(data.id, 10));
              if (asset) assets.push(asset);
          } else if (type === 'assets') {
              for(var i = 0; i < data.ids.length; i++) {
                  var asset = editor.call('assets:get', parseInt(data.ids[i], 10));
                  if (asset && asset.get('type') === 'sprite')
                      assets.push(asset);
              }
          }

          if (! assets.length)
              return;

          // parent
          var parent = null;
          if (editor.call('selector:type') === 'entity')
              parent = editor.call('selector:items')[0];

          if (! parent)
              parent = editor.call('entities:root');

          var entities = [ ];
          var data = [ ];

          // calculate aabb
          var first = true;
          for(var i = 0; i < assets.length; i++) {
              var assetEngine = app.assets.get(assets[i].get('id'));
              if (! assetEngine) continue;

              if (assetEngine.resource) {
                  var mi = assetEngine.resource._meshInstance;
                  if (! mi) continue;

                  if (first) {
                      first = false;
                      aabb.copy(mi.aabb);
                  } else {
                      aabb.add(mi.aabb);
                  }
              }
          }

          if (first) {
              aabb.center.set(0, 0, 0);
              aabb.halfExtents.set(1, 1, 1);
          }

          // calculate point
          var camera = editor.call('camera:current');
          var distance = 0;

          if (ui.Tree._ctrl && ui.Tree._ctrl()) {
              vecA.copy(camera.forward).scale(aabb.halfExtents.length() * 2.2);
              vecB.copy(camera.getPosition()).add(vecA);
              vecC.copy(vecB).sub(aabb.center);

              var tmp = new pc.Entity();
              parent.entity.addChild(tmp);
              tmp.setPosition(vecC);
              vecC.copy(tmp.getLocalPosition());
              tmp.destroy();

              // focus distance
              distance = vecA.copy(camera.getPosition()).sub(vecB).length();
          } else {
              vecC.set(0, 0, 0);
              vecB.copy(parent.entity.getPosition()).add(aabb.center);
              distance = aabb.halfExtents.length() * 2.2;
          }

          for(var i = 0; i < assets.length; i++) {
              var component = editor.call('components:getDefault', 'sprite');

              var name = assets[i].get('name') || 'Untitled';

              if (assets[i].get('data.frameKeys').length > 1) {
                  component.type = 'animated';
                  component.clips = {
                      '0': {
                          name: name,
                          fps: 10,
                          loop: true,
                          autoPlay: true,
                          spriteAsset: parseInt(assets[i].get('id'), 10)
                      }
                  };
                  component.autoPlayClip = name;
              } else {
                  component.spriteAsset =  parseInt(assets[i].get('id'), 10);
              }

              // new entity
              var entity = editor.call('entities:new', {
                  parent: parent,
                  name: name,
                  position: [ vecC.x, vecC.y, vecC.z ],
                  components: {
                      sprite: component
                  },
                  noSelect: true,
                  noHistory: true
              });

              entities.push(entity);
              data.push(entity.json());
          }

          editor.call('selector:history', false);
          editor.call('selector:set', 'entity', entities);
          editor.once('selector:change', function() {
              editor.call('selector:history', true);
          });

          var selectorType = editor.call('selector:type');
          var selectorItems = editor.call('selector:items');
          if (selectorType === 'entity') {
              for(var i = 0; i < selectorItems.length; i++)
                  selectorItems[i] = selectorItems[i].get('resource_id');
          }

          var parentId = parent.get('resource_id');
          var resourceIds = [ ];
          for(var i = 0; i < entities.length; i++)
              resourceIds.push(entities[i].get('resource_id'));

          editor.call('history:add', {
              name: 'new sprite entities ' + entities.length,
              undo: function() {
                  for(var i = 0; i < resourceIds.length; i++) {
                      var entity = editor.call('entities:get', resourceIds[i]);
                      if (! entity)
                          continue;

                      editor.call('entities:removeEntity', entity);
                  }

                  if (selectorType === 'entity' && selectorItems.length) {
                      var items = [ ];
                      for(var i = 0; i < selectorItems.length; i++) {
                          var item = editor.call('entities:get', selectorItems[i]);
                          if (item)
                              items.push(item);
                      }

                      if (items.length) {
                          editor.call('selector:history', false);
                          editor.call('selector:set', selectorType, items);
                          editor.once('selector:change', function() {
                              editor.call('selector:history', true);
                          });
                      }
                  }
              },
              redo: function() {
                  var parent = editor.call('entities:get', parentId);
                  if (! parent)
                      return;

                  var entities = [ ];

                  for(var i = 0; i < data.length; i++) {
                      var entity = new Observer(data[i]);
                      entities.push(entity);
                      editor.call('entities:addEntity', entity, parent, false);
                  }

                  editor.call('selector:history', false);
                  editor.call('selector:set', 'entity', entities);
                  editor.once('selector:change', function() {
                      editor.call('selector:history', true);
                  });

                  editor.call('viewport:render');
                  editor.call('camera:focus', vecB, distance);
              }
          });

          editor.call('viewport:render');
          editor.call('camera:focus', vecB, distance);
      }
  });
});


/* editor/viewport/viewport-userdata.js */
editor.once('load', function() {
  'use strict';

  editor.on('userdata:load', function (userdata) {
      if (! editor.call('permissions:read'))
          return;

      var cameras = userdata.get('cameras');

      if (cameras) {
          for(var name in cameras) {
              if (! cameras.hasOwnProperty(name))
                  continue;

              var camera = editor.call('camera:get', name);
              if (! camera)
                  continue;

              var data = cameras[name];

              if (data.position)
                  camera.setPosition(data.position[0], data.position[1], data.position[2]);

              if (data.rotation)
                  camera.setEulerAngles(data.rotation[0], data.rotation[1], data.rotation[2]);

              if (data.orthoHeight && camera.camera.projection === pc.PROJECTION_ORTHOGRAPHIC)
                  camera.camera.orthoHeight = parseInt(data.orthoHeight, 10);

              if (data.focus)
                  camera.focus.set(data.focus[0], data.focus[1], data.focus[2]);
          }
      }

      editor.call('viewport:render');
  });
});


/* editor/viewport/viewport-user-cameras.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var container = new pc.Entity(app);
  app.root.addChild(container);

  var cameraModel = null;
  var cameras = { };
  var userdata = { };


  // material default
  var materialDefault = new pc.BasicMaterial();
  materialDefault.color = new pc.Color(1, 1, 1, 1);
  materialDefault.update();
  // material quad
  var materialQuad = new pc.BasicMaterial();
  materialQuad.color = new pc.Color(1, 1, 1, .25);
  materialQuad.cull = pc.CULLFACE_NONE;
  materialQuad.blend = true;
  materialQuad.blendSrc = pc.BLENDMODE_SRC_ALPHA;
  materialQuad.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
  materialQuad.update();
  // material behind
  var materialBehind = new pc.BasicMaterial();
  materialBehind.color = new pc.Color(1, 1, 1, .15);
  materialBehind.blend = true;
  materialBehind.blendSrc = pc.BLENDMODE_SRC_ALPHA;
  materialBehind.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
  materialBehind.depthTest = false;
  materialBehind.update();


  // Subscribes to user data of specified user
  var addUser = function (userId) {
      editor.once('userdata:' + userId + ':raw', function (data) {
          loadUserData(userId, data);
      });

      userdata[userId] = editor.call('realtime:subscribe:userdata', config.scene.uniqueId, userId);
  };

  // Removes user camera and unsubscribes from userdata
  var removeUser = function (userId) {
      if (userId === config.self.id) return;

      // unsubscribe from realtime userdata
      if (userdata[userId]) {
          userdata[userId].destroy();
          delete userdata[userId];
          editor.unbind('realtime:userdata:' + userId + ':op:cameras');
      }

      // remove user camera
      if (cameras[userId]) {
          cameras[userId].destroy();
          delete cameras[userId];
          editor.call('viewport:render');
      }
  };

  var close = .25;
  var far = .5;
  var horiz = .5;
  var vert = .375;

  var createCameraModel = function() {
      var vertexFormat = new pc.VertexFormat(app.graphicsDevice, [
          { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 }
      ]);
      // box
      var buffer = new pc.VertexBuffer(app.graphicsDevice, vertexFormat, 12 * 2);
      var iterator = new pc.VertexIterator(buffer);

      // top
      iterator.element[pc.SEMANTIC_POSITION].set(close * horiz, close * vert, 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(horiz, vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(horiz, vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-horiz, vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-horiz, vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-close * horiz, close * vert, 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-close * horiz, close * vert, 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(close * horiz, close * vert, 0);
      iterator.next();
      // bottom
      iterator.element[pc.SEMANTIC_POSITION].set(close * horiz, -close * vert, 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(horiz, -vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(horiz, -vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-horiz, -vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-horiz, -vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-close * horiz, -close * vert, 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-close * horiz, -close * vert, 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(close * horiz, -close * vert, 0);
      iterator.next();
      // sides
      iterator.element[pc.SEMANTIC_POSITION].set(close * horiz, -close * vert, 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(close * horiz, close * vert, 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(horiz, -vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(horiz, vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-horiz, -vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-horiz, vert, -far);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-close * horiz, -close * vert, 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-close * horiz, close * vert, 0);
      iterator.next();
      iterator.end();
      // node
      var node = new pc.GraphNode();
      // mesh
      var mesh = new pc.Mesh();
      mesh.vertexBuffer = buffer;
      mesh.indexBuffer[0] = null;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = buffer.getNumVertices();
      mesh.primitive[0].indexed = false;
      // meshInstance
      var meshInstance = new pc.MeshInstance(node, mesh, materialDefault);
      meshInstance.updateKey();
      // model
      cameraModel = new pc.Model();
      cameraModel.graph = node;
      cameraModel.meshInstances = [ meshInstance ];
  };

  // Creates user camera and binds to real time events
  var loadUserData = function (userId, data) {
      if (! cameraModel)
          createCameraModel();

      // add user camera
      var camera = cameras[userId] = new pc.Entity(app);
      camera.addComponent('model', {
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false
      });
      camera.model.model = cameraModel.clone();
      container.addChild(camera);

      var cameraInner = new pc.Entity(app);
      cameraInner.addComponent('model', {
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false
      });
      cameraInner.model.model = cameraModel.clone();
      cameraInner.model.model.meshInstances[0].material = materialBehind;
      camera.addChild(cameraInner);

      var cameraQuad = new pc.Entity(app);
      cameraQuad._userCamera = userId;
      cameraQuad.addComponent('model', {
          type: 'plane',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false
      });
      cameraQuad.model.material = materialQuad;
      cameraQuad.rotate(90, 0, 0);
      cameraQuad.setLocalScale(close * horiz * 2, 1, close * vert * 2);
      camera.addChild(cameraQuad);

      var pos = data.cameras.perspective.position || [ 0, 0, 0 ];
      camera.setPosition(pos[0], pos[1], pos[2]);

      var rot = data.cameras.perspective.rotation || [ 0, 0, 0 ];
      camera.setEulerAngles(rot[0], rot[1], rot[2]);

      camera.pos = camera.getPosition().clone();
      camera.rot = camera.getRotation().clone();

      editor.call('viewport:render');

      // server > client
      var evt = editor.on('realtime:userdata:' + userId + ':op:cameras', function(op) {
          if (op.p.length !== 3 || ! op.oi || op.p[1] !== 'perspective')
              return;

          if (op.p[2] === 'position') {
              camera.pos.set(op.oi[0], op.oi[1], op.oi[2]);
              editor.call('viewport:render');
          } else if (op.p[2] === 'rotation') {
              camera.rot.setFromEulerAngles(op.oi[0], op.oi[1], op.oi[2]);
              editor.call('viewport:render');
          }
      });

      var unload = function () {
          if (evt) {
              evt.unbind();
              evt = null;
          }

          removeUser(userId);
      };

      editor.once('scene:unload', unload);
      editor.once('realtime:disconnected', unload);

      editor.call('users:loadOne', userId, function(user) {
          var dataNormal = editor.call('whoisonline:color', user.id, 'data');
          var colorNormal = new Float32Array([ dataNormal[0], dataNormal[1], dataNormal[2], 1 ]);
          camera.model.meshInstances[0].setParameter('uColor', colorNormal);
          camera.model.meshInstances[0].mask = GIZMO_MASK;

          var colorBehind = new Float32Array([ dataNormal[0], dataNormal[1], dataNormal[2], 0.15 ]);
          cameraInner.model.meshInstances[0].setParameter('uColor', colorBehind);
          cameraInner.model.meshInstances[0].mask = GIZMO_MASK;

          var dataLight = editor.call('whoisonline:color', user.id, 'data');
          var colorLight = new Float32Array([ dataLight[0], dataLight[1], dataLight[2], 0.25 ]);
          cameraQuad.model.meshInstances[0].setParameter('uColor', colorLight);
          cameraQuad.model.meshInstances[0].mask = GIZMO_MASK;
      });
  };

  // Add user who comes online
  editor.on('whoisonline:add', function (userId) {
      // ignore the logged in user
      if (userId === config.self.id) return;

      var add = function () {
          // do not add users without read access
          if (editor.call('permissions:read', userId))
              addUser(userId);

          // subscribe to project permission changes
          editor.on('permissions:set:' + userId, function () {
              if (editor.call('permissions:read', userId)) {
                  if (! userdata[userId]) {
                      // WORKAROUND
                      // wait a bit before adding, for userdata to be created at sharedb
                      setTimeout(function () {
                          addUser(userId);
                      }, 500);
                  }
              } else {
                  removeUser(userId);
              }
          });
      };

      if (!config.scene.id) {
          editor.once('scene:raw', add);
      } else {
          add();
      }

  });

  // Remove user who goes offline
  editor.on('whoisonline:remove', function (userId) {
      if (userId === config.self.id) return;

      removeUser(userId);
      editor.unbind('permissions:set:' + userId);
  });

  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var quat = new pc.Quat();

  editor.on('viewport:update', function(dt) {
      var render = false;

      for(var id in cameras) {
          var camera = cameras[id];

          if (vecA.copy(camera.getPosition()).sub(camera.pos).length() > 0.01) {
              vecA.lerp(camera.getPosition(), camera.pos, 4 * dt);
              camera.setPosition(vecA);
              render = true;
          } else {
              camera.setPosition(camera.pos);
          }

          vecA.set(0, 0, -1);
          vecB.set(0, 0, -1);
          camera.getRotation().transformVector(vecA, vecA);
          camera.rot.transformVector(vecB, vecB);

          if (vecA.dot(vecB) < 0.999) {
              quat = camera.getRotation().slerp(camera.getRotation(), camera.rot, 8 * dt);
              camera.setRotation(quat);
              render = true;
          } else {
              camera.setRotation(camera.rot);
          }
      }

      if (render)
          editor.call('viewport:render');
  });
});


/* editor/viewport/viewport-context-menu.js */
editor.once('load', function() {
  'use strict';

  var currentEntity = null;
  var root = editor.call('layout.root');

  // create data for entity menu
  var menu;

  // wait until all entities are loaded
  // before creating the menu to make sure
  // that the menu data for entities have been created
  editor.once('entities:load', function () {
      var menuData = { };
      var entityMenuData = editor.call('menu:get', 'entity');
      if (entityMenuData) {
          for (var key in entityMenuData.items) {
              menuData[key] = entityMenuData.items[key];
          }
      }

      // TODO
      // menuData['enable'] = {
      //     title: 'Enable',
      //     icon: '&#58421;',
      //     hide: function () {
      //         return currentEntity.get('enabled');
      //     },
      //     select: function() {
      //         currentEntity.set('enabled', true);
      //     }
      // };

      // menuData['disable'] = {
      //     title: 'Disable',
      //     icon: '&#58422;',
      //     hide: function () {
      //         return !currentEntity.get('enabled');
      //     },
      //     select: function() {
      //         currentEntity.set('enabled', false);
      //     }
      // };

      // menuData['copy'] = {
      //     title: 'Copy',
      //     icon: '&#57891;',
      //     select: function() {
      //         editor.call('entities:copy', currentEntity);
      //     }
      // };

      // menuData['paste'] = {
      //     title: 'Paste',
      //     icon: '&#57892;',
      //     filter: function () {
      //         return !editor.call('entities:clipboard:empty');
      //     },
      //     select: function() {
      //         editor.call('entities:paste', currentEntity);
      //     }
      // };

      // menuData['duplicate'] = {
      //     title: 'Duplicate',
      //     icon: '&#57908;',
      //     filter: function () {
      //         return currentEntity !== editor.call('entities:root');
      //     },
      //     select: function() {
      //         editor.call('entities:duplicate', currentEntity);
      //     }
      // };

      // menuData['delete'] = {
      //     title: 'Delete',
      //     icon: '&#58657;',
      //     filter: function () {
      //         return currentEntity !== editor.call('entities:root');
      //     },
      //     select: function() {
      //         editor.call('entities:delete', currentEntity);
      //     }
      // };


      // menu
      menu = ui.Menu.fromData(menuData);
      root.append(menu);
  });

  editor.method('viewport:contextmenu', function (x, y, entity) {
      if (! editor.call('permissions:write'))
          return;

      currentEntity = entity;
      menu.open = true;
      menu.position(x + 1, y);
  });
});


/* editor/viewport/viewport-tap.js */
editor.once('load', function() {
  'use strict';

  var canvas = editor.call('viewport:canvas');
  if (! canvas) return;

  function Tap(evt, rect, mouse) {
      this.x = this.lx = this.sx = evt.clientX - rect.left;
      this.y = this.ly = this.sy = evt.clientY - rect.top;
      this.nx = 0;
      this.ny = 0;
      this.move = false;
      this.down = true;
      this.button = evt.button;
      this.mouse = !! mouse;
  };
  Tap.prototype.update = function(evt, rect) {
      var x = evt.clientX - rect.left;
      var y = evt.clientY - rect.top;

      // if it's moved
      if (this.down && ! this.move && (Math.abs(this.sx - x) + Math.abs(this.sy - y)) > 8)
          this.move = true;

      // moving
      if (this.move) {
          this.nx = x - this.lx;
          this.ny = y - this.ly;
          this.lx = this.x;
          this.ly = this.y;
      }

      // coords
      this.x = x;
      this.y = y;
  };

  var taps = [ ];
  // var tapMouse = new Tap({ clientX: 0, clientY: 0 }, { left: 0, top: 0 });
  var inViewport = false;

  editor.method('viewport:inViewport', function() {
      return inViewport;
  });

  var evtMouseMove = function(evt) {
      var rect = canvas.element.getBoundingClientRect();
      for(var i = 0; i < taps.length; i++) {
          if (! taps[i].mouse)
              continue;

          taps[i].update(evt, rect);
          editor.emit('viewport:tap:move', taps[i], evt);
      }

      editor.emit('viewport:mouse:move', {
          x: evt.clientX - rect.left,
          y: evt.clientY - rect.top,
          down: taps.length !== 0
      });

      // render if mouse moved within viewport
      if (evt.clientX >= rect.left && evt.clientX <= rect.right && evt.clientY >= rect.top && evt.clientY <= rect.bottom) {
          if (! inViewport) {
              inViewport = true;
              editor.emit('viewport:hover', true);
          }
          editor.call('viewport:render');
      } else if (inViewport) {
          inViewport = false;
          editor.emit('viewport:hover', false);
          editor.call('viewport:render');
      }
  };

  var evtMouseUp = function(evt) {
      var items = taps.slice(0);

      for(var i = 0; i < items.length; i++) {
      // if (tapMouse.down) {
          if (! items[i].mouse || ! items[i].down || items[i].button !== evt.button)
              continue;

          items[i].down = false;
          items[i].update(evt, canvas.element.getBoundingClientRect());
          editor.emit('viewport:tap:end', items[i], evt);

          if (! items[i].move)
              editor.emit('viewport:tap:click', items[i], evt);

          var ind = taps.indexOf(items[i]);
          if (ind !== -1)
              taps.splice(ind, 1);
      }

      var rect = canvas.element.getBoundingClientRect();

      editor.emit('viewport:mouse:move', {
          x: evt.clientX - rect.left,
          y: evt.clientY - rect.top,
          down: taps.length !== 0
      });
  };

  canvas.element.addEventListener('mousedown', function(evt) {
      var rect = canvas.element.getBoundingClientRect();

      editor.emit('viewport:mouse:move', {
          x: evt.clientX - rect.left,
          y: evt.clientY - rect.top,
          down: true
      });

      var tap = new Tap(evt, rect, true)
      taps.push(tap);

      editor.emit('viewport:tap:start', tap, evt);

      if (document.activeElement && document.activeElement.tagName.toLowerCase() === 'input')
          document.activeElement.blur();

      evt.preventDefault();
  }, false);

  canvas.element.addEventListener('mouseover', function() {
      editor.emit('viewport:hover', true);
      editor.call('viewport:render');
  }, false);

  canvas.element.addEventListener('mouseleave', function(evt) {
      // ignore tooltip
      var target = evt.toElement || evt.relatedTarget;
      if (target && target.classList.contains('cursor-tooltip'))
          return;

      editor.emit('viewport:hover', false);
      editor.call('viewport:render');
  }, false);

  window.addEventListener('mousemove', evtMouseMove, false);
  window.addEventListener('dragover', evtMouseMove, false);
  window.addEventListener('mouseup', evtMouseUp, false);
});


/* editor/viewport/viewport-pick.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var picker = new pc.Picker(app.graphicsDevice, 1, 1);
  var pickedData = {
      node: null,
      picked: null
  };
  var mouseCoords = new pc.Vec2();
  var mouseTap = false;
  var inViewport = false;
  var picking = true;
  var filter = null;
  var mouseDown = false;

  editor.method('viewport:pick:filter', function(fn) {
      if (filter === fn)
          return;

      filter = fn;
  });

  editor.method('viewport:pick:state', function(state) {
      picking = state;
  });

  editor.on('viewport:update', function() {
      if (! mouseDown && ! inViewport && pickedData.node) {
          pickedData.node = null;
          pickedData.picked = null;
          editor.emit('viewport:pick:hover', null, null);
      }

      if (! inViewport || ! picking)
          return;

      // pick
      editor.call('viewport:pick', mouseCoords.x, mouseCoords.y, function(node, picked) {
          if (pickedData.node !== node || pickedData.picked !== picked) {
              pickedData.node = node;
              pickedData.picked = picked;

              editor.emit('viewport:pick:hover', pickedData.node, pickedData.picked);
          }
      });
  });

  editor.on('viewport:hover', function(hover) {
      inViewport = hover;
  });

  editor.on('viewport:resize', function(width, height) {
      picker.resize(width, height);
  });

  editor.method('viewport:pick', function(x, y, fn) {
      var scene = app.scene;

      // if (filter) {
      //     scene = {
      //         drawCalls: app.scene.drawCalls.filter(filter)
      //     };
      // }

      // prepare picker
      picker.prepare(editor.call('camera:current').camera, scene);

      // pick node
      var picked = picker.getSelection(x, y);

      if (! picked.length || ! picked[0]) {
         fn(null, null);
      } else {
          var node = picked[0].node;

          // traverse to pc.Entity
          while (! (node instanceof pc.Entity) && node && node.parent) {
              node = node.parent;
          }
          if (! node) return;

          fn(node, picked[0]);
      }
  });

  editor.on('viewport:tap:start', function(tap) {
      if (! tap.mouse) return;

      mouseDown = true;
  });

  editor.on('viewport:tap:end', function(tap) {
      if (! tap.mouse) return;

      mouseDown = false;

      if (! inViewport && pickedData.node) {
          pickedData.node = null;
          pickedData.picked = null;
          editor.emit('viewport:pick:hover', null, null);
      }
  });

  editor.on('viewport:mouse:move', function(tap) {
      mouseCoords.x = tap.x;
      mouseCoords.y = tap.y;
  });

  editor.on('viewport:tap:click', function(tap) {
      if (! inViewport || (tap.mouse && tap.button !== 0))
          return;

      if (pickedData.node) {
          editor.emit('viewport:pick:node', pickedData.node, pickedData.picked);
      } else {
          editor.call('viewport:pick', tap.x, tap.y, function(node, picked) {
              if (pickedData.node !== node || pickedData.picked !== picked) {
                  pickedData.node = node;
                  pickedData.picked = picked;
              }

              if (pickedData.node) {
                  editor.emit('viewport:pick:node', pickedData.node, pickedData.picked);
              } else {
                  editor.emit('viewport:pick:clear');
              }
          });
      }
  });

  editor.on('scene:unload', function () {
      // this is needed to clear the picker layer composition
      // from any mesh instances that are no longer there...
      if (picker) {
          picker.layer._dirty = true;
      }
  });
});


/* editor/viewport/viewport-cursor.js */
editor.once('load', function() {
  'use strict';

  var state = false;
  var inViewport = false;

  // mouse hovering state on viewport
  editor.on('viewport:hover', function(hover) {
      if (inViewport === hover)
          return;

      inViewport = hover;

      if (! inViewport) {
          state = false;

          if (! editor.call('drop:active'))
              editor.call('cursor:set', '');
      }
  });

  var checkPicked = function(node, picked) {
      var hover = false;

      // if mouse in viewport && entity model has an asset
      // then set cursor to 'crosshair' to indicate
      // that next click will select node in model asset
      if (inViewport && node && node.model && node.model.asset && node.model.model) {
          if (editor.call('selector:type') === 'entity' &&
              editor.call('selector:count') === 1 &&
              editor.call('selector:items')[0].entity === node) {

              hover = true;
          }
      }

      // change cursor if needed
      if (state !== hover) {
          state = hover;
          editor.call('cursor:set', state ? 'crosshair' : '');
      }
  }

  editor.on('viewport:pick:node', checkPicked)
  editor.on('viewport:pick:hover', checkPicked);
});


/* editor/viewport/viewport-tooltips.js */
editor.once('load', function() {
  'use strict';

  var inViewport = false;
  var nameLast = '';
  var timeout = null;
  var pickedLast = null;
  var nodeLast = null;
  var delay = 500;

  editor.on('viewport:hover', function(state) {
      inViewport = state;

      if (! inViewport) {
          nameLast = '';
          pickedLast = null;
          nodeLast = null;
          editor.call('cursor:text', '');
          clearTimeout(timeout);
      }
  });

  var showTooltip = function() {
      editor.call('cursor:text', nameLast);
  };

  var checkPicked = function(node, picked) {
      var name = '';

      if (inViewport && node) {
          if (node._icon) {
              // icon
              var entity = node._getEntity && node._getEntity();
              if (entity)
                  name = entity.name;
          } else if (node._userCamera) {
              name = '@';
              editor.call('users:loadOne', node._userCamera, function(data) {
                  name = '@' + (data && data.username || 'anonymous');
              });
          } else if (node.model && node.model.asset && node.model.model && picked && picked.node) {
              // entity model meshInstance
              name = node.name + ' &#8594; ' + picked.node.name;
          } else {
              // normal entity
              if (editor.call('entities:get', node.getGuid()))
                  name = node.name;
          }
      }

      if (nodeLast !== node || pickedLast !== picked || nameLast !== name) {
          editor.call('cursor:text', '');
          clearTimeout(timeout);
          if (nameLast || name)
              timeout = setTimeout(showTooltip, delay);
      }

      if (nameLast !== name)
          nameLast = name;

      if (pickedLast !== picked)
          pickedLast = picked;

      if (nodeLast !== node)
          nodeLast = node;
  };

  editor.on('viewport:pick:node', checkPicked)
  editor.on('viewport:pick:hover', checkPicked);
});


/* editor/viewport/viewport-focus.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var defaultSize = new pc.Vec3(1, 1, 1);
  var defaultSizeSmall = new pc.Vec3(.2, .2, .2);
  var aabb = new pc.BoundingBox();
  var aabbA = new pc.BoundingBox();

  var calculateChildAABB = function(entity) {
      aabbA.add(editor.call('entities:getBoundingBoxForEntity', entity));

      var children = entity.children;
      for(var i = 0; i < children.length; i++) {
          if (! (children[i] instanceof pc.Entity) || children[i].__editor)
              continue;

          calculateChildAABB(children[i]);
      }
  };

  editor.method('selection:aabb', function() {
      if (editor.call('selector:type') !== 'entity')
          return null;

      return editor.call('entities:aabb', editor.call('selector:items'));
  });

  editor.method('entities:aabb', function(items) {
      if (! items)
          return null;

      if (! (items instanceof Array))
          items = [ items ];

      aabb.center.set(0, 0, 0);
      aabb.halfExtents.copy(defaultSizeSmall);

      // calculate aabb for selected entities
      for(var i = 0; i < items.length; i++) {
          var entity = items[i].entity;

          if (! entity)
              continue;

          aabbA.center.copy(entity.getPosition());
          aabbA.halfExtents.copy(defaultSizeSmall);
          calculateChildAABB(entity);

          if (i === 0) {
              aabb.copy(aabbA);
          } else {
              aabb.add(aabbA);
          }
      }

      return aabb;
  });

  editor.method('viewport:focus', function() {
      var selection = editor.call('selection:aabb');
      if (! selection) return;

      var camera = editor.call('camera:current');

      // aabb
      var distance = Math.max(aabb.halfExtents.x, Math.max(aabb.halfExtents.y, aabb.halfExtents.z));
      // fov
      distance = (distance / Math.tan(0.5 * camera.camera.fov * Math.PI / 180.0));
      // extra space
      distance = distance * 1.1 + 1;

      editor.call('camera:focus', aabb.center, distance);
  });
});


/* editor/viewport/viewport-outline.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var renderer = app.renderer;
  var device = renderer.device;
  var scene = app.scene;

  var users = [ ];
  var selection = { };
  var colors = { };
  var colorUniform = new Float32Array(3);
  var render = 0;
  var cleared = false;
  var visible = true;
  var viewportLayer = null

  var targets = [ ];
  var textures = [ ];

  var SHADER_OUTLINE = 24;

  editor.on('selector:change', function(type, items) {
      if (selection[config.self.id])
          render -= selection[config.self.id].length;

      if (! selection[config.self.id])
          users.unshift(config.self.id);

      selection[config.self.id] = [ ];

      if (type === 'entity') {
          for(var i = 0; i < items.length; i++) {
              var modelType = items[i].get('components.model.type');
              if (items[i].entity && (modelType === 'asset' && items[i].get('components.model.asset')) || modelType !== 'asset') {
                  selection[config.self.id].push(items[i].entity);
                  render++;
                  if (!viewportLayer.enabled) {
                      viewportLayer.enabled = true;
                  }
              }
          }
      }

      if (render)
          editor.call('viewport:render');
  });

  editor.on('selector:sync', function(user, data) {
      if (selection[user])
          render -= selection[user].length;

      if (! selection[user])
          users.push(user);

      selection[user] = [ ];

      if (data.type === 'entity') {
          for(var i = 0; i < data.ids.length; i++) {
              var entity = editor.call('entities:get', data.ids[i]);
              if (! entity) continue;

              var modelType = entity.get('components.model.type');
              if (entity.entity && (modelType === 'asset' && entity.get('components.model.asset')) || modelType !== 'asset') {
                  selection[user].push(entity.entity);
                  render++;
                  if (!viewportLayer.enabled) {
                      viewportLayer.enabled = true;
                  }
              }
          }
      }

      if (render)
          editor.call('viewport:render');
  });

  editor.on('whoisonline:remove', function(id) {
      if (! selection[id])
          return;

      render -= selection[id].length;

      delete selection[id];
      delete colors[id];
      var ind = users.indexOf(id);
      users.splice(ind, 1);
  });

  editor.method('viewport:outline:visible', function(state) {
      if (state !== visible) {
          visible = state;
          render++;
          editor.call('viewport:render');
      }
  });

  // ### OVERLAY QUAD MATERIAL ###
  var chunks = pc.shaderChunks;
  var shaderFinal = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.outputTex2DPS, "outputTex2D");

  // ### OUTLINE EXTEND SHADER H ###
  var shaderBlurHPS = ' \
      precision ' + device.precision + ' float;\n \
      varying vec2 vUv0;\n \
      uniform float uOffset;\n \
      uniform sampler2D source;\n \
      void main(void)\n \
      {\n \
          float diff = 0.0;\n \
          vec4 pixel;\n \
          vec4 texel = texture2D(source, vUv0);\n \
          vec4 firstTexel = texel;\n \
          \n \
          pixel = texture2D(source, vUv0 + vec2(uOffset * -2.0, 0.0));\n \
          texel = max(texel, pixel);\n \
          diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n \
          \n \
          pixel = texture2D(source, vUv0 + vec2(uOffset * -1.0, 0.0));\n \
          texel = max(texel, pixel);\n \
          diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n \
          \n \
          pixel = texture2D(source, vUv0 + vec2(uOffset * +1.0, 0.0));\n \
          texel = max(texel, pixel);\n \
          diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n \
          \n \
          pixel = texture2D(source, vUv0 + vec2(uOffset * +2.0, 0.0));\n \
          texel = max(texel, pixel);\n \
          diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n \
          \n \
          gl_FragColor = vec4(texel.rgb, min(diff, 1.0));\n \
      }\n';
  var shaderBlurH = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, shaderBlurHPS, "editorOutlineH");

  // ### OUTLINE EXTEND SHADER V ###
  var shaderBlurVPS = ' \
      precision ' + device.precision + ' float;\n \
      varying vec2 vUv0;\n \
      uniform float uOffset;\n \
      uniform sampler2D source;\n \
      void main(void)\n \
      {\n \
          vec4 pixel;\n \
          vec4 texel = texture2D(source, vUv0);\n \
          vec4 firstTexel = texel;\n \
          float diff = texel.a;\n \
          \n \
          pixel = texture2D(source, vUv0 + vec2(0.0, uOffset * -2.0));\n \
          texel = max(texel, pixel);\n \
          diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n \
          \n \
          pixel = texture2D(source, vUv0 + vec2(0.0, uOffset * -1.0));\n \
          texel = max(texel, pixel);\n \
          diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n \
          \n \
          pixel = texture2D(source, vUv0 + vec2(0.0, uOffset * +1.0));\n \
          texel = max(texel, pixel);\n \
          diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n \
          \n \
          pixel = texture2D(source, vUv0 + vec2(0.0, uOffset * +2.0));\n \
          texel = max(texel, pixel);\n \
          diff = max(diff, length(firstTexel.rgb - pixel.rgb));\n \
          \n \
          gl_FragColor = vec4(texel.rgb, min(diff, 1.0));\n \
      }\n';
  var shaderBlurV = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, shaderBlurVPS, "editorOutlineV");


  // ### SETUP THE LAYER ###
  viewportLayer = editor.call('gizmo:layers', 'Viewport Outline');
  viewportLayer.onPostRender = function () {
      var uColorBuffer = device.scope.resolve('source');
      uColorBuffer.setValue(textures[0]);
      device.setBlending(true);
      device.setBlendFunction(pc.BLENDMODE_SRC_ALPHA, pc.BLENDMODE_ONE_MINUS_SRC_ALPHA);
      pc.drawQuadWithShader(device, null, shaderFinal, null, null, true);
  };

  var outlineLayer = new pc.Layer({
      name: "Outline",
      opaqueSortMode: pc.SORTMODE_NONE,
      passThrough: true,
      overrideClear: true,
      clearColorBuffer: true,
      clearDepthBuffer: true,
      clearColor: new pc.Color(0,0,0,0),
      shaderPass: SHADER_OUTLINE,

      onPostRender: function() {
          // extend pass X
          var uOffset = device.scope.resolve('uOffset');
          var uColorBuffer = device.scope.resolve('source');
          uOffset.setValue(1.0 / device.width / 2.0);
          uColorBuffer.setValue(textures[0]);
          pc.drawQuadWithShader(device, targets[1], shaderBlurH);

          // extend pass Y
          uOffset.setValue(1.0 / device.height / 2.0);
          uColorBuffer.setValue(textures[1]);
          pc.drawQuadWithShader(device, targets[0], shaderBlurV);
      }
  });
  var outlineComp = new pc.LayerComposition();
  outlineComp.pushOpaque(outlineLayer);

  var onUpdateShaderOutline = function(options) {
      if (options.pass !== SHADER_OUTLINE) return options;
      var outlineOptions = {
          opacityMap:                 options.opacityMap,
          opacityMapUv:               options.opacityMapUv,
          opacityMapChannel:          options.opacityMapChannel,
          opacityMapTransform:        options.opacityMapTransform,
          opacityVertexColor:         options.opacityVertexColor,
          opacityVertexColorChannel:  options.opacityVertexColorChannel,
          vertexColors:               options.vertexColors,
          alphaTest:                  options.alphaTest,
          skin:                       options.skin
      }
      return outlineOptions;
  };

  // ### RENDER EVENT ###
  editor.on('viewport:postUpdate', function() {
      if (! render && cleared) return;

      if (!render && !cleared) {
          viewportLayer.enabled = false;
      }

      // ### INIT/RESIZE RENDERTARGETS ###
      if (targets[0] && (targets[0].width !== device.width || targets[1].height !== device.height)) {
          for(var i = 0; i < 2; i++) {
              targets[i].destroy();
              textures[i].destroy();
          }
          targets = [ ];
          textures = [ ];
      }
      if (! targets[0]) {
          for(var i = 0; i < 2; i++) {
              textures[i] = new pc.Texture(device, {
                  format: pc.PIXELFORMAT_R8_G8_B8_A8,
                  width: device.width,
                  height: device.height
              });
              textures[i].minFilter = pc.FILTER_NEAREST;
              textures[i].magFilter = pc.FILTER_NEAREST;
              textures[i].addressU = pc.ADDRESS_CLAMP_TO_EDGE;
              textures[i].addressV = pc.ADDRESS_CLAMP_TO_EDGE;

              targets[i] = new pc.RenderTarget(device, textures[i]);
          }
      }


      var camera = editor.call('camera:current').camera;


      if (render) {
          // ### RENDER COLORED MESHINSTANCES TO RT0 ###

          outlineLayer.renderTarget = targets[0];
          outlineLayer.clearMeshInstances();
          if (outlineLayer.cameras[0] !== camera) {
              outlineLayer.clearCameras();
              outlineLayer.addCamera(camera);
          }
          var meshInstances = outlineLayer.opaqueMeshInstances;

          if (visible) {
              for(var u = 0; u < users.length; u++) {
                  var id = parseInt(users[u], 10);

                  if (! selection.hasOwnProperty(id) || ! selection[id].length)
                      continue;

                  var color = colors[id];
                  if (!color) {
                      var data = editor.call('whoisonline:color', id, 'data');

                      if (config.self.id === id)
                          data = [ 1, 1, 1 ];

                      colors[id] = new pc.Color(data[0], data[1], data[2]);
                      color = colors[id];
                  }

                  for(var i = 0; i < selection[id].length; i++) {
                      if (! selection[id][i])
                          continue;

                      var model = selection[id][i].model;
                      if (! model || ! model.model)
                          continue;

                      var meshes = model.meshInstances;
                      for(var m = 0; m < meshes.length; m++) {
                          //var opChan = 'r';
                          var instance = meshes[m];

                          //if (! instance.command && instance.drawToDepth && instance.material && instance.layer === pc.LAYER_WORLD) {
                          if (!instance.command && instance.material) {

                              instance.onUpdateShader = onUpdateShaderOutline;
                              colorUniform[0] = color.r;
                              colorUniform[1] = color.g;
                              colorUniform[2] = color.b;
                              instance.setParameter("material_emissive", colorUniform, 1<<SHADER_OUTLINE);
                              meshInstances.push(instance);
                          }
                      }
                  }
              }
          }

          app.renderer.renderComposition(outlineComp);

          cleared = false;
      } else {
          cleared = true;
      }
  });
});


/* editor/viewport/viewport-i18n.js */
editor.once('load', function () {
  'use strict';

  if (!editor.call('users:hasFlag', 'hasLocalization')) return;

  var projectSettings = editor.call('settings:project');
  var projectUserSettings = editor.call('settings:projectUser');

  var app = editor.call('viewport:app');

  var assetIndex = {};

  var refreshI18nAssets = function () {
      assetIndex = {};
      var assets = projectSettings.get('i18nAssets') || [];
      assets.forEach(function (id) {
          assetIndex[id] = true;

          var engineAsset = app.assets.get(id);
          if (engineAsset && !engineAsset.resource) {
              app.assets.load(engineAsset);
          }
      });
      app.i18n.assets = assets;
      editor.call('viewport:render');
  };

  projectSettings.on('i18nAssets:set', refreshI18nAssets);
  projectSettings.on('i18nAssets:insert', refreshI18nAssets);
  projectSettings.on('i18nAssets:remove', refreshI18nAssets);

  projectUserSettings.on('editor.locale:set', function (value) {
      if (value) {
          app.i18n.locale = value;
          editor.call('viewport:render');
      }
  });

  // initialize localization
  var renderFrame = false;
  if (config.project.settings.i18nAssets) {
      refreshI18nAssets();
      renderFrame = true;
  }
  if (config.self.locale) {
      app.i18n.locale = config.self.locale;
      renderFrame = true;
  }

  if (renderFrame) {
      editor.call('viewport:render');
  }

  // make sure all localization assets are loaded
  // regardless of their preload flag
  editor.on('assets:add', function (asset) {
      var id = asset.get('id');
      if (assetIndex[id]) {
          var engineAsset = app.assets.get(id);
          if (engineAsset) {
              app.assets.load(engineAsset);
          }
      }
  });

});


/* editor/assets/assets-preview.js */
editor.once('load', function () {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var renderTargets = { };

  var layerComposition = new pc.LayerComposition();

  var layer = new pc.Layer({
      id: -1,
      enabled: true,
      opaqueSortMode: 2,
      transparentSortMode: 3
  });

  layerComposition.push(layer);

  app.on('set:skybox', function () {
      editor.emit('preview:scene:changed');
  });

  var onSceneSettingsChange = function () {
      editor.emit('preview:scene:changed');
  };

  editor.on('sceneSettings:load', function(settings) {
      onSceneSettingsChange();
      settings.on('*:set', function () {
          onSceneSettingsChange();
          requestAnimationFrame(onSceneSettingsChange);
      });
  });

  editor.method('preview:layerComposition', function () {
      return layerComposition;
  });

  editor.method('preview:layer', function () {
      return layer;
  });

  editor.method('preview:getTexture', function(width, height) {
      var target = renderTargets[width + '-' + height];
      if (target) return target;

      var texture = new pc.Texture(app.graphicsDevice, {
          width: width,
          height: height,
          format: pc.PIXELFORMAT_R8_G8_B8_A8
      });

      target = new pc.RenderTarget(app.graphicsDevice, texture);
      renderTargets[width + '-' + height] = target;

      target.buffer = new ArrayBuffer(width * height * 4);
      target.pixels = new Uint8Array(target.buffer);
      target.pixelsClamped = new Uint8ClampedArray(target.buffer);

      return target;
  });

  editor.method('preview:render', function(asset, width, height, canvas, args) {
      width = width || 1;
      height = height || 1;

      // render
      editor.call('preview:' + asset.get('type') + ':render', asset, width, height, canvas, args);
  });
});


/* editor/assets/assets-preview-material.js */
editor.once('load', function () {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var pitch = 0;
  var yaw = 0;

  var layerComposition = editor.call('preview:layerComposition');
  var layer = editor.call('preview:layer');

  // material parser
  var materialParser = new pc.JsonStandardMaterialParser();

  // material
  var material = new pc.StandardMaterial();

  var PREFILTERED_CUBEMAP_PROPERTIES = [
      'prefilteredCubeMap128',
      'prefilteredCubeMap64',
      'prefilteredCubeMap32',
      'prefilteredCubeMap16',
      'prefilteredCubeMap8',
      'prefilteredCubeMap4'
  ];

  // sphere
  var sphere = new pc.Entity();
  sphere.addComponent('model', {
      type: 'sphere',
      layers: []
  });
  sphere.model.material = material;

  // box
  var box = new pc.Entity();
  box.addComponent('model', {
      type: 'box',
      layers: []
  });
  box.setLocalScale(0.6, 0.6, 0.6);
  box.model.material = material;

  // light
  var lightEntity = new pc.Entity();
  lightEntity.addComponent('light', {
      type: 'directional',
      layers: []
  });
  lightEntity.setLocalEulerAngles(45, 45, 0);

  // camera
  var cameraOrigin = new pc.GraphNode();

  var cameraEntity = new pc.Entity();
  cameraEntity.addComponent('camera', {
      nearClip: 0.1,
      farClip: 32,
      clearColor: new pc.Color(41 / 255, 53 / 255, 56 / 255, 0.0),
      frustumCulling: false,
      layers: []
  });
  cameraEntity.setLocalPosition(0, 0, 1.35);
  cameraOrigin.addChild(cameraEntity);

  // All preview objects live under this root
  var previewRoot = new pc.Entity();
  previewRoot._enabledInHierarchy = true;
  previewRoot.enabled = true;
  previewRoot.addChild(box);
  previewRoot.addChild(sphere);
  previewRoot.addChild(lightEntity);
  previewRoot.addChild(cameraOrigin);
  previewRoot.syncHierarchy();
  previewRoot.enabled = false;

  editor.method('preview:material:render', function (asset, canvasWidth, canvasHeight, canvas, args) {
      var data = asset.get('data');
      if (! data) return;

      args = args || { };

      var width = canvasWidth;
      var height = canvasHeight;

      if (width > height)
          width = height;
      else
          height = width;

      var target = editor.call('preview:getTexture', width, height);

      previewRoot.enabled = true;

      cameraEntity.camera.aspectRatio = height / width;

      layer.renderTarget = target;

      if (args.model === 'box') {
          sphere.enabled = false;
          box.enabled = true;
      } else {
          sphere.enabled = true;
          box.enabled = false;
      }

      pitch = args.hasOwnProperty('rotation') ? args.rotation[0] : 0;
      yaw = args.hasOwnProperty('rotation') ? args.rotation[1] : 0;

      cameraOrigin.setLocalEulerAngles(pitch, yaw, 0);

      lightEntity.light.intensity = 1.0 / (Math.min(1.0, app.scene.exposure) || 0.01);

      // migrate material data
      var migrated = materialParser.migrate(data);

      // convert asset references to engine resources
      var i, len, name, engineAsset;

      // handle texture assets
      for (i = 0, len = pc.StandardMaterial.TEXTURE_PARAMETERS.length; i < len; i++) {
          name = pc.StandardMaterial.TEXTURE_PARAMETERS[i];
          if (! migrated.hasOwnProperty(name) || ! migrated[name]) continue;

          engineAsset = app.assets.get(migrated[name]);
          if (! engineAsset || ! engineAsset.resource) {
              migrated[name] = null;
              if (engineAsset) {
                  app.assets.load(engineAsset);
              }
          } else {
              migrated[name] = engineAsset.resource;
          }
      }

      // handle cubemap assets
      for (i = 0, len = pc.StandardMaterial.CUBEMAP_PARAMETERS.length; i < len; i++) {
          name = pc.StandardMaterial.CUBEMAP_PARAMETERS[i];
          if (! migrated.hasOwnProperty(name) || ! migrated[name]) continue;

          engineAsset = app.assets.get(migrated[name]);
          if (! engineAsset) {
              migrated[name] = null;
          } else {
              if (engineAsset.resource) {
                  migrated[name] = engineAsset.resource;
                  if (engineAsset.file && engineAsset.resources && engineAsset.resources.length === 7) {
                      for (var j = 0; j < 6; j++) {
                          migrated[PREFILTERED_CUBEMAP_PROPERTIES[j]] = engineAsset.resources[i + 1];
                      }
                  }
              }

              if (migrated.shadingModel === pc.SPECULAR_PHONG) {
                  // phong based - so ensure we load individual faces
                  engineAsset.loadFaces = true;
                  app.assets.load(engineAsset);
              }
          }
      }

      // re-initialize material with migrated properties
      material.reset();
      materialParser.initialize(material, migrated);

      // set up layer
      layer.addCamera(cameraEntity.camera);
      layer.addLight(lightEntity.light);
      layer.addMeshInstances(sphere.enabled ? sphere.model.meshInstances : box.model.meshInstances);

      // render
      app.renderer.renderComposition(layerComposition);

      // read pixels from texture
      var device = app.graphicsDevice;
      device.gl.bindFramebuffer(device.gl.FRAMEBUFFER, target._glFrameBuffer);
      device.gl.readPixels(0, 0, width, height, device.gl.RGBA, device.gl.UNSIGNED_BYTE, target.pixels);

      // render to canvas
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.getContext('2d').putImageData(new ImageData(target.pixelsClamped, width, height), (canvasWidth - width) / 2, (canvasHeight - height) / 2);

      // clean up
      layer.renderTarget = null;
      layer.removeCamera(cameraEntity.camera);
      layer.removeLight(lightEntity.light);
      layer.removeMeshInstances(sphere.enabled ? sphere.model.meshInstances : box.model.meshInstances);
      previewRoot.enabled = false;

  });

});


/* editor/assets/assets-preview-material-watch.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var watching = { };
  var slots = [ 'aoMap', 'diffuseMap', 'emissiveMap', 'glossMap', 'lightMap', 'metalnessMap', 'opacityMap', 'specularMap', 'normalMap', 'cubeMap', 'sphereMap' ];

  var addTextureWatch = function(watch, slot, id) {
      watch.textures[slot] = {
          id: id,
          fn: function() {
              trigger(watch, slot);
          }
      };
      app.assets.on('load:' + id, watch.textures[slot].fn);

      var asset = app.assets.get(id);
      if (asset) asset.on('change', watch.textures[slot].fn);

      if (watch.autoLoad) {
          var asset = app.assets.get(id);
          if (asset && ! asset.resource)
              app.assets.load(asset);
      }
  };

  var removeTextureWatch = function(watch, slot) {
      if (! watch.textures[slot])
          return;

      app.assets.off('load:' + watch.textures[slot].id, watch.textures[slot].fn);

      var asset = app.assets.get(watch.textures[slot].id);
      if (asset) asset.off('change', watch.textures[slot].fn);

      delete watch.textures[slot];
  };

  var addSlotWatch = function(watch, slot) {
      watch.watching[slot] = watch.asset.on('data.' + slot + ':set', function(value) {
          if (watch.textures[slot]) {
              if (value !== watch.textures[slot].id) {
                  removeTextureWatch(watch, slot);
                  if (value) addTextureWatch(watch, slot, value);
              }
          } else if (value) {
              addTextureWatch(watch, slot, value);
          }
      });
  };

  var subscribe = function(watch) {
      for(var i = 0; i < slots.length; i++) {
          var textureId = watch.asset.get('data.' + slots[i]);
          if (textureId)
              addTextureWatch(watch, slots[i], textureId);
      }

      watch.watching.data = watch.asset.on('*:set', function(path) {
          if (! path.startsWith('data.'))
              return;

          trigger(watch, null);
      });

      watch.watching.all = watch.asset.on('data:set', function(value) {
          if (value) {
              for(var i = 0; i < slots.length; i++) {
                  var id = value[slots[i]];
                  if (watch.textures[slots[i]]) {
                      if (id !== watch.textures[slots[i]].id) {
                          removeTextureWatch(watch, slots[i]);
                          if (id) addTextureWatch(watch, slots[i], id);
                      }
                  } else if (id) {
                      addTextureWatch(watch, slots[i], id);
                  }
              }
          } else {
              for(var i = 0; i < slots.length; i++) {
                  if (watch.textures[slots[i]])
                      removeTextureWatch(watch, slots[i]);
              }
          }
      });

      for(var i = 0; i < slots.length; i++)
          addSlotWatch(watch, slots[i]);
  };

  var unsubscribe = function(watch) {
      for(var key in watch.textures)
          removeTextureWatch(watch, key);

      for(var key in watch.watching)
          watch.watching[key].unbind();
  };

  var trigger = function(watch, slot) {
      for(var key in watch.callbacks)
          watch.callbacks[key].callback(slot);
  };


  editor.method('assets:material:watch', function(args) {
      var watch = watching[args.asset.get('id')];

      if (! watch) {
          watch = watching[args.asset.get('id')] = {
              asset: args.asset,
              autoLoad: 0,
              textures: { },
              watching: { },
              ind: 0,
              callbacks: { }
          };
          subscribe(watch);
      }

      var item = watch.callbacks[++watch.ind] = {
          autoLoad: args.autoLoad,
          callback: args.callback
      };

      if (args.autoLoad)
          watch.autoLoad++;

      if (watch.autoLoad === 1) {
          for(var key in watch.textures) {
              var asset = app.assets.get(watch.textures[key].id);
              if (asset && ! asset.resource)
                  app.assets.load(asset);
          }
      }

      return watch.ind;
  });


  editor.method('assets:material:unwatch', function(asset, handle) {
      var watch = watching[asset.get('id')];
      if (! watch) return;

      if (! watch.callbacks.hasOwnProperty(handle))
          return;

      if (watch.callbacks[handle].autoLoad)
          watch.autoLoad--;

      delete watch.callbacks[handle];

      if (Object.keys(watch.callbacks).length === 0) {
          unsubscribe(watch);
          delete watching[asset.get('id')];
      }
  });
});


/* editor/assets/assets-preview-model.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var layerComposition = editor.call('preview:layerComposition');
  var layer = editor.call('preview:layer');

  var pitch = -15;
  var yaw = 45;

  // material
  var material = new pc.StandardMaterial();
  material.useSkybox = false;

  var aabb = new pc.BoundingBox();

  // model
  var modelNode = new pc.GraphNode();

  var meshSphere = pc.createSphere(app.graphicsDevice, {
      radius: 0,
      latitudeBands: 2,
      longitudeBands: 2
  });

  var modelPlaceholder = new pc.Model();
  modelPlaceholder.node = modelNode;
  modelPlaceholder.meshInstances = [ new pc.MeshInstance(modelNode, meshSphere, material) ];


  // light
  var lightEntity = new pc.Entity();
  lightEntity.addComponent('light', {
      type: 'directional',
      layers: []
  });
  lightEntity.setLocalEulerAngles(45, 135, 0);


  // camera
  var cameraOrigin = new pc.Entity();

  var cameraEntity = new pc.Entity();
  cameraEntity.addComponent('camera', {
      nearClip: 0.01,
      farClip: 32,
      clearColor: new pc.Color(41 / 255, 53 / 255, 56 / 255, 0.0),
      frustumCulling: false,
      layers: []
  });
  cameraEntity.setLocalPosition(0, 0, 1.35);
  cameraOrigin.addChild(cameraEntity);

  // All preview objects live under this root
  var previewRoot = new pc.Entity();
  previewRoot._enabledInHierarchy = true;
  previewRoot.enabled = true;
  previewRoot.addChild(modelNode);
  previewRoot.addChild(lightEntity);
  previewRoot.addChild(cameraOrigin);
  previewRoot.syncHierarchy();
  previewRoot.enabled = false;

  editor.method('preview:model:render', function(asset, canvasWidth, canvasHeight, canvas, args) {
      args = args || { };

      var width = canvasWidth;
      var height = canvasHeight;

      if (width > canvasHeight)
          width = canvasHeight;
      else
          height = canvasWidth;

      var target = editor.call('preview:getTexture', width, height);

      previewRoot.enabled = true;

      cameraEntity.camera.aspectRatio = height / width;
      layer.renderTarget = target;

      var data = asset.get('data');
      if (! data) return;

      var modelAsset = app.assets.get(asset.get('id'));
      if (! modelAsset) return;

      var model = modelPlaceholder;

      if (modelAsset._editorPreviewModel)
          model = modelAsset._editorPreviewModel.clone();

      model.lights = [ lightEntity.light.light ];

      var first = true;

      var i;

      // generate aabb for model
      for(i = 0; i < model.meshInstances.length; i++) {
          // initialize any skin instance
          if (model.meshInstances[i].skinInstance) {
              model.meshInstances[i].skinInstance.updateMatrices(model.meshInstances[i].node);
          }

          model.meshInstances[i].material = material;

          if (first) {
              first = false;
              aabb.copy(model.meshInstances[i].aabb);
          } else {
              aabb.add(model.meshInstances[i].aabb);
          }
      }

      if (first) {
          aabb.center.set(0, 0, 0);
          aabb.halfExtents.set(0.1, 0.1, 0.1);
      }

      material.update();

      pitch = args.hasOwnProperty('rotation') ? args.rotation[0] : -15;
      yaw = args.hasOwnProperty('rotation') ? args.rotation[1] : 45;

      var max = aabb.halfExtents.length();
      cameraEntity.setLocalPosition(0, 0, max * 2.5);

      cameraOrigin.setLocalPosition(aabb.center);
      cameraOrigin.setLocalEulerAngles(pitch, yaw, 0);
      cameraOrigin.syncHierarchy();

      lightEntity.setLocalRotation(cameraOrigin.getLocalRotation());
      lightEntity.rotateLocal(90, 0, 0);

      cameraEntity.camera.farClip = max * 5.0;

      lightEntity.light.intensity = 1.0 / (Math.min(1.0, app.scene.exposure) || 0.01);

      layer.addMeshInstances(model.meshInstances);
      layer.addLight(lightEntity.light);
      layer.addCamera(cameraEntity.camera);

      app.renderer.renderComposition(layerComposition);

      // read pixels from texture
      var device = app.graphicsDevice;
      device.gl.bindFramebuffer(device.gl.FRAMEBUFFER, target._glFrameBuffer);
      device.gl.readPixels(0, 0, width, height, device.gl.RGBA, device.gl.UNSIGNED_BYTE, target.pixels);

      // render to canvas
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.getContext('2d').putImageData(new ImageData(target.pixelsClamped, width, height), (canvasWidth - width) / 2, (canvasHeight - height) / 2);

      layer.removeLight(lightEntity.light);
      layer.removeCamera(cameraEntity.camera);
      layer.removeMeshInstances(model.meshInstances);
      layer.renderTarget = null;
      previewRoot.enabled = false;

      if (model !== modelPlaceholder)
          model.destroy();
  });
});


/* editor/assets/assets-preview-model-watch.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var watching = { };

  var subscribe = function(watch) {
      var onChange = function() {
          loadModel(watch, watch.engineAsset, true);
      };

      watch.watching.file = watch.asset.on('file.hash:set', function() {
          setTimeout(onChange, 0);
      });

      watch.watching.fileUnset = watch.asset.on('file.hash:unset', function() {
          setTimeout(onChange, 0);
      });

      watch.onAdd = function(asset) {
          app.assets.off('add:' + watch.asset.get('id'), watch.onAdd);
          watch.engineAsset = asset;
          watch.onAdd = null;

          if (watch.autoLoad) loadModel(watch, asset);
      };

      var asset = app.assets.get(watch.asset.get('id'));
      if (asset) {
          watch.onAdd(asset);
      } else {
          app.assets.once('add:' + watch.asset.get('id'), watch.onAdd);
      }
  };

  var unsubscribe = function(watch) {
      if (watch.engineAsset)
          watch.engineAsset.off('load', watch.onLoad);

      if (watch.onAdd)
          app.assets.off('add:' + watch.asset.get('id'), watch.onAdd);

      for(var key in watch.watching)
          watch.watching[key].unbind();
  };

  var loadModel = function(watch, asset, reload) {
      var url;
      var file = watch.asset.get('file');

      if (file && file.url) {
          url = file.url;

          if (app.assets.prefix && ! pc.ABSOLUTE_URL.test(url))
              url = app.assets.prefix + url;

          url = url.appendQuery('t=' + file.hash);
      }

      if (url && (reload || ! asset._editorPreviewModel)) {
          app.assets._loader.load(url, asset.type, function(err, resource, extra) {
              asset._editorPreviewModel = resource;
              trigger(watch);
          });
      } else if (! url && asset._editorPreviewModel) {
          asset._editorPreviewModel = null;
          trigger(watch);
      }
  };

  var trigger = function(watch) {
      for(var key in watch.callbacks)
          watch.callbacks[key].callback();
  };


  editor.method('assets:model:watch', function(args) {
      var watch = watching[args.asset.get('id')];

      if (! watch) {
          watch = watching[args.asset.get('id')] = {
              asset: args.asset,
              engineAsset: null,
              autoLoad: 0,
              onLoad: null,
              onAdd: null,
              watching: { },
              ind: 0,
              callbacks: { }
          };
          subscribe(watch);
      }

      var item = watch.callbacks[++watch.ind] = {
          autoLoad: args.autoLoad,
          callback: args.callback
      };

      if (args.autoLoad)
          watch.autoLoad++;

      if (watch.autoLoad === 1) {
          var asset = app.assets.get(watch.asset.get('id'));
          if (asset) {
              watch.engineAsset = asset;
              loadModel(watch, asset);
          }
      }

      return watch.ind;
  });


  editor.method('assets:model:unwatch', function(asset, handle) {
      var watch = watching[asset.get('id')];
      if (! watch) return;

      if (! watch.callbacks.hasOwnProperty(handle))
          return;

      if (watch.callbacks[handle].autoLoad)
          watch.autoLoad--;

      delete watch.callbacks[handle];

      if (Object.keys(watch.callbacks).length === 0) {
          unsubscribe(watch);
          delete watching[asset.get('id')];
      }
  });
});


/* editor/assets/assets-preview-cubemap.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var layerComposition = new pc.LayerComposition();

  var layer = new pc.Layer({
      id: LAYERID_SKYBOX,
      enabled: true,
      opaqueSortMode: 0
  });

  layerComposition.push(layer);

  var scene = new pc.Scene();
  scene.layers = layerComposition;

  var pitch = 0;
  var yaw = 0;

  var cubemapPrefiltered = [
      'prefilteredCubeMap128',
      'prefilteredCubeMap64',
      'prefilteredCubeMap32',
      'prefilteredCubeMap16',
      'prefilteredCubeMap8',
      'prefilteredCubeMap4'
  ];


  // camera
  var cameraEntity = new pc.Entity();
  cameraEntity.setLocalPosition(0, 0, 0);
  cameraEntity.addComponent('camera', {
      nearClip: 1,
      farClip: 32,
      clearColor: [0, 0, 0, 1],
      fov: 75,
      frustumCulling: false,
      layers: []
  });

  var lightEntity = new pc.Entity();
  lightEntity.addComponent('light', {
      type: 'directional'
  });

  // All preview objects live under this root
  var previewRoot = new pc.Entity();
  previewRoot._enabledInHierarchy = true;
  previewRoot.enabled = true;
  previewRoot.addChild(cameraEntity);
  previewRoot.addChild(lightEntity);
  previewRoot.syncHierarchy();
  previewRoot.enabled = false;

  var sceneSettings = null;
  editor.on('sceneSettings:load', function (settings) {
      sceneSettings = settings;
  });

  editor.method('preview:cubemap:render', function(asset, canvasWidth, canvasHeight, canvas, args) {
      args = args || { };

      var width = canvasWidth;
      var height = canvasHeight;

      if (width > height)
          width = height;
      else
          height = width;

      var target = editor.call('preview:getTexture', width, height);

      previewRoot.enabled = true;

      cameraEntity.camera.aspectRatio = height / width;
      layer.renderTarget = target;

      pitch = args.hasOwnProperty('rotation') ? args.rotation[0] : 0;
      yaw = args.hasOwnProperty('rotation') ? args.rotation[1] : 0;

      cameraEntity.setLocalEulerAngles(pitch, yaw, 0);

      var engineAsset = app.assets.get(asset.get('id'));

      if (engineAsset && engineAsset.resources) {
          if (scene.skybox !== engineAsset.resources[0]) {
              scene.setSkybox(engineAsset.resources);

              if (engineAsset.file) {
                  scene.skyboxMip = args.hasOwnProperty('mipLevel') ? args.mipLevel : 0;
              } else {
                  scene.skyboxMip = 0;
              }
          }

      } else {
          scene.setSkybox(null);
      }

      if (sceneSettings) {
          var settings = sceneSettings.json();
          scene.ambientLight.set(settings.render.global_ambient[0], settings.render.global_ambient[1], settings.render.global_ambient[2]);
          scene.gammaCorrection = settings.render.gamma_correction;
          scene.toneMapping = settings.render.tonemapping;
          scene.exposure = settings.render.exposure;
          scene.skyboxIntensity = settings.render.skyboxIntensity === undefined ? 1 : settings.render.skyboxIntensity;
      }

      scene._updateSkybox(app.graphicsDevice);

      layer.addCamera(cameraEntity.camera);
      layer.addLight(lightEntity.light);
      app.renderer.renderComposition(layerComposition);

      // read pixels from texture
      var device = app.graphicsDevice;
      device.gl.bindFramebuffer(device.gl.FRAMEBUFFER, target._glFrameBuffer);
      device.gl.readPixels(0, 0, width, height, device.gl.RGBA, device.gl.UNSIGNED_BYTE, target.pixels);

      // render to canvas
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.getContext('2d').putImageData(new ImageData(target.pixelsClamped, width, height), (canvasWidth - width) / 2, (canvasHeight - height) / 2);

      layer.removeLight(lightEntity.light);
      layer.removeCamera(cameraEntity.camera);
      layer.renderTarget = null;
      previewRoot.enabled = false;
  });
});


/* editor/assets/assets-preview-cubemap-watch.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available
  var watching = { };


  var addTextureWatch = function(watch, slot, id) {
      watch.textures[slot] = {
          id: id,
          fn: function() {
              trigger(watch, slot);
          }
      };
      app.assets.on('load:' + id, watch.textures[slot].fn);

      var asset = app.assets.get(id);
      if (asset) asset.on('change', watch.textures[slot].fn);

      var obj = editor.call('assets:get', id);
      if (obj) obj.on('thumbnails.s:set', watch.textures[slot].fn);

      if (watch.autoLoad) {
          var asset = app.assets.get(id);
          if (asset && ! asset.resource)
              app.assets.load(asset);

          var asset = app.assets.get(watch.asset.get('id'));
          if (asset && (! asset.resource || ! asset.loadFaces)) {
              asset.loadFaces = true;
              app.assets.load(asset);
          }
      }
  };

  var removeTextureWatch = function(watch, slot) {
      if (! watch.textures[slot])
          return;

      var id = watch.textures[slot].id;

      app.assets.off('load:' + id, watch.textures[slot].fn);

      var asset = app.assets.get(id);
      if (asset) asset.off('change', watch.textures[slot].fn);

      var obj = editor.call('assets:get', id);
      if (obj) obj.unbind('thumbnails.s:set', watch.textures[slot].fn);

      delete watch.textures[slot];
  };

  var addSlotWatch = function(watch, slot) {
      watch.watching[slot] = watch.asset.on('data.textures.' + slot + ':set', function(value) {
          if (watch.textures[slot]) {
              if (value !== watch.textures[slot].id) {
                  removeTextureWatch(watch, slot);
                  if (value) addTextureWatch(watch, slot, value);
              }
          } else if (value) {
              addTextureWatch(watch, slot, value);
          }
      });
  };

  var subscribe = function(watch) {
      for(var i = 0; i < 6; i++) {
          var textureId = watch.asset.get('data.textures.' + i);
          if (textureId)
              addTextureWatch(watch, i, textureId);
      }

      watch.watching.all = watch.asset.on('data.textures:set', function(value) {
          if (value) {
              for(var i = 0; i < 6; i++) {
                  var id = value[i];
                  if (watch.textures[i]) {
                      if (id !== watch.textures[i].id) {
                          removeTextureWatch(watch, i);
                          if (id) addTextureWatch(watch, i, id);
                      }
                  } else if (id) {
                      addTextureWatch(watch, i, id);
                  }
              }
          } else {
              for(var i = 0; i < 6; i++) {
                  if (watch.textures[i])
                      removeTextureWatch(watch, i);
              }
          }
      });

      for(var i = 0; i < 6; i++)
          addSlotWatch(watch, i);

      watch.onAdd = function(asset) {
          if (! watch.autoLoad)
              return;

          asset.loadFaces = true;
          app.assets.load(asset);
      };

      watch.onLoad = function(asset) {
          trigger(watch);
      };

      app.assets.on('add:' + watch.asset.get('id'), watch.onAdd);
      app.assets.on('load:' + watch.asset.get('id'), watch.onLoad);
  };

  var unsubscribe = function(watch) {
      for(var key in watch.textures)
          removeTextureWatch(watch, key);

      for(var key in watch.watching)
          watch.watching[key].unbind();

      app.assets.off('add:' + watch.asset.get('id'), watch.onAdd);
      app.assets.off('load:' + watch.asset.get('id'), watch.onLoad);
  };

  var trigger = function(watch, slot) {
      for(var key in watch.callbacks)
          watch.callbacks[key].callback(slot);
  };


  editor.method('assets:cubemap:watch', function(args) {
      var watch = watching[args.asset.get('id')];

      if (! watch) {
          watch = watching[args.asset.get('id')] = {
              asset: args.asset,
              autoLoad: 0,
              textures: { },
              watching: { },
              ind: 0,
              callbacks: { },
              onLoad: null,
              onAdd: null
          };
          subscribe(watch);
      }

      var item = watch.callbacks[++watch.ind] = {
          autoLoad: args.autoLoad,
          callback: args.callback
      };

      if (args.autoLoad)
          watch.autoLoad++;

      if (watch.autoLoad === 1) {
          var asset = app.assets.get(watch.asset.get('id'));
          if (asset && (! asset.loadFaces || ! asset.resource)) {
              asset.loadFaces = true;
              app.assets.load(asset);
          }
      }

      return watch.ind;
  });


  editor.method('assets:cubemap:unwatch', function(asset, handle) {
      var watch = watching[asset.get('id')];
      if (! watch) return;

      if (! watch.callbacks.hasOwnProperty(handle))
          return;

      if (watch.callbacks[handle].autoLoad)
          watch.autoLoad--;

      delete watch.callbacks[handle];

      if (Object.keys(watch.callbacks).length === 0) {
          unsubscribe(watch);
          delete watching[asset.get('id')];
      }
  });
});


/* editor/assets/assets-preview-font.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var layerComposition = editor.call('preview:layerComposition');
  var layer = editor.call('preview:layer');

  // camera
  var cameraEntity = new pc.Entity();
  cameraEntity.addComponent('camera', {
      nearClip: 1,
      farClip: 32,
      clearColor: [0, 0, 0, 0],
      fov: 75,
      frustumCulling: false
  });
  cameraEntity.setLocalPosition(0, 0, 1);

  var defaultTexture = new pc.Texture(app.graphicsDevice, {width:1, height:1, format:pc.PIXELFORMAT_R8_G8_B8_A8});
  var pixels = defaultTexture.lock();
  var pixelData = new Uint8Array(4);
  pixelData[0] = 255.0;
  pixelData[1] = 255.0;
  pixelData[2] = 255.0;
  pixelData[3] = 0.0;
  pixels.set(pixelData);
  defaultTexture.unlock();

  var defaultScreenSpaceTextMaterial = new pc.StandardMaterial();
  defaultScreenSpaceTextMaterial.msdfMap = defaultTexture;
  defaultScreenSpaceTextMaterial.useLighting = false;
  defaultScreenSpaceTextMaterial.useGammaTonemap = false;
  defaultScreenSpaceTextMaterial.useFog = false;
  defaultScreenSpaceTextMaterial.useSkybox = false;
  defaultScreenSpaceTextMaterial.diffuse = new pc.Color(0,0,0,1); // black diffuse color to prevent ambient light being included
  defaultScreenSpaceTextMaterial.emissive = new pc.Color(1,1,1,1);
  defaultScreenSpaceTextMaterial.opacity = 1;
  defaultScreenSpaceTextMaterial.blendType = pc.BLEND_PREMULTIPLIED;
  defaultScreenSpaceTextMaterial.depthWrite = false;
  defaultScreenSpaceTextMaterial.depthTest = false;
  defaultScreenSpaceTextMaterial.update();

  var positions = [];
  var normals = [];
  var uvs = [];
  var indices = [];

  // creates text mesh
  var createMesh = function (length) {
      positions.length = 0;
      normals.length = 0;
      uvs.length = 0;
      indices.length = 0;

      for (var i = 0; i < length; i++) {
          positions.push(0,0,0);
          positions.push(0,0,0);
          positions.push(0,0,0);
          positions.push(0,0,0);

          normals.push(0, 0, -1);
          normals.push(0, 0, -1);
          normals.push(0, 0, -1);
          normals.push(0, 0, -1);

          uvs.push(0, 1);
          uvs.push(1, 0);
          uvs.push(1, 1);
          uvs.push(0, 1);

          indices.push(i*4, i*4 + 1, i*4 + 3);
          indices.push(i*4 + 1, i*4 + 2, i*4 + 3);
      }

      return pc.createMesh(app.graphicsDevice, positions, {normals: normals, uvs: uvs, indices: indices});
  };

  // updates mesh positions and uvs based on the font and the character specified
  var updateMeshes = function (text, font) {
      var width = 1;
      var height = 1;
      var maxScale = -1;
      var maxYOffset = 1;
      var maxWidth = 0;

      // find maxScale and maxYOffset
      for (var i = 0; i < 2; i++) {
          var char = text[i]; // TODO: use symbol not char

          var charData = font.data.chars[char];
          if (! charData) {
              meshInstances[i].visible = false;
              continue;
          }

          meshInstances[i].visible = true;

          // find max character scale
          // so that we scale all smaller characters based on that value
          maxScale = Math.max(maxScale, 1 / (charData.scale || 1));

          // find max yoffset so that we line up characters a bit better in the preview
          maxYOffset = Math.min(maxYOffset, charData.yoffset / charData.height || 0);
      }

      positions.length = 0;
      uvs.length = 0;

      var GSCALE = 2; // global font preview scale

      for (var i = 0; i < 2; i++) {
          var char = text[i]; // TODO: use symbol not char
          var charData = font.data.chars[char];
          if (! charData) continue;

          var map = charData.map || 0;

          // scale of character relative to max scale
          var scale = 1 / (charData.scale || 1);
          scale = GSCALE * scale / maxScale;

          // yoffset of character relative to maxYOffset
          var yoffset = GSCALE * (maxYOffset - height / 2) * maxScale;

          // char offsets combined
          var ox = charData.xoffset + (charData.bounds ? charData.bounds[0] : 0);
          var oy = charData.yoffset + (charData.bounds ? charData.bounds[1] : 0);

          // char width
          var dw = GSCALE * charData.xadvance / charData.width;

          // calculate position for character
          positions.push(maxWidth, yoffset, 0);
          positions.push(maxWidth + dw, yoffset, 0);
          positions.push(maxWidth + dw, yoffset + scale * (height - 2 * oy * charData.scale / charData.height) * maxScale, 0);
          positions.push(maxWidth, yoffset + scale * (height - 2 * oy * charData.scale / charData.height) * maxScale, 0);

          // increment total width
          maxWidth += dw;

          // calculate uvs
          var x1 = (charData.x + ox * charData.scale) / font.data.info.maps[map].width;
          var y1 = 1 - (charData.y + charData.height - oy * charData.scale) / font.data.info.maps[map].height;
          var x2 = (charData.x + (ox + charData.xadvance) * charData.scale) / font.data.info.maps[map].width;
          var y2 = 1 - (charData.y + oy * charData.scale) / font.data.info.maps[map].height;

          uvs.push(x1, y1);
          uvs.push(x2, y1);
          uvs.push(x2, y2);
          uvs.push(x1, y2);

          // set correct texture for character
          meshInstances[i].setParameter("texture_msdfMap", font.textures[map]);
      }

      // offset positions to be centered vertically
      var offset = -maxWidth / 2;
      for (var i = 0; i < positions.length; i+=3) {
          positions[i] += offset;
      }

      // update vertices
      for (var i = 0; i < 2; i++) {
          var vb = meshInstances[i].mesh.vertexBuffer;
          var it = new pc.VertexIterator(vb);

          var numVertices = 4;
          for (var v = 0; v < numVertices; v++) {
              it.element[pc.SEMANTIC_POSITION].set(positions[i*4*3 + v*3+0], positions[i*4*3 + v*3+1], positions[i*4*3 + v*3+2]);
              it.element[pc.SEMANTIC_TEXCOORD0].set(uvs[i*4*2 + v*2+0], uvs[i*4*2 + v*2+1]);
              it.next();
          }
          it.end();

      }

      return true;

  };

  var hasChars = function (chars, font) {
      for (var i = 0; i < chars.length; i++)
          if (! font.data.chars[chars[i]])
              return false;

      return true;
  };

  // create one mesh per letter and add them to a model
  var node = new pc.GraphNode();
  var model = new pc.Model();
  var meshes = [createMesh(1), createMesh(1)];
  var meshInstances = [
      new pc.MeshInstance(node, meshes[0], defaultScreenSpaceTextMaterial),
      new pc.MeshInstance(node, meshes[1], defaultScreenSpaceTextMaterial)
  ];
  meshInstances[0].screenSpace = true;
  meshInstances[1].screenSpace = true;
  model.meshInstances.push(meshInstances[0]);
  model.meshInstances.push(meshInstances[1]);

  // All preview objects live under this root
  var previewRoot = new pc.Entity();
  previewRoot._enabledInHierarchy = true;
  previewRoot.enabled = true;
  previewRoot.addChild(node);
  previewRoot.addChild(cameraEntity);
  previewRoot.syncHierarchy();
  previewRoot.enabled = false;

  editor.method('preview:font:render', function(asset, canvasWidth, canvasHeight, canvas, args) {
      args = args || { };

      var width = canvasWidth;
      var height = canvasHeight;

      if (width > height)
          width = height;
      else
          height = width;

      var target = editor.call('preview:getTexture', width, height);

      previewRoot.enabled = true;

      cameraEntity.camera.aspectRatio = height / width;
      layer.renderTarget = target;

      var engineAsset = app.assets.get(asset.get('id'));

      // skip if the font isn't ready
      if (! engineAsset || ! engineAsset.resource || ! engineAsset.resource.textures || ! engineAsset.resource.textures.length || ! engineAsset.resource.data || ! engineAsset.resource.data.chars) {
          app.renderer.renderComposition(layerComposition);
      } else {
          // try to use Aa as the text in different languages
          // and if that is not found try the first two characters of the font

          // latin
          if (hasChars('Aa', engineAsset.resource)) {
              var text = 'Aa';
          }
          // greek
          else if (hasChars('Αα', engineAsset.resource)) {
              var text = 'Αα';
          }
          // cyrillic
          else if (hasChars('Аа', engineAsset.resource)) {
              var text = 'Аа';
          }
          // rest
          else {
              var text = '';
              var chars = asset.get('meta.chars');
              for (var i = 0, len = chars.length; i < len && text.length < 2; i++) {
                  if (/\s/.test(chars[i])) continue;
                  text += chars[i];
              }
          }

          // set the font texture based on which characters we chose to display
          // defaultScreenSpaceTextMaterial.msdfMap = engineAsset.resource.textures[0];
          defaultScreenSpaceTextMaterial.setParameter('font_sdfIntensity', asset.get('data.intensity'));

          var char = engineAsset.resource.data.chars[text[0]];
          var pxRange = (char && char.range) ? ((char.scale || 1) * char.range) : 2;
          defaultScreenSpaceTextMaterial.setParameter('font_pxrange', pxRange);

          var map = char.map || 0;
          defaultScreenSpaceTextMaterial.setParameter('font_textureWidth', engineAsset.resource.data.info.maps[map].width);

          defaultScreenSpaceTextMaterial.setParameter('outline_thickness', 0);

          var shadowOffsetUniform = new Float32Array([0, 0]);
          defaultScreenSpaceTextMaterial.setParameter('shadow_offset', shadowOffsetUniform);

          defaultScreenSpaceTextMaterial.update();

          updateMeshes(text, engineAsset.resource);

          layer.addMeshInstances(model.meshInstances);
          layer.addCamera(cameraEntity.camera);

          app.renderer.renderComposition(layerComposition);

          // read pixels from texture
          var device = app.graphicsDevice;
          device.gl.bindFramebuffer(device.gl.FRAMEBUFFER, target._glFrameBuffer);
          device.gl.readPixels(0, 0, width, height, device.gl.RGBA, device.gl.UNSIGNED_BYTE, target.pixels);

          // render to canvas
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          canvas.getContext('2d').putImageData(new ImageData(target.pixelsClamped, width, height), (canvasWidth - width) / 2, (canvasHeight - height) / 2);

          layer.removeMeshInstances(model.meshInstances);
          layer.removeCamera(cameraEntity.camera);
      }


      previewRoot.enabled = false;
      layer.renderTarget = null;

  });
});


/* editor/assets/assets-preview-font-watch.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available
  var watching = { };

  var subscribe = function(watch) {
      watch.onChange = function (asset, name, value) {
          if (name === 'data') {
              trigger(watch);
          }
      };

      watch.onAdd = function(asset) {
          app.assets.off('add:' + watch.asset.get('id'), watch.onAdd);
          watch.onAdd = null;
          watch.engineAsset = asset;
          watch.engineAsset.off('load', watch.onLoad);
          watch.engineAsset.on('load', watch.onLoad);
          watch.engineAsset.off('change', watch.onChange);
          watch.engineAsset.on('change', watch.onChange);
          if (watch.autoLoad) loadFont(watch, asset);
      };

      watch.onLoad = function (asset) {
          trigger(watch);
      };

      var asset = app.assets.get(watch.asset.get('id'));
      if (asset) {
          watch.onAdd(asset);

      } else {
          app.assets.once('add:' + watch.asset.get('id'), watch.onAdd);
      }


  };

  var unsubscribe = function(watch) {
      if (watch.engineAsset) {
          watch.engineAsset.off('load', watch.onLoad);
          watch.engineAsset.off('change', watch.onChange);
      }

      if (watch.onAdd)
          app.assets.off('add:' + watch.asset.get('id'), watch.onAdd);

      for(var key in watch.watching)
          watch.watching[key].unbind();


  };

  var loadFont = function(watch, asset, reload) {
      if (reload && asset) {
          asset.unload();
      }

      asset.ready(function () {
          trigger(watch);
      });
      app.assets.load(asset);
  };


  var trigger = function(watch) {
      for(var key in watch.callbacks) {
          watch.callbacks[key].callback();
      }
  };


  editor.method('assets:font:watch', function(args) {
      var watch = watching[args.asset.get('id')];

      if (! watch) {
          watch = watching[args.asset.get('id')] = {
              asset: args.asset,
              engineAsset: null,
              autoLoad: 0,
              onLoad: null,
              onAdd: null,
              watching: { },
              ind: 0,
              callbacks: { }
          };
          subscribe(watch);
      }

      var item = watch.callbacks[++watch.ind] = {
          autoLoad: args.autoLoad,
          callback: args.callback
      };

      if (args.autoLoad)
          watch.autoLoad++;

      if (watch.autoLoad === 1) {
          var asset = app.assets.get(watch.asset.get('id'));
          if (asset) {
              watch.engineAsset = asset;
              loadFont(watch, asset);
          }
      }

      return watch.ind;
  });


  editor.method('assets:font:unwatch', function(asset, handle) {
      var watch = watching[asset.get('id')];
      if (! watch) return;

      if (! watch.callbacks.hasOwnProperty(handle))
          return;

      if (watch.callbacks[handle].autoLoad)
          watch.autoLoad--;

      delete watch.callbacks[handle];

      if (Object.keys(watch.callbacks).length === 0) {
          unsubscribe(watch);
          delete watching[asset.get('id')];
      }
  });
});


/* editor/assets/assets-preview-sprite.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var centerPivot = [0.5, 0.5];

  var cancelRender = function (width, height, canvas) {
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').clearRect(0, 0, width, height);
      return false;
  };


  // ImageCache holds Image objects
  // cached with some key (asset.id)
  var ImageCache = function () {
      this._items = {};
  };

  // return true if key exists
  ImageCache.prototype.has = function (key) {
      return !!this._items[key];
  };

  // return the ImageCacheEntry at key
  ImageCache.prototype.get = function (key) {
      if (this.has(key)) return this._items[key];
      return null;
  };

  // Insert an Image element into the cache
  // Returns the new ImageCacheEntry
  ImageCache.prototype.insert = function (key, image) {
      var entry = new ImageCacheEntry(image);
      this._items[key] = entry;

      return entry;
  };

  // ImageCacheEntry
  // an item in the ImageCache
  // fires 'loaded' event if the Image element loads after being created
  var ImageCacheEntry = function (image) {
      Events.call(this);

      this.value = image;
      this.status = 'loading';

      var self = this;
      image.onload = function () {
          self.status = 'loaded';
          self.emit('loaded', self);
      };
  };
  ImageCacheEntry.prototype = Object.create(Events.prototype);


  // Cache for holding Image elements used by compressed textures
  var imageCache = new ImageCache();

  editor.method('preview:sprite:render', function(asset, width, height, canvas, args) {
      var frameKeys = asset.get('data.frameKeys');
      if (! frameKeys || ! frameKeys.length) return cancelRender(width, height, canvas);

      var atlasId = asset.get('data.textureAtlasAsset');
      if (! atlasId) return cancelRender(width, height, canvas);

      var atlas = editor.call('assets:get', atlasId);
      if (! atlas) return cancelRender(width, height, canvas);

      var frames = atlas.get('data.frames');
      if (! frames) return cancelRender(width, height, canvas);

      var frame = frames[frameKeys[args && args.frame || 0]];
      if (! frame) return cancelRender(width, height, canvas);

      var animating = args && args.animating;

      var ctx = canvas.getContext('2d');

      var engineAtlas = app.assets.get(atlasId);
      if (engineAtlas && engineAtlas.resource && engineAtlas.resource.texture) {
          var atlasTexture = engineAtlas.resource.texture;

          var leftBound = Number.POSITIVE_INFINITY;
          var rightBound = Number.NEGATIVE_INFINITY;
          var bottomBound = Number.POSITIVE_INFINITY;
          var topBound = Number.NEGATIVE_INFINITY;

          for (var i = 0, len = frameKeys.length; i<len; i++) {
              var f = frames[frameKeys[i]];
              if (! f) continue;

              var pivot = animating ? f.pivot : centerPivot;
              var rect = f.rect;

              var left = -rect[2] * pivot[0];
              var right = (1-pivot[0]) * rect[2];
              var bottom = -rect[3] * pivot[1];
              var top = (1 - pivot[1]) * rect[3];

              leftBound = Math.min(leftBound, left);
              rightBound = Math.max(rightBound, right);
              bottomBound = Math.min(bottomBound, bottom);
              topBound = Math.max(topBound, top);
          }

          var maxWidth = rightBound - leftBound;
          var maxHeight = topBound - bottomBound;

          var x = frame.rect[0];
          // convert bottom left WebGL coord to top left pixel coord
          var y = atlasTexture.height - frame.rect[1] - frame.rect[3];
          var w = frame.rect[2];
          var h = frame.rect[3];

          var canvasRatio = width / height;
          var aspectRatio = maxWidth / maxHeight;

          var widthFactor = width;
          var heightFactor = height;

          if (canvasRatio > aspectRatio) {
              widthFactor = height * aspectRatio;
          } else {
              heightFactor = width / aspectRatio;
          }

          // calculate x and width
          var pivot = animating ? frame.pivot : centerPivot;
          var left = -frame.rect[2] * pivot[0];
          var offsetX = widthFactor * (left - leftBound) / maxWidth;
          var targetWidth = widthFactor * frame.rect[2] / maxWidth;

          // calculate y and height
          var top = (1 - pivot[1]) * frame.rect[3];
          var offsetY = heightFactor * (1 - (top - bottomBound) / maxHeight);
          var targetHeight = heightFactor * frame.rect[3] / maxHeight;

          // center it
          offsetX += (width - widthFactor) / 2;
          offsetY += (height - heightFactor) / 2;

          canvas.width = width;
          canvas.height = height;
          ctx.clearRect(0, 0, width, height);

          ctx.mozImageSmoothingEnabled = false;
          ctx.webkitImageSmoothingEnabled = false;
          ctx.msImageSmoothingEnabled = false;
          ctx.imageSmoothingEnabled = false;

          var img;
          if (atlasTexture._compressed && engineAtlas.file) {
              var entry = imageCache.get(engineAtlas.file.hash);
              if (entry) {
                  if (entry.status === 'loaded') {
                      img = entry.value;
                  } else {
                      entry.once('loaded', function (entry) {
                          editor.call('assets:sprite:watch:trigger', asset);
                      });
                  }

              } else {

                  // create an image element from the asset source file
                  // used in the preview if the texture contains compressed data
                  img = new Image();
                  img.src = engineAtlas.file.url;

                  // insert image into cache which fires an event when the image is loaded
                  var entry = imageCache.insert(engineAtlas.file.hash, img);
                  entry.once('loaded', function (entry) {
                      editor.call('assets:sprite:watch:trigger', asset);
                  });
              }
          } else {
              img = atlasTexture.getSource();
          }

          if (img) {
              ctx.drawImage(img, x, y, w, h, offsetX, offsetY, targetWidth, targetHeight);
          } else {
              cancelRender(width, height, canvas);
          }

          return true;
      } else {
          return cancelRender(width, height, canvas);
      }
  });
});


/* editor/assets/assets-preview-sprite-watch.js */
editor.once('load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var watching = { };

  var subscribe = function(watch) {
      var onChange = function() {
          trigger(watch);
      };

      var currentAtlas = null;

      var watchAtlas = function () {
          var atlas = watch.asset.get('data.textureAtlasAsset');
          currentAtlas = atlas;
          if (! atlas) return;

          var atlasAsset = editor.call('assets:get', atlas);
          if (atlasAsset) {
              var engineAtlas = app.assets.get(atlas);
              engineAtlas.on('change', onChange);
              watch.events.onAtlasChange = onChange;
              engineAtlas.on('load', onChange);
              watch.events.onAtlasLoad = onChange;

              watch.events.onAtlasRemove = atlasAsset.once('destroy', function () {
                  unwatchAtlas(watch, currentAtlas);
                  onChange();
              });

              if (! engineAtlas.resource)
                  app.assets.load(engineAtlas);

          } else {
              app.assets.once('assets:add[' + atlas + ']', watchAtlas);
              watch.events.onAtlasAdd = watchAtlas;
          }
      };

      watchAtlas();

      watch.events.onSetAtlas = watch.asset.on('data.textureAtlasAsset:set', function () {
          unwatchAtlas(watch, currentAtlas);
          watchAtlas();
      });

      watch.events.onSpriteChange = watch.asset.on('*:set', function (path) {
          if (/^data.frameKeys/.test(path) || /^data.textureAtlasAsset/.test(path)) {
              onChange();
          }
      });
  };

  var unwatchAtlas = function (watch, atlas) {
      if (! atlas) return;

      var engineAtlas = app.assets.get(atlas);

      if (watch.events.onAtlasChange) {
          if (engineAtlas) {
              engineAtlas.off('change', watch.events.onAtlasChange);
          }
          delete watch.events.onAtlasChange;
      }

      if (watch.events.onAtlasLoad) {
          if (engineAtlas) {
              engineAtlas.off('load', watch.events.onAtlasLoad);
          }
          delete watch.events.onAtlasLoad;
      }

      if (watch.events.onAtlasRemove) {
          watch.events.onAtlasRemove.unbind();
          delete watch.events.onAtlasRemove;
      }

      if (watch.events.onAtlasAdd) {
          app.assets.off('assets:add[' + atlas + ']', watch.events.onAtlasAdd);
          delete watch.events.onAtlasAdd;
      }
  };

  var unsubscribe = function(watch) {
      var atlas = watch.asset.get('data.textureAtlasAsset');
      unwatchAtlas(watch, atlas);
      if (watch.events.onSetAtlas) {
          watch.events.onSetAtlas.unbind();
      }
      if (watch.events.onSpriteChange) {
          watch.events.onSpriteChange.unbind();
      }
      watch.events = {};
  };

  var trigger = function(watch) {
      for(var key in watch.callbacks)
          watch.callbacks[key].callback();
  };

  // used to force the trigger when the asset is known to have changed
  // e.g. when loading the uncompressed texture atlas completes
  editor.method('assets:sprite:watch:trigger', function(asset) {
      var watch = watching[asset.get('id')];
      if (watch) {
          trigger(watch);
      }
  });

  editor.method('assets:sprite:watch', function(args) {
      var watch = watching[args.asset.get('id')];

      if (! watch) {
          watch = watching[args.asset.get('id')] = {
              asset: args.asset,
              events: {},
              ind: 0,
              callbacks: { }
          };
          subscribe(watch);
      }

      var item = watch.callbacks[++watch.ind] = {
          callback: args.callback
      };

      return watch.ind;
  });


  editor.method('assets:sprite:unwatch', function(asset, handle) {
      var watch = watching[asset.get('id')];
      if (! watch) return;

      if (! watch.callbacks.hasOwnProperty(handle))
          return;

      delete watch.callbacks[handle];

      if (Object.keys(watch.callbacks).length === 0) {
          unsubscribe(watch);
          delete watching[asset.get('id')];
      }
  });
});


/* editor/viewport/viewport-preview-particles.js */
editor.once('load', function() {
  'use strict';

  var index = { };
  var render = 0;


  editor.on('viewport:update', function() {
      if (render !== 0) editor.call('viewport:render');
  });

  var checkState = function(item, remove) {
      if (remove || ! item.entity.entity || ! item.entity.entity.particlesystem) {
          if (item.active) {
              render--;
              item.active = false;

              if (item.entity.entity && item.entity.entity.particlesystem)
                  item.entity.entity.particlesystem.enabled = false;
          }
          return;
      }

      if (! remove && item.entity.get('components.particlesystem.enabled')) {
          if (! item.active) {
              render++;
              item.active = true;

              item.entity.entity.particlesystem.enabled = true;

              editor.call('viewport:render');
          }
      } else if (item.active) {
          render--;
          item.active = false;
          item.entity.entity.particlesystem.enabled = false;
      }
  };

  var add = function(entity) {
      var id = entity.get('resource_id');

      if (index[id])
          return;

      var onCheckState = function() {
          checkState(item);
      };

      var item = index[id] = {
          id: id,
          entity: entity,
          active: false,
          evtEnable: entity.on('components.particlesystem.enabled:set', function() {
              setTimeout(onCheckState, 0);
          }),
          evtSet: entity.on('components.particlesystem:set', onCheckState),
          evtUnset: entity.on('components.particlesystem:unset', onCheckState)
      };

      checkState(item);
  };

  var remove = function(item) {
      checkState(item, true);

      item.evtEnable.unbind();
      item.evtSet.unbind();
      item.evtUnset.unbind();

      delete index[item.id];
  };

  var clear = function() {
      var keys = Object.keys(index);

      for(var i = 0; i < keys.length; i++)
          remove(index[keys[i]]);
  };


  editor.on('selector:change', function(type, items) {
      clear();

      if (type !== 'entity')
          return;

      for(var i = 0; i < items.length; i++)
          add(items[i]);
  });
});


/* editor/viewport/viewport-preview-animation.js */
editor.once('load', function() {
  'use strict';

  var index = { };
  var render = 0;


  editor.on('viewport:update', function() {
      if (render !== 0) editor.call('viewport:render');
  });

  var checkState = function(item, remove) {
      if (remove || ! item.entity.entity || ! item.entity.entity.animation) {
          if (item.active) {
              render--;
              item.active = false;

              if (item.entity.entity && item.entity.entity.animation)
                  item.entity.entity.animation.enabled = false;
          }
          return;
      }

      if (! remove && item.entity.get('components.animation.enabled')) {
          if (! item.active) {
              render++;
              item.active = true;

              item.entity.entity.animation.enabled = true;

              editor.call('viewport:render');
          }
      } else if (item.active) {
          render--;
          item.active = false;
          item.entity.entity.animation.enabled = false;
      }
  };

  var add = function(entity) {
      var id = entity.get('resource_id');

      if (index[id])
          return;

      var onCheckState = function() {
          checkState(item);
      };

      var item = index[id] = {
          id: id,
          entity: entity,
          active: false,
          evtEnable: entity.on('components.animation.enabled:set', function() {
              setTimeout(onCheckState, 0);
          }),
          evtSet: entity.on('components.animation:set', onCheckState),
          evtUnset: entity.on('components.animation:unset', onCheckState)
      };

      checkState(item);
  };

  var remove = function(item) {
      checkState(item, true);

      item.evtEnable.unbind();
      item.evtSet.unbind();
      item.evtUnset.unbind();

      delete index[item.id];
  };

  var clear = function() {
      var keys = Object.keys(index);

      for(var i = 0; i < keys.length; i++)
          remove(index[keys[i]]);
  };


  editor.on('selector:change', function(type, items) {
      clear();

      if (type !== 'entity')
          return;

      for(var i = 0; i < items.length; i++)
          add(items[i]);
  });
});
