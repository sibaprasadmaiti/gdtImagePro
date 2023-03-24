var mysql = require('mysql');

// connect to the db
// dbConnectionInfo = {
//     host: "amazoncustomsolution.cwt03gcjd3dj.us-east-2.rds.amazonaws.com",
//     user: "admin",
//     password: "Messold12"
// };
// dbConnectionInfo = {
//   host: "localhost",
//   user: "root",
//   password: "Loucks74"
// };

dbConnectionInfo = {
  host: "localhost",
  user: "root",
  password: "",
  port: "3306",
  database: "custom_amazon"
};

// dbConnectionInfo = {
//   host: "gdtimagepro.com",
//   user: "acsgdtimage",
//   password: "Vlu8f568%"
// };
//For mysql single connection
/* var dbconnection = mysql.createConnection(
        dbConnectionInfo
); 

 dbconnection.connect(function (err) {
    if (!err) {
        console.log("Database is connected ... nn");
    } else {
        console.log("Error connecting database ... nn");
    }
}); 

*/

//create mysql connection pool
var dbconnection = mysql.createPool(
  dbConnectionInfo
);
if (dbconnection) {
  console.log('Connected the database via threadId '+ dbconnection.threadId);
  dbconnection.query('SET SESSION auto_increment_increment=1');
}
// Attempt to catch disconnects 
dbconnection.on('connection', function (connection) {
  console.log('DB Connection established');

  connection.on('error', function (err) {
    console.error(new Date(), 'MySQL error', err.code);
  });
  connection.on('close', function (err) {
    console.error(new Date(), 'MySQL close', err);
  });

});


module.exports = dbconnection;

