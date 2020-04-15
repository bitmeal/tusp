//// dependencies
// S3
const AWS = require('aws-sdk');

// helpers
const uuid = require('uuid');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime-types');
// web
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
const nunjucks = require('nunjucks');

const clientConfig = require('./client/client.config');


//// user config:
const mailSuffix = process.env.MAIL_SUFFIX;
const secret = process.env.TOKEN_SECRET || 'MYSECRET';

const appName = process.env.APP_NAME || '{tusp}';
const publicAppBaseurl = process.env.APP_PUBLIC_BASEURL || 'http://localhost:8080/';
const s3bucket = process.env.MINIO_DEFAULT_BUCKET;
const s3endpoint = process.env.S3_ENDPOINT;
const postSigner = process.env.POST_SIGN_ENDPOINT || 'postsigner';
const webhookName = process.env.WEBHOOK_NAME || 's3webhook';
const port = process.env.APP_PORT || 8080;
const useHTTPS = false;
const cookieMaxAge = 172800000;
const maxFileSize = process.env.MAX_FILESIZE_MB || null;

//clientAssetDir relative to clientDir! (no leading or trailing slashes!)
const clientDir = 'client';
const clientAssetDir = 'assets';
const renderAssetExtensions = ['.css'];
const assetRenderData = {};


//// setup
// setup express
var app = express();
app.use(bodyParser.json());
app.use(cookieParser())


// setup nunjucks
nunjucks.configure(clientDir, {
    autoescape: true,
    express: app
});

// client config
var clientCfg = clientConfig.init(appName, publicAppBaseurl);



// setup S3 client
var s3  = new AWS.S3({
          accessKeyId: process.env.MINIO_ACCESS_KEY ,
          secretAccessKey: process.env.MINIO_SECRET_KEY ,
          endpoint: s3endpoint,
          s3ForcePathStyle: true , // needed with minio?
          signatureVersion: 'v4' ,
          sslEnabled: false ,
          region: 'us-east-2'
});



//// app

function makeToken (mail) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(mail);
    return hmac.digest('base64');
}
  
function verifyMailTokenPair (mail, token) {
    if(!(
      mail == undefined || mail === undefined || mail == "undefined" || mail == 'undefined' ||
      token == undefined || token === undefined || token == "undefined" || token == 'undefined'
      )) {
      return token == makeToken (mail);
    } else {
      return false;
    }
}

function isAuth (req, cb) {
    function parseCookies (request) {
        var list = {},
            rc = request.headers.cookie;

        rc && rc.split(';').forEach(function( cookie ) {
            var parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
        });

        return list;
    }
    let cookies = parseCookies(req);

    if (verifyMailTokenPair(req.query.mail, req.query.token)) {
        console.log(req.query.mail, req.query.token);
        cb(req.query.mail, req.query.token);
        return true;
    }
    else if( verifyMailTokenPair(cookies.mail, cookies.token)) {
        console.log(cookies.mail, cookies.token);
        cb(cookies.mail, cookies.token);
        return true;
    }
    else {
        return false;
    }
}
  
function setCookies (res, mail, token, maxAge=cookieMaxAge) {
    res.cookie('mail', mail, {
      maxAge: maxAge,
      httpOnly: true,
      secure: useHTTPS
     });
    res.cookie('token', token, {
      maxAge: maxAge,
      httpOnly: true,
      secure: useHTTPS
    });
  
}
  
function deleteCookies (res) {
    setCookies(res, '', '', 0);
}  

// register mail addres // get token
app.get('/register', function(req, res){
    // TODO: check mail valid!?
    
    const mail = req.query.mailprefix + mailSuffix;
    const token = makeToken(mail);

    console.log('request for address:', mail);
    var verificationURL=publicAppBaseurl + '?mail=' + encodeURIComponent(mail) + '&token=' + encodeURIComponent(token)
    console.log(verificationURL)
    
    res.sendStatus(200);
    
    //not valid =>
    //res.sendStatus(403);
})

