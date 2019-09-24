

/* editor/gizmo/gizmo.js */
editor.once('load', function() {
  'use strict';

  var gizmoType = 'translate';
  var coordSystem = 'world';
  var snap = false;
  var snapToggle = false;
  var snapShift = false;
  var snapIncrement = 1;

  editor.method('gizmo:type', function(type) {
      if (type === undefined)
          return gizmoType;

      if (gizmoType === type)
          return;

      gizmoType = type;

      editor.emit('gizmo:type', type);
  });

  editor.method('gizmo:coordSystem', function(system) {
      if (system === undefined)
          return coordSystem;

      if (coordSystem === system)
          return;

      coordSystem = system;

      editor.emit('gizmo:coordSystem', system);
  });

  var checkSnap = function() {
      var state = (snapToggle || snapShift) && (snapToggle !== snapShift);
      if (snap === state)
          return;

      snap = state;
      editor.emit('gizmo:snap', snap, snapIncrement);
  };

  editor.method('gizmo:snap', function(state) {
      if (snapToggle === state)
          return;

      snapToggle = state;
      checkSnap();
  });

  var editorSettings = editor.call('settings:projectUser');
  editorSettings.on('editor.snapIncrement:set', function(value) {
      if (snapIncrement === (value || 1))
          return;

      snapIncrement = value || 1;
      editor.emit('gizmo:snap', snap, snapIncrement);
  });
  snapIncrement = editorSettings.get('editor.snapIncrement') || 1;

  editor.on('hotkey:shift', function(state) {
      if (snapShift === state)
          return;

      snapShift = state;
      checkSnap();
  });
});


/* editor/gizmo/gizmo-layers.js */
editor.once('load', function() {
  'use strict';

  // holds all layers that are to be added in the beginning of the composition
  var layerIndexBefore = {};
  // holds all layers that are to be added to the end of the composition
  var layerIndexAfter = {};
  // holds all layers by name
  var nameIndex = {};

  var id = 1000000000;

  editor.method('gizmo:layers:register', function (name, insertToBeginning, data) {
      if (nameIndex[name]) {
          console.warn('Layer with name ' + name + ' already exists.');
      }

      if (! data)
          data = {};

      data.id = id++;
      data.enabled = true;
      data.name = 'Editor Layer ' + name;

      if (data.opaqueSortMode === undefined) {
          data.opaqueSortMode = pc.SORTMODE_NONE;
      }
      if (data.transparentSortMode === undefined) {
          data.transparentSortMode = pc.SORTMODE_BACK2FRONT;
      }

      var index = insertToBeginning ? layerIndexBefore : layerIndexAfter;
      var keys = Object.keys(index);
      var previous = keys.length ? index[keys[keys.length - 1]] : null;

      index[data.id] = new pc.Layer(data);
      nameIndex[name] = index[data.id];

      return index[data.id];
  });

  editor.method('gizmo:layers', function (name) {
      return nameIndex[name];
  });

  editor.method('gizmo:layers:list', function () {
      var result = [];
      for (var key in nameIndex) {
          result.push(nameIndex[key]);
      }

      return result;
  });

  editor.method('gizmo:layers:removeFromComposition', function (composition) {
      if (! composition) {
          var app = editor.call('viewport:app');
          if (! app) return;
          composition = app.scene.layers;
      }

      for (var key in layerIndexBefore) {
          composition.remove(layerIndexBefore[key]);
      }

      for (var key in layerIndexAfter) {
          composition.remove(layerIndexAfter[key]);
      }
  });

  editor.method('gizmo:layers:addToComposition', function (composition) {
      if (! composition) {
          var app = editor.call('viewport:app');
          if (! app) return;

          composition = app.scene.layers;

      }

      var key;
      var index = 0;
      for (key in layerIndexBefore) {
          composition.insert(layerIndexBefore[key], index++);
      }

      for (key in layerIndexAfter) {
          composition.push(layerIndexAfter[key]);
      }

  });

  // Grid layer
  editor.call('gizmo:layers:register', 'Viewport Grid', true);
  // Layer before every scene layer
  editor.call('gizmo:layers:register', 'Bright Gizmo', true);
  // First layer after every scene layer
  editor.call('gizmo:layers:register', 'Bright Collision');
  // Second layer after every scene layer - clears depth buffer
  editor.call('gizmo:layers:register', 'Dim Gizmo', false, {
      overrideClear: true,
      clearDepthBuffer: true,
      onPreRender: function () {

      }
  });
  // Third layer after every scene layer - clears depth and color buffer (used by viewport-outline)
  editor.call('gizmo:layers:register', 'Viewport Outline', false, {
      passThrough: true,
      isPostEffect: true
  });

  editor.call('gizmo:layers:register', 'Axis Gizmo Immediate', false, {
      passThrough: true,
      overrideClear: true,
      clearDepthBuffer: true,
      opaqueSortMode: pc.SORTMODE_NONE,
      transparentSortMode: pc.SORTMODE_NONE
  });

  editor.call('gizmo:layers:register', 'Axis Rotate Gizmo Immediate', false, {
      passThrough: true,
      overrideClear: true,
      clearDepthBuffer: true,
      opaqueSortMode: pc.SORTMODE_NONE,
      transparentSortMode: pc.SORTMODE_NONE
  });

  editor.call('gizmo:layers:register', 'Axis Gizmo', false, {
  });

  editor.call('gizmo:layers:register', 'Camera Preview', false, {
    passThrough: true,
    isPostEffect: true
  });

  editor.once('viewport:load', function () {
      var app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      editor.call('gizmo:layers:addToComposition');
  });
});


/* editor/gizmo/gizmo-point.js */
editor.once('viewport:load', function() {
  'use strict';

  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var pool = [ ];
  var points = [ ];
  var gizmoSize = 0.1;
  var hoverPoint = null;
  var dragPoint = null;
  var mouseTap;
  var evtTapStart;
  var pickStart = new pc.Vec3();
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();
  var vecD = new pc.Vec3();
  var vecE = new pc.Vec3();
  var quatA = new pc.Quat();

  var container = new pc.Entity();
  container.name = 'gizmo-points';
  container.__editor = true;
  app.root.addChild(container);

  var material = new pc.BasicMaterial();
  material.color = new pc.Color(1.0, 1.0, 1.0);
  material.cull = pc.CULLFACE_NONE;
  material.update();

  var layer = editor.call('gizmo:layers', 'Axis Gizmo');

  function Gizmo(axis, dir) {
      Events.call(this);
      this.entity = null;
      this.axis = axis || 'y';
      this.dir = dir === undefined ? 1 : dir;
      this.rotation = new pc.Quat();
      this.position = new pc.Vec3();
      this.scale = new pc.Vec3(1, 1, 1);
  }
  Gizmo.prototype = Object.create(Events.prototype);

  Gizmo.prototype.update = function() {
      if (! this.entity)
          return;

      var camera = editor.call('camera:current');
      var posCamera = camera.getPosition();
      var pos = this.entity.getLocalPosition();
      var scale = 1;

      // scale to screen space
      if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
          var dot = vecA.copy(pos).sub(posCamera).dot(camera.forward);
          var denom = 1280 / (2 * Math.tan(camera.camera.fov * pc.math.DEG_TO_RAD / 2));
          scale = Math.max(0.0001, (dot / denom) * 150) * gizmoSize;
      } else {
          scale = camera.camera.orthoHeight / 3 * gizmoSize;
      }
      vecA.copy(this.scale).scale(scale);
      this.entity.setLocalScale(vecA);
  };

  Object.defineProperty(Gizmo.prototype, 'enabled', {
      set: function(value) {
          if (!! value === !! this.entity)
              return;

          if (value) {
              this.entity = new pc.Entity();
              this.entity.addComponent('model', {
                  type: 'box',
                  receiveShadows: false,
                  castShadowsLightmap: false,
                  castShadows: false,
                  layers: [layer.id]
              });
              this.entity.__editor = true;
              this.entity.point = this;
              // this.entity.model.meshInstances[0].layer = pc.LAYER_GIZMO;
              this.entity.model.meshInstances[0].mask = GIZMO_MASK;
              this.entity.model.meshInstances[0].material = material;
              container.addChild(this.entity);
          } else {
              this.entity.destroy();
              this.entity = null;
          }
      },
      get: function() {
          return !! this.entity;
      }
  });

  editor.method('gizmo:point:create', function(axis, position, dir) {
      var item = pool.shift();
      if (! item)
          item = new Gizmo();

      item.axis = axis || 'y';
      item.dir = dir === undefined ? 1 : dir;
      if (position) axis.position.copy(position);
      item.enabled = true;
      points.push(item.entity);

      return item;
  });

  editor.method('gizmo:point:recycle', function(point) {
      point.scale.set(1, 1, 1);
      point.enabled = false;
      pool.push(point);

      var ind = points.indexOf(point.entity);
      if (ind !== -1)
          points.splice(ind, 1);
  });

  editor.call('gizmo:point:hovered', function() {
      return hoverPoint;
  });

  // on picker hover
  editor.on('viewport:pick:hover', function(node, picked) {
      var match = false;
      if (node && node.__editor && node.point)
          match = points.indexOf(node) !== -1;

      if ((! hoverPoint || hoverPoint !== node) && match && node.point) {
          if (hoverPoint)
              hoverPoint.emit('blur');

          hoverPoint = node.point;
          hoverPoint.emit('focus');

          if (! evtTapStart)
              evtTapStart = editor.on('viewport:tap:start', onTapStart);
      } else if (hoverPoint && ! match) {
          if (hoverPoint)
              hoverPoint.emit('blur');
          hoverPoint = null;

          if (evtTapStart) {
              evtTapStart.unbind();
              evtTapStart = null;
          }
      }
  });

  var pickPlane = function(x, y) {
      var camera = editor.call('camera:current');
      var scale = 1;
      var mouseWPos = camera.camera.screenToWorld(x, y, 1);
      var posGizmo = vecE.copy(dragPoint.position);
      var rayOrigin = vecA.copy(camera.getPosition());
      var rayDirection = vecB.set(0, 0, 0);
      var planeNormal = vecC.set(0, 0, 0);
      planeNormal[dragPoint.axis] = 1;

      if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
          rayDirection.copy(mouseWPos).sub(rayOrigin).normalize();
      } else {
          rayOrigin.add(mouseWPos);
          camera.getWorldTransform().transformVector(vecD.set(0, 0, -1), rayDirection);
      }

      quatA.copy(dragPoint.rotation);

      // rotate vector by gizmo rotation
      quatA.transformVector(planeNormal, planeNormal);

      vecD.copy(rayOrigin).sub(posGizmo).normalize();
      planeNormal.copy(vecD.sub(planeNormal.scale(planeNormal.dot(vecD))).normalize());

      var rayPlaneDot = planeNormal.dot(rayDirection);
      var planeDist = posGizmo.dot(planeNormal);
      var pointPlaneDist = (planeNormal.dot(rayOrigin) - planeDist) / rayPlaneDot;
      var pickedPos = rayDirection.scale(-pointPlaneDist).add(rayOrigin);

      // single axis
      planeNormal.set(0, 0, 0);
      planeNormal[dragPoint.axis] = 1;
      quatA.transformVector(planeNormal, planeNormal);
      pickedPos.copy(planeNormal.scale(planeNormal.dot(pickedPos)));

      quatA.invert().transformVector(pickedPos, pickedPos);

      var v = pickedPos[dragPoint.axis];
      pickedPos.set(0, 0, 0);
      pickedPos[dragPoint.axis] = v;

      return pickedPos;
  };

  var onTapStart = function(tap) {
      if (tap.button !== 0 || ! hoverPoint)
          return;

      editor.emit('camera:toggle', false);

      mouseTap = tap;
      dragPoint = hoverPoint;

      pickStart.copy(pickPlane(mouseTap.x, mouseTap.y));
      dragPoint.entity.enabled = false;

      editor.emit('gizmo:point:start', dragPoint);
      dragPoint.emit('dragStart');
      editor.call('viewport:pick:state', false);
  };

  var onTapMove = function(tap) {
      if (! dragPoint)
          return;

      mouseTap = tap;
  };

  var onTapEnd = function(tap) {
      if (tap.button !== 0)
          return;

      editor.emit('camera:toggle:true', true);

      if (! dragPoint)
          return;

      mouseTap = tap;

      dragPoint.entity.enabled = true;
      editor.emit('gizmo:point:end', dragPoint);
      dragPoint.emit('dragEnd');
      dragPoint = null;

      editor.call('viewport:pick:state', true);
  };

  editor.on('viewport:mouse:move', onTapMove);
  editor.on('viewport:tap:end', onTapEnd);

  editor.on('viewport:postUpdate', function(dt) {
      if (! dragPoint)
          return;

      var point = pickPlane(mouseTap.x, mouseTap.y);
      if (point) {
          vecA.copy(point).sub(pickStart);

          var length = vecA.length();
          if ((vecA[dragPoint.axis] < 0 && dragPoint.dir === 1) || (vecA[dragPoint.axis] > 0 && dragPoint.dir === -1))
              length *= -1;

          dragPoint.emit('dragMove', length);
      }

      editor.call('viewport:render');
  });
});


