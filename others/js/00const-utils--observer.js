/* constants.js */
var DEFAULT_CULLING_MASK = 0xFFFFFFFF;
var GEOMETRY_ONLY_CULLING_MASK = 1 | 2 | 4;
var GIZMO_MASK = 8;

// Layer ids
var LAYERID_WORLD = 0;
var LAYERID_DEPTH = 1;
var LAYERID_SKYBOX = 2;
var LAYERID_IMMEDIATE = 3;
var LAYERID_UI = 4;

// Layout groups
var ORIENTATION_HORIZONTAL = 0;
var ORIENTATION_VERTICAL = 1;
var FITTING_NONE = 0;
var FITTING_STRETCH = 1
var FITTING_SHRINK = 2
var FITTING_BOTH = 3;

// Buttons
var BUTTON_TRANSITION_MODE_TINT = 0;
var BUTTON_TRANSITION_MODE_SPRITE_CHANGE = 1;

// Scroll Views
var SCROLL_MODE_CLAMP = 0;
var SCROLL_MODE_BOUNCE = 1;
var SCROLL_MODE_INFINITE = 2;

var SCROLLBAR_VISIBILITY_SHOW_ALWAYS = 0;
var SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED = 1;


var CURVE_LINEAR = 0;
var CURVE_SMOOTHSTEP = 1;
var CURVE_CATMULL = 2;
var CURVE_CARDINAL = 3;
var CURVE_SPLINE = 4;
var CURVE_STEP = 5;

// Script Loading Type
var LOAD_SCRIPT_AS_ASSET = 0;
var LOAD_SCRIPT_BEFORE_ENGINE = 1;
var LOAD_SCRIPT_AFTER_ENGINE = 2;


/* array.js */
Object.defineProperty(Array.prototype, 'equals', {
    enumerable: false,
    value: function(array) {
        if (! array)
            return false;

        if (this.length !== array.length)
            return false;

        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i] instanceof Array && array[i] instanceof Array) {
                if (! this[i].equals(array[i]))
                    return false;
            } else if (this[i] !== array[i]) {
                return false;
            }
        }
        return true;
    }
});

Object.defineProperty(Array.prototype, 'match', {
    enumerable: false,
    value: function(pattern) {
        if (this.length !== pattern.length)
            return;

        for(var i = 0, l = this.length; i < l; i++) {
            if (pattern[i] !== '*' && pattern[i] !== this[i])
                return false;
        }

        return true;
    }
});


// Object.defineProperty(Array.prototype, 'binaryIndexOf', {
//     enumerable: false,
//     value: function(b) {
//         var min = 0;
//         var max = this.length - 1;
//         var cur;
//         var a;

//         while (min <= max) {
//             cur = Math.floor((min + max) / 2);
//             a = this[cur];

//             if (a < b) {
//                 min = cur + 1;
//             } else if (a > b) {
//                 max = cur - 1;
//             } else {
//                 return cur;
//             }
//         }

//         return -1;
//     }
// });



/* utils.js */
var utils = { };


// utils.deepCopy
utils.deepCopy = function deepCopy(data) {
    if (data == null || typeof(data) !== 'object')
        return data;

    if (data instanceof Array) {
        var arr = [ ];
        for(var i = 0; i < data.length; i++) {
            arr[i] = deepCopy(data[i]);
        }
        return arr;
    } else {
        var obj = { };
        for(var key in data) {
            if (data.hasOwnProperty(key))
                obj[key] = deepCopy(data[key]);
        }
        return obj;
    }
};

utils.isMobile = function() {
  return /Android/i.test(navigator.userAgent) ||
      /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * Copies all properties from source into target. Meant to be used
 * with prototypes.
 * @param {Object} target The target object
 * @param {Object} source The source object.
 * @example
 * // mixin interface
 * function superclass () {}
 * function interface () {}
 * function myclass () {
 *   superclass.call(this);
 *   interface.call(this);
 * }
 * myclass.prototype = Object.create(superclass.prototype);
 * utils.mixin(myclass.prototype, interface.prototype);
 * myclass.prototype.constructor = myclass;
 */
utils.mixin = function (target, source) {
    // not using Object.assign here because that does not copy
    // property definitions created with Object.defineProperty
    var properties = Object.getOwnPropertyDescriptors(source);
    Object.defineProperties(target, properties);
};

// String.startsWith
if (! String.prototype.startsWith) {
    Object.defineProperty(String.prototype, 'startsWith', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function(str) {
            var that = this;
            var ceil = str.length;
            for(var i = 0; i < ceil; i++)
                if(that[i] !== str[i]) return false;
            return true;
        }
    });
}

// String.endsWith polyfill
if (! String.prototype.endsWith) {
    Object.defineProperty(String.prototype, 'endsWith', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function(str) {
            var that = this;
            for(var i = 0, ceil = str.length; i < ceil; i++)
                if (that[i + that.length - ceil] !== str[i])
                    return false;
            return true;
        }
    });
}

// Appends query parameter to string (supposedly the string is a URL)
// automatically figuring out if the separator should be ? or &.
// Example: url.appendQuery('t=123').appendQuery('q=345');
if (! String.prototype.appendQuery) {
    Object.defineProperty(String.prototype, 'appendQuery', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: function (queryParameter) {
            var separator = this.indexOf('?') !== -1 ? '&' : '?';
            return this + separator + queryParameter;
        }
    });
}

// element.classList.add polyfill
(function () {
    /*global DOMTokenList */
    var dummy  = document.createElement('div'),
        dtp    = DOMTokenList.prototype,
        toggle = dtp.toggle,
        add    = dtp.add,
        rem    = dtp.remove;

    dummy.classList.add('class1', 'class2');

    // Older versions of the HTMLElement.classList spec didn't allow multiple
    // arguments, easy to test for
    if (!dummy.classList.contains('class2')) {
        dtp.add    = function () {
            Array.prototype.forEach.call(arguments, add.bind(this));
        };
        dtp.remove = function () {
            Array.prototype.forEach.call(arguments, rem.bind(this));
        };
    }
})();

var bytesToHuman = function(bytes) {
    if (isNaN(bytes) || bytes === 0) return '0 B';
    var k = 1000;
    var sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
};


// todo move this into proper library

