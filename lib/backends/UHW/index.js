const sql = require('mssql');
const path = require('path');
const {
  checkString,
  nameCase,
  formatDisplayDate,
  formatRecordDate,
  loadSQL
} = require('../../Utils');
const { Systems } = require('../../Constants');
const {
  fetchCustomerSQL,
  searchCustomersBaseSQL,
  fetchCustomerNotesSQL,
  fetchCustomerDocumentsSQL
} = loadSQL(path.join(__dirname, 'sql'));

let config = {
  user: process.env.UHW_user,
  password: process.env.UHW_password,
  server: process.env.UHW_server,
  database: process.env.UHW_database
};

const pool = new sql.ConnectionPool(config);

pool.on('error', err => {
  console.log(err);
});

pool.connect();

async function runSearchQuery(queryParams) {
  console.log('Searching UHW...');
  console.time('UHW search');
  let whereClause = [];
  await pool;

  let request = pool.request();

  if (queryParams.firstName && queryParams.firstName !== '') {
    request.input(
      'forename',
      sql.NVarChar,
      `%${queryParams.firstName.toLowerCase()}%`
    );
    whereClause.push(
      'Forenames collate SQL_Latin1_General_CP1_CI_AS LIKE @forename'
    );
  }

  if (queryParams.lastName && queryParams.lastName !== '') {
    request.input(
      'surname',
      sql.NVarChar,
      `%${queryParams.lastName.toLowerCase()}%`
    );
    whereClause.push(
      'Surname collate SQL_Latin1_General_CP1_CI_AS LIKE @surname'
    );
  }
  whereClause = whereClause.map(clause => `(${clause})`);
  let query = `${searchCustomersBaseSQL} WHERE (${whereClause.join(' AND ')})`;

  const result = await request.query(query);
  console.timeEnd('UHW search');
  return result;
}

async function runFetchQuery(id) {
  console.log('Fetching customer from UHW...');
  console.time('UHW fetch customer');
  await pool;

  let request = pool.request();

  request.input('id', sql.NVarChar, id);

  const result = await request.query(fetchCustomerSQL);
  console.timeEnd('UHW fetch customer');
  return result;
}

async function fetchCustomerNotesQuery(id) {
  console.log('Fetching customer notes from UHW...');
  console.time('UHW fetch customer notes');
  await pool;

  let request = pool.request();

  request.input('id', sql.Int, id);

  const result = await request.query(fetchCustomerNotesSQL);
  console.timeEnd('UHW fetch customer notes');
  return result;
}

async function fetchCustomerDocumentsQuery(id) {
  console.log('Fetching customer docs from UHW...');
  console.time('UHW fetch customer docs');
  await pool;

  let request = pool.request();

  request.input('id', sql.Int, id);

  const result = await request.query(fetchCustomerDocumentsSQL);
  console.timeEnd('UHW fetch customer docs');
  return result;
}

let processSearchResults = function(results) {
  return results.recordset.map(record => {
    return {
      id: record.ContactNo.toString(),
      firstName: record.Forenames ? nameCase(record.Forenames) : null,
      lastName: record.Surname ? nameCase(record.Surname) : null,
      dob: record.DOB ? formatDisplayDate(record.DOB) : null,
      nino: null,
      address: null,
      postcode: checkString(record.PostCode),
      source: Systems.UHW,
      links: {
        uhContact: record.UHContact
      }
    };
  });
};

let processNotesResults = function(results) {
  return results.recordset.map(note => {
    return {
      title: 'Note',
      text: note.NoteText,
      date: formatRecordDate(note.NDate),
      user: note.UserID,
      system: Systems.UHW
    };
  });
};

let processDocumentsResults = function(results) {
  return results.recordset.map(doc => {
    return {
      title: 'Document',
      text: doc.DocDesc + `${doc.title ? ' - ' + doc.title : ''}`,
      date: formatRecordDate(doc.DocDate),
      user: doc.UserID,
      system: Systems.UHW
    };
  });
};

let processCustomer = function(record) {
  return {
    systemIds: {
      uhw: [record.ContactNo.toString()]
    },
    name: [
      {
        first: nameCase(record.Forenames.trim()),
        last: nameCase(record.Surname.trim()),
        title: nameCase(record.Title)
      }
    ],
    dob: [formatRecordDate(record.DOB)],
    postcode: [checkString(record.PostCode)],
    email: [record.EmailAddress]
  };
};

let Backend = {
  customerSearch: async function(query) {
    try {
      const results = await runSearchQuery(query);
      return processSearchResults(results);
    } catch (err) {
      console.log(`Error searching customers in UHW: ${err}`);
    }
  },

  fetchCustomerRecord: async function(id) {
    try {
      const results = await runFetchQuery(id);
      return processCustomer(results.recordset[0]);
    } catch (err) {
      console.log(`Error fetching customers in UHW: ${err}`);
    }
  },

  fetchCustomerNotes: async function(id) {
    try {
      const results = await fetchCustomerNotesQuery(id);
      return processNotesResults(results);
    } catch (err) {
      console.log(`Error fetching customer notes in UHW: ${err}`);
    }
  },

  fetchCustomerDocuments: async function(id) {
    try {
      const results = await fetchCustomerDocumentsQuery(id);
      return processDocumentsResults(results);
    } catch (err) {
      console.log(`Error fetching customer documents in UHW: ${err}`);
    }
  }
};

module.exports = Backend;
