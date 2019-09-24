
/* ui.js */
"use strict";

window.ui = { };


/* ui/element.js */
Object.assign(ui, (function () {
    "use strict";

    function Element() {
        Events.call(this);
        // this.parent = null;

        this._parent = null;
        var self = this;
        this._parentDestroy = function() {
            self.destroy();
        };

        this._destroyed = false;
        this._element = null;
        this._link = null;
        this.path = '';
        this._linkSet = null;
        this._linkUnset = null;
        this.renderChanges = null;
        // render changes only from next ticks
        setTimeout(function() {
            if (self.renderChanges === null)
                self.renderChanges = true;
        }, 0);

        this.disabledClick = false;
        this._disabled = false;
        this._disabledParent = false;

        this._evtClick = null;

        this._parentDisable = function() {
            if (self._disabledParent)
                return;

            self._disabledParent = true;

            if (! self._disabled) {
                self.emit('disable');
                self.class.add('disabled');
            }
        };
        this._parentEnable = function() {
            if (! self._disabledParent)
                return;

            self._disabledParent = false;

            if (! self._disabled) {
                self.emit('enable');
                self.class.remove('disabled');
            }
        };

        this._onFlashDelay = function() {
            self.class.remove('flash');
        };
    }
    Element.prototype = Object.create(Events.prototype);

    Element.prototype.link = function(link, path) {
        var self = this;

        if (this._link) this.unlink();
        this._link = link;
        this.path = path;

        this.emit('link', path);

        // add :set link
        if (this._onLinkChange) {
            var renderChanges = this.renderChanges;
            this.renderChanges = false;
            this._linkOnSet = this._link.on(this.path + ':set', function(value) {
                self._onLinkChange(value);
            });
            this._linkOnUnset = this._link.on(this.path + ':unset', function(value) {
                self._onLinkChange(value);
            });
            this._onLinkChange(this._link.get(this.path));
            this.renderChanges = renderChanges;
        }
    };

    Element.prototype.unlink = function() {
        if (! this._link) return;

        this.emit('unlink', this.path);

        // remove :set link
        if (this._linkOnSet) {
            this._linkOnSet.unbind();
            this._linkOnSet = null;

            this._linkOnUnset.unbind();
            this._linkOnUnset = null;
        }

        this._link = null;
        this.path = '';
    };

    Element.prototype.destroy = function() {
        if (this._destroyed)
            return;

        this._destroyed = true;

        if (this._parent) {
            this._evtParentDestroy.unbind();
            this._evtParentDisable.unbind();
            this._evtParentEnable.unbind();
            this._parent = null;
        }

        if (this._element.parentNode)
            this._element.parentNode.removeChild(this._element);

        this.unlink();

        this.emit('destroy');

        this.unbind();
    };

    Object.defineProperty(Element.prototype, 'element', {
        get: function() {
            return this._element;
        },
        set: function(value) {
            if (this._element)
                return;

            this._element = value;
            this._element.ui = this;

            var self = this;
            this._evtClick = function(evt) {
                if (self.disabled && ! self.disabledClick) return;
                self.emit('click', evt);
            };
            this._element.addEventListener('click', this._evtClick, false);

            this._evtHover = function(evt) {
                self.emit('hover', evt);
            };
            this._element.addEventListener('mouseover', this._evtHover, false);

            this._evtBlur = function(evt) {
                self.emit('blur', evt);
            };
            this._element.addEventListener('mouseout', this._evtBlur, false);

            if (! this.innerElement)
                this.innerElement = this._element;
        }
    });

    Object.defineProperty(Element.prototype, 'parent', {
        get: function() {
            return this._parent;
        },
        set: function(value) {
            if (this._parent) {
                this._parent = null;
                this._evtParentDestroy.unbind();
                this._evtParentDisable.unbind();
                this._evtParentEnable.unbind();
            }

            if (value) {
                this._parent = value;
                this._evtParentDestroy = this._parent.once('destroy', this._parentDestroy);
                this._evtParentDisable = this._parent.on('disable', this._parentDisable);
                this._evtParentEnable = this._parent.on('enable', this._parentEnable);

                if (this._disabledParent !== this._parent.disabled) {
                    this._disabledParent = this._parent.disabled;

                    if (this._disabledParent) {
                        this.class.add('disabled');
                        this.emit('disable');
                    } else {
                        this.class.remove('disabled');
                        this.emit('enable');
                    }
                }
            }

            this.emit('parent');
        }
    });

    Object.defineProperty(Element.prototype, 'disabled', {
        get: function() {
            return this._disabled || this._disabledParent;
        },
        set: function(value) {
            if (this._disabled == value)
                return;

            this._disabled = !! value;
            this.emit((this._disabled || this._disabledParent) ? 'disable' : 'enable');

            if ((this._disabled || this._disabledParent)) {
                this.class.add('disabled');
            } else {
                this.class.remove('disabled');
            }
        }
    });

    Object.defineProperty(Element.prototype, 'disabledSelf', {
        get: function() {
            return this._disabled;
        }
    });

    Object.defineProperty(Element.prototype, 'enabled', {
        get: function() {
            return ! this._disabled;
        },
        set: function(value) {
            this.disabled = ! value;
        }
    });

    Object.defineProperty(Element.prototype, 'value', {
        get: function() {
            if (! this._link) return null;
            return this._link.get(this.path);
        },
        set: function(value) {
            if (! this._link) return;
            this._link.set(this.path, value);
        }
    });


    Object.defineProperty(Element.prototype, 'hidden', {
        get: function() {
            return this._element.classList.contains('hidden');
        },
        set: function(value) {
            if (this._element.classList.contains('hidden') === !! value)
                return;

            if (value) {
                this._element.classList.add('hidden');
                this.emit('hide');
            } else {
                this._element.classList.remove('hidden');
                this.emit('show');
            }
        }
    });


    Object.defineProperty(Element.prototype, 'style', {
        get: function() {
            return this._element.style;
        }
    });


    Object.defineProperty(Element.prototype, 'class', {
        get: function() {
            return this._element.classList;
        }
    });


    Object.defineProperty(Element.prototype, 'flexGrow', {
        get: function() {
            return this._element.style.flexGrow;
        },
        set: function(value) {
            this._element.style.flexGrow = value;
            this._element.style.WebkitFlexGrow = value;
        }
    });


    Object.defineProperty(Element.prototype, 'flexShrink', {
        get: function() {
            return this._element.style.flexShrink;
        },
        set: function(value) {
            this._element.style.flexShrink = value;
            this._element.style.WebkitFlexShrink = value;
        }
    });


    Element.prototype.flash = function() {
        this.class.add('flash');
        setTimeout(this._onFlashDelay, 200);
    };

    return {
        Element: Element
    };

})());


/* ui/container-element.js */
"use strict";

function ContainerElement() {
    var self = this;

    ui.Element.call(this);
    this._innerElement = null;

    this._observerChanged = false;

    var observerTimeout = function() {
        self._observerChanged = false;
        self.emit('nodesChanged');
    };

    this._observer = new MutationObserver(function() {
        if (self._observerChanged)
            return;

        self._observerChanged = true;

        setTimeout(observerTimeout, 0);
    });
}
ContainerElement.prototype = Object.create(ui.Element.prototype);


ContainerElement.prototype._observerOptions = {
    childList: true,
    attributes: true,
    characterData: false,
    subtree: true,
    attributeOldValue: false,
    characterDataOldValue: false
};


ContainerElement.prototype.append = function(element) {
    var html = (element instanceof HTMLElement);
    var node = html ? element : element.element;

    this._innerElement.appendChild(node);

    if (! html) {
        element.parent = this;
        this.emit('append', element);
    }
};


ContainerElement.prototype.appendBefore = function(element, reference) {
    var html = (element instanceof HTMLElement);
    var node = html ? element : element.element;

    if (reference instanceof ui.Element)
        reference = reference.element;

    this._innerElement.insertBefore(node, reference);

    if (! html) {
        element.parent = this;
        this.emit('append', element);
    }
};

ContainerElement.prototype.appendAfter = function(element, reference) {
    var html = (element instanceof HTMLElement);
    var node = html ? element : element.element;

    if (reference instanceof ui.Element)
        reference = reference.element;

    reference = reference.nextSibling;

    if (reference) {
        this._innerElement.insertBefore(node, reference);
    } else {
        this._innerElement.appendChild(node);
    }

    if (! html) {
        element.parent = this;
        this.emit('append', element);
    }
};


ContainerElement.prototype.prepend = function(element) {
    var first = this._innerElement.firstChild;
    var html = (element instanceof HTMLElement);
    var node = html ? element : element.element;

    if (first) {
        this._innerElement.insertBefore(node, first);
    } else {
        this._innerElement.appendChild(node);
    }

    if (! html) {
        element.parent = this;
        this.emit('append', element);
    }
};

ContainerElement.prototype.remove = function(element) {
    var html = (element instanceof HTMLElement);
    var node = html ? element : element.element;

    if (! node.parentNode || node.parentNode !== this._innerElement)
        return;

    this._innerElement.removeChild(node);

    if (! html) {
        element.parent = null;
        this.emit('remove', element);
    }
};


Object.defineProperty(ContainerElement.prototype, 'innerElement', {
    get: function() {
        return this._innerElement;
    },
    set: function(value) {
        if (this._innerElement) {
            this._observer.disconnect();
        }

        this._innerElement = value;

        this._observer.observe(this._innerElement, this._observerOptions);
    }
});


ContainerElement.prototype.clear = function() {
    var i, node;

    this._observer.disconnect();

    i = this._innerElement.childNodes.length;
    while(i--) {
        node = this._innerElement.childNodes[i];

        if (! node.ui)
            continue;

        node.ui.destroy();
    }
    this._innerElement.innerHTML = '';

    this._observer.observe(this._innerElement, this._observerOptions);
};


Object.defineProperty(ContainerElement.prototype, 'flexible', {
    get: function() {
        return this._element.classList.contains('flexible');
    },
    set: function(value) {
        if (this._element.classList.contains('flexible') === !! value)
            return;

        if (value) {
            this._element.classList.add('flexible');
        } else {
            this._element.classList.remove('flexible');
        }
    }
});


Object.defineProperty(ContainerElement.prototype, 'flex', {
    get: function() {
        return this._element.classList.contains('flex');
    },
    set: function(value) {
        if (this._element.classList.contains('flex') === !! value)
            return;

        if (value) {
            this._element.classList.add('flex');
        } else {
            this._element.classList.remove('flex');
        }
    }
});


Object.defineProperty(ContainerElement.prototype, 'flexDirection', {
    get: function() {
        return this._innerElement.style.flexDirection;
    },
    set: function(value) {
        this._innerElement.style.flexDirection = value;
        this._innerElement.style.WebkitFlexDirection = value;
    }
});


Object.defineProperty(ContainerElement.prototype, 'flexWrap', {
    get: function() {
        return this._innerElement.style.flexWrap;
    },
    set: function(value) {
        this.flex = true;
        this._innerElement.style.flexWrap = value;
        this._innerElement.style.WebkitFlexWrap = value;
    }
});

Object.defineProperty(ContainerElement.prototype, 'flexGrow', {
    get: function() {
        return this._element.style.flexGrow === 1;
    },
    set: function(value) {
        if (value)
            this.flex = true;

        this._element.style.flexGrow = !! value ? 1 : 0;
        this._element.style.WebkitFlexGrow = !! value ? 1 : 0;
        this._innerElement.style.flexGrow = this._element.style.flexGrow;
        this._innerElement.style.WebkitFlexGrow = this._element.style.flexGrow;
    }
});


Object.defineProperty(ContainerElement.prototype, 'flexShrink', {
    get: function() {
        return this._element.style.flexShrink === 1;
    },
    set: function(value) {
        if (value)
            this.flex = true;

        this._element.style.flexShrink = !! value ? 1 : 0;
        this._element.style.WebkitFlexShrink = !! value ? 1 : 0;
        this._innerElement.style.flexShrink = this._element.style.flexShrink;
        this._innerElement.style.WebkitFlexShrink = this._element.style.flexShrink;
    }
});


Object.defineProperty(ContainerElement.prototype, 'scroll', {
    get: function() {
        return this.class.contains('scrollable');
    },
    set: function() {
        this.class.add('scrollable');
    }
});


window.ui.ContainerElement = ContainerElement;


/* ui/button.js */
"use strict";

function Button(args) {
    var self = this;
    ui.Element.call(this);
    args = args || { };

    this._text = args.text || '';

    this.element = document.createElement('div');
    this._element.classList.add('ui-button');
    this._element.innerHTML = this._text;

    this._element.ui = this;
    this._element.tabIndex = 0;

    // space > click
    this._element.addEventListener('keydown', this._onKeyDown, false);
    this.on('click', this._onClick);
}
Button.prototype = Object.create(ui.Element.prototype);

Button.prototype._onKeyDown = function(evt) {
    if (evt.keyCode === 27)
        return this.blur();

    if (evt.keyCode !== 32 || this.ui.disabled)
        return;

    evt.stopPropagation();
    evt.preventDefault();
    this.ui.emit('click');
};

Button.prototype._onClick = function() {
    this._element.blur();
};

Button.prototype._onLinkChange = function(value) {
    this._element.value = value;
};

Object.defineProperty(Button.prototype, 'text', {
    get: function() {
        return this._text;
    },
    set: function(value) {
        if (this._text === value) return;
        this._text = value;
        this._element.innerHTML = this._text;
    }
});

window.ui.Button = Button;


/* ui/checkbox.js */
"use strict";

function Checkbox(args) {
    ui.Element.call(this);
    args = args || { };

    this._text = args.text || '';

    this.element = document.createElement('div');
    this._element.classList.add('ui-checkbox', 'noSelect');
    this._element.tabIndex = 0;

    this._element.addEventListener('keydown', this._onKeyDown, false);

    this.on('click', this._onClick);
    this.on('change', this._onChange);
}
Checkbox.prototype = Object.create(ui.Element.prototype);


Checkbox.prototype._onClick = function() {
    this.value = ! this.value;
    this._element.blur();
};

Checkbox.prototype._onChange = function() {
    if (! this.renderChanges)
        return;

    this.flash();
};

Checkbox.prototype._onKeyDown = function(evt) {
    if (evt.keyCode === 27)
        return this.blur();

    if (evt.keyCode !== 32 || this.ui.disabled)
        return;

    evt.stopPropagation();
    evt.preventDefault();
    this.ui.value = ! this.ui.value;
};

Checkbox.prototype._onLinkChange = function(value) {
    if (value === null) {
        this._element.classList.remove('checked');
        this._element.classList.add('null');
    } else if (value) {
        this._element.classList.add('checked');
        this._element.classList.remove('null');
    } else {
        this._element.classList.remove('checked', 'null');
    }
    this.emit('change', value);
};


Object.defineProperty(Checkbox.prototype, 'value', {
    get: function() {
        if (this._link) {
            return this._link.get(this.path);
        } else {
            return this._element.classList.contains('checked');
        }
    },
    set: function(value) {
        if (this._link) {
            this._link.set(this.path, value);
        } else {
            if (this._element.classList.contains('checked') !== value)
                this._onLinkChange(value);
        }
    }
});


window.ui.Checkbox = Checkbox;


/* ui/code.js */
"use strict";

function Code() {
    ui.ContainerElement.call(this);

    this.element = document.createElement('pre');
    this._element.classList.add('ui-code');
}
Code.prototype = Object.create(ui.ContainerElement.prototype);


Object.defineProperty(Code.prototype, 'text', {
    get: function() {
        return this._element.textContent;
    },
    set: function(value) {
        this._element.textContent = value;
    }
});


window.ui.Code = Code;


/* ui/label.js */
"use strict";

function Label(args) {
    ui.Element.call(this);
    args = args || { };

    this._text = args.text || '';

    // if unsafe is true then use innerHTML for the
    // contents
    this._unsafe = !!args.unsafe;

    this.element = document.createElement('span');
    this._element.classList.add('ui-label');

    if (this._text)
        this._setText(this._text);

    this.on('change', this._onChange);

    if (args.placeholder)
        this.placeholder = args.placeholder;
}
Label.prototype = Object.create(ui.Element.prototype);

Label.prototype._setText = function (text) {
    if (this._unsafe) {
        this._element.innerHTML = text;
    } else {
        this._element.textContent = text;
    }
};

Label.prototype._onChange = function() {
    if (! this.renderChanges)
        return;

    this.flash();
};

Label.prototype._onLinkChange = function(value) {
    this.text = value;
    this.emit('change', value);
};


Object.defineProperty(Label.prototype, 'text', {
    get: function() {
        if (this._link) {
            return this._link.get(this.path);
        } else {
            return this._text;
        }
    },
    set: function(value) {
        if (this._link) {
            if (! this._link.set(this.path, value)) {
                value = this._link.get(this.path);
                this._setText(value);
            }
        } else {
            if (this._text === value) return;

            this._text = value;
            if (value === undefined || value === null)
                this._text = '';

            this._setText(this._text);
            this.emit('change', value);
        }
    }
});

Object.defineProperty(Label.prototype, 'value', {
    get: function () {
        return this.text;
    },
    set: function (value) {
        this.text = value;
    }
});

Object.defineProperty(Label.prototype, 'placeholder', {
    get: function() {
        return this._element.getAttribute('placeholder');
    },
    set: function(value) {
        this._element.setAttribute('placeholder', value);
    }
});


window.ui.Label = Label;


/* ui/number-field.js */
"use strict";

