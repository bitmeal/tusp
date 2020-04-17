//// dependencies
// S3
const AWS = require('aws-sdk');

// helpers
const uuid = require('uuid');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime-types');
const mailvalidator = require("email-validator");

// web
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
const nunjucks = require('nunjucks');
const rateLimiter = require('limiter').RateLimiter;
const appRateLimiter = require("express-rate-limit");

// mailing
const nodemailer = require("nodemailer");

// frontend
const clientConfig = require('./client/client.config');


//// user config:
const mailSuffix = process.env.MAIL_SUFFIX;
const secret = process.env.APP_TOKEN_SECRET;
const cookieMaxAge = process.env.APP_COOKIE_LIFETIME || 172800000;

const appName = process.env.APP_NAME || '{tusp}';
const publicAppBaseurl = process.env.APP_PUBLIC_BASEURL || 'http://localhost:8080/';
const port = process.env.APP_PORT || 8080;
const useHTTPS = ( ( process.env.APP_USE_HTTPS && process.env.APP_USE_HTTPS == "true" ) ? true : false );
const signingEndpoint = process.env.APP_SIGNING_ENDPOINT || 'presigner';
const s3bucket = process.env.S3_BUCKET;
const s3endpoint = process.env.S3_ENDPOINT_PUBLIC;
const s3UseHTTPS = ( ( process.env.S3_USE_HTTPS && process.env.S3_USE_HTTPS == "true" ) ? true : false );
const s3ReqLimit = parseInt(process.env.S3_REQ_LIMIT || 5500);
const s3ReqLimitPer = process.env.S3_REQ_LIMIT_PER || 'second';

const apiReqLimit = parseInt(process.env.APP_USER_API_REQ_LIMIT || 100);
const registerReqLimit = parseInt(process.env.APP_USER_REGISTER_REQ_LIMIT || 1);
const downloadExpiry = parseInt(process.env.APP_DOWNLOAD_LINK_LIFETIME_SEC || 900);
const chunkSizeMB = parseInt(process.env.APP_UPLOAD_CHUNK_SIZE_MB || 32);
const maxFileSize = parseInt(process.env.APP_MAX_FILESIZE_MB || null);
const chunkTimeout = parseInt(process.env.APP_UPLOAD_TIMEOUT_MS || 30000);

const mailing = ( ( process.env.MAILING_ENABLED && process.env.MAILING_ENABLED == "true" ) ? true : false );
const mailingDemo = ( ( process.env.MAILING_DEMO && process.env.MAILING_DEMO == "true" ) ? true : false );
const mailFrom = process.env.MAIL_FROM || 'tusp';
const smtpPort = process.env.SMTP_PORT || 25;
const smtpServer = process.env.SMTP_SERVER || 'mailer';
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpSecure = ( ( process.env.SMTP_SECURE && process.env.SMTP_SECURE == "true" ) ? true : false );



//// setup
// setup express
var app = express();
app.use(bodyParser.json());
app.use(cookieParser())
app.set('trust proxy', 1);

//clientAssetDir relative to clientDir! (no leading or trailing slashes!)
const clientDir = 'client';
const clientAssetDir = 'assets';
const renderAssetExtensions = ['.css'];
const assetRenderData = {};

// setup nunjucks
nunjucks.configure(clientDir, {
    autoescape: true,
    express: app
});


// client/front-end config
var clientCfg = clientConfig.init(appName, publicAppBaseurl);

// setup rate limiting
var s3RateLimiter = new rateLimiter(s3ReqLimit, s3ReqLimitPer);
const apiRateLimiter = appRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: apiReqLimit 
});
const registerRateLimiter = appRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: registerReqLimit 
});

// setup S3 client
var s3  = new AWS.S3({
          accessKeyId: process.env.S3_ACCESS_KEY ,
          secretAccessKey: process.env.S3_SECRET_KEY ,
          endpoint: s3endpoint,
          s3ForcePathStyle: true , // needed with minio?
          signatureVersion: 'v4' ,
          sslEnabled: s3UseHTTPS ,
          region: 'us-east-2'
});


// setup mailing
var transporter;
if(mailing)
{
    if(mailingDemo)
    {
        nodemailer.createTestAccount((err, account) => {
            if(err) {
                console.error('creating mail account failed:', err);
                process.exit(1);
            }

            console.log('created temporary account @ethereal.email');
            console.log('user:', account.user);
            console.log('pass:', account.pass);
            // create reusable transporter object using the default SMTP transport
            transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: account.user, // generated ethereal user
                    pass: account.pass // generated ethereal password
                }
            });
        });
    }
    else
    {
        transporter = nodemailer.createTransport({
            host: smtpServer,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });

    }

}

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
app.get('/register', registerRateLimiter, function(req, res){
    // mail verification: just check if it does include '@', the suffix/domain is appended server-side
    if (req.query.mailprefix === undefined) { res.sendStatus(404); return; }
        
    var mailPrefix = req.query.mailprefix;
    const mail = mailPrefix + mailSuffix;
    if (!mailvalidator.validate(mail)){ res.sendStatus(403); return; }

    const token = makeToken(mail);

    console.log('request for address:', mail);
    var verificationURL=publicAppBaseurl + '?mail=' + encodeURIComponent(mail) + '&token=' + encodeURIComponent(token)
    console.log(verificationURL)
    
    let registerMail = {
        from: mailFrom,
        to: mail,
        subject: `Your access-token for ${appName}`,
        text: `Visit this link to access ${appName}:\n${verificationURL}\n\nCheers {tusp}`
    };
    
    if (mailing) { 
        transporter.sendMail(registerMail, (err, info) => {
            if(err){
                res.sendStatus(500);
            } else {
                res.sendStatus(200);
            }
        });
    } else {
        res.sendStatus(200);
    }
})

