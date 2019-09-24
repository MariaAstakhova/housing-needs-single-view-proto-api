const sqlite3 = require('better-sqlite3');
const db = new sqlite3('singleview.db', { verbose: console.log });
var strftime = require('strftime');

let processResults = function(results){
  return results.map(record => {
    return {
      id: record.id,
      firstName: record.first_name,
      lastName: record.last_name,
      dob: record.dob ? record.dob : null,
      nino: record.nino,
      address: record.address,
      source: "SINGLEVIEW"
    }
  })
}

let Backend = {
  customerSearch: function(queryParams, cb){
    let whereClause = [];
    let query = {};

    if(queryParams.firstName && queryParams.firstName !== ''){
      whereClause.push('first_name LIKE @firstName')
      query.firstName = `%${queryParams.firstName}%`
    }

    if(queryParams.lastName && queryParams.lastName !== ''){
      whereClause.push('last_name LIKE @lastName')
      query.lastName = `%${queryParams.lastName}%`
    }

    const selectCust = db.prepare(`SELECT * FROM customers WHERE (${whereClause.join(' AND ')})`);

    const customers = selectCust.all(query);
    console.log(customers);
    cb(processResults(customers))
  }
}

module.exports = Backend;