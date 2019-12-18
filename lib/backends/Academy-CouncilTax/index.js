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
const Comino = require('../Comino');
const { Systems } = require('../../Constants');

let dbConfig = {
  user: process.env.Academy_user,
  password: process.env.Academy_password,
  server: process.env.Academy_server,
  database: process.env.Academy_database,
  requestTimeout: 60000
};
const {
  fetchCustomerSQL,
  fetchCustomerTransactionsSQL,
  searchCustomersSQL
} = loadSQL(path.join(__dirname, 'sql'));

const SqlServerConnection = require('../../SqlServerConnection');
const db = new SqlServerConnection(dbConfig);

async function runSearchQuery(queryParams) {
  let fullName = [queryParams.lastName, queryParams.firstName]
    .filter(i => i && i !== '')
    .map(i => i.toUpperCase())
    .join('%');

  return await db.request(searchCustomersSQL, [
    { id: 'full_name', type: 'NVarChar', value: fullName }
  ]);
}

async function fetchCustomer(id) {
  return (await db.request(fetchCustomerSQL, [
    { id: 'account_ref', type: 'NVarChar', value: id.slice(0, 8) }
  ]))[0];
}

async function fetchCustomerTransactions(id) {
  return await db.request(fetchCustomerTransactionsSQL, [
    { id: 'account_ref', type: 'NVarChar', value: id.slice(0, 8) }
  ]);
}

let processSearchResults = function(results) {
  return dedupe(results, item => item.account_ref).map(record => {
    return {
      id: `${record.account_ref}${record.account_cd}`,
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
      academyCouncilTax: [`${record.account_ref}${record.account_cd}`]
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
      const [customerResult, transactionsResults] = await Promise.all([
        fetchCustomer(id),
        fetchCustomerTransactions(id)
      ]);

      let customer = processCustomer(customerResult);
      customer.councilTax['transactions'] = transactionsResults;

      return customer;
    } catch (err) {
      console.log(`Error fetching customers in Academy-Benefits: ${err}`);
    }
  },

  fetchCustomerNotes: async function(account_ref) {
    try {
      return await Comino.fetchCustomerNotes({ account_ref });
    } catch (err) {
      console.log(`Error fetching customer notes in Comino: ${err}`);
    }
  },

  fetchCustomerDocuments: async function(account_ref) {
    try {
      return await Comino.fetchCustomerDocuments({ account_ref });
    } catch (err) {
      console.log(`Error fetching customer notes in Comino: ${err}`);
    }
  }
};

module.exports = Backend;