// replace the oldExtension in a path with the newExtension
// return the new path
// oldExtension and newExtension should have leading period
var swapExtension = function (path, oldExtension, newExtension) {
    while(path.indexOf(oldExtension) >= 0) {
        path = path.replace(oldExtension, newExtension);
    }
    return path;
}


/* color.js */
var rgb2hsv = function(rgb) {
    var rr, gg, bb,
        r = rgb[0] / 255,
        g = rgb[1] / 255,
        b = rgb[2] / 255,
        h, s,
        v = Math.max(r, g, b),
        diff = v - Math.min(r, g, b),
        diffc = function(c) {
            return (v - c) / 6 / diff + 1 / 2;
        };

    if (diff == 0) {
        h = s = 0;
    } else {
        s = diff / v;
        rr = diffc(r);
        gg = diffc(g);
        bb = diffc(b);

        if (r === v) {
            h = bb - gg;
        } else if (g === v) {
            h = (1 / 3) + rr - bb;
        } else if (b === v) {
            h = (2 / 3) + gg - rr;
        }
        if (h < 0) {
            h += 1;
        } else if (h > 1) {
            h -= 1;
        }
    }
    return [ h, s, v ];
};


var hsv2rgb = function(hsv) {
    var h = hsv[0];
    var s = hsv[1];
    var v = hsv[2];
    var r, g, b, i, f, p, q, t;
    if (h && s === undefined && v === undefined) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return [ Math.round(r * 255), Math.round(g * 255), Math.round(b * 255) ];
};


/* ajax.js */
function Ajax(args) {
    if (typeof(args) === 'string')
        args = { url: args };

    return new AjaxRequest(args);
};

Ajax.get = function(url) {
    return new AjaxRequest({
        url: url
    });
};

Ajax.post = function(url, data) {
    return new AjaxRequest({
        method: 'POST',
        url: url,
        data: data
    });
};

Ajax.put = function(url, data) {
    return new AjaxRequest({
        method: 'PUT',
        url: url,
        data: data
    });
};

Ajax.delete = function(url) {
    return new AjaxRequest({
        method: 'DELETE',
        url: url
    });
};

Ajax.params = { };

Ajax.param = function(name, value) {
    Ajax.params[name] = value;
};



function AjaxRequest(args) {
    if (! args)
        throw new Error('no arguments provided');

    Events.call(this);

    // progress
    this._progress = 0.0;
    this.emit('progress', this._progress);

    // xhr
    this._xhr = new XMLHttpRequest();

    // send cookies
    if (args.cookies)
        this._xhr.withCredentials = true;

    // events
    this._xhr.addEventListener('load', this._onLoad.bind(this), false);
    // this._xhr.addEventListener('progress', this._onProgress.bind(this), false);
    this._xhr.upload.addEventListener('progress', this._onProgress.bind(this), false);
    this._xhr.addEventListener('error', this._onError.bind(this), false);
    this._xhr.addEventListener('abort', this._onAbort.bind(this), false);

    // url
    var url = args.url;

    // query
    if (args.query && Object.keys(args.query).length) {
        if (url.indexOf('?') === -1) {
            url += '?';
        }

        var query = [ ];
        for(var key in args.query) {
            query.push(key + '=' + args.query[key]);
        }

        url += query.join('&');
    }

    // templating
    var parts = url.split('{{');
    if (parts.length > 1) {
        for(var i = 1; i < parts.length; i++) {
            var ends = parts[i].indexOf('}}');
            var key = parts[i].slice(0, ends);

            if (Ajax.params[key] === undefined)
                continue;

            // replace
            parts[i] = Ajax.params[key] + parts[i].slice(ends + 2);
        }

        url = parts.join('');
    }

    // open request
    this._xhr.open(args.method || 'GET', url, true);

    this.notJson = args.notJson || false;

    // header for PUT/POST
    if (! args.ignoreContentType && (args.method === 'PUT' || args.method === 'POST' || args.method === 'DELETE'))
        this._xhr.setRequestHeader('Content-Type', 'application/json');

    if (args.auth && config.accessToken) {
        this._xhr.setRequestHeader('Authorization', 'Bearer ' + config.accessToken);
    }

    if (args.headers) {
        for (var key in args.headers)
            this._xhr.setRequestHeader(key, args.headers[key]);
    }

    // stringify data if needed
    if (args.data && typeof(args.data) !== 'string' && ! (args.data instanceof FormData)) {
        args.data = JSON.stringify(args.data);
    }

    // make request
    this._xhr.send(args.data || null);
};
AjaxRequest.prototype = Object.create(Events.prototype);


AjaxRequest.prototype._onLoad = function() {
    this._progress = 1.0;
    this.emit('progress', 1.0);

    if (this._xhr.status === 200 || this._xhr.status === 201) {
        if (this.notJson) {
            this.emit('load', this._xhr.status, this._xhr.responseText);
        } else {
            try {
                var json = JSON.parse(this._xhr.responseText);
            } catch(ex) {
                this.emit('error', this._xhr.status || 0, new Error('invalid json'));
                return;
            }
            this.emit('load', this._xhr.status, json);
        }
    } else {
        try {
            var json = JSON.parse(this._xhr.responseText);
            var msg = json.message;
            if (! msg) {
                msg = json.error || (json.response && json.response.error);
            }

            if (! msg) {
                msg = this._xhr.responseText;
            }

            this.emit('error', this._xhr.status, msg);
        } catch (ex) {
            this.emit('error', this._xhr.status);
        }
    }
};


AjaxRequest.prototype._onError = function(evt) {
    this.emit('error', 0, evt);
};


AjaxRequest.prototype._onAbort = function(evt) {
    this.emit('error', 0, evt);
};


AjaxRequest.prototype._onProgress = function(evt) {
    if (! evt.lengthComputable)
        return;

    var progress = evt.loaded / evt.total;

    if (progress !== this._progress) {
        this._progress = progress;
        this.emit('progress', this._progress);
    }
};


AjaxRequest.prototype.abort = function() {
    this._xhr.abort();
};


/* observer.js */
"use strict";

