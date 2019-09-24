



/* editor/camera/camera.js */
editor.once('load', function() {
  'use strict';

  editor.once('viewport:load', function() {
      var camerasIndex = { };
      var editorCameras = { };
      var currentCamera = null;
      var defaultCamera = null;

      var evtLayersSet = null;
      var evtLayersInsert = null;
      var evtLayersRemove = null;

      var app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      var projectSettings = editor.call('settings:project');

      editor.method('camera:get', function(name) {
          return editorCameras[name] || null;
      });

      editor.method('camera:editor', function() {
          return editorCameras;
      });

      editor.method('camera:current', function() {
          return currentCamera;
      });

      var addGizmoLayers = function (camera, layers) {
          for (var i = 0; i < layers.length; i++) {
              var layer = layers[i];
              var idx = camera.layers.indexOf(layer.id);
              if (idx === -1) {
                  camera.layers.push(layer.id);
              }
          }
          camera.layers = camera.layers; // force update
      };

      var removeGizmoLayers = function (camera, layers) {
          for (var i = 0; i < layers.length; i++) {
              var layer = layers[i];
              var idx = camera.layers.indexOf(layer.id);
              if (idx !== -1) {
                  camera.layers.splice(idx, 1);
              }
          }

          camera.layers = camera.layers; // force update
      };

      editor.method('camera:set', function(entity) {
          if (! entity) entity = defaultCamera;

          if (currentCamera === entity || ! entity.camera)
              return;

          var gizmoLayers = editor.call('gizmo:layers:list');

          var old = currentCamera;
          if (old) {
              old.camera.enabled = false;
              removeGizmoLayers(old.camera, gizmoLayers);

              if (evtLayersSet) {
                  evtLayersSet.unbind();
                  evtLayersSet = null;
              }

              if (evtLayersInsert) {
                  evtLayersInsert.unbind();
                  evtLayersInsert = null;
              }

              if (evtLayersRemove) {
                  evtLayersRemove.unbind();
                  evtLayersRemove = null;
              }
          }

          currentCamera = entity;
          currentCamera.camera.enabled = true;

          addGizmoLayers(currentCamera.camera, gizmoLayers);

          // if this is a user's camera and the user changes its layers
          // make sure we re-add editor layers to this camera if this is the selected viewport
          // camera at the moment
          if (! entity.__editorCamera) {
              var fixLayers = function () {
                  if (entity !== currentCamera) return;

                  setTimeout(function () {
                      // check again
                      if (entity !== currentCamera) return;

                      // add layers and re-render
                      addGizmoLayers(entity.camera, editor.call('gizmo:layers:list'));
                      editor.call('viewport:render');
                  });
              };

              var e = editor.call('entities:get', entity.getGuid());
              if (e) {
                  evtLayersInsert = e.on('components.camera.layers:insert', fixLayers);
                  evtLayersRemove = e.on('components.camera.layers:remove', fixLayers);
                  evtLayersSet = e.on('components.camera.layers:set', fixLayers);
              }
          }

          editor.emit('camera:change', currentCamera, old);
          editor.call('viewport:render');
      });

      editor.method('camera:add', function(entity) {
          if (camerasIndex[entity.getGuid()])
              return;

          camerasIndex[entity.getGuid()] = entity;

          if (entity.camera) {
              entity.camera.enabled = false;
          }

          editor.emit('camera:add', entity);
      });

      editor.method('camera:remove', function(entity) {
          if (! camerasIndex[entity.getGuid()])
              return;

          delete camerasIndex[entity.getGuid()];

          if (entity === currentCamera)
              editor.call('camera:set');

          editor.emit('camera:remove', entity);
      });

      editor.on('permissions:writeState', function(state) {
          if (state || currentCamera.__editorCamera)
              return;

          editor.call('camera:set', editorCameras['perspective']);
      });


      var list = [{
          name: 'perspective',
          title: 'Perspective',
          className: 'viewport-camera-perspective',
          position: new pc.Vec3(9.2, 6, 9),
          rotation: new pc.Vec3(-25, 45, 0),
          default: true
      }, {
          name: 'top',
          title: 'Top',
          className: 'viewport-camera-top',
          position: new pc.Vec3(0, 1000, 0),
          rotation: new pc.Vec3(-90, 0, 0),
          ortho: true
      }, {
          name: 'bottom',
          title: 'Bottom',
          className: 'viewport-camera-bottom',
          position: new pc.Vec3(0, -1000, 0),
          rotation: new pc.Vec3(90, 0, 0),
          ortho: true
      }, {
          name: 'front',
          title: 'Front',
          className: 'viewport-camera-front',
          position: new pc.Vec3(0, 0, 1000),
          rotation: new pc.Vec3(0, 0, 0),
          ortho: true
      }, {
          name: 'back',
          title: 'Back',
          className: 'viewport-camera-back',
          position: new pc.Vec3(0, 0, -1000),
          rotation: new pc.Vec3(0, 180, 0),
          ortho: true
      }, {
          name: 'left',
          title: 'Left',
          className: 'viewport-camera-left',
          position: new pc.Vec3(-1000, 0, 0),
          rotation: new pc.Vec3(0, -90, 0),
          ortho: true
      }, {
          name: 'right',
          title: 'Right',
          className: 'viewport-camera-right',
          position: new pc.Vec3(1000, 0, 0),
          rotation: new pc.Vec3(0, 90, 0),
          ortho: true
      }];


      var createCamera = function(args) {
          var entity = new pc.Entity();
          entity.__editorCamera = true;
          entity.__editorName = args.name;
          entity.name = args.title;
          entity.className = args.className;
          entity.setPosition(args.position);
          entity.setEulerAngles(args.rotation);
          entity.focus = new pc.Vec3();

          editorCameras[args.name] = entity;

          var params = {
              nearClip: 0.1,
              farClip: 10000,
              priority: 0,
              clearColorBuffer: true,
              clearDepthBuffer: true,
              frustumCulling: true,
          };

          var layerOrder = projectSettings.get('layerOrder');
          if (layerOrder) {
              params.layers = layerOrder.map(function (l) {return parseInt(l.layer, 10);});
          }

          if (args.ortho) {
              params.projection = pc.PROJECTION_ORTHOGRAPHIC;
              params.orthoHeight = 5;
          } else {
              params.projection = pc.PROJECTION_PERSPECTIVE;
              params.fov = 45;
          }

          entity.addComponent('camera', params);
          entity.camera.enabled = false;

          app.root.addChild(entity);

          return entity;
      };

      // add default cameras
      for(var i = 0; i < list.length; i++) {
          var entity = createCamera(list[i]);

          editor.call('camera:add', entity);

          if (list[i].default && ! defaultCamera) {
              defaultCamera = entity;
              editor.call('camera:set', entity);
          }
      }

      // when layers change make sure that our Editor cameras have them
      projectSettings.on('layerOrder:insert', function (value) {
          var id = parseInt(value.get('layer'), 10);
          for (var key in editorCameras) {
              var entity = editorCameras[key];
              var idx = entity.camera.layers.indexOf(id);
              if (idx === -1) {
                  entity.camera.layers.push(id);
                  entity.camera.layers = entity.camera.layers; // force update
              }
          }

          editor.call('viewport:render');
      });

      projectSettings.on('layerOrder:remove', function (value) {
          var id = parseInt(value.get('layer'), 10);
          for (var key in editorCameras) {
              var entity = editorCameras[key];
              var idx = entity.camera.layers.indexOf(id);
              if (idx !== -1) {
                  entity.camera.layers.splice(idx, 1);
                  entity.camera.layers = entity.camera.layers; // force update
              }
          }

          editor.call('viewport:render');
      });

      editor.emit('camera:load');
  });
});


