$(function() {

  $('.sign-in').on('click', function(){
    console.log('clicked');
    var signInForm = '<div class="sign-in-form-container">' +
                '<form class="form-signin" role="form">' +
                  '<span class="form-signin-heading">Please sign in</span>' +
                  '<input type="text" name="username" class="form-control" placeholder="Username" required="" autofocus="">' +
                  '<input type="password" name="password" class="form-control" placeholder="Password" required="">' +
                  '<button class="btn btn-lg btn-primary btn-block" type="submit">Sign in</button>' +
                '</form>' +
              '</div>';
    $('#content').append(signInForm);
    $('.form-control[name="username"]').focus();
    Parse.$ = jQuery;
    Parse.initialize('7fpaRtSWYuBFyScLuM6bdQlABI0Eocovo48qKhKc',
                     'tcSFVd5sEeqr3gy8hD7MxEqjiFgXSqDR1RFr3RkJ');
    initParseLogin();
  });

  function initParseLogin(){
    $('.form-signin').on('submit', function(e){
      e.preventDefault();
      // debugger
      var data = $(this).serializeArray(),
      username = data[0].value,
      password = data[1].value;
      console.log('wat');
      Parse.User.logIn(username, password, {
        success: function(user) {
          console.log('Welcome!');
          $('.sign-in-form-container').remove();
          $('.sign-in').remove();
          $('#content-footer').append('<span>Powered by OpenCity</span>');
        },
        error: function(user, error) {
          console.log(error);
        }
      });
    });

    $('.sign-in-form-container').on('mouseup.modal', function(e){
      var container = $('.form-signin');
      if (!container.is(e.target) && container.has(e.target).length === 0){
        console.log('clicked outside');
        var signInForm = $(this).remove();
        $(document).off('keyup.modal mouseup.modal');
      }
    });

    $(document).on('keyup.modal', function(e){
      if (e.keyCode == 27){ // esc key closes modal
        $(document).off('keyup.modal mouseup.modal');
        $('.sign-in-form-container').remove();
      }
    });
  }

  // Get handle to the chat div
  var $chatWindow = $('#messages-messages');
  var chatWindows = {'messages': $chatWindow,
                        'inbox': $('#inbox-messages'),
                         'team': $('#team-messages')}; // stores active channel for each activeNavContainer
  var header = $('.nav-header');
  var windowHeader = $('.nav-header-title');
  var activeNavContainer = $('#messages-container');
  var activeSidebar = $('#messages-sidebar');
  var activeSidebarNav = $('#sidebar-nav-messages');

  // Manages the state of our access token we got from the server
  var accessManager;

  // Our interface to the IP Messaging service
  var messagingClient;

  // A handle to the "general" chat channel - the one and only channel we
  // will have in this sample app
  var myChannel; // current channel
  var myChannels = {}; // stores all channels by uniqueName as key
  var storedButtons = {}; // stores all buttons by uniqueName as key
  var storedMessageBoards = {}; // stores all message boards by uniqueName as key
  var newChannel = false;
  var newChannelMessages = {}; // stores messages sent while the channel is being created
  var conciergeLogin = false;

  // The server will assign the client a random username - store that value
  // here
  var username;
  $('.login').on('click', function(){
    $(this).unbind();
    initTwilio();
  });

  // Helper function to print info messages to the chat window
  function print(infoMessage, asHtml, target) {
    var $msg = $('<div class="info">');
    if (asHtml) {
      $msg.html(infoMessage);
    } else {
      $msg.text(infoMessage);
    }
    if (target){
      target.append($msg);
      target.scrollTop(target[0].scrollHeight);
    } else {
      $chatWindow.append($msg);
      $chatWindow.scrollTop($chatWindow[0].scrollHeight);
    }
  }

  // Helper function to print chat message to the chat window
  function printMessage(fromUser, timestamp, message, target) {
    var $user = $('<span class="username">').text(fromUser);
    $container = $('<div class="message-container">');

    message = formatLinks(message);
    var $message = $('<p class="message">').html(message);

    var date = timestamp.toDateString().slice(0, -5);
    // var time = timestamp.toTimeString().substr(0, 5);
    var hour = timestamp.getHours();
    var ampm = hour < 12 ? 'AM' : 'PM';
    if (hour == 24){
      hour = 12;
    } else if (hour > 12){
      hour = hour - 12;
    }
    var minute = timestamp.getMinutes();
    if (minute < 10){
      minute = '0' + minute;
    }
    var time = hour + ':' + minute;
    $timestamp = $('<span class="timestamp">').text(date + ', ' + time + ' ' + ampm);

    if (fromUser === username) {
      $user.addClass('me');
      $container.addClass('me');
      $message.addClass('me');
      $timestamp.addClass('me');
    }

    $container.append($user).append($message).append($timestamp);
    if (target){
      target.append($container);
      target.scrollTop(target[0].scrollHeight);
    } else {
      $chatWindow.append($container);
      $chatWindow.scrollTop($chatWindow[0].scrollHeight);
    }
  }

  function formatLinks(text){
    var textArr = text.split(' ');
    for (var i = 0; i < textArr.length; i++){
      var str = textArr[i];
      // if (str.indexOf('.') > -1 && isURL(str)){
      if (str.indexOf('.') > -1 &&
          textArr[i].slice(0,7) === 'http://' ||
          textArr[i].slice(0,8) === 'https://' ||
          textArr[i].slice(0,4) === 'www.'){
        str = '<a href=' + str + ' target="_blank">' + str + '</a>';
      }
    }
    return textArr.join(' ');
  }

  function isURL(url){
    // noticing a lot of erroneous links
    var strRegex = "^((https|http|ftp|rtsp|mms)?://)"
            + "?(([0-9a-z_!~*'().&=+$%-]+: )?[0-9a-z_!~*'().&=+$%-]+@)?" //ftp的user@
            + "(([0-9]{1,3}\.){3}[0-9]{1,3}" // IP形式的URL- 199.194.52.184
            + "|" // 允许IP和DOMAIN（域名）
            + "([0-9a-z_!~*'()-]+\.)*" // 域名- www.
            + "([0-9a-z][0-9a-z-]{0,61})?[0-9a-z]\." // 二级域名
            + "[a-z]{2,6})" // first level domain- .com or .museum
            + "(:[0-9]{1,4})?" // 端口- :80
            + "((/?)|" // a slash isn't required if there is no file name
            + "(/[0-9a-z_!~*'().;?:@&=+$,%#-]+)+/?)$";
     var re=new RegExp(strRegex);
     return re.test(url);
  }

  $('.sm-header.left').on('click', function(e){
    e.preventDefault();
    $(this).removeClass('active');
    $('#sidebar').addClass('active');
    $('#sidebar').removeClass('sm-hide');
    $('#page-wrapper').removeClass('sm-hide');
    var nav = activeSidebar.attr('id').replace('-sidebar', '');
    var header = $('#' + nav + '-messages').attr('name');
    windowHeader.text(header.toUpperCase());
  });

  $('.sm-header.right').on('click', function(e){
    e.preventDefault();
    var login = $('.login');
    login.show();
    reInitLogin(login);
    $('#wrapper').hide(); // show chat window
  });

  function reInitLogin(target){
    target.on('click', function(){
      console.log('reinit\'d');
      $(this).hide();
      $('#wrapper').show();
    });
  }

  function initTwilio(){
    // Alert the user they have been assigned a random username
    $('.login').hide(); // remove widget
    $('#wrapper').show(); // show chat window

    // Get an access token for the current user, passing a username (identity)
    // and a device ID - for browser-based apps, we'll always just use the
    // value "browser"
    $.getJSON('/token', {
      identity: username,
      device: 'browser'
    }, function(data) {
      // testing localhost needs token generated here:
      // https://www.twilio.com/user/account/ip-messaging/dev-tools/testing-tools
      data.token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmLTE0NTQxNzA1MzMiLCJpc3MiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmIiwic3ViIjoiQUM1NmE0OTZhNjhlYTA1NjZkZGY1MTU4YjRlNzM3ZDI3ZiIsImV4cCI6MTQ1NDE3NDEzMywiZ3JhbnRzIjp7ImlkZW50aXR5IjoicGF0IiwiaXBfbWVzc2FnaW5nIjp7InNlcnZpY2Vfc2lkIjoiSVNlYTk0ZDc2MzQ3OTQ0NjZjOTM3MDE5NzcyZDZhYTUyOSIsImVuZHBvaW50X2lkIjoiaXAtbWVzc2FnaW5nLWRlbW86cGF0OmRlbW8tZGV2aWNlIn19fQ.8xE_hdLoRS9KRcxc5_Pr8spLQ4JVZWzdNCQsV6CeEus';

      $('.info').remove();
      username = data.identity;
      // windowHeader.text('Welcome ' + username + '!');

      // Initialize the IP messaging client
      accessManager = new Twilio.AccessManager(data.token);
      messagingClient = new Twilio.IPMessaging.Client(accessManager);
      init();
    });

    function init(){
      console.log('Initialized');
      setTimeout(function(){
        prepareInput();
      }, 3000);
    }

    var canCreateChannel = true;
    function prepareInput(){
      var uniqueName = 'newchat-' + Date.now().toString(); // TODO: add merchant name
      newChannelMessages[uniqueName] = [];
      var input = $('#chat-input');
      input.on('keydown', function(e) {
        e.stopImmediatePropagation();
        if (e.keyCode == 13) {
          if (input.val() == 'login'){
            conciergeLogin = true; // to listen for other channels
            input.unbind(); // take off login or new channel
            navListener();
            getAllChannels();
            $('.subheader').addClass('active');
            $('#sidebar').addClass('active');
            $('#content').addClass('sidebar-active');
            $('#page-wrapper').addClass('logged-in');
          } else {
            var friendlyName = input.val();
            newChannelMessages[uniqueName].push(input.val());
            if (canCreateChannel){
              canCreateChannel = false;
              createChannelAndJoin(uniqueName, friendlyName);
            }
          }
          input.val('');
        }
      });
    }

    function channelEventsListener(){
      // A channel has become visible to the Client
      messagingClient.on('channelAdded', function(channel) {
        if (conciergeLogin){
          myChannels[channel.uniqueName] = channel;
          initNewChannel(channel);
        }
      });
      // A channel is no longer visible to the Client
      messagingClient.on('channelRemoved', function(channel) {
        print('Channel removed: ' + channel.friendlyName, true);
      });
      // A channel's attributes or metadata have changed.
      messagingClient.on('channelUpdated', function(channel) {
        // console.log('Channel updates for ' + channel.friendlyName + ': ' + channel.sid);
      });
    }

    function navListener(){
      var sidebarNavButton = $('.sidebar-nav-button');
      sidebarNavButton.on('click', function(e){
        if (!$(this).hasClass('active')){
          var nav = $(this).attr('id').replace('sidebar-nav-', '');
          showAsActiveNav(nav);
        }
      });
    }

    function showAsActiveNav(nav){
      console.log('showing "' + nav + '" as active');
      newactiveNavContainer = $('#' + nav + '-container'); // new nav container
      newSidebar = $('#' + nav + '-sidebar'); // new nav sidebar
      newSidebarNav = $('#sidebar-nav-' + nav);

      // toggle nav buttons
      activeSidebarNav.toggleClass('active');
      newSidebarNav.toggleClass('active');

      // toggle nav container
      activeNavContainer.toggleClass('active');
      newactiveNavContainer.toggleClass('active');

      // toggle sidebar
      activeSidebar.toggleClass('active');
      newSidebar.toggleClass('active');

      // toggle window header
      showAsActiveWindowHeader(chatWindows[nav].attr('name'));

      activeNavContainer = newactiveNavContainer;
      activeSidebar = newSidebar;
      activeSidebarNav = newSidebarNav;

      $chatWindow = activeNavContainer.find('.message-board.active'); // sets new chatWindow
      storeactiveNavContainerChannel($chatWindow);
    }

    function joinExistingChannelListener(e){
      var join = $('.join');
      join.on('click', function(e){
        e.stopImmediatePropagation();
        var this_button = $(this);
        if (!this_button.hasClass('active') && e.target != $('.leave-channel')){
          this_button.addClass('pending');
          var uniqueName = this_button.attr('id').replace('join-', '');
          var channel = myChannels[uniqueName]; // get the channel by uniqueName
          showAsActiveChannel(channel);
          $('#sidebar').addClass('sm-hide');
          $('.sm-header.left').addClass('active');
          $('#page-wrapper').addClass('sm-hide');
        }
        $('#chat-input').focus(); // be ready to type regardless if already on clicked channel
      });
    }

    function returnToDefaultNavChannel(nav){
      $('#' + nav + '-sidebar').find('.join.active').removeClass('active');
      $('#' + nav + '-container').find('.message-board.active').removeClass('active');
      $('#' + nav + '-messages').addClass('active');
    }

    function showAsActiveChannel(channel){
      console.log('showing "' + channel.friendlyName + '" as active');
      myChannel = myChannels[channel.uniqueName];

      // toggle window
      $chatWindow.removeClass('active');
      var uniqueChannel = storedMessageBoards[myChannel.uniqueName];
      uniqueChannel.addClass('active');

      // toggle button
      var oldActiveButton = activeSidebar.find('.join.active');
      oldActiveButton.removeClass('active');
      oldActiveButton.find('.leave-channel').removeClass('active');
      var newActiveButton = storedButtons[channel.uniqueName];
      newActiveButton.removeClass('pending');
      newActiveButton.addClass('active');
      newActiveButton.removeClass('unread-messages');
      var unreadCount = newActiveButton.find('.join-channel-unread-count');
      unreadCount.removeClass('active');
      unreadCount.text(0);
      var leaveButton = newActiveButton.find('.leave-channel');
      leaveButton.addClass('active');

      // toggle header
      showAsActiveWindowHeader(myChannel);

      // set active channel for window
      $chatWindow = uniqueChannel;
      $chatWindow.scrollTop($chatWindow[0].scrollHeight);
      storeactiveNavContainerChannel($chatWindow);

      // set last index the user has seen
      if (!newChannel){
        var messagesLength = myChannel.messages.length;
        myChannel.updateLastConsumedMessageIndex(messagesLength - 1);
      }
    }

    function showAsActiveWindowHeader(channel){
      if (typeof channel === 'string'){
        windowHeader.text(channel);
      } else {
        windowHeader.text(channel.friendlyName);
      }
    }

    function storeactiveNavContainerChannel(channel){
      var nav = activeNavContainer.attr('id').replace('-container', '');
      chatWindows[nav] = $chatWindow;
    }

    var totalChannels,
    allChannels;

    function getAllChannels(){
      messagingClient.getChannels().then(function(channels) {
        $('#sidebar-nav').addClass('active');
        $('#messages-sidebar').append('<p class="loading">Loading...</p>');
        totalChannels = channels.length;
        allChannels = channels;
        nextChannel(channels);
      });
      channelEventsListener();
    }

    var index = 0,
    joinedChannels = [],
    knownChannels = [],
    otherChannels = [],
    emptyChannels = [],
    joinedChannelsCount = 0,
    knownChannelsCount = 0,
    otherChannelsCount = 0,
    emptyChannelsCount = 0;

    function nextChannel(){
      if (index < totalChannels){
        var channel = allChannels[index];
        newChannelMessages[channel.uniqueName] = [];
        getChannelStatus(channel);
      } else {
        console.log('joinedChannels count: ' + joinedChannelsCount);
        // console.log(joinedChannels);
        sortChannelsByLastMessage(joinedChannels, '#messages-sidebar', '#messages-container');
        console.log('knownChannelsCount count: ' + knownChannelsCount);
        // console.log(knownChannels);
        sortChannelsByLastMessage(knownChannels, '#inbox-sidebar', '#inbox-container');
        console.log('otherChannelsCount count: ' + otherChannelsCount);
        // console.log(otherChannels);
        // sortChannelsByLastMessage(otherChannels, 'otherChannels');
        console.log('emptyChannelsCount count: ' + emptyChannelsCount);
        // console.log(emptyChannels);
        console.log('totalChannels: ' + totalChannels);
        console.log('gonna init');
      }
    }

    function getChannelStatus(channel){
      index++;
      var status = channel.status;
      var msg_length = channel.messages.length;
      console.log(channel.friendlyName + ': ' + msg_length + ' messages, status: ' + status);
      if (status == 'joined'){
        myChannels[channel.uniqueName] = channel;
        joinedChannels.push(channel);
        joinedChannelsCount++;
      } else if (status == 'known'){
        myChannels[channel.uniqueName] = channel;
        knownChannels.push(channel);
        knownChannelsCount++;
      } else {
        otherChannels.push(channel);
        otherChannelsCount++;
        debugger
      }
      nextChannel();
    }

    function sortChannelsByLastMessage(channels, sidebar, messageBoard){
      // TODO: knownchannels don't have messages: join/do this/leave
      channels.sort(function(a, b){
        var al = a.messages.length,
        channelA,
        bl = b.messages.length,
        channelB;
        if (al > 0){
          channelA = a.messages[al-1].timestamp;
        } else {
          console.log(a.friendlyName + ' :*( - a');
          channelA = a.messages.dateCreated;
        }
        if (bl > 0){
          channelB = b.messages[bl-1].timestamp;
        } else {
          console.log(b.friendlyName + ' :*( - b');
          channelB = b.messages.dateCreated;
        }
        return channelA > channelB ? 1 : -1;
      });
      moreIniz(channels, sidebar, messageBoard);
    }

    function moreIniz(channels, sidebar, messageBoard){
      var myChannelsSidebar = $(sidebar);
      myChannelsSidebar.find('.loading').remove();
      var channelMessageBoard = $(messageBoard);
      for (i = 0; i < channels.length; i++){
        var channel = channels[i];
        buildChannelButton(channel, myChannelsSidebar);
        buildChannelPage(channel, channelMessageBoard);
        initChannelOptions(channel);
        getChannelMessages(channel);
        sidebarChannelMessagesListener(channel);
      }
      joinExistingChannelListener();
    }

    function buildChannelButton(channel, sidebar){
      var channelButton = '<div id="join-' + channel.uniqueName + '" class="join" name="' + channel.friendlyName + '">' +
                            '<span class="join-channel-name">' + channel.friendlyName + '</span>' +
                            '<span class="join-channel-unread-count">0</span>' +
                            '<span class="leave-channel"><i class="fa fa-times-circle-o"></i></span>' +
                          '</div>';
      sidebar.prepend(channelButton);
      storedButtons[channel.uniqueName] = $('#join-' + channel.uniqueName);
    }

    function buildChannelPage(channel, messageBoard){
      var newChatWindow = '<div id="' + channel.uniqueName + '-messages" class="message-board" name="' + channel.friendlyName + '"></div>';
      messageBoard.prepend(newChatWindow);
      storedMessageBoards[channel.uniqueName] = $('#' + channel.uniqueName + '-messages');
    }

    function sidebarChannelMessagesListener(channel){
      channel.on('messageAdded', function(message) {
        var channelMessageButton = storedButtons[message.channel.uniqueName];
        var channelMessageBoard = storedMessageBoards[message.channel.uniqueName];
        if (channelMessageBoard.parent()[0] == $('#inbox-container')[0] && message.author == username){
          moveToAnotherNav(channel, 'messages');
          returnToDefaultNavChannel('inbox'); // show inbox init channel
          showAsActiveNav('messages'); // switch nav back to messages
          showAsActiveChannel(channel);
        } else {
          moveToFirst(channelMessageButton);
        }
        var currentChannel;
        if (typeof(myChannel) != "undefined"){
          currentChannel = $('#join-' + myChannel.uniqueName);
        } else {
          currentChannel = [];
        }
        if (channelMessageButton[0] != currentChannel[0]){
          var unreadCount = channelMessageButton.find('.join-channel-unread-count');
          unreadCount.text(parseInt(unreadCount.text()) + 1);
          unreadCount.addClass('active');
          channelMessageButton.addClass('unread-messages');
        } else {
          message.channel.updateLastConsumedMessageIndex(message.index);
        }
      });
    }

    var joinAndInit = {};
    function createChannelAndJoin(uniqueName, friendlyName){
      console.log('creating a channel');
      messagingClient.createChannel({
        uniqueName: uniqueName,
        friendlyName: friendlyName
      }).then(function(channel) {
        console.log('channel created: ' + channel.friendlyName);
        myChannel = channel;
        myChannels[uniqueName] = channel;
        newChannel = true;
        buildChannelButton(channel, $('#messages-sidebar'));
        buildChannelPage(channel, $('#messages-container'));
        print('Created "' + channel.friendlyName + '" channel', true, storedMessageBoards[channel.uniqueName]);
        storedButtons[channel.uniqueName].addClass('pending');
        joinExistingChannelListener();
        joinChannel(channel);
        $.when(channel.status == 'joined').then(function(){
          console.log('gunu init');
          sendStoredMessages(channel);
          initChannelOptions(channel);
          showAsActiveChannel(channel);
        });
      });
    }

    function initNewChannel(channel){
      buildChannelButton(channel, $('#inbox-sidebar'));
      buildChannelPage(channel, $('#inbox-container'));
      joinExistingChannelListener();
      joinThenLeave(channel);
    }

    function joinThenLeave(channel){
      joinChannel(channel);
      $.when(channel.status == 'joined').then(function(){
        console.log('init new ch');
        debugger
        sendStoredMessages(channel);
        initChannelOptions(channel);
        sidebarChannelMessagesListener(channel);
        leaveChannel(channel);
      });
    }

    function joinThenStay(channel){
      console.log('join then stay');
      joinChannel(channel);
      $.when(channel.status === 'joined').then(function(){
        console.log('init new ch, stay');
        debugger
        sendStoredMessages(channel);
        if (channel.status != 'joined'){ // super hacky for channels you leave then want to rejoin
          initChannelOptions(channel);
        }
        sidebarChannelMessagesListener(channel);
      });
    }

    function joinChannel(ch) {
      joinAndInit[ch.uniqueName] = false;
      // if (!joinAndInit[ch.uniqueName]){ // to prevent repeat joins
      //   console.log('joining channel');
        ch.join().then(function(channel) {
          console.log('its done Im in ' + channel.friendlyName);
          print('Joined ' + channel.friendlyName + ' as <span class="me">' + username + '</span>.', true, storedMessageBoards[channel.uniqueName]);
          joinAndInit[channel.uniqueName] = true;
        });
      // }
    }

    function initChannelOptions(channel){
      console.log('init \'' + channel.friendlyName + '\' channel options');
      // sendStoredMessages(channel);
      messagesListener(channel);
      sendChannelMessage();
      leaveChannelListener(channel);
      deleteChannelListener(channel);
      memberEventsListener(channel);
    }

    function sendStoredMessages(channel){
      var messages = newChannelMessages[channel.uniqueName];
      newChannelMessages[channel.uniqueName] = [];
      if (messages && messages.length > 0){
        for (i = 0; i < messages.length; i++) {
          var message = messages[i];
          channel.sendMessage(message);
          // TODO: show face
        }
        messages = [];
      }
    }

    function getChannelMessages(channel){
      console.log('getting channel messages, bro');
      channel.getMessages().then(function(messages) {
        var totalMessages = messages.length;
        for (i=0; i<totalMessages; i++) {
          var message = messages[i];
          printMessage(message.author, message.dateUpdated, message.body, storedMessageBoards[channel.uniqueName]);
        }

        var myLastIndex = channel.lastConsumedMessageIndex;
        var chLastIndex = totalMessages - 1;
        var newUnreadCount;
        if (myLastIndex !== chLastIndex) {
          if (myLastIndex){
            newUnreadCount = chLastIndex - myLastIndex;
          } else {
            newUnreadCount = totalMessages;
          }
          var channelMessageButton = storedButtons[channel.uniqueName];
          var unreadCount = channelMessageButton.find('.join-channel-unread-count');
          unreadCount.text(parseInt(unreadCount.text()) + newUnreadCount);
          unreadCount.addClass('active');
          channelMessageButton.addClass('unread-messages');
        }
      });
    }

    function messagesListener(channel){
      channel.on('messageAdded', function(message) {
        printMessage(message.author, message.dateUpdated, message.body, storedMessageBoards[channel.uniqueName]);
      });
    }

    function moveToFirst(item){
      item.parent().prepend(item);
    }

    function moveToAnotherNav(channel, nav){
      $('#' + nav + '-container').prepend(storedMessageBoards[channel.uniqueName]);
      $('#' + nav + '-sidebar').prepend(storedButtons[channel.uniqueName]);
    }

    function sendChannelMessage(){
      var $input = $('#chat-input');
      $input.unbind();
      $input.on('keydown', function(e) {
        e.stopImmediatePropagation();
        if (e.keyCode == 13) {
          if (myChannel.status === 'joined'){
            myChannel.sendMessage($input.val());
          } else {
            newChannelMessages[myChannel.uniqueName].push($input.val());
            joinThenStay(myChannel);
          }
          $input.val('');
          // TODO: show face
        }
      });
    }

    function leaveChannelListener(channel){
      var leave_button = $('.leave-channel');
      leave_button.on('click', function(e){
        e.stopImmediatePropagation();
        $(this).removeClass('active');
        var uniqueName = $(this).parent().attr('id').replace('join-', '');
        leaveChannel(myChannels[uniqueName]);
      });
    }

    function leaveChannel(channel){
      channel.leave().then(function(ch){
        var firstPass = true;
        if (firstPass){
          firstPass = false;
          joinAndInit[ch.uniqueName] = false;
          console.log('I just left "' + ch.friendlyName + '"');
          ch.removeAllListeners();
          moveToAnotherNav(ch, 'inbox');
          returnToDefaultNavChannel('messages'); // show messages init channel
          returnToDefaultNavChannel('inbox'); // show inbox init channel
          // joinThenLeave(ch);
        }
      });
    }

    function deleteChannelListener(channel){
      var delete_button = $('.delete');
      delete_button.show();
      delete_button.on('click', function(e){
        e.preventDefault();
        channel.delete().then(function(channel) {
          console.log("Deleted channel: " + channel.friendlyName);
        });
      });
    }

    function deleteChannel(channel){
      channel.delete().then(function(ch){
        console.log('I just deleted "' + ch.friendlyName + '"');
      });
    }

    function memberEventsListener(channel){
      // Listen for members joining a channel
      channel.on('memberJoined', function(member) {
        print(member.identity + ' has joined the channel.', true, storedMessageBoards[channel.uniqueName]);
      });

      channel.on('memberLeft', function(member) {
        print(member.identity + ' has left the channel.', true, storedMessageBoards[channel.uniqueName]);
      });
      // Listen for members typing
      channel.on('typingStarted', function(member) {
        print(member.identity + ' is currently typing.', true, storedMessageBoards[channel.uniqueName]);
      });
      // Listen for members typing
      channel.on('typingEnded', function(member) {
        print(member.identity + ' has stopped typing.', true, storedMessageBoards[channel.uniqueName]);
      });
    }

  }

});
