SELECT
	conlog.clog_details,
	conlog.clog_date,
	auser.username
FROM
	conlog
	JOIN wlapp ON wlapp.con_key = conlog.con_key
	JOIN wlmember ON wlmember.app_ref = wlapp.app_ref
	JOIN auser ON auser.user_code = conlog.user_code
WHERE
	wlmember.app_ref = @app_ref
	AND wlmember.person_no = @person_no