// s3 presigned url & form-data generation
app.get('/' + postSigner, (req, res) => {
    if(!isAuth(req, (mail, token) => {
        
        if (req.query.finalize !== undefined){
            uploadData = JSON.parse(req.query.finalize);
            

            console.log('uploadData: ', JSON.stringify(uploadData));


            s3.listParts(uploadData, (err, data) => {
                if (err) {
                    console.error('Getting part list encountered an error', err);
                    res.sendStatus(500);
                    return;
                } else {
                    uploadData['MultipartUpload'] = {Parts: data.Parts};
                    uploadData['MultipartUpload']['Parts'].forEach((part) => {
                        delete part['LastModified'];
                        delete part['Size'];
                    });
                    // uploadData.Metadata = {
                    //     'x-amz-meta-token': token,
                    //     'x-amz-meta-mail': mail
                    // }
                    console.log(JSON.stringify(uploadData));

                    s3.completeMultipartUpload(uploadData, (err, data) => {
                        if (err) {
                            console.error('Finalizing multipart upload encountered an error', err);
                            res.sendStatus(500);
                            return;
                        } else {
                            res.sendStatus(200);
                            return;    
                        }
                    });
                }
            });
            return;
        }

        var key = uuid.v4()
        var params = {
            Bucket: s3bucket,
            Key: key,
            Fields: {
                key: key,
                'x-amz-meta-token': token,
                'x-amz-meta-mail': mail
            },
            Conditions: [
                ["starts-with", "$x-amz-meta-filename", ""]
            ]
        };

        console.log('uuid: ', key);

        if (req.query.chunks === undefined) {
            if(req.query.filename === undefined){
                req.sendStatus(404);
                return;
            }
            // no chunking
            s3.createPresignedPost(params, (err, data) => {
                if (err) {
                    console.error('Presigning post data encountered an error', err);
                    res.sendStatus(500);
                    return;
                } else {
                    //console.log('The post data is', data);
                    res.end(JSON.stringify(data))
                    return;
                }
            });
        } else {
            // chunking
            var chunks = req.query.chunks;
            var chunkParams = {};
            chunkParams.Bucket = params.Bucket;
            chunkParams.Key = params.Key;
            chunkParams['Metadata'] = {
                mail: mail,
                token: token,
                filename: req.query.filename
            }

            // request multi part upload
            s3.createMultipartUpload(chunkParams, (err, data) => {
                if (err) {
                    console.error('Creating multipart upload encountered an error', err);
                    res.sendStatus(500);
                    return;
                } else {
                    // sign chunks

                    var uploadID = data.UploadId;

                    var signParams = Object.assign({}, params);
                    delete signParams['Fields'];
                    delete signParams['Conditions'];
                    signParams['Fields'] = {
                        key: signParams.Key,
                        uploadId: uploadID
                    };
                    signParams['UploadId'] = uploadID;
                    console.log(signParams);

                    var signedChunks = {
                        uploadData: data,
                        chunkFields: []
                    }

                    function signChunks(count, num, signedChunks) {
                        if (num <= count){
                            // chunks to go - sign
                            signParams.PartNumber = num;
                            signParams.Fields.partNumber = num;
                            
                            s3.createPresignedPost(signParams,(err, data) => {
                                if (err) {
                                    console.error('Presigning post data encountered an error', err);
                                    res.sendStatus(500);
                                    return;
                                } else {
                                    signedChunks.chunkFields.push(data.Fields);
                                    // prevent callstack from crashing on recursion
                                    setTimeout(() => {
                                        signChunks(count, num + 1, signedChunks);
                                     });
                                    
                                }
                            });
                        
                        } else {
                            // ready - return them
                            res.end(JSON.stringify(signedChunks))
                        }
                    }
        
                    signChunks(chunks, 1, signedChunks);
                    return;
        


                }
            });
        }
    }))
    // not authorized
    {
        res.sendStatus(403);
    }
})

// s3 upload complete webhook, to keep the server application stateless
app.post('/' + webhookName, (req, res) => {
    console.log(JSON.stringify(req.body));
    if (    req.body.EventName == 's3:ObjectCreated:Post' &&
            req.body.Records[0].s3.bucket.name == s3bucket )
    {
        var obucket = req.body.Records[0].s3.bucket.name;
        var oname = req.body.Records[0].s3.object.key;
        var ofname = req.body.Records[0].s3.object.userMetadata['X-Amz-Meta-Filename'];

        //test token and mail, possibly delete if not valid
        var oomail = req.body.Records[0].s3.object.userMetadata['X-Amz-Meta-Mail'];


        var url = s3.getSignedUrl('getObject', {
            Bucket: obucket,
            Key: oname,
            Expires: 600,
            ResponseContentDisposition: 'attachment; filename ="' + ofname + '"'
        });

        console.log('Send mail to: ', oomail);
        console.log(url)
    }

    res.send("");
})

// serve app; depending on auth
app.get('/', (req, res) => {
    // remove cookies?
    if(req.query.deauth !== undefined){
        //remove cookies
        deleteCookies(res);
        res.render('register.njk', { title: 'register | tusp', mailsuffix: mailSuffix, client: clientCfg });
    }
    // is authenticated? show upload form
    else if(!isAuth(req, (mail, token) => {
      // set cookie
      setCookies(res, mail, token);
      // deliver upload form
      res.render('upload.njk', { title: 'upload | tusp', mail: mail, token: token, presigner: postSigner, maxfilesize: String(maxFileSize),
        s3url: `${s3endpoint}/${s3bucket}`,
        client: clientCfg.extend({
            scripts: ["https://cdn.jsdelivr.net/npm/vue2-dropzone@3.6.0/dist/vue2Dropzone.min.js"],
            styles: ["https://cdn.jsdelivr.net/npm/vue2-dropzone@3.6.0/dist/vue2Dropzone.min.css"]
            })
        });
    }))
    // show register form
    {
        res.render('register.njk', { title: 'register | tusp', mailsuffix: mailSuffix, client: clientCfg });
    }
})

// error on unknown post
app.post('/', (req, res) => {
    res.sendStatus(403);
});

// serve rendered "static"
var renderedStaticRoute = '\.*(';
renderAssetExtensions.forEach((ext) => {
    renderedStaticRoute += '\\' + ext + '|';
});
renderedStaticRoute = renderedStaticRoute.slice(0, -1) + ')';
const assetRenderRegExp = new RegExp(renderedStaticRoute);
app.get(assetRenderRegExp, (req, res) => {
    assetRenderData['rand'] = uuid.v4();
    const data = nunjucks.render(clientAssetDir + req.path, assetRenderData);
    const type = mime.lookup(clientDir + '/'+ clientAssetDir + req.path);
    res.set('Content-Type', type);
    res.send(data);
})

// serve static
app.use(express.static(path.join(__dirname, clientDir + '/' + clientAssetDir)));


//// start app
console.log('start listening on:', port);
app.listen(port);
