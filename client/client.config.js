var staticConfig = {
    local_styles: [
        "style.css"
    ],
    styles: [
        "https://cdn.jsdelivr.net/npm/@mdi/font@4.x/css/materialdesignicons.min.css",
        "https://cdn.jsdelivr.net/npm/vue-material@1.0.0-beta-11/dist/vue-material.min.css",
        "https://cdn.jsdelivr.net/npm/vue-material@1.0.0-beta-11/dist/theme/default.css",
        "https://cdn.jsdelivr.net/npm/vuetify@1.5.24/dist/vuetify.min.css",
        "https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900",
        "https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css"
        ],
    scripts: [
        "https://cdn.jsdelivr.net/npm/vue@2.6.11/dist/vue.min.js",
        "https://cdn.jsdelivr.net/npm/vue-material@1.0.0-beta-11/dist/vue-material.min.js",
        "https://cdn.jsdelivr.net/npm/vuetify@1.5.24/dist/vuetify.min.js"
        ],
    local_scripts: []
    };

class clientConfig {
    constructor(appname, baseurl) {
        this.appname = appname;
        this.baseurl = baseurl;

        this.styles = staticConfig.styles
        staticConfig.local_styles.forEach((style) => {
            this.styles.push(this.baseurl + style);
        });

        this.scripts = staticConfig.scripts
        staticConfig.local_scripts.forEach((script) => {
            this.scripts.push(this.baseurl + script);
        });
    }

    extend(config) {
        var self = Object.assign({}, this);
        if (config.styles !== undefined) {
            self.styles = self.styles.concat(config.styles);
        }
        
        if (config.scripts !== undefined) {
            self.scripts = self.scripts.concat(config.scripts);
        }

        if (config.local_styles !== undefined) {
                config.local_styles.forEach((style) => {
                self.styles.push(self.baseurl + style);
            });
        }

        if (config.local_scripts !== undefined) {
            config.local_scripts.forEach((script) => {
                self.scripts.push(self.baseurl + script);
            });
        }

        return self;
    }

}

function init(appname, baseurl) {
    return new clientConfig(appname, baseurl);
}

module.exports.init = init;
module.exports.clientConfig = clientConfig;