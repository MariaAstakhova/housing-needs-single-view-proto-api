const PostgresDb = require('./PostgresDb');
const { Systems } = require('./Constants');
const merge = require('@brikcss/merge');
const { groupRecords } = require('./RecordGroups');
const moment = require('moment');

const backends = {
  [Systems.UHT_CONTACTS]: require('./backends/UHT-Contacts'),
  [Systems.UHT_HOUSING_REGISTER]: require('./backends/UHT-HousingRegister'),
  [Systems.UHW]: require('./backends/UHW'),
  [Systems.ACADEMY_BENEFITS]: require('./backends/Academy-Benefits'),
  [Systems.ACADEMY_COUNCIL_TAX]: require('./backends/Academy-CouncilTax'),
  [Systems.JIGSAW]: require('./backends/Jigsaw'),
  [Systems.SINGLEVIEW]: require('./backends/SingleView')
};

// Combine values from multiple records and select the most likely match for a parameter
let getParam = function(param, records, lambda) {
  let results = {};
  records.forEach(record => {
    if (record && record[param]) {
      let field = lambda ? lambda(record[param]) : record[param];
      results[field] = results[field] ? results[field] + 1 : 1;
    }
  });
  if (Object.keys(results).length > 0) {
    let results_arr = Object.entries(results);
    results_arr.sort((a, b) => b[1] - a[1]);
    return results_arr[0][0];
  } else {
    return null;
  }
};

let getCustomerLinks = async function(id) {
  const query = `
    SELECT customer_links.remote_id, systems.name FROM customer_links, customers, systems 
    WHERE systems.id = customer_links.system_id AND customers.id = customer_links.customer_id AND customers.id = $1`;
  return await PostgresDb.any(query, [id]);
};

// Remove nulls and duplicates from an array
let filterArray = function(array) {
  let lookup = array.filter(x => x).map(el => JSON.stringify(el));
  return array
    .filter(x => x)
    .filter((value, index) => {
      return lookup.indexOf(JSON.stringify(value)) === index;
    });
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
  let reducer = (acc, address) => {
    let key = JSON.stringify(address.address);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(address);
    return acc;
  };
  let reduced = addresses.reduce(reducer, {});
  return Object.values(reduced).map(arr => {
    return {
      source: arr
        .map(addr => addr.source)
        .flat()
        .filter((value, index, self) => {
          return self.indexOf(value) === index;
        }),
      address: arr[0].address
    };
  });
};

// Merge and tidy response upjects from multiple backends
let mergeResponses = function(responses) {
  let merged = merge(...responses);
  merged.address = mergeAddresses(merged.address);
  filterArrays(merged);
  return merged;
};

const QueryHandler = {
  searchCustomers: async query => {
    const requests = Object.values(backends).map(async backend =>
      backend.customerSearch(query)
    );

    const results = [].concat.apply([], await Promise.all(requests));

    return groupRecords(results);
  },

  saveCustomer: async input => {
    // insert into customers table
    const insertCustQuery =
      'INSERT INTO customers (first_name, last_name, address, dob, nino) VALUES ($1, $2, $3, $4, $5) RETURNING id';

    // insert into customer_links table
    const insertLinkQuery =
      'INSERT INTO customer_links (customer_id, system_id, remote_id) VALUES ($1, (SELECT id FROM systems WHERE name = $2), $3)';

    const customer = await PostgresDb.one(insertCustQuery, [
      getParam('firstName', input.customers, name =>
        name ? name.toUpperCase() : null
      ),
      getParam('lastName', input.customers, name =>
        name ? name.toUpperCase() : null
      ),
      getParam('address', input.customers, address =>
        address ? address.toUpperCase() : null
      ),
      getParam('dob', input.customers, dob =>
        dob ? moment(dob, 'DD/MM/YYYY').format('YYYY-MM-DD') : null
      ),
      getParam('nino', input.customers, nino =>
        nino ? nino.toUpperCase() : null
      )
    ]);

    await PostgresDb.task(t => {
      const tp = input.customers
        .filter(x => x !== null)
        .map(c => {
          return t.none(insertLinkQuery, [
            customer.id,
            c.source,
            c.id.toString()
          ]);
        });

      return Promise.all(tp);
    });
    return customer.id;
  },

  fetchCustomer: async id => {
    const links = await getCustomerLinks(id);
    let requests = links.map(async link =>
      backends[link.name].fetchCustomer(link.remote_id)
    );

    const results = await Promise.all(requests);
    let customer = mergeResponses(results);

    if (!customer.housingRegister) {
      customer.housingRegister = {};
    }

    if (!customer.housingNeeds) {
      customer.housingNeeds = {};
    }

    return customer;
  },

  fetchCustomerNotes: async id => {
    const links = await getCustomerLinks(id);
    let requests = links.map(async link =>
      backends[link.name].fetchCustomerNotes(link.remote_id)
    );

    let results = [].concat.apply([], await Promise.all(requests));
    results = results.sort((a, b) => b.date - a.date);

    return { notes: results };
  },

  fetchCustomerDocuments: async id => {
    const links = await getCustomerLinks(id);
    let requests = links.map(async link =>
      backends[link.name].fetchCustomerDocuments(link.remote_id)
    );

    let results = [].concat.apply([], await Promise.all(requests));
    results = results.sort((a, b) => b.date - a.date);
    return { documents: results };
  }
};

module.exports = QueryHandler;
