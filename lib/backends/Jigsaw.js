const request = require('request-promise');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { Systems } = require('../Constants');
const {
  nameCase,
  formatAddress,
  formatDisplayDate,
  formatRecordDate,
  upperCase,
  dedupe
} = require('../Utils');
const merge = require('@brikcss/merge');
const moment = require('moment');

let jigsawEnv = process.env.ENV || 'training';
let jigsawLoginEnv = {
  training: 'training',
  production: 'live'
}[jigsawEnv];

const loginUrl = `https://${jigsawLoginEnv}.housingjigsaw.co.uk/auth/login`;
const searchUrl = `https://zebracustomers${jigsawEnv}.azurewebsites.net/api/customerSearch`;
const caseUrl = `https://zebrahomelessness${jigsawEnv}.azurewebsites.net/api/casecheck/`;
const accomPlacementsUrl = caseId =>
  `https://zebraaccommodation${jigsawEnv}.azurewebsites.net/api/CaseAccommodationPlacement?caseId=${caseId}`;
const customerUrl = id =>
  `https://zebracustomers${jigsawEnv}.azurewebsites.net/api/CustomerOverview/${id}`;
const customerNotesUrl = id =>
  `https://zebracustomers${jigsawEnv}.azurewebsites.net/api/Customer/${id}/Notes`;
const caseNotesUrl = id =>
  `https://zebrahomelessness${jigsawEnv}.azurewebsites.net/api/Cases/${id}/Notes`;
const docsUrl = `https://zebrahomelessness${jigsawEnv}.azurewebsites.net/api/cases/getcasedocs/`;
const collabCaseworkUrl = `${process.env.COLLAB_CASEWORK_API}/contacts`;
const collabCaseworkMessagesUrl = id => `${collabCaseworkUrl}/${id}/messages`;

let bearerToken = null;
let lastLogin = null;

const getCSRFTokens = async function() {
  const httpResponse = await request.get({
    url: loginUrl,
    resolveWithFullResponse: true
  });

  const cookies = httpResponse.headers['set-cookie'].map(
    cookie => cookie.split(';')[0]
  );

  const dom = new JSDOM(httpResponse.body);
  const token = dom.window.document.querySelector(
    'input[name=__RequestVerificationToken]'
  ).value;

  return {
    cookies,
    token
  };
};

const login = async function() {
  if (bearerToken && lastLogin && lastLogin > new Date() - 3600) {
    return bearerToken;
  } else {
    let tokens = await getCSRFTokens();
    // make auth request to Jigsaw
    let authCredentials = {
      Email: process.env.Jigsaw_email,
      Password: process.env.Jigsaw_password,
      __RequestVerificationToken: tokens.token
    };

    const httpResponse = await request.post({
      url: loginUrl,
      form: authCredentials,
      headers: {
        Cookie: tokens.cookies.join('; ')
      },
      resolveWithFullResponse: true,
      simple: false
    });

    let matched = httpResponse.headers.location.match(/accesstoken=([^&]*)/);
    if (matched) {
      bearerToken = matched[1];
      lastLogin = new Date();
      return bearerToken;
    } else {
      throw 'Could not get auth token';
    }
  }
};

let doGetRequest = async function(url, qs, headers) {
  let options = { url, resolveWithFullResponse: true };
  if (headers) options.headers = headers;
  if (qs) options.qs = qs;

  const httpResponse = await request.get(options);
  return JSON.parse(httpResponse.body);
};

let doJigsawGetRequest = async function(url, qs) {
  const token = await login();
  return doGetRequest(url, qs, { Authorization: `Bearer ${token}` });
};

let doPostRequest = async function(url, json, headers) {
  let options = { url, json, resolveWithFullResponse: true };
  if (headers) options.headers = headers;

  const httpResponse = await request.post(options);
  return httpResponse.body;
};

let doJigsawPostRequest = async function(url, json) {
  const token = await login();
  return doPostRequest(url, json, { Authorization: `Bearer ${token}` });
};

let runSearchQuery = async function(query) {
  let search = [query.firstName, query.lastName].filter(x => x).join(' ');

  return await doJigsawGetRequest(searchUrl, { search });
};

let fetchCases = async function(id) {
  return await doJigsawGetRequest(caseUrl + id);
};

let fetchAccomPlacements = async function(caseId) {
  return await doJigsawGetRequest(accomPlacementsUrl(caseId));
};

let fetchCustomer = async function(id) {
  return await doJigsawGetRequest(customerUrl(id));
};

let fetchCustomerNotes = async function(id) {
  return await doJigsawGetRequest(customerNotesUrl(id));
};

let fetchCaseNotes = async function(id) {
  let casesResult = await fetchCases(id);

  const requests = casesResult.cases.map(c => {
    return doJigsawGetRequest(caseNotesUrl(c.id));
  });

  return [].concat.apply([], await Promise.all(requests));
};

let fetchCustomerSms = async function(jigsawId) {
  const smsContact = await doGetRequest(collabCaseworkUrl, { jigsawId });

  if (smsContact.length === 0) return [];

  return await doGetRequest(collabCaseworkMessagesUrl(smsContact[0].id));
};

let fetchCustomerDocuments = async function(id) {
  let casesResult = await fetchCases(id);

  const requests = casesResult.cases.map(c => {
    return doJigsawPostRequest(docsUrl + c.id, {});
  });

  return [].concat.apply([], await Promise.all(requests));
};

