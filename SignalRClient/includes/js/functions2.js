﻿// Set the hubs URL for the connection
$.connection.hub.url = "http://localhost:8080/signalr";
// Declare a proxy to reference the hub.
var chatHubConnection = $.connection.myHub;
// Id of the selected user
var selectedUser = null;
// All messages
var messages = [];
// Global interval
var interval = null;

// The contacts arry contains all buddies
var contact = [];
/* The buddy object
 * 
 * buddy.id = null;
 * buddy.otr = new OTR();
 * buddy.interval = null;
 * buddy.messages = [];
 */

// User login event
$('#loginUser').on('click', function() {
    // Use the entered username
    if ($("#username").val() == "") {
        alert("Enter a name..");
    } else {
        login($('#username').val());
    }    
});
// Login keypress event handler
$('#username').keyup(function (e) {
    if (e.keyCode == 13) {
        $('#loginUser').click();
    }
})

// Send message event
$('#sendMessage').on('click', function () {
    // Only send the message if a user is selected
    if (selectedUser != null) {
        sendMessage();
    }
});
// Send message key event handler
$("#secretMessage").keyup(function (e) {
    if (e.keyCode == 13) {
        $("#sendMessage").click();
    }
});

// Select a user event
$(document).on('click', '.user', function () {
    var userElement = $(this).find('h5');
    selectedUserId = userElement.attr('id');

    // Set the selected username on top
    $('.chatTab').text(userElement.text());

    // Enable the send button
    var sendButton = $('#sendMessage');
    if (sendButton.hasClass('btn-default')) {
        // Enable the "send message" button
        sendButton.removeClass('btn-default').addClass('btn-success');
    }

    // Cancel the interval timer
    clearInterval(interval);
    // Remove the blinking class
    $(userElement).closest('.onlineUsers .user').removeClass('alert-danger');

    // Search for the selected user
    var isConnected = $.grep(contact, function(e){ return e.id == id; });

    // If we're already connected to the selected user
    if (isConnected) {
        // Clear message list
        $(".messages").remove();

        // Loop trough all messages and add message to list
        for (var i = 0; i < messages.length; i++) {
            if (messages[i].sender == selectedUserId || messages[i].receiver == selectedUserId) {
                addMessageToList(messages[i].sender, messages[i].message);
            }
        }
    }
    else
    {
        // Init the connection
        var newOtr = new OTR();
        // Receive message event
        newOtr.on('ui', function (msg, encrypted, meta) {
            console.log("message to display to the user: " + msg)
            // encrypted === true, if the received msg was encrypted
            console.log("(optional) with receiveMsg attached meta data: " + meta)
        })
        // Send message event
        newOtr.on('io', function (msg, meta) {
            console.log("message to send to buddy: " + msg)
            console.log("(optional) with sendMsg attached meta data: " + meta)
            chatHubConnection.server.sendMessage(sessionStorage.getItem("connectionID"), selectedUserId, msg);
        })
        // Error event
        newOtr.on('error', function (err, severity) {
            if (severity === 'error')  // either 'error' or 'warn'
                console.error("error occurred: " + err)
        })

        // Create a new buddy object
        var buddy = {
            id: selectedUserId,
            otr: newOtr
        };

        // Add the buddy to the list of contacts
        contact.push(buddy);
    }

    selectedUser = $.grep(contact, function (e) {
        if (e.id == id) {
            return e;
        };
    });
});

// Receive new online user event
chatHubConnection.client.getNewOnlineUser = function (id, username) {
    // Add the user to the online users list
    addUserToOnlineUserList(id, username);
};

// Receive all online users event
chatHubConnection.client.getAllOnlineUsers = function (users) {
    // Save the connectionID in the sessionStorage
    sessionStorage.setItem("connectionID", $.connection.hub.id);

    // Add all online users to the online users list
    $.each(users, function (id, username) {
        addUserToOnlineUserList(id, username)
    });
};