/* editor/camera/camera-history.js */
editor.once('load', function() {
  'use strict';

  var camera;
  var overlapping = 0;
  var position, rotation, eulers, orthoHeight;

  editor.method('camera:history:start', function(entity) {
      if (entity === camera) {
          overlapping++;
          return;
      } else if (camera) {
          editor.call('camera:history:stop');
      }

      var obj = editor.call('entities:get', entity.getGuid());
      if (! obj) return;

      camera = entity;
      overlapping = 1;
      position = camera.getLocalPosition().clone();
      rotation = camera.getLocalRotation().clone();
      eulers = obj.get('rotation');
      orthoHeight = camera.camera.orthoHeight;

      obj.history.enabled = false;
  });

  editor.method('camera:history:stop', function(entity) {
      if (! camera) return;

      if (entity) {
          if (entity !== camera)
              return;

          overlapping--;
          if (overlapping > 0)
              return;
      }

      var obj = editor.call('entities:get', camera.getGuid());
      if (! obj) {
          camera = null;
          return;
      }

      obj.history.enabled = true;

      var dist = position.clone().sub(camera.getLocalPosition()).length();
      var rotA = rotation;
      var rotB = camera.getLocalRotation();
      var theta = rotA.w * rotB.w + rotA.x * rotB.x + rotA.y * rotB.y + rotA.z * rotB.z;

      // not changed
      if (dist < 0.001 && theta > 0.999 && orthoHeight === camera.camera.orthoHeight) {
          camera = null;
          return;
      }

      var get = obj.history._getItemFn;

      var localPos = camera.getLocalPosition();
      var posCur = [localPos.x, localPos.y, localPos.z];
      var localEul = camera.getLocalEulerAngles();
      var rotCur = [localEul.x, localEul.y, localEul.z];
      var ortCur = camera.camera.orthoHeight;

      var posPrev = [position.x, position.y, position.z];
      var rotPrev = eulers.slice(0);
      var ortPrev = orthoHeight;

      camera = null;

      editor.call('history:add', {
          name: 'camera.user',
          undo: function() {
              var item = get();
              if (! item) return;

              item.history.enabled = false;
              item.set('position', posPrev);
              item.set('rotation', rotPrev);
              item.set('components.camera.orthoHeight', ortPrev);
              item.history.enabled = true;
          },
          redo: function() {
              var item = get();
              if (! item) return;

              item.history.enabled = false;
              item.set('position', posCur);
              item.set('rotation', rotCur);
              item.set('components.camera.orthoHeight', ortCur);
              item.history.enabled = true;
          }
      });
  });
});


