var sql = require("mssql");
var strftime = require('strftime');

let config = {
    user: process.env.UHT_user,
    password: process.env.UHT_password,
    server: process.env.UHT_server,
    database: process.env.UHT_database
};

const pool = new sql.ConnectionPool(config)

pool.on('error', err => {
  console.log(err);
})

pool.connect();

async function runSearchQuery(queryParams, cb){
  let whereClause = []
  await pool;

  let request = pool.request();

  if(queryParams.firstName && queryParams.firstName !== ''){
    request.input('forename', sql.NVarChar, `%${queryParams.firstName.toLowerCase()}%`)
    whereClause.push('forename collate SQL_Latin1_General_CP1_CI_AS LIKE @forename')
  }

  if(queryParams.lastName && queryParams.lastName !== ''){
    request.input('surname', sql.NVarChar, `%${queryParams.lastName.toLowerCase()}%`)
    whereClause.push('surname collate SQL_Latin1_General_CP1_CI_AS LIKE @surname')
  }
  whereClause = whereClause.map(clause => `(${clause})`)
  let query = `SELECT TOP 300 app_ref, forename, surname, dob, m_address FROM [dbo].[wlmember] WHERE (${whereClause.join(' AND ')}) ORDER BY [wlmember_sid];`

  try{
    const result = request.query(query)
    return result
  }catch (err) {
    console.log(err)
  }
}

let processResults = function(results){
  return results.recordset.map(record => {
    return {
      id: record.app_ref,
      firstName: record.forename.trim(),
      lastName: record.surname.trim(),
      dob: record.DOB ? strftime('%d/%m/%Y', new Date(record.DOB)) : null,
      nino: null,
      address: record.m_address.trim(),
      source: "UHT"
    }
  })
}

let Backend = {
  customerSearch: function(query, cb){
    runSearchQuery(query)
      .then(results => {
        cb(processResults(results));
      })
  },

  fetchCustomer: function(id, customer, cb){
    cb([])
  }
}

module.exports = Backend;