// s3 presigned url & form-data generation
app.get('/' + signingEndpoint, apiRateLimiter, (req, res) => {
    if(!isAuth(req, (mail, token) => {
        
        if (req.query.chunks !== undefined && req.query.filename !== undefined)
        {
            s3RateLimiter.removeTokens(1, () => {
                var chunks = req.query.chunks;
                var params = {
                    Bucket: s3bucket,
                    Key: uuid.v4(),
                    Metadata: {
                        mail: mail,
                        token: token,
                        filename: req.query.filename
                    }
                };

                console.log('uuid: ', params.Key);

                // request multi part upload
                s3.createMultipartUpload(params, (err, data) => {
                    if (err) {
                        console.error('Creating multipart upload encountered an error', err);
                        res.sendStatus(500);
                        return;
                    } else {
                        // sign chunks
                        var chunkParams = Object.assign({}, params);
                        delete chunkParams['Metadata'];
                        chunkParams['UploadId'] = data.UploadId;
                        // console.log(signParams);

                        var signedChunks = {
                            uploadData: data,
                            chunkUrls: []
                        }

                        function signChunks(count, num, signedChunks) {
                            if (num <= count){
                                // chunks to go -> sign them
                                chunkParams.PartNumber = num;
                                
                                s3RateLimiter.removeTokens(1, () => {
                                    s3.getSignedUrl('uploadPart', chunkParams,(err, data) => {
                                        if (err) {
                                            console.error('Presigning post data encountered an error', err);
                                            res.sendStatus(500);
                                            return;
                                        } else {
                                            signedChunks.chunkUrls.push(data);
                                            // prevent callstack from crashing on recursion
                                            setTimeout(() => {
                                                signChunks(count, num + 1, signedChunks);
                                            });
                                        }
                                    });
                                });
                            } else {
                                // ready -> return them
                                res.end(JSON.stringify(signedChunks))
                            }
                        }
            
                        signChunks(chunks, 1, signedChunks);
                        return;
                    }
                });
            });
        }
        else if (req.query.finalize !== undefined)
        {
            s3RateLimiter.removeTokens(4, () => {
                uploadData = JSON.parse(req.query.finalize);
                // console.log('uploadData: ', JSON.stringify(uploadData));

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
                        // console.log('Multipart Upload Parts:');
                        // console.log(JSON.stringify(uploadData['MultipartUpload']['Parts']));
                        // console.log(JSON.stringify(uploadData));

                        s3.completeMultipartUpload(uploadData, (err, data) => {
                            if (err) {
                                console.error('Finalizing multipart upload encountered an error', err);
                                res.sendStatus(500);
                                return;
                            } else {
                                // finalized -> send mail
                                // get metadata
                                let key = data.Key;
                                s3.headObject({Bucket: s3bucket, Key: key}, (err, data) => {
                                    if (err) {
                                        console.error('Retrieving the uploaded object encountered an error', err);
                                        res.sendStatus(500);
                                        return;
                                    } else {
                                        console.log('headObject yield:', data);
                                        let mail = data.Metadata.mail;
                                        let filename = data.Metadata.filename;
                                        var url = s3.getSignedUrl('getObject', {
                                            Bucket: s3bucket,
                                            Key: key,
                                            Expires: downloadExpiry,
                                            ResponseContentDisposition: 'attachment; filename ="' + filename + '"'
                                        });
                                
                                        console.log('Send mail to: ', mail);
                                        console.log(url)
                                
                                        let downloadMail = {
                                            from: mailFrom,
                                            to: mail,
                                            subject: `Your download for '${filename}' from ${appName} is ready!`,
                                            text: `Download '${filename}':\n${url}\n\nCheers {tusp}`
                                        };
                                        
                                        if (mailing) { transporter.sendMail(downloadMail); };
            
                                        res.sendStatus(200);
                                        return;
                                    }
                                });
                            }
                        });
                    }
                });
            });
            return;
        
        } else {
            req.sendStatus(404);
            return;
        }

    }))
    // not authorized
    {
        res.sendStatus(403);
        return;
    }
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
      res.render('upload.njk', {
        title: 'upload | tusp',
        mail: mail,
        token: token,
        presigner: signingEndpoint,
        chunksize: chunkSizeMB * 1000000,
        chunktimeout: chunkTimeout,
        maxfilesize: String(maxFileSize),
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