function NumberField(args) {
    ui.Element.call(this);
    args = args || { };

    this.precision = (args.precision != null) ? args.precision : null;
    this.step = (args.step != null) ? args.step : ((args.precision != null) ? 1 / Math.pow(10, args.precision) : 1);

    this.max = (args.max !== null) ? args.max : null;
    this.min = (args.min !== null) ? args.min : null;

    this.allowNull = !!args.allowNull;

    this.element = document.createElement('div');
    this._element.classList.add('ui-number-field');

    this.elementInput = document.createElement('input');
    this.elementInput.ui = this;
    this.elementInput.tabIndex = 0;
    this.elementInput.classList.add('field');
    this.elementInput.type = 'text';
    this.elementInput.addEventListener('focus', this._onInputFocus, false);
    this.elementInput.addEventListener('blur', this._onInputBlur, false);
    this.elementInput.addEventListener('keydown', this._onKeyDown, false);
    this.elementInput.addEventListener('dblclick', this._onFullSelect, false);
    this.elementInput.addEventListener('contextmenu', this._onFullSelect, false);
    this._element.appendChild(this.elementInput);

    if (args.default !== undefined)
        this.value = args.default;

    this.elementInput.addEventListener('change', this._onChange, false);
    // this._element.addEventListener('mousedown', this._onMouseDown.bind(this), false);
    // this._element.addEventListener('mousewheel', this._onMouseDown.bind(this), false);

    this.blurOnEnter = true;
    this.refocusable = true;

    this._lastValue = this.value;
    this._mouseMove = null;
    this._dragging = false;
    this._dragDiff = 0;
    this._dragStart = 0;

    this.on('disable', this._onDisable);
    this.on('enable', this._onEnable);
    this.on('change', this._onChangeField);

    if (args.placeholder)
        this.placeholder = args.placeholder;
}
NumberField.prototype = Object.create(ui.Element.prototype);


NumberField.prototype._onLinkChange = function(value) {
    this.elementInput.value = value || 0;
    this.emit('change', value || 0);
};

NumberField.prototype._onChange = function() {
    var value = parseFloat(this.ui.elementInput.value, 10);
    if (isNaN(value)) {
        if (this.ui.allowNull) {
            this.ui.value = null;
        } else {
            this.ui.elementInput.value = 0;
            this.ui.value = 0;
        }
    } else {
        this.ui.elementInput.value = value;
        this.ui.value = value;
    }
};

NumberField.prototype.focus = function(select) {
    this.elementInput.focus();
    if (select) this.elementInput.select();
};

NumberField.prototype._onInputFocus = function() {
    this.ui.class.add('focus');
};

NumberField.prototype._onInputBlur = function() {
    this.ui.class.remove('focus');
};

NumberField.prototype._onKeyDown = function(evt) {
    if (evt.keyCode === 27)
        return this.blur();

    if (this.ui.blurOnEnter && evt.keyCode === 13) {
        var focused = false;

        var parent = this.ui.parent;
        while(parent) {
            if (parent.focus) {
                parent.focus();
                focused = true;
                break;
            }

            parent = parent.parent;
        }

        if (! focused)
            this.blur();

        return;
    }

    if (this.ui.disabled || [ 38, 40 ].indexOf(evt.keyCode) === -1)
        return;

    var inc = evt.keyCode === 40 ? -1 : 1;

    if (evt.shiftKey)
        inc *= 10;

    var value = this.ui.value + (this.ui.step || 1) * inc;

    if (this.ui.max != null)
        value = Math.min(this.ui.max, value);

    if (this.ui.min != null)
        value = Math.max(this.ui.min, value);

    if (this.ui.precision != null)
        value = parseFloat(value.toFixed(this.ui.precision), 10);

    this.value = value;
    this.ui.value = value;
};

NumberField.prototype._onFullSelect = function() {
    this.select();
};

NumberField.prototype._onDisable = function() {
    this.elementInput.readOnly = true;
};

NumberField.prototype._onEnable = function() {
    this.elementInput.readOnly = false;
};

NumberField.prototype._onChangeField = function() {
    if (! this.renderChanges)
        return;

    this.flash();
};

Object.defineProperty(NumberField.prototype, 'value', {
    get: function() {
        if (this._link) {
            return this._link.get(this.path);
        } else {
            return this.elementInput.value !== '' ? parseFloat(this.elementInput.value, 10) : null;
        }
    },
    set: function(value) {
        if (this._link) {
            if (! this._link.set(this.path, value)) {
                this.elementInput.value = this._link.get(this.path);
            }
        } else {
            if (value !== null) {
                if (this.max !== null && this.max < value)
                    value = this.max;

                if (this.min !== null && this.min > value)
                    value = this.min;
            }

            value = (value !== null && value !== undefined && (this.precision !== null) ? parseFloat(value.toFixed(this.precision), 10) : value);
            if (value === undefined)
                value = null;

            var different = this._lastValue !== value;

            this._lastValue = value;
            this.elementInput.value = value;

            if (different) {
                this.emit('change', value);
            }
        }
    }
});


Object.defineProperty(NumberField.prototype, 'placeholder', {
    get: function() {
        return this._element.getAttribute('placeholder');
    },
    set: function(value) {
        if (! value) {
            this._element.removeAttribute('placeholder');
        } else {
            this._element.setAttribute('placeholder', value);
        }
    }
});


Object.defineProperty(NumberField.prototype, 'proxy', {
    get: function() {
        return this._element.getAttribute('proxy');
    },
    set: function(value) {
        if (! value) {
            this._element.removeAttribute('proxy');
        } else {
            this._element.setAttribute('proxy', value);
        }
    }
});


window.ui.NumberField = NumberField;


/* ui/overlay.js */
"use strict"

function Overlay(args) {
    ui.ContainerElement.call(this);
    args = args || { };

    this.element = document.createElement('div');
    this._element.classList.add('ui-overlay', 'center');

    this.elementOverlay = document.createElement('div');
    this.elementOverlay.ui = this;
    this.elementOverlay.classList.add('overlay', 'clickable');
    this._element.appendChild(this.elementOverlay);

    this.elementOverlay.addEventListener('mousedown', this._onMouseDown, false);

    this.innerElement = document.createElement('div');
    this.innerElement.classList.add('content');
    this._element.appendChild(this.innerElement);
}
Overlay.prototype = Object.create(ui.ContainerElement.prototype);

Overlay.prototype._onMouseDown = function(evt) {
    if (! this.ui.clickable)
        return false;

    var self = this;

    // some field might be in focus
    document.body.blur();

    // wait till blur takes in account
    requestAnimationFrame(function() {
        // hide overlay
        self.ui.hidden = true;
    }, 0);

    evt.preventDefault();
};


Object.defineProperty(Overlay.prototype, 'center', {
    get: function() {
        return this._element.classList.contains('center');
    },
    set: function(value) {
        if (value) {
            this._element.classList.add('center');
            this.innerElement.style.left = '';
            this.innerElement.style.top = '';
        } else {
            this._element.classList.remove('center');
        }
    }
});


Object.defineProperty(Overlay.prototype, 'transparent', {
    get: function() {
        return this._element.classList.contains('transparent');
    },
    set: function(value) {
        if (value) {
            this._element.classList.add('transparent');
        } else {
            this._element.classList.remove('transparent');
        }
    }
});

Object.defineProperty(Overlay.prototype, 'clickable', {
    get: function() {
        return this.elementOverlay.classList.contains('clickable');
    },
    set: function(value) {
        if (value) {
            this.elementOverlay.classList.add('clickable');
        } else {
            this.elementOverlay.classList.remove('clickable');
        }
    }
});


Object.defineProperty(Overlay.prototype, 'rect', {
    get: function() {
        return this.innerElement.getBoundingClientRect();
    }
});


Overlay.prototype.position = function(x, y) {

    var area = this.elementOverlay.getBoundingClientRect();
    var rect = this.innerElement.getBoundingClientRect();

    x = Math.max(0, Math.min(area.width - rect.width, x));
    y = Math.max(0, Math.min(area.height - rect.height, y));

    this.innerElement.style.left = x + 'px';
    this.innerElement.style.top = y + 'px';
};


window.ui.Overlay = Overlay;


/* ui/panel.js */
"use strict";

function Panel(header) {
    var self = this;

    ui.ContainerElement.call(this);

    this.element = document.createElement('div');
    this._element.classList.add('ui-panel', 'noHeader', 'noAnimation');

    this.headerElement = null;
    this.headerElementTitle = null;

    if (header)
        this.header = header;

    this.on('nodesChanged', this._onNodesChanged);

    // content
    this.innerElement = document.createElement('div');
    this.innerElement.ui = this;
    this.innerElement.classList.add('content');
    this._element.appendChild(this.innerElement);

    this.innerElement.addEventListener('scroll', this._onScroll, false);

    this._resizeEvtMove = function(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        self._resizeMove(evt.clientX, evt.clientY);
    };

    this._resizeEvtEnd = function(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        self._resizeEnd();
    };

    this._resizeEvtTouchMove = function(evt) {
        for(var i = 0; i < evt.changedTouches.length; i++) {
            var touch = evt.changedTouches[i];

            if (touch.identifier !== self._resizeTouchId)
                continue;

            evt.preventDefault();
            evt.stopPropagation();
            self._resizeMove(touch.clientX, touch.clientY);

            return;
        }
    };

    this._resizeEvtTouchEnd = function(evt) {
        for(var i = 0; i < evt.changedTouches.length; i++) {
            var touch = evt.changedTouches[i];

            if (touch.identifier !== self._resizeTouchId)
                continue;

            self._resizeTouchId = null;

            evt.preventDefault();
            evt.stopPropagation();
            self._resizeEnd();

            return;
        }
    };


    // HACK
    // skip 2 frames before enabling transitions
    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
            self.class.remove('noAnimation');
        });
    });

    // on parent change
    this.on('parent', this._onParent);

    this._handleElement = null;
    this._handle = null;
    this._resizeTouchId = null;
    this._resizeData = null;
    this._resizeLimits = {
        min: 0,
        max: Infinity
    };

    this.headerSize = 0;
}
Panel.prototype = Object.create(ui.ContainerElement.prototype);

Panel.prototype._onNodesChanged = function() {
    if (! this.foldable || this.folded || this.horizontal || this.hidden)
        return;

    this.style.height = (Math.max(0, (this.headerSize || 32)) + this.innerElement.clientHeight) + 'px';
};

Panel.prototype._onParent = function() {
    // HACK
    // wait till DOM parses, then reflow
    setTimeout(this._reflow.bind(this));
};

Object.defineProperty(Panel.prototype, 'header', {
    get: function() {
        return (this.headerElement && this.headerElementTitle.textContent) || '';
    },
    set: function(value) {
        if (! this.headerElement && value) {
            this.headerElement = document.createElement('header');
            this.headerElement.classList.add('ui-header');

            this.headerElementTitle = document.createElement('span');
            this.headerElementTitle.classList.add('title');
            this.headerElementTitle.textContent = value;
            this.headerElement.appendChild(this.headerElementTitle);

            var first = this._element.firstChild;
            if (first) {
                this._element.insertBefore(this.headerElement, first);
            } else {
                this._element.appendChild(this.headerElement);
            }

            this.class.remove('noHeader');

            var self = this;

            // folding
            this.headerElement.addEventListener('click', function(evt) {
                if (! self.foldable || (evt.target !== self.headerElement && evt.target !== self.headerElementTitle))
                    return;

                self.folded = ! self.folded;
            }, false);
        } else if (! value && this.headerElement) {
            this.headerElement.parentNode.removeChild(this.headerElement);
            this.headerElement = null;
            this.headerElementTitle = null;
            this.class.add('noHeader');
        } else {
            this.headerElementTitle.textContent = value || '';
            this.class.remove('noHeader');
        }
    }
});


Panel.prototype.headerAppend = function(element) {
    if (! this.headerElement)
        return;

    var html = (element instanceof HTMLElement);
    var node = html ? element : element.element;

    this.headerElement.insertBefore(node, this.headerElementTitle);

    if (! html)
        element.parent = this;
};


Panel.prototype._reflow = function() {
    if (this.hidden)
        return;

    if (this.folded) {
        if (this.horizontal) {
            this.style.height = '';
            this.style.width = (this.headerSize || 32) + 'px';
        } else {
            this.style.height = (this.headerSize || 32) + 'px';
        }
    } else if (this.foldable) {
        if (this.horizontal) {
            this.style.height = '';
            this.style.width = this._innerElement.clientWidth + 'px';
        } else {
            this.style.height = ((this.headerSize || 32) + this._innerElement.clientHeight) + 'px';
        }
    }
};


Panel.prototype._onScroll = function(evt) {
    this.ui.emit('scroll', evt);
};


Object.defineProperty(Panel.prototype, 'foldable', {
    get: function() {
        return this.class.contains('foldable');
    },
    set: function(value) {
        if (value) {
            this.class.add('foldable');

            if(this.class.contains('folded'))
                this.emit('fold');
        } else {
            this.class.remove('foldable');

            if (this.class.contains('folded'))
                this.emit('unfold');
        }

        this._reflow();
    }
});


Object.defineProperty(Panel.prototype, 'folded', {
    get: function() {
        return this.class.contains('foldable') && this.class.contains('folded');
    },
    set: function(value) {
        if (this.hidden)
            return;

        if (this.class.contains('folded') === !! value)
            return;

        if (this.headerElement && this.headerSize === 0)
            this.headerSize = this.headerElement.clientHeight;

        if (value) {
            this.class.add('folded');

            if (this.class.contains('foldable'))
                this.emit('fold');
        } else {
            this.class.remove('folded');

            if (this.class.contains('foldable'))
                this.emit('unfold');
        }

        this._reflow();
    }
});


Object.defineProperty(Panel.prototype, 'horizontal', {
    get: function() {
        return this.class.contains('horizontal');
    },
    set: function(value) {
        if (value) {
            this.class.add('horizontal');
        } else {
            this.class.remove('horizontal');
        }
        this._reflow();
    }
});


Object.defineProperty(Panel.prototype, 'resizable', {
    get: function() {
        return this._handle;
    },
    set: function(value) {
        if (this._handle === value)
            return;

        var oldHandle = this._handle;
        this._handle = value;

        if (this._handle) {
            if (! this._handleElement) {
                this._handleElement = document.createElement('div');
                this._handleElement.ui = this;
                this._handleElement.classList.add('handle');
                this._handleElement.addEventListener('mousedown', this._resizeStart, false);
                this._handleElement.addEventListener('touchstart', this._resizeStart, false);
            }

            if (this._handleElement.parentNode)
                this._element.removeChild(this._handleElement);
            // TODO
            // append in right place
            this._element.appendChild(this._handleElement);
            this.class.add('resizable', 'resizable-' + this._handle);
        } else {
            this._element.removeChild(this._handleElement);
            this.class.remove('resizable', 'resizable-' + oldHandle);
        }

        this._reflow();
    }
});


Object.defineProperty(Panel.prototype, 'resizeMin', {
    get: function() {
        return this._resizeLimits.min;
    },
    set: function(value) {
        this._resizeLimits.min = Math.max(0, Math.min(this._resizeLimits.max, value));
    }
});


Object.defineProperty(Panel.prototype, 'resizeMax', {
    get: function() {
        return this._resizeLimits.max;
    },
    set: function(value) {
        this._resizeLimits.max = Math.max(this._resizeLimits.min, value);
    }
});


Panel.prototype._resizeStart = function(evt) {
    if (! this.ui._handle)
        return;

    if (evt.changedTouches) {
        for(var i = 0; i < evt.changedTouches.length; i++) {
            var touch = evt.changedTouches[i];
            if (touch.target !== this)
                continue;

            this.ui._resizeTouchId = touch.identifier;
        }
    }

    this.ui.class.add('noAnimation', 'resizing');
    this.ui._resizeData = null;

    window.addEventListener('mousemove', this.ui._resizeEvtMove, false);
    window.addEventListener('mouseup', this.ui._resizeEvtEnd, false);

    window.addEventListener('touchmove', this.ui._resizeEvtTouchMove, false);
    window.addEventListener('touchend', this.ui._resizeEvtTouchEnd, false);

    evt.preventDefault();
    evt.stopPropagation();
};


Panel.prototype._resizeMove = function(x, y) {
    if (! this._resizeData) {
        this._resizeData = {
            x: x,
            y: y,
            width: this._innerElement.clientWidth,
            height: this._innerElement.clientHeight
        };
    } else {
        if (this._handle === 'left' || this._handle === 'right') {
            // horizontal
            var offsetX = this._resizeData.x - x;

            if (this._handle === 'right')
                offsetX = -offsetX;

            var width = Math.max(this._resizeLimits.min, Math.min(this._resizeLimits.max, (this._resizeData.width + offsetX)));

            this.style.width = (width + 4) + 'px';
            this._innerElement.style.width = (width + 4) + 'px';
        } else {
            // vertical
            var offsetY = this._resizeData.y - y;

            if (this._handle === 'bottom')
                offsetY = -offsetY;

            var height = Math.max(this._resizeLimits.min, Math.min(this._resizeLimits.max, (this._resizeData.height + offsetY)));

            this.style.height = (height + (this.headerSize === -1 ? 0 : this.headerSize || 32)) + 'px';
            this._innerElement.style.height = height + 'px';
        }
    }

    this.emit('resize');
};

Panel.prototype._resizeEnd = function(evt) {
    window.removeEventListener('mousemove', this._resizeEvtMove, false);
    window.removeEventListener('mouseup', this._resizeEvtEnd, false);

    window.removeEventListener('touchmove', this._resizeEvtTouchMove, false);
    window.removeEventListener('touchend', this._resizeEvtTouchEnd, false);

    this.class.remove('noAnimation', 'resizing');
    this._resizeData = null;
};


window.ui.Panel = Panel;


/* ui/select-field.js */
"use strict";

function SelectField(args) {
    var self = this;
    ui.Element.call(this);
    args = args || { };

    this.options = args.options || { };
    this.optionsKeys = [ ];
    if (this.options instanceof Array) {
        var options = { };
        for(var i = 0; i < this.options.length; i++) {
            this.optionsKeys.push(this.options[i].v);
            options[this.options[i].v] = this.options[i].t;
        }
        this.options = options;
    } else {
        this.optionsKeys = Object.keys(this.options);
    }

    this.element = document.createElement('div');
    this._element.tabIndex = 0;
    this._element.classList.add('ui-select-field', 'noSelect');

    this.elementValue = document.createElement('div');
    this.elementValue.ui = this;
    this.elementValue.classList.add('value');
    this._element.appendChild(this.elementValue);

    this._oldValue = null;
    this._value = null;
    this._type = args.type || 'string';

    this._optionClassNamePrefix = args.optionClassNamePrefix || null;

    this.timerClickAway = null;
    this.evtTouchId = null;
    this.evtTouchSecond = false;
    this.evtMouseDist = [ 0, 0 ];
    this.evtMouseUp = function(evt) {
        evt.preventDefault();
        evt.stopPropagation();

        self._onHoldSelect(evt.target, evt.pageX, evt.pageY);
    };

    this.evtTouchEnd = function(evt) {
        for(var i = 0; i < evt.changedTouches.length; i++) {
            var touch = evt.changedTouches[i];
            if (touch.identifier !== self.evtTouchId)
                continue;

            self.evtTouchId = null;

            evt.preventDefault();
            evt.stopPropagation();

            var target = document.elementFromPoint(touch.pageX, touch.pageY);

            self._onHoldSelect(target, touch.pageX, touch.pageY);
        }

        if (self.evtTouchSecond) {
            evt.preventDefault();
            evt.stopPropagation();
            self.close();
        } else if (self._element.classList.contains('active')) {
            self.evtTouchSecond = true;
        }
    };

    this.elementValue.addEventListener('mousedown', this._onMouseDown, false);
    this.elementValue.addEventListener('touchstart', this._onTouchStart, false);

    this.elementOptions = document.createElement('ul');
    this._element.appendChild(this.elementOptions);

    this.optionElements = { };

    if (args.default !== undefined && this.options[args.default] !== undefined) {
        this._value = this.valueToType(args.default);
        this._oldValue = this._value;
    }

    this.on('link', this._onLink);
    this._updateOptions();

    this.on('change', this._onChange);

    // arrows - change
    this._element.addEventListener('keydown', this._onKeyDown, false);

    if (args.placeholder)
        this.placeholder = args.placeholder;
}
SelectField.prototype = Object.create(ui.Element.prototype);


