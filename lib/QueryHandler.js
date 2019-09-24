const sqlite3 = require('better-sqlite3');
const db = new sqlite3('singleview.db', { verbose: console.log });

const backends = {
  'UHT': require('./backends/UHT'),
  'UHTDummy': require('./backends/UHTDummy'),
  'UHW': require('./backends/UHW'),
  'UHWDummy': require('./backends/UHWDummy'),
  'Academy': require('./backends/Academy'),
  'AcademyDummy': require('./backends/AcademyDummy'),
  'Jigsaw': require('./backends/Jigsaw'),
  'JigsawDummy': require('./backends/JigsawDummy'),
  'SingleView': require('./backends/SingleView')
}

// Combine records and select the most likely match for a parameter
let getParam = function(param, records, lambda){
  let results = {};
  records.forEach(record => {
    if(record[param]){
      let field = lambda ? lambda(record[param]) : record[param];
      results[field] = results[field] ? results[field] + 1 : 1
    }
  })
  if(Object.keys(results).length > 0){
    let results_arr = Object.entries(results);
    results_arr.sort((a, b) => b[1] - a[1])
    return results_arr[0][0]
  }else{
    return null
  }
}

let QueryHandler = {
  searchCustomers: function(query, systems, cb){
    let queryCount = systems.length;
    let results = [];
    systems.forEach(system => {
      backends[system].customerSearch(query, result => {
        queryCount--;

        results = results.concat(result)
        if(queryCount == 0){
          cb({customers: results});
        }
      })
    })
  },

  saveCustomer: function(input, cb){
    let customer_id;
    let customer = {
      first_name: getParam('firstName', input.customers, name => name.toUpperCase()),
      last_name: getParam('lastName', input.customers, name => name.toUpperCase()),
      address: getParam('address', input.customers, name => name.toUpperCase()),
      dob: getParam('dob', input.customers),
      nino: getParam('nino', input.customers, name => name.toUpperCase())
    }

    // Insert into customers table
    const insertCust = db.prepare('INSERT INTO customers (first_name, last_name, address, dob, nino) VALUES ($first_name, $last_name, $address, $dob, $nino)');

    // Insert into customer_links table
    const insertLink = db.prepare('INSERT INTO customer_links (customer_id, system_id, remote_id) VALUES (?, (SELECT id FROM systems WHERE name = ?), ?)');

    const createCustomer = db.transaction((cust) => {
      const info = insertCust.run(customer)
      customer_id = info.lastInsertRowid;
      cust.forEach(customer => {
        insertLink.run(customer_id, customer.source, customer.id.toString());
      })
    });

    createCustomer(input.customers);
    cb(customer_id);
  },

  fetchCustomer: function(id, systems, cb){
    let customer = {housingRegister:{}, household: []};

    const selectCust = db.prepare('SELECT customer_links.remote_id, systems.name FROM customer_links, customers, systems WHERE systems.id = customer_links.system_id AND customers.id = customer_links.customer_id AND customers.id = ?');

    const customerLinks = selectCust.all(id);

    let queryCount = customerLinks.length;
    customerLinks.forEach(link => {
      backends[link.name].fetchCustomer(link.remote_id, customer, err => {
        queryCount--;
        if(queryCount == 0){
          cb(customer);
        }
      })
    })
  }
}

module.exports = QueryHandler;