SELECT
	title,
	forename as first,
	surname as last,
	birth_date as dob
FROM
	hbmember
	JOIN hbhousehold ON hbmember.claim_id = hbhousehold.claim_id
		AND hbmember.house_id = hbhousehold.house_id
WHERE
	hbhousehold.to_date = '2099-12-31'
	AND hbmember.claim_id = @claim_id
	AND hbmember.person_ref != @person_ref