SelectField.prototype._onHoldSelect = function(target, x, y) {
    if (target && target.uiElement && target.uiElement === this && target.classList.contains('selected'))
        return;

    if ((Math.abs(x - this.evtMouseDist[0]) + Math.abs(y - this.evtMouseDist[1])) < 8)
        return;

    if (target && target.uiElement && target.uiElement === this)
        this._onOptionSelect.call(target);

    this.close();
};

SelectField.prototype._onMouseDown = function(evt) {
    if (this.ui.disabled && ! this.ui.disabledClick)
        return;

    if (this.ui.element.classList.contains('active')) {
        this.ui.close();
    } else {
        evt.preventDefault();
        evt.stopPropagation();
        this.ui.evtMouseDist[0] = evt.pageX;
        this.ui.evtMouseDist[1] = evt.pageY;
        this.ui.element.focus();
        this.ui.open();
        window.addEventListener('mouseup', this.ui.evtMouseUp);
    }
};

SelectField.prototype._onTouchStart = function(evt) {
    if (this.ui.disabled && ! this.ui.disabledClick)
        return;

    if (this.ui.element.classList.contains('active')) {
        this.ui.close();
    } else {
        evt.preventDefault();
        evt.stopPropagation();

        var touch;

        for(var i = 0; i < evt.changedTouches.length; i++) {
            if (evt.changedTouches[i].target !== this)
                continue;

            touch = evt.changedTouches[i];

            break;
        }

        if (! touch) return;

        this.ui.evtTouchId = touch.identifier;
        this.ui.evtMouseDist[0] = touch.pageX;
        this.ui.evtMouseDist[1] = touch.pageY;
        this.ui.element.focus();
        this.ui.open();
        window.addEventListener('touchend', this.ui.evtTouchEnd);
    }
};

SelectField.prototype._onLink = function(path) {
    if (this._link.schema && this._link.schema.has(path)) {
        var field = this._link.schema.get(path);
        var options = field.options || { };
        this._updateOptions(options);
    }
};

SelectField.prototype._onChange = function() {
    if (! this.renderChanges)
        return;

    this.flash();
};

SelectField.prototype._onKeyDown = function(evt) {
    if (evt.keyCode === 27) {
        this.ui.close();
        this.blur();
        return;
    }

    if ((this.ui.disabled && ! this.ui.disabledClick) || [ 38, 40 ].indexOf(evt.keyCode) === -1)
        return;

    evt.stopPropagation();
    evt.preventDefault();

    var keys = Object.keys(this.ui.options);
    var ind = keys.indexOf(this.ui.value !== undefined ? this.ui.value.toString() : null);

    var y = evt.keyCode === 38 ? -1 : 1;

    // already first item
    if (y === -1 && ind <= 0)
        return;

    // already last item
    if (y === 1 && ind === (keys.length - 1))
        return

    // set new item
    this.ui.value = keys[ind + y];
};

SelectField.prototype.valueToType = function(value) {
    switch(this._type) {
        case 'boolean':
            return !! value;
            break;
        case 'number':
            return parseInt(value, 10);
            break;
        case 'string':
            return '' + value;
            break;
    }
};


SelectField.prototype.open = function() {
    if ((this.disabled && ! this.disabledClick) || this._element.classList.contains('active'))
        return;

    this._element.classList.add('active');

    var rect = this._element.getBoundingClientRect();

    // left
    var left = Math.round(rect.left) + ((Math.round(rect.width) - this._element.clientWidth) / 2);

    // top
    var top = rect.top;
    if (this.optionElements[this._value]) {
        top -= this.optionElements[this._value].offsetTop;
        top += (Math.round(rect.height) - this.optionElements[this._value].clientHeight) / 2;
    }

    // limit to bottom / top of screen
    if (top + this.elementOptions.clientHeight > window.innerHeight) {
        top = window.innerHeight - this.elementOptions.clientHeight + 1;
    } else if (top < 0) {
        top = 0;
    }

    // top
    this.elementOptions.style.top = Math.max(0, top) + 'px';
    // left
    this.elementOptions.style.left = left + 'px';
    // right
    this.elementOptions.style.width = Math.round(this._element.clientWidth) + 'px';
    // bottom
    if (top <= 0 && this.elementOptions.offsetHeight >= window.innerHeight) {
        this.elementOptions.style.bottom = '0';
        this.elementOptions.style.height = 'auto';

        // scroll to item
        if (this.optionElements[this._value]) {
            var off = this.optionElements[this._value].offsetTop - rect.top;
            this.elementOptions.scrollTop = off;
        }
    } else {
        this.elementOptions.style.bottom = '';
        this.elementOptions.style.height = '';
    }

    var self = this;
    this.timerClickAway = setTimeout(function() {
        var looseActive = function() {
            self.element.classList.remove('active');
            self.element.blur();
            window.removeEventListener('click', looseActive);
        };

        window.addEventListener('click', looseActive);
    }, 300);

    this.emit('open');
};


SelectField.prototype.close = function() {
    if ((this.disabled && ! this.disabledClick) || ! this._element.classList.contains('active'))
        return;

    window.removeEventListener('mouseup', this.evtMouseUp);
    window.removeEventListener('touchend', this.evtTouchEnd);

    if (this.timerClickAway) {
        clearTimeout(this.timerClickAway);
        this.timerClickAway = null;
    }

    this._element.classList.remove('active');

    this.elementOptions.style.top = '';
    this.elementOptions.style.right = '';
    this.elementOptions.style.bottom = '';
    this.elementOptions.style.left = '';
    this.elementOptions.style.width = '';
    this.elementOptions.style.height = '';

    this.emit('close');

    this.evtTouchSecond = false;
};


SelectField.prototype.toggle = function() {
    if (this._element.classList.contains('active')) {
        this.close();
    } else {
        this.open();
    }
};


SelectField.prototype._updateOptions = function(options) {
    if (options !== undefined) {
        if (options instanceof Array) {
            this.options = { };
            this.optionsKeys = [ ];
            for(var i = 0; i < options.length; i++) {
                this.optionsKeys.push(options[i].v);
                this.options[options[i].v] = options[i].t;
            }
        } else {
            this.options = options;
            this.optionsKeys = Object.keys(options);
        }
    }

    this.optionElements = { };
    this.elementOptions.innerHTML = '';

    for(var i = 0; i < this.optionsKeys.length; i++) {
        if (! this.options.hasOwnProperty(this.optionsKeys[i]))
            continue;

        var element = document.createElement('li');
        element.textContent = this.options[this.optionsKeys[i]];
        element.uiElement = this;
        element.uiValue = this.optionsKeys[i];
        element.addEventListener('touchstart', this._onOptionSelect);
        element.addEventListener('mouseover', this._onOptionHover);
        element.addEventListener('mouseout', this._onOptionOut);

        if (this._optionClassNamePrefix) {
            element.classList.add(this._optionClassNamePrefix + '-' + element.textContent.toLowerCase());
        }

        this.elementOptions.appendChild(element);
        this.optionElements[this.optionsKeys[i]] = element;
    }
};

SelectField.prototype._onOptionSelect = function() {
    this.uiElement.value = this.uiValue;
};

SelectField.prototype._onOptionHover = function() {
    this.classList.add('hover');
};

SelectField.prototype._onOptionOut = function() {
    this.classList.remove('hover');
};

SelectField.prototype._onLinkChange = function(value) {
    if (this.optionElements[value] === undefined)
        return;

    if (this.optionElements[this._oldValue]) {
        this.optionElements[this._oldValue].classList.remove('selected');
    }

    this._value = this.valueToType(value);
    this.elementValue.textContent = this.options[value];
    this.optionElements[value].classList.add('selected');
    this.emit('change', value);
};


Object.defineProperty(SelectField.prototype, 'value', {
    get: function() {
        if (this._link) {
            return this._link.get(this.path);
        } else {
            return this._value;
        }
    },
    set: function(raw) {
        var value = this.valueToType(raw);

        if (this._link) {
            this._oldValue = this._value;
            this.emit('change:before', value);
            this._link.set(this.path, value);
        } else {
            if ((value === null || value === undefined || raw === '') && this.optionElements[''])
                value = '';

            if (this._oldValue === value) return;
            if (value !== null && this.options[value] === undefined) return;

            // deselect old one
            if (this.optionElements[this._oldValue])
                this.optionElements[this._oldValue].classList.remove('selected');

            this._value = value;
            if (value !== '')
                this._value = this.valueToType(this._value);

            this.emit('change:before', this._value);
            this._oldValue = this._value;
            if (this.options[this._value]) {
                this.elementValue.textContent = this.options[this._value];
                this.optionElements[this._value].classList.add('selected');
            } else {
                this.elementValue.textContent = '';
            }
            this.emit('change', this._value);
        }
    }
});

Object.defineProperty(SelectField.prototype, 'placeholder', {
    get: function() {
        return this.elementValue.getAttribute('placeholder');
    },
    set: function(value) {
        if (! value) {
            this.elementValue.removeAttribute('placeholder');
        } else {
            this.elementValue.setAttribute('placeholder', value);
        }
    }
});


window.ui.SelectField = SelectField;


/* ui/text-field.js */
"use strict";

function TextField(args) {
    ui.Element.call(this);
    args = args || { };

    this.element = document.createElement('div');
    this._element.classList.add('ui-text-field');

    this.elementInput = document.createElement('input');
    this.elementInput.ui = this;
    this.elementInput.classList.add('field');
    this.elementInput.type = 'text';
    this.elementInput.tabIndex = 0;
    this.elementInput.addEventListener('focus', this._onInputFocus, false);
    this.elementInput.addEventListener('blur', this._onInputBlur, false);
    this._element.appendChild(this.elementInput);

    if (args.default !== undefined)
        this.value = args.default;

    this.elementInput.addEventListener('change', this._onChange, false);
    this.elementInput.addEventListener('keydown', this._onKeyDown, false);
    this.elementInput.addEventListener('contextmenu', this._onFullSelect, false);
    this.evtKeyChange = false;
    this.ignoreChange = false;

    this.blurOnEnter = true;
    this.refocusable = true;

    this.on('disable', this._onDisable);
    this.on('enable', this._onEnable);
    this.on('change', this._onChangeField);

    if (args.placeholder)
        this.placeholder = args.placeholder;
}
TextField.prototype = Object.create(ui.Element.prototype);


TextField.prototype._onLinkChange = function(value) {
    this.elementInput.value = value;
    this.emit('change', value);
};


TextField.prototype._onChange = function() {
    if (this.ui.ignoreChange) return;

    this.ui.value = this.ui.value || '';

    if (! this.ui._link)
        this.ui.emit('change', this.ui.value);
};


TextField.prototype._onKeyDown = function(evt) {
    if (evt.keyCode === 27) {
        this.blur();
    } else if (this.ui.blurOnEnter && evt.keyCode === 13) {
        var focused = false;

        var parent = this.ui.parent;
        while(parent) {
            if (parent.focus) {
                parent.focus();
                focused = true;
                break;
            }

            parent = parent.parent;
        }

        if (! focused)
            this.blur();
    }
};


TextField.prototype._onFullSelect = function() {
    this.select();
};


TextField.prototype.focus = function(select) {
    this.elementInput.focus();
    if (select) this.elementInput.select();
};


TextField.prototype._onInputFocus = function() {
    this.ui.class.add('focus');
    this.ui.emit('input:focus');
};


TextField.prototype._onInputBlur = function() {
    this.ui.class.remove('focus');
    this.ui.emit('input:blur');
};

TextField.prototype._onDisable = function() {
    this.elementInput.readOnly = true;
};

TextField.prototype._onEnable = function() {
    this.elementInput.readOnly = false;
};

TextField.prototype._onChangeField = function() {
    if (! this.renderChanges)
        return;

    this.flash();
};


Object.defineProperty(TextField.prototype, 'value', {
    get: function() {
        if (this._link) {
            return this._link.get(this.path);
        } else {
            return this.elementInput.value;
        }
    },
    set: function(value) {
        if (this._link) {
            if (! this._link.set(this.path, value)) {
                this.elementInput.value = this._link.get(this.path);
            }
        } else {
            if (this.elementInput.value === value)
                return;

            this.elementInput.value = value || '';
            this.emit('change', value);
        }
    }
});


Object.defineProperty(TextField.prototype, 'placeholder', {
    get: function() {
        return this._element.getAttribute('placeholder');
    },
    set: function(value) {
        if (! value) {
            this._element.removeAttribute('placeholder');
        } else {
            this._element.setAttribute('placeholder', value);
        }
    }
});


Object.defineProperty(TextField.prototype, 'proxy', {
    get: function() {
        return this._element.getAttribute('proxy');
    },
    set: function(value) {
        if (! value) {
            this._element.removeAttribute('proxy');
        } else {
            this._element.setAttribute('proxy', value);
        }
    }
});


Object.defineProperty(TextField.prototype, 'keyChange', {
    get: function() {
        return !! this.evtKeyChange;
    },
    set: function(value) {
        if (!! this.evtKeyChange === !! value)
            return;

        if (value) {
            this.elementInput.addEventListener('keyup', this._onChange, false);
        } else {
            this.elementInput.removeEventListener('keyup', this._onChange);
        }
    }
});


window.ui.TextField = TextField;


/* ui/textarea-field.js */
"use strict";

function TextAreaField(args) {
    ui.Element.call(this);
    args = args || { };

    this.element = document.createElement('div');
    this._element.classList.add('ui-textarea-field');

    this.elementInput = document.createElement('textarea');
    this.elementInput.ui = this;
    this.elementInput.classList.add('field');
    this.elementInput.tabIndex = 0;
    this.elementInput.addEventListener('focus', this._onInputFocus, false);
    this.elementInput.addEventListener('blur', this._onInputBlur, false);
    this._element.appendChild(this.elementInput);

    if (args.default !== undefined)
        this.value = args.default;

    this.elementInput.addEventListener('change', this._onChange, false);
    this.elementInput.addEventListener('keydown', this._onKeyDown, false);
    this.elementInput.addEventListener('contextmenu', this._onFullSelect, false);
    this.evtKeyChange = false;
    this.ignoreChange = false;

    this.blurOnEnter = args.blurOnEnter !== undefined ? args.blurOnEnter : true;
    this.refocusable = true;

    this.on('disable', this._onDisable);
    this.on('enable', this._onEnable);
    this.on('change', this._onChangeField);

    if (args.placeholder)
        this.placeholder = args.placeholder;
}
TextAreaField.prototype = Object.create(ui.Element.prototype);


TextAreaField.prototype._onLinkChange = function(value) {
    this.elementInput.value = value;
    this.emit('change', value);
};


TextAreaField.prototype._onChange = function() {
    if (this.ui.ignoreChange) return;

    this.ui.value = this.ui.value || '';

    if (! this.ui._link)
        this.ui.emit('change', this.ui.value);
};


TextAreaField.prototype._onKeyDown = function(evt) {
    if (evt.keyCode === 27) {
        this.blur();
    } else if (this.ui.blurOnEnter && evt.keyCode === 13 && ! evt.shiftKey) {
        var focused = false;

        var parent = this.ui.parent;
        while(parent) {
            if (parent.focus) {
                parent.focus();
                focused = true;
                break;
            }

            parent = parent.parent;
        }

        if (! focused)
            this.blur();
    }
};


TextAreaField.prototype._onFullSelect = function() {
    this.select();
};


TextAreaField.prototype.focus = function(select) {
    this.elementInput.focus();
    if (select) this.elementInput.select();
};


TextAreaField.prototype._onInputFocus = function() {
    this.ui.class.add('focus');
    this.ui.emit('input:focus');
};


TextAreaField.prototype._onInputBlur = function() {
    this.ui.class.remove('focus');
    this.ui.emit('input:blur');
};

TextAreaField.prototype._onDisable = function() {
    this.elementInput.readOnly = true;
};

TextAreaField.prototype._onEnable = function() {
    this.elementInput.readOnly = false;
};

TextAreaField.prototype._onChangeField = function() {
    if (! this.renderChanges)
        return;

    this.flash();
};


Object.defineProperty(TextAreaField.prototype, 'value', {
    get: function() {
        if (this._link) {
            return this._link.get(this.path);
        } else {
            return this.elementInput.value;
        }
    },
    set: function(value) {
        if (this._link) {
            if (! this._link.set(this.path, value)) {
                this.elementInput.value = this._link.get(this.path);
            }
        } else {
            if (this.elementInput.value === value)
                return;

            this.elementInput.value = value || '';
            this.emit('change', value);
        }
    }
});


Object.defineProperty(TextAreaField.prototype, 'placeholder', {
    get: function() {
        return this._element.getAttribute('placeholder');
    },
    set: function(value) {
        if (! value) {
            this._element.removeAttribute('placeholder');
        } else {
            this._element.setAttribute('placeholder', value);
        }
    }
});


Object.defineProperty(TextAreaField.prototype, 'keyChange', {
    get: function() {
        return !! this.evtKeyChange;
    },
    set: function(value) {
        if (!! this.evtKeyChange === !! value)
            return;

        if (value) {
            this.elementInput.addEventListener('keyup', this._onChange, false);
        } else {
            this.elementInput.removeEventListener('keyup', this._onChange);
        }
    }
});

