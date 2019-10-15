const sql = require("mssql");
const strftime = require('strftime');
const {addOptionProp, formatPhone, formatAddress, checkString} = require('../Utils');

let config = {
    user: process.env.UHT_user,
    password: process.env.UHT_password,
    server: process.env.UHT_server,
    database: process.env.UHT_database
};

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
  let query = 
`SELECT
	member.member_sid,
	member.forename,
	member.surname,
	member.dob,
	member.ni_no,
	contacts.con_address as address,
	contacts.con_postcode as postcode,
	contacts.con_key
FROM
[dbo].[member]
JOIN [dbo].[househ] AS househ
	ON member.house_ref = househ.house_ref
JOIN [dbo].[contacts] AS contacts
	ON contacts.con_ref = househ.house_ref
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
  let query = 
`SELECT
	member.title,
	member.forename,
	member.surname,
	member.dob,
	member.ni_no as mem_nino,
	wlmember.ni_no as wl_nino,
	contacts.con_ref,
	contacts.tag_ref,
	contacts.con_postcode,
	contacts.con_address,
	contacts.con_phone1,
	contacts.con_phone2,
	contacts.con_phone3,
	wlapp.u_novalet_ref,
	wlapp.app_band,
	wlapp.post_code,
	wlapp.con_key,
	wlmember.home_phone,
	wlmember.work_phone,
	wlmember.u_memmobile,
	wlmember.person_no
FROM
  [dbo].[member] AS member
JOIN [dbo].[househ] AS househ
	ON member.house_ref = househ.house_ref
JOIN [dbo].[contacts] AS contacts
	ON contacts.con_ref = househ.house_ref
JOIN [dbo].[wlapp] AS wlapp
	ON wlapp.house_ref = househ.house_ref
JOIN [dbo].[wlmember] AS wlmember
	ON wlmember.app_ref = wlapp.app_ref
WHERE
  member.person_no = wlmember.person_no
  AND member.member_sid = @id;`

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
  let query = `SELECT * FROM [dbo].[conlog] WHERE ([app_ref] = @id);`

  try{
    return request.query(query, id);
  }catch (err) {
    console.log(err)
  }
}

let processResults = function(results){
  return results.recordset.map(record => {
    return {
      id: record.member_sid.toString(),
      firstName: record.forename.trim(),
      lastName: record.surname.trim(),
      dob: record.dob ? strftime('%d/%m/%Y', record.dob) : null,
      nino: checkString(record.ni_no),
      address: formatAddress(record.address),
      postcode: checkString(record.postcode),
      source: "UHT-Contacts",
      links: {
        uhContact: record.con_key
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
  addOptionProp(customer.options, 'homePhone', formatPhone(result.home_phone));
  addOptionProp(customer.options, 'workPhone', formatPhone(result.work_phone));
  addOptionProp(customer.options, 'mobilePhone', formatPhone(result.u_memmobile));
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