/* editor/camera/camera-userdata.js */
editor.once('camera:load', function() {
  'use strict';

  var userdata = editor.call('userdata');
  var camera = editor.call('camera:current');


  editor.on('viewport:update', function() {
      var name = camera.__editorName;

      var data = userdata.get('cameras.' + name);
      if (data) {
          var pos = camera.getPosition();
          if (data.position[0] !== pos.x || data.position[1] !== pos.y || data.position[2] !== pos.z)
              userdata.set('cameras.' + name + '.position', [ pos.x, pos.y, pos.z ]);

          var rot = camera.getEulerAngles();
          if (data.rotation[0] !== rot.x || data.rotation[1] !== rot.y || data.rotation[2] !== rot.z)
              userdata.set('cameras.' + name + '.rotation', [ rot.x, rot.y, rot.z ]);

          var focus = camera.focus;
          if (data.focus[0] !== focus.x || data.focus[1] !== focus.y || data.focus[2] !== focus.z)
              userdata.set('cameras.' + name + '.focus', [ focus.x, focus.y, focus.z ]);

          if (camera.camera.projection === pc.PROJECTION_ORTHOGRAPHIC) {
              var orthoHeight = camera.camera.orthoHeight;
              if (data.orthoHeight !== orthoHeight)
                  userdata.set('cameras.' + name + '.orthoHeight', orthoHeight);
          }
      } else if (! camera.__editorCamera) {
          var obj = editor.call('entities:get', camera.getGuid());
          if (! obj) return;

          var pos = camera.getLocalPosition();
          var posOld = obj.get('position');

          if (pos.x !== posOld[0] || pos.y !== posOld[1] || pos.z !== posOld[2])
              obj.set('position', [ pos.x, pos.y, pos.z ]);

          var rotA = camera.getLocalRotation();
          var rotOld = obj.get('rotation');
          var rotB = new pc.Quat();
          rotB.setFromEulerAngles(rotOld[0], rotOld[1], rotOld[2]);
          var theta = rotA.w * rotB.w + rotA.x * rotB.x + rotA.y * rotB.y + rotA.z * rotB.z;

          if (theta < 0.999) {
              var rot = camera.getLocalEulerAngles();
              if (rot.x !== rotOld[0] || rot.y !== rotOld[1] || rot.z !== rotOld[2])
                  obj.set('rotation', [ rot.x, rot.y, rot.z ]);
          }

          if (camera.camera.projection === pc.PROJECTION_ORTHOGRAPHIC) {
              var orthoHeight = camera.camera.orthoHeight;
              if (obj.get('components.camera.orthoHeight') !== orthoHeight)
                  obj.set('components.camera.orthoHeight', orthoHeight);
          }
      }
  });

  editor.on('camera:change', function(cameraNew) {
      camera = cameraNew;
  });
});


/* editor/camera/camera-depth.js */
editor.once('viewport:load', function() {
  'use strict';

  var depthTarget;
  var app = editor.call('viewport:app');
  if (! app) return; // webgl not available

  var scene = app.scene;
  var renderer = app.renderer;
  var device = renderer.device;
  var rendered = false;


  editor.on('viewport:preUpdate', function() {
      rendered = false;
  });

  editor.method('camera:depth:render', function(camera) {
      var rect = camera.camera._rect;
      var width = Math.floor(rect.width * device.width);
      var height = Math.floor(rect.height * device.height);

      if (depthTarget && (depthTarget.width !== width || depthTarget.height !== height)) {
          depthTarget.destroy();
          depthTarget = null;
      }

      if (! depthTarget) {
          var colorBuffer = new pc.Texture(device, {
              format: pc.PIXELFORMAT_R8_G8_B8_A8,
              width: width,
              height: height
          });
          colorBuffer.minFilter = pc.FILTER_NEAREST;
          colorBuffer.magFilter = pc.FILTER_NEAREST;
          colorBuffer.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
          colorBuffer.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
          depthTarget = new pc.RenderTarget(device, colorBuffer, {
              depth: true
          });
      }

      var cam = camera.camera;
      renderer.setCamera(cam);
      renderer.clearView(camera, depthTarget)

      var oldBlending = device.getBlending();
      device.setBlending(false);

      var drawCalls = scene.drawCalls;
      var drawCallsCount = drawCalls.length;

      for (var i = 0; i < drawCallsCount; i++) {
          var opChan = 'r';
          var meshInstance = drawCalls[i];
          if (! meshInstance.command && meshInstance.material && meshInstance.material.blendType === pc.BLEND_NONE) {
              var mesh = meshInstance.mesh;

              renderer.modelMatrixId.setValue(meshInstance.node.worldTransform.data);

              var material = meshInstance.material;
              if (material.opacityMap) {
                  renderer.opacityMapId.setValue(material.opacityMap);
                  renderer.alphaTestId.setValue(material.alphaTest);
                  if (material.opacityMapChannel) opChan = material.opacityMapChannel;
              }

              if (meshInstance.skinInstance) {
                  renderer._skinDrawCalls++;
                  if (device.supportsBoneTextures) {
                      var boneTexture = meshInstance.skinInstance.boneTexture;
                      renderer.boneTextureId.setValue(boneTexture);
                      renderer.boneTextureSizeId.setValue([boneTexture.width, boneTexture.height]);
                  } else {
                      renderer.poseMatrixId.setValue(meshInstance.skinInstance.matrixPalette);
                  }
              }

              var shader = meshInstance._shader[pc.SHADER_DEPTH];
              if (!shader) {
                  app.renderer.updateShader(meshInstance, meshInstance._shaderDefs, null, pc.SHADER_DEPTH);
                  shader = meshInstance._shader[pc.SHADER_DEPTH];
              }
              device.setShader(shader);

              var style = meshInstance.renderStyle;

              device.setVertexBuffer(mesh.vertexBuffer, 0);
              device.setIndexBuffer(mesh.indexBuffer[style]);
              device.draw(mesh.primitive[style]);
              renderer._depthDrawCalls++;
          }
      }

      device.setBlending(oldBlending);

      rendered = true;

      return depthTarget;
  });


  editor.method('camera:depth:pixelAt', function(camera, x, y) {
      if (! depthTarget || ! rendered)
          editor.call('camera:depth:render', camera);

      var prevRenderTarget = device.renderTarget;

      device.setRenderTarget(depthTarget);
      device.updateBegin();

      var pixels = new Uint8Array(4);
      device.readPixels(x, depthTarget.height - y, 1, 1, pixels);

      device.updateEnd();

      device.setRenderTarget(prevRenderTarget);

      var bitShift = new pc.Vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
      var color = new pc.Vec4(pixels[0], pixels[1], pixels[2], pixels[3]);
      var colorDistance = color.dot(bitShift);

      if (colorDistance >= 255)
          return null;

      var distance = (camera.nearClip || 0.0001) + (camera.farClip * (colorDistance / 255.0));
      var point = new pc.Vec3();

      camera.camera.screenToWorld(x, y, distance, depthTarget.width, depthTarget.height, point);

      return point;
  });
});


