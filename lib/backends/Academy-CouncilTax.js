const sql = require('mssql');
const {
  checkString,
  nameCase,
  formatAddress,
  formatDisplayDate
} = require('../Utils');
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
  console.log('Searching academy council tax...');
  console.time('Academy council tax search');
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
  ctproperty.addr1,
  ctproperty.addr2,
  ctproperty.addr3,
  ctproperty.addr4,
  ctproperty.postcode,
  (SELECT TOP 1 claim_id FROM hbctaxclaim WHERE ctax_ref = CONCAT(CAST(ctaccount.account_ref AS NVARCHAR), CAST(ctaccount.account_cd AS NVARCHAR)) ORDER BY ctax_claim_id DESC) as hb_claim_id	FROM
	ctaccount
LEFT JOIN ctoccupation ON ctaccount.account_ref = ctoccupation.account_ref
LEFT JOIN ctproperty ON ctproperty.property_ref = ctoccupation.property_ref
WHERE ${whereClause.join(' AND ')}
AND ctoccupation.vacation_date IN (SELECT MAX(vacation_date) FROM ctoccupation WHERE ctoccupation.account_ref = ctaccount.account_ref);`;

  const result = await request.query(query);
  console.timeEnd('Academy council tax search');
  return result;
}

async function runFetchQuery(id) {
  console.log('Fetching customer from academy council tax...');
  console.time('Academy council tax fetch customer');
  await pool;

  let request = pool.request();

  request.input('account_ref', sql.NVarChar, id);
  let query = `WITH ctoccupation_cte (
    account_ref,
    property_ref
  ) AS (
    SELECT TOP 1 account_ref, property_ref FROM ctoccupation WHERE
      ctoccupation.account_ref = @account_ref
    ORDER BY vacation_date DESC
  )
  SELECT
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
    ctproperty.addr1,
    ctproperty.addr2,
    ctproperty.addr3,
    ctproperty.addr4,
    ctproperty.postcode,
    vw_acc_bal.total AS account_balance,
    ctpaymethod.paymeth_desc AS payment_method,
    (SELECT TOP 1 claim_id FROM hbctaxclaim WHERE
        ctax_ref = CONCAT(CAST(ctaccount.account_ref AS NVARCHAR), CAST(ctaccount.account_cd AS NVARCHAR))
      ORDER BY ctax_claim_id DESC) AS hb_claim_id
    FROM
      ctaccount
      JOIN vw_acc_bal ON vw_acc_bal.account_ref = ctaccount.account_ref
      JOIN ctpaymethod ON ctpaymethod.paymeth_code = ctaccount.paymeth_code
      JOIN ctoccupation_cte ON ctaccount.account_ref = ctoccupation_cte.account_ref
      JOIN ctproperty ON ctproperty.property_ref = ctoccupation_cte.property_ref
    WHERE
      ctpaymethod.paymeth_year = '2019-04-01'
      AND ctaccount.account_ref = @account_ref;`;

  try {
    const result = await request.query(query);
    console.timeEnd('Academy council tax fetch customer');
    return result;
  } catch (err) {
    console.log(err);
  }
}

async function fetchCustomerTransactions(id) {
  console.log('Fetching customer transactions from academy council tax...');
  console.time('Academy council tax fetch customer transactions');
  await pool;

  let request = pool.request();

  request.input('account_ref', sql.NVarChar, id);

  let query = `SELECT
	TOP 20
	cttransaction.process_date as date,
	cttransaction.tran_amount as amount,
	cttrancode.tran_desc as description
FROM
	cttransaction
	JOIN cttrancode ON cttransaction.tran_code = cttrancode.tran_code
WHERE
	account_ref = @account_ref
	ORDER BY process_date DESC;`;

  try {
    const results = await request.query(query);
    console.timeEnd('Academy council tax fetch customer transactions');
    return results;
  } catch (err) {
    console.log(err);
  }
}

let processSearchResults = function(results) {
  return results.recordset.map(record => {
    return {
      id: record.account_ref.toString(),
      firstName: checkString(record.lead_liab_forename),
      lastName: checkString(record.lead_liab_surname),
      dob: record.birth_date ? formatDisplayDate(record.birth_date) : null,
      nino: checkString(record.nino),
      address: formatAddress([
        record.addr1,
        record.addr2,
        record.addr3,
        record.addr4,
        record.post_code
      ]).join(', '),
      postcode: checkString(record.postcode),
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
      academyCouncilTax: [record.account_ref.toString()]
    },
    name: [
      {
        first: nameCase(record.lead_liab_forename),
        last: nameCase(record.lead_liab_surname),
        title: nameCase(record.lead_liab_title)
      }
    ],
    address: [
      {
        source: `${Systems.ACADEMY_COUNCIL_TAX}-Property`,
        address: formatAddress([
          record.addr1,
          record.addr2,
          record.addr3,
          record.addr4,
          record.postcode
        ])
      },
      {
        source: `${Systems.ACADEMY_COUNCIL_TAX}-Forwarding-Address`,
        address: formatAddress([
          record.for_addr1,
          record.for_addr2,
          record.for_addr3,
          record.for_addr4,
          record.for_postcode
        ])
      }
    ],
    postcode: [checkString(record.for_postcode)],
    councilTax: {
      accountBalance: record.account_balance,
      paymentMethod: record.payment_method
    }
  };
};

let Backend = {
  customerSearch: async function(query) {
    try {
      const results = await runSearchQuery(query);
      return processSearchResults(results);
    } catch (err) {
      console.log(`Error searching customers in Academy-CouncilTax: ${err}`);
    }
  },

  fetchCustomer: async function(id) {
    try {
      [results, transactionsResults] = await Promise.all([
        runFetchQuery(id),
        fetchCustomerTransactions(id)
      ]);

      let customer = processCustomer(results.recordset[0]);
      customer.councilTax['transactions'] = transactionsResults.recordset;

      return customer;
    } catch (err) {
      console.log(`Error fetching customers in Academy-Benefits: ${err}`);
    }
  },

  fetchCustomerNotes: async function() {
    return Promise.resolve([]);
  },

  fetchCustomerDocuments: function() {
    return Promise.resolve([]);
  }
};

module.exports = Backend;