Object.defineProperty(TextAreaField.prototype, 'proxy', {
    get: function() {
        return this._element.getAttribute('proxy');
    },
    set: function(value) {
        if (! value) {
            this._element.removeAttribute('proxy');
        } else {
            this._element.setAttribute('proxy', value);
        }
    }
});

window.ui.TextAreaField = TextAreaField;


/* ui/color-field.js */
"use strict"

function ColorField(args) {
    var self = this;
    ui.Element.call(this);
    args = args || { };

    this.element = document.createElement('div');
    this._element.tabIndex = 0;
    this._element.classList.add('ui-color-field', 'rgb');

    this.elementColor = document.createElement('span');
    this.elementColor.classList.add('color');
    this._element.appendChild(this.elementColor);

    this._channels = args.channels || 3;
    this._values = [ 0, 0, 0, 0 ];

    // space > click
    this._element.addEventListener('keydown', this._onKeyDown, false);

    // render color back
    this.on('change', this._onChange);

    // link to channels
    this.evtLinkChannels = [ ];
    this.on('link', this._onLink);
    this.on('unlink', this._onUnlink);
}
ColorField.prototype = Object.create(ui.Element.prototype);

ColorField.prototype._onKeyDown = function(evt) {
    if (evt.keyCode === 27)
        return this.blur();

    if (evt.keyCode !== 13 || this.ui.disabled)
        return;

    evt.stopPropagation();
    evt.preventDefault();
    this.ui.emit('click');
};

ColorField.prototype._onChange = function(color) {
    if (this._channels === 1) {
        this.elementColor.style.backgroundColor = 'rgb(' + [ this.r, this.r, this.r ].join(',') + ')';
    } else if (this._channels === 3) {
        this.elementColor.style.backgroundColor = 'rgb(' + this._values.slice(0, 3).join(',') + ')';
    } else if (this._channels === 4) {
        var rgba = this._values.slice(0, 4);
        rgba[3] /= 255;
        this.elementColor.style.backgroundColor = 'rgba(' + rgba.join(',') + ')';
    } else {
        console.log('unknown channels', color);
    }
};

ColorField.prototype._onLink = function() {
    for(var i = 0; i < 4; i++) {
        this.evtLinkChannels[i] = this._link.on(this.path + '.' + i + ':set', function(value) {
            this._setValue(this._link.get(this.path));
        }.bind(this));
    }
};

ColorField.prototype._onUnlink = function() {
    for(var i = 0; i < this.evtLinkChannels.length; i++)
        this.evtLinkChannels[i].unbind();

    this.evtLinkChannels = [ ];
};

ColorField.prototype._onLinkChange = function(value) {
    if (! value)
        return;

    this._setValue(value);
};

Object.defineProperty(ColorField.prototype, 'value', {
    get: function() {
        if (this._link) {
            return this._link.get(this.path).map(function(channel) {
                return Math.floor(channel * 255);
            });
        } else {
            return this._values.slice(0, this._channels);
        }
    },
    set: function(value) {
        if (! value) {
            this.class.add('null');
            return;
        } else {
            this.class.remove('null');
        }

        if (this._link) {
            this._link.set(this.path, value.map(function(channel) {
                return channel / 255;
            }));
        } else {
            this._setValue(value);
        }
    }
});

ColorField.prototype._setValue = function(value) {
    var changed = false;

    if (! value)
        return;

    if (value.length !== this._channels) {
        changed = true;
        this.channels = value.length;
    }

    for(var i = 0; i < this._channels; i++) {
        if (this._values[i] === Math.floor(value[i]))
            continue;

        changed = true;
        this._values[i] = Math.floor(value[i]);
    }

    if (changed)
        this.emit('change', this._values.slice(0, this._channels));
};


Object.defineProperty(ColorField.prototype, 'channels', {
    get: function() {
        return this._channels;
    },
    set: function(value) {
        if (this._channels === value)
            return;

        this._channels = value;
        this.emit('channels', this._channels);
    }
});


Object.defineProperty(ColorField.prototype, 'r', {
    get: function() {
        if (this._link) {
            return Math.floor(this._link.get(this.path + '.0') * 255);
        } else {
            return this._values[0];
        }
    },
    set: function(value) {
        value = Math.min(0, Math.max(255, value));

        if (this._values[0] === value)
            return;

        this._values[0] = value;
        this.emit('r', this._values[0]);
        this.emit('change', this._values.slice(0, this._channels));
    }
});


Object.defineProperty(ColorField.prototype, 'g', {
    get: function() {
        if (this._link) {
            return Math.floor(this._link.get(this.path + '.1') * 255);
        } else {
            return this._values[1];
        }
    },
    set: function(value) {
        value = Math.min(0, Math.max(255, value));

        if (this._values[1] === value)
            return;

        this._values[1] = value;

        if (this._channels >= 2) {
            this.emit('g', this._values[1]);
            this.emit('change', this._values.slice(0, this._channels));
        }
    }
});


Object.defineProperty(ColorField.prototype, 'b', {
    get: function() {
        if (this._link) {
            return Math.floor(this._link.get(this.path + '.2') * 255);
        } else {
            return this._values[2];
        }
    },
    set: function(value) {
        value = Math.min(0, Math.max(255, value));

        if (this._values[2] === value)
            return;

        this._values[2] = value;

        if (this._channels >= 3) {
            this.emit('b', this._values[2]);
            this.emit('change', this._values.slice(0, this._channels));
        }
    }
});


Object.defineProperty(ColorField.prototype, 'a', {
    get: function() {
        if (this._link) {
            return Math.floor(this._link.get(this.path + '.3') * 255);
        } else {
            return this._values[3];
        }
    },
    set: function(value) {
        value = Math.min(0, Math.max(255, value));

        if (this._values[3] === value)
            return;

        this._values[3] = value;

        if (this._channels >= 4) {
            this.emit('a', this._values[3]);
            this.emit('change', this._values.slice(0, this._channels));
        }
    }
});


Object.defineProperty(ColorField.prototype, 'hex', {
    get: function() {
        var values = this._values;

        if (this._link) {
            values = this._link.get(this.path).map(function(channel) {
                return Math.floor(channel * 255);
            });
        }

        var hex = '';
        for(var i = 0; i < this._channels; i++) {
            hex += ('00' + values[i].toString(16)).slice(-2);
        }
        return hex;
    },
    set: function(value) {
        console.log('todo');
    }
});


window.ui.ColorField = ColorField;


/* ui/image-field.js */
"use strict";

function ImageField(args) {
    var self = this;
    ui.Element.call(this);
    args = args || { };

    this.element = document.createElement('div');
    this._element.classList.add('ui-image-field', 'empty');

    if (args.canvas) {
        this.elementImage = document.createElement('canvas');
        this.elementImage.width = 64;
        this.elementImage.height = 64;
    } else {
        this.elementImage = new Image();
    }

    this.elementImage.classList.add('preview');
    this._element.appendChild(this.elementImage);

    this._value = null;

    this._element.removeEventListener('click', this._evtClick);
    this._element.addEventListener('click', this._onClick, false);
    this.on('change', this._onChange);

    // space > click
    this._element.addEventListener('keydown', this._onKeyDown, false);
}
ImageField.prototype = Object.create(ui.Element.prototype);


ImageField.prototype._onClick = function(evt) {
    this.ui.emit('click', evt);
};

ImageField.prototype._onChange = function() {
    if (! this.renderChanges)
        return;

    this.flash();
};

ImageField.prototype._onKeyDown = function(evt) {
    if (evt.keyCode === 27)
        return this.blur();

    if (evt.keyCode !== 32 || this.ui.disabled)
        return;

    evt.stopPropagation();
    evt.preventDefault();
    this.ui.emit('pick');
};

ImageField.prototype._onLinkChange = function(value) {
    this._value = value;
    this.emit('change', value);
};


Object.defineProperty(ImageField.prototype, 'image', {
    get: function() {
        return this.elementImage.src;
    },
    set: function(value) {
        if (this.elementImage.src === value)
            return;

        this.elementImage.src = value;
    }
});


Object.defineProperty(ImageField.prototype, 'empty', {
    get: function() {
        return this.class.contains('empty');
    },
    set: function(value) {
        if (this.class.contains('empty') === !! value)
            return;

        if (value) {
            this.class.add('empty');
            this.image = '';
        } else {
            this.class.remove('empty');
        }
    }
});


Object.defineProperty(ImageField.prototype, 'value', {
    get: function() {
        if (this._link) {
            return this._link.get(this.path);
        } else {
            return this._value;
        }
    },
    set: function(value) {
        value = value && parseInt(value, 10) || null;

        if (this._link) {
            if (! this._link.set(this.path, value))
                this._value = this._link.get(this.path);
        } else {
            if (this._value === value && ! this.class.contains('null'))
                return;

            this._value = value;
            this.emit('change', value);
        }
    }
});


window.ui.ImageField = ImageField;


/* ui/slider.js */
"use strict";

function Slider(args) {
    var self = this;
    ui.Element.call(this);
    args = args || { };

    this._value = 0;
    this._lastValue = 0;

    this.precision = isNaN(args.precision) ? 2 : args.precision;
    this._min = isNaN(args.min) ? 0 : args.min;
    this._max = isNaN(args.max) ? 1 : args.max;

    this.element = document.createElement('div');
    this.element.classList.add('ui-slider');

    this.elementBar = document.createElement('div');
    this.elementBar.ui = this;
    this.elementBar.classList.add('bar');
    this.element.appendChild(this.elementBar);

    this.elementHandle = document.createElement('div');
    this.elementHandle.ui = this;
    this.elementHandle.tabIndex = 0;
    this.elementHandle.classList.add('handle');
    this.elementBar.appendChild(this.elementHandle);

    this.element.addEventListener('mousedown', this._onMouseDown, false);
    this.element.addEventListener('touchstart', this._onTouchStart, false);

    this.evtMouseMove = function(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        self._onSlideMove(evt.pageX);
    };
    this.evtMouseUp = function(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        self._onSlideEnd(evt.pageX);
    };

    this.evtTouchId = null;

    this.evtTouchMove = function(evt) {
        for(var i = 0; i < evt.changedTouches.length; i++) {
            var touch = evt.changedTouches[i];

            if (touch.identifier !== self.evtTouchId)
                continue;

            evt.stopPropagation();
            evt.preventDefault();

            self._onSlideMove(touch.pageX);
            break;
        }
    };
    this.evtTouchEnd = function(evt) {
        for(var i = 0; i < evt.changedTouches.length; i++) {
            var touch = evt.changedTouches[i];

            if (touch.identifier !== self.evtTouchId)
                continue;

            evt.stopPropagation();
            evt.preventDefault();

            self._onSlideEnd(touch.pageX);
            self.evtTouchId = null;
            break;
        }
    };

    this.on('change', this.__onChange);

    // arrows - change
    this.element.addEventListener('keydown', this._onKeyDown, false);
}
Slider.prototype = Object.create(ui.Element.prototype);


Slider.prototype._onChange = function() {
    if (! this.renderChanges)
        return;

    this.flash();
};


Slider.prototype._onKeyDown = function(evt) {
    if (evt.keyCode === 27)
        return this.ui.elementHandle.blur();

    if (this.ui.disabled || [ 37, 39 ].indexOf(evt.keyCode) === -1)
        return;

    evt.stopPropagation();
    evt.preventDefault();

    var x = evt.keyCode === 37 ? -1 : 1;

    if (evt.shiftKey)
        x *= 10;

    var rect = this.getBoundingClientRect();
    var step = (this.ui._max - this.ui._min) / rect.width;
    var value = Math.max(this.ui._min, Math.min(this.ui._max, this.ui.value + x * step));
    value = parseFloat(value.toFixed(this.ui.precision), 10);

    this.ui.renderChanges = false;
    this.ui._updateHandle(value);
    this.ui.value = value;
    this.ui.renderChanges = true;
};


Slider.prototype._onLinkChange = function(value) {
    this._updateHandle(value);
    this._value = value;
    this.emit('change', value || 0);
};


Slider.prototype._updateHandle = function(value) {
    this.elementHandle.style.left = (Math.max(0, Math.min(1, ((value || 0) - this._min) / (this._max - this._min))) * 100) + '%';
};


Slider.prototype._onMouseDown = function(evt) {
    if (evt.button !== 0 || this.ui.disabled)
        return;

    this.ui._onSlideStart(evt.pageX);
};


Slider.prototype._onTouchStart = function(evt) {
    if (this.ui.disabled)
        return;

    for(var i = 0; i < evt.changedTouches.length; i++) {
        var touch = evt.changedTouches[i];
        if (! touch.target.ui || touch.target.ui !== this.ui)
            continue;

        this.ui.evtTouchId = touch.identifier;
        this.ui._onSlideStart(touch.pageX);
        break;
    }
};


Slider.prototype._onSlideStart = function(pageX) {
    this.elementHandle.focus();

    this.renderChanges = false;

    if (this.evtTouchId === null) {
        window.addEventListener('mousemove', this.evtMouseMove, false);
        window.addEventListener('mouseup', this.evtMouseUp, false);
    } else {
        window.addEventListener('touchmove', this.evtTouchMove, false);
        window.addEventListener('touchend', this.evtTouchEnd, false);
    }

    this.class.add('active');

    this.emit('start', this.value);

    this._onSlideMove(pageX);

    if (this._link && this._link.history)
        this._link.history.combine = true;
};


Slider.prototype._onSlideMove = function(pageX) {
    var rect = this.element.getBoundingClientRect();
    var x = Math.max(0, Math.min(1, (pageX - rect.left) / rect.width));

    var range = this._max - this._min;
    var value = (x * range) + this._min;
    value = parseFloat(value.toFixed(this.precision), 10);

    this._updateHandle(value);
    this.value = value;
};


Slider.prototype._onSlideEnd = function(pageX) {
    this._onSlideMove(pageX);

    this.renderChanges = true;

    this.class.remove('active');

    if (this.evtTouchId === null) {
        window.removeEventListener('mousemove', this.evtMouseMove);
        window.removeEventListener('mouseup', this.evtMouseUp);
    } else {
        window.removeEventListener('touchmove', this.evtTouchMove);
        window.removeEventListener('touchend', this.evtTouchEnd);
    }

    if (this._link && this._link.history)
        this._link.history.combine = false;

    this.emit('end', this.value);
};


Object.defineProperty(Slider.prototype, 'min', {
    get: function() {
        return this._min;
    },
    set: function(value) {
        if (this._min === value)
            return;

        this._min = value;
        this._updateHandle(this._value);
    }
});


Object.defineProperty(Slider.prototype, 'max', {
    get: function() {
        return this._max;
    },
    set: function(value) {
        if (this._max === value)
            return;

        this._max = value;
        this._updateHandle(this._value);
    }
});


Object.defineProperty(Slider.prototype, 'value', {
    get: function() {
        if (this._link) {
            return this._link.get(this.path);
        } else {
            return this._value;
        }
    },
    set: function(value) {
        if (this._link) {
            if (! this._link.set(this.path, value))
                this._updateHandle(this._link.get(this.path));
        } else {
            if (this._max !== null && this._max < value)
                value = this._max;

            if (this._min !== null && this._min > value)
                value = this._min;

            if (value === null) {
                this.class.add('null');
            } else {
                if (typeof value !== 'number')
                    value = undefined;

                value = (value !== undefined && this.precision !== null) ? parseFloat(value.toFixed(this.precision), 10) : value;
                this.class.remove('null');
            }

            this._updateHandle(value);
            this._value = value;

            if (this._lastValue !== value) {
                this._lastValue = value;
                this.emit('change', value);
            }
        }
    }
});


window.ui.Slider = Slider;


/* ui/progress.js */
"use strict";

function Progress(args) {
    ui.Element.call(this);
    args = args || { };

    this._progress = 0;

    if (args.progress)
        this._progress = Math.max(0, Math.min(1, args.progress));

    this._targetProgress = this._progress;

    this._lastProgress = Math.floor(this._progress * 100);

    this.element = document.createElement('div');
    this._element.classList.add('ui-progress');

    this._inner = document.createElement('div');
    this._inner.classList.add('inner');
    this._inner.style.width = (this._progress * 100) + '%';
    this._element.appendChild(this._inner);

    this._speed = args.speed || 1;

    this._now = Date.now();
    this._animating = false;

    this._failed = false;

    var self = this;
    this._animateHandler = function() {
        self._animate();
    };
}
Progress.prototype = Object.create(ui.Element.prototype);


Object.defineProperty(Progress.prototype, 'progress', {
    get: function() {
        return this._progress;
    },
    set: function(value) {
        value = Math.max(0, Math.min(1, value));

        if (this._targetProgress === value)
            return;

        this._targetProgress = value;

        if (this._speed === 0 || this._speed === 1) {
            this._progress = this._targetProgress;
            this._inner.style.width = (this._progress * 100) + '%';

            var progress = Math.max(0, Math.min(100, Math.round(this._progress * 100)));
            if (progress !== this._lastProgress) {
                this._lastProgress = progress;
                this.emit('progress:' + progress);
                this.emit('progress', progress);
            }
        } else if (! this._animating) {
            requestAnimationFrame(this._animateHandler);
        }
    }
});


Object.defineProperty(Progress.prototype, 'speed', {
    get: function() {
        return this._speed;
    },
    set: function(value) {
        this._speed = Math.max(0, Math.min(1, value));
    }
});


Object.defineProperty(Progress.prototype, 'failed', {
    get: function() {
        return this._failed;
    },
    set: function(value) {
        this._failed = !! value;

        if (this._failed) {
            this.class.add('failed');
        } else {
            this.class.remove('failed');
        }
    }
});


Progress.prototype._animate = function() {
    if (Math.abs(this._targetProgress - this._progress) < 0.01) {
        this._progress = this._targetProgress;
        this._animating = false;
    } else {
        if (! this._animating) {
            this._now = Date.now() - (1000 / 60);
            this._animating = true;
        }
        requestAnimationFrame(this._animateHandler);

        var dt = Math.max(0.1, Math.min(3, (Date.now() - this._now) / (1000 / 60)));
        this._now = Date.now();
        this._progress = this._progress + ((this._targetProgress - this._progress) * (this._speed * dt));
    }

    var progress = Math.max(0, Math.min(100, Math.round(this._progress * 100)));
    if (progress !== this._lastProgress) {
        this._lastProgress = progress;
        this.emit('progress:' + progress);
        this.emit('progress', progress);
    }

    this._inner.style.width = (this._progress * 100) + '%';
};