/* editor/camera/camera-user.js */
editor.once('load', function() {
  'use sctrict';

  editor.on('entities:add:entity', function(entity) {
      if (entity.get('components.camera'))
          editor.call('camera:add', entity.entity);

      entity.on('components.camera:set', function() {
          editor.call('camera:add', entity.entity);
      });

      entity.on('components.camera:unset', function() {
          editor.call('camera:remove', entity.entity);
      });

      entity.once('destroy', function() {
          editor.call('camera:remove', entity.entity);
      });
  });
});


/* editor/camera/camera-focus.js */
editor.once('viewport:load', function() {
  'use strict';

  // Focusing on a point and a distance

  var focusTarget = new pc.Vec3();
  var focusPoint = new pc.Vec3();
  var focusOrthoHeight = 0;
  var focusCamera;
  var focusing = false;
  var firstUpdate = false;
  var flySpeed = 0.25;
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();


  editor.method('camera:focus', function(point, distance) {
      var camera = editor.call('camera:current');

      if (! focusing) {
          focusCamera = camera;
          editor.call('camera:history:start', focusCamera);
      }

      focusing = true;
      firstUpdate = true;

      if (camera.camera.projection === pc.PROJECTION_ORTHOGRAPHIC) {
          focusOrthoHeight = distance / 2;
          distance = (camera.camera.farClip - (camera.camera.nearClip || 0.0001)) / 2 + (camera.camera.nearClip || 0.0001);
      }

      focusTarget.copy(point);
      vecA.copy(camera.forward).scale(-distance);
      focusPoint.copy(point).add(vecA);

      editor.emit('camera:focus', point, distance);
      editor.call('viewport:render');
  });

  editor.method('camera:focus:stop', function() {
      if (! focusing)
          return;

      focusing = false;
      var camera = editor.call('camera:current');
      editor.emit('camera:focus:end', focusTarget, vecA.copy(focusTarget).sub(camera.getPosition()).length());
      editor.once('viewport:postUpdate', function() {
          editor.call('camera:history:stop', focusCamera);
      });
  });

  editor.on('viewport:update', function(dt) {
      if (focusing) {
          var camera = editor.call('camera:current');

          var pos = camera.getPosition();
          var dist = vecA.copy(pos).sub(focusPoint).length();
          if (dist > 0.01) {
              var speed = Math.min(1.0, Math.min(1.0, flySpeed * ((firstUpdate ? 1 / 60 : dt) / (1 / 60))));
              vecA.copy(pos).lerp(pos, focusPoint, speed);
              camera.setPosition(vecA);

              if (camera.camera.projection === pc.PROJECTION_ORTHOGRAPHIC) {
                  var orthoHeight = camera.camera.orthoHeight;
                  orthoHeight += (focusOrthoHeight - orthoHeight) * Math.min(1.0, flySpeed * ((firstUpdate ? 1 / 60 : dt) / (1 / 60)));
                  camera.camera.orthoHeight = orthoHeight;
              }

              editor.call('viewport:render');
          } else {
              camera.setPosition(focusPoint);
              if (camera.camera.projection === pc.PROJECTION_ORTHOGRAPHIC)
                  camera.camera.orthoHeight = focusOrthoHeight;

              focusing = false;

              editor.emit('camera:focus:end', focusTarget, vecA.copy(focusTarget).sub(camera.getPosition()).length());
              editor.once('viewport:postUpdate', function() {
                  editor.call('camera:history:stop', focusCamera);
              });
          }

          firstUpdate = false;
      }
  });
});


