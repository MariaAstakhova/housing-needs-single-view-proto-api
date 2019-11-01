const sql = require('mssql');
const strftime = require('strftime');
const { checkString } = require('../Utils');
const { Systems } = require('../Constants');

let config = {
  user: process.env.Academy_user,
  password: process.env.Academy_password,
  server: process.env.Academy_server,
  database: process.env.Academy_database,
  requestTimeout: 60000
};

const pool = new sql.ConnectionPool(config);

pool.on('error', err => {
  console.log(err);
});

pool.connect();

async function runSearchQuery(queryParams) {
  let whereClause = [];
  await pool;

  let request = pool.request();

  // We have to do this crazy 3-part search on the firstname, then surname, then both - it happens to work a lot faster
  // Proper indexes on the db would prevent this!!!
  let fullname = [];

  if (queryParams.lastName && queryParams.lastName !== '') {
    request.input(
      'surname',
      sql.NVarChar,
      `%${queryParams.lastName.toUpperCase()}%`
    );
    whereClause.push('lead_liab_name LIKE @surname');

    fullname.push(queryParams.lastName.toUpperCase());
  }
  whereClause = whereClause.map(clause => `(${clause})`);

  if (queryParams.firstName && queryParams.firstName !== '') {
    request.input(
      'forename',
      sql.NVarChar,
      `%${queryParams.firstName.toUpperCase()}%`
    );

    whereClause.push('lead_liab_name LIKE @forename');
    fullname.push(queryParams.firstName.toUpperCase());
  }

  request.input('fullname', sql.NVarChar, `%${fullname.join('%')}%`);
  whereClause.push('lead_liab_name LIKE @fullname');

  let query = `SELECT
	ctaccount.account_ref,
	ctaccount.account_cd,
	ctaccount.lead_liab_title,
	ctaccount.lead_liab_forename,
	ctaccount.lead_liab_surname,
	ctaccount.for_addr1,
	ctaccount.for_addr2,
	ctaccount.for_addr3,
	ctaccount.for_addr4,
	ctaccount.for_postcode,
	(SELECT TOP 1 claim_id FROM hbctaxclaim WHERE ctax_ref = CONCAT(CAST(ctaccount.account_ref AS NVARCHAR), CAST(ctaccount.account_cd AS NVARCHAR)) ORDER BY ctax_claim_id DESC) as hb_claim_id
	FROM
	ctaccount
WHERE ${whereClause.join(' AND ')};`;

  console.log(query);

  return await request.query(query);
}

async function runFetchQuery(id) {
  await pool;

  let request = pool.request();

  let [claim_id, person_ref] = id.split('/');

  request.input('claim_id', sql.NVarChar, claim_id);
  request.input('person_ref', sql.Int, person_ref);
  let query = `SELECT
  hbmember.claim_id,
  hbmember.title,
	hbmember.forename,
	hbmember.surname,
	hbmember.birth_date,
	hbmember.nino,
	hbhousehold.addr1,
	hbhousehold.addr2,
	hbhousehold.addr3,
	hbhousehold.addr4,
	hbhousehold.post_code
FROM
	hbmember
	LEFT JOIN hbhousehold ON hbmember.claim_id = hbhousehold.claim_id
		AND hbmember.house_id = hbhousehold.house_id
WHERE hbmember.claim_id = @claim_id
  AND hbmember.person_ref = @person_ref`;

  try {
    return await request.query(query);
  } catch (err) {
    console.log(err);
  }
}

let processSearchResults = function(results) {
  return results.recordset.map(record => {
    return {
      id: record.account_ref,
      firstName: checkString(record.lead_liab_forename),
      lastName: checkString(record.lead_liab_surname),
      dob: record.birth_date ? strftime('%d/%m/%Y', record.birth_date) : null,
      nino: checkString(record.nino),
      address: checkString(
        [
          record.for_addr1.trim(),
          record.for_addr2.trim(),
          record.for_addr3.trim(),
          record.for_addr4.trim(),
          record.for_postcode.trim()
        ]
          .filter(x => x !== '')
          .join('\n')
      ),
      postcode: checkString(record.for_postcode),
      links: {
        hbClaimId: record.hb_claim_id
      },
      source: Systems.ACADEMY_COUNCIL_TAX
    };
  });
};

let processCustomer = function(record) {
  return {
    systemIds: {
      academy: [record.claim_id.toString()]
    },
    name: [
      {
        first: checkString(record.forename),
        last: checkString(record.surname),
        title: checkString(record.title)
      }
    ],
    dob: [record.birth_date],
    address: [
      checkString(
        [
          record.addr1.trim(),
          record.addr2.trim(),
          record.addr3.trim(),
          record.addr4.trim(),
          record.post_code.trim()
        ]
          .filter(x => x !== '')
          .join('\n')
      )
    ],
    nino: [checkString(record.nino)],
    postcode: [checkString(record.post_code)]
  };
};

let Backend = {
  customerSearch: async function(query) {
    const results = await runSearchQuery(query);
    return processSearchResults(results);
  },

  fetchCustomer: async function(id) {
    const results = await runFetchQuery(id);
    return processCustomer(results.recordset[0]);
  },

  fetchCustomerNotes: async function() {
    return Promise.resolve([]);
  },

  fetchCustomerDocuments: function() {
    return Promise.resolve([]);
  }
};

module.exports = Backend;
