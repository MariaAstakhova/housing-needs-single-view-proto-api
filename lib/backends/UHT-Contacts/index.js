const path = require('path');
const {
  formatPhone,
  formatAddress,
  checkString,
  nameCase,
  formatDisplayDate,
  formatRecordDate,
  upperCase,
  loadSQL
} = require('../../Utils');
const { Systems } = require('../../Constants');
const { fetchCustomerSQL, searchCustomersBaseSQL } = loadSQL(
  path.join(__dirname, 'sql')
);

let dbConfig = {
  user: process.env.UHT_user,
  password: process.env.UHT_password,
  server: process.env.UHT_server,
  database: process.env.UHT_database
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
      value: `%${queryParams.firstName.toUpperCase()}%`
    });
    whereClause.push(
      'forename collate SQL_Latin1_General_CP1_CI_AS LIKE @forename'
    );
  }

  if (queryParams.lastName && queryParams.lastName !== '') {
    params.push({
      id: 'surname',
      type: 'NVarChar',
      value: `%${queryParams.lastName.toUpperCase()}%`
    });
    whereClause.push(
      'surname collate SQL_Latin1_General_CP1_CI_AS LIKE @surname'
    );
  }
  whereClause = whereClause.map(clause => `(${clause})`);

  let query = `${searchCustomersBaseSQL} WHERE (${whereClause.join(' AND ')})`;

  return await db.request(query, params);
}

async function fetchCustomer(id) {
  const [house_ref, person_no] = id.split('/');

  return (await db.request(fetchCustomerSQL, [
    { id: 'house_ref', type: 'NVarChar', value: house_ref },
    { id: 'person_no', type: 'Int', value: person_no }
  ]))[0];
}

let processSearchResults = function(results) {
  return results.map(record => {
    return {
      id: `${record.house_ref.trim()}/${record.person_no}`,
      firstName: nameCase(record.forename),
      lastName: nameCase(record.surname),
      dob: record.dob ? formatDisplayDate(record.dob) : null,
      nino: upperCase(record.ni_no),
      address: formatAddress(record.address).join(', '),
      postcode: checkString(record.postcode),
      source: Systems.UHT_CONTACTS,
      links: {
        uhContact: record.con_key
      }
    };
  });
};

let processCustomer = function(result) {
  let customer = {
    systemIds: {
      uhtContacts: [result.member_sid.toString()],
      householdRef: [result.house_ref],
      rent: [checkString(result.tag_ref)]
    },
    name: [
      {
        first: nameCase(result.forename),
        last: nameCase(result.surname),
        title: nameCase(result.title)
      }
    ],
    dob: [result.dob ? formatRecordDate(result.dob) : null],
    phone: [
      formatPhone(result.con_phone1),
      formatPhone(result.con_phone2),
      formatPhone(result.con_phone3)
    ].filter(x => x),
    address: [
      { source: Systems.UHT_CONTACTS, address: formatAddress(result.address) }
    ],
    postcode: [checkString(result.postcode)],
    nino: [upperCase(result.ni_no)]
  };
  if (result.tag_ref) {
    let tenancy = {
      tagRef: checkString(result.tag_ref),
      startDate: result.start_date ? formatRecordDate(result.start_date) : null,
      endDate: result.end_date ? formatRecordDate(result.end_date) : null,
      tenure: checkString(result.tenure),
      currentBalance: result.current_balance,
      rentAmount: result.rent,
      rentPeriod: result.period,
      propRef: checkString(result.prop_ref),
      address: formatAddress([
        result.post_preamble,
        [checkString(result.post_design), checkString(result.aline1)]
          .filter(x => x)
          .join(' '),
        result.aline2,
        result.aline3,
        result.aline4,
        result.post_code
      ])
    };
    customer.tenancies = { current: [], previous: [] };
    if (tenancy.endDate === '1900-01-01') {
      // It is the current tenancy
      tenancy.endDate = null;
      customer.tenancies.current.push(tenancy);
    } else {
      // It is an old tenancy
      customer.tenancies.previous.push(tenancy);
    }
  }
  return customer;
};

let Backend = {
  customerSearch: async function(query) {
    try {
      const results = await runSearchQuery(query);
      return processSearchResults(results);
    } catch (err) {
      console.log(`Error searching customers in UHT-Contacts: ${err}`);
      return [];
    }
  },

  fetchCustomerRecord: async function(id) {
    try {
      const customer = await fetchCustomer(id);
      return processCustomer(customer);
    } catch (err) {
      console.log(`Error fetching customers in UHT-Contacts: ${err}`);
    }
  },

  fetchCustomerNotes: async function() {
    return [];
  },

  fetchCustomerDocuments: function() {
    return Promise.resolve([]);
  }
};

module.exports = Backend;