/* editor/gizmo/gizmo-translate.js */
editor.once('load', function() {
  'use strict';

  var gizmo = null;
  var visible = true;
  var moving = false;
  var mouseTap = null;
  var mouseTapMoved = false;
  var posCameraLast = new pc.Vec3();
  var visible = true;
  var enabled = false;
  var hover = false;
  var hoverAxis = '';
  var hoverPlane = false;
  var hoverEntity = null;
  var gizmoSize = .4;
  var arrowRadius = .4;
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();
  var vecD = new pc.Vec3();
  var vecE = new pc.Vec3();
  var quat = new pc.Quat();
  var matA = new pc.Mat4();
  var matB = new pc.Mat4();
  var evtTapStart;
  var pickStart = new pc.Vec3();
  var immediateRenderOptions;

  var snap = false;
  var snapIncrement = 1;
  editor.on('gizmo:snap', function(state, increment) {
      snap = state;
      snapIncrement = increment;
  });

  // enable/disable gizmo
  editor.method('gizmo:translate:toggle', function(state) {
      if (! gizmo)
          return;

      gizmo.root.enabled = state && editor.call('permissions:write');
      enabled = state;

      visible = true;
  });

  editor.on('permissions:writeState', function(state) {
      if (! gizmo)
          return;

      gizmo.root.enabled = enabled && state;
      editor.call('viewport:render');
  });

  // show/hide gizmo
  editor.method('gizmo:translate:visible', function(state) {
      if (! gizmo)
          return;

      visible = state;

      for(var i = 0; i < gizmo.hoverable.length; i++) {
          if (! gizmo.hoverable[i].model)
              continue;

          gizmo.hoverable[i].model.enabled = state;
      }

      editor.call('viewport:render');
  });

  // position gizmo
  editor.method('gizmo:translate:position', function(x, y, z) {
      if (x === undefined)
          return gizmo.root.getPosition();

      gizmo.root.setPosition(x, y, z);

      if (gizmo.root.enabled)
          editor.call('viewport:render');
  });

  // rotate gizmo
  editor.method('gizmo:translate:rotation', function(pitch, yaw, roll) {
      gizmo.root.setEulerAngles(pitch, yaw, roll);

      if (gizmo.root.enabled)
          editor.call('viewport:render');
  });

  // initialize gizmo
  editor.once('viewport:load', function() {
      var app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      gizmo = createEntity();
      gizmo.root.enabled = false;
      app.root.addChild(gizmo.root);

      if (!immediateRenderOptions) {
          immediateRenderOptions = {
              layer: editor.call('gizmo:layers', 'Axis Gizmo Immediate'),
              mask: GIZMO_MASK
          };
      }

      // on picker hover
      editor.on('viewport:pick:hover', function(node, picked) {
          var match = gizmo.hoverable.indexOf(node) !== -1;
          if (! hover && match) {
              // hover
              hover = true;
          } else if (hover && ! match) {
              // unhover
              hover = false;
          }

          if (hover) {
              hoverEntity = node;

              if (node.axis && (hoverAxis !== node.axis || hoverPlane !== node.plane)) {
                  // set normal material
                  if (hoverAxis) {
                      if (hoverPlane) {
                          gizmo.plane[hoverAxis].model.material = gizmo.plane[hoverAxis].mat;
                      } else {
                          gizmo.arrow[hoverAxis].model.material = gizmo.arrow[hoverAxis].mat;
                      }
                  }

                  if (! hoverAxis && ! evtTapStart)
                      evtTapStart = editor.on('viewport:tap:start', onTapStart);

                  hoverAxis = node.axis;
                  hoverPlane = node.plane;

                  // set active material
                  if (hoverPlane) {
                      gizmo.plane[hoverAxis].model.material = gizmo.matActiveTransparent;
                  } else {
                      gizmo.arrow[hoverAxis].model.material = gizmo.matActive;
                  }
              }
          } else {
              if (hoverAxis) {
                  if (hoverPlane) {
                      gizmo.plane[hoverAxis].model.material = gizmo.plane[hoverAxis].mat;
                  } else {
                      gizmo.arrow[hoverAxis].model.material = gizmo.arrow[hoverAxis].mat;
                  }
              }

              hoverAxis = '';

              if (evtTapStart) {
                  evtTapStart.unbind();
                  evtTapStart = null;
              }
          }
      });

      // update gizmo
      editor.on('viewport:postUpdate', function(dt) {
          if (gizmo.root.enabled) {
              var camera = editor.call('camera:current');
              var posCamera = camera.getPosition();

              quat.copy(gizmo.root.getRotation()).invert();

              if (moving && (vecA.copy(posCameraLast).sub(posCamera).length() > 0.01 || mouseTapMoved)) {
                  var point = pickPlane(mouseTap.x, mouseTap.y);
                  if (point) {
                      point.sub(pickStart);
                      if (snap) {
                          point.scale(1 / snapIncrement);
                          point.x = Math.round(point.x);
                          point.y = Math.round(point.y);
                          point.z = Math.round(point.z);
                          point.scale(snapIncrement);
                      }
                      editor.emit('gizmo:translate:offset', point.x, point.y, point.z);
                  }

                  editor.call('viewport:render');
              }

              editor.emit('gizmo:translate:render', dt);

              posCameraLast.copy(posCamera);

              var posGizmo = gizmo.root.getPosition();
              var scale = 1;

              // scale to screen space
              if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
                  var dot = vecA.copy(posGizmo).sub(posCamera).dot(camera.forward);
                  var denom = 1280 / (2 * Math.tan(camera.camera.fov * pc.math.DEG_TO_RAD / 2));
                  scale = Math.max(0.0001, (dot / denom) * 150) * gizmoSize;
              } else {
                  scale = camera.camera.orthoHeight / 3 * gizmoSize;
              }
              gizmo.root.setLocalScale(scale, scale, scale);

              // calculate viewing angle
              vecA
              .copy(posCamera)
              .sub(posGizmo)
              .normalize();

              // rotate vector by gizmo rotation
              quat.transformVector(vecA, vecA);

              // swap sides to face camera
              // x
              gizmo.plane.x.setLocalPosition(0, (vecA.y > 0) ? .4 : -.4, (vecA.z > 0) ? .4 : -.4);
              gizmo.line.x.setLocalPosition((vecA.x > 0) ? 1.5 : 1.1, 0, 0);
              gizmo.line.x.setLocalScale(arrowRadius, (vecA.x > 0) ? 1 : 1.8, arrowRadius);
              // y
              gizmo.plane.y.setLocalPosition((vecA.x > 0) ? .4 : -.4, 0, (vecA.z > 0) ? .4 : -.4);
              gizmo.line.y.setLocalPosition(0, (vecA.y > 0) ? 1.5 : 1.1, 0);
              gizmo.line.y.setLocalScale(arrowRadius, (vecA.y > 0) ? 1 : 1.8, arrowRadius);
              // z
              gizmo.plane.z.setLocalPosition((vecA.x > 0) ? .4 : -.4, (vecA.y > 0) ? .4 : -.4, 0);
              gizmo.line.z.setLocalPosition(0, 0, (vecA.z > 0) ? 1.5 : 1.1);
              gizmo.line.z.setLocalScale(arrowRadius, (vecA.z > 0) ? 1 : 1.8, arrowRadius);

              // hide plane if viewed from very angle
              gizmo.plane.x.model.enabled = Math.abs(vecA.x) > 0.15 && visible;
              gizmo.plane.y.model.enabled = Math.abs(vecA.y) > 0.15 && visible;
              gizmo.plane.z.model.enabled = Math.abs(vecA.z) > 0.15 && visible;

              quat.invert();

              // plane x lines
              if (gizmo.plane.x.model.enabled) {
                  vecB.set(0, 0, (vecA.z > 0) ? scale * .8 : -scale * .8);
                  vecC.set(0, (vecA.y > 0) ? scale * .8 : -scale * .8, (vecA.z > 0) ? scale * .8 : -scale * .8);
                  vecD.set(0, (vecA.y > 0) ? scale * .8 : -scale * .8, 0);
                  quat.transformVector(vecB, vecB).add(gizmo.root.getPosition());
                  quat.transformVector(vecC, vecC).add(gizmo.root.getPosition());
                  quat.transformVector(vecD, vecD).add(gizmo.root.getPosition());
                  var clr = (hoverAxis === 'x' && hoverPlane) ? gizmo.matActive.color : gizmo.arrow.x.mat.color;
                  app.renderLines([ vecB, vecC, vecC, vecD ], clr, immediateRenderOptions);
              }
              // plane y lines
              if (gizmo.plane.y.model.enabled) {
                  vecB.set((vecA.x > 0) ? scale * .8 : -scale * .8, 0, 0);
                  vecC.set((vecA.x > 0) ? scale * .8 : -scale * .8, 0, (vecA.z > 0) ? scale * .8 : -scale * .8);
                  vecD.set(0, 0, (vecA.z > 0) ? scale * .8 : -scale * .8);
                  quat.transformVector(vecB, vecB).add(gizmo.root.getPosition());
                  quat.transformVector(vecC, vecC).add(gizmo.root.getPosition());
                  quat.transformVector(vecD, vecD).add(gizmo.root.getPosition());
                  var clr = (hoverAxis === 'y' && hoverPlane) ? gizmo.matActive.color : gizmo.arrow.y.mat.color;
                  app.renderLines([ vecB, vecC, vecC, vecD ], clr, immediateRenderOptions);
              }
              // plane z lines
              if (gizmo.plane.z.model.enabled) {
                  vecB.set((vecA.x > 0) ? scale * .8 : -scale * .8, 0, 0);
                  vecC.set((vecA.x > 0) ? scale * .8 : -scale * .8, (vecA.y > 0) ? scale * .8 : -scale * .8, 0);
                  vecD.set(0, (vecA.y > 0) ? scale * .8 : -scale * .8, 0);
                  quat.transformVector(vecB, vecB).add(gizmo.root.getPosition());
                  quat.transformVector(vecC, vecC).add(gizmo.root.getPosition());
                  quat.transformVector(vecD, vecD).add(gizmo.root.getPosition());
                  var clr = (hoverAxis === 'z' && hoverPlane) ? gizmo.matActive.color : gizmo.arrow.z.mat.color;
                  app.renderLines([ vecB, vecC, vecC, vecD ], clr, immediateRenderOptions);
              }

              // hide lines and arrows if viewed from very angle
              gizmo.line.x.model.enabled = gizmo.arrow.x.model.enabled = ! (Math.abs(vecA.z) <= 0.15 && Math.abs(vecA.y) <= 0.15) && visible;
              gizmo.line.y.model.enabled = gizmo.arrow.y.model.enabled = ! (Math.abs(vecA.x) <= 0.15 && Math.abs(vecA.z) <= 0.15) && visible;
              gizmo.line.z.model.enabled = gizmo.arrow.z.model.enabled = ! (Math.abs(vecA.x) <= 0.15 && Math.abs(vecA.y) <= 0.15) && visible;

              // draw axes lines
              // line x
              if (gizmo.line.x.model.enabled) {
                  vecB.set(((vecA.x > 0) ? scale * 1 : scale * .2), 0, 0);
                  quat.transformVector(vecB, vecB).add(gizmo.root.getPosition());
                  vecC.set(scale * 2, 0, 0);
                  quat.transformVector(vecC, vecC).add(gizmo.root.getPosition());
                  app.renderLines([vecB, vecC], gizmo.arrow.x.model.material.color, immediateRenderOptions);
              }
              // line y
              if (gizmo.line.y.model.enabled) {
                  vecB.set(0, ((vecA.y > 0) ? scale * 1 : scale * .2), 0);
                  quat.transformVector(vecB, vecB).add(gizmo.root.getPosition());
                  vecC.set(0, scale * 2, 0);
                  quat.transformVector(vecC, vecC).add(gizmo.root.getPosition());
                  app.renderLine(vecB, vecC, gizmo.arrow.y.model.material.color, immediateRenderOptions);
              }
              // line z
              if (gizmo.line.z.model.enabled) {
                  vecB.set(0, 0, ((vecA.z > 0) ? scale * 1 : scale * .2));
                  quat.transformVector(vecB, vecB).add(gizmo.root.getPosition());
                  vecC.set(0, 0, scale * 2);
                  quat.transformVector(vecC, vecC).add(gizmo.root.getPosition());
                  app.renderLine(vecB, vecC, gizmo.arrow.z.model.material.color, immediateRenderOptions);
              }
          }

          mouseTapMoved = false
      });

      var pickPlane = function(x, y) {
          var camera = editor.call('camera:current');

          var mouseWPos = camera.camera.screenToWorld(x, y, 1);
          var posGizmo = gizmo.root.getPosition();
          var rayOrigin = vecA.copy(camera.getPosition());
          var rayDirection = vecB.set(0, 0, 0);
          var planeNormal = vecC.set(0, 0, 0);
          planeNormal[hoverAxis] = 1;

          if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
              rayDirection.copy(mouseWPos).sub(rayOrigin).normalize();
          } else {
              rayOrigin.add(mouseWPos);
              camera.getWorldTransform().transformVector(vecD.set(0, 0, -1), rayDirection);
          }

          // rotate vector by gizmo rotation
          quat.copy(gizmo.root.getRotation()).transformVector(planeNormal, planeNormal);

          // single axis
          if (! hoverPlane) {
              vecD.copy(rayOrigin).sub(posGizmo).normalize();
              planeNormal.copy(vecD.sub(planeNormal.scale(planeNormal.dot(vecD))).normalize());
          }

          var rayPlaneDot = planeNormal.dot(rayDirection);
          var planeDist = posGizmo.dot(planeNormal);
          var pointPlaneDist = (planeNormal.dot(rayOrigin) - planeDist) / rayPlaneDot;
          var pickedPos = rayDirection.scale(-pointPlaneDist).add(rayOrigin);

          if (! hoverPlane) {
              // single axis
              planeNormal.set(0, 0, 0);
              planeNormal[hoverAxis] = 1;
              quat.transformVector(planeNormal, planeNormal);
              pickedPos.copy(planeNormal.scale(planeNormal.dot(pickedPos)));
          }

          quat.invert().transformVector(pickedPos, pickedPos);

          if (! hoverPlane) {
              var v = pickedPos[hoverAxis];
              pickedPos.set(0, 0, 0);
              pickedPos[hoverAxis] = v;
          }

          return pickedPos;
      };

      var onTapStart = function(tap) {
          if (moving || tap.button !== 0)
              return;

          editor.emit('camera:toggle', false);
          editor.call('viewport:pick:state', false);

          moving = true;
          mouseTap = tap;

          if (gizmo.root.enabled)
              pickStart.copy(pickPlane(tap.x, tap.y));

          editor.emit('gizmo:translate:start', hoverAxis, hoverPlane);
          editor.call('gizmo:translate:visible', false);
      };

      var onTapMove = function(tap) {
          if (! moving)
              return;

          mouseTap = tap;
          mouseTapMoved = true;
      };

      var onTapEnd = function(tap) {
          if (tap.button !== 0)
              return;

          editor.emit('camera:toggle', true);

          if (! moving)
              return;

          moving = false;
          mouseTap = tap;

          editor.emit('gizmo:translate:end');
          editor.call('gizmo:translate:visible', true);
          editor.call('viewport:pick:state', true);
      };

      editor.on('viewport:tap:move', onTapMove);
      editor.on('viewport:tap:end', onTapEnd);
  });

  var createMaterial = function(color) {
      var mat = new pc.BasicMaterial();
      mat.color = color;
      if (color.a !== 1) {
          mat.blend = true;
          mat.blendSrc = pc.BLENDMODE_SRC_ALPHA;
          mat.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
      }
      mat.update();
      return mat;
  };

  var createEntity = function() {
      var obj = {
          root: null,
          plane: {
              x: null,
              y: null,
              z: null
          },
          line: {
              x: null,
              y: null,
              z: null
          },
          arrow: {
              x: null,
              y: null,
              z: null
          },
          hoverable: [ ],
          matActive: null,
          matActiveTransparent: null
      };

      // active mat
      obj.matActive = createMaterial(new pc.Color(1, 1, 1, 1));
      obj.matActiveTransparent = createMaterial(new pc.Color(1, 1, 1, .25));
      obj.matActiveTransparent.cull = pc.CULLFACE_NONE;

      // root entity
      var entity = obj.root = new pc.Entity();

      var gizmoLayer = editor.call('gizmo:layers', 'Axis Gizmo').id;

      // plane x
      var planeX = obj.plane.x = new pc.Entity();
      planeX.name = "planeX";
      obj.hoverable.push(planeX);
      planeX.axis = 'x';
      planeX.plane = true;
      planeX.addComponent('model', {
          type: 'plane',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      planeX.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(planeX);
      planeX.setLocalEulerAngles(90, -90, 0);
      planeX.setLocalScale(.8, .8, .8);
      planeX.setLocalPosition(0, .4, .4);
      planeX.mat = planeX.model.material = createMaterial(new pc.Color(1, 0, 0, .25));
      planeX.mat.cull = pc.CULLFACE_NONE;

      // plane y
      var planeY = obj.plane.y = new pc.Entity();
      planeY.name = "planeY";
      obj.hoverable.push(planeY);
      planeY.axis = 'y';
      planeY.plane = true;
      planeY.addComponent('model', {
          type: 'plane',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      planeY.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(planeY);
      planeY.setLocalEulerAngles(0, 0, 0);
      planeY.setLocalScale(.8, .8, .8);
      planeY.setLocalPosition(-.4, 0, .4);
      planeY.mat = planeY.model.material = createMaterial(new pc.Color(0, 1, 0, .25));
      planeY.mat.cull = pc.CULLFACE_NONE;

      // plane z
      var planeZ = obj.plane.z = new pc.Entity();
      planeZ.name = "planeZ";
      obj.hoverable.push(planeZ);
      planeZ.axis = 'z';
      planeZ.plane = true;
      planeZ.addComponent('model', {
          type: 'plane',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      planeZ.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(planeZ);
      planeZ.setLocalEulerAngles(90, 0, 0);
      planeZ.setLocalScale(.8, .8, .8);
      planeZ.setLocalPosition(-.4, .4, 0);
      planeZ.mat = planeZ.model.material = createMaterial(new pc.Color(0, 0, 1, .25));
      planeZ.mat.cull = pc.CULLFACE_NONE;

      // line x
      var lineX = obj.line.x = new pc.Entity();
      lineX.name = "lineX";
      obj.hoverable.push(lineX);
      lineX.axis = 'x';
      lineX.addComponent('model', {
          type: 'cylinder',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      lineX.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(lineX);
      lineX.setLocalEulerAngles(90, 90, 0);
      lineX.setLocalPosition(1.6, 0, 0);
      lineX.setLocalScale(arrowRadius, .8, arrowRadius);
      lineX.mat = lineX.model.material = createMaterial(new pc.Color(1, 0, 0, 0));

      // line y
      var lineY = obj.line.y = new pc.Entity();
      lineY.name = "lineY";
      obj.hoverable.push(lineY);
      lineY.axis = 'y';
      lineY.addComponent('model', {
          type: 'cylinder',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      lineY.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(lineY);
      lineY.setLocalEulerAngles(0, 0, 0);
      lineY.setLocalPosition(0, 1.6, 0);
      lineY.setLocalScale(arrowRadius, .8, arrowRadius);
      lineY.mat = lineY.model.material = createMaterial(new pc.Color(0, 1, 0, 0));

      // line z
      var lineZ = obj.line.z = new pc.Entity();
      lineZ.name = "lineZ";
      obj.hoverable.push(lineZ);
      lineZ.axis = 'z';
      lineZ.addComponent('model', {
          type: 'cylinder',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      lineZ.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(lineZ);
      lineZ.setLocalEulerAngles(90, 0, 0);
      lineZ.setLocalPosition(0, 0, 1.6);
      lineZ.setLocalScale(arrowRadius, .8, arrowRadius);
      lineZ.mat = lineZ.model.material = createMaterial(new pc.Color(0, 0, 1, 0));

      // arrow x
      var arrowX = obj.arrow.x = new pc.Entity();
      arrowX.name = "arrowX";
      obj.hoverable.push(arrowX);
      arrowX.axis = 'x';
      arrowX.addComponent('model', {
          type: 'cone',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      arrowX.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(arrowX);
      arrowX.setLocalEulerAngles(90, 90, 0);
      arrowX.setLocalPosition(2.3, 0, 0);
      arrowX.setLocalScale(arrowRadius, .6, arrowRadius);
      arrowX.mat = arrowX.model.material = createMaterial(new pc.Color(1, 0, 0, 1));

      // arrow y
      var arrowY = obj.arrow.y = new pc.Entity();
      arrowY.name = "arrowY";
      obj.hoverable.push(arrowY);
      arrowY.axis = 'y';
      arrowY.addComponent('model', {
          type: 'cone',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      arrowY.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(arrowY);
      arrowY.setLocalEulerAngles(0, 0, 0);
      arrowY.setLocalPosition(0, 2.3, 0);
      arrowY.setLocalScale(arrowRadius, .6, arrowRadius);
      arrowY.mat = arrowY.model.material = createMaterial(new pc.Color(0, 1, 0, 1));

      // arrow z
      var arrowZ = obj.arrow.z = new pc.Entity();
      arrowZ.name = "arrowZ";
      obj.hoverable.push(arrowZ);
      arrowZ.axis = 'z';
      arrowZ.addComponent('model', {
          type: 'cone',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      arrowZ.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(arrowZ);
      arrowZ.setLocalEulerAngles(90, 0, 0);
      arrowZ.setLocalPosition(0, 0, 2.3);
      arrowZ.setLocalScale(arrowRadius, .6, arrowRadius);
      arrowZ.mat = arrowZ.model.material = createMaterial(new pc.Color(0, 0, 1, 1));

      return obj;
  };
});


/* editor/gizmo/gizmo-scale.js */
editor.once('load', function() {
  'use strict';

  var gizmo = null;
  var visible = true;
  var moving = false;
  var mouseTap = null;
  var visible = true;
  var enabled = false;
  var hover = false;
  var hoverAxis = '';
  var hoverMiddle = false;
  var hoverEntity = null;
  var gizmoSize = .4;
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();
  var vecD = new pc.Vec3();
  var vecE = new pc.Vec3();
  var quat = new pc.Quat();
  var evtTapStart;
  var pickStart = new pc.Vec3();
  var immediateRenderOptions;

  var snap = false;
  var snapIncrement = 1;
  editor.on('gizmo:snap', function(state, increment) {
      snap = state;
      snapIncrement = increment;
  });

  // enable/disable gizmo
  editor.method('gizmo:scale:toggle', function(state) {
      if (! gizmo)
          return;

      gizmo.root.enabled = state && editor.call('permissions:write');
      enabled = state;

      visible = true;
  });

  editor.on('permissions:writeState', function(state) {
      if (! gizmo)
          return;

      gizmo.root.enabled = enabled && state;
      editor.call('viewport:render');
  });

  // show/hide gizmo
  editor.method('gizmo:scale:visible', function(state) {
      if (! gizmo)
          return;

      visible = state;

      for(var i = 0; i < gizmo.hoverable.length; i++) {
          if (! gizmo.hoverable[i].model)
              continue;

          gizmo.hoverable[i].model.enabled = state;
      }

      editor.call('viewport:render');
  });

  // position gizmo
  editor.method('gizmo:scale:position', function(x, y, z) {
      gizmo.root.setPosition(x, y, z);

      if (gizmo.root.enabled)
          editor.call('viewport:render');
  });

  // rotate gizmo
  editor.method('gizmo:scale:rotation', function(pitch, yaw, roll) {
      gizmo.root.setEulerAngles(pitch, yaw, roll);

      if (gizmo.root.enabled)
          editor.call('viewport:render');
  });

  // initialize gizmo
  editor.once('viewport:load', function() {
      var app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      immediateRenderOptions = {
          layer: editor.call('gizmo:layers', 'Axis Gizmo Immediate'),
          depthTest: true
      };

      gizmo = createEntity();
      gizmo.root.enabled = false;
      app.root.addChild(gizmo.root);

      // on picker hover
      editor.on('viewport:pick:hover', function(node, picked) {
          var match = gizmo.hoverable.indexOf(node) !== -1;
          if (! hover && match) {
              // hover
              hover = true;
          } else if (hover && ! match) {
              // unhover
              hover = false;
          }

          if (hover) {
              hoverEntity = node;

              if (node.axis && hoverAxis !== node.axis) {
                  // set normal material
                  if (hoverAxis) {
                      if (hoverMiddle) {
                          gizmo.box['x'].model.material = gizmo.box['x'].mat;
                          gizmo.box['y'].model.material = gizmo.box['y'].mat;
                          gizmo.box['z'].model.material = gizmo.box['z'].mat;
                      } else {
                          gizmo.box[hoverAxis].model.material = gizmo.box[hoverAxis].mat;
                      }
                  }

                  if (! hoverAxis && ! evtTapStart)
                      evtTapStart = editor.on('viewport:tap:start', onTapStart);

                  hoverAxis = node.axis;
                  hoverMiddle = node.middle;

                  // set active material
                  if (hoverMiddle) {
                      gizmo.box['x'].model.material = gizmo.matActive;
                      gizmo.box['y'].model.material = gizmo.matActive;
                      gizmo.box['z'].model.material = gizmo.matActive;
                  } else {
                      gizmo.box[hoverAxis].model.material = gizmo.matActive;
                  }
              }
          } else {
              if (hoverAxis) {
                  if (hoverMiddle) {
                      gizmo.box['x'].model.material = gizmo.box['x'].mat;
                      gizmo.box['y'].model.material = gizmo.box['y'].mat;
                      gizmo.box['z'].model.material = gizmo.box['z'].mat;
                  } else {
                      gizmo.box[hoverAxis].model.material = gizmo.box[hoverAxis].mat;
                  }
              }

              hoverAxis = '';

              if (evtTapStart) {
                  evtTapStart.unbind();
                  evtTapStart = null;
              }
          }
      });

      // update gizmo
      editor.on('viewport:postUpdate', function(dt) {
          if (gizmo.root.enabled) {
              editor.emit('gizmo:scale:render', dt);

              if (moving) {
                  var point = pickPlane(mouseTap.x, mouseTap.y);
                  if (point) {
                      point.sub(pickStart);
                      if (snap) {
                          point.scale(1 / snapIncrement);
                          point.x = Math.round(point.x);
                          point.y = Math.round(point.y);
                          point.z = Math.round(point.z);
                          point.scale(snapIncrement);
                      }
                      editor.emit('gizmo:scale:offset', point.x, point.y, point.z);
                  }

                  editor.call('viewport:render');
              }

              var camera = editor.call('camera:current');

              var posCamera = camera.getPosition();
              var posGizmo = gizmo.root.getPosition();
              var scale = 1;

              // scale to screen space
              if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
                  var dot = vecA.copy(posGizmo).sub(posCamera).dot(camera.forward);
                  var denom = 1280 / (2 * Math.tan(camera.camera.fov * pc.math.DEG_TO_RAD / 2));
                  scale = Math.max(0.0001, (dot / denom) * 150) * gizmoSize;
              } else {
                  scale = camera.camera.orthoHeight / 3 * gizmoSize;
              }
              gizmo.root.setLocalScale(scale, scale, scale);

              // calculate viewing angle
              vecA
              .copy(posCamera)
              .sub(posGizmo)
              .normalize();

              // rotate vector by gizmo rotation
              quat
              .copy(gizmo.root.getRotation())
              .invert()
              .transformVector(vecA, vecA);

              quat.invert();

              // hide lines and boxes if viewed from very angle
              gizmo.line.x.model.enabled = gizmo.box.x.model.enabled = ! (Math.abs(vecA.z) <= 0.15 && Math.abs(vecA.y) <= 0.15) && visible;
              gizmo.line.y.model.enabled = gizmo.box.y.model.enabled = ! (Math.abs(vecA.x) <= 0.15 && Math.abs(vecA.z) <= 0.15) && visible;
              gizmo.line.z.model.enabled = gizmo.box.z.model.enabled = ! (Math.abs(vecA.x) <= 0.15 && Math.abs(vecA.y) <= 0.15) && visible;

              // draw axes lines
              // line x
              if (gizmo.line.x.model.enabled) {
                  vecB.set(scale * .5, 0, 0);
                  quat.transformVector(vecB, vecB).add(posGizmo);
                  vecC.set(scale * 2, 0, 0);
                  quat.transformVector(vecC, vecC).add(posGizmo);
                  app.renderLine(vecB, vecC, gizmo.box.x.model.material === gizmo.matActive ? gizmo.matActive.color : gizmo.box.x.color, immediateRenderOptions);
              }
              // line y
              if (gizmo.line.y.model.enabled) {
                  vecB.set(0, scale * .5, 0);
                  quat.transformVector(vecB, vecB).add(posGizmo);
                  vecC.set(0, scale * 2, 0);
                  quat.transformVector(vecC, vecC).add(posGizmo);
                  app.renderLine(vecB, vecC, gizmo.box.y.model.material === gizmo.matActive ? gizmo.matActive.color : gizmo.box.y.color, immediateRenderOptions);
              }
              // line z
              if (gizmo.line.z.model.enabled) {
                  vecB.set(0, 0, scale * .5);
                  quat.transformVector(vecB, vecB).add(posGizmo);
                  vecC.set(0, 0, scale * 2);
                  quat.transformVector(vecC, vecC).add(posGizmo);
                  app.renderLine(vecB, vecC, gizmo.box.z.model.material === gizmo.matActive ? gizmo.matActive.color : gizmo.box.z.color, immediateRenderOptions);
              }
          }
      });

      var pickPlane = function(x, y) {
          var camera = editor.call('camera:current');
          var scale = 1;
          var mouseWPos = camera.camera.screenToWorld(x, y, 1);
          var posGizmo = gizmo.root.getPosition();
          var rayOrigin = vecA.copy(camera.getPosition());
          var rayDirection = vecB;
          var planeNormal = vecC;

          if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
              rayDirection.copy(mouseWPos).sub(rayOrigin).normalize();
              var dot = vecC.copy(posGizmo).sub(rayOrigin).dot(camera.forward);
              var denom = 1280 * Math.tan(camera.camera.fov * pc.math.DEG_TO_RAD);
              scale = Math.max(0.0001, (dot / denom) * 150) * gizmoSize;
          } else {
              rayOrigin.add(mouseWPos);
              camera.getWorldTransform().transformVector(vecD.set(0, 0, -1), rayDirection);
              scale = camera.camera.orthoHeight / 3 * gizmoSize;
          }

          quat.copy(gizmo.root.getRotation());

          // single axis
          if (! hoverMiddle) {
              // vector based on selected axis
              planeNormal.set(0, 0, 0);
              planeNormal[hoverAxis] = 1;
              // rotate vector by gizmo rotation
              quat.transformVector(planeNormal, planeNormal);

              vecE.copy(rayOrigin).sub(posGizmo).normalize();
              planeNormal.copy(vecE.sub(planeNormal.scale(planeNormal.dot(vecE))).normalize());
          } else {
              planeNormal.copy(rayOrigin).sub(posGizmo).normalize();
          }

          var rayPlaneDot = planeNormal.dot(rayDirection);
          var planeDist = posGizmo.dot(planeNormal);
          var pointPlaneDist = (planeNormal.dot(rayOrigin) - planeDist) / rayPlaneDot;
          var pickedPos = rayDirection.scale(-pointPlaneDist).add(rayOrigin);

          if (! hoverMiddle) {
              // single axis
              planeNormal.set(0, 0, 0);
              planeNormal[hoverAxis] = 1;
              quat.transformVector(planeNormal, planeNormal);
              pickedPos.copy(planeNormal.scale(planeNormal.dot(pickedPos)));
              quat.invert().transformVector(pickedPos, pickedPos);

              // calculate viewing angle
              vecE.copy(rayOrigin).sub(posGizmo).normalize();
              quat.transformVector(vecE, vecE);

              var v = pickedPos[hoverAxis];
              pickedPos.set(0, 0, 0);
              pickedPos[hoverAxis] = v / scale;
          } else {
              vecE.copy(pickedPos).sub(posGizmo).normalize();
              vecD.copy(camera.up).add(camera.right).normalize();

              var v = (pickedPos.sub(posGizmo).length() / scale / 2)  * vecE.dot(vecD);
              pickedPos.set(v, v, v);
          }

          return pickedPos;
      };

      var onTapStart = function(tap) {
          if (tap.button !== 0)
              return;

          editor.emit('camera:toggle', false);

          moving = true;
          mouseTap = tap;

          if (gizmo.root.enabled) {
              pickStart.copy(pickPlane(tap.x, tap.y));
              pickStart.x -= 1;
              pickStart.y -= 1;
              pickStart.z -= 1;
          }

          editor.emit('gizmo:scale:start', hoverAxis, hoverMiddle);
          editor.call('gizmo:scale:visible', false);
          editor.call('viewport:pick:state', false);
      };

      var onTapMove = function(tap) {
          if (! moving)
              return;

          mouseTap = tap;
      };

      var onTapEnd = function(tap) {
          if (tap.button !== 0)
              return;

          editor.emit('camera:toggle', true);

          if (! moving)
              return;

          moving = false;
          mouseTap = tap;

          editor.emit('gizmo:scale:end');
          editor.call('gizmo:scale:visible', true);
          editor.call('viewport:pick:state', true);
      };

      editor.on('viewport:mouse:move', onTapMove);
      editor.on('viewport:tap:end', onTapEnd);
  });

  var createMaterial = function(color) {
      var mat = new pc.BasicMaterial();
      mat.color = color;
      if (color.a !== 1) {
          mat.blend = true;
          mat.blendSrc = pc.BLENDMODE_SRC_ALPHA;
          mat.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
      }
      mat.cull = pc.CULLFACE_NONE;
      mat.update();
      return mat;
  };

  var createEntity = function() {
      var boxSize = .4;

      var obj = {
          root: null,
          middle: null,
          line: {
              x: null,
              y: null,
              z: null
          },
          box: {
              x: null,
              y: null,
              z: null
          },
          hoverable: [ ],
          matActive: null,
          matActiveTransparent: null
      };

      // active mat
      obj.matActive = createMaterial(new pc.Color(1, 1, 1, 0.9)); // this has to be transparent otherwise it flickers when you hover over it
      obj.matActiveTransparent = createMaterial(new pc.Color(1, 1, 1, .25));
      obj.colorLineBehind = new pc.Color(1, 1, 1, 0.05);
      obj.colorLine = new pc.Color(1, 1, 1, .2);
      obj.colorLineActive = new pc.Color(1, 1, 1, 1);

      var layer = editor.call('gizmo:layers', 'Axis Gizmo').id;

      // root entity
      var entity = obj.root = new pc.Entity();

      // middle
      var middle = obj.middle = new pc.Entity();
      obj.hoverable.push(middle);
      middle.axis = 'xyz';
      middle.middle = true;
      middle.addComponent('model', {
          type: 'box',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layer]
      });
      middle.model.model.meshInstances[0].mask = GIZMO_MASK;
      middle.model.material.id = 0xFFFFFFFF;
      entity.addChild(middle);
      middle.setLocalScale(boxSize * 1.5, boxSize * 1.5, boxSize * 1.5);
      middle.mat = middle.model.material = createMaterial(new pc.Color(1.0, 1.0, 1.0, 0.25));
      middle.mat.depthTest = false;

      // line x
      var lineX = obj.line.x = new pc.Entity();
      obj.hoverable.push(lineX);
      lineX.axis = 'x';
      lineX.addComponent('model', {
          type: 'cylinder',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layer]
      });
      entity.addChild(lineX);
      lineX.setLocalEulerAngles(90, 90, 0);
      lineX.setLocalPosition(1.25, 0, 0);
      lineX.setLocalScale(boxSize, 1.5, boxSize);
      lineX.mat = lineX.model.material = createMaterial(new pc.Color(1, 0, 0, 0));

      // line y
      var lineY = obj.line.y = new pc.Entity();
      obj.hoverable.push(lineY);
      lineY.axis = 'y';
      lineY.addComponent('model', {
          type: 'cylinder',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layer]
      });
      entity.addChild(lineY);
      lineY.setLocalEulerAngles(0, 0, 0);
      lineY.setLocalPosition(0, 1.25, 0);
      lineY.setLocalScale(boxSize, 1.5, boxSize);
      lineY.mat = lineY.model.material = createMaterial(new pc.Color(0, 1, 0, 0));

      // line z
      var lineZ = obj.line.z = new pc.Entity();
      obj.hoverable.push(lineZ);
      lineZ.axis = 'z';
      lineZ.addComponent('model', {
          type: 'cylinder',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layer]
      });
      entity.addChild(lineZ);
      lineZ.setLocalEulerAngles(90, 0, 0);
      lineZ.setLocalPosition(0, 0, 1.25);
      lineZ.setLocalScale(boxSize, 1.5, boxSize);
      lineZ.mat = lineZ.model.material = createMaterial(new pc.Color(0, 0, 1, 0));

      // box x
      var boxX = obj.box.x = new pc.Entity();
      obj.hoverable.push(boxX);
      boxX.axis = 'x';
      boxX.addComponent('model', {
          type: 'box',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layer]
      });
      boxX.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(boxX);
      boxX.setLocalPosition(2.2, 0, 0);
      boxX.setLocalScale(boxSize, boxSize, boxSize);
      boxX.mat = boxX.model.material = createMaterial(new pc.Color(1, 0, 0, 1.1));
      boxX.color = new pc.Color(1, 0, 0, 1);

      // box y
      var boxY = obj.box.y = new pc.Entity();
      obj.hoverable.push(boxY);
      boxY.axis = 'y';
      boxY.addComponent('model', {
          type: 'box',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layer]
      });
      boxY.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(boxY);
      boxY.setLocalPosition(0, 2.2, 0);
      boxY.setLocalScale(boxSize, boxSize, boxSize);
      boxY.mat = boxY.model.material = createMaterial(new pc.Color(0, 1, 0, 1.1));
      boxY.color = new pc.Color(0, 1, 0, 1);

      // box z
      var boxZ = obj.box.z = new pc.Entity();
      obj.hoverable.push(boxZ);
      boxZ.axis = 'z';
      boxZ.addComponent('model', {
          type: 'box',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layer]
      });
      boxZ.model.model.meshInstances[0].mask = GIZMO_MASK;
      entity.addChild(boxZ);
      boxZ.setLocalPosition(0, 0, 2.2);
      boxZ.setLocalScale(boxSize, boxSize, boxSize);
      boxZ.mat = boxZ.model.material = createMaterial(new pc.Color(0, 0, 1, 1.1));
      boxZ.color = new pc.Color(0, 0, 1, 1);

      return obj;
  };
});


/* editor/gizmo/gizmo-rotate.js */
editor.once('load', function() {
  'use strict';

  var gizmo = null;
  var visible = true;
  var moving = false;
  var mouseTap = null;
  var mouseTapMoved = false;
  var posCameraLast = new pc.Vec3();
  var visible = true;
  var enabled = false;
  var hover = false;
  var hoverAxis = '';
  var hoverEntity = null;
  var gizmoSize = .4;
  var arrowRadius = .4;
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();
  var vecD = new pc.Vec3();
  var quat = new pc.Quat();
  var evtTapStart;
  var angleStart = 0;
  var startRotation = new pc.Quat();

  var immediateRenderOptions;
  var noDepthImmediateRenderOptions

  var snap = false;
  var snapIncrement = 5;
  editor.on('gizmo:snap', function(state, increment) {
      snap = state;
      snapIncrement = increment * 5;
  });

  // enable/disable gizmo
  editor.method('gizmo:rotate:toggle', function(state) {
      if (! gizmo)
          return;

      gizmo.root.enabled = state && editor.call('permissions:write');
      enabled = state;

      visible = true;

      editor.call('viewport:render');
  });

  editor.on('permissions:writeState', function(state) {
      if (! gizmo)
          return;

      gizmo.root.enabled = enabled && state;
      editor.call('viewport:render');
  });

  // show/hide gizmo
  editor.method('gizmo:rotate:visible', function(state) {
      if (! gizmo)
          return;

      visible = state;

      for(var i = 0; i < gizmo.hoverable.length; i++) {
          if (! gizmo.hoverable[i].model)
              continue;

          gizmo.hoverable[i].model.enabled = state;
      }

      editor.call('viewport:render');
  });

  // position gizmo
  editor.method('gizmo:rotate:position', function(x, y, z) {
      if (x === undefined)
          return gizmo.root.getPosition();

      gizmo.root.setPosition(x, y, z);

      if (gizmo.root.enabled)
          editor.call('viewport:render');
  });

  // rotate gizmo
  editor.method('gizmo:rotate:rotation', function(pitch, yaw, roll) {
      gizmo.root.setEulerAngles(pitch, yaw, roll);

      if (gizmo.root.enabled)
          editor.call('viewport:render');
  });

  // initialize gizmo
  editor.once('viewport:load', function() {
      var app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      gizmo = createEntity(app);
      gizmo.root.enabled = false;
      app.root.addChild(gizmo.root);

      immediateRenderOptions = {
          layer: editor.call('gizmo:layers', 'Axis Gizmo Immediate'),
          mask: GIZMO_MASK
      };

      noDepthImmediateRenderOptions = {
          layer: editor.call('gizmo:layers', 'Axis Rotate Gizmo Immediate'),
          depthTest: false,
          mask: GIZMO_MASK
      };

      // on picker hover
      editor.on('viewport:pick:hover', function(node, picked) {
          var match = gizmo.hoverable.indexOf(node) !== -1;
          if (! hover && match) {
              // hover
              hover = true;
          } else if (hover && ! match) {
              // unhover
              hover = false;
          }

          if (hover) {
              hoverEntity = node;

              if (node.axis && hoverAxis !== node.axis) {
                  // set normal material
                  if (hoverAxis)
                      gizmo.line[hoverAxis].material = gizmo.line[hoverAxis].mat;

                  if (! hoverAxis && ! evtTapStart)
                      evtTapStart = editor.on('viewport:tap:start', onTapStart);

                  hoverAxis = node.axis;

                  // set active material
                  gizmo.line[hoverAxis].material = gizmo.matActive;
              }
          } else {
              if (hoverAxis) {
                  gizmo.line[hoverAxis].material = gizmo.line[hoverAxis].mat;
              }

              hoverAxis = '';

              if (evtTapStart) {
                  evtTapStart.unbind();
                  evtTapStart = null;
              }
          }
      });

      var lastPoint = new pc.Vec3();

      // update gizmo
      editor.on('viewport:postUpdate', function(dt) {
          if (gizmo.root.enabled) {
              var camera = editor.call('camera:current');
              var posCamera = camera.getPosition();

              if (moving && (vecA.copy(posCameraLast).sub(posCamera).length() > 0.01 || mouseTapMoved)) {
                  var data = pickPlane(mouseTap.x, mouseTap.y);
                  lastPoint.copy(data.point);

                  if (snap) {
                      data.angle = Math.round((data.angle - angleStart) / snapIncrement) * snapIncrement;
                  } else {
                      data.angle -= angleStart;
                  }

                  editor.emit('gizmo:rotate:offset', data.angle, data.point);

                  editor.call('viewport:render');
              }

              var posGizmo = gizmo.root.getPosition();
              var scale = 1;

              // scale to screen space
              if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
                  var dot = vecA.copy(posGizmo).sub(posCamera).dot(camera.forward);
                  var denom = 1280 / (2 * Math.tan(camera.camera.fov * pc.math.DEG_TO_RAD / 2));
                  scale = Math.max(0.0001, (dot / denom) * 150) * gizmoSize;
              } else {
                  scale = camera.camera.orthoHeight / 3 * gizmoSize;
              }
              gizmo.root.setLocalScale(scale, scale, scale);

              if (moving && lastPoint) {
                  vecC.copy(lastPoint).normalize().scale(2 * scale);
                  quat.copy(startRotation).transformVector(vecC, vecC);
                  // quat.invert().transformVector(vecC, vecC);
                  vecC.add(posGizmo);

                  app.renderLine(posGizmo, vecC, gizmo.colorActive, noDepthImmediateRenderOptions);
              }

              editor.emit('gizmo:rotate:render', dt);

              posCameraLast.copy(posCamera);

              // posGizmo = gizmo.root.getPosition();

              // calculate viewing angle
              vecA
              .copy(posCamera)
              .sub(posGizmo)
              .normalize();

              // rotate vector by gizmo rotation
              quat
              .copy(gizmo.root.getRotation())
              .invert()
              .transformVector(vecA, vecA);

              // hide plane if viewed from very angle
              gizmo.plane.x.model.enabled = Math.abs(vecA.x) > 0.1 && visible;
              gizmo.plane.y.model.enabled = Math.abs(vecA.y) > 0.1 && visible;
              gizmo.plane.z.model.enabled = Math.abs(vecA.z) > 0.1 && visible;

              var worldTransform = gizmo.root.getWorldTransform();

              // draw cull sphere
              gizmo.line.cull.node.worldTransform = worldTransform;
              app.renderMeshInstance(gizmo.line.cull, immediateRenderOptions);

              // render lines
              // x
              if (moving && hoverAxis === 'x') {
                  // behind line
                  app.renderMesh(gizmo.line.x.mesh, gizmo.matBehindActive, worldTransform, immediateRenderOptions);
              } else {
                  // behind line
                  app.renderMesh(gizmo.line.x.mesh, gizmo.matBehindHover.x, worldTransform, immediateRenderOptions);
                  // front line
                  if (! moving && gizmo.plane.x.model.enabled) {
                      gizmo.line.x.node.worldTransform = worldTransform;
                      app.renderMeshInstance(gizmo.line.x, immediateRenderOptions);
                  }
              }

              // y
              if (moving && hoverAxis === 'y') {
                  // behind line
                  app.renderMesh(gizmo.line.y.mesh, gizmo.matBehindActive, worldTransform, immediateRenderOptions);
              } else {
                  // behind line
                  app.renderMesh(gizmo.line.y.mesh, gizmo.matBehindHover.y, worldTransform, immediateRenderOptions);
                  // front line
                  if (! moving && gizmo.plane.y.model.enabled) {
                      gizmo.line.y.node.worldTransform = worldTransform;
                      app.renderMeshInstance(gizmo.line.y, immediateRenderOptions);
                  }
              }
              // z
              if (moving && hoverAxis === 'z') {
                  // behind line
                  app.renderMesh(gizmo.line.z.mesh, gizmo.matBehindActive, worldTransform, immediateRenderOptions);
              } else {
                  // behind line
                  app.renderMesh(gizmo.line.z.mesh, gizmo.matBehindHover.z, worldTransform, immediateRenderOptions);
                  // front line
                  if (! moving && gizmo.plane.z.model.enabled) {
                      gizmo.line.z.node.worldTransform = worldTransform;
                      app.renderMeshInstance(gizmo.line.z, immediateRenderOptions);
                  }
              }


          }

          mouseTapMoved = false
      });

      var pickPlane = function(x, y) {
          var camera = editor.call('camera:current');

          var mouseWPos = camera.camera.screenToWorld(x, y, 1);
          var posGizmo = gizmo.root.getPosition();
          var rayOrigin = vecA.copy(camera.getPosition());
          var rayDirection = vecB;
          var planeNormal = vecC.set(0, 0, 0);
          planeNormal[hoverAxis] = 1;

          // rotate plane to local space
          quat.copy(startRotation).transformVector(planeNormal, planeNormal);

          // ray from camera
          if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
              rayDirection.copy(mouseWPos).sub(rayOrigin).normalize();
          } else {
              rayOrigin.copy(mouseWPos);
              camera.getWorldTransform().transformVector(vecD.set(0, 0, -1), rayDirection);
          }

          // pick the plane
          var rayPlaneDot = planeNormal.dot(rayDirection);
          var planeDist = posGizmo.dot(planeNormal);
          var pointPlaneDist = (planeNormal.dot(rayOrigin) - planeDist) / rayPlaneDot;
          var pickedPos = rayDirection.scale(-pointPlaneDist).add(rayOrigin).sub(posGizmo);

          // rotate vector to world space
          quat.invert().transformVector(pickedPos, pickedPos);

          var angle = 0;
          if (hoverAxis === 'x') {
              angle = Math.atan2(pickedPos.z, pickedPos.y) / (Math.PI / 180);
          } else if (hoverAxis === 'y') {
              angle = Math.atan2(pickedPos.x, pickedPos.z) / (Math.PI / 180);
          } else if (hoverAxis === 'z') {
              angle = Math.atan2(pickedPos.y, pickedPos.x) / (Math.PI / 180);
          }

          return {
              angle: angle,
              point: pickedPos
          };
      };

      var onTapStart = function(tap) {
          if (moving || tap.button !== 0)
              return;

          editor.emit('camera:toggle', false);

          moving = true;
          mouseTap = tap;
          mouseTapMoved = true;

          if (gizmo.root.enabled) {
              startRotation.copy(gizmo.root.getRotation());
              var data = pickPlane(tap.x, tap.y);
              angleStart = data.angle;
          }

          editor.emit('gizmo:rotate:start', hoverAxis);
          editor.call('viewport:pick:state', false);
      };

      var onTapMove = function(tap) {
          if (! moving)
              return;

          mouseTap = tap;
          mouseTapMoved = true;
      };

      var onTapEnd = function(tap) {
          if (tap.button !== 0)
              return;

          editor.emit('camera:toggle', true);

          if (! moving)
              return;

          moving = false;
          mouseTap = tap;

          editor.emit('gizmo:rotate:end');
          editor.call('viewport:pick:state', true);
      };

      editor.on('viewport:mouse:move', onTapMove);
      editor.on('viewport:tap:end', onTapEnd);
  });

  var createMaterial = function(color) {
      var mat = new pc.BasicMaterial();
      mat.color = color;
      if (color.a !== 1) {
          mat.blend = true;
          mat.blendSrc = pc.BLENDMODE_SRC_ALPHA;
          mat.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
      }
      mat.update();
      return mat;
  };

  var createEntity = function(app) {
      var obj = {
          root: null,
          sphere: null,
          plane: {
              x: null,
              y: null,
              z: null
          },
          line: {
              x: null,
              y: null,
              z: null,
              cull: null
          },
          hoverable: [ ],
          matActive: null,
          matBehind: null,
          matBehindHover: { },
          matBehindActive: null
      };

      // materials
      obj.matBehind = createMaterial(new pc.Color(1, 1, 1, .1));
      obj.matBehind.depthTest = false;
      obj.matBehindHover.x = createMaterial(new pc.Color(1, 0, 0, .2));
      obj.matBehindHover.y = createMaterial(new pc.Color(0, 1, 0, .2));
      obj.matBehindHover.z = createMaterial(new pc.Color(0, 0, 1, .2));
      obj.matBehindHover.x.depthTest = false;
      obj.matBehindHover.y.depthTest = false;
      obj.matBehindHover.z.depthTest = false;
      obj.matBehindActive = createMaterial(new pc.Color(1, 1, 1, 1.1));
      obj.matBehindActive.depthTest = false;
      obj.colorActive = new pc.Color(1, 1, 1, 1);

      var gizmoLayer = editor.call('gizmo:layers', 'Axis Gizmo').id;

      // root entity
      var entity = obj.root = new pc.Entity();

      // plane x
      var planeX = obj.plane.x = new pc.Entity();
      obj.hoverable.push(planeX);
      planeX.axis = 'x';
      planeX.plane = true;
      planeX.addComponent('model', {
          type: 'cylinder',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      entity.addChild(planeX);
      planeX.setLocalEulerAngles(90, -90, 0);
      planeX.setLocalScale(4.1, 0.3, 4.1);
      planeX.mat = planeX.model.material = createMaterial(new pc.Color(1, 0, 0, 0));

      // plane y
      var planeY = obj.plane.y = new pc.Entity();
      obj.hoverable.push(planeY);
      planeY.axis = 'y';
      planeY.plane = true;
      planeY.addComponent('model', {
          type: 'cylinder',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      entity.addChild(planeY);
      planeY.setLocalEulerAngles(0, 0, 0);
      planeY.setLocalScale(4.2, 0.3, 4.2);
      planeY.mat = planeY.model.material = createMaterial(new pc.Color(0, 1, 0, 0));

      // plane z
      var planeZ = obj.plane.z = new pc.Entity();
      obj.hoverable.push(planeZ);
      planeZ.axis = 'z';
      planeZ.plane = true;
      planeZ.addComponent('model', {
          type: 'cylinder',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      entity.addChild(planeZ);
      planeZ.setLocalEulerAngles(90, 0, 0);
      planeZ.setLocalScale(4, 0.3, 4);
      planeZ.mat = planeZ.model.material = createMaterial(new pc.Color(0, 0, 1, 0));

      // sphere
      var sphere = obj.sphere = new pc.Entity();
      sphere.addComponent('model', {
          type: 'sphere',
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [gizmoLayer]
      });
      entity.addChild(sphere);
      sphere.setLocalScale(3, 3, 3);
      sphere.mat = sphere.model.material = createMaterial(new pc.Color(1, 1, 1, 0));

      obj.matActive = createMaterial(new pc.Color(1, 1, 1, 1.1));

      var lines = createLinesModel(app);
      obj.line.x = lines[0];
      obj.line.y = lines[1];
      obj.line.z = lines[2];
      obj.line.cull = lines[3];

      return obj;
  };

  var createMeshInstance = function (node, mesh, material) {
      var mi = new pc.MeshInstance(node, mesh, material);
      mi.cull = false;
      return mi;
  };

  var createLinesModel = function(app) {
      // Create the rotate gizmo geometry
      var device = app.graphicsDevice;
      var axisSegments = 50;
      var numVerts = (axisSegments + 1);
      var angle = 0.0;
      var iterator;
      var sinAngle, cosAngle;
      var scale = 2;

      var vertexFormat = new pc.VertexFormat(app.graphicsDevice, [
          { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 }
      ]);

      var vertexBuffers = [];
      for (var axis = 0; axis < 3; axis++) {
          // Create a vertex buffer
          vertexBuffers.push(new pc.VertexBuffer(device, vertexFormat, numVerts));

          // Fill the vertex buffer
          iterator = new pc.VertexIterator(vertexBuffers[axis]);
          for (var seg = 0; seg <= axisSegments; seg++) {
              angle = 2 * Math.PI * (seg / axisSegments);
              sinAngle = Math.sin(angle);
              cosAngle = Math.cos(angle);
              if (axis === 0) {
                  iterator.element[pc.SEMANTIC_POSITION].set(0, sinAngle * scale, cosAngle * scale);
              } else if (axis === 1) {
                  iterator.element[pc.SEMANTIC_POSITION].set(sinAngle * scale, 0, cosAngle * scale);
              } else if (axis === 2) {
                  iterator.element[pc.SEMANTIC_POSITION].set(sinAngle * scale, cosAngle * scale, 0);
              }
              iterator.next();
          }
          iterator.end();
      }

      var node = new pc.GraphNode();
      var mesh, meshInstance;

      var meshInstances = [ ];
      var materials = [
          createMaterial(new pc.Color(1, 0, 0, 1.1)),
          createMaterial(new pc.Color(0, 1, 0, 1.1)),
          createMaterial(new pc.Color(0, 0, 1, 1.1))
      ];

      // create 3 rings of lines (the visible portion of the gizmo)
      for (var i = 0; i < 3; i++) {
          mesh = new pc.Mesh();
          mesh.vertexBuffer = vertexBuffers[i];
          mesh.indexBuffer[0] = null;
          mesh.primitive[0].type = pc.PRIMITIVE_LINESTRIP;
          mesh.primitive[0].base = 0;
          mesh.primitive[0].count = vertexBuffers[i].getNumVertices();
          mesh.primitive[0].indexed = false;

          meshInstance = createMeshInstance(node, mesh, materials[i]);
          meshInstance.mask = GIZMO_MASK;
          meshInstance.mat = materials[i];
          meshInstances.push(meshInstance);
      }

      // create a sphere which is used to render in the center and cull the rings (via depth buffer)
      mesh = pc.createSphere(device, {
          segments: 75,
          radius: 1.95
      });
      var material = createMaterial(new pc.Color(1, 1, 1, 0.5));
      material.redWrite = false;
      material.greenWrite = false;
      material.blueWrite = false;
      material.alphaWrite = false;
      material.update();
      meshInstance = createMeshInstance(node, mesh, material);
      meshInstance.mask = GIZMO_MASK;
      meshInstances.push(meshInstance);

      return meshInstances;
  };
});


/* editor/gizmo/gizmo-camera.js */
editor.once('load', function () {
  'use strict';

  var app;
  // selected entity gizmos
  var entities = { };
  // pool of gizmos
  var pool = [ ];
  // colors
  var colorBehind = new pc.Color(1, 1, 1, .15);
  var colorPrimary = new pc.Color(1, 1, 1);

  var immediateRenderOptions;
  var noDepthImmediateRenderOptions;

  // gizmo class
  function Gizmo() {
      this._link = null;
      this.lines = [ ];
      this.events = [ ];
      this.visible = false;

      for(var i = 0; i < 24; i++)
          this.lines.push(new pc.Vec3());
  }
  // update lines
  Gizmo.prototype.update = function() {
      if (! app) return; // webgl not available

      if (! this._link || ! this._link.entity || editor.call('camera:current') === this._link.entity) {
          this.visible = false;
          return;
      }

      var camera = this._link.entity.camera;
      this.visible = camera && this._link.get('enabled') && this._link.get('components.camera.enabled') && editor.call('camera:current') !== this._link.entity;
      if (! this.visible)
          return;

      var nearClip = camera.nearClip || 0.0001;
      var farClip = camera.farClip;
      var fov = camera.fov * Math.PI / 180.0;
      var projection = camera.projection;

      var device = app.graphicsDevice;
      var rect = camera.rect;
      var aspectRatio = (device.width * rect.z) / (device.height * rect.w);

      var nx, ny, fx, fy;
      if (projection === pc.PROJECTION_PERSPECTIVE) {
          ny = Math.tan(fov / 2.0) * nearClip;
          fy = Math.tan(fov / 2.0) * farClip;
          nx = ny * aspectRatio;
          fx = fy * aspectRatio;
      } else {
          ny = camera.camera._orthoHeight;
          fy = ny;
          nx = ny * aspectRatio;
          fx = nx;
      }

      // near plane
      this.lines[0].set(nx, -ny, -nearClip);
      this.lines[1].set(nx, ny, -nearClip);
      this.lines[2].set(nx, ny, -nearClip);
      this.lines[3].set(-nx, ny, -nearClip);
      this.lines[4].set(-nx, ny, -nearClip);
      this.lines[5].set(-nx, -ny, -nearClip);
      this.lines[6].set(-nx, -ny, -nearClip);
      this.lines[7].set(nx, -ny, -nearClip);
      // far plane
      this.lines[8].set(fx, -fy, -farClip);
      this.lines[9].set(fx, fy, -farClip);
      this.lines[10].set(fx, fy, -farClip);
      this.lines[11].set(-fx, fy, -farClip);
      this.lines[12].set(-fx, fy, -farClip);
      this.lines[13].set(-fx, -fy, -farClip);
      this.lines[14].set(-fx, -fy, -farClip);
      this.lines[15].set(fx, -fy, -farClip);
      // parallel lines
      this.lines[16].set(nx, -ny, -nearClip);
      this.lines[17].set(fx, -fy, -farClip);
      this.lines[18].set(nx, ny, -nearClip);
      this.lines[19].set(fx, fy, -farClip);
      this.lines[20].set(-nx, ny, -nearClip);
      this.lines[21].set(-fx, fy, -farClip);
      this.lines[22].set(-nx, -ny, -nearClip);
      this.lines[23].set(-fx, -fy, -farClip);

      // transform lines according to camera transform
      var wtm = new pc.Mat4().setTRS(this._link.entity.getPosition(), this._link.entity.getRotation(), pc.Vec3.ONE);
      for(var i = 0; i < this.lines.length; i++)
          wtm.transformPoint(this.lines[i], this.lines[i]);

      this.visible = true;
  };
  // render lines
  Gizmo.prototype.render = function() {
      if (! app) return; // webgl not available

      if (! this.visible)
          return;

      app.renderLines(this.lines, colorBehind, noDepthImmediateRenderOptions);
      app.renderLines(this.lines, colorPrimary, immediateRenderOptions);
  };
  // link to entity
  Gizmo.prototype.link = function(obj) {
      this.unlink();
      this._link = obj;

      var self = this;

      this.events.push(this._link.once('destroy', function() {
          self.unlink();
      }));
  };
  // unlink
  Gizmo.prototype.unlink = function() {
      if (! this._link)
          return;

      for(var i = 0; i < this.events.length; i++)
          this.events[i].unbind();

      this.events = [ ];
      this._link = null;
      this.visible = false;
  };

  editor.on('selector:change', function(type, items) {
      // clear gizmos
      if (type !== 'entity') {
          for(var key in entities) {
              entities[key].unlink();
              pool.push(entities[key]);
          }
          entities = { };
          return;
      }

      // index selection
      var ids = { };
      for(var i = 0; i < items.length; i++)
          ids[items[i].get('resource_id')] = items[i];

      var render = false;

      // remove
      for(var key in entities) {
          if (ids[key])
              continue;

          pool.push(entities[key]);
          entities[key].unlink();
          delete entities[key];
          render = true;
      }

      // add
      for(var key in ids) {
          if (entities[key])
              continue;

          var gizmo = pool.shift();
          if (! gizmo)
              gizmo = new Gizmo();

          gizmo.link(ids[key]);
          entities[key] = gizmo;
          render = true;
      }

      if (render)
          editor.call('viewport:render');
  });

  editor.once('viewport:load', function() {
      app = editor.call('viewport:app');

      noDepthImmediateRenderOptions = {
          layer: editor.call('gizmo:layers', 'Axis Gizmo Immediate'),
          mask: GIZMO_MASK,
          depthTest: false
      }

      immediateRenderOptions = {
          layer: editor.call('gizmo:layers', 'Bright Gizmo'),
          mask: GIZMO_MASK
      }
  });

  editor.on('viewport:gizmoUpdate', function(dt) {
      for(var key in entities) {
          entities[key].update();
          entities[key].render();
      }
  });
});


/* editor/gizmo/gizmo-light.js */
editor.once('load', function () {
  'use strict';

  var app;
  // selected entity gizmos
  var entities = { };
  // pool of gizmos
  var pool = [ ];
  // colors
  var colorBehind = new pc.Color(1, 1, 1, .15);
  var colorPrimary = new pc.Color(1, 1, 1);
  var container;
  var vec = new pc.Vec3();
  var materialBehind = new pc.BasicMaterial();
  materialBehind.color = colorBehind;
  materialBehind.blend = true;
  materialBehind.blendSrc = pc.BLENDMODE_SRC_ALPHA;
  materialBehind.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
  materialBehind.depthTest = false;
  materialBehind.update();
  var materialSpot, materialSpotBehind;
  var models = { };
  var poolModels = { 'directional': [ ], 'point': [ ], 'point-close': [ ], 'spot': [ ] };

  var layerFront = editor.call('gizmo:layers', 'Bright Gizmo');
  var layerBack = editor.call('gizmo:layers', 'Dim Gizmo');

  // hack: override addModelToLayers to selectively put some
  // mesh instances to the front and others to the back layer depending
  // on the __useFrontLayer property
  var addModelToLayers = function () {
      var frontMeshInstances = this.meshInstances.filter(function (mi) {
          return mi.__useFrontLayer;
      });
      var backMeshInstances = this.meshInstances.filter(function (mi) {
          return ! mi.__useFrontLayer;
      });

      layerBack.addMeshInstances(frontMeshInstances);
      layerFront.addMeshInstances(backMeshInstances);
  };

  // gizmo class
  function Gizmo() {
      this._link = null;
      this.lines = [ ];
      this.events = [ ];
      this.type = '';
      this.entity = null;
  }
  // update lines
  Gizmo.prototype.update = function() {
      if (! app) return; // webgl not available

      if (! this._link || ! this._link.entity)
          return;

      var light = this._link.entity.light;
      this.entity.enabled = this._link.entity.enabled && light && light.enabled;
      if (! this.entity.enabled)
          return;

      this.entity.setPosition(this._link.entity.getPosition());

      var type = light.type;

      // close point light, switch to triple circle
      if (type === 'point' && vec.copy(this.entity.getPosition()).sub(editor.call('camera:current').getPosition()).length() < light.range)
          type += '-close';

      if (this.type !== type) {
          this.type = type;

          // set new model based on type
          if (models[this.type]) {
              // get current model
              var model = this.entity.model.model;
              if (model) {
                  // put back in pool
                  layerBack.removeMeshInstances(model.meshInstances);
                  layerFront.removeMeshInstances(model.meshInstances);
                  this.entity.removeChild(model.getGraph());
                  poolModels[model._type].push(model);
              }
              // get from pool
              model = poolModels[this.type].shift();
              if (! model) {
                  // no in pool
                  model = models[this.type].clone();
                  for (var i = 0; i < model.meshInstances.length; i++) {
                      model.meshInstances[i].__useFrontLayer = models[this.type].meshInstances[i].__useFrontLayer;
                      // model.meshInstances[i].mask = GIZMO_MASK;
                  }
                  model._type = this.type;
              }
              // set to model
              this.entity.model.model = model;
              model.meshInstances.forEach(function (mi) {
                  mi.mask = GIZMO_MASK;
              });
              this.entity.setLocalScale(1, 1, 1);
              this.entity.setEulerAngles(0, 0, 0);
          } else {
              this.entity.model.model = null;
              this.entity.enabled = false;
              return;
          }
      }

      var material = materialBehind;

      switch(this.type) {
          case 'directional':
              this.entity.setRotation(this._link.entity.getRotation());
              break;
          case 'point':
              this.entity.setLocalScale(light.range, light.range, light.range);
              this.entity.lookAt(editor.call('camera:current').getPosition());
              break;
          case 'point-close':
              this.entity.setLocalScale(light.range, light.range, light.range);
              break;
          case 'spot':
              this.entity.setRotation(this._link.entity.getRotation());
              this.entity.model.model.meshInstances[0].setParameter('range', light.range);
              this.entity.model.model.meshInstances[0].setParameter('innerAngle', light.innerConeAngle);
              this.entity.model.model.meshInstances[0].setParameter('outerAngle', light.outerConeAngle);
              this.entity.model.model.meshInstances[1].setParameter('range', light.range);
              this.entity.model.model.meshInstances[1].setParameter('innerAngle', light.innerConeAngle);
              this.entity.model.model.meshInstances[1].setParameter('outerAngle', light.outerConeAngle);
              material = materialSpotBehind;
              break;
      }

      // // render behind model
      // if (this.entity.enabled && this.entity.model.model) {
      //     // var instance = new pc.MeshInstance(this.entity, this.entity.model.model.meshInstances[0].mesh, material);
      //     // instance.__useFrontLayer = true;
      //     // instance.mask = 8;
      //     // instance.pick = false;
      //     if (this.type === 'spot') {
      //         // instance.layer = pc.LAYER_GIZMO;
      //         this.entity.model.model.meshInstances[1]
      //         instance.setParameter('range', light.range);
      //         instance.setParameter('innerAngle', light.innerConeAngle);
      //         instance.setParameter('outerAngle', light.outerConeAngle);
      //     }

      //     // app.scene.immediateDrawCalls.push(instance);
      // }
  };
  // link to entity
  Gizmo.prototype.link = function(obj) {
      if (! app) return; // webgl not available

      this.unlink();
      this._link = obj;

      var self = this;

      this.events.push(this._link.once('destroy', function() {
          self.unlink();
      }));

      this.entity = new pc.Entity();
      this.entity.addComponent('model', {
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layerBack.id, layerFront.id]
      });
      this.entity.model.addModelToLayers = addModelToLayers;

      container.addChild(this.entity);
  };
  // unlink
  Gizmo.prototype.unlink = function() {
      if (! app) return; // webgl not available

      if (! this._link)
          return;

      for(var i = 0; i < this.events.length; i++)
          this.events[i].unbind();

      this.events = [ ];
      this._link = null;
      this.type = '';

      var model = this.entity.model.model;
      if (model) {
          // put back in pool
          layerBack.removeMeshInstances(model.meshInstances);
          layerFront.removeMeshInstances(model.meshInstances);
          this.entity.removeChild(model.getGraph());
          poolModels[model._type].push(model);
      }

      this.entity.destroy();
  };

  editor.on('selector:change', function(type, items) {
      // clear gizmos
      if (type !== 'entity') {
          for(var key in entities) {
              entities[key].unlink();
              pool.push(entities[key]);
          }
          entities = { };
          return;
      }

      // index selection
      var ids = { };
      for(var i = 0; i < items.length; i++)
          ids[items[i].get('resource_id')] = items[i];

      var render = false;

      // remove
      for(var key in entities) {
          if (ids[key])
              continue;

          pool.push(entities[key]);
          entities[key].unlink();
          delete entities[key];
          render = true;
      }

      // add
      for(var key in ids) {
          if (entities[key])
              continue;

          var gizmo = pool.shift();
          if (! gizmo)
              gizmo = new Gizmo();

          gizmo.link(ids[key]);
          entities[key] = gizmo;

          render = true;
      }

      if (render)
          editor.call('viewport:render');
  });

  editor.once('viewport:load', function() {
      app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      container = new pc.Entity(app);
      app.root.addChild(container);

      // material
      var material = new pc.BasicMaterial();
      material.color = colorPrimary;
      material.update();

      var shaderSpot;

      materialSpot = new pc.BasicMaterial();
      materialSpot.updateShader = function(device) {
          if (! shaderSpot) {
              shaderSpot = new pc.Shader(device, {
                  attributes: {
                      vertex_position: 'POSITION',
                      outer: 'ATTR0'
                  },
                  vshader: ' \
                      attribute vec3 vertex_position;\n \
                      attribute float outer;\n \
                      uniform mat4 matrix_model;\n \
                      uniform mat4 matrix_viewProjection;\n \
                      uniform float range;\n \
                      uniform float innerAngle;\n \
                      uniform float outerAngle;\n \
                      void main(void)\n \
                      {\n \
                          mat4 modelMatrix = matrix_model;\n \
                          vec4 positionW = vec4(vertex_position, 1.0);\n \
                          float radius = (outer * (sin(radians(outerAngle)) * range)) + ((1.0 - outer) * (sin(radians(innerAngle)) * range));\n \
                          positionW.xz *= radius;\n \
                          positionW.y *= range * ((outer * cos(radians(outerAngle))) + ((1.0 - outer) * cos(radians(innerAngle))));\n \
                          positionW = modelMatrix * positionW;\n \
                          gl_Position = matrix_viewProjection * positionW;\n \
                      }\n',
                  fshader: ' \
                      precision ' + device.precision + ' float;\n \
                      uniform vec4 uColor;\n \
                      void main(void)\n \
                      {\n \
                          gl_FragColor = uColor;\n \
                          gl_FragColor = clamp(gl_FragColor, 0.0, 1.0);\n \
                      }\n',
              });
          }
          this.shader = shaderSpot;
      };
      materialSpot.color = colorPrimary;
      materialSpot.update();

      materialSpotBehind = new pc.BasicMaterial();
      materialSpotBehind.updateShader = materialSpot.updateShader;
      materialSpotBehind.color = colorBehind;
      materialSpotBehind.blend = true;
      materialSpotBehind.blendSrc = pc.BLENDMODE_SRC_ALPHA;
      materialSpotBehind.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
      materialSpotBehind.depthTest = false;
      materialSpotBehind.update();

      var buffer, iterator, size, length, node, mesh, material, meshInstance, model;
      var vertexFormat = new pc.VertexFormat(app.graphicsDevice, [
          { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 }
      ]);
      var vertexFormatSpot = new pc.VertexFormat(app.graphicsDevice, [
          { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
          { semantic: pc.SEMANTIC_ATTR0, components: 1, type: pc.TYPE_FLOAT32 }
      ]);
      var rad = Math.PI / 180;

      // ================
      // directional light
      buffer = new pc.VertexBuffer(app.graphicsDevice, vertexFormat, 14);
      iterator = new pc.VertexIterator(buffer);
      size = .2;
      length = -(2 - size * 2);
      // line
      iterator.element[pc.SEMANTIC_POSITION].set(0, 0, 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(0, length, 0);
      iterator.next();
      // triangle
      iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(0 * rad) * size, length, Math.cos(0 * rad) * size);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(120 * rad) * size, length, Math.cos(120 * rad) * size);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(120 * rad) * size, length, Math.cos(120 * rad) * size);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(240 * rad) * size, length, Math.cos(240 * rad) * size);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(240 * rad) * size, length, Math.cos(240 * rad) * size);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(0 * rad) * size, length, Math.cos(0 * rad) * size);
      iterator.next();
      // triangle corners
      iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(0 * rad) * size, length, Math.cos(0 * rad) * size);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(0, length - (size * 2), 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(120 * rad) * size, length, Math.cos(120 * rad) * size);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(0, length - (size * 2), 0);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(240 * rad) * size, length, Math.cos(240 * rad) * size);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(0, length - (size * 2), 0);
      iterator.next();
      iterator.end();
      // node
      node = new pc.GraphNode();
      // mesh
      mesh = new pc.Mesh();
      mesh.vertexBuffer = buffer;
      mesh.indexBuffer[0] = null;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = buffer.getNumVertices();
      mesh.primitive[0].indexed = false;
      // meshInstance
      meshInstance = new pc.MeshInstance(node, mesh, material);
      meshInstance.mask = GIZMO_MASK;
      meshInstance.pick = false;
      // meshInstance.updateKey();

      var meshInstanceBehind = new pc.MeshInstance(node, mesh, materialBehind);
      meshInstanceBehind.__useFrontLayer = true;
      meshInstanceBehind.mask = GIZMO_MASK;
      meshInstanceBehind.pick = false;

      // model
      model = new pc.Model();
      model.graph = node;
      model.meshInstances = [ meshInstance, meshInstanceBehind ];
      models['directional'] = model;

      // ================
      // point light
      var segments = 72;
      buffer = new pc.VertexBuffer(app.graphicsDevice, vertexFormat, segments * 2);
      iterator = new pc.VertexIterator(buffer);
      // xz axis
      for(var i = 0; i < segments; i++) {
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * i * rad), Math.cos(360 / segments * i * rad), 0);
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * (i + 1) * rad), Math.cos(360 / segments * (i + 1) * rad), 0);
          iterator.next();
      }
      iterator.end();
      // node
      node = new pc.GraphNode();
      // mesh
      mesh = new pc.Mesh();
      mesh.vertexBuffer = buffer;
      mesh.indexBuffer[0] = null;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = buffer.getNumVertices();
      mesh.primitive[0].indexed = false;
      // meshInstance
      meshInstance = new pc.MeshInstance(node, mesh, material);
      meshInstance.mask = GIZMO_MASK;
      meshInstance.pick = false;
      // meshInstance.updateKey();

      meshInstanceBehind = new pc.MeshInstance(node, mesh, materialBehind);
      meshInstanceBehind.__useFrontLayer = true;
      meshInstanceBehind.mask = GIZMO_MASK;
      meshInstanceBehind.pick = false;

      // model
      model = new pc.Model();
      model.graph = node;
      model.meshInstances = [ meshInstance, meshInstanceBehind ];
      models['point'] = model;


      // ================
      // point light close
      var segments = 72;
      buffer = new pc.VertexBuffer(app.graphicsDevice, vertexFormat, segments * 2 * 3);
      iterator = new pc.VertexIterator(buffer);
      // circles
      for(var i = 0; i < segments; i++) {
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * i * rad), 0, Math.cos(360 / segments * i * rad));
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * (i + 1) * rad), 0, Math.cos(360 / segments * (i + 1) * rad));
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * i * rad), Math.cos(360 / segments * i * rad), 0);
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * (i + 1) * rad), Math.cos(360 / segments * (i + 1) * rad), 0);
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(0, Math.cos(360 / segments * i * rad), Math.sin(360 / segments * i * rad));
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(0, Math.cos(360 / segments * (i + 1) * rad), Math.sin(360 / segments * (i + 1) * rad));
          iterator.next();
      }
      iterator.end();
      // node
      node = new pc.GraphNode();
      // mesh
      mesh = new pc.Mesh();
      mesh.vertexBuffer = buffer;
      mesh.indexBuffer[0] = null;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = buffer.getNumVertices();
      mesh.primitive[0].indexed = false;
      // meshInstance
      meshInstance = new pc.MeshInstance(node, mesh, material);
      meshInstance.mask = GIZMO_MASK;
      meshInstance.pick = false;
      meshInstance.updateKey();

      meshInstanceBehind = new pc.MeshInstance(node, mesh, materialBehind);
      meshInstanceBehind.__useFrontLayer = true;
      meshInstanceBehind.mask = GIZMO_MASK;
      meshInstanceBehind.pick = false;

      // model
      model = new pc.Model();
      model.graph = node;
      model.meshInstances = [ meshInstance, meshInstanceBehind ];
      models['point-close'] = model;


      // ================
      // spot light
      var segments = 72;
      buffer = new pc.VertexBuffer(app.graphicsDevice, vertexFormatSpot, segments * 2 * 2 + 8);
      iterator = new pc.VertexIterator(buffer);
      // lines
      //      left
      iterator.element[pc.SEMANTIC_POSITION].set(0, 0, 0);
      iterator.element[pc.SEMANTIC_ATTR0].set(1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(0 * rad), -1, Math.cos(0 * rad));
      iterator.element[pc.SEMANTIC_ATTR0].set(1);
      iterator.next();
      //      right
      iterator.element[pc.SEMANTIC_POSITION].set(0, 0, 0);
      iterator.element[pc.SEMANTIC_ATTR0].set(1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(180 * rad), -1, Math.cos(180 * rad));
      iterator.element[pc.SEMANTIC_ATTR0].set(1);
      iterator.next();
      // circles
      for(var i = 0; i < segments; i++) {
          // inner
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * i * rad), -1, Math.cos(360 / segments * i * rad));
          iterator.element[pc.SEMANTIC_ATTR0].set(0);
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * (i + 1) * rad), -1, Math.cos(360 / segments * (i + 1) * rad));
          iterator.element[pc.SEMANTIC_ATTR0].set(0);
          iterator.next();
          // outer
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * i * rad), -1, Math.cos(360 / segments * i * rad));
          iterator.element[pc.SEMANTIC_ATTR0].set(1);
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * (i + 1) * rad), -1, Math.cos(360 / segments * (i + 1) * rad));
          iterator.element[pc.SEMANTIC_ATTR0].set(1);
          iterator.next();
      }
      iterator.end();
      // node
      node = new pc.GraphNode();
      // mesh
      mesh = new pc.Mesh();
      mesh.vertexBuffer = buffer;
      mesh.indexBuffer[0] = null;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = buffer.getNumVertices();
      mesh.primitive[0].indexed = false;
      // meshInstance
      meshInstance = new pc.MeshInstance(node, mesh, materialSpot);
      meshInstance.mask = GIZMO_MASK;
      meshInstance.pick = false;
      // meshInstance.updateKey();

      meshInstanceBehind = new pc.MeshInstance(node, mesh, materialSpotBehind);
      meshInstanceBehind.__useFrontLayer = true;
      meshInstanceBehind.mask = GIZMO_MASK;
      meshInstanceBehind.pick = false;

      // model
      model = new pc.Model();
      model.graph = node;
      model.meshInstances = [ meshInstance, meshInstanceBehind ];
      models['spot'] = model;
  });

  editor.on('viewport:gizmoUpdate', function(dt) {
      for(var key in entities)
          entities[key].update();
  });
});


