const sql = require('mssql');

class SqlServerConnection {
  constructor(config) {
    this.pool = new sql.ConnectionPool(config);

    this.pool.on('error', err => {
      console.log(err);
    });

    this.pool.connect();
  }

  async request(query, params) {
    await this.pool;
    let request = this.pool.request();
    params.forEach(param => {
      request.input(param.id, sql[param.type], param.value);
    });
    try {
      let result = await request.query(query);
      return result.recordset;
    } catch (err) {
      console.log(err);
    }
  }
}

module.exports = SqlServerConnection;
