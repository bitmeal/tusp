# {tusp}
**t**eam **u**pload & **s**haring **p**roject

*Share files with your team - backed by any S3-compatible storage.*

**Batteries included:** The provided docker-compose files include a minio instance for completely self-hosted file-sharing.

## run
Copy `.env.example` to `.env` and adjust settings. To bring up minio, in root of repo, run (`-d` being optional and starting containers in background):
```
docker-compose up [-d]
```
For development outside of a docker container, import the environment by running the app with:
```
[NIX] $ npm run env
[WIN] $ npm run win-env
```
Environment is loaded from the *docker-compose* `.env`-file. On windows the provided script `win-exec-compose.env.cmd node app.js` is used to load the environment.

If your environment is set, run:
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
configure your *docker-compose* environment in `.env`-file. set the following variables to the public accessible addresses:
```bash
APP_PUBLIC_BASEURL=https://my.domain/tusp/
S3_ENDPOINT=https://objects.my.domain:9000/s3/
```
**be sure to include trailing slash `/` for `APP_PUBLIC_BASEURL`**

### persist storage
Copy `docker-compose.override.yaml.example` as template to `docker-compose.override.yaml`. Configure volumes mounted by minio for persistent data storage in your new *override* file.

