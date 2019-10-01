const sql = require("mssql");
const strftime = require('strftime');
const addOptionProp = require('../Utils').addOptionProp;

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

async function runSearchQuery(queryParams){
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

async function fetchCustomerNotesQuery(id){
  let whereClause = []
  await pool;

  let request = pool.request();

  request.input('id', sql.Int, id)
  let query = `SELECT * FROM [dbo].[W2ObjectNote] WHERE ([KeyNumb] = @id) AND ([KeyObject] = 'Contact');`

  try{
    return request.query(query, id);
  }catch (err) {
    console.log(err)
  }
}

let processResults = function(results){
  return results.recordset.map(record => {
    return {
      id: record.ContactNo,
      firstName: record.Forenames ? record.Forenames.trim() : null,
      lastName: record.Surname ? record.Surname.trim() : null,
      dob: record.DOB ? strftime('%d/%m/%Y', new Date(record.DOB)) : null,
      nino: null,
      address: null,
      source: "UHW"
    }
  })
}

let processNotesResults = function(results){
  return results.recordset.map(note => {
    return {
      text: note.NoteText,
      date: note.NDate,
      user: note.UserID,
      system: 'UHW'
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
    customer.uhwId = id;
    cb()
  },

  fetchCustomerNotes: function(id, cb){
    fetchCustomerNotesQuery(id)
      .then(results => {
        cb(processNotesResults(results));
      })
  }
}

module.exports = Backend;