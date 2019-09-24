

/* editor/chat/chat-widget.js */
editor.once('load', function() {
  'use strict';

  var root = editor.call('layout.root');
  var viewport = editor.call('layout.viewport');
  var lastMessage = null;

  var panel = new ui.Panel();
  panel.header = 'Chat';
  panel.flexShrink = false;
  panel.foldable = true;
  panel.folded = true;
  panel.class.add('chat-widget');
  panel.hidden = ! editor.call('permissions:read') || editor.call('viewport:expand:state');
  editor.on('permissions:set', function(level) {
      panel.hidden = ! level || editor.call('viewport:expand:state');
  });
  viewport.append(panel);
  editor.method('chat:panel', function() {
      return panel;
  });

  editor.on('viewport:expand', function(state) {
      if (state) {
          panel.class.add('expanded');
      } else {
          panel.class.remove('expanded');
      }
  });

  panel.element.addEventListener('mouseover', function() {
      editor.emit('viewport:hover', false);
  }, false);

  // notification icon
  var notify = new ui.Button({
      text: '&#57751;'
  });
  notify.class.add('notifyToggle');
  panel.headerAppend(notify);

  var tooltipNotify = Tooltip.attach({
      target: notify.element,
      text: 'Notifications (enabled)',
      align: 'bottom',
      root: root
  });

  notify.on('click', function() {
      var permission = editor.call('notify:state');

      if (permission === 'denied') {
          return;
      } else if (permission === 'granted') {
          var granted = editor.call('localStorage:get', 'editor:notifications:chat');
          editor.call('localStorage:set', 'editor:notifications:chat', ! granted);
          editor.emit('chat:notify', ! granted);
      } else {
          editor.call('notify:permission');
      }
  });
  var checkNotificationsState = function() {
      var permission = editor.call('notify:state');

      if (permission === 'denied') {
          tooltipNotify.text = 'Notifications Denied in Browser Settings';
          notify.class.remove('active');
      } else if (permission === 'granted') {
          var granted = editor.call('localStorage:get', 'editor:notifications:chat');
          if (granted === false) {
              tooltipNotify.text = 'Notifications Disabled';
              notify.class.remove('active');
          } else {
              tooltipNotify.text = 'Notifications Enabled';
              notify.class.add('active');
          }
      } else {
          tooltipNotify.text = 'Enable Notifications';
          notify.class.remove('active');
      }
  };
  editor.on('notify:permission', checkNotificationsState);
  editor.on('chat:notify', checkNotificationsState);
  checkNotificationsState();

  // typers
  var typersLast = null;
  var typers = document.createElement('span');
  typers.classList.add('typers');
  panel.headerAppend(typers);

  // typers single
  var typersSingle = document.createElement('span');
  typersSingle.classList.add('single');
  typers.appendChild(typersSingle);

  var typersSingleUser = document.createElement('span');
  typersSingleUser.classList.add('user');
  typersSingle.appendChild(typersSingleUser);

  typersSingle.appendChild(document.createTextNode(' is typing...'));

  // typers double
  var typersDouble = document.createElement('span');
  typersDouble.classList.add('double');
  typers.appendChild(typersDouble);

  var typersDoubleUserA = document.createElement('span');
  typersDoubleUserA.classList.add('user');
  typersDouble.appendChild(typersDoubleUserA);

  typersDouble.appendChild(document.createTextNode(' and '));

  var typersDoubleUserB = document.createElement('span');
  typersDoubleUserB.classList.add('user');
  typersDouble.appendChild(typersDoubleUserB);

  typersDouble.appendChild(document.createTextNode(' are typing...'));

  // typers multiple
  var typersMultiple = document.createElement('span');
  typersMultiple.classList.add('multiple');
  typers.appendChild(typersMultiple);

  var typersMultipleUsers = document.createElement('span');
  typersMultipleUsers.classList.add('user');
  typersMultiple.appendChild(typersMultipleUsers);

  typersMultiple.appendChild(document.createTextNode(' users are typing...'));


  editor.on('chat:typing', function(count, ids) {
      if (count === 0) {
          if (typersLast) typersLast.classList.remove('active');
          typersLast = null;
      } else if (count === 1) {
          if (typersLast) typersLast.classList.remove('active');
          typersLast = typersSingle;
          typersSingle.classList.add('active');
          // user
          var user = editor.call('users:get', ids[0]);
          var color = editor.call('whoisonline:color', user && user.id, 'hex');
          typersSingleUser.textContent = user && user.username || 'user';
          typersSingleUser.style.color = color;
      } else if (count === 2) {
          if (typersLast) typersLast.classList.remove('active');
          typersLast = typersDouble;
          typersDouble.classList.add('active');
          // userA
          var userA = editor.call('users:get', ids[0]);
          var color = editor.call('whoisonline:color', userA && userA.id, 'hex');
          typersDoubleUserA.textContent = userA && userA.username || 'user';
          typersDoubleUserA.style.color = color;
          // userB
          var userB = editor.call('users:get', ids[1]);
          var color = editor.call('whoisonline:color', userB && userB.id, 'hex');
          typersDoubleUserB.textContent = userB && userB.username || 'userB';
          typersDoubleUserB.style.color = color;
      } else {
          if (typersLast) typersLast.classList.remove('active');
          typersLast = typersMultiple;
          typersMultiple.classList.add('active');
          typersMultipleUsers.textContent = count;
      }
  });

  // number
  var messagesNumber = 0;
  var number = document.createElement('span');
  number.classList.add('number');
  number.textContent = '0';
  panel.headerAppend(number);

  editor.method('chat:unreadCount', function() {
      return messagesNumber;
  });

  editor.on('chat:post', function(type, msg, element) {
      if (! panel.folded)
          lastMessage = element;

      if (! panel.folded || type === 'typing')
          return;

      messagesNumber++;
      panel.class.add('notify');
      number.classList.add('notify');

      if (! number.classList.contains('typing'))
          number.textContent = messagesNumber;
  });
  editor.on('chat:typing', function(typing, ids) {
      if (! panel.folded)
          return;

      if (typing) {
          number.textContent = '...';
          number.classList.add('typing');

          if (typing === 1) {
              var color = editor.call('whoisonline:color', ids[0], 'hex');
              number.style.color = color;
          } else {
              number.style.color = '';
          }
      } else {
          number.textContent = messagesNumber;
          number.classList.remove('typing');
          number.style.color = '';
      }
  });
  panel.on('unfold', function() {
      messagesNumber = 0;
      number.textContent = '0';
      number.classList.remove('typing', 'notify');
      panel.class.remove('notify');

      if (messageDivider.parentNode)
          messageDivider.parentNode.removeChild(messageDivider);

      if (lastMessage && lastMessage !== messages.innerElement.lastChild) {
          messages.innerElement.scrollTop = lastMessage.offsetTop;
          messages.appendAfter(messageDivider, lastMessage);

          lastMessage = messages.innerElement.lastChild;
      }

      setTimeout(function() {
          input.elementInput.select();
          input.elementInput.focus();
      }, 200);
  });

  // messages
  var messages = new ui.Panel();
  messages.class.add('messages');
  messages.innerElement.classList.add('selectable');
  messages.scroll = true;
  panel.append(messages);

  messages.innerElement.addEventListener('contextmenu', function(evt) {
      if (evt.target.tagName !== 'A')
          return;

      evt.stopPropagation();
  });

  editor.method('chat:messagesPanel', function() {
      return messages;
  });

  var messageDivider = document.createElement('div');
  messageDivider.classList.add('divider');

  // input
  var typing = false;
  var typingTimeout = null;
  var typingTimeoutDelay = 1000;
  var input = new ui.TextField();
  input.blurOnEnter = false;
  input.keyChange = true;
  input.renderChanges = false;
  input.placeholder = '>';
  panel.append(input);

  editor.method('chat:inputField', function() {
      return input;
  });

  var clear = document.createElement('div');
  clear.innerHTML = '&#57650;';
  clear.classList.add('clear');
  input.element.appendChild(clear);

  clear.addEventListener('click', function() {
      input.value = '';
      onTypingEnd();
  }, false);

  var onTypingEnd = function() {
      if (typingTimeout) {
          clearTimeout(typingTimeout);
          typingTimeout = null;
      }

      if (! typing)
          return;

      typing = false;
      editor.call('chat:typing', false);
  };

  input.on('change', function(value) {
      value = value.trim();

      if (value.length > 1024) {
          input.value = value.slice(0, 1024);
          return;
      }

      if (typingTimeout)
          clearTimeout(typingTimeout);

      typingTimeout = setTimeout(onTypingEnd, typingTimeoutDelay);

      if (value) {
          input.class.add('not-empty');

          if (! typing) {
              typing = true;
              editor.call('chat:typing', true);
          }
      } else {
          input.class.remove('not-empty');
          onTypingEnd();
      }
  });

  input.element.addEventListener('keydown', function(evt) {
      if (evt.keyCode === 27) {
          // esc
          input.value = '';
          onTypingEnd();
      } else if (evt.keyCode === 13) {
          // enter
          editor.call('chat:send', input.value);
          input.value = '';
          onTypingEnd();
      }
  }, false);
});


