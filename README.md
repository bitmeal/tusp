# {tusp}
**t**eam **u**pload & **s**haring **p**roject

*Share files with your team - backed by any S3-compatible storage.*

**Batteries included:** *docker-compose* files for a self-hosted minio and a postfix mail-server are included

![client/ui screenshot](client.png)

## the app
**{tusp}** allows you to rapidly spin up a file-sharing service for your team or company. To allow zero-setup time and user self-service for registration, **authentication is based on a common *mail-domain***.

#### requirements
* a single, common mail-domain for your team/company
* S3-compatible storage [*or* enough resources to use the included minio deployment]
  * **multi-part** upload support **required**
* a mail-account for sending mails, using smtp [*or* unblocked port 25 to use the included mailserver]

#### features
* chunked uploading
* nice, ever changing background images by [Lorem Picsum](https://picsum.photos)

## run
Copy `.env.example` to `.env`, adjust settings and bring up the app with (`-d` being optional and starting containers in background):
```
docker-compose up [-d]
```

To run a local minio and local mailserver, configure the settings at the end of your copied `.env` file and run *docker-compose* with all compose-files you wish to include:
```
docker-compose -f docker-compose.yaml -f docker-compose-minio.yaml -f docker-compose-mailer.yaml up [-d]
```
`.minio.env` and `.mailer.env` help setting up the environment, you likely won't need to edit them.


Tu run the app outside of a docker container, import the environment by running the app with:
```
[NIX] $ npm run env
[WIN] $ npm run win-env
```
Environment is loaded from the *docker-compose* `.env`-file. On windows the provided script `win-exec-compose.env.cmd` is used to load the environment.

If your environment is set, simply run:
```shell
npm run app
```

### generate additional access tokens
you may generate additional access tokens and links by using the commands below, analogously to the commands above:
```
$ npm run win-env-token [mail@address [...]]
$ npm run env-token     [mail@address [...]]
$ npm run make-token    [mail@address [...]]
```
These tokens may authenticate arbitrary **addresses not in your configured domain/suffix!** You have to distribute the tokens manually.

### hosted object storage
Be sure to configure:
* your publicly accessible "S3" endpoint URL
* enabling a suitable CORS policy on your bucket **!!**
* most likely use `S3_FORCE_PATH_STYLE_URL=false` for working CORS
* possibly don't forget to set your AWS-region
* think about configuring bucket life-cycle policies

the following examples may be used with *s3cmd*


#### CORS example
In case your storage provider is doing everything right, you may be able to replace the following options and limit access to the desired URL only, else use the wildcard-example below (working on e.g. digitalocean):
* `AllowedOrigin: https://my.domain`
* `AllowedHeader: Access-Control-Allow-Origin`

```xml
<CORSConfiguration>
 <CORSRule>
   <AllowedOrigin>https://my.domain</AllowedOrigin>
   <AllowedMethod>PUT</AllowedMethod>
   <AllowedMethod>GET</AllowedMethod>
   
   <AllowedHeader>Access-Control-Allow-Origin</AllowedHeader>
 </CORSRule>
</CORSConfiguration>
```
as `cors.xml` issue
```
$ s3cmd setcors cors.xml s3://MYBUCKET
```

#### life-cycle policies
```xml
<LifecycleConfiguration>
    <Rule>
        <ID>expire-objects</ID>
        <Prefix></Prefix>
        <Status>Enabled</Status>
        <Expiration>
            <Days>5</Days>
        </Expiration>
    </Rule>
    <Rule>
        <ID>expire-incomplete-multipart</ID>
        <Prefix></Prefix>
        <Status>Enabled</Status>
        <AbortIncompleteMultipartUpload>
            <DaysAfterInitiation>1</DaysAfterInitiation>
        </AbortIncompleteMultipartUpload>
    </Rule>
</LifecycleConfiguration>

<!-- OR /-->

<LifecycleConfiguration>
    <Rule>
        <ID>expire-objects-and-incomplete-uploads</ID>
        <Prefix/>
        <Status>Enabled</Status>
        <Expiration>
            <Days>5</Days>
        </Expiration>
        <AbortIncompleteMultipartUpload>
            <DaysAfterInitiation>1</DaysAfterInitiation>
        </AbortIncompleteMultipartUpload>
    </Rule>
</LifecycleConfiguration>
```
as `lifecycle.xml` issue
```
$ s3cmd setlifecycle lifecycle.xml s3://MYBUCKET
```

### running behind nginx
configure your *docker-compose* environment in `.env`-file. set the following variables to the public accessible addresses and correctly setup the HTTPS config:
```shell
APP_PUBLIC_BASEURL=https://my.domain/tusp/
APP_USE_HTTPS=<true|false>

S3_ENDPOINT_PUBLIC=https://objects.my.domain:9000/s3/
S3_USE_HTTPS=<true|false>
```
**be sure to include trailing slash `/` for `APP_PUBLIC_BASEURL`**

### persist storage of included minio
Copy `docker-compose-minio.override.yaml.example` as `docker-compose-minio.override.yaml` and configure volumes to be mounted by minio for persistent data storage. Add the compose-file to your *docker-compose*-call:
```shell
$ docker-compose [...] -f docker-compose-minio.override.yaml
```