window.ui.Progress = Progress;


/* ui/list.js */
"use strict";

function List(args) {
    args = args || { };
    ui.ContainerElement.call(this);

    this.element = document.createElement('ul');
    this._element.classList.add('ui-list');
    this.selectable = args.selectable !== undefined ? args.selectable : true;

    this._changing = false;
    this._selected = [ ];

    this.on('select', this._onSelect);
    this.on('deselect', this._onDeselect);
    this.on('append', this._onAppend);
}
List.prototype = Object.create(ui.ContainerElement.prototype);


List.prototype._onSelect = function(item) {
    var ind = this._selected.indexOf(item);
    if (ind === -1)
        this._selected.push(item);

    if (this._changing)
        return;

    if (List._ctrl && List._ctrl()) {

    } else if (List._shift && List._shift() && this.selected.length) {

    } else {
        this._changing = true;

        var items = this.selected;

        if (items.length > 1) {
            for(var i = 0; i < items.length; i++) {
                if (items[i] === item)
                    continue;

                items[i].selected = false;
            }
        }

        this._changing = false;
    }

    this.emit('change');
};

List.prototype._onDeselect = function(item) {
    var ind = this._selected.indexOf(item);
    if (ind !== -1) this._selected.splice(ind, 1);

    if (this._changing)
        return;

    if (List._ctrl && List._ctrl()) {

    } else {
        this._changing = true;

        var items = this.selected;

        if (items.length) {
            for(var i = 0; i < items.length; i++)
                items[i].selected = false;

            item.selected = true;
        }

        this._changing = false;
    }

    this.emit('change');
};

List.prototype._onAppend = function(item) {
    if (! item.selected)
        return;

    var ind = this._selected.indexOf(item);
    if (ind === -1) this._selected.push(item);
};

List.prototype.clear = function() {
    this._selected = [ ];
    ContainerElement.prototype.clear.call(this);
};


Object.defineProperty(List.prototype, 'selectable', {
    get: function() {
        return this._selectable;
    },
    set: function(value) {
        if (this._selectable === !! value)
            return;

        this._selectable = value;

        if (this._selectable) {
            this.class.add('selectable');
        } else {
            this.class.remove('selectable');
        }
    }
});


Object.defineProperty(List.prototype, 'selected', {
    get: function() {
        return this._selected.slice(0);
    },
    set: function(value) {
        this._changing = true;

        // deselecting
        var items = this.selected;
        for(var i = 0; i < items.length; i++) {
            if (value.indexOf(items[i]) !== -1)
                continue;

            items[i].selected = false;
        }

        // selecting
        for(var i = 0; i < value.length; i++) {
            value[i].selected = true;
        }

        this._changing = false;
    }
});


window.ui.List = List;


/* ui/list-item.js */
"use strict";

function ListItem(args) {
    ui.Element.call(this);
    args = args || { };

    this._text = args.text || '';
    this._selected = args.selected || false;
    // if true then clicking on a selected item will deselect it (defaults to true)
    this._allowDeselect = args.allowDeselect !== undefined ? args.allowDeselect : true;

    this.element = document.createElement('li');
    this._element.classList.add('ui-list-item');

    this.elementText = document.createElement('span');
    this.elementText.textContent = this._text;
    this._element.appendChild(this.elementText);

    this.on('click', this._onClick);
}
ListItem.prototype = Object.create(ui.Element.prototype);


ListItem.prototype._onClick = function () {
    if (! this.selected) {
        this.selected = true;
    } else if (this._allowDeselect) {
        this.selected = false;
    }
};


Object.defineProperty(ListItem.prototype, 'text', {
    get: function() {
        return this._text;
    },
    set: function(value) {
        if (this._text === value) return;
        this._text = value;
        this.elementText.textContent = this._text;
    }
});


Object.defineProperty(ListItem.prototype, 'selected', {
    get: function() {
        return this._selected;
    },
    set: function(value) {
        if (this._selected === value)
            return;

        this._selected = value;

        if (this._selected) {
            this._element.classList.add('selected');
        } else {
            this._element.classList.remove('selected');
        }

        this.emit(this.selected ? 'select' : 'deselect');

        if (this.parent)
            this.parent.emit(this.selected ? 'select' : 'deselect', this);

        this.emit('change', this.selected);
    }
});


window.ui.ListItem = ListItem;


/* ui/grid.js */
"use strict";

function Grid(args) {
    var self = this;
    ui.ContainerElement.call(this);

    this.element = document.createElement('ul');
    this._element.tabIndex = 0;
    this._element.classList.add('ui-grid');

    this._lastSelect = null;
    this._selecting = false;
    this._multiSelect = args && args.multiSelect !== undefined ? args.multiSelect : true;

    this.on('select', this._onSelect);
    this.on('beforeDeselect', this._onBeforeDeselect);

    this.on('append', this._onAppend);
    this.on('remove', this._onRemove);
}
Grid.prototype = Object.create(ui.ContainerElement.prototype);


Grid.prototype._onSelect = function(item) {
    if (this._selecting)
        return;

    if (this._multiSelect && Grid._shift && Grid._shift()) {
        var children = Array.prototype.slice.call(this._element.childNodes, 0);

        // multi select from-to
        if (this._lastSelect) {
            this._selecting = true;

            var startInd = children.indexOf(this._lastSelect.element);
            var endInd = children.indexOf(item.element);

            // swap if backwards
            if (startInd > endInd) {
                var t = startInd;
                startInd = endInd;
                endInd = t;
            }

            for(var i = startInd; i < endInd; i++) {
                if (! children[i] || ! children[i].ui || children[i].ui.hidden)
                    continue;

                children[i].ui.selected = true;
            }

            this._selecting = false;
        } else {
            this._lastSelect = item;
        }
    } else if (this._multiSelect && Grid._ctrl && Grid._ctrl()) {
        // multi select
        this._lastSelect = item;
    } else {
        // single select
        var items = this._element.querySelectorAll('.ui-grid-item.selected');

        if (items.length > 1) {
            for(var i = 0; i < items.length; i++) {
                if (items[i].ui === item)
                    continue;

                items[i].ui.selected = false;
            }
        }

        this._lastSelect = item;
    }
};


Grid.prototype._onBeforeDeselect = function(item) {
    if (this._selecting)
        return;

    this._selecting = true;

    if (this._multiSelect && Grid._shift && Grid._shift()) {
        this._lastSelect = null;
    } else if (this._multiSelect && Grid._ctrl && Grid._ctrl()) {
        this._lastSelect = null;
    } else {
        var items = this._element.querySelectorAll('.ui-grid-item.selected');
        if (items.length > 1) {
            for(var i = 0; i < items.length; i++) {
                if (items[i].ui === item)
                    continue;
                items[i].ui.selected = false;
            }
            item._selectPending = true;
            this._lastSelect = item;
        }
    }

    this._selecting = false;
};


Grid.prototype.filter = function(fn) {
    this.forEach(function(item) {
        item.hidden = ! fn(item);
    });
};


Grid.prototype.forEach = function(fn) {
    var child = this._element.firstChild;
    while(child) {
        if (child.ui)
            fn(child.ui);

        child = child.nextSibling;
    };
};

Object.defineProperty(Grid.prototype, 'selected', {
    get: function() {
        var items = [ ];
        var elements = this._element.querySelectorAll('.ui-grid-item.selected');

        for(var i = 0; i < elements.length; i++)
            items.push(elements[i].ui);

        return items;
    },
    set: function(value) {
        if (this._selecting)
            return;

        this._selecting = true;

        // deselecting
        var items = this.selected;
        for(var i = 0; i < items.length; i++) {
            if (value && value.indexOf(items[i]) !== -1)
                continue;
            items[i].selected = false;
        }

        if (! value)
            return;

        // selecting
        for(var i = 0; i < value.length; i++) {
            if (! value[i])
                continue;

            value[i].selected = true;
        }

        this._selecting = false;
    }
});


window.ui.Grid = Grid;


/* ui/grid-item.js */
"use strict";

function GridItem(args) {
    var self = this;
    ui.Element.call(this);
    args = args || { };

    this._text = args.text || '';
    this._selectPending = false;
    this._selected = args.selected || false;
    this._toggleSelectOnClick = args && args.toggleSelectOnClick !== undefined ? args.toggleSelectOnClick : true;
    this._clicked = false;

    this.element = document.createElement('li');
    this._element.ui = this;
    this._element.tabIndex = 0;
    this._element.classList.add('ui-grid-item');
    this._element.innerHTML = this._text;

    this._element.removeEventListener('click', this._evtClick);
    this._element.addEventListener('click', this._onClick, false);

    this.on('select', this._onSelect);
    this.on('deselect', this._onDeselect);
}
GridItem.prototype = Object.create(ui.Element.prototype);


GridItem.prototype._onClick = function() {
    this.ui.emit('click');
    this.ui._clicked = true;
    if (this.ui._toggleSelectOnClick) {
        this.ui.selected = ! this.ui.selected;
    } else {
        this.ui.selected = true;
    }
    this.ui._clicked = false;
};

GridItem.prototype._onSelect = function() {
    this._element.focus();
};

GridItem.prototype._onDeselect = function() {
    this._element.blur();
};


Object.defineProperty(GridItem.prototype, 'text', {
    get: function() {
        return this._text;
    },
    set: function(value) {
        if (this._text === value) return;
        this._text = value;
        this._element.innerHTML = this._text;
    }
});


Object.defineProperty(GridItem.prototype, 'selected', {
    get: function() {
        return this._selected;
    },
    set: function(value) {
        if (this._selected === value)
            return;

        this._selectPending = value;

        if (this.parent && this._clicked)
            this.parent.emit('before' + (value ? 'Select' : 'Deselect'), this, this._clicked);

        if (this._selected === this._selectPending)
            return;

        this._selected = this._selectPending;

        if (this._selected) {
            this._element.classList.add('selected');
        } else {
            this._element.classList.remove('selected');
        }

        this.emit(this.selected ? 'select' : 'deselect');
        this.emit('change', this.selected);

        if (this.parent)
            this.parent.emit(this.selected ? 'select' : 'deselect', this, this._clicked);
    }
});


window.ui.GridItem = GridItem;


/* ui/tree.js */
"use strict";

function Tree() {
    ui.ContainerElement.call(this);

    this.element = document.createElement('div');
    this._element.classList.add('ui-tree');

    this.elementDrag = document.createElement('div');
    this.elementDrag.classList.add('drag-handle');
    this._element.appendChild(this.elementDrag);

    var self = this;
    this.elementDrag.addEventListener('mousemove', function(evt) {
        evt.preventDefault();
        evt.stopPropagation();

        self._onDragMove(evt);
    });
    this._element.addEventListener('mouseleave', function(evt) {
        self._onDragOut();
    });

    this.on('select', this._onSelect);
    this.on('deselect', this._onDeselect);
    this.on('append', this._onAppend);
    this.on('remove', this._onRemove);

    this.draggable = true;
    this._dragging = false;
    this._dragItems = [ ];
    this._dragOver = null;
    this._dragArea = 'inside';
    this._evtDragMove = null;
    this.reordering = true;
    this.dragInstant = true;

    this._selected = [ ];
}
Tree.prototype = Object.create(ui.ContainerElement.prototype);


Object.defineProperty(Tree.prototype, 'selected', {
    get: function() {
        return this._selected.slice(0);
    },
    set: function(value) {

    }
});


Tree.prototype._onItemClick = function(item) {
    if (Tree._ctrl && Tree._ctrl()) {
        item.selected = ! item.selected;
    } else if (Tree._shift && Tree._shift() && this._selected.length) {
        var from = this._selected[this._selected.length - 1];
        var to = item;

        var up = [ ];
        var down = [ ];

        var prev = function(refItem) {
            var result = null;
            var item = refItem.element.previousSibling;
            if (item)
                item = item.ui;

            if (item) {
                if (refItem.parent && refItem.parent === item && refItem.parent instanceof TreeItem) {
                    result = refItem.parent;
                } else if (item.open && item._children) {
                    // element above is open, find last available element
                    var last = item.element.lastChild;
                    if (last.ui)
                        last = last.ui;

                    if (last) {
                        var findLast = function(inside) {
                            if (inside.open && inside._children) {
                                return inside.element.lastChild.ui || null;
                            } else {
                                return null;
                            }
                        }

                        var found = false;
                        while(! found) {
                            var deeper = findLast(last);
                            if (deeper) {
                                last = deeper;
                            } else {
                                found = true;
                            }
                        }

                        result = last;
                    } else {
                        result = item;
                    }
                } else {
                    result = item;
                }
            }

            return result;
        };

        var next = function(refItem) {
            var result = null;
            var item = refItem.element.nextSibling;
            if (item)
                item = item.ui;

            if (refItem.open && refItem._children) {
                // select a child
                var first = refItem.element.firstChild.nextSibling;
                if (first && first.ui) {
                    result = first.ui;
                } else if (item) {
                    result = item;
                }
            } else if (item) {
                // select next item
                result = item;
            } else if (refItem.parent && refItem.parent instanceof TreeItem) {
                // no next element, go to parent
                var parent = refItem.parent;

                var findNext = function(from) {
                    var next = from.next;
                    if (next) {
                        result = next;
                    } else if (from.parent instanceof TreeItem) {
                        return from.parent;
                    }
                    return false;
                }

                while(parent = findNext(parent)) { }
            }

            return result;
        };

        var done = false;
        var path = null;
        var lookUp = true;
        var lookDown = true;
        var lookingUp = true;
        while(! done && ! path) {
            lookingUp = ! lookingUp;

            var item = null;
            var lookFrom = from;
            if ((! lookDown || lookingUp) && lookUp) {
                // up
                if (up.length)
                    lookFrom = up[up.length - 1];

                item = prev(lookFrom);
                if (item) {
                    up.push(item);

                    if (item === to) {
                        done = true;
                        path = up;
                        break;
                    }
                } else {
                    lookUp = false;
                }
            } else if (lookDown) {
                // down
                if (down.length)
                    lookFrom = down[down.length - 1];

                item = next(lookFrom);
                if (item) {
                    down.push(item);

                    if (item === to) {
                        done = true;
                        path = down;
                        break;
                    }
                } else {
                    lookDown = false;
                }
            } else {
                done = true;
            }
        }

        if (path) {
            for(var i = 0; i < path.length; i++) {
                path[i].selected = true;
            }
        }


    } else {
        var selected = item.selected && ((this._selected.indexOf(item) === -1) || (this._selected.length === 1 && this._selected[0] === item));
        this.clear();

        if (! selected)
            item.selected = true;
    }
};


Tree.prototype._onSelect = function(item) {
    this._selected.push(item);
};


Tree.prototype._onDeselect = function(item) {
    var ind = this._selected.indexOf(item);
    if (ind === -1)
        return;

    this._selected.splice(ind, 1);
};


Tree.prototype.clear = function() {
    if (! this._selected.length)
        return;

    var i = this._selected.length;
    while(i--) {
        this._selected[i].selected = false;
    }
    this._selected = [ ];
}


Tree.prototype._onDragStart = function(item) {
    if (! this.draggable || this._dragging)
        return;

    this._dragItems =  [ ];

    if (this._selected && this._selected.length > 1 && this._selected.indexOf(item) !== -1) {
        var items = [ ];
        var index = { };
        var defaultLevel = -1;

        // build index
        for(var i = 0; i < this._selected.length; i++) {
            // cant drag parent
            if (this._selected[i].parent === this)
                return;

            this._selected[i]._dragId = i + 1;
            index[this._selected[i]._dragId] = this._selected[i];
        }

        for(var i = 0; i < this._selected.length; i++) {
            var s = this._selected[i];
            var level = 0;
            var child = false;
            var parent = this._selected[i].parent;
            if (! (parent instanceof ui.TreeItem))
                parent = null;

            while(parent) {
                if (parent._dragId && index[parent._dragId]) {
                    // child, to be ignored
                    child = true;
                    break;
                }

                parent = parent.parent;
                if (! (parent instanceof ui.TreeItem)) {
                    parent = null;
                    break;
                }

                level++;
            }

            if (! child) {
                if (defaultLevel === -1) {
                    defaultLevel = level;
                } else if (defaultLevel !== level) {
                    // multi-level drag no allowed
                    return;
                }

                items.push(this._selected[i]);
            }
        }

        // clean ids
        for(var i = 0; i < this._selected.length; i++)
            this._selected[i]._dragId = null;

        this._dragItems = items;

        // sort items by their number of apperance in hierarchy
        if (items.length > 1) {
            var commonParent = null;

            // find common parent
            var findCommonParent = function(items) {
                var parents = [ ];
                for(var i = 0; i < items.length; i++) {
                    if (parents.indexOf(items[i].parent) === -1)
                        parents.push(items[i].parent);
                }
                if (parents.length === 1) {
                    commonParent = parents[0];
                } else {
                    return parents;
                }
            };
            var parents = items;
            while(! commonParent && parents)
                parents = findCommonParent(parents);

            // calculate ind number
            for(var i = 0; i < items.length; i++) {
                var ind = 0;

                var countChildren = function(item) {
                    if (! item._children) {
                        return 0;
                    } else {
                        var count = 0;
                        var children = item.innerElement.childNodes;
                        for(var i = 0; i < children.length; i++) {
                            if (children[i].ui)
                                count += countChildren(children[i]) + 1;
                        }
                        return count;
                    }
                };

                var scanUpForIndex = function(item) {
                    ind++;

                    var sibling = item.element.previousSibling;
                    sibling = (sibling && sibling.ui) || null;

                    if (sibling) {
                        ind += countChildren(sibling);
                        return sibling;
                    } else if (item.parent === commonParent) {
                        return null;
                    } else {
                        return item.parent;
                    }
                };

                var prev = scanUpForIndex(items[i]);
                while(prev)
                    prev = scanUpForIndex(prev);

                items[i]._dragInd = ind;
            }

            items.sort(function(a, b) {
                return a._dragInd - b._dragInd;
            });
        }
    } else {
        // single drag
        this._dragItems = [ item ];
    }

    if (this._dragItems.length) {
        this._dragging = true;

        this.class.add('dragging');
        for(var i = 0; i < this._dragItems.length; i++) {
            this._dragItems[i].class.add('dragged');
        }

        this._updateDragHandle();
        this.emit('dragstart');
    }
};


