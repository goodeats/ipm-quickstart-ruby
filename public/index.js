$(function() {
  // Get handle to the chat div
  var $chatWindow = $('#init-messages');
  var header = $('.nav-header');
  var windowHeader = $('.nav-channel-title');
  var navWindow = $('#messages-container');

  // Manages the state of our access token we got from the server
  var accessManager;

  // Our interface to the IP Messaging service
  var messagingClient;

  // A handle to the "general" chat channel - the one and only channel we
  // will have in this sample app
  var myChannel;
  var myChannels = {};
  var newChannel = false;
  var newChannelMessages = [];

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
      data.token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmLTE0NTMxMjUyMzIiLCJpc3MiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmIiwic3ViIjoiQUM1NmE0OTZhNjhlYTA1NjZkZGY1MTU4YjRlNzM3ZDI3ZiIsImV4cCI6MTQ1MzEyODgzMiwiZ3JhbnRzIjp7ImlkZW50aXR5IjoicGF0IiwiaXBfbWVzc2FnaW5nIjp7InNlcnZpY2Vfc2lkIjoiSVMwYjIzYzliYWJlYjU0M2U4OTBhMjY5ZjMzOWRlZTQxMCIsImVuZHBvaW50X2lkIjoiaXAtbWVzc2FnaW5nLWRlbW86cGF0OmRlbW8tZGV2aWNlIn19fQ.XiIopGtJ3qQXHCxH-JS21hDUdQbfY_frkp-dWEY2Gh4';

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
      invitesListener();
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
            input.unbind();
            getChannels();
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

    function invitesListener(){
      // Listen for new invitations to your Client
      console.log('will listen for invites');
      messagingClient.on('channelInvited', function(channel) {
        print('Invited to channel ' + channel.friendlyName, true);
        // Join the channel that you were invited to
        // Joins automatically right now
        channel.join();
      });
    }

    function channelEventsListener(){
      // A channel has become visible to the Client
      messagingClient.on('channelAdded', function(channel) {
        print('Channel added: ' + channel.friendlyName, true);
        myChannels[channel.uniqueName] = channel;
        initNewChannel(channel);
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
      sidebarNavButton.on('click', function(){
        var navWindow_id = $(this).attr('id').replace('sidebar-nav-', '') + '-container';
        newNavWindow = $('#' + navWindow_id);
        if (navWindow != newNavWindow){
          navWindow.toggleClass('active');
          newNavWindow.toggleClass('active');
          navWindow = newNavWindow;
        }
      });
    }

    var channelCount;
    var firstTime = true;
    function getChannels(){
      // Get Messages for a previously created channel
      messagingClient.getChannels().then(function(channels) {
        $('#sidebar').append('<p>Loading...</p>');
        channelCount = channels.length;
        for (i = 0; i < channelCount; i++){
          var channel = channels[i];
          myChannels[channel.uniqueName] = channel;
          // TODO: could sort channels here, now aware of how to get them
          prepareChannelForSidebar(channel);
        }
        joinExistingChannelListener();
      });
    }

    function prepareChannelForSidebar(channel){
      channel.join().then(function(channel) {
        $('#sidebar-nav').addClass('active');
        getLastChannelMessage(channel);
        sidebarChannelMessagesListener(channel);
      });
    }

    var channelList = [];
    function getLastChannelMessage(channel){
      channel.getMessages(1).then(function(messages) {
        var channelWithLastUpdate = {};
        channelWithLastUpdate.channel = channel;
        if (messages.length > 0){
          channelWithLastUpdate.lastUpdate = messages[0].timestamp;
        } else {
          channelWithLastUpdate.lastUpdate = channel.dateCreated;
        }
        channelList.push(channelWithLastUpdate);
        sortChannelList();
      });
    }

    function sortChannelList(){
      if (channelCount === channelList.length){
        channelList.sort(function(a, b){
          var channelA = a.lastUpdate;
          var channelB = b.lastUpdate;
          return channelA > channelB ? 1 : -1;
        });
        $('#sidebar p').remove();
        for (i = 0; i < channelList.length; i++){
          var channel = channelList[i].channel;
          var myChannelsSidebar = $('#my-channels-sidebar');
          buildChannelButton(channel, myChannelsSidebar);
          var channelMessageBoard = $('#messages-container');
          buildChannelPage(channel, channelMessageBoard);
        }
      }
    }

    function buildChannelButton(channel, sidebar){
      if ($('#join-' + channel.uniqueName).length === 0){
        var channelButton = '<div id="join-' + channel.uniqueName + '" class="join">' + channel.friendlyName + '</div>';
        sidebar.prepend(channelButton);
        if (newChannel){
          $('#join-' + channel.uniqueName).addClass('pending');
        }
      }
    }

    function buildChannelPage(channel, messageBoard){
      if ($('#' + channel.uniqueName + '-messages').length === 0){
        var newChatWindow = '<div id="' + channel.uniqueName + '-messages" class="messages"></div>';
        messageBoard.prepend(newChatWindow);
      }
      joinExistingChannelListener();
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
      $('.join').on('click', function(e){
        e.stopImmediatePropagation();
        var this_button = $(this);
        this_button.addClass('pending');
        this_button.removeClass('unread-messages');
        var uniqueName = this_button.attr('id').replace('join-', '');
        var friendlyName = this_button.text();
        var uniqueChannel = $('#' + uniqueName + '-messages');
        findOrCreateChannel(uniqueName, friendlyName);
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
            buildChannelButton(channel, $('#my-channels-sidebar')); // TODO: should this be here?
            joinExistingChannelListener();
            joinChannel();
          });
        } else {
          console.log('this channel exists');
          myChannels[uniqueName] = channel;
          joinChannel();
        }
      });
    }

    function initNewChannel(channel){
      appendInvitetoUnassigned(channel);
    }

    function appendInvitetoUnassigned(channel){
      var conciergeAlert = '<div id="view-' + channel.uniqueName + '" class="new-channel">"' + channel.friendlyName + '" has been created.</div>';
      var conciergeMessages = $('#inbox-messages');
      conciergeMessages.append(conciergeAlert);
      newChannelListener();
    }

    function newChannelListener(){

      var newChannelDiv = $('.new-channel');
      newChannelDiv.on('click', function(){
        // TODO: prevent this from appending the same messages over and over again
        var uniqueName = $(this).attr('id').replace('view-', '');
        var channel = myChannels[uniqueName];

        // this is that issue where it won't let you see the messages unless you're joined
        // channel.getMessages().then(function(messages) {
        //   var viewInboxMessages = $('#view-inbox-message');
        //   for (i=0; i<messages.length; i++) {
        //     var message = messages[i];
        //     printMessage(message.author, message.dateUpdated, message.body, viewInboxMessages);
        //   }
        //   $('#inbox-container .other').toggleClass('active');
        //   messagesListener(channel, viewInboxMessages);
        //   prepareInputToJoin(); // create once you can see the message again
        //   closeMessage();
        // });
        myChannel = channel;
        $('#my-channels-sidebar').prepend('<div id="' + channel.uniqueName + '" class="join">' + channel.friendlyName + '</div>');
        joinChannel();

        var newChatWindow = '<div id="' + channel.uniqueName + '-messages" class="messages"></div>';
        $('#messages-container').prepend(newChatWindow);
        joinExistingChannelListener();
        var newNavWindow = $('#messages-container');
        navWindow.toggleClass('active');
        newNavWindow.toggleClass('active');
        navWindow = newNavWindow;
      });
    }

    function closeMessage(){
      var close = $('.close');
      close.on('click', function(e){
        var thisWindow = $(this);
        var parent = thisWindow.parent();
        $('#inbox-container .other').toggleClass('active');
        parent.empty().append(thisWindow);
      });
    }

    function joinChannel() {
      myChannel.join().then(function(channel) {
        showAsActiveChannel(channel.uniqueName);
        print('Joined ' + channel.friendlyName + ' as <span class="me">' + username + '</span>.', true);
        initChannelOptions();
        if (newChannel){
          for (i = 0; i < newChannelMessages.length; i++) {
            var message = newChannelMessages[i];
            myChannel.sendMessage(message);
          }
        }
      });
    }

    function showAsActiveChannel(channel){
      myChannel = myChannels[channel];
      var activate_button = $('#join-' + channel);
      $('.join.active').toggleClass('active');
      activate_button.toggleClass('pending active');
      $chatWindow.toggleClass('active');

      var uniqueChannel = $('#' + channel + '-messages');
      if (uniqueChannel.length === 0){
        var newChatWindow = '<div id="' + channel + '-messages" class="messages active"></div>';
        $('#messages-container').prepend(newChatWindow);
      } else {
        uniqueChannel.toggleClass('active');
      }
      windowHeader.text(myChannel.friendlyName);
      $chatWindow = $('#messages-container .messages.active');
      $chatWindow.scrollTop($chatWindow[0].scrollHeight);
    }

    function initChannelOptions(){
      console.log('init \'' + myChannel.friendlyName + '\' channel options');
      getChannelMessages();
      getChannelMembers();
      sendChannelMessage();
      inviteToChannel();
      leaveChannel();
      deleteChannel();
      memberEventsListener();
    }

    function getChannelMessages(){
      myChannel.getMessages().then(function(messages) {
        var totalMessages = messages.length;
        print('Total Messages: ' + totalMessages, true);
        for (i=0; i<messages.length; i++) {
          var message = messages[i];
          printMessage(message.author, message.dateUpdated, message.body);
        }
        messagesListener(myChannel);
      });
    }

    function messagesListener(channel, target){
      channel.on('messageAdded', function(message, channel) {
        if (target){
          var messageChannel = target;
        } else {
          var messageChannel = $('#' + message.channel.uniqueName + '-messages');
        }
        printMessage(message.author, message.dateUpdated, message.body, messageChannel);
      });
    }

    function getChannelMembers(){
      console.log('getting channel members for ' + myChannel.friendlyName + '!');
      console.log(myChannel.members);
      var channelMembers = myChannel.members;
      for (var i = 0; i < channelMembers.length; i++) {
        member = channelMembers[i];
        console.log(member.friendlyName + ' is here!');
      }
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
        // leave another member to your channel
        myChannel.leave(username).then(function(member) {
          console.log('You (' + member.identity + ') have left!');
        });
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
