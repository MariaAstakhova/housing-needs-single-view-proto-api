SELECT
  hbmember.claim_id,
  hbmember.title,
	hbmember.forename,
	hbmember.surname,
	hbmember.birth_date,
	hbmember.nino,
	hbhousehold.addr1,
	hbhousehold.addr2,
	hbhousehold.addr3,
	hbhousehold.addr4,
  hbhousehold.post_code,
  hbclaim.status_ind
FROM
  hbmember
  JOIN hbclaim ON hbclaim.claim_id = hbmember.claim_id
  JOIN hbhousehold ON hbmember.claim_id = hbhousehold.claim_id
		AND hbmember.house_id = hbhousehold.house_id
WHERE hbmember.claim_id = @claim_id
  AND hbmember.person_ref = @person_ref
  AND hbhousehold.to_date = '2099-12-31'