var MESSENGER_RECONNECT_DELAY = 1000;
var MESSENGER_RESERVED_NAMES = [ 'connect', 'close', 'error', 'message' ];


function Messenger(args) {
    Events.call(this);

    this._url = '';
    this._reconnectDelay = null;
    this._xhr = null;
    this._connecting = false;
    this._connectAttempts = 0;
    this._connected = false;
    this._authenticated = false;

    this.on('welcome', function(msg) {
        this._authenticated = true;
    });
}
Messenger.prototype = Object.create(Events.prototype);


Messenger.prototype.connect = function(url) {
    if (this._connecting) return;

    this._url = url;
    this._connectAttempts++;
    this._connecting = true;
    this._reconnectDelay = null;

    this.socket = new WebSocket(this._url);
    this.socket.onopen = this._onopen.bind(this);
    this.socket.onmessage = this._onmessage.bind(this);
    this.socket.onerror = this._onerror.bind(this);
    this.socket.onclose = this._onclose.bind(this);
};


Messenger.prototype.reconnect = function() {
    if (this._connecting || ! this._url || this._connectAttempts >= 8) return;

    console.log('messenger reconnecting');

    // clear another potential reconnects
    if (this._reconnectDelay) {
        clearTimeout(this._reconnectDelay);
        this._reconnectDelay = null;
    }

    // start delay
    this._reconnectDelay = setTimeout(function() {
        this.connect(this._url);
    }.bind(this), MESSENGER_RECONNECT_DELAY);
};


Object.defineProperty(
    Messenger.prototype,
    'isConnected',
    {
        get: function() {
            return this._connected;
        }
    }
);


Object.defineProperty(
    Messenger.prototype,
    'isAuthenticated',
    {
        get: function() {
            return this._authenticated;
        }
    }
);


Messenger.prototype._onopen = function() {
    console.log('messenger connected');

    this._connected = true;
    this._connecting = false;

    this.emit('connect');
};


Messenger.prototype._onclose = function() {
    this._connected = false;
    this._authenticated = false;
    this.emit('close');

    this.reconnect();
};


Messenger.prototype._onerror = function(error) {
    console.error(error);
    this.emit('error', error);
};


Messenger.prototype._onmessage = function(raw) {
    try {
        var msg = JSON.parse(raw.data);
    } catch(ex) {
        this._onerror(new Error('could not parse message - is it JSON?'));
        return;
    }

    if (MESSENGER_RESERVED_NAMES.indexOf(msg.name) !== -1) {
        this._onerror(new Error('could not receive message - name is reserved:', msg.name));
        return;
    }

    this.emit('message', msg);
    this.emit(msg.name, msg);
};


Messenger.prototype.authenticate = function(accessToken, type) {
    if (! this._connected) return;

    this.send({
        name: 'authenticate',
        token: accessToken,
        type: type
    });
};


Messenger.prototype.send = function(msg) {
    if (! this._connected) return;

    if (MESSENGER_RESERVED_NAMES.indexOf(msg.name) !== -1) {
        this._onerror(new Error('could not send message - name is reserved:', msg.name));
        return;
    }
    this.socket.send(JSON.stringify(msg));
};


Messenger.prototype.close = function(args) {
    if (! this._connected) return;

    args = args || { };
    args.code = args.code || 1000; // 1000 - CLOSE_NORMAL
    args.reason = args.reason || 'unknown';

    this.socket.close(args.code, args.reason);
};


// start watching project
Messenger.prototype.projectWatch = function(id) {
    this.send({
        name: 'project.watch',
        target: {
            type: 'general'
        },
        env: [ '*' ],
        data: { id: id }
    });
};

// stop watching project
Messenger.prototype.projectUnwatch = function(id) {
    this.send({
        name: 'project.unwatch',
        target: {
            type: 'general'
        },
        env: [ '*' ],
        data: { id: id }
    });
};

// start watching organization
Messenger.prototype.organizationWatch = function(id) {
    this.send({
        name: 'organization.watch',
        target: {
            type: 'general'
        },
        env: [ '*' ],
        data: { id: id }
    });
};

// stop watching organization
Messenger.prototype.organizationUnwatch = function(id) {
    this.send({
        name: 'organization.unwatch',
        target: {
            type: 'general'
        },
        env: [ '*' ],
        data: { id: id }
    });
};