/* editor/camera/camera-fly.js */
editor.once('viewport:load', function() {
  'use strict';

  // Flying with WASD or Arrows

  var vecA = new pc.Vec3();
  var direction = new pc.Vec3();

  var flying = false;
  var flySpeed = 7;
  var flySpeedFast = 25;
  var flySpeedTarget = 0;
  var flyEasing = 0.5;
  var flyVec = new pc.Vec3();
  var flyCamera = null;
  var firstUpdate = false;
  var shiftKey = false;

  var keys = {
      forward: false,
      left: false,
      back: false,
      right: false,
      up: false,
      down: false
  };
  var keysMovement = { 87: 1, 38: 1, 65: 1, 37: 1, 83: 1, 40: 1, 68: 1, 39: 1, 81: 1, 69: 1, 34: 1, 33: 1 };


  editor.method('camera:fly:state', function() {
      return flying;
  });

  editor.on('viewport:update', function(dt) {
      var camera;
      var speed = 0;

      if (flying) {
          speed = shiftKey ? flySpeedFast : flySpeed;
          speed *= firstUpdate ? (1 / 60) : dt;

          camera = editor.call('camera:current');

          vecA.copy(direction).scale(speed);

          if (camera.camera.projection === pc.PROJECTION_ORTHOGRAPHIC) {
              vecA.y = -vecA.z;
              vecA.z = 0;
          }

          if (vecA.length()) {
              camera.getRotation().transformVector(vecA, vecA);
              flyVec.lerp(flyVec, vecA, Math.min(1.0, flyEasing * ((firstUpdate ? 1 / 60 : dt) / (1 / 60))));
          } else {
              speed = 0;
          }

          editor.call('viewport:render');
      }

      if (flyVec.length() > 0.01) {
          if (speed === 0)
              flyVec.lerp(flyVec, vecA.set(0, 0, 0), Math.min(1.0, flyEasing * ((firstUpdate ? 1 / 60 : dt) / (1 / 60))));

          if (flyVec.length()) {
              camera = camera || editor.call('camera:current');
              camera.setPosition(camera.getPosition().add(flyVec));
          }

          firstUpdate = false;
          editor.call('viewport:render');
      }
  });

  editor.on('hotkey:shift', function(state) {
      shiftKey = state;
  });

  window.addEventListener('keydown', function(evt) {
      if (! keysMovement[evt.keyCode] || evt.ctrlKey || evt.metaKey || evt.altKey)
          return;

      if (evt.target && /(input)|(textarea)/i.test(evt.target.tagName))
          return;

      if (evt.keyCode === 87 || evt.keyCode === 38) {
          keys.forward = true;
      } else if (evt.keyCode === 65 || evt.keyCode === 37) {
          keys.left = true;
      } else if (evt.keyCode === 83 || evt.keyCode === 40) {
          keys.back = true;
      } else if (evt.keyCode === 68 || evt.keyCode === 39) {
          keys.right = true;
      } else if (evt.keyCode === 69 || evt.keyCode === 33) {
          keys.up = true;
      } else if (evt.keyCode === 81 || evt.keyCode === 34) {
          keys.down = true;
      }

      direction.set(keys.right - keys.left, keys.up - keys.down, keys.back - keys.forward).normalize();

      if (! flying) {
          flyCamera = editor.call('camera:current');
          editor.call('camera:history:start', flyCamera);
      }

      flying = true;
      firstUpdate = true;
      editor.call('camera:focus:stop');
      editor.call('viewport:render');
  }, false);

  window.addEventListener('keyup', function(evt) {
      if (! flying || ! keysMovement[evt.keyCode] || evt.ctrlKey || evt.metaKey || evt.altKey)
          return;

      if (evt.target && /(input)|(textarea)/i.test(evt.target.tagName))
          return;

      if (evt.keyCode === 87 || evt.keyCode === 38) {
          keys.forward = false;
      } else if (evt.keyCode === 65 || evt.keyCode === 37) {
          keys.left = false;
      } else if (evt.keyCode === 83 || evt.keyCode === 40) {
          keys.back = false;
      } else if (evt.keyCode === 68 || evt.keyCode === 39) {
          keys.right = false;
      } else if (evt.keyCode === 69 || evt.keyCode === 33) {
          keys.up = false;
      } else if (evt.keyCode === 81 || evt.keyCode === 34) {
          keys.down = false;
      }

      direction.set(keys.right - keys.left, keys.up - keys.down, keys.back - keys.forward).normalize();

      if (! keys.forward && ! keys.left && ! keys.back && ! keys.right && ! keys.up && ! keys.down) {
          flying = false;
          editor.call('camera:history:stop', flyCamera);
          editor.call('viewport:render');
      }
  }, false);
});


/* editor/camera/camera-orbit.js */
editor.once('viewport:load', function() {
  'use strict';

  // Orbit camera with virtual point of focus
  // Zooming / Flying will not move virtual point forward/backwards

  var orbiting = false;
  var orbitCamera;
  var pivot = new pc.Vec3();
  var distance = 1;
  var sensivity = 0.2;
  var pitch = 0;
  var yaw = 0;
  var vec2 = new pc.Vec2();
  var vecA = new pc.Vec3();
  var quat = new pc.Quat();


  editor.on('viewport:update', function(dt) {
      var camera = editor.call('camera:current');

      if (camera.camera.projection !== pc.PROJECTION_PERSPECTIVE)
          return;

      distance = Math.max(0.01, vecA.copy(pivot).sub(camera.getPosition()).length());
      pivot.copy(camera.forward).scale(distance).add(camera.getPosition());

      if (orbiting) {
          quat.setFromEulerAngles(pitch, yaw, 0);
          vecA.set(0, 0, distance);
          quat.transformVector(vecA, vecA);
          vecA.add(pivot);

          camera.setPosition(vecA);
          camera.lookAt(pivot);

          editor.call('viewport:render');
      }

      if (camera.focus)
          camera.focus.copy(pivot);
  });

  editor.on('camera:change', function(camera) {
      if (! camera.focus)
          return;

      pivot.copy(camera.focus);
  });

  editor.on('camera:focus', function(point) {
      pivot.copy(point);

      var camera = editor.call('camera:current');
      if (camera.focus)
          camera.focus.copy(pivot);
  });

  editor.on('camera:focus:end', function(point, value) {
      var camera = editor.call('camera:current');
      distance = value;
      pivot.copy(camera.forward).scale(distance).add(camera.getPosition());

      var camera = editor.call('camera:current');
      if (camera.focus)
          camera.focus.copy(pivot);
  });

  editor.on('viewport:tap:start', function(tap, evt) {
      if (tap.button !== 0 || evt.shiftKey || orbiting)
          return;

      editor.call('camera:focus:stop');

      var camera = editor.call('camera:current');

      if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
          orbiting = true;

          // disable history
          orbitCamera = camera;
          editor.call('camera:history:start', orbitCamera);

          // pitch
          var x = Math.cos(Math.asin(camera.forward.y));
          vec2.set(x, camera.forward.y).normalize();
          pitch =  Math.max(-89.99, Math.min(89.99, Math.atan2(vec2.y, vec2.x) / (Math.PI / 180)));

          // yaw
          vec2.set(camera.forward.x, -camera.forward.z).normalize();
          yaw = -Math.atan2(vec2.x, vec2.y) / (Math.PI / 180);

          editor.call('viewport:render');
      } else {
          editor.call('camera:pan:start', tap);
      }
  });

  editor.on('viewport:tap:end', function(tap) {
      if (tap.button !== 0 || ! orbiting)
          return;

      orbiting = false;
      editor.call('camera:history:stop', orbitCamera);
  });

  editor.on('viewport:tap:move', function(tap) {
      if (! orbiting || tap.button !== 0)
          return;

      pitch = Math.max(-89.99, Math.min(89.99, pitch - (tap.y - tap.ly) * sensivity));
      yaw += (tap.lx - tap.x) * sensivity;

      editor.call('viewport:render');
  });

  editor.on('camera:toggle', function(state) {
      if (! state && orbiting) {
          orbiting = false;
          editor.call('camera:history:stop', orbitCamera);
      }
  });
});


