var _extend = function (container, iter) {
    var kids = iter.children;
    for (var i = 0; i < kids.length; ++i) {
        container.appendChild(kids[i]);
    }
};

var _escapeHtml = function (unsafe) {
    var x = document.createElement('p');
    x.innerText = unsafe;
    return x.innerHTML;
};

var _variableSwap = function (template, vars) {
    var m;

    while (m = template.match(/{{\s*([^} ]+)\s*}}/)) {
        // m[1] = variable
        // m[0] = full match
        // NOTE: escaping here because we assume everything must be escaped
        var value = '';
        var variable = m[1];
        var doEscape = true;

        if (variable && variable[0] == "!") {
            doEscape = false;
            variable = variable.slice(1);
        }

        if (variable in vars) {
            value = vars[variable];

            if (typeof(value) == 'undefined') {
                value = '';
            }

            value = value.toString();

            if (doEscape) {
                value = _escapeHtml(value);
            }
        } else {
            console.warn('Variable "' + variable + '" found in template but not in variables');
        }

        template = template.replace(m[0], value);
    }

    return template;
};

var _renderTemplateNodes = function (node, vars) {
    for (var i = 0; i < node.childNodes.length; ++i) {
        if (node.childNodes[i].nodeName[0] == '#') {
            node.childNodes[i].nodeValue = _variableSwap(node.childNodes[i].nodeValue, vars);
        } else {
            _renderTemplateNodes(node.childNodes[i], vars);

            for (var a = 0; a < node.childNodes[i].attributes.length; a++) {
                if (node.childNodes[i].attributes[a].nodeValue) {
                    node.childNodes[i].attributes[a].nodeValue = _variableSwap(node.childNodes[i].attributes[a].nodeValue, vars);
                }
            }
        }
    }
};

var _renderTemplateDoc = function (template, vars) {
    var doc = document.createElement('div');
    doc.innerHTML = template;
    _renderTemplateNodes(doc, vars);
    return doc;
};

var _translateError = function(msg, type, locale) {
    translated = msg

    mappings = [
        [ /^field required$/, "Please provide an answer." ],
        [ /^ensure this value has at least 1 items$/, "Please select at least 1 answer." ],
        [ /^ensure this value has at least (\d+) items$/, "Please select at least $1 answers." ]
        [ /^ensure this value has at most 1 items$/, "Please select only 1 answer." ],
        [ /^ensure this value has at most (\d+) items$/, "Please select at most $1 answers." ]
    ];

    for (var m = 0; m < mappings.length; m++) {
        match = mappings[m][0];

        if (msg.match(match)) {
            replace = mappings[m][1];
            translated = msg.replace(match, replace);
            break;
        }
    }

    return translated;
};

var _getLocale = function(locales, locale) {
    var match = locales.filter(function (record) { return record.locale == locale });
    return match[0];
}

var _get = function (url, success, error) {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);

    request.onload = function() {
        var data = null;

        if (this.response) {
            data = JSON.parse(this.response);
        }

        if (this.status >= 200 && this.status < 400) {
            // Success!
            success(data, this.status);
        } else {
            // We reached our target server, but it returned an error
            error(data, this.status);
        }
    };

    // There was a connection error of some sort
    request.onerror = error;

    request.send();
};

var _post = function (url, data, success, error) {
    var request = new XMLHttpRequest();
    request.open('POST', url, true);
    request.setRequestHeader('Content-Type', 'application/json');
    request.onreadystatechange = function() {
        if (request.readyState == 4) {
            var data = null;

            if (request.response) {
                data = JSON.parse(request.response);
            }

            if (request.status == 201) {
                success(data, request.status);
            } else {
                error(data, request.status);
            }
        }
    }; 
    request.onerror = error;
    request.send(JSON.stringify(data));
};

var _parentNodeWithClass = function(element, className) {
    var parNode = element.parentNode;

    while (parNode != document && parNode.className != className) {
        if (!parNode.parentNode) {
            return;
        }

        parNode = parNode.parentNode;
    }

    return parNode;
}

const endpoint = document.currentScript.src.replace(/:\/\/[^\.]+/, '://api').replace(/\/[^\/]+$/, '');

