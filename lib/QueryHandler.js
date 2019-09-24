const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('singleview.db');

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
    console.log(input)
    let customer = {
      $first_name: getParam('firstName', input.customers, name => name.toUpperCase()),
      $last_name: getParam('lastName', input.customers, name => name.toUpperCase()),
      $address: getParam('address', input.customers, name => name.toUpperCase()),
      $nino: getParam('nino', input.customers, name => name.toUpperCase())
    }
    // Insert into customers table
    db.serialize(function() {
      var stmt = db.run("INSERT INTO customers (first_name, last_name, address, nino) VALUES ($first_name, $last_name, $address, $nino)", customer);

      db.get("SELECT last_insert_rowid() as id", (err, row) => {
        // Insert linked records
        let customer_id = row.id;
        input.customers.forEach(customer => {
          db.run("INSERT INTO customer_links (customer_id, system_id, remote_id) VALUES (?, (SELECT id FROM systems WHERE name = ?), ?)", customer_id, customer.source, customer.id.toString());
        });
      });
    });
  }
}

module.exports = QueryHandler;