/* editor/camera/camera-zoom.js */
editor.once('viewport:load', function() {
  'use strict';

  // Moving towards mouse point in world using mouse wheel
  // Speed is relative to distance of point in world

  var zoom = 0;
  var zoomTarget = 0;
  var zoomSpeed = 0.1;
  var zoomSpeedFast = 0.5;
  var zoomEasing = 0.3;
  var zoomMax = 300;
  var zoomCamera;
  var shiftKey = false;
  var hovering = false;
  var firstUpdate = 3;
  var mouseCoords = new pc.Vec2();
  var vecA = new pc.Vec3();
  var vecB = new pc.Vec3();
  var distance = 1;

  var selectorLastType = null;
  var aabbSelection = new pc.BoundingBox();
  var aabbSelectionLast = 0;
  var aabbRoot = new pc.BoundingBox();
  var aabbRootLast = 0;

  editor.on('hotkey:shift', function(state) {
      shiftKey = state;
  });
  editor.on('viewport:hover', function(state) {
      hovering = state;
  });

  editor.on('selector:change', function(type) {
      if (selectorLastType !== type || type === 'entity') {
          selectorLastType = type;
          aabbSelectionLast = 0;
      }
  });

  editor.on('viewport:update', function(dt) {
      if (zoomTarget !== zoom) {
          var diff = zoom;
          zoom += (zoomTarget - zoom) * Math.min(1.0, zoomEasing * ((firstUpdate === 1 ? 1 / 60 : dt) / (1 / 60)));
          diff = zoom - diff;

          var orbiting = editor.call('camera:orbit:state');
          var camera = editor.call('camera:current');

          if (firstUpdate === 1) {
              zoomCamera = camera;
              editor.call('camera:history:start', zoomCamera);
          }

          if (diff !== 0) {
              if (orbiting) {
                  var dist = editor.call('camera:orbit:distance');
                  dist -= diff * Math.max(1, Math.min(zoomMax, dist));
                  editor.call('camera:orbit:distance', dist);
              } else {
                  if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
                      var mouseWPos = camera.camera.screenToWorld(mouseCoords.x, mouseCoords.y, 1);
                      var rayDirection = vecB.copy(mouseWPos).sub(camera.getPosition()).normalize();

                      var point = editor.call('camera:depth:pixelAt', camera.camera, mouseCoords.x, mouseCoords.y);
                      if (point) {
                          point.sub(camera.getPosition());
                          distance = Math.max(1, Math.min(zoomMax, point.length()));
                      } else {
                          // distance to selected entity
                          var aabb;

                          // cache and recalculate aabb only periodically
                          if (selectorLastType === 'entity') {
                              if ((Date.now() - aabbSelectionLast > 1000)) {
                                  aabbSelectionLast = Date.now();
                                  aabb = editor.call('selection:aabb');
                                  if (aabb) aabbSelection.copy(aabb);
                              } else {
                                  aabb = aabbSelection;
                              }
                          }

                          if (aabb) {
                              distance = Math.max(1, Math.min(zoomMax, aabb.center.clone().sub(camera.getPosition()).length()));
                          } else {
                              // nothing selected, then size of aabb of scene or distance to center of aabb

                              if ((Date.now() - aabbRootLast) > 1000) {
                                  aabbRootLast = Date.now();
                                  aabbRoot.copy(editor.call('entities:aabb', editor.call('entities:root')));
                              }

                              aabb = aabbRoot;

                              if (editor.call('entities:root')) {
                                  distance = Math.max(aabb.halfExtents.length(), aabb.center.clone().sub(camera.getPosition()).length());
                                  distance = Math.max(1, Math.min(zoomMax, distance));
                              }
                          }
                      }

                      diff *= distance;

                      if (diff) {
                          vecA.copy(rayDirection).scale(diff);
                          camera.setPosition(camera.getPosition().add(vecA));
                      }
                  } else {
                      var orthoHeight = camera.camera.orthoHeight;
                      diff *= -orthoHeight;
                      if (diff) camera.camera.orthoHeight = Math.max(0.1, orthoHeight + diff);

                      // TODO
                      // on zoom, move camera same as google maps does
                  }
              }

              if (Math.abs(zoomTarget - zoom) < 0.001)
                  zoom = zoomTarget;
          }

          editor.call('viewport:render');
          firstUpdate = 2;
      } else {
          if (firstUpdate === 2) {
              firstUpdate = 3;
              editor.once('viewport:postUpdate', function() {
                  editor.call('camera:history:stop', zoomCamera);
              });
          }
      }
  });

  var onMouseWheel = function(evt) {
      if (! hovering)
          return;

      shiftKey = evt.shiftKey;

      var delta = 0;
      if (evt.detail) {
          delta = -1 * evt.detail / 3;
      } else if (evt.wheelDelta) {
          delta = evt.wheelDelta / 120;
      }

      if (delta !== 0) {
          editor.call('camera:focus:stop');

          if (firstUpdate === 3)
              firstUpdate = 1;

          var speed = delta * (shiftKey ? zoomSpeedFast : zoomSpeed);
          zoomTarget += speed;

          editor.call('viewport:render');
      }
  };

  var onFocus = function(point, dist) {
      distance = Math.max(1, Math.min(zoomMax, dist));
  };

  editor.on('camera:focus', onFocus);
  editor.on('camera:focus:end', onFocus);

  editor.on('viewport:mouse:move', function(tap) {
      mouseCoords.x = tap.x;
      mouseCoords.y = tap.y;
  });

  window.addEventListener('mousewheel', onMouseWheel, false);
  window.addEventListener('DOMMouseScroll', onMouseWheel, false);
});