class Survey {
    constructor(containerId, surveyId, completeCallback, locale = 'en', identifier = null, metadata = {}, targetting = {}) {
        this.containerId = containerId;
        this.surveyId = surveyId;
        this.locale = locale;
        this.identifier = identifier;
        this.metadata = metadata;
        this.targetting = targetting;
        this.completeCallback = completeCallback;
        this.submissionUuid = null;
        this.locale = locale;

        // guess the endpoint based on where we're being loaded from - e.g. https://widgets.onva.io/onva.js will be https://api.onva.io
        this.endpoint = endpoint;
        this.surveyClass = 'onva-survey';
        this.questionClass = 'onva-question';
        this.questionsContainerClass = 'onva-questions-container';
        this.answerClass = 'onva-answer';
        this.answerWrapperClass = 'onva-answer-wrapper';
        this.answersContainerClass = 'onva-answers-container';
        this.errorClass = 'onva-error';
        this.actionsWrapperClass = 'onva-actions-wrapper';
        this.actionSubmitClass = 'onva-action-submit';
        this.disabledClass = 'onva-disabled';
        this.moreDetailClass = 'onva-more-detail';

        this.surveyTemplate = `
            <div class="onva-survey" data-survey-id="{{ survey_uuid }}" lang="{{ locale }}" dir="{{ text_direction }}">
                <h2>{{ title }}</h2>
                <p>{{ pre_text }}</p>
                
                <div class="onva-questions-container">
                    <!-- questions will be injected here -->
                </div>

                <p>{{ post_text }}</p>

                <div class="onva-actions-wrapper">
                    <button class="onva-action-submit">Next</button>
                </div>
            </div>
        `;

        this.questionTemplate = `
            <div class="onva-question" data-question-id="{{ question_id }}">
                <h3>{{ content }}</h3>
                <p>{{ pre_text }}</p>
                <div class="onva-error" style="display: none;"></div>

                <div class="onva-answers-container">
                    <!-- answers will be inserted here -->
                </div>

                <p>{{ post_text }}</p>
            </div>
        `;

        this.answerTemplate = `
            <div class="onva-answer-wrapper" data-answer-id="{{ answer_id }}">
                <!-- answer will be injected here -->
            </div>
        `;

        this.errorTemplate = `
            <div class="onva-error"></div>
        `;

        this.moreDetailTemplate = `
            <input type="text" name="{{ name }}" class="onva-more-detail" style="display: none;" data-answer-id="{{ answer_id }}">
        `;

        this.dropdownOptionTemplate = `
            <option value="{{ value }}">{{ content }}</option>
        `;

        this.multiDropdownTemplate = `
            <select name="{{ name }}" id="{{ id }}" multiple class="onva-answer">
                <!-- options will be inserted here -->
            </select>
        `;

        this.singleDropdownTemplate = `
            <select name="{{ name }}" id="{{ id }}" class="onva-answer">
                <option>-- Select</option>
                <!-- options will be inserted here -->
            </select>
        `;

        this.checkboxTemplate = `
            <div class="pretty p-default {{ class }}">
                <input type="checkbox" name="{{ name }}" id="{{ id }}" value="{{ value }}" class="onva-answer" />
                <label for="{{ id }}">{{ content }}</label>
            </div>
        `;

        this.radioTemplate = `
            <div class="pretty p-default {{ class }}">
                <input type="radio" name="{{ name }}" id="{{ id }}" value="{{ value }}" class="onva-answer" />
                <label for="{{ id }}">{{ content }}</label>
            </div>
        `;

        this.radioInlineTemplate = `
            <div class="onva-inline-wrapper">
                <input type="radio" name="{{ name }}" id="{{ id }}" value="{{ value }}" class="onva-answer" />
                <label class="onva-inline" for="{{ id }}">{{ content }}</label>
            </div>
        `;

        this.checkboxInlineTemplate = `
            <div class="onva-inline-wrapper">
                <input type="checkbox" name="{{ name }}" id="{{ id }}" value="{{ value }}" class="onva-answer" />
                <label class="onva-inline" for="{{ id }}">{{ content }}</label>
            </div>
        `;
    }

