const pgp = require("pg-promise")({
  // global db error handler
  error(err, e) {
    console.log(`Postgres Error:
    Query: "${e.query.replace('\n', '')}"
    Error: "${err.message}"`)
  }
});

const PostgresDb = pgp({
  host: process.env.SINGLEVIEW_HOST,
  port: process.env.SINGLEVIEW_PORT,
  database: process.env.SINGLEVIEW_DB,
  user: process.env.SINGLEVIEW_USER,
  password: process.env.SINGLEVIEW_PASSWORD
});

module.exports = PostgresDb;
