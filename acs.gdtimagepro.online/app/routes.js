var request = require('request');
var fs = require('fs');
var multiparty = require("multiparty");
module.exports = function(app, merchant_id)
{
    app.get('/', function(req, res)
    {
        res.render('index.html')
    })
    app.get('/ACS-terms-of-service', function(req, res)
    {
        res.render('terms.html')
    })
	app.get('/download/*', function(req, res)
    {
		var name = req.originalUrl;
		name = name.split("/", 3)
		
		var file = fs.createReadStream('../zipcontent/'+name[2]);
    var stat = fs.statSync('../zipcontent/'+name[2]);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', 'attachment; filename='+name[2]);
    file.pipe(res);
		
         //res.send(`User is ${name[2]}`);
		// res.pipe(fs.createWriteStream('zipcontent/abc.txt'));
    })
    app.get('/svgs/*', function(req, res)
    {
		var name = req.originalUrl;
		name = name.split("/", 3)
		
		var file = fs.createReadStream('../svgs/'+name[2]);
    var stat = fs.statSync('../svgs/'+name[2]);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'image/svg');
    res.setHeader('Content-Disposition', 'attachment; filename='+name[2]);
    file.pipe(res);
		
         //res.send(`User is ${name[2]}`);
		// res.pipe(fs.createWriteStream('zipcontent/abc.txt'));
    })
    app.post('/', function(req, res, next)
    {
        console.log("File -> Server")
        var form = new multiparty.Form();
        form.on('part', function(formPart)
        {
           // console.log(formPart)
            var contentType = formPart.headers['content-type'];
            var formData = {
                file:
                {
                    value: formPart,
                    options:
                    {
                        // client_key: client_key,
                        // merchant_id : merchant_id,
                        filename: formPart.filename,
                        contentType: contentType,
                        knownLength: formPart.byteCount
                    }
                }
            };
            request.post(
            {
                url: 'http://localhost:5041/api/getAmazon',
                formData: formData,
                data:
                {
                    merchant_id: merchant_id
                },
                preambleCRLF: true,
                postambleCRLF: true
            }, function(error, response, body)
            {
                console.log("received");
                console.log("error ==> ",error);
                console.log("response ==> ",response);
                 console.log("body ==> ",body);
                fs.writeFile(formPart.filename + '.csv', body, function(err)
                {
                    if (err)
                    {
                        return console.log(err);
                    }
                     // res.write("Successful")

                    res.download(formPart.filename + '.csv')
                  // ?  res.send("Successful")

                    console.log("The file was saved!");
                });
            });
        });
        form.on('error', function(error)
        {
            console.log("error form")
            console.log(error)

            next(error);
        });
        form.parse(req);
        // console.log(res)
        // res.dowload(file)
        // form.parse(req);
    });
}