Tree.prototype._onDragOver = function(item, evt) {
    if (! this.draggable || ! this._dragging || (this._dragItems.indexOf(item) !== -1 && ! this._dragOver) || this._dragOver === item)
        return;

    var dragOver = null;

    if (item.allowDrop) {
        if (this._dragItems.indexOf(item) === -1)
            dragOver = item;

        if (this._dragOver === null && dragOver)
            this.emit('dragin');
    }



    this._dragOver = dragOver;

    this._updateDragHandle();
    this._onDragMove(evt);
};


Tree.prototype._hoverCalculate = function(evt) {
    if (! this.draggable || ! this._dragOver)
        return;

    var rect = this.elementDrag.getBoundingClientRect();
    var area = Math.floor((evt.clientY - rect.top) / rect.height * 5);

    var oldArea = this._dragArea;
    var oldDragOver = this._dragOver;

    if (this._dragOver.parent === this) {
        var parent = false;
        for(var i = 0; i < this._dragItems.length; i++) {
            if (this._dragItems[i].parent === this._dragOver) {
                parent = true;
                this._dragOver = null;
                break;
            }
        }
        if (! parent)
            this._dragArea = 'inside';
    } else {
        // check if we are trying to drag item inside any of its children
        var invalid = false;
        for (var i = 0; i < this._dragItems.length; i++) {
            var parent = this._dragOver.parent;
            while (parent) {
                if (parent === this._dragItems[i]) {
                    invalid = true;
                    break;
                }

                parent = parent.parent;
            }
        }

        if (invalid) {
            this._dragOver = null;
        } else if (this.reordering && area <= 1 && this._dragItems.indexOf(this._dragOver.prev) === -1) {
            this._dragArea = 'before';
        } else if (this.reordering && area >= 4 && this._dragItems.indexOf(this._dragOver.next) === -1 && (this._dragOver._children === 0 || ! this._dragOver.open)) {
            this._dragArea = 'after';
        } else {
            var parent = false;
            if (this.reordering && this._dragOver.open) {
                for(var i = 0; i < this._dragItems.length; i++) {
                    if (this._dragItems[i].parent === this._dragOver) {
                        parent = true;
                        this._dragArea = 'before';
                        break;
                    }
                }
            }
            if (! parent)
                this._dragArea = 'inside';
        }
    }

    if (oldArea !== this._dragArea || oldDragOver !== this._dragOver)
        this._updateDragHandle();
};


Tree.prototype._onDragMove = function(evt) {
    if (! this.draggable)
        return;

    this._hoverCalculate(evt);
    this.emit('dragmove', evt);
};


Tree.prototype._onDragOut = function() {
    if (! this.draggable || ! this._dragging || ! this._dragOver)
        return;

    this._dragOver = null;
    this._updateDragHandle();
    this.emit('dragout');
};


Tree.prototype._onDragEnd = function() {
    if (! this.draggable || ! this._dragging)
        return;

    var reparentedItems = [ ];
    this._dragging = false;
    this.class.remove('dragging');

    var lastDraggedItem = this._dragOver;

    for(var i = 0; i < this._dragItems.length; i++) {
        this._dragItems[i].class.remove('dragged');

        if (this._dragOver && this._dragOver !== this._dragItems[i]) {

            var oldParent = this._dragItems[i].parent;

            if (oldParent !== this._dragOver || this._dragArea !== 'inside') {
                var newParent = null;

                if (this.dragInstant) {
                    if (this._dragItems[i].parent)
                        this._dragItems[i].parent.remove(this._dragItems[i]);
                }

                if (this._dragArea === 'before') {
                    newParent = this._dragOver.parent;
                    if (this.dragInstant)
                        this._dragOver.parent.appendBefore(this._dragItems[i], this._dragOver);
                } else if (this._dragArea === 'inside') {
                    newParent = this._dragOver;
                    if (this.dragInstant) {
                        this._dragOver.open = true;
                        this._dragOver.append(this._dragItems[i]);
                    }
                } else if (this._dragArea === 'after') {
                    newParent = this._dragOver.parent;
                    if (this.dragInstant) {
                        this._dragOver.parent.appendAfter(this._dragItems[i], lastDraggedItem);
                        lastDraggedItem = this._dragItems[i];
                    }
                }

                reparentedItems.push({
                    item: this._dragItems[i],
                    old: oldParent,
                    new: newParent
                });
            }
        }
    }

    this.emit('reparent', reparentedItems);

    this._dragItems = [ ];

    if (this._dragOver)
        this._dragOver = null;

    this.emit('dragend');
};


Tree.prototype._updateDragHandle = function() {
    if (! this.draggable || ! this._dragging)
        return;

    if (! this._dragOver) {
        this.elementDrag.classList.add('hidden');
    } else {
        var rect = this._dragOver.elementTitle.getBoundingClientRect();

        this.elementDrag.classList.remove('before', 'inside', 'after', 'hidden')
        this.elementDrag.classList.add(this._dragArea);

        this.elementDrag.style.top = rect.top  + 'px';
        this.elementDrag.style.left = rect.left + 'px';
        this.elementDrag.style.width = (rect.width - 4) + 'px';
    }
};


Tree.prototype._onAppend = function(item) {
    item.tree = this;

    var self = this;

    item.on('dragstart', function() {
        // can't drag root
        if (this.parent === self)
            return;

        self._onDragStart(this);
    });

    item.on('mouseover', function(evt) {
        self._onDragOver(this, evt);
    });

    item.on('dragend', function() {
        self._onDragEnd();
    });
};


Tree.prototype._onRemove = function(item) {
    item.tree = null;

    item.unbind('dragstart');
    item.unbind('mouseover');
    item.unbind('dragend');
};

window.ui.Tree = Tree;


/* ui/tree-item.js */
"use strict";

function TreeItem(args) {
    var self = this;
    ui.Element.call(this);
    args = args || { };

    this.tree = null;

    this.element = document.createElement('div');
    this._element.classList.add('ui-tree-item');

    if (args.classList) {
        args.classList.forEach(function(className) {
            this._element.classList.add(className);
        }, this);
    }

    this.elementTitle = document.createElement('div');
    this.elementTitle.classList.add('title');
    this.elementTitle.draggable = true;
    this.elementTitle.tabIndex = 0;
    this.elementTitle.ui = this;
    this._element.appendChild(this.elementTitle);

    this.elementIcon = document.createElement('span');
    this.elementIcon.classList.add('icon');
    this.elementTitle.appendChild(this.elementIcon);

    this.elementText = document.createElement('span');
    this.elementText.textContent = args.text || '';
    this.elementText.classList.add('text');
    this.elementTitle.appendChild(this.elementText);

    this._children = 0;
    this.selectable = true;

    this._onMouseUp = function(evt) {
        window.removeEventListener('mouseup', self._dragRelease);
        self._dragRelease = null;

        evt.preventDefault();
        evt.stopPropagation();

        self._dragging = false;
        self.emit('dragend');
    };

    this.elementTitle.addEventListener('click', this._onClick, false);
    this.elementTitle.addEventListener('dblclick', this._onDblClick, false);

    this._dragRelease = null;
    this._dragging = false;
    this._allowDrop = (args.allowDrop !== undefined ? !!args.allowDrop : true);

    this.elementTitle.addEventListener('mousedown', this._onMouseDown, false);
    this.elementTitle.addEventListener('dragstart', this._onDragStart, false);
    this.elementTitle.addEventListener('mouseover', this._onMouseOver, false);

    this.on('destroy', this._onDestroy);
    this.on('append', this._onAppend);
    this.on('remove', this._onRemove);
    this.on('select', this._onSelect);
    this.on('deselect', this._onDeselect);

    this.elementTitle.addEventListener('keydown', this._onKeyDown, false);
}
TreeItem.prototype = Object.create(ui.Element.prototype);


TreeItem.prototype.append = function(item) {
    if (this._children === 1) {
        this._element.childNodes[1].classList.remove('single');
    }

    item.parent = this;
    this._element.appendChild(item.element);
    this._children++;

    if (this._children === 1) {
        item.class.add('single');
        this.class.add('container');
    } else if (this._children > 1) {
        item.class.remove('single');
    }

    var appendChildren = function(treeItem) {
        treeItem.emit('append', treeItem);

        if (treeItem._children) {
            for(var i = 1; i < treeItem.element.childNodes.length; i++) {
                appendChildren(treeItem.element.childNodes[i].ui);
            }
        }
    };
    appendChildren(item);
};


TreeItem.prototype.appendBefore = function(item, referenceItem) {
    if (this._children === 1) {
        this._element.childNodes[1].classList.remove('single');
    }

    item.parent = this;
    this._element.insertBefore(item.element, referenceItem.element);
    this._children++;

    if (this._children === 1) {
        item.class.add('single');
        this.class.add('container');
    } else if (this._children > 1) {
        item.class.remove('single');
    }

    var appendChildren = function(treeItem) {
        treeItem.emit('append', treeItem);

        if (treeItem._children) {
            for(var i = 1; i < treeItem.element.childNodes.length; i++) {
                appendChildren(treeItem.element.childNodes[i].ui);
            }
        }
    };
    appendChildren(item);
};


TreeItem.prototype.appendAfter = function(item, referenceItem) {
    item.parent = this;
    referenceItem = referenceItem.element.nextSibling;

    // might be last
    if (! referenceItem)
        this.append(item);

    this._element.insertBefore(item.element, referenceItem);
    this._children++;

    if (this._children === 1) {
        item.class.add('single');
        this.class.add('container');
    } else if (this._children === 2) {
        this._element.childNodes[1].classList.remove('single');
    }

    var appendChildren = function(treeItem) {
        treeItem.emit('append', treeItem);

        if (treeItem._children) {
            for(var i = 1; i < treeItem.element.childNodes.length; i++) {
                appendChildren(treeItem.element.childNodes[i].ui);
            }
        }
    };
    appendChildren(item);
};


TreeItem.prototype.remove = function(item) {
    if (! this._children || ! this._element.contains(item.element))
        return;

    this._element.removeChild(item.element);
    this._children--;

    if (this._children === 0) {
        this.class.remove('container');
    } else if (this._children === 1 && this._element.childNodes.length > 2) {
        this._element.childNodes[1].classList.add('single');
    }

    var removeChildren = function(treeItem) {
        treeItem.emit('remove', treeItem);

        if (treeItem._children) {
            for(var i = 1; i < treeItem.element.childNodes.length; i++) {
                removeChildren(treeItem.element.childNodes[i].ui);
            }
        }
    };
    removeChildren(item);
};


TreeItem.prototype._onDestroy = function() {
    this.elementTitle.removeEventListener('click', this._onClick);
    this.elementTitle.removeEventListener('dblclick', this._onDblClick);
    this.elementTitle.removeEventListener('mousedown', this._onMouseDown);
    this.elementTitle.removeEventListener('dragstart', this._onDragStart);
    this.elementTitle.removeEventListener('mouseover', this._onMouseOver);
    this.elementTitle.removeEventListener('keydown', this._onKeyDown);
};


TreeItem.prototype._onAppend = function(item) {
    if (this.parent)
        this.parent.emit('append', item);
};


TreeItem.prototype._onRemove = function(item) {
    if (this.parent)
        this.parent.emit('remove', item);
};


TreeItem.prototype.focus = function() {
    this.elementTitle.focus();
};

TreeItem.prototype._onRename = function(select) {
    if (select) {
        this.tree.clear();
        this.tree._onItemClick(this);
    }

    var self = this;
    this.class.add('rename');

    // add remaning field
    var field = new ui.TextField();
    field.parent = this;
    field.renderChanges = false;
    field.value = this.text;
    field.elementInput.readOnly = !this.tree.allowRenaming;
    field.elementInput.addEventListener('blur', function() {
        field.destroy();
        self.class.remove('rename');
    }, false);
    field.on('click', function(evt) {
        evt.stopPropagation();
    });
    field.element.addEventListener('dblclick', function(evt) {
        evt.stopPropagation();
    });
    field.on('change', function(value) {
        value = value.trim();
        if (value) {
            if (self.entity) {
                self.entity.set('name', value);
            }

            self.emit('rename', value);
        }

        field.destroy();
        self.class.remove('rename');
    });
    this.elementTitle.appendChild(field.element);
    field.elementInput.focus();
    field.elementInput.select();
};


TreeItem.prototype._onClick = function(evt) {
    if (evt.button !== 0 || ! this.ui.selectable)
        return;

    var rect = this.getBoundingClientRect();

    if (this.ui._children && (evt.clientX - rect.left) < 0) {
        this.ui.open = ! this.ui.open;
    } else {
        this.ui.tree._onItemClick(this.ui);
        evt.stopPropagation();
    }
};

TreeItem.prototype._onDblClick = function(evt) {
    if (! this.ui.tree.allowRenaming || evt.button !== 0)
        return;

    evt.stopPropagation();
    var rect = this.getBoundingClientRect();

    if (this.ui._children && (evt.clientX - rect.left) < 0) {
        return;
    } else {
        this.ui._onRename(true);
    }
};

TreeItem.prototype._onMouseDown = function(evt) {
    if (! this.ui.tree.draggable)
        return;

    evt.stopPropagation();
};

TreeItem.prototype._onDragStart = function(evt) {
    if (! this.ui.tree.draggable) {
        evt.stopPropagation();
        evt.preventDefault();
        return;
    }

    this.ui._dragging = true;

    if (this.ui._dragRelease)
        window.removeEventListener('mouseup', this.ui._dragRelease);

    this.ui._dragRelease = this.ui._onMouseUp;
    window.addEventListener('mouseup', this.ui._dragRelease, false);

    evt.stopPropagation();
    evt.preventDefault();

    this.ui.emit('dragstart');
};

TreeItem.prototype._onMouseOver = function(evt) {
    evt.stopPropagation();
    this.ui.emit('mouseover', evt);
};

TreeItem.prototype._onKeyDown = function(evt) {
    if ((evt.target && evt.target.tagName.toLowerCase() === 'input'))
        return;

    if ([ 9, 38, 40, 37, 39 ].indexOf(evt.keyCode) === -1)
        return;

    evt.preventDefault();
    evt.stopPropagation();

    var selectedItem = null;

    switch(evt.keyCode) {
        case 9: // tab
            break;
        case 40: // down
            var item = this.ui.element.nextSibling;
            if (item)
                item = item.ui;

            if (this.ui._children && this.ui.open) {
                var first = this.ui.element.firstChild.nextSibling;
                if (first && first.ui) {
                    selectedItem = first.ui;
                    // first.ui.selected = true;
                } else if (item) {
                    selectedItem = item;
                    // item.selected = true;
                }
            } else if (item) {
                selectedItem = item;
                // item.selected = true;
            } else if (this.ui.parent && this.ui.parent instanceof TreeItem) {
                var parent = this.ui.parent;

                var findNext = function(from) {
                    var next = from.next;
                    if (next) {
                        selectedItem = next;
                        // next.selected = true;
                    } else if (from.parent instanceof TreeItem) {
                        return from.parent;
                    }
                    return false;
                };

                while(parent = findNext(parent)) { }
            }
            break;
        case 38: // up
            var item = this.ui.element.previousSibling;
            if (item)
                item = item.ui;

            if (item) {
                if (item._children && item.open && item !== this.ui.parent) {
                    var last = item.element.lastChild;
                    if (last.ui)
                        last = last.ui;

                    if (last) {
                        var findLast = function(inside) {
                            if (inside._children && inside.open) {
                                return inside.element.lastChild.ui || null;
                            } else {
                                return null;
                            }
                        }

                        var found = false;
                        while(! found) {
                            var deeper = findLast(last);
                            if (deeper) {
                                last = deeper
                            } else {
                                found = true;
                            }
                        }

                        selectedItem = last;
                        // last.selected = true;
                    } else {
                        selectedItem = item;
                        // item.selected = true;
                    }
                } else {
                    selectedItem = item;
                    // item.selected = true;
                }
            } else if (this.ui.parent && this.ui.parent instanceof TreeItem) {
                selectedItem = this.ui.parent;
                // this.ui.parent.selected = true;
            }

            break;
        case 37: // left (close)
            if (this.ui.parent !== this.ui.tree && this.ui.open)
                this.ui.open = false;
            break;
        case 39: // right (open)
            if (this.ui._children && ! this.ui.open)
                this.ui.open = true;
            break;
    }

    if (selectedItem) {
        if (! (Tree._ctrl && Tree._ctrl()) && ! (Tree._shift && Tree._shift()))
            this.ui.tree.clear();
        selectedItem.selected = true;
    }
};

TreeItem.prototype._onSelect = function() {
    this.elementTitle.focus();
};

TreeItem.prototype._onDeselect = function() {
    this.elementTitle.blur();
};


Object.defineProperty(TreeItem.prototype, 'selected', {
    get: function() {
        return this.class.contains('selected');
    },
    set: function(value) {
        if (this.class.contains('selected') === !! value)
            return;

        if (value) {
            this.class.add('selected');

            this.emit('select');
            if (this.tree)
                this.tree.emit('select', this);

        } else {
            this.class.remove('selected');

            this.emit('deselect');
            if (this.tree)
                this.tree.emit('deselect', this);
        }
    }
});


Object.defineProperty(TreeItem.prototype, 'text', {
    get: function() {
        return this.elementText.textContent;
    },
    set: function(value) {
        if (this.elementText.textContent === value)
            return;

        this.elementText.textContent = value;
    }
});


Object.defineProperty(TreeItem.prototype, 'open', {
    get: function() {
        return this.class.contains('open');
    },
    set: function(value) {
        if (this.class.contains('open') === !! value)
            return;

        if (value) {
            this.class.add('open');
            this.emit('open');
            this.tree.emit('open', this);
        } else {
            this.class.remove('open');
            this.emit('close');
            this.tree.emit('close', this);
        }
    }
});


Object.defineProperty(TreeItem.prototype, 'prev', {
    get: function() {
        return this._element.previousSibling && this._element.previousSibling.ui || null;
    }
});


Object.defineProperty(TreeItem.prototype, 'next', {
    get: function() {
        return this._element.nextSibling && this._element.nextSibling.ui || null;
    }
});

