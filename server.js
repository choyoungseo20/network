var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var fileUpload = require("express-fileupload");
var path = require("path");

// File upload middleware
app.use(fileUpload());

// Static file serving for uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get("/", function (req, res) {
    console.log("Client requested the home page.");
    res.sendFile(__dirname + "/index.html");
});

// File upload endpoint
app.post("/upload", function (req, res) {
    console.log("File upload request received.");
    if (!req.files || Object.keys(req.files).length === 0) {
        console.log("No files were uploaded.");
        return res.status(400).send('No files were uploaded.');
    }

    let nickname = req.body.nickname; 
    if (!nickname) {
        console.log("Nickname is required.");
        return res.status(400).send('Nickname is required.');
    }

    let uploadFile = req.files.uploadFile;
    let uploadPath = path.join(__dirname, 'uploads', uploadFile.name);

    uploadFile.mv(uploadPath, function(err) {
        if (err) {
            console.error("Error during file upload:", err);
            return res.status(500).send(err);
        }

        console.log(`File uploaded: ${uploadFile.name}`);
        const fileUrl = `/uploads/${uploadFile.name}`;
        
        // Emit fileUploaded event with proper data
        io.emit("fileUploaded", { 
            nickname: nickname, 
            fileName: uploadFile.name, 
            fileUrl: fileUrl 
        });
        
        res.send({ fileName: uploadFile.name, fileUrl: fileUrl });
    });
});

http.listen(3000, function () {
    console.log("Server is running on port 3000.");
});

var clientList = [];

io.on("connection", function (socket) {
    console.log("A client connected.");
    let joinedClient = false;
    let nickname;

    socket.on("join", function (data) {
        if (joinedClient) {
            console.log("Attempt to join while already joined.");
            return;
        }

        nickname = data;
        clientList.push(nickname);
        console.log(`Client joined: ${nickname}`);

        // Send the current client list to the newly joined client
        socket.emit("welcome", { clientList: clientList });

        socket.broadcast.emit("join", {
            nickname: nickname,
            clientList: clientList,
        });

        joinedClient = true;
    });

    socket.on("msg", function (data) {
        console.log(`Message received from ${nickname}: ${data}`);
        io.emit("msg", {
            nickname: nickname,
            msg: data,
        });
    });

    socket.on("disconnect", function () {
        if (!joinedClient) {
            console.log("Disconnected client was not joined.");
            return;
        }

        console.log(`Client disconnected: ${nickname}`);
        var index = clientList.indexOf(nickname);
        clientList.splice(index, 1);
        socket.broadcast.emit("left", {
            nickname: nickname,
            clientList: clientList,
        });
    });
});