/* editor/camera/camera-pan.js */
editor.once('viewport:load', function(app) {
  'use strict';

  // Panning with left mouse button while shift key is down

  var panning = false;
  var panSpeed = 0.01;
  var panCamera;
  var shiftKey = false;
  var vecA = new pc.Vec2();
  var vecB = new pc.Vec3();
  var vecC = new pc.Vec3();
  var vecD = new pc.Vec3();
  var vecE = new pc.Vec3();
  var quat = new pc.Quat();
  var panLastPosition = new pc.Vec3();
  var panPosition = new pc.Vec3();
  var firstPan = false;
  var panPoint = new pc.Vec3();
  var grabbed = false;
  var panButton = 0;


  editor.on('hotkey:shift', function(state) {
      shiftKey = state;
  });

  editor.on('viewport:update', function(dt) {
      if (! panning)
          return;

      var camera = editor.call('camera:current');

      if (grabbed) {
          var mouseWPos = camera.camera.screenToWorld(vecA.x, vecA.y, 1);
          var rayOrigin = vecB.copy(camera.getPosition());
          var rayDirection = vecC.set(0, 0, -1);
          var planeNormal = vecD.copy(camera.forward);

          if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
              rayDirection.copy(mouseWPos).sub(rayOrigin).normalize();
          } else {
              rayOrigin.copy(mouseWPos);
              camera.getWorldTransform().transformVector(rayDirection, rayDirection);
          }

          var rayPlaneDot = planeNormal.dot(rayDirection);
          var planeDist = panPoint.dot(planeNormal);
          var pointPlaneDist = (planeNormal.dot(rayOrigin) - planeDist) / rayPlaneDot;
          var pickedPos = rayDirection.scale(-pointPlaneDist).add(rayOrigin);

          vecB.copy(panPoint).sub(pickedPos);

          if (vecB.length())
              camera.setPosition(camera.getPosition().add(vecB));
      } else {

      }

      editor.call('viewport:render');
  });

  var onPanStart = function(tap) {
      if (panning)
          return;

      panButton = tap.button;

      editor.call('camera:focus:stop');
      panning = true;
      firstPan = true;

      var camera = editor.call('camera:current');
      var point = editor.call('camera:depth:pixelAt', camera.camera, tap.x, tap.y);

      panCamera = camera;
      editor.call('camera:history:start', panCamera);

      vecA.x = tap.x;
      vecA.y = tap.y;

      if (point) {
          panPoint.copy(point);
          grabbed = true;
      } else {
          // distance to selected entity
          var aabb = editor.call('selection:aabb');

          if (aabb) {
              var dist = aabb.center.clone().sub(camera.getPosition()).length();
              panPoint.copy(camera.camera.screenToWorld(vecA.x, vecA.y, dist));
              grabbed = true;
          } else {
              // nothing selected, then size of aabb of scene or distance to center of aabb
              aabb = editor.call('entities:aabb', editor.call('entities:root'));

              if (editor.call('entities:root')) {
                  var dist = Math.max(aabb.halfExtents.length(), aabb.center.clone().sub(camera.getPosition()).length());
                  panPoint.copy(camera.camera.screenToWorld(vecA.x, vecA.y, dist));
                  grabbed = true;
              } else {
                  grabbed = false;
              }
          }
      }

      editor.call('viewport:render');
  };
  editor.method('camera:pan:start', onPanStart);

  editor.on('viewport:tap:start', function(tap) {
      if (panning || ((tap.button !== 0 || ! shiftKey) && tap.button !== 1))
          return;

      onPanStart(tap);
  });

  editor.on('viewport:tap:end', function(tap) {
      if (! panning || tap.button !== panButton)
          return;

      panning = false;
      editor.call('camera:history:stop', panCamera);
  });

  editor.on('viewport:tap:move', function(tap) {
      if (! panning)
          return;

      vecA.x = tap.x;
      vecA.y = tap.y;

      editor.call('viewport:render');
  });

  editor.on('camera:toggle', function(state) {
      if (! state && panning) {
          panning = false;
          editor.call('camera:history:stop', panCamera);
      }
  });
});


/* editor/camera/camera-look-around.js */
editor.once('viewport:load', function() {
  'use strict';

  // Looking around with right mouse button

  var looking = false;
  var sensivity = 0.2;
  var vecA = new pc.Vec2();
  var lookCamera;

  var pitch = 0;
  var yaw = 0;

  editor.on('viewport:tap:start', function(tap) {
      if (tap.button !== 2 || looking)
          return;

      editor.call('camera:focus:stop');
      var camera = editor.call('camera:current');

      if (camera.camera.projection === pc.PROJECTION_PERSPECTIVE) {
          looking = true;
          lookCamera = camera;
          editor.call('camera:history:start', lookCamera);

          // pitch
          var x = Math.cos(Math.asin(camera.forward.y));
          vecA.set(x, camera.forward.y).normalize();
          pitch =  Math.max(-89.99, Math.min(89.99, Math.atan2(vecA.y, vecA.x) / (Math.PI / 180)));

          // yaw
          vecA.set(camera.forward.x, -camera.forward.z).normalize();
          yaw = -Math.atan2(vecA.x, vecA.y) / (Math.PI / 180);
      } else {
          editor.call('camera:pan:start', tap);
      }
  });

  editor.on('viewport:tap:end', function(tap) {
      if (tap.button !== 2 || ! looking)
          return;

      looking = false;
      editor.call('camera:history:stop', lookCamera);
  });

  editor.on('viewport:tap:move', function(tap) {
      if (! looking || tap.button !== 2)
          return;

      var camera = editor.call('camera:current');

      if (camera.camera.projection !== pc.PROJECTION_PERSPECTIVE)
          return;

      pitch = Math.max(-89.99, Math.min(89.99, pitch + (tap.ly - tap.y) * sensivity));
      yaw += (tap.lx - tap.x) * sensivity;

      camera.setEulerAngles(pitch, yaw, 0);

      editor.call('viewport:render');
  });
});


