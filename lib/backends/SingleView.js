let Backend = {
  customerSearch: function(query, cb){
    cb([
      {
        id: "1",
        firstName: "Eileen",
        lastName: "Clough",
        dob: "28/05/1976",
        nino: "DD123988D",
        source: "SingleView"
      }
    ])
  }
}

module.exports = Backend;