// Receive new message event
chatHubConnection.client.getNewMessage = function (sender, message) {
    // Add message to global messsage variable
    addMessage(sender, sessionStorage.getItem("connectionID"), message);

    // If the sender is the selected user
    if (selectedUser == sender) {
        // Add message to the chatbox
        addMessageToList(sender, message);
    }
    else
    {
        interval = setInterval(function () {
            $('#' + sender).closest('.onlineUsers .user').toggleClass('alert-danger');
        }, 750);
    }
};

// Receive disconnected user event
chatHubConnection.client.getDisconnectedUser = function (id) {
    // Remove the disconnected user from the online users list
    $('#' + id).closest('li').remove();
    // Remove the disconnected user form the contact array
    contact.splice(contact.indexOf(contact.id == id));
};

// Add message to global message variable
function addMessage(sender, receiver, message) {
    var msg = { "sender": sender, "receiver": receiver, "message": message };
    messages.push(msg);
}

// Login
function login(username) {
    // Start connection
    $.connection.hub.start().done(function () {
        chatHubConnection.server.login(username);
    });

    // Hide login
    $("#login").hide();
    // Show home
    $("#home").fadeIn();

    /* Setup OTR */
    // Check if there is a DSA key available
    var myKey = localStorage.getItem("DSA");
    if (myKey == null) {
        // Generate and save a new DSA key
        myKey = new DSA();
        localStorage.setItem("DSA", myKey);
    }
}

// Add user to online users list
function addUserToOnlineUserList(id, username) {
    if (id != sessionStorage.getItem("connectionID")) {
        $('.onlineUsers .panel-body > .media-list').append(
            "<li class=\"media user alert alert-info\"> \
                <div class=\"media-body\"> \
                    <div class=\"media\"> \
                        <div class=\"media-body\"> \
                            <h5 id=\"" + id + "\"> " + username + " </h5> \
                            <small class=\"text-muted\">Man</small> \
                        </div> \
                    </div> \
                </div> \
            </li>"
        );
    }
}

// Add the new message to the chatbox
function addMessageToList(sender, message) {
    $('.chatbody > .media-list').append(
        "<li class=\"media messages\"> \
            <div class=\"media-body\"> \
                <div class=\"media\"> \
                    <div class=\"media-body\"> \
                        " + message + " \
                        <hr /> \
                    </div> \
                </div> \
            </div> \
        </li>"
    );
}

function sendMessage() {
    // Get the messege
    var msg = $('#secretMessage').val();
    // Get the recipient
    var rcptId = selectedUser;
    // Send the message
    selectedUser.otr.sendMsg(msg);
    // Show the message in the chatbox
    addMessageToList(sessionStorage.getItem("connectionID"), msg);
    // Add message to global messsage variable
    addMessage(sessionStorage.getItem("connectionID"), rcptId, msg);
    // Clear the input
    $('#secretMessage').val('');
}

function receiveMessage() {

}

//function startConversation() {
//    // provide options
//    var options = {
//        fragment_size: 140
//        , send_interval: 200
//        , priv: localStorage.getItem("DSA")
//    }

//    /*For each user you're communicating with, instantiate an OTR object.*/
//    // How do we do that?

//    var buddy = new OTR(options)

//    buddy.on('ui', function (msg, encrypted, meta) {
//        console.log("message to display to the user: " + msg)
//        // encrypted === true, if the received msg was encrypted
//        console.log("(optional) with receiveMsg attached meta data: " + meta)
//    })

//    buddy.on('io', function (msg, meta) {
//        console.log("message to send to buddy: " + msg)
//        console.log("(optional) with sendMsg attached meta data: " + meta)
//    })

//    buddy.on('error', function (err, severity) {
//        if (severity === 'error')  // either 'error' or 'warn'
//            console.error("error occurred: " + err)
//    })
//}

//function sendMessage(msg) {
//    buddy.REQUIRE_ENCRYPTION = true;
//    buddy.sendMsg(msg);
//}

//function receiveMessage(msg) {
//    return buddy.receiveMsg(msg);
//}

//function endConversation() {
//    buddy.endOtr(function () {
//        // Calls backwhen the 'disconnect' message has been sent.
//    });
//}