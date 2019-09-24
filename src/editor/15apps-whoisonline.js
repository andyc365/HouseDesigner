

/* editor/apps/apps.js */
editor.once('load', function () {
  'use strict';

  // Fetch list of apps from the server and
  // pass them to the callback
  editor.method('apps:list', function (callback) {
      Ajax({
          url: '{{url.api}}/projects/{{project.id}}/apps?limit=0',
          auth: true
      })
      .on('load', function (status, data) {
          if (callback)
              callback(data.result);
      });
  });

  // Get a specific app from the server and pass result to callback
  editor.method('apps:get', function (appId, callback) {
      Ajax({
          url: '{{url.api}}/apps/' + appId,
          auth: true
      })
      .on('load', function (status, data) {
          if (callback)
              callback(data);
      });
  });

  // Create app and pass result to callback
  editor.method('apps:new', function (data, callback, error) {
      Ajax({
          url: '{{url.api}}/apps',
          auth: true,
          method: 'POST',
          data: data
      })
      .on('load', function (status, result) {
          if (callback)
              callback(result);
      })
      .on('error', function () {
          if (error)
              error.apply(this, arguments);
      });
  });

  // Download app
  editor.method('apps:download', function (data, callback, error) {
      Ajax({
          url: '{{url.api}}/apps/download',
          auth: true,
          method: 'POST',
          data: data
      })
      .on('load', function (status, result) {
          if (callback)
              callback(result);
      })
      .on('error', function () {
          if (error)
              error.apply(this, arguments);
      });
  });

  // Delete a app
  editor.method('apps:delete', function (appId, callback) {
      Ajax({
          url: '{{url.api}}/apps/' + appId,
          auth: true,
          method: 'DELETE'
      })
      .on('load', function (status, data) {
          if (callback)
              callback();
      });
  });

});


/* editor/whoisonline/whoisonline.js */
editor.once('load', function() {
  'use strict';

  var whoisonline = new ObserverList();

  // Set whoisonline
  editor.method('whoisonline:set', function (data) {
      whoisonline.clear();
      if (data) {
          data.forEach(function (id) {
              whoisonline.add(id);
          });
      }
  });

  // Get whoisonline
  editor.method('whoisonline:get', function () {
      return whoisonline;
  });

  // Add to whoiseonline
  editor.method('whoisonline:add', function (id) {
      whoisonline.add(id);
  });

  // Remove from whoisonline
  editor.method('whoisonline:remove', function (id) {
      whoisonline.remove(id);
  });

  // Returns true if specified user id is online
  editor.method('whoisonline:find', function (id) {
      return whoisonline.indexOf(id) >= 0;
  });

  // 'add' event
  whoisonline.on('add', function (id) {
      editor.emit('whoisonline:add', id);
  });

  // 'remove' event
  whoisonline.on('remove', function (id, index) {
      editor.emit('whoisonline:remove', id, index);
  });

  // remove all users when disconnected
  editor.on('realtime:disconnected', function () {
      whoisonline.clear();
  });

});


/* editor/whoisonline/whoisonline-colors.js */
editor.once('load', function() {
  'use strict';

  var users = { };
  var pallete = [
      [ 5, 0.63, 0.46 ],
      [ 6, 0.78, 0.57 ],
      [ 24, 1.00, 0.41 ],
      [ 28, 0.80, 0.52 ],
      [ 37, 0.90, 0.51 ],
      [ 48, 0.89, 0.50 ],
      [ 145, 0.76, 0.49 ],
      [ 146, 0.63, 0.42 ],
      [ 168, 0.76, 0.42 ],
      [ 169, 0.76, 0.36 ],
      [ 204, 0.70, 0.53 ],
      [ 205, 0.64, 0.44 ],
      [ 282, 0.39, 0.53 ],
      [ 283, 0.44, 0.47 ]
  ];

  var hue2rgb = function hue2rgb(p, q, t){
      if(t < 0) t += 1;
      if(t > 1) t -= 1;
      if(t < 1/6) return p + (q - p) * 6 * t;
      if(t < 1/2) return q;
      if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
  };

  var hslToRgb = function(h, s, l) {
      var r, g, b;

      if(s == 0) {
          r = g = b = l;
      }else{
          var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          var p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
      }

      return [ r, g, b ];
  };

  editor.method('color:hsl2rgb', hslToRgb);

  var rgbToHex = function(r, g, b) {
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };


  var hsl = pallete[0];
  var rgb = hslToRgb(hsl[0] / 360, hsl[1], hsl[2]);

  var colorDefault = {
      data: rgb.slice(0),
      rgb: 'rgb(' + Math.round(rgb[0] * 255) + ', ' + Math.round(rgb[1] * 255) + ', ' + Math.round(rgb[2] * 255) + ')',
      hsl: 'hsl(' + hsl[0] + ', ' + Math.round(hsl[1] * 100) + '%, ' + Math.round(hsl[2] * 100) + '%)',
      hex: rgbToHex(Math.round(rgb[0] * 255), Math.round(rgb[1] * 255), Math.round(rgb[2] * 255))
  };


  editor.on('whoisonline:add', function(id) {
      var hash = id % 14;
      if (Math.floor(hash / 2) !== hash / 2)
          hash = (hash + Math.floor(pallete.length / 2)) % 14;

      var hsl = pallete[hash];
      var rgb = hslToRgb(hsl[0] / 360, hsl[1], hsl[2]);

      users[id] = {
          id: id,
          color: {
              data: rgb.slice(0),
              rgb: 'rgb(' + Math.round(rgb[0] * 255) + ', ' + Math.round(rgb[1] * 255) + ', ' + Math.round(rgb[2] * 255) + ')',
              hsl: 'hsl(' + hsl[0] + ', ' + Math.round(hsl[1] * 100) + '%, ' + Math.round(hsl[2] * 100) + '%)',
              hex: rgbToHex(Math.round(rgb[0] * 255), Math.round(rgb[1] * 255), Math.round(rgb[2] * 255))
          }
      };
  });

  editor.on('whoisonline:remove', function(id) {
      delete users[id];
  });

  editor.method('whoisonline:color', function(id, type) {
      type = type || 'data';
      var color = users[id] && users[id].color || colorDefault;
      return color[type];
  });
});