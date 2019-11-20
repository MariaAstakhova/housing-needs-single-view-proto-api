SELECT
	hbincome.inc_amt as amount,
	hbincome.freq_len,
	hbincome.freq_period,
	hbinccode.descrip1 as description
FROM
	hbincome
	JOIN hbhousehold ON hbincome.claim_id = hbhousehold.claim_id AND hbincome.house_id = hbhousehold.house_id
	JOIN hbinccode ON hbinccode.code = hbincome.inc_code AND hbinccode.to_date = '2099-12-31'
WHERE
	hbhousehold.to_date = '2099-12-31'
	AND hbincome.claim_id = @claim_id