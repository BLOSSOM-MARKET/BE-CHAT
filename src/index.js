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

  socket.on('JOIN_ROOM', ({roomId, yourId, myId, productId, nickname, yourNick}) => {
    console.log("!!! JoinRoom___________________________")
      console.log("join Room:", {roomId, yourId, myId, productId, nickname, yourNick});
      socket.join(roomId);

      if (roomId !== 'myRooms') {
        // 기존에 생성된 채팅방이 없으면 새로 생성
        db.query(`SELECT * FROM ChattingRoom WHERE messageroom_id = ?`, roomId, function(err, rows){
            if (err) throw err;

            const now = new Date();

            const queryConfig = {
                MESSAGEROOM_ID: roomId,
                CREATE_DATE: now,
                UPDATE_DATE: now,
                MESSAGEROOM_OWNER: yourId,
                MESSAGEROOM_ATTENDER: myId,
                PRODUCT_ID: productId
            }
            
            if (rows.length <= 0) {
                console.log("기존 채팅방 없음. 신규생성");

                db.query(`INSERT INTO ChattingRoom set ?`, queryConfig,function(err, rows){
                    if (err) throw err;
                });
            }
        });
      }

      db.query(`SELECT * FROM Chatting WHERE messageroom_id = ?`, roomId, function(err, rows){
            if (err) throw err;
            for (idx in rows){ 
                const [userId, message, sendTime] = [rows[idx].SENDER, rows[idx].MESSAGE_TEXT, rows[idx].CREATE_DATE];
                console.log(`${userId} : ${message} (${sendTime})`);
                const targetNick = userId === myId ? nickname : yourNick;
                io.to(roomId).emit('UPDATE_MESSAGE', {userId, targetNick, message, sendTime});
                // io.to(roomId).emit('UPDATE_MESSAGE', {roomId, yourId, myId, productId, nickname});
            }
        });

  })

  const getNickname = (userId) => {
    let nickname;
    db.query(`SELECT USER_NICKNAME FROM User WHERE USER_ID = ?`, userId, function(err, rows) {
        if (err) throw err;
        console.log("nickname?????", rows, rows[0]['USER_NICKNAME'])
        nickname = rows[0]['USER_NICKNAME'];
    })
    return nickname;
  }

  // 방 목록 가져오기
  socket.on('GET_ROOMS', ({myRoomId, userId}) => {
      console.log("get Rooms:", {myRoomId, userId});

      db.query(`SELECT CR.messageroom_id AS roomId, CR.MESSAGEROOM_OWNER AS user1, CR.MESSAGEROOM_ATTENDER AS user2, 
                       CR.product_id AS productId, C.CREATE_DATE AS lastSendTime, C.MESSAGE_TEXT AS lastMsg,
                       (SELECT USER_NICKNAME FROM User WHERE USER_ID = user1) AS name1, 
                       (SELECT USER_NICKNAME FROM User WHERE USER_ID = user2) AS name2
                FROM ChattingRoom CR JOIN Chatting C
                ON CR.messageroom_id = C.messageroom_id
                WHERE CR.MESSAGEROOM_OWNER = ? OR CR.MESSAGEROOM_ATTENDER = ?
                ORDER BY C.CREATE_DATE DESC LIMIT 1;
                `, 
                [userId, userId], function(err, rows){
        if (err) throw err;
                
        socket.join(myRoomId);
        
        for (idx in rows){ 
            console.log(rows[idx])
            const [roomId, user1, user2, name1, name2, lastSendTime, lastMsg, productId] = [rows[idx].roomId, rows[idx].user1, rows[idx].user2, rows[idx].name1, rows[idx].name2,rows[idx].lastSendTime, rows[idx].lastMsg, rows[idx].productId]
            io.to(myRoomId).emit('UPDATE_ROOMS', {roomId, user1, user2, lastSendTime, lastMsg, productId, name1, name2});
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
        messageroom_id: roomId
    }

    db.query(`INSERT INTO Chatting set ?`, queryConfig, function(err, rows){
        if (err) throw err;
        console.log("chat info is: ", rows);
        for (idx in rows){ 
            socket.emit('answer', rows[idx].name); 
        }
    });

    console.log({roomId, userId, nickname, message});
    const targetNick = nickname;
    io.to(roomId).emit('UPDATE_MESSAGE', {userId, targetNick, message, sendTime: now});

  })
    
});