// Default is true. If false then it's not allowed to drop
// other tree items on this item
Object.defineProperty(TreeItem.prototype, 'allowDrop', {
    get: function () {
        return this._allowDrop;
    },
    set: function (value) {
        this._allowDrop = !!value;
    }
});

TreeItem.prototype.child = function(ind) {
    return this._element.childNodes[ind + 1];
};



window.ui.TreeItem = TreeItem;


/* ui/tooltip.js */
"use strict";

function Tooltip(args) {
    var self = this;

    args = args || { };
    ui.ContainerElement.call(this);

    this.element = document.createElement('div');
    this._element.classList.add('ui-tooltip', 'align-left');

    this.innerElement = document.createElement('div');
    this.innerElement.classList.add('inner');
    this._element.appendChild(this.innerElement);

    this.arrow = document.createElement('div');
    this.arrow.classList.add('arrow');
    this._element.appendChild(this.arrow);

    this.hoverable = args.hoverable || false;

    this.x = args.x || 0;
    this.y = args.y || 0;

    this._align = 'left';
    this.align = args.align || 'left';

    this.on('show', this._reflow);
    this.hidden = args.hidden !== undefined ? args.hidden : true;
    if (args.html) {
        this.html = args.html;
    } else {
        this.text = args.text || '';
    }

    this._element.addEventListener('mouseover', this._onMouseOver, false);
    this._element.addEventListener('mouseleave', this._onMouseLeave, false);
}
Tooltip.prototype = Object.create(ui.ContainerElement.prototype);


Tooltip.prototype._onMouseOver = function(evt) {
    if (! this.ui.hoverable)
        return;

    this.ui.hidden = false;
    this.ui.emit('hover', evt);
};


Tooltip.prototype._onMouseLeave = function() {
    if (! this.ui.hoverable)
        return;

    this.ui.hidden = true;
};


Object.defineProperty(Tooltip.prototype, 'align', {
    get: function() {
        return this._align;
    },
    set: function(value) {
        if (this._align === value)
            return;

        this.class.remove('align-' + this._align);
        this._align = value;
        this.class.add('align-' + this._align);

        this._reflow();
    }
});


Object.defineProperty(Tooltip.prototype, 'flip', {
    get: function() {
        return this.class.contains('flip');
    },
    set: function(value) {
        if (this.class.contains('flip') === value)
            return;

        if (value) {
            this.class.add('flip');
        } else {
            this.class.remove('flip');
        }

        this._reflow();
    }
});


Object.defineProperty(Tooltip.prototype, 'text', {
    get: function() {
        return this.innerElement.textContent;
    },
    set: function(value) {
        if (this.innerElement.textContent === value)
            return;

        this.innerElement.textContent = value;
    }
});


Object.defineProperty(Tooltip.prototype, 'html', {
    get: function() {
        return this.innerElement.innerHTML;
    },
    set: function(value) {
        if (this.innerElement.innerHTML === value)
            return;

        this.innerElement.innerHTML = value;
    }
});


Tooltip.prototype._reflow = function() {
    if (this.hidden)
        return;

    this._element.style.top = '';
    this._element.style.right = '';
    this._element.style.bottom = '';
    this._element.style.left = '';

    this.arrow.style.top = '';
    this.arrow.style.right = '';
    this.arrow.style.bottom = '';
    this.arrow.style.left = '';

    this._element.style.display = 'block';

    // alignment
    switch(this._align) {
        case 'top':
            this._element.style.top = this.y + 'px';
            if (this.flip) {
                this._element.style.right = 'calc(100% - ' + this.x + 'px)';
            } else {
                this._element.style.left = this.x + 'px';
            }
            break;
        case 'right':
            this._element.style.top = this.y + 'px';
            this._element.style.right = 'calc(100% - ' + this.x + 'px)';
            break;
        case 'bottom':
            this._element.style.bottom = 'calc(100% - ' + this.y + 'px)';
            if (this.flip) {
                this._element.style.right = 'calc(100% - ' + this.x + 'px)';
            } else {
                this._element.style.left = this.x + 'px';
            }
            break;
        case 'left':
            this._element.style.top = this.y + 'px';
            this._element.style.left = this.x + 'px';
            break;
    }

    // limit to screen bounds
    var rect = this._element.getBoundingClientRect();

    if (rect.left < 0) {
        this._element.style.left = '0px';
        this._element.style.right = '';
    }
    if (rect.top < 0) {
        this._element.style.top = '0px';
        this._element.style.bottom = '';
    }
    if (rect.right > window.innerWidth) {
        this._element.style.right = '0px';
        this._element.style.left = '';
        this.arrow.style.left = Math.floor(rect.right - window.innerWidth + 8) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        this._element.style.bottom = '0px';
        this._element.style.top = '';
        this.arrow.style.top = Math.floor(rect.bottom - window.innerHeight + 8) + 'px';
    }

    this._element.style.display = '';
};


Tooltip.prototype.position = function(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);

    if (this.x === x && this.y === y)
        return;

    this.x = x;
    this.y = y;

    this._reflow();
};


Tooltip.attach = function(args) {
    var data = {
        align: args.align,
        hoverable: args.hoverable
    };

    if (args.html) {
        data.html = args.html;
    } else {
        data.text = args.text || '';
    }

    var item = new ui.Tooltip(data);

    item.evtHover = function() {
        var rect = args.target.getBoundingClientRect();
        var off = 16;

        switch(item.align) {
            case 'top':
                if (rect.width < 64) off = rect.width / 2;
                item.flip = rect.left + off > window.innerWidth / 2;
                if (item.flip) {
                    item.position(rect.right - off, rect.bottom);
                } else {
                    item.position(rect.left + off, rect.bottom);
                }
                break;
            case 'right':
                if (rect.height < 64) off = rect.height / 2;
                item.flip = false;
                item.position(rect.left, rect.top + off);
                break;
            case 'bottom':
                if (rect.width < 64) off = rect.width / 2;
                item.flip = rect.left + off > window.innerWidth / 2;
                if (item.flip) {
                    item.position(rect.right - off, rect.top);
                } else {
                    item.position(rect.left + off, rect.top);
                }
                break;
            case 'left':
                if (rect.height < 64) off = rect.height / 2;
                item.flip = false;
                item.position(rect.right, rect.top + off);
                break;
        }

        item.hidden = false;
    };

    item.evtBlur = function() {
        item.hidden = true;
    };

    args.target.addEventListener('mouseover', item.evtHover, false);
    args.target.addEventListener('mouseout', item.evtBlur, false);

    item.on('destroy', function() {
        args.target.removeEventListener('mouseover', item.evtHover);
        args.target.removeEventListener('mouseout', item.evtBlur);
    });

    args.root.append(item);

    return item;
};


window.ui.Tooltip = Tooltip;


/* ui/menu.js */
"use strict";

function Menu(args) {
    var self = this;

    args = args || { };
    ui.ContainerElement.call(this);

    this.element = document.createElement('div');
    this._element.tabIndex = 1;
    this._element.classList.add('ui-menu');
    this._element.addEventListener('keydown', this._onKeyDown, false);

    this.elementOverlay = document.createElement('div');
    this.elementOverlay.ui = this;
    this.elementOverlay.classList.add('overlay');
    this.elementOverlay.addEventListener('click', this._onClick, false);
    this.elementOverlay.addEventListener('contextmenu', this._onContextMenu, false);
    this._element.appendChild(this.elementOverlay);

    this.innerElement = document.createElement('div');
    this.innerElement.classList.add('inner');
    this._element.appendChild(this.innerElement);

    this._index = { };
    this._hovered = [ ];
    this._clickableSubmenus = args.clickableSubmenus;

    this.on('select-propagate', this._onSelectPropagate);
    this.on('append', this._onAppend);
    this.on('over', this._onOver);
    this.on('open', this._onOpen);
}
Menu.prototype = Object.create(ui.ContainerElement.prototype);

Menu.prototype._onClick = function() {
    this.ui.open = false;
};

Menu.prototype._onContextMenu = function() {
    this.ui.open = false;
};

Menu.prototype._onKeyDown = function(evt) {
    if (this.ui.open && evt.keyCode === 27)
        this.ui.open = false;
};

Menu.prototype._onSelectPropagate = function(path, selectedItemHasChildren) {
    if (this._clickableSubmenus && selectedItemHasChildren) {
        this._updatePath(path);
    } else {
        this.open = false;
        this.emit(path.join('.') + ':select', path);
        this.emit('select', path);
    }
};

Menu.prototype._onAppend = function(item) {
    var self = this;
    this._index[item._value] = item;

    item.on('value', function(value, valueOld) {
       delete self._index[this.valueOld];
       self._index[value] = item;
    });
    item.once('destroy', function() {
        delete self._index[this._value];
    });
};

Menu.prototype._onOver = function(path) {
    this._updatePath(path);
};

Menu.prototype._onOpen = function(state) {
    if (state) return;
    this._updatePath([ ]);
};


Object.defineProperty(Menu.prototype, 'open', {
    get: function() {
        return this.class.contains('open');
    },
    set: function(value) {
        if (this.class.contains('open') === !! value)
            return;

        if (value) {
            this.class.add('open');
            this._element.focus();
        } else {
            this.class.remove('open');
        }

        this.emit('open', !! value);
    }
});


Menu.prototype.findByPath = function(path) {
    if (! (path instanceof Array))
        path = path.split('.');

    var item = this;

    for(var i = 0; i < path.length; i++) {
        item = item._index[path[i]];
        if (! item)
            return null;
    }

    return item;
};


Menu.prototype._updatePath = function(path) {
    var node = this;

    for(var i = 0; i < this._hovered.length; i++) {
        node = node._index[this._hovered[i]];
        if (! node) break;
        if (path.length <= i || path[i] !== this._hovered[i]) {
            node.class.remove('hover');
            node.innerElement.style.top = '';
            node.innerElement.style.left = '';
            node.innerElement.style.right = '';
        }
    }

    this._hovered = path;
    node = this;

    for(var i = 0; i < this._hovered.length; i++) {
        node = node._index[this._hovered[i]];

        if (! node)
            break;

        node.class.add('hover');
        node.innerElement.style.top = '';
        node.innerElement.style.left = '';
        node.innerElement.style.right = '';

        var rect = node.innerElement.getBoundingClientRect();

        // limit to bottom / top of screen
        if (rect.bottom > window.innerHeight) {
            node.innerElement.style.top = -(rect.bottom - window.innerHeight) + 'px';
        }
        if (rect.right > window.innerWidth) {
            node.innerElement.style.left = 'auto';
            node.innerElement.style.right = (node.parent.innerElement.clientWidth) + 'px';
        }
    }
};


Menu.prototype.position = function(x, y) {
    this._element.style.display = 'block';

    var rect = this.innerElement.getBoundingClientRect();

    var left = (x || 0);
    var top = (y || 0);

    // limit to bottom / top of screen
    if (top + rect.height > window.innerHeight) {
        top = window.innerHeight - rect.height;
    } else if (top < 0) {
        top = 0;
    }
    if (left + rect.width > window.innerWidth) {
        left = window.innerWidth - rect.width;
    } else if (left < 0) {
        left = 0;
    }

    this.innerElement.style.left = left + 'px';
    this.innerElement.style.top = top + 'px';

    this._element.style.display = '';
};

Menu.prototype.createItem = function (key, data) {
    var item = new ui.MenuItem({
        text: data.title || key,
        className: data.className || null,
        value: key,
        icon: data.icon,
        hasChildren: !!(data.items && Object.keys(data.items).length > 0),
        clickableSubmenus: this._clickableSubmenus
    });

    if (data.select) {
        item.on('select', data.select);
    }

    if (data.filter) {
        this.on('open', function() {
            item.enabled = data.filter();
        });
    }

    if (data.hide) {
        this.on('open', function () {
            item.hidden = data.hide();
        });
    }

    return item;
};


Menu.fromData = function(data, args) {
    var menu = new ui.Menu(args);

    var listItems = function(data, parent) {
        for (var key in data) {
            var item = menu.createItem(key, data[key]);
            parent.append(item);

            if (data[key].items)
                listItems(data[key].items, item);
        }
    };

    listItems(data, menu);

    return menu;
};


window.ui.Menu = Menu;


/* ui/menu-item.js */
"use strict";

function MenuItem(args) {
    var self = this;

    args = args || { };
    ui.ContainerElement.call(this);

    this._value = args.value || '';
    this._hasChildren = args.hasChildren;
    this._clickableSubmenus = args.clickableSubmenus;

    this.element = document.createElement('div');
    this._element.classList.add('ui-menu-item');

    if (args.className) {
        this._element.classList.add(args.className);
    }

    this.elementTitle = document.createElement('div');
    this.elementTitle.classList.add('title');
    this.elementTitle.ui = this;
    this._element.appendChild(this.elementTitle);

    this.elementIcon = null;

    this.elementText = document.createElement('span');
    this.elementText.classList.add('text');
    this.elementText.textContent = args.text || 'Untitled';
    this.elementTitle.appendChild(this.elementText);

    this.innerElement = document.createElement('div');
    this.innerElement.classList.add('content');
    this._element.appendChild(this.innerElement);

    this._index = { };

    this._container = false;

    this.elementTitle.addEventListener('mouseenter', this._onMouseEnter, false);
    this.elementTitle.addEventListener('touchstart', this._onTouchStart, false);
    this.elementTitle.addEventListener('touchend', this._onTouchEnd, false);
    this.elementTitle.addEventListener('click', this._onClick, false);

    this.on('over', this._onOver);
    this.on('select-propagate', this._onSelectPropagate);
    this.on('append', this._onAppend);

    if (args.icon)
        this.icon = args.icon;
}
MenuItem.prototype = Object.create(ui.ContainerElement.prototype);


MenuItem.prototype._onMouseEnter = function(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    this.ui.parent.emit('over', [ this.ui._value ]);
};

MenuItem.prototype._onOver = function(path) {
    if (! this.parent)
        return;

    path.splice(0, 0, this._value);

    this.parent.emit('over', path);
};

MenuItem.prototype._onClick = function() {
    if (! this.ui.parent || this.ui.disabled)
        return;

    this.ui.emit('select', this.ui._value, this.ui._hasChildren);
    this.ui.parent.emit('select-propagate', [ this.ui._value ], this.ui._hasChildren);

    if (!this.ui._clickableSubmenus || !this.ui._hasChildren) {
        this.ui.class.remove('hover');
    }
};

MenuItem.prototype._onTouchStart = function(evt) {
    if (! this.ui.parent || this.ui.disabled)
        return;

    if (! this.ui._container || this.ui.class.contains('hover')) {
        this.ui.emit('select', this.ui._value, this.ui._hasChildren);
        this.ui.parent.emit('select-propagate', [ this.ui._value ], this.ui._hasChildren);
        this.ui.class.remove('hover');
    } else {
        this.ui.parent.emit('over', [ this.ui._value ]);
    }
};

MenuItem.prototype._onTouchEnd = function(evt) {
    if (! this.ui.parent || this.ui.disabled)
        return;

    evt.preventDefault();
    evt.stopPropagation();
};

MenuItem.prototype._onSelectPropagate = function(path, selectedItemHasChildren) {
    if (! this.parent)
        return;

    path.splice(0, 0, this._value);

    this.parent.emit('select-propagate', path, selectedItemHasChildren);

    if (!this._clickableSubmenus || !selectedItemHasChildren) {
        this.class.remove('hover');
    }
};

MenuItem.prototype._onAppend = function(item) {
    var self = this;

    this._container = true;
    this.class.add('container');

    this._index[item._value] = item;

    item.on('value', function(value, valueOld) {
       delete self._index[this.valueOld];
       self._index[value] = item;
    });
    item.once('destroy', function() {
        delete self._index[this._value];
    });
};


Object.defineProperty(MenuItem.prototype, 'value', {
    get: function() {
        return this._value;
    },
    set: function(value) {
        if (this._value === value)
            return;

        var valueOld = this._value;
        this._value = value;
        this.emit('value', value, valueOld);
    }
});


Object.defineProperty(MenuItem.prototype, 'text', {
    get: function() {
        return this.elementText.textContent;
    },
    set: function(value) {
        if (this.elementText.textContent === value)
            return;

        this.elementText.textContent = value;
    }
});


Object.defineProperty(MenuItem.prototype, 'icon', {
    get: function() {
        return this.elementIcon.textContent;
    },
    set: function(value) {
        if ((! value && ! this.elementIcon) || (this.elementIcon && this.elementIcon.textContent === value))
            return;

        if (! value) {
            this.elementIcon.parentNode.removeChild(this.elementIcon);
            this.elementIcon = null;
        } else {
            if (! this.elementIcon) {
                this.elementIcon = document.createElement('span');
                this.elementIcon.classList.add('icon');
                this.elementTitle.insertBefore(this.elementIcon, this.elementText);
            }

            this.elementIcon.innerHTML = value;
        }
    }
});


window.ui.MenuItem = MenuItem;


/* ui/canvas.js */
"use strict";

function Canvas(args) {
    ui.Element.call(this);
    args = args || { };

    this.element = document.createElement('canvas');
    this._element.classList.add('ui-canvas');

    if (args.id !== undefined)
        this._element.id = args.id;

    if (args.tabindex !== undefined)
        this._element.setAttribute('tabindex', args.tabindex);

    // Disable I-bar cursor on click+drag
    this._element.onselectstart = this.onselectstart;
}
Canvas.prototype = Object.create(ui.Element.prototype);

Canvas.prototype.onselectstart = function() {
    return false;
};

Canvas.prototype.resize = function(width, height) {
    if (this._element.width === width && this._element.height === height)
        return;

    this._element.width = width;
    this._element.height = height;
    this.emit('resize', this._element.width, this._element.height);
};

Object.defineProperty(Canvas.prototype, 'width', {
    get: function() {
        return this._element.width;
    },
    set: function(value) {
        if (this._element.width === value)
            return;

        this._element.width = value;
        this.emit('resize', this._element.width, this._element.height);
    }
});


Object.defineProperty(Canvas.prototype, 'height', {
    get: function() {
        return this._element.height;
    },
    set: function(value) {
        if (this._element.height === value)
            return;

        this._element.height = value;
        this.emit('resize', this._element.width, this._element.height);
    }
});


window.ui.Canvas = Canvas;


/* ui/curve-field.js */
"use strict"

