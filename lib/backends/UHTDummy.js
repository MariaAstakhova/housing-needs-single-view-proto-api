let Backend = {
  customerSearch: function(query, cb){
    cb([
      {
        id: "84378193",
        firstName: "Eileen",
        lastName: "Clough",
        dob: "28/05/1976",
        nino: "DD123988D",
        source: "UHT",
        postcode: "E8 9LT",
        links: {
          uhContact: 12345
        }
      },
      {
        id: "31232819",
        firstName: "Eileen",
        lastName: "McClough",
        dob: "18/02/1974",
        nino: "HS109833A",
        source: "UHT",
        postcode: "E3 6GP"
      }
    ])
  },

  fetchCustomer: function(id, customer, cb){
    cb([])
  }
}

module.exports = Backend;