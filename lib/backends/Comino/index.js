const path = require('path');
const { formatRecordDate, loadSQL } = require('../../Utils');
const { Systems } = require('../../Constants');
const url = require('url');

let dbUrl = url.parse(process.env.HN_COMINO_URL);
let [user, pass] = dbUrl.auth.split(':');

let dbConfig = {
  user: user,
  password: pass,
  server: dbUrl.host,
  database: dbUrl.path.replace('/', ''),
  requestTimeout: 60000
};

const {
  fetchCTCustomerDocumentsSQL,
  fetchHBCustomerDocumentsSQL,
  fetchCTCustomerNotesSQL,
  fetchHBCustomerNotesSQL
} = loadSQL(path.join(__dirname, 'sql'));

const SqlServerConnection = require('../../SqlServerConnection');
const db = new SqlServerConnection(dbConfig);

async function fetchCTCustomerNotes(id) {
  return await db.request(fetchCTCustomerNotesSQL, [
    { id: 'account_ref', type: 'NVarChar', value: id }
  ]);
}

async function fetchHBCustomerNotes(id) {
  return await db.request(fetchHBCustomerNotesSQL, [
    { id: 'claim_id', type: 'NVarChar', value: id }
  ]);
}

async function fetchCTCustomerDocuments(id) {
  return await db.request(fetchCTCustomerDocumentsSQL, [
    { id: 'account_ref', type: 'NVarChar', value: id }
  ]);
}

async function fetchHBCustomerDocuments(id) {
  return await db.request(fetchHBCustomerDocumentsSQL, [
    { id: 'claim_id', type: 'NVarChar', value: id }
  ]);
}

let processNotesResults = function(results) {
  return results.map(note => {
    return {
      title: 'Note',
      text: note.NoteText.replace(/Â£/g, '£'), // Fixes a common encoding issue
      date: formatRecordDate(note.NDate),
      user: note.UserID,
      system: Systems.COMINO
    };
  });
};

let processDocumentsResults = function(results) {
  return results.map(doc => {
    return {
      title: 'Document',
      text: doc.DocDesc + `${doc.title ? ' - ' + doc.title : ''}`,
      date: formatRecordDate(doc.DocDate),
      user: doc.UserID,
      system: Systems.COMINO
    };
  });
};

let Backend = {
  fetchCustomerNotes: async function(query) {
    let results;
    try {
      if (query.claim_id) {
        results = await fetchHBCustomerNotes(query.claim_id);
      } else if (query.account_ref) {
        results = await fetchCTCustomerNotes(query.account_ref);
      }
      return processNotesResults(results);
    } catch (err) {
      console.log(`Error fetching customer notes in Comino: ${err}`);
    }
  },

  fetchCustomerDocuments: async function(query) {
    let results;
    try {
      if (query.claim_id) {
        results = await fetchHBCustomerDocuments(query.claim_id);
      } else if (query.account_ref) {
        results = await fetchCTCustomerDocuments(query.account_ref);
      }
      return processDocumentsResults(results);
    } catch (err) {
      console.log(`Error fetching customer documents in Comino: ${err}`);
    }
  }
};

module.exports = Backend;
