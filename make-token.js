var args = process.argv.slice(2);
if(args.length == 0) {
    console.log('give addresses to generate tokens for as parameters');
    process.exit(1);
}

if (!process.env.APP_PUBLIC_BASEURL || !process.env.TOKEN_SECRET)
{
    console.log('envvars APP_PUBLIC_BASEURL and TOKEN_SECRET required!');
    process.exit(1);
}

const publicAppBaseurl = process.env.APP_PUBLIC_BASEURL;
const secret = process.env.TOKEN_SECRET;

const crypto = require('crypto');

function makeToken (mail) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(mail);
    return hmac.digest('base64');
}


args.forEach((mail) => {
    let token = makeToken(mail);

    console.log(mail);
    console.log(token);

    var verificationURL=publicAppBaseurl + '?mail=' + encodeURIComponent(mail) + '&token=' + encodeURIComponent(token)
    console.log(verificationURL)
});
process.exit(0);