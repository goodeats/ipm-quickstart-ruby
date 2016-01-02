$(function() {
  // Get handle to the chat div
  var $chatWindow = $('#messages');

  // Manages the state of our access token we got from the server
  var accessManager;

  // Our interface to the IP Messaging service
  var messagingClient;

  // A handle to the "general" chat channel - the one and only channel we
  // will have in this sample app
  var generalChannel;

  // The server will assign the client a random username - store that value
  // here
  var username;
  $('.login').on('click', function(){
    // username = $(this).attr('class').replace(' username', '');
    // console.log('username set: ' + username);
    startChat();
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

  function startChat(){
    // Alert the user they have been assigned a random username
    print('Logging in...');

    // Get an access token for the current user, passing a username (identity)
    // and a device ID - for browser-based apps, we'll always just use the
    // value "browser"
    $.getJSON('/token', {
      identity: username,
      device: 'browser'
    }, function(data) {
      // testing localhost needs token generated here:
      // https://www.twilio.com/user/account/ip-messaging/dev-tools/testing-tools
      data.token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmLTE0NTE3NTE2MDMiLCJpc3MiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmIiwic3ViIjoiQUM1NmE0OTZhNjhlYTA1NjZkZGY1MTU4YjRlNzM3ZDI3ZiIsImV4cCI6MTQ1MTc1NTIwMywiZ3JhbnRzIjp7ImlkZW50aXR5IjoicGF0IiwiaXBfbWVzc2FnaW5nIjp7InNlcnZpY2Vfc2lkIjoiSVMwYjIzYzliYWJlYjU0M2U4OTBhMjY5ZjMzOWRlZTQxMCIsImVuZHBvaW50X2lkIjoiaXAtbWVzc2FnaW5nLWRlbW86cGF0OmRlbW8tZGV2aWNlIn19fQ.ISfHm_zxnAQ_dZS9RItNKOCngaefSNkbEwkWSbhvn84';

      // Alert the user they have been assigned a random username
      username = data.identity;
      print('You have been assigned a random username of: ' +
        '<span class="me">' + username + '</span>', true);

      // Initialize the IP messaging client
      accessManager = new Twilio.AccessManager(data.token);
      messagingClient = new Twilio.IPMessaging.Client(accessManager);
      init();
    });

    function init(){
      console.log('Initialized');
      findOrCreateChannel();
    }

    function findOrCreateChannel(){
      // Get the general chat channel, which is where all the messages are
      // sent in this simple application
      print('Attempting to join "general" chat channel...');
      var promise = messagingClient.getChannelByUniqueName('general');
      promise.then(function(channel) {
        generalChannel = channel;

        if (!generalChannel) {
          // If it doesn't exist, let's create it
          messagingClient.createChannel({
            uniqueName: 'general',
            friendlyName: 'General Chat Channel'
          }).then(function(channel) {
            console.log('Created general channel:');
            console.log(channel);
            generalChannel = channel;
            setupChannel();
          });
        } else {
          console.log('Found general channel:');
          console.log(generalChannel);
          setupChannel();
        }
      });
    }

    // Set up channel after it has been found
    function setupChannel() {
      // Join the general channel
      generalChannel.join().then(function(channel) {
        print('Joined ' + channel.friendlyName + ' as '
          + '<span class="me">' + username + '</span>.', true);
      });

      // Listen for new messages sent to the channel
      generalChannel.on('messageAdded', function(message) {
        printMessage(message.author, message.body);
      });

      // Get Messages for a previously created channel
      generalChannel.getMessages().then(function(messages) {
        var totalMessages = messages.length;
        for (i=0; i<messages.length; i++) {
          var message = messages[i];
          console.log('Author:' + message.author);
          printMessage(message.author, message.body);
        }
        console.log('Total Messages:' + totalMessages);
      });

      var invite_button = $('.invite');
      invite_button.on('click', function(e){
        e.preventDefault();
        // Invite another member to your channel
        generalChannel.invite('pat').then(function() {
          console.log('Your friend has been invited!');
        });
      });

      // Listen for new invitations to your Client
      messagingClient.on('channelInvited', function(channel) {
        console.log('Invited to channel ' + channel.friendlyName);
        // Join the channel that you were invited to
        channel.join();
      });

      var leave_button = $('.leave');
      leave_button.on('click', function(e){
        e.preventDefault();
        console.log('I want to leave');
        // leave another member to your channel
        generalChannel.leave('rick').then(function() {
          console.log('Your friend rick has left!');
        });
      });

      // var delete_button = $('.delete');
      // delete_button.on('click', function(e){
      //   e.preventDefault();
      //   // Delete a previously created Channel
      //   generalChannel.delete().then(function(channel) {
      //     console.log("Deleted channel: " + channel.sid);
      //   });
      // });

      // Get Messages for a previously created channel
      messagingClient.getChannels().then(function(channels) {
        for (i=0; i<channels.length; i++) {
          var channel = channels[i];
          console.log('Channel: ' + channel.friendlyName);
        }
      });

      // A channel has become visible to the Client
      messagingClient.on('channelAdded', function(channel) {
        console.log('Channel added: ' + channel.friendlyName);
      });
      // A channel is no longer visible to the Client
      messagingClient.on('channelRemoved', function(channel) {
        console.log('Channel removed: ' + channel.friendlyName);
      });
      // A channel's attributes or metadata have changed.
      messagingClient.on('channelUpdated', function(channel) {
        console.log('Channel updates: ' + channel.sid);
      });

      // Listen for members joining a channel
      generalChannel.on('memberJoined', function(member) {
        console.log(member.identity + 'has joined the channel.');
        printMessage(member.identity + 'has joined the channel.', message.body);
      });
      // Listen for members joining a channel
      generalChannel.on('memberLeft', function(member) {
        console.log(member.identity + 'has left the channel.');
      });
      // Listen for members typing
      generalChannel.on('typingStarted', function(member) {
        console.log(member.identity + 'is currently typing.');
      });
      // Listen for members typing
      generalChannel.on('typingEnded', function(member) {
        console.log(member.identity + 'has stopped typing.');
      });
    }

    // Send a new message to the general channel
    var $input = $('#chat-input');
    $input.on('keydown', function(e) {
      if (e.keyCode == 13) {
        generalChannel.sendMessage($input.val());
        $input.val('');
      }
    });
  }

});
