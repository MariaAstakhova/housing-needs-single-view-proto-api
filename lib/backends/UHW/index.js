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

let dbConfig = {
  user: process.env.UHW_user,
  password: process.env.UHW_password,
  server: process.env.UHW_server,
  database: process.env.UHW_database
};

const SqlServerConnection = require('../../SqlServerConnection');
const db = new SqlServerConnection(dbConfig);

async function runSearchQuery(queryParams) {
  let whereClause = [];
  let params = [];

  if (queryParams.firstName && queryParams.firstName !== '') {
    params.push({
      id: 'forename',
      type: 'NVarChar',
      value: `%${queryParams.firstName.toLowerCase()}%`
    });
    whereClause.push(
      'Forenames collate SQL_Latin1_General_CP1_CI_AS LIKE @forename'
    );
  }

  if (queryParams.lastName && queryParams.lastName !== '') {
    params.push({
      id: 'surname',
      type: 'NVarChar',
      value: `%${queryParams.lastName.toLowerCase()}%`
    });
    whereClause.push(
      'Surname collate SQL_Latin1_General_CP1_CI_AS LIKE @surname'
    );
  }
  whereClause = whereClause.map(clause => `(${clause})`);

  let query = `${searchCustomersBaseSQL} WHERE (${whereClause.join(' AND ')})`;

  return await db.request(query, params);
}

async function fetchCustomer(id) {
  return (await db.request(fetchCustomerSQL, [
    { id: 'id', type: 'Int', value: id }
  ]))[0];
}

async function fetchCustomerNotesQuery(id) {
  return await db.request(fetchCustomerNotesSQL, [
    { id: 'id', type: 'Int', value: id }
  ]);
}

async function fetchCustomerDocumentsQuery(id) {
  return await db.request(fetchCustomerDocumentsSQL, [
    { id: 'id', type: 'Int', value: id }
  ]);
}

let processSearchResults = function(results) {
  return results.map(record => {
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
  return results.map(note => {
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
  return results.map(doc => {
    return {
      id: doc.DocNo,
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
      return [];
    }
  },

  fetchCustomerRecord: async function(id) {
    try {
      const customer = await fetchCustomer(id);
      return processCustomer(customer);
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