let processSearchResults = function(results) {
  if (results.length == 1 && results[0].id == 0) {
    return [];
  } else {
    return dedupe(results, x => x.id).map(record => {
      return {
        id: record.id.toString(),
        firstName: nameCase(record.firstName),
        lastName: nameCase(record.lastName),
        dob: formatDisplayDate(record.doB),
        nino: upperCase(record.niNumber),
        address: formatAddress(record.address).join(','),
        source: Systems.JIGSAW
      };
    });
  }
};

const processCases = function(id, result) {
  let customer = {
    systemIds: {
      jigsaw: [id]
    },
    housingNeeds: {}
  };
  if (result.cases && result.cases.filter(c => c.isCurrent).length > 0) {
    const curr = result.cases.filter(c => c.isCurrent)[0];
    customer.housingNeeds.jigsawCaseId = curr.id.toString();
    customer.housingNeeds.status = curr.statusName;
  } else {
    customer.housingNeeds.status = 'No homelessness case';
  }
  return customer;
};

const processAccomPlacements = function(result) {
  let customer = {
    housingNeeds: {}
  };

  if (result.isCurrentlyInPlacement) {
    const curr = result.placements.filter(
      p => p.endDate === null || moment(p.endDate).isAfter()
    )[0];

    customer.housingNeeds.currentPlacement = {};

    customer.housingNeeds.currentPlacement.address = curr.address;
    customer.housingNeeds.currentPlacement.duty = curr.placementDuty;
    customer.housingNeeds.currentPlacement.type = curr.placementType;
    customer.housingNeeds.currentPlacement.rentCostCustomer =
      curr.rentCostCustomer;
    customer.housingNeeds.currentPlacement.tenancyId = curr.tenancyId;

    if (curr.startDate !== null) {
      customer.housingNeeds.currentPlacement.startDate = formatRecordDate(
        curr.startDate
      );
    }

    if (curr.endDate !== null) {
      customer.housingNeeds.currentPlacement.endDate = formatRecordDate(
        curr.endDate
      );
    }
  }

  return customer;
};

const processCustomer = function(result) {
  const info = result.personInfo;

  let customer = {
    team: {}
  };

  customer.address = [
    {
      source: Systems.JIGSAW,
      address: formatAddress(info.addressString)
    }
  ];
  customer.dob = [formatRecordDate(info.dateOfBirth)];
  customer.email = [info.emailAddress];
  customer.phone = [info.homePhoneNumber, info.mobilePhoneNumber];
  customer.nhsNumber = info.nhsNumber;
  customer.nino = [upperCase(info.nationalInsuranceNumber)];

  if (result.personInfo.supportWorker !== null) {
    customer.team.name = nameCase(info.supportWorker.fullName);
    customer.team.jobTitle = info.supportWorker.jobTitle;
    customer.team.agency = info.supportWorker.agency;
    customer.team.phone = info.supportWorker.phoneNumber;
    customer.team.email = info.supportWorker.emailAddress;
  }

  return customer;
};

let processNotesResults = function(results, noteType) {
  noteType = noteType || 'Note';
  return results.map(note => {
    const date = note.interviewDate
      ? formatRecordDate(note.interviewDate)
      : formatRecordDate(note.createdDate);

    return {
      title: noteType,
      text: note.content,
      date: date,
      user: note.officerName,
      system: Systems.JIGSAW
    };
  });
};

let processDocumentsResults = function(results) {
  return results
    .map(r => {
      return r.caseDocuments.map(doc => {
        return {
          title: 'Document',
          text: doc.name,
          date: formatRecordDate(doc.date),
          user: doc.casePersonName,
          system: Systems.JIGSAW
        };
      });
    })
    .flat();
};

let Backend = {
  customerSearch: async function(query) {
    try {
      const results = await runSearchQuery(query);
      return processSearchResults(results);
    } catch (err) {
      console.log(`Error searching customers in Jigsaw: ${err}`);
    }
  },

  fetchCustomerRecord: async function(id) {
    try {
      const caseDetails = processCases(id, await fetchCases(id));

      let accomPlacements = {};
      if (caseDetails.housingNeeds.jigsawCaseId) {
        accomPlacements = processAccomPlacements(
          await fetchAccomPlacements(caseDetails.housingNeeds.jigsawCaseId)
        );
      }

      const customerDetails = processCustomer(await fetchCustomer(id));
      const customer = merge(
        ...[caseDetails, accomPlacements, customerDetails]
      );

      return customer;
    } catch (err) {
      console.log(`Error fetching customers in Jigsaw: ${err}`);
    }
  },

  fetchCustomerNotes: async function(id) {
    try {
      const custNotes = await fetchCustomerNotes(id);
      const caseNotes = await fetchCaseNotes(id);
      const sms = await fetchCustomerSms(id);

      const messages = sms.map(m => {
        return {
          title: `${m.outgoing ? 'Outgoing' : 'Incoming'} SMS`,
          text: m.message,
          date: formatRecordDate(m.time),
          user: m.username,
          system: 'SMS'
        };
      });

      return processNotesResults(custNotes, 'Customer Note').concat(
        processNotesResults(caseNotes, 'Case Note'),
        messages
      );
    } catch (err) {
      console.log(`Error fetching customer notes in Jigsaw: ${err}`);
    }
  },

  fetchCustomerDocuments: async function(id) {
    try {
      const result = await fetchCustomerDocuments(id);
      return processDocumentsResults(result);
    } catch (err) {
      `Error fetching customer documents in Jigsaw: ${err}`;
    }
  }
};

module.exports = Backend;
