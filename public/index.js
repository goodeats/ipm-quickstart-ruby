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
  function print(infoMessage, asHtml) {
    var $msg = $('<div class="info">');
    if (asHtml) {
      $msg.html(infoMessage);
    } else {
      $msg.text(infoMessage);
    }
    $chatWindow.append($msg);
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
      data.token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmLTE0NTMzNTM4MTMiLCJpc3MiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmIiwic3ViIjoiQUM1NmE0OTZhNjhlYTA1NjZkZGY1MTU4YjRlNzM3ZDI3ZiIsImV4cCI6MTQ1MzM1NzQxMywiZ3JhbnRzIjp7ImlkZW50aXR5IjoicGF0IiwiaXBfbWVzc2FnaW5nIjp7InNlcnZpY2Vfc2lkIjoiSVMwYjIzYzliYWJlYjU0M2U4OTBhMjY5ZjMzOWRlZTQxMCIsImVuZHBvaW50X2lkIjoiaXAtbWVzc2FnaW5nLWRlbW86cGF0OmRlbW8tZGV2aWNlIn19fQ.-NDwesOp6_rW33hWCI3l7NmuVRUIGq0kq_P_BUNzGVE';

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
      channelEventsListener();
      navListener();
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
            input.unbind();
            getAllChannels();
          } else {
            var uniqueName = 'newchat-' + Date.now().toString();
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
    var channelCount = 0;
    var myChannelsCount = 0;
    function getAllChannels(){
      messagingClient.getChannels().then(function(channels) {
        $('#sidebar-nav').addClass('active');
        $('#messages-sidebar').append('<p class="loading">Loading...</p>');
        totalChannels = channels.length;
        for (i = 0; i < channels.length; i++){
          var channel = channels[i];
          getMyChannel(channel);
        }
      });
    }

    function getMyChannel(channel){
      var ch = channel;
      channel.getMembers().then(function(members){
        // TODO: push unassigned from here
        channelCount++;
        for (var i = 0; i < members.length; i++) {
          member = members[i];
          if (member.identity === username){ // TODO: find better method of getting the current user
            console.log('~~~~~~~~~I\'m a member of: ' + ch.friendlyName);
            myChannels[ch.uniqueName] = ch;
            myChannelsCount++;
            console.log('channelCount: ' + channelCount);
            console.log('totalChannels: ' + totalChannels);
            console.log('myChannelsCount: ' + myChannelsCount);
            if (channelCount === totalChannels){ // gone through all channels
              initMyChannels();
            }
          }
        }
      });
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
        console.log('myChannels length: ' + myChannelsCount);
        console.log('channelsToSortByLastUpdate length: ' + channelsToSortByLastUpdate.length);
      }
    }

    function buildChannelButton(channel, sidebar){
      var channelButton = '<div id="join-' + channel.uniqueName + '" class="join">' + channel.friendlyName + '</div>';
      sidebar.prepend(channelButton);
    }

    function buildChannelPage(channel, messageBoard){
      var newChatWindow = '<div id="' + channel.uniqueName + '-messages" class="messages"></div>';
      messageBoard.prepend(newChatWindow);
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
            showAsActiveChannel(uniqueName);
          }
        }
      });
    }

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
            print('Created "' + channel.friendlyName + '" channel', true);
            myChannel = channel;
            myChannels[uniqueName] = channel;
            newChannel = true;
            buildChannelButton(channel, $('#messages-sidebar'));
            buildChannelPage(channel, $('#messages-container'));
            $('#join-' + channel.uniqueName).addClass('pending');
            joinExistingChannelListener();
            joinChannel();
            showAsActiveChannel(channel.uniqueName);
          });
        } else {
          console.log('this channel exists');
          myChannels[uniqueName] = channel;
          joinChannel();
          showAsActiveChannel(channel.uniqueName);
        }
      });
    }

    function initNewChannel(channel){
      buildChannelButton(channel, $('#inbox-sidebar'));
      buildChannelPage(channel, $('#inbox-container'));
      // TODO: wait for message to be added from user
      waitForNewChannelMessage(channel); // belsito
      // getAllChannelMessages(channel, $('#' + channel.uniqueName));
    }

    function waitForNewChannelMessage(channel){
      debugger
      // got the channel, added the button and page
      // this may have been asking for channel messages before the users array pushed them in
      // channel listener could push
      channel.on('messageAdded', function(message){
        console.log(message.body);
        debugger
      });
    }

    function getAllChannelMessages(channel){
      debugger
      channel.getMessages(99999).then(function(messages) {
        debugger
      });
    }

    function joinChannel() {
      myChannel.join().then(function(channel) {
        print('Joined ' + channel.friendlyName + ' as <span class="me">' + username + '</span>.', true);
        initChannelOptions();
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
      var uniqueChannel = $('#' + channel + '-messages');
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

    function initChannelOptions(){
      console.log('init \'' + myChannel.friendlyName + '\' channel options');
      sendStoredMessages();
      getChannelMessages();
      sendChannelMessage();
      inviteToChannel();
      leaveChannel();
      deleteChannel();
      memberEventsListener();
    }

    function sendStoredMessages(){
      if (newChannel){
        for (i = 0; i < newChannelMessages.length; i++) {
          var message = newChannelMessages[i];
          myChannel.sendMessage(message);
          // TODO: show face
        }
      }
    }

    function getChannelMessages(){
      myChannel.getMessages().then(function(messages) {
        var totalMessages = messages.length;
        print('Total Messages: ' + totalMessages, true);
        for (i=0; i<messages.length; i++) {
          var message = messages[i];
          printMessage(message.author, message.dateUpdated, message.body);
          // TODO: set message index
        }
        messagesListener(myChannel);
      });
    }

    function messagesListener(channel, target){
      channel.on('messageAdded', function(message, channel) {
        var messageChannel = $('#' + message.channel.uniqueName + '-messages');
        printMessage(message.author, message.dateUpdated, message.body, messageChannel);
      });
    }

    function moveToFirst(item){
      item.parent().prepend(item);
    }

    function sendChannelMessage(){
      var $input = $('#chat-input');
      $input.unbind();
      $input.on('keydown', function(e) {
        e.stopImmediatePropagation();
        if (e.keyCode == 13) {
          myChannel.sendMessage($input.val());
          $input.val('');
          // TODO: show face
        }
      });
    }

    function inviteToChannel(){
      var invite_button = $('.invite');
      invite_button.show();
      invite_button.on('click', function(e){
        e.preventDefault();
        // Invite another member to your channel
        var $input = $('#chat-input');
        myChannel.invite($input.val()).then(function(member) {
          console.log('Your friend "' + member.identity + '" has been invited!');
        });
        $input.val('');
      });
    }

    function leaveChannel(){
      var leave_button = $('.leave');
      leave_button.show();
      leave_button.on('click', function(e){
        e.preventDefault();
        console.log('I want to leave');
        myChannel.leave();
      });
    }

    function deleteChannel(){
      var delete_button = $('.delete');
      delete_button.show();
      delete_button.on('click', function(e){
        e.preventDefault();
        // Delete a previously created Channel
        myChannel.delete().then(function(channel) {
          console.log("Deleted channel: " + channel.friendlyName);
        });
      });
    }

    function memberEventsListener(){
      // Listen for members joining a channel
      myChannel.on('memberJoined', function(member, messages) {
        print(member.identity + ' has joined the channel.', true);
        for (i=0; i<messages.length; i++) {
          var message = messages[i];
          console.log('Author:' + message.author);
          printMessage(member.identity + 'has joined the channel.', member.lastConsumptionTimestamp, message.body);
        }
      });
      // Listen for members joining a channel
      myChannel.on('memberLeft', function(member) {
        print(member.identity + ' has left the channel.', true);
      });
      // Listen for members typing
      myChannel.on('typingStarted', function(member) {
        print(member.identity + ' is currently typing.', true);
      });
      // Listen for members typing
      myChannel.on('typingEnded', function(member) {
        print(member.identity + ' has stopped typing.', true);
      });
    }

  }

});
