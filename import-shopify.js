const axios = require('axios');
const async = require('async');
const qs = require('querystring');

const API_KEY = '';
const API_PASS = '';
const API_URL = ".myshopify.com";
const URL = "https://" + API_KEY + ":" + API_PASS + "@" + API_URL;

const params = {
    limit: 250,
    page: 1
};

const models = require('./models');
models.sequelize.sync().then((a, ...b) => {
    console.log("DB Synced", a, b);
})
.catch(console.error);

shopify_importer(axios.create({ baseURL: URL}))

function shopify_importer(shopify) {
    shopify.get("/admin/customers/count.json").then((response) => {
        console.log("There are " + response.data.count + " record(s) in Shopify");
        startFetching(shopify, response.data.count).then((records) => {
            console.log("Received " + records.length + " records, now importing");
            const remapped_records = records.map((element) => {
                return {
                    shopify_id: element.id,
                    first_name: element.first_name,
                    last_name: element.last_name,
                    email: element.email,
                    tags: element.tags
                };
            });
            const inserter = async.cargo(
                (tasks, cb) => {
                    models.ShopifyAccount.bulkCreate(tasks).then(cb).catch((e) => {if (e) console.error(e)});
                },
                1000
            );
            inserter.drain = () => {
                console.log("Done inserting");
                models.sequelize.close();
            }
            inserter.push(remapped_records);
        }).catch(console.error);
    }).catch(console.error);
}


class ShopifyCollector {
    constructor(count, per_page=250) {
        this.total_count = count;
        this.per_page = per_page;
        this.records = [];
    }

    hasMoreRecords() {
        return this.records.length < this.total_count;
    }

    get current_page() {
        return Math.floor(this.records.length / this.per_page) + 1;
    }

    onFetch(records) {
        this.records = this.records.concat(records);
        console.log("Received " + records.length + " records");
        this.fetched += records.length;
    }
}

function startFetching(shopify, record_count) {
    let collector = new ShopifyCollector(record_count);

    return new Promise((resolve, reject) => {
        async.whilst(() => collector.hasMoreRecords(), (cb) => {
            console.log("current page: ", collector.current_page);
            shopify.get('/admin/customers.json', {params: {limit: collector.per_page, page: collector.current_page}})
            .then((response) => {
                collector.onFetch(response.data.customers);
                cb();
            });
        }, () => {
            resolve(collector.records);
        });
    });
}