function Observer(data, options) {
    Events.call(this);
    options = options || { };

    this._destroyed = false;
    this._path = '';
    this._keys = [ ];
    this._data = { };

    // array paths where duplicate entries are allowed - normally
    // we check if an array already has a value before inserting it
    // but if the array path is in here we'll allow it
    this._pathsWithDuplicates = null;
    if (options.pathsWithDuplicates) {
        this._pathsWithDuplicates = {};
        for (var i = 0; i < options.pathsWithDuplicates.length; i++) {
            this._pathsWithDuplicates[options.pathsWithDuplicates[i]] = true;
        }
    }

    this.patch(data);

    this._parent = options.parent || null;
    this._parentPath = options.parentPath || '';
    this._parentField = options.parentField || null;
    this._parentKey = options.parentKey || null;

    this._silent = false;

    var propagate = function(evt) {
        return function(path, arg1, arg2, arg3) {
            if (! this._parent)
                return;

            var key = this._parentKey;
            if (! key && (this._parentField instanceof Array)) {
                key = this._parentField.indexOf(this);

                if (key === -1)
                    return;
            }

            path = this._parentPath + '.' + key + '.' + path;

            var state;
            if (this._silent)
                state = this._parent.silence();

            this._parent.emit(path + ':' + evt, arg1, arg2, arg3);
            this._parent.emit('*:' + evt, path, arg1, arg2, arg3);

            if (this._silent)
                this._parent.silenceRestore(state);
        }
    };

    // propagate set
    this.on('*:set', propagate('set'));
    this.on('*:unset', propagate('unset'));
    this.on('*:insert', propagate('insert'));
    this.on('*:remove', propagate('remove'));
    this.on('*:move', propagate('move'));
}
Observer.prototype = Object.create(Events.prototype);

Observer.prototype.silence = function() {
    this._silent = true;

    // history hook to prevent array values to be recorded
    var historyState = this.history && this.history.enabled;
    if (historyState)
        this.history.enabled = false;

    // sync hook to prevent array values to be recorded as array root already did
    var syncState = this.sync && this.sync.enabled;
    if (syncState)
        this.sync.enabled = false;

    return [ historyState, syncState ];
};


Observer.prototype.silenceRestore = function(state) {
    this._silent = false;

    if (state[0])
        this.history.enabled = true;

    if (state[1])
        this.sync.enabled = true;
};


Observer.prototype._prepare = function(target, key, value, silent, remote) {
    var self = this;
    var state;
    var path = (target._path ? (target._path + '.') : '') + key;
    var type = typeof(value);

    target._keys.push(key);

    if (type === 'object' && (value instanceof Array)) {
        target._data[key] = value.slice(0);

        for(var i = 0; i < target._data[key].length; i++) {
            if (typeof(target._data[key][i]) === 'object' && target._data[key][i] !== null) {
                if (target._data[key][i] instanceof Array) {
                    target._data[key][i].slice(0);
                } else {
                    target._data[key][i] = new Observer(target._data[key][i], {
                        parent: this,
                        parentPath: path,
                        parentField: target._data[key],
                        parentKey: null
                    });
                }
            } else {
                state = this.silence();
                this.emit(path + '.' + i + ':set', target._data[key][i], null, remote);
                this.emit('*:set', path + '.' + i, target._data[key][i], null, remote);
                this.silenceRestore(state);
            }
        }

        if (silent)
            state = this.silence();

        this.emit(path + ':set', target._data[key], null, remote);
        this.emit('*:set', path, target._data[key], null, remote);

        if (silent)
            this.silenceRestore(state);
    } else if (type === 'object' && (value instanceof Object)) {
        if (typeof(target._data[key]) !== 'object') {
            target._data[key] = {
                _path: path,
                _keys: [ ],
                _data: { }
            };
        }

        for(var i in value) {
            if (typeof(value[i]) === 'object') {
                this._prepare(target._data[key], i, value[i], true, remote);
            } else {
                state = this.silence();

                target._data[key]._data[i] = value[i];
                target._data[key]._keys.push(i);

                this.emit(path + '.' + i + ':set', value[i], null, remote);
                this.emit('*:set', path + '.' + i, value[i], null, remote);

                this.silenceRestore(state);
            }
        }

        if (silent)
            state = this.silence();

        // passing undefined as valueOld here
        // but we should get the old value to be consistent
        this.emit(path + ':set', value, undefined, remote);
        this.emit('*:set', path, value, undefined, remote);

        if (silent)
            this.silenceRestore(state);
    } else {
        if (silent)
            state = this.silence();

        target._data[key] = value;

        this.emit(path + ':set', value, undefined, remote);
        this.emit('*:set', path, value, undefined, remote);

        if (silent)
            this.silenceRestore(state);
    }

    return true;
};


