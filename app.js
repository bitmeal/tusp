//// dependencies
// S3
const AWS = require('aws-sdk');

// helpers
const uuid = require('uuid');

// web
const app = require('express')()
var bodyParser = require('body-parser')


//// setup
// setup express
app.use(bodyParser.json());

// setup S3 client
var s3  = new AWS.S3({
          accessKeyId: process.env.MINIO_ACCESS_KEY ,
          secretAccessKey: process.env.MINIO_SECRET_KEY ,
          endpoint: 'http://localhost:' + process.env.MINIO_HOST_PORT ,
          s3ForcePathStyle: true , // needed with minio?
          signatureVersion: 'v4' ,
          sslEnabled: false ,
          region: 'us-east-2'
});




//// app

// s3 presigned url & form-data generation
app.get('/presignedUrl', (req, res) => {
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

// s3 upload complete webhook, to keep the server application stateless
app.post('/s3webhook', (req, res) => {
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

// serve app; depending on auth
app.get('/', (req, res) => {
    // TODO
    res.sendFile(__dirname + 'client/...');
})

// serve stylesheets etc.
app.use(express.static(path.join(__dirname, 'client/assets')));


//// start app
app.listen(process.env.APP_PORT)
