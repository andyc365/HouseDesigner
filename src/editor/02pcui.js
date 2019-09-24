

/* pcui/pcui.js */
window.pcui = {};


/* pcui/interface/interface-collapsible.js */
Object.assign(pcui, (function () {
    'use strict';

    /**
     * @name pcui.ICollapsible
     * @classdesc Provides an interface to allow collapsing / expanding of an Element.
     */
    function ICollapsible() {}

    /**
     * @event
     * @name pcui.ICollapsible#collapse
     * @description Fired when the element gets collapsed
     */

    /**
     * @event
     * @name pcui.ICollapsible#expand
     * @description Fired when the element gets expanded
     */

    Object.defineProperty(ICollapsible.prototype, 'collapsible', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    Object.defineProperty(ICollapsible.prototype, 'collapsed', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    return {
        ICollapsible: ICollapsible
    };
})());


/* pcui/interface/interface-container.js */
Object.assign(pcui, (function () {
    'use strict';

    /**
     * @name pcui.IContainer
     * @classdesc Provides an interface for appending / removing children from an Element.
     */
    function IContainer() {}

    /**
     * @event
     * @name pcui.IContainer#append
     * @description Fired when a child Element gets added
     * @param {pcui.Element} The element that was added
     */

    /**
     * @event
     * @name pcui.IContainer#remove
     * @description Fired when a child Element gets removed
     * @param {pcui.Element} The element that was removed
     */

    IContainer.prototype.append = function (element) {
        throw new Error('Not Implemented');
    };

    IContainer.prototype.appendBefore = function (element, referenceElement) {
        throw new Error('Not Implemented');
    };

    IContainer.prototype.appendAfter = function (element, referenceElement) {
        throw new Error('Not Implemented');
    };

    IContainer.prototype.prepend = function (element) {
        throw new Error('Not Implemented');
    };

    IContainer.prototype.remove = function (element) {
        throw new Error('Not Implemented');
    };

    IContainer.prototype.clear = function () {
        throw new Error('Not Implemented');
    };

    return {
        IContainer: IContainer
    };
})());


/* pcui/interface/interface-flex.js */
Object.assign(pcui, (function () {
    'use strict';

    /**
     * @name pcui.IFlex
     * @classdesc Provides an interface for allowing support for the flexbox CSS layout
     */
    function IFlex() {}

    Object.defineProperty(IFlex.prototype, 'flex', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    return {
        IFlex: IFlex
    };
})());


/* pcui/interface/interface-grid.js */
Object.assign(pcui, (function () {
    'use strict';

    /**
     * @name pcui.IGrid
     * @classdesc Provides an interface for allowing support for the grid CSS layout
     */
    function IGrid() {}

    Object.defineProperty(IGrid.prototype, 'grid', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    return {
        IGrid: IGrid
    };
})());


/* pcui/interface/interface-input.js */
Object.assign(pcui, (function () {
    'use strict';

    /**
     * @name pcui.IInput
     * @classdesc Provides an interface for getting / setting a value for the Element.
     */
    function IInput() {}

    Object.defineProperty(IInput.prototype, 'value', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    return {
        IInput: IInput
    };
})());


/* pcui/interface/interface-resizable.js */
Object.assign(pcui, (function () {
    'use strict';

    /**
     * @name pcui.IResizable
     * @classdesc Provides an interface for enabling resizing support for an Element
     */
    function IResizable() {}

    /**
     * @event
     * @name pcui.IResizable#resize
     * @description Fired when the Element gets resized.
     */

    Object.defineProperty(IResizable.prototype, 'resizable', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    Object.defineProperty(IResizable.prototype, 'resizeMin', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    Object.defineProperty(IResizable.prototype, 'resizeMax', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    return {
        IResizable: IResizable
    };
})());


/* pcui/interface/interface-scrollable.js */
Object.assign(pcui, (function () {
    'use strict';

    /**
     * @name pcui.IScrollable
     * @classdesc Provides an interface for allowing scrolling on an Element.
     */
    function IScrollable() {}

    /**
     * @event
     * @name pcui.IScrollable#scroll
     * @description Fired when the Element is scrolled.
     * @param {Event} The native scroll event.
     */


    Object.defineProperty(IScrollable.prototype, 'scrollable', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    return {
        IScrollable: IScrollable
    };
})());


/* pcui/interface/interface-selectable.js */
Object.assign(pcui, (function () {
    'use strict';

    /**
     * @name pcui.ISelectable
     * @classdesc Provides an interface for selecting an Element.
     */
    function ISelectable() {}

    Object.defineProperty(ISelectable.prototype, 'selected', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    return {
        ISelectable: ISelectable
    };
})());


/* pcui/interface/interface-selection.js */
Object.assign(pcui, (function () {
    'use strict';

    /**
     * @name pcui.ISelection
     * @classdesc Provides an interface for allow the selection of child elements.
     */
    function ISelection() {}

    Object.defineProperty(ISelection.prototype, 'allowSelection', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    Object.defineProperty(ISelection.prototype, 'multiSelect', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    Object.defineProperty(ISelection.prototype, 'selection', {
        get: function () {
            throw new Error('Not implemented');
        },
        set: function (value) {
            throw new Error('Not implemented');
        },
        configurable: true
    });

    return {
        ISelection: ISelection
    };
})());


/* pcui/element/element.js */
Object.assign(pcui, (function () {
    'use strict';

    // these are properties that are
    // available as Element properties and
    // can also be set through the Element constructor
    var SIMPLE_CSS_PROPERTIES = [
        'flexDirection',
        'flexGrow',
        'flexBasis',
        'flexShrink',
        'flexWrap',
        'alignItems',
        'justifyContent'
    ];

    // utility function to expose a CSS property
    // via an Element.prototype property
    function exposeCssProperty(name) {
        Object.defineProperty(Element.prototype, name, {
            get: function () {
                return this.style[name];
            },
            set: function (value) {
                this.style[name] = value;
            }
        });
    }

    /**
     * @event
     * @name pcui.Element#enable
     * @description Fired when the Element gets enabled
     */

    /**
     * @event
     * @name pcui.Element#disable
     * @description Fired when the Element gets disabled
     */

    /**
     * @event
     * @name pcui.Element#hide
     * @description Fired when the Element gets hidden
     */

    /**
     * @event
     * @name pcui.Element#show
     * @description Fired when the Element stops being hidden
     */

    /**
     * @event
     * @name pcui.Element#parent
     * @description Fired when the Element's parent gets set
     * @param {pcui.Element} parent The new parent
     */

    /**
     * @event
     * @name pcui.Element#click
     * @description Fired when the mouse is clicked on the Element but only if the Element is enabled.
     * @param {Event} evt The native mouse event.
     */

    /**
     * @event
     * @name pcui.Element#hover
     * @description Fired when the mouse starts hovering on the Element
     * @param {Event} evt The native mouse event.
     */

    /**
     * @event
     * @name pcui.Element#hoverend
     * @description Fired when the mouse stops hovering on the Element
     * @param {Event} evt The native mouse event.
     */

    /**
     * @name pcui.Element
     * @classdesc The base class for all UI elements.
     * @extends Events
     * @param {HTMLElement} dom The DOM element that this pcui.Element wraps.
     * @param {Object} args The arguments. All settable properties can also be set through the constructor.
     * @param {String} [args.id] The desired id for the Element HTML node.
     * @property {Boolean} enabled Gets / sets whether the Element or its parent chain is enabled or not. Defaults to true.
     * @property {HTMLElement} dom Gets the root DOM node for this Element.
     * @property {pcui.Element} parent Gets / sets the parent Element.
     * @property {Boolean} hidden Gets / sets whether the Element is hidden.
     * @property {Number} width Gets / sets the width of the Element in pixels. Can also be an empty string to remove it.
     * @property {Number} height Gets / sets the height of the Element in pixels. Can also be an empty string to remove it.
     * @property {class} parent Gets / sets the parent Element.
     * @property {CSSStyleDeclaration} style Shortcut to pcui.Element.dom.style.
     * @property {DOMTokenList} class Shortcut to pcui.Element.dom.classList.
     */
    function Element(dom, args) {
        Events.call(this);

        if (!args) args = {};

        this._destroyed = false;
        this._enabled = true;
        this._hidden = false;
        this._parent = null;

        this._domEventClick = this._onClick.bind(this);
        this._domEventMouseOver = this._onMouseOver.bind(this);
        this._domEventMouseOut = this._onMouseOut.bind(this);

        this._evtParentDestroy = null;
        this._evtParentDisable = null;
        this._evtParentEnable = null;

        this._dom = dom;

        if (args.id !== undefined) {
            this._dom.id = args.id;
        }

        // add ui reference
        this._dom.ui = this;

        // add event listeners
        this._dom.addEventListener('click', this._domEventClick);
        this._dom.addEventListener('mouseover', this._domEventMouseOver);
        this._dom.addEventListener('mouseout', this._domEventMouseOut);

        // add element class
        this._dom.classList.add('pcui-element');

        if (args.enabled !== undefined) {
            this.enabled = args.enabled;
        }
        if (args.hidden !== undefined) {
            this.hidden = args.hidden;
        }
        if (args.width !== undefined) {
            this.width = args.width;
        }
        if (args.height !== undefined) {
            this.height = args.height;
        }

        // copy CSS properties from args
        for (var key in args) {
            if (args[key] === undefined) continue;
            if (SIMPLE_CSS_PROPERTIES.indexOf(key) !== -1) {
                this[key] = args[key];
            }
        }
    }

    Element.prototype = Object.create(Events.prototype);
    Element.prototype.constructor = Element;

    Element.prototype.link = function (observer, path) {
        throw new Error('Not implemented');
    };

    Element.prototype.unlink = function () {
        throw new Error('Not implemented');
    };

    /**
     * @name pcui.Element#flash
     * @description Triggers a flash animation on the Element.
     */
    Element.prototype.flash = function () {
        this.class.add('flash');
        setTimeout(function () {
            this.class.remove('flash');
        }.bind(this), 200);
    };

    Element.prototype._onClick = function (evt) {
        if (this.enabled) {
            this.emit('click', evt);
        }
    };

    Element.prototype._onMouseOver = function (evt) {
        this.emit('hover', evt);
    };

    Element.prototype._onMouseOut = function (evt) {
        this.emit('hoverend', evt);
    };

    Element.prototype._onEnabledChange = function (enabled) {
        if (enabled) {
            this.class.remove('pcui-disabled');
        } else {
            this.class.add('pcui-disabled');
        }

        this.emit(enabled ? 'enable' : 'disable');
    };

    Element.prototype._onParentDestroy = function () {
        this.destroy();
    };

    Element.prototype._onParentDisable = function () {
        if (this._enabled) {
            this._onEnabledChange(false);
        }
    };

    Element.prototype._onParentEnable = function () {
        if (this._enabled) {
            this._onEnabledChange(true);
        }
    };

    /**
     * @name pcui.Element#destroy
     * @description Destroys the Element and its events.
     */
    Element.prototype.destroy = function () {
        if (this._destroyed) return;

        this._destroyed = true;

        if (this.parent) {
            this._parent = null;

            this._evtParentDestroy.unbind();
            this._evtParentDisable.unbind();
            this._evtParentEnable.unbind();
            this._evtParentDestroy = null;
            this._evtParentDisable = null;
            this._evtParentEnable = null;
        }

        if (this._dom) {
            if (this._dom && this._dom.parentElement) {
                this._dom.parentElement.removeChild(this._dom);
            }

            // remove event listeners
            this._dom.removeEventListener('click', this._domEventClick);
            this._dom.removeEventListener('mouseover', this._domEventMouseOver);
            this._dom.removeEventListener('mouseout', this._domEventMouseOut);

            // remove ui reference
            delete this._dom.ui;

            this._dom = null;
        }

        this._domEventClick = null;
        this._domEventMouseOver = null;
        this._domEventMouseOut = null;

        this.emit('destroy');

        this.unbind();
    };

    Object.defineProperty(Element.prototype, 'enabled', {
        get: function () {
            return this._enabled && (!this._parent || this._parent.enabled);
        },
        set: function (value) {
            if (this._enabled === value) return;

            // remember if enabled in hierarchy
            var enabled = this.enabled;

            this._enabled = value;

            // only fire event if hierarchy state changed
            if (enabled !== value) {
                this._onEnabledChange(value);
            }
        }
    });

    Object.defineProperty(Element.prototype, 'dom', {
        get: function () {
            return this._dom;
        }
    });

    Object.defineProperty(Element.prototype, 'parent', {
        get: function () {
            return this._parent;
        },
        set: function (value) {
            if (value === this._parent) return;

            var oldEnabled = this.enabled;

            if (this._parent) {
                this._evtParentDestroy.unbind();
                this._evtParentDisable.unbind();
                this._evtParentEnable.unbind();
            }

            this._parent = value;

            if (this._parent) {
                this._evtParentDestroy = this._parent.once('destroy', this._onParentDestroy.bind(this));
                this._evtParentDisable = this._parent.on('disable', this._onParentDisable.bind(this));
                this._evtParentEnable = this._parent.on('enable', this._onParentEnable.bind(this));
            }

            this.emit('parent', this._parent);

            var newEnabled = this.enabled;
            if (newEnabled !== oldEnabled) {
                this._onEnabledChange(newEnabled);
            }
        }
    });

    Object.defineProperty(Element.prototype, 'hidden', {
        get: function () {
            return this._hidden;
        },
        set: function (value) {
            if (value === this._hidden) return;

            this._hidden = value;

            if (value) {
                this.class.add('pcui-hidden');
            } else {
                this.class.remove('pcui-hidden');
            }

            this.emit(value ? 'hide' : 'show');
        }
    });

    Object.defineProperty(Element.prototype, 'style', {
        get: function () {
            return this._dom.style;
        }
    });

    Object.defineProperty(Element.prototype, 'class', {
        get: function () {
            return this._dom.classList;
        }
    });

    Object.defineProperty(Element.prototype, 'width', {
        get: function () {
            return this._dom.clientWidth;
        },
        set: function (value) {
            if (typeof value === 'number') {
                value += 'px';
            }
            this.style.width = value;
        }
    });

    Object.defineProperty(Element.prototype, 'height', {
        get: function () {
            return this._dom.clientHeight;
        },
        set: function (value) {
            if (typeof value === 'number') {
                value += 'px';
            }
            this.style.height = value;
        }
    });

    // expose rest of CSS properties
    SIMPLE_CSS_PROPERTIES.forEach(exposeCssProperty);

    // ******************************************************************************************
    /*  Backwards Compatibility */
    // we should remove those after we migrate
    Object.defineProperty(Element.prototype, 'disabled', {
        get: function () {
            return !this.enabled;
        },
        set: function (value) {
            this.enabled = !value;
        }
    });

    Object.defineProperty(Element.prototype, 'element', {
        get: function () {
            return this.dom;
        },
        set: function (value) {
            this.dom = value;
        }
    });

    Object.defineProperty(Element.prototype, 'innerElement', {
        get: function () {
            return this.domContent;
        },
        set: function (value) {
            this.domContent = value;
        }
    });

    return {
        Element: Element
    };
})());


/* pcui/element/element-container.js */
Object.assign(pcui, (function () {
    'use strict';

    var RESIZE_HANDLE_SIZE = 4;

    var VALID_RESIZABLE_VALUES = [
        null,
        'top',
        'right',
        'bottom',
        'left'
    ];

    /**
     * @event
     * @name pcui.Container#append
     * @description Fired when a child Element gets added to the Container
     * @param {pcui.Element} The element that was added
     */

    /**
     * @event
     * @name pcui.Container#remove
     * @description Fired when a child Element gets removed from the Container
     * @param {pcui.Element} The element that was removed
     */

    /**
     * @event
     * @name pcui.Container#scroll
     * @description Fired when the container is scrolled.
     * @param {Event} The native scroll event.
     */

    /**
     * @event
     * @name pcui.Container#resize
     * @description Fired when the container gets resized using the resize handle.
     */

    /**
     * @name pcui.Container
     * @classdesc A container is the basic building block for Elements that are grouped together.
     * A container can contain any other element including other containers.
     * @param {Object} args The arguments. Extends the pcui.Element constructor arguments. All settable properties can also be set through the constructor.
     * @param {HTMLElement} [args.dom] The DOM element to use for the container. If unspecified a new element will be created.
     * @property {Boolean} flex Gets / sets whether the container supports the flex layout. Cannot coexist with grid.
     * @property {Boolean} grid Gets / sets whether the container supports the grid layout. Cannot coexist with flex.
     * @property {Number} resizeMin Gets / sets the minimum size the Container can take when resized in pixels.
     * @property {Number} resizeMax Gets / sets the maximum size the Container can take when resized in pixels.
     * @param {Boolean} scrollable Gets / sets whether the container should be scrollable. Defaults to false.
     * @param {String} resizable Gets / sets whether the Container is resizable and where the resize handle is located. Can
     * be one of 'top', 'bottom', 'right', 'left'. Set to null to disable resizing.
     * @extends pcui.Element
     * @mixes pcui.IContainer
     * @mixes pcui.IFlex
     * @mixes pcui.IGrid
     * @mixes pcui.IScrollable
     * @mixes pcui.IResizable
     */
    function Container(args) {
        if (!args) args = {};

        var dom = args.dom || document.createElement('div');
        dom.classList.add('pcui-container');

        pcui.Element.call(this, dom, args);
        pcui.IContainer.call(this);
        pcui.IFlex.call(this);
        pcui.IGrid.call(this);
        pcui.IScrollable.call(this);
        pcui.IResizable.call(this);

        this._domEventScroll = this._onScroll.bind(this);
        this.domContent = this._dom;

        // scroll
        this.scrollable = args.scrollable !== undefined ? args.scrollable : false;

        // flex
        this.flex = !!args.flex;

        // grid
        var grid = !!args.grid;
        if (grid) {
            if (this.flex) {
                console.error('Invalid pcui.Container arguments: "grid" and "flex" cannot both be true.');
                grid = false;
            }
        }
        this.grid = grid;

        // resize related
        this._domResizeHandle = null;
        this._domEventResizeStart = this._onResizeStart.bind(this);
        this._domEventResizeMove = this._onResizeMove.bind(this);
        this._domEventResizeEnd = this._onResizeEnd.bind(this);
        this._domEventResizeTouchStart = this._onResizeTouchStart.bind(this);
        this._domEventResizeTouchMove = this._onResizeTouchMove.bind(this);
        this._domEventResizeTouchEnd = this._onResizeTouchEnd.bind(this);
        this._resizeTouchId = null;
        this._resizeData = null;
        this._resizeHorizontally = true;

        this.resizable = args.resizable || null;
        this._resizeMin = 100;
        this._resizeMax = 300;

        if (args.resizeMin !== undefined) {
            this.resizeMin = args.resizeMin;
        }
        if (args.resizeMax !== undefined) {
            this.resizeMax = args.resizeMax;
        }
    }

    Container.prototype = Object.create(pcui.Element.prototype);
    utils.mixin(Container.prototype, pcui.IContainer.prototype);
    utils.mixin(Container.prototype, pcui.IFlex.prototype);
    utils.mixin(Container.prototype, pcui.IGrid.prototype);
    utils.mixin(Container.prototype, pcui.IScrollable.prototype);
    utils.mixin(Container.prototype, pcui.IResizable.prototype);
    Container.prototype.constructor = Container;

    /**
     * @name pcui.Container#append
     * @description Appends an element to the container.
     * @param {pcui.Element} element The element to append.
     * @fires 'append'
     */
    Container.prototype.append = function (element) {
        var dom = this._getDomFromElement(element);
        this._domContent.appendChild(dom);
        this._onAppendChild(element);
    };

    /**
     * @name pcui.Container#appendBefore
     * @description Appends an element to the container before the specified reference element.
     * @param {pcui.Element} element The element to append.
     * @param {pcui.Element} referenceElement The element before which the element will be appended.
     * @fires 'append'
     */
    Container.prototype.appendBefore = function (element, referenceElement) {
        var dom = this._getDomFromElement(element);
        this._domContent.appendChild(dom);
        var referenceDom =  referenceElement && this._getDomFromElement(referenceElement);

        if ((referenceDom)) {
            this._domContent.insertBefore(dom, referenceDom);
        } else {
            this._domContent.appendChild(dom);
        }

        this._onAppendChild(element);
    };

    /**
     * @name pcui.Container#appendAfter
     * @description Appends an element to the container just after the specified reference element.
     * @param {pcui.Element} element The element to append.
     * @param {pcui.Element} referenceElement The element after which the element will be appended.
     * @fires 'append'
     */
    Container.prototype.appendAfter = function (element, referenceElement) {
        var dom = this._getDomFromElement(element);
        var referenceDom = referenceElement && this._getDomFromElement(referenceElement);

        var elementBefore = referenceDom ? referenceDom.nextSibling : null;
        if (elementBefore) {
            this._domContent.insertBefore(dom, elementBefore);
        } else {
            this._domContent.appendChild(dom);
        }

        this._onAppendChild(element);
    };

    /**
     * @name pcui.Container#prepend
     * @description Inserts an element in the beginning of the container.
     * @param {pcui.Element} element The element to prepend.
     * @fires 'append'
     */
    Container.prototype.prepend = function (element) {
        var dom = this._getDomFromElement(element);
        var first = this._domContent.firstChild;
        if (first) {
            this._domContent.insertBefore(dom, first);
        } else {
            this._domContent.appendChild(dom);
        }

        this._onAppendChild(element);
    };

    /**
     * @name pcui.Container#remove
     * @description Removes the specified child element from the container.
     * @param {pcui.Element} element The element to remove.
     * @fires 'remove'
     */
    Container.prototype.remove = function (element) {
        if (element.parent !== this) return;

        var dom = this._getDomFromElement(element);
        this._domContent.removeChild(dom);
        element.parent = null;
        this.emit('remove', element);
    };

    /**
     * @name pcui.Container#clear
     * @description Clears all children from the container.
     * @fires 'remove' for each child element.
     */
    Container.prototype.clear = function () {
        var i = this._domContent.childNodes.length;
        while (i--) {
            var node = this._domContent.childNodes[i];
            if (node.ui) {
                node.ui.destroy();
            }
        }

        this._domContent.innerHTML = '';
    };

    // Used for backwards compatibility with the legacy ui framework
    Container.prototype._getDomFromElement = function (element) {
        if (element.dom) {
            return element.dom;
        }

        if (element.element) {
            // console.log('Legacy ui.Element passed to pcui.Container', this.class, element.class);
            return element.element;
        }

        return element;
    };

    Container.prototype._onAppendChild = function (element) {
        element.parent = this;
        this.emit('append', element);
    };

    Container.prototype._onScroll = function (evt) {
        this.emit('scroll', evt);
    };

    Container.prototype._createResizeHandle = function () {
        var handle = document.createElement('div');
        handle.classList.add('pcui-resizable-handle');
        handle.ui = this;

        handle.addEventListener('mousedown', this._domEventResizeStart);
        handle.addEventListener('touchstart', this._domEventResizeTouchStart);

        this._domResizeHandle = handle;
    };

    Container.prototype._onResizeStart = function (evt) {
        evt.preventDefault();
        evt.stopPropagation();

        window.addEventListener('mousemove', this._domEventResizeMove);
        window.addEventListener('mouseup', this._domEventResizeEnd);

        this._resizeStart();
    };

    Container.prototype._onResizeMove = function (evt) {
        evt.preventDefault();
        evt.stopPropagation();

        this._resizeMove(evt.clientX, evt.clientY);
    };

    Container.prototype._onResizeEnd = function (evt) {
        evt.preventDefault();
        evt.stopPropagation();

        window.removeEventListener('mousemove', this._domEventResizeMove);
        window.removeEventListener('mouseup', this._domEventResizeEnd);

        this._resizeEnd();
    };

    Container.prototype._onResizeTouchStart = function (evt) {
        evt.preventDefault();
        evt.stopPropagation();

        for (var i = 0; i < evt.changedTouches.length; i++) {
            var touch = evt.changedTouches[i];
            if (touch.target === this._domResizeHandle) {
                this._resizeTouchId = touch.identifier;
            }
        }

        window.addEventListener('touchmove', this._domEventResizeTouchMove);
        window.addEventListener('touchend', this._domEventResizeTouchEnd);

        this._resizeStart();
    };

    Container.prototype._onResizeTouchMove = function (evt) {
        for (var i = 0; i < evt.changedTouches.length; i++) {
            var touch = evt.changedTouches[i];
            if (touch.identifier !== this._resizeTouchId) {
                continue;
            }

            evt.stopPropagation();
            evt.preventDefault();

            this._resizeMove(touch.clientX, touch.clientY);

            break;
        }
    };

    Container.prototype._onResizeTouchEnd = function (evt) {
        for (var i = 0; i < evt.changedTouches.length; i++) {
            var touch = evt.changedTouches[i];
            if (touch.identifier === this._resizeTouchId) {
                continue;
            }

            this._resizeTouchId = null;

            evt.preventDefault();
            evt.stopPropagation();

            window.removeEventListener('touchmove', this._domEventResizeTouchMove);
            window.removeEventListener('touchend', this._domEventResizeTouchEnd);

            this._resizeEnd();

            break;
        }
    };

    Container.prototype._resizeStart = function () {
        this.class.add('pcui-resizable-resizing');
    };

    Container.prototype._resizeMove = function (x, y) {
        // if we haven't initialized resizeData do so now
        if (!this._resizeData) {
            this._resizeData = {
                x: x,
                y: y,
                width: this.dom.clientWidth,
                height: this.dom.clientHeight
            };

            return;
        }

        if (this._resizeHorizontally) {
            // horizontal resizing
            var offsetX = this._resizeData.x - x;

            if (this._resizable === 'right') {
                offsetX = -offsetX;
            }

            this.width = RESIZE_HANDLE_SIZE + Math.max(this._resizeMin, Math.min(this._resizeMax, (this._resizeData.width + offsetX)));
        } else {
            // vertical resizing
            var offsetY = this._resizeData.y - y;

            if (this._resizable === 'bottom') {
                offsetY = -offsetY;
            }

            this.height = Math.max(this._resizeMin, Math.min(this._resizeMax, (this._resizeData.height + offsetY)));
        }

        this.emit('resize');
    };

    Container.prototype._resizeEnd = function () {
        this._resizeData = null;
        this.class.remove('pcui-resizable-resizing');
    };

    Container.prototype.destroy = function () {
        this.domContent = null;

        if (this._domResizeHandle) {
            this._domResizeHandle.removeEventListener('mousedown', this._domEventResizeStart);
            window.removeEventListener('mousemove', this._domEventResizeMove);
            window.removeEventListener('mouseup', this._domEventResizeEnd);

            this._domResizeHandle.removeEventListener('touchstart', this._domEventResizeTouchStart);
            window.removeEventListener('touchmove', this._domEventResizeTouchMove);
            window.removeEventListener('touchend', this._domEventResizeTouchEnd);
        }

        this._domResizeHandle = null;
        this._domEventResizeStart = null;
        this._domEventResizeMove = null;
        this._domEventResizeEnd = null;
        this._domEventResizeTouchStart = null;
        this._domEventResizeTouchMove = null;
        this._domEventResizeTouchEnd = null;

        pcui.Element.prototype.destroy.call(this);
    };

    Object.defineProperty(Container.prototype, 'flex', {
        get: function () {
            return this._flex;
        },
        set: function (value) {
            if (value === this._flex) return;

            this._flex = value;

            if (value) {
                this.class.add('pcui-flex');
            } else {
                this.class.remove('pcui-flex');
            }
        }
    });

    Object.defineProperty(Container.prototype, 'grid', {
        get: function () {
            return this._grid;
        },
        set: function (value) {
            if (value === this._grid) return;

            this._grid = value;

            if (value) {
                this.class.add('pcui-grid');
            } else {
                this.class.remove('pcui-grid');
            }
        }
    });

    Object.defineProperty(Container.prototype, 'scrollable', {
        get: function () {
            return this._scrollable;
        },
        set: function (value) {
            if (this._scrollable === value) return;

            this._scrollable = value;

            if (value) {
                this.class.add('pcui-scrollable');
            } else {
                this.class.remove('pcui-scrollable');
            }

        }
    });

    Object.defineProperty(Container.prototype, 'resizable', {
        get: function () {
            return this._resizable;
        },
        set: function (value) {
            if (value === this._resizable) return;

            if (VALID_RESIZABLE_VALUES.indexOf(value) === -1) {
                console.error('Invalid resizable value: must be one of ' + VALID_RESIZABLE_VALUES.join(','));
                return;
            }

            // remove old class
            if (this._resizable) {
                this.class.remove('pcui-resizable-' + this._resizable);
            }

            this._resizable = value;
            this._resizeHorizontally = (value === 'right' || value === 'left');

            if (value) {
                // add resize class and create / append resize handle
                this.class.add('pcui-resizable');
                this.class.add('pcui-resizable-' + value);

                if (!this._domResizeHandle) {
                    this._createResizeHandle();
                }
                this._dom.appendChild(this._domResizeHandle);
            } else {
                // remove resize class and resize handle
                this.class.remove('pcui-resizable');
                if (this._domResizeHandle) {
                    this._dom.removeChild(this._domResizeHandle);
                }
            }

        }
    });

    Object.defineProperty(Container.prototype, 'resizeMin', {
        get: function () {
            return this._resizeMin;
        },
        set: function (value) {
            this._resizeMin = Math.max(0, Math.min(value, this._resizeMax));
        }
    });

    Object.defineProperty(Container.prototype, 'resizeMax', {
        get: function () {
            return this._resizeMax;
        },
        set: function (value) {
            this._resizeMax = Math.max(this._resizeMin, value);
        }
    });

    // The internal dom element used as a the container of all children.
    // Can be overriden by derived classes
    Object.defineProperty(Container.prototype, 'domContent', {
        get: function () {
            return this._domContent;
        },
        set: function (value) {
            if (this._domContent === value) return;

            if (this._domContent) {
                this._domContent.removeEventListener('scroll', this._domEventScroll);
            }

            this._domContent = value;

            if (this._domContent) {
                this._domContent.addEventListener('scroll', this._domEventScroll);
            }
        }
    });

    return {
        Container: Container
    };
})());


/* pcui/element/element-panel.js */
Object.assign(pcui, (function () {
    'use strict';

    // TODO: document panelType

    /**
     * @event
     * @name pcui.Panel#collapse
     * @description Fired when the panel gets collapsed
     */

    /**
     * @event
     * @name pcui.Panel#expand
     * @description Fired when the panel gets expanded
     */

    /**
     * @name pcui.Panel
     * @classdesc The Panel is a pcui.Container that itself contains a header container and a content container. The
     * respective pcui.Container functions work using the content container. One can also append elements to the header of the Panel.
     * @param {Object} args The arguments. Extends the pcui.Container constructor arguments. All settable properties can also be set through the constructor.
     * @property {Boolean} flex Gets / sets whether the container supports flex layout. Defaults to false. Cannot co-exist with grid.
     * @property {Boolean} grid Gets / sets whether the container supports grid layout. Defaults to false. Cannot co-exist with flex.
     * @property {Boolean} collapsible Gets / sets whether the panel can be collapsed by clicking on its header or by setting collapsed to true. Defaults to false.
     * @property {Boolean} collapsed Gets / sets whether the panel is collapsed or expanded. Defaults to false.
     * @property {Boolean} collapseHorizontally Gets / sets whether the panel collapses horizontally - this would be the case for side panels. Defaults to false.
     * @property {Number} headerSize The height of the header in pixels. Defaults to 32.
     * @property {String} headerText The header text of the panel. Defaults to the empty string.
     * @property {pcui.Container} header Gets the header conttainer.
     * @property {pcui.Container} content Gets the content conttainer.
     * @extends pcui.Element
     * @mixes pcui.IContainer
     * @mixes pcui.IFlex
     * @mixes pcui.IGrid
     * @mixes pcui.IScrollable
     * @mixes pcui.IResizable
     */
    function Panel(args) {
        if (!args) args = {};

        var panelArgs = Object.assign({}, args);
        panelArgs.flex = true;
        delete panelArgs.flexDirection;
        delete panelArgs.scrollable;

        pcui.Container.call(this, panelArgs);
        pcui.ICollapsible.call(this);

        this.class.add('pcui-panel');

        if (args.panelType) {
            this.class.add('pcui-panel-' + args.panelType);
        }

        // do not call reflow on every update while
        // we are initializing
        this._suspendReflow = true;

        // initialize header container
        this._initializeHeader(args);

        // initialize content container
        this._initializeContent(args);

        // event handlers
        this._evtAppend = null;
        this._evtRemove = null;

        // header size
        this.headerSize = args.headerSize !== undefined ? args.headerSize : 32;

        // collapse related
        this._reflowTimeout = null;
        this._widthBeforeCollapse = null;
        this._heightBeforeCollapse = null;

        // if we initialize the panel collapsed
        // then use the width / height passed in the arguments
        // as the size to expand to
        if (args.collapsed) {
            if (args.width) {
                this._widthBeforeCollapse = args.width;
            }
            if (args.height) {
                this._heightBeforeCollapse = args.height;
            }
        }

        this.collapsible = args.collapsible || false;
        this.collapsed = args.collapsed || false;
        this.collapseHorizontally = args.collapseHorizontally || false;

        // set the contents container to be the content DOM element
        // from now on calling append functions on the panel will append themn
        // elements to the contents container
        this.domContent = this._containerContent.dom;

        // execute reflow now after all fields have been initialized
        this._suspendReflow = false;
        this._reflow();
    }

    Panel.prototype = Object.create(pcui.Container.prototype);
    utils.mixin(Panel.prototype, pcui.ICollapsible.prototype);
    Panel.prototype.constructor = Panel;

    Panel.prototype._initializeHeader = function (args) {
        // header container
        this._containerHeader = new pcui.Container({
            flex: true,
            flexDirection: 'row'
        });
        this._containerHeader.class.add('pcui-panel-header');

        // header title
        this._domHeaderTitle = document.createElement('span');
        this._domHeaderTitle.textContent = args.headerText || '';
        this._domHeaderTitle.classList.add('pcui-panel-header-title');
        this._domHeaderTitle.ui = this._containerHeader;
        this._containerHeader.dom.appendChild(this._domHeaderTitle);

        // use native click listener because the pcui.Element#click event is only fired
        // if the element is enabled. However we still want to catch header click events in order
        // to collapse them
        this._containerHeader.dom.addEventListener('click', this._onHeaderClick.bind(this));

        this.append(this._containerHeader);
    };

    Panel.prototype._onHeaderClick = function (evt) {
        if (!this._collapsible) return;
        if (evt.target !== this.header.dom && evt.target !== this._domHeaderTitle) return;

        // toggle collapsed
        this.collapsed = !this.collapsed;
    };

    Panel.prototype._initializeContent = function (args) {
        // containers container
        this._containerContent = new pcui.Container({
            flex: args.flex,
            flexDirection: args.flexDirection,
            scrollable: args.scrollable
        });
        this._containerContent.class.add('pcui-panel-content');

        this.append(this._containerContent, this._containerHeader);
    };

    Panel.prototype._onChildrenChange = function () {
        if (!this.collapsible || this.collapsed || this._collapseHorizontally || this.hidden) {
            return;
        }

        this.height = this.headerSize + this._containerContent.dom.clientHeight;
    };

    // Collapses or expands the panel as needed
    Panel.prototype._reflow = function () {
        if (this._suspendReflow) {
            return;
        }

        if (this._reflowTimeout) {
            cancelAnimationFrame(this._reflowTimeout);
            this._reflowTimeout = null;
        }

        if (this.hidden || !this.collapsible) return;

        if (this.collapsed && this.collapseHorizontally) {
            this._containerHeader.style.top = -this.headerSize + 'px';
        } else {
            this._containerHeader.style.top = '';
        }

        // we rely on the content width / height and we have to
        // wait for 1 frame before we can get the final values back
        this._reflowTimeout = requestAnimationFrame(function () {
            this._reflowTimeout = null;

            if (this.collapsed) {
                // remember size before collapse
                if (!this._widthBeforeCollapse) {
                    this._widthBeforeCollapse = this.dom.clientWidth;
                }
                if (!this._heightBeforeCollapse) {
                    this._heightBeforeCollapse = this.dom.clientHeight;
                }

                if (this._collapseHorizontally) {
                    this.height = '';
                    this.width = this.headerSize;
                } else {
                    this.height = this.headerSize;
                }
            } else {
                if (this._collapseHorizontally) {
                    this.height = '';
                    if (this._widthBeforeCollapse !== null) {
                        this.width = this._widthBeforeCollapse;
                    }
                } else {
                    if (this._heightBeforeCollapse !== null) {
                        this.height = this._heightBeforeCollapse;
                    }
                }

                // reset before collapse vars
                this._widthBeforeCollapse = null;
                this._heightBeforeCollapse = null;
            }
        }.bind(this));
    };

    Panel.prototype.destroy = function () {
        if (this._reflowTimeout) {
            cancelAnimationFrame(this._reflowTimeout);
            this._reflowTimeout = null;
        }

        pcui.Container.prototype.destroy.call(this);
    };

    Object.defineProperty(Panel.prototype, 'collapsible', {
        get: function () {
            return this._collapsible;
        },
        set: function (value) {
            if (value === this._collapsible) return;

            this._collapsible = value;

            if (this._evtAppend) {
                this._evtAppend.unbind();
                this._evtAppend = null;
            }

            if (this._evtRemove) {
                this._evtRemove.unbind();
                this._evtRemove = null;
            }

            if (value) {
                // listen to append / remove events so we can change our height
                var onChange = this._onChildrenChange.bind(this);
                this._evtAppend = this._containerContent.on('append', onChange);
                this._evtRemove = this._containerContent.on('remove', onChange);

                this.class.add('pcui-collapsible');
            } else {
                this.class.remove('pcui-collapsible');
            }

            this._reflow();

            if (this.collapsed) {
                this.emit(value ? 'collapse' : 'expand');
            }

        }
    });

    Object.defineProperty(Panel.prototype, 'collapsed', {
        get: function () {
            return this._collapsed;
        },
        set: function (value) {
            if (this._collapsed === value) return;

            this._collapsed = value;

            if (value) {
                this.class.add('pcui-collapsed');
            } else {
                this.class.remove('pcui-collapsed');
            }

            this._reflow();

            if (this.collapsible) {
                this.emit(value ? 'collapse' : 'expand');
            }
        }
    });

    Object.defineProperty(Panel.prototype, 'collapseHorizontally', {
        get: function () {
            return this._collapseHorizontally;
        },
        set: function (value) {
            if (this._collapseHorizontally === value) return;

            this._collapseHorizontally = value;
            if (value) {
                this.class.add('pcui-panel-horizontal');
            } else {
                this.class.remove('pcui-panel-horizontal');
            }

            this._reflow();
        }
    });

    Object.defineProperty(Panel.prototype, 'content', {
        get: function () {
            return this._containerContent;
        }
    });

    Object.defineProperty(Panel.prototype, 'header', {
        get: function () {
            return this._containerHeader;
        }
    });

    Object.defineProperty(Panel.prototype, 'headerText', {
        get: function () {
            return this._domHeaderTitle.textContent;
        },
        set: function (value) {
            this._domHeaderTitle.textContent = value;
        }
    });

    Object.defineProperty(Panel.prototype, 'headerSize', {
        get: function () {
            return this._headerSize;
        },
        set: function (value) {
            this._headerSize = value;
            var style = this._containerHeader.dom.style;
            style.height = Math.max(0, value) + 'px';
            style.lineHeight = style.height;
            this._reflow();
        }
    });

    return {
        Panel: Panel
    };
})());