Observer.prototype.set = function(path, value, silent, remote, force) {
    var keys = path.split('.');
    var length = keys.length;
    var key = keys[length - 1];
    var node = this;
    var nodePath = '';
    var obj = this;
    var state;

    for(var i = 0; i < length - 1; i++) {
        if (node instanceof Array) {
            node = node[keys[i]];

            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else {
            if (i < length && typeof(node._data[keys[i]]) !== 'object') {
                if (node._data[keys[i]])
                    obj.unset((node.__path ? node.__path + '.' : '') + keys[i]);

                node._data[keys[i]] = {
                    _path: path,
                    _keys: [ ],
                    _data: { }
                };
                node._keys.push(keys[i]);
            }

            if (i === length - 1 && node.__path)
                nodePath = node.__path + '.' + keys[i];

            node = node._data[keys[i]];
        }
    }

    if (node instanceof Array) {
        var ind = parseInt(key, 10);
        if (node[ind] === value && !force)
            return;

        var valueOld = node[ind];
        if (valueOld instanceof Observer) {
            valueOld = valueOld.json();
        } else {
            valueOld = obj.json(valueOld);
        }

        node[ind] = value;

        if (value instanceof Observer) {
            value._parent = obj;
            value._parentPath = nodePath;
            value._parentField = node;
            value._parentKey = null;
        }

        if (silent)
            state = obj.silence();

        obj.emit(path + ':set', value, valueOld, remote);
        obj.emit('*:set', path, value, valueOld, remote);

        if (silent)
            obj.silenceRestore(state);

        return true;
    } else if (node._data && ! node._data.hasOwnProperty(key)) {
        if (typeof(value) === 'object') {
            return obj._prepare(node, key, value, false, remote);
        } else {
            node._data[key] = value;
            node._keys.push(key);

            if (silent)
                state = obj.silence();

            obj.emit(path + ':set', value, null, remote);
            obj.emit('*:set', path, value, null, remote);

            if (silent)
                obj.silenceRestore(state);

            return true;
        }
    } else {
        if (typeof(value) === 'object' && (value instanceof Array)) {
            if (value.equals(node._data[key]) && !force)
                return false;

            var valueOld = node._data[key];
            if (! (valueOld instanceof Observer))
                valueOld = obj.json(valueOld);

            if (node._data[key] && node._data[key].length === value.length) {
                state = obj.silence();

                for(var i = 0; i < node._data[key].length; i++) {
                    if (node._data[key][i] instanceof Observer) {
                        node._data[key][i].patch(value[i]);
                    } else if (node._data[key][i] !== value[i]) {
                        node._data[key][i] = value[i];
                        obj.emit(path + '.' + i + ':set', node._data[key][i], valueOld && valueOld[i] || null, remote);
                        obj.emit('*:set', path + '.' + i, node._data[key][i], valueOld && valueOld[i] || null, remote);
                    }
                }

                obj.silenceRestore(state);
            } else {
                node._data[key] = value;

                state = obj.silence();
                for(var i = 0; i < node._data[key].length; i++) {
                    obj.emit(path + '.' + i + ':set', node._data[key][i], valueOld && valueOld[i] || null, remote);
                    obj.emit('*:set', path + '.' + i, node._data[key][i], valueOld && valueOld[i] || null, remote);
                }
                obj.silenceRestore(state);
            }

            if (silent)
                state = obj.silence();

            obj.emit(path + ':set', value, valueOld, remote);
            obj.emit('*:set', path, value, valueOld, remote);

            if (silent)
                obj.silenceRestore(state);

            return true;
        } else if (typeof(value) === 'object' && (value instanceof Object)) {
            var changed = false;
            var valueOld = node._data[key];
            if (! (valueOld instanceof Observer))
                valueOld = obj.json(valueOld);

            var keys = Object.keys(value);

            if (! node._data[key] || ! node._data[key]._data) {
                if (node._data[key]) {
                    obj.unset((node.__path ? node.__path + '.' : '') + key);
                } else {
                    changed = true;
                }

                node._data[key] = {
                    _path: path,
                    _keys: [ ],
                    _data: { }
                };
            }

            for(var n in node._data[key]._data) {
                if (! value.hasOwnProperty(n)) {
                    var c = obj.unset(path + '.' + n, true);
                    if (c) changed = true;
                } else if (node._data[key]._data.hasOwnProperty(n)) {
                    if (! obj._equals(node._data[key]._data[n], value[n])) {
                        var c = obj.set(path + '.' + n, value[n], true);
                        if (c) changed = true;
                    }
                } else {
                    var c = obj._prepare(node._data[key], n, value[n], true, remote);
                    if (c) changed = true;
                }
            }

            for(var i = 0; i < keys.length; i++) {
                if (value[keys[i]] === undefined && node._data[key]._data.hasOwnProperty(keys[i])) {
                    var c = obj.unset(path + '.' + keys[i], true);
                    if (c) changed = true;
                } else if (typeof(value[keys[i]]) === 'object') {
                    if (node._data[key]._data.hasOwnProperty(keys[i])) {
                        var c = obj.set(path + '.' + keys[i], value[keys[i]], true);
                        if (c) changed = true;
                    } else {
                        var c = obj._prepare(node._data[key], keys[i], value[keys[i]], true, remote);
                        if (c) changed = true;
                    }
                } else if (! obj._equals(node._data[key]._data[keys[i]], value[keys[i]])) {
                    if (typeof(value[keys[i]]) === 'object') {
                        var c = obj.set(node._data[key]._path + '.' + keys[i], value[keys[i]], true);
                        if (c) changed = true;
                    } else if (node._data[key]._data[keys[i]] !== value[keys[i]]) {
                        changed = true;

                        if (node._data[key]._keys.indexOf(keys[i]) === -1)
                            node._data[key]._keys.push(keys[i]);

                        node._data[key]._data[keys[i]] = value[keys[i]];

                        state = obj.silence();
                        obj.emit(node._data[key]._path + '.' + keys[i] + ':set', node._data[key]._data[keys[i]], null, remote);
                        obj.emit('*:set', node._data[key]._path + '.' + keys[i], node._data[key]._data[keys[i]], null, remote);
                        obj.silenceRestore(state);
                    }
                }
            }

            if (changed) {
                if (silent)
                    state = obj.silence();

                var val = obj.json(node._data[key]);

                obj.emit(node._data[key]._path + ':set', val, valueOld, remote);
                obj.emit('*:set', node._data[key]._path, val, valueOld, remote);

                if (silent)
                    obj.silenceRestore(state);

                return true;
            } else {
                return false;
            }
        } else {
            var data;
            if (! node.hasOwnProperty('_data') && node.hasOwnProperty(key)) {
                data = node;
            } else {
                data = node._data;
            }

            if (data[key] === value && !force)
                return false;

            if (silent)
                state = obj.silence();

            var valueOld = data[key];
            if (! (valueOld instanceof Observer))
                valueOld = obj.json(valueOld);

            data[key] = value;

            obj.emit(path + ':set', value, valueOld, remote);
            obj.emit('*:set', path, value, valueOld, remote);

            if (silent)
                obj.silenceRestore(state);

            return true;
        }
    }

    return false;
};


Observer.prototype.has = function(path) {
    var keys = path.split('.');
    var node = this;
    for (var i = 0, len = keys.length; i < len; i++) {
        if (node == undefined)
            return undefined;

        if (node._data) {
            node = node._data[keys[i]];
        } else {
            node = node[keys[i]];
        }
    }

    return node !== undefined;
};


Observer.prototype.get = function(path, raw) {
    var keys = path.split('.');
    var node = this;
    for (var i = 0; i < keys.length; i++) {
        if (node == undefined)
            return undefined;

        if (node._data) {
            node = node._data[keys[i]];
        } else {
            node = node[keys[i]];
        }
    }

    if (raw)
        return node;

    if (node == null) {
        return null;
    } else {
        return this.json(node);
    }
};


Observer.prototype.getRaw = function(path) {
    return this.get(path, true);
};


Observer.prototype._equals = function(a, b) {
    if (a === b) {
        return true;
    } else if (a instanceof Array && b instanceof Array && a.equals(b)) {
        return true;
    } else {
        return false;
    }
};


Observer.prototype.unset = function(path, silent, remote) {
    var keys = path.split('.');
    var key = keys[keys.length - 1];
    var node = this;
    var obj = this;

    for(var i = 0; i < keys.length - 1; i++) {
        if (node instanceof Array) {
            node = node[keys[i]];
            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else {
            node = node._data[keys[i]];
        }
    }

    if (! node._data || ! node._data.hasOwnProperty(key))
        return false;

    var valueOld = node._data[key];
    if (! (valueOld instanceof Observer))
        valueOld = obj.json(valueOld);

    // recursive
    if (node._data[key] && node._data[key]._data) {
        for(var i = 0; i < node._data[key]._keys.length; i++) {
            obj.unset(path + '.' + node._data[key]._keys[i], true);
        }
    }

    node._keys.splice(node._keys.indexOf(key), 1);
    delete node._data[key];

    var state;
    if (silent)
        state = obj.silence();

    obj.emit(path + ':unset', valueOld, remote);
    obj.emit('*:unset', path, valueOld, remote);

    if (silent)
        obj.silenceRestore(state);

    return true;
};


Observer.prototype.remove = function(path, ind, silent, remote) {
    var keys = path.split('.');
    var key = keys[keys.length - 1];
    var node = this;
    var obj = this;

    for(var i = 0; i < keys.length - 1; i++) {
        if (node instanceof Array) {
            node = node[parseInt(keys[i], 10)];
            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else if (node._data && node._data.hasOwnProperty(keys[i])) {
            node = node._data[keys[i]];
        } else {
            return;
        }
    }

    if (! node._data || ! node._data.hasOwnProperty(key) || ! (node._data[key] instanceof Array))
        return;

    var arr = node._data[key];
    if (arr.length < ind)
        return;

    var value = arr[ind];
    if (value instanceof Observer) {
        value._parent = null;
    } else {
        value = obj.json(value);
    }

    arr.splice(ind, 1);

    var state;
    if (silent)
        state = obj.silence();

    obj.emit(path + ':remove', value, ind, remote);
    obj.emit('*:remove', path, value, ind, remote);

    if (silent)
        obj.silenceRestore(state);

    return true;
};


Observer.prototype.removeValue = function(path, value, silent, remote) {
    var keys = path.split('.');
    var key = keys[keys.length - 1];
    var node = this;
    var obj = this;

    for(var i = 0; i < keys.length - 1; i++) {
        if (node instanceof Array) {
            node = node[parseInt(keys[i], 10)];
            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else if (node._data && node._data.hasOwnProperty(keys[i])) {
            node = node._data[keys[i]];
        } else {
            return;
        }
    }

    if (! node._data || ! node._data.hasOwnProperty(key) || ! (node._data[key] instanceof Array))
        return;

    var arr = node._data[key];

    var ind = arr.indexOf(value);
    if (ind === -1) {
        return;
    }

    if (arr.length < ind)
        return;

    var value = arr[ind];
    if (value instanceof Observer) {
        value._parent = null;
    } else {
        value = obj.json(value);
    }

    arr.splice(ind, 1);

    var state;
    if (silent)
        state = obj.silence();

    obj.emit(path + ':remove', value, ind, remote);
    obj.emit('*:remove', path, value, ind, remote);

    if (silent)
        obj.silenceRestore(state);

    return true;
};


Observer.prototype.insert = function(path, value, ind, silent, remote) {
    var keys = path.split('.');
    var key = keys[keys.length - 1];
    var node = this;
    var obj = this;

    for(var i = 0; i < keys.length - 1; i++) {
        if (node instanceof Array) {
            node = node[parseInt(keys[i], 10)];
            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else if (node._data && node._data.hasOwnProperty(keys[i])) {
            node = node._data[keys[i]];
        } else {
            return;
        }
    }

    if (! node._data || ! node._data.hasOwnProperty(key) || ! (node._data[key] instanceof Array))
        return;

    var arr = node._data[key];

    if (typeof(value) === 'object' && ! (value instanceof Observer)) {
        if (value instanceof Array) {
            value = value.slice(0);
        } else {
            value = new Observer(value);
        }
    }

    if (! this._pathsWithDuplicates || ! this._pathsWithDuplicates[path]) {
        if (arr.indexOf(value) !== -1) {
            return;
        }
    }

    if (ind === undefined) {
        arr.push(value);
        ind = arr.length - 1;
    } else {
        arr.splice(ind, 0, value);
    }

    if (value instanceof Observer) {
        value._parent = obj;
        value._parentPath = (node._path ? node._path + '.' + key : key);
        value._parentField = arr;
        value._parentKey = null;
    } else {
        value = obj.json(value);
    }

    var state;
    if (silent)
        state = obj.silence();

    obj.emit(path + ':insert', value, ind, remote);
    obj.emit('*:insert', path, value, ind, remote);

    if (silent)
        obj.silenceRestore(state);

    return true;
};


Observer.prototype.move = function(path, indOld, indNew, silent, remote) {
    var keys = path.split('.');
    var key = keys[keys.length - 1];
    var node = this;
    var obj = this;

    for(var i = 0; i < keys.length - 1; i++) {
        if (node instanceof Array) {
            node = node[parseInt(keys[i], 10)];
            if (node instanceof Observer) {
                path = keys.slice(i + 1).join('.');
                obj = node;
            }
        } else if (node._data && node._data.hasOwnProperty(keys[i])) {
            node = node._data[keys[i]];
        } else {
            return;
        }
    }

    if (! node._data || ! node._data.hasOwnProperty(key) || ! (node._data[key] instanceof Array))
        return;

    var arr = node._data[key];

    if (arr.length < indOld || arr.length < indNew || indOld === indNew)
        return;

    var value = arr[indOld];

    arr.splice(indOld, 1);

    if (indNew === -1)
        indNew = arr.length;

    arr.splice(indNew, 0, value);

    if (! (value instanceof Observer))
        value = obj.json(value);

    var state;
    if (silent)
        state = obj.silence();

    obj.emit(path + ':move', value, indNew, indOld, remote);
    obj.emit('*:move', path, value, indNew, indOld, remote);

    if (silent)
        obj.silenceRestore(state);

    return true;
};


Observer.prototype.patch = function(data) {
    if (typeof(data) !== 'object')
        return;

    for(var key in data) {
        if (typeof(data[key]) === 'object' && ! this._data.hasOwnProperty(key)) {
            this._prepare(this, key, data[key]);
        } else if (this._data[key] !== data[key]) {
            this.set(key, data[key]);
        }
    }
};


Observer.prototype.json = function(target) {
    var obj = { };
    var node = target === undefined ? this : target;
    var len, nlen;

    if (node instanceof Object && node._keys) {
        len = node._keys.length;
        for (var i = 0; i < len; i++) {
            var key = node._keys[i];
            var value = node._data[key];
            var type = typeof(value);

            if (type === 'object' && (value instanceof Array)) {
                obj[key] = value.slice(0);

                nlen = obj[key].length;
                for(var n = 0; n < nlen; n++) {
                    if (typeof(obj[key][n]) === 'object')
                        obj[key][n] = this.json(obj[key][n]);
                }
            } else if (type === 'object' && (value instanceof Object)) {
                obj[key] = this.json(value);
            } else {
                obj[key] = value;
            }
        }
    } else {
        if (node === null) {
            return null;
        } else if (typeof(node) === 'object' && (node instanceof Array)) {
            obj = node.slice(0);

            len = obj.length;
            for(var n = 0; n < len; n++) {
                obj[n] = this.json(obj[n]);
            }
        } else if (typeof(node) === 'object') {
            for(var key in node) {
                if (node.hasOwnProperty(key))
                    obj[key] = node[key];
            }
        } else {
            obj = node;
        }
    }
    return obj;
};


Observer.prototype.forEach = function(fn, target, path) {
    var node = target || this;
    path = path || '';

    for (var i = 0; i < node._keys.length; i++) {
        var key = node._keys[i];
        var value = node._data[key];
        var type = (this.schema && this.schema.has(path + key) && this.schema.get(path + key).type.name.toLowerCase()) || typeof(value);

        if (type === 'object' && (value instanceof Array)) {
            fn(path + key, 'array', value, key);
        } else if (type === 'object' && (value instanceof Object)) {
            fn(path + key, 'object', value, key);
            this.forEach(fn, value, path + key + '.');
        } else {
            fn(path + key, type, value, key);
        }
    }
};


Observer.prototype.destroy = function() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.emit('destroy');
    this.unbind();
};


/* observer-list.js */
"use strict";

function ObserverList(options) {
    Events.call(this);
    options = options || { };

    this.data = [ ];
    this._indexed = { };
    this.sorted = options.sorted || null;
    this.index = options.index || null;
}

ObserverList.prototype = Object.create(Events.prototype);


Object.defineProperty(ObserverList.prototype, 'length', {
    get: function() {
        return this.data.length;
    }
});


ObserverList.prototype.get = function(index) {
    if (this.index) {
        return this._indexed[index] || null;
    } else {
        return this.data[index] || null;
    }
};


ObserverList.prototype.set = function(index, value) {
    if (this.index) {
        this._indexed[index] = value;
    } else {
        this.data[index] = value;
    }
};


ObserverList.prototype.indexOf = function(item) {
    if (this.index) {
        var index = (item instanceof Observer && item.get(this.index)) || item[this.index]
        return (this._indexed[index] && index) || null;
    } else {
        var ind = this.data.indexOf(item);
        return ind !== -1 ? ind : null;
    }
};


ObserverList.prototype.position = function(b, fn) {
    var l = this.data;
    var min = 0;
    var max = l.length - 1;
    var cur;
    var a, i;
    fn = fn || this.sorted;

    while (min <= max) {
        cur = Math.floor((min + max) / 2);
        a = l[cur];

        i = fn(a, b);

        if (i === 1) {
            max = cur - 1;
        } else if (i === -1) {
            min = cur + 1;
        } else {
            return cur;
        }
    }

    return -1;
};


ObserverList.prototype.positionNextClosest = function(b, fn) {
    var l = this.data;
    var min = 0;
    var max = l.length - 1;
    var cur;
    var a, i;
    fn = fn || this.sorted;

    if (l.length === 0)
        return -1;

    if (fn(l[0], b) === 0)
        return 0;

    while (min <= max) {
        cur = Math.floor((min + max) / 2);
        a = l[cur];

        i = fn(a, b);

        if (i === 1) {
            max = cur - 1;
        } else if (i === -1) {
            min = cur + 1;
        } else {
            return cur;
        }
    }

    if (fn(a, b) === 1)
        return cur;

    if ((cur + 1) === l.length)
        return -1;

    return cur + 1;
};


ObserverList.prototype.has = function(item) {
    if (this.index) {
        var index = (item instanceof Observer && item.get(this.index)) || item[this.index]
        return !! this._indexed[index];
    } else {
        return this.data.indexOf(item) !== -1;
    }
};


ObserverList.prototype.add = function(item) {
    if (this.has(item))
        return null;

    var index = this.data.length;
    if (this.index) {
        index = (item instanceof Observer && item.get(this.index)) || item[this.index];
        this._indexed[index] = item;
    }

    var pos = 0;

    if (this.sorted) {
        pos = this.positionNextClosest(item);
        if (pos !== -1) {
            this.data.splice(pos, 0, item);
        } else {
            this.data.push(item);
        }
    } else {
        this.data.push(item);
        pos = this.data.length - 1;
    }

    this.emit('add', item, index);

    return pos;
};


ObserverList.prototype.move = function(item, pos) {
    var ind = this.data.indexOf(item);
    this.data.splice(ind, 1);
    if (pos === -1) {
        this.data.push(item);
    } else {
        this.data.splice(pos, 0, item);
    }
};


ObserverList.prototype.remove = function(item) {
    if (! this.has(item))
        return;

    var ind = this.data.indexOf(item);

    var index = ind;
    if (this.index) {
        index = (item instanceof Observer && item.get(this.index)) || item[this.index];
        delete this._indexed[index];
    }

    this.data.splice(ind, 1);

    this.emit('remove', item, index);
};


ObserverList.prototype.removeByKey = function(index) {
    if (this.index) {
        var item = this._indexed[index];

        if (! item)
            return;

        var ind = this.data.indexOf(item);
        this.data.splice(ind, 1);

        delete this._indexed[index];

        this.emit('remove', item, ind);
    } else {
        if (this.data.length < index)
            return;

        var item = this.data[index];

        this.data.splice(index, 1);

        this.emit('remove', item, index);
    }
};


ObserverList.prototype.removeBy = function(fn) {
    var i = this.data.length;
    while(i--) {
        if (! fn(this.data[i]))
            continue;

        if (this.index) {
            delete this._indexed[this.data[i][this.index]];
        }
        this.data.splice(i, 1);

        this.emit('remove', this.data[i], i);
    }
};


ObserverList.prototype.clear = function() {
    var items = this.data.slice(0);

    this.data = [ ];
    this._indexed = { };

    var i = items.length;
    while(i--) {
        this.emit('remove', items[i], i);
    }
};


ObserverList.prototype.forEach = function(fn) {
    for(var i = 0; i < this.data.length; i++) {
        fn(this.data[i], (this.index && this.data[i][this.index]) || i);
    }
};


ObserverList.prototype.find = function(fn) {
    var items = [ ];
    for(var i = 0; i < this.data.length; i++) {
        if (! fn(this.data[i]))
            continue;

        var index = i;
        if (this.index)
            index = this.data[i][this.index];

        items.push([ index, this.data[i] ]);
    }
    return items;
};


ObserverList.prototype.findOne = function(fn) {
    for(var i = 0; i < this.data.length; i++) {
        if (! fn(this.data[i]))
            continue;

        var index = i;
        if (this.index)
            index = this.data[i][this.index];

        return [ index, this.data[i] ];
    }
    return null;
};


ObserverList.prototype.map = function(fn) {
    return this.data.map(fn);
};


ObserverList.prototype.sort = function(fn) {
    this.data.sort(fn);
};


ObserverList.prototype.array = function() {
    return this.data.slice(0);
};


ObserverList.prototype.json = function() {
    var items = this.array();
    for(var i = 0; i < items.length; i++) {
        if (items[i] instanceof Observer) {
            items[i] = items[i].json();
        }
    }
    return items;
};


/* observer-sync.js */
function ObserverSync(args) {
    Events.call(this);
    args = args || { };

    this.item = args.item;
    this._enabled = args.enabled || true;
    this._prefix = args.prefix || [ ];
    this._paths = args.paths || null;
    this._sync = args.sync || true;

    this._initialize();
}
ObserverSync.prototype = Object.create(Events.prototype);


ObserverSync.prototype._initialize = function() {
    var self = this;
    var item = this.item;

    // object/array set
    item.on('*:set', function(path, value, valueOld) {
        if (! self._enabled) return;

        // if this happens it's a bug
        if (item.sync !== self) {
            console.error('Garbage Observer Sync still pointing to item', item);
        }

        // check if path is allowed
        if (self._paths) {
            var allowedPath = false;
            for(var i = 0; i < self._paths.length; i++) {
                if (path.indexOf(self._paths[i]) !== -1) {
                    allowedPath = true;
                    break;
                }
            }

            // path is not allowed
            if (! allowedPath)
                return;
        }

        // full path
        var p = self._prefix.concat(path.split('.'));

        // need jsonify
        if (value instanceof Observer || value instanceof ObserverList)
            value = value.json();

        // can be array value
        var ind = path.lastIndexOf('.');
        if (ind !== -1 && (this.get(path.slice(0, ind)) instanceof Array)) {
            // array index should be int
            p[p.length - 1] = parseInt(p[p.length - 1], 10);

            // emit operation: list item set
            self.emit('op', {
                p: p,
                li: value,
                ld: valueOld
            });
        } else {
            // emit operation: object item set
            var obj = {
                p: p,
                oi: value
            };

            if (valueOld !== undefined) {
                obj.od = valueOld;
            }

            self.emit('op', obj);
        }
    });

    // unset
    item.on('*:unset', function(path, value) {
        if (! self._enabled) return;

        self.emit('op', {
            p: self._prefix.concat(path.split('.')),
            od: null
        });
    });

    // list move
    item.on('*:move', function(path, value, ind, indOld) {
        if (! self._enabled) return;
        self.emit('op', {
            p: self._prefix.concat(path.split('.')).concat([ indOld ]),
            lm: ind
        });
    });

    // list remove
    item.on('*:remove', function(path, value, ind) {
        if (! self._enabled) return;

        // need jsonify
        if (value instanceof Observer || value instanceof ObserverList)
            value = value.json();

        self.emit('op', {
            p: self._prefix.concat(path.split('.')).concat([ ind ]),
            ld: value
        });
    });

    // list insert
    item.on('*:insert', function(path, value, ind) {
        if (! self._enabled) return;

        // need jsonify
        if (value instanceof Observer || value instanceof ObserverList)
            value = value.json();

        self.emit('op', {
            p: self._prefix.concat(path.split('.')).concat([ ind ]),
            li: value
        });
    });
};


ObserverSync.prototype.write = function(op) {
    // disable history if available
    var historyReEnable = false;
    if (this.item.history && this.item.history.enabled) {
        historyReEnable = true;
        this.item.history.enabled = false;
    }

    if (op.hasOwnProperty('oi')) {
        // set key value
        var path = op.p.slice(this._prefix.length).join('.');

        this._enabled = false;
        this.item.set(path, op.oi, false, true);
        this._enabled = true;


    } else if (op.hasOwnProperty('ld') && op.hasOwnProperty('li')) {
        // set array value
        var path = op.p.slice(this._prefix.length).join('.');

        this._enabled = false;
        this.item.set(path, op.li, false, true);
        this._enabled = true;


    } else if (op.hasOwnProperty('ld')) {
        // delete item
        var path = op.p.slice(this._prefix.length, -1).join('.');

        this._enabled = false;
        this.item.remove(path, op.p[op.p.length - 1], false, true);
        this._enabled = true;


    } else if (op.hasOwnProperty('li')) {
        // add item
        var path = op.p.slice(this._prefix.length, -1).join('.');
        var ind = op.p[op.p.length - 1];

        this._enabled = false;
        this.item.insert(path, op.li, ind, false, true);
        this._enabled = true;


    } else if (op.hasOwnProperty('lm')) {
        // item moved
        var path = op.p.slice(this._prefix.length, -1).join('.');
        var indOld = op.p[op.p.length - 1];
        var ind = op.lm;

        this._enabled = false;
        this.item.move(path, indOld, ind, false, true);
        this._enabled = true;


    } else if (op.hasOwnProperty('od')) {
        // unset key value
        var path = op.p.slice(this._prefix.length).join('.');
        this._enabled = false;
        this.item.unset(path, false, true);
        this._enabled = true;


    } else {
        console.log('unknown operation', op);
    }

    // reenable history
    if (historyReEnable)
        this.item.history.enabled = true;

    this.emit('sync', op);
};

Object.defineProperty(ObserverSync.prototype, 'enabled', {
    get: function() {
        return this._enabled;
    },
    set: function(value) {
        this._enabled = !! value;
    }
});

Object.defineProperty(ObserverSync.prototype, 'prefix', {
    get: function() {
        return this._prefix;
    },
    set: function(value) {
        this._prefix = value || [ ];
    }
});

Object.defineProperty(ObserverSync.prototype, 'paths', {
    get: function() {
        return this._paths;
    },
    set: function(value) {
        this._paths = value || null;
    }
});


/* observer-history.js */
function ObserverHistory(args) {
    Events.call(this);
    args = args || { };

    this.item = args.item;
    this._enabled = args.enabled || true;
    this._combine = args._combine || false;
    this._prefix = args.prefix || '';
    this._getItemFn = args.getItemFn;

    this._events = [];

    this._initialize();
}
ObserverHistory.prototype = Object.create(Events.prototype);


ObserverHistory.prototype._initialize = function() {
    var self = this;

    this._events.push(this.item.on('*:set', function(path, value, valueOld) {
        if (! self._enabled) return;

        // need jsonify
        if (value instanceof Observer)
            value = value.json();

        // action
        var data = {
            name: self._prefix + path,
            combine: self._combine,
            undo: function() {
                var item = self._getItemFn();
                if (! item) return;

                item.history.enabled = false;

                if (valueOld === undefined) {
                    item.unset(path);
                } else {
                    item.set(path, valueOld);
                }

                item.history.enabled = true;
            },
            redo: function() {
                var item = self._getItemFn();
                if (! item) return;

                item.history.enabled = false;

                if (value === undefined) {
                    item.unset(path);
                } else {
                    item.set(path, value);
                }

                item.history.enabled = true;
            }
        };

        if (data.combine && editor.call('history:canUndo') && editor.call('history:list')[editor.call('history:current')].name === data.name) {
            // update
            self.emit('record', 'update', data);
        } else {
            // add
            self.emit('record', 'add', data);
        }
    }));

    this._events.push(this.item.on('*:unset', function(path, valueOld) {
        if (! self._enabled) return;

        // action
        var data = {
            name: self._prefix + path,
            undo: function() {
                var item = self._getItemFn();
                if (! item) return;

                item.history.enabled = false;
                item.set(path, valueOld);
                item.history.enabled = true;
            },
            redo: function() {
                var item = self._getItemFn();
                if (! item) return;

                item.history.enabled = false;
                item.unset(path);
                item.history.enabled = true;
            }
        };

        self.emit('record', 'add', data);
    }));

    this._events.push(this.item.on('*:insert', function(path, value, ind) {
        if (! self._enabled) return;

        // need jsonify
        // if (value instanceof Observer)
        //     value = value.json();

        // action
        var data = {
            name: self._prefix + path,
            undo: function() {
                var item = self._getItemFn();
                if (! item) return;

                item.history.enabled = false;
                item.removeValue(path, value);
                item.history.enabled = true;
            },
            redo: function() {
                var item = self._getItemFn();
                if (! item) return;

                item.history.enabled = false;
                item.insert(path, value, ind);
                item.history.enabled = true;
            }
        };

        self.emit('record', 'add', data);
    }));

    this._events.push(this.item.on('*:remove', function(path, value, ind) {
        if (! self._enabled) return;

        // need jsonify
        // if (value instanceof Observer)
        //     value = value.json();

        // action
        var data = {
            name: self._prefix + path,
            undo: function() {
                var item = self._getItemFn();
                if (! item) return;

                item.history.enabled = false;
                item.insert(path, value, ind);
                item.history.enabled = true;
            },
            redo: function() {
                var item = self._getItemFn();
                if (! item) return;

                item.history.enabled = false;
                item.removeValue(path, value);
                item.history.enabled = true;
            }
        };

        self.emit('record', 'add', data);
    }));

    this._events.push(this.item.on('*:move', function(path, value, ind, indOld) {
        if (! self._enabled) return;

        // action
        var data = {
            name: self._prefix + path,
            undo: function() {
                var item = self._getItemFn();
                if (! item) return;

                item.history.enabled = false;
                item.move(path, ind, indOld);
                item.history.enabled = true;
            },
            redo: function() {
                var item = self._getItemFn();
                if (! item) return;

                item.history.enabled = false;
                item.move(path, indOld, ind);
                item.history.enabled = true;
            }
        };

        self.emit('record', 'add', data);
    }));
};

ObserverHistory.prototype.destroy = function () {
    this._events.forEach(function (evt) {
        evt.unbind();
    });

    this._events.length = 0;
    this.item = null;
};

Object.defineProperty(ObserverHistory.prototype, 'enabled', {
    get: function() {
        return this._enabled;
    },
    set: function(value) {
        this._enabled = !! value;
    }
});


Object.defineProperty(ObserverHistory.prototype, 'prefix', {
    get: function() {
        return this._prefix;
    },
    set: function(value) {
        this._prefix = value || '';
    }
});


Object.defineProperty(ObserverHistory.prototype, 'combine', {
    get: function() {
        return this._combine;
    },
    set: function(value) {
        this._combine = !! value;
    }
});

