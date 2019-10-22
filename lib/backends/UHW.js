const sql = require("mssql");
const strftime = require("strftime");
const { addOptionProp, checkString } = require("../Utils");
const { Systems } = require("../Constants");

let config = {
  user: process.env.UHW_user,
  password: process.env.UHW_password,
  server: process.env.UHW_server,
  database: process.env.UHW_database
};

const pool = new sql.ConnectionPool(config);

pool.on("error", err => {
  console.log(err);
});

pool.connect();

async function runSearchQuery(queryParams) {
  let whereClause = [];
  await pool;

  let request = pool.request();

  if (queryParams.firstName && queryParams.firstName !== "") {
    request.input(
      "forename",
      sql.NVarChar,
      `%${queryParams.firstName.toLowerCase()}%`
    );
    whereClause.push(
      "Forenames collate SQL_Latin1_General_CP1_CI_AS LIKE @forename"
    );
  }

  if (queryParams.lastName && queryParams.lastName !== "") {
    request.input(
      "surname",
      sql.NVarChar,
      `%${queryParams.lastName.toLowerCase()}%`
    );
    whereClause.push(
      "Surname collate SQL_Latin1_General_CP1_CI_AS LIKE @surname"
    );
  }
  whereClause = whereClause.map(clause => `(${clause})`);
  let query = `SELECT ContactNo, Forenames, Surname, DOB, Addr1, Addr2, Addr3, Addr4, PostCode, UHContact FROM [dbo].[CCContact] WHERE (${whereClause.join(
    " AND "
  )});`;

  const result = await request.query(query);
  return result;
}

async function fetchCustomerNotesQuery(id) {
  let whereClause = [];
  await pool;

  let request = pool.request();

  request.input("id", sql.Int, id);
  let query = `SELECT * FROM [dbo].[W2ObjectNote] WHERE ([KeyNumb] = @id) AND ([KeyObject] = 'Contact');`;

  return await request.query(query, id);
}

async function fetchCustomerDocumentsQuery(id) {
  let whereClause = [];
  await pool;

  let request = pool.request();

  request.input("id", sql.Int, id);
  let query = `SELECT * FROM [dbo].[CCDocument] WHERE ([ContactNo] = @id);`;

  return await request.query(query, id);
}

let processSearchResults = function(results) {
  return results.recordset.map(record => {
    return {
      id: record.ContactNo.toString(),
      firstName: record.Forenames ? record.Forenames.trim() : null,
      lastName: record.Surname ? record.Surname.trim() : null,
      dob: record.DOB ? strftime("%d/%m/%Y", new Date(record.DOB)) : null,
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
      text: note.NoteText,
      date: note.NDate,
      user: note.UserID,
      system: Systems.UHW
    };
  });
};

let processDocumentsResults = function(results) {
  return results.recordset.map(doc => {
    return {
      desc: doc.DocDesc + `${doc.title ? " - " + doc.title : ""}`,
      date: doc.DocDate,
      user: doc.UserID,
      system: Systems.UHW
    };
  });
};

let Backend = {
  customerSearch: async function(query) {
    const results = await runSearchQuery(query);
    return processSearchResults(results);
  },

  fetchCustomer: async function(id, customer) {
    customer.uhwId = id;
  },

  fetchCustomerNotes: async function(id) {
    const results = await fetchCustomerNotesQuery(id);
    return processNotesResults(results);
  },

  fetchCustomerDocuments: async function(id) {
    const results = await fetchCustomerDocumentsQuery(id);
    return processDocumentsResults(results);
  }
};

module.exports = Backend;
