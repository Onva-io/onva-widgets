function init() {
    var removeFrame = function() {
        var frame = document.getElementById('onva-frame-wrapper');

        if (frame) {
            document.body.removeChild(frame);
        }
    };

    var complete = function() {
        console.log('survey complete');

        if (redirect) {
            top.location.href = redirect;
        } else {
            removeFrame();
        }
    };

    var postRender = function() {
        console.log('survey rendered');
    };

    var error = function(data) {
        console.error('survey error');
        console.error(data);
    };

    var preRender = function() {
        var frame = `
        <div id="onva-frame-wrapper">
            <div class="onva-frame-wrapper">
                <a href="javascript:void(0);" id="onva-frame-closer">
                    <svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="503.021px" height="503.021px" viewBox="0 0 503.021 503.021" style="enable-background:new 0 0 503.021 503.021;" xml:space="preserve"> <g> <path d="M491.613,75.643l-64.235-64.235c-15.202-15.202-39.854-15.202-55.056,0L251.507,132.222L130.686,11.407 c-15.202-15.202-39.853-15.202-55.055,0L11.401,75.643c-15.202,15.202-15.202,39.854,0,55.056l120.821,120.815L11.401,372.328 c-15.202,15.202-15.202,39.854,0,55.056l64.235,64.229c15.202,15.202,39.854,15.202,55.056,0l120.815-120.814l120.822,120.814 c15.202,15.202,39.854,15.202,55.056,0l64.235-64.229c15.202-15.202,15.202-39.854,0-55.056L370.793,251.514l120.82-120.815 C506.815,115.49,506.815,90.845,491.613,75.643z"/> </g> </svg>
                </a>
                <div class="onva-frame" id="` + containerId + `">
                </div>
            </div>
        </div>
        `;

        document.body.innerHTML += frame;

        document.getElementById('onva-frame-closer').addEventListener('click', removeFrame);
    };

    window._onva = new Survey(containerId, surveyId, complete, locale, identifier, metadata);

    window._onva.showFrame = function() {
        window._onva.begin(preRender, postRender, error);
    };

    if (triggerId) {
        document.getElementById(triggerId).addEventListener('click', window._onva.showFrame);
    }

    if (!defer) {
        window._onva.showFrame();
    }
}

var script = document.currentScript;
var containerId = script.getAttribute('data-container-id') || 'onva-frame';
var surveyId = script.getAttribute('data-survey-uuid');
var defer = ((script.getAttribute('data-defer') || '') == 'true');
var triggerId = ((script.getAttribute('data-trigger-id') || '') == 'true');

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

        var script = document.createElement('script');
        script.async = true;
        script.addEventListener('load', init, false);
        script.src = onva_js;
        document.body.appendChild(script);
    });
}

