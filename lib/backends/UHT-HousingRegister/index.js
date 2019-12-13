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
const { Systems, HousingBands } = require('../../Constants');
const {
  fetchCustomerSQL,
  searchCustomersBaseSQL,
  fetchCustomerNotesSQL
} = loadSQL(path.join(__dirname, 'sql'));

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
      value: `%${queryParams.firstName.toLowerCase()}%`
    });
    whereClause.push(
      'forename collate SQL_Latin1_General_CP1_CI_AS LIKE @forename'
    );
  }

  if (queryParams.lastName && queryParams.lastName !== '') {
    params.push({
      id: 'surname',
      type: 'NVarChar',
      value: `%${queryParams.lastName.toLowerCase()}%`
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
  const [app_ref, person_no] = id.split('/');

  return (await db.request(fetchCustomerSQL, [
    { id: 'app_ref', type: 'NVarChar', value: app_ref },
    { id: 'person_no', type: 'Int', value: person_no }
  ]))[0];
}

async function fetchCustomerNotesQuery(id) {
  const [app_ref, person_no] = id.split('/');

  return await db.request(fetchCustomerNotesSQL, [
    { id: 'app_ref', type: 'NVarChar', value: app_ref },
    { id: 'person_no', type: 'Int', value: person_no }
  ]);
}

let processSearchResults = function(results) {
  return results.map(record => {
    return {
      id: `${record.app_ref.trim()}/${record.person_no}`,
      firstName: nameCase(record.forename),
      lastName: nameCase(record.surname),
      dob: record.dob ? formatDisplayDate(record.dob) : null,
      nino: upperCase(record.ni_no),
      address: formatAddress(record.corr_addr).join(', '),
      postcode: checkString(record.post_code),
      source: Systems.UHT_HOUSING_REGISTER,
      links: {
        uhContact: checkString(record.con_key)
      }
    };
  });
};

let processCustomer = function(result) {
  return {
    systemIds: {
      uhtHousingRegister: [`${result.app_ref.trim()}/${result.person_no}`]
    },
    name: [
      {
        first: nameCase(result.forename),
        last: nameCase(result.surname),
        title: nameCase(result.title)
      }
    ],
    dob: [formatRecordDate(result.dob)],
    phone: [
      formatPhone(result.home_phone),
      formatPhone(result.work_phone),
      formatPhone(result.u_memmobile)
    ].filter(x => x),
    address: [
      {
        source: `${Systems.UHT_HOUSING_REGISTER}-WaitingList`,
        address: formatAddress(result.m_address)
      },
      {
        source: `${Systems.UHT_HOUSING_REGISTER}-Correspondence`,
        address: formatAddress(result.corr_addr)
      }
    ],
    postcode: [checkString(result.post_code)],
    nino: [checkString(result.ni_no)],
    housingRegister: {
      applicationRef: result.app_ref,
      biddingNo: result.u_novalet_ref,
      band: HousingBands[result.app_band] || 'Unknown'
    }
  };
};

let processNotesResults = function(results) {
  return results.map(note => {
    return {
      text: note.clog_details,
      date: formatRecordDate(note.clog_date),
      user: null,
      system: Systems.UHT_HOUSING_REGISTER
    };
  });
};

let Backend = {
  customerSearch: async function(query) {
    try {
      const results = await runSearchQuery(query);
      return processSearchResults(results);
    } catch (err) {
      console.log(`Error searching customers in UHT-HousingRegister: ${err}`);
      return [];
    }
  },

  fetchCustomerRecord: async function(id) {
    try {
      const customer = await fetchCustomer(id);
      return processCustomer(customer);
    } catch (err) {
      console.log(`Error fetching customers in UHT-HousingRegister: ${err}`);
    }
  },

  fetchCustomerNotes: async function(id) {
    try {
      const results = await fetchCustomerNotesQuery(id);
      return processNotesResults(results);
    } catch (err) {
      console.log(
        `Error fetching customer notes in UHT-HousingRegister: ${err}`
      );
    }
  },

  fetchCustomerDocuments: async function() {
    return Promise.resolve([]);
  }
};

module.exports = Backend;
