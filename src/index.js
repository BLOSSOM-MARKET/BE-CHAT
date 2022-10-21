const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const config = require('config');
const cors = require('cors');

const port = config.get('port');
const app = express();
const logger = require('./middlewares')


app.use(bodyParser.json());
app.use(cors({origin: "*"}));


app.get('/', (req, res, next) => {
    res.send('hello world!');
});

const server = app.listen(port, () => console.log(`Server is listening on port ${port}`));

// if you need DB, you can use this code. (set up in src/models/index.js)

const db = require('./models');

db.once('open', function () {           
    console.log('DB Connected');
});

db.on('error', function (err) {
    console.log('DB ERROR : ', err);
});

const io = require("socket.io")(server, {
    cors: {
        origin:"*",
    }
});

io.on('connection', (socket) => {
  console.log('socket connected');
    
    
  socket.on('disconnect', () => {
    console.log('socket disconnected');
  });

  socket.on('JOIN_ROOM', ({roomId, userId, nickname}) => {
      console.log("join Room:", {roomId, userId, nickname});
      socket.join(roomId);

      db.query(`SELECT * FROM chat WHERE messageroom_id2 = ?`, roomId, function(err, rows){
        if (err) throw err;
        for (idx in rows){ 
            const [userId, message, sendTime] = [rows[idx].SENDER, rows[idx].MESSAGE_TEXT, rows[idx].CREATE_DATE];
            console.log(`${userId} : ${message} (${sendTime})`);
            io.to(roomId).emit('UPDATE_MESSAGE', {userId, nickname, message, sendTime});
        }
    });

  })

  socket.on('GET_ROOMS', ({roomId, userId}) => {
      console.log("get Rooms:", {roomId, userId});

      db.query(`SELECT messageroom_id2 FROM chat WHERE sender = ?`, userId, function(err, rows){
        if (err) throw err;
        for (idx in rows){ 
            const [userId, message, sendTime] = [rows[idx].SENDER, rows[idx].MESSAGE_TEXT, rows[idx].CREATE_DATE];
            console.log(`${userId} : ${message} (${sendTime})`);
            io.to(roomId).emit('UPDATE_ROOMS', {userId, nickname, message, sendTime});
        }
    });

  })
    
  socket.on('SEND_MESSAGE', ({roomId, userId, nickname, message}) => {
    const now = new Date();

    const queryConfig = {
        create_date: now,
        sender: userId,
        update_date: now, 
        message_text: message,
        messageroom_id2: roomId
    }

    db.query(`INSERT INTO chat set ?`, queryConfig, function(err, rows){
        if (err) throw err;
        console.log("chat info is: ", rows);
        for (idx in rows){ 
            socket.emit('answer', rows[idx].name); 
        }
    });

    console.log({roomId, userId, nickname, message});
    io.to(roomId).emit('UPDATE_MESSAGE', {userId, nickname, message, sendTime: now});

  })
    
});
