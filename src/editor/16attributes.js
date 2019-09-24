


/* editor/attributes/attributes-panel.js */
editor.once('load', function() {
  'use strict';

  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');
  var title = 'INSPECTOR';
  var root = editor.call('layout.attributes');
  root.headerText = title;

  var clearPanel = function() {
      editor.emit('attributes:beforeClear');
      root.clear();
      editor.emit('attributes:clear');
  };

  // clearing
  editor.method('attributes:clear', clearPanel);

  // set header
  editor.method('attributes:header', function(text) {
      root.headerText = text;
  });

  // return root panel
  editor.method('attributes.rootPanel', function() {
      return root;
  });

  // add panel
  editor.method('attributes:addPanel', function(args) {
      args = args || { };

      // panel
      var panel = new ui.Panel(args.name || '');
      // parent
      (args.parent || root).append(panel);

      // folding
      panel.foldable = args.foldable || args.folded;
      panel.folded = args.folded;

      return panel;
  });

  var historyState = function(item, state) {
      if (item.history !== undefined) {
          if (typeof(item.history) === 'boolean') {
              item.history = state;
          } else {
              item.history.enabled = state;
          }
      } else {
          if (item._parent && item._parent.history !== undefined) {
              item._parent.history.enabled = state;
          }
      }
  };

  // get the right path from args
  var pathAt = function (args, index) {
      return args.paths ? args.paths[index] : args.path;
  };

  editor.method('attributes:linkField', function(args) {
      var update, changeField, changeFieldQueue;
      args.field._changing = false;
      var events = [ ];

      if (! (args.link instanceof Array))
          args.link = [ args.link ];

      update = function() {
          var different = false;
          var path = pathAt(args, 0);
          var value = args.link[0].has(path) ? args.link[0].get(path) : undefined;
          if (args.type === 'rgb') {
              if (value) {
                  for(var i = 1; i < args.link.length; i++) {
                      path = pathAt(args, i);
                      if (! value.equals(args.link[i].get(path))) {
                          value = null;
                          different = true;
                          break;
                      }
                  }
              }
              if (value) {
                  value = value.map(function(v) {
                      return Math.floor(v * 255);
                  });
              }
          } else if (args.type === 'asset') {
              var countUndefined = value === undefined ? 1 : 0;
              for(var i = 1; i < args.link.length; i++) {
                  path = pathAt(args, i);
                  if (!args.link[i].has(path)) {
                      countUndefined++;
                      continue;
                  }

                  var val = args.link[i].get(path);

                  if ((value || 0) !== (args.link[i].get(path) || 0)) {
                      if (value !== undefined) {
                          value = args.enum ? '' : null;
                          different = true;
                          break;
                      }
                  }

                  value = val;
              }

              if (countUndefined && countUndefined != args.link.length) {
                  args.field.class.add('star');
                  if (! /^\* /.test(args.field._title.text))
                      args.field._title.text = '* ' + args.field._title.text;
              } else {
                  args.field.class.remove('star');
                  if (/^\* /.test(args.field._title.text))
                      args.field._title.text = args.field._title.text.substring(2);
              }

              if (different) {
                  args.field.class.add('null');
                  args.field._title.text = 'various';
              } else {
                  args.field.class.remove('null');
              }
          } else if (args.type === 'entity' || ! args.type) {
              for(var i = 1; i < args.link.length; i++) {
                  path = pathAt(args, i);
                  if (value !== args.link[i].get(path)) {
                      value = 'various';
                      different = true;
                      break;
                  }
              }
              if (different) {
                  args.field.class.add('null');
                  args.field.text = 'various';
              } else {
                  args.field.class.remove('null');
              }
          } else {
              var valueFound = false;
              for(var i = 0; i < args.link.length; i++) {
                  path = pathAt(args, i);
                  if (! args.link[i].has(path))
                      continue;

                  if (! valueFound) {
                      valueFound = true;
                      value = args.link[i].get(path);
                  } else {
                      var v = args.link[i].get(path);
                      if ((value || 0) !== (v || 0)) {
                          value = args.enum ? '' : null;
                          different = true;
                          break;
                      }
                  }
              }
          }

          args.field._changing = true;
          args.field.value = value;

          if (args.type === 'checkbox')
              args.field._onLinkChange(value);

          args.field._changing = false;

          if (args.enum) {
              var opt = args.field.optionElements[''];
              if (opt) opt.style.display = value !== '' ? 'none' : '';
          } else {
              args.field.proxy = value == null ? '...' : null;
          }
      };

      changeField = function(value) {
          if (args.field._changing)
              return;

          if (args.enum) {
              var opt = this.optionElements[''];
              if (opt) opt.style.display = value !== '' ? 'none' : '';
          } else {
              this.proxy = value === null ? '...' : null;
          }

          if (args.trim)
              value = value.trim();

          if (args.type === 'rgb') {
              value = value.map(function(v) {
                  return v / 255;
              });
          } else if (args.type === 'asset') {
              args.field.class.remove('null');
          }

          var items = [ ];

          // set link value
          args.field._changing = true;
          if (args.type === "string" && args.trim)
              args.field.value = value;

          for(var i = 0; i < args.link.length; i++) {
              var path = pathAt(args, i);
              if (! args.link[i].has(path)) continue;

              items.push({
                  get: args.link[i].history !== undefined ? args.link[i].history._getItemFn : null,
                  item: args.link[i],
                  value: args.link[i].has(path) ? args.link[i].get(path) : undefined
              });

              historyState(args.link[i], false);
              args.link[i].set(path, value);
              historyState(args.link[i], true);
          }
          args.field._changing = false;

          // history
          if (args.type !== 'rgb' && ! args.slider && ! args.stopHistory) {
              editor.call('history:add', {
                  name: pathAt(args, 0),
                  undo: function() {
                      var different = false;
                      for(var i = 0; i < items.length; i++) {
                          var path = pathAt(args, i);
                          var item;
                          if (items[i].get) {
                              item = items[i].get();
                              if (! item)
                                  continue;
                          } else {
                              item = items[i].item;
                          }

                          if (! different && items[0].value !== items[i].value)
                              different = true;

                          historyState(item, false);
                          if (items[i].value === undefined)
                              item.unset(path);
                          else
                              item.set(path, items[i].value);
                          historyState(item, true);
                      }

                      if (different) {
                          args.field.class.add('null');
                      } else {
                          args.field.class.remove('null');
                      }
                  },
                  redo: function() {
                      for(var i = 0; i < items.length; i++) {
                          var path = pathAt(args, i);
                          var item;
                          if (items[i].get) {
                              item = items[i].get();
                              if (! item)
                                  continue;
                          } else {
                              item = items[i].item;
                          }

                          historyState(item, false);
                          if (value === undefined)
                              item.unset(path);
                          else
                              item.set(path, value);
                          item.set(path, value);
                          historyState(item, true);
                      }

                      args.field.class.remove('null');
                  }
              });
          }
      };

      changeFieldQueue = function() {
          if (args.field._changing)
              return;

          args.field._changing = true;
          setTimeout(function() {
              args.field._changing = false;
              update();
          }, 0);
      };

      var historyStart, historyEnd;

      if (args.type === 'rgb' || args.slider) {
          historyStart = function() {
              var items = [ ];

              for(var i = 0; i < args.link.length; i++) {
                  var v = args.link[i].get(pathAt(args, i));
                  if (v instanceof Array)
                      v = v.slice(0);

                  items.push({
                      get: args.link[i].history !== undefined ? args.link[i].history._getItemFn : null,
                      item: args.link[i],
                      value: v
                  });
              }

              return items;
          };

          historyEnd = function(items, value) {
              // history
              editor.call('history:add', {
                  name: pathAt(args, 0),
                  undo: function() {
                      for(var i = 0; i < items.length; i++) {
                          var item;
                          if (items[i].get) {
                              item = items[i].get();
                              if (! item)
                                  continue;
                          } else {
                              item = items[i].item;
                          }

                          historyState(item, false);
                          item.set(pathAt(args, i), items[i].value);
                          historyState(item, true);
                      }
                  },
                  redo: function() {
                      for(var i = 0; i < items.length; i++) {
                          var item;
                          if (items[i].get) {
                              item = items[i].get();
                              if (! item)
                                  continue;
                          } else {
                              item = items[i].item;
                          }

                          historyState(item, false);
                          item.set(pathAt(args, i), value);
                          historyState(item, true);
                      }
                  }
              });
          };
      }

      if (args.type === 'rgb') {
          var colorPickerOn = false;
          events.push(args.field.on('click', function() {
              colorPickerOn = true;

              // set picker color
              editor.call('picker:color', args.field.value);

              var items = [ ];

              // picking starts
              var evtColorPickStart = editor.on('picker:color:start', function() {
                  items = historyStart();
              });

              // picked color
              var evtColorPick = editor.on('picker:color', function(color) {
                  args.field.value = color;
              });

              var evtColorPickEnd = editor.on('picker:color:end', function() {
                  historyEnd(items.slice(0), args.field.value.map(function(v) {
                      return v / 255;
                  }));
              });

              // position picker
              var rectPicker = editor.call('picker:color:rect');
              var rectField = args.field.element.getBoundingClientRect();
              editor.call('picker:color:position', rectField.left - rectPicker.width, rectField.top);

              // color changed, update picker
              var evtColorToPicker = args.field.on('change', function() {
                  editor.call('picker:color:set', this.value);
              });

              // picker closed
              editor.once('picker:color:close', function() {
                  evtColorPick.unbind();
                  evtColorPickStart.unbind();
                  evtColorPickEnd.unbind();
                  evtColorToPicker.unbind();
                  colorPickerOn = false;
                  args.field.element.focus();
              });
          }));

          // close picker if field destroyed
          args.field.once('destroy', function() {
              if (colorPickerOn)
                  editor.call('picker:color:close');
          });
      } else if (args.slider) {
          var sliderRecords;

          events.push(args.field.on('start', function() {
              sliderRecords = historyStart();
          }));

          events.push(args.field.on('end', function() {
              historyEnd(sliderRecords.slice(0), args.field.value);
          }));
      }

      update();
      events.push(args.field.on('change', changeField));

      for(var i = 0; i < args.link.length; i++) {
          events.push(args.link[i].on(pathAt(args, i) + ':set', changeFieldQueue));
          events.push(args.link[i].on(pathAt(args, i) + ':unset', changeFieldQueue));
      }

      events.push(args.field.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();
      }));

      return events;
  });

  // add field
  editor.method('attributes:addField', function(args) {
      var panel = args.panel;

      if (! panel) {
          panel = new ui.Panel();
          panel.flexWrap = 'nowrap';
          panel.WebkitFlexWrap = 'nowrap';
          panel.style.display = '';

          if (args.type) {
              panel.class.add('field-' + args.type);
          } else {
              panel.class.add('field');
          }

          (args.parent || root).append(panel);
      }

      if (args.name) {
          var label = new ui.Label({
              text: args.name
          });
          label.class.add('label-field');
          panel._label = label;
          panel.append(label);

          if (args.reference) {
              var tooltip = label._tooltip = editor.call('attributes:reference', {
                  element: label.element,
                  title: args.reference.title,
                  subTitle: args.reference.subTitle,
                  description: args.reference.description
              });

              tooltip.attach({
                  target: label,
                  element: label.element
              });
          }
      }

      var field;

      args.linkEvents = [ ];

      // if we provide multiple paths for a single Observer then turn args.link into an array
      if (args.paths && args.paths instanceof Array && args.link && ! (args.link instanceof Array)) {
          var link = args.link;
          args.link = [];
          for (var i = 0; i < args.paths.length; i++) {
              args.link.push(link);
          }
      }

      var linkField = args.linkField = function() {
          if (args.link) {
              var link = function(field, path) {
                  var data = {
                      field: field,
                      type: args.type,
                      slider: args.slider,
                      enum: args.enum,
                      link: args.link,
                      trim: args.trim,
                      name: args.name,
                      stopHistory: args.stopHistory
                  };

                  if (! path) {
                      path = args.paths || args.path;
                  }

                  if (path instanceof Array) {
                      data.paths = path;
                  } else {
                      data.path = path;
                  }

                  args.linkEvents = args.linkEvents.concat(editor.call('attributes:linkField', data));

                  // Give the field a uniquely addressable css class that we can target from Selenium
                  if (field.element && typeof path === 'string') {
                      field.element.classList.add('field-path-' + path.replace(/\./g, '-'));
                  }
              };

              if (field instanceof Array) {
                  for(var i = 0; i < field.length; i++) {
                      var paths = args.paths;

                      if (paths) {
                          paths = paths.map(function (p) {
                              return p + '.' + i;
                          });
                      }

                      link(field[i], paths || (args.path + '.' + i));
                  }
              } else {
                  link(field);
              }
          }
      };

      var unlinkField = args.unlinkField = function() {
          for(var i = 0; i < args.linkEvents.length; i++)
              args.linkEvents[i].unbind();

          args.linkEvents = [ ];
      };

      switch(args.type) {
          case 'string':
              if (args.enum) {
                  field = new ui.SelectField({
                      options: args.enum
                  });
              } else {
                  field = new ui.TextField();
              }

              field.value = args.value || '';
              field.flexGrow = 1;

              if (args.placeholder)
                  field.placeholder = args.placeholder;

              linkField();

              panel.append(field);
              break;

          case 'tags':
              // TODO: why isn't this in a seperate class/file???

              var innerPanel = new ui.Panel();
              var tagType = args.tagType || 'string';

              if (args.enum) {
                  field = new ui.SelectField({
                      options: args.enum,
                      type: tagType
                  });
                  field.renderChanges = false;
                  field.on('change', function (value) {
                      if (tagType === 'string') {
                          if (! value) return;

                          value = value.trim();
                      }

                      addTag(value);
                      field.value = '';
                  });

                  innerPanel.append(field);

              } else {
                  field = new ui.TextField();
                  field.blurOnEnter = false;
                  field.renderChanges = false;

                  field.element.addEventListener('keydown', function(evt) {
                      if (evt.keyCode !== 13 || ! field.value)
                          return;

                      addTag(field.value.trim());
                      field.value = '';
                  });

                  innerPanel.append(field);

                  var btnAdd = new ui.Button({
                      text: '&#57632'
                  });
                  btnAdd.flexGrow = 0;
                  btnAdd.on('click', function() {
                      if (! field.value)
                          return;

                      addTag(field.value.trim());
                      field.value = '';
                  });
                  innerPanel.append(btnAdd);
              }


              var tagsPanel = new ui.Panel();
              tagsPanel.class.add('tags');
              tagsPanel.flex = true;
              innerPanel.append(tagsPanel);

              var tagItems = { };
              var tagIndex = { };
              var tagList = [ ];

              var onRemoveClick = function() {
                  if (innerPanel.disabled)
                      return;

                  removeTag(this.tag);
              };

              var removeTag = function(tag) {
                  if (tagType === 'string' && ! tag) {
                      return;
                  } else if (tag === null || tag === undefined) {
                      return;
                  }

                  if (! tagIndex.hasOwnProperty(tag))
                      return;

                  var records = [ ];

                  for(var i = 0; i < args.link.length; i++) {
                      var path = pathAt(args, i);
                      if (args.link[i].get(path).indexOf(tag) === -1)
                          continue;

                      records.push({
                          get: args.link[i].history !== undefined ? args.link[i].history._getItemFn : null,
                          item: args.link[i],
                          path: path,
                          value: tag
                      });

                      historyState(args.link[i], false);
                      args.link[i].removeValue(path, tag);
                      historyState(args.link[i], true);
                  }

                  if (!args.stopHistory) {
                      editor.call('history:add', {
                          name: pathAt(args, 0),
                          undo: function() {
                              for(var i = 0; i < records.length; i++) {
                                  var item;
                                  if (records[i].get) {
                                      item = records[i].get();
                                      if (! item)
                                          continue;
                                  } else {
                                      item = records[i].item;
                                  }

                                  historyState(item, false);
                                  item.insert(records[i].path, records[i].value);
                                  historyState(item, true);
                              }
                          },
                          redo: function() {
                              for(var i = 0; i < records.length; i++) {
                                  var item;
                                  if (records[i].get) {
                                      item = records[i].get();
                                      if (! item)
                                          continue;
                                  } else {
                                      item = records[i].item;
                                  }

                                  historyState(item, false);
                                  item.removeValue(records[i].path, records[i].value);
                                  historyState(item, true);
                              }
                          }
                      });
                  }
              };

              var addTag = function(tag) {
                  var records = [ ];

                  // convert to number if needed
                  if (args.tagType === 'number') {
                      tag = parseInt(tag, 10);
                      if (isNaN(tag))
                          return;
                  }

                  for(var i = 0; i < args.link.length; i++) {
                      var path = pathAt(args, i);
                      if (args.link[i].get(path).indexOf(tag) !== -1)
                          continue;

                      records.push({
                          get: args.link[i].history !== undefined ? args.link[i].history._getItemFn : null,
                          item: args.link[i],
                          path: path,
                          value: tag
                      });

                      historyState(args.link[i], false);
                      args.link[i].insert(path, tag);
                      historyState(args.link[i], true);
                  }

                  if (!args.stopHistory) {
                      editor.call('history:add', {
                          name: pathAt(args, 0),
                          undo: function() {
                              for(var i = 0; i < records.length; i++) {
                                  var item;
                                  if (records[i].get) {
                                      item = records[i].get();
                                      if (! item)
                                          continue;
                                  } else {
                                      item = records[i].item;
                                  }

                                  historyState(item, false);
                                  item.removeValue(records[i].path, records[i].value);
                                  historyState(item, true);
                              }
                          },
                          redo: function() {
                              for(var i = 0; i < records.length; i++) {
                                  var item;
                                  if (records[i].get) {
                                      item = records[i].get();
                                      if (! item)
                                          continue;
                                  } else {
                                      item = records[i].item;
                                  }

                                  historyState(item, false);
                                  item.insert(records[i].path, records[i].value);
                                  historyState(item, true);
                              }
                          }
                      });
                  }
              };

              var onInsert = function(tag) {
                  if (! tagIndex.hasOwnProperty(tag)) {
                      tagIndex[tag] = 0;
                      tagList.push(tag);
                  }

                  tagIndex[tag]++;
                  insertElement(tag);
              };

              var onRemove = function(tag) {
                  if (! tagIndex[tag])
                      return;

                  tagIndex[tag]--;

                  if (! tagIndex[tag]) {
                      tagsPanel.innerElement.removeChild(tagItems[tag]);
                      var ind = tagList.indexOf(tag);
                      if (ind !== -1)
                          tagList.splice(ind, 1);

                      delete tagItems[tag];
                      delete tagIndex[tag];
                  } else {
                      if (tagIndex[tag] === args.link.length) {
                          tagItems[tag].classList.remove('partial');
                      } else {
                          tagItems[tag].classList.add('partial');
                      }
                  }
              };

              // when tag field is initialized
              var onSet = function (values) {
                  for (var i = 0; i < values.length; i++) {
                      var value = values[i];
                      onInsert(value);
                  }
              };

              var insertElement = function(tag) {
                  if (! tagItems[tag]) {
                      sortTags();

                      var item = document.createElement('div');
                      tagItems[tag] = item;
                      item.classList.add('tag');
                      var itemText = document.createElement('span');
                      itemText.textContent = args.tagToString ? args.tagToString(tag) : tag;
                      item.appendChild(itemText);

                      // the original tag value before tagToString is called. Useful
                      // if the tag value is an id for example
                      item.originalValue = tag;

                      // attach click handler on text part of the tag - bind the listener
                      // to the tag item so that `this` refers to that tag in the listener
                      if (args.onClickTag) {
                          itemText.addEventListener('click', args.onClickTag.bind(item));
                      }

                      var icon = document.createElement('span');
                      icon.innerHTML = '&#57650;';
                      icon.classList.add('icon');
                      icon.tag = tag;
                      icon.addEventListener('click', onRemoveClick, false);
                      item.appendChild(icon);

                      var ind = tagList.indexOf(tag);
                      if (tagItems[tagList[ind + 1]]) {
                          tagsPanel.appendBefore(item, tagItems[tagList[ind + 1]]);
                      } else {
                          tagsPanel.append(item);
                      }
                  }

                  if (tagIndex[tag] === args.link.length) {
                      tagItems[tag].classList.remove('partial');
                  } else {
                      tagItems[tag].classList.add('partial');
                  }
              };

              var sortTags = function() {
                  tagList.sort(function(a, b) {
                      if (args.tagToString) {
                          a = args.tagToString(a);
                          b = args.tagToString(b);
                      }

                      if (a > b) {
                          return 1;
                      } else if (a < b) {
                          return -1;
                      } else {
                          return 0;
                      }
                  });
              };

              if (args.placeholder)
                  field.placeholder = args.placeholder;

              // list
              args.linkEvents = [ ];

              args.linkField = function() {
                  if (args.link) {
                      if (! (args.link instanceof Array))
                          args.link = [ args.link ];

                      for(var i = 0; i < args.link.length; i++) {
                          var path = pathAt(args, i);
                          var tags = args.link[i].get(path);

                          args.linkEvents.push(args.link[i].on(path + ':set', onSet));
                          args.linkEvents.push(args.link[i].on(path + ':insert', onInsert));
                          args.linkEvents.push(args.link[i].on(path + ':remove', onRemove));

                          if (! tags)
                              continue;

                          for(var t = 0; t < tags.length; t++) {
                              if (tagType === 'string' && ! tags[t]) {
                                  continue;
                              } else if (tags[t] === null || tags[t] === undefined) {
                                  continue;
                              }

                              if (! tagIndex.hasOwnProperty(tags[t])) {
                                  tagIndex[tags[t]] = 0;
                                  tagList.push(tags[t]);
                              }

                              tagIndex[tags[t]]++;
                          }
                      }
                  }

                  sortTags();

                  for(var i = 0; i < tagList.length; i++)
                      insertElement(tagList[i]);
              };

              args.unlinkField = function() {
                  for(var i = 0; i < args.linkEvents.length; i++)
                      args.linkEvents[i].unbind();

                  args.linkEvents = [ ];

                  for(var key in tagItems)
                      tagsPanel.innerElement.removeChild(tagItems[key]);

                  tagList = [ ];
                  tagIndex = { };
                  tagItems = { };
              };

              args.linkField();

              panel.once('destroy', args.unlinkField);

              panel.append(innerPanel);
              break;

          case 'text':
              field = new ui.TextAreaField();

              field.value = args.value || '';
              field.flexGrow = 1;

              if (args.placeholder)
                  field.placeholder = args.placeholder;

              linkField();

              panel.append(field);
              break;

          case 'number':
              if (args.enum) {
                  field = new ui.SelectField({
                      options: args.enum,
                      type: 'number'
                  });
              } else if (args.slider) {
                  field = new ui.Slider();
              } else {
                  field = new ui.NumberField();
              }

              field.value = args.value || 0;
              field.flexGrow = 1;

              if (args.allowNull) {
                  field.allowNull = true;
              }

              if (args.placeholder)
                  field.placeholder = args.placeholder;

              if (args.precision != null)
                  field.precision = args.precision;

              if (args.step != null)
                  field.step = args.step;

              if (args.min != null)
                  field.min = args.min;

              if (args.max != null)
                  field.max = args.max;

              linkField();

              panel.append(field);
              break;

          case 'checkbox':
              if (args.enum) {
                  field = new ui.SelectField({
                      options: args.enum,
                      type: 'boolean'
                  });
                  field.flexGrow = 1;
              } else {
                  field = new ui.Checkbox();
              }

              field.value = args.value || 0;
              field.class.add('tick');

              linkField();

              panel.append(field);
              break;

          case 'vec2':
          case 'vec3':
          case 'vec4':
              var channels = parseInt(args.type[3], 10);
              field = [ ];

              for(var i = 0; i < channels; i++) {
                  field[i] = new ui.NumberField();
                  field[i].flexGrow = 1;
                  field[i].style.width = '24px';
                  field[i].value = (args.value && args.value[i]) || 0;
                  panel.append(field[i]);

                  if (args.placeholder)
                      field[i].placeholder = args.placeholder[i];

                  if (args.precision != null)
                      field[i].precision = args.precision;

                  if (args.step != null)
                      field[i].step = args.step;

                  if (args.min != null)
                      field[i].min = args.min;

                  if (args.max != null)
                      field[i].max = args.max;

                  // if (args.link)
                  //     field[i].link(args.link, args.path + '.' + i);
              }

              linkField();
              break;

          case 'rgb':
              field = new ui.ColorField();

              if (args.channels != null)
                  field.channels = args.channels;

              linkField();

              var colorPickerOn = false;
              field.on('click', function() {
                  colorPickerOn = true;
                  var first = true;

                  // set picker color
                  editor.call('picker:color', field.value);

                  // picking starts
                  var evtColorPickStart = editor.on('picker:color:start', function() {
                      first = true;
                  });

                  // picked color
                  var evtColorPick = editor.on('picker:color', function(color) {
                      first = false;
                      field.value = color;
                  });

                  // position picker
                  var rectPicker = editor.call('picker:color:rect');
                  var rectField = field.element.getBoundingClientRect();
                  editor.call('picker:color:position', rectField.left - rectPicker.width, rectField.top);

                  // color changed, update picker
                  var evtColorToPicker = field.on('change', function() {
                      editor.call('picker:color:set', this.value);
                  });

                  // picker closed
                  editor.once('picker:color:close', function() {
                      evtColorPick.unbind();
                      evtColorPickStart.unbind();
                      evtColorToPicker.unbind();
                      colorPickerOn = false;
                      field.element.focus();
                  });
              });

              // close picker if field destroyed
              field.on('destroy', function() {
                  if (colorPickerOn)
                      editor.call('picker:color:close');
              });

              panel.append(field);
              break;

          case 'asset':
              field = new ui.ImageField({
                  canvas: args.kind === 'material' || args.kind === 'model' || args.kind === 'cubemap' || args.kind === 'font' || args.kind === 'sprite'
              });
              var evtPick;

              if (label) {
                  label.renderChanges = false;
                  field._label = label;

                  label.style.width = '32px';
                  label.flexGrow = 1;
              }


              var panelFields = document.createElement('div');
              panelFields.classList.add('top');

              var panelControls = document.createElement('div');
              panelControls.classList.add('controls');

              var fieldTitle = field._title = new ui.Label();
              fieldTitle.text = 'Empty';
              fieldTitle.parent = panel;
              fieldTitle.flexGrow = 1;
              fieldTitle.placeholder = '...';

              var btnEdit = new ui.Button({
                  text: '&#57648;'
              });
              btnEdit.disabled = true;
              btnEdit.parent = panel;
              btnEdit.flexGrow = 0;

              var btnRemove = new ui.Button({
                  text: '&#57650;'
              });
              btnRemove.disabled = true;
              btnRemove.parent = panel;
              btnRemove.flexGrow = 0;

              fieldTitle.on('click', function() {
                  var asset = editor.call('assets:get', field.value);
                  editor.call('picker:asset', {
                      type: args.kind,
                      currentAsset: asset
                  });

                  evtPick = editor.once('picker:asset', function(asset) {
                      var oldValues = { };
                      if (args.onSet && args.link && args.link instanceof Array) {
                          for(var i = 0; i < args.link.length; i++) {
                              var id = 0;
                              if (args.link[i]._type === 'asset') {
                                  id = args.link[i].get('id');
                              } else if (args.link[i]._type === 'entity') {
                                  id = args.link[i].get('resource_id');
                              } else {
                                  continue;
                              }

                              oldValues[id] = args.link[i].get(pathAt(args, i));
                          }
                      }

                      field.emit('beforechange', asset.get('id'));
                      field.value = asset.get('id');
                      evtPick = null;
                      if (args.onSet) args.onSet(asset, oldValues);
                  });

                  editor.once('picker:asset:close', function() {
                      if (evtPick) {
                          evtPick.unbind();
                          evtPick = null;
                      }
                      field.element.focus();
                  });
              });

              field.on('click', function() {
                  if (! this.value)
                      return;

                  var asset = editor.call('assets:get', this.value);
                  if (! asset) return;
                  editor.call('selector:set', 'asset', [ asset ]);

                  if (legacyScripts && asset.get('type') === 'script') {
                      editor.call('assets:panel:currentFolder', 'scripts');
                  } else {
                      var path = asset.get('path');
                      if (path.length) {
                          editor.call('assets:panel:currentFolder', editor.call('assets:get', path[path.length - 1]));
                      } else {
                          editor.call('assets:panel:currentFolder', null);
                      }
                  }
              });
              btnEdit.on('click', function() {
                  field.emit('click');
              });

              btnRemove.on('click', function() {
                  field.emit('beforechange', null);
                  field.value = null;
              });

              var watch = null;
              var watchAsset = null;
              var renderQueued;
              var queueRender;

              var evtThumbnailChange;
              var updateThumbnail = function(empty) {
                  var asset = editor.call('assets:get', field.value);

                  if (watch) {
                      editor.call('assets:' + watchAsset.get('type') + ':unwatch', watchAsset, watch);
                      watchAsset = watch = null;
                  }

                  if (empty) {
                      field.image = '';
                  } else if (! asset) {
                      field.image = config.url.home + '/editor/scene/img/asset-placeholder-texture.png';
                  } else {
                      if (asset.has('thumbnails.m')) {
                          var src = asset.get('thumbnails.m');
                          if (src.startsWith('data:image/png;base64')) {
                              field.image = asset.get('thumbnails.m');
                          } else {
                              field.image = config.url.home + asset.get('thumbnails.m').appendQuery('t=' + asset.get('file.hash'));
                          }
                      } else {
                          field.image = '/editor/scene/img/asset-placeholder-' + asset.get('type') + '.png';
                      }

                      if (args.kind === 'material' || args.kind === 'model' || args.kind === 'cubemap' || args.kind == 'font' || args.kind === 'sprite') {
                          watchAsset = asset;
                          watch = editor.call('assets:' + args.kind + ':watch', {
                              asset: watchAsset,
                              autoLoad: true,
                              callback: queueRender
                          });
                      }
                  }

                  if (queueRender)
                      queueRender();
              };

              if (args.kind === 'material' || args.kind === 'model' || args.kind === 'font' || args.kind === 'sprite') {
                  if (args.kind !== 'sprite') {
                      field.elementImage.classList.add('flipY');
                  }

                  var renderPreview = function() {
                      renderQueued = false;

                      if (watchAsset) {
                          // render
                          editor.call('preview:render', watchAsset, 128, 128, field.elementImage);
                      } else {
                          var ctx = field.elementImage.ctx;
                          if (! ctx)
                              ctx = field.elementImage.ctx = field.elementImage.getContext('2d');

                          ctx.clearRect(0, 0, field.elementImage.width, field.elementImage.height);
                      }
                  };

                  renderPreview();

                  queueRender = function() {
                      if (renderQueued) return;
                      renderQueued = true;
                      requestAnimationFrame(renderPreview);
                  };

                  var evtSceneSettings = editor.on('preview:scene:changed', queueRender);

                  field.once('destroy', function() {
                      evtSceneSettings.unbind();
                      evtSceneSettings = null;

                      if (watch) {
                          editor.call('assets:' + watchAsset.get('type') + ':unwatch', watchAsset, watch);
                          watchAsset = watch = null;
                      }
                  });
              } else if (args.kind === 'cubemap') {
                  field.elementImage.width = 60;
                  field.elementImage.height = 60;

                  var positions = [ [ 30, 22 ], [ 0, 22 ], [ 15, 7 ], [ 15, 37 ], [ 15, 22 ], [ 45, 22 ] ];
                  var images = [ null, null, null, null, null, null ];

                  var renderPreview = function() {
                      renderQueued = false;

                      var ctx = field.elementImage.ctx;
                      if (! ctx)
                          ctx = field.elementImage.ctx = field.elementImage.getContext('2d');

                      ctx.clearRect(0, 0, field.elementImage.width, field.elementImage.height);

                      if (watchAsset) {
                          for(var i = 0; i < 6; i++) {
                              var id = watchAsset.get('data.textures.' + i);
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
                                  ctx.drawImage(image, positions[i][0], positions[i][1], 15, 15);
                              } else {
                                  ctx.beginPath();
                                  ctx.rect(positions[i][0], positions[i][1], 15, 15);
                                  ctx.fillStyle = '#000';
                                  ctx.fill();
                              }
                          }
                      }
                  };

                  renderPreview();

                  queueRender = function() {
                      if (renderQueued) return;
                      renderQueued = true;
                      requestAnimationFrame(renderPreview);
                  };

                  field.once('destroy', function() {
                      if (watch) {
                          editor.call('assets:cubemap:unwatch', watchAsset, watch);
                          watchAsset = watch = null;
                      }
                  });
              }

              linkField();

              var updateField = function() {
                  var value = field.value;

                  fieldTitle.text = field.class.contains('null') ? 'various' : 'Empty';

                  btnEdit.disabled = ! value;
                  btnRemove.disabled = ! value && ! field.class.contains('null');

                  if (evtThumbnailChange) {
                      evtThumbnailChange.unbind();
                      evtThumbnailChange = null;
                  }

                  if (! value) {
                      if (field.class.contains('star'))
                          fieldTitle.text = '* ' + fieldTitle.text;

                      field.empty = true;
                      updateThumbnail(true);

                      return;
                  }

                  field.empty = false;

                  var asset = editor.call('assets:get', value);

                  if (! asset)
                      return updateThumbnail();

                  evtThumbnailChange = asset.on('file.hash.m:set', updateThumbnail);
                  updateThumbnail();

                  fieldTitle.text = asset.get('name');

                  if (field.class.contains('star'))
                      fieldTitle.text = '* ' + fieldTitle.text;
              };
              field.on('change', updateField);

              if (args.value)
                  field.value = args.value;

              updateField();

              var dropRef = editor.call('drop:target', {
                  ref: panel.element,
                  filter: function(type, data) {
                      var rectA = root.innerElement.getBoundingClientRect();
                      var rectB = panel.element.getBoundingClientRect();
                      return data.id && (args.kind === '*' || type === 'asset.' + args.kind) && parseInt(data.id, 10) !== field.value && ! editor.call('assets:get', parseInt(data.id, 10)).get('source') && rectB.top > rectA.top && rectB.bottom < rectA.bottom;
                  },
                  drop: function(type, data) {
                      if ((args.kind !== '*' && type !== 'asset.' + args.kind) || editor.call('assets:get', parseInt(data.id, 10)).get('source'))
                          return;

                      var oldValues = { };
                      if (args.onSet && args.link && args.link instanceof Array) {
                          for(var i = 0; i < args.link.length; i++) {
                              var id = 0;
                              if (args.link[i]._type === 'asset') {
                                  id = args.link[i].get('id');
                              } else if (args.link[i]._type === 'entity') {
                                  id = args.link[i].get('resource_id');
                              } else {
                                  continue;
                              }

                              oldValues[id] = args.link[i].get(pathAt(args, i));
                          }
                      }

                      field.emit('beforechange', parseInt(data.id, 10));
                      field.value = parseInt(data.id, 10);

                      if (args.onSet) {
                          var asset = editor.call('assets:get', parseInt(data.id, 10));
                          if (asset) args.onSet(asset, oldValues);
                      }
                  },
                  over: function(type, data) {
                      if (args.over)
                          args.over(type, data);
                  },
                  leave: function() {
                      if (args.leave)
                          args.leave();
                  }
              });
              field.on('destroy', function() {
                  dropRef.unregister();
                  if (evtThumbnailChange) {
                      evtThumbnailChange.unbind();
                      evtThumbnailChange = null;
                  }
              });

              // thumbnail
              panel.append(field);
              // right side
              panel.append(panelFields);
              // controls
              panelFields.appendChild(panelControls);
              // label
              if (label) {
                  panel.innerElement.removeChild(label.element);
                  panelControls.appendChild(label.element);
              }
              panelControls.classList.remove('label-field');
              // edit
              panelControls.appendChild(btnEdit.element);
              // remove
              panelControls.appendChild(btnRemove.element);

              // title
              panelFields.appendChild(fieldTitle.element);
              break;

          // entity picker
          case 'entity':
              field = new ui.Label();
              field.class.add('add-entity');
              field.flexGrow = 1;
              field.class.add('null');

              field.text = 'Select Entity';
              field.placeholder = '...';

              panel.append(field);

              var icon = document.createElement('span');
              icon.classList.add('icon');

              icon.addEventListener('click', function (e) {
                  e.stopPropagation();

                  if (editor.call('permissions:write'))
                      field.text = '';
              });

              field.on('change', function (value) {
                  if (value) {
                      var entity = editor.call('entities:get', value);
                      if (!entity) {
                          field.text = null;
                          return;
                      }

                      field.element.innerHTML = entity.get('name');
                      field.element.appendChild(icon);
                      field.placeholder = '';

                      if (value !== 'various')
                          field.class.remove('null');
                  } else {
                      field.element.innerHTML = 'Select Entity';
                      field.placeholder = '...';
                      field.class.add('null');
                  }
              });

              linkField();

              var getCurrentEntity = function () {
                  var entity = null;
                  if (args.link) {
                      if (! (args.link instanceof Array)) {
                          args.link = [args.link];
                      }

                      // get initial value only if it's the same for all
                      // links otherwise set it to null
                      for (var i = 0, len = args.link.length; i < len; i++) {
                          var val = args.link[i].get(pathAt(args, i));
                          if (entity !== val) {
                              if (entity) {
                                  entity = null;
                                  break;
                              } else {
                                  entity = val;
                              }
                          }
                      }
                  }

                  return entity;
              };

              field.on('click', function () {
                  var evtEntityPick = editor.once('picker:entity', function (entity) {
                      field.text = entity ? entity.get('resource_id') : null;
                      evtEntityPick = null;
                  });

                  var initialValue = getCurrentEntity();

                  editor.call('picker:entity', initialValue, args.filter || null);

                  editor.once('picker:entity:close', function () {
                      if (evtEntityPick) {
                          evtEntityPick.unbind();
                          evtEntityPick = null;
                      }
                  });
              });

              // highlight on hover
              field.on('hover', function () {
                  var entity = getCurrentEntity();
                  if (! entity) return;

                  editor.call('entities:panel:highlight', entity, true);

                  field.once('blur', function () {
                      editor.call('entities:panel:highlight', entity, false);
                  });

                  field.once('click', function () {
                      editor.call('entities:panel:highlight', entity, false);
                  });
              });

              var dropRef = editor.call('drop:target', {
                  ref: field.element,
                  filter: function(type, data) {
                      var rectA = root.innerElement.getBoundingClientRect();
                      var rectB = field.element.getBoundingClientRect();
                      return type === 'entity' && data.resource_id !== field.value && rectB.top > rectA.top && rectB.bottom < rectA.bottom;
                  },
                  drop: function(type, data) {
                      if (type !== 'entity')
                          return;

                      field.value = data.resource_id;
                  },
                  over: function(type, data) {
                      if (args.over)
                          args.over(type, data);
                  },
                  leave: function() {
                      if (args.leave)
                          args.leave();
                  }
              });
              field.on('destroy', function() {
                  dropRef.unregister();
              });

              break;
          case 'image':
              panel.flex = false;

              field = new Image();
              field.style.maxWidth = '100%';
              field.style.display = 'block';
              field.src = args.src;

              panel.append(field);
              break;

          case 'progress':
              field = new ui.Progress();
              field.flexGrow = 1;

              panel.append(field);
              break;

          case 'code':
              field = new ui.Code();
              field.flexGrow = 1;

              if (args.value)
                  field.text = args.value;

              panel.append(field);
              break;

          case 'button':
              field = new ui.Button();
              field.flexGrow = 1;
              field.text = args.text || 'Button';
              panel.append(field);
              break;

          case 'element':
              field = args.element;
              panel.append(field);
              break;

          case 'curveset':
              field = new ui.CurveField(args);
              field.flexGrow = 1;
              field.text = args.text || '';

              // Warning: Curve fields do not currently support multiselect
              if (args.link) {
                  var link = args.link;
                  if (args.link instanceof Array)
                      link = args.link[0];

                  var path = pathAt(args, 0);

                  field.link(link, args.canRandomize ? [path, path + '2'] : [path]);
              }

              var curvePickerOn = false;

              var toggleCurvePicker = function () {
                  if (!field.class.contains('disabled') && !curvePickerOn) {
                      editor.call('picker:curve', field.value, args);

                      curvePickerOn = true;

                      // position picker
                      var rectPicker = editor.call('picker:curve:rect');
                      var rectField = field.element.getBoundingClientRect();
                      editor.call('picker:curve:position', rectField.right - rectPicker.width, rectField.bottom);

                      args.keepZoom = false;

                      var combine = false;

                      var evtChangeStart = editor.on('picker:curve:change:start', function () {
                          combine = true;
                      });

                      var evtChangeEnd = editor.on('picker:curve:change:end', function () {
                          combine = false;
                      });

                      var evtPickerChanged = editor.on('picker:curve:change', function (paths, values) {
                          if (! field._link) return;

                          var link = field._link;

                          var previous = {
                              paths: [],
                              values: []
                          };

                          var path;
                          for (var i = 0, len = paths.length; i < len; i++) {
                              path = pathAt(args, 0); // always use 0 because we do not support multiselect
                              // use the second curve path if needed
                              if (args.canRandomize && paths[i][0] !== '0') {
                                  path += '2';
                              }

                              path += paths[i].substring(1);

                              previous.paths.push(path);
                              previous.values.push(field._link.get(path));
                          }


                          var undo = function () {
                              var item = link;
                              if (link.history && link.history._getItemFn) {
                                  item = link.history._getItemFn();
                              }

                              if (! item) return;

                              args.keepZoom = true;

                              var history = false;
                              if (item.history) {
                                  history = item.history.enabled;
                                  item.history.enabled = false;
                              }

                              for (var i = 0, len = previous.paths.length; i < len; i++) {
                                  item.set(previous.paths[i], previous.values[i]);
                              }

                              if (item.history)
                                  item.history.enabled = history;

                              args.keepZoom = false;
                          };

                          var redo = function () {
                              var item = link;
                              if (link.history && link.history._getItemFn) {
                                  item = link.history._getItemFn();
                              }

                              if (! item) return;

                              args.keepZoom = true;

                              var history = false;
                              if (item.history) {
                                  history = item.history.enabled;
                                  item.history.enabled = false;
                              }

                              for (var i = 0, len = paths.length; i < len; i++) {
                                  path = pathAt(args, 0); // always use 0 because we do not support multiselect
                                  // use the second curve path if needed
                                  if (args.canRandomize && paths[i][0] !== '0') {
                                      path += '2';
                                  }

                                  path += paths[i].substring(1);

                                  item.set(path, values[i]);
                              }

                              if (item.history)
                                  item.history.enabled = history;

                              args.keepZoom = false;
                          };

                          redo();

                          // add custom history event
                          editor.call('history:' + (combine ? 'update' : 'add'), {
                              name: path + '.curves',
                              undo: undo,
                              redo: redo
                          });

                      });

                      var evtRefreshPicker = field.on('change', function (value) {
                          editor.call('picker:curve:set', value, args);
                      });

                      editor.once('picker:curve:close', function () {
                          evtRefreshPicker.unbind();
                          evtPickerChanged.unbind();
                          evtChangeStart.unbind();
                          evtChangeEnd.unbind();
                          curvePickerOn = false;
                      });
                  }
              };

              // open curve editor on click
              field.on('click', toggleCurvePicker);

              // close picker if field destroyed
              field.on('destroy', function() {
                  if (curvePickerOn) {
                      editor.call('picker:curve:close');
                  }
              });

              panel.append(field);
              break;

          case 'gradient':
              field = new ui.CurveField(args);
              field.flexGrow = 1;
              field.text = args.text || '';

              if (args.link) {
                  var link = args.link;
                  if (args.link instanceof Array)
                      link = args.link[0];
                  var path = pathAt(args, 0);
                  field.link(link, [path]);
              }

              var gradientPickerVisible = false;

              var toggleGradientPicker = function () {
                  if (!field.class.contains('disabled') && !gradientPickerVisible) {
                      editor.call('picker:gradient', field.value, args);

                      gradientPickerVisible = true;

                      // position picker
                      var rectPicker = editor.call('picker:gradient:rect');
                      var rectField = field.element.getBoundingClientRect();
                      editor.call('picker:gradient:position', rectField.right - rectPicker.width, rectField.bottom);

                      var evtPickerChanged = editor.on('picker:curve:change', function (paths, values) {
                          if (!field._link) return;

                          var link = field._link;

                          var previous = {
                              paths: [],
                              values: []
                          };

                          var path;
                          for (var i=0; i<paths.length; i++) {
                              // always use 0 because we do not support multiselect
                              path = pathAt(args, 0) + paths[i].substring(1);
                              previous.paths.push(path);
                              previous.values.push(field._link.get(path));
                          }

                          var undo = function() {
                              var item = link;
                              if (link.history && link.history._getItemFn) {
                                  item = link.history._getItemFn();
                              }

                              if (!item) return;

                              var history = false;
                              if (item.history) {
                                  history = item.history.enabled;
                                  item.history.enabled = false;
                              }

                              for (var i=0; i<previous.paths.length; i++) {
                                  item.set(previous.paths[i], previous.values[i]);
                              }

                              if (item.history)
                                  item.history.enabled = history;
                          };

                          var redo = function() {
                              var item = link;
                              if (link.history && link.history._getItemFn) {
                                  item = link.history._getItemFn();
                              }

                              if (!item) return;

                              var history = false;
                              if (item.history) {
                                  history = item.history.enabled;
                                  item.history.enabled = false;
                              }

                              for (var i=0; i<paths.length; i++) {
                                  // always use 0 because we do not support multiselect
                                  path = pathAt(args, 0) + paths[i].substring(1);
                                  item.set(path, values[i]);
                              }

                              if (item.history)
                                  item.history.enabled = history;
                          };

                          redo();

                          editor.call('history:' + 'add', {
                              name : path + '.curves',
                              undo: undo,
                              redo: redo
                          });
                      });

                      var evtRefreshPicker = field.on('change', function (value) {
                          editor.call('picker:gradient:set', value, args);
                      });

                      editor.once('picker:gradient:close', function () {
                          evtRefreshPicker.unbind();
                          evtPickerChanged.unbind();
                          gradientPickerVisible = false;
                      });
                  }
              };

              // open curve editor on click
              field.on('click', toggleGradientPicker);

              panel.append(field);
              break;

          case 'array':
              field = editor.call('attributes:addArray', args);
              panel.append(field);

              break;

          default:
              field = new ui.Label();
              field.flexGrow = 1;
              field.text = args.value || '';
              field.class.add('selectable');

              if (args.placeholder)
                  field.placeholder = args.placeholder;

              linkField();

              panel.append(field);
              break;
      }

      if (args.className && field instanceof ui.Element) {
          field.class.add(args.className);
      }

      return field;
  });

  var inspectedItems = [ ];

  editor.on('attributes:clear', function() {
      for(var i = 0; i < inspectedItems.length; i++) {
          inspectedItems[i].unbind();
      }
      inspectedItems = [ ];
  });

  editor.method('attributes:inspect', function(type, item) {
      clearPanel();

      // clear if destroyed
      inspectedItems.push(item.once('destroy', function() {
          editor.call('attributes:clear');
      }));

      root.headerText = type;
      editor.emit('attributes:inspect[' + type + ']', [ item ]);
      editor.emit('attributes:inspect[*]', type, [ item ]);
  });

  editor.on('selector:change', function(type, items) {
      clearPanel();

      // nothing selected
      if (items.length === 0) {
          var label = new ui.Label({ text: 'Select anything to Inspect' });
          label.style.display = 'block';
          label.style.textAlign = 'center';
          root.append(label);

          root.headerText = title;

          return;
      }

      // clear if destroyed
      for(var i = 0; i < items.length; i++) {
          inspectedItems.push(items[i].once('destroy', function() {
              editor.call('attributes:clear');
          }));
      }

      root.headerText = type;
      editor.emit('attributes:inspect[' + type + ']', items);
      editor.emit('attributes:inspect[*]', type, items);
  });

  editor.emit('selector:change', null, [ ]);
});


/* editor/attributes/attributes-assets-list.js */
editor.once('load', function () {
  'use strict';

  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');
  var root = editor.call('layout.attributes');

  // get the right path from args
  var pathAt = function (args, index) {
      return args.paths ? args.paths[index] : args.path;
  };

  var historyState = function (item, state) {
      if (item.history !== undefined) {
          if (typeof(item.history) === 'boolean') {
              item.history = state;
          } else {
              item.history.enabled = state;
          }
      } else {
          if (item._parent && item._parent.history !== undefined) {
              item._parent.history.enabled = state;
          }
      }
  };

  /**
   * Creates an Asset List widget
   * @param {Object} args Widget arguments
   * @param {Observer[]} args.link The observers we are editing
   * @param {String} [args.type] The asset type that is selectible from the asset list
   * @param {Function} [args.filterFn] A custom function that filters assets that can be dragged on the list. The function
   * takes the asset as its only argument.
   */
  editor.method('attributes:addAssetsList', function (args) {
      var link = args.link;
      var assetType = args.type;
      var assetFilterFn = args.filterFn;
      var panel = args.panel;
      var events = [];
      // index list items by asset id
      var assetIndex = {};

      var panelWidget = new ui.Panel();
      panelWidget.flex = true;
      panelWidget.class.add('asset-list');

      var isSelectingAssets = false;
      var currentSelection = null;

      // button that enables selection mode
      var btnSelectionMode = new ui.Button({
          text: 'Add Assets'
      });
      btnSelectionMode.class.add('selection-mode');
      panelWidget.append(btnSelectionMode);

      // panel for buttons
      var panelButtons = new ui.Panel();
      panelButtons.class.add('buttons');
      panelButtons.flex = true;
      panelButtons.hidden = true;

      // label
      var labelAdd = new ui.Label({
          text: 'Add Assets'
      });
      panelButtons.append(labelAdd);

      // add button
      var btnAdd = new ui.Button({
          text: 'ADD SELECTION'
      });
      btnAdd.disabled = true;
      btnAdd.class.add('add-assets');

      panelButtons.append(btnAdd);

      // done button
      var btnDone = new ui.Button({
          text: 'DONE'
      });
      btnDone.flexGrow = 1;
      btnDone.class.add('done');
      panelButtons.append(btnDone);

      panelWidget.append(panelButtons);

      btnSelectionMode.on('click', function () {
          isSelectingAssets = true;
          panelButtons.hidden = false;
          btnSelectionMode.hidden = true;

          fieldAssets.parent.style.zIndex = 102;
          dropRef.disabled = true;

          // asset picker
          editor.call('picker:asset', {
              type: assetType,
              multi: true
          });

          // on pick
          var evtPick = editor.on('picker:assets', function (assets) {
              currentSelection = assets.filter(function (asset) {
                  if (assetFilterFn) {
                      return assetFilterFn(asset);
                  }

                  if (legacyScripts && asset.get('type') === 'script') {
                      return false;
                  }

                  return true;
              }).map(function (asset) {
                  return parseInt(asset.get('id'), 10);
              });

              btnAdd.disabled = !currentSelection.length;
          });

          editor.once('picker:asset:close', function () {
              currentSelection = null;
              isSelectingAssets = false;
              panelButtons.hidden = true;
              btnSelectionMode.hidden = false;
              btnAdd.disabled = true;
              fieldAssets.parent.style.zIndex = '';
              dropRef.disabled = !panel.enabled;

              if (evtPick) {
                  evtPick.unbind();
                  evtPick = null;
              }
          });
      });

      btnDone.on('click', function () {
          editor.call('picker:asset:close');
      });

      // search field
      var fieldFilter = new ui.TextField();
      fieldFilter.hidden = true;
      fieldFilter.elementInput.setAttribute('placeholder', 'Type to filter');
      fieldFilter.keyChange = true;
      fieldFilter.renderChanges = false;
      panelWidget.append(fieldFilter);

      // assets
      var fieldAssets;
      var fieldAssetsList = new ui.List();
      fieldAssetsList.class.add('empty');
      fieldAssetsList.flexGrow = 1;

      fieldAssetsList.on('select', function (item) {
          if (!item.asset) return;
          editor.call('selector:set', 'asset', [item.asset]);
      });

      // Adds asset ids to the list
      var addAssets = function (assetIds) {
          var records = [];

          for (var i = 0; i < link.length; i++) {
              var path = pathAt(args, i);

              for (var j = 0; j < assetIds.length; j++) {
                  var assetId = assetIds[j];

                  // check if already in list
                  if (link[i].get(path).indexOf(assetId) !== -1)
                      continue;

                  records.push({
                      get: link[i].history !== undefined ? link[i].history._getItemFn : null,
                      item: link[i],
                      path: path,
                      value: assetId
                  });

                  historyState(link[i], false);
                  link[i].insert(path, assetId);
                  historyState(link[i], true);
              }
          }

          editor.call('history:add', {
              name: pathAt(args, 0),
              undo: function () {
                  for (var i = 0; i < records.length; i++) {
                      var item;
                      if (records[i].get) {
                          item = records[i].get();
                          if (!item) continue;
                      } else {
                          item = records[i].item;
                      }

                      historyState(item, false);
                      item.removeValue(records[i].path, records[i].value);
                      historyState(item, true);
                  }
              },
              redo: function () {
                  for (var i = 0; i < records.length; i++) {
                      var item;
                      if (records[i].get) {
                          item = records[i].get();
                          if (!item) continue;
                      } else {
                          item = records[i].item;
                      }

                      historyState(item, false);
                      item.insert(records[i].path, records[i].value);
                      historyState(item, true);
                  }
              }
          });
      };

      // Removes asset id from the list
      var removeAsset = function (assetId) {
          var records = [];

          for (var i = 0; i < link.length; i++) {
              var path = pathAt(args, i);
              var ind = link[i].get(path).indexOf(assetId);
              if (ind === -1)
                  continue;

              records.push({
                  get: link[i].history !== undefined ? link[i].history._getItemFn : null,
                  item: link[i],
                  path: path,
                  value: assetId,
                  ind: ind
              });

              historyState(link[i], false);
              link[i].removeValue(path, assetId);
              historyState(link[i], true);
          }

          editor.call('history:add', {
              name: pathAt(args, 0),
              undo: function () {
                  for (var i = 0; i < records.length; i++) {
                      var item;
                      if (records[i].get) {
                          item = records[i].get();
                          if (!item) continue;
                      } else {
                          item = records[i].item;
                      }

                      historyState(item, false);
                      item.insert(records[i].path, records[i].value, records[i].ind);
                      historyState(item, true);
                  }
              },
              redo: function () {
                  for (var i = 0; i < records.length; i++) {
                      var item;
                      if (records[i].get) {
                          item = records[i].get();
                          if (!item) continue;
                      } else {
                          item = records[i].item;
                      }

                      historyState(item, false);
                      item.removeValue(records[i].path, records[i].value);
                      historyState(item, true);
                  }
              }
          });
      };

      // add asset list item to the list
      var addAssetListItem = function (assetId, after) {
          assetId = parseInt(assetId, 10);

          var item = assetIndex[assetId];
          if (item) {
              item.count++;
              item.text = (item.count === link.length ? '' : '* ') + item._assetText;
              return;
          }

          var asset = editor.call('assets:get', assetId);
          var text = assetId;
          if (asset && asset.get('name')) {
              text = asset.get('name');
          } else if (!asset) {
              text += ' (Missing)';
          }

          item = new ui.ListItem({
              text: (link.length === 1) ? text : '* ' + text
          });
          if (asset) {
              item.class.add('type-' + asset.get('type'));
          }
          item.count = 1;
          item.asset = asset;
          item._assetText = text;

          if (after) {
              fieldAssetsList.appendAfter(item, after);
          } else {
              fieldAssetsList.append(item);
          }

          fieldAssetsList.class.remove('empty');
          fieldFilter.hidden = false;

          assetIndex[assetId] = item;

          // remove button
          var btnRemove = new ui.Button();
          btnRemove.class.add('remove');
          btnRemove.on('click', function () {
              removeAsset(assetId);

          });
          btnRemove.parent = item;
          item.element.appendChild(btnRemove.element);

          item.once('destroy', function () {
              delete assetIndex[assetId];
          });
      };

      // Removes list item for the specified asset id
      var removeAssetListItem = function (assetId) {
          var item = assetIndex[assetId];

          if (!item)
              return;

          item.count--;

          if (item.count === 0) {
              item.destroy();
              fieldAssets.emit('remove', item);

              if (!fieldAssetsList.element.children.length) {
                  fieldAssetsList.class.add('empty');
                  fieldFilter.hidden = true;
              }

          } else {
              item.text = (item.count === link.length ? '' : '* ') + item._assetText;
          }
      };

      // drop
      var dropRef = editor.call('drop:target', {
          ref: panelWidget.element,
          type: 'asset.' + assetType,
          filter: function (type, data) {
              // type
              if ((assetType && assetType !== '*' && type !== 'asset.' + assetType) || !type.startsWith('asset') || editor.call('assets:get', parseInt(data.id, 10)).get('source'))
                  return false;

              // if a custom filter function has
              // been provided then use it now
              if (assetFilterFn) {
                  if (!assetFilterFn(editor.call('assets:get', data.id))) {
                      return false;
                  }
              }

              // overflowed
              var rectA = root.innerElement.getBoundingClientRect();
              var rectB = panelWidget.element.getBoundingClientRect();
              if (rectB.top <= rectA.top || rectB.bottom >= rectA.bottom)
                  return false;

              // already added
              var id = parseInt(data.id, 10);
              for (var i = 0; i < link.length; i++) {
                  if (link[i].get(pathAt(args, i)).indexOf(id) === -1)
                      return true;
              }

              return false;
          },
          drop: function (type, data) {
              if ((assetType && assetType !== '*' && type !== 'asset.' + assetType) || !type.startsWith('asset') || editor.call('assets:get', parseInt(data.id, 10)).get('source'))
                  return;

              var assetId = parseInt(data.id, 10);
              addAssets([assetId]);
          }
      });
      dropRef.disabled = panel.disabled;
      panel.on('enable', function () {
          if (!isSelectingAssets)
              dropRef.disabled = false;
      });
      panel.on('disable', function () {
          dropRef.disabled = true;

          // clear list item
          var items = fieldAssetsList.element.children;
          var i = items.length;
          while (i-- > 1) {
              if (!items[i].ui || !(items[i].ui instanceof ui.ListItem))
                  continue;

              items[i].ui.destroy();
          }

          fieldAssetsList.class.add('empty');
          fieldFilter.hidden = true;

          assetIndex = {};
      });
      fieldAssetsList.on('destroy', function () {
          dropRef.unregister();
      });

      panelWidget.append(fieldAssetsList);

      fieldAssets = editor.call('attributes:addField', {
          parent: panel,
          name: args.name || '',
          type: 'element',
          element: panelWidget,
          reference: args.reference
      });
      fieldAssets.class.add('assets');

      // reference assets
      if (args.reference) {
          editor.call('attributes:reference:attach', args.reference, fieldAssets.parent.innerElement.firstChild.ui);
      }

      // on adding new asset
      btnAdd.on('click', function () {
          if (isSelectingAssets) {
              if (currentSelection) {
                  addAssets(currentSelection);
                  currentSelection = null;
                  editor.call('picker:asset:deselect');
              }
          }
      });

      var createInsertHandler = function (index) {
          var path = pathAt(args, index);
          return link[index].on(path + ':insert', function (assetId, ind) {
              var before;
              if (ind === 0) {
                  before = null;
              } else {
                  before = assetIndex[this.get(path + '.' + ind)];
              }
              addAssetListItem(assetId, before);
          });
      };

      // list
      for (var i = 0; i < link.length; i++) {
          var assets = link[i].get(pathAt(args, i));
          if (assets) {
              for (var a = 0; a < assets.length; a++)
                  addAssetListItem(assets[a]);
          }

          events.push(link[i].on(pathAt(args, i) + ':set', function (assets, assetsOld) {
              var a, id;

              if (!(assets instanceof Array))
                  return;

              if (!(assetsOld instanceof Array))
                  assetsOld = [];

              var assetIds = {};
              for (a = 0; a < assets.length; a++)
                  assetIds[assets[a]] = true;

              var assetOldIds = {};
              for (a = 0; a < assetsOld.length; a++)
                  assetOldIds[assetsOld[a]] = true;

              // remove
              for (id in assetOldIds) {
                  if (assetIds[id])
                      continue;

                  removeAssetListItem(id);
              }

              // add
              for (id in assetIds)
                  addAssetListItem(id);
          }));

          events.push(createInsertHandler(i));

          events.push(link[i].on(pathAt(args, i) + ':remove', removeAssetListItem));
      }

      var filterAssets = function (filter) {
          var id;

          if (! filter) {
              for (id in assetIndex) {
                  assetIndex[id].hidden = false;
              }
              return;
          }

          var items = [];
          for (id in assetIndex) {
              items.push([assetIndex[id].text, parseInt(id, 10)]);
          }
          var results = editor.call('search:items', items, filter);
          for (id in assetIndex) {
              if (results.indexOf(parseInt(id, 10)) === -1) {
                  assetIndex[id].hidden = true;
              } else {
                  assetIndex[id].hidden = false;
              }
          }
      };

      fieldFilter.on('change', filterAssets);

      fieldAssetsList.once('destroy', function () {
          for (var i = 0; i < events.length; i++) {
              events[i].unbind();
          }

          events.length = 0;
      });

      return fieldAssetsList;
  });
});


/* editor/attributes/attributes-array.js */
editor.once('load', function () {
  'use strict';

  var defaults = {
      checkbox: false,
      number: 0,
      string: '',
      json: '{ }',
      asset: null,
      entity: null,
      rgb: [ 1, 1, 1 ],
      vec2: [ 0, 0 ],
      vec3: [ 0, 0, 0 ],
      vec4: [ 0, 0, 0, 0 ],
      curveset: { keys: [ 0, 0 ], type: 2 }
  };

  // Creates an array widget
  editor.method('attributes:addArrayField', function (args) {
      var events = [];

      var suspendSizeEvents = false;

      var arrayElements = [];
      var timeoutRefreshElements = null;

      var panel = new ui.Panel();
      panel.class.add('attributes-array');
      panel.flex = true;
      panel.flexGrow = 1;

      editor.call('attributes:addField', {
          panel: args.panel,
          name: args.name,
          type: 'element',
          element: panel
      });

      panel.parent.flex = true;

      // create array length observer for each link
      // in order to hook it up with the size field
      var sizeObservers = [];
      args.link.forEach(function (link, i) {
          var path = pathAt(args, i);
          var arr = link.get(path);
          var len = arr ? arr.length : 0;

          var observer = new Observer({
              size: len
          });

          sizeObservers.push(observer);
      });

      // The number of elements in the array
      var fieldSize = editor.call('attributes:addField', {
          parent: panel,
          type: 'number',
          placeholder: 'Array Size',
          link: sizeObservers,
          path: 'size',
          stopHistory: true // do not use default number field history
      });

      fieldSize.parent.flexGrow = 1;

      fieldSize.on('change', function (value) {
          // check fieldSize._changing otherwise this will
          // cause changeArraySize to be called twice - once in
          // this function and once in the link event handlers
          if (suspendSizeEvents || fieldSize._changing) return;
          changeArraySize(value);
      });

      // container for array elements
      var panelElements = new ui.Panel();
      panelElements.class.add('attributes-array-elements');
      panelElements.flex = true;
      panelElements.flexGrow = 1;
      panel.append(panelElements);

      var refreshArrayElements = function () {
          timeoutRefreshElements = null;

          // currently curves do not support multiselect
          if (args.type === 'curveset' && args.link.length > 1) {
              return;
          }

          // destroy existing elements
          arrayElements.forEach(function (field) {
              // field might be an array like for vectors
              if (field instanceof Array) {
                  // check if parent exists because might
                  // have already been destroyed when parsing script attributes for example
                  if (field[0].parent) {
                      field[0].parent.destroy();
                  }
              } else {
                  if (field.parent) {
                      field.parent.destroy();
                  }
              }
          });
          arrayElements.length = 0;

          var allArrays = args.link.map(function (link, i) {
              return link.get(pathAt(args, i));
          });

          var row = -1;
          var rowExistsEverywhere = true;

          var createRow = function (row) {
              var paths = args.link.map(function (link, i) {return pathAt(args, i) + '.' + row;});

              var fieldArgs = {
                  parent: panelElements,
                  type: args.type,
                  link: args.link,
                  placeholder: args.placeholder,
                  reference: args.reference,
                  kind: args.kind,
                  enum: args.enum,
                  curves: args.curves,
                  gradient: args.gradient,
                  min: args.min,
                  max: args.max,
                  hideRandomize: args.hideRandomize,
                  paths: paths
              };

              var field = editor.call('attributes:addField', fieldArgs);
              arrayElements.push(field);

              // button to remove array element
              var btnRemove = new ui.Button({
                  text: '&#57636;',
                  unsafe: true
              });
              btnRemove.class.add('delete');

              var fieldParent = Array.isArray(field) ? field[0].parent : field.parent;
              fieldParent.append(btnRemove);

              btnRemove.on('click', function () {
                  var prev;

                  var redo = function () {
                      prev = new Array(args.link.length);

                      // store previous array
                      args.link.forEach(function (link, i) {
                          // get link again in case it changed
                          if (link.history.getItemFn) {
                              link = link.history.getItemFn();
                          }

                          if (! link) return;

                          // store previous array
                          var path = pathAt(args, i);
                          var arr = link.get(path);
                          prev[i] = arr && arr.slice();
                      });

                      args.link.forEach(function (link, i) {
                          if (! prev[i]) return;

                          // get link again in case it changed
                          if (link.history.getItemFn) {
                              link = link.history.getItemFn();
                          }

                          if (! link) return;

                          // copy array and remove
                          // the element at the relevant row
                          var arr = prev[i].slice();
                          arr.splice(row, 1);

                          // set new value
                          var history = link.history.enabled;
                          link.history.enabled = false;

                          if (arr[0] !== null && typeof(arr[0]) === 'object') {
                              link.set(pathAt(args, i), []);
                              arr.forEach(function (element) {
                                  link.insert(pathAt(args, i), element);
                              });
                          } else {
                              link.set(pathAt(args, i), arr);
                          }

                          link.history.enabled = history;
                      });
                  };

                  var undo = function () {
                      args.link.forEach(function (link, i) {
                          if (! prev[i]) return;

                          // get link again in case it changed
                          if (link.history.getItemFn) {
                              link = link.history.getItemFn();
                          }

                          if (! link) return;

                          var path = pathAt(args, i);

                          // set previous value
                          var history = link.history.enabled;
                          link.history.enabled = false;

                          var arr = prev[i];
                          if (arr[0] !== null && typeof(arr[0]) === 'object') {
                              link.set(pathAt(args, i), []);
                              arr.forEach(function (element) {
                                  link.insert(pathAt(args, i), element);
                              });
                          } else {
                              link.set(pathAt(args, i), arr);
                          }

                          link.history.enabled = history;
                      });

                      // clean up
                      prev.length = 0;
                  };

                  redo();

                  editor.call('history:add', {
                      name: 'delete array element',
                      undo: undo,
                      redo: redo
                  });
              });
          };

          while (rowExistsEverywhere) {
              row++;

              for (var i = 0; i < allArrays.length; i++) {
                  if (! allArrays[i] || (! (allArrays[i] instanceof Array)) || allArrays[i].length <= row) {
                      rowExistsEverywhere = false;
                      break;
                  }
              }

              if (rowExistsEverywhere) {
                  createRow(row);
              }
          }
      };

      var refreshArrayElementsDeferred = function () {
          if (timeoutRefreshElements) {
              clearTimeout(timeoutRefreshElements);
          }

          timeoutRefreshElements = setTimeout(refreshArrayElements);
      };

      refreshArrayElements();

      // register event listeners for array
      args.link.forEach(function (link, i) {
          var path = pathAt(args, i);

          var updateSize = function () {
              var value = link.get(path);
              var suspend = suspendSizeEvents;
              suspendSizeEvents = true;
              sizeObservers[i].set('size', value ? value.length : 0);
              suspendSizeEvents = suspend;

              refreshArrayElementsDeferred();
          };

          events.push(link.on(path + ':set', updateSize));
          events.push(link.on(path + ':insert', updateSize));
          events.push(link.on(path + ':remove', updateSize));
      });

      // Clean up
      panel.on('destroy', function () {
          events.forEach(function (evt) {
              evt.unbind();
          });

          events.length = 0;
      });

      // Undoable action - change the size of the array of each link
      var changeArraySize = function (size) {
          var prev;

          var redo = function () {
              var suspend = suspendSizeEvents;
              suspendSizeEvents = true;

              prev = new Array(args.link.length);

              // store previous array
              // do this first so that prev has valid
              // values for all entries in case we need to
              // undo a half-completed redo
              args.link.forEach(function (link, i) {
                  // get link again in case it changed
                  if (link.history.getItemFn) {
                      link = link.history.getItemFn();
                  }

                  if (! link) return;

                  // store previous array
                  var path = pathAt(args, i);
                  var arr = link.get(path);
                  prev[i] = arr && arr.slice();
              });

              args.link.forEach(function (link, i) {
                  if (! prev[i]) return;

                  // get link again in case it changed
                  if (link.history.getItemFn) {
                      link = link.history.getItemFn();
                  }

                  if (! link) return;

                  // resize array
                  var arr = prev[i].slice();
                  while (arr.length < size) {
                      arr.push(getDefaultValue(args));
                  }
                  arr.length = size;

                  // set new value
                  var history = link.history.enabled;
                  link.history.enabled = false;

                  if (arr[0] !== null && typeof(arr[0]) === 'object') {
                      link.set(pathAt(args, i), []);
                      arr.forEach(function (element) {
                          link.insert(pathAt(args, i), element);
                      });
                  } else {
                      link.set(pathAt(args, i), arr);
                  }

                  link.history.enabled = history;
              });

              suspendSizeEvents = suspend;
          };

          var undo = function () {
              var suspend = suspendSizeEvents;
              suspendSizeEvents = true;

              args.link.forEach(function (link, i) {
                  if (! prev[i]) return;

                  // get link again in case it changed
                  if (link.history.getItemFn) {
                      link = link.history.getItemFn();
                  }

                  if (! link) return;

                  var path = pathAt(args, i);

                  // set previous value
                  var history = link.history.enabled;
                  link.history.enabled = false;

                  var arr = prev[i];
                  if (arr[0] !== null && typeof(arr[0]) === 'object') {
                      link.set(pathAt(args, i), []);
                      arr.forEach(function (element) {
                          link.insert(pathAt(args, i), element);
                      });
                  } else {
                      link.set(pathAt(args, i), arr);
                  }

                  link.history.enabled = history;
              });

              // clean up
              prev.length = 0;

              suspendSizeEvents = suspend;
          };

          editor.call('history:add', {
              name: 'edit array size',
              redo: redo,
              undo: undo
          });

          redo();
      };

      return panel;
  });

  // Returns path at index of args.paths if that field exists otherwise
  // returns args.path
  var pathAt = function (args, index) {
      return args.paths ? args.paths[index] : args.path;
  };

  // Returns the default value for a new array element
  // based on the args provided
  var getDefaultValue = function (args) {
      var result = null;

      if (defaults[args.type] !== undefined) {
          result = defaults[args.type];

          if (args.type === 'curveset') {
              result = utils.deepCopy(result);
              if (args.color || args.curves) {
                  var len = args.color ? args.color.length : args.curves.length;
                  if (len > 1) {
                      result.keys = [ ];
                      for(var c = 0; c < len; c++) {
                          result.keys.push([ 0, 0 ]);
                      }

                  }
              }
          }
      }

      return result;
  };

});


/* editor/attributes/attributes-history.js */
editor.once('load', function() {
  'use strict';

  var list = [ ];
  var selecting = false;


  var root = editor.call('layout.root');
  var panel = editor.call('layout.attributes');


  var controls = new ui.Panel();
  controls.class.add('inspector-controls');
  controls.parent = panel;
  panel.header.append(controls);


  var selectorReturn = function() {
      var item = getLast();
      if (! item)
          return;

      // remove last one
      list = list.slice(0, list.length - 1);

      selecting = true;
      editor.call('selector:set', item.type, item.items);
      editor.once('selector:change', function() {
          selecting = false;

          updateTooltipContent();
      });
  };
  editor.method('selector:return', selectorReturn);


  var btnBack = new ui.Button({
      text: '&#57649;'
  });
  btnBack.disabledClick = true;
  btnBack.hidden = true;
  btnBack.class.add('back');
  btnBack.on('click', selectorReturn);
  controls.append(btnBack);


  editor.on('selector:change', function(type, items) {
      if (selecting)
          return;

      updateTooltipContent();

      if (! type || ! items)
          return;

      var last = getLast();

      if (last && last.items.length === 1 && items.length === 1 && last.items[0] === items[0])
          return;

      list.push({
          type: type,
          items: items
      });
  });

  var getLast = function() {
      if (! list.length)
          return;

      var ignoreType = editor.call('selector:type');
      var ignore = editor.call('selector:items');

      var i = list.length - 1;
      var candidate = list[i];

      while(candidate && ignoreType && ignoreType === candidate.type && candidate.items.equals(ignore))
          candidate = list[--i];

      return candidate || null;
  };

  var updateTooltipContent = function() {
      var item = getLast();

      if (! item && ! btnBack.hidden) {
          btnBack.hidden = true;
      } else if (item && btnBack.hidden) {
          btnBack.hidden = false;
      }

      if (item && ! tooltip.hidden) {
          if (item.type === 'entity') {
              if (item.items.length === 1) {
                  setTooltipText(item.items[0].get('name') + ' [entity]');
              } else {
                  setTooltipText('[' + item.items.length + ' entities]');
              }
          } else if (item.type === 'asset') {
              if (item.items.length === 1) {
                  setTooltipText(item.items[0].get('name') + ' [' + item.items[0].get('type') + ']');
              } else {
                  setTooltipText('[' + item.items.length + ' assets]');
              }
          } else if (item.type === 'editorSettings') {
              setTooltipText('Settings');
          }
      }
  };


  var tooltip = Tooltip.attach({
      target: btnBack.element,
      text: '-',
      align: 'top',
      root: root
  });
  tooltip.on('show', updateTooltipContent);
  tooltip.class.add('previous-selection');

  btnBack.on('hide', function() {
      tooltip.hidden = true;
  });

  var setTooltipText = function(str) {
      tooltip.html = '<span>Previous Selection</span><br />' + str;
  };


  editor.call('hotkey:register', 'selector:return', {
      key: 'z',
      shift: true,
      callback: function () {
          if (editor.call('picker:isOpen:otherThan', 'curve')) return;
          selectorReturn();
      }
  });
});


/* editor/attributes/attributes-reference.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var panel = editor.call('layout.attributes');
  var index = { };
  var missing = { };


  var sanitize = function(str) {
      return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };


  editor.method('attributes:reference:add', function(args) {
      index[args.name] = editor.call('attributes:reference', args);
  });

  editor.method('attributes:reference:attach', function(name, target, element, panel) {
      var tooltip = index[name];

      if (! tooltip) {
          if (! missing[name]) {
              missing[name] = true;
              console.log('reference', name, 'is not defined');
          }
          return;
      }

      tooltip.attach({
          target: target,
          panel: panel,
          element: element || target.element
      });

      return tooltip;
  });


  editor.method('attributes:reference:template', function(args) {
      var html = '';

      if (args.title)
          html += '<h1>' + sanitize(args.title) + '</h1>';
      if (args.subTitle)
          html += '<h2>' + sanitize(args.subTitle) + '</h2>';
      if (args.webgl2)
          html += '<div class="tag">WebGL 2.0 Only</div>';
      if (args.description) {
          var description = sanitize(args.description);
          description = description.replace(/\n/g, '<br />'); // new lines
          description = description.replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>'); // bold
          html += '<p>' + description + '</p>';
      }
      if (args.code)
          html += '<pre class="ui-code">' + sanitize(args.code) + '</pre>';
      if (args.url)
          html += '<a class="reference" href="' + sanitize(args.url) + '" target="_blank">API Reference</a>';

      return html;
  });


  editor.method('attributes:reference', function(args) {
      var tooltip = new ui.Tooltip({
          align: 'right'
      });
      tooltip.hoverable = true;
      tooltip.class.add('reference');

      tooltip.html = editor.call('attributes:reference:template', args);

      var links = { };
      var timerHover = null;
      var timerBlur = null;

      tooltip.attach = function(args) {
          var target = args.target;
          var element = args.element;
          var targetPanel = args.panel || panel;
          targetPanel = targetPanel.dom || targetPanel.element;

          var show = function() {
              if (! target || target.hidden) return;
              tooltip.position(targetPanel.getBoundingClientRect().left, element.getBoundingClientRect().top + 16);
              tooltip.hidden = false;
          };

          var evtHide = function() {
              clearTimeout(timerHover);
              clearTimeout(timerBlur);
              tooltip.hidden = true;
          };

          var evtHover = function() {
              clearTimeout(timerBlur);
              timerHover = setTimeout(show, 500);
          };

          var evtBlur = function() {
              clearTimeout(timerHover);
              timerBlur = setTimeout(hide, 200);
          };

          var evtClick = function() {
              clearTimeout(timerBlur);
              clearTimeout(timerHover);
              show();
          };

          target.on('hide', evtHide);

          target.once('destroy', function() {
              element.removeEventListener('mouseover', evtHover);
              element.removeEventListener('mouseout', evtBlur);
              element.removeEventListener('click', evtClick);
              target.unbind('hide', evtHide);
              target = null;
              element = null;
              clearTimeout(timerHover);
              clearTimeout(timerBlur);
              tooltip.hidden = true;
          });

          element.addEventListener('mouseover', evtHover, false);
          element.addEventListener('mouseout', evtBlur, false);
          element.addEventListener('click', evtClick, false);
      };

      var hide = function() {
          tooltip.hidden = true;
      };

      tooltip.on('hover', function() {
          clearTimeout(timerBlur);
      });

      root.append(tooltip);

      return tooltip;
  });
});


/* editor/attributes/reference/attributes-settings-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      title: 'name',
      subTitle: '{String}',
      description: 'Name of the Scene for better navigation across content.'
  }, {
      name: 'editor',
      description: 'Editor Settings are applied per user basis and only visible to you, and not team collaborators. Although rest of other sections are shared for the Scene for all collaborators.'
  }, {
      name: 'snap',
      description: 'Change increment value for Snap gizmo state. Use SHIFT or Snap Toggle on toolbar to enable Snapping during use of Gizmos.'
  }, {
      name: 'grid',
      description: 'To disable grid set Divisions to 0. Divisions specify number of grid rectangles in each horizontal direction. And Size specifies the size of a rectangles.'
  }, {
      name: 'cameraClip',
      description: 'If your scene is too large or objects needs to be too close, change Near/Far clip values of a camera for Editor. This setting does not affects the game.'
  }, {
      name: 'clearColor',
      description: 'Set the Camera Clear Color of your preference to affect Editor. This color will not affect the game.'
  }, {
      name: 'iconsSize',
      description: 'Size of icons displayed in Editor viewport',
  }, {
      name: 'localServer',
      description: 'Set a URL to use as the local server. When you click on "Launch Local" all your scripts will be loaded from this URL.'
  }, {
      name: 'locale',
      description: 'The locale that you can preview in the Editor and when you Launch your application. This is only visible to you not other members of your team.'
  }, {
      title: 'gravity',
      subTitle: '{pc.Vec3}',
      description: 'Gravity is the acceleration applied every frame to all rigid bodies in your scene. By default, it is set to -9.8 meters per second per second, which essentially approximates Earth\'s gravity. If you are making a game in space, you might want to set this to 0, 0, 0 (zero g).',
      url: 'http://developer.playcanvas.com/api/pc.RigidBodyComponentSystem.html#setGravity'
  }, {
      title: 'ambientColor',
      subTitle: '{pc.Color}',
      description: 'The color of the scene\'s ambient light source. PlayCanvas allows you to create directional, point and spot lights. These lights account for direct light that falls on objects. But in reality, light actually bounces around the environment and we call this indirect light. A global ambient light is a crude approximation of this and allows you to set a light source that appears to shine from all directions. The global ambient color is multiplied with the Ambient property of a Phong Material to add a contribution to the final color of an object. Note, if you are using a Skybox and Physical Materials the Ambient Color has no effect.',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#ambientLight'
  }, {
      title: 'skybox',
      subTitle: '{pc.Texture}',
      description: 'The Skybox is a cubemap asset that is rendered behind your 3D scene. This lets your use a set of 6 2D images to display the distant world beyond the 3D models in your scene. To add a skybox, create a cubemap asset and then assign it to the cubemap slot in the settings panel. Note, if you are using a Prefiltered Cubemap, the skybox will be used as the default environment map for all Physical materials.',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#skybox'
  }, {
      title: 'skyboxIntensity',
      subTitle: '{Number}',
      description: 'Intensity of the skybox to match the exposure levels.',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#skyboxIntensity'
  }, {
      title: 'skyboxMip',
      subTitle: '{Number}',
      description: 'Mip level of the prefiletered skybox, higher value is lower mip level which is lower resolution and more prefiltered (blured).',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#skyboxMip'
  }, {
      title: 'toneMapping',
      subTitle: '{Number}',
      description: 'Tonemapping is the process of compressing High Dynamic Range (HDR) colors into limited Low Dynamic Range (e.g. into visible monitor output values). There are two options for tonemapping. Linear: imply scales HDR colors by exposure. Filmic: More sophisticated curve, good at softening overly bright spots, while preserving dark shades as well. Linear tonemapping is active by default, it\'s simply (color * exposure). You can tweak exposure to make quick changes to brightness. Note that it\'s not just simple brightness à la Photoshop because your input can be HDR. e.g. If you have a light source with intensity = 8, it will still be quite bright (4) after exposure = 0.5. So, all visible things won\'t just fade out linearly. Filmic tonemapping is a good choice in high-contrast environments, like scenes lit by bright Sun, or interiors with bright lights being close to walls/ceiling. It will nicely remap out-of-range super bright values to something more perceptually realistic (our eyes and film do tonemapping as well, we don\'t see physically linear values). Well, ask any photographer: nobody likes to leave extremely bright spots as well as pitch black spots on a photo. Filmic tonemapping gives you nice abilities to get rid of such spots.',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#tomeMapping'
  }, {
      title: 'exposure',
      subTitle: '{Number}',
      description: 'The exposure value tweaks the overall brightness of the scene.',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#exposure'
  }, {
      title: 'gammaCorrection',
      subTitle: '{pc.GAMMA_*}',
      description: 'Computer screens are set up to output not physically linear, but perceptually linear (sRGB) signal. However, for correct appearance when performing lighting calculations, color textures must be converted to physically linear space, and then the fully lit image must be fit again into sRGB. Rendering with gamma correction enabled reduces the number of ugly, overly saturated highlights and better preserves color after lighting, and it\'s generally recommended that this be enabled in your scene. The following image shows a simple scene with a sphere. On the left the scene has been gamma corrected while on the right, the scene is uncorrected.',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#gammaCorrection'
  }, {
      title: 'fog',
      subTitle: '{pc.FOG_*}',
      description: 'The Fog Type property can be used to control an approximation of an ambient fog in your scene. Here is an example of fog being enabled: The types available are as follows: None - Fog is disabled Linear - Fog fades in linearly between a Fog Start and Fog End distance Exp - Fog fades in from the view position according to an exponential function Exp2 - Fog fades in from the view position according to an exponential squared function',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#fog'
  }, {
      title: 'fogDensity',
      subTitle: '{Number}',
      description: 'The fog density controls the rate at which fog fades in for Exp and Exp2 fog types. Larger values cause fog to fade in more quickly. Fog density must be a positive number.',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#fogDensity'
  }, {
      name: 'fogDistance',
      title: 'fogStart / fogEnd',
      subTitle: '{Number}',
      description: 'The distance in scene units from the viewpoint from where the fog starts to fade in and reaches a maximum. Any objects beyond maximum distance will be rendered with the fog color.',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#fogEnd'
  }, {
      title: 'fogColor',
      subTitle: '{pc.Color}',
      description: 'The color of the fog. This color is blended with a surface\'s color more as the fog fades in.',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#fogColor'
  }, {
      name: 'loadingScreenScript',
      title: 'Loading Screen Script',
      description: 'The name of the script to use for creating the loading screen of the application. The script needs to call pc.script.createLoadingScreen.',
      url: 'http://developer.playcanvas.com/en/api/pc.script.html#createLoadingScreen'
  }, {
      name: 'project:externalScripts',
      title: 'External Scripts',
      description: 'The URLs of external scripts you would like to include in your application. These URLs are added as <script> tags in the main HTML page of the application before any other script is loaded.',
  }, {
      name: 'project',
      title: 'Project Settings',
      description: 'Settings that affect the entire Project and not just this Scene.'
  }, {
      name: 'project:width',
      title: 'Resolution Width',
      description: 'The width of your application in pixels.'
  }, {
      name: 'project:height',
      title: 'Resolution Height',
      description: 'The height of your application in pixels.'
  }, {
      name: 'project:fillMode',
      title: 'Fill Mode',
      description: 'Fill Mode decides how the canvas fills the browser window.'
  }, {
      name: 'project:resolutionMode',
      title: 'Resolution Mode',
      description: 'Resolution Mode decides whether the canvas resolution will change when it is resized.'
  }, {
      name: 'project:physics',
      description: 'When enabled the Physics library code is included in your app.'
  }, {
      name: 'project:pixelRatio',
      title: 'Device Pixel Ratio',
      description: 'When enabled the canvas resolution will be calculated including the device pixel ratio. Enabling this might affect performance.'
  }, {
      name: 'project:preferWebGl2',
      title: 'Prefer WebGL 2.0',
      description: 'When enabled (default) application will use WebGL 2.0 if platform supports it.'
  }, {
      name: 'project:antiAlias',
      title: 'Anti-Alias',
      description: 'When disabled, anti-aliasing will be disabled for back-buffer.'
  }, {
      name: 'project:transparentCanvas',
      title: 'Transparent Canvas',
      description: 'When enabled the canvas will blend with the web page.'
  }, {
      name: 'project:preserveDrawingBuffer',
      title: 'Preserve drawing buffer',
      description: 'When enabled the drawing buffer will be preserved until its explicitely cleared. Useful if you want to take screenshots.'
  }, {
      name: 'project:vr',
      title: 'Enable VR',
      description: 'Initialize WebVR specific code in the engine. If device doesn’t support WebVR then load additional library to enable support.'
  }, {
      name: 'project:useLegacyAudio',
      title: 'Use Legacy Audio',
      description: 'If checked the old AudioSource component will be available in the Editor otherwise you will only see the new Sound component.'
  }, {
      name: 'project:useKeyboard',
      title: 'Enable Keyboard input',
      description: 'Disable this if you do not want to handle any keyboard input in your application.'
  }, {
      name: 'project:useMouse',
      title: 'Enable Mouse input',
      description: 'Disable this if you do not want to handle any mouse input in your application.'
  }, {
      name: 'project:useTouch',
      title: 'Enable Touch input',
      description: 'Disable this if you do not want to handle any touch input in your application.'
  }, {
      name: 'project:useGamepads',
      title: 'Enable Gamepad input',
      description: 'Disable this if you do not want to handle any gamepad input in your application.'
  }, {
      name: 'asset-tasks',
      title: 'Asset Tasks',
      description: 'Settings for defining default behaviour rules for asset pipeline jobs: assets extracting, textures resizing, etc.'
  }, {
      name: 'asset-tasks:texturePot',
      title: 'Texture power of two',
      description: 'When a texture is imported it will be resized to use the nearest power of two resolution.'
  }, {
      name: 'asset-tasks:textureDefaultToAtlas',
      title: 'Create Atlases',
      description: 'If enabled, when a texture is imported it will be converted to a Texture Atlas asset instead of a Texture asset.'
  }, {
      name: 'asset-tasks:searchRelatedAssets',
      title: 'Search related assets',
      description: 'If enabled, importing a source asset will update target assets where ever they are located. If disabled, assets will only be updated if they are in the same folder, otherwise new assets will be created.'
  }, {
      name: 'asset-tasks:preserveMapping',
      title: 'Preserve model material mappings',
      description: 'If enabled, after importing an existing source model we will try to preserve the material mappings that were set by the user on the existing model.'
  }, {
      name: 'asset-tasks:useModelV2',
      title: 'Force legacy model v2',
      description: 'Create model assets in legacy format (V2). Enable this for compatibility with older model imports.'
  }, {
      name: 'asset-tasks:overwrite:model',
      title: 'Overwrite models',
      description: 'When a model is imported, overwrite a previously imported model asset.'
  }, {
      name: 'asset-tasks:overwrite:animation',
      title: 'Overwrite animations',
      description: 'When a model is imported, overwrite previously imported animation assets.'
  }, {
      name: 'asset-tasks:overwrite:material',
      title: 'Overwrite materials',
      description: 'When a model is imported, overwrite previously imported material assets.'
  }, {
      name: 'asset-tasks:overwrite:texture',
      title: 'Overwrite textures',
      description: 'When a model is imported, overwrite previously imported texture assets.'
  }, {
      title: 'lightmapSizeMultiplier',
      subTitle: '{Number}',
      description: 'Auto-generated lightmap textures resolution is calculated using area of geometry in world space and size multiplier of model and scene. Changing this value will affect resolution of lightmaps for whole scene.',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#lightmapSizeMultiplier'
  }, {
      title: 'lightmapMaxResolution',
      subTitle: '{Number}',
      description: 'Maximum resolution for auto-generated lightmap textures.',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#lightmapMaxResolution'
  }, {
      title: 'lightmapMode',
      subTitle: '{Number}',
      description: 'The lightmap baking mode. Can be "Color Only" for just a single color lightmap or "Color and Direction" for single color plus dominant light direction (used for bump/specular).',
      url: 'http://developer.playcanvas.com/api/pc.Scene.html#lightmapMode'
  }, {
      name: 'batchGroups',
      title: 'Batch Groups',
      description: 'Manage batch groups for this project. Batch groups allow you to reduce draw calls by batching similar Models and Elements together.'
  }, {
      name: 'batchGroups:name',
      title: 'name',
      subTitle: '{String}',
      description: 'The name of the batch group'
  }, {
      name: 'batchGroups:dynamic',
      title: 'dynamic',
      subTitle: '{Boolean}',
      description: 'Enable this if you want to allow objects in this batch group to move/rotate/scale after being batched. If your objects are completely static then disable this field.'
  }, {
      name: 'batchGroups:maxAabbSize',
      title: 'maxAabbSize',
      subTitle: '{Number}',
      description: 'The maximum size of any dimension of a bounding box around batched objects. A larger size will batch more objects generating less draw calls but the batched objects will be larger and harder for the camera to cull. A smaller size will generate more draw calls (but less than without batching) but the resulting objects will be easier for the camera to cull.'
  }, {
      name: 'layers',
      title: 'Layers',
      description: 'Manage rendering Layers and their render order.'
  }, {
      name: 'layers:name',
      title: 'name',
      subTitle: '{String}',
      description: 'The name of the layer',
      url: 'http://developer.playcanvas.com/api/pc.Layer.html#name'
  }, {
      name: 'layers:opaqueSort',
      title: 'opaqueSortMode',
      subTitle: '{Number}',
      description: 'Defines the method used for sorting opaque mesh instances before rendering.',
      url: 'http://developer.playcanvas.com/api/pc.Layer.html#opaqueSortMode'
  }, {
      name: 'layers:transparentSort',
      title: 'transparentSortMode',
      subTitle: '{Number}',
      description: 'Defines the method used for sorting semi-transparent mesh instances before rendering.',
      url: 'http://developer.playcanvas.com/api/pc.Layer.html#transparentSortMode'
  }, {
      name: 'layers:order',
      title: 'Render Order',
      description: 'Manage the order of the rendering layers.'
  }, {
      name: 'layers:sublayers:opaque',
      title: 'Opaque Part',
      description: 'This is the part of the layer that renders the opaque mesh instances that belong to this layer.'
  }, {
      name: 'layers:sublayers:transparent',
      title: 'Transparent Part',
      description: 'This is the part of the layer that renders the semi-transparent mesh instances that belong to this layer.'
  }, {
      name: 'layers:sublayers:enabled',
      title: 'Enabled',
      description: 'Enables or disables this part of the layer. When a part is disabled the mesh instances of that part will not be rendered.'
  }, {
      name: 'localization:i18nAssets',
      title: 'Localization Assets',
      description: 'JSON Assets that contain localization data. Assets in this list will automatically be parsed for localization data when loaded. These are used to localized your Text Elements.'
  }, {
      name: 'localization:createAsset',
      description: 'Creates a new Localization JSON Asset with the default en-US format.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'settings:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-sprite-editor-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'atlas:width',
      title: 'width',
      subTitle: '{Number}',
      description: 'The width of the texture atlas in pixels.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#width'
  }, {
      name: 'atlas:height',
      title: 'height',
      subTitle: '{Number}',
      description: 'The height of the texture atlas in pixels.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#height'
  }, {
      name: 'atlas:frames',
      title: 'Frames',
      description: 'The number of frames in the texture atlas. Each frame defines a region in the atlas.'
  }, {
      name: 'generate:method',
      title: 'METHOD',
      description: '"Delete Existing" will delete all frames from the texture atlas first and then create new frames. "Only Append" will append the new frames to the texture atlas without deleting the old ones.'
  }, {
      name: 'generate:type',
      title: 'TYPE',
      description: '"Grid By Frame Count" will create a grid of frames using the specified number of columns and rows. "Grid By Frame Size" will create a grid of frames using the specified frame size. Frames will only be created in areas of the atlas that are not completely transparent.'
  }, {
      name: 'generate:count',
      title: 'Frame Count',
      description: 'The number of columns and rows in the texture atlas.'
  }, {
      name: 'generate:size',
      title: 'Frame Size',
      description: 'The size of each frame in pixels.'
  }, {
      name: 'generate:offset',
      title: 'Offset',
      description: 'The offset from the top-left of the texture atlas in pixels, from where to start generating frames.'
  }, {
      name: 'generate:spacing',
      title: 'Spacing',
      description: 'The spacing between each frame in pixels.'
  }, {
      name: 'generate:pivot',
      title: 'Pivot',
      description: 'The pivot to use for each new frame.'
  }, {
      name: 'generate:generate',
      title: 'generate Atlas',
      description: 'Create new frames and add them to the atlas based on the method chosen above.'
  }, {
      name: 'generate:clear',
      title: 'Delete All Frames',
      description: 'Delete all frames from the texture atlas.'
  }, {
      name: 'import:texturepacker',
      title: 'Click here to upload a JSON file that has been created with the Texture Packer application. PlayCanvas will create new frames for your texture atlas based on that JSON file.'
  }, {
      name: 'sprites:addFrames',
      title: 'Add Frames',
      description: 'Add frames to this Sprite Asset. Click to start selecting the frames you want to add.'
  }, {
      name: 'frame:name',
      title: 'Name',
      description: 'The name of the frame(s).'
  }, {
      name: 'frame:position',
      title: 'Position',
      description: 'The left / bottom coordinates of the frame(s) in pixels.'
  }, {
      name: 'frame:size',
      title: 'Size',
      description: 'The size of the frame(s) in pixels.'
  }, {
      name: 'frame:pivotPreset',
      title: 'Pivot Preset',
      description: 'Presets for the pivot of the frame(s).'
  }, {
      name: 'frame:pivot',
      title: 'Pivot',
      description: 'The pivot of the frame(s) in 0-1 units starting from the left / bottom coordinates of the frame(s).'
  }, {
      name: 'frame:border',
      title: 'Border',
      description: 'The border of the frame(s) in pixels when using 9 Slicing. Each field specifies the distance from the left / bottom / right / top edges of the frame(s) respectively.'
  }, {
      name: 'frame:newsprite',
      title: 'New Sprite',
      description: 'Create a new Sprite Asset with the selected frames.'
  }, {
      name: 'frame:focus',
      title: 'Focus',
      subTitle: 'Shortcut: F',
      description: 'Focus on the selected frame.'
  }, {
      name: 'frame:trim',
      title: 'Trim',
      subTitle: 'Shortcut: T',
      description: 'Resize the selected frames so that they fit around the edge of the graphic based on transparency.'
  }, {
      name: 'frame:delete',
      subTitle: 'Shortcut: Delete',
      title: 'Delete',
      description: 'Delete the selected frames.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'spriteeditor:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-entity-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      title: 'enabled',
      subTitle: '{Boolean}',
      description: 'If unchecked, entity wont be processed nor any of its components.',
      url: 'http://developer.playcanvas.com/api/pc.Entity.html'
  }, {
      title: 'name',
      subTitle: '{String}',
      description: 'Human-readable name for this graph node.',
      url: 'http://developer.playcanvas.com/api/pc.Entity.html#name'
  }, {
      title: 'tags',
      subTitle: '{pc.Tags}',
      description: '',
      url: 'http://developer.playcanvas.com/api/pc.Entity.html#tags'
  }, {
      title: 'position',
      subTitle: '{pc.Vec3}',
      description: 'Position in Local Space',
      url: 'http://developer.playcanvas.com/api/pc.Entity.html'
  }, {
      title: 'rotation',
      subTitle: '{pc.Vec3}',
      description: 'Rotation in Local Space',
      url: 'http://developer.playcanvas.com/api/pc.Entity.html'
  }, {
      title: 'scale',
      subTitle: '{pc.Vec3}',
      description: 'Scale in Local Space',
      url: 'http://developer.playcanvas.com/api/pc.Entity.html'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'entity:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-animation-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.AnimationComponent',
      subTitle: '{pc.Component}',
      description: 'Enables an entity to specify which animations can be applied to the model assigned to its model component.',
      url: 'http://developer.playcanvas.com/api/pc.AnimationComponent.html'
  }, {
      title: 'assets',
      subTitle: '{Number[]}',
      description: 'The animation assets that can be utilized by this entity. Multiple animations can be assigned via the picker control.',
      url: 'http://developer.playcanvas.com/api/pc.AnimationComponent.html#assets'
  }, {
      title: 'speed',
      subTitle: '{Number}',
      description: 'A multiplier for animation playback speed. 0 will freeze animation playback, and 1 represents the normal playback speed of the asset.',
      url: 'http://developer.playcanvas.com/api/pc.AnimationComponent.html#speed'
  }, {
      title: 'activate',
      subTitle: '{Boolean}',
      description: 'If checked, the component will start playing the animation on load.',
      url: 'http://developer.playcanvas.com/api/pc.AnimationComponent.html#activate'
  }, {
      title: 'loop',
      subTitle: '{Boolean}',
      description: 'If checked, the animation will continue to loop back to the start on completion. Otherwise, the animation will come to a stop on its final frame.',
      url: 'http://developer.playcanvas.com/api/pc.AnimationComponent.html#loop'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'animation:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-audiolistener-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.AudioListenerComponent',
      subTitle: '{pc.Component}',
      description: 'Specifies the listener\'s position in 3D space. All 3D audio playback will be relative to this position.',
      url: 'http://developer.playcanvas.com/api/pc.AudioListenerComponent.html'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'audiolistener:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-audiosource-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.AudioSourceComponent',
      subTitle: '{pc.Component}',
      description: 'The AudioSource Component controls playback of an audio sample. This class will be deprecated in favor of {@link pc.SoundComponent}.',
      url: 'http://developer.playcanvas.com/api/pc.AudioSourceComponent.html'
  }, {
      title: '3d',
      subTitle: '{Boolean}',
      description: 'If checked, the component will play back audio assets as if played from the location of the entity in 3D space.',
      url: 'http://developer.playcanvas.com/api/pc.AudioSourceComponent.html#3d'
  }, {
      title: 'activate',
      subTitle: '{Boolean}',
      description: 'If checked, the first audio asset specified by the Assets property will be played on load. Otherwise, audio assets will need to be played using script.',
      url: 'http://developer.playcanvas.com/api/pc.AudioSourceComponent.html#activate'
  }, {
      title: 'assets',
      subTitle: '{Number[]}',
      description: 'The audio assets that can be played from this audio source. Multiple audio assets can be specified by the picker control.',
      url: 'http://developer.playcanvas.com/api/pc.AudioSourceComponent.html#assets'
  }, {
      title: 'loop',
      subTitle: '{Boolean}',
      description: 'If checked, the component will loop played audio assets continuously. Otherwise, audio assets are played once to completion.',
      url: 'http://developer.playcanvas.com/api/pc.AudioSourceComponent.html#loop'
  }, {
      title: 'distance',
      subTitle: '{Number}',
      description: 'minDistance - the distance at which the volume of playback begins to fall from its maximum. maxDistance - The distance at which the volume of playback falls to zero.',
      url: 'http://developer.playcanvas.com/api/pc.AudioSourceComponent.html#maxDistance'
  }, {
      title: 'pitch',
      subTitle: '{Number}',
      description: 'The pitch to playback the audio at. A value of 1 means the audio is played back at the original pitch.',
      url: 'http://developer.playcanvas.com/api/pc.AudioSourceComponent.html#pitch'
  }, {
      title: 'rollOffFactor',
      subTitle: '{Number}',
      description: 'The rate at which volume fall-off occurs.',
      url: 'http://developer.playcanvas.com/api/pc.AudioSourceComponent.html#rollOffFactor'
  }, {
      title: 'volume',
      subTitle: '{Number}',
      description: 'The volume of the audio assets played back by the component.',
      url: 'http://developer.playcanvas.com/api/pc.AudioSourceComponent.html#volume'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'audiosource:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }

  editor.call('attributes:reference:add', {
      name: 'audio:assets',
      title: 'assets',
      subTitle: '{Number[]}',
      description: 'The audio assets that can be played from this audio source. Multiple audio assets can be specified by the picker control.',
      url: 'http://developer.playcanvas.com/api/pc.AudioSourceComponent.html#assets'
  });
});


/* editor/attributes/reference/attributes-components-sound-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'sound',
      title: 'pc.SoundComponent',
      subTitle: '{pc.Component}',
      description: 'The Sound Component controls playback of sounds',
      url: 'http://developer.playcanvas.com/api/pc.SoundComponent.html'
  }, {
      title: 'positional',
      subTitle: '{Boolean}',
      description: 'If checked, the component will play back audio assets as if played from the location of the entity in 3D space.',
      url: 'http://developer.playcanvas.com/api/pc.SoundComponent.html#positional'
  }, {
      title: 'distance',
      subTitle: '{Number}',
      description: "refDistance - The reference distance for reducing volume as the sound source moves further from the listener. maxDistance - The maximum distance from the listener at which audio falloff stops. Note the volume of the audio is not 0 after this distance, but just doesn't fall off anymore.",
      url: 'http://developer.playcanvas.com/api/pc.SoundComponent.html#refDistance'
  }, {
      title: 'pitch',
      subTitle: '{Number}',
      description: 'The pitch to playback the audio at. A value of 1 means the audio is played back at the original pitch. The pitch of each slot is multiplied with this value.',
      url: 'http://developer.playcanvas.com/api/pc.SoundComponent.html#pitch'
  }, {
      title: 'rollOffFactor',
      subTitle: '{Number}',
      description: 'The rate at which volume fall-off occurs.',
      url: 'http://developer.playcanvas.com/api/pc.SoundComponent.html#rollOffFactor'
  }, {
      title: 'volume',
      subTitle: '{Number}',
      description: 'The volume modifier to play the audio with. The volume of each slot is multiplied with this value.',
      url: 'http://developer.playcanvas.com/api/pc.SoundComponent.html#volume'
  }, {
      title: 'distanceModel',
      subTitle: '{String}',
      description: 'Determines which algorithm to use to reduce the volume of the audio as it moves away from the listener.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'sound:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-soundslot-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'slot',
      title: 'pc.SoundSlot',
      description: 'The SoundSlot controls playback of an audio asset.',
      url: 'http://developer.playcanvas.com/api/pc.SoundSlot.html'
  }, {
      title: 'name',
      subTitle: '{String}',
      description: 'The name of the slot',
      url: 'http://developer.playcanvas.com/api/pc.SoundSlot.html#name'
  }, {
      title: 'startTime',
      subTitle: '{Number}',
      description: 'The start time from which the sound will start playing.',
      url: 'http://developer.playcanvas.com/api/pc.SoundSlot.html#startTime'
  }, {
      title: 'duration',
      subTitle: '{String}',
      description: 'The duration of the sound that the slot will play starting from startTime.',
      url: 'http://developer.playcanvas.com/api/pc.SoundSlot.html#duration'
  }, {
      title: 'autoPlay',
      subTitle: '{Boolean}',
      description: 'If checked, the slot will be played on load. Otherwise, sound slots will need to be played by scripts.',
      url: 'http://developer.playcanvas.com/api/pc.SoundSlot.html#autoPlay'
  }, {
      title: 'overlap',
      subTitle: '{Boolean}',
      description: 'If true then sounds played from slot will be played independently of each other. Otherwise the slot will first stop the current sound before starting the new one.',
      url: 'http://developer.playcanvas.com/api/pc.SoundSlot.html#overlap'
  }, {
      title: 'asset',
      subTitle: '{Number}',
      description: 'The audio asset that can be played from this sound slot.',
      url: 'http://developer.playcanvas.com/api/pc.SoundSlot.html#asset'
  }, {
      title: 'loop',
      subTitle: '{Boolean}',
      description: 'If checked, the slot will loop playback continuously. Otherwise, it will be played once to completion.',
      url: 'http://developer.playcanvas.com/api/pc.SoundSlot.html#loop'
  }, {
      title: 'pitch',
      subTitle: '{Number}',
      description: 'The pitch to playback the audio at. A value of 1 means the audio is played back at the original pitch.',
      url: 'http://developer.playcanvas.com/api/pc.SoundComponent.html#pitch'
  }, {
      title: 'volume',
      subTitle: '{Number}',
      description: 'The volume modifier to play the audio with.',
      url: 'http://developer.playcanvas.com/api/pc.SoundComponent.html#volume'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'sound:slot:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-camera-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.CameraComponent',
      subTitle: '{pc.Component}',
      description: 'Enables an entity to render a scene from a certain viewpoint.',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html'
  }, {
      title: 'clearColor',
      subTitle: '{pc.Color}',
      description: 'The color used to clear the camera\'s render target.',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html#clearColor'
  }, {
      title: 'clearColorBuffer',
      subTitle: '{Boolean}',
      description: 'If selected, the camera will explicitly clear its render target to the chosen clear color before rendering the scene.',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html#clearColorBuffer'
  }, {
      title: 'clearDepthBuffer',
      subTitle: '{Boolean}',
      description: 'If selected, the camera will explicitly clear the depth buffer of its render target before rendering the scene.',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html#clearDepthBuffer'
  }, {
      name: 'clip',
      title: 'nearClip / farClip',
      subTitle: '{Number}',
      description: 'The distance in camera space from the camera\'s eye point to the near and far clip planes.',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html#farClip'
  }, {
      title: 'fov',
      subTitle: '{Number}',
      description: 'Field of View is the angle between top and bottom clip planes of a perspective camera.',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html#fov'
  }, {
      title: 'frustumCulling',
      subTitle: '{Boolean}',
      description: 'Controls the culling of mesh instances against the camera frustum. If true, culling is enabled. If false, all mesh instances in the scene are rendered by the camera, regardless of visibility. Defaults to false.',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html#frustumCulling'
  }, {
      title: 'orthoHeight',
      subTitle: '{Number}',
      description: 'The distance in world units between the top and bottom clip planes of an orthographic camera.',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html#orthoHeight'
  }, {
      title: 'priority',
      subTitle: '{Number}',
      description: 'A number that defines the order in which camera views are rendered by the engine. Smaller numbers are rendered first.',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html#priority'
  }, {
      title: 'projection',
      subTitle: '{pc.PROJECTION_*}',
      description: 'The projection type of the camera.',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html#projection'
  }, {
      title: 'rect',
      subTitle: '{pc.Vec4}',
      description: 'A rectangle that specifies the viewport onto the camera\'s attached render target. This allows you to implement features like split-screen or picture-in-picture. It is defined by normalised coordinates (0 to 1) in the following format: x: The lower left x coordinate y: The lower left y coordinate w: The width of the rectangle h: The height of the rectangle',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html#rect'
  }, {
      name: 'layers',
      title: 'layers',
      subTitle: '{Number[]}',
      description: 'The layers that this camera will render.',
      url: 'http://developer.playcanvas.com/api/pc.CameraComponent.html#layers'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'camera:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-collision-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.CollisionComponent',
      subTitle: '{pc.Component}',
      description: 'A collision volume. use this in conjunction with a pc.RigidBodyComponent to make a collision volume that can be simulated using the physics engine. If the pc.Entity does not have a pc.RigidBodyComponent then this collision volume will act as a trigger volume. When an entity with a dynamic or kinematic body enters or leaves an entity with a trigger volume, both entities will receive trigger events.',
      url: 'http://developer.playcanvas.com/api/pc.CollisionComponent.html'
  }, {
      title: 'asset',
      subTitle: '{Number}',
      description: 'The model asset that will be used as a source for the triangle-based collision mesh.',
      url: 'http://developer.playcanvas.com/api/pc.CollisionComponent.html#asset'
  }, {
      title: 'axis',
      subTitle: '{Number}',
      description: 'Aligns the capsule/cylinder with the local-space X, Y or Z axis of the entity',
      url: 'http://developer.playcanvas.com/api/pc.CollisionComponent.html#axis'
  }, {
      title: 'halfExtents',
      subTitle: '{pc.Vec3}',
      description: 'The half-extents of the collision box. This is a 3-dimensional vector: local space half-width, half-height, and half-depth.',
      url: 'http://developer.playcanvas.com/api/pc.CollisionComponent.html#halfExtents'
  }, {
      title: 'height',
      subTitle: '{Number}',
      description: 'The tip-to-tip height of the capsule/cylinder.',
      url: 'http://developer.playcanvas.com/api/pc.CollisionComponent.html#height'
  }, {
      title: 'radius',
      subTitle: '{Number}',
      description: 'The radius of the capsule/cylinder body.',
      url: 'http://developer.playcanvas.com/api/pc.CollisionComponent.html#radius'
  }, {
      title: 'type',
      subTitle: '{String}',
      description: 'The type of collision primitive. Can be: box, sphere, capsulse, cylinder, mesh.',
      url: 'http://developer.playcanvas.com/api/pc.CollisionComponent.html#type'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'collision:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-light-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.LightComponent',
      subTitle: '{pc.Component}',
      description: 'The Light Component enables the Entity to light the scene.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html'
  }, {
      title: 'isStatic',
      subTitle: '{Boolean}',
      description: 'Mark light as non-movable (optimization).',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#isStatic'
  }, {
      title: 'castShadows',
      subTitle: '{Boolean}',
      description: 'If checked, the light will cause shadow casting models to cast shadows.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#castShadows'
  }, {
      title: 'color',
      subTitle: '{pc.Color}',
      description: 'The color of the emitted light.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#color'
  }, {
      title: 'falloffMode',
      subTitle: '{pc.LIGHTFALLOFF_*}',
      description: 'Controls the rate at which a light attentuates from its position.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#falloffMode'
  }, {
      title: 'coneAngles',
      subTitle: '{Number}',
      description: 'The angles from the spotlight\'s direction at which light begins to fall from its maximum (innerConeAngle) and zero value (outerConeAngle).',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#innerConeAngle'
  }, {
      title: 'intensity',
      subTitle: '{Number}',
      description: 'The intensity of the light, this acts as a scalar value for the light\'s color. This value can exceed 1.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#intensity'
  }, {
      title: 'normalOffsetBias',
      subTitle: '{Number}',
      description: 'Normal offset depth bias.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#normalOffsetBias'
  }, {
      title: 'range',
      subTitle: '{Number}',
      description: 'The distance from the spotlight source at which its contribution falls to zero.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#range'
  }, {
      title: 'shadowBias',
      subTitle: '{Number}',
      description: 'Constant depth offset applied to a shadow map that enables the tuning of shadows in order to eliminate rendering artifacts, namely \'shadow acne\' and \'peter-panning\'.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#shadowBias'
  }, {
      title: 'shadowDistance',
      subTitle: '{Number}',
      description: 'The shadow distance is the maximum distance from the camera beyond which shadows that come from Directional Lights are no longer visible. Smaller values produce more detailed shadows. The closer the limit the less shadow data has to be mapped to, and represented by, any shadow map; shadow map pixels are mapped spatially and so the less distance the shadow map has to cover, the smaller the pixels and so the more resolution any shadow has.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#shadowDistance'
  }, {
      title: 'shadowResolution',
      subTitle: '{Number}',
      description: 'The size of the texture used for the shadow map.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#shadowResolution'
  },{
      title: 'type',
      subTitle: '{String}',
      description: 'The type of light. Can be: directional, point, spot.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#type'
  }, {
      title: 'affectDynamic',
      subTitle: '{Boolean}',
      description: 'If enabled the light will affect non-lightmapped objects.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#affectDynamic'
  }, {
      title: 'affectLightmapped',
      subTitle: '{Boolean}',
      description: 'If enabled the light will affect lightmapped objects.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#affectLightmapped'
  }, {
      title: 'bake',
      subTitle: '{Boolean}',
      description: 'If enabled the light will be rendered into lightmaps.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#bake'
  }, {
      title: 'bakeDir',
      subTitle: '{Boolean}',
      description: 'If enabled and bake=true, the light\'s direction will contribute to directional lightmaps.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#bakeDir'
  }, {
      title: 'shadowUpdateMode',
      subTitle: '{pc.SHADOWUPDATE_*}',
      description: 'Tells the renderer how often shadows must be updated for this light. Options:\n<b>pc.SHADOWUPDATE_NONE</b>: Don\'t render shadows.\n<b>pc.SHADOWUPDATE_THISFRAME</b>: Render shadows only once (then automatically switches to pc.SHADOWUPDATE_NONE).\n<b>pc.SHADOWUPDATE_REALTIME</b>: Render shadows every frame (default)',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#shadowUpdateMode'
  }, {
      title: 'shadowType',
      subTitle: '{pc.SHADOW_*}',
      description: 'Type of shadows being rendered by this light. Options:\n<b>pc.SHADOW_PCF3</b>: Render packed depth, can be used for PCF sampling.\n<b>pc.SHADOW_PCF5</b>: Render depth buffer only, can be used for better hardware-accelerated PCF sampling. Requires WebGL2. Falls back to pc.SHADOW_PCF3 on WebGL 1.0.\n<b>pc.SHADOW_VSM8</b>: Render packed variance shadow map. All shadow receivers must also cast shadows for this mode to work correctly.\n<b>pc.SHADOW_VSM16</b>: Render 16-bit exponential variance shadow map. Requires OES_texture_half_float extension. Falls back to pc.SHADOW_VSM8, if not supported.\n<b>pc.SHADOW_VSM32</b>: Render 32-bit exponential variance shadow map. Requires OES_texture_float extension. Falls back to pc.SHADOW_VSM16, if not supported.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#shadowType'
  }, {
      title: 'vsmBlurMode',
      subTitle: '{pc.BLUR_*}',
      description: 'Blurring mode for variance shadow maps:\n<b>pc.BLUR_BOX</b>: Box filter.\n<b>pc.BLUR_GAUSSIAN</b>: Gaussian filter. May look smoother than box, but requires more samples.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#vsmBlurMode'
  }, {
      title: 'vsmBlurSize',
      subTitle: '{Number}',
      description: 'Number of samples used for blurring a variance shadow map. Only uneven numbers work, even are incremented. Minimum value is 1, maximum is 25',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#vsmBlurSize'
  }, {
      title: 'vsmBias',
      subTitle: '{Number}',
      description: 'Constant depth offset applied to a shadow map that enables the tuning of shadows in order to eliminate rendering artifacts, namely \'shadow acne\' and \'peter-panning\'',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#vsmBias'
  }, {
      title: 'cookie',
      subTitle: '{pc.Texture}',
      description: 'Projection texture. Must be 2D for spot and cubemap for point (ignored if incorrect type is used).',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#cookie'
  }, {
      title: 'cookieAsset',
      subTitle: '{pc.Asset}',
      description: 'Asset that has texture that will be assigned to cookie internally once asset resource is available.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#cookieAsset'
  }, {
      title: 'cookieIntensity',
      subTitle: '{Number}',
      description: 'Projection texture intensity.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#cookieIntensity'
  }, {
      title: 'cookieFalloff',
      subTitle: '{Boolean}',
      description: 'Toggle normal spotlight falloff when projection texture is used. When set to false, spotlight will work like a pure texture projector (only fading with distance)',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#cookieFalloff'
  }, {
      title: 'cookieChannel',
      subTitle: '{String}',
      description: 'Color channels of the projection texture to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#cookieChannel'
  }, {
      title: 'cookieAngle',
      subTitle: '{Number}',
      description: 'Angle for spotlight cookie rotation.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#cookieAngle'
  }, {
      title: 'cookieOffset',
      subTitle: '{pc.Vec2}',
      description: 'Spotlight cookie position offset.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#cookieOffset'
  }, {
      title: 'cookieScale',
      subTitle: '{pc.Vec2}',
      description: 'Spotlight cookie scale.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#cookieScale'
  }, {
      name: 'layers',
      title: 'layers',
      subTitle: '{Number[]}',
      description: 'The layers that this light will affect.',
      url: 'http://developer.playcanvas.com/api/pc.LightComponent.html#layers'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'light:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-model-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.ModelComponent',
      subTitle: '{pc.Component}',
      description: 'Enables an Entity to render a model or a primitive shape. This Component attaches additional model geometry in to the scene graph below the Entity.',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html'
  }, {
      title: 'isStatic',
      subTitle: '{Boolean}',
      description: 'Mark model as non-movable (optimization).',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html#isStatic'
  }, {
      title: 'asset',
      subTitle: '{Number}',
      description: 'The model asset rendered by this model component. Only a single model can be rendered per model component.',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html#asset'
  }, {
      title: 'castShadows',
      subTitle: '{Boolean}',
      description: 'If enabled, the model rendered by this component will cast shadows onto other models in the scene.',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html#castShadows'
  }, {
      title: 'materialAsset',
      subTitle: '{Number}',
      description: 'The material that will be used to render the model (only applies to primitives)',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html#materialAsset'
  }, {
      title: 'receiveShadows',
      subTitle: '{Boolean}',
      description: 'If enabled, the model rendered by this component will receive shadows cast by other models in the scene.',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html#receiveShadows'
  }, {
      title: 'type',
      subTitle: '{String}',
      description: 'The type of the model to be rendered. Can be: asset, box, capsule, cone, cylinder, sphere.',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html#type'
  }, {
      title: 'castShadowsLightmap',
      subTitle: '{Boolean}',
      description: 'If true, this model will cast shadows when rendering lightmaps',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html#castShadowsLightmap'
  }, {
      title: 'lightmapped',
      subTitle: '{Boolean}',
      description: 'If true, this model will be lightmapped after using lightmapper.bake()',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html#lightmapped'
  }, {
      title: 'lightmapSizeMultiplier',
      subTitle: '{Number}',
      description: 'Changing this value will affect resolution of lightmaps for this model',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html#lightmapSizeMultiplier'
  }, {
      title: 'batchGroupId',
      subTitle: '{Number}',
      description: 'The batch group that this model belongs to. The engine will attempt to batch models in the same batch group to reduce draw calls.',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html#batchGroupId'
  }, {
      name: 'resolution',
      description: 'Auto-generated lightmap textures resolution is calculated using area of geometry in world space and size multiplier of model and scene.',
      url: 'http://developer.playcanvas.com/en/user-manual/graphics/lighting/lightmaps/#lightmap-size-multipliers'
  }, {
      name: 'layers',
      title: 'layers',
      subTitle: '{Number[]}',
      description: 'The layers that this model belongs to. When a model belongs to multiple layers it will be rendered multiple times.',
      url: 'http://developer.playcanvas.com/api/pc.ModelComponent.html#layers'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'model:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-particlesystem-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.ParticleSystemComponent',
      subTitle: '{pc.Component}',
      description: 'Used to simulate particles and produce renderable particle mesh in scene.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html'
  }, {
      title: 'autoPlay',
      subTitle: '{Boolean}',
      description: 'If checked, the particle system will play immediately on creation. If this option is left unchecked, you will need to call the particle system component\'s play function from script.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#autoPlay'
  }, {
      title: 'alignToMotion',
      subTitle: '{Boolean}',
      description: 'Orient particle in their direction of motion.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#alignToMotion'
  }, {
      title: 'alphaGraph',
      subTitle: '{pc.Curve}',
      description: 'A curve defining how each particle\'s opacity changes over time. If two curves are specified in the curve editor, the opacity will be a random lerp between both curves.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#alphaGraph'
  }, {
      title: 'animTilesX',
      subTitle: '{Number}',
      description: 'Number of horizontal tiles in the sprite sheet',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#animTilesX'
  }, {
      title: 'animTilesY',
      subTitle: '{Number}',
      description: 'Number of vertical tiles in the sprite sheet',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#animTilesY'
  }, {
      title: 'animNumFrames',
      subTitle: '{Number}',
      description: 'Number of sprite sheet frames to play',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#animNumFrames'
  }, {
      title: 'animSpeed',
      subTitle: '{Number}',
      description: 'Sprite sheet animation speed. 1 = particle lifetime, 2 = twice during lifetime etc...',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#animSpeed'
  }, {
      title: 'animLoop',
      subTitle: '{Boolean}',
      description: 'If true then the sprite sheet animation will repeat indefinitely',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#animLoop'
  }, {
      title: 'blend',
      subTitle: '{pc.BLEND_*}',
      description: 'The blending mode determines how particles are composited when they are written to the frame buffer. Let\'s consider that Prgb is the RGB color of a particle\'s pixel, Pa is its alpha value, and Drgb is the RGB color already in the frame buffer.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#blend'
  }, {
      title: 'colorGraph',
      subTitle: '{pc.CurveSet}',
      description: 'A curve defining how each particle\'s color changes over time.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#colorGraph'
  }, {
      title: 'colorMap',
      subTitle: '{pc.Texture}',
      description: 'The color map texture to apply to all particles in the system. If no texture asset is assigned, a default spot texture is used.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#colorMap'
  }, {
      title: 'orientation',
      subTitle: '{pc.PARTICLEORIENTATION_*}',
      description: 'Orientation mode controls particle planes facing. The options are: Screen: Particles are facing camera. World Normal: User defines world space normal to set planes orientation. Emitter Normal: Similar to previous, but the normal is affected by emitter(entity) transformation.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#orientation'
  }, {
      title: 'particleNormal',
      subTitle: '{pc.Vec3}',
      description: 'Either world or emitter space vector to define particle plane orientation.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#particleNormal'
  }, {
      title: 'depthSoftening',
      subTitle: '{Number}',
      description: 'This variable value determines how much particles fade out as they get closer to another surface. This avoids the situation where particles appear to cut into surfaces.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#depthSoftening'
  }, {
      title: 'depthWrite',
      subTitle: '{Boolean}',
      description: 'If checked, the particles will write depth information to the depth buffer. If unchecked, the depth buffer is left unchanged and particles will be guaranteed to overwrite one another in the order in which they are rendered.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#depthWrite'
  }, {
      title: 'emitterExtents',
      subTitle: '{pc.Vec3}',
      description: 'The half extents of a local space bounding box within which particles are spawned at random positions.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#emitterExtents'
  }, {
      title: 'emitterExtentsInner',
      subTitle: '{pc.Vec3}',
      description: 'The exception volume of a local space bounding box within which particles are not spawned.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#emitterExtents'
  }, {
      title: 'emitterRadius',
      subTitle: '{Number}',
      description: 'The radius within which particles are spawned at random positions.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#emitterRadius'
  }, {
      title: 'emitterRadiusInner',
      subTitle: '{Number}',
      description: 'The inner sphere radius within which particles are not spawned',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#emitterRadius'
  }, {
      title: 'emitterShape',
      subTitle: '{pc.EMITTERSHAPE_*}',
      description: 'Shape of the emitter. Can be: pc.EMITTERSHAPE_BOX, pc.EMITTERSHAPE_SPHERE.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#emitterShape'
  }, {
      title: 'halfLambert',
      subTitle: '{Boolean}',
      description: 'Enabling Half Lambert lighting avoids particles looking too flat when lights appear to be shining towards the back sides of the particles. It is a completely non-physical lighting model but can give more pleasing visual results. This option is only available when Lighting is enabled.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#halfLambert'
  }, {
      title: 'intensity',
      subTitle: '{Number}',
      description: 'Scales the color of particles to allow them to have arbitrary brightness.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#intensity'
  }, {
      title: 'lifetime',
      subTitle: '{Number}',
      description: 'The length of time in seconds between a particle\'s birth and its death.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#lifetime'
  }, {
      title: 'lighting',
      subTitle: '{Boolean}',
      description: 'If checked, the particle will be lit by the directional and ambient light in the scene. In some circumstances, it may be advisable to set a normal map on the particle system in order to achieve more realistic lighting.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#lighting'
  }, {
      title: 'localVelocityGraph',
      subTitle: '{pc.CurveSet}',
      description: 'A curve defining how each particle\'s velocity with respect to the particle system\'s local coordinate system changes over time. If two curves are specified in the curve editor, local velocity will be a random lerp between both curves.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#localVelocityGraph'
  }, {
      title: 'loop',
      subTitle: '{Boolean}',
      description: 'If checked, the particle system will emit indefinitely. Otherwise, it will emit the number of particles specified by the \'Particle Count\' property and then stop.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#loop'
  }, {
      title: 'mesh',
      subTitle: '{pc.Mesh}',
      description: 'A model asset. The first mesh found in the model is used to represent all particles rather than a flat billboard.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#mesh'
  }, {
      title: 'normalMap',
      subTitle: '{pc.Texture}',
      description: 'The normal map texture to apply to all particles in the system. Applying a normal map can make billboard particles appear more consistent with the scenes lighting.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#normalMap'
  }, {
      title: 'numParticles',
      subTitle: '{Number}',
      description: 'The maximum number of particles managed by this particle system.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#numParticles'
  }, {
      title: 'paused',
      subTitle: '{Boolean}',
      description: 'Pauses or unpauses the simulation.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#paused'
  }, {
      title: 'preWarm',
      subTitle: '{Boolean}',
      description: 'If enabled, the particle system will be initialized as though it had already completed a full cycle. This option is only available for looping particle systems.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#preWarm'
  }, {
      title: 'rate',
      subTitle: '{Number}',
      description: 'The bounds of the time range defining the interval in seconds between particle births. The time for the next particle emission will be chosen at random between rate and rate2.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#rate'
  }, {
      title: 'localSpace',
      subTitle: '{Boolean}',
      description: 'Binds particles to emitter node transformation.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#localSpace'
  }, {
      title: 'rotationSpeedGraph',
      subTitle: '{pc.Curve}',
      description: 'A curve defining how each particle\'s angular velocity changes over time. If two curves are specified in the curve editor, the angular velocity will be a random lerp between both curves.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#rotationSpeedGraph'
  }, {
      title: 'scaleGraph',
      subTitle: '{pc.Curve}',
      description: 'A curve defining how each particle\'s scale changes over time. By default, a particle is 1 unit in width and height. If two curves are specified in the curve editor, the scale will be a random lerp between both curves.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#scaleGraph'
  }, {
      title: 'radialSpeedGraph',
      subTitle: '{pc.Curve}',
      description: 'A curve defining how particle\'s radial speed changes over time. Individual particle radial velocity points from emitter origin to particle current position. If two curves are specified in the curve editor, the value will be a random between both curves.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#radialSpeedGraph'
  }, {
      title: 'sort',
      subTitle: '{pc.PARTICLESORT_*}',
      description: 'Sorting mode gives you control over the order in which particles are rendered. The options are: None: Particles are rendered in arbitrary order. When this option is selected, the particle system is simulated on the GPU (if the underlying hardware supports floating point textures) and it is recommended you use this setting to get the best performance. Camera Distance: Particles are sorted on the CPU and rendered in back to front order (in terms of camera z depth). Newer First: Particles are sorted on the CPU and rendered in age order, youngest first. Older First: Particles are sorted on the CPU and rendered in age order, oldest first.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#sort'
  }, {
      title: 'startAngle',
      subTitle: '{Number}',
      description: 'The bounds of the initial particle rotation specified in degrees. For each particle, this angle is chosen at random between startAngle and startAngle2.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#startAngle'
  }, {
      title: 'stretch',
      subTitle: '{Number}',
      description: 'A value in world units that controls the amount by which particles are stretched based on their velocity. Particles are stretched from their center towards their previous position.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#stretch'
  }, {
      title: 'velocityGraph',
      subTitle: '{pc.CurveSet}',
      description: 'A curve defining how each particle\'s velocity with respect to the world coordinate system changes over time. If two curves are specified in the curve editor, velocity will be a random lerp between both curves.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#velocityGraph'
  }, {
      title: 'wrap',
      subTitle: '{Boolean}',
      description: 'Enables wrap bounds.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#wrap'
  }, {
      title: 'wrapBounds',
      subTitle: '{pc.Vec3}',
      description: 'World space AABB volume centered on the owner entity\'s position. If a particle crosses the boundary of one side of the volume, it teleports to the opposite side. You can use this to make environmental effects like rain by moving a wrapped emitter\'s owner entity.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#wrapBounds'
  }, {
      name: 'layers',
      title: 'layers',
      subTitle: '{Number[]}',
      description: 'The layers that this particle sytem belongs to. When a particle system belongs to multiple layers it will be rendered multiple times.',
      url: 'http://developer.playcanvas.com/api/pc.ParticleSystemComponent.html#layers'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'particlesystem:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-rigidbody-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.RigidBodyComponent',
      subTitle: '{pc.Component}',
      description: 'The rigidbody Component, when combined with a pc.CollisionComponent, allows your Entities to be simulated using realistic physics. A rigidbody Component will fall under gravity and collide with other rigid bodies, using scripts you can apply forces to the body.',
      url: 'http://developer.playcanvas.com/api/pc.RigidBodyComponent.html'
  }, {
      name: 'damping',
      title: 'angularDamping / linearDamping',
      subTitle: '{Number}',
      description: 'Controls the rate at which a body loses angular/linear velocity over time.',
      url: 'http://developer.playcanvas.com/api/pc.RigidBodyComponent.html#angularDamping'
  }, {
      title: 'angularFactor',
      subTitle: '{pc.Vec3}',
      description: 'Scaling factor for angular movement of the body in each axis.',
      url: 'http://developer.playcanvas.com/api/pc.RigidBodyComponent.html#angularFactor'
  }, {
      title: 'friction',
      subTitle: '{Number}',
      description: 'The friction value used when contacts occur between two bodies.',
      url: 'http://developer.playcanvas.com/api/pc.RigidBodyComponent.html#friction'
  }, {
      title: 'group',
      subTitle: '{Number}',
      description: 'description',
      url: 'http://developer.playcanvas.com/api/pc.RigidBodyComponent.html#group'
  }, {
      title: 'linearFactor',
      subTitle: '{pc.Vec3}',
      description: 'Scaling factor for linear movement of the body in each axis.',
      url: 'http://developer.playcanvas.com/api/pc.RigidBodyComponent.html#linearFactor'
  }, {
      title: 'mass',
      subTitle: '{Number}',
      description: 'The mass of the body.',
      url: 'http://developer.playcanvas.com/api/pc.RigidBodyComponent.html#mass'
  }, {
      title: 'restitution',
      subTitle: '{Number}',
      description: 'The amount of energy lost when two objects collide, this determines the bounciness of the object.',
      url: 'http://developer.playcanvas.com/api/pc.RigidBodyComponent.html#restitution'
  }, {
      title: 'type',
      subTitle: '{pc.RIGIDBODY_TYPE_*}',
      description: 'The type of RigidBody determines how it is simulated.',
      url: 'http://developer.playcanvas.com/api/pc.RigidBodyComponent.html#type'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'rigidbody:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-script-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.ScriptComponent',
      subTitle: '{pc.Component}',
      description: 'The ScriptComponent allows you to extend the functionality of an Entity by attaching your own javascript files to be executed with access to the Entity. For more details on scripting see Scripting.',
      url: 'http://developer.playcanvas.com/api/pc.ScriptComponent.html'
  }, {
      title: 'scripts',
      subTitle: '{Object[]}',
      description: 'Add scripts by clicking on the button or drag scripts on the script component.',
      url: 'http://developer.playcanvas.com/api/pc.ScriptComponent.html#scripts'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'script:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-screen-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.ScreenComponent',
      subTitle: '{pc.Component}',
      description: '',
      url: 'http://developer.playcanvas.com/api/pc.ScreenComponent.html'
  }, {
      title: 'screenSpace',
      subTitle: '{Boolean}',
      description: 'If true then the screen will display its child Elements in 2D. Set this to false to make this a 3D screen.',
      url: 'http://developer.playcanvas.com/api/pc.ScreenComponent.html#screenSpace'
  }, {
      title: 'resolution',
      subTitle: '{pc.Vec2}',
      description: 'The resolution of the screen.',
      url: 'http://developer.playcanvas.com/api/pc.ScreenComponent.html#resolution'
  }, {
      title: 'referenceResolution',
      subTitle: '{pc.Vec2}',
      description: 'The reference resolution of the screen. If the window size changes the screen will adjust its size based on scaleMode using the reference resolution.',
      url: 'http://developer.playcanvas.com/api/pc.ScreenComponent.html#referenceResolution'
  }, {
      title: 'scaleMode',
      subTitle: '{String}',
      description: 'Controls how a screen-space screen is resized when the window size changes. Use Blend to have the screen adjust between the difference of the window resolution and the screen\'s reference resolution. Use None to make the screen always have a size equal to its resolution.',
      url: 'http://developer.playcanvas.com/api/pc.ScreenComponent.html#scaleMode'
  }, {
      title: 'scaleBlend',
      subTitle: '{Number}',
      description: 'Set this to 0 to only adjust to changes between the width of the window and the x of the reference resolution. Set this to 1 to only adjust to changes between the window height and the y of the reference resolution. A value in the middle will try to adjust to both.',
      url: 'http://developer.playcanvas.com/api/pc.ScreenComponent.html#scaleBlend'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'screen:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-element-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'component',
      title: 'pc.ElementComponent',
      subTitle: '{pc.Component}',
      description: '',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html'
  }, {
      title: 'type',
      subTitle: '{String}',
      description: 'The type of the Element.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#type'
  }, {
      title: 'preset',
      subTitle: 'Anchor / Pivot preset',
      description: 'Quickly change the anchor and the pivot of the Element to common presets.'
  }, {
      title: 'anchor',
      subTitle: '{pc.Vec4}',
      description: 'The left, bottom, right and top anchors of the Element. These range from 0 to 1. If the horizontal or vertical anchors are split (not equal) then the Element will grow to fill the difference.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#anchor'
  }, {
      title: 'pivot',
      subTitle: '{pc.Vec2}',
      description: 'The origin of the Element. Rotation and scaling is done based on the pivot.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#pivot'
  }, {
      title: 'text',
      subTitle: '{String}',
      description: 'The text content of the Element. Hit Shift+Enter to add new lines.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#text'
  }, {
      title: 'key',
      subTitle: '{String}',
      description: 'The localization key of the Element. Hit Shift+Enter to add new lines.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#key'
  }, {
      name: 'localized',
      title: 'Localized',
      description: 'Enable this to set the localization key of the Element. The localization key will be used to get the translation of the element\'s text at runtime.'
  }, {
      title: 'fontAsset',
      subTitle: '{pc.Asset}',
      description: 'The font asset used by the Element.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#fontAsset'
  }, {
      title: 'textureAsset',
      subTitle: '{pc.Asset}',
      description: 'The texture to be used by the Element.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#textureAsset'
  }, {
      title: 'spriteAsset',
      subTitle: '{pc.Asset}',
      description: 'The sprite to be used by the Element.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#spriteAsset'
  }, {
      title: 'spriteFrame',
      subTitle: '{Number}',
      description: 'The frame from the Sprite Asset to render.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#spriteFrame'
  }, {
      title: 'pixelsPerUnit',
      subTitle: '{Number}',
      description: 'The number of pixels that correspond to one PlayCanvas unit. Used when using 9 Sliced Sprite Assets to control the thickness of the borders. If this value is not specified the Element component will use the pixelsPerUnit value from the Sprite Asset.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#pixelsPerUnit'
  }, {
      title: 'materialAsset',
      subTitle: '{pc.Asset}',
      description: 'The material to be used by the element.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#materialAsset'
  }, {
      title: 'autoWidth',
      subTitle: '{Booelan}',
      description: 'Make the width of the element match the width of the text content automatically.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#autoWidth'
  }, {
      title: 'autoHeight',
      subTitle: '{Booelan}',
      description: 'Make the height of the element match the height of the text content automatically.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#autoHeight'
  }, {
      title: 'autoFitWidth',
      subTitle: '{Boolean}',
      description: 'If enabled then the font size and the line height of the Element will scale automatically so that it fits the Element\'s width. The value of this field will be ignored if autoWidth is enabled. The font size will scale between the values of minFontSize and fontSize. The lineHeight will scale proportionately.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#autoFitWidth'
  }, {
      title: 'autoFitHeight',
      subTitle: '{Boolean}',
      description: 'If enabled then the font size of the Element will scale automatically so that it fits the Element\'s height. The value of this field will be ignored if autoHeight is enabled. The font size will scale between the values of minFontSize and fontSize. The lineHeight will scale proportionately.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#autoFitHeight'
  }, {
      title: 'autoHeight',
      subTitle: '{Booelan}',
      description: 'Make the height of the element match the height of the text content automatically.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#autoHeight'
  }, {
      title: 'size',
      subTitle: 'width / height {Number}',
      description: 'The width and height of the Element. You can only edit the width or the height if the corresponding anchors of the Element are not split.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#width'
  }, {
      title: 'margin',
      subTitle: 'margin {pc.Vec4}',
      description: 'Controls the spacing between each edge of the Element and the respective anchor. You can only edit the margin if the related anchors are split.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#margin'
  }, {
      title: 'alignment',
      subTitle: 'alignment {pc.Vec2}',
      description: 'Controls the horizontal and vertical alignment of the text relative to its element transform.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#alignment'
  }, {
      title: 'rect',
      subTitle: '{pc.Vec4}',
      description: 'The u, v, width and height of the rectangle that represents the portion of the texture that this image maps to.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#rect'
  }, {
      title: 'fontSize',
      subTitle: '{Number}',
      description: 'The size of the font used by the Element. When autoFitWidth or autoFitHeight are true then it scales between minFontSize and maxFontSize depending on the size of the Element.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#fontSize'
  }, {
      title: 'minFontSize',
      subTitle: '{Number}',
      description: 'The minimum size of the font that the Element can scale to when using autoFitWidth or autoFitHeight.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#fontSize'
  }, {
      title: 'maxFontSize',
      subTitle: '{Number}',
      description: 'The maximum size of the font that the Element can scale to when using autoFitWidth or autoFitHeight.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#fontSize'
  }, {
      title: 'lineHeight',
      subTitle: '{Number}',
      description: 'The height of each line of text. If autoFitWidth or autoFitHeight are enabled then the lineHeight will scale with the font.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#lineHeight'
  }, {
      title: 'wrapLines',
      subTitle: '{Boolean}',
      description: 'Whether to automatically wrap lines based on the element width.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#wrapLines'
  }, {
      title: 'maxLines',
      subTitle: '{Number}',
      description: 'The maximum number of lines that this Element can display. Any left-over text will be appended to the last line of the Element. You can delete this value if you wish to have unlimited lines.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#maxLines'
  }, {
      title: 'spacing',
      subTitle: '{Number}',
      description: 'The spacing between each letter of the text.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#spacing'
  }, {
      title: 'color',
      subTitle: '{pc.Color}',
      description: 'The color of the Element.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#color'
  }, {
      title: 'opacity',
      subTitle: '{Number}',
      description: 'The opacity of the Element.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#opacity'
  }, {
      title: 'useInput',
      subTitle: '{Boolean}',
      description: 'Enable this if you want the element to receive input events.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#useInput'
  }, {
      title: 'batchGroupId',
      subTitle: '{Number}',
      description: 'The batch group that this Element belongs to. The engine will attempt to batch Elements in the same batch group to reduce draw calls.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#batchGroupId'
  }, {
      name: 'layers',
      title: 'layers',
      subTitle: '{Number[]}',
      description: 'The layers that this Element belongs to. When an Element belongs to multiple layers it will be rendered multiple times.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#layers'
  }, {
      title: 'outlineColor',
      subTitle: '{pc.Color}',
      description: 'The text outline effect color and opacity.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#outlineColor'
  }, {
      title: 'outlineThickness',
      subTitle: '{Number}',
      description: 'The text outline effect width. These range from 0 to 1. To disable outline effect set to 0.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#outlineThickness'
  }, {
      title: 'shadowColor',
      subTitle: '{pc.Color}',
      description: 'The text shadow cast effect color and opacity.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#shadowColor'
  }, {
      title: 'shadowOffset',
      subTitle: '{pc.Vec2}',
      description: 'Controls the horizontal and vertical shift of the text shadow cast effect. The rage of both components is form -1 to 1. To disable effect set both to 0.',
      url: 'http://developer.playcanvas.com/api/pc.ElementComponent.html#shadowOffset'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'element:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-button-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'button',
      title: 'pc.ButtonComponent',
      subTitle: '{pc.Component}',
      description: 'A ButtonComponent enables a group of entities to behave like a button, with different visual states for hover and press interactions.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html'
  }, {
      title: 'active',
      subTitle: '{Boolean}',
      description: 'If set to false, the button will be visible but will not respond to hover or touch interactions.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#active'
  }, {
      title: 'imageEntity',
      subTitle: '{pc.Entity}',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#imageEntity',
      description: 'A reference to the entity to be used as the button background. The entity must have an ImageElement component.'
  }, {
      title: 'hitPadding',
      subTitle: '{pc.Vec4}',
      description: 'Padding to be used in hit-test calculations. Can be used to expand the bounding box so that the button is easier to tap.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#hitPadding'
  }, {
      title: 'transitionMode',
      subTitle: '{pc.BUTTON_TRANSITION_MODE}',
      description: 'Controls how the button responds when the user hovers over it/presses it.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#transitionMode'
  }, {
      title: 'hoverTint',
      subTitle: '{pc.Vec4}',
      description: 'Color to be used on the button image when the user hovers over it.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#hoverTint'
  }, {
      title: 'pressedTint',
      subTitle: '{pc.Vec4}',
      description: 'Color to be used on the button image when the user presses it.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#pressedTint'
  }, {
      title: 'inactiveTint',
      subTitle: '{pc.Vec4}',
      description: 'Color to be used on the button image when the button is not interactive.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#inactiveTint'
  }, {
      title: 'fadeDuration',
      subTitle: '{Number}',
      description: 'Duration to be used when fading between tints, in milliseconds.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#fadeDuration'
  }, {
      title: 'hoverSpriteAsset',
      subTitle: '{pc.Asset}',
      description: 'Sprite to be used as the button image when the user hovers over it.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#hoverSpriteAsset'
  }, {
      title: 'hoverSpriteFrame',
      subTitle: '{Number}',
      description: 'Frame to be used from the hover sprite.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#hoverSpriteFrame'
  }, {
      title: 'pressedSpriteAsset',
      subTitle: '{pc.Asset}',
      description: 'Sprite to be used as the button image when the user presses it.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#pressedSpriteAsset'
  }, {
      title: 'pressedSpriteFrame',
      subTitle: '{Number}',
      description: 'Frame to be used from the pressed sprite.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#pressedSpriteFrame'
  }, {
      title: 'inactiveSpriteAsset',
      subTitle: '{pc.Asset}',
      description: 'Sprite to be used as the button image when the button is not interactive.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#inactiveSpriteAsset'
  }, {
      title: 'inactiveSpriteFrame',
      subTitle: '{Number}',
      description: 'Frame to be used from the inactive sprite.',
      url: 'http://developer.playcanvas.com/api/pc.ButtonComponent.html#inactiveSpriteFrame'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'button:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-scroll-view-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'scrollview',
      title: 'pc.ScrollViewComponent',
      subTitle: '{pc.Component}',
      description: 'A ScrollViewComponent enables a group of entities to behave like a masked scrolling area, with optional horizontal and vertical scroll bars.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html'
  }, {
      title: 'horizontal',
      subTitle: '{Boolean}',
      description: 'Whether to enable horizontal scrolling.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html#horizontal'
  }, {
      title: 'vertical',
      subTitle: '{Boolean}',
      description: 'Whether to enable vertical scrolling.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html#vertical'
  }, {
      title: 'scrollMode',
      subTitle: '{pc.SCROLL_MODE}',
      description: 'Specifies how the scroll view should behave when the user scrolls past the end of the content.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html#scrollMode'
  }, {
      title: 'bounceAmount',
      subTitle: '{Number}',
      description: 'Controls how far the content should move before bouncing back.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html#bounceAmount'
  }, {
      title: 'friction',
      subTitle: '{Number}',
      description: 'Controls how freely the content should move if thrown, i.e. by flicking on a phone or by flinging the scroll wheel on a mouse. A value of 1 means that content will stop immediately; 0 means that content will continue moving forever (or until the bounds of the content are reached, depending on the scrollMode).',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html#friction'
  }, {
      title: 'horizontalScrollbarVisibility',
      subTitle: '{pc.SCROLLBAR_VISIBILITY}',
      description: 'Controls whether the horizontal scrollbar should be visible all the time, or only visible when the content exceeds the size of the viewport.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html#horizontalScrollbarVisibility'
  }, {
      title: 'verticalScrollbarVisibility',
      subTitle: '{pc.SCROLLBAR_VISIBILITY}',
      description: 'Controls whether the vertical scrollbar should be visible all the time, or only visible when the content exceeds the size of the viewport.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html#verticalScrollbarVisibility'
  }, {
      title: 'viewportEntity',
      subTitle: '{pc.Entity}',
      description: 'The entity to be used as the masked viewport area, within which the content will scroll. This entity must have an ElementGroup component.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html#viewportEntity'
  }, {
      title: 'contentEntity',
      subTitle: '{pc.Entity}',
      description: 'The entity which contains the scrolling content itself. This entity must have an Element component.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html#contentEntity'
  }, {
      title: 'horizontalScrollbarEntity',
      subTitle: '{pc.Entity}',
      description: 'The entity to be used as the horizontal scrollbar. This entity must have a Scrollbar component.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html#horizontalScrollbarEntity'
  }, {
      title: 'verticalScrollbarEntity',
      subTitle: '{pc.Entity}',
      description: 'The entity to be used as the vertical scrollbar. This entity must have a Scrollbar component.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollViewComponent.html#verticalScrollbarEntity'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'scrollview:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-scrollbar-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'scrollbar',
      title: 'pc.ScrollbarComponent',
      subTitle: '{pc.Component}',
      description: 'A ScrollbarComponent enables a group of entities to behave like a scrollbar, with different visual states for hover and press interactions.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollbarComponent.html'
  }, {
      title: 'orientation',
      subTitle: '{pc.ORIENTATION}',
      description: 'Whether the scrollbar moves horizontally or vertically.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollbarComponent.html#orientation'
  }, {
      title: 'handleEntity',
      subTitle: '{pc.Entity}',
      description: 'The entity to be used as the scrollbar handle. This entity must have a Scrollbar component.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollbarComponent.html#handleEntity'
  }, {
      title: 'value',
      subTitle: '{Number}',
      description: 'The current position value of the scrollbar, in the range 0...1.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollbarComponent.html#value'
  }, {
      title: 'handleSize',
      subTitle: '{Number}',
      description: 'The size of the handle relative to the size of the track, in the range 0...1. For a vertical scrollbar, a value of 1 means that the handle will take up the full height of the track.',
      url: 'http://developer.playcanvas.com/api/pc.ScrollbarComponent.html#handleSize'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'scrollbar:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-sprite-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'sprite',
      title: 'pc.SpriteComponent',
      subTitle: '{pc.Component}',
      description: 'The Sprite Component enables an Entity to render a simple static Sprite or Sprite Animation Clips.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html'
  }, {
      title: 'type',
      subTitle: '{Boolean}',
      description: 'A Sprite Component can either be Simple or Animated. Simple Sprite Components only show a single frame of a Sprite Asset. Animated Sprite Components can play Sprite Animation Clips.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#type'
  }, {
      title: 'color',
      subTitle: '{pc.Color}',
      description: 'The color tint of the Sprite.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#color'
  }, {
      title: 'opacity',
      subTitle: '{Number}',
      description: 'The opacity of the Sprite.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#opacity'
  }, {
      title: 'spriteAsset',
      subTitle: '{pc.Asset}',
      description: 'The Sprite Asset used by the Sprite Component.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#spriteAsset'
  }, {
      title: 'frame',
      subTitle: '{Number}',
      description: 'The frame of the Sprite Asset that the Sprite Component will render.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#frame'
  }, {
      title: 'flipX',
      subTitle: '{Boolean}',
      description: 'Flips the X axis when rendering a Sprite.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#flipX'
  }, {
      title: 'flipY',
      subTitle: '{Boolean}',
      description: 'Flips the Y axis when rendering a Sprite.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#flipY'
  }, {
      title: 'size',
      subTitle: 'width / height {Number}',
      description: 'The width and height of the Sprite when rendering using 9-Slicing. The width and height are only used when the render mode of the Sprite Asset is Sliced or Tiled.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#width'
  }, {
      title: 'drawOrder',
      subTitle: '{Number}',
      description: 'The draw order of the sprite. A higher value means that the component will be rendered on top of other components in the same layer. For this work the sprite must be in a layer that uses Manual sort order.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#drawOrder'
  }, {
      title: 'speed',
      subTitle: '{Number}',
      description: 'A global speed modifier used when playing Sprite Animation Clips.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#flipY'
  }, {
      title: 'autoPlayClip',
      subTitle: '{String}',
      description: 'The Sprite Animation Clip to play automatically when the Sprite Component is enabled.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#autoPlayClip'
  }, {
      title: 'batchGroupId',
      subTitle: '{Number}',
      description: 'The batch group that this sprite belongs to. The engine will attempt to batch sprites in the same batch group to reduce draw calls.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#batchGroupId'
  }, {
      name: 'addClip',
      title: 'Add Clip',
      description: 'Add a new Sprite Animation Clip.'
  }, {
      name: 'layers',
      title: 'layers',
      subTitle: '{Number[]}',
      description: 'The layers that this sprite belongs to. When a sprite belongs to multiple layers it will be rendered multiple times.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteComponent.html#layers'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'sprite:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-sprite-animation-clip-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'clip',
      title: 'pc.SpriteAnimationClip',
      description: 'A Sprite Animation Clip can play all the frames of a Sprite Asset at a specified speed.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteAnimationClip.html'
  }, {
      title: 'name',
      subTitle: '{String}',
      description: 'The name of the animation clip. The name of the clip must be unique for this Sprite Component.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteAnimationClip.html#name'
  }, {
      title: 'autoPlay',
      subTitle: '{Boolean}',
      description: 'Enable this if you want to automatically start playing this animation clip as soon as it is loaded.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteAnimationClip.html#autoPlay'
  }, {
      title: 'loop',
      subTitle: '{Boolean}',
      description: 'Enable this if you want to loop the animation clip.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteAnimationClip.html#loop'
  }, {
      title: 'fps',
      subTitle: '{Number}',
      description: 'The number of frames per second to play for this animation clip.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteAnimationClip.html#fps'
  }, {
      title: 'spriteAsset',
      subTitle: '{pc.Asset}',
      description: 'The Sprite Asset that contains all the frames of the animation clip.',
      url: 'http://developer.playcanvas.com/api/pc.SpriteAnimationClip.html#spriteAsset'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'spriteAnimation:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-layoutgroup-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'layoutgroup',
      title: 'pc.LayoutGroupComponent',
      subTitle: '{pc.Component}',
      description: 'The Layout Group Component enables an Entity to position and scale child Element Components according to configurable layout rules.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutGroupComponent.html'
  }, {
      title: 'orientation',
      subTitle: '{pc.ORIENTATION}',
      description: 'Whether the layout should run horizontally or vertically.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutGroupComponent.html#orientation'
  }, {
      title: 'reverseX',
      subTitle: '{Boolean}',
      description: 'Reverses the order of elements on the X axis.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutGroupComponent.html#reverseX'
  }, {
      title: 'reverseY',
      subTitle: '{Boolean}',
      description: 'Reverses the order of elements on the Y axis.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutGroupComponent.html#reverseY'
  }, {
      title: 'alignment',
      subTitle: '{pc.Vec2}',
      description: 'Specifies the horizontal and vertical alignment of child elements. Values range from 0 to 1 where [0,0] is the bottom left and [1,1] is the top right.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutGroupComponent.html#alignment'
  }, {
      title: 'padding',
      subTitle: '{pc.Vec4}',
      description: 'Padding to be applied inside the container before positioning any children. Specified as left, bottom, right and top values.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutGroupComponent.html#padding'
  }, {
      title: 'spacing',
      subTitle: '{pc.Vec2}',
      description: 'Spacing to be applied between each child element.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutGroupComponent.html#spacing'
  }, {
      title: 'widthFitting',
      subTitle: '{pc.FITTING}',
      description: 'Fitting logic to be applied when positioning and scaling child elements.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutGroupComponent.html#widthFitting'
  }, {
      title: 'heightFitting',
      subTitle: '{pc.FITTING}',
      description: 'Fitting logic to be applied when positioning and scaling child elements.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutGroupComponent.html#heightFitting'
  }, {
      title: 'wrap',
      subTitle: '{Boolean}',
      description: 'Whether or not to wrap children onto a new row/column when the size of the container is exceeded.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutGroupComponent.html#wrap'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'layoutgroup:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-components-layoutchild-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'layoutchild',
      title: 'pc.LayoutChildComponent',
      subTitle: '{pc.Component}',
      description: 'The Layout Child Component enables an Entity to control the sizing applied to it by its parent Layout Group Component.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutChildComponent.html'
  }, {
      title: 'minWidth',
      subTitle: '{Number}',
      description: 'The minimum width the element should be rendered at.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutChildComponent.html#minWidth'
  }, {
      title: 'minHeight',
      subTitle: '{Number}',
      description: 'The minimum height the element should be rendered at.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutChildComponent.html#minHeight'
  }, {
      title: 'maxWidth',
      subTitle: '{Number}',
      description: 'The maximum width the element should be rendered at.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutChildComponent.html#maxWidth'
  }, {
      title: 'maxHeight',
      subTitle: '{Number}',
      description: 'The maximum height the element should be rendered at.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutChildComponent.html#maxHeight'
  }, {
      title: 'fitWidthProportion',
      subTitle: '{Number}',
      description: 'The amount of additional horizontal space that the element should take up, if necessary to satisfy a Stretch/Shrink fitting calculation. This is specified as a proportion, taking into account the proportion values of other siblings.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutChildComponent.html#fitWidthProportion'
  }, {
      title: 'fitHeightProportion',
      subTitle: '{Number}',
      description: 'The amount of additional vertical space that the element should take up, if necessary to satisfy a Stretch/Shrink fitting calculation. This is specified as a proportion, taking into account the proportion values of other siblings.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutChildComponent.html#fitHeightProportion'
  }, {
      title: 'excludeFromLayout',
      subTitle: '{Boolean}',
      description: 'When enabled, the child will be excluded from all layout calculations.',
      url: 'http://developer.playcanvas.com/api/pc.LayoutChildComponent.html#excludeFromLayout'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'layoutchild:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      title: 'id',
      subTitle: '{Number}',
      description: 'Unique identifier of an Asset.',
      url: 'http://developer.playcanvas.com/api/pc.Asset.html'
  }, {
      title: 'name',
      subTitle: '{String}',
      description: 'The name of the asset.',
      url: 'http://developer.playcanvas.com/api/pc.Asset.html#name'
  }, {
      title: 'type',
      subTitle: '{String}',
      description: 'The type of the asset. One of: animation, audio, image, json, material, model, text, texture.',
      url: 'http://developer.playcanvas.com/api/pc.Asset.html#type'
  }, {
      name: 'size',
      description: 'Size of an asset. Keeping this value as tiny as possible will lead to faster application loading and less bandwidth required to launch the app.'
  }, {
      title: 'tags',
      subTitle: '{pc.Tags}',
      description: 'Interface for tagging assets. Allows to find assets by tags using app.assets.findByTag method.',
      url: 'http://developer.playcanvas.com/api/pc.Asset.html#tags'
  }, {
      name: 'runtime',
      description: 'If this asset is runtime-friendly and can be used within the app.'
  }, {
      title: 'preload',
      subTitle: '{Boolean}',
      description: 'If true the asset will be loaded during the preload phase of application set up.',
      url: 'http://developer.playcanvas.com/api/pc.Asset.html#preload'
  }, {
      name: 'source',
      description: 'Reference to another asset where this asset were imported from.'
  }, {
      name: 'bundles',
      description: 'If the asset is included in any Asset Bundles then these are listed here. You can also add the asset to an Asset Bundle by using the dropdown.'
  }, {
      name: 'localization',
      title: 'LOCALIZATION',
      description: 'Here you can define a replacement asset to be used for a particular locale. When the application\'s locale changes then references to this asset will use the replacement asset for the new locale.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-audio-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'asset',
      title: 'pc.Sound',
      subTitle: '{Class}',
      description: 'Audio resource file that is used by Web Audio API.',
      url: 'http://developer.playcanvas.com/api/pc.Sound.html'
  }, {
      title: 'duration',
      subTitle: '{Number}',
      description: 'Duration of the audio file in seconds.',
      url: 'http://developer.playcanvas.com/api/pc.Sound.html#duration'
  }];

  // fields reference
  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:audio:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-animation-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'asset',
      title: 'pc.Animation',
      subTitle: '{Class}',
      description: 'An animation is a sequence of keyframe arrays which map to the nodes of a skeletal hierarchy. It controls how the nodes of the hierarchy are transformed over time.',
      url: 'http://developer.playcanvas.com/api/pc.Animation.html'
  }, {
      title: 'duration',
      description: 'Duration of the animation in seconds.',
      url: 'http://developer.playcanvas.com/api/pc.Animation.html'
  }];

  // fields reference
  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:animation:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-css-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'asset',
      title: 'CSS',
      subTitle: '{String}',
      description: 'CSS string to be used in application.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:css:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-cubemap-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'asset',
      title: 'pc.Texture',
      subTitle: '{Class}',
      description: 'Cube maps are a special type of texture asset. They are formed from 6 texture assets where each texture represents the face of a cube. They typically have two uses: A cube map can define your scene\'s sky box. A sky box contains imagery of the distant visuals of your scene such as hills, mountains, the sky and so on. A cube map can add reflections to any material. Imagine a shiny, chrome ball bearing in your scene. The ball reflects the surrounding scene. For open environments, you would normally set the scene\'s sky box cube map as the cube map on a reflective object\'s materials.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html'
  }, {
      title: 'anisotropy',
      subTitle: '{Number}',
      description: 'Integer value specifying the level of anisotropic to apply to the texture ranging from 1 (no anisotropic filtering) to the pc.GraphicsDevice property maxAnisotropy.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#anisotropy'
  }, {
      title: 'magFilter',
      subTitle: '{pc.FILTER_*}',
      description: 'The magnification filter to be applied to the texture.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#magFilter'
  }, {
      title: 'mipFilter',
      subTitle: '{pc.FILTER_*}',
      description: 'The minification mipmap filter to be applied to the texture.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#mipFilter'
  }, {
      title: 'minFilter',
      subTitle: '{pc.FILTER_*}',
      description: 'The minification filter to be applied to the texture.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#minFilter'
  }, {
      name: 'slots',
      title: 'Texture Slots',
      description: 'The six texture assets that correspond to the faces of a cube. Helping you to connect faces together correctly. Think of the preview as a box unfolded to a flat plane.'
  }, {
      name: 'prefilter',
      title: 'Prefiltering',
      description: 'Prefilter button generates a set of low-resolution filtered textures which are used in the environment map of the Physical material. Prefiltering the cube map is essential for using the Physical material.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:cubemap:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-html-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'asset',
      title: 'HTML',
      subTitle: '{String}',
      description: 'HTML string to be used in application.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:html:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-json-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'asset',
      title: 'JSON',
      subTitle: '{Object}',
      description: 'JSON data to be used in application.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:json:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-material-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'asset',
      title: 'pc.Material',
      subTitle: '{Class}',
      description: 'Every surface on a 3D model is rendered using a material. The material defines the properties of that surface, such as its color, shininess, bumpiness. In PlayCanvas, a material is an Asset type which collects all these properties together. By default, it represents a Physical material. This exposes the fundamental properties that can be used to create many different types for visual effects, from smooth plastic, to rough wood, or scratched metal.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      name: 'ambientOverview',
      description: 'Ambient properties determine how the material appears in ambient light.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      title: 'ambient',
      subTitle: '{pc.Color}',
      description: 'The tint color to multiply the scene\'s global ambient color.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#ambient'
  }, {
      title: 'ambientTint',
      subTitle: '{Boolean}',
      description: 'Check this to multiply the scene\'s global ambient color with a material specific color.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#ambientTint'
  }, {
      title: 'aoMap',
      subTitle: '{pc.Texture}',
      description: 'An ambient occlusion map containing pre-baked ambient occlusion.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#aoMap'
  }, {
      title: 'aoMapChannel',
      subTitle: '{String}',
      description: 'An ambient occlusion map color channel to extract color value from texture. Can be: r, g, b, a',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#aoMapChannel'
  }, {
      title: 'aoMapUv',
      subTitle: '{Number}',
      description: 'AO map UV channel',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#aoMapUv'
  }, {
      title: 'aoMapVertexColor',
      subTitle: '{Boolean}',
      description: 'Use vertex colors for AO instead of a map',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#aoMapVertexColor'
  }, {
      title: 'aoMapTiling',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D tiling of the AO map.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#aoMapTiling'
  }, {
      title: 'aoMapOffset',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D offset of the AO map. Each component is between 0 and 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#aoMapOffset'
  }, {
      title: 'blendType',
      subTitle: '{pc.BLEND_*}',
      description: 'The type of blending for this material. Options are:\n \
      <b>None {pc.BLEND_NONE}</b>: The mesh is opaque. This is the default.\n \
      <b>Normal {pc.BLEND_NORMAL}</b>: The mesh is transparent, like stained glass. Called as Alpha Blend as well.\n \
      <b>Additive {pc.BLEND_ADDITIVE}</b>: The mesh color is added to whatever has already been rendered to the frame buffer.\n \
      <b>Additive Alpha {pc.BLEND_ADDITIVEALPHA}</b>: Same as Additive except source RGB is multiplied by the source alpha.\n \
      <b>Screen {pc.BLEND_SCREEN}</b>: Softer version of Additive.\n \
      <b>Pre-multiply {pc.BLEND_PREMULTIPLIED}</b>: Like \'Normal\' blending except it is assumed that the color of the mesh being rendered with this material has already been modulated by its alpha value.\n \
      <b>Multiply {pc.BLEND_MULTIPLICATIVE}</b>: When rendered, the mesh color is multiplied by whatever has already been rendered to the frame buffer.\n \
      <b>Modulate 2x {pc.BLEND_MULTIPLICATIVE2X}</b>: Multiplies colors and doubles the result.\n \
      <b>Min {pc.BLEND_MIN}</b>: [Partial Support, check `app.graphicsDevice.extBlendMinmax` for support] Minimum color.\n \
      <b>Max {pc.BLEND_MAX}</b>: [Partial Support, check `app.graphicsDevice.extBlendMinmax` for support] Maximum color.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#blendType'
  }, {
      title: 'bumpiness',
      subTitle: '{Number}',
      description: 'The strength of the applied normal map. This is a value between 0 (the normal map has no effect) and 2 (the effect of the normal map is exagerrated). It defaults to 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#bumpiness'
  }, {
      title: 'conserveEnergy',
      subTitle: '{Boolean}',
      description: 'Defines how diffuse and specular components are combined when Fresnel is on. It is recommended that you leave this option enabled, although you may want to disable it in case when all reflection comes only from a few light sources, and you don\'t use an environment map, therefore having mostly black reflection.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#conserveEnergy'
  }, {
      title: 'cubeMap',
      subTitle: '{pc.Texture}',
      description: 'A cube map texture asset that approximates environment reflection (with greater accuracy than is possible with a sphere map). If scene has SkyBox set, then it will be used as default cubeMap',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#cubeMap'
  }, {
      title: 'cubeMapProjection',
      subTitle: '{pc.CUBEPROJ_*}',
      description: 'The type of projection applied to the cubeMap property, with available options: pc.CUBEPROJ_NONE and pc.CUBEPROJ_BOX. Set to Box to enable world-space axis-aligned projection of cubemap based on bounding box.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#cubeMapProjection'
  }, {
      name: 'cubeMapProjectionBoxCenter',
      title: 'cubeMapProjectionBox',
      subTitle: '{pc.BoundingBox}',
      description: 'The world space axis-aligned bounding box defining the box-projection used for the cubeMap property. Only used when cubeMapProjection is set to pc.CUBEPROJ_BOX.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#cubeMapProjectionBox'
  }, {
      name: 'cubeMapProjectionBoxHalfExtents',
      title: 'cubeMapProjectionBox',
      subTitle: '{pc.BoundingBox}',
      description: 'The world space axis-aligned bounding box defining the box-projection used for the cubeMap property. Only used when cubeMapProjection is set to pc.CUBEPROJ_BOX.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#cubeMapProjectionBox'
  }, {
      title: 'cull',
      subTitle: '{pc.CULLFACE_*}',
      description: 'Options are: None {pc.CULLFACE_NONE}: Both front faces and back faces are rendered. Front Faces {pc.CULLFACE_FRONT}: front faces are rendered and back faces are not. Back Faces {pc.CULLFACE_BACK}: back faces are rendered and front faces are not. This is the default. PlayCanvas dictates that a counter-clockwise vertex winding specifies a front face triangle. Note that backface culling is often good for performance because backface pixels are often overwritten (for convex meshes) which can result in redundant filling of pixels.'
  }, {
      title: 'depthTest',
      subTitle: '{Boolean}',
      description: 'If checked, when a mesh with the material is rendered, a per pixel check is performed to determine if the pixel passes the engine\'s depth test. By default, the test is that the pixel must have a z depth less than or equal to whatever is already in the depth buffer. In other words, the mesh is only visible if nothing is in front of it. If unchecked, the mesh is rendered regardless of what is already in the depth buffer. Defaults to on.'
  }, {
      title: 'depthWrite',
      subTitle: '{Boolean}',
      description: 'If checked, when a mesh with the material is rendered, its depth information is written to the depth buffer. This ensures that when subsequent meshes are rendered, they can be successfully depth tested against meshes rendered with this material. Defaults to on.'
  }, {
      name: 'diffuseOverview',
      description: 'Diffuse properties define the how a material reflects diffuse light emitted by dynamic light sources in the scene.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      title: 'diffuse',
      subTitle: '{pc.Color}',
      description: 'If no diffuse map is set or tint is enabled, this is the diffuse color of the material.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#diffuse'
  }, {
      title: 'diffuseMap',
      subTitle: '{pc.Texture}',
      description: 'The diffuse map that specifies the per-pixel diffuse material color. If no diffuse map is set, the diffuse color is used instead.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#diffuseMap'
  }, {
      title: 'diffuseMapChannel',
      subTitle: '{String}',
      description: 'An diffuse map color channel to extract color value from texture. Can be: r, g, b, a, rgb',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#diffuseMapChannel'
  }, {
      title: 'diffuseMapOffset',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D offset of the diffuseMap. Each component is between 0 and 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#diffuseMapOffset'
  }, {
      title: 'diffuseMapTiling',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D tiling of the diffuseMap.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#diffuseMapTiling'
  }, {
      title: 'diffuseMapTint',
      subTitle: '{Boolean}',
      description: 'Check this to modulate the material\'s diffuse map with a material specific diffuse color.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#diffuseMapTint'
  }, {
      title: 'diffuseMapUv',
      subTitle: '{Number}',
      description: 'Diffuse map UV channel',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#diffuseMapUv'
  }, {
      title: 'diffuseMapVertexColor',
      subTitle: '{Boolean}',
      description: 'Use vertex colors for diffuse instead of a map',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#diffuseMapVertexColor'
  }, {
      name: 'emissiveOverview',
      description: 'Emissive properties control how the material emits light (as opposed to reflecting light).',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      title: 'emissive',
      subTitle: '{pc.Color}',
      description: 'If no emissive map is set or tint is enabled, this is the emissive color of the material.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#emissive'
  }, {
      title: 'emissiveIntensity',
      subTitle: '{Number}',
      description: 'A multiplier for emissive color that can achieve overbright effects for exceptionally bright emissive materials.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#emissiveIntensity'
  }, {
      title: 'emissiveMap',
      subTitle: '{pc.Texture}',
      description: 'The emissive map that specifies the per-pixel emissive color. If no emissive map is set, the emissive color is used instead.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#emissiveMap'
  }, {
      title: 'emissiveMapChannel',
      subTitle: '{String}',
      description: 'An emissive map color channel to extract color value from texture. Can be: r, g, b, a, rgb',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#emissiveMapChannel'
  }, {
      title: 'emissiveMapOffset',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D offset of the emissiveMap. Each component is between 0 and 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#emissiveMapOffset'
  }, {
      title: 'emissiveMapTiling',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D tiling of the emissiveMap.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#emissiveMapTiling'
  }, {
      title: 'emissiveMapTint',
      subTitle: '{Boolean}',
      description: 'Check this to modulate the material\'s emissive map with a material specific emissive color.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#emissiveMapTint'
  }, {
      title: 'emissiveMapUv',
      subTitle: '{Number}',
      description: 'Emissive map UV channel',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#emissiveMapUv'
  }, {
      title: 'emissiveMapVertexColor',
      subTitle: '{Boolean}',
      description: 'Use vertex colors for emission instead of a map',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#emissiveMapVertexColor'
  }, {
      name: 'environmentOverview',
      description: 'Environment properties determine how a material reflects and refracts the environment.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      title: 'fresnelModel',
      subTitle: '{pc.FRESNEL_*}',
      description: 'A parameter for Fresnel. May mean different things depending on fresnelModel.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#fresnelModel'
  }, {
      title: 'glossMap',
      subTitle: '{pc.Texture}',
      description: 'The gloss map that specifies a per-pixel shininess value. The gloss map is modulated by the shininess property.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#glossMap'
  }, {
      title: 'glossMapChannel',
      subTitle: '{String}',
      description: 'An gloss map color channel to extract color value from texture. Can be: r, g, b, a',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#glossMapChannel'
  }, {
      title: 'glossMapOffset',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D offset of the glossMap. Each component is between 0 and 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#glossMapOffset'
  }, {
      title: 'glossMapTiling',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D tiling of the glossMap.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#glossMapTiling'
  }, {
      title: 'glossMapUv',
      subTitle: '{Number}',
      description: 'Gloss map UV channel',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#glossMapUv'
  }, {
      title: 'glossMapVertexColor',
      subTitle: '{Boolean}',
      description: 'Use vertex colors for glossiness instead of a map',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#glossMapVertexColor'
  }, {
      title: 'heightMap',
      subTitle: '{pc.Texture}',
      description: 'The height map that specifies the per-pixel strength of the parallax effect. White is full height and black is zero height.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#heightMap'
  }, {
      title: 'heightMapChannel',
      subTitle: '{String}',
      description: 'An height map color channel to extract color value from texture. Can be: r, g, b, a',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#heightMapChannel'
  }, {
      title: 'heightMapFactor',
      subTitle: '{Number}',
      description: 'The strength of a parallax effect (a value between 0 and 2, defaulting to 1).',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#heightMapFactor'
  }, {
      title: 'heightMapOffset',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D offset of the heightMap. Each component is between 0 and 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#heightMapOffset'
  }, {
      title: 'heightMapTiling',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D tiling of the heightMap.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#heightMapTiling'
  }, {
      title: 'heightMapUv',
      subTitle: '{Number}',
      description: 'Height map UV channel',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#heightMapUv'
  }, {
      name: 'lightMapOverview',
      description: 'Light maps contain pre-baked diffuse lighting. Using light maps is considered an optimization in that runtime dynamic lighting calculations can be pre-calculated.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      title: 'lightMap',
      subTitle: '{pc.Texture}',
      description: 'The lightmap texture that contains pre-baked diffuse lighting. The lightmap usually is applied to the second UV set.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#lightMap'
  }, {
      title: 'lightMapChannel',
      subTitle: '{String}',
      description: 'An light map color channel to extract color value from texture. Can be: r, g, b, a, rgb',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#lightMapChannel'
  }, {
      title: 'lightMapUv',
      subTitle: '{Number}',
      description: 'Lightmap UV channel',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#lightMapUv'
  }, {
      title: 'lightMapVertexColor',
      subTitle: '{Boolean}',
      description: 'Use vertex lightmap instead of a texture-based one',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#lightMapVertexColor'
  }, {
      title: 'lightMapTiling',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D tiling of the lightmap.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#lightMapTiling'
  }, {
      title: 'lightMapOffset',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D offset of the lightmap. Each component is between 0 and 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#lightMapOffset'
  }, {
      title: 'metalness',
      subTitle: '{Number}',
      description: 'Metalness factor multiplier.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#metalness'
  }, {
      title: 'metalnessMap',
      subTitle: '{pc.Texture}',
      description: 'This map specifies per-pixel metalness values. A value of 1 is metal and a value of 0 is non-metal.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#metalnessMap'
  }, {
      title: 'metalnessMapChannel',
      subTitle: '{String}',
      description: 'An metalness map color channel to extract color value from texture. Can be: r, g, b, a',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#metalnessMapChannel'
  }, {
      title: 'metalnessMapUv',
      subTitle: '{Number}',
      description: 'Metnalness map UV channel',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#metalnessMapUv'
  }, {
      title: 'metalnessMapVertexColor',
      subTitle: '{Boolean}',
      description: 'Use vertex colors for metalness instead of a map',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#metalnessMapVertexColor'
  }, {
      title: 'metalnessMapTiling',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D tiling of the metalness map.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#metalnessMapTiling'
  }, {
      title: 'metalnessMapOffset',
      subTitle: '{String}',
      description: 'Controls the 2D offset of the metalness map. Each component is between 0 and 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#metalnessMapChannel'
  }, {
      name: 'normalOverview',
      description: 'Use this to specify normal maps in order to simulate \'Bumpiness\' effect.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      title: 'normalMap',
      subTitle: '{pc.Texture}',
      description: 'The normal map that specifies the per-pixel surface normals. The normal map is modulated by the \'Bumpiness\' property.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#normalMap'
  }, {
      title: 'normalMapOffset',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D offset of the normalMap. Each component is between 0 and 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#normalMapOffset'
  }, {
      title: 'normalMapTiling',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D tiling of the normalMap.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#normalMapTiling'
  }, {
      title: 'normalMapUv',
      subTitle: '{Number}',
      description: 'Normal map UV channel',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#normalMapUv'
  }, {
      title: 'occludeSpecular',
      subTitle: '{Boolean}',
      description: 'If checked, ambient color will occlude specular factor of a material.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#occludeSpecular'
  }, {
      name: 'other',
      description: 'Other Render States gives additional controls over how a mesh is rendered with the specified material.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      name: 'offset',
      description: 'The offset in U and V to apply to the first UV channel referenced by maps in this material.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      name: 'offsetTiling',
      description: 'The offset and tiling in U and V to apply to the UV channel referenced by all maps in this material.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      name: 'opacityOverview',
      description: 'Opacity sets the transparency level.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      title: 'opacity',
      subTitle: '{Number}',
      description: 'The opacity of the material. This is a value between 0 (completely transparent) and 1 (complately opaque. It defaults to 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#opacity'
  }, {
      title: 'opacityMap',
      subTitle: '{pc.Texture}',
      description: 'The opacity map that specifies the per-pixel opacity. The opacity map is modulated by the \'Amount\' property.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#opacityMap'
  }, {
      title: 'opacityMapChannel',
      subTitle: '{String}',
      description: 'An opacity map color channel to extract color value from texture. Can be: r, g, b, a',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#opacityMapChannel'
  }, {
      title: 'opacityMapOffset',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D offset of the opacityMap. Each component is between 0 and 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#opacityMapOffset'
  }, {
      title: 'opacityMapTiling',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D tiling of the opacityMap.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#opacityMapTiling'
  }, {
      title: 'opacityMapUv',
      subTitle: '{Number}',
      description: 'Opacity map UV channel',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#opacityMapUv'
  }, {
      title: 'opacityMapVertexColor',
      subTitle: '{Boolean}',
      description: 'Use vertex colors for opacity instead of a map',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#opacityMapVertexColor'
  }, {
      name: 'parallaxOverview',
      description: 'A height map gives further realism to a normal map by giving the illusion of depth to a surface. Note that parallax options are only enabled if you have set a normal map on the material.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      title: 'reflectivity',
      subTitle: '{Number}',
      description: 'A factor to determin what portion of light is reflected from the material. This value defaults to 1 (full reflectivity).',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#reflectivity'
  }, {
      title: 'refraction',
      subTitle: '{Number}',
      description: 'A factor to determine what portion of light passes through the material.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#refraction'
  }, {
      title: 'refractionIndex',
      subTitle: '{Number}',
      description: 'Determines the amount of distortion of light passing through the material.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#refractionIndex'
  }, {
      title: 'shadingModel',
      subTitle: '{pc.SPECULAR_*}',
      description: 'Defines the shading model. Phong {pc.SPECULAR_PHONG}: Phong without energy conservation. You should only use it as a backwards compatibility with older projects. Physical {pc.SPECULAR_BLINN}: Energy-conserving Blinn-Phong.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#shadingModel'
  }, {
      title: 'shininess',
      subTitle: '{Number}',
      description: 'A value determining the smoothness of a surface. For smaller shininess values, a surface is rougher and specular highlights will be broader. For larger shininess values, a surface is smoother and will exhibit more concentrated specular highlights (as is the surace is polished and shiny).',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#shininess'
  }, {
      name: 'specularOverview',
      description: 'Specular properties defines the color of the specular highlights. i.e. the shininess',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      title: 'specular',
      subTitle: '{pc.Color}',
      description: 'If no specular map is set or tint is checked, this is the specular color of the material.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#specular'
  }, {
      title: 'specularAntialias',
      subTitle: '{Boolean}',
      description: 'Enables Toksvig AA for mipmapped normal maps with specular.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#specularAntialias'
  }, {
      title: 'specularMap',
      subTitle: '{pc.Texture}',
      description: 'The specular map that specifies the per-pixel specular color. If no specular map is set, the specular color is used instead.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#specularMap'
  }, {
      title: 'specularMapChannel',
      subTitle: '{String}',
      description: 'An specular map color channel to extract color value from texture. Can be: r, g, b, a, rgb',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#specularMapChannel'
  }, {
      title: 'specularMapOffset',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D offset of the specularMap. Each component is between 0 and 1.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#specularMapOffset'
  }, {
      title: 'specularMapTiling',
      subTitle: '{pc.Vec2}',
      description: 'Controls the 2D tiling of the specularMap.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#specularMapTiling'
  }, {
      title: 'specularMapTint',
      subTitle: '{Boolean}',
      description: 'Check this to modulate the material\'s specular map with a material specific specular color.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#specularMapTint'
  }, {
      title: 'specularMapUv',
      subTitle: '{Number}',
      description: 'Specular map UV channel.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#specularMapUv'
  }, {
      title: 'specularMapVertexColor',
      subTitle: '{Boolean}',
      description: 'Use vertex colors for specular instead of a map.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#specularMapVertexColor'
  }, {
      title: 'sphereMap',
      subTitle: '{pc.Texture}',
      description: 'A sphere map texture asset that approximates environment reflection. If a sphere map is set, the Cube Map property will be hidden (since these properties are mutually exclusive).',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#sphereMap'
  }, {
      name: 'tiling',
      description: 'The scale in U and V to apply to the first UV channel referenced by maps in this material.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html'
  }, {
      title: 'useMetalness',
      subTitle: '{Boolean}',
      description: 'Toggle between specular and metalness workflow.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#useMetalness'
  }, {
      title: 'alphaTest',
      subTitle: '{Number}',
      description: 'The alpha test reference value to control which fragements are written to the currently active render target based on alpha value. All fragments with an alpha value of less than the alphaTest reference value will be discarded. alphaTest defaults to 0 (all fragments pass).',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#alphaTest'
  }, {
      title: 'alphaToCoverage',
      subTitle: '{Boolean}',
      webgl2: true,
      description: 'Enables or disables alpha to coverage. When enabled, and if hardware anti-aliasing is on, limited order-independent transparency can be achieved. Quality depends on the number of MSAA samples of the current render target. It can nicely soften edges of otherwise sharp alpha cutouts, but isn\'t recommended for large area semi-transparent surfaces. Note, that you don\'t need to enable blending to make alpha to coverage work. It will work without it, just like alphaTest.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#alphaToCoverage'
  }, {
      title: 'useFog',
      subTitle: '{Boolean}',
      description: 'Apply fogging (as configured in scene settings).',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#useFog'
  }, {
      title: 'useLighting',
      subTitle: '{Boolean}',
      description: 'Apply lighting.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#useLighting'
  }, {
      title: 'useSkybox',
      subTitle: '{Boolean}',
      description: 'Apply scene skybox as prefiltered environment map.',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#useSkybox'
  }, {
      title: 'useGammaTonemap',
      subTitle: '{Boolean}',
      description: 'Apply gamma correction and tonemapping (as configured in scene settings).',
      url: 'http://developer.playcanvas.com/api/pc.StandardMaterial.html#useGammaTonemap'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:material:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-model-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      title: 'meshInstances',
      subTitle: '{pc.MeshInstance[]}',
      description: 'An array of meshInstances contained in this model. Materials are defined for each individual Mesh Instance.',
      url: 'http://developer.playcanvas.com/api/pc.Model.html#meshInstances'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:model:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-script-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      title: 'filename',
      subTitle: '{String}',
      description: 'Filename of a script..'
  }, {
      name: 'order',
      description: 'Sometimes specific order of loading and executing JS files is required. All preloaded script assets will be loaded in order specified in Project Settings. You can further control when you want a Script Asset to load by changing the Loading Type.'
  }, {
      name: 'loadingType',
      description: 'This allows you to control when this script will be loaded. The possible values are "Asset" (load as a regular Asset), "Before Engine" (load before the PlayCanvas engine is loaded), "After Engine" (load right after the PlayCanvas engine has loaded)'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:script:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-text-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'asset',
      title: 'TEXT',
      subTitle: '{String}',
      description: 'String data to be used in application.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:text:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-texture-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'asset',
      title: 'pc.Texture',
      subTitle: '{Class}',
      description: 'Textures assets are image files which are used as part of a material to give a 3D model a realistic appearance.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html'
  }, {
      name: 'dimensions',
      title: 'width / height',
      subTitle: '{Number}',
      description: 'The width and height of the texture.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#width'
  }, {
      title: 'magFilter',
      subTitle: '{pc.FILTER_*}',
      description: 'The magnification filter to be applied to the texture.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#magFilter'
  }, {
      title: 'mipFilter',
      subTitle: '{pc.FILTER_*}',
      description: 'The minification mipmap filter to be applied to the texture.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#mipFilter'
  }, {
      title: 'minFilter',
      subTitle: '{pc.FILTER_*}',
      description: 'The minification filter to be applied to the texture.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#minFilter'
  }, {
      title: 'addressU',
      subTitle: '{pc.ADDRESS_*}',
      description: 'The addressing mode to be applied to the texture.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#addressU'
  }, {
      title: 'addressV',
      subTitle: '{pc.ADDRESS_*}',
      description: 'The addressing mode to be applied to the texture.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#addressV'
  }, {
      title: 'anisotropy',
      subTitle: '{Number}',
      description: 'Integer value specifying the level of anisotropic to apply to the texture ranging from 1 (no anisotropic filtering) to the pc.GraphicsDevice property maxAnisotropy.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#anisotropy'
  }, {
      title: 'width',
      subTitle: '{Number}',
      description: 'The width of the base mip level in pixels.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#width'
  }, {
      title: 'height',
      subTitle: '{Number}',
      description: 'The height of the base mip level in pixels.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#height'
  }, {
      title: 'depth',
      description: 'Bits per pixel.'
  }, {
      title: 'alpha',
      description: 'If picture has alpha data.'
  }, {
      title: 'interlaced',
      description: 'If picture is Interlaced. This picture (PNG, JPG) format feature is unavailable for WebGL but is available for use in DOM, making pictures to appear before fully loaded, and load progresively.'
  }, {
      title: 'rgbm',
      subTitle: '{Boolean}',
      description: 'Specifies whether the texture contains RGBM-encoded HDR data. Defaults to false.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#rgbm'
  }, {
      title: 'filtering',
      subTitle: '{pc.FILTER_*}',
      description: 'This property is exposed as minFilter and magFilter to specify how texture is filtered.',
      url: 'http://developer.playcanvas.com/api/pc.Texture.html#magFilter'
  }, {
      name: 'compression',
      title: 'Compression',
      description: 'Compressed textures load faster and consume much less VRAM on GPU allowing texture intense applications to have bigger scale.'
  }, {
      name: 'compress:alpha',
      title: 'Compress Alpha',
      description: 'If compressed texture should have alpha.'
  }, {
      name: 'compress:original',
      title: 'Original Format',
      description: 'Original file format.'
  }, {
      name: 'compress:dxt',
      title: 'DXT (S3 Texture Compression)',
      description: 'S3TC is widely available on Desktop machines. It is very GZIP friendly, download sizes shown are gzip\'ed. It offers two formats available to WebGL: DXT1 and DXT5. Second has extra alpha available and is twice bigger than DXT1. Texture must be power of two resolution. Compression is Lossy and does leak RGB channel values.'
  }, {
      name: 'compress:pvr',
      title: 'PVTC (PowerVR Texture Compression)',
      description: 'Widely available on iOS devices. It is very GZIP friendly, download sizes shown are gzip\'ed. Version 1 of compresison offers four formats to WebGL, differs in BPP and extra Alpha channel. Texture resolution must be square and power of two otherwise will be upscaled to nearest pot square. This format allows to store alpha. Compression is Lossy and does leak RGB channel values, as well as Alpha channel but much less than RGB.'
  }, {
      name: 'compress:pvrBpp',
      title: 'PVR Bits Per Pixel',
      description: 'Bits Per Pixel to store. With options to store 2 or 4 bits per pixel. 2bpp is twice smaller with worse quality.'
  }, {
      name: 'compress:etc',
      title: 'ETC (Ericsson Texture Compression)',
      description: 'This format covers well some Android devices as well as Destop. It is very GZIP friendly, download sizes shown are gzip\'ed. WebGL exposes support for ETC1 only whcih only stores RGB so this format is not available for storing Alpha channel. It is Lossy and suffers from RGB channel leaking.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:texture:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-shader-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'asset',
      title: 'Shader',
      subTitle: '{String}',
      description: 'Text containing GLSL to be used in the application.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:shader:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-font-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'asset',
      title: 'FONT',
      subTitle: '{Font}',
      description: 'A Font that can be used to render text using the Text Component.'
  }, {
      name: 'intensity',
      title: 'intensity',
      description: 'Intensity is used to boost the value read from the signed distance field, 0 is no boost, 1 is max boost. This can be useful if the font does not render with clean smooth edges with the default intensity or if you are rendering the font at small font sizes.'
  }, {
      name: 'customRange',
      title: 'CUSTOM CHARACTER RANGE',
      description: 'Add a custom range of characters by entering their Unicode codes in the From and To fields. E.g. to add all basic Latin characters you could enter 0x20 - 0x7e and click the + button.'
  }, {
      name: 'presets',
      title: 'CHARACTER PRESETS',
      description: 'Click on a character preset to add it to the selected font'
  }, {
      name: 'characters',
      title: 'CHARACTERS',
      description: 'All the characters that should be included in the runtime font asset. Note that in order for a character to be included in the runtime font, it must be supported by the source font. Click Process Font after you make changes to the characters.'
  }, {
      name: 'invert',
      title: 'INVERT',
      description: 'Enable this to invert the generated font texture. Click Process Font after changing this option.'
  }, {
      name: 'pxrange',
      title: 'MULTI-CHANNEL SIGNED DISTANCE PIXEL RANGE',
      description: 'Specifies the width of the range around each font glyph between the minimum and maximum representable signed distance, in pixels. Click Process Font after changing this option.'
  }];

  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:font:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/reference/attributes-asset-sprite-reference.js */
editor.once('load', function() {
  'use strict';

  var fields = [{
      name: 'sprite',
      title: 'pc.Sprite',
      subTitle: '{Class}',
      description: 'A Sprite Asset can contain one or multiple Frames from a Texture Atlas Asset. It can be used by the Sprite Component or the Element component to render those frames. You can also implement sprite animations by adding multiple Frames to a Sprite Asset.',
      url: 'http://developer.playcanvas.com/api/pc.Sprite.html'
  }, {
      title: 'pixelsPerUnit',
      subTitle: '{Number}',
      description: 'The number of pixels that represent one PlayCanvas unit. You can use this value to change the rendered size of your sprites.',
      url: 'http://developer.playcanvas.com/api/pc.Sprite.html#pixelsPerUnit'
  }, {
      title: 'renderMode',
      subTitle: '{Number}',
      description: 'The render mode of the Sprite Asset. It can be Simple, Sliced or Tiled.',
      url: 'http://developer.playcanvas.com/api/pc.Sprite.html#renderMode'
  }, {
      title: 'textureAtlasAsset',
      subTitle: '{Number}',
      description: 'The Texture Atlas asset that contains all the frames that this Sprite Asset is referencing.',
      url: 'http://developer.playcanvas.com/api/pc.Sprite.html#textureAtlasAsset'
  }];

  // fields reference
  for(var i = 0; i < fields.length; i++) {
      fields[i].name = 'asset:sprite:' + (fields[i].name || fields[i].title);
      editor.call('attributes:reference:add', fields[i]);
  }
});


/* editor/attributes/attributes-entity.js */
editor.once('load', function() {
  'use strict';

  var panelComponents;

  editor.method('attributes:entity.panelComponents', function() {
      return panelComponents;
  });

  // add component menu
  var menuAddComponent = new ui.Menu();
  var components = editor.call('components:schema');
  var list = editor.call('components:list');
  for(var i = 0; i < list.length; i++) {
      menuAddComponent.append(new ui.MenuItem({
          text: components[list[i]].$title,
          value: list[i]
      }));
  }
  menuAddComponent.on('open', function() {
      var items = editor.call('selector:items');

      var legacyAudio = editor.call('settings:project').get('useLegacyAudio');
      for(var i = 0; i < list.length; i++) {
          var different = false;
          var disabled = items[0].has('components.' + list[i]);

          for(var n = 1; n < items.length; n++) {
              if (disabled !== items[n].has('components.' + list[i])) {
                  var different = true;
                  break;
              }
          }
          this.findByPath([ list[i] ]).disabled = different ? false : disabled;

          if (list[i] === 'audiosource')
              this.findByPath([list[i]]).hidden = ! legacyAudio;
      }
  });
  menuAddComponent.on('select', function(path) {
      var items = editor.call('selector:items');
      var component = path[0];
      editor.call('entities:addComponent', items, component);
  });
  editor.call('layout.root').append(menuAddComponent);


  editor.method('attributes:entity:addComponentPanel', function(args) {
      var title = args.title;
      var name = args.name;
      var entities = args.entities;
      var events = [ ];

      // panel
      var panel = editor.call('attributes:addPanel', {
          parent: panelComponents,
          name: title
      });
      panel.class.add('component', 'entity', name);
      // reference
      editor.call('attributes:reference:' + name + ':attach', panel, panel.headerElementTitle);

      // show/hide panel
      var checkingPanel;
      var checkPanel = function() {
          checkingPanel = false;

          var show = entities[0].has('components.' + name);
          for(var i = 1; i < entities.length; i++) {
              if (show !== entities[i].has('components.' + name)) {
                  show = false;
                  break;
              }
          }

          panel.disabled = ! show;
          panel.hidden = ! show;
      };
      var queueCheckPanel = function() {
          if (checkingPanel)
              return;

          checkingPanel = true;
          setTimeout(checkPanel);
      }
      checkPanel();
      for(var i = 0; i < entities.length; i++) {
          events.push(entities[i].on('components.' + name + ':set', queueCheckPanel));
          events.push(entities[i].on('components.' + name + ':unset', queueCheckPanel));
      }
      panel.once('destroy', function() {
          for(var i = 0; i < entities.length; i++)
              events[i].unbind();
      });

      // remove
      var fieldRemove = new ui.Button();

      fieldRemove.hidden = ! editor.call('permissions:write');
      events.push(editor.on('permissions:writeState', function(state) {
          fieldRemove.hidden = ! state;
      }));

      fieldRemove.class.add('component-remove');
      fieldRemove.on('click', function() {
          var records = [ ];

          for(var i = 0; i < entities.length; i++) {
              records.push({
                  get: entities[i].history._getItemFn,
                  value: entities[i].get('components.' + name)
              });

              entities[i].history.enabled = false;
              entities[i].unset('components.' + name);
              entities[i].history.enabled = true;
          }

          editor.call('history:add', {
              name: 'entities.set[components.' + name + ']',
              undo: function() {
                  for(var i = 0; i < records.length; i++) {
                      var item = records[i].get();
                      if (! item)
                          continue;

                      item.history.enabled = false;
                      item.set('components.' + name, records[i].value);
                      item.history.enabled = true;
                  }
              },
              redo: function() {
                  for(var i = 0; i < records.length; i++) {
                      var item = records[i].get();
                      if (! item)
                          continue;

                      item.history.enabled = false;
                      item.unset('components.' + name);
                      item.history.enabled = true;
                  }
              }
          });
      });
      panel.headerAppend(fieldRemove);

      // enable/disable
      var fieldEnabled = editor.call('attributes:addField', {
          panel: panel,
          type: 'checkbox',
          link: entities,
          path: 'components.' + name + '.enabled'
      });
      fieldEnabled.class.remove('tick');
      fieldEnabled.class.add('component-toggle');
      fieldEnabled.element.parentNode.removeChild(fieldEnabled.element);
      panel.headerAppend(fieldEnabled);

      // toggle-label
      var labelEnabled = new ui.Label();
      labelEnabled.renderChanges = false;
      labelEnabled.class.add('component-toggle-label');
      panel.headerAppend(labelEnabled);
      labelEnabled.text = fieldEnabled.value ? 'On' : 'Off';
      fieldEnabled.on('change', function(value) {
          labelEnabled.text = value ? 'On' : 'Off';
      });

      return panel;
  });


  var items = null;
  var argsList = [ ];
  var argsFieldsChanges = [ ];


  // initialize fields
  var initialize = function() {
      items = { };

      // panel
      var panel = items.panel = editor.call('attributes:addPanel');
      panel.class.add('component');


      // enabled
      var argsEnabled = {
          parent: panel,
          name: 'Enabled',
          type: 'checkbox',
          path: 'enabled'
      };
      items.fieldEnabled = editor.call('attributes:addField', argsEnabled);
      editor.call('attributes:reference:attach', 'entity:enabled', items.fieldEnabled.parent.innerElement.firstChild.ui);
      argsList.push(argsEnabled);
      argsFieldsChanges.push(items.fieldEnabled);


      // name
      var argsName = {
          parent: panel,
          name: 'Name',
          type: 'string',
          trim: true,
          path: 'name'
      };
      items.fieldName = editor.call('attributes:addField', argsName);
      items.fieldName.class.add('entity-name');
      editor.call('attributes:reference:attach', 'entity:name', items.fieldName.parent.innerElement.firstChild.ui);
      argsList.push(argsName);
      argsFieldsChanges.push(items.fieldName);


      // tags
      var argsTags = {
          parent: panel,
          name: 'Tags',
          placeholder: 'Add Tag',
          type: 'tags',
          tagType: 'string',
          path: 'tags'
      };
      items.fieldTags = editor.call('attributes:addField', argsTags);
      editor.call('attributes:reference:attach', 'entity:tags', items.fieldTags.parent.parent.innerElement.firstChild.ui);
      argsList.push(argsTags);


      // position
      var argsPosition = {
          parent: panel,
          name: 'Position',
          placeholder: [ 'X', 'Y', 'Z' ],
          precision: 3,
          step: 0.05,
          type: 'vec3',
          path: 'position'
      };
      items.fieldPosition = editor.call('attributes:addField', argsPosition);
      editor.call('attributes:reference:attach', 'entity:position', items.fieldPosition[0].parent.innerElement.firstChild.ui);
      argsList.push(argsPosition);
      argsFieldsChanges = argsFieldsChanges.concat(items.fieldPosition);

      // rotation
      var argsRotation = {
          parent: panel,
          name: 'Rotation',
          placeholder: [ 'X', 'Y', 'Z' ],
          precision: 2,
          step: 0.1,
          type: 'vec3',
          path: 'rotation'
      };
      items.fieldRotation = editor.call('attributes:addField', argsRotation);
      editor.call('attributes:reference:attach', 'entity:rotation', items.fieldRotation[0].parent.innerElement.firstChild.ui);
      argsList.push(argsRotation);
      argsFieldsChanges = argsFieldsChanges.concat(items.fieldRotation);


      // scale
      var argsScale = {
          parent: panel,
          name: 'Scale',
          placeholder: [ 'X', 'Y', 'Z' ],
          precision: 3,
          step: 0.05,
          type: 'vec3',
          path: 'scale'
      };
      items.fieldScale = editor.call('attributes:addField', argsScale);
      editor.call('attributes:reference:attach', 'entity:scale', items.fieldScale[0].parent.innerElement.firstChild.ui);
      argsList.push(argsScale);
      argsFieldsChanges = argsFieldsChanges.concat(items.fieldScale);


      // components
      panelComponents = items.panelComponents = editor.call('attributes:addPanel');

      // add component
      var btnAddComponent = items.btnAddComponent = new ui.Button();

      btnAddComponent.hidden = ! editor.call('permissions:write');
      editor.on('permissions:writeState', function(state) {
          btnAddComponent.hidden = ! state;
      });

      btnAddComponent.text = 'Add Component';
      btnAddComponent.class.add('add-component');
      btnAddComponent.on('click', function(evt) {
          menuAddComponent.position(evt.clientX, evt.clientY);
          menuAddComponent.open = true;
      });
      panel.append(btnAddComponent);
  };

  // before clearing inspector, preserve elements
  editor.on('attributes:beforeClear', function() {
      if (! items || ! items.panel.parent)
          return;

      // remove panel from inspector
      items.panel.parent.remove(items.panel);

      // clear components
      items.panelComponents.parent.remove(items.panelComponents);
      items.panelComponents.clear();

      // unlink fields
      for(var i = 0; i < argsList.length; i++) {
          argsList[i].link = null;
          argsList[i].unlinkField();
      }
  });

  var inspectEvents = [];

  // link data to fields when inspecting
  editor.on('attributes:inspect[entity]', function(entities) {
      if (entities.length > 1) {
          editor.call('attributes:header', entities.length + ' Entities');
      } else {
          editor.call('attributes:header', 'Entity');
      }

      if (! items)
          initialize();

      var root = editor.call('attributes.rootPanel');

      if (! items.panel.parent)
          root.append(items.panel);

      if (! items.panelComponents.parent)
          root.append(items.panelComponents);

      // disable renderChanges
      for(var i = 0; i < argsFieldsChanges.length; i++)
          argsFieldsChanges[i].renderChanges = false;

      // link fields
      for(var i = 0; i < argsList.length; i++) {
          argsList[i].link = entities;
          argsList[i].linkField();
      }

      // enable renderChanges
      for(var i = 0; i < argsFieldsChanges.length; i++)
          argsFieldsChanges[i].renderChanges = true;

      // disable fields if needed
      toggleFields(entities);

      onInspect(entities);
  });

  editor.on('attributes:clear', function () {
      onUninspect();
  });

  var toggleFields = function (selectedEntities) {
      var disablePositionXY = false;
      var disableRotation = false;
      var disableScale = false;

      for (var i = 0, len = selectedEntities.length; i < len; i++) {
          var entity = selectedEntities[i];

          // disable rotation / scale for 2D screens
          if (entity.get('components.screen.screenSpace')) {
              disableRotation = true;
              disableScale = true;
          }

          // disable position on the x/y axis for elements that are part of a layout group
          if (editor.call('entities:layout:isUnderControlOfLayoutGroup', entity)) {
              disablePositionXY = true;
          }
      }

      items.fieldPosition[0].enabled = !disablePositionXY;
      items.fieldPosition[1].enabled = !disablePositionXY;

      for (var i = 0; i < 3; i++) {
          items.fieldRotation[i].enabled = !disableRotation;
          items.fieldScale[i].enabled = !disableScale;

          items.fieldRotation[i].renderChanges = !disableRotation;
          items.fieldScale[i].renderChanges = !disableScale;
      }

  };

  var onInspect = function (entities) {
      onUninspect();

      var addEvents = function (entity) {
          inspectEvents.push(entity.on('*:set', function (path) {
              if (/components.screen.screenSpace/.test(path) ||
                  /^parent/.test(path) ||
                  /components.layoutchild.excludeFromLayout/.test(path)) {
                  toggleFieldsIfNeeded(entity);
              }
          }));
      };

      var toggleFieldsIfNeeded = function (entity) {
          if (editor.call('selector:has', entity))
              toggleFields(editor.call('selector:items'));
      };


      for (var i = 0, len = entities.length; i < len; i++) {
          addEvents(entities[i]);
      }
  };

  var onUninspect = function () {
      for (var i = 0; i < inspectEvents.length; i++) {
          inspectEvents[i].unbind();
      }

      inspectEvents.length = 0;

  };
});


/* editor/attributes/components/attributes-components-animation.js */
editor.once('load', function() {
  'use strict';


  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var app = editor.call('viewport:app');
      if (! app) return; // webgl not available


      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Animation',
          name: 'animation',
          entities: entities
      });

      // animation.assets
      var fieldAssets = editor.call('attributes:addAssetsList', {
          panel: panel,
          name: 'Assets',
          type: 'animation',
          link: entities,
          path: 'components.animation.assets',
          reference: 'animation:assets'
      });

      var first = true;
      var initial = true;

      var onAssetAdd = function(item) {
          var btnPlay = new ui.Button();
          btnPlay.class.add('play');
          btnPlay.on('click', function(evt) {
              evt.stopPropagation();

              var id = parseInt(item.asset.get('id'), 10);

              for(var i = 0; i < entities.length; i++) {
                  if (! entities[i].entity || ! entities[i].entity.animation)
                      continue;

                  if (entities[i].entity.animation.assets.indexOf(id) === -1) {
                      entities[i].entity.animation._stopCurrentAnimation();
                      continue;
                  }

                  var name = entities[i].entity.animation.animationsIndex[id];
                  if (! name) continue;

                  entities[i].entity.animation.play(name);
              }
          });
          btnPlay.parent = item;
          item.element.appendChild(btnPlay.element);

          if (first || ! initial) {
              first = false;
              var id = item.asset.get('id');
              var asset = app.assets.get(id);

              var onAssetAdd = function(asset) {
                  if (asset.resource) {
                      editor.once('viewport:update', function() {
                          btnPlay.element.click();
                      });
                  } else {
                      asset.once('load', function() {
                          btnPlay.element.click();
                      });
                  }
              };

              if (asset) {
                  onAssetAdd(asset);
              } else {
                  app.assets.once('add:' + id, onAssetAdd);
              }
          }

          item.once('destroy', function() {
              var id = parseInt(item.asset.get('id'), 10);

              for(var i = 0; i < entities.length; i++) {
                  if (! entities[i].entity || ! entities[i].entity.animation || entities[i].entity.animation.assets.indexOf(id) === -1)
                      continue;

                  var name = entities[i].entity.animation.animationsIndex[id];
                  if (! name || entities[i].entity.animation.currAnim !== name)
                      continue;

                  entities[i].entity.animation._stopCurrentAnimation();
              }
          });
      };

      var nodes = fieldAssets.element.childNodes;
      for(var i = 0; i < nodes.length; i++) {
          if (! nodes[i].ui || ! nodes[i].ui.asset)
              continue;

          onAssetAdd(nodes[i].ui);
      }
      initial = false;

      if (first) {
          first = false;

          for(var i = 0; i < entities.length; i++) {
              if (! entities[i].entity || ! entities[i].entity.animation)
                  continue;

              entities[i].entity.animation._stopCurrentAnimation();
          }
      }

      fieldAssets.on('append', onAssetAdd);

      // animation.speed
      var fieldSpeed = editor.call('attributes:addField', {
          parent: panel,
          name: 'Speed',
          type: 'number',
          precision: 3,
          step: 0.1,
          link: entities,
          path: 'components.animation.speed'
      });
      fieldSpeed.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'animation:speed', fieldSpeed.parent.innerElement.firstChild.ui);

      // intensity slider
      var fieldSpeedSlider = editor.call('attributes:addField', {
          panel: fieldSpeed.parent,
          precision: 3,
          step: 0.1,
          min: -2,
          max: 2,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.animation.speed'
      });
      fieldSpeedSlider.flexGrow = 4;


      // animation.playback
      var panelPlayback = new ui.Panel();
      editor.call('attributes:addField', {
          parent: panel,
          name: 'Playback',
          type: 'element',
          element: panelPlayback
      });

      // animation.activate
      var fieldActivate = editor.call('attributes:addField', {
          panel: panelPlayback,
          type: 'checkbox',
          link: entities,
          path: 'components.animation.activate'
      });
      // label
      var label = new ui.Label({ text: 'Activate' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      panelPlayback.append(label);
      // reference activate
      editor.call('attributes:reference:attach', 'animation:activate', label);

      // animation.loop
      var fieldLoop = editor.call('attributes:addField', {
          panel: panelPlayback,
          type: 'checkbox',
          link: entities,
          path: 'components.animation.loop'
      });
      // label
      var label = new ui.Label({ text: 'Loop' });
      label.class.add('label-infield');
      panelPlayback.append(label);
      // reference loop
      editor.call('attributes:reference:attach', 'animation:loop', label);
  });
});


/* editor/attributes/components/attributes-components-audiolistener.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Audio Listener',
          name: 'audiolistener',
          entities: entities
      });
  });
});


/* editor/attributes/components/attributes-components-audiosource.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Audio Source',
          name: 'audiosource',
          entities: entities
      });

      // audiosource.assets
      var fieldAssets = editor.call('attributes:addAssetsList', {
          type: 'audio',
          name: 'Assets',
          link: entities,
          panel: panel,
          path: 'components.audiosource.assets',
          reference: 'audiosource:assets'
      });

      // audiosource.playback
      var panelPlayback = new ui.Panel();
      editor.call('attributes:addField', {
          parent: panel,
          name: 'Playback',
          type: 'element',
          element: panelPlayback
      });

      // audiosource.activate
      var fieldActivate = editor.call('attributes:addField', {
          panel: panelPlayback,
          type: 'checkbox',
          link: entities,
          path: 'components.audiosource.activate'
      });
      // label
      var label = new ui.Label({ text: 'Activate' });
      label.class.add('label-infield');
      panelPlayback.append(label);
      // reference
      editor.call('attributes:reference:attach', 'audiosource:activate', label);

      // audiosource.loop
      var fieldLoop = editor.call('attributes:addField', {
          panel: panelPlayback,
          type: 'checkbox',
          link: entities,
          path: 'components.audiosource.loop'
      });
      // label
      var label = new ui.Label({ text: 'Loop' });
      label.class.add('label-infield');
      panelPlayback.append(label);
      // reference
      editor.call('attributes:reference:attach', 'audiosource:loop', label);

      // audiosource.3d
      var field3d = editor.call('attributes:addField', {
          panel: panelPlayback,
          type: 'checkbox',
          link: entities,
          path: 'components.audiosource.3d'
      });
      field3d.on('change', function (value) {
          panelDistance.hidden = fieldRollOffFactor.parent.hidden = ! (field3d.value || field3d.class.contains('null'));
      });
      // label
      label = new ui.Label({ text: '3D' });
      label.class.add('label-infield');
      panelPlayback.append(label);
      // reference
      editor.call('attributes:reference:attach', 'audiosource:3d', label);


      // volume
      var fieldVolume = editor.call('attributes:addField', {
          parent: panel,
          name: 'Volume',
          type: 'number',
          precision: 2,
          step: 0.01,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.audiosource.volume'
      });
      fieldVolume.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'audiosource:volume', fieldVolume.parent.innerElement.firstChild.ui);

      // volume slider
      var fieldVolumeSlider = editor.call('attributes:addField', {
          panel: fieldVolume.parent,
          precision: 2,
          step: 0.01,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.audiosource.volume'
      });
      fieldVolumeSlider.flexGrow = 4;

      // pitch
      var fieldPitch = editor.call('attributes:addField', {
          parent: panel,
          name: 'Pitch',
          type: 'number',
          precision: 2,
          step: 0.1,
          min: 0,
          link: entities,
          path: 'components.audiosource.pitch'
      });
      // reference
      editor.call('attributes:reference:attach', 'audiosource:pitch', fieldPitch.parent.innerElement.firstChild.ui);


      // distance
      var panelDistance = editor.call('attributes:addField', {
          parent: panel,
          name: 'Distance'
      });
      var label = panelDistance;
      panelDistance = panelDistance.parent;
      label.destroy();
      panelDistance.hidden = ! (field3d.value || field3d.class.contains('null'));

      // reference
      editor.call('attributes:reference:attach', 'audiosource:distance', panelDistance.innerElement.firstChild.ui);

      // minDistance
      var fieldMinDistance = editor.call('attributes:addField', {
          panel: panelDistance,
          placeholder: 'Min',
          type: 'number',
          precision: 2,
          step: 1,
          min: 0,
          link: entities,
          path: 'components.audiosource.minDistance'
      });
      fieldMinDistance.style.width = '32px';
      fieldMinDistance.flexGrow = 1;

      // maxDistance
      var fieldMaxDistance = editor.call('attributes:addField', {
          panel: panelDistance,
          placeholder: 'Max',
          type: 'number',
          precision: 2,
          step: 1,
          min: 0,
          link: entities,
          path: 'components.audiosource.maxDistance'
      });
      fieldMaxDistance.style.width = '32px';
      fieldMaxDistance.flexGrow = 1;

      // audiosource.rollOffFactor
      var fieldRollOffFactor = editor.call('attributes:addField', {
          parent: panel,
          name: 'Roll-off factor',
          type: 'number',
          precision: 2,
          step: 0.1,
          min: 0,
          link: entities,
          path: 'components.audiosource.rollOffFactor'
      });
      fieldRollOffFactor.parent.hidden = ! (field3d.value || field3d.class.contains('null'));
      // reference
      editor.call('attributes:reference:attach', 'audiosource:rollOffFactor', fieldRollOffFactor.parent.innerElement.firstChild.ui);
  });
});


/* editor/attributes/components/attributes-components-sound.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Sound',
          name: 'sound',
          entities: entities
      });

      // positional
      var fieldPositional = editor.call('attributes:addField', {
          parent: panel,
          type: 'checkbox',
          name: 'Positional',
          link: entities,
          path: 'components.sound.positional'
      });
      // reference
      editor.call('attributes:reference:attach', 'sound:positional', fieldPositional.parent.innerElement.firstChild.ui);

      fieldPositional.on('change', function (value) {
          panelDistance.hidden = fieldDistanceModel.parent.hidden = fieldRollOffFactor.parent.hidden = ! (fieldPositional.value || fieldPositional.class.contains('null'));
      });

      // volume
      var fieldVolume = editor.call('attributes:addField', {
          parent: panel,
          name: 'Volume',
          type: 'number',
          precision: 2,
          step: 0.01,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.sound.volume'
      });
      fieldVolume.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'sound:volume', fieldVolume.parent.innerElement.firstChild.ui);

      // volume slider
      var fieldVolumeSlider = editor.call('attributes:addField', {
          panel: fieldVolume.parent,
          precision: 2,
          step: 0.01,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.sound.volume'
      });
      fieldVolumeSlider.flexGrow = 4;

      // pitch
      var fieldPitch = editor.call('attributes:addField', {
          parent: panel,
          name: 'Pitch',
          type: 'number',
          precision: 2,
          step: 0.1,
          min: 0,
          link: entities,
          path: 'components.sound.pitch'
      });
      // reference
      editor.call('attributes:reference:attach', 'sound:pitch', fieldPitch.parent.innerElement.firstChild.ui);


      // distance
      var panelDistance = editor.call('attributes:addField', {
          parent: panel,
          name: 'Distance'
      });
      var label = panelDistance;
      panelDistance = panelDistance.parent;
      label.destroy();
      panelDistance.hidden = ! (fieldPositional.value || fieldPositional.class.contains('null'));

      // reference
      editor.call('attributes:reference:attach', 'sound:distance', panelDistance.innerElement.firstChild.ui);

      // refDistance
      var fieldRefDistance = editor.call('attributes:addField', {
          panel: panelDistance,
          placeholder: 'Ref',
          type: 'number',
          precision: 2,
          step: 1,
          min: 0,
          link: entities,
          path: 'components.sound.refDistance'
      });
      fieldRefDistance.style.width = '32px';
      fieldRefDistance.flexGrow = 1;

      // maxDistance
      var fieldMaxDistance = editor.call('attributes:addField', {
          panel: panelDistance,
          placeholder: 'Max',
          type: 'number',
          precision: 2,
          step: 1,
          min: 0,
          link: entities,
          path: 'components.sound.maxDistance'
      });
      fieldRefDistance.style.width = '32px';
      fieldRefDistance.flexGrow = 1;

      // distanceModel
      var fieldDistanceModel = editor.call('attributes:addField', {
          parent: panel,
          name: 'Distance Model',
          type: 'string',
          enum: {
              linear: 'Linear',
              exponential: 'Exponential',
              inverse: 'Inverse'
          },
          link: entities,
          path: 'components.sound.distanceModel'
      });

      fieldDistanceModel.parent.hidden = ! (fieldPositional.value || fieldPositional.class.contains('null'));

      // reference
      editor.call('attributes:reference:attach', 'sound:distanceModel', fieldDistanceModel.parent.innerElement.firstChild.ui);

      // rollOffFactor
      var fieldRollOffFactor = editor.call('attributes:addField', {
          parent: panel,
          name: 'Roll-off factor',
          type: 'number',
          precision: 2,
          step: 0.1,
          min: 0,
          link: entities,
          path: 'components.sound.rollOffFactor'
      });
      fieldRollOffFactor.parent.hidden = ! (fieldPositional.value || fieldPositional.class.contains('null'));

      // reference
      editor.call('attributes:reference:attach', 'sound:rollOffFactor', fieldRollOffFactor.parent.innerElement.firstChild.ui);

      // show something when multiple entities are enabled for slots
      if (entities.length > 1) {
          editor.call('attributes:addField', {
              parent: panel,
              name: 'Slots',
              value: '...'
          });
      }

      // slots
      var panelSlots = new ui.Panel();
      panelSlots.class.add('sound-slots');
      panel.append(panelSlots);
      panelSlots.hidden = (entities.length > 1);

      // Create UI for each slot
      var createSlot = function (key, slot, focus) {
          // slot panel
          var panelSlot = new ui.Panel(slot.name || 'New Slot' );
          panelSlot.class.add('sound-slot');
          panelSlot.element.id = 'sound-slot-' + key;
          panelSlot.foldable = true;
          panelSlot.folded = false;
          panelSlots.append(panelSlot);

          // reference
          editor.call('attributes:reference:attach', 'sound:slot:slot', panelSlot, panelSlot.headerElementTitle);

          // button to remove slot
          var btnRemove = new ui.Button();
          btnRemove.class.add('remove');
          panelSlot.headerElement.appendChild(btnRemove.element);
          btnRemove.on('click', function () {
              entities[0].unset('components.sound.slots.' + key);
          });

          // slot name
          var fieldSlotName = editor.call('attributes:addField', {
              parent: panelSlot,
              name: 'Name',
              type: 'string'
          });

          // reference
          editor.call('attributes:reference:attach', 'sound:slot:name', fieldSlotName.parent.innerElement.firstChild.ui);

          // set initial value
          fieldSlotName.value = slot.name;

          var suspendKeyUp = false;
          fieldSlotName.elementInput.addEventListener('keyup', function (e) {
              if (suspendKeyUp) return;

              // if the name already exists show error
              var error = false;
              var value = fieldSlotName.value;
              for (var k in slots) {
                  if (k === key) continue;

                  if (slots[k].name === value) {
                      fieldSlotName.class.add('error');
                      return;
                  }
              }

              // no error so make the field go back to normal
              fieldSlotName.class.remove('error');
          });

          var suspend = false;
          // manually change entity on change event
          fieldSlotName.on('change', function (value) {
              // change header to new name
              panelSlot.header = value || 'New Slot';

              if (suspend) return;

              var prevValue = entities[0].get('components.sound.slots.' + key + '.name');
              var slots = entities[0].get('components.sound.slots');
              for (var k in slots) {

                  // revert slot name to previous value
                  if (slots[k].name === value) {
                      suspend = true;
                      suspendKeyUp = true;
                      fieldSlotName.value = prevValue;
                      fieldSlotName.class.remove('error');
                      suspendKeyUp = false;
                      suspend = false;
                      return;
                  }
              }

              entities[0].set('components.sound.slots.' + key + '.name', value);
          });

          // unbind events
          var evtChange = entities[0].on('components.sound.slots.' + key + '.name:set', function (value) {
              suspend = true;
              fieldSlotName.value = value;
              suspend = false;
          });

          var evtUnset = entities[0].on('components.sound.slots.' + key + ':unset', function () {
              if (evtChange) {
                  evtChange.unbind();
                  evtChange = null;
              }

              if (evtUnset) {
                  evtUnset.unbind();
                  evtUnset.unbind();
              }
          });

          panel.on('destroy', function () {
              if (evtChange) {
                  evtChange.unbind();
                  evtChange = null;
              }

              if (evtUnset) {
                  evtUnset.unbind();
                  evtUnset.unbind();
              }
          });

          var fieldSlotAsset = editor.call('attributes:addField', {
              parent: panelSlot,
              name: 'Asset',
              type: 'asset',
              kind: 'audio',
              link: entities,
              path: 'components.sound.slots.' + key + '.asset'
          });

          // reference
          editor.call('attributes:reference:attach', 'sound:slot:asset', fieldSlotAsset._label);

          // range
          var panelRange = editor.call('attributes:addField', {
              parent: panelSlot,
              name: 'Range'
          });
          var label = panelRange;
          panelRange = panelRange.parent;
          label.destroy();

          // startTime
          var fieldSlotStartTime = editor.call('attributes:addField', {
              panel: panelRange,
              placeholder: 'Start',
              type: 'number',
              precision: 2,
              step: 0.01,
              min: 0,
              link: entities,
              path: 'components.sound.slots.' + key + '.startTime'
          });
          fieldSlotStartTime.style.width = '32px';
          fieldSlotStartTime.flexGrow = 1;

          // reference
          editor.call('attributes:reference:attach', 'sound:slot:startTime', fieldSlotStartTime);

          // duration
          var fieldSlotDuration = editor.call('attributes:addField', {
              panel: panelRange,
              placeholder: 'Duration',
              type: 'number',
              precision: 2,
              step: 0.01,
              min: 0,
              link: entities,
              path: 'components.sound.slots.' + key + '.duration'
          });
          fieldSlotDuration.style.width = '32px';
          fieldSlotDuration.flexGrow = 1;

          // reference
          editor.call('attributes:reference:attach', 'sound:slot:duration', fieldSlotDuration);

          // playback
          var panelPlayback = editor.call('attributes:addField', {
              parent: panelSlot,
              name: 'Playback'
          });
          label = panelPlayback;
          panelPlayback = panelPlayback.parent;
          label.destroy();

          var fieldSlotAutoPlay = editor.call('attributes:addField', {
              panel: panelPlayback,
              type: 'checkbox',
              link: entities,
              path: 'components.sound.slots.' + key + '.autoPlay'
          });
          // label
          label = new ui.Label({ text: 'Auto Play' });
          label.class.add('label-infield');
          panelPlayback.append(label);

          // reference
          editor.call('attributes:reference:attach', 'sound:slot:autoPlay', label);

          var fieldSlotOverlap = editor.call('attributes:addField', {
              panel: panelPlayback,
              type: 'checkbox',
              link: entities,
              path: 'components.sound.slots.' + key + '.overlap'
          });
          // label
          label = new ui.Label({ text: 'Overlap' });
          label.class.add('label-infield');
          panelPlayback.append(label);

          // reference
          editor.call('attributes:reference:attach', 'sound:slot:overlap', label);

          var fieldSlotLoop = editor.call('attributes:addField', {
              panel: panelPlayback,
              type: 'checkbox',
              link: entities,
              path: 'components.sound.slots.' + key + '.loop'
          });
          // label
          label = new ui.Label({ text: 'Loop' });
          label.class.add('label-infield');
          panelPlayback.append(label);

          // reference
          editor.call('attributes:reference:attach', 'sound:slot:loop', label);

          // slot volume
          var fieldSlotVolume = editor.call('attributes:addField', {
              parent: panelSlot,
              name: 'Volume',
              type: 'number',
              precision: 2,
              step: 0.01,
              min: 0,
              max: 1,
              link: entities,
              path: 'components.sound.slots.' + key + '.volume'
          });

          // reference
          editor.call('attributes:reference:attach', 'sound:slot:volume', fieldSlotVolume.parent.innerElement.firstChild.ui);

          // volume slider
          var fieldSlotVolumeSlider = editor.call('attributes:addField', {
              panel: fieldSlotVolume.parent,
              precision: 2,
              step: 0.01,
              min: 0,
              max: 1,
              type: 'number',
              slider: true,
              link: entities,
              path: 'components.sound.slots.' + key + '.volume'
          });
          fieldSlotVolume.style.width = '32px';
          fieldSlotVolumeSlider.flexGrow = 4;

          // slot pitch
          var fieldSlotPitch = editor.call('attributes:addField', {
              parent: panelSlot,
              name: 'Pitch',
              type: 'number',
              precision: 2,
              step: 0.1,
              min: 0,
              link: entities,
              path: 'components.sound.slots.' + key + '.pitch'
          });

          // reference
          editor.call('attributes:reference:attach', 'sound:slot:pitch', fieldSlotPitch.parent.innerElement.firstChild.ui);

          if (focus) {
              fieldSlotName.elementInput.focus();
              fieldSlotName.elementInput.select();
          }
      };

      // create slot button
      var btnCreateSlot = new ui.Button({
          text: 'Add Slot'
      });
      btnCreateSlot.class.add('add-sound-slot');
      btnCreateSlot.hidden = entities.length > 1;
      panel.append(btnCreateSlot);

      btnCreateSlot.on('click', function () {
          var keyName = 1;
          var count = 0;
          var idx = {};
          slots = entities[0].get('components.sound.slots');
          for (var key in slots) {
              keyName = parseInt(key, 10);
              idx[slots[key].name] = true;
              count++;
          }

          keyName = keyName + 1;
          name = 'Slot ' + (count + 1);
          while (idx[name]) {
              count++;
              name = 'Slot ' + (count + 1);
          }

          entities[0].set('components.sound.slots.' + (keyName), {
              name: name,
              loop: false,
              autoPlay: false,
              overlap: false,
              asset: null,
              startTime: 0,
              duration: null,
              volume: 1,
              pitch: 1
          });
      });

      // create slots for first entity only
      var slots = entities[0].get('components.sound.slots');
      for (var key in slots) {
          createSlot(key, slots[key]);
      }

      // add event for new slots
      var evtAddSlot = entities[0].on('*:set', function (path, value) {
          var matches = path.match(/^components.sound.slots.(\d+)$/);
          if (! matches) return;

          createSlot(matches[1], value, true);
      });

      // add event for deletings slots
      var evtRemoveSlot = entities[0].on('*:unset', function (path, value) {
          var matches = path.match(/^components.sound.slots.(\d+)$/);
          if (! matches) return;

          var slotPanel = document.getElementById('sound-slot-' + matches[1]);
          if (slotPanel) {
              slotPanel.parentElement.removeChild(slotPanel);
          }
      });

      panel.on('destroy', function () {
          if (evtAddSlot)
              evtAddSlot.unbind();

          if (evtRemoveSlot)
              evtRemoveSlot.unbind();
      });
  });
});


/* editor/attributes/components/attributes-components-camera.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var projectSettings = editor.call('settings:project');

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Camera',
          name: 'camera',
          entities: entities
      });


      // clearColorBuffer
      var fieldClearColorBuffer = editor.call('attributes:addField', {
          parent: panel,
          type: 'checkbox',
          name: 'Clear Buffers',
          link: entities,
          path: 'components.camera.clearColorBuffer'
      });
      // label
      var label = new ui.Label({ text: 'Color' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      fieldClearColorBuffer.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'camera:clearColorBuffer', label);


      // clearDepthBuffer
      var fieldCastShadows = editor.call('attributes:addField', {
          panel: fieldClearColorBuffer.parent,
          type: 'checkbox',
          link: entities,
          path: 'components.camera.clearDepthBuffer'
      });
      // label
      var label = new ui.Label({ text: 'Depth' });
      label.class.add('label-infield');
      fieldClearColorBuffer.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'camera:clearDepthBuffer', label);


      // camera.clearColor
      var fieldClearColor = editor.call('attributes:addField', {
          parent: panel,
          name: 'Clear Color',
          type: 'rgb',
          link: entities,
          path: 'components.camera.clearColor'
      });
      fieldClearColor.parent.hidden = ! (fieldClearColorBuffer.value || fieldClearColorBuffer.class.contains('null'));
      fieldClearColorBuffer.on('change', function(value) {
          fieldClearColor.parent.hidden = ! (value || this.class.contains('null'));
      });
      // reference
      editor.call('attributes:reference:attach', 'camera:clearColor', fieldClearColor.parent.innerElement.firstChild.ui);


      // camera.projection
      var fieldProjection = editor.call('attributes:addField', {
          parent: panel,
          name: 'Projection',
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'Perspective' }, // pc.PROJECTION_PERSPECTIVE
              { v: 1, t: 'Orthographic' } // pc.PROJECTION_ORTHOGRAPHIC
          ],
          link: entities,
          path: 'components.camera.projection'
      });
      // reference
      editor.call('attributes:reference:attach', 'camera:projection', fieldProjection.parent.innerElement.firstChild.ui);

      // frustumCulling
      var fieldFrustumCulling = editor.call('attributes:addField', {
          parent: panel,
          type: 'checkbox',
          name: 'Frustum Culling',
          link: entities,
          path: 'components.camera.frustumCulling'
      });
      // reference
      editor.call('attributes:reference:attach', 'camera:frustumCulling', fieldFrustumCulling.parent.innerElement.firstChild.ui);

      // camera.fov
      var fieldFov = editor.call('attributes:addField', {
          parent: panel,
          name: 'Field of View',
          placeholder: '\u00B0',
          type: 'number',
          precision: 2,
          step: 1,
          min: 0,
          link: entities,
          path: 'components.camera.fov'
      });
      fieldFov.style.width = '32px';
      fieldFov.parent.hidden = fieldProjection.value !== 0 && fieldProjection.value !== '';
      fieldProjection.on('change', function(value) {
          fieldFov.parent.hidden = value !== 0 && value !== '';
      });
      // reference
      editor.call('attributes:reference:attach', 'camera:fov', fieldFov.parent.innerElement.firstChild.ui);

      // fov slider
      var fieldFovSlider = editor.call('attributes:addField', {
          panel: fieldFov.parent,
          precision: 2,
          step: 1,
          min: 0,
          max: 90,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.camera.fov'
      });
      fieldFovSlider.flexGrow = 4;

      // camera.orthoHeight
      var fieldOrthoHeight = editor.call('attributes:addField', {
          parent: panel,
          name: 'Ortho Height',
          type: 'number',
          link: entities,
          path: 'components.camera.orthoHeight'
      });
      fieldOrthoHeight.parent.hidden = fieldProjection.value !== 1 && fieldProjection.value !== '';
      fieldProjection.on('change', function(value) {
          fieldOrthoHeight.parent.hidden = value !== 1 && value !== '';
      });
      // reference
      editor.call('attributes:reference:attach', 'camera:orthoHeight', fieldOrthoHeight.parent.innerElement.firstChild.ui);


      // nearClip
      var fieldNearClip = editor.call('attributes:addField', {
          parent: panel,
          name: 'Clip',
          placeholder: 'Near',
          type: 'number',
          precision: 4,
          step: .1,
          min: 0,
          link: entities,
          path: 'components.camera.nearClip'
      });
      fieldNearClip.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'camera:clip', fieldNearClip.parent.innerElement.firstChild.ui);


      // farClip
      var fieldFarClip = editor.call('attributes:addField', {
          panel: fieldNearClip.parent,
          placeholder: 'Far',
          type: 'number',
          precision: 4,
          step: .1,
          min: 0,
          link: entities,
          path: 'components.camera.farClip'
      });
      fieldFarClip.style.width = '32px';


      // camera.priority
      var fieldPriority = editor.call('attributes:addField', {
          parent: panel,
          name: 'Priority',
          type: 'number',
          precision: 1,
          step: 1,
          min: 0,
          link: entities,
          path: 'components.camera.priority'
      });
      // reference
      editor.call('attributes:reference:attach', 'camera:priority', fieldPriority.parent.innerElement.firstChild.ui);


      // camera.rect
      var fieldRect = editor.call('attributes:addField', {
          parent: panel,
          name: 'Viewport',
          placeholder: [ 'X', 'Y', 'W', 'H' ],
          type: 'vec4',
          precision: 3,
          step: 0.01,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.camera.rect'
      });
      // reference
      editor.call('attributes:reference:attach', 'camera:rect', fieldRect[0].parent.innerElement.firstChild.ui);

      // layers
      var layers = projectSettings.get('layers');
      var layersEnum = {
          '': ''
      };
      for (var key in layers) {
          layersEnum[key] = layers[key].name;
      }

      var fieldLayers = editor.call('attributes:addField', {
          parent: panel,
          name: 'Layers',
          type: 'tags',
          tagType: 'number',
          enum: layersEnum,
          placeholder: 'Add Layer',
          link: entities,
          path: 'components.camera.layers',
          tagToString: function (tag) {
              return projectSettings.get('layers.' + tag + '.name') || 'Missing';
          },
          onClickTag: function () {
              // focus layer
              var layerId = this.originalValue;
              editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
              setTimeout(function () {
                  editor.call('editorSettings:layers:focus', layerId);
              });
          }
      });

      // reference
      editor.call('attributes:reference:attach', 'camera:layers', fieldLayers.parent.parent.innerElement.firstChild.ui);
  });
});


/* editor/attributes/components/attributes-components-collision.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var events = [ ];

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Collision',
          name: 'collision',
          entities: entities
      });


      // type
      var fieldType = editor.call('attributes:addField', {
          parent: panel,
          name: 'Type',
          type: 'string',
          enum: {
              '': '...',
              'box': 'Box',
              'sphere': 'Sphere',
              'capsule': 'Capsule',
              'cylinder': 'Cylinder',
              'mesh': 'Mesh'
          },
          link: entities,
          path: 'components.collision.type'
      });
      // reference
      editor.call('attributes:reference:attach', 'collision:type', fieldType.parent.innerElement.firstChild.ui);


      // halfExtents
      var fieldHalfExtents = editor.call('attributes:addField', {
          parent: panel,
          name: 'Half Extents',
          placeholder: [ 'X', 'Y', 'Z' ],
          precision: 3,
          step: 0.1,
          min: 0,
          type: 'vec3',
          link: entities,
          path: 'components.collision.halfExtents'
      });
      fieldHalfExtents[0].parent.hidden = fieldType.value !== 'box' && fieldType.value !== '';
      fieldType.on('change', function(value) {
          fieldHalfExtents[0].parent.hidden = value !== 'box' && value !== '';
      });
      // reference
      editor.call('attributes:reference:attach', 'collision:halfExtents', fieldHalfExtents[0].parent.innerElement.firstChild.ui);


      // radius
      var fieldRadius = editor.call('attributes:addField', {
          parent: panel,
          name: 'Radius',
          type: 'number',
          precision: 2,
          step: 0.1,
          min: 0,
          link: entities,
          path: 'components.collision.radius'
      });
      fieldRadius.parent.hidden = fieldType.value !== '' && [ 'sphere', 'capsule', 'cylinder' ].indexOf(fieldType.value) === -1;
      fieldType.on('change', function(value) {
          fieldRadius.parent.hidden = value !== '' && [ 'sphere', 'capsule', 'cylinder' ].indexOf(value) === -1;
      });
      // reference
      editor.call('attributes:reference:attach', 'collision:radius', fieldRadius.parent.innerElement.firstChild.ui);


      // height
      var fieldHeight = editor.call('attributes:addField', {
          parent: panel,
          name: 'Height',
          type: 'number',
          precision: 2,
          step: 0.1,
          min: 0,
          link: entities,
          path: 'components.collision.height'
      });
      // show/hide
      fieldHeight.parent.hidden = fieldType.value !== '' && [ 'capsule', 'cylinder' ].indexOf(fieldType.value) === -1;
      fieldType.on('change', function(value) {
          fieldHeight.parent.hidden = value !== '' && [ 'capsule', 'cylinder' ].indexOf(value) === -1;
      });
      // reference
      editor.call('attributes:reference:attach', 'collision:height', fieldHeight.parent.innerElement.firstChild.ui);


      // axis
      var fieldAxis = editor.call('attributes:addField', {
          parent: panel,
          name: 'Axis',
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'X' },
              { v: 1, t: 'Y' },
              { v: 2, t: 'Z' }
          ],
          link: entities,
          path: 'components.collision.axis'
      });
      fieldAxis.parent.hidden = fieldType.value !== '' && [ 'capsule', 'cylinder' ].indexOf(fieldType.value) === -1;
      fieldType.on('change', function(value) {
          fieldAxis.parent.hidden = value !== '' && [ 'capsule', 'cylinder' ].indexOf(value) === -1;
      });
      // reference
      editor.call('attributes:reference:attach', 'collision:axis', fieldAxis.parent.innerElement.firstChild.ui);


      // asset
      var fieldAsset = editor.call('attributes:addField', {
          parent: panel,
          name: 'Asset',
          type: 'asset',
          kind: 'model',
          link: entities,
          path: 'components.collision.asset'
      });
      fieldAsset.parent.hidden = fieldType.value !== '' && fieldType.value !== 'mesh';
      fieldType.on('change', function(value) {
          fieldAsset.parent.hidden = value !== '' && value !== 'mesh';
      });
      // reference
      editor.call('attributes:reference:attach', 'collision:asset', fieldAsset._label);
  });
});


/* editor/attributes/components/attributes-components-light.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var events = [ ];

      var projectSettings = editor.call('settings:project');

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Light',
          name: 'light',
          entities: entities
      });


      // type
      var fieldType = editor.call('attributes:addField', {
          parent: panel,
          name: 'Type',
          type: 'string',
          enum: {
              '': '...',
              'directional': 'Directional',
              'spot': 'Spot',
              'point': 'Point'
          },
          link: entities,
          path: 'components.light.type'
      });
      // reference
      editor.call('attributes:reference:attach', 'light:type', fieldType.parent.innerElement.firstChild.ui);


      // color
      var fieldColor = editor.call('attributes:addField', {
          parent: panel,
          name: 'Color',
          type: 'rgb',
          link: entities,
          path: 'components.light.color'
      });
      // reference
      editor.call('attributes:reference:attach', 'light:color', fieldColor.parent.innerElement.firstChild.ui);


      // intensity
      var fieldIntensity = editor.call('attributes:addField', {
          parent: panel,
          name: 'Intensity',
          type: 'number',
          precision: 2,
          step: .1,
          min: 0,
          max: 32,
          link: entities,
          path: 'components.light.intensity'
      });
      fieldIntensity.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'light:intensity', fieldIntensity.parent.innerElement.firstChild.ui);

      // intensity slider
      var fieldIntensitySlider = editor.call('attributes:addField', {
          panel: fieldIntensity.parent,
          precision: 2,
          step: .1,
          min: 0,
          max: 32,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.light.intensity'
      });
      fieldIntensitySlider.flexGrow = 4;


      // range
      var fieldRange = editor.call('attributes:addField', {
          parent: panel,
          name: 'Range',
          type: 'number',
          precision: 2,
          step: .1,
          min: 0,
          link: entities,
          path: 'components.light.range'
      });
      fieldRange.parent.hidden = ! (fieldType.value === '' || fieldType.value !== 'directional');
      fieldType.on('change', function(value) {
          fieldRange.parent.hidden = ! (value === '' || value !== 'directional');
      });
      // reference
      editor.call('attributes:reference:attach', 'light:range', fieldRange.parent.innerElement.firstChild.ui);


      // falloffMode
      var fieldFalloffMode = editor.call('attributes:addField', {
          parent: panel,
          name: 'Falloff Mode',
          type: 'number',
          enum: {
              0: 'Linear',
              1: 'Inverse Squared'
          },
          link: entities,
          path: 'components.light.falloffMode'
      });
      fieldFalloffMode.parent.hidden = ! (fieldType.value === '' || fieldType.value !== 'directional');
      fieldType.on('change', function(value) {
          fieldFalloffMode.parent.hidden = ! (value === '' || value !== 'directional');
      });
      // reference
      editor.call('attributes:reference:attach', 'light:falloffMode', fieldFalloffMode.parent.innerElement.firstChild.ui);


      // innerConeAngle
      var fieldInnerConeAngle = editor.call('attributes:addField', {
          parent: panel,
          name: 'Cone Angles',
          placeholder: 'Inner',
          type: 'number',
          precision: 2,
          step: 1,
          min: 0,
          max: 90,
          link: entities,
          path: 'components.light.innerConeAngle'
      });
      fieldInnerConeAngle.style.width = '32px';
      fieldInnerConeAngle.parent.hidden = ! (fieldType.value === '' || fieldType.value === 'spot');
      fieldType.on('change', function(value) {
          fieldInnerConeAngle.parent.hidden = ! (value === '' || value === 'spot');
      });
      // reference
      editor.call('attributes:reference:attach', 'light:coneAngles', fieldInnerConeAngle.parent.innerElement.firstChild.ui);


      // outerConeAngle
      var fieldOuterConeAngle = editor.call('attributes:addField', {
          panel: fieldInnerConeAngle.parent,
          placeholder: 'Outer',
          type: 'number',
          precision: 2,
          step: 1,
          min: 0,
          max: 90,
          link: entities,
          path: 'components.light.outerConeAngle'
      });
      fieldOuterConeAngle.style.width = '32px';


      // divider
      var divider = document.createElement('div');
      divider.classList.add('fields-divider');
      panel.append(divider);


      // isStatic
      var fieldIsStatic = editor.call('attributes:addField', {
          parent: panel,
          name: 'States',
          type: 'checkbox',
          link: entities,
          path: 'components.light.isStatic'
      });
      // label
      var label = new ui.Label({ text: 'Static' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      fieldIsStatic.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'light:isStatic', label);


      // bake
      var fieldLightMap = editor.call('attributes:addField', {
          parent: panel,
          name: 'Lightmap',
          type: 'checkbox',
          link: entities,
          path: 'components.light.bake'
      });
      // label
      var label = new ui.Label({ text: 'Bake' });
      label.class.add('label-infield');
      fieldLightMap.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'light:bake', label);


      // bakeDir
      var fieldLightMapDirection = editor.call('attributes:addField', {
          parent: fieldLightMap.parent,
          type: 'checkbox',
          link: entities,
          path: 'components.light.bakeDir'
      });
      // label
      var labelLightMapDirection = new ui.Label({ text: 'Direction' });
      labelLightMapDirection.class.add('label-infield');
      fieldLightMapDirection.parent.append(labelLightMapDirection);
      // reference
      editor.call('attributes:reference:attach', 'light:bakeDir', labelLightMapDirection);
      var checkLightMapDir = function() {
          fieldLightMapDirection.disabled = labelLightMapDirection.disabled = ! fieldLightMap.value;
      };
      fieldLightMap.on('change', checkLightMapDir);
      checkLightMapDir();


      // affectDynamic
      var fieldAffectDynamic = editor.call('attributes:addField', {
          parent: panel,
          name: 'Affect',
          type: 'checkbox',
          link: entities,
          path: 'components.light.affectDynamic'
      });
      // label
      var label = new ui.Label({ text: 'Non-Baked' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      fieldAffectDynamic.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'light:affectDynamic', label);


      // affectLightmapped
      var fieldAffectLightmapped = editor.call('attributes:addField', {
          panel: fieldAffectDynamic.parent,
          type: 'checkbox',
          link: entities,
          path: 'components.light.affectLightmapped'
      });
      // label
      var labelBaked = new ui.Label({ text: 'Baked' });
      labelBaked.class.add('label-infield');
      fieldAffectDynamic.parent.append(labelBaked);
      // reference
      editor.call('attributes:reference:attach', 'light:affectLightmapped', labelBaked);
      // disable/enable affectLightmapped flag
      fieldAffectLightmapped.disabled = labelBaked.disabled = !! fieldLightMap.value;
      fieldLightMap.on('change', function() {
          fieldAffectLightmapped.disabled = labelBaked.disabled = !! fieldLightMap.value;
      });


      // divider
      var divider = document.createElement('div');
      divider.classList.add('fields-divider');
      panel.append(divider);


      // castShadows
      var fieldCastShadows = editor.call('attributes:addField', {
          parent: panel,
          name: 'Shadows',
          type: 'checkbox',
          link: entities,
          path: 'components.light.castShadows'
      });
      // reference
      editor.call('attributes:reference:attach', 'light:castShadows', fieldCastShadows.parent.innerElement.firstChild.ui);


      // shadows panel
      var panelShadows = editor.call('attributes:addPanel', {
          parent: panel
      });
      panelShadows.hidden = ! fieldCastShadows.value && ! fieldCastShadows.class.contains('null');
      fieldCastShadows.on('change', function(value) {
          panelShadows.hidden = ! value && ! this.class.contains('null');
      });


      // shadowUpdateMode
      var fieldShadowUpdateMode = editor.call('attributes:addField', {
          parent: panelShadows,
          name: 'Update Mode',
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: pc.SHADOWUPDATE_THISFRAME, t: 'Once' },
              { v: pc.SHADOWUPDATE_REALTIME, t: 'Realtime' }
          ],
          link: entities,
          path: 'components.light.shadowUpdateMode'
      });
      // reference
      editor.call('attributes:reference:attach', 'light:shadowUpdateMode', fieldShadowUpdateMode.parent.innerElement.firstChild.ui);

      var updateFieldShadowUpdateMode = function() {
          fieldShadowUpdateMode.parent.hidden = fieldLightMap.value && ! fieldAffectDynamic.value && ! fieldLightMap.class.contains('null') && ! fieldAffectDynamic.class.contains('null');
      };
      fieldLightMap.on('change', updateFieldShadowUpdateMode);
      fieldAffectDynamic.on('change', updateFieldShadowUpdateMode);


      // updateShadow button
      var btnUpdateShadow = new ui.Button({
          text: '&#57640;'
      });
      btnUpdateShadow.class.add('shadowUpdate');
      btnUpdateShadow.hidden = fieldShadowUpdateMode.value !== pc.SHADOWUPDATE_THISFRAME && !! fieldShadowUpdateMode.value;
      fieldShadowUpdateMode.parent.append(btnUpdateShadow);
      fieldShadowUpdateMode.on('change', function() {
          btnUpdateShadow.hidden = fieldShadowUpdateMode.value !== pc.SHADOWUPDATE_THISFRAME && !! fieldShadowUpdateMode.value;
      });
      btnUpdateShadow.on('click', function() {
          for(var i = 0; i < entities.length; i++) {
              if (entities[i].entity && entities[i].entity.light && entities[i].entity.light.shadowUpdateMode === pc.SHADOWUPDATE_THISFRAME)
                  entities[i].entity.light.light.shadowUpdateMode = pc.SHADOWUPDATE_THISFRAME;
          }
          editor.call('viewport:render');
      });
      var updateShadowTooltip = Tooltip.attach({
          target: btnUpdateShadow.element,
          text: 'Update',
          align: 'bottom',
          root: editor.call('layout.root')
      });
      btnUpdateShadow.once('destroy', function() {
          updateShadowTooltip.destroy();
      });


      // shadowResolution
      var fieldShadowResolution = editor.call('attributes:addField', {
          parent: panelShadows,
          name: 'Resolution',
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 16, t: '16 x 16' },
              { v: 32, t: '32 x 32' },
              { v: 64, t: '64 x 64' },
              { v: 128, t: '128 x 128' },
              { v: 256, t: '256 x 256' },
              { v: 512, t: '512 x 512' },
              { v: 1024, t: '1024 x 1024' },
              { v: 2048, t: '2048 x 2048' },
              { v: 4096, t: '4096 x 4096' }
          ],
          link: entities,
          path: 'components.light.shadowResolution'
      });
      // reference
      editor.call('attributes:reference:attach', 'light:shadowResolution', fieldShadowResolution.parent.innerElement.firstChild.ui);


      // shadowDistance
      var fieldShadowDistance = editor.call('attributes:addField', {
          parent: panelShadows,
          name: 'Distance',
          type: 'number',
          precision: 2,
          step: 1,
          min: 0,
          link: entities,
          path: 'components.light.shadowDistance'
      });
      fieldShadowDistance.parent.hidden = ! (fieldType.value === '' || fieldType.value === 'directional');
      fieldType.on('change', function(value) {
          fieldShadowDistance.parent.hidden = ! (value === '' || value === 'directional');
      });
      // reference
      editor.call('attributes:reference:attach', 'light:shadowDistance', fieldShadowDistance.parent.innerElement.firstChild.ui);


      // shadowType
      var fieldShadowType = editor.call('attributes:addField', {
          parent: panelShadows,
          name: 'Shadow Type',
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'Shadow Map PCF 3x3' },
              { v: 4, t: 'Shadow Map PCF 5x5' },
              { v: 1, t: 'Variance Shadow Map (8bit)' },
              { v: 2, t: 'Variance Shadow Map (16bit)' },
              { v: 3, t: 'Variance Shadow Map (32bit)' }
          ],
          link: entities,
          path: 'components.light.shadowType'
      });
      // reference
      editor.call('attributes:reference:attach', 'light:shadowType', fieldShadowType.parent.innerElement.firstChild.ui);

      // vsmBlurMode
      var fieldShadowVsmBlurMode = editor.call('attributes:addField', {
          parent: panelShadows,
          name: 'VSM Blur Mode',
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'Box' },
              { v: 1, t: 'Gaussian' }
          ],
          link: entities,
          path: 'components.light.vsmBlurMode'
      });
      // reference
      editor.call('attributes:reference:attach', 'light:vsmBlurMode', fieldShadowVsmBlurMode.parent.innerElement.firstChild.ui);
      //
      fieldShadowVsmBlurMode.parent.hidden = fieldShadowType.value === 0 || fieldShadowType.value === 4;
      fieldShadowType.on('change', function() {
          fieldShadowVsmBlurMode.parent.hidden = fieldShadowType.value === 0 || fieldShadowType.value === 4;
      });

      // vsmBlurSize
      var fieldShadowVsmBlurSize = editor.call('attributes:addField', {
          parent: panelShadows,
          name: 'VSM Blur Size',
          type: 'number',
          min: 1,
          max: 25,
          link: entities,
          path: 'components.light.vsmBlurSize'
      });
      fieldShadowVsmBlurSize.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'light:vsmBlurSize', fieldShadowVsmBlurSize.parent.innerElement.firstChild.ui);
      //
      fieldShadowVsmBlurSize.parent.hidden = fieldShadowType.value === 0 || fieldShadowType.value === 4;
      fieldShadowType.on('change', function() {
          fieldShadowVsmBlurSize.parent.hidden = fieldShadowType.value === 0 || fieldShadowType.value === 4;
      });
      // vsmBlurSize slider
      var fieldShadowVsmBlurSizeSlider = editor.call('attributes:addField', {
          panel: fieldShadowVsmBlurSize.parent,
          precision: 0,
          step: 1,
          min: 1,
          max: 25,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.light.vsmBlurSize'
      });
      fieldShadowVsmBlurSizeSlider.flexGrow = 4;


      // vsmBias
      var fieldVsmBias = editor.call('attributes:addField', {
          parent: panelShadows,
          name: 'VSM Bias',
          type: 'number',
          precision: 4,
          step: .001,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.light.vsmBias'
      });
      // reference
      editor.call('attributes:reference:attach', 'light:vsmBias', fieldVsmBias.parent.innerElement.firstChild.ui);
      //
      fieldVsmBias.parent.hidden = fieldShadowType.value === 0 || fieldShadowType.value === 4;
      fieldShadowType.on('change', function() {
          fieldVsmBias.parent.hidden = fieldShadowType.value === 0 || fieldShadowType.value === 4;
      });


      // shadowBias
      var fieldShadowBias = editor.call('attributes:addField', {
          parent: panelShadows,
          name: 'Bias',
          type: 'number',
          precision: 4,
          step: .001,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.light.shadowBias'
      });
      fieldShadowBias.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'light:shadowBias', fieldShadowBias.parent.innerElement.firstChild.ui);
      //
      fieldShadowBias.parent.hidden = fieldShadowType.value !== 0 && fieldShadowType.value !== 4;
      fieldShadowType.on('change', function() {
          fieldShadowBias.parent.hidden = fieldShadowType.value !== 0 && fieldShadowType.value !== 4;
      });


      // normalOffsetBias
      var fieldShadowBiasNormalOffset = editor.call('attributes:addField', {
          panel: fieldShadowBias.parent,
          type: 'number',
          placeholder: 'Normal Offset',
          precision: 3,
          step: .001,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.light.normalOffsetBias'
      });
      fieldShadowBiasNormalOffset.style.width = '32px';
      fieldShadowBiasNormalOffset.flexGrow = 2;
      // reference
      editor.call('attributes:reference:attach', 'light:normalOffsetBias', fieldShadowBiasNormalOffset);


      // divider
      var dividerCookie = document.createElement('div');
      dividerCookie.classList.add('fields-divider');
      panel.append(dividerCookie);
      if (fieldType.value === 'directional')
          dividerCookie.classList.add('hidden');


      // asset
      var argsCookie = {
          parent: panel,
          name: 'Cookie',
          type: 'asset',
          kind: fieldType.value === 'point' ? 'cubemap' : 'texture',
          link: entities,
          path: 'components.light.cookieAsset'
      };
      var fieldCookie = editor.call('attributes:addField', argsCookie);
      fieldCookie.parent.hidden = fieldType.value === 'directional';
      fieldCookie.parent.class.add('channel');
      fieldType.on('change', function(value) {
          fieldCookie.parent.hidden = fieldType.value === 'directional';
          argsCookie.kind = fieldType.value === 'point' ? 'cubemap' : 'texture';
          if (fieldCookie.parent.hidden) {
              dividerCookie.classList.add('hidden');
          } else {
              dividerCookie.classList.remove('hidden');
          }
      });
      // reference
      editor.call('attributes:reference:attach', 'light:cookieAsset', fieldCookie.parent.innerElement.firstChild.ui);


      // cookies panel
      var panelCookie = editor.call('attributes:addPanel', {
          parent: panel
      });
      var updatePanelCookie = function() {
          panelCookie.hidden = (! fieldCookie.value && ! fieldCookie.class.contains('null')) || fieldType.value === 'directional';
      };
      updatePanelCookie();
      fieldCookie.on('change', updatePanelCookie);
      fieldType.on('change', updatePanelCookie);


      // cookieIntensity
      var fieldCookieIntensity = editor.call('attributes:addField', {
          parent: panelCookie,
          name: 'Intensity',
          type: 'number',
          min: 0,
          max: 1,
          link: entities,
          path: 'components.light.cookieIntensity'
      });
      fieldCookieIntensity.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'light:cookieIntensity', fieldCookieIntensity.parent.innerElement.firstChild.ui);

      // cookieIntensity slider
      var fieldCookieIntensitySlider = editor.call('attributes:addField', {
          panel: fieldCookieIntensity.parent,
          precision: 3,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.light.cookieIntensity'
      });
      fieldCookieIntensitySlider.flexGrow = 4;


      // cookieAngle
      var fieldCookieAngle = editor.call('attributes:addField', {
          parent: panelCookie,
          name: 'Angle',
          type: 'number',
          placeholder: '°',
          min: 0,
          max: 360.0,
          link: entities,
          path: 'components.light.cookieAngle'
      });
      fieldCookieAngle.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'light:cookieAngle', fieldCookieAngle.parent.innerElement.firstChild.ui);

      // cookieAngle slider
      var fieldCookieAngleSlider = editor.call('attributes:addField', {
          panel: fieldCookieAngle.parent,
          precision: 1,
          min: 0,
          max: 360.0,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.light.cookieAngle'
      });
      fieldCookieAngleSlider.flexGrow = 4;

      // cookieOffset
      var fieldCookieOffset = editor.call('attributes:addField', {
          parent: panelCookie,
          name: 'Offset',
          type: 'vec2',
          step: 0.01,
          precision: 3,
          placeholder: [ 'U', 'V' ],
          link: entities,
          path: 'components.light.cookieOffset'
      });
      // reference
      editor.call('attributes:reference:attach', 'light:cookieOffset', fieldCookieOffset[0].parent.innerElement.firstChild.ui);


      // cookieScale
      var fieldCookieScale = editor.call('attributes:addField', {
          parent: panelCookie,
          name: 'Scale',
          type: 'vec2',
          step: 0.01,
          precision: 3,
          placeholder: [ 'U', 'V' ],
          link: entities,
          path: 'components.light.cookieScale'
      });
      // reference
      editor.call('attributes:reference:attach', 'light:cookieScale', fieldCookieScale[0].parent.innerElement.firstChild.ui);

      var updateCookieParams = function() {
          var hidden = panelCookie.hidden || fieldType.value === 'point';
          fieldCookieAngle.parent.hidden = hidden;
          fieldCookieOffset[0].parent.hidden = hidden;
          fieldCookieScale[0].parent.hidden = hidden;
      };
      updateCookieParams();
      fieldType.on('change', updateCookieParams);


      // cookieFalloff
      var fieldCookieFalloff = editor.call('attributes:addField', {
          parent: panelCookie,
          name: 'Falloff',
          type: 'checkbox',
          link: entities,
          path: 'components.light.cookieFalloff'
      });
      fieldCookieFalloff.parent.hidden = fieldType.value !== 'spot';
      fieldType.on('change', function() {
          fieldCookieFalloff.parent.hidden = fieldType.value !== 'spot';
      });
      // reference
      editor.call('attributes:reference:attach', 'light:cookieFalloff', fieldCookieFalloff.parent.innerElement.firstChild.ui);


      // map channel
      var fieldCookieChannel = editor.call('attributes:addField', {
          panel: fieldCookie.parent,
          type: 'string',
          enum: {
              '': '...',
              'r': 'R',
              'g': 'G',
              'b': 'B',
              'a': 'A',
              'rgb': 'RGB'
          },
          link: entities,
          path: 'components.light.cookieChannel'
      });
      fieldCookieChannel.element.parentNode.removeChild(fieldCookieChannel.element);
      fieldCookie.parent.innerElement.querySelector('.top > .ui-label').parentNode.appendChild(fieldCookieChannel.element);
      // reference
      editor.call('attributes:reference:attach', 'light:cookieChannel', fieldCookieChannel);

      // divider
      var divider = document.createElement('div');
      divider.classList.add('fields-divider');
      panel.append(divider);

      // layers
      var layers = projectSettings.get('layers');
      var layersEnum = {
          '': ''
      };
      for (var key in layers) {
          layersEnum[key] = layers[key].name;
      }
      delete layersEnum[LAYERID_DEPTH];
      delete layersEnum[LAYERID_SKYBOX];
      delete layersEnum[LAYERID_IMMEDIATE];


      var fieldLayers = editor.call('attributes:addField', {
          parent: panel,
          name: 'Layers',
          type: 'tags',
          tagType: 'number',
          enum: layersEnum,
          placeholder: 'Add Layer',
          link: entities,
          path: 'components.light.layers',
          tagToString: function (tag) {
              return projectSettings.get('layers.' + tag + '.name') || 'Missing';
          },
          onClickTag: function () {
              // focus layer
              var layerId = this.originalValue;
              editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
              setTimeout(function () {
                  editor.call('editorSettings:layers:focus', layerId);
              });
          }
      });
      // reference
      editor.call('attributes:reference:attach', 'light:layers', fieldLayers.parent.parent.innerElement.firstChild.ui);

  });
});


/* editor/attributes/components/attributes-components-model.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var app = editor.call('viewport:app');
      if (! app) return; // webgl not available

      var events = [ ];

      var projectSettings = editor.call('settings:project');

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Model',
          name: 'model',
          entities: entities
      });


      // type
      var fieldType = editor.call('attributes:addField', {
          parent: panel,
          name: 'Type',
          type: 'string',
          enum: {
              '': '...',
              'asset': 'Asset',
              'box': 'Box',
              'capsule': 'Capsule',
              'sphere': 'Sphere',
              'cylinder': 'Cylinder',
              'cone': 'Cone',
              'plane': 'Plane'
          },
          link: entities,
          path: 'components.model.type'
      });
      fieldType.on('change', function(value) {
          fieldAsset.parent.hidden = value !== 'asset';
          fieldMaterial.parent.hidden = value === 'asset';
          toggleMaterials();
      });
      // reference
      editor.call('attributes:reference:attach', 'model:type', fieldType.parent.innerElement.firstChild.ui);


      // asset
      var fieldAsset = editor.call('attributes:addField', {
          parent: panel,
          name: 'Model',
          type: 'asset',
          kind: 'model',
          link: entities,
          path: 'components.model.asset'
      });
      fieldAsset.parent.hidden = fieldType.value !== 'asset';
      // reference
      editor.call('attributes:reference:attach', 'model:asset', fieldAsset._label);

      var changingAsset = false;

      // if the assets changes then remove material overrides
      fieldAsset.on('beforechange', function (value) {
          var resourceIds = [];
          var mappings = {};

          entities.forEach(function (entity) {
              if (entity.has('components.model.mapping') && entity.get('components.model.asset') !== parseInt(value, 10)) {
                  resourceIds.push(entity.get('resource_id'));
                  mappings[entity.get('resource_id')] = entity.get('components.model.mapping');
              }
          });

          fieldAsset.once('change', function (value) {
              if (changingAsset) return;

              changingAsset = true;

              // modify last history action to include changing
              // the mapping
              var lastHistoryAction = editor.call('history:list')[editor.call('history:current')];
              var lastUndo = lastHistoryAction.undo;
              var lastRedo = lastHistoryAction.redo;

              resourceIds.forEach(function (id) {
                  var entity = editor.call('entities:get', id);
                  if (! entity) return;
                  var history = entity.history.enabled;
                  entity.history.enabled = false;
                  entity.unset('components.model.mapping');
                  entity.history.enabled = history;
              });

              lastHistoryAction.undo = function () {
                  changingAsset = true;

                  // execute last actions undo first
                  lastUndo();

                  // do this in a timeout so that the
                  // 'change' event of fieldAsset is fired first
                  setTimeout(function () {
                      resourceIds.forEach(function (id) {
                          var entity = editor.call('entities:get', id);
                          if (! entity) return;

                          var history = entity.history.enabled;
                          entity.history.enabled = false;
                          entity.set('components.model.mapping', mappings[id]);
                          entity.history.enabled = history;
                      });

                      changingAsset = false;
                  });
              };

              lastHistoryAction.redo = function () {
                  changingAsset = true;

                  // execute last actions redo first
                  lastRedo();

                  // do this in a timeout so that the
                  // 'change' event of fieldAsset is fired first
                  setTimeout(function () {
                      resourceIds.forEach(function (id) {
                          var entity = editor.call('entities:get', id);
                          if (! entity) return;

                          var history = entity.history.enabled;
                          entity.history.enabled = false;
                          entity.unset('components.model.mapping');
                          entity.history.enabled = history;
                      });

                      changingAsset = false;
                  });
              };

              changingAsset = false;
          });
      });

      // material
      var fieldMaterial = editor.call('attributes:addField', {
          parent: panel,
          name: 'Material',
          type: 'asset',
          kind: 'material',
          link: entities,
          path: 'components.model.materialAsset'
      });
      fieldMaterial.class.add('material-asset');
      fieldMaterial.parent.hidden = fieldType.value === 'asset';
      // reference
      editor.call('attributes:reference:attach', 'model:materialAsset', fieldMaterial._label);


      // castShadows
      var fieldCastShadows = editor.call('attributes:addField', {
          parent: panel,
          type: 'checkbox',
          name: 'Shadows',
          link: entities,
          path: 'components.model.castShadows'
      });
      // label
      var label = new ui.Label({ text: 'Cast' });
      label.class.add('label-infield');
      label.style.paddingRight = '8px';
      fieldCastShadows.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'model:castShadows', label);


      // castShadowsLightmap
      var fieldCastShadowsLightmap = editor.call('attributes:addField', {
          panel: fieldCastShadows.parent,
          type: 'checkbox',
          link: entities,
          path: 'components.model.castShadowsLightmap'
      });
      // label
      var labelCastShadowsLightmap = new ui.Label({ text: 'Cast Lightmap' });
      labelCastShadowsLightmap.class.add('label-infield');
      labelCastShadowsLightmap.style.paddingRight = '8px';
      labelCastShadowsLightmap.style.whiteSpace = 'nowrap';
      fieldCastShadows.parent.append(labelCastShadowsLightmap);
      // reference
      editor.call('attributes:reference:attach', 'model:castShadowsLightmap', labelCastShadowsLightmap);


      // receiveShadows
      var fieldReceiveShadows = editor.call('attributes:addField', {
          panel: fieldCastShadows.parent,
          type: 'checkbox',
          link: entities,
          path: 'components.model.receiveShadows'
      });
      // label
      var label = new ui.Label({ text: 'Receive' });
      label.class.add('label-infield');
      fieldCastShadows.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'model:receiveShadows', label);


      // lightmapped
      var fieldIsStatic = editor.call('attributes:addField', {
          parent: panel,
          name: 'States',
          type: 'checkbox',
          link: entities,
          path: 'components.model.isStatic'
      });
      // label
      var label = new ui.Label({ text: 'Static' });
      label.class.add('label-infield');
      fieldIsStatic.parent.append(label);
      label.style.paddingRight = '12px';
      // reference
      editor.call('attributes:reference:attach', 'model:isStatic', label);


      // lightmapped
      var fieldLightmapped = editor.call('attributes:addField', {
          parent: fieldIsStatic.parent,
          type: 'checkbox',
          link: entities,
          path: 'components.model.lightmapped'
      });
      // label
      var label = new ui.Label({ text: 'Lightmapped' });
      label.class.add('label-infield');
      fieldIsStatic.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'model:lightmapped', label);
      // uv1 is missing
      var label = new ui.Label({ text: 'UV1 is missing' });
      label.class.add('label-infield');
      label.style.color = '#f66';
      fieldIsStatic.parent.append(label);

      var checkUV1Missing = function() {
          var missing = false;
          for(var i = 0; i < entities.length; i++) {
              var e = entities[i];
              if (! e.has('components.model') || ! e.get('components.model.lightmapped') || e.get('components.model.type') !== 'asset' || ! e.get('components.model.asset'))
                  continue;

              var assetId = e.get('components.model.asset');
              var asset = editor.call('assets:get', assetId);
              if (! asset)
                  continue;

              if (! asset.has('meta.attributes.texCoord1')) {
                  missing = true;
                  break;
              }
          }

          label.hidden = ! missing;
      };
      checkUV1Missing();
      fieldLightmapped.on('change', function() {
          checkUV1Missing();
          collectResolutions();
      });


      // resolution
      var fieldResolution = editor.call('attributes:addField', {
          parent: panel,
          name: 'Lightmap Size',
          value: '?'
      });
      fieldResolution.style.marginBottom = '5px';
      fieldResolution.style.paddingLeft = '0px';
      fieldResolution.style.minWidth = '32px';
      fieldResolution.flexGrow = 0;
      fieldResolution.flexShrink = 0;
      // show/hide
      fieldResolution.parent.hidden = ! fieldLightmapped.value && ! fieldLightmapped.class.contains('null');
      fieldLightmapped.on('change', function() {
          fieldResolution.parent.hidden = ! fieldLightmapped.value && ! fieldLightmapped.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'model:resolution', fieldResolution.parent.innerElement.firstChild.ui);

      // calculate resolutions for lightmap
      var collectResolutions = function() {
          var lightmapper = app.lightmapper;
          var min = Infinity;
          var max = -Infinity;

          for(var i = 0; i < entities.length; i++) {
              if (! entities[i].get('components.model.lightmapped') || ! entities[i].entity.model || (! entities[i].entity.model.asset && entities[i].entity.type === 'asset') || (entities[i].entity.model.asset && ! app.assets.get(entities[i].entity.model.asset)))
                  continue;

              var size = lightmapper.calculateLightmapSize(entities[i].entity);

              if (size > max)
                  max = size;

              if (size < min)
                  min = size;
          }

          if (min) {
              fieldResolution.value = (min !== max) ? (min + ' - ' + max) : min;
          } else {
              fieldResolution.value = '?';
          }
      };
      collectResolutions();


      // lightmapSizeMultiplier
      var fieldLightmapSizeMultiplier = editor.call('attributes:addField', {
          panel: fieldResolution.parent,
          placeholder: 'Size Multiplier',
          type: 'number',
          min: 0,
          link: entities,
          path: 'components.model.lightmapSizeMultiplier'
      });
      fieldLightmapSizeMultiplier.on('change', function() {
          collectResolutions();
      });
      // reference
      editor.call('attributes:reference:attach', 'model:lightmapSizeMultiplier', fieldLightmapSizeMultiplier);

      // divider
      var divider = document.createElement('div');
      divider.classList.add('fields-divider');
      panel.append(divider);


      // batch group
      var batchGroups = projectSettings.get('batchGroups');
      var batchEnum = {
          '': '...',
          'NaN': 'None'
      };
      for (var key in batchGroups) {
          batchEnum[key] = batchGroups[key].name;
      }

      var fieldBatchGroup = editor.call('attributes:addField', {
          parent: panel,
          name: 'Batch Group',
          type: 'number',
          enum: batchEnum,
          link: entities,
          path: 'components.model.batchGroupId'
      });

      var btnAddGroup = document.createElement('li');
      btnAddGroup.classList.add('add-batch-group');
      btnAddGroup.innerHTML = 'Add Group';
      fieldBatchGroup.elementOptions.appendChild(btnAddGroup);

      // reference
      editor.call('attributes:reference:attach', 'model:batchGroupId', fieldBatchGroup.parent.innerElement.firstChild.ui);

      // Create new batch group, assign it to the selected entities and focus on it in the settings panel
      btnAddGroup.addEventListener('click', function () {
          var group = editor.call('editorSettings:batchGroups:create');
          batchEnum[group] = projectSettings.get('batchGroups.' + group + '.name');
          fieldBatchGroup._updateOptions(batchEnum);
          fieldBatchGroup.value = group;
          editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
          setTimeout(function () {
              editor.call('editorSettings:batchGroups:focus', group);
          });
      });

      // layers
      var layers = projectSettings.get('layers');
      var layersEnum = {
          '': ''
      };
      for (var key in layers) {
          layersEnum[key] = layers[key].name;
      }
      delete layersEnum[LAYERID_DEPTH];
      delete layersEnum[LAYERID_SKYBOX];
      delete layersEnum[LAYERID_IMMEDIATE];

      var fieldLayers = editor.call('attributes:addField', {
          parent: panel,
          name: 'Layers',
          type: 'tags',
          tagType: 'number',
          enum: layersEnum,
          placeholder: 'Add Layer',
          link: entities,
          path: 'components.model.layers',
          tagToString: function (tag) {
              return projectSettings.get('layers.' + tag + '.name') || 'Missing';
          },
          onClickTag: function () {
              // focus layer
              var layerId = this.originalValue;
              editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
              setTimeout(function () {
                  editor.call('editorSettings:layers:focus', layerId);
              });
          }
      });

      // reference
      editor.call('attributes:reference:attach', 'model:layers', fieldLayers.parent.parent.innerElement.firstChild.ui);

      panel.on('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();
      });


      // gather all mappings for all selected entities
      var allMappings = {};
      for (var i = 0, len = entities.length; i < len; i++) {
          var mapping = entities[i].get('components.model.mapping');
          if (mapping) {
              for (var key in mapping) {
                  if (!allMappings[key])
                      allMappings[key] = [entities[i].get('resource_id')];
                  else
                      allMappings[key].push(entities[i].get('resource_id'));
              }
          }
      }

      var panelMaterialButtons = editor.call('attributes:addPanel');
      panelMaterialButtons.class.add('flex', 'component', 'override-material');
      panel.append(panelMaterialButtons);

      var panelMaterials = editor.call('attributes:addPanel');
      panelMaterials.class.add('component', 'override-material');
      panel.append(panelMaterials);

      // check if we should show the override button
      // mainly if all entities have a model component
      // and are referencing an asset
      var toggleMaterials = function ()  {
          var referencedModelAsset = entities[0].get('components.model.asset');
          for (var i = 0, len = entities.length; i < len; i++) {
              if (entities[i].get('components.model.type') !== 'asset' ||
                  entities[i].get('components.model.asset') !== referencedModelAsset) {
                  panelMaterials.hidden = true;
                  panelMaterialButtons.hidden = true;
                  return;
              }
          }

          panelMaterials.hidden = false;
          panelMaterialButtons.hidden = false;
      };

      // turn override panel off / on
      toggleMaterials();

      var assetMaterials = new ui.Button({
          text: 'Asset Materials'
      });
      assetMaterials.disabled = ! editor.call('assets:get', entities[0].get('components.model.asset'));
      events.push(entities[0].on('components.model.asset:set', function(value) {
          assetMaterials.disabled = entityMaterials.disabled = ! value || ! editor.call('assets:get', value);
      }));

      assetMaterials.class.add('override-material');
      panelMaterialButtons.append(assetMaterials);
      assetMaterials.on('click', function () {
          var modelAsset = editor.call('assets:get', entities[0].get('components.model.asset'));
          editor.call('selector:set', 'asset', [modelAsset]);
      });

      // add button to add material override
      var entityMaterials = new ui.Button({
          text: 'Entity Materials'
      });
      entityMaterials.disabled = assetMaterials.disabled;
      entityMaterials.class.add('override-material');
      panelMaterialButtons.append(entityMaterials);

      entityMaterials.on('click', function () {
          editor.call('picker:node', entities);
      });

      // get one of the Entities to use for finding the mesh instances names
      var engineEntity = app.root.findByGuid(entities[0].get('resource_id'));

      var removeOverride = function (index) {
          var resourceIds = [];
          var previous = [];

          entities.forEach(function (entity) {
              resourceIds.push(entity.get('resource_id'));
              var history = entity.history.enabled;
              entity.history.enabled = false;
              previous.push(entity.has('components.model.mapping.' + index) ? entity.get('components.model.mapping.' + index) : undefined);
              entity.unset('components.model.mapping.' + index);
              entity.history.enabled = history;
          });

          editor.call('history:add', {
              name: 'entities.' + (resourceIds.length > 1 ? '*' : resourceIds[0]) + '.components.model.mapping',
              undo: function() {
                  for(var i = 0; i < resourceIds.length; i++) {
                      var item = editor.call('entities:get', resourceIds[i]);
                      if (! item)
                          continue;

                      var history = item.history.enabled;
                      item.history.enabled = false;
                      if (previous[i] === undefined)
                          item.unset('components.model.mapping.' + index);
                      else
                          item.set('components.model.mapping.' + index, previous[i]);

                      item.history.enabled = history;
                  }
              },
              redo: function() {
                  for(var i = 0; i < resourceIds.length; i++) {
                      var item = editor.call('entities:get', resourceIds[i]);
                      if (! item)
                          continue;

                      var history = item.history.enabled;
                      item.history.enabled = false;
                      item.unset('components.model.mapping.' + index);
                      item.history.enabled = history;
                  }
              }
          });
      };

      var addOverride = function (index) {
          var valuesBefore;

          if (! engineEntity.model)
              return;

          var meshInstances = engineEntity.model.meshInstances || [ ];

          var field = editor.call('attributes:addField', {
              parent: panelMaterials,
              type: 'asset',
              kind: 'material',
              name: meshInstances[index] ? meshInstances[index].node.name : 'node ' + index,
              link: entities,
              path: 'components.model.mapping.' + index,
              over: function(type, data) {
                  valuesBefore = entities.map(function (entity) {
                      var path = 'components.model.mapping.' + index;
                      return entity.has(path) ? entity.get(path) : undefined;
                  });

                  entities.forEach(function (entity) {
                      var engineEntity = app.root.findByGuid(entity.get('resource_id'));
                      if (engineEntity) {
                          var mapping = engineEntity.model.mapping;
                          if (engineEntity.model.mapping && engineEntity.model.mapping[index] !== undefined) {
                              mapping[index] = parseInt(data.id, 10);
                              engineEntity.model.mapping = mapping;
                          }
                      }
                  });

                  editor.call('viewport:render');
              },
              leave: function() {
                  if (!valuesBefore) return;

                  entities.forEach(function (entity, i) {
                      var engineEntity = app.root.findByGuid(entity.get('resource_id'));
                      if (engineEntity) {
                          var mapping = engineEntity.model.mapping;
                          if (! mapping) return;

                          if (valuesBefore[i] === undefined) {
                              delete mapping[index];
                          } else {
                              mapping[index] = valuesBefore[i] === null ? null : parseInt(valuesBefore[i], 10);
                          }

                          engineEntity.model.mapping = mapping;
                      }
                  });

                  editor.call('viewport:render');
              }
          });

          field.parent.class.add('node-' + index);

          field.parent.on('click', function () {
              field.parent.class.remove('active');
          });

          // button to remove mapping entry
          var removeButton = new ui.Button({
              text: '&#57636;'
          });
          removeButton.style.fontWeight = 200;
          removeButton.class.add('remove');
          field.parent.append(removeButton);

          removeButton.on('click', function () {
              removeOverride(index);
          });
      };

      // add field for each mapping
      for (var key in allMappings) {
          addOverride(key);
      }

      // subscribe to mapping change events
      entities.forEach(function (entity) {
          events.push(entity.on('*:set', function (path) {
              if (! /^components.model.mapping/.test(path)) return;

              var value = entity.get('components.model.mapping');

              if (! value) value = {};

              var resourceId = entity.get('resource_id');

              // remove deleted overrides
              for (var key in allMappings) {
                  if (value[key] === undefined) {
                      var ind = allMappings[key].indexOf(resourceId);
                      if (ind !== -1) {
                          allMappings[key].splice(ind, 1);
                          if (allMappings[key].length === 0) {
                              var field = panelMaterials.element.querySelector('.field-asset.node-' + key);
                              if (field)
                                  field.parentElement.removeChild(field);

                              delete allMappings[key];
                          }
                      }
                  }
              }


              // add new
              for (var key in value) {
                  if (!allMappings[key]) {
                      allMappings[key] = [resourceId];
                      addOverride(key);
                  }
                  else {
                      if (allMappings[key].indexOf(resourceId) === -1)
                          allMappings[key].push(resourceId);
                  }
              }

          }));

          events.push(entity.on('*:unset', function (path, value) {
              if (! /^components.model.mapping/.test(path)) return;

              var parts = path.split('.');
              var index = parts[parts.length-1];
              if (!allMappings[index]) return;

              var resourceId = entity.get('resource_id');

              var ind = allMappings[index].indexOf(resourceId);
              if (ind === -1) return;

              allMappings[index].splice(ind, 1);
              if (allMappings[index].length) return;

              delete allMappings[index];

              var field = panelMaterials.element.querySelector('.field-asset.node-' + index);
              if (field)
                  field.parentElement.removeChild(field);

          }));
      });
  });
});


/* editor/attributes/components/attributes-components-particlesystem.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var projectSettings = editor.call('settings:project');

      // particlesystem
      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Particles',
          name: 'particlesystem',
          entities: entities
      });


      // controls
      var fieldControls = editor.call('attributes:addField', {
          parent: panel,
          name: 'Controls',
      });
      var label = fieldControls;
      fieldControls = fieldControls.parent;
      label.destroy();
      fieldControls.class.add('controls');

      var btnPlay = new ui.Button({
          text: '&#57649;'
      });
      btnPlay.on('click', function() {
          for(var i = 0; i < entities.length; i++) {
              if (! entities[i].entity || ! entities[i].entity.particlesystem)
                  continue;

              if (playingState === 1) {
                  entities[i].entity.particlesystem.pause();
              } else if (entities[i].entity.particlesystem.data.paused) {
                  entities[i].entity.particlesystem.unpause();
              } else {
                  entities[i].entity.particlesystem.stop();
                  entities[i].entity.particlesystem.reset();
                  entities[i].entity.particlesystem.play();
              }
          }
          checkPlayingState();
      });
      fieldControls.append(btnPlay);

      var playingState = -1;
      var loopingState = -1;

      var checkPlayingState = function() {
          var playing = -1;
          var looping = -1;

          for(var i = 0; i < entities.length; i++) {
              if (! entities[i].entity || ! entities[i].entity.particlesystem)
                  continue;

              if (entities[i].entity.particlesystem.emitter && entities[i].entity.particlesystem.isPlaying()) {
                  if (playing === -1) {
                      playing = 1;
                  } else if (playing === 0) {
                      playing = 2;
                  }
              } else {
                  if (playing === -1) {
                      playing = 0;
                  } else if (playing === 1) {
                      playing = 2;
                  }
              }

              if (entities[i].entity.particlesystem.emitter && entities[i].entity.particlesystem.emitter.loop) {
                  if (looping === -1) {
                      looping = 1;
                  } else if (looping === 0) {
                      looping = 2;
                  }
              } else {
                  if (looping === -1) {
                      looping = 0;
                  } else if (looping === 1) {
                      looping = 2;
                  }
              }
          }

          if (playingState !== playing) {
              playingState = playing;

              if (playingState === 1) {
                  btnPlay.text = '&#10074;&#10074;'; // pause
                  btnPlay.class.add('pause');
              } else {
                  btnPlay.text = '&#57649;'; // play
                  btnPlay.class.remove('pause');
              }
          }

          if (loopingState !== looping) {
              loopingState = looping;

              if (loopingState === 0) {
                  btnStop.disabled = true;
              } else {
                  btnStop.disabled = false;
              }
          }
      };

      var evtCheckPlayingState = setInterval(checkPlayingState, 100);
      btnPlay.once('destroy', function() {
          clearInterval(evtCheckPlayingState);
      });


      var btnStop = new ui.Button({
          text: '	&#57653;'
      });
      btnStop.on('click', function() {
          for(var i = 0; i < entities.length; i++) {
              if (! entities[i].entity || ! entities[i].entity.particlesystem)
                  continue;

              if (playingState === 1) {
                  entities[i].entity.particlesystem.stop();
              } else {
                  entities[i].entity.particlesystem.stop();
                  entities[i].entity.particlesystem.reset();
              }
          }

          checkPlayingState();
      });
      fieldControls.append(btnStop);

      var btnReset = new ui.Button({
          text: '&#57619;'
      });
      btnReset.on('click', function() {
          for(var i = 0; i < entities.length; i++) {
              if (! entities[i].entity || ! entities[i].entity.particlesystem)
                  continue;

              entities[i].entity.particlesystem.rebuild();
              entities[i].entity.particlesystem.reset();
              entities[i].entity.particlesystem.play();
          }

          checkPlayingState();
      });
      fieldControls.append(btnReset);

      checkPlayingState();

      editor.once('viewport:update', function() {
          for(var i = 0; i < entities.length; i++) {
              if (! entities[i].entity || ! entities[i].entity.particlesystem)
                  continue;

              entities[i].entity.particlesystem.rebuild();
              entities[i].entity.particlesystem.reset();
              entities[i].entity.particlesystem.play();
          }
      });
      editor.call('viewport:render');


      // autoPlay
      var fieldAutoPlay = editor.call('attributes:addField', {
          parent: panel,
          name: 'Auto Play',
          type: 'checkbox',
          link: entities,
          path: 'components.particlesystem.autoPlay'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:autoPlay', fieldAutoPlay.parent.innerElement.firstChild.ui);


      // numParticles
      var fieldNumParticles = editor.call('attributes:addField', {
          parent: panel,
          name: 'Particle Count',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.numParticles'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:numParticles', fieldNumParticles.parent.innerElement.firstChild.ui);


      // lifetime
      var fieldLifetime = editor.call('attributes:addField', {
          parent: panel,
          name: 'Lifetime',
          placeholder: 'Seconds',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.lifetime'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:lifetime', fieldLifetime.parent.innerElement.firstChild.ui);


      // emission rate
      var panelEmissionRate = editor.call('attributes:addField', {
          parent: panel,
          name: 'Emission Rate'
      });
      var label = panelEmissionRate;
      panelEmissionRate = panelEmissionRate.parent;
      label.destroy();
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:rate', panelEmissionRate.innerElement.firstChild.ui);

      // emission rate from
      var fieldEmissionRateFrom = editor.call('attributes:addField', {
          panel: panelEmissionRate,
          placeholder: 'From',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.rate'
      });
      fieldEmissionRateFrom.style.width = '32px';

      // emission rate to
      var fieldEmissionRateTo = editor.call('attributes:addField', {
          panel: panelEmissionRate,
          placeholder: 'To',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.rate2'
      });
      fieldEmissionRateTo.style.width = '32px';


      // start angle
      var panelStartAngle = editor.call('attributes:addField', {
          parent: panel,
          name: 'Start Angle'
      });
      var label = panelStartAngle;
      panelStartAngle = panelStartAngle.parent;
      label.destroy();
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:startAngle', panelStartAngle.innerElement.firstChild.ui);

      // start angle from
      var fieldStartAngleFrom = editor.call('attributes:addField', {
          panel: panelStartAngle,
          placeholder: 'From',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.startAngle'
      });
      fieldStartAngleFrom.style.width = '32px';

      // start angle to
      var fieldStartAngleTo = editor.call('attributes:addField', {
          panel: panelStartAngle,
          placeholder: 'To',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.startAngle2'
      });
      fieldStartAngleTo.style.width = '32px';


      // playback
      var panelPlayback = editor.call('attributes:addField', {
          parent: panel,
          name: 'Playback'
      });
      var label = panelPlayback;
      panelPlayback = panelPlayback.parent;
      label.destroy();

      // loop
      var fieldLoop = editor.call('attributes:addField', {
          panel: panelPlayback,
          type: 'checkbox',
          link: entities,
          path: 'components.particlesystem.loop'
      });
      // label
      var label = new ui.Label({ text: 'Loop' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      panelPlayback.append(label);
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:loop', label);


      // preWarm
      var fieldPreWarm = editor.call('attributes:addField', {
          panel: panelPlayback,
          type: 'checkbox',
          link: entities,
          path: 'components.particlesystem.preWarm'
      });
      // label
      var labelPreWarm = new ui.Label({ text: 'Pre Warm' });
      labelPreWarm.class.add('label-infield');
      labelPreWarm.style.paddingRight = '12px';
      panelPlayback.append(labelPreWarm);
      // states
      fieldPreWarm.hidden = labelPreWarm.hidden = ! fieldLoop.value && ! fieldLoop.class.contains('null');
      fieldLoop.on('change', function(value) {
          fieldPreWarm.hidden = labelPreWarm.hidden = ! value && ! this.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:preWarm', labelPreWarm);



      // lighting
      var panelLighting = editor.call('attributes:addField', {
          parent: panel,
          name: 'Lighting'
      });
      var label = panelLighting;
      panelLighting = panelLighting.parent;
      label.destroy();

      // lighting
      var fieldLighting = editor.call('attributes:addField', {
          panel: panelLighting,
          type: 'checkbox',
          link: entities,
          path: 'components.particlesystem.lighting'
      });
      // label
      var label = new ui.Label({ text: 'Enabled' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      label.class.add('label-infield');
      panelLighting.append(label);
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:lighting', label);


      // halfLambert
      var fieldHalfLambert = editor.call('attributes:addField', {
          panel: panelLighting,
          type: 'checkbox',
          link: entities,
          path: 'components.particlesystem.halfLambert'
      });
      // label
      var labelHalfLambert = new ui.Label({ text: 'Half Lambert' });
      labelHalfLambert.class.add('label-infield');
      labelHalfLambert.style.paddingRight = '12px';
      panelLighting.append(labelHalfLambert);
      // state
      fieldHalfLambert.hidden = labelHalfLambert.hidden = ! fieldLighting.value && ! fieldLighting.class.contains('null');
      fieldLighting.on('change', function(value) {
          fieldHalfLambert.hidden = labelHalfLambert.hidden = ! value && ! this.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:halfLambert', labelHalfLambert);


      // intensity
      var fieldIntensity = editor.call('attributes:addField', {
          parent: panel,
          name: 'Intensity',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.intensity'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:intensity', fieldIntensity.parent.innerElement.firstChild.ui);


      // depth
      var panelDepth = editor.call('attributes:addField', {
          parent: panel,
          name: 'Depth'
      });
      var label = panelDepth;
      panelDepth = panelDepth.parent;
      label.destroy();

      // depthWrite
      var fieldDepthWrite = editor.call('attributes:addField', {
          panel: panelDepth,
          type: 'checkbox',
          link: entities,
          path: 'components.particlesystem.depthWrite'
      });
      // label
      var label = new ui.Label({ text: 'Write' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      panelDepth.append(label);
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:depthWrite', label);

      // depthSoftening
      var fieldDepthSoftening = editor.call('attributes:addField', {
          panel: panelDepth,
          placeholder: 'Softening',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.depthSoftening'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:depthSoftening', fieldDepthSoftening);


      // sort
      var fieldSort = editor.call('attributes:addField', {
          parent: panel,
          name: 'Sort',
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'None' },
              { v: 1, t: 'Camera Distance' },
              { v: 2, t: 'Newest First' },
              { v: 3, t: 'Oldest First' }
          ],
          link: entities,
          path: 'components.particlesystem.sort'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:sort', fieldSort.parent.innerElement.firstChild.ui);


      // blendType
      var fieldBlendType = editor.call('attributes:addField', {
          parent: panel,
          name: 'Blend Type',
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 2, t: 'Alpha' },
              { v: 1, t: 'Additive' },
              { v: 5, t: 'Multiply' }
          ],
          link: entities,
          path: 'components.particlesystem.blendType'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:blend', fieldBlendType.parent.innerElement.firstChild.ui);


      // stretch
      var fieldStretch = editor.call('attributes:addField', {
          parent: panel,
          name: 'Stretch',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.stretch'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:stretch', fieldStretch.parent.innerElement.firstChild.ui);


      // alignToMotion
      var fieldAlignToMotion = editor.call('attributes:addField', {
          parent: panel,
          name: 'Align To Motion',
          type: 'checkbox',
          link: entities,
          path: 'components.particlesystem.alignToMotion'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:alignToMotion', fieldAlignToMotion.parent.innerElement.firstChild.ui);


      // emitterShape
      var fieldEmitterShape = editor.call('attributes:addField', {
          parent: panel,
          name: 'Emitter Shape',
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'Box' },
              { v: 1, t: 'Sphere' }
          ],
          link: entities,
          path: 'components.particlesystem.emitterShape'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:emitterShape', fieldEmitterShape.parent.innerElement.firstChild.ui);


      // emitterExtents
      var fieldSpawnBounds = editor.call('attributes:addField', {
          parent: panel,
          name: 'Emitter Extents',
          placeholder: [ 'X', 'Y', 'Z' ],
          type: 'vec3',
          link: entities,
          path: 'components.particlesystem.emitterExtents'
      });
      fieldSpawnBounds[0].parent.hidden = fieldEmitterShape.value !== 0 || fieldEmitterShape.class.contains('null');
      fieldEmitterShape.on('change', function(value) {
          fieldSpawnBounds[0].parent.hidden = value !== 0 || this.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:emitterExtents', fieldSpawnBounds[0].parent.innerElement.firstChild.ui);


      // emitterExtentsInner
      var fieldSpawnBoundsInner = editor.call('attributes:addField', {
          parent: panel,
          name: 'Emitter Extents Inner',
          placeholder: [ 'X', 'Y', 'Z' ],
          type: 'vec3',
          link: entities,
          path: 'components.particlesystem.emitterExtentsInner'
      });
      fieldSpawnBoundsInner [0].parent.hidden = fieldEmitterShape.value !== 0 || fieldEmitterShape.class.contains('null');
      fieldEmitterShape.on('change', function(value) {
          fieldSpawnBoundsInner[0].parent.hidden = value !== 0 || this.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:emitterExtentsInner', fieldSpawnBoundsInner[0].parent.innerElement.firstChild.ui);


      // emitterRadius
      var fieldSpawnRadius = editor.call('attributes:addField', {
          parent: panel,
          name: 'Emitter Radius',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.emitterRadius'
      });
      fieldSpawnRadius.parent.hidden = fieldEmitterShape.value !== 1 || fieldEmitterShape.class.contains('null');
      fieldEmitterShape.on('change', function(value) {
          fieldSpawnRadius.parent.hidden = value !== 1 || this.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:emitterRadius', fieldSpawnRadius.parent.innerElement.firstChild.ui);


      // emitterRadiusInner
      var fieldSpawnRadiusInner = editor.call('attributes:addField', {
          parent: panel,
          name: 'Emitter Radius Inner',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.emitterRadiusInner'
      });
      fieldSpawnRadiusInner.parent.hidden = fieldEmitterShape.value !== 1 || fieldEmitterShape.class.contains('null');
      fieldEmitterShape.on('change', function(value) {
          fieldSpawnRadiusInner.parent.hidden = value !== 1 || this.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:emitterRadiusInner', fieldSpawnRadiusInner.parent.innerElement.firstChild.ui);


      // wrap
      var fieldWrap = editor.call('attributes:addField', {
          parent: panel,
          name: 'Wrap',
          type: 'checkbox',
          link: entities,
          path: 'components.particlesystem.wrap'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:wrap', fieldWrap.parent.innerElement.firstChild.ui);

      // localSpace
      var fieldLocalSpace = editor.call('attributes:addField', {
          parent: panel,
          name: 'Local Space',
          type: 'checkbox',
          link: entities,
          path: 'components.particlesystem.localSpace'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:localSpace', fieldLocalSpace.parent.innerElement.firstChild.ui);

      // layers
      var layers = projectSettings.get('layers');
      var layersEnum = {
          '': ''
      };
      for (var key in layers) {
          layersEnum[key] = layers[key].name;
      }
      delete layersEnum[LAYERID_DEPTH];
      delete layersEnum[LAYERID_SKYBOX];
      delete layersEnum[LAYERID_IMMEDIATE];

      var fieldLayers = editor.call('attributes:addField', {
          parent: panel,
          name: 'Layers',
          type: 'tags',
          tagType: 'number',
          enum: layersEnum,
          placeholder: 'Add Layer',
          link: entities,
          path: 'components.particlesystem.layers',
          tagToString: function (tag) {
              return projectSettings.get('layers.' + tag + '.name') || 'Missing';
          },
          onClickTag: function () {
              // focus layer
              var layerId = this.originalValue;
              editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
              setTimeout(function () {
                  editor.call('editorSettings:layers:focus', layerId);
              });
          }
      });

      // reference
      editor.call('attributes:reference:attach', 'particlesystem:layers', fieldLayers.parent.parent.innerElement.firstChild.ui);


      // wrapBounds
      var fieldWrapBounds = editor.call('attributes:addField', {
          parent: panel,
          name: 'Wrap Bounds',
          placeholder: [ 'X', 'Y', 'Z' ],
          type: 'vec3',
          link: entities,
          path: 'components.particlesystem.wrapBounds'
      });
      fieldWrapBounds[0].parent.hidden = ! fieldWrap.value && ! fieldWrap.class.contains('null');
      fieldWrap.on('change', function(value) {
          fieldWrapBounds[0].parent.hidden = ! value && ! this.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:wrapBounds', fieldWrapBounds[0].parent.innerElement.firstChild.ui);

      // orientation
      var fieldOrientation = editor.call('attributes:addField', {
          parent: panel,
          name: 'Orientation',
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'Screen' },
              { v: 1, t: 'World Normal' },
              { v: 2, t: 'Emitter Normal' }
          ],
          link: entities,
          path: 'components.particlesystem.orientation'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:orientation', fieldOrientation.parent.innerElement.firstChild.ui);

      // particleNormal
      var fieldParticleNormal = editor.call('attributes:addField', {
          parent: panel,
          name: 'Particle Normal',
          placeholder: [ 'X', 'Y', 'Z' ],
          type: 'vec3',
          link: entities,
          path: 'components.particlesystem.particleNormal'
      });
      fieldParticleNormal[0].parent.hidden = fieldOrientation.value === 0 || fieldOrientation.class.contains('null');
      fieldOrientation.on('change', function(value) {
          fieldParticleNormal[0].parent.hidden = value === 0 || this.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:particleNormal', fieldParticleNormal[0].parent.innerElement.firstChild.ui);

      // colorMapAsset
      var fieldColorMap = editor.call('attributes:addField', {
          parent: panel,
          name: 'Color Map',
          type: 'asset',
          kind: 'texture',
          link: entities,
          path: 'components.particlesystem.colorMapAsset'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:colorMap', fieldColorMap._label);

      fieldColorMap.on('change', function (value) {
          panelFrames.hidden = !value && !fieldNormalMap.value;
          fieldAnimatedTextureNumFrames.parent.hidden = panelFrames.hidden;
          panelAnimationPlayback.hidden = panelFrames.hidden;
      });

      // normalMapAsset
      var fieldNormalMap = editor.call('attributes:addField', {
          parent: panel,
          name: 'Normal Map',
          type: 'asset',
          kind: 'texture',
          link: entities,
          path: 'components.particlesystem.normalMapAsset'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:normalMap', fieldNormalMap._label);

      fieldNormalMap.on('change', function (value) {
          panelFrames.hidden = !value && !fieldColorMap.value;
          fieldAnimatedTextureNumFrames.hidden = panelFrames.hidden;
          panelAnimationPlayback.hidden = panelFrames.hidden;
      });

      // frames
      var panelFrames = editor.call('attributes:addField', {
          parent: panel,
          name: 'Map Tiles'
      });

      var label = panelFrames;
      panelFrames = panelFrames.parent;
      label.destroy();

      // number of x tiles
      var fieldAnimatedTextureTilesX = editor.call('attributes:addField', {
          parent: panelFrames,
          type: 'number',
          placeholder: 'X',
          min: 1,
          link: entities,
          path: 'components.particlesystem.animTilesX'
      });
      fieldAnimatedTextureTilesX.style.width = '50%';
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:animTilesX', fieldAnimatedTextureTilesX.parent.innerElement.firstChild.ui);

      // number of y tiles
      var fieldAnimatedTextureTilesY = editor.call('attributes:addField', {
          parent: panelFrames,
          type: 'number',
          placeholder: 'Y',
          min: 1,
          link: entities,
          path: 'components.particlesystem.animTilesY'
      });
      fieldAnimatedTextureTilesY.style.width = '50%';
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:animTilesY', fieldAnimatedTextureTilesY.parent.innerElement.firstChild.ui);

      panelFrames.hidden = !fieldColorMap.value && !fieldNormalMap.value;

      // frames to play
      var fieldAnimatedTextureNumFrames = editor.call('attributes:addField', {
          parent: panel,
          type: 'number',
          name: 'Frame Count',
          min: 1,
          link: entities,
          path: 'components.particlesystem.animNumFrames'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:animNumFrames', fieldAnimatedTextureNumFrames.parent.innerElement.firstChild.nextSibling.ui);

      fieldAnimatedTextureNumFrames.parent.hidden = !fieldColorMap.value && !fieldNormalMap.value;

      var panelAnimationPlayback = editor.call('attributes:addField', {
          parent: panel,
          name: 'Animation'
      });

      var label = panelAnimationPlayback;
      panelAnimationPlayback = panelAnimationPlayback.parent;
      label.destroy();

      // animation speed
      var fieldAnimatedTextureSpeed = editor.call('attributes:addField', {
          parent: panelAnimationPlayback,
          placeholder: 'Speed',
          type: 'number',
          link: entities,
          path: 'components.particlesystem.animSpeed'
      });
      fieldAnimatedTextureSpeed.style.width = '50%';
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:animSpeed', fieldAnimatedTextureSpeed.parent.innerElement.firstChild.ui);


      // animation loop
      var fieldAnimatedTextureLoop = editor.call('attributes:addField', {
          parent: panelAnimationPlayback,
          type: 'checkbox',
          link: entities,
          path: 'components.particlesystem.animLoop'
      });

      // label
      var label = new ui.Label({ text: 'Loop' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      panelAnimationPlayback.append(label);

      // reference
      editor.call('attributes:reference:attach', 'particlesystem:animLoop', label);

      panelAnimationPlayback.hidden = !fieldColorMap.value && !fieldNormalMap.value;

      // mesh
      var fieldMesh = editor.call('attributes:addField', {
          parent: panel,
          name: 'Mesh',
          type: 'asset',
          kind: 'model',
          link: entities,
          path: 'components.particlesystem.mesh'
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:mesh', fieldMesh._label);


      // localVelocityGraph
      var fieldLocalVelocity = editor.call('attributes:addField', {
          parent: panel,
          name: 'Local Velocity',
          type: 'curveset',
          link: entities[0],
          path: 'components.particlesystem.localVelocityGraph',
          canRandomize: true,
          curves: [ 'X', 'Y', 'Z' ]
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:localVelocityGraph', fieldLocalVelocity.parent.innerElement.firstChild.ui);


      // velocityGraph
      var fieldVelocity = editor.call('attributes:addField', {
          parent: panel,
          name: 'Velocity',
          type: 'curveset',
          link: entities[0],
          path: 'components.particlesystem.velocityGraph',
          canRandomize: true,
          curves: [ 'X', 'Y', 'Z' ]
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:velocityGraph', fieldVelocity.parent.innerElement.firstChild.ui);


      // radialSpeedGraph
      var fieldRadialSpeed = editor.call('attributes:addField', {
          parent: panel,
          name: 'Radial Speed',
          type: 'curveset',
          link: entities[0],
          path: 'components.particlesystem.radialSpeedGraph',
          canRandomize: true,
          curves: [ 'R' ],
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:radialSpeedGraph', fieldRadialSpeed.parent.innerElement.firstChild.ui);


      // rotationSpeedGraph
      var fieldRotationSpeed = editor.call('attributes:addField', {
          parent: panel,
          name: 'Rotation Speed',
          type: 'curveset',
          link: entities[0],
          path: 'components.particlesystem.rotationSpeedGraph',
          canRandomize: true,
          curves: [ 'Angle' ],
          verticalValue: 180
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:rotationSpeedGraph', fieldRotationSpeed.parent.innerElement.firstChild.ui);


      // scaleGraph
      var fieldScale = editor.call('attributes:addField', {
          parent: panel,
          name: 'Scale',
          type: 'curveset',
          link: entities[0],
          path: 'components.particlesystem.scaleGraph',
          canRandomize: true,
          curves: [ 'Scale' ],
          verticalValue: 1,
          min: 0
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:scaleGraph', fieldScale.parent.innerElement.firstChild.ui);


      // colorGraph
      var fieldColor = editor.call('attributes:addField', {
          parent: panel,
          name: 'Color',
          type: 'gradient',
          link: entities[0],
          path: 'components.particlesystem.colorGraph',
          gradient: true,
          curves: [ 'R', 'G', 'B' ],
          max: 1,
          min: 0
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:colorGraph', fieldColor.parent.innerElement.firstChild.ui);


      // alphaGraph
      var fieldAlpha = editor.call('attributes:addField', {
          parent: panel,
          name: 'Opacity',
          type: 'curveset',
          link: entities[0],
          path: 'components.particlesystem.alphaGraph',
          canRandomize: true,
          curves: ['Opacity' ],
          min: 0,
          max: 1
      });
      // reference
      editor.call('attributes:reference:attach', 'particlesystem:alphaGraph', fieldAlpha.parent.innerElement.firstChild.ui);

      if (entities.length > 1) {
          fieldLocalVelocity.disabled = true;
          fieldVelocity.disabled = true;
          fieldRotationSpeed.disabled = true;
          fieldScale.disabled = true;
          fieldColor.disabled = true;
          fieldAlpha.disabled = true;
          fieldRadialSpeed.disabled = true;
      }
  });
});


/* editor/attributes/components/attributes-components-rigidbody.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var events = [ ];

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Rigid Body',
          name: 'rigidbody',
          entities: entities
      });

      // type
      var fieldType = editor.call('attributes:addField', {
          parent: panel,
          name: 'Type',
          type: 'string',
          enum: {
              '': '...',
              'static': 'Static',
              'dynamic': 'Dynamic',
              'kinematic': 'Kinematic'
          },
          link: entities,
          path: 'components.rigidbody.type'
      });
      // reference
      editor.call('attributes:reference:attach', 'rigidbody:type', fieldType.parent.innerElement.firstChild.ui);


      // dynamic/kinematic fields
      var panelDynamic = editor.call('attributes:addPanel', {
          parent: panel
      });
      panelDynamic.hidden = fieldType.value !== '' && fieldType.value !== 'dynamic';
      fieldType.on('change', function(value) {
          panelDynamic.hidden = value !== '' && value !== 'dynamic';
      });

      // mass
      var fieldMass = editor.call('attributes:addField', {
          parent: panelDynamic,
          name: 'Mass',
          type: 'number',
          precision: 2,
          step: .1,
          min: 0,
          link: entities,
          path: 'components.rigidbody.mass'
      });
      fieldMass.placeholder = 'Kg';
      // reference
      editor.call('attributes:reference:attach', 'rigidbody:mass', fieldMass.parent.innerElement.firstChild.ui);


      // linearDamping
      var fieldLinearDamping = editor.call('attributes:addField', {
          parent: panelDynamic,
          name: 'Damping',
          placeholder: 'Linear',
          type: 'number',
          precision: 6,
          step: .01,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.rigidbody.linearDamping'
      });
      fieldLinearDamping.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'rigidbody:damping', fieldLinearDamping.parent.innerElement.firstChild.ui);


      // angularDamping
      var fieldAngularDamping = editor.call('attributes:addField', {
          panel: fieldLinearDamping.parent,
          placeholder: 'Angular',
          type: 'number',
          precision: 6,
          step: .01,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.rigidbody.angularDamping'
      });
      fieldAngularDamping.style.width = '32px';


      // linearFactor
      var fieldLinearFactor = editor.call('attributes:addField', {
          parent: panelDynamic,
          name: 'Linear Factor',
          placeholder: [ 'X', 'Y', 'Z' ],
          precision: 4,
          step: .01,
          min: 0,
          max: 1,
          type: 'vec3',
          link: entities,
          path: 'components.rigidbody.linearFactor'
      });
      // reference
      editor.call('attributes:reference:attach', 'rigidbody:linearFactor', fieldLinearFactor[0].parent.innerElement.firstChild.ui);


      // angularFactor
      var fieldAngularFactor = editor.call('attributes:addField', {
          parent: panelDynamic,
          name: 'Angular Factor',
          placeholder: [ 'X', 'Y', 'Z' ],
          precision: 4,
          step: .01,
          min: 0,
          max: 1,
          type: 'vec3',
          link: entities,
          path: 'components.rigidbody.angularFactor'
      });
      // reference
      editor.call('attributes:reference:attach', 'rigidbody:angularFactor', fieldAngularFactor[0].parent.innerElement.firstChild.ui);


      // friction
      var fieldFriction = editor.call('attributes:addField', {
          parent: panel,
          name: 'Friction',
          type: 'number',
          precision: 4,
          step: .01,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.rigidbody.friction'
      });
      fieldFriction.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'rigidbody:friction', fieldFriction.parent.innerElement.firstChild.ui);


      // friction slider
      var fieldFrictionSlider = editor.call('attributes:addField', {
          panel: fieldFriction.parent,
          precision: 4,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.rigidbody.friction'
      });
      fieldFrictionSlider.flexGrow = 4;


      // restitution
      var fieldRestitution = editor.call('attributes:addField', {
          parent: panel,
          name: 'Restitution',
          type: 'number',
          precision: 4,
          step: .01,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.rigidbody.restitution'
      });
      fieldRestitution.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'rigidbody:restitution', fieldRestitution.parent.innerElement.firstChild.ui);


      // restitution slider
      var fieldRestitutionSlider = editor.call('attributes:addField', {
          panel: fieldRestitution.parent,
          precision: 3,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.rigidbody.restitution'
      });
      fieldRestitutionSlider.flexGrow = 4;
  });
});


/* editor/attributes/components/attributes-components-script-2.js */
editor.once('load', function() {
  'use strict';

  if (editor.call('settings:project').get('useLegacyScripts'))
      return;

  var attributeTypeToUi = {
      boolean: 'checkbox',
      number: 'number',
      string: 'string',
      json: 'string',
      asset: 'asset',
      entity: 'entity',
      rgb: 'rgb',
      rgba: 'rgb',
      vec2: 'vec2',
      vec3: 'vec3',
      vec4: 'vec4',
      curve: 'curveset'
  };

  var attributeSubTitles = {
      boolean: '{Boolean}',
      number: '{Number}',
      string: '{String}',
      json: '{Object}',
      asset: '{pc.Asset}',
      entity: '{pc.Entity}',
      rgb: '{pc.Color}',
      rgba: '{pc.Color}',
      vec2: '{pc.Vec2}',
      vec3: '{pc.Vec3}',
      vec4: '{pc.Vec4}',
      curve: '{pc.Curve}'
  };

  editor.method('assets:scripts:typeToSubTitle', function(attribute) {
      var subTitle = attributeSubTitles[attribute.type];

      if (attribute.type === 'curve') {
          if (attribute.color) {
              if (attribute.color.length > 1)
                  subTitle = '{pc.CurveSet}';
          } else if (attribute.curves && attribute.curves.length > 1) {
              subTitle = '{pc.CurveSet}';
          }
      } else if (attribute.array) {
          subTitle = '[ ' + subTitle + ' ]';
      }

      return subTitle;
  });


  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Scripts',
          name: 'script',
          entities: entities
      });

      var events = [ ];
      var currentFocus = null;
      var lastValue = '';


      var excludeScripts = { };
      var calculateExcludeScripts = function() {
          excludeScripts = { };
          var excludeScriptsIndex = { };
          for(var i = 0; i < entities.length; i++) {
              var scripts = entities[i].get('components.script.order');
              if (! scripts)
                  continue;

              for(var s = 0; s < scripts.length; s++) {
                  excludeScriptsIndex[scripts[s]] = (excludeScriptsIndex[scripts[s]] || 0) + 1;
                  if (excludeScriptsIndex[scripts[s]] === entities.length)
                      excludeScripts[scripts[s]] = true;
              }
          }
      };

      var focusFirstAutocomplete = function() {
          var first = autoComplete.innerElement.firstChild;
          var found = false;
          while(! found && first) {
              if (first.ui && ! first.ui.hidden) {
                  found = true;
                  break;
              }
              first = first.nextSibling;
          }

          if (found && first && first.ui) {
              currentFocus = first.ui;
              currentFocus.class.add('active');
          } else {
              currentFocus = null;
          }
      };


      var createNewScript = function() {
          var filename = editor.call('picker:script-create:validate', inputAddScript.value);

          var onFilename = function(filename) {
              editor.call('assets:create:script', {
                  filename: filename,
                  boilerplate: true,
                  noSelect: true,
                  callback: function(err, asset, result) {
                      if (result && result.scripts) {
                          var keys = Object.keys(result.scripts);
                          if (keys.length === 1)
                              onScriptAdd(keys[0]);
                      }
                  }
              });
          };

          if (filename) {
              onFilename(filename);
          } else {
              editor.call('picker:script-create', onFilename, inputAddScript.value);
          }
      };


      var inputAddScript = new ui.TextField();
      inputAddScript.blurOnEnter = false;
      inputAddScript.renderChanges = false;
      inputAddScript.keyChange = true;
      inputAddScript.class.add('add-script');
      inputAddScript.on('change', function(value) {
          if (lastValue === value)
              return;

          lastValue = value;

          if (value) {
              inputAddScript.class.add('not-empty');

              var items = [ ];
              for(var key in autoComplete.index) {
                  if (! autoComplete.index.hasOwnProperty(key))
                      continue;

                  items.push([ key, key ]);
              }

              var search = editor.call('search:items', items, value);
              var searchIndex = { };
              for(var i = 0; i < search.length; i++)
                  searchIndex[search[i]] = true;

              itemAutoCompleteNew.hidden = !! excludeScripts[value] || !! searchIndex[value];
              itemAutoCompleteNew.class.remove('active');

              for(var key in autoComplete.index) {
                  if (! autoComplete.index.hasOwnProperty(key))
                      continue;

                  autoComplete.index[key].class.remove('active');

                  if (searchIndex[key] && ! excludeScripts[key]) {
                      autoComplete.index[key].hidden = false;
                  } else {
                      autoComplete.index[key].hidden = true;
                  }
              }
          } else {
              inputAddScript.class.remove('not-empty');
              itemAutoCompleteNew.hidden = false;
              itemAutoCompleteNew.class.remove('active');

              for(var key in autoComplete.index) {
                  if (! autoComplete.index.hasOwnProperty(key))
                      continue;

                  autoComplete.index[key].class.remove('active');
                  autoComplete.index[key].hidden = !! excludeScripts[key];
              }
          }

          focusFirstAutocomplete();
      });
      inputAddScript.on('input:focus', function() {
          calculateExcludeScripts();

          if (autoComplete.empty) {
              currentFocus = null;
              autoComplete.empty = false;

              var scripts = editor.call('assets:scripts:list');

              // sort list
              scripts.sort(function(a, b) {
                  if (a.toLowerCase() > b.toLowerCase()) {
                      return 1;
                  } else if (a.toLowerCase() < b.toLowerCase()) {
                      return -1;
                  } else {
                      return 0;
                  }
              });

              itemAutoCompleteNew = new ui.ListItem({ text: 'New Script' });
              itemAutoCompleteNew.class.add('new');
              itemAutoCompleteNew.element.addEventListener('mousedown', createNewScript, false);
              autoComplete.append(itemAutoCompleteNew);

              for(var i = 0; i < scripts.length; i++) {
                  var item = addScriptAutocompleteItem(scripts[i]);
                  if (excludeScripts[scripts[i]])
                      item.hidden = true;
              }

              // TODO scritps2
              // resort might be required if new scripts were added before templated
          } else {
              // show all items as search is empty
              for(var key in autoComplete.index) {
                  if (! autoComplete.index.hasOwnProperty(key))
                      continue;

                  autoComplete.index[key].class.remove('active');
                  autoComplete.index[key].hidden = !! excludeScripts[key];
              }
          }

          autoComplete.hidden = false;
          focusFirstAutocomplete();

          if (currentFocus)
              currentFocus.class.add('active');
      });

      var addScriptAutocompleteItem = function(script) {
          var item = new ui.ListItem({ text: script });
          item.element.script = script;
          item.element.addEventListener('mousedown', function() {
              onScriptAdd(this.script);
          }, false);
          autoComplete.index[script] = item;
          autoComplete.appendBefore(item, itemAutoCompleteNew);
          return item;
      };

      var removeScriptAutocompleteItem = function(script) {
          var item = autoComplete.index[script];
          if (! item) return;

          if (item === currentFocus) {
              var prev = item.element.previousSibling;
              if (! prev) prev = item.element.nextSibling;

              if (prev && prev.ui) {
                  currentFocus = prev.ui;
                  currentFocus.class.add('active');
              } else {
                  currentFocus = null;
              }
          }

          item.destroy();
          delete autoComplete.index[script];
      };

      var onScriptAdd = function(script) {
          var records = [ ];

          for(var i = 0; i < entities.length; i++) {
              if (entities[i].has('components.script.scripts.' + script))
                  continue;

              var record = {
                  get: entities[i].history._getItemFn,
                  data: {
                      enabled: true,
                      attributes: { }
                  }
              };
              records.push(record);

              entities[i].history.enabled = false;
              entities[i].set('components.script.scripts.' + script, record.data);
              entities[i].insert('components.script.order', script);
              entities[i].history.enabled = true;
          }

          editor.call('history:add', {
              name: 'entities.components.script.scripts',
              undo: function() {
                  for(var i = 0; i < records.length; i++) {
                      var item = records[i].get();
                      if (! item) continue;

                      item.history.enabled = false;
                      item.unset('components.script.scripts.' + script);
                      item.removeValue('components.script.order', script);
                      item.history.enabled = true;
                  }
              },
              redo: function() {
                  for(var i = 0; i < records.length; i++) {
                      var item = records[i].get();
                      if (! item) continue;

                      item.history.enabled = false;
                      item.set('components.script.scripts.' + script, records[i].data);
                      item.insert('components.script.order', script);
                      item.history.enabled = true;
                  }
              }
          });
      };

      var onAddScriptKeyDown = function(evt) {
          var candidate, found;
          var findFirst = false;
          var direction = '';

          if (evt.keyCode === 40 || (evt.keyCode === 9 && ! evt.shiftKey)) {
              // down
              if (currentFocus) {
                  direction = 'nextSibling';
              } else {
                  findFirst = true;
              }

              evt.preventDefault();
          } else if (evt.keyCode === 38 || (evt.keyCode === 9 && evt.shiftKey)) {
              // up
              if (currentFocus) {
                  direction = 'previousSibling';
              } else {
                  findFirst = true;
              }

              evt.preventDefault();
          } else if (evt.keyCode === 13) {
              // enter
              if (currentFocus) {
                  if (currentFocus === itemAutoCompleteNew) {
                      createNewScript();
                  } else {
                      onScriptAdd(currentFocus.element.script);
                  }

                  inputAddScript.elementInput.blur();
              } else {
                  findFirst = true;
              }
          }

          if (findFirst) {
              // try finding first available option
              candidate = autoComplete.innerElement.firstChild;
              found = false;

              while(! found && candidate) {
                  if (candidate.ui && ! candidate.ui.hidden) {
                      found = true;
                      break;
                  }
                  candidate = candidate.nextSibling;
              }

              if (found && candidate && candidate.ui) {
                  currentFocus = candidate.ui;
                  currentFocus.class.add('active');
              }

              if (evt.keyCode === 13) {
                  if (currentFocus) {
                      if (currentFocus === itemAutoCompleteNew) {
                          createNewScript();
                      } else {
                          onScriptAdd(currentFocus.ui.element.script);
                      }
                  }

                  inputAddScript.elementInput.blur();
              }
          } else if (direction) {
              // try finding next or previous available option
              candidate = currentFocus.element[direction];
              found = false;

              while(! found && candidate) {
                  if (candidate.ui && ! candidate.ui.hidden) {
                      found = true;
                      break;
                  }
                  candidate = candidate[direction];
              }
              if (candidate && candidate.ui) {
                  currentFocus.class.remove('active');
                  currentFocus = candidate.ui;
                  currentFocus.class.add('active');
              }
          }
      };
      inputAddScript.elementInput.addEventListener('keydown', onAddScriptKeyDown);

      inputAddScript.on('input:blur', function() {
          if (currentFocus) {
              currentFocus.class.remove('active');
              currentFocus = null;
          }
          autoComplete.hidden = true;
          this.value = '';
      });
      panel.append(inputAddScript);

      inputAddScript.once('destroy', function() {
          inputAddScript.elementInput.removeEventListener('keydown', onAddScriptKeyDown);
      });


      // autocomplete
      var autoComplete = new ui.List();
      autoComplete.empty = true;
      autoComplete.index = { };
      autoComplete.class.add('scripts-autocomplete');
      autoComplete.hidden = true;
      panel.append(autoComplete);

      var itemAutoCompleteNew;

      // script added
      events.push(editor.on('assets:scripts:add', function(asset, script) {
          if (autoComplete.empty || autoComplete.index[script])
              return;

          addScriptAutocompleteItem(script);
      }));

      // script removed
      events.push(editor.on('assets:scripts:remove', function(asset, script) {
          if (autoComplete.empty)
              return;

          if (editor.call('assets:scripts:assetByScript', script))
              return;

          removeScriptAutocompleteItem(script);
      }));


      var panelScripts = editor.call('attributes:addPanel', {
          parent: panel
      });
      panelScripts.hidden = true;
      panelScripts.class.add('scripts');


      var scriptPanelsIndex = { };

      // drag is only allowed for single selected entities
      if (entities.length === 1) {
          var dragScript = null;
          var dragScriptInd = null;
          var dragPlaceholder = null;
          var dragInd = null;
          var dragOut = true;
          var dragScripts = [ ];

          // drop area
          var target = editor.call('drop:target', {
              ref: panelScripts.innerElement,
              type: 'component-script-order',
              hole: true,
              passThrough: true
          });
          target.element.style.outline = '1px dotted #f60';
          panelScripts.once('drestroy', function() {
              target.unregister();
          });

          var dragCalculateSizes = function() {
              dragScripts = [ ];
              var children = panelScripts.innerElement.children;

              for(var i = 0; i < children.length; i++) {
                  var script = children[i].ui ? children[i].ui.script : children[i].script;

                  dragScripts.push({
                      script: script,
                      ind: entities[0].get('components.script.order').indexOf(script),
                      y: children[i].offsetTop,
                      height: children[i].clientHeight
                  });
              }
          };
          var onScriptDragStart = function(evt) {
              // dragend
              window.addEventListener('blur', onScriptDragEnd, false);
              window.addEventListener('mouseup', onScriptDragEnd, false);
              window.addEventListener('mouseleave', onScriptDragEnd, false);
              document.body.addEventListener('mouseleave', onScriptDragEnd, false);
              // dragmove
              window.addEventListener('mousemove', onScriptDragMove, false);

              scriptPanelsIndex[dragScript].class.add('dragged');

              dragCalculateSizes();
              for(var i = 0; i < dragScripts.length; i++) {
                  if (dragScripts[i].script === dragScript)
                      dragScriptInd = i;
              }

              var panel = scriptPanelsIndex[dragScript];
              var parent = panel.element.parentNode;
              dragPlaceholder = document.createElement('div');
              dragPlaceholder.script = dragScript;
              dragPlaceholder.classList.add('dragPlaceholder');
              dragPlaceholder.style.height = (dragScripts[dragScriptInd].height - 8) + 'px';
              parent.insertBefore(dragPlaceholder, panel.element);
              parent.removeChild(panel.element);

              onScriptDragMove(evt);

              editor.call('drop:set', 'component-script-order', { script: dragScript });
              editor.call('drop:activate', true);
          };
          var onScriptDragMove = function(evt) {
              if (! dragScript) return;

              var rect = panelScripts.innerElement.getBoundingClientRect();

              dragOut = (evt.clientX < rect.left || evt.clientX > rect.right || evt.clientY < rect.top || evt.clientY > rect.bottom);

              if (! dragOut) {
                  var y = evt.clientY - rect.top;
                  var ind = null;
                  var height = dragPlaceholder.clientHeight;

                  var c = 0;
                  for(var i = 0; i < dragScripts.length; i++) {
                      if (dragScripts[i].script === dragScript) {
                          c = i;
                          break;
                      }
                  }

                  // hovered script
                  for(var i = 0; i < dragScripts.length; i++) {
                      var off = Math.max(0, dragScripts[i].height - height);
                      if (c < i) {
                          if (y >= (dragScripts[i].y + off) && y <= (dragScripts[i].y + dragScripts[i].height)) {
                              ind = i;
                              if (ind > dragScriptInd) ind++;
                              break;
                          }
                      } else {
                          if (y >= dragScripts[i].y && y <= (dragScripts[i].y + dragScripts[i].height - off)) {
                              ind = i;
                              if (ind > dragScriptInd) ind++;
                              break;
                          }
                      }
                  }

                  if (ind !== null && dragInd !== ind) {
                      dragInd = ind;

                      var parent = dragPlaceholder.parentNode;
                      parent.removeChild(dragPlaceholder);

                      var ind = dragInd;
                      if (ind > dragScriptInd) ind--;
                      var next = parent.children[ind];

                      if (next) {
                          parent.insertBefore(dragPlaceholder, next);
                      } else {
                          parent.appendChild(dragPlaceholder);
                      }

                      dragCalculateSizes();
                  }
              } else {
                  dragInd = dragScriptInd;
                  var parent = dragPlaceholder.parentNode;
                  parent.removeChild(dragPlaceholder);
                  var next = parent.children[dragScriptInd];
                  if (next) {
                      parent.insertBefore(dragPlaceholder, next);
                  } else {
                      parent.appendChild(dragPlaceholder);
                  }
                  dragCalculateSizes();
              }
          };
          var onScriptDragEnd = function() {
              // dragend
              window.removeEventListener('blur', onScriptDragEnd);
              window.removeEventListener('mouseup', onScriptDragEnd);
              window.removeEventListener('mouseleave', onScriptDragEnd);
              document.body.removeEventListener('mouseleave', onScriptDragEnd);
              // dragmove
              window.removeEventListener('mousemove', onScriptDragMove);

              if (dragScript) {
                  scriptPanelsIndex[dragScript].class.remove('dragged');

                  var panel = scriptPanelsIndex[dragScript];
                  panelScripts.innerElement.removeChild(dragPlaceholder);
                  var next = panelScripts.innerElement.children[dragScriptInd];
                  if (next) {
                      panelScripts.innerElement.insertBefore(panel.element, next);
                  } else {
                      panelScripts.innerElement.appendChild(panel.element);
                  }

                  if (! dragOut && dragInd !== null && dragInd !== dragScriptInd && dragInd !== (dragScriptInd + 1)) {
                      var ind = dragInd;
                      if (ind > dragScriptInd) ind--;
                      entities[0].move('components.script.order', dragScriptInd, ind);
                  }
              }

              dragScript = null;
              dragScripts = [ ];
              dragInd = null;

              editor.call('drop:activate', false);
              editor.call('drop:set');
          };
      }

      var addScript = function(script, ind) {
          var panel = scriptPanelsIndex[script];
          var events = [ ];

          if (panel) {
              // check if script is still present in all entities
              var complete = true;
              for(var i = 0; i < entities.length; i++) {
                  if (! entities[i].has('components.script.scripts.' + script)) {
                      complete = false;
                      break;
                  }
              }
              panel.header = script + (complete ? '' : ' *');
              return;
          }

          panel = scriptPanelsIndex[script] = new ui.Panel();
          panel.foldable = true;
          panel.script = script;
          panel.header = script;
          panel.attributesIndex = { };

          var next = null;
          if (typeof(ind) === 'number')
              next = panelScripts.innerElement.children[ind];

          if (next) {
              panelScripts.appendBefore(panel, next);
          } else {
              panelScripts.append(panel);
          }

          // clean events
          panel.once('destroy', function() {
              for(var i = 0; i < events.length; i++)
                  events[i].unbind();
              events = null;
          });

          // drag handle
          if (entities.length === 1) {
              panel.handle = document.createElement('div');
              panel.handle.classList.add('handle');
              panel.handle.addEventListener('mousedown', function(evt) {
                  evt.stopPropagation();
                  evt.preventDefault();

                  dragScript = script;
                  onScriptDragStart(evt);
                  tooltipHandle.hidden = true;
              }, false);
              panel.headerAppend(panel.handle);

              // tooltip
              var tooltipHandle = Tooltip.attach({
                  target: panel.handle,
                  text: 'Drag',
                  align: 'right',
                  root: editor.call('layout.root')
              });
              panel.once('destroy', function() {
                  tooltipHandle.destroy();
              });
          }

          // check if script is present in all entities
          for(var i = 0; i < entities.length; i++) {
              if (! entities[i].has('components.script.scripts.' + script)) {
                  panel.header += ' *';
                  break;
              }
          }

          panel.headerElementTitle.addEventListener('click', function() {
              if (! panel.headerElementTitle.classList.contains('link'))
                  return;

              editor.call('selector:set', 'asset', [ scriptAsset ]);
          });

          // edit
          var btnEdit = new ui.Button({
              text: '&#57648;'
          });
          btnEdit.class.add('edit');
          panel.headerAppend(btnEdit);
          btnEdit.on('click', function() {
              editor.call('assets:edit', scriptAsset);
          });
          btnEdit.hidden = editor.call('assets:scripts:collide', script) || ! editor.call('assets:scripts:assetByScript', script);
          // tooltip
          var tooltipEdit = Tooltip.attach({
              target: btnEdit.element,
              text: 'Edit',
              align: 'bottom',
              root: editor.call('layout.root')
          });
          btnEdit.once('destroy', function() {
              tooltipEdit.destroy();
          });

          // edit
          var btnParse = new ui.Button({
              text: '&#57640;'
          });
          btnParse.class.add('parse');
          panel.headerAppend(btnParse);
          btnParse.on('click', function() {
              btnParse.disabled = true;
              editor.call('scripts:parse', scriptAsset, function(err, result) {
                  btnParse.disabled = false;
                  if (err) {
                      btnParse.class.add('error');
                  } else {
                      btnParse.class.remove('error');
                  }
              });
          });
          btnParse.hidden = editor.call('assets:scripts:collide', script) || ! editor.call('assets:scripts:assetByScript', script);
          // tooltip
          var tooltipParse = Tooltip.attach({
              target: btnParse.element,
              text: 'Parse',
              align: 'bottom',
              root: editor.call('layout.root')
          });
          btnParse.once('destroy', function() {
              tooltipParse.destroy();
          });

          // remove
          var btnRemove = new ui.Button();
          btnRemove.class.add('remove');
          panel.headerAppend(btnRemove);
          btnRemove.on('click', function() {
              var records = [ ];

              for(var i = 0; i < entities.length; i++) {
                  if (! entities[i].has('components.script.scripts.' + script))
                      continue;

                  records.push({
                      get: entities[i].history._getItemFn,
                      ind: entities[i].get('components.script.order').indexOf(script),
                      data: entities[i].get('components.script.scripts.' + script)
                  });
              }

              for(var i = 0; i < records.length; i++) {
                  var entity = records[i].get();
                  entity.history.enabled = false;
                  entity.unset('components.script.scripts.' + script);
                  entity.removeValue('components.script.order', script);
                  entity.history.enabled = true;
              }

              editor.call('history:add', {
                  name: 'entities.components.script.scripts',
                  undo: function() {
                      for(var i = 0; i < records.length; i++) {
                          var item = records[i].get();
                          if (! item) continue;

                          item.history.enabled = false;
                          item.set('components.script.scripts.' + script, records[i].data);
                          item.insert('components.script.order', script, records[i].ind);
                          item.history.enabled = true;
                      }
                  },
                  redo: function() {
                      for(var i = 0; i < records.length; i++) {
                          var item = records[i].get();
                          if (! item) continue;

                          item.history.enabled = false;
                          item.unset('components.script.scripts.' + script);
                          item.removeValue('components.script.order', script);
                          item.history.enabled = true;
                      }
                  }
              });

              removeScript(script);
          });
          // tooltip
          var tooltipRemove = Tooltip.attach({
              target: btnRemove.element,
              text: 'Remove',
              align: 'bottom',
              root: editor.call('layout.root')
          });
          btnRemove.once('destroy', function() {
              tooltipRemove.destroy();
          });

          // enable/disable
          var fieldEnabled = editor.call('attributes:addField', {
              panel: panel,
              type: 'checkbox',
              link: entities,
              path: 'components.script.scripts.' + script + '.enabled'
          });
          fieldEnabled.class.remove('tick');
          fieldEnabled.class.add('component-toggle');
          fieldEnabled.element.parentNode.removeChild(fieldEnabled.element);
          panel.headerAppend(fieldEnabled);

          // toggle-label
          var labelEnabled = new ui.Label();
          labelEnabled.renderChanges = false;
          labelEnabled.class.add('component-toggle-label');
          panel.headerAppend(labelEnabled);
          labelEnabled.text = fieldEnabled.class.contains('null') ? '?' : (fieldEnabled.value ? 'On' : 'Off');
          fieldEnabled.on('change', function(value) {
              labelEnabled.text = fieldEnabled.class.contains('null') ? '?' : (value ? 'On' : 'Off');
          });

          var scriptAsset = editor.call('assets:scripts:assetByScript', script);

          if (scriptAsset)
              panel.headerElementTitle.classList.add('link');

          // invalid sign
          var labelInvalid = new ui.Label({ text: '!' });
          labelInvalid.renderChanges = false;
          labelInvalid.class.add('invalid-script');
          panel.headerAppend(labelInvalid);
          labelInvalid.hidden = !! scriptAsset;

          // invalid tooltip
          var tooltipInvalid = editor.call('attributes:reference', {
              title: 'Invalid',
              description: 'test'
          });
          tooltipInvalid.attach({
              target: panel,
              element: labelInvalid.element
          });

          var updateInvalidTooltip = function() {
              var asset = editor.call('assets:scripts:assetByScript', script);
              var description = '';

              if (editor.call('assets:scripts:collide', script)) {
                  // collision
                  description = '\'' + script + '\' Script Object is defined in multiple preloaded assets. Please uncheck preloading for undesirable script assets.';
              } else {
                  // no script
                  description = '\'' + script + '\' Script Object is not defined in any of preloaded script assets.';
              }

              tooltipInvalid.html = editor.call('attributes:reference:template', {
                  title: 'Invalid',
                  description: description
              });
          };
          if (! scriptAsset)
              updateInvalidTooltip();

          panelScripts.hidden = false;

          // primary script changed
          events.push(editor.on('assets:scripts[' + script + ']:primary:set', function(asset) {
              scriptAsset = asset;
              labelInvalid.hidden = true;
              btnEdit.hidden = btnParse.hidden = false;
              panel.headerElementTitle.classList.add('link');
          }));
          events.push(editor.on('assets:scripts[' + script + ']:primary:unset', function(asset) {
              scriptAsset = null;
              labelInvalid.hidden = false;
              btnEdit.hidden = btnParse.hidden = true;
              panel.headerElementTitle.classList.remove('link');
              updateInvalidTooltip();
          }));

          // attribute added
          events.push(editor.on('assets:scripts[' + script + ']:attribute:set', function(asset, name, ind) {
              if (asset !== scriptAsset)
                  return;

              var attribute = scriptAsset.get('data.scripts.' + script + '.attributes.' + name);
              addScriptAttribute(script, name, attribute, ind);
          }));
          // attribute change
          events.push(editor.on('assets:scripts[' + script + ']:attribute:change', function(asset, name, attribute, old) {
              if (asset !== scriptAsset)
                  return;

              updateScriptAttribute(script, name, attribute, old);
          }));
          // attribute move
          events.push(editor.on('assets:scripts[' + script + ']:attribute:move', function(asset, name, ind, indOld) {
              if (asset !== scriptAsset)
                  return;

              moveScriptAttribute(script, name, ind, indOld);
          }));
          // attribute removed
          events.push(editor.on('assets:scripts[' + script + ']:attribute:unset', function(asset, name) {
              if (asset !== scriptAsset)
                  return;

              removeScriptAttribute(script, name);
          }));

          if (scriptAsset) {
              var attributesOrder = scriptAsset.get('data.scripts.' + script + '.attributesOrder');
              if (attributesOrder) {
                  for(var i = 0; i < attributesOrder.length; i++) {
                      var attribute = scriptAsset.get('data.scripts.' + script + '.attributes.' + attributesOrder[i]);
                      addScriptAttribute(script, attributesOrder[i], attribute);
                  }
              }
          }
      };
      var removeScript = function(script) {
          if (! scriptPanelsIndex[script])
              return;

          var complete = true;
          for(var i = 0; i < entities.length; i++) {
              if (entities[i].has('components.script.scripts.' + script)) {
                  complete = false;
                  break;
              }
          }

          var panel = scriptPanelsIndex[script];

          if (! complete) {
              if (panel) panel.header = script + ' *';
              return;
          }

          if (panel) {
              delete scriptPanelsIndex[script];
              panel.destroy();
          }

          if (! panelScripts.innerElement.firstChild)
              panelScripts.hidden = true;
      };
      var addScriptAttribute = function(script, name, attribute, ind) {
          var panelScripts = scriptPanelsIndex[script];
          if (! panelScripts || panelScripts.attributesIndex[name])
              return;

          var panel = new ui.Panel();
          panel.field = null;
          panel.args = null;
          panelScripts.attributesIndex[name] = panel;

          var next = null;
          if (typeof(ind) === 'number')
              next = panelScripts.innerElement.children[ind];

          if (next) {
              panelScripts.appendBefore(panel, next);
          } else {
              panelScripts.append(panel);
          }

          var type = attributeTypeToUi[attribute.type];

          var reference = {
              title: name,
              subTitle: editor.call('assets:scripts:typeToSubTitle', attribute),
              description: attribute.description || ''
          };

          var min = typeof(attribute.min) === 'number' ? attribute.min : undefined;
          var max = typeof(attribute.max) === 'number' ? attribute.max : undefined;
          var curves = null;
          var choices = null;
          if (attribute.type === 'curve') {
              if (attribute.color) {
                  if ((attribute.color === 'rgb') || (attribute.color === 'rgba')) {
                      type = 'gradient';
                  }
                  curves = attribute.color.split('');
                  min = 0;
                  max = 1;
              } else if (attribute.curves) {
                  curves = attribute.curves;
              } else {
                  curves = [ 'Value' ];
              }
          }

          if (attribute.enum) {
              choices = [ { v: '', t: '...' } ];
              for(var i = 0; i < attribute.enum.order.length; i++) {
                  var key = attribute.enum.order[i];
                  choices.push({
                      v: attribute.enum.options[key],
                      t: key
                  });
              }
          }

          if (attribute.array) {
              panel.field = editor.call('attributes:addArrayField', {
                  panel: panel,
                  name: attribute.title || name,
                  placeholder: attribute.placeholder || null,
                  reference: reference,
                  type: type,
                  default: attribute.default,
                  kind: attribute.assetType || '*',
                  link: entities,
                  enum: choices,
                  curves: curves,
                  gradient: !! attribute.color,
                  precision: attribute.precision,
                  step: attribute.step,
                  min: min,
                  max: max,
                  hideRandomize: true,
                  path: 'components.script.scripts.' + script + '.attributes.' + name
              });
          } else {
              panel.args = {
                  parent: panel,
                  name: attribute.title || name,
                  placeholder: attribute.placeholder || null,
                  reference: reference,
                  type: type,
                  kind: attribute.assetType || '*',
                  link: entities,
                  enum: choices,
                  curves: curves,
                  gradient: !! attribute.color,
                  min: min,
                  max: max,
                  precision: attribute.precision,
                  step: attribute.step,
                  hideRandomize: true,
                  path: 'components.script.scripts.' + script + '.attributes.' + name
              };
              panel.field = editor.call('attributes:addField', panel.args);

              if (type === 'number') {
                  panel.slider = editor.call('attributes:addField', {
                      panel: panel.field.parent,
                      type: 'number',
                      slider: true,
                      link: entities,
                      min: min,
                      max: max,
                      precision: attribute.precision,
                      step: attribute.step,
                      path: 'components.script.scripts.' + script + '.attributes.' + name
                  });
                  panel.field.flexGrow = 1;
                  panel.field.style.width = '32px';
                  panel.slider.style.width = '32px';
                  panel.slider.flexGrow = 4;

                  panel.slider.update = function() {
                      panel.slider.hidden = (typeof(panel.args.max) !== 'number' || typeof(panel.args.min) !== 'number');
                      if (! panel.slider.hidden) {
                          panel.slider.max = panel.args.max;
                          panel.slider.min = panel.args.min;
                      }
                  };
                  panel.slider.update();
              }
          }

          return panel;
      };
      var removeScriptAttribute = function(script, name) {
          var panelScripts = scriptPanelsIndex[script];
          if (! panelScripts || ! panelScripts.attributesIndex[name])
              return;

          panelScripts.attributesIndex[name].destroy();
          delete panelScripts.attributesIndex[name];
      };
      var updateScriptAttribute = function(script, name, value, old) {
          var panelScripts = scriptPanelsIndex[script];
          if (! panelScripts) return;

          var panel = panelScripts.attributesIndex[name];
          if (! panel) return;

          var changed = false;
          if (value.type !== old.type)
              changed = true;

          if (! changed && !! value.array !== !! old.array)
              changed = true;

          if (! changed && typeof(value.enum) !== typeof(old.enum))
              changed = true;

          if (! changed && typeof(value.enum) === 'object' && ! value.enum.order.equals(old.enum.order))
              changed = true;

          if (! changed && typeof(value.enum) === 'object') {
              for(var i = 0; i < value.enum.order.length; i++) {
                  if (value.enum.options[value.enum.order[i]] !== old.enum.options[value.enum.order[i]]) {
                      changed = true;
                      break;
                  }
              }
          }

          if (! changed && value.type === 'curve' && typeof(value.color) !== typeof(old.color))
              changed = true;

          if (! changed && value.type === 'curve' && typeof(value.color) !== 'string' && typeof(value.curves) !== typeof(old.curves))
              changed = true;

          if (! changed) {
              var changeTooltip = false;

              var label = null;
              if (panel.field instanceof Array) {
                  label = panel.field[0].parent._label;
              } else {
                  label = panel.field.parent._label;
              }

              if (value.title !== old.title) {
                  changeTooltip = true;
                  label.text = value.title || name;
              }
              if (value.description !== old.description) {
                  changeTooltip = true;
              }
              if (value.placeholder !== old.placeholder) {
                  if (panel.field instanceof Array) {
                      if (value.placeholder instanceof Array && value.placeholder.length === panel.field.length) {
                          for(var i = 0; i < panel.field.length; i++) {
                              panel.field[i].placeholder = value.placeholder[i];
                          }
                      } else {
                          for(var i = 0; i < panel.field.length; i++) {
                              panel.field[i].placeholder = null;
                          }
                      }
                  } else {
                      panel.field.placeholder = value.placeholder;
                  }
              }
              if (value.min !== old.min) {
                  panel.args.min = value.min;
                  if (value.type === 'number') {
                      panel.field.min = value.min;
                      panel.slider.update();
                  }
              }
              if (value.max !== old.max) {
                  panel.args.max = value.max;
                  if (value.type === 'number') {
                      panel.field.max = value.max;
                      panel.slider.update();
                  }
              }
              if (value.assetType !== old.assetType)
                  panel.args.kind = value.assetType;

              if (changeTooltip) {
                  label._tooltip.html = editor.call('attributes:reference:template', {
                      title: name,
                      subTitle: editor.call('assets:scripts:typeToSubTitle', value),
                      description: value.description
                  });
              }
          }

          if (changed) {
              var next = panel.element.nextSibling;
              removeScriptAttribute(script, name);
              var panel = addScriptAttribute(script, name, value);

              // insert at same location
              if (next) {
                  var parent = panel.element.parentNode;
                  parent.removeChild(panel.element);
                  parent.insertBefore(panel.element, next);
              }
          }
      };

      var moveScriptAttribute = function(script, name, ind, indOld) {
          var panelScripts = scriptPanelsIndex[script];
          if (! panelScripts) return;

          var panel = panelScripts.attributesIndex[name];
          if (! panel) return;

          var parent = panel.element.parentNode;
          parent.removeChild(panel.element);

          var next = parent.children[ind];
          if (next) {
              parent.insertBefore(panel.element, next);
          } else {
              parent.appendChild(panel.element);
          }
      };

      var scripts = { };
      for(var i = 0; i < entities.length; i++) {
          // on script add
          events.push(entities[i].on('components.script.order:insert', function(value, ind) {
              addScript(value, ind);
              calculateExcludeScripts();
          }));

          // on script remove
          events.push(entities[i].on('components.script.order:remove', function(value) {
              removeScript(value);
              calculateExcludeScripts();
          }));

          // on script component set
          events.push(entities[i].on('components.script:set', function(value) {
              if (! value || ! value.order || ! value.order.length)
                  return;

              for(var i = 0; i < value.order.length; i++) {
                  addScript(value.order[i], i);
                  calculateExcludeScripts();
              }
          }));

          // on script component unset
          events.push(entities[i].on('components.script:unset', function(value) {
              if (! value || ! value.order || ! value.order.length)
                  return;

              for(var i = 0; i < value.order.length; i++) {
                  removeScript(value.order[i]);
                  calculateExcludeScripts();
              }
          }));

          // on script move
          if (entities.length === 1) {
              events.push(entities[i].on('components.script.order:move', function(value, ind, indOld) {
                  var panel = scriptPanelsIndex[value];
                  if (! panel) return;

                  var parent = panel.element.parentNode;
                  parent.removeChild(panel.element);

                  var next = parent.children[ind];
                  if (next) {
                      parent.insertBefore(panel.element, next);
                  } else {
                      parent.appendChild(panel.element);
                  }
              }));
          }

          var items = entities[i].get('components.script.order');
          if (! items || items.length === 0)
              continue;

          for(var s = 0; s < items.length; s++)
              scripts[items[s]] = true;
      }

      for(var key in scripts) {
          if (! scripts.hasOwnProperty(key))
              continue;

          addScript(key);
      }

      panel.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();

          events = null;
      });
  });
});


/* editor/attributes/components/attributes-components-script.js */
editor.once('load', function() {
  'use strict';

  if (! editor.call('settings:project').get('useLegacyScripts'))
      return;

  var scriptAttributeTypes = {
      'number': 'number',
      'string': 'string',
      'boolean': 'checkbox',
      'asset': 'assets', // TEMP
      'rgb': 'rgb',
      'rgba': 'rgb', // TEMP
      'vector': 'vec3',
      'vec2': 'vec2',
      'vec3': 'vec3',
      'vec4': 'vec4',
      'enumeration': 'number',
      'entity': 'entity',
      'curve': 'curveset',
      'colorcurve': 'curveset'
  };

  var scriptAttributeRuntimeTypes = {
      'number': '{Number}',
      'string': '{String}',
      'boolean': '{Boolean}',
      'rgb': '{pc.Color}',
      'rgba': '{pc.Color}',
      'vector': '{pc.Vec3}',
      'vec2': '{pc.Vec2}',
      'vec3': '{pc.Vec3}',
      'vec4': '{pc.Vec4}',
      'enumeration': '{Number}',
      'entity': '{pc.Entity}'
  };

  // index entities with script components
  // so we can easily find them when we need
  // to refresh script attributes
  var entitiesWithScripts = { };

  editor.on('entities:add', function (entity) {
      if (entity.get('components.script'))
          entitiesWithScripts[entity.get('resource_id')] = entity;

      entity.on('components.script:set', function (value) {
          if (! value)
              return;

          entitiesWithScripts[entity.get('resource_id')] = entity;
      });

      entity.on('components.script:unset', function () {
          delete entitiesWithScripts[entity.get('resource_id')];
      });
  });

  editor.on('entities:remove', function (entity) {
      delete entitiesWithScripts[entity.get('resource_id')];
  });

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Scripts',
          name: 'script',
          entities: entities
      });

      // holds each script panel
      var events = [ ];
      var scriptsIndex = { };

      for(var i = 0; i < entities.length; i++) {
          events.push(entities[i].on('components.script:unset', function(valueOld) {
              if (! valueOld)
                  return;

              for(var i = 0; i < valueOld.scripts.length; i++) {
                  var scriptPanel = scriptsIndex[valueOld.scripts[i].url];
                  if (! scriptPanel)
                      continue;

                  scriptPanel.count--;
                  scriptPanel._link.textContent = (scriptPanel.count === entities.length ? '' : '* ') + scriptPanel._originalTitle;

                  if (scriptPanel.count === 0) {
                      scriptPanel.destroy();
                      delete scriptsIndex[valueOld.scripts[i].url];
                  }
              }
          }));
      }

      var urlRegex = /^http(s)?:/;
      var jsRegex = /\.js$/;
      var scriptNameRegex = /^(?:[\w\d\.-]+\/)*[\w\d\.-]+(?:\.[j|J][s|S](?:[o|O][n|N])?)?$/;

      // scripts.add
      var btnAddScript = new ui.Button({
          text: 'Add Script'
      });
      btnAddScript.class.add('add-script');
      panel.append(btnAddScript);

      btnAddScript.on('click', function () {
          var evtPick = editor.once("picker:asset", function (asset) {
              addScript(asset.get('filename'));
              evtPick = null;
          });

          // show asset picker
          editor.call("picker:asset", {
              type: "script"
          });

          editor.once('picker:asset:close', function () {
              if (evtPick) {
                  evtPick.unbind();
                  evtPick = null;
              }
          });
      });

      var panelScripts = new ui.Panel();
      panelScripts.class.add('components-scripts');
      panel.append(panelScripts);

      var addScript = function(url) {
          var scriptAdded = false;
          var records = [ ];
          var requestScript = false;

          if (! urlRegex.test(url)) {
              if (! jsRegex.test(url))
                  url += '.js';

              if (! scriptNameRegex.test(url) || url.indexOf('..') >= 0)
                  return false;

              requestScript = true;
          }

          for(var i = 0; i < entities.length; i++) {
              var addScript = true;
              var scripts = entities[i].getRaw('components.script.scripts');
              for(var s = 0; s < scripts.length; s++) {
                  if (scripts[s].get('url') === url) {
                      addScript = false;
                      break;
                  }
              }

              if (addScript) {
                  var script = new Observer({
                      url: url
                  });

                  records.push({
                      get: entities[i].history._getItemFn
                  });

                  entities[i].history.enabled = false;
                  entities[i].insert('components.script.scripts', script);
                  entities[i].history.enabled = true;

                  scriptAdded = true;
              }
          }

          if (requestScript) {
              // try to get the script and if it doesn't exist create it
              editor.call('sourcefiles:content', url, function (err) {
                  // script does not exist so create it
                  if (err === 404) {
                      editor.call('sourcefiles:create', editor.call('sourcefiles:skeleton', url), url);
                  } else if (!err) {
                      refreshScriptAttributes(url);
                  }
              });
          } else {
              refreshScriptAttributes(url);
          }

          editor.call('history:add', {
              name: 'entities.components.script.scripts',
              undo: function() {
                  for(var i = 0; i < records.length; i++) {
                      var item = records[i].get();
                      if (! item)
                          continue;

                      var scripts = item.getRaw('components.script.scripts');
                      if (! scripts)
                          continue;

                      for(var s = 0; s < scripts.length; s++) {
                          if (scripts[s].get('url') !== url)
                              continue;

                          item.history.enabled = false;
                          item.removeValue('components.script.scripts', scripts[s]);
                          item.history.enabled = true;
                          break;
                      }
                  }
              },
              redo: function() {
                  for(var i = 0; i < records.length; i++) {
                      var item = records[i].get();
                      if (! item)
                          continue;

                      var addScript = true;
                      var scripts = item.getRaw('components.script.scripts');
                      for(var s = 0; s < scripts.length; s++) {
                          if (scripts[s].get('url') !== url)
                              continue;
                          addScript = false;
                          break;
                      }

                      if (! addScript)
                          continue;

                      var script = new Observer({
                          url: url
                      });

                      item.history.enabled = false;
                      item.insert('components.script.scripts', script);
                      item.history.enabled = true;
                  }

                  refreshScriptAttributes(url);
              }
          });

          return scriptAdded;
      };

      var refreshScriptAttributes = function(url) {
          if (! editor.call('permissions:write'))
              return;

          var fullUrl = urlRegex.test(url) ? url : editor.call('sourcefiles:url', url) + '?access_token=' + config.accessToken;

          editor.call('sourcefiles:scan', fullUrl, function (data) {
              data.url = url;

              // merge old attributes with new attributes for all script components with this script
              for (var key in entitiesWithScripts) {
                  var entity = entitiesWithScripts[key];
                  var scripts = entity.getRaw('components.script.scripts');
                  if (! scripts)
                      continue;

                  for (var i = 0; i < scripts.length; i++) {
                      var scriptInstance = scripts[i];
                      if (scriptInstance.get('url') !== url)
                          continue;

                      var oldAttributes = scriptInstance.get('attributes') || { };
                      for (var attributeName in data.attributes) {
                          if (! data.attributes.hasOwnProperty(attributeName))
                              continue;

                          var value = data.attributes[attributeName].defaultValue;
                          if (attributeName in oldAttributes) {
                              var attributeOld = oldAttributes[attributeName];
                              var attributeNew = data.attributes[attributeName];

                              if (attributeOld.type === 'asset') {
                                  if (attributeOld.options.type !== attributeNew.options.type) {
                                      // different asset.type
                                      if (attributeNew.options.max === 1) {
                                          if (typeof(attributeNew.defaultValue) === 'number') {
                                              value = attributeNew.defaultValue;
                                          } else {
                                              value = null;
                                          }
                                      } else {
                                          if (attributeNew.defaultValue instanceof Array) {
                                              value = attributeNew.defaultValue;
                                          } else {
                                              value = [ ];
                                          }
                                      }
                                  } else if (attributeOld.options.max === 1 && attributeNew.options.max !== 1) {
                                      // now multiple assets
                                      if (attributeOld.value && typeof(attributeOld.value) === 'number') {
                                          value = [ attributeOld.value ];
                                      } else if (attributeNew.defaultValue instanceof Array) {
                                          value = attributeNew.defaultValue;
                                      } else {
                                          value = [ ];
                                      }
                                  } else if (attributeOld.options.max !== 1 && attributeNew.options.max === 1) {
                                      // now single asset
                                      if ((attributeOld.value instanceof Array) && attributeOld.value.length && attributeOld.value[0] && typeof(attributeOld.value[0]) === 'number') {
                                          value = attributeOld.value[0];
                                      } else if (typeof(attributeNew.defaultValue) === 'number') {
                                          value = attributeNew.defaultValue;
                                      } else {
                                          value = null;
                                      }
                                  } else {
                                      // old value
                                      value = attributeOld.value !== attributeOld.defaultValue ? attributeOld.value : value;
                                  }
                              } else if (attributeOld.type === data.attributes[attributeName].type) {
                                  // old value
                                  value = attributeOld.value !== attributeOld.defaultValue ? attributeOld.value : value;
                              }
                          }

                          data.attributes[attributeName].value = value;
                      }

                      // this is not undoable
                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      entity.getRaw('components.script.scripts.' + i).patch(data);
                      entity.history.enabled = history;
                  }
              }
          });
      };

      var updateAttributeFields = function(script, parent) {
          var attributes = script.get('attributesOrder');
          var children = parent.innerElement.childNodes;
          var list = [ ];
          var index = { };
          var toDestroy = [ ];
          var toCreate = [ ];

          for(var i = 0; i < children.length; i++) {
              var attribute = children[i].ui.attribute;
              var attributeType = children[i].ui.attributeType;
              var attributeUiType = children[i].ui.attributeUiType;

              if (attributes.indexOf(attribute) === -1 || attributeUiType !== script.get('attributes.' + attribute + '.type')) {
                  toDestroy.push(children[i].ui);
              } else {
                  list.push(attribute);
                  index[attribute] = children[i].ui;
              }
          }

          var i = toDestroy.length;
          while(i--) {
              toDestroy[i].destroy();
          }

          if (attributes) {
              for(var i = 0; i < attributes.length; i++) {
                  var ind = list.indexOf(attributes[i]);
                  var panelAttribute = null;

                  if (ind === -1) {
                      // new attibute
                      panelAttribute = createAttributeField(script, attributes[i], parent);
                      list.splice(i, 0, attributes[i]);
                      index[attributes[i]] = panelAttribute;
                  } else if (ind !== i) {
                      // moved attribute
                      panelAttribute = index[attributes[i]];
                      list.splice(ind, 1);
                      list.splice(i, 0, attributes[i]);
                  }

                  if (! panelAttribute)
                      continue;

                  parent.innerElement.removeChild(panelAttribute.element);

                  var ref = null;
                  if (i === 0) {
                      ref = parent.innerElement.firstChild;
                  } else {
                      ref = index[list[i - 1]].element.nextSibling;
                  }

                  if (ref) {
                      parent.innerElement.insertBefore(panelAttribute.element, ref);
                  } else {
                      parent.innerElement.appendChild(panelAttribute.element);
                  }
              }
          }
      };

      var createAttributeField = function(script, attribute, parent) {
          var choices = null;
          attribute = script.get('attributes.' + attribute);

          if (attribute.type === 'enumeration') {
              choices = [ { v: '', t: '...' } ];

              try {
                  for(var e = 0; e < attribute.options.enumerations.length; e++) {
                      choices.push({
                          v: attribute.options.enumerations[e].value,
                          t: attribute.options.enumerations[e].name
                      });
                  }
              } catch(ex) {
                  console.log(ex)
                  console.log('could not recreate enumeration for script attribute, ' + script.get('url'));
              }
          }

          var url = script.get('url');
          var scripts = [ ];
          for(var i = 0; i < entities.length; i++) {
              var items = entities[i].getRaw('components.script.scripts');
              if (! items)
                  continue;

              for(var s = 0; s < items.length; s++) {
                  if (items[s].get('url') === url) {
                      scripts.push(items[s]);
                      break;
                  }
              }
          }

          var field;

          var reference = {
              title: attribute.name,
              subTitle: scriptAttributeRuntimeTypes[attribute.type]
          };

          if (attribute.description)
              reference.description = attribute.description;
          else if (attribute.displayName !== attribute.name)
              reference.description = attribute.displayName;

          var type = scriptAttributeTypes[attribute.type];
          if (attribute.type === 'enumeration' && choices.length >= 2 && typeof(choices[1].v) === 'string') {
              type = 'string';
              reference.subTitle = scriptAttributeRuntimeTypes[type];
          } else if (attribute.type === 'asset') {
              if (attribute.options.max === 1) {
                  reference.subTitle = '{Number}';
              } else {
                  reference.subTitle = '[Number]';
              }
          } else if (attribute.type === 'curve') {
              if (attribute.options.curves.length > 1) {
                  reference.subTitle = '{pc.CurveSet}';
              } else {
                  reference.subTitle = '{pc.Curve}';
              }
          } else if (attribute.type === 'colorcurve') {
              if (attribute.options.type.length === 1) {
                  reference.subTitle = '{pc.Curve}';
              } else {
                  reference.subTitle = '{pc.CurveSet}';
              }
          }

          if (scriptAttributeTypes[attribute.type] !== 'assets') {
              var type = scriptAttributeTypes[attribute.type];
              if (attribute.type === 'enumeration' && choices.length >= 2 && typeof(choices[1].v) === 'string')
                  type = 'string';

              var args = {
                  parent: parent,
                  name: attribute.displayName || attribute.name,
                  type: type,
                  enum: choices,
                  link: scripts,
                  path: 'attributes.' + attribute.name + '.value',
                  reference: reference
              };

              if (attribute.type === 'number') {
                  if (attribute.options && attribute.options.step) {
                      args.step = attribute.options.step;
                      console.log('step yes')
                  }
              } else if (attribute.type === 'curve' || attribute.type === 'colorcurve') {
                  // find entity of first script
                  var firstEntity = scripts[0]._parent;
                  while (firstEntity._parent) {
                      firstEntity = firstEntity._parent;
                  }

                  var scriptIndex = firstEntity.getRaw('components.script.scripts').indexOf(scripts[0]);

                  var setCurvePickerArgs = function (options) {
                      if (attribute.type === 'curve') {
                          args.curves = options.curves;
                          args.min = options.min;
                          args.max = options.max;
                          args.gradient = false;
                      } else {
                          args.curves = options.type.split('');
                          args.min = 0;
                          args.max = 1;
                          args.gradient = true;
                      }
                  };

                  setCurvePickerArgs(attribute.options);

                  // use entity as the link for the curve so that history will work as expected
                  args.link = firstEntity;
                  args.path = 'components.script.scripts.' + scriptIndex + '.attributes.' + attribute.name + '.value';
                  args.hideRandomize = true;

                  var curveType = attribute.type;

                  // when argument options change make sure we refresh the curve pickers
                  var evtOptionsChanged = scripts[0].on('attributes.' + attribute.name + '.options:set', function (value, oldValue) {
                      // do this in a timeout to make sure it's done after all of the
                      // attribute fields have been updated like the 'defaultValue' field
                      setTimeout(function () {
                          // argument options changed so get new options and set args
                          var options = value;

                          var prevNumCurves = args.curves.length;

                          setCurvePickerArgs(options);

                          // reset field value which will trigger a refresh of the curve picker as well
                          var attributeValue = scripts[0].get('attributes.' + attribute.name + '.value');
                          if (prevNumCurves !== args.curves.length) {
                              attributeValue = scripts[0].get('attributes.' + attribute.name + '.defaultValue');
                              scripts[0].set('attributes.' + attribute.name + '.value', attributeValue);
                          }

                          field.curveNames = args.curves;
                          field.value = [attributeValue];
                      });
                  });
                  events.push(evtOptionsChanged);

                  // if we change the attribute type then don't listen to options changes
                  var evtTypeChanged = scripts[0].on('attributes.' + attribute.name + '.type:set', function (value) {
                      if (value !== curveType) {
                          evtOptionsChanged.unbind();
                          evtTypeChanged.unbind();
                      }
                  });
                  events.push(evtTypeChanged);
              }

              field = editor.call('attributes:addField', args);

              if (attribute.type === 'curve' || attribute.type === 'colorcurve') {
                  if (entities.length > 1)
                      field.disabled = true;
              }
          }

          if (attribute.type !== 'enumeration' && scriptAttributeTypes[attribute.type] === 'number') {
              field.flexGrow = 1;
              field.style.width = '32px';

              // slider
              var slider = editor.call('attributes:addField', {
                  panel: field.parent,
                  min: isNaN(attribute.options.min) ? 0 : attribute.options.min,
                  max: isNaN(attribute.options.max) ? 1 : attribute.options.max,
                  type: 'number',
                  slider: true,
                  link: scripts,
                  path: 'attributes.' + attribute.name + '.value'
              });
              slider.style.width = '32px';
              slider.flexGrow = 4;

              var sliderHidden = function() {
                  var min = script.get('attributes.' + attribute.name + '.options.min');
                  var max = script.get('attributes.' + attribute.name + '.options.max');
                  slider.hidden = min == null || max == null || isNaN(min) || isNaN(max);
              };
              sliderHidden();

              var evtMin = script.on('attributes.' + attribute.name + '.options.min:set', function(value) {
                  slider.min = value;
                  sliderHidden();
              });
              events.push(evtMin)

              var evtMax = script.on('attributes.' + attribute.name + '.options.max:set', function(value) {
                  slider.max = value;
                  sliderHidden();
              });
              events.push(evtMax);

              var evtMinUnset = script.on('attributes.' + attribute.name + '.options.min:unset', function() {
                  slider.hidden = true;
              });
              events.push(evtMinUnset);

              var evtMaxUnset = script.on('attributes.' + attribute.name + '.options.max:unset', function() {
                  slider.hidden = true;
              });
              events.push(evtMaxUnset);

              events.push(field.once('destroy', function() {
                  evtMin.unbind();
                  evtMax.unbind();
                  evtMinUnset.unbind();
                  evtMaxUnset.unbind();
              }));
          } else if (scriptAttributeTypes[attribute.type] === 'assets') {
              var options;

              if (attribute.options.max === 1) {
                  // asset
                  options = {
                      parent: parent,
                      name: attribute.displayName || attribute.name,
                      type: 'asset',
                      kind: attribute.options.type || '*',
                      link: scripts,
                      path: 'attributes.' + attribute.name + '.value',
                      single: true,
                      reference: reference
                  };
                  field = editor.call('attributes:addField', options);
              } else {
                  // assets
                  options = {
                      panel: parent,
                      name: attribute.displayName || attribute.name,
                      type: attribute.options.type || '*',
                      link: scripts,
                      path: 'attributes.' + attribute.name + '.value'
                  };
                  field = editor.call('attributes:addAssetsList', options);
              }

              field.options = options;

              // if we change asset `type`
              var evtAssetTypeChanged = scripts[0].on('attributes.' + attribute.name + '.options.type:set', function (value) {
                  options.kind = value || '*';
              });
              events.push(evtAssetTypeChanged);

              // if we change `max` to change between single/multiple
              var evtMaxAssetChanged = script.on('attributes.' + attribute.name + '.options.max:set', function(value) {
                  if ((options.single && value === 1) || (! options.single && value !== 1))
                      return;

                  setTimeout(function() {
                      updateAttributeFields(script, parent);
                  }, 0);
              });
              events.push(evtMaxAssetChanged);

              field.once('destroy', function() {
                  evtAssetTypeChanged.unbind();
                  evtMaxAssetChanged.unbind();
              });
          }

          var fieldParent;
          if (field instanceof Array) {
              fieldParent = field[0].parent;
          } else {
              fieldParent = field.parent;
          }

          var evtType = script.on('attributes.' + attribute.name + '.type:set', function(value) {
              setTimeout(function() {
                  updateAttributeFields(script, parent);
              }, 0);
          });
          events.push(evtType);

          events.push(fieldParent.once('destroy', function() {
              evtType.unbind();
          }));

          fieldParent.attribute = attribute.name;
          fieldParent.attributeUiType = scriptAttributeTypes[attribute.type];
          fieldParent.attributeType = attribute.type;

          return fieldParent;
      };

      var createScriptPanel = function(script) {
          var panelScript = scriptsIndex[script.get('url')];
          if (panelScript) {
              panelScript.count++;
              panelScript._link.textContent = (panelScript.count === entities.length ? '' : '* ') + panelScript._originalTitle;
              return;
          }

          panelScript = new ui.Panel(script.get('url'));
          panelScript.class.add('component-script');
          panelScript.count = 1;

          var href = document.createElement('div');
          href.classList.add('link');

          var url = script.get('url');
          var lowerUrl = url.toLowerCase();
          var isExternalUrl = urlRegex.test(lowerUrl);
          if (! isExternalUrl && ! jsRegex.test(url))
              url += '.js';

          panelScript._originalTitle = script.get('name') || getFilenameFromUrl(url);
          panelScript._link = href;
          href.textContent = (panelScript.count === entities.length ? '' : '* ') + panelScript._originalTitle;
          href.url = isExternalUrl ? url : 'https://' + window.location.host + '/editor/code/' + config.project.id + '/' + url;
          href.addEventListener('click', function() {
              window.open(this.url, this.url);
          });
          panelScript.headerElementTitle.textContent = '';
          panelScript.headerElementTitle.appendChild(href);

          // name change
          events.push(script.on('name:set', function(value) {
              panelScript._originalTitle = value;
              href.textContent = (panelScript.count === entities.length ? '' : '* ') + panelScript._originalTitle;
          }));

          // remove
          var fieldRemoveScript = new ui.Button();
          fieldRemoveScript.parent = panelScript;
          fieldRemoveScript.class.add('remove');
          fieldRemoveScript.on('click', function (value) {
              var records = [ ];

              for(var i = 0; i < entities.length; i++) {
                  entities[i].history.enabled = false;
                  var scripts = entities[i].getRaw('components.script.scripts');
                  for(var s = 0; s < scripts.length; s++) {
                      if (scripts[s].get('url') === script.get('url')) {
                          var data = scripts[s].json();

                          records.push({
                              get: entities[i].history._getItemFn,
                              value: data,
                              ind: s
                          });

                          entities[i].remove('components.script.scripts', s);
                          break;
                      }
                  }
                  entities[i].history.enabled = true;
              }

              delete scriptsIndex[script.get('url')];

              if (! records.length)
                  return;

              editor.call('history:add', {
                  name: 'entities.components.script.scripts',
                  undo: function() {
                      for(var i = 0; i < records.length; i++) {
                          var item = records[i].get();
                          if (! item)
                              continue;

                          var scripts = item.getRaw('components.script.scripts');
                          if (! scripts)
                              continue;

                          var addScript = true;

                          for(var s = 0; s < scripts.length; s++) {
                              if (scripts[s].get('url') === records[i].value.url) {
                                  addScript = false;
                                  break;
                              }
                          }

                          if (! addScript)
                              continue;

                          var script = new Observer(records[i].value);

                          item.history.enabled = false;
                          item.insert('components.script.scripts', script, records[i].ind);
                          item.history.enabled = true;
                      }

                      refreshScriptAttributes(records[0].value.url);
                  },
                  redo: function() {
                      for(var i = 0; i < records.length; i++) {
                          var item = records[i].get();
                          if (! item)
                              continue;

                          var scripts = item.getRaw('components.script.scripts');

                          for(var s = 0; s < scripts.length; s++) {
                              if (scripts[s].get('url') !== records[i].value.url)
                                  continue;

                              item.history.enabled = false;
                              item.removeValue('components.script.scripts', scripts[s]);
                              item.history.enabled = true;
                              break;
                          }
                      }

                      delete scriptsIndex[records[0].value.url];
                  }
              });
          });
          panelScript.headerElement.appendChild(fieldRemoveScript.element);

          // TODO
          // allow reordering scripts if all entities scripts components are identical

          // move down
          var fieldMoveDown = new ui.Button();
          fieldMoveDown.class.add('move-down');
          fieldMoveDown.element.title = 'Move script down';
          fieldMoveDown.on('click', function () {
              var scripts = entities[0].getRaw('components.script.scripts');
              var ind = scripts.indexOf(script);
              if (ind < scripts.length - 1)
                  entities[0].move('components.script.scripts', ind, ind + 1);
          });
          panelScript.headerElement.appendChild(fieldMoveDown.element);
          if (entities.length > 1)
              fieldMoveDown.style.visibility = 'hidden';

          // move up
          var fieldMoveUp = new ui.Button();
          fieldMoveUp.class.add('move-up');
          fieldMoveUp.element.title = 'Move script up';
          fieldMoveUp.on('click', function () {
              var ind = entities[0].getRaw('components.script.scripts').indexOf(script);
              if (ind > 0)
                  entities[0].move('components.script.scripts', ind, ind - 1);
          });
          panelScript.headerElement.appendChild(fieldMoveUp.element);
          if (entities.length > 1)
              fieldMoveUp.style.visibility = 'hidden';

          // refresh attributes
          var fieldRefreshAttributes = new ui.Button();
          fieldRefreshAttributes.class.add('refresh');
          fieldRefreshAttributes.element.title = "Refresh script attributes";
          panelScript.headerElement.appendChild(fieldRefreshAttributes.element);

          fieldRefreshAttributes.on('click', function () {
              refreshScriptAttributes(script.get('url'));
          });

          // attributes panel
          var attributes = new ui.Panel();
          panelScript.append(attributes);

          if (script.has('attributesOrder')) {
              // add attributes if has any
              var order = script.get('attributesOrder');
              if (order) {
                  for(var i = 0; i < order.length; i++) {
                      createAttributeField(script, order[i], attributes);
                  }
              }
          }

          var timerUpdateAttributes = null;
          // when attributes order changed, schedule update
          events.push(script.on('attributesOrder:set', function() {
              if (timerUpdateAttributes)
                  return;

              timerUpdateAttributes = setTimeout(function() {
                  timerUpdateAttributes = null;
                  updateAttributeFields(script, attributes);
              }, 0);
          }));

          return panelScript;
      };

      // Converts URL to script name
      var getFilenameFromUrl = function(url) {
          var filename = url;

          if (jsRegex.test(filename))
              filename = filename.substring(0, filename.length - 3);

          var lastIndexOfSlash = filename.lastIndexOf('/');
          if (lastIndexOfSlash >= 0)
              filename = filename.substring(lastIndexOfSlash + 1, filename.length);

          return filename;
      };

      var addScriptPanel = function(script, ind) {
          var panelScript = createScriptPanel(script);
          if (! panelScript)
              return;

          scriptsIndex[script.get('url')] = panelScript;

          var panels = panelScripts.innerElement.childNodes;

          if (ind === undefined || ind === panels.length) {
              // append at the end
              panelScripts.append(panelScript);
          } else {
              // append before panel at next index
              panelScripts.appendBefore(panelScript, panels[ind]);
          }
      };

      // add existing scripts and subscribe to scripts Observer list
      for(var i = 0; i < entities.length; i++) {
          var scripts = entities[i].getRaw('components.script.scripts');

          if (scripts) {
              for(var s = 0; s < scripts.length; s++)
                  addScriptPanel(scripts[s]);
          }

          // subscribe to scripts:set
          events.push(entities[i].on('components.script.scripts:set', function(value, valueOld) {
              for(var i = 0; i < value.length; i++)
                  addScriptPanel(value[i]);
          }));

          // subscribe to scripts:insert
          events.push(entities[i].on('components.script.scripts:insert', function (script, ind) {
              addScriptPanel(script, ind);
          }));

          events.push(entities[i].on('components.script.scripts:move', function (value, indNew, indOld) {
              var elementOld = scriptsIndex[this.get('components.script.scripts.' + indOld + '.url')];
              var elementNew = scriptsIndex[value.get('url')];

              panelScripts.innerElement.removeChild(elementNew.element);

              if (indNew > indOld) {
                  if (elementOld.element.nextSibling) {
                      panelScripts.innerElement.insertBefore(elementNew.element, elementOld.element.nextSibling);
                  } else {
                      panelScripts.innerElement.appendChild(elementNew.element);
                  }
              } else {
                  panelScripts.innerElement.insertBefore(elementNew.element, elementOld.element);
              }
          }));

          // subscribe to scripts:remove
          events.push(entities[i].on('components.script.scripts:remove', function (script, ind) {
              var scriptPanel = scriptsIndex[script.get('url')];
              if (! scriptPanel)
                  return;

              scriptPanel.count--;
              scriptPanel._link.textContent = (scriptPanel.count === entities.length ? '' : '* ') + scriptPanel._originalTitle;

              if (scriptPanel.count === 0) {
                  scriptsIndex[script.get('url')].destroy();
                  script.destroy();
                  delete scriptsIndex[script.get('url')];
              }
          }));
      }

      // drag drop
      var dropRef = editor.call('drop:target', {
          ref: panel.element,
          filter: function(type, data) {
              if (type !== 'asset.script') return false;

              var root = editor.call('layout.root');
              var rectA = root.innerElement.getBoundingClientRect();
              var rectB = panel.element.getBoundingClientRect();
              if (rectB.top > rectA.top && rectB.bottom < rectA.bottom) {
                  for(var i = 0; i < entities.length; i++) {
                      var addScript = true;
                      var scripts = entities[i].getRaw('components.script.scripts');
                      for(var s = 0; s < scripts.length; s++) {
                          if (scripts[s].get('url') === data.filename) {
                              return false;
                          }
                      }
                  }

                  return true;
              }

              return false;

          },
          drop: function(type, data) {
              if (type !== 'asset.script')
                  return;

              addScript(data.filename);
          }
      });

      // clean up events
      panel.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();

          events = null;
          dropRef.unregister();
      });
  });
});


/* editor/attributes/components/attributes-components-zone.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var events = [ ];

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Zone',
          name: 'zone',
          entities: entities
      });


      // size
      var fieldSize = editor.call('attributes:addField', {
          parent: panel,
          name: 'Size',
          placeholder: [ 'W', 'H', 'D' ],
          precision: 2,
          step: 0.1,
          min: 0,
          type: 'vec3',
          link: entities,
          path: 'components.zone.size'
      });
      // reference
      editor.call('attributes:reference:attach', 'zone:size', fieldSize[0].parent.innerElement.firstChild.ui);
  });
});


/* editor/attributes/components/attributes-components-screen.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var events = [ ];

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Screen',
          name: 'screen',
          entities: entities
      });

      // Screenspace
      var fieldScreenspace = editor.call('attributes:addField', {
          parent: panel,
          name: 'Screen Space',
          type: 'checkbox',
          link: entities,
          path: 'components.screen.screenSpace'
      });

      // reference
      editor.call('attributes:reference:attach', 'screen:screenSpace', fieldScreenspace.parent.innerElement.firstChild.ui);

      // Resolution
      var fieldResolution = editor.call('attributes:addField', {
          parent: panel,
          name: 'Resolution',
          placeholder: ['Width', 'Height'],
          type: 'vec2',
          link: entities,
          path: 'components.screen.resolution'
      });

      fieldResolution[0].parent.hidden = !!fieldScreenspace.value;

      // reference
      editor.call('attributes:reference:attach', 'screen:resolution', fieldResolution[0].parent.innerElement.firstChild.ui);

      // Reference Resolution
      var fieldRefResolution = editor.call('attributes:addField', {
          parent: panel,
          name: 'Ref Resolution',
          placeholder: ['Width', 'Height'],
          type: 'vec2',
          link: entities,
          path: 'components.screen.referenceResolution'
      });

      // reference
      editor.call('attributes:reference:attach', 'screen:referenceResolution', fieldRefResolution[0].parent.innerElement.firstChild.ui);

      // scale mode
      var fieldScaleMode = editor.call('attributes:addField', {
          parent: panel,
          name: 'Scale Mode',
          type: 'string',
          enum: [
              {v: '', t: '...'},
              {v: 'none', t: 'None'},
              {v: 'blend', t: 'Blend'},
          ],
          link: entities,
          path: 'components.screen.scaleMode'
      });

      fieldScaleMode.parent.hidden = !fieldScreenspace.value;

      // hide ref resolution if necessary
      fieldRefResolution[0].parent.hidden = fieldScaleMode.value === 'none' || !fieldScreenspace.value;

      // reference
      editor.call('attributes:reference:attach', 'screen:scaleMode', fieldScaleMode.parent.innerElement.firstChild.ui);

      // scale blend
      var fieldScaleBlend = editor.call('attributes:addField', {
          parent: panel,
          name: 'Scale Blend',
          type: 'number',
          min: 0,
          max: 1,
          precision: 2,
          step: 0.1,
          link: entities,
          path: 'components.screen.scaleBlend'
      });

      fieldScaleBlend.style.width = '32px';
      fieldScaleBlend.parent.hidden = fieldScaleMode.value !== 'blend' || ! fieldScreenspace.value;
      events.push(fieldScaleMode.on('change', function (value) {
          fieldScaleBlend.parent.hidden = value !== 'blend' || ! fieldScreenspace.value;
          fieldRefResolution[0].parent.hidden = value === 'none' || !fieldScreenspace.value;
      }));

      var fieldScaleBlendSlider = editor.call('attributes:addField', {
          panel: fieldScaleBlend.parent,
          precision: 2,
          step: 0.1,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.screen.scaleBlend'
      });
      fieldScaleBlendSlider.flexGrow = 4;

      // reference
      editor.call('attributes:reference:attach', 'screen:scaleBlend', fieldScaleBlend.parent.innerElement.firstChild.ui);

      // on screenspace change
      events.push(fieldScreenspace.on('change', function (value) {
          fieldResolution[0].parent.hidden = !!value;
          fieldRefResolution[0].parent.hidden = fieldScaleMode.value === 'none' || !value;
          fieldScaleMode.parent.hidden = !value;
          fieldScaleBlend.parent.hidden = !value;
      }));

      panel.on('destroy', function () {
          events.forEach(function (e) {
              e.unbind();
          });
          events.length = 0;
      });

  });
});


/* editor/attributes/components/attributes-components-element.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var events = [ ];

      var projectSettings = editor.call('settings:project');

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Element',
          name: 'element',
          entities: entities
      });

      var fieldType = editor.call('attributes:addField', {
          parent: panel,
          name: 'Type',
          type: 'string',
          enum: [
              {v: '', t: '...'},
              {v: 'text', t: 'Text'},
              {v: 'image', t: 'Image'},
              {v: 'group', t: 'Group'}
          ],
          link: entities,
          path: 'components.element.type'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:type', fieldType.parent.innerElement.firstChild.ui);

      var presets = {
          '0,1,0,1/0,1': 'Top Left',
          '0.5,1,0.5,1/0.5,1': 'Top',
          '1,1,1,1/1,1': 'Top Right',
          '0,0.5,0,0.5/0,0.5': 'Left',
          '0.5,0.5,0.5,0.5/0.5,0.5': 'Center',
          '1,0.5,1,0.5/1,0.5': 'Right',
          '0,0,0,0/0,0': 'Bottom Left',
          '0.5,0,0.5,0/0.5,0': 'Bottom',
          '1,0,1,0/1,0': 'Bottom Right',
      };

      var presetsEnum = [];
      for (var key in presets) {
          presetsEnum.push({v: key, t: presets[key]});
      }

      presetsEnum.push({v: 'custom', t: 'Custom'});

      var fieldPreset = editor.call('attributes:addField', {
          parent: panel,
          name: 'Preset',
          type: 'string',
          className: 'field-path-components-element-preset',
          enum: presetsEnum
      });

      editor.call('attributes:reference:attach', 'element:preset', fieldPreset.parent.innerElement.firstChild.ui);

      var fieldAnchor = editor.call('attributes:addField', {
          parent: panel,
          placeholder: ['←', '↓', '→', '↑'],
          name: 'Anchor',
          type: 'vec4',
          precision: 2,
          step: 0.1,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.element.anchor'
      });

      var onAnchorChange = function () {
          toggleSize();
          toggleMargin();
      };


      fieldAnchor.forEach(function (field, index) {
          field.on('change', onAnchorChange);

          // var changing = false;

          // var refreshValue = function () {
          //     var value = null;
          //     for (var i = 0, len = entities.length; i < len; i++) {
          //         var anchor = entities[i].get('components.element.anchor.' + index);
          //         if (value === null) {
          //             value = anchor;
          //         } else if (value !== anchor) {
          //             value = null;
          //             break;
          //         }
          //     }

          //     changing = true;
          //     field.value = value;
          //     changing = false;
          //     field.proxy = value !== null ? null : '...';
          // };

          // refreshValue();

          // field.on('change', function (value) {
          //     if (changing) return;

          //     changing = true;

          //     var prev = {};

          //     for (var i = 0, len = entities.length; i < len; i++) {
          //         if (entities[i].has('components.element')) {
          //             var prevData = {
          //                 anchor: entities[i].get('components.element.anchor.' + index)
          //             };

          //             prev[entities[i].get('resource_id')] = prevData;

          //             var history = entities[i].history.enabled;
          //             entities[i].history.enabled = false;
          //             entities[i].set('components.element.anchor.' + index, value);
          //             entities[i].history.enabled = history;
          //         }
          //     }

          //     editor.call('history:add', {
          //         name: 'components.element.anchor.' + index,
          //         undo: function () {
          //             for (var i = 0, len = entities.length; i < len; i++) {
          //                 var prevData = prev[entities[i].get('resource_id')];
          //                 if (! prevData) continue;

          //                 var obj = editor.call('entities:get', entities[i].get('resource_id'));
          //                 if (! obj) return;
          //                 var history = obj.history.enabled;
          //                 obj.history.enabled = false;
          //                 obj.set('components.element.anchor.' + index, prevData.anchor);
          //                 obj.history.enabled = history;
          //             }
          //         },
          //         redo: function () {
          //             for (var i = 0, len = entities.length; i < len; i++) {
          //                 var obj = editor.call('entities:get', entities[i].get('resource_id'));
          //                 if (! obj) return;

          //                 var history = obj.history.enabled;
          //                 obj.history.enabled = false;
          //                 obj.set('components.element.anchor.' + index, value);
          //                 obj.history.enabled = history;
          //             }

          //         }
          //     });

          //     changing = false;

          // });

          // for (var i = 0, len = entities.length; i < len; i++) {
          //     events.push(entities[i].on('components.element.anchor:set', refreshValue));
          //     events.push(entities[i].on('components.element.anchor.0:set', refreshValue));
          //     events.push(entities[i].on('components.element.anchor.1:set', refreshValue));
          //     events.push(entities[i].on('components.element.anchor.2:set', refreshValue));
          //     events.push(entities[i].on('components.element.anchor.3:set', refreshValue));
          // }
      });

      // reference
      editor.call('attributes:reference:attach', 'element:anchor', fieldAnchor[0].parent.innerElement.firstChild.ui);

      var isUnderControlOfLayoutGroup = function () {
          for (var i = 0, len = entities.length; i < len; i++) {
              var entity = entities[i];

              if (editor.call('entities:layout:isUnderControlOfLayoutGroup', entity)) {
                  return true;
              }
          }

          return false;
      };

      var toggleAnchorAndPresets = function () {
          var disabled = isUnderControlOfLayoutGroup();

          for (var i = 0; i < 4; i++) {
              fieldAnchor[i].disabled = disabled;
          }

          fieldPreset.disabled = disabled;
      };

      toggleAnchorAndPresets();

      entities.forEach(function(entity) {
          events.push(entity.on('parent:set', toggleAnchorAndPresets));
          events.push(entity.on('components.layoutchild.excludeFromLayout:set', toggleAnchorAndPresets));
      });

      var fieldPivot = editor.call('attributes:addField', {
          parent: panel,
          placeholder: ['↔', '↕'],
          name: 'Pivot',
          type: 'vec2',
          precision: 2,
          step: 0.1,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.element.pivot'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:pivot', fieldPivot[0].parent.innerElement.firstChild.ui);

      // auto size
      var panelAutoSize = editor.call('attributes:addField', {
          parent: panel,
          name: 'Auto-Size'
      });
      var label = panelAutoSize;
      panelAutoSize = panelAutoSize.parent;
      label.destroy();

      panelAutoSize.hidden = fieldType.value !== 'text';

      // autoWidth
      var fieldAutoWidth = editor.call('attributes:addField', {
          panel: panelAutoSize,
          type: 'checkbox',
          link: entities,
          path: 'components.element.autoWidth'
      });
      // label
      label = new ui.Label({ text: 'Width' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      panelAutoSize.append(label);
      // reference
      editor.call('attributes:reference:attach', 'element:autoWidth', label);

      fieldAutoWidth.on('change', function (value) {
          toggleSize();
          toggleMargin();
          fieldAutoFitWidth.disabled = !!value;
          toggleFontSizeFields();
      });

      // autoHeight
      var fieldAutoHeight = editor.call('attributes:addField', {
          panel: panelAutoSize,
          type: 'checkbox',
          link: entities,
          path: 'components.element.autoHeight'
      });
      // label
      label = new ui.Label({ text: 'Height' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      panelAutoSize.append(label);

      // reference
      editor.call('attributes:reference:attach', 'element:autoHeight', label);

      fieldAutoHeight.on('change', function (value) {
          toggleSize();
          toggleMargin();
          fieldAutoFitHeight.disabled = !!value;
          toggleFontSizeFields();
      });

      var setPresetValue = function () {
          var val = fieldAnchor.map(function (f) {return f.value}).join(',') + '/' + fieldPivot.map(function (f) {return f.value}).join(',');
          if (! presets[val])
              val = 'custom';

          fieldPreset.value = val;
      };

      setPresetValue();

      var changingPreset = false;

      for (var i = 0; i < 4; i++) {
          events.push(fieldAnchor[i].on('change', function (value) {
              if (changingPreset) return;
              changingPreset = true;
              setPresetValue();
              changingPreset = false;
          }));
      }

      for (var i = 0; i < 2; i++) {
          events.push(fieldPivot[i].on('change', function (value) {
              if (changingPreset) return;
              changingPreset = true;
              setPresetValue();
              changingPreset = false;
          }));
      }

      events.push(fieldPreset.on('change', function (value) {
          if (! value || value === 'custom' || changingPreset) return;

          changingPreset = true;
          var fields = value.split('/');
          var anchor = fields[0].split(',').map(function (v){ return parseFloat(v);} );
          var pivot = fields[1].split(',').map(function (v){ return parseFloat(v);} );

          var prev = {};

          var prevAnchors = [];
          var prevPivots = [];
          var prevPositions = [];

          for (var i = 0; i < entities.length; i++) {
              var history = entities[i].history.enabled;
              entities[i].history.enabled = false;
              var width = entities[i].get('components.element.width');
              var height = entities[i].get('components.element.height');
              prev[entities[i].get('resource_id')] = {
                  anchor: entities[i].get('components.element.anchor'),
                  pivot: entities[i].get('components.element.pivot'),
                  width: width,
                  height: height
              };
              entities[i].set('components.element.anchor', anchor);
              entities[i].set('components.element.pivot', pivot);
              if (entities[i].entity) {
                  entities[i].entity.element.width = width;
                  entities[i].entity.element.height = height;
              }
              entities[i].history.enabled = history;
          }

          editor.call('history:add', {
              name: 'entities.components.element.preset',
              undo: function() {
                  for(var i = 0; i < entities.length; i++) {
                      var entity = entities[i];
                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      var prevRecord = prev[entity.get('resource_id')];
                      entity.set('components.element.anchor', prevRecord.anchor);
                      entity.set('components.element.pivot', prevRecord.pivot);
                      if (entity.entity) {
                          entity.entity.element.width = prevRecord.width;
                          entity.entity.element.height = prevRecord.height;
                      }
                      entity.history.enabled = history;
                  }
              },
              redo: function() {
                  for(var i = 0; i < entities.length; i++) {
                      var entity = entities[i];
                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      entity.set('components.element.anchor', anchor);
                      entity.set('components.element.pivot', pivot);

                      var prevRecord = prev[entity.get('resource_id')];

                      if (entity.entity) {
                          entity.entity.element.width = prevRecord.width;
                          entity.entity.element.height = prevRecord.height;
                      }

                      entity.history.enabled = history;
                  }
              }
          });


          changingPreset = false;
      }));

      var hasSplitAnchors = function (horizontal) {
          for (var i = 0, len = entities.length; i < len; i++) {
              var e = entities[i];
              var anchor = e.get('components.element.anchor');
              if (! anchor) continue;
              if (horizontal) {
                  if (Math.abs(anchor[0] - anchor[2]) > 0.001) {
                      return true;
                  }
              } else {
                  if (Math.abs(anchor[1] - anchor[3]) > 0.001) {
                      return true;
                  }
              }
          }

          return false;
      };

      var fieldWidth = editor.call('attributes:addField', {
          parent: panel,
          name: 'Size',
          type: 'number',
          placeholder: 'Width',
          link: entities,
          path: 'components.element.width'
      });

      fieldWidth.style.width = '32px';

      // reference
      editor.call('attributes:reference:attach', 'element:size', fieldWidth.parent.innerElement.firstChild.ui);

      var fieldHeight = editor.call('attributes:addField', {
          panel: fieldWidth.parent,
          type: 'number',
          placeholder: 'Height',
          link: entities,
          path: 'components.element.height'
      });

      fieldHeight.style.width = '32px';

      var toggleSize = function () {
          fieldWidth.disabled = hasSplitAnchors(true) || (fieldAutoWidth.value && fieldType.value === 'text');
          fieldWidth.renderChanges = !fieldWidth.disabled;
          fieldHeight.disabled = hasSplitAnchors(false) || (fieldAutoHeight.value && fieldType.value === 'text');
          fieldHeight.renderChanges = !fieldHeight.disabled;
          fieldAutoWidth.disabled = hasSplitAnchors(true);
          fieldAutoHeight.disabled = hasSplitAnchors(false);
      };

      toggleSize();

      var fieldMargin = editor.call('attributes:addField', {
          parent: panel,
          name: 'Margin',
          type: 'vec4',
          placeholder: ['←', '↓', '→', '↑'],
          link: entities,
          path: 'components.element.margin'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:margin', fieldMargin[0].parent.innerElement.firstChild.ui);

      var toggleMargin = function () {
          var horizontalSplit = hasSplitAnchors(true);
          var verticalSplit = hasSplitAnchors(false);
          fieldMargin[0].disabled = ! horizontalSplit;
          fieldMargin[2].disabled = fieldMargin[0].disabled;

          fieldMargin[1].disabled = ! verticalSplit;
          fieldMargin[3].disabled = fieldMargin[1].disabled;

          for (var i = 0; i < 4; i++)
              fieldMargin[i].renderChanges = !fieldMargin[i].disabled;
      };

      toggleMargin();

      var fieldAlignment = editor.call('attributes:addField', {
          parent: panel,
          name: 'Alignment',
          type: 'vec2',
          placeholder: ['↔', '↕'],
          precision: 2,
          step: 0.1,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.element.alignment'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:alignment', fieldAlignment[0].parent.innerElement.firstChild.ui);

      fieldAlignment[0].parent.hidden = fieldType.value !== 'text';


      var fieldFontAsset = editor.call('attributes:addField', {
          parent: panel,
          name: 'Font',
          type: 'asset',
          kind: 'font',
          link: entities,
          path: 'components.element.fontAsset'
      });

      fieldFontAsset.parent.hidden = fieldType.value !== 'text';

      // reference
      editor.call('attributes:reference:attach', 'element:fontAsset', fieldFontAsset.parent.innerElement.firstChild.ui);


      var fieldLocalized = editor.call('attributes:addField', {
          parent: panel,
          name: 'Localized',
          type: 'checkbox'
      });

      fieldLocalized.parent.hidden = (fieldType.value !== 'text' || !editor.call('users:hasFlag', 'hasLocalization'));

      // reference
      editor.call('attributes:reference:attach', 'element:localized', fieldLocalized.parent.innerElement.firstChild.ui);

      var fieldText = editor.call('attributes:addField', {
          parent: panel,
          name: 'Text',
          type: 'text',
          link: entities,
          path: 'components.element.text'
      });

      // in order to display RTL text correctly in the editor
      // see https://www.w3.org/International/articles/inline-bidi-markup/
      fieldText.elementInput.setAttribute("dir", "auto");

      // reference
      editor.call('attributes:reference:attach', 'element:text', fieldText.parent.innerElement.firstChild.ui);

      var fieldKey = editor.call('attributes:addField', {
          parent: panel,
          name: 'Key',
          type: 'text',
          link: entities,
          path: 'components.element.key'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:key', fieldKey.parent.innerElement.firstChild.ui);

      // Show / hide the text / key fields
      var toggleTextFields = function () {
          fieldText.parent.hidden = fieldType.value !== 'text' || fieldLocalized.value || fieldLocalized.class.contains('null');
          fieldKey.parent.hidden = fieldType.value !== 'text' || !fieldLocalized.value || fieldLocalized.class.contains('null');
      };

      var suppressLocalizedEvents = false;

      // manually set the value of the localized field.
      // if we have selected entities with some localized and
      // some not localized elements then add the 'null' class
      // like attributes-panel.js does to show that there are multiple
      // values set for the checkpoint
      var refreshLocalizedValue = function () {
          var i; var len;
          var countUnlocalized = 0;
          suppressLocalizedEvents = true;
          for (i = 0, len = entities.length; i < len; i++) {
              if (entities[i].get('components.element.key') === null) {
                  countUnlocalized++;
              }
          }
          if (countUnlocalized) {
              if (countUnlocalized !== len) {
                  fieldLocalized.class.add('null');
              } else {
                  fieldLocalized.class.remove('null');
              }

              fieldLocalized.value = false;
          } else {
              fieldLocalized.value = true;
              fieldLocalized.class.remove('null');
          }

          suppressLocalizedEvents = false;
      };

      refreshLocalizedValue();

      toggleTextFields();

      // update the value of the localized field when we change the element key
      // If the key is null it means the element is not localized. If not null then it is localized.
      for (var i = 0, len = entities.length; i < len; i++) {
          events.push(entities[i].on('components.element.key:set', refreshLocalizedValue));
      }

      // When the user changes the localized field then
      // set the 'key' value instead of the 'text' value if localized
      // or vice-versa if not localized.
      fieldLocalized.on('change', function (localized) {
          toggleTextFields();

          if (suppressLocalizedEvents) return;

          var prev;
          var path = localized ? 'components.element.key' : 'components.element.text';
          var otherPath = localized ? 'components.element.text' : 'components.element.key';

          var undo = function () {
              for (var id in prev) {
                  var e = editor.call('entities:get', id);
                  if (!e) return;
                  if (e.has('components.element')) {
                      var history = e.history.enabled;
                      e.history.enabled = false;
                      e.set(path, null);
                      e.set(otherPath, prev[id]);
                      e.history.enabled = history;
                  }
              }
          };

          var redo = function () {
              prev = {};
              for (var i = 0, len = entities.length; i < len; i++) {
                  var id = entities[i].get('resource_id');
                  var e = editor.call('entities:get', id);
                  if (!e) continue;

                  if (e.has('components.element')) {
                      // we need to switch between the 'key'
                      // and 'text' fields depending on whether we picked
                      // for this element to be localized or not.
                      // But don't do anything if this element is already localized
                      // (or not depending on which we picked).
                      var val = e.get(otherPath);
                      if (val === null) continue;

                      prev[id] = val;
                      var history = e.history.enabled;
                      e.history.enabled = false;
                      e.set(otherPath, null);
                      e.set(path, prev[id]);
                      e.history.enabled = history;
                  }
              }
          };

          redo();

          editor.call('history:add', {
              name: 'entities.localized',
              undo: undo,
              redo: redo
          });
      });

      // enableMarkup
      var fieldEnableMarkup = editor.call('attributes:addField', {
          parent: panel,
          name: 'Enable Markup',
          type: 'checkbox',
          link: entities,
          path: 'components.element.enableMarkup'
      });

      fieldEnableMarkup.parent.hidden = fieldType.value !== 'text';

      // reference
      editor.call('attributes:reference:attach', 'element:enableMarkup', fieldEnableMarkup.parent.innerElement.firstChild.ui);
      
      // auto fit
      var panelAutoFit = editor.call('attributes:addField', {
          parent: panel,
          name: 'Auto-Fit'
      });
      label = panelAutoFit;
      panelAutoFit = panelAutoFit.parent;
      label.destroy();
      panelAutoFit.hidden = fieldType.value !== 'text';

      // auto fit width
      var fieldAutoFitWidth = editor.call('attributes:addField', {
          panel: panelAutoFit,
          type: 'checkbox',
          link: entities,
          path: 'components.element.autoFitWidth'
      });
      label = new ui.Label({ text: 'Width' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      panelAutoFit.append(label);
      fieldAutoFitWidth.disabled = fieldAutoWidth.value;

      editor.call('attributes:reference:attach', 'element:autoFitWidth', label);

      fieldAutoFitWidth.on('change', function () {
          toggleFontSizeFields();
      });

      // auto fit height
      var fieldAutoFitHeight = editor.call('attributes:addField', {
          panel: panelAutoFit,
          type: 'checkbox',
          link: entities,
          path: 'components.element.autoFitHeight'
      });
      label = new ui.Label({ text: 'Height' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      panelAutoFit.append(label);
      fieldAutoFitHeight.disabled = fieldAutoHeight.value;

      editor.call('attributes:reference:attach', 'element:autoFitHeight', label);

      fieldAutoFitHeight.on('change', function () {
          toggleFontSizeFields();
      });

      var fieldFontSize = editor.call('attributes:addField', {
          parent: panel,
          name: 'Font Size',
          type: 'number',
          link: entities,
          path: 'components.element.fontSize'
      });

      fieldFontSize.parent.hidden = fieldType.value !== 'text';

      // reference
      editor.call('attributes:reference:attach', 'element:fontSize', fieldFontSize.parent.innerElement.firstChild.ui);

      var fieldMinFontSize = editor.call('attributes:addField', {
          panel: fieldFontSize.parent,
          type: 'number',
          min: 0,
          placeholder: 'Min',
          link: entities,
          path: 'components.element.minFontSize'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:minFontSize', fieldMinFontSize);

      var fieldMaxFontSize = editor.call('attributes:addField', {
          panel: fieldFontSize.parent,
          type: 'number',
          placeholder: 'Max',
          min: 0,
          link: entities,
          path: 'components.element.maxFontSize'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:maxFontSize', fieldMaxFontSize);

      var toggleFontSizeFields = function () {
          fieldMaxFontSize.hidden = fieldType.value !== 'text' || ((fieldAutoFitWidth.disabled || !fieldAutoFitWidth.value) && (fieldAutoFitHeight.disabled || !fieldAutoFitHeight.value));
          fieldMinFontSize.hidden = fieldMaxFontSize.hidden;
          fieldFontSize.hidden = !fieldMaxFontSize.hidden;
      };

      toggleFontSizeFields();

      var fieldLineHeight = editor.call('attributes:addField', {
          parent: panel,
          name: 'Line Height',
          type: 'number',
          link: entities,
          path: 'components.element.lineHeight'
      });

      fieldLineHeight.parent.hidden = fieldType.value !== 'text';

      // reference
      editor.call('attributes:reference:attach', 'element:lineHeight', fieldLineHeight.parent.innerElement.firstChild.ui);

      var fieldWrapLines = editor.call('attributes:addField', {
          parent: panel,
          name: 'Wrap Lines',
          type: 'checkbox',
          link: entities,
          path: 'components.element.wrapLines'
      });

      fieldWrapLines.parent.hidden = fieldType.value !== 'text';

      // reference
      editor.call('attributes:reference:attach', 'element:wrapLines', fieldWrapLines.parent.innerElement.firstChild.ui);

      fieldWrapLines.on('change', function (value) {
          fieldMaxLines.parent.hidden = fieldType.value !== 'text' || !value;
      });

      var fieldMaxLines = editor.call('attributes:addField', {
          parent: panel,
          name: 'Max Lines',
          type: 'number',
          min: 1,
          allowNull: true,
          link: entities,
          path: 'components.element.maxLines'
      });

      fieldMaxLines.parent.hidden = fieldType.value !== 'text' || !fieldWrapLines.value;

      editor.call('attributes:reference:attach', 'element:maxLines', fieldMaxLines.parent.innerElement.firstChild.ui);

      var fieldSpacing = editor.call('attributes:addField', {
          parent: panel,
          name: 'Spacing',
          type: 'number',
          link: entities,
          path: 'components.element.spacing'
      });

      fieldSpacing.parent.hidden = fieldType.value !== 'text';

      // reference
      editor.call('attributes:reference:attach', 'element:spacing', fieldSpacing.parent.innerElement.firstChild.ui);

      var fieldColor = editor.call('attributes:addField', {
          parent: panel,
          name: 'Color',
          type: 'rgb',
          channels: 3,
          link: entities,
          path: 'components.element.color'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:color', fieldColor.parent.innerElement.firstChild.ui);

      var fieldOpacity = editor.call('attributes:addField', {
          parent: panel,
          name: 'Opacity',
          type: 'number',
          min: 0,
          max: 1,
          link: entities,
          path: 'components.element.opacity'
      });

      fieldOpacity.style.width = '32px';

      // reference
      editor.call('attributes:reference:attach', 'element:opacity', fieldOpacity.parent.innerElement.firstChild.ui);

      var fieldOpacitySlider = editor.call('attributes:addField', {
          panel: fieldOpacity.parent,
          precision: 3,
          step: 1,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.element.opacity'
      });
      fieldOpacitySlider.flexGrow = 4;

      var fieldOutlineColor = editor.call('attributes:addField', {
          parent: panel,
          name: 'Outline Color',
          type: 'rgb',
          channels: 4,
          link: entities,
          path: 'components.element.outlineColor'
      });
      fieldOutlineColor.parent.hidden = (fieldType.value !== 'text');
      editor.call('attributes:reference:attach', 'element:outlineColor', fieldOutlineColor.parent.innerElement.firstChild.ui);

      var fieldOutlineThickness = editor.call('attributes:addField', {
          parent: panel,
          name: 'Outline Thickness',
          type: 'number',
          precision: 2,
          step: 0.1,
          min: 0,
          max: 1,
          link: entities,
          path: 'components.element.outlineThickness'
      });
      fieldOutlineThickness.style.width = '32px';
      fieldOutlineThickness.parent.hidden = (fieldType.value !== 'text');
      editor.call('attributes:reference:attach', 'element:outlineThickness', fieldOutlineThickness.parent.innerElement.firstChild.ui);

      var fieldOutlineThicknessSlider = editor.call('attributes:addField', {
          panel: fieldOutlineThickness.parent,
          precision: 3,
          step: 1,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.element.outlineThickness'
      });
      fieldOutlineThicknessSlider.flexGrow = 4;
      fieldOutlineThicknessSlider.parent.hidden = (fieldType.value !== 'text');

      var fieldShadowColor =  editor.call('attributes:addField', {
          parent: panel,
          name: 'Shadow Color',
          type: 'rgb',
          channels: 4,
          link: entities,
          path: 'components.element.shadowColor'
      });
      fieldShadowColor.parent.hidden = (fieldType.value !== 'text');
      editor.call('attributes:reference:attach', 'element:shadowColor', fieldShadowColor.parent.innerElement.firstChild.ui);

      var fieldShadowOffset = editor.call('attributes:addField', {
          parent: panel,
          name: 'Shadow Offset',
          type: 'vec2',
          placeholder: ['↔', '↕'],
          precision: 2,
          step: 0.1,
          min: -1,
          max: 1,
          link: entities,
          path: 'components.element.shadowOffset'
      });
      fieldShadowOffset[0].parent.hidden = (fieldType.value !== 'text');
      editor.call('attributes:reference:attach', 'element:shadowOffset', fieldShadowOffset[0].parent.innerElement.firstChild.ui);

      var fieldRect = editor.call('attributes:addField', {
          parent: panel,
          name: 'Rect',
          type: 'vec4',
          placeholder: ['u', 'v', 'w', 'h'],
          link: entities,
          path: 'components.element.rect'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:rect', fieldRect[0].parent.innerElement.firstChild.ui);

      var fieldMask = editor.call('attributes:addField', {
          parent: panel,
          name: 'Mask',
          type: 'checkbox',
          link: entities,
          path: 'components.element.mask'
      });

      fieldMask.parent.hidden = fieldType.value !== 'image';

      // reference
      editor.call('attributes:reference:attach', 'element:mask', fieldMask.parent.innerElement.firstChild.ui);

      var fieldTextureAsset = editor.call('attributes:addField', {
          parent: panel,
          name: 'Texture',
          type: 'asset',
          kind: 'texture',
          link: entities,
          path: 'components.element.textureAsset'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:textureAsset', fieldTextureAsset.parent.innerElement.firstChild.ui);

      var fieldSpriteAsset = editor.call('attributes:addField', {
          parent: panel,
          name: 'Sprite',
          type: 'asset',
          kind: 'sprite',
          link: entities,
          path: 'components.element.spriteAsset'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:spriteAsset', fieldSpriteAsset.parent.innerElement.firstChild.ui);

      // frame
      var fieldFrame = editor.call('attributes:addField', {
          parent: panel,
          name: 'Frame',
          type: 'number',
          min: 0,
          precision: 0,
          step: 1,
          link: entities,
          path: 'components.element.spriteFrame'
      });

      var fieldPpu = editor.call('attributes:addField', {
          parent: panel,
          name: 'Pixels Per Unit',
          type: 'number',
          link: entities,
          min: 0,
          allowNull: true,
          path: 'components.element.pixelsPerUnit'
      });
      // reference
      editor.call('attributes:reference:attach', 'element:pixelsPerUnit', fieldPpu.parent.innerElement.firstChild.ui, null, panel);

      var fieldMaterialAsset = editor.call('attributes:addField', {
          parent: panel,
          name: 'Material',
          type: 'asset',
          kind: 'material',
          link: entities,
          path: 'components.element.materialAsset'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:materialAsset', fieldMaterialAsset.parent.innerElement.firstChild.ui);

      var fieldUseInput = editor.call('attributes:addField', {
          parent: panel,
          name: 'Use Input',
          type: 'checkbox',
          link: entities,
          path: 'components.element.useInput'
      });

      // reference
      editor.call('attributes:reference:attach', 'element:useInput', fieldUseInput.parent.innerElement.firstChild.ui);

      // divider
      var divider = document.createElement('div');
      divider.classList.add('fields-divider');
      panel.append(divider);

      // batch group

      var batchGroups = projectSettings.get('batchGroups');
      var batchEnum = {
          '': '...',
          'NaN': 'None'
      };
      for (var key in batchGroups) {
          batchEnum[key] = batchGroups[key].name;
      }

      var fieldBatchGroup = editor.call('attributes:addField', {
          parent: panel,
          name: 'Batch Group',
          type: 'number',
          enum: batchEnum,
          link: entities,
          path: 'components.element.batchGroupId'
      });


      var btnAddGroup = document.createElement('li');
      btnAddGroup.classList.add('add-batch-group');
      btnAddGroup.innerHTML = 'Add Group';
      fieldBatchGroup.elementOptions.appendChild(btnAddGroup);

      // reference
      editor.call('attributes:reference:attach', 'element:batchGroupId', fieldBatchGroup.parent.innerElement.firstChild.ui);

      // Create new batch group, assign it to the selected entities and focus on it in the settings panel
      btnAddGroup.addEventListener('click', function () {
          var group = editor.call('editorSettings:batchGroups:create');
          batchEnum[group] = projectSettings.get('batchGroups.' + group + '.name');
          fieldBatchGroup._updateOptions(batchEnum);
          fieldBatchGroup.value = group;
          editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
          setTimeout(function () {
              editor.call('editorSettings:batchGroups:focus', group);
          });
      });

      // layers
      var layers = projectSettings.get('layers');
      var layersEnum = {
          '': ''
      };
      for (var key in layers) {
          layersEnum[key] = layers[key].name;
      }
      delete layersEnum[LAYERID_DEPTH];
      delete layersEnum[LAYERID_SKYBOX];
      delete layersEnum[LAYERID_IMMEDIATE];

      var fieldLayers = editor.call('attributes:addField', {
          parent: panel,
          name: 'Layers',
          type: 'tags',
          tagType: 'number',
          enum: layersEnum,
          placeholder: 'Add Layer',
          link: entities,
          path: 'components.element.layers',
          tagToString: function (tag) {
              return projectSettings.get('layers.' + tag + '.name') || 'Missing';
          },
          onClickTag: function () {
              // focus layer
              var layerId = this.originalValue;
              editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
              setTimeout(function () {
                  editor.call('editorSettings:layers:focus', layerId);
              });
          }
      });

      // reference
      editor.call('attributes:reference:attach', 'element:layers', fieldLayers.parent.parent.innerElement.firstChild.ui);

      var toggleFields = function () {
          fieldSpriteAsset.parent.hidden = fieldType.value !== 'image' || fieldTextureAsset.value || fieldMaterialAsset.value;
          fieldFrame.parent.hidden = fieldSpriteAsset.parent.hidden || ! fieldSpriteAsset.value;
          fieldPpu.parent.hidden = fieldSpriteAsset.parent.hidden || ! fieldSpriteAsset.value;
          fieldTextureAsset.parent.hidden = fieldType.value !== 'image' || fieldSpriteAsset.value || fieldMaterialAsset.value;
          fieldMaterialAsset.parent.hidden = fieldType.value !== 'image' || fieldTextureAsset.value || fieldSpriteAsset.value;
          fieldColor.parent.hidden = fieldType.value !== 'image' && fieldType.value !== 'text' || fieldMaterialAsset.value;
          fieldOpacity.parent.hidden = fieldType.value !== 'image' && fieldType.value !== 'text' || fieldMaterialAsset.value;
          fieldRect[0].parent.hidden = fieldType.value !== 'image' || fieldSpriteAsset.value;

          // disable batch groups until they're working properly
          fieldBatchGroup.parent.hidden = !editor.call('users:hasFlag', 'has2DBatchGroups');
      };

      toggleFields();

      events.push(fieldType.on('change', function (value) {
          toggleTextFields();
          fieldFontAsset.parent.hidden = value !== 'text';
          fieldFontSize.parent.hidden = value !== 'text';
          fieldLineHeight.parent.hidden = value !== 'text';
          fieldWrapLines.parent.hidden = value !== 'text';
          fieldMaxLines.parent.hidden = value !== 'text' || !fieldWrapLines.value;
          fieldSpacing.parent.hidden = value !== 'text';
          fieldLocalized.parent.hidden = (value !== 'text' || !editor.call('users:hasFlag', 'hasLocalization'));
          toggleSize();
          toggleMargin();
          toggleFields();
          panelAutoSize.hidden = value !== 'text';
          panelAutoFit.hidden = value !== 'text';
          fieldAlignment[0].parent.hidden = value !== 'text';
          fieldOutlineColor.parent.hidden = (value !== 'text');
          fieldOutlineThickness.parent.hidden = (value !== 'text');
          fieldOutlineThicknessSlider.parent.hidden = (value !== 'text');
          fieldShadowColor.parent.hidden = (value !== 'text');
          fieldShadowOffset[0].parent.hidden = (value !== 'text');
          fieldEnableMarkup.parent.hidden = (value !== 'text');
      }));


      events.push(fieldMaterialAsset.on('change', toggleFields));

      events.push(fieldTextureAsset.on('change', function (value) {
          toggleSize();
          toggleFields();
      }));

      events.push(fieldFontAsset.on('change', function (value) {
          if (value) {
              editor.call('settings:projectUser').set('editor.lastSelectedFontId', value);
          }
      }));

      events.push(fieldSpriteAsset.on('change', toggleFields));

      // handle local changes to texture field to
      // auto set width and height and combine all of them in the same
      // history action
      events.push(fieldTextureAsset.on('beforechange', function (value) {
          if (! value) return;

          // if the field already has a texture set then do not
          // change width / height
          if (fieldTextureAsset.value) {
              return;
          }

          var asset = editor.call('assets:get', value);
          if (! asset) return;

          if (! asset.has('meta.width') || ! asset.has('meta.height')) return;

          var width = asset.get('meta.width');
          var height = asset.get('meta.height');
          if (width === fieldWidth.value && height === fieldHeight.value)
              return;

          fieldTextureAsset.once('change', function (value) {
              var lastHistoryAction = editor.call('history:list')[editor.call('history:current')];
              var lastUndo = lastHistoryAction.undo;
              var lastRedo = lastHistoryAction.redo;

              var previous = {};
              for (var i = 0, len = entities.length; i < len; i++) {
                  var anchor = entities[i].get('components.element.anchor');
                  if (Math.abs(anchor[0] - anchor[2]) > 0.001 || Math.abs(anchor[1] - anchor[3]) > 0.001) {
                      continue;
                  }

                  var prevData = {
                      width: entities[i].get('components.element.width'),
                      height: entities[i].get('components.element.height'),
                      margin: entities[i].get('components.element.margin')
                  };


                  previous[entities[i].get('resource_id')] = prevData;
              }

              lastHistoryAction.undo = function () {
                  lastUndo();

                  for (var i = 0, len = entities.length; i < len; i++) {
                      var prev = previous[entities[i].get('resource_id')];
                      if (! prev) continue;

                      var entity = editor.call('entities:get', entities[i].get('resource_id'));
                      if (! entity) continue;

                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      if (entity.has('components.element')) {
                          entity.set('components.element.width', prev.width);
                          entity.set('components.element.height', prev.height);
                          entity.set('components.element.margin', prev.margin);
                      }
                      entity.history.enabled = history;
                  }
              };

              var redo = function () {
                  for (var i = 0, len = entities.length; i < len; i++) {
                      var prev = previous[entities[i].get('resource_id')];
                      if (! prev) continue;

                      var entity = editor.call('entities:get', entities[i].get('resource_id'));
                      if (! entity) continue;

                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      if (entity.has('components.element')) {
                          entity.set('components.element.width', width);
                          entity.set('components.element.height', height);

                          if (entity.entity) {
                              var margin = entity.entity.element.margin;
                              entity.set('components.element.margin', [margin.x, margin.y, margin.z, margin.w]);
                          }
                      }
                      entity.history.enabled = history;
                  }
              };

              lastHistoryAction.redo = function () {
                  lastRedo();
                  redo();
              };

              redo();
          });

      }));


      panel.on('destroy', function () {
          events.forEach(function (e) {
              e.unbind();
          });
          events.length = 0;
      });

  });
});


/* editor/attributes/components/attributes-components-button.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (!panelComponents)
          return;

      var events = [];
      var componentName = 'button';

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Button',
          name: componentName,
          entities: entities
      });

      function addField(propertyName, options) {
          var path = 'components.' + componentName + '.' + propertyName;
          var target = componentName + ':' + propertyName;

          if (!options.panel) {
              options.parent = panel;
          }
          options.parent = panel;
          options.path = path;
          options.link = entities;

          var field = editor.call('attributes:addField', options);
          var fieldParent = Array.isArray(field) ? field[0].parent : field.parent;

          editor.call('attributes:reference:attach', target, fieldParent.innerElement.firstChild.ui);

          return field;
      }

      addField('active', {
          name: 'Active',
          type: 'checkbox'
      });

      addField('imageEntity', {
          name: 'Image',
          type: 'entity'
      });

      addField('hitPadding', {
          name: 'Hit Padding',
          type: 'vec4',
          placeholder: ['←', '↓', '→', '↑']
      });

      var fieldTransitionMode = addField('transitionMode', {
          name: 'Transition Mode',
          type: 'number',
          enum: [
              {v: '', t: '...'},
              {v: BUTTON_TRANSITION_MODE_TINT, t: 'Tint'},
              {v: BUTTON_TRANSITION_MODE_SPRITE_CHANGE, t: 'Sprite Change'}
          ]
      });

      var fieldHoverTint = addField('hoverTint', {
          name: 'Hover Tint',
          type: 'rgb',
          channels: 4
      });

      var fieldPressedTint = addField('pressedTint', {
          name: 'Pressed Tint',
          type: 'rgb',
          channels: 4
      });

      var fieldInactiveTint = addField('inactiveTint', {
          name: 'Inactive Tint',
          type: 'rgb',
          channels: 4
      });

      var fieldFadeDuration = addField('fadeDuration', {
          name: 'Fade Duration',
          type: 'number',
          precision: 0,
          step: 1,
          placeholder: 'ms'
      });

      fieldFadeDuration.style.flexGrow = 0;
      fieldFadeDuration.style.width = '70px';

      var fieldHoverSpriteAsset = addField('hoverSpriteAsset', {
          name: 'Hover Sprite',
          type: 'asset',
          kind: 'sprite'
      });

      var fieldHoverSpriteFrame = addField('hoverSpriteFrame', {
          name: 'Hover Frame',
          type: 'number',
          min: 0,
          precision: 0,
          step: 1
      });

      var fieldPressedSpriteAsset = addField('pressedSpriteAsset', {
          name: 'Pressed Sprite',
          type: 'asset',
          kind: 'sprite'
      });

      var fieldPressedSpriteFrame = addField('pressedSpriteFrame', {
          name: 'Pressed Frame',
          type: 'number',
          min: 0,
          precision: 0,
          step: 1
      });

      var fieldInactiveSpriteAsset = addField('inactiveSpriteAsset', {
          name: 'Inactive Sprite',
          type: 'asset',
          kind: 'sprite'
      });

      var fieldInactiveSpriteFrame = addField('inactiveSpriteFrame', {
          name: 'Inactive Frame',
          type: 'number',
          min: 0,
          precision: 0,
          step: 1
      });

      var toggleFields = function () {
          var isTintMode = (fieldTransitionMode.value === BUTTON_TRANSITION_MODE_TINT);
          var isSpriteChangeMode = (fieldTransitionMode.value === BUTTON_TRANSITION_MODE_SPRITE_CHANGE);

          fieldHoverTint.parent.hidden = !isTintMode;
          fieldPressedTint.parent.hidden = !isTintMode;
          fieldInactiveTint.parent.hidden = !isTintMode;
          fieldFadeDuration.parent.hidden = !isTintMode;

          fieldHoverSpriteAsset.parent.hidden = !isSpriteChangeMode;
          fieldHoverSpriteFrame.parent.hidden = !isSpriteChangeMode;
          fieldPressedSpriteAsset.parent.hidden = !isSpriteChangeMode;
          fieldPressedSpriteFrame.parent.hidden = !isSpriteChangeMode;
          fieldInactiveSpriteAsset.parent.hidden = !isSpriteChangeMode;
          fieldInactiveSpriteFrame.parent.hidden = !isSpriteChangeMode;
      };

      toggleFields();

      events.push(fieldTransitionMode.on('change', toggleFields));

      panel.on('destroy', function () {
          events.forEach(function (e) {
              e.unbind();
          });
          events.length = 0;
      });
  });
});


/* editor/attributes/components/attributes-components-scroll-view.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (!panelComponents)
          return;

      var events = [];
      var componentName = 'scrollview';

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Scroll View',
          name: componentName,
          entities: entities
      });

      function addField(propertyName, options) {
          var path = 'components.' + componentName + '.' + propertyName;
          var target = componentName + ':' + propertyName;

          if (!options.panel) {
              options.parent = panel;
          }
          options.parent = panel;
          options.path = path;
          options.link = entities;

          var field = editor.call('attributes:addField', options);
          var fieldParent = Array.isArray(field) ? field[0].parent : field.parent;

          editor.call('attributes:reference:attach', target, fieldParent.innerElement.firstChild.ui);

          return field;
      }

      var fieldScrollMode = addField('scrollMode', {
          name: 'Scroll Mode',
          type: 'number',
          enum: [
              {v: '', t: '...'},
              {v: SCROLL_MODE_CLAMP, t: 'Clamp'},
              {v: SCROLL_MODE_BOUNCE, t: 'Bounce'},
              {v: SCROLL_MODE_INFINITE, t: 'Infinite'}
          ]
      });

      var fieldBounceAmount = addField('bounceAmount', {
          name: 'Bounce',
          type: 'number',
          precision: 3,
          step: 0.01,
          min: 0,
          max: 10,
      });

      addField('friction', {
          name: 'Friction',
          type: 'number',
          precision: 3,
          step: 0.01,
          min: 0,
          max: 1
      });

      addField('viewportEntity', {
          name: 'Viewport',
          type: 'entity'
      });

      addField('contentEntity', {
          name: 'Content',
          type: 'entity'
      });

      var dividerHorizontal = document.createElement('div');
      dividerHorizontal.classList.add('fields-divider');
      panel.append(dividerHorizontal);

      var fieldHorizontal = addField('horizontal', {
          name: 'Horizontal',
          type: 'checkbox'
      });

      var fieldHorizontalScrollbarEntity = addField('horizontalScrollbarEntity', {
          name: 'Scrollbar',
          type: 'entity'
      });

      var fieldHorizontalScrollbarVisibility = addField('horizontalScrollbarVisibility', {
          name: 'Visibility',
          type: 'number',
          enum: [
              {v: '', t: '...'},
              {v: SCROLLBAR_VISIBILITY_SHOW_ALWAYS, t: 'Show Always'},
              {v: SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED, t: 'Show When Required'}
          ]
      });

      var dividerVertical = document.createElement('div');
      dividerVertical.classList.add('fields-divider');
      panel.append(dividerVertical);

      var fieldVertical = addField('vertical', {
          name: 'Vertical',
          type: 'checkbox'
      });

      var fieldVerticalScrollbarEntity = addField('verticalScrollbarEntity', {
          name: 'Scrollbar',
          type: 'entity'
      });

      var fieldVerticalScrollbarVisibility = addField('verticalScrollbarVisibility', {
          name: 'Visibility',
          type: 'number',
          enum: [
              {v: '', t: '...'},
              {v: SCROLLBAR_VISIBILITY_SHOW_ALWAYS, t: 'Show Always'},
              {v: SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED, t: 'Show When Required'}
          ]
      });

      var toggleFields = function () {
          var isBounceMode = (fieldScrollMode.value === SCROLL_MODE_BOUNCE);
          var verticalScrollingEnabled = (fieldVertical.value === true);
          var horizontalScrollingEnabled = (fieldHorizontal.value === true);

          fieldBounceAmount.parent.hidden = !isBounceMode;

          fieldVerticalScrollbarEntity.parent.hidden = !verticalScrollingEnabled;
          fieldVerticalScrollbarVisibility.parent.hidden = !verticalScrollingEnabled;

          fieldHorizontalScrollbarEntity.parent.hidden = !horizontalScrollingEnabled;
          fieldHorizontalScrollbarVisibility.parent.hidden = !horizontalScrollingEnabled;
      };

      toggleFields();

      events.push(fieldScrollMode.on('change', toggleFields));
      events.push(fieldVertical.on('change', toggleFields));
      events.push(fieldHorizontal.on('change', toggleFields));

      panel.on('destroy', function () {
          events.forEach(function (e) {
              e.unbind();
          });
          events.length = 0;
      });
  });
});


/* editor/attributes/components/attributes-components-scrollbar.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (!panelComponents)
          return;

      var events = [];
      var componentName = 'scrollbar';

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Scrollbar',
          name: componentName,
          entities: entities
      });

      function addField(propertyName, options) {
          var path = 'components.' + componentName + '.' + propertyName;
          var target = componentName + ':' + propertyName;

          if (!options.panel) {
              options.parent = panel;
          }
          options.parent = panel;
          options.path = path;
          options.link = entities;

          var field = editor.call('attributes:addField', options);
          var fieldParent = Array.isArray(field) ? field[0].parent : field.parent;

          editor.call('attributes:reference:attach', target, fieldParent.innerElement.firstChild.ui);

          return field;
      }

      addField('orientation', {
          name: 'Orientation',
          type: 'number',
          enum: [
              {v: '', t: '...'},
              {v: ORIENTATION_HORIZONTAL, t: 'Horizontal'},
              {v: ORIENTATION_VERTICAL, t: 'Vertical'}
          ]
      });

      addField('value', {
          name: 'Value',
          type: 'number',
          precision: 3,
          step: 0.01,
          min: 0,
          max: 1
      });

      addField('handleEntity', {
          name: 'Handle',
          type: 'entity'
      });

      addField('handleSize', {
          name: 'Handle Size',
          type: 'number',
          precision: 3,
          step: 0.01,
          min: 0,
          max: 1
      });

      panel.on('destroy', function () {
          events.forEach(function (e) {
              e.unbind();
          });
          events.length = 0;
      });
  });
});


/* editor/attributes/components/attributes-components-sprite.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (! panelComponents)
          return;

      var events = [ ];

      var projectSettings = editor.call('settings:project');

      // group clips by name
      var numEntities = entities.length;
      var groupedClips = {};
      for (var i = 0; i < numEntities; i++) {
          var clips = entities[i].get('components.sprite.clips');
          if (! clips) continue;

          for (var key in clips) {
              var clip = clips[key];
              if (! groupedClips[clip.name]) {
                  groupedClips[clip.name] = {};
              }

              groupedClips[clip.name][entities[i].get('resource_id')] = 'components.sprite.clips.' + key;
          }
      }

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Sprite',
          name: 'sprite',
          entities: entities
      });

      // sprite type
      var fieldType = editor.call('attributes:addField', {
          parent: panel,
          name: 'Type',
          type: 'string',
          enum: [
              {v: '', t: '...'},
              {v: 'simple', t: 'Simple'},
              {v: 'animated', t: 'Animated'}
          ],
          link: entities,
          path: 'components.sprite.type'
      });

      // reference
      editor.call('attributes:reference:attach', 'sprite:type', fieldType.parent.innerElement.firstChild.ui);

      // sprite asset
      var fieldSpriteAsset = editor.call('attributes:addField', {
          parent: panel,
          name: 'Sprite',
          type: 'asset',
          kind: 'sprite',
          link: entities,
          path: 'components.sprite.spriteAsset'
      });

      // reference
      editor.call('attributes:reference:attach', 'sprite:spriteAsset', fieldSpriteAsset._label);

      // sprite frame
      var fieldFrame = editor.call('attributes:addField', {
          parent: panel,
          name: 'Frame',
          type: 'number',
          link: entities,
          min: 0,
          path: 'components.sprite.frame'
      });

      // reference
      editor.call('attributes:reference:attach', 'sprite:frame', fieldFrame.parent.innerElement.firstChild.ui);

      // width
      var fieldWidth = editor.call('attributes:addField', {
          parent: panel,
          name: 'Size',
          type: 'number',
          placeholder: 'Width',
          link: entities,
          path: 'components.sprite.width'
      });

      fieldWidth.style.width = '32px';

      // reference
      editor.call('attributes:reference:attach', 'sprite:size', fieldWidth.parent.innerElement.firstChild.ui);

      // height
      var fieldHeight = editor.call('attributes:addField', {
          panel: fieldWidth.parent,
          type: 'number',
          placeholder: 'Height',
          link: entities,
          path: 'components.sprite.height'
      });

      fieldHeight.style.width = '32px';

      // sprite color
      var fieldColor = editor.call('attributes:addField', {
          parent: panel,
          name: 'Color',
          type: 'rgb',
          channels: 3,
          link: entities,
          path: 'components.sprite.color'
      });

      // reference
      editor.call('attributes:reference:attach', 'sprite:color', fieldColor.parent.innerElement.firstChild.ui);

      // sprite opacity
      var fieldOpacity = editor.call('attributes:addField', {
          parent: panel,
          name: 'Opacity',
          type: 'number',
          min: 0,
          max: 1,
          link: entities,
          path: 'components.sprite.opacity'
      });

      fieldOpacity.style.width = '32px';

      // reference
      editor.call('attributes:reference:attach', 'sprite:opacity', fieldOpacity.parent.innerElement.firstChild.ui);

      var fieldOpacitySlider = editor.call('attributes:addField', {
          panel: fieldOpacity.parent,
          precision: 3,
          step: 1,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: entities,
          path: 'components.sprite.opacity'
      });
      fieldOpacitySlider.flexGrow = 4;

      // flip x / y
      var panelFlip = editor.call('attributes:addField', {
          parent: panel,
          name: 'Flip'
      });
      var label = panelFlip;
      panelFlip = panelFlip.parent;
      label.destroy();

      var fieldFlipX = editor.call('attributes:addField', {
          panel: panelFlip,
          type: 'checkbox',
          link: entities,
          paths: 'components.sprite.flipX'
      });
      label = new ui.Label({ text: 'X' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      panelFlip.append(label);

      // reference
      editor.call('attributes:reference:attach', 'sprite:flipX', label);

      var fieldFlipY = editor.call('attributes:addField', {
          panel: panelFlip,
          type: 'checkbox',
          link: entities,
          paths: 'components.sprite.flipY'
      });
      label = new ui.Label({ text: 'Y' });
      label.class.add('label-infield');
      label.style.paddingRight = '12px';
      panelFlip.append(label);

      // reference
      editor.call('attributes:reference:attach', 'sprite:flipX', label);

      // speed
      var fieldSpeed = editor.call('attributes:addField', {
          parent: panel,
          name: 'Speed',
          type: 'number',
          link: entities,
          paths: 'components.sprite.speed'
      });

      // reference
      editor.call('attributes:reference:attach', 'sprite:speed', fieldSpeed.parent.innerElement.firstChild.ui);

      panel.on('destroy', function () {
          events.forEach(function (e) {
              e.unbind();
          });
          events.length = 0;
      });

      // auto play
      var enumAutoPlay = [{
          v: 'null',
          t: 'None'
      }];

      for (var name in groupedClips) {
          if (Object.keys(groupedClips[name]).length !== numEntities) continue;

          enumAutoPlay.push({
              v: name,
              t: name
          });
      }


      // batch group
      var batchGroups = editor.call('settings:project').get('batchGroups');
      var batchEnum = {
          '': '...',
          'NaN': 'None'
      };
      for (var key in batchGroups) {
          batchEnum[key] = batchGroups[key].name;
      }

      var fieldBatchGroup = editor.call('attributes:addField', {
          parent: panel,
          name: 'Batch Group',
          type: 'number',
          enum: batchEnum,
          link: entities,
          path: 'components.sprite.batchGroupId'
      });

      var btnAddGroup = document.createElement('li');
      btnAddGroup.classList.add('add-batch-group');
      btnAddGroup.innerHTML = 'Add Group';
      fieldBatchGroup.elementOptions.appendChild(btnAddGroup);

      // Create new batch group, assign it to the selected entities and focus on it in the settings panel
      btnAddGroup.addEventListener('click', function () {
          var group = editor.call('editorSettings:batchGroups:create');
          batchEnum[group] = editor.call('settings:project').get('batchGroups.' + group + '.name');
          fieldBatchGroup._updateOptions(batchEnum);
          fieldBatchGroup.value = group;
          editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
          setTimeout(function () {
              editor.call('editorSettings:batchGroups:focus', group);
          });
      });

      // reference
      editor.call('attributes:reference:attach', 'sprite:batchGroupId', fieldBatchGroup.parent.innerElement.firstChild.ui);

      // layers
      var layers = projectSettings.get('layers');
      var layersEnum = {
          '': ''
      };
      for (var key in layers) {
          layersEnum[key] = layers[key].name;
      }
      delete layersEnum[LAYERID_DEPTH];
      delete layersEnum[LAYERID_SKYBOX];
      delete layersEnum[LAYERID_IMMEDIATE];


      var fieldLayers = editor.call('attributes:addField', {
          parent: panel,
          name: 'Layers',
          type: 'tags',
          tagType: 'number',
          enum: layersEnum,
          placeholder: 'Add Layer',
          link: entities,
          path: 'components.sprite.layers',
          tagToString: function (tag) {
              return projectSettings.get('layers.' + tag + '.name') || 'Missing';
          },
          onClickTag: function () {
              // focus layer
              var layerId = this.originalValue;
              editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
              setTimeout(function () {
                  editor.call('editorSettings:layers:focus', layerId);
              });
          }
      });

      // reference
      editor.call('attributes:reference:attach', 'sprite:layers', fieldLayers.parent.parent.innerElement.firstChild.ui);

      // draw order
      var fieldDrawOrder = editor.call('attributes:addField', {
          parent: panel,
          name: 'Draw Order',
          type: 'number',
          link: entities,
          path: 'components.sprite.drawOrder'
      });

      // reference
      editor.call('attributes:reference:attach', 'sprite:drawOrder', fieldDrawOrder.parent.innerElement.firstChild.ui);


      var fieldAutoPlay = editor.call('attributes:addField', {
          parent: panel,
          name: 'Auto Play',
          type: 'string',
          link: entities,
          path: 'components.sprite.autoPlayClip',
          enum: enumAutoPlay
      });

      // reference
      editor.call('attributes:reference:attach', 'sprite:autoPlayClip', fieldAutoPlay.parent.innerElement.firstChild.ui);

      // clips
      var panelClips = new ui.Panel();
      panelClips.class.add('clips');
      panel.append(panelClips);

      var indexPanels = {};

      var createClipPanel = function (clipName) {
          // gather edited paths
          var paths = [];
          for (var i = 0; i < numEntities; i++) {
              paths.push(groupedClips[clipName][entities[i].get('resource_id')]);
          }

          var panelClip = new ui.Panel(clipName);
          panelClip.class.add('clip');
          panelClip.foldable = true;
          panelClip.folded = false;
          panelClips.append(panelClip);

          indexPanels[clipName] = panelClip;

          // reference
          editor.call('attributes:reference:attach', 'spriteAnimation:clip', panelClip, panelClip.headerElementTitle);

          var clipEvents = [];
          panelClip.on('destroy', function () {
              for (var i = 0; i < clipEvents.length; i++) {
                  clipEvents[i].unbind();
              }
              clipEvents = null;
          });

          // remove clip button
          var btnRemove = new ui.Button();
          btnRemove.class.add('remove');
          panelClip.headerElement.appendChild(btnRemove.element);

          btnRemove.on('click', function () {
              var records = [];
              for (var i = 0; i<numEntities; i++) {
                  records.push({
                      clip: entities[i].get(paths[i]),
                      autoPlayClip: entities[i].get('components.sprite.autoPlayClip')
                  });
              }

              var redo = function () {
                  for (var i = 0; i<numEntities; i++) {
                      var entity = editor.call('entities:get', entities[i].get('resource_id'));
                      if (! entity) continue;

                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      entity.unset(paths[i]);

                      // if this is the clip to be autoPlayed then unset it
                      if (records[i].clip.name === records[i].autoPlayClip) {
                          entity.set('components.sprite.autoPlayClip', null);
                      }
                      entity.history.enabled = history;
                  }
              };

              var undo = function () {
                  for (var i = 0; i<numEntities; i++) {
                      var entity = editor.call('entities:get', entities[i].get('resource_id'));
                      if (! entity) continue;

                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      entity.set(paths[i], records[i].clip);
                      entity.set('components.sprite.autoPlayClip', records[i].autoPlayClip);
                      entity.history.enabled = history;
                  }
              };

              editor.call('history:add', {
                  name: 'delete entities.components.sprite.clips',
                  undo: undo,
                  redo: redo
              });

              redo();
          });

          // clip name
          var fieldClipName = editor.call('attributes:addField', {
              parent: panelClip,
              name: 'Name',
              type: 'string'
          });

          fieldClipName.value = clipName;

          var suspendName = false;
          fieldClipName.on('change', function (value) {
              if (suspendName) return;

              // check if name is valid
              var valid = true;

              if (! value) {
                  valid = false;
              } else if (groupedClips[value]) {
                  valid = false;
              } else if (value === 'null') {
                  valid = false;
              }

              if (! valid) {
                  fieldClipName.class.add('error');
                  return;
              }

              fieldClipName.class.remove('error');

              var previousName = clipName;
              var newName = value;

              // remember the previous autoPlayClip value
              // for each entity
              var records = [];
              for (var i = 0; i<numEntities; i++) {
                  records.push(entities[i].get('components.sprite.autoPlayClip'));
              }

              var redo = function () {
                  clipName = newName;

                  for (var i = 0; i<numEntities; i++) {
                      var entity = editor.call('entities:get', entities[i].get('resource_id'));
                      if (! entity) continue;
                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      entity.set(paths[i] + '.name', value);

                      // if autoPlayClip was refering to this clip
                      // then update it
                      if (records[i] === previousName) {
                          entity.set('components.sprite.autoPlayClip', value);
                      }
                      entity.history.enabled = history;
                  }
              };

              var undo = function () {
                  clipName = previousName;

                  for (var i = 0; i<numEntities; i++) {
                      var entity = editor.call('entities:get', entities[i].get('resource_id'));
                      if (! entity) continue;
                      var history = entity.history.enabled;
                      entity.history.enabled = false;
                      entity.set(paths[i] + '.name', previousName);
                      entity.set('components.sprite.autoPlayClip', records[i]);
                      entity.history.enabled = history;
                  }
              };

              editor.call('history:add', {
                  name: 'entities.components.sprite.clips',
                  undo: undo,
                  redo: redo
              });

              redo();
          });

          // listen to name change from entities
          var createNameChangeListener = function (i) {
              clipEvents.push(entities[i].on(paths[i] + '.name:set', function (value, oldValue) {
                  suspendName = true;
                  fieldClipName.value = value;
                  suspendName = false;

                  panelClip.header = value;

                  // update autoPlayClip enum options
                  for (var i = 0; i < enumAutoPlay.length; i++) {
                      if (enumAutoPlay[i].v === oldValue) {
                          enumAutoPlay[i].v = value;
                          enumAutoPlay[i].t = value;
                          break;
                      }
                  }
                  fieldAutoPlay._updateOptions(enumAutoPlay);

                  // update groupedClips
                  if (groupedClips[oldValue]) {
                      groupedClips[value] = groupedClips[oldValue];
                      delete groupedClips[oldValue];
                  }

                  // update indexPanels
                  if (indexPanels[oldValue]) {
                      indexPanels[value] = indexPanels[oldValue];
                      delete indexPanels[oldValue];
                  }
              }));
          };

          for (var i = 0; i<numEntities; i++)
              createNameChangeListener(i);

          // reference
          editor.call('attributes:reference:attach', 'spriteAnimation:name', fieldClipName.parent.innerElement.firstChild.ui);


          // playback
          var panelPlayback = editor.call('attributes:addField', {
              parent: panelClip,
              name: 'Playback'
          });
          var label = panelPlayback;
          panelPlayback = panelPlayback.parent;
          label.destroy();

          // clip loop
          var fieldClipLoop = editor.call('attributes:addField', {
              panel: panelPlayback,
              type: 'checkbox',
              link: entities,
              paths: paths.map(function (p) {return p + '.loop';})
          });
          label = new ui.Label({ text: 'Loop' });
          label.class.add('label-infield');
          label.style.paddingRight = '12px';
          panelPlayback.append(label);

          // reference
          editor.call('attributes:reference:attach', 'spriteAnimation:loop', label);

          // clip fps
          var fieldClipFps = editor.call('attributes:addField', {
              panel: panelPlayback,
              type: 'number',
              step: 1,
              link: entities,
              placeholder: 'FPS',
              paths: paths.map(function (p) {return p + '.fps';})
          });

          // reference
          editor.call('attributes:reference:attach', 'spriteAnimation:fps', fieldClipFps);

          // clip sprite asset
          var fieldClipSpriteAsset = editor.call('attributes:addField', {
              parent: panelClip,
              name: 'Sprite',
              type: 'asset',
              kind: 'sprite',
              link: entities,
              path: paths.map(function (p) {return p + '.spriteAsset';})
          });

          editor.call('attributes:reference:attach', 'spriteAnimation:spriteAsset', fieldClipSpriteAsset._label);
      };

      // show all clips that are common between all selected entities
      for (var name in groupedClips) {
          if (Object.keys(groupedClips[name]).length !== numEntities) continue;

          createClipPanel(name);
      }


      // add clip button
      var btnAddClip = new ui.Button({
          text: 'Add Clip'
      });
      btnAddClip.class.add('add-clip');
      panel.append(btnAddClip);

      // reference
      editor.call('attributes:reference:attach', 'sprite:addClip', btnAddClip);

      btnAddClip.on('click', function () {
          // search clips of all entities for the largest key
          var largestKey = 1;
          for (var i = 0; i < numEntities; i++) {
              var clips = entities[i].get('components.sprite.clips');
              if (! clips) continue;

              for (var key in clips) {
                  largestKey = Math.max(largestKey, parseInt(key) + 1);
              }
          }

          var suffix = largestKey;
          var desiredName = 'Clip ' + suffix;
          while (groupedClips[desiredName]) {
              suffix++;
              desiredName = 'Clip ' + suffix;
          }

          var redo = function () {
              for (var i = 0; i < numEntities; i++) {
                  var entity = editor.call('entities:get', entities[i].get('resource_id'));
                  if (! entity) continue;
                  var history = entity.history.enabled;
                  entity.history.enabled = false;
                  var clips = entity.get('components.sprite.clips') || {};
                  var slot = 0;
                  for (var key in clips) {
                      slot = Math.max(slot, parseInt(key, 10) + 1);
                  }

                  entity.set('components.sprite.clips.' + slot, {
                      name: desiredName,
                      fps: 30,
                      loop: true,
                      spriteAsset: null
                  });
                  entity.history.enabled = history;
              }
          };

          var undo = function () {
              for (var i = 0; i < numEntities; i++) {
                  var entity = editor.call('entities:get', entities[i].get('resource_id'));
                  if (! entity) continue;
                  var history = entity.history.enabled;
                  entity.history.enabled = false;
                  // find slot by clip name
                  var clips = entity.get('components.sprite.clips');
                  if (! clips) continue;
                  var slot = null;
                  for (var key in clips) {
                      if (clips[key].name === desiredName) {
                          slot = key;
                          break;
                      }
                  }

                  if (slot === null) continue;

                  entity.unset('components.sprite.clips.' + slot);
                  entity.history.enabled = history;
              }
          };

          editor.call('history:add', {
              name: 'entities..components.sprite.clips',
              undo: undo,
              redo: redo
          });

          redo();
      });

      // add listener to add new panel for newly added clips
      var createSetHandler = function (i) {
          var resourceId = entities[i].get('resource_id');
          events.push(entities[i].on('*:set', function (path, value) {
              if (! /^components\.sprite\.clips\.\d+$/.test(path)) return;

              // add new clip to groupedClips
              if (! groupedClips[value.name]) {
                  groupedClips[value.name] = {};
              }

              groupedClips[value.name][resourceId] = path;

              // update autoPlayClip options if needed
              if (Object.keys(groupedClips[value.name]).length === numEntities) {
                  createClipPanel(value.name);

                  // update auto play options
                  enumAutoPlay.push({
                      v: value.name,
                      t: value.name
                  });
                  fieldAutoPlay._updateOptions(enumAutoPlay);
              }
          }));
      };

      // add listener to remove panels for removed clips
      var createUnsetHandler = function (i) {
          var resourceId = entities[i].get('resource_id');
          events.push(entities[i].on('*:unset', function (path, value) {
              if (! /^components\.sprite\.clips\.\d+$/.test(path)) return;

              var entry = groupedClips[value.name];
              if (entry) {
                  delete entry[resourceId];

                  if (! Object.keys(entry).length)
                      delete groupedClips[value.name];
              }

              // destroy panel
              var panelClip = indexPanels[value.name];
              if (panelClip) {
                  panelClip.destroy();
                  panelClip = null;
                  delete indexPanels[value.name];
              }

              // update autoPlayClip enum options
              for (var j = 0; j < enumAutoPlay.length; j++) {
                  if (enumAutoPlay[j].v === value.name) {
                      enumAutoPlay.splice(j, 1);
                      break;
                  }
              }
              fieldAutoPlay._updateOptions(enumAutoPlay);
          }));
      };

      for (var i = 0; i < numEntities; i++) {
          createSetHandler(i);
          createUnsetHandler(i);
      }

      // show / hide animated sprite fields
      var toggleFields = function () {
          var hideAnimated = false;

          for (var i = 0; i < numEntities; i++) {
              if (entities[i].get('components.sprite.type') !== 'animated') {
                  hideAnimated = true;
                  break;
              }
          }

          panelClips.hidden = hideAnimated;
          btnAddClip.hidden = hideAnimated;
          fieldAutoPlay.parent.hidden = hideAnimated;
          fieldFrame.parent.hidden = !hideAnimated;
          fieldSpriteAsset.parent.hidden = !hideAnimated;
          fieldSpeed.parent.hidden = hideAnimated;
          fieldBatchGroup.parent.hidden = !hideAnimated;

          fieldWidth.parent.hidden = hideSpriteSize();

          // disable batch groups until they're working properly
          fieldBatchGroup.parent.hidden = !editor.call('users:hasFlag', 'has2DBatchGroups');
      };

      var hideSpriteSize = function () {
          if (fieldType.value !== 'simple')
              return true;

          if (! fieldSpriteAsset.value)
              return true;

          var asset = editor.call('assets:get', fieldSpriteAsset.value);
          if (! asset) {
              return true;
          }

          if (! asset.get('data.renderMode')) {
              return true;
          }

          return false;
      };

      fieldType.on('change', toggleFields);

      fieldSpriteAsset.on('change', function () {
          fieldWidth.parent.hidden = hideSpriteSize();
      });

      toggleFields();

      // destroy panel
      panel.on('destroy', function () {
          for (var i = 0; i < events.length; i++) {
              events[i].unbind();
          }
          events.length = 0;
      });

  });
});


/* editor/attributes/components/attributes-components-layoutgroup.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (!panelComponents)
          return;

      var events = [];
      var componentName = 'layoutgroup';

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Layout Group',
          name: componentName,
          entities: entities
      });

      function addField(propertyName, options) {
          var path = 'components.' + componentName + '.' + propertyName;
          var target = componentName + ':' + propertyName;

          if (!options.panel) {
              options.parent = panel;
          }
          options.path = path;
          options.link = entities;

          var field = editor.call('attributes:addField', options);
          var fieldParent = Array.isArray(field) ? field[0].parent : field.parent;

          editor.call('attributes:reference:attach', target, fieldParent.innerElement.firstChild.ui);

          return field;
      }

      addField('orientation', {
          name: 'Orientation',
          type: 'number',
          enum: [
              {v: '', t: '...'},
              {v: ORIENTATION_HORIZONTAL, t: 'Horizontal'},
              {v: ORIENTATION_VERTICAL, t: 'Vertical'}
          ]
      });

      addField('reverseX', {
          name: 'Reverse X',
          type: 'checkbox'
      });

      addField('reverseY', {
          name: 'Reverse Y',
          type: 'checkbox'
      });

      addField('alignment', {
          name: 'Alignment',
          type: 'vec2',
          placeholder: ['↔', '↕'],
          precision: 2,
          step: 0.1,
          min: 0,
          max: 1
      });

      addField('padding', {
          name: 'Padding',
          type: 'vec4',
          placeholder: ['←', '↓', '→', '↑']
      });

      addField('spacing', {
          name: 'Spacing',
          type: 'vec2',
          placeholder: ['↔', '↕'],
      });

      addField('widthFitting', {
          name: 'Width Fitting',
          type: 'number',
          enum: [
              {v: '', t: '...'},
              {v: FITTING_NONE, t: 'None'},
              {v: FITTING_STRETCH, t: 'Stretch'},
              {v: FITTING_SHRINK, t: 'Shrink'},
              {v: FITTING_BOTH, t: 'Both'}
          ]
      });

      addField('heightFitting', {
          name: 'Height Fitting',
          type: 'number',
          enum: [
              {v: '', t: '...'},
              {v: FITTING_NONE, t: 'None'},
              {v: FITTING_STRETCH, t: 'Stretch'},
              {v: FITTING_SHRINK, t: 'Shrink'},
              {v: FITTING_BOTH, t: 'Both'}
          ]
      });

      addField('wrap', {
          name: 'Wrap',
          type: 'checkbox'
      });

      panel.on('destroy', function () {
          events.forEach(function (e) {
              e.unbind();
          });
          events.length = 0;
      });
  });
});


/* editor/attributes/components/attributes-components-layoutchild.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[entity]', function(entities) {
      var panelComponents = editor.call('attributes:entity.panelComponents');
      if (!panelComponents)
          return;

      var events = [];
      var componentName = 'layoutchild';

      var panel = editor.call('attributes:entity:addComponentPanel', {
          title: 'Layout Child',
          name: componentName,
          entities: entities
      });

      function addField(propertyName, options) {
          var path = 'components.' + componentName + '.' + propertyName;
          var target = componentName + ':' + propertyName;

          if (!options.panel) {
              options.parent = panel;
          }
          options.parent = panel;
          options.path = path;
          options.link = entities;

          var field = editor.call('attributes:addField', options);
          var fieldParent = Array.isArray(field) ? field[0].parent : field.parent;

          editor.call('attributes:reference:attach', target, fieldParent.innerElement.firstChild.ui);

          return field;
      }

      var fieldMinWidth = addField('minWidth', {
          name: 'Min Size',
          type: 'number',
          placeholder: 'Min Width'
      });

      fieldMinWidth.style.width = '32px';

      var fieldMinHeight = addField('minHeight', {
          panel: fieldMinWidth.parent,
          type: 'number',
          placeholder: 'Min Height'
      });

      fieldMinHeight.style.width = '32px';

      var fieldMaxWidth = addField('maxWidth', {
          name: 'Max Size',
          type: 'number',
          placeholder: 'Max Width',
          allowNull: true
      });

      fieldMaxWidth.style.width = '32px';

      var fieldMaxHeight = addField('maxHeight', {
          panel: fieldMaxWidth.parent,
          type: 'number',
          placeholder: 'Max Height',
          allowNull: true
      });

      fieldMaxHeight.style.width = '32px';

      var fieldFitWidthProportion = addField('fitWidthProportion', {
          name: 'Fit Proportion',
          type: 'number',
          placeholder: 'Width'
      });

      fieldFitWidthProportion.style.width = '32px';

      var fieldFitHeightProportion = addField('fitHeightProportion', {
          panel: fieldFitWidthProportion.parent,
          type: 'number',
          placeholder: 'Height'
      });

      fieldFitHeightProportion.style.width = '32px';

      addField('excludeFromLayout', {
          name: 'Exclude from Layout',
          type: 'checkbox'
      });

      panel.on('destroy', function () {
          events.forEach(function (e) {
              e.unbind();
          });
          events.length = 0;
      });
  });
});


/* editor/attributes/attributes-asset.js */
editor.once('load', function() {
  'use strict';

  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');

  var sourceRuntimeOptions = {
      '-1': 'various',
      '0': 'yes',
      '1': 'no'
  };

  var editableTypes = {
      'script': 1,
      'css': 1,
      'html': 1,
      'shader': 1,
      'text': 1,
      'json': 1
  };

  var assetsPanel = null;

  editor.on('attributes:inspect[asset]', function(assets) {
      var events = [ ];

      // unfold panel
      var panel = editor.call('attributes.rootPanel');
      if (panel.collapsed)
          panel.collapsed = false;

      var multi = assets.length > 1;
      var type = ((assets[0].get('source') && assets[0].get('type') !== 'folder') ? 'source ' : '') + assets[0].get('type');

      if (multi) {
          editor.call('attributes:header', assets.length + ' assets');

          for(var i = 0; i < assets.length; i++) {
              if (type !== ((assets[0].get('source') && assets[0].get('type') !== 'folder') ? 'source ' : '') + assets[i].get('type')) {
                  type = null;
                  break;
              }
          }
      } else {
          editor.call('attributes:header', type);
      }

      // panel
      var panel = editor.call('attributes:addPanel');
      panel.class.add('component');
      assetsPanel = panel;
      panel.once('destroy', function () {
          assetsPanel = null;

          for(var i = 0; i < events.length; i++)
              events[i].unbind();

          events = null;
      });

      var allBundles = editor.call('assets:bundles:list');
      var bundlesEnum = { "": "" };
      for (var i = 0; i < allBundles.length; i++) {
          bundlesEnum[allBundles[i].get('id')] = allBundles[i].get('name');
      }

      var fieldBundlesArgs = {
          parent: panel,
          name: 'Bundles',
          type: 'tags',
          tagType: 'number',
          enum: bundlesEnum,
          placeholder: 'Select Bundle',
          path: 'bundles',
          stopHistory: true, // do not trigger history events for these 'proxy' observers
          tagToString: function (tag) {
              var asset = editor.call('assets:get', tag);
              return asset ? asset.get('name') : 'Missing';
          },
          onClickTag: function () {
              var id = this.originalValue;
              var asset = editor.call('assets:get', id);
              if (asset) {
                  editor.call('selector:set', 'asset', [asset]);
              }
          }
      };

      var refreshBundleObservers = function () {
          // unlinkField is added by attributes-panel.js
          // call it in order to unlink the field from its previous observers
          if (fieldBundlesArgs.unlinkField) {
              fieldBundlesArgs.unlinkField();
          }

          // destroy the old observers
          if (fieldBundlesArgs.link) {
              for (var i = 0; i < fieldBundlesArgs.link.length; i++) {
                  fieldBundlesArgs.link[i].destroy();
              }
          }

          // set the link of the field to be a list of observers with a 'bundles'
          // field. The bundles field holds all of the bundle asset ids that each
          // asset belongs to. This will allow us to use the same 'tags' type field.
          fieldBundlesArgs.link = assets.map(function (asset) {
              var bundleAssets = editor.call('assets:bundles:listForAsset', asset);
              var observer = new Observer({
                  bundles: bundleAssets.map(function (bundle) {
                      return bundle.get('id');
                  })
              });

              observer.on('bundles:insert', function (bundleId) {
                  var bundleAsset = editor.call('assets:get', bundleId);
                  if (bundleAsset) {
                      editor.call('assets:bundles:addAssets', assets, bundleAsset);
                  }
              });

              observer.on('bundles:remove', function (bundleId) {
                  var bundleAsset = editor.call('assets:get', bundleId);
                  if (bundleAsset) {
                      editor.call('assets:bundles:removeAssets', assets, bundleAsset);
                  }
              });

              return observer;
          });

          // link the field to the new observers
          // The linkField method is added by attributes-panel.js
          if (fieldBundlesArgs.linkField) {
              fieldBundlesArgs.linkField();
          }
      };

      refreshBundleObservers();

      events.push(editor.on('assets:bundles:insert', refreshBundleObservers));
      events.push(editor.on('assets:bundles:remove', refreshBundleObservers));

      if (multi) {
          var fieldFilename = editor.call('attributes:addField', {
              parent: panel,
              name: 'Assets',
              value: assets.length
          });

          var canShowBundles = editor.call('users:hasFlag', 'hasBundles');
          var scriptSelected = false;
          for(var i = 0; i < assets.length; i++) {
              if (legacyScripts) {
                  // scripts are not real assets, and have no preload option
                  if (! scriptSelected && assets[i].get('type') === 'script')
                      scriptSelected = true;
              }

              if (canShowBundles && !editor.call('assets:bundles:canAssetBeAddedToBundle', assets[i])) {
                  canShowBundles = false;
              }
          }


          var source = (assets[0].get('type') === 'folder') ? 1 : assets[0].get('source') + 0;

          for(var i = 1; i < assets.length; i++) {
              if ((assets[i].get('type') === 'folder' ? 1 : assets[i].get('source') + 0) !== source) {
                  source = -1;
                  break;
              }
          }

          if (! scriptSelected && source === 0) {
              // tags
              var fieldTags = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Tags',
                  placeholder: 'Add Tag',
                  type: 'tags',
                  tagType: 'string',
                  link: assets,
                  path: 'tags'
              });
              // reference
              editor.call('attributes:reference:attach', 'asset:tags', fieldTags.parent.parent.innerElement.firstChild.ui);
          }

          if (! scriptSelected) {
              // runtime
              var fieldRuntime = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Runtime',
                  value: sourceRuntimeOptions[source]
              });
              // reference
              editor.call('attributes:reference:attach', 'asset:runtime', fieldRuntime.parent.innerElement.firstChild.ui);
          }

          // type
          var fieldType = editor.call('attributes:addField', {
              parent: panel,
              name: 'Type',
              value: type ? type : 'various'
          });
          // reference
          editor.call('attributes:reference:attach', 'asset:type', fieldType.parent.innerElement.firstChild.ui);
          if (type)
              editor.call('attributes:reference:asset:' + type + ':asset:attach', fieldType);

          // preload
          if (! scriptSelected && source === 0) {
              var fieldPreload = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Preload',
                  type: 'checkbox',
                  link: assets,
                  path: 'preload'
              });
              fieldPreload.parent.class.add('preload');
              editor.call('attributes:reference:attach', 'asset:preload', fieldPreload.parent.innerElement.firstChild.ui);
          }

          if (! scriptSelected) {
              // size
              var sizeCalculate = function() {
                  var size = 0;

                  for(var i = 0; i < assets.length; i++) {
                      if (assets[i].get('type') === 'bundle') {
                          size += editor.call('assets:bundles:calculateSize', assets[i]);
                      } else {
                          size += assets[i].get('file.size') || 0;
                      }
                  }

                  fieldSize.value = bytesToHuman(size);
              };
              var fieldSize = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Size'
              });
              sizeCalculate();

              var evtSize = [ ];
              for(var i = 0; i < assets.length; i++) {
                  evtSize.push(assets[i].on('file:set', sizeCalculate));
                  evtSize.push(assets[i].on('file:unset', sizeCalculate));
                  evtSize.push(assets[i].on('file.size:set', sizeCalculate));
                  evtSize.push(assets[i].on('file.size:unset', sizeCalculate));

                  if (assets[i].get('type') === 'bundle') {
                      evtSize.push(assets[i].on('data.assets:set', sizeCalculate));
                      evtSize.push(assets[i].on('data.assets:insert', sizeCalculate));
                      evtSize.push(assets[i].on('data.assets:remove', sizeCalculate));
                  }
              }

              panel.once('destroy', function () {
                  for(var i = 0; i < evtSize.length; i++) {
                      evtSize[i].unbind();
                  }
                  evtSize.length = 0;
              });

              // reference
              editor.call('attributes:reference:attach', 'asset:size', fieldSize.parent.innerElement.firstChild.ui);
          }


          if (! scriptSelected && source === 0) {
              // source
              var fieldSource = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Source',
                  value: 'none'
              });
              // reference
              editor.call('attributes:reference:attach', 'asset:source', fieldSource.parent.innerElement.firstChild.ui);

              var sourceId = assets[0].get('source_asset_id');
              for(var i = 1; i < assets.length; i++) {
                  if (sourceId !== assets[i].get('source_asset_id')) {
                      sourceId = 0;
                      fieldSource.value = 'various';
                      break;
                  }
              }
              fieldSource.on('click', function() {
                  if (! sourceId)
                      return;

                  var asset = editor.call('assets:get', sourceId);

                  if (! asset)
                      return;

                  editor.call('selector:set', 'asset', [ asset ]);
              });
              if (sourceId) {
                  var source = editor.call('assets:get', sourceId);
                  if (source) {
                      fieldSource.value = source.get('name');
                      fieldSource.class.add('export-model-archive');

                      var evtSourceName = source.on('name:set', function(value) {
                          fieldSource.value = value;
                      });
                      fieldSource.once('destroy', function() {
                          evtSourceName.unbind();
                      });
                  }
              }
          }

          // add bundles field
          if (canShowBundles) {
              var fieldBundles = editor.call('attributes:addField', fieldBundlesArgs);

              // reference
              editor.call('attributes:reference:attach', 'asset:bundles', fieldBundles.parent.parent.innerElement.firstChild.ui);
          }
      } else {
          if (legacyScripts && assets[0].get('type') === 'script') {
              // filename
              var fieldFilename = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Filename',
                  // type: 'string',
                  link: assets[0],
                  path: 'filename'
              });
              // reference
              editor.call('attributes:reference:attach', 'asset:script:filename', fieldFilename.parent.innerElement.firstChild.ui);

          } else {
              // id
              var fieldId = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'ID',
                  link: assets[0],
                  path: 'id'
              });
              // reference
              editor.call('attributes:reference:attach', 'asset:id', fieldId.parent.innerElement.firstChild.ui);

              // name
              var fieldName = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Name',
                  type: 'string',
                  value: assets[0].get('name')
              });
              events.push(assets[0].on('name:set', function (newName) {
                  fieldName.value = newName;
              }));
              events.push(fieldName.on('change', function (newName) {
                  if (newName !== assets[0].get('name')) {
                      editor.call('assets:rename', assets[0], newName);
                  }
              }));
              fieldName.class.add('asset-name');
              // reference
              editor.call('attributes:reference:attach', 'asset:name', fieldName.parent.innerElement.firstChild.ui);

              if (! assets[0].get('source') && assets[0].get('type') !== 'folder') {
                  // tags
                  var fieldTags = editor.call('attributes:addField', {
                      parent: panel,
                      name: 'Tags',
                      placeholder: 'Add Tag',
                      type: 'tags',
                      tagType: 'string',
                      link: assets[0],
                      path: 'tags'
                  });
                  // reference
                  editor.call('attributes:reference:attach', 'asset:tags', fieldTags.parent.parent.innerElement.firstChild.ui);
              }

              // runtime
              var runtime = sourceRuntimeOptions[assets[0].get('source') + 0];
              if (assets[0].get('type') === 'folder')
                  runtime = sourceRuntimeOptions[1];

              var fieldRuntime = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Runtime',
                  value: runtime
              });
              // reference
              editor.call('attributes:reference:attach', 'asset:runtime', fieldRuntime.parent.innerElement.firstChild.ui);


              // taskInfo
              var fieldFailed = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Failed',
                  link: assets[0],
                  path: 'taskInfo'
              });
              fieldFailed.class.add('error');

              var checkFailed = function() {
                  fieldFailed.parent.hidden = assets[0].get('task') !== 'failed' || ! assets[0].get('taskInfo');
              };
              checkFailed();

              events.push(assets[0].on('task:set', checkFailed));
              events.push(assets[0].on('taskInfo:set', checkFailed));
              events.push(assets[0].on('taskInfo:unset', checkFailed));
          }


          // type
          var fieldType = editor.call('attributes:addField', {
              parent: panel,
              name: 'Type',
              value: type
          });
          // reference
          editor.call('attributes:reference:attach', 'asset:type', fieldType.parent.innerElement.firstChild.ui);
          // reference type
          if (! assets[0].get('source'))
              editor.call('attributes:reference:asset:' + assets[0].get('type') + ':asset:attach', fieldType);


          if (! (legacyScripts && assets[0].get('type') === 'script') && assets[0].get('type') !== 'folder' && ! assets[0].get('source')) {
              // preload
              var fieldPreload = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Preload',
                  type: 'checkbox',
                  link: assets[0],
                  path: 'preload'
              });
              fieldPreload.parent.class.add('preload');
              editor.call('attributes:reference:attach', 'asset:preload', fieldPreload.parent.innerElement.firstChild.ui);
          }

          // size
          if (assets[0].has('file') || assets[0].get('type') === 'bundle') {
              var size = assets[0].get('type') === 'bundle' ? editor.call('assets:bundles:calculateSize', assets[0]) : assets[0].get('file.size');
              var fieldSize = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Size',
                  value: bytesToHuman(size)
              });

              var evtSize = [];
              evtSize.push(assets[0].on('file:set', function (value) {
                  fieldSize.text = bytesToHuman(value ? value.size : 0);
              }));

              evtSize.push(assets[0].on('file.size:set', function(value) {
                  fieldSize.text = bytesToHuman(value);
              }));

              if (assets[0].get('type') === 'bundle') {
                  var recalculateSize = function () {
                      fieldSize.text = bytesToHuman(editor.call('assets:bundles:calculateSize', assets[0]));
                  };

                  evtSize.push(assets[0].on('data.assets:set', recalculateSize));
                  evtSize.push(assets[0].on('data.assets:insert', recalculateSize));
                  evtSize.push(assets[0].on('data.assets:remove', recalculateSize));
              }

              panel.once('destroy', function () {
                  for (var i = 0; i < evtSize.length; i++) {
                      evtSize[i].unbind();
                  }
                  evtSize.length = 0;
              });

              // reference
              editor.call('attributes:reference:attach', 'asset:size', fieldSize.parent.innerElement.firstChild.ui);
          }

          if (! (legacyScripts && assets[0].get('type') === 'script') && ! assets[0].get('source')) {
              // source
              var fieldSource = editor.call('attributes:addField', {
                  parent: panel,
                  name: 'Source',
                  value: 'none'
              });
              // reference
              editor.call('attributes:reference:attach', 'asset:source', fieldSource.parent.innerElement.firstChild.ui);

              var sourceId = assets[0].get('source_asset_id');
              fieldSource.on('click', function() {
                  if (! sourceId)
                      return;

                  var asset = editor.call('assets:get', sourceId);

                  if (! asset)
                      return;

                  editor.call('selector:set', 'asset', [ asset ]);
              });
              if (sourceId) {
                  var source = editor.call('assets:get', sourceId);
                  if (source) {
                      fieldSource.value = source.get('name');
                      fieldSource.class.add('export-model-archive');

                      var evtSourceName = source.on('name:set', function(value) {
                          fieldSource.value = value;
                      });
                      fieldSource.once('destroy', function() {
                          evtSourceName.unbind();
                      });
                  }
              }
          }

          if (editor.call('users:hasFlag', 'hasBundles') && editor.call('assets:bundles:canAssetBeAddedToBundle', assets[0])) {
              var fieldBundles = editor.call('attributes:addField', fieldBundlesArgs);

              // reference
              editor.call('attributes:reference:attach', 'asset:bundles', fieldBundles.parent.parent.innerElement.firstChild.ui);
          }

          var panelButtons = new ui.Panel();
          panelButtons.class.add('buttons');
          panel.append(panelButtons);

          // download
          if (assets[0].get('type') !== 'folder' && ! (legacyScripts && assets[0].get('type') === 'script') && assets[0].get('type') !== 'sprite') {
              // download
              var btnDownload = new ui.Button();

              btnDownload.hidden = ! editor.call('permissions:read');
              var evtBtnDownloadPermissions = editor.on('permissions:set:' + config.self.id, function() {
                  btnDownload.hidden = ! editor.call('permissions:read');
              });

              btnDownload.text = 'Download';
              btnDownload.class.add('download-asset', 'large-with-icon');
              btnDownload.element.addEventListener('click', function(evt) {
                  if (btnDownload.prevent)
                      return;

                  if (assets[0].get('source') || assets[0].get('type') === 'texture' || assets[0].get('type') === 'audio') {
                      window.open(assets[0].get('file.url'));
                  } else {
                      window.open('/api/assets/' + assets[0].get('id') + '/download?branchId=' + config.self.branch.id);
                  }
              });
              panelButtons.append(btnDownload);

              btnDownload.once('destroy', function() {
                  evtBtnDownloadPermissions.unbind();
              });
          }

          // script editor
          if (assets[0].get('type') === 'textureatlas' || assets[0].get('type') === 'sprite') {
              var btnSpriteEditor = new ui.Button();
              btnSpriteEditor.text = 'Sprite Editor';
              btnSpriteEditor.disabled = assets[0].get('type') === 'sprite' && (! assets[0].get('data.textureAtlasAsset') || ! editor.call('assets:get', assets[0].get('data.textureAtlasAsset')));
              btnSpriteEditor.class.add('sprite-editor', 'large-with-icon');
              btnSpriteEditor.on('click', function () {
                  editor.call('picker:sprites', assets[0]);
              });
              panelButtons.append(btnSpriteEditor);

              var evtSetAtlas = null;
              if (assets[0].get('type') === 'sprite') {
                  evtSetAtlas = assets[0].on('data.textureAtlasAsset:set', function (value) {
                      btnSpriteEditor.disabled = ! value || ! editor.call('assets:get', value);
                  });
              }

              panelButtons.once('destroy', function () {
                  if (evtSetAtlas) {
                      evtSetAtlas.unbind();
                      evtSetAtlas = null;
                  }
              });
          }

          if (editableTypes[assets[0].get('type')]) {
              // edit
              var btnEdit = new ui.Button();

              btnEdit.text = editor.call('permissions:write') ? 'Edit' : 'View';
              var evtPermissions = editor.on('permissions:writeState', function(state) {
                  btnEdit.text = state ? 'Edit' : 'View';
              });

              btnEdit.class.add('edit-script', 'large-with-icon');
              btnEdit.hidden = ! assets[0].has('file.url');
              btnEdit.element.addEventListener('click', function(evt) {
                  editor.call('assets:edit', assets[0]);
              }, false);
              panelButtons.append(btnEdit);

              var evtFileUrl = assets[0].on('file.url:set', function() {
                  btnEdit.hidden = false;
              });
              var evtFileUrlUnset = assets[0].on('file.url:unset', function() {
                  btnEdit.hidden = true;
              });

              btnEdit.once('destroy', function() {
                  evtPermissions.unbind();
                  evtFileUrl.unbind();
                  evtFileUrlUnset.unbind();
              });
          }
      }
  });

  editor.on('attributes:assets:toggleInfo', function (enabled) {
      if (assetsPanel) {
          assetsPanel.hidden = !enabled;
      }
  });

  editor.method('attributes:assets:panel', function() {
      return assetsPanel;
  });
});


/* editor/attributes/assets/attributes-asset-animation.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length !== 1 || assets[0].get('type') !== 'animation' || assets[0].get('source'))
          return;

      var asset = assets[0];

      // panel
      var panel = editor.call('attributes:addPanel', {
          name: 'Animation'
      });
      panel.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:animation:asset', panel, panel.headerElement);


      // duration
      var fieldDuration = editor.call('attributes:addField', {
          parent: panel,
          name: 'Duration',
          placeholder: 'Seconds',
          link: asset,
          path: 'meta.duration'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:animation:duration', fieldDuration.parent.innerElement.firstChild.ui);


      // name
      var fieldName = editor.call('attributes:addField', {
          parent: panel,
          name: 'Name',
          link: asset,
          path: 'meta.name'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:animation:name', fieldName.parent.innerElement.firstChild.ui);
  });
});


/* editor/attributes/assets/attributes-asset-audio.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length !== 1 || assets[0].get('type') !== 'audio' || assets[0].get('source'))
          return;

      var asset = assets[0];

      var panel = editor.call('attributes:addPanel', {
          name: 'Audio'
      });
      panel.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:audio:asset', panel, panel.headerElement);


      // duration
      var fieldDuration = editor.call('attributes:addField', {
          parent: panel,
          name: 'Duration',
          value: '...'
      });
      fieldDuration.renderChanges = false;
      // reference
      editor.call('attributes:reference:attach', 'asset:audio:duration', fieldDuration.parent.innerElement.firstChild.ui);


      var playing = null;
      var updateTimeline = function() {
          timeline.progress = audio.currentTime / audio.duration;
      };


      // audio
      var audio = new Audio();
      audio.src = config.url.home + asset.get('file.url');
      panel.append(audio);


      // play
      var btnPlay = new ui.Button({
          text: '&#57649;'
      });
      btnPlay.disabled = true;
      btnPlay.class.add('audio-play');
      btnPlay.on('click', function() {
          if (audio.paused) {
              audio.play();
          } else {
              audio.pause();
              audio.currentTime = 0;
          }
      });
      panel.append(btnPlay);


      // timeline
      var timeline = new ui.Progress();
      timeline.class.add('audio-timeline');
      timeline.progress = 1;
      timeline.speed = .9;
      panel.append(timeline);


      // duration information available
      audio.addEventListener('durationchange', function(evt) {
          fieldDuration.text = audio.duration.toFixed(2) + 's';
      }, false);

      // can be played
      audio.addEventListener('canplay', function(evt) {
          btnPlay.enabled = true;
          timeline.progress = 0;
      }, false);

      // on play
      audio.addEventListener('play', function() {
          btnPlay.class.add('active');
          btnPlay.text = '&#57649;';

          if (playing)
              return;

          playing = setInterval(updateTimeline, 1000 / 60);
      }, false);

      // on stop
      audio.addEventListener('pause', function() {
          timeline.progress = 0;
          btnPlay.class.remove('active');
          btnPlay.text = '&#57649;';

          clearInterval(playing);
          playing = null;
      }, false);


      panel.once('destroy', function() {
          clearInterval(playing);
      });
  });
});


/* editor/attributes/assets/attributes-asset-css.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length !== 1 || assets[0].get('type') !== 'css' || assets[0].get('source'))
          return;

      var asset = assets[0];

      // panel
      var panel = editor.call('attributes:assets:panel');

      var panelRaw = editor.call('attributes:addPanel', {
          name: 'CSS'
      });
      panelRaw.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:css:asset', panelRaw, panelRaw.headerElement);

      // loading
      var loading = editor.call('attributes:addField', {
          type: 'progress'
      });
      loading.progress = 1;

      // code
      var fieldCode = editor.call('attributes:addField', {
          parent: panelRaw,
          type: 'code'
      });
      fieldCode.style.margin = '-8px -6px';

      var fieldError = new ui.Label({
          text: 'failed loading data'
      });
      fieldError.class.add('asset-loading-error');
      fieldError.hidden = true;
      editor.call('attributes.rootPanel').append(fieldError);

      var loadContent = function() {
          if (asset.get('file.size') > 128 * 1024) {
              panelRaw.hidden = true;
              loading.hidden = true;
              return;
          } else {
              panelRaw.hidden = false;
              loading.hidden = false;
          }
          // load data
          Ajax({
              url: '{{url.home}}' + asset.get('file.url').appendQuery('t=' + asset.get('file.hash')),
              notJson: true
          })
          .on('load', function(status, data) {
              fieldCode.text = data;
              fieldCode.hidden = false;
              fieldError.hidden = true;
              loading.hidden = true;
          })
          .on('error', function() {
              loading.hidden = false;
              loading.failed = true;
              fieldCode.hidden = true;
              fieldError.hidden = false;
          });
      };
      if (asset.has('file.url'))
          loadContent();

      var evtReload = asset.on('file.hash:set', function() {
          loadContent();
      });
      panel.once('destroy', function() {
          evtReload.unbind();
      });
  });
});


/* editor/attributes/assets/attributes-asset-cubemap.js */
editor.once('load', function() {
  'use strict';


  editor.on('attributes:inspect[asset]', function(assets) {
      for(var i = 0; i < assets.length; i++) {
          if (assets[i].get('type') !== 'cubemap')
              return;
      }

      if (assets.length > 1)
          editor.call('attributes:header', assets.length + ' CubeMaps');

      var root = editor.call('attributes.rootPanel');

      if (assets.length === 1) {
          var previewContainer = new pcui.Container();
          previewContainer.class.add('asset-preview-container');

          var preview = document.createElement('canvas');
          var ctx = preview.getContext('2d');
          preview.width = 256;
          preview.height = 256;
          preview.classList.add('asset-preview', 'flipY');
          previewContainer.append(preview);

          var mipLevel = 0;

          var mipSelector = new ui.SelectField({
              type: 'number',
              options: [
                  { v: 0, t: '1' },
                  { v: 1, t: '2' },
                  { v: 2, t: '3' },
                  { v: 3, t: '4' },
                  { v: 4, t: '5' }
              ]
          });
          mipSelector.value = 0;
          mipSelector.class.add('cubeMapMipLevel');
          previewContainer.append(mipSelector);
          mipSelector.parent = panelParams;
          mipSelector.hidden = ! assets[0].get('file');

          mipSelector.on('change', function(value) {
              mipLevel = value;
              queueRender();
          });

          var sx = 0, sy = 0, x = 0, y = 0, nx = 0, ny = 0;
          var dragging = false;
          var previewRotation = [ 0, 0 ];

          preview.addEventListener('mousedown', function(evt) {
              if (evt.button !== 0)
                  return;

              evt.preventDefault();
              evt.stopPropagation();

              sx = x = evt.clientX;
              sy = y = evt.clientY;

              dragging = true;
          }, false);

          var onMouseMove = function(evt) {
              if (! dragging)
                  return;

              nx = x - evt.clientX;
              ny = y - evt.clientY;
              x = evt.clientX;
              y = evt.clientY;

              queueRender();
          };

          var onMouseUp = function(evt) {
              if (! dragging)
                  return;

              if ((Math.abs(sx - x) + Math.abs(sy - y)) < 8) {
                  if (root.class.contains('large')) {
                      root.class.remove('large');
                  } else {
                      root.class.add('large');
                  }
              }

              previewRotation[0] = Math.max(-90, Math.min(90, previewRotation[0] + ((sy - y) * 0.3)));
              previewRotation[1] += (sx - x) * 0.3;
              sx = sy = x = y = 0;

              dragging = false;

              queueRender();
          };

          window.addEventListener('mousemove', onMouseMove, false);
          window.addEventListener('mouseup', onMouseUp, false);


          root.class.add('asset-preview');
          root.prepend(previewContainer);

          // rendering preview
          var renderQueued;

          var renderPreview = function () {
              if (renderQueued)
                  renderQueued = false;

              // render
              editor.call('preview:render', assets[0], previewContainer.width, previewContainer.height, preview, {
                  rotation: [ Math.max(-90, Math.min(90, previewRotation[0] + (sy - y) * 0.3)), previewRotation[1] + (sx - x) * 0.3 ],
                  mipLevel: mipLevel
              });
          };
          renderPreview();

          // queue up the rendering to prevent too oftern renders
          var queueRender = function() {
              if (renderQueued) return;
              renderQueued = true;
              requestAnimationFrame(renderPreview);
          };

          // render on resize
          var evtPanelResize = root.on('resize', queueRender);
          var evtSceneSettings = editor.on('preview:scene:changed', queueRender);

          // cubemap textures loaded
          var cubemapWatch = editor.call('assets:cubemap:watch', {
              asset: assets[0],
              autoLoad: true,
              callback: queueRender
          });
      }


      // properties panel
      var panelParams = editor.call('attributes:addPanel', {
          name: 'CubeMap'
      });
      panelParams.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:cubemap:asset', panelParams, panelParams.headerElement);

      if (assets.length === 1) {
          panelParams.on('destroy', function() {
              root.class.remove('asset-preview');

              editor.call('assets:cubemap:unwatch', assets[0], cubemapWatch);

              evtSceneSettings.unbind();
              evtPanelResize.unbind();

              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
          });
      }


      // filtering
      var fieldFiltering = editor.call('attributes:addField', {
          parent: panelParams,
          name: 'Filtering',
          type: 'string',
          enum: {
              '': '...',
              'nearest': 'Point',
              'linear': 'Linear'
          }
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:filtering', fieldFiltering.parent.innerElement.firstChild.ui);

      var isPrefiltered = false;
      for(var i = 0; i < assets.length; i++) {
          if (!! assets[i].get('file')) {
              isPrefiltered = true;
              break;
          }
      }

      var changingFiltering = false;

      var updateFiltering = function() {
          var value = '';
          var valueDifferent = false;
          var filter = assets[0].get('data.minFilter') + '_' + assets[0].get('data.magFilter');

          for(var i = 1; i < assets.length; i++) {
              if (filter !== (assets[i].get('data.minFilter') + '_' + assets[i].get('data.magFilter'))) {
                  valueDifferent = true;
                  break;
              }
          }

          if (! valueDifferent) {
              if (assets[0].get('data.minFilter') === 5 && assets[0].get('data.magFilter') === 1) {
                  value = 'linear';
              } else if (assets[0].get('data.minFilter') === 2 && assets[0].get('data.magFilter') === 0) {
                  value = 'nearest';
              }
          }

          if (! valueDifferent && value) {
              fieldFiltering.optionElements[''].style.display = 'none';
          } else {
              fieldFiltering.optionElements[''].style.display = '';
          }

          changingFiltering = true;
          fieldFiltering.value = value;
          changingFiltering = false;
      };
      updateFiltering();

      fieldFiltering.on('change', function(value) {
          if (changingFiltering)
              return;

          var values = [ ];
          var valueMin = value === 'nearest' ? 2 : 5;
          var valueMag = value === 'nearest' ? 0 : 1;

          changingFiltering = true;
          for(var i = 0; i < assets.length; i++) {
              values.push({
                  id: assets[i].get('id'),
                  valueMin: assets[i].get('data.minFilter'),
                  valueMag: assets[i].get('data.magFilter')
              });
              assets[i].history.enabled = false;
              assets[i].set('data.minFilter', valueMin);
              assets[i].set('data.magFilter', valueMag);
              assets[i].history.enabled = true;
          }
          changingFiltering = false;

          fieldFiltering.optionElements[''].style.display = 'none';

          // history
          editor.call('history:add', {
              name: 'assets.filtering',
              undo: function() {
                  for(var i = 0; i < values.length; i++) {
                      var asset = editor.call('assets:get', values[i].id);
                      if (! asset)
                          continue;

                      asset.history.enabled = false;
                      asset.set('data.minFilter', values[i].valueMin);
                      asset.set('data.magFilter', values[i].valueMag);
                      asset.history.enabled = true;
                  }
              },
              redo: function() {
                  for(var i = 0; i < values.length; i++) {
                      var asset = editor.call('assets:get', values[i].id);
                      if (! asset)
                          continue;

                      asset.history.enabled = false;
                      asset.set('data.minFilter', valueMin);
                      asset.set('data.magFilter', valueMag);
                      asset.history.enabled = true;
                  }
              }
          });
      });

      var eventsFiltering = [ ];
      var changingQueued = false;
      var changedFiltering = function() {
          if (changingQueued || changingFiltering)
              return;

          changingQueued = true;
          setTimeout(function() {
              changingQueued = false;
              updateFiltering();
          }, 0);
      };
      for(var i = 0; i < assets.length; i++) {
          eventsFiltering.push(assets[i].on('data.minFilter:set', changedFiltering));
          eventsFiltering.push(assets[i].on('data.magFilter:set', changedFiltering));
      }
      fieldFiltering.once('destroy', function() {
          for(var i = 0; i < eventsFiltering.length; i++) {
              eventsFiltering[i].unbind();
          }
      });



      // anisotropy
      var fieldAnisotropy = editor.call('attributes:addField', {
          parent: panelParams,
          name: 'Anisotropy',
          type: 'number',
          link: assets,
          path: 'data.anisotropy'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:cubemap:anisotropy', fieldAnisotropy.parent.innerElement.firstChild.ui);


      if (assets.length === 1) {
          // preview
          var previewPanel = editor.call('attributes:addPanel', {
              name: 'Faces'
          });
          previewPanel.class.add('cubemap-viewport', 'component');
          // reference
          editor.call('attributes:reference:attach', 'asset:cubemap:slots', previewPanel, previewPanel.headerElement);


          var downloadButton = previewPanel.parent.dom.querySelector('.ui-panel.buttons > .content > .ui-button.download-asset');
          if (downloadButton)
              downloadButton = downloadButton.ui;

          // error
          var labelError = new ui.Label({
              text: 'error'
          });
          labelError.class.add('asset-loading-error');
          labelError.hidden = true;
          editor.call('attributes.rootPanel').append(labelError);


          // faces
          var sides = {
              2: 'top',
              1: 'left',
              4: 'front',
              0: 'right',
              5: 'back',
              3: 'bottom'
          };
          var side = [ 2, 1, 4, 0, 5, 3 ];
          var faces = [ ];

          var checkValid = function() {
              var invalid = invalidFaces();

              if (invalid)
                  labelError.text = invalid;

              labelError.hidden = ! invalid;

              if (downloadButton) {
                  downloadButton.disabled = !! invalid;
                  downloadButton.prevent = !! invalid;
              }
          };

          var invalidFaces = function() {
              var faces = assets[0].get('data.textures');

              if (! (faces instanceof Array))
                  return 'missing faces information';

              for(var i = 0; i < 6; i++) {
                  if (! faces[i])
                      return 'set face textures';
              }

              var width = 0;
              var height = 0;

              for(var i = 0; i < 6; i++) {
                  var asset = editor.call('assets:get', faces[i]);
                  if (! asset)
                      return 'missing face asset';

                  if (! asset.has('meta.width') || ! asset.has('meta.height'))
                      return 'no texture resolution data available';

                  var w = asset.get('meta.width');
                  var h = asset.get('meta.height');

                  if ((w & (w - 1)) !== 0 || (h & (h - 1)) !== 0)
                      return 'face textures should have power of two resolution';

                  if (w !== h)
                      return 'face textures should have square resolution';

                  if (i === 0) {
                      width = w;
                      height = h;
                  } else {
                      if (width !== w || height !== h)
                          return 'face textures should have same resolution';
                  }
              }

              return false;
          };

          var watchingAssets = [ null, null, null, null, null, null ];

          var makeThumbnailUrl = function(asset) {
              var url = config.url.home + '/' + (asset.get('thumbnails.l') || asset.get('file.url'));
              url = url.appendQuery('t=' + asset.get('file.hash'));
              return url;
          };

          // set face texture
          var setTexture = function(face, assetId) {
              if (watchingAssets[face.ind]) {
                  watchingAssets[face.ind].unbind();
                  watchingAssets[face.ind] = null;
              }

              if (! assetId) {
                  face.style.backgroundImage = '';
                  face.classList.add('empty');
              } else {
                  var texture = editor.call('assets:get', assetId);

                  if (texture && texture.get('type') === 'texture' && ! texture.get('source')) {
                      watchingAssets[face.ind] = texture.on('thumbnails:set', function() {
                          face.classList.remove('empty');
                          face.style.backgroundImage = 'url("' + makeThumbnailUrl(texture) + '")';
                      });
                  }

                  if (texture && texture.get('type') === 'texture' && (texture.get('thumbnails.l') || texture.get('file.url'))) {
                      face.classList.remove('empty');
                      face.style.backgroundImage = 'url("' + makeThumbnailUrl(texture) + '")';
                  } else {
                      face.classList.add('empty');
                      face.style.backgroundImage = '';
                  }
              }
          };

          var setAssetFace = function (face, texture) {
              var prevFace = assets[0].get('data.textures.' + face);
              var assetId = assets[0].get('id');
              var textureId = texture ? parseInt(texture.get('id'), 10) : null;

              var setRgbmIfNeeded = function (asset) {
                  var allHdr = true;
                  var textures = asset.get('data.textures');
                  for (var i = 0; i < textures.length; i++) {
                      if (textures[i] >= 0) {
                          var texture = editor.call('assets:get', textures[i]);
                          if (texture && !texture.get('data.rgbm')) {
                              allHdr = false;
                              break;
                          }
                      }
                  }

                  if (allHdr)  {
                      asset.set('data.rgbm', true);
                  } else {
                      asset.unset('data.rgbm');
                  }
              };

              var action = {
                  name: 'asset.' + assetId + '.face.' + face,
                  combine: false,
                  undo: function () {
                      var a = editor.call('assets:get', assetId);
                      if (!a) return;

                      var history = a.history.enabled;
                      a.history.enabled = false;
                      a.set('data.textures.' + face, prevFace);
                      setRgbmIfNeeded(a);
                      a.history.enabled = history;
                  },
                  redo: function () {
                      var a = editor.call('assets:get', assetId);
                      if (!a) return;

                      var history = a.history.enabled;
                      a.history.enabled = false;
                      a.set('data.textures.' + face, textureId);
                      // invalidate prefiltered data
                      // if (a.get('file')) a.set('file', null)
                      setRgbmIfNeeded(a);
                      a.history.enabled = history;
                  }
              };

              action.redo();

              assets[0].history.emit('record', 'add', action);
          };

          // create eface
          var createFace = function(ind) {
              // create face element
              var face = faces[ind] = document.createElement('div');
              face.ind = ind;
              face.classList.add('face', 'face-' + sides[ind]);
              previewPanel.append(face);

              var name = document.createElement('div');
              name.classList.add('face-name');
              name.innerHTML = sides[ind];
              face.appendChild(name);

              // on face click
              face.addEventListener('click', function() {
                  if (! editor.call('permissions:write'))
                      return;

                  var texture = editor.call('assets:get', assets[0].get('data.textures.' + ind));
                  editor.call('picker:asset', {
                      type: 'texture',
                      currentAsset: texture
                  });

                  var evtPick = editor.once('picker:asset', function(texture) {
                      // clear prefiltered data
                      setAssetFace(ind, texture);
                      evtPick = null;
                  });

                  editor.once('picker:asset:close', function() {
                      if (evtPick) {
                          evtPick.unbind();
                          evtPick = null;
                      }
                  });
              }, false);

              var dropRef = editor.call('drop:target', {
                  ref: face,
                  type: 'asset.texture',
                  drop: function(type, data) {
                      if (type !== 'asset.texture')
                          return;

                      var asset = editor.call('assets:get', parseInt(data.id, 10));

                      // try matching patterns of texture names
                      // to autoset  all 6 faces for empty cubemaps
                      try {
                          var empty = true;
                          var faces = assets[0].get('data.textures');
                          for(var i = 0; i < faces.length; i++) {
                              if (faces[i]) {
                                  empty = false;
                                  break;
                              }
                          }

                          if (empty) {
                              var name = asset.get('name');
                              var check = /((neg|pos)(x|y|z)|(right|left|top|up|bottom|down|front|forward|back|backward)|[0-6])(\.|$)/i;
                              var match = name.match(check);

                              if (match != null) {
                                  match = match.index;

                                  var part = '';
                                  if (match) part = name.slice(0, match).toLowerCase();
                                  var i = name.indexOf('.', match);
                                  if (i > 0) part += name.slice(i);

                                  var sort = {
                                      '0': 0,
                                      'posx': 0,
                                      'right': 0,

                                      '1': 1,
                                      'negx': 1,
                                      'left': 1,

                                      '2': 2,
                                      'posy': 2,
                                      'top': 2,
                                      'up': 2,

                                      '3': 3,
                                      'negy': 3,
                                      'bottom': 3,
                                      'down': 3,

                                      '4': 4,
                                      'posz': 4,
                                      'front': 4,
                                      'forward': 4,

                                      '5': 5,
                                      'negz': 5,
                                      'back': 5,
                                      'backward': 5,

                                      '6': 6,
                                  };
                                  var faceAssets = editor.call('assets:find', function(a) {
                                      if (a.get('source') || a.get('type') !== 'texture')
                                          return;

                                      if (! a.get('path').equals(asset.get('path')))
                                          return;

                                      if (a.get('meta.width') !== asset.get('meta.width') || a.get('meta.height') !== asset.get('meta.height'))
                                          return;

                                      var name = a.get('name').toLowerCase();
                                      var m = name.match(check);

                                      if (m === null)
                                          return;

                                      m = m.index;

                                      var p = '';
                                      if (m) p = name.slice(0, m).toLowerCase();
                                      var i = name.indexOf('.', m);
                                      if (i > 0) p += name.slice(i);

                                      return p === part;
                                  });

                                  if (faceAssets.length === 6) {
                                      var allFaces = [ ];

                                      for(var i = 0; i < faceAssets.length; i++) {
                                          var p = faceAssets[i][1].get('name').toLowerCase();
                                          if (match) p = p.slice(match);
                                          var m = p.indexOf('.');
                                          if (m > 0) p = p.slice(0, m);

                                          faceAssets[i] = {
                                              asset: faceAssets[i][1],
                                              face: sort[p]
                                          }
                                      }

                                      faceAssets.sort(function(a, b) {
                                          return a.face - b.face;
                                      });


                                      for(var i = 0; i < faceAssets.length; i++)
                                          setAssetFace(i, faceAssets[i].asset);

                                      return;
                                  }
                              }
                          }
                      } catch(ex) {
                          console.error(ex.message);
                          console.error(ex.stack);
                      }

                      setAssetFace(ind, asset);
                  }
              });
              previewPanel.on('destroy', function() {
                  for(var i = 0; i < watchingAssets.length; i++) {
                      if (! watchingAssets[i])
                          continue;

                      watchingAssets[i].unbind();
                      watchingAssets[i] = null;
                  }
                  dropRef.unregister();
              });

              // clear button
              var faceClear = document.createElement('div');
              faceClear.classList.add('clear');
              face.appendChild(faceClear);

              // on clear click
              faceClear.addEventListener('click', function(evt) {
                  if (! editor.call('permissions:write'))
                      return;

                  evt.stopPropagation();
                  setAssetFace(ind, null);
                  face.classList.add('empty');
              }, false);

              // load texture asset
              setTexture(face, assets[0].get('data.textures.' + ind));

              // bind to changes
              face.evt = assets[0].on('data.textures.' + ind + ':set', function(value) {
                  clearPrefiltered();
                  setTexture(face, value);
                  prefilterPanel.hidden = !! invalidFaces();
                  checkValid();
              });
          };

          // create all faces
          for(var i = 0; i < side.length; i++)
              createFace(side[i]);

          // on destroy
          previewPanel.on('destroy', function() {
              // unbind events
              for(var i = 0; i < faces.length; i++)
                  faces[i].evt.unbind();
          });


          // prefiltering
          var prefilterPanel = editor.call('attributes:addPanel', {
              name: 'Prefiltering'
          });
          prefilterPanel.class.add('component');
          // reference
          editor.call('attributes:reference:attach', 'asset:cubemap:prefilter', prefilterPanel, prefilterPanel.headerElement);

          // prefilter button
          var prefilterBtn = new ui.Button({
              text: 'Prefilter',
          });

          prefilterPanel.append(prefilterBtn);

          prefilterBtn.on('click', function () {
              // disable while prefiltering
              prefilterBtn.disabled = true;
              editor.call('assets:cubemaps:prefilter', assets[0], function (err) {
                  // re-enable button
                  if (err)
                      return editor.call('status:error', err);

                  prefilterBtn.disabled = true;
              });
          });

          // delete prefiltered data button
          var clearPrefilteredBtn = new ui.Button({
              text: 'Delete Prefiltered Data',
          });

          prefilterPanel.append(clearPrefilteredBtn);

          var clearPrefiltered = function () {
              editor.call('realtime:send', 'cubemap:clear:', parseInt(assets[0].get('uniqueId'), 10));
          };

          clearPrefilteredBtn.on('click', clearPrefiltered);

          var evtFileChange = assets[0].on('file:set', function (value) {
              prefilterBtn.disabled = false;

              if (mipSelector)
                  mipSelector.hidden = ! value;

              if (queueRender)
                  queueRender();

              togglePrefilterFields(!! value);
          });

          prefilterPanel.once('destroy', function () {
              evtFileChange.unbind();
          });


          // show prefilter button or clear prefiltering button depending
          // on current cubemap 'file' field
          var togglePrefilterFields = function (isPrefiltered) {
              prefilterPanel.hidden = !! invalidFaces();
              prefilterBtn.hidden = isPrefiltered;
              prefilterBtn.disabled = !! assets[0].get('task');
              clearPrefilteredBtn.hidden = ! isPrefiltered;
          };

          togglePrefilterFields(!!assets[0].get('file'));
          checkValid();
      }
  });
});


/* editor/attributes/assets/attributes-asset-html.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length !== 1 || assets[0].get('type') !== 'html' || assets[0].get('source'))
          return;

      var asset = assets[0];

      // panel
      var panel = editor.call('attributes:assets:panel');

      var panelRaw = editor.call('attributes:addPanel', {
          name: 'HTML'
      });
      panelRaw.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:html:asset', panelRaw, panelRaw.headerElement);

      // loading
      var loading = editor.call('attributes:addField', {
          type: 'progress'
      });
      loading.progress = 1;

      // code
      var fieldCode = editor.call('attributes:addField', {
          parent: panelRaw,
          type: 'code'
      });
      fieldCode.style.margin = '-8px -6px';

      var fieldError = new ui.Label({
          text: 'failed loading data'
      });
      fieldError.class.add('asset-loading-error');
      fieldError.hidden = true;
      editor.call('attributes.rootPanel').append(fieldError);

      var loadContent = function() {
          if (asset.get('file.size') > 128 * 1024) {
              panelRaw.hidden = true;
              loading.hidden = true;
              return;
          } else {
              panelRaw.hidden = false;
              loading.hidden = false;
          }
          // load data
          Ajax({
              url: '{{url.home}}' + asset.get('file.url').appendQuery('t=' + asset.get('file.hash')),
              notJson: true
          })
          .on('load', function(status, data) {
              fieldCode.text = data;
              fieldCode.hidden = false;
              fieldError.hidden = true;
              loading.hidden = true;
          })
          .on('error', function() {
              loading.hidden = false;
              loading.failed = true;
              fieldCode.hidden = true;
              fieldError.hidden = false;
          });
      };
      if (asset.has('file.url'))
          loadContent();

      var evtReload = asset.on('file.hash:set', function() {
          loadContent();
      });
      panel.once('destroy', function() {
          evtReload.unbind();
      });
  });
});


/* editor/attributes/assets/attributes-asset-json.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length !== 1 || assets[0].get('type') !== 'json' || assets[0].get('source'))
          return;

      var asset = assets[0];

      // panel
      var panel = editor.call('attributes:assets:panel');

      var panelRaw = editor.call('attributes:addPanel', {
          name: 'JSON'
      });
      panelRaw.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:json:asset', panelRaw, panelRaw.headerElement);

      // loading
      var loading = editor.call('attributes:addField', {
          type: 'progress'
      });
      loading.progress = 1;

      // code
      var fieldCode = editor.call('attributes:addField', {
          parent: panelRaw,
          type: 'code'
      });
      fieldCode.style.margin = '-8px -6px';

      var fieldError = new ui.Label({
          text: 'failed loading data'
      });
      fieldError.class.add('asset-loading-error');
      fieldError.hidden = true;
      editor.call('attributes.rootPanel').append(fieldError);

      var loadContent = function() {
          if (asset.get('file.size') > 128 * 1024) {
              panelRaw.hidden = true;
              loading.hidden = true;
              return;
          } else {
              panelRaw.hidden = false;
              loading.hidden = false;
          }
          // load data
          Ajax
          .get('{{url.home}}' + asset.get('file.url').appendQuery('t=' + asset.get('file.hash')))
          .on('load', function(status, data) {
              fieldCode.text = JSON.stringify(data, null, 4);
              fieldCode.hidden = false;
              fieldError.hidden = true;
              loading.hidden = true;
          })
          .on('error', function() {
              loading.hidden = false;
              loading.failed = true;
              fieldCode.hidden = true;
              fieldError.hidden = false;
          });
      };
      if (asset.has('file.url'))
          loadContent();

      var evtReload = asset.on('file.hash:set', function() {
          loadContent();
      });
      panel.once('destroy', function() {
          evtReload.unbind();
      });
  });
});


/* editor/attributes/assets/attributes-asset-material.js */
editor.once('load', function () {
  'use strict';

  var mappingMaps = [
      'diffuse',
      'specular',
      'emissive',
      'normal',
      'metalness',
      'gloss',
      'opacity',
      'height',
      'ao',
      'light'
  ];

  var panelsStates = {};
  var panelsStatesDependencies = {
      'offset': ['diffuseMapOffset', 'diffuseMapTiling'],
      'ao': ['aoMap'],
      'diffuse': ['diffuseMap'],
      'specular': ['specularMap', 'metalnessMap', 'glossMap'],
      'emissive': ['emissiveMap'],
      'opacity': ['opacityMap'],
      'normals': ['normalMap'],
      'height': ['heightMap'],
      'environment': ['sphereMap', 'cubeMap'],
      'light': ['lightMap'],
      'states': []
  };

  var currentPreviewModel = 'sphere';

  // Contains paths in this form: id.data.property
  // Holds material properties that are not in the db.
  // Used to set initial values for offsets and tilings
  // to avoid sharedb errors.
  var missingPaths = {};

  editor.method('material:rememberMissingFields', function (asset) {
      // check missing tilings / offsets
      mappingMaps.forEach(function (map) {
          var path = 'data.' + map + 'MapTiling';
          if (asset.get(path) === null)
              missingPaths[asset.get('id') + '.' + path] = true;

          path = 'data.' + map + 'MapOffset';
          if (asset.get(path) === null)
              missingPaths[asset.get('id') + '.' + path] = true;
      });
  });

  editor.on('attributes:inspect[asset]', function (assets) {
      var i, key;
      for (i = 0; i < assets.length; i++) {
          if (assets[i].get('type') !== 'material') {
              return;
          }
      }

      var app = editor.call('viewport:app');
      if (!app) return; // webgl not available

      if (assets.length > 1) {
          editor.call('attributes:header', assets.length + ' Materials');
      }

      var root = editor.call('attributes.rootPanel');

      var ids = [];

      for (i = 0; i < assets.length; i++) {
          ids.push(assets[i].get('id'));
      }

      ids = ids.sort(function (a, b) {
          return a - b;
      }).join(',');

      var panelState = panelsStates[ids];
      var panelStateNew = false;

      if (!panelState) {
          panelStateNew = true;
          panelState = panelsStates[ids] = {};

          for (key in panelsStatesDependencies) {
              var fields = panelsStatesDependencies[key];
              panelState[key] = true;

              for (var n = 0; n < fields.length; n++) {
                  var type = editor.call('schema:material:getType', fields[n]);
                  switch (type) {
                      case 'vec2':
                          for (i = 0; i < assets.length; i++) {
                              var value = assets[i].get('data.' + fields[n]);
                              var defaultValue = editor.call('schema:material:getDefaultValueForField', fields[n]);
                              if (value && value[0] !== defaultValue[0] || value && value[1] !== defaultValue[1]) {
                                  panelState[key] = false;
                                  break;
                              }
                          }
                          break;
                      case 'asset':
                          for (i = 0; i < assets.length; i++) {
                              if (assets[i].get('data.' + fields[n])) {
                                  panelState[key] = false;
                                  break;
                              }
                          }
                          break;
                  }
              }
          }
      }

      var previewTexturesHover = null;

      // preview
      if (assets.length === 1) {
          previewTexturesHover = {};

          var previewContainer = new pcui.Container();
          previewContainer.class.add('asset-preview-container');

          var preview = document.createElement('canvas');
          var ctx = preview.getContext('2d');
          preview.width = 256;
          preview.height = 256;
          preview.classList.add('asset-preview', 'flipY');
          previewContainer.append(preview);

          var modelSphere = new ui.Button({
              text: '&#58121;'
          });
          modelSphere.class.add('sphere');
          if (currentPreviewModel === 'sphere')
              modelSphere.class.add('active');
          previewContainer.append(modelSphere.element);
          modelSphere.parent = panelParams;

          modelSphere.on('click', function () {
              if (currentPreviewModel === 'sphere')
                  return;

              currentPreviewModel = 'sphere';
              modelBox.class.remove('active');
              modelSphere.class.add('active');

              queueRender();
          });

          var modelBox = new ui.Button({
              text: '&#57735;'
          });
          modelBox.class.add('box');
          if (currentPreviewModel === 'box')
              modelBox.class.add('active');
          previewContainer.append(modelBox.element);
          modelBox.parent = panelParams;

          modelBox.on('click', function () {
              if (currentPreviewModel === 'box')
                  return;

              currentPreviewModel = 'box';
              modelSphere.class.remove('active');
              modelBox.class.add('active');

              queueRender();
          });

          var sx = 0, sy = 0, x = 0, y = 0, nx = 0, ny = 0;
          var dragging = false;
          var previewRotation = [0, 0];

          preview.addEventListener('mousedown', function (evt) {
              if (evt.button !== 0)
                  return;

              evt.preventDefault();
              evt.stopPropagation();

              sx = x = evt.clientX;
              sy = y = evt.clientY;

              dragging = true;
          }, false);

          var onMouseMove = function (evt) {
              if (!dragging)
                  return;

              nx = x - evt.clientX;
              ny = y - evt.clientY;
              x = evt.clientX;
              y = evt.clientY;

              queueRender();
          };

          var onMouseUp = function (evt) {
              if (!dragging)
                  return;

              if ((Math.abs(sx - x) + Math.abs(sy - y)) < 8) {
                  if (root.class.contains('large')) {
                      root.class.remove('large');
                  } else {
                      root.class.add('large');
                  }
              }

              previewRotation[0] = Math.max(-90, Math.min(90, previewRotation[0] + ((sy - y) * 0.3)));
              previewRotation[1] += (sx - x) * 0.3;
              sx = sy = x = y = 0;

              dragging = false;

              queueRender();
          };

          window.addEventListener('mousemove', onMouseMove, false);
          window.addEventListener('mouseup', onMouseUp, false);


          root.class.add('asset-preview');
          root.prepend(previewContainer);

          // rendering preview
          var renderQueued;

          var renderPreview = function () {
              if (renderQueued)
                  renderQueued = false;

              // render
              editor.call('preview:render', assets[0], previewContainer.width, previewContainer.height, preview, {
                  rotation: [Math.max(-90, Math.min(90, previewRotation[0] + (sy - y) * 0.3)), previewRotation[1] + (sx - x) * 0.3],
                  model: currentPreviewModel,
                  params: previewTexturesHover
              });
          };

          // queue up the rendering to prevent too oftern renders
          var queueRender = function () {
              if (renderQueued) return;
              renderQueued = true;
              requestAnimationFrame(renderPreview);
          };

          renderPreview();

          // render on resize
          var evtPanelResize = root.on('resize', queueRender);
          var evtSceneSettings = editor.on('preview:scene:changed', queueRender);

          // material textures loaded
          var materialWatch = editor.call('assets:material:watch', {
              asset: assets[0],
              autoLoad: true,
              callback: queueRender
          });
      }

      var handleTextureHover = function (path) {
          var valueOld = null;
          var events = [];

          return {
              over: function (type, data) {
                  var i;

                  if (previewTexturesHover !== null)
                      previewTexturesHover[path] = parseInt(data.id, 10);

                  var texture = app.assets.get(parseInt(data.id, 10));
                  app.assets.load(texture);

                  var attachTexture = function (ind) {
                      var engineAsset = app.assets.get(parseInt(assets[ind].get('id'), 10));
                      app.assets.load(engineAsset);

                      if (engineAsset && engineAsset.resource) {
                          valueOld[ind] = engineAsset.resource[path];

                          if (texture.resource) {
                              engineAsset.resource[path] = texture.resource;
                              engineAsset.resource.update();
                          } else {
                              var evt = {
                                  asset: texture,
                                  fn: function () {
                                      engineAsset.resource[path] = texture.resource;
                                      engineAsset.resource.update();
                                  }
                              };
                              events.push(evt);
                              texture.once('load', evt.fn);
                          }
                      }
                  };

                  valueOld = [];
                  for (i = 0; i < assets.length; i++)
                      attachTexture(i);

                  editor.call('viewport:render');

                  if (queueRender)
                      queueRender();
              },
              leave: function () {
                  var i;
                  if (previewTexturesHover !== null)
                      previewTexturesHover = {};

                  if (queueRender)
                      queueRender();

                  if (valueOld === null) return;

                  for (i = 0; i < events.length; i++)
                      events[i].asset.off('load', events[i].fn);
                  events = [];

                  for (i = 0; i < assets.length; i++) {
                      var engineAsset = app.assets.get(parseInt(assets[i].get('id'), 10));
                      app.assets.load(engineAsset);

                      if (engineAsset && engineAsset.resource) {
                          engineAsset.resource[path] = valueOld[i];
                          engineAsset.resource.update();
                      }
                  }
                  editor.call('viewport:render');
                  valueOld = null;
              }
          };
      };


      // properties panel
      var panelParams = editor.call('attributes:addPanel', {
          name: 'Material'
      });
      panelParams.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:material:asset', panelParams, panelParams.headerElement);
      // clean preview
      if (assets.length === 1) {
          panelParams.on('destroy', function () {
              root.class.remove('asset-preview');

              editor.call('assets:material:unwatch', assets[0], materialWatch);

              evtSceneSettings.unbind();
              evtPanelResize.unbind();

              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
          });
      }


      // model
      var fieldShader = editor.call('attributes:addField', {
          parent: panelParams,
          type: 'string',
          enum: {
              '': '...',
              'phong': 'Phong',
              'blinn': 'Physical'
          },
          name: 'Shading',
          link: assets,
          path: 'data.shader'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:shadingModel', fieldShader.parent.innerElement.firstChild.ui);
      // fresnelMode
      var evtFresnelModel = [];
      for (i = 0; i < assets.length; i++) {
          evtFresnelModel.push(assets[i].on('data.shader:set', function (value) {
              var state = this.history.enabled;
              this.history.enabled = false;
              this.set('data.fresnelModel', value === 'blinn' ? 2 : 0);
              this.history.enabled = state;
          }));
      }
      fieldShader.once('destroy', function () {
          for (var i = 0; i < evtFresnelModel.length; i++)
              evtFresnelModel[i].unbind();
      });

      // TODO
      // make sure changes by history or to individual
      // offset/tiling fields affects state of global fields

      // tiling & offsets
      var tilingOffsetsChanging = false;
      var offset = assets[0].get('data.' + mappingMaps[0] + 'MapOffset');
      var tiling = assets[0].get('data.' + mappingMaps[0] + 'MapTiling');
      var checkTilingOffsetDifferent = function () {
          var offset = assets[0].get('data.' + mappingMaps[0] + 'MapOffset');
          var tiling = assets[0].get('data.' + mappingMaps[0] + 'MapTiling');

          for (var i = 0; i < assets.length; i++) {
              for (var m = 0; m < mappingMaps.length; m++) {
                  if (i === 0 && m === 0)
                      continue;

                  if (!offset.equals(assets[i].get('data.' + mappingMaps[m] + 'MapOffset')) || !tiling.equals(assets[i].get('data.' + mappingMaps[m] + 'MapTiling'))) {
                      return true;
                  }
              }
          }

          return false;
      }
      var different = checkTilingOffsetDifferent();

      if (different && panelStateNew)
          panelState['offset'] = true;

      var panelTiling = editor.call('attributes:addPanel', {
          foldable: true,
          folded: panelState['offset'],
          name: 'Offset & Tiling'
      });
      panelTiling.class.add('component');
      panelTiling.on('fold', function () { panelState['offset'] = true; });
      panelTiling.on('unfold', function () { panelState['offset'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:offsetTiling', panelTiling, panelTiling.headerElement);

      var tilingOffsetFields = [];

      // all maps
      var fieldTilingOffset = editor.call('attributes:addField', {
          parent: panelTiling,
          type: 'checkbox',
          name: 'Apply to all Maps',
          value: !different
      });
      fieldTilingOffset.element.previousSibling.style.width = 'auto';
      fieldTilingOffset.on('change', function (value) {
          var i;

          if (tilingOffsetsChanging)
              return;

          fieldOffset[0].parent.hidden = !value;
          fieldTiling[0].parent.hidden = !value;

          for (i = 0; i < tilingOffsetFields.length; i++) {
              tilingOffsetFields[i].element.hidden = tilingOffsetFields[i].filter();
          }

          if (value) {
              var valueOffset = [fieldOffset[0].value, fieldOffset[1].value];
              var valueTiling = [fieldTiling[0].value, fieldTiling[1].value];
              var items = [];
              tilingOffsetsChanging = true;
              for (i = 0; i < assets.length; i++) {
                  for (var m = 0; m < mappingMaps.length; m++) {
                      items.push({
                          get: assets[i].history._getItemFn,
                          path: 'data.' + mappingMaps[m] + 'Map',
                          valueOffset: assets[i].get('data.' + mappingMaps[m] + 'MapOffset'),
                          valueTiling: assets[i].get('data.' + mappingMaps[m] + 'MapTiling')
                      });
                      assets[i].history.enabled = false;
                      assets[i].set('data.' + mappingMaps[m] + 'MapOffset', valueOffset);
                      assets[i].set('data.' + mappingMaps[m] + 'MapTiling', valueTiling);
                      assets[i].history.enabled = true;
                  }
              }
              tilingOffsetsChanging = false;
              // history
              editor.call('history:add', {
                  name: 'assets.materials.tiling-offset',
                  undo: function () {
                      for (var i = 0; i < items.length; i++) {
                          var item = items[i].get();
                          if (!item)
                              continue;

                          item.history.enabled = false;
                          item.set(items[i].path + 'Offset', items[i].valueOffset);
                          item.set(items[i].path + 'Tiling', items[i].valueTiling);
                          item.history.enabled = true;
                      }
                  },
                  redo: function () {
                      for (var i = 0; i < items.length; i++) {
                          var item = items[i].get();
                          if (!item)
                              continue;

                          item.history.enabled = false;
                          item.set(items[i].path + 'Offset', valueOffset);
                          item.set(items[i].path + 'Tiling', valueTiling);
                          item.history.enabled = true;
                      }
                  }
              });
          }
      });

      // offset
      var fieldOffset = editor.call('attributes:addField', {
          parent: panelTiling,
          type: 'vec2',
          name: 'Offset',
          placeholder: ['U', 'V']
      });
      fieldOffset[0].parent.hidden = !fieldTilingOffset.value;
      // reference
      editor.call('attributes:reference:attach', 'asset:material:offset', fieldOffset[0].parent.innerElement.firstChild.ui);

      // tiling
      var fieldTiling = editor.call('attributes:addField', {
          parent: panelTiling,
          type: 'vec2',
          name: 'Tiling',
          placeholder: ['U', 'V']
      });
      fieldTiling[0].parent.hidden = !fieldTilingOffset.value;
      // reference
      editor.call('attributes:reference:attach', 'asset:material:tiling', fieldTiling[0].parent.innerElement.firstChild.ui);

      if (different) {
          fieldTilingOffset.value = false;

          if (panelStateNew && !panelState['offset'])
              panelState['offset'] = true;
      }

      fieldOffset[0].value = offset[0];
      fieldOffset[1].value = offset[1];
      fieldTiling[0].value = tiling[0];
      fieldTiling[1].value = tiling[1];

      var updateAllTilingOffsetFields = function (input, type, field, value, valueOld) {
          if (!fieldTilingOffset.value || tilingOffsetsChanging)
              return;

          var items = [];

          tilingOffsetsChanging = true;
          for (var i = 0; i < assets.length; i++) {
              assets[i].history.enabled = false;
              for (var m = 0; m < mappingMaps.length; m++) {
                  var path = 'data.' + mappingMaps[m] + 'Map' + type;
                  // set initial value for tiling / offset if it was missing
                  if (missingPaths[assets[i].get('id') + '.' + path]) {
                      assets[i].set(path, [input[0].value, input[1].value]);
                      delete missingPaths[assets[i].get('id') + '.' + path];
                  }

                  var fullpath = path + '.' + field;
                  items.push({
                      get: assets[i].history._getItemFn,
                      path: fullpath,
                      value: assets[i].get(fullpath)
                  });
                  assets[i].set(fullpath, value);
              }
              assets[i].history.enabled = true;
          }
          tilingOffsetsChanging = false;

          // history
          editor.call('history:add', {
              name: 'assets.materials.' + type + '.' + field,
              undo: function () {
                  for (var i = 0; i < items.length; i++) {
                      var item = items[i].get();
                      if (!item)
                          continue;

                      item.history.enabled = false;
                      item.set(items[i].path, items[i].value);
                      item.history.enabled = true;
                  }
              },
              redo: function () {
                  for (var i = 0; i < items.length; i++) {
                      var item = items[i].get();
                      if (!item)
                          continue;

                      item.history.enabled = false;
                      item.set(items[i].path, value);
                      item.history.enabled = true;
                  }
              }
          });
      };

      fieldOffset[0].on('change', function (value, valueOld) {
          updateAllTilingOffsetFields(fieldOffset, 'Offset', 0, value);
      });
      fieldOffset[1].on('change', function (value, valueOld) {
          updateAllTilingOffsetFields(fieldOffset, 'Offset', 1, value);
      });
      fieldTiling[0].on('change', function (value, valueOld) {
          updateAllTilingOffsetFields(fieldTiling, 'Tiling', 0, value);
      });
      fieldTiling[1].on('change', function (value, valueOld) {
          updateAllTilingOffsetFields(fieldTiling, 'Tiling', 1, value);
      });

      var queuedOffsetsCheck = null;
      var queueOffsetsCheck = function () {
          if (queuedOffsetsCheck)
              return;

          queuedOffsetsCheck = setTimeout(function () {
              queuedOffsetsCheck = null;

              if (!fieldTilingOffset.value)
                  return;

              var offset = assets[0].get('data.diffuseMapOffset');
              var tiling = assets[0].get('data.diffuseMapTiling');

              tilingOffsetsChanging = true;

              fieldOffset[0].value = offset[0];
              fieldOffset[1].value = offset[1];

              fieldTiling[0].value = tiling[0];
              fieldTiling[1].value = tiling[1];

              tilingOffsetsChanging = false;
          });
      };

      for (i = 0; i < assets.length; i++) {
          for (var m = 0; m < mappingMaps.length; m++) {
              assets[i].on('data.' + mappingMaps[m] + 'MapOffset.0:set', queueOffsetsCheck);
              assets[i].on('data.' + mappingMaps[m] + 'MapOffset.1:set', queueOffsetsCheck);
              assets[i].on('data.' + mappingMaps[m] + 'MapTiling.0:set', queueOffsetsCheck);
              assets[i].on('data.' + mappingMaps[m] + 'MapTiling.1:set', queueOffsetsCheck);
          }
      }

      panelTiling.once('destroy', function () {
          if (queuedOffsetsCheck)
              clearTimeout(queuedOffsetsCheck);
      });

      var rgxExtension = /\.[a-z]+$/;
      var textureFields = {};
      var texturePanels = {};
      var bulkSlots = {
          'ao': ['a', 'ao', 'ambient', 'ambientocclusion', 'gma', 'gmat', 'gmao', 'gmaa', 'rma', 'rmat', 'rmao', 'rmaa'],
          'diffuse': ['d', 'diff', 'diffuse', 'albedo', 'color', 'rgb', 'rgba'],
          'specular': ['s', 'spec', 'specular'],
          'metalness': ['m', 'met', 'metal', 'metalness', 'gma', 'gmat', 'gmao', 'gmaa', 'rma', 'rmat', 'rmao', 'rmaa'],
          'gloss': ['g', 'gloss', 'glossiness', 'gma', 'gmat', 'gmao', 'gmaa', 'rma', 'rmat', 'rmao', 'rmaa'],
          'emissive': ['e', 'emissive'],
          'opacity': ['o', 't', 'opacity', 'alpha', 'transparency', 'gmat', 'gmao', 'gmaa', 'rgba', 'rmat', 'rmao', 'rmaa'],
          'normal': ['n', 'norm', 'normal', 'normals'],
          'height': ['p', 'h', 'height', 'parallax', 'bump'],
          'light': ['l', 'lm', 'light', 'lightmap']
      };

      var postfixToSlot = {};
      for (key in bulkSlots) {
          for (i = 0; i < bulkSlots[key].length; i++) {
              postfixToSlot[bulkSlots[key][i]] = postfixToSlot[bulkSlots[key][i]] || [];
              postfixToSlot[bulkSlots[key][i]].push(key);
          }
      }

      var tokenizeFilename = function (filename) {
          filename = filename.trim().toLowerCase();

          if (!filename)
              return;

          // drop extension
          var ext = filename.match(rgxExtension);
          if (ext) filename = filename.slice(0, -ext[0].length);

          if (!filename)
              return;

          var parts = filename.split(/(\-|_|\.)/g);
          var tokens = [];

          for (var i = 0; i < parts.length; i++) {
              if (parts[i] === '-' || parts[i] === '_' || parts[i] === '.')
                  continue;

              tokens.push(parts[i]);
          }

          if (!tokens.length)
              return;

          if (tokens.length === 1)
              return ['', tokens[0]];

          var left = tokens.slice(0, -1).join('');
          var right = tokens[tokens.length - 1];

          return [left, right];
      };

      var getFilenameLeftPart = function (name) {
          var parts = asset.get('name').trim().replace(/\.[a-z]+$/i, '').split(/(\-|_|\.)/g);
          if (parts.length < 3)
              return '';

          var first = parts.slice(0, -1).join('').toLowerCase();
      };

      var onTextureBulkSet = function (asset, oldValues, slot) {
          var tokens = tokenizeFilename(asset.get('name'));
          if (!tokens)
              return;

          if (bulkSlots[slot].indexOf(tokens[1]) == -1)
              return;

          var path = asset.get('path');
          var textures = editor.call('assets:find', function (texture) {
              return texture.get('type') === 'texture' && !texture.get('source') && texture.get('path').equals(path);
          });

          var candidates = {};
          for (var i = 0; i < textures.length; i++) {
              var t = tokenizeFilename(textures[i][1].get('name'));

              if (!t || t[0] !== tokens[0] || !postfixToSlot[t[1]])
                  continue;

              for (var s = 0; s < postfixToSlot[t[1]].length; s++) {
                  if (postfixToSlot[t[1]][s] === slot)
                      continue;

                  candidates[postfixToSlot[t[1]][s]] = {
                      texture: textures[i][1],
                      postfix: t[1]
                  };
              }
          }

          if (!Object.keys(candidates).length)
              return;

          var records = [];

          for (var a = 0; a < assets.length; a++) {
              if (oldValues[assets[a].get('id')])
                  continue;

              var history = assets[a].history.enabled;
              assets[a].history.enabled = false;

              for (var s in candidates) {
                  var key = 'data.' + s + 'Map';

                  if (assets[a].get(key))
                      continue;

                  var panel = texturePanels[s];
                  if (panel) panel.folded = false;

                  var id = parseInt(candidates[s].texture.get('id'), 10);
                  assets[a].set(key, id);

                  records.push({
                      id: assets[a].get('id'),
                      key: key,
                      value: id,
                      old: null
                  });

                  if (s === 'ao') {
                      // ao can be in third color channel
                      if (/^(g|r)ma/.test(candidates[s].postfix)) {
                          var channel = assets[a].get('data.aoMapChannel');
                          if (channel !== 'b') {
                              assets[a].set('data.aoMapChannel', 'b');

                              records.push({
                                  id: assets[a].get('id'),
                                  key: 'data.aoMapChannel',
                                  value: 'b',
                                  old: channel
                              });
                          }
                      }
                  } else if (s === 'metalness') {
                      // use metalness
                      if (!assets[a].get('data.useMetalness')) {
                          assets[a].set('data.useMetalness', true);

                          records.push({
                              id: assets[a].get('id'),
                              key: 'data.useMetalness',
                              value: true,
                              old: false
                          });
                      }

                      // metalness to maximum
                      var metalness = assets[a].get('data.metalness');
                      if (metalness !== 1) {
                          assets[a].set('data.metalness', 1.0);

                          records.push({
                              id: assets[a].get('id'),
                              key: 'data.metalness',
                              value: 1.0,
                              old: metalness
                          });
                      }

                      // metalness can be in second color channel
                      if (/^(g|r)ma/.test(candidates[s].postfix)) {
                          var channel = assets[a].get('data.metalnessMapChannel');
                          if (channel !== 'g') {
                              assets[a].set('data.metalnessMapChannel', 'g');

                              records.push({
                                  id: assets[a].get('id'),
                                  key: 'data.metalnessMapChannel',
                                  value: 'g',
                                  old: channel
                              });
                          }
                      }
                  } else if (s === 'gloss') {
                      // gloss to maximum
                      var shininess = assets[a].get('data.shininess');
                      if (shininess !== 100) {
                          assets[a].set('data.shininess', 100.0);

                          records.push({
                              id: assets[a].get('id'),
                              key: 'data.shininess',
                              value: 100.0,
                              old: shininess
                          });
                      }

                      // gloss shall be in first color channel
                      var channel = assets[a].get('data.glossMapChannel');
                      if (channel !== 'r') {
                          assets[a].set('data.glossMapChannel', 'r');

                          records.push({
                              id: assets[a].get('id'),
                              key: 'data.glossMapChannel',
                              value: 'r',
                              old: channel
                          });
                      }
                  } else if (s === 'opacity') {
                      // opacity can be in fourth color channel
                      if (/^(gma|rma|rgb)(t|o|a)$/.test(candidates[s].postfix)) {
                          var channel = assets[a].get('data.opacityMapChannel');
                          if (channel !== 'a') {
                              assets[a].set('data.opacityMapChannel', 'a');

                              records.push({
                                  id: assets[a].get('id'),
                                  key: 'data.opacityMapChannel',
                                  value: 'a',
                                  old: channel
                              });
                          }
                      }
                  }
              }

              assets[a].history.enabled = history;
          }

          if (records.length) {
              editor.call('history:add', {
                  name: 'material textures auto-bind',
                  undo: function () {
                      for (var i = 0; i < records.length; i++) {
                          var asset = editor.call('assets:get', records[i].id);
                          if (!asset)
                              continue;

                          var history = asset.history.enabled;
                          asset.history.enabled = false;
                          asset.set(records[i].key, records[i].old);
                          asset.history.enabled = history;
                      }
                  },
                  redo: function () {
                      for (var i = 0; i < records.length; i++) {
                          var asset = editor.call('assets:get', records[i].id);
                          if (!asset)
                              continue;

                          var history = asset.history.enabled;
                          asset.history.enabled = false;
                          asset.set(records[i].key, records[i].value);
                          asset.history.enabled = history;
                      }
                  }
              });
          }
      };



      // ambient
      var panelAmbient = texturePanels.ao = editor.call('attributes:addPanel', {
          foldable: true,
          folded: panelState['ao'],
          name: 'Ambient'
      });
      panelAmbient.class.add('component');
      panelAmbient.on('fold', function () { panelState['ao'] = true; });
      panelAmbient.on('unfold', function () { panelState['ao'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:ambientOverview', panelAmbient, panelAmbient.headerElement);


      // map
      var fieldAmbientMapHover = handleTextureHover('aoMap');
      var fieldAmbientMap = textureFields.ao = editor.call('attributes:addField', {
          parent: panelAmbient,
          type: 'asset',
          kind: 'texture',
          name: 'Ambient Occlusion',
          link: assets,
          path: 'data.aoMap',
          over: fieldAmbientMapHover.over,
          leave: fieldAmbientMapHover.leave,
          onSet: function (asset, oldValues) {
              onTextureBulkSet(asset, oldValues, 'ao');
          }
      });
      fieldAmbientMap.parent.class.add('channel');
      fieldAmbientMap.on('change', function (value) {
          fieldAmbientOffset[0].parent.hidden = filterAmbientOffset();
          fieldAmbientTiling[0].parent.hidden = filterAmbientTiling();
          fieldOccludeSpecular.parent.hidden = !fieldAmbientMap.value && !fieldAmbientMap.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:aoMap', fieldAmbientMap._label);

      // map uv
      var fieldAmbientMapUV = editor.call('attributes:addField', {
          panel: fieldAmbientMap.parent,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'UV0' },
              { v: 1, t: 'UV1' }
          ],
          link: assets,
          path: 'data.aoMapUv'
      });
      fieldAmbientMapUV.flexGrow = 0;
      fieldAmbientMapUV.element.parentNode.removeChild(fieldAmbientMapUV.element);
      fieldAmbientMap.parent.innerElement.querySelector('.top > .controls').appendChild(fieldAmbientMapUV.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:aoMapUv', fieldAmbientMapUV);

      // map channel
      var fieldAmbientMapChannel = editor.call('attributes:addField', {
          panel: fieldAmbientMap.parent,
          type: 'string',
          enum: {
              '': '...',
              'r': 'R',
              'g': 'G',
              'b': 'B',
              'a': 'A'
          },
          link: assets,
          path: 'data.aoMapChannel'
      });
      fieldAmbientMapChannel.element.parentNode.removeChild(fieldAmbientMapChannel.element);
      fieldAmbientMap.parent.innerElement.querySelector('.top > .ui-label').parentNode.appendChild(fieldAmbientMapChannel.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:aoMapChannel', fieldAmbientMapChannel);

      // offset
      var fieldAmbientOffset = editor.call('attributes:addField', {
          parent: panelAmbient,
          type: 'vec2',
          name: 'Offset',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.aoMapOffset'
      });
      var filterAmbientOffset = function () {
          return (!fieldAmbientMap.value && !fieldAmbientMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldAmbientOffset[0].parent,
          offset: fieldAmbientOffset,
          filter: filterAmbientOffset,
          path: 'data.aoMapOffset'
      });
      fieldAmbientOffset[0].parent.hidden = filterAmbientOffset();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:aoMapOffset', fieldAmbientOffset[0].parent.innerElement.firstChild.ui);

      // tiling
      var fieldAmbientTiling = editor.call('attributes:addField', {
          parent: panelAmbient,
          type: 'vec2',
          name: 'Tiling',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.aoMapTiling'
      });
      var filterAmbientTiling = function () {
          return (!fieldAmbientMap.value && !fieldAmbientMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldAmbientTiling[0].parent,
          tiling: fieldAmbientTiling,
          filter: filterAmbientTiling,
          path: 'data.aoMapTiling'
      });
      fieldAmbientTiling[0].parent.hidden = filterAmbientTiling();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:aoMapTiling', fieldAmbientTiling[0].parent.innerElement.firstChild.ui);

      // vertex color
      var fieldAmbientVertexColor = editor.call('attributes:addField', {
          parent: panelAmbient,
          name: 'Vertex Color',
          type: 'checkbox',
          link: assets,
          path: 'data.aoMapVertexColor'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:aoMapVertexColor', fieldAmbientVertexColor.parent.innerElement.firstChild.ui);

      // occludeSpecular
      var fieldOccludeSpecular = editor.call('attributes:addField', {
          parent: panelAmbient,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'Off' },
              { v: 1, t: 'Multiply' },
              { v: 2, t: 'Gloss Based' }
          ],
          name: 'Occlude Specular',
          link: assets,
          path: 'data.occludeSpecular'
      });
      fieldOccludeSpecular.parent.hidden = !fieldAmbientMap.value && !fieldAmbientMap.class.contains('null');
      // reference
      editor.call('attributes:reference:attach', 'asset:material:occludeSpecular', fieldOccludeSpecular.parent.innerElement.firstChild.ui);

      // color
      var fieldAmbientColor = editor.call('attributes:addField', {
          parent: panelAmbient,
          name: 'Color',
          type: 'rgb',
          link: assets,
          path: 'data.ambient'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:ambient', fieldAmbientColor.parent.innerElement.firstChild.ui);


      // tint
      var fieldAmbientTint = editor.call('attributes:addField', {
          panel: fieldAmbientColor.parent,
          type: 'checkbox',
          link: assets,
          path: 'data.ambientTint'
      });
      // label
      var labelAmbientTint = new ui.Label({ text: 'Tint' });
      labelAmbientTint.style.verticalAlign = 'top';
      labelAmbientTint.style.paddingRight = '12px';
      labelAmbientTint.style.fontSize = '12px';
      labelAmbientTint.style.lineHeight = '24px';
      fieldAmbientColor.parent.append(labelAmbientTint);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:ambientTint', labelAmbientTint);


      // diffuse
      var panelDiffuse = texturePanels.diffuse = editor.call('attributes:addPanel', {
          foldable: true,
          folded: panelState['diffuse'],
          name: 'Diffuse'
      });
      panelDiffuse.class.add('component');
      panelDiffuse.on('fold', function () { panelState['diffuse'] = true; });
      panelDiffuse.on('unfold', function () { panelState['diffuse'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:diffuseOverview', panelDiffuse, panelDiffuse.headerElement);

      // diffuse map
      var fieldDiffuseMapHover = handleTextureHover('diffuseMap');
      var fieldDiffuseMap = textureFields.diffuse = editor.call('attributes:addField', {
          parent: panelDiffuse,
          type: 'asset',
          kind: 'texture',
          name: 'Diffuse',
          link: assets,
          path: 'data.diffuseMap',
          over: fieldDiffuseMapHover.over,
          leave: fieldDiffuseMapHover.leave,
          onSet: function (asset, oldValues) {
              onTextureBulkSet(asset, oldValues, 'diffuse');
          }
      });
      fieldDiffuseMap.parent.class.add('channel');
      fieldDiffuseMap.on('change', function (value) {
          fieldDiffuseOffset[0].parent.hidden = filterDiffuseOffset();
          fieldDiffuseTiling[0].parent.hidden = filterDiffuseTiling();
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:diffuseMap', fieldDiffuseMap._label);

      // map uv
      var fieldDiffuseMapUV = editor.call('attributes:addField', {
          panel: fieldDiffuseMap.parent,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'UV0' },
              { v: 1, t: 'UV1' }
          ],
          link: assets,
          path: 'data.diffuseMapUv'
      });
      fieldDiffuseMapUV.flexGrow = 0;
      fieldDiffuseMapUV.element.parentNode.removeChild(fieldDiffuseMapUV.element);
      fieldDiffuseMap.parent.innerElement.querySelector('.top > .controls').appendChild(fieldDiffuseMapUV.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:diffuseMapUv', fieldDiffuseMapUV);

      // map channel
      var fieldDiffuseMapChannel = editor.call('attributes:addField', {
          panel: fieldDiffuseMap.parent,
          type: 'string',
          enum: {
              '': '...',
              'r': 'R',
              'g': 'G',
              'b': 'B',
              'a': 'A',
              'rgb': 'RGB'
          },
          link: assets,
          path: 'data.diffuseMapChannel'
      });
      fieldDiffuseMapChannel.element.parentNode.removeChild(fieldDiffuseMapChannel.element);
      fieldDiffuseMap.parent.innerElement.querySelector('.top > .ui-label').parentNode.appendChild(fieldDiffuseMapChannel.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:diffuseMapChannel', fieldDiffuseMapChannel);

      // offset
      var fieldDiffuseOffset = editor.call('attributes:addField', {
          parent: panelDiffuse,
          type: 'vec2',
          name: 'Offset',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.diffuseMapOffset'
      });
      var filterDiffuseOffset = function () {
          return (!fieldDiffuseMap.value && !fieldDiffuseMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldDiffuseOffset[0].parent,
          offset: fieldDiffuseOffset,
          filter: filterDiffuseOffset,
          path: 'data.diffuseMapOffset'
      });
      fieldDiffuseOffset[0].parent.hidden = filterDiffuseOffset();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:diffuseMapOffset', fieldDiffuseOffset[0].parent.innerElement.firstChild.ui);

      // tiling
      var fieldDiffuseTiling = editor.call('attributes:addField', {
          parent: panelDiffuse,
          type: 'vec2',
          name: 'Tiling',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.diffuseMapTiling'
      });
      var filterDiffuseTiling = function () {
          return (!fieldDiffuseMap.value && !fieldDiffuseMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldDiffuseTiling[0].parent,
          tiling: fieldDiffuseTiling,
          filter: filterDiffuseTiling,
          path: 'data.diffuseMapTiling'
      });
      fieldDiffuseTiling[0].parent.hidden = filterDiffuseTiling();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:diffuseMapTiling', fieldDiffuseTiling[0].parent.innerElement.firstChild.ui);

      // vertex color
      var fieldDiffuseVertexColor = editor.call('attributes:addField', {
          parent: panelDiffuse,
          name: 'Vertex Color',
          type: 'checkbox',
          link: assets,
          path: 'data.diffuseMapVertexColor'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:diffuseMapVertexColor', fieldDiffuseVertexColor.parent.innerElement.firstChild.ui);

      // color
      var fieldDiffuseColor = editor.call('attributes:addField', {
          parent: panelDiffuse,
          name: 'Color',
          type: 'rgb',
          link: assets,
          path: 'data.diffuse'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:diffuse', fieldDiffuseColor.parent.innerElement.firstChild.ui);

      // tint
      var fieldDiffuseTint = editor.call('attributes:addField', {
          panel: fieldDiffuseColor.parent,
          type: 'checkbox',
          link: assets,
          path: 'data.diffuseMapTint'
      });
      // label
      var labelDiffuseTint = new ui.Label({ text: 'Tint' });
      labelDiffuseTint.style.verticalAlign = 'top';
      labelDiffuseTint.style.paddingRight = '12px';
      labelDiffuseTint.style.fontSize = '12px';
      labelDiffuseTint.style.lineHeight = '24px';
      fieldDiffuseColor.parent.append(labelDiffuseTint);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:diffuseMapTint', labelDiffuseTint);



      // specular
      var panelSpecular = texturePanels.specular = texturePanels.metalness = texturePanels.gloss = editor.call('attributes:addPanel', {
          foldable: true,
          folded: panelState['specular'],
          name: 'Specular'
      });
      panelSpecular.class.add('component');
      panelSpecular.on('fold', function () { panelState['specular'] = true; });
      panelSpecular.on('unfold', function () { panelState['specular'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:specularOverview', panelSpecular, panelSpecular.headerElement);

      // use metalness
      var fieldUseMetalness = editor.call('attributes:addField', {
          parent: panelSpecular,
          type: 'checkbox',
          name: 'Use Metalness',
          link: assets,
          path: 'data.useMetalness'
      });
      fieldUseMetalness.on('change', function (value) {
          panelSpecularWorkflow.hidden = value || fieldUseMetalness.class.contains('null');
          panelMetalness.hidden = !value || fieldUseMetalness.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:useMetalness', fieldUseMetalness.parent.innerElement.firstChild.ui);

      var panelMetalness = editor.call('attributes:addPanel');
      panelMetalness.hidden = !fieldUseMetalness.value || fieldUseMetalness.class.contains('null');
      panelSpecular.append(panelMetalness);

      // metalness map
      var fieldMetalnessMapHover = handleTextureHover('metalnessMap');
      var fieldMetalnessMap = textureFields.metalness = editor.call('attributes:addField', {
          parent: panelMetalness,
          type: 'asset',
          kind: 'texture',
          name: 'Metalness',
          link: assets,
          path: 'data.metalnessMap',
          over: fieldMetalnessMapHover.over,
          leave: fieldMetalnessMapHover.leave,
          onSet: function (asset, oldValues) {
              onTextureBulkSet(asset, oldValues, 'metalness');
          }
      });
      fieldMetalnessMap.parent.class.add('channel');
      fieldMetalnessMap.on('change', function (value) {
          fieldMetalnessOffset[0].parent.hidden = filterMetalnessOffset();
          fieldMetalnessTiling[0].parent.hidden = filterMetalnessTiling();
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:metalnessMap', fieldMetalnessMap._label);

      // map uv
      var fieldMetalnessMapUV = editor.call('attributes:addField', {
          panel: fieldMetalnessMap.parent,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'UV0' },
              { v: 1, t: 'UV1' }
          ],
          link: assets,
          path: 'data.metalnessMapUv'
      });
      fieldMetalnessMapUV.flexGrow = 0;
      fieldMetalnessMapUV.element.parentNode.removeChild(fieldMetalnessMapUV.element);
      fieldMetalnessMap.parent.innerElement.querySelector('.top > .controls').appendChild(fieldMetalnessMapUV.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:metalnessMapUv', fieldMetalnessMapUV);

      // map channel
      var fieldMetalnessMapChannel = editor.call('attributes:addField', {
          panel: fieldMetalnessMap.parent,
          type: 'string',
          enum: {
              '': '...',
              'r': 'R',
              'g': 'G',
              'b': 'B',
              'a': 'A',
          },
          link: assets,
          path: 'data.metalnessMapChannel'
      });
      fieldMetalnessMapChannel.element.parentNode.removeChild(fieldMetalnessMapChannel.element);
      fieldMetalnessMap.parent.innerElement.querySelector('.top > .ui-label').parentNode.appendChild(fieldMetalnessMapChannel.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:metalnessMapChannel', fieldMetalnessMapChannel);

      // offset
      var fieldMetalnessOffset = editor.call('attributes:addField', {
          parent: panelMetalness,
          type: 'vec2',
          name: 'Offset',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.metalnessMapOffset'
      });
      var filterMetalnessOffset = function () {
          return (!fieldMetalnessMap.value && !fieldMetalnessMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldMetalnessOffset[0].parent,
          offset: fieldMetalnessOffset,
          filter: filterMetalnessOffset,
          path: 'data.metalnessMapOffset'
      });
      fieldMetalnessOffset[0].parent.hidden = filterMetalnessOffset();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:metalnessMapOffset', fieldMetalnessOffset[0].parent.innerElement.firstChild.ui);

      // tiling
      var fieldMetalnessTiling = editor.call('attributes:addField', {
          parent: panelMetalness,
          type: 'vec2',
          name: 'Tiling',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.metalnessMapTiling'
      });
      var filterMetalnessTiling = function () {
          return (!fieldMetalnessMap.value && !fieldMetalnessMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldMetalnessTiling[0].parent,
          tiling: fieldMetalnessTiling,
          filter: filterMetalnessTiling,
          path: 'data.metalnessMapTiling'
      });
      fieldMetalnessTiling[0].parent.hidden = filterMetalnessTiling();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:metalnessMapTiling', fieldMetalnessTiling[0].parent.innerElement.firstChild.ui);

      // vertex color
      var fieldMetalnessVertexColor = editor.call('attributes:addField', {
          parent: panelMetalness,
          name: 'Vertex Color',
          type: 'checkbox',
          link: assets,
          path: 'data.metalnessMapVertexColor'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:metalnessMapVertexColor', fieldMetalnessVertexColor.parent.innerElement.firstChild.ui);


      // metalness
      var fieldMetalness = editor.call('attributes:addField', {
          parent: panelMetalness,
          precision: 3,
          step: 0.05,
          min: 0,
          max: 1,
          type: 'number',
          name: 'Metalness',
          link: assets,
          path: 'data.metalness'
      });
      fieldMetalness.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'asset:material:metalness', fieldMetalness.parent.innerElement.firstChild.ui);

      // metalness slider
      var fieldMetalnessSlider = editor.call('attributes:addField', {
          panel: fieldMetalness.parent,
          precision: 3,
          step: 0.05,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: assets,
          path: 'data.metalness'
      });
      fieldMetalnessSlider.flexGrow = 4;


      // specular
      var panelSpecularWorkflow = editor.call('attributes:addPanel');
      panelSpecularWorkflow.hidden = fieldUseMetalness.value || fieldUseMetalness.class.contains('null');
      panelSpecular.append(panelSpecularWorkflow);

      // specular map
      var fieldSpecularMapHover = handleTextureHover('specularMap');
      var fieldSpecularMap = textureFields.specular = editor.call('attributes:addField', {
          parent: panelSpecularWorkflow,
          type: 'asset',
          kind: 'texture',
          name: 'Specular',
          link: assets,
          path: 'data.specularMap',
          over: fieldSpecularMapHover.over,
          leave: fieldSpecularMapHover.leave,
          onSet: function (asset, oldValues) {
              onTextureBulkSet(asset, oldValues, 'specular');
          }
      });
      fieldSpecularMap.parent.class.add('channel');
      fieldSpecularMap.on('change', function (value) {
          fieldSpecularOffset[0].parent.hidden = filterSpecularOffset();
          fieldSpecularTiling[0].parent.hidden = filterSpecularTiling();
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:specularMap', fieldSpecularMap._label);

      // map uv
      var fieldSpecularMapUV = editor.call('attributes:addField', {
          panel: fieldSpecularMap.parent,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'UV0' },
              { v: 1, t: 'UV1' }
          ],
          link: assets,
          path: 'data.specularMapUv'
      });
      fieldSpecularMapUV.flexGrow = 0;
      fieldSpecularMapUV.element.parentNode.removeChild(fieldSpecularMapUV.element);
      fieldSpecularMap.parent.innerElement.querySelector('.top > .controls').appendChild(fieldSpecularMapUV.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:specularMapUv', fieldSpecularMapUV);

      // map channel
      var fieldSpecularMapChannel = editor.call('attributes:addField', {
          panel: fieldSpecularMap.parent,
          type: 'string',
          enum: {
              '': '...',
              'r': 'R',
              'g': 'G',
              'b': 'B',
              'a': 'A',
              'rgb': 'RGB'
          },
          link: assets,
          path: 'data.specularMapChannel'
      });
      fieldSpecularMapChannel.element.parentNode.removeChild(fieldSpecularMapChannel.element);
      fieldSpecularMap.parent.innerElement.querySelector('.top > .ui-label').parentNode.appendChild(fieldSpecularMapChannel.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:specularMapChannel', fieldSpecularMapChannel);


      // offset
      var fieldSpecularOffset = editor.call('attributes:addField', {
          parent: panelSpecularWorkflow,
          type: 'vec2',
          name: 'Offset',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.specularMapOffset'
      });
      var filterSpecularOffset = function () {
          return (!fieldSpecularMap.value && !fieldSpecularMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldSpecularOffset[0].parent,
          offset: fieldSpecularOffset,
          filter: filterSpecularOffset,
          path: 'data.specularMapOffset'
      });
      fieldSpecularOffset[0].parent.hidden = filterSpecularOffset();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:specularMapOffset', fieldSpecularOffset[0].parent.innerElement.firstChild.ui);

      // tiling
      var fieldSpecularTiling = editor.call('attributes:addField', {
          parent: panelSpecularWorkflow,
          type: 'vec2',
          name: 'Tiling',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.specularMapTiling'
      });
      var filterSpecularTiling = function () {
          return (!fieldSpecularMap.value && !fieldSpecularMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldSpecularTiling[0].parent,
          tiling: fieldSpecularTiling,
          filter: filterSpecularTiling,
          path: 'data.specularMapTiling'
      });
      fieldSpecularTiling[0].parent.hidden = filterSpecularTiling();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:specularMapTiling', fieldSpecularTiling[0].parent.innerElement.firstChild.ui);

      // vertex color
      var fieldSpecularVertexColor = editor.call('attributes:addField', {
          parent: panelSpecularWorkflow,
          name: 'Vertex Color',
          type: 'checkbox',
          link: assets,
          path: 'data.specularMapVertexColor'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:specularMapVertexColor', fieldSpecularVertexColor.parent.innerElement.firstChild.ui);

      // color
      var fieldSpecularColor = editor.call('attributes:addField', {
          parent: panelSpecularWorkflow,
          name: 'Color',
          type: 'rgb',
          link: assets,
          path: 'data.specular'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:specular', fieldSpecularColor.parent.innerElement.firstChild.ui);

      // tint
      var fieldSpecularTint = editor.call('attributes:addField', {
          panel: fieldSpecularColor.parent,
          type: 'checkbox',
          link: assets,
          path: 'data.specularMapTint'
      });
      // label
      var labelSpecularTint = new ui.Label({ text: 'Tint' });
      labelSpecularTint.style.verticalAlign = 'top';
      labelSpecularTint.style.paddingRight = '12px';
      labelSpecularTint.style.fontSize = '12px';
      labelSpecularTint.style.lineHeight = '24px';
      fieldSpecularColor.parent.append(labelSpecularTint);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:specularMapTint', labelSpecularTint);


      // divider
      var divider = document.createElement('div');
      divider.classList.add('fields-divider');
      panelSpecular.append(divider);


      // map (gloss)
      var fieldGlossMapHover = handleTextureHover('glossMap');
      var fieldGlossMap = textureFields.gloss = editor.call('attributes:addField', {
          parent: panelSpecular,
          type: 'asset',
          kind: 'texture',
          name: 'Glossiness',
          link: assets,
          path: 'data.glossMap',
          over: fieldGlossMapHover.over,
          leave: fieldGlossMapHover.leave,
          onSet: function (asset, oldValues) {
              onTextureBulkSet(asset, oldValues, 'gloss');
          }
      });
      fieldGlossMap.parent.class.add('channel');
      fieldGlossMap.on('change', function (value) {
          fieldGlossOffset[0].parent.hidden = filterGlossOffset();
          fieldGlossTiling[0].parent.hidden = filterGlossTiling();
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:glossMap', fieldGlossMap._label);

      // map uv
      var fieldGlossMapUV = editor.call('attributes:addField', {
          panel: fieldGlossMap.parent,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'UV0' },
              { v: 1, t: 'UV1' }
          ],
          link: assets,
          path: 'data.glossMapUv'
      });
      fieldGlossMapUV.flexGrow = 0;
      fieldGlossMapUV.element.parentNode.removeChild(fieldGlossMapUV.element);
      fieldGlossMap.parent.innerElement.querySelector('.top > .controls').appendChild(fieldGlossMapUV.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:glossMapUv', fieldGlossMapUV);

      // map channel
      var fieldGlossMapChannel = editor.call('attributes:addField', {
          panel: fieldGlossMap.parent,
          type: 'string',
          enum: {
              '': '...',
              'r': 'R',
              'g': 'G',
              'b': 'B',
              'a': 'A'
          },
          link: assets,
          path: 'data.glossMapChannel'
      });
      fieldGlossMapChannel.element.parentNode.removeChild(fieldGlossMapChannel.element);
      fieldGlossMap.parent.innerElement.querySelector('.top > .ui-label').parentNode.appendChild(fieldGlossMapChannel.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:glossMapChannel', fieldGlossMapChannel);


      // offset
      var fieldGlossOffset = editor.call('attributes:addField', {
          parent: panelSpecular,
          type: 'vec2',
          name: 'Offset',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.glossMapOffset'
      });
      var filterGlossOffset = function () {
          return (!fieldGlossMap.value && !fieldGlossMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldGlossOffset[0].parent,
          offset: fieldGlossOffset,
          filter: filterGlossOffset,
          path: 'data.glossMapOffset'
      });
      fieldGlossOffset[0].parent.hidden = filterGlossOffset();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:glossMapOffset', fieldGlossOffset[0].parent.innerElement.firstChild.ui);

      // tiling
      var fieldGlossTiling = editor.call('attributes:addField', {
          parent: panelSpecular,
          type: 'vec2',
          name: 'Tiling',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.glossMapTiling'
      });
      var filterGlossTiling = function () {
          return (!fieldGlossMap.value && !fieldGlossMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldGlossTiling[0].parent,
          tiling: fieldGlossTiling,
          filter: filterGlossTiling,
          path: 'data.glossMapTiling'
      });
      fieldGlossTiling[0].parent.hidden = filterGlossTiling();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:glossMapTiling', fieldGlossTiling[0].parent.innerElement.firstChild.ui);

      // vertex color
      var fieldGlossVertexColor = editor.call('attributes:addField', {
          parent: panelSpecular,
          name: 'Vertex Color',
          type: 'checkbox',
          link: assets,
          path: 'data.glossMapVertexColor'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:glossMapVertexColor', fieldGlossVertexColor.parent.innerElement.firstChild.ui);

      // shininess
      var fieldShininess = editor.call('attributes:addField', {
          parent: panelSpecular,
          type: 'number',
          precision: 2,
          step: 0.5,
          min: 0,
          max: 100,
          name: 'Glossiness',
          link: assets,
          path: 'data.shininess'
      });
      fieldShininess.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'asset:material:shininess', fieldShininess.parent.innerElement.firstChild.ui);

      // shininess slider
      var fieldShininessSlider = editor.call('attributes:addField', {
          panel: fieldShininess.parent,
          precision: 2,
          step: 0.5,
          min: 0,
          max: 100,
          type: 'number',
          slider: true,
          link: assets,
          path: 'data.shininess'
      });
      fieldShininessSlider.flexGrow = 4;


      // emissive
      var panelEmissive = texturePanels.emissive = editor.call('attributes:addPanel', {
          foldable: true,
          folded: panelState['emissive'],
          name: 'Emissive'
      });
      panelEmissive.class.add('component');
      panelEmissive.on('fold', function () { panelState['emissive'] = true; });
      panelEmissive.on('unfold', function () { panelState['emissive'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:emissiveOverview', panelEmissive, panelEmissive.headerElement);

      // map
      var fieldEmissiveMapHover = handleTextureHover('emissiveMap');
      var fieldEmissiveMap = textureFields.emissive = editor.call('attributes:addField', {
          parent: panelEmissive,
          type: 'asset',
          kind: 'texture',
          name: 'Emissive',
          link: assets,
          path: 'data.emissiveMap',
          over: fieldEmissiveMapHover.over,
          leave: fieldEmissiveMapHover.leave,
          onSet: function (asset, oldValues) {
              onTextureBulkSet(asset, oldValues, 'emissive');
          }
      });
      fieldEmissiveMap.parent.class.add('channel');
      fieldEmissiveMap.on('change', function (value) {
          fieldEmissiveOffset[0].parent.hidden = filterEmissiveOffset();
          fieldEmissiveTiling[0].parent.hidden = filterEmissiveTiling();
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:emissiveMap', fieldEmissiveMap._label);

      // map uv
      var fieldEmissiveMapUV = editor.call('attributes:addField', {
          panel: fieldEmissiveMap.parent,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'UV0' },
              { v: 1, t: 'UV1' }
          ],
          link: assets,
          path: 'data.emissiveMapUv'
      });
      fieldEmissiveMapUV.flexGrow = 0;
      fieldEmissiveMapUV.element.parentNode.removeChild(fieldEmissiveMapUV.element);
      fieldEmissiveMap.parent.innerElement.querySelector('.top > .controls').appendChild(fieldEmissiveMapUV.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:emissiveMapUv', fieldEmissiveMapUV);

      // map channel
      var fieldEmissiveMapChannel = editor.call('attributes:addField', {
          panel: fieldEmissiveMap.parent,
          type: 'string',
          enum: {
              '': '...',
              'r': 'R',
              'g': 'G',
              'b': 'B',
              'a': 'A',
              'rgb': 'RGB'
          },
          link: assets,
          path: 'data.emissiveMapChannel'
      });
      fieldEmissiveMapChannel.element.parentNode.removeChild(fieldEmissiveMapChannel.element);
      fieldEmissiveMap.parent.innerElement.querySelector('.top > .ui-label').parentNode.appendChild(fieldEmissiveMapChannel.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:emissiveMapChannel', fieldEmissiveMapChannel);


      // offset
      var fieldEmissiveOffset = editor.call('attributes:addField', {
          parent: panelEmissive,
          type: 'vec2',
          name: 'Offset',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.emissiveMapOffset'
      });
      var filterEmissiveOffset = function () {
          return (!fieldEmissiveMap.value && !fieldEmissiveMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldEmissiveOffset[0].parent,
          offset: fieldEmissiveOffset,
          filter: filterEmissiveOffset,
          path: 'data.emissiveMapOffset'
      });
      fieldEmissiveOffset[0].parent.hidden = filterEmissiveOffset();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:emissiveMapOffset', fieldEmissiveOffset[0].parent.innerElement.firstChild.ui);

      // tiling
      var fieldEmissiveTiling = editor.call('attributes:addField', {
          parent: panelEmissive,
          type: 'vec2',
          name: 'Tiling',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.emissiveMapTiling'
      });
      var filterEmissiveTiling = function () {
          return (!fieldEmissiveMap.value && !fieldEmissiveMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldEmissiveTiling[0].parent,
          tiling: fieldEmissiveTiling,
          filter: filterEmissiveTiling,
          path: 'data.emissiveMapTiling'
      });
      fieldEmissiveTiling[0].parent.hidden = filterEmissiveTiling();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:emissiveMapTiling', fieldEmissiveTiling[0].parent.innerElement.firstChild.ui);

      // vertex color
      var fieldEmissiveVertexColor = editor.call('attributes:addField', {
          parent: panelEmissive,
          name: 'Vertex Color',
          type: 'checkbox',
          link: assets,
          path: 'data.emissiveMapVertexColor'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:emissiveMapVertexColor', fieldEmissiveVertexColor.parent.innerElement.firstChild.ui);

      // color
      var fieldEmissiveColor = editor.call('attributes:addField', {
          parent: panelEmissive,
          name: 'Color',
          type: 'rgb',
          link: assets,
          path: 'data.emissive'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:emissive', fieldEmissiveColor.parent.innerElement.firstChild.ui);

      // tint
      var fieldEmissiveTint = editor.call('attributes:addField', {
          panel: fieldEmissiveColor.parent,
          type: 'checkbox',
          link: assets,
          path: 'data.emissiveMapTint'
      });
      // label
      var labelEmissiveTint = new ui.Label({ text: 'Tint' });
      labelEmissiveTint.style.verticalAlign = 'top';
      labelEmissiveTint.style.paddingRight = '12px';
      labelEmissiveTint.style.fontSize = '12px';
      labelEmissiveTint.style.lineHeight = '24px';
      fieldEmissiveColor.parent.append(labelEmissiveTint);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:emissiveMapTint', labelEmissiveTint);



      // emissiveIntensity
      var fieldEmissiveIntensity = editor.call('attributes:addField', {
          parent: panelEmissive,
          name: 'Intensity',
          type: 'number',
          precision: 2,
          step: .1,
          min: 0,
          link: assets,
          path: 'data.emissiveIntensity'
      });
      fieldEmissiveIntensity.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'asset:material:emissiveIntensity', fieldEmissiveIntensity.parent.innerElement.firstChild.ui);

      // emissiveIntensity slider
      var fieldEmissiveIntensitySlider = editor.call('attributes:addField', {
          panel: fieldEmissiveIntensity.parent,
          precision: 2,
          step: .1,
          min: 0,
          max: 10,
          type: 'number',
          slider: true,
          link: assets,
          path: 'data.emissiveIntensity'
      });
      fieldEmissiveIntensitySlider.flexGrow = 4;


      // opacity
      var panelOpacity = texturePanels.opacity = editor.call('attributes:addPanel', {
          foldable: true,
          folded: panelState['opacity'],
          name: 'Opacity'
      });
      panelOpacity.class.add('component');
      panelOpacity.on('fold', function () { panelState['opacity'] = true; });
      panelOpacity.on('unfold', function () { panelState['opacity'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:opacityOverview', panelOpacity, panelOpacity.headerElement);

      var filterBlendFields = function (value) {
          fieldOpacityIntensity.parent.hidden = !(fieldBlendType.value === '' || [2, 4, 6].indexOf(fieldBlendType.value) !== -1);
          fieldOpacityOffset[0].parent.hidden = filterOpacityOffset();
          fieldOpacityTiling[0].parent.hidden = filterOpacityTiling();
          fieldAlphaTest.parent.hidden = !(fieldOpacityMap.class.contains('null') || fieldOpacityMap.value) && !(fieldOpacityVertexColor.value || fieldOpacityVertexColor.class.contains('null'));
      };

      // blend type
      var fieldBlendType = editor.call('attributes:addField', {
          parent: panelOpacity,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 3, t: 'None' },
              { v: 2, t: 'Alpha' },
              { v: 1, t: 'Additive' },
              { v: 6, t: 'Additive Alpha' },
              { v: 8, t: 'Screen' },
              { v: 4, t: 'Premultiplied Alpha' },
              { v: 5, t: 'Multiply' },
              { v: 7, t: 'Modulate 2x' },
              { v: 9, t: 'Min (Partial Support)' },
              { v: 10, t: 'Max (Partial Support)' },
          ],
          name: 'Blend Type',
          link: assets,
          path: 'data.blendType'
      });
      fieldBlendType.on('change', filterBlendFields);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:blendType', fieldBlendType.parent.innerElement.firstChild.ui);

      // map
      var fieldOpacityMapHover = handleTextureHover('opacityMap');
      var fieldOpacityMap = textureFields.opacity = editor.call('attributes:addField', {
          parent: panelOpacity,
          type: 'asset',
          kind: 'texture',
          name: 'Opacity',
          link: assets,
          path: 'data.opacityMap',
          over: fieldOpacityMapHover.over,
          leave: fieldOpacityMapHover.leave,
          onSet: function (asset, oldValues) {
              onTextureBulkSet(asset, oldValues, 'opacity');
          }
      });
      fieldOpacityMap.parent.class.add('channel');
      fieldOpacityMap.on('change', filterBlendFields);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:opacityMap', fieldOpacityMap._label);

      // map uv
      var fieldOpacityMapUV = editor.call('attributes:addField', {
          panel: fieldOpacityMap.parent,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'UV0' },
              { v: 1, t: 'UV1' }
          ],
          link: assets,
          path: 'data.opacityMapUv'
      });
      fieldOpacityMapUV.flexGrow = 0;
      fieldOpacityMapUV.element.parentNode.removeChild(fieldOpacityMapUV.element);
      fieldOpacityMap.parent.innerElement.querySelector('.top > .controls').appendChild(fieldOpacityMapUV.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:opacityMapUv', fieldOpacityMapUV);

      // map channel
      var fieldOpacityMapChannel = editor.call('attributes:addField', {
          panel: fieldOpacityMap.parent,
          type: 'string',
          enum: {
              '': '...',
              'r': 'R',
              'g': 'G',
              'b': 'B',
              'a': 'A'
          },
          link: assets,
          path: 'data.opacityMapChannel'
      });
      fieldOpacityMapChannel.element.parentNode.removeChild(fieldOpacityMapChannel.element);
      fieldOpacityMap.parent.innerElement.querySelector('.top > .ui-label').parentNode.appendChild(fieldOpacityMapChannel.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:opacityMapChannel', fieldOpacityMapChannel);

      // offset
      var fieldOpacityOffset = editor.call('attributes:addField', {
          parent: panelOpacity,
          type: 'vec2',
          name: 'Offset',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.opacityMapOffset'
      });
      var filterOpacityOffset = function () {
          return fieldOpacityMap.parent.hidden || (!fieldOpacityMap.value && !fieldOpacityMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldOpacityOffset[0].parent,
          offset: fieldOpacityOffset,
          filter: filterOpacityOffset,
          path: 'data.opacityMapOffset'
      });
      fieldOpacityOffset[0].parent.hidden = filterOpacityOffset();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:opacityMapOffset', fieldOpacityOffset[0].parent.innerElement.firstChild.ui);

      // tiling
      var fieldOpacityTiling = editor.call('attributes:addField', {
          parent: panelOpacity,
          type: 'vec2',
          name: 'Tiling',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.opacityMapTiling'
      });
      var filterOpacityTiling = function () {
          return fieldOpacityMap.parent.hidden || (!fieldOpacityMap.value && !fieldOpacityMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldOpacityTiling[0].parent,
          tiling: fieldOpacityTiling,
          filter: filterOpacityTiling,
          path: 'data.opacityMapTiling'
      });
      fieldOpacityTiling[0].parent.hidden = filterOpacityTiling();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:opacityMapTiling', fieldOpacityTiling[0].parent.innerElement.firstChild.ui);

      // vertex color
      var fieldOpacityVertexColor = editor.call('attributes:addField', {
          parent: panelOpacity,
          name: 'Vertex Color',
          type: 'checkbox',
          link: assets,
          path: 'data.opacityMapVertexColor'
      });
      fieldOpacityVertexColor.on('change', filterBlendFields);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:opacityMapVertexColor', fieldOpacityVertexColor.parent.innerElement.firstChild.ui);

      // intensity
      var fieldOpacityIntensity = editor.call('attributes:addField', {
          parent: panelOpacity,
          name: 'Intensity',
          type: 'number',
          precision: 3,
          step: .05,
          min: 0,
          max: 1,
          link: assets,
          path: 'data.opacity'
      });
      fieldOpacityIntensity.style.width = '32px';
      fieldOpacityIntensity.flexGrow = 1;
      // reference
      editor.call('attributes:reference:attach', 'asset:material:opacity', fieldOpacityIntensity.parent.innerElement.firstChild.ui);

      // intensity slider
      var fieldOpacityIntensitySlider = editor.call('attributes:addField', {
          panel: fieldOpacityIntensity.parent,
          precision: 3,
          step: .05,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: assets,
          path: 'data.opacity'
      });
      fieldOpacityIntensitySlider.flexGrow = 4;

      // alphaTest
      var fieldAlphaTest = editor.call('attributes:addField', {
          parent: panelOpacity,
          name: 'Alpha Test',
          type: 'number',
          precision: 3,
          step: .05,
          min: 0,
          max: 1,
          link: assets,
          path: 'data.alphaTest'
      });
      fieldAlphaTest.style.width = '32px';
      fieldAlphaTest.flexGrow = 1;
      // reference
      editor.call('attributes:reference:attach', 'asset:material:alphaTest', fieldAlphaTest.parent.innerElement.firstChild.ui);

      // alphaTest slider
      var fieldAlphaTestSlider = editor.call('attributes:addField', {
          panel: fieldAlphaTest.parent,
          precision: 3,
          step: .05,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: assets,
          path: 'data.alphaTest'
      });
      fieldAlphaTestSlider.flexGrow = 4;

      filterBlendFields();


      // alphaToCoverage
      var fieldAlphaToCoverage = editor.call('attributes:addField', {
          parent: panelOpacity,
          name: 'Alpha To Coverage',
          type: 'checkbox',
          link: assets,
          path: 'data.alphaToCoverage'
      });
      fieldAlphaToCoverage.element.previousSibling.style.width = 'auto';
      // reference
      editor.call('attributes:reference:attach', 'asset:material:alphaToCoverage', fieldAlphaToCoverage.parent.innerElement.firstChild.ui);


      // normals
      var panelNormal = texturePanels.normal = editor.call('attributes:addPanel', {
          foldable: true,
          folded: panelState['normals'],
          name: 'Normals'
      });
      panelNormal.class.add('component');
      panelNormal.on('fold', function () { panelState['normals'] = true; });
      panelNormal.on('unfold', function () { panelState['normals'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:normalOverview', panelNormal, panelNormal.headerElement);

      // map (normals)
      var fieldNormalMapHover = handleTextureHover('normalMap');
      var fieldNormalMap = textureFields.normal = editor.call('attributes:addField', {
          parent: panelNormal,
          type: 'asset',
          kind: 'texture',
          name: 'Normals',
          link: assets,
          path: 'data.normalMap',
          over: fieldNormalMapHover.over,
          leave: fieldNormalMapHover.leave,
          onSet: function (asset, oldValues) {
              onTextureBulkSet(asset, oldValues, 'normal');
          }
      });
      fieldNormalMap.on('change', function (value) {
          fieldNormalsOffset[0].parent.hidden = filterNormalOffset();
          fieldNormalsTiling[0].parent.hidden = filterNormalTiling();
          fieldBumpiness.parent.hidden = !value && !this.class.contains('null');
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:normalMap', fieldNormalMap._label);

      // map uv
      var fieldNormalMapUV = editor.call('attributes:addField', {
          panel: fieldNormalMap.parent,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'UV0' },
              { v: 1, t: 'UV1' }
          ],
          link: assets,
          path: 'data.normalMapUv'
      });
      fieldNormalMapUV.flexGrow = 0;
      fieldNormalMapUV.element.parentNode.removeChild(fieldNormalMapUV.element);
      fieldNormalMap.parent.innerElement.querySelector('.top > .controls').appendChild(fieldNormalMapUV.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:normalMapUv', fieldNormalMapUV);


      // offset
      var fieldNormalsOffset = editor.call('attributes:addField', {
          parent: panelNormal,
          type: 'vec2',
          name: 'Offset',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.normalMapOffset'
      });
      var filterNormalOffset = function () {
          return (!fieldNormalMap.value && !fieldNormalMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldNormalsOffset[0].parent,
          offset: fieldNormalsOffset,
          filter: filterNormalOffset,
          path: 'data.normalMapOffset'
      });
      fieldNormalsOffset[0].parent.hidden = filterNormalOffset();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:normalMapOffset', fieldNormalsOffset[0].parent.innerElement.firstChild.ui);

      // tiling
      var fieldNormalsTiling = editor.call('attributes:addField', {
          parent: panelNormal,
          type: 'vec2',
          name: 'Tiling',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.normalMapTiling'
      });
      var filterNormalTiling = function () {
          return (!fieldNormalMap.value && !fieldNormalMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldNormalsTiling[0].parent,
          tiling: fieldNormalsTiling,
          filter: filterNormalTiling,
          path: 'data.normalMapTiling'
      });
      fieldNormalsTiling[0].parent.hidden = filterNormalTiling();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:normalMapTiling', fieldNormalsTiling[0].parent.innerElement.firstChild.ui);


      // bumpiness
      var fieldBumpiness = editor.call('attributes:addField', {
          parent: panelNormal,
          name: 'Bumpiness',
          type: 'number',
          precision: 3,
          step: .05,
          min: 0,
          max: 2,
          link: assets,
          path: 'data.bumpMapFactor'
      });
      fieldBumpiness.parent.hidden = !fieldNormalMap.value && !fieldNormalMap.class.contains('null');
      fieldBumpiness.style.width = '32px';
      fieldBumpiness.flexGrow = 1;
      // reference
      editor.call('attributes:reference:attach', 'asset:material:bumpiness', fieldBumpiness.parent.innerElement.firstChild.ui);

      // bumpiness slider
      var fieldBumpinessSlider = editor.call('attributes:addField', {
          panel: fieldBumpiness.parent,
          precision: 3,
          step: .05,
          min: 0,
          max: 2,
          type: 'number',
          slider: true,
          link: assets,
          path: 'data.bumpMapFactor'
      });
      fieldBumpinessSlider.flexGrow = 4;


      // parallax
      var panelParallax = texturePanels.height = editor.call('attributes:addPanel', {
          foldable: true,
          folded: panelState['height'],
          name: 'Parallax'
      });
      panelParallax.class.add('component');
      panelParallax.on('fold', function () { panelState['height'] = true; });
      panelParallax.on('unfold', function () { panelState['height'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:parallaxOverview', panelParallax, panelParallax.headerElement);

      // height map
      var fieldHeightMapHover = handleTextureHover('heightMap');
      var fieldHeightMap = textureFields.height = editor.call('attributes:addField', {
          parent: panelParallax,
          type: 'asset',
          kind: 'texture',
          name: 'Heightmap',
          link: assets,
          path: 'data.heightMap',
          over: fieldHeightMapHover.over,
          leave: fieldHeightMapHover.leave,
          onSet: function (asset, oldValues) {
              onTextureBulkSet(asset, oldValues, 'height');
          }
      });
      fieldHeightMap.parent.class.add('channel');
      fieldHeightMap.on('change', function (value) {
          fieldHeightMapOffset[0].parent.hidden = filterHeightMapOffset();
          fieldHeightMapTiling[0].parent.hidden = filterHeightMapTiling();
          fieldHeightMapFactor.parent.hidden = !value;
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:heightMap', fieldHeightMap._label);

      // map uv
      var fieldHeightMapUV = editor.call('attributes:addField', {
          panel: fieldHeightMap.parent,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'UV0' },
              { v: 1, t: 'UV1' }
          ],
          link: assets,
          path: 'data.heightMapUv'
      });
      fieldHeightMapUV.flexGrow = 0;
      fieldHeightMapUV.element.parentNode.removeChild(fieldHeightMapUV.element);
      fieldHeightMap.parent.innerElement.querySelector('.top > .controls').appendChild(fieldHeightMapUV.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:heightMapUv', fieldHeightMapUV);

      // map channel
      var fieldHeightMapChannel = editor.call('attributes:addField', {
          panel: fieldHeightMap.parent,
          type: 'string',
          enum: {
              '': '...',
              'r': 'R',
              'g': 'G',
              'b': 'B',
              'a': 'A'
          },
          link: assets,
          path: 'data.heightMapChannel'
      });
      fieldHeightMapChannel.element.parentNode.removeChild(fieldHeightMapChannel.element);
      fieldHeightMap.parent.innerElement.querySelector('.top > .ui-label').parentNode.appendChild(fieldHeightMapChannel.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:heightMapChannel', fieldHeightMapChannel);


      // offset
      var fieldHeightMapOffset = editor.call('attributes:addField', {
          parent: panelParallax,
          type: 'vec2',
          name: 'Offset',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.heightMapOffset'
      });
      var filterHeightMapOffset = function () {
          return fieldHeightMap.parent.hidden || (!fieldHeightMap.value && !fieldHeightMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldHeightMapOffset[0].parent,
          offset: fieldHeightMapOffset,
          filter: filterHeightMapOffset,
          path: 'data.heightMapOffset'
      });
      fieldHeightMapOffset[0].parent.hidden = filterHeightMapOffset();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:heightMapOffset', fieldHeightMapOffset[0].parent.innerElement.firstChild.ui);

      // tiling
      var fieldHeightMapTiling = editor.call('attributes:addField', {
          parent: panelParallax,
          type: 'vec2',
          name: 'Tiling',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.heightMapTiling'
      });
      var filterHeightMapTiling = function () {
          return fieldHeightMap.parent.hidden || (!fieldHeightMap.value && !fieldHeightMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldHeightMapTiling[0].parent,
          tiling: fieldHeightMapTiling,
          filter: filterHeightMapTiling,
          path: 'data.heightMapTiling'
      });
      fieldHeightMapTiling[0].parent.hidden = filterHeightMapTiling();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:heightMapTiling', fieldHeightMapTiling[0].parent.innerElement.firstChild.ui);


      // heightMapFactor
      var fieldHeightMapFactor = editor.call('attributes:addField', {
          parent: panelParallax,
          name: 'Strength',
          type: 'number',
          precision: 3,
          step: .05,
          min: 0,
          max: 2,
          link: assets,
          path: 'data.heightMapFactor'
      });
      fieldHeightMapFactor.parent.hidden = fieldHeightMap.parent.hidden;
      fieldHeightMapFactor.style.width = '32px';
      fieldHeightMapFactor.flexGrow = 1;
      // reference
      editor.call('attributes:reference:attach', 'asset:material:bumpiness', fieldHeightMapFactor.parent.innerElement.firstChild.ui);

      // heightMapFactor slider
      var fieldHeightMapFactorSlider = editor.call('attributes:addField', {
          panel: fieldHeightMapFactor.parent,
          precision: 3,
          step: .05,
          min: 0,
          max: 2,
          type: 'number',
          slider: true,
          link: assets,
          path: 'data.heightMapFactor'
      });
      fieldHeightMapFactorSlider.flexGrow = 4;


      // reflection
      var panelReflection = texturePanels.reflection = texturePanels.refraction = texturePanels.sphere = editor.call('attributes:addPanel', {
          foldable: true,
          folded: panelState['environment'],
          name: 'Environment'
      });
      panelReflection.class.add('component');
      panelReflection.on('fold', function () { panelState['environment'] = true; });
      panelReflection.on('unfold', function () { panelState['environment'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:environmentOverview', panelReflection, panelReflection.headerElement);
      // filter
      var filterReflectionMaps = function () {
          fieldReflectionCubeMap.parent.hidden = !fieldReflectionCubeMap.value && !fieldReflectionCubeMap.class.contains('null') && (fieldReflectionSphere.value || fieldReflectionSphere.class.contains('null'));
          fieldReflectionSphere.parent.hidden = !fieldReflectionSphere.value && !fieldReflectionSphere.class.contains('null') && (fieldReflectionCubeMap.value || fieldReflectionCubeMap.class.contains('null'));
      };
      // spheremap
      var fieldReflectionSphereHover = handleTextureHover('sphereMap');
      var fieldReflectionSphere = textureFields.sphere = editor.call('attributes:addField', {
          parent: panelReflection,
          type: 'asset',
          kind: 'texture',
          name: 'Sphere Map',
          link: assets,
          path: 'data.sphereMap',
          over: fieldReflectionSphereHover.over,
          leave: fieldReflectionSphereHover.leave
      });
      fieldReflectionSphere.on('change', filterReflectionMaps);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:sphereMap', fieldReflectionSphere._label);

      // cubemap
      var fieldReflectionCubeMap = editor.call('attributes:addField', {
          parent: panelReflection,
          type: 'asset',
          kind: 'cubemap',
          name: 'Cube Map',
          link: assets,
          path: 'data.cubeMap'
      });
      fieldReflectionCubeMap.on('change', filterReflectionMaps);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:cubeMap', fieldReflectionCubeMap._label);

      // reflectivity
      var fieldReflectionStrength = editor.call('attributes:addField', {
          parent: panelReflection,
          type: 'number',
          precision: 3,
          step: 0.01,
          min: 0,
          name: 'Reflectivity',
          link: assets,
          path: 'data.reflectivity'
      });
      fieldReflectionStrength.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'asset:material:reflectivity', fieldReflectionStrength.parent.innerElement.firstChild.ui);

      // reflectivity slider
      var fieldReflectionStrengthSlider = editor.call('attributes:addField', {
          panel: fieldReflectionStrength.parent,
          precision: 3,
          step: .01,
          min: 0,
          max: 8,
          type: 'number',
          slider: true,
          link: assets,
          path: 'data.reflectivity'
      });
      fieldReflectionStrengthSlider.flexGrow = 4;


      // refraction
      var fieldRefraction = editor.call('attributes:addField', {
          parent: panelReflection,
          type: 'number',
          precision: 3,
          step: 0.01,
          min: 0,
          max: 1,
          name: 'Refraction',
          link: assets,
          path: 'data.refraction'
      });
      fieldRefraction.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'asset:material:refraction', fieldRefraction.parent.innerElement.firstChild.ui);

      // reflectivity slider
      var fieldRefractionSlider = editor.call('attributes:addField', {
          panel: fieldRefraction.parent,
          precision: 3,
          step: .01,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: assets,
          path: 'data.refraction'
      });
      fieldRefractionSlider.flexGrow = 4;


      // refractionIndex
      var fieldRefractionIndex = editor.call('attributes:addField', {
          parent: panelReflection,
          type: 'number',
          precision: 3,
          step: 0.01,
          min: 0,
          max: 1,
          name: 'Index of Refraction',
          link: assets,
          path: 'data.refractionIndex'
      });
      fieldRefractionIndex.style.width = '32px';
      // reference
      editor.call('attributes:reference:attach', 'asset:material:refractionIndex', fieldRefractionIndex.parent.innerElement.firstChild.ui);

      // reflectivity slider
      var fieldRefractionIndexSlider = editor.call('attributes:addField', {
          panel: fieldRefractionIndex.parent,
          precision: 3,
          step: .01,
          min: 0,
          max: 1,
          type: 'number',
          slider: true,
          link: assets,
          path: 'data.refractionIndex'
      });
      fieldRefractionIndexSlider.flexGrow = 4;


      // divider
      var divider = document.createElement('div');
      divider.classList.add('fields-divider');
      panelReflection.append(divider);


      // cubemap projection
      var fieldReflectionCubeMapProjection = editor.call('attributes:addField', {
          parent: panelReflection,
          name: 'Projection',
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'Normal' },
              { v: 1, t: 'Box' }
          ],
          link: assets,
          path: 'data.cubeMapProjection'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:cubeMapProjection', fieldReflectionCubeMapProjection.parent.innerElement.firstChild.ui);

      // cubemap projection center
      var fieldReflectionCubeMapProjectionBoxCenter = editor.call('attributes:addField', {
          parent: panelReflection,
          placeholder: ['x', 'y', 'z'],
          name: 'Center',
          type: 'vec3',
          link: assets,
          path: 'data.cubeMapProjectionBox.center'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:cubeMapProjectionBoxCenter', fieldReflectionCubeMapProjectionBoxCenter[0].parent.innerElement.firstChild.ui);

      // cubemap projection halfExtents
      var fieldReflectionCubeMapProjectionBoxHalfExtents = editor.call('attributes:addField', {
          parent: panelReflection,
          placeholder: ['w', 'h', 'd'],
          name: 'Half Extents',
          type: 'vec3',
          link: assets,
          path: 'data.cubeMapProjectionBox.halfExtents'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:cubeMapProjectionBoxHalfExtents', fieldReflectionCubeMapProjectionBoxHalfExtents[0].parent.innerElement.firstChild.ui);


      var onCubemapProjectionCheck = function () {
          fieldReflectionCubeMapProjection.parent.hidden = !fieldReflectionCubeMap.value;
          fieldReflectionCubeMapProjectionBoxCenter[0].parent.hidden = fieldReflectionCubeMapProjection.parent.hidden || fieldReflectionCubeMapProjection.value === 0 || fieldReflectionCubeMapProjection.class.contains('null');
          fieldReflectionCubeMapProjectionBoxHalfExtents[0].parent.hidden = fieldReflectionCubeMapProjectionBoxCenter[0].parent.hidden;
      };
      onCubemapProjectionCheck();
      fieldReflectionCubeMapProjection.on('change', onCubemapProjectionCheck);
      fieldReflectionCubeMap.on('change', onCubemapProjectionCheck);

      filterReflectionMaps();


      // lightmap
      var panelLightMap = texturePanels.light = editor.call('attributes:addPanel', {
          foldable: true,
          folded: panelState['light'],
          name: 'LightMap'
      });
      panelLightMap.class.add('component');
      panelLightMap.on('fold', function () { panelState['light'] = true; });
      panelLightMap.on('unfold', function () { panelState['light'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:lightMapOverview', panelLightMap, panelLightMap.headerElement);

      // map
      var fieldLightMapHover = handleTextureHover('lightMap');
      var fieldLightMap = textureFields.light = editor.call('attributes:addField', {
          parent: panelLightMap,
          type: 'asset',
          kind: 'texture',
          name: 'Lightmap',
          link: assets,
          path: 'data.lightMap',
          over: fieldLightMapHover.over,
          leave: fieldLightMapHover.leave,
          onSet: function (asset, oldValues) {
              onTextureBulkSet(asset, oldValues, 'light');
          }
      });
      fieldLightMap.parent.class.add('channel');
      fieldLightMap.on('change', function (value) {
          fieldLightMapOffset[0].parent.hidden = filterLightMapOffset();
          fieldLightMapTiling[0].parent.hidden = filterLightMapTiling();
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:lightMap', fieldLightMap._label);

      // map uv
      var fieldLightMapUV = editor.call('attributes:addField', {
          panel: fieldLightMap.parent,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'UV0' },
              { v: 1, t: 'UV1' }
          ],
          link: assets,
          path: 'data.lightMapUv'
      });
      fieldLightMapUV.flexGrow = 0;
      fieldLightMapUV.element.parentNode.removeChild(fieldLightMapUV.element);
      fieldLightMap.parent.innerElement.querySelector('.top > .controls').appendChild(fieldLightMapUV.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:lightMapUv', fieldLightMapUV);

      // map channel
      var fieldLightMapChannel = editor.call('attributes:addField', {
          panel: fieldLightMap.parent,
          type: 'string',
          enum: {
              '': '...',
              'r': 'R',
              'g': 'G',
              'b': 'B',
              'a': 'A',
              'rgb': 'RGB'
          },
          link: assets,
          path: 'data.lightMapChannel'
      });
      fieldLightMapChannel.element.parentNode.removeChild(fieldLightMapChannel.element);
      fieldLightMap.parent.innerElement.querySelector('.top > .ui-label').parentNode.appendChild(fieldLightMapChannel.element);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:lightMapChannel', fieldLightMapChannel);


      // offset
      var fieldLightMapOffset = editor.call('attributes:addField', {
          parent: panelLightMap,
          type: 'vec2',
          name: 'Offset',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.lightMapOffset'
      });
      var filterLightMapOffset = function () {
          return fieldLightMap.parent.hidden || (!fieldLightMap.value && !fieldLightMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldLightMapOffset[0].parent,
          offset: fieldLightMapOffset,
          filter: filterLightMapOffset,
          path: 'data.lightMapOffset'
      });
      fieldLightMapOffset[0].parent.hidden = filterLightMapOffset();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:lightMapOffset', fieldLightMapOffset[0].parent.innerElement.firstChild.ui);

      // tiling
      var fieldLightMapTiling = editor.call('attributes:addField', {
          parent: panelLightMap,
          type: 'vec2',
          name: 'Tiling',
          placeholder: ['U', 'V'],
          link: assets,
          path: 'data.lightMapTiling'
      });
      var filterLightMapTiling = function () {
          return fieldLightMap.parent.hidden || (!fieldLightMap.value && !fieldLightMap.class.contains('null')) || fieldTilingOffset.value;
      };
      tilingOffsetFields.push({
          element: fieldLightMapTiling[0].parent,
          tiling: fieldLightMapTiling,
          filter: filterLightMapTiling,
          path: 'data.lightMapTiling'
      });
      fieldLightMapTiling[0].parent.hidden = filterLightMapTiling();
      // reference
      editor.call('attributes:reference:attach', 'asset:material:lightMapTiling', fieldLightMapTiling[0].parent.innerElement.firstChild.ui);

      // vertex color
      var fieldLightVertexColor = editor.call('attributes:addField', {
          parent: panelLightMap,
          name: 'Vertex Color',
          type: 'checkbox',
          link: assets,
          path: 'data.lightMapVertexColor'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:lightMapVertexColor', fieldLightVertexColor.parent.innerElement.firstChild.ui);

      // render states
      var panelRenderStates = texturePanels.states = editor.call('attributes:addPanel', {
          foldable: true,
          folded: panelState['states'],
          name: 'Other'
      });
      panelRenderStates.class.add('component');
      panelRenderStates.on('fold', function () { panelState['states'] = true; });
      panelRenderStates.on('unfold', function () { panelState['states'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:other', panelRenderStates, panelRenderStates.headerElement);


      // depth
      var fieldDepthTest = editor.call('attributes:addField', {
          parent: panelRenderStates,
          type: 'checkbox',
          name: 'Depth',
          link: assets,
          path: 'data.depthTest'
      });
      // label
      var label = new ui.Label({ text: 'Test' });
      label.style.verticalAlign = 'top';
      label.style.paddingRight = '12px';
      label.style.fontSize = '12px';
      label.style.lineHeight = '24px';
      fieldDepthTest.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:depthTest', label);


      // depthWrite
      var fieldDepthWrite = editor.call('attributes:addField', {
          panel: fieldDepthTest.parent,
          type: 'checkbox',
          link: assets,
          path: 'data.depthWrite'
      })
      // label
      var label = new ui.Label({ text: 'Write' });
      label.style.verticalAlign = 'top';
      label.style.fontSize = '12px';
      label.style.lineHeight = '24px';
      fieldDepthTest.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:depthWrite', label);


      // culling
      var fieldCull = editor.call('attributes:addField', {
          parent: panelRenderStates,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 0, t: 'None' },
              { v: 1, t: 'Back Faces' },
              { v: 2, t: 'Front Faces' }
          ],
          name: 'Cull Mode',
          link: assets,
          path: 'data.cull'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:material:cull', fieldCull.parent.innerElement.firstChild.ui);


      // useFog
      var fieldUseFog = editor.call('attributes:addField', {
          parent: panelRenderStates,
          type: 'checkbox',
          name: 'Use',
          link: assets,
          path: 'data.useFog'
      });
      // label
      var label = new ui.Label({ text: 'Fog' });
      label.style.verticalAlign = 'top';
      label.style.paddingRight = '12px';
      label.style.fontSize = '12px';
      label.style.lineHeight = '24px';
      fieldUseFog.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:useFog', fieldUseFog.parent.innerElement.firstChild.ui);

      // useLighting
      var fieldUseLighting = editor.call('attributes:addField', {
          panel: fieldUseFog.parent,
          type: 'checkbox',
          link: assets,
          path: 'data.useLighting'
      });
      // label
      var label = new ui.Label({ text: 'Lighting' });
      label.style.verticalAlign = 'top';
      label.style.fontSize = '12px';
      label.style.lineHeight = '24px';
      fieldUseLighting.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:useLighting', fieldUseLighting.parent.innerElement.firstChild.ui);


      // useSkybox
      var fieldUseLighting = editor.call('attributes:addField', {
          parent: panelRenderStates,
          type: 'checkbox',
          name: ' ',
          link: assets,
          path: 'data.useSkybox'
      });
      // label
      var label = new ui.Label({ text: 'Skybox' });
      label.style.verticalAlign = 'top';
      label.style.paddingRight = '12px';
      label.style.fontSize = '12px';
      label.style.lineHeight = '24px';
      fieldUseLighting.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:useSkybox', fieldUseLighting.parent.innerElement.firstChild.ui);

      // useGammaTonemap
      var fieldUseGammaTonemap = editor.call('attributes:addField', {
          panel: fieldUseLighting.parent,
          type: 'checkbox',
          link: assets,
          path: 'data.useGammaTonemap'
      });
      // label
      var label = new ui.Label({ text: 'Gamma & Tonemap' });
      label.style.verticalAlign = 'top';
      label.style.fontSize = '12px';
      label.style.lineHeight = '24px';
      fieldUseGammaTonemap.parent.append(label);
      // reference
      editor.call('attributes:reference:attach', 'asset:material:useGammaTonemap', fieldUseGammaTonemap.parent.innerElement.firstChild.ui);


      // attach change event on tiling / offset fields
      // to set initial value if it doesn't exist
      tilingOffsetFields.forEach(function (item) {
          var field = item.tiling || item.offset;
          var onChange = function () {
              var path = item.path;
              for (var i = 0, len = assets.length; i < len; i++) {
                  if (missingPaths[assets[i].get('id') + '.' + path]) {
                      assets[i].set(path, [field[0].value, field[1].value]);
                      delete missingPaths[assets[i].get('id') + '.' + path];
                  }
              }
          };

          // make sure our change event is first otherwise
          // sharedb will complain that we can't insert a value on
          // a list that does not exist
          field[0]._events.change.splice(0, 0, onChange);
          field[1]._events.change.splice(0, 0, onChange);
      });
  });
});


/* editor/attributes/assets/attributes-asset-model.js */
editor.once('load', function() {
  'use strict';

  var panelNodes = null;

  editor.method('attributes:asset:model:nodesPanel', function () {
      return panelNodes;
  });

  var panelToggles = {
      'meta': true,
      'pipeline': true,
      'nodes': false
  };

  editor.on('attributes:inspect[asset]', function(assets) {
      for(var i = 0; i < assets.length; i++) {
          if (assets[i].get('type') !== 'model' || assets[i].get('source'))
              return;
      }

      if (assets.length > 1)
          editor.call('attributes:header', assets.length + ' Models');

      var events = [ ];

      var nodesTemplate;
      if (assets.length === 1 && assets[0]._loading && assets[0]._hash !== assets[0].get('file.hash')) {
          assets[0]._loading = 0;
          // assets[0]._uv1 = false;
          assets[0]._nodes = null;
      }

      // load data
      var loadingData = false;
      var loadData = function() {
          if (assets.length !== 1 || assets[0]._loading)
              return;

          assets[0]._hash = assets[0].get('file.hash');
          assets[0]._loading = 1;
          // assets[0]._uv1 = false;
          assets[0]._nodes = null;
          loading.hidden = false;

          Ajax
          .get('{{url.home}}' + assets[0].get('file.url'))
          .on('load', function(status, data) {
              assets[0]._loading = 2;

              autoUnwrap.enabled = true;

              assets[0]._nodes = [ ];
              for(var i = 0; i < data.model.meshInstances.length; i++)
                  assets[0]._nodes[i] = data.model.nodes[data.model.meshInstances[i].node].name;

              if (nodesTemplate)
                  nodesTemplate();

              loading.progress = 1;
          })
          .on('progress', function(progress) {
              loading.progress = 0.1 + progress * 0.8;
          })
          .on('error', function() {
              loading.failed = true;

              var error = new ui.Label({ text: 'failed loading detailed data' });
              error.textContent = 'failed loading data';
              error.style.display = 'block';
              error.style.textAlign = 'center';
              error.style.fontWeight = '100';
              error.style.fontSize = '12px';
              error.style.color = '#f66';
              editor.call('attributes.rootPanel').append(error);

              loading.progress = 1;
          });

          loading.progress = 0.1;
      };

      // loading
      var loading
      if (assets.length === 1) {
          loading = editor.call('attributes:addField', {
              type: 'progress'
          });
          loading.on('progress:100', function() {
              this.hidden = true;
          });
          if (assets[0]._loading)
              loading.hidden = true;

          if (assets[0].has('file.url') && ! assets[0]._loading)
              loadData();

          events.push(assets[0].on('file.hash:set', function(value) {
              // do this in a timeout so that all the fields of the file entry
              // have a chance to be initialized - this is mainly a problem if you
              // select a model asset that has not finished importing yet
              setTimeout(function () {
                  assets[0]._loading = 0;
                  loadData();
              });
          }));
      }


      var panelMeta = editor.call('attributes:addPanel', {
          name: 'Meta'
      });
      panelMeta.class.add('component');
      panelMeta.foldable = true;
      panelMeta.folded = panelToggles['meta'];
      panelMeta.on('fold', function() {
          panelToggles['meta'] = true;
      });
      panelMeta.on('unfold', function() {
          panelToggles['meta'] = false;
      });

      var btnGetMeta = new ui.Button({
          text: 'Calculate Meta'
      });
      btnGetMeta.class.add('calculate-meta', 'large-with-icon');
      var btnGetMetaVisibility = function() {
          var visible = false;
          for(var i = 0; i < assets.length; i++) {
              if (! visible && (! assets[i].get('meta') || ! assets[i].has('meta.vertices')))
                  visible = true;
          }
          btnGetMeta.hidden = ! visible;
      };
      btnGetMeta.on('click', function() {
          if (! editor.call('permissions:write'))
              return;

          for(var i = 0; i < assets.length; i++) {
              if (assets[i].get('meta') && assets[i].has('meta.vertices'))
                  continue;

              editor.call('realtime:send', 'pipeline', {
                  name: 'meta',
                  id: assets[i].get('uniqueId')
              });
          }
          this.enabled = false;
      });
      panelMeta.append(btnGetMeta);

      btnGetMetaVisibility();
      for(var i = 0; i < assets.length; i++) {
          if (btnGetMeta.hidden && ! assets[i].get('meta'))
              btnGetMeta.hidden = false;

          events.push(assets[i].on('meta:set', function() {
              btnGetMetaVisibility();
          }));
          events.push(assets[i].on('meta:unset', function() {
              btnGetMeta.hidden = false;
          }));
      }

      var recalculateMeta = function(key) {
          var value = 0;
          var noValue = true;
          for(var i = 0; i < assets.length; i++) {
              if (! assets[i].has('meta.' + key))
                  continue;
              value += assets[i].get('meta.' + key);
              noValue = false;
          }
          if (noValue)
              metaFields[key].field.parent.hidden = true;
          else
              metaFields[key].field.parent.hidden = false;
          metaFields[key].field.value = noValue ? '' : value.toLocaleString();
      };

      var metaFields = {
          vertices: {
              title: 'Vertices',
          },
          triangles: {
              title: 'Triangles',
          },
          meshes: {
              title: 'Meshes',
          },
          meshInstances: {
              title: 'Mesh Instances',
          },
          nodes: {
              title: 'Nodes',
          },
          skins: {
              title: 'Skins',
          }
      };

      var keys = Object.keys(metaFields);

      var addMetaField = function(key) {
          metaFields[key].field = editor.call('attributes:addField', {
              parent: panelMeta,
              name: metaFields[key].title
          });
          recalculateMeta(key);

          for(var a = 0; a < assets.length; a++) {
              events.push(assets[a].on('meta:unset', function() {
                  recalculateMeta(key);
              }));
              events.push(assets[a].on('meta:set', function() {
                  recalculateMeta(key);
              }));
              events.push(assets[a].on('meta.' + key + ':set', function() {
                  recalculateMeta(key);
              }));
              events.push(assets[a].on('meta.' + key + ':unset', function() {
                  recalculateMeta(key);
              }));
          }
      };

      for(var i = 0; i < keys.length; i++) {
          if (! metaFields.hasOwnProperty(keys[i]))
              continue;

          addMetaField(keys[i]);
      }

      var calculateAttributes = function() {
          var attributes = { };
          for(var i = 0; i < assets.length; i++) {
              var attr = assets[i].get('meta.attributes');
              if (! attr)
                  continue;

              var keys = Object.keys(attr);
              for(var n = 0; n < keys.length; n++) {
                  if (! attr.hasOwnProperty(keys[n]))
                      continue;

                  attributes[keys[n]] = attributes[keys[n]] || 0;
                  attributes[keys[n]]++;
              }
          }

          var attributesValue = '';
          var keys = Object.keys(attributes);
          for(var i = 0; i < keys.length; i++) {
              if (! attributes.hasOwnProperty(keys[i]))
                  continue;

              if (attributesValue)
                  attributesValue += ', ';

              attributesValue += keys[i];

              if (attributes[keys[i]] !== assets.length)
                  attributesValue += '*';
          }

          fieldMetaAttributes.value = attributesValue;
          fieldMetaAttributes.parent.hidden = !attributesValue;
      };


      var fieldMetaAttributes = editor.call('attributes:addField', {
          parent: panelMeta,
          name: 'Attributes'
      });
      calculateAttributes();
      for(var i = 0; i < assets.length; i++)
          events.push(assets[i].on('meta:set', calculateAttributes));


      var panelPipeline = editor.call('attributes:addPanel', {
          name: 'Pipeline'
      });
      panelPipeline.class.add('component');
      panelPipeline.foldable = true;
      panelPipeline.folded = panelToggles['pipeline'];
      panelPipeline.on('fold', function() {
          panelToggles['pipeline'] = true;
      });
      panelPipeline.on('unfold', function() {
          panelToggles['pipeline'] = false;
      });


      var uv1Options = [ 'unavailable', 'available', 'various' ];
      var checkUV1 = function() {
          var uv1 = assets[0].has('meta.attributes.texCoord1') ? 1 : 0;
          for(var i = 1; i < assets.length; i++) {
              var t1 = assets[i].get('meta.attributes.texCoord1');

              if ((t1 ? 1 : 0) !== uv1) {
                  uv1 = 2;
                  break;
              }
          }
          fieldUV1.value = uv1Options[uv1];
      }

      var fieldUV1 = editor.call('attributes:addField', {
          parent: panelPipeline,
          name: 'UV1'
      });
      checkUV1();

      for(var i = 0; i < assets.length; i++) {
          events.push(assets[i].on('meta.attributes.texCoord1:set', checkUV1));
          events.push(assets[i].on('meta.attributes.texCoord1:unset', checkUV1));
      }

      // padding
      var fieldPadding = editor.call('attributes:addField', {
          parent: panelPipeline,
          name: 'Padding',
          type: 'number',
          value: 2.0,
          precision: 2
      });
      fieldPadding.style.width = '32px';

      // TODO
      // estimate good padding
      // padding = (2 / getResolutionFromArea(assetArea)) * 1024

      // unwrap
      var autoUnwrap = new ui.Button({
          text: 'Auto-Unwrap'
      });
      autoUnwrap.on('click', function() {
          if (! editor.call('permissions:write'))
              return;

          for(var i = 0; i < assets.length; i++) {
              editor.call('assets:model:unwrap', assets[i], {
                  padding: fieldPadding.value
              });
          }

          unwrapState();
      });
      autoUnwrap.class.add('generate-uv1');
      fieldPadding.parent.append(autoUnwrap);

      // unwrap progress
      var fieldUnwrapProgress = editor.call('attributes:addField', {
          parent: panelPipeline,
          name: 'Unwrapping',
      });
      var field = fieldUnwrapProgress;
      fieldUnwrapProgress = fieldUnwrapProgress.parent;
      field.destroy();
      fieldUnwrapProgress.hidden = editor.call('assets:model:unwrapping', assets[0])

      // unwrap progress
      var progressUnwrap = new ui.Progress();
      progressUnwrap.class.add('field-progress');
      fieldUnwrapProgress.append(progressUnwrap);

      // unwrap cancel
      var autoUnwrapCancel = new ui.Button({
          text: 'Cancel'
      });
      autoUnwrapCancel.on('click', function() {
          if (! editor.call('permissions:write'))
              return;

          for(var i = 0; i < assets.length; i++)
              editor.call('assets:model:unwrap:cancel', assets[i]);

          unwrapState();
      });
      autoUnwrapCancel.class.add('generate-uv1');
      fieldUnwrapProgress.append(autoUnwrapCancel);

      var unwrapState = function() {
          var worker = editor.call('assets:model:unwrapping', assets[0]);
          fieldUnwrapProgress.hidden = ! worker;
          fieldPadding.parent.hidden = ! fieldUnwrapProgress.hidden;

          if (worker)
              progressUnwrap.progress = worker.progress / 100;
      };
      unwrapState();

      events.push(editor.on('assets:model:unwrap', function(asset) {
          if (assets.indexOf(asset) === -1)
              return;

          unwrapState();
      }));
      events.push(editor.on('assets:model:unwrap:progress:' + assets[0].get('id'), function(progress) {
          progressUnwrap.progress = progress / 100;
      }));


      if (assets.length === 1 && assets[0].has('data.mapping') && assets[0].get('data.mapping').length) {
          var root = editor.call('attributes.rootPanel');

          var previewContainer = new pcui.Container();
          previewContainer.class.add('asset-preview-container');

          // preview
          var preview = document.createElement('canvas');
          var ctx = preview.getContext('2d');
          preview.width = 256;
          preview.height = 256;
          preview.classList.add('asset-preview', 'flipY');
          previewContainer.append(preview);

          var sx = 0, sy = 0, x = 0, y = 0, nx = 0, ny = 0;
          var dragging = false;
          var previewRotation = [ -15, 45 ];

          preview.addEventListener('mousedown', function(evt) {
              if (evt.button !== 0)
                  return;

              evt.preventDefault();
              evt.stopPropagation();

              sx = x = evt.clientX;
              sy = y = evt.clientY;

              dragging = true;
          }, false);

          var onMouseMove = function(evt) {
              if (! dragging)
                  return;

              nx = x - evt.clientX;
              ny = y - evt.clientY;
              x = evt.clientX;
              y = evt.clientY;

              queueRender();
          };

          var onMouseUp = function(evt) {
              if (! dragging)
                  return;

              if ((Math.abs(sx - x) + Math.abs(sy - y)) < 8) {
                  if (root.class.contains('large')) {
                      root.class.remove('large');
                  } else {
                      root.class.add('large');
                  }
              }

              previewRotation[0] = Math.max(-90, Math.min(90, previewRotation[0] + ((sy - y) * 0.3)));
              previewRotation[1] += (sx - x) * 0.3;
              sx = sy = x = y = 0;

              dragging = false;

              queueRender();
          };

          window.addEventListener('mousemove', onMouseMove, false);
          window.addEventListener('mouseup', onMouseUp, false);

          root.class.add('asset-preview');
          root.prepend(previewContainer);

          // rendering preview
          var renderQueued;

          var renderPreview = function () {
              if (renderQueued)
                  renderQueued = false;

              // render
              editor.call('preview:render', assets[0], previewContainer.width, previewContainer.height, preview, {
                  rotation: [ Math.max(-90, Math.min(90, previewRotation[0] + (sy - y) * 0.3)), previewRotation[1] + (sx - x) * 0.3 ]
              });
          };
          renderPreview();

          // queue up the rendering to prevent too oftern renders
          var queueRender = function() {
              if (renderQueued) return;
              renderQueued = true;
              requestAnimationFrame(renderPreview);
          };

          // render on resize
          var evtPanelResize = root.on('resize', queueRender);
          var evtSceneSettings = editor.on('preview:scene:changed', queueRender);

          // model resource loaded
          var watcher = editor.call('assets:model:watch', {
              asset: assets[0],
              autoLoad: true,
              callback: queueRender
          });

          // nodes panel
          panelNodes = editor.call('attributes:addPanel', {
              name: 'Mesh Instances'
          });
          panelNodes.class.add('component');
          panelNodes.flex = true;
          panelNodes.innerElement.style.flexDirection = 'column';
          panelNodes.foldable = true;
          panelNodes.folded = panelToggles['nodes'];
          panelNodes.on('fold', function() {
              panelToggles['nodes'] = true;
          });
          panelNodes.on('unfold', function() {
              panelToggles['nodes'] = false;
          });

          // reference
          editor.call('attributes:reference:attach', 'asset:model:meshInstances', panelNodes, panelNodes.headerElement);

          var nodeItems = [ ];

          var addField = function(ind) {
              var app = editor.call('viewport:app');
              if (! app) return; // webgl not available

              var engineAsset = app.assets.get(assets[0].get('id'));
              var valueBefore = null;

              nodeItems[ind] = editor.call('attributes:addField', {
                  parent: panelNodes,
                  type: 'asset',
                  kind: 'material',
                  name: '[' + ind + '] node',
                  link: assets[0],
                  path: 'data.mapping.' + ind + '.material',
                  over: function(type, data) {
                      valueBefore = assets[0].get('data.mapping.' + ind + '.material') || null;
                      if (engineAsset) {
                          engineAsset.data.mapping[ind].material = parseInt(data.id, 10);
                          engineAsset.fire('change', engineAsset, 'data', engineAsset.data, engineAsset.data);
                          editor.call('viewport:render');
                      }
                  },
                  leave: function() {
                      if (valueBefore) {
                          engineAsset.data.mapping[ind].material = valueBefore;
                          engineAsset.fire('change', engineAsset, 'data', engineAsset.data, engineAsset.data);
                          editor.call('viewport:render');
                      }
                  }
              });

              nodeItems[ind].parent.class.add('node-' + ind);

              nodeItems[ind].parent.on('click', function() {
                  this.class.remove('active');
              });

              nodeItems[ind].on('beforechange', function (id) {
                  nodeItems[ind].once('change', function () {
                      var history = assets[0].history.enabled;
                      assets[0].history.enabled = false;

                      var previous = assets[0].get('meta.userMapping.' + ind);
                      if (! assets[0].get('meta')) {
                          assets[0].set('meta', {
                              userMapping: {}
                          });
                      } else {
                          if (! assets[0].has('meta.userMapping'))
                              assets[0].set('meta.userMapping', {});
                      }

                      assets[0].set('meta.userMapping.' + ind, true);

                      assets[0].history.enabled = history;

                      var lastHistoryAction = editor.call('history:list')[editor.call('history:current')];
                      var undo = lastHistoryAction.undo;
                      var redo = lastHistoryAction.redo;

                      lastHistoryAction.undo = function () {
                          undo();

                          var item = editor.call('assets:get', assets[0].get('id'));
                          if (! item) return;

                          var history = item.history.enabled;
                          item.history.enabled = false;

                          if (! previous) {
                              item.unset('meta.userMapping.' + ind);

                              if (Object.keys(item.get('meta.userMapping')).length === 0) {
                                  item.unset('meta.userMapping');
                              }
                          }

                          item.history.enabled = history;
                      };

                      lastHistoryAction.redo = function () {
                          redo();

                          var item = editor.call('assets:get', assets[0].get('id'));
                          if (! item) return;

                          var history = item.history.enabled;
                          item.history.enabled = false;

                          if (! item.get('meta')) {
                              item.set('meta', {
                                  userMapping: {}
                              });
                          } else {
                              if (! item.has('meta.userMapping'))
                                  item.set('meta.userMapping', {});
                          }

                          item.set('meta.userMapping.' + ind, true);

                          item.history.enabled = history;
                      };
                  });
              });
          };

          // create node fields
          var mapping = assets[0].get('data.mapping');
          for(var i = 0; i < mapping.length; i++) {
              addField(i);
          }

          panelNodes.on('destroy', function () {
              root.class.remove('asset-preview', 'animate');

              editor.call('assets:model:unwatch', assets[0], watcher);

              evtSceneSettings.unbind();
              evtPanelResize.unbind();

              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);

              panelNodes = null;
          });

          // hide preview when asset info is hidden
          events.push(editor.once('attributes:assets:toggleInfo', function (toggle) {
              panelMeta.hidden = true;
              previewContainer.hidden = true;
              panelPipeline.hidden = true;

              root.class.remove('asset-preview', 'animate');
          }));

          // template nodes
          nodesTemplate = function() {
              if (! panelNodes)
                  return;

              panelNodes.header = 'Mesh Instances [' + assets[0]._nodes.length + ']'

              for(var i = 0; i < assets[0]._nodes.length; i++) {
                  if (! nodeItems[i])
                      continue;

                  nodeItems[i]._label.text = '[' + i + '] ' + assets[0]._nodes[i];
              }
          };

          if (assets[0]._nodes)
              // already loaded
              nodesTemplate();
      }

      panelMeta.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();
      });
  });
});


/* editor/attributes/assets/attributes-asset-scene.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length !== 1 || assets[0].get('type') !== 'scene' || ! assets[0].get('source'))
          return;

      var asset = assets[0];
      var events = [ ];

      // contents
      var panelContents = editor.call('attributes:addPanel', {
          name: 'Contents'
      });
      panelContents.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:scene:contents', panelContents, panelContents.headerElement);


      var labelEmptyMeta = new ui.Label({
          text: 'no contents information available'
      });
      labelEmptyMeta.hidden = !! asset.get('meta');
      panelContents.append(labelEmptyMeta);


      // meta
      var panelMeta = editor.call('attributes:addPanel');
      panelMeta.hidden = ! asset.get('meta');
      events.push(asset.on('meta:set', function() {
          panelMeta.hidden = false;
          labelEmptyMeta.hidden = true;
      }));
      events.push(asset.on('meta:unset', function() {
          panelMeta.hidden = true;
          labelEmptyMeta.hidden = false;
      }));
      panelContents.append(panelMeta);


      // animation
      var fieldAnimation = editor.call('attributes:addField', {
          parent: panelMeta,
          name: 'Animation'
      });
      var animationCheck = function(available) {
          if (available) {
              fieldAnimation.value = 'yes';
          } else {
              fieldAnimation.value = 'no';
          }
      };
      animationCheck(asset.get('meta.animation.available'));
      events.push(asset.on('meta.animation.available:set', animationCheck));


      // textures
      var fieldTextures = editor.call('attributes:addField', {
          parent: panelMeta,
          name: 'Textures',
          type: 'element',
          element: new ui.List()
      });
      fieldTextures.parent.class.add('field');
      fieldTextures.class.add('source-textures');
      fieldTextures.flexGrow = 1;
      fieldTextures.selectable = false;
      // no textures
      var fieldNoTextures = new ui.Label({
          text: 'no'
      });
      fieldNoTextures.class.add('no-data');
      fieldTextures.parent.appendBefore(fieldNoTextures, fieldTextures);
      // add all textures
      var addTextures = function(list) {
          fieldTextures.clear();
          for(var i = 0; i < list.length; i++) {
              var item = new ui.ListItem({
                  text: list[i].name
              });
              fieldTextures.append(item);
          }

          if (list.length) {
              fieldNoTextures.hidden = true;
              fieldTextures.hidden = false;
          } else {
              fieldTextures.hidden = true;
              fieldNoTextures.hidden = false;
          }
      };
      // already available
      var textures = asset.get('meta.textures');
      if (textures && textures.length) {
          addTextures(textures);
      } else {
          fieldTextures.hidden = true;
      }
      // might be set later
      events.push(asset.on('meta.textures:set', function() {
          addTextures(asset.get('meta.textures'));
      }));
      events.push(asset.on('meta.textures:unset', function() {
          fieldTextures.clear();
          fieldTextures.hidden = true;
          fieldNoTextures.hidden = false;
      }));


      // materials
      var fieldMaterials = editor.call('attributes:addField', {
          parent: panelMeta,
          name: 'Materials',
          type: 'element',
          element: new ui.List()
      });
      fieldMaterials.flexGrow = 1;
      fieldMaterials.selectable = false;
      // add all materials
      var addMaterials = function(list) {
          fieldMaterials.clear();
          for(var i = 0; i < list.length; i++) {
              var item = new ui.ListItem({
                  text: list[i].name
              });
              fieldMaterials.append(item);
          }
      };
      // already available
      var materials = asset.get('meta.materials');
      if (materials && materials.length)
          addMaterials(materials);
      // might be set/unset later
      events.push(asset.on('meta.materials:set', function(materials) {
          for(var i = 0; i < materials.length; i++)
              materials[i] = materials[i].json();

          addMaterials(materials);
      }));
      events.push(asset.on('meta.materials:unset', function() {
          fieldMaterials.clear();
      }));


      // clear up events
      panelContents.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();
      });
  });
});


/* editor/attributes/assets/attributes-asset-script.js */
editor.once('load', function() {
  'use strict';

  var legacyScripts = editor.call('settings:project').get('useLegacyScripts');


  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length !== 1 || assets[0].get('type') !== 'script' || assets[0].get('source'))
          return;

      var asset = assets[0];
      var events = [ ];

      // panel
      var panel = editor.call('attributes:assets:panel');

      if (! legacyScripts) {
          // scripts
          var panelScripts = editor.call('attributes:addPanel', {
              name: 'Scripts'
          });
          panelScripts.class.add('component', 'asset-script');




          // order
          var fieldOrder = editor.call('attributes:addField', {
              parent: panel,
              name: 'Loading Order'
          });
          var btnOrder = new ui.Button({
              text: 'Manage'
          });
          btnOrder.class.add('loading-order');
          var panelOrder = fieldOrder.parent;
          panelOrder.innerElement.removeChild(fieldOrder.element);
          panelOrder.append(btnOrder);
          btnOrder.on('click', function() {
              editor.call('selector:set', 'editorSettings', [ editor.call('settings:projectUser') ]);
              setTimeout(function() {
                  editor.call('editorSettings:panel:unfold', 'scripts-order');
              }, 0);
          });

          var preloadField = panel.innerElement.querySelector('.ui-panel.field-checkbox.preload');
          if (preloadField && preloadField.nextSibling) {
              fieldOrder.parent.parent.innerElement.removeChild(fieldOrder.parent.element);
              panel.innerElement.insertBefore(fieldOrder.parent.element, preloadField.nextSibling);
          }

          // reference
          editor.call('attributes:reference:attach', 'asset:script:order', fieldOrder.parent.innerElement.firstChild.ui);

          // loading type
          var fieldLoadingType = editor.call('attributes:addField', {
              name: 'Loading Type',
              type: 'number',
              enum: [
                  { v: '', t: '...' },
                  { v: LOAD_SCRIPT_AS_ASSET, t: 'Asset' },
                  { v: LOAD_SCRIPT_BEFORE_ENGINE, t: 'Before Engine' },
                  { v: LOAD_SCRIPT_AFTER_ENGINE, t: 'After Engine' }
              ],
              link: assets,
              path: 'data.loadingType'
          });

          // reparent
          if (preloadField && preloadField.nextSibling) {
              fieldLoadingType.parent.parent.innerElement.removeChild(fieldLoadingType.parent.element);
              panel.innerElement.insertBefore(fieldLoadingType.parent.element, preloadField.nextSibling);
          }

          // reference
          editor.call('attributes:reference:attach', 'asset:script:loadingType', fieldLoadingType.parent.innerElement.firstChild.ui);

          // parse
          var btnParse = new ui.Button({
              text: 'Parse'
          });
          btnParse.hidden = ! editor.call('permissions:write');
          events.push(editor.on('permissions:writeState', function(state) {
              btnParse.hidden = ! state;
          }));
          btnParse.class.add('parse-script');
          btnParse.on('click', function() {
              btnParse.disabled = true;

              editor.call('scripts:parse', asset, function(err, result) {
                  btnParse.disabled = false;

                  if (err) {
                      panelErrors.hidden = false;
                      panelErrors.clear();
                      panelErrors.append(new ui.Label({ text: err.message }));
                      return;
                  }

                  // script validation errors
                  panelErrors.clear();

                  if (result.scriptsInvalid.length) {
                      var label = new ui.Label({ text: 'Validation Errors:' });
                      label.class.add('title');
                      panelErrors.append(label);

                      for(var i = 0; i < result.scriptsInvalid.length; i++) {
                          var label = new ui.Label({ text: result.scriptsInvalid[i] });
                          panelErrors.append(label);
                      }
                      panelErrors.hidden = false;
                  } else {
                      panelErrors.hidden = true;
                  }

                  // template attributes validation errors
                  for(var key in result.scripts) {
                      if (! result.scripts.hasOwnProperty(key) || ! scriptsPanelIndex[key])
                          continue;

                      var attrInvalid = result.scripts[key].attributesInvalid;
                      var validation = scriptsPanelIndex[key].validation;

                      if (attrInvalid.length === 0) {
                          validation.clear();
                          if (validation.collision) {
                              validation.append(validation.collision);
                              validation.hidden = false;
                          } else {
                              validation.hidden = true;
                          }
                          continue;
                      }

                      validation.clear();
                      if (validation.collision)
                          validation.append(validation.collision)

                      for(var i = 0; i < attrInvalid.length; i++)
                          validation.append(new ui.Label({ text: attrInvalid[i] }));

                      validation.hidden = false;
                  }
              });
          });
          panelScripts.headerAppend(btnParse);


          // has loading script
          var fieldLoading = new ui.Label({
              text: 'Has Loading Script'
          });
          fieldLoading.class.add('loading');
          fieldLoading.hidden = ! asset.get('data.loading');
          panelScripts.append(fieldLoading);
          events.push(asset.on('data.loading:set', function(value) {
              fieldLoading.hidden = ! value;
              checkScriptsEmpty();
          }));


          // scripts validation errors
          var panelErrors = new ui.Panel();
          panelErrors.class.add('validation');
          panelErrors.hidden = true;
          panelScripts.append(panelErrors);


          // scripts panel
          var panelScriptsList = new ui.Panel();
          panelScriptsList.class.add('scripts');
          panelScripts.append(panelScriptsList);


          var scriptsPanelIndex = { };
          var noScriptsLabel;

          var checkScriptsEmpty = function() {
              var empty = Object.keys(scriptsPanelIndex).length === 0;

              if (empty) {
                  panelScriptsList.class.add('empty');
              } else {
                  panelScriptsList.class.remove('empty');
              }

              if (empty && ! noScriptsLabel && fieldLoading.hidden) {
                  // no scripts
                  noScriptsLabel = new ui.Label({
                      text: 'No Script Objects found'
                  });
                  panelScriptsList.append(noScriptsLabel);
              } else if (! empty && noScriptsLabel) {
                  noScriptsLabel.destroy();
                  noScriptsLabel = null;
              }
          };

          var createScriptPanel = function(script) {
              if (scriptsPanelIndex[script])
                  return;

              var events = [ ];

              var panel = new ui.Panel();
              panel.class.add('script');
              panel.header = script;
              panel.attributesIndex = { };
              panelScriptsList.append(panel);

              var validation = new ui.Panel();
              validation.class.add('validation');
              validation.hidden = true;
              panel.validation = validation;
              panel.append(validation);

              var onCollide = function() {
                  if (validation.collision)
                      return;

                  validation.collision = new ui.Label({
                      text: 'script \'' + script + '\' is already defined in other asset'
                  });
                  validation.append(validation.collision);
                  validation.hidden = false;
              };

              events.push(editor.on('assets[' + asset.get('id') + ']:scripts[' + script + ']:collide', onCollide));

              events.push(editor.on('assets[' + asset.get('id') + ']:scripts[' + script + ']:resolve', function() {
                  if (! validation.collision)
                      return;

                  validation.collision.destroy();
                  if (! validation.innerElement.childNodes.firstChild)
                      validation.hidden = true;

                  validation.collision = null;
              }));

              if (editor.call('assets:scripts:collide', script))
                  onCollide();

              panel.once('destroy', function() {
                  for(var i = 0; i < events.length; i++)
                      events[i].unbind();
                  events = null;
              });

              scriptsPanelIndex[script] = panel;

              var attributesOrder = asset.get('data.scripts.' + script + '.attributesOrder');
              for(var i = 0; i < attributesOrder.length; i++)
                  createScriptAttribute(script, attributesOrder[i]);

              checkScriptsEmpty();
          };

          var createScriptAttribute = function(script, attr, ind) {
              var events = [ ];
              var panel = scriptsPanelIndex[script];
              if (! panel) return;

              if (panel.attributesIndex[attr])
                  return;

              var attribute = asset.get('data.scripts.' + script + '.attributes.' + attr);
              if (! attribute)
                  return;

              var panelAttribute = new ui.Panel();
              panelAttribute.class.add('attr');
              panelAttribute.updatingTooltip = null;
              panelAttribute.updateTooltip = function() {
                  panelAttribute.updatingTooltip = false;

                  var attribute = asset.get('data.scripts.' + script + '.attributes.' + attr);
                  if (! attribute)
                      return;

                  var subTitle = editor.call('assets:scripts:typeToSubTitle', attribute);

                  fieldType.text = subTitle;

                  tooltip.html = editor.call('attributes:reference:template', {
                      title: attr,
                      subTitle: subTitle,
                      description: (attribute.description || attribute.title || ''),
                      code: JSON.stringify(attribute, null, 4)
                  });
              };
              panel.attributesIndex[attr] = panelAttribute;

              var before = null;
              if (typeof(ind) === 'number')
                  before = panel.innerElement.childNodes[ind];

              if (before) {
                  panel.appendBefore(panelAttribute, before);
              } else {
                  panel.append(panelAttribute);
              }

              var fieldName = panelAttribute.fieldName = new ui.Label({ text: attr });
              fieldName.class.add('name');
              panelAttribute.append(fieldName);

              var fieldType = panelAttribute.fieldType = new ui.Label({
                  text: editor.call('assets:scripts:typeToSubTitle', attribute)
              });
              fieldType.class.add('type');
              panelAttribute.append(fieldType);

              var tooltip = editor.call('attributes:reference', {
                  title: attr,
                  subTitle: editor.call('assets:scripts:typeToSubTitle', attribute),
                  description: (attribute.description || attribute.title || ''),
                  code: JSON.stringify(attribute, null, 4)
              });
              tooltip.attach({
                  target: panelAttribute,
                  element: panelAttribute.element
              });

              events.push(asset.on('*:set', function(path) {
                  if (panelAttribute.updatingTooltip)
                      return;

                  if (! path.startsWith('data.scripts.' + script + '.attributes.' + attr))
                      return;

                  panelAttribute.updatingTooltip = true;
                  setTimeout(panelAttribute.updateTooltip, 0);
              }));

              fieldType.once('destroy', function() {
                  for(var i = 0; i < events.length; i++)
                      events[i].unbind();

                  events = null;
              });
          };

          var data = asset.get('data.scripts');
          var scriptKeys = [ ];
          for(var key in data) {
              if (! data.hasOwnProperty(key))
                  continue;

              createScriptPanel(key);
          }

          checkScriptsEmpty();

          events.push(asset.on('*:set', function(path, value) {
              if (! path.startsWith('data.scripts'))
                  return;

              var parts = path.split('.');

              if (parts.length === 3) {
                  // data.scripts.*
                  createScriptPanel(parts[2]);
              } else if (parts.length >= 6 && parts[3] === 'attributes') {
                  // data.scripts.*.attributes.*.**
                  var script = scriptsPanelIndex[parts[2]];
                  if (! script) return;

                  var attr = script.attributesIndex[parts[4]];
                  if (! attr || attr.updatingTooltip) return;

                  attr.updatingTooltip = true;
                  setTimeout(attr.updateTooltip, 0);
              }
          }));

          events.push(asset.on('*:unset', function(path, value) {
              if (! path.startsWith('data.scripts'))
                  return;

              var parts = path.split('.');

              if (parts.length === 3) {
                  // data.scripts.*
                  if (scriptsPanelIndex[parts[2]]) {
                      scriptsPanelIndex[parts[2]].destroy();
                      delete scriptsPanelIndex[parts[2]];
                      checkScriptsEmpty();
                  }
              } else if (parts.length >= 6 && parts[3] === 'attributes') {
                  // data.scripts.*.attributes.*.**
                  var script = scriptsPanelIndex[parts[2]];
                  if (! script) return;

                  var attr = script.attributesIndex[parts[4]];
                  if (! attr || attr.updatingTooltip) return;

                  attr.updatingTooltip = true;
                  setTimeout(attr.updateTooltip, 0);
              }
          }));

          events.push(asset.on('*:insert', function(path, value, ind) {
              if (! path.startsWith('data.scripts'))
                  return;

              var parts = path.split('.');

              if (parts.length === 4 && parts[3] === 'attributesOrder') {
                  // data.scripts.*.attributesOrder
                  createScriptAttribute(parts[2], value, ind + 1);
              }
          }));

          events.push(asset.on('*:remove', function(path, value) {
              if (! path.startsWith('data.scripts'))
                  return;

              var parts = path.split('.');

              if (parts.length === 4 && parts[3] === 'attributesOrder') {
                  // data.scripts.*.attributesOrder
                  var script = scriptsPanelIndex[parts[2]];
                  if (! script) return;

                  var attr = script.attributesIndex[value];
                  if (! attr) return;

                  attr.destroy();
                  delete script.attributesIndex[value];
              }
          }));

          events.push(asset.on('*:move', function(path, value, ind, indOld) {
              if (! path.startsWith('data.scripts'))
                  return;

              var parts = path.split('.');

              if (parts.length === 4 && parts[3] === 'attributesOrder') {
                  var script = scriptsPanelIndex[parts[2]];
                  if (! script) return;

                  var attr = script.attributesIndex[value];
                  if (! attr) return;

                  var parent = attr.element.parentNode;
                  parent.removeChild(attr.element);

                  var next = parent.children[ind + 1];
                  if (next) {
                      parent.insertBefore(attr.element, next);
                  } else {
                      parent.appendChild(attr.element);
                  }
              }
          }));
      }

      // clear events
      panel.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();

          events = null;
      });
  });
});


/* editor/attributes/assets/attributes-asset-shader.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length !== 1 || assets[0].get('type') !== 'shader' || assets[0].get('source'))
          return;

      var asset = assets[0];

      // panel
      var panel = editor.call('attributes:assets:panel');

      var panelRaw = editor.call('attributes:addPanel', {
          name: 'Shader'
      });
      panelRaw.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:shader:asset', panelRaw, panelRaw.headerElement);

      // loading
      var loading = editor.call('attributes:addField', {
          type: 'progress'
      });
      loading.progress = 1;

      // code
      var fieldCode = editor.call('attributes:addField', {
          parent: panelRaw,
          type: 'code'
      });
      fieldCode.style.margin = '-8px -6px';

      var fieldError = new ui.Label({
          text: 'failed loading data'
      });
      fieldError.class.add('asset-loading-error');
      fieldError.hidden = true;
      editor.call('attributes.rootPanel').append(fieldError);

      var loadContent = function() {
          if (asset.get('file.size') > 128 * 1024) {
              panelRaw.hidden = true;
              loading.hidden = true;
              return;
          } else {
              panelRaw.hidden = false;
              loading.hidden = false;
          }
          // load data
          Ajax({
              url: '{{url.home}}' + asset.get('file.url').appendQuery('t=' + asset.get('file.hash')),
              notJson: true
          })
          .on('load', function(status, data) {
              fieldCode.text = data;
              fieldCode.hidden = false;
              fieldError.hidden = true;
              loading.hidden = true;
          })
          .on('error', function() {
              loading.hidden = false;
              loading.failed = true;
              fieldCode.hidden = true;
              fieldError.hidden = false;
          });
      };
      if (asset.has('file.url'))
          loadContent();

      var evtReload = asset.on('file.hash:set', function() {
          loadContent();
      });
      panel.once('destroy', function() {
          evtReload.unbind();
      });
  });
});


/* editor/attributes/assets/attributes-asset-source.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length !== 1 || ! assets[0].get('source'))
          return;

      var asset = assets[0];
      var events = [ ];

      // related assets
      var panelRelated = editor.call('attributes:addPanel', {
          name: 'Related Assets'
      });
      panelRelated.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:source:related', panelRelated, panelRelated.headerElement);

      var list = new ui.List();
      list.class.add('related-assets');
      panelRelated.append(list);

      var assetId = asset.get('id');
      var assets = editor.call('assets:find', function(asset) {
          return parseInt(asset.get('source_asset_id'), 10) === assetId;
      });

      var addAsset = function(asset) {
          panelRelated.hidden = false;

          var item = new ui.ListItem({
              text: asset.get('name')
          });
          item.class.add('type-' + asset.get('type'));
          list.append(item);

          item.element.addEventListener('click', function() {
              editor.call('selector:set', 'asset', [ asset ]);
          }, false);

          var assetEvents = [ ];

          assetEvents.push(asset.on('name:set', function(name) {
              item.text = name;
          }));

          asset.once('destroy', function() {
              item.destroy();
              for(var i = 0; i < assetEvents.length; i++)
                  assetEvents[i].unbind();
          });

          events = events.concat(assetEvents);
      };

      for(var i = 0; i < assets.length; i++)
          addAsset(assets[i][1]);

      if (! assets.length)
          panelRelated.hidden = true;


      events.push(editor.on('assets:add', function(asset) {
          if (asset.get('source_asset_id') !== assetId)
              return;

          addAsset(asset);
      }));


      list.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();
      });
  });
});


/* editor/attributes/assets/attributes-asset-sprite.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      var root = editor.call('attributes.rootPanel');

      for(var i = 0; i < assets.length; i++) {
          if (assets[i].get('type') !== 'sprite')
              return;
      }

      var events = [ ];

      if (assets.length > 1)
          editor.call('attributes:header', assets.length + ' Sprites');

      // Properties
      var panelProperties = editor.call('attributes:addPanel', {
          name: "Sprite"
      });
      panelProperties.class.add('component');

      var fieldPixelsPerUnit = editor.call('attributes:addField', {
          parent: panelProperties,
          name: 'Pixels Per Unit',
          type: 'number',
          min: 1,
          link: assets,
          path: 'data.pixelsPerUnit'
      });

      // reference
      editor.call('attributes:reference:attach', 'asset:sprite:pixelsPerUnit', fieldPixelsPerUnit.parent.innerElement.firstChild.ui);

      var fieldRenderMode = editor.call('attributes:addField', {
          parent: panelProperties,
          name: 'Render Mode',
          type: 'number',
          enum: [
              {v:0, t: 'Simple'},
              {v:1, t:'Sliced'},
              {v:2, t:'Tiled'}
          ],
          link: assets,
          path: 'data.renderMode'
      });

      // reference
      editor.call('attributes:reference:attach', 'asset:sprite:renderMode', fieldRenderMode.parent.innerElement.firstChild.ui);

      var fieldAtlas = editor.call('attributes:addField', {
          parent: panelProperties,
          name: 'Texture Atlas',
          type: 'asset',
          kind: 'textureatlas',
          link: assets,
          path: 'data.textureAtlasAsset'
      });

      // reference
      editor.call('attributes:reference:attach', 'asset:sprite:textureAtlasAsset', fieldAtlas._label);


      // preview
      if (assets.length === 1) {
          var previewContainer = new pcui.Container();
          previewContainer.class.add('asset-preview-container');

          var preview = document.createElement('canvas');
          var ctx = preview.getContext('2d');
          preview.width = 256;
          preview.height = 256;
          preview.classList.add('asset-preview');
          previewContainer.append(preview);

          preview.addEventListener('click', function() {
              if (root.class.contains('large')) {
                  root.class.remove('large');
              } else {
                  root.class.add('large');
              }
              queueRender();
          }, false);

          root.class.add('asset-preview');
          root.prepend(previewContainer);

          var time = 0;
          var playing = false;
          var fps = 10;
          var frame = 0;
          var lastTime = Date.now();

          var btnPlay = new ui.Button({
              text: '&#57649;'
          });
          previewContainer.append(btnPlay.element);
          btnPlay.parent = panelProperties;

          btnPlay.on('click', function() {
              playing = !playing;

              if (playing) {
                  lastTime = Date.now();
                  btnPlay.class.add('active', 'pinned');
              } else {
                  btnPlay.class.remove('active', 'pinned');
              }

              queueRender();
          });

          var renderQueued;

          var renderPreview = function () {
              if (renderQueued)
                  renderQueued = false;

              if (playing) {
                  var now = Date.now();
                  time += (now - lastTime) / 1000;

                  frame = Math.floor(time * fps);
                  var numFrames = assets[0].get('data.frameKeys').length;
                  if (frame >= numFrames) {
                      frame = 0;
                      time -= numFrames / fps;
                  }

                  lastTime = now;
              }

              // render
              editor.call('preview:render', assets[0], previewContainer.width, previewContainer.height, preview, {
                  frame: frame,
                  animating: true
              });

              if (playing) {
                  queueRender();
              }
          };
          renderPreview();

          // queue up the rendering to prevent too oftern renders
          var queueRender = function() {
              if (renderQueued) return;
              renderQueued = true;
              requestAnimationFrame(renderPreview);
          };

          // render on resize
          var evtPanelResize = root.on('resize', queueRender);

          var spriteWatch = editor.call('assets:sprite:watch', {
              asset: assets[0],
              callback: queueRender
          });

          panelProperties.once('destroy', function() {
              root.class.remove('asset-preview', 'animate');

              evtPanelResize.unbind();

              editor.call('assets:sprite:unwatch', assets[0], spriteWatch);

              panelProperties = null;

              playing = false;
          });
      }

      panelProperties.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();
      });
  });
});


/* editor/attributes/assets/attributes-asset-text.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length !== 1 || assets[0].get('type') !== 'text' || assets[0].get('source'))
          return;

      var asset = assets[0];

       // panel
      var panel = editor.call('attributes:assets:panel');

      var panelRaw = editor.call('attributes:addPanel', {
          name: 'TEXT'
      });
      panelRaw.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:text:asset', panelRaw, panelRaw.headerElement);

      // loading
      var loading = editor.call('attributes:addField', {
          type: 'progress',
      });
      loading.progress = 1;

      // code
      var fieldText = editor.call('attributes:addField', {
          parent: panelRaw,
          type: 'code'
      });
      fieldText.style.margin = '-8px -6px';

      var fieldError = new ui.Label({
          text: 'failed loading data'
      });
      fieldError.class.add('asset-loading-error');
      fieldError.hidden = true;
      editor.call('attributes.rootPanel').append(fieldError);

      var loadContent = function() {
          if (asset.get('file.size') > 128 * 1024) {
              panelRaw.hidden = true;
              loading.hidden = true;
              return;
          } else {
              panelRaw.hidden = false;
              loading.hidden = false;
          }
          // load data
          Ajax({
              url: '{{url.home}}' + asset.get('file.url').appendQuery('t=' + asset.get('file.hash')),
              notJson: true
          })
          .on('load', function(status, data) {
              fieldText.text = data;
              fieldText.hidden = false;
              fieldError.hidden = true;
              loading.hidden = true;
          })
          .on('error', function(status, err) {
              loading.hidden = false;
              loading.failed = true;
              fieldText.hidden = true;
              fieldError.hidden = false;
          });
      };
      if (asset.has('file.url'))
          loadContent();

      var evtReload = asset.on('file.hash:set', function() {
          loadContent();
      });
      panel.once('destroy', function() {
          evtReload.unbind();
      });
  });
});


/* editor/attributes/assets/attributes-asset-texture.js */
editor.once('load', function() {
  'use strict';

  var panelsStates = { };

  editor.on('attributes:inspect[asset]', function(assets) {
      for(var i = 0; i < assets.length; i++) {
          if (assets[i].get('type') !== 'texture' && assets[i].get('type') !== 'textureatlas' || assets[i].get('source'))
              return;
      }

      var events = [ ];

      var ids = [ ];
      for(var i = 0; i < assets.length; i++)
          ids.push(assets[i].get('id'));

      ids = ids.sort(function(a, b) {
          return a - b;
      }).join(',');

      var panelState = panelsStates[ids];
      var panelStateNew = false;
      if (! panelState) {
          panelStateNew = true;
          panelState = panelsStates[ids] = { };

          panelState['texture'] = false;
          panelState['compression'] = false;
      }

      if (assets.length > 1) {
          var numTextures = 0;
          var numTextureAtlases = 0;
          for (var i = 0; i < assets.length; i++) {
              if (assets[i].get('type') === 'texture') {
                  numTextures++;
              } else {
                  numTextureAtlases++;
              }
          }
          var msg = '';
          var comma = '';
          if (numTextures) {
              msg += numTextures + ' Texture' + (numTextures > 1 ? 's' : '');
              comma = ', ';
          }
          if (numTextureAtlases) {
              msg += comma + numTextureAtlases + ' Texture Atlas' + (numTextureAtlases > 1 ? 'es' : '');
          }
          editor.call('attributes:header', msg);
      }

      // properties panel
      var panel = editor.call('attributes:addPanel', {
          name: 'Texture',
          foldable: true,
          folded: panelState['texture']
      });
      panel.class.add('component');
      panel.on('fold', function() { panelState['texture'] = true; });
      panel.on('unfold', function() { panelState['texture'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:asset', panel, panel.headerElement);


      var btnGetMeta = new ui.Button({
          text: 'Calculate Meta'
      });
      btnGetMeta.class.add('calculate-meta', 'large-with-icon');
      var btnGetMetaVisibility = function() {
          var visible = false;
          for(var i = 0; i < assets.length; i++) {
              if (! visible && ! assets[i].get('meta'))
                  visible = true;
          }
          btnGetMeta.hidden = ! visible;
      };
      btnGetMeta.on('click', function() {
          if (! editor.call('permissions:write'))
              return;

          for(var i = 0; i < assets.length; i++) {
              if (assets[i].get('meta'))
                  continue;

              editor.call('realtime:send', 'pipeline', {
                  name: 'meta',
                  id: assets[i].get('uniqueId')
              });
          }
          this.enabled = false;
      });
      panel.append(btnGetMeta);

      btnGetMetaVisibility();
      for(var i = 0; i < assets.length; i++) {
          if (btnGetMeta.hidden && ! assets[i].get('meta'))
              btnGetMeta.hidden = false;

          events.push(assets[i].on('meta:set', function() {
              btnGetMetaVisibility();
          }));
          events.push(assets[i].on('meta:unset', function() {
              btnGetMeta.hidden = false;
          }));
      }


      // width
      var fieldWidth = editor.call('attributes:addField', {
          parent: panel,
          name: 'Width',
          link: assets,
          path: 'meta.width',
          placeholder: 'pixels'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:width', fieldWidth.parent.innerElement.firstChild.ui);

      // height
      var fieldHeight = editor.call('attributes:addField', {
          parent: panel,
          name: 'Height',
          link: assets,
          path: 'meta.height',
          placeholder: 'pixels'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:height', fieldHeight.parent.innerElement.firstChild.ui);

      // depth
      var fieldDepth = editor.call('attributes:addField', {
          parent: panel,
          name: 'Depth',
          link: assets,
          path: 'meta.depth',
          placeholder: 'bit'
      });
      var checkDepthField = function() {
          if (! fieldDepth.value)
              fieldDepth.element.innerHTML = 'unknown';
      };
      checkDepthField();
      fieldDepth.on('change', checkDepthField);
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:depth', fieldDepth.parent.innerElement.firstChild.ui);


      // alpha
      var fieldAlpha = editor.call('attributes:addField', {
          parent: panel,
          name: 'Alpha',
          link: assets,
          path: 'meta.alpha'
      });
      var checkAlphaField = function() {
          if (! fieldAlpha.value)
              fieldAlpha.element.innerHTML = 'false';
      };
      checkAlphaField();
      fieldAlpha.on('change', checkAlphaField);
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:alpha', fieldAlpha.parent.innerElement.firstChild.ui);


      // interlaced
      var fieldInterlaced = editor.call('attributes:addField', {
          parent: panel,
          name: 'Interlaced',
          link: assets,
          path: 'meta.interlaced'
      });
      var checkInterlacedField = function() {
          if (! fieldInterlaced.value)
              fieldInterlaced.element.innerHTML = 'false';
      };
      checkInterlacedField();
      fieldInterlaced.on('change', checkInterlacedField);
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:interlaced', fieldInterlaced.parent.innerElement.firstChild.ui);


      // rgbm
      var fieldRgbm = editor.call('attributes:addField', {
          parent: panel,
          name: 'Rgbm',
          link: assets,
          path: 'data.rgbm',
          type: 'checkbox'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:rgbm', fieldRgbm.parent.innerElement.firstChild.ui);


      // mipmaps
      var fieldMips = editor.call('attributes:addField', {
          parent: panel,
          name: 'Mipmaps',
          link: assets,
          path: 'data.mipmaps',
          type: 'checkbox'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:mipmaps', fieldMips.parent.innerElement.firstChild.ui);


      // filtering
      var fieldFiltering = editor.call('attributes:addField', {
          parent: panel,
          name: 'Filtering',
          type: 'string',
          enum: {
              '': '...',
              'nearest': 'Point',
              'linear': 'Linear'
          }
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:filtering', fieldFiltering.parent.innerElement.firstChild.ui);

      var changingFiltering = false;

      var updateFiltering = function() {
          var value = '';
          var valueDifferent = false;
          var filter = assets[0].get('data.minfilter') + assets[0].get('data.magfilter');

          for(var i = 1; i < assets.length; i++) {
              if (filter !== (assets[i].get('data.minfilter') + assets[i].get('data.magfilter'))) {
                  valueDifferent = true;
                  break;
              }
          }

          if (! valueDifferent) {
              if (assets[0].get('data.minfilter') === 'linear_mip_linear' && assets[0].get('data.magfilter') === 'linear') {
                  value = 'linear';
              } else if (assets[0].get('data.minfilter') === 'nearest_mip_nearest' && assets[0].get('data.magfilter') === 'nearest') {
                  value = 'nearest';
              }
          }

          if (! valueDifferent && value) {
              fieldFiltering.optionElements[''].style.display = 'none';
          } else {
              fieldFiltering.optionElements[''].style.display = '';
          }

          changingFiltering = true;
          fieldFiltering.value = value;
          changingFiltering = false;
      };
      updateFiltering();

      fieldFiltering.on('change', function(value) {
          if (changingFiltering)
              return;

          var values = [ ];
          var valueMin = value + '_mip_' + value;
          var valueMag = value;

          changingFiltering = true;
          for(var i = 0; i < assets.length; i++) {
              values.push({
                  id: assets[i].get('id'),
                  valueMin: assets[i].get('data.minfilter'),
                  valueMag: assets[i].get('data.magfilter')
              });
              assets[i].history.enabled = false;
              assets[i].set('data.minfilter', valueMin);
              assets[i].set('data.magfilter', valueMag);
              assets[i].history.enabled = true;
          }
          changingFiltering = false;

          fieldFiltering.optionElements[''].style.display = 'none';

          // history
          editor.call('history:add', {
              name: 'assets.filtering',
              undo: function() {
                  for(var i = 0; i < values.length; i++) {
                      var asset = editor.call('assets:get', values[i].id);
                      if (! asset)
                          continue;

                      asset.history.enabled = false;
                      asset.set('data.minfilter', values[i].valueMin);
                      asset.set('data.magfilter', values[i].valueMag);
                      asset.history.enabled = true;
                  }
              },
              redo: function() {
                  for(var i = 0; i < values.length; i++) {
                      var asset = editor.call('assets:get', values[i].id);
                      if (! asset)
                          continue;

                      asset.history.enabled = false;
                      asset.set('data.minfilter', valueMin);
                      asset.set('data.magfilter', valueMag);
                      asset.history.enabled = true;
                  }
              }
          });
      });

      var eventsFiltering = [ ];
      var changingQueued = false;
      var changedFiltering = function() {
          if (changingQueued || changingFiltering)
              return;

          changingQueued = true;
          setTimeout(function() {
              changingQueued = false;
              updateFiltering();
          }, 0);
      };
      for(var i = 0; i < assets.length; i++) {
          eventsFiltering.push(assets[i].on('data.minfilter:set', changedFiltering));
          eventsFiltering.push(assets[i].on('data.magfilter:set', changedFiltering));
      }
      fieldFiltering.once('destroy', function() {
          for(var i = 0; i < eventsFiltering.length; i++) {
              eventsFiltering[i].unbind();
          }
      });



      // anisotropy
      var fieldAnisotropy = editor.call('attributes:addField', {
          parent: panel,
          name: 'Anisotropy',
          type: 'number',
          link: assets,
          path: 'data.anisotropy'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:anisotropy', fieldAnisotropy.parent.innerElement.firstChild.ui);



      // addressu
      var fieldAddressU = editor.call('attributes:addField', {
          parent: panel,
          name: 'Address U',
          type: 'string',
          enum: {
              '': '...',
              'repeat': 'Repeat',
              'clamp': 'Clamp',
              'mirror': 'Mirror Repeat'
          },
          link: assets,
          path: 'data.addressu'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:addressU', fieldAddressU.parent.innerElement.firstChild.ui);


      // addressv
      var fieldAddressV = editor.call('attributes:addField', {
          parent: panel,
          name: 'Address V',
          type: 'string',
          enum: {
              '': '...',
              'repeat': 'Repeat',
              'clamp': 'Clamp',
              'mirror': 'Mirror Repeat'
          },
          link: assets,
          path: 'data.addressv'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:addressV', fieldAddressV.parent.innerElement.firstChild.ui);


      var formats = {
          original: { size: 0, vram: 0 },
          dxt: { size: 0, vram: 0, timeout: false },
          pvr: { size: 0, vram: 0, timeout: false },
          etc1: { size: 0, vram: 0, timeout: false },
          etc2: { size: 0, vram: 0, timeout: false }
      };


      // compression panel
      var panelCompression =editor.call('attributes:addPanel', {
          name: 'Compression',
          foldable: true,
          folded: panelState['compression']
      });
      panelCompression.class.add('component', 'variants');
      panelCompression.on('fold', function() { panelState['compression'] = true; });
      panelCompression.on('unfold', function() { panelState['compression'] = false; });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:compression', panelCompression, panelCompression.headerElement);

      // compress alpha
      var fieldCompressAlpha = editor.call('attributes:addField', {
          parent: panelCompression,
          type: 'checkbox',
          name: 'Options',
          link: assets,
          path: 'meta.compress.alpha'
      });
      // label
      var labelCompressAlpha = new ui.Label({ text: 'Alpha' });
      labelCompressAlpha.style.verticalAlign = 'top';
      labelCompressAlpha.style.paddingRight = '12px';
      labelCompressAlpha.style.fontSize = '12px';
      labelCompressAlpha.style.lineHeight = '24px';
      fieldCompressAlpha.parent.append(labelCompressAlpha);

      var checkCompressAlpha = function() {
          var state = false;
          var different = false;
          for(var i = 0; i < assets.length; i++) {
              var alpha = assets[i].get('meta.alpha') || false;
              var trueColorAlpha = (assets[i].get('meta.type') || '').toLowerCase() === 'truecoloralpha';
              var rgbm = assets[i].get('data.rgbm');

              if (i === 0) {
                  state = (alpha || trueColorAlpha) && ! rgbm;
              } else if (state !== ((alpha || trueColorAlpha) && ! rgbm)) {
                  different = true;
                  break;
              }
          }

          fieldCompressAlpha.disabled = labelCompressAlpha.disabled = ! different && ! state;
      };
      checkCompressAlpha();

      // reference
      editor.call('attributes:reference:attach', 'asset:texture:compress:alpha', labelCompressAlpha);


      var originalExt = '';
      var labelSize = { };

      var calculateSize = function(format) {
          formats[format].size = 0;
          formats[format].vram = 0;

          for(var i = 0; i < assets.length; i++) {
              if (! assets[i].get('file'))
                  continue;

              var size = assets[i].get('file.variants.' + format + '.size') || 0;
              var sizeGzip = assets[i].get('file.variants.' + format + '.sizeGzip') || 0;

              if (size) formats[format].vram += size - 128;
              if (sizeGzip || size) formats[format].size += (sizeGzip || size) - 128;
          }
      };

      var calculateOriginalSize = function() {
          formats.original.size = 0;
          formats.original.vram = 0;

          for(var i = 0; i < assets.length; i++) {
              if (! assets[i].get('file'))
                  continue;

              var s = assets[i].get('file.size') || 0;
              if (s) {
                  formats.original.size += s;
              }

              var pixels = (assets[i].get('meta.width') || 0) * (assets[i].get('meta.height') || 0);

              formats.original.vram += pixels * 4;
          }
      };

      var queueSizeCalculate = function(format) {
          if (formats[format].timeout)
              return;

          formats[format].timeout = true;

          setTimeout(function() {
              formats[format].timeout = false;
              calculateSize(format);

              if (! formats[format].size && ! formats[format].vram) {
                  labelSize[format].text = '-';
              } else {
                  labelSize[format].text = bytesToHuman(formats[format].size) + ' [VRAM ' + bytesToHuman(formats[format].vram) + ']'
              }
          }, 0);
      };

      var checkFormats = function() {
          var width = -1;
          var height = -1;
          var rgbm = -1;
          var alpha = -1;
          var alphaValid = -1;

          for(var i = 0; i < assets.length; i++) {
              if (assets[i].has('meta.width')) {
                  if (width === -1) {
                      width = assets[i].get('meta.width');
                      height = assets[i].get('meta.height');
                  } else if (width !== assets[i].get('meta.width') || height !== assets[i].get('meta.height')) {
                      width = -2;
                      height = -2;
                  }
              }

              if (! assets[i].get('file'))
                  continue;

              if (rgbm === -1) {
                  rgbm = assets[i].get('data.rgbm') ? 1 : 0;
              } else if (rgbm !== -2) {
                  if (rgbm !== (assets[i].get('data.rgbm') ? 1 : 0))
                      rgbm = -2;
              }

              if (alpha === -1) {
                  alpha = assets[i].get('meta.compress.alpha') ? 1 : 0;
              } else if (alpha !== -2) {
                  if (alpha !== (assets[i].get('meta.compress.alpha') ? 1 : 0))
                      alpha = -2;
              }

              var alphaValidTmp = (assets[i].get('meta.alpha') || (assets[i].get('meta.type') || '').toLowerCase() === 'truecoloralpha') ? 1 : 0;
              if (alphaValid === -1) {
                  alphaValid = alphaValidTmp;
              } else if (alphaValid !== -2) {
                  if (alphaValid !== alphaValidTmp)
                      alphaValid = -2;
              }

              var ext = assets[i].get('file.url');
              ext = ext.slice(ext.lastIndexOf('.') + 1).toUpperCase();
              ext = ext.split('?')[0];

              if (originalExt !== 'various' && originalExt && originalExt !== ext) {
                  originalExt = 'various';
              } else if (originalExt !== 'various') {
                  originalExt = ext;
              }
          }

          fieldOriginal.value = originalExt;

          if (rgbm !== 1) {
              if (width > 0 && height > 0) {
                  // size available
                  if ((width & (width - 1)) === 0 && (height & (height - 1)) === 0) {
                      // pot
                      fieldDxt.disabled = false;
                  } else {
                      // non pot
                      fieldDxt.disabled = true;
                  }
              } else if (width === -1) {
                  // no size available
                  fieldDxt.disabled = true;
              } else if (width === -2) {
                  // various sizes
                  fieldDxt.disabled = false;
              }
          } else {
              fieldDxt.disabled = true;
          }

          fieldPvr.disabled = fieldPvrBpp.disabled = rgbm !== -2 && (fieldDxt.disabled || rgbm === 1);
          fieldEtc1.disabled = fieldPvr.disabled || (alpha === 1 && alphaValid !== 0);

          updatePvrWarning();
      };

      calculateOriginalSize();
      for(var key in formats) {
          if (key === 'original')
              continue;

          calculateSize(key);
      }

      // original
      var fieldOriginal = editor.call('attributes:addField', {
          parent: panelCompression,
          name: 'Original',
          value: originalExt
      });
      fieldOriginal.style.paddingLeft = '0px';
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:compress:original', fieldOriginal.parent.innerElement.firstChild.ui);

      // original sizes
      var labelOriginalSize = new ui.Label({
          text: bytesToHuman(formats.original.size) + ' [VRAM ' + bytesToHuman(formats.original.vram) + ']'
      });
      labelOriginalSize.class.add('size');
      fieldOriginal.parent.append(labelOriginalSize);


      // dxt
      var fieldDxt = editor.call('attributes:addField', {
          parent: panelCompression,
          type: 'checkbox',
          name: 'DXT',
          link: assets,
          path: 'meta.compress.dxt'
      });
      // label
      var labelDxtSize = labelSize['dxt'] = new ui.Label({
          text: bytesToHuman(formats.dxt.size) + ' [VRAM ' + bytesToHuman(formats.dxt.vram) + ']'
      });
      labelDxtSize.class.add('size');
      if (! formats.dxt.size && ! formats.dxt.vram) labelDxtSize.text = '-';
      fieldDxt.parent.append(labelDxtSize);
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:compress:dxt', fieldDxt.parent.innerElement.firstChild.ui);


      // pvr
      var fieldPvr = editor.call('attributes:addField', {
          parent: panelCompression,
          type: 'checkbox',
          name: 'PVR',
          link: assets,
          path: 'meta.compress.pvr'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:compress:pvr', fieldPvr.parent.innerElement.firstChild.ui);

      // pvrBpp
      var fieldPvrBpp = editor.call('attributes:addField', {
          panel: fieldPvr.parent,
          type: 'number',
          enum: [
              { v: '', t: '...' },
              { v: 2, t: '2 BPP' },
              { v: 4, t: '4 BPP' }
          ],
          link: assets,
          path: 'meta.compress.pvrBpp'
      });
      fieldPvrBpp.flexGrow = 0;
      fieldPvrBpp.style.width = '62px';
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:compress:pvrBpp', fieldPvrBpp);

      // label
      var labelPvrSize = labelSize['pvr'] = new ui.Label({
          text: bytesToHuman(formats.pvr.size) + ' [VRAM ' + bytesToHuman(formats.pvr.vram) + ']'
      });
      labelPvrSize.class.add('size');
      if (! formats.pvr.size && ! formats.pvr.vram) labelPvrSize.text = '-';
      fieldPvr.parent.append(labelPvrSize);


      var labelPvrWarning = new ui.Label({
          text: 'Compressed texture will be resized square'
      });
      labelPvrWarning.class.add('pvr-warning');
      fieldPvr.parent.parent.append(labelPvrWarning);
      labelPvrWarning.hidden = true;

      var updatePvrWarning = function () {
          var hidden = true;
          // only show pvr warning if any selected texture is non-square
          // and pvr is ticked
          if (fieldPvr.value && !fieldPvr.disabled) {
              for (var i = 0; i < assets.length; i++) {
                  if (assets[i].get('meta.width') !== assets[i].get('meta.height')) {
                      hidden = false;
                      break;
                  }
              }
          }

          labelPvrWarning.hidden = hidden;
      };

      fieldPvr.on('change', updatePvrWarning);

      // etc1
      var fieldEtc1 = editor.call('attributes:addField', {
          parent: panelCompression,
          type: 'checkbox',
          name: 'ETC1',
          link: assets,
          path: 'meta.compress.etc1'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:compress:etc1', fieldEtc1.parent.innerElement.firstChild.ui);

      // label
      var labelEtc1Size = labelSize['etc1'] = new ui.Label({
          text: bytesToHuman(formats.etc1.size) + ' [VRAM ' + bytesToHuman(formats.etc1.vram) + ']'
      });
      labelEtc1Size.class.add('size');
      if (! formats.etc1.size && ! formats.etc1.vram) labelEtc1Size.text = '-';
      fieldEtc1.parent.append(labelEtc1Size);

      // etc2
      var fieldEtc2 = editor.call('attributes:addField', {
          parent: panelCompression,
          type: 'checkbox',
          name: 'ETC2',
          link: assets,
          path: 'meta.compress.etc2'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:texture:compress:etc2', fieldEtc2.parent.innerElement.firstChild.ui);

      // label
      var labelEtc2Size = labelSize['etc2'] = new ui.Label({
          text: bytesToHuman(formats.etc2.size) + ' [VRAM ' + bytesToHuman(formats.etc2.vram) + ']'
      });
      labelEtc2Size.class.add('size');
      if (! formats.etc2.size && ! formats.etc2.vram) labelEtc2Size.text = '-';
      fieldEtc2.parent.append(labelEtc2Size);

      checkFormats();

      var bindSizeCalculate = function(format) {
          for(var i = 0; i < assets.length; i++) {
              events.push(assets[i].on('file.variants.' + format + '.size:set', function() { queueSizeCalculate(format); }));
              events.push(assets[i].on('file.variants.' + format + '.size:unset', function() { queueSizeCalculate(format); }));
              events.push(assets[i].on('file.variants.' + format + '.sizeGzip:set', function() { queueSizeCalculate(format); }));
              events.push(assets[i].on('file.variants.' + format + '.sizeGzip:unset', function() { queueSizeCalculate(format); }));
          }
      };

      for(var key in formats) {
          if (key === 'original')
              continue;

          bindSizeCalculate(key);
      }


      var btnCompress = new ui.Button();
      btnCompress.text = 'Compress';
      btnCompress.class.add('compress-asset', 'large-with-icon');
      btnCompress.disabled = true;
      btnCompress.on('click', function() {
          for(var i = 0; i < assets.length; i++) {
              if (! assets[i].get('file'))
                  continue;

              var variants = [ ];
              var toDelete = [ ];

              for(var key in formats) {
                  if (key === 'original')
                      continue;

                  if (checkCompressRequired(assets[i], key)) {
                      var width = assets[i].get('meta.width');
                      var height = assets[i].get('meta.height');

                      // no width/height
                      if (! width || ! height)
                          continue;

                      // non pot
                      if ((width & (width - 1)) !== 0 || (height & (height - 1)) !== 0)
                          continue;

                      var compress = assets[i].get('meta.compress.' + key);

                      if (assets[i].get('data.rgbm'))
                          compress = false;

                      if (compress && key === 'etc1') {
                          if (assets[i].get('meta.compress.alpha') && (assets[i].get('meta.alpha') || (assets[i].get('meta.type') || '').toLowerCase() === 'truecoloralpha'))
                              compress = false;
                      }

                      if (compress) {
                          variants.push(key);
                      } else {
                          toDelete.push(key);
                      }
                  }
              }

              if (toDelete.length) {
                  editor.call('realtime:send', 'pipeline', {
                      name: 'delete-variant',
                      data: {
                          asset: parseInt(assets[i].get('uniqueId'), 10),
                          options: {
                              formats: toDelete
                          }
                      }
                  });
              }

              if (variants.length) {
                  var task = {
                      asset: parseInt(assets[i].get('uniqueId'), 10),
                      options: {
                          formats: variants,
                          alpha: assets[i].get('meta.compress.alpha') && (assets[i].get('meta.alpha') || assets[i].get('meta.type').toLowerCase() === 'truecoloralpha'),
                          mipmaps: assets[i].get('data.mipmaps')
                      }
                  };

                  if (variants.indexOf('pvr') !== -1)
                      task.options.pvrBpp = assets[i].get('meta.compress.pvrBpp');

                  var sourceId = assets[i].get('source_asset_id');
                  if (sourceId) {
                      var sourceAsset = editor.call('assets:get', sourceId);
                      if (sourceAsset)
                          task.source = parseInt(sourceAsset.get('uniqueId'), 10);
                  }

                  editor.call('realtime:send', 'pipeline', {
                      name: 'compress',
                      data: task
                  });
              }
          }

          btnCompress.disabled = true;
      });
      panelCompression.append(btnCompress);

      var checkCompressRequired = function(asset, format) {
          if (! asset.get('file'))
              return false;

          var data = asset.get('file.variants.' + format);
          var rgbm = asset.get('data.rgbm');
          var alpha = asset.get('meta.compress.alpha') && (asset.get('meta.alpha') || ((asset.get('meta.type') || '').toLowerCase() === 'truecoloralpha')) || rgbm;
          var compress = asset.get('meta.compress.' + format);
          var mipmaps = asset.get('data.mipmaps');

          if (!! data !== compress) {
              if (format === 'etc1' && alpha)
                  return false;

              if (rgbm && ! data)
                  return false;

              return true;
          } else if (data && ((((data.opt & 1) !== 0) != alpha))) {
              return true;
          }

          if (data && format === 'pvr') {
              var bpp = asset.get('meta.compress.pvrBpp');
              if (data && ((data.opt & 128) !== 0 ? 4 : 2) !== bpp)
                  return true;
          } else if (format === 'etc1') {
              if (data && alpha)
                  return true;

              if (! data && alpha)
                  return false;
          }

          if (data && ((data.opt & 4) !== 0) !== ! mipmaps)
              return true;

          return false;
      };

      var checkCompression = function() {
          var different = false;

          for(var i = 0; i < assets.length; i++) {
              if (! assets[i].get('file') || !! assets[i].get('task'))
                  continue;

              for(var key in formats) {
                  if (key === 'original')
                      continue;

                  if (checkCompressRequired(assets[i], key)) {
                      different = true;
                      break;
                  }
              }

              if (different)
                  break;
          }

          btnCompress.disabled = ! different;
      };
      var queueCheck = false;
      var onAssetChangeCompression = function(path) {
          if (queueCheck || (path !== 'task' && ! path.startsWith('meta') && ! path.startsWith('file') && ! path.startsWith('data.rgbm') && ! path.startsWith('data.mipmaps')))
              return;

          queueCheck = true;
          setTimeout(function() {
              queueCheck = false;
              checkFormats();
              checkCompression();
              checkCompressAlpha();
          }, 0);
      };
      for(var i = 0; i < assets.length; i++) {
          events.push(assets[i].on('*:set', onAssetChangeCompression));
          events.push(assets[i].on('*:unset', onAssetChangeCompression));
      }
      checkCompression();


      // preview
      if (assets.length === 1) {
          var root = editor.call('attributes.rootPanel');

          var reloadImage = function() {
              if (assets[0].get('file.url') && assets[0].get('file.hash')) {
                  image.src = config.url.home + assets[0].get('file.url').appendQuery('t=' + assets[0].get('file.hash'));
                  previewContainer.hidden = false;
              } else {
                  previewContainer.hidden = true;
              }
          };

          var previewContainer = new pcui.Container();
          previewContainer.class.add('asset-preview-container');

          var preview = document.createElement('div');
          preview.classList.add('asset-preview');
          var image = new Image();
          image.onload = function() {
              root.class.add('animate');
              preview.style.backgroundImage = 'url("' + image.src  + '")';
          };
          reloadImage();
          previewContainer.append(preview);

          preview.addEventListener('click', function() {
              if (root.class.contains('large')) {
                  root.class.remove('large');
              } else {
                  root.class.add('large');
              }
          }, false);

          root.class.add('asset-preview');
          root.prepend(previewContainer);

          var events = [ ];
          events.push(assets[0].on('file.hash:set', reloadImage));
          events.push(assets[0].on('file.url:set', reloadImage));

          panel.on('destroy', function() {
              for(var i = 0; i < events.length; i++)
                  events[i].unbind();

              root.class.remove('asset-preview', 'animate');
          });
      }

      panel.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();
      });
  });
});


/* editor/attributes/assets/attributes-asset-font.js */
editor.once('load', function() {
  'use strict';

  // get characters between range (inclusive)
  var characterRange = function (from, to) {
      var chars = [];
      for (var i = from; i <= to; i++) {
          chars.push(String.fromCharCode(i));
      }

      return chars.join('');
  };

  // character presets
  var LATIN = characterRange(0x20, 0x7e);
  var LATIN_SUPPLEMENT = characterRange(0xA0, 0xFF);
  var CYRILLIC = characterRange(0x400, 0x4ff);
  var GREEK = characterRange(0x370, 0x3FF);

  editor.on('attributes:inspect[asset]', function(assets) {
      var root = editor.call('attributes.rootPanel');

      for(var i = 0; i < assets.length; i++) {
          if (assets[i].get('type') !== 'font' || assets[i].get('source'))
              return;
      }

      var events = [ ];

      if (assets.length > 1)
          editor.call('attributes:header', assets.length + ' Fonts');

      // Properties
      var panelProperties = editor.call('attributes:addPanel', {
          name: "Properties"
      });
      panelProperties.class.add('component');

      var fontIntensity = editor.call('attributes:addField', {
          parent: panelProperties,
          name: 'Intensity',
          type: 'number',
          min: 0,
          max: 1,
          link: assets,
          path: 'data.intensity'
      });
      fontIntensity.style.width = '32px';

      // reference
      editor.call('attributes:reference:attach', 'asset:font:intensity', fontIntensity.parent.innerElement.firstChild.ui);

      var fontIntensitySlider = editor.call('attributes:addField', {
          panel: fontIntensity.parent,
          slider: true,
          type: 'number',
          min: 0,
          max: 1,
          link: assets,
          path: 'data.intensity'
      });

      fontIntensitySlider.flexGrow = 4;

      // Character Presets
      var panelCharacterSets = editor.call('attributes:addPanel', {
          name: 'Character Presets'
      });
      panelCharacterSets.class.add('component');

      // reference
      editor.call('attributes:reference:attach', 'asset:font:presets', panelCharacterSets, panelCharacterSets.headerElement);

      // buttons to add character sets
      var names = [
          'Latin',
          'Latin Supplement',
          'Cyrillic',
          'Greek'
      ];

      var sets = [
          LATIN,
          LATIN_SUPPLEMENT,
          CYRILLIC,
          GREEK
      ];

      // Add a button for each preset
      // which adds the respected preset to the selected
      // assets's characters
      sets.forEach(function (set, index) {
          var btn = new ui.Button({
              text: names[index]
          });

          panelCharacterSets.append(btn);

          btn.on('click', function () {
              proxyObservers.forEach(function (proxy) {
                  var val = proxy.get('chars');
                  val += set;
                  proxy.set('chars', val);
              });

              fieldFrom.value = '0x' + set.charCodeAt(0).toString(16);
              fieldTo.value = '0x' + set.charCodeAt(set.length-1).toString(16);
          });
      });

      // Custom Range
      var panelCustomRange = editor.call('attributes:addPanel', {
          name: 'Custom Character Range'
      });
      panelCustomRange.class.add('component');

      // reference
      editor.call('attributes:reference:attach', 'asset:font:customRange', panelCustomRange, panelCustomRange.headerElement);

      // Range buttons
      var panelRange = editor.call('attributes:addField', {
          parent: panelCustomRange,
          name: 'Range (hex)'
      });
      var label = panelRange;
      panelRange = panelRange.parent;
      label.destroy();

      var fieldFrom = editor.call('attributes:addField', {
          panel: panelRange,
          type: 'string',
          placeholder: 'From',
          value: '0x20'
      });

      // fieldFrom.style.width = '32px';

      fieldFrom.renderChanges = false;

      var fieldTo = editor.call('attributes:addField', {
          panel: panelRange,
          type: 'string',
          placeholder: 'To',
          value: '0x7E'
      });

      fieldTo.renderChanges = false;

      // fieldTo.style.width = '32px';

      var btnAddRange = new ui.Button({
          text: '&#57632;',
      });
      btnAddRange.class.add('font-icon');

      panelRange.append(btnAddRange);

      btnAddRange.on('click', function () {
          var from = parseInt(fieldFrom.value, 16);
          if (! from )
              return;
          var to = parseInt(fieldTo.value, 16);
          if (! to )
              return;

          if (from > to)
              return;

          var range = characterRange(from, to);

          proxyObservers.forEach(function (proxy) {
              var val = proxy.get('chars');
              val += range;
              proxy.set('chars', val);
          });
      });


      // Characters
      var paramsPanel = editor.call('attributes:addPanel', {
          name: 'Font'
      });
      paramsPanel.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:font:asset', paramsPanel, paramsPanel.headerElement);

      // preview
      if (assets.length === 1) {
          var previewContainer = new pcui.Container();
          previewContainer.class.add('asset-preview-container');

          var preview = document.createElement('canvas');
          var ctx = preview.getContext('2d');
          preview.width = 256;
          preview.height = 256;
          preview.classList.add('asset-preview');
          preview.classList.add('flipY');
          previewContainer.append(preview);

          preview.addEventListener('click', function() {
              if (root.class.contains('large')) {
                  root.class.remove('large');
              } else {
                  root.class.add('large');
              }

              queueRender();
          }, false);

          root.class.add('asset-preview');
          root.prepend(previewContainer);

          var renderQueued;

          var renderPreview = function () {
              if (renderQueued)
                  renderQueued = false;

              // render
              editor.call('preview:render', assets[0], previewContainer.width, previewContainer.height, preview);
          };
          renderPreview();

          // queue up the rendering to prevent too oftern renders
          var queueRender = function() {
              if (renderQueued) return;
              renderQueued = true;
              requestAnimationFrame(renderPreview);
          };

          // render on resize
          var evtPanelResize = root.on('resize', queueRender);
          var evtSceneSettings = editor.on('preview:scene:changed', queueRender);

          // font resource loaded
          var watcher = editor.call('assets:font:watch', {
              asset: assets[0],
              autoLoad: true,
              callback: queueRender
          });

          var renderTimeout;

          paramsPanel.once('destroy', function() {
              root.class.remove('asset-preview', 'animate');

              editor.call('assets:font:unwatch', assets[0], watcher);
              evtPanelResize.unbind();
              evtSceneSettings.unbind();

              paramsPanel = null;
          });
      }

      // set up proxy observer list which is used
      // to allow the user to edit meta data of each font only locally
      // Then when process font is clicked the pipeline takes care of
      // saving those meta fields in the db
      var proxyObservers = [];

      var createProxy = function (asset) {
          var proxy = new Observer({
              'id': asset.get('id'),
              'chars': asset.get('meta.chars'),
              'invert': !!asset.get('meta.invert'),
              'pxrange': asset.get('meta.pxrange')
          });

          proxyObservers.push(proxy);

          events.push(asset.on('meta.chars:set', function (value) {
              proxy.set('chars', value);
          }));

          events.push(asset.on('meta.invert:set', function (value) {
              proxy.set('invert', value);
          }));

          events.push(asset.on('meta.pxrange:set', function (value) {
              proxy.set('pxrange', value);
          }));
      };

      // create proxy observer for each asset
      assets.forEach(createProxy);

      // characters
      var fieldChars = editor.call('attributes:addField', {
          parent: paramsPanel,
          type: 'string',
          name: 'Characters',
          link: proxyObservers,
          path: 'chars'
      });

      // Change handler
      fieldChars.on('change', toggleSaveButton);

      // reference
      editor.call('attributes:reference:attach', 'asset:font:characters', fieldChars.parent.innerElement.firstChild.ui);

      // invert
      var fieldInvert = editor.call('attributes:addField', {
          parent: paramsPanel,
          type: 'checkbox',
          name: 'Invert',
          link: proxyObservers,
          path: 'invert'
      });
      // fieldInvert.parent.hidden = true;

      // reference
      editor.call('attributes:reference:attach', 'asset:font:invert', fieldInvert.parent.innerElement.firstChild.ui);

      // signed distance range
      var fieldRange = editor.call('attributes:addField', {
          parent: paramsPanel,
          type: 'number',
          name: 'MSDF Range',
          link: proxyObservers,
          path: 'pxrange',
          min: 0,
          max: 15,
          step: 1,
          precision: 0
      });

      fieldRange.style.width = '32px';

      // hide for now
      fieldRange.parent.hidden = true;

      // reference
      editor.call('attributes:reference:attach', 'asset:font:pxrange', fieldRange.parent.innerElement.firstChild.ui);


      var fieldRangeSlider = editor.call('attributes:addField', {
          panel: fieldRange.parent,
          type: 'number',
          link: proxyObservers,
          path: 'pxrange',
          min: 0,
          max: 15,
          step: 1,
          slider: true,
          precision: 0
      });

      fieldRangeSlider.flexGrow = 4;

      var panelSave = editor.call('attributes:addPanel', {
          parent: paramsPanel
      });
      panelSave.class.add('buttons');

      // save button
      var btnSave = new ui.Button({
          text: 'Process Font' + (assets.length > 1 ? 's' : '')
      });
      btnSave.style.flexGrow = 1;
      btnSave.style.width = '100%';
      btnSave.style.textAlign = 'center';

      panelSave.append(btnSave);

      // Enables or disabled the SAVE button
      var toggleSaveButton = function () {
          var sameChars = true;
          var lastChars = proxyObservers[0].get('chars');
          for (var i = 1; i < proxyObservers.length; i++) {
              if (proxyObservers[i].get('chars') !== lastChars) {
                  sameChars = false;
                  break;
              }
          }

          if (! sameChars) {
              btnSave.disabled = true;
              return;
          }

          var tasksInProgress = false;

          for (var i = 0; i < assets.length; i++) {
              if (!editor.call('assets:get', assets[i].get('source_asset_id'))) {
                  btnSave.disabled = true;
                  return;
              }

              if (assets[i].get('task') === 'running') {
                  tasksInProgress = true;
                  break;
              }
          }

          btnSave.disabled = tasksInProgress;
      };


      toggleSaveButton();

      // subscribe to asset task updates to disable / enable the button
      assets.forEach(function (asset) {
          events.push(asset.on('task:set', toggleSaveButton));
      });

      // Trigger pipeline job
      btnSave.on('click', function () {
          var value = fieldChars.value;

          if (! value || value === '...')
              return;

          proxyObservers.forEach(function (proxy) {
              var asset = editor.call('assets:get', proxy.get('id'));
              if (! asset) return;

              var sourceId = asset.get('source_asset_id');
              if (! sourceId) return;

              var source = editor.call('assets:get', sourceId);
              if (! source) return;

              // remove duplicate chars
              // remove duplicate chars but keep same order
              var unique = '';
              var chars = {};

              for (var i = 0, len = value.length; i < len; i++) {
                  if (chars[value[i]]) continue;
                  chars[value[i]] = true;
                  unique += value[i];
              }

              var task = {
                  source: parseInt(source.get('uniqueId'), 10),
                  target: parseInt(asset.get('uniqueId'), 10),
                  chars: unique,
                  invert: fieldInvert.value
              };

              // if (fieldRange.value !== null)
              //     task.pxrange = fieldRange.value;

              editor.call('realtime:send', 'pipeline', {
                  name: 'convert',
                  data: task
              });
          });
      });

      paramsPanel.once('destroy', function() {
          for(var i = 0; i < events.length; i++)
              events[i].unbind();
      });
  });
});


/* editor/attributes/assets/attributes-asset-bundle.js */
editor.once('load', function () {
  'use strict';

  editor.on('attributes:inspect[asset]', function (assets) {
      for (var i = 0; i < assets.length; i++) {
          if (assets[i].get('type') !== 'bundle')
              return;
      }

      var events = [];

      // panel
      var panel = editor.call('attributes:assets:panel');

      var panelAttributes = editor.call('attributes:addPanel', {
          name: 'ASSETS'
      });
      panelAttributes.class.add('component');

      // assets list
      var fieldAssets = editor.call('attributes:addAssetsList', {
          panel: panelAttributes,
          type: '*',
          filterFn: function (asset) {
              if (! asset) return false;
              if (asset.get('source')) return false;
              var type = asset.get('type');
              if (type === 'script' || type === 'folder' || type === 'bundle') return false;

              return true;
          },
          link: assets,
          path: 'data.assets'
      });

      panel.once('destroy', function () {
          for (var i = 0; i < events.length; i++) {
              events[i].unbind();
          }
          events.length = 0;
      });
  });
});


/* editor/attributes/assets/attributes-asset-wasm.js */
editor.once('load', function() {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length !== 1 || assets[0].get('type') !== 'wasm' || assets[0].get('source'))
          return;

      // panel
      var panel = editor.call('attributes:addPanel', {
          name: 'Wasm Module'
      });
      panel.class.add('component');
      // reference
      editor.call('attributes:reference:attach', 'asset:wasm:asset', panel, panel.headerElement);

      // module name
      var moduleName = editor.call('attributes:addField', {
          parent: panel,
          type: 'string',
          name: 'Name',
          link: assets,
          path: 'data.moduleName'
      });
      // reference
      editor.call('attributes:reference:attach', 'asset:wasm:moduleName', moduleName._label);

      // glue script
      var glueScript = editor.call('attributes:addField', {
          parent: panel,
          type: 'asset',
          kind: 'script',
          name: 'Glue script',
          link: assets,
          path: 'data.glueScriptId',
      });
      glueScript.parent.class.add('script-picker');

      // reference
      editor.call('attributes:reference:attach', 'asset:wasm:glueScriptId', glueScript._label);        

      // fallback script
      var fallbackScript = editor.call('attributes:addField', {
          parent: panel,
          type: 'asset',
          kind: 'script',
          name: 'Fallback script',
          link: assets,
          path: 'data.fallbackScriptId',
      });
      fallbackScript.parent.class.add('script-picker');

      // reference
      editor.call('attributes:reference:attach', 'asset:wasm:fallbackScriptId', fallbackScript._label);

  });
});

/* editor/attributes/attributes-asset-localization.js */
editor.once('load', function () {
  'use strict';

  editor.on('attributes:inspect[asset]', function(assets) {
      if (assets.length > 1) return;
      var asset = assets[0];
      if (asset.get('source')) return;
      if (asset.get('type') !== 'font') return;

      var regexI18n = /^i18n\.[^\.]+?$/;

      var events = [];

      var panel = editor.call('attributes:addPanel', {
          name: "LOCALIZATION"
      });
      panel.class.add('component');
      panel.class.add('localization');

      // reference
      editor.call('attributes:reference:attach', 'asset:localization', panel, panel.headerElement);

      // Add locale
      var fieldAddLocale = editor.call('attributes:addField', {
          parent: panel,
          name: 'Add Locale',
          type: 'string',
          placeholder: 'Type to add (e.g. en-US)'
      });

      fieldAddLocale.class.add('add-locale');

      // validate new locale and add it to the asset
      fieldAddLocale.on('change', function (value) {
          fieldAddLocale.class.remove('error');

          if (!value) {
              return;
          }

          var error = false;

          if (asset.has('i18n.' + value)) {
              error = true;
          } else if (value.length > 10) {
              error = true;
          } else if (! /^[a-zA-Z0-9\-]+$/.test(value)) {
              error = true;
          }

          if (error) {
              fieldAddLocale.class.add('error');
              return;
          }

          asset.set('i18n.' + value, null);

          fieldAddLocale.value = '';
      });

      var panelLocales = new ui.Panel();
      panel.append(panelLocales);

      var localePanelsIndex = {};

      // Creates panel for each locale
      var createLocalePanel = function (locale) {
          localePanelsIndex[locale] = true;

          var panelLocale = new ui.Panel(locale);
          panelLocale.class.add('component');
          panelLocale.class.add('locale');

          // remove locale button
          var btnRemove = new ui.Button({
              text: '&#57650;'
          });
          btnRemove.class.add('remove');
          panelLocale.headerElement.appendChild(btnRemove.element);

          btnRemove.on('click', function () {
              asset.unset('i18n.' + locale);
          });

          // replacement asset
          var fieldAsset = editor.call('attributes:addField', {
              parent: panelLocale,
              name: 'Asset',
              type: 'asset',
              kind: asset.get('type'),
              link: assets,
              path: 'i18n.' + locale
          });

          events.push(asset.once('i18n.' + locale + ':unset', function () {
              panelLocale.destroy();
              panelLocale = null;
              delete localePanelsIndex[locale];
          }));

          return panelLocale;
      };

      // Add locale panel when one is added to the asset
      asset.on('*:set', function (path) {
          if (!regexI18n.test(path)) return;

          var parts = path.split('.');
          var locale = parts[1];

          // if panel for locale already exists then skip this
          if (localePanelsIndex[locale]) return;

          var panelLocale = createLocalePanel(locale);

          var sorted = Object.keys(asset.get('i18n')).sort();
          var idx = sorted.indexOf(locale);
          if (idx !== -1) {
              panelLocales.appendBefore(panelLocale, panelLocales.innerElement.childNodes[idx]);
          }
      });

      // Add existing locales sorted by locale
      Object.keys(asset.get('i18n')).sort().forEach(function (locale) {
          var panelLocale = createLocalePanel(locale);
          panelLocales.append(panelLocale);
      });

      // clear events
      panel.on('destroy', function () {
          for (var i = 0; i < events.length; i++) {
              events[i].unbind();
          }
          events.length = 0;
      });

  });
});
