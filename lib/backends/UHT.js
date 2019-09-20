var sql = require("mssql");
var strftime = require('strftime');

let config = {
    user: process.env.UHT_user,
    password: process.env.UHT_password,
    server: process.env.UHT_server,
    database: process.env.UHT_database
};

let runSearchQuery = function(queryParams, cb){
  let whereClause = []

  sql.connect(config, function (err) {
    console.log("connected");
    if (err) return cb(err);
    let request = new sql.Request();

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

    request.query(query, function (err, recordset) {
      if (err) console.log(err)
      cb(err, recordset);
    });
  });
  //request.input('dob', sql.DateTime, request.firstName)
}

let processResults = function(results){
  return results.recordset.map(record => {
    return {
      id: record.app_ref,
      firstName: record.forename.trim(),
      lastName: record.surname.trim(),
      dob: strftime('%d/%m/%Y', new Date(Date.parse(record.dob))),
      nino: null,
      address: record.m_address.trim(),
      source: "UHT"
    }
  })
}

let Backend = {
  customerSearch: function(query, cb){
    runSearchQuery(query, function(err, res){
      if (err) console.log(err)
      sql.close();
      cb(processResults(res));
    });
  }
}

module.exports = Backend;