    begin(preRenderCallback, postRenderCallback, errorCallback) {
        var survey = this;
        var surveyUrl = this.endpoint + '/survey/' + this.surveyId + '/begin/';

        function success(data) {
            if (preRenderCallback) {
                preRenderCallback(data);
            }

            survey.submissionUuid = data.submission_uuid;
            var rendered = survey.renderSurvey(data.survey, data.questions);

            // hook up actions
            var actions = rendered.getElementsByClassName(survey.actionSubmitClass);

            for (var i = 0; i < actions.length; i++) {
                actions[i].onclick = function () {
                    if (!survey.classList.contains(survey.disabledClass)) {
                        survey.classList.add(survey.disabledClass);
                        survey.submit();
                    }
                };
            }

            var container = document.getElementById(survey.containerId);
            _extend(container, rendered);

            if (postRenderCallback) {
                postRenderCallback(data);
            }
        }

        function error(data) {
            // FIXME handle errors better
            console.log('Failed to load survey');

            if (errorCallback) {
                errorCallback(data);
            }
        }

        var userData = {
            identifier: this.identifier,
            metadata: this.metadata,
            targetting: this.targetting,
            locale: this.locale,
            questions: []
        };

        _post(surveyUrl, userData, success, error);
    }

    submit() {
        // this needs to submit and then render follow-up questions

        var survey = this;
        var submissionUrl = this.endpoint + '/survey/' + this.surveyId + '/submit/' + this.submissionUuid;
        var data = {
            questions: this._gatherAnswers()
        };

        function success(data, status) {
            // if questions are in the response, we need to render them
            // if not, we're done
            var container = document.getElementById(survey.containerId);
            var questionList = container.querySelector('.' + this.questionsContainerClass);

            // remove questions that are there
            var questions = questionList.querySelectorAll('.' + this.questionClass);

            for (var i = 0; i < questions.length; i++) {
                questionList.removeChild(questions[i]);
            }

            // remove disabled class from actions
            var actions = container.querySelectorAll('.' + this.actionSubmitClass);

            Array.prototype.forEach.call(actions, function(action, i) {
                action.classList.remove(this.disabledClass);
            });

            if (data.questions && data.questions.length) {
                data.questions.forEach(function (question) {
                    var renderedQuestion = survey.renderQuestion(question);
                    _extend(questionList, renderedQuestion);
                });
            } else {
                survey.completeCallback();
            }
        }

        function error(data, status) {
            var submit = document.querySelector('button.' + this.actionSubmitClass);
            submit.classList.remove(this.disabledClass);

            if (status == 400) {
                if (data.errors) {
                    var container = document.getElementById(survey.containerId);
                    var questions = container.getElementsByClassName(this.questionClass);

                    function handleError(error) {
                        if (error.loc[0] == 'questions') {
                            var questionNum = parseInt(error.loc[1]);
                            var question = questions[questionNum];
                            var keyError = error.loc[2];

                            if (keyError == 'answers') {
                                if (error.loc.length == 3) {
                                    // overall error, probably missing something
                                    var errorPara = question.querySelector('*[class="' + this.errorClass + '"]');
                                    errorPara.style.display = '';
                                    errorPara.innerText = _translateError(error.msg, error.type, survey.locale);
                                } else {
                                    // answer specific, likely missing extra details
                                    var answerNum = error.loc[3];
                                    var answers = question.querySelectorAll('div[class="' + this.answerWrapperClass + '"] input');
                                    var checkedAnswers = Array.from(answers).filter(function (inp) { return inp.checked });
                                    var answerError = error.loc[4];
                                    var checkedAnswer = checkedAnswers[answerNum];
                                    var answer = _parentNodeWithClass(checkedAnswer, this.answerWrapperClass);

                                    // find error element and show
                                    var errorPara = answer.querySelector('*[class="' + this.errorClass + '"]');
                                    errorPara.style.display = '';
                                    errorPara.innerText = _translateError(error.msg, error.type, survey.locale);
                                }
                            } else {
                                window.alert(keyError);
                            }
                        }
                    }

                    data.errors.forEach(handleError);
                }
            } else {
                // TODO handle errors better
                console.error('Not sure how to handle this error');
            }
        }

        _post(submissionUrl, data, success, error);
    }

