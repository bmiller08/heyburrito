import { default as log } from 'bog'
export default class MongoDBDriver {

    MongoClient: any
    url: any
    databaseName: any
    db: any
    client: any

    constructor(MongoClient, config: any = {}) {
        this.MongoClient = MongoClient;
        this.url = config.url;
        this.databaseName = config.database;
        this.db = null;
        this.client = null;
    }

    connect() {
        if (this.client && typeof this.client.isConnected === 'function' && this.client.isConnected()) {
            return Promise.resolve(this.client);
        }
        log.info(`Database in use: ${this.url}/${this.databaseName}`)
        return this.MongoClient.connect(`${this.url}/${this.databaseName}`, { useNewUrlParser: true }).then((client) => {
            this.client = client;
            this.db = client.db(this.databaseName);
        });
    }

    async store(collection, data) {
        await this.connect();

        if (Array.isArray(data)) {
            return this.db.collection(collection).insertMany(data);
        }

        return this.db.collection(collection).insertOne(data);
    }

    async find(collection, query) {
        await this.connect();

        return this.db.collection(collection).find(query).toArray();
    }

    async sum(collection, key = 'value', match = null, groupBy = 'to') {
        await this.connect();

        const aggregations: Array<Object> = [{ $match: { to: { $exists: true } } }];

        if (match) {
            aggregations.push({ $match: match });
        }

        aggregations.push({ $group: { _id: `$${groupBy}`, score: { $sum: `$${key}` } } });
        aggregations.push({ $sort: { score: -1 } });

        return this.db.collection(collection).aggregate(aggregations).toArray();
    }

    findFrom(user: string) {
        return this.find('burritos', { from: user });
    }

    findFromToday(user: string) {
        const start = new Date();
        const end = new Date();

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        return this.find('burritos', { from: user, given_at: { $gte: start, $lt: end } });
    }

    give(to: string, from: string) {
        return this.store('burritos', {
            to,
            from,
            value: 1,
            given_at: new Date(),
        });
    }

    takeAway(to: string, from: string) {
        return this.store('burritos', {
            to,
            from,
            value: -1,
            given_at:
                new Date(),
        });
    }

    getScore(user = null) {
        const match = (user) ? { to: user } : null;

        return this.sum('burritos', 'value', match);
    }

    getGiven(user: string) {
        const match = (user) ? { from: user } : null;

        return this.sum('burritos', 'value', match);
    }

    getGivers(user: string) {
        return this.sum('burritos', 'value', { to: user }, 'from');
    }
}
