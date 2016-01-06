$(function() {
  // Get handle to the chat div
  var $chatWindow = $('#init_messages');
  var header = $('.nav-header');
  var windowHeader = $('.nav-channel-title');

  var activeChannels = [$('#init_messages')];
  // Manages the state of our access token we got from the server
  var accessManager;

  // Our interface to the IP Messaging service
  var messagingClient;

  // A handle to the "general" chat channel - the one and only channel we
  // will have in this sample app
  var myChannel;

  // The server will assign the client a random username - store that value
  // here
  var username;
  $('.login').on('click', function(){
    // username = $(this).attr('class').replace(' username', '');
    // console.log('username set: ' + username);
    initTwilio();
  });

  // Helper function to print info messages to the chat window
  function print(infoMessage, asHtml, container) {
    var $msg = $('<div class="info">');
    if (asHtml) {
      $msg.html(infoMessage);
    } else {
      $msg.text(infoMessage);
    }
    container.append($msg);
  }

  // Helper function to print chat message to the chat window
  function printMessage(fromUser, message) {
    var $user = $('<span class="username">').text(fromUser + ':');

    if (fromUser === username) {
      $user.addClass('me');
    }
    var $message = $('<span class="message">').text(message);
    var $container = $('<div class="message-container">');
    $container.append($user).append($message);
    $chatWindow.append($container);
    $chatWindow.scrollTop($chatWindow[0].scrollHeight);
  }

  function initTwilio(){
    // Alert the user they have been assigned a random username
    $('.login').remove();
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
      data.token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmLTE0NTIwNTIxMzciLCJpc3MiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmIiwic3ViIjoiQUM1NmE0OTZhNjhlYTA1NjZkZGY1MTU4YjRlNzM3ZDI3ZiIsImV4cCI6MTQ1MjA1NTczNywiZ3JhbnRzIjp7ImlkZW50aXR5IjoicGF0IiwiaXBfbWVzc2FnaW5nIjp7InNlcnZpY2Vfc2lkIjoiSVMwYjIzYzliYWJlYjU0M2U4OTBhMjY5ZjMzOWRlZTQxMCIsImVuZHBvaW50X2lkIjoiaXAtbWVzc2FnaW5nLWRlbW86cGF0OmRlbW8tZGV2aWNlIn19fQ.ZiGK0u_oH_t3Px0t7Q1lh3uKOXFfj6aqzp6yh6ZyYE4';

      $('.info').remove();
      // Alert the user they have been assigned a random username
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
      getChannels();
    }

    function invitesListener(){
      // Listen for new invitations to your Client
      console.log('will listen for invites');
      messagingClient.on('channelInvited', function(channel) {
        print('Invited to channel ' + channel.friendlyName, true, $chatWindow);
        // Join the channel that you were invited to
        // Joins automatically right now
        channel.join();
      });
    }

    function channelEventsListener(){
      // A channel has become visible to the Client
      messagingClient.on('channelAdded', function(channel) {
        print('Channel added: ' + channel.friendlyName, true, $chatWindow);
      });
      // A channel is no longer visible to the Client
      messagingClient.on('channelRemoved', function(channel) {
        print('Channel removed: ' + channel.friendlyName, true, $chatWindow);
      });
      // A channel's attributes or metadata have changed.
      messagingClient.on('channelUpdated', function(channel) {
        // console.log('Channel updates for ' + channel.friendlyName + ': ' + channel.sid);
      });
    }

    var firstTime = true;
    function getChannels(){
      // Get Messages for a previously created channel
      messagingClient.getChannels().then(function(channels) {
        for (i=0; i<channels.length; i++) {
          var channel = channels[i];
          var channelButton = '<button id="' + channel.uniqueName + '" class="join">' + channel.friendlyName + '</button>';
          $('#sidebar').append(channelButton);
        }
        if (firstTime){
          firstTime = false;
          createChannelForm();
          joinExistingChannel();
        } else {
          joinChannel();
        }
      });
    }

    function createChannelForm(){
      var form = '<p>Create a new channel</p><form class="new-channel" onsubmit="return false"></form>';
      var uniqueName = '<input class="uniqueName" type="text" placeholder="create unique name"></input>';
      var friendlyName = '<input class="friendlyName" type="text" placeholder="create friendly name"></input>';
      var submit = '<input type="submit"></input>';
      $('#sidebar').append(form);
      $('.new-channel').append(uniqueName).append(friendlyName).append(submit);
      joinNewChannel();
    }

    function joinExistingChannel(){
      $('.join').on('click', function(){
        var ch = $(this).text();
        console.log('joining: ' + ch);
        var uniqueName = $(this).attr('id');
        var friendlyName = $(this).text();
        findOrCreateChannel(uniqueName, friendlyName);
      });
    }

    function joinNewChannel(){
      $('.new-channel').on('submit', function(e){
        e.preventDefault;
        var uniqueName = $('.uniqueName').val();
        var friendlyName = $('.friendlyName').val();
        console.log('creating a channel');
        findOrCreateChannel(uniqueName, friendlyName);
      });
    }

    function findOrCreateChannel(uniqueName, friendlyName){
      print('Attempting to join "' + uniqueName + '" chat channel...', false, $chatWindow);
      var promise = messagingClient.getChannelByUniqueName(uniqueName);
      promise.then(function(channel) {
        myChannel = channel;

        if (!myChannel) {
          // If it doesn't exist, let's create it
          console.log('this channel doesn\'t exist yet');
          messagingClient.createChannel({
            uniqueName: uniqueName,
            friendlyName: friendlyName
          }).then(function(channel) {
            windowHeader.text(channel.friendlyName);
            print('Created "' + channel.friendlyName + '" channel', true, $chatWindow);
            myChannel = channel;
            getChannels();
          });
        } else {
          $('.info').remove();
          windowHeader.text(channel.friendlyName);
          console.log('this channel: ', myChannel);
          joinChannel();
        }
      });
    }

    function joinChannel() {
      myChannel.join().then(function(channel) {
        print('Joined ' + channel.friendlyName + ' as <span class="me">' + username + '</span>.', true, $chatWindow);
        initChannelOptions();
      });
    }

    function initChannelOptions(){
      console.log('init channel options');
      getMessages();
      messagesListener();
      sendMessage();
      inviteToChannel();
      leaveChannel();
      deleteChannel();
      memberEventsListener();
    }

    function getMessages(){
      myChannel.getMessages().then(function(messages) {
        var totalMessages = messages.length;
        print('Total Messages: ' + totalMessages, true, $chatWindow);
        for (i=0; i<messages.length; i++) {
          var message = messages[i];
          printMessage(message.author, message.body);
        }
      });
    }

    function messagesListener(){
      myChannel.on('messageAdded', function(message) {
        printMessage(message.author, message.body);
      });
    }

    function sendMessage(){
      var $input = $('#chat-input');
      $input.on('keydown', function(e) {
        if (e.keyCode == 13) {
          myChannel.sendMessage($input.val());
          $input.val('');
        }
      });
    }

    function inviteToChannel(){
      console.log('ready to invite');
      var invite_button = $('.invite');
      invite_button.on('click', function(e){
        e.preventDefault();
        // TODO: add input for username so not hard-coded as 'rick'
        // Invite another member to your channel
        myChannel.invite('rick').then(function(member) {
          console.log('Your friend "' + member.identity + '" has been invited!');
        });
      });
    }

    function leaveChannel(){
      var leave_button = $('.leave');
      leave_button.on('click', function(e){
        e.preventDefault();
        console.log('I want to leave');
        // leave another member to your channel
        myChannel.leave(username).then(function(member) {
          console.log('Your friend "' + member.identity + '" has left!');
        });
      });
    }

    function deleteChannel(){
      var delete_button = $('.delete');
      delete_button.on('click', function(e){
        e.preventDefault();
        // Delete a previously created Channel
        myChannel.delete().then(function(channel) {
          console.log("Deleted channel: " + channel.sid);
        });
      });
    }

    function memberEventsListener(){
      // Listen for members joining a channel
      myChannel.on('memberJoined', function(member, messages) {
        print(member.identity + ' has joined the channel.', true, $chatWindow);
        for (i=0; i<messages.length; i++) {
          var message = messages[i];
          console.log('Author:' + message.author);
          printMessage(member.identity + 'has joined the channel.', message.body);
        }
      });
      // Listen for members joining a channel
      myChannel.on('memberLeft', function(member) {
        print(member.identity + ' has left the channel.', true, $chatWindow);
      });
      // Listen for members typing
      myChannel.on('typingStarted', function(member) {
        print(member.identity + ' is currently typing.', true, $chatWindow);
      });
      // Listen for members typing
      myChannel.on('typingEnded', function(member) {
        print(member.identity + ' has stopped typing.', true, $chatWindow);
      });
    }

  }

});