/* editor/gizmo/gizmo-collision.js */
editor.once('load', function () {
  'use strict';

  var app;
  // selected entity gizmos
  var entities = { };
  var selected = { };
  // pool of gizmos
  var pool = [ ];
  var poolVec3 = [ ];
  // colors
  var alphaFront = 0.6;
  var alphaBehind = 0.2;
  var colorBehind = new pc.Color(1, 1, 1, .05);
  var colorPrimary = new pc.Color(1, 1, 1);
  var colorOccluder = new pc.Color(1, 1, 1, 1);
  var colorDefault = [ 1, 1, 1 ];
  var container;
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();

  var materialDefault = new pc.BasicMaterial();
  materialDefault.name = 'collision';
  materialDefault.color = colorPrimary;
  materialDefault.blend = true;
  materialDefault.blendSrc = pc.BLENDMODE_SRC_ALPHA;
  materialDefault.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
  materialDefault.update();

  var materialBehind = new pc.BasicMaterial();
  materialBehind.name = 'collision behind';
  materialBehind.color = colorBehind;
  materialBehind.blend = true;
  materialBehind.blendSrc = pc.BLENDMODE_SRC_ALPHA;
  materialBehind.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
  materialBehind.depthWrite = false;
  materialBehind.depthTest = true;
  materialBehind.update();

  var materialOccluder = new pc.BasicMaterial();
  materialOccluder.name = 'collision occluder'
  materialOccluder.color = colorOccluder;
  materialOccluder.redWrite = false;
  materialOccluder.greenWrite = false;
  materialOccluder.blueWrite = false;
  materialOccluder.alphaWrite = false;
  materialOccluder.depthWrite = true;
  materialOccluder.depthTest = true;
  materialOccluder.update();

  var models = { };
  var materials = { };
  var poolModels = { 'box': [ ], 'sphere': [ ], 'capsule-x': [ ], 'capsule-y': [ ], 'capsule-z': [ ], 'cylinder-x': [ ], 'cylinder-y': [ ], 'cylinder-z': [ ] };
  var axesNames = { 0: 'x', 1: 'y', 2: 'z' };
  var shaderCapsule = { };

  var layerFront = editor.call('gizmo:layers', 'Bright Collision');
  var layerBack = editor.call('gizmo:layers', 'Dim Gizmo');

  var visible = false;
  editor.method('gizmo:collision:visible', function(state) {
      if (state === undefined)
          return visible;

      if (visible === !! state)
          return;

      visible = !! state;

      if (visible) {
          editor.call('gizmo:zone:visible', false);
      }

      editor.emit('gizmo:collision:visible', visible);
      editor.call('viewport:render');
  });

  // gizmo class
  function Gizmo() {
      this._link = null;
      this.lines = [ ];
      this.events = [ ];
      this.type = '';
      this.asset = 0;
      this.entity = null;
      this.color;
  };

  // update lines
  Gizmo.prototype.update = function() {
      if (! app) return; // webgl not available

      if (! this._link || ! this._link.entity)
          return;

      var select = selected[this._link.get('resource_id')];
      var collision = this._link.entity.collision;
      this.entity.enabled = this._link.entity.enabled && collision && collision.enabled && (select || visible);
      if (! this.entity.enabled) {
          this._link.entity.__noIcon = false;
          return;
      }

      this._link.entity.__noIcon = true;
      this.entity.setPosition(this._link.entity.getPosition());
      this.entity.setRotation(this._link.entity.getRotation());

      var type = collision.type;

      if (type === 'cylinder' || type === 'capsule') {
          type += '-' + axesNames[collision.axis];
      }

      if (this.type !== type) {
          this.type = type;

          if (! this.color) {
              var hash = 0;
              var string = this._link.entity.getGuid();
              for(var i = 0; i < string.length; i++)
                  hash += string.charCodeAt(i);

              this.color = editor.call('color:hsl2rgb', (hash % 128) / 128, 0.5, 0.5);
          }

          this.wireframeMesh = null;

          // set new model based on type
          if (models[this.type]) {
              // get current model
              var model = this.entity.model.model;
              if (model) {
                  // put back in pool
                  layerFront.removeMeshInstances(model.meshInstances);
                  layerBack.removeMeshInstances(model.meshInstances);

                  this.entity.removeChild(model.getGraph());
                  if (poolModels[model._type])
                      poolModels[model._type].push(model);
              }
              // get from pool
              model = null;
              if (poolModels[this.type])
                  model = poolModels[this.type].shift();

              if (! model) {
                  // no in pool
                  model = models[this.type].clone();
                  model._type = this.type;

                  var color = this.color || colorDefault;

                  var old = model.meshInstances[0].material;
                  model.meshInstances[0].setParameter('offset', 0);
                  // model.meshInstances[0].layer = 12;
                  // model.meshInstances[0].updateKey();
                  model.meshInstances[0].__editor = true;
                  model.meshInstances[0].__collision = true;
                  model.meshInstances[0].material = old.clone();
                  model.meshInstances[0].material.updateShader = old.updateShader;
                  model.meshInstances[0].material.depthBias = -8;
                  model.meshInstances[0].material.color.set(color[0], color[1], color[2], alphaFront);
                  model.meshInstances[0].material.update();

                  var old = model.meshInstances[1].material;
                  model.meshInstances[1].setParameter('offset', 0.001);
                  // model.meshInstances[1].layer = 2;
                  model.meshInstances[1].pick = false;
                  // model.meshInstances[1].updateKey();
                  model.meshInstances[1].__editor = true;
                  model.meshInstances[1].material = old.clone();
                  model.meshInstances[1].material.updateShader = old.updateShader;
                  model.meshInstances[1].material.color.set(color[0], color[1], color[2], alphaBehind);
                  model.meshInstances[1].material.update();
                  model.meshInstances[1].__useFrontLayer = true;

                  model.meshInstances[2].setParameter('offset', 0);
                  // model.meshInstances[2].layer = 9;
                  model.meshInstances[2].pick = false;
                  // model.meshInstances[2].updateKey();
                  model.meshInstances[2].__editor = true;

                  switch(this.type) {
                      case 'capsule-x':
                      case 'capsule-y':
                      case 'capsule-z':
                          for(var i = 0; i < model.meshInstances.length; i++) {
                              model.meshInstances[i].setParameter('radius', collision.radius || 0.5);
                              model.meshInstances[i].setParameter('height', collision.height || 2);
                          }
                          break;
                  }
              }
              // set to model
              this.entity.model.model = model;

              // set masks after model is assigned to ensure they are correct
              model.meshInstances.forEach(function (mi) {
                  mi.mask = GIZMO_MASK;
              });

              this.entity.setLocalScale(1, 1, 1);
          } else if (this.type === 'mesh') {
              this.asset = collision.asset;
              this.entity.setLocalScale(this._link.entity.getWorldTransform().getScale());
              this.createWireframe(collision.asset);
              if (! this.asset) {
                  this.entity.enabled = false;
                  this.entity.model.model = null;
                  return;
              }
          } else {
              this.entity.enabled = false;
              this.entity.model.model = null;
              return;
          }
      }

      var mat = materialBehind;
      var radius = collision.radius || .00001;
      var height = collision.height || .00001;

      if (this.entity.model.model && this.entity.model.meshInstances[1])
          mat = null;

      switch(this.type) {
          case 'sphere':
              this.entity.setLocalScale(radius, radius, radius);
              break;
          case 'box':
              this.entity.setLocalScale(collision.halfExtents.x || .00001, collision.halfExtents.y || .00001, collision.halfExtents.z || .00001);
              break;
          case 'cylinder-x':
              this.entity.setLocalScale(height, radius, radius);
              break;
          case 'cylinder-y':
              this.entity.setLocalScale(radius, height, radius);
              break;
          case 'cylinder-z':
              this.entity.setLocalScale(radius, radius, height);
              break;
          case 'capsule-x':
          case 'capsule-y':
          case 'capsule-z':
              for(var i = 0; i < this.entity.model.meshInstances.length; i++) {
                  this.entity.model.meshInstances[i].setParameter('radius', collision.radius || 0.5);
                  this.entity.model.meshInstances[i].setParameter('height', collision.height || 2);
              }
              break;
          case 'mesh':
              this.entity.setLocalScale(this._link.entity.getWorldTransform().getScale());

              if (collision.asset !== this.asset) {
                  this.asset = collision.asset;
                  this.createWireframe(collision.asset);
                  if (! this.asset) {
                      this.entity.enabled = false;
                      this.entity.model.model = null;
                      return;
                  }
              }

              if (this.entity.model.model) {
                  var picking = ! visible && this._link.entity.model && this._link.entity.model.enabled && this._link.entity.model.type === 'asset' && this._link.entity.model.asset === collision.asset;
                  if (picking !== this.entity.model.model.__picking) {
                      this.entity.model.model.__picking = picking;

                      var meshes = this.entity.model.meshInstances;
                      for(var i = 0; i < meshes.length; i++) {
                          if (! meshes[i].__collision)
                              continue;

                          meshes[i].pick = ! picking;
                      }
                  }
              }
              break;
      }
  };
  // link to entity
  Gizmo.prototype.link = function(obj) {
      if (! app) return; // webgl not available

      this.unlink();
      this._link = obj;

      var self = this;

      this.events.push(this._link.once('destroy', function() {
          self.unlink();
      }));

      this.color = null;

      this.entity = new pc.Entity();
      this.entity.__editor = true;
      this.entity.addComponent('model', {
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layerFront.id, layerBack.id]
      });

      // hack: override addModelToLayers to selectively put some
      // mesh instances to the front and others to the back layer depending
      // on the __useFrontLayer property
      this.entity.model.addModelToLayers = function () {
          var frontMeshInstances = this.meshInstances.filter(function (mi) {
              return mi.__useFrontLayer;
          });
          var backMeshInstances = this.meshInstances.filter(function (mi) {
              return ! mi.__useFrontLayer;
          });

          layerBack.addMeshInstances(frontMeshInstances);
          layerFront.addMeshInstances(backMeshInstances);
      };

      this.entity._getEntity = function() {
          return self._link.entity;
      };

      container.addChild(this.entity);
  };
  // unlink
  Gizmo.prototype.unlink = function() {
      if (! app) return; // webgl not available

      if (! this._link)
          return;

      for(var i = 0; i < this.events.length; i++) {
          if (this.events[i] && this.events[i].unbind)
              this.events[i].unbind();
      }

      this.events = [ ];
      this._link = null;
      this.color = null;
      this.type = '';
      this.asset = 0;

      var model = this.entity.model.model;
      if (model) {
          // put back in pool
          layerFront.removeMeshInstances(model.meshInstances);
          layerBack.removeMeshInstances(model.meshInstances);
          this.entity.removeChild(model.getGraph());
          if (model._type)
              poolModels[model._type].push(model);
      }

      this.entity.destroy();
  };
  // create wireframe
  Gizmo.prototype.createWireframe = function(asset) {
      if (! app) return; // webgl not available

      asset = app.assets.get(asset);
      if (! asset)
          return null;

      if (asset.resource) {
          this.entity.model.model = createModelCopy(asset.resource, this.color);
      } else {
          var self = this;

          this.events.push(asset.once('load', function(asset) {
              if (self.asset !== asset.id)
                  return;

              self.entity.model.model = createModelCopy(asset.resource, this.color);
          }));
      }
  };

  editor.on('entities:add', function(entity) {
      var key = entity.get('resource_id');

      var addGizmo = function() {
          if (entities[key])
              return;

          var gizmo = pool.shift();
          if (! gizmo)
              gizmo = new Gizmo();

          gizmo.link(entity);
          entities[key] = gizmo;

          editor.call('viewport:render');
      };

      var removeGizmo = function() {
          if (! entities[key])
              return;

          pool.push(entities[key]);
          entities[key].unlink();
          delete entities[key];

          editor.call('viewport:render');
      };

      if (entity.has('components.collision'))
          addGizmo();

      entity.on('components.collision:set', addGizmo);
      entity.on('components.collision:unset', removeGizmo);
      entity.on('destroy', removeGizmo);
  });

  editor.on('selector:change', function(type, items) {
      selected = { };

      if (type === 'entity' && items && items.length) {
          for(var i = 0; i < items.length; i++)
              selected[items[i].get('resource_id')] = true;
      }
  });

  editor.once('viewport:load', function() {
      app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      container = new pc.Entity(app);
      app.root.addChild(container);

      // material
      var defaultVShader = ' \
          attribute vec3 aPosition;\n \
          attribute vec3 aNormal;\n \
          varying vec3 vNormal;\n \
          varying vec3 vPosition;\n \
          uniform float offset;\n \
          uniform mat4 matrix_model;\n \
          uniform mat3 matrix_normal;\n \
          uniform mat4 matrix_view;\n \
          uniform mat4 matrix_viewProjection;\n \
          void main(void)\n \
          {\n \
              vec4 posW = matrix_model * vec4(aPosition, 1.0);\n \
              vNormal = normalize(matrix_normal * aNormal);\n \
              posW += vec4(vNormal * offset, 0.0);\n \
              gl_Position = matrix_viewProjection * posW;\n \
              vPosition = posW.xyz;\n \
          }\n';
      var defaultFShader = ' \
          precision ' + app.graphicsDevice.precision + ' float;\n \
          varying vec3 vNormal;\n \
          varying vec3 vPosition;\n \
          uniform vec4 uColor;\n \
          uniform vec3 view_position;\n \
          void main(void)\n \
          {\n \
              vec3 viewNormal = normalize(view_position - vPosition);\n \
              float light = dot(vNormal, viewNormal);\n \
              gl_FragColor = vec4(uColor.rgb * light * 2.0, uColor.a);\n \
          }\n';

      var shaderDefault;

      var _updateShader = materialDefault.updateShader;

      materialDefault.updateShader = function(device, scene, objDefs, staticLightList, pass, sortedLights) {
          if (pass === pc.SHADER_FORWARD) {
              if (! shaderDefault) {
                  shaderDefault = new pc.Shader(device, {
                      attributes: {
                          aPosition: pc.SEMANTIC_POSITION,
                          aNormal: pc.SEMANTIC_NORMAL
                      },
                      vshader: defaultVShader,
                      fshader: defaultFShader,
                  });
              }

              this.shader = shaderDefault;
          } else {
              _updateShader.call(this, device, scene, objDefs, staticLightList, pass, sortedLights);
          }
      };
      materialDefault.update();

      materialBehind.updateShader = materialDefault.updateShader;
      materialOccluder.updateShader = materialDefault.updateShader;

      var capsuleVShader = ' \
          attribute vec3 aPosition;\n \
          attribute vec3 aNormal;\n \
          attribute float aSide;\n \
          varying vec3 vNormal;\n \
          varying vec3 vPosition;\n \
          uniform float offset;\n \
          uniform mat4 matrix_model;\n \
          uniform mat3 matrix_normal;\n \
          uniform mat4 matrix_viewProjection;\n \
          uniform float radius;\n \
          uniform float height;\n \
          void main(void) {\n \
              vec3 pos = aPosition * radius;\n \
              pos.{axis} += aSide * max(height / 2.0 - radius, 0.0);\n \
              vec4 posW = matrix_model * vec4(pos, 1.0);\n \
              vNormal = normalize(matrix_normal * aNormal);\n \
              posW += vec4(vNormal * offset, 0.0);\n \
              gl_Position = matrix_viewProjection * posW;\n \
              vPosition = posW.xyz;\n \
          }\n';
      var capsuleFShader = ' \
          precision ' + app.graphicsDevice.precision + ' float;\n \
          varying vec3 vNormal;\n \
          varying vec3 vPosition;\n \
          uniform vec4 uColor;\n \
          uniform vec3 view_position;\n \
          void main(void) {\n \
              vec3 viewNormal = normalize(view_position - vPosition);\n \
              float light = dot(vNormal, viewNormal);\n \
              gl_FragColor = vec4(uColor.rgb * light * 2.0, uColor.a);\n \
          }\n';

      var capsuleVShaderPick = ' \
          attribute vec3 aPosition;\n \
          attribute vec3 aNormal;\n \
          attribute float aSide;\n \
          uniform mat4 matrix_model;\n \
          uniform mat4 matrix_viewProjection;\n \
          uniform float radius;\n \
          uniform float height;\n \
          void main(void) {\n \
              vec3 pos = aPosition * radius;\n \
              pos.{axis} += aSide * max(height / 2.0 - radius, 0.0);\n \
              vec4 posW = matrix_model * vec4(pos, 1.0);\n \
              gl_Position = matrix_viewProjection * posW;\n \
          }\n';

      var capsuleFShaderPick = ' \
          precision ' + app.graphicsDevice.precision + ' float;\n \
          uniform vec4 uColor;\n \
          void main(void) {\n \
              gl_FragColor = uColor;\n \
          }\n';


      var makeCapsuleMaterial = function(a) {
          var matDefault = materials['capsule-' + a] = materialDefault.clone();
          var _updateShader = matDefault.updateShader;
          matDefault.updateShader = function(device, scene, objDefs, staticLightList, pass, sortedLights) {
              if (pass === pc.SHADER_FORWARD) {
                  if (! shaderCapsule[a]) {
                      shaderCapsule[a] = new pc.Shader(device, {
                          attributes: {
                              aPosition: pc.SEMANTIC_POSITION,
                              aNormal: pc.SEMANTIC_NORMAL,
                              aSide: pc.SEMANTIC_ATTR0
                          },
                          vshader: capsuleVShader.replace('{axis}', a),
                          fshader: capsuleFShader,
                      });
                  }
                  this.shader = shaderCapsule[a];
              } else if (pass === pc.SHADER_PICK) {
                  var shaderName = 'pick-' + a
                  if (! shaderCapsule[shaderName]) {
                      shaderCapsule[shaderName] = new pc.Shader(device, {
                          attributes: {
                              aPosition: pc.SEMANTIC_POSITION,
                              aNormal: pc.SEMANTIC_NORMAL,
                              aSide: pc.SEMANTIC_ATTR0
                          },
                          vshader: capsuleVShaderPick.replace('{axis}', a),
                          fshader: capsuleFShaderPick,
                      });
                  }
                  this.shader = shaderCapsule[shaderName];
              } else {
                  _updateShader.call(this, device, scene, objDefs, staticLightList, pass, sortedLights);
              }
          };

          matDefault.update();

          var matBehind = materials['capsuleBehind-' + a] = materialBehind.clone();
          matBehind.updateShader = matDefault.updateShader;
          matBehind.update();

          var matOccluder = materials['capsuleOcclude-' + a] = materialOccluder.clone();
          matOccluder.updateShader = matDefault.updateShader;
          matOccluder.update();
      }

      for(var key in axesNames)
          makeCapsuleMaterial(axesNames[key]);

      var buffer, iterator, size, length, node, mesh, meshInstance, model, indexBuffer, indices;
      var vertexFormat = new pc.VertexFormat(app.graphicsDevice, [
          { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.ELEMENTTYPE_FLOAT32 }
      ]);
      var vertexFormatAttr0 = new pc.VertexFormat(app.graphicsDevice, [
          { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.ELEMENTTYPE_FLOAT32 },
          { semantic: pc.SEMANTIC_NORMAL, components: 3, type: pc.ELEMENTTYPE_FLOAT32 },
          { semantic: pc.SEMANTIC_ATTR0, components: 1, type: pc.ELEMENTTYPE_FLOAT32 }
      ]);
      var rad = Math.PI / 180;

      var createModel = function(args) {
          var mesh;

          if (args.vertices) {
              // mesh
              mesh = new pc.Mesh();
              mesh.vertexBuffer = args.vertices;
              mesh.indexBuffer[0] = args.indices;
              mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
              mesh.primitive[0].base = 0;
              mesh.primitive[0].count = args.count;
              mesh.primitive[0].indexed = true;
          } else {
              mesh = pc.createMesh(app.graphicsDevice, args.positions, {
                  normals: args.normals,
                  indices: args.indices
              });
          }

          // node
          var node = new pc.GraphNode();
          // meshInstance
          var meshInstance = new pc.MeshInstance(node, mesh, args.matDefault);
          meshInstance.__editor = true;
          meshInstance.__collision = true;
          // meshInstance.layer = 12;
          meshInstance.castShadow = false;
          // meshInstance.castLightmapShadow = false;
          meshInstance.receiveShadow = false;
          // meshInstance.updateKey();
          // meshInstanceBehind
          var meshInstanceBehind = new pc.MeshInstance(node, mesh, args.matBehind);
          meshInstanceBehind.__editor = true;
          meshInstanceBehind.pick = false;
          // meshInstanceBehind.layer = 2;
          meshInstanceBehind.drawToDepth = false;
          meshInstanceBehind.castShadow = false;
          // meshInstanceBehind.castLightmapShadow = false;
          meshInstanceBehind.receiveShadow = false;
          // meshInstanceBehind.updateKey();
          // meshInstanceOccluder
          var meshInstanceOccluder = new pc.MeshInstance(node, mesh, args.matOccluder);
          meshInstanceOccluder.__editor = true;
          meshInstanceOccluder.pick = false;
          // meshInstanceOccluder.layer = 9;
          meshInstanceOccluder.castShadow = false;
          // meshInstanceOccluder.castLightmapShadow = false;
          meshInstanceOccluder.receiveShadow = false;
          // meshInstanceOccluder.updateKey();
          // model
          var model = new pc.Model();
          model.graph = node;
          model.meshInstances = [ meshInstance, meshInstanceBehind, meshInstanceOccluder ];

          return model;
      };


      // ================
      // box
      var positions = [
          1, 1, 1,   1, 1, -1,   -1, 1, -1,   -1, 1, 1, // top
          1, 1, 1,   -1, 1, 1,   -1, -1, 1,   1, -1, 1, // front
          1, 1, 1,   1, -1, 1,   1, -1, -1,   1, 1, -1, // right
          1, 1, -1,   1, -1, -1,   -1, -1, -1,   -1, 1, -1, // back
          -1, 1, 1,   -1, 1, -1,   -1, -1, -1,   -1, -1, 1, // left
          1, -1, 1,   -1, -1, 1,   -1, -1, -1,   1, -1, -1 // bottom
      ];
      var normals = [
          0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0,
          0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
          1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0,
          0, 0, -1,   0, 0, -1,   0, 0, -1,   0, 0, -1,
          -1, 0, 0,   -1, 0, 0,   -1, 0, 0,   -1, 0, 0,
          0, -1, 0,   0, -1, 0,   0, -1, 0,   0, -1, 0
      ];
      var indices = [
          0, 1, 2, 2, 3, 0,
          4, 5, 6, 6, 7, 4,
          8, 9, 10, 10, 11, 8,
          12, 13, 14, 14, 15, 12,
          16, 17, 18, 18, 19, 16,
          20, 21, 22, 22, 23, 20
      ];
      models['box'] = createModel({
          positions: positions,
          normals: normals,
          indices: indices,
          matDefault: materialDefault,
          matBehind: materialBehind,
          matOccluder: materialOccluder
      });


      // ================
      // sphere
      var segments = 64;
      positions = [ ];
      normals = [ ];
      indices = [ ];

      for(var y = 1; y < segments / 2; y++) {
          for(var i = 0; i < segments; i++) {
              var l = Math.sin((y * (180 / (segments / 2)) + 90) * rad);
              var c = Math.cos((y * (180 / (segments / 2)) + 90) * rad);
              vecA.set(Math.sin(360 / segments * i * rad) * Math.abs(c), l, Math.cos(360 / segments * i * rad) * Math.abs(c));
              positions.push(vecA.x, vecA.y, vecA.z);
              vecA.normalize();
              normals.push(vecA.x, vecA.y, vecA.z);
          }
      }

      positions.push(0, 1, 0);
      normals.push(0, 1, 0);
      positions.push(0, -1, 0);
      normals.push(0, -1, 0);

      for(var y = 0; y < segments / 2 - 2; y++) {
          for(var i = 0; i < segments; i++) {
              indices.push(y * segments + i, (y + 1) * segments + i, y * segments + (i + 1) % segments);
              indices.push((y + 1) * segments + i, (y + 1) * segments + (i + 1) % segments, y * segments + (i + 1) % segments);
          }
      }

      for(var i = 0; i < segments; i++) {
          indices.push(i, (i + 1) % segments, (segments / 2 - 1) * segments);
          indices.push((segments / 2 - 2) * segments + i, (segments / 2 - 1) * segments + 1, (segments / 2 - 2) * segments + (i + 1) % segments);
      }

      models['sphere'] = createModel({
          positions: positions,
          normals: normals,
          indices: indices,
          matDefault: materialDefault,
          matBehind: materialBehind,
          matOccluder: materialOccluder
      });


      // ================
      // cylinders
      var axes = {
          'x': [ 'z', 'y', 'x' ],
          'y': [ 'x', 'z', 'y' ],
          'z': [ 'y', 'x', 'z' ]
      };
      for(var a in axes) {
          positions = [ ];
          indices = [ ];
          normals = [ ];
          var segments = 72;

          // side
          for(var v = 1; v >= -1; v -= 2) {
              for(var i = 0; i < segments; i++) {
                  vecA[axes[a][0]] = Math.sin(360 / segments * i * rad);
                  vecA[axes[a][1]] = Math.cos(360 / segments * i * rad);
                  vecA[axes[a][2]] = v * 0.5;

                  vecB.copy(vecA);
                  vecB[axes[a][2]] = 0;
                  positions.push(vecA.x, vecA.y, vecA.z);
                  normals.push(vecB.x, vecB.y, vecB.z);
              }
          }

          // top/bottom
          for(var v = 1; v >= -1; v -= 2) {
              vecA.set(0, 0, 0);
              vecA[axes[a][2]] = v;
              positions.push(vecA.x * 0.5, vecA.y * 0.5, vecA.z * 0.5);
              normals.push(vecA.x, vecA.y, vecA.z);

              for(var i = 0; i < segments; i++) {
                  vecA[axes[a][0]] = Math.sin(360 / segments * i * rad);
                  vecA[axes[a][1]] = Math.cos(360 / segments * i * rad);
                  vecA[axes[a][2]] = v * 0.5;

                  vecB.set(0, 0, 0);
                  vecB[axes[a][2]] = v;

                  positions.push(vecA.x, vecA.y, vecA.z);
                  normals.push(vecB.x, vecB.y, vecB.z);
              }
          }

          for(var i = 0; i < segments; i++) {
              // sides
              indices.push(i, i + segments, (i + 1) % segments);
              indices.push(i + segments, (i + 1) % segments + segments, (i + 1) % segments);

              // lids
              indices.push(segments * 2, segments * 2 + i + 1, segments * 2 + (i + 1) % segments + 1);
              indices.push(segments * 3 + 1, segments * 3 + (i + 1) % segments + 2, segments * 3 + i + 2);
          }
          models['cylinder-' + a] = createModel({
              positions: positions,
              normals: normals,
              indices: indices,
              matDefault: materialDefault,
              matBehind: materialBehind,
              matOccluder: materialOccluder
          });
      }


      // ================
      // capsules
      for(var a in axes) {
          positions = [ ];
          indices = [ ];
          var segments = 32;

          for(var y = 1; y < segments / 2 + 1; y++) {
              for(var i = 0; i < segments; i++) {
                  var k = y;
                  if (y === Math.floor(segments / 4) || y === Math.floor(segments / 4) + 1)
                      k = Math.floor(segments / 4);
                  var l = Math.sin((k * (180 / (segments / 2)) + 90) * rad);
                  var c = Math.cos((k * (180 / (segments / 2)) + 90) * rad);
                  vecA[axes[a][0]] = Math.sin(360 / segments * i * rad) * Math.abs(c);
                  vecA[axes[a][1]] = Math.cos(360 / segments * i * rad) * Math.abs(c);
                  vecA[axes[a][2]] = l;
                  positions.push(vecA.x, vecA.y, vecA.z);
                  vecA.normalize();
                  positions.push(vecA.x, vecA.y, vecA.z);
                  positions.push(y < segments / 4 ? 1 : -1);
              }
          }

          vecA.set(0, 0, 0);
          vecA[axes[a][2]] = 1;
          // top
          positions.push(vecA.x, vecA.y, vecA.z);
          positions.push(vecA.x, vecA.y, vecA.z);
          positions.push(1);
          // bottom
          vecA.scale(-1);
          positions.push(vecA.x, vecA.y, vecA.z);
          positions.push(vecA.x, vecA.y, vecA.z);
          positions.push(-1);

          // sides
          for(var y = 0; y < segments / 2 - 1; y++) {
              for(var i = 0; i < segments; i++) {
                  indices.push(y * segments + i, (y + 1) * segments + i, y * segments + (i + 1) % segments);
                  indices.push((y + 1) * segments + i, (y + 1) * segments + (i + 1) % segments, y * segments + (i + 1) % segments);
              }
          }

          // lids
          for(var i = 0; i < segments; i++) {
              indices.push(i, (i + 1) % segments, (segments / 2) * segments);
              indices.push((segments / 2 - 1) * segments + i, (segments / 2) * segments + 1, (segments / 2 - 1) * segments + (i + 1) % segments);
          }

          var bufferVertex = new pc.VertexBuffer(app.graphicsDevice, vertexFormatAttr0, positions.length / 7);
          var dst = new Float32Array(bufferVertex.lock());
          dst.set(positions);
          bufferVertex.unlock();

          var bufferIndex = new pc.IndexBuffer(app.graphicsDevice, pc.INDEXFORMAT_UINT16, indices.length);
          var dst = new Uint16Array(bufferIndex.lock());
          dst.set(indices);
          bufferIndex.unlock();

          models['capsule-' + a] = createModel({
              vertices: bufferVertex,
              indices: bufferIndex,
              count: indices.length,
              matDefault: materials['capsule-' + a],
              matBehind: materials['capsuleBehind-' + a],
              matOccluder: materials['capsuleOcclude-' + a]
          });

          var meshInstance = models['capsule-' + a].meshInstances[0];
          // TODO
      }
  });

  var createModelCopy = function(resource, color) {
      var model = resource.clone();

      var meshesExtra = [ ];

      for(var i = 0; i < model.meshInstances.length; i++) {
          model.meshInstances[i].material = materialDefault.clone();
          model.meshInstances[i].material.updateShader = materialDefault.updateShader;
          model.meshInstances[i].material.color.set(color[0], color[1], color[2], alphaFront);
          model.meshInstances[i].material.update();
          // model.meshInstances[i].layer = 12;
          model.meshInstances[i].__editor = true;
          model.meshInstances[i].__collision = true;
          model.meshInstances[i].castShadow = false;
          // model.meshInstances[i].castLightmapShadow = false;
          model.meshInstances[i].receiveShadow = false;
          model.meshInstances[i].setParameter('offset', 0);
          // model.meshInstances[i].updateKey();

          var node = model.meshInstances[i].node;
          var mesh = model.meshInstances[i].mesh;

          var meshInstanceBehind = new pc.MeshInstance(node, mesh, materialBehind.clone());
          meshInstanceBehind.material.updateShader = materialBehind.updateShader;
          meshInstanceBehind.material.color.set(color[0], color[1], color[2], alphaBehind);
          meshInstanceBehind.material.update();
          meshInstanceBehind.setParameter('offset', 0);
          meshInstanceBehind.__editor = true;
          meshInstanceBehind.pick = false;
          // meshInstanceBehind.layer = 2;
          meshInstanceBehind.drawToDepth = false;
          meshInstanceBehind.castShadow = false;
          // meshInstanceBehind.castLightmapShadow = false;
          meshInstanceBehind.receiveShadow = false;
          // meshInstanceBehind.updateKey();
          meshInstanceBehind.__useFrontLayer = true;

          // meshInstanceOccluder
          var meshInstanceOccluder = new pc.MeshInstance(node, mesh, materialOccluder);
          meshInstanceOccluder.setParameter('offset', 0);
          meshInstanceOccluder.__editor = true;
          meshInstanceOccluder.pick = false;
          // meshInstanceOccluder.layer = 9;
          meshInstanceOccluder.castShadow = false;
          // meshInstanceOccluder.castLightmapShadow = false;
          meshInstanceOccluder.receiveShadow = false;
          // meshInstanceOccluder.updateKey();

          meshesExtra.push(meshInstanceBehind, meshInstanceOccluder);
      }

      model.meshInstances = model.meshInstances.concat(meshesExtra);

      return model;
  };

  editor.on('viewport:gizmoUpdate', function(dt) {
      for(var key in entities)
          entities[key].update();
  });
});


