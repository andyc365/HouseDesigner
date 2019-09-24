

/* editor/components/components-logos.js */
editor.once('load', function() {
  // get the unicode for all of the component and new entity logos
  editor.method('components:logos', function () {
      return {
          'animation': '&#57875;',
          'audiolistener': '&#57750;',
          'audiosource': '&#57751;',
          'sound': '&#57751;',
          'camera': '&#57874;',
          'collision': '&#57735;',
          'directional': '&#57746;',
          'point': '&#57745;',
          'spot': '&#57747;',
          'light': '&#57748;',
          'model': '&#57736;',
          'particlesystem': '&#57753;',
          'rigidbody': '&#57737;',
          'script': '&#57910;',
          'screen': '&#58371;',
          'sprite': '&#58261;',
          'element': '&#58232;',
          'layoutgroup': '&#57667;',
          'layoutchild': '&#57667;',
          'scrollview': '&#58376;',
          'scrollbar': '&#58377;',
          'button': '&#58373;',
          'zone': '&#57910;',
          '2d-screen': '&#58371;',
          '3d-screen': '&#58372;',
          'text-element': '&#58374;',
          'image-element': '&#58005;',
          'group-element': '&#58375;',
          'userinterface': '&#58370;'
      };
  });
});


/* editor/components/scrollbar/components-scrollbar-defaults.js */
editor.once('load', function() {
  'use strict';

  var DEFAULT_THICKNESS = 20;
  var DEFAULT_LENGTH = 100;

  editor.method('components:scrollbar:getContainerElementDefaultsForOrientation', function (orientation) {
      switch (orientation) {
          case ORIENTATION_VERTICAL:
              return {
                  anchor: [1, 0, 1, 1],
                  pivot: [1, 1],
                  margin: [0, DEFAULT_THICKNESS, 0, 0],
                  width: DEFAULT_THICKNESS,
                  height: DEFAULT_LENGTH,
                  color: [.5, .5, .5]
              };

          case ORIENTATION_HORIZONTAL:
              return {
                  anchor: [0, 0, 1, 0],
                  pivot: [0, 0],
                  margin: [0, 0, DEFAULT_THICKNESS, 0],
                  width: DEFAULT_LENGTH,
                  height: DEFAULT_THICKNESS,
                  color: [.5, .5, .5]
              };
      }
  });

  editor.method('components:scrollbar:getHandleElementDefaultsForOrientation', function (orientation) {
      switch (orientation) {
          case ORIENTATION_VERTICAL:
              return {
                  anchor: [0, 1, 1, 1],
                  pivot: [1, 1],
                  margin: [0, 0, 0, 0],
                  width: DEFAULT_THICKNESS
              };

          case ORIENTATION_HORIZONTAL:
              return {
                  anchor: [0, 0, 0, 1],
                  pivot: [0, 0],
                  margin: [0, 0, 0, 0],
                  height: DEFAULT_THICKNESS
              };
      }
  });
});