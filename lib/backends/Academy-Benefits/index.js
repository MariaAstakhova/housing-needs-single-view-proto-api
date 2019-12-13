const sql = require('mssql');
const path = require('path');
const {
  checkString,
  nameCase,
  formatAddress,
  formatDisplayDate,
  formatRecordDate,
  upperCase,
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

let dbConfig = {
  user: process.env.Academy_user,
  password: process.env.Academy_password,
  server: process.env.Academy_server,
  database: process.env.Academy_database,
  requestTimeout: 60000
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
    whereClause.push('forename LIKE @forename');
  }

  if (queryParams.lastName && queryParams.lastName !== '') {
    params.push({
      id: 'surname',
      type: 'NVarChar',
      value: `%${queryParams.lastName.toUpperCase()}%`
    });
    whereClause.push('surname LIKE @surname');
  }
  whereClause = whereClause.map(clause => `(${clause})`);

  let query = `${searchCustomersBaseSQL} AND(${whereClause.join(' AND ')})`;

  return await db.request(query, params);
}

async function fetchCustomer(id) {
  const [claim_id, person_ref] = id.split('/');

  return (await db.request(fetchCustomerSQL, [
    { id: 'claim_id', type: 'NVarChar', value: claim_id },
    { id: 'person_ref', type: 'Int', value: person_ref }
  ]))[0];
}

async function fetchBenefits(id) {
  const claim_id = id.split('/')[0];

  return await db.request(fetchCustomerBenefitsSQL, [
    { id: 'claim_id', type: 'NVarChar', value: claim_id }
  ]);
}

async function fetchHousehold(id) {
  const [claim_id, person_ref] = id.split('/');

  return await db.request(fetchCustomerHouseholdSQL, [
    { id: 'claim_id', type: 'NVarChar', value: claim_id },
    { id: 'person_ref', type: 'Int', value: person_ref }
  ]);
}

async function fetchCustomerNotes(id) {
  const claim_id = id.split('/')[0];

  return await db.request(fetchCustomerNotesSQL, [
    { id: 'claim_id', type: 'NVarChar', value: claim_id }
  ]);
}

async function fetchCustomerDocuments(id) {
  const claim_id = id.split('/')[0];

  return await db.request(fetchCustomerDocumentsSQL, [
    { id: 'claim_id', type: 'NVarChar', value: claim_id }
  ]);
}

let processNotesResults = function(results) {
  return results
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
        console.log(`Error parsing notes in Academy-Benefits: ${err}`);
        return null;
      }
    })
    .filter(x => x);
};

let processSearchResults = function(results) {
  return results.map(record => {
    return {
      id: `${record.claim_id}/${record.person_ref}`,
      firstName: nameCase(record.forename),
      lastName: nameCase(record.surname),
      dob: record.birth_date ? formatDisplayDate(record.birth_date) : null,
      nino: upperCase(record.nino),
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
    nino: [upperCase(record.nino)],
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
  return results.map(doc => {
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
      return [];
    }
  },

  fetchCustomerRecord: async function(id) {
    try {
      const [customerResult, benefitsResults, household] = await Promise.all([
        fetchCustomer(id),
        fetchBenefits(id),
        fetchHousehold(id)
      ]);

      let customer = processCustomer(customerResult);
      customer.benefits.income = processBenefits(benefitsResults);
      if (household.length > 0) customer.household = processHousehold(household);

      return customer;
    } catch (err) {
      console.log(`Error fetching customers in Academy-Benefits: ${err}`);
    }
  },

  fetchCustomerNotes: async function(id) {
    try {
      const results = await fetchCustomerNotes(id);
      return processNotesResults(results);
    } catch (err) {
      console.log(`Error fetching customer notes in Academy-Benefits: ${err}`);
    }
  },

  fetchCustomerDocuments: async function(id) {
    try {
      const results = await fetchCustomerDocuments(id);
      return processDocumentsResults(results);
    } catch (err) {
      console.log(
        `Error fetching customer documents in Academy-Benefits: ${err}`
      );
    }
  }
};

module.exports = Backend;
