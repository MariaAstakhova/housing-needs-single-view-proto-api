SELECT
  hbclaim.claim_id,
  hbclaim.check_digit,
  hbmember.person_ref,
	hbmember.forename,
	hbmember.surname,
	hbmember.birth_date,
	hbmember.nino,
	hbhousehold.addr1,
	hbhousehold.addr2,
	hbhousehold.addr3,
	hbhousehold.addr4,
	hbhousehold.post_code
FROM
	hbmember
	JOIN hbclaim ON hbclaim.claim_id = hbmember.claim_id
	LEFT JOIN hbhousehold ON hbmember.claim_id = hbhousehold.claim_id
		AND hbmember.house_id = hbhousehold.house_id
WHERE
	hbhousehold.to_date = '2099-12-31'