/* editor/chat/chat-typing.js */
editor.once('load', function() {
  'use strict';

  var typing = 0;
  var typingMessage;
  var users = { };

  editor.on('whoisonline:add', function(id) {
      if (users[id])
          return;

      users[id] = {
          id: id,
          typing: 0,
          username: ''
      };

      editor.call('users:loadOne', id, function (user) {
          if (! users[id])
              return;

          users[id].username = user.username;
      });
  });

  editor.on('whoisonline:remove', function(id) {
      if (! users[id])
          return;

      if (users[id].typing) {
          typing--;
          notifyTypers();
      }

      delete users[id];
  });

  var notifyTypers = function() {
      var typers = [ ];
      for(var id in users) {
          if (! users.hasOwnProperty(id) || ! users[id].typing)
              continue;

          typers.push(id);
      }

      editor.emit('chat:typing', typing, typers, msg);
  };

  editor.method('chat:sync:typing', function(data) {
      if (! users[data.user] || data.user === config.self.id || users[data.user].typing === data.d)
          return;

      users[data.user].typing = data.d;

      if (data.d) {
          typing++;
      } else {
          typing--;
      }

      notifyTypers();
  });

  editor.method('chat:typing', function(state) {
      editor.call('realtime:send', 'chat', {
          t: 'typing',
          d: state ? 1 : 0
      });
  });
});


