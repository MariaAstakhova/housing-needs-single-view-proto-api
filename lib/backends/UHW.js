var sql = require("mssql");
var strftime = require('strftime');

let config = {
    user: process.env.UHW_user,
    password: process.env.UHW_password,
    server: process.env.UHW_server,
    database: process.env.UHW_database
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
    whereClause.push('Forenames collate SQL_Latin1_General_CP1_CI_AS LIKE @forename')
  }

  if(queryParams.lastName && queryParams.lastName !== ''){
    request.input('surname', sql.NVarChar, `%${queryParams.lastName.toLowerCase()}%`)
    whereClause.push('Surname collate SQL_Latin1_General_CP1_CI_AS LIKE @surname')
  }
  whereClause = whereClause.map(clause => `(${clause})`)
  let query = `SELECT TOP 300 ContactNo, Forenames, Surname, DOB, Addr1, Addr2, Addr3, Addr4, PostCode FROM [dbo].[CCContact] WHERE (${whereClause.join(' AND ')});`

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
      id: record.ContactNo,
      firstName: record.Forenames.trim(),
      lastName: record.Surname.trim(),
      dob: record.DOB ? strftime('%d/%m/%Y', new Date(record.DOB)) : null,
      nino: null,
      address: null,
      source: "UHW"
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