const sql = require('mssql');
const {
  checkString,
  nameCase,
  formatAddress,
  formatDisplayDate,
  formatRecordDate
} = require('../Utils');
const { Systems, IncomeFrequency } = require('../Constants');

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

  let query = `SELECT
  hbmember.claim_id,
  hbmember.person_ref,
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
WHERE
	hbhousehold.to_date = '2099-12-31'
	AND(${whereClause.join(' AND ')})`;

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
  hbhousehold.post_code,
  hbclaim.status_ind
FROM
  hbmember
  JOIN hbclaim ON hbclaim.claim_id = hbmember.claim_id
  JOIN hbhousehold ON hbmember.claim_id = hbhousehold.claim_id
		AND hbmember.house_id = hbhousehold.house_id
WHERE hbmember.claim_id = @claim_id
  AND hbmember.person_ref = @person_ref
  AND hbhousehold.to_date = '2099-12-31'`;

  try {
    const result = await request.query(query);
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
  let query = `SELECT
	hbincome.inc_amt as amount,
	hbincome.freq_len,
	hbincome.freq_period,
	hbinccode.descrip1 as description
FROM
	hbincome
	JOIN hbhousehold ON hbincome.claim_id = hbhousehold.claim_id AND hbincome.house_id = hbhousehold.house_id
	JOIN hbinccode ON hbinccode.code = hbincome.inc_code AND hbinccode.to_date = '2099-12-31'
WHERE
	hbhousehold.to_date = '2099-12-31'
	AND hbincome.claim_id = @claim_id;`;

  try {
    const result = await request.query(query);
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
  let query = `SELECT
	title,
	forename as first,
	surname as last,
	birth_date as dob
FROM
	hbmember
	JOIN hbhousehold ON hbmember.claim_id = hbhousehold.claim_id
		AND hbmember.house_id = hbhousehold.house_id
WHERE
	hbhousehold.to_date = '2099-12-31'
	AND hbmember.claim_id = @claim_id
	AND hbmember.person_ref != @person_ref;`;

  try {
    const result = await request.query(query);
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
  request.input('id', sql.Int, claim_id);
  let query = `SELECT
	hbclaimnotes.*
FROM
	hbclaim
	JOIN hbclaimnotes ON hbclaimnotes.string_id = cast(
		right(hbclaim.notes_db_handle, len (hbclaim.notes_db_handle) - 13) AS integer)
WHERE
	hbclaim.claim_id = @id`;

  const result = await request.query(query, id);
  console.timeEnd('Academy-Benefits fetch customer notes');
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

  fetchCustomerDocuments: function() {
    return Promise.resolve([]);
  }
};

module.exports = Backend;
