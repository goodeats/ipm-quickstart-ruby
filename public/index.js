$(function() {
  // Get handle to the chat div
  var $chatWindow = $('#init-messages');
  var chatWindows = {'messages': $chatWindow,
                        'inbox': $('#inbox-messages'),
                         'team': $('#team-messages')}; // stores active channel for each activeWindow
  var header = $('.nav-header');
  var windowHeader = $('.nav-channel-title');
  var activeWindow = $('#messages-container');
  var activeSidebar = $('#messages-sidebar');

  // Manages the state of our access token we got from the server
  var accessManager;

  // Our interface to the IP Messaging service
  var messagingClient;

  // A handle to the "general" chat channel - the one and only channel we
  // will have in this sample app
  var myChannel; // current channel
  var myChannels = {}; // stores all channels by uniqueName as key
  var channelsToLeave = {}; // stores all channels by uniqueName as key
  var storedButtons = {}; // stores all buttons by uniqueName as key
  var storedMessageBoards = {}; // stores all message boards by uniqueName as key
  var newChannel = false;
  var newChannelMessages = [];
  var conciergeLogin = false;

  // The server will assign the client a random username - store that value
  // here
  var username;
  $('.login').on('click', function(){
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
    var $user = $('<span class="username">').text(fromUser + ':');

    if (fromUser === username) {
      $user.addClass('me');
    }
    var $message = $('<span class="message">').text(message);
    var $timestamp = $('<span class="timestamp">').text(timestamp);
    var $container = $('<div class="message-container">');
    $container.append($user).append($message).append($timestamp);
    if (target){
      target.append($container);
      target.scrollTop(target[0].scrollHeight);
    } else {
      $chatWindow.append($container);
      $chatWindow.scrollTop($chatWindow[0].scrollHeight);
    }
  }

  function initTwilio(){
    // Alert the user they have been assigned a random username
    $('.login').remove();
    $('#wrapper').show();
    windowHeader.text('Logging in...');

    // Get an access token for the current user, passing a username (identity)
    // and a device ID - for browser-based apps, we'll always just use the
    // value "browser"
    $.getJSON('/token', {
      identity: username,
      device: 'browser'
    }, function(data) {
      // testing localhost needs token generated here:
      // https://www.twilio.com/user/account/ip-messaging/dev-tools/testing-tools
      data.token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmLTE0NTM2MDU3ODAiLCJpc3MiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmIiwic3ViIjoiQUM1NmE0OTZhNjhlYTA1NjZkZGY1MTU4YjRlNzM3ZDI3ZiIsImV4cCI6MTQ1MzYwOTM4MCwiZ3JhbnRzIjp7ImlkZW50aXR5IjoicGF0IiwiaXBfbWVzc2FnaW5nIjp7InNlcnZpY2Vfc2lkIjoiSVMwYjIzYzliYWJlYjU0M2U4OTBhMjY5ZjMzOWRlZTQxMCIsImVuZHBvaW50X2lkIjoiaXAtbWVzc2FnaW5nLWRlbW86cGF0OmRlbW8tZGV2aWNlIn19fQ.NPfEf3rPXrN0u_NLHK4Xj6qFvn1Ncv_P-4WEx3Ds8Hw';

      $('.info').remove();
      username = data.identity;
      windowHeader.text('Welcome ' + username + '!');

      // Initialize the IP messaging client
      accessManager = new Twilio.AccessManager(data.token);
      messagingClient = new Twilio.IPMessaging.Client(accessManager);
      init();
    });

    function init(){
      console.log('Initialized');
      prepareInput();
    }

    var canCreateChannel = true;
    function prepareInput(){
      var input = $('#chat-input');
      input.on('keydown', function(e) {
        e.stopImmediatePropagation();
        if (e.keyCode == 13) {
          if (input.val() == 'login'){
            conciergeLogin = true;
            input.unbind(); // take off login or new channel
            navListener();
            getAllChannels();
          } else {
            var uniqueName = 'newchat-' + Date.now().toString(); // TODO: add merchant name
            var friendlyName = input.val();
            newChannelMessages.push(input.val());
            if (canCreateChannel){
              canCreateChannel = false;
              findOrCreateChannel(uniqueName, friendlyName);
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
          channelsToLeave[channel.uniqueName] = channel;
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
        leaveInboxChannel(channel);
      });
    }

    function leaveInboxChannel(channel){
      var ch = channelsToLeave[channel.uniqueName];
      if (ch){
        console.log('gonna leave new channel now');
        leaveChannel(ch);
      }
    }

    function navListener(){
      var sidebarNavButton = $('.sidebar-nav-button');
      sidebarNavButton.on('click', function(e){
        if (!$(this).hasClass('active')){
          // toggle nav buttons
          $('.sidebar-nav-button.active').toggleClass('active');
          $(this).toggleClass('active');

          // find target navs
          var activeWindowId = $(this).attr('id').replace('sidebar-nav-', '');
          newactiveWindow = $('#' + activeWindowId + '-container');
          newSidebar = $('#' + activeWindowId + '-sidebar');

          activeWindow.toggleClass('active');
          newactiveWindow.toggleClass('active');
          activeSidebar.toggleClass('active');
          newSidebar.toggleClass('active');
          activeWindow = newactiveWindow;
          activeSidebar = newSidebar;

          $chatWindow = activeWindow.find('.messages.active'); // sets new chatWindow
          storeActiveWindowChannel($chatWindow);
        }
      });
    }

    var totalChannels;
    var myChannelsCount = 0;
    var emptyChannelsCount = 0;
    var allChannels;

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

    var index = 0;
    function nextChannel(){
      if (index < allChannels.length){
        var channel = allChannels[index];
        checkIfJoinedChannel(channel);
      }
    }

    function checkIfJoinedChannel(channel){
      var ch = channel;
      index++;
      if (ch.members.size > 1){
        channel.getMembers().then(function(members){
          for (var i = members.length - 1; i >= 0; i--) {
            member = members[i];
            if (member.identity === username){ // TODO: find better method of getting the current user than by name
              myChannels[ch.uniqueName] = ch;
              myChannelsCount++;
              initOrNext();
            }
          }
        });
      } else {
        // TODO: push to unassigned from here
        emptyChannelsCount++;
        initOrNext();
      }
    }

    function initOrNext(){
      console.log('index: ' + index);
      console.log('totalChannels: ' + totalChannels);
      console.log('myChannelsCount: ' + myChannelsCount);
      console.log('emptyChannelsCount: ' + emptyChannelsCount);
      if (index === totalChannels){ // gone through all channels
        if (myChannelsCount === 0){
          console.log('get all channels again');
          getAllChannels();
        } else {
          console.log('gonna init');
          initMyChannels();
        }
      } else {
        nextChannel();
      }
    }

    function initMyChannels(){
      console.log('init my channels');
      for (var channel in myChannels){
        var ch = myChannels[channel];
        getLastChannelMessage(ch); // sort desc
        sidebarChannelMessagesListener(ch); // arrange notifications; unshift
      }
    }

    var channelsToSortByLastUpdate = [];
    function getLastChannelMessage(channel){
      console.log('getting message');
      channel.getMessages(1).then(function(messages) {
        var channelWithLastUpdate = {};
        channelWithLastUpdate.channel = channel;
        if (messages.length > 0){
          channelWithLastUpdate.lastUpdate = messages[0].timestamp;
        } else {
          channelWithLastUpdate.lastUpdate = channel.dateCreated;
        }
        channelsToSortByLastUpdate.push(channelWithLastUpdate);
        sortChannelList();
      });
    }

    function sortChannelList(){
      if (myChannelsCount === channelsToSortByLastUpdate.length){
        channelsToSortByLastUpdate.sort(function(a, b){
          var channelA = a.lastUpdate;
          var channelB = b.lastUpdate;
          return channelA > channelB ? 1 : -1;
        });
        var myChannelsSidebar = $('#messages-sidebar');
        myChannelsSidebar.find('.loading').remove();
        var channelMessageBoard = $('#messages-container');
        for (i = 0; i < channelsToSortByLastUpdate.length; i++){
          var channel = channelsToSortByLastUpdate[i].channel;
          buildChannelButton(channel, myChannelsSidebar);
          buildChannelPage(channel, channelMessageBoard);
        }
        joinExistingChannelListener();
      } else {
        // console.log('myChannels length: ' + myChannelsCount);
        // console.log('channelsToSortByLastUpdate length: ' + channelsToSortByLastUpdate.length);
      }
    }

    function buildChannelButton(channel, sidebar){
      var channelButton = '<div id="join-' + channel.uniqueName + '" class="join">' + channel.friendlyName + '</div>';
      sidebar.prepend(channelButton);
      storedButtons[channel.uniqueName] = $('#join-' + channel.uniqueName);
    }

    function buildChannelPage(channel, messageBoard){
      var newChatWindow = '<div id="' + channel.uniqueName + '-messages" class="messages"></div>';
      messageBoard.prepend(newChatWindow);
      storedMessageBoards[channel.uniqueName] = $('#' + channel.uniqueName + '-messages');
    }

    function sidebarChannelMessagesListener(channel){
      channel.on('messageAdded', function(message, channel) {
        var messageChannel = $('#join-' + message.channel.uniqueName);
        moveToFirst(messageChannel);
        var currentChannel;
        if (typeof(myChannel) != "undefined"){
          currentChannel = $('#join-' + myChannel.uniqueName);
        } else {
          currentChannel = [];
        }
        if (messageChannel[0] != currentChannel[0]){
          messageChannel.addClass('unread-messages');
        }
      });
    }

    function joinExistingChannelListener(){
      var join = $('.join');
      join.on('click', function(e){
        e.stopImmediatePropagation();
        var this_button = $(this);
        if (!this_button.hasClass('active')){
          this_button.addClass('pending');
          this_button.removeClass('unread-messages');
          var uniqueName = this_button.attr('id').replace('join-', '');
          var uniqueChannel = $('#' + uniqueName + '-messages');
          if (uniqueChannel.is(':empty')){
            var friendlyName = this_button.text();
            findOrCreateChannel(uniqueName, friendlyName);
          } else {
            console.log('showing as active');
            showAsActiveChannel(uniqueName);
          }
        }
        $('#chat-input').focus();
      });
    }

    var joinAndInit = false;
    function findOrCreateChannel(uniqueName, friendlyName){
      var promise = messagingClient.getChannelByUniqueName(uniqueName);
      promise.then(function(channel) {
        myChannel = channel;
        if (!myChannel) {
          // If it doesn't exist, let's create it
          console.log('creating a channel');
          messagingClient.createChannel({
            uniqueName: uniqueName,
            friendlyName: friendlyName
          }).then(function(channel) {
            windowHeader.text(channel.friendlyName);
            myChannel = channel;
            myChannels[uniqueName] = channel;
            newChannel = true;
            buildChannelButton(channel, $('#messages-sidebar'));
            buildChannelPage(channel, $('#messages-container'));
            print('Created "' + channel.friendlyName + '" channel', true, storedMessageBoards[channel.uniqueName]);
            storedButtons[channel.uniqueName].addClass('pending');
            joinExistingChannelListener();
            joinChannel(channel);
            $.when(joinAndInit).then(function(){
              joinAndInit = false;
              console.log('gunu init');
              initChannelOptions(channel);
            });
            showAsActiveChannel(channel.uniqueName);
          });
        } else {
          console.log('this channel exists');
          initChannelOptions(channel);
          showAsActiveChannel(channel.uniqueName);
        }
      });
    }

    function initNewChannel(channel){
      buildChannelButton(channel, $('#inbox-sidebar'));
      buildChannelPage(channel, $('#inbox-container'));
      // TODO: wait for message to be added from user
      joinExistingChannelListener();
      joinChannel(channel);
      $.when(joinAndInit).then(function(){
        joinAndInit = false;
        console.log('gunu init');
        initChannelOptions(channel);
      });
    }

    function joinChannel(ch) {
      console.log('joining channel');
      ch.join().then(function(channel) {
        print('Joined ' + channel.friendlyName + ' as <span class="me">' + username + '</span>.', true, storedMessageBoards[channel.uniqueName]);
        joinAndInit = true;
      });
    }

    function showAsActiveChannel(channel){
      myChannel = myChannels[channel];
      // toggle button
      activeSidebar.find('.join.active').toggleClass('active');
      var activate_button = $('#join-' + channel);
      activate_button.toggleClass('pending active');

      // toggle window
      $chatWindow.toggleClass('active');
      var uniqueChannel = storedMessageBoards[myChannel.uniqueName];
      uniqueChannel.toggleClass('active');

      // toggle header
      windowHeader.text(myChannel.friendlyName);

      // set active channel for window
      $chatWindow = uniqueChannel;
      $chatWindow.scrollTop($chatWindow[0].scrollHeight);
      storeActiveWindowChannel($chatWindow);
    }

    function storeActiveWindowChannel(channel){
      var activeWindowId = activeWindow.attr('id').replace('-container', '');
      chatWindows[activeWindowId] = $chatWindow;
    }

    function initChannelOptions(channel){
      console.log('init \'' + channel.friendlyName + '\' channel options');
      sendStoredMessages(channel);
      getChannelMessages(channel);
      messagesListener(channel);
      sendChannelMessage(channel);
      leaveChannelListener(channel);
      deleteChannel(channel);
      memberEventsListener(channel);
    }

    function sendStoredMessages(channel){
      if (newChannel){
        for (i = 0; i < newChannelMessages.length; i++) {
          var message = newChannelMessages[i];
          channel.sendMessage(message);
          // TODO: show face
        }
      }
    }

    function getChannelMessages(channel){
      console.log('getting channel messages, bro');
      channel.getMessages().then(function(messages) {
        var totalMessages = messages.length;
        print('Total Messages: ' + totalMessages, true, storedMessageBoards[channel.uniqueName]);
        for (i=0; i<messages.length; i++) {
          var message = messages[i];
          printMessage(message.author, message.dateUpdated, message.body, storedMessageBoards[channel.uniqueName]);
          // TODO: set message index
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

    function sendChannelMessage(channel){
      var $input = $('#chat-input');
      $input.unbind();
      $input.on('keydown', function(e) {
        e.stopImmediatePropagation();
        if (e.keyCode == 13) {
          channel.sendMessage($input.val());
          $input.val('');
          // TODO: show face
        }
      });
    }

    function leaveChannelListener(channel){
      var leave_button = $('.leave');
      leave_button.show();
      leave_button.on('click', function(e){
        e.preventDefault();
        leaveChannel(channel);
      });
    }

    function leaveChannel(channel){
      channel.leave().then(function(ch){
        console.log('I just left "' + ch.friendlyName + '"');
      });
    }

    function deleteChannel(channel){
      var delete_button = $('.delete');
      delete_button.show();
      delete_button.on('click', function(e){
        e.preventDefault();
        // Delete a previously created Channel
        channel.delete().then(function(channel) {
          console.log("Deleted channel: " + channel.friendlyName);
        });
      });
    }

    function memberEventsListener(channel){
      // Listen for members joining a channel
      channel.on('memberJoined', function(member) {
        print(member.identity + ' has joined the channel.', true, storedMessageBoards[channel.uniqueName]);
      });

      console.log('can leave ' + channel.friendlyName);
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
