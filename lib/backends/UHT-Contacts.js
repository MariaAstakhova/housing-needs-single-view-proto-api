const sql = require('mssql');
const {
  formatPhone,
  formatAddress,
  checkString,
  nameCase,
  formatDisplayDate,
  formatRecordDate
} = require('../Utils');
const { Systems } = require('../Constants');

let config = {
  user: process.env.UHT_user,
  password: process.env.UHT_password,
  server: process.env.UHT_server,
  database: process.env.UHT_database
};

const pool = new sql.ConnectionPool(config);

pool.on('error', err => {
  console.log(err);
});

pool.connect();

async function runSearchQuery(queryParams) {
  console.log('Searching UHT contacts...');
  console.time('UHT contacts search');

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
  let query = `SELECT
  member.house_ref,
  member.person_no,
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
WHERE (${whereClause.join(' AND ')})`;

  const result = await request.query(query);
  console.timeEnd('UHT contacts search');
  return result;
}

async function runFetchQuery(id) {
  console.log('Fetching customer from UHT contacts...');
  console.time('UHT contacts fetch customer');
  await pool;

  let request = pool.request();

  let [house_ref, person_no] = id.split('/');

  request.input('house_ref', sql.NVarChar, house_ref);
  request.input('person_no', sql.Int, person_no);
  let query = `SELECT
  member.member_sid,
  member.title,
  member.forename,
  member.surname,
  member.dob,
  member.ni_no,
  member.house_ref,
  contacts.con_address AS address,
  contacts.con_postcode AS postcode,
  contacts.con_key,
  contacts.con_phone1,
  contacts.con_phone2,
  contacts.con_phone3,
  tenagree.tag_ref,
  tenagree.cot as start_date,
  tenagree.eot as end_date,
  tenure.ten_desc as tenure,
  tenagree.cur_bal as current_balance,
  tenagree.rent,
  tenagree.prop_ref as prop_ref,
  addresses.post_preamble,
  addresses.aline1,
  addresses.aline2,
  addresses.aline3,
  addresses.aline4,
  addresses.post_code,
  period.prd_desc as rent_period
FROM
  member
  JOIN househ AS househ ON member.house_ref = househ.house_ref
  JOIN contacts AS contacts ON contacts.con_ref = househ.house_ref
  LEFT JOIN tenagree ON tenagree.house_ref = member.house_ref
  LEFT JOIN period ON tenagree.prd_code = period.prd_code
  LEFT JOIN tenure ON tenure.ten_type = tenagree.tenure
  LEFT JOIN Addresses as addresses ON tenagree.prop_ref = addresses.prop_ref

WHERE  member.house_ref = @house_ref
  AND member.person_no = @person_no;`;

  try {
    const result = await request.query(query, id);
    console.timeEnd('UHT contacts fetch customer');
    return result;
  } catch (err) {
    console.log(err);
  }
}

// async function fetchCustomerNotesQuery(id) {
//   await pool;

//   let request = pool.request();

//   request.input('id', sql.NVarChar, id);
//   let query = `SELECT * FROM [dbo].[conlog] WHERE ([app_ref] = @id);`;

//   return await request.query(query, id);
// }

let processSearchResults = function(results) {
  return results.recordset.map(record => {
    return {
      id: `${record.house_ref.trim()}/${record.person_no}`,
      firstName: record.forename.trim(),
      lastName: record.surname.trim(),
      dob: record.dob ? formatDisplayDate(record.dob) : null,
      nino: checkString(record.ni_no),
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
      householdRef: [nameCase(result.house_ref)]
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
    nino: [checkString(result.ni_no)]
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

// let processNotesResults = function(results) {
//   return results.recordset.map(note => {
//     return {
//       text: note.clog_details,
//       date: note.clog_date,
//       user: null,
//       system: Systems.UHT_CONTACTS
//     };
//   });
// };

let Backend = {
  customerSearch: async function(query) {
    try {
      const results = await runSearchQuery(query);
      return processSearchResults(results);
    } catch (err) {
      console.log(`Error searching customers in UHT-Contacts: ${err}`);
    }
  },

  fetchCustomer: async function(id) {
    try {
      const res = await runFetchQuery(id);
      return processCustomer(res.recordset[0]);
    } catch (err) {
      console.log(`Error fetching customers in UHT-Contacts: ${err}`);
    }
  },

  fetchCustomerNotes: async function() {
    // const results = await fetchCustomerNotesQuery(id);
    return [];
    // Removed until we can deduplicate notes
    //return processNotesResults(results);
  },

  fetchCustomerDocuments: function() {
    return Promise.resolve([]);
  }
};

module.exports = Backend;