/* editor/camera/camera-preview.js */
editor.once('load', function() {
  'use strict';

  var selectedEntity = null; // currently selected entity
  var currentCamera = null;  // current camera rendering to viewport
  var renderCamera = false;
  var pinnedCamera = null;   // camera that is currently pinned in preview
  var enabled = false;
  var lastCamera = null;     // camera that was last set to preview
  var oldLayers = null;
  var events = [ ];
  var evtUpdate = null;
  var rect = new pc.Vec4(0, 0.8, 0.2, 0.2);
  var app = null;
  var previewLayer = null;
  var editorCamera = null;
  var previewCamera = null;

  var viewport = editor.call('layout.viewport');

  var cameraPreviewBorder = document.createElement('div');
  cameraPreviewBorder.classList.add('camera-preview');
  if (editor.call('permissions:write'))
      cameraPreviewBorder.classList.add('clickable');

  var btnPin = new ui.Button({
      text: '&#58177;'
  });
  btnPin.class.add('pin');
  cameraPreviewBorder.appendChild(btnPin.element);

  btnPin.on('click', function(evt) {
      evt.stopPropagation();

      if (pinnedCamera) {
          pinnedCamera = null;
          btnPin.class.remove('active');
      } else {
          pinnedCamera = selectedEntity;
          btnPin.class.add('active');
      }

      updateCameraState();
  });

  viewport.append(cameraPreviewBorder);

  cameraPreviewBorder.addEventListener('click', function() {
      var obj = pinnedCamera || selectedEntity;
      if (! obj || ! obj.entity || ! editor.call('permissions:write'))
          return;

      editor.call('camera:set', obj.entity);

      // updateCameraState();
  }, false);


  editor.once('viewport:load', function(application) {
      app = application;
  });

  editor.on('permissions:writeState', function(state) {
      if (state) {
          cameraPreviewBorder.classList.add('clickable');
      } else {
          cameraPreviewBorder.classList.remove('clickable');
      }
  });

  editor.on('viewport:resize', function(width, height) {
      rect.x = 6.0 / width;
      rect.y = 1.0 - ((43.0 + 196.0) / (height || 1.0));
      rect.z = 258.0 / width;
      rect.w = 198.0 / height;

      updateCameraState();
  });

  var updateCameraState = function() {
      if (pinnedCamera) {
          if (currentCamera && currentCamera === pinnedCamera.entity) {
              renderCamera = false;
          } else {
              renderCamera = true;
          }
      } else if (selectedEntity && selectedEntity.entity && ! (currentCamera && selectedEntity.entity === currentCamera) && selectedEntity.has('components.camera')) {
          renderCamera = true;
      } else {
          renderCamera = false;
      }

      if (renderCamera) {
          var camera;

          // start rendering preview
          cameraPreviewBorder.classList.add('active');

          var obj = pinnedCamera || selectedEntity;
          if (obj.entity && obj.entity.camera) {
              camera = obj.entity.camera;
          }

          if (camera) {
              // ### ENABLE CAMERA ###

              previewCamera = camera;
              editorCamera = editor.call('camera:current');

              if (!previewLayer) {
                  previewLayer = editor.call('gizmo:layers', 'Camera Preview');
                  previewLayer.onPostRender = function() {
                      if (!previewCamera || !previewCamera.entity || !previewCamera.data) return;
                      var entityEnabled = previewCamera.entity.enabled;
                      previewCamera.entity.enabled = true;
                      previewCamera.enabled = true;
                      previewCamera.rect = rect;
                      previewCamera.camera.cullingMask = GEOMETRY_ONLY_CULLING_MASK;
                      editorCamera.enabled = false;

                      previewLayer.enabled = false;
                      app.renderer.renderComposition(app.scene.layers);
                      previewLayer.enabled = true;

                      previewCamera.enabled = false;
                      previewCamera.camera.cullingMask = DEFAULT_CULLING_MASK;
                      editorCamera.enabled = true;
                      previewCamera.entity.enabled = entityEnabled;
                  };
              }

              previewLayer.enabled = true;

              if (lastCamera && lastCamera !== camera) {
                  if (lastCamera && lastCamera.entity && lastCamera.data && lastCamera.entity !== currentCamera) {
                      lastCamera.enabled = false;
                      lastCamera.camera.cullingMask = DEFAULT_CULLING_MASK;
                  }
                  lastCamera = null;
              }


              lastCamera = camera;
          }
      } else {

          // stop rendering preview
          cameraPreviewBorder.classList.remove('active');


          if (previewLayer) previewLayer.enabled = false;
          if (lastCamera) {
              // ### DISABLE CAMERA ###
              if (lastCamera && lastCamera.entity && lastCamera.data && lastCamera.entity !== currentCamera) {
                  lastCamera.enabled = false;
                  lastCamera.camera.cullingMask = DEFAULT_CULLING_MASK;
              }
              lastCamera = null;
          }


          enabled = false;
      }
  };

  editor.on('camera:change', function(camera) {
      if (camera && ! camera.__editorCamera) {
          currentCamera = camera;
      } else {
          currentCamera = null;
      }

      updateCameraState();
  });

  editor.on('selector:change', function(type, items) {
      if (events.length) {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();

          events = [ ];
      }

      if (type === 'entity' && items.length === 1) {
          selectedEntity = items[0];
          events.push(selectedEntity.on('components.camera:set', updateCameraState));
          events.push(selectedEntity.on('components.camera:unset', updateCameraState));
          events.push(selectedEntity.on('destroy', updateCameraState));
      } else {
          selectedEntity = null;
      }

      updateCameraState();
  });
});
