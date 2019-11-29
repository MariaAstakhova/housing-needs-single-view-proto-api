const sql = require('mssql');
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
const {
  fetchCustomerSQL,
  searchCustomersBaseSQL,
  fetchCustomerNotesSQL
} = loadSQL(path.join(__dirname, 'sql'));

let config = {
  user: process.env.UHT_user,
  password: process.env.UHT_password,
  server: process.env.UHT_server,
  database: process.env.UHT_database
};

let housingBands = {
  URG: 'Urgent',
  RES: 'Reserve',
  HOM: 'Homeless',
  PRY: 'Priority',
  GEN: 'General'
};

const pool = new sql.ConnectionPool(config);

pool.on('error', err => {
  console.log(err);
});

pool.connect();

async function runSearchQuery(queryParams) {
  console.log('Searching UHT housing register...');
  console.time('UHT housing register search');
  let whereClause = [];
  await pool;

  let request = pool.request();

  if (queryParams.firstName && queryParams.firstName !== '') {
    request.input(
      'forename',
      sql.NVarChar,
      `%${queryParams.firstName.toLowerCase()}%`
    );
    whereClause.push(
      'forename collate SQL_Latin1_General_CP1_CI_AS LIKE @forename'
    );
  }

  if (queryParams.lastName && queryParams.lastName !== '') {
    request.input(
      'surname',
      sql.NVarChar,
      `%${queryParams.lastName.toLowerCase()}%`
    );
    whereClause.push(
      'surname collate SQL_Latin1_General_CP1_CI_AS LIKE @surname'
    );
  }
  whereClause = whereClause.map(clause => `(${clause})`);
  let query = `${searchCustomersBaseSQL} WHERE (${whereClause.join(' AND ')})`;

  const result = await request.query(query);
  console.timeEnd('UHT housing register search');
  return result;
}

async function runFetchQuery(id) {
  console.log('Fetching customer from UHT housing register...');
  console.time('UHT housing register fetch customer');
  await pool;

  let request = pool.request();

  let [app_ref, person_no] = id.split('/');

  request.input('app_ref', sql.NVarChar, app_ref);
  request.input('person_no', sql.Int, person_no);

  const result = await request.query(fetchCustomerSQL);
  console.timeEnd('UHT housing register fetch customer');
  return result;
}

async function fetchCustomerNotesQuery(id) {
  console.log('Fetching notes from UHT housing register...');
  console.time('UHT housing register fetch notes');
  await pool;

  let request = pool.request();

  let [app_ref, person_no] = id.split('/');

  request.input('app_ref', sql.NVarChar, app_ref);
  request.input('person_no', sql.Int, person_no);

  const result = await request.query(fetchCustomerNotesSQL);
  console.timeEnd('UHT housing register fetch notes');
  return result;
}

let processSearchResults = function(results) {
  return results.recordset.map(record => {
    return {
      id: `${record.app_ref.trim()}/${record.person_no}`,
      firstName: checkString(record.forename),
      lastName: checkString(record.surname),
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
      band: housingBands[result.app_band] || 'Unknown'
    }
  };
};

let processNotesResults = function(results) {
  return results.recordset.map(note => {
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
    }
  },

  fetchCustomerRecord: async function(id) {
    try {
      const res = await runFetchQuery(id);
      return processCustomer(res.recordset[0]);
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
