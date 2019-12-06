const sql = require('mssql');
const path = require('path');
const {
  checkString,
  nameCase,
  formatAddress,
  formatDisplayDate,
  upperCase,
  dedupe,
  loadSQL
} = require('../../Utils');
const { Systems } = require('../../Constants');

let config = {
  user: process.env.Academy_user,
  password: process.env.Academy_password,
  server: process.env.Academy_server,
  database: process.env.Academy_database,
  requestTimeout: 60000
};
const {
  fetchCustomerSQL,
  fetchCustomerTransactionsSQL,
  searchCustomersBaseSQL
} = loadSQL(path.join(__dirname, 'sql'));

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

  let query = `${searchCustomersBaseSQL} AND(${whereClause.join(' AND ')})`;

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

  try {
    const result = await request.query(fetchCustomerSQL);
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

  try {
    const results = await request.query(fetchCustomerTransactionsSQL);
    console.timeEnd('Academy council tax fetch customer transactions');
    return results;
  } catch (err) {
    console.log(err);
  }
}

let processSearchResults = function(results) {
  //return results.recordset.map(record => {
  return dedupe(results.recordset, item => item.account_ref).map(record => {
    return {
      id: record.account_ref.toString(),
      firstName: nameCase(record.lead_liab_forename),
      lastName: nameCase(record.lead_liab_surname),
      dob: record.birth_date ? formatDisplayDate(record.birth_date) : null,
      nino: upperCase(record.nino),
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
      return [];
    }
  },

  fetchCustomerRecord: async function(id) {
    try {
      const [results, transactionsResults] = await Promise.all([
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
