let Backend = {
  customerSearch: function(query, cb){
    cb([
      {
        id: "2314211",
        firstName: "Eileen",
        lastName: "Clough",
        dob: "28/05/1976",
        nino: "DD123988D",
        source: "Academy"
      },
      {
        id: "4728143",
        firstName: "Eileen",
        lastName: "McClough",
        dob: "18/02/1974",
        nino: "HS109833A",
        source: "Academy"
      }
    ])
  }
}

module.exports = Backend;