    _gatherAnswers() {
        var container = document.getElementById(this.containerId);
        var questions = container.querySelectorAll('.' + this.questionClass);
        var responses = [];

        for (var q = 0; q < questions.length; q++) {
            var question = questions[q];

            var response = {
                "question_id": question.getAttribute('data-question-id'),
                "answers": []
            };

            var answers = question.querySelectorAll('.' + this.answerClass);

            Array.prototype.forEach.call(answers, function(answer, i){
                var tagName = answer.tagName;
                var container = _parentNodeWithClass(answer, this.answerWrapperClass);
                var answerIds = [];

                if (tagName == 'INPUT') {
                    if (answer.type == 'checkbox' || answer.type == 'radio') {
                        if (answer.checked) {
                            answerIds = [ container.getAttribute("data-answer-id") ];
                        }
                    } else if (answer.type == 'text') {
                        answerIds = [ answer.value ]

                    } else {
                        console.warn('unknown tag type, not sure how to handle - ' + answer.type);
                    }
                } else if (tagName == 'SELECT') {
                    // find the option
                    var options = answer.querySelectorAll('option:checked');

                    answerIds = [];

                    Array.prototype.forEach.call(options, function(option, i){
                        var value = option.getAttribute('value');

                        if (value) {
                            answerIds.push(value);
                        }
                    });

                } else if (tagName == 'INPUT') {
                    if (typeof(answer.value) != undefined) {
                        answerIds = [ answer.value ];
                    }
                }

                if (answerIds.length) {
                    var moreDetail = null;

                    answerIds.forEach(function(answerId) {
                        var moreDetailElement = container.querySelector('input[data-answer-id="' + answerId + '"].' + this.moreDetailClass);

                        if (moreDetailElement) {
                            moreDetail = moreDetailElement.value;
                        }

                        response["answers"].push({
                            "answer_id": answerId,
                            "more_detail": moreDetail
                        });
                    });
                }
            });

            responses = responses.concat([response]);
        }

        return responses;
    }

    remove() {
        var container = document.getElementById(this.containerId);
        container.parentNode.remove(container);
    }

    renderSurvey(survey, questions) {
        var locale = _getLocale(survey.locales, this.locale);
        var text_direction = (this.locale == 'ar' || this.locale == 'he' ? 'rtl' : 'ltr');

        var vars = {
            survey_uuid: survey.survey_uuid,
            locale: locale,
            text_direction: text_direction,
            title: locale.title,
            pre_text: locale.pre_text,
            post_text: locale.post_text
        };

        var renderedSurvey = _renderTemplateDoc(this.surveyTemplate, vars);
        var questionList = renderedSurvey.querySelector('.' + this.questionsContainerClass);
        var me = this;

        questions.forEach(function (question) {
            var renderedQuestion = me.renderQuestion(question);
            _extend(questionList, renderedQuestion);
        });

        return renderedSurvey;
    }

    renderAnswerInline(rendered, question, answers) {
        var me = this;
        var answerContainer = rendered.querySelector('.' + this.answersContainerClass);

        answers.forEach(function (answer) {
            var renderedAnswer = me.renderAnswerInlineItem(question, answer);
            _extend(answerContainer, renderedAnswer);
        });
    }

    renderAnswerList(rendered, question, answers) {
        var me = this;
        var answerContainer = rendered.querySelector('.' + this.answersContainerClass);

        answers.forEach(function (answer) {
            var renderedAnswer = me.renderAnswerListItem(question, answer);
            _extend(answerContainer, renderedAnswer);
        });
    }

    renderQuestion(question, wrapper) {
        var locale = _getLocale(question.locales, this.locale);
        var vars = {
            question_id: question.question_id,
            content: locale.content,
            pre_text: locale.pre_text,
            post_text: locale.post_text
        };

        var renderedQuestion = _renderTemplateDoc(this.questionTemplate, vars);

        // TODO:
        //  inline style with buttons
        //  other styles too
        if (question.metadata.style == 'dropdown') {
            // dropdown
            this.renderAnswerDropdown(renderedQuestion, question, question.answers);

        } else if (question.metadata.style == 'inline') {
            // inline buttons
            console.warn('inline is currently not supported, falling back');
            // this.renderAnswerInline(renderedQuestion, question, question.answers);
            this.renderAnswerList(renderedQuestion, question, question.answers);

        } else {
            this.renderAnswerList(renderedQuestion, question, question.answers);
        }

        return renderedQuestion;
    }

