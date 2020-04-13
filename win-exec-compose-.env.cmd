@echo off
SETLOCAL EnableDelayedExpansion
goto :main

: help
echo.
echo run command from shell with environment from docker-compose .env-file
echo.
echo USAGE:
echo win-exec-compose-.env.cmd ^<commandline-to-execute^>
echo.
echo do NOT surround your commandline by quotes!
echo.
echo EXAMPLE:
echo $^> win-exec-compose-.env.cmd node app.js
exit /B


: main
    :: show help
    if "%1"=="" (call :help & exit /B 1)
    if "%1"=="-?" (call :help & exit /B 1)
    if "%1"=="/?" (call :help & exit /B 1)
    if "%1"=="-h" (call :help & exit /B 1)
    if "%1"=="/h" (call :help & exit /B 1)
    if "%1"=="--help" (call :help & exit /B 1)

    :: get envvars from .env-file
    for /F "tokens=*" %%E in ('findstr /I /R /C:"^[\t ]*[^#].*=.*" .env') do (
        set ENVDEF=%%E
        call :tfnixvars ENVDEF
        call echo setting: !ENVDEF!
        call set !ENVDEF!
    )

    :: exec code given as parameter
    call %*

    goto :EOF


:: loop through all nix-style ${...} variables in envvar definition and
:: transform to win-style %...%
: tfnixvars
    set nixvarstr=!%~1!
    if not "%nixvarstr:${=%"=="%nixvarstr%" (
        call :tfnextnixvar nixvarstr
        call :tfnixvars nixvarstr
    )
    set %~1=%nixvarstr%
    exit /B


:: transforms next nix-style ${...} variable in string to win-style %...%
:: guards nested {} in e.g. json strings
: tfnextnixvar
    set varstr=!%~1!

    set vartailsubstr=!varstr:*${=!

    set varheadsubstr=!varstr:%vartailsubstr%=!
    set varheadsubstr=!varheadsubstr:${=!

    set varsubstr=%vartailsubstr%
    set vartailsubstr=!vartailsubstr:*}=!
    set varsubstr=!varsubstr:}%vartailsubstr%=!

    set varstr=!varheadsubstr!%%!varsubstr!%%!vartailsubstr!
    set %~1=%varstr%
    exit /B
