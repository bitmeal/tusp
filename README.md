# tusp
**T**eam **u**pload & **s**haring **P**roject

*Share files with your team - backed by any S3-compatible storage.*

**Batteries included:** The provided docker-compose files include a minio instance for completely self-hosted file-sharing.

## run
Copy `.env.example` to `.env` and adjust settings. To bring up minio, in root of repo, run (`-d` being optional and starting containers in background):
```
docker-compose up [-d]
```

## customize app
### running behind nginx
TODO
### persist storage
Copy `docker-compose.override.yaml.example` as template to `docker-compose.override.yaml`. Configure volumes mounted by minio for persistent data storage in your new *override* file.


## dev
for development outside of a docker container on windows: run the app through the provided environment loader as
```
win-exec-compose.env.cmd node app.js
```
a postman collection, configured for running the app on your local machine, can be found as `tusp.postman_collection.json` and may be used for development and testing.