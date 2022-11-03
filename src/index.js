const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const config = require("config");
const cors = require("cors");

const port = config.get("port");
const app = express();
const logger = require("./middlewares");

app.use(bodyParser.json());
app.use(cors({ origin: "*" }));

app.get("/", (req, res, next) => {
  res.send("hello world!");
});

const server = app.listen(port, () =>
  console.log(`Server is listening on port ${port}`)
);

// if you need DB, you can use this code. (set up in src/models/index.js)

const db = require("./models");

db.once("open", function () {
  console.log("DB Connected");
});

db.on("error", function (err) {
  console.log("DB ERROR : ", err);
});

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("socket connected");

  socket.on("disconnect", () => {
    console.log("socket disconnected");
  });

  socket.on(
    "JOIN_ROOM",
    ({ roomId, yourId, myId, productId, nickname, yourNick }) => {
      console.log("!!! JoinRoom___________________________");
      console.log("join Room:", {
        roomId,
        yourId,
        myId,
        productId,
        nickname,
        yourNick,
      });
      socket.join(roomId);

      if (roomId !== "myRooms") {
        // 기존에 생성된 채팅방이 없으면 새로 생성
        db.query(
          `SELECT * FROM ChattingRoom WHERE messageroom_id = ?`,
          roomId,
          function (err, rows) {
            if (err) throw err;

            const now = new Date();

            const queryConfig = {
              MESSAGEROOM_ID: roomId,
              CREATE_DATE: now,
              UPDATE_DATE: now,
              MESSAGEROOM_OWNER: yourId,
              MESSAGEROOM_ATTENDER: myId,
              PRODUCT_ID: productId,
            };

            if (rows.length <= 0) {
              console.log("기존 채팅방 없음. 신규생성");

              db.query(
                `INSERT INTO ChattingRoom set ?`,
                queryConfig,
                function (err, rows) {
                  if (err) throw err;
                }
              );
            }
          }
        );
      }

      db.query(
        `SELECT * FROM Chatting WHERE messageroom_id = ?`,
        roomId,
        function (err, rows) {
          if (err) throw err;
          const messages = [];

          for (idx in rows) {
            const [userId, message, sendTime, messageId] = [
              rows[idx].SENDER_ID,
              rows[idx].MESSAGE_TEXT,
              rows[idx].CREATE_DATE,
              rows[idx].message_id,
            ];
            const targetNick = userId === myId ? nickname : yourNick;
            console.log(
              `${userId} : ${message} (${sendTime}) messageId: ${messageId}`
            );
            const msgIdx = idx;
            messages.push({
              userId,
              targetNick,
              message,
              sendTime,
              messageId,
              msgIdx,
            });
            // io.to(roomId).emit('UPDATE_MESSAGE', {userId, targetNick, message, sendTime, messageId, msgIdx});
            // io.to(roomId).emit('UPDATE_MESSAGE', {roomId, yourId, myId, productId, nickname});
          }
          io.to(roomId).emit("UPDATE_MESSAGE", messages);
        }
      );
    }
  );

  const getNickname = (userId) => {
    let nickname;
    db.query(
      `SELECT USER_NICKNAME FROM User WHERE USER_ID = ?`,
      userId,
      function (err, rows) {
        if (err) throw err;
        console.log("nickname?????", rows, rows[0]["USER_NICKNAME"]);
        nickname = rows[0]["USER_NICKNAME"];
      }
    );
    return nickname;
  };

  const getProductInfo = (pid) => {
    // return [
    //   `테스트용 상품명 ${pid}`,
    //   "https://cdn.cashfeed.co.kr/attachments/1eb9b8ff1b.jpg",
    // ];
    let productName, productImg ;
    db.query(`SELECT PRODUCT_NAME, IMAGE1 FROM Product WHERE PRODUCT_ID = ?`, pid, function(err, rows) {
        if (err) throw err;
        console.log("name?????", rows, rows[0]['PRODUCT_NAME'])
        productName = rows[0]['PRODUCT_NAME'];
        productImg = rows[0]['IMAGE1'];
    })
    return [productName, productImg];
  };

  // 방 목록 가져오기
  socket.on("GET_ROOMS", ({ myRoomId, userId }) => {
    if (myRoomId === undefined) {
      myRoomId = "myRooms";
    }
    console.log("get Rooms:", { myRoomId, userId });

    db.query(
      `SELECT CR.messageroom_id AS roomId, CR.MESSAGEROOM_OWNER AS user1, CR.MESSAGEROOM_ATTENDER AS user2, 
                       CR.product_id AS productId,
                       (SELECT CREATE_DATE FROM Chatting C 
                        WHERE CR.messageroom_id = C.messageroom_id 
                        ORDER BY C.CREATE_DATE DESC LIMIT 1) AS lastSendTime,
                       (SELECT MESSAGE_TEXT FROM Chatting C 
                        WHERE CR.messageroom_id = C.messageroom_id 
                        ORDER BY C.CREATE_DATE DESC LIMIT 1) AS lastMsg,
                       (SELECT USER_NICKNAME FROM User WHERE USER_ID = user1) AS name1, 
                       (SELECT USER_NICKNAME FROM User WHERE USER_ID = user2) AS name2
                FROM ChattingRoom CR 
                WHERE CR.MESSAGEROOM_OWNER = ? OR CR.MESSAGEROOM_ATTENDER = ?;
                `,
      [userId, userId],
      function (err, rows) {
        if (err) throw err;

        socket.join(myRoomId);

        for (idx in rows) {
          console.log(rows[idx]);
          const [
            roomId,
            user1,
            user2,
            name1,
            name2,
            lastSendTime,
            lastMsg,
            productId,
          ] = [
            rows[idx].roomId,
            rows[idx].user1,
            rows[idx].user2,
            rows[idx].name1,
            rows[idx].name2,
            rows[idx].lastSendTime,
            rows[idx].lastMsg,
            rows[idx].productId,
          ];

          // 상품 대표이미지, 상품 이름 가져오기
          // const [productName, productImg] = getProductInfo(productId);
          let productName, productImg ;
          db.query(`SELECT PRODUCT_NAME, IMAGE1 FROM Product WHERE PRODUCT_ID = ?`, productId, function(err, rows) {
              if (err) throw err;
              console.log("name?????", rows, rows[0]['PRODUCT_NAME'])
              productName = rows[0]['PRODUCT_NAME'];
              productImg = rows[0]['IMAGE1'];

              const theRoom = {
                roomId,
                user1,
                user2,
                lastSendTime,
                lastMsg,
                productId,
                name1,
                name2,
                productName,
                productImg,
              }
              console.log("the room: ", theRoom)
              io.to(myRoomId).emit("UPDATE_ROOMS", theRoom);
          })

          // const theRoom = {
          //   roomId,
          //   user1,
          //   user2,
          //   lastSendTime,
          //   lastMsg,
          //   productId,
          //   name1,
          //   name2,
          //   productName,
          //   productImg,
          // }
          // console.log("the room: ", theRoom)
          // io.to(myRoomId).emit("UPDATE_ROOMS", theRoom);
        }
      }
    );
  });

  socket.on("SEND_MESSAGE", ({ roomId, userId, nickname, message }) => {
    const now = new Date();

    const queryConfig = {
      create_date: now,
      sender_id: userId,
      update_date: now,
      message_text: message,
      messageroom_id: roomId,
    };

    db.query(`INSERT INTO Chatting set ?`, queryConfig, function (err, rows) {
      if (err) throw err;
      console.log("chat info is: ", rows);
      for (idx in rows) {
        socket.emit("answer", rows[idx].name);
      }
    });

    console.log({ roomId, userId, nickname, message });
    const targetNick = nickname;
    io.to(roomId).emit("UPDATE_NEW_MESSAGE", {
      userId,
      targetNick,
      message,
      sendTime: now,
    });
  });
});
