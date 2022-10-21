// const mongoose = require('mongoose')
const config = require('config');

// const dbConfig = config.get('db');

// mongoose
//     .connect(dbConfig.mongoUrl, { 
//         useNewUrlParser: true,
//         useUnifiedTopology: true,
//     })
//     .then(()=> console.log('mongoDB connected'))
//     .catch(e => {
//         console.error('Connection error', e.message)
//     })

// const db = mongoose.connection

// module.exports = db 


const mysql = require('mysql')
// const config = require('config');

// const dbConfig = config.get('db');

const connection = mysql.createConnection(
        config.get("mysql")
    )
    // .then(()=> console.log('mySQL connected'))
    // .catch(e => {
    //     console.error('mySQL Connection error', e.message)
    // });

connection.connect();
const db = connection;

module.exports = db 