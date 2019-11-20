const sql = require('mssql');
const path = require('path');
const {
  checkString,
  nameCase,
  formatAddress,
  formatDisplayDate,
  formatRecordDate,
  loadSQL
} = require('../../Utils');
const { Systems, IncomeFrequency } = require('../../Constants');
const {
  fetchCustomerSQL,
  fetchCustomerBenefitsSQL,
  fetchCustomerHouseholdSQL,
  fetchCustomerNotesSQL,
  fetchCustomerDocumentsSQL,
  searchCustomersBaseSQL
} = loadSQL(path.join(__dirname, 'sql'));

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
  console.log('Searching academy benefits...');
  console.time('Academy benefits search');
  let whereClause = [];
  await pool;

  let request = pool.request();

  if (queryParams.firstName && queryParams.firstName !== '') {
    request.input(
      'forename',
      sql.NVarChar,
      `%${queryParams.firstName.toUpperCase()}%`
    );
    whereClause.push('forename LIKE @forename');
  }

  if (queryParams.lastName && queryParams.lastName !== '') {
    request.input(
      'surname',
      sql.NVarChar,
      `%${queryParams.lastName.toUpperCase()}%`
    );
    whereClause.push('surname LIKE @surname');
  }
  whereClause = whereClause.map(clause => `(${clause})`);

  let query = `${searchCustomersBaseSQL} AND(${whereClause.join(' AND ')})`;

  const result = await request.query(query);
  console.timeEnd('Academy benefits search');
  return result;
}

async function runFetchQuery(id) {
  console.log('Fetching customer from academy benefits...');
  console.time('Academy benefits fetch customer');
  await pool;

  let request = pool.request();

  let [claim_id, person_ref] = id.split('/');

  request.input('claim_id', sql.NVarChar, claim_id);
  request.input('person_ref', sql.Int, person_ref);

  try {
    const result = await request.query(fetchCustomerSQL);
    console.timeEnd('Academy benefits fetch customer');
    return result;
  } catch (err) {
    console.log(err);
  }
}

async function fetchBenefits(id) {
  console.log('Fetching benefits from academy benefits...');
  console.time('Academy benefits fetch benefits');
  await pool;

  let request = pool.request();

  let claim_id = id.split('/')[0];

  request.input('claim_id', sql.NVarChar, claim_id);

  try {
    const result = await request.query(fetchCustomerBenefitsSQL);
    console.timeEnd('Academy benefits fetch benefits');
    return result;
  } catch (err) {
    console.log(err);
  }
}

async function fetchHousehold(id) {
  console.log('Fetching household from academy benefits...');
  console.time('Academy benefits fetch household');
  await pool;

  let request = pool.request();

  let [claim_id, person_ref] = id.split('/');

  request.input('claim_id', sql.NVarChar, claim_id);
  request.input('person_ref', sql.Int, person_ref);

  try {
    const result = await request.query(fetchCustomerHouseholdSQL);
    console.timeEnd('Academy benefits fetch household');
    return result;
  } catch (err) {
    console.log(err);
  }
}

async function fetchCustomerNotesQuery(id) {
  console.log('Fetching customer notes from Academy-Benefits...');
  console.time('Academy-Benefits fetch customer notes');
  await pool;

  let request = pool.request();

  let claim_id = id.split('/')[0];
  request.input('claim_id', sql.Int, claim_id);

  const result = await request.query(fetchCustomerNotesSQL);
  console.timeEnd('Academy-Benefits fetch customer notes');
  return result;
}

async function fetchCustomerDocumentsQuery(id) {
  console.log('Fetching customer docs from Academy-Benefits...');
  console.time('Academy-Benefits fetch customer docs');
  await pool;

  let request = pool.request();

  let claim_id = id.split('/')[0];
  request.input('claim_id', sql.Int, claim_id);

  const result = await request.query(fetchCustomerDocumentsSQL);
  console.timeEnd('Academy-Benefits fetch customer docs');
  return result;
}

let processNotesResults = function(results) {
  return results.recordset
    .map(x => x.text_value)
    .join('')
    .split(/-{200}/)
    .map(x => x.trim())
    .filter(x => x !== '')
    .map(note => {
      try {
        let [meta, ...noteText] = note.trim().split('\n');
        let parsedMeta = meta
          .trim()
          .match(
            /User Id: ([^ ]+) {2}Date: (\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/
          );
        return {
          title: 'Academy Note',
          text: noteText.join('\n').trim(),
          date: formatRecordDate(
            new Date(
              parseInt(parsedMeta[4]),
              parseInt(parsedMeta[3]) - 1,
              parseInt(parsedMeta[2]),
              parseInt(parsedMeta[5]),
              parseInt(parsedMeta[6]),
              parseInt(parsedMeta[7])
            )
          ),
          user: parsedMeta[1],
          system: Systems.ACADEMY_BENEFITS
        };
      } catch (err) {
        console.log(`Error parsing notes in Academy-CouncilTax: ${err}`);
        return null;
      }
    })
    .filter(x => x);
};

let processSearchResults = function(results) {
  return results.recordset.map(record => {
    return {
      id: `${record.claim_id}/${record.person_ref}`,
      firstName: nameCase(record.forename),
      lastName: nameCase(record.surname),
      dob: record.birth_date ? formatDisplayDate(record.birth_date) : null,
      nino: checkString(record.nino),
      address: formatAddress([
        record.addr1,
        record.addr2,
        record.addr3,
        record.addr4,
        record.post_code
      ]).join(', '),
      postcode: checkString(record.post_code),
      source: Systems.ACADEMY_BENEFITS,
      links: {
        hbClaimId: record.claim_id
      }
    };
  });
};

let processCustomer = function(record) {
  return {
    systemIds: {
      academyBenefits: [record.claim_id.toString()]
    },
    name: [
      {
        first: nameCase(record.forename),
        last: nameCase(record.surname),
        title: nameCase(record.title)
      }
    ],
    dob: [formatRecordDate(record.birth_date)],
    address: [
      {
        source: Systems.ACADEMY_BENEFITS,
        address: formatAddress([
          record.addr1,
          record.addr2,
          record.addr3,
          record.addr4,
          record.post_code
        ])
      }
    ],
    nino: [checkString(record.nino)],
    postcode: [checkString(record.post_code)],
    benefits: {
      live: record.status_ind == 1
    }
  };
};

let processHousehold = function(household) {
  return household.map(mem => {
    return {
      title: nameCase(mem.title),
      first: nameCase(mem.first),
      last: nameCase(mem.last),
      dob: formatRecordDate(mem.dob)
    };
  });
};

let processBenefits = function(benefits) {
  return benefits.map(b => {
    return {
      amount: b.amount,
      description: b.description,
      period: IncomeFrequency[b.freq_len],
      frequency: b.freq_period
    };
  });
};

let processDocumentsResults = function(results) {
  return results.recordset.map(doc => {
    return {
      title: 'Academy Document',
      text: doc.correspondence_code,
      date: formatRecordDate(doc.completed_date),
      user: doc.user_id,
      system: Systems.ACADEMY_BENEFITS
    };
  });
};

let Backend = {
  customerSearch: async function(query) {
    try {
      const results = await runSearchQuery(query);
      return processSearchResults(results);
    } catch (err) {
      console.log(`Error searching customers in Academy-Benefits: ${err}`);
    }
  },

  fetchCustomerRecord: async function(id) {
    try {
      const [results, benefitsResults, household] = await Promise.all([
        runFetchQuery(id),
        fetchBenefits(id),
        fetchHousehold(id)
      ]);

      let customer = processCustomer(results.recordset[0]);
      customer.benefits.income = processBenefits(benefitsResults.recordset);
      if (household.recordset.length > 0) {
        customer.household = processHousehold(household.recordset);
      }

      return customer;
    } catch (err) {
      console.log(`Error fetching customers in Academy-Benefits: ${err}`);
    }
  },

  fetchCustomerNotes: async function(id) {
    try {
      const results = await fetchCustomerNotesQuery(id);
      return processNotesResults(results);
    } catch (err) {
      console.log(`Error fetching customer notes in Academy-Benefits: ${err}`);
    }
  },

  fetchCustomerDocuments: async function(id) {
    try {
      const results = await fetchCustomerDocumentsQuery(id);
      return processDocumentsResults(results);
    } catch (err) {
      console.log(
        `Error fetching customer documents in Academy-Benefits: ${err}`
      );
    }
  }
};

module.exports = Backend;
