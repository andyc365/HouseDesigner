/* editor/images/images-upload.js */
editor.once('load', function () {
  editor.method('images:upload', function (file, callback, error) {
      if (!file || !file.size)
          return;

      var form = new FormData();
      form.append('file', file);

      var data = {
          url: '/api/projects/{{project.id}}/image',
          method: 'POST',
          auth: true,
          data: form,
          ignoreContentType: true,
          headers: {
              Accept: 'application/json'
          }
      };

      Ajax(data)
      .on('load', function(status, data) {
          if (callback)
              callback(data);
      })
      .on('progress', function(progress) {
      })
      .on('error', function(status, data) {
          if (error)
              error(status, data);
      });
  });
});


/* editor/userdata/userdata-realtime.js */
editor.once('load', function() {
  'use strict';

  var userData = null;

  var loadUserData = function () {
      if (! userData && config.scene.id) {
          userData = editor.call('realtime:subscribe:userdata', config.scene.uniqueId, config.self.id);
      }
  };

  editor.method('realtime:subscribe:userdata', function (sceneId, userId) {
      var connection = editor.call('realtime:connection');
      var data = connection.get('user_data', '' + sceneId + '_' + userId);

      // error
      data.on('error', function (err) {
          editor.emit('realtime:userdata:error', err);
      });

      // ready to sync
      data.on('load', function() {
          // notify of operations
          data.on('op', function(ops, local) {
              if (local) return;

              for (var i = 0; i < ops.length; i++) {
                  if (ops[i].p[0])
                      editor.emit('realtime:userdata:' + userId + ':op:' + ops[i].p[0], ops[i]);
              }
          });

          // notify of scene load
          editor.emit('userdata:' + userId + ':raw', data.data);
      });

      // subscribe for realtime events
      data.subscribe();

      if (data.data)
          editor.emit('userdata:' + userId + ':raw', data.data);

      return data;
  });

  // write userdata operations
  editor.method('realtime:userdata:op', function(op) {
      if (! editor.call('permissions:read') || ! userData)
          return;

      // console.trace();
      // console.log('out: [ ' + Object.keys(op).filter(function(i) { return i !== 'p' }).join(', ') + ' ]', op.p.join('.'));
      // console.log(op)

      userData.submitOp([ op ]);
  });

  // subscribe to permission changes for userdata
  editor.on('permissions:set:' + config.self.id, function () {
      if (editor.call('permissions:read') && config.scene.id) {
          loadUserData();
      } else {
          if (userData) {
              userData.destroy();
              userData = null;
          }
      }
  });

  editor.on('realtime:disconnected', function () {
      if (userData) {
          userData.destroy();
          userData = null;
      }
  });

  editor.on('scene:unload', function () {
      if (userData) {
          userData.destroy();
          userData = null;
      }
  });

  editor.on('scene:raw', function () {
      if (editor.call('permissions:read'))
          loadUserData();
  });

});


/* editor/userdata/userdata.js */
editor.once('load', function() {
  'use strict';

  var userdata = new Observer();

  editor.on('userdata:' + config.self.id + ':raw', function (data) {

      if (! userdata.sync) {
          userdata.sync = new ObserverSync({
              item: userdata,
              paths: [ 'cameras' ]
          });

          // client > server
          userdata.sync.on('op', function(op) {
              if (op.oi === null) {
                  console.error('Tried to send invalid userdata op', op);
                  return;
              }

              editor.call('realtime:userdata:op', op);
          });
      }
      
      userdata.sync.enabled = false;
      userdata.patch(data);
      userdata.sync.enabled = true;

      editor.emit('userdata:load', userdata);
  });

  editor.method('userdata', function () {
      return userdata;
  });
});


