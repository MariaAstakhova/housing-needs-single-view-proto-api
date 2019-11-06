const sql = require('mssql');
const strftime = require('strftime');
const {
  formatPhone,
  formatAddress,
  checkString,
  nameCase
} = require('../Utils');
const { Systems } = require('../Constants');

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
  //let query = `SELECT TOP 300 app_ref, forename, surname, dob, m_address, ni_no FROM [dbo].[wlmember] WHERE (${whereClause.join(' AND ')}) ORDER BY [wlmember_sid];`

  let query = `SELECT
	wlmember.app_ref,
	wlmember.person_no,
	wlmember.forename,
	wlmember.surname,
	wlmember.dob,
	wlmember.ni_no,
	wlapp.post_code,
	wlapp.corr_addr,
	wlapp.con_key
FROM
[dbo].[wlmember]
JOIN [dbo].[wlapp] AS wlapp
	ON wlmember.app_ref = wlapp.app_ref
JOIN [dbo].[contacts] AS contacts
	ON contacts.con_ref = wlapp.app_ref
WHERE (${whereClause.join(' AND ')})`;

  return await request.query(query);
}

async function runFetchQuery(id) {
  await pool;

  let request = pool.request();

  let [app_ref, person_no] = id.split('/');

  request.input('app_ref', sql.NVarChar, app_ref);
  request.input('person_no', sql.Int, person_no);
  let query = `SELECT
	wlmember.*,
	wlapp.u_novalet_ref,
	wlapp.app_band,
	wlapp.post_code,
	wlapp.corr_addr
FROM
[dbo].[wlmember] AS wlmember
JOIN wlapp ON wlmember.app_ref = wlapp.app_ref
WHERE
	wlapp.app_ref = wlmember.app_ref
	AND wlmember.app_ref = @app_ref
	AND wlmember.person_no = @person_no;`;

  return await request.query(query, id);
}

async function fetchCustomerNotesQuery(id) {
  await pool;

  let request = pool.request();

  let [app_ref, person_no] = id.split('/');

  request.input('app_ref', sql.NVarChar, app_ref);
  request.input('person_no', sql.Int, person_no);
  let query = `SELECT
	*
FROM
	conlog
	JOIN wlapp ON wlapp.con_key = conlog.con_key
	JOIN wlmember ON wlmember.app_ref = wlapp.app_ref
WHERE
	wlmember.app_ref = @app_ref
	AND wlmember.person_no = @person_no;`;

  return await request.query(query, id);
}

let processSearchResults = function(results) {
  return results.recordset.map(record => {
    return {
      id: `${record.app_ref.trim()}/${record.person_no}`,
      firstName: checkString(record.forename),
      lastName: checkString(record.surname),
      dob: record.dob ? strftime('%d/%m/%Y', record.dob) : null,
      nino: checkString(record.ni_no),
      address: formatAddress(record.corr_addr),
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
    dob: [result.dob],
    phone: [
      formatPhone(result.home_phone),
      formatPhone(result.work_phone),
      formatPhone(result.u_memmobile)
    ].filter(x => x),
    address: [
      {
        source: [`${Systems.UHT_HOUSING_REGISTER}-WaitingList`],
        address: formatAddress(result.m_address)
      },
      {
        source: [`${Systems.UHT_HOUSING_REGISTER}-Correspondence`],
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
      date: note.clog_date,
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

  fetchCustomer: async function(id) {
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