    renderAnswerDropdown(rendered, question, answers) {
        var me = this;
        var answerContainer = rendered.querySelector('.' + this.answersContainerClass);
        // create options
        // render into 
        var template;

        if (!question.maximum_answers || question.maximum_answers > 1) {
            template = this.multiDropdownTemplate;
        } else {
            template = this.singleDropdownTemplate;
        }

        var vars = {
            name: 'question-' + question.question_id,
            id: 'question-' + question.question_id
        };

        var dropdown = _renderTemplateDoc(template, vars);
        var select = dropdown.querySelector('select');

        answers.forEach(function (answer) {
            var locale = _getLocale(answer.locales, me.locale);
            var vars = {
                value: answer.answer_id,
                content: locale.content
            };

            var renderedAnswer = _renderTemplateDoc(this.dropdownOptionTemplate, vars);
            _extend(select, renderedAnswer);
        });

        _extend(answerContainer, dropdown);

        var error = _renderTemplateDoc(this.errorTemplate, {});
        _extend(answerContainer, error);
    }

    renderAnswerListItem(question, answer) {
        var vars = {
            answer_id: answer.answer_id
        };

        var container = _renderTemplateDoc(this.answerTemplate, vars);
        var wrapper = container.querySelector('.' + this.answerWrapperClass);
        var template;

        if (!question.maximum_answers || question.maximum_answers > 1) {
            template = this.checkboxTemplate;

        } else {
            // TODO auto "next" if radio
            template = this.radioTemplate;
        }

        var answerId = 'answer_' + question.question_id + '_' + answer.answer_id;
        var locale = _getLocale(answer.locales, this.locale);
        var vars = {
            name: 'question-' + question.question_id,
            class: answer.metadata.class || 'p-default',
            id: answerId,
            value: answer.answer_id,
            content: locale.content
        };

        var inputContent = _renderTemplateDoc(template, vars);
        _extend(wrapper, inputContent);

        var inputs = wrapper.getElementsByTagName('input');

        // there should be only one here, but depends on the template
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].onchange = _updateQuestion;
        }

        var error = _renderTemplateDoc(this.errorTemplate, {});
        _extend(wrapper, error);

        function _updateQuestion() {
            var question = _parentNodeWithClass(this.parentNode, this.questionClass);

            var errors = question.getElementsByClassName(this.errorClass);

            for (var e = 0; e < errors.length; e++) {
                errors[e].style.display = 'none';
            }

            var answers = question.getElementsByClassName(this.answerWrapperClass);

            for (var a = 0; a < answers.length; a++) {
                var answer = answers[a];

                // find a more detail
                var more_detail = answer.querySelector('input.' + this.moreDetailClass);

                if (more_detail && !more_detail.hasAttribute('data-no-hide')) {
                    var checkbox = answer.querySelector('input:not(.' + this.moreDetailClass + ')');

                    if (checkbox.checked) {
                        more_detail.style.display = '';
                    } else {
                        more_detail.style.display = 'none';
                    }
                }
            }
        }

        if (answer.more_detail) {
            var moreDetailsId = 'more_detail_' + question.question_id + '_' + answer.answer_id;
            var vars = {
                id: moreDetailsId,
                answer_id: answer.answer_id
            };

            var more_detail = _renderTemplateDoc(this.moreDetailTemplate, vars);
            _extend(wrapper, more_detail);

            var more_details = wrapper.getElementsByClassName(this.moreDetailClass);

            if (more_details.length) {
                more_detail = more_details[0];
                more_detail.onchange = _updateQuestion;

                if (more_detail.style.display != 'none') {
                    // null means the item is not initially visible, so don't
                    // hide it when blurring answer
                    more_detail.setAttribute('data-no-hide', 'true');
                }
            } else {
                console.warn("Can't find more details of element - " + moreDetailsId);
            }
        }

        return container;
    }
}

// auto-load styling if we have some
var onva_css = document.currentScript.src.replace(/\.js$/, '.css');

window.addEventListener('load', function() {
    var style = document.createElement('link');
    style.type = 'text/css';
    style.rel = 'stylesheet';
    style.media = 'all';
    style.async = true;
    style.href = onva_css;
    (document.head || document.body).appendChild(style);
});