/* editor/gizmo/gizmo-particles.js */
editor.once('load', function () {
  'use strict';

  var app;
  // selected entity gizmos
  var entities = { };
  // pool of gizmos
  var pool = [ ];
  // colors
  var colorBehind = new pc.Color(1, 1, 1, .15);
  var colorPrimary = new pc.Color(1, 1, 1);
  var container;
  var materialDefault;
  var materialBehind = new pc.BasicMaterial();
  materialBehind.color = colorBehind;
  materialBehind.blend = true;
  materialBehind.blendSrc = pc.BLENDMODE_SRC_ALPHA;
  materialBehind.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
  materialBehind.depthTest = false;
  materialBehind.update();
  var models = { };
  var poolModels = { 'box': [ ], 'sphere': [ ] };
  var shapes = { 0: 'box', 1: 'sphere' };

  var layerBack = editor.call('gizmo:layers', 'Bright Gizmo');
  var layerFront = editor.call('gizmo:layers', 'Dim Gizmo');

  // hack: override addModelToLayers to selectively put some
  // mesh instances to the front and others to the back layer depending
  // on the __useFrontLayer property
  var addModelToLayers = function () {
      var frontMeshInstances = this.meshInstances.filter(function (mi) {
          return mi.__useFrontLayer;
      });
      var backMeshInstances = this.meshInstances.filter(function (mi) {
          return ! mi.__useFrontLayer;
      });

      layerFront.addMeshInstances(frontMeshInstances);
      layerBack.addMeshInstances(backMeshInstances);
  };

  // gizmo class
  function Gizmo() {
      this._link = null;
      this.events = [ ];
      this.type = '';
      this.entity = null;
  }
  // update lines
  Gizmo.prototype.update = function() {
      if (! app) return; // webgl not available

      if (! this._link || ! this._link.entity)
          return;

      var particles = this._link.entity.particlesystem;
      this.entity.enabled = this._link.entity.enabled && particles && particles.enabled;
      if (! this.entity.enabled)
          return;

      this.entity.setPosition(this._link.entity.getPosition());
      this.entity.setRotation(this._link.entity.getRotation());

      var type = shapes[particles.emitterShape];

      if (this.type !== type) {
          this.type = type;

          // set new model based on type
          if (models[this.type]) {
              // get current model
              var model = this.entity.model.model;
              if (model) {
                  // put back in pool
                  app.scene.removeModel(model);
                  this.entity.removeChild(model.getGraph());
                  if (poolModels[model._type])
                      poolModels[model._type].push(model);
              }
              // get from pool
              model = null;
              if (poolModels[this.type])
                  model = poolModels[this.type].shift();

              if (! model) {
                  // no in pool
                  model = models[this.type].clone();
                  for (var i = 0; i < model.meshInstances.length; i++) {
                      model.meshInstances[i].__useFrontLayer = models[this.type].meshInstances[i].__useFrontLayer;
                  }
                  model._type = this.type;
              }
              // set to model
              this.entity.model.model = model;
              // mask meshinstance from camera preview
              model.meshInstances.forEach(function (mi) {
                  mi.mask = GIZMO_MASK;
              });
              this.entity.setLocalScale(1, 1, 1);
          } else {
              this.entity.enabled = false;
              this.entity.model.model = null;
              return;
          }
      }

      switch(this.type) {
          case 'sphere':
              this.entity.setLocalScale(particles.emitterRadius || .000001, particles.emitterRadius || .000001, particles.emitterRadius || .000001);
              break;
          case 'box':
              this.entity.setLocalScale(particles.emitterExtents.x / 2 || .00001, particles.emitterExtents.y / 2 || .00001, particles.emitterExtents.z / 2 || .00001);
              break;
      }
  };
  // link to entity
  Gizmo.prototype.link = function(obj) {
      if (! app) return; // webgl not available

      this.unlink();
      this._link = obj;

      var self = this;

      this.events.push(this._link.once('destroy', function() {
          self.unlink();
      }));

      this.entity = new pc.Entity();
      this.entity.addComponent('model', {
          castShadows: false,
          receiveShadows: false,
          castShadowsLightmap: false,
          layers: [layerFront.id, layerBack.id]
      });
      this.entity.model.addModelToLayers = addModelToLayers;

      container.addChild(this.entity);
  };
  // unlink
  Gizmo.prototype.unlink = function() {
      if (! app) return; // webgl not available

      if (! this._link)
          return;

      for(var i = 0; i < this.events.length; i++) {
          if (this.events[i] && this.events[i].unbind)
              this.events[i].unbind();
      }

      this.events = [ ];
      this._link = null;
      this.type = '';

      var model = this.entity.model.model;
      if (model) {
          // put back in pool
          app.scene.removeModel(model);
          this.entity.removeChild(model.getGraph());
          if (model._type)
              poolModels[model._type].push(model);
      }

      this.entity.destroy();
  };

  editor.on('selector:change', function(type, items) {
      // clear gizmos
      if (type !== 'entity') {
          for(var key in entities) {
              entities[key].unlink();
              pool.push(entities[key]);
          }
          entities = { };
          return;
      }

      // index selection
      var ids = { };
      for(var i = 0; i < items.length; i++)
          ids[items[i].get('resource_id')] = items[i];

      var render = false;

      // remove
      for(var key in entities) {
          if (ids[key])
              continue;

          pool.push(entities[key]);
          entities[key].unlink();
          delete entities[key];
          render = true;
      }

      // add
      for(var key in ids) {
          if (entities[key])
              continue;

          var gizmo = pool.shift();
          if (! gizmo)
              gizmo = new Gizmo();

          gizmo.link(ids[key]);
          entities[key] = gizmo;
          render = true;
      }

      if (render)
          editor.call('viewport:render');
  });

  editor.once('viewport:load', function() {
      app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      container = new pc.Entity(app);
      app.root.addChild(container);

      // material
      materialDefault = new pc.BasicMaterial();
      materialDefault.color = colorPrimary;
      materialDefault.update();

      var buffer, iterator, size, length, node, mesh, meshInstance, model;
      var vertexFormat = new pc.VertexFormat(app.graphicsDevice, [
          { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 }
      ]);
      var vertexFormatAttr0 = new pc.VertexFormat(app.graphicsDevice, [
          { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
          { semantic: pc.SEMANTIC_ATTR0, components: 1, type: pc.TYPE_FLOAT32 }
      ]);
      var rad = Math.PI / 180;


      // ================
      // box
      buffer = new pc.VertexBuffer(app.graphicsDevice, vertexFormat, 12 * 2);
      iterator = new pc.VertexIterator(buffer);
      // top
      iterator.element[pc.SEMANTIC_POSITION].set(1, 1, 1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(1, 1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(1, 1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, 1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, 1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, 1, 1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, 1, 1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(1, 1, 1);
      iterator.next();
      // bottom
      iterator.element[pc.SEMANTIC_POSITION].set(1, -1, 1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(1, -1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(1, -1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, -1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, -1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, -1, 1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, -1, 1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(1, -1, 1);
      iterator.next();
      // sides
      iterator.element[pc.SEMANTIC_POSITION].set(1, -1, 1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(1, 1, 1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(1, -1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(1, 1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, -1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, 1, -1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, -1, 1);
      iterator.next();
      iterator.element[pc.SEMANTIC_POSITION].set(-1, 1, 1);
      iterator.next();
      iterator.end();
      // node
      node = new pc.GraphNode();
      // mesh
      mesh = new pc.Mesh();
      mesh.vertexBuffer = buffer;
      mesh.indexBuffer[0] = null;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = buffer.getNumVertices();
      mesh.primitive[0].indexed = false;
      // meshInstance
      meshInstance = new pc.MeshInstance(node, mesh, materialDefault);
      meshInstance.mask = GIZMO_MASK;
      meshInstance.updateKey();

      var meshInstanceBehind = new pc.MeshInstance(node, mesh, materialBehind);
      meshInstanceBehind.mask = GIZMO_MASK;
      meshInstanceBehind.__useFrontLayer = true;

      // model
      model = new pc.Model();
      model.graph = node;
      model.meshInstances = [ meshInstance, meshInstanceBehind ];
      models['box'] = model;


      // ================
      // sphere
      var segments = 72;
      buffer = new pc.VertexBuffer(app.graphicsDevice, vertexFormat, segments * 2 * 3);
      iterator = new pc.VertexIterator(buffer);
      // circles
      for(var i = 0; i < segments; i++) {
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * i * rad), 0, Math.cos(360 / segments * i * rad));
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * (i + 1) * rad), 0, Math.cos(360 / segments * (i + 1) * rad));
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * i * rad), Math.cos(360 / segments * i * rad), 0);
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(Math.sin(360 / segments * (i + 1) * rad), Math.cos(360 / segments * (i + 1) * rad), 0);
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(0, Math.cos(360 / segments * i * rad), Math.sin(360 / segments * i * rad));
          iterator.next();
          iterator.element[pc.SEMANTIC_POSITION].set(0, Math.cos(360 / segments * (i + 1) * rad), Math.sin(360 / segments * (i + 1) * rad));
          iterator.next();
      }
      iterator.end();
      // node
      node = new pc.GraphNode();
      // mesh
      mesh = new pc.Mesh();
      mesh.vertexBuffer = buffer;
      mesh.indexBuffer[0] = null;
      mesh.primitive[0].type = pc.PRIMITIVE_LINES;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].count = buffer.getNumVertices();
      mesh.primitive[0].indexed = false;
      // meshInstance
      meshInstance = new pc.MeshInstance(node, mesh, materialDefault);
      meshInstance.updateKey();

      meshInstanceBehind = new pc.MeshInstance(node, mesh, materialBehind);
      meshInstanceBehind.__useFrontLayer = true;

      // model
      model = new pc.Model();
      model.graph = node;
      model.meshInstances = [ meshInstance, meshInstanceBehind ];
      models['sphere'] = model;
  });

  editor.on('viewport:gizmoUpdate', function(dt) {
      for(var key in entities)
          entities[key].update();
  });
});


/* editor/gizmo/gizmo-bounding-box.js */
editor.once('load', function () {
  'use strict';
  var app = null;
  var entities = [ ];

  var BOUNDING_BOX_MIN_EXTENTS = new pc.Vec3(0.01, 0.01, 0.01);

  var visible = true;

  var color = new pc.Color(1, 1, 1);
  var colorBehind = new pc.Color(1, 1, 1, .2);

  var colorNew = new pc.Color(1, .5, 0);

  var immediateRenderOptions;
  var immediateMaskRenderOptions;

  var points = [ ];
  for(var c = 0; c < 32; c++)
      points[c] = new pc.Vec3();

  // temp variables for getBoundingBoxForHierarchy
  var _entityResultBB = new pc.BoundingBox();

  // temp variables for getBoundingBoxForEntity
  var _tmpBB = new pc.BoundingBox();
  var _matA = new pc.Mat4();

  // temp variables for entities:getBoundingBoxForEntity
  var _resultBB = new pc.BoundingBox();

  // tmp variable used to render bounding box
  var _selectionBB = new pc.BoundingBox();

  editor.on('selector:change', function(type, items) {
      if (type === 'entity') {
          entities = items.map(function(item) {
              return item.entity;
          });
      } else {
          entities = [ ];
      }
  });

  editor.method('gizmo:boundingbox:visible', function(state) {
      if (state !== visible) {
          visible = state;
          editor.call('viewport:render');
      }
  });

  editor.method('viewport:render:aabb', function(aabb) {
      if (! app) return; // webgl not available

      if (! visible) return;

      var ind = 0;
      for(var x = -1; x <= 1; x += 2) {
          for(var y = -1; y <= 1; y += 2) {
              for(var z = -1; z <= 1; z += 2) {
                  points[ind * 4].copy(aabb.halfExtents);
                  points[ind * 4].x *= x;
                  points[ind * 4].y *= y;
                  points[ind * 4].z *= z;
                  points[ind * 4].add(aabb.center);

                  points[ind * 4 + 1].copy(points[ind * 4]);
                  points[ind * 4 + 1].x -= aabb.halfExtents.x * .3 * x;

                  points[ind * 4 + 2].copy(points[ind * 4]);
                  points[ind * 4 + 2].y -= aabb.halfExtents.y * .3 * y;

                  points[ind * 4 + 3].copy(points[ind * 4]);
                  points[ind * 4 + 3].z -= aabb.halfExtents.z * .3 * z;

                  app.renderLine(points[ind * 4], points[ind * 4 + 1], colorBehind, immediateRenderOptions);
                  app.renderLine(points[ind * 4], points[ind * 4 + 2], colorBehind, immediateRenderOptions);
                  app.renderLine(points[ind * 4], points[ind * 4 + 3], colorBehind, immediateRenderOptions);

                  app.renderLine(points[ind * 4], points[ind * 4 + 1], color, immediateMaskRenderOptions);
                  app.renderLine(points[ind * 4], points[ind * 4 + 2], color, immediateMaskRenderOptions);
                  app.renderLine(points[ind * 4], points[ind * 4 + 3], color, immediateMaskRenderOptions);

                  ind++;
              }
          }
      }
  });


  // Get the bounding box the encloses a hierarchy of entities
  // {pc.Entity} root - the root entity of the hierarchy
  var getBoundingBoxForHierarchy = function (root, hierarchyBB) {
      var bb = getBoundingBoxForEntity(root, _entityResultBB);

      // first time through we initialize with the new boundingbox
      if (!hierarchyBB) {
          hierarchyBB = new pc.BoundingBox();
          hierarchyBB.copy(bb);
      } else {
          hierarchyBB.add(bb);
      }

      var children = root.children;
      for(var i = 0; i < children.length; i++) {
          if (children[i].__editor || ! (children[i] instanceof pc.Entity))
              continue;

          // now we pass in the bounding box to be added to
          getBoundingBoxForHierarchy(children[i], hierarchyBB);
      }

      return hierarchyBB;
  };

  // calculate the bounding box for a single entity and return it
  // bounding box is calculated from one of the components
  // attached to the entity in a priority order
  var getBoundingBoxForEntity = function (entity, resultBB) {
      // why is this here? to sync the hierarchy?
      entity.getWorldTransform();

      // clear result box
      resultBB.center.set(0, 0, 0);
      resultBB.halfExtents.set(0, 0, 0);

      // first choice is to use the bounding box of all mesh instances on a model component
      if (entity.model && entity.model.model && entity.model.meshInstances.length) {
          var meshInstances = entity.model.meshInstances;

          for(var i = 0; i < meshInstances.length; i++) {
              if (meshInstances[i]._hidden)
                  continue;

              // not sure why this is here, probably to force hierachy to sync
              meshInstances[i].node.getWorldTransform();

              if (i === 0) {
                  resultBB.copy(meshInstances[i].aabb);
              } else {
                  resultBB.add(meshInstances[i].aabb);
              }
          }

          return resultBB;
      }

      // next is the collision bounding box
      if (entity.collision) {
          switch(entity.collision.type) {
              case 'box':
                  _tmpBB.center.set(0, 0, 0);
                  _tmpBB.halfExtents.copy(entity.collision.halfExtents);
                  resultBB.setFromTransformedAabb(_tmpBB, entity.getWorldTransform());
                  return resultBB;
              case 'sphere':
                  resultBB.center.copy(entity.getPosition());
                  resultBB.halfExtents.set(entity.collision.radius, entity.collision.radius, entity.collision.radius);
                  return resultBB;
              case 'capsule':
              case 'cylinder':
                  _tmpBB.halfExtents.set(entity.collision.radius, entity.collision.radius, entity.collision.radius);
                  var axes = ['x', 'y', 'z'];
                  _tmpBB.halfExtents[axes[entity.collision.axis]] = entity.collision.height / 2;
                  resultBB.setFromTransformedAabb(_tmpBB, entity.getWorldTransform());
                  return resultBB;
          }
      }

      // the an element component
      if (entity.element) {
          // if the element has an aabb (image or text element)
          var aabb = entity.element.aabb;
          if (aabb) {
              resultBB.copy(aabb);
          } else {
              resultBB.center.copy(entity.getPosition());
              // otherwise for group element use the world corners
              entity.element.worldCorners.forEach(function (corner) {
                  _tmpBB.center.copy(corner);
                  _tmpBB.halfExtents.set(0, 0, 0);
                  resultBB.add(_tmpBB);
              });
          }
          return resultBB;
      }

      // then sprite component
      if (entity.sprite) {
          var aabb = entity.sprite.aabb;
          if (aabb) {
              resultBB.copy(aabb);
          }
          return resultBB;
      }

      // the particle system
      if (entity.particlesystem) {
          if (entity.particlesystem.emitter) {
              _tmpBB.center.set(0,0,0);
              _tmpBB.copy(entity.particlesystem.emitter.localBounds);
              resultBB.setFromTransformedAabb(_tmpBB, entity.getWorldTransform());
              return resultBB;
          } else if (entity.particlesystem.emitterShape === pc.EMITTERSHAPE_BOX) {
              _tmpBB.center.set(0,0,0);
              _tmpBB.halfExtents.copy(entity.particlesystem.emitterExtents).scale(0.5);
              resultBB.setFromTransformedAabb(_tmpBB, entity.getWorldTransform());
              return resultBB;
          } else if (entity.particlesystem.emitterShape === pc.EMITTERSHAPE_SPHERE) {
              resultBB.center.copy(entity.getPosition());
              resultBB.halfExtents.set(entity.particlesystem.emitterRadius, entity.particlesystem.emitterRadius, entity.particlesystem.emitterRadius);
              return resultBB;
          }
      }

      // then zone
      if (entity.zone) {
          _tmpBB.halfExtents.copy(entity.zone.size).scale(0.5);
          var position = entity.getPosition();
          var rotation = entity.getRotation();
          _matA.setTRS(position, rotation, pc.Vec3.ONE);
          resultBB.setFromTransformedAabb(_tmpBB, _matA);
          return resultBB;
      }

      // finally just return a default bounding box
      resultBB.center.copy(entity.getPosition());
      resultBB.halfExtents.copy(BOUNDING_BOX_MIN_EXTENTS);
      return resultBB;
  };

  editor.method('entities:getBoundingBoxForEntity', function(entity) {
      return getBoundingBoxForEntity(entity, _resultBB);
  });

  editor.once('viewport:load', function() {
      app = editor.call('viewport:app');

      immediateRenderOptions = {
          layer: editor.call('gizmo:layers', 'Axis Gizmo Immediate'),
          mask: GIZMO_MASK
      };

      immediateMaskRenderOptions = {
          layer: editor.call('gizmo:layers', 'Bright Gizmo'),
          mask: GIZMO_MASK
      };

      editor.on('viewport:postUpdate', function() {
          if (! entities.length)
              return;

          // firstBB = true;
          var noEntities = true;

          for(var i = 0; i < entities.length; i++) {
              if (! entities[i])
                  continue;

              noEntities = false;
              var entityBox = getBoundingBoxForHierarchy(entities[i]);
              if (i === 0) {
                  _selectionBB.copy(entityBox);
              } else {
                  _selectionBB.add(entityBox);
              }
          }

          if (! noEntities) {
              _selectionBB.halfExtents.add(BOUNDING_BOX_MIN_EXTENTS);
              editor.call('viewport:render:aabb', _selectionBB);
          }
      });
  });
});


/* editor/gizmo/gizmo-zone.js */
editor.once('load', function() {
  'use strict';

  var app;
  var visible = false;

  var immediateRenderOptions;

  var layerFront = editor.call('gizmo:layers', 'Bright Collision');
  var layerBack = editor.call('gizmo:layers', 'Dim Gizmo');

  var filterPicker = function(drawCall) {
      if (drawCall.command)
          return true;

      return (drawCall.__editor && drawCall.__zone) || drawCall.layer === pc.LAYER_GIZMO;
  };

  // hack: override addModelToLayers to selectively put some
  // mesh instances to the front and others to the back layer depending
  // on the __useFrontLayer property
  var addModelToLayers = function () {
      var frontMeshInstances = this.meshInstances.filter(function (mi) {
          return mi.__useFrontLayer;
      });
      var backMeshInstances = this.meshInstances.filter(function (mi) {
          return ! mi.__useFrontLayer;
      });

      // layerBack.addMeshInstances(frontMeshInstances);
      layerFront.addMeshInstances(backMeshInstances);
  };

  editor.method('gizmo:zone:visible', function(state) {
      if (state === undefined)
          return visible;

      if (visible === !! state)
          return;

      visible = state;

      if (visible) {
          editor.call('gizmo:collision:visible', false);
          editor.call('viewport:pick:filter', filterPicker);
      } else {
          editor.call('viewport:pick:filter', null);
      }

      editor.emit('gizmo:zone:visible', visible);
      editor.call('viewport:render');
  });

  editor.once('viewport:load', function () {
      app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      var container = new pc.Entity();
      container.name = 'zones';
      container.__editor = true;
      app.root.addChild(container);

      // entity gizmos
      var entities = { };
      var selected = { };

      // pool of gizmos
      var pool = [ ];
      var models = { };
      var poolModels = {
          'box': [ ]
      };
      var zones = 0;
      var lastZone = null;
      var historyPositon = new pc.Vec3();
      var historySize = new pc.Vec3();
      var points = [ ];
      var hoverPoint = null;
      var dragPoint = null;
      var dragLength = 0;
      var dragPos = new pc.Vec3();
      var dragGizmoType = '';
      var events = [ ];

      var vecA = new pc.Vec3();
      var vecB = new pc.Vec3();
      var vecC = new pc.Vec3();
      var vecD = new pc.Vec3();
      var quatA = new pc.Quat();
      var quatB = new pc.Quat();
      var quatC = new pc.Quat();

      var axesInd = { 'x': 0, 'y': 1, 'z': 2 };
      var axes = [ 'z', 'x', 'z', 'x', 'y', 'y' ];
      var direction = [ -1, 1, 1, -1, 1, -1 ];
      var eulers = [
          [ -90, 0, 0 ], // front
          [ 90, 90, 0 ], // right
          [ 90, 0, 0 ], // back
          [ 90, -90, 0 ], // left
          [ 0, 0, 0 ], // top
          [ 180, 0, 0 ]  // bottom
      ];
      var scales = [
          [ 'x', 'y', ], // front
          [ 'z', 'y', ], // right
          [ 'x', 'y', ], // back
          [ 'z', 'y', ], // left
          [ 'x', 'z', ], // top
          [ 'x', 'z', ]  // bottom
      ];
      var materials = [
          new pc.Color(0, 0, 1),
          new pc.Color(1, 0, 0),
          new pc.Color(0, 0, 1),
          new pc.Color(1, 0, 0),
          new pc.Color(0, 1, 0),
          new pc.Color(0, 1, 0)
      ];
      for(var i = 0; i < materials.length; i++) {
          var color = materials[i];
          materials[i] = new pc.BasicMaterial();
          materials[i].color = color;
          materials[i].update();
      }

      var alphaFront = 0.6;
      var alphaBehind = 0.1;
      var colorDefault = [ 1, 1, 1 ];
      var colorPrimary = new pc.Color(1, 1, 1, alphaFront);
      var colorBehind = new pc.Color(1, 1, 1, alphaBehind);
      var colorOccluder = new pc.Color(1, 1, 1, 1);

      // material
      var defaultVShader = ' \
          attribute vec3 aPosition;\n \
          attribute vec3 aNormal;\n \
          varying vec3 vNormal;\n \
          varying vec3 vPosition;\n \
          uniform float offset;\n \
          uniform mat4 matrix_model;\n \
          uniform mat3 matrix_normal;\n \
          uniform mat4 matrix_view;\n \
          uniform mat4 matrix_viewProjection;\n \
          void main(void)\n \
          {\n \
              vec4 posW = matrix_model * vec4(aPosition, 1.0);\n \
              vNormal = normalize(matrix_normal * aNormal);\n \
              posW += vec4(vNormal * offset, 0.0);\n \
              gl_Position = matrix_viewProjection * posW;\n \
              vPosition = posW.xyz;\n \
          }\n';
      var defaultFShader = ' \
          precision ' + app.graphicsDevice.precision + ' float;\n \
          varying vec3 vNormal;\n \
          varying vec3 vPosition;\n \
          uniform vec4 uColor;\n \
          uniform vec3 view_position;\n \
          void main(void)\n \
          {\n \
              vec3 viewNormal = normalize(view_position - vPosition);\n \
              float light = abs(dot(vNormal, viewNormal));\n \
              gl_FragColor = vec4(uColor.rgb * light * 2.0, uColor.a);\n \
          }\n';

      var shaderDefault;
      var materialDefault = new pc.BasicMaterial();
      materialDefault.updateShader = function(device) {
          if (! shaderDefault) {
              shaderDefault = new pc.Shader(device, {
                  attributes: {
                      aPosition: pc.SEMANTIC_POSITION,
                      aNormal: pc.SEMANTIC_NORMAL
                  },
                  vshader: defaultVShader,
                  fshader: defaultFShader
              });
          }

          this.shader = shaderDefault;
      };
      materialDefault.cull = pc.CULLFACE_NONE;
      materialDefault.color = colorPrimary;
      materialDefault.blend = true;
      materialDefault.blendSrc = pc.BLENDMODE_SRC_ALPHA;
      materialDefault.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
      materialDefault.update();

      var materialBehind = new pc.BasicMaterial();
      materialBehind.updateShader = materialDefault.updateShader;
      materialBehind.color = colorBehind;
      materialBehind.blend = true;
      materialBehind.blendSrc = pc.BLENDMODE_SRC_ALPHA;
      materialBehind.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
      materialBehind.depthWrite = false;
      materialBehind.depthTest = true;
      materialBehind.cull = pc.CULLFACE_NONE;
      materialBehind.update();

      var materialOccluder = new pc.BasicMaterial();
      materialOccluder.color = colorOccluder;
      materialOccluder.redWrite = false;
      materialOccluder.greenWrite = false;
      materialOccluder.blueWrite = false;
      materialOccluder.alphaWrite = false;
      materialOccluder.depthWrite = true;
      materialOccluder.depthTest = true;
      materialOccluder.cull = pc.CULLFACE_NONE;
      materialOccluder.update();

      var materialWireframe = new pc.BasicMaterial();
      materialWireframe.color = new pc.Color(1, 1, 1, 0.4);
      materialWireframe.depthWrite = false;
      materialWireframe.depthTest = false;
      materialWireframe.update();

      var materialPlaneBehind = new pc.BasicMaterial();
      materialPlaneBehind.color = new pc.Color(1, 1, 1, 0.4);
      materialPlaneBehind.blend = true;
      materialPlaneBehind.blendSrc = pc.BLENDMODE_SRC_ALPHA;
      materialPlaneBehind.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
      materialPlaneBehind.cull = pc.CULLFACE_NONE;
      materialPlaneBehind.update();

      var materialPlane = new pc.BasicMaterial();
      materialPlane.color = new pc.Color(1, 1, 1, 0.1);
      materialPlane.blend = true;
      materialPlane.blendSrc = pc.BLENDMODE_SRC_ALPHA;
      materialPlane.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
      materialPlane.depthTest = false;
      materialPlane.cull = pc.CULLFACE_NONE;
      materialPlane.update();

      var handleHighlightMaterial = new pc.BasicMaterial();
      handleHighlightMaterial.color = new pc.Color(1,1,1,0.1);
      handleHighlightMaterial.update();

      var plane = new pc.Entity();
      plane.enabled = false;
      plane.__editor = true;
      plane.addComponent('model', {
          type: 'plane',
          receiveShadows: false,
          castShadowsLightmap: false,
          castShadows: false,
          layers: [layerBack.id, layerFront.id]
      });
      plane.model.addModelToLayers = addModelToLayers;

      var instance = plane.model.meshInstances[0];
      instance.material = materialPlane;
      var instanceBehind = new pc.MeshInstance(instance.node, instance.mesh, materialPlaneBehind);
      plane.model.meshInstances.push(instanceBehind);
      instanceBehind.__useFrontLayer = true;

      immediateRenderOptions = {
          layer: editor.call('gizmo:layers', 'Axis Gizmo Immediate')
      };

      // gizmo class
      function Gizmo() {
          this._link = null;
          this.events = [ ];
          this.entity = null;
          this.type = '';
          this.color;
      }

      // update lines
      Gizmo.prototype.update = function() {
          if (! this._link || ! this._link.entity)
              return;

          var zone = this._link.entity.zone;
          var select = selected[this._link.get('resource_id')] === this._link;

          this.entity.enabled = this._link.entity.enabled && zone && zone.enabled && (select || visible);
          if (! this.entity.enabled)
              return;

          if (this.type !== 'box') {
              this.type = 'box';

              if (! this.color && this._link.entity) {
                  var hash = 0;
                  var string = this._link.entity.getGuid();
                  for (var i = 0; i < string.length; i++)
                      hash += string.charCodeAt(i);

                  this.color = editor.call('color:hsl2rgb', (hash % 128) / 128, 0.5, 0.5);
              }

              if (models[this.type]) {
                  var model = this.entity.model.model;
                  if (model) {
                      app.scene.removeModel(model);
                      this.entity.removeChild(model.getGraph());
                      poolModels[model._type].push(model);
                  }

                  model = poolModels[this.type].shift();
                  if (! model) {
                      model = models[this.type].clone();
                      model._type = this.type;

                      var color = this.color || colorDefault;

                      var old = model.meshInstances[0].material;
                      model.meshInstances[0].setParameter('offset', 0);
                      // model.meshInstances[0].layer = 12;
                      // model.meshInstances[0].updateKey();
                      model.meshInstances[0].mask = GIZMO_MASK;
                      model.meshInstances[0].__editor = true;
                      model.meshInstances[0].__zone = true;
                      model.meshInstances[0].material = old.clone();
                      model.meshInstances[0].material.updateShader = old.updateShader;
                      model.meshInstances[0].material.color.set(color[0], color[1], color[2], alphaFront);
                      model.meshInstances[0].material.update();

                      var old = model.meshInstances[1].material;
                      model.meshInstances[1].setParameter('offset', 0.001);
                      // model.meshInstances[1].layer = 2;
                      model.meshInstances[1].pick = false;
                      // model.meshInstances[1].updateKey();
                      model.meshInstances[1].mask = GIZMO_MASK;
                      model.meshInstances[1].__editor = true;
                      model.meshInstances[1].material = old.clone();
                      model.meshInstances[1].material.updateShader = old.updateShader;
                      model.meshInstances[1].material.color.set(color[0], color[1], color[2], alphaBehind);
                      model.meshInstances[1].material.update();
                      model.meshInstances[1].__useFrontLayer = true;

                      model.meshInstances[2].mask = GIZMO_MASK;

                      model.meshInstances[3].setParameter('offset', 0);
                      model.meshInstances[3].mask = GIZMO_MASK;
                      // model.meshInstances[2].layer = 9;
                      model.meshInstances[3].pick = false;
                      // model.meshInstances[2].updateKey();
                      model.meshInstances[3].__editor = true;
                  }

                  this.entity.model.model = model;
                  this.entity.enabled = true;
              } else {
                  this.entity.model.model = null;
                  this.entity.enabled = false;
              }
          }

          if (this.entity && this.entity.enabled) {
              this.entity.setLocalPosition(this._link.entity.getPosition());
              this.entity.setLocalRotation(this._link.entity.getRotation());
              this.entity.setLocalScale(this._link.entity.zone.size);
          }

          if (select) {
              zones++;
              lastZone = this;
          }
      };

      // link to entity
      Gizmo.prototype.link = function(obj) {
          this.unlink();
          this._link = obj;

          var self = this;

          this.events.push(this._link.once('destroy', function() {
              self.unlink();
          }));

          this.entity = new pc.Entity();
          this.entity.addComponent('model', {
              castShadows: false,
              receiveShadows: false,
              castShadowsLightmap: false,
              layers: [layerBack.id, layerFront.id]
          });
          this.entity.model.addModelToLayers = addModelToLayers;
          this.entity._getEntity = function() {
              return self._link.entity;
          };
          this.entity.setLocalScale(1, 1, 1);
          this.entity.__editor = true;

          container.addChild(this.entity);
      };

      // unlink
      Gizmo.prototype.unlink = function() {
          if (! this._link)
              return;

          for(var i = 0; i < this.events.length; i++)
              this.events[i].unbind();

          this.events = [ ];
          this._link = null;

          var model = this.entity.model.model;
          if (model) {
              // put back in pool
              app.scene.removeModel(model);
              this.entity.removeChild(model.getGraph());
              this.entity.model.model = null;
              poolModels[model._type].push(model);
          }

          container.removeChild(this.entity);
          this.entity = null;
          this.type = '';
      };

      var onPointFocus = function() {
          if (hoverPoint)
              hoverPoint.entity.model.meshInstances[0].material = materials[hoverPoint.ind];

          hoverPoint = this;
          hoverPoint.entity.model.meshInstances[0].material = handleHighlightMaterial;
          plane.enabled = true;
      };

      var onPointBlur = function() {
          if (hoverPoint === this) {
              hoverPoint.entity.model.meshInstances[0].material = materials[hoverPoint.ind];
              hoverPoint = null;
              plane.enabled = false;
          }
      };

      var onPointDragStart = function() {
          if (! editor.call('permissions:write'))
              return;

          dragPoint = hoverPoint;
          dragLength = lastZone._link.entity.zone.size[dragPoint.axis];
          dragPos.copy(lastZone._link.entity.getLocalPosition());
          dragGizmoType = editor.call('gizmo:type');
          editor.call('gizmo:' + dragGizmoType + ':toggle', false);

          for(var i = 0; i < points.length; i++)
              points[i].entity.enabled = false;

          lastZone.entity.model.meshInstances[1].visible = false;
          editor.call('viewport:render');

          lastZone._link.history.enabled = false;

          var position = lastZone._link.get('position');
          var size = lastZone._link.get('components.zone.size');
          historyPositon.set(position[0], position[1], position[2]);
          historySize.set(size[0], size[1], size[2]);
      };

      var onPointDragEnd = function() {
          dragPoint = null;
          editor.call('gizmo:' + dragGizmoType + ':toggle', true);

          for(var i = 0; i < points.length; i++)
              points[i].entity.enabled = true;

          lastZone.entity.model.meshInstances[1].visible = true;
          editor.call('viewport:render');

          lastZone._link.history.enabled = true;

          var getItem = lastZone._link.history._getItemFn;

          var newPosition = lastZone._link.get('position');
          var newSize = lastZone._link.get('components.zone.size');

          var prevPosition = [ historyPositon.x, historyPositon.y, historyPositon.z ];
          var prevSize = [ historySize.x, historySize.y, historySize.z ];

          editor.call('history:add', {
              name: 'entity.zone',
              undo: function() {
                  var item = getItem();
                  if (! item) return;

                  item.history.enabled = false;
                  item.set('position', prevPosition);
                  item.set('components.zone.size', prevSize);
                  item.history.enabled = true;
              },
              redo: function() {
                  var item = getItem();
                  if (! item) return;

                  item.history.enabled = false;
                  item.set('position', newPosition);
                  item.set('components.zone.size', newSize);
                  item.history.enabled = true;
              }
          });
      };

      var onPointDragMove = function(length) {
          var size = Math.max(0.000000001, dragLength + length);
          lastZone._link.set('components.zone.size.' + axesInd[dragPoint.axis], size);

          quatA.copy(lastZone._link.entity.getRotation());
          vecA.set(0, 0, 0);
          vecA[dragPoint.axis] = (Math.max(0.000000001, dragLength + length * 0.5) - dragLength) * dragPoint.dir;
          quatA.transformVector(vecA, vecA);
          vecB.copy(dragPos).add(vecA);

          lastZone._link.set('position', [ vecB.x, vecB.y, vecB.z ]);

          pointsUpdate();
          editor.call('viewport:render');
      };

      var pointsCreate = function() {
          for(var i = 0; i < 6; i++) {
              var point = editor.call('gizmo:point:create', axes[i], null, direction[i]);
              point.ind = i;
              point.entity.model.meshInstances[0].material = materials[i];
              point.scale[scales[i][0]] = 2;
              point.scale[scales[i][1]] = 2;

              point.entity.enabled = editor.call('permissions:write');

              events.push(point.on('focus', onPointFocus));
              events.push(point.on('blur', onPointBlur));
              events.push(point.on('dragStart', onPointDragStart));
              events.push(point.on('dragEnd', onPointDragEnd));
              events.push(point.on('dragMove', onPointDragMove));
              points.push(point);
          }

          container.addChild(plane);
          editor.call('viewport:render');
      };

      editor.on('permissions:writeState', function(state) {
          if (! points || ! points.length)
              return;

          for(var i = 0; i < points.length; i++)
              points[i].entity.enabled = state;
      });

      var pointsDestroy = function() {
          for(var i = 0; i < points.length; i++)
              editor.call('gizmo:point:recycle', points[i]);

          for(var i = 0; i < events.length; i++)
              events[i].unbind();

          events = [ ];
          points = [ ];
          container.removeChild(plane);
      };

      var pointsUpdate = function() {
          var transform = lastZone.entity.getWorldTransform();
          var position = transform.getTranslation();
          var rotation = quatA.setFromMat4(transform);
          var scale = vecB.copy(lastZone._link.entity.zone.size.clone());

          // front
          vecA.set(0, 0, -0.5);
          transform.transformPoint(vecA, vecA);
          points[0].entity.setLocalPosition(vecA);
          points[0].entity.setLocalRotation(rotation);
          points[0].update();

          // right
          vecA.set(0.5, 0, 0);
          transform.transformPoint(vecA, vecA);
          points[1].entity.setLocalPosition(vecA);
          points[1].entity.setLocalRotation(rotation);
          points[1].update();

          // back
          vecA.set(0, 0, 0.5);
          transform.transformPoint(vecA, vecA);
          points[2].entity.setLocalPosition(vecA);
          points[2].entity.setLocalRotation(rotation);
          points[2].update();

          // left
          vecA.set(-0.5, 0, 0);
          transform.transformPoint(vecA, vecA);
          points[3].entity.setLocalPosition(vecA);
          points[3].entity.setLocalRotation(rotation);
          points[3].update();

          // top
          vecA.set(0, 0.5, 0);
          transform.transformPoint(vecA, vecA);
          points[4].entity.setLocalPosition(vecA);
          points[4].entity.setLocalRotation(rotation);
          points[4].update();

          // bottom
          vecA.set(0, -0.5, 0);
          transform.transformPoint(vecA, vecA);
          points[5].entity.setLocalPosition(vecA);
          points[5].entity.setLocalRotation(rotation);
          points[5].update();

          if (hoverPoint) {
              hoverPoint.rotation.copy(rotation);
              hoverPoint.position.copy(position);

              plane.setLocalPosition(hoverPoint.entity.getPosition());

              var angles = eulers[hoverPoint.ind];
              quatB.setFromEulerAngles(angles[0], angles[1], angles[2]);
              quatC.copy(rotation).mul(quatB);
              plane.setLocalRotation(quatC);

              var axes = scales[hoverPoint.ind];
              plane.setLocalScale(scale[axes[0]], 1, scale[axes[1]]);
          }
      };

      editor.on('entities:add', function(entity) {
          var key = entity.get('resource_id');

          var addGizmo = function() {
              if (entities[key])
                  return;

              var gizmo = pool.shift();
              if (! gizmo)
                  gizmo = new Gizmo();

              gizmo.link(entity);
              entities[key] = gizmo;

              editor.call('viewport:render');
          };

          var removeGizmo = function() {
              if (! entities[key])
                  return;

              pool.push(entities[key]);
              entities[key].unlink();
              delete entities[key];

              editor.call('viewport:render');
          };

          if (entity.has('components.zone'))
              addGizmo();

          entity.on('components.zone:set', addGizmo);
          entity.on('components.zone:unset', removeGizmo);

          entity.once('destroy', function() {
              removeGizmo();
          });
      });

      editor.on('selector:change', function(type, items) {
          selected = { };
          if (items) {
              for(var i = 0; i < items.length; i++)
                  selected[items[i].get('resource_id')] = items[i];
          }

          editor.call('viewport:render');
      });

      editor.on('viewport:gizmoUpdate', function(dt) {
          zones = 0;

          for(var key in entities)
              entities[key].update();

          if (zones === 1) {
              if (! points.length)
                  pointsCreate();

              pointsUpdate();
          } else if (points.length) {
              pointsDestroy();
          }

          if (dragPoint) {
              var camera = editor.call('camera:current');
              var transform = lastZone._link.entity.getWorldTransform();
              var rotation = lastZone.entity.getRotation();
              var position = dragPoint.entity.getLocalPosition();
              var scale = lastZone._link.entity.zone.size;

              var a = scales[dragPoint.ind];

              for(var i = 0; i < a.length; i++) {
                  for(var l = 0; l <= 2; l++) {
                      vecA.set(0, 0, 0);
                      vecA[a[i]] = scale[a[i]] * 0.5;
                      rotation.transformVector(vecA, vecA);

                      vecD.set(0, 0, 0);
                      vecD[a[i ? 0 : 1]] = scale[a[i ? 0 : 1]] * (l - 1) * 0.5;
                      rotation.transformVector(vecD, vecD);

                      vecB.copy(position).add(vecD).add(vecA);
                      vecC.copy(position).add(vecD).sub(vecA);

                      app.renderLine(vecB, vecC, colorBehind, immediateRenderOptions);
                      app.renderLine(vecB, vecC, colorPrimary, immediateRenderOptions);
                  }
              }
          }
      });


      var createModels = function() {
          // ================
          // box
          var positions = [
              0.5, 0.5, 0.5,   0.5, 0.5, -0.5,   -0.5, 0.5, -0.5,   -0.5, 0.5, 0.5, // top
              0.5, 0.5, 0.5,   -0.5, 0.5, 0.5,   -0.5, -0.5, 0.5,   0.5, -0.5, 0.5, // front
              0.5, 0.5, 0.5,   0.5, -0.5, 0.5,   0.5, -0.5, -0.5,   0.5, 0.5, -0.5, // right
              0.5, 0.5, -0.5,   0.5, -0.5, -0.5,   -0.5, -0.5, -0.5,   -0.5, 0.5, -0.5, // back
              -0.5, 0.5, 0.5,   -0.5, 0.5, -0.5,   -0.5, -0.5, -0.5,   -0.5, -0.5, 0.5, // left
              0.5, -0.5, 0.5,   -0.5, -0.5, 0.5,   -0.5, -0.5, -0.5,   0.5, -0.5, -0.5 // bottom
          ];
          var normals = [
              0, 1, 0,   0, 1, 0,   0, 1, 0,   0, 1, 0,
              0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
              1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0,
              0, 0, -1,   0, 0, -1,   0, 0, -1,   0, 0, -1,
              -1, 0, 0,   -1, 0, 0,   -1, 0, 0,   -1, 0, 0,
              0, -1, 0,   0, -1, 0,   0, -1, 0,   0, -1, 0
          ];
          var indices = [
              0, 1, 2, 2, 3, 0,
              4, 5, 6, 6, 7, 4,
              8, 9, 10, 10, 11, 8,
              12, 13, 14, 14, 15, 12,
              16, 17, 18, 18, 19, 16,
              20, 21, 22, 22, 23, 20
          ];

          var mesh = pc.createMesh(app.graphicsDevice, positions, {
              normals: normals,
              indices: indices
          });

          var wireframePositions = [
               0.5, 0.5, 0.5,    0.5, 0.5, -0.5,   -0.5, 0.5, -0.5,   -0.5, 0.5, 0.5, // top
               0.5, 0.5, 0.5,   -0.5, 0.5, 0.5,    -0.5, -0.5, 0.5,    0.5, -0.5, 0.5, // front
               0.5, 0.5, 0.5,    0.5, -0.5, 0.5,    0.5, -0.5, -0.5,   0.5, 0.5, -0.5, // right
               0.5, 0.5, -0.5,  -0.5, 0.5, -0.5,   -0.5, -0.5, -0.5,   0.5, -0.5, -0.5, // back
              -0.5, 0.5, 0.5,   -0.5, -0.5, 0.5,   -0.5, -0.5, -0.5,  -0.5, 0.5, -0.5, // right
               0.5, -0.5, 0.5,   0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.5, -0.5, 0.5 // bottom
          ];
          var meshWireframe = pc.createMesh(app.graphicsDevice, wireframePositions);
          meshWireframe.primitive[0].type = pc.PRIMITIVE_LINES;

          // node
          var node = new pc.GraphNode();
          // meshInstance
          var meshInstance = new pc.MeshInstance(node, mesh, materialDefault);
          // meshInstance.layer = 12;
          meshInstance.mask = GIZMO_MASK;
          meshInstance.__editor = true;
          meshInstance.castShadow = false;
          // meshInstance.castLightmapShadow = false;
          meshInstance.receiveShadow = false;
          meshInstance.setParameter('offset', 0);
          // meshInstance.updateKey();

          var meshInstanceBehind = new pc.MeshInstance(node, mesh, materialBehind);
          // meshInstanceBehind.layer = 2;
          meshInstanceBehind.mask = GIZMO_MASK;
          meshInstanceBehind.__editor = true;
          meshInstanceBehind.pick = false;
          meshInstanceBehind.drawToDepth = false;
          meshInstanceBehind.castShadow = false;
          // meshInstanceBehind.castLightmapShadow = false;
          meshInstanceBehind.receiveShadow = false;
          meshInstanceBehind.setParameter('offset', 0);
          // meshInstanceBehind.updateKey();

          var meshInstanceOccluder = new pc.MeshInstance(node, mesh, materialOccluder);
          // meshInstanceOccluder.layer = 9;
          meshInstanceOccluder.mask = GIZMO_MASK;
          meshInstanceOccluder.__editor = true;
          meshInstanceOccluder.pick = false;
          meshInstanceOccluder.castShadow = false;
          // meshInstanceOccluder.castLightmapShadow = false;
          meshInstanceOccluder.receiveShadow = false;
          meshInstanceOccluder.setParameter('offset', 0);
          // meshInstanceOccluder.updateKey();

          var meshInstanceWireframe = new pc.MeshInstance(node, meshWireframe, materialWireframe);
          // meshInstanceWireframe.layer = pc.LAYER_GIZMO;
          meshInstanceWireframe.mask = GIZMO_MASK;
          meshInstanceWireframe.__editor = true;
          // meshInstanceWireframe.updateKey();
          // model
          var model = new pc.Model();
          model.graph = node;
          model.meshInstances = [ meshInstance, meshInstanceBehind, meshInstanceWireframe, meshInstanceOccluder];

          models['box'] = model;
      };
      createModels();
  });
});


/* editor/gizmo/gizmo-screen.js */
editor.once('load', function() {
  'use strict';

  var left = new pc.Vec3();
  var right = new pc.Vec3();
  var top = new pc.Vec3();
  var bottom = new pc.Vec3();

  var corners = [];
  var cornerColors = [];
  var visible = true;

  var vecA = new pc.Vec2();

  var projectSettings = editor.call('settings:project');

  for (var i = 0; i < 8; i++) {
      corners.push(new pc.Vec3());
      cornerColors.push(new pc.Color(1, 1, 1));
  }

  editor.once('viewport:load', function (app) {
      var entities = {};

      var immediateRenderOptions = {
          layer: editor.call('gizmo:layers', 'Axis Gizmo Immediate'),
          mask: GIZMO_MASK
      };

      // remember selected entities
      var selectedEntities = {};

      editor.on('selector:add', function (item, type) {
          if (type === 'entity') {
              selectedEntities[item.get('resource_id')] = true;
          }
      });

      editor.on('selector:remove', function (item, type) {
          if (type === 'entity') {
              delete selectedEntities[item.get('resource_id')];
          }
      });

      // Returns true if a child of the entity is selected
      var isChildSelected = function (entity) {
          var children = entity.get('children');
          for (var i = 0, len = children.length; i < len; i++) {
              if (selectedEntities[children[i]])
                  return true;
          }

          for (var i = 0, len = children.length; i < len; i++) {
              var child = editor.call('entities:get', children[i]);
              if (child && isChildSelected(child)) {
                  return true;
              }
          }

          return false;
      };

      editor.method('gizmo:screen:visible', function(state) {
          if (visible !== state) {
              visible = state;

              editor.call('viewport:render');
          }
      });

      editor.on('entities:add', function(entity) {
          var key = entity.get('resource_id');

          var addGizmo = function() {
              if (entities[key])
                  return;

              entities[key] = {
                  entity: entity
              };

              editor.call('viewport:render');
          };

          var removeGizmo = function() {
              if (! entities[key])
                  return;

              var e = app.root.findByGuid(key);
              if (e) {
                  // reset scale
                  var scale = entity.get('scale');
                  e.setLocalScale(scale[0], scale[1], scale[2]);

                  // reset rotation
                  var rotation = entity.get('rotation');
                  e.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
              }

              delete entities[key];

              editor.call('viewport:render');
          };

          if (entity.has('components.screen'))
              addGizmo();

          entity.on('components.screen:set', addGizmo);
          entity.on('components.screen:unset', removeGizmo);

          entity.once('destroy', function() {
              removeGizmo();
          });
      });

      editor.on('viewport:gizmoUpdate', function (dt) {
          if (!visible) {
              return;
          }

          for (var key in entities) {
              var entity = app.root.findByGuid(key);
              if (! entity)
                  continue;

              var isScreenSpace = entities[key].entity.get('components.screen.screenSpace');

              // never cull screen content in editor
              entity.screen.cull = false;

              // always render screens as 3d screens in the viewport
              if (isScreenSpace) {
                  entity.setLocalScale(0.01, 0.01, 0.01);
                  entity.setLocalEulerAngles(0, 0, 0);

                  if (entity.screen.screenSpace) {
                      entity.screen.screenSpace = false;
                  }


                  var res = entity.screen.resolution;
                  var w = projectSettings.get('width');
                  var h = projectSettings.get('height');
                  vecA.set(w, h);

                  // reset resolution
                  if (res.x !== w || res.y !== h) {
                      entity.screen.resolution = vecA;
                  }

                  // reset scale mode
                  var scaleMode = entities[key].entity.get('components.screen.scaleMode');
                  if (entity.screen.scaleMode !== scaleMode) {
                      entity.screen._scaleMode = scaleMode;
                      entity.screen.resolution = vecA; // force update
                  }


              } else {
                  // reset scale that might have been
                  // changed if the screen used to be screen space
                  var scale = entities[key].entity.get('scale');
                  entity.setLocalScale(scale[0], scale[1], scale[2]);

                  var rotation = entities[key].entity.get('rotation');
                  entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);

                  // reset resolution
                  var res = entities[key].entity.get('components.screen.resolution');
                  var currentRes = entity.screen.resolution;
                  vecA.set(res[0], res[1]);
                  if (currentRes.x !== res[0] || currentRes.y !== res[1]) {
                      entity.screen.resolution = vecA;
                  }

                  // reset scale mode
                  if (entity.screen.scaleMode !== 'none') {
                      entity.screen.scaleMode = 'none';
                  }
              }

              // only render screen gizmo if it's selected
              // or a child is selected
              if (!selectedEntities[key] && !isChildSelected(entities[key].entity)) {
                  continue;
              }

              // calculate corners
              var position = entity.getPosition();
              var r = entity.right;
              var u = entity.up;
              var scale = entity.getLocalScale();
              var refResolution = entities[key].entity.get('components.screen.referenceResolution');

              vecA.set(refResolution[0], refResolution[1]);
              var screenScale = entity.screen.scaleMode === 'blend' ? entity.screen._calcScale(entity.screen.resolution, vecA) || Number.MIN_VALUE : 1;

              left
              .copy(r)
              .scale(-0.5 * entity.screen.resolution.x * scale.x / screenScale);

              right
              .copy(r)
              .scale(0.5 * entity.screen.resolution.x * scale.x / screenScale);

              top
              .copy(u)
              .scale(0.5 * entity.screen.resolution.y * scale.y / screenScale);

              bottom
              .copy(u)
              .scale(-0.5 * entity.screen.resolution.y * scale.y / screenScale);

              corners[0].copy(position).add(left).add(top);
              corners[1].copy(position).add(left).add(bottom);
              corners[2].copy(position).add(left).add(bottom);
              corners[3].copy(position).add(right).add(bottom);
              corners[4].copy(position).add(right).add(bottom);
              corners[5].copy(position).add(right).add(top);
              corners[6].copy(position).add(right).add(top);
              corners[7].copy(position).add(left).add(top);

              // render rectangle for screen
              app.renderLines(corners, cornerColors, immediateRenderOptions);
          }
      });
  });
});


/* editor/gizmo/gizmo-element.js */
editor.once('load', function() {
  'use strict';

  var corners = [];
  var cornerColor = new pc.Color(1,1,1,0.9);
  var visible = true;

  for (var i = 0; i < 8; i++) {
      corners.push(new pc.Vec3());
  }

  editor.once('viewport:load', function (app) {
      var immediateRenderOptions = {
          layer: editor.call('gizmo:layers', 'Axis Gizmo Immediate'),
          mask: GIZMO_MASK
      };

      editor.method('gizmo:element:visible', function(state) {
          if (visible !== state) {
              visible = state;

              editor.call('viewport:render');
          }
      });

      editor.on('viewport:gizmoUpdate', function (dt) {
          if (!visible) {
              return;
          }

          var selected = editor.call('selector:itemsRaw');
          for (var i = 0, len = selected.length; i < len; i++) {
              var item = selected[i];

              var entity = item.entity;
              if (! entity || ! entity.element)
                  continue;

              var worldCorners = entity.element.worldCorners;

              corners[0].copy(worldCorners[0]);
              corners[1].copy(worldCorners[1]);
              corners[2].copy(worldCorners[1]);
              corners[3].copy(worldCorners[2]);
              corners[4].copy(worldCorners[2]);
              corners[5].copy(worldCorners[3]);
              corners[6].copy(worldCorners[3]);
              corners[7].copy(worldCorners[0]);

              app.renderLines(corners, cornerColor, immediateRenderOptions);
          }
      });

  });
});


/* editor/gizmo/gizmo-element-anchor.js */
editor.once('load', function() {
  'use strict';

  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();
  var vecD = new pc.Vec3();
  var quat = new pc.Quat();

  var gizmoAnchor = null;
  var evtTapStart = null;
  var moving = false;
  var mouseTap = null;
  var mouseTapMoved = false;
  var pickStart = new pc.Vec3();
  var posCameraLast = new pc.Vec3();
  var selectedEntity = null;
  var anchorDirty = false;
  var anchorStart = [];
  var anchorCurrent = [];
  var localPosition = [];
  var offset = new pc.Vec3();
  var visible = true;

  var createAnchorGizmo = function () {
      var obj = {
          root: null,
          handles: {
              tl: null,
              tr: null,
              bl: null,
              br: null
              // center: null
          },
          matActive: null,
          matInactive: null,
          handle: null
      };

      obj.root = new pc.Entity();
      obj.root.enabled = false;

      var c = 0.8;
      obj.matInactive = createMaterial(new pc.Color(c, c, c, 0.5));
      obj.matActive = createMaterial(new pc.Color(c, c, c, 1));

      var layer = editor.call('gizmo:layers', 'Axis Gizmo');

      var createCone = function (angle) {
          var result = new pc.Entity();
          result.setLocalEulerAngles(0, 0, angle);
          obj.root.addChild(result);

          var cone = new pc.Entity();
          cone.addComponent('model', {
              type: 'cone',
              layers: [layer.id]
          });
          cone.model.castShadows = false;
          cone.model.receiveShadows = false;
          cone.model.meshInstances[0].material = obj.matInactive;
          cone.model.meshInstances[0].mask = GIZMO_MASK;
          cone.setLocalPosition(0, -0.5, 0);
          cone.setLocalScale(1, 1, 0.01);
          cone.handle = result;
          result.addChild(cone);

          result.handleModel = cone;

          return result;
      };

      obj.handles.tl = createCone(230);
      obj.handles.tr = createCone(130);
      obj.handles.bl = createCone(130+180);
      obj.handles.br = createCone(230+180);

      // obj.handles.center = new pc.Entity();
      // var sphere = new pc.Entity();
      // obj.handles.center.addChild(sphere);
      // sphere.addComponent('model', {type: 'sphere'});
      // sphere.model.castShadows = false;
      // sphere.model.receiveShadows = false;
      // sphere.model.meshInstances[0].material = obj.matInactive;
      // sphere.setLocalPosition(0,0,0.1);
      // sphere.setLocalScale(0.5, 0.5, 0.5);
      // sphere.handle = obj.handles.center;
      // obj.handles.center.handleModel = sphere;
      // obj.root.addChild(obj.handles.center);

      return obj;
  };

  var createMaterial = function(color) {
      var mat = new pc.BasicMaterial();
      mat.color = color;
      if (color.a !== 1) {
          mat.blend = true;
          mat.blendSrc = pc.BLENDMODE_SRC_ALPHA;
          mat.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
      }
      mat.update();
      return mat;
  };

  var setModelMaterial = function (entity, material) {
      if (entity.model.meshInstances[0].material !== material)
          entity.model.meshInstances[0].material = material;
  };

  editor.once('viewport:load', function (app) {
      var gizmoAnchor = createAnchorGizmo();
      app.root.addChild(gizmoAnchor.root);

      editor.on('selector:add', function (item, type) {
          if (type !== 'entity') return;

          if (! selectedEntity) {
              selectedEntity = item;
          }
      });

      editor.on('selector:remove', function (item, type) {
          if (selectedEntity === item) {
              selectedEntity = null;
          }
      });

      var isAnchorSplit = function (anchor) {
          return Math.abs(anchor[0] - anchor[2] > 0.001 || Math.abs(anchor[1] - anchor[3]) > 0.001);
      };

      var clamp = function (value, min, max) {
          return Math.min(Math.max(value, min), max);
      };

      var offsetAnchor = function (value, offset, min, max, snap) {
          value += offset;
          // value = Math.round(value / snap)  * snap;
          if (value < min + snap)
              value = min;
          else if (value > max - snap)
              value = max;
          return value;
      };

      var gizmoEnabled = function () {
          if (editor.call('selector:itemsRaw').length > 1)
              return false;

          return visible &&
              selectedEntity &&
              selectedEntity.has('components.element') &&
              editor.call('permissions:write') &&
              selectedEntity.entity &&
              selectedEntity.entity.element.screen;
      };

      editor.method('gizmo:anchor:visible', function(state) {
          if (visible !== state) {
              visible = state;

              editor.call('viewport:render');
          }
      });

      editor.on('viewport:gizmoUpdate', function (dt) {
          gizmoAnchor.root.enabled = gizmoEnabled();
          if (! gizmoAnchor.root.enabled)
              return;

          var entity = selectedEntity.entity;
          var parent = entity.parent && entity.parent.element ? entity.parent : entity.element.screen;


          var camera = editor.call('camera:current');
          var posCamera = camera.getPosition();

          gizmoAnchor.root.setPosition(parent.getPosition());
          gizmoAnchor.root.setRotation(parent.getRotation());

          // scale to screen space
          var scale = 1;
          var gizmoSize = 0.2;
          if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
              var center = vecA;
              center.lerp(gizmoAnchor.handles.bl.getPosition(), gizmoAnchor.handles.tr.getPosition(), 0.5);
              var dot = center.sub(posCamera).dot(camera.forward);
              var denom = 1280 / (2 * Math.tan(camera.camera.fov * pc.math.DEG_TO_RAD / 2));
              scale = Math.max(0.0001, (dot / denom) * 150) * gizmoSize;
          } else {
              scale = camera.camera.orthoHeight / 3 * gizmoSize;
          }

          gizmoAnchor.handles.tr.setLocalScale(scale, scale, scale);
          gizmoAnchor.handles.tl.setLocalScale(scale, scale, scale);
          gizmoAnchor.handles.br.setLocalScale(scale, scale, scale);
          gizmoAnchor.handles.bl.setLocalScale(scale, scale, scale);
          // gizmoAnchor.handles.center.setLocalScale(scale, scale, scale);

          // scale snap by gizmo scale
          var snapIncrement = 0.05 * scale;

          var resX, resY;
          if (parent === entity.element.screen) {
              resX = parent.screen.resolution.x;
              resY = parent.screen.resolution.y;

              if (parent.screen.scaleMode === 'blend') {
                  var resScale = parent.screen._calcScale(parent.screen.resolution, parent.screen.referenceResolution) || Number.MIN_VALUE;
                  resX /= resScale;
                  resY /= resScale;
              }
          } else {
              resX = parent.element.width;
              resY = parent.element.height;
          }

          var screenScale = entity.element.screen ? entity.element.screen.getLocalScale() : parent.getLocalScale();
          resX *= screenScale.x;
          resY *= screenScale.y;

          offset.set(0, 0, 0);
          if (moving && (vecA.copy(posCameraLast).sub(posCamera).length() > 0.01 || mouseTapMoved)) {
              offset = pickPlane(mouseTap.x, mouseTap.y);
              if (offset) {
                  offset.sub(pickStart);
                  anchorDirty = true;

                  for (var i = 0; i < 4; i++)
                      anchorCurrent[i] = anchorStart[i];

                  if (gizmoAnchor.handle === gizmoAnchor.handles.tr || gizmoAnchor.handle === gizmoAnchor.handles.tl) {
                      anchorCurrent[3] = offsetAnchor(anchorCurrent[3], offset.y / resY, anchorCurrent[1], 1, snapIncrement);
                      if (gizmoAnchor.handle === gizmoAnchor.handles.tr) {
                          anchorCurrent[2] = offsetAnchor(anchorCurrent[2], offset.x / resX, anchorCurrent[0], 1, snapIncrement);
                      } else {
                          anchorCurrent[0] = offsetAnchor(anchorCurrent[0], offset.x / resX, 0, anchorCurrent[2], snapIncrement);
                      }
                  } else if (gizmoAnchor.handle === gizmoAnchor.handles.br || gizmoAnchor.handle === gizmoAnchor.handles.bl) {
                      anchorCurrent[1] = offsetAnchor(anchorCurrent[1], offset.y / resY, 0, anchorCurrent[3], snapIncrement);
                      if (gizmoAnchor.handle === gizmoAnchor.handles.br) {
                          anchorCurrent[2] = offsetAnchor(anchorCurrent[2], offset.x / resX, anchorCurrent[0], 1, snapIncrement);
                      } else {
                          anchorCurrent[0] = offsetAnchor(anchorCurrent[0], offset.x / resX, 0, anchorCurrent[2], snapIncrement);
                      }
                  }
                   // else if (gizmoAnchor.handle === gizmoAnchor.handles.center) {
                  //     var dx = anchorCurrent[2] - anchorCurrent[0];
                  //     var dy = anchorCurrent[3] - anchorCurrent[1];

                  //     anchorCurrent[0] = clamp(anchorCurrent[0] + offset.x / resX, 0, 1 - dx);
                  //     anchorCurrent[2] = clamp(anchorCurrent[2] + offset.x / resX, dx, 1);
                  //     anchorCurrent[1] = clamp(anchorCurrent[1] + offset.y / resY, 0, 1 - dy);
                  //     anchorCurrent[3] = clamp(anchorCurrent[3] + offset.y / resY, dy, 1);
                  // }

                  selectedEntity.set('components.element.anchor', anchorCurrent);
              }

              editor.call('viewport:render');
          }

          posCameraLast.copy(posCamera);
          mouseTapMoved = false;

          var anchor = entity.element.anchor;

          var px = parent && parent.element ? parent.element.pivot.x : 0.5;
          var py = parent && parent.element ? parent.element.pivot.y : 0.5;

          gizmoAnchor.handles.tl.setLocalPosition(resX * (anchor.x - px), resY * (anchor.w - py), 0);
          gizmoAnchor.handles.tr.setLocalPosition(resX * (anchor.z - px), resY * (anchor.w - py), 0);
          gizmoAnchor.handles.bl.setLocalPosition(resX * (anchor.x - px), resY * (anchor.y - py), 0);
          gizmoAnchor.handles.br.setLocalPosition(resX * (anchor.z - px), resY * (anchor.y - py), 0);

          // gizmoAnchor.handles.center.setLocalPosition(resX * (pc.math.lerp(anchor.x,anchor.z,0.5) - 0.5), resY * (pc.math.lerp(anchor.y,anchor.w,0.5) - 0.5), 0, 0.1);
      });

      editor.on('viewport:pick:hover', function(node, picked) {
          if (! node || ! node.handle) {
              if (gizmoAnchor.handle) {
                  gizmoAnchor.handle = null;

                  for (var key in gizmoAnchor.handles) {
                      setModelMaterial(gizmoAnchor.handles[key].handleModel, gizmoAnchor.matInactive);
                  }

                  if (evtTapStart) {
                      evtTapStart.unbind();
                      evtTapStart = null;
                  }
              }
          } else {
              if (! gizmoAnchor.handle || gizmoAnchor.handle !== node.handle) {
                  gizmoAnchor.handle = node.handle;

                  for (var key in gizmoAnchor.handles) {
                      setModelMaterial(gizmoAnchor.handles[key].handleModel, gizmoAnchor.handles[key] === gizmoAnchor.handle ? gizmoAnchor.matActive : gizmoAnchor.matInactive);
                  }

                  if (! evtTapStart) {
                      evtTapStart = editor.on('viewport:tap:start', onTapStart);
                  }
              }
          }
      });

      var onTapStart = function (tap) {
          if (moving || tap.button !== 0)
              return;

          editor.emit('camera:toggle', false);
          editor.call('viewport:pick:state', false);

          moving = true;
          mouseTap = tap;
          anchorDirty = false;

          if (gizmoAnchor.root.enabled) {
              pickStart.copy(pickPlane(tap.x, tap.y));
          }

          if (selectedEntity) {
              selectedEntity.history.enabled = false;

              anchorStart = selectedEntity.get('components.element.anchor').slice(0);
          }

          editor.call('gizmo:translate:visible', false);
          editor.call('gizmo:rotate:visible', false);
          editor.call('gizmo:scale:visible', false);
      };

      var onTapMove = function(tap) {
          if (! moving)
              return;

          mouseTap = tap;
          mouseTapMoved = true;
      };

      var onTapEnd = function(tap) {
          if (tap.button !== 0)
              return;

          editor.emit('camera:toggle', true);

          if (! moving)
              return;

          moving = false;
          mouseTap = tap;

          editor.call('gizmo:translate:visible', true);
          editor.call('gizmo:rotate:visible', true);
          editor.call('gizmo:scale:visible', true);
          editor.call('viewport:pick:state', true);

          // update entity anchor
          if (selectedEntity) {
              if (anchorDirty) {
                  var resourceId = selectedEntity.get('resource_id');
                  var previousAnchor = anchorStart.slice(0);
                  var newAnchor = anchorCurrent.slice(0);

                  editor.call('history:add', {
                      name: 'entity.element.anchor',
                      undo: function() {
                          var item = editor.call('entities:get', resourceId);
                          if (! item)
                              return;

                          var history = item.history.enabled;
                          item.history.enabled = false;
                          item.set('components.element.anchor', previousAnchor);
                          item.history.enabled = history;
                      },
                      redo: function() {
                          var item = editor.call('entities:get', resourceId);
                          if (! item)
                              return;

                          var history = item.history.enabled;
                          item.history.enabled = false;
                          item.set('components.element.anchor', newAnchor);
                          item.history.enabled = history;
                      }
                  });
              }

              selectedEntity.history.enabled = true;
          }
      };

      var pickPlane = function(x, y) {
          var camera = editor.call('camera:current');

          var mouseWPos = camera.camera.screenToWorld(x, y, camera.camera.farClip);
          var posGizmo = gizmoAnchor.root.getPosition();
          var rayOrigin = vecA.copy(camera.getPosition());
          var rayDirection = vecB.set(0, 0, 0);

          vecC.copy(gizmoAnchor.root.forward);
          var planeNormal = vecC.scale(-1);

          if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
              rayDirection.copy(mouseWPos).sub(rayOrigin).normalize();
          } else {
              rayOrigin.add(mouseWPos);
              camera.getWorldTransform().transformVector(vecD.set(0, 0, -1), rayDirection);
          }

          var rayPlaneDot = planeNormal.dot(rayDirection);
          var planeDist = posGizmo.dot(planeNormal);
          var pointPlaneDist = (planeNormal.dot(rayOrigin) - planeDist) / rayPlaneDot;
          var pickedPos = rayDirection.scale(-pointPlaneDist).add(rayOrigin);

          // convert pickedPos to local position relative to the gizmo
          quat.copy(gizmoAnchor.root.getRotation()).invert().transformVector(pickedPos, pickedPos);

          return pickedPos;
      };

      editor.on('viewport:tap:move', onTapMove);
      editor.on('viewport:tap:end', onTapEnd);

  });
});


