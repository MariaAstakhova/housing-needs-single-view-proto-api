const pgp = require("pg-promise")({
  // global db error handler
  error(err, e) {
    console.log(err);
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
