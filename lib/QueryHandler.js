const PostgresDb = require('./PostgresDb');
const { Systems } = require('./Constants');
const merge = require('@brikcss/merge');
const moment = require('moment');
const { dedupeNotes, dedupe, filterArray } = require('./Utils');

const backends = {
  [Systems.UHT_CONTACTS]: require('./backends/UHT-Contacts'),
  [Systems.UHT_HOUSING_REGISTER]: require('./backends/UHT-HousingRegister'),
  [Systems.UHW]: require('./backends/UHW'),
  [Systems.ACADEMY_BENEFITS]: require('./backends/Academy-Benefits'),
  [Systems.ACADEMY_COUNCIL_TAX]: require('./backends/Academy-CouncilTax'),
  [Systems.JIGSAW]: require('./backends/Jigsaw'),
  [Systems.SINGLEVIEW]: require('./backends/SingleView')
};

const badData = {
  address: ['10 Elmbridge Walk, Blackstone Estate, London, E8 3HA'],
  dob: ['01/01/1900']
};

const {
  cleanCustomerRecord,
  searchCustomers,
  groupRecords
} = require('./use-cases')({
  backends,
  badData,
  Systems
});

let getCustomerLinks = async function(id) {
  const query = `
    SELECT customer_links.remote_id, systems.name FROM customer_links, customers, systems 
    WHERE systems.id = customer_links.system_id AND customers.id = customer_links.customer_id AND customers.id = $1`;
  return await PostgresDb.any(query, [id]);
};

// Recursively filter duplicates from arrays in objects
let filterArrays = function(input) {
  for (let key in input) {
    if (Array.isArray(input[key])) {
      input[key] = filterArray(input[key]);
    } else if (typeof input[key] === 'object') {
      filterArrays(input[key]);
    }
  }
};

let mergeAddresses = function(addresses) {
  // Remove empty addresses
  addresses = addresses.filter(addr => addr.address.length > 0);

  // reducer lambda to group by address
  let group = (acc, address) => {
    let key = JSON.stringify(address.address);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(address);
    return acc;
  };

  // group by address
  let grouped = addresses.reduce(group, {});

  // flatten back into an array with the sources as an array in each object
  return Object.values(grouped).map(arr => {
    try {
      return {
        source: arr
          .map(addr => addr.source) // Pull out the sources into an array and deduplicate
          .filter((value, index, self) => {
            return self.indexOf(value) === index;
          }),
        address: arr[0].address
      };
    } catch (err) {
      console.error('Error merging addresses');
      console.error(err);
      return {};
    }
  });
};

// Merge and tidy response upjects from multiple backends
let mergeResponses = function(responses) {
  let merged = merge(...responses);
  if (merged.address) merged.address = mergeAddresses(merged.address);
  filterArrays(merged);
  return merged;
};

const QueryHandler = {
  searchCustomers: async query => {
    const records = await searchCustomers(query);
    const cleanedRecords = records.map(cleanCustomerRecord);
    return groupRecords(cleanedRecords);
  },

  saveCustomer: async input => {
    // insert into customers table
    const insertCustQuery = 'INSERT INTO customers DEFAULT VALUES RETURNING id';

    // insert into customer_links table
    const insertLinkQuery = `INSERT INTO customer_links (customer_id, system_id, remote_id, first_name, last_name, address, dob, nino) 
      VALUES ($(customer_id), (SELECT id FROM systems WHERE name = $(system_name)), $(remote_id), $(first_name), $(last_name), $(address), $(dob), $(nino))`;

    const customer = await PostgresDb.one(insertCustQuery);

    await PostgresDb.task(t => {
      const tp = input.customers
        .filter(x => x !== null)
        .map(c => {
          return t.none(insertLinkQuery, {
            customer_id: customer.id,
            system_name: c.source,
            remote_id: c.id.toString(),
            first_name: c.firstName,
            last_name: c.lastName,
            address: c.address,
            dob: c.dob
              ? moment(c.dob, 'DD/MM/YYYY').format('YYYY-MM-DD')
              : null,
            nino: c.nino
          });
        });

      return Promise.all(tp);
    });
    return customer.id;
  },

  deleteCustomer: async id => {
    const removeLinksQuery =
      'DELETE FROM customer_links WHERE customer_id = ${id}';
    const removeCustomerQuery = 'DELETE FROM customers WHERE id = ${id}';

    await PostgresDb.none(removeLinksQuery, { id });
    return await PostgresDb.none(removeCustomerQuery, { id });
  },

  fetchCustomer: async id => {
    return await backends[Systems.SINGLEVIEW].fetchCustomer(id);
  },

  fetchCustomerRecord: async id => {
    const links = await getCustomerLinks(id);
    let requests = links.map(async link =>
      backends[link.name].fetchCustomerRecord(link.remote_id)
    );

    const results = await Promise.all(requests);
    let customer = mergeResponses(results);

    if (!customer.housingRegister) {
      customer.housingRegister = {};
    }

    if (!customer.housingNeeds) {
      customer.housingNeeds = {};
    }

    return cleanupData(cleanCustomerRecord);
  },

  fetchCustomerNotes: async (id, hackneyToken) => {
    const links = await getCustomerLinks(id);
    let requests = links.map(async link =>
      backends[link.name].fetchCustomerNotes(link.remote_id, hackneyToken)
    );

    let results = [].concat.apply([], await Promise.all(requests));
    results = dedupeNotes(results);
    results = results.filter(x => x).sort((a, b) => b.date - a.date);

    return { notes: results };
  },

  fetchCustomerDocuments: async id => {
    const links = await getCustomerLinks(id);
    let requests = links.map(async link =>
      backends[link.name].fetchCustomerDocuments(link.remote_id)
    );

    let results = [].concat.apply([], await Promise.all(requests));
    results = dedupe(results, doc => JSON.stringify(doc));
    results = results.filter(x => x).sort((a, b) => b.date - a.date);
    return { documents: results };
  }
};

module.exports = QueryHandler;