/* editor/scenes/scenes.js */
editor.once('load', function () {
  'use strict';

  // Fetch list of scenes from the server and
  // pass them to the callback
  editor.method('scenes:list', function (callback) {
      Ajax({
          url: '{{url.api}}/projects/{{project.id}}/scenes?branchId=' + config.self.branch.id,
          auth: true
      })
      .on('load', function (status, data) {
          if (callback)
              callback(data.result);
      });
  });

  // Get a specific scene from the server and pass result to callback
  editor.method('scenes:get', function (sceneId, callback) {
      Ajax({
          url: '{{url.api}}/scenes/' + sceneId + '?branchId=' + config.self.branch.id,
          auth: true
      })
      .on('error', function (status, data) {
          if (callback) {
              callback(data);
          }
      })
      .on('load', function (status, data) {
          if (callback) {
              callback(null, data);
          }
      });
  });

  // Create a scene and pass result to callback
  editor.method('scenes:new', function (name, callback) {
      var data = {
          projectId: config.project.id,
          branchId: config.self.branch.id
      };

      if (name) data.name = name;

      Ajax({
          url: '{{url.api}}/scenes',
          auth: true,
          method: 'POST',
          data: data
      })
      .on('load', function (status, data) {
          if (callback)
              callback(data);
      });
  });

  // Duplicate scene and pass result to callback
  editor.method('scenes:duplicate', function (sceneId, newName, callback) {
      Ajax({
          url: '{{url.api}}/scenes',
          auth: true,
          method: 'POST',
          data: {
              projectId: config.project.id,
              duplicateFrom: parseInt(sceneId, 10),
              branchId: config.self.branch.id,
              name: newName
          }
      })
      .on('load', function (status, data) {
          if (callback)
              callback(data);
      });
  });


  // Delete a scene
  editor.method('scenes:delete', function (sceneId, callback) {
      Ajax({
          url: '{{url.api}}/scenes/' + sceneId + '?branchId=' + config.self.branch.id,
          auth: true,
          method: 'DELETE'
      })
      .on('load', function (status, data) {
          if (callback)
              callback();
      });
  });

});


/* editor/scenes/scenes-load.js */
editor.once('load', function () {
  'use strict';

  var pushState = true;
  var sceneSelected = false;
  var deletedScenes = {};

  var realtimeAuthenticated = false;

  editor.on('realtime:authenticated', function () {
      realtimeAuthenticated = true;
  });

  editor.on('realtime:disconnected', function () {
      realtimeAuthenticated = false;
  });

  var evtLoadOnAuthenticated = null;

  // Change URL to project, unload current scene and open scene picker
  var goToProject = function () {
      history.replaceState(null, 'Editor', '/editor/project/' + config.project.id + window.location.search);
      editor.call('scene:unload');
      editor.call('picker:scene');
  };

  // Load scene with specified id. If isNew is true
  // then scene settings will open right after loading the new scene
  editor.method('scene:load', function (uniqueId, isNew) {
      if (config.scene.id)
          editor.call('scene:unload');

      if (evtLoadOnAuthenticated) {
          evtLoadOnAuthenticated.unbind();
      }

      // if we have not been authenticated with shareDb yet
      // then defer loading until we are authenticated
      if (! realtimeAuthenticated) {
          evtLoadOnAuthenticated = editor.once('realtime:authenticated', function () {
              evtLoadOnAuthenticated = null;
              editor.call('scene:load', uniqueId, isNew);
          });

          return;
      }

      editor.emit('scene:beforeload', uniqueId);

      editor.call('realtime:loadScene', uniqueId);

      if (isNew) {
          editor.once('entities:load', function () {
              editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
          });
      }
  });

  // When scene is loaded
  editor.on('scene:load', function (id, uniqueId) {
      // set config
      config.scene.id = id.toString();
      config.scene.uniqueId = uniqueId.toString();

      Ajax.param('scene.id', config.scene.id);

      // add history state
      if (pushState) {
          if (history.length === 1 && window.location.pathname.startsWith('/editor/scene/')) {
              history.replaceState(null, 'Editor', '/editor/scene/' + id + window.location.search);
          } else {
              history.pushState(null, 'Editor', '/editor/scene/' + id + window.location.search);
          }
      }

      pushState = true;

      // clear history in a timeout
      // otherwise some select events might remain
      setTimeout(function () {
          editor.call('history:clear');
      });
  });

  // Unload current scene
  editor.method('scene:unload', function () {
      var id = config.scene.id;
      var uniqueId = config.scene.uniqueId;
      config.scene.id = null;
      config.scene.uniqueId = null;

      editor.emit('scene:unload', id, uniqueId);
  });

  // When history state changes make sure we load the
  // correct scene based on the new URL
  window.addEventListener('popstate', function (e) {
      var location = window.location.href;

      // close scene picker
      editor.call('picker:scene:close');

      // if this is a scene URL
      if (/scene/.test(location)) {
          var parts = location.split('/');
          var sceneId = parts[parts.length - 1];
          // if this is not the current scene
          if (parseInt(sceneId, 10) !== parseInt(config.scene.id, 10)) {
              // if the current scene has been deleted then don't load it
              // but rather make the current URL a project URL so that the scene picker opens
              if (deletedScenes[sceneId]) {
                  goToProject();
              } else {
                  // unload current scene
                  if (config.scene.id) {
                      editor.call('scene:unload');
                  }
                  // get scene from the API to get the unique id
                  editor.call('scenes:get', sceneId, function (err, scene) {
                      if (err) {
                          goToProject();
                      } else {
                          // load scene but don't add it to the history
                          pushState = false;
                          editor.call('scene:load', scene.uniqueId);
                      }
                  });
              }
          }
      } else {
          // if this is not a scene URL then
          // unload current scene and show scene picker
          editor.call('scene:unload');
          editor.call('picker:scene');
      }
  });

  // subscribe to messenger scene.delete
  editor.on('messenger:scene.delete', function (data) {
      if (data.scene.branchId !== config.self.branch.id) return;

      // add scene to deleted so that we don't try to reopen it
      // on the 'popstate' event
      deletedScenes[data.scene.id] = true;

      // if the current scene has been deleted then change URL to project URL
      if (parseInt(config.scene.id, 10) === parseInt(data.scene.id, 10)) {
          goToProject();
      }
  });
});


