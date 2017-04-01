const url = require('url');
const qs = require('querystring');
const xtend = require('xtend');
const async = require('async');
const { parseString } = require('xml2js');

const models = require('./models');
models.sequelize.sync().then(() => console.log("DB Synced"));

function display_response(response) {
    console.dir(response);
}

const queue = async.queue(function(cursor, callback) {
    // fetch accounts
    const result = get_accounts(cursor).then(() => callback()).catch(callback);
});

queue.drain = () => {
    const inserter = async.cargo(
        (tasks, cb) => {
            models.RecurlyAccount.bulkCreate(tasks).then(cb).catch((e) => {if (e) console.error(e)});
        },
        1000
    );
    inserter.drain = () => console.log("Done inserting");
    inserter.push(recurly_customers);
    
    console.dir(recurly_customers[0]);
    console.log("Got results?", recurly_customers.length);
    console.log("Finished collecting customers from recurly");
};

const URL = 'https://holstee-dev.recurly.com/v2/accounts?per_page=8';

const axios = require('axios');

exports.parse_link_header = parse_link_header;

function parse_single_link_header(link, i) {
    const parts = link.split(';');
    const link_url = parts.shift().replace(/[<>]/g, "");
    const parsed_url = url.parse(link_url);
    const query = qs.parse(parsed_url.query);

    const info = parts.reduce((acc, el) => {
        const m = el.match(/\s*(.*)\s*=\s*"?([^"]*)"?\s*/);
        if (m) acc[m[1]] = m[2];
        return acc;
    }, {});
    return xtend({rel: i}, info, query, {url: link_url});
}

function parse_link_header(link) {
    const links = link.split(/,\s*/);
    return links.map(parse_single_link_header).reduce((acc, el) => {
        if (el.rel !== undefined) acc[el.rel] = el;
        return acc;
    }, {});
}

const Sequelize = require('sequelize');
const sequelize = new Sequelize('importdb', '', '', {
    dialect: 'sqlite',
    storage: './db/import.sqlite'
});

const Account = sequelize.define('Account', {
    email: Sequelize.STRING
});

let recurly_customers = [];

function get_accounts(cursor) {
    return new Promise((resolve, reject) => {
        const url = "https://gangrel.recurly.com/v2/accounts?state=active&per_page=200" + (cursor ? "&cursor=" + cursor : "");
        console.log("Attempting to get URL: ", url);
        axios
            .get(url, {
                headers: {
                    "Accept": "application/xml"
                },
                auth: {
                    username: RECURLY_API_KEY,
                    password: ''
                }
            })
            .then((response) => {
                ({ data, headers } = response);
                if (!cursor) {
                    console.log("Received data, total records: ", headers['x-records']);
                    console.log("Going to take " + (Math.ceil(headers['x-records'] / 200) -1) + " more calls");
                }
                var page_results;
                const customers = parseString(data, function(err, result) {
                    // console.log(result);
                    page_results = result.accounts.account.map(function(account) {
                        const subscription = account.subscriptions;
                        return {
                            first_name: account.first_name[0],
                            last_name: account.last_name[0],
                            email: account.email[0],
                            subscription: subscription[0]["$"]['href'] || null,
                            account: account
                        };
                    });
                });

                recurly_customers = recurly_customers.concat(page_results);
                console.log("Got " + page_results.length + " customer(s) from this page");
                if (headers['link']) {
                    const link = parse_link_header(headers.link);
                    if (link.next.cursor) {
                        console.log("... still have more, queueing next request");
                        queue.push(link.next.cursor);
                    }
                }
                resolve(page_results);
            })
            .catch(reject);
    });

}
queue.push(null);
// get_accounts().catch((e) => console.error("error: ", e));