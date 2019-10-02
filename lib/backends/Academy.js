const sql = require("mssql");
const strftime = require('strftime');
const {addOptionProp, formatPhone} = require('../Utils');

let config = {
    user: process.env.Academy_user,
    password: process.env.Academy_password,
    server: process.env.Academy_server,
    database: process.env.Academy_database
};

const pool = new sql.ConnectionPool(config)

pool.on('error', err => {
  console.log(err);
})

pool.connect();

async function runSearchQuery(queryParams){
  let whereClause = []
  await pool;

  let request = pool.request();

  if(queryParams.firstName && queryParams.firstName !== ''){
    request.input('forename', sql.NVarChar, `%${queryParams.firstName.toLowerCase()}%`)
    whereClause.push('forename LIKE @forename')
  }

  if(queryParams.lastName && queryParams.lastName !== ''){
    request.input('surname', sql.NVarChar, `%${queryParams.lastName.toLowerCase()}%`)
    whereClause.push('surname LIKE @surname')
  }
  whereClause = whereClause.map(clause => `(${clause})`)
  let query = `SELECT a.claim_id, b.forename, b.surname, b.birth_date, b.nino, a.addr1, a.addr2, a.addr3, a.addr4, a.post_code FROM [dbo].[hbhousehold] as a, [dbo].[hbmember] as b WHERE a.claim_id = b.claim_id \
  AND a.house_id = b.house_id \
  AND a.to_date = '2099-12-31' \
  AND (${whereClause.join(' AND ')})`;

  try{
    return request.query(query)
  }catch (err) {
    console.log(err)
  }
}

let processResults = function(results){
  return results.recordset.map(record => {
    return {
      id: record.claim_id,
      firstName: record.forename.trim(),
      lastName: record.surname.trim(),
      dob: record.birth_date ? strftime('%d/%m/%Y', record.birth_date) : null,
      nino: record.nino,
      address: [record.addr1.trim(),record.addr2.trim(),record.addr3.trim(),record.addr4.trim(),record.post_code.trim()].filter(x => x!== '').join("\n") ,
      source: "ACADEMY"
    }
  })
}

let Backend = {
  customerSearch: function(query, cb){
    if(query.firstName && query.firstName !== '' && query.lastName && query.lastName !== ''){
      runSearchQuery(query)
        .then(results => {
          cb(processResults(results));
        })
    }else{
      cb([]);
    }
  },

  fetchCustomer: function(id, customer, cb){
    customer.benefitClaimId = id;
    cb()
    /*
    runFetchQuery(id)
      .then(res => {
        processCustomer(res.recordset[0], customer);
        cb()
      });
    */
  },

  fetchCustomerNotes: function(id, cb){
    cb([]);
  }
}

module.exports = Backend;