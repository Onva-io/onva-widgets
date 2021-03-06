function init() {
    var success = function() {
        console.log('survey complete');

        if (redirect) {
            top.location.href = redirect;
        }
    };

    var render = function() {
        console.log('survey rendered');
    };

    var error = function(data) {
        console.error('survey error');
        console.error(data);
    };

    window._onva_simple = new Survey(containerId, surveyId, success, locale, identifier, metadata);

    window._onva_simple.go = function() {
        window._onva_simple.begin(undefined, render, error);
    };

    if (!defer) {
        window._onva_simple.go();
    }
}

var script = document.currentScript;
var containerId = script.getAttribute('data-container-id');
var surveyId = script.getAttribute('data-survey-uuid');
var defer = ((script.getAttribute('data-defer') || '') == 'true');

if (!containerId) {
    console.error('No container ID specified, will not be able to render survey - use data-container-id on script tag');

} else if (!surveyId) {
    console.error('No survey ID specified, will not be able to render survey - use data-survey-uuid on script tag');

} else {
    var identifier = script.getAttribute('data-identifier');
    var metadata = script.getAttribute('data-metadata');
    var locale = script.getAttribute('data-locale') || document.getElementsByTagName('html')[0].lang || 'en';
    var redirect = script.getAttribute('data-redirect-uri');

    if (metadata != "") {
        metadata = JSON.parse(metadata);
    }

    var onva_js = script.src.replace(/\/[\w-]+((\.min)?\.js)$/, "/onva\$1");
    var onva_css = script.src.replace(/\.js$/, '.css');

    window.addEventListener('load', function() {
        var style = document.createElement('link');
        style.type = 'text/css';
        style.rel = 'stylesheet';
        style.media = 'screen';
        style.async = true;
        style.href = onva_css;
        (document.head || document.body).appendChild(style);

        // check if we've already loaded the script
        let loaded = false;

        for (var i = 0; i < document.scripts.length; ++i) {
            if (document.scripts[i].src == onva_js) {
                loaded = true;
                break;
            }
        }

        if (loaded) {
            init();
        } else {
            var script = document.createElement('script');
            script.async = true;
            script.addEventListener('load', init, false);
            script.src = onva_js;
            document.body.appendChild(script);
        }
    });
}
