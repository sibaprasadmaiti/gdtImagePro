var request = require('request');
var fs = require('fs');
var extract = require('extract-zip')
var multer = require('multer');
const path = require('path');
var multiparty = require('multiparty');
var AdmZip = require('adm-zip');
// const SECRET = 'JHDp5N/xnS3vowPJgGu0RsfGyWb0QBmN6P2obIK1';
const S3 = require('aws-sdk/clients/s3')
const BUCKET_NAME = 'amazoncustomsolution';
const directory = 'zips';
var totalnumberofrecords = 0;
var currentnumberofrecords = 0;
var merchantId = "";
var currentMonth = "";
var jsondata = [];
var revisedjson = [];
var storage = multer.diskStorage(
{
    destination: (req, file, cb) =>
    {
        cb(null, 'upload/')
    },
    filename: (req, file, cb) =>
    {
        cb(null, file.originalname)
    }
});
var upload = multer(
{
    storage: storage
});
module.exports = function(app, con)
{
   
    app.post('/api/getAmazon', (req, res) =>
    {
        //Empty File
        fs.truncate('FinalFile/file.csv')
        //Jarray to put final data
        revisedjson = [];
        //Parse Form
        var form = new multiparty.Form();
        form.parse(req)
        form.on('file', function(name, file)
        {
            var tmp_path = file.path;
            var target_path = 'FileRecievedFromClient/' + file.originalFilename;
            fs.rename(tmp_path, target_path, function(err)
            {
                if (err) console.log(err)
                readexcelfile(target_path, res);
            });
        })
    });

    function readexcelfile(filepath, res)
    {
        totalnumberofrecords = 0;
        var array = fs.readFileSync(filepath).toString().split("\n");
        var customized_url = array[0].toString().split("\t");
        var newcolumns = {
            'purchase-date': customized_url.indexOf("purchase-date"),
            'buyer-email': customized_url.indexOf("buyer-email"),
            'buyer-name': customized_url.indexOf("buyer-name"),
            'buyer-phone-number': customized_url.indexOf("buyer-phone-number"),
            'sku': customized_url.indexOf("sku"),
            'quantity-purchased': customized_url.indexOf("quantity-purchased"),
            'currency': customized_url.indexOf("currency"),
            'item-price': customized_url.indexOf("item-price"),
            'item-tax': customized_url.indexOf("item-tax"),
            'shipping-price': customized_url.indexOf("shipping-price"),
            'shipping-tax': customized_url.indexOf("shipping-tax"),
            'gift-wrap-price': customized_url.indexOf("gift-wrap-price"),
            'gift-wrap-tax': customized_url.indexOf("gift-wrap-tax"),
            'ship-service-level': customized_url.indexOf("ship-service-level"),
            'recipient-name': customized_url.indexOf("recipient-name"),
            'recipient-email': customized_url.indexOf("recipient-email"),
            'ship-address-1': customized_url.indexOf("ship-address-1"),
            'ship-address-2': customized_url.indexOf("ship-address-2"),
            'ship-address-3': customized_url.indexOf("ship-address-3"),
            'ship-city': customized_url.indexOf("ship-city"),
            'ship-state': customized_url.indexOf("ship-state"),
            'ship-postal-code': customized_url.indexOf("ship-postal-code"),
            'ship-country': customized_url.indexOf("ship-country"),
            'ship-phone-number': customized_url.indexOf("ship-phone-number"),
            'gift-wrap-type': customized_url.indexOf("gift-wrap-type"),
            'gift-message-text': customized_url.indexOf("gift-message-text"),
            'sales-channel': customized_url.indexOf("sales-channel"),
            'is-prime': customized_url.indexOf("is-prime\r")
        }
        var index = customized_url.indexOf("customized-url");
        var order_id_index = customized_url.indexOf("order-id");
        var order_item_id_index = customized_url.indexOf("order-item-id");
        for (i in array)
        {
            var arr = array[i].toString().split("\t")
            if (i == array.length - 1)
            {
                setTimeout(function()
                {
                    writetofile(res)
                    InsertNumberOfRecordsDb(totalnumberofrecords, merchantId, currentnumberofrecords, currentMonth);
                    fs.readdir(directory, (err, files) =>
                    {
                        for (const file of files)
                        {
                            fs.unlink(path.join(directory, file), err =>
                            {
                                if (err) throw err;
                            });
                        }
                    });
                }, 60000);
            }
            else
            {
                if (i != 0)
                {
                    checkvalidvalue(arr[index], i, array, newcolumns, arr[order_id_index], arr[order_item_id_index])
                }
            }
        }
    }

    function checkvalidvalue(value, i, inputdata, newcolumns, order_id, order_item_id)
    {
        var sql = "SELECT * FROM custom_amazon.acs_orders where order_id='" + order_id + "' AND order_item_id='" + order_item_id + "'"; //add legacy
        con.query(sql, function(err, result)
        {
            // console.log(value)
            if (value != '' && value != true && null != value && value.includes('http') && result.length == 0)
            {
                // console.log("Downlaoding Zip Files for Order : ", order_id)
                downloadzipfile(value, i, inputdata, newcolumns);
            }
            else
            {
                // console.log(value);
                // console.log("Not Valid URl | Skipped")
            }
        });
    }

    function downloadzipfile(fileUrl, i, inputdata, newcolumns)
    {
        // console.log("Download zip file",fileUrl)
        var output = process.cwd() + '/zips/bootstrap' + i + '.zip';
        request(
        {
            url: fileUrl,
            encoding: null
        }, function(err, resp, body)
        {
            if (err) console.log("err------", err);
            else
            {
                fs.writeFile(output, body, function(err)
                {
                    unzipfile(output, i, inputdata, newcolumns)
                });
            }
        });
    }
    // function tryFn(fn, fallback = null) 
    // {
    //     try
    //     {​​
    //         return fn();​​
    //     }
    //     catch (error)
    //     {​​
    //         return fallback;​​
    //     }​​
    // }
    function getSafe(fn, defaultVal)
    {
        try
        {
            return fn();
        }
        catch (e)
        {
            return defaultVal;
        }
    }

    function unzipfile(filepath, i, inputdata, newcolumns)
    {
        // console.log("Unzip files")
        var zip = new AdmZip(filepath);
        zip.extractAllTo(process.cwd() + "/zipcontent/", /*overwrite*/ true);
        var zipEntries = zip.getEntries();
        zipEntries.forEach(function(zipEntry, element)
        {
            if (zipEntry)
            {
                if (zipEntry.entryName.includes(".json"))
                {
                    a = JSON.parse(zipEntry.getData().toString());
                    var imagename = "";
                    var imagename1 = "";
                    // console.log(typeof a.customizationData.children[0].children[0].children[0].children[0].image !== 'undefined',typeof a.customizationData.children[0].children[0].children[0].children[0].image)
                    // ​​console.log(a?.customizationData?.children[0])
                    // var temp = tryFn(() => a.customizationData.children[0].children[0].children[0].children[0].image);
                    // var temp1 = tryFn(() => a.customizationData.children[1].children[0].children[0].children[0].image);
                    // console.log(temp, temp1)
                    var temp = getSafe(() => a.customizationData.children[0].children[0].children[0].children[0].image, 'nothing');
                    var temp1 = getSafe(() => a.customizationData.children[0].snapshot.imageName, 'nothing');
                    if (temp != 'nothing') imagename = a.customizationData.children[0].children[0].children[0].children[0].image.imageName;
                    if (temp1 != 'nothing') imagename1 = a.customizationData.children[0].snapshot.imageName;
                    if (temp == 'nothing' && temp1 == 'nothing') appenddata(a, i, inputdata, newcolumns, imagename, imagename1);
                    else s3Image(a, i, inputdata, newcolumns, imagename, a.orderItemId, imagename1);
                    // if (temp != 'nothing')
                    // {
                    //     imagename = a.customizationData.children[0].snapshot.imageName;
                    //     console.log(imagename)
                    //     if (temp1 != 'nothing') imagename1 = a.customizationData.children[0].snapshot.imageName;
                    //     s3Image(a, i, inputdata, newcolumns, imagename, a.orderItemId, imagename1);
                    // }
                    // else
                    // {
                    //     if (temp1 != 'nothing')
                    //     {
                    //         imagename1 = a.customizationData.children[0].snapshot.imageName;
                    //         s3Image(a, i, inputdata, newcolumns, imagename, a.orderItemId, imagename1);
                    //     }
                    //     else appenddata(a, i, inputdata, newcolumns, imagename);
                    // }
                    // console.log(imagename);
                    // appenddata(a, i, inputdata, newcolumns, imagename);
                }
                // }
                // catch (e)
                // {
                //     console.log("Error in Extracting Zip",zipEntry.entryName )
                // }
            }
        });
    }
    // s3Image()
    function s3Image(a, i, inputdata, newcolumns, imagename, orderItemId, imagename1)
    {
        var async = require("async");
        let s3 = new S3(
        {
            accessKeyId: 'AKIAIFLO2A5PMP3AID4Q',
            secretAccessKey: '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',
        })
        async.parallel([
            function(callback)
            {
                setTimeout(function()
                {
                    // console.log(imagename)
                    if (imagename != "")
                    {
                        let file = process.cwd() + "/zipcontent/" + imagename;
                        const config = {
                            Key: 'images/' + orderItemId + ".jpg",
                            Bucket: 'amazoncustomsolution',
                            ACL: 'public-read',
                            Body: fs.createReadStream(file),
                        }
                        // console.log(file)
                        s3.upload(config, function(err, data)
                        {
                            // console.log("image1 ",)
                            callback(null, data.Location);
                        })
                    }
                    else
                    {
                        callback(null, "");
                    }
                }, 200);
            },
            function(callback)
            {
                setTimeout(function()
                {
                    if (imagename1 != "")
                    {
                        let file = process.cwd() + "/zipcontent/" + imagename1;
                        const config = {
                            Key: 'images/U-' + orderItemId + ".jpg",
                            Bucket: 'amazoncustomsolution',
                            ACL: 'public-read',
                            Body: fs.createReadStream(file),
                        }
                        s3.upload(config, function(err, data)
                        {
                            callback(null, data.Location);
                        })
                    }
                    else
                    {
                        callback(null, "");
                    }
                }, 200);
            }
        ], function(err, results)
        {
            // console.log(results)
            appenddata(a, i, inputdata, newcolumns, results[0], results[1])
            // console.log(results);
            // the results array will equal [1, 2] even though
            // the second function had a shorter timeout.
        });
        // console.log(a.customizationData.children[0].children[0].children[0].children[0].image)
        // if (temp != 'nothing')
        // {
        //     s3.upload(config, function(err, data)
        //     {
        //         // console.log(data, err)
        //         appenddata(a, i, inputdata, newcolumns, data.Location)
        //         // return data.Location;
        //         // console.log(err, data.Location)
        //     })
        // }
        // else
        // {
        //     console.log("--------")
        //     appenddata(a, i, inputdata, newcolumns, "")
        // }   
    }

    function appenddata(data, i, inputdata, newcolumns, imagepath, imagepath1)
    {
        var newData = inputdata[i].toString().split("\t");
        if (data)
        {
            // console.log("Appending Data")
            // console.log(data.customizationData.children[1].snapshot.imageName)
            var ver;
            var m_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            var today = new Date();
            currentMonth = m_names[today.getMonth()];
            merchantId = data.merchantId;
            var sql = "SELECT * FROM custom_amazon.master_mid where id =" + "'" + merchantId + "'";
            // console.log(merchantId)
            con.query(sql, function(err, result)
            {
                // console.log(result,merchantId)
                if (err || result[0].expiry <= today)
                {
                    console.log(err, "Incorrect Merchant Id");
                    throw err;
                }
                else
                {
                    var p_date = newData[newcolumns['purchase-date']];
                    var o_id = data.orderId;
                    var oi_id = data.orderItemId;
                    var le_id = data.legacyOrderItemId;
                    var d = new Date();
                    d = d.toISOString();
                    var sql = "INSERT INTO custom_amazon.acs_orders VALUES('" + o_id + "','" + oi_id + "','" + p_date + "','" + merchantId + "','" + d + "','" + le_id + "')";
                    con.query(sql, function(err, result)
                    {
                        if (err)
                        {
                            // console.log(err)
                        }
                        else
                        {
                            console.log("success", o_id)
                            totalnumberofrecords++;
                        }
                    });
                    // var imagepath = s3Image(filepath,oname);
                    // console.log(data)
                    currentnumberofrecords = result[0][currentMonth];
                    if (typeof data["version3.0"] !== 'undefined')
                    {
                        for (var i = 0; i < data["version3.0"]["customizationInfo"]["surfaces"].length; i++)
                        {
                            var tempdata = {
                                "orderId": data.orderId,
                                "legacyOrderItemId": data.legacyOrderItemId,
                                "orderItemId": data.orderItemId,
                                "purchase-date": newData[newcolumns['purchase-date']],
                                "buyer-email": newData[newcolumns['buyer-email']],
                                "purchase-date": newData[newcolumns['purchase-date']],
                                "buyer-name": newData[newcolumns['buyer-name']],
                                "buyer-phone-number": newData[newcolumns['buyer-phone-number']],
                                "sku": newData[newcolumns['sku']],
                                "asin": data.asin,
                                "title": data.title,
                                "quantity-purchased": newData[newcolumns['quantity-purchased']],
                                "currency": newData[newcolumns['currency']],
                                "item-price": newData[newcolumns['item-price']],
                                "item-tax": newData[newcolumns['item-tax']],
                                "shipping-price": newData[newcolumns['shipping-price']],
                                "shipping-tax": newData[newcolumns['shipping-tax']],
                                "gift-wrap-price": newData[newcolumns['gift-wrap-price']],
                                "gift-wrap-tax": newData[newcolumns['gift-wrap-tax']],
                                "ship-service-level": newData[newcolumns['ship-service-level']],
                                "recipient-name": newData[newcolumns['recipient-name']],
                                "recipient-email": newData[newcolumns['recipient-email']],
                                "ship-address-1": newData[newcolumns['ship-address-1']],
                                "ship-address-2": newData[newcolumns['ship-address-2']],
                                "ship-address-3": newData[newcolumns['ship-address-3']],
                                "ship-city": newData[newcolumns['ship-city']],
                                "ship-state": newData[newcolumns['ship-state']],
                                "ship-postal-code": newData[newcolumns['ship-postal-code']],
                                "ship-country": newData[newcolumns['ship-country']],
                                "ship-phone-number": newData[newcolumns['ship-phone-number']],
                                "gift-wrap-type": newData[newcolumns['gift-wrap-type']],
                                "gift-message-text": newData[newcolumns['gift-message-text']],
                                "is-prime": newData[newcolumns['is-prime']],
                                "sales-channel": newData[newcolumns['sales-channel']],
                                "quantity": data.quantity,
                                "Surface Name": data["version3.0"]["customizationInfo"]["surfaces"][i]["name"],
                                "OptionLabel1": "",
                                "OptionValue1": "",
                                "OptionLabel2": "",
                                "OptionValue2": "",
                                "OptionLabel3": "",
                                "OptionValue3": "",
                                "TextLabel1": "",
                                "Text1": "",
                                "Colorname1": "",
                                "fontFamily1": "",
                                "TextLabel2": "",
                                "Text2": "",
                                "Colorname2": "",
                                "fontFamily2": "",
                                "TextLabel3": "",
                                "Text3": "",
                                "Colorname3": "",
                                "fontFamily3": "",
                                "TextLabel4": "",
                                "Text4": "",
                                "Colorname4": "",
                                "fontFamily4": "",
                                "TextLabel5": "",
                                "Text5": "",
                                "Colorname5": "",
                                "fontFamily5": "",
                                "UserUploadedImage": imagepath,
                                "ImageURL": imagepath1
                            }
                            var SurfaceLabel = [];
                            var SurfaceText = [];
                            var k = 0;
                            var m = 0
                            for (var j = 0; j < data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"].length; j++)
                            {
                                // console.log(  data.orderId);
                                var ctype = data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"][j]["customizationType"];
                                // console.log(ctype)
                                if (ctype == "TextPrinting")
                                {
                                    var sl = 'TextLabel' + (m + 1);
                                    var st = 'Text' + (m + 1);
                                    var cn = 'Colorname' + (m + 1);
                                    var fm = 'fontFamily' + (m + 1);
                                    // console.log(sl)
                                    tempdata[sl] = data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"][j]["label"];
                                    tempdata[st] = data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"][j]["text"];
                                    tempdata[cn] = data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"][j]["colorName"];
                                    tempdata[fm] = data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"][j]["fontFamily"];
                                    m++;
                                }
                                else
                                {
                                    var sl = 'OptionLabel' + (k + 1);
                                    var so = 'OptionValue' + (k + 1);
                                    tempdata[sl] = data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"][j]["label"];
                                    tempdata[so] = data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"][j]["optionValue"];
                                    k++;
                                }
                                if (j == data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"].length - 1) revisedjson.push(tempdata);
                            }
                        }
                    }
                    else if (data["customizationInfo"] !== 'undefined')
                    {
                        for (var i = 0; i < data["customizationInfo"]["version3.0"]["surfaces"].length; i++)
                        {
                            var tempdata = {
                                "orderId": data.orderId,
                                "legacyOrderItemId": data.legacyOrderItemId,
                                "orderItemId": data.orderItemId,
                                "purchase-date": newData[newcolumns['purchase-date']],
                                "buyer-email": newData[newcolumns['buyer-email']],
                                "purchase-date": newData[newcolumns['purchase-date']],
                                "buyer-name": newData[newcolumns['buyer-name']],
                                "buyer-phone-number": newData[newcolumns['buyer-phone-number']],
                                "sku": newData[newcolumns['sku']],
                                "asin": data.asin,
                                "title": data.title,
                                "quantity-purchased": newData[newcolumns['quantity-purchased']],
                                "currency": newData[newcolumns['currency']],
                                "item-price": newData[newcolumns['item-price']],
                                "item-tax": newData[newcolumns['item-tax']],
                                "shipping-price": newData[newcolumns['shipping-price']],
                                "shipping-tax": newData[newcolumns['shipping-tax']],
                                "gift-wrap-price": newData[newcolumns['gift-wrap-price']],
                                "gift-wrap-tax": newData[newcolumns['gift-wrap-tax']],
                                "ship-service-level": newData[newcolumns['ship-service-level']],
                                "recipient-name": newData[newcolumns['recipient-name']],
                                "recipient-email": newData[newcolumns['recipient-email']],
                                "ship-address-1": newData[newcolumns['ship-address-1']],
                                "ship-address-2": newData[newcolumns['ship-address-2']],
                                "ship-address-3": newData[newcolumns['ship-address-3']],
                                "ship-city": newData[newcolumns['ship-city']],
                                "ship-state": newData[newcolumns['ship-state']],
                                "ship-postal-code": newData[newcolumns['ship-postal-code']],
                                "ship-country": newData[newcolumns['ship-country']],
                                "ship-phone-number": newData[newcolumns['ship-phone-number']],
                                "gift-wrap-type": newData[newcolumns['gift-wrap-type']],
                                "gift-message-text": newData[newcolumns['gift-message-text']],
                                "is-prime": newData[newcolumns['is-prime']],
                                "sales-channel": newData[newcolumns['sales-channel']],
                                "quantity": data.quantity,
                                "Surface Name": data["customizationInfo"]["version3.0"]["surfaces"][i]["name"],
                                "OptionLabel1": "",
                                "OptionValue1": "",
                                "OptionLabel2": "",
                                "OptionValue2": "",
                                "OptionLabel3": "",
                                "OptionValue3": "",
                                "TextLabel1": "",
                                "Text1": "",
                                "Colorname1": "",
                                "fontFamily1": "",
                                "TextLabel2": "",
                                "Text2": "",
                                "Colorname2": "",
                                "fontFamily2": "",
                                "TextLabel3": "",
                                "Text3": "",
                                "Colorname3": "",
                                "fontFamily3": "",
                                "TextLabel4": "",
                                "Text4": "",
                                "Colorname4": "",
                                "fontFamily4": "",
                                "TextLabel5": "",
                                "Text5": "",
                                "Colorname5": "",
                                "fontFamily5": "",
                                "UserUploadedImage": imagepath,
                                "ImageURL": imagepath1
                            }
                            var SurfaceLabel = [];
                            var SurfaceText = [];
                            var k = 0;
                            var m = 0;
                            for (var j = 0; j < data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"].length; j++)
                            {
                                // console.log("--------TEST--------------",ctype)
                                var ctype = data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"][j]["customizationType"];
                                if (ctype == "TextPrinting")
                                {
                                    // console.log("m---->",m)
                                    var sl = 'TextLabel' + (m + 1);
                                    var st = 'Text' + (m + 1);
                                    var cn = 'Colorname' + (m + 1);
                                    var fm = 'fontFamily' + (m + 1);
                                    tempdata[sl] = data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"][j]["label"];
                                    tempdata[st] = data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"][j]["text"];
                                    tempdata[cn] = data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"][j]["colorName"];
                                    tempdata[fm] = data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"][j]["fontFamily"];
                                    m++;
                                }
                                else
                                {
                                    var sl = 'OptionLabel' + (k + 1);
                                    var so = 'OptionValue' + (k + 1);
                                    tempdata[sl] = data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"][j]["label"];
                                    tempdata[so] = data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"][j]["optionValue"];
                                    k++;
                                }
                                if (j == data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"].length - 1) revisedjson.push(tempdata);
                            }
                        }
                    }
                    else
                    {
                        console.log("Not Supportedd")
                    }
                    // console.log("Result: " + JSON.stringify(result));
                }
            });
        }
    }

    function InsertNumberOfRecordsDb(records, merchantId, value, Month)
    {
        // console.log(records, merchantId, value, Month)
        // var sql = "SELECT * FROM custom_amazon.master_mid where id =" + "'" + merchantId + "'";
        var total = value + records;
        var sql = "UPDATE custom_amazon.master_mid SET " + Month + " = " + total + " WHERE id =" + "'" + merchantId + "'";
        // console.log(sql)
        con.query(sql, function(err, result)
        {
            if (err) throw err;
            console.log("1 record inserted");
        });
    }

    function writetofile(res)
    {
        // console.log("Writing To file");
        // console.log(revisedjson);
        const Json2csvParser = require('json2csv').Parser;
        const json2csvParser = new Json2csvParser();
        const csv = json2csvParser.parse(revisedjson);
        fs.appendFile('FinalFile/file.csv', csv, (err) =>
        {
            SendFileToClient(res)
        });
    }

    function SendFileToClient(res)
    {
        console.log("Sending File to Client")
        res.writeHead(200,
        {
            "Content-Type": "text/plain",
            "Content-Disposition": "attachment; filename=file.csv"
        });
        fs.createReadStream('FinalFile/file.csv').pipe(res);
        console.log("File Sent")
    }
}