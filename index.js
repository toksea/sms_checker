'use strict';


// dependencies
var BPromise = require('bluebird'),
    request = require('superagent-bluebird-promise'),
    xml2jsParseString = BPromise.promisify(require('xml2js').parseString),
    debug = require('debug')('foo');


// confs
var WARNING_LINE = 100,
    checkers = {},
    jobs = [],
    conf = {

        tui3: {
            k: 'xxxx'
        },
        jz: {
            account: 'xxxx',
            password: 'xxxx'
        },
        qxt: {
            uid: 'xxxx',
            pwd: 'xxxx'
        }

    },
    apiKey = 'key-xxxx',
    domain = 'xxxx.mailgun.org',
    mailgun = require('mailgun-js')({apiKey: apiKey, domain: domain});


// checkers
checkers.tui3 = function(opt) {

    return request
        .get('http://www.tui3.com/api/query/')
        .query(opt)
        .then(function(res) {

            var resObj = JSON.parse(res.text);

            debug('tui3', resObj);

            if (~~resObj.err_code === 0 &&

                // @todo 确认使用哪种类型的短信
                (~~resObj.count1 > WARNING_LINE ||
                 ~~resObj.count2 > WARNING_LINE ||
                 ~~resObj.count3 > WARNING_LINE)) {

                BPromise.resolve(true);

            }
            else {

                throw 'Tui3 API error';
            }

        });

};

checkers.jz = function(opt) {

    return request
        .get('http://www.jianzhou.sh.cn/JianzhouSMSWSServer/http/getUserInfo')
        .query(opt)
        .then(function(res) {

            return xml2jsParseString(res.text);

        })
        .then(function(resObj) {

            debug('jz', resObj);

            if (resObj.hasOwnProperty('userinfo') &&
                resObj.userinfo.hasOwnProperty('remainFee') &&
                resObj.userinfo.remainFee > WARNING_LINE)  {

                BPromise.resolve(true);

            }
            else {

                throw 'JZ API error';
            }


        });

};

checkers.qxt = function(opt) {

    return request
        .get('http://api.cnsms.cn')
        .query({ac: 'gc'})
        .query(opt)
        .then(function(res) {

            var resArr = res.text.split('||');

            debug('qxt', resArr);

            if (~~resArr[0] === 100 &&
                ~~resArr[1] > WARNING_LINE) {

                BPromise.resolve(true);

            }
            else {

                throw 'QXT API error';

            }

        });

};


// jobs
for (var k in conf) {

    if (conf.hasOwnProperty(k) &&
        checkers.hasOwnProperty(k)) {

        jobs.push(checkers[k](conf[k]));
    }
}


// run checks
BPromise.all(jobs)
    .then(function(res) {
        debug('Done, All OK');
    })
    .catch(function(err) {

        debug('Fail,', err);

        var data = {
            from: 'xxx <postmaster@$mail.mailgun.org>',
            to: '',
            subject: 'SMS 故障',
            text: err + ' 请登陆服务器检查'
        };

        mailgun.messages().send(data, function (err, body) {
            if (err) {
                debug('mailgun', err);
            }
            else {
                debug('mailgun', body);
            }
            // console.log(body);
            // console.error(error);

            process.exit(1);

        });


    });
