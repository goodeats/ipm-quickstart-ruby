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

  // Alert the user they have been assigned a random username
  print('Logging in...');

  // Get an access token for the current user, passing a username (identity)
  // and a device ID - for browser-based apps, we'll always just use the
  // value "browser"
  $.getJSON('/token', {
    identity: username,
    device: 'browser'
  }, function(data) {

    // testing localhost:4567 needs token generated here:
    // https://www.twilio.com/user/account/ip-messaging/dev-tools/testing-tools
    data.token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmLTE0NTEzNDgyNjciLCJpc3MiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmIiwic3ViIjoiQUM1NmE0OTZhNjhlYTA1NjZkZGY1MTU4YjRlNzM3ZDI3ZiIsImV4cCI6MTQ1MTM1MTg2NywiZ3JhbnRzIjp7ImlkZW50aXR5IjoicGF0YXRhdCIsImlwX21lc3NhZ2luZyI6eyJzZXJ2aWNlX3NpZCI6IklTMGIyM2M5YmFiZWI1NDNlODkwYTI2OWYzMzlkZWU0MTAiLCJlbmRwb2ludF9pZCI6ImlwLW1lc3NhZ2luZy1kZW1vOnBhdGF0YXQ6ZGVtby1kZXZpY2UifX19.wOZTOltB58e64jiSK6WHZjIgSuoRuGbI658tZi0xJm4';

    // Alert the user they have been assigned a random username
    username = data.identity;
    print('You have been assigned a random username of: '
      + '<span class="me">' + username + '</span>', true);

    // Initialize the IP messaging client
    accessManager = new Twilio.AccessManager(data.token);
    messagingClient = new Twilio.IPMessaging.Client(accessManager);

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
  });

  // Set up channel after it has been found
  function setupChannel() {
      // Join the general channel
      generalChannel.join().then(function(channel) {
        print('Joined channel as '
          + '<span class="me">' + username + '</span>.', true);
      });

      // Listen for new messages sent to the channel
      generalChannel.on('messageAdded', function(message) {
        printMessage(message.author, message.body);
      });
    }

  // Send a new message to the general channel
  var $input = $('#chat-input');
  $input.on('keydown', function(e) {
    if (e.keyCode == 13) {
      generalChannel.sendMessage($input.val())
      $input.val('');
    }
  });
});
