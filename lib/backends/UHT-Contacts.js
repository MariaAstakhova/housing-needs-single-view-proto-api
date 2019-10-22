const sql = require("mssql");
const strftime = require("strftime");
const {
  addOptionProp,
  formatPhone,
  formatAddress,
  checkString
} = require("../Utils");

let config = {
  user: process.env.UHT_user,
  password: process.env.UHT_password,
  server: process.env.UHT_server,
  database: process.env.UHT_database
};

let housingBands = {
  URG: "Urgent",
  RES: "Reserve",
  HOM: "Homeless",
  PRY: "Priority",
  GEN: "General"
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
      "forename collate SQL_Latin1_General_CP1_CI_AS LIKE @forename"
    );
  }

  if (queryParams.lastName && queryParams.lastName !== "") {
    request.input(
      "surname",
      sql.NVarChar,
      `%${queryParams.lastName.toLowerCase()}%`
    );
    whereClause.push(
      "surname collate SQL_Latin1_General_CP1_CI_AS LIKE @surname"
    );
  }
  whereClause = whereClause.map(clause => `(${clause})`);
  let query = `SELECT
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
WHERE (${whereClause.join(" AND ")})`;

  return await request.query(query);
}

async function runFetchQuery(id) {
  let whereClause = [];
  await pool;

  let request = pool.request();

  request.input("id", sql.NVarChar, id);
  let query = `SELECT
  member.member_sid,
	member.title,
	member.forename,
	member.surname,
	member.dob,
	member.ni_no,
	contacts.con_address as address,
	contacts.con_postcode as postcode,
	contacts.con_key,
	contacts.con_phone1,
	contacts.con_phone2,
	contacts.con_phone3
FROM
[dbo].[member]
JOIN [dbo].[househ] AS househ
	ON member.house_ref = househ.house_ref
JOIN [dbo].[contacts] AS contacts
	ON contacts.con_ref = househ.house_ref
WHERE  member.member_sid = @id;`;

  try {
    return await request.query(query, id);
  } catch (err) {
    console.log(err);
  }
}

async function fetchCustomerNotesQuery(id) {
  let whereClause = [];
  await pool;

  let request = pool.request();

  request.input("id", sql.NVarChar, id);
  let query = `SELECT * FROM [dbo].[conlog] WHERE ([app_ref] = @id);`;

  return await request.query(query, id);
}

let processSearchResults = function(results) {
  return results.recordset.map(record => {
    return {
      id: record.member_sid.toString(),
      firstName: record.forename.trim(),
      lastName: record.surname.trim(),
      dob: record.dob ? strftime("%d/%m/%Y", record.dob) : null,
      nino: checkString(record.ni_no),
      address: formatAddress(record.address),
      postcode: checkString(record.postcode),
      source: "UHT-Contacts",
      links: {
        uhContact: record.con_key
      }
    };
  });
};

let processCustomer = function(result, customer) {
  customer.uhtContactId = result.member_sid;
  addOptionProp(customer.options, "firstName", result.forename);
  addOptionProp(customer.options, "lastName", result.surname);
  addOptionProp(customer.options, "title", result.title);
  addOptionProp(customer.options, "dob", result.dob);
  addOptionProp(customer.options, "phone", formatPhone(result.con_phone1));
  addOptionProp(customer.options, "phone", formatPhone(result.con_phone2));
  addOptionProp(customer.options, "phone", formatPhone(result.con_phone3));
  addOptionProp(customer.options, "address", result.address);
  addOptionProp(customer.options, "nino", result.ni_no);
};

let processNotesResults = function(results) {
  return results.recordset.map(note => {
    return {
      text: note.clog_details,
      date: note.clog_date,
      user: null,
      system: "UHT"
    };
  });
};

let Backend = {
  customerSearch: async function(query) {
    const results = await runSearchQuery(query);
    return processSearchResults(results);
  },

  fetchCustomer: async function(id, customer) {
    const res = await runFetchQuery(id);
    return processCustomer(res.recordset[0], customer);
  },

  fetchCustomerNotes: async function(id) {
    const results = await fetchCustomerNotesQuery(id);
    return processNotesResults(results);
  },

  fetchCustomerDocuments: function(id) {
    return Promise.resolve([]);
  }
};

module.exports = Backend;