/* editor/checkpoints/checkpoints.js */
editor.once('load', function () {
  'use strict';

  var request = function (args, callback) {
      var request = Ajax(args);

      request.on('load', function (status, data) {
          if (data) {
              callback(null, data);
          }
      });
      request.on('error', function (status, err) {
          if (callback) {
              callback(err);
          }
      });

      return request;
  };

  editor.method('checkpoints:create', function (branchId, description, callback) {
      return request({
          url: '{{url.api}}/checkpoints',
          auth: true,
          method: 'POST',
          data: {
              projectId: config.project.id,
              branchId: branchId,
              description: description
          }
      }, callback);
  });

  editor.method('checkpoints:restore', function (id, destinationBranchId, callback) {
      return request({
          url: '{{url.api}}/checkpoints/' + id + '/restore',
          auth: true,
          method: 'POST',
          data: {
              branchId: destinationBranchId
          }
      }, callback);
  });

  editor.method('checkpoints:list', function (args, callback) {
      var url = '{{url.api}}/branches/' + args.branch + '/checkpoints';
      var separator = '?';

      if (args.limit) {
          url += separator + 'limit=' + args.limit;
          separator = '&';
      }

      if (args.skip) {
          url += separator + 'skip=' + args.skip;
          separator = '&';
      }

      return request({
          url: url,
          auth: true
      }, callback);
  });

  editor.method('checkpoints:get', function (id, callback) {
      return request({
          url: '{{url.api}}/checkpoints/' + id,
          auth: true
      }, callback);
  });

  // Gets the specified file of an asset from a specific immutable backup
  editor.method('checkpoints:getAssetFile', function (assetId, branchId, assetImmutableBackupId, filename, callback) {
      return request({
          url: '{{url.api}}/assets/' + assetId + '/file/' + filename + '?immutableBackup=' + assetImmutableBackupId + '&branchId=' + branchId,
          auth: true,
          method: 'GET',
          notJson: true
      }, callback);
  });
});


