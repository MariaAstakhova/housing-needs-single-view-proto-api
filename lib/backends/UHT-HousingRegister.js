const sql = require("mssql");
const strftime = require('strftime');
const {addOptionProp, formatPhone, formatAddress, checkString} = require('../Utils');

let config = {
    user: process.env.UHT_user,
    password: process.env.UHT_password,
    server: process.env.UHT_server,
    database: process.env.UHT_database
};

let dataSource = 'UHT-HousingRegister'

let housingBands = {
  URG: 'Urgent',
  RES: 'Reserve',
  HOM: 'Homeless',
  PRY: 'Priority',
  GEN: 'General'
}

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
    whereClause.push('forename collate SQL_Latin1_General_CP1_CI_AS LIKE @forename')
  }

  if(queryParams.lastName && queryParams.lastName !== ''){
    request.input('surname', sql.NVarChar, `%${queryParams.lastName.toLowerCase()}%`)
    whereClause.push('surname collate SQL_Latin1_General_CP1_CI_AS LIKE @surname')
  }
  whereClause = whereClause.map(clause => `(${clause})`)
  //let query = `SELECT TOP 300 app_ref, forename, surname, dob, m_address, ni_no FROM [dbo].[wlmember] WHERE (${whereClause.join(' AND ')}) ORDER BY [wlmember_sid];`


  let query = 
`SELECT
	wlmember.wlmember_sid,
	wlmember.forename,
	wlmember.surname,
	wlmember.dob,
	wlmember.ni_no,
	wlapp.post_code,
	wlapp.corr_addr,
	wlapp.con_key
FROM
[dbo].[wlmember]
JOIN [dbo].[wlapp] AS wlapp
	ON wlmember.app_ref = wlapp.app_ref
JOIN [dbo].[contacts] AS contacts
	ON contacts.con_ref = wlapp.app_ref
WHERE (${whereClause.join(' AND ')})`

  try{
    return request.query(query)
  }catch (err) {
    console.log(err)
  }
}

async function runFetchQuery(id){
  let whereClause = []
  await pool;

  let request = pool.request();

  request.input('id', sql.NVarChar, id)
  let query = `SELECT
	wlmember.*,
	wlapp.u_novalet_ref,
	wlapp.app_band
FROM
[dbo].[wlmember] AS wlmember
JOIN wlapp ON wlmember.app_ref = wlapp.app_ref
WHERE
	wlapp.app_ref = wlmember.app_ref
	AND wlmember.wlmember_sid = @id;`

  try{
    return request.query(query, id);
  }catch (err) {
    console.log(err)
  }
}

async function fetchCustomerNotesQuery(id){
  let whereClause = []
  await pool;

  let request = pool.request();

  request.input('id', sql.NVarChar, id)
  let query = `SELECT
	*
FROM
	conlog
	JOIN wlapp ON wlapp.con_key = conlog.con_key
	JOIN wlmember ON wlmember.app_ref = wlapp.app_ref
WHERE
	wlmember.wlmember_sid = @id;`

  try{
    return request.query(query, id);
  }catch (err) {
    console.log(err)
  }
}

let processResults = function(results){
  return results.recordset.map(record => {
    return {
      id: record.wlmember_sid,
      firstName: checkString(record.forename),
      lastName: checkString(record.surname),
      dob: record.dob ? strftime('%d/%m/%Y', record.dob) : null,
      nino: checkString(record.ni_no),
      address: checkString(record.corr_addr),
      postcode: checkString(record.post_code),
      source: dataSource,
      links: {
        uhContact: checkString(record.con_key)
      }
    }
  })
}

let processCustomer = function(result, customer){
  customer.uhtId = result.app_ref;
  addOptionProp(customer.options, 'firstName', result.forename);
  addOptionProp(customer.options, 'lastName', result.surname);
  addOptionProp(customer.options, 'title', result.title);
  addOptionProp(customer.options, 'dob', result.dob);
  addOptionProp(customer.options, 'phone', formatPhone(result.home_phone));
  addOptionProp(customer.options, 'phone', formatPhone(result.work_phone));
  addOptionProp(customer.options, 'phone', formatPhone(result.u_memmobile));
  addOptionProp(customer.options, 'address', result.m_address);
  addOptionProp(customer.options, 'nino', result.ni_no);
  customer.housingRegister.biddingNo = result.u_novalet_ref;
  customer.housingRegister.band = housingBands[result.app_band] || 'Unknown';
}

let processNotesResults = function(results){
  return results.recordset.map(note => {
    return {
      text: note.clog_details,
      date: note.clog_date,
      user: null,
      system: 'UHT'
    }
  });
}

let Backend = {
  customerSearch: function(query, cb){
    runSearchQuery(query)
      .then(results => {
        cb(processResults(results));
      })
  },

  fetchCustomer: function(id, customer, cb){
    runFetchQuery(id)
      .then(res => {
        processCustomer(res.recordset[0], customer);
        cb()
      });
  },

  fetchCustomerNotes: function(id, cb){
    fetchCustomerNotesQuery(id)
      .then(results => {
        cb(processNotesResults(results));
      })
  }
}

module.exports = Backend;