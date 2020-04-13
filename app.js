//import { v4 as uuidv4 } from 'uuid';
//import AWS from 'aws-sdk';

var AWS = require('aws-sdk');
var uuid = require('uuid');

var s3  = new AWS.S3({
          accessKeyId: process.env.MINIO_ACCESS_KEY ,
          secretAccessKey: process.env.MINIO_SECRET_KEY ,
          endpoint: 'http://localhost:' + process.env.MINIO_HOST_PORT ,
          s3ForcePathStyle: true , // needed with minio?
          signatureVersion: 'v4' ,
          sslEnabled: false ,
          region: 'us-east-2'
});

// Instantiate an `express` server and expose an endpoint called `/presignedUrl` as a `GET` request that
// accepts a filename through a query parameter called `name`. For the implementation of this endpoint,
// invoke [`presignedPutObject`](https://docs.min.io/docs/javascript-client-api-reference#presignedPutObject) 
// on the `Minio.Client` instance to generate a pre-signed URL, and return that URL in the response:

// express is a small HTTP server wrapper, but this works with any HTTP server
const server = require('express')()

var bodyParser = require('body-parser')
server.use(bodyParser.json());

server.get('/presignedUrl', (req, res) => {
    var key = uuid.v4().replace(/-/g, '')
    var params = {
        Bucket: process.env.MINIO_DEFAULT_BUCKET,
        Key: key ,
        Fields: {
            key: key,
            'x-amz-meta-token': 'qwertzuiop',
            'x-amz-meta-mail': 'user@domain.example'
        },
        Conditions: [
            ["starts-with", "$x-amz-meta-filename", ""]
        ]
    };

    console.log('uuid: ', key);

    s3.createPresignedPost(params, function(err, data) {
        if (err) {
          console.error('Presigning post data encountered an error', err);
        } else {
          //console.log('The post data is', data);
          res.end(JSON.stringify(data))
        }
    });
})

server.post('/s3webhook', (req, res) => {
    console.log(JSON.stringify(req.body));
    if (    req.body.EventName == 's3:ObjectCreated:Post' &&
            req.body.Records[0].s3.bucket.name == process.env.MINIO_DEFAULT_BUCKET )
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

server.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
})

server.listen(process.env.APP_PORT)