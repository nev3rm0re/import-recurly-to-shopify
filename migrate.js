const models = require('./models');
const axios = require('axios');
const async = require('async');

const API_KEY = '';
const API_PASS = '';
const API_URL = ".myshopify.com";

const URL = "https://" + API_KEY + ":" + API_PASS + "@" + API_URL;

console.time("importing");
models.sequelize.query(
    'SELECT * FROM "RecurlyAccounts" LEFT JOIN "ShopifyAccounts" AS s USING (email)'
    + " WHERE s.email IS NOT NULL").spread(function(results, metadata) {
        let sleep = 0;
        const queue = async.queue((element, callback) => {
            console.log("delaying worker by " + sleep + " ms");
            setTimeout(() => {
                const data = {
                    customer: {
                        id: element.id,
                        tags: element.tags + ", migrated-respectfully-v4"
                    }
                };
                axios.put(URL + "/admin/customers/" + element.shopify_id + '.json', data)
                    .then(({headers, data}) => {
                        const [current, total] = headers['x-shopify-shop-api-call-limit'].split('/');
                    
                        if (total - current < 10) {
                            if (sleep === 0) {
                                console.warn('Hitting limits, slowing down: ' + current + "/" + total);
                                sleep += 500;
                            }
                        } else if (total - current > 20) { // half a bucket is free
                            if (sleep !== 0) {
                                console.warn('Limits relaxed, speeding up' + current + "/" + total);
                                sleep -= 500;
                            }
                        }
                        if (sleep > 0) {
                            setTimeout(() => {
                                callback();
                            }, sleep);
                        } else {
                            callback();
                        }
                    })
                    .catch((e) => {
                        queue.push(element);
                        sleep += 500;
                        console.log("Hit a limit, pushing element back to queue (" + element.shopify_id + ") and slowing down further");
                        callback();     
                    });
            }, sleep);     
        }, 10);

        queue.drain = () => {
            console.log("Done processing.");
            console.timeEnd("importing");
        }
        queue.push(results);

        
    });