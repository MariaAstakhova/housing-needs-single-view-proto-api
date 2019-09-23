const request = require('request');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const strftime = require('strftime');

let loginUrl = 'https://training.housingjigsaw.co.uk/auth/login'
let searchUrl = 'https://zebracustomerstraining.azurewebsites.net/api/customerSearch'
let bearerToken = null;

let getCSRFTokens = function(cb){
  request.get({
    url: loginUrl
  }, function(err, httpResponse, body){
    let out = {cookies: httpResponse.headers['set-cookie'].map(cookie => cookie.split(';')[0] )}

    const dom = new JSDOM(body);
    out.token = dom.window.document.querySelector("input[name=__RequestVerificationToken]").value

    cb(out);
  });
}

let login = function(cb){
  if(bearerToken){
    cb(null, bearerToken);
  }else{
    getCSRFTokens(function(tokens){
      // make auth request to Jigsaw
      let authCredentials = {
        Email: process.env.Jigsaw_email,
        Password: process.env.Jigsaw_password,
        __RequestVerificationToken: tokens.token
      }

      request.post({
        url:loginUrl,
        form: authCredentials,
        headers:{
          Cookie: tokens.cookies.join('; ')
        }
      }, function(err, httpResponse, body){
        let matched = httpResponse.headers.location.match(/accesstoken=([^&]*)/);
        if(matched){
          bearerToken = matched[1]
          cb(null, bearerToken)
        }else{
          cb("Could not get auth token");
        }
      })

    });
  }
}

let runSearchQuery = function(query, token, cb){
  query.firstName = query.firstName || ''
  query.lastName = query.lastName || ''

  let name = `${query.firstName} ${query.lastName}`.trim()

  request.get({
    url: searchUrl,
    headers: {
      Authorization: `Bearer ${token}`
    },
    qs: {
      search: name
    }
  }, function(err, httpResponse, body){
    cb(null, JSON.parse(body));
  })
}

let processResults = function(results){
  return results.map(record => {
    return {
      id: record.id,
      firstName: record.firstName,
      lastName: record.lastName,
      dob: strftime('%d/%m/%Y', new Date(Date.parse(record.doB))),
      nino: record.niNumber,
      address: record.adddress ? record.address.trim() : null,
      source: "Jigsaw"
    }
  })
}

let Backend = {
  customerSearch: function(query, cb){
    login((err, token) => {
      runSearchQuery(query, token, function(err, results){
        cb(processResults(results))
      });
    })
  }
}

module.exports = Backend;