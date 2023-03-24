var request = require('request');
var fs = require('fs');
var extract = require('extract-zip')
var multer = require('multer');
var jp = require('jsonpath');

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
function getRandomFileName() {
    var timestamp = new Date().toISOString().replace(/[-:.]/g, "");
    var random = ("" + Math.random()).substring(2, 8);
    var random_number = timestamp + random;
    return random_number;
}

var finalfilename = getRandomFileName();
var merchantwithImage = false;
var storage = multer.diskStorage(
    {
        destination: (req, file, cb) => {
            cb(null, 'upload/')
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname)
        }
    });
var upload = multer(
    {
        storage: storage
    });
module.exports = async function (app, con) {
    app.post('/api/getAmazon', (req, res) => {
        revisedjson = [];
        var form = new multiparty.Form();
        form.parse(req);
        form.on('file', async function (name, file) {
            var tmp_path = file.path;
            var target_path = 'FileRecievedFromClient/' + file.originalFilename;
            fs.rename(tmp_path, target_path, async function (err) {
                if (err) console.log(err)
               await readexcelfile(target_path, res);
            });
        })
    });

   async function readexcelfile(filepath, res) {
        console.log("Reading Excel File")
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
        var customized_url_index = customized_url.indexOf("customized-url");
        var order_id_index = customized_url.indexOf("order-id");
        var order_item_id_index = customized_url.indexOf("order-item-id");
        console.log("array length ==> ", array.length);
       // console.log("array ==> ", array)
       // for (i in array) {
        for (let i = 0; i < array.length; i++) {
            console.log("Reading Individual Orders");
            var arr = array[i].toString().split("\t");
           //Last data read
            if (i == array.length - 1) {
                console.log("array index ==> ", i);
                setTimeout(async function () {
                    if(revisedjson.length > 0){
                        await writetofile(res);
                        await InsertNumberOfRecordsDb(totalnumberofrecords, merchantId, currentnumberofrecords, currentMonth);
                    }else{
                        res.writeHead(200,
                            {
                                "Content-Type": "text/plain",
                                "Content-Disposition": "attachment"
                            });
                            response.write("this has no erros,okk");
                            res.end("hello world\n");
                    }
                   
                    await fs.readdir(directory, async (err, files) => {
                        for (const file of files) {
                            fs.unlink(path.join(directory, file), err => {
                                if (err) throw err;
                            });
                        }
                    });
                }, 90000);
            } else {
                if (i != 0) 
                   await checkvalidvalue(arr[customized_url_index], i, array, newcolumns, arr[order_id_index], arr[order_item_id_index]);
            }
        }
    }

   async function checkvalidvalue(customized_url, index, arrayData, newcolumns, order_id, order_item_id) {
        var sql = "SELECT * FROM custom_amazon.acs_orders where order_id='" + order_id + "' AND order_item_id='" + order_item_id + "'"; //add legacy
        await con.query(sql, async function (err, result) {
            if (customized_url != '' && customized_url != true && null != customized_url && customized_url.includes('http') && result.length == 0) {
                console.log("Order Id doesn't exist in our database ==> ", order_id);

               await downloadzipfile(customized_url, index, arrayData, newcolumns, order_id, order_item_id);
            } 
        });
    }

   async function downloadzipfile(customized_url, index, arrayData, newcolumns, order_id, order_item_id) {
        //var output = process.cwd() + '/zips/bootstrap' + i + '.zip';
        var output = 'zips/bootstrap' + index + '.zip';
        // if (fs.existsSync(output)) {
        //    console.log("Path is exist ====>>");
        // }
        //console.log("customized url ==> ", customized_url);
       await request(
            {
                url: customized_url,
                encoding: null
            }, async function (err, resp, body) {
            if (err) {
                console.log("err------", err);
                return
            } else {
                fs.writeFile(output, body, async function (err) {
                    var stats = fs.statSync(output)
                    var fileSizeInBytes = stats.size / 1024;
                    console.log(output + ":size:" + fileSizeInBytes);
                    if (fileSizeInBytes > 1) {
                       await unzipfile(output, index, arrayData, newcolumns, order_id, order_item_id)
                    }else{
                        console.log("Zip file size less than one byte.....");
                        // return
                    }
                });
            }
        });
    }

    async function getSafe(fn, defaultVal) {
        try {
            // console.log("hello", fn())
            return fn();
        }
        catch (e) {
            return defaultVal;
        }
    }

    async function unzipfile(filepath, index, arrayData, newcolumns, order_id, order_item_id) {
        console.log("Going to Unzip Files(" + index + ") : " + filepath, order_id, order_item_id);
        var m_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        var today = new Date();
        currentMonth = m_names[today.getMonth()];
        var zip = new AdmZip(filepath);
        // zip.extractAllTo(process.cwd() + "/zipcontent/", /*overwrite*/ true);
        zip.extractAllTo("zipcontent/", /*overwrite*/ true);
        var zipEntries = zip.getEntries();
       await zipEntries.forEach(async function (zipEntry, element) {
            if (zipEntry) {
                if (zipEntry.entryName.includes(".json")) {
                    var a = "";
                    a = JSON.parse(zipEntry.getData().toString());
                    // console.log("Name to check", zipEntry.entryName)
                    // console.log(a)
                    var imagename = "";
                    var imagename1 = "";
                    // console.log("merchantValid check", merchantValid)
                    var sql = "SELECT * FROM custom_amazon.master_mid where id =" + "'" + a.merchantId + "'";
                    console.log("Merchant id ==> ", a.merchantId)
                   await con.query(sql, async function (err, result) {
                        console.log("logit:" + a.merchantId, result)
                        if (err || result[0].expiry <= today) {
                            console.log(err, "Incorrect Merchant Id");
                            throw err;
                        } else {
                            currentnumberofrecords = result[0][currentMonth];
                            if (result[0].status == "Advanced") {
                                merchantwithImage = true;
                            }
                            console.log("Going For S3 Storage ==> ", a.orderId, a.legacyOrderItemId, order_id, order_item_id);
                            var temp = await getSafe(() => a.customizationData.children[0].children[0].children[0].children[0].image, 'nothing');
                            var temp1 = await getSafe(() => a.customizationData.children[0].snapshot.imageName, 'nothing');

                            if (typeof temp == 'undefined' || temp == 'nothing') {
                                console.log("temp is undefined / nothing");
                            } else {
                                imagename = a.customizationData.children[0].children[0].children[0].children[0].image.imageName;
                            }


                            if (typeof temp1 == 'undefined' || temp1 == 'nothing') {
                                console.log("temp1 is undefined / nothing");
                            } else {
                                imagename1 = a.customizationData.children[0].snapshot.imageName;
                            }
                            console.log("Merchant with image ==> ", merchantwithImage);

                            //if merchant is advance then merchant with image
                            if (merchantwithImage) {
                               await s3Image(a, index, arrayData, newcolumns, imagename, a.orderItemId, imagename1, merchantwithImage, order_id, order_item_id);
                            } else {
                                await appenddata(a, index, arrayData, newcolumns, imagename, imagename1, "", order_id, order_item_id);
                            }

                            // if (temp == 'nothing' && temp1 == 'nothing' && !merchantwithImage)
                            // {
                            //     appenddata(a, i, inputdata, newcolumns, imagename, imagename1, "", order_id, order_item_id);
                            // }
                            // else if (merchantwithImage)
                            // {
                            //     s3Image(a, i, inputdata, newcolumns, imagename, a.orderItemId, imagename1, merchantwithImage, order_id, order_item_id);
                            // }
                            // else
                            // {
                            //     appenddata(a, i, inputdata, newcolumns, imagename, imagename1, "", order_id, order_item_id);
                            //     console.log("--------LOST----", temp, temp1, merchantwithImage)
                            // }
                        }
                    });
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
   async function s3Image(a, index, arrayData, newcolumns, imagename, orderItemId, imagename1, merchantwithImage, order_id, order_item_id) {
        console.log("Processing For S3 Storage ==> ", order_id, order_item_id);
        var async = require("async");
        let s3 = new S3(
            {
                accessKeyId: 'AKIAIFLO2A5PMP3AID4Q',
                secretAccessKey: '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',
            });
        async.parallel([
           async function (callback) {
               // setTimeout(function () {
                    if (imagename != "") {
                        //let file = process.cwd() + "/zipcontent/" + imagename;
                        let file = "zipcontent/" + imagename;
                        const config = {
                            Key: 'images/' + orderItemId + ".jpg",
                            Bucket: 'amazoncustomsolution',
                            ACL: 'public-read',
                            Body: fs.createReadStream(file),
                        }
                        //s3 image upload
                    //    await s3.upload(config, async function(err, data)
                    //     {
                    //         var temp = await getSafe(() => data.Location, 'nothing');
                    //         if (temp != 'nothing') 
                    //         callback(null, data.Location);
                    //         else 
                    //         callback(null, "");
                    //     });
                    } else {
                        callback(null, "");
                    }
                //}, 200);
            },
            async function (callback) {
                setTimeout(function () {
                    if (imagename1 != "") {
                        // let file = process.cwd() + "/zipcontent/" + imagename1;
                        let file = "zipcontent/" + imagename1;
                        const config = {
                            Key: 'images/U-' + orderItemId + ".jpg",
                            Bucket: 'amazoncustomsolution',
                            ACL: 'public-read',
                            Body: fs.createReadStream(file),
                        };
                        //s3 image upload
                    //    await s3.upload(config, async function(err, data)
                    //     {
                    //         var temp = await getSafe(() => data.Location, 'nothing');
                    //         if (temp != 'nothing') 
                    //         callback(null, data.Location);
                    //         else 
                    //         callback(null, "");
                    //     });
                    }
                    else {
                        callback(null, "");
                    }
                }, 200);
            },
           async function (callback) {
                setTimeout(function () {
                    console.log("Merchant with custom ==> ", merchantwithImage)
                    if (merchantwithImage) {
                        customImage(a, "C-" + orderItemId, callback);
                        // console.log("URL :" ,url1)
                        // callback(null, customImage(a, "C-" + orderItemId));
                    }
                    else {
                        callback(null, "");
                    }
                }, 200);
            },
        ], async function (err, results) {
           await appenddata(a, index, arrayData, newcolumns, results[0], results[1], results[2], order_id, order_item_id)
        });
    }

   async function customImage(data, FinalName, callback) {
        console.log("Inside Custom Image ===");
        let s3 = new S3(
            {
                accessKeyId: 'AKIAIFLO2A5PMP3AID4Q',
                secretAccessKey: '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',
            })
        const { createCanvas, loadImage } = require('canvas');
        var fs = require('fs');

        var temp = await getSafe(() => data.customizationData.children[0].children[0].children[0].buyerPlacement.scale.scaleX, 'nothing');

        if (temp != 'nothing') {
            var scaledpercentw = data.customizationData.children[0].children[0].children[0].buyerPlacement.scale.scaleX;
            var scaledpercenth = data.customizationData.children[0].children[0].children[0].buyerPlacement.scale.scaleY;
            var canvaswidth = data.customizationData.children[0].children[0].children[0].dimension.width;
            var canvasheight = data.customizationData.children[0].children[0].children[0].dimension.height;
            const canvas = await createCanvas(canvaswidth / scaledpercentw, canvasheight / scaledpercenth);
            // console.log("Canvas ; ", canvas.width, canvas.height, data.orderId)
            const ctx = await canvas.getContext('2d');
            var imagename = data.customizationData.children[0].children[0].children[0].children[0].image.imageName
          // await loadImage(process.cwd() + "/zipcontent/" + imagename).then(async (image) => {
            await loadImage("zipcontent/" + imagename).then(async (image) => {
                //image position
                var ImagePosition_x = data.customizationData.children[0].children[0].children[0].position.x;
                var ImagePosition_y = data.customizationData.children[0].children[0].children[0].position.y;
                var buyerposition_x = data.customizationData.children[0].children[0].children[0].buyerPlacement.position.x;
                var buyerposition_y = data.customizationData.children[0].children[0].children[0].buyerPlacement.position.y;
                var finalposition_x = (buyerposition_x - ImagePosition_x) / scaledpercentw;
                var finalposition_y = (buyerposition_y - ImagePosition_y) / scaledpercenth;
                // console.log("Image position", finalposition_x, finalposition_y)
                //Image Dimensions
                var imagewidth = data.customizationData.children[0].children[0].children[0].buyerPlacement.dimension.width;
                var imageheight = data.customizationData.children[0].children[0].children[0].buyerPlacement.dimension.height;
                var scale_image_width = data.customizationData.children[0].children[0].children[0].buyerPlacement.scale.scaleX;
                var scale_image_height = data.customizationData.children[0].children[0].children[0].buyerPlacement.scale.scaleY;
                var finalwidth = (imagewidth * scale_image_width) / scaledpercentw;
                var finalheight = (imageheight * scale_image_height) / scaledpercenth
                // console.log("Image Dimensions", finalwidth, finalheight)
                //ROTATION IMAGE
                var degrees = data.customizationData.children[0].children[0].children[0].buyerPlacement.angleOfRotation;
                if (degrees != 0) {
                    ctx.save();
                    ctx.translate(finalposition_x, finalposition_y);
                    // console.log("translate", finalposition_x, finalposition_y)
                    ctx.rotate(degrees * Math.PI / 180);
                    ctx.drawImage(image, 0, 0, finalwidth, finalheight);
                    ctx.restore();
                } else {
                    ctx.drawImage(image, finalposition_x, finalposition_y, finalwidth, finalheight);
                }
                //---------text ----------//
                ctx.save();
                var text = ""
                try {
                    txt = data.customizationData.children[0].children[0].children[1].children[2].children[0].children[0].inputValue;
                } catch (err) {
                    console.log("Err:", err);
                }

                var temp = await getSafe(() => data.customizationData.children[0].children[0].children[1].children[2].children[0].buyerPlacement.dimension, 'nothing');
                if (temp != 'nothing') {
                    var fontSize = (data.customizationData.children[0].children[0].children[1].children[2].children[0].buyerPlacement.dimension.height * data.customizationData.children[0].children[0].children[1].children[2].children[0].buyerPlacement.scale.scaleY) / scaledpercenth;
                    // console.log("fontsize", fontSize)
                    fontSize = fontSize / 1.13;
                    // console.log(fontSize)
                    ctx.font = fontSize + 'px Arial';
                    //Text POSITION
                    var text_canvasposition_x = data.customizationData.children[0].children[0].children[1].children[2].children[0].position.x;
                    var text_canvasposition_y = data.customizationData.children[0].children[0].children[1].children[2].children[0].position.y;
                    var text_buyerposition_x = data.customizationData.children[0].children[0].children[1].children[2].children[0].buyerPlacement.position.x;
                    var text_buyerposition_y = data.customizationData.children[0].children[0].children[1].children[2].children[0].buyerPlacement.position.y;
                    var text_finalposition_x = (text_buyerposition_x - ImagePosition_x) / scaledpercentw;
                    var text_finalposition_y = (text_buyerposition_y - ImagePosition_y) / scaledpercenth;
                    // console.log("TEXT position", text_finalposition_x, text_finalposition_y)
                    // var text_finalposition_x = (text_buyerposition_x - text_canvasposition_x)/scaledpercentw;
                    // var text_finalposition_y = (text_buyerposition_y - text_canvasposition_y)/scaledpercenth;
                    // console.log("TEXT position", text_finalposition_x, text_finalposition_y)
                    var degrees = data.customizationData.children[0].children[0].children[1].children[2].children[0].buyerPlacement.angleOfRotation;
                    if (degrees != 0) {
                        ctx.save();
                        ctx.textBaseline = "top";
                        ctx.translate(text_finalposition_x, text_finalposition_y);
                        ctx.rotate(degrees * Math.PI / 180);
                        ctx.fillText(txt, 0, 0);
                        ctx.restore();
                    }
                    else {
                        ctx.textBaseline = "bottom";
                        ctx.fillText(txt, text_finalposition_x, text_finalposition_y);
                    }
                }
                // console.log('<img src="' + (canvas) + '" />')
                const buffer = canvas.toBuffer("image/jpeg");
                const buffertostring = buffer.toString('base64');
                //let file = process.cwd() + "/outt/" + FinalName + ".png";
                let file = "outt/" + FinalName + ".png";
               // console.log(file)
               await fs.writeFileSync(file, buffer);
                //fs.writeFileSync(FinalName + ".png", buffer);

                const config = {
                    Key: 'images/U-' + FinalName + ".jpg",
                    Bucket: 'amazoncustomsolution',
                    ACL: 'public-read',
                    Body: buffer,
                }
                // s3.upload(config, function(err, data)
                // {
                //     var temp = getSafe(() => data.Location, 'nothing');
                //     if (temp != 'nothing') callback(null, data.Location);
                //     else callback(null, "");
                //     // callback(null, data.Location);
                // })

                callback(null, file);
            })
        } else {
            callback(null, "");
        }
        // const canvas = createCanvas(171/0.2375, 342/0.2375)

    }

    async function acsIt(jsonString) {
        async function base64_encode(file) {
            // read binary data
            var bitmap = await fs.readFileSync(file);
            // convert binary data to base64 encoded string
            return new Buffer.from(bitmap).toString('base64');
        }
        var orderId = jsonString.orderItemId;
        console.log("acsit@" + jsonString.orderId);

       async function getProcessedSVG(jsonString) {
            var processed = await jp.query(jsonString, '$..[?(@.customizationType=="ImagePrinting")]');
            var uploadedImage = await jp.query(jsonString, '$..[?(@.type=="ImageCustomization")]');
            var uploaded_image = "";
            var processed_svg_name = "";
            var snapshot = await jp.query(jsonString, '$..[?(@.type=="PreviewContainerCustomization")]')[0].snapshot.imageName;

            try {
                var i = 0;
                var svgImage;
                uploaded_image = uploadedImage[i].image.imageName;
                if (uploaded_image != "") {
                    processed_svg_name = "/svgs/" + orderId + '.svg';

                }
                //base64converted = 'data:image/jpeg;base64,' + base64_encode(process.cwd() + "/zipcontent/" + uploadedImage[i].image.imageName);
                base64converted = 'data:image/jpeg;base64,' + base64_encode("zipcontent/" + uploadedImage[i].image.imageName);
                //var bitmap = await fs.readFileSync(process.cwd() + "/zipcontent/" + processed[0].svgImage);
                var bitmap = await fs.readFileSync("zipcontent/" + processed[0].svgImage);
                svgImage = new Buffer.from(bitmap).toString();
                // write buffer to file
                // await fs.writeFileSync(process.cwd() + processed_svg_name, svgImage.replace(uploadedImage[i].image.imageName, base64converted));
                await fs.writeFileSync(processed_svg_name, svgImage.replace(uploadedImage[i].image.imageName, base64converted));
            } catch (error) {
                console.log("Process SVG error ==> ",error)
            }
            return { uploaded_image: uploaded_image, processed_svg_name: processed_svg_name, snapshot: snapshot };
        }

       async function getUserTextfromJson(jsonString) {
            var TextCustomization = await jp.query(jsonString, '$..[?(@.type=="TextCustomization")]');
            var processed = await jp.query(jsonString, '$..svg');

            var lableName = "";
            var lableValue = "";
            var svgImage = "";
            var processed_svg_name = "";
            var snapshot = "";
            var PreviewContainerCustomization = await jp.query(jsonString, '$..[?(@.type=="PreviewContainerCustomization")]');

            try {
                var i = 0;
                lableName = TextCustomization[i].label;
                lableValue = TextCustomization[i].inputValue;
                if (PreviewContainerCustomization.length > 0 && processed.length > 0) {
                    snapshot = PreviewContainerCustomization[0].snapshot.imageName;
                    processed_svg_name = "svgs/" + orderId + '.svg';

                   // var bitmap = await fs.readFileSync(process.cwd() + "/zipcontent/" + processed[0]);
                    var bitmap = await fs.readFileSync("zipcontent/" + processed[0]);
                    svgImage = await new Buffer.from(bitmap).toString();
                   // await fs.writeFileSync(process.cwd() + processed_svg_name, svgImage);
                    await fs.writeFileSync(processed_svg_name, svgImage);
                }

            } catch (error) {
                console.log("user text from json error ==> ", error);
            }
            return { lableName: lableName, lableValue: lableValue, processed_svg_name: processed_svg_name, snapshot: snapshot }

        }
        if (jp.query(jsonString, '$..[?(@.type=="ImageCustomization")]').length) {
            return (getProcessedSVG(jsonString));
        } else {
            return (getUserTextfromJson(jsonString));
        }
    }

   async function appenddata(data, index, arrayData, newcolumns, imagepath, imagepath1, imagepath2, order_id, order_item_id) {
        console.log("Appending the  data ==> ",data);
        var newData = arrayData[index].toString().split("\t");
        if (data) {
            // console.log("Appending Data")
            // console.log(data.customizationData.children[1].snapshot.imageName)
            var ver;
            merchantId = data.merchantId;
            // console.log(result,merchantId)
            var p_date = newData[newcolumns['purchase-date']];
            var o_id = data.orderId;
            var oi_id = data.orderItemId;
            var le_id = data.legacyOrderItemId;
            var d = new Date();
            d = d.toISOString();
            var sql = "INSERT INTO custom_amazon.acs_orders VALUES('" + o_id + "','" + oi_id + "','" + p_date + "','" + merchantId + "','" + d + "','" + le_id + "')";
           await con.query(sql, async function (err, result) {
                console.log("Inserting the data to Db (acs_orders) ==> ", order_id, order_item_id, o_id, oi_id)
                if (err) {
                     console.log("Insert acs_orders error ==> ",err)
                } else {
                    // console.log("success", o_id)
                    totalnumberofrecords++;
                }
            });
            // var imagepath = s3Image(filepath,oname);
            var outputacs = await acsIt(data);
           // console.log(outputacs);
            if (imagepath != "") {
                imagepath = "https://acs.gdtimagepro.com/download/" + imagepath;
            }
            // if(imagepath1!=""){
            //     imagepath1="https://acs.gdtimagepro.com/download/"+imagepath1;
            // }
            if (typeof outputacs.snapshot != "undefined" && outputacs.snapshot != "") {
                imagepath1 = "https://acs.gdtimagepro.com/download/" + outputacs.snapshot;
            }
            if (typeof outputacs.processed_svg_name != "undefined" && outputacs.processed_svg_name != "") {
                imagepath2 = "https://acs.gdtimagepro.com" + outputacs.processed_svg_name;
            }
            // console.log(data)
            var temp = await getSafe(() => data["version3.0"], 'nothing');
            var temp1 = await getSafe(() => data["customizationInfo"], 'nothing');
            var temp2 = await getSafe(() => data["customizationData"], 'nothing');
            // console.log(getSafe(() => data["version3.0"], 'nothing'))
            if (temp != undefined && temp != 'nothing') {
                console.log("v1");
                for (var i = 0; i < data["version3.0"]["customizationInfo"]["surfaces"].length; i++) {
                    var label1 = ""
                    var label1val = ""
                    try {
                        var TextCustomization = await jp.query(data, '$..[?(@.type=="TextCustomization")]')[0];
                        label1 = TextCustomization.label;
                        label1val = TextCustomization.inputValue;
                    } catch (error) {
                        console.log("skypped label ==> ", error);
                    }

                    console.log(label1 + ':' + label1val);

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
                        "TextLabel1": label1,
                        "Text1": label1val,
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
                        "UploadImageURL": imagepath,
                        "ImageURL": imagepath1,
                        "CustomImage": imagepath2,
                    }
                    var SurfaceLabel = [];
                    var SurfaceText = [];
                    var k = 0;
                    var m = 0
                    for (var j = 0; j < data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"].length; j++) {
                        // console.log(  data.orderId);
                        var ctype = data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"][j]["customizationType"];
                        // console.log(ctype)
                        if (ctype == "TextPrinting") {
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
                        } else {
                            var sl = 'OptionLabel' + (k + 1);
                            var so = 'OptionValue' + (k + 1);
                            tempdata[sl] = data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"][j]["label"];
                            tempdata[so] = data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"][j]["optionValue"];
                            k++;
                        }
                        if (j == data["version3.0"]["customizationInfo"]["surfaces"][i]["areas"].length - 1) 
                        revisedjson.push(tempdata);
                    }
                }
            } else if (temp1 != undefined && temp1 != 'nothing') {
                console.log("v2");
                // console.log("Hello",JSON.stringify(data));
                for (var i = 0; i < data["customizationInfo"]["version3.0"]["surfaces"].length; i++) {

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
                        "ImageURL": imagepath1,
                        "CustomImage": imagepath2,
                    }
                    var SurfaceLabel = [];
                    var SurfaceText = [];
                    var k = 0;
                    var m = 0;
                    for (var j = 0; j < data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"].length; j++) {
                        // console.log("--------TEST--------------",ctype)
                        var ctype = data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"][j]["customizationType"];
                        if (ctype == "TextPrinting") {
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
                        } else {
                            var sl = 'OptionLabel' + (k + 1);
                            var so = 'OptionValue' + (k + 1);
                            tempdata[sl] = data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"][j]["label"];
                            tempdata[so] = data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"][j]["optionValue"];
                            k++;
                        }
                        if (j == data["customizationInfo"]["version3.0"]["surfaces"][i]["areas"].length - 1) 
                        revisedjson.push(tempdata);
                    }
                }
            } else if (temp2 != undefined && temp2 != 'nothing') {
                console.log("v3");
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
                    // "Surface Name": data["customizationInfo"]["version3.0"]["surfaces"][i]["name"],
                    "OptionLabel1": "",
                    "OptionValue1": "",
                    "OptionLabel2": "",
                    "OptionValue2": "",
                    "OptionLabel3": "",
                    "OptionValue3": "",
                    "OptionLabel4": "",
                    "OptionValue4": "",
                    "OptionLabel5": "",
                    "OptionValue5": "",
                    "UserUploadedImage": imagepath,
                    "ImageURL": imagepath1,
                    "CustomImage": imagepath2,
                }
                var k = 0;
                var m = 0;
                var temp4 = await getSafe(() => data["customizationData"]["children"][0]["children"], 'nothing');
                if (temp != "nothing") {
                    for (var j = 0; j < data["customizationData"]["children"][0]["children"].length; j++) {
                        // console.log(data["customizationData"]["children"][0]["children"][j])
                        if (data["customizationData"]["children"][0]["children"][j]["type"] == "OptionCustomization") {
                            // var tl =  'OptionLabel' + (m + 1);
                            tempdata['OptionLabel' + (m + 1)] = data["customizationData"]["children"][0]["children"][j]["name"];
                            tempdata['OptionValue' + (m + 1)] = data["customizationData"]["children"][0]["children"][j]["optionSelection"]["label"];
                            m++
                        }
                        else if (data["customizationData"]["children"][0]["children"][j]["type"] == "FlatRatePriceDeltaContainerCustomization") {
                            tempdata['OptionLabel' + (m + 1)] = data["customizationData"]["children"][0]["children"][j]["name"];
                            tempdata['OptionValue' + (m + 1)] = data["customizationData"]["children"][0]["children"][j]["children"][0]["inputValue"];
                            m++
                        }
                        else if (data["customizationData"]["children"][0]["children"][j]["type"] == "ContainerCustomization") {
                            tempdata['OptionLabel' + (m + 1)] = data["customizationData"]["children"][0]["children"][j]["name"];
                            tempdata['OptionValue' + (m + 1)] = data["customizationData"]["children"][0]["children"][j]["children"][0]["inputValue"];
                            m++
                        }
                        else {
                            console.log("Invalid Custom")
                        }
                        if (j == data["customizationData"]["children"][0]["children"].length - 1) 
                        revisedjson.push(tempdata);
                    }
                }
            } else {
                console.log("Not Supported")
            }
            // console.log("Result: " + JSON.stringify(result));
        }
    }

    function InsertNumberOfRecordsDb(records, merchantId, value, Month) {
        console.log("Insert Final No Of orders processed")
        // console.log(records, merchantId, value, Month)
        // var sql = "SELECT * FROM custom_amazon.master_mid where id =" + "'" + merchantId + "'";
        var total = value + records;
        var sql = "UPDATE custom_amazon.master_mid SET " + Month + " = " + total + " WHERE id =" + "'" + merchantId + "'";
        console.log(sql, records, value)
        con.query(sql, function (err, result) {
            if (err) throw err;
            console.log(" Record inserted");
        });
    }


    async function writetofile(res) {
        console.log("Writing To file" + finalfilename);
        console.log("received json ==> ", revisedjson);
        const Json2csvParser = require('json2csv').Parser;
        const json2csvParser = new Json2csvParser();
       
            const csv = json2csvParser.parse(revisedjson);

            await fs.truncate('FinalFile/' + finalfilename + '.csv', 0, async function () {
             await fs.appendFile('FinalFile/' + finalfilename + '.csv', csv, async (err) => {
                 await SendFileToClient(res, finalfilename);
                 });
             })
          
       
        // fs.appendFile('FinalFile/file.csv', csv, (err) =>
        // {
        //     SendFileToClient(res)
        // });
    }

   async function SendFileToClient(res, finalfilename) {
        console.log("Sending File to Client")
        res.writeHead(200,
            {
                "Content-Type": "text/plain",
                "Content-Disposition": "attachment; filename=" + finalfilename + ".csv"
            });
        fs.createReadStream('FinalFile/' + finalfilename + '.csv').pipe(res);
        console.log("File Sent")
    }
}