/* editor/chat/chat-system.js */
editor.once('load', function () {
  'use strict';

  var root = editor.call('layout.root');
  var widget = editor.call('chat:panel');
  var messages = editor.call('chat:messagesPanel');
  var lastUser = null;
  var lastMessage = 0;
  var lastMessageDelay = 60 * 1000;

  var regexUrl = /[a-z]+:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b[-a-zA-Z0-9@:%_\+.~#?&\/=]*/g;
  var regexEmail = /[-a-zA-Z0-9:%._\+~]{1,256}@[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-z]{2,16}/g;

  var stringToElements = function(args) {
      var items = [ ];

      var bits = args.string.match(args.regex);
      if (! bits) return [ args.string ];

      var parts = args.string.split(args.regex);

      for(var i = 0; i < parts.length; i++) {
          items.push(parts[i]);

          if (bits.length > i)
              items.push(args.filter(bits[i]));
      }

      return items;
  };

  var parseMessageFilterLink = function(string) {
      var link = document.createElement('a');
      link.target = '_blank';
      link.href = string;
      link.textContent = string;
      return link;
  };

  var parseMessageFilterEmail = function(string) {
      var link = document.createElement('a');
      link.href = 'mailto:' + string;
      link.textContent = string;
      return link;
  };

  var parseMessage = function(message) {
      var items = stringToElements({
          string: message,
          regex: regexUrl,
          filter: parseMessageFilterLink
      });

      for(var i = 0; i < items.length; i++) {
          if (typeof(items[i]) !== 'string')
              continue;

          var emails = stringToElements({
              string: items[i],
              regex: regexEmail,
              filter: parseMessageFilterEmail
          });

          for(var e = 0; e < emails.length; e++) {
              var item;

              if (typeof(emails[e]) === 'string') {
                  item = document.createTextNode(emails[e]);
              } else {
                  item = emails[e];
              }

              if (e === 0) {
                  items[i] = item;
              } else {
                  items.splice(i + 1, 0, item);
                  i++;
              }
          }
      }

      return items;
  };

  editor.on('whoisonline:remove', function(id) {
      if (lastUser === id) {
          lastUser = null;
          lastMessage = 0;
      }
  });

  editor.method('chat:post', function(type, string) {
      if (type !== 'system' && typeof(type) !== 'number')
          return;

      var element = document.createElement('div');
      element.classList.add('selectable');

      var text = element.text = document.createElement('span');
      text.classList.add('selectable');
      element.appendChild(text);

      var message;

      if (type === 'system') {
          lastUser = null;
          lastMessage = 0;
          var date = new Date();
          message = ('00' + date.getHours()).slice(-2) + ':' + ('00' + date.getMinutes()).slice(-2) + ' - ' + string;
          element.classList.add('system');
      } else if (typeof(type) === 'number') {
          element.classList.add('message');
          message = string;

          // if same user posts within 60 seconds,
          // don't add image and username
          if (lastUser !== type || (Date.now() - lastMessage) > lastMessageDelay) {
              var img = document.createElement('img');
              img.classList.add('selectable');
              img.width = 14;
              img.height = 14;
              img.src = '/api/users/' + type + '/thumbnail?size=14';
              element.insertBefore(img, text);

              var date = new Date();

              element.tooltip = Tooltip.attach({
                  target: img,
                  text: ('00' + date.getHours()).slice(-2) + ':' + ('00' + date.getMinutes()).slice(-2),
                  align: 'right',
                  root: root
              });

              var user = editor.call('users:get', type);

              var username = document.createElement('span');
              username.classList.add('username', 'selectable');
              username.textContent = (user ? user.username : '') + ': ';
              if (type !== config.self.id)
                  username.style.color = editor.call('whoisonline:color', user.id, 'hex');
              element.insertBefore(username, text);
          } else {
              element.classList.add('multi');
          }

          lastUser = type;
          lastMessage = Date.now();
      }

      var elements = parseMessage(message);
      var fragment = document.createDocumentFragment();
      for(var i = 0; i < elements.length; i++)
          fragment.appendChild(elements[i]);
      text.appendChild(fragment);

      var scrollDown = ! widget.folded && Math.abs((messages.innerElement.scrollHeight - messages.innerElement.clientHeight) - messages.innerElement.scrollTop) < 4;

      messages.append(element);

      if (scrollDown)
          messages.innerElement.scrollTop = messages.innerElement.scrollHeight - messages.innerElement.clientHeight;

      editor.emit('chat:post', type, message, element);

      return element;
  });

  editor.method('chat:sync:msg', function(data) {
      editor.call('chat:post', data.user, data.d);
  });

  editor.method('chat:send', function(message) {
      message = message.trim();
      if (! message)
          return;

      editor.call('realtime:send', 'chat', {
          t: 'msg',
          d: message
      });
  });
});


/* editor/chat/chat-notifications.js */
editor.once('load', function() {
  'use strict';

  var panel = editor.call('chat:panel');
  var inputField = editor.call('chat:inputField');
  var number = 0;

  editor.on('visibility', function(state) {
      if (state) {
          number = 0;
          editor.call('notify:title', config.project.name + ' | Editor');
      } else {
          number = editor.call('chat:unreadCount');
          if (number) editor.call('notify:title', '(' + number + ') ' + config.project.name + ' | Editor');
      }
  });

  editor.on('chat:post', function(type, msg, element) {
      editor.call('notify:permission');

      var granted = editor.call('localStorage:get', 'editor:notifications:chat');
      var visible = editor.call('visibility');

      if (! visible) {
          number++;
          editor.call('notify:title', '(' + number + ') ' + config.project.name + ' | Editor');
      }

      if (visible || granted === false)
          return;

      var title;
      var icon;
      if (msg.length > 64)
          msg = msg.slice(0, 64) + '...';

      if (type === 'system') {
          title = 'System Message';

      } else if (typeof(type) === 'number') {
          var user = editor.call('users:get', type);
          title = 'Message from ' + (user && ('@' + user.username) || 'a user');
          icon = '/api/users/' + user.id + '/thumbnail?size=128'
      }

      editor.call('notify', {
          title: title,
          body: msg,
          icon: icon,
          click: function() {
              window.focus();
              panel.folded = false;
          }
      });
  });
});