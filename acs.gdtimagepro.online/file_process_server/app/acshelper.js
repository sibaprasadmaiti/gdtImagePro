const Json2csvParser = require('json2csv').Parser;
var fs = require('fs');

var acsHelper = {}

acsHelper.getRandomFileName = function () {
    var timestamp = new Date().toISOString().replace(/[-:.]/g, "");
    var random = ("" + Math.random()).substring(2, 8);
    var random_number = timestamp + random;
    return random_number;
}
acsHelper.getSafe = function (fn, defaultVal) {
    try {
        // console.log("hello", fn())
        return fn();
    }
    catch (e) {
        return defaultVal;
    }
}

acsHelper.writetofile = function (res, finalfilename, revisedjson, callback) {
    console.log("Writing To file" + finalfilename, revisedjson);
    // console.log(revisedjson);
    const json2csvParser = new Json2csvParser();
    const csv = json2csvParser.parse(revisedjson);
    fs.truncate('FinalFile/' + finalfilename + '.csv', 0, function () {
        fs.appendFile('FinalFile/' + finalfilename + '.csv', csv, (err) => {
            acsHelper.SendFileToClient(res, finalfilename, callback)
        });
    })

}
acsHelper.SendFileToClient = function (res, finalfilename, callback) {
    console.log("Sending File to Client")
    res.writeHead(200,
        {
            "Content-Type": "text/plain",
            "Content-Disposition": "attachment; filename=" + finalfilename + ".csv"
        });
    fs.createReadStream('FinalFile/' + finalfilename + '.csv').pipe(res);
    callback();
    console.log("File Sent")
}
module.exports = acsHelper 
