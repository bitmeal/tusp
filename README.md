# {tusp}
**t**eam **u**pload & **s**haring **p**roject

*Share files with your team - backed by any S3-compatible storage.*

**Batteries included:** *docker-compose* files for a self-hosted minio and a postfix mail-server are included

## the app
{tusp} allows you to rapidly spin up a file-sharing service for your team or company. To allow zero-setup time and user self-service for registration, **authentication is based on a common *mail-domain***.

#### requirements
* a single, common mail-domain for your team/company
* S3-compatible storage [*or* enough resources to use the included minio deployment]
  * **multi-part** upload support **required**
* a mail-account for sending mails, using smtp [*or* unblocked port 25 to use the included mailserver]

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
Environment is loaded from the *docker-compose* `.env`-file. On windows the provided script `win-exec-compose.env.cmd node app.js` is used to load the environment.

If your environment is set, simply run:
```bash
npm run app
```

### generate additional access tokens
you may generate additional access tokens and links by using the commands below, analogously to the commands above:
```
$ win-env-token [mail@address [...]]
$ env-token     [mail@address [...]]
$ make-token    [mail@address [...]]
```
These tokens may authenticate arbitrary addresses not in your configured domain/suffix!

## customize app
### running behind nginx
configure your *docker-compose* environment in `.env`-file. set the following variables to the public accessible addresses and correctly setup the HTTPS config:
```bash
APP_PUBLIC_BASEURL=https://my.domain/tusp/
APP_USE_HTTPS=<true|false>

S3_ENDPOINT_PUBLIC=https://objects.my.domain:9000/s3/
S3_USE_HTTPS=<true|false>
```
**be sure to include trailing slash `/` for `APP_PUBLIC_BASEURL`**

### persist storage
Copy `docker-compose.override.yaml.example` as template to `docker-compose.override.yaml`. Configure volumes mounted by minio for persistent data storage in your new *override* file.