/* editor/gizmo/gizmo-element-size.js */
editor.once('load', function() {
  'use strict';

  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();
  var vecD = new pc.Vec3();

  var selectedEntity = null;

  var evtTapStart = null;
  var moving = false;
  var mouseTap = null;
  var mouseTapMoved = false;
  var pickStart = new pc.Vec3();
  var posCameraLast = new pc.Vec3();

  var posStart = [];
  var posCurrent = [];
  var sizeStart = [0,0];
  var sizeCurrent = [0,0];
  var startWorldCorners = [new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3()];
  var worldToEntitySpace = new pc.Mat4();
  var entitySpaceToParentSpace = new pc.Mat4();
  var dirty = false;

  var offset = new pc.Vec3();
  var localOffset = new pc.Vec3();
  var offsetWithPivot = new pc.Vec3();

  var createGizmo = function () {
      var obj = {
          root: null,
          handles: [null, null, null, null],
          matActive: null,
          matInactive: null,
          handle: null
      };

      obj.root = new pc.Entity();
      obj.root.enabled = false;

      obj.matInactive = createMaterial(new pc.Color(1, 1, 0, 0.5));
      obj.matActive = createMaterial(new pc.Color(1, 1, 0, 1));

      var layer = editor.call('gizmo:layers', 'Axis Gizmo');

      var createHandle = function () {
          var sphere = new pc.Entity();
          sphere.addComponent('model', {
              type: 'sphere',
              layers: [layer.id]
          });
          sphere.model.castShadows = false;
          sphere.model.receiveShadows = false;
          sphere.model.meshInstances[0].material = obj.matInactive;
          sphere.model.meshInstances[0].mask = GIZMO_MASK;
          sphere.setLocalScale(0.5, 0.5, 0.5);
          obj.root.addChild(sphere);
          return sphere;
      };

      for (var i = 0; i < 4; i++)
          obj.handles[i] = createHandle();

      return obj;
  };

  var createMaterial = function(color) {
      var mat = new pc.BasicMaterial();
      mat.color = color;
      if (color.a !== 1) {
          mat.blend = true;
          mat.blendSrc = pc.BLENDMODE_SRC_ALPHA;
          mat.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
      }
      mat.update();
      return mat;
  };

  var gizmoEnabled = function () {
      if (editor.call('gizmo:type') === 'resize' && editor.call('permissions:write') && editor.call('selector:itemsRaw').length === 1) {
          return (selectedEntity && selectedEntity.has('components.element') && selectedEntity.entity);
      }

      return false;
  };

  editor.once('viewport:load', function (app) {
      var gizmo = createGizmo();
      app.root.addChild(gizmo.root);

      editor.on('selector:add', function (item, type) {
          if (type !== 'entity') return;

          if (! selectedEntity) {
              selectedEntity = item;
          }
      });

      editor.on('selector:remove', function (item, type) {
          if (selectedEntity === item) {
              selectedEntity = null;
          }
      });

      editor.on('viewport:gizmoUpdate', function (dt) {
          gizmo.root.enabled = gizmoEnabled();
          if (! gizmo.root.enabled)
              return;

          var entity = selectedEntity.entity;

          // scale to screen space
          var scale = 1;
          var gizmoSize = 0.2;
          var camera = editor.call('camera:current');
          var posCamera = camera.getPosition();
          var worldCorners = entity.element.worldCorners;

          var parent = entity.parent && entity.parent.element ? entity.parent : entity.element.screen;

          for (var i = 0; i < 4; i++) {
              if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
                  var dot = vecA.copy(worldCorners[i]).sub(posCamera).dot(camera.forward);
                  var denom = 1280 / (2 * Math.tan(camera.camera.fov * pc.math.DEG_TO_RAD / 2));
                  scale = Math.max(0.0001, (dot / denom) * 150) * gizmoSize;
              } else {
                  scale = camera.camera.orthoHeight / 3 * gizmoSize;
              }

              gizmo.handles[i].setPosition(worldCorners[i]);
              gizmo.handles[i].setLocalScale(scale, scale, scale);
          }

          if (moving && (vecA.copy(posCameraLast).sub(posCamera).length() > 0.01 || mouseTapMoved)) {
              offset = pickPlane(mouseTap.x, mouseTap.y);
              // app.renderLines([pickStart, offset], new pc.Color(1, 0, 0));
              if (offset) {
                  dirty = true;

                  posCurrent[0] = posStart[0];
                  posCurrent[1] = posStart[1];
                  posCurrent[2] = posStart[2];
                  sizeCurrent[0] = sizeStart[0];
                  sizeCurrent[1] = sizeStart[1];

                  var pivot = entity.element.pivot;
                  var px, py, sx, sy;

                  // bottom left
                  if (gizmo.handle === gizmo.handles[0]) {
                      px = 1 - pivot.x;
                      py = 1 - pivot.y;
                      sx = -1;
                      sy = -1;
                  }
                  // bottom right
                  else if (gizmo.handle === gizmo.handles[1]) {
                      px = pivot.x;
                      py = 1 - pivot.y;
                      sx = 1;
                      sy = -1;
                  }
                  // top right
                  else if (gizmo.handle === gizmo.handles[2]) {
                      px = pivot.x;
                      py = pivot.y;
                      sx = 1;
                      sy = 1;
                  }
                  // top left
                  else if (gizmo.handle === gizmo.handles[3]) {
                      px = 1 - pivot.x;
                      py = pivot.y;
                      sx = -1;
                      sy = 1;
                  }

                  // world space offset
                  offset.sub(pickStart);
                  // offset in element space
                  worldToEntitySpace.transformVector(offset, localOffset);

                  // position changes based on the pivot - calculate the
                  // offset in element space after applying pivot
                  offsetWithPivot.set(px * localOffset.x, py * localOffset.y, 0);
                  // transform result to world space and then to element parent space
                  entitySpaceToParentSpace.transformVector(offsetWithPivot, offsetWithPivot);

                  // apply offset
                  posCurrent[0] += offsetWithPivot.x;
                  posCurrent[1] += offsetWithPivot.y;
                  posCurrent[2] += offsetWithPivot.z;

                  // apply size change
                  sizeCurrent[0] += sx * localOffset.x;
                  sizeCurrent[1] += sy * localOffset.y;

                  selectedEntity.set('position', posCurrent);
                  selectedEntity.set('components.element.width', sizeCurrent[0]);
                  selectedEntity.set('components.element.height', sizeCurrent[1]);
              }

              editor.call('viewport:render');
          }

          posCameraLast.copy(posCamera);
          mouseTapMoved = false;

      });

      editor.on('viewport:pick:hover', function(node, picked) {
          if (! node || gizmo.handles.indexOf(node) === -1) {
              if (gizmo.handle) {
                  gizmo.handle = null;

                  for (var i = 0; i < 4; i++) {
                      gizmo.handles[i].model.meshInstances[0].material = gizmo.matInactive;
                  }

                  if (evtTapStart) {
                      evtTapStart.unbind();
                      evtTapStart = null;
                  }
              }
          } else if (! gizmo.handle || gizmo.handle !== node) {

              gizmo.handle = node;

              for (var i = 0; i < 4; i++) {
                  gizmo.handles[i].model.meshInstances[0].material = (gizmo.handles[i] === node ? gizmo.matActive : gizmo.matInactive);
              }

              if (! evtTapStart) {
                  evtTapStart = editor.on('viewport:tap:start', onTapStart);
              }
          }
      });


      var onTapStart = function (tap) {
          if (moving || tap.button !== 0)
              return;

          editor.emit('camera:toggle', false);
          editor.call('viewport:pick:state', false);

          moving = true;
          mouseTap = tap;
          dirty = false;

          if (selectedEntity) {
              selectedEntity.history.enabled = false;

              posStart = selectedEntity.get('position').slice(0);
              sizeStart[0] = selectedEntity.get('components.element.width');
              sizeStart[1] = selectedEntity.get('components.element.height');
              worldToEntitySpace.copy(selectedEntity.entity.getWorldTransform()).invert();
              entitySpaceToParentSpace.copy(selectedEntity.entity.parent.getWorldTransform()).invert().mul(selectedEntity.entity.getWorldTransform());

              for (var i = 0; i < 4; i++)
                  startWorldCorners[i].copy(selectedEntity.entity.element.worldCorners[i]);

          }

          if (gizmo.root.enabled) {
              pickStart.copy(pickPlane(tap.x, tap.y));
          }

          editor.call('gizmo:translate:visible', false);
          editor.call('gizmo:rotate:visible', false);
          editor.call('gizmo:scale:visible', false);
      };

      var onTapMove = function(tap) {
          if (! moving)
              return;

          mouseTap = tap;
          mouseTapMoved = true;
      };

      var onTapEnd = function(tap) {
          if (tap.button !== 0)
              return;

          editor.emit('camera:toggle', true);

          if (! moving)
              return;

          moving = false;
          mouseTap = tap;

          editor.call('gizmo:translate:visible', true);
          editor.call('gizmo:rotate:visible', true);
          editor.call('gizmo:scale:visible', true);
          editor.call('viewport:pick:state', true);

          if (selectedEntity) {
              if (dirty) {
                  var resourceId = selectedEntity.get('resource_id');
                  var previousPos = posStart.slice(0);
                  var newPos = posCurrent.slice(0);
                  var previousSize = sizeStart.slice(0);
                  var newSize = sizeCurrent.slice(0);

                  editor.call('history:add', {
                      name: 'entity.element.size',
                      undo: function() {
                          var item = editor.call('entities:get', resourceId);
                          if (! item)
                              return;

                          var history = item.history.enabled;
                          item.history.enabled = false;
                          item.set('position', previousPos);
                          item.set('components.element.width', previousSize[0]);
                          item.set('components.element.height', previousSize[1]);
                          item.history.enabled = history;
                      },
                      redo: function() {
                          var item = editor.call('entities:get', resourceId);
                          if (! item)
                              return;

                          var history = item.history.enabled;
                          item.history.enabled = false;
                          item.set('position', newPos);
                          item.set('components.element.width', newSize[0]);
                          item.set('components.element.height', newSize[1]);
                          item.history.enabled = history;
                      }
                  });
              }

              selectedEntity.history.enabled = true;
          }
      };

      var pickPlane = function(x, y) {
          var camera = editor.call('camera:current');
          var entity = selectedEntity.entity;

          var posEntity = startWorldCorners[gizmo.handles.indexOf(gizmo.handle)];
          var posMouse = camera.camera.screenToWorld(x, y, 1);
          var rayOrigin = vecA.copy(camera.getPosition());
          var rayDirection = vecB.set(0, 0, 0);

          vecC.copy(entity.forward);
          var planeNormal = vecC.scale(-1);

          if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
              rayDirection.copy(posMouse).sub(rayOrigin).normalize();
          } else {
              rayOrigin.add(posMouse);
              camera.getWorldTransform().transformVector(vecD.set(0, 0, -1), rayDirection);
          }

          var rayPlaneDot = planeNormal.dot(rayDirection);
          var planeDist = posEntity.dot(planeNormal);
          var pointPlaneDist = (planeNormal.dot(rayOrigin) - planeDist) / rayPlaneDot;
          var pickedPos = rayDirection.scale(-pointPlaneDist).add(rayOrigin);

          return pickedPos;
      };

      editor.on('viewport:tap:move', onTapMove);
      editor.on('viewport:tap:end', onTapEnd);

  });
});