/* editor/branches/branches.js */
editor.once('load', function () {

  // Make ajax request
  var request = function (args, callback) {
      Ajax(args)
      .on('error', function (status, err) {
          if (callback) callback(err);
      })
      .on('load', function (status, data) {
          if (callback) callback(null, data);
      });
  };

  // Load project branches
  // args.limit: the limit
  // args.skip: the number of entries to skip
  // args.closed: If true only return closed branches
  editor.method('branches:list', function (args, callback) {
      var url = '{{url.api}}/projects/{{project.id}}/branches';
      var separator = '?';
      if (args.limit) {
          url += separator + 'limit=' + args.limit;
          separator = '&';
      }

      if (args.skip) {
          url += separator + 'skip=' + args.skip;
          separator = '&';
      }

      if (args.closed) {
          url += separator + 'closed=true';
      }

      request({
          url: url,
          auth: true
      }, callback);
  });

  // Creates a branch
  editor.method('branches:create', function (data, callback) {
      request({
          url: '{{url.api}}/branches',
          method: 'POST',
          data: data,
          auth: true
      }, callback);
  });

  // Checks out a branch
  editor.method('branches:checkout', function (id, callback) {
      request({
          url: '{{url.api}}/branches/' + id + '/checkout',
          method: 'POST',
          auth: true
      }, callback);
  });

  // Close branch
  editor.method('branches:close', function (id, callback) {
      request({
          url: '{{url.api}}/branches/' + id + '/close',
          method: 'POST',
          auth: true
      }, callback);
  });

  // Open branch
  editor.method('branches:open', function (id, callback) {
      request({
          url: '{{url.api}}/branches/' + id + '/open',
          method: 'POST',
          auth: true
      }, callback);
  });

  // Start merging branches
  editor.method('branches:merge', function (sourceId, destinationId, callback) {
      request({
          url: '{{url.api}}/merge',
          method: 'POST',
          auth: true,
          data: {
              srcBranchId: sourceId,
              dstBranchId: destinationId
          }
      }, callback);
  });

  // Apply merge
  editor.method('branches:applyMerge', function (mergeId, finalize, callback) {
      request({
          url: '{{url.api}}/merge/' + mergeId + '/apply',
          method: 'POST',
          data: {
              finalize: finalize
          },
          auth: true
      }, callback);
  });

  // Get a merge object by merge id including all of its conflicts
  editor.method('branches:getMerge', function (mergeId, callback) {
      request({
          url: '{{url.api}}/merge/' + mergeId,
          method: 'GET',
          auth: true
      }, callback);
  });

  // Resolve multiple conflicts
  editor.method('branches:resolveConflicts', function (mergeId, conflictIds, resolveData, callback) {
      var data = {
          mergeId: mergeId,
          conflictIds: conflictIds
      };
      for (var key in resolveData) {
          data[key] = resolveData[key];
      }

      request({
          url: '{{url.api}}/conflicts/resolve',
          method: 'POST',
          data: data,
          auth: true
      }, callback);
  });

  // Force stops a merge which deletes the merge and all of its conflicts
  editor.method('branches:forceStopMerge', function (mergeId, callback) {
      request({
          url: '{{url.api}}/merge/' + mergeId,
          method: 'DELETE',
          auth: true
      }, callback);
  });

  // Gets the contents of a conflict file
  editor.method('conflicts:getUnresolvedFile', function (mergeId, conflictId, filename, callback) {
      request({
          url: '{{url.api}}/merge/' + mergeId + '/conflicts/' + conflictId + '/file/' + filename,
          method: 'GET',
          auth: true,
          notJson: true
      }, callback);
  });

  // Gets the contents of a resolved conflict file
  editor.method('conflicts:getResolvedFile', function (mergeId, conflictId, filename, callback) {
      request({
          url: '{{url.api}}/merge/' + mergeId + '/conflicts/' + conflictId + '/file/' + filename + '?resolved=true',
          method: 'GET',
          auth: true,
          notJson: true
      }, callback);
  });


  // Uploads the specified file to resolve a conflict
  editor.method('conflicts:uploadResolvedFile', function (conflictId, file, callback) {
      var formData = new FormData();
      formData.append('file', file);

      request({
          url: '{{url.api}}/conflicts/' + conflictId + '/file',
          method: 'PUT',
          data: formData,
          auth: true,
          ignoreContentType: true,
          headers: {
              Accept: 'application/json'
          }
      }, callback);
  });
});


/* editor/diff/diff.js */
editor.once('load', function () {

  // Make ajax request
  var request = function (args, callback) {
      Ajax(args)
      .on('error', function (status, err) {
          if (callback) callback(err);
      })
      .on('load', function (status, data) {
          if (callback) callback(null, data);
      });
  };

  /**
   * Generates a new diff between 2 checkpoint ids. If one checkpoint id is null
   * @param {Function} [callback] Optional callback after the diff is generated.
   * Has the following signature: (err, diff)
   */
  editor.method('diff:create', function (srcBranchId, srcCheckpointId, dstBranchId, dstCheckpointId, callback) {
      var data = {
          srcBranchId: srcBranchId,
          dstBranchId: dstBranchId
      };

      if (srcCheckpointId) {
          data.srcCheckpointId = srcCheckpointId;
      }
      if (dstCheckpointId) {
          data.dstCheckpointId = dstCheckpointId;
      }

      request({
          url: '{{url.api}}/diff',
          method: 'POST',
          data: data,
          auth: true
      }, callback);
  });

  /**
   * Generates a diff between a checkpoint and the current merge.
   * @param {Function} [callback] Optional callback after the diff is generated.
   */
  editor.method('diff:merge', function (callback) {
      request({
          url: '{{url.api}}/diff',
          method: 'POST',
          data: {
              srcBranchId: config.self.branch.merge.sourceBranchId,
              dstBranchId: config.self.branch.merge.destinationBranchId,
              dstCheckpointId: config.self.branch.merge.destinationCheckpointId,
              mergeId: config.self.branch.merge.id
          },
          auth: true
      }, callback);
  });

});