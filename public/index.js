$(function() {
  // Get handle to the chat div
  var $chatWindow = $('#init_messages');
  var header = $('.nav-header');
  var windowHeader = $('.nav-channel-title');

  // Manages the state of our access token we got from the server
  var accessManager;

  // Our interface to the IP Messaging service
  var messagingClient;

  // A handle to the "general" chat channel - the one and only channel we
  // will have in this sample app
  var myChannel;
  var myChannels = {};
  var newChannel = false;

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
  function printMessage(fromUser, timestamp, message) {
    var $user = $('<span class="username">').text(fromUser + ':');

    if (fromUser === username) {
      $user.addClass('me');
    }
    var $message = $('<span class="message">').text(message);
    var $timestamp = $('<span class="timestamp">').text(timestamp);
    var $container = $('<div class="message-container">');
    $container.append($user).append($message).append($timestamp);
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
      data.token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmLTE0NTI0NjczOTgiLCJpc3MiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmIiwic3ViIjoiQUM1NmE0OTZhNjhlYTA1NjZkZGY1MTU4YjRlNzM3ZDI3ZiIsImV4cCI6MTQ1MjQ3MDk5OCwiZ3JhbnRzIjp7ImlkZW50aXR5IjoicGF0IiwiaXBfbWVzc2FnaW5nIjp7InNlcnZpY2Vfc2lkIjoiSVMwYjIzYzliYWJlYjU0M2U4OTBhMjY5ZjMzOWRlZTQxMCIsImVuZHBvaW50X2lkIjoiaXAtbWVzc2FnaW5nLWRlbW86cGF0OmRlbW8tZGV2aWNlIn19fQ.N0MC8-7TqanTKFM1s-Lh3zi0APCHXzjbQ1wKlkhHLfM';

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

    var channelCount;
    var firstTime = true;
    function getChannels(){
      // Get Messages for a previously created channel
      messagingClient.getChannels().then(function(channels) {
        channelCount = channels.length;
        for (i = 0; i < channelCount; i++){
          var channel = channels[i];
          joinChannelNow(channel);
        }
        if (firstTime){
          firstTime = false;
          createChannelForm();
          joinExistingChannelListener();
        } else {
          joinExistingChannelListener();
          joinChannel();
        }
      });
    }

    function joinChannelNow(channel){
      channel.join().then(function(channel) {
        getLastChannelMessage(channel);
        channelMessagesListener(channel);
      });
    }

    var channelList = [];
    function getLastChannelMessage(channel){
      channel.getMessages(1).then(function(messages) {
        var channelStuff = {};
        channelStuff.channel = channel;
        if (messages.length > 0){
          channelStuff.lastUpdate = messages[0].timestamp;
        } else {
          channelStuff.lastUpdate = channel.dateCreated;
        }
        channelList.push(channelStuff);
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
        buildChannelButtons();
      }
    }

    function buildChannelButtons(){
      for (i = 0; i < channelList.length; i++){
        var channel = channelList[i].channel;
        if ($('#join_' + channel.uniqueName).length === 0){
          var channelButton = '<div id="join_' + channel.uniqueName + '" class="join">' + channel.friendlyName + '</div>';
          $('.channel-container').prepend(channelButton);
          if (newChannel){
            newChannel = false;
            $('#join_' + channel.uniqueName).addClass('pending');
          }
        }
      }
      joinExistingChannelListener();
    }

    function channelMessagesListener(channel){
      channel.on('messageAdded', function(message, channel) {
        printMessage(message.author, message.dateUpdated, message.body);
        var messageChannel = $('#join_' + myChannel.uniqueName);
        moveToFirst(messageChannel);
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

    function joinExistingChannelListener(){
      $('.join').on('click', function(e){
        e.stopImmediatePropagation();
        var this_button = $(this);
        this_button.addClass('pending');
        var uniqueName = this_button.attr('id').replace('join_', '');
        var friendlyName = this_button.text();
        var uniqueChannel = $('#' + uniqueName + '_messages');
        if (uniqueChannel.length > 0){
          showAsActiveChannel(uniqueName);
        } else {
          findOrCreateChannel(uniqueName, friendlyName);
        }

      });
    }

    function joinNewChannel(){
      $('.new-channel').on('submit', function(e){
        e.preventDefault;
        var uniqueName = $('.uniqueName').val();
        var friendlyName = $('.friendlyName').val();
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
            getChannels();
          });
        } else {
          myChannels[uniqueName] = channel;
          joinChannel();
        }
      });
    }

    function joinChannel() {
      myChannel.join().then(function(channel) {
        showAsActiveChannel(channel.uniqueName);
        print('Joined ' + channel.friendlyName + ' as <span class="me">' + username + '</span>.', true);
        initChannelOptions();
      });
    }

    function showAsActiveChannel(channel){
      myChannel = myChannels[channel];
      var activate_button = $('#join_' + channel);
      $('.join.active').toggleClass('active');
      activate_button.toggleClass('pending active');
      $chatWindow.toggleClass('active');

      var uniqueChannel = $('#' + channel + '_messages');
      if (uniqueChannel.length === 0){
        var newChatWindow = '<div id="' + channel + '_messages" class="messages active"></div>';
        $('#content').prepend(newChatWindow);
      } else {
        uniqueChannel.toggleClass('active');
      }
      $chatWindow = $('.messages.active');
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
        // TODO: add input for username so not hard-coded as 'rick'
        // Invite another member to your channel
        myChannel.invite('rick').then(function(member) {
          console.log('Your friend "' + member.identity + '" has been invited!');
        });
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
          console.log("Deleted channel: " + channel.sid);
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
