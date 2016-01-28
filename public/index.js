$(function() {
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
  var newChannelMessages = []; // stores messages sent while the channel is being created
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
      data.token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmLTE0NTM5NDc5NTMiLCJpc3MiOiJTSzU5YTgyZmUzYzZmMzNmMGZjNzA2NTg4NzBlMDg0MDFmIiwic3ViIjoiQUM1NmE0OTZhNjhlYTA1NjZkZGY1MTU4YjRlNzM3ZDI3ZiIsImV4cCI6MTQ1Mzk1MTU1MywiZ3JhbnRzIjp7ImlkZW50aXR5IjoicGF0IiwiaXBfbWVzc2FnaW5nIjp7InNlcnZpY2Vfc2lkIjoiSVMwYjIzYzliYWJlYjU0M2U4OTBhMjY5ZjMzOWRlZTQxMCIsImVuZHBvaW50X2lkIjoiaXAtbWVzc2FnaW5nLWRlbW86cGF0OmRlbW8tZGV2aWNlIn19fQ.BGeoLh-9p0G_lxLvF2Z152XnXUgcpe-uk4m6vty6KRg';

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
      var input = $('#chat-input');
      input.on('keydown', function(e) {
        e.stopImmediatePropagation();
        if (e.keyCode == 13) {
          if (input.val() == 'login'){
            conciergeLogin = true;
            input.unbind(); // take off login or new channel
            navListener();
            getAllChannels();
            $('.subheader').addClass('active');
            $('#sidebar').addClass('active');
            $('#content').addClass('sidebar-active');
            $('#page-wrapper').addClass('logged-in');
          } else {
            var uniqueName = 'newchat-' + Date.now().toString(); // TODO: add merchant name
            var friendlyName = input.val();
            newChannelMessages.push(input.val());
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

    function joinExistingChannelListener(){
      var join = $('.join');
      join.on('click', function(e){
        e.stopImmediatePropagation();
        var this_button = $(this);
        this_button.addClass('pending');
        var uniqueName = this_button.attr('id').replace('join-', '');
        var channel = myChannels[uniqueName]; // get the channel by uniqueName
        showAsActiveChannel(channel);
        $('#sidebar').addClass('sm-hide');
        $('.sm-header.left').addClass('active');
        $('#page-wrapper').addClass('sm-hide');
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
      activeSidebar.find('.join.active').removeClass('active');
      var newActiveButton = storedButtons[channel.uniqueName];
      newActiveButton.toggleClass('pending active');
      newActiveButton.removeClass('unread-messages');
      var unreadCount = newActiveButton.find('.join-channel-unread-count');
      unreadCount.removeClass('active');
      unreadCount.text(0);

      // toggle header
      showAsActiveWindowHeader(myChannel);

      // set active channel for window
      $chatWindow = uniqueChannel;
      $chatWindow.scrollTop($chatWindow[0].scrollHeight);
      storeactiveNavContainerChannel($chatWindow);

      // set last index the user has seen
      myChannel.updateLastConsumedMessageIndex(myChannel.messages.length - 1);
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
          $('.loading').text('Twilio error, please refresh');
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
    var channelsIAmNotIn = [];
    var channelsTaken = [];
    function getLastChannelMessage(channel){
      console.log('getting message');
      channel.getMessages().then(function(messages) {
        var channelWithLastUpdate = {};
        channelWithLastUpdate.channel = channel;
        if (messages.length > 0){
          channelWithLastUpdate.lastUpdate = messages[0].timestamp;
        } else {
          channelWithLastUpdate.lastUpdate = channel.dateCreated;
        }
        if (findMeInMessages(messages) == 1){
          channelsToSortByLastUpdate.push(channelWithLastUpdate);
        } else if (findMeInMessages(messages) == 2){
          console.log('someone else has ' + channel.friendlyName);
          channelsTaken.push(channelWithLastUpdate);
        } else {
          console.log('I have no messages in ' + channel.friendlyName);
          channelsIAmNotIn.push(channelWithLastUpdate);
        }
        sortChannelList();
      });
    }

    function findMeInMessages(messages){
      var uniqeMembers = []; // unique members in this channel
      var memberCount = 0;
      for (var i = messages.length - 1; i >= 0; i--) {
        var message = messages[i];
        var messageAuthor = message.author;
        if (messageAuthor == username){ // if I have any messages
          return 1; // end it right here
        }
        if (jQuery.inArray(messageAuthor, uniqeMembers)){ // if member already counted in array
          memberCount++;
          uniqeMembers.push(messageAuthor);
          if (memberCount > 1){ // if someone is in the chat with the customer
            return 2;
          }
        }
      }
    }

    function sortChannelList(){
      if (myChannelsCount === channelsToSortByLastUpdate.length + channelsIAmNotIn.length){
        console.log(channelsToSortByLastUpdate);
        console.log(channelsIAmNotIn);
        // sortChannelListByDate(channelsToSortByLastUpdate);
        channelsToSortByLastUpdate.sort(function(a, b){
          var channelA = a.lastUpdate;
          var channelB = b.lastUpdate;
          if (channelA > channelB){
            console.log(a.channel.friendlyName + ': ' + a.lastUpdate + ' > ' + b.channel.friendlyName + ': ' + b.lastUpdate);
          } else {
            console.log(a.channel.friendlyName + ': ' + a.lastUpdate + ' < ' + b.channel.friendlyName + ': ' + b.lastUpdate);
          }
          return channelA > channelB ? 1 : -1;
        });
        var myChannelsSidebar = $('#messages-sidebar');
        myChannelsSidebar.find('.loading').remove();
        var channelMessageBoard = $('#messages-container');
        for (i = 0; i < channelsToSortByLastUpdate.length; i++){
          var channel = channelsToSortByLastUpdate[i].channel;
          buildChannelButton(channel, myChannelsSidebar);
          buildChannelPage(channel, channelMessageBoard);
          initChannelOptions(channel);
          getChannelMessages(channel);
        }
        joinExistingChannelListener();
        sortUnassigned();
        sortTaken();
      } else {
        // console.log('myChannels length: ' + myChannelsCount);
        // console.log('channelsToSortByLastUpdate length: ' + channelsToSortByLastUpdate.length);
      }
    }

    function sortUnassigned(){
      console.log(channelsIAmNotIn);
      // sortChannelListByDate(channelsIAmNotIn);
      channelsIAmNotIn.sort(function(a, b){
        var channelA = a.lastUpdate;
        var channelB = b.lastUpdate;
        if (channelA > channelB){
          console.log(a.channel.friendlyName + ': ' + a.lastUpdate + ' > ' + b.channel.friendlyName + ': ' + b.lastUpdate);
        } else {
          console.log(a.channel.friendlyName + ': ' + a.lastUpdate + ' < ' + b.channel.friendlyName + ': ' + b.lastUpdate);
        }
        return channelA > channelB ? 1 : -1;
      });
      var myInboxContainer = $('#inbox-sidebar');
      myInboxContainer.find('.loading').remove();
      var channelMessageBoard = $('#inbox-container');
      for (i = 0; i < channelsIAmNotIn.length; i++){
        var channel = channelsIAmNotIn[i].channel;
        buildChannelButton(channel, myInboxContainer);
        buildChannelPage(channel, channelMessageBoard);
        initChannelOptions(channel);
        getChannelMessages(channel);
      }
      joinExistingChannelListener();
    }

    function sortTaken(){
      console.log(channelsTaken);
      // sortChannelListByDate(channelsTaken);
      channelsTaken.sort(function(a, b){
        var channelA = a.lastUpdate;
        var channelB = b.lastUpdate;
        if (channelA > channelB){
          console.log(a.channel.friendlyName + ': ' + a.lastUpdate + ' > ' + b.channel.friendlyName + ': ' + b.lastUpdate);
        } else {
          console.log(a.channel.friendlyName + ': ' + a.lastUpdate + ' < ' + b.channel.friendlyName + ': ' + b.lastUpdate);
        }
        return channelA > channelB ? 1 : -1;
      });
      var myTeamContainer = $('#team-sidebar');
      myTeamContainer.find('.loading').remove();
      var channelMessageBoard = $('#team-container');
      for (i = 0; i < channelsTaken.length; i++){
        var channel = channelsTaken[i].channel;
        buildChannelButton(channel, myTeamContainer);
        buildChannelPage(channel, channelMessageBoard);
      }
      joinExistingChannelListener();
    }

    function sortChannelListByDate(channels){
      // channels.sort(function(a, b){
      //   var channelA = a.lastUpdate;
      //   var channelB = b.lastUpdate;
      //   return channelA > channelB ? 1 : -1;
      // });
    }

    function buildChannelButton(channel, sidebar){
      var channelButton = '<div id="join-' + channel.uniqueName + '" class="join" name="' + channel.friendlyName + '">' +
                            '<span class="join-channel-name">' + channel.friendlyName + '</span>' +
                            '<span class="join-channel-unread-count">0</span>' +
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
          moveToMessages(channel);
          returnToDefaultNavChannel('inbox'); // show inbox init channel
          showAsActiveNav('messages'); // switch nav back to messages
          showAsActiveChannel(channel); // TODO: show this channel as active
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

    var joinAndInit = false;
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
        $.when(joinAndInit).then(function(){
          joinAndInit = false;
          console.log('gunu init');
          initChannelOptions(channel);
        });
        showAsActiveChannel(channel);
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

    function initChannelOptions(channel){
      console.log('init \'' + channel.friendlyName + '\' channel options');
      sendStoredMessages(channel);
      messagesListener(channel);
      sendChannelMessage();
      leaveChannelListener(channel);
      deleteChannelListener(channel);
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
        // print('Total Messages: ' + totalMessages, true, storedMessageBoards[channel.uniqueName]);
        for (i=0; i<totalMessages; i++) {
          var message = messages[i];
          printMessage(message.author, message.dateUpdated, message.body, storedMessageBoards[channel.uniqueName]);
          // TODO: set message index
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

    function moveToMessages(channel){
      $('#messages-container').prepend(storedMessageBoards[channel.uniqueName]);
      $('#messages-sidebar').prepend(storedButtons[channel.uniqueName]);
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