function CurveField(args) {
    var self = this;

    ui.Element.call(this);
    args = args || { };

    this.element = document.createElement('div');
    this._element.classList.add('ui-curve-field');
    this._element.tabIndex = 0;
    this._element.addEventListener('keydown', this._onKeyDown, false);

    // canvas to render mini version of curves
    this.canvas = new ui.Canvas();
    this._element.appendChild(this.canvas.element);
    this.canvas.on('resize', this._render.bind(this));

    this._lineWidth = args.lineWidth || 1;

    // create checkerboard pattern
    this.checkerboardCanvas = new ui.Canvas();
    var size = 17;
    var halfSize = size/2;
    this.checkerboardCanvas.width = size;
    this.checkerboardCanvas.height = size;
    var ctx = this.checkerboardCanvas.element.getContext('2d');
    ctx.fillStyle = '#'
    ctx.fillStyle = "#949a9c";
    ctx.fillRect(0,0,halfSize,halfSize);
    ctx.fillRect(halfSize,halfSize,halfSize,halfSize);
    ctx.fillStyle = "#657375";
    ctx.fillRect(halfSize,0,halfSize,halfSize);
    ctx.fillRect(0,halfSize,halfSize,halfSize);

    this.checkerboard = this.canvas.element.getContext('2d').createPattern(this.checkerboardCanvas.element, 'repeat');

    this._value = null;

    // curve field can contain multiple curves
    this._paths = [];

    this._linkSetHandlers = [];
    this._resizeInterval = null;
    this._suspendEvents = false;

    this._name = args.name;

    this.curveNames = args.curves;

    this.gradient = !!(args.gradient);

    this.min = 0;
    if (args.min !== undefined) {
        this.min = args.min;
    } else if (args.verticalValue !== undefined) {
        this.min = -args.verticalValue;
    }

    this.max = 1;
    if (args.max !== undefined) {
        this.max = args.max;
    } else if (args.verticalValue !== undefined) {
        this.max = args.verticalValue;
    }
}
CurveField.prototype = Object.create(ui.Element.prototype);

CurveField.prototype._onKeyDown = function(evt) {
    // esc
    if (evt.keyCode === 27)
        return this.blur();

    // enter
    if (evt.keyCode !== 32 || this.ui.disabled)
        return;

    evt.stopPropagation();
    evt.preventDefault();
    this.ui.emit('click');
};

CurveField.prototype._resize = function(width, height) {
    var changed = false;
    if (this.canvas.width !== width) {
        this.canvas.width = width;
        changed = true;
    }

    if (this.canvas.height !== height) {
        this.canvas.height = height;
        changed = true;
    }

    if (changed)
        this._render();
};

// Override link method to use multiple paths instead of one
CurveField.prototype.link = function(link, paths) {
    if (this._link) this.unlink();
    this._link = link;
    this._paths = paths;

    this.emit('link', paths);

    // handle canvas resizing
    // 20 times a second
    // if size is already same, nothing will happen
    if (this._resizeInterval)
        clearInterval(this._resizeInterval);

    this._resizeInterval = setInterval(function() {
        var rect = this._element.getBoundingClientRect();
        this.canvas.resize(rect.width, rect.height);
    }.bind(this), 1000 / 20);

    if (this._onLinkChange) {
        var renderChanges = this.renderChanges;
        this.renderChanges = false;
        this._linkSetHandlers.push(this._link.on('*:set', function (path) {
            var paths = this._paths;
            var len = paths.length;
            for (var i = 0; i < len; i++) {
                if (path.indexOf(paths[i]) === 0) {
                    this._onLinkChange();
                    break;
                }
            }
        }.bind(this)));

        this._onLinkChange();

        this.renderChanges = renderChanges;
    }
};

// Override unlink method to use multiple paths instead of one
CurveField.prototype.unlink = function() {
    if (! this._link) return;

    this.emit('unlink', this._paths);

    this._linkSetHandlers.forEach(function (handler) {
        handler.unbind();
    });

    this._linkSetHandlers.length = 0;

    clearInterval(this._resizeInterval);

    this._link = null;
    this._value = null;
    this._paths.length = 0;
};


CurveField.prototype._onLinkChange = function () {
    if (this._suspendEvents) return;

    // gather values of all paths and set new value
    var values = [];

    for (var i = 0; i < this._paths.length; i++) {
        var value = this._link.get(this._paths[i]);
        if (value !== undefined) {
            values.push(value);
        } else {
            values.push(null);
        }
    }

    this._setValue(values);
};

Object.defineProperty(CurveField.prototype, 'value', {
    get: function() {
        return this._value;
    },
    set: function(value) {
        this._setValue(value);
    }
});

CurveField.prototype._setValue = function (value) {
    this._value = value;
    this._render();
    this.emit('change', value);
};

CurveField.prototype._render = function () {
    if (this.gradient) {
        this._renderGradient();
    } else {
        this._renderCurves();
    }
};

// clamp val between min and max only if it's less / above them but close to them
// this is mostly to allow splines to go over the limit but if they are too close to
// the edge then they will avoid rendering half-height lines
CurveField.prototype._clampEdge = function (val, min, max) {
    if (val < min && val > min - 2) return min;
    if (val > max && val < max + 2) return max;
    return val;
};

// Renders all curves
CurveField.prototype._renderCurves = function () {
    var canvas = this.canvas.element;
    var context = canvas.ctx = canvas.ctx || canvas.getContext('2d');
    var value = this.value;

    // draw background
    context.clearRect(0, 0, canvas.width, canvas.height);

    var curveColors = ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(133, 133, 252)', 'rgb(255, 255, 255)'];
    var fillColors = ['rgba(255, 0, 0, 0.5)', 'rgba(0, 255, 0, 0.5)', 'rgba(133, 133, 252, 0.5)', 'rgba(255, 255, 255, 0.5)'];

    var minMax = this._getMinMaxValues(value);

    // draw curves
    if (value && value[0]) {
        var primaryCurves = this._valueToCurves(value[0]);

        if (! primaryCurves)
            return;

        var secondaryCurves = value[0].betweenCurves && value.length > 1 ? this._valueToCurves(value[1]) : null;

        var minValue = minMax[0];
        var maxValue = minMax[1];

        context.lineWidth = this._lineWidth;

        var height = canvas.height;
        var width = canvas.width;

        // prevent divide by 0
        if (width === 0) {
            return;
        }

        for (var i = 0; i < primaryCurves.length; i++) {
            var val, x;

            context.strokeStyle = curveColors[i];
            context.fillStyle = fillColors[i];

            context.beginPath();
            context.moveTo(0, this._clampEdge(height * (1 - (primaryCurves[i].value(0) - minValue) / (maxValue - minValue)), 1, height - 1));

            var precision = 1;

            for(x = 0; x < Math.floor(canvas.width / precision); x++) {
                val = primaryCurves[i].value(x * precision / canvas.width);
                context.lineTo(x * precision, this._clampEdge(height * (1 - (val - minValue) / (maxValue - minValue)), 1, height - 1));
            }

            if (secondaryCurves) {
                for(x = Math.floor(canvas.width / precision) ; x >= 0; x--) {
                    val = secondaryCurves[i].value(x * precision / canvas.width);
                    context.lineTo(x * precision, this._clampEdge(height * (1 - (val - minValue) / (maxValue - minValue)), 1, height - 1));
                }

                context.closePath();
                context.fill();
            }

            context.stroke();
        }
    }
};

// Renders color-type graph as a gradient
CurveField.prototype._renderGradient = function () {
    var canvas = this.canvas.element;
    var context = canvas.ctx = canvas.cxt || canvas.getContext('2d');
    var value = this.value && this.value.length ? this.value[0] : null;

    context.fillStyle = this.checkerboard;
    context.fillRect(0, 0, canvas.width, canvas.height);

    var swizzle = [0, 1, 2, 3];
    if (this.curveNames && this.curveNames.length === 1) {
        if (this.curveNames[0] === 'g') {
            swizzle = [1, 0, 2, 3];
        } else if (this.curveNames[0] === 'b') {
            swizzle = [2, 1, 0, 3];
        } else if (this.curveNames[0] === 'a') {
            swizzle = [3, 1, 2, 0];
        }
    }


    if (value && value.keys && value.keys.length) {
        var rgb = [];

        var curve = this.curveNames && this.curveNames.length === 1 ? new pc.CurveSet([value.keys]) : new pc.CurveSet(value.keys);
        curve.type = value.type;

        var precision = 2;

        var gradient = context.createLinearGradient(0, 0, canvas.width, 0);

        for (var t = precision; t < canvas.width; t += precision) {
            curve.value(t / canvas.width, rgb);

            var rgba = Math.round((rgb[swizzle[0]] || 0) * 255) + ',' +
                       Math.round((rgb[swizzle[1]] || 0) * 255) + ',' +
                       Math.round((rgb[swizzle[2]] || 0) * 255) + ',' +
                       (isNaN(rgb[swizzle[3]]) ? 1 : rgb[swizzle[3]]);

            gradient.addColorStop(t / canvas.width, 'rgba(' + rgba + ')');
        }

        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

    } else {
        // no keys in the curve so just render black color
        context.fillStyle = 'black';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
},

// Returns minimum and maximum values for all curves
CurveField.prototype._getMinMaxValues = function (curves) {
    var minValue = Infinity;
    var maxValue = -Infinity;
    var i, len;

    if (curves) {
        if (curves.length === undefined) {
            curves = [curves];
        }

        curves.forEach(function (value) {
            if (value && value.keys && value.keys.length) {
                if (value.keys[0].length !== undefined) {
                    value.keys.forEach(function (data) {

                        for (i = 1, len = data.length; i < len; i += 2) {
                            if (data[i] > maxValue) {
                                maxValue = data[i];
                            }

                            if (data[i] < minValue) {
                                minValue = data[i];
                            }
                        }
                    });
                } else {
                    for (i = 1, len = value.keys.length; i < len; i += 2) {
                        if (value.keys[i] > maxValue) {
                            maxValue = value.keys[i];
                        }

                        if (value.keys[i] < minValue) {
                            minValue = value.keys[i];
                        }
                    }
                }
            }
        });
    }

    if (minValue === Infinity) {
        minValue = this.min;
    }

    if (maxValue === -Infinity) {
        maxValue = this.max;
    }

    // try to limit minValue and maxValue
    // between the min / max values for the curve field
    if (minValue > this.min) {
        minValue = this.min;
    }

    if (maxValue < this.max) {
        maxValue = this.max;
    }

    return [minValue, maxValue];
};

CurveField.prototype._valueToCurves = function (value) {
    var curves = null;

    if (value && value.keys && value.keys.length) {
        curves = [];
        var curve;
        if (value.keys[0].length !== undefined) {
            value.keys.forEach(function (data, index) {
                curve = new pc.Curve(data);
                curve.type = value.type;
                curves.push(curve);
            });
        } else {
            curve = new pc.Curve(value.keys);
            curve.type = value.type;
            curves.push(curve);
        }
    }

    return curves;
},

window.ui.CurveField = CurveField;


/* ui/autocomplete-element.js */
"use strict";

function AutoCompleteElement() {
    ui.Element.call(this);

    this.element = document.createElement('div');
    this._element.classList.add('ui-autocomplete', 'hidden');

    this._inputField = null;
    this._inputFieldPosition = null;

    this.innerElement = document.createElement('ul');
    this._element.appendChild(this.innerElement);

    // list of strings to show in the dropdown
    this._items = null;

    // child li elements
    this._childElements = null;

    // elements that are currently shown
    this._visibleElements = null;

    this._highlightedElement = null;

    this._filter = '';
}

AutoCompleteElement.prototype = Object.create(ui.Element.prototype);

// Get / Set list of strings to show in the dropdown
Object.defineProperty(AutoCompleteElement.prototype, 'items', {
    get: function () {
        return this._items;
    },

    set: function (value) {
        // delete existing elements
        if (this._childElements) {
            this._childElements.forEach(function (element) {
                element.parentElement.removeChild(element);
            });

            this._childElements = null;
            this._highlight(null);
        }

        this._items = value;

        if (value) {
            // sort items
            this._items.sort();

            // create new li elements for each string
            this._childElements = [];
            this._visibleElements = [];
            value.forEach(function (item) {
                var element = document.createElement('li');
                element.innerHTML = item;
                this._childElements.push(element);
                this._visibleElements.push(element);
                this.innerElement.appendChild(element);

                // click
                element.addEventListener('mousedown', function (e) {
                    e.preventDefault(); // prevent blur
                    this._select(element);
                }.bind(this), true);

                // hover
                element.addEventListener('mouseover', function () {
                    this._highlight(element, true);
                }.bind(this));

            }.bind(this));
        }
    }
});

// True if the autocomplete is visible and has a highlighted element
Object.defineProperty(AutoCompleteElement.prototype, 'isFocused', {
    get: function () {
        return !this.hidden && this._highlightedElement;
    }
});

// Attach the autocomplete element to an input field
AutoCompleteElement.prototype.attach = function (inputField) {
    this._inputField = inputField;

    // set 'relative' position
    this._inputFieldPosition = inputField.style.position;
    inputField.style.position = 'relative';
    inputField.element.appendChild(this.element);

    // fire 'change' on every keystroke
    inputField.keyChange = true;

    // add event handlers
    inputField.element.addEventListener('keydown', this.onInputKey.bind(this));
    inputField.element.addEventListener('blur', this.onInputBlur.bind(this));
    inputField.elementInput.addEventListener('blur', this.onInputBlur.bind(this));
    inputField.on('change', this.onInputChange.bind(this));
};

// Detach event handlers and clear the attached input field
AutoCompleteElement.prototype.detach = function () {
    if (!this._inputField) return;

    this._inputField.style.position = this._inputFieldPosition;
    this._inputField.element.removeChild(this.element);

    this._inputField.off('change', this.onInputChange.bind(this));
    this._inputField.element.removeEventListener('keydown', this.onInputKey.bind(this));
    this._inputField.elementInput.removeEventListener('blur', this.onInputBlur.bind(this));

    this._inputField = null;
};

AutoCompleteElement.prototype.onInputKey = function (e) {
    var index;

    // enter: select highlighted element
    if (e.keyCode === 13) {
        if (!this.hidden && this._highlightedElement) {
            this._select(this._highlightedElement);
        }
    }
    // up: show dropdown or move highlight up
    else if (e.keyCode === 38) {
        if (this.hidden) {
            this.filter(this._inputField.value);
        } else {
            if (this._highlightedElement) {
                index = this._visibleElements.indexOf(this._highlightedElement) - 1;
                if (index < 0) {
                    index = this._visibleElements.length - 1;
                }
            } else {
                index = this._visibleElements.length - 1;
            }

            this._highlight(this._visibleElements[index]);
        }
    }
    // down: show dropdown or move highlight down
    else if (e.keyCode === 40 ) {

        if (this.hidden) {
            this.filter(this._inputField.value);
        } else {
            if (this._highlightedElement) {
            index = this._visibleElements.indexOf(this._highlightedElement) + 1;
                if (index >= this._visibleElements.length) {
                    index = 0;
                }
            } else {
                index = 0;
            }

            this._highlight(this._visibleElements[index]);
        }
    }
};

AutoCompleteElement.prototype.onInputBlur = function () {
    return;
    // hide the dropdown in a timeout
    // to avoid conflicts with key handlers
    setTimeout(function () {
        this.hidden = true;
    }.bind(this), 50);
};

AutoCompleteElement.prototype.onInputChange = function (value) {
    // filter based on new input field value
    if (value !== this._filter) {
        this.filter(value);
    }
};

// Only show elements that start with the specified value
AutoCompleteElement.prototype.filter = function (value) {
    if (!this._childElements) return;

    this.hidden = false;

    this._filter = value;

    this._visibleElements = [];

    value = value.toLowerCase();

    this._childElements.forEach(function (element, i) {
        if (value && element.innerHTML.toLowerCase().indexOf(value) === 0) {
            element.classList.remove('hidden');
            this._visibleElements.push(element);
        } else {
            element.classList.add('hidden');
            if (element === this._highlightedElement)
                this._highlight(null);
        }
    }.bind(this));
};

// Highlight specified element
AutoCompleteElement.prototype._highlight = function (element, silent) {
    // unhighlight previous element
    if (this._highlightedElement === element) return;

    if (this._highlightedElement)
        this._highlightedElement.classList.remove('selected');

    this._highlightedElement = element;

    if (element) {
        element.classList.add('selected');

        if (! silent) {
            this.emit('highlight', element.innerHTML);
        }
    }
};

// Select specified element
AutoCompleteElement.prototype._select = function (element) {
    if (this._inputField) {
        this._inputField.value = element.innerHTML;
        this._inputField.elementInput.focus();
    }

    this.emit('select', element.innerHTML);

    // hide in a timeout to avoid conflicts with key handlers
    setTimeout(function () {
        this.hidden = true;
    }.bind(this));
};

window.ui.AutoCompleteElement = AutoCompleteElement;


/* ui/bubble.js */
"use strict";

function Bubble(args) {
    ui.Element.call(this);
    args = args || { };

    this.element = document.createElement('div');
    this._element.classList.add('ui-bubble');

    var pulseCircle = document.createElement('div');
    pulseCircle.classList.add('pulse');
    this._element.appendChild(pulseCircle);

    var centerCircle = document.createElement('div');
    centerCircle.classList.add('center');
    this._element.appendChild(centerCircle);

    this.on('click', this._onClick);

    if (args.id !== undefined)
        this._element.id = args.id;

    if (args.tabindex !== undefined)
        this._element.setAttribute('tabindex', args.tabindex);
}
Bubble.prototype = Object.create(ui.Element.prototype);

Bubble.prototype._onClick = function() {
    if (this.class.contains('active')) {
        this.deactivate();
    } else {
        this.activate();
    }
};

Bubble.prototype.activate = function () {
    this.class.add('active');
    this.emit('activate');
};

Bubble.prototype.deactivate = function () {
    this.class.remove('active');
    this.emit('deactivate');
};

Bubble.prototype.position = function (x, y) {
    var rect = this._element.getBoundingClientRect();

    var left = (x || 0);
    var top = (y || 0);

    this._element.style.left = (typeof left === 'number') ? left + 'px' : left;
    this._element.style.top = (typeof top === 'number') ? top + 'px' : top;
};

window.ui